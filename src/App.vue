<script setup lang="ts">
import { ref, computed, watch, watchEffect, nextTick, onMounted, onBeforeUnmount } from "vue"
import { useMacroplan } from "./composables/useMacroplan"
import { usePngExport, exportFilename, canShareFiles } from "./composables/usePngExport"
import { sourceFilename, downloadSource } from "./composables/useSourceExport"
import PlanEditor from "./components/PlanEditor.vue"
import MacroplanGrid from "./components/MacroplanGrid.vue"
import PlanSwitcher from "./components/PlanSwitcher.vue"
import PlanHeader from "./components/PlanHeader.vue"
import CommandPalette, { type Command } from "./components/CommandPalette.vue"
import FeatureSheet from "./components/FeatureSheet.vue"
import { featureFacts } from "./model/facts"
import { useMedia, NARROW, TOUCH } from "./composables/useMedia"
import { useTheme } from "./composables/useTheme"
import { useSplitPane } from "./composables/useSplitPane"
import { matches, isTypingTarget, chordKeys, ariaChord, type Chord } from "./composables/shortcuts"

const {
  source,
  plan,
  error,
  hints,
  versionHint,
  expanded,
  toggleExpanded,
  setExpanded,
  plans,
  activeId,
  selectPlan,
  newPlan,
  startTutorial,
  archivePlan,
  archived,
  restorePlan,
} = useMacroplan()
const { busy, toast, holdToast, releaseToast, copyPng, downloadPng, sharePng } = usePngExport()

const exportRoot = ref<HTMLElement>()
// A trailing newline closes the last line rather than opening an empty one.
const lineCount = computed(() => {
  const text = source.value.replace(/\n$/, "")
  return text === "" ? 0 : text.split("\n").length
})
const editor = ref<InstanceType<typeof PlanEditor>>()
const paletteOpen = ref(false)

// Which panes are visible: the Source editor, the rendered Macroplan, or both.
// Kept in the URL (?view=…) so a layout is shareable/bookmarkable, not persisted.
type ViewMode = "source" | "split" | "macroplan"

function readViewMode(): ViewMode {
  const v = new URLSearchParams(location.search).get("view")
  return v === "source" || v === "macroplan" ? v : "split"
}

const mode = ref<ViewMode>(readViewMode())

// A phone is for reading and has no room side by side: Split falls back to
// the Macroplan there, and its button is hidden.
const narrow = useMedia(NARROW)
const touch = useMedia(TOUCH)
watchEffect(() => {
  if (narrow.value && mode.value === "split") mode.value = "macroplan"
})
const showSource = computed(() => mode.value !== "macroplan")
const showMacroplan = computed(() => mode.value !== "source")
const editMode = () => (narrow.value ? "source" : "split")

const mainEl = ref<HTMLElement>()
const sourcePane = ref<HTMLElement>()
const split = useSplitPane(mainEl, sourcePane)

// The Feature whose details are open, by name. Cleared on a plan switch, and
// the sheet closes by itself if an edit removes the Feature.
const inspecting = ref<string | null>(null)
const inspected = computed(() =>
  inspecting.value && plan.value ? featureFacts(plan.value, inspecting.value) : undefined,
)
watch(activeId, () => (inspecting.value = null))

// Share replaces Copy where it exists: phones share files, and rarely let a
// page put an image on the clipboard.
const canShare = touch.value && canShareFiles()

function sharePlanPng() {
  const title = plan.value?.title ?? activeName.value
  sharePng(exportRoot.value, exportFilename(title), title)
}

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

// Archive acts at once and offers Undo, rather than asking first: the risk is
// regretting it a minute later, which a confirm dialog never covered. The toast
// fades, but the plan stays in the Archive until the next one replaces it —
// and the toast says when that replacement deletes a plan for good.
const undoToast = ref<{ name: string; evicted: string | null } | null>(null)
let undoTimer: ReturnType<typeof setTimeout> | undefined
const UNDO_MS = 8000

