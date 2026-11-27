# Macroplan TOML Format — v3

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

- **Optional.** An absent marker means the current version (`3`).
- **Integer**, monotonically increasing. This document defines version **3**.
  Version **2** is the same format with a single free `note` in place of
  `problem` and `countermeasure`, and none of the Status rules that go with them
  ([ADR-0005](adr/0005-problem-and-countermeasure-replace-note.md)). Version
  **1** is version 2 without nested Features (`parent`, `weeks`,
  `reestimate_weeks`).
- A consumer that understands version _N_ **MUST reject** a file declaring a
  version **greater than** _N_ (rather than silently mis-rendering it), and
  SHOULD accept any version ≤ _N_ it still supports.
- The version is bumped only for a **breaking** change to the schema or render
  semantics below — a new optional field does not require a bump.

Producers SHOULD emit `macroplan_version` so a file self-describes its target,
and SHOULD emit the lowest version that describes the plan: `3` only when it
uses `problem` or `countermeasure`, `2` only when it uses `parent`, so older
tools keep reading every plan they can. A file that **declares** `1` and uses
`parent` MUST be rejected, and so must a file that declares `1` or `2` and uses
`problem` or `countermeasure`.

**Reading an older file.** A v1 or v2 `note` is read as the Feature's
`problem`, whatever its Status, so no authored text is lost. The Status rules
(see _Status_) apply to v3 files only: a v2 at-risk Feature without a
Countermeasure is still valid. Because an absent marker means v3, an unmarked
file that uses `note` is rejected; declaring `macroplan_version = 2` makes it
valid again.

## Top-level fields

| Key                 | Required | Type              | Default                | Meaning                                                                               |
| ------------------- | -------- | ----------------- | ---------------------- | ------------------------------------------------------------------------------------- |
| `macroplan_version` | no       | integer (`1`–`3`) | `3`                    | Format version (see above).                                                           |
| `title`             | no       | string            | `"Untitled Macroplan"` | Display name of the plan.                                                             |
| `start`             | no       | date              | auto-fit               | Left edge of the plan's week span. **Only extends** the span; never clips a feature.  |
| `end`               | no       | date              | auto-fit               | Right edge of the plan's week span. **Only extends** the span; never clips a feature. |

Zero or more `[[feature]]`, `[[milestone]]` and `[[break]]` blocks follow.

## `[[feature]]`

A unit of work, read left-to-right as a story: where it started, what was first
promised, every slip, and when it shipped.

| Key                | Required              | Type                                         | Default | Meaning                                                                                                                                    |
| ------------------ | --------------------- | -------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `name`             | **yes**               | non-empty string                             | —       | Identifies the feature; the **join key** for a milestone's `requires`.                                                                     |
| `start`            | see _Nested Features_ | date                                         | —       | The week work began. In a chain, only its first leaf carries it.                                                                           |
| `original`         | see _Nested Features_ | date                                         | —       | The **Original Estimate** — the immovable baseline all lateness is judged against ([ADR-0001](adr/0001-original-estimate-as-baseline.md)). |
| `reestimates`      | no                    | array of dates                               | `[]`    | Each later week the estimate slipped to (a slip, `△`). Order-independent.                                                                  |
| `parent`           | no                    | non-empty string                             | —       | The `name` of the parent Feature; makes this Feature a child (v2). Absent → top-level.                                                     |
| `weeks`            | see _Nested Features_ | integer ≥ 1                                  | —       | A child's planned **Duration**, in weeks (v2).                                                                                             |
| `reestimate_weeks` | no                    | array of integers ≥ 1                        | `[]`    | A child's re-estimated Durations, each longer than the one before (v2).                                                                    |
| `delivered`        | no                    | date                                         | —       | The week the feature actually shipped. Absent → still in flight.                                                                           |
| `learning`         | no                    | string                                       | —       | A post-delivery takeaway.                                                                                                                  |
| `status`           | no                    | `"on-track"` \| `"at-risk"` \| `"off-track"` | —       | In-flight confidence. Meaningful only while undelivered.                                                                                   |
| `problem`          | see _Status_          | non-empty string                             | —       | Why the feature is in trouble, stated as fact. At-risk or off-track only (v3).                                                             |
| `countermeasure`   | see _Status_          | non-empty string                             | —       | The action that answers the Problem. Required when at-risk; forbidden otherwise (v3).                                                      |
| `area`             | no                    | non-empty string                             | —       | The **Area** this feature belongs to — a named group of features sharing a discipline or owner. Absent → ungrouped.                        |

**Constraint — unique names:** feature `name` values MUST be unique within a
plan. Because milestone `requires` resolves by name, a duplicate would make a
requirement ambiguous. Conforming consumers reject duplicates. An `area` does
**not** scope names — uniqueness is plan-wide, so `requires` keeps naming
features across areas.

## `[[milestone]]`

A dated checkpoint that depends on a set of features being delivered by then.

