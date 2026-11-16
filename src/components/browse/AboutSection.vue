<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { imageUrl } from '@/lms/format'
import { paragraphs } from '@/lms/info'
import BottomSheet from '../BottomSheet.vue'

// An excerpt of a biography or review; the whole text, and any photos, open in a sheet
const props = defineProps<{ heading: string; title: string; text: string; photos?: string[] }>()

const PHOTO_PX = 300
const open = ref(false)
const parts = computed(() => paragraphs(props.text))
const excerpt = computed(() => parts.value.find((p) => !p.heading)?.text ?? '')
const id = useId()
</script>

<template>
  <section :aria-labelledby="id" class="px-4">
    <h2 :id="id" class="pb-2 text-lg font-semibold">{{ props.heading }}</h2>
    <p class="line-clamp-3 text-sm text-neutral-300">{{ excerpt }}</p>
    <button
      type="button"
      class="-ml-3 min-h-11 rounded-full px-3 text-sm font-semibold text-accent active:bg-neutral-800"
      :aria-label="`More: ${props.heading}`"
      @click="open = true"
    >
      More
    </button>

    <BottomSheet v-if="open" :label="props.title" @close="open = false">
      <template #header="{ close }">
        <div class="flex items-center justify-between gap-2 pt-3 pr-3 pb-2 pl-5">
          <h2 class="truncate text-lg font-semibold">{{ props.title }}</h2>
          <button
            type="button"
            class="min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold text-accent active:bg-neutral-800"
            @click="close()"
          >
            Done
          </button>
        </div>
      </template>
      <ul v-if="props.photos?.length" class="flex gap-3 overflow-x-auto px-5 pb-4" aria-label="Photos">
        <li v-for="url in props.photos" :key="url" class="shrink-0">
          <img
            :src="imageUrl(url, PHOTO_PX)"
            alt=""
            loading="lazy"
            class="h-40 w-auto rounded-xl bg-neutral-800 object-cover"
          />
        </li>
      </ul>
      <div class="flex flex-col gap-3 px-5 pb-6 text-neutral-200">
        <template v-for="(p, i) in parts" :key="i">
          <h3 v-if="p.heading" class="pt-3 font-semibold text-neutral-50">{{ p.text }}</h3>
          <p v-else class="leading-relaxed">{{ p.text }}</p>
        </template>
      </div>
    </BottomSheet>
  </section>
</template>
