"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles, Info } from "lucide-react";
import { searchDiseaseGenes } from "@/lib/diseaseSearchApi";
import { DiseaseGeneMatch } from "@/types/diseaseSearch";

const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 500;

export default function DiseaseGeneSuggestions({
  diseaseName,
  organismId,
  onSelectGene,
}: {
  diseaseName: string;
  organismId: string;
  onSelectGene: (symbol: string) => void;
}) {
  const [matchedDisease, setMatchedDisease] = useState<string | null>(null);
  const [genes, setGenes] = useState<DiseaseGeneMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isHuman = organismId === "human";

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!isHuman || diseaseName.trim().length < MIN_QUERY_LENGTH) {
      setGenes([]);
      setMatchedDisease(null);
      setSearched(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchDiseaseGenes(diseaseName.trim());
        setMatchedDisease(res.diseaseName);
        setGenes(res.genes);
      } finally {
        setLoading(false);
        setSearched(true);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [diseaseName, isHuman]);

  if (!isHuman) {
    if (diseaseName.trim().length >= MIN_QUERY_LENGTH) {
      return (
        <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-slate-400">
          <Info className="h-3 w-3" />
          Disease-based gene suggestions are only available for Human (Open Targets doesn&apos;t cover other species).
        </p>
      );
    }
    return null;
  }

  if (diseaseName.trim().length < MIN_QUERY_LENGTH) return null;

  return (
    <div className="mt-1.5">
      {loading && (
        <p className="flex items-center gap-1.5 text-[11.5px] text-slate-400">
          <Loader2 className="h-3 w-3 animate-spin" />
          Searching Open Targets...
        </p>
      )}

      {!loading && searched && genes.length === 0 && (
        <p className="text-[11.5px] text-slate-400">No associated genes found for that disease.</p>
      )}

      {!loading && genes.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-2.5">
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
            <Sparkles className="h-3 w-3 text-indigo-500" />
            Genes associated with &ldquo;{matchedDisease}&rdquo; (Open Targets)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {genes.map((g) => (
              <button
                key={g.symbol}
                onClick={() => onSelectGene(g.symbol)}
                title={g.name ?? undefined}
                className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-[12px] font-medium text-slate-700 hover:border-brand hover:text-brand"
              >
                {g.symbol}
                {g.score !== null && (
                  <span className="text-[10px] text-slate-400">{g.score.toFixed(2)}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
