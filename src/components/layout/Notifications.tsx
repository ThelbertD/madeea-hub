import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, AlertCircle, CheckSquare, CalendarClock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMessages, useTasks } from "@/data/hooks";

interface Notif {
  id: string;
  icon: typeof AlertCircle;
  title: string;
  desc: string;
  path: string;
}

const STORE = "madeea-notif-read";
const loadRead = (): Set<string> => {
  try { return new Set(JSON.parse(localStorage.getItem(STORE) || "[]")); } catch { return new Set(); }
};

export function Notifications() {
  const nav = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState<Set<string>>(loadRead);
  const { data: messages = [] } = useMessages();
  const { data: tasks = [] } = useTasks();

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const items = useMemo<Notif[]>(() => {
    const todayUtc = new Date().toISOString().slice(0, 10);
    const out: Notif[] = [];
    for (const m of messages.filter((x) => x.category === "urgent")) {
      out.push({ id: `msg-${m.id}`, icon: AlertCircle, title: "Urgent message", desc: `${m.sender_name} · ${m.subject}`, path: "/communication" });
    }
    for (const t of tasks.filter((x) => x.status !== "done")) {
      if (t.priority === "urgent") out.push({ id: `task-${t.id}`, icon: CheckSquare, title: "Urgent task", desc: t.title, path: "/tasks" });
      else if (t.due_at && t.due_at.slice(0, 10) <= todayUtc) out.push({ id: `due-${t.id}`, icon: CalendarClock, title: "Task due", desc: t.title, path: "/tasks" });
    }
    return out;
  }, [messages, tasks]);

  const unread = items.filter((i) => !read.has(i.id));

  function persist(next: Set<string>) {
    setRead(next);
    localStorage.setItem(STORE, JSON.stringify([...next]));
  }
  function pick(n: Notif) {
    persist(new Set(read).add(n.id));
    nav(n.path);
    setOpen(false);
  }
  function markAll() {
    persist(new Set(items.map((i) => i.id)));
  }

  return (
    <div className="relative" ref={ref}>
      <button className="btn-ghost relative px-2" onClick={() => setOpen((o) => !o)} aria-label="Notifications">
        <Bell size={18} />
        {unread.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
            {unread.length}
          </span>
        )}
      </button>

      {open && (
        <div className="card absolute right-0 z-50 mt-2 max-h-96 w-80 overflow-y-auto p-2 shadow-xl">
          <div className="flex items-center justify-between px-2 py-1">
            <p className="text-sm font-semibold">Notifications</p>
            {unread.length > 0 && (
              <button className="text-xs text-accent-soft hover:underline" onClick={markAll}>Mark all read</button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-faint">You're all caught up.</p>
          ) : (
            items.map((n) => {
              const isUnread = !read.has(n.id);
              return (
                <button
                  key={n.id}
                  onClick={() => pick(n)}
                  className={`flex w-full items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-surface-2 ${isUnread ? "" : "opacity-60"}`}
                >
                  <n.icon size={15} className={`mt-0.5 shrink-0 ${isUnread ? "text-accent" : "text-faint"}`} />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{n.title}</span>
                    <span className="block truncate text-xs text-faint">{n.desc}</span>
                  </span>
                  {isUnread && <span className="ml-auto mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
