import type { Prisma } from "@prisma/client";
import { db } from "./db";

export const VISOES = {
  entrada: "Caixa de entrada",
  minhas: "Atribuídas a mim",
  semDono: "Sem responsável",
  pendentes: "Pendentes",
  resolvidas: "Resolvidas",
  enviadas: "Enviadas por mim",
  todas: "Todas",
} as const;

export type Visao = keyof typeof VISOES;

export const POR_PAGINA = 50;

export function filtroDaVisao(visao: Visao, membroId: string): Prisma.ConversaWhereInput {
  switch (visao) {
    case "entrada":
      return { status: "ABERTA" };
    case "minhas":
      return { responsavelId: membroId, status: { not: "RESOLVIDA" } };
    case "semDono":
      return { responsavelId: null, status: "ABERTA" };
    case "pendentes":
      return { status: "PENDENTE" };
    case "resolvidas":
      return { status: "RESOLVIDA" };
    case "enviadas":
      return { mensagens: { some: { enviadaPorId: membroId } } };
    case "todas":
      return {};
  }
}

export type ParametrosLista = { visao: Visao; caixaId?: string; tagId?: string; busca?: string; pagina: number };

export async function listarConversas(workspaceId: string, membroId: string, p: ParametrosLista) {
  const busca = p.busca?.trim();
  const where: Prisma.ConversaWhereInput = {
    workspaceId,
    AND: [
      filtroDaVisao(p.visao, membroId),
      p.tagId ? { tags: { some: { tagId: p.tagId } } } : {},
      p.caixaId ? { mensagens: { some: { recebimentos: { some: { caixaId: p.caixaId } } } } } : {},
      busca
        ? {
            OR: [
              { assunto: { contains: busca, mode: "insensitive" } },
              { mensagens: { some: { de: { contains: busca, mode: "insensitive" } } } },
              { mensagens: { some: { corpoTexto: { contains: busca, mode: "insensitive" } } } },
            ],
          }
        : {},
    ],
  };

  const [total, conversas] = await Promise.all([
    db.conversa.count({ where }),
    db.conversa.findMany({
      where,
      orderBy: { ultimaMsgEm: "desc" },
      skip: (p.pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      include: {
        tags: { include: { tag: true } },
        responsavel: { select: { id: true, nome: true } },
        leituras: { where: { membroId } },
        mensagens: { orderBy: { enviadaEm: "asc" }, select: { de: true, enviadaPorId: true, anexos: true } },
        _count: { select: { comentarios: true } },
      },
    }),
  ]);

  // Em quais caixas cada conversa chegou (para os selos "para joao@, maria@").
  const recebimentos = await db.recebimento.findMany({
    where: { mensagem: { conversaId: { in: conversas.map((c) => c.id) } } },
    select: { caixaId: true, mensagem: { select: { conversaId: true } } },
    distinct: ["caixaId", "mensagemId"],
  });
  const caixasPorConversa = new Map<string, Set<string>>();
  for (const r of recebimentos) {
    const id = r.mensagem.conversaId;
    if (!caixasPorConversa.has(id)) caixasPorConversa.set(id, new Set());
    caixasPorConversa.get(id)!.add(r.caixaId);
  }

  return {
    total,
    conversas: conversas.map((c) => ({
      ...c,
      lida: c.leituras.some((l) => l.lidaEm >= c.ultimaMsgEm),
      caixaIds: [...(caixasPorConversa.get(c.id) ?? [])],
      temAnexo: c.mensagens.some((m) => Array.isArray(m.anexos) && m.anexos.length > 0),
    })),
  };
}

export async function contagens(workspaceId: string, membroId: string) {
  const contar = (visao: Visao) => db.conversa.count({ where: { workspaceId, ...filtroDaVisao(visao, membroId) } });
  const [entrada, minhas, semDono, pendentes] = await Promise.all([
    contar("entrada"),
    contar("minhas"),
    contar("semDono"),
    contar("pendentes"),
  ]);
  return { entrada, minhas, semDono, pendentes } as Partial<Record<Visao, number>>;
}
