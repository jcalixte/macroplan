import { ref, computed, onMounted, onBeforeUnmount } from "vue"

export type Theme = "light" | "dark"
/** A Theme the reader picked, or null to follow the system. */
export type ThemeChoice = Theme | null

export const THEME_KEY = "macroplan:theme"
const DARK = "(prefers-color-scheme: dark)"

/** The stored choice; anything else (missing, garbled, blocked) means "system". */
export function readThemeChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_KEY)
    return v === "light" || v === "dark" ? v : null
  } catch {
    return null
  }
}

/** Sets `data-theme` for a picked Theme. With none, the attribute goes and
 *  DaisyUI's `prefersdark` follows the system. index.html runs the same rule
 *  before first paint, so a dark reader never sees a light flash. */
export function applyThemeChoice(choice: ThemeChoice, root = document.documentElement) {
  if (choice) root.dataset.theme = choice
  else delete root.dataset.theme
}

export function useTheme() {
  const mql = typeof window !== "undefined" ? window.matchMedia?.(DARK) : undefined
  const systemDark = ref(mql?.matches ?? false)
  const choice = ref<ThemeChoice>(readThemeChoice())
  const theme = computed<Theme>(() => choice.value ?? (systemDark.value ? "dark" : "light"))

  function choose(next: ThemeChoice) {
    choice.value = next
    applyThemeChoice(next)
    try {
      if (next) localStorage.setItem(THEME_KEY, next)
      else localStorage.removeItem(THEME_KEY)
    } catch {
      /* storage blocked: the choice still holds for this visit */
    }
  }

  /** Flip to the other Theme. Picking the one the system already shows hands
   *  control back to the system, so a toggle never pins what it didn't change. */
  function toggle() {
    const next: Theme = theme.value === "dark" ? "light" : "dark"
    const system: Theme = systemDark.value ? "dark" : "light"
    choose(next === system ? null : next)
  }

  const update = (e: MediaQueryListEvent) => (systemDark.value = e.matches)
  onMounted(() => mql?.addEventListener?.("change", update))
  onBeforeUnmount(() => mql?.removeEventListener?.("change", update))

  return { theme, choice, choose, toggle }
}
