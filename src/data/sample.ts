// Default Macroplan shown on first load — exercises every state:
// on-time delivery, late delivery with slips, in-flight (on-track/at-risk/off-track),
// an overdue Feature, and a Milestone with unmet required Features.
export const SAMPLE_PLAN = `# Macroplan format version — optional; current is 3. See docs/format.md.
macroplan_version = 3

title = "Q3 — Checkout revamp"

# Optional plan span: pad the plan with lead-in / trailing weeks.
# Rule: start ≤ every Feature's start, and end ≥ every Feature's last week.
# Omit both to auto-fit the columns to the Features and Milestones.
start = 2026-05-25
end = 2026-08-03

# A Feature: start week, Original Estimate (the immovable baseline), then any
# Re-estimates, an optional Delivery, and a Learning once delivered.
# While in flight, a Status: on-track carries no text, at-risk names its
# \`countermeasure\` (and may state its \`problem\`), off-track has no
# Countermeasure yet (and may state its \`problem\`).
# Dates are TOML date literals; any day is snapped to that week's Monday.

# \`area\` groups Features into labelled bands. Optional — omit it and the
# Feature joins the unlabelled band at the top.

[[feature]]
name = "Auth"
area = "Platform"
start = 2026-06-01
original = 2026-06-15
delivered = 2026-06-15          # on time → ◉
learning = "Spiking the OAuth flow first paid off — do discovery spikes earlier."

[[feature]]
name = "Payments"
area = "Platform"
start = 2026-06-01
original = 2026-06-15           # ◯ baseline
reestimates = [2026-06-29, 2026-07-13]   # two re-estimates → △ △
delivered = 2026-07-20          # after the baseline → ▲ late
learning = "Vendor lead time was the real constraint — derisk vendors up front."

[[feature]]
name = "Dashboard"
area = "Product"
start = 2026-06-01
original = 2026-06-08           # already past 'now' and undelivered → overdue
status = "off-track"
problem = "No owner since the reorg."

[[feature]]
name = "Search"
area = "Product"
start = 2026-06-08
original = 2026-06-22
reestimates = [2026-07-06]      # re-estimated once, still in flight → △
status = "at-risk"
problem = "Third-party search API is flaky."
countermeasure = "Spike a fallback on the in-house index."

[[feature]]
name = "Notifications"
area = "Product"
start = 2026-06-22
original = 2026-07-06
status = "on-track"

[[milestone]]
name = "Code freeze"
week = 2026-06-29
requires = ["Auth", "Payments"]

[[milestone]]
name = "MVP go-live"
week = 2026-07-06
requires = ["Auth", "Payments", "Dashboard"]

[[milestone]]
name = "Beta launch"
week = 2026-07-13
requires = ["Search", "Notifications"]
`

/** FNV-1a over UTF-16 code units, as 8 hex digits. Identifies a shipped
 *  sample without bundling its full text. */
export function sampleHash(source: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < source.length; i++) {
    h ^= source.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, "0")
}

// Every SAMPLE_PLAN shipped before the current one. A stored plan still equal
// to one of them was never edited, so it is safe to replace with SAMPLE_PLAN.
// When SAMPLE_PLAN changes, add the hash of the version it replaces here.
export const RETIRED_SAMPLE_HASHES: ReadonlySet<string> = new Set([
  "4d09290f", // c1d7218
  "0f11d004", // 6e80000
  "f5e1ff0c", // 8000307
  "7cd00111", // d499433
  "33605cbc", // 40ee9f5
  "21084863", // 53716a1
  "737178b7", // a2f21ef
])
