import type { FeatureRow } from "./types"

export type Tone = "success" | "warning" | "error" | "neutral"

/** The colour a Feature's bar, border and chip take. */
export function rowTone(row: FeatureRow): Tone {
  if (row.delivered) return row.onTime ? "success" : "error"
  if (row.status === "on-track") return "success"
  if (row.status === "at-risk") return "warning"
  if (row.status === "off-track") return "error"
  return "neutral"
}

/** An in-flight Feature in trouble — the andon a reviewer scans for. Delivered
 *  Features drop their Status, so they are never in trouble. */
export function trouble(row: FeatureRow): "at-risk" | "off-track" | null {
  if (row.delivered) return null
  return row.status === "at-risk" || row.status === "off-track" ? row.status : null
}

/** The Feature's state in words, as its chip reads. */
export function stateWord(row: FeatureRow): string {
  if (row.delivered) return row.onTime ? "delivered on time" : "delivered late"
  return row.status ? row.status.replace("-", " ") : "in flight"
}
