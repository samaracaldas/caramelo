import type { NextConfig } from "next";

/**
 * A API mora no próprio Next (src/app/api), então não há proxy nem servidor separado
 * para acordar. O PGlite (Postgres em WASM, usado só em dev) fica fora do bundle.
 */
const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
