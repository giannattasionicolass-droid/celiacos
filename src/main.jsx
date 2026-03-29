import React, { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app.jsx'

const APP_BUILD_ID = typeof __APP_BUILD_ID__ === 'string' ? __APP_BUILD_ID__ : 'unknown'
const REMOTE_APK_VERSION_URL = 'https://giannattasionicolass-droid.github.io/celiacos/apk-version.json'
const APK_UPDATE_URL = 'https://giannattasionicolass-droid.github.io/celiacos/celiashop-android.apk'
const APK_UPDATE_MODAL_ID = 'apk-update-required-modal'
const APK_UPDATE_STYLE_ID = 'apk-update-required-style'
const APK_FORCE_PROMPT_STORAGE_KEY = 'apkForcePromptTokenSeen'
const APK_FORCE_NOTIFICATION_STORAGE_KEY = 'apkForceNotificationTokenSeen'
const APK_UPDATE_NOTIFICATION_ID = 88001
const APK_DEBUG_PANEL_ID = 'apk-update-debug-panel'

let localNotificationBindingsReady = false
let lastRemoteBuildInfo = null

const apkDebugState = {
  isNative: false,
  localBuildId: APP_BUILD_ID,
  lastCheckAt: '',
  remoteBuildId: '',
  forcePromptToken: '',
  seenForcePromptToken: '',
  seenNotificationToken: '',
  notificationPermission: 'unknown',
  scheduleStatus: 'idle',
  scheduleMessage: '',
}

const esCapacitorNativo = () => {
  try {
    if (typeof window === 'undefined') return false
    const capacitor = window.Capacitor

    if (capacitor) {
      if (typeof capacitor.isNativePlatform === 'function') {
        if (capacitor.isNativePlatform()) return true
      }

      if (typeof capacitor.getPlatform === 'function') {
        const platform = String(capacitor.getPlatform() || '').toLowerCase()
        if (platform && platform !== 'web') return true
      }

      return true
    }

    const protocol = String(window.location?.protocol || '').toLowerCase()
    if (protocol === 'capacitor:' || protocol === 'file:') return true

    return false
  } catch {
    return false
  }
}

const leerStorageSeguro = (key) => {
  try {
    return String(localStorage.getItem(key) || '')
  } catch {
    return ''
  }
}

const renderApkDebugPanel = () => {
  if (typeof document === 'undefined') return
  if (!apkDebugState.isNative) return

  let panel = document.getElementById(APK_DEBUG_PANEL_ID)
  if (!panel) {
    panel = document.createElement('div')
    panel.id = APK_DEBUG_PANEL_ID
    panel.style.position = 'fixed'
    panel.style.left = '10px'
    panel.style.right = '10px'
    panel.style.bottom = '10px'
    panel.style.zIndex = '2147483647'
    panel.style.background = 'rgba(15, 23, 42, 0.95)'
    panel.style.color = '#e2e8f0'
    panel.style.border = '1px solid rgba(148, 163, 184, 0.4)'
    panel.style.borderRadius = '12px'
    panel.style.padding = '10px 12px'
    panel.style.fontFamily = 'monospace'
    panel.style.fontSize = '11px'
    panel.style.lineHeight = '1.35'
    panel.style.whiteSpace = 'pre-wrap'
    panel.style.wordBreak = 'break-word'
    panel.style.maxHeight = '42vh'
    panel.style.overflow = 'auto'
    document.body.appendChild(panel)
  }

  panel.textContent = [
    'APK DIAGNOSTICO',
    `native=${apkDebugState.isNative}`,
    `localBuild=${apkDebugState.localBuildId}`,
    `remoteBuild=${apkDebugState.remoteBuildId || '-'}`,
    `lastCheck=${apkDebugState.lastCheckAt || '-'}`,
    `forcePromptToken=${apkDebugState.forcePromptToken || '-'}`,
    `seenPromptToken=${apkDebugState.seenForcePromptToken || '-'}`,
    `seenNotifToken=${apkDebugState.seenNotificationToken || '-'}`,
    `notifPermission=${apkDebugState.notificationPermission}`,
    `scheduleStatus=${apkDebugState.scheduleStatus}`,
    `scheduleMessage=${apkDebugState.scheduleMessage || '-'}`,
  ].join('\n')
}

const actualizarApkDebugState = (partial = {}) => {
  Object.assign(apkDebugState, partial)
  apkDebugState.seenForcePromptToken = leerStorageSeguro(APK_FORCE_PROMPT_STORAGE_KEY)
  apkDebugState.seenNotificationToken = leerStorageSeguro(APK_FORCE_NOTIFICATION_STORAGE_KEY)
  renderApkDebugPanel()
}

const aplicarClasePlataforma = () => {
  if (typeof document === 'undefined') return
  const native = esCapacitorNativo()
  document.documentElement.classList.toggle('native-app', native)
  actualizarApkDebugState({ isNative: native })
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

const fetchRemoteBuildInfo = async () => {
  const candidates = buildVersionCandidates()
  actualizarApkDebugState({
    lastCheckAt: new Date().toISOString(),
    scheduleStatus: 'checking-remote',
    scheduleMessage: `candidates=${candidates.length}`,
  })

  for (const rawUrl of candidates) {
    const separator = rawUrl.includes('?') ? '&' : '?'
    const url = `${rawUrl}${separator}ts=${Date.now()}`

    try {
      const response = await fetch(url, { cache: 'no-store' })
      if (!response.ok) continue
      const json = await response.json().catch(() => null)
      const buildId = String(json?.apkBuildId || json?.buildId || '').trim()
      if (!buildId) continue

      const forcePromptAllDevices = Boolean(json?.forcePromptAllDevices)
      const forcePromptToken = String(json?.forcePromptToken || '').trim() || buildId

      actualizarApkDebugState({
        remoteBuildId: buildId,
        forcePromptToken,
        scheduleStatus: 'remote-ok',
        scheduleMessage: `source=${rawUrl}`,
      })

      return {
        buildId,
        forcePromptAllDevices,
        forcePromptToken,
      }
    } catch {
      // Intentamos el siguiente candidate.
    }
  }

  actualizarApkDebugState({
    scheduleStatus: 'remote-missing',
    scheduleMessage: 'no-build-id',
  })

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

const obtenerLocalNotificationsApi = async () => {
  if (!esCapacitorNativo()) return null

  try {
    const mod = await import('@capacitor/local-notifications')
    return mod?.LocalNotifications || null
  } catch {
    return null
  }
}

const prepararNotificacionesActualizacion = async (LocalNotifications) => {
  if (!LocalNotifications || localNotificationBindingsReady) return

  try {
    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: 'APK_UPDATE_ACTIONS',
          actions: [
            {
              id: 'UPDATE_NOW',
              title: 'Actualizar',
            },
          ],
        },
      ],
    })
  } catch {
    // Si el dispositivo no soporta acciones personalizadas, seguimos igual.
  }

  LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
    const actionId = String(event?.actionId || '').toUpperCase()
    const id = Number(event?.notification?.id)
    const buildId = String(event?.notification?.extra?.buildId || APP_BUILD_ID).trim() || APP_BUILD_ID

    if (id !== APK_UPDATE_NOTIFICATION_ID) return
    if (actionId && actionId !== 'UPDATE_NOW' && actionId !== 'TAP') return

    abrirDescargaApkExterna(buildId)
  })

  localNotificationBindingsReady = true
}

