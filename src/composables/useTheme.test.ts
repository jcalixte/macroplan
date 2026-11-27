// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest"
import { useTheme, readThemeChoice, THEME_KEY } from "./useTheme"

function systemPrefersDark(dark: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: dark, addEventListener() {}, removeEventListener() {} })),
  )
}

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
  vi.unstubAllGlobals()
})

describe("useTheme", () => {
  it("follows the system when nothing is stored", () => {
    systemPrefersDark(true)
    const t = useTheme()
    expect(t.choice.value).toBeNull()
    expect(t.theme.value).toBe("dark")
  })

  it("ignores a garbled stored value", () => {
    localStorage.setItem(THEME_KEY, "solarized")
    expect(readThemeChoice()).toBeNull()
  })

  it("toggling away from the system pins the other Theme and persists it", () => {
    systemPrefersDark(false)
    const t = useTheme()
    t.toggle()
    expect(t.theme.value).toBe("dark")
    expect(localStorage.getItem(THEME_KEY)).toBe("dark")
    expect(document.documentElement.dataset.theme).toBe("dark")
  })

  it("toggling back to what the system shows hands control back to the system", () => {
    systemPrefersDark(false)
    localStorage.setItem(THEME_KEY, "dark")
    const t = useTheme()
    t.toggle()
    expect(t.theme.value).toBe("light")
    expect(t.choice.value).toBeNull()
    expect(localStorage.getItem(THEME_KEY)).toBeNull()
    expect(document.documentElement.dataset.theme).toBeUndefined()
  })
})
