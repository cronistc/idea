import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clienteGmail } from "@/lib/gmail";
import type { AnexoInfo } from "@/lib/leitura";
import { membroAtual } from "@/lib/sessao";

// Baixa um anexo direto do Gmail, por qualquer caixa que tenha recebido a mensagem.
export async function GET(_req: Request, { params }: { params: Promise<{ mensagemId: string; indice: string }> }) {
  const membro = await membroAtual();
  if (!membro) return new NextResponse("Não autorizado", { status: 401 });
  const { mensagemId, indice } = await params;

  const mensagem = await db.mensagem.findFirst({
    where: { id: mensagemId, conversa: { workspaceId: membro.workspaceId } },
    include: { recebimentos: { include: { caixa: true } } },
  });
  const anexo = (mensagem?.anexos as AnexoInfo[] | undefined)?.[Number(indice)];
  const recebimento = mensagem?.recebimentos[0];
  if (!anexo || !recebimento) return new NextResponse("Anexo não encontrado", { status: 404 });

  const { data } = await clienteGmail(recebimento.caixa.refreshTokenCifrado).anexo(recebimento.gmailMsgId, anexo.gmailAnexoId);
  return new NextResponse(Buffer.from(data, "base64url"), {
    headers: {
      "Content-Type": anexo.tipo,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(anexo.nome)}`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
