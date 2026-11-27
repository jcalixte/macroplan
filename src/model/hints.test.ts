import { describe, it, expect } from "vitest"
import { longTextHints, ONE_LINE } from "./hints"
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
