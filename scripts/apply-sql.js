import "dotenv/config";
import pg from "pg";
import { readFile } from "node:fs/promises";

const file = process.env.SQL_FILE;
if (!file || !process.env.DATABASE_URL) throw new Error("Defina SQL_FILE e DATABASE_URL.");
if (process.env.ALLOW_UNTRUSTED_DB_CERT !== "true") throw new Error("Para esta conexão, defina ALLOW_UNTRUSTED_DB_CERT=true explicitamente; prefira instalar a CA do Supabase depois.");
const url = new URL(process.env.DATABASE_URL);
url.searchParams.delete("sslmode");
const client = new pg.Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } });
try {
  await client.connect();
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(600006)");
  await client.query(await readFile(file, "utf8"));
  await client.query("COMMIT");
  console.log(`Aplicado: ${file}`);
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(`Falha em ${file}:`, error.code || error.message);
  process.exitCode = 1;
} finally { await client.end(); }
