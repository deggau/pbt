import "dotenv/config";
import pg from "pg";
import { readFile } from "node:fs/promises";
import { applyMigration } from "../lib/migrations.js";

if (!process.env.DATABASE_URL)
  throw new Error("Configure DATABASE_URL em segredo.");
if (process.env.SCHEMA_REVIEWED !== "true" || !process.env.BACKUP_VERIFIED)
  throw new Error(
    "Exige SCHEMA_REVIEWED=true e BACKUP_VERIFIED com a referência do backup restaurado e conferido.",
  );
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  const name = "06-presenca-resultados-mobile.sql";
  const result = await applyMigration(
    client,
    name,
    await readFile(new URL(`../migrations/${name}`, import.meta.url), "utf8"),
  );
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error("Migração interrompida:", error.code || error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
