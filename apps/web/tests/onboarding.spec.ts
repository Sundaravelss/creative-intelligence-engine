import { expect, test } from "@playwright/test";

/**
 * W1 — Onboarding Phase 1 smoke.
 *
 * Visits /onboarding directly (bypasses splash auto-redirect) and asserts:
 *   - Phase 1 renders 5 agent avatar <img> tags
 *   - Phase 2's gradient bottom bar surfaces with "Add your store link"
 *
 * Phase 1 auto-advances to Phase 2 after ~1.5s, so we wait for both states
 * within the same test to keep the suite tight.
 */
test.describe("Onboarding flow (W1)", () => {
  test("Phase 1 renders 5 avatars and Phase 2 reveals the store-link bar", async ({
    page,
  }) => {
    await page.goto("/onboarding");

    // Phase 1 — 5 stylized agent avatars
    const avatarList = page.getByLabel("Agent roster");
    await expect(avatarList).toBeVisible();
    await expect(avatarList.locator("img")).toHaveCount(5);

    await expect(
      page.getByRole("heading", { name: /Assembling your agents/i }),
    ).toBeVisible();

    // Phase 2 — auto-advance after 1.5s reveals the gradient bottom bar
    const linkInput = page.getByPlaceholder(/allbirds\.com/i);
    await expect(linkInput).toBeVisible({ timeout: 5_000 });

    await expect(page.getByText(/Add your store link/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Scan Website/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Skip$/i }),
    ).toBeVisible();
  });
});
