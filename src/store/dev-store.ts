/**
 * dev-store.ts
 *
 * A lightweight utility for Vue 3 Composition API projects that:
 *   1. Wraps reactive state in a thin `createStore()` helper
 *   2. Registers every store with Vue Devtools (custom inspector)
 *   3. Exposes all stores on `window.__stores` for Claude Code / Chrome DevTools MCP
 *
 * Supports stores that return a nested `{ getters, actions }` structure,
 * where getters are `ComputedRef` property initializers and actions are functions.
 *
 * Usage:
 *   // stores/useMyStore.ts
 *   import { computed } from 'vue'
 *   import { createStore } from './dev-store'
 *
 *   function useMyStore() {
 *     const getters = {
 *       name: computed(() => state.value.name),
 *     }
 *     const actions = {
 *       setName(n: string) { state.value.name = n },
 *     }
 *     return { getters, actions }
 *   }
 *   export default createStore('my', useMyStore)
 *
 *   // main.ts
 *   import { createApp } from 'vue'
 *   import { installDevStorePlugin } from './store/dev-store'
 *   import App from './App.vue'
 *
 *   const app = createApp(App)
 *   installDevStorePlugin(app)   // only active in dev mode
 *   app.mount('#app')
 *
 * What you get:
 *   - Vue Devtools: a custom "App Stores" inspector tab showing live state
 *   - window.__stores: a plain object keyed by store name, JSON-serialisable
 *   - window.__storeSnapshot(): returns a deep JSON snapshot of all stores
 *   - window.__storeGet(storeName, key?): read a single store or key
 *   - Zero overhead in production builds (all dev code is tree-shaken)
 */

import {
  type App,
  toRaw,
  watch,
  isRef,
  isReactive,
  type Ref,
} from 'vue'
import { setupDevtoolsPlugin } from '@vue/devtools-api'

// ─── Types ───────────────────────────────────────────────────────────────────

type StoreFactory<T> = () => T

interface StoreEntry {
  name: string
  instance: Record<string, unknown>
}

interface WindowDevHelpers {
  __stores: Record<string, Record<string, unknown>>
  __storeSnapshot: () => Record<string, unknown>
  __storeGet: (storeName: string, key?: string) => unknown
}

// ─── Registry ────────────────────────────────────────────────────────────────

const storeRegistry = new Map<string, StoreEntry>()

/**
 * Resolves the source object for getters/state.
 * If the store has a `getters` sub-object, returns that.
 * Otherwise returns the store itself (flat composable pattern).
 */
function getGettersSource(store: Record<string, unknown>): Record<string, unknown> {
  if ('getters' in store && typeof store.getters === 'object' && store.getters !== null) {
    return store.getters as Record<string, unknown>
  }
  return store
}

/**
 * Resolves the source object for actions.
 * If the store has an `actions` sub-object, returns that.
 * Otherwise returns the store itself (flat composable pattern).
 */
function getActionsSource(store: Record<string, unknown>): Record<string, unknown> {
  if ('actions' in store && typeof store.actions === 'object' && store.actions !== null) {
    return store.actions as Record<string, unknown>
  }
  return store
}

/**
 * Extracts the current plain values from a store's getters.
 * Handles ref, computed, reactive, and plain values.
 * Skips functions (actions).
 */
function extractState(store: Record<string, unknown>): Record<string, unknown> {
  const source = getGettersSource(store)
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'function') continue

    if (isRef(value)) {
      result[key] = (value as Ref).value
    } else if (isReactive(value)) {
      result[key] = JSON.parse(JSON.stringify(toRaw(value)))
    } else {
      result[key] = value
    }
  }

  return result
}

/**
 * Returns a list of action (function) names from the store.
 */
function extractActions(store: Record<string, unknown>): string[] {
  const source = getActionsSource(store)
  return Object.entries(source)
    .filter(([, value]) => typeof value === 'function')
    .map(([key]) => key)
}

// ─── Window exposure (works even without the devtools plugin) ────────────────

function exposeOnWindow() {
  if (typeof window === 'undefined') return

  const helpers: WindowDevHelpers = {
    get __stores() {
      const out: Record<string, Record<string, unknown>> = {}
      for (const [name, entry] of storeRegistry) {
        out[name] = extractState(entry.instance)
      }
      return out
    },

    __storeSnapshot() {
      return JSON.parse(JSON.stringify(this.__stores))
    },

    __storeGet(storeName: string, key?: string) {
      const entry = storeRegistry.get(storeName)
      if (!entry) return undefined
      const state = extractState(entry.instance)
      if (key) return state[key]
      return state
    },
  }

  Object.defineProperty(window, '__stores', {
    get: () => helpers.__stores,
    configurable: true,
  })
  ;(window as any).__storeSnapshot = helpers.__storeSnapshot.bind(helpers)
  ;(window as any).__storeGet = helpers.__storeGet.bind(helpers)
}

