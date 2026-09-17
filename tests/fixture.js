import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import { readFile } from "node:fs/promises";
import { createApp } from "../lib/api.js";
import { hashPassword } from "../lib/passwords.js";

export const ids = Object.fromEntries(
  [
    "admin",
    "member",
    "outsider",
    "player",
    "other_player",
    "foreign_player",
    "group",
    "other_group",
    "past",
    "future",
    "guest",
    "historical",
    "team",
    "foreign_team",
  ].map((key, index) => [
    key,
    `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  ]),
);
export async function fixture({ migrate = true, real = false } = {}) {
  let db;
  if (real && process.env.TEST_DATABASE_URL) {
    const url = new URL(process.env.TEST_DATABASE_URL);
    if (
      !["localhost", "127.0.0.1"].includes(url.hostname) ||
      url.pathname !== "/pbt_test"
    )
      throw new Error(
        "Testes SQL só podem usar localhost/pbt_test descartável.",
      );
    const pool = new pg.Pool({ connectionString: url.toString() });
    await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
    db = {
      query: (...args) => pool.query(...args),
      exec: (sql) => pool.query(sql),
      connect: () => pool.connect(),
      close: () => pool.end(),
    };
  } else {
    const engine = new PGlite();
    let pending = Promise.resolve();
    db = {
      query: (...args) => engine.query(...args),
      exec: (sql) => engine.exec(sql),
      close: () => engine.close(),
      connect: async () => {
        let release;
        const prior = pending;
        pending = new Promise((resolve) => {
          release = resolve;
        });
        await prior;
        return { query: (...args) => engine.query(...args), release };
      },
    };
  }
  await db.exec(
    await readFile(
      new URL("../database/create-tables.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      new URL("../migrations/04-add-teams-and-players.sql", import.meta.url),
      "utf8",
    ),
  );
  for (const [key, name] of [
    ["admin", "Administrador"],
    ["member", "Jogador"],
    ["outsider", "Outra patota"],
  ])
    await db.query(
      "INSERT INTO users(id,name,email,password_hash) VALUES($1,$2,$3,$4)",
      [ids[key], name, `${key}@test.local`, "test-password"],
    );
  for (const [key, name] of [
    ["player", "Ana"],
    ["other_player", "Bruno"],
    ["foreign_player", "Carlos"],
  ])
    await db.query(
      "INSERT INTO players(id,name,email,phone) VALUES($1,$2,$3,$4)",
      [ids[key], name, `${key}@test.local`, "11999999999"],
    );
  await db.query(
    "INSERT INTO groups(id,name,user_id) VALUES($1,$2,$3),($4,$5,$6)",
    [
      ids.group,
      "Patota teste",
      ids.admin,
      ids.other_group,
      "Privada",
      ids.outsider,
    ],
  );
  await db.query(
    "INSERT INTO group_players(group_id,player_id) VALUES($1,$2),($1,$3),($4,$5)",
    [
      ids.group,
      ids.player,
      ids.other_player,
      ids.other_group,
      ids.foreign_player,
    ],
  );
  for (const [key, date] of [
    ["past", "2025-12-28T22:00:00Z"],
    ["future", "2099-01-07T22:00:00Z"],
  ])
    await db.query(
      "INSERT INTO games(id,group_id,created_by,opponent,date,location) VALUES($1,$2,$3,$4,$5,$6)",
      [
        ids[key],
        ids.group,
        ids.admin,
        "Jogo da patota",
        date,
        "Quadra central",
      ],
    );
  await db.query(
    "INSERT INTO teams(id,game_id,name,color) VALUES($1,$2,$3,$4),($5,$6,$7,$8)",
    [
      ids.team,
      ids.past,
      "Verde",
      "#00ff00",
      ids.foreign_team,
      ids.future,
      "Azul",
      "#0000ff",
    ],
  );
  await db.query(
    "INSERT INTO game_players(id,game_id,player_id,goals,team_id) VALUES($1,$2,$3,4,$4)",
    [ids.historical, ids.past, ids.player, ids.team],
  );
  await db.query(
    "INSERT INTO game_players(id,game_id,invited_player_name,goals,team_id) VALUES($1,$2,$3,2,$4)",
    [ids.guest, ids.past, "Convidado antigo", ids.team],
  );
  if (migrate) {
    await db.exec(
      await readFile(
        new URL(
          "../migrations/06-presenca-resultados-mobile.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.query(
      "UPDATE users SET password_scheme='scrypt',password_hash=$1",
      [await hashPassword("test-password")],
    );
    await db.query("UPDATE users SET player_id=$1 WHERE id=$2", [
      ids.player,
      ids.member,
    ]);
    await db.query("UPDATE users SET player_id=$1 WHERE id=$2", [
      ids.foreign_player,
      ids.outsider,
    ]);
  }
  return db;
}
export async function testServer(db, fixedTime = "2026-09-16T12:00:00Z") {
  const app = createApp(db, { now: () => new Date(fixedTime) });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, method = "GET", body, cookie) => {
    const res = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-PBT-Request": "1",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return {
      status: res.status,
      body: await res.json(),
      cookie: res.headers.get("set-cookie")?.split(";")[0],
    };
  };
  return {
    base,
    call,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
