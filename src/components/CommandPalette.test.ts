// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, type Mock } from "vitest"
import { mount } from "@vue/test-utils"
import { nextTick } from "vue"
import CommandPalette, { type Command } from "./CommandPalette.vue"

beforeAll(() => {
  // happy-dom lacks the modal API; a minimal stand-in keeps `open` in sync.
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute("open", "")
  }
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute("open")
  }
  Element.prototype.scrollIntoView ??= () => {}
})

function cmds(): (Command & { run: Mock<() => void> })[] {
  return [
    { id: "a", group: "View", label: "Show the source only", run: vi.fn<() => void>() },
    {
      id: "b",
      group: "Export",
      label: "Download the Macroplan as PNG",
      chord: { key: "d" },
      run: vi.fn<() => void>(),
    },
    { id: "c", group: "Plan", label: "New plan", run: vi.fn<() => void>() },
  ]
}

async function open(commands = cmds()) {
  const w = mount(CommandPalette, { props: { open: false, commands }, attachTo: document.body })
  await w.setProps({ open: true })
  await nextTick()
  return { w, commands }
}

describe("CommandPalette", () => {
  it("lists every command under its group heading when the query is empty", async () => {
    const { w } = await open()
    expect(w.findAll('[role="option"]')).toHaveLength(3)
    expect(w.findAll(".group").map((g) => g.text())).toEqual(["View", "Export", "Plan"])
    w.unmount()
  })

  it("filters by fuzzy match and ranks the best hit first", async () => {
    const { w } = await open()
    await w.find("input").setValue("dpng")
    const opts = w.findAll('[role="option"]')
    expect(opts).toHaveLength(1)
    expect(opts[0].text()).toContain("Download the Macroplan as PNG")
    w.unmount()
  })

  it("moves with the arrows and runs the active command on Enter", async () => {
    const { w, commands } = await open()
    const input = w.find("input")
    await input.trigger("keydown", { key: "ArrowDown" })
    expect(input.attributes("aria-activedescendant")).toBe("cmd-opt-1")
    await input.trigger("keydown", { key: "Enter" })
    await nextTick()
    await nextTick()
    expect(w.emitted("close")).toBeTruthy()
    expect(commands[1].run).toHaveBeenCalledOnce()
    expect(commands[0].run).not.toHaveBeenCalled()
    w.unmount()
  })

  it("wraps from the first option to the last on ArrowUp", async () => {
    const { w } = await open()
    const input = w.find("input")
    await input.trigger("keydown", { key: "ArrowUp" })
    expect(input.attributes("aria-activedescendant")).toBe("cmd-opt-2")
    w.unmount()
  })

  it("says so when nothing matches", async () => {
    const { w } = await open()
    await w.find("input").setValue("zzzz")
    expect(w.find(".none").text()).toContain("zzzz")
    expect(w.find("input").attributes("aria-activedescendant")).toBeUndefined()
    w.unmount()
  })

  it("closes on Escape (the dialog's cancel event)", async () => {
    const { w } = await open()
    await w.find("dialog").trigger("cancel")
    expect(w.emitted("close")).toBeTruthy()
    w.unmount()
  })
})
