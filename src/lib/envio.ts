import { Prisma, type Caixa, type Membro, type Workspace } from "@prisma/client";
import { db } from "./db";
import { emailDe, formatarEndereco } from "./enderecos";
import { clienteGmail } from "./gmail";
import { atualizarConversa } from "./ingestao";
import { lerMensagemGmail } from "./leitura";
import { montarMensagem, novoMessageId, textoParaHtml, type AnexoEnvio } from "./mime";

type MembroComWorkspace = Membro & { workspace: Workspace };

type ConversaParaResposta = {
  mensagens: { recebimentos: { caixaId: string }[] }[];
};

/** Caixas que já receberam ou enviaram mensagens desta conversa, da mais recente para a mais antiga. */
function caixasDaConversa(conversa: ConversaParaResposta): string[] {
  const ids: string[] = [];
  for (const m of [...conversa.mensagens].reverse()) for (const r of m.recebimentos) if (!ids.includes(r.caixaId)) ids.push(r.caixaId);
  return ids;
}

/**
 * De quais caixas o membro pode enviar. Novo email: a própria caixa e as compartilhadas.
 * Resposta: depende do modo e da regra "Resposta sai" do workspace.
 */
export function remetentesPermitidos(membro: MembroComWorkspace, caixas: Caixa[], conversa?: ConversaParaResposta): Caixa[] {
  const propria = caixas.filter((c) => c.membroId === membro.id);
  const compartilhadas = caixas.filter((c) => c.membroId === null);
  const basicas = [...propria, ...compartilhadas];
  if (!conversa) return basicas;

  const daConversa = caixasDaConversa(conversa)
    .map((id) => caixas.find((c) => c.id === id))
    .filter((c): c is Caixa => Boolean(c));
  const { modo, respostaPor } = membro.workspace;

  if (modo === "CAIXA_UNICA") {
    const compartilhadasDaConversa = daConversa.filter((c) => c.membroId === null);
    return compartilhadasDaConversa.length ? compartilhadasDaConversa : compartilhadas;
  }
  switch (respostaPor) {
    case "QUEM_RESPONDEU":
      return basicas;
    case "QUEM_RECEBEU":
      return daConversa.length ? daConversa : basicas;
    case "SO_DESTINATARIO":
      return daConversa.filter((c) => c.membroId === membro.id || c.membroId === null);
  }
}

export type DadosEnvio = {
  membro: MembroComWorkspace;
  caixaId: string;
  para: string[];
  cc: string[];
  assunto: string;
  texto: string;
  anexos: AnexoEnvio[];
  conversaId?: string;
  citarAnterior?: boolean;
};

function citar(texto: string, autor: string, data: Date): string {
  const quando = data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: process.env.FUSO ?? "America/Sao_Paulo" });
  return `\n\nEm ${quando}, ${autor} escreveu:\n${texto.split("\n").map((l) => `> ${l}`).join("\n")}`;
}

