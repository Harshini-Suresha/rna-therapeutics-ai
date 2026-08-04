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
      { label: "Mechanism Docs", icon: BookOpen, href: "/documentation" },
    ],
  },
  {
    section: "pipeline",
    items: [
      { label: "Target Discovery", icon: Crosshair, href: "/targets" },
      { label: "ASO Design", icon: PenSquare, href: "/designs" },
      { label: "Computational Analysis", icon: BarChart3, href: "/analysis" },
      { label: "Experimental Validation", icon: FlaskConical, href: "/validation" },
    ],
  },
  {
    section: "output",
    items: [
      { label: "Reports", icon: FileText, href: "/reports" },
      { label: "Knowledge Base", icon: BookOpen, href: "/knowledge" },
      { label: "Upload Sequence", icon: UploadCloud, href: "/upload-sequence" },
    ],
  },
  {
    section: "quick links",
    items: [
      { label: "Settings", icon: Settings, href: "/settings" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard" || pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <aside className="hidden lg:flex lg:w-56 shrink-0 flex-col bg-gradient-to-b from-navy-950 to-navy-900 text-white h-screen sticky top-0">
      {/* Logo */}
      <div className="px-3 py-3 border-b border-white/[0.06]">
        <a href="/dashboard" className="flex items-center gap-2.5 px-2.5 py-2 hover:bg-white/[0.04] transition-colors">
          <Dna className="h-4 w-4 text-indigo-400 shrink-0" strokeWidth={2} />
          <div className="leading-tight">
            <p className="text-[12px] font-semibold tracking-wide text-white">
              RNA THERAPEUTICS
            </p>
            <p className="text-[10px] text-slate-500">Platform</p>
          </div>
        </a>
      </div>

      {/* Nav */}
      <nav className="sidebar-scroll flex-1 overflow-y-auto px-2.5 py-3">
        {PIPELINE_NAV.map((group, gi) => (
          <div key={group.section} className={gi > 0 ? "mt-3" : ""}>
            {gi > 0 && (
              <div className="mx-2 mb-1.5 border-t border-white/[0.06]" />
            )}
            <p className="px-2 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {group.section === "overview"
                ? "Overview"
                : group.section === "pipeline"
                ? "Pipeline"
                : group.section === "output"
                ? "Output"
                : "Quick Links"}
            </p>
            <ul className="space-y-0">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      className={`group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-semibold transition-colors ${
                        active
                          ? "bg-brand text-white"
                          : "text-slate-300 hover:bg-white/[0.06] hover:text-white"
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 shrink-0 ${
                          active ? "text-white" : "text-slate-400 group-hover:text-slate-200"
                        }`}
                        strokeWidth={active ? 2.2 : 2}
                      />
                      <span className="flex-1">{item.label}</span>
                      {item.badge && (
                        <span className="rounded bg-brand/20 px-1 py-0.5 text-[8px] font-semibold text-slate-300">
                          {item.badge}
                        </span>
                      )}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="px-4 py-3 text-[11px] font-medium leading-relaxed border-t border-white/[0.06]">
        <span className="text-slate-300">&copy; 2026, KoshKey Sciences Pvt Ltd</span>
        <br />
        <a href="mailto:mail@koshkey.com" className="text-slate-300 hover:text-white transition-colors">
          mail@koshkey.com
        </a>
      </div>
    </aside>
  );
}
