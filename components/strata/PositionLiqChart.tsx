"use client";

// STRATA position liquidity chart. Wired to real pool/position data.
//
// When `interactive` is set, the markers become draggable and each release
// emits an `onGesture` describing the intended action (the page maps it to the
// matching Add/Remove/Resize/Rebalance panel — drag previews a delta, release
// opens the Preview → Execute flow). Without `interactive` the same markers are
// drawn as static affordances (the rail uses this mode).
import { useRef, useState } from "react";
import { PoolResponse, PositionInfo, toUi } from "@/lib/types";

type ResizeOp = { action: "increase" | "decrease"; length: number };
export type ChartGesture =
  | { type: "resize"; lower?: ResizeOp; upper?: ResizeOp }
  | { type: "recenter"; shiftBins: number }
  | { type: "withdraw"; fromBinId: number; toBinId: number; bps: number }
  | { type: "add"; minBinId: number; maxBinId: number };

// Which gesture's marker is currently armed (matches the four action panels).
// `null` shows no marker — the chart is read-only until the user picks one.
export type ChartMode = "add" | "remove" | "resize" | "rebalance" | null;

type Drag =
  | { kind: "lo"; lo: number }
  | { kind: "hi"; hi: number }
  | { kind: "grip"; shift: number; center: number }
  | { kind: "wlo" | "whi" | "wpct"; wLo: number; wHi: number; pct: number }
  | { kind: "alo" | "ahi"; aLo: number; aHi: number };

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

const fmtAmt = (v: number): string => {
  if (v === 0) return "0";
  if (v < 0.0001) return v.toExponential(1);
  return v.toLocaleString(undefined, { maximumFractionDigits: v < 1 ? 4 : 2 });
};

