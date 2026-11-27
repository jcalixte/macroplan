import type { WeekId } from "./week"

export type StatusLevel = "on-track" | "at-risk" | "off-track"

// ── Raw model: as authored, after TOML parse + validation, before derivation ──

// Which keys a block may carry depends on where it sits in the tree, so the
// date/Duration keys are optional here; `validateNesting` (parse.ts) enforces
// the positional rules:
//   top-level leaf → start + original (+ reestimates)
//   child leaf     → weeks (+ reestimate_weeks); the first leaf under a
//                    top-level parent also carries `start`, the chain's anchor
//   parent         → no dates at all — they are derived from its children
export interface RawFeature {
  name: string
  start?: string // yyyy-mm-dd
  original?: string // yyyy-mm-dd — the Original Estimate
  reestimates: string[] // yyyy-mm-dd[]
  parent?: string // name of the parent Feature; absent → top-level
  weeks?: number // a child's planned Duration, in Weeks (≥ 1)
  reestimateWeeks: number[] // a child's re-estimated Durations, each longer than the last
  delivered?: string // yyyy-mm-dd
  learning?: string
  status?: StatusLevel
  problem?: string // why it is in trouble — at-risk / off-track only (v3; a v1/v2 `note`)
  countermeasure?: string // what brings it back on track — at-risk only (v3)
  area?: string // the Area this Feature belongs to; absent → ungrouped
}

export interface RawMilestone {
  name: string
  week: string // yyyy-mm-dd
  requires: string[] // Feature names
}

/** A run of Weeks the whole team is off (holidays, shutdown, offsite). Drawn
 *  only — it moves no date, Duration or Forecast. */
export interface RawBreak {
  name: string
  from: string // yyyy-mm-dd
  to?: string // yyyy-mm-dd, inclusive; absent → the single week of `from`
}

export interface RawPlan {
  title: string
  version?: number // the declared `macroplan_version`; absent means the current format
  start?: string // yyyy-mm-dd — optional authored left edge of the plan's span
  end?: string // yyyy-mm-dd — optional authored right edge of the plan's span
  features: RawFeature[]
  milestones: RawMilestone[]
  breaks: RawBreak[]
}

// ── Derived model: render-ready (C2 output) ──

export type MarkerKind =
  | "original" // ◯ Original Estimate, not yet delivered
  | "reestimate" // △ a slip to a later week
  | "delivered-on-time" // ◉ delivered on/before the Original Estimate
  | "delivered-late" // ▲ delivered after the Original Estimate
  | "forecast" // ◌ computed: where a slip (or early Delivery) up the chain now puts this Feature

export interface Marker {
  week: WeekId
  kind: MarkerKind
}

export interface FeatureRow {
  name: string
  startWeek: WeekId
  barEndWeek: WeekId
  markers: Marker[]
  delivered: boolean
  onTime: boolean | null // null while in-flight
  status?: StatusLevel
  problem?: string
  countermeasure?: string
  learning?: string
  slipCount: number // number of Re-estimates
  area?: string // as authored on the top-level Feature — children inherit their root's
  depth: number // 0 for a top-level Feature, 1 for its children, …
  parent?: string // the parent Feature's name; absent → top-level
  childCount: number // > 0 makes this a parent row, foldable in the grid
  /** The Forecast, when it lands after the latest estimate: the bar runs
   *  dashed from `committedEndWeek` (exclusive) to here (inclusive). */
  forecastWeek?: WeekId
  committedEndWeek?: WeekId // the latest estimate — `◯`, or the last `△`
  outOfOrder: boolean // delivered while an earlier Feature in its chain was not
}

/** A contiguous run of rows sharing an Area — one labelled band in the grid.
 *  `area` absent marks the leading band of ungrouped Features. */
export interface Band {
  area?: string
  start: number // index into Plan.rows of the band's first row
  span: number // how many rows it covers
}

export interface MilestoneLine {
  name: string
  week: WeekId
  requires: string[]
  unmet: string[] // required Features not delivered on/before this week
}

export interface Break {
  name: string
  from: WeekId
  to: WeekId // inclusive
}

export interface Plan {
  title: string
  weeks: WeekId[]
  rows: FeatureRow[] // grouped: Areas in order of first appearance, ungrouped first; each parent followed by its subtree (pre-order)
  bands: Band[]
  milestones: MilestoneLine[]
  breaks: Break[]
  nowWeek: WeekId
  nowInRange: boolean
}
