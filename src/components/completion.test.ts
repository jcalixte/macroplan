import { describe, it, expect } from "vitest"
import { getCompletions } from "./completion"

/** Split a `|`-marked string into (source, caret offset). */
function atCaret(marked: string): [string, number] {
  const caret = marked.indexOf("|")
  return [marked.slice(0, caret) + marked.slice(caret + 1), caret]
}

/** The labels offered at the `|` marker. */
function labelsAt(marked: string): string[] {
  const [source, caret] = atCaret(marked)
  return getCompletions(source, caret)?.items.map((i) => i.label) ?? []
}

describe("completion context", () => {
  it("offers plan keys on an empty top-level line", () => {
    // Headers wait for a blank line above; at the very top there's nothing above.
    expect(labelsAt("|")).toEqual(["title", "start", "end"])
  })

  it("offers feature keys inside a [[feature]] block, no headers on the first line", () => {
    expect(labelsAt("[[feature]]\n|")).toEqual([
      "name",
      "start",
      "original",
      "reestimates",
      "delivered",
      "status",
      "learning",
      "note",
    ])
  })

  it("offers milestone keys inside a [[milestone]] block, no headers on the first line", () => {
    expect(labelsAt("[[milestone]]\n|")).toEqual(["name", "week", "requires"])
  })

  it("keeps offering remaining keys on a single new line, still without headers", () => {
    expect(labelsAt('[[milestone]]\nname = "M"\n|')).toEqual(["week", "requires"])
  })

  it("volunteers block headers only after a blank line (two new lines)", () => {
    const filled = '[[milestone]]\nname = "M"\nweek = 2026-01-01\nrequires = []'
    // Directly under the last property: nothing left to add ⇒ no popup.
    expect(getCompletions(...atCaret(`${filled}\n|`))).toBeNull()
    // A blank line signals a new block is wanted ⇒ offer the headers.
    expect(labelsAt(`${filled}\n\n|`)).toEqual(["[[feature]]", "[[milestone]]"])
  })

  it("volunteers headers after a blank line even with keys still open", () => {
    expect(labelsAt('[[milestone]]\nname = "M"\n\n|')).toEqual([
      "week",
      "requires",
      "[[feature]]",
      "[[milestone]]",
    ])
  })

  it("excludes keys already written in the current block", () => {
    const labels = labelsAt('[[feature]]\nname = "X"\noriginal = 2026-06-01\n|')
    expect(labels).not.toContain("name")
    expect(labels).not.toContain("original")
    expect(labels).toContain("start")
  })

  it("filters keys by the typed prefix", () => {
    expect(labelsAt("[[feature]]\nst|")).toEqual(["start", "status"])
  })

  it("completes a header from a leading bracket", () => {
    expect(labelsAt("[[f|")).toEqual(["[[feature]]"])
  })

  it("suggests status values after status =", () => {
    expect(labelsAt("[[feature]]\nstatus = |")).toEqual(["on-track", "at-risk", "off-track"])
  })

  it("filters status values by the typed prefix, inside an open quote", () => {
    expect(labelsAt('[[feature]]\nstatus = "o|')).toEqual(["on-track", "off-track"])
  })

  it("offers nothing once the status value's quote is closed", () => {
    expect(getCompletions(...atCaret('[[feature]]\nstatus = "on-track"|'))).toBeNull()
  })

  it("suggests feature names inside a milestone requires array", () => {
    const source = '[[feature]]\nname = "Payments"\n\n[[milestone]]\nrequires = ["|'
    expect(labelsAt(source)).toEqual(["Payments"])
  })

  it("does not offer feature names outside a milestone block", () => {
    // `requires` is meaningless at the plan level, so there is nothing to add.
    expect(labelsAt('name = "Payments"\n\n[[feature]]\nrequires = ["|')).toEqual([])
  })

  it("returns nothing in a value position it cannot complete (a date)", () => {
    expect(getCompletions(...atCaret("[[feature]]\nstart = 2026-|"))).toBeNull()
  })
})

describe("date completion", () => {
  const TODAY = "2026-06-19"
  const datesAt = (marked: string) => {
    const [source, caret] = atCaret(marked)
    return getCompletions(source, caret, TODAY)
  }

  it("suggests today then the current-year prefix for an empty date value", () => {
    const ctx = datesAt("[[feature]]\nstart = |")!
    expect(ctx.items.map((i) => i.insert)).toEqual(["2026-06-19", "2026-"])
    expect(ctx.items.map((i) => i.detail)).toEqual(["today", "this year"])
  })

  it("offers the same for plan dates and milestone weeks", () => {
    expect(datesAt("end = |")!.items.map((i) => i.insert)).toEqual(["2026-06-19", "2026-"])
    expect(datesAt("[[milestone]]\nweek = |")!.items.map((i) => i.insert)).toEqual([
      "2026-06-19",
      "2026-",
    ])
  })

  it("inserts at the caret, replacing nothing", () => {
    const [source, caret] = atCaret("[[feature]]\ndelivered = |")
    const ctx = getCompletions(source, caret, TODAY)!
    expect([ctx.from, ctx.to]).toEqual([caret, caret])
  })

  it("offers a date for a fresh element in a reestimates array", () => {
    expect(datesAt("[[feature]]\nreestimates = [|")!.items.map((i) => i.insert)).toEqual([
      "2026-06-19",
      "2026-",
    ])
    expect(
      datesAt("[[feature]]\nreestimates = [2026-01-01, |")!.items.map((i) => i.insert),
    ).toEqual(["2026-06-19", "2026-"])
  })

  it("stays out of the way once a date is being typed", () => {
    expect(datesAt("[[feature]]\nstart = 2|")).toBeNull()
    expect(datesAt("[[feature]]\nstart = 2026-|")).toBeNull()
    expect(datesAt("[[feature]]\nreestimates = [2026-0|")).toBeNull()
  })
})

describe("completion replace range", () => {
  it("replaces the typed prefix, not the whole line", () => {
    const source = "[[feature]]\nst"
    const ctx = getCompletions(source, source.length)!
    expect(source.slice(ctx.from, ctx.to)).toBe("st")
  })

  it("replaces a partial bracketed header from the bracket", () => {
    const source = "[[f"
    const ctx = getCompletions(source, source.length)!
    expect(source.slice(ctx.from, ctx.to)).toBe("[[f")
    expect(ctx.items[0].insert).toBe("[[feature]]")
  })
})

describe("bracket header block separation", () => {
  /** The inserts offered at the `|` marker. */
  const insertsAt = (marked: string) => {
    const caret = marked.indexOf("|")
    const source = marked.slice(0, caret) + marked.slice(caret + 1)
    return getCompletions(source, caret)!.items.map((i) => i.insert)
  }

  it("prepends a blank line when a bare [ glues onto the block above", () => {
    // No blank line above ⇒ accepting must not weld the new block to the old one.
    expect(insertsAt('[[feature]]\nname = "X"\n[|')).toEqual(["\n[[feature]]", "\n[[milestone]]"])
  })

  it("adds no leading newline when a blank line already separates the block", () => {
    expect(insertsAt('[[feature]]\nname = "X"\n\n[|')).toEqual(["[[feature]]", "[[milestone]]"])
  })

  it("adds no leading newline at the very top of the document", () => {
    expect(insertsAt("[|")).toEqual(["[[feature]]", "[[milestone]]"])
  })
})
