import { describe, it, expect } from "vitest"
import { parseMacroplan, PlanParseError } from "./parse"
import { buildPlan, troubleBelow, visibleRows } from "./plan"
import type { FeatureRow, Plan } from "./types"

const TODAY = "2026-06-17" // week of Mon 2026-06-15

const build = (source: string): Plan => buildPlan(parseMacroplan(source), TODAY)
const row = (plan: Plan, name: string): FeatureRow => {
  const r = plan.rows.find((x) => x.name === name)
  if (!r) throw new Error(`no row ${name}`)
  return r
}
const marks = (r: FeatureRow) => r.markers.map((m) => `${m.kind}@${m.week}`).sort()

// Payments → Vendor contract (2 weeks, anchored 06-01) → Integration (3 weeks).
// Planned: Vendor contract 06-01…06-08, Integration 06-15…06-29.
const payments = (vendor = "", integration = "", parent = "") =>
  `[[feature]]\nname = "Payments"\n${parent}\n` +
  `[[feature]]\nname = "Vendor contract"\nparent = "Payments"\nstart = 2026-06-01\nweeks = 2\n${vendor}\n` +
  `[[feature]]\nname = "Integration"\nparent = "Payments"\nweeks = 3\n${integration}\n`

describe("F9 — a parent is derived from its children", () => {
  it("chains planned Durations: each child starts the Week after its predecessor's Original Estimate", () => {
    const plan = build(payments())
    expect(marks(row(plan, "Vendor contract"))).toEqual(["original@2026-06-08"])
    expect(row(plan, "Integration").startWeek).toBe("2026-06-15")
    expect(marks(row(plan, "Integration"))).toEqual(["original@2026-06-29"])
  })

  it("derives the parent's start and Original Estimate from the chain", () => {
    const p = row(build(payments()), "Payments")
    expect(p.startWeek).toBe("2026-06-01")
    expect(marks(p)).toEqual(["original@2026-06-29"])
    expect(p.childCount).toBe(2)
  })

  it("orders rows parent-first, depth-first, with depth and parent set", () => {
    const plan = build(payments())
    expect(plan.rows.map((r) => [r.name, r.depth, r.parent ?? null])).toEqual([
      ["Payments", 0, null],
      ["Vendor contract", 1, "Payments"],
      ["Integration", 1, "Payments"],
    ])
  })

  it("delivers the parent only when every child is, judged against the derived ◯", () => {
    const onTime = row(
      build(payments("delivered = 2026-06-08", "delivered = 2026-06-29")),
      "Payments",
    )
    expect(marks(onTime)).toEqual(["delivered-on-time@2026-06-29"])
    const late = row(
      build(payments("delivered = 2026-06-08", "delivered = 2026-07-06")),
      "Payments",
    )
    expect(late.onTime).toBe(false)
    expect(marks(late)).toEqual(["delivered-late@2026-07-06", "original@2026-06-29"])
    const open = row(build(payments("delivered = 2026-06-08")), "Payments")
    expect(open.delivered).toBe(false)
  })

  it("derives a parent in the middle of a chain from its own children", () => {
    const plan = build(
      `[[feature]]\nname = "Checkout"\n` +
        `[[feature]]\nname = "Discovery"\nparent = "Checkout"\nstart = 2026-06-01\nweeks = 2\n` +
        `[[feature]]\nname = "Payments"\nparent = "Checkout"\n` +
        `[[feature]]\nname = "Vendor contract"\nparent = "Payments"\nweeks = 2\n` +
        `[[feature]]\nname = "Integration"\nparent = "Payments"\nweeks = 3\n`,
    )
    expect(plan.rows.map((r) => `${r.name}:${r.depth}`)).toEqual([
      "Checkout:0",
      "Discovery:1",
      "Payments:1",
      "Vendor contract:2",
      "Integration:2",
    ])
    expect(row(plan, "Vendor contract").startWeek).toBe("2026-06-15")
    expect(row(plan, "Payments").startWeek).toBe("2026-06-15")
    expect(marks(row(plan, "Payments"))).toEqual(["original@2026-07-13"])
    expect(marks(row(plan, "Checkout"))).toEqual(["original@2026-07-13"])
  })

  it("lets a Milestone require a parent: met only by the parent's derived Delivery", () => {
    const ms = `[[milestone]]\nname = "Launch"\nweek = 2026-07-06\nrequires = ["Payments", "Vendor contract"]\n`
    expect(build(payments("delivered = 2026-06-08") + ms).milestones[0].unmet).toEqual(["Payments"])
    expect(
      build(payments("delivered = 2026-06-08", "delivered = 2026-06-29") + ms).milestones[0].unmet,
    ).toEqual([])
  })

  it("moves a tree as one into its root's Area band", () => {
    const plan = build(
      `[[feature]]\nname = "Loose"\nstart = 2026-06-01\noriginal = 2026-06-08\narea = "Product"\n` +
        payments("", "", 'area = "Platform"'),
    )
    expect(plan.rows.map((r) => r.name)).toEqual([
      "Loose",
      "Payments",
      "Vendor contract",
      "Integration",
    ])
    expect(plan.bands).toEqual([
      { area: "Product", start: 0, span: 1 },
      { area: "Platform", start: 1, span: 3 },
    ])
  })
})

