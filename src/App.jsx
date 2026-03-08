import { useState, useEffect, useRef, useCallback } from 'react'
import EditorPanel from './components/EditorPanel'
import LLMSettings from './components/LLMSettings'
import { translate } from './utils/translator'
import { translateWithAPI, translateWithWebLLM, isWebLLMReady, PROVIDERS } from './utils/llmTranslator'

const LANGUAGES = [
  { value: 'java',   label: 'Java' },
  { value: 'python', label: 'Python' },
  { value: 'cpp',    label: 'C++' },
]

const DEBOUNCE_MS = 600

// Auto-run interval options for LLM (ms). 0 = manual only
const LLM_INTERVALS = [
  { label: 'Manual', value: 0 },
  { label: '5s',     value: 5000 },
  { label: '10s',    value: 10000 },
  { label: '20s',    value: 20000 },
  { label: '30s',    value: 30000 },
]

const DEFAULT_CODE = `public class Main {
    public static void main(String[] args) {
        int x = 10;
        String name = "Redditor";
        System.out.println(name);

        for (int i = 0; i < x; i++) {
            if (i % 2 == 0) {
                System.out.println(i);
            }
        }
    }
}`

function loadSettings() {
  try { return JSON.parse(localStorage.getItem('redditor_llm_settings') || '{}') }
  catch { return {} }
}
function saveSettings(s) {
  localStorage.setItem('redditor_llm_settings', JSON.stringify(s))
}

const S = {
  btn: (active) => ({
    background: active ? '#818cf8' : '#1a1a28',
    border: `1px solid ${active ? '#818cf8' : '#2a2a3a'}`,
    borderRadius: 4, color: active ? '#fff' : '#6b6b8a',
    fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
    padding: '5px 14px', cursor: 'pointer',
  }),
  select: {
    background: '#111119', border: '1px solid #2a2a3a', borderRadius: 4,
    color: '#e2e2e8', fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
    padding: '5px 10px', cursor: 'pointer', outline: 'none',
  },
  label: { fontSize: 11, color: '#6b6b8a', fontFamily: "'JetBrains Mono', monospace" },
}

// ─── Mode Toggle ──────────────────────────────────────────────────────────────

function ModeToggle({ mode, onToggle, onOpenSettings }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, background: '#111119', border: '1px solid #2a2a3a', borderRadius: 6, padding: 3 }}>
      {['ast', 'llm'].map(m => (
        <button key={m} onClick={() => onToggle(m)} style={{
          padding: '4px 12px', borderRadius: 4, border: 'none',
          background: mode === m ? '#818cf8' : 'transparent',
          color: mode === m ? '#fff' : '#6b6b8a',
          fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
          cursor: 'pointer', transition: 'all 0.15s', textTransform: 'uppercase',
        }}>{m}</button>
      ))}
      {mode === 'llm' && (
        <button onClick={onOpenSettings} title="LLM Settings" style={{
          padding: '4px 7px', borderRadius: 4, border: 'none',
          background: 'transparent', color: '#818cf8', fontSize: 14, cursor: 'pointer', lineHeight: 1,
        }}>⚙</button>
      )}
    </div>
  )
}

// ─── Run LLM Button (smart) ───────────────────────────────────────────────────

function RunLLMButton({ codeChanged, onRun, interval, onIntervalChange, anyTranslating }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {/* Main button */}
      <button
        onClick={onRun}
        disabled={anyTranslating}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 14px', borderRadius: 4, border: 'none',
          background: codeChanged ? '#818cf8' : '#1a1a2e',
          color: codeChanged ? '#fff' : '#818cf8',
          fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
          cursor: anyTranslating ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
          boxShadow: codeChanged ? '0 0 12px rgba(129,140,248,0.4)' : 'none',
          outline: `1px solid ${codeChanged ? '#818cf8' : '#2a2a3a'}`,
        }}
      >
        {anyTranslating ? (
          <>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#facc15', boxShadow: '0 0 6px #facc15', animation: 'pulse 1s infinite' }} />
            running...
          </>
        ) : (
          <>
            ⚡ {codeChanged ? 'Run LLM  (code changed)' : 'Run LLM'}
          </>
        )}
      </button>

      {/* Auto-run interval selector */}
      <select
        value={interval}
        onChange={e => onIntervalChange(Number(e.target.value))}
        style={{ ...S.select, fontSize: 10, padding: '5px 8px' }}
        title="Auto-run interval"
      >
        {LLM_INTERVALS.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  )
}

