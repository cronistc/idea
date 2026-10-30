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
   Sem verificação, sem limite de usuários. **Escolhido: a empresa usa Workspace.**
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

## Onde está cada coisa

| Pasta/arquivo | Conteúdo |
|---|---|
| `src/lib/gmail.ts` | Chamadas à API do Gmail |
| `src/lib/leitura.ts` | Converte a mensagem do Gmail (cabeçalhos, corpo, anexos) |
| `src/lib/ingestao.ts` | Grava a mensagem sem duplicar e escolhe a conversa |
| `src/lib/sincronizacao.ts` | Carga inicial e incremental de cada caixa |
| `src/lib/envio.ts` | Regras de quem responde por qual caixa e envio |
| `src/lib/mime.ts` | Monta o email (acentos, anexos, cabeçalhos de resposta) |
| `src/lib/filtros.ts` | Filtros de publicidade/newsletter e regras de tag |
| `src/lib/presenca.ts` | Quem está vendo/respondendo (memória do servidor) |
| `src/instrumentation.ts` | Agenda a sincronização quando o servidor sobe |
| `src/app/acoes.ts` | Ações do servidor (status, tags, envio, configurações…) |
| `src/app/(app)/` | Telas: caixa, conversa, escrever, configurações |
| `tests/` | Testes automatizados |

## Limitações conhecidas

- A presença ("fulano está respondendo") fica na memória do servidor: funciona
  com um único processo, que é o caso do uso interno.
- Encaminhar não reenvia os anexos da mensagem original.
- Marcar como lida no app não altera o Gmail, e vice-versa.

## Próximos passos

1. ~~Estrutura do projeto, login e conexão de caixas~~ ✅
2. ~~Sincronização, caixa unificada, resposta, tags, status, comentários,
   presença e filtros~~ ✅
3. Criar o app OAuth no Google Cloud e testar com as contas reais (ver [SETUP.md](SETUP.md))
4. Escolher onde hospedar (computador da empresa ou servidor gratuito)
5. Ideias: respostas prontas, notificações, resumo por IA, relatórios de tempo de resposta
