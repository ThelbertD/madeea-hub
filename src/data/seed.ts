import type { Automation, Client, Meeting, Message, Task, Sop } from "@/types/db";

// No dummy data. These empty arrays are the read-only fallback used ONLY in
// demo mode (no Supabase credentials). In live mode every page reads the user's
// real Supabase data. Real records are created through the app (CRUD) or synced
// from integrations (Gmail/Calendar) — never seeded.

export const CLIENTS: Client[] = [];
export const TASKS: Task[] = [];
export const MESSAGES: Message[] = [];
export const MEETINGS: Meeting[] = [];
export const AUTOMATIONS: Automation[] = [];

// Default SOPs (product templates, not user data) — fallback for demo mode.
// In live mode these are seeded globally by migration 0007.
export const SOPS: Sop[] = [
  {
    id: "sop-inbox",
    title: "Inbox Triage",
    description: "Acknowledge, assess and action an incoming request to standard.",
    category: "Communication",
    steps: [
      { id: "ack", label: "Request acknowledged within 15 minutes", required: true },
      { id: "urgency", label: "Urgency assigned (Urgent / Standard / Low)", required: true },
      { id: "profile", label: "Client profile reviewed", required: true },
      { id: "ai", label: "AI support used (if applicable)", required: false, ai_action: "Run Inbox Triage" },
      { id: "review", label: "Output reviewed against quality standards", required: true },
      { id: "deliver", label: "Response / action delivered", required: true },
      { id: "prefs", label: "Client preferences updated (if applicable)", required: false },
    ],
    success_criteria: [
      "Client has received a response",
      "Required action has been completed",
      "CRM / system has been updated",
      "Client profile updated with any new preferences",
    ],
  },
];

export const USER = { name: "Demo User", role: "Elite EA", initials: "DU" };
