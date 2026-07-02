# Macroplan TOML Format — v1

The portable, tool-independent definition of a **Macroplan**: a week-by-week
delivery plan that records what a team promised, every time an estimate slipped,
and when work actually shipped — judged against the **first** estimate, never a
moved goalpost.

This document is the contract. Any tool can produce or consume a `.toml` file
that conforms to it and render the same plan. The [macroplan app](../README.md)
is one such consumer; nothing here is specific to it.

- **Machine-readable schema:** [`macroplan.schema.json`](../public/macroplan.schema.json),
  served at `https://macroplan.apoena.dev/macroplan.schema.json` (JSON Schema
  2020-12; validates the TOML-decoded structure).
- **Reference file:** [`macroplan.example.toml`](macroplan.example.toml)
  (exercises every field and state; a conformance sample).
- **Serialization:** [TOML v1.0.0](https://toml.io). Values use TOML's native
  types — dates are **bare date literals**, not quoted strings (see _Dates_).

## Versioning

A file MAY declare the format version at the top level:

```toml
macroplan_version = 1
```

- **Optional.** An absent marker means the current version (`1`). Every existing
  file therefore stays valid.
- **Integer**, monotonically increasing. This document defines version **1**.
- A consumer that understands version _N_ **MUST reject** a file declaring a
  version **greater than** _N_ (rather than silently mis-rendering it), and
  SHOULD accept any version ≤ _N_ it still supports.
- The version is bumped only for a **breaking** change to the schema or render
  semantics below — a new optional field does not require a bump.

Producers SHOULD emit `macroplan_version` so a file self-describes its target.

## Top-level fields

| Key                 | Required | Type          | Default                | Meaning                                                                               |
| ------------------- | -------- | ------------- | ---------------------- | ------------------------------------------------------------------------------------- |
| `macroplan_version` | no       | integer (`1`) | `1`                    | Format version (see above).                                                           |
| `title`             | no       | string        | `"Untitled Macroplan"` | Display name of the plan.                                                             |
| `start`             | no       | date          | auto-fit               | Left edge of the plan's week span. **Only extends** the span; never clips a feature.  |
| `end`               | no       | date          | auto-fit               | Right edge of the plan's week span. **Only extends** the span; never clips a feature. |

Zero or more `[[feature]]` blocks and zero or more `[[milestone]]` blocks follow.

## `[[feature]]`

A unit of work, read left-to-right as a story: where it started, what was first
promised, every slip, and when it shipped.

| Key           | Required | Type                                         | Default | Meaning                                                                                                                                    |
| ------------- | -------- | -------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `name`        | **yes**  | non-empty string                             | —       | Identifies the feature; the **join key** for a milestone's `requires`.                                                                     |
| `start`       | **yes**  | date                                         | —       | The week work began.                                                                                                                       |
| `original`    | **yes**  | date                                         | —       | The **Original Estimate** — the immovable baseline all lateness is judged against ([ADR-0001](adr/0001-original-estimate-as-baseline.md)). |
| `reestimates` | no       | array of dates                               | `[]`    | Each later week the estimate slipped to (a slip, `△`). Order-independent.                                                                  |
| `delivered`   | no       | date                                         | —       | The week the feature actually shipped. Absent → still in flight.                                                                           |
| `learning`    | no       | string                                       | —       | A post-delivery takeaway.                                                                                                                  |
| `status`      | no       | `"on-track"` \| `"at-risk"` \| `"off-track"` | —       | In-flight confidence. Meaningful only while undelivered.                                                                                   |
| `note`        | no       | string                                       | —       | A short note accompanying `status`.                                                                                                        |

**Constraint — unique names:** feature `name` values MUST be unique within a
plan. Because milestone `requires` resolves by name, a duplicate would make a
requirement ambiguous. Conforming consumers reject duplicates.

## `[[milestone]]`

A dated checkpoint that depends on a set of features being delivered by then.

| Key        | Required | Type             | Default | Meaning                                                             |
| ---------- | -------- | ---------------- | ------- | ------------------------------------------------------------------- |
| `name`     | **yes**  | non-empty string | —       | Display name of the milestone.                                      |
| `week`     | **yes**  | date             | —       | When the milestone falls due.                                       |
| `requires` | no       | array of strings | `[]`    | Feature `name`s that must be delivered on/before `week` to meet it. |

A `requires` entry that names no existing feature counts as **unmet** (it can
never be satisfied) — useful for catching typos.

## Value types

### Dates → weeks

Every date field is a **calendar date**, written as a TOML bare date literal:

```toml
original = 2026-06-15
reestimates = [2026-06-29, 2026-07-13]
```

- **Canonical form is the bare date literal.** A quoted `"2026-06-15"` string is
  _tolerated_ on input for convenience, but producers SHOULD emit bare literals
  so the same plan always serializes identically.
- **Any day snaps to its ISO-week Monday.** A Macroplan's unit is the week, keyed
  by the Monday (yyyy-mm-dd) of the ISO week containing the date. `2026-06-17`
  (a Wednesday) and `2026-06-15` (that Monday) denote the **same week**. Every
  conforming renderer MUST apply this snapping, or dates land in the wrong column.

### Status

The enum `on-track` \| `at-risk` \| `off-track`. No other value is valid. Lateness
is **derived, never authored** — there is deliberately no "late" status.

## Render semantics (the contract a renderer must honor)

Two tools should draw the same plan from the same file. These rules are as much
a part of the format as the fields:

1. **On-time vs. late is judged only against `original`** — never a re-estimate
   ([ADR-0001](adr/0001-original-estimate-as-baseline.md)). `delivered ≤ original`
   (by week) is on time; `delivered > original` is late.
2. **Marker vocabulary** per feature:
   - `◯` **original** — the Original Estimate week, while undelivered.
   - `△` **re-estimate** — one per `reestimates` entry.
   - `◉` **delivered on time** — a delivery on/before `original`. It **subsumes**
     the `◯` (no separate original marker is drawn).
   - `▲` **delivered late** — a delivery after `original`; the `◯` baseline is
     **kept** alongside it.
3. **Bar extent.** A feature's bar runs from `start` to its furthest marker. A
   delivered bar ends at its delivery. An **overdue** feature (undelivered, and
   already past its furthest estimate relative to "now") keeps running to the
   current week.
4. **Plan span.** The rendered week range runs from the earliest to the latest
   week among all features' markers and all milestones. Optional `start`/`end`
   only widen this range with lead-in / trailing weeks; a marker outside them is
   never clipped.
5. **Milestone met/unmet.** A required feature is **unmet** at a milestone if it
   is undelivered, delivered _after_ the milestone `week`, or names no existing
   feature.
6. **"Now".** The current week (Monday of today) drives overdue extension and the
   "now" line. It is contextual, not stored in the file.

## Notes for implementers

- **Unknown keys.** The JSON Schema is strict (`additionalProperties: false`) so
  editors flag typos like `titel`. The reference parser is more lenient — it
  ignores unrecognized top-level keys. Producers SHOULD NOT emit unknown keys.
- **Empty plan.** A file with no features and no milestones is valid; with an
  authored `start`/`end` it renders as an empty grid across that span.
- **Editor integration.** Point [Taplo](https://taplo.tamasfe.dev)-based editors
  at the schema with a directive on the first line of a plan file:
  `#:schema https://macroplan.apoena.dev/macroplan.schema.json`.

## See also

- [CONTEXT.md](../CONTEXT.md) — the ubiquitous language (Feature, Original
  Estimate, Re-estimate, Delivery, Milestone, Week, Status, Learning).
- [ADR-0001](adr/0001-original-estimate-as-baseline.md) — why lateness is judged
  against the Original Estimate.
- [ADR-0002](adr/0002-local-first-no-backend.md) — why the `.toml` file is the
  portable source of truth.