describe("F10 — slips carry along the chain as a Forecast", () => {
  it("a late child pushes the next one: ◌ after its unmoved ◯, bar dashed from ◯ to ◌", () => {
    const plan = build(payments("delivered = 2026-06-15"))
    const integration = row(plan, "Integration")
    expect(integration.startWeek).toBe("2026-06-22")
    expect(marks(integration)).toEqual(["forecast@2026-07-06", "original@2026-06-29"])
    expect(integration.committedEndWeek).toBe("2026-06-29")
    expect(integration.forecastWeek).toBe("2026-07-06")
  })

  it("carries the slip up to the parent, which never shows a △", () => {
    const p = row(build(payments("delivered = 2026-06-15")), "Payments")
    expect(marks(p)).toEqual(["forecast@2026-07-06", "original@2026-06-29"])
    expect(p.slipCount).toBe(0)
  })

  it("an early Delivery pulls the chain earlier — ◌ before ◯, nothing dashed", () => {
    const integration = row(build(payments("delivered = 2026-06-01")), "Integration")
    expect(integration.startWeek).toBe("2026-06-08")
    expect(marks(integration)).toEqual(["forecast@2026-06-22", "original@2026-06-29"])
    expect(integration.forecastWeek).toBeUndefined()
  })

  it("draws no ◌ for a chain on plan", () => {
    const plan = build(payments())
    expect(plan.rows.flatMap((r) => r.markers).some((m) => m.kind === "forecast")).toBe(false)
  })

  it("a re-estimated Duration lands its △ from the real start, so it moves with the chain", () => {
    const integration = row(
      build(payments("delivered = 2026-06-15", "reestimate_weeks = [4]")),
      "Integration",
    )
    // real start 06-22 + 4 weeks → lands 07-13; the △ is the latest estimate, so no ◌.
    expect(marks(integration)).toEqual(["original@2026-06-29", "reestimate@2026-07-13"])
    expect(integration.slipCount).toBe(1)
  })

  it("flags a child delivered before its predecessor, and keeps the parent open", () => {
    const plan = build(payments("", "delivered = 2026-06-22"))
    expect(row(plan, "Integration").outOfOrder).toBe(true)
    expect(row(plan, "Vendor contract").outOfOrder).toBe(false)
    expect(row(plan, "Payments").delivered).toBe(false)
  })
})

describe("F11 — visibleRows folds parents", () => {
  const plan = build(
    `[[feature]]\nname = "Loose"\nstart = 2026-06-01\noriginal = 2026-06-08\n` +
      payments("", "", 'area = "Platform"') +
      `[[feature]]\nname = "Ops"\nstart = 2026-06-01\noriginal = 2026-06-08\narea = "Platform"\n`,
  )

  it("shows only top-level rows when nothing is expanded, recounting band spans", () => {
    const v = visibleRows(plan, new Set())
    expect(v.rows.map((r) => r.name)).toEqual(["Loose", "Payments", "Ops"])
    expect(v.bands).toEqual([
      { area: undefined, start: 0, span: 1 },
      { area: "Platform", start: 1, span: 2 },
    ])
  })

  it("unfolds an expanded parent's children beneath it", () => {
    const v = visibleRows(plan, new Set(["Payments"]))
    expect(v.rows.map((r) => r.name)).toEqual([
      "Loose",
      "Payments",
      "Vendor contract",
      "Integration",
      "Ops",
    ])
    expect(v.bands[1]).toEqual({ area: "Platform", start: 1, span: 4 })
  })

  it("keeps a grandchild hidden while its own parent is folded", () => {
    const nested = build(
      `[[feature]]\nname = "Checkout"\n` +
        `[[feature]]\nname = "Discovery"\nparent = "Checkout"\nstart = 2026-06-01\nweeks = 2\n` +
        `[[feature]]\nname = "Payments"\nparent = "Checkout"\n` +
        `[[feature]]\nname = "Vendor contract"\nparent = "Payments"\nweeks = 2\n`,
    )
    expect(visibleRows(nested, new Set(["Checkout"])).rows.map((r) => r.name)).toEqual([
      "Checkout",
      "Discovery",
      "Payments",
    ])
  })

  it("folding never changes the week axis", () => {
    expect(plan.weeks[0]).toBe("2026-06-01")
    expect(plan.weeks.at(-1)).toBe("2026-06-29")
  })
})

