// Client-side fetch helpers. Safe to import from "use client" components.

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || res.statusText);
  return json as T;
}

export interface TxStepResult {
  index: number;
  ok: boolean;
  signature?: string;
  logs?: string[];
  error?: string;
}

export interface PreviewResult {
  txCount: number;
  ok: boolean;
  logs?: string[];
  unitsConsumed?: number;
  error?: string;
}

export interface ActionResponse {
  dryRun: boolean;
  ok?: boolean;
  positionPubKey?: string;
  preview?: PreviewResult;
  results?: TxStepResult[];
  note?: string;
  summary?: Record<string, number>;
}
