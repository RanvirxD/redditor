/**
 * LLMSettings.jsx
 * Modal for configuring online API key or offline WebLLM model
 */

import { useState, useEffect, useRef } from 'react'
import { LLM_MODELS, WEBLLM_MODELS, loadWebLLMModel, getLoadedModelId } from '../utils/llmTranslator'

const MEGALLM_BASE_URL = 'https://ai.megallm.io/v1'

const S = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(4px)',
  },
  modal: {
    background: '#0f0f1a',
    border: '1px solid #2a2a3a',
    borderRadius: 10,
    width: 480,
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
    fontFamily: "'JetBrains Mono', monospace",
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid #1e1e2e',
  },
  title: {
    fontSize: 14, fontWeight: 700, color: '#e2e2e8',
    fontFamily: "'Syne', sans-serif",
  },
  closeBtn: {
    background: 'none', border: 'none', color: '#6b6b8a',
    fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: '0 4px',
  },
  body: { padding: '20px' },
  tabs: { display: 'flex', gap: 4, marginBottom: 20 },
  tab: (active) => ({
    flex: 1,
    padding: '8px 0',
    background: active ? '#1a1a2e' : 'transparent',
    border: `1px solid ${active ? '#818cf8' : '#2a2a3a'}`,
    borderRadius: 6,
    color: active ? '#818cf8' : '#6b6b8a',
    fontSize: 11,
    cursor: 'pointer',
    fontFamily: "'JetBrains Mono', monospace",
    transition: 'all 0.15s',
  }),
  label: {
    fontSize: 10, color: '#6b6b8a',
    display: 'block', marginBottom: 6, letterSpacing: '0.05em',
  },
  input: {
    width: '100%',
    background: '#111119',
    border: '1px solid #2a2a3a',
    borderRadius: 6,
    color: '#e2e2e8',
    fontSize: 12,
    padding: '9px 12px',
    outline: 'none',
    fontFamily: "'JetBrains Mono', monospace",
    boxSizing: 'border-box',
  },
  select: {
    width: '100%',
    background: '#111119',
    border: '1px solid #2a2a3a',
    borderRadius: 6,
    color: '#e2e2e8',
    fontSize: 12,
    padding: '9px 12px',
    outline: 'none',
    fontFamily: "'JetBrains Mono', monospace",
    cursor: 'pointer',
    boxSizing: 'border-box',
  },
  saveBtn: (enabled) => ({
    width: '100%',
    marginTop: 16,
    padding: '10px 0',
    background: enabled ? '#818cf8' : '#1a1a28',
    border: `1px solid ${enabled ? '#818cf8' : '#2a2a3a'}`,
    borderRadius: 6,
    color: enabled ? '#fff' : '#4a4a6a',
    fontSize: 12,
    cursor: enabled ? 'pointer' : 'not-allowed',
    fontFamily: "'JetBrains Mono', monospace",
    transition: 'all 0.15s',
  }),
  field: { marginBottom: 16 },
  hint: { fontSize: 10, color: '#4a4a6a', marginTop: 6, lineHeight: 1.5 },
  modelCard: (selected) => ({
    padding: '10px 12px',
    background: selected ? '#1a1a2e' : '#111119',
    border: `1px solid ${selected ? '#818cf8' : '#2a2a3a'}`,
    borderRadius: 6,
    cursor: 'pointer',
    marginBottom: 8,
    transition: 'all 0.15s',
  }),
  progressBar: (pct) => ({
    height: 4,
    background: '#1a1a28',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 8,
    position: 'relative',
  }),
  progressFill: (pct) => ({
    height: '100%',
    width: `${Math.round(pct * 100)}%`,
    background: 'linear-gradient(90deg, #818cf8, #4ade80)',
    borderRadius: 2,
    transition: 'width 0.3s',
  }),
  successBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: '#0d2a1a', border: '1px solid #4ade80',
    borderRadius: 4, padding: '4px 10px',
    fontSize: 10, color: '#4ade80', marginTop: 12,
  },
  errorBadge: {
    background: '#2a0d0d', border: '1px solid #f87171',
    borderRadius: 4, padding: '8px 12px',
    fontSize: 10, color: '#f87171', marginTop: 12,
  },
}

// ─── Online Tab ───────────────────────────────────────────────────────────────

