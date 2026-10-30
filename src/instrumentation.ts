// Roda uma vez quando o servidor sobe: agenda a sincronização periódica do Gmail.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const segundos = Number(process.env.SINCRONIZAR_A_CADA_SEGUNDOS ?? 60);
  if (!segundos) return;
  const { sincronizarTodas } = await import("./lib/sincronizacao");
  const rodar = () =>
    sincronizarTodas()
      .then((rs) => rs.filter((r) => r.erro).forEach((r) => console.error(`[sincronização] ${r.caixa}: ${r.erro}`)))
      .catch((e) => console.error("[sincronização]", e));
  setTimeout(rodar, 5_000);
  setInterval(rodar, segundos * 1000);
}
