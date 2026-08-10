"use client";

import { AssoCandidate } from "@/types/geneSilencing";

interface Axis {
  label: string;
  value: (c: AssoCandidate) => number;
  raw: (c: AssoCandidate) => number;
}

// All axes are shown as "favorable" (higher = better). Risk axes are inverted
// (100 - risk) so the profile is intuitive: a larger polygon = better profile.
// Raw values are surfaced alongside in the legend so nothing is hidden.
const AXES: Axis[] = [
  { label: "Nuclease Resistance", value: (c) => c.heuristicEstimates.nucleaseResistance.value, raw: (c) => c.heuristicEstimates.nucleaseResistance.value },
  { label: "Cellular Uptake", value: (c) => c.heuristicEstimates.cellularUptake.value, raw: (c) => c.heuristicEstimates.cellularUptake.value },
  { label: "BBB Crossing", value: (c) => c.heuristicEstimates.bbbCrossing.value, raw: (c) => c.heuristicEstimates.bbbCrossing.value },
  { label: "Synthesis Ease", value: (c) => 100 - c.heuristicEstimates.synthesisDifficulty.value, raw: (c) => c.heuristicEstimates.synthesisDifficulty.value },
  { label: "Off-target Safety", value: (c) => 100 - c.heuristicEstimates.offTargetRisk.value, raw: (c) => c.heuristicEstimates.offTargetRisk.value },
  { label: "Immune Safety", value: (c) => 100 - c.heuristicEstimates.immuneStimulation.value, raw: (c) => c.heuristicEstimates.immuneStimulation.value },
];

const N = AXES.length;
const W = 520;
const H = 450;
const CX = W / 2;
const CY = H / 2 - 20;
const R = 150;
const COLOR = "#0F766E";

function point(i: number, r: number): { x: number; y: number } {
  const ang = (-90 + (360 * i) / N) * (Math.PI / 180);
  return { x: CX + r * Math.cos(ang), y: CY + r * Math.sin(ang) };
}

export default function AsoRadarChart({
  candidate,
}: {
  candidate: AssoCandidate;
}) {
  const values = AXES.map((a) => a.value(candidate));

  const polyPoints = values
    .map((v, i) => {
      const p = point(i, (R * Math.min(100, Math.max(0, v))) / 100);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-w-[480px]">
        {/* Grid rings */}
        {[25, 50, 75, 100].map((r) => (
          <polygon
            key={r}
            points={AXES.map((_, i) => {
              const p = point(i, (R * r) / 100);
              return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
            }).join(" ")}
            fill={r === 100 ? "#f8fafc" : "none"}
            stroke="#e2e8f0"
            strokeWidth={0.8}
          />
        ))}

        {/* Spokes */}
        {AXES.map((_, i) => {
          const p = point(i, R);
          return (
            <line key={i} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke="#e2e8f0" strokeWidth={0.8} />
          );
        })}

        {/* Data polygon */}
        <polygon points={polyPoints} fill={COLOR} opacity={0.2} stroke={COLOR} strokeWidth={2.4} />
        {values.map((v, i) => {
          const p = point(i, (R * Math.min(100, Math.max(0, v))) / 100);
          return <circle key={i} cx={p.x} cy={p.y} r={3.6} fill={COLOR} stroke="#fff" strokeWidth={1.4} />;
        })}

        {/* Vertex value labels */}
        {values.map((v, i) => {
          const p = point(i, (R * Math.min(100, Math.max(0, v))) / 100 - 16);
          return (
            <text key={i} x={p.x} y={p.y + 4} textAnchor="middle" className="fill-slate-700" fontSize={12} fontWeight={700}>
              {Math.round(v)}
            </text>
          );
        })}

        {/* Axis labels */}
        {AXES.map((a, i) => {
          const p = point(i, R + 30);
          const anchor = Math.abs(p.x - CX) < 12 ? "middle" : p.x > CX ? "start" : "end";
          return (
            <text key={a.label} x={p.x} y={p.y + 4} textAnchor={anchor} className="fill-black" fontSize={11.5} fontWeight={700}>
              {a.label}
            </text>
          );
        })}
      </svg>

      {/* Legend with raw values */}
      <div className="mt-3 w-full space-y-1.5">
        {AXES.map((a, i) => {
          const v = Math.round(values[i]);
          const raw = Math.round(a.raw(candidate));
          return (
            <div key={a.label} className="flex items-center justify-between text-[11.5px]">
              <span className="flex items-center gap-1.5 text-slate-500">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLOR }} />
                {a.label}
              </span>
              <span className="font-semibold text-slate-600">
                {v}
                {raw !== v && <span className="ml-1 font-normal text-slate-400">(raw {raw})</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
