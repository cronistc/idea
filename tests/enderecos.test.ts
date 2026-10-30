import { describe, expect, it } from "vitest";
import { emailValido, formatarEndereco, lerEndereco, nomeCurto, separarLista } from "@/lib/enderecos";

describe("enderecos", () => {
  it("separa listas respeitando vírgulas dentro de aspas", () => {
    expect(separarLista('"Silva, João" <joao@x.com>, ana@x.com; Bia <bia@x.com>')).toEqual([
      '"Silva, João" <joao@x.com>',
      "ana@x.com",
      "Bia <bia@x.com>",
    ]);
    expect(separarLista("")).toEqual([]);
  });

  it("lê nome e email", () => {
    expect(lerEndereco('"Ana Lima" <Ana@X.com>')).toEqual({ nome: "Ana Lima", email: "ana@x.com" });
    expect(lerEndereco("ana@x.com")).toEqual({ nome: "", email: "ana@x.com" });
    expect(nomeCurto("contato@empresa.com")).toBe("contato");
  });

  it("formata com aspas quando o nome tem caracteres especiais", () => {
    expect(formatarEndereco({ nome: "Silva, João", email: "j@x.com" })).toBe('"Silva, João" <j@x.com>');
    expect(formatarEndereco({ nome: "Ana", email: "a@x.com" })).toBe("Ana <a@x.com>");
  });

  it("valida emails", () => {
    expect(emailValido("a@b.com")).toBe(true);
    expect(emailValido("a@b")).toBe(false);
    expect(emailValido("a b@c.com")).toBe(false);
  });
});
