<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from "vue"
import { useMacroplan } from "./composables/useMacroplan"
import { usePngExport, exportFilename } from "./composables/usePngExport"
import { sourceFilename, downloadSource } from "./composables/useSourceExport"
import PlanEditor from "./components/PlanEditor.vue"
import MacroplanGrid from "./components/MacroplanGrid.vue"
import PlanSwitcher from "./components/PlanSwitcher.vue"
import PlanHeader from "./components/PlanHeader.vue"
import CommandPalette, { type Command } from "./components/CommandPalette.vue"
import { matches, isTypingTarget, chordKeys, ariaChord, type Chord } from "./composables/shortcuts"

const {
  source,
  plan,
  error,
  hints,
  expanded,
  toggleExpanded,
  setExpanded,
  plans,
  activeId,
  selectPlan,
  newPlan,
  deletePlan,
} = useMacroplan()
const { busy, toast, copyPng, downloadPng } = usePngExport()

const exportRoot = ref<HTMLElement>()
const editor = ref<InstanceType<typeof PlanEditor>>()
const cancelDelete = ref<HTMLButtonElement>()
const confirmingDelete = ref(false)
const paletteOpen = ref(false)

// Which panes are visible: the Source editor, the rendered Macroplan, or both.
// Kept in the URL (?view=…) so a layout is shareable/bookmarkable, not persisted.
type ViewMode = "source" | "split" | "macroplan"

function readViewMode(): ViewMode {
  const v = new URLSearchParams(location.search).get("view")
  return v === "source" || v === "macroplan" ? v : "split"
}

const mode = ref<ViewMode>(readViewMode())
const showSource = computed(() => mode.value !== "macroplan")
const showMacroplan = computed(() => mode.value !== "source")

// Reflect the choice in the URL without stacking a history entry per toggle.
// "split" is the default, so drop the param to keep the URL clean.
watch(mode, (m) => {
  const url = new URL(location.href)
  if (m === "split") url.searchParams.delete("view")
  else url.searchParams.set("view", m)
  history.replaceState(history.state, "", url)
})

const activeName = computed(
  () => plans.value.find((p) => p.id === activeId.value)?.name ?? "Untitled",
)

function downloadToml() {
  downloadSource(source.value, sourceFilename(plan.value?.title ?? activeName.value))
}

function confirmDelete() {
  deletePlan(activeId.value)
  confirmingDelete.value = false
}

// Land on Cancel, so Enter right after opening the dialog is the safe choice.
watch(confirmingDelete, (open) => open && nextTick(() => cancelDelete.value?.focus()))

// ── Keyboard layer ───────────────────────────────────────────────────────────
// One list drives both the palette and the global shortcuts, so a chord shown
// in the palette is always the chord that works.

const PALETTE: Chord = { key: "k", mod: true }

function focusSource() {
  if (!showSource.value) mode.value = "split"
  nextTick(() => editor.value?.focus())
}

function cyclePlan(delta: number) {
  const list = plans.value
  const i = list.findIndex((p) => p.id === activeId.value)
  selectPlan(list[(i + delta + list.length) % list.length].id)
}

const parentNames = computed(() =>
  (plan.value?.rows ?? []).filter((r) => r.childCount > 0).map((r) => r.name),
)

