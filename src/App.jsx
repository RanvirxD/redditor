import { useState, useEffect, useRef, useCallback } from 'react'
import EditorPanel from './components/EditorPanel'
import LLMSettings from './components/LLMSettings'
import { translate } from './utils/translator'
import { translateWithAPI, translateWithWebLLM, isWebLLMReady } from './utils/llmTranslator'

const LANGUAGES = [
  { value: 'java',   label: 'Java' },
  { value: 'python', label: 'Python' },
  { value: 'cpp',    label: 'C++' },
]

const DEBOUNCE_MS = 600

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

function loadLLMSettings() {
  try { return JSON.parse(localStorage.getItem('redditor_llm_settings') || '{}') }
  catch { return {} }
}
function saveLLMSettings(s) {
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
    background: '#111119', border: '1px solid #2a2a3a',
    borderRadius: 4, color: '#e2e2e8', fontSize: 12,
    fontFamily: "'JetBrains Mono', monospace",
    padding: '5px 14px', cursor: 'pointer', outline: 'none',
  },
  label: {
    fontSize: 11, color: '#6b6b8a',
    fontFamily: "'JetBrains Mono', monospace",
  },
}

function ModeToggle({ mode, onToggle, onOpenSettings }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 3,
      background: '#111119', border: '1px solid #2a2a3a',
      borderRadius: 6, padding: '3px',
    }}>
      {['ast','llm'].map(m => (
        <button key={m} onClick={() => onToggle(m)} style={{
          padding: '4px 12px', borderRadius: 4, border: 'none',
          background: mode === m ? '#818cf8' : 'transparent',
          color: mode === m ? '#fff' : '#6b6b8a',
          fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
          cursor: 'pointer', transition: 'all 0.15s',
          textTransform: 'uppercase',
        }}>{m}</button>
      ))}
      {mode === 'llm' && (
        <button onClick={onOpenSettings} title="LLM Settings" style={{
          padding: '4px 7px', borderRadius: 4, border: 'none',
          background: 'transparent', color: '#818cf8',
          fontSize: 14, cursor: 'pointer', lineHeight: 1,
        }}>⚙</button>
      )}
    </div>
  )
}

