/**
 * Demo dataset — ONLY loaded when the app is built with VITE_DEMO=1.
 *
 * seed.ts deliberately ships empty arrays ("no dummy data, never seeded"), and
 * that contract is unchanged: a normal build — dev, Vercel, or Pages — still sees
 * empty arrays and reads real records from Supabase. This file exists purely so a
 * preview build has something on screen to click, and it is inert everywhere else.
 */
import type { Client, Meeting, Message, Task } from "@/types/db";

// Anchored to "now" so the packet's relative times ("2 days ago") stay sensible
// however long after this was written the preview gets opened.
const now = Date.now();
const at = (dayOffset: number, hour: number, min = 0): string => {
  const d = new Date(now + dayOffset * 86_400_000);
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
};

export const CLIENTS: Client[] = [
  {
    id: "demo-client-1",
    name: "Priya Raman",
    title: "Chief Operating Officer",
    company: "Northwind Capital",
    preferred_channel: "Email",
    tone: "Formal",
    tags: ["Priority", "Board"],
    bio: "COO at Northwind Capital. Sits on the investment committee and chairs the quarterly board review.",
    preferences_notes:
      "Prefers bullet points over prose. Always wants the numbers before the narrative. Do not schedule anything before 10am.",
    avatar_url: null,
    active_tasks: [],
    schedule: [],
  },
  {
    id: "demo-client-2",
    name: "Marcus Bell",
    title: "Founder",
    company: "Halden Studio",
    preferred_channel: "WhatsApp",
    tone: "Casual",
    tags: ["Creative"],
    bio: "Founder of Halden Studio, a design practice working mainly with hospitality brands.",
    preferences_notes: "Hates long emails. Voice notes are fine. Will reschedule at short notice.",
    avatar_url: null,
    active_tasks: [],
    schedule: [],
  },
];

export const MEETINGS: Meeting[] = [
  {
    id: "demo-meeting-1",
    title: "Q3 Planning Review",
    with: "Priya Raman",
    client_id: "demo-client-1",
    starts_at: at(0, 14, 30),
    time: "2:30 PM",
    status: "needs_prep",
  },
  {
    id: "demo-meeting-2",
    title: "Brand Refresh Kickoff",
    with: "Marcus Bell",
    client_id: "demo-client-2",
    starts_at: at(0, 16, 0),
    time: "4:00 PM",
    status: "pending",
  },
  {
    id: "demo-meeting-3",
    title: "Internal Ops Standup",
    with: "Internal",
    client_id: null,
    starts_at: at(1, 9, 30),
    time: "9:30 AM",
    status: "pending",
  },
  // Past meeting — surfaces as "last meeting" inside Priya's prep packet.
  {
    id: "demo-meeting-0",
    title: "Q2 Board Review",
    with: "Priya Raman",
    client_id: "demo-client-1",
    starts_at: at(-28, 11, 0),
    time: "11:00 AM",
    status: "prepared",
  },
];

export const TASKS: Task[] = [
  {
    id: "demo-task-1",
    title: "Send Q3 board pack to the investment committee",
    client_name: "Priya Raman",
    due_label: "Friday",
    due_at: at(2, 17),
    priority: "urgent",
    status: "todo",
    subtasks: [],
    recurrence: "none",
    depends_on: null,
  },
  {
    id: "demo-task-2",
    title: "Confirm auditor availability for October",
    client_name: "Priya Raman",
    due_label: "Next week",
    due_at: at(6, 12),
    priority: "normal",
    status: "in_progress",
    subtasks: [],
    recurrence: "none",
    depends_on: null,
  },
  {
    id: "demo-task-3",
    title: "Circulate Q2 minutes",
    client_name: "Priya Raman",
    due_label: "Done",
    due_at: at(-7, 12),
    priority: "normal",
    status: "done",
    subtasks: [],
    recurrence: "none",
    depends_on: null,
  },
  {
    id: "demo-task-4",
    title: "Collect moodboard feedback",
    client_name: "Marcus Bell",
    due_label: "Monday",
    due_at: at(4, 10),
    priority: "high",
    status: "todo",
    subtasks: [],
    recurrence: "none",
    depends_on: null,
  },
];

export const MESSAGES: Message[] = [
  {
    id: "demo-msg-1",
    sender_name: "Priya Raman",
    subject: "Re: Q3 board pack — one more thing",
    preview: "Can you add the headcount forecast before Thursday?",
    body: "Can you add the headcount forecast before Thursday? The committee will ask.",
    category: "reply",
    received_at: at(-2, 9, 12),
    time: "9:12 AM",
    client_id: "demo-client-1",
    client_name: "Priya Raman",
    client_title: "Chief Operating Officer, Northwind Capital",
  },
  {
    id: "demo-msg-2",
    sender_name: "Marcus Bell",
    subject: "moodboards",
    preview: "sent you three directions, second one is my favourite",
    body: "sent you three directions, second one is my favourite",
    category: "reply",
    received_at: at(-1, 18, 40),
    time: "6:40 PM",
    client_id: "demo-client-2",
    client_name: "Marcus Bell",
    client_title: "Founder, Halden Studio",
  },
];
