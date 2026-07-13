// Edge Function: calendar-sync   (Verify JWT: ON)
// Pulls the signed-in user's upcoming Google Calendar events into the meetings table.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

async function accessToken(refresh: string): Promise<string> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      refresh_token: refresh,
      grant_type: "refresh_token",
    }),
  });
  const t = await r.json();
  if (!r.ok) throw new Error(`token refresh failed: ${JSON.stringify(t)}`);
  return t.access_token;
}

interface ClientRow { id: string; name: string; email: string | null; domains: string[] | null }

/** Resolve an attendee address to a client: exact email first, then domain. */
function matchClient(email: string, clients: ClientRow[]): string | null {
  const addr = email.toLowerCase();
  const domain = addr.split("@")[1] ?? "";
  const exact = clients.find((c) => c.email && c.email.toLowerCase() === addr);
  if (exact) return exact.id;
  const byDomain = clients.find((c) => (c.domains ?? []).some((d) => d && domain === d.toLowerCase()));
  return byDomain?.id ?? null;
}

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

    const { data: cred } = await supa.from("google_credentials").select("refresh_token").eq("owner_id", u.user.id).maybeSingle();
    if (!cred?.refresh_token) return json({ error: "Google not connected" }, 400);
    const token = await accessToken(cred.refresh_token);

    // Clients, so an attendee's email address can resolve to a client record.
    // Without this every synced meeting lands with client_id = null, and no meeting
    // ever appears on a client's timeline.
    const { data: clientRows } = await supa.from("clients").select("id,name,email,domains");
    const clients = (clientRows ?? []) as ClientRow[];

    // The window used to be timeMin = now, i.e. upcoming meetings only. An activity
    // log is a question about the PAST ("what did we do last month"), so it has to
    // reach backwards as well as forwards.
    const from = new Date(Date.now() - 90 * 86_400_000).toISOString();
    const to = new Date(Date.now() + 30 * 86_400_000).toISOString();
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events` +
        `?timeMin=${encodeURIComponent(from)}&timeMax=${encodeURIComponent(to)}` +
        `&maxResults=250&singleEvents=true&orderBy=startTime`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const list = await res.json();

    let synced = 0;
    for (const ev of list.items ?? []) {
      const start = ev.start?.dateTime ?? ev.start?.date;
      const startedAt = start ? new Date(start) : null;

      // Everyone on the invite except us. `self` marks the calendar owner.
      const emails: string[] = (ev.attendees ?? [])
        .filter((a: { self?: boolean; email?: string }) => !a.self && a.email)
        .map((a: { email: string }) => a.email.toLowerCase());

      const clientId = emails.map((e) => matchClient(e, clients)).find(Boolean) ?? null;

      const { error } = await supa.from("meetings").upsert(
        {
          gcal_event_id: ev.id,
          source: "gcal",
          title: ev.summary ?? "(busy)",
          starts_at: startedAt ? startedAt.toISOString() : null,
          attendee_emails: emails,
          client_id: clientId,
          // A meeting that already happened isn't "pending" — the old code marked
          // everything pending because it only ever fetched future events.
          status: startedAt && startedAt.getTime() < Date.now() ? "prepared" : "pending",
        },
        { onConflict: "workspace_id,gcal_event_id" },
      );
      if (!error) synced++;
    }
    return json({ synced });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