describe("troubleBelow — a parent's descendants in trouble", () => {
  const tree = (a: string, b: string, c = "") =>
    build(
      `[[feature]]\nname = "Checkout"\n` +
        `[[feature]]\nname = "Discovery"\nparent = "Checkout"\nstart = 2026-06-01\nweeks = 2\n${a}\n` +
        `[[feature]]\nname = "Payments"\nparent = "Checkout"\n` +
        `[[feature]]\nname = "Vendor contract"\nparent = "Payments"\nweeks = 2\n${b}\n` +
        `[[feature]]\nname = "Ops"\nstart = 2026-06-01\noriginal = 2026-06-08\n${c}\n`,
    )
  const offTrack = 'status = "off-track"'
  const atRisk = 'status = "at-risk"\ncountermeasure = "Fix it"'

  it("reports the worst Status and the count, at every ancestor", () => {
    const t = troubleBelow(tree(atRisk, offTrack).rows)
    expect(t.get("Checkout")).toEqual({ level: "off-track", count: 2 })
    expect(t.get("Payments")).toEqual({ level: "off-track", count: 1 })
  })

  it("leaves out a parent whose descendants are all fine, and every leaf", () => {
    const t = troubleBelow(tree('status = "on-track"', "", offTrack).rows)
    expect(t.size).toBe(0)
  })

  it("ignores a parent's own Status — only its descendants count", () => {
    const plan = build(
      `[[feature]]\nname = "Payments"\nstatus = "off-track"\n` +
        `[[feature]]\nname = "Vendor contract"\nparent = "Payments"\nstart = 2026-06-01\nweeks = 2\n`,
    )
    expect(troubleBelow(plan.rows).size).toBe(0)
  })
})

describe("F12 — malformed nesting is rejected with a message naming the fix", () => {
  const top = `[[feature]]\nname = "P"\n`
  const kid = (name: string, extra: string) =>
    `[[feature]]\nname = "${name}"\nparent = "P"\n${extra}\n`
  const anchor = kid("A", "start = 2026-06-01\nweeks = 2")
  const rejects = (source: string, message: RegExp) => {
    expect(() => parseMacroplan(source)).toThrow(PlanParseError)
    expect(() => parseMacroplan(source)).toThrow(message)
  }

  it("accepts a well-formed tree", () => {
    expect(() => parseMacroplan(top + anchor + kid("B", "weeks = 1"))).not.toThrow()
  })
  it("a parent that names no feature", () =>
    rejects(
      top + kid("A", "start = 2026-06-01\nweeks = 1").replace('"P"\nstart', '"Nope"\nstart'),
      /names no feature/,
    ))
  it("a feature naming itself", () => rejects(`[[feature]]\nname = "S"\nparent = "S"\n`, /itself/))
  it("a cycle", () =>
    rejects(
      `[[feature]]\nname = "X"\nparent = "Y"\n[[feature]]\nname = "Y"\nparent = "X"\n`,
      /cycle/,
    ))
  it("a date authored on a parent", () =>
    rejects(`[[feature]]\nname = "P"\noriginal = 2026-06-08\n` + anchor, /`original` is derived/))
  it("`reestimates` on a parent", () =>
    rejects(
      `[[feature]]\nname = "P"\nreestimates = [2026-06-08]\n` + anchor,
      /re-estimate a child/,
    ))
  it("`original` on a child", () =>
    rejects(top + kid("A", "start = 2026-06-01\noriginal = 2026-06-08"), /use `weeks`/))
  it("`reestimates` on a child", () =>
    rejects(
      top + kid("A", "start = 2026-06-01\nweeks = 1\nreestimates = [2026-06-15]"),
      /use `reestimate_weeks`/,
    ))
  it("a child without `weeks`", () =>
    rejects(top + kid("A", "start = 2026-06-01"), /missing `weeks`/))
  it("an anchor without `start`", () => rejects(top + kid("A", "weeks = 2"), /anchors it/))
  it("`start` on a later child", () =>
    rejects(top + anchor + kid("B", "start = 2026-06-15\nweeks = 1"), /only the first Feature/))
  it("`area` on a child", () =>
    rejects(top + kid("A", 'start = 2026-06-01\nweeks = 1\narea = "X"'), /parent's Area/))
  it("weeks below one", () =>
    rejects(top + kid("A", "start = 2026-06-01\nweeks = 0"), /at least 1/))
  it("non-increasing reestimate_weeks", () =>
    rejects(top + kid("A", "start = 2026-06-01\nweeks = 3\nreestimate_weeks = [3]"), /longer than/))
  it("`weeks` on a top-level feature", () =>
    rejects(
      `[[feature]]\nname = "T"\nstart = 2026-06-01\noriginal = 2026-06-08\nweeks = 2\n`,
      /top-level Feature uses `original`/,
    ))
  it("a declared version 1 that uses `parent`", () =>
    rejects(`macroplan_version = 1\n` + top + anchor, /macroplan_version = 2/))
  it("accepts version 2, or no version, with `parent`", () => {
    expect(() => parseMacroplan(`macroplan_version = 2\n` + top + anchor)).not.toThrow()
    expect(() => parseMacroplan(top + anchor)).not.toThrow()
  })
})
