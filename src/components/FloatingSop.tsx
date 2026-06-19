import { ClipboardCheck, CheckCircle2, Circle, X, ChevronDown } from "lucide-react";
import { useSopWidget } from "@/store/sopWidget";
import { useSopMutations } from "@/data/hooks";
import { useState } from "react";

export function FloatingSop() {
  const { sop, runId, checked, clientName, setChecked, unpin } = useSopWidget();
  const { setChecked: persist, complete } = useSopMutations();
  const [collapsed, setCollapsed] = useState(false);

  if (!sop) return null;

  const total = sop.steps.length;
  const pct = total ? Math.round((checked.length / total) * 100) : 0;
  const requiredDone = sop.steps.filter((s) => s.required).every((s) => checked.includes(s.id));

  function toggle(stepId: string) {
    const next = checked.includes(stepId) ? checked.filter((s) => s !== stepId) : [...checked, stepId];
    setChecked(next);
    if (runId && runId !== "local") persist.mutate({ id: runId, checked: next });
  }
  function finish() {
    if (runId && runId !== "local") complete.mutate(runId);
    unpin();
  }

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="fixed bottom-6 left-6 z-40 flex items-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-medium text-white shadow-lg hover:bg-accent-soft"
      >
        <ClipboardCheck size={16} /> {sop.title} · {checked.length}/{total}
      </button>
    );
  }

  return (
    <div className="card fixed bottom-6 left-6 z-40 flex max-h-[28rem] w-80 max-w-[calc(100vw-3rem)] flex-col shadow-2xl">
      <div className="flex items-center gap-2 border-b border-border p-3">
        <ClipboardCheck size={16} className="text-accent-soft" />
        <p className="flex-1 truncate text-sm font-medium">{sop.title}</p>
        <button className="text-faint hover:text-zinc-100" onClick={() => setCollapsed(true)} aria-label="Collapse">
          <ChevronDown size={16} />
        </button>
        <button className="text-faint hover:text-red-400" onClick={unpin} aria-label="Close checklist">
          <X size={16} />
        </button>
      </div>

      {clientName && <p className="px-3 pt-2 text-xs text-faint">For {clientName}</p>}

      <div className="px-3 pt-2">
        <div className="mb-1 flex items-center justify-between text-[11px] text-faint">
          <span>Checklist</span>
          <span>{checked.length}/{total}</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-surface-2">
          <div className="h-1.5 rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {sop.steps.map((step) => {
          const on = checked.includes(step.id);
          return (
            <button key={step.id} onClick={() => toggle(step.id)} className="flex w-full items-start gap-2 rounded-md p-2 text-left hover:bg-surface-2">
              {on ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-accent" /> : <Circle size={16} className="mt-0.5 shrink-0 text-faint" />}
              <span className={`text-xs ${on ? "text-zinc-400 line-through" : ""}`}>
                {step.label}{!step.required && <span className="text-faint"> (opt)</span>}
              </span>
            </button>
          );
        })}
      </div>

      <div className="border-t border-border p-2">
        <button className="btn-primary w-full py-1.5 text-xs" disabled={!requiredDone} onClick={finish}>
          <CheckCircle2 size={13} /> {requiredDone ? "Mark Complete" : "Complete required steps"}
        </button>
      </div>
    </div>
  );
}
