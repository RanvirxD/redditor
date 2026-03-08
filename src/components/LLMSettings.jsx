import { useState, useEffect, useRef } from 'react'
import { PROVIDERS, WEBLLM_MODELS, loadWebLLMModel, getLoadedModelId } from '../utils/llmTranslator'

const S = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, backdropFilter: 'blur(4px)',
  },
  modal: {
    background: '#0f0f1a', border: '1px solid #2a2a3a', borderRadius: 10,
    width: 500, maxHeight: '90vh', overflow: 'auto',
    boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
    fontFamily: "'JetBrains Mono', monospace",
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px', borderBottom: '1px solid #1e1e2e',
  },
  body: { padding: '20px' },
  tabs: { display: 'flex', gap: 4, marginBottom: 20 },
  tab: (a) => ({
    flex: 1, padding: '8px 0',
    background: a ? '#1a1a2e' : 'transparent',
    border: `1px solid ${a ? '#818cf8' : '#2a2a3a'}`,
    borderRadius: 6, color: a ? '#818cf8' : '#6b6b8a',
    fontSize: 11, cursor: 'pointer',
    fontFamily: "'JetBrains Mono', monospace", transition: 'all 0.15s',
  }),
  label: { fontSize: 10, color: '#6b6b8a', display: 'block', marginBottom: 6, letterSpacing: '0.05em' },
  input: {
    width: '100%', background: '#111119', border: '1px solid #2a2a3a',
    borderRadius: 6, color: '#e2e2e8', fontSize: 12, padding: '9px 12px',
    outline: 'none', fontFamily: "'JetBrains Mono', monospace", boxSizing: 'border-box',
  },
  select: {
    width: '100%', background: '#111119', border: '1px solid #2a2a3a',
    borderRadius: 6, color: '#e2e2e8', fontSize: 12, padding: '9px 12px',
    outline: 'none', fontFamily: "'JetBrains Mono', monospace",
    cursor: 'pointer', boxSizing: 'border-box',
  },
  btn: (on) => ({
    padding: '9px 0', borderRadius: 6, border: `1px solid ${on ? '#818cf8' : '#2a2a3a'}`,
    background: on ? '#818cf8' : 'transparent',
    color: on ? '#fff' : '#4a4a6a',
    fontSize: 11, cursor: on ? 'pointer' : 'not-allowed',
    fontFamily: "'JetBrains Mono', monospace", transition: 'all 0.15s',
  }),
  field: { marginBottom: 16 },
  hint: { fontSize: 10, color: '#4a4a6a', marginTop: 5, lineHeight: 1.6 },
  success: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: '#0d2a1a', border: '1px solid #4ade80',
    borderRadius: 4, padding: '5px 10px', fontSize: 10, color: '#4ade80', marginTop: 10,
  },
  error: {
    background: '#2a0d0d', border: '1px solid #f87171',
    borderRadius: 4, padding: '8px 12px', fontSize: 10, color: '#f87171', marginTop: 10,
  },
  providerBtn: (a) => ({
    flex: 1, padding: '8px 4px', borderRadius: 6,
    border: `1px solid ${a ? '#818cf8' : '#1e1e2e'}`,
    background: a ? '#1a1a2e' : '#111119',
    color: a ? '#e2e2e8' : '#6b6b8a',
    fontSize: 10, cursor: 'pointer',
    fontFamily: "'JetBrains Mono', monospace", transition: 'all 0.15s',
    textAlign: 'center',
  }),
}

