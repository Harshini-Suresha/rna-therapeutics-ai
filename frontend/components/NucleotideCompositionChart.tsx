"use client";

interface Composition {
  A: number;
  C: number;
  G: number;
  T: number;
  U: number;
}

const COLORS: Record<string, string> = {
  A: "#f59e0b",
  C: "#3b82f6",
  G: "#10b981",
  T: "#ef4444",
  U: "#8b5cf6",
};

export default function NucleotideCompositionChart({
  composition,
}: {
  composition: Composition;
}) {
  const entries = Object.entries(composition).filter(([, v]) => v > 0);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total === 0) return null;

  const size = 140;
  const cx = size / 2;
  const cy = size / 2;
  const R = 52;
  const r = 30;

  let acc = 0;
  const arcs = entries.map(([base, count]) => {
    const start = acc;
    acc += count / total;
    const end = acc;
    return { base, count, pct: ((count / total) * 100).toFixed(1), start, end };
  });

  function describeArc(start: number, end: number, outerR: number, innerR: number) {
    const s1 = start * 2 * Math.PI - Math.PI / 2;
    const e1 = end * 2 * Math.PI - Math.PI / 2;
    const large = end - start > 0.5 ? 1 : 0;
    const x1 = cx + outerR * Math.cos(s1);
    const y1 = cy + outerR * Math.sin(s1);
    const x2 = cx + outerR * Math.cos(e1);
    const y2 = cy + outerR * Math.sin(e1);
    const x3 = cx + innerR * Math.cos(e1);
    const y3 = cy + innerR * Math.sin(e1);
    const x4 = cx + innerR * Math.cos(s1);
    const y4 = cy + innerR * Math.sin(s1);
    return [
      `M${x1},${y1}`,
      `A${outerR},${outerR} 0 ${large} 1 ${x2},${y2}`,
      `L${x3},${y3}`,
      `A${innerR},${innerR} 0 ${large} 0 ${x4},${y4}`,
      "Z",
    ].join(" ");
  }

  return (
    <div className="flex items-center gap-5">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-[140px] w-[140px] shrink-0">
        {arcs.map((a) => (
          <path
            key={a.base}
            d={describeArc(a.start, a.end, R, r)}
            fill={COLORS[a.base]}
            stroke="#fff"
            strokeWidth={1.5}
          />
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" className="fill-slate-700" fontSize={14} fontWeight={700}>
          {total}
        </text>
        <text x={cx} y={cy + 9} textAnchor="middle" className="fill-slate-400" fontSize={8}>
          total nt
        </text>
      </svg>
      <div className="space-y-1.5">
        {arcs.map((a) => (
          <div key={a.base} className="flex items-center gap-2 text-[11.5px]">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: COLORS[a.base] }}
            />
            <span className="font-mono font-semibold text-slate-700 w-3">{a.base}</span>
            <span className="text-slate-500">
              {a.count} <span className="text-slate-400">({a.pct}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
