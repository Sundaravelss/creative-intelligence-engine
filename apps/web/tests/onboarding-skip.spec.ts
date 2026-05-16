import { expect, test } from "@playwright/test";

/**
 * Step-by-step diagnostic test of the Skip path through /onboarding.
 *
 * Phase 1 (agents) auto-advances after 1.5s -> Phase 2 (intake).
 * In Phase 2, clicking Skip with no URL should jump to Phase 4 (reward),
 * which auto-advances to Phase 5 (confirm) after 1.8s.
 * In Phase 5, clicking Proceed PUTs onboarding state and pushes to /studio.
 */

test("Skip path: agents -> intake -> reward -> confirm -> Proceed -> /studio", async ({ page }) => {
  // Reset onboarding state (idempotent — backend uses fixtures/onboarding.json).
  // We hit the API directly to put a fresh `{complete: false}` on disk.
  await page.request.put("http://localhost:8100/api/onboarding/state", {
    data: { complete: false, brandUrl: null, completedAt: null },
  });

  console.log("--- STEP 0: navigate to /onboarding");
  await page.goto("http://localhost:3000/onboarding");

  console.log("--- STEP 1: assert Phase 1 'Assembling your agents' visible");
  await expect(page.getByText(/Assembling your agents/i)).toBeVisible({
    timeout: 5000,
  });

  console.log("--- STEP 2: wait for auto-advance to Phase 2 (intake)");
  await expect(page.getByText(/Hi, I.?m Sage/i)).toBeVisible({
    timeout: 5000,
  });

  console.log("--- STEP 3: assert StoreLinkBar visible with Skip button");
  const skipBtn = page.getByRole("button", { name: /^skip$/i });
  await expect(skipBtn).toBeVisible({ timeout: 5000 });
  await expect(skipBtn).toBeEnabled();

  console.log("--- STEP 4: assert Phase 1 'Assembling' STILL visible (scrollable feed)");
  await expect(page.getByText(/Assembling your agents/i)).toBeVisible();

  console.log("--- STEP 5: click Skip");
  // Capture browser console + log the DOM right before click
  page.on("console", (msg) => console.log(`  [browser ${msg.type()}]`, msg.text()));
  page.on("pageerror", (err) => console.log(`  [pageerror]`, err.message));
  console.log("    DOM before Skip click: phase still intake?",
    await page.evaluate(() => document.body.innerText.includes("Add your store link")));
  await skipBtn.click();
  // wait for state to flush
  await page.waitForTimeout(500);
  console.log("    DOM 500ms after click — has '250':",
    await page.evaluate(() => document.body.innerText.includes("250")));
  console.log("    DOM 500ms after click — has 'Add your store link':",
    await page.evaluate(() => document.body.innerText.includes("Add your store link")));
  console.log("    DOM 500ms after click — has 'Brand.md':",
    await page.evaluate(() => document.body.innerText.includes("Brand.md")));

  console.log("--- STEP 6: assert reward card '250 credits' appears");
  await expect(page.getByText(/You.?ve got/i)).toBeVisible({ timeout: 5000 });
  await expect(page.getByText(/credits/i)).toBeVisible();

  console.log("--- STEP 7: assert StoreLinkBar is GONE (phase advanced past intake)");
  await expect(page.getByRole("button", { name: /^skip$/i })).toHaveCount(0);

  console.log("--- STEP 8: wait for confirm phase, assert Brand.md visible");
  await page.waitForTimeout(2200); // 1.8s reward auto-advance + buffer
  await expect(page.getByText(/Brand\.md/i)).toBeVisible({ timeout: 5000 });

  console.log("--- STEP 9: assert Proceed button visible + enabled");
  const proceed = page.getByRole("button", { name: /^proceed$/i });
  await expect(proceed).toBeVisible();
  await expect(proceed).toBeEnabled();

  console.log("--- STEP 10: click Proceed");
  await Promise.all([
    page.waitForURL(/\/studio/, { timeout: 10_000 }),
    proceed.click(),
  ]);

  console.log("--- STEP 11: confirm we landed on /studio");
  expect(page.url()).toMatch(/\/studio/);

  console.log("--- STEP 12: confirm onboarding state is now complete");
  const stateRes = await page.request.get(
    "http://localhost:8100/api/onboarding/state",
  );
  const state = await stateRes.json();
  expect(state.complete).toBe(true);

  // Reset for re-runs.
  await page.request.put("http://localhost:8100/api/onboarding/state", {
    data: { complete: false, brandUrl: null, completedAt: null },
  });
});
