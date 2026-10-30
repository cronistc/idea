"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AcaoFiltro, Modo, Papel, RespostaPor, Status, TipoFiltro } from "@prisma/client";
import { db } from "@/lib/db";
import { emailDe, emailValido, separarLista } from "@/lib/enderecos";
import { enviarEmail } from "@/lib/envio";
import type { AnexoEnvio } from "@/lib/mime";
import { membroAtual } from "@/lib/sessao";
import { sincronizarTodas } from "@/lib/sincronizacao";

async function exigirMembro() {
  const membro = await membroAtual();
  if (!membro) redirect("/");
  return membro;
}

async function exigirAdmin() {
  const membro = await exigirMembro();
  if (membro.papel !== "ADMIN") throw new Error("Apenas administradores");
  return membro;
}

function texto(form: FormData, campo: string): string {
  return String(form.get(campo) ?? "").trim();
}

function umDe<T extends string>(valor: string, opcoes: readonly T[]): T {
  if (!opcoes.includes(valor as T)) throw new Error(`Valor inválido: ${valor}`);
  return valor as T;
}

/** Garante que a conversa é do workspace do membro. */
async function conversaDoMembro(conversaId: string) {
  const membro = await exigirMembro();
  const conversa = await db.conversa.findFirst({ where: { id: conversaId, workspaceId: membro.workspaceId } });
  if (!conversa) throw new Error("Conversa não encontrada");
  return { membro, conversa };
}

const STATUS = ["ABERTA", "PENDENTE", "RESOLVIDA"] as const satisfies readonly Status[];

// ---------- Conversa ----------

export async function alterarStatus(form: FormData) {
  const { conversa } = await conversaDoMembro(texto(form, "conversaId"));
  await db.conversa.update({ where: { id: conversa.id }, data: { status: umDe(texto(form, "status"), STATUS) } });
  revalidatePath("/", "layout");
}

export async function atribuir(form: FormData) {
  const { membro, conversa } = await conversaDoMembro(texto(form, "conversaId"));
  const responsavelId = texto(form, "responsavelId") || null;
  if (responsavelId && !(await db.membro.findFirst({ where: { id: responsavelId, workspaceId: membro.workspaceId } }))) {
    throw new Error("Membro inválido");
  }
  await db.conversa.update({ where: { id: conversa.id }, data: { responsavelId } });
  revalidatePath("/", "layout");
}

export async function alternarTag(form: FormData) {
  const { membro, conversa } = await conversaDoMembro(texto(form, "conversaId"));
  const tag = await db.tag.findFirst({ where: { id: texto(form, "tagId"), workspaceId: membro.workspaceId } });
  if (!tag) throw new Error("Tag inválida");
  const chave = { conversaId_tagId: { conversaId: conversa.id, tagId: tag.id } };
  if (await db.conversaTag.findUnique({ where: chave })) await db.conversaTag.delete({ where: chave });
  else await db.conversaTag.create({ data: { conversaId: conversa.id, tagId: tag.id } });
  revalidatePath("/", "layout");
}

export async function comentar(form: FormData) {
  const { membro, conversa } = await conversaDoMembro(texto(form, "conversaId"));
  const conteudo = texto(form, "texto");
  if (!conteudo) return;
  await db.comentario.create({ data: { conversaId: conversa.id, membroId: membro.id, texto: conteudo } });
  revalidatePath(`/conversa/${conversa.id}`);
}

export async function excluirComentario(form: FormData) {
  const membro = await exigirMembro();
  const comentario = await db.comentario.findUnique({ where: { id: texto(form, "comentarioId") } });
  if (!comentario || (comentario.membroId !== membro.id && membro.papel !== "ADMIN")) throw new Error("Sem permissão");
  await db.comentario.delete({ where: { id: comentario.id } });
  revalidatePath(`/conversa/${comentario.conversaId}`);
}

export async function marcarNaoLida(form: FormData) {
  const { membro, conversa } = await conversaDoMembro(texto(form, "conversaId"));
  await db.leitura.deleteMany({ where: { membroId: membro.id, conversaId: conversa.id } });
  redirect("/caixa");
}

const ACOES_LOTE = ["resolver", "reabrir", "pendente", "lida", "naoLida", "atribuirMim", "excluir"] as const;

