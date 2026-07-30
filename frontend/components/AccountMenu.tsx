"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Settings,
  LogOut,
  Building2,
  FlaskConical,
  BarChart3,
  HardDrive,
  Star,
  Bookmark,
  FileText,
  Users,
  Palette,
  Bell,
  Sliders,
  Puzzle,
  BookOpen,
  MessageSquare,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const PROFILE_ITEMS = [
  { label: "Profile", icon: User, href: "/settings" },
  { label: "Organization", icon: Building2, href: "/settings/organization" },
  { label: "Research Interests", icon: FlaskConical, href: "/settings/interests" },
  { label: "Storage", icon: HardDrive, href: "/settings/storage" },
  { label: "Recent Activity", icon: BarChart3, href: "/settings/activity" },
];

const SAVED_ITEMS = [
  { label: "Saved Designs", icon: Star, href: "/settings/saved-designs" },
  { label: "Favorite Genes", icon: Bookmark, href: "/settings/favorites" },
  { label: "Recent Reports", icon: FileText, href: "/settings/reports" },
  { label: "Collaborators", icon: Users, href: "/settings/collaborators" },
];

const PREFERENCES = [
  { label: "Theme", icon: Palette, href: "/settings/theme" },
  { label: "Notifications", icon: Bell, href: "/settings/notifications" },
  { label: "Preferences", icon: Sliders, href: "/settings/preferences" },
  { label: "Integrations", icon: Puzzle, href: "/settings/integrations" },
];

const BOTTOM_ITEMS = [
  { label: "Documentation", icon: BookOpen, href: "/help/docs" },
  { label: "Feedback", icon: MessageSquare, href: "/help/feedback" },
];

export default function AccountMenu({
  initials,
  name,
  email,
  role,
  institution,
}: {
  initials: string;
  name: string;
  email: string;
  role?: string;
  institution?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { logout } = useAuth();

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  function handleLogout() {
    setOpen(false);
    logout();
    router.push("/login");
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded py-1 pl-1 pr-2 hover:bg-slate-100 transition-colors"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-[10px] font-semibold text-white">
          {initials}
        </span>
        <ChevronDown className="h-3 w-3 text-slate-400" />
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-64 border border-slate-200 bg-white shadow-lg">
          {/* User Header */}
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-[13px] font-semibold text-white shrink-0">
                {initials}
              </span>
              <div className="min-w-0">
                <p className="text-[12.5px] font-semibold text-slate-800 truncate">{name}</p>
                {(role || institution) && (
                  <p className="text-[10.5px] text-slate-400 truncate">
                    {role}{role && institution ? " \u00b7 " : ""}{institution}
                  </p>
                )}
                <p className="text-[10.5px] text-slate-400 truncate">{email}</p>
              </div>
            </div>
          </div>

          {/* Workspace */}
          <div className="border-b border-slate-100 px-4 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Workspace
            </p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded bg-indigo-100 text-[9px] font-bold text-indigo-600">
                  {institution ? institution.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() : "WS"}
                </span>
                <span className="text-[11.5px] font-medium text-slate-700">{institution || "Workspace"}</span>
              </div>
              <ChevronRight className="h-3 w-3 text-slate-300" />
            </div>
          </div>

          <div className="p-1.5 max-h-[380px] overflow-y-auto">
            {/* Profile */}
            {PROFILE_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  onClick={() => navigate(item.href)}
                  className="flex w-full items-center gap-2.5 rounded px-3 py-1.5 text-[11.5px] text-slate-700 hover:bg-slate-50"
                >
                  <Icon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  {item.label}
                </button>
              );
            })}

            <div className="my-1.5 border-t border-slate-100" />

            {/* Saved Work */}
            <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Saved Work
            </p>
            {SAVED_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  onClick={() => navigate(item.href)}
                  className="flex w-full items-center gap-2.5 rounded px-3 py-1.5 text-[11.5px] text-slate-700 hover:bg-slate-50"
                >
                  <Icon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  {item.label}
                </button>
              );
            })}

            <div className="my-1.5 border-t border-slate-100" />

            {/* Preferences */}
            <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Preferences
            </p>
            {PREFERENCES.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  onClick={() => navigate(item.href)}
                  className="flex w-full items-center gap-2.5 rounded px-3 py-1.5 text-[11.5px] text-slate-700 hover:bg-slate-50"
                >
                  <Icon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  {item.label}
                </button>
              );
            })}

            <div className="my-1.5 border-t border-slate-100" />

            {/* Bottom Items */}
            {BOTTOM_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  onClick={() => navigate(item.href)}
                  className="flex w-full items-center gap-2.5 rounded px-3 py-1.5 text-[11.5px] text-slate-700 hover:bg-slate-50"
                >
                  <Icon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  {item.label}
                </button>
              );
            })}

            <div className="my-1.5 border-t border-slate-100" />

            <button onClick={handleLogout} className="flex w-full items-center gap-2.5 rounded px-3 py-1.5 text-left text-[11.5px] text-red-600 hover:bg-red-50">
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
