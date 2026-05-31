import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Calendar, Slack, CheckCircle2, RefreshCw, Plug, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export default function Integrations() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const { data: googleConnected = false, refetch } = useQuery({
    queryKey: ["google-connected"],
    queryFn: async () => {
      if (!supabase) return false;
      const { count } = await supabase.from("google_credentials").select("*", { count: "exact", head: true });
      return (count ?? 0) > 0;
    },
  });

  async function sync() {
    if (!supabase) return;
    setBusy("sync");
    setNote("");
    try {
      const [gm, cal] = await Promise.all([
        supabase.functions.invoke("gmail-sync"),
        supabase.functions.invoke("calendar-sync"),
      ]);
      const m = (gm.data as { synced?: number })?.synced ?? 0;
      const c = (cal.data as { synced?: number })?.synced ?? 0;
      const err = gm.error?.message || cal.error?.message;
      setNote(err ? `Sync error: ${err}` : `Synced ${m} emails and ${c} calendar events.`);
      qc.invalidateQueries({ queryKey: ["messages"] });
      qc.invalidateQueries({ queryKey: ["meetings"] });
    } finally {
      setBusy(null);
    }
  }

  // On return from Google consent, confirm + auto-sync.
  useEffect(() => {
    if (params.get("connected") === "google") {
      params.delete("connected");
      setParams(params, { replace: true });
      refetch().then(() => sync());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connectGoogle() {
    if (!supabase) return;
    setBusy("google");
    try {
      const { data, error } = await supabase.functions.invoke("google-oauth-url", {
        body: { origin: window.location.origin },
      });
      if (error) throw error;
      window.location.href = (data as { url: string }).url;
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not start Google connection");
      setBusy(null);
    }
  }

  async function disconnectGoogle() {
    if (!supabase) return;
    await supabase.from("google_credentials").delete().neq("owner_id", "00000000-0000-0000-0000-000000000000");
    refetch();
    setNote("Google disconnected.");
  }

  return (
    <div>
      <PageHeader title="Integrations" subtitle="Connect the tools your inbox, calendar and team live in" />

      {note && (
        <div className="mb-4 rounded-lg border border-border bg-surface-2 px-4 py-2 text-sm text-muted">{note}</div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {/* Google (Gmail + Calendar) */}
        <div className="card flex flex-col p-5 md:col-span-2">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-surface-2">
              <Mail size={20} className="text-accent-soft" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Google — Gmail & Calendar</h3>
              {googleConnected ? (
                <span className="pill bg-emerald-500/15 text-emerald-400">Connected</span>
              ) : (
                <span className="pill bg-zinc-500/15 text-faint">Not connected</span>
              )}
            </div>
            <Calendar size={18} className="text-faint" />
          </div>
          <p className="mt-3 text-sm text-muted">
            Sync your inbox into the Communication Center and your upcoming events into the Dashboard.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {!googleConnected ? (
              <button className="btn-primary" onClick={connectGoogle} disabled={!isSupabaseConfigured || busy === "google"}>
                {busy === "google" ? <Loader2 size={15} className="animate-spin" /> : <Plug size={15} />} Connect Google
              </button>
            ) : (
              <>
                <button className="btn-primary" onClick={sync} disabled={busy === "sync"}>
                  {busy === "sync" ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Sync now
                </button>
                <button className="btn-ghost border border-border" onClick={disconnectGoogle}>Disconnect</button>
              </>
            )}
          </div>
        </div>

        {/* Slack — next */}
        <div className="card flex flex-col p-5 opacity-70">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-surface-2">
              <Slack size={20} className="text-accent-soft" />
            </div>
            <div>
              <h3 className="font-semibold">Slack</h3>
              <span className="pill bg-zinc-500/15 text-faint">Coming next</span>
            </div>
          </div>
          <p className="mt-3 flex-1 text-sm text-muted">Notifications and message triage from your Slack workspace.</p>
          <button className="btn-ghost mt-4 border border-border" disabled>Connect Slack</button>
        </div>
      </div>

      <div className="card mt-5 flex items-start gap-3 p-5">
        <CheckCircle2 size={18} className="mt-0.5 text-emerald-400" />
        <div className="text-sm text-muted">
          <p className="font-medium text-zinc-200">How connections work</p>
          <p className="mt-1">
            OAuth runs server-side via Supabase Edge Functions — tokens are stored encrypted and the
            browser never sees a provider secret. Connecting Google redirects you to Google's consent
            screen, then back here to sync.
          </p>
        </div>
      </div>
    </div>
  );
}
