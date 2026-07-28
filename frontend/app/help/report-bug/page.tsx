"use client";

import { useState } from "react";
import HelpPageShell from "@/components/HelpPageShell";
import { Card, FieldLabel } from "@/components/ui";
import { Send, Info } from "lucide-react";

const AREAS = [
  "Gene Verification (Page 1)",
  "Mechanism Selection (Page 2)",
  "Candidate Design (Page 3)",
  "Upload Sequence",
  "Ask the Platform AI",
  "Notifications",
  "Something else",
];

export default function ReportBugPage() {
  const [area, setArea] = useState(AREAS[0]);
  const [summary, setSummary] = useState("");
  const [steps, setSteps] = useState("");
  const [expected, setExpected] = useState("");
  const [actual, setActual] = useState("");

  function buildMailto() {
    const subject = encodeURIComponent(`[Bug] ${area}: ${summary || "Untitled"}`);
    const body = encodeURIComponent(
      `Area: ${area}\n\nSummary:\n${summary}\n\nSteps to reproduce:\n${steps}\n\nExpected behavior:\n${expected}\n\nActual behavior:\n${actual}\n\n---\nPage URL: ${
        typeof window !== "undefined" ? window.location.href : ""
      }`
    );
    return `mailto:mail@koshkey.com?subject=${subject}&body=${body}`;
  }

  return (
    <HelpPageShell
      title="Report a Bug"
      subtitle="This opens your email client with the report pre-filled — there's no in-app ticketing system yet."
    >
      <Card className="p-5 bg-blue-50/50 border-blue-200">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
          <p className="text-[12.5px] text-blue-700">
            Filling this out doesn&apos;t submit anything directly to a database — it composes an
            email to mail@koshkey.com with your report already formatted. Nothing is sent until
            your email client actually sends it.
          </p>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <div>
          <FieldLabel>Area</FieldLabel>
          <select
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 px-3 text-[13.5px] text-slate-700 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          >
            {AREAS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        <div>
          <FieldLabel>Summary</FieldLabel>
          <input
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="One line describing the problem"
            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 px-3 text-[13.5px] placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </div>

        <div>
          <FieldLabel>Steps to reproduce</FieldLabel>
          <textarea
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
            rows={3}
            placeholder="1. Go to...&#10;2. Enter...&#10;3. Click..."
            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 px-3 text-[13.5px] placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel>Expected behavior</FieldLabel>
            <textarea
              value={expected}
              onChange={(e) => setExpected(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-300 bg-white py-2.5 px-3 text-[13.5px] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
          </div>
          <div>
            <FieldLabel>Actual behavior</FieldLabel>
            <textarea
              value={actual}
              onChange={(e) => setActual(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-300 bg-white py-2.5 px-3 text-[13.5px] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
          </div>
        </div>

        <a
          href={buildMailto()}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-[13.5px] font-medium text-white hover:bg-brand-dark"
        >
          <Send className="h-4 w-4" />
          Open Email to Send Report
        </a>
      </Card>
    </HelpPageShell>
  );
}
