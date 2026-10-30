import type { Caixa } from "@prisma/client";
import { db } from "./db";
import { clienteGmail, ErroGmail, type ClienteGmail, type MensagemGmail } from "./gmail";
import { carregarContexto, ingerir, type Contexto } from "./ingestao";

const DIAS_INICIAIS = Number(process.env.SINCRONIZAR_DIAS ?? 30);
const LIMITE_INICIAL = 2000;
const LOTE = 10;

export type Relatorio = { caixa: string; novas: number; erro?: string };

/** Busca as mensagens em paralelo, mas grava em ordem cronológica (pais antes das respostas). */
async function ingerirIds(ctx: Contexto, caixa: Caixa, gmail: ClienteGmail, ids: string[]) {
  let novas = 0;
  for (let i = 0; i < ids.length; i += LOTE) {
    const lote = await Promise.all(
      ids.slice(i, i + LOTE).map((id) =>
        gmail.mensagem(id).catch((e) => {
          if (e instanceof ErroGmail && e.status === 404) return null; // apagada nesse meio-tempo
          throw e;
        }),
      ),
    );
    const ordenadas = lote
      .filter((m): m is MensagemGmail => m !== null)
      .sort((a, b) => Number(a.internalDate) - Number(b.internalDate));
    for (const m of ordenadas) if ((await ingerir(ctx, caixa, m)) === "nova") novas++;
  }
  return novas;
}

async function sincronizacaoInicial(ctx: Contexto, caixa: Caixa, gmail: ClienteGmail) {
  const { historyId } = await gmail.perfil();
  const ids: string[] = [];
  let pagina: string | undefined;
  do {
    const r = await gmail.listarMensagens(`newer_than:${DIAS_INICIAIS}d`, pagina);
    ids.push(...(r.messages ?? []).map((m) => m.id));
    pagina = r.nextPageToken;
  } while (pagina && ids.length < LIMITE_INICIAL);
  // A lista vem da mais nova para a mais antiga.
  const novas = await ingerirIds(ctx, caixa, gmail, ids.slice(0, LIMITE_INICIAL).reverse());
  return { novas, historyId };
}

async function sincronizacaoIncremental(ctx: Contexto, caixa: Caixa, gmail: ClienteGmail, desde: string) {
  const ids: string[] = [];
  let historyId = desde;
  let pagina: string | undefined;
  do {
    const r = await gmail.historico(desde, pagina);
    for (const h of r.history ?? []) for (const a of h.messagesAdded ?? []) ids.push(a.message.id);
    historyId = r.historyId;
    pagina = r.nextPageToken;
  } while (pagina);
  const novas = await ingerirIds(ctx, caixa, gmail, [...new Set(ids)]);
  return { novas, historyId };
}

export async function sincronizarCaixa(caixaId: string): Promise<Relatorio> {
  const caixa = await db.caixa.findUniqueOrThrow({ where: { id: caixaId } });
  try {
    const ctx = await carregarContexto(caixa.workspaceId);
    const gmail = clienteGmail(caixa.refreshTokenCifrado);
    let resultado;
    if (caixa.historyId) {
      try {
        resultado = await sincronizacaoIncremental(ctx, caixa, gmail, caixa.historyId);
      } catch (e) {
        // historyId expirado (mais de ~1 semana sem sincronizar): refaz a carga inicial.
        if (!(e instanceof ErroGmail && e.status === 404)) throw e;
        resultado = await sincronizacaoInicial(ctx, caixa, gmail);
      }
    } else {
      resultado = await sincronizacaoInicial(ctx, caixa, gmail);
    }
    await db.caixa.update({
      where: { id: caixa.id },
      data: { historyId: resultado.historyId, sincronizadaEm: new Date(), erroSincronizacao: null },
    });
    return { caixa: caixa.endereco, novas: resultado.novas };
  } catch (e) {
    const erro = e instanceof Error ? e.message.slice(0, 500) : String(e);
    await db.caixa.update({ where: { id: caixa.id }, data: { erroSincronizacao: erro } });
    return { caixa: caixa.endereco, novas: 0, erro };
  }
}

const estado = globalThis as unknown as { sincronizando?: Promise<Relatorio[]> };

/** Sincroniza todas as caixas. Chamadas simultâneas reaproveitam a execução em andamento. */
export function sincronizarTodas(workspaceId?: string): Promise<Relatorio[]> {
  estado.sincronizando ??= (async () => {
    try {
      const caixas = await db.caixa.findMany({ where: workspaceId ? { workspaceId } : {}, select: { id: true } });
      const relatorios: Relatorio[] = [];
      for (const c of caixas) relatorios.push(await sincronizarCaixa(c.id));
      return relatorios;
    } finally {
      estado.sincronizando = undefined;
    }
  })();
  return estado.sincronizando;
}
