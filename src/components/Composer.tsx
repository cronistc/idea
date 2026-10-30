"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { comentar, enviar, type EstadoEnvio } from "@/app/acoes";
import { BotaoEnviando } from "./BotaoEnviando";

export type Destinatarios = { para: string[]; cc: string[] };
type Modo = "responder" | "todos" | "encaminhar" | "comentario";

type Props = {
  conversaId?: string; // ausente = email novo
  remetentes: { id: string; rotulo: string }[];
  assunto?: string;
  responder?: Destinatarios;
  responderTodos?: Destinatarios;
  textoEncaminhar?: string;
  podeResponder?: boolean;
  paraInicial?: string;
};

function comPrefixo(prefixo: string, assunto: string) {
  return new RegExp(`^${prefixo}:`, "i").test(assunto) || (prefixo === "Re" && /^res:/i.test(assunto)) ? assunto : `${prefixo}: ${assunto}`;
}

export function Composer(props: Props) {
  const novo = !props.conversaId;
  const podeResponder = props.podeResponder ?? true;
  const [modo, setModo] = useState<Modo | null>(novo ? "responder" : null);
  const [estado, acao] = useActionState<EstadoEnvio, FormData>(enviar, {});
  const [outros, setOutros] = useState<{ nome: string; digitando: boolean }[]>([]);
  const [digitando, setDigitando] = useState(false);
  const [arquivos, setArquivos] = useState<string[]>([]);
  const form = useRef<HTMLFormElement>(null);
  const depois = useRef<HTMLInputElement>(null);

  // Depois de enviar, fecha o editor.
  useEffect(() => {
    if (estado.ok) {
      form.current?.reset();
      setArquivos([]);
      setModo(null);
      setDigitando(false);
    }
  }, [estado.ok]);

  // Presença: avisa os outros que estou aqui (e se estou escrevendo) e descobre quem mais está.
  const digitandoRef = useRef(false);
  digitandoRef.current = digitando && modo !== null && modo !== "comentario";
  useEffect(() => {
    const conversaId = props.conversaId;
    if (!conversaId) return;
    const pulso = () =>
      fetch("/api/presenca", { method: "POST", body: JSON.stringify({ conversaId, digitando: digitandoRef.current }) })
        .then((r) => (r.ok ? r.json() : { outros: [] }))
        .then((d: { outros: typeof outros }) => setOutros(d.outros))
        .catch(() => {});
    pulso();
    const timer = setInterval(pulso, 5_000);
    return () => {
      clearInterval(timer);
      fetch("/api/presenca", { method: "POST", body: JSON.stringify({ conversaId, sair: true }), keepalive: true }).catch(() => {});
    };
  }, [props.conversaId]);

  const respondendo = outros.filter((o) => o.digitando);
  const vendo = outros.filter((o) => !o.digitando);
  const aviso =
    respondendo.length > 0 ? (
      <div className="aviso alerta">
        ✍ {respondendo.map((o) => o.nome).join(", ")} {respondendo.length > 1 ? "estão" : "está"} respondendo esta conversa agora
      </div>
    ) : vendo.length > 0 ? (
      <div className="aviso">👀 {vendo.map((o) => o.nome).join(", ")} também {vendo.length > 1 ? "estão" : "está"} vendo</div>
    ) : null;

  if (!novo && modo === null) {
    return (
      <div className="composer fechado">
        {aviso}
        <div className="acoes-resposta">
          {podeResponder && props.remetentes.length > 0 && (
            <>
              <button className="botao secundario" onClick={() => setModo("responder")}>↩ Responder</button>
              {props.responderTodos && props.responderTodos.para.length + props.responderTodos.cc.length > 1 && (
                <button className="botao secundario" onClick={() => setModo("todos")}>↩↩ Responder a todos</button>
              )}
              <button className="botao secundario" onClick={() => setModo("encaminhar")}>↪ Encaminhar</button>
            </>
          )}
          <button className="botao secundario nota" onClick={() => setModo("comentario")}>💬 Comentário interno</button>
        </div>
        {!podeResponder && <p className="suave pequeno">Pela configuração do espaço, só quem recebeu este email pode responder. Você pode comentar.</p>}
        {podeResponder && props.remetentes.length === 0 && (
          <p className="suave pequeno">Você não tem uma caixa para responder. Conecte a sua em Configurações.</p>
        )}
      </div>
    );
  }

  if (modo === "comentario") {
    return (
      <form
        className="composer comentario"
        action={async (f) => {
          await comentar(f);
          setModo(null);
        }}
      >
        {aviso}
        <input type="hidden" name="conversaId" value={props.conversaId} />
        <textarea name="texto" rows={3} placeholder="Escreva uma nota para a equipe. O cliente não vê." autoFocus required />
        <div className="rodape-composer">
          <BotaoEnviando className="botao" pendente="Salvando…">Comentar</BotaoEnviando>
          <button type="button" className="botao secundario" onClick={() => setModo(null)}>Cancelar</button>
        </div>
      </form>
    );
  }

  if (props.remetentes.length === 0) {
    return <div className="composer"><p className="erro">Nenhuma caixa disponível para enviar. Conecte uma em Configurações.</p></div>;
  }

  const dest =
    modo === "todos" ? props.responderTodos : modo === "responder" ? props.responder : { para: [], cc: [] };
  const assunto = novo
    ? ""
    : modo === "encaminhar"
      ? comPrefixo("Fwd", props.assunto ?? "")
      : comPrefixo("Re", props.assunto ?? "");
  const paraInicial = novo ? (props.paraInicial ?? "") : (dest?.para ?? []).join(", ");
  const ccInicial = (dest?.cc ?? []).join(", ");

  return (
    <form ref={form} className="composer aberto" action={acao} key={modo}>
      {aviso}
      {props.conversaId && <input type="hidden" name="conversaId" value={props.conversaId} />}
      <input type="hidden" name="depois" ref={depois} defaultValue="" />
      <div className="campo-linha">
        <label htmlFor="caixaId">De</label>
        {props.remetentes.length === 1 ? (
          <>
            <input type="hidden" name="caixaId" value={props.remetentes[0].id} />
            <span>{props.remetentes[0].rotulo}</span>
          </>
        ) : (
          <select id="caixaId" name="caixaId" defaultValue={props.remetentes[0].id}>
            {props.remetentes.map((r) => <option key={r.id} value={r.id}>{r.rotulo}</option>)}
          </select>
        )}
      </div>
      <div className="campo-linha">
        <label htmlFor="para">Para</label>
        <input id="para" name="para" defaultValue={paraInicial} placeholder="cliente@exemplo.com, outro@exemplo.com" required autoFocus={modo === "encaminhar" || novo} />
      </div>
      <div className="campo-linha">
        <label htmlFor="cc">Cc</label>
        <input id="cc" name="cc" defaultValue={ccInicial} />
      </div>
      {novo || modo === "encaminhar" ? (
        <div className="campo-linha">
          <label htmlFor="assunto">Assunto</label>
          <input id="assunto" name="assunto" defaultValue={assunto} required={novo} />
        </div>
      ) : (
        <input type="hidden" name="assunto" value={assunto} />
      )}
      <textarea
        name="texto"
        rows={novo ? 14 : 8}
        defaultValue={modo === "encaminhar" ? `\n\n${props.textoEncaminhar ?? ""}` : ""}
        placeholder="Escreva sua mensagem…"
        autoFocus={modo === "responder" || modo === "todos"}
        onChange={(e) => setDigitando(e.currentTarget.value.trim().length > 0)}
      />
      {estado.erro && <p className="erro">{estado.erro}</p>}
      <div className="rodape-composer">
        <BotaoEnviando className="botao" pendente="Enviando…" onClick={() => depois.current && (depois.current.value = "")}>
          Enviar
        </BotaoEnviando>
        {!novo && (
          <BotaoEnviando className="botao secundario" pendente="Enviando…" onClick={() => depois.current && (depois.current.value = "resolver")}>
            Enviar e resolver
          </BotaoEnviando>
        )}
        <label className="anexar botao secundario" title="Anexar arquivos">
          📎 Anexar
          <input
            type="file"
            name="anexos"
            multiple
            className="oculto"
            onChange={(e) => setArquivos([...(e.currentTarget.files ?? [])].map((f) => f.name))}
          />
        </label>
        {arquivos.length > 0 && <span className="suave pequeno arquivos">{arquivos.join(", ")}</span>}
        {!novo && (modo === "responder" || modo === "todos") && (
          <label className="citar">
            <input type="checkbox" name="citar" defaultChecked /> Incluir mensagem anterior
          </label>
        )}
        {!novo && (
          <button type="button" className="botao secundario descartar" onClick={() => { setModo(null); setDigitando(false); }}>
            Descartar
          </button>
        )}
      </div>
      {modo === "encaminhar" && <p className="suave pequeno">Anexos da mensagem original não são encaminhados automaticamente.</p>}
    </form>
  );
}
