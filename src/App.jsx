import { useState, useEffect, useRef, useCallback } from 'react'
import EditorPanel from './components/EditorPanel'
import { translate } from './utils/translator'

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

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  btn: (active) => ({
    background: active ? '#818cf8' : '#1a1a28',
    border: `1px solid ${active ? '#818cf8' : '#2a2a3a'}`,
    borderRadius: 4,
    color: active ? '#fff' : '#6b6b8a',
    fontSize: 11,
    fontFamily: "'JetBrains Mono', monospace",
    padding: '5px 14px',
    cursor: 'pointer',
  }),
  select: {
    background: '#111119',
    border: '1px solid #2a2a3a',
    borderRadius: 4,
    color: '#e2e2e8',
    fontSize: 12,
    fontFamily: "'JetBrains Mono', monospace",
    padding: '5px 28px 5px 10px',
    cursor: 'pointer',
    outline: 'none',
  },
  label: {
    fontSize: 11,
    color: '#6b6b8a',
    fontFamily: "'JetBrains Mono', monospace",
  },
}

// ─── Translate-To Popover ─────────────────────────────────────────────────────

function TranslatePopover({ sourceLang, onConfirm, onClose }) {
  const [selected, setSelected] = useState([])
  const ref = useRef(null)

  const available = LANGUAGES.filter(l => l.value !== sourceLang)

  function toggle(val) {
    setSelected(prev =>
      prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
    )
  }

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div ref={ref} style={{
      position: 'absolute',
      top: '100%',
      left: 0,
      marginTop: 6,
      background: '#111119',
      border: '1px solid #2a2a3a',
      borderRadius: 6,
      padding: '12px 14px',
      zIndex: 100,
      minWidth: 170,
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
    }}>
      <p style={{ ...S.label, marginBottom: 10, color: '#4a4a6a' }}>select targets</p>

      {available.map(l => (
        <label key={l.value} style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 8,
          cursor: 'pointer',
        }}>
          <div
            onClick={() => toggle(l.value)}
            style={{
              width: 14,
              height: 14,
              borderRadius: 3,
              border: `1px solid ${selected.includes(l.value) ? '#818cf8' : '#3a3a5a'}`,
              background: selected.includes(l.value) ? '#818cf8' : 'transparent',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.1s',
            }}
          >
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
          marginTop: 4,
          width: '100%',
          background: selected.length > 0 ? '#818cf8' : '#1a1a28',
          border: `1px solid ${selected.length > 0 ? '#818cf8' : '#2a2a3a'}`,
          borderRadius: 4,
          color: selected.length > 0 ? '#fff' : '#4a4a6a',
          fontSize: 11,
          fontFamily: "'JetBrains Mono', monospace",
          padding: '6px 0',
          cursor: selected.length > 0 ? 'pointer' : 'not-allowed',
          transition: 'all 0.15s',
        }}
      >
        translate
      </button>
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const sourceLang = 'java'
  const [targetLangs, setTargetLangs] = useState([])
  const [sourceCode, setSourceCode]   = useState(DEFAULT_CODE)
  const [translated, setTranslated]   = useState({})
  const [status, setStatus]           = useState({})
  const [popoverOpen, setPopoverOpen] = useState(false)
  const debounceRef = useRef(null)

  const hasTargets = targetLangs.length > 0

  const runTranslation = useCallback((code, src, targets) => {
    const result = {}
    const newStatus = {}
    for (const tgt of targets) {
      result[tgt] = translate(code, src, tgt)
      newStatus[tgt] = 'ready'
    }
    setTranslated(result)
    setStatus(newStatus)
  }, [])

  useEffect(() => {
    if (targetLangs.length === 0) return

    const pendingStatus = {}
    for (const t of targetLangs) pendingStatus[t] = 'translating'
    setStatus(pendingStatus)

    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      runTranslation(sourceCode, sourceLang, targetLangs)
    }, DEBOUNCE_MS)

    return () => clearTimeout(debounceRef.current)
  }, [sourceCode, sourceLang, targetLangs, runTranslation])

  function handleConfirmTargets(selected) {
    setTargetLangs(selected)
  }

  function removeTarget(lang) {
    setTargetLangs(prev => prev.filter(l => l !== lang))
    setTranslated(prev => { const n = { ...prev }; delete n[lang]; return n })
    setStatus(prev => { const n = { ...prev }; delete n[lang]; return n })
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: '#0a0a0f',
      overflow: 'hidden',
    }}>
      {/* Top Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 20px',
        background: '#0d0d14',
        borderBottom: '1px solid #1e1e2e',
        flexShrink: 0,
        position: 'relative',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28,
            background: 'linear-gradient(135deg, #818cf8, #4ade80)',
            borderRadius: 6,
          }} />
          <span style={{
            fontFamily: "'Syne', sans-serif",
            fontWeight: 800,
            fontSize: 16,
            letterSpacing: '0.04em',
            color: '#e2e2e8',
          }}>
            Redditor
          </span>
          <span style={{
            fontSize: 10,
            color: '#6b6b8a',
            fontFamily: "'JetBrains Mono', monospace",
            background: '#1a1a28',
            padding: '2px 8px',
            borderRadius: 10,
            border: '1px solid #2a2a3a',
          }}>
            AST Prototype
          </span>
        </div>

        {/* Center — source selector + translate-to button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
          <span style={S.label}>source</span>
          <div style={{
            ...S.select,
            cursor: 'default',
            color: '#e2e2e8',
            display: 'inline-block',
            paddingRight: 14,
          }}>
            Java
          </div>

          {/* Translate-to button + popover */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setPopoverOpen(p => !p)}
              style={{
                ...S.btn(popoverOpen),
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              Translate To
              <svg width="8" height="5" viewBox="0 0 8 5" style={{ transform: popoverOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                <path d="M0 0l4 5 4-5z" fill={popoverOpen ? '#fff' : '#6b6b8a'} />
              </svg>
            </button>

            {popoverOpen && (
              <TranslatePopover
                sourceLang={sourceLang}
                onConfirm={handleConfirmTargets}
                onClose={() => setPopoverOpen(false)}
              />
            )}
          </div>

          {/* Active target chips */}
          {targetLangs.map(tgt => {
            const label = LANGUAGES.find(l => l.value === tgt)?.label
            return (
              <div key={tgt} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: '#1a1a28',
                border: '1px solid #2a2a3a',
                borderRadius: 4,
                padding: '4px 8px',
              }}>
                <span style={{ ...S.label, color: '#e2e2e8', fontSize: 11 }}>{label}</span>
                <button
                  onClick={() => removeTarget(tgt)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#4a4a6a',
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: 13,
                    lineHeight: 1,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title={`Remove ${label}`}
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>

        {/* Copy buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          {targetLangs.map(tgt => (
            <button
              key={tgt}
              onClick={() => navigator.clipboard.writeText(translated[tgt] || '')}
              style={S.btn(false)}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#818cf8'; e.currentTarget.style.color = '#e2e2e8' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a3a'; e.currentTarget.style.color = '#6b6b8a' }}
            >
              copy {tgt}
            </button>
          ))}
        </div>
      </div>

      {/* Editor Panels */}
      <div style={{
        display: 'flex',
        flex: 1,
        gap: 6,
        padding: 8,
        overflow: 'hidden',
      }}>
        <EditorPanel
          lang={sourceLang}
          value={sourceCode}
          onChange={val => setSourceCode(val || '')}
          readOnly={false}
          status="source"
        />

        {targetLangs.map(tgt => (
          <EditorPanel
            key={tgt}
            lang={tgt}
            value={translated[tgt] || ''}
            readOnly={true}
            status={status[tgt] || 'ready'}
          />
        ))}
      </div>

      {/* Status Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 16px',
        background: '#0d0d14',
        borderTop: '1px solid #1e1e2e',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 10, color: '#3a3a5a', fontFamily: "'JetBrains Mono', monospace" }}>
          AST engine — token-based translation
        </span>
        <span style={{ fontSize: 10, color: '#3a3a5a', fontFamily: "'JetBrains Mono', monospace" }}>
          {sourceCode.split('\n').length} lines
        </span>
      </div>
    </div>
  )
}