const commands = computed<Command[]>(() => {
  const list: Command[] = [
    {
      id: "view-source",
      group: "View",
      label: "Show the source only",
      chord: { code: "Digit1", alt: true },
      current: mode.value === "source",
      run: () => (mode.value = "source"),
    },
    {
      id: "view-split",
      group: "View",
      label: "Show source and Macroplan side by side",
      chord: { code: "Digit2", alt: true },
      current: mode.value === "split",
      run: () => (mode.value = "split"),
    },
    {
      id: "view-macroplan",
      group: "View",
      label: "Show the Macroplan only",
      chord: { code: "Digit3", alt: true },
      current: mode.value === "macroplan",
      run: () => (mode.value = "macroplan"),
    },
    {
      id: "focus-source",
      group: "View",
      label: "Edit the source",
      chord: { key: "e" },
      run: focusSource,
    },
  ]
  if (parentNames.value.length) {
    list.push(
      {
        id: "unfold-all",
        group: "View",
        label: "Unfold every parent Feature",
        run: () => setExpanded(parentNames.value),
      },
      {
        id: "fold-all",
        group: "View",
        label: "Fold every parent Feature",
        run: () => setExpanded([]),
      },
    )
  }

  list.push({ id: "new", group: "Plan", label: "New plan", chord: { key: "n" }, run: newPlan })
  if (plans.value.length > 1) {
    list.push(
      {
        id: "next",
        group: "Plan",
        label: "Next plan",
        chord: { key: "]" },
        run: () => cyclePlan(1),
      },
      {
        id: "prev",
        group: "Plan",
        label: "Previous plan",
        chord: { key: "[" },
        run: () => cyclePlan(-1),
      },
    )
  }
  list.push({
    id: "delete",
    group: "Plan",
    label: `Delete “${activeName.value}”…`,
    run: () => (confirmingDelete.value = true),
  })

  if (plan.value && !busy.value) {
    list.push(
      {
        id: "copy-png",
        group: "Export",
        label: "Copy the Macroplan as PNG",
        chord: { key: "c" },
        run: () => copyPng(exportRoot.value),
      },
      {
        id: "download-png",
        group: "Export",
        label: "Download the Macroplan as PNG",
        chord: { key: "d" },
        run: () => downloadPng(exportRoot.value, exportFilename(plan.value?.title ?? "")),
      },
    )
  }
  list.push({
    id: "download-toml",
    group: "Export",
    label: "Download the source as .toml",
    chord: { key: "s", mod: true },
    run: downloadToml,
  })

  for (const p of plans.value) {
    list.push({
      id: `open-${p.id}`,
      group: "Switch plan",
      label: p.name,
      current: p.id === activeId.value,
      run: () => selectPlan(p.id),
    })
  }
  return list
})

function onKeydown(e: KeyboardEvent) {
  if (e.defaultPrevented || e.isComposing) return
  if (paletteOpen.value) return // the palette's own dialog handles its keys
  if (confirmingDelete.value) {
    if (e.key === "Escape") confirmingDelete.value = false
    return
  }
  if (matches(e, PALETTE)) {
    e.preventDefault()
    paletteOpen.value = true
    return
  }
  // Escape leaves the editor, handing the keyboard to the bare-key shortcuts.
  // The completion popup claims Escape first (it calls preventDefault).
  if (e.key === "Escape" && e.target instanceof HTMLTextAreaElement) {
    e.target.blur()
    return
  }
  const typing = isTypingTarget(e.target)
  if (!typing && matches(e, { key: "?" })) {
    e.preventDefault()
    paletteOpen.value = true
    return
  }
  for (const c of commands.value) {
    if (!c.chord) continue
    const bare = !c.chord.mod && !c.chord.alt
    if (bare && typing) continue
    if (matches(e, c.chord)) {
      e.preventDefault()
      c.run()
      return
    }
  }
}

onMounted(() => window.addEventListener("keydown", onKeydown))
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown))

const paletteKeys = chordKeys(PALETTE)
const paletteAria = ariaChord(PALETTE)
</script>

