# Macroplan

A **Macroplan** is a week-by-week plan that keeps the receipts: what we promised to deliver, when it actually landed, and what the gap taught us — a simpler cousin of a Gantt chart whose purpose is not just scheduling but _learning_.

## Language

**Macroplan**:
A week-by-week plan that keeps the receipts on the **Features** we promised: when each actually landed, and what the gap taught us.
_Avoid_: Gantt, roadmap, timeline

**Feature**:
A unit of delivery with a start week, an **Original Estimate**, optional **Re-estimates**, and (eventually) a **Delivery**. A Feature may be broken down into child Features, which may themselves have children. A Feature with children is a **parent**: its dates are never authored, only derived from its children. It still carries its own **Status**, **Problem**, **Countermeasure** and **Learning**, because those are judgements. Shown as one collapsible row whose children unfold beneath it.
_Avoid_: task, ticket, story, epic, sub-feature, step

**Duration**:
The planned number of **Weeks** a child Feature needs, at least one. A child's **Original Estimate** is the last Week of its Duration. Each top-level Feature's tree is anchored to a start week exactly once, on its first leaf in reading order. Each later child starts the Week after its predecessor's Original Estimate. The chain of planned Durations fixes every child's baseline once, and it never moves afterwards. A parent's Duration is the sum of its children's Durations.
_Avoid_: effort, estimate, size, length

**Original Estimate**:
The first committed delivery week for a Feature. The immovable baseline against which on-time vs. late is judged. Rendered `◯` while unmet.
_Avoid_: target, deadline, due date

**Re-estimate**:
A revised, later delivery week recorded when a Feature will miss a prior estimate. A visible slip; it never moves the Original Estimate baseline. Rendered `△`. A child Feature re-estimates its **Duration**, not a date. A parent never records a Re-estimate: its children's slips reach it as its **Forecast**.
_Avoid_: reschedule, new deadline

**Forecast**:
The week a Feature is now expected to land, computed rather than recorded. It is the child's real start (the Week after its predecessor's Delivery, or after its predecessor's latest expected week while the predecessor is still open) plus its **Duration**, and never earlier than the current Week: an open Feature past its latest estimate is forecast to land this Week, so an overdue slip shows (and carries down the chain) before the Delivery, not only once it lands. A top-level Feature has no chain, so its Forecast is its latest estimate, or this Week once overdue. It works in both directions: an early Delivery pulls later children earlier just as a late one pushes them back. It carries a predecessor's slip down the chain to every later child and up to the parent. A Forecast is arithmetic, never a decision: it is drawn apart from a **Re-estimate**, and on-time vs. late is still judged against the **Original Estimate**.
_Avoid_: projection, auto re-estimate, knock-on, prediction

**Delivery**:
The week a Feature was actually completed. On-time (delivered on/before the Original Estimate) renders `◉`; late renders `▲`.
_Avoid_: completion, done date, release

**Milestone**:
An external event or date that explicitly names a set of Features that must be delivered by it. Rendered as a labelled vertical line across the plan. Carries no rolled-up status of its own — whether it will be hit is read off its Features.
_Avoid_: deadline, release, gate

**Learning**:
A free-text takeaway captured against a Feature once it is delivered — what this delivery taught us to do better next time. Shown in a persistent trailing column per row; empty for in-flight Features.
_Avoid_: retro note, lesson, postmortem

**Status**:
A Feature's _current_ delivery confidence (a snapshot, overwritten each review): **on-track** (all good), **at-risk** (in trouble, with a **Countermeasure**), **off-track** (in trouble, with no Countermeasure). It carries no free comment: the only texts an in-flight Feature holds are its **Problem** and its Countermeasure, each with one meaning. Applies only while in-flight; once delivered, the **Learning** takes over and the Status is dropped. Any Feature at any depth may carry its own Status, and nothing rolls up: a parent shows only the Status authored on it, and its children's trouble reaches it through its **Forecast**. A folded parent with an at-risk or off-track descendant shows a dot in the worst one's colour, so folding never hides trouble; the dot is a pointer, not a Status. An overdue Feature (past its latest estimate, not delivered) shows its slip through its **Forecast**, pinned to the current Week, and its confidence through an at-risk/off-track Status, not a dedicated symbol.
_Avoid_: health, RAG, risk

**Problem**:
Why a Feature is in trouble, stated as fact rather than remedy. Like the **Status** it belongs to, it is a snapshot that is replaced at each review and dropped once the Feature is delivered.
_Avoid_: note, comment, issue, blocker, cause, risk

