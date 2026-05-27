"use client";

// STRATA position liquidity chart — the planned interactive chart from the
// design bundle (interactive-chart.jsx), wired to real pool/position data.
// The drag handles, center grip, withdraw band and add-band slot are drawn as
// a static "PLANNED" affordance preview (no real drag yet — matches the mock).
import { PoolResponse, PositionInfo, toUi } from "@/lib/types";

export function PositionLiqChart({
  pool,
  position,
  activeBinId,
  width = 760,
  height = 320,
  showPriceScale = true,
}: {
  pool: PoolResponse;
  position: PositionInfo;
  activeBinId: number;
  width?: number;
  height?: number;
  showPriceScale?: boolean;
}) {
  const dx = pool.pool.tokenX.decimals;
  const dy = pool.pool.tokenY.decimals;
  const positionLo = position.lowerBinId;
  const positionHi = position.upperBinId;

  const W = width;
  const H = height;
  const PAD = { l: 56, r: 32, t: 36, b: showPriceScale ? 56 : 44 };
  const PW = W - PAD.l - PAD.r;
  const PH = H - PAD.t - PAD.b;

  // window: a little wider than the position so the surroundings are visible
  const minId = Math.min(positionLo - 12, activeBinId - 22);
  const maxId = Math.max(positionHi + 12, activeBinId + 22);

  // value lookup from real pool bins; fall back to position bins where present
  const valueById = new Map<number, number>();
  const priceById = new Map<number, number>();
  for (const b of pool.bins) {
    const price = Number(b.pricePerToken);
    valueById.set(b.binId, toUi(b.xAmount, dx) * price + toUi(b.yAmount, dy));
    priceById.set(b.binId, price);
  }
  for (const b of position.binData) {
    const price = Number(b.pricePerToken);
    if (!priceById.has(b.binId)) priceById.set(b.binId, price);
    const own = toUi(b.positionXAmount, dx) * price + toUi(b.positionYAmount, dy);
    if (own > (valueById.get(b.binId) ?? 0)) valueById.set(b.binId, own);
  }

  const activePrice = priceById.get(activeBinId) ?? Number(pool.activeBin.pricePerToken);
  const priceAt = (binId: number) => {
    const exact = priceById.get(binId);
    if (exact) return exact;
    // geometric extrapolation off the active bin price (bin step in bps)
    return activePrice * Math.pow(1 + pool.pool.binStep / 10000, binId - activeBinId);
  };

  const bins: { binId: number; valueUsd: number; side: "x" | "y" | "active" }[] = [];
  for (let id = minId; id <= maxId; id++) {
    bins.push({
      binId: id,
      valueUsd: valueById.get(id) ?? 0,
      side: id < activeBinId ? "y" : id > activeBinId ? "x" : "active",
    });
  }
  const n = bins.length;
  const binW = PW / n;
  const x = (binId: number) => PAD.l + (binId - minId) * binW;
  const xMid = (binId: number) => x(binId) + binW / 2;
  const maxV = Math.max(1, ...bins.map((b) => b.valueUsd));

  const loPrice = priceAt(positionLo);
  const hiPrice = priceAt(positionHi);

  // illustrative withdraw band + add slot (planned affordances)
  const withdrawLo = Math.min(positionLo + 4, positionHi);
  const withdrawHi = Math.min(positionLo + 11, positionHi);
  const addLo = Math.max(positionHi - 6, positionLo);
  const addHi = Math.max(positionHi - 1, positionLo);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
      <defs>
        <linearGradient id="plcOwnedX" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--token-x)" stopOpacity="1" />
          <stop offset="1" stopColor="var(--token-x)" stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id="plcOwnedY" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--token-y)" stopOpacity="1" />
          <stop offset="1" stopColor="var(--token-y)" stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id="plcRangeFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--accent-1)" stopOpacity="0.10" />
          <stop offset="1" stopColor="var(--accent-1)" stopOpacity="0.00" />
        </linearGradient>
      </defs>

      {/* y grid */}
      {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
        const py = PAD.t + PH - t * PH;
        return (
          <g key={"yg" + i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={py} y2={py} stroke="var(--border-1)" strokeDasharray={i === 0 ? "" : "2 3"} />
            <text x={PAD.l - 8} y={py + 3} textAnchor="end" fontSize="10" fill="var(--text-3)" fontFamily="var(--font-mono)">
              {i === 0 ? "0" : `$${Math.round((t * maxV) / 1000)}k`}
            </text>
          </g>
        );
      })}

      {/* range fill behind bars */}
      <rect x={x(positionLo)} y={PAD.t} width={(positionHi - positionLo + 1) * binW} height={PH} fill="url(#plcRangeFill)" />

      {/* bars */}
      {bins.map((b, i) => {
        const owned = b.binId >= positionLo && b.binId <= positionHi;
        const h = Math.max(1.5, (b.valueUsd / maxV) * PH);
        const bx = x(b.binId) + 0.6;
        const by = PAD.t + PH - h;
        const bw = Math.max(1, binW - 1.2);
        if (b.side === "active") {
          const halfH = h / 2;
          return (
            <g key={i}>
              <rect x={bx} y={by + halfH} width={bw} height={halfH} fill="var(--token-y)" rx={1} />
              <rect x={bx} y={by} width={bw} height={halfH} fill="var(--token-x)" rx={1} />
            </g>
          );
        }
        const fill = b.side === "y" ? (owned ? "url(#plcOwnedY)" : "var(--token-y)") : owned ? "url(#plcOwnedX)" : "var(--token-x)";
        return <rect key={i} x={bx} y={by} width={bw} height={h} fill={fill} opacity={owned ? 1 : 0.28} rx={1} />;
      })}

      {/* active-bin line + price tag */}
      <g>
        <line x1={xMid(activeBinId)} x2={xMid(activeBinId)} y1={PAD.t - 12} y2={H - PAD.b + 12} stroke="var(--active-bin)" strokeDasharray="3 3" strokeWidth="1" />
        <circle cx={xMid(activeBinId)} cy={PAD.t - 12} r="3.5" fill="var(--active-bin)" />
        <g transform={`translate(${xMid(activeBinId)}, ${PAD.t - 24})`}>
          <rect x="-36" y="-10" width="72" height="16" rx="3" fill="var(--bg-2)" stroke="var(--active-bin)" />
          <text x="0" y="2" textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" fontWeight="600" fill="var(--active-bin)">
            ${activePrice.toFixed(2)}
          </text>
        </g>
      </g>

      {/* edge handles + center grip (planned) */}
      <EdgeHandle x={x(positionLo)} top={PAD.t - 4} bottom={H - PAD.b + 4} side="left" label="LO" />
      <EdgeHandle x={x(positionHi + 1)} top={PAD.t - 4} bottom={H - PAD.b + 4} side="right" label="HI" />
      <CenterGrip x={(x(positionLo) + x(positionHi + 1)) / 2} y={PAD.t - 22} />

      {/* partial-withdraw + add-band affordances (planned, illustrative) */}
      <WithdrawBand x1={x(withdrawLo)} x2={x(withdrawHi + 1)} y={H - PAD.b} pct={60} />
      <AddBandSlot x1={x(addLo)} x2={x(addHi + 1)} y={H - PAD.b} />

      {/* price scale */}
      {showPriceScale &&
        [0, 0.25, 0.5, 0.75, 1].map((t, i) => {
          const binId = Math.round(minId + t * (n - 1));
          return (
            <text key={"px" + i} x={xMid(binId)} y={H - 26} textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" fill="var(--text-3)">
              ${priceAt(binId).toFixed(2)}
            </text>
          );
        })}

      <text x={PAD.l} y={H - 8} fontSize="9.5" fontFamily="var(--font-mono)" fill="var(--text-4)">bin {minId}</text>
      <text x={W - PAD.r} y={H - 8} textAnchor="end" fontSize="9.5" fontFamily="var(--font-mono)" fill="var(--text-4)">bin {maxId}</text>

      {/* range readout */}
      <g transform={`translate(${(x(positionLo) + x(positionHi + 1)) / 2}, ${H - PAD.b + 14})`}>
        <rect x="-66" y="-1" width="132" height="20" rx="4" fill="var(--bg-2)" stroke="var(--border-2)" />
        <text x="0" y="13" textAnchor="middle" fontSize="10.5" fontFamily="var(--font-mono)" fill="var(--text-2)">
          ${loPrice.toFixed(2)} → ${hiPrice.toFixed(2)}
        </text>
      </g>
    </svg>
  );
}

