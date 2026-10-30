import { OAuth2Client } from "google-auth-library";
import { env } from "./env";

export type Proposito = "login" | "caixa";

const ESCOPOS_LOGIN = ["openid", "email", "profile"];

// Ler e enviar emails. gmail.readonly basta para sincronizar; gmail.send para responder.
const ESCOPOS_CAIXA = [
  ...ESCOPOS_LOGIN,
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
];

export function clienteOAuth() {
  return new OAuth2Client({
    clientId: env.googleClientId,
    clientSecret: env.googleClientSecret,
    redirectUri: `${env.appUrl}/api/auth/callback`,
  });
}

export function urlDeAutorizacao(proposito: Proposito, state: string) {
  const caixa = proposito === "caixa";
  return clienteOAuth().generateAuthUrl({
    scope: caixa ? ESCOPOS_CAIXA : ESCOPOS_LOGIN,
    state,
    hd: env.dominioPermitido,
    // Para conectar uma caixa precisamos de um refresh token, que o Google
    // só devolve com access_type=offline e prompt=consent.
    access_type: caixa ? "offline" : "online",
    prompt: caixa ? "consent" : "select_account",
  });
}

/** Troca o código pelo token e confere que a conta é do domínio da empresa. */
export async function trocarCodigo(code: string) {
  const cliente = clienteOAuth();
  const { tokens } = await cliente.getToken(code);
  if (!tokens.id_token) throw new Error("Google não retornou id_token");

  const ticket = await cliente.verifyIdToken({ idToken: tokens.id_token, audience: env.googleClientId });
  const p = ticket.getPayload();
  if (!p?.email || !p.email_verified) throw new Error("Email não verificado");
  if (p.hd?.toLowerCase() !== env.dominioPermitido) {
    throw new Error(`Só contas @${env.dominioPermitido} podem entrar`);
  }

  return {
    email: p.email.toLowerCase(),
    nome: p.name ?? p.email,
    refreshToken: tokens.refresh_token ?? null,
  };
}
