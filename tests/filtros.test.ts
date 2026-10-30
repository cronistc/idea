import { describe, expect, it } from "vitest";
import type { Filtro } from "@prisma/client";
import { avaliarFiltros } from "@/lib/filtros";
import type { MensagemLida } from "@/lib/leitura";

const msg = (p: Partial<MensagemLida>): MensagemLida => ({
  messageIdRfc: "<x>", referencias: [], assunto: "Olá", de: "Fulano <f@cliente.com.br>", para: [], cc: [], trecho: "",
  corpoTexto: null, corpoHtml: null, anexos: [], enviadaEm: new Date(), ehLista: false, labels: ["INBOX"], ...p,
});
const filtro = (p: Partial<Filtro>): Filtro => ({ id: "f", workspaceId: "w", tipo: "DOMINIO", valor: "", acao: "IGNORAR", tagId: null, ...p });

describe("avaliarFiltros", () => {
  it("ignora promoções e newsletters", () => {
    const fs = [filtro({ tipo: "CATEGORIA_GMAIL", valor: "CATEGORY_PROMOTIONS" }), filtro({ tipo: "NEWSLETTER" })];
    expect(avaliarFiltros(fs, msg({ labels: ["CATEGORY_PROMOTIONS"] })).ignorar).toBe(true);
    expect(avaliarFiltros(fs, msg({ ehLista: true })).ignorar).toBe(true);
    expect(avaliarFiltros(fs, msg({})).ignorar).toBe(false);
  });

  it("casa domínio e subdomínio, mas não domínio parecido", () => {
    const fs = [filtro({ tipo: "DOMINIO", valor: "@cliente.com.br" })];
    expect(avaliarFiltros(fs, msg({ de: "a@cliente.com.br" })).ignorar).toBe(true);
    expect(avaliarFiltros(fs, msg({ de: "a@mail.cliente.com.br" })).ignorar).toBe(true);
    expect(avaliarFiltros(fs, msg({ de: "a@outrocliente.com.br" })).ignorar).toBe(false);
  });

  it("aplica tags pelo assunto ignorando acentos", () => {
    const fs = [filtro({ tipo: "ASSUNTO_CONTEM", valor: "boleto", acao: "APLICAR_TAG", tagId: "fin" })];
    expect(avaliarFiltros(fs, msg({ assunto: "Segunda via do BOLETO" }))).toEqual({ ignorar: false, tagIds: ["fin"] });
    const fs2 = [filtro({ tipo: "ASSUNTO_CONTEM", valor: "reuniao", acao: "APLICAR_TAG", tagId: "r" })];
    expect(avaliarFiltros(fs2, msg({ assunto: "Reunião amanhã" })).tagIds).toEqual(["r"]);
  });
});