<template>
  <div class="flex h-screen flex-col bg-base-200 font-sans text-base-content">
    <header class="navbar min-h-0 gap-2 border-b border-base-300 bg-base-100 px-4 py-2">
      <img src="/favicon.svg" alt="" class="size-6" />
      <div class="flex-1">
        <PlanSwitcher
          :plans="plans"
          :active-id="activeId"
          @select="selectPlan"
          @new="newPlan"
          @download="downloadToml"
        />
      </div>
      <div class="join" role="group" aria-label="Choose which panes to show">
        <button
          class="btn btn-sm join-item"
          :class="{ 'btn-active': mode === 'source' }"
          :aria-pressed="mode === 'source'"
          aria-keyshortcuts="Alt+1"
          title="Show only the TOML source"
          @click="mode = 'source'"
        >
          Source
        </button>
        <button
          class="btn btn-sm join-item"
          :class="{ 'btn-active': mode === 'split' }"
          :aria-pressed="mode === 'split'"
          aria-keyshortcuts="Alt+2"
          title="Show the source and the Macroplan side by side"
          @click="mode = 'split'"
        >
          Split
        </button>
        <button
          class="btn btn-sm join-item"
          :class="{ 'btn-active': mode === 'macroplan' }"
          :aria-pressed="mode === 'macroplan'"
          aria-keyshortcuts="Alt+3"
          title="Show only the rendered Macroplan"
          @click="mode = 'macroplan'"
        >
          Macroplan
        </button>
      </div>
      <button
        class="btn btn-ghost btn-sm palette-trigger max-sm:btn-square"
        :aria-keyshortcuts="`${paletteAria} ?`"
        title="Run any command from the keyboard"
        @click="paletteOpen = true"
      >
        <svg class="icon sm:hidden" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M7 9a2 2 0 1 1 2 -2v10a2 2 0 1 1 -2 -2h10a2 2 0 1 1 -2 2v-10a2 2 0 1 1 2 2h-10"
          />
        </svg>
        <span class="max-sm:sr-only">Commands</span>
        <span class="keys max-sm:hidden" aria-hidden="true">
          <kbd v-for="k in paletteKeys" :key="k">{{ k }}</kbd>
        </span>
      </button>
      <button
        class="btn btn-ghost btn-sm btn-square"
        :disabled="busy"
        title="Delete this plan"
        aria-label="Delete this plan"
        @click="confirmingDelete = true"
      >
        <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7l16 0" />
          <path d="M10 11l0 6" />
          <path d="M14 11l0 6" />
          <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />
          <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
        </svg>
      </button>
    </header>

    <main class="flex min-h-0 flex-1 flex-col md:flex-row">
      <section
        v-if="showSource"
        class="flex min-h-0 flex-col border-base-300"
        :class="
          showMacroplan ? 'max-md:h-2/5 max-md:border-b md:w-1/3 md:max-w-md md:border-r' : 'flex-1'
        "
      >
        <div class="pane-bar">
          <span class="pane-label">Source (TOML)</span>
        </div>
        <PlanEditor
          ref="editor"
          v-model="source"
          :error="error"
          :hints="hints"
          class="min-h-0 flex-1"
        />
      </section>

      <section v-if="showMacroplan" class="flex min-h-0 min-w-0 flex-1 flex-col">
        <div class="pane-bar">
          <span class="pane-label">Macroplan</span>
          <span v-if="plan && error" class="stale" role="status">
            <span aria-hidden="true">⚠</span> Last valid version
          </span>
          <span class="flex-1"></span>
          <template v-if="plan">
            <button
              class="btn btn-ghost btn-sm"
              :disabled="busy"
              title="Copy the rendered plan to the clipboard as a PNG"
              @click="copyPng(exportRoot)"
            >
              <span v-if="busy" class="loading loading-spinner loading-xs"></span>
              <svg v-else class="size-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M7 9.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z"
                />
                <path
                  d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1"
                />
              </svg>
              Copy PNG
            </button>
            <button
              class="btn btn-ghost btn-sm"
              :disabled="busy"
              title="Download the rendered plan as a PNG"
              @click="downloadPng(exportRoot, exportFilename(plan?.title ?? ''))"
            >
              <svg class="size-4" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" />
                <path d="M7 11l5 5l5 -5" />
                <path d="M12 4l0 12" />
              </svg>
              <span class="max-sm:sr-only">Download</span>
            </button>
          </template>
        </div>

        <div class="min-h-0 flex-1 overflow-auto px-4 pb-4">
          <div v-if="plan" ref="exportRoot" class="export-root">
            <PlanHeader :plan="plan" />
            <MacroplanGrid :plan="plan" :expanded="expanded" @toggle="toggleExpanded" />
          </div>
          <div v-else class="empty" role="status">
            <p class="text-base font-semibold">Nothing to draw yet</p>
            <p class="text-sm text-ink-muted">
              The source has an error. Fix it and the Macroplan redraws as you type.
            </p>
            <pre v-if="!showSource && error" class="empty-error">{{ error }}</pre>
            <button v-if="!showSource" class="btn btn-sm btn-primary" @click="mode = 'split'">
              Show the source
            </button>
          </div>
        </div>
      </section>
    </main>

    <dialog class="modal" :class="{ 'modal-open': confirmingDelete }">
      <div class="modal-box">
        <h3 class="text-base font-semibold">Delete "{{ activeName }}"?</h3>
        <p class="py-2 text-sm text-base-content/70">
          This removes the plan from your library. Download its .toml first if you want to keep it.
        </p>
        <div class="modal-action">
          <button ref="cancelDelete" class="btn btn-sm" @click="confirmingDelete = false">
            Cancel
          </button>
          <button class="btn btn-sm btn-error" @click="confirmDelete">Delete</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="confirmingDelete = false">
        <button>close</button>
      </form>
    </dialog>

    <CommandPalette :open="paletteOpen" :commands="commands" @close="paletteOpen = false" />

    <div v-if="toast" class="toast toast-end">
      <div class="alert" :class="toast.kind === 'ok' ? 'alert-success' : 'alert-error'">
        <span>{{ toast.text }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Both panes open on the same 2.5rem bar, so their content starts on one line. */
.pane-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 2.5rem;
  padding: 0.25rem 1rem;
}
.pane-label {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-ink-muted);
}
.stale {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-ink-warning);
}
.icon,
.pane-bar svg {
  width: 1rem;
  height: 1rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.palette-trigger {
  gap: 0.5rem;
  font-weight: 500;
}
.keys {
  display: inline-flex;
  gap: 0.125rem;
}
.keys kbd {
  display: inline-grid;
  place-items: center;
  min-width: 1.25rem;
  height: 1.25rem;
  padding: 0 0.25rem;
  border: 1px solid var(--color-base-300);
  border-bottom-width: 2px;
  border-radius: 0.25rem;
  background: var(--color-base-200);
  font-size: 0.6875rem;
  color: var(--color-ink-muted);
}
.empty {
  display: grid;
  justify-items: start;
  gap: 0.5rem;
  max-width: 36rem;
  padding: 1.5rem;
  border: 1px dashed var(--color-base-300);
  border-radius: var(--radius-box);
  background: var(--color-base-100);
}
.empty-error {
  max-width: 100%;
  white-space: pre-wrap;
  font-size: 0.75rem;
  color: var(--color-ink-error);
}
/* While exporting, grow to the timeline's full width and un-clip the grid so the
   captured PNG shows every week column (not just the on-screen scroll window).
   The base-200 frame + padding give the snapshot a little breathing room. */
.export-root.exporting {
  width: max-content;
  padding: 1rem 1.25rem;
  background: var(--color-base-200);
}
.export-root.exporting :deep(.macroplan) {
  overflow: visible;
}
/* A PNG has no hover, so text that ellipses on screen (feature names, Learnings,
   Problems and Countermeasures) must wrap to its full length in the capture instead of being cut.
   The column width is unchanged, so the milestone band stays aligned. */
.export-root.exporting :deep(.namecell .truncate),
.export-root.exporting :deep(.learncell .celltext) {
  white-space: normal;
  overflow: visible;
}
</style>
