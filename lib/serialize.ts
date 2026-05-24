// Recursively convert SDK objects (BN, PublicKey, bigint) into JSON-safe values
// so route handlers can return them. BN -> decimal string, PublicKey -> base58.

type Jsonish = unknown;

function isBN(v: unknown): v is { toString(base?: number): string; _bn?: unknown } {
  return (
    typeof v === "object" &&
    v !== null &&
    "toString" in v &&
    // BN instances carry words[] internally
    Array.isArray((v as { words?: unknown }).words)
  );
}

function isPublicKey(v: unknown): v is { toBase58(): string } {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as { toBase58?: unknown }).toBase58 === "function"
  );
}

// decimal.js instances (used by FeeInfo / getDynamicFee).
function isDecimal(v: unknown): v is { toString(): string } {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as { toFixed?: unknown }).toFixed === "function" &&
    typeof (v as { toNumber?: unknown }).toNumber === "function" &&
    !Array.isArray((v as { words?: unknown }).words)
  );
}

export function serialize(value: Jsonish): Jsonish {
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return value.toString();
  if (isBN(value)) return value.toString();
  if (isPublicKey(value)) return value.toBase58();
  if (isDecimal(value)) return value.toString();
  if (Array.isArray(value)) return (value as unknown[]).map(serialize);
  if (typeof value === "object") {
    const out: Record<string, Jsonish> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serialize(v);
    }
    return out;
  }
  return value;
}
