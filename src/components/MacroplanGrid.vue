<script setup lang="ts">
import { computed } from 'vue'
import type { Plan, FeatureRow, MarkerKind } from '../model/types'
import { weekLabel, type WeekId } from '../model/week'

const props = defineProps<{ plan: Plan }>()

type Tone = 'success' | 'warning' | 'error' | 'neutral'

const GLYPH: Record<MarkerKind, string> = {
  original: '◯',
  reestimate: '△',
  'delivered-on-time': '◉',
  'delivered-late': '▲',
}
const MARKER_CLASS: Record<MarkerKind, string> = {
  original: 'text-base-content/50',
  reestimate: 'text-warning',
  'delivered-on-time': 'text-success',
  'delivered-late': 'text-error',
}
// When two markers land on the same week, the higher rank owns the cell.
const RANK: Record<MarkerKind, number> = {
  'delivered-late': 3,
  'delivered-on-time': 3,
  reestimate: 2,
  original: 1,
}
const TONE_TEXT: Record<Tone, string> = {
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error',
  neutral: 'text-primary',
}
const TONE_BORDER: Record<Tone, string> = {
  success: 'border-success',
  warning: 'border-warning',
  error: 'border-error',
  neutral: 'border-primary',
}
const TONE_DOT: Record<Tone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
  neutral: 'bg-base-300',
}

const weeks = computed(() => props.plan.weeks)

const gridStyle = computed(() => ({
  gridTemplateColumns: `minmax(7rem, max-content) repeat(${weeks.value.length}, var(--wk)) minmax(9rem, 1fr)`,
}))

function tone(row: FeatureRow): Tone {
  if (row.delivered) return row.onTime ? 'success' : 'error'
  if (row.status === 'green') return 'success'
  if (row.status === 'orange') return 'warning'
  if (row.status === 'red') return 'error'
  return 'neutral'
}

function statusWord(row: FeatureRow): string {
  return row.status === 'green'
    ? 'on track'
    : row.status === 'orange'
      ? 'at risk'
      : row.status === 'red'
        ? 'blocked'
        : 'in flight'
}

function markerAt(row: FeatureRow, w: WeekId): MarkerKind | null {
  let best: MarkerKind | null = null
  for (const m of row.markers) {
    if (m.week === w && (best === null || RANK[m.kind] > RANK[best])) best = m.kind
  }
  return best
}

interface Cell {
  // how far the bar line runs within this cell: none, half-from-center-right,
  // half-from-left-to-center, or full width
  line: 'none' | 'right' | 'left' | 'full'
  isStart: boolean
  glyph: string
  glyphCls: string
}

// rows × weeks render matrix, computed once.
const matrix = computed<Cell[][]>(() =>
  props.plan.rows.map((row) =>
    weeks.value.map((w) => {
      const m = markerAt(row, w)
      const inBar = w >= row.startWeek && w <= row.barEndWeek
      let line: Cell['line'] = 'none'
      if (inBar) {
        const isStart = w === row.startWeek
        const isEnd = w === row.barEndWeek
        // line runs center→edge so it begins and ends at a glyph centre,
        // never stubbing past the first/last symbol
        line = isStart && isEnd ? 'none' : isStart ? 'right' : isEnd ? 'left' : 'full'
      }
      return {
        line,
        isStart: inBar && w === row.startWeek,
        glyph: m ? GLYPH[m] : '',
        glyphCls: m ? MARKER_CLASS[m] : '',
      }
    }),
  ),
)

// Per-week column metadata for headers + the now / milestone vertical rules.
const cols = computed(() =>
  weeks.value.map((w) => ({
    w,
    label: weekLabel(w),
    isNow: props.plan.nowInRange && w === props.plan.nowWeek,
    milestones: props.plan.milestones.filter((m) => m.week === w),
  })),
)

function colClass(i: number): string {
  const c = cols.value[i]
  if (c.isNow) return 'col-now'
  if (c.milestones.length) return 'col-ms'
  return ''
}

function milestoneTitle(ms: Plan['milestones']): string {
  return ms
    .map((m) => (m.unmet.length ? `${m.name} — unmet: ${m.unmet.join(', ')}` : `${m.name} — all met`))
    .join(' · ')
}
</script>