function EdgeHandle({ x, top, bottom, side, label }: { x: number; top: number; bottom: number; side: "left" | "right"; label: string }) {
  const midY = (top + bottom) / 2;
  return (
    <g>
      <line x1={x} x2={x} y1={top} y2={bottom} stroke="var(--accent-1)" strokeWidth="1.6" />
      <g transform={`translate(${x}, ${midY})`}>
        <rect x="-7" y="-22" width="14" height="44" rx="4" fill="var(--bg-1)" stroke="var(--accent-1)" strokeWidth="1.6" />
        <line x1="-2.5" y1="-9" x2="-2.5" y2="9" stroke="var(--accent-1)" strokeWidth="1.4" />
        <line x1="2.5" y1="-9" x2="2.5" y2="9" stroke="var(--accent-1)" strokeWidth="1.4" />
      </g>
      <g transform={`translate(${x + (side === "left" ? -16 : 16)}, ${midY})`}>
        <path
          d={side === "left" ? "M3 -5 L-3 0 L3 5" : "M-3 -5 L3 0 L-3 5"}
          stroke="var(--accent-1)"
          fill="none"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.6"
        />
      </g>
      <g transform={`translate(${x}, ${top - 6})`}>
        <rect x="-12" y="-12" width="24" height="14" rx="3" fill="var(--bg-2)" stroke="var(--accent-1)" />
        <text x="0" y="-2" textAnchor="middle" fontSize="9" fontFamily="var(--font-mono)" fontWeight="700" fill="var(--accent-1)">
          {label}
        </text>
      </g>
    </g>
  );
}

