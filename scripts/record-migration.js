import "dotenv/config";
import pg from "pg";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

if (!process.env.DATABASE_URL || process.env.ALLOW_UNTRUSTED_DB_CERT !== "true") throw new Error("Defina DATABASE_URL e ALLOW_UNTRUSTED_DB_CERT=true.");
const name = process.env.MIGRATION_NAME || "06-presenca-resultados-mobile.sql";
const file = await readFile(`migrations/${name}`, "utf8");
const checksum = createHash("sha256").update(file.replace(/\r\n/g, "\n")).digest("hex");
const url = new URL(process.env.DATABASE_URL); url.searchParams.delete("sslmode");
const client = new pg.Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } });
try {
  await client.connect();
  await client.query("CREATE TABLE IF NOT EXISTS public.pbt_migrations(name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())");
  await client.query("INSERT INTO public.pbt_migrations(name,checksum) VALUES($1,$2) ON CONFLICT (name) DO UPDATE SET checksum=EXCLUDED.checksum", [name, checksum]);
  console.log(`Ledger atualizado: ${name}`);
} finally { await client.end(); }