// ─── Translate Popover ────────────────────────────────────────────────────────

function TranslatePopover({ sourceLang, onConfirm, onClose }) {
  const [selected, setSelected] = useState([])
  const ref = useRef(null)
  const available = LANGUAGES.filter(l => l.value !== sourceLang)
  function toggle(val) {
    setSelected(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])
  }
  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])

  return (
    <div ref={ref} style={{
      position: 'absolute', top: '100%', left: 0, marginTop: 6,
      background: '#111119', border: '1px solid #2a2a3a', borderRadius: 6,
      padding: '12px 14px', zIndex: 100, minWidth: 170,
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
    }}>
      <p style={{ ...S.label, marginBottom: 10, color: '#4a4a6a', fontSize: 10 }}>select targets</p>
      {available.map(l => (
        <label key={l.value} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer' }}>
          <div onClick={() => toggle(l.value)} style={{
            width: 14, height: 14, borderRadius: 3,
            border: `1px solid ${selected.includes(l.value) ? '#818cf8' : '#3a3a5a'}`,
            background: selected.includes(l.value) ? '#818cf8' : 'transparent',
            flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {selected.includes(l.value) && (
              <svg width="8" height="8" viewBox="0 0 8 8">
                <polyline points="1,4 3,6 7,2" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              </svg>
            )}
          </div>
          <span style={{ ...S.label, color: '#e2e2e8', fontSize: 12 }}>{l.label}</span>
        </label>
      ))}
      <button
        disabled={selected.length === 0}
        onClick={() => { onConfirm(selected); onClose() }}
        style={{
          marginTop: 4, width: '100%',
          background: selected.length > 0 ? '#818cf8' : '#1a1a28',
          border: `1px solid ${selected.length > 0 ? '#818cf8' : '#2a2a3a'}`,
          borderRadius: 4, color: selected.length > 0 ? '#fff' : '#4a4a6a',
          fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
          padding: '6px 0', cursor: selected.length > 0 ? 'pointer' : 'not-allowed',
        }}
      >translate</button>
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const sourceLang = 'java'
  const [targetLangs, setTargetLangs]   = useState([])
  const [sourceCode, setSourceCode]     = useState(DEFAULT_CODE)
  const [translated, setTranslated]     = useState({})
  const [status, setStatus]             = useState({})
  const [popoverOpen, setPopoverOpen]   = useState(false)
  const [mode, setMode]                 = useState('ast')
  const [llmSubMode, setLlmSubMode]     = useState('online')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [llmSettings, setLlmSettings]   = useState(loadSettings)
  const [llmError, setLlmError]         = useState(null)
  const [llmInterval, setLlmInterval]   = useState(0)        // auto-run ms
  const [lastRunCode, setLastRunCode]   = useState('')       // code at last LLM run
  const debounceRef   = useRef(null)
  const intervalRef   = useRef(null)

  const codeChanged = mode === 'llm' && sourceCode !== lastRunCode && targetLangs.length > 0
  const anyTranslating = Object.values(status).some(s => s === 'translating')

  // ── AST translation ───────────────────────────────────────────────────────

  const runAST = useCallback((code, src, targets) => {
    const result = {}, newStatus = {}
    for (const tgt of targets) {
      result[tgt] = translate(code, src, tgt)
      newStatus[tgt] = 'ready'
    }
    setTranslated(result)
    setStatus(newStatus)
  }, [])

  // ── LLM translation ───────────────────────────────────────────────────────

  const runLLM = useCallback(async (code, src, targets) => {
    if (!targets.length) return
    setLlmError(null)
    const pending = {}
    for (const t of targets) pending[t] = 'translating'
    setStatus(pending)

    for (const tgt of targets) {
      try {
        let result
        if (llmSubMode === 'offline') {
          if (!isWebLLMReady()) throw new Error('No offline model loaded. Open ⚙ LLM Settings → Offline tab.')
          result = await translateWithWebLLM(code, src, tgt)
        } else {
          if (!llmSettings.apiKey) throw new Error('No API key set. Click ⚙ to configure.')
          result = await translateWithAPI(code, src, tgt, {
            apiKey: llmSettings.apiKey,
            providerId: llmSettings.providerId || 'megallm',
            modelId: llmSettings.modelId || 'alibaba-qwen3-coder-flash',
          })
        }
        setTranslated(prev => ({ ...prev, [tgt]: result }))
        setStatus(prev => ({ ...prev, [tgt]: 'llm_ready' }))
      } catch (e) {
        setStatus(prev => ({ ...prev, [tgt]: 'error' }))
        setLlmError(e.message)
      }
    }
    setLastRunCode(code)
  }, [llmSettings, llmSubMode])

  // ── AST: auto on keystroke ────────────────────────────────────────────────

  useEffect(() => {
    if (mode !== 'ast' || targetLangs.length === 0) return
    const p = {}
    for (const t of targetLangs) p[t] = 'translating'
    setStatus(p)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runAST(sourceCode, sourceLang, targetLangs), DEBOUNCE_MS)
    return () => clearTimeout(debounceRef.current)
  }, [sourceCode, sourceLang, targetLangs, mode, runAST])

  // ── LLM auto-interval ─────────────────────────────────────────────────────

  useEffect(() => {
    clearInterval(intervalRef.current)
    if (mode === 'llm' && llmInterval > 0 && targetLangs.length > 0) {
      intervalRef.current = setInterval(() => {
        runLLM(sourceCode, sourceLang, targetLangs)
      }, llmInterval)
    }
    return () => clearInterval(intervalRef.current)
  }, [mode, llmInterval, targetLangs, sourceCode, sourceLang, runLLM])

  // ── Switch mode → retranslate ─────────────────────────────────────────────

  useEffect(() => {
    if (targetLangs.length === 0) return
    if (mode === 'ast') runAST(sourceCode, sourceLang, targetLangs)
    if (mode === 'llm') runLLM(sourceCode, sourceLang, targetLangs)
  }, [mode]) // eslint-disable-line

  function handleModeToggle(newMode) {
    setMode(newMode)
    if (newMode === 'llm' && !llmSettings.apiKey && !isWebLLMReady()) setSettingsOpen(true)
  }

  function handleSaveSettings(newSettings) {
    const merged = { ...llmSettings, ...newSettings }
    setLlmSettings(merged)
    saveSettings(merged)
    if (newSettings.webllmModelId) setLlmSubMode('offline')
    else if (newSettings.apiKey !== undefined) setLlmSubMode('online')
  }

  function removeTarget(lang) {
    setTargetLangs(prev => prev.filter(l => l !== lang))
    setTranslated(prev => { const n = { ...prev }; delete n[lang]; return n })
    setStatus(prev => { const n = { ...prev }; delete n[lang]; return n })
  }

  const providerLabel = PROVIDERS.find(p => p.id === (llmSettings.providerId || 'megallm'))?.name || 'MegaLLM'
  const modelLabel = (llmSettings.modelId || 'qwen3-coder-flash').split('/').pop().split('-').slice(0,3).join('-')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a0a0f', overflow: 'hidden' }}>

      {/* ── Top Bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 20px', background: '#0d0d14',
        borderBottom: '1px solid #1e1e2e', flexShrink: 0, position: 'relative',
      }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, background: 'linear-gradient(135deg, #818cf8, #4ade80)', borderRadius: 6 }} />
          <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 16, letterSpacing: '0.04em', color: '#e2e2e8' }}>
            Redditor
          </span>
          <span style={{ fontSize: 10, color: '#6b6b8a', fontFamily: "'JetBrains Mono', monospace", background: '#1a1a28', padding: '2px 8px', borderRadius: 10, border: '1px solid #2a2a3a' }}>
            {mode === 'ast' ? 'AST Engine' : `${providerLabel} · ${modelLabel}`}
          </span>
        </div>

        {/* Center */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
          <span style={S.label}>source</span>
          <div style={{ ...S.select, cursor: 'default', color: '#e2e2e8' }}>Java</div>

          <ModeToggle mode={mode} onToggle={handleModeToggle} onOpenSettings={() => setSettingsOpen(true)} />

          {/* Translate-to */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setPopoverOpen(p => !p)} style={{ ...S.btn(popoverOpen), display: 'flex', alignItems: 'center', gap: 6 }}>
              Translate To
              <svg width="8" height="5" viewBox="0 0 8 5" style={{ transform: popoverOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                <path d="M0 0l4 5 4-5z" fill={popoverOpen ? '#fff' : '#6b6b8a'} />
              </svg>
            </button>
            {popoverOpen && (
              <TranslatePopover sourceLang={sourceLang} onConfirm={s => setTargetLangs(s)} onClose={() => setPopoverOpen(false)} />
            )}
          </div>

          {/* LLM Run button */}
          {mode === 'llm' && targetLangs.length > 0 && (
            <RunLLMButton
              codeChanged={codeChanged}
              onRun={() => runLLM(sourceCode, sourceLang, targetLangs)}
              interval={llmInterval}
              onIntervalChange={setLlmInterval}
              anyTranslating={anyTranslating}
            />
          )}

          {/* Target chips */}
          {targetLangs.map(tgt => {
            const label = LANGUAGES.find(l => l.value === tgt)?.label
            return (
              <div key={tgt} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1a1a28', border: '1px solid #2a2a3a', borderRadius: 4, padding: '4px 8px' }}>
                <span style={{ ...S.label, color: '#e2e2e8', fontSize: 11 }}>{label}</span>
                <button onClick={() => removeTarget(tgt)} style={{ background: 'none', border: 'none', color: '#4a4a6a', cursor: 'pointer', padding: 0, fontSize: 13, lineHeight: 1 }}>×</button>
              </div>
            )
          })}
        </div>

        {/* Copy buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          {targetLangs.map(tgt => (
            <button key={tgt} onClick={() => navigator.clipboard.writeText(translated[tgt] || '')}
              style={S.btn(false)}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#818cf8'; e.currentTarget.style.color = '#e2e2e8' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a3a'; e.currentTarget.style.color = '#6b6b8a' }}
            >copy {tgt}</button>
          ))}
        </div>
      </div>

      {/* ── Error Banner ── */}
      {llmError && (
        <div style={{ padding: '8px 20px', background: '#2a0d0d', borderBottom: '1px solid #7f1d1d', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: '#f87171', fontFamily: "'JetBrains Mono', monospace" }}>✗ {llmError}</span>
          <button onClick={() => { setLlmError(null); setSettingsOpen(true) }} style={{ background: 'none', border: '1px solid #7f1d1d', borderRadius: 4, color: '#f87171', fontSize: 10, cursor: 'pointer', padding: '3px 10px', fontFamily: "'JetBrains Mono', monospace" }}>
            fix settings
          </button>
        </div>
      )}

      {/* ── Editors ── */}
      <div style={{ display: 'flex', flex: 1, gap: 6, padding: 8, overflow: 'hidden' }}>
        <EditorPanel lang={sourceLang} value={sourceCode} onChange={val => setSourceCode(val || '')} readOnly={false} status="source" />
        {targetLangs.map(tgt => (
          <EditorPanel key={tgt} lang={tgt} value={translated[tgt] || ''} readOnly={true} status={status[tgt] || 'ready'} />
        ))}
      </div>

      {/* ── Status Bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 16px', background: '#0d0d14', borderTop: '1px solid #1e1e2e', flexShrink: 0 }}>
        <span style={{ fontSize: 10, color: '#3a3a5a', fontFamily: "'JetBrains Mono', monospace" }}>
          {mode === 'ast'
            ? 'AST engine — instant token-based translation'
            : llmSubMode === 'offline'
              ? 'LLM offline — running locally via WebLLM'
              : `LLM online — ${providerLabel} · ${modelLabel} ${llmInterval > 0 ? `· auto-run every ${llmInterval/1000}s` : '· manual'}`
          }
        </span>
        <span style={{ fontSize: 10, color: '#3a3a5a', fontFamily: "'JetBrains Mono', monospace" }}>
          {sourceCode.split('\n').length} lines
        </span>
      </div>

      {/* ── Settings Modal ── */}
      {settingsOpen && (
        <LLMSettings settings={llmSettings} onClose={() => setSettingsOpen(false)} onSave={handleSaveSettings} />
      )}
    </div>
  )
}
