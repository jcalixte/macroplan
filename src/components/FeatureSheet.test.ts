// @vitest-environment happy-dom
import { describe, it, expect } from "vitest"
import { mount } from "@vue/test-utils"
import FeatureSheet from "./FeatureSheet.vue"
import { parseMacroplan } from "../model/parse"
import { buildPlan } from "../model/plan"
import { featureFacts } from "../model/facts"
import { SAMPLE_PLAN } from "../data/sample"

HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.setAttribute("open", "")
}
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  this.removeAttribute("open")
}

const plan = buildPlan(parseMacroplan(SAMPLE_PLAN), "2026-06-17")

function mountSheet(name: string | null) {
  return mount(FeatureSheet, {
    props: { facts: name ? featureFacts(plan, name) : undefined },
    attachTo: document.body,
  })
}

describe("FeatureSheet", () => {
  it("stays closed without a Feature", () => {
    expect(mountSheet(null).find("dialog").attributes("open")).toBeUndefined()
  })

  it("opens on a Feature with its Status, Problem and Countermeasure in full", async () => {
    const w = mountSheet("Search")
    await w.vm.$nextTick()
    expect(w.find("dialog").attributes("open")).toBeDefined()
    const text = w.text()
    expect(text).toContain("Search")
    expect(text).toContain("Product")
    expect(text).toContain("at risk")
    expect(text).toContain("Third-party search API is flaky.")
    expect(text).toContain("Spike a fallback on the in-house index.")
  })

  it("lists the timeline with week labels and the weeks between steps", () => {
    const items = mountSheet("Payments")
      .findAll(".timeline li")
      .map((li) =>
        li
          .findAll("span")
          .map((s) => s.text())
          .filter(Boolean)
          .join(" "),
      )
    expect(items).toEqual([
      "Start Jun 01",
      "+2 wk ◯ Original estimate Jun 15",
      "+2 wk △ Re-estimate 1 Jun 29",
      "+2 wk △ Re-estimate 2 Jul 13",
      "+1 wk ▲ Delivered late Jul 20",
    ])
  })

  it("dashes the leg into a slipped Forecast", () => {
    const late = buildPlan(
      parseMacroplan(`[[feature]]
name = "Billing"
start = 2026-06-01
original = 2026-06-08
`),
      "2026-11-23",
    )
    const w = mount(FeatureSheet, {
      props: { facts: featureFacts(late, "Billing") },
      attachTo: document.body,
    })
    const lis = w.findAll(".timeline li")
    expect(lis.map((li) => li.find(".what").text())).toEqual([
      "Start",
      "Original estimate",
      "Forecast",
    ])
    expect(lis[1].classes()).toContain("leg-dashed")
    expect(lis[0].classes()).not.toContain("leg-dashed")
    expect(lis[2].find("svg.tri-dash").exists()).toBe(true)
    expect(lis[2].find(".gap").text()).toBe("+24 wk")
  })

  it("shows the Learning of a delivered Feature", () => {
    expect(mountSheet("Auth").text()).toContain("Spiking the OAuth flow first paid off")
  })

  it("names the Milestones it holds up", () => {
    const ms = mountSheet("Dashboard").find(".milestones").text()
    expect(ms).toContain("MVP go-live")
    expect(ms).toContain("unmet")
  })

  it("emits close from its close button", async () => {
    const w = mountSheet("Auth")
    await w.find("button.close").trigger("click")
    expect(w.emitted("close")).toHaveLength(1)
  })
})
