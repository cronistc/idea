import Link from "next/link";
import { notFound } from "next/navigation";
import { alterarStatus, alternarTag, atribuir, excluirComentario, marcarNaoLida } from "@/app/acoes";
import { Avatar } from "@/components/Avatar";
import { Composer } from "@/components/Composer";
import { IframeEmail } from "@/components/IframeEmail";
import { SelectAutomatico } from "@/components/SelectAutomatico";
import { TagChip } from "@/components/TagChip";
import { db } from "@/lib/db";
import { emailDe, nomeCurto } from "@/lib/enderecos";
import { destinatariosResposta, remetentesPermitidos } from "@/lib/envio";
import { dataCompleta, quando, tamanho } from "@/lib/formato";
import type { AnexoInfo } from "@/lib/leitura";
import { membroAtual } from "@/lib/sessao";

const STATUS = [
  { valor: "ABERTA", rotulo: "Aberta", icone: "📥" },
  { valor: "PENDENTE", rotulo: "Pendente", icone: "⏳" },
  { valor: "RESOLVIDA", rotulo: "Resolvida", icone: "✅" },
] as const;

export default async function PaginaConversa({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membro = (await membroAtual())!;
  const conversa = await db.conversa.findFirst({
    where: { id, workspaceId: membro.workspaceId },
    include: {
      mensagens: { orderBy: { enviadaEm: "asc" }, include: { recebimentos: true, enviadaPor: { select: { nome: true } } } },
      comentarios: { orderBy: { criadoEm: "asc" }, include: { membro: { select: { nome: true } } } },
      tags: true,
    },
  });
  if (!conversa) notFound();

  await db.leitura.upsert({
    where: { membroId_conversaId: { membroId: membro.id, conversaId: id } },
    create: { membroId: membro.id, conversaId: id, lidaEm: new Date() },
    update: { lidaEm: new Date() },
  });

  const [caixas, membros, tags] = await Promise.all([
    db.caixa.findMany({ where: { workspaceId: membro.workspaceId }, include: { membro: { select: { nome: true } } } }),
    db.membro.findMany({ where: { workspaceId: membro.workspaceId }, orderBy: { nome: "asc" } }),
    db.tag.findMany({ where: { workspaceId: membro.workspaceId }, orderBy: { nome: "asc" } }),
  ]);
  const caixaPorId = new Map(caixas.map((c) => [c.id, c]));
  const nossos = new Set(caixas.map((c) => c.endereco));
  const tagIds = new Set(conversa.tags.map((t) => t.tagId));

  const remetentes = remetentesPermitidos(membro, caixas, conversa).map((c) => ({
    id: c.id,
    rotulo: c.membroId ? c.endereco : `${c.endereco} (compartilhada)`,
  }));
  const ultima = conversa.mensagens.at(-1);
  const podeResponder = !(membro.workspace.modo === "CONTAS_CONECTADAS" && membro.workspace.respostaPor === "SO_DESTINATARIO" && remetentes.length === 0);

  const textoEncaminhar = ultima
    ? [
        "---------- Mensagem encaminhada ----------",
        `De: ${ultima.de}`,
        `Data: ${dataCompleta(ultima.enviadaEm)}`,
        `Assunto: ${ultima.assunto}`,
        `Para: ${ultima.para.join(", ")}`,
        "",
        ultima.corpoTexto ?? ultima.trecho,
      ].join("\n")
    : "";

  type Item =
    | { tipo: "mensagem"; quando: Date; m: (typeof conversa.mensagens)[number] }
    | { tipo: "comentario"; quando: Date; c: (typeof conversa.comentarios)[number] };
  const linhaDoTempo: Item[] = [
    ...conversa.mensagens.map((m) => ({ tipo: "mensagem" as const, quando: m.enviadaEm, m })),
    ...conversa.comentarios.map((c) => ({ tipo: "comentario" as const, quando: c.criadoEm, c })),
  ].sort((a, b) => a.quando.getTime() - b.quando.getTime());

  const caixasEnvolvidas = [...new Set(conversa.mensagens.flatMap((m) => m.recebimentos.map((r) => r.caixaId)))]
    .map((cid) => caixaPorId.get(cid))
    .filter((c) => c !== undefined);
  // Um por email, preferindo a forma com nome ("Carla <carla@x>" em vez de "carla@x").
  const participantesPorEmail = new Map<string, string>();
  for (const e of conversa.mensagens.flatMap((m) => [m.de, ...m.para, ...m.cc])) {
    const email = emailDe(e);
    if (nossos.has(email)) continue;
    const atual = participantesPorEmail.get(email);
    if (!atual || (atual.trim().toLowerCase() === email && e.includes("<"))) participantesPorEmail.set(email, e);
  }
  const participantes = [...participantesPorEmail.values()];

  return (
    <div className="conversa">
      <div className="conversa-barra">
        <Link href="/caixa" className="icone-botao" aria-label="Voltar">←</Link>
        <div className="segmentado" role="group" aria-label="Status">
          {STATUS.map((s) => (
            <form key={s.valor} action={alterarStatus}>
              <input type="hidden" name="conversaId" value={id} />
              <input type="hidden" name="status" value={s.valor} />
              <button className={conversa.status === s.valor ? "ativo" : ""} aria-pressed={conversa.status === s.valor}>
                {s.icone} {s.rotulo}
              </button>
            </form>
          ))}
        </div>
        <form action={atribuir} className="atribuir">
          <input type="hidden" name="conversaId" value={id} />
          <label className="suave" htmlFor="responsavelId">Responsável</label>
          <SelectAutomatico id="responsavelId" name="responsavelId" defaultValue={conversa.responsavelId ?? ""} key={conversa.responsavelId}>
            <option value="">Ninguém</option>
            {membros.map((m) => <option key={m.id} value={m.id}>{m.id === membro.id ? `${m.nome} (eu)` : m.nome}</option>)}
          </SelectAutomatico>
        </form>
        <details className="menu-tags">
          <summary className="botao-ferramenta">🏷️ Tags</summary>
          <div className="menu-flutuante">
            {tags.map((t) => (
              <form key={t.id} action={alternarTag}>
                <input type="hidden" name="conversaId" value={id} />
                <input type="hidden" name="tagId" value={t.id} />
                <button className="item-menu">
                  <span className="marcador">{tagIds.has(t.id) ? "✓" : ""}</span>
                  <span className="bolinha" style={{ background: t.cor }} /> {t.nome}
                </button>
              </form>
            ))}
            <Link href="/config#tags" className="item-menu suave">+ Gerenciar tags</Link>
          </div>
        </details>
        <form action={marcarNaoLida}>
          <input type="hidden" name="conversaId" value={id} />
          <button className="botao-ferramenta" title="Marcar como não lida">✉ Não lida</button>
        </form>
      </div>

      <div className="conversa-grade">
        <div className="conversa-principal">
          <h1 className="conversa-assunto">
            {conversa.assunto}
            {tags.filter((t) => tagIds.has(t.id)).map((t) => <TagChip key={t.id} nome={t.nome} cor={t.cor} />)}
          </h1>

          <div className="linha-do-tempo">
            {linhaDoTempo.map((item, i) => {
              if (item.tipo === "comentario") {
                const c = item.c;
                return (
                  <div key={c.id} className="nota">
                    <Avatar nome={c.membro.nome} pequeno />
                    <div className="nota-corpo">
                      <div className="nota-cabecalho">
                        <strong>{c.membro.nome}</strong> <span className="suave">comentou · {quando(c.criadoEm)} · só a equipe vê</span>
                        {(c.membroId === membro.id || membro.papel === "ADMIN") && (
                          <form action={excluirComentario} className="inline">
                            <input type="hidden" name="comentarioId" value={c.id} />
                            <button className="link-discreto" title="Excluir comentário">excluir</button>
                          </form>
                        )}
                      </div>
                      <p>{c.texto}</p>
                    </div>
                  </div>
                );
              }
              const m = item.m;
              const anexos = m.anexos as unknown as AnexoInfo[];
              const nossa = nossos.has(emailDe(m.de));
              const recebidaPor = m.recebimentos.map((r) => caixaPorId.get(r.caixaId)?.endereco).filter(Boolean);
              const ehUltima = m.id === ultima?.id;
              const recolhida = !ehUltima && i < linhaDoTempo.length - 3;
              return (
                <details key={m.id} className={nossa ? "mensagem nossa" : "mensagem"} open={!recolhida}>
                  <summary className="mensagem-cabecalho">
                    <Avatar nome={nomeCurto(m.de)} />
                    <div className="mensagem-quem">
                      <div>
                        <strong>{nomeCurto(m.de)}</strong> <span className="suave pequeno">&lt;{emailDe(m.de)}&gt;</span>
                        {m.enviadaPor && m.enviadaPor.nome !== nomeCurto(m.de) && (
                          <span className="selo-app">enviado por {m.enviadaPor.nome}</span>
                        )}
                      </div>
                      <div className="suave pequeno quando-aberto">
                        para {m.para.map(nomeCurto).join(", ")}
                        {m.cc.length > 0 && <> · cc {m.cc.map(nomeCurto).join(", ")}</>}
                        {recebidaPor.length > 0 && !nossa && <> · chegou em {recebidaPor.join(" e ")}</>}
                      </div>
                      <div className="suave pequeno quando-fechado">{m.trecho}</div>
                    </div>
                    <time className="suave pequeno" title={dataCompleta(m.enviadaEm)}>{quando(m.enviadaEm)}</time>
                  </summary>
                  <IframeEmail mensagemId={m.id} />
                  {anexos.length > 0 && (
                    <div className="anexos">
                      {anexos.map((a, idx) => (
                        <a key={idx} className="anexo" href={`/api/anexo/${m.id}/${idx}`}>
                          <span className="anexo-icone">📄</span>
                          <span className="anexo-nome">{a.nome}</span>
                          <span className="suave pequeno">{tamanho(a.tamanho)}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </details>
              );
            })}
          </div>

          <Composer
            conversaId={id}
            remetentes={remetentes}
            assunto={conversa.assunto}
            responder={ultima ? destinatariosResposta(ultima, nossos, false) : undefined}
            responderTodos={ultima ? destinatariosResposta(ultima, nossos, true) : undefined}
            textoEncaminhar={textoEncaminhar}
            podeResponder={podeResponder}
          />
        </div>

        <aside className="painel">
          <section>
            <h3>Detalhes</h3>
            <dl>
              <dt>Status</dt>
              <dd><span className={`status status-${conversa.status.toLowerCase()}`}>{STATUS.find((s) => s.valor === conversa.status)?.rotulo}</span></dd>
              <dt>Responsável</dt>
              <dd>{membros.find((m) => m.id === conversa.responsavelId)?.nome ?? <span className="suave">Ninguém</span>}</dd>
              <dt>Mensagens</dt>
              <dd>{conversa.mensagens.length}</dd>
              <dt>Início</dt>
              <dd>{dataCompleta(conversa.mensagens[0]?.enviadaEm ?? conversa.criadaEm)}</dd>
            </dl>
          </section>
          <section>
            <h3>Caixas</h3>
            <ul className="lista-simples">
              {caixasEnvolvidas.map((c) => (
                <li key={c.id}>{c.membro ? "👤" : "👥"} {c.endereco}</li>
              ))}
            </ul>
          </section>
          <section>
            <h3>Participantes</h3>
            <ul className="lista-simples">
              {participantes.map((p) => (
                <li key={p} title={p}>
                  <Link href={`/escrever?para=${encodeURIComponent(p)}`}>{nomeCurto(p)}</Link>
                  <div className="suave pequeno">{emailDe(p)}</div>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
