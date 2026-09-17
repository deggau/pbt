import { localParts, resultLine } from "./lib/domain.js";
const $ = (id) => document.getElementById(id);
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const field = (name, title, value = "", type = "text", extra = "") =>
  `<div class="form-group"><label for="${name}">${title}</label><input id="${name}" name="${name}" type="${type}" value="${escape(value)}" ${extra}></div>`;
const button = (action, text, id = "") =>
  `<button type="button" data-action="${action}" data-id="${escape(id)}">${text}</button>`;

export class GameRegistry {
  constructor(user, api) {
    this.user = user;
    this.api = api;
    this.groups = [];
    this.generation = 0;
  }
  async init() {
    $("createGroupBtn").onclick = () => this.createGroup();
    $("logoutBtn").onclick = () =>
      this.run(async () => {
        await this.api("/auth/logout", "POST", {});
        location.reload();
      });
    $("exportLocalBtn").onclick = () => this.exportLocal();
    $("menuToggle").onclick = () => {
      const open = document.body.classList.toggle("menu-open");
      $("menuToggle").setAttribute("aria-expanded", String(open));
    };
    $("confirmFab").onclick = () => this.confirmMenu();
    $("retryBtn").onclick = () => this.run(() => this.loadGroups());
    $("closeEditor").onclick = () => $("editorDialog").close();
    $("editorForm").onsubmit = (event) => this.save(event);
    $("mainContent").onclick = (event) => {
      const target = event.target.closest("[data-action]");
      if (target)
        this.run(
          () => this.action(target.dataset.action, target.dataset.id),
          target,
        );
    };
    $("groupsList").onclick = (event) => {
      const target = event.target.closest("[data-group]");
      if (target) this.run(() => this.selectGroup(target.dataset.group));
    };
    $("editorBody").onclick = (event) => {
      const actionTarget = event.target.closest("[data-action]");
      if (actionTarget)
        this.run(
          () =>
            this.action(actionTarget.dataset.action, actionTarget.dataset.id),
          actionTarget,
        );
      const ball = event.target.closest("[data-goals]");
      if (ball) {
        const card = ball.closest("[data-result]");
        card.querySelector('[name="goals"]').value = ball.dataset.goals;
        this.paintGoals(card);
      }
      if (event.target.closest("[data-add-guest]")) {
        const name = $("guestName").value.trim();
        if (!name) return;
        this.resultRows.push({
          invited_player_name: name,
          goals: 0,
          own_goals: 0,
          attended: null,
        });
        $("resultRows").insertAdjacentHTML(
          "beforeend",
          this.resultCard(this.resultRows.at(-1), this.resultRows.length - 1),
        );
        $("guestName").value = "";
      }
    };
    $("editorBody").oninput = (event) => {
      if (event.target.name === "goals")
        this.paintGoals(event.target.closest("[data-result]"));
    };
    await this.run(() => this.loadGroups());
  }
  async run(work, element) {
    if (element) element.disabled = true;
    $("appStatus").textContent = "Carregando…";
    $("retryBtn").hidden = true;
    try {
      await work();
      $("appStatus").textContent = "";
    } catch (error) {
      $("appStatus").textContent = error.message;
      $("retryBtn").hidden = false;
    } finally {
      if (element?.isConnected) element.disabled = false;
    }
  }
  async loadGroups(preferred) {
    this.groups = await this.api("/groups");
    if (!this.groups.length) {
      $("mainContent").innerHTML =
        '<section class="screen-section"><h2>Sua patota começa aqui</h2><p>Crie uma patota ou solicite ao administrador o vínculo da sua conta com seu jogador.</p></section>';
      return;
    }
    const selected =
      preferred ||
      this.group?.id ||
      new URLSearchParams(location.search).get("group");
    await this.selectGroup(
      this.groups.find((g) => g.id === selected)?.id || this.groups[0].id,
    );
  }
  async selectGroup(id, season_id) {
    const generation = ++this.generation;
    document.body.classList.remove("menu-open");
    $("menuToggle")?.setAttribute("aria-expanded", "false");
    $("mainContent").innerHTML =
      '<section class="screen-section">Carregando patota…</section>';
    const [group, seasons, games] = await Promise.all([
      this.api(`/groups/${id}`),
      this.api(`/groups/${id}/seasons`),
      this.api(`/games?group_id=${id}`),
    ]);
    if (generation !== this.generation) return;
    this.group = group;
    this.seasons = seasons;
    this.games = games;
    this.season_id = season_id || group.current_season_id;
    this.stats = await this.api(
      `/groups/${id}/stats?season_id=${this.season_id}`,
    );
    if (generation !== this.generation) return;
    this.next = [...games]
      .filter((g) => new Date(g.date) > new Date())
      .sort((a, b) => new Date(a.date) - new Date(b.date))[0];
    this.nextDetails = this.next
      ? await this.api(`/games/${this.next.id}`)
      : null;
    if (generation !== this.generation) return;
    this.render();
  }
  date(game) {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: this.group.timezone,
      dateStyle: "full",
      timeStyle: "short",
    }).format(new Date(game.date));
  }
  render() {
    $("pageTitle").textContent = "Próxima partida";
    $("groupsList").innerHTML = this.groups
      .map(
        (g) =>
          `<button class="group-item ${g.id === this.group.id ? "active" : ""}" data-group="${g.id}">${escape(g.name)}</button>`,
      )
      .join("");
    const admin = this.group.is_admin;
    const season = this.seasons.find((s) => s.id === this.season_id);
    const own = this.nextDetails?.players.find(
      (p) => p.player_id === this.user.player_id,
    );
    const eligible = this.group.group_players.some(
      (p) => p.player_id === this.user.player_id,
    );
    const upcoming = this.next
      ? `<h3>${escape(this.next.opponent)} ${admin ? button("options", "⋮", this.next.id) : ""}</h3><p>${escape(this.date(this.next))}</p><p>${escape(this.next.location)}</p><p>Fuso: ${escape(this.group.timezone)}</p>
            ${eligible ? `<p>Sua confirmação: ${{ yes: "Vou jogar", no: "Não vou", maybe: "Em dúvida" }[own?.confirmation] || "Ainda não respondida"}</p>` : "<p>Solicite ao administrador o vínculo da sua conta para confirmar presença.</p>"}
            ${this.attendanceMarkup(this.nextDetails?.players || [])}`
      : "<p>Nenhum jogo futuro agendado.</p>";
    const history = this.games.filter((g) => g.season_id === this.season_id);
    $("mainContent").innerHTML =
      `<section class="screen-section"><h2>Próxima partida</h2>${upcoming}</section>
            <nav class="quick-nav" aria-label="Navegação"><a href="#history">Histórico</a><a href="#stats">Estatísticas</a>${admin ? button("new-game", "+ Agendar / registrar jogo") + button("members", "Jogadores") : ""}</nav>
            <section class="screen-section season-bar"><label for="seasonSelect">Temporada</label><select id="seasonSelect">${this.seasons.map((s) => `<option value="${s.id}" ${s.id === this.season_id ? "selected" : ""}>${escape(s.name)}${s.closed_at ? " (encerrada)" : ""}${s.id === this.group.current_season_id ? " · atual" : ""}</option>`).join("")}</select>
            ${admin ? button("new-season", "+", "") + button("rename-season", "Renomear") + (season && !season.closed_at && season.id !== this.group.current_season_id ? button("activate-season", "Usar como atual") : "") : ""}</section>
            <section class="screen-section" id="history"><h2>Jogos · ${escape(season?.name)}</h2><div id="gamesContainer">${history.map((g) => `<article class="game-card"><h3>${escape(g.opponent)}</h3><p>${escape(this.date(g))}</p><p>${escape(g.location)}${g.score ? ` · Placar: ${escape(g.score)}` : ""}</p><div class="action-row">${button("details", "Detalhes", g.id)}${admin ? (new Date(g.date) <= new Date() ? button("results", "Registrar resultados", g.id) : "") + button("edit-game", "Editar", g.id) + button("delete-game", "Excluir", g.id) : ""}</div></article>`).join("") || "<p>Nenhum jogo nesta temporada.</p>"}</div></section>
            <section class="screen-section" id="stats"><h2>Estatísticas · ${escape(season?.name)}</h2><p>Somente presenças efetivas em partidas realizadas. Convidados permanecem no histórico de cada jogo.</p>${this.stats.unreviewed ? `<p>${this.stats.unreviewed} registro(s) com presença ainda não revisada, fora dos indicadores.</p>` : ""}
            <h3>Saldo de gols</h3>${this.ranking(this.stats.goals, false)}<h3>Participações</h3>${this.ranking(this.stats.attendance, true)}</section>`;
    $("seasonSelect").onchange = (event) =>
      this.run(() => this.selectGroup(this.group.id, event.target.value));
    const plus = document.querySelector('[data-action="new-season"]');
    if (plus) plus.setAttribute("aria-label", "Criar temporada");
    $("confirmFab").hidden = !(this.next && eligible);
  }
  attendanceMarkup(players) {
    const groups = [
      ["yes", "Já confirmaram"],
      ["no", "Não vão"],
      ["maybe", "Em dúvida / sem resposta"],
    ];
    return `<div class="attendance-list">${groups
      .map(
        ([status, title]) =>
          `<h3>${title}</h3><ul>${
            players
              .filter((p) => (p.confirmation || "maybe") === status)
              .map(
                (p) =>
                  `<li>${escape(p.name || p.invited_player_name || "Jogador")}</li>`,
              )
              .join("") || "<li>Ninguém ainda</li>"
          }</ul>`,
      )
      .join("")}</div>`;
  }
  confirmMenu() {
    this.editor(
      "Confirmar presença",
      '<p>Escolha uma opção:</p><div class="confirm-options"><button type="button" class="confirm-yes" data-confirm-choice="yes" aria-label="Vou jogar">👍</button><button type="button" class="confirm-no" data-confirm-choice="no" aria-label="Não vou">👎</button></div>',
      null,
    );
    $("editorBody")
      .querySelectorAll("[data-confirm-choice]")
      .forEach(
        (el) =>
          (el.onclick = async () => {
            await this.run(async () => {
              await this.api(`/games/${this.next.id}/confirmation`, "PUT", {
                confirmation: el.dataset.confirmChoice,
              });
              $("editorDialog").close();
              await this.selectGroup(this.group.id, this.season_id);
            });
          }),
      );
  }
  ranking(rows, attendance) {
    return rows.length
      ? `<ol class="ranking">${rows.map((p) => `<li><span>${escape(p.name)}</span><strong>${attendance ? `${p.appearances} presença(s)` : `${p.balance} (${p.goals} feitos − ${p.own_goals} contra)`}</strong></li>`).join("")}</ol>`
      : "<p>Ainda não há resultados revisados.</p>";
  }
  async action(action, id) {
    if (action === "options") return this.adminOptions(id);
    if (action === "draw-teams") return this.drawTeams(id);
    if (["yes", "no", "maybe"].includes(action)) {
      await this.api(`/games/${this.next.id}/confirmation`, "PUT", {
        confirmation: action,
      });
      return this.selectGroup(this.group.id, this.season_id);
    }
    if (action === "new-game" || action === "edit-game")
      return this.editGame(id);
    if (action === "results") return this.results(id);
    if (action === "details") return this.details(id);
    if (action === "members") return this.members();
    if (action === "new-season" || action === "rename-season") {
      const existing = this.seasons.find((s) => s.id === this.season_id);
      this.editor(
        action === "new-season" ? "Nova temporada" : "Renomear temporada",
        field(
          "name",
          "Nome",
          action === "new-season" ? new Date().getFullYear() : existing.name,
          "text",
          'required maxlength="255"',
        ),
        async (form) => {
          await this.api(
            action === "new-season"
              ? `/groups/${this.group.id}/seasons`
              : `/seasons/${existing.id}`,
            action === "new-season" ? "POST" : "PUT",
            { name: form.get("name") },
          );
        },
      );
      return;
    }
    if (action === "activate-season") {
      this.editor(
        "Trocar temporada atual",
        '<p>Os jogos antigos permanecem na temporada original.</p><label><input type="checkbox" name="close_current"> Encerrar também a temporada atual</label>',
        async (form) => {
          await this.api(`/groups/${this.group.id}/current-season`, "POST", {
            season_id: this.season_id,
            close_current: form.has("close_current"),
          });
        },
      );
      return;
    }
    if (action === "delete-game") {
      this.editor(
        "Excluir jogo",
        "<p>Esta ação exclui o jogo, seus times e resultados. Confirme para continuar.</p>",
        () => this.api(`/games/${id}`, "DELETE", {}),
      );
    }
  }
  async adminOptions(gameId) {
    if (!this.group.is_admin) return;
    this.editor(
      "Opções da partida",
      `<div class="action-row">${button("draw-teams", "Sortear times", gameId)}</div><p>O sorteio usa somente jogadores confirmados. Depois você pode mover jogadores entre os times.</p>`,
      null,
    );
  }
  async drawTeams(gameId) {
    const game = await this.api(`/games/${gameId}`);
    const players = game.players.filter(
      (p) => p.player_id && p.confirmation === "yes",
    );
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const assignments = shuffled.map((p, index) => ({
      p,
      team: game.teams[index % game.teams.length],
    }));
    for (const { p, team } of assignments)
      await this.api(`/game_players/${p.id}`, "PUT", { team_id: team.id });
    await this.teamEditor(gameId);
  }
  async teamEditor(gameId) {
    const game = await this.api(`/games/${gameId}`);
    const players = game.players.filter(
      (p) => p.player_id && p.confirmation === "yes",
    );
    this.editor(
      "Times sorteados",
      `<p>Arraste um jogador para outro time. A alteração é salva imediatamente.</p><div class="draw-list">${game.teams
        .map(
          (team) =>
            `<section class="draw-team" data-team="${team.id}"><h3>${escape(team.name)}</h3>${players
              .filter((p) => p.team_id === team.id)
              .map(
                (p) =>
                  `<div class="draw-player" draggable="true" data-player="${p.id}">${escape(p.name || p.invited_player_name)}</div>`,
              )
              .join("")}</section>`,
        )
        .join("")}</div>`,
      null,
    );
    const body = $("editorBody");
    body.querySelectorAll(".draw-player").forEach((player) => {
      player.addEventListener("dragstart", (event) =>
        event.dataTransfer.setData("text/plain", player.dataset.player),
      );
    });
    body.querySelectorAll(".draw-team").forEach((team) => {
      team.addEventListener("dragover", (event) => event.preventDefault());
      team.addEventListener("drop", async (event) => {
        event.preventDefault();
        const playerId = event.dataTransfer.getData("text/plain");
        const player = body.querySelector(`[data-player="${playerId}"]`);
        if (!player) return;
        team.appendChild(player);
        await this.detailSave(team, () =>
          this.api(`/game_players/${playerId}`, "PUT", {
            team_id: team.dataset.team,
          }),
        );
      });
    });
  }
  editor(title, html, save) {
    $("editorTitle").textContent = title;
    $("editorBody").innerHTML = html;
    $("editorStatus").textContent = "";
    $("saveEditor").hidden = !save;
    this.onSave = save;
    if (!$("editorDialog").open) $("editorDialog").showModal();
    (
      $("editorBody").querySelector("input,select,button") || $("closeEditor")
    ).focus();
  }
  async save(event) {
    event.preventDefault();
    if (!this.onSave || this.saving) return;
    const form = new FormData($("editorForm"));
    const controls = [
      ...$("editorForm").querySelectorAll("input,select,button"),
    ].map((element) => ({ element, disabled: element.disabled }));
    controls.forEach(({ element }) => {
      element.disabled = true;
    });
    this.saving = true;
    $("saveEditor").disabled = true;
    $("closeEditor").disabled = true;
    $("editorStatus").textContent = "Salvando…";
    const preventClose = (event) => event.preventDefault();
    $("editorDialog").addEventListener("cancel", preventClose);
    try {
      await this.onSave(form);
      $("editorDialog").close();
      await this.run(() => this.loadGroups());
    } catch (error) {
      $("editorStatus").textContent = error.message;
    } finally {
      this.saving = false;
      controls.forEach(({ element, disabled }) => {
        element.disabled = disabled;
      });
      $("saveEditor").disabled = false;
      $("closeEditor").disabled = false;
      $("editorDialog").removeEventListener("cancel", preventClose);
    }
  }
  createGroup() {
    this.editor(
      "Nova patota",
      field("name", "Nome", "", "text", 'required maxlength="255"') +
        field(
          "timezone",
          "Fuso horário",
          "America/Sao_Paulo",
          "text",
          "required",
        ),
      async (form) => {
        const group = await this.api("/groups", "POST", {
          name: form.get("name"),
          timezone: form.get("timezone"),
        });
        this.group = group;
      },
    );
  }
  async editGame(id) {
    const game = id ? await this.api(`/games/${id}`) : null;
    const suggestion = game
      ? null
      : await this.api(`/groups/${this.group.id}/suggestion`);
    const local = game
      ? localParts(game.date, this.group.timezone)
      : suggestion?.local_date || "";
    this.editor(
      game ? "Editar jogo" : "Agendar ou registrar jogo",
      `<p>Fuso: ${escape(this.group.timezone)}. ${suggestion ? "Sugestão baseada no último jogo; revise antes de salvar." : "Informe data, horário e local."}</p>` +
        field(
          "opponent",
          "Adversário / identificação",
          game?.opponent || "Jogo da patota",
          "text",
          'required maxlength="255"',
        ) +
        field(
          "local_date",
          "Data e horário",
          local,
          "datetime-local",
          "required",
        ) +
        field(
          "location",
          "Local",
          game?.location || suggestion?.location || "",
          "text",
          'required maxlength="255"',
        ) +
        (game
          ? ""
          : field(
              "teams_count",
              "Número de times",
              2,
              "number",
              'min="2" max="10" step="1" required',
            )),
      (form) =>
        this.api(game ? `/games/${id}` : "/games", game ? "PUT" : "POST", {
          opponent: form.get("opponent"),
          local_date: form.get("local_date"),
          location: form.get("location"),
          ...(game
            ? {}
            : {
                group_id: this.group.id,
                teams_count: Number(form.get("teams_count")),
              }),
        }),
    );
  }
  async members() {
    this.editor(
      "Jogadores da patota",
      `<ul>${this.group.group_players.map((p) => `<li>${escape(p.name)}</li>`).join("")}</ul><h3>Adicionar jogador</h3>` +
        field("name", "Nome", "", "text", "required") +
        field("email", "E-mail", "", "email", "required") +
        field("phone", "Telefone", "", "tel", 'required maxlength="20"'),
      (form) =>
        this.api("/players", "POST", {
          group_id: this.group.id,
          name: form.get("name"),
          email: form.get("email"),
          phone: form.get("phone"),
        }),
    );
  }
  async details(id) {
    const game = await this.api(`/games/${id}`);
    const future = new Date(game.date) > new Date();
    const admin = this.group.is_admin;
    const players = [...game.players];
    if (future)
      for (const member of this.group.group_players)
        if (!players.some((p) => p.player_id === member.player_id))
          players.push({ ...member, id: null });
    this.editor(
      "Jogadores e times",
      `<p>${escape(this.date(game))} · ${escape(game.location)}</p>${
        players
          .map(
            (
              p,
              index,
            ) => `<div class="detail-player"><strong>${escape(p.name || p.invited_player_name)}</strong><p>${future ? `Confirmação: ${{ yes: "Vai jogar", no: "Não vai", maybe: "Talvez" }[p.confirmation] || "Não informada"}` : `Presença: ${p.attended === null ? "Não revisada" : p.attended ? "Sim" : "Não"} · Gols: ${p.goals || 0} · Contra: ${p.own_goals || 0}`}</p>
            ${future && admin && p.player_id ? `<label>Confirmação<select data-confirm="${p.player_id}"><option value="">Não informada</option>${["yes", "no", "maybe"].map((v, i) => `<option value="${v}" ${v === p.confirmation ? "selected" : ""}>${["Vai jogar", "Não vai", "Talvez"][i]}</option>`).join("")}</select></label>` : ""}
            ${future && admin ? `<label>Time<select data-team-index="${index}"><option value="">Sem time</option>${game.teams.map((t) => `<option value="${t.id}" ${t.id === p.team_id ? "selected" : ""}>${escape(t.name)}</option>`).join("")}</select></label>` : `<p>Time: ${escape(game.teams.find((t) => t.id === p.team_id)?.name || "Sem time")}</p>`}</div>`,
          )
          .join("") || "<p>Nenhum jogador registrado.</p>"
      }`,
      null,
    );
    $("editorBody")
      .querySelectorAll("select")
      .forEach((select) => {
        select.dataset.savedValue = select.value;
      });
    $("editorBody")
      .querySelectorAll("[data-confirm]")
      .forEach(
        (select) =>
          (select.onchange = () =>
            this.detailSave(select, async () => {
              if (!select.value) throw new Error("Escolha uma confirmação.");
              const saved = await this.api(`/games/${id}/confirmation`, "PUT", {
                player_id: select.dataset.confirm,
                confirmation: select.value,
              });
              Object.assign(
                players.find((p) => p.player_id === select.dataset.confirm),
                saved,
              );
            })),
      );
    $("editorBody")
      .querySelectorAll("[data-team-index]")
      .forEach(
        (select) =>
          (select.onchange = () =>
            this.detailSave(select, async () => {
              const p = players[Number(select.dataset.teamIndex)];
              const saved = await this.api(
                p.id ? `/game_players/${p.id}` : "/game_players",
                p.id ? "PUT" : "POST",
                {
                  team_id: select.value || null,
                  ...(p.id ? {} : { game_id: id, player_id: p.player_id }),
                },
              );
              Object.assign(p, saved);
            })),
      );
    $("editorDialog").onclose = () => {
      $("editorDialog").onclose = null;
      this.run(() => this.selectGroup(this.group.id, this.season_id));
    };
  }
  async detailSave(select, work) {
    const previous = select.dataset.savedValue ?? "";
    select.disabled = true;
    $("editorStatus").textContent = "Salvando…";
    try {
      await work();
      select.dataset.savedValue = select.value;
      $("editorStatus").textContent = "Salvo.";
    } catch (error) {
      select.value = previous;
      $("editorStatus").textContent = error.message;
    } finally {
      select.disabled = false;
    }
  }
  async results(id) {
    this.resultGame = await this.api(`/games/${id}`);
    this.resultRows = [...this.resultGame.players];
    for (const player of this.group.group_players)
      if (!this.resultRows.some((p) => p.player_id === player.player_id))
        this.resultRows.push({
          player_id: player.player_id,
          name: player.name,
          goals: 0,
          own_goals: 0,
          attended: null,
        });
    this.editor(
      "Registrar resultados",
      `<p>Escolha a presença de cada jogador. Cada bola define o total exato de gols. Os números permitem valores acima de cinco.</p>${field("score", "Placar (opcional)", this.resultGame.score || "", "text", 'maxlength="50"')}<div id="resultRows">${this.resultRows.map((p, i) => this.resultCard(p, i)).join("")}</div><div class="guest-controls">${field("guestName", "Nome do convidado", "", "text", 'maxlength="255"')}<button type="button" data-add-guest>+ Convidado</button></div>`,
      async (form) => {
        const players = [
          ...$("editorBody").querySelectorAll("[data-result]"),
        ].map((card) => {
          const old = this.resultRows[Number(card.dataset.result)];
          const row = {
            ...(old.id ? { id: old.id } : {}),
            player_id: old.player_id || null,
            invited_player_name: old.invited_player_name || null,
            team_id: card.querySelector('[name="team_id"]').value || null,
            attended: card.querySelector('[name="attended"]').value === "yes",
            goals: Number(card.querySelector('[name="goals"]').value),
            own_goals: Number(card.querySelector('[name="own_goals"]').value),
          };
          resultLine(row);
          return row;
        });
        await this.api(`/games/${id}/results`, "PUT", {
          version: this.resultGame.results_version,
          score: form.get("score"),
          players,
        });
      },
    );
  }
  resultCard(player, index) {
    return `<fieldset class="result-player" data-result="${index}"><legend>${escape(player.name || player.invited_player_name)}</legend><label>Presença efetiva<select name="attended" required><option value="">Revisar presença</option><option value="yes" ${player.attended === true ? "selected" : ""}>Presente</option><option value="no" ${player.attended === false ? "selected" : ""}>Ausente</option></select></label>
            <div class="goal-balls" role="group" aria-label="Total de gols de ${escape(player.name || player.invited_player_name)}">${[0, 1, 2, 3, 4, 5].map((n) => `<button type="button" data-goals="${n}" aria-label="${n} gols" aria-pressed="${player.goals === n}">${n === 0 ? "0" : "⚽"}</button>`).join("")}</div>
            <div class="result-numbers"><label>Gols<input name="goals" type="number" min="0" max="2147483647" step="1" required value="${player.goals || 0}"></label><label>Gols contra<input name="own_goals" type="number" min="0" max="2147483647" step="1" required value="${player.own_goals || 0}"></label></div>
            <label>Time<select name="team_id"><option value="">Sem time</option>${this.resultGame.teams.map((t) => `<option value="${t.id}" ${player.team_id === t.id ? "selected" : ""}>${escape(t.name)}</option>`).join("")}</select></label></fieldset>`;
  }
  paintGoals(card) {
    const value = Number(card.querySelector('[name="goals"]').value);
    card
      .querySelectorAll("[data-goals]")
      .forEach((b) =>
        b.setAttribute("aria-pressed", Number(b.dataset.goals) === value),
      );
  }
  exportLocal() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith("pbt")) data[key] = localStorage.getItem(key);
    }
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "pbt-dados-locais.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
