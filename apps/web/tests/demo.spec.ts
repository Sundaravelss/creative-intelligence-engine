import { expect, test } from "@playwright/test";

/**
 * WS-H smoke suite.
 *
 * Two surfaces, two assertions each — enough to catch a broken build
 * without requiring the FastAPI backend on :8100. Full flow A/D
 * integration is documented in docs/demo.md and exercised by the
 * (separate) full-system Playwright run.
 */

test.describe("Studio surface (flow D scaffolding)", () => {
  test("renders prompt input, format pills, and Run button", async ({ page }) => {
    await page.goto("/studio");

    const prompt = page.getByTestId("cie-prompt-input");
    await expect(prompt).toBeVisible();
    await expect(prompt.locator("textarea")).toBeVisible();

    const picker = page.getByTestId("cie-format-picker");
    await expect(picker).toBeVisible();
    await expect(picker.getByRole("radio")).toHaveCount(5);

    await expect(page.getByTestId("cie-run-button")).toBeVisible();
    await expect(page.getByTestId("cie-template-grid")).toBeVisible();
  });

  test("template card click pre-fills the prompt", async ({ page }) => {
    await page.goto("/studio");

    const grid = page.getByTestId("cie-template-grid");
    await grid.getByRole("button").first().click();

    const textarea = page.getByTestId("cie-prompt-input").locator("textarea");
    await expect(textarea).not.toHaveValue("");
  });
});

test.describe("Agents surface (flow B scaffolding)", () => {
  test("renders the 6-agent character roster", async ({ page }) => {
    await page.goto("/agents");

    const roster = page.getByTestId("cie-agent-roster");
    await expect(roster).toBeVisible();

    const cards = page.getByTestId("cie-agent-card");
    await expect(cards).toHaveCount(6);
  });
});
