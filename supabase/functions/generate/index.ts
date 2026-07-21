// Supabase Edge Function: generate  (self-contained — paste as-is)
// POST { tool, format, inputs, client_id? } -> { output }
// Generates an EA document with OpenAI and logs it to ai_generations.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const MODELS = { premium: "gpt-4o", cheap: "gpt-4o-mini" } as const;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface LlmMessage { role: "system" | "user" | "assistant"; content: string }

async function complete(messages: LlmMessage[], model: keyof typeof MODELS = "premium"): Promise<string> {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: MODELS[model], messages, temperature: 0.6 }),
  });
  if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

const BASE =
  "You are MadeEA, an elite executive-assistant writing engine. Write in clear British English. " +
  "Be concise, precise and immediately usable. Never invent facts that weren't supplied; mark unknowns as [TBC].";

// The Second Brain tools all share one hard rule: the app has already done the
// arithmetic, and the model must not redo it. Every figure in the details block was
// computed from the database or typed by the EA. Recomputing, rounding or
// "improving" a number is the one failure mode that makes these documents unusable,
// because the reader has no way to spot it.
const FACTS_ONLY =
  "The details below are pre-computed facts. Reuse every figure, date and duration EXACTLY as given — " +
  "do not recalculate, re-round, extrapolate or add numbers of your own. If something needed is absent, write [TBC].";

function systemFor(tool: string, format: string): string {
  if (tool === "studio")
    return `${BASE} You are producing a "${format}". Match the requested tone exactly. Return only the finished document, no preamble.`;
  if (tool === "bookkeeping")
    return `${BASE} You are producing a finance document: "${format}". Use clean structured layout, show totals, flag anything over budget. Currency as provided (default £).`;
  if (tool === "homework")
    return `${BASE} ${FACTS_ONLY} You are briefing an EA on what they must prepare before their upcoming commitments. ` +
      "Open with the single most urgent thing. Group by when it's needed. Be specific about the action, not the feeling. " +
      "Maximum 200 words. No pep talk.";
  if (tool === "scoreboard")
    return `${BASE} ${FACTS_ONLY} You are writing a short performance narrative for an EA desk. ` +
      "Say what moved and what it means in practice. Name the one thing most worth fixing. " +
      "Where a data caveat is listed, state it plainly rather than presenting the number as complete. " +
      "Never describe a null or missing measure as zero. Maximum 250 words.";
  if (tool === "investor_update")
    return `${BASE} ${FACTS_ONLY} You are drafting an investor update for the named recipients. ` +
      "Structure: headline, what shipped, metrics, risks and lowlights, asks, close. " +
      "Include the risks section even when it is short — an update with no lowlights reads as evasive. " +
      "Only cite metrics supplied below. Omit any section whose input says none was supplied.";
  if (tool === "travel")
    return `${BASE} ${FACTS_ONLY} You are producing a travel itinerary document for an executive. ` +
      "All times, durations, layovers and timezone shifts are already calculated — copy them verbatim; do not convert timezones yourself. " +
      "Lead with the leave-home-by time. Include a 'Watch out' section reproducing every issue listed. End with the preparation checklist.";
  return `${BASE} Action: "${format}". Produce the most useful one-shot output for an EA serving senior executives.`;
}

function userFor(format: string, inputs: Record<string, string>): string {
  const lines = Object.entries(inputs)
    .filter(([, v]) => v && String(v).trim())
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  return `Task: ${format}\n\nDetails:\n${lines || "(no specific details — use sensible defaults, mark gaps [TBC])"}`;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    // Auth enforced in-code (so the function can run with Verify JWT off, which
    // is required for browser CORS preflight to pass).
    const authHeader0 = req.headers.get("Authorization");
    if (!authHeader0) return json({ error: "unauthorized" }, 401);
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader0 } } },
    );
    const { data: authed } = await authClient.auth.getUser();
    if (!authed?.user) return json({ error: "unauthorized" }, 401);

    const { tool, format, inputs = {}, client_id = null } = await req.json();
    if (!tool || !format) return json({ error: "tool and format are required" }, 400);

    const output = await complete([
      { role: "system", content: systemFor(tool, format) },
      { role: "user", content: userFor(format, inputs) },
    ]);

    // Best-effort history log (SUPABASE_URL / SUPABASE_ANON_KEY are auto-injected by the platform).
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: u } = await supabase.auth.getUser();
      if (u?.user) {
        await supabase.from("ai_generations").insert({
          owner_id: u.user.id, client_id, tool, format, inputs, output,
        });
      }
    }

    return json({ output });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