| Key        | Required | Type             | Default | Meaning                                                             |
| ---------- | -------- | ---------------- | ------- | ------------------------------------------------------------------- |
| `name`     | **yes**  | non-empty string | —       | Display name of the milestone.                                      |
| `week`     | **yes**  | date             | —       | When the milestone falls due.                                       |
| `requires` | no       | array of strings | `[]`    | Feature `name`s that must be delivered on/before `week` to meet it. |

A `requires` entry that names no existing feature counts as **unmet** (it can
never be satisfied) — useful for catching typos.

## `[[break]]`

A run of weeks when the whole team is off: a holiday, a shutdown, an offsite.

```toml
[[break]]
name = "Christmas break"
from = 2026-12-21
to = 2027-01-01
```

| Key    | Required | Type             | Default      | Meaning                       |
| ------ | -------- | ---------------- | ------------ | ----------------------------- |
| `name` | **yes**  | non-empty string | —            | Label of the period.          |
| `from` | **yes**  | date             | —            | The first week off.           |
| `to`   | no       | date             | same as from | The last week off, inclusive. |

`to` before `from` (by week) is rejected. Breaks may overlap. A Break is
**drawn only**: it moves no authored date, no Duration, no Forecast,
and lateness is still judged against `original`. It was added after version
`2` as an optional block, so it does not bump the version.

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

### Areas

An **Area** groups features into a labelled band. A feature belongs to **at
most one** Area — it is a container, not a tag
([ADR-0003](adr/0003-area-is-a-container-not-a-tag.md)).

```toml
[[feature]]
name = "Manager briefing pack"
area = "Communication"
```

- **Optional.** A file with no `area` anywhere is a valid, ungrouped plan — the
  key was added after version `1` and does **not** bump the version, because a
  new optional field is not a breaking change.
- **Non-empty.** `area = ""` is rejected. Omit the key to say "ungrouped";
  there is deliberately only one way to express that.
- **Matched case-insensitively, after trimming surrounding whitespace.**
  `"training"`, `"Training"` and `" Training "` are the **same** Area.
- **Labelled by first spelling.** When spellings differ, the band is labelled
  with the first one that appears in the file — a renderer never invents a
  capitalization the author didn't type.

### Nested Features

A Feature can be broken into child Features, which can have children of their
own. A child names its parent with `parent`; nesting is never written with
TOML's nested tables ([ADR-0004](adr/0004-nesting-by-parent-name.md)).

```toml
[[feature]]
name = "Payments"
area = "Platform"

[[feature]]
name = "Vendor contract"
parent = "Payments"
start = 2026-06-01   # the first leaf anchors the chain
weeks = 2
delivered = 2026-06-15

[[feature]]
name = "Integration"
parent = "Payments"
weeks = 3
reestimate_weeks = [4]
```

**Siblings form a chain, in file order**: each one starts the week after the
one before it ends. Which keys a Feature may carry depends on where it sits:

| Position                                 | Carries                                                                | Must not carry                                                                             |
| ---------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Top-level, no children                   | `start`, `original` (required), `reestimates`, `delivered`             | `weeks`, `reestimate_weeks`                                                                |
| Parent (has children), at any depth      | `status`, `problem`, `countermeasure`, `learning`; `area` if top-level | `start`, `original`, `reestimates`, `delivered`, `weeks`, `reestimate_weeks` — all derived |
| Child without children                   | `weeks` (required), `reestimate_weeks`, `delivered`                    | `original`, `reestimates`, `area`                                                          |
| First leaf of a top-level parent's chain | as a child, plus `start` (required) — the anchor of the chain          | —                                                                                          |

- **Exactly one `start` per tree**: on its first leaf in reading order. Every
  other date in the tree follows from the Durations, so a deliberate gap
  can't be confused with a typo.
- **`reestimate_weeks` only grows.** Each value is longer than `weeks` and the
  value before it — a Re-estimate is always a slip.
- **`parent` resolves by name**, like `requires`; names stay unique at every
  depth. A `parent` naming no feature, naming itself, or forming a cycle is
  rejected.
- **`area` belongs to the top-level Feature only.** Children sit in their
  parent's Area.

### Status

The enum `on-track` \| `at-risk` \| `off-track`. No other value is valid. Lateness
is **derived, never authored** — there is deliberately no "late" status.

In a v3 file, an undelivered Feature's texts must agree with its Status:

| Status      | `problem` | `countermeasure` |
| ----------- | --------- | ---------------- |
| absent      | forbidden | forbidden        |
| `on-track`  | forbidden | forbidden        |
| `at-risk`   | optional  | **required**     |
| `off-track` | optional  | forbidden        |

An at-risk feature without a Countermeasure is off-track by definition, and an
off-track one with a Countermeasure is at-risk, so both are rejected. A
**delivered** feature (a parent: every child delivered) is exempt: its Status,
Problem and Countermeasure are ignored, so recording a delivery never forces a
cleanup.

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
   - `◌` **forecast** — computed, in a chain only (rule 9). Drawn while
     undelivered, and only when it differs from the latest estimate.
