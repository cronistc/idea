import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { urlDeAutorizacao, type Proposito } from "@/lib/google";
import { membroAtual } from "@/lib/sessao";

// GET /api/auth/google?para=login  → entrar no app
// GET /api/auth/google?para=caixa  → conectar uma caixa Gmail ao workspace
export async function GET(req: NextRequest) {
  const proposito: Proposito = req.nextUrl.searchParams.get("para") === "caixa" ? "caixa" : "login";

  if (proposito === "caixa" && !(await membroAtual())) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Protege contra CSRF: o callback só aceita o state que nós mesmos geramos.
  const state = `${randomBytes(16).toString("hex")}.${proposito}`;
  (await cookies()).set("oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(urlDeAutorizacao(proposito, state));
}
