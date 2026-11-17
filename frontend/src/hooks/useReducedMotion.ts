import { useSyncExternalStore } from 'react'
import { useAppearanceStore } from '@/stores/appearance'

const reducedMotionQuery = '(prefers-reduced-motion: reduce)'
const subscribers = new Set<() => void>()
let mediaQuery: MediaQueryList | null = null

function getMediaQuery() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null
  mediaQuery ??= window.matchMedia(reducedMotionQuery)
  return mediaQuery
}

function emitChange() {
  subscribers.forEach((subscriber) => subscriber())
}

function addMediaQueryListener(query: MediaQueryList) {
  if (typeof query.addEventListener === 'function') query.addEventListener('change', emitChange)
  else query.addListener(emitChange)
}

function removeMediaQueryListener(query: MediaQueryList) {
  if (typeof query.removeEventListener === 'function')
    query.removeEventListener('change', emitChange)
  else query.removeListener(emitChange)
}

function subscribe(subscriber: () => void) {
  const query = getMediaQuery()
  subscribers.add(subscriber)
  if (query && subscribers.size === 1) addMediaQueryListener(query)

  return () => {
    subscribers.delete(subscriber)
    if (query && subscribers.size === 0) {
      removeMediaQueryListener(query)
      mediaQuery = null
    }
  }
}

function getSnapshot() {
  return getMediaQuery()?.matches ?? false
}

function getServerSnapshot() {
  return false
}

/** True when the system asks for reduced motion or the in-app preference is switched on. */
export function useReducedMotion() {
  const systemPreference = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const appPreference = useAppearanceStore((state) => state.reduceMotion)
  return systemPreference || appPreference
}
