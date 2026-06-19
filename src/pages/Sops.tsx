import { useState } from "react";
import { ClipboardCheck, CheckCircle2, Circle, Sparkles, Play, Target } from "lucide-react";
import type { Sop } from "@/types/db";
import { PageHeader, Modal } from "@/components/ui";
import { useSops, useSopRuns, useSopMutations } from "@/data/hooks";

export default function Sops() {
  const { data: sops = [], isLoading } = useSops();
  const { data: runs = [] } = useSopRuns();
  const { start, setChecked, complete } = useSopMutations();

  const [openSop, setOpenSop] = useState<Sop | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [checked, setLocalChecked] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  function open(sop: Sop) {
    const r = runs.find((x) => x.sop_id === sop.id && x.status === "in_progress");
    setOpenSop(sop);
    setRunId(r?.id ?? null);
    setLocalChecked(r?.checked ?? []);
    setDone(false);
  }
  function close() { setOpenSop(null); setRunId(null); setLocalChecked([]); setDone(false); }

  async function startRun() {
    if (!openSop) return;
    const r = await start.mutateAsync({ sop_id: openSop.id });
    setRunId(r?.id ?? "local");
    setLocalChecked([]);
  }
  function toggle(stepId: string) {
    if (!runId) return;
    const next = checked.includes(stepId) ? checked.filter((s) => s !== stepId) : [...checked, stepId];
    setLocalChecked(next);
    if (runId !== "local") setChecked.mutate({ id: runId, checked: next });
  }
  async function finish() {
    if (runId && runId !== "local") await complete.mutateAsync(runId);
    setDone(true);
  }

  const requiredIds = openSop?.steps.filter((s) => s.required).map((s) => s.id) ?? [];
  const allRequiredDone = requiredIds.length > 0 && requiredIds.every((id) => checked.includes(id));
  const pct = openSop && openSop.steps.length ? Math.round((checked.length / openSop.steps.length) * 100) : 0;

  return (
    <div>
      <PageHeader title="SOPs" subtitle="Working checklists — run each procedure to standard, every time" />

      {isLoading ? (
        <p className="text-sm text-faint">Loading…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sops.map((sop) => (
            <button key={sop.id} onClick={() => open(sop)} className="card flex flex-col p-5 text-left transition-colors hover:border-accent/40">
              <div className="flex items-center gap-2">
                <ClipboardCheck size={18} className="text-accent-soft" />
                <h3 className="font-semibold">{sop.title}</h3>
              </div>
              <span className="pill mt-2 w-fit bg-surface-2 text-faint">{sop.category}</span>
              <p className="mt-3 flex-1 text-sm text-muted">{sop.description}</p>
              <div className="mt-4 flex items-center gap-3 text-xs text-faint">
                <span>{sop.steps.length} steps</span>
                <span>·</span>
                <span>{sop.success_criteria.length} deliverables</span>
                <span className="ml-auto inline-flex items-center gap-1 text-accent-soft"><Play size={12} /> Start</span>
              </div>
            </button>
          ))}
          {sops.length === 0 && <p className="text-sm text-faint">No SOPs yet.</p>}
        </div>
      )}

      <Modal open={openSop !== null} onClose={close}>
        {openSop && (
          <div>
            <div className="flex items-center gap-2">
              <ClipboardCheck size={18} className="text-accent-soft" />
              <h2 className="text-lg font-semibold">{openSop.title}</h2>
            </div>
            <p className="mt-1 text-sm text-muted">{openSop.description}</p>

            {done ? (
              <div className="mt-6 flex flex-col items-center gap-2 rounded-lg bg-emerald-500/10 p-6 text-center">
                <CheckCircle2 size={28} className="text-emerald-400" />
                <p className="font-medium">SOP completed</p>
                <p className="text-sm text-muted">This run has been recorded.</p>
                <button className="btn-primary mt-2" onClick={close}>Done</button>
              </div>
            ) : (
              <>
                {/* progress */}
                <div className="mt-4">
                  <div className="mb-1 flex items-center justify-between text-xs text-faint">
                    <span>{runId ? "In progress" : "Not started"}</span>
                    <span>{checked.length}/{openSop.steps.length}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-surface-2">
                    <div className="h-1.5 rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                {/* checklist */}
                <div className="mt-4 space-y-1">
                  {openSop.steps.map((step) => {
                    const isChecked = checked.includes(step.id);
                    return (
                      <button
                        key={step.id}
                        disabled={!runId}
                        onClick={() => toggle(step.id)}
                        className={`flex w-full items-start gap-3 rounded-lg p-2.5 text-left transition-colors ${runId ? "hover:bg-surface-2" : "opacity-70"}`}
                      >
                        {isChecked ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-accent" /> : <Circle size={18} className="mt-0.5 shrink-0 text-faint" />}
                        <span className="flex-1">
                          <span className={`text-sm ${isChecked ? "text-zinc-400 line-through" : ""}`}>{step.label}</span>
                          {!step.required && <span className="ml-2 text-[11px] text-faint">(optional)</span>}
                        </span>
                        {step.ai_action && <span className="pill bg-accent/15 text-accent-soft"><Sparkles size={10} /> AI</span>}
                      </button>
                    );
                  })}
                </div>

                {/* success criteria */}
                <div className="mt-5 rounded-lg border border-border bg-surface-2/50 p-4">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-faint">
                    <Target size={12} /> Success criteria / deliverables
                  </p>
                  <ul className="space-y-1">
                    {openSop.success_criteria.map((c) => (
                      <li key={c} className="flex items-start gap-2 text-sm text-muted">
                        <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-400/70" /> {c}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* action */}
                <div className="mt-5">
                  {!runId ? (
                    <button className="btn-primary w-full" onClick={startRun} disabled={start.isPending}>
                      <Play size={15} /> {start.isPending ? "Starting…" : "Start workflow"}
                    </button>
                  ) : (
                    <button className="btn-primary w-full" onClick={finish} disabled={!allRequiredDone || complete.isPending}>
                      <CheckCircle2 size={15} /> {allRequiredDone ? "Mark Complete" : "Complete all required steps to finish"}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
