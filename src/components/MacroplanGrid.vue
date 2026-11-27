<script setup lang="ts">
import { computed, ref, onMounted, useId } from "vue"
import type { Plan, FeatureRow, MarkerKind } from "../model/types"
import { GLYPH, MARKER_CLASS, TONE_TEXT, TONE_CHIP, chipClass } from "./glyphs"
import { rowTone as tone, trouble, stateWord, type Tone } from "../model/status"
import { troubleBelow, visibleRows } from "../model/plan"
import { weekLabel, type WeekId } from "../model/week"

// `compact` narrows the name and Week columns for a phone, where a 16rem name
// column would leave room for four Weeks.
const props = withDefaults(
  defineProps<{ plan: Plan; expanded?: ReadonlySet<string>; compact?: boolean }>(),
  { expanded: () => new Set<string>(), compact: false },
)
const emit = defineEmits<{ toggle: [name: string]; inspect: [name: string] }>()

// The rows and Area bands actually drawn: folded parents hide their subtree,
// and band spans are recounted over what is shown (F11).
const shown = computed(() => visibleRows(props.plan, props.expanded))

// When two markers land on the same week, the higher rank owns the cell.
const RANK: Record<MarkerKind, number> = {
  "delivered-late": 3,
  "delivered-on-time": 3,
  reestimate: 2,
  original: 1,
  forecast: 0,
}
const TONE_BORDER: Record<Tone, string> = {
  success: "border-ink-success",
  warning: "border-ink-warning",
  error: "border-ink-error",
  neutral: "border-primary",
}

// Layout constants (must match the CSS vars --name-w / --wk / --area-w) for
// stacking math. Grid column 1 is the Area gutter, 2 the Feature name, then
// one column per Week — so a Week's 1-based column is its index + 3.
const NAME_W = computed(() => (props.compact ? 9 : 16) * 16)
const WK = computed(() => (props.compact ? 2.75 : 3.5) * 16)
const AREA_W = 2 * 16
const WEEK_COL_1 = 3 // grid column of the first Week
const BAND_CHAR = 6.6 // ≈ Fira Code advance (px) at the band font size

const weeks = computed(() => props.plan.weeks)

// The gutter collapses to zero width when nothing is grouped, so an Area-less
// plan spends no room on it. The column always exists, so column math is
// unconditional — only its width changes.
const hasAreas = computed(() => props.plan.bands.some((b) => b.area != null))
const rootStyle = computed(() => ({ "--area-w": hasAreas.value ? "2rem" : "0rem" }))
const leadW = computed(() => (hasAreas.value ? AREA_W : 0) + NAME_W.value)

const gridStyle = computed(() => ({
  gridTemplateColumns: `var(--area-w) var(--name-w) repeat(${weeks.value.length}, var(--wk)) minmax(9rem, 1fr)`,
}))

// Status never rolls up, but a folded parent must not hide trouble: it carries
// a dot in the worst descendant's colour. Unfolded, the children speak for
// themselves.
const below = computed(() => troubleBelow(props.plan.rows))

function hiddenTrouble(row: FeatureRow) {
  if (props.expanded.has(row.name)) return undefined
  const t = below.value.get(row.name)
  return t && { ...t, label: `${t.count} ${t.level.replace("-", " ")} below` }
}

// Each Status / Problem / Countermeasure / Learning cell opens a popover with its full
// text, anchored to the cell. The ids are per grid instance, not global.
const uid = useId()
const popId = (ri: number) => `${uid}-status-${ri}`
const anchor = (ri: number) => `--status-${ri}`

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
  slipForecast: boolean // a Forecast after the latest estimate: a dashed △, not ◌
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
        slipForecast: m === "forecast" && w === row.forecastWeek,
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
  detail: string // what the flag's popover says beneath its name
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
    detail: "",
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
        detail: `Break, ${span}`,
      },
    ]
  })
  const items = [...ms, ...off].filter((x) => x.col >= WEEK_COL_1).sort((a, b) => a.col - b.col)
  const rowEnd: number[] = [] // px x-extent of the last flag placed in each row
  return items.map((x) => {
    const startX = leadW.value + (x.col - WEEK_COL_1) * WK.value
    const width = x.text.length * BAND_CHAR + 14
    let row = 0
    while (row < rowEnd.length && rowEnd[row] > startX - 6) row++
    rowEnd[row] = startX + width
    return { ...x, row: row + 1 }
  })
})
const flagPopId = (i: number) => `${uid}-flag-${i}`
const flagAnchor = (i: number) => `--flag-${i}`

