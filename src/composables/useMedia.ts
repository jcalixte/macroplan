import { ref, onMounted, onBeforeUnmount, type Ref } from "vue"

/** Below Tailwind's `md`: a phone, where the Macroplan is read rather than written. */
export const NARROW = "(max-width: 47.9375rem)"
/** A finger, not a mouse: no hover, so no `title` tooltips and no keyboard. */
export const TOUCH = "(hover: none) and (pointer: coarse)"

/** Whether a media query matches, kept live. False where matchMedia is missing. */
export function useMedia(query: string): Ref<boolean> {
  const mql = typeof window !== "undefined" ? window.matchMedia?.(query) : undefined
  const matches = ref(mql?.matches ?? false)
  const update = (e: MediaQueryListEvent) => (matches.value = e.matches)
  onMounted(() => mql?.addEventListener?.("change", update))
  onBeforeUnmount(() => mql?.removeEventListener?.("change", update))
  return matches
}
