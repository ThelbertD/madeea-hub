import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export interface GeneratePayload {
  tool: "quick_action" | "studio" | "bookkeeping";
  format: string;
  inputs: Record<string, string>;
}

/**
 * Calls the `generate` Edge Function (OpenAI, server-side). The browser never
 * holds the model key. In demo mode (no Supabase configured) returns a clearly
 * labelled placeholder so the UX is exercisable end-to-end.
 */
export async function generate(payload: GeneratePayload): Promise<string> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.functions.invoke("generate", { body: payload });
    if (error) throw error;
    return (data as { output: string }).output;
  }
  // Demo fallback
  await new Promise((r) => setTimeout(r, 700));
  const filled = Object.entries(payload.inputs)
    .filter(([, v]) => v)
    .map(([k, v]) => `• ${k}: ${v}`)
    .join("\n");
  return [
    `[DEMO OUTPUT — ${payload.format}]`,
    "",
    "Connect Supabase + set OPENAI_API_KEY to generate real output.",
    "",
    "Inputs received:",
    filled || "(none)",
  ].join("\n");
}

import type { PrepContext } from "@/lib/meetingPrep";

export interface MeetingBrief {
  summary: string;
  /** "claude" once the meeting-prep Edge Function is deployed; "offline" until then. */
  source: "claude" | "offline";
}

/**
 * Turns an already-assembled PrepContext into a 2–3 sentence "what you need to
 * know walking in" brief. Same transport shape as `generate` — the browser hands
 * the context to an Edge Function and never holds a model key.
 *
 * The `meeting-prep` function isn't deployed yet, so a failed invoke falls back to
 * a deterministic brief composed from the same context. That keeps the packet
 * usable today; deploying the function is the only step needed to switch it on.
 */
export async function generateMeetingBrief(context: PrepContext): Promise<MeetingBrief> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.functions.invoke("meeting-prep", {
        body: { context },
      });
      if (error) throw error;
      const summary = (data as { summary?: string }).summary?.trim();
      if (summary) return { summary, source: "claude" };
    } catch {
      // Function not deployed (or transient failure) — fall through to the offline brief.
    }
  }
  await new Promise((r) => setTimeout(r, 400));
  return { summary: offlineBrief(context), source: "offline" };
}

function offlineBrief(ctx: PrepContext): string {
  const parts: string[] = [];
  const { client, recent, openItems, docs } = ctx;

  parts.push(
    client
      ? `${ctx.meeting.title} with ${client.name} (${client.title}, ${client.company}) — an external meeting${client.tone ? `; they prefer a ${client.tone.toLowerCase()} tone` : ""}.`
      : `${ctx.meeting.title} — an internal meeting with no matching client on file.`,
  );

  const last = recent[0];
  if (last) parts.push(`Most recent contact: ${last.label.toLowerCase()} ${last.when} — ${last.detail}.`);

  if (openItems.length) {
    const urgent = openItems.filter((t) => t.priority === "urgent" || t.priority === "high");
    parts.push(
      `${openItems.length} open action item${openItems.length === 1 ? "" : "s"}${urgent.length ? `, ${urgent.length} of them high priority — lead with "${urgent[0].title}"` : ""}.`,
    );
  } else if (client) {
    parts.push("No open action items for this client.");
  }

  if (docs.length) parts.push(`${docs.length} recent document${docs.length === 1 ? "" : "s"} on file, latest ${docs[0].when}.`);

  return parts.join(" ");
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function assistantChat(messages: ChatMessage[]): Promise<string> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.functions.invoke("assistant-chat", { body: { messages } });
    if (error) throw error;
    return (data as { reply: string }).reply;
  }
  await new Promise((r) => setTimeout(r, 600));
  return "[DEMO] I'm the MadeEA assistant. Connect Supabase + OpenAI to enable live, context-aware replies that know Sarah's tasks and clients.";
}