// Open on the current Week, one past Week before it, when it would otherwise
// sit off to the right: a reader's first question is "where are we now?". The
// grid remounts per plan, so this runs once per plan, never while typing.
const root = ref<HTMLElement>()
onMounted(() => {
  const el = root.value
  const now = weeks.value.indexOf(props.plan.nowWeek)
  if (!el || !props.plan.nowInRange || now < 1) return
  const visible = el.clientWidth - leadW.value
  if ((now + 1) * WK.value > visible) el.scrollLeft = (now - 1) * WK.value
})

const bandRows = computed(() => milestoneFlags.value.reduce((n, f) => Math.max(n, f.row), 0))
const bandStyle = computed(() => ({
  gridTemplateColumns: `var(--area-w) var(--name-w) repeat(${weeks.value.length}, var(--wk))`,
  gridTemplateRows: `repeat(${bandRows.value}, 1.15rem)`,
}))
</script>

<template>
  <div
    ref="root"
    class="macroplan overflow-auto rounded-box border border-base-300 bg-base-100"
    :class="{ compact }"
    :style="rootStyle"
  >
    <!-- milestone band: stacked label flags with leader lines down to the axis -->
    <div v-if="milestoneFlags.length" class="ms-band" :style="bandStyle">
      <template v-for="(f, fi) in milestoneFlags" :key="f.kind + '-' + f.name + '-' + f.col">
        <i
          v-if="f.kind === 'milestone'"
          class="ms-lead"
          :style="{ gridColumn: f.col, gridRow: f.row + ' / -1' }"
        />
        <!-- A button, not a hover title: on a phone a tap is the only way to
             learn which Features a Milestone is still waiting on. -->
        <button
          type="button"
          class="ms-flag"
          :class="{ 'off-flag': f.kind === 'off' }"
          :style="{ gridColumn: f.col, gridRow: f.row, anchorName: flagAnchor(fi) }"
          :title="f.title"
          :popovertarget="flagPopId(fi)"
        >
          <span v-if="f.kind === 'off'" class="off-icon">▨</span>
          <span v-else class="ms-dia">◆</span> {{ f.name
          }}<span v-if="f.unmet.length" class="ms-unmet"> · {{ f.unmet.length }} unmet</span>
        </button>
        <div
          :id="flagPopId(fi)"
          popover
          class="cellpop"
          :style="{ positionAnchor: flagAnchor(fi) }"
        >
          <p class="popname">{{ f.name }}</p>
          <dl v-if="f.kind === 'milestone'">
            <template v-if="f.unmet.length">
              <dt>Unmet</dt>
              <dd>{{ f.unmet.join(", ") }}</dd>
            </template>
            <dd v-else>All required Features met</dd>
          </dl>
          <p v-else>{{ f.detail }}</p>
        </div>
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
      <div class="hcell learnhead">Status / Problem / Countermeasure / Learning</div>

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
      <div
        v-for="(row, ri) in shown.rows"
        :key="row.name"
        class="row"
        :class="trouble(row) && `row-${trouble(row)}`"
      >
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
            <span class="chevron" aria-hidden="true">▸</span>
          </button>
          <button
            type="button"
            class="namebtn truncate"
            :title="row.name"
            aria-haspopup="dialog"
            @click="emit('inspect', row.name)"
          >
            {{ row.name }}
          </button>
          <span v-if="row.childCount" class="childcount">({{ row.childCount }})</span>
          <span
            v-if="hiddenTrouble(row)"
            class="below"
            :class="`below-${hiddenTrouble(row)!.level}`"
            role="img"
            :title="hiddenTrouble(row)!.label"
            :aria-label="hiddenTrouble(row)!.label"
          ></span>
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
          <span v-if="cell.slipForecast" class="glyph" :class="cell.glyphCls"
            ><svg class="tri-dash" viewBox="0 0 12 12" role="img" aria-label="forecast slip">
              <path d="M6 1.6 L11 10.4 H1 Z" /></svg
          ></span>
          <span v-else-if="cell.glyph" class="glyph" :class="cell.glyphCls">{{ cell.glyph }}</span>
        </div>
        <div class="learncell">
          <template v-if="row.delivered">
            <template v-if="row.learning">
              <span class="chip" :class="TONE_CHIP[tone(row)]">learned</span>
              <button
                type="button"
                class="celltext"
                :popovertarget="popId(ri)"
                :style="{ anchorName: anchor(ri) }"
              >
                <span class="clamp">{{ row.learning }}</span>
              </button>
              <div :id="popId(ri)" popover class="cellpop" :style="{ positionAnchor: anchor(ri) }">
                <p class="popname">{{ row.name }}</p>
                <dl>
                  <dt>Learning</dt>
                  <dd>{{ row.learning }}</dd>
                </dl>
              </div>
            </template>
            <span v-else class="muted">{{
              row.onTime ? "delivered on time" : "delivered late"
            }}</span>
          </template>
          <template v-else>
            <span class="chip" :class="chipClass(row)">{{ stateWord(row) }}</span>
            <template v-if="trouble(row) && (row.problem || row.countermeasure)">
              <button
                type="button"
                class="celltext trouble"
                :popovertarget="popId(ri)"
                :style="{ anchorName: anchor(ri) }"
              >
                <span v-if="row.problem" class="problem clamp">{{ row.problem }}</span>
                <span v-if="row.countermeasure" class="cm-line">
                  <span class="arrow" aria-hidden="true">→</span>
                  <span class="countermeasure clamp">{{ row.countermeasure }}</span>
                </span>
              </button>
              <div :id="popId(ri)" popover class="cellpop" :style="{ positionAnchor: anchor(ri) }">
                <p class="popname">
                  {{ row.name }} <span class="popstatus">{{ stateWord(row) }}</span>
                </p>
                <dl>
                  <dt>Problem</dt>
                  <dd :class="{ muted: !row.problem }">{{ row.problem ?? "Not stated" }}</dd>
                  <dt>Countermeasure</dt>
                  <dd :class="{ muted: !row.countermeasure }">
                    {{ row.countermeasure ?? "None yet" }}
                  </dd>
                </dl>
              </div>
            </template>
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
    <span
      ><b class="text-base-content/50"
        ><svg class="tri-dash" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M6 1.6 L11 10.4 H1 Z" /></svg></b
      ><b class="dash-swatch"></b> forecast slip</span
    >
    <span><b class="text-base-content/50">◌</b> forecast, earlier</span>
    <span><b>┣━</b> feature bar</span>
    <span><b class="ms-dia">◆</b> milestone</span>
    <span><b class="now-swatch"></b> today</span>
    <span v-if="plan.breaks.length"><b class="off-swatch"></b> break</span>
    <span><b class="chip chip-fill chip-off-track">off track</b> no countermeasure</span>
    <span><b class="chip chip-fill chip-at-risk">at risk</b> countermeasure set</span>
    <span v-if="plan.rows.some((r) => r.childCount)"
      ><b class="below below-off-track legend-below"></b> trouble inside a folded feature</span
    >
    <span><i class="legend-problem">problem</i> <b>→</b> countermeasure</span>
  </div>
