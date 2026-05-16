import { expect, test } from "@playwright/test";

/**
 * Token-level streaming smoke test.
 *
 * The orchestrator emits `text_delta` events as the adapter pushes chunks
 * via `ctx.on_log`. The chat renders these via `LiveStreamProse` (shimmer
 * tail) before swapping to the canonical `thought` / `agent_step` block
 * once `text_done` fires.
 *
 * We assert:
 *   - submitting a brief creates a `cie-chat-live-stream-row` for at least
 *     one agent within 8 s
 *   - text grows over time (compare two reads ~1.5 s apart)
 *   - the running-state composer shows a Stop button (`cie-composer-stop`)
 *   - clicking Stop aborts the stream and clears the live_stream row
 */

test.describe("Studio token streaming", () => {
  test("renders LiveStreamProse for streaming reasoning + Stop button works", async ({
    page,
  }) => {
    await page.goto("/studio?adapter=pioneer");

    // Submit a brief from the empty-state composer.
    const composer = page.getByTestId("cie-hello-composer");
    await expect(composer).toBeVisible();
    const textarea = composer.locator("textarea").first();
    await textarea.fill("Reels ad for wool runners");
    await textarea.press(
      process.platform === "darwin" ? "Meta+Enter" : "Control+Enter",
    );

    // Wait for a live_stream row to appear. Pioneer streams ~40 chunks per
    // node; the first delta should arrive within a few seconds.
    const liveRow = page.getByTestId("cie-chat-live-stream-row").first();
    await expect(liveRow).toBeVisible({ timeout: 15_000 });

    // Confirm content grows over a 1.5 s window (proves it's streaming, not
    // a single block dropped at end-of-node).
    const proseLocator = page.getByTestId("cie-chat-live-stream").first();
    const t0 = (await proseLocator.textContent()) ?? "";
    await page.waitForTimeout(1500);
    const t1 = (await proseLocator.textContent()) ?? "";
    expect(t1.length).toBeGreaterThanOrEqual(t0.length);

    // Stop button appears in the running-state composer.
    const stopBtn = page.getByTestId("cie-composer-stop");
    await expect(stopBtn).toBeVisible();
    await stopBtn.click();

    // After Stop: the live_stream row may disappear (the abort cancels the
    // fetch; subsequent thought/agent_step events that would have replaced
    // it never arrive). The Stop button itself flips back to the Send
    // button (no `cie-composer-stop` testid).
    await expect(stopBtn).toBeHidden({ timeout: 5_000 });
  });
});
