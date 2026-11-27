<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue"
import { chordKeys, fuzzyScore, type Chord } from "../composables/shortcuts"
import { useMedia, TOUCH } from "../composables/useMedia"

export interface Command {
  id: string
  group: string
  label: string
  chord?: Chord
  /** Marks the command describing the current state (the active view, plan). */
  current?: boolean
  run: () => void
}

const props = defineProps<{ open: boolean; commands: Command[] }>()
const emit = defineEmits<{ close: [] }>()

const dialog = ref<HTMLDialogElement>()
const input = ref<HTMLInputElement>()
const listEl = ref<HTMLElement>()
const query = ref("")
// On touch the list is the interface: focusing the field would raise the
// on-screen keyboard over half of it. The dialog takes focus instead.
const touch = useMedia(TOUCH)
const active = ref(0)

// Empty query: the authored order, grouped. Typed query: one list, best first,
// with the group named on each row so "Switch plan" hits stay recognisable.
const results = computed(() => {
  const q = query.value.trim()
  if (!q) return props.commands
  return props.commands
    .map((c) => ({ c, s: fuzzyScore(q, `${c.label} ${c.group}`) }))
    .filter((r): r is { c: Command; s: number } => r.s !== null)
    .sort((a, b) => b.s - a.s)
    .map((r) => r.c)
})
const grouped = computed(() => !query.value.trim())

watch(results, () => (active.value = 0))

watch(
  () => props.open,
  async (open) => {
    const d = dialog.value
    if (!d) return
    if (open && !d.open) {
      query.value = ""
      active.value = 0
      d.showModal()
      await nextTick()
      if (!touch.value) input.value?.focus()
    } else if (!open && d.open) {
      d.close()
    }
  },
  { flush: "post" },
)

function optionId(i: number) {
  return `cmd-opt-${i}`
}

function move(delta: number) {
  const n = results.value.length
  if (!n) return
  active.value = (active.value + delta + n) % n
  nextTick(() =>
    listEl.value?.querySelector(`#${optionId(active.value)}`)?.scrollIntoView({ block: "nearest" }),
  )
}

function run(c: Command | undefined) {
  if (!c) return
  emit("close")
  // After the dialog has closed and handed focus back, so a command that moves
  // focus itself (Focus the source) keeps it.
  nextTick(() => c.run())
}

function onKeydown(e: KeyboardEvent) {
  const readline = e.ctrlKey && (e.key === "n" || e.key === "p")
  if (e.key === "ArrowDown" || (readline && e.key === "n")) {
    e.preventDefault()
    move(1)
  } else if (e.key === "ArrowUp" || (readline && e.key === "p")) {
    e.preventDefault()
    move(-1)
  } else if (e.key === "Home" && results.value.length) {
    e.preventDefault()
    active.value = 0
    move(0)
  } else if (e.key === "End" && results.value.length) {
    e.preventDefault()
    active.value = results.value.length - 1
    move(0)
  } else if (e.key === "Enter") {
    e.preventDefault()
    run(results.value[active.value])
  }
}

function startsGroup(i: number) {
  return grouped.value && (i === 0 || results.value[i - 1].group !== results.value[i].group)
}

// A click on the ::backdrop lands on the <dialog> itself.
function onDialogClick(e: MouseEvent) {
  if (e.target === dialog.value) emit("close")
}
</script>

<template>
  <dialog
    ref="dialog"
    class="palette"
    aria-label="Command palette"
    :autofocus="touch || undefined"
    @cancel.prevent="emit('close')"
    @click="onDialogClick"
  >
    <div class="panel">
      <div class="prompt">
        <span class="caret" aria-hidden="true">›</span>
        <input
          ref="input"
          v-model="query"
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded="true"
          aria-controls="cmd-list"
          :aria-activedescendant="results.length ? optionId(active) : undefined"
          aria-label="Type a command or a plan name"
          placeholder="Type a command or a plan name…"
          spellcheck="false"
          autocomplete="off"
          @keydown="onKeydown"
        />
        <kbd class="esc">esc</kbd>
      </div>

      <ul
        v-show="results.length"
        id="cmd-list"
        ref="listEl"
        role="listbox"
        aria-label="Commands"
        class="list"
      >
        <template v-for="(c, i) in results" :key="c.id">
          <li v-if="startsGroup(i)" role="presentation" class="group">{{ c.group }}</li>
          <li
            :id="optionId(i)"
            role="option"
            :aria-selected="i === active"
            class="option"
            :class="{ active: i === active }"
            @mousemove="active = i"
            @click="run(c)"
          >
            <span class="label">
              {{ c.label }}
              <span v-if="c.current" class="current">current</span>
            </span>
            <span v-if="!grouped" class="tag">{{ c.group }}</span>
            <span v-if="c.chord" class="chord" aria-hidden="true">
              <kbd v-for="k in chordKeys(c.chord)" :key="k">{{ k }}</kbd>
            </span>
          </li>
        </template>
      </ul>
      <p v-if="!results.length" class="none" role="status">Nothing matches “{{ query.trim() }}”.</p>

      <footer class="foot" aria-hidden="true">
        <span><kbd>↑</kbd><kbd>↓</kbd> move</span>
        <span><kbd>↵</kbd> run</span>
        <span><kbd>?</kbd> opens this anywhere outside the editor</span>
      </footer>
    </div>
  </dialog>
