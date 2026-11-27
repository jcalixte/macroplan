<script setup lang="ts">
import { computed } from "vue"
import type { Plan, FeatureRow, MarkerKind } from "../model/types"
import { visibleRows } from "../model/plan"
import { weekLabel, type WeekId } from "../model/week"

const props = withDefaults(defineProps<{ plan: Plan; expanded?: ReadonlySet<string> }>(), {
  expanded: () => new Set<string>(),
})
const emit = defineEmits<{ toggle: [name: string] }>()

// The rows and Area bands actually drawn: folded parents hide their subtree,
// and band spans are recounted over what is shown (F11).
const shown = computed(() => visibleRows(props.plan, props.expanded))

type Tone = "success" | "warning" | "error" | "neutral"

const GLYPH: Record<MarkerKind, string> = {
  original: "◯",
  reestimate: "△",
  "delivered-on-time": "◉",
  "delivered-late": "▲",
  forecast: "◌",
}
const MARKER_CLASS: Record<MarkerKind, string> = {
  original: "text-base-content/60",
  reestimate: "text-ink-warning",
  "delivered-on-time": "text-ink-success",
  "delivered-late": "text-ink-error",
  forecast: "text-base-content/50", // computed, not committed — drawn muted
}
// When two markers land on the same week, the higher rank owns the cell.
const RANK: Record<MarkerKind, number> = {
  "delivered-late": 3,
  "delivered-on-time": 3,
  reestimate: 2,
  original: 1,
  forecast: 0,
}
const TONE_TEXT: Record<Tone, string> = {
  success: "text-ink-success",
  warning: "text-ink-warning",
  error: "text-ink-error",
  neutral: "text-primary",
}
const TONE_BORDER: Record<Tone, string> = {
  success: "border-ink-success",
  warning: "border-ink-warning",
  error: "border-ink-error",
  neutral: "border-primary",
}
const TONE_CHIP: Record<Tone, string> = {
  success: "text-ink-success",
  warning: "text-ink-warning",
  error: "text-ink-error",
  neutral: "text-ink-muted",
}

// Layout constants (must match the CSS vars --name-w / --wk / --area-w) for
// stacking math. Grid column 1 is the Area gutter, 2 the Feature name, then
// one column per Week — so a Week's 1-based column is its index + 3.
const NAME_W = 16 * 16
const WK = 3.5 * 16
const AREA_W = 2 * 16
const WEEK_COL_1 = 3 // grid column of the first Week
const BAND_CHAR = 6.6 // ≈ Fira Code advance (px) at the band font size

const weeks = computed(() => props.plan.weeks)

// The gutter collapses to zero width when nothing is grouped, so an Area-less
// plan spends no room on it. The column always exists, so column math is
// unconditional — only its width changes.
const hasAreas = computed(() => props.plan.bands.some((b) => b.area != null))
const rootStyle = computed(() => ({ "--area-w": hasAreas.value ? "2rem" : "0rem" }))
const leadW = computed(() => (hasAreas.value ? AREA_W : 0) + NAME_W)

const gridStyle = computed(() => ({
  gridTemplateColumns: `var(--area-w) var(--name-w) repeat(${weeks.value.length}, var(--wk)) minmax(9rem, 1fr)`,
}))

function tone(row: FeatureRow): Tone {
  if (row.delivered) return row.onTime ? "success" : "error"
  if (row.status === "on-track") return "success"
  if (row.status === "at-risk") return "warning"
  if (row.status === "off-track") return "error"
  return "neutral"
}

function statusWord(row: FeatureRow): string {
  return row.status ? row.status.replace("-", " ") : "in flight"
}

// at-risk and off-track rows read `Problem → Countermeasure`; the arrow only
// shows when there is a Countermeasure to point at.
function inTrouble(row: FeatureRow): boolean {
  return row.status === "at-risk" || row.status === "off-track"
}

function troubleTitle(row: FeatureRow): string {
  return `Problem: ${row.problem ?? "not stated"}\nCountermeasure: ${row.countermeasure ?? "none"}`
}

function markerAt(row: FeatureRow, w: WeekId): MarkerKind | null {
  let best: MarkerKind | null = null
  for (const m of row.markers) {
    if (m.week === w && (best === null || RANK[m.kind] > RANK[best])) best = m.kind
  }
  return best
}

interface Cell {
  // how far the bar line runs within this cell: none, center→right,
  // left→center, or full width
  line: "none" | "right" | "left" | "full"
  dashed: boolean // past the latest estimate, up to the Forecast
  isStart: boolean
  glyph: string
  glyphCls: string
}

