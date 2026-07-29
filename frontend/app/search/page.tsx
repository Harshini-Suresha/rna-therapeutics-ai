"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { Card } from "@/components/ui";

export default function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get("q") ?? "";
  const [searchText, setSearchText] = useState(query);

  useEffect(() => {
    if (query !== searchText) {
      setSearchText(query);
    }
  }, [query, searchText]);

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar />
        <main className="flex-1 px-6 py-4">
          <Card className="space-y-4 p-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Search results
              </p>
              <h1 className="mt-2 text-2xl font-bold text-slate-900">Search results for “{query}”</h1>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[12px] font-semibold text-slate-700">Genes</p>
                <p className="mt-2 text-[11px] text-slate-500">Search across gene names, symbols, and identifiers.</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[12px] font-semibold text-slate-700">Targets</p>
                <p className="mt-2 text-[11px] text-slate-500">Find active targets, curated reference targets, and therapeutic candidates.</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[12px] font-semibold text-slate-700">Projects</p>
                <p className="mt-2 text-[11px] text-slate-500">Locate projects by name, disease, or owner.</p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-[12px] font-semibold text-slate-700">Gene match</p>
                <p className="mt-2 text-[11px] text-slate-500">Use the gene search bar on the dashboard to resolve and load a gene into the pipeline.</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-[12px] font-semibold text-slate-700">Project match</p>
                <p className="mt-2 text-[11px] text-slate-500">Projects are coming soon — this stub will be replaced by live project search results.</p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Next steps</p>
              <ul className="mt-3 space-y-2 text-[11px] text-slate-600 list-disc list-inside">
                <li>Search dispatches to `/search?q=...`.</li>
                <li>Gene searches are supported via the main dashboard loader.</li>
                <li>Target and project search pages can be added as live results later.</li>
              </ul>
            </div>
          </Card>
        </main>
      </div>
    </div>
  );
}
