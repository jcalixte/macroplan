import { describe, it, expect } from "vitest"
import { longTextHints, ONE_LINE, versionHint } from "./hints"
import { FORMAT_VERSION } from "./parse"
import type { FeatureRow, Plan } from "./types"

function planWith(rows: Partial<FeatureRow>[]): Plan {
  return { rows: rows as FeatureRow[] } as Plan
}

describe("longTextHints", () => {
  it("says nothing when every text fits on one line", () => {
    const fits = "x".repeat(ONE_LINE)
    expect(longTextHints(planWith([{ name: "A", problem: fits, countermeasure: fits }]))).toEqual(
      [],
    )
  })

  it("names the Feature, the field and the length of each long text", () => {
    const long = "x".repeat(ONE_LINE + 12)
    expect(
      longTextHints(
        planWith([
          { name: "Search", problem: long },
          { name: "Auth", learning: long },
        ]),
      ),
    ).toEqual([
      "Search: `problem` is 92 characters, keep it within 80",
      "Auth: `learning` is 92 characters, keep it within 80",
    ])
  })
})

describe("versionHint", () => {
  it("says the latest version is served when the file declares none", () => {
    expect(versionHint(undefined)).toBe(
      `Read as macroplan_version ${FORMAT_VERSION} (latest): no version declared, ` +
        `add \`macroplan_version = ${FORMAT_VERSION}\` to pin it`,
    )
  })

  it("names the older version a file pins", () => {
    expect(versionHint(2)).toBe(`Read as macroplan_version 2: the latest is ${FORMAT_VERSION}`)
  })

  it("says nothing when the file pins the latest", () => {
    expect(versionHint(FORMAT_VERSION)).toBeNull()
  })
})
