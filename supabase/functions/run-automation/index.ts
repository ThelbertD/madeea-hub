// Edge Function: run-automation   (Verify JWT: OFF — auth enforced in code)
// POST { automation_id } -> runs the automation on the caller's live data with
// OpenAI, records the run (succeeded OR failed), bumps counters.
// Returns { summary, output } or { error }.
//
// The run row is written BEFORE the work starts, as 'running', and updated to
// 'succeeded' / 'failed' once it settles. Previously a crash returned a 500 and
// recorded nothing at all, so failures were invisible — the whole point of the
// health monitor is that they aren't. Requires migration 0014.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

async function complete(system: string, user: string, model = "gpt-4o"): Promise<string> {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model, temperature: 0.5, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${JSON.stringify(data)}`);
  return data.choices?.[0]?.message?.content ?? "";
}

const EA =
  "You are MadeEA, an elite executive-assistant operations engine. Clear British English, concise, immediately useful. Use markdown.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "unauthorized" }, 401);
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u } = await supa.auth.getUser();
    if (!u?.user) return json({ error: "unauthorized" }, 401);

    const { automation_id } = await req.json();
    const { data: automation, error: aErr } = await supa
      .from("automations").select("id,name,automation_key,total_runs,trigger,action").eq("id", automation_id).single();
    if (aErr || !automation) return json({ error: "automation not found" }, 404);

    // Claim the run up front. If the function dies mid-flight the row is left as
    // 'running', which the health view reports as a stuck run rather than
    // pretending nothing happened.
    const startedAt = Date.now();
    const { data: run } = await supa
      .from("automation_runs")
      .insert({ automation_id, status: "running", summary: "Running…" })
      .select("id")
      .single();
    const runId = run?.id ?? null;

    const finish = async (fields: Record<string, unknown>) => {
      if (!runId) return;
      await supa
        .from("automation_runs")
        .update({ ...fields, duration_ms: Date.now() - startedAt, finished_at: new Date().toISOString() })
        .eq("id", runId);
    };

    try {
    const key = automation.automation_key ?? "custom";
    let summary = "";
    let output = "";

    if (key === "priority_alignment") {
      const [{ data: tasks }, { data: meetings }, { data: messages }] = await Promise.all([
        supa.from("tasks").select("title,priority,status,due_label").neq("status", "done").limit(50),
        supa.from("meetings").select("title,status,starts_at").limit(20),
        supa.from("messages").select("sender_name,subject,category").eq("category", "urgent").limit(20),
      ]);
      output = await complete(
        EA,
        `Produce a prioritised daily briefing for the executive. Rank what matters, flag conflicts and urgent items, and suggest schedule optimisations.\n\nTasks: ${JSON.stringify(tasks ?? [])}\nMeetings: ${JSON.stringify(meetings ?? [])}\nUrgent messages: ${JSON.stringify(messages ?? [])}`,
      );
      summary = `Daily brief generated — ${(tasks ?? []).length} open tasks, ${(meetings ?? []).length} meetings, ${(messages ?? []).length} urgent.`;
    } else if (key === "meeting_prep") {
      const { data: meetings } = await supa
        .from("meetings").select("title,status,starts_at,clients(name,title,company,preferred_channel,tone,preferences_notes)").limit(10);
      output = await complete(
        EA,
        `Prepare concise prep briefs for these upcoming meetings — for each: attendee context, a suggested agenda, and prep notes.\n\n${JSON.stringify(meetings ?? [])}`,
      );
      summary = `Prepared ${(meetings ?? []).length} upcoming meeting(s).`;
    } else if (key === "inbox_triage") {
      // rule-based: auto-archive newsletters
      await supa.from("messages").update({ category: "archive" }).ilike("sender_name", "%newsletter%").neq("category", "archive");
      const { data: messages } = await supa.from("messages").select("sender_name,subject,preview,category").limit(40);
      output = await complete(
        EA,
        `Triage this inbox. Summarise what needs the executive's attention, group by urgency, and suggest who/what to delegate or archive.\n\n${JSON.stringify(messages ?? [])}`,
        "gpt-4o-mini",
      );
      summary = `Triaged ${(messages ?? []).length} message(s); newsletters archived.`;
    } else {
      output = await complete(
        EA,
        `Automation "${automation.name}". Trigger: ${automation.trigger ?? "—"}. Action: ${automation.action ?? "—"}. Produce the most useful output this automation would generate.`,
      );
      summary = `Ran ${automation.name}.`;
    }

    await finish({ status: "succeeded", summary, output: { text: output }, error_message: null });
    await supa.from("automations").update({ total_runs: (automation.total_runs ?? 0) + 1, last_run_at: new Date().toISOString() }).eq("id", automation_id);

    return json({ summary, output });
    } catch (e) {
      // The failure is now a first-class record, not a lost 500.
      const message = String(e instanceof Error ? e.message : e);
      await finish({ status: "failed", summary: "Run failed", error_message: message.slice(0, 2000) });
      await supa.from("automations").update({ last_run_at: new Date().toISOString() }).eq("id", automation_id);
      return json({ error: message }, 500);
    }
  } catch (e) {
    // Failed before we could even claim a run row (bad auth, bad payload).
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
