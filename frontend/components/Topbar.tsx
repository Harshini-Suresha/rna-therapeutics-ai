"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bell, Search } from "lucide-react";
import HelpMenu from "@/components/HelpMenu";
import NotificationPanel from "@/components/NotificationPanel";
import AccountMenu from "@/components/AccountMenu";

export default function Topbar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    const query = searchParams.get("q") ?? "";
    setSearchText(query);
  }, [searchParams]);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = searchText.trim();
    if (!trimmed) return;
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-6 backdrop-blur" style={{ height: "74px" }}>
      <div className="min-w-0">
        <h1 className="text-[16px] font-bold leading-tight text-[#101d46]">Dashboard</h1>
        <p className="mt-0.5 text-[12px] font-medium text-[#4a5d8a]">Overview of your RNA therapeutics workspace</p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <form onSubmit={handleSearchSubmit} className="relative hidden w-[313px] md:block">
          <span className="sr-only">Search targets, genes, projects</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0d2b64]" />
          <input
            type="search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search targets, genes, projects..."
            className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-[11px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-brand focus:ring-2 focus:ring-brand/15"
          />
          <button type="submit" className="sr-only">Search</button>
        </form>
        <HelpMenu />

        <div className="relative">
          <button
            aria-label="Notifications"
            onClick={() => setShowNotifications(!showNotifications)}
            className={`relative flex h-8 w-8 items-center justify-center rounded transition-colors ${
              showNotifications ? "bg-brand text-white" : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            <Bell className="h-4 w-4" />
          </button>
          <NotificationPanel open={showNotifications} onClose={() => setShowNotifications(false)} />
        </div>

        <AccountMenu
          initials="HS"
          name="Harshini Suresha"
          email="researcher@platform.dev"
          role="Research Scientist"
          institution="KoshKey Sciences"
        />
      </div>
    </header>
  );
}
