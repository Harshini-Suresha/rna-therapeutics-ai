"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Search, X, Sparkles, Info } from "lucide-react";
import { searchDiseaseGenes } from "@/lib/diseaseSearchApi";
import { DiseaseGeneMatch } from "@/types/diseaseSearch";

const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 500;

interface Props {
  organismId: string;
  active: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
  onSelectGene: (symbol: string, diseaseName: string) => void;
}

export default function DiseaseSearchSection({
  organismId,
  active,
  onActivate,
  onDeactivate,
  onSelectGene,
}: Props) {
  const [query, setQuery] = useState("");
  const [matchedDisease, setMatchedDisease] = useState<string | null>(null);
  const [genes, setGenes] = useState<DiseaseGeneMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isHuman = organismId === "human";

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!isHuman || query.trim().length < MIN_QUERY_LENGTH) {
      setGenes([]);
      setMatchedDisease(null);
      setSearched(false);
      return;
    }

    onActivate();

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchDiseaseGenes(query.trim());
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
  }, [query, isHuman]);

  function handleClear() {
    setQuery("");
    setGenes([]);
    setMatchedDisease(null);
    setSearched(false);
    onDeactivate();
  }

  function handleSelectGene(symbol: string) {
    onSelectGene(symbol, matchedDisease || query.trim());
    handleClear();
  }

  if (!isHuman) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3">
        <p className="flex items-center gap-1.5 text-[11.5px] text-slate-400">
          <Info className="h-3 w-3 shrink-0" />
          Disease-based gene discovery is only available for Human (Open Targets covers human disease-gene associations).
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[11.5px] font-semibold text-slate-700">
          Disease-Based Gene Discovery
        </h3>
        {active && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        )}
      </div>

      <p className="mt-1 text-[10.5px] leading-relaxed text-slate-400">
        Type a disease name to find associated genes ranked by Open Targets evidence score.
      </p>

      <div className="relative mt-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Duchenne Muscular Dystrophy, Alzheimer's disease"
          className="w-full rounded border border-slate-300 bg-white py-2 pl-3 pr-9 text-[12px] text-slate-700 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {loading && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
          <Loader2 className="h-3 w-3 animate-spin" />
          Searching Open Targets...
        </p>
      )}

      {!loading && searched && genes.length === 0 && (
        <p className="mt-2 text-[11px] text-slate-400">
          No associated genes found for &ldquo;{query}&rdquo;.
        </p>
      )}

      {!loading && genes.length > 0 && (
        <div className="mt-2.5 rounded-md border border-slate-200 bg-slate-50/60 p-2.5">
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
            <Sparkles className="h-3 w-3 text-indigo-500" />
            Genes associated with &ldquo;{matchedDisease}&rdquo;
          </p>
          <div className="flex flex-wrap gap-1.5">
            {genes.map((g) => (
              <button
                key={g.symbol}
                onClick={() => handleSelectGene(g.symbol)}
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