export type AcaoLote = (typeof ACOES_LOTE)[number];

export async function acaoEmLote(acaoPedida: AcaoLote, form: FormData) {
  const membro = await exigirMembro();
  const acao = umDe(acaoPedida, ACOES_LOTE);
  const ids = form.getAll("ids").map(String);
  if (!ids.length) return;
  const where = { id: { in: ids }, workspaceId: membro.workspaceId };
  const permitidas = (await db.conversa.findMany({ where, select: { id: true } })).map((c) => c.id);

  switch (acao) {
    case "resolver":
    case "reabrir":
    case "pendente": {
      const status = { resolver: "RESOLVIDA", reabrir: "ABERTA", pendente: "PENDENTE" }[acao] as Status;
      await db.conversa.updateMany({ where, data: { status } });
      break;
    }
    case "atribuirMim":
      await db.conversa.updateMany({ where, data: { responsavelId: membro.id } });
      break;
    case "lida":
      await db.$transaction(
        permitidas.map((conversaId) =>
          db.leitura.upsert({
            where: { membroId_conversaId: { membroId: membro.id, conversaId } },
            create: { membroId: membro.id, conversaId, lidaEm: new Date() },
            update: { lidaEm: new Date() },
          }),
        ),
      );
      break;
    case "naoLida":
      await db.leitura.deleteMany({ where: { membroId: membro.id, conversaId: { in: permitidas } } });
      break;
    case "excluir":
      // Remove só do app; os emails continuam no Gmail.
      if (membro.papel !== "ADMIN") throw new Error("Apenas administradores");
      await db.conversa.deleteMany({ where });
      break;
  }
  revalidatePath("/", "layout");
}

// ---------- Envio ----------

export type EstadoEnvio = { erro?: string; ok?: number };

function lerEnderecos(valor: string): string[] {
  const lista = separarLista(valor);
  const invalido = lista.find((e) => !emailValido(emailDe(e)));
  if (invalido) throw new Error(`Endereço inválido: ${invalido}`);
  return lista;
}

async function lerAnexos(form: FormData): Promise<AnexoEnvio[]> {
  const arquivos = form.getAll("anexos").filter((a): a is File => a instanceof File && a.size > 0);
  const total = arquivos.reduce((s, a) => s + a.size, 0);
  if (total > 24 * 1024 * 1024) throw new Error("Os anexos passam de 24 MB, o limite do Gmail");
  return Promise.all(
    arquivos.map(async (a) => ({ nome: a.name, tipo: a.type || "application/octet-stream", dados: Buffer.from(await a.arrayBuffer()) })),
  );
}

export async function enviar(_anterior: EstadoEnvio, form: FormData): Promise<EstadoEnvio> {
  const membro = await exigirMembro();
  const conversaId = texto(form, "conversaId") || undefined;
  let destino: string;
  try {
    destino = await enviarEmail({
      membro,
      conversaId,
      caixaId: texto(form, "caixaId"),
      para: lerEnderecos(texto(form, "para")),
      cc: lerEnderecos(texto(form, "cc")),
      assunto: texto(form, "assunto") || "(sem assunto)",
      texto: String(form.get("texto") ?? ""),
      anexos: await lerAnexos(form),
      citarAnterior: form.get("citar") === "on",
    });
    if (form.get("depois") === "resolver") {
      await db.conversa.update({ where: { id: destino }, data: { status: "RESOLVIDA" } });
    }
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Falha ao enviar" };
  }
  revalidatePath("/", "layout");
  if (!conversaId) redirect(`/conversa/${destino}`);
  return { ok: Date.now() };
}

// ---------- Sincronização ----------

export async function sincronizarAgora() {
  const membro = await exigirMembro();
  await sincronizarTodas(membro.workspaceId);
  revalidatePath("/", "layout");
}

// ---------- Configurações ----------

