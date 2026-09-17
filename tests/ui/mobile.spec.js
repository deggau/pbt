import { test, expect } from "@playwright/test";
const login = async (page, email) => {
  await page.goto("/");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("test-password");
  await page.getByLabel("Senha", { exact: true }).press("Enter");
  await expect(page.locator("#pageTitle")).toHaveText("Próxima partida");
};
test("mobile: confirmação flutuante e lista ordenada", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("pbtGames", '[{"legacy":true}]'),
  );
  await login(page, "member@test.local");
  await expect(page.getByRole("button", { name: "+ Nova patota" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Confirmar presença" }).click();
  await page.getByRole("button", { name: "Vou jogar" }).click();
  await expect(page.getByText("Sua confirmação: Vou jogar")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Já confirmaram" }),
  ).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("pbtGames"))).toBe(
    '[{"legacy":true}]',
  );
});
test("mobile: resultados e quarta bola idempotente", async ({ page }) => {
  await login(page, "admin@test.local");
  await page
    .getByRole("button", { name: "Registrar resultados", exact: true })
    .first()
    .click();
  const ana = page.getByRole("group", { name: "Ana", exact: true });
  await ana.getByLabel(/Presen/).selectOption("yes");
  await ana.getByRole("button", { name: "4 gols", exact: true }).click();
  await ana.getByRole("button", { name: "4 gols", exact: true }).click();
  await expect(ana.getByLabel("Gols", { exact: true })).toHaveValue("4");
  await ana.getByLabel("Gols", { exact: true }).fill("8");
  await ana.getByLabel("Gols contra").fill("1");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
test("mobile: falha de rede mantém modal e formulário", async ({ page }) => {
  await login(page, "admin@test.local");
  await page
    .getByRole("button", { name: "+ Agendar / registrar jogo" })
    .click();
  await page.getByLabel("Local", { exact: true }).fill("Quadra");
  await page.route("**/api/games", (route) => route.abort("failed"));
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Local", { exact: true })).toHaveValue("Quadra");
});
