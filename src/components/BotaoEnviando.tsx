"use client";

import { useFormStatus } from "react-dom";

/** Botão que fica desabilitado enquanto o formulário é enviado. */
export function BotaoEnviando({ pendente, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { pendente?: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button {...props} disabled={pending || props.disabled}>
      {pending && pendente ? pendente : children}
    </button>
  );
}
