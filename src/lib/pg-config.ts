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
 * Why we strip `sslmode` from the URL: as of pg 8.18+, `sslmode=require` is treated as an
 * alias for `verify-full`, which verifies the CA chain — and DigitalOcean serves a
 * self-signed CA, so the connection fails with "self-signed certificate in certificate
 * chain". The URL's sslmode also overrides any explicit `ssl` we pass. So we drop sslmode
 * from the string and set SSL ourselves: full verification when a CA cert is provided,
 * otherwise encrypt-without-CA-verification (fine for a trusted 2-person tool).
 */
export function pgConfig(): PoolConfig {
  const rawUrl = process.env.DATABASE_URL;
  const caPath = process.env.DATABASE_CA_CERT;

  if (!rawUrl) return {};

  const wantsSsl = caPath != null || /[?&]sslmode=(require|verify-ca|verify-full|prefer)/.test(rawUrl);
  // Drop sslmode so it can't force verify-full and override our ssl config below.
  const connectionString = rawUrl.replace(/([?&])sslmode=[^&]*(&|$)/, (_m, pre: string, post: string) =>
    post === "&" ? pre : "",
  );

  let ssl: PoolConfig["ssl"];
  if (caPath) {
    ssl = { ca: fs.readFileSync(caPath, "utf8"), rejectUnauthorized: true };
  } else if (wantsSsl) {
    ssl = { rejectUnauthorized: false };
  }

  return { connectionString, ...(ssl ? { ssl } : {}) };
}