// Adaptive USD axis label — handles small positions ($5) and large pools ($15k).
const fmtUsdAxis = (v: number): string => {
  if (v >= 1000) return `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
  if (v >= 10) return `$${Math.round(v)}`;
  return `$${v.toFixed(1)}`;
};

export function PositionLiqChart({
  pool,
  position,
  activeBinId,
  width = 760,
  height = 320,
  showPriceScale = true,
  interactive = false,
  mode = null,
  onGesture,
  removeBand,
  addBand,
  resizeBand,
}: {
  pool: PoolResponse;
  position: PositionInfo;
  activeBinId: number;
  width?: number;
  height?: number;
  showPriceScale?: boolean;
  interactive?: boolean;
  mode?: ChartMode;
  onGesture?: (g: ChartGesture) => void;
  // Committed band selections lifted to the page (survive a chart remount).
  removeBand?: { lo: number; hi: number; pct: number };
  addBand?: { lo: number; hi: number };
  resizeBand?: { lo: number; hi: number };
}) {
  const dx = pool.pool.tokenX.decimals;
  const dy = pool.pool.tokenY.decimals;
  const positionLo = position.lowerBinId;
  const positionHi = position.upperBinId;

  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  // Committed band selections (remove / add). Without these the markers snap
  // back to their idle defaults on release even though the form keeps the value.
  const [wBand, setWBand] = useState<{ lo: number; hi: number; pct: number } | null>(null);
  const [aBand, setABand] = useState<{ lo: number; hi: number } | null>(null);
  // Persisted resize edges — without this the LO/HI handles snap back to the
  // position edges on release even though Resize keeps the bin count.
  const [rBand, setRBand] = useState<{ lo: number; hi: number } | null>(null);

  const W = width;
  const H = height;
  const PAD = { l: 56, r: 32, t: 36, b: showPriceScale ? 56 : 44 };
  const PW = W - PAD.l - PAD.r;
  const PH = H - PAD.t - PAD.b;

  // window: a little wider than the position so the surroundings are visible
  const minId = Math.min(positionLo - 50, activeBinId - 22);
  const maxId = Math.max(positionHi + 50, activeBinId + 22);

  // Bars reflect the POSITION's own per-bin holdings (matches the breakdown
  // card), not pool-wide liquidity — otherwise the active-bin neighborhood's
  // pool depth dwarfs the position and bins outside the pool's fetched window
  // render as invisible. Pool bins supply only price context.
  const valueById = new Map<number, number>();
  const priceById = new Map<number, number>();
  const solById = new Map<number, number>();
  const usdcById = new Map<number, number>();
  for (const b of pool.bins) priceById.set(b.binId, Number(b.pricePerToken));
  for (const b of position.binData) {
    const price = Number(b.pricePerToken);
    if (!priceById.has(b.binId)) priceById.set(b.binId, price);
    const sol = toUi(b.positionXAmount, dx);
    const usdc = toUi(b.positionYAmount, dy);
    solById.set(b.binId, sol);
    usdcById.set(b.binId, usdc);
    valueById.set(b.binId, sol * price + usdc);
  }

  const activePrice = priceById.get(activeBinId) ?? Number(pool.activeBin.pricePerToken);
  const priceAt = (binId: number) => {
    const exact = priceById.get(binId);
    if (exact) return exact;
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

  // default (idle) marker geometry — illustrative sub-bands inside the range
  const wLo0 = clamp(positionLo + Math.round((positionHi - positionLo) * 0.15), positionLo, positionHi);
  const wHi0 = clamp(positionLo + Math.round((positionHi - positionLo) * 0.4), positionLo, positionHi);
  const aLo0 = clamp(positionHi - Math.round((positionHi - positionLo) * 0.25), positionLo, positionHi);
  const aHi0 = clamp(positionHi - 1, positionLo, positionHi);

  // which markers to draw: only the armed mode's marker, and only when
  // interactive. Non-interactive (rail preview) draws no markers — just the
  // position liquidity bars.
  const showResize = interactive && mode === "resize";
  const showRebalance = interactive && mode === "rebalance";
  const showRemove = interactive && mode === "remove";
  const showAdd = interactive && mode === "add";

  // draft-aware geometry (reflects an in-flight drag); when idle in resize mode
  // the edges hold the last pulled band so they line up with the form's bin count
  let dLo = positionLo;
  let dHi = positionHi;
  if (drag?.kind === "grip") {
    dLo = positionLo + drag.shift;
    dHi = positionHi + drag.shift;
  } else {
    // seed both edges from the persisted resize band so dragging one edge keeps
    // the other's offset, then let the active drag override its own edge
    if (showResize) {
      dLo = clamp(rBand?.lo ?? resizeBand?.lo ?? positionLo, minId, maxId);
      dHi = clamp(rBand?.hi ?? resizeBand?.hi ?? positionHi, minId, maxId);
    }
    if (drag?.kind === "lo") dLo = drag.lo;
    if (drag?.kind === "hi") dHi = drag.hi;
  }
  const wLo = drag && "wLo" in drag ? Math.min(drag.wLo, drag.wHi) : clamp(wBand?.lo ?? removeBand?.lo ?? wLo0, positionLo, positionHi);
  const wHi = drag && "wHi" in drag ? Math.max(drag.wLo, drag.wHi) : clamp(wBand?.hi ?? removeBand?.hi ?? wHi0, positionLo, positionHi);
  const wPct = drag && "pct" in drag ? drag.pct : wBand?.pct ?? removeBand?.pct ?? 50;
  const aLo = drag && "aLo" in drag ? Math.min(drag.aLo, drag.aHi) : clamp(aBand?.lo ?? addBand?.lo ?? aLo0, positionLo, positionHi);
  const aHi = drag && "aHi" in drag ? Math.max(drag.aLo, drag.aHi) : clamp(aBand?.hi ?? addBand?.hi ?? aHi0, positionLo, positionHi);

  const loPrice = priceAt(dLo);
  const hiPrice = priceAt(dHi);
  // ghost = hatched preview of the resized range; persists after release so the
  // pulled band stays visible (not just mid-drag)
  const showGhost =
    drag?.kind === "lo" ||
    drag?.kind === "hi" ||
    drag?.kind === "grip" ||
    (showResize && !drag && (dLo !== positionLo || dHi !== positionHi));

  // ── pointer → bin/pct helpers ──
  const binAt = (clientX: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return minId;
    const sx = ((clientX - rect.left) / rect.width) * W;
    return clamp(minId + Math.round((sx - PAD.l) / binW - 0.5), minId, maxId);
  };
  const pctAt = (clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return 50;
    const sy = ((clientY - rect.top) / rect.height) * H;
    return clamp(Math.round(((PAD.t + PH - sy) / PH) * 100), 1, 100);
  };

  const start = (init: Drag) =>
    interactive
      ? (e: React.PointerEvent) => {
          e.preventDefault();
          e.stopPropagation();
          svgRef.current?.setPointerCapture(e.pointerId);
          setDrag(init);
        }
      : undefined;

  const onMove = (e: React.PointerEvent) => {
    if (!drag) return;
    if (drag.kind === "wpct") {
      const pct = pctAt(e.clientY);
      setDrag({ ...drag, pct });
      return;
    }
    const b = binAt(e.clientX);
    setDrag((prev) => {
      if (!prev) return prev;
      switch (prev.kind) {
        case "lo":
          return { ...prev, lo: clamp(b, minId, positionHi) };
        case "hi":
          return { ...prev, hi: clamp(b, positionLo, maxId) };
        case "grip":
          return { ...prev, shift: clamp(b - prev.center, minId - positionLo, maxId - positionHi) };
        case "wlo":
          return { ...prev, wLo: clamp(b, positionLo, positionHi) };
        case "whi":
          return { ...prev, wHi: clamp(b, positionLo, positionHi) };
        case "alo":
          return { ...prev, aLo: clamp(b, positionLo, positionHi) };
        case "ahi":
          return { ...prev, aHi: clamp(b, positionLo, positionHi) };
        default:
          return prev;
      }
    });
  };

  const onUp = (e: React.PointerEvent) => {
    if (!drag) return;
    svgRef.current?.releasePointerCapture(e.pointerId);
    const d = drag;
    setDrag(null);
    // Persist band selections so the marker stays where it was dragged.
    if (d.kind === "wlo" || d.kind === "whi" || d.kind === "wpct") {
      setWBand({ lo: Math.min(d.wLo, d.wHi), hi: Math.max(d.wLo, d.wHi), pct: d.pct });
    } else if (d.kind === "alo" || d.kind === "ahi") {
      setABand({ lo: Math.min(d.aLo, d.aHi), hi: Math.max(d.aLo, d.aHi) });
    } else if (d.kind === "lo" || d.kind === "hi") {
      // Keep BOTH edges so dragging one side preserves the other's offset.
      const finalLo = d.kind === "lo" ? d.lo : dLo;
      const finalHi = d.kind === "hi" ? d.hi : dHi;
      setRBand(finalLo === positionLo && finalHi === positionHi ? null : { lo: finalLo, hi: finalHi });
      if (onGesture) {
        const lower: ResizeOp | undefined =
          finalLo === positionLo ? undefined : { action: finalLo < positionLo ? "increase" : "decrease", length: Math.abs(positionLo - finalLo) };
        const upper: ResizeOp | undefined =
          finalHi === positionHi ? undefined : { action: finalHi > positionHi ? "increase" : "decrease", length: Math.abs(finalHi - positionHi) };
        if (lower || upper) onGesture({ type: "resize", lower, upper });
      }
      return;
    }
    if (!onGesture) return;
    switch (d.kind) {
      case "grip":
        if (d.shift) onGesture({ type: "recenter", shiftBins: d.shift });
        break;
      case "wlo":
      case "whi":
      case "wpct":
        onGesture({ type: "withdraw", fromBinId: Math.min(d.wLo, d.wHi), toBinId: Math.max(d.wLo, d.wHi), bps: Math.round(d.pct * 100) });
        break;
      case "alo":
      case "ahi":
        onGesture({ type: "add", minBinId: Math.min(d.aLo, d.aHi), maxBinId: Math.max(d.aLo, d.aHi) });
        break;
    }
  };

  // live readout while dragging
  let readout: string | null = null;
  if (drag?.kind === "lo" || drag?.kind === "hi") {
    const len = drag.kind === "lo" ? Math.abs(positionLo - drag.lo) : Math.abs(drag.hi - positionHi);
    const grow = drag.kind === "lo" ? drag.lo < positionLo : drag.hi > positionHi;
    readout = `Resize ${drag.kind === "lo" ? "lower" : "upper"} ${grow ? "+" : "−"}${len} bins`;
  } else if (drag?.kind === "grip") {
    readout = `Recenter ${drag.shift > 0 ? "→" : "←"} ${Math.abs(drag.shift)} bins`;
  } else if (drag && "pct" in drag) {
    readout = `Withdraw ${drag.pct}% · bins ${wLo}–${wHi}`;
  } else if (drag && "aLo" in drag) {
    readout = `Add band · bins ${aLo}–${aHi}`;
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ display: "block", touchAction: interactive ? "none" : undefined, userSelect: drag ? "none" : undefined }}
      onPointerMove={interactive ? onMove : undefined}
      onPointerUp={interactive ? onUp : undefined}
      onPointerCancel={interactive ? onUp : undefined}
    >
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
        <pattern id="plcHatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="var(--accent-1)" strokeWidth="1" opacity="0.55" />
        </pattern>
      </defs>

      {/* y grid */}
      {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
        const py = PAD.t + PH - t * PH;
        return (
          <g key={"yg" + i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={py} y2={py} stroke="var(--border-1)" strokeDasharray={i === 0 ? "" : "2 3"} />
            <text x={PAD.l - 8} y={py + 3} textAnchor="end" fontSize="10" fill="var(--text-3)" fontFamily="var(--font-mono)">
              {i === 0 ? "0" : fmtUsdAxis(t * maxV)}
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
        const onEnter = () => setHover(b.binId);
        const onLeave = () => setHover((cur) => (cur === b.binId ? null : cur));
        if (b.side === "active") {
          const halfH = h / 2;
          return (
            <g key={i} onMouseEnter={onEnter} onMouseLeave={onLeave}>
              <rect x={bx} y={by + halfH} width={bw} height={halfH} fill="var(--token-y)" rx={1} />
              <rect x={bx} y={by} width={bw} height={halfH} fill="var(--token-x)" rx={1} />
            </g>
          );
        }
        const fill = b.side === "y" ? (owned ? "url(#plcOwnedY)" : "var(--token-y)") : owned ? "url(#plcOwnedX)" : "var(--token-x)";
        return <rect key={i} x={bx} y={by} width={bw} height={h} fill={fill} opacity={owned ? 1 : 0.28} rx={1} onMouseEnter={onEnter} onMouseLeave={onLeave} />;
      })}

      {/* ghost preview while resizing / recentering */}
      {showGhost && (
        <rect
          x={x(dLo)}
          y={PAD.t - 4}
          width={(dHi - dLo + 1) * binW}
          height={PH + 8}
          fill="url(#plcHatch)"
          stroke="var(--accent-1)"
          strokeDasharray="4 3"
          strokeWidth="1.4"
          opacity="0.85"
        />
      )}

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

      {/* markers — shown per armed mode (or all, when used as a static preview) */}
      {showResize && (
        <>
          <EdgeHandle x={x(dLo)} top={PAD.t - 4} bottom={H - PAD.b + 4} side="left" label="LO" onPointerDown={start({ kind: "lo", lo: dLo })} interactive={interactive} />
          <EdgeHandle x={x(dHi + 1)} top={PAD.t - 4} bottom={H - PAD.b + 4} side="right" label="HI" onPointerDown={start({ kind: "hi", hi: dHi })} interactive={interactive} />
        </>
      )}
      {showRebalance && (
        <CenterGrip
          x={(x(dLo) + x(dHi + 1)) / 2}
          y={PAD.t - 22}
          onPointerDown={start({ kind: "grip", shift: 0, center: Math.round((positionLo + positionHi) / 2) })}
          interactive={interactive}
        />
      )}
      {showRemove && (() => {
        const perBin: { bx: number; by: number; bw: number; rh: number }[] = [];
        for (let id = wLo; id <= wHi; id++) {
          const v = valueById.get(id) ?? 0;
          const h = Math.max(1.5, (v / maxV) * PH);
          const bx = x(id) + 0.6;
          const by = PAD.t + PH - h;
          const bw = Math.max(1, binW - 1.2);
          perBin.push({ bx, by, bw, rh: h * (wPct / 100) });
        }
        return (
          <WithdrawBand
            x1={x(wLo)}
            x2={x(wHi + 1)}
            yBase={PAD.t + PH}
            yLevel={PAD.t + PH - (wPct / 100) * PH}
            pct={wPct}
            perBin={perBin}
            interactive={interactive}
            onLoDown={start({ kind: "wlo", wLo, wHi, pct: wPct })}
            onHiDown={start({ kind: "whi", wLo, wHi, pct: wPct })}
            onPctDown={start({ kind: "wpct", wLo, wHi, pct: wPct })}
          />
        );
      })()}
      {showAdd && (
        <AddBandSlot
          x1={x(aLo)}
          x2={x(aHi + 1)}
          y={H - PAD.b}
          interactive={interactive}
          onLoDown={start({ kind: "alo", aLo, aHi })}
          onHiDown={start({ kind: "ahi", aLo, aHi })}
        />
      )}

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
      <g transform={`translate(${(x(dLo) + x(dHi + 1)) / 2}, ${H - PAD.b + 14})`}>
        <rect x="-66" y="-1" width="132" height="20" rx="4" fill="var(--bg-2)" stroke="var(--border-2)" />
        <text x="0" y="13" textAnchor="middle" fontSize="10.5" fontFamily="var(--font-mono)" fill="var(--text-2)">
          ${loPrice.toFixed(2)} → ${hiPrice.toFixed(2)}
        </text>
      </g>

      {/* live drag readout */}
      {readout && (
        <g transform={`translate(${PAD.l}, ${PAD.t - 4})`}>
          <rect x="0" y="-16" width={readout.length * 6.4 + 16} height="20" rx="5" fill="var(--accent-1)" />
          <text x="8" y="-2" fontSize="11" fontFamily="var(--font-mono)" fontWeight="700" fill="var(--accent-fg)">{readout}</text>
        </g>
      )}

      {/* per-bin hover readout — exact price + liquidity + token split */}
      {hover != null && !drag && (() => {
        const hp = priceAt(hover);
        const hv = valueById.get(hover) ?? 0;
        const hsol = solById.get(hover) ?? 0;
        const husdc = usdcById.get(hover) ?? 0;
        const tw = 158;
        const th = 56;
        const cx = clamp(xMid(hover), PAD.l + tw / 2, W - PAD.r - tw / 2);
        const ty = PAD.t + 4;
        return (
          <g pointerEvents="none">
            <rect x={x(hover)} y={PAD.t} width={binW} height={PH} fill="var(--bg-2)" opacity="0.4" />
            <g transform={`translate(${cx}, ${ty})`}>
              <rect x={-tw / 2} y="0" width={tw} height={th} rx="6" fill="var(--bg-2)" stroke="var(--border-2)" />
              <text x={-tw / 2 + 10} y="16" fontSize="11" fontFamily="var(--font-mono)" fontWeight="700" fill="var(--text-1)">
                bin {hover} · ${hp.toFixed(4)}
              </text>
              <text x={-tw / 2 + 10} y="31" fontSize="10" fontFamily="var(--font-mono)" fill="var(--text-2)">
                ${hv.toFixed(2)} liquidity
              </text>
              <text x={-tw / 2 + 10} y="46" fontSize="10" fontFamily="var(--font-mono)" fill="var(--text-3)">
                SOL {fmtAmt(hsol)} · USDC {fmtAmt(husdc)}
              </text>
            </g>
          </g>
        );
      })()}
    </svg>
  );
}

function EdgeHandle({
  x,
  top,
  bottom,
  side,
  label,
  onPointerDown,
  interactive,
}: {
  x: number;
  top: number;
  bottom: number;
  side: "left" | "right";
  label: string;
  onPointerDown?: (e: React.PointerEvent) => void;
  interactive?: boolean;
}) {
  const midY = (top + bottom) / 2;
  const cursor = interactive ? "col-resize" : undefined;
  return (
    <g>
      <line x1={x} x2={x} y1={top} y2={bottom} stroke="var(--accent-1)" strokeWidth="1.6" />
      {/* wide invisible hit target */}
      {interactive && <rect x={x - 11} y={top} width={22} height={bottom - top} fill="transparent" style={{ cursor }} onPointerDown={onPointerDown} />}
      <g transform={`translate(${x}, ${midY})`} style={{ cursor }} onPointerDown={onPointerDown}>
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

function CenterGrip({ x, y, onPointerDown, interactive }: { x: number; y: number; onPointerDown?: (e: React.PointerEvent) => void; interactive?: boolean }) {
  return (
    <g transform={`translate(${x}, ${y})`} style={{ cursor: interactive ? "grab" : undefined }} onPointerDown={onPointerDown}>
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

function WithdrawBand({
  x1,
  x2,
  yBase,
  yLevel,
  pct,
  perBin,
  interactive,
  onLoDown,
  onHiDown,
  onPctDown,
}: {
  x1: number;
  x2: number;
  yBase: number;
  yLevel: number;
  pct: number;
  perBin: { bx: number; by: number; bw: number; rh: number }[];
  interactive?: boolean;
  onLoDown?: (e: React.PointerEvent) => void;
  onHiDown?: (e: React.PointerEvent) => void;
  onPctDown?: (e: React.PointerEvent) => void;
}) {
  const w = x2 - x1;
  const cx = (x1 + x2) / 2;
  const ew = interactive ? "ew-resize" : undefined;
  const ns = interactive ? "ns-resize" : undefined;
  // Keep the label on-plot: pin it just inside the top of the fill, but bump it
  // below the top edge when there's no room (very low pct → fill is thin).
  const labelInside = yBase - yLevel >= 22;
  const labelY = labelInside ? yLevel + 14 : Math.max(yLevel - 14, 8);
  return (
    <g>
      {/* per-bin fill — each rect starts at top of bin's bar, height = pct% of that bar */}
      {perBin.map((p, i) => (
        <rect key={i} x={p.bx} y={p.by} width={p.bw} height={p.rh} fill="var(--danger)" opacity="0.45" rx={1} />
      ))}
      {/* top edge = vertical drag handle (changes pct) — spans band at pct% of plot height */}
      <rect x={x1} y={yLevel - 3} width={w} height={6} fill="var(--danger)" opacity="0.65" rx={1} style={{ cursor: ns }} onPointerDown={onPctDown} />
      <line x1={x1} x2={x2} y1={yLevel} y2={yLevel} stroke="var(--danger)" strokeDasharray="3 3" opacity="0.6" />
      {/* corner pips = horizontal width handles (change wLo / wHi) */}
      <circle cx={x1} cy={yLevel} r="5" fill="var(--bg-1)" stroke="var(--danger)" strokeWidth="1.6" style={{ cursor: ew }} onPointerDown={onLoDown} />
      <circle cx={x2} cy={yLevel} r="5" fill="var(--bg-1)" stroke="var(--danger)" strokeWidth="1.6" style={{ cursor: ew }} onPointerDown={onHiDown} />
      {/* readout pill — also a pct grab target */}
      <g transform={`translate(${cx}, ${labelY})`} style={{ cursor: ns }} onPointerDown={onPctDown}>
        <rect x="-34" y="-9" width="68" height="18" rx="9" fill="var(--bg-1)" stroke="var(--danger)" />
        <text x="0" y="3" textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" fontWeight="700" fill="var(--danger)">
          −{pct}% withdraw
        </text>
      </g>
    </g>
  );
}

function AddBandSlot({
  x1,
  x2,
  y,
  interactive,
  onLoDown,
  onHiDown,
}: {
  x1: number;
  x2: number;
  y: number;
  interactive?: boolean;
  onLoDown?: (e: React.PointerEvent) => void;
  onHiDown?: (e: React.PointerEvent) => void;
}) {
  const w = x2 - x1;
  const cx = (x1 + x2) / 2;
  const ew = interactive ? "ew-resize" : undefined;
  return (
    <g>
      <rect x={x1} y={y - 6} width={w} height={8} fill="none" stroke="var(--accent-1)" strokeDasharray="3 3" rx={1} />
      {interactive && (
        <>
          <circle cx={x1} cy={y - 2} r="5" fill="var(--bg-1)" stroke="var(--accent-1)" strokeWidth="1.6" style={{ cursor: ew }} onPointerDown={onLoDown} />
          <circle cx={x2} cy={y - 2} r="5" fill="var(--bg-1)" stroke="var(--accent-1)" strokeWidth="1.6" style={{ cursor: ew }} onPointerDown={onHiDown} />
        </>
      )}
      <g transform={`translate(${cx}, ${y + 20})`}>
        <rect x="-30" y="-9" width="60" height="18" rx="9" fill="var(--bg-1)" stroke="var(--accent-1)" />
        <text x="0" y="3" textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" fontWeight="700" fill="var(--accent-1)">
          + add band
        </text>
      </g>
    </g>
  );
}