// ─── createStore ─────────────────────────────────────────────────────────────

/**
 * Wraps a composable factory so that its returned state is automatically
 * registered for devtools inspection and window exposure.
 *
 * Supports both flat composables and nested `{ getters, actions }` structures.
 *
 * In production, this is a zero-cost singleton — no registration or devtools.
 *
 * @param name   A unique human-readable name (e.g. 'user', 'study', 'app')
 * @param factory  A function returning the composable's public API
 */
export function createStore<T extends object>(
  name: string,
  factory: StoreFactory<T>,
): () => T {
  // Production: singleton only, no dev overhead
  if (import.meta.env.PROD) {
    let instance: T | null = null
    return () => {
      if (!instance) instance = factory()
      return instance
    }
  }

  // Dev: singleton + register for devtools & window exposure
  let instance: T | null = null

  return () => {
    if (instance) return instance

    instance = factory()

    const entry: StoreEntry = {
      name,
      instance: instance as unknown as Record<string, unknown>,
    }

    storeRegistry.set(name, entry)
    exposeOnWindow()

    return instance
  }
}

// ─── Pinia stores ────────────────────────────────────────────────────────────

/**
 * Pinia plugin: exposes every Pinia store on window.__stores (by store id) like createStore does.
 * Pinia has its own devtools support, so only the window exposure is added. Dev only.
 *
 *   pinia.use(piniaDevStorePlugin)
 */
export function piniaDevStorePlugin({ store }: { store: { $id: string } }): void {
  if (import.meta.env.PROD) return
  storeRegistry.set(store.$id, { name: store.$id, instance: store as unknown as Record<string, unknown> })
  exposeOnWindow()
}

// ─── Vue Devtools plugin ─────────────────────────────────────────────────────

const INSPECTOR_ID = 'composition-stores'
const INSPECTOR_LABEL = 'App Stores'
const PLUGIN_ID = 'dev-store-plugin'
const PLUGIN_LABEL = 'Composition Stores'

/**
 * Install as a Vue plugin in main.ts.
 * Only active in development — in production this is a no-op.
 *
 *   const app = createApp(App)
 *   installDevStorePlugin(app)
 *   app.mount('#app')
 */
export function installDevStorePlugin(app: App): void {
  if (import.meta.env.PROD) return

  setupDevtoolsPlugin(
    {
      id: PLUGIN_ID,
      label: PLUGIN_LABEL,
      packageName: 'dev-store',
      homepage: '',
      componentStateTypes: [INSPECTOR_LABEL],
      app,
    },
    (api) => {
      // Register the inspector panel
      api.addInspector({
        id: INSPECTOR_ID,
        label: INSPECTOR_LABEL,
        icon: 'storage',
      })

      // Build the tree (left panel in devtools)
      api.on.getInspectorTree((payload) => {
        if (payload.inspectorId !== INSPECTOR_ID) return

        payload.rootNodes = Array.from(storeRegistry.values()).map(
          (entry) => {
            const actionCount = extractActions(entry.instance).length
            return {
              id: entry.name,
              label: entry.name,
              tags: actionCount > 0
                ? [{
                    label: `${actionCount} actions`,
                    textColor: 0xffffff,
                    backgroundColor: 0x42b883,
                  }]
                : [],
            }
          },
        )
      })

      // Build the state view (right panel in devtools)
      api.on.getInspectorState((payload) => {
        if (payload.inspectorId !== INSPECTOR_ID) return

        const entry = storeRegistry.get(payload.nodeId)
        if (!entry) return

        const gettersSource = getGettersSource(entry.instance)

        const stateFields = Object.entries(gettersSource)
          .filter(([, v]) => typeof v !== 'function')
          .map(([key, value]) => ({
            key,
            value: isRef(value) ? (value as Ref).value : value,
            editable: false, // getters (computed) are read-only
          }))

        const actionFields = extractActions(entry.instance).map((name) => ({
          key: name,
          value: '→ function',
        }))

        payload.state = {
          'Reactive State': stateFields,
          ...(actionFields.length > 0 ? { Actions: actionFields } : {}),
        }
      })

      // Watch all registered stores and notify devtools on change
      const watchedStores = new Set<string>()

      setInterval(() => {
        for (const [name, entry] of storeRegistry) {
          if (watchedStores.has(name)) continue
          watchedStores.add(name)

          // Watch each reactive/ref property in the getters
          const gettersSource = getGettersSource(entry.instance)
          for (const [, value] of Object.entries(gettersSource)) {
            if (isRef(value) || isReactive(value)) {
              watch(
                isRef(value) ? value : () => value,
                () => {
                  api.sendInspectorTree(INSPECTOR_ID)
                  api.sendInspectorState(INSPECTOR_ID)
                },
                { deep: true },
              )
            }
          }
        }
      }, 500)
    },
  )
}
