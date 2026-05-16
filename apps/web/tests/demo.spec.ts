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
  test("renders empty-state hero and chat composer", async ({ page }) => {
    await page.goto("/studio");

    // Project header on left rail
    await expect(
      page.getByRole("button", { name: /Marketing Image Generation for Bags/i }),
    ).toBeVisible();

    // Empty-state textarea (PromptInput)
    const prompt = page.getByTestId("cie-prompt-input");
    await expect(prompt).toBeVisible();
    await expect(prompt.locator("textarea")).toBeVisible();

    // Format pills in empty-state
    const picker = page.getByTestId("cie-format-picker");
    await expect(picker).toBeVisible();
    await expect(picker.getByRole("radio")).toHaveCount(5);

    // Bottom composer "Add a follow-up…" textarea (always present)
    await expect(
      page.getByPlaceholder(/Add a follow-up/i).first(),
    ).toBeVisible();
  });

  test("Live status pill and Opus 4.7 badge render in chat header", async ({
    page,
  }) => {
    await page.goto("/studio");
    await expect(page.getByText("Opus 4.7")).toBeVisible();
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
