// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { mount, enableAutoUnmount } from "@vue/test-utils"
import { nextTick } from "vue"

// downloadSource performs a real DOM/Blob download; mock it so we can assert
// the wiring without touching the filesystem. sourceFilename stays real.
vi.mock("./composables/useSourceExport", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./composables/useSourceExport")>()
  return { ...actual, downloadSource: vi.fn() }
})

import App from "./App.vue"
import { downloadSource } from "./composables/useSourceExport"
import { SAMPLE_PLAN } from "./data/sample"

// The editor lazy-loads Shiki and the grid is heavy; neither is under test here.
const stubs = { PlanEditor: true, MacroplanGrid: true }

function mountApp() {
  return mount(App, { global: { stubs } })
}

// dropdown links = one <a> per plan, then "New plan" and "Download .toml".
function dropdownLinks(w: ReturnType<typeof mountApp>) {
  return w.findAll(".dropdown-content li a")
}

beforeEach(() => localStorage.clear())
// The keyboard layer listens on window; a leftover App would claim keys first.
enableAutoUnmount(afterEach)

// happy-dom lacks the modal API the palette's <dialog> uses.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.setAttribute("open", "")
}
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  this.removeAttribute("open")
}

describe("App — plan library wiring", () => {
  it("shows the active plan name in the header switcher", () => {
    expect(mountApp().text()).toContain("Q3 — Checkout revamp")
  })

  it("creates a new plan from the dropdown", async () => {
    const w = mountApp()
    expect(dropdownLinks(w)).toHaveLength(3) // 1 plan + New + Download
    await dropdownLinks(w)[1].trigger("click") // New plan
    await nextTick()
    expect(dropdownLinks(w)).toHaveLength(4) // 2 plans + New + Download
  })

  it("archives a plan from its switcher row at once, and Undo brings it back", async () => {
    const w = mountApp()
    await dropdownLinks(w)[1].trigger("click") // New → 2 plans
    await nextTick()
    const rows = () => w.findAll(".dropdown-content button.archive")
    expect(rows()).toHaveLength(2)

    await rows()[0].trigger("click") // the sample, not the open plan
    await nextTick()
    expect(rows()).toHaveLength(1)
    expect(w.find(".undo").text()).toContain("Archived “Q3 — Checkout revamp”")

    await w.find(".undo button").trigger("click")
    await nextTick()
    expect(rows()).toHaveLength(2)
    expect(w.find(".undo").exists()).toBe(false)
    expect(w.text()).toContain("Q3 — Checkout revamp")
  })

  it("has no confirm dialog and no archive button in the header", () => {
    const w = mountApp()
    expect(w.find(".modal").exists()).toBe(false)
    expect(w.find('header > button[aria-label^="Archive"]').exists()).toBe(false)
  })

  it("undoing the archive of the only plan leaves just that plan, not the re-seeded sample", async () => {
    const w = mountApp()
    await w.find(".dropdown-content button.archive").trigger("click")
    await nextTick()
    expect(dropdownLinks(w)).toHaveLength(3) // never empty: sample re-seeded
    await w.find(".undo button").trigger("click")
    await nextTick()
    expect(dropdownLinks(w)).toHaveLength(3) // the original back, the seed gone
  })

  it("shows the archived plan in the switcher and restores it from there", async () => {
    const w = mountApp()
    await dropdownLinks(w)[1].trigger("click") // New → 2 plans
    await nextTick()
    expect(w.find(".dropdown-content .restore").exists()).toBe(false)
    await w.findAll(".dropdown-content button.archive")[0].trigger("click")
    await nextTick()
    expect(w.find(".dropdown-content .archived-name").text()).toBe("Q3 — Checkout revamp")
    await w.find(".dropdown-content .restore").trigger("click")
    await nextTick()
    expect(w.find(".dropdown-content .restore").exists()).toBe(false)
    expect(w.findAll(".dropdown-content button.archive")).toHaveLength(2)
  })

  it("warns when archiving pushes the previous plan out for good", async () => {
    const w = mountApp()
    await dropdownLinks(w)[1].trigger("click")
    await nextTick()
    await dropdownLinks(w)[2].trigger("click") // New → 3 plans
    await nextTick()
    const rows = () => w.findAll(".dropdown-content button.archive")
    await rows()[0].trigger("click")
    await nextTick()
    await rows()[0].trigger("click")
    await nextTick()
    expect(w.find(".undo").text()).toContain("“Q3 — Checkout revamp” left the Archive for good.")
  })

  it("wires the dropdown .toml download to downloadSource with the active source and a .toml name", async () => {
    const w = mountApp()
    await dropdownLinks(w)[2].trigger("click") // Download .toml (1 plan → index 2)
    expect(downloadSource).toHaveBeenCalledOnce()
    const [src, filename] = (downloadSource as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(src).toBe(SAMPLE_PLAN)
    expect(filename).toBe("macroplan-q3-checkout-revamp.toml")
  })
})

describe("App — keyboard layer", () => {
  // Global shortcuts listen on window; dispatch there with the event's target
  // defaulting to the body (outside any text field).
  function press(init: KeyboardEventInit, target: EventTarget = document.body) {
    const e = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init })
    target.dispatchEvent(e)
    return e
  }
  const ctrl = /Mac/.test(navigator.platform) ? { metaKey: true } : { ctrlKey: true }

  it("switches panes with Alt+1/2/3 by physical key", async () => {
    const w = mount(App, { global: { stubs }, attachTo: document.body })
    press({ key: "¡", code: "Digit1", altKey: true })
    await nextTick()
    expect(w.find('[aria-keyshortcuts="Alt+1"]').attributes("aria-pressed")).toBe("true")
    press({ key: "3", code: "Digit3", altKey: true })
    await nextTick()
    expect(w.find('[aria-keyshortcuts="Alt+3"]').attributes("aria-pressed")).toBe("true")
    press({ key: "2", code: "Digit2", altKey: true }) // back to the default for later tests
  })

  it("creates a plan on N and cycles plans with ] and [", async () => {
    const w = mount(App, { global: { stubs }, attachTo: document.body })
    press({ key: "n" })
    await nextTick()
    expect(dropdownLinks(w)).toHaveLength(4)
    expect(w.find(".dropdown .btn").text()).toContain("Untitled")
    press({ key: "]" })
    await nextTick()
    expect(w.find(".dropdown .btn").text()).toContain("Q3 — Checkout revamp")
    press({ key: "[" })
    await nextTick()
    expect(w.find(".dropdown .btn").text()).toContain("Untitled")
  })

  it("ignores bare-letter shortcuts while typing in a field", async () => {
    const w = mount(App, { global: { stubs }, attachTo: document.body })
    const field = document.createElement("textarea")
    document.body.append(field)
    press({ key: "n" }, field)
    await nextTick()
    expect(dropdownLinks(w)).toHaveLength(3)
    field.remove()
  })

  it("leaves Mod+S to the browser", async () => {
    vi.mocked(downloadSource).mockClear()
    mount(App, { global: { stubs }, attachTo: document.body })
    const e = press({ key: "s", ...ctrl })
    expect(e.defaultPrevented).toBe(false)
    expect(downloadSource).not.toHaveBeenCalled()
  })

  it("downloads the .toml on S, but not while typing in a field", async () => {
    vi.mocked(downloadSource).mockClear()
    mount(App, { global: { stubs }, attachTo: document.body })
    const field = document.createElement("textarea")
    document.body.append(field)
    press({ key: "s" }, field)
    expect(downloadSource).not.toHaveBeenCalled()
    const e = press({ key: "s" })
    expect(e.defaultPrevented).toBe(true)
    expect(downloadSource).toHaveBeenCalledOnce()
    field.remove()
  })

  it("opens the palette on Mod+K, on Alt+K by physical key, and on ?", async () => {
    const w = mount(App, { global: { stubs }, attachTo: document.body })
    const palette = w.findComponent({ name: "CommandPalette" })
    press({ key: "˚", code: "KeyK", altKey: true })
    await nextTick()
    expect(palette.props("open")).toBe(true)
    palette.vm.$emit("close")
    await nextTick()
    press({ key: "k", ...ctrl })
    await nextTick()
    expect(palette.props("open")).toBe(true)
    palette.vm.$emit("close")
    await nextTick()
    press({ key: "?", shiftKey: true })
    await nextTick()
    expect(palette.props("open")).toBe(true)
  })
})

