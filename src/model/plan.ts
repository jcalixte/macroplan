import { addWeeks, mondayOf, weekRange, type WeekId } from "./week"
import type {
  RawPlan,
  RawFeature,
  Plan,
  FeatureRow,
  Marker,
  MilestoneLine,
  Band,
  Break,
} from "./types"

/**
 * Derive the render-ready Plan from the raw model (component C2).
 *
 * On-time vs. late is judged ONLY against the Original Estimate, never a
 * Re-estimate (ADR-0001). The full slip history (`◯` + every `△`) is preserved.
 */
export function buildPlan(raw: RawPlan, today: Date | string = new Date()): Plan {
  const nowWeek = mondayOf(today)
  const children = new Map<string, RawFeature[]>()
  for (const f of raw.features) {
    if (f.parent == null) continue
    const siblings = children.get(f.parent) ?? []
    siblings.push(f)
    children.set(f.parent, siblings)
  }
  const trees = raw.features
    .filter((f) => f.parent == null)
    .map((root) => buildTree(root, children, nowWeek))
  const { rows, bands } = groupIntoBands(trees)

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

  // Drawn only: a Break moves no date and never widens the span.
  const breaks = raw.breaks.map(
    (u): Break => ({
      name: u.name,
      from: mondayOf(u.from),
      to: mondayOf(u.to ?? u.from),
    }),
  )

  // Range: earliest start to last marker/milestone (CONTEXT.md). Empty weeks drawn.
  // Optional authored `start`/`end` widen this span with lead-in / trailing weeks;
  // they only ever extend it — a Feature or marker outside them is never clipped.
  // Folded rows still count, so folding never shifts the week axis.
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
    weeks = weekRange(allWeeks.reduce(earliest), allWeeks.reduce(latest))
  }
  const nowInRange = weeks.length > 0 && nowWeek >= weeks[0] && nowWeek <= weeks[weeks.length - 1]

  return { title: raw.title, weeks, rows, bands, milestones, breaks, nowWeek, nowInRange }
}

const earliest = (a: WeekId, b: WeekId) => (a < b ? a : b)
const latest = (a: WeekId, b: WeekId) => (a > b ? a : b)

/** Where a Feature sits in the tree — carried onto its row as authored context. */
interface Place {
  depth: number
  parent?: string
  childCount: number
  area?: string
}

/**
 * One top-level Feature and its subtree, as rows in pre-order (F9, F10).
 *
 * A top-level leaf is authored with dates. A tree is authored with Durations,
 * anchored on its first leaf, and derived twice. A later leaf with its own
 * `start` is unlinked: the chain restarts from it.
 *  - the planned chain fixes every Feature's Original Estimate from the anchor
 *    and the planned `weeks`; it never moves (ADR-0001 at every link);
 *  - the real chain starts each leaf the Week after the latest week any earlier
 *    leaf occupies — its Delivery, or its Forecast while open — so a slip, or an
 *    early Delivery, carries down the chain and up to every parent.
 * A parent's dates are only ever derived from its children.
 */
