import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { quemEsta, registrarPresenca, sairDaConversa } from "@/lib/presenca";
import { membroAtual } from "@/lib/sessao";

// POST { conversaId, digitando, sair } → registra presença e devolve quem mais está na conversa.
export async function POST(req: NextRequest) {
  const membro = await membroAtual();
  if (!membro) return new NextResponse("Não autorizado", { status: 401 });
  const { conversaId, digitando, sair } = (await req.json()) as { conversaId?: string; digitando?: boolean; sair?: boolean };
  if (!conversaId || !(await db.conversa.findFirst({ where: { id: conversaId, workspaceId: membro.workspaceId }, select: { id: true } }))) {
    return new NextResponse("Conversa inválida", { status: 400 });
  }
  if (sair) sairDaConversa(conversaId, membro.id);
  else registrarPresenca(conversaId, membro.id, membro.nome, Boolean(digitando));
  return NextResponse.json({ outros: quemEsta(conversaId, membro.id) });
}
