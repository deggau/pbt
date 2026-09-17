import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { fixture, testServer, ids } from "./fixture.js";
let db, server, admin, member, outsider;
before(async () => {
  db = await fixture({ real: true });
  server = await testServer(db);
  admin = (
    await server.call("/api/auth/login", "POST", {
      email: "admin@test.local",
      password: "test-password",
    })
  ).cookie;
  member = (
    await server.call("/api/auth/login", "POST", {
      email: "member@test.local",
      password: "test-password",
    })
  ).cookie;
  outsider = (
    await server.call("/api/auth/login", "POST", {
      email: "outsider@test.local",
      password: "test-password",
    })
  ).cookie;
});
after(async () => {
  await server?.close();
  await db?.close();
});
const call = (path, method = "GET", body, cookie = admin) =>
  server.call(path, method, body, cookie);
const line = (id, player_id, goals = 0, own_goals = 0) => ({
  id,
  player_id,
  attended: true,
  goals,
  own_goals,
  team_id: ids.team,
});
const existing = () => [
  line(ids.historical, ids.player, 4, 1),
  {
    id: ids.guest,
    invited_player_name: "Convidado antigo",
    attended: true,
    goals: 2,
    own_goals: 0,
    team_id: ids.team,
  },
];

test("sessão obrigatória em todas as rotas antigas", async () => {
  for (const [path, method] of [
    ["/api/games", "GET"],
    ["/api/groups", "GET"],
    ["/api/players", "POST"],
    [`/api/teams/${ids.team}`, "DELETE"],
    [`/api/game_players/${ids.historical}`, "PUT"],
  ])
    assert.equal(
      (await server.call(path, method, method === "GET" ? undefined : {}))
        .status,
      401,
    );
});
test("grupos restritos; UUID de outra patota não concede acesso", async () => {
  const groups = await call("/api/groups", "GET", undefined, member);
  assert.deepEqual(
    groups.body.data.map((g) => g.id),
    [ids.group],
  );
  for (const path of [
    `/api/groups/${ids.other_group}`,
    `/api/games?group_id=${ids.other_group}`,
    `/api/players/${ids.foreign_player}`,
  ])
    assert.equal((await call(path, "GET", undefined, member)).status, 403);
  for (const path of [
    `/api/games/${ids.past}`,
    `/api/games/${ids.past}/players`,
    `/api/games/${ids.past}/teams`,
    `/api/game_players/${ids.historical}`,
  ])
    assert.equal((await call(path, "GET", undefined, outsider)).status, 403);
});
test("jogador só confirma a si; admin pode confirmar outro membro", async () => {
  const path = `/api/games/${ids.future}/confirmation`;
  assert.equal(
    (await call(path, "PUT", { confirmation: "yes" }, member)).status,
    200,
  );
  assert.equal(
    (
      await call(
        path,
        "PUT",
        { player_id: ids.other_player, confirmation: "yes" },
        member,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(path, "PUT", {
        player_id: ids.other_player,
        confirmation: "maybe",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call(path, "PUT", {
        player_id: ids.foreign_player,
        confirmation: "yes",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call(
        `/api/games/${ids.past}/confirmation`,
        "PUT",
        { confirmation: "yes" },
        member,
      )
    ).status,
    400,
  );
});
test("jogador não pode editar jogos, resultados, times ou campos de identidade", async () => {
  for (const [path, method, body] of [
    [`/api/games/${ids.past}`, "DELETE", {}],
    [
      "/api/games",
      "POST",
      {
        group_id: ids.group,
        opponent: "X",
        local_date: "2026-09-01T19:00",
        location: "X",
        teams_count: 2,
      },
    ],
    [
      `/api/games/${ids.past}/results`,
      "PUT",
      { version: 0, players: existing() },
    ],
    [`/api/teams/${ids.team}`, "PUT", { name: "X", color: "green" }],
    [
      "/api/players",
      "POST",
      { group_id: ids.group, name: "X", email: "a@a.com", phone: "1" },
    ],
  ])
    assert.equal((await call(path, method, body, member)).status, 403);
  assert.equal(
    (await call(`/api/games/${ids.past}`, "PUT", { group_id: ids.other_group }))
      .status,
    400,
  );
  assert.equal(
    (await call(`/api/game_players/${ids.historical}`, "PUT", { goals: 10 }))
      .status,
    400,
  );
  assert.equal(
    (await call(`/api/teams/${ids.team}`, "PUT", { game_id: ids.future }))
      .status,
    400,
  );
});
test("histórico preserva gols, convidados, times e presença desconhecida", async () => {
  const game = (await call(`/api/games/${ids.past}`)).body.data;
  assert.equal(game.players.length, 2);
  assert.equal(game.players.find((p) => p.id === ids.historical).goals, 4);
  assert.ok(
    game.players.every(
      (p) =>
        p.attended === null && p.confirmation === null && p.own_goals === 0,
    ),
  );
  assert.ok(game.players.every((p) => p.team_id === ids.team));
  const stats = (
    await call(`/api/groups/${ids.group}/stats?season_id=${game.season_id}`)
  ).body.data;
  assert.equal(stats.goals.length, 0);
  assert.equal(stats.unreviewed, 2);
});
test("falha numa linha reverte todo o resultado; versão não avança", async () => {
  const players = existing();
  players[0].goals = 8;
  players[1].own_goals = -1;
  assert.equal(
    (
      await call(`/api/games/${ids.past}/results`, "PUT", {
        version: 0,
        players,
      })
    ).status,
    400,
  );
  const game = (await call(`/api/games/${ids.past}`)).body.data;
  assert.equal(game.results_version, 0);
  assert.equal(game.players.find((p) => p.id === ids.historical).goals, 4);
  assert.equal(game.players[0].attended, null);
});
test("não aceita time de outro jogo, omissão de históricos ou ausência com gols", async () => {
  const players = existing();
  players[0].team_id = ids.foreign_team;
  assert.equal(
    (
      await call(`/api/games/${ids.past}/results`, "PUT", {
        version: 0,
        players,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call(`/api/games/${ids.past}/results`, "PUT", {
        version: 0,
        players: [existing()[0]],
      })
    ).status,
    400,
  );
  const absent = existing();
  absent[0].attended = false;
  assert.equal(
    (
      await call(`/api/games/${ids.past}/results`, "PUT", {
        version: 0,
        players: absent,
      })
    ).status,
    400,
  );
});
test("resultados atômicos, reenvio e edição concorrente detectados", async () => {
  const responses = await Promise.all([
    call(`/api/games/${ids.past}/results`, "PUT", {
      version: 0,
      players: existing(),
    }),
    call(`/api/games/${ids.past}/results`, "PUT", {
      version: 0,
      players: existing(),
    }),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
  assert.equal(
    (
      await call(`/api/games/${ids.past}/results`, "PUT", {
        version: 0,
        players: existing(),
      })
    ).status,
    409,
  );
});
test("4 feitos - 1 contra = saldo 3 e 3 presenças, futura não entra", async () => {
  for (const local_date of ["2026-01-04T19:00", "2026-01-11T19:00"]) {
    const game = (
      await call("/api/games", "POST", {
        group_id: ids.group,
        opponent: "Patota",
        local_date,
        location: "Quadra",
        teams_count: 2,
      })
    ).body.data;
    assert.equal(
      (
        await call(`/api/games/${game.id}/results`, "PUT", {
          version: 0,
          players: [
            { player_id: ids.player, attended: true, goals: 0, own_goals: 0 },
          ],
        })
      ).status,
      200,
    );
  }
  const season = (await call(`/api/groups/${ids.group}`)).body.data
    .current_season_id;
  const stats = (
    await call(`/api/groups/${ids.group}/stats?season_id=${season}`)
  ).body.data;
  assert.equal(stats.goals[0].balance, 3);
  assert.equal(stats.goals[0].goals, 4);
  assert.equal(stats.goals[0].own_goals, 1);
  assert.equal(stats.attendance[0].appearances, 3);
  const edited = existing();
  edited[0].goals = 0;
  edited[0].own_goals = 2;
  assert.equal(
    (
      await call(`/api/games/${ids.past}/results`, "PUT", {
        version: 1,
        players: edited,
      })
    ).status,
    200,
  );
  assert.equal(
    (await call(`/api/groups/${ids.group}/stats?season_id=${season}`)).body.data
      .goals[0].balance,
    -2,
  );
  assert.equal(
    (
      await call(`/api/games/${ids.future}/results`, "PUT", {
        version: 0,
        players: [],
      })
    ).status,
    400,
  );
});
test("temporadas são explícitas: criar/renomear não move jogos nem encerra atual", async () => {
  const group = (await call(`/api/groups/${ids.group}`)).body.data;
  const season = (
    await call(`/api/groups/${ids.group}/seasons`, "POST", {
      name: "Até o próximo campeonato",
    })
  ).body.data;
  assert.equal(
    (await call(`/api/groups/${ids.group}`)).body.data.current_season_id,
    group.current_season_id,
  );
  await call(`/api/seasons/${season.id}`, "PUT", {
    name: "Temporada especial",
  });
  await call(`/api/groups/${ids.group}/current-season`, "POST", {
    season_id: season.id,
    close_current: true,
  });
  assert.equal(
    (await call(`/api/games/${ids.past}`)).body.data.season_id,
    group.current_season_id,
  );
  const seasons = (await call(`/api/groups/${ids.group}/seasons`)).body.data;
  assert.ok(seasons.find((s) => s.id === group.current_season_id).closed_at);
  assert.equal(
    seasons.find((s) => s.id === season.id).name,
    "Temporada especial",
  );
});
test("sessão logout revoga, cookie HttpOnly e CSRF bloqueia origem estrangeira", async () => {
  const login = await fetch(server.base + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-PBT-Request": "1" },
    body: JSON.stringify({
      email: "admin@test.local",
      password: "test-password",
    }),
  });
  assert.match(login.headers.get("set-cookie"), /HttpOnly; SameSite=Strict/);
  const session = login.headers.get("set-cookie").split(";")[0];
  const bad = await fetch(server.base + "/api/groups", {
    method: "POST",
    headers: {
      Cookie: session,
      "Content-Type": "application/json",
      Origin: "https://evil.example",
      "X-PBT-Request": "1",
    },
    body: '{"name":"evil"}',
  });
  assert.equal(bad.status, 403);
  await call("/api/auth/logout", "POST", {}, session);
  assert.equal(
    (await call("/api/groups", "GET", undefined, session)).status,
    401,
  );
});
test("cadastro cria times em transação, conta e grupo não são controlados pelo cliente", async () => {
  const created = await call("/api/games", "POST", {
    group_id: ids.group,
    opponent: "Futuro",
    local_date: "2026-12-31T23:30",
    location: "Quadra",
    teams_count: 3,
  });
  assert.equal(created.status, 200);
  const game = created.body.data;
  assert.equal(new Date(game.date).toISOString(), "2027-01-01T02:30:00.000Z");
  assert.equal(game.created_by, ids.admin);
  const teams = (await call(`/api/games/${game.id}/teams`)).body.data;
  assert.equal(teams.length, 3);
  assert.equal(
    (await call(`/api/teams/${teams[0].id}`, "DELETE", {})).status,
    200,
  );
  assert.equal((await call(`/api/games/${game.id}`)).body.data.teams_count, 2);
  assert.equal(
    (await call(`/api/teams/${teams[1].id}`, "DELETE", {})).status,
    400,
  );
  const count = (await db.query("SELECT count(*)::int AS n FROM games")).rows[0]
    .n;
  assert.equal(
    (
      await call("/api/games", "POST", {
        group_id: ids.group,
        opponent: "X",
        local_date: "2026-02-30T19:00",
        location: "Q",
        teams_count: 3,
      })
    ).status,
    400,
  );
  assert.equal(
    (await db.query("SELECT count(*)::int AS n FROM games")).rows[0].n,
    count,
  );
  assert.equal(
    (
      await call("/api/groups", "POST", {
        name: "Impostor",
        user_id: ids.outsider,
      })
    ).status,
    400,
  );
});
test("login legado explicitamente habilitado migra hash sem alterar conta e sessão expira", async () => {
  await db.query(
    "UPDATE users SET password_scheme='legacy_plaintext',password_hash='legacy-test-password' WHERE id=$1",
    [ids.outsider],
  );
  const login = await call("/api/auth/login", "POST", {
    email: "outsider@test.local",
    password: "legacy-test-password",
  });
  assert.equal(login.status, 200);
  const user = (
    await db.query("SELECT * FROM users WHERE id=$1", [ids.outsider])
  ).rows[0];
  assert.equal(user.password_scheme, "scrypt");
  assert.match(user.password_hash, /^scrypt:/);
  assert.equal(user.player_id, ids.foreign_player);
  await db.query(
    "UPDATE sessions SET expires_at='2020-01-01' WHERE user_id=$1",
    [ids.outsider],
  );
  assert.equal(
    (await call("/api/groups", "GET", undefined, login.cookie)).status,
    401,
  );
});
