import type { FeatureRow, MarkerKind, Plan } from "./types"
import type { WeekId } from "./week"
import { troubleBelow, type TroubleBelow } from "./plan"

export interface TimelineFact {
  kind: "start" | MarkerKind
  label: string
  week: WeekId
}

export interface MilestoneFact {
  name: string
  week: WeekId
  met: boolean
}

/** One Feature, gathered for reading in one place: what the grid spreads over
 *  a row, a hover title and a far-right column. */
export interface FeatureFacts {
  row: FeatureRow
  timeline: TimelineFact[]
  milestones: MilestoneFact[]
  troubleBelow?: TroubleBelow
}

const LABEL: Record<MarkerKind, string> = {
  original: "Original estimate",
  reestimate: "Re-estimate",
  "delivered-on-time": "Delivered on time",
  "delivered-late": "Delivered late",
  forecast: "Forecast",
}

export function featureFacts(plan: Plan, name: string): FeatureFacts | undefined {
  const row = plan.rows.find((r) => r.name === name)
  if (!row) return undefined

  let n = 0
  const marks = [...row.markers]
    .sort((a, b) => (a.week < b.week ? -1 : a.week > b.week ? 1 : 0))
    .map((m) => ({
      kind: m.kind,
      label: m.kind === "reestimate" ? `${LABEL.reestimate} ${++n}` : LABEL[m.kind],
      week: m.week,
    }))

  return {
    row,
    timeline: [{ kind: "start", label: "Start", week: row.startWeek }, ...marks],
    milestones: plan.milestones
      .filter((m) => m.requires.includes(name))
      .map((m) => ({ name: m.name, week: m.week, met: !m.unmet.includes(name) })),
    troubleBelow: troubleBelow(plan.rows).get(name),
  }
}
