import type { ShippingIntent } from "./types";

/** Explicit, admin-maintained mapping of Shopify shipping line titles/codes → intent. Raw is always preserved. */
export interface ShippingMethodMapping { match: string; matchOn: "title" | "code"; intent: Exclude<ShippingIntent, "UNKNOWN"> }

export function mapShippingIntent(lines: { title: string | null; code: string | null }[], mappings: ShippingMethodMapping[]):
  { intent: ShippingIntent; raw: string | null } {
  const raw = lines.map(l => [l.title, l.code].filter(Boolean).join(" / ")).join(" | ") || null;
  if (lines.length === 0) return { intent: "UNKNOWN", raw };
  const intents = new Set<ShippingIntent>();
  for (const l of lines) {
    const m = mappings.find(m => (m.matchOn === "title" ? l.title : l.code)?.trim().toLowerCase() === m.match.trim().toLowerCase());
    intents.add(m ? m.intent : "UNKNOWN");
  }
  return { intent: intents.size === 1 ? [...intents][0]! : "UNKNOWN", raw };
}
