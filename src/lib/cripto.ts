import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "./env";

// Os refresh tokens dão acesso ao Gmail, então ficam cifrados no banco (AES-256-GCM).
function chave(): Buffer {
  const k = Buffer.from(env.tokenKey, "base64");
  if (k.length !== 32) throw new Error("TOKEN_KEY deve ter 32 bytes em base64 (openssl rand -base64 32)");
  return k;
}

export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", chave(), iv);
  const dados = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), dados].map((b) => b.toString("base64")).join(".");
}

export function decifrar(cifrado: string): string {
  const [iv, tag, dados] = cifrado.split(".").map((p) => Buffer.from(p, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", chave(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(dados), decipher.final()]).toString("utf8");
}
