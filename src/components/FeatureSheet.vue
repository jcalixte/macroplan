<script setup lang="ts">
import { ref, computed, watch, nextTick, useId } from "vue"
import type { FeatureFacts } from "../model/facts"
import { weekLabel, weeksBetween } from "../model/week"
import { GLYPH, MARKER_CLASS, TONE_TEXT, chipClass } from "./glyphs"
import { rowTone, trouble, stateWord } from "../model/status"

// Everything about one Feature in one place. On a phone it rises as a bottom
// sheet: the grid spreads a Feature over a row, hover titles and a Status
// column 26 weeks to the right, none of which a thumb can read at once.
const props = defineProps<{ facts?: FeatureFacts }>()
const emit = defineEmits<{ close: [] }>()

const dialog = ref<HTMLDialogElement>()
const titleId = useId()

watch(
  () => props.facts,
  async (f) => {
    await nextTick()
    const d = dialog.value
    if (!d) return
    if (f && !d.open) d.showModal()
    else if (!f && d.open) d.close()
  },
  { immediate: true },
)

const row = computed(() => props.facts?.row)

const context = computed(() => {
  const r = row.value
  if (!r) return ""
  return [r.area, r.parent && `in ${r.parent}`].filter(Boolean).join(" · ")
})

// The grid's bar turned upright. Each step carries the weeks since the one
// before it, so a long slip reads as a long gap, not just a later date; the leg
// into a slipped Forecast is dashed, as on the grid.
const steps = computed(() => {
  const f = props.facts
  const r = row.value
  if (!f || !r) return []
  return f.timeline.map((t, i) => {
    const prev = f.timeline[i - 1]
    const slip = t.kind === "forecast" && t.week === r.forecastWeek
    return {
      ...t,
      key: t.kind + t.week + t.label,
      slip,
      gap: prev ? weeksBetween(prev.week, t.week) : 0,
    }
  })
})

function glyphOf(kind: string): string {
  return GLYPH[kind as keyof typeof GLYPH]
}

// A click on the ::backdrop lands on the <dialog> itself.
function onDialogClick(e: MouseEvent) {
  if (e.target === dialog.value) emit("close")
}
</script>

