# Child Features name their parent; they are not nested tables

A child Feature is an ordinary `[[feature]]` block with a `parent` key naming the Feature it belongs to. Siblings chain in the order they appear in the file. We don't use TOML's native nested tables (`[[feature.feature]]`), and a parent doesn't list its children (`children = [...]`).

We chose a flat `parent` key because it keeps every block `[[feature]]` at any depth. The editor, block-header completion and JSON Schema keep working unchanged, and `parent` can offer existing Feature names the same way `area` offers Area names. Nested tables get longer headers at every level. Because TOML ignores indentation, a header missing one `.feature` silently files a block under a different parent, which is the kind of quiet mistake this format tries to prevent. A `children` list would keep a Feature's position in one place and its data in another, so the two could drift apart.

## Consequences

- **References can dangle.** A `parent` that names no Feature, a cycle, or a Feature naming itself are all parse errors. The structure no longer prevents them.
- **Unique names carry more weight.** `parent` resolves by bare name, like `milestone.requires`. That's why names stay unique at every depth, not only within a parent.
- **File order is meaningful twice.** It orders Area bands, and it orders the dependency chain among siblings. Moving a block changes the chain.
- **Children may be far from their parent in the file.** The grid still renders them under their parent. The file stays readable only if authors keep children next to their parent, so we expect it but don't enforce it.
