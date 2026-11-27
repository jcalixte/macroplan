// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { exportFilename, usePngExport } from "./usePngExport"

describe("exportFilename", () => {
  it("slugifies the plan title into a .png name", () => {
    expect(exportFilename("Q3 — Checkout revamp")).toBe("macroplan-q3-checkout-revamp.png")
  })

  it("collapses runs of punctuation/space and trims edge dashes", () => {
    expect(exportFilename("  Hello, World!!  ")).toBe("macroplan-hello-world.png")
  })

  it("falls back to a generic name when the title has no usable characters", () => {
    expect(exportFilename("")).toBe("macroplan-plan.png")
    expect(exportFilename("—— ··")).toBe("macroplan-plan.png")
  })
})

describe("sharePng", () => {
  const el = () => document.createElement("div")

  beforeEach(() => {
    vi.doMock("html-to-image", () => ({
      toBlob: async () => new Blob(["png"], { type: "image/png" }),
    }))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.doUnmock("html-to-image")
  })

  function stubNavigator(share: (d: ShareData) => Promise<void>) {
    vi.stubGlobal("navigator", { ...navigator, canShare: () => true, share: vi.fn(share) })
  }

  it("hands a named PNG file to the system share sheet", async () => {
    stubNavigator(async () => {})
    const { sharePng, toast } = usePngExport()
    await sharePng(el(), "macroplan-q3.png", "Q3")
    const data = vi.mocked(navigator.share).mock.calls[0][0]!
    expect(data.files![0].name).toBe("macroplan-q3.png")
    expect(data.files![0].type).toBe("image/png")
    expect(data.title).toBe("Q3")
    expect(toast.value).toBeNull()
  })

  it("stays quiet when the reader dismisses the share sheet", async () => {
    stubNavigator(async () => {
      throw new DOMException("cancelled", "AbortError")
    })
    const { sharePng, toast } = usePngExport()
    await sharePng(el(), "a.png", "A")
    expect(toast.value).toBeNull()
  })

  it("says so when sharing fails", async () => {
    stubNavigator(async () => {
      throw new DOMException("no gesture", "NotAllowedError")
    })
    const { sharePng, toast } = usePngExport()
    await sharePng(el(), "a.png", "A")
    expect(toast.value?.kind).toBe("err")
  })
})
