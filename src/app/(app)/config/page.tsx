import type { Filtro, Tag } from "@prisma/client";
import {
  alterarPapel,
  criarFiltro,
  criarTag,
  desconectarCaixa,
  excluirFiltro,
  excluirTag,
  salvarConfiguracoes,
  salvarPerfil,
} from "@/app/acoes";
import { Avatar } from "@/components/Avatar";
import { BotaoEnviando } from "@/components/BotaoEnviando";
import { SelectAutomatico } from "@/components/SelectAutomatico";
import { TagChip } from "@/components/TagChip";
import { db } from "@/lib/db";
import { quando } from "@/lib/formato";
import { membroAtual } from "@/lib/sessao";

const NOME_MODO = {
  CAIXA_UNICA: "Caixa única com atendentes internos",
  CONTAS_CONECTADAS: "Várias contas que dividem uma caixa",
};

const NOME_RESPOSTA = {
  QUEM_RESPONDEU: "Do endereço de quem respondeu",
  QUEM_RECEBEU: "Do endereço que recebeu o email",
  SO_DESTINATARIO: "Só quem recebeu pode responder",
};

const CATEGORIAS: Record<string, string> = {
  CATEGORY_PROMOTIONS: "Promoções",
  CATEGORY_SOCIAL: "Social",
  CATEGORY_UPDATES: "Atualizações",
  CATEGORY_FORUMS: "Fóruns",
};

function descreverFiltro(f: Filtro & { tag: Tag | null }) {
  const condicao = {
    CATEGORIA_GMAIL: `Categoria do Gmail é “${CATEGORIAS[f.valor] ?? f.valor}”`,
    NEWSLETTER: "É newsletter ou lista de emails",
    REMETENTE: `Remetente é ${f.valor}`,
    DOMINIO: `Remetente é do domínio ${f.valor}`,
    ASSUNTO_CONTEM: `Assunto contém “${f.valor}”`,
  }[f.tipo];
  return { condicao, acao: f.acao === "IGNORAR" ? "não entra no app" : null };
}