/** Envia pelo Gmail da caixa escolhida e grava a mensagem na conversa. Devolve o id da conversa. */
export async function enviarEmail(d: DadosEnvio): Promise<string> {
  const { membro } = d;
  const caixas = await db.caixa.findMany({ where: { workspaceId: membro.workspaceId } });
  const conversa = d.conversaId
    ? await db.conversa.findFirstOrThrow({
        where: { id: d.conversaId, workspaceId: membro.workspaceId },
        include: { mensagens: { orderBy: { enviadaEm: "asc" }, include: { recebimentos: true } } },
      })
    : null;

  const caixa = remetentesPermitidos(membro, caixas, conversa ?? undefined).find((c) => c.id === d.caixaId);
  if (!caixa) throw new Error("Você não pode enviar por esta caixa");
  if (!d.para.length) throw new Error("Informe pelo menos um destinatário");

  let texto = d.texto.trimEnd();
  if (membro.assinatura?.trim()) texto += `\n\n${membro.assinatura.trim()}`;
  else if (caixa.membroId === null) texto += `\n\n${membro.nome}`;

  const anterior = conversa?.mensagens.at(-1);
  if (anterior && d.citarAnterior && anterior.corpoTexto) texto += citar(anterior.corpoTexto, anterior.de, anterior.enviadaEm);

  const nomeRemetente = caixa.membroId === null ? membro.workspace.nome : membro.nome;
  const de = formatarEndereco({ nome: nomeRemetente, email: caixa.endereco });
  const messageId = novoMessageId(caixa.endereco.split("@")[1]);
  const raw = montarMensagem(
    {
      de,
      para: d.para,
      cc: d.cc,
      assunto: d.assunto,
      texto,
      html: textoParaHtml(texto),
      inReplyTo: anterior?.messageIdRfc,
      references: anterior ? [...anterior.referencias, anterior.messageIdRfc].slice(-20) : undefined,
      anexos: d.anexos,
    },
    messageId,
  );

  const threadId = conversa?.mensagens
    .flatMap((m) => m.recebimentos)
    .findLast((r) => r.caixaId === caixa.id)?.gmailThreadId;

  const gmail = clienteGmail(caixa.refreshTokenCifrado);
  const enviada = await gmail.enviar(raw, threadId);
  // Lê de volta o que o Gmail realmente gravou (Message-ID, anexos, data).
  const lida = lerMensagemGmail(await gmail.mensagem(enviada.id));
  const recebimento = { caixaId: caixa.id, gmailMsgId: enviada.id, gmailThreadId: enviada.threadId };

  return db.$transaction(async (tx) => {
    const conversaId =
      conversa?.id ??
      (
        await tx.conversa.create({
          data: { workspaceId: membro.workspaceId, assunto: d.assunto, trecho: lida.trecho, ultimaMsgEm: lida.enviadaEm, status: "PENDENTE" },
        })
      ).id;

    const jaSincronizada = await tx.mensagem.findUnique({ where: { messageIdRfc: lida.messageIdRfc } });
    if (jaSincronizada) {
      await tx.mensagem.update({ where: { id: jaSincronizada.id }, data: { enviadaPorId: membro.id } });
    } else {
      await tx.mensagem.create({
        data: {
          conversaId,
          messageIdRfc: lida.messageIdRfc,
          referencias: lida.referencias,
          assunto: lida.assunto,
          de: lida.de || de,
          para: lida.para,
          cc: lida.cc,
          trecho: lida.trecho,
          corpoTexto: lida.corpoTexto ?? texto,
          corpoHtml: lida.corpoHtml,
          anexos: lida.anexos as unknown as Prisma.InputJsonValue,
          enviadaEm: lida.enviadaEm,
          enviadaPorId: membro.id,
          recebimentos: { create: recebimento },
        },
      });
    }
    await atualizarConversa(tx, conversaId, lida, true);
    await tx.leitura.upsert({
      where: { membroId_conversaId: { membroId: membro.id, conversaId } },
      create: { membroId: membro.id, conversaId, lidaEm: new Date() },
      update: { lidaEm: new Date() },
    });
    return conversaId;
  });
}

/** Destinatários padrão de "Responder" e "Responder a todos". */
export function destinatariosResposta(
  ultima: { de: string; para: string[]; cc: string[] },
  enderecosNossos: Set<string>,
  todos: boolean,
): { para: string[]; cc: string[] } {
  const ehNossa = enderecosNossos.has(emailDe(ultima.de));
  // Se a última foi enviada por nós, "responder" volta para quem recebeu.
  const para = ehNossa ? ultima.para : [ultima.de];
  if (!todos) return { para, cc: [] };
  const vistos = new Set(para.map(emailDe));
  const cc = [...(ehNossa ? [] : ultima.para), ...ultima.cc].filter((e) => {
    const email = emailDe(e);
    if (enderecosNossos.has(email) || vistos.has(email)) return false;
    vistos.add(email);
    return true;
  });
  return { para, cc };
}