function hideUndoLater() {
  clearTimeout(undoTimer)
  undoTimer = setTimeout(() => (undoToast.value = null), UNDO_MS)
}

function holdUndo() {
  clearTimeout(undoTimer)
}

function releaseUndo() {
  if (undoToast.value) hideUndoLater()
}

function archive(id: string) {
  const name = plans.value.find((p) => p.id === id)?.name ?? "Untitled"
  const evicted = archivePlan(id)
  undoToast.value = { name, evicted }
  hideUndoLater()
}

function restoreArchived() {
  restorePlan()
  clearTimeout(undoTimer)
  undoToast.value = null
}

// ── Keyboard layer ───────────────────────────────────────────────────────────
// One list drives both the palette and the global shortcuts, so a chord shown
// in the palette is always the chord that works.

const PALETTE: Chord = { key: "k", mod: true }
// For browsers whose own ⌘K menu item swallows the keypress before the page.
const PALETTE_FALLBACK: Chord = { code: "KeyK", alt: true }

function focusSource() {
  if (!showSource.value) mode.value = editMode()
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

const { theme, choice: themeChoice, choose: chooseTheme, toggle: toggleTheme } = useTheme()
const otherTheme = computed(() => (theme.value === "dark" ? "light" : "dark"))

const commands = computed<Command[]>(() => {
  const list: Command[] = (
    [
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
    ] as Command[]
  ).filter((c) => !(narrow.value && c.id === "view-split"))
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

  list.push({
    id: "theme-toggle",
    group: "View",
    label: `Switch to the ${otherTheme.value} theme`,
    chord: { key: "t" },
    run: toggleTheme,
  })
  if (themeChoice.value) {
    list.push({
      id: "theme-system",
      group: "View",
      label: "Follow the system theme",
      run: () => chooseTheme(null),
    })
  }

  list.push({ id: "new", group: "Plan", label: "New plan", chord: { key: "n" }, run: newPlan })
  list.push({
    id: "tutorial",
    group: "Plan",
    label: "Start the tutorial: learn to write a plan",
    run: () => startTutorial(),
  })
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
    id: "archive",
    group: "Plan",
    label: `Archive “${activeName.value}”`,
    run: () => archive(activeId.value),
  })
  if (archived.value) {
    list.push({
      id: "restore",
      group: "Plan",
      label: `Restore “${archived.value.name}” from the Archive`,
      run: restoreArchived,
    })
  }

  if (plan.value && !busy.value) {
    if (canShare) {
      list.push({
        id: "share-png",
        group: "Export",
        label: "Share the Macroplan as PNG",
        run: sharePlanPng,
      })
    }
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
    chord: { key: "s" },
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
  if (paletteOpen.value || inspecting.value) return // their own dialogs handle their keys
  if (matches(e, PALETTE) || matches(e, PALETTE_FALLBACK)) {
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
const paletteAria = `${ariaChord(PALETTE)} ${ariaChord(PALETTE_FALLBACK)}`
</script>

<template>
  <div class="flex h-dvh flex-col bg-base-200 font-sans text-base-content">
    <header class="navbar min-h-0 gap-2 border-b border-base-300 bg-base-100 px-4 py-2">
      <img src="/favicon.svg" alt="" class="size-6 max-sm:hidden" />
      <div class="min-w-0 flex-1">
        <PlanSwitcher
          :plans="plans"
          :active-id="activeId"
          @select="selectPlan"
          @new="newPlan"
          @download="downloadToml"
          :archived="archived"
          @archive="archive"
          @restore="restoreArchived"
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
          class="btn btn-sm join-item max-md:hidden"
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
        class="btn btn-ghost btn-sm btn-square"
        :aria-label="`Switch to the ${otherTheme} theme`"
        aria-keyshortcuts="T"
        :title="`Switch to the ${otherTheme} theme`"
        @click="toggleTheme"
      >
        <!-- The icon shows where the button goes: a moon on light, a sun on dark. -->
        <svg v-if="theme === 'light'" class="icon" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z"
          />
        </svg>
        <svg v-else class="icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" />
          <path
            d="M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7"
          />
        </svg>
      </button>
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
        <span class="keys inline-flex max-sm:hidden" aria-hidden="true">
          <kbd v-for="k in paletteKeys" :key="k">{{ k }}</kbd>
        </span>
      </button>
    </header>

    <main ref="mainEl" class="flex min-h-0 flex-1 flex-col md:flex-row">
      <section
        v-if="showSource"
        id="source-pane"
        ref="sourcePane"
        class="flex min-h-0 flex-col border-base-300"
        :class="showMacroplan ? 'source-split max-md:h-2/5 max-md:border-b' : 'flex-1'"
        :style="showMacroplan ? split.style.value : undefined"
      >
        <div class="pane-bar">
          <span class="pane-label">Source (TOML)</span>
          <span class="flex-1"></span>
          <span class="line-count">{{ lineCount }} {{ lineCount === 1 ? "line" : "lines" }}</span>
        </div>
        <PlanEditor
          ref="editor"
          v-model="source"
          :error="error"
          :hints="hints"
          :version-hint="versionHint"
          class="min-h-0 flex-1"
        />
      </section>

      <div
        v-if="showSource && showMacroplan"
        class="splitter max-md:hidden"
        :class="{ dragging: split.dragging.value }"
        role="separator"
        tabindex="0"
        aria-orientation="vertical"
        aria-controls="source-pane"
        aria-label="Resize the source pane"
        :aria-valuenow="split.percent.value"
        aria-valuemin="0"
        aria-valuemax="100"
        title="Drag to resize · double-click to reset"
        @pointerdown="split.startDrag"
        @dblclick="split.reset"
        @keydown="split.onKey"
      ></div>

      <section v-if="showMacroplan" class="flex min-h-0 min-w-0 flex-1 flex-col">
        <div class="pane-bar">
          <span class="pane-label">Macroplan</span>
          <span v-if="plan && error" class="stale" role="status">
            <span aria-hidden="true">⚠</span> Last valid version
          </span>
          <span class="flex-1"></span>
          <template v-if="plan">
            <button
              v-if="canShare"
              class="btn btn-ghost btn-sm"
              :disabled="busy"
              title="Share the rendered plan as a PNG"
              @click="sharePlanPng"
            >
              <span v-if="busy" class="loading loading-spinner loading-xs"></span>
              <svg v-else class="size-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M8 9h-1a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-8a2 2 0 0 0 -2 -2h-1"
                />
                <path d="M12 14v-11" />
                <path d="M9 6l3 -3l3 3" />
              </svg>
              Share
            </button>
            <button
              v-else
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
            <MacroplanGrid
              :key="activeId"
              :plan="plan"
              :expanded="expanded"
              :compact="narrow"
              @toggle="toggleExpanded"
              @inspect="inspecting = $event"
            />
          </div>
          <div v-else class="empty" role="status">
            <p class="text-base font-semibold">Nothing to draw yet</p>
            <p class="text-sm text-ink-muted">
              The source has an error. Fix it and the Macroplan redraws as you type.
            </p>
            <pre v-if="!showSource && error" class="empty-error">{{ error }}</pre>
            <button v-if="!showSource" class="btn btn-sm btn-primary" @click="mode = editMode()">
              Show the source
            </button>
          </div>
        </div>
      </section>
    </main>

    <FeatureSheet :facts="inspected" @close="inspecting = null" />

    <CommandPalette :open="paletteOpen" :commands="commands" @close="paletteOpen = false" />

    <!-- The live region stays mounted so screen readers announce each toast. -->
    <div class="toast toast-end" role="status">
      <Transition name="toast">
        <div
          v-if="toast"
          class="alert"
          :class="toast.kind === 'ok' ? 'alert-success' : 'alert-error'"
          @pointerenter="holdToast"
          @pointerleave="releaseToast"
          @focusin="holdToast"
          @focusout="releaseToast"
        >
          <span>{{ toast.text }}</span>
        </div>
      </Transition>
      <Transition name="toast">
        <div
          v-if="undoToast"
          class="alert undo"
          @pointerenter="holdUndo"
          @pointerleave="releaseUndo"
          @focusin="holdUndo"
          @focusout="releaseUndo"
        >
          <div class="min-w-0">
            <p class="truncate">Archived “{{ undoToast.name }}”</p>
            <p v-if="undoToast.evicted" class="truncate text-xs text-ink-muted">
              “{{ undoToast.evicted }}” left the Archive for good.
            </p>
          </div>
          <button class="btn btn-sm btn-primary" @click="restoreArchived">Undo</button>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
/* Split view: wide enough for a commented TOML line (~88 columns of the
   0.8rem editor monospace) at desktop sizes, never crowding out the Macroplan.
   A width dragged on the splitter overrides the default through --source-w;
   min/max keep it in bounds as the window resizes. Values match useSplitPane. */
@media (min-width: 48rem) {
  .source-split {
    flex: none;
    width: var(--source-w, clamp(22rem, 45%, 46rem));
    min-width: min(20rem, 50%);
    max-width: max(20rem, calc(100% - 24rem));
  }
}
/* The visible rule is the pane border: 1px, widening to the accent on hover,
   focus or drag. The hit area is wider than it looks, and wider still for a
   finger. */
.splitter {
  position: relative;
  z-index: 1;
  flex: none;
  width: 1px;
  margin-inline: -0.375rem;
  padding-inline: 0.375rem;
  box-sizing: content-box;
  background: var(--color-base-300);
  background-clip: content-box;
  cursor: col-resize;
  touch-action: none;
  outline: none;
  transition: background-color var(--dur-fast) var(--ease-out);
}
@media (pointer: coarse) {
  .splitter {
    margin-inline: -0.75rem;
    padding-inline: 0.75rem;
  }
}
.splitter::after {
  content: "";
  position: absolute;
  inset-block: 0;
  left: 50%;
  width: 3px;
  translate: -50% 0;
  background: var(--color-primary);
  opacity: 0;
  transition: opacity var(--dur-fast) var(--ease-out);
}
.splitter:hover::after,
.splitter.dragging::after {
  opacity: 1;
}
.splitter:focus-visible::after {
  opacity: 1;
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
.splitter.dragging {
  transition: none;
}
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
.line-count {
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
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
/* No `display` here: unlayered scoped CSS would beat the `max-sm:hidden`
   utility, which lives in a cascade layer. */
.keys {
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
/* Export acknowledgement: rises 8px from the corner it lives in, leaves the
   way it came, faster. Reduced motion keeps the fade. */
.toast {
  pointer-events: none;
}
.toast > .alert {
  pointer-events: auto;
  animation: none;
}
/* Archiving is not a success: the Undo toast stays neutral, its button the accent. */
.undo {
  max-width: min(24rem, calc(100vw - 2rem));
  grid-auto-flow: column;
  grid-template-columns: minmax(0, 1fr) auto;
  border-color: var(--color-base-300);
  background: var(--color-base-100);
}
.toast-enter-active {
  transition:
    opacity var(--dur-base) var(--ease-out),
    translate var(--dur-base) var(--ease-out);
}
.toast-leave-active {
  transition:
    opacity var(--dur-exit-base) var(--ease-out),
    translate var(--dur-exit-base) var(--ease-out);
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  translate: 0 8px;
}
@media (prefers-reduced-motion: reduce) {
  .toast-enter-from,
  .toast-leave-to {
    translate: none;
  }
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
