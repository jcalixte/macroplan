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

  it("heads the trailing column Status / Problem / Countermeasure", () => {
    expect(mountGrid().find(".learnhead").text()).toBe("Status / Problem / Countermeasure")
  })

  it("labels every trailing cell with a chip saying which kind of text follows", () => {
    const cells = mountGrid().findAll(".learncell")
    const chips = cells.map((c) => c.find(".chip").text())
    // Auth, Payments delivered with a Learning; Dashboard, Search, Notifications in flight
    expect(chips).toEqual(["learned", "learned", "off track", "at risk", "on track"])
    expect(cells[1].text()).toContain("Vendor lead time")
  })

  it("lights up only in-flight Features in trouble: tinted row and filled chip", () => {
    const w = mountGrid()
    const rows = w.findAll(".plan-grid > .row")
    const lit = rows.map((r) => r.classes().find((c) => c.startsWith("row-")) ?? null)
    expect(lit).toEqual([null, null, "row-off-track", "row-at-risk", null])
    const fills = w.findAll(".learncell .chip-fill").map((c) => c.text())
    expect(fills).toEqual(["off track", "at risk"])
  })

  it("reads Problem → Countermeasure on an at-risk Feature", () => {
    const search = mountGrid().findAll(".learncell")[3]
    expect(search.find(".problem").text()).toBe("Third-party search API is flaky.")
    expect(search.find(".countermeasure").text()).toBe("Spike a fallback on the in-house index.")
    const button = search.find("button.celltext")
    const pop = search.find(".cellpop")
    expect(pop.attributes("popover")).toBeDefined()
    expect(button.attributes("popovertarget")).toBe(pop.attributes("id"))
    expect(pop.findAll("dd").map((d) => d.text())).toEqual([
      "Third-party search API is flaky.",
      "Spike a fallback on the in-house index.",
    ])
  })

  it("puts the Countermeasure on its own line, after the Problem, led by the arrow", () => {
    const trouble = mountGrid().findAll(".learncell")[3].find(".trouble")
    const lines = trouble.element.children
    expect(lines).toHaveLength(2)
    expect(lines[0].classList.contains("problem")).toBe(true)
    expect(lines[1].classList.contains("cm-line")).toBe(true)
    expect(trouble.find(".cm-line .arrow").text()).toBe("→")
  })

  it("gives every popover its own id, and a Learning one to delivered Features", () => {
    const w = mountGrid()
    const ids = w.findAll(".cellpop").map((p) => p.attributes("id"))
    expect(new Set(ids).size).toBe(ids.length)
    const payments = w.findAll(".learncell")[1]
    expect(payments.find(".cellpop dt").text()).toBe("Learning")
  })

  it("shows no arrow on an off-track Feature: no Countermeasure", () => {
    const dashboard = mountGrid().findAll(".learncell")[2]
    expect(dashboard.find(".problem").text()).toBe("No owner since the reorg.")
    expect(dashboard.find(".arrow").exists()).toBe(false)
    expect(dashboard.find(".countermeasure").exists()).toBe(false)
    expect(dashboard.findAll(".cellpop dd").map((d) => d.text())).toEqual([
      "No owner since the reorg.",
      "None yet",
    ])
  })

  it("shows no text on an on-track Feature, only its chip", () => {
    const notifications = mountGrid().findAll(".learncell")[4]
    expect(notifications.text()).toBe("on track")
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

describe("MacroplanGrid — nested Features (F10, F11)", () => {
  const nested =
    `[[feature]]\nname = "Ops"\nstart = 2026-06-01\noriginal = 2026-06-08\narea = "Platform"\n` +
    `[[feature]]\nname = "Payments"\narea = "Platform"\n` +
    `[[feature]]\nname = "Vendor contract"\nparent = "Payments"\nstart = 2026-06-01\nweeks = 2\ndelivered = 2026-06-15\n` +
    `[[feature]]\nname = "Integration"\nparent = "Payments"\nweeks = 3\n`
  const nestedPlan = buildPlan(parseMacroplan(nested), "2026-06-17")
  const mountNested = (expanded: string[] = []) =>
    mount(MacroplanGrid, { props: { plan: nestedPlan, expanded: new Set(expanded) } })
  const names = (w: ReturnType<typeof mountNested>) =>
    w.findAll(".namecell .truncate").map((n) => n.text())

  it("shows a parent collapsed by default, with a disclosure and its child count", () => {
    const w = mountNested()
    expect(names(w)).toEqual(["Ops", "Payments"])
    const button = w.find(".disclosure")
    expect(button.attributes("aria-expanded")).toBe("false")
    expect(button.attributes("aria-label")).toBe("Unfold Payments")
    expect(w.find(".childcount").text()).toBe("(2)")
  })

  it("asks to toggle the parent when its disclosure is clicked", async () => {
    const w = mountNested()
    await w.find(".disclosure").trigger("click")
    expect(w.emitted("toggle")).toEqual([["Payments"]])
  })

  it("unfolds children beneath an expanded parent, indented, and respans the gutter", () => {
    const w = mountNested(["Payments"])
    expect(names(w)).toEqual(["Ops", "Payments", "Vendor contract", "Integration"])
    expect(w.findAll(".namecell")[2].attributes("style")).toContain("padding-left: 1.6rem")
    expect(w.find(".areacell").attributes("style")).toContain("grid-row: 2 / span 4")
  })

  it("respans the gutter over only the visible rows when folded", () => {
    expect(mountNested().find(".areacell").attributes("style")).toContain("grid-row: 2 / span 2")
  })

  it("flags a folded parent whose children are in trouble, without lighting its row", () => {
    const troubled = buildPlan(
      parseMacroplan(nested.replace("weeks = 3\n", 'weeks = 3\nstatus = "off-track"\n')),
      "2026-06-17",
    )
    const w = mount(MacroplanGrid, { props: { plan: troubled } })
    const flag = w.find(".namecell .below")
    expect(flag.classes()).toContain("below-off-track")
    expect(flag.attributes("title")).toBe("1 off track below")
    expect(w.findAll(".plan-grid > .row")[1].classes()).not.toContain("row-off-track")
    const open = mount(MacroplanGrid, {
      props: { plan: troubled, expanded: new Set(["Payments"]) },
    })
    expect(open.find(".namecell .below").exists()).toBe(false)
  })

  it("puts no flag on a folded parent whose children are fine", () => {
    expect(mountNested().find(".namecell .below").exists()).toBe(false)
  })

  it("draws the Forecast ◌ and a dashed bar up to it", () => {
    const w = mountNested(["Payments"])
    expect(w.text()).toContain("◌")
    expect(w.findAll(".bar.dashed").length).toBeGreaterThan(0)
  })
})

describe("MacroplanGrid — Breaks", () => {
  const source = `[[feature]]
name = "X"
start = 2026-06-01
original = 2026-06-29

[[break]]
name = "Offsite"
from = 2026-06-15
to = 2026-06-22
`
  const offPlan = buildPlan(parseMacroplan(source), "2026-06-17")
  const w = mount(MacroplanGrid, { props: { plan: offPlan } })

  it("hatches every cell of the Break weeks, header included", () => {
    expect(w.findAll(".hcell.col-off")).toHaveLength(2)
    expect(w.findAll(".cell.col-off")).toHaveLength(2) // one row × two weeks
  })

  it("keeps the now tint on a Break week", () => {
    expect(w.find(".cell.col-now.col-off").exists()).toBe(true)
  })

  it("labels the period once, above its first week, and lists it in the legend", () => {
    const flags = w.findAll(".off-flag")
    expect(flags).toHaveLength(1)
    expect(flags[0].text()).toContain("Offsite")
    expect(w.find(".legend").text()).toContain("break")
  })

  it("shows no legend entry when the plan has no Breaks", () => {
    expect(mountGrid().find(".legend").text()).not.toContain("break")
  })
})