<template>
  <div class="overflow-auto rounded-box border border-base-300 bg-base-100">
    <div class="plan-grid" :style="gridStyle">
      <!-- header row -->
      <div class="hcell corner">{{ plan.title }}</div>
      <div
        v-for="(c, ci) in cols"
        :key="'h-' + c.w"
        class="hcell wkhead"
        :class="[colClass(ci), { 'now-head': c.isNow }]"
      >
        <span class="wklabel">{{ c.label }}</span>
        <span v-if="c.isNow" class="badge-now">now</span>
        <span
          v-else-if="c.milestones.length"
          class="badge-ms"
          :title="milestoneTitle(c.milestones)"
        >◆ {{ c.milestones[0].name
          }}<span v-if="c.milestones.some((m) => m.unmet.length)" class="text-error"> !</span></span>
      </div>
      <div class="hcell learnhead">Learning / Status</div>

      <!-- feature rows -->
      <template v-for="(row, ri) in plan.rows" :key="row.name">
        <div class="namecell border-l-4" :class="TONE_BORDER[tone(row)]">
          <span class="truncate">{{ row.name }}</span>
        </div>
        <div
          v-for="(cell, ci) in matrix[ri]"
          :key="row.name + '-' + ci"
          class="cell"
          :class="colClass(ci)"
        >
          <i v-if="cell.line !== 'none'" class="bar" :class="[cell.line, TONE_TEXT[tone(row)]]"></i>
          <i v-if="cell.isStart" class="riser" :class="TONE_TEXT[tone(row)]"></i>
          <span v-if="cell.glyph" class="glyph" :class="cell.glyphCls">{{ cell.glyph }}</span>
        </div>
        <div class="learncell">
          <template v-if="row.delivered">
            <span v-if="row.learning" class="note">{{ row.learning }}</span>
            <span v-else class="muted">{{ row.onTime ? 'delivered on time' : 'delivered late' }}</span>
          </template>
          <template v-else>
            <span class="dot" :class="TONE_DOT[tone(row)]"></span>
            <span class="note" :title="row.note || ''">{{ row.note || statusWord(row) }}</span>
          </template>
        </div>
      </template>
    </div>
  </div>

  <!-- legend -->
  <div class="legend">
    <span><b class="text-base-content/50">◯</b> original estimate</span>
    <span><b class="text-warning">△</b> re-estimate</span>
    <span><b class="text-success">◉</b> on time</span>
    <span><b class="text-error">▲</b> late</span>
    <span><b>┣━</b> feature bar</span>
    <span><b class="text-error">◆</b> milestone</span>
    <span><b class="now-swatch"></b> today</span>
  </div>
</template>

<style scoped>
.plan-grid {
  --wk: 3.5rem;
  display: grid;
  width: max-content;
  min-width: 100%;
  font-variant-ligatures: none;
}

.hcell {
  position: sticky;
  top: 0;
  z-index: 20;
  background: var(--color-base-200);
  border-bottom: 1px solid var(--color-base-300);
  padding: 0.4rem 0.5rem;
  font-size: 0.7rem;
  font-weight: 600;
  white-space: nowrap;
}
.corner {
  left: 0;
  z-index: 30;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
}
.wkhead {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.15;
  padding-inline: 0.15rem;
}
.wklabel {
  font-variant-numeric: tabular-nums;
}
.now-head {
  color: var(--color-primary);
}
.badge-now {
  font-size: 0.58rem;
  font-weight: 700;
  color: var(--color-primary);
}
.badge-ms {
  font-size: 0.58rem;
  font-weight: 600;
  max-width: 6rem;
  overflow: hidden;
  text-overflow: ellipsis;
}
.learnhead {
  text-align: left;
}

.namecell {
  position: sticky;
  left: 0;
  z-index: 10;
  background: var(--color-base-100);
  display: flex;
  align-items: center;
  min-height: 2rem;
  padding: 0 0.6rem;
  font-size: 0.8rem;
  font-weight: 500;
  border-bottom: 1px solid var(--color-base-200);
}
.namecell .truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cell {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 2rem;
  border-bottom: 1px solid var(--color-base-200);
}
.bar {
  position: absolute;
  top: 50%;
  height: 2px;
  transform: translateY(-50%);
  background: currentColor;
  opacity: 0.55;
}
.bar.full {
  left: 0;
  right: 0;
}
.bar.left {
  left: 0;
  right: 50%;
} /* enters from the left, stops at the glyph */
.bar.right {
  left: 50%;
  right: 0;
} /* starts at the first glyph, runs right */
.riser {
  position: absolute;
  left: 50%;
  top: 28%;
  bottom: 28%;
  width: 2px;
  transform: translateX(-50%);
  background: currentColor;
  opacity: 0.55;
}
.glyph {
  position: relative;
  z-index: 1;
  font-size: 0.95rem;
  line-height: 1;
  padding: 0 0.18rem;
  /* halo so the bar reads as passing behind, not through, the symbol */
  background: var(--color-base-100);
  border-radius: 0.3rem;
}

.learncell {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 2rem;
  padding: 0 0.6rem;
  font-size: 0.72rem;
  border-bottom: 1px solid var(--color-base-200);
}
.learncell .muted {
  opacity: 0.5;
}
.learncell .note {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.8;
}
.dot {
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 9999px;
  flex: none;
}

.cell.col-now {
  background: color-mix(in oklch, var(--color-primary) 9%, var(--color-base-100));
}
.cell.col-now .glyph {
  /* match the column tint so the halo doesn't punch a hole in it */
  background: color-mix(in oklch, var(--color-primary) 9%, var(--color-base-100));
}
.col-ms {
  border-left: 2px dashed color-mix(in oklch, var(--color-base-content) 35%, transparent);
}

.legend {
  margin-top: 0.75rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1.25rem;
  font-size: 0.72rem;
  opacity: 0.85;
}
.legend b {
  font-weight: 700;
}
.now-swatch {
  display: inline-block;
  width: 0.8rem;
  height: 0.8rem;
  vertical-align: -0.1rem;
  border-radius: 0.15rem;
  background: color-mix(in oklch, var(--color-primary) 9%, var(--color-base-100));
  border: 1px solid color-mix(in oklch, var(--color-primary) 30%, var(--color-base-100));
}
</style>
