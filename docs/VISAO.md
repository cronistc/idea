# Visão do produto

## Problema

Os emails da empresa ficam espalhados nas caixas de cada pessoa. Ninguém sabe
o que já foi respondido, por quem, nem em que pé está cada conversa. O contexto
se perde e emails ficam sem resposta.

## Proposta

Um **espaço de equipe** onde todos compartilham os mesmos emails, tags,
status, responsáveis, comentários internos e histórico de respostas.

## Conceitos

| Conceito | O que é |
|---|---|
| **Espaço** (workspace) | O ambiente da equipe: membros, tags, filtros, configurações. |
| **Caixa conectada** | Uma conta Gmail real ligada ao espaço. |
| **Membro** | Uma pessoa com login no app. Pode ou não ter uma caixa própria conectada. |
| **Conversa** | Uma thread de email, exibida uma única vez no espaço. |

## Dois modos de uso

O administrador escolhe o modo nas configurações do espaço. Por baixo, o
modelo é o mesmo: a diferença é quantas caixas existem e se cada membro tem a
sua.

### Modo 1: caixa única com atendentes internos

- Uma caixa real (ex.: `contato@empresa.com`).
- Os atendentes são só logins no app, sem email próprio.
- Toda resposta sai da caixa compartilhada, com a assinatura do atendente
  (ex.: "Maria – Atendimento").
- O app registra internamente quem enviou cada resposta.

### Modo 2: várias contas que dividem uma caixa

- Cada membro conecta o seu próprio Gmail (`joao@`, `maria@`, `ana@`).
- Tudo o que chega nessas contas, menos o que os filtros bloqueiam, aparece no
  ambiente comum.
- **Resposta sai do endereço de quem respondeu**, independentemente de para quem
  o email foi enviado. Se chegou para o João e a Maria responde, sai de `maria@`.
  - Configurável pelo administrador. Alternativas: responder pelo endereço de
    quem recebeu, ou permitir que só o destinatário responda (os demais apenas
    veem e comentam).
- **Sem duplicação:** se o mesmo email chega para João e Maria (destinatário +
  cópia), aparece **uma única conversa**, indicando que foi para os dois.

## Funcionalidades comuns (MVP)

- Caixa de entrada unificada, organizada por conversa
- Tags compartilhadas (criadas uma vez, usadas por todos)
- Status da conversa: aberta, pendente, resolvida
- Responsável pela conversa (atribuição)
- Comentários internos (o cliente não vê)
- Histórico: quem respondeu, quando e o quê
- Aviso de "fulano está respondendo" para evitar resposta dupla
- Filtros do administrador:
  - ignorar categorias Promoções e Social do Gmail
  - ignorar newsletters/marketing (cabeçalho `List-Unsubscribe`)
  - bloquear remetentes ou domínios
  - regras automáticas (ex.: assunto contém "boleto" → tag Financeiro)

## Decisões tomadas

| Tema | Decisão |
|---|---|
| Provedor | Gmail apenas, por enquanto |
| Plataforma | Web |
| Público | Uso interno da empresa (não é SaaS por ora) |
| Custo | Zero ou o mais próximo disso |
| Email duplicado | Uma conversa só, mostrando todos os destinatários |
| Endereço de resposta (modo 2) | De quem respondeu; ajustável nas configurações |

## Fora do escopo do MVP

- Outlook / Microsoft 365 e IMAP genérico
- App mobile nativo (a versão web deve funcionar no celular)
- Cobrança, planos e múltiplas empresas
- IA (resumo, classificação automática) — candidato para depois