// rows × weeks render matrix, computed once.
const matrix = computed<Cell[][]>(() =>
  shown.value.rows.map((row) =>
    weeks.value.map((w) => {
      const m = markerAt(row, w)
      const inBar = w >= row.startWeek && w <= row.barEndWeek
      let line: Cell["line"] = "none"
      if (inBar) {
        const isStart = w === row.startWeek
        const isEnd = w === row.barEndWeek
        line = isStart && isEnd ? "none" : isStart ? "right" : isEnd ? "left" : "full"
      }
      const dashed =
        row.committedEndWeek != null &&
        row.forecastWeek != null &&
        w > row.committedEndWeek &&
        w <= row.forecastWeek
      return {
        line,
        dashed,
        isStart: inBar && w === row.startWeek,
        glyph: m ? GLYPH[m] : "",
        glyphCls: m ? MARKER_CLASS[m] : "",
      }
    }),
  ),
)

/** The Break covering a week, if any — the first one authored wins. */
function offAt(w: WeekId) {
  return props.plan.breaks.find((u) => w >= u.from && w <= u.to)
}

// Per-week column metadata for the header + the now / milestone / off column rules.
const cols = computed(() =>
  weeks.value.map((w) => ({
    w,
    label: weekLabel(w),
    isNow: props.plan.nowInRange && w === props.plan.nowWeek,
    isMilestone: props.plan.milestones.some((m) => m.week === w),
    off: offAt(w)?.name,
  })),
)

// Hatching is a background image and the now tint a background colour, so a
// week that is both "now" and off shows both.
function colClass(i: number): string[] {
  const c = cols.value[i]
  const cls: string[] = []
  if (c.isNow) cls.push("col-now")
  else if (c.isMilestone) cls.push("col-ms")
  if (c.off != null) cls.push("col-off")
  return cls
}

interface FlagItem {
  kind: "milestone" | "off"
  name: string
  unmet: string[]
  col: number // 1-based grid column
  text: string
  title: string
}

// Label flags above the axis — milestones and Breaks — greedily
// stacked onto extra rows so labels in nearby weeks never overlap.
const milestoneFlags = computed(() => {
  const ms: FlagItem[] = props.plan.milestones.map((m) => ({
    kind: "milestone",
    name: m.name,
    unmet: m.unmet,
    col: weeks.value.indexOf(m.week) + WEEK_COL_1,
    text: `◆ ${m.name}` + (m.unmet.length ? ` · ${m.unmet.length} unmet` : ""),
    title: m.unmet.length
      ? `${m.name} — unmet: ${m.unmet.join(", ")}`
      : `${m.name} — all required features met`,
  }))
  // An off period is flagged at its first visible week, so one that began
  // before the plan's span is still labelled.
  const off: FlagItem[] = props.plan.breaks.flatMap((u) => {
    const i = weeks.value.findIndex((w) => w >= u.from && w <= u.to)
    if (i < 0) return []
    const span = u.from === u.to ? weekLabel(u.from) : `${weekLabel(u.from)} – ${weekLabel(u.to)}`
    return [
      {
        kind: "off" as const,
        name: u.name,
        unmet: [],
        col: i + WEEK_COL_1,
        text: `▨ ${u.name}`,
        title: `${u.name} — break, ${span}`,
      },
    ]
  })
  const items = [...ms, ...off].filter((x) => x.col >= WEEK_COL_1).sort((a, b) => a.col - b.col)
  const rowEnd: number[] = [] // px x-extent of the last flag placed in each row
  return items.map((x) => {
    const startX = leadW.value + (x.col - WEEK_COL_1) * WK
    const width = x.text.length * BAND_CHAR + 14
    let row = 0
    while (row < rowEnd.length && rowEnd[row] > startX - 6) row++
    rowEnd[row] = startX + width
    return { ...x, row: row + 1 }
  })
})
const bandRows = computed(() => milestoneFlags.value.reduce((n, f) => Math.max(n, f.row), 0))
const bandStyle = computed(() => ({
  gridTemplateColumns: `var(--area-w) var(--name-w) repeat(${weeks.value.length}, var(--wk))`,
  gridTemplateRows: `repeat(${bandRows.value}, 1.15rem)`,
}))
</script>

