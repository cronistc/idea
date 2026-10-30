# Arquitetura proposta

Objetivo: funcionar para uso interno **sem custo mensal**.

## Stack

| Parte | Escolha | Por quê |
|---|---|---|
| App web (front + API) | Next.js + TypeScript | Um projeto só para tela e backend |
| Banco de dados | PostgreSQL | Free tier (Supabase/Neon) ou local |
| Acesso ao banco | Prisma | Migrações e tipos automáticos |
| Login | Google (OAuth) | Mesmo login usado para conectar o Gmail |
| Integração de email | Gmail API | Gratuita |
| Sincronização | Worker com polling a cada ~1 min | Simples e sem custo; push via Pub/Sub fica para depois |
| Tempo real | Server-Sent Events | Atualiza a tela e mostra "fulano está respondendo" |

Hospedagem: para começar, rodar num computador/servidor da empresa ou num
free tier. Avaliar antes de publicar: o plano gratuito da Vercel não permite
uso comercial.

## Ponto de atenção: autorização do Google

O escopo de leitura do Gmail é "restrito". Para um app público isso exige
verificação do Google e auditoria de segurança paga. Para uso interno há dois
caminhos gratuitos:

1. **Google Workspace (email da empresa):** criar o app OAuth como **Interno**.
   Sem verificação, sem limite de usuários. **Recomendado.**
2. **Contas @gmail.com comuns:** app em modo **Teste**, até 100 usuários, mas o
   acesso expira a cada 7 dias e cada pessoa precisa reconectar.

## Modelo de dados (resumo)

```
Workspace     id, nome, modo (CAIXA_UNICA | CONTAS_CONECTADAS), config_resposta
Membro        id, workspace_id, nome, email_login, papel (ADMIN | MEMBRO), assinatura
Caixa         id, workspace_id, membro_id?, endereco, tokens_oauth, history_id
Conversa      id, workspace_id, assunto, status, responsavel_id?, ultima_msg_em
Mensagem      id, conversa_id, message_id_rfc (único), de, para, cc, corpo,
              enviada_por_membro_id?, enviada_em
Recebimento   mensagem_id, caixa_id, gmail_msg_id, gmail_thread_id
Tag           id, workspace_id, nome, cor
ConversaTag   conversa_id, tag_id
Comentario    id, conversa_id, membro_id, texto, criado_em
Filtro        id, workspace_id, tipo, valor, acao
```

## Como os requisitos se resolvem

- **Sem duplicação:** a mensagem é identificada pelo cabeçalho `Message-ID`.
  Se ela chega em duas caixas, existe uma `Mensagem` e dois `Recebimento`s;
  a tela mostra para quem ela foi.
- **Agrupar em conversas:** pelos cabeçalhos `References`/`In-Reply-To`
  (o `threadId` do Gmail é por caixa e não serve entre caixas diferentes).
- **Resposta pelo endereço de quem respondeu:** o envio usa a caixa do membro
  que clicou em responder, mantendo `In-Reply-To`/`References` para o cliente
  ver tudo na mesma conversa. No modo 1, usa a caixa compartilhada e anexa a
  assinatura do atendente.
- **Filtros:** aplicados na sincronização, antes de criar a conversa
  (labels `CATEGORY_PROMOTIONS`/`CATEGORY_SOCIAL`, cabeçalho `List-Unsubscribe`,
  remetente/domínio).
- **Sincronização incremental:** `users.history.list` a partir do último
  `history_id` de cada caixa.

## Próximos passos

1. Criar projeto no Google Cloud e o app OAuth (Interno, se for Workspace)
2. Estrutura do projeto Next.js + Prisma + banco
3. Login com Google e conexão de uma caixa
4. Sincronização e caixa de entrada unificada (só leitura)
5. Responder, tags, status, responsável
6. Comentários internos, presença e filtros
