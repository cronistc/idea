"use server";

import { revalidatePath } from "next/cache";
import type { Modo, RespostaPor } from "@prisma/client";
import { db } from "@/lib/db";
import { membroAtual } from "@/lib/sessao";

const MODOS: Modo[] = ["CAIXA_UNICA", "CONTAS_CONECTADAS"];
const RESPOSTAS: RespostaPor[] = ["QUEM_RESPONDEU", "QUEM_RECEBEU", "SO_DESTINATARIO"];

export async function salvarConfiguracoes(form: FormData) {
  const membro = await membroAtual();
  if (membro?.papel !== "ADMIN") throw new Error("Apenas administradores");

  const modo = form.get("modo") as Modo;
  const respostaPor = form.get("respostaPor") as RespostaPor;
  if (!MODOS.includes(modo) || !RESPOSTAS.includes(respostaPor)) throw new Error("Valor inválido");

  await db.workspace.update({ where: { id: membro.workspaceId }, data: { modo, respostaPor } });
  revalidatePath("/");
}
