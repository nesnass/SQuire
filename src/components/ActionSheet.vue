<script setup lang="ts">
import BottomSheet from './BottomSheet.vue'
import Icon from './Icon.vue'
import type { ActionSheetContent, SheetAction } from './overlays'

const props = defineProps<{ content: ActionSheetContent }>()
const emit = defineEmits<{ close: [] }>()

function choose(action: SheetAction, close: () => void) {
  action.run()
  close()
}
</script>

<template>
  <BottomSheet :label="props.content.title" @close="emit('close')">
    <template #header>
      <div class="flex items-center gap-3 border-b border-neutral-800 px-5 pt-3 pb-4">
        <img v-if="props.content.art" :src="props.content.art" alt="" class="size-12 rounded bg-neutral-800 object-cover" />
        <div class="min-w-0">
          <p class="truncate font-semibold">{{ props.content.title }}</p>
          <p v-if="props.content.subtitle" class="truncate text-sm text-neutral-400">{{ props.content.subtitle }}</p>
        </div>
      </div>
    </template>
    <template #default="{ close }">
      <ul class="py-2">
        <li v-for="action in props.content.actions" :key="action.label">
          <button
            type="button"
            class="flex min-h-13 w-full items-center gap-4 px-5 text-left active:bg-neutral-800"
            :class="{ 'text-red-400': action.danger }"
            @click="choose(action, close)"
          >
            <Icon :name="action.icon" class="size-6" :class="action.danger ? 'text-red-400' : 'text-neutral-400'" />
            {{ action.label }}
          </button>
        </li>
      </ul>
    </template>
  </BottomSheet>
</template>
