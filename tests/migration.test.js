import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fixture, ids } from "./fixture.js";
import { hashPassword, verifyPassword } from "../lib/passwords.js";
import { applyMigration } from "../lib/migrations.js";
const sql = await readFile(
  new URL("../migrations/06-presenca-resultados-mobile.sql", import.meta.url),
  "utf8",
);
const tables = [
  "users",
  "players",
  "groups",
  "group_players",
  "games",
  "teams",
  "game_players",
];

test("migração preserva todos os campos antigos e vincula anos diferentes à mesma temporada", async () => {
  const db = await fixture({ migrate: false });
  try {
    const before = {};
    const columns = {};
    for (const table of tables) {
      columns[table] = (
        await db.query(
          "SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 ORDER BY ordinal_position",
          ["public", table],
        )
      ).rows
        .map((r) => `"${r.column_name}"`)
        .join(",");
      before[table] = (
        await db.query(`SELECT ${columns[table]} FROM ${table} ORDER BY id`)
      ).rows;
    }
    await db.exec(sql);
    for (const table of tables)
      assert.deepEqual(
        (await db.query(`SELECT ${columns[table]} FROM ${table} ORDER BY id`))
          .rows,
        before[table],
        table,
      );
    assert.equal(
      (
        await db.query(
          "SELECT DISTINCT season_id FROM games WHERE group_id=$1",
          [ids.group],
        )
      ).rows.length,
      1,
    );
    assert.equal(
      (
        await db.query(
          "SELECT DISTINCT attended,confirmation,own_goals FROM game_players",
        )
      ).rows[0].attended,
      null,
    );
    assert.equal(
      (await db.query("SELECT DISTINCT password_scheme FROM users")).rows[0]
        .password_scheme,
      "legacy_pending",
    );
  } finally {
    await db.close();
  }
});
test("duplicidade aborta sem apagar dados ou deixar alteração parcial", async () => {
  const db = await fixture({ migrate: false });
  try {
    await db.query(
      "INSERT INTO game_players(game_id,player_id,goals) VALUES($1,$2,3)",
      [ids.past, ids.player],
    );
    await assert.rejects(db.exec(sql), /duplicados/);
    await db.exec("ROLLBACK");
    assert.equal(
      (await db.query("SELECT count(*)::int AS n FROM game_players")).rows[0].n,
      3,
    );
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name='games' AND column_name='season_id'",
        )
      ).rows[0].n,
      0,
    );
  } finally {
    await db.close();
  }
});
test("RLS e grants bloqueiam acesso direto anon/authenticated mesmo com política antiga permissiva", async () => {
  const db = await fixture({ migrate: false });
  try {
    await db.exec(
      "CREATE ROLE anon; CREATE ROLE authenticated; GRANT USAGE ON SCHEMA public TO anon,authenticated; GRANT ALL ON ALL TABLES IN SCHEMA public TO anon,authenticated; GRANT SELECT(id,date) ON games TO anon,authenticated; ALTER TABLE games ENABLE ROW LEVEL SECURITY; CREATE POLICY old_open ON games FOR ALL USING (true) WITH CHECK (true);",
    );
    await db.exec(sql);
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`SET ROLE ${role}`);
      await assert.rejects(
        db.query("SELECT id,date FROM games"),
        /permission denied/,
      );
      await assert.rejects(
        db.query("SELECT * FROM games"),
        /permission denied/,
      );
      await assert.rejects(
        db.query("SELECT * FROM users"),
        /permission denied/,
      );
      await db.exec("RESET ROLE");
    }
  } finally {
    await db.close();
  }
});
test("RPC pública privilegiada bloqueia migração para exigir revisão", async () => {
  const db = await fixture({ migrate: false });
  try {
    await db.exec(
      "CREATE ROLE anon; CREATE FUNCTION public.leak_users() RETURNS SETOF users LANGUAGE sql SECURITY DEFINER AS 'SELECT * FROM users';",
    );
    await assert.rejects(db.exec(sql), /SECURITY DEFINER/);
    await db.exec("ROLLBACK");
  } finally {
    await db.close();
  }
});
test("senha legada exige classificação; scrypt verifica sem armazenar senha original", async () => {
  assert.equal(
    await verifyPassword("secret", {
      password_hash: "secret",
      password_scheme: "legacy_pending",
    }),
    false,
  );
  assert.equal(
    await verifyPassword("secret", {
      password_hash: "secret",
      password_scheme: "legacy_plaintext",
    }),
    true,
  );
  const hash = await hashPassword("secret");
  assert.notEqual(hash, "secret");
  assert.equal(
    await verifyPassword("secret", {
      password_hash: hash,
      password_scheme: "scrypt",
    }),
    true,
  );
  assert.equal(
    await verifyPassword("wrong", {
      password_hash: hash,
      password_scheme: "scrypt",
    }),
    false,
  );
});
test("runner registra checksum, não reaplica e rejeita mudança de migração aplicada", async () => {
  const db = await fixture({ migrate: false });
  const client = {
    query: async (sql, values) =>
      values ? db.query(sql, values) : (await db.exec(sql)).at(-1),
  };
  try {
    const result = await applyMigration(client, "06", sql);
    assert.equal(result.applied, true);
    assert.equal(
      result.preserved.find((t) => t.table === "game_players").count,
      2,
    );
    assert.equal((await applyMigration(client, "06", sql)).applied, false);
    await assert.rejects(
      applyMigration(client, "06", sql + "\n-- edit"),
      /já aplicada foi alterada/,
    );
    assert.equal(
      (await db.query("SELECT count(*)::int AS n FROM pbt_migrations")).rows[0]
        .n,
      1,
    );
  } finally {
    await db.close();
  }
});
