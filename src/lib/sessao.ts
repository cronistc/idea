import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "./db";
import { env } from "./env";

const COOKIE = "sessao";
const DURACAO_SEGUNDOS = 60 * 60 * 24 * 30;

function segredo() {
  return new TextEncoder().encode(env.sessionSecret);
}

export async function iniciarSessao(membroId: string) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(membroId)
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_SEGUNDOS}s`)
    .sign(segredo());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DURACAO_SEGUNDOS,
  });
}

export async function encerrarSessao() {
  (await cookies()).delete(COOKIE);
}

/** Membro logado, com o workspace, ou null. */
export async function membroAtual() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, segredo());
    if (!payload.sub) return null;
    return await db.membro.findUnique({ where: { id: payload.sub }, include: { workspace: true } });
  } catch {
    return null;
  }
}
