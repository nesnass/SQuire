import { ref } from 'vue'
import type { IconName } from './Icon.vue'

export interface SheetAction {
  label: string
  icon: IconName
  run: () => void
  danger?: boolean
}

export interface ActionSheetContent {
  title: string
  subtitle?: string
  art?: string
  actions: SheetAction[]
}

export interface PlaylistPickerContent {
  title: string
  subtitle?: string
  art?: string
  // Resolved only once a playlist is picked, so opening the sheet costs nothing
  urls: () => Promise<string[]>
}

export interface ConfirmContent {
  title: string
  message: string
  confirmLabel: string
  run: () => Promise<void>
}

export interface NamePromptContent {
  title: string
  label: string
  initial?: string
  confirmLabel: string
  // Resolves to an error message to show, or null when done
  submit: (name: string) => Promise<string | null>
}

// One of each overlay app-wide, rendered by App.vue
export const actionSheet = ref<ActionSheetContent | null>(null)
export const playlistPicker = ref<PlaylistPickerContent | null>(null)
export const confirmSheet = ref<ConfirmContent | null>(null)
export const namePrompt = ref<NamePromptContent | null>(null)
// Bumped when a playlist changes, so lists showing playlists reload
export const playlistsVersion = ref(0)
export const toastMessage = ref<string | null>(null)

let toastTimer: ReturnType<typeof setTimeout> | undefined

export function showToast(message: string) {
  toastMessage.value = message
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toastMessage.value = null), 2500)
}
