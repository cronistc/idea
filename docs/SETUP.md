# Como rodar

## 1. Criar o app OAuth no Google (uma vez, ~10 min)

Precisa ser feito com uma conta **administradora do Google Workspace** da empresa.

1. Acesse https://console.cloud.google.com e crie um projeto (ex.: "Caixa Compartilhada").
2. **APIs e serviços → Biblioteca**: ative a **Gmail API**.
3. **APIs e serviços → Tela de consentimento OAuth** (ou "Google Auth Platform"):
   - Tipo de usuário: **Interno**. Isso limita o app às contas da empresa e
     dispensa a verificação do Google. É o que deixa tudo gratuito.
   - Preencha nome do app e email de suporte.
   - Escopos: `openid`, `email`, `profile`, `gmail.readonly`, `gmail.send`.
4. **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth**:
   - Tipo: **Aplicativo da Web**
   - URI de redirecionamento autorizado: `http://localhost:3000/api/auth/callback`
     (quando publicar, adicione também `https://seu-endereco/api/auth/callback`)
   - Copie o **ID do cliente** e a **chave secreta**.

## 2. Rodar localmente

Requisitos: Node.js 20+ e Docker (para o banco).

```bash
cp .env.example .env          # preencha GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e DOMINIO_PERMITIDO
openssl rand -base64 32       # rode duas vezes: uma para SESSION_SECRET, outra para TOKEN_KEY
docker compose up -d          # sobe o PostgreSQL
npm install
npx prisma migrate deploy     # cria as tabelas
npm run dev                   # http://localhost:3000
```

## 3. Primeiro acesso

1. A **primeira pessoa** que entrar vira **administradora** e cria o workspace.
2. Em **Configurações**, escolha o modo:
   - **Caixa única com atendentes internos**: o admin clica em
     "Conectar caixa Gmail" e entra com a conta compartilhada (ex.: `contato@`).
     Os atendentes só fazem login.
   - **Várias contas que dividem uma caixa**: cada membro entra e conecta o
     próprio Gmail.
3. Os demais entram com "Entrar com Google" usando a conta da empresa.

Ao conectar uma caixa, o app traz os emails dos últimos 30 dias e depois
busca novos a cada minuto (ou na hora, pelo botão ⟳ no topo).

Os tokens de acesso ao Gmail ficam cifrados no banco com a `TOKEN_KEY`.
Guarde essa chave: se ela for perdida, as caixas precisam ser reconectadas.

## 4. Deixar rodando para a equipe

Para uso interno, o mais simples é um computador ou servidor da empresa
sempre ligado:

```bash
npm run build
npm start        # porta 3000
```

Se os outros acessarem por outro endereço (ex.: `http://192.168.0.10:3000` ou
um domínio), ajuste `APP_URL` no `.env` e adicione o mesmo endereço +
`/api/auth/callback` nas URIs de redirecionamento do Google Cloud. Fora da
rede local, use HTTPS.
