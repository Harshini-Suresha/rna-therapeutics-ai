"use client";

import { HelpCircle, Bell } from "lucide-react";

export default function Topbar() {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-end gap-4 border-b border-slate-200 bg-white/80 backdrop-blur px-6 py-3">
      <button
        aria-label="Help"
        className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 transition-colors"
      >
        <HelpCircle className="h-[18px] w-[18px]" />
      </button>

      <button
        aria-label="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 transition-colors"
      >
        <Bell className="h-[18px] w-[18px]" />
        <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-semibold text-white">
          3
        </span>
      </button>

      <button className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">
        HS
      </button>
    </header>
  );
}
