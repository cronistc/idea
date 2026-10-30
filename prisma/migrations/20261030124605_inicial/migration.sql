-- CreateEnum
CREATE TYPE "Modo" AS ENUM ('CAIXA_UNICA', 'CONTAS_CONECTADAS');

-- CreateEnum
CREATE TYPE "RespostaPor" AS ENUM ('QUEM_RESPONDEU', 'QUEM_RECEBEU', 'SO_DESTINATARIO');

-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('ADMIN', 'MEMBRO');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('ABERTA', 'PENDENTE', 'RESOLVIDA');

-- CreateEnum
CREATE TYPE "TipoFiltro" AS ENUM ('CATEGORIA_GMAIL', 'NEWSLETTER', 'REMETENTE', 'DOMINIO', 'ASSUNTO_CONTEM');

-- CreateEnum
CREATE TYPE "AcaoFiltro" AS ENUM ('IGNORAR', 'APLICAR_TAG');

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "modo" "Modo" NOT NULL DEFAULT 'CONTAS_CONECTADAS',
    "respostaPor" "RespostaPor" NOT NULL DEFAULT 'QUEM_RESPONDEU',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membro" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "papel" "Papel" NOT NULL DEFAULT 'MEMBRO',
    "assinatura" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Caixa" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "membroId" TEXT,
    "endereco" TEXT NOT NULL,
    "refreshTokenCifrado" TEXT NOT NULL,
    "historyId" TEXT,
    "conectadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Caixa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversa" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "assunto" TEXT NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'ABERTA',
    "responsavelId" TEXT,
    "ultimaMsgEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mensagem" (
    "id" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "messageIdRfc" TEXT NOT NULL,
    "de" TEXT NOT NULL,
    "para" TEXT[],
    "cc" TEXT[],
    "corpoTexto" TEXT,
    "corpoHtml" TEXT,
    "enviadaPorId" TEXT,
    "enviadaEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mensagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recebimento" (
    "mensagemId" TEXT NOT NULL,
    "caixaId" TEXT NOT NULL,
    "gmailMsgId" TEXT NOT NULL,
    "gmailThreadId" TEXT NOT NULL,

    CONSTRAINT "Recebimento_pkey" PRIMARY KEY ("mensagemId","caixaId")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cor" TEXT NOT NULL DEFAULT '#888888',

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversaTag" (
    "conversaId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "ConversaTag_pkey" PRIMARY KEY ("conversaId","tagId")
);

-- CreateTable
CREATE TABLE "Comentario" (
    "id" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "membroId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comentario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Filtro" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "tipo" "TipoFiltro" NOT NULL,
    "valor" TEXT NOT NULL,
    "acao" "AcaoFiltro" NOT NULL DEFAULT 'IGNORAR',
    "tagId" TEXT,

    CONSTRAINT "Filtro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Membro_email_key" ON "Membro"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Caixa_endereco_key" ON "Caixa"("endereco");

-- CreateIndex
CREATE INDEX "Conversa_workspaceId_ultimaMsgEm_idx" ON "Conversa"("workspaceId", "ultimaMsgEm");

-- CreateIndex
CREATE UNIQUE INDEX "Mensagem_messageIdRfc_key" ON "Mensagem"("messageIdRfc");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_workspaceId_nome_key" ON "Tag"("workspaceId", "nome");

-- AddForeignKey
ALTER TABLE "Membro" ADD CONSTRAINT "Membro_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Caixa" ADD CONSTRAINT "Caixa_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Caixa" ADD CONSTRAINT "Caixa_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "Membro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversa" ADD CONSTRAINT "Conversa_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversa" ADD CONSTRAINT "Conversa_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Membro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensagem" ADD CONSTRAINT "Mensagem_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "Conversa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensagem" ADD CONSTRAINT "Mensagem_enviadaPorId_fkey" FOREIGN KEY ("enviadaPorId") REFERENCES "Membro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recebimento" ADD CONSTRAINT "Recebimento_mensagemId_fkey" FOREIGN KEY ("mensagemId") REFERENCES "Mensagem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recebimento" ADD CONSTRAINT "Recebimento_caixaId_fkey" FOREIGN KEY ("caixaId") REFERENCES "Caixa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversaTag" ADD CONSTRAINT "ConversaTag_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "Conversa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversaTag" ADD CONSTRAINT "ConversaTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comentario" ADD CONSTRAINT "Comentario_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "Conversa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comentario" ADD CONSTRAINT "Comentario_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "Membro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Filtro" ADD CONSTRAINT "Filtro_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
