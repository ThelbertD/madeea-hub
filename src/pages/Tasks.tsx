import { useEffect, useState } from "react";
import {
  DndContext, DragOverlay, PointerSensor, KeyboardSensor, useSensor, useSensors,
  closestCorners, type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, Trash2, GripVertical, Pencil, CalendarDays } from "lucide-react";
import type { Task, TaskStatus, Priority } from "@/types/db";
import { Badge, PageHeader, Modal } from "@/components/ui";
import { useTasks, useTaskMutations } from "@/data/hooks";
import { cn } from "@/lib/utils";

const COLUMNS: { key: TaskStatus; label: string }[] = [
  { key: "todo", label: "To Do" },
  { key: "in_progress", label: "In Progress" },
  { key: "done", label: "Done" },
];
const priorityLabel: Record<string, string> = { urgent: "Urgent", high: "High", normal: "Normal", low: "Low" };

const dueDisplay = (t: Task): string =>
  t.due_at
    ? new Date(t.due_at).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" })
    : t.due_label || "No date";

type Board = Record<TaskStatus, Task[]>;
const group = (tasks: Task[]): Board => ({
  todo: tasks.filter((t) => t.status === "todo"),
  in_progress: tasks.filter((t) => t.status === "in_progress"),
  done: tasks.filter((t) => t.status === "done"),
});

function CardBody({ task, onDelete, onEdit, overlay }: { task: Task; onDelete?: () => void; onEdit?: () => void; overlay?: boolean }) {
  const stop = (e: React.PointerEvent) => e.stopPropagation();
  return (
    <div className={cn("rounded-lg bg-surface-2 p-3", overlay ? "shadow-xl ring-2 ring-accent/60 rotate-1" : "shadow-sm")}>
      <div className="flex items-start gap-2">
        <GripVertical size={14} className="mt-0.5 shrink-0 text-faint" />
        <p className="flex-1 text-sm font-medium">{task.title}</p>
        {onEdit && (
          <button className="text-faint opacity-0 transition-opacity hover:text-accent group-hover:opacity-100" onPointerDown={stop} onClick={onEdit} aria-label="Edit task">
            <Pencil size={13} />
          </button>
        )}
        {onDelete && (
          <button className="text-faint opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100" onPointerDown={stop} onClick={onDelete} aria-label="Delete task">
            <Trash2 size={13} />
          </button>
        )}
      </div>
      <p className="mt-1 flex items-center gap-1 pl-6 text-xs text-faint">
        {task.client_name}<span>·</span><CalendarDays size={11} />{dueDisplay(task)}
      </p>
      <div className="mt-2 pl-6"><Badge tone={task.priority}>{priorityLabel[task.priority]}</Badge></div>
    </div>
  );
}

function SortableCard({ task, onDelete, onEdit }: { task: Task; onDelete: () => void; onEdit: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} {...attributes} {...listeners}
      className={cn("group touch-none cursor-grab active:cursor-grabbing", isDragging && "opacity-40")}>
      <CardBody task={task} onDelete={onDelete} onEdit={onEdit} />
    </div>
  );
}

