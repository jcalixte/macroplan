// @vitest-environment happy-dom
import { describe, it, expect, beforeAll } from "vitest"
import { mount } from "@vue/test-utils"
import PlanEditor from "./PlanEditor.vue"

// happy-dom ships no canvas 2D context; measure() only needs measureText, so a
// tiny stub keeps onMounted from throwing without pulling in a canvas polyfill.
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() => ({
    measureText: () => ({ width: 80 }),
    font: "",
  })) as unknown as HTMLCanvasElement["getContext"]
})

/** Mount with a working v-model so emitted edits flow back into the prop. */
function mountEditor(initial = "") {
  const wrapper = mount(PlanEditor, {
    props: {
      modelValue: initial,
      error: null,
      "onUpdate:modelValue": (v: string) => wrapper.setProps({ modelValue: v }),
    },
  })
  return wrapper
}

/** Type `text` into the textarea (caret at the end) and let the popup refresh. */
async function type(wrapper: ReturnType<typeof mountEditor>, text: string) {
  const ta = wrapper.find("textarea")
  const el = ta.element as HTMLTextAreaElement
  el.value = text
  el.selectionStart = el.selectionEnd = text.length
  await ta.trigger("input")
}

const lastEmit = (wrapper: ReturnType<typeof mountEditor>) => {
  const events = wrapper.emitted("update:modelValue")
  return events?.at(-1)?.[0] as string | undefined
}

describe("PlanEditor completion keys", () => {
  it("opens the popup as the author types a key prefix", async () => {
    const wrapper = mountEditor()
    await type(wrapper, "t")
    expect(wrapper.find(".completion").exists()).toBe(true)
    expect(wrapper.findAll(".completion .label").map((el) => el.text())).toContain("title")
  })

  it("Tab accepts the selected item without navigating first", async () => {
    const wrapper = mountEditor()
    await type(wrapper, "t")
    await wrapper.find("textarea").trigger("keydown", { key: "Tab" })
    expect(lastEmit(wrapper)).toBe("title = ")
    expect(wrapper.find(".completion").exists()).toBe(false)
  })

  it("Enter does not accept an untouched popup — it closes instead", async () => {
    const wrapper = mountEditor()
    await type(wrapper, "t")
    await wrapper.find("textarea").trigger("keydown", { key: "Enter" })
    // No accept happened: the last emit is still the raw typed value.
    expect(lastEmit(wrapper)).toBe("t")
    expect(wrapper.find(".completion").exists()).toBe(false)
  })

  it("Enter accepts once the author has navigated the popup", async () => {
    const wrapper = mountEditor()
    await type(wrapper, "t")
    await wrapper.find("textarea").trigger("keydown", { key: "ArrowDown" })
    await wrapper.find("textarea").trigger("keydown", { key: "Enter" })
    expect(lastEmit(wrapper)).toBe("title = ")
  })
})
