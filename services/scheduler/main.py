"""Scheduler worker. WS-G.

APScheduler-based worker that:
  * loads ``fixtures/loops.json`` on boot
  * registers a cron job per loop
  * each tick POSTs to the orchestrator at ``/api/agents/campaign``
  * if the orchestrator is unreachable, falls back to POST ``/api/publish/{channel}``
    (the mock publish endpoint, which appends a stub post to ``fixtures/posts.json``)

CLI: ``python -m scheduler.main`` (blocks forever).
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger("cie.scheduler")

_REPO_ROOT = Path(__file__).resolve().parents[2]
_LOOPS_PATH = _REPO_ROOT / "fixtures" / "loops.json"

_API_BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:8100")
_HTTP_TIMEOUT = float(os.environ.get("SCHEDULER_HTTP_TIMEOUT", "30"))


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _load_loops() -> list[dict[str, Any]]:
    if not _LOOPS_PATH.exists():
        return []
    with _LOOPS_PATH.open("r", encoding="utf-8") as fh:
        data = json.load(fh)
    return data if isinstance(data, list) else []


def _fire_loop(loop: dict[str, Any]) -> None:
    """Single loop tick: try orchestrator, fall back to mock publish."""
    loop_id = loop.get("id", "<unknown>")
    channel = loop.get("channel", "instagram")
    prompt = loop.get("prompt", "")

    campaign_url = f"{_API_BASE_URL}/api/agents/campaign"
    publish_url = f"{_API_BASE_URL}/api/publish/{channel}"

    payload_campaign: dict[str, Any] = {
        "loop_id": loop_id,
        "channel": channel,
        "prompt": prompt,
        "format": loop.get("format", "post"),
        "triggered_at": _now_iso(),
    }
    payload_publish: dict[str, Any] = {
        "loop_id": loop_id,
        "copy": prompt,
        "schedule_at": _now_iso(),
    }

    try:
        with httpx.Client(timeout=_HTTP_TIMEOUT) as client:
            resp = client.post(campaign_url, json=payload_campaign)
            if resp.status_code < 400:
                logger.info("loop %s -> orchestrator ok (%s)", loop_id, resp.status_code)
                return
            logger.warning(
                "loop %s -> orchestrator returned %s, falling back to publish",
                loop_id,
                resp.status_code,
            )
    except (httpx.ConnectError, httpx.ReadTimeout, httpx.RequestError) as exc:
        logger.warning("loop %s -> orchestrator unreachable (%s); falling back", loop_id, exc)

    try:
        with httpx.Client(timeout=_HTTP_TIMEOUT) as client:
            resp = client.post(publish_url, json=payload_publish)
            resp.raise_for_status()
            logger.info("loop %s -> publish ok (%s)", loop_id, resp.status_code)
    except httpx.HTTPError as exc:
        logger.error("loop %s -> publish failed: %s", loop_id, exc)


def build_scheduler() -> BlockingScheduler:
    scheduler = BlockingScheduler(timezone="UTC")
    loops = _load_loops()
    for loop in loops:
        cron_expr = loop.get("cron")
        loop_id = loop.get("id")
        if not cron_expr or not loop_id:
            logger.warning("skipping malformed loop entry: %s", loop)
            continue
        try:
            trigger = CronTrigger.from_crontab(cron_expr, timezone="UTC")
        except ValueError as exc:
            logger.warning("loop %s has invalid cron '%s': %s", loop_id, cron_expr, exc)
            continue
        scheduler.add_job(
            _fire_loop,
            trigger=trigger,
            args=[loop],
            id=loop_id,
            replace_existing=True,
            misfire_grace_time=300,
        )
        logger.info("registered loop %s (cron=%s, channel=%s)", loop_id, cron_expr, loop.get("channel"))
    return scheduler


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    scheduler = build_scheduler()
    logger.info("CIE scheduler starting (api=%s, loops=%d)", _API_BASE_URL, len(scheduler.get_jobs()))
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        logger.info("CIE scheduler shutting down")
        scheduler.shutdown(wait=False)


if __name__ == "__main__":
    main()
