<script setup lang="ts">
import { ref } from 'vue'
import usePlayerStore, { type Room } from '@/store/usePlayerStore'
import Icon from './Icon.vue'
import VolumeSlider from './VolumeSlider.vue'

const props = defineProps<{ room: Room }>()
const { actions } = usePlayerStore()

const expanded = ref(false)

// Group volume shows the loudest member; dragging scales every member from its level at drag start,
// so relative balance between rooms is preserved
let base: Map<string, number> | null = null

function setGroup(value: number) {
  base ??= new Map(props.room.members.map((m) => [m.id, m.volume]))
  const max = Math.max(...base.values())
  for (const [id, volume] of base) {
    void actions.setVolume(id, max === 0 ? value : (volume * value) / max)
  }
}
</script>

<template>
  <div v-if="props.room.members.length === 1">
    <VolumeSlider
      :value="props.room.volume"
      :label="`${props.room.members[0].name} volume`"
      :disabled="!props.room.members[0].connected"
      @set="(v) => actions.setVolume(props.room.members[0].id, v)"
    />
  </div>
  <div v-else>
    <p class="text-xs text-neutral-400">Group volume</p>
    <div class="flex items-center gap-1">
      <VolumeSlider class="flex-1" :value="props.room.volume" label="Group volume" @set="setGroup" @end="base = null" />
      <button
        type="button"
        class="grid size-11 shrink-0 place-items-center rounded-full text-neutral-300 active:bg-neutral-700"
        :aria-expanded="expanded"
        :aria-label="expanded ? 'Hide room volumes' : 'Show room volumes'"
        @click="expanded = !expanded"
      >
        <Icon :name="expanded ? 'expandLess' : 'expandMore'" class="size-6" />
      </button>
    </div>
    <ul v-if="expanded" class="mt-1 border-l-2 border-neutral-700 pl-3">
      <li v-for="m in props.room.members" :key="m.id">
        <p class="text-xs text-neutral-400">{{ m.name }}</p>
        <VolumeSlider
          class="pr-12"
          :value="m.volume"
          :label="`${m.name} volume`"
          :disabled="!m.connected"
          @set="(v) => actions.setVolume(m.id, v)"
        />
      </li>
    </ul>
  </div>
</template>
