import BN from "bn.js";

// human decimal string -> raw integer BN at the given token decimals
export function toRaw(amount: string, decimals: number): BN {
  const [whole, frac = ""] = String(amount).trim().split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  const digits = ((whole || "0") + fracPadded).replace(/^0+(?=\d)/, "");
  return new BN(digits || "0");
}

// raw integer (string|BN) -> human decimal string at the given token decimals.
// String math only — no float drift. `dp` optionally caps fractional digits.
export function fromRaw(raw: string | BN, decimals: number, dp?: number): string {
  const neg = BN.isBN(raw) ? raw.isNeg() : String(raw).trim().startsWith("-");
  const digits = (BN.isBN(raw) ? raw.abs().toString() : String(raw).trim().replace(/^-/, ""))
    .replace(/^0+(?=\d)/, "");
  const padded = digits.padStart(decimals + 1, "0");
  const whole = padded.slice(0, padded.length - decimals);
  let frac = decimals > 0 ? padded.slice(padded.length - decimals) : "";
  if (dp != null) frac = frac.slice(0, dp);
  frac = frac.replace(/0+$/, ""); // trim trailing zeros
  return (neg ? "-" : "") + (frac ? `${whole}.${frac}` : whole);
}
