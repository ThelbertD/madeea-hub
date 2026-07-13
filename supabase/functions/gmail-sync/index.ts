// Edge Function: gmail-sync   (Verify JWT: ON)
//
// Walks recent Gmail THREADS (not just inbox messages) and stores both directions
// of the conversation, plus the link between a message and the reply that followed
// it. That linkage is what makes two features possible:
//
//   inbound  → first_reply_at     = when WE answered  (null = we owe them)   → SLA
//   outbound → reply_received_at  = when THEY answered (null = they went quiet) → dead threads
//
// The previous version queried `q=in:inbox` and stored inbound mail only, so the
// app had no idea what had been sent and could not tell a dead thread from a live
// one. Requires migration 0013.
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

const g = (token: string, u: string) => fetch(u, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());

const senderName = (from: string) => (from.match(/^"?([^"<]+?)"?\s*</)?.[1] ?? from.replace(/<.*>/, "")).trim() || from;
const senderEmail = (from: string) => (from.match(/<([^>]+)>/)?.[1] ?? from).trim().toLowerCase();
const ini = (n: string) => n.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

interface ClientRow { id: string; name: string; email: string | null; domains: string[] | null }

/** Resolve a counterparty address to a client: exact email first, then domain. */
function matchClient(email: string, clients: ClientRow[]): string | null {
  const addr = email.toLowerCase();
  const domain = addr.split("@")[1] ?? "";
  const exact = clients.find((c) => c.email && c.email.toLowerCase() === addr);
  if (exact) return exact.id;
  const byDomain = clients.find((c) => (c.domains ?? []).some((d) => d && domain === d.toLowerCase()));
  return byDomain?.id ?? null;
}

interface Flat {
  gmail_id: string;
  thread_id: string;
  ts: number;
  from: string;
  subject: string;
  snippet: string;
  outbound: boolean;
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

    const { data: cred } = await supa
      .from("google_credentials").select("refresh_token").eq("owner_id", u.user.id).maybeSingle();
    if (!cred?.refresh_token) return json({ error: "Google not connected" }, 400);
    const token = await accessToken(cred.refresh_token);

    // Who "we" are — the only reliable way to tell outbound from inbound.
    const profile = await g(token, "https://gmail.googleapis.com/gmail/v1/users/me/profile");
    const me = String(profile.emailAddress ?? "").toLowerCase();
    if (!me) return json({ error: "could not read Gmail profile" }, 502);

    const { data: clientRows } = await supa.from("clients").select("id,name,email,domains");
    const clients = (clientRows ?? []) as ClientRow[];

    // Threads touching either the inbox or sent mail, over the window the nudge
    // thresholds actually care about.
    const list = await g(
      token,
      "https://gmail.googleapis.com/gmail/v1/users/me/threads?maxResults=40&q=" +
        encodeURIComponent("newer_than:90d (in:inbox OR in:sent)"),
    );

    let synced = 0;
    for (const th of list.threads ?? []) {
      const full = await g(
        token,
        `https://gmail.googleapis.com/gmail/v1/users/me/threads/${th.id}?format=metadata` +
          "&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date",
      );

      // Flatten the thread in chronological order so "the reply after this one" is
      // simply the next message from the other side.
      const msgs: Flat[] = (full.messages ?? [])
        .map((m: any) => {
          const h: Record<string, string> = Object.fromEntries(
            (m.payload?.headers ?? []).map((x: { name: string; value: string }) => [x.name, x.value]),
          );
          const from = h.From ?? "";
          return {
            gmail_id: m.id,
            thread_id: th.id,
            ts: parseInt(m.internalDate ?? "0", 10),
            from,
            subject: h.Subject ?? "(no subject)",
            snippet: m.snippet ?? "",
            outbound: senderEmail(from) === me,
          };
        })
        .sort((a: Flat, b: Flat) => a.ts - b.ts);

      for (let i = 0; i < msgs.length; i++) {
        const m = msgs[i];
        // The first message from the OPPOSITE side after this one is its reply.
        const reply = msgs.slice(i + 1).find((n) => n.outbound !== m.outbound) ?? null;

        const counterparty = m.outbound
          ? // For something we sent, the client is whoever else is on the thread.
            msgs.find((n) => !n.outbound)?.from ?? ""
          : m.from;
        const email = counterparty ? senderEmail(counterparty) : "";
        const name = m.outbound ? senderName(counterparty || "Sent") : senderName(m.from);

        const { error } = await supa.from("messages").upsert(
          {
            gmail_id: m.gmail_id,
            thread_id: m.thread_id,
            source: "gmail",
            direction: m.outbound ? "outbound" : "inbound",
            sender_name: name || "Unknown",
            sender_initials: ini(name || "Unknown"),
            sender_email: email || null,
            client_id: email ? matchClient(email, clients) : null,
            subject: m.subject,
            preview: m.snippet,
            body: m.snippet,
            category: "reply",
            received_at: new Date(m.ts).toISOString(),
            // Exactly one of these is meaningful per row; the other stays null.
            first_reply_at: !m.outbound && reply ? new Date(reply.ts).toISOString() : null,
            reply_received_at: m.outbound && reply ? new Date(reply.ts).toISOString() : null,
          },
          { onConflict: "workspace_id,gmail_id" },
        );
        if (!error) synced++;
      }
    }

    return json({ synced });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