3. **Bar extent.** A feature's bar runs from `start` to its furthest marker. A
   delivered bar ends at its delivery. An **overdue** feature (undelivered, and
   already past its furthest estimate relative to "now") keeps running to the
   current week. When a Forecast lands after the latest estimate, the bar runs
   **dashed** from the latest estimate to the `◌`.
4. **Area banding.** Features are grouped into contiguous bands, one per Area.
   Bands appear in order of **first appearance** of the Area in the file;
   within a band, features keep their authored order. A top-level feature's
   subtree moves with it, each parent directly followed by its children. Features with **no**
   `area` form a single unlabelled band rendered **first**. Grouping therefore
   reorders rows relative to the file — a plan with no Areas is the degenerate
   case where every feature sits in that leading band and nothing moves.
5. **Plan span.** The rendered week range runs from the earliest to the latest
   week among all features' markers and all milestones. Optional `start`/`end`
   only widen this range with lead-in / trailing weeks; a marker outside them is
   never clipped. Areas do **not** affect the span.
6. **Milestone met/unmet.** A required feature is **unmet** at a milestone if it
   is undelivered, delivered _after_ the milestone `week`, or names no existing
   feature. Areas do not scope this: a milestone may require features from any
   number of Areas.
7. **Breaks.** Every week from `from` to `to` is shaded across all
   rows and labelled with the Break's `name`. Breaks never
   widen the span: only the weeks already in range are shaded. Use `end` to
   pad a plan out to a holiday that falls after its last marker.
8. **"Now".** The current week (Monday of today) drives overdue extension and the
   "now" line. It is contextual, not stored in the file.
9. **Chains (v2).** Within a top-level tree, two chains are derived from the
   anchor `start`, walking the leaves in reading order:
   - **Planned** — each leaf runs for `weeks` from the week after its
     predecessor's Original Estimate; the last week is its **Original
     Estimate**. Computed from the file alone, it never moves.
   - **Real** — each leaf starts the week after the **latest** week any earlier
     leaf occupies: its delivery, or its forecast while undelivered. Its
     **forecast** is that start plus its latest Duration (the last
     `reestimate_weeks` value, else `weeks`), minus one week. Each
     `reestimate_weeks` value draws a `△` at the real start plus that Duration.
     An early delivery pulls later leaves earlier, just as a late one pushes
     them back.
   - A leaf delivered while an earlier leaf in its chain is undelivered, or
     delivered later, is **out of order**: drawn as recorded, and flagged.
10. **Parents (v2).** A parent's start is its earliest child's start, its
    Original Estimate is its last child's, and its forecast is the latest of its
    children's. It is delivered once **every** child is, in the week the last of
    them was delivered, and is judged on-time/late against its own derived
    Original Estimate (rule 1). A parent never draws `△`. A milestone may require
    a feature at any depth; requiring a parent means requiring its derived
    delivery.
11. **Folding.** A renderer may fold a parent's subtree. Fold state is a view
    preference and is never stored in the file; folding never changes the week
    span.
12. **Status / Learning.** Every row says what kind of text it shows. A
    delivered feature shows its `learning` behind a _learned_ label, or just
    "delivered on time" / "delivered late". An undelivered feature always
    shows its Status word ("in flight" when absent). An at-risk or off-track
    feature then reads `problem → countermeasure`; with no Countermeasure
    (always the case off-track) it shows the problem alone, without the arrow.

## Notes for implementers

- **Unknown keys.** The JSON Schema is strict (`additionalProperties: false`) so
  editors flag typos like `titel`. The reference parser is more lenient — it
  ignores unrecognized top-level keys, but rejects an unknown `[[block]]`
  name, since a misspelled header would silently drop the whole block.
  Producers SHOULD NOT emit unknown keys.
- **Empty plan.** A file with no features and no milestones is valid; with an
  authored `start`/`end` it renders as an empty grid across that span.
- **Editor integration.** Point [Taplo](https://taplo.tamasfe.dev)-based editors
  at the schema with a directive on the first line of a plan file:
  `#:schema https://macroplan.apoena.dev/macroplan.schema.json`.

## See also

- [CONTEXT.md](../CONTEXT.md) — the ubiquitous language (Feature, Original
  Estimate, Re-estimate, Delivery, Milestone, Area, Week, Status, Problem,
  Countermeasure, Learning, Duration, Forecast).
- [ADR-0001](adr/0001-original-estimate-as-baseline.md) — why lateness is judged
  against the Original Estimate.
- [ADR-0002](adr/0002-local-first-no-backend.md) — why the `.toml` file is the
  portable source of truth.
- [ADR-0003](adr/0003-area-is-a-container-not-a-tag.md) — why a feature belongs
  to at most one Area.
- [ADR-0004](adr/0004-nesting-by-parent-name.md) — why a child names its parent
  with a flat key rather than nested tables.
- [ADR-0005](adr/0005-problem-and-countermeasure-replace-note.md) — why `note`
  became a Problem and a Countermeasure, behind version 3.
