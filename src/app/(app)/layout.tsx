import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { sincronizarAgora } from "@/app/acoes";
import { Atalhos } from "@/components/Atalhos";
import { Avatar } from "@/components/Avatar";
import { BotaoEnviando } from "@/components/BotaoEnviando";
import { NavLink } from "@/components/NavLink";
import { contagens, VISOES, type Visao } from "@/lib/consultas";
import { db } from "@/lib/db";
import { membroAtual } from "@/lib/sessao";

const ICONES: Record<Visao, string> = {
  entrada: "📥",
  minhas: "🙋",
  semDono: "❔",
  pendentes: "⏳",
  resolvidas: "✅",
  enviadas: "📤",
  todas: "🗂️",
};

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const membro = await membroAtual();
  if (!membro) redirect("/");
  const { workspace } = membro;

  const [n, caixas, tags] = await Promise.all([
    contagens(workspace.id, membro.id),
    db.caixa.findMany({ where: { workspaceId: workspace.id }, orderBy: { endereco: "asc" }, include: { membro: { select: { nome: true } } } }),
    db.tag.findMany({ where: { workspaceId: workspace.id }, orderBy: { nome: "asc" } }),
  ]);

  return (
    <div className="app">
      <input type="checkbox" id="menu" className="menu-toggle" />
      <header className="barra">
        <label htmlFor="menu" className="icone-botao so-celular" aria-label="Abrir menu">☰</label>
        <Link href="/caixa" className="marca"><span className="marca-icone">✉</span><span className="marca-nome">{workspace.nome}</span></Link>
        <form action="/caixa" className="busca" role="search">
          <input type="hidden" name="v" value="todas" />
          <input id="busca" name="q" type="search" placeholder="Pesquisar emails  ( / )" aria-label="Pesquisar" />
        </form>
        <form action={sincronizarAgora}>
          <BotaoEnviando className="icone-botao" title="Buscar novos emails agora" pendente={<span className="girando">⟳</span>}>⟳</BotaoEnviando>
        </form>
        <Link href="/config" className="perfil" title={`${membro.nome} · Configurações`}>
          <Avatar nome={membro.nome} />
        </Link>
      </header>

      <label htmlFor="menu" className="sombra-menu" aria-hidden />
      <nav className="lateral" aria-label="Navegação">
        <Link href="/escrever" className="botao escrever">✎ Escrever</Link>
        <Suspense>
          <ul className="nav">
            {(Object.keys(VISOES) as Visao[]).map((v) => (
              <li key={v}>
                <NavLink href={v === "entrada" ? "/caixa" : `/caixa?v=${v}`}>
                  <span className="nav-icone">{ICONES[v]}</span>
                  <span className="nav-texto">{VISOES[v]}</span>
                  {n[v] ? <span className="contador">{n[v]}</span> : null}
                </NavLink>
              </li>
            ))}
          </ul>

          <h3 className="nav-titulo">Caixas</h3>
          <ul className="nav">
            {caixas.map((c) => (
              <li key={c.id}>
                <NavLink href={`/caixa?v=todas&caixa=${c.id}`}>
                  <span className="nav-icone">{c.erroSincronizacao ? "⚠️" : c.membro ? "👤" : "👥"}</span>
                  <span className="nav-texto" title={c.erroSincronizacao ?? c.endereco}>{c.endereco}</span>
                </NavLink>
              </li>
            ))}
            {caixas.length === 0 && (
              <li><Link href="/config#caixas" className="nav-item suave">+ Conectar caixa</Link></li>
            )}
          </ul>

          <h3 className="nav-titulo">Tags <Link href="/config#tags" className="nav-editar" title="Gerenciar tags">✎</Link></h3>
          <ul className="nav">
            {tags.map((t) => (
              <li key={t.id}>
                <NavLink href={`/caixa?v=todas&tag=${t.id}`}>
                  <span className="nav-icone"><span className="bolinha" style={{ background: t.cor }} /></span>
                  <span className="nav-texto">{t.nome}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </Suspense>
        <div className="nav-rodape">
          <Link href="/config" className="nav-item"><span className="nav-icone">⚙️</span><span className="nav-texto">Configurações</span></Link>
        </div>
      </nav>

      <main className="conteudo">{children}</main>
      <Atalhos />
    </div>
  );
}
