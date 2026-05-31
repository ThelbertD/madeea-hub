// Edge Function: google-oauth-callback   (Verify JWT: OFF — Google redirects here with no auth header)
// Exchanges the auth code for tokens, stores them, and bounces back to the app.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SCOPES =
  "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly openid email";

Deno.serve(async (req) => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");
  const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  if (err) return new Response(`Google denied access: ${err}`, { status: 400 });
  if (!code || !state) return new Response("Missing code/state", { status: 400 });

  const { data: st } = await admin
    .from("oauth_states")
    .select("user_id, redirect_to")
    .eq("state", state)
    .maybeSingle();
  if (!st) return new Response("Invalid or expired state", { status: 400 });
  await admin.from("oauth_states").delete().eq("state", state);

  const redirectUri = `${SUPABASE_URL}/functions/v1/google-oauth-callback`;
  const tokRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const tok = await tokRes.json();
  if (!tokRes.ok) return new Response(`Token exchange failed: ${JSON.stringify(tok)}`, { status: 400 });

  const row: Record<string, unknown> = {
    owner_id: st.user_id,
    access_token: tok.access_token,
    token_expiry: new Date(Date.now() + (tok.expires_in ?? 3600) * 1000).toISOString(),
    scopes: SCOPES,
    connected_at: new Date().toISOString(),
  };
  if (tok.refresh_token) row.refresh_token = tok.refresh_token; // keep prior one if Google omits it
  await admin.from("google_credentials").upsert(row, { onConflict: "owner_id" });

  const dest = `${st.redirect_to || ""}/integrations?connected=google`;
  return new Response(null, { status: 302, headers: { Location: dest } });
});
