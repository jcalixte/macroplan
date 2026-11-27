# Problem and Countermeasure replace `note`, behind format version 3

An in-flight Feature used to carry one free `note` next to its Status. In practice that note mixed what was wrong ("the search API is flaky") with what we'd do about it ("spike a fallback"), and the grid showed it with no label, so a reader couldn't tell a Learning from a status comment. We replaced `note` with two single-purpose keys, `problem` and `countermeasure`. We also made the Status definitions depend on them: at-risk means in trouble _with_ a Countermeasure, off-track means _without_ one.

That definition makes a rule a file can break. An at-risk Feature without a `countermeasure` is now a contradiction, and every at-risk Feature written before this change has none. So the change is breaking, and we bumped the format to version 3 instead of adding the keys as optional v2 fields with `note` kept as an alias. A v3 file is checked strictly. A file declaring version 1 or 2 is read as before, its `note` shown as the Problem.

## Considered Options

- **Keep `note` as an alias for `problem`, stay on v2.** Nothing breaks, but the at-risk rule could never be enforced, because an old at-risk file and a new careless one look the same. The alias would also live on forever in the format.
- **Drop `note` silently.** Unknown scalar keys are tolerated, so every existing note would vanish with no error. Rejected: it loses authored text.

## Consequences

- **An unmarked file is a v3 file.** "No `macroplan_version`" means the current version, so an unmarked plan that still uses `note`, or an at-risk Feature without a Countermeasure, is now rejected. The error names both ways out: switch to `problem`/`countermeasure`, or declare `macroplan_version = 2`.
- **Delivered Features are exempt.** Status, Problem and Countermeasure are dropped once a Feature is delivered, so recording a Delivery never forces a cleanup of stale texts.
