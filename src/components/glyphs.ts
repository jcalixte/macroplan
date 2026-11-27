import type { FeatureRow, MarkerKind } from "../model/types"
import { rowTone, trouble, type Tone } from "../model/status"

/** The grid's marker vocabulary, shared so every view draws the same symbols. */
export const GLYPH: Record<MarkerKind, string> = {
  original: "◯",
  reestimate: "△",
  "delivered-on-time": "◉",
  "delivered-late": "▲",
  forecast: "◌",
}

export const MARKER_CLASS: Record<MarkerKind, string> = {
  original: "text-base-content/60",
  reestimate: "text-ink-warning",
  "delivered-on-time": "text-ink-success",
  "delivered-late": "text-ink-error",
  forecast: "text-base-content/50", // computed, not committed — drawn muted
}

export const TONE_TEXT: Record<Tone, string> = {
  success: "text-ink-success",
  warning: "text-ink-warning",
  error: "text-ink-error",
  neutral: "text-primary",
}

export const TONE_CHIP: Record<Tone, string> = {
  success: "text-ink-success",
  warning: "text-ink-warning",
  error: "text-ink-error",
  neutral: "text-ink-muted",
}

/** A Feature in trouble fills its chip, the loudest mark it has; any other
 *  chip is outlined in its tone. */
export function chipClass(row: FeatureRow): string {
  const t = trouble(row)
  return t ? `chip-fill chip-${t}` : TONE_CHIP[rowTone(row)]
}
