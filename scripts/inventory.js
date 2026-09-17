import "dotenv/config";
import pg from "pg";
import { readFile, writeFile } from "node:fs/promises";
if (!process.env.DATABASE_URL)
  throw new Error("Configure DATABASE_URL em segredo.");
const inventoryUrl = new URL(process.env.DATABASE_URL);
if (process.env.INVENTORY_ALLOW_UNTRUSTED_CERT === "true") inventoryUrl.searchParams.delete("sslmode");
const client = new pg.Client({
  connectionString: inventoryUrl.toString(),
  ...(process.env.INVENTORY_ALLOW_UNTRUSTED_CERT === "true"
    ? { ssl: { rejectUnauthorized: false } }
    : {}),
});
try {
  await client.connect();
  await client.query("BEGIN READ ONLY");
  const result = await client.query(
    await readFile(
      new URL("../database/06-inventory.sql", import.meta.url),
      "utf8",
    ),
  );
  const output = process.env.INVENTORY_OUTPUT || "inventory.local.json";
  await writeFile(
    output,
    JSON.stringify(
      result.map((r) => r.rows),
      null,
      2,
    ),
  );
  await client.query("ROLLBACK");
  console.log(
    "Inventário salvo localmente. Revise antes de migrar; não publique o arquivo.",
  );
} catch (error) {
  console.error("Inventário falhou:", error.code || error.name);
  process.exitCode = 1;
} finally {
  await client.end();
}
