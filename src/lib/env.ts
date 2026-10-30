function obrigatoria(nome: string): string {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Variável de ambiente ${nome} não definida (veja .env.example)`);
  return valor;
}

export const env = {
  get appUrl() { return obrigatoria("APP_URL"); },
  get googleClientId() { return obrigatoria("GOOGLE_CLIENT_ID"); },
  get googleClientSecret() { return obrigatoria("GOOGLE_CLIENT_SECRET"); },
  get dominioPermitido() { return obrigatoria("DOMINIO_PERMITIDO").toLowerCase(); },
  get sessionSecret() { return obrigatoria("SESSION_SECRET"); },
  get tokenKey() { return obrigatoria("TOKEN_KEY"); },
};
