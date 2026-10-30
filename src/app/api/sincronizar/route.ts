import { NextResponse, type NextRequest } from "next/server";
import { sincronizarTodas } from "@/lib/sincronizacao";

// Para agendadores externos (ex.: cron do servidor) quando o processo não fica sempre ligado.
// Uso: curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://.../api/sincronizar
export async function POST(req: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || req.headers.get("authorization") !== `Bearer ${segredo}`) {
    return new NextResponse("Não autorizado", { status: 401 });
  }
  return NextResponse.json(await sincronizarTodas());
}
