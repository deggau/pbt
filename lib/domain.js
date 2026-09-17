export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function check(condition, message, status = 400) {
  if (!condition) throw new HttpError(status, message);
}
export function fields(body, allowed) {
  check(
    body && typeof body === "object" && !Array.isArray(body),
    "Corpo inválido.",
  );
  check(
    Object.keys(body).every((key) => allowed.includes(key)),
    "Campo não permitido.",
  );
}
export function integer(value, name, min = 0, max = 2147483647) {
  check(
    Number.isInteger(value) && value >= min && value <= max,
    `${name}: informe um inteiro entre ${min} e ${max}.`,
  );
  return value;
}
export function label(value, name, max = 255) {
  check(
    typeof value === "string" &&
      value.trim().length > 0 &&
      value.trim().length <= max,
    `${name} inválido.`,
  );
  return value.trim();
}
export function timezone(value) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
  } catch {
    throw new HttpError(400, "Fuso horário inválido.");
  }
  return value;
}
export function localParts(instant, zone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(instant))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
// Resolve wall time against IANA rules; reject missing/ambiguous DST times.
export function localInstant(local, zone) {
  timezone(zone);
  check(
    typeof local === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local),
    "Informe data e horário.",
  );
  const wall = Date.parse(`${local}:00Z`);
  check(
    Number.isFinite(wall) &&
      new Date(wall).toISOString().slice(0, 16) === local,
    "Data inválida.",
  );
  const offsets = new Set();
  for (const hours of [-36, 0, 36]) {
    const sample = wall + hours * 3600000;
    offsets.add(Date.parse(`${localParts(sample, zone)}:00Z`) - sample);
  }
  const candidates = [...offsets]
    .map((offset) => wall - offset)
    .filter((t) => localParts(t, zone) === local);
  check(
    candidates.length === 1,
    "Horário inexistente ou ambíguo neste fuso; escolha outro horário.",
  );
  return new Date(candidates[0]).toISOString();
}
export function nextGame(reference, zone, now = new Date()) {
  if (!reference) return null;
  const local = localParts(reference.date, zone);
  const base = Date.parse(`${local}:00Z`);
  const today = Date.parse(`${localParts(now, zone)}:00Z`);
  const weeks = Math.max(1, Math.floor((today - base) / 604800000));
  let next = base + weeks * 604800000;
  for (let attempt = 0; attempt < 4; attempt++, next += 604800000) {
    const value = new Date(next).toISOString().slice(0, 16);
    try {
      if (new Date(localInstant(value, zone)) > now)
        return {
          local_date: value,
          location: reference.location,
          timezone: zone,
        };
    } catch (error) {
      if (!(error instanceof HttpError)) throw error;
    }
  }
  return null;
}
export function resultLine(row) {
  fields(row, [
    "id",
    "player_id",
    "invited_player_name",
    "team_id",
    "attended",
    "goals",
    "own_goals",
  ]);
  check(
    typeof row.attended === "boolean",
    "Informe presença efetiva para cada jogador.",
  );
  integer(row.goals, "Gols");
  integer(row.own_goals, "Gols contra");
  check(
    row.attended || (row.goals === 0 && row.own_goals === 0),
    "Jogador ausente não pode ter gols. Revise os valores sem descartá-los.",
  );
}
