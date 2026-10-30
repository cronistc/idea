import type { MensagemGmail, ParteGmail } from "./gmail";
import { separarLista } from "./enderecos";

export type AnexoInfo = { nome: string; tipo: string; tamanho: number; gmailAnexoId: string };

export type MensagemLida = {
  messageIdRfc: string;
  referencias: string[];
  assunto: string;
  de: string;
  para: string[];
  cc: string[];
  trecho: string;
  corpoTexto: string | null;
  corpoHtml: string | null;
  anexos: AnexoInfo[];
  enviadaEm: Date;
  ehLista: boolean; // newsletter / lista de emails
  labels: string[];
};

/** Decodifica palavras RFC 2047 (=?charset?B|Q?...?=) caso o cabeçalho venha codificado. */
export function decodificarCabecalho(valor: string): string {
  return valor
    .replace(/\?=\s+=\?/g, "?==?")
    .replace(/=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g, (_, charset: string, tipo: string, texto: string) => {
      const bytes =
        tipo.toUpperCase() === "B"
          ? Buffer.from(texto, "base64")
          : Buffer.from(
              texto.replace(/_/g, " ").replace(/=([0-9a-fA-F]{2})/g, (_m, h: string) => String.fromCharCode(parseInt(h, 16))),
              "latin1",
            );
      return decodificarBytes(bytes, charset);
    });
}

function decodificarBytes(bytes: Buffer, charset = "utf-8"): string {
  try {
    return new TextDecoder(charset.toLowerCase()).decode(bytes);
  } catch {
    return bytes.toString("utf8");
  }
}

function cabecalhos(parte?: ParteGmail): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const h of parte?.headers ?? []) {
    const nome = h.name.toLowerCase();
    if (!mapa.has(nome)) mapa.set(nome, h.value);
  }
  return mapa;
}

function charsetDe(parte: ParteGmail): string | undefined {
  const tipo = cabecalhos(parte).get("content-type");
  return tipo?.match(/charset="?([^";\s]+)"?/i)?.[1];
}

function ehAnexo(parte: ParteGmail): boolean {
  return Boolean(parte.filename && parte.body?.attachmentId);
}

function percorrer(parte: ParteGmail | undefined, visitar: (p: ParteGmail) => void) {
  if (!parte) return;
  visitar(parte);
  for (const filha of parte.parts ?? []) percorrer(filha, visitar);
}

export function extrairIds(texto: string | undefined): string[] {
  return texto?.match(/<[^<>\s]+>/g) ?? [];
}

const ENTIDADES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " };

export function decodificarEntidades(texto: string): string {
  return texto
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, e: string) => ENTIDADES[e])
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)));
}

export function lerMensagemGmail(g: MensagemGmail): MensagemLida {
  const cab = cabecalhos(g.payload);
  const h = (nome: string) => decodificarCabecalho(cab.get(nome) ?? "");

  let corpoTexto: string | null = null;
  let corpoHtml: string | null = null;
  const anexos: AnexoInfo[] = [];

  percorrer(g.payload, (p) => {
    if (ehAnexo(p)) {
      anexos.push({
        nome: decodificarCabecalho(p.filename!),
        tipo: p.mimeType ?? "application/octet-stream",
        tamanho: p.body?.size ?? 0,
        gmailAnexoId: p.body!.attachmentId!,
      });
      return;
    }
    const dados = p.body?.data;
    if (!dados) return;
    if (p.mimeType === "text/plain" && corpoTexto === null) {
      corpoTexto = decodificarBytes(Buffer.from(dados, "base64url"), charsetDe(p));
    } else if (p.mimeType === "text/html" && corpoHtml === null) {
      corpoHtml = decodificarBytes(Buffer.from(dados, "base64url"), charsetDe(p));
    }
  });

  const inReplyTo = extrairIds(cab.get("in-reply-to"));
  const references = extrairIds(cab.get("references"));

  return {
    messageIdRfc: extrairIds(cab.get("message-id"))[0] ?? `<gmail-${g.id}@sem-message-id>`,
    referencias: [...new Set([...references, ...inReplyTo])],
    assunto: h("subject") || "(sem assunto)",
    de: h("from"),
    para: separarLista(h("to")),
    cc: separarLista(h("cc")),
    trecho: decodificarEntidades(g.snippet ?? "").slice(0, 300),
    corpoTexto,
    corpoHtml,
    anexos,
    enviadaEm: new Date(Number(g.internalDate ?? Date.now())),
    ehLista: cab.has("list-unsubscribe") || cab.has("list-id"),
    labels: g.labelIds ?? [],
  };
}
