"use client";

import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { Card, SectionHeader } from "@/components/ui";
import type { LucideIcon } from "lucide-react";

export default function PagePlaceholder({
  title,
  description,
  icon: Icon,
  sections,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  sections: { label: string; items: string[] }[];
}) {
  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar />
        <main className="flex-1 space-y-5 px-6 py-6">
          <Card className="flex items-center gap-3 px-5 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-50 to-purple-50">
              <Icon className="h-4.5 w-4.5 text-violet-500" />
            </span>
            <div>
              <p className="text-[13px] font-semibold text-slate-800">{title}</p>
              <p className="text-[12px] text-slate-500">{description}</p>
            </div>
          </Card>

          <Card>
            <SectionHeader title={title} />
            <div className="px-6 pb-6 space-y-6">
              {sections.map((section) => (
                <div key={section.label}>
                  <p className="text-[12.5px] font-semibold text-slate-700 mb-2">{section.label}</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {section.items.map((item) => (
                      <div
                        key={item}
                        className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-4 py-3 text-[12px] text-slate-400"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <Icon className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                <p className="text-[13px] font-medium text-slate-400">Coming soon</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  This section is under active development.
                </p>
              </div>
            </div>
          </Card>
        </main>
      </div>
    </div>
  );
}
