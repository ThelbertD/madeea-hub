import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Play, Clock, Workflow, Save, Loader2, ChevronDown, ChevronUp, Trash2, RotateCw, AlertTriangle, CalendarOff } from "lucide-react";
import { AUTOMATION_TRIGGERS as T, AUTOMATION_ACTIONS as A } from "@/lib/constants";
import { Badge, PageHeader } from "@/components/ui";
import { OutputViewer } from "@/components/OutputViewer";
import { useAutomations, useAutomationMutations, useAutomationRuns } from "@/data/hooks";
import { healthReport, failing, STATUS_LABEL, STATUS_TONE, formatDuration, timeAgo } from "@/lib/automationHealth";
import { supabase } from "@/lib/supabase";

export default function AutomationPage() {
  const qc = useQueryClient();
  const { data: autos = [], isLoading } = useAutomations();
  const { data: runs = [] } = useAutomationRuns();
  const { toggle, create, remove } = useAutomationMutations();
  const [trigger, setTrigger] = useState(T[0]);
  const [action, setAction] = useState(A[0]);
  const [name, setName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [showError, setShowError] = useState<string | null>(null);

  const report = healthReport(autos, runs);
  const broken = failing(report);

  function save() {
    if (!name.trim()) return;
    create.mutate({ name: name.trim(), description: `${trigger} → ${action}`, trigger, action });
    setName("");
  }

  async function runNow(id: string) {
    if (!supabase) { setNote("Connect Supabase to run automations."); return; }
    setBusyId(id);
    setNote("");
    try {
      const { data, error } = await supabase.functions.invoke("run-automation", { body: { automation_id: id } });
      if (error) {
        let msg = error.message;
        try { const b = await (error as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.(); if (b?.error) msg = b.error; } catch { /* ignore */ }
        setNote(`Run failed: ${msg}`);
      } else {
        setNote((data as { summary?: string })?.summary ?? "Run complete.");
        setExpanded(id);
        qc.invalidateQueries({ queryKey: ["automations"] });
        qc.invalidateQueries({ queryKey: ["automation_runs"] });
        qc.invalidateQueries({ queryKey: ["messages"] }); // inbox triage may re-categorise
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader title="Automation Health" subtitle="What ran, what worked, and what broke" />

      {note && <div className="mb-4 rounded-lg border border-border bg-surface-2 px-4 py-2 text-sm text-muted">{note}</div>}

      {broken.length > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm">
          <AlertTriangle size={16} className="shrink-0 text-red-400" />
          <span>
            <span className="font-medium text-red-400">
              {broken.length} automation{broken.length === 1 ? "" : "s"} failing
            </span>
            <span className="text-muted"> — {broken.map((h) => h.automation.name).join(", ")}</span>
          </span>
        </div>
      )}

      <h2 className="mb-3 font-semibold">Automations</h2>
      {isLoading ? (
        <p className="text-sm text-faint">Loading…</p>
      ) : autos.length === 0 ? (
        <div className="card p-8 text-center text-sm text-faint">No automations yet. Build one below.</div>
      ) : (
        <div className="space-y-3">
          {report.map((h) => {
            const a = h.automation;
            const latest = runs.find((r) => r.automation_id === a.id);
            const isOpen = expanded === a.id;
            const isBroken = h.status === "failed";
            return (
              <div key={a.id} className={`card group p-5 ${isBroken ? "border-red-500/40 bg-red-500/[0.03]" : ""}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <Workflow size={18} className="mt-0.5 shrink-0 text-accent-soft" />
                    <div>
                      <h3 className="font-semibold">{a.name}</h3>
                      <p className="mt-1 text-sm text-muted">{a.description}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <button
                      className="text-faint opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                      onClick={() => { if (window.confirm(`Delete "${a.name}"? This can't be undone.`)) remove.mutate(a.id); }}
                      aria-label="Delete automation"
                    >
                      <Trash2 size={15} />
                    </button>
                    <button
                      role="switch"
                      aria-checked={a.status === "active"}
                      onClick={() => toggle.mutate({ id: a.id, status: a.status === "active" ? "paused" : "active" })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${a.status === "active" ? "bg-accent" : "bg-surface-2"}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${a.status === "active" ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-faint">
                  <Badge tone={STATUS_TONE[h.status]}>{STATUS_LABEL[h.status]}</Badge>
                  <span className="flex items-center gap-1">
                    <Clock size={12} /> Last run {timeAgo(h.lastRun?.ran_at)}
                    {h.lastRun?.duration_ms != null && ` · ${formatDuration(h.lastRun.duration_ms)}`}
                  </span>
                  {/* Nothing here runs on a timer — every run is a button press. Saying so
                      beats inventing a next-run time that will never arrive. */}
                  <span className="flex items-center gap-1" title="No scheduler is configured — automations run when you press Run Now">
                    <CalendarOff size={12} /> Manual — not scheduled
                  </span>
                  <span>{a.total_runs} total runs</span>

                  {h.history.length > 0 && (
                    <span className="flex items-center gap-1" title={`Last ${h.history.length} runs, oldest first`}>
                      {h.history.map((r) => (
                        <span
                          key={r.id}
                          className={`h-3 w-1.5 rounded-sm ${
                            r.status === "failed" ? "bg-red-500" : r.status === "running" ? "bg-sky-500" : "bg-emerald-500/70"
                          }`}
                        />
                      ))}
                      {h.failureCount > 0 && (
                        <span className="ml-1 text-amber-400">{h.failureCount}/{h.history.length} failed</span>
                      )}
                    </span>
                  )}

                  {latest && (
                    <button className="flex items-center gap-1 text-accent-soft hover:underline" onClick={() => setExpanded(isOpen ? null : a.id)}>
                      {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />} {isOpen ? "Hide" : "View"} last result
                    </button>
                  )}

                  <div className="ml-auto flex items-center gap-2">
                    {isBroken && (
                      <button
                        className="flex items-center gap-1 rounded-lg border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 font-medium text-red-400 hover:bg-red-500/20"
                        onClick={() => setShowError(showError === a.id ? null : a.id)}
                      >
                        <AlertTriangle size={12} /> {showError === a.id ? "Hide error" : "Show error"}
                      </button>
                    )}
                    <button
                      className={isBroken ? "btn-primary py-1.5" : "btn-ghost border border-border py-1.5"}
                      onClick={() => runNow(a.id)}
                      disabled={busyId === a.id}
                    >
                      {busyId === a.id ? <Loader2 size={13} className="animate-spin" /> : isBroken ? <RotateCw size={13} /> : <Play size={13} />}
                      {isBroken ? "Retry" : "Run Now"}
                    </button>
                  </div>
                </div>

                {isBroken && showError === a.id && h.lastError && (
                  <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                    <p className="eyebrow mb-1.5 text-red-400">Last error · {timeAgo(h.lastRun?.ran_at)}</p>
                    <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-red-300/90">
                      {h.lastError}
                    </pre>
                  </div>
                )}
                {isOpen && latest?.output?.text && (
                  <div className="mt-4 border-t border-border pt-4">
                    {latest.summary && <p className="mb-2 text-xs text-faint">{latest.summary}</p>}
                    <OutputViewer output={latest.output.text} title={a.name} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <h2 className="mb-3 mt-8 font-semibold">Custom Automation Builder</h2>
      <div className="card p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="field-label">Trigger</label>
            <select className="input" value={trigger} onChange={(e) => setTrigger(e.target.value)}>{T.map((t) => <option key={t}>{t}</option>)}</select>
          </div>
          <div>
            <label className="field-label">Action</label>
            <select className="input" value={action} onChange={(e) => setAction(e.target.value)}>{A.map((a) => <option key={a}>{a}</option>)}</select>
          </div>
          <div>
            <label className="field-label">Automation Name</label>
            <input className="input" placeholder="e.g. Daily Briefing Digest" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </div>
        <button className="btn-primary mt-4" onClick={save} disabled={!name.trim() || create.isPending}>
          <Save size={15} /> {create.isPending ? "Saving…" : "Save Automation"}
        </button>
      </div>
    </div>
  );
}
