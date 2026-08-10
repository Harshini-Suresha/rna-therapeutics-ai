"use client";

import { Activity, BarChart3, Dna, Gauge, Radar, ShieldAlert, Target, TrendingDown } from "lucide-react";
import { AssoCandidate } from "@/types/geneSilencing";
import { Card } from "./ui";
import CandidateScoreChart from "./CandidateScoreChart";
import DuplexEnergyChart from "./DuplexEnergyChart";
import BindingLandscapeChart from "./BindingLandscapeChart";
import GcWindowChart from "./GcWindowChart";
import PurineBalanceChart from "./PurineBalanceChart";
import StabilityDistributionChart from "./StabilityDistributionChart";
import RiskFlagMatrix from "./RiskFlagMatrix";
import CandidateHeatmap from "./CandidateHeatmap";
import HeuristicComparisonChart from "./HeuristicComparisonChart";

function SuiteSection({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-100 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-teal-700" />
        <p className="text-[11.5px] font-semibold text-slate-700">{title}</p>
      </div>
      {children}
    </div>
  );
}

export default function AsoVisualizationSuite({ candidates }: { candidates: AssoCandidate[] }) {
  if (!candidates.length) return null;

  return (
    <Card className="p-5">
      <div className="grid grid-cols-1 gap-5">
        <SuiteSection icon={BarChart3} title="Composite score comparison">
          <CandidateScoreChart candidates={candidates} />
        </SuiteSection>
        <SuiteSection icon={Radar} title="Binding landscape — Tm vs duplex ΔG">
          <BindingLandscapeChart candidates={candidates} />
        </SuiteSection>
        <SuiteSection icon={TrendingDown} title="Binding strength ranking — duplex ΔG">
          <DuplexEnergyChart candidates={candidates} />
        </SuiteSection>
        <SuiteSection icon={Target} title="GC content vs design window">
          <GcWindowChart candidates={candidates} />
        </SuiteSection>
        <SuiteSection icon={Dna} title="Purine / pyrimidine balance">
          <PurineBalanceChart candidates={candidates} />
        </SuiteSection>
        <SuiteSection icon={Activity} title="Stability & self-structure distribution">
          <StabilityDistributionChart candidates={candidates} />
        </SuiteSection>
        <SuiteSection icon={ShieldAlert} title="Risk flag matrix">
          <RiskFlagMatrix candidates={candidates} />
        </SuiteSection>
        <SuiteSection icon={Gauge} title="Candidate × metric favorability heatmap">
          <CandidateHeatmap candidates={candidates} />
        </SuiteSection>
        <SuiteSection icon={BarChart3} title="Drug-like estimate comparison">
          <HeuristicComparisonChart candidates={candidates} />
        </SuiteSection>
      </div>

      <p className="mt-4 text-[10px] leading-relaxed text-slate-400">
        Everything on this card is computed directly from the candidates returned by the design engine. All 9 visualizations are
        rendered together here for a single-screen overview.
      </p>
    </Card>
  );
}
