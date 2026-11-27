# Tutorial: learn to write Macroplan TOML

## Intent

Teach someone new to Macroplan how to **write** a plan's TOML. Reading the grid is out of scope.
The live re-render is already the feedback loop. The tutorial only has to put the right
next small edit in front of the learner.

## Goals / non-goals / anti-goals

- **Goal:** after the lessons, a learner can write a plan of their own from a blank editor. That
  plan uses features, slips, statuses, nesting, Areas and Milestones.
- **Non-goal:** the app checks nothing the learner does, and there is no step engine or progress
  tracking. That was approach B, and it can be built later on top of these lessons.
- **Non-goal:** help for the line under the cursor (approach C), which is a separate follow-up.
- **Anti-goal:** a tutorial that overwrites or clutters a learner's real plans without them asking for it.
- **Anti-goal:** lessons that drift from the format. Every lesson must parse under the current
  `macroplan_version`.

## Approaches

- **A. Lesson plans in the library (chosen).** Each lesson is a small working plan. Comments explain
  one new idea and end with a `# Try:` edit. Reuses the library, `[`/`]` and the live grid.
  No new UI.
- B. Guided step-through with checks against the parsed plan. Feels like a course, but it is far
  more to build, and every format change can break it.
- C. Help on the line under the cursor. It stays useful, but it gives a beginner no path through the format.

The user picked A.

## Design

A command palette entry, **"Start tutorial"**, appends six plans to the library and switches to the first:

| Plan title                      | New idea                                                               | `# Try:` example                                                 |
| ------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Tutorial 1 · One feature        | `[[feature]]`, `name`, `start`, `original`; dates snap to Monday       | add a second feature                                             |
| Tutorial 2 · It slipped         | `reestimates`, `delivered`, `learning`; ◉ vs ▲ against the Original    | move `delivered` a week later, watch ◉ become ▲                  |
| Tutorial 3 · In trouble         | `status`, `problem`, `countermeasure`; on-track / at-risk / off-track  | set Search off-track; the editor says the countermeasure must go |
| Tutorial 4 · Break it down      | `parent`, `duration`, chains, unlinking a child with its own `start`   | give a child a longer duration, watch the Forecast move          |
| Tutorial 5 · Areas & milestones | `area`, `[[milestone]]` with required features, plan `start`/`end`     | add a feature to the milestone's list                            |
| Tutorial 6 · Your plan          | blank except `macroplan_version`, `title`, and a checklist in comments | write your own                                                   |

My calls (correct any of them):

- **Dates are relative to today.** The lesson sources are built when the tutorial starts, offset from the
  current Monday. Then the now line, overdue Forecasts and Statuses behave as the comments say.
  Fixed dates would go stale within weeks.
- **Re-running appends a fresh set.** It never matches or overwrites existing "Tutorial …" plans,
  because a learner may have edited them. They delete lessons like any other plan.
- **Each lesson builds on the previous lesson's content** (the same "Checkout" features grow), so the
  learner sees one plan evolve instead of six unrelated ones.
- **Each comment is three to six lines and covers only the new keys.** `docs/format.md` stays the full reference, and lesson 6 links to it.
- The first-run sample plan is unchanged.
- **Where it lives:** `src/data/tutorial.ts` exports `tutorialPlans(today): { source }[]`.
  `useMacroplan` gets `startTutorial()`, which pushes them and switches to lesson 1. The palette adds the command.
- **Tests:** every lesson parses and builds with no error, and lessons 1–5 render the state
  their comments promise (for example lesson 2 has one on-time and one late delivery).
  `startTutorial` appends six plans and activates the first.

## Left to the builder

The exact lesson wording, the feature names, and whether a shortcut key is also bound (none is planned).