<template>
  <div
    class="macroplan overflow-auto rounded-box border border-base-300 bg-base-100"
    :style="rootStyle"
  >
    <!-- milestone band: stacked label flags with leader lines down to the axis -->
    <div v-if="milestoneFlags.length" class="ms-band" :style="bandStyle">
      <template v-for="f in milestoneFlags" :key="f.kind + '-' + f.name + '-' + f.col">
        <i
          v-if="f.kind === 'milestone'"
          class="ms-lead"
          :style="{ gridColumn: f.col, gridRow: f.row + ' / -1' }"
        />
        <span
          class="ms-flag"
          :class="{ 'off-flag': f.kind === 'off' }"
          :style="{ gridColumn: f.col, gridRow: f.row }"
          :title="f.title"
        >
          <span v-if="f.kind === 'off'" class="off-icon">▨</span>
          <span v-else class="ms-dia">◆</span> {{ f.name
          }}<span v-if="f.unmet.length" class="ms-unmet"> · {{ f.unmet.length }} unmet</span>
        </span>
      </template>
    </div>

    <div class="plan-grid" :style="gridStyle">
      <!-- header row -->
      <div class="hcell areacorner"></div>
      <div class="hcell corner">Feature</div>
      <div
        v-for="(c, ci) in cols"
        :key="'h-' + c.w"
        class="hcell wkhead"
        :class="[colClass(ci), { 'now-head': c.isNow }]"
        :title="c.off ? `${c.off} — break` : undefined"
      >
        <span class="wklabel">{{ c.label }}</span>
        <span v-if="c.isNow" class="badge-now">now</span>
      </div>
      <div class="hcell learnhead">Status / Learning</div>

      <!-- Area gutter: one cell per band, spanning its Features. Explicitly
           placed, so the auto-flowed feature rows below skip column 1. -->
      <div
        v-for="b in shown.bands"
        :key="'band-' + b.start"
        class="areacell"
        :style="{ gridRow: `${b.start + 2} / span ${b.span}` }"
      >
        <span v-if="b.area" class="arealabel" :title="b.area">{{ b.area }}</span>
      </div>

      <!-- feature rows -->
      <!-- display: contents keeps the cells on the grid; the wrapper only
           exists so hovering any cell can tint the whole row -->
      <div v-for="(row, ri) in shown.rows" :key="row.name" class="row">
        <div
          class="namecell border-l-4"
          :class="TONE_BORDER[tone(row)]"
          :style="{ paddingLeft: `${0.6 + row.depth}rem` }"
        >
          <button
            v-if="row.childCount"
            type="button"
            class="disclosure"
            :aria-expanded="expanded.has(row.name)"
            :aria-label="`${expanded.has(row.name) ? 'Fold' : 'Unfold'} ${row.name}`"
            @click="emit('toggle', row.name)"
          >
            {{ expanded.has(row.name) ? "▾" : "▸" }}
          </button>
          <span class="truncate" :title="row.name">{{ row.name }}</span>
          <span v-if="row.childCount" class="childcount">({{ row.childCount }})</span>
          <span
            v-if="row.outOfOrder"
            class="out-of-order text-ink-warning"
            title="Delivered before an earlier Feature in its chain"
            >⚠</span
          >
        </div>
        <div
          v-for="(cell, ci) in matrix[ri]"
          :key="row.name + '-' + ci"
          class="cell"
          :class="colClass(ci)"
        >
          <i
            v-if="cell.line !== 'none'"
            class="bar"
            :class="[cell.line, TONE_TEXT[tone(row)], { dashed: cell.dashed }]"
          ></i>
          <i v-if="cell.isStart" class="riser" :class="TONE_TEXT[tone(row)]"></i>
          <span v-if="cell.glyph" class="glyph" :class="cell.glyphCls">{{ cell.glyph }}</span>
        </div>
        <div class="learncell">
          <template v-if="row.delivered">
            <template v-if="row.learning">
              <span class="chip" :class="TONE_CHIP[tone(row)]">learned</span>
              <span class="celltext" :title="`Learning: ${row.learning}`">{{ row.learning }}</span>
            </template>
            <span v-else class="muted">{{
              row.onTime ? "delivered on time" : "delivered late"
            }}</span>
          </template>
          <template v-else>
            <span class="chip" :class="TONE_CHIP[tone(row)]">{{ statusWord(row) }}</span>
            <span
              v-if="inTrouble(row) && (row.problem || row.countermeasure)"
              class="celltext trouble"
              :title="troubleTitle(row)"
            >
              <span v-if="row.problem" class="problem">{{ row.problem }}</span>
              <span v-if="row.countermeasure" class="cm-line">
                <span class="arrow" aria-hidden="true">→</span>
                <span class="countermeasure">{{ row.countermeasure }}</span>
              </span>
            </span>
          </template>
        </div>
      </div>
    </div>
  </div>

  <!-- legend -->
  <div class="legend">
    <span><b class="text-base-content/60">◯</b> original estimate</span>
    <span><b class="text-ink-warning">△</b> re-estimate</span>
    <span><b class="text-ink-success">◉</b> on time</span>
    <span><b class="text-ink-error">▲</b> late</span>
    <span><b class="text-base-content/50">◌</b><b class="dash-swatch"></b> forecast</span>
    <span><b>┣━</b> feature bar</span>
    <span><b class="ms-dia">◆</b> milestone</span>
    <span><b class="now-swatch"></b> today</span>
    <span v-if="plan.breaks.length"><b class="off-swatch"></b> break</span>
    <span><i class="legend-problem">problem</i> <b>→</b> countermeasure</span>
  </div>
