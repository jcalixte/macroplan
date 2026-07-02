/** Geometry for keeping the completion popup inside the browser window.
 *
 * The popup is anchored just below the caret. Near the right or bottom edge of
 * the window that anchor spills off-screen and the popup gets clipped, so we:
 *   • shift it left until its right edge clears the window, and
 *   • flip it above the caret line when there's no room below.
 *
 * Coordinates are local to the editor (the textarea's border box); `origin` is
 * that box's own top-left in the window, the bridge from local to window space.
 */
export function fitPopup(opts: {
  caret: { left: number; top: number }
  lineHeight: number
  box: { width: number; height: number }
  origin: { left: number; top: number }
  viewport: { width: number; height: number }
  margin?: number
}): { left: number; top: number } {
  const { caret, lineHeight, box, origin, viewport } = opts
  const margin = opts.margin ?? 8

  let left = caret.left
  const overRight = origin.left + left + box.width - (viewport.width - margin)
  if (overRight > 0) left = Math.max(margin - origin.left, left - overRight)

  let top = caret.top + lineHeight
  if (origin.top + top + box.height > viewport.height - margin) {
    // Not enough room below — flip above, but never off the top of the window.
    top = Math.max(margin - origin.top, caret.top - box.height)
  }

  return { left, top }
}
