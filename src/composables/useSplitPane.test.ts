// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest"
import {
  clampWidth,
  keyedWidth,
  readSourceWidth,
  SPLIT_KEY,
  MIN_SOURCE,
  MIN_MACROPLAN,
  STEP,
  BIG_STEP,
} from "./useSplitPane"

describe("clampWidth", () => {
  it("keeps the Source pane at least MIN_SOURCE wide", () => {
    expect(clampWidth(100, 1400)).toBe(MIN_SOURCE)
  })
  it("leaves the Macroplan MIN_MACROPLAN of room", () => {
    expect(clampWidth(5000, 1400)).toBe(1400 - MIN_MACROPLAN)
  })
  it("gives MIN_SOURCE when the container can't fit both minimums", () => {
    expect(clampWidth(600, 500)).toBe(MIN_SOURCE)
  })
})

describe("keyedWidth", () => {
  it("steps with the arrows, further with Shift", () => {
    expect(keyedWidth("ArrowRight", false, 500, 1400)).toBe(500 + STEP)
    expect(keyedWidth("ArrowLeft", true, 500, 1400)).toBe(500 - BIG_STEP)
  })
  it("jumps to the bounds with Home and End", () => {
    expect(keyedWidth("Home", false, 500, 1400)).toBe(MIN_SOURCE)
    expect(keyedWidth("End", false, 500, 1400)).toBe(1400 - MIN_MACROPLAN)
  })
  it("ignores other keys", () => {
    expect(keyedWidth("a", false, 500, 1400)).toBeNull()
  })
})

describe("readSourceWidth", () => {
  beforeEach(() => localStorage.clear())
  it("reads a stored width", () => {
    localStorage.setItem(SPLIT_KEY, "640")
    expect(readSourceWidth()).toBe(640)
  })
  it("falls back to the default on garbage", () => {
    localStorage.setItem(SPLIT_KEY, "wide")
    expect(readSourceWidth()).toBeNull()
    localStorage.clear()
    expect(readSourceWidth()).toBeNull()
  })
})
