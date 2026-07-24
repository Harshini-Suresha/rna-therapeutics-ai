"use client";

import { useState } from "react";

interface OrfInfo {
  strand: string;
  frame: number;
  start: number;
  end: number;
  length: number;
  proteinLength: number;
}

interface ImmuneHit {
  motif: string;
  label: string;
  start: number;
  end: number;
}

interface TrackProps {
  seqLength: number;
  orfs: OrfInfo[];
  immuneHits: ImmuneHit[];
  palindromePositions: number[];
}

const ORF_COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#c084fc", "#e879f9", "#f472b6"];
const IMMUNE_COLOR = "#f59e0b";
const PALINDROME_COLOR = "#10b981";

export default function SequenceTrackViewer({
  seqLength,
  orfs,
  immuneHits,
  palindromePositions,
}: TrackProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  if (seqLength < 1) return null;

  const W = 600;
  const PAD_L = 40;
  const PAD_R = 10;
  const plotW = W - PAD_L - PAD_R;
  const TRACK_H = 18;
  const TRACK_GAP = 6;
  const TRACKS: { label: string; y: number; items: React.ReactNode }[] = [];

  const xScale = (pos: number) => PAD_L + (Math.max(1, Math.min(pos, seqLength)) / seqLength) * plotW;

  function showTip(x: number, y: number, text: string) {
    setTooltip({ x, y, text });
  }

  // ORF track
  const orfItems: React.ReactNode[] = [];
  if (orfs.length > 0) {
    orfs.forEach((orf, i) => {
      const x1 = xScale(orf.start);
      const x2 = xScale(orf.end);
      const w = Math.max(x2 - x1, 2);
      const yOff = orf.strand === "-" ? TRACK_H + 2 : 0;
      const color = ORF_COLORS[i % ORF_COLORS.length];
      orfItems.push(
        <g key={`orf-${i}`}>
          <rect
            x={x1}
            y={yOff}
            width={w}
            height={TRACK_H / 2 - 1}
            rx={2}
            fill={color}
            opacity={0.8}
            className="cursor-pointer"
            onMouseEnter={(e) =>
              showTip(
                e.clientX,
                e.clientY,
                `ORF ${orf.strand} frame ${orf.frame}: ${orf.start}–${orf.end} (${orf.proteinLength} aa)`
              )
            }
            onMouseLeave={() => setTooltip(null)}
          />
        </g>
      );
    });
  }

  const orfY = 10;
  if (orfs.length > 0) {
    TRACKS.push({
      label: "ORFs",
      y: orfY,
      items: <g transform={`translate(0,${orfY})`}>{orfItems}</g>,
    });
  }

  // Immune hits track
  const immuneY = orfY + TRACK_H + TRACK_GAP + 8;
  if (immuneHits.length > 0) {
    const immuneItems = immuneHits.slice(0, 30).map((hit, i) => {
      const x1 = xScale(hit.start);
      const x2 = xScale(hit.end);
      const w = Math.max(x2 - x1, 2);
      return (
        <rect
          key={`imm-${i}`}
          x={x1}
          y={0}
          width={w}
          height={TRACK_H}
          rx={2}
          fill={IMMUNE_COLOR}
          opacity={0.7}
          className="cursor-pointer"
          onMouseEnter={(e) =>
            showTip(e.clientX, e.clientY, `${hit.motif} @ ${hit.start}–${hit.end}`)
          }
          onMouseLeave={() => setTooltip(null)}
        />
      );
    });
    TRACKS.push({
      label: "Immune",
      y: immuneY,
      items: <g transform={`translate(0,${immuneY})`}>{immuneItems}</g>,
    });
  }

  // Palindrome track
  const palY = immuneY + TRACK_H + TRACK_GAP + 8;
  if (palindromePositions.length > 0) {
    const palItems = palindromePositions.slice(0, 50).map((pos, i) => (
      <rect
        key={`pal-${i}`}
        x={xScale(pos)}
        y={0}
        width={3}
        height={TRACK_H}
        rx={1}
        fill={PALINDROME_COLOR}
        opacity={0.6}
        className="cursor-pointer"
        onMouseEnter={(e) => showTip(e.clientX, e.clientY, `Palindrome @ pos ${pos}`)}
        onMouseLeave={() => setTooltip(null)}
      />
    ));
    TRACKS.push({
      label: "Palindromes",
      y: palY,
      items: <g transform={`translate(0,${palY})`}>{palItems}</g>,
    });
  }

  const totalH = TRACKS.length > 0 ? TRACKS[TRACKS.length - 1].y + TRACK_H + 28 : 60;

  // X axis ticks
  const xTicks = 6;
  const tickPositions = Array.from({ length: xTicks + 1 }, (_, i) => Math.round((seqLength * i) / xTicks));

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${totalH}`} className="w-full h-auto min-w-[400px]">
        {/* X axis */}
        <line x1={PAD_L} y1={totalH - 14} x2={W - PAD_R} y2={totalH - 14} stroke="#cbd5e1" strokeWidth={0.5} />
        {tickPositions.map((p) => (
          <g key={p}>
            <line x1={xScale(p)} y1={totalH - 18} x2={xScale(p)} y2={totalH - 12} stroke="#cbd5e1" strokeWidth={0.5} />
            <text x={xScale(p)} y={totalH - 2} textAnchor="middle" className="fill-slate-400" fontSize={8}>
              {p}
            </text>
          </g>
        ))}

        {/* Track labels + tracks */}
        {TRACKS.map((track) => (
          <g key={track.label}>
            <text x={PAD_L - 4} y={track.y + TRACK_H / 2 + 3} textAnchor="end" className="fill-slate-500" fontSize={8} fontWeight={600}>
              {track.label}
            </text>
            {track.items}
          </g>
        ))}

        {TRACKS.length === 0 && (
          <text x={W / 2} y={30} textAnchor="middle" className="fill-slate-400" fontSize={10}>
            No tracks to display
          </text>
        )}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 rounded-md bg-slate-800 px-2 py-1 text-[10px] text-white shadow-lg"
          style={{ left: tooltip.x + 10, top: tooltip.y - 30 }}
        >
          {tooltip.text}
        </div>
      )}

      {/* Legend */}
      <div className="mt-2 flex flex-wrap items-center gap-4 text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-4 rounded-sm" style={{ backgroundColor: "#6366f1" }} />
          ORF (+)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-4 rounded-sm" style={{ backgroundColor: "#e879f9" }} />
          ORF (−)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-4 rounded-sm" style={{ backgroundColor: IMMUNE_COLOR }} />
          Immune hit
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-4 rounded-sm" style={{ backgroundColor: PALINDROME_COLOR }} />
          Palindrome
        </span>
      </div>
    </div>
  );
}
