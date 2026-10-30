export function TagChip({ nome, cor }: { nome: string; cor: string }) {
  return (
    <span className="tag" style={{ "--cor-tag": cor } as React.CSSProperties}>
      {nome}
    </span>
  );
}
