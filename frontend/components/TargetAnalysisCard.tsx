"use client";

import { Dna, ExternalLink } from "lucide-react";
import { TargetAnalysis } from "@/types/geneSilencing";
import { Card, SectionHeader } from "./ui";

export default function TargetAnalysisCard({
  target,
  selectedExon,
  onSelectExon,
}: {
  target: TargetAnalysis;
  selectedExon: number | null;
  onSelectExon: (exon: number) => void;
}) {
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

        {/* Exon selector */}
        <div>
          <p className="mb-2 text-[12.5px] font-medium text-slate-600">
            Select target exon for ASO design:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {target.exons.map((exon) => {
              const idx = exon.index ?? 0;
              const isSelected = selectedExon === idx;
              return (
                <button
                  key={exon.id ?? idx}
                  onClick={() => onSelectExon(idx)}
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
          {selectedExon !== null && (
            <p className="mt-2 text-[11.5px] text-slate-400">
              Targeting Exon {selectedExon} &middot;{" "}
              {target.exons.find((e) => e.index === selectedExon)?.length ?? "—"} bp
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
