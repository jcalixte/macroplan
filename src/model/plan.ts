import { mondayOf, weekRange, type WeekId } from "./week"
import type { RawPlan, RawFeature, Plan, FeatureRow, Marker, MilestoneLine, Band } from "./types"

/**
 * Derive the render-ready Plan from the raw model (component C2).
 *
 * On-time vs. late is judged ONLY against the Original Estimate, never a
 * Re-estimate (ADR-0001). The full slip history (`◯` + every `△`) is preserved.
 */
export function buildPlan(raw: RawPlan, today: Date | string = new Date()): Plan {
  const nowWeek = mondayOf(today)
  const { rows, bands } = groupIntoBands(raw.features.map((f) => buildRow(f, nowWeek)))

  const milestones = raw.milestones.map((m): MilestoneLine => {
    const week = mondayOf(m.week)
    const unmet = m.requires.filter((name) => {
      const row = rows.find((r) => r.name === name)
      if (!row) return true // references an unknown Feature → can't be met
      const delivery = row.markers.find(
        (x) => x.kind === "delivered-on-time" || x.kind === "delivered-late",
      )
      return !delivery || delivery.week > week // undelivered, or delivered after the milestone
    })
    return { name: m.name, week, requires: m.requires, unmet }
  })

  // Range: earliest start to last marker/milestone (CONTEXT.md). Empty weeks drawn.
  // Optional authored `start`/`end` widen this span with lead-in / trailing weeks;
  // they only ever extend it — a Feature or marker outside them is never clipped.
  const allWeeks: WeekId[] = []
  if (raw.start != null) allWeeks.push(mondayOf(raw.start))
  if (raw.end != null) allWeeks.push(mondayOf(raw.end))
  for (const r of rows) {
    allWeeks.push(r.startWeek, r.barEndWeek)
    for (const mk of r.markers) allWeeks.push(mk.week)
  }
  for (const m of milestones) allWeeks.push(m.week)

  let weeks: WeekId[] = []
  if (allWeeks.length) {
    const start = allWeeks.reduce((a, b) => (a < b ? a : b))
    const end = allWeeks.reduce((a, b) => (a > b ? a : b))
    weeks = weekRange(start, end)
  }
  const nowInRange = weeks.length > 0 && nowWeek >= weeks[0] && nowWeek <= weeks[weeks.length - 1]

  return { title: raw.title, weeks, rows, bands, milestones, nowWeek, nowInRange }
}

function buildRow(f: RawFeature, nowWeek: WeekId): FeatureRow {
  const startWeek = mondayOf(f.start)
  const originalWeek = mondayOf(f.original)
  const deliveredWeek = f.delivered ? mondayOf(f.delivered) : undefined
  const delivered = deliveredWeek != null
  // ADR-0001: compare the Delivery week to the Original Estimate week only.
  const onTime = delivered ? deliveredWeek! <= originalWeek : null

  const markers: Marker[] = []
  for (const re of f.reestimates) markers.push({ week: mondayOf(re), kind: "reestimate" })
  if (delivered) {
    markers.push({ week: deliveredWeek!, kind: onTime ? "delivered-on-time" : "delivered-late" })
  }
  // The Original Estimate `◯` stands unless an on-time/early delivery already
  // occupies (or precedes) it — then the delivery marker speaks for it.
  if (!(delivered && onTime)) {
    markers.push({ week: originalWeek, kind: "original" })
  }

  const intrinsicEnd = [startWeek, ...markers.map((m) => m.week)].reduce((a, b) => (a > b ? a : b))
  // A delivered Feature's bar ends at its delivery. An undelivered Feature that
  // is already past its furthest estimate keeps "running" up to now (overdue),
  // so its bar extends to the now week; otherwise it ends at the last marker.
  const barEndWeek = delivered || intrinsicEnd > nowWeek ? intrinsicEnd : nowWeek

  return {
    name: f.name,
    startWeek,
    barEndWeek,
    markers,
    delivered,
    onTime,
    status: f.status,
    note: f.note,
    learning: f.learning,
    slipCount: f.reestimates.length,
    area: f.area,
  }
}

/** The key two spellings of one Area share. Area names match case-insensitively
 *  (already trimmed at parse), so "training" and "Training" are one band. */
function areaKey(area: string | undefined): string | undefined {
  return area?.toLowerCase()
}

/**
 * Regroup rows into contiguous Area bands (F8).
 *
 * Bands follow the order the Areas first appear; rows keep their authored order
 * within a band; ungrouped rows form a single unlabelled band placed first. A
 * plan with no Areas is the degenerate case — one band spanning every row, in
 * the original order, so nothing moves.
 *
 * A band is labelled with the FIRST spelling seen for its Area, so the grid
 * never shows a capitalization the author didn't type.
 */
function groupIntoBands(rows: FeatureRow[]): { rows: FeatureRow[]; bands: Band[] } {
  const order: (string | undefined)[] = [undefined]
  const grouped = new Map<string | undefined, FeatureRow[]>([[undefined, []]])
  const label = new Map<string | undefined, string | undefined>()

  for (const row of rows) {
    const key = areaKey(row.area)
    let bucket = grouped.get(key)
    if (!bucket) {
      bucket = []
      grouped.set(key, bucket)
      order.push(key)
      label.set(key, row.area)
    }
    bucket.push(row)
  }

  const out: FeatureRow[] = []
  const bands: Band[] = []
  for (const key of order) {
    const bucket = grouped.get(key)!
    if (!bucket.length) continue // no ungrouped Features → no leading band
    bands.push({ area: label.get(key), start: out.length, span: bucket.length })
    out.push(...bucket)
  }
  return { rows: out, bands }
}
