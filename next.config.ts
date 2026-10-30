import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Carregadas direto do node_modules em vez de empacotadas no servidor.
  serverExternalPackages: ["google-auth-library"],
  experimental: {
    // Permite anexos até o limite do Gmail (25 MB) nos formulários de envio.
    serverActions: { bodySizeLimit: "26mb" },
  },
};

export default nextConfig;
