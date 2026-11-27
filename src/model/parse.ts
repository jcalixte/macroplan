import * as v from "valibot"
import { parse as parseToml } from "smol-toml"
import { toYmd } from "./week"
import type { RawFeature, RawPlan, StatusLevel } from "./types"

/** Thrown for any malformed source — message is safe to show the author. */
export class PlanParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PlanParseError"
  }
}

const STATUSES = ["on-track", "at-risk", "off-track"] as const satisfies readonly StatusLevel[]

// ── Field schemas ──────────────────────────────────────────────────────────
// A TOML date (smol-toml returns a Date subclass) or a yyyy-mm-dd string,
// normalized to yyyy-mm-dd via `toYmd`.
const Ymd = v.pipe(
  v.union([v.date(), v.string()], "must be a date (e.g. 2026-06-01)"),
  v.transform((value: string | Date) => toYmd(value)),
)

const Status = v.picklist(STATUSES, `must be one of ${STATUSES.join(", ")}`)

const Name = v.pipe(v.string("is required"), v.nonEmpty("is required"))

// An Area name. Surrounding whitespace is invisible in the source, so it is
// trimmed before the emptiness check — `area = " "` is as empty as `area = ""`.
const Area = v.pipe(
  v.string("must be a string"),
  v.transform((a: string) => a.trim()),
  v.nonEmpty("must not be empty — omit the key for an ungrouped Feature"),
)

// A Duration: a whole number of Weeks, at least one.
const Weeks = v.pipe(
  v.number("must be a whole number of weeks"),
  v.integer("must be a whole number of weeks"),
  v.minValue(1, "must be at least 1 week"),
)

// Which of these keys a block may carry depends on its place in the tree —
// that is checked after every block is read, by `validateNesting`.
const FeatureSchema = v.object({
  name: Name,
  start: v.optional(Ymd),
  original: v.optional(Ymd),
  reestimates: v.optional(v.array(Ymd, "must be a list of dates"), []),
  parent: v.optional(v.pipe(v.string("must be a feature name"), v.nonEmpty("must not be empty"))),
  weeks: v.optional(Weeks),
  reestimate_weeks: v.optional(v.array(Weeks, "must be a list of whole numbers of weeks"), []),
  delivered: v.optional(Ymd),
  learning: v.optional(v.string()),
  status: v.optional(Status),
  note: v.optional(v.string()),
  area: v.optional(Area),
})

const MilestoneSchema = v.object({
  name: Name,
  week: Ymd,
  requires: v.optional(
    v.array(v.string("must be a feature name"), "must be a list of feature names"),
    [],
  ),
})

/** The Macroplan format version this build understands (see docs/format.md).
 *  Files may declare `macroplan_version`; a newer version is rejected rather
 *  than silently mis-rendered against a schema we don't know. */
export const FORMAT_VERSION = 2

/** Parse + validate a Macroplan TOML source into the raw model. */
export function parseMacroplan(source: string): RawPlan {
  let data: Record<string, unknown>
  try {
    data = parseToml(source) as Record<string, unknown>
  } catch (e) {
    throw new PlanParseError(e instanceof Error ? e.message : String(e))
  }

  const version = checkVersion(data.macroplan_version)

  const features = asBlocks(data.feature, "feature").map((f, i) => {
    const { reestimate_weeks, ...rest } = check(FeatureSchema, f, blockWhere("feature", f, i))
    return { ...rest, reestimateWeeks: reestimate_weeks }
  })
  requireUniqueFeatureNames(features)
  validateNesting(features, version)

  return {
    title: data.title != null ? String(data.title) : "Untitled Macroplan",
    start: data.start != null ? check(Ymd, data.start, "plan", "start") : undefined,
    end: data.end != null ? check(Ymd, data.end, "plan", "end") : undefined,
    features,
    milestones: asBlocks(data.milestone, "milestone").map((m, i) =>
      check(MilestoneSchema, m, blockWhere("milestone", m, i)),
    ),
  }
}

/** Validate the optional `macroplan_version` marker. Absent means the current
 *  version; a future version we don't understand is rejected rather than
 *  silently mis-rendered. */
function checkVersion(value: unknown): number | undefined {
  if (value == null) return undefined
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new PlanParseError("`macroplan_version` must be a positive integer")
  }
  if (value > FORMAT_VERSION) {
    throw new PlanParseError(
      `unsupported macroplan_version ${value} — this build understands up to ${FORMAT_VERSION}`,
    )
  }
  return value
}

/**
 * Enforce the positional rules of nested Features (F12, ADR-0004). A child
 * names its parent; siblings chain in file order. Every message names the key
 * to use instead, because a flat `parent` key trades structural safety for
 * references that can dangle — the messages are the price of that trade.
 */