export default async function Configuracoes({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const membro = (await membroAtual())!;
  const { workspace } = membro;
  const admin = membro.papel === "ADMIN";

  const [caixas, membros, tags, filtros] = await Promise.all([
    db.caixa.findMany({ where: { workspaceId: workspace.id }, include: { membro: true }, orderBy: { conectadaEm: "asc" } }),
    db.membro.findMany({ where: { workspaceId: workspace.id }, orderBy: { criadoEm: "asc" }, include: { caixas: { select: { endereco: true } } } }),
    db.tag.findMany({ where: { workspaceId: workspace.id }, orderBy: { nome: "asc" }, include: { _count: { select: { conversas: true } } } }),
    db.filtro.findMany({ where: { workspaceId: workspace.id }, include: { tag: true } }),
  ]);
  const temCaixaPropria = caixas.some((c) => c.membroId === membro.id);
  const podeConectar = admin || (workspace.modo === "CONTAS_CONECTADAS" && !temCaixaPropria);

  return (
    <div className="pagina-estreita config">
      <h1>Configurações</h1>
      {erro && <p className="erro">{erro}</p>}

      <section className="cartao" id="perfil">
        <h2>Meu perfil</h2>
        <form action={salvarPerfil} className="formulario">
          <label>
            Nome
            <input name="nome" defaultValue={membro.nome} required />
          </label>
          <label>
            Assinatura <span className="suave pequeno">(adicionada ao fim de cada email que você envia)</span>
            <textarea name="assinatura" rows={3} defaultValue={membro.assinatura ?? ""} placeholder={`${membro.nome}\nAtendimento – ${workspace.nome}`} />
          </label>
          <div className="linha-botoes">
            <BotaoEnviando className="botao" pendente="Salvando…">Salvar perfil</BotaoEnviando>
            <button className="botao secundario" form="form-sair">Sair da conta</button>
          </div>
        </form>
        <form id="form-sair" action="/api/auth/sair" method="post" hidden />
      </section>

      <section className="cartao" id="caixas">
        <h2>Caixas conectadas</h2>
        <p className="suave pequeno">
          {workspace.modo === "CAIXA_UNICA"
            ? "Modo caixa única: o administrador conecta a caixa compartilhada e a equipe responde por ela."
            : "Modo várias contas: cada membro conecta o próprio Gmail; tudo aparece no mesmo ambiente."}
        </p>
        {caixas.length === 0 ? (
          <p className="suave">Nenhuma caixa conectada ainda.</p>
        ) : (
          <ul className="lista-config">
            {caixas.map((c) => (
              <li key={c.id}>
                <div>
                  <strong>{c.endereco}</strong>
                  <div className="suave pequeno">
                    {c.membro ? `Pessoal de ${c.membro.nome}` : "Compartilhada"} ·{" "}
                    {c.erroSincronizacao ? (
                      <span className="erro" title={c.erroSincronizacao}>erro ao sincronizar</span>
                    ) : c.sincronizadaEm ? (
                      `sincronizada ${quando(c.sincronizadaEm)}`
                    ) : (
                      "sincronizando…"
                    )}
                  </div>
                </div>
                {(admin || c.membroId === membro.id) && (
                  <form action={desconectarCaixa}>
                    <input type="hidden" name="caixaId" value={c.id} />
                    <button className="botao secundario pequeno" title="As mensagens já sincronizadas continuam no app">Desconectar</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
        {podeConectar && <a className="botao" href="/api/auth/google?para=caixa">+ Conectar caixa Gmail</a>}
        {admin && workspace.modo === "CAIXA_UNICA" && (
          <p className="suave pequeno">Dica: ao conectar, entre com a conta compartilhada (ex.: contato@{workspace.nome}).</p>
        )}
      </section>

      <section className="cartao" id="tags">
        <h2>Tags</h2>
        <ul className="lista-config">
          {tags.map((t) => (
            <li key={t.id}>
              <span><TagChip nome={t.nome} cor={t.cor} /> <span className="suave pequeno">{t._count.conversas} conversas</span></span>
              {admin && (
                <form action={excluirTag}>
                  <input type="hidden" name="tagId" value={t.id} />
                  <button className="link-discreto">excluir</button>
                </form>
              )}
            </li>
          ))}
        </ul>
        <form action={criarTag} className="linha-form">
          <input name="nome" placeholder="Nova tag" required />
          <input name="cor" type="color" defaultValue="#5b6cf0" aria-label="Cor" />
          <BotaoEnviando className="botao secundario">Criar</BotaoEnviando>
        </form>
      </section>

      <section className="cartao" id="equipe">
        <h2>Equipe</h2>
        <ul className="lista-config">
          {membros.map((m) => (
            <li key={m.id}>
              <span className="com-avatar">
                <Avatar nome={m.nome} pequeno />
                <span>
                  {m.nome} {m.id === membro.id && <span className="suave">(você)</span>}
                  <div className="suave pequeno">{m.email}{m.caixas.length > 0 && " · caixa conectada"}</div>
                </span>
              </span>
              {admin ? (
                <form action={alterarPapel}>
                  <input type="hidden" name="membroId" value={m.id} />
                  <SelectAutomatico name="papel" defaultValue={m.papel} aria-label={`Papel de ${m.nome}`}>
                    <option value="ADMIN">Administrador</option>
                    <option value="MEMBRO">Membro</option>
                  </SelectAutomatico>
                </form>
              ) : (
                <span className="suave">{m.papel === "ADMIN" ? "Administrador" : "Membro"}</span>
              )}
            </li>
          ))}
        </ul>
        <p className="suave pequeno">Para adicionar alguém, peça que entre no app com a conta Google da empresa.</p>
      </section>

      {admin && (
        <>
          <section className="cartao" id="filtros">
            <h2>Filtros</h2>
            <p className="suave pequeno">Aplicados a emails novos. Respostas em conversas existentes sempre entram.</p>
            <ul className="lista-config">
              {filtros.map((f) => {
                const d = descreverFiltro(f);
                return (
                  <li key={f.id}>
                    <span>
                      {d.condicao} → {d.acao ?? <>aplicar {f.tag && <TagChip nome={f.tag.nome} cor={f.tag.cor} />}</>}
                    </span>
                    <form action={excluirFiltro}>
                      <input type="hidden" name="filtroId" value={f.id} />
                      <button className="link-discreto">excluir</button>
                    </form>
                  </li>
                );
              })}
            </ul>
            <form action={criarFiltro} className="formulario filtro-novo">
              <div className="linha-form">
                <select name="tipo" defaultValue="DOMINIO" aria-label="Condição">
                  <option value="DOMINIO">Domínio do remetente</option>
                  <option value="REMETENTE">Email do remetente</option>
                  <option value="ASSUNTO_CONTEM">Assunto contém</option>
                  <option value="CATEGORIA_GMAIL">Categoria do Gmail</option>
                  <option value="NEWSLETTER">É newsletter</option>
                </select>
                <input name="valor" placeholder="ex.: lojaxyz.com, boleto, CATEGORY_UPDATES" aria-label="Valor" />
              </div>
              <div className="linha-form">
                <select name="acao" defaultValue="IGNORAR" aria-label="Ação">
                  <option value="IGNORAR">Não trazer para o app</option>
                  <option value="APLICAR_TAG">Aplicar a tag…</option>
                </select>
                <select name="tagId" aria-label="Tag" defaultValue="">
                  <option value="">(tag, se for aplicar)</option>
                  {tags.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
                <BotaoEnviando className="botao secundario">Adicionar filtro</BotaoEnviando>
              </div>
            </form>
          </section>

          <section className="cartao" id="espaco">
            <h2>Espaço da equipe</h2>
            <form action={salvarConfiguracoes} className="formulario">
              <label>
                Nome
                <input name="nome" defaultValue={workspace.nome} required />
              </label>
              <label>
                Modo
                <select name="modo" defaultValue={workspace.modo}>
                  {Object.entries(NOME_MODO).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
                </select>
              </label>
              <label>
                Ao responder, o email sai
                <select name="respostaPor" defaultValue={workspace.respostaPor}>
                  {Object.entries(NOME_RESPOSTA).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
                </select>
                <span className="suave pequeno">Vale para o modo “várias contas”. No modo caixa única, sempre sai da caixa compartilhada.</span>
              </label>
              <BotaoEnviando className="botao" pendente="Salvando…">Salvar</BotaoEnviando>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
