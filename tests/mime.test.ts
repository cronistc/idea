import { describe, expect, it } from "vitest";
import { codificarCabecalho, montarMensagem, textoParaHtml } from "@/lib/mime";
import { decodificarCabecalho } from "@/lib/leitura";

describe("mime", () => {
  it("codifica e decodifica cabeçalhos com acento", () => {
    const c = codificarCabecalho("Orçamento – revisão");
    expect(c).toMatch(/^=\?UTF-8\?B\?/);
    expect(decodificarCabecalho(c)).toBe("Orçamento – revisão");
    expect(codificarCabecalho("Hello")).toBe("Hello");
  });

  it("decodifica Q-encoding em latin1", () => {
    expect(decodificarCabecalho("=?ISO-8859-1?Q?Reuni=E3o_amanh=E3?=")).toBe("Reunião amanhã");
  });

  it("monta resposta com cabeçalhos de conversa e anexo", () => {
    const raw = montarMensagem(
      {
        de: "Equipe Ação <contato@empresa.com>",
        para: ["cliente@x.com"],
        cc: [],
        assunto: "Re: Pedido",
        texto: "Olá",
        html: "<p>Olá</p>",
        inReplyTo: "<a@x>",
        references: ["<0@x>", "<a@x>"],
        anexos: [{ nome: "nota.pdf", tipo: "application/pdf", dados: Buffer.from("PDF") }],
      },
      "<id@empresa.com>",
    );
    expect(raw).toContain("From: =?UTF-8?B?");
    expect(raw).toContain("In-Reply-To: <a@x>");
    expect(raw).toContain("References: <0@x> <a@x>");
    expect(raw).toContain("Message-ID: <id@empresa.com>");
    expect(raw).toContain("multipart/mixed");
    expect(raw).toContain('filename="nota.pdf"');
    expect(raw).toContain(Buffer.from("Olá").toString("base64"));
  });

  it("converte texto em HTML escapando e criando links", () => {
    expect(textoParaHtml("<b>oi</b>\nhttps://x.com")).toContain('&lt;b&gt;oi&lt;/b&gt;<br><a href="https://x.com">https://x.com</a>');
  });
});
