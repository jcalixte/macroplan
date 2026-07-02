import { describe, it, expect } from "vitest"
import { fitPopup } from "./popupFit"

// A roomy window with the editor pinned at the top-left, so `origin` adds nothing
// and only the caret/box geometry drives the result.
const base = {
  lineHeight: 20,
  box: { width: 256, height: 224 },
  origin: { left: 0, top: 0 },
  viewport: { width: 1000, height: 800 },
  margin: 8,
}

describe("fitPopup", () => {
  it("anchors just below the caret when it fits", () => {
    const { left, top } = fitPopup({ ...base, caret: { left: 100, top: 200 } })
    expect(left).toBe(100)
    expect(top).toBe(220) // caret.top + lineHeight
  })

  it("shifts left so the right edge clears the window", () => {
    // caret.left 900 + box 256 = 1156, past the 992 usable width by 164.
    const { left } = fitPopup({ ...base, caret: { left: 900, top: 200 } })
    expect(left).toBe(736) // 900 - 164
    expect(left + base.box.width).toBe(base.viewport.width - base.margin)
  })

  it("flips above the caret line when there's no room below", () => {
    // caret near the bottom: below would be 780+224 = 1004, past 792.
    const { top } = fitPopup({ ...base, caret: { left: 100, top: 780 } })
    expect(top).toBe(780 - 224) // popup bottom now sits on the caret line
  })

  it("never pushes the flipped popup off the top of the window", () => {
    // Tiny window: neither below nor a full flip fits, so clamp to the margin.
    const { top } = fitPopup({
      ...base,
      caret: { left: 100, top: 40 },
      viewport: { width: 1000, height: 120 },
    })
    expect(top).toBe(base.margin)
  })

  it("accounts for the editor's offset within the window (origin)", () => {
    // Editor pushed 800px right; a caret at local 100 sits at window x=900, so the
    // 256-wide box overflows and must shift left even though caret.left is small.
    const { left } = fitPopup({
      ...base,
      caret: { left: 100, top: 200 },
      origin: { left: 800, top: 0 },
    })
    expect(800 + left + base.box.width).toBe(base.viewport.width - base.margin)
  })
})
