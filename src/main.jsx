import React, { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app.jsx'

const APP_BUILD_ID = typeof __APP_BUILD_ID__ === 'string' ? __APP_BUILD_ID__ : 'unknown'
const REMOTE_APK_VERSION_URL = 'https://giannattasionicolass-droid.github.io/celiacos/apk-version.json'
const APK_UPDATE_URL = 'https://giannattasionicolass-droid.github.io/celiacos/celiashop-android.apk'
const APK_UPDATE_MODAL_ID = 'apk-update-required-modal'
const APK_UPDATE_STYLE_ID = 'apk-update-required-style'

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

const aplicarClasePlataforma = () => {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('native-app', esCapacitorNativo())
}

const buildVersionCandidates = () => {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const urls = [
    REMOTE_APK_VERSION_URL,
    `${origin}/celiacos/apk-version.json`,
    `${origin}/apk-version.json`,
    `${import.meta.env.BASE_URL || '/'}apk-version.json`,
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
      const buildId = String(json?.apkBuildId || json?.buildId || '').trim()
      if (buildId) return buildId
    } catch {
      // Intentamos el siguiente candidate.
    }
  }

  return null
}

const abrirDescargaApkExterna = (buildId) => {
  const urlFinal = `${APK_UPDATE_URL}?build=${encodeURIComponent(buildId)}&ts=${Date.now()}`

  try {
    const enlace = document.createElement('a')
    enlace.href = urlFinal
    enlace.target = '_blank'
    enlace.rel = 'noopener noreferrer'
    document.body.appendChild(enlace)
    enlace.click()
    document.body.removeChild(enlace)
  } catch {
    window.open(urlFinal, '_blank', 'noopener,noreferrer')
  }
}

const asegurarEstilosActualizacion = () => {
  if (typeof document === 'undefined') return
  if (document.getElementById(APK_UPDATE_STYLE_ID)) return

  const style = document.createElement('style')
  style.id = APK_UPDATE_STYLE_ID
  style.textContent = `
    #${APK_UPDATE_MODAL_ID} {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background:
        radial-gradient(circle at top, rgba(255,255,255,0.18), transparent 35%),
        linear-gradient(180deg, rgba(12, 30, 17, 0.96), rgba(8, 19, 12, 0.985));
      backdrop-filter: blur(10px);
      font-family: "Segoe UI", sans-serif;
    }

    #${APK_UPDATE_MODAL_ID} .apk-update-card {
      width: min(100%, 420px);
      border-radius: 28px;
      padding: 28px 24px;
      color: #10311d;
      background: linear-gradient(180deg, #f8fff8 0%, #ecfff0 100%);
      box-shadow: 0 32px 80px rgba(0, 0, 0, 0.38);
      border: 1px solid rgba(20, 110, 52, 0.18);
    }

    #${APK_UPDATE_MODAL_ID} .apk-update-chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 999px;
      background: #10311d;
      color: #effff2;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    #${APK_UPDATE_MODAL_ID} h2 {
      margin: 18px 0 10px;
      font-size: 28px;
      line-height: 1.05;
      font-weight: 900;
      color: #0c2516;
    }

    #${APK_UPDATE_MODAL_ID} p {
      margin: 0;
      font-size: 15px;
      line-height: 1.6;
      color: #29563b;
    }

    #${APK_UPDATE_MODAL_ID} .apk-update-meta {
      margin-top: 18px;
      padding: 14px 16px;
      border-radius: 18px;
      background: rgba(16, 49, 29, 0.06);
      color: #23442f;
      font-size: 13px;
      line-height: 1.5;
    }

    #${APK_UPDATE_MODAL_ID} .apk-update-actions {
      display: grid;
      gap: 12px;
      margin-top: 22px;
    }

    #${APK_UPDATE_MODAL_ID} button {
      appearance: none;
      border: 0;
      border-radius: 18px;
      min-height: 54px;
      padding: 14px 18px;
      font-size: 15px;
      font-weight: 800;
      cursor: pointer;
      transition: transform 0.18s ease, opacity 0.18s ease, box-shadow 0.18s ease;
    }

    #${APK_UPDATE_MODAL_ID} button:hover {
      transform: translateY(-1px);
    }

    #${APK_UPDATE_MODAL_ID} button:active {
      transform: translateY(0);
    }

    #${APK_UPDATE_MODAL_ID} .apk-update-primary {
      color: #effff2;
      background: linear-gradient(135deg, #146c34 0%, #0d9f4f 100%);
      box-shadow: 0 16px 36px rgba(13, 108, 52, 0.28);
    }

    #${APK_UPDATE_MODAL_ID} .apk-update-secondary {
      color: #10311d;
      background: rgba(16, 49, 29, 0.08);
    }

    #${APK_UPDATE_MODAL_ID} .apk-update-note {
      margin-top: 14px;
      font-size: 12px;
      color: #4a6c58;
      text-align: center;
    }
  `

  document.head.appendChild(style)
}

const crearModalActualizacion = () => {
  if (typeof document === 'undefined') return null

  asegurarEstilosActualizacion()

  let modal = document.getElementById(APK_UPDATE_MODAL_ID)
  if (modal) return modal

  modal = document.createElement('div')
  modal.id = APK_UPDATE_MODAL_ID
  modal.setAttribute('role', 'dialog')
  modal.setAttribute('aria-modal', 'true')
  modal.setAttribute('aria-labelledby', 'apk-update-required-title')
  modal.innerHTML = `
    <div class="apk-update-card">
      <span class="apk-update-chip">Actualizacion requerida</span>
      <h2 id="apk-update-required-title">Instala la ultima APK para continuar</h2>
      <p>Hay una version nueva obligatoria. Descargala e instalala desde este mismo cartel para que todos trabajen con la misma version.</p>
      <div class="apk-update-meta" data-apk-update-meta></div>
      <div class="apk-update-actions">
        <button type="button" class="apk-update-primary" data-apk-update-download>Descargar e instalar APK</button>
        <button type="button" class="apk-update-secondary" data-apk-update-retry>Volver a intentar</button>
      </div>
      <div class="apk-update-note">Si Android pregunta permisos o confirma la descarga, aceptalos para completar la instalacion.</div>
    </div>
  `

  document.body.appendChild(modal)
  return modal
}

const bloquearInteraccionApp = (bloquear) => {
  if (typeof document === 'undefined') return
  document.documentElement.style.overflow = bloquear ? 'hidden' : ''
  document.body.style.overflow = bloquear ? 'hidden' : ''
}

const mostrarActualizacionObligatoria = (remoteBuildId) => {
  const modal = crearModalActualizacion()
  if (!modal) return

  const meta = modal.querySelector('[data-apk-update-meta]')
  const downloadButton = modal.querySelector('[data-apk-update-download]')
  const retryButton = modal.querySelector('[data-apk-update-retry]')

  if (meta) {
    meta.textContent = `Version instalada: ${APP_BUILD_ID}. Version disponible: ${remoteBuildId}.`
  }

  const iniciarDescarga = () => {
    abrirDescargaApkExterna(remoteBuildId)
    if (meta) {
      meta.textContent = `Descarga iniciada para la version ${remoteBuildId}. Si no se abre automaticamente, toca "Volver a intentar".`
    }
  }

  if (downloadButton) {
    downloadButton.onclick = iniciarDescarga
  }

  if (retryButton) {
    retryButton.onclick = iniciarDescarga
  }

  bloquearInteraccionApp(true)
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
      mostrarActualizacionObligatoria(remoteBuildId)
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

aplicarClasePlataforma()
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
