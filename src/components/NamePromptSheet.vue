<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import BottomSheet from './BottomSheet.vue'
import type { NamePromptContent } from './overlays'

const props = defineProps<{ content: NamePromptContent }>()
const emit = defineEmits<{ close: [] }>()

const name = ref(props.content.initial ?? '')
const error = ref<string | null>(null)
const busy = ref(false)
const input = ref<HTMLInputElement | null>(null)

onMounted(async () => {
  await nextTick()
  input.value?.focus()
  input.value?.select()
})

async function submit(close: () => void) {
  const value = name.value.trim()
  if (!value || busy.value) return
  busy.value = true
  try {
    error.value = await props.content.submit(value)
    if (!error.value) close()
  } catch {
    error.value = "Couldn't reach the server"
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <BottomSheet :label="props.content.title" @close="emit('close')">
    <template #default="{ close }">
      <form class="px-5 pt-3 pb-5" @submit.prevent="submit(close)">
        <h2 class="text-lg font-semibold">{{ props.content.title }}</h2>
        <label class="mt-4 block text-sm text-neutral-400" for="name-prompt">{{ props.content.label }}</label>
        <input
          id="name-prompt"
          ref="input"
          v-model="name"
          type="text"
          enterkeyhint="done"
          maxlength="100"
          :aria-invalid="Boolean(error)"
          :aria-describedby="error ? 'name-prompt-error' : undefined"
          class="mt-1 min-h-12 w-full rounded-xl bg-neutral-800 px-4 text-base outline-none focus:ring-2 focus:ring-accent"
          @input="error = null"
        />
        <p v-if="error" id="name-prompt-error" role="alert" class="mt-2 text-sm text-red-400">{{ error }}</p>
        <button
          type="submit"
          class="mt-5 min-h-12 w-full rounded-xl bg-accent font-semibold text-neutral-950 disabled:opacity-40"
          :disabled="!name.trim() || busy"
        >
          {{ props.content.confirmLabel }}
        </button>
      </form>
    </template>
  </BottomSheet>
</template>