function OnlineTab({ settings, onSave }) {
  const [providerId, setProviderId] = useState(settings.providerId || 'megallm')
  const [apiKey, setApiKey]         = useState(settings.apiKey || '')
  const [modelId, setModelId]       = useState(settings.modelId || '')
  const [saved, setSaved]           = useState(false)
  const [testing, setTesting]       = useState(false)
  const [testResult, setTestResult] = useState(null)

  const provider = PROVIDERS.find(p => p.id === providerId)

  // Reset model when provider changes
  useEffect(() => {
    setModelId(provider?.models[0]?.id || '')
    setApiKey(settings[`apiKey_${providerId}`] || '')
    setTestResult(null)
  }, [providerId])

  function handleSave() {
    onSave({
      providerId,
      modelId: modelId || provider?.models[0]?.id,
      apiKey,
      [`apiKey_${providerId}`]: apiKey,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleTest() {
    if (!apiKey.trim()) return
    setTesting(true)
    setTestResult(null)
    try {
      const { translateWithAPI } = await import('../utils/llmTranslator')
      await translateWithAPI('int x = 1;', 'java', 'python', {
        apiKey: apiKey.trim(), providerId, modelId: modelId || provider?.models[0]?.id,
      })
      setTestResult({ ok: true, msg: 'Connection successful!' })
    } catch (e) {
      setTestResult({ ok: false, msg: e.message })
    }
    setTesting(false)
  }

  return (
    <div>
      {/* Provider selector */}
      <div style={S.field}>
        <span style={S.label}>PROVIDER</span>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {PROVIDERS.map(p => (
            <button key={p.id} onClick={() => setProviderId(p.id)} style={S.providerBtn(providerId === p.id)}>
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* API Key */}
      <div style={S.field}>
        <span style={S.label}>API KEY — {provider?.name?.toUpperCase()}</span>
        <input
          type="password"
          placeholder={provider?.keyPlaceholder}
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          style={S.input}
        />
        <p style={S.hint}>{provider?.keyHint}</p>
      </div>

      {/* Model */}
      <div style={S.field}>
        <span style={S.label}>MODEL</span>
        <select value={modelId} onChange={e => setModelId(e.target.value)} style={S.select}>
          {provider?.models.map(m => (
            <option key={m.id} value={m.id}>{m.badge}  {m.label}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleTest} disabled={!apiKey.trim() || testing} style={{ ...S.btn(!!apiKey.trim() && !testing), flex: 1 }}>
          {testing ? 'testing...' : 'test key'}
        </button>
        <button onClick={handleSave} disabled={!apiKey.trim()} style={{ ...S.btn(!!apiKey.trim()), flex: 2 }}>
          {saved ? '✓ saved' : 'save settings'}
        </button>
      </div>

      {testResult && (
        <div style={testResult.ok ? S.success : S.error}>
          {testResult.ok ? '✓' : '✗'} {testResult.msg}
        </div>
      )}
    </div>
  )
}

function OfflineTab({ settings, onSave }) {
  const [selectedModel, setSelectedModel] = useState(settings.webllmModelId || WEBLLM_MODELS[0].id)
  const [loading, setLoading]             = useState(false)
  const [progress, setProgress]           = useState(null)
  const [loaded, setLoaded]               = useState(getLoadedModelId)
  const [error, setError]                 = useState(null)

  async function handleLoad() {
    setLoading(true)
    setError(null)
    setProgress({ text: 'Starting...', progress: 0 })
    try {
      await loadWebLLMModel(selectedModel, p => setProgress(p))
      setLoaded(selectedModel)
      onSave({ webllmModelId: selectedModel })
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  const isLoaded = loaded === selectedModel

  return (
    <div>
      <p style={{ ...S.hint, marginBottom: 16, fontSize: 11, color: '#6b6b8a' }}>
        Runs entirely in your browser via WebGPU. Downloaded once, cached forever. No API key needed.
      </p>
      {WEBLLM_MODELS.map(m => (
        <div key={m.id} onClick={() => !loading && setSelectedModel(m.id)} style={{
          padding: '10px 12px', marginBottom: 8, cursor: 'pointer', borderRadius: 6,
          background: selectedModel === m.id ? '#1a1a2e' : '#111119',
          border: `1px solid ${selectedModel === m.id ? '#818cf8' : '#2a2a3a'}`,
          transition: 'all 0.15s',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#e2e2e8', fontSize: 12 }}>{m.label}</span>
            <span style={{ color: '#4a4a6a', fontSize: 10 }}>{m.size}</span>
          </div>
          <p style={{ ...S.hint, marginTop: 4, marginBottom: 0 }}>{m.description}</p>
          {loaded === m.id && <span style={{ ...S.success, marginTop: 6 }}>✓ loaded</span>}
        </div>
      ))}

      {progress && (
        <div style={{ marginTop: 4 }}>
          <p style={{ ...S.hint, marginBottom: 4 }}>{progress.text}</p>
          <div style={{ height: 4, background: '#1a1a28', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.round((progress.progress || 0) * 100)}%`, background: 'linear-gradient(90deg, #818cf8, #4ade80)', transition: 'width 0.3s' }} />
          </div>
        </div>
      )}
      {error && <div style={S.error}>✗ {error}</div>}
      <button onClick={handleLoad} disabled={loading || isLoaded} style={{ ...S.btn(!loading && !isLoaded), width: '100%', marginTop: 12 }}>
        {loading ? 'loading model...' : isLoaded ? '✓ model ready' : 'download & load model'}
      </button>
      {!navigator.gpu && (
        <div style={{ ...S.error, marginTop: 10 }}>⚠ WebGPU not detected. Use Chrome 113+ or Edge 113+.</div>
      )}
    </div>
  )
}

export default function LLMSettings({ onClose, onSave, settings }) {
  const [tab, setTab] = useState('online')
  const overlayRef = useRef(null)

  useEffect(() => {
    const h = (e) => { if (e.target === overlayRef.current) onClose() }
    const k = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', h)
    document.addEventListener('keydown', k)
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k) }
  }, [onClose])

  return (
    <div ref={overlayRef} style={S.overlay}>
      <div style={S.modal}>
        <div style={S.header}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#e2e2e8', fontFamily: "'Syne', sans-serif" }}>
            ⚙ LLM Settings
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b6b8a', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
        <div style={S.body}>
          <div style={S.tabs}>
            <button style={S.tab(tab === 'online')}  onClick={() => setTab('online')}>🌐 Online API</button>
            <button style={S.tab(tab === 'offline')} onClick={() => setTab('offline')}>📦 Offline (WebLLM)</button>
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
