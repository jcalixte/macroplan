/**
 * A keyboard chord. `key` is compared against `KeyboardEvent.key` (case-
 * insensitive) unless `code` is set, which matches the physical key instead —
 * needed for Alt+digit, which types `¡`/`™`/`£` on a Mac layout.
 * `mod` is ⌘ on Apple platforms and Ctrl elsewhere.
 */
export interface Chord {
  key?: string
  code?: string
  mod?: boolean
  alt?: boolean
  shift?: boolean
}

export const isApple: boolean =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform)

type KeyLike = Pick<KeyboardEvent, "key" | "code" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">

export function matches(e: KeyLike, c: Chord, apple = isApple): boolean {
  const mod = apple ? e.metaKey : e.ctrlKey
  const other = apple ? e.ctrlKey : e.metaKey
  if (!!c.mod !== mod || other || !!c.alt !== e.altKey) return false
  // `?` and `[` already encode Shift in `key`; only check it when asked for.
  if (c.shift !== undefined && c.shift !== e.shiftKey) return false
  if (c.code) return e.code === c.code
  return e.key.toLowerCase() === c.key?.toLowerCase()
}

/** Is focus somewhere typing goes — so bare-letter shortcuts must stand down? */
export function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false
  if (t.isContentEditable) return true
  if (t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return true
  if (t instanceof HTMLInputElement) {
    return !["button", "checkbox", "radio", "range", "submit", "reset"].includes(t.type)
  }
  return false
}

/** The chord as the keys a person presses, one label per key cap. */
export function chordKeys(c: Chord, apple = isApple): string[] {
  const keys: string[] = []
  if (c.mod) keys.push(apple ? "⌘" : "Ctrl")
  if (c.alt) keys.push(apple ? "⌥" : "Alt")
  if (c.shift) keys.push(apple ? "⇧" : "Shift")
  const k = c.code?.replace(/^(Digit|Key)/, "") ?? c.key ?? ""
  keys.push(k.length === 1 ? k.toUpperCase() : k)
  return keys
}

/** For `aria-keyshortcuts`: `Meta+K`, `Alt+1`, `?`. */
export function ariaChord(c: Chord, apple = isApple): string {
  const parts: string[] = []
  if (c.mod) parts.push(apple ? "Meta" : "Control")
  if (c.alt) parts.push("Alt")
  if (c.shift) parts.push("Shift")
  parts.push(c.code?.replace(/^(Digit|Key)/, "") ?? c.key ?? "")
  return parts.join("+")
}

/**
 * Score `text` against a typed `query`: every query character must appear in
 * order (a subsequence). Higher is better; null means no match. Rewards
 * contiguous runs and hits at word starts, so `dpng` ranks "Download PNG" over
 * "Delete plan — doing nothing".
 */
export function fuzzyScore(query: string, text: string): number | null {
  const q = query.toLowerCase().replace(/\s+/g, "")
  if (!q) return 0
  const t = text.toLowerCase()
  let score = 0
  let ti = 0
  let prev = -2
  for (const ch of q) {
    const at = t.indexOf(ch, ti)
    if (at === -1) return null
    const wordStart = at === 0 || /[\s\-—·./(]/.test(t[at - 1])
    score += 1 + (at === prev + 1 ? 3 : 0) + (wordStart ? 4 : 0)
    prev = at
    ti = at + 1
  }
  // Prefer shorter labels when two match equally well.
  return score - t.length * 0.01
}
