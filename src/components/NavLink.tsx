"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/** Link do menu lateral que fica destacado quando corresponde à tela atual. */
export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const alvo = new URL(href, "http://x");
  let ativo = pathname === alvo.pathname;
  if (ativo && alvo.pathname === "/caixa") {
    for (const chave of ["v", "caixa", "tag"]) {
      const esperado = alvo.searchParams.get(chave) ?? (chave === "v" ? "entrada" : null);
      const atual = params.get(chave) ?? (chave === "v" ? "entrada" : null);
      if (esperado !== atual) ativo = false;
    }
  }
  return (
    <Link href={href} className={ativo ? "nav-item ativo" : "nav-item"} aria-current={ativo ? "page" : undefined}>
      {children}
    </Link>
  );
}
