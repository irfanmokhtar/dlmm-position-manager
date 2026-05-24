// Client-safe bin <-> price math. Uses the geometric bin spacing:
//   price(bin) = activePrice * (1 + binStep/10000) ^ (bin - activeBin)
// pricePerToken values from the pool response are already human-readable.

export function binIdToPrice(
  binId: number,
  activeBinId: number,
  activePrice: number,
  binStep: number,
): number {
  const s = binStep / 10000;
  return activePrice * Math.pow(1 + s, binId - activeBinId);
}

export function priceToBinId(
  price: number,
  activeBinId: number,
  activePrice: number,
  binStep: number,
  round: "floor" | "ceil" | "round" = "round",
): number {
  if (price <= 0 || activePrice <= 0) return activeBinId;
  const s = binStep / 10000;
  const raw = activeBinId + Math.log(price / activePrice) / Math.log(1 + s);
  return round === "floor"
    ? Math.floor(raw)
    : round === "ceil"
      ? Math.ceil(raw)
      : Math.round(raw);
}
