"use client";

import { Copy, Check, Thermometer, Info } from "lucide-react";
import { useState } from "react";
import { AssoCandidate } from "@/types/geneSilencing";
import { Card } from "./ui";

function QualityBar({ score }: { score: number }) {
  const color =
    score >= 70 ? "bg-emerald-500" : score >= 45 ? "bg-amber-500" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(100, score)}%` }}
        />
      </div>
      <span className="text-[11.5px] font-semibold text-slate-700 w-8 text-right">
        {score}
      </span>
    </div>
  );
}

function ConfidenceBadge({ score }: { score: number }) {
  const label = score >= 70 ? "High" : score >= 45 ? "Moderate" : "Low";
  const cls =
    score >= 70
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : score >= 45
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-red-50 text-red-600 border-red-200";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {label} Confidence
    </span>
  );
}

export default function AssoCandidateCard({
  candidate,
  rank,
}: {
  candidate: AssoCandidate;
  rank: number;
}) {
  const [copied, setCopied] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  function copySequence() {
    navigator.clipboard.writeText(candidate.sequence).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const gcTone =
    candidate.gcContent >= 40 && candidate.gcContent <= 60
      ? "text-emerald-600"
      : candidate.gcContent >= 30 && candidate.gcContent <= 70
        ? "text-amber-600"
        : "text-red-500";

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/10 text-[11px] font-bold text-brand">
              {rank}
            </span>
            <span className="text-[11px] font-medium text-slate-400">
              {candidate.chemistry} &middot; {candidate.length} nt
            </span>
            <ConfidenceBadge score={candidate.qualityScore} />
          </div>
          <button
            onClick={copySequence}
            className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-50"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-500" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" /> Copy seq
              </>
            )}
          </button>
        </div>

        {/* Sequence */}
        <div className="rounded-lg bg-slate-50 px-3 py-2 font-mono text-[12px] text-slate-700 break-all leading-relaxed tracking-wide">
          {candidate.sequence}
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <div>
            <p className="text-[11px] text-slate-400">GC Content</p>
            <p className={`text-[13px] font-semibold ${gcTone}`}>
              {candidate.gcContent}%
            </p>
          </div>
          <div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1">
              <Thermometer className="h-3 w-3" /> Melting Temp
            </p>
            <p className="text-[13px] font-semibold text-slate-700">
              {candidate.meltingTemp}°C
            </p>
          </div>
          <div>
            <p className="text-[11px] text-slate-400">Self-dimer risk</p>
            <p className="text-[13px] font-semibold text-slate-700">
              {candidate.selfComplementScore === 0
                ? "None"
                : candidate.selfComplementScore < 0.1
                  ? "Low"
                  : candidate.selfComplementScore < 0.2
                    ? "Moderate"
                    : "High"}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-slate-400">Poly-G tracts</p>
            <p className="text-[13px] font-semibold text-slate-700">
              {candidate.polygTracts}
            </p>
          </div>
        </div>

        {/* Exon info */}
        {candidate.exonNumber != null && (
          <div className="flex items-center gap-4 rounded-lg bg-slate-50 px-3 py-2">
            <div>
              <p className="text-[10px] text-slate-400">Target Exon</p>
              <p className="text-[12px] font-semibold text-slate-700">Exon {candidate.exonNumber}</p>
            </div>
            {candidate.exonLength != null && (
              <div>
                <p className="text-[10px] text-slate-400">Exon Length</p>
                <p className="text-[12px] font-semibold text-slate-700">{candidate.exonLength} bp</p>
              </div>
            )}
          </div>
        )}

        {/* Quality score */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-[11px] text-slate-400">Composite Quality</p>
            <button
              onClick={() => setShowBreakdown(!showBreakdown)}
              className="flex items-center gap-0.5 text-[10px] text-slate-400 hover:text-slate-600"
            >
              <Info className="h-3 w-3" />
              {showBreakdown ? "Hide" : "How it's calculated"}
            </button>
          </div>
          <QualityBar score={candidate.qualityScore} />

          {showBreakdown && (
            <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 text-[10.5px] text-slate-500 space-y-1">
              <p className="font-medium text-slate-600 mb-1.5">Quality Score Breakdown</p>
              <div className="flex justify-between">
                <span>GC Content Score (35%)</span>
                <span className="font-medium text-slate-700">{candidate.gcScore}</span>
              </div>
              <div className="flex justify-between">
                <span>Melting Temp Score (45%)</span>
                <span className="font-medium text-slate-700">{candidate.tmScore}</span>
              </div>
              <div className="flex justify-between">
                <span>Self-dimer Penalty</span>
                <span className="font-medium text-red-500">-{candidate.selfComplementPenalty}</span>
              </div>
              <div className="flex justify-between">
                <span>Poly-G Penalty</span>
                <span className="font-medium text-red-500">-{candidate.polygPenalty}</span>
              </div>
              <div className="border-t border-slate-200 pt-1 mt-1 flex justify-between font-semibold">
                <span>Final Score</span>
                <span className="text-slate-700">{candidate.qualityScore}</span>
              </div>
              <p className="text-[9.5px] text-slate-400 pt-1">
                Composite Quality is a weighted score (0–100) combining GC content (ideal: 50%), melting temperature (ideal: 52°C), self-dimer risk, and poly-G tract count. Higher = better drug-like properties.
              </p>
            </div>
          )}
        </div>

        {/* Target region + modifications */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          <span className="rounded bg-slate-100 px-2 py-0.5 text-[10.5px] text-slate-500">
            {candidate.targetRegion}
          </span>
          {candidate.modifications.map((m) => (
            <span
              key={m}
              className="rounded bg-indigo-50 px-2 py-0.5 text-[10.5px] text-indigo-600"
            >
              {m}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}