function Column({ status, label, items, onDelete, onEdit }: { status: TaskStatus; label: string; items: Task[]; onDelete: (id: string) => void; onEdit: (t: Task) => void }) {
  const { setNodeRef } = useSortable({ id: status, data: { type: "column" } });
  return (
    <div className="card flex flex-col p-4">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold">{label}</h2>
        <span className="pill bg-surface-2 text-faint">{items.length}</span>
      </div>
      <SortableContext id={status} items={items.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="min-h-[160px] flex-1 space-y-2 rounded-lg">
          {items.map((t) => <SortableCard key={t.id} task={t} onDelete={() => onDelete(t.id)} onEdit={() => onEdit(t)} />)}
          {items.length === 0 && <p className="py-8 text-center text-xs text-faint">Drop here</p>}
        </div>
      </SortableContext>
    </div>
  );
}

const BLANK = { title: "", priority: "normal" as Priority, due: "" };

export default function Tasks() {
  const { data: tasks = [], isLoading } = useTasks();
  const { setStatus, create, update, remove } = useTaskMutations();
  const [board, setBoard] = useState<Board>(group([]));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(BLANK);

  useEffect(() => { if (!activeId) setBoard(group(tasks)); }, [tasks, activeId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const columnOf = (id: string): TaskStatus | null => {
    if (id in board) return id as TaskStatus;
    return (Object.keys(board) as TaskStatus[]).find((k) => board[k].some((t) => t.id === id)) ?? null;
  };
  const activeTask = activeId ? Object.values(board).flat().find((t) => t.id === activeId) ?? null : null;

  function onDragStart(e: DragStartEvent) { setActiveId(String(e.active.id)); }
  function onDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    const from = columnOf(String(active.id));
    const to = columnOf(String(over.id));
    if (!from || !to || from === to) return;
    setBoard((b) => {
      const moving = b[from].find((t) => t.id === active.id);
      if (!moving) return b;
      const overIdx = b[to].findIndex((t) => t.id === over.id);
      const insertAt = overIdx >= 0 ? overIdx : b[to].length;
      return {
        ...b,
        [from]: b[from].filter((t) => t.id !== active.id),
        [to]: [...b[to].slice(0, insertAt), { ...moving, status: to }, ...b[to].slice(insertAt)],
      };
    });
  }
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;
    const col = columnOf(String(active.id));
    if (col) {
      setBoard((b) => {
        const oldIdx = b[col].findIndex((t) => t.id === active.id);
        const newIdx = b[col].findIndex((t) => t.id === over.id);
        if (oldIdx >= 0 && newIdx >= 0 && oldIdx !== newIdx) return { ...b, [col]: arrayMove(b[col], oldIdx, newIdx) };
        return b;
      });
    }
    const serverTask = tasks.find((t) => t.id === active.id);
    if (serverTask && col && serverTask.status !== col) setStatus.mutate({ id: serverTask.id, status: col });
  }

  function startCreate() { setForm(BLANK); setEditingId(null); setModal(true); }
  function startEdit(t: Task) {
    setForm({ title: t.title, priority: t.priority, due: t.due_at ? t.due_at.slice(0, 10) : "" });
    setEditingId(t.id); setModal(true);
  }
  function submit() {
    if (!form.title.trim()) return;
    const due_at = form.due ? form.due : null;
    if (editingId) update.mutate({ id: editingId, title: form.title.trim(), priority: form.priority, due_at });
    else create.mutate({ title: form.title.trim(), priority: form.priority, due_at });
    setForm(BLANK); setEditingId(null); setModal(false);
  }
  const saving = create.isPending || update.isPending;

  return (
    <div>
      <PageHeader
        title="Task Manager"
        subtitle="Drag cards between columns to update status"
        action={<button className="btn-primary" onClick={startCreate}><Plus size={15} /> Add Task</button>}
      />

      {isLoading ? (
        <p className="text-sm text-faint">Loading tasks…</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
          <div className="grid gap-4 lg:grid-cols-3">
            {COLUMNS.map((col) => (
              <Column key={col.key} status={col.key} label={col.label} items={board[col.key]} onDelete={(id) => remove.mutate(id)} onEdit={startEdit} />
            ))}
          </div>
          <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}>
            {activeTask ? <CardBody task={activeTask} overlay /> : null}
          </DragOverlay>
        </DndContext>
      )}

      <Modal open={modal} onClose={() => { setModal(false); setEditingId(null); }}>
        <h2 className="mb-4 text-lg font-semibold">{editingId ? "Edit Task" : "Add Task"}</h2>
        <div className="space-y-3">
          <div>
            <label className="field-label">Title</label>
            <input className="input" autoFocus value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Draft investor update" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Priority</label>
              <select className="input" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as Priority }))}>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="field-label">Due date</label>
              <input type="date" className="input" value={form.due} onChange={(e) => setForm((f) => ({ ...f, due: e.target.value }))} />
            </div>
          </div>
          <button className="btn-primary w-full" onClick={submit} disabled={!form.title.trim() || saving}>
            {saving ? "Saving…" : editingId ? "Save changes" : "Add Task"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