function CenterGrip({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect x="-26" y="-10" width="52" height="20" rx="10" fill="var(--bg-1)" stroke="var(--accent-1)" strokeWidth="1.4" />
      <g fill="var(--accent-1)">
        <circle cx="-8" cy="-2" r="1.2" />
        <circle cx="-8" cy="2" r="1.2" />
        <circle cx="-4" cy="-2" r="1.2" />
        <circle cx="-4" cy="2" r="1.2" />
      </g>
      <path d="M5 -4 L9 0 L5 4 M11 -4 L15 0 L11 4" stroke="var(--accent-1)" fill="none" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

function WithdrawBand({ x1, x2, y, pct }: { x1: number; x2: number; y: number; pct: number }) {
  const w = x2 - x1;
  const cx = (x1 + x2) / 2;
  return (
    <g>
      <rect x={x1} y={y - 2} width={w} height={6} fill="var(--danger)" opacity="0.65" rx={1} />
      <circle cx={x1} cy={y + 4} r="4" fill="var(--bg-1)" stroke="var(--danger)" strokeWidth="1.6" />
      <circle cx={x2} cy={y + 4} r="4" fill="var(--bg-1)" stroke="var(--danger)" strokeWidth="1.6" />
      <g transform={`translate(${cx}, ${y + 20})`}>
        <rect x="-30" y="-9" width="60" height="18" rx="9" fill="var(--bg-1)" stroke="var(--danger)" />
        <text x="0" y="3" textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" fontWeight="700" fill="var(--danger)">
          −{pct}% withdraw
        </text>
      </g>
    </g>
  );
}

function AddBandSlot({ x1, x2, y }: { x1: number; x2: number; y: number }) {
  const w = x2 - x1;
  const cx = (x1 + x2) / 2;
  return (
    <g>
      <rect x={x1} y={y - 6} width={w} height={8} fill="none" stroke="var(--accent-1)" strokeDasharray="3 3" rx={1} />
      <g transform={`translate(${cx}, ${y + 20})`}>
        <rect x="-30" y="-9" width="60" height="18" rx="9" fill="var(--bg-1)" stroke="var(--accent-1)" />
        <text x="0" y="3" textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" fontWeight="700" fill="var(--accent-1)">
          + add band
        </text>
      </g>
    </g>
  );
}
