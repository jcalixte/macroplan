import { ref, computed, watch, onMounted, onBeforeUnmount, type Ref } from "vue"

export const SPLIT_KEY = "macroplan:source-width"
/** Narrowest Source pane: about 40 columns of the editor's monospace. */
export const MIN_SOURCE = 320
/** Room the Macroplan keeps beside it: its name column and a few weeks. */
export const MIN_MACROPLAN = 384
export const STEP = 16
export const BIG_STEP = 64

/** A width the split can show inside a container this wide. */
export function clampWidth(width: number, container: number): number {
  const max = Math.max(MIN_SOURCE, container - MIN_MACROPLAN)
  return Math.round(Math.min(Math.max(width, MIN_SOURCE), max))
}

/** The width a separator key moves to, or null for a key it ignores. */
export function keyedWidth(
  key: string,
  shift: boolean,
  current: number,
  container: number,
): number | null {
  const step = shift ? BIG_STEP : STEP
  switch (key) {
    case "ArrowLeft":
      return clampWidth(current - step, container)
    case "ArrowRight":
      return clampWidth(current + step, container)
    case "Home":
      return clampWidth(0, container)
    case "End":
      return clampWidth(Infinity, container)
    default:
      return null
  }
}

/** The stored width, or null (missing, garbled, blocked) for the default. */
export function readSourceWidth(): number | null {
  try {
    const v = Number(localStorage.getItem(SPLIT_KEY))
    return Number.isFinite(v) && v > 0 ? v : null
  } catch {
    return null
  }
}

function storeSourceWidth(width: number | null) {
  try {
    if (width === null) localStorage.removeItem(SPLIT_KEY)
    else localStorage.setItem(SPLIT_KEY, String(width))
  } catch {
    // Private mode: the width lasts for this visit only.
  }
}

/**
 * A draggable, keyboard-operable boundary between the Source pane and the
 * Macroplan. The width the reader picks is remembered; with none, CSS sizes
 * the pane. Either way CSS clamps it, so a window resize never needs JS.
 */
export function useSplitPane(
  container: Ref<HTMLElement | undefined>,
  pane: Ref<HTMLElement | undefined>,
) {
  const width = ref<number | null>(readSourceWidth())
  const paneWidth = ref(0)
  const containerWidth = ref(0)
  const dragging = ref(false)

  const style = computed(() => (width.value === null ? {} : { "--source-w": `${width.value}px` }))
  const percent = computed(() =>
    containerWidth.value ? Math.round((paneWidth.value / containerWidth.value) * 100) : 50,
  )

  function set(next: number | null) {
    width.value = next
    storeSourceWidth(next)
  }

  function startDrag(e: PointerEvent) {
    if (e.button !== 0 || !container.value) return
    e.preventDefault()
    const handle = e.currentTarget as HTMLElement
    handle.setPointerCapture?.(e.pointerId)
    handle.focus()
    dragging.value = true
    const left = container.value.getBoundingClientRect().left
    const total = container.value.clientWidth
    const move = (ev: PointerEvent) => {
      width.value = clampWidth(ev.clientX - left, total)
    }
    const end = () => {
      dragging.value = false
      storeSourceWidth(width.value)
      handle.removeEventListener("pointermove", move)
      handle.removeEventListener("pointerup", end)
      handle.removeEventListener("pointercancel", end)
    }
    handle.addEventListener("pointermove", move)
    handle.addEventListener("pointerup", end)
    handle.addEventListener("pointercancel", end)
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault()
      set(null)
      return
    }
    if (!pane.value || !container.value) return
    const next = keyedWidth(e.key, e.shiftKey, pane.value.offsetWidth, container.value.clientWidth)
    if (next === null) return
    e.preventDefault()
    set(next)
  }

  let observer: ResizeObserver | undefined
  onMounted(() => {
    if (typeof ResizeObserver === "undefined") return
    observer = new ResizeObserver(() => {
      paneWidth.value = pane.value?.offsetWidth ?? 0
      containerWidth.value = container.value?.clientWidth ?? 0
    })
    if (container.value) observer.observe(container.value)
    if (pane.value) observer.observe(pane.value)
  })
  onBeforeUnmount(() => observer?.disconnect())

  // The Source pane comes and goes with the view mode.
  watch(pane, (el, old) => {
    if (old) observer?.unobserve(old)
    if (el) observer?.observe(el)
  })

  return { width, style, percent, dragging, startDrag, onKey, reset: () => set(null) }
}
