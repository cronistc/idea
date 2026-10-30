import type { Filtro } from "@prisma/client";
import { emailDe } from "./enderecos";
import type { MensagemLida } from "./leitura";

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function filtroCasa(filtro: Pick<Filtro, "tipo" | "valor">, m: MensagemLida): boolean {
  const valor = filtro.valor.trim().toLowerCase();
  const remetente = emailDe(m.de);
  switch (filtro.tipo) {
    case "CATEGORIA_GMAIL":
      return m.labels.includes(filtro.valor.trim().toUpperCase());
    case "NEWSLETTER":
      return m.ehLista;
    case "REMETENTE":
      return remetente === valor;
    case "DOMINIO": {
      const dominio = remetente.split("@")[1] ?? "";
      const alvo = valor.replace(/^@/, "");
      return dominio === alvo || dominio.endsWith(`.${alvo}`);
    }
    case "ASSUNTO_CONTEM":
      return valor !== "" && semAcento(m.assunto).includes(semAcento(valor));
  }
}

/** Decide o que fazer com um email novo: ignorar, ou quais tags aplicar. */
export function avaliarFiltros(filtros: Filtro[], m: MensagemLida): { ignorar: boolean; tagIds: string[] } {
  const tagIds = new Set<string>();
  for (const f of filtros) {
    if (!filtroCasa(f, m)) continue;
    if (f.acao === "IGNORAR") return { ignorar: true, tagIds: [] };
    if (f.tagId) tagIds.add(f.tagId);
  }
  return { ignorar: false, tagIds: [...tagIds] };
}
