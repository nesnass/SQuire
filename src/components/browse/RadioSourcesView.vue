<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { imageUrl } from '@/lms/format'
import { fetchRadioSources, type RadioSource } from '@/lms/menus'
import Icon from '../Icon.vue'
import BackHeader from './BackHeader.vue'
import { useNav } from './nav'

const nav = useNav()
const heading = ref<HTMLElement | null>(null)
const sources = ref<RadioSource[] | null>(null)
const failed = ref(false)

onMounted(async () => {
  heading.value?.focus()
  try {
    sources.value = await fetchRadioSources()
  } catch {
    failed.value = true
  }
})
</script>

<template>
  <article class="pb-6">
    <BackHeader title="Find stations" />
    <h1 ref="heading" tabindex="-1" class="px-4 pt-2 text-3xl font-bold outline-none">Find stations</h1>
    <p class="px-4 pt-1 pb-3 text-sm text-neutral-400">Add a station to your Library from its ⋯ menu.</p>
    <p v-if="failed" class="px-4 py-10 text-center text-neutral-400">Couldn't load radio</p>
    <p v-else-if="!sources" class="px-4 py-10 text-center text-neutral-500">Loading…</p>
    <ul v-else>
      <li v-for="r in sources" :key="r.menu">
        <button
          type="button"
          class="flex min-h-14 w-full items-center gap-3 px-4 py-1.5 text-left active:bg-neutral-900"
          @click="nav.push({ kind: 'menu', menu: r.menu, title: r.name })"
        >
          <span class="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-neutral-800">
            <img v-if="r.icon" :src="imageUrl(r.icon, 96)" alt="" loading="lazy" class="size-8 object-contain" />
          </span>
          <span class="flex-1 truncate">{{ r.name }}</span>
          <Icon name="back" class="size-5 rotate-180 text-neutral-600" />
        </button>
      </li>
    </ul>
  </article>
</template>
