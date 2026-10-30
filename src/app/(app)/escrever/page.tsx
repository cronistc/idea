import { Composer } from "@/components/Composer";
import { db } from "@/lib/db";
import { remetentesPermitidos } from "@/lib/envio";
import { membroAtual } from "@/lib/sessao";

export default async function Escrever({ searchParams }: { searchParams: Promise<{ para?: string }> }) {
  const { para } = await searchParams;
  const membro = (await membroAtual())!;
  const caixas = await db.caixa.findMany({ where: { workspaceId: membro.workspaceId }, orderBy: { endereco: "asc" } });
  const remetentes = remetentesPermitidos(membro, caixas).map((c) => ({
    id: c.id,
    rotulo: c.membroId ? c.endereco : `${c.endereco} (compartilhada)`,
  }));

  return (
    <div className="pagina-estreita">
      <h1>Nova mensagem</h1>
      <Composer remetentes={remetentes} paraInicial={para} />
    </div>
  );
}
