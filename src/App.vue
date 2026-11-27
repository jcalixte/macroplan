<script setup lang="ts">
import { ref, computed, watch } from "vue"
import { useMacroplan } from "./composables/useMacroplan"
import { usePngExport, exportFilename } from "./composables/usePngExport"
import { sourceFilename, downloadSource } from "./composables/useSourceExport"
import PlanEditor from "./components/PlanEditor.vue"
import MacroplanGrid from "./components/MacroplanGrid.vue"
import PlanSwitcher from "./components/PlanSwitcher.vue"
import PlanHeader from "./components/PlanHeader.vue"

const {
  source,
  plan,
  error,
  expanded,
  toggleExpanded,
  plans,
  activeId,
  selectPlan,
  newPlan,
  deletePlan,
} = useMacroplan()
const { busy, toast, copyPng, downloadPng } = usePngExport()

const exportRoot = ref<HTMLElement>()
const confirmingDelete = ref(false)

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
          title="Show only the TOML source"
          @click="mode = 'source'"
        >
          Source
        </button>
        <button
          class="btn btn-sm join-item"
          :class="{ 'btn-active': mode === 'split' }"
          :aria-pressed="mode === 'split'"
          title="Show the source and the Macroplan side by side"
          @click="mode = 'split'"
        >
          Split
        </button>
        <button
          class="btn btn-sm join-item"
          :class="{ 'btn-active': mode === 'macroplan' }"
          :aria-pressed="mode === 'macroplan'"
          title="Show only the rendered Macroplan"
          @click="mode = 'macroplan'"
        >
          Macroplan
        </button>
      </div>
      <button
        class="btn btn-ghost btn-sm"
        :disabled="busy"
        title="Delete this plan"
        @click="confirmingDelete = true"
      >
        🗑
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
        <PlanEditor v-model="source" :error="error" class="min-h-0 flex-1" />
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
          <button class="btn btn-sm" @click="confirmingDelete = false">Cancel</button>
          <button class="btn btn-sm btn-error" @click="confirmDelete">Delete</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="confirmingDelete = false">
        <button>close</button>
      </form>
    </dialog>

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
.pane-bar svg {
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
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
/* A PNG has no hover, so text that ellipses on screen (feature names, learning /
   status notes) must wrap to its full length in the capture instead of being cut.
   The column width is unchanged, so the milestone band stays aligned. */
.export-root.exporting :deep(.namecell .truncate),
.export-root.exporting :deep(.learncell .note) {
  white-space: normal;
  overflow: visible;
}
</style>