</template>

<style scoped>
.macroplan {
  --row-bg: var(--color-base-100);
  --row-hover: color-mix(in oklab, var(--color-primary) 7%, var(--color-base-100));
  --name-w: 16rem;
  --wk: 3.5rem;
  --area-w: 0rem; /* set inline: 2rem once any Feature has an Area */
}
.plan-grid {
  display: grid;
  width: max-content;
  min-width: 100%;
  font-variant-ligatures: none;
}

/* ── Milestone band ───────────────────────────────────────────────── */
.ms-band {
  display: grid;
  width: max-content;
  min-width: 100%;
  padding-top: 0.35rem;
  font-variant-ligatures: none;
}
.ms-flag {
  align-self: center;
  white-space: nowrap;
  overflow: visible;
  font-size: 0.6875rem; /* 11px: BAND_CHAR is Fira Code's 0.6em advance at this size */
  font-weight: 600;
  line-height: 1;
  color: var(--color-base-content);
  z-index: 1;
}
.ms-dia {
  color: color-mix(in oklab, var(--color-base-content) 55%, var(--color-base-100));
}
.ms-unmet {
  color: var(--color-ink-error); /* unmet required features = a problem = red */
  font-weight: 700;
}
.ms-lead {
  justify-self: start;
  width: 0;
  border-left: 2px dashed color-mix(in oklab, var(--color-base-content) 30%, var(--color-base-100));
  pointer-events: none;
}

.hcell {
  position: sticky;
  top: 0;
  z-index: 20;
  background: var(--color-base-200);
  border-bottom: 1px solid var(--color-base-300);
  padding: 0.4rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}
.corner {
  left: var(--area-w);
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
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--color-primary);
}
.learnhead {
  text-align: left;
}

/* ── Area gutter ──────────────────────────────────────────────────── */
.areacell {
  grid-column: 1;
  position: sticky;
  left: 0;
  z-index: 15;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding-block: 0.5rem;
  background: var(--color-base-200);
  border-right: 1px solid var(--color-base-300);
}
/* Hairline between bands: without it, two labels in adjacent bands read as one
   run of text. The padding alone leaves a gap; the rule says where it ends. */
.areacell + .areacell {
  border-top: 1px solid var(--color-base-300);
}
/* Reads bottom-to-top, like a chart's Y-axis label — the one dimension a band
   has room in. Truncates (with a title tooltip) for a single-Feature band. */
.arealabel {
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  max-height: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  color: color-mix(in oklab, var(--color-base-content) 70%, var(--color-base-100));
}
.areacorner {
  left: 0;
  z-index: 30;
}

/* Reading guide: a long plan puts 26 weeks between a name and its Status or Learning, so the
   row under the pointer takes a faint brand tint, sticky name cell included. */
.row {
  display: contents;
}
.row:hover {
  --row-bg: var(--row-hover);
}
.namecell,
.cell,
.learncell {
  --cell-bg: var(--row-bg);
  background-color: var(--cell-bg);
}

.namecell {
  position: sticky;
  left: var(--area-w);
  z-index: 10;
  display: flex;
  align-items: center;
  min-height: 2rem;
  padding: 0 0.6rem;
  font-size: 0.8rem;
  font-weight: 500;
  border-bottom: 1px solid var(--color-base-200);
}
.disclosure {
  position: relative;
  flex: none;
  width: 1rem; /* one indent step, so a child's name lines up under its parent's */
  font-size: 0.75rem;
  line-height: 1;
  color: color-mix(in oklab, var(--color-base-content) 60%, var(--color-base-100));
  cursor: pointer;
}
/* 24×24 hit area (WCAG 2.5.8) around a glyph kept 1rem wide for the indent. */
.disclosure::before {
  content: "";
  position: absolute;
  inset: 50% auto auto 50%;
  width: 1.5rem;
  height: 1.5rem;
  transform: translate(-50%, -50%);
}
.disclosure:hover {
  color: var(--color-primary);
}
.disclosure:focus-visible {
  outline: 2px solid var(--color-primary);
  border-radius: 0.2rem;
}
.childcount {
  flex: none;
  margin-left: 0.3rem;
  font-size: 0.75rem;
  color: var(--color-ink-muted);
}
.out-of-order {
  flex: none;
  margin-left: 0.3rem;
  font-size: 0.75rem;
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
/* Past the latest estimate, up to the Forecast: computed, not committed. */
.bar.dashed {
  background: repeating-linear-gradient(to right, currentColor 0 4px, transparent 4px 7px);
}
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
  background: var(--cell-bg);
  border-radius: 0.3rem;
}

