import { addWeeks, mondayOf, type WeekId } from "../model/week"

// The tutorial: six lesson plans that teach writing Macroplan TOML, one idea
// each. Dates are offsets from the week the tutorial starts, so the now line,
// overdue Forecasts and Statuses behave as each lesson's comments say.

const NEXT = "# Next: press Esc to leave the editor, then ] for the next lesson."

export function tutorialPlans(today: Date | string = new Date()): string[] {
  const now = mondayOf(today)
  const w = (n: number): WeekId => addWeeks(now, n)

  const auth1 = `[[feature]]
name = "Auth"
start = ${w(-2)}
original = ${w(1)}`

  const delivered = `[[feature]]
name = "Auth"
start = ${w(-7)}
original = ${w(-5)}
delivered = ${w(-5)}
learning = "Spiking the OAuth flow first paid off."

[[feature]]
name = "Payments"
start = ${w(-7)}
original = ${w(-5)}
reestimates = [${w(-4)}, ${w(-3)}]
delivered = ${w(-2)}
learning = "Vendor lead time was the real constraint."`

  const inFlight = `[[feature]]
name = "Dashboard"
start = ${w(-4)}
original = ${w(-1)}
status = "off-track"
problem = "No owner since the reorg."

[[feature]]
name = "Search"
start = ${w(-3)}
original = ${w(0)}
reestimates = [${w(2)}]
status = "at-risk"
problem = "Third-party search API is flaky."
countermeasure = "Spike a fallback on the in-house index."

[[feature]]
name = "Notifications"
start = ${w(-1)}
original = ${w(2)}
status = "on-track"`

  const nested = `[[feature]]
name = "Checkout flow"

[[feature]]
name = "Vendor contract"
parent = "Checkout flow"
start = ${w(-4)}
weeks = 2
delivered = ${w(-2)}

[[feature]]
name = "Integration"
parent = "Checkout flow"
weeks = 3

[[feature]]
name = "Rollout"
parent = "Checkout flow"
weeks = 2`

  return [
    `# Tutorial 1 of 6 · One feature
#
# A Macroplan is a list of Features, one row each. A Feature needs a name,
# a start week, and an Original Estimate: the week you first promise to
# deliver. The promise is drawn ◯, and it never moves, whatever happens next.
# Dates are TOML dates, without quotes. Any day snaps to its week's Monday.
#
# Try: copy the [[feature]] block, rename the copy "Payments" and give it a
# later start. A second row appears.
${NEXT}
macroplan_version = 3
title = "Tutorial 1 · One feature"

${auth1}
`,

    `# Tutorial 2 of 6 · It slipped
#
# When a Feature will miss its estimate, add a Re-estimate: \`reestimates\`
# lists the later weeks, each drawn △. The Original Estimate ◯ stays put.
# \`delivered\` records the week it shipped: ◉ on or before the Original
# Estimate, ▲ after it. Late is always judged against the first promise,
# never against a Re-estimate. Once delivered, write down the \`learning\`.
#
# Try: set Auth's \`delivered\` one week later and watch its ◉ become ▲.
${NEXT}
macroplan_version = 3
title = "Tutorial 2 · It slipped"

${delivered}
`,

    `# Tutorial 3 of 6 · In trouble
#
# While a Feature is in flight, its \`status\` says how confident you are:
#   on-track  all good, no text
#   at-risk   in trouble, with a \`countermeasure\` (and an optional \`problem\`)
#   off-track in trouble, no countermeasure yet (an optional \`problem\`)
# Dashboard is past its estimate and not delivered: its Forecast is pinned to
# this week, a dashed △ nobody recorded yet.
#
# Try: set Search's status to "off-track". The editor tells you why that
# fails. Delete its \`countermeasure\` line to fix it.
${NEXT}
macroplan_version = 3
title = "Tutorial 3 · In trouble"

${delivered}

${inFlight}
`,

    `# Tutorial 4 of 6 · Break it down
#
# A child names its parent with \`parent\`. A parent has no dates of its own:
# they come from its children. Children plan in \`weeks\` and chain in file
# order: each starts the week after the one before it. Only the first child
# needs a \`start\`. Click the ▸ beside Checkout flow to unfold it.
# Vendor contract landed a week late, so Integration's Forecast (dashed △)
# moved a week right, and Rollout's with it.
#
# Try: set Vendor contract's \`delivered\` one more week later and watch
# both Forecasts slide. Then give Rollout its own \`start\`: that cuts its
# link to Integration, so the slip no longer reaches it.
# A child re-estimates in weeks: \`reestimate_weeks = [3]\`.
${NEXT}
macroplan_version = 3
title = "Tutorial 4 · Break it down"

${delivered}

${nested}
`,

    `# Tutorial 5 of 6 · Areas & milestones
#
# \`area\` groups Features into labelled bands. Children belong to their
# parent's Area. A [[milestone]] is a dated line that lists the Features
# that must be delivered by then in \`requires\`.
# The plan's own \`start\` and \`end\` add empty weeks before and after.
#
# Try: add "Notifications" to Beta launch's \`requires\`. Then move
# Notifications to the "Product" area.
${NEXT}
macroplan_version = 3
title = "Tutorial 5 · Areas & milestones"
start = ${w(-8)}
end = ${w(6)}

${delivered.replace(/^start = /gm, 'area = "Platform"\nstart = ')}

${inFlight.replace(/^start = /gm, 'area = "Product"\nstart = ').replace(/(name = "Notifications"\n)area = "Product"\n/, "$1")}

${nested.replace('name = "Checkout flow"\n', 'name = "Checkout flow"\narea = "Product"\n')}

[[milestone]]
name = "MVP go-live"
week = ${w(-2)}
requires = ["Auth", "Payments"]

[[milestone]]
name = "Beta launch"
week = ${w(3)}
requires = ["Search", "Checkout flow"]
`,

    `# Tutorial 6 of 6 · Your plan
#
# Now write your own. A checklist:
#   1. A [[feature]] for each thing you promised: name, start, original.
#   2. Break big ones down: children with \`parent\` and \`weeks\`.
#   3. Each review: add \`reestimates\` for slips, \`delivered\` when shipped,
#      a \`status\` while in flight, a \`learning\` once done.
#   4. Group with \`area\`, mark dates that matter with [[milestone]].
# Start typing a key to get completions. ⌘K / Ctrl+K lists every command.
# The full format: https://git.apoena.dev/julien/macroplan/src/branch/main/docs/format.md
macroplan_version = 3
title = "My plan"
`,
  ]
}
