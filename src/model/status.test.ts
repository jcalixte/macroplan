import { describe, it, expect } from "vitest"
import { parseMacroplan } from "./parse"
import { buildPlan } from "./plan"
import { rowTone, stateWord, trouble } from "./status"
import { SAMPLE_PLAN } from "../data/sample"

const plan = buildPlan(parseMacroplan(SAMPLE_PLAN), "2026-06-17")
const row = (name: string) => plan.rows.find((r) => r.name === name)!

describe("a Feature's state, as every view reads it", () => {
  it.each([
    ["Auth", "success", "delivered on time", null],
    ["Payments", "error", "delivered late", null],
    ["Dashboard", "error", "off track", "off-track"],
    ["Search", "warning", "at risk", "at-risk"],
    ["Notifications", "success", "on track", null],
  ])("%s → %s, “%s”, trouble %s", (name, tone, word, t) => {
    expect(rowTone(row(name))).toBe(tone)
    expect(stateWord(row(name))).toBe(word)
    expect(trouble(row(name))).toBe(t)
  })

  it("reads a Feature with no Status as in flight, in the neutral tone", () => {
    const r = { ...row("Notifications"), status: undefined }
    expect(rowTone(r)).toBe("neutral")
    expect(stateWord(r)).toBe("in flight")
  })
})
