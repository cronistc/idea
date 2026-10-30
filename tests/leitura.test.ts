import { describe, expect, it } from "vitest";
import { lerMensagemGmail } from "@/lib/leitura";
import type { MensagemGmail } from "@/lib/gmail";

const b64 = (s: string, enc: BufferEncoding = "utf8") => Buffer.from(s, enc).toString("base64url");

describe("lerMensagemGmail", () => {
  it("extrai cabeçalhos, corpos, anexos e referências", () => {
    const g: MensagemGmail = {
      id: "m1",
      threadId: "t1",
      labelIds: ["INBOX", "CATEGORY_PROMOTIONS"],
      snippet: "Ol&aacute; &amp; bem-vindo &#39;x&#39;",
      internalDate: "1761820000000",
      payload: {
        mimeType: "multipart/mixed",
        headers: [
          { name: "From", value: "Loja <loja@x.com>" },
          { name: "To", value: "a@empresa.com, \"B, C\" <b@empresa.com>" },
          { name: "Subject", value: "=?UTF-8?B?" + Buffer.from("Promoção").toString("base64") + "?=" },
          { name: "Message-ID", value: "<abc@x.com>" },
          { name: "In-Reply-To", value: "<pai@x.com>" },
          { name: "References", value: "<avo@x.com> <pai@x.com>" },
          { name: "List-Unsubscribe", value: "<mailto:sair@x.com>" },
        ],
        parts: [
          {
            mimeType: "multipart/alternative",
            parts: [
              { mimeType: "text/plain", headers: [{ name: "Content-Type", value: "text/plain; charset=iso-8859-1" }], body: { data: b64("Promoção", "latin1") } },
              { mimeType: "text/html", body: { data: b64("<p>Promoção</p>") } },
            ],
          },
          { mimeType: "application/pdf", filename: "boleto.pdf", body: { attachmentId: "ANX", size: 2048 } },
        ],
      },
    };
    const m = lerMensagemGmail(g);
    expect(m.assunto).toBe("Promoção");
    expect(m.para).toEqual(["a@empresa.com", '"B, C" <b@empresa.com>']);
    expect(m.corpoTexto).toBe("Promoção");
    expect(m.corpoHtml).toBe("<p>Promoção</p>");
    expect(m.anexos).toEqual([{ nome: "boleto.pdf", tipo: "application/pdf", tamanho: 2048, gmailAnexoId: "ANX" }]);
    expect(m.referencias).toEqual(["<avo@x.com>", "<pai@x.com>"]);
    expect(m.ehLista).toBe(true);
    expect(m.trecho).toBe("Ol&aacute; & bem-vindo 'x'");
    expect(m.enviadaEm.getTime()).toBe(1761820000000);
  });

  it("gera Message-ID estável quando falta", () => {
    expect(lerMensagemGmail({ id: "z9", threadId: "t", payload: { headers: [] } }).messageIdRfc).toBe("<gmail-z9@sem-message-id>");
  });
});
