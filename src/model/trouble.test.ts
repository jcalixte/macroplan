import { describe, it, expect } from "vitest"
import { parseMacroplan } from "./parse"
import { buildPlan } from "./plan"

// An in-flight top-level Feature with the given extra keys.
const feature = (keys: string, name = "A") =>
  `[[feature]]\nname = "${name}"\nstart = 2026-06-01\noriginal = 2026-06-08\n${keys}\n`

const parsed = (source: string) => parseMacroplan(source).features[0]

describe("Problem and Countermeasure (v3)", () => {
  it("reads both texts on an at-risk Feature", () => {
    const f = parsed(
      feature('status = "at-risk"\nproblem = "API is flaky"\ncountermeasure = "Spike a fallback"'),
    )
    expect(f.problem).toBe("API is flaky")
    expect(f.countermeasure).toBe("Spike a fallback")
  })

  it("lets an at-risk Feature leave its Problem unstated", () => {
    expect(() =>
      parseMacroplan(feature('status = "at-risk"\ncountermeasure = "Spike a fallback"')),
    ).not.toThrow()
  })

  it("rejects an at-risk Feature without a Countermeasure — that is off-track", () => {
    expect(() => parseMacroplan(feature('status = "at-risk"\nproblem = "API is flaky"'))).toThrow(
      /at-risk Feature needs a `countermeasure`/,
    )
  })

  it("lets an off-track Feature state its Problem", () => {
    expect(parsed(feature('status = "off-track"\nproblem = "No owner"')).problem).toBe("No owner")
  })

  it("rejects an off-track Feature with a Countermeasure — that is at-risk", () => {
    expect(() =>
      parseMacroplan(feature('status = "off-track"\ncountermeasure = "Find an owner"')),
    ).toThrow(/off-track Feature has no Countermeasure/)
  })

  it("rejects a Problem or Countermeasure on an on-track Feature", () => {
    expect(() => parseMacroplan(feature('status = "on-track"\nproblem = "Slow"'))).toThrow(
      /`problem` needs `status` at-risk or off-track/,
    )
    expect(() => parseMacroplan(feature('status = "on-track"\ncountermeasure = "Push"'))).toThrow(
      /`countermeasure` needs `status = "at-risk"`/,
    )
  })

  it("rejects a Problem on a Feature with no Status", () => {
    expect(() => parseMacroplan(feature('problem = "Slow"'))).toThrow(/`problem` needs `status`/)
  })

  it("rejects empty texts", () => {
    expect(() => parseMacroplan(feature('status = "at-risk"\ncountermeasure = "  "'))).toThrow(
      /`countermeasure` must not be empty/,
    )
  })

  it("ignores the texts on a delivered Feature, whatever its Status", () => {
    expect(() =>
      parseMacroplan(feature('delivered = 2026-06-08\nstatus = "at-risk"\nproblem = "Was flaky"')),
    ).not.toThrow()
    expect(() =>
      parseMacroplan(feature('delivered = 2026-06-08\nstatus = "on-track"\ncountermeasure = "x"')),
    ).not.toThrow()
  })

  it("ignores them on a parent once every child is delivered", () => {
    const source =
      `[[feature]]\nname = "P"\nstatus = "at-risk"\nproblem = "Was slow"\n` +
      `[[feature]]\nname = "C"\nparent = "P"\nstart = 2026-06-01\nweeks = 1\ndelivered = 2026-06-01\n`
    expect(() => parseMacroplan(source)).not.toThrow()
  })

  it("still checks a parent while a child is open", () => {
    const source =
      `[[feature]]\nname = "P"\nstatus = "at-risk"\n` +
      `[[feature]]\nname = "C"\nparent = "P"\nstart = 2026-06-01\nweeks = 1\n`
    expect(() => parseMacroplan(source)).toThrow(/feature "P": an at-risk Feature needs/)
  })

  it("rejects `note`, naming both ways out", () => {
    expect(() => parseMacroplan(feature('status = "off-track"\nnote = "No owner"'))).toThrow(
      /`note` was replaced.*`problem`.*macroplan_version = 2/,
    )
  })

  it("carries the texts onto the rendered row", () => {
    const plan = buildPlan(
      parseMacroplan(
        feature(
          'status = "at-risk"\nproblem = "API is flaky"\ncountermeasure = "Spike a fallback"',
        ),
      ),
      "2026-06-03",
    )
    expect(plan.rows[0]).toMatchObject({
      problem: "API is flaky",
      countermeasure: "Spike a fallback",
    })
  })
})

describe("files declaring version 1 or 2", () => {
  for (const version of [1, 2]) {
    it(`v${version}: reads \`note\` as the Problem`, () => {
      const f = parsed(
        `macroplan_version = ${version}\n` + feature('status = "off-track"\nnote = "No owner"'),
      )
      expect(f.problem).toBe("No owner")
      expect(f.countermeasure).toBeUndefined()
    })

    it(`v${version}: accepts an at-risk Feature without a Countermeasure`, () => {
      const source =
        `macroplan_version = ${version}\n` + feature('status = "at-risk"\nnote = "Vendor slip"')
      expect(() => parseMacroplan(source)).not.toThrow()
    })

    it(`v${version}: keeps a note on an on-track Feature as its Problem`, () => {
      const source =
        `macroplan_version = ${version}\n` + feature('status = "on-track"\nnote = "Legal is slow"')
      expect(parsed(source).problem).toBe("Legal is slow")
    })

    it(`v${version}: rejects \`problem\` and \`countermeasure\`, which need v3`, () => {
      expect(() =>
        parseMacroplan(`macroplan_version = ${version}\n` + feature('problem = "x"')),
      ).toThrow(/`problem` needs macroplan_version = 3/)
      expect(() =>
        parseMacroplan(`macroplan_version = ${version}\n` + feature('countermeasure = "x"')),
      ).toThrow(/`countermeasure` needs macroplan_version = 3/)
    })
  }
})
