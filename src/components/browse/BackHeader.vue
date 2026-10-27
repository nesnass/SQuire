<script setup lang="ts">
import Icon from '../Icon.vue'
import { useNav } from './nav'

const props = defineProps<{ title: string }>()
const nav = useNav()
</script>

<template>
  <div class="sticky top-0 z-10 flex items-center gap-1 bg-neutral-950/90 px-1 backdrop-blur">
    <button
      type="button"
      class="flex size-12 shrink-0 items-center justify-center rounded-full active:bg-neutral-800"
      aria-label="Back"
      @click="nav.pop()"
    >
      <Icon name="back" class="size-7" />
    </button>
    <p class="min-w-0 flex-1 truncate font-medium text-neutral-300" aria-hidden="true">{{ props.title }}</p>
    <slot />
  </div>
</template>