function TranslatePopover({ sourceLang, onConfirm, onClose }) {
  const [selected, setSelected] = useState([])
  const ref = useRef(null)
  const available = LANGUAGES.filter(l => l.value !== sourceLang)
  function toggle(val) {
    setSelected(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])
  }
  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div ref={ref} style={{
      position: 'absolute', top: '100%', left: 0, marginTop: 6,
      background: '#111119', border: '1px solid #2a2a3a', borderRadius: 6,
      padding: '12px 14px', zIndex: 100, minWidth: 170,
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
    }}>
      <p style={{ ...S.label, marginBottom: 10, color: '#4a4a6a' }}>select targets</p>
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
  const [llmSettings, setLlmSettings]   = useState(loadLLMSettings)
  const [llmError, setLlmError]         = useState(null)
  const debounceRef = useRef(null)

  const runAST = useCallback((code, src, targets) => {
    const result = {}
    const newStatus = {}
    for (const tgt of targets) {
      result[tgt] = translate(code, src, tgt)
      newStatus[tgt] = 'ready'
    }
    setTranslated(result)
    setStatus(newStatus)
  }, [])

  const runLLM = useCallback(async (code, src, targets) => {
    setLlmError(null)
    const pending = {}
    for (const t of targets) pending[t] = 'translating'
    setStatus(pending)

    for (const tgt of targets) {
      try {
        let result
        if (llmSubMode === 'offline') {
          if (!isWebLLMReady()) throw new Error('No offline model loaded. Open LLM Settings → Offline tab.')
          result = await translateWithWebLLM(code, src, tgt)
        } else {
          if (!llmSettings.apiKey) throw new Error('No API key. Click ⚙ to add your MegaLLM key.')
          result = await translateWithAPI(code, src, tgt, {
            apiKey: llmSettings.apiKey,
            baseUrl: llmSettings.baseUrl || 'https://ai.megallm.io/v1',
            modelId: llmSettings.modelId || 'alibaba-qwen3-coder-flash',
          })
        }
        setTranslated(prev => ({ ...prev, [tgt]: result }))
        setStatus(prev => ({ ...prev, [tgt]: 'ready' }))
      } catch (e) {
        setStatus(prev => ({ ...prev, [tgt]: 'error' }))
        setLlmError(e.message)
      }
    }
  }, [llmSettings, llmSubMode])

  // AST: auto-translate on keystroke with debounce
  useEffect(() => {
    if (mode !== 'ast' || targetLangs.length === 0) return
    const pending = {}
    for (const t of targetLangs) pending[t] = 'translating'
    setStatus(pending)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runAST(sourceCode, sourceLang, targetLangs), DEBOUNCE_MS)
    return () => clearTimeout(debounceRef.current)
  }, [sourceCode, sourceLang, targetLangs, mode, runAST])

  // Retranslate when mode switches
  useEffect(() => {
    if (targetLangs.length === 0) return
    if (mode === 'ast') runAST(sourceCode, sourceLang, targetLangs)
    if (mode === 'llm') runLLM(sourceCode, sourceLang, targetLangs)
  }, [mode]) // eslint-disable-line

  function handleModeToggle(newMode) {
    setMode(newMode)
    if (newMode === 'llm' && !llmSettings.apiKey && !isWebLLMReady()) {
      setSettingsOpen(true)
    }
  }

  function handleSaveSettings(newSettings) {
    const merged = { ...llmSettings, ...newSettings }
    setLlmSettings(merged)
    saveLLMSettings(merged)
    if (newSettings.webllmModelId) setLlmSubMode('offline')
    else if (newSettings.apiKey) setLlmSubMode('online')
  }

  function removeTarget(lang) {
    setTargetLangs(prev => prev.filter(l => l !== lang))
    setTranslated(prev => { const n = { ...prev }; delete n[lang]; return n })
    setStatus(prev => { const n = { ...prev }; delete n[lang]; return n })
  }

  const currentModelLabel = (llmSettings.modelId || 'gemini-2.5-flash-lite').split('/').pop()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a0a0f', overflow: 'hidden' }}>

      {/* Top Bar */}
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
          <span style={{
            fontSize: 10, color: '#6b6b8a', fontFamily: "'JetBrains Mono', monospace",
            background: '#1a1a28', padding: '2px 8px', borderRadius: 10, border: '1px solid #2a2a3a',
          }}>
            {mode === 'ast' ? 'AST Engine' : `LLM · ${llmSubMode === 'offline' ? 'Offline' : currentModelLabel}`}
          </span>
        </div>

        {/* Center controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
          <span style={S.label}>source</span>
          <div style={{ ...S.select, cursor: 'default', color: '#e2e2e8' }}>Java</div>

          <ModeToggle mode={mode} onToggle={handleModeToggle} onOpenSettings={() => setSettingsOpen(true)} />

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

          {/* LLM manual trigger */}
          {mode === 'llm' && targetLangs.length > 0 && (
            <button
              onClick={() => runLLM(sourceCode, sourceLang, targetLangs)}
              style={{ ...S.btn(false), background: '#1a1a2e', border: '1px solid #818cf8', color: '#818cf8' }}
            >⚡ Run LLM</button>
          )}

          {/* Chips */}
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

      {/* LLM Error Banner */}
      {llmError && (
        <div style={{ padding: '8px 20px', background: '#2a0d0d', borderBottom: '1px solid #7f1d1d', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: '#f87171', fontFamily: "'JetBrains Mono', monospace" }}>✗ {llmError}</span>
          <button onClick={() => { setLlmError(null); setSettingsOpen(true) }} style={{ background: 'none', border: '1px solid #7f1d1d', borderRadius: 4, color: '#f87171', fontSize: 10, cursor: 'pointer', padding: '3px 10px', fontFamily: "'JetBrains Mono', monospace" }}>
            fix settings
          </button>
        </div>
      )}

      {/* Editors */}
      <div style={{ display: 'flex', flex: 1, gap: 6, padding: 8, overflow: 'hidden' }}>
        <EditorPanel lang={sourceLang} value={sourceCode} onChange={val => setSourceCode(val || '')} readOnly={false} status="source" />
        {targetLangs.map(tgt => (
          <EditorPanel key={tgt} lang={tgt} value={translated[tgt] || ''} readOnly={true} status={status[tgt] || 'ready'} />
        ))}
      </div>

      {/* Status Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 16px', background: '#0d0d14', borderTop: '1px solid #1e1e2e', flexShrink: 0 }}>
        <span style={{ fontSize: 10, color: '#3a3a5a', fontFamily: "'JetBrains Mono', monospace" }}>
          {mode === 'ast' ? 'AST engine — instant token-based translation' : `LLM mode — ${llmSubMode === 'offline' ? 'running locally via WebLLM' : 'MegaLLM API · ' + currentModelLabel}`}
        </span>
        <span style={{ fontSize: 10, color: '#3a3a5a', fontFamily: "'JetBrains Mono', monospace" }}>
          {sourceCode.split('\n').length} lines
        </span>
      </div>

      {/* Settings Modal */}
      {settingsOpen && (
        <LLMSettings settings={llmSettings} onClose={() => setSettingsOpen(false)} onSave={handleSaveSettings} />
      )}
    </div>
  )
}
