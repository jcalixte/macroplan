<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { HighlighterCore } from 'shiki/core'

const props = defineProps<{ modelValue: string; error: string | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const textarea = ref<HTMLTextAreaElement>()
const backdrop = ref<HTMLElement>()
const highlighter = ref<HighlighterCore>()

onMounted(async () => {
  // Lazy-load Shiki as its own chunk so it stays out of the initial bundle.
  // Fine-grained: only the TOML grammar + one light theme, JS engine (no WASM).
  const [core, engine, toml, theme] = await Promise.all([
    import('shiki/core'),
    import('shiki/engine/javascript'),
    import('shiki/langs/toml.mjs'),
    import('shiki/themes/github-light.mjs'),
  ])
  highlighter.value = await core.createHighlighterCore({
    themes: [theme.default],
    langs: [toml.default],
    engine: engine.createJavaScriptRegexEngine(),
  })
})

const highlighted = computed(() => {
  // a trailing newline needs a trailing char so the last backdrop line keeps height
  const code = props.modelValue.endsWith('\n') ? props.modelValue + ' ' : props.modelValue
  const hl = highlighter.value
  if (!hl) return `<pre class="shiki"><code>${escapeHtml(code)}</code></pre>`
  return hl.codeToHtml(code, { lang: 'toml', theme: 'github-light' })
})

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)
}

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLTextAreaElement).value)
}

function syncScroll() {
  if (!textarea.value || !backdrop.value) return
  backdrop.value.scrollTop = textarea.value.scrollTop
  backdrop.value.scrollLeft = textarea.value.scrollLeft
}
</script>

<template>
  <div class="editor">
    <div class="code">
      <div ref="backdrop" class="backdrop" aria-hidden="true" v-html="highlighted" />
      <textarea
        ref="textarea"
        class="input"
        :value="modelValue"
        spellcheck="false"
        autocapitalize="off"
        autocorrect="off"
        autocomplete="off"
        aria-label="Macroplan TOML source"
        @input="onInput"
        @scroll="syncScroll"
      ></textarea>
    </div>
    <div v-if="error" class="editor-error" role="alert">
      <span class="font-semibold">Can’t parse:</span> {{ error }}
    </div>
  </div>
</template>

<style scoped>
.editor {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.code {
  position: relative;
  flex: 1;
  min-height: 0;
}
/* Backdrop (highlighted) and textarea (input) share identical box metrics so the
   transparent input text sits exactly over its colored Shiki copy. */
.backdrop,
.input {
  position: absolute;
  inset: 0;
  margin: 0;
  border: 0;
  padding: 0.9rem 1rem;
  font-family: inherit; /* Fira Code, from the global theme */
  font-size: 0.8rem;
  line-height: 1.6;
  tab-size: 2;
  white-space: pre;
}
.backdrop {
  z-index: 0;
  pointer-events: none;
  overflow: hidden; /* scroll is driven by the textarea via syncScroll */
  background: var(--color-base-100);
  color: var(--color-base-content);
}
/* Neutralise Shiki's own <pre> chrome — the .backdrop provides padding/metrics. */
.backdrop :deep(pre.shiki) {
  margin: 0;
  padding: 0;
  background: transparent !important;
  white-space: pre;
}
.backdrop :deep(pre.shiki),
.backdrop :deep(pre.shiki code) {
  font: inherit;
}
.input {
  z-index: 1;
  /* A textarea has an intrinsic block size (its `rows`), so inset:0 alone won't
     stretch it the way it does the plain-div backdrop — pin both axes to fill. */
  width: 100%;
  height: 100%;
  overflow: auto;
  resize: none;
  outline: none;
  background: transparent;
  color: transparent;
  caret-color: var(--color-base-content);
}
.input::selection {
  background: color-mix(in oklch, var(--color-primary) 28%, transparent);
}
.editor-error {
  padding: 0.6rem 1rem;
  font-size: 0.74rem;
  background: var(--color-error);
  color: var(--color-error-content);
  border-top: 1px solid color-mix(in oklch, black 12%, var(--color-error));
}
</style>
