const FUSO = process.env.FUSO ?? "America/Sao_Paulo";

function partes(d: Date) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** "14:32" se for hoje, "12 de out." se for este ano, senão "12/10/2025". */
export function quando(d: Date, agora = new Date()): string {
  if (partes(d) === partes(agora)) {
    return d.toLocaleTimeString("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" });
  }
  const ano = (x: Date) => x.toLocaleDateString("pt-BR", { timeZone: FUSO, year: "numeric" });
  if (ano(d) === ano(agora)) return d.toLocaleDateString("pt-BR", { timeZone: FUSO, day: "numeric", month: "short" });
  return d.toLocaleDateString("pt-BR", { timeZone: FUSO });
}

export function dataCompleta(d: Date): string {
  return d.toLocaleString("pt-BR", { timeZone: FUSO, dateStyle: "medium", timeStyle: "short" });
}

export function tamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function iniciais(nome: string): string {
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "?") + (p.length > 1 ? p.at(-1)![0] : "")).toUpperCase();
}

const CORES = ["#5b6cf0", "#0e9f6e", "#d97706", "#db2777", "#0891b2", "#7c3aed", "#65a30d", "#dc2626"];

export function corDoNome(nome: string): string {
  let h = 0;
  for (const c of nome) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return CORES[h % CORES.length];
}
