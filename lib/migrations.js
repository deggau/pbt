import { createHash } from "node:crypto";
const quote = (name) => `"${name.replaceAll('"', '""')}"`;
const tables = [
  "users",
  "players",
  "groups",
  "group_players",
  "games",
  "teams",
  "game_players",
];
const checksum = (value) => createHash("sha256").update(value).digest("hex");

export async function applyMigration(client, name, sql) {
  sql = sql.replace(/\r\n/g, "\n");
  await client.query("BEGIN");
  try {
    await client.query("SELECT pg_advisory_xact_lock(600006)");
    await client.query(
      "CREATE TABLE IF NOT EXISTS public.pbt_migrations(name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    await client.query(`DO $$ DECLARE role_name text; BEGIN
            ALTER TABLE public.pbt_migrations ENABLE ROW LEVEL SECURITY;
            REVOKE ALL ON TABLE public.pbt_migrations FROM PUBLIC;
            FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
                IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
                    EXECUTE format('REVOKE ALL ON TABLE public.pbt_migrations FROM %I',role_name);
                END IF;
            END LOOP;
        END $$`);
    const previous = (
      await client.query(
        "SELECT checksum FROM public.pbt_migrations WHERE name=$1",
        [name],
      )
    ).rows[0];
    const hash = checksum(sql);
    if (previous) {
      if (previous.checksum !== hash)
        throw new Error(
          "Migração já aplicada foi alterada. Crie uma nova migração.",
        );
      await client.query("COMMIT");
      return { applied: false };
    }
    // Freeze legacy writes while comparing exactly the pre-existing columns.
    await client.query(
      `LOCK TABLE ${tables.map((t) => `public.${quote(t)}`).join(",")} IN ACCESS EXCLUSIVE MODE`,
    );
    const snapshots = [];
    for (const table of tables) {
      const columns = (
        await client.query(
          "SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 ORDER BY ordinal_position",
          ["public", table],
        )
      ).rows.map((r) => quote(r.column_name));
      if (!columns.length)
        throw new Error(
          `Tabela ausente: ${table}. Inventário/revisão necessários.`,
        );
      const select = `SELECT ${columns.join(",")} FROM public.${quote(table)} ORDER BY id`;
      const rows = (await client.query(select)).rows;
      snapshots.push({
        table,
        select,
        count: rows.length,
        hash: checksum(JSON.stringify(rows)),
      });
    }
    // The SQL file remains runnable alone; this runner owns the transaction and ledger.
    const body = sql.replace(/^BEGIN;\s*$/m, "").replace(/^COMMIT;\s*$/m, "");
    await client.query(body);
    for (const before of snapshots) {
      const after = (await client.query(before.select)).rows;
      if (checksum(JSON.stringify(after)) !== before.hash)
        throw new Error(
          `Histórico alterado em ${before.table}; rollback realizado.`,
        );
    }
    await client.query(
      "INSERT INTO public.pbt_migrations(name,checksum) VALUES($1,$2)",
      [name, hash],
    );
    await client.query("COMMIT");
    return {
      applied: true,
      preserved: snapshots.map(({ table, count }) => ({ table, count })),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}
