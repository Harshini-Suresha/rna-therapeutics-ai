"use client";

import { useState, useEffect } from "react";
import { Palette, CheckCircle } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { Card, SectionHeader } from "@/components/ui";
import { useTheme } from "@/contexts/ThemeContext";

const THEMES = [
  { id: "light" as const, label: "Light", desc: "Clean white background" },
  { id: "dark" as const, label: "Dark", desc: "Easy on the eyes" },
  { id: "system" as const, label: "System", desc: "Match your OS setting" },
];

export default function ThemePage() {
  const { theme, setTheme } = useTheme();
  const [saved, setSaved] = useState(false);

  function select(id: "light" | "dark" | "system") {
    setTheme(id);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="flex min-h-screen bg-[#F5F6FA] dark:bg-[#0f172a]">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar />
        <main className="flex-1 space-y-0 px-6 py-4">
          <Card className="flex items-center gap-3 px-4 py-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded bg-slate-100 dark:bg-slate-700"><Palette className="h-4 w-4 text-slate-500 dark:text-slate-300" /></span>
            <div><p className="text-[12px] font-semibold text-slate-800 dark:text-slate-200">Theme</p><p className="text-[11px] text-slate-500 dark:text-slate-400">Choose your visual theme</p></div>
          </Card>
          <Card>
            <SectionHeader title="Appearance" right={saved && <span className="flex items-center gap-1 text-[11px] text-emerald-600"><CheckCircle className="h-3 w-3" />Saved</span>} />
            <div className="px-5 pb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {THEMES.map((t) => (
                <button key={t.id} onClick={() => select(t.id)} className={`rounded-lg border px-4 py-3 text-left transition-colors ${theme === t.id ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950" : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"}`}>
                  <p className="text-[13px] font-medium text-slate-800 dark:text-slate-200">{t.label}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{t.desc}</p>
                  {theme === t.id && <CheckCircle className="h-4 w-4 text-indigo-500 mt-2" />}
                </button>
              ))}
            </div>
          </Card>
        </main>
      </div>
    </div>
  );
}