<template>
  <dialog
    ref="dialog"
    class="sheet"
    :aria-labelledby="titleId"
    @cancel.prevent="emit('close')"
    @click="onDialogClick"
  >
    <div v-if="facts && row" class="panel">
      <header class="head">
        <div class="min-w-0">
          <p v-if="context" class="context">{{ context }}</p>
          <h3 :id="titleId" class="name">{{ row.name }}</h3>
        </div>
        <button
          type="button"
          class="close btn btn-ghost btn-square"
          aria-label="Close"
          @click="emit('close')"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18 6l-12 12" />
            <path d="M6 6l12 12" />
          </svg>
        </button>
      </header>

      <p class="state">
        <span class="chip" :class="chipClass(row)">
          {{ stateWord(row) }}
        </span>
        <span v-if="row.slipCount" class="slips">
          re-estimated {{ row.slipCount }} time{{ row.slipCount === 1 ? "" : "s" }}
        </span>
      </p>

      <dl v-if="trouble(row) || row.learning" class="prose">
        <template v-if="trouble(row)">
          <dt>Problem</dt>
          <dd class="problem" :class="{ muted: !row.problem }">
            {{ row.problem ?? "Not stated" }}
          </dd>
          <dt>Countermeasure</dt>
          <dd :class="{ muted: !row.countermeasure }">{{ row.countermeasure ?? "None yet" }}</dd>
        </template>
        <template v-if="row.learning">
          <dt>Learning</dt>
          <dd>{{ row.learning }}</dd>
        </template>
      </dl>

      <section class="block">
        <h4>Timeline</h4>
        <ol class="timeline" :class="TONE_TEXT[rowTone(row)]">
          <li v-for="(t, i) in steps" :key="t.key" :class="{ 'leg-dashed': t.slip }">
            <div v-if="i > 0" class="leg" :style="{ '--weeks': t.gap }">
              <span v-if="t.gap > 0" class="gap">+{{ t.gap }} wk</span>
            </div>
            <span v-if="t.kind === 'start'" class="glyph cap" aria-hidden="true"></span>
            <span v-else class="glyph" :class="MARKER_CLASS[t.kind]" aria-hidden="true">
              <svg v-if="t.slip" class="tri-dash" viewBox="0 0 12 12">
                <path d="M6 1.6 L11 10.4 H1 Z" /></svg
              ><template v-else>{{ glyphOf(t.kind) }}</template>
            </span>
            <span class="what">{{ t.label }}</span>
            <span class="when">{{ weekLabel(t.week) }}</span>
          </li>
        </ol>
      </section>

      <section v-if="facts.milestones.length" class="block milestones">
        <h4>Required by</h4>
        <ul>
          <li v-for="m in facts.milestones" :key="m.name">
            <span class="ms-dia" aria-hidden="true">◆</span>
            <span class="what">{{ m.name }}</span>
            <span class="when">{{ weekLabel(m.week) }}</span>
            <span class="met" :class="m.met ? 'text-ink-success' : 'unmet'">{{
              m.met ? "met" : "unmet"
            }}</span>
          </li>
        </ul>
      </section>

      <ul v-if="row.outOfOrder || facts.troubleBelow || row.childCount" class="notes">
        <li v-if="facts.troubleBelow">
          <span class="dot" :class="`dot-${facts.troubleBelow.level}`" aria-hidden="true"></span>
          {{ facts.troubleBelow.count }} {{ facts.troubleBelow.level.replace("-", " ") }} below
        </li>
        <li v-else-if="row.childCount">
          {{ row.childCount }} sub-feature{{ row.childCount === 1 ? "" : "s" }}, none in trouble
        </li>
        <li v-if="row.outOfOrder">
          <span class="text-ink-warning" aria-hidden="true">⚠</span> Delivered before an earlier
          Feature in its chain
        </li>
      </ul>
    </div>
  </dialog>
</template>

