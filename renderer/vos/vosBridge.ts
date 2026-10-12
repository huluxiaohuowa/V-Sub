import { normalizeLocale, type Locale } from './vosLocale'

interface VosLocaleBridge {
  getState?: () => Promise<{ locale?: unknown }>
  broadcast?: {
    on: (event: 'locale-change', handler: (state: { locale?: unknown }) => void) => () => void
  }
}



export function listenForVosBridgeLocale(apply: (locale: Locale) => void): () => void {
  let active = true
  let stop: (() => void) | undefined
  let timer: ReturnType<typeof setInterval> | undefined
  let revision = 0
  const started = Date.now()

  function connect() {
    const bridge = (window as any).vos_platform
    if (!bridge) return false
    const update = (state: { locale?: unknown }) => {
      const locale = normalizeLocale(state.locale)
      if (active && locale) apply(locale)
    }
    try {
      stop = bridge.broadcast?.on('locale-change', state => {
        revision++
        update(state)
      })
      const snapshotRevision = revision
      void bridge.getState?.().then(state => {
        if (revision === snapshotRevision) update(state)
      }).catch(() => undefined)
    } catch { /* Older bridges may not expose the state API. */ }
    return true
  }

  if (!connect() && window.parent !== window) {
    timer = setInterval(() => {
      if (connect() || Date.now() - started >= 10000) clearInterval(timer)
    }, 50)
  }
  return () => {
    active = false
    clearInterval(timer)
    stop?.()
  }
}
