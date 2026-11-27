import { describe, it, expect } from "vitest"
import { parseMacroplan } from "./parse"
import { buildPlan } from "./plan"
import { featureFacts } from "./facts"
import { SAMPLE_PLAN } from "../data/sample"

const plan = buildPlan(parseMacroplan(SAMPLE_PLAN), "2026-06-17")
const facts = (name: string) => featureFacts(plan, name)!

describe("featureFacts — everything a reader needs about one Feature", () => {
  it("returns undefined for a name not in the plan", () => {
    expect(featureFacts(plan, "Nope")).toBeUndefined()
  })

  it("lists the timeline in week order, start first", () => {
    expect(facts("Payments").timeline).toEqual([
      { kind: "start", label: "Start", week: "2026-06-01" },
      { kind: "original", label: "Original estimate", week: "2026-06-15" },
      { kind: "reestimate", label: "Re-estimate 1", week: "2026-06-29" },
      { kind: "reestimate", label: "Re-estimate 2", week: "2026-07-13" },
      { kind: "delivered-late", label: "Delivered late", week: "2026-07-20" },
    ])
  })

  it("names the Original Estimate while the Feature is in flight", () => {
    expect(facts("Search").timeline.map((t) => t.label)).toEqual([
      "Start",
      "Original estimate",
      "Re-estimate 1",
    ])
  })

  it("names the Milestones that require it, and whether each is met", () => {
    expect(facts("Auth").milestones).toEqual([
      { name: "Code freeze", week: "2026-06-29", met: true },
      { name: "MVP go-live", week: "2026-07-06", met: true },
    ])
    expect(facts("Dashboard").milestones).toEqual([
      { name: "MVP go-live", week: "2026-07-06", met: false },
    ])
  })

  it("carries the row's text and Area", () => {
    const f = facts("Search")
    expect(f.row.area).toBe("Product")
    expect(f.row.problem).toBe("Third-party search API is flaky.")
    expect(f.row.countermeasure).toBe("Spike a fallback on the in-house index.")
  })

  it("counts trouble below a parent, and none for a leaf", () => {
    const nested = buildPlan(
      parseMacroplan(`
title = "N"
[[feature]]
name = "Epic"
[[feature]]
name = "A"
parent = "Epic"
start = 2026-06-01
weeks = 2
status = "off-track"
[[feature]]
name = "B"
parent = "Epic"
weeks = 1
status = "at-risk"
countermeasure = "Pair on it."
`),
      "2026-06-03",
    )
    expect(featureFacts(nested, "Epic")!.troubleBelow).toEqual({ level: "off-track", count: 2 })
    expect(featureFacts(nested, "A")!.troubleBelow).toBeUndefined()
  })
})