function buildTree(
  root: RawFeature,
  children: ReadonlyMap<string, RawFeature[]>,
  nowWeek: WeekId,
): FeatureRow[] {
  const area = root.area
  if (!children.has(root.name)) {
    const originalWeek = mondayOf(root.original!)
    const reestimates = root.reestimates.map((r) => mondayOf(r))
    const deliveredWeek = root.delivered ? mondayOf(root.delivered) : undefined
    // No chain to forecast from: it lands at its latest estimate, or this week once overdue.
    const forecast =
      deliveredWeek == null ? [originalWeek, ...reestimates, nowWeek].reduce(latest) : undefined
    return [
      finishRow(
        root,
        {
          startWeek: mondayOf(root.start!),
          originalWeek,
          reestimates,
          deliveredWeek,
          forecast,
          outOfOrder: false,
        },
        { depth: 0, childCount: 0, area },
        nowWeek,
      ),
    ]
  }

  const kidsOf = (f: RawFeature) => children.get(f.name) ?? []
  const firstLeaf = (f: RawFeature): RawFeature => {
    const kids = kidsOf(f)
    return kids.length ? firstLeaf(kids[0]) : f
  }
  const anchor = mondayOf(firstLeaf(root).start!)

  // Planned chain: each Feature's Original Estimate, from Durations alone. A
  // leaf with its own `start` is unlinked from its predecessor and re-anchors it.
  const plannedEnd = new Map<string, WeekId>()
  const plan = (f: RawFeature, after: WeekId): WeekId => {
    const kids = kidsOf(f)
    const start = !kids.length && f.start != null ? mondayOf(f.start) : after
    let end = addWeeks(start, (f.weeks ?? 1) - 1)
    if (kids.length) {
      let next = start
      const ends: WeekId[] = []
      for (const k of kids) {
        ends.push(plan(k, next))
        next = addWeeks(ends.at(-1)!, 1)
      }
      end = ends.reduce(latest) // an unlinked child may end before its predecessor
    }
    plannedEnd.set(f.name, end)
    return end
  }
  plan(root, anchor)

  // Real chain, walked leaf by leaf in reading order.
  let chainEnd: WeekId | undefined // the latest week any earlier leaf occupies
  let earlierOpen = false // an earlier leaf is still undelivered
  let earlierDelivered: WeekId | undefined // the latest Delivery among earlier leaves

  interface Built {
    rows: FeatureRow[]
    end: WeekId // Delivery, or Forecast while open
  }
  const walk = (f: RawFeature, depth: number): Built => {
    const kids = kidsOf(f)
    const place: Place = { depth, parent: f.parent, childCount: kids.length, area }

    if (!kids.length) {
      if (f.start != null) {
        // Unlinked: nothing before it in the chain pushes it or puts it out of order.
        chainEnd = undefined
        earlierOpen = false
        earlierDelivered = undefined
      }
      const startWeek =
        f.start != null ? mondayOf(f.start) : chainEnd == null ? anchor : addWeeks(chainEnd, 1)
      const deliveredWeek = f.delivered ? mondayOf(f.delivered) : undefined
      const duration = f.reestimateWeeks.at(-1) ?? f.weeks!
      // An open leaf can't land in the past: once overdue, it lands this week at the earliest.
      const planned = addWeeks(startWeek, duration - 1)
      const forecast = deliveredWeek == null ? latest(planned, nowWeek) : planned
      const outOfOrder =
        deliveredWeek != null &&
        (earlierOpen || (earlierDelivered != null && earlierDelivered > deliveredWeek))
      const row = finishRow(
        f,
        {
          startWeek,
          originalWeek: plannedEnd.get(f.name)!,
          reestimates: f.reestimateWeeks.map((w) => addWeeks(startWeek, w - 1)),
          deliveredWeek,
          forecast,
          outOfOrder,
        },
        place,
        nowWeek,
      )
      const end = deliveredWeek ?? forecast
      chainEnd = chainEnd == null ? end : latest(chainEnd, end)
      if (deliveredWeek == null) earlierOpen = true
      else
        earlierDelivered =
          earlierDelivered == null ? deliveredWeek : latest(earlierDelivered, deliveredWeek)
      return { rows: [row], end }
    }

    const built = kids.map((k) => walk(k, depth + 1))
    const kidRows = built.map((b) => b.rows[0])
    const allDelivered = kidRows.every((r) => r.delivered)
    const deliveredWeek = allDelivered
      ? kidRows.map((r) => deliveryOf(r)!).reduce(latest)
      : undefined
    const end = built.map((b) => b.end).reduce(latest)
    const row = finishRow(
      f,
      {
        startWeek: kidRows.map((r) => r.startWeek).reduce(earliest),
        originalWeek: plannedEnd.get(f.name)!,
        reestimates: [], // a parent never records a decision — its children's slips are its Forecast
        deliveredWeek,
        forecast: end,
        outOfOrder: false,
      },
      place,
      nowWeek,
    )
    return { rows: [row, ...built.flatMap((b) => b.rows)], end }
  }

  return walk(root, 0).rows
}

