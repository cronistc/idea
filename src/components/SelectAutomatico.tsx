"use client";

/** Select que envia o formulário assim que muda. */
export function SelectAutomatico(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}
