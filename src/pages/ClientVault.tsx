import { useState } from "react";
import { MessageSquare, ChevronRight, CheckCircle2, Plus, Trash2, Pencil } from "lucide-react";
import type { Client } from "@/types/db";
import { Badge, PageHeader, Modal } from "@/components/ui";
import { initials } from "@/lib/utils";
import { useClients, useTasks, useMeetings, useClientMutations } from "@/data/hooks";

const BLANK = { name: "", title: "", company: "", preferred_channel: "Email", tone: "Formal", tags: "", bio: "", preferences_notes: "" };

export default function ClientVault() {
  const { data: clients = [], isLoading } = useClients();
  const { data: tasks = [] } = useTasks();
  const { data: meetings = [] } = useMeetings();
  const { create, update, remove } = useClientMutations();
  const [open, setOpen] = useState<Client | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(BLANK);

  function startCreate() {
    setForm(BLANK); setEditingId(null); setAdding(true);
  }
  function startEdit(c: Client) {
    setForm({
      name: c.name ?? "", title: c.title ?? "", company: c.company ?? "",
      preferred_channel: c.preferred_channel || "Email", tone: c.tone ?? "",
      tags: (c.tags ?? []).join(", "), bio: c.bio ?? "", preferences_notes: c.preferences_notes ?? "",
    });
    setEditingId(c.id); setOpen(null); setAdding(true);
  }

  function submit() {
    if (!form.name.trim()) return;
    const payload = {
      name: form.name.trim(), title: form.title, company: form.company,
      preferred_channel: form.preferred_channel, tone: form.tone,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      bio: form.bio, preferences_notes: form.preferences_notes,
    };
    if (editingId) update.mutate({ id: editingId, ...payload });
    else create.mutate(payload);
    setForm(BLANK); setEditingId(null); setAdding(false);
  }
  const saving = create.isPending || update.isPending;
  const set = (k: keyof typeof BLANK) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const statusTone = (s: string) =>
    s.toLowerCase().includes("urgent") ? "urgent" : s.toLowerCase().includes("progress") ? "in_progress" : "pending";

  return (
    <div>
      <PageHeader
        title="Client Vault"
        subtitle="Complete profiles and preferences for every client"
        action={<button className="btn-primary" onClick={startCreate}><Plus size={15} /> New Client</button>}
      />

      {isLoading ? (
        <p className="text-sm text-faint">Loading clients…</p>
      ) : clients.length === 0 ? (
        <div className="card p-10 text-center text-sm text-faint">No clients yet. Add your first client to get started.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {clients.map((c) => (
            <div key={c.id} className="card group flex flex-col p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/20 text-sm font-semibold text-accent-soft">
                  {initials(c.name)}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">{c.name}</h3>
                  <p className="text-xs text-faint">{c.title}</p>
                  <p className="text-xs text-faint">{c.company}</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button className="text-faint hover:text-accent" onClick={() => startEdit(c)} aria-label="Edit client">
                    <Pencil size={14} />
                  </button>
                  <button className="text-faint hover:text-red-400" onClick={() => remove.mutate(c.id)} aria-label="Delete client">
                    <Trash2 size={14} />
                  </button>
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
                <button className="btn-ghost ml-auto border border-border py-1.5" onClick={() => startEdit(open)}>
                  <Pencil size={14} /> Edit
                </button>
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

      <Modal open={adding} onClose={() => { setAdding(false); setEditingId(null); }}>
        <h2 className="mb-4 text-lg font-semibold">{editingId ? "Edit Client" : "New Client"}</h2>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="field-label">Name</label><input className="input" autoFocus value={form.name} onChange={set("name")} placeholder="Full name" /></div>
            <div><label className="field-label">Title</label><input className="input" value={form.title} onChange={set("title")} placeholder="e.g. CEO" /></div>
          </div>
          <div><label className="field-label">Company</label><input className="input" value={form.company} onChange={set("company")} placeholder="Company" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Preferred channel</label>
              <select className="input" value={form.preferred_channel} onChange={set("preferred_channel")}>
                <option>Email</option><option>Slack</option><option>WhatsApp</option><option>Phone</option>
              </select>
            </div>
            <div><label className="field-label">Tone</label><input className="input" value={form.tone} onChange={set("tone")} placeholder="e.g. Formal" /></div>
          </div>
          <div><label className="field-label">Tags (comma separated)</label><input className="input" value={form.tags} onChange={set("tags")} placeholder="Board Prep, Travel" /></div>
          <div><label className="field-label">Biography</label><textarea className="input min-h-[70px]" value={form.bio} onChange={set("bio")} /></div>
          <div><label className="field-label">Preferences & Notes</label><textarea className="input min-h-[70px]" value={form.preferences_notes} onChange={set("preferences_notes")} /></div>
          <button className="btn-primary w-full" onClick={submit} disabled={!form.name.trim() || saving}>
            {saving ? "Saving…" : editingId ? "Save changes" : "Add Client"}
          </button>
        </div>
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
