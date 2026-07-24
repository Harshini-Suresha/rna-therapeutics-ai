"use client";

import { useState } from "react";
import { HelpCircle, Bell } from "lucide-react";
import HelpAssistant from "@/components/HelpAssistant";
import Notifications from "@/components/Notifications";

export default function Topbar() {
  const [showHelp, setShowHelp] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <header className="sticky top-0 z-10 flex items-center justify-end gap-4 border-b border-slate-200 bg-white/80 backdrop-blur px-6 py-3">
      {/* Help / Research Assistant */}
      <div className="relative">
        <button
          aria-label="Help"
          onClick={() => { setShowHelp(!showHelp); setShowNotifications(false); }}
          className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
            showHelp ? "bg-brand text-white" : "text-slate-500 hover:bg-slate-100"
          }`}
        >
          <HelpCircle className="h-[18px] w-[18px]" />
        </button>
        {showHelp && <HelpAssistant onClose={() => setShowHelp(false)} />}
      </div>

      {/* Notifications */}
      <div className="relative">
        <button
          aria-label="Notifications"
          onClick={() => { setShowNotifications(!showNotifications); setShowHelp(false); }}
          className={`relative flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
            showNotifications ? "bg-brand text-white" : "text-slate-500 hover:bg-slate-100"
          }`}
        >
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-semibold text-white">
            3
          </span>
        </button>
        {showNotifications && <Notifications onClose={() => setShowNotifications(false)} />}
      </div>

      {/* Avatar */}
      <button className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">
        HS
      </button>
    </header>
  );
}
