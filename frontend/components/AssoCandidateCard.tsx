"use client";

import { Copy, Check, Info } from "lucide-react";
import { useState } from "react";
import { AssoCandidate } from "@/types/geneSilencing";
import { Card } from "./ui";

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
      {label}
    </span>
  );
}

function ScoreBar({ value, max = 100, warn }: { value: number; max?: number; warn?: boolean }) {
  const pct = Math.min(100, (value / max) * 100);
  const color = warn ? "bg-amber-400" : pct >= 70 ? "bg-emerald-400" : pct >= 40 ? "bg-blue-400" : "bg-slate-300";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-semibold text-slate-600 w-7 text-right">{value}</span>
    </div>
  );
}

function Row({ label, value, unit, warn, highlight }: { label: string; value: string | number; unit?: string; warn?: boolean; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-1.5 last:border-0">
      <span className="text-[11px] text-slate-500">{label}</span>
      <span className={`text-[11.5px] font-semibold ${highlight ? "text-brand" : warn ? "text-amber-600" : "text-slate-700"}`}>
        {value}{unit && <span className="text-[10px] font-normal text-slate-400 ml-0.5">{unit}</span>}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{title}</p>
      <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-1">
        {children}
      </div>
    </div>
  );
}

function ScoreSection({ title, value, bar }: { title: string; value: number; bar?: boolean }) {
  const label = value >= 70 ? "Excellent" : value >= 50 ? "Good" : value >= 30 ? "Fair" : "Poor";
  const color = value >= 70 ? "text-emerald-600" : value >= 50 ? "text-blue-600" : value >= 30 ? "text-amber-600" : "text-red-500";
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-1.5 last:border-0">
      <span className="text-[11px] text-slate-500">{title}</span>
      <div className="flex items-center gap-2">
        {bar && <ScoreBar value={value} />}
        <span className={`text-[10.5px] font-medium ${color}`}>{label}</span>
      </div>
    </div>
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
    candidate.selfComplementScore === 0
      ? "None"
      : candidate.selfComplementScore < 0.1
        ? "Low"
        : candidate.selfComplementScore < 0.2
          ? "Moderate"
          : "High";

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-0 p-0">
        {/* Header bar */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand/10 text-[12px] font-bold text-brand">
              {rank}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-slate-800">{candidate.chemistry.toUpperCase()}</span>
                <span className="text-[11px] text-slate-400">·</span>
                <span className="text-[11px] text-slate-500">{candidate.length} nt oligonucleotide</span>
                <ConfidenceBadge score={candidate.qualityScore} />
              </div>
              <p className="text-[10.5px] text-slate-400 mt-0.5">{candidate.targetRegion}</p>
            </div>
          </div>
          <button
            onClick={copySequence}
            className="flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px] text-slate-500 hover:bg-white transition-colors"
          >
            {copied ? (
              <><Check className="h-3 w-3 text-emerald-500" /> Copied</>
            ) : (
              <><Copy className="h-3 w-3" /> Copy seq</>
            )}
          </button>
        </div>

        {/* Sequence */}
        <div className="border-b border-slate-100 px-5 py-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Sequence (5'→3')</p>
          <div className="rounded-lg bg-slate-900 px-4 py-2.5 font-mono text-[13px] text-emerald-400 break-all leading-relaxed tracking-widest">
            {candidate.sequence}
          </div>
          <div className="mt-1.5 flex gap-4 text-[10px] text-slate-400">
            <span>MW: {candidate.molecularWeight?.toLocaleString()} Da</span>
            <span>ε₂₆₀: {candidate.extinctionCoefficient?.toLocaleString()} L/mol·cm</span>
            <span>Duplex: {candidate.duplexStability}</span>
          </div>
        </div>

        {/* Three-column table layout */}
        <div className="grid grid-cols-1 divide-y divide-slate-100 md:grid-cols-3 md:divide-y-0 md:divide-x">
          {/* Column 1 — Biophysical */}
          <div className="px-5 py-3 space-y-3">
            <Section title="Biophysical Properties">
              <Row label="GC Content" value={`${candidate.gcContent}%`} />
              <Row label="Melting Temperature" value={candidate.meltingTemp} unit="°C" />
              <Row label="Self-dimer Risk" value={selfDimerLabel} />
              <Row label="Poly-G Tracts" value={candidate.polygTracts} warn={candidate.polygTracts > 0} />
              <Row label="Binding Energy" value={candidate.bindingEnergy} unit="kcal/mol" />
            </Section>

            <Section title="Sequence Composition">
              <Row label="CpG Dinucleotides" value={candidate.cpgCount} warn={candidate.cpgCount >= 3} />
              <Row label="Longest Homopolymer" value={candidate.longestHomopolymer} unit="bp" warn={candidate.longestHomopolymer >= 4} />
              <Row label="Purine Content" value={`${(candidate.purineContent * 100).toFixed(1)}%`} />
              <Row label="GC Skew" value={candidate.gcSkew.toFixed(3)} />
              <Row label="Complexity" value={candidate.sequenceComplexity.toFixed(2)} warn={candidate.sequenceComplexity < 0.7} />
            </Section>
          </div>

          {/* Column 2 — Target & Design */}
          <div className="px-5 py-3 space-y-3">
            <Section title="Target Information">
              {candidate.exonNumber != null && (
                <Row label="Target Exon" value={`Exon ${candidate.exonNumber}`} highlight />
              )}
              {candidate.exonLength != null && (
                <Row label="Exon Length" value={candidate.exonLength} unit="bp" />
              )}
              <Row label="Position" value={candidate.targetRegion} />
              <Row label="Chemistry" value={candidate.chemistry} />
              {candidate.modifications.length > 0 && (
                <div className="flex items-center justify-between border-b border-slate-100 py-1.5 last:border-0">
                  <span className="text-[11px] text-slate-500">Modifications</span>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {candidate.modifications.map((m) => (
                      <span key={m} className="rounded bg-indigo-50 px-1.5 py-0.5 text-[9.5px] font-medium text-indigo-600">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Section>

            <Section title="Drug-like Properties">
              <ScoreSection title="Drug Likeness" value={candidate.drugLikeness} bar />
              <ScoreSection title="Nuclease Resistance" value={candidate.nucleaseResistance} bar />
              <ScoreSection title="Cellular Uptake" value={candidate.cellularUptake} bar />
              <ScoreSection title="BBB Crossing" value={candidate.bbbCrossing} bar />
            </Section>
          </div>

          {/* Column 3 — Risk & Quality */}
          <div className="px-5 py-3 space-y-3">
            <Section title="Risk Assessment">
              <ScoreSection title="Off-target Risk" value={100 - candidate.offTargetRisk} bar />
              <ScoreSection title="Immune Stimulation" value={100 - candidate.immuneStimulation} bar />
              <ScoreSection title="Synthesis Feasibility" value={100 - candidate.synthesisDifficulty} bar />
            </Section>

            <Section title="Quality Score Breakdown">
              <Row label="Final Score" value={candidate.qualityScore} unit="/100" highlight />
              <Row label="GC Score (×0.30)" value={candidate.gcScore} />
              <Row label="Tm Score (×0.40)" value={candidate.tmScore} />
              <Row label="Self-dimer Penalty" value={`-${candidate.selfComplementPenalty}`} warn={candidate.selfComplementPenalty > 0} />
              <Row label="Poly-G Penalty" value={`-${candidate.polygPenalty}`} warn={candidate.polygPenalty > 0} />
              {candidate.chemBonus !== 0 && (
                <Row label="Chemistry Bonus" value={`+${candidate.chemBonus}`} />
              )}
              {candidate.modBonus !== 0 && (
                <Row label="Modification Bonus" value={`+${candidate.modBonus}`} />
              )}
              {candidate.cpgPenalty > 0 && (
                <Row label="CpG Immune Risk" value={`-${candidate.cpgPenalty}`} warn />
              )}
            </Section>
          </div>
        </div>

        {/* Formula explanation — toggle */}
        <div className="border-t border-slate-100 px-5 py-2">
          <button
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600"
          >
            <Info className="h-3 w-3" />
            {showBreakdown ? "Hide formula" : "How is Composite Quality calculated?"}
          </button>
          {showBreakdown && (
            <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-[10.5px] text-slate-500 leading-relaxed">
              <p className="font-semibold text-slate-600 mb-1">Composite Quality Formula</p>
              <code className="block rounded bg-slate-100 px-2 py-1.5 text-[10px] font-mono text-slate-600 mb-2">
                Score = GC×0.30 + Tm×0.40 − SelfDimer − PolyG + ChemBonus + ModBonus − CpG
              </code>
              <ul className="space-y-0.5 text-[10px]">
                <li><strong>GC Content (×0.30):</strong> Peaks at 50%. Score = max(0, 100 − |GC−50%|×400)</li>
                <li><strong>Melting Temp (×0.40):</strong> Peaks at 52°C. Score = max(0, 100 − |Tm−52|×3)</li>
                <li><strong>Self-dimer:</strong> Palindromic 4-mer fraction × 200</li>
                <li><strong>Poly-G:</strong> G-tract count × 15</li>
                <li><strong>Chemistry Bonus:</strong> LNA +5, 2'-OMe +3, siRNA +2, PMO −3</li>
                <li><strong>Modification Bonus:</strong> PS +4, LNA wings +5, 2'-OMe +3, PMO core +2, PNA +3</li>
                <li><strong>CpG Penalty:</strong> (CpG count − 2) × 5 if >2 CpGs</li>
              </ul>
              <p className="mt-2 font-semibold text-slate-600 mb-1">Drug-like Property Scores</p>
              <ul className="space-y-0.5 text-[10px]">
                <li><strong>Drug Likeness:</strong> Weighted combo of quality (35%), nuclease resistance (25%), uptake (20%), low off-target (20%)</li>
                <li><strong>Nuclease Resistance:</strong> Based on chemistry + modifications (PS, LNA, PNA all increase)</li>
                <li><strong>Cellular Uptake:</strong> Based on chemistry and length (shorter = better uptake)</li>
                <li><strong>BBB Crossing:</strong> Most ASOs don't cross well; PMO+CPP and PNA improve this</li>
                <li><strong>Off-target Risk:</strong> Low sequence complexity + poly-G = higher risk</li>
                <li><strong>Immune Stimulation:</strong> CpG dinucleotides activate TLR9; gapmers more immunostimulatory than PMOs</li>
                <li><strong>Synthesis Feasibility:</strong> Homopolymer runs, high GC, LNA, and PNA increase difficulty</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
