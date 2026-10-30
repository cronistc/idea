"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Atalhos de teclado ("/" pesquisar, "c" escrever) e atualização automática da tela. */
export function Atalhos() {
  const router = useRouter();

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement;
      if (alvo.closest("input, textarea, select, [contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") {
        e.preventDefault();
        document.querySelector<HTMLInputElement>("#busca")?.focus();
      } else if (e.key === "c") {
        router.push("/escrever");
      }
    };
    window.addEventListener("keydown", tecla);
    // Novos emails chegam pela sincronização em segundo plano: atualiza a cada 30 s.
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 30_000);
    return () => {
      window.removeEventListener("keydown", tecla);
      clearInterval(timer);
    };
  }, [router]);

  return null;
}