function deliveryOf(row: FeatureRow): WeekId | undefined {
  return row.markers.find((m) => m.kind === "delivered-on-time" || m.kind === "delivered-late")
    ?.week
}

interface Timing {
  startWeek: WeekId
  originalWeek: WeekId
  reestimates: WeekId[]
  deliveredWeek?: WeekId
  forecast?: WeekId // undefined once delivered
  outOfOrder: boolean
}

function finishRow(f: RawFeature, t: Timing, place: Place, nowWeek: WeekId): FeatureRow {
  const { startWeek, originalWeek, deliveredWeek } = t
  const delivered = deliveredWeek != null
  // ADR-0001: compare the Delivery week to the Original Estimate week only.
  const onTime = delivered ? deliveredWeek <= originalWeek : null

  const markers: Marker[] = []
  for (const week of t.reestimates) markers.push({ week, kind: "reestimate" })
  if (delivered) {
    markers.push({ week: deliveredWeek, kind: onTime ? "delivered-on-time" : "delivered-late" })
  }
  // The Original Estimate `◯` stands unless an on-time/early delivery already
  // occupies (or precedes) it — then the delivery marker speaks for it.
  if (!(delivered && onTime)) {
    markers.push({ week: originalWeek, kind: "original" })
  }

  // A Forecast is drawn only while open, and only when the chain has moved it
  // off the latest estimate — a chain on plan looks exactly as it did before.
  const latestEstimate = [originalWeek, ...t.reestimates].reduce(latest)
  let forecastWeek: WeekId | undefined
  let committedEndWeek: WeekId | undefined
  if (!delivered && t.forecast != null && t.forecast !== latestEstimate) {
    markers.push({ week: t.forecast, kind: "forecast" })
    if (t.forecast > latestEstimate) {
      forecastWeek = t.forecast
      committedEndWeek = latestEstimate
    }
  }

  const intrinsicEnd = [startWeek, ...markers.map((m) => m.week)].reduce(latest)
  // A delivered Feature's bar ends at its delivery. An undelivered Feature that
  // is already past its furthest estimate (or Forecast) keeps "running" up to
  // now (overdue), so its bar extends to the now week; otherwise it ends at the
  // last marker.
  const barEndWeek = delivered || intrinsicEnd > nowWeek ? intrinsicEnd : nowWeek

  return {
    name: f.name,
    startWeek,
    barEndWeek,
    markers,
    delivered,
    onTime,
    status: f.status,
    problem: f.problem,
    countermeasure: f.countermeasure,
    learning: f.learning,
    slipCount: t.reestimates.length,
    area: place.area,
    depth: place.depth,
    parent: place.parent,
    childCount: place.childCount,
    forecastWeek,
    committedEndWeek,
    outOfOrder: t.outOfOrder,
  }
}

/** The key two spellings of one Area share. Area names match case-insensitively
 *  (already trimmed at parse), so "training" and "Training" are one band. */
function areaKey(area: string | undefined): string | undefined {
  return area?.toLowerCase()
}

/**
 * Regroup top-level trees into contiguous Area bands (F8).
 *
 * Bands follow the order the Areas first appear; rows keep their authored order
 * within a band; ungrouped rows form a single unlabelled band placed first. A
 * plan with no Areas is the degenerate case — one band spanning every row, in
 * the original order, so nothing moves.
 *
 * A band is labelled with the FIRST spelling seen for its Area, so the grid
 * never shows a capitalization the author didn't type.
 */