</template>

<style scoped>
.macroplan {
  --name-w: 16rem;
  --wk: 3.5rem;
  --area-w: 0rem; /* set inline: 2rem once any Feature has an Area */
}
/* A phone: NAME_W / WK in the script follow these. 2.75rem keeps a Week a
   44px column; 9rem still fits a two-word name. */
.macroplan.compact {
  --name-w: 9rem;
  --wk: 2.75rem;
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
  justify-self: start;
  padding: 0;
  border: 0;
  background: none;
  font-family: inherit;
  text-align: start;
  cursor: pointer;
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
/* "Oct 05" is wider than a compact Week: month over day instead. */
.compact .wkhead {
  white-space: normal;
  text-align: center;
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
.row {
  --row-base: var(--color-base-100);
  --row-bg: var(--row-base);
}
/* Trouble tints, measured on both themes: base-content stays ≥ 10.8:1 on them
   and the status inks (bars, borders) ≥ 3.3:1. */
.row-at-risk {
  --row-base: color-mix(in oklab, var(--color-warning) 18%, var(--color-base-100));
}
.row-off-track {
  --row-base: color-mix(in oklab, var(--color-alarm) 26%, var(--color-base-100));
}
/* Hover only where there is one: on touch, :hover sticks to the last row tapped. */
@media (hover: hover) {
  .row:hover {
    --row-bg: color-mix(in oklab, var(--color-primary) 7%, var(--row-base));
  }
}
.row-at-risk .namecell,
.row-off-track .namecell {
  font-weight: 700;
}
.row-at-risk .bar,
.row-at-risk .riser,
.row-off-track .bar,
.row-off-track .riser {
  opacity: 1;
}
.row-at-risk .bar,
.row-off-track .bar {
  height: 3px;
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
/* One glyph that turns, so fold and unfold read as the same control changing
   state. */
.chevron {
  display: inline-block;
  transition: rotate var(--dur-fast) var(--ease-in-out);
}
.disclosure[aria-expanded="true"] .chevron {
  rotate: 90deg;
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
.below {
  display: inline-block;
  flex: none;
  width: 0.5rem;
  height: 0.5rem;
  margin-left: 0.4rem;
  border-radius: 50%;
}
.below-off-track {
  background: var(--color-ink-error);
}
.below-at-risk {
  background: var(--color-ink-warning);
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
/* The name opens the Feature's details: the one place a cut-off name, its
   Status and its Problem can all be read without hover or a long scroll. */
.namebtn {
  min-width: 0;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
}
@media (hover: hover) {
  .namebtn:hover {
    text-decoration: underline dotted;
    text-underline-offset: 0.2em;
  }
}
.namebtn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  border-radius: 0.2rem;
}
/* A finger needs taller rows than a pointer: 40px, and a disclosure hit area
   to match. */
@media (pointer: coarse) {
  .namecell,
  .cell,
  .learncell {
    min-height: 2.5rem;
  }
  .disclosure::before {
    width: 2.5rem;
    height: 2.5rem;
  }
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
/* The text is a button that opens the full text in a popover. Capping its width
   is what stops one long sentence from widening the whole grid off-screen. */
.learncell .celltext {
  max-width: 24rem;
  padding: 0;
  border: 0;
  border-radius: 0.2rem;
  background: none;
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
}
.learncell .celltext:hover .clamp {
  text-decoration: underline dotted;
  text-underline-offset: 0.2em;
}
.learncell .celltext:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
/* At most two lines per part; the popover has the rest. */
.clamp {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
  overflow-wrap: anywhere;
}
/* Problem → Countermeasure, one per line so a long Problem never truncates the
   action. The Problem is what a reviewer must see first, so it leads in bold. The arrow hangs in
   the gutter under the chip, so both lines start flush. */
.learncell .celltext {
  line-height: 1.25;
}
.trouble .problem {
  font-weight: 700;
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

/* Full text of a cell. Without anchor positioning it falls back to the UA's
   centred popover, which is still readable and dismissible. */
.cellpop {
  width: max-content;
  max-width: min(28rem, calc(100vw - 2rem));
  padding: 0.75rem 0.9rem;
  border: 1px solid var(--color-base-300);
  border-radius: 0.4rem;
  background: var(--color-base-100);
  color: var(--color-base-content);
  box-shadow: 0 8px 24px color-mix(in oklch, black 16%, transparent);
  font-size: 0.8rem;
  line-height: 1.5;
}
@supports (position-anchor: --a) {
  .cellpop {
    inset: auto;
    margin: 0.25rem 0;
    position-area: bottom span-right;
    position-try-fallbacks:
      flip-inline,
      flip-block,
      flip-block flip-inline;
  }
}
.cellpop .popname {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  margin: 0 0 0.5rem;
  font-weight: 700;
}
.cellpop .popstatus {
  font-weight: 500;
  color: var(--color-ink-muted);
}
.cellpop dt {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-ink-muted);
}
.cellpop dd {
  margin: 0 0 0.5rem;
  overflow-wrap: anywhere;
}
.cellpop dd:last-child {
  margin-bottom: 0;
}
.cellpop .muted {
  color: var(--color-ink-muted);
}
/* Fades in from 98% scale; closes faster. Scale rather than a slide because
   the popover may flip above or beside its text, so no direction holds.
   Reduced motion keeps the fade only. */
.cellpop {
  transition-property: opacity, scale, display, overlay;
  transition-duration: var(--dur-exit-fast);
  transition-timing-function: var(--ease-out);
  transition-behavior: allow-discrete;
}
.cellpop:popover-open {
  transition-duration: var(--dur-fast);
}
.cellpop:not(:popover-open) {
  opacity: 0;
  scale: 0.98;
}
@starting-style {
  .cellpop:popover-open {
    opacity: 0;
    scale: 0.98;
  }
}
@media (prefers-reduced-motion: reduce) {
  .cellpop:not(:popover-open) {
    scale: none;
  }
  @starting-style {
    .cellpop:popover-open {
      scale: none;
    }
  }
}
.legend-problem {
  font-style: normal;
  font-weight: 700;
  color: var(--color-base-content);
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
.legend-below {
  margin: 0 0.3rem 0 0;
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
