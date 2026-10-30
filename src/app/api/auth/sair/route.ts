import { NextResponse, type NextRequest } from "next/server";
import { encerrarSessao } from "@/lib/sessao";

export async function POST(req: NextRequest) {
  await encerrarSessao();
  return NextResponse.redirect(new URL("/", req.url), 303);
}
