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

  it("opens the confirm modal and deletes the active plan on confirm", async () => {
    const w = mountApp()
    await dropdownLinks(w)[1].trigger("click") // New → 2 plans
    await nextTick()
    expect(dropdownLinks(w)).toHaveLength(4)

    await w.find('button[title="Delete this plan"]').trigger("click")
    expect(w.find(".modal-open").exists()).toBe(true)

    await w.find(".modal-action .btn-error").trigger("click") // Delete
    await nextTick()
    expect(w.find(".modal-open").exists()).toBe(false)
    expect(dropdownLinks(w)).toHaveLength(3) // back to 1 plan
  })

  it("cancel dismisses the modal without deleting", async () => {
    const w = mountApp()
    await w.find('button[title="Delete this plan"]').trigger("click")
    expect(w.find(".modal-open").exists()).toBe(true)

    const cancel = w.findAll(".modal-action .btn").find((b) => !b.classes().includes("btn-error"))!
    await cancel.trigger("click")
    expect(w.find(".modal-open").exists()).toBe(false)
    expect(dropdownLinks(w)).toHaveLength(3) // plan untouched
  })

  it("re-seeds a fresh sample when the last plan is deleted (never empty)", async () => {
    const w = mountApp()
    expect(dropdownLinks(w)).toHaveLength(3) // 1 plan

    await w.find('button[title="Delete this plan"]').trigger("click")
    await w.find(".modal-action .btn-error").trigger("click") // Delete the only plan
    await nextTick()
    expect(dropdownLinks(w)).toHaveLength(3) // still 1 plan — re-seeded
    expect(w.text()).toContain("Q3 — Checkout revamp")
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

  it("opens the palette on Mod+K and on ?", async () => {
    const w = mount(App, { global: { stubs }, attachTo: document.body })
    const palette = w.findComponent({ name: "CommandPalette" })
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
