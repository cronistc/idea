import { db } from "@/lib/db";
import { membroAtual } from "@/lib/sessao";
import { salvarConfiguracoes } from "./acoes";

const NOME_MODO = {
  CAIXA_UNICA: "Caixa única com atendentes internos",
  CONTAS_CONECTADAS: "Várias contas que dividem uma caixa",
};

const NOME_RESPOSTA = {
  QUEM_RESPONDEU: "Do endereço de quem respondeu",
  QUEM_RECEBEU: "Do endereço que recebeu o email",
  SO_DESTINATARIO: "Só quem recebeu pode responder",
};

export default async function Inicio({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const membro = await membroAtual();

  if (!membro) {
    return (
      <main>
        <h1>Caixa Compartilhada</h1>
        <p className="suave">O email da equipe num só lugar.</p>
        {erro && <p className="erro">{erro}</p>}
        <a className="botao" href="/api/auth/google?para=login">Entrar com Google</a>
      </main>
    );
  }

  const { workspace } = membro;
  const admin = membro.papel === "ADMIN";
  const [caixas, membros] = await Promise.all([
    db.caixa.findMany({ where: { workspaceId: workspace.id }, include: { membro: true }, orderBy: { conectadaEm: "asc" } }),
    db.membro.findMany({ where: { workspaceId: workspace.id }, orderBy: { criadoEm: "asc" } }),
  ]);

  const temCaixaPropria = caixas.some((c) => c.membroId === membro.id);
  const podeConectar = admin || (workspace.modo === "CONTAS_CONECTADAS" && !temCaixaPropria);

  return (
    <main>
      <div className="topo">
        <div>
          <h1>{workspace.nome}</h1>
          <span className="suave">{membro.nome} · {admin ? "Administrador" : "Membro"}</span>
        </div>
        <form action="/api/auth/sair" method="post">
          <button className="botao secundario">Sair</button>
        </form>
      </div>
      {erro && <p className="erro">{erro}</p>}

      <section className="cartao">
        <h2>Caixas conectadas</h2>
        {caixas.length === 0 ? (
          <p className="suave">Nenhuma caixa conectada ainda.</p>
        ) : (
          <ul className="lista">
            {caixas.map((c) => (
              <li key={c.id}>
                <span>{c.endereco}</span>
                <span className="suave">{c.membro ? c.membro.nome : "Compartilhada"}</span>
              </li>
            ))}
          </ul>
        )}
        {podeConectar && (
          <a className="botao" href="/api/auth/google?para=caixa">Conectar caixa Gmail</a>
        )}
      </section>

      <section className="cartao">
        <h2>Equipe</h2>
        <ul className="lista">
          {membros.map((m) => (
            <li key={m.id}>
              <span>{m.nome}</span>
              <span className="suave">{m.email}</span>
            </li>
          ))}
        </ul>
        <p className="suave">Novos membros entram com a conta Google da empresa.</p>
      </section>

      {admin && (
        <section className="cartao">
          <h2>Configurações</h2>
          <form action={salvarConfiguracoes}>
            <label>
              Modo
              <select name="modo" defaultValue={workspace.modo}>
                {Object.entries(NOME_MODO).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
              </select>
            </label>
            <label>
              Resposta sai
              <select name="respostaPor" defaultValue={workspace.respostaPor}>
                {Object.entries(NOME_RESPOSTA).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
              </select>
            </label>
            <button className="botao">Salvar</button>
          </form>
        </section>
      )}
    </main>
  );
}
