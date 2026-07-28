"use client";

import { X, Search, Dna, Loader2 } from "lucide-react";
import { Card, SectionHeader, FieldLabel } from "./ui";
import OrganismSelect from "./OrganismSelect";

interface Props {
  organism: string;
  setOrganism: (v: string) => void;
  diseaseName: string;
  setDiseaseName: (v: string) => void;
  geneSymbol: string;
  setGeneSymbol: (v: string) => void;
  onLoadGene: () => void;
  loading: boolean;
}

export default function BasicInfoForm({
  organism,
  setOrganism,
  diseaseName,
  setDiseaseName,
  geneSymbol,
  setGeneSymbol,
  onLoadGene,
  loading,
}: Props) {
  return (
    <Card>
      <SectionHeader step="1" title="Basic Information" />
      <div className="grid grid-cols-1 gap-3 px-5 pb-2 md:grid-cols-3">
        {/* Organism */}
        <div>
          <FieldLabel hint="Grouped by clinical, model, veterinary, plant, viral, and bacterial species">
            Organism <span className="text-red-500">*</span>
          </FieldLabel>
          <OrganismSelect value={organism} onChange={setOrganism} />
        </div>

        {/* Disease name */}
        <div>
          <FieldLabel hint="A free-text label for your project. The Disease Association shown after loading comes from live Ensembl/Open Targets data for the gene, not from this field.">
            Disease Name <span className="text-red-500">*</span>
          </FieldLabel>
          <div className="relative">
            <input
              value={diseaseName}
              onChange={(e) => setDiseaseName(e.target.value)}
              placeholder="e.g. Duchenne Muscular Dystrophy"
              className="w-full rounded border border-slate-300 bg-white py-2 pl-3 pr-9 text-[12.5px] text-slate-700 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
            {diseaseName && (
              <button
                onClick={() => setDiseaseName("")}
                aria-label="Clear disease name"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Gene symbol */}
        <div>
          <FieldLabel hint="Any gene symbol recognized by Ensembl for the selected organism, e.g. DMD, TP53, Brca1">
            Gene Symbol <span className="text-red-500">*</span>
          </FieldLabel>
          <div className="relative">
            <input
              value={geneSymbol}
              onChange={(e) => setGeneSymbol(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onLoadGene()}
              placeholder="e.g. DMD"
              className="w-full rounded border border-slate-300 bg-white py-2 pl-3 pr-14 text-[12.5px] font-medium text-slate-700 placeholder:font-normal placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
              {geneSymbol && (
                <button
                  onClick={() => setGeneSymbol("")}
                  aria-label="Clear gene symbol"
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <Search className="h-3.5 w-3.5 text-slate-400" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end px-5 pb-3 pt-2">
        <button
          onClick={onLoadGene}
          disabled={loading || !geneSymbol.trim()}
          className="flex items-center gap-1.5 rounded bg-[#061b49] px-4 py-2 text-[12.5px] font-medium text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Dna className="h-3.5 w-3.5" />
          )}
          {loading ? "Loading Gene..." : "Load Gene"}
        </button>
      </div>
    </Card>
  );
}
