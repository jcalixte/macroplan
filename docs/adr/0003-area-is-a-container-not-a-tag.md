# An Area is a container, not a tag

A **Feature** belongs to at most one **Area**. Areas partition a Macroplan's rows into labelled bands — they are not labels a Feature can carry several of. Authored as one optional `area` key on `[[feature]]`; a Feature with no `area` renders first, in an unlabelled band.

We chose this over many-to-many tagging because the Macroplan is read left-to-right in one glance, and a Feature in two groups has to be drawn twice or reduced to a badge — the first duplicates a row whose whole point is a single honest timeline, the second gives up the banding we wanted. Strictness costs expressiveness only in appearance: a **Milestone** already names any set of Features across Areas, so cross-cutting sets keep a home. Where two Areas both care about a Feature, it is filed under the one that owns delivery — the tie-breaker is who would be blamed if it didn't ship.

## Consequences

- **Filing is forced, and sometimes arbitrary.** Disciplines bleed (a manager briefing pack is both Communication and Change management); the author must pick. Accepted deliberately — the alternative is a Feature that appears twice on one timeline.
- **Grouping reorders the grid.** Adding `area` to an existing plan clusters rows by Area, so Features that were adjacent may separate. Author order survives only within a band.
- **No version bump.** `area` is a new optional key, so every existing `.toml` stays valid and renders identically — a plan with no Areas is the degenerate case where every Feature sits in the unlabelled leading band.
- **Feature names stay unique plan-wide.** An Area does not scope them, so `milestone.requires` keeps resolving by bare name with no qualified `"Area/Feature"` syntax.
- **An Area holds no state.** No dates, no status, no rolled-up health — the same stance Milestones take. Whether an Area is in trouble is read off its Features.
- **Reversal is expensive.** Relaxing to many-to-many later would change the key's type in files already in the wild, and would reopen every render decision the banding rests on.
