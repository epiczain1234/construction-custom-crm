import fs from "node:fs";
import type { PoolConfig } from "pg";

/**
 * Build the node-postgres connection config from env, handling SSL for managed
 * Postgres providers (DigitalOcean, Neon, etc.).
 *
 * - DATABASE_URL: the connection string (DigitalOcean uses port 25060 + sslmode=require).
 * - DATABASE_CA_CERT (optional): path to the provider's CA cert (DigitalOcean offers a
 *   downloadable `ca-certificate.crt`). If set, the cert chain is fully verified.
 *
 * If no CA cert is provided but the URL requests SSL, we still encrypt the
 * connection but skip CA verification — fine for a trusted 2-person tool, and it
 * avoids the "self-signed certificate in certificate chain" error DigitalOcean
 * throws against Node's default trust store.
 */
export function pgConfig(): PoolConfig {
  const connectionString = process.env.DATABASE_URL;
  const caPath = process.env.DATABASE_CA_CERT;

  let ssl: PoolConfig["ssl"];
  if (caPath) {
    ssl = { ca: fs.readFileSync(caPath, "utf8"), rejectUnauthorized: true };
  } else if (connectionString && /sslmode=(require|verify-ca|verify-full|prefer)/.test(connectionString)) {
    ssl = { rejectUnauthorized: false };
  }

  return { connectionString, ...(ssl ? { ssl } : {}) };
}
