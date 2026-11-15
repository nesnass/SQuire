<script setup lang="ts">
import Icon, { type IconName } from '../Icon.vue'

// The square cover cell every library grid and shelf uses, so items are one size everywhere.
// One cover fills the square; four make a mosaic. `moreLabel` adds a ⋯ button beside the title.
const props = defineProps<{
  covers: string[]
  icon: IconName
  title: string
  subtitle?: string
  moreLabel?: string
}>()
const emit = defineEmits<{ open: []; more: [] }>()
</script>

<template>
  <div class="flex flex-col">
    <!-- The cover is the one tab stop; the title below repeats it for pointer users -->
    <button
      type="button"
      class="group w-full text-left"
      :aria-label="props.subtitle ? `${props.title}, ${props.subtitle}` : props.title"
      @click="emit('open')"
    >
      <span
        class="relative grid aspect-square overflow-hidden rounded-xl bg-neutral-800"
        :class="{ 'grid-cols-2': props.covers.length === 4 }"
      >
        <img
          v-for="src in props.covers"
          :key="src"
          :src="src"
          alt=""
          loading="lazy"
          decoding="async"
          class="size-full object-cover transition group-active:opacity-70"
        />
        <Icon v-if="!props.covers.length" :name="props.icon" class="absolute inset-0 m-auto size-1/3 text-neutral-600" />
      </span>
    </button>
    <div class="flex items-start">
      <button type="button" class="min-w-0 flex-1 pt-2 text-left" tabindex="-1" aria-hidden="true" @click="emit('open')">
        <span class="line-clamp-2 text-sm font-medium">{{ props.title }}</span>
        <span v-if="props.subtitle" class="block truncate text-sm text-neutral-400">{{ props.subtitle }}</span>
      </button>
      <button
        v-if="props.moreLabel"
        type="button"
        class="-mr-2 grid size-11 shrink-0 place-items-center text-neutral-400 active:text-neutral-100"
        :aria-label="props.moreLabel"
        @click="emit('more')"
      >
        <Icon name="more" class="size-5" />
      </button>
    </div>
  </div>
</template>
