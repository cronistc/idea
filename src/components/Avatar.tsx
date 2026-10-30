import { corDoNome, iniciais } from "@/lib/formato";

export function Avatar({ nome, pequeno }: { nome: string; pequeno?: boolean }) {
  return (
    <span className={pequeno ? "avatar pequeno" : "avatar"} style={{ background: corDoNome(nome) }} title={nome} aria-hidden>
      {iniciais(nome)}
    </span>
  );
}
