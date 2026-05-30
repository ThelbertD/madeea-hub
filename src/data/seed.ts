import type { Automation, Client, Meeting, Message, Task } from "@/types/db";

// No dummy data. These empty arrays are the read-only fallback used ONLY in
// demo mode (no Supabase credentials). In live mode every page reads the user's
// real Supabase data. Real records are created through the app (CRUD) or synced
// from integrations (Gmail/Calendar) — never seeded.

export const CLIENTS: Client[] = [];
export const TASKS: Task[] = [];
export const MESSAGES: Message[] = [];
export const MEETINGS: Meeting[] = [];
export const AUTOMATIONS: Automation[] = [];

export const USER = { name: "Demo User", role: "Elite EA", initials: "DU" };
