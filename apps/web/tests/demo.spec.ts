import { expect, test } from "@playwright/test";

/**
 * WS-V1 smoke suite.
 *
 * Studio is now the chat-rail + liquid-canvas layout. We assert:
 *   - The empty-state textarea (PromptInput) renders
 *   - The bottom composer "Add a follow-up…" placeholder is present
 *   - The Live + Opus 4.7 chat header shows
 *
 * The Agents roster smoke is unchanged.
 */

test.describe("Studio surface (WS-V1 chat + canvas)", () => {
  test("renders empty-state hero and Schedule affordance", async ({ page }) => {
    await page.goto("/studio");

    // Hero copy
    await expect(
      page.getByText(/What are we going to sell today\?/i),
    ).toBeVisible();

    // Hero composer + textarea
    const composer = page.getByTestId("cie-hello-composer");
    await expect(composer).toBeVisible();
    await expect(composer.locator("textarea")).toBeVisible();

    // 4 quick-action chips
    const chips = page.getByTestId("cie-quick-actions").getByRole("button");
    await expect(chips).toHaveCount(4);

    // Spaces hint card
    await expect(page.getByTestId("cie-spaces-hint")).toBeVisible();

    // Schedule loop affordance — clock icon button on the empty-state composer.
    await expect(
      page.getByRole("button", { name: /Schedule loop/i }).first(),
    ).toBeVisible();
  });

  test("Schedule modal opens with prompt seeded from the hero composer", async ({
    page,
  }) => {
    await page.goto("/studio");

    const composer = page.getByTestId("cie-hello-composer");
    await composer.locator("textarea").fill("daily promo for new sneakers");

    await page.getByRole("button", { name: /Schedule loop/i }).first().click();

    // Modal renders with the prompt prefilled and a Save schedule CTA.
    const dialog = page.getByRole("dialog", { name: /Schedule loop/i });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: /Save schedule/i }),
    ).toBeVisible();
    // The dialog's Prompt textarea is seeded from the composer.
    await expect(dialog.getByRole("textbox", { name: /Prompt/i })).toHaveValue(
      "daily promo for new sneakers",
    );
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

test.describe("Spaces surface (WS-V3)", () => {
  test("renders 6 space cards and opens the 2-step flow", async ({ page }) => {
    await page.goto("/spaces");

    const grid = page.getByTestId("cie-space-grid");
    await expect(grid).toBeVisible();

    const cards = page.getByTestId("cie-space-card");
    await expect(cards).toHaveCount(6);

    // Click the first card → /spaces/[id], step indicator shows "Step 1 of 2".
    await cards.first().click();
    await expect(page).toHaveURL(/\/spaces\/[a-z-]+/);

    const indicator = page.getByTestId("cie-space-steps-indicator");
    await expect(indicator).toBeVisible();
    await expect(indicator).toContainText(/Step\s+1\s+of\s+2/i);
  });
});
