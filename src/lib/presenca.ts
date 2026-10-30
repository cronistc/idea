// Quem está com a conversa aberta ou digitando, guardado em memória (um processo só).
type Presenca = { nome: string; digitando: boolean; ate: number };

const estado = globalThis as unknown as { presencas?: Map<string, Map<string, Presenca>> };
const presencas = (estado.presencas ??= new Map());

const VALIDADE_MS = 15_000;

export function registrarPresenca(conversaId: string, membroId: string, nome: string, digitando: boolean) {
  let sala = presencas.get(conversaId);
  if (!sala) presencas.set(conversaId, (sala = new Map()));
  sala.set(membroId, { nome, digitando, ate: Date.now() + VALIDADE_MS });
}

export function sairDaConversa(conversaId: string, membroId: string) {
  presencas.get(conversaId)?.delete(membroId);
}

export function quemEsta(conversaId: string, exceto: string) {
  const sala = presencas.get(conversaId);
  if (!sala) return [];
  const agora = Date.now();
  const lista: { nome: string; digitando: boolean }[] = [];
  for (const [id, p] of sala) {
    if (p.ate < agora) sala.delete(id);
    else if (id !== exceto) lista.push({ nome: p.nome, digitando: p.digitando });
  }
  return lista;
}
