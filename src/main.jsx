import React, { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app.jsx'

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
