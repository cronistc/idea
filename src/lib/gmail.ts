import { decifrar } from "./cripto";
import { clienteOAuth } from "./google";

const BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export type CabecalhoGmail = { name: string; value: string };
export type ParteGmail = {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: CabecalhoGmail[];
  body?: { size?: number; data?: string; attachmentId?: string };
  parts?: ParteGmail[];
};
export type MensagemGmail = {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: ParteGmail;
};

export class ErroGmail extends Error {
  constructor(public status: number, mensagem: string) {
    super(mensagem);
  }
}

/** Cliente da API do Gmail autenticado com o refresh token de uma caixa. */
export function clienteGmail(refreshTokenCifrado: string) {
  const oauth = clienteOAuth();
  oauth.setCredentials({ refresh_token: decifrar(refreshTokenCifrado) });

  async function chamar<T>(caminho: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    const { token } = await oauth.getAccessToken();
    const resp = await fetch(`${BASE}${caminho}`, {
      method: init.method ?? "GET",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
    if (!resp.ok) throw new ErroGmail(resp.status, `Gmail ${resp.status}: ${await resp.text()}`);
    return (await resp.json()) as T;
  }

  return {
    perfil: () => chamar<{ emailAddress: string; historyId: string }>("/profile"),

    listarMensagens: (q: string, pageToken?: string) =>
      chamar<{ messages?: { id: string }[]; nextPageToken?: string }>(
        `/messages?maxResults=100&q=${encodeURIComponent(q)}${pageToken ? `&pageToken=${pageToken}` : ""}`,
      ),

    historico: (startHistoryId: string, pageToken?: string) =>
      chamar<{
        history?: { messagesAdded?: { message: { id: string; labelIds?: string[] } }[] }[];
        historyId: string;
        nextPageToken?: string;
      }>(
        `/history?historyTypes=messageAdded&maxResults=500&startHistoryId=${startHistoryId}` +
          (pageToken ? `&pageToken=${pageToken}` : ""),
      ),

    mensagem: (id: string) => chamar<MensagemGmail>(`/messages/${id}?format=full`),

    anexo: (msgId: string, anexoId: string) =>
      chamar<{ data: string; size: number }>(`/messages/${msgId}/attachments/${anexoId}`),

    enviar: (raw: string, threadId?: string) =>
      chamar<{ id: string; threadId: string }>("/messages/send", {
        method: "POST",
        body: { raw: Buffer.from(raw, "utf8").toString("base64url"), ...(threadId ? { threadId } : {}) },
      }),
  };
}

export type ClienteGmail = ReturnType<typeof clienteGmail>;
