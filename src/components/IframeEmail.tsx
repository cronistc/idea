"use client";

import { useEffect, useRef } from "react";

/** Mostra o HTML do email isolado (sem scripts) e ajusta a altura ao conteúdo. */
export function IframeEmail({ mensagemId }: { mensagemId: string }) {
  const ref = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;
    let observador: ResizeObserver | undefined;
    const ajustar = () => {
      const doc = iframe.contentDocument;
      if (!doc?.documentElement) return;
      iframe.style.height = `${doc.documentElement.scrollHeight + 4}px`;
      observador?.disconnect();
      observador = new ResizeObserver(() => (iframe.style.height = `${doc.documentElement.scrollHeight + 4}px`));
      observador.observe(doc.body);
    };
    iframe.addEventListener("load", ajustar);
    ajustar();
    return () => {
      iframe.removeEventListener("load", ajustar);
      observador?.disconnect();
    };
  }, []);

  return (
    <iframe
      ref={ref}
      className="corpo-email"
      src={`/api/corpo/${mensagemId}`}
      // Sem allow-scripts: o email não executa código. allow-same-origin só para medir a altura.
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      title="Conteúdo do email"
    />
  );
}
