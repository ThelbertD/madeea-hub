import { Menu } from "lucide-react";
import { todayLabel } from "@/lib/utils";
import { GlobalSearch } from "./GlobalSearch";
import { Notifications } from "./Notifications";

export function TopBar({ onMenu }: { onMenu?: () => void }) {
  return (
    <header className="flex items-center gap-4 border-b border-border bg-surface/60 px-4 lg:px-6 py-3">
      <button className="btn-ghost lg:hidden -ml-2" onClick={onMenu} aria-label="Open menu">
        <Menu size={18} />
      </button>
      <span className="hidden sm:block text-sm text-faint">{todayLabel()}</span>
      <div className="ml-auto flex items-center gap-2">
        <div className="hidden sm:block">
          <GlobalSearch />
        </div>
        <Notifications />
      </div>
    </header>
  );
}