describe("App — on a phone", () => {
  let restore: typeof window.matchMedia
  beforeEach(() => {
    restore = window.matchMedia
    window.matchMedia = ((q: string) => ({
      matches: q.includes("max-width"),
      media: q,
      addEventListener() {},
      removeEventListener() {},
    })) as unknown as typeof window.matchMedia
  })
  afterEach(() => {
    window.matchMedia = restore
    history.replaceState(null, "", "/")
  })

  it("opens on the Macroplan alone, with no source pane", () => {
    const w = mountApp()
    expect(w.findComponent({ name: "MacroplanGrid" }).exists()).toBe(true)
    expect(w.findComponent({ name: "PlanEditor" }).exists()).toBe(false)
  })

  it("switches between the source and the Macroplan, with no Split on offer", async () => {
    const w = mountApp()
    const btn = (label: string) => w.findAll(".join button").find((b) => b.text() === label)!
    expect(btn("Split").classes()).toContain("max-md:hidden")
    expect(btn("Macroplan").attributes("aria-pressed")).toBe("true")
    await btn("Source").trigger("click")
    expect(w.findComponent({ name: "PlanEditor" }).exists()).toBe(true)
    expect(w.findComponent({ name: "MacroplanGrid" }).exists()).toBe(false)
  })

  it("draws the grid compact", () => {
    expect(mountApp().findComponent({ name: "MacroplanGrid" }).props("compact")).toBe(true)
  })
})
