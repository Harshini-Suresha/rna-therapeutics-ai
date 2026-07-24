"use client";

import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderPlus,
  Folder,
  Crosshair,
  PenSquare,
  BarChart3,
  FlaskConical,
  FileText,
  BookOpen,
  Settings,
  Dna,
  UploadCloud,
  ChevronRight,
} from "lucide-react";

interface NavItem {
  label: string;
  icon: React.ElementType;
  href: string;
  badge?: string;
}

const PIPELINE_NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "overview",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
      { label: "New Project", icon: FolderPlus, href: "/new-project" },
      { label: "Projects", icon: Folder, href: "/projects" },
    ],
  },
  {
    section: "pipeline",
    items: [
      { label: "Target Discovery", icon: Crosshair, href: "/targets" },
      { label: "ASO Design", icon: PenSquare, href: "/designs" },
      { label: "Upload Sequence", icon: UploadCloud, href: "/upload-sequence" },
      { label: "Computational Analysis", icon: BarChart3, href: "/analysis" },
      { label: "Experimental Validation", icon: FlaskConical, href: "/validation" },
    ],
  },
  {
    section: "output",
    items: [
      { label: "Reports", icon: FileText, href: "/reports" },
      { label: "Knowledge Base", icon: BookOpen, href: "/knowledge" },
    ],
  },
];

const BOTTOM_NAV: NavItem[] = [
  { label: "Settings", icon: Settings, href: "/settings" },
];

export default function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard" || pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <aside className="hidden lg:flex lg:w-64 shrink-0 flex-col bg-gradient-to-b from-navy-950 to-navy-900 text-white h-screen sticky top-0">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-white/10">
        <a href="/dashboard" className="flex items-center justify-center gap-3 rounded-xl bg-white/[0.06] border border-white/[0.08] px-3.5 py-3 hover:bg-white/[0.1] transition-colors">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-400 to-blue-600 shadow-md shadow-indigo-500/20">
            <Dna className="h-5 w-5 text-white" strokeWidth={2.25} />
          </div>
          <div className="leading-tight">
            <p className="text-[13px] font-semibold tracking-wide text-white">
              RNA THERAPEUTICS
            </p>
            <p className="text-[11px] text-slate-400">AI Platform</p>
          </div>
        </a>
      </div>

      {/* Nav */}
      <nav className="sidebar-scroll flex-1 overflow-y-auto px-3 py-4">
        {PIPELINE_NAV.map((group, gi) => (
          <div key={group.section} className={gi > 0 ? "mt-4" : ""}>
            {gi > 0 && (
              <div className="mx-3 mb-2 border-t border-white/[0.08]" />
            )}
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {group.section === "overview"
                ? "Overview"
                : group.section === "pipeline"
                ? "Pipeline"
                : "Output"}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-colors ${
                        active
                          ? "bg-brand text-white font-medium shadow-sm"
                          : "text-slate-300 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 shrink-0 ${
                          active ? "text-white" : "text-slate-400 group-hover:text-white"
                        }`}
                      />
                      <span className="flex-1">{item.label}</span>
                      {item.badge && (
                        <span className="rounded-full bg-brand/20 px-1.5 py-0.5 text-[9px] font-semibold text-brand-light">
                          {item.badge}
                        </span>
                      )}
                      {active && (
                        <ChevronRight className="h-3 w-3 text-white/60" />
                      )}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Quick Links */}
      <div className="border-t border-white/10 px-3 py-3">
        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Quick Links
        </p>
        <a
          href="/upload-sequence"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
        >
          <UploadCloud className="h-4 w-4 text-slate-400" />
          Upload Sequence
        </a>
      </div>

      {/* Bottom nav */}
      <div className="border-t border-white/10 px-3 py-2">
        <ul className="space-y-0.5">
          {BOTTOM_NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <li key={item.label}>
                <a
                  href={item.href}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-colors ${
                    active
                      ? "bg-brand text-white font-medium"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </a>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="px-5 py-3 text-[10px] font-bold text-white border-t border-white/10 leading-relaxed">
        © 2026, KoshKey Sciences Pvt Ltd
        <br />
        <a href="mailto:mail@koshkey.com" className="hover:text-brand-400 transition-colors underline underline-offset-2">
          mail@koshkey.com
        </a>
      </div>
    </aside>
  );
}