<style scoped>
.sheet {
  width: min(28rem, calc(100vw - 2rem));
  max-width: none;
  max-height: min(40rem, 85dvh);
  margin: auto;
  padding: 0;
  border: 1px solid var(--color-base-300);
  border-radius: var(--radius-box);
  background: var(--color-base-100);
  color: var(--color-base-content);
  box-shadow: 0 24px 48px -12px color-mix(in oklab, black 28%, transparent);
  overflow-y: auto;
  overscroll-behavior: contain;
}
.sheet::backdrop {
  background: color-mix(in oklab, var(--color-base-content) 28%, transparent);
}
/* A phone: a bottom sheet, flush to the edges and within thumb reach. */
@media (max-width: 47.9375rem) {
  .sheet {
    width: 100%;
    margin: auto 0 0;
    border-width: 1px 0 0;
    border-radius: var(--radius-box) var(--radius-box) 0 0;
    padding-bottom: env(safe-area-inset-bottom);
  }
}
.sheet[open] {
  animation: rise var(--dur-base) var(--ease-out);
}
.sheet[open]::backdrop {
  animation: fade var(--dur-base) var(--ease-out);
}
@keyframes rise {
  from {
    opacity: 0;
    translate: 0 1rem;
  }
}
@keyframes fade {
  from {
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  @keyframes rise {
    from {
      opacity: 0;
    }
  }
}

.panel {
  display: grid;
  gap: 1rem;
  padding: 1rem 1rem 1.25rem;
}
.head {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}
.head > div {
  flex: 1;
}
.context {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  color: var(--color-ink-muted);
}
.name {
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.2;
  overflow-wrap: anywhere;
}
.close {
  flex: none;
  width: 2.75rem;
  height: 2.75rem;
  margin: -0.5rem -0.5rem 0 0;
}
.close svg {
  width: 1.25rem;
  height: 1.25rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
}

.state {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
  font-size: 0.8125rem;
}
.slips {
  color: var(--color-ink-muted);
}
/* The shared chip, sized up to lead the sheet. */
.state .chip {
  padding: 0.125rem 0.6rem;
  font-size: 0.75rem;
}

dt,
h4 {
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-ink-muted);
}
.prose dd {
  margin: 0.125rem 0 0.75rem;
  font-size: 1rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.prose dd:last-child {
  margin-bottom: 0;
}
.prose .problem {
  font-weight: 700;
}
.muted {
  color: var(--color-ink-muted);
  font-weight: 400 !important;
}

.block h4 {
  margin-bottom: 0.375rem;
}
/* The grid's bar, turned upright: one rule in the Feature's tone runs through
   its markers, so the timeline reads as the same object as its row. */
.timeline,
.milestones ul {
  display: grid;
  font-size: 0.875rem;
}
.timeline li,
.milestones li {
  position: relative;
  display: grid;
  grid-template-columns: 1.5rem 1fr auto;
  align-items: center;
  column-gap: 0.5rem;
  min-height: 2rem;
}
.milestones li {
  grid-template-columns: 1.5rem 1fr auto auto;
}
/* --rail: the tone, pre-mixed onto the surface so the rule, the cap and any
   overlap between them stay one solid colour. */
.timeline {
  --rail: color-mix(in oklab, currentColor 55%, var(--color-base-100));
}
/* Each step after the first opens with its leg: a row of its own, grown with
   the weeks it spans (capped so a long slip cannot push the sheet off screen),
   that holds the "+N wk" label clear of the step names. The rule runs from the
   centre of the step above to the centre of this one. */
.timeline li {
  --step: 2rem;
  min-height: 0;
  grid-auto-rows: var(--step);
}
.timeline li:has(.leg) {
  grid-template-rows: auto;
}
.timeline .leg {
  position: relative;
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: subgrid;
  align-items: center;
  height: clamp(1.25rem, 0.75rem + var(--weeks) * 0.1875rem, 3.75rem);
}
.timeline .leg::before {
  content: "";
  position: absolute;
  left: calc(0.75rem - 1px);
  top: calc(var(--step) / -2);
  bottom: calc(var(--step) / -2);
  width: 2px;
  background: var(--rail);
}
.timeline li.leg-dashed .leg::before {
  background: repeating-linear-gradient(to bottom, var(--rail) 0 4px, transparent 4px 7px);
}
.timeline .glyph {
  position: relative;
  z-index: 1;
  justify-self: center;
  display: grid;
  place-items: center;
  width: 1.25rem;
  height: 1.25rem;
  font-size: 1rem;
  line-height: 1;
  border-radius: 50%;
  background: var(--color-base-100);
}
/* Start: the grid's riser, turned to cap the top of the upright bar. */
.timeline .cap {
  width: 0.875rem;
  height: 2px;
  border-radius: 0;
  background: var(--rail);
}
/* Weeks since the step above, set beside the leg it measures. */
.timeline .gap {
  grid-column: 2;
  font-size: 0.75rem;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  color: var(--color-ink-muted);
}
.timeline .what,
.milestones .what {
  color: var(--color-base-content);
}
.when {
  font-variant-numeric: tabular-nums;
  color: var(--color-ink-muted);
}
.ms-dia {
  justify-self: center;
  color: var(--color-ink-muted);
}
.met {
  font-size: 0.75rem;
  font-weight: 700;
}
.unmet {
  color: var(--color-ink-error);
}

.notes {
  display: grid;
  gap: 0.375rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-base-300);
  font-size: 0.8125rem;
}
.notes li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
}
.dot-off-track {
  background: var(--color-ink-error);
}
.dot-at-risk {
  background: var(--color-ink-warning);
}
</style>
