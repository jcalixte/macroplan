import type { MarkerKind } from "../model/types"

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
