import { randomBytes } from "node:crypto";

export type AnexoEnvio = { nome: string; tipo: string; dados: Buffer };

export type MensagemEnvio = {
  de: string;
  para: string[];
  cc: string[];
  assunto: string;
  texto: string;
  html: string;
  inReplyTo?: string;
  references?: string[];
  anexos?: AnexoEnvio[];
};

/** Codifica cabeçalho com acentos no formato RFC 2047 (=?UTF-8?B?...?=). */
export function codificarCabecalho(valor: string): string {
  return /^[\x20-\x7e]*$/.test(valor) ? valor : `=?UTF-8?B?${Buffer.from(valor, "utf8").toString("base64")}?=`;
}

/** Codifica só a parte do nome em "Nome <email>". */
function codificarEndereco(endereco: string): string {
  const m = endereco.match(/^\s*"?(.*?)"?\s*<([^>]+)>\s*$/);
  if (!m || !m[1]) return endereco;
  const nome = /^[\x20-\x7e]*$/.test(m[1]) ? `"${m[1]}"` : codificarCabecalho(m[1]);
  return `${nome} <${m[2]}>`;
}

function base64EmLinhas(dados: Buffer): string {
  return dados.toString("base64").replace(/.{1,76}/g, "$&\r\n");
}

function fronteira() {
  return `----=_Parte_${randomBytes(12).toString("hex")}`;
}

export function novoMessageId(dominio: string): string {
  return `<${Date.now().toString(36)}.${randomBytes(10).toString("hex")}@${dominio}>`;
}

/** Monta a mensagem RFC 2822 pronta para a API do Gmail. */
export function montarMensagem(m: MensagemEnvio, messageId: string): string {
  const cab: string[] = [
    `From: ${codificarEndereco(m.de)}`,
    `To: ${m.para.map(codificarEndereco).join(", ")}`,
  ];
  if (m.cc.length) cab.push(`Cc: ${m.cc.map(codificarEndereco).join(", ")}`);
  cab.push(`Subject: ${codificarCabecalho(m.assunto)}`, `Message-ID: ${messageId}`, `Date: ${new Date().toUTCString()}`);
  if (m.inReplyTo) cab.push(`In-Reply-To: ${m.inReplyTo}`);
  if (m.references?.length) cab.push(`References: ${m.references.join(" ")}`);
  cab.push("MIME-Version: 1.0");

  const fAlt = fronteira();
  const alternativa = [
    `Content-Type: multipart/alternative; boundary="${fAlt}"`,
    "",
    `--${fAlt}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64EmLinhas(Buffer.from(m.texto, "utf8")),
    `--${fAlt}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64EmLinhas(Buffer.from(m.html, "utf8")),
    `--${fAlt}--`,
  ].join("\r\n");

  if (!m.anexos?.length) return [...cab, alternativa].join("\r\n");

  const fMix = fronteira();
  const partes = [`Content-Type: multipart/mixed; boundary="${fMix}"`, "", `--${fMix}`, alternativa];
  for (const a of m.anexos) {
    const nome = codificarCabecalho(a.nome).replace(/"/g, "");
    partes.push(
      `--${fMix}`,
      `Content-Type: ${a.tipo || "application/octet-stream"}; name="${nome}"`,
      `Content-Disposition: attachment; filename="${nome}"`,
      "Content-Transfer-Encoding: base64",
      "",
      base64EmLinhas(a.dados),
    );
  }
  partes.push(`--${fMix}--`);
  return [...cab, partes.join("\r\n")].join("\r\n");
}

export function escaparHtml(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Converte o texto digitado no app em HTML simples, preservando quebras de linha. */
export function textoParaHtml(texto: string): string {
  const corpo = escaparHtml(texto)
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')
    .replace(/\n/g, "<br>");
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px">${corpo}</div>`;
}
