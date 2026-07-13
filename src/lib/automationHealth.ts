/**
 * Automation health — turning a static count into something you can act on.
 *
 * Normalises each automation's recent runs into one shape: what state it's in,
 * when it last ran, how long it took, what broke, and whether it's been breaking
 * repeatedly. Pure and network-free.
 *
 * A note on "normalizes across sources": today there is exactly ONE source — the
 * internal `run-automation` edge function. There are no third-party executors and
 * nothing to poll or subscribe to. What this really normalises is *time*: rows
 * written before migration 0014 have no `status` column, and those rows are all
 * successes (a failure was never written at all), so they're read as such rather
 * than guessed at.
 */
import type { Automation, AutomationRun, RunStatus } from "@/types/db";

/** What the UI shows. Wider than a run's status, because an automation can be off. */
export type HealthStatus = "failed" | "running" | "succeeded" | "paused" | "never_run";

export interface RunPoint {
  id: string;
  status: RunStatus;
  ran_at: string;
  duration_ms: number | null;
  error_message: string | null;
}

export interface Health {
  automation: Automation;
  status: HealthStatus;
  lastRun: RunPoint | null;
  /** The message from the most recent run, if that run failed. */
  lastError: string | null;
  /** Oldest → newest, capped at HISTORY. Powers the run strip. */
  history: RunPoint[];
  failureCount: number;
  /** Share of recent runs that failed, 0–1. Null when there's no history. */
  failureRate: number | null;
  /** Nothing here is on a timer — every run is a button press. */
  schedule: "manual";
}

const HISTORY = 10;

/** A run row with no status predates migration 0014, and those are only ever successes. */
const runStatus = (r: AutomationRun): RunStatus => r.status ?? "succeeded";

function toPoint(r: AutomationRun): RunPoint {
  return {
    id: r.id,
    status: runStatus(r),
    ran_at: r.ran_at,
    duration_ms: r.duration_ms ?? null,
    error_message: r.error_message ?? null,
  };
}

export function automationHealth(automation: Automation, runs: AutomationRun[]): Health {
  const mine = runs
    .filter((r) => r.automation_id === automation.id)
    .sort((a, b) => new Date(b.ran_at).getTime() - new Date(a.ran_at).getTime());

  const recent = mine.slice(0, HISTORY).map(toPoint);
  const last = recent[0] ?? null;
  const failureCount = recent.filter((r) => r.status === "failed").length;

  // A paused automation that last failed is still broken — you'd want to know that
  // before switching it back on — so failure wins over paused.
  let status: HealthStatus;
  if (last?.status === "failed") status = "failed";
  else if (last?.status === "running") status = "running";
  else if (automation.status === "paused") status = "paused";
  else if (!last) status = "never_run";
  else status = "succeeded";

  return {
    automation,
    status,
    lastRun: last,
    lastError: last?.status === "failed" ? last.error_message : null,
    history: [...recent].reverse(), // oldest → newest reads left-to-right
    failureCount,
    failureRate: recent.length ? failureCount / recent.length : null,
    schedule: "manual",
  };
}

const ORDER: Record<HealthStatus, number> = {
  failed: 0,
  running: 1,
  never_run: 2,
  succeeded: 3,
  paused: 4,
};

/** Every automation's health, broken ones first. */
export function healthReport(automations: Automation[], runs: AutomationRun[]): Health[] {
  return automations
    .map((a) => automationHealth(a, runs))
    .sort((a, b) => {
      const d = ORDER[a.status] - ORDER[b.status];
      if (d !== 0) return d;
      const at = a.lastRun ? new Date(a.lastRun.ran_at).getTime() : 0;
      const bt = b.lastRun ? new Date(b.lastRun.ran_at).getTime() : 0;
      return bt - at;
    });
}

export const failing = (report: Health[]): Health[] => report.filter((h) => h.status === "failed");

export const STATUS_LABEL: Record<HealthStatus, string> = {
  failed: "Failed",
  running: "Running",
  succeeded: "Healthy",
  paused: "Paused",
  never_run: "Never run",
};

/** Maps onto the existing Badge tones (red / blue / emerald / grey). */
export const STATUS_TONE: Record<HealthStatus, string> = {
  failed: "urgent",
  running: "in_progress",
  succeeded: "done",
  paused: "paused",
  never_run: "normal",
};

export function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}
