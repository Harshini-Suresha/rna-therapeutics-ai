import HelpPageShell from "@/components/HelpPageShell";
import { Card } from "@/components/ui";
import { Info } from "lucide-react";

const SHORTCUTS = [
  { keys: "Enter", context: "Gene Symbol field (Basic Information)", action: "Submit and load the gene" },
  { keys: "Enter", context: "Ask the Platform AI panel", action: "Send your message" },
  { keys: "Esc", context: "Ask the Platform AI panel", action: "Close the panel" },
  { keys: "Esc", context: "Notifications panel", action: "Close the panel" },
];

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-md border border-slate-300 bg-slate-50 px-2 py-1 font-mono text-[12px] font-medium text-slate-700 shadow-sm">
      {children}
    </kbd>
  );
}

export default function ShortcutsPage() {
  return (
    <HelpPageShell
      title="Keyboard Shortcuts"
      subtitle="The complete, real list — nothing here is aspirational."
    >
      <Card className="p-5 bg-blue-50/50 border-blue-200">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
          <p className="text-[12.5px] text-blue-700">
            This is intentionally a short list. A larger shortcut set (global search focus,
            page-to-page navigation, a command palette) isn&apos;t built yet — this page will grow
            as those are actually implemented, not before.
          </p>
        </div>
      </Card>

      <Card className="p-5">
        <div className="space-y-3">
          {SHORTCUTS.map((s, i) => (
            <div key={i} className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-0 last:pb-0">
              <div>
                <p className="text-[13px] font-medium text-slate-700">{s.action}</p>
                <p className="text-[12px] text-slate-400">{s.context}</p>
              </div>
              <Key>{s.keys}</Key>
            </div>
          ))}
        </div>
      </Card>
    </HelpPageShell>
  );
}
