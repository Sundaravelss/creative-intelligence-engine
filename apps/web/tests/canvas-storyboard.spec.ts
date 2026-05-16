import { expect, test } from "@playwright/test";

/**
 * Higgsfield-style canvas smoke.
 *
 * Validates that the new `/canvas` shell renders without the FastAPI backend
 * up — synthetic-fallback path kicks in when the SSE call fails. This keeps
 * the test cheap to run in CI while still exercising every region of the
 * 4-zone shell + the storyboard fan-out.
 */

test.describe("Canvas (Higgsfield-style)", () => {
  test("renders the four-zone shell with brief composer + storyboard slots", async ({
    page,
  }) => {
    await page.goto("/canvas");

    // Top bar copy
    await expect(page.getByText(/One canvas\. Every workflow\./i)).toBeVisible();

    // One-link bar
    await expect(
      page.getByPlaceholder(/One link in\. Marketing out/i),
    ).toBeVisible();

    // Preset shelf — three category headers
    await expect(page.getByText(/Viral Presets/i)).toBeVisible();
    await expect(page.getByText(/Camera Moves/i)).toBeVisible();
    await expect(page.getByText(/Mood Packs/i)).toBeVisible();

    // Left rails
    await expect(page.getByRole("region", { name: /Moodboard/i })).toBeVisible();
    await expect(
      page.getByRole("region", { name: /Character locker/i }),
    ).toBeVisible();

    // Brief composer
    await expect(
      page.getByPlaceholder(/Describe one scene/i),
    ).toBeVisible();

    // Six storyboard skeleton slots (Wide, Close-up, Side angle, Overhead, Tracking, Static)
    const skeletonLabels = [
      /Wide \(waiting/i,
      /Close-up \(waiting/i,
      /Side angle \(waiting/i,
      /Overhead \(waiting/i,
      /Tracking \(waiting/i,
      /Static \(waiting/i,
    ];
    for (const label of skeletonLabels) {
      await expect(page.getByText(label)).toBeVisible();
    }
  });

  test("toggling a preset reflects in the modifier preview line", async ({
    page,
  }) => {
    await page.goto("/canvas");

    const editorialButton = page.getByRole("button", { name: /^Editorial$/ });
    await editorialButton.click();
    // Composer modifier preview: "+ Editorial"
    await expect(page.getByText(/\+ Editorial/)).toBeVisible();
    await editorialButton.click();
    // After toggle off, preview falls back to the keybind hint
    await expect(page.getByText(/Cmd\/Ctrl \+ Enter/)).toBeVisible();
  });

  test("submit fans out 6 shots via synthetic fallback when API is offline", async ({
    page,
  }) => {
    // Force the campaign endpoint to fail so the synthetic path runs.
    await page.route("**/api/agents/campaign", (route) => route.abort());

    await page.goto("/canvas");

    const briefBox = page.getByPlaceholder(/Describe one scene/i);
    await briefBox.fill("espresso pour, slow motion");
    await page.getByRole("button", { name: /Generate storyboard/i }).click();

    // After fallback runs, every shot card should have a hero + 2 alt
    // thumbnails (3 variants per shot × 6 shots = 18 imgs).
    const shotImages = page
      .getByRole("article", { name: /Shot —/i })
      .locator("img");
    await expect(shotImages).toHaveCount(18, { timeout: 10000 });
  });

  test("paste product URL into one-link bar enables the launch CTA", async ({
    page,
  }) => {
    await page.goto("/canvas");

    const oneLink = page.getByPlaceholder(/One link in\. Marketing out/i);
    const launch = page.getByRole("button", { name: /Launch campaign/i });
    await expect(launch).toBeDisabled();
    await oneLink.fill("https://example.com/product/kettle");
    await expect(launch).toBeEnabled();
  });

  test("character locker can add and lock a character", async ({ page }) => {
    await page.goto("/canvas");

    await page.getByRole("button", { name: /Add character/i }).click();
    await page.getByPlaceholder(/Character name/i).fill("Aiko");
    await page.getByPlaceholder(/Persona/i).fill("Tokyo skater, neon palette");
    await page.getByRole("button", { name: /^Save$/ }).click();

    const lockButton = page.getByRole("button", { name: /^Aiko/i });
    await expect(lockButton).toBeVisible();
    await lockButton.click();
    // Inspector copy reflects locked character
    await expect(page.getByText(/Locked: Aiko/)).toBeVisible();
  });
});
