import { Prisma, type Caixa, type Filtro } from "@prisma/client";
import { db } from "./db";
import { emailDe } from "./enderecos";
import { avaliarFiltros } from "./filtros";
import type { MensagemGmail } from "./gmail";
import { lerMensagemGmail, type MensagemLida } from "./leitura";

export type Contexto = {
  workspaceId: string;
  enderecos: Set<string>; // endereços das caixas do workspace (emails "nossos")
  filtros: Filtro[];
};

export async function carregarContexto(workspaceId: string): Promise<Contexto> {
  const [caixas, filtros] = await Promise.all([
    db.caixa.findMany({ where: { workspaceId }, select: { endereco: true } }),
    db.filtro.findMany({ where: { workspaceId } }),
  ]);
  return { workspaceId, enderecos: new Set(caixas.map((c) => c.endereco)), filtros };
}

const LABELS_IGNORADOS = ["DRAFT", "SPAM", "TRASH", "CHAT"];

export type Resultado = "nova" | "recebimento" | "ignorada";

/** Guarda uma mensagem do Gmail no workspace, sem duplicar e agrupando na conversa certa. */
export async function ingerir(ctx: Contexto, caixa: Caixa, g: MensagemGmail): Promise<Resultado> {
  if (g.labelIds?.some((l) => LABELS_IGNORADOS.includes(l))) return "ignorada";
  const m = lerMensagemGmail(g);
  const recebimento = { caixaId: caixa.id, gmailMsgId: g.id, gmailThreadId: g.threadId };

  const existente = await db.mensagem.findUnique({ where: { messageIdRfc: m.messageIdRfc }, select: { id: true } });
  if (existente) {
    await registrarRecebimento(existente.id, recebimento);
    return "recebimento";
  }

  const nossa = ctx.enderecos.has(emailDe(m.de));
  let conversaId = await encontrarConversa(ctx.workspaceId, caixa.id, g.threadId, m);
  let tagIds: string[] = [];

  if (!conversaId && !nossa) {
    const decisao = avaliarFiltros(ctx.filtros, m);
    if (decisao.ignorar) return "ignorada";
    tagIds = decisao.tagIds;
  }

  try {
    await db.$transaction(async (tx) => {
      if (!conversaId) {
        const conversa = await tx.conversa.create({
          data: {
            workspaceId: ctx.workspaceId,
            assunto: m.assunto,
            trecho: m.trecho,
            ultimaMsgEm: m.enviadaEm,
            // Conversa iniciada por nós fica aguardando resposta do cliente.
            status: nossa ? "PENDENTE" : "ABERTA",
          },
        });
        conversaId = conversa.id;
      }
      await tx.mensagem.create({
        data: {
          conversaId,
          messageIdRfc: m.messageIdRfc,
          referencias: m.referencias,
          assunto: m.assunto,
          de: m.de,
          para: m.para,
          cc: m.cc,
          trecho: m.trecho,
          corpoTexto: m.corpoTexto,
          corpoHtml: m.corpoHtml,
          anexos: m.anexos,
          enviadaEm: m.enviadaEm,
          recebimentos: { create: recebimento },
        },
      });
      await atualizarConversa(tx, conversaId, m, nossa);
      if (tagIds.length) {
        await tx.conversaTag.createMany({ data: tagIds.map((tagId) => ({ conversaId: conversaId!, tagId })), skipDuplicates: true });
      }
    });
  } catch (e) {
    // Outra caixa gravou a mesma mensagem ao mesmo tempo: só registra o recebimento.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const msg = await db.mensagem.findUnique({ where: { messageIdRfc: m.messageIdRfc }, select: { id: true } });
      if (msg) await registrarRecebimento(msg.id, recebimento);
      return "recebimento";
    }
    throw e;
  }
  return "nova";
}

async function registrarRecebimento(mensagemId: string, r: { caixaId: string; gmailMsgId: string; gmailThreadId: string }) {
  await db.recebimento.createMany({ data: [{ mensagemId, ...r }], skipDuplicates: true });
}

async function encontrarConversa(workspaceId: string, caixaId: string, threadId: string, m: MensagemLida) {
  if (m.referencias.length) {
    const pai = await db.mensagem.findFirst({
      where: { messageIdRfc: { in: m.referencias }, conversa: { workspaceId } },
      select: { conversaId: true },
      orderBy: { enviadaEm: "desc" },
    });
    if (pai) return pai.conversaId;
  }
  const mesmaThread = await db.recebimento.findFirst({
    where: { caixaId, gmailThreadId: threadId },
    select: { mensagem: { select: { conversaId: true } } },
  });
  return mesmaThread?.mensagem.conversaId ?? null;
}

export async function atualizarConversa(
  tx: Prisma.TransactionClient,
  conversaId: string,
  m: { enviadaEm: Date; trecho: string },
  nossa: boolean,
) {
  const conversa = await tx.conversa.findUniqueOrThrow({ where: { id: conversaId } });
  const maisRecente = m.enviadaEm >= conversa.ultimaMsgEm;
  await tx.conversa.update({
    where: { id: conversaId },
    data: {
      ...(maisRecente ? { ultimaMsgEm: m.enviadaEm, trecho: m.trecho } : {}),
      // Cliente respondeu: a conversa volta para a caixa de entrada.
      ...(!nossa && maisRecente && conversa.status !== "ABERTA" ? { status: "ABERTA" } : {}),
    },
  });
}