const pedirPermisoNotificaciones = async (LocalNotifications) => {
  if (!LocalNotifications) return false

  try {
    const permisoActual = await LocalNotifications.checkPermissions()
    actualizarApkDebugState({ notificationPermission: String(permisoActual?.display || 'unknown') })
    if (permisoActual?.display === 'granted') return true
  } catch {
    actualizarApkDebugState({ notificationPermission: 'check-error' })
    return false
  }

  try {
    const permisoNuevo = await LocalNotifications.requestPermissions()
    actualizarApkDebugState({ notificationPermission: String(permisoNuevo?.display || 'unknown') })
    return permisoNuevo?.display === 'granted'
  } catch {
    actualizarApkDebugState({ notificationPermission: 'request-error' })
    return false
  }
}

const emitirNotificacionActualizacion = async ({ buildId, forcePromptToken }) => {
  const tokenAviso = String(forcePromptToken || buildId || '').trim()
  if (!tokenAviso) return

  actualizarApkDebugState({
    remoteBuildId: buildId,
    forcePromptToken: tokenAviso,
    scheduleStatus: 'preparing',
    scheduleMessage: '',
  })

  const seenNotificationToken = (() => {
    try {
      return String(localStorage.getItem(APK_FORCE_NOTIFICATION_STORAGE_KEY) || '')
    } catch {
      return ''
    }
  })()

  if (seenNotificationToken === tokenAviso) {
    actualizarApkDebugState({
      scheduleStatus: 'skipped-token-seen',
      scheduleMessage: tokenAviso,
    })
    return
  }

  const LocalNotifications = await obtenerLocalNotificationsApi()
  if (!LocalNotifications) {
    actualizarApkDebugState({
      scheduleStatus: 'plugin-missing',
      scheduleMessage: '@capacitor/local-notifications unavailable',
    })
    return
  }

  const permisoConcedido = await pedirPermisoNotificaciones(LocalNotifications)
  if (!permisoConcedido) {
    actualizarApkDebugState({
      scheduleStatus: 'permission-denied',
      scheduleMessage: 'display permission not granted',
    })
    return
  }

  await prepararNotificacionesActualizacion(LocalNotifications)

  try {
    await LocalNotifications.createChannel({
      id: 'apk-updates',
      name: 'Actualizaciones CeliaShop',
      description: 'Avisos para instalar la ultima APK publicada.',
      importance: 5,
      visibility: 1,
      sound: 'default',
      vibration: true,
    })
  } catch {
    // Algunos dispositivos no requieren o no soportan canales custom.
  }

  try {
    await LocalNotifications.cancel({ notifications: [{ id: APK_UPDATE_NOTIFICATION_ID }] })
  } catch {
    // no-op
  }

  try {
    const triggerAt = new Date(Date.now() + 1800)

    await LocalNotifications.schedule({
      notifications: [
        {
          id: APK_UPDATE_NOTIFICATION_ID,
          title: 'Actualizacion obligatoria de CeliaShop',
          body: 'Toca para descargar la APK mas nueva y seguir usando la app.',
          actionTypeId: 'APK_UPDATE_ACTIONS',
          channelId: 'apk-updates',
          schedule: {
            at: triggerAt,
            allowWhileIdle: true,
          },
          ongoing: false,
          autoCancel: true,
          extra: {
            buildId,
          },
        },
      ],
    })

    localStorage.setItem(APK_FORCE_NOTIFICATION_STORAGE_KEY, tokenAviso)
    actualizarApkDebugState({
      scheduleStatus: 'scheduled-ok',
      scheduleMessage: `at=${triggerAt.toISOString()}`,
    })
  } catch {
    actualizarApkDebugState({
      scheduleStatus: 'schedule-error',
      scheduleMessage: 'LocalNotifications.schedule failed',
    })
    // Si falla la notificacion, mantenemos el modal obligatorio como respaldo.
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

const mostrarActualizacionObligatoria = ({ remoteBuildId, forcePromptToken, showEvenIfCurrent }) => {
  const modal = crearModalActualizacion()
  if (!modal) return

  const meta = modal.querySelector('[data-apk-update-meta]')
  const downloadButton = modal.querySelector('[data-apk-update-download]')
  const retryButton = modal.querySelector('[data-apk-update-retry]')

  if (meta) {
    meta.textContent = showEvenIfCurrent
      ? `Aviso general activo para todos los dispositivos con APK. Version instalada: ${APP_BUILD_ID}. Build publicado: ${remoteBuildId}.`
      : `Version instalada: ${APP_BUILD_ID}. Version disponible: ${remoteBuildId}.`
  }

  const iniciarDescarga = () => {
    if (forcePromptToken) {
      localStorage.setItem(APK_FORCE_PROMPT_STORAGE_KEY, forcePromptToken)
    }
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
  let checkInProgress = false

  const ejecutarChequeo = async () => {
    if (checkInProgress) return
    if (!esCapacitorNativo()) return
    checkInProgress = true

    try {
      const remoteInfo = await fetchRemoteBuildInfo()
      lastRemoteBuildInfo = remoteInfo
      if (!remoteInfo?.buildId) {
        actualizarApkDebugState({
          scheduleStatus: 'no-remote-build',
          scheduleMessage: 'remoteInfo empty',
        })
        return
      }

      const showBecauseBuildChanged = remoteInfo.buildId !== APP_BUILD_ID
      const seenForcePromptToken = (() => {
        try {
          return String(localStorage.getItem(APK_FORCE_PROMPT_STORAGE_KEY) || '')
        } catch {
          return ''
        }
      })()
      const showBecauseForcedGlobalPrompt = remoteInfo.forcePromptAllDevices
        && remoteInfo.forcePromptToken
        && seenForcePromptToken !== remoteInfo.forcePromptToken

      actualizarApkDebugState({
        remoteBuildId: remoteInfo.buildId,
        forcePromptToken: remoteInfo.forcePromptToken,
        scheduleStatus: 'decision',
        scheduleMessage: `buildChanged=${showBecauseBuildChanged} forced=${showBecauseForcedGlobalPrompt}`,
      })

      if (!showBecauseBuildChanged && !showBecauseForcedGlobalPrompt) {
        actualizarApkDebugState({
          scheduleStatus: 'up-to-date-no-force',
          scheduleMessage: '',
        })
        return
      }

      await emitirNotificacionActualizacion({
        buildId: remoteInfo.buildId,
        forcePromptToken: remoteInfo.forcePromptToken,
      })

      mostrarActualizacionObligatoria({
        remoteBuildId: remoteInfo.buildId,
        forcePromptToken: remoteInfo.forcePromptToken,
        showEvenIfCurrent: showBecauseForcedGlobalPrompt && !showBecauseBuildChanged,
      })
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

  // En algunos dispositivos el bridge nativo se inicializa unos segundos más tarde.
  window.setTimeout(() => {
    void ejecutarChequeo()
  }, 3 * 1000)

  window.setTimeout(() => {
    void ejecutarChequeo()
  }, 8 * 1000)

  window.setInterval(() => {
    void ejecutarChequeo()
  }, 2 * 60 * 1000)
}

// Registrar Service Worker solo en web/PWA, NO en Capacitor nativo
if ('serviceWorker' in navigator && !esCapacitorNativo()) {
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
