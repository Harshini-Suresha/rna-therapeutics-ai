"use client";

import { Dna, ExternalLink, CheckSquare, Square } from "lucide-react";
import { TargetAnalysis } from "@/types/geneSilencing";
import { Card, SectionHeader } from "./ui";

export default function TargetAnalysisCard({
  target,
  selectedExons,
  onToggleExon,
  onSelectAll,
  silencingScope,
}: {
  target: TargetAnalysis;
  selectedExons: number[];
  onToggleExon: (idx: number) => void;
  onSelectAll: (indices: number[]) => void;
  silencingScope: string | null;
}) {
  const isTotalKnockdown = silencingScope === "total_knockdown";
  const allIndices = target.exons.map((e) => e.index ?? 0);
  const allSelected = selectedExons.length === allIndices.length && allIndices.length > 0;

  return (
    <Card>
      <SectionHeader step="1" title="Target Analysis" />
      <div className="px-6 pb-5 space-y-4">
        {/* Transcript info */}
        <div className="flex items-start gap-3 rounded-lg bg-slate-50 px-4 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-indigo-100">
            <Dna className="h-4 w-4 text-indigo-600" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-slate-800">
              {target.canonicalTranscript?.id ?? "—"}
            </p>
            <p className="text-[12px] text-slate-500">
              {target.totalCodingTranscripts} coding transcript
              {target.totalCodingTranscripts !== 1 ? "s" : ""} &middot;{" "}
              {target.exons.length} exons &middot; CDS {target.cdsLength?.toLocaleString() ?? "—"} bp
            </p>
          </div>
          <a
            href={`https://ensembl.org/Homo_sapiens/Gene/Summary?g=${target.geneId}`}
            target="_blank"
            rel="noreferrer"
            className="ml-auto flex shrink-0 items-center gap-1 text-[11px] text-brand hover:underline"
          >
            Ensembl <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {/* Total knockdown banner */}
        {isTotalKnockdown && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-[12.5px] font-medium text-emerald-700">
              Total Transcript Knockdown
            </p>
            <p className="text-[11.5px] text-emerald-600 mt-0.5">
              All exons will be targeted for degradation. No exon selection needed — ASOs will be designed across the full transcript.
            </p>
          </div>
        )}

        {/* Exon selector — only show when NOT total knockdown */}
        {!isTotalKnockdown && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12.5px] font-medium text-slate-600">
                Select target exon(s) for ASO design:
              </p>
              <button
                onClick={() => onSelectAll(allIndices)}
                className="flex items-center gap-1.5 text-[11.5px] font-medium text-brand hover:text-brand-dark transition-colors"
              >
                {allSelected ? (
                  <CheckSquare className="h-3.5 w-3.5" />
                ) : (
                  <Square className="h-3.5 w-3.5" />
                )}
                {allSelected ? "Deselect all" : "Select all exons"}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {target.exons.map((exon) => {
                const idx = exon.index ?? 0;
                const isSelected = selectedExons.includes(idx);
                return (
                  <button
                    key={exon.id ?? idx}
                    onClick={() => onToggleExon(idx)}
                    className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
                      isSelected
                        ? "bg-brand text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Exon {idx}
                  </button>
                );
              })}
            </div>
            {selectedExons.length > 0 && (
              <p className="mt-2 text-[11.5px] text-slate-400">
                Targeting {selectedExons.length} exon{selectedExons.length !== 1 ? "s" : ""}:{" "}
                {selectedExons.sort((a, b) => a - b).join(", ")}
              </p>
            )}
            {selectedExons.length === 0 && (
              <p className="mt-2 text-[11.5px] text-slate-400">
                Click exons to select them for knockdown, or use &quot;Select all exons&quot; for whole-transcript targeting.
              </p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
