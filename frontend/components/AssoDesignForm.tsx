"use client";

import { Loader2 } from "lucide-react";
import { DesignOptions } from "@/types/geneSilencing";

export default function AssoDesignForm({
  options,
  asoLength,
  setAsoLength,
  chemistry,
  setChemistry,
  selectedMods,
  onToggleMod,
  onGenerate,
  loading,
  disabled,
}: {
  options: DesignOptions | null;
  asoLength: number;
  setAsoLength: (n: number) => void;
  chemistry: string;
  setChemistry: (id: string) => void;
  selectedMods: string[];
  onToggleMod: (id: string) => void;
  onGenerate: () => void;
  loading: boolean;
  disabled: boolean;
}) {
  return (
    <div className="space-y-4">
      {/* Chemistry */}
      <div>
        <label className="mb-1.5 block text-[12.5px] font-medium text-slate-600">
          ASO Chemistry
        </label>
        <div className="grid grid-cols-2 gap-2">
          {(options?.chemistryOptions ?? []).map((c) => (
            <button
              key={c.id}
              onClick={() => setChemistry(c.id)}
              className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                chemistry === c.id
                  ? "border-brand bg-brand/5 ring-1 ring-brand"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <p className="text-[12.5px] font-medium text-slate-700">{c.label}</p>
              {c.description && (
                <p className="mt-0.5 text-[11px] text-slate-400 leading-snug">
                  {c.description}
                </p>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Length */}
      <div>
        <label className="mb-1.5 block text-[12.5px] font-medium text-slate-600">
          Oligo Length: {asoLength} nt
        </label>
        <input
          type="range"
          min={options?.lengthRange.min ?? 12}
          max={options?.lengthRange.max ?? 30}
          step={options?.lengthRange.step ?? 1}
          value={asoLength}
          onChange={(e) => setAsoLength(Number(e.target.value))}
          className="w-full accent-brand"
        />
        <div className="flex justify-between text-[11px] text-slate-400">
          <span>{options?.lengthRange.min ?? 12} nt</span>
          <span>{options?.lengthRange.max ?? 30} nt</span>
        </div>
      </div>

      {/* Modifications */}
      <div>
        <label className="mb-1.5 block text-[12.5px] font-medium text-slate-600">
          Modifications
        </label>
        <div className="space-y-1.5">
          {(options?.modificationOptions ?? []).map((m) => {
            const active = selectedMods.includes(m.id);
            return (
              <button
                key={m.id}
                onClick={() => onToggleMod(m.id)}
                className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors ${
                  active
                    ? "border-brand bg-brand/5 ring-1 ring-brand"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    active ? "border-brand bg-brand text-white" : "border-slate-300"
                  }`}
                >
                  {active && (
                    <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                      <path
                        d="M2.5 6L5 8.5L9.5 3.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
                <div className="min-w-0">
                  <p className="text-[12.5px] font-medium text-slate-700">{m.label}</p>
                  {m.description && (
                    <p className="text-[11px] text-slate-400 leading-snug">{m.description}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Generate button */}
      <button
        onClick={onGenerate}
        disabled={disabled || loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-[13.5px] font-medium text-white shadow-sm transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? "Generating candidates..." : "Generate ASO Candidates"}
      </button>
    </div>
  );
}
