import "dotenv/config";
import pg from "pg";
import { createApp } from "./lib/api.js";

if (!process.env.DATABASE_URL)
  throw new Error(
    "Configure DATABASE_URL com a conexão PostgreSQL do Supabase. Consulte database/06-README.md.",
  );
const port = Number(process.env.PORT || 3000);
const databaseUrl = new URL(process.env.DATABASE_URL);
const allowUntrusted = process.env.ALLOW_UNTRUSTED_DB_CERT === "true" && process.env.NODE_ENV !== "production";
if (allowUntrusted) databaseUrl.searchParams.delete("sslmode");
const pool = new pg.Pool({
  connectionString: databaseUrl.toString(),
  max: 5,
  connectionTimeoutMillis: 10000,
  ...(allowUntrusted ? { ssl: { rejectUnauthorized: false } } : {}),
});
const app = createApp(pool, {
  origin: process.env.FRONTEND_URL || `http://localhost:${port}`,
  secure: process.env.NODE_ENV === "production",
});
const server = app.listen(port, () =>
  console.log(`PBT: http://localhost:${port}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.close(() => pool.end()));
