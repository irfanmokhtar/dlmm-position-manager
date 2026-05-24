import BN from "bn.js";

// human decimal string -> raw integer BN at the given token decimals
export function toRaw(amount: string, decimals: number): BN {
  const [whole, frac = ""] = String(amount).trim().split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  const digits = ((whole || "0") + fracPadded).replace(/^0+(?=\d)/, "");
  return new BN(digits || "0");
}
