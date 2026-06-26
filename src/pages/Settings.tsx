import { useNavigate } from "react-router-dom";
import { PlayCircle, LogOut } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { useTour } from "@/store/tour";

export default function Settings() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const startTour = useTour((s) => s.start);

  function replay() {
    nav("/");
    setTimeout(() => startTour(), 150);
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle="Your account and preferences" />
      <div className="max-w-xl space-y-4">
        <section className="card p-5">
          <p className="field-label">Account</p>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/20 text-sm font-semibold text-accent-soft">
              {user?.initials ?? "—"}
            </div>
            <div>
              <p className="text-sm font-medium">{user?.name ?? "—"}</p>
              <p className="text-xs text-faint">{user?.email ?? ""}</p>
            </div>
          </div>
        </section>

        <section className="card p-5">
          <p className="field-label">Onboarding</p>
          <p className="mb-3 text-sm text-muted">Replay the guided walkthrough of the Command Center any time.</p>
          <button className="btn-ghost border border-border" onClick={replay}>
            <PlayCircle size={15} /> Replay tutorial
          </button>
        </section>

        <section className="card p-5">
          <p className="field-label">Session</p>
          <button className="btn-ghost border border-border text-red-400 hover:bg-red-500/10" onClick={() => signOut()}>
            <LogOut size={15} /> Sign out
          </button>
        </section>
      </div>
    </div>
  );
}