**Countermeasure**:
The stated action that answers a Feature's **Problem** and brings it back on track. It is what separates **at-risk** from **off-track**. Like the **Status** it belongs to, it is a snapshot: it is replaced at each review and dropped once the Feature is delivered.
_Avoid_: plan (that word is the **Macroplan**'s), recovery, mitigation, next step, fix

**Area**:
A named group of **Features** that share a discipline or owner (e.g. Change management, Communication, Training). A Feature belongs to at most one Area; Areas partition the plan into labelled row bands, ordered by first appearance. Two spellings that differ only in case or surrounding space name the same Area, labelled by the first spelling used. Pure arrangement — an Area carries no dates, no status of its own, and no rolled-up health: whether it is in trouble is read off its Features. Features with no Area render first, in an unlabelled band.
_Avoid_: folder, stream, workstream, silo, track (collides with the on-track/off-track **Status**), swimlane, category, epic

**Week**:
A column of the plan: one real calendar week, identified and labelled by the date of its first workday (Monday). Columns run contiguously from the earliest Feature start to the last marker or Milestone — empty weeks in between are still drawn. An optional authored **start**/**end** widens this span with lead-in or trailing empty Weeks; it only ever extends the range, never narrowing it or hiding a Feature.
_Avoid_: column, period, sprint

**Break**:
A named run of **Weeks** when the whole team is off: a holiday, a shutdown, an offsite. Shaded across every row. Pure display: it moves no date, no **Duration** and no **Forecast**, and never widens the plan's span.
_Avoid_: unavailability, holiday, time off, blackout, freeze

**Now line**:
A vertical line marking the current week across the whole plan — the at-a-glance "where are we right now".
_Avoid_: today marker, cursor

**Library**:
The collection of saved **Macroplans** held in the browser's localStorage — the live store. Always holds at least one Macroplan; durability rests on exporting a Macroplan's `.toml` (per ADR-0002), not on the Library itself. Carries no status of its own.
_Avoid_: workspace, project, file list

**Format version**:
Which revision of the portable Macroplan `.toml` format a file targets, declared by an optional top-level `macroplan_version` (currently `3`; a Macroplan with no **Problem** or **Countermeasure** is still a version `2` file, and one that also has no child Features a version `1` file). Absent means the current version; a newer version is rejected rather than silently mis-rendered. The format — its fields and render semantics — is defined in [docs/format.md](docs/format.md) so a Macroplan can be produced or consumed outside this app.
_Avoid_: schema version, file version, app version

## Symbols

- `┣` start of a Feature's bar
- `━` continuation of the bar
- `◯` Original Estimate, not yet delivered
- `◉` delivered on time (on/before Original Estimate)
- `△` Re-estimate (a slip to a later week)
- `▲` delivered late (after Original Estimate)
- `◌` Forecast (computed, drawn muted), shown only when it differs from the latest estimate
- `▨` a **Break** week (hatched column)
- `┄` the stretch of a bar from the latest estimate to the Forecast
- `→` reads Problem → Countermeasure; hidden when there is no Countermeasure

## Relationships

- A **Macroplan** contains an author-ordered list of **Features** (typically ordered by start **Week**) and many **Milestones**. Features may be grouped into **Areas**; grouping is the only arrangement concept — nothing nests inside an Area but Features, and Areas do not nest.
- The **Library** holds many **Macroplans**, exactly one of which is active (shown in the editor and grid). Each is identified internally by a stable id and labelled by its **title**.
- A **Feature** has zero or more child **Features**, in a fixed order where each depends on the one before (it cannot start until its predecessor ends). The order is a plan, not a law: a child delivered before its predecessor is still recorded as it happened, and flagged rather than refused. Nesting may go to any depth. A parent's start is its first child's start, its **Original Estimate** is its last child's Original Estimate, and it is delivered once every child is, in the Week the last of them lands.
- A **Feature** has exactly one **Original Estimate**, zero or more **Re-estimates**, at most one **Delivery**, and at most one **Learning**.
- While in-flight, a **Feature** has at most one **Status**, at most one **Problem** and at most one **Countermeasure**. An on-track Feature carries neither text. An at-risk Feature always has a Countermeasure and may state its Problem. An off-track Feature never has a Countermeasure and may state its Problem. Once delivered, all three are dropped and the **Learning** takes over.
- A top-level **Feature** belongs to at most one **Area**; child Features sit in their parent's Area and never name one of their own. Feature names stay unique across the whole Macroplan, at every depth: neither an Area nor a parent scopes them, so a **Milestone** can keep naming Features across Areas and at any depth.
- A **Milestone** explicitly names the **Features** required by it, at any depth (requiring a parent means requiring its derived Delivery: every child delivered); a Feature may be required by zero, one, or several Milestones, and a Feature may be in the plan without belonging to any Milestone.
- On-time vs. late is judged against the **Original Estimate**, never a **Re-estimate**.

## Example dialogue

> **PM:** "Feature C had a `◯` in W3 but we slipped — put a `△` in W5."
> **Dev:** "And when it actually shipped in W6, it's `▲` late, because we judge against the original W3 `◯`, not the W5 re-estimate."
> **PM:** "Right. The slip and the late delivery are both visible — that's the **Learning**."