function OnlineTab({ settings, onSave }) {
  const [apiKey, setApiKey] = useState(settings.apiKey || '')
  const [modelId, setModelId] = useState(settings.modelId || LLM_MODELS[0].id)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

  function handleSave() {
    onSave({ apiKey: apiKey.trim(), modelId, baseUrl: MEGALLM_BASE_URL })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch(MEGALLM_BASE_URL.replace(/\/$/, '') + '/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: 'user', content: 'Reply with just: OK' }],
          max_tokens: 5,
        }),
      })
      if (res.ok) {
        setTestResult({ ok: true, msg: 'API key works!' })
      } else {
        const e = await res.json().catch(() => ({}))
        setTestResult({ ok: false, msg: e?.error?.message || `Error ${res.status}` })
      }
    } catch (e) {
      setTestResult({ ok: false, msg: e.message })
    }
    setTesting(false)
  }

  const currentModel = LLM_MODELS.find(m => m.id === modelId)

  return (
    <div>
      <div style={S.field}>
        <span style={S.label}>MEGALLM API KEY</span>
        <input
          type="password"
          placeholder="sk-..."
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          style={S.input}
        />
        <p style={S.hint}>
          Get your key from MegaLLM dashboard → API Keys.<br/>
          Stored locally in your browser only.
        </p>
      </div>

      <div style={S.field}>
        <span style={S.label}>MODEL</span>
        <select value={modelId} onChange={e => setModelId(e.target.value)} style={S.select}>
          {LLM_MODELS.map(m => (
            <option key={m.id} value={m.id}>
              {m.badge}  {m.label} ({m.provider})
            </option>
          ))}
        </select>
        {currentModel && (
          <p style={S.hint}>
            {currentModel.badge} · {currentModel.provider}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button
          onClick={handleTest}
          disabled={!apiKey.trim() || testing}
          style={{
            ...S.saveBtn(!!apiKey.trim() && !testing),
            flex: 1,
            background: 'transparent',
            border: '1px solid #2a2a3a',
            color: apiKey.trim() ? '#6b6b8a' : '#3a3a5a',
          }}
        >
          {testing ? 'testing...' : 'test key'}
        </button>
        <button
          onClick={handleSave}
          disabled={!apiKey.trim()}
          style={{ ...S.saveBtn(!!apiKey.trim()), flex: 2 }}
        >
          {saved ? '✓ saved' : 'save settings'}
        </button>
      </div>

      {testResult && (
        <div style={testResult.ok ? S.successBadge : S.errorBadge}>
          {testResult.ok ? '✓' : '✗'} {testResult.msg}
        </div>
      )}
    </div>
  )
}

// ─── Offline Tab ──────────────────────────────────────────────────────────────

function OfflineTab({ settings, onSave }) {
  const [selectedModel, setSelectedModel] = useState(
    settings.webllmModelId || WEBLLM_MODELS[0].id
  )
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(null)
  const [loaded, setLoaded] = useState(getLoadedModelId())
  const [error, setError] = useState(null)

  async function handleLoad() {
    setLoading(true)
    setError(null)
    setProgress({ text: 'Starting download...', progress: 0 })
    try {
      await loadWebLLMModel(selectedModel, (p) => setProgress(p))
      setLoaded(selectedModel)
      onSave({ webllmModelId: selectedModel })
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  const isLoaded = loaded === selectedModel

  return (
    <div>
      <p style={{ ...S.hint, marginBottom: 16, fontSize: 11, color: '#6b6b8a' }}>
        Model runs entirely in your browser via WebGPU.<br/>
        Downloaded once, cached forever. No API key needed.
      </p>

      {WEBLLM_MODELS.map(m => (
        <div
          key={m.id}
          onClick={() => !loading && setSelectedModel(m.id)}
          style={S.modelCard(selectedModel === m.id)}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#e2e2e8', fontSize: 12 }}>{m.label}</span>
            <span style={{ color: '#4a4a6a', fontSize: 10 }}>{m.size}</span>
          </div>
          <p style={{ ...S.hint, marginTop: 4, marginBottom: 0 }}>{m.description}</p>
          {loaded === m.id && (
            <span style={{ ...S.successBadge, marginTop: 6 }}>✓ loaded</span>
          )}
        </div>
      ))}

      {progress && (
        <div style={{ marginTop: 4 }}>
          <p style={{ ...S.hint, marginBottom: 4 }}>{progress.text}</p>
          <div style={S.progressBar()}>
            <div style={S.progressFill(progress.progress || 0)} />
          </div>
        </div>
      )}

      {error && <div style={S.errorBadge}>✗ {error}</div>}

      <button
        onClick={handleLoad}
        disabled={loading || isLoaded}
        style={S.saveBtn(!loading && !isLoaded)}
      >
        {loading ? 'loading model...' : isLoaded ? '✓ model ready' : 'download & load model'}
      </button>

      {!navigator.gpu && (
        <div style={{ ...S.errorBadge, marginTop: 12 }}>
          ⚠ WebGPU not detected. Use Chrome 113+ or Edge 113+ for offline mode.
        </div>
      )}
    </div>
  )
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function LLMSettings({ onClose, onSave, settings }) {
  const [tab, setTab] = useState('online')
  const overlayRef = useRef(null)

  useEffect(() => {
    function handler(e) {
      if (e.target === overlayRef.current) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  // Escape key closes
  useEffect(() => {
    function handler(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div ref={overlayRef} style={S.overlay}>
      <div style={S.modal}>
        <div style={S.header}>
          <span style={S.title}>⚙ LLM Settings</span>
          <button onClick={onClose} style={S.closeBtn}>×</button>
        </div>

        <div style={S.body}>
          <div style={S.tabs}>
            <button style={S.tab(tab === 'online')} onClick={() => setTab('online')}>
              🌐 Online API
            </button>
            <button style={S.tab(tab === 'offline')} onClick={() => setTab('offline')}>
              📦 Offline (WebLLM)
            </button>
          </div>

          {tab === 'online'
            ? <OnlineTab settings={settings} onSave={onSave} />
            : <OfflineTab settings={settings} onSave={onSave} />
          }
        </div>
      </div>
    </div>
  )
}
