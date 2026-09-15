// @vitest-environment happy-dom
import { describe, it, expect } from "vitest"
import { mount } from "@vue/test-utils"
import MacroplanGrid from "./MacroplanGrid.vue"
import { parseMacroplan } from "../model/parse"
import { buildPlan } from "../model/plan"
import { SAMPLE_PLAN } from "../data/sample"

const plan = buildPlan(parseMacroplan(SAMPLE_PLAN), "2026-06-17")

function mountGrid() {
  return mount(MacroplanGrid, { props: { plan } })
}

describe("MacroplanGrid renders the sample plan", () => {
  it("renders one row per feature, in order", () => {
    const names = mountGrid()
      .findAll(".namecell")
      .map((n) => n.text())
    expect(names).toEqual(["Auth", "Payments", "Dashboard", "Search", "Notifications"])
  })

  it("renders the right markers per feature", () => {
    const rows = mountGrid().findAll(".namecell")
    // each feature row is namecell + week cells + learncell; grab the row text via the grid
    const grid = mountGrid()
    const text = grid.text()
    expect(rows).toHaveLength(5)
    // on-time, late, and slip glyphs all present somewhere in the grid
    expect(text).toContain("◉") // Auth delivered on time
    expect(text).toContain("▲") // Payments delivered late
    expect(text).toContain("△") // re-estimates
    expect(text).toContain("◯") // open original estimates
  })

  it("draws a now column and the milestone header", () => {
    const w = mountGrid()
    expect(w.find(".col-now").exists()).toBe(true)
    expect(w.text()).toContain("now")
    expect(w.text()).toContain("MVP go-live")
  })

  it("shows a learning for a delivered feature and a status note for an in-flight one", () => {
    const text = mountGrid().text()
    expect(text).toContain("Vendor lead time") // Payments learning
    expect(text).toContain("No recovery plan yet") // Dashboard status note
  })

  it("labels week columns", () => {
    expect(mountGrid().text()).toContain("Jun 15")
  })
})

describe("F8 — Area gutter", () => {
  const feat = (name: string, area?: string) =>
    `[[feature]]\nname = "${name}"\nstart = 2026-06-01\noriginal = 2026-06-15\n` +
    (area ? `area = ${JSON.stringify(area)}\n` : "")

  const grid = (source: string) =>
    mount(MacroplanGrid, { props: { plan: buildPlan(parseMacroplan(source), "2026-06-17") } })

  const grouped = () => grid(feat("Deck", "Training") + feat("Loose") + feat("Email", "Comms"))

  it("draws one gutter cell per band, labelled and spanning its Features", () => {
    const cells = grouped().findAll(".areacell")
    expect(cells.map((c) => c.text())).toEqual(["", "Training", "Comms"])
    expect(cells.map((c) => c.attributes("style"))).toEqual([
      expect.stringContaining("grid-row: 2 / span 1"), // ungrouped, leading
      expect.stringContaining("grid-row: 3 / span 1"),
      expect.stringContaining("grid-row: 4 / span 1"),
    ])
  })

  it("adds no rows — the grid still has exactly one namecell per Feature", () => {
    expect(grouped().findAll(".namecell")).toHaveLength(3)
  })

  it("collapses the gutter to zero width when nothing is grouped", () => {
    const plain = grid(feat("A") + feat("B"))
    expect(plain.find(".macroplan").attributes("style")).toContain("--area-w: 0rem")
    expect(plain.findAll(".areacell")).toHaveLength(1) // one unlabelled band
    expect(plain.find(".areacell").text()).toBe("")
  })

  it("opens the gutter to 2rem as soon as one Feature has an Area", () => {
    expect(grouped().find(".macroplan").attributes("style")).toContain("--area-w: 2rem")
  })

  it("keeps a milestone flag on its own week once a gutter is present (F6 × F8)", () => {
    const ms = `[[milestone]]\nname = "Go-live"\nweek = 2026-06-15\n`
    const withArea = grid(feat("A", "Training") + ms)
    const without = grid(feat("A") + ms)
    // Same week → same grid column in both; only the gutter's width differs.
    const col = (w: ReturnType<typeof grid>) => w.find(".ms-flag").attributes("style")
    expect(col(withArea)).toEqual(col(without))
    expect(col(withArea)).toContain("grid-column: 5") // gutter, name, then 3 weeks in
  })

  it("bands the default sample plan into Platform and Product", () => {
    const cells = mountGrid().findAll(".areacell")
    expect(cells.map((c) => c.text())).toEqual(["Platform", "Product"])
    expect(cells.map((c) => c.attributes("style"))).toEqual([
      expect.stringContaining("grid-row: 2 / span 2"),
      expect.stringContaining("grid-row: 4 / span 3"),
    ])
  })

  it("truncates a long label with a tooltip rather than overflowing a 1-row band", () => {
    const label = grid(feat("A", "Change management")).find(".arealabel")
    expect(label.attributes("title")).toBe("Change management")
  })
})