function validateNesting(features: readonly RawFeature[], version: number | undefined): void {
  const byName = new Map(features.map((f) => [f.name, f]))
  const childCount = new Map<string, number>()
  const nested = features.some((f) => f.parent != null)

  if (nested && version === 1) {
    throw new PlanParseError(
      "`parent` needs macroplan_version = 2 — raise the version or remove the marker",
    )
  }

  for (const f of features) {
    if (f.parent == null) continue
    const where = `feature "${f.name}"`
    if (f.parent === f.name)
      throw new PlanParseError(`${where}: \`parent\` names the feature itself`)
    if (!byName.has(f.parent)) {
      throw new PlanParseError(`${where}: \`parent\` "${f.parent}" names no feature`)
    }
    childCount.set(f.parent, (childCount.get(f.parent) ?? 0) + 1)
  }

  // Walk each Feature up to its root; meeting a name twice is a cycle.
  const rootOf = new Map<string, string>()
  for (const f of features) {
    const seen = new Set<string>()
    let node = f
    while (node.parent != null) {
      if (seen.has(node.name)) {
        throw new PlanParseError(
          `feature "${f.name}": \`parent\` forms a cycle (${[...seen].join(" → ")} → ${node.name})`,
        )
      }
      seen.add(node.name)
      node = byName.get(node.parent)!
    }
    rootOf.set(f.name, node.name)
  }

  // The anchor of each top-level parent's chain: its first leaf in reading order.
  const anchorOf = new Map<string, string>()
  const firstLeaf = (name: string): string => {
    const first = features.find((c) => c.parent === name)
    return first ? firstLeaf(first.name) : name
  }
  for (const f of features) {
    if (f.parent == null && childCount.has(f.name)) anchorOf.set(f.name, firstLeaf(f.name))
  }

  for (const f of features) {
    const where = `feature "${f.name}"`
    const fail = (msg: string) => {
      throw new PlanParseError(`${where}: ${msg}`)
    }
    const isParent = childCount.has(f.name)
    const isChild = f.parent != null

    if (isParent) {
      for (const key of ["start", "original", "delivered", "weeks"] as const) {
        if (f[key] != null) fail(`\`${key}\` is derived from its children — remove it`)
      }
      if (f.reestimates.length) {
        fail("`reestimates` is derived from its children — re-estimate a child instead")
      }
      if (f.reestimateWeeks.length) {
        fail("`reestimate_weeks` is derived from its children — re-estimate a child instead")
      }
    }

    if (isChild) {
      if (f.area != null) fail("a child Feature sits in its parent's Area — remove `area`")
      if (!isParent) {
        if (f.original != null)
          fail("a child Feature plans its Duration — use `weeks`, not `original`")
        if (f.reestimates.length) {
          fail(
            "a child Feature re-estimates its Duration — use `reestimate_weeks`, not `reestimates`",
          )
        }
        if (f.weeks == null) fail("missing `weeks` — a child Feature plans its Duration")
        const root = rootOf.get(f.name)!
        const isAnchor = anchorOf.get(root) === f.name
        if (isAnchor && f.start == null) {
          fail(`missing \`start\` — the first Feature of the chain under "${root}" anchors it`)
        }
        if (!isAnchor && f.start != null) {
          fail(`only the first Feature of the chain under "${root}" sets \`start\` — remove it`)
        }
        let previous = f.weeks!
        for (const w of f.reestimateWeeks) {
          if (w <= previous) {
            fail(
              "each `reestimate_weeks` value must be longer than the one before — a Re-estimate is a slip",
            )
          }
          previous = w
        }
      }
    } else if (!isParent) {
      if (f.weeks != null)
        fail("`weeks` is for a child Feature — a top-level Feature uses `original`")
      if (f.reestimateWeeks.length) {
        fail("`reestimate_weeks` is for a child Feature — a top-level Feature uses `reestimates`")
      }
      if (f.start == null) fail("missing `start`")
      if (f.original == null) fail("missing `original`")
    }
  }
}

/** Feature names are the join key for a Milestone's `requires`, so they must be
 *  unique — otherwise a requirement resolves ambiguously to the first match. */
function requireUniqueFeatureNames(features: readonly { name: string }[]): void {
  const seen = new Set<string>()
  for (const f of features) {
    if (seen.has(f.name)) {
      throw new PlanParseError(`duplicate feature name "${f.name}" — feature names must be unique`)
    }
    seen.add(f.name)
  }
}

function asBlocks(value: unknown, key: string): unknown[] {
  if (value == null) return []
  if (!Array.isArray(value)) {
    throw new PlanParseError(`\`${key}\` must be written as [[${key}]] blocks`)
  }
  return value
}

/** "feature \"Payments\"" when the block carries a name, else "feature #2". */
function blockWhere(kind: string, block: unknown, i: number): string {
  const name =
    block != null && typeof block === "object" && "name" in block
      ? (block as { name: unknown }).name
      : undefined
  return name != null && name !== "" ? `${kind} "${String(name)}"` : `${kind} #${i + 1}`
}

/** Validate `value` against `schema`, raising a contextual PlanParseError. */
function check<S extends v.GenericSchema>(
  schema: S,
  value: unknown,
  where: string,
  field?: string,
): v.InferOutput<S> {
  const result = v.safeParse(schema, value)
  if (!result.success) {
    throw new PlanParseError(`${where}: ${friendly(result.issues[0], field)}`)
  }
  return result.output
}

type Issue = {
  readonly message: string
  readonly received: string
  readonly path?: ReadonlyArray<{ readonly key: unknown }>
}

/** Render an issue against the offending field, e.g. "`start` must be a date"
 *  — or "missing `original`" when the key is absent (valibot reports its own
 *  "Invalid key" wording for that, which isn't fit to show the author). */
function friendly(issue: Issue, fallbackField?: string): string {
  const key = issue.path?.[0]?.key
  const field = typeof key === "string" ? key : fallbackField
  if (issue.received === "undefined") return field ? `missing \`${field}\`` : "missing value"
  return field ? `\`${field}\` ${issue.message}` : issue.message
}
