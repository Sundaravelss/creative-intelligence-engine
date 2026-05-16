import { expect, test } from "@playwright/test";

/**
 * W3 — Live-streaming chat redesign smoke tests.
 *
 * These exercise the new SSE event handling in /studio:
 *   - `started` → ✻ Sage started pill
 *   - `thought` → ✻ Sage thought for Ns pill (collapsed by default, expands on click)
 *   - `agent_step_start` + `agent_step_complete` → AgentStepBlock with avatar
 *
 * The backend orchestrator is mocked at the network layer so the test runs
 * deterministically without requiring a live FastAPI server.
 */

const SSE_BODY = [
  // started — pill
  `event: started\ndata: {"type":"started"}\n\n`,
  // thought — strategist
  `event: thought\ndata: ${JSON.stringify({
    type: "thought",
    agentId: "strategist",
    summary: "Mapping audience and hook angles",
    fullText:
      "Reading the brief — bags, marketing imagery. Mapping audience: design-led shoppers, urban, late-20s. Pulling 3 hook angles: heritage craft, daily-carry utility, statement silhouette.",
    elapsedSec: 4,
  })}\n\n`,
  // agent_step_start — copywriter
  `event: agent_step_start\ndata: ${JSON.stringify({
    type: "agent_step_start",
    agentId: "copywriter",
    label: "Build creative brief",
    totalSubsteps: 2,
  })}\n\n`,
  // agent_step_complete — copywriter
  `event: agent_step_complete\ndata: ${JSON.stringify({
    type: "agent_step_complete",
    agentId: "copywriter",
    completedSubsteps: 2,
    substeps: [
      { label: "joined", status: "joined" },
      { label: "Build creative brief", status: "done" },
    ],
  })}\n\n`,
  // done — close out the stream so the client doesn't hang
  `event: done\ndata: {"type":"done"}\n\n`,
].join("");

test.describe("Studio chat — W3 live-streaming redesign", () => {
  test.beforeEach(async ({ page }) => {
    // Intercept the agents/campaign POST and respond with a deterministic
    // SSE body that exercises every new event type.
    await page.route("**/api/agents/campaign**", async (route) => {
      await route.fulfill({
        status: 200,
        headers: {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          connection: "keep-alive",
        },
        body: SSE_BODY,
      });
    });
  });

  test("renders Started pill, Thought pill, and AgentStepBlock with avatar after submit", async ({
    page,
  }) => {
    await page.goto("/studio");

    // Submit a campaign via the bottom composer (always present).
    // Empty state shows "Ask Sage anything..." (submits on Cmd/Ctrl+Enter);
    // running state shows the composer footer "Add a follow-up..." (Enter).
    const composer = page
      .getByPlaceholder(/Ask Sage|Add a follow-up/i)
      .first();
    await composer.fill("Generate a hero image for our new bag line");
    // Use ControlOrMeta+Enter — works for both empty-state Cmd+Enter and
    // composer-footer Enter (which also triggers on plain Enter).
    await composer.press("ControlOrMeta+Enter");

    // Started pill
    await expect(page.getByTestId("cie-chat-started")).toBeVisible({
      timeout: 5000,
    });

    // Thought pill
    const thought = page.getByTestId("cie-chat-thought");
    await expect(thought).toBeVisible();
    await expect(thought).toContainText(/Sage/);
    await expect(thought).toContainText(/thought/i);

    // At least one AgentStepBlock with the stylized avatar visible.
    const stepBlocks = page.getByTestId("cie-chat-agent-step");
    await expect(stepBlocks.first()).toBeVisible();
    await expect(stepBlocks.first().locator("img")).toBeVisible();
  });

  test("clicking the Thought pill expands the full reasoning text", async ({
    page,
  }) => {
    await page.goto("/studio");

    // Empty state shows "Ask Sage anything..." (submits on Cmd/Ctrl+Enter);
    // running state shows the composer footer "Add a follow-up..." (Enter).
    const composer = page
      .getByPlaceholder(/Ask Sage|Add a follow-up/i)
      .first();
    await composer.fill("Generate a hero image for our new bag line");
    // Use ControlOrMeta+Enter — works for both empty-state Cmd+Enter and
    // composer-footer Enter (which also triggers on plain Enter).
    await composer.press("ControlOrMeta+Enter");

    const thought = page.getByTestId("cie-chat-thought");
    await expect(thought).toBeVisible({ timeout: 5000 });

    // Collapsed by default — the full text panel should not be present yet.
    await expect(
      page.getByText(/Pulling 3 hook angles/i),
    ).toHaveCount(0);

    // Click to expand.
    await thought.click();
    await expect(page.getByText(/Pulling 3 hook angles/i)).toBeVisible();
  });
});
