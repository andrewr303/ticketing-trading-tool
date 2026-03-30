import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

try {
  const { default: App } = await import('./App.tsx')
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
} catch (err) {
  const root = document.getElementById('root')!
  root.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0f1a;color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:1rem">
      <div style="max-width:24rem;text-align:center;background:#111827;border:1px solid #1f2937;border-radius:0.5rem;padding:1.5rem">
        <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem">Failed to Start</h2>
        <p style="font-size:0.875rem;color:#9ca3af;margin-bottom:1rem">${err instanceof Error ? err.message : 'An unexpected error occurred.'}</p>
        <button onclick="window.location.reload()" style="background:#10b981;color:#000;border:none;border-radius:0.25rem;padding:0.5rem 1rem;font-size:0.875rem;font-weight:500;cursor:pointer">Reload Page</button>
      </div>
    </div>
  `
  console.error('Application failed to start:', err)
}
