// @vitest-environment happy-dom
import { describe, it, expect } from "vitest"
import { matches, chordKeys, ariaChord, fuzzyScore, isTypingTarget } from "./shortcuts"

const ev = (o: Partial<KeyboardEvent>) =>
  ({
    key: "",
    code: "",
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    ...o,
  }) as KeyboardEvent

describe("matches", () => {
  it("maps mod to ⌘ on Apple and Ctrl elsewhere", () => {
    expect(matches(ev({ key: "k", metaKey: true }), { key: "k", mod: true }, true)).toBe(true)
    expect(matches(ev({ key: "k", ctrlKey: true }), { key: "k", mod: true }, true)).toBe(false)
    expect(matches(ev({ key: "k", ctrlKey: true }), { key: "k", mod: true }, false)).toBe(true)
  })

  it("rejects a bare key when a modifier is held", () => {
    expect(matches(ev({ key: "n", ctrlKey: true }), { key: "n" }, false)).toBe(false)
    expect(matches(ev({ key: "n", altKey: true }), { key: "n" }, false)).toBe(false)
  })

  it("matches the physical key when a code is given (Alt+1 types ¡ on a Mac)", () => {
    expect(
      matches(ev({ key: "¡", code: "Digit1", altKey: true }), { code: "Digit1", alt: true }, true),
    ).toBe(true)
  })

  it("lets shifted symbols like ? match without naming Shift", () => {
    expect(matches(ev({ key: "?", shiftKey: true }), { key: "?" }, false)).toBe(true)
  })

  it("is case-insensitive on the key", () => {
    expect(matches(ev({ key: "S", ctrlKey: true }), { key: "s", mod: true }, false)).toBe(true)
  })
})

describe("chord labels", () => {
  it("names the keys per platform", () => {
    expect(chordKeys({ key: "k", mod: true }, true)).toEqual(["⌘", "K"])
    expect(chordKeys({ code: "Digit2", alt: true }, false)).toEqual(["Alt", "2"])
    expect(chordKeys({ key: "?" }, false)).toEqual(["?"])
  })

  it("writes aria-keyshortcuts values", () => {
    expect(ariaChord({ key: "k", mod: true }, true)).toBe("Meta+k")
    expect(ariaChord({ code: "Digit3", alt: true }, false)).toBe("Alt+3")
  })
})

describe("fuzzyScore", () => {
  it("matches subsequences and rejects the rest", () => {
    expect(fuzzyScore("dpng", "Download PNG")).not.toBeNull()
    expect(fuzzyScore("xyz", "Download PNG")).toBeNull()
  })

  it("treats an empty query as a match for everything", () => {
    expect(fuzzyScore("", "anything")).toBe(0)
  })

  it("ranks word-start hits above scattered ones", () => {
    const good = fuzzyScore("np", "New plan")!
    const weak = fuzzyScore("np", "Download PNG")!
    expect(good).toBeGreaterThan(weak)
  })

  it("ignores spaces in the query", () => {
    expect(fuzzyScore("copy png", "Copy PNG")).not.toBeNull()
  })
})

describe("isTypingTarget", () => {
  it("is true for text fields and false for buttons", () => {
    expect(isTypingTarget(document.createElement("textarea"))).toBe(true)
    expect(isTypingTarget(document.createElement("input"))).toBe(true)
    const cb = document.createElement("input")
    cb.type = "checkbox"
    expect(isTypingTarget(cb)).toBe(false)
    expect(isTypingTarget(document.createElement("button"))).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })
})
