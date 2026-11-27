import type { Plan } from "./types"
import { FORMAT_VERSION } from "./parse"

/** An A3 Problem or Countermeasure is one line. Past this, the grid cell clamps
 *  it and the reader has to open the popover to finish the sentence. */
export const ONE_LINE = 80

const FIELDS = ["problem", "countermeasure", "learning"] as const

/** Non-blocking advice on a plan that parses: never stops it from rendering. */
export function longTextHints(plan: Plan): string[] {
  const hints: string[] = []
  for (const row of plan.rows) {
    for (const field of FIELDS) {
      const length = row[field]?.length ?? 0
      if (length > ONE_LINE) {
        hints.push(`${row.name}: \`${field}\` is ${length} characters, keep it within ${ONE_LINE}`)
      }
    }
  }
  return hints
}

/** Say which format version the plan is read as, when the file doesn't pin the
 *  latest: an absent marker silently means the current version, and an older
 *  one switches off what came after it. */
export function versionHint(declared: number | undefined): string | null {
  if (declared == null) {
    return `Read as macroplan_version ${FORMAT_VERSION} (latest): no version declared, add \`macroplan_version = ${FORMAT_VERSION}\` to pin it`
  }
  if (declared < FORMAT_VERSION) {
    return `Read as macroplan_version ${declared}: the latest is ${FORMAT_VERSION}`
  }
  return null
}
