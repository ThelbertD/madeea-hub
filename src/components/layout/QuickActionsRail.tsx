import { useState } from "react";
import { Sparkles } from "lucide-react";
import { QUICK_RAIL } from "@/lib/constants";
import { generate } from "@/lib/ai";
import { Modal } from "@/components/ui";
import { OutputViewer } from "@/components/OutputViewer";

export function QuickActionsRail() {
  const [active, setActive] = useState<string | null>(null);
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(label: string) {
    setActive(label);
    setOutput("");
    setBusy(true);
    try {
      const out = await generate({ tool: "quick_action", format: label, inputs: {} });
      setOutput(out);
    } catch (e) {
      setOutput(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <aside className="hidden xl:flex h-full w-72 flex-col border-l border-border bg-surface">
        <div className="px-5 py-5">
          <h2 className="text-sm font-semibold">Quick AI Actions</h2>
          <p className="text-xs text-faint">Contextual shortcuts</p>
        </div>
        <div className="flex-1 overflow-y-auto px-3 space-y-2">
          {QUICK_RAIL.map((label) => (
            <button
              key={label}
              onClick={() => run(label)}
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-left transition-colors hover:border-accent/40"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <Sparkles size={14} className="text-accent-soft" />
                {label}
              </span>
              <p className="mt-0.5 pl-6 text-xs text-faint">Run AI instantly</p>
            </button>
          ))}
        </div>
        <div className="m-3 rounded-lg border border-border bg-surface-2 p-3">
          <div className="flex items-center gap-2 text-xs font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Claude AI Online
          </div>
          <p className="mt-1 text-xs text-faint">
            Communication Studio and Bookkeeping AI are powered by Claude. Chat assistant available 24/7.
          </p>
        </div>
      </aside>

      <Modal open={active !== null} onClose={() => setActive(null)}>
        <div className="mb-3 flex items-center gap-2">
          <Sparkles size={16} className="text-accent-soft" />
          <h2 className="font-semibold">{active}</h2>
        </div>
        {busy ? (
          <p className="py-8 text-center text-sm text-faint">Generating with Claude…</p>
        ) : output ? (
          <OutputViewer output={output} title={active ?? "AI Output"} />
        ) : null}
      </Modal>
    </>
  );
}