function groupIntoBands(trees: FeatureRow[][]): { rows: FeatureRow[]; bands: Band[] } {
  const order: (string | undefined)[] = [undefined]
  const grouped = new Map<string | undefined, FeatureRow[]>([[undefined, []]])
  const label = new Map<string | undefined, string | undefined>()

  // A tree moves as one: its root's Area places it, and its subtree follows.
  for (const tree of trees) {
    const area = tree[0].area
    const key = areaKey(area)
    let bucket = grouped.get(key)
    if (!bucket) {
      bucket = []
      grouped.set(key, bucket)
      order.push(key)
      label.set(key, area)
    }
    bucket.push(...tree)
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

/**
 * The rows and bands actually drawn for a fold state (F11): every row whose
 * ancestors are all expanded. Band spans are recounted over what is shown —
 * the Area gutter spans grid rows, so a span over hidden rows would misalign
 * every band below a folded parent.
 */
export function visibleRows(
  plan: Pick<Plan, "rows" | "bands">,
  expanded: ReadonlySet<string>,
): { rows: FeatureRow[]; bands: Band[] } {
  const rows: FeatureRow[] = []
  const bands: Band[] = []
  for (const band of plan.bands) {
    const start = rows.length
    let hiddenBelow = Infinity // depth under which rows are folded away
    for (const row of plan.rows.slice(band.start, band.start + band.span)) {
      if (row.depth > hiddenBelow) continue
      hiddenBelow = Infinity
      rows.push(row)
      if (row.childCount > 0 && !expanded.has(row.name)) hiddenBelow = row.depth
    }
    bands.push({ area: band.area, start, span: rows.length - start })
  }
  return { rows, bands }
}

export interface TroubleBelow {
  level: "at-risk" | "off-track" // the worst Status among the descendants
  count: number // descendants in trouble
}

/**
 * For each parent, its in-flight descendants that are at-risk or off-track.
 * Status never rolls up (a parent's own Status is authored), so this is only a
 * pointer: a folded parent uses it to say trouble is hidden beneath it.
 * Rows come parent-first, depth-first, so a row's descendants are the rows
 * right after it that sit deeper.
 */
export function troubleBelow(rows: readonly FeatureRow[]): Map<string, TroubleBelow> {
  const out = new Map<string, TroubleBelow>()
  rows.forEach((row, i) => {
    if (row.childCount === 0) return
    let count = 0
    let offTrack = false
    for (let j = i + 1; j < rows.length && rows[j].depth > row.depth; j++) {
      const d = rows[j]
      if (d.delivered || (d.status !== "at-risk" && d.status !== "off-track")) continue
      count++
      if (d.status === "off-track") offTrack = true
    }
    if (count > 0) out.set(row.name, { level: offTrack ? "off-track" : "at-risk", count })
  })
  return out
}

export interface PlanTally {
  features: number
  onTime: number
  late: number
  onTrack: number
  atRisk: number
  offTrack: number
  inFlight: number // undelivered, no Status authored
  milestones: number
  unmetMilestones: number
}

/** The plan's state in one line. Leaves only: a parent's dates and Delivery
 *  derive from its children, so counting it too would double-count the work. */
export function tallyPlan(plan: Pick<Plan, "rows" | "milestones">): PlanTally {
  const t: PlanTally = {
    features: 0,
    onTime: 0,
    late: 0,
    onTrack: 0,
    atRisk: 0,
    offTrack: 0,
    inFlight: 0,
    milestones: plan.milestones.length,
    unmetMilestones: plan.milestones.filter((m) => m.unmet.length > 0).length,
  }
  for (const r of plan.rows) {
    if (r.childCount > 0) continue
    t.features++
    if (r.delivered && r.onTime) t.onTime++
    else if (r.delivered) t.late++
    else if (r.status === "on-track") t.onTrack++
    else if (r.status === "at-risk") t.atRisk++
    else if (r.status === "off-track") t.offTrack++
    else t.inFlight++
  }
  return t
}
