<script setup lang="ts">
import { computed, nextTick, ref } from "vue"

const props = defineProps<{
  plans: { id: string; name: string }[]
  activeId: string
  archived?: { id: string; name: string } | null
}>()

const emit = defineEmits<{
  select: [id: string]
  new: []
  download: [id: string]
  archive: [id: string]
  restore: []
}>()

const activeName = computed(
  () => props.plans.find((p) => p.id === props.activeId)?.name ?? "Untitled",
)

// The dropdown stays open while focus is inside it. Archiving removes the
// focused button, so hand focus to the row that slid into its place: clearing
// out several plans is then one press per plan.
// (A v-for ref array doesn't promise source order, so read the DOM.)
const menu = ref<HTMLUListElement>()

function remove(index: number) {
  emit("archive", props.plans[index].id)
  nextTick(() => {
    const next = menu.value?.querySelectorAll<HTMLButtonElement>("button.archive") ?? []
    next[Math.min(index, next.length - 1)]?.focus()
  })
}
</script>

<template>
  <div class="dropdown max-w-full">
    <div tabindex="0" role="button" class="btn btn-ghost btn-sm max-w-full gap-1 normal-case">
      <span class="max-w-[14rem] truncate font-semibold">{{ activeName }}</span>
      <span aria-hidden="true">▾</span>
    </div>
    <ul
      ref="menu"
      tabindex="0"
      class="menu dropdown-content z-50 mt-1 w-72 rounded-box border border-base-300 bg-base-100 p-2 shadow-lg"
    >
      <li v-for="(p, i) in plans" :key="p.id" class="plan-row">
        <a
          class="min-w-0 flex-1"
          :class="{ active: p.id === activeId }"
          @click="emit('select', p.id)"
        >
          <span class="truncate">{{ p.name }}</span>
          <span v-if="p.id === activeId" aria-hidden="true">✓</span>
        </a>
        <button
          class="btn btn-ghost btn-sm btn-square archive"
          :title="`Archive “${p.name}”`"
          :aria-label="`Archive “${p.name}”`"
          @click="remove(i)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 6a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z" />
            <path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-10" />
            <path d="M10 12l4 0" />
          </svg>
        </button>
      </li>
      <template v-if="archived">
        <div class="my-1 border-t border-base-200"></div>
        <li class="menu-title archive-title">Archive · keeps the last one</li>
        <li class="plan-row">
          <span class="archived-name min-w-0 flex-1 truncate">{{ archived.name }}</span>
          <button
            class="btn btn-ghost btn-sm restore"
            :title="`Restore “${archived.name}” to your plans`"
            @click="emit('restore')"
          >
            Restore
          </button>
        </li>
      </template>
      <div class="my-1 border-t border-base-200"></div>
      <li><a @click="emit('new')">＋ New plan</a></li>
      <li><a @click="emit('download', activeId)">⤓ Download .toml</a></li>
    </ul>
  </div>
</template>

<style scoped>
/* Name and its action share one row; the name truncates, the button never shrinks. */
.plan-row {
  flex-direction: row;
  align-items: center;
  gap: 0.25rem;
}
.archive,
.restore {
  flex: none;
}
.archive {
  color: var(--color-ink-muted);
}
.archive:hover,
.archive:focus-visible {
  color: var(--color-base-content);
}
/* Not a menu link: the archived plan is shown, not opened, until restored. */
.archived-name {
  padding-inline: 0.75rem;
  color: var(--color-ink-muted);
  font-style: italic;
}
.archive-title {
  font-size: 0.75rem;
  color: var(--color-ink-muted);
}
.archive svg {
  width: 1rem;
  height: 1rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