</template>

<style scoped>
.palette {
  --pal-gap: 0.5rem;
  --pal-row: 2.75rem; /* 44px touch target */
  --pal-width: min(40rem, calc(100vw - 2rem));

  width: var(--pal-width);
  max-width: none;
  max-height: none;
  margin: 12vh auto auto;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-base-content);
  overflow: visible;
}
.palette::backdrop {
  background: color-mix(in oklab, var(--color-base-content) 28%, transparent);
}
/* Opened from the keyboard many times a session: no travel, just a 100ms fade
   so the backdrop does not flash in. Closing is instant. */
.palette[open] .panel,
.palette[open]::backdrop {
  animation: fade var(--dur-press) var(--ease-out) backwards;
}
@keyframes fade {
  from {
    opacity: 0;
  }
}

.panel {
  display: flex;
  flex-direction: column;
  max-height: min(32rem, 76dvh);
  border: 1px solid var(--color-base-300);
  border-radius: var(--radius-box);
  background: var(--color-base-100);
  box-shadow: 0 24px 48px -12px color-mix(in oklab, black 28%, transparent);
  overflow: hidden;
}

.prompt {
  display: flex;
  align-items: center;
  gap: var(--pal-gap);
  padding: 0 1rem;
  border-bottom: 1px solid var(--color-base-300);
}
.caret {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-primary);
}
.prompt input {
  flex: 1;
  min-width: 0;
  height: 3.5rem;
  border: 0;
  outline: none;
  background: transparent;
  font: inherit;
  font-size: 1rem;
  color: inherit;
}
.prompt input::placeholder {
  color: var(--color-ink-muted);
}

.list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0.25rem 0.5rem 0.5rem;
}
.group {
  padding: 0.75rem 0.5rem 0.25rem;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-ink-muted);
}
.option {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: var(--pal-row);
  padding: 0 0.75rem;
  border-radius: var(--radius-field);
  /* The active row carries a 2px primary rule, the palette's echo of the
     grid's now line — it shows position without relying on the tint alone. */
  box-shadow: inset 2px 0 0 transparent;
  font-size: 0.875rem;
  cursor: pointer;
}
.option.active {
  background: color-mix(
    in oklab,
    var(--color-primary) 10%,
    var(--color-base-100)
  ); /* muted text on it: 4.59 light, 4.88 dark */
  box-shadow: inset 2px 0 0 var(--color-primary);
}
.label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.current {
  margin-left: 0.5rem;
  font-size: 0.6875rem;
  color: var(--color-ink-muted);
}
.tag {
  font-size: 0.6875rem;
  color: var(--color-ink-muted);
  white-space: nowrap;
}
.chord {
  display: inline-flex;
  gap: 0.25rem;
}

kbd {
  display: inline-grid;
  place-items: center;
  min-width: 1.5rem;
  height: 1.5rem;
  padding: 0 0.375rem;
  border: 1px solid var(--color-base-300);
  border-bottom-width: 2px;
  border-radius: 0.25rem;
  background: var(--color-base-200);
  font: inherit;
  font-size: 0.6875rem;
  color: var(--color-base-content);
}
.esc {
  color: var(--color-ink-muted);
}

.none {
  padding: 1.5rem 1rem;
  font-size: 0.875rem;
  color: var(--color-ink-muted);
}

.foot {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1rem;
  padding: 0.5rem 1rem;
  border-top: 1px solid var(--color-base-300);
  background: var(--color-base-200);
  font-size: 0.6875rem;
  color: var(--color-ink-muted);
}
.foot span {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}
.foot kbd {
  min-width: 1.25rem;
  height: 1.25rem;
}
/* No keyboard to press them with. */
@media (hover: none) and (pointer: coarse) {
  .chord,
  .esc,
  .foot {
    display: none;
  }
}
@media (max-width: 40rem) {
  .palette {
    margin-top: 1rem;
  }
  .foot span:last-child {
    display: none;
  }
}
</style>
