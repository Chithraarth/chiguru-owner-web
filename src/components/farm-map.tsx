interface CropBlock { name: string; acres: number; color: string }

const CROP_COLORS = [
  "#4ade80", "#86efac", "#bbf7d0", "#6ee7b7", "#34d399",
  "#fbbf24", "#fcd34d", "#a3e635", "#22d3ee", "#f97316",
  "#c084fc", "#fb7185", "#60a5fa", "#94a3b8",
];

interface Props {
  crops: Array<{ name: string; acres: number }>
  totalAcres?: number
}

function layoutBlocks(crops: CropBlock[], width: number, height: number) {
  const total = crops.reduce((s, c) => s + c.acres, 0);
  if (total === 0) return [];

  const rects: Array<{ x: number; y: number; w: number; h: number; crop: CropBlock }> = [];

  const sorted = [...crops].sort((a, b) => b.acres - a.acres);

  let x = 0;
  const remaining = { x: 0, y: 0, w: width, h: height };

  function slice(items: CropBlock[], area: typeof remaining, horizontal: boolean) {
    if (items.length === 0) return;
    const areaSize = horizontal ? area.w : area.h;
    const totalArea = area.w * area.h;
    const itemsTotal = items.reduce((s, c) => s + c.acres, 0);

    let cx = area.x;
    let cy = area.y;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const fraction = item.acres / itemsTotal;
      if (horizontal) {
        const w = areaSize * fraction;
        rects.push({ x: cx, y: area.y, w, h: area.h, crop: item });
        cx += w;
      } else {
        const h = areaSize * fraction;
        rects.push({ x: area.x, y: cy, w: area.w, h, crop: item });
        cy += h;
      }
    }
  }

  if (sorted.length <= 3) {
    slice(sorted, remaining, width >= height);
  } else {
    const half = Math.ceil(sorted.length / 2);
    const first = sorted.slice(0, half);
    const second = sorted.slice(half);
    const firstFrac = first.reduce((s, c) => s + c.acres, 0) / (total || 1);

    if (width >= height) {
      slice(first, { x: 0, y: 0, w: width * firstFrac, h: height }, false);
      slice(second, { x: width * firstFrac, y: 0, w: width * (1 - firstFrac), h: height }, false);
    } else {
      slice(first, { x: 0, y: 0, w: width, h: height * firstFrac }, true);
      slice(second, { x: 0, y: height * firstFrac, w: width, h: height * (1 - firstFrac) }, true);
    }
  }

  return rects;
  void x;
}

export function FarmMap({ crops, totalAcres }: Props) {
  const W = 320;
  const H = 180;

  const colored: CropBlock[] = crops
    .filter((c) => c.acres > 0)
    .map((c, i) => ({ ...c, color: CROP_COLORS[i % CROP_COLORS.length] }));

  const total = colored.reduce((s, c) => s + c.acres, 0);
  const rects = layoutBlocks(colored, W, H);

  if (colored.length === 0) {
    return (
      <div className="bg-primary/5 border-2 border-dashed border-primary/20 rounded-xl h-36 flex items-center justify-center text-gray-400 text-sm">
        Add crops to see your farm map
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl overflow-hidden border border-primary/20 shadow-sm bg-white">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ display: "block" }}>
          {rects.map((r, i) => (
            <g key={i}>
              <rect
                x={r.x + 1}
                y={r.y + 1}
                width={Math.max(r.w - 2, 0)}
                height={Math.max(r.h - 2, 0)}
                fill={r.crop.color}
                rx={4}
              />
              {r.w > 40 && r.h > 24 && (
                <text
                  x={r.x + r.w / 2}
                  y={r.y + r.h / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={Math.min(r.w / 6, r.h / 3, 13)}
                  fontWeight="600"
                  fill="#312e81"
                  style={{ userSelect: "none" }}
                >
                  {r.crop.name}
                </text>
              )}
              {r.w > 40 && r.h > 40 && (
                <text
                  x={r.x + r.w / 2}
                  y={r.y + r.h / 2 + Math.min(r.w / 6, r.h / 3, 13) + 3}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={Math.min(r.w / 8, r.h / 4, 10)}
                  fill="#4338ca"
                  style={{ userSelect: "none" }}
                >
                  {r.crop.acres.toFixed(1)} ac
                </text>
              )}
            </g>
          ))}
          <rect x={0} y={0} width={W} height={H} fill="none" stroke="hsl(var(--primary))" strokeWidth={2} rx={4} />
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {colored.map((c) => (
          <div key={c.name} className="flex items-center gap-1.5 bg-white rounded-full px-2.5 py-1 border border-gray-100 shadow-sm">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
            <span className="text-xs font-medium text-gray-700">{c.name}</span>
            <span className="text-xs text-gray-400">{((c.acres / total) * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
      {totalAcres && totalAcres > total && (
        <p className="text-xs text-gray-400">
          + {(totalAcres - total).toFixed(1)} ac unallocated
        </p>
      )}
    </div>
  );
}
