"use client";

export function SelecionarTodas() {
  return (
    <input
      type="checkbox"
      aria-label="Selecionar todas"
      onChange={(e) => {
        const form = e.currentTarget.form;
        form?.querySelectorAll<HTMLInputElement>('input[name="ids"]').forEach((c) => (c.checked = e.currentTarget.checked));
      }}
    />
  );
}
