"use client";

import { Copy, Check, Info } from "lucide-react";
import { useState } from "react";
import { AssoCandidate } from "@/types/geneSilencing";
import { Card } from "./ui";

function DuplexEnergyBadge({ energy }: { energy: number }) {
  const label = energy <= -25 ? "Very Stable" : energy <= -15 ? "Stable" : energy <= -10 ? "Moderate" : "Weak";
  const cls =
    energy <= -25
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : energy <= -15
        ? "bg-blue-50 text-blue-700 border-blue-200"
        : energy <= -10
          ? "bg-amber-50 text-amber-700 border-amber-200"
          : "bg-red-50 text-red-600 border-red-200";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}

function ScoreBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.min(100, (value / max) * 100);
  const color = pct >= 70 ? "bg-emerald-400" : pct >= 50 ? "bg-blue-400" : pct >= 30 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-semibold text-slate-600 w-7 text-right">{value}</span>
    </div>
  );
}

function Td({ label, value, unit, warn, highlight, bar }: { label: string; value?: string | number | null; unit?: string; warn?: boolean; highlight?: boolean; bar?: number }) {
  if (value === null || value === undefined) return null;
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-1.5 pr-4 text-[11px] text-slate-500 whitespace-nowrap">{label}</td>
      <td className="py-1.5 text-right">
        {bar !== undefined ? (
          <div className="flex items-center justify-end gap-2">
            <ScoreBar value={bar} />
          </div>
        ) : (
          <span className={`text-[11.5px] font-semibold ${highlight ? "text-brand" : warn ? "text-amber-600" : "text-slate-700"}`}>
            {value}{unit && <span className="text-[10px] font-normal text-slate-400 ml-0.5">{unit}</span>}
          </span>
        )}
      </td>
    </tr>
  );
}

