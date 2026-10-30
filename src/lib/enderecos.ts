export type Endereco = { nome: string; email: string };

/** Separa uma lista "Ana <ana@x.com>, "Silva, João" <joao@x.com>" respeitando aspas. */
export function separarLista(lista: string | null | undefined): string[] {
  if (!lista) return [];
  const partes: string[] = [];
  let atual = "";
  let aspas = false;
  let angulo = false;
  for (const c of lista) {
    if (c === '"') aspas = !aspas;
    else if (c === "<" && !aspas) angulo = true;
    else if (c === ">" && !aspas) angulo = false;
    if ((c === "," || c === ";") && !aspas && !angulo) {
      if (atual.trim()) partes.push(atual.trim());
      atual = "";
    } else {
      atual += c;
    }
  }
  if (atual.trim()) partes.push(atual.trim());
  return partes;
}

export function lerEndereco(texto: string): Endereco {
  const m = texto.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { nome: m[1].trim(), email: m[2].trim().toLowerCase() };
  const email = texto.trim().replace(/^<|>$/g, "").toLowerCase();
  return { nome: "", email };
}

export function formatarEndereco({ nome, email }: Endereco): string {
  if (!nome) return email;
  return /[",;<>@()]/.test(nome) ? `"${nome.replace(/"/g, "'")}" <${email}>` : `${nome} <${email}>`;
}

/** Nome para mostrar na tela: o nome, ou a parte antes do @. */
export function nomeCurto(texto: string): string {
  const { nome, email } = lerEndereco(texto);
  return nome || email.split("@")[0];
}

export function emailDe(texto: string): string {
  return lerEndereco(texto).email;
}

export function emailValido(email: string): boolean {
  return /^[^\s@<>(),;"]+@[^\s@<>(),;"]+\.[^\s@<>(),;"]+$/.test(email);
}
