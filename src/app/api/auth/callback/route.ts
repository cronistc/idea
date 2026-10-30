import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { cifrar } from "@/lib/cripto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { trocarCodigo } from "@/lib/google";
import { iniciarSessao, membroAtual } from "@/lib/sessao";
import { sincronizarCaixa } from "@/lib/sincronizacao";

export async function GET(req: NextRequest) {
  const voltar = (erro?: string) =>
    NextResponse.redirect(new URL(erro ? `/?erro=${encodeURIComponent(erro)}` : "/", req.url));

  const jar = await cookies();
  const stateEsperado = jar.get("oauth_state")?.value;
  jar.delete("oauth_state");

  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  if (searchParams.get("error")) return voltar("Autorização cancelada");
  if (!code || !state || state !== stateEsperado) return voltar("Requisição inválida, tente de novo");

  let conta;
  try {
    conta = await trocarCodigo(code);
  } catch (e) {
    return voltar(e instanceof Error ? e.message : "Falha ao falar com o Google");
  }

  if (state.endsWith(".login")) {
    await iniciarSessao(await entrar(conta.email, conta.nome));
    return NextResponse.redirect(new URL("/caixa", req.url));
  }

  // Conectar caixa
  const membro = await membroAtual();
  if (!membro) return voltar("Faça login primeiro");

  const ehPropria = conta.email === membro.email;
  if (membro.papel !== "ADMIN") {
    if (membro.workspace.modo === "CAIXA_UNICA") return voltar("Só o administrador conecta a caixa compartilhada");
    if (!ehPropria) return voltar("Você só pode conectar o seu próprio email");
  }
  if (!conta.refreshToken) return voltar("O Google não devolveu acesso permanente, tente de novo");

  const dados = {
    workspaceId: membro.workspaceId,
    membroId: ehPropria ? membro.id : null,
    refreshTokenCifrado: cifrar(conta.refreshToken),
    historyId: null,
  };
  const caixa = await db.caixa.upsert({
    where: { endereco: conta.email },
    create: { endereco: conta.email, ...dados },
    update: dados,
  });
  void sincronizarCaixa(caixa.id); // primeira carga em segundo plano
  return voltar();
}

/** Encontra ou cria o membro. O primeiro a entrar cria o workspace e vira admin. */
async function entrar(email: string, nome: string): Promise<string> {
  const existente = await db.membro.findUnique({ where: { email } });
  if (existente) return existente.id;

  return db.$transaction(async (tx) => {
    let workspace = await tx.workspace.findFirst({ orderBy: { criadoEm: "asc" } });
    const primeiro = !workspace;
    workspace ??= await tx.workspace.create({
      data: {
        nome: env.dominioPermitido,
        // Começa ignorando publicidade, redes sociais e newsletters.
        filtros: {
          create: [
            { tipo: "CATEGORIA_GMAIL", valor: "CATEGORY_PROMOTIONS" },
            { tipo: "CATEGORIA_GMAIL", valor: "CATEGORY_SOCIAL" },
            { tipo: "NEWSLETTER", valor: "" },
          ],
        },
        tags: {
          create: [
            { nome: "Financeiro", cor: "#16a34a" },
            { nome: "Urgente", cor: "#dc2626" },
            { nome: "Suporte", cor: "#2563eb" },
          ],
        },
      },
    });
    const membro = await tx.membro.create({
      data: { email, nome, workspaceId: workspace.id, papel: primeiro ? "ADMIN" : "MEMBRO" },
    });
    return membro.id;
  });
}
