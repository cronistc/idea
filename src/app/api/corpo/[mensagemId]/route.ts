import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { escaparHtml } from "@/lib/mime";
import { membroAtual } from "@/lib/sessao";

// Serve o HTML do email para um iframe isolado: sem scripts, links abrem em nova aba.
export async function GET(_req: Request, { params }: { params: Promise<{ mensagemId: string }> }) {
  const membro = await membroAtual();
  if (!membro) return new NextResponse("Não autorizado", { status: 401 });
  const { mensagemId } = await params;
  const m = await db.mensagem.findFirst({
    where: { id: mensagemId, conversa: { workspaceId: membro.workspaceId } },
    select: { corpoHtml: true, corpoTexto: true },
  });
  if (!m) return new NextResponse("Não encontrada", { status: 404 });

  const corpo =
    m.corpoHtml ??
    `<pre style="white-space:pre-wrap;font:14px/1.5 system-ui,sans-serif;margin:0">${escaparHtml(m.corpoTexto ?? "")}</pre>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><base target="_blank">
<style>body{margin:0;font:14px/1.5 system-ui,sans-serif;color:#1f2328;background:#fff;overflow-wrap:anywhere}img{max-width:100%;height:auto}blockquote{margin:0 0 0 .5em;padding-left:.75em;border-left:2px solid #d0d7de;color:#57606a}@media (prefers-color-scheme:dark){body{padding:12px 16px}}</style>
</head><body>${corpo}</body></html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "default-src 'none'; img-src * data: cid:; style-src 'unsafe-inline' *; font-src * data:; base-uri 'self'",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
