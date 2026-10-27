<script setup lang="ts">
import { ref } from 'vue'
import BottomSheet from './BottomSheet.vue'
import { showToast, type ConfirmContent } from './overlays'

const props = defineProps<{ content: ConfirmContent }>()
const emit = defineEmits<{ close: [] }>()
const busy = ref(false)

async function confirm(close: () => void) {
  busy.value = true
  try {
    await props.content.run()
    close()
  } catch {
    showToast("Couldn't reach the server")
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <BottomSheet :label="props.content.title" @close="emit('close')">
    <template #default="{ close }">
      <div class="px-5 pt-3 pb-5">
        <h2 class="text-lg font-semibold">{{ props.content.title }}</h2>
        <p class="mt-1 text-neutral-400">{{ props.content.message }}</p>
        <div class="mt-5 flex flex-col gap-2">
          <button
            type="button"
            class="min-h-12 rounded-xl bg-red-500 font-semibold text-white active:bg-red-600 disabled:opacity-50"
            :disabled="busy"
            @click="confirm(close)"
          >
            {{ props.content.confirmLabel }}
          </button>
          <button type="button" class="min-h-12 rounded-xl bg-neutral-800 font-semibold active:bg-neutral-700" @click="close">
            Cancel
          </button>
        </div>
      </div>
    </template>
  </BottomSheet>
</template>
