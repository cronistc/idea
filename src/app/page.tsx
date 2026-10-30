import { redirect } from "next/navigation";
import { membroAtual } from "@/lib/sessao";

export default async function Entrada({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  if (!erro && (await membroAtual())) redirect("/caixa");

  return (
    <main className="login">
      <div className="login-cartao">
        <div className="marca grande"><span className="marca-icone">✉</span> Caixa Compartilhada</div>
        <p className="suave">O email da equipe num só lugar.</p>
        <ul className="login-recursos">
          <li>📥 Todos veem os mesmos emails, sem duplicar</li>
          <li>🏷️ Tags, status e responsável compartilhados</li>
          <li>💬 Comentários internos que o cliente não vê</li>
          <li>✍️ Aviso quando alguém já está respondendo</li>
        </ul>
        {erro && <p className="erro">{erro}</p>}
        <a className="botao largo" href="/api/auth/google?para=login">Entrar com Google</a>
        <p className="suave pequeno">Use a conta Google da empresa.</p>
      </div>
    </main>
  );
}
