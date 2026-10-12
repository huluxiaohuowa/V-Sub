import { useSyncExternalStore } from 'react'
import { listenForVosBridgeLocale } from './vosBridge'
import {
  LANGUAGE_KEY, isVosLocaleKey, readLanguageMode, readVosLocale, resolveLocale,
  type LanguageMode, type Locale,
} from './vosLocale'

let bridgeLocale: Locale | null = null

function currentLanguage() {
  if (typeof window === 'undefined') return { mode: 'auto' as LanguageMode, locale: 'zh-CN' as Locale }
  let mode: LanguageMode = 'auto'
  let hostLocale = bridgeLocale
  try {
    mode = readLanguageMode(window.localStorage)
    if (window.location.pathname.includes('/app/com.ictrek.v-sub')) {
      hostLocale = bridgeLocale ?? readVosLocale(window.localStorage)
    }
  } catch { /* Use the browser language when storage access is blocked. */ }
  return { mode, locale: resolveLocale(mode, hostLocale, navigator.languages || [navigator.language]) }
}

let language = currentLanguage()
const listeners = new Set<() => void>()
let stopBridge: (() => void) | undefined

function refreshLanguage() {
  const next = currentLanguage()
  if (next.mode === language.mode && next.locale === language.locale) return
  language = next
  document.documentElement.lang = next.locale
  listeners.forEach(listener => listener())
}

function onStorage(event: StorageEvent) {
  if (event.key === null || event.key === LANGUAGE_KEY || isVosLocaleKey(event.key)) refreshLanguage()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (listeners.size === 1) {
    window.addEventListener('storage', onStorage)
    window.addEventListener('languagechange', refreshLanguage)
    window.addEventListener('focus', refreshLanguage)
    stopBridge = listenForVosBridgeLocale(locale => {
      bridgeLocale = locale
      refreshLanguage()
    })
    refreshLanguage()
  }
  return () => {
    listeners.delete(listener)
    if (!listeners.size) {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('languagechange', refreshLanguage)
      window.removeEventListener('focus', refreshLanguage)
      stopBridge?.()
      stopBridge = undefined
    }
  }
}

export function useLanguage() {
  return useSyncExternalStore(subscribe, () => language, () => language)
}

export function setLanguageMode(mode: LanguageMode) {
  try {
    if (mode === 'auto') window.localStorage.removeItem(LANGUAGE_KEY)
    else window.localStorage.setItem(LANGUAGE_KEY, mode)
    refreshLanguage()
  } catch {
    language = { mode, locale: resolveLocale(mode, null, navigator.languages || [navigator.language]) }
    if (typeof document !== 'undefined') document.documentElement.lang = language.locale
    listeners.forEach(listener => listener())
  }
}

if (typeof document !== 'undefined') document.documentElement.lang = language.locale
