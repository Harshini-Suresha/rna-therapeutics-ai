"use client";

import { useState, useEffect } from "react";
import { Palette, CheckCircle } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { Card, SectionHeader } from "@/components/ui";

const THEMES = [
  { id: "light", label: "Light", desc: "Clean white background" },
  { id: "dark", label: "Dark", desc: "Easy on the eyes" },
  { id: "system", label: "System", desc: "Match your OS setting" },
];

export default function ThemePage() {
  const [current, setCurrent] = useState("light");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setCurrent(localStorage.getItem("aso:theme") || "light");
  }, []);

  function select(id: string) {
    setCurrent(id);
    localStorage.setItem("aso:theme", id);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar />
        <main className="flex-1 space-y-0 px-6 py-4">
          <Card className="flex items-center gap-3 px-4 py-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded bg-slate-100"><Palette className="h-4 w-4 text-slate-500" /></span>
            <div><p className="text-[12px] font-semibold text-slate-800">Theme</p><p className="text-[11px] text-slate-500">Choose your visual theme</p></div>
          </Card>
          <Card>
            <SectionHeader title="Appearance" right={saved && <span className="flex items-center gap-1 text-[11px] text-emerald-600"><CheckCircle className="h-3 w-3" />Saved</span>} />
            <div className="px-5 pb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {THEMES.map((t) => (
                <button key={t.id} onClick={() => select(t.id)} className={`rounded-lg border px-4 py-3 text-left transition-colors ${current === t.id ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:border-slate-300"}`}>
                  <p className="text-[13px] font-medium text-slate-800">{t.label}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{t.desc}</p>
                  {current === t.id && <CheckCircle className="h-4 w-4 text-indigo-500 mt-2" />}
                </button>
              ))}
            </div>
          </Card>
        </main>
      </div>
    </div>
  );
}
