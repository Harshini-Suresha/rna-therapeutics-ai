"use client";

import { useState } from "react";
import { Loader2, ChevronDown, ChevronUp, Info } from "lucide-react";
import { DesignOptions, DesignOption } from "@/types/geneSilencing";

function ExpandableOption({
  option,
  selected,
  onSelect,
  type,
}: {
  option: DesignOption;
  selected: boolean;
  onSelect: () => void;
  type: "radio" | "checkbox";
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`rounded-lg border transition-colors ${
        selected
          ? "border-brand bg-brand/5 ring-1 ring-brand"
          : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <div className="flex items-start gap-2.5 px-3 py-2.5">
        {type === "radio" ? (
          <span
            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
              selected ? "border-brand" : "border-slate-300"
            }`}
          >
            {selected && <span className="h-2 w-2 rounded-full bg-brand" />}
          </span>
        ) : (
          <span
            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
              selected ? "border-brand bg-brand text-white" : "border-slate-300"
            }`}
          >
            {selected && (
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
        )}
        <div className="min-w-0 flex-1">
          <button onClick={onSelect} className="text-left w-full">
            <p className="text-[12.5px] font-medium text-slate-700">{option.label}</p>
            {option.description && (
              <p className="mt-0.5 text-[11px] text-slate-400 leading-snug">
                {option.description}
              </p>
            )}
          </button>
          {option.detail && (
            <>
              <button
                onClick={() => setExpanded((e) => !e)}
                className="mt-1 flex items-center gap-1 text-[11px] font-medium text-brand hover:text-brand-dark"
              >
                <Info className="h-3 w-3" />
                {expanded ? "Hide details" : "Learn more"}
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
              {expanded && (
                <p className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-[11.5px] leading-relaxed text-slate-600">
                  {option.detail}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AssoDesignForm({
  options,
  asoLength,
  setAsoLength,
  chemistry,
  setChemistry,
  selectedMods,
  onToggleMod,
  deliveryContext,
  setDeliveryContext,
  onGenerate,
  loading,
  disabled,
  hasResults,
}: {
  options: DesignOptions | null;
  asoLength: number;
  setAsoLength: (n: number) => void;
  chemistry: string;
  setChemistry: (id: string) => void;
  selectedMods: string[];
  onToggleMod: (id: string) => void;
  deliveryContext: string;
  setDeliveryContext: (v: string) => void;
  onGenerate: () => void;
  loading: boolean;
  disabled: boolean;
  hasResults?: boolean;
}) {
  return (
    <div className="space-y-4">
      {/* Chemistry */}
      <div>
        <label className="mb-1.5 block text-[12.5px] font-medium text-slate-600">
          ASO Chemistry
        </label>
        <div className="space-y-2">
          {(options?.chemistryOptions ?? []).map((c) => (
            <ExpandableOption
              key={c.id}
              option={c}
              selected={chemistry === c.id}
              onSelect={() => setChemistry(c.id)}
              type="radio"
            />
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
        <div className="space-y-2">
          {(options?.modificationOptions ?? []).map((m) => (
            <ExpandableOption
              key={m.id}
              option={m}
              selected={selectedMods.includes(m.id)}
              onSelect={() => onToggleMod(m.id)}
              type="checkbox"
            />
          ))}
        </div>
      </div>

      {/* Delivery / Tissue Context */}
      <div>
        <label className="mb-1.5 block text-[12.5px] font-medium text-slate-600">
          Target Tissue <span className="text-[11px] font-normal text-slate-400">(optional)</span>
        </label>
        <p className="mb-2 text-[11px] text-slate-400">
          Select target tissue to apply tissue-specific scoring adjustments (uptake, BBB crossing, immune response).
        </p>
        <select
          value={deliveryContext}
          onChange={(e) => setDeliveryContext(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12.5px] text-slate-700 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        >
          <option value="">No tissue preference (default)</option>
          <option value="liver">Liver — High uptake, gapmer-validated</option>
          <option value="kidney">Kidney — Good uptake, rapid clearance</option>
          <option value="cns">CNS / Brain — Requires BBB crossing, intrathecal</option>
          <option value="muscle">Skeletal Muscle — Moderate uptake, large mass</option>
          <option value="heart">Heart — Limited uptake, systemic delivery</option>
          <option value="lung">Lung — Accessible via inhalation</option>
          <option value="eye">Eye / Retina — Immune-privileged, intravitreal</option>
          <option value="tumor">Tumor — Microenvironment-enhanced uptake</option>
          <option value="blood">Blood / Bone Marrow — Hematopoietic cells</option>
          <option value="skin">Skin — Topical/intradermal delivery</option>
          <option value="pancreas">Pancreas — Limited uptake</option>
          <option value="gut">Gut / Intestine — Oral delivery challenging</option>
          <option value="spinal cord">Spinal Cord — Intrathecal required</option>
        </select>
        {deliveryContext && (
          <p className="mt-1.5 text-[10.5px] text-slate-400 italic">
            Tissue-specific adjustments will be applied to candidate scoring.
          </p>
        )}
      </div>

      {/* Generate button */}
      <button
        onClick={onGenerate}
        disabled={disabled || loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-[13.5px] font-medium text-white shadow-sm transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? "Generating candidates..." : hasResults ? "Regenerate Candidates" : "Generate ASO Candidates"}
      </button>
    </div>
  );
}
