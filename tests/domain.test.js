import test from "node:test";
import assert from "node:assert/strict";
import {
  localInstant,
  localParts,
  nextGame,
  resultLine,
} from "../lib/domain.js";

test("sem referência não inventa agendamento", () =>
  assert.equal(nextGame(null, "America/Sao_Paulo"), null));
test("sugestão antiga avança semanas, preservando dia e horário local", () => {
  const value = nextGame(
    { date: "2020-01-01T22:00:00Z", location: "Quadra" },
    "America/Sao_Paulo",
    new Date("2026-09-16T23:00:00Z"),
  );
  assert.equal(value.local_date, "2026-09-23T19:00");
  assert.equal(value.location, "Quadra");
});
test("virada de ano e UTC não alteram dia local", () => {
  assert.equal(
    localInstant("2026-12-31T23:30", "America/Sao_Paulo"),
    "2027-01-01T02:30:00.000Z",
  );
  assert.equal(
    localParts("2027-01-01T02:30Z", "America/Sao_Paulo"),
    "2026-12-31T23:30",
  );
  assert.equal(
    nextGame(
      { date: "2026-12-31T22:00Z", location: "X" },
      "America/Sao_Paulo",
      new Date("2027-01-01T00:00Z"),
    ).local_date,
    "2027-01-07T19:00",
  );
});
test("sugestão no limite e virada de mês sempre é futura", () => {
  assert.equal(
    nextGame(
      { date: "2026-01-28T22:00Z", location: "X" },
      "America/Sao_Paulo",
      new Date("2026-02-04T22:00Z"),
    ).local_date,
    "2026-02-11T19:00",
  );
});
test("rejeita datas inválidas e horário ambíguo/inexistente de verão", () => {
  for (const value of ["2026-02-30T10:00", "2026-01-01", "garbage"])
    assert.throws(() => localInstant(value, "America/Sao_Paulo"));
  assert.throws(() => localInstant("2026-03-08T02:30", "America/New_York"));
  assert.throws(() => localInstant("2026-11-01T01:30", "America/New_York"));
});
test("zero, quatro e mais de cinco; ausência não pode descartar gols", () => {
  for (const goals of [0, 4, 8])
    resultLine({ attended: true, goals, own_goals: 1 });
  resultLine({ attended: false, goals: 0, own_goals: 0 });
  for (const goals of [-1, 1.5, "4", NaN])
    assert.throws(() => resultLine({ attended: true, goals, own_goals: 0 }));
  assert.throws(() => resultLine({ attended: false, goals: 4, own_goals: 0 }));
});