function TableSection({ title, colSpan = 1 }: { title: string; colSpan?: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="bg-slate-100/50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {title}
      </td>
    </tr>
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

  const selfDimerLabel =
    candidate.selfStructureMfe === 0
      ? "None"
      : candidate.selfStructureMfe > -3
        ? "Low"
        : candidate.selfStructureMfe > -6
          ? "Moderate"
          : "High";

  const nucleaseLabel = candidate.nucleaseResistance >= 80 ? "Excellent" : candidate.nucleaseResistance >= 60 ? "Good" : candidate.nucleaseResistance >= 40 ? "Moderate" : "Low";
  const uptakeLabel = candidate.cellularUptake >= 70 ? "High" : candidate.cellularUptake >= 50 ? "Moderate" : "Low";
  const bbbLabel = candidate.bbbCrossing >= 60 ? "Good" : candidate.bbbCrossing >= 30 ? "Limited" : "Poor";
  const offTargetLabel = candidate.offTargetRisk <= 20 ? "Low" : candidate.offTargetRisk <= 40 ? "Moderate" : "High";
  const immuneLabel = candidate.immuneStimulation <= 15 ? "Low" : candidate.immuneStimulation <= 35 ? "Moderate" : "High";
  const synthesisLabel = candidate.synthesisDifficulty <= 30 ? "Standard" : candidate.synthesisDifficulty <= 55 ? "Moderate" : "Complex";

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-0 p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand/10 text-[12px] font-bold text-brand">
              {rank}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-slate-800">{candidate.chemistry.toUpperCase()}</span>
                <span className="text-[11px] text-slate-400">·</span>
                <span className="text-[11px] text-slate-500">{candidate.length} nt</span>
                <span className="text-[11px] text-slate-400">·</span>
                <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600">{candidate.mechanismId}</span>
                <DuplexEnergyBadge energy={candidate.targetDuplexEnergy} />
              </div>
              <p className="text-[10.5px] text-slate-400 mt-0.5">{candidate.targetRegion}</p>
            </div>
          </div>
          <button
            onClick={copySequence}
            className="flex items-center gap-1 rounded-md border border-[#E5E7EB] px-2.5 py-1.5 text-[11px] text-slate-500 hover:bg-white transition-colors"
          >
            {copied ? <><Check className="h-3 w-3 text-emerald-500" /> Copied</> : <><Copy className="h-3 w-3" /> Copy seq</>}
          </button>
        </div>

        {/* Sequence */}
        <div className="border-b border-slate-100 px-5 py-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Antisense Sequence (5'→3')</p>
          <div className="rounded-lg bg-slate-900 px-4 py-2.5 font-mono text-[13px] text-emerald-400 break-all leading-relaxed tracking-widest select-all">
            {candidate.sequence}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-[10px] text-slate-400">
            <span>Molecular Weight: <strong className="text-slate-600">{candidate.molecularWeight?.toLocaleString()} Da</strong></span>
            <span>Extinction Coefficient: <strong className="text-slate-600">{candidate.extinctionCoefficient?.toLocaleString()} L/mol·cm</strong></span>
            <span>Duplex Stability: <strong className="text-slate-600">{candidate.duplexStability}</strong></span>
          </div>
        </div>

        {/* Large table */}
        <div className="px-5 py-3">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b-2 border-[#E5E7EB]">
                <th className="pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Property</th>
                <th className="pb-2 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Value</th>
              </tr>
            </thead>
            <tbody>
              {/* IDENTIFICATION */}
              <TableSection title="Identification" />
              <Td label="Rank" value={`#${rank}`} highlight />
              <Td label="Chemistry" value={candidate.chemistry} />
              <Td label="Oligo Length" value={candidate.length} unit="nt" />
              <Td label="Target Region" value={candidate.targetRegion} />
              {candidate.exonNumber != null && <Td label="Target Exon" value={`Exon ${candidate.exonNumber}`} highlight />}
              {candidate.exonLength != null && <Td label="Exon Length" value={candidate.exonLength} unit="bp" />}
              {candidate.modifications.length > 0 && (
                <tr className="border-b border-slate-100">
                  <td className="py-1.5 pr-4 text-[11px] text-slate-500">Modifications</td>
                  <td className="py-1.5 text-right">
                    <div className="flex flex-wrap gap-1 justify-end">
                      {candidate.modifications.map((m) => (
                        <span key={m} className="rounded bg-indigo-50 px-1.5 py-0.5 text-[9.5px] font-medium text-indigo-600">{m}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              )}

              {/* BIOPHYSICAL */}
              <TableSection title="Biophysical Properties" />
              <Td label="GC Content" value={`${candidate.gcContent}%`} warn={candidate.gcContent < 40 || candidate.gcContent > 60} />
              <Td label="Melting Temperature (Tm)" value={candidate.meltingTempC} unit="°C" />
              <Td label="Self-Structure MFE" value={candidate.selfStructureMfe} unit="kcal/mol" />
              <Td label="Self-Structure Risk" value={selfDimerLabel} warn={selfDimerLabel === "High" || selfDimerLabel === "Moderate"} />
              <Td label="Poly-G Tracts (≥3 G)" value={candidate.polygTracts ?? 0} warn={(candidate.polygTracts ?? 0) > 0} />
              <Td label="Target Duplex ΔG" value={candidate.targetDuplexEnergy} unit="kcal/mol" />

              {/* SEQUENCE COMPOSITION */}
              <TableSection title="Sequence Composition" />
              <Td label="CpG Dinucleotides" value={candidate.cpgCount} warn={candidate.cpgCount >= 3} />
              <Td label="CpG Immune Risk" value={candidate.cpgCount >= 3 ? "Elevated" : "Normal"} warn={candidate.cpgCount >= 3} />
              <Td label="Longest Homopolymer Run" value={candidate.longestHomopolymer} unit="bp" warn={candidate.longestHomopolymer >= 4} />
              <Td label="Purine Content (A+G)" value={`${(candidate.purineContent * 100).toFixed(1)}%`} />
              <Td label="Pyrimidine Content (C+T)" value={`${((1 - candidate.purineContent) * 100).toFixed(1)}%`} />
              <Td label="GC Skew" value={candidate.gcSkew.toFixed(3)} />
              <Td label="Sequence Complexity" value={candidate.sequenceComplexity.toFixed(3)} warn={candidate.sequenceComplexity < 0.7} />
              <Td label="Repetitive Elements" value={candidate.longestHomopolymer >= 4 ? "Detected" : "None"} warn={candidate.longestHomopolymer >= 4} />

              {/* THERMODYNAMICS */}
              <TableSection title="Thermodynamic Profile" />
              <Td label="Duplex Stability" value={candidate.duplexStability} />
              <Td label="MW" value={candidate.molecularWeight?.toLocaleString()} unit="Da" />
              <Td label="Extinction Coeff (ε₂₆₀)" value={candidate.extinctionCoefficient?.toLocaleString()} unit="L/mol·cm" />

              {/* DRUG-LIKE PROPERTIES */}
              <TableSection title="Drug-like Properties" />
              <Td label="Nuclease Resistance" bar={candidate.nucleaseResistance} />
              <Td label="Nuclease Rating" value={nucleaseLabel} />
              <Td label="Cellular Uptake" bar={candidate.cellularUptake} />
              <Td label="Uptake Rating" value={uptakeLabel} />
              <Td label="BBB Crossing Potential" bar={candidate.bbbCrossing} />
              <Td label="BBB Rating" value={bbbLabel} />
              <Td label="In Vivo Stability" value={nucleaseLabel} />

              {/* RISK ASSESSMENT */}
              <TableSection title="Risk Assessment" />
              <Td label="Off-target Risk" bar={100 - candidate.offTargetRisk} />
              <Td label="Off-target Rating" value={offTargetLabel} warn={offTargetLabel === "High"} />
              <Td label="Immune Stimulation Risk" bar={100 - candidate.immuneStimulation} />
              <Td label="Immune Rating" value={immuneLabel} warn={immuneLabel === "High"} />
              <Td label="Synthesis Feasibility" bar={100 - candidate.synthesisDifficulty} />
              <Td label="Synthesis Rating" value={synthesisLabel} warn={synthesisLabel === "Complex"} />
              <Td label="Toxicity Flags" value={candidate.cpgCount >= 3 ? "CpG-mediated" : (candidate.polygTracts ?? 0) > 1 ? "Poly-G aggregation" : "None flagged"} warn={candidate.cpgCount >= 3 || (candidate.polygTracts ?? 0) > 1} />

              {/* TISSUE CONTEXT */}
              {candidate.deliveryContext && (
                <>
                  <TableSection title={`Tissue Context: ${candidate.deliveryContext}`} />
                  <Td label="Target Tissue" value={candidate.deliveryContext} highlight />
                   {(candidate.tissueUptakeModifier ?? 0) !== 0 && <Td label="Tissue Uptake Modifier" value={`${(candidate.tissueUptakeModifier ?? 0) > 0 ? "+" : ""}${candidate.tissueUptakeModifier}`} warn={(candidate.tissueUptakeModifier ?? 0) < 0} />}
                  {candidate.tissueBbbModifier !== 0 && <Td label="BBB Crossing Modifier" value={`+${candidate.tissueBbbModifier}`} />}
                   {(candidate.tissueImmuneModifier ?? 0) !== 0 && <Td label="Immune Modifier" value={`${(candidate.tissueImmuneModifier ?? 0) > 0 ? "+" : ""}${candidate.tissueImmuneModifier}`} warn={(candidate.tissueImmuneModifier ?? 0) < 0} />}
                  {candidate.tissueChemBonus !== 0 && <Td label="Chemistry-Tissue Match" value={`+${candidate.tissueChemBonus}`} />}
                  {candidate.tissueLengthModifier !== 0 && <Td label="Length Penalty" value={candidate.tissueLengthModifier} warn />}
                  <tr className="border-b border-slate-100">
                    <td className="py-1.5 pr-4 text-[11px] text-slate-500">Tissue Notes</td>
                    <td className="py-1.5 text-right text-[10.5px] text-slate-500 italic max-w-[250px]">{candidate.tissueNotes}</td>
                  </tr>
                </>
              )}



              {/* ALLELE-SPECIFIC */}
              {candidate.knownVariant && (
                <>
                  <TableSection title="Allele-Specific Design" />
                  <Td label="Known Variant" value={candidate.knownVariant} highlight />
                  <Td label="Allele-Specific Targeting" value={candidate.alleleSpecific ? "Yes" : "No"} highlight={candidate.alleleSpecific} />

                  <tr className="border-b border-slate-100">
                    <td className="py-1.5 pr-4 text-[11px] text-slate-500">Allele Notes</td>
                    <td className="py-1.5 text-right text-[10.5px] text-slate-500 italic max-w-[250px]">{candidate.alleleNotes}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Formula explanation */}
        <div className="border-t border-slate-100 px-5 py-2">
          <button
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600"
          >
            <Info className="h-3 w-3" />
            {showBreakdown ? "Hide formulas & scoring details" : "Show scoring formulas & methodology"}
          </button>
          {showBreakdown && (
            <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 px-5 py-4 text-[10.5px] text-slate-500 leading-relaxed space-y-4">
              <div>
                <p className="font-bold text-slate-700 mb-1">Drug Likeness Score</p>
                <code className="block rounded bg-slate-100 px-3 py-2 text-[10px] font-mono text-slate-600">
                  DrugLike = Quality×0.35 + Nuclease×0.25 + Uptake×0.20 + (100−OffTarget)×0.20
                </code>
              </div>
              <div>
                <p className="font-bold text-slate-700 mb-1">Property Scores</p>
                <ul className="space-y-0.5 text-[10px]">
                  <li><strong>Nuclease Resistance:</strong> Base 20 + chemistry score + modification scores (PS +25, LNA +20, PNA +35).</li>
                  <li><strong>Cellular Uptake:</strong> Chemistry factor + length factor (shorter = better).</li>
                  <li><strong>BBB Crossing:</strong> Base 10 + PMO+CPP +15, PNA +15, short length +10.</li>
                  <li><strong>Off-target:</strong> Base 20 + low complexity +30, poly-G ×10, short length +15.</li>
                  <li><strong>Immune Stimulation:</strong> Base 5 + CpG ×15 + gapmer chemistry +10.</li>
                  <li><strong>Synthesis:</strong> Base 10 + homopolymer ×5 + high GC +15 + LNA/PNA modifiers.</li>
                </ul>
              </div>
              <div>
                <p className="font-bold text-slate-700 mb-1">Thermodynamic Calculations</p>
                <ul className="space-y-0.5 text-[10px]">
                  <li><strong>Tm:</strong> Nearest-neighbor thermodynamics (SantaLucia 1998) via primer3.</li>
                  <li><strong>Self-Structure MFE:</strong> ViennaRNA fold algorithm for minimum free energy.</li>
                  <li><strong>Target Duplex ΔG:</strong> ViennaRNA duplexfold for ASO-target binding energy.</li>
                  <li><strong>MW:</strong> Sum of nucleotide MWs (A=331.2, T=322.2, G=347.2, C=307.2) minus water for phosphodiester bonds.</li>
                  <li><strong>ε₂₆₀:</strong> Nearest-neighbor method for UV absorbance at 260nm.</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
