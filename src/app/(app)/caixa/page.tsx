import Link from "next/link";
import { acaoEmLote } from "@/app/acoes";
import { Avatar } from "@/components/Avatar";
import { SelecionarTodas } from "@/components/SelecionarTodas";
import { TagChip } from "@/components/TagChip";
import { listarConversas, POR_PAGINA, VISOES, type Visao } from "@/lib/consultas";
import { db } from "@/lib/db";
import { emailDe, nomeCurto } from "@/lib/enderecos";
import { quando } from "@/lib/formato";
import { membroAtual } from "@/lib/sessao";

type Busca = { v?: string; caixa?: string; tag?: string; q?: string; p?: string };

export default async function Caixa({ searchParams }: { searchParams: Promise<Busca> }) {
  const sp = await searchParams;
  const membro = (await membroAtual())!;
  const visao: Visao = sp.v && sp.v in VISOES ? (sp.v as Visao) : "entrada";
  const pagina = Math.max(1, Number(sp.p) || 1);

  const [{ total, conversas }, caixas, tag] = await Promise.all([
    listarConversas(membro.workspaceId, membro.id, { visao, caixaId: sp.caixa, tagId: sp.tag, busca: sp.q, pagina }),
    db.caixa.findMany({ where: { workspaceId: membro.workspaceId } }),
    sp.tag ? db.tag.findFirst({ where: { id: sp.tag, workspaceId: membro.workspaceId } }) : null,
  ]);
  const enderecoCaixa = new Map(caixas.map((c) => [c.id, c.endereco]));
  const nossos = new Set(caixas.map((c) => c.endereco));

  const caixaAtual = sp.caixa ? enderecoCaixa.get(sp.caixa) : undefined;
  const titulo = sp.q ? `Resultados para “${sp.q}”` : caixaAtual ?? tag?.nome ?? VISOES[visao];

  const link = (p: number) => {
    const q = new URLSearchParams(Object.entries({ ...sp, p: String(p) }).filter(([, v]) => v) as [string, string][]);
    return `/caixa?${q}`;
  };
  const de = (pagina - 1) * POR_PAGINA + 1;
  const ate = Math.min(total, pagina * POR_PAGINA);

  return (
    <form className="lista">
      <div className="lista-topo">
        <SelecionarTodas />
        <div className="acoes-lote">
          <button className="botao-ferramenta" formAction={acaoEmLote.bind(null, "resolver")} title="Marcar como resolvidas">✅ Resolver</button>
          <button className="botao-ferramenta" formAction={acaoEmLote.bind(null, "pendente")} title="Aguardando o cliente">⏳ Pendente</button>
          <button className="botao-ferramenta" formAction={acaoEmLote.bind(null, "reabrir")} title="Voltar para a caixa de entrada">📥 Reabrir</button>
          <button className="botao-ferramenta" formAction={acaoEmLote.bind(null, "atribuirMim")}>🙋 Assumir</button>
          <button className="botao-ferramenta" formAction={acaoEmLote.bind(null, "lida")}>Marcar lida</button>
          <button className="botao-ferramenta" formAction={acaoEmLote.bind(null, "naoLida")}>Não lida</button>
          {membro.papel === "ADMIN" && (
            <button className="botao-ferramenta perigo" formAction={acaoEmLote.bind(null, "excluir")} title="Remove do app (continua no Gmail)">🗑</button>
          )}
        </div>
        <div className="paginacao">
          {total > 0 && <span className="suave">{de}–{ate} de {total}</span>}
          {pagina > 1 ? <Link className="icone-botao" href={link(pagina - 1)} aria-label="Anterior">‹</Link> : <span className="icone-botao desativado">‹</span>}
          {ate < total ? <Link className="icone-botao" href={link(pagina + 1)} aria-label="Próxima">›</Link> : <span className="icone-botao desativado">›</span>}
        </div>
      </div>
      <h1 className="lista-titulo">{titulo}</h1>

      {conversas.length === 0 ? (
        <div className="vazio">
          <div className="vazio-icone">{sp.q ? "🔍" : "🎉"}</div>
          <p>{sp.q ? "Nada encontrado." : visao === "entrada" ? "Caixa de entrada vazia. Tudo em dia!" : "Nenhuma conversa aqui."}</p>
          {caixas.length === 0 && <Link className="botao" href="/config#caixas">Conectar uma caixa Gmail</Link>}
        </div>
      ) : (
        <ul className="conversas">
          {conversas.map((c) => {
            const remetentes = [...new Set(c.mensagens.map((m) => (nossos.has(emailDe(m.de)) ? "eu/equipe" : nomeCurto(m.de))))];
            const nomes = remetentes.map((r) => (r === "eu/equipe" ? "Equipe" : r)).slice(-3).join(", ");
            return (
              <li key={c.id} className={c.lida ? "conversa-linha" : "conversa-linha nao-lida"}>
                <input type="checkbox" name="ids" value={c.id} aria-label={`Selecionar ${c.assunto}`} />
                <Link href={`/conversa/${c.id}`} className="conversa-link">
                  <span className="col-de">
                    {nomes}
                    {c.mensagens.length > 1 && <span className="qtd"> {c.mensagens.length}</span>}
                  </span>
                  <span className="col-assunto">
                    {c.status !== "ABERTA" && visao === "todas" && (
                      <span className={`status status-${c.status.toLowerCase()}`}>{c.status === "PENDENTE" ? "Pendente" : "Resolvida"}</span>
                    )}
                    {c.tags.map(({ tag }) => <TagChip key={tag.id} nome={tag.nome} cor={tag.cor} />)}
                    <span className="assunto">{c.assunto}</span>
                    <span className="trecho"> — {c.trecho}</span>
                  </span>
                  <span className="col-meta">
                    {c.caixaIds.length > 1 && (
                      <span className="selo-caixas" title={c.caixaIds.map((id) => enderecoCaixa.get(id)).join(", ")}>
                        {c.caixaIds.length} caixas
                      </span>
                    )}
                    {c.caixaIds.length === 1 && caixas.length > 1 && (
                      <span className="selo-caixas">{enderecoCaixa.get(c.caixaIds[0])?.split("@")[0]}</span>
                    )}
                    {c.temAnexo && <span title="Tem anexo">📎</span>}
                    {c._count.comentarios > 0 && <span title="Comentários internos">💬{c._count.comentarios}</span>}
                    {c.responsavel && <Avatar nome={c.responsavel.nome} pequeno />}
                    <time className="col-data">{quando(c.ultimaMsgEm)}</time>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </form>
  );
}
