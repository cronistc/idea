import { describe, expect, it } from "vitest";
import { destinatariosResposta } from "@/lib/envio";

const nossos = new Set(["joao@empresa.com", "contato@empresa.com"]);

describe("destinatariosResposta", () => {
  it("responde ao remetente externo", () => {
    const ultima = { de: "Cliente <c@x.com>", para: ["joao@empresa.com", "d@x.com"], cc: ["contato@empresa.com", "e@x.com"] };
    expect(destinatariosResposta(ultima, nossos, false)).toEqual({ para: ["Cliente <c@x.com>"], cc: [] });
    expect(destinatariosResposta(ultima, nossos, true)).toEqual({ para: ["Cliente <c@x.com>"], cc: ["d@x.com", "e@x.com"] });
  });

  it("se a última foi nossa, responde para quem a recebeu", () => {
    const ultima = { de: "joao@empresa.com", para: ["c@x.com"], cc: ["d@x.com"] };
    expect(destinatariosResposta(ultima, nossos, false)).toEqual({ para: ["c@x.com"], cc: [] });
    expect(destinatariosResposta(ultima, nossos, true)).toEqual({ para: ["c@x.com"], cc: ["d@x.com"] });
  });
});
