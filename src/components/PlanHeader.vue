<script setup lang="ts">
import { computed } from "vue"
import type { Plan } from "../model/types"
import { tallyPlan } from "../model/plan"
import { weekLabel } from "../model/week"

const props = defineProps<{ plan: Plan }>()

const tally = computed(() => tallyPlan(props.plan))

const span = computed(() => {
  const w = props.plan.weeks
  const n = w.length
  if (n === 0) return "No weeks yet"
  return `${weekLabel(w[0])} → ${weekLabel(w[n - 1])} · ${n} week${n === 1 ? "" : "s"}`
})

// The legend's own vocabulary, so the readout and the grid speak the same
// glyphs. Zero counts are dropped: the line only names what is in the plan.
const items = computed(() => {
  const t = tally.value
  return [
    { n: t.onTime, glyph: "◉", cls: "text-ink-success", label: "on time" },
    { n: t.late, glyph: "▲", cls: "text-ink-error", label: "late" },
    { n: t.offTrack, glyph: "", cls: "", label: "off track", fill: "chip-off-track" },
    { n: t.atRisk, glyph: "", cls: "", label: "at risk", fill: "chip-at-risk" },
    { n: t.onTrack, glyph: "●", cls: "text-ink-success", label: "on track" },
    { n: t.inFlight, glyph: "○", cls: "text-ink-muted", label: "in flight" },
  ].filter((i) => i.n > 0)
})
</script>

<template>
  <header class="plan-header">
    <h2 class="plan-title">{{ plan.title }}</h2>
    <p class="plan-span">
      {{ span }} · {{ tally.features }} feature{{ tally.features === 1 ? "" : "s" }}
    </p>
    <ul v-if="items.length || tally.milestones" class="readout" aria-label="Plan status">
      <li v-for="i in items" :key="i.label" :class="i.fill && ['fill', i.fill]">
        <span v-if="i.glyph" class="glyph" :class="i.cls" aria-hidden="true">{{ i.glyph }}</span>
        <b>{{ i.n }}</b> {{ i.label }}
      </li>
      <li v-if="tally.milestones" class="ms" :class="{ 'has-unmet': tally.unmetMilestones }">
        <span class="glyph" aria-hidden="true">◆</span>
        <template v-if="tally.unmetMilestones">
          <b>{{ tally.unmetMilestones }}</b> of {{ tally.milestones }} milestone{{
            tally.milestones === 1 ? "" : "s"
          }}
          unmet
        </template>
        <template v-else>
          all {{ tally.milestones }} milestone{{ tally.milestones === 1 ? "" : "s" }} met
        </template>
      </li>
    </ul>
  </header>
</template>

<style scoped>
.plan-header {
  display: grid;
  gap: 0.25rem;
  margin-bottom: 1rem;
}
.plan-title {
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.01em;
  color: var(--color-base-content);
  overflow-wrap: anywhere;
}
.plan-span {
  font-size: 0.75rem;
  color: var(--color-ink-muted);
  font-variant-numeric: tabular-nums;
}
.readout {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1rem;
  margin-top: 0.25rem;
  font-size: 0.8125rem;
  font-variant-ligatures: none;
}
.readout li {
  display: inline-flex;
  align-items: baseline;
  gap: 0.375rem;
  white-space: nowrap;
}
.readout b {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
/* Trouble leads the readout as the same filled pills the grid's chips use. */
.readout .fill {
  padding: 0 0.5rem;
  border-radius: 9999px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-size: 0.75rem;
  line-height: 1.6;
}
.readout .ms {
  padding-left: 1rem;
  border-left: 1px solid var(--color-base-300);
}
.readout .ms .glyph {
  color: var(--color-ink-muted);
}
.readout .ms.has-unmet,
.readout .ms.has-unmet .glyph {
  color: var(--color-ink-error);
}
</style>
