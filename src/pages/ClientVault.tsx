import { useState } from "react";
import { MessageSquare, ChevronRight, CheckCircle2 } from "lucide-react";
import type { Client } from "@/types/db";
import { Badge, PageHeader, Modal } from "@/components/ui";
import { initials } from "@/lib/utils";
import { useClients, useTasks, useMeetings } from "@/data/hooks";

export default function ClientVault() {
  const { data: clients = [], isLoading } = useClients();
  const { data: tasks = [] } = useTasks();
  const { data: meetings = [] } = useMeetings();
  const [open, setOpen] = useState<Client | null>(null);

  const statusTone = (s: string) =>
    s.toLowerCase().includes("urgent") ? "urgent" : s.toLowerCase().includes("progress") ? "in_progress" : "pending";

  return (
    <div>
      <PageHeader title="Client Vault" subtitle="Complete profiles and preferences for every client" />

      {isLoading ? (
        <p className="text-sm text-faint">Loading clients…</p>
      ) : clients.length === 0 ? (
        <div className="card p-10 text-center text-sm text-faint">No clients yet. Add your first client to get started.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {clients.map((c) => (
            <div key={c.id} className="card flex flex-col p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/20 text-sm font-semibold text-accent-soft">
                  {initials(c.name)}
                </div>
                <div>
                  <h3 className="font-semibold">{c.name}</h3>
                  <p className="text-xs text-faint">{c.title}</p>
                  <p className="text-xs text-faint">{c.company}</p>
                </div>
              </div>
              {(c.preferred_channel || c.tone) && (
                <div className="mt-4 flex items-center gap-1.5 text-xs text-muted">
                  <MessageSquare size={13} />
                  <span>Prefers</span>
                  <span className="font-medium text-zinc-200">{c.preferred_channel}</span>
                  {c.tone && <><span>·</span><span>{c.tone}</span></>}
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {c.tags?.map((t) => <span key={t} className="pill bg-surface-2 text-faint">{t}</span>)}
              </div>
              <button className="btn-ghost mt-4 justify-between border border-border" onClick={() => setOpen(c)}>
                View Full Profile <ChevronRight size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal open={open !== null} onClose={() => setOpen(null)}>
        {open && (() => {
          const active = tasks.filter((t) => t.client_name === open.name && t.status !== "done");
          const sched = meetings.filter((m) => m.with === open.name);
          return (
            <div>
              <div className="flex items-center gap-4 border-b border-border pb-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/20 text-lg font-semibold text-accent-soft">
                  {initials(open.name)}
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{open.name}</h2>
                  <p className="text-sm text-faint">{open.title}, {open.company}</p>
                  {(open.preferred_channel || open.tone) && (
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                      <MessageSquare size={12} />
                      {open.preferred_channel}{open.tone ? ` · ${open.tone} tone` : ""}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 space-y-4">
                {open.bio && <Section title="Biography"><p className="text-sm text-muted">{open.bio}</p></Section>}

                <Section title="Active Tasks">
                  {active.length ? (
                    <div className="space-y-2">
                      {active.map((t) => (
                        <div key={t.id} className="flex items-center gap-2 text-sm">
                          <CheckCircle2 size={14} className="text-faint" />
                          <span className="flex-1">{t.title}</span>
                          <Badge tone={t.priority}>{t.status === "in_progress" ? "In Progress" : "To Do"}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-faint">No active tasks.</p>}
                </Section>

                {open.preferences_notes && (
                  <Section title="Preferences & Notes"><p className="text-sm text-muted">{open.preferences_notes}</p></Section>
                )}

                <Section title="Upcoming Schedule">
                  {sched.length ? (
                    <div className="space-y-2">
                      {sched.map((m) => (
                        <div key={m.id} className="flex gap-3 text-sm">
                          <span className="w-28 shrink-0 text-xs font-medium text-muted">{m.time}</span>
                          <span>{m.title}</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-faint">Nothing scheduled.</p>}
                </Section>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="field-label">{title}</p>
      {children}
    </div>
  );
}
