import { describe, it, expect } from "vitest"
import { tutorialPlans } from "./tutorial"
import { parseMacroplan } from "../model/parse"
import { buildPlan } from "../model/plan"

const TODAY = "2026-11-27" // a Friday: lessons anchor on Monday 2026-11-23
const build = (src: string) => buildPlan(parseMacroplan(src), TODAY)
const row = (src: string, name: string) => build(src).rows.find((r) => r.name === name)!
const lessons = tutorialPlans(TODAY)

describe("tutorial lessons", () => {
  it("are six plans that all parse and build, each with its own title", () => {
    expect(lessons).toHaveLength(6)
    const titles = lessons.map((src) => build(src).title)
    expect(new Set(titles).size).toBe(6)
  })

  it("lesson 1 has one Feature still before its Original Estimate", () => {
    const plan = build(lessons[0])
    expect(plan.rows).toHaveLength(1)
    expect(plan.rows[0].markers.map((m) => m.kind)).toEqual(["original"])
    expect(plan.nowInRange).toBe(true)
  })

  it("lesson 2 shows one on-time and one late delivery", () => {
    expect(row(lessons[1], "Auth").onTime).toBe(true)
    expect(row(lessons[1], "Payments").onTime).toBe(false)
    expect(row(lessons[1], "Payments").slipCount).toBe(2)
  })

  it("lesson 3 has an overdue off-track Feature forecast this week, at-risk and on-track ones", () => {
    const dashboard = row(lessons[2], "Dashboard")
    expect(dashboard.status).toBe("off-track")
    expect(dashboard.forecastWeek).toBe("2026-11-23")
    expect(row(lessons[2], "Search").status).toBe("at-risk")
    expect(row(lessons[2], "Notifications").status).toBe("on-track")
  })

  it("lesson 3's Try really fails until the countermeasure goes", () => {
    const offTrack = lessons[2].replace('status = "at-risk"', 'status = "off-track"')
    expect(() => parseMacroplan(offTrack)).toThrow(/countermeasure/)
    const fixed = offTrack.replace(/^countermeasure = .*\n/m, "")
    expect(row(fixed, "Search").status).toBe("off-track")
  })

  it("lesson 4's late child pushes the rest of the chain into a Forecast", () => {
    expect(row(lessons[3], "Checkout flow").childCount).toBe(3)
    expect(row(lessons[3], "Vendor contract").onTime).toBe(false)
    expect(row(lessons[3], "Integration").forecastWeek).toBeDefined()
    expect(row(lessons[3], "Rollout").forecastWeek).toBeDefined()
  })

  it("lesson 5 groups into Areas and draws two Milestones", () => {
    const plan = build(lessons[4])
    expect(plan.bands.map((b) => b.area)).toEqual([undefined, "Platform", "Product"])
    expect(plan.milestones.map((m) => m.name)).toEqual(["MVP go-live", "Beta launch"])
    expect(row(lessons[4], "Rollout").area).toBe("Product")
  })

  it("lesson 6 is an empty plan ready to write", () => {
    expect(build(lessons[5]).rows).toHaveLength(0)
  })
})