const MODOS = ["CAIXA_UNICA", "CONTAS_CONECTADAS"] as const satisfies readonly Modo[];
const RESPOSTAS = ["QUEM_RESPONDEU", "QUEM_RECEBEU", "SO_DESTINATARIO"] as const satisfies readonly RespostaPor[];
const PAPEIS = ["ADMIN", "MEMBRO"] as const satisfies readonly Papel[];
const TIPOS_FILTRO = ["CATEGORIA_GMAIL", "NEWSLETTER", "REMETENTE", "DOMINIO", "ASSUNTO_CONTEM"] as const satisfies readonly TipoFiltro[];
const ACOES_FILTRO = ["IGNORAR", "APLICAR_TAG"] as const satisfies readonly AcaoFiltro[];

export async function salvarConfiguracoes(form: FormData) {
  const membro = await exigirAdmin();
  await db.workspace.update({
    where: { id: membro.workspaceId },
    data: {
      nome: texto(form, "nome") || membro.workspace.nome,
      modo: umDe(texto(form, "modo"), MODOS),
      respostaPor: umDe(texto(form, "respostaPor"), RESPOSTAS),
    },
  });
  revalidatePath("/", "layout");
}

export async function salvarPerfil(form: FormData) {
  const membro = await exigirMembro();
  await db.membro.update({
    where: { id: membro.id },
    data: { nome: texto(form, "nome") || membro.nome, assinatura: texto(form, "assinatura") || null },
  });
  revalidatePath("/", "layout");
}

export async function alterarPapel(form: FormData) {
  const admin = await exigirAdmin();
  const alvoId = texto(form, "membroId");
  const papel = umDe(texto(form, "papel"), PAPEIS);
  if (alvoId === admin.id && papel !== "ADMIN") {
    const admins = await db.membro.count({ where: { workspaceId: admin.workspaceId, papel: "ADMIN" } });
    if (admins <= 1) throw new Error("O workspace precisa de pelo menos um administrador");
  }
  await db.membro.updateMany({ where: { id: alvoId, workspaceId: admin.workspaceId }, data: { papel } });
  revalidatePath("/config");
}

export async function desconectarCaixa(form: FormData) {
  const membro = await exigirMembro();
  const caixa = await db.caixa.findFirst({ where: { id: texto(form, "caixaId"), workspaceId: membro.workspaceId } });
  if (!caixa) return;
  if (membro.papel !== "ADMIN" && caixa.membroId !== membro.id) throw new Error("Sem permissão");
  // As mensagens já sincronizadas continuam no app; só o acesso ao Gmail é removido.
  await db.caixa.delete({ where: { id: caixa.id } });
  revalidatePath("/", "layout");
}

export async function criarTag(form: FormData) {
  const membro = await exigirMembro();
  const nome = texto(form, "nome");
  if (!nome) return;
  await db.tag.upsert({
    where: { workspaceId_nome: { workspaceId: membro.workspaceId, nome } },
    create: { workspaceId: membro.workspaceId, nome, cor: texto(form, "cor") || "#5b6cf0" },
    update: { cor: texto(form, "cor") || undefined },
  });
  revalidatePath("/", "layout");
}

export async function excluirTag(form: FormData) {
  const membro = await exigirAdmin();
  await db.tag.deleteMany({ where: { id: texto(form, "tagId"), workspaceId: membro.workspaceId } });
  revalidatePath("/", "layout");
}

export async function criarFiltro(form: FormData) {
  const membro = await exigirAdmin();
  const tipo = umDe(texto(form, "tipo"), TIPOS_FILTRO);
  const acao = umDe(texto(form, "acao"), ACOES_FILTRO);
  const valor = texto(form, "valor");
  if (tipo !== "NEWSLETTER" && !valor) throw new Error("Informe o valor do filtro");
  let tagId: string | null = null;
  if (acao === "APLICAR_TAG") {
    const tag = await db.tag.findFirst({ where: { id: texto(form, "tagId"), workspaceId: membro.workspaceId } });
    if (!tag) throw new Error("Escolha a tag a aplicar");
    tagId = tag.id;
  }
  await db.filtro.create({ data: { workspaceId: membro.workspaceId, tipo, valor, acao, tagId } });
  revalidatePath("/config");
}

export async function excluirFiltro(form: FormData) {
  const membro = await exigirAdmin();
  await db.filtro.deleteMany({ where: { id: texto(form, "filtroId"), workspaceId: membro.workspaceId } });
  revalidatePath("/config");
}