/* Chip in its own column, text beside it. Baseline alignment pins the chip to
   the first line of a two-line Problem → Countermeasure; align-content keeps
   one-line cells vertically centred. */
.learncell {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-content: center;
  align-items: baseline;
  column-gap: 0.5rem;
  min-height: 2rem;
  padding: 0.125rem 0.6rem;
  font-size: 0.75rem;
  border-bottom: 1px solid var(--color-base-200);
}
.learncell .muted {
  color: var(--color-ink-muted);
}
.learncell .celltext {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* The chip names the kind of text that follows: a Status or a Learning. */
.chip {
  flex: none;
  padding: 0 0.35rem;
  border: 1px solid currentColor;
  border-radius: 9999px;
  font-size: 0.625rem;
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
}
/* Problem → Countermeasure, one per line so a long Problem never truncates the
   action. The fact is muted; the action carries the weight. The arrow hangs in
   the gutter under the chip, so both lines start flush. */
.learncell .trouble {
  overflow: visible;
  white-space: normal;
  line-height: 1.25;
}
.trouble .problem,
.trouble .countermeasure {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.trouble .countermeasure {
  font-weight: 500;
}
.cm-line {
  position: relative;
  display: block;
}
.problem + .cm-line .arrow {
  position: absolute;
  right: 100%;
  padding-right: 0.5rem; /* = the learncell column-gap: ends at the chip's edge */
}
/* No Problem stated: the Countermeasure is the first line, arrow inline. */
.cm-line:first-child {
  display: flex;
  gap: 0.3em;
}
.cm-line:first-child .countermeasure {
  min-width: 0;
}
.arrow {
  color: var(--color-ink-muted);
}
.trouble .problem,
.legend-problem {
  color: var(--color-ink-muted);
  font-style: normal;
}

/* "today" — a neutral grey column (red is reserved for problems) */
.cell.col-now {
  --cell-bg: color-mix(in oklab, var(--color-base-content) 7%, var(--row-bg));
}
.col-ms {
  border-left: 2px dashed color-mix(in oklab, var(--color-base-content) 30%, var(--color-base-100));
}

/* Break weeks: hatched, so they still read when they are also "now". */
.cell.col-off,
.hcell.col-off {
  background-image: repeating-linear-gradient(
    135deg,
    color-mix(in oklab, var(--color-base-content) 9%, transparent) 0 2px,
    transparent 2px 6px
  );
}
.off-flag {
  color: color-mix(in oklab, var(--color-base-content) 65%, var(--color-base-100));
  font-weight: 500;
}
.off-icon {
  color: color-mix(in oklab, var(--color-base-content) 45%, var(--color-base-100));
}

.legend {
  margin-top: 0.75rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1.25rem;
  font-size: 0.75rem;
  color: var(--color-ink-muted);
}
.legend b {
  font-weight: 700;
}
.dash-swatch {
  display: inline-block;
  width: 1rem;
  height: 2px;
  margin-left: 0.2rem;
  vertical-align: 0.2rem;
  opacity: 0.55;
  background: repeating-linear-gradient(to right, currentColor 0 4px, transparent 4px 7px);
}
.now-swatch {
  display: inline-block;
  width: 0.8rem;
  height: 0.8rem;
  vertical-align: -0.1rem;
  border-radius: 0.15rem;
  background: color-mix(in oklab, var(--color-base-content) 7%, var(--color-base-100));
  border: 1px solid color-mix(in oklab, var(--color-base-content) 22%, var(--color-base-100));
}
.off-swatch {
  display: inline-block;
  width: 0.8rem;
  height: 0.8rem;
  vertical-align: -0.1rem;
  border-radius: 0.15rem;
  border: 1px solid color-mix(in oklab, var(--color-base-content) 22%, var(--color-base-100));
  background-image: repeating-linear-gradient(
    135deg,
    color-mix(in oklab, var(--color-base-content) 18%, transparent) 0 2px,
    transparent 2px 5px
  );
}
</style>
