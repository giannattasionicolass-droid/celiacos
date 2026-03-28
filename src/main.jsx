import React, { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app.jsx'

const APP_BUILD_ID = typeof __APP_BUILD_ID__ === 'string' ? __APP_BUILD_ID__ : 'unknown'
const REMOTE_VERSION_URL = 'https://giannattasionicolass-droid.github.io/celiacos/app-version.json'
const APK_UPDATE_URL = 'https://giannattasionicolass-droid.github.io/celiacos/celiashop-android.apk'

const esCapacitorNativo = () => {
  try {
    if (typeof window === 'undefined') return false
    if (typeof window.Capacitor === 'undefined') return false
    if (typeof window.Capacitor.isNativePlatform === 'function') {
      return Boolean(window.Capacitor.isNativePlatform())
    }
    return true
  } catch {
    return false
  }
}

const buildVersionCandidates = () => {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const urls = [
    REMOTE_VERSION_URL,
    `${origin}/celiacos/app-version.json`,
    `${origin}/app-version.json`,
    `${import.meta.env.BASE_URL || '/'}app-version.json`,
  ]

  return Array.from(new Set(
    urls
      .map((url) => String(url || '').trim())
      .filter(Boolean)
  ))
}

const fetchRemoteBuildId = async () => {
  const candidates = buildVersionCandidates()

  for (const rawUrl of candidates) {
    const separator = rawUrl.includes('?') ? '&' : '?'
    const url = `${rawUrl}${separator}ts=${Date.now()}`

    try {
      const response = await fetch(url, { cache: 'no-store' })
      if (!response.ok) continue
      const json = await response.json().catch(() => null)
      const buildId = String(json?.buildId || '').trim()
      if (buildId) return buildId
    } catch {
      // Intentamos el siguiente candidate.
    }
  }

  return null
}

const iniciarChequeoActualizacionNativa = () => {
  if (!esCapacitorNativo()) return

  let checkInProgress = false

  const ejecutarChequeo = async () => {
    if (checkInProgress) return
    checkInProgress = true

    try {
      const remoteBuildId = await fetchRemoteBuildId()
      if (!remoteBuildId || remoteBuildId === APP_BUILD_ID) return

      const dismissedBuild = String(localStorage.getItem('apkUpdateDismissedBuild') || '')
      if (dismissedBuild === remoteBuildId) return

      const aceptar = window.confirm('Hay una nueva versión de la APK disponible. ¿Querés descargarla ahora?')
      if (!aceptar) {
        localStorage.setItem('apkUpdateDismissedBuild', remoteBuildId)
        return
      }

      localStorage.removeItem('apkUpdateDismissedBuild')
      window.location.href = `${APK_UPDATE_URL}?build=${encodeURIComponent(remoteBuildId)}&ts=${Date.now()}`
    } finally {
      checkInProgress = false
    }
  }

  window.addEventListener('focus', ejecutarChequeo)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void ejecutarChequeo()
    }
  })

  // Primer chequeo al iniciar + chequeo periódico.
  void ejecutarChequeo()
  window.setInterval(() => {
    void ejecutarChequeo()
  }, 2 * 60 * 1000)
}

// Registrar Service Worker solo en web/PWA, NO en Capacitor nativo
if ('serviceWorker' in navigator && !window.Capacitor) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {})
  })
}

iniciarChequeoActualizacionNativa()

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-red-50 text-red-900 p-4">
          <div className="max-w-lg text-center border border-red-200 bg-white shadow-lg rounded-2xl p-8">
            <h1 className="text-2xl font-black mb-4">Ups, algo falló</h1>
            <p className="mb-4">Ocurrió un error en la app. Refresca la página o intenta más tarde.</p>
            <pre className="text-left text-xs text-gray-600 bg-gray-100 rounded p-3 overflow-x-auto">{String(this.state.error)}</pre>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
