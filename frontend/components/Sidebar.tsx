"use client";

import {
  LayoutDashboard,
  FolderPlus,
  Folder,
  Crosshair,
  PenSquare,
  BarChart3,
  ShieldCheck,
  FileText,
  BookOpen,
  Settings,
  UploadCloud,
  Dna,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, href: "#" },
  { label: "New Project", icon: FolderPlus, href: "#", active: true },
  { label: "Projects", icon: Folder, href: "#" },
  { label: "Targets", icon: Crosshair, href: "#" },
  { label: "Designs", icon: PenSquare, href: "#" },
  { label: "Analysis", icon: BarChart3, href: "#" },
  { label: "Validation", icon: ShieldCheck, href: "#" },
  { label: "Reports", icon: FileText, href: "#" },
  { label: "Knowledge Base", icon: BookOpen, href: "#" },
  { label: "Settings", icon: Settings, href: "#" },
];

export default function Sidebar() {
  return (
    <aside className="hidden lg:flex lg:w-64 shrink-0 flex-col bg-gradient-to-b from-navy-950 to-navy-900 text-white h-screen sticky top-0">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-white/10">
        <div className="flex items-center gap-3 rounded-xl bg-white/[0.06] border border-white/[0.08] px-3.5 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-400 to-blue-600 shadow-md shadow-indigo-500/20">
            <Dna className="h-5 w-5 text-white" strokeWidth={2.25} />
          </div>
          <div className="leading-tight">
            <p className="text-[13px] font-semibold tracking-wide text-white">
              RNA THERAPEUTICS
            </p>
            <p className="text-[11px] text-slate-400">AI Platform</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-scroll flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.label}>
                <a
                  href={item.href}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    item.active
                      ? "bg-brand text-white font-medium shadow-sm"
                      : "text-slate-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon
                    className={`h-[18px] w-[18px] shrink-0 ${
                      item.active ? "text-white" : "text-slate-400 group-hover:text-white"
                    }`}
                  />
                  {item.label}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Quick links */}
      <div className="border-t border-white/10 px-3 py-4">
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Quick Links
        </p>
        <a
          href="/upload-sequence"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
        >
          <UploadCloud className="h-[18px] w-[18px] text-slate-400" />
          Upload Sequence
        </a>
      </div>

      <div className="px-5 py-4 text-xs font-bold text-white border-t border-white/10 leading-relaxed">
        © 2026, KoshKey Sciences Pvt Ltd
        <br />
        <a href="mailto:mail@koshkey.com" className="hover:text-brand-400 transition-colors underline underline-offset-2">
          mail@koshkey.com
        </a>
      </div>
    </aside>
  );
}
