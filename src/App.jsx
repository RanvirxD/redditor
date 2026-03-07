import { useState, useEffect, useRef, useCallback } from 'react'
import EditorPanel from './components/EditorPanel'
import { translate } from './utils/translator'

const LANGUAGES = [
  { value: 'java', label: 'Java' },
  { value: 'python', label: 'Python' },
  { value: 'cpp', label: 'C++' },
]

const DEBOUNCE_MS = 600

const DEFAULT_CODE = `public class Main {
    public static void main(String[] args) {
        int x = 10;
        String name = "CodeSync";
        System.out.println(name);

        for (int i = 0; i < x; i++) {
            if (i % 2 == 0) {
                System.out.println(i);
            }
        }
    }
}`

export default function App() {
  const [sourceLang, setSourceLang] = useState('java')
  const [targetLangs, setTargetLangs] = useState(['python', 'cpp'])
  const [sourceCode, setSourceCode] = useState(DEFAULT_CODE)
  const [translated, setTranslated] = useState({ python: '', cpp: '' })
  const [status, setStatus] = useState({ python: 'ready', cpp: 'ready' })
  const debounceRef = useRef(null)

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
    const pending = {}
    const pendingStatus = {}
    for (const t of targetLangs) {
      pendingStatus[t] = 'translating'
    }
    setStatus(pendingStatus)

    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      runTranslation(sourceCode, sourceLang, targetLangs)
    }, DEBOUNCE_MS)

    return () => clearTimeout(debounceRef.current)
  }, [sourceCode, sourceLang, targetLangs, runTranslation])

  function handleTargetLangChange(index, newLang) {
    const updated = [...targetLangs]
    updated[index] = newLang
    setTargetLangs(updated)
  }

  const availableTargets = (index) =>
    LANGUAGES.filter(l => l.value !== sourceLang && !targetLangs.some((t, i) => i !== index && t === l.value))

  const selectStyle = {
    background: '#111119',
    border: '1px solid #2a2a3a',
    borderRadius: 4,
    color: '#e2e2e8',
    fontSize: 12,
    fontFamily: "'JetBrains Mono', monospace",
    padding: '5px 28px 5px 10px',
    cursor: 'pointer',
    outline: 'none',
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
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28,
            height: 28,
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

        {/* Language Selectors */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Source language */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: '#6b6b8a', fontFamily: "'JetBrains Mono', monospace" }}>source</span>
            <select
              value={sourceLang}
              onChange={e => setSourceLang(e.target.value)}
              style={selectStyle}
            >
              {LANGUAGES.map(l => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>

          <span style={{ color: '#2a2a3a', fontSize: 16 }}>→</span>

          {/* Target languages */}
          {targetLangs.map((tgt, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: '#6b6b8a', fontFamily: "'JetBrains Mono', monospace" }}>
                target {i + 1}
              </span>
              <select
                value={tgt}
                onChange={e => handleTargetLangChange(i, e.target.value)}
                style={selectStyle}
              >
                {availableTargets(i).map(l => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {/* Copy buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          {targetLangs.map((tgt) => (
            <button
              key={tgt}
              onClick={() => navigator.clipboard.writeText(translated[tgt] || '')}
              style={{
                background: '#1a1a28',
                border: '1px solid #2a2a3a',
                borderRadius: 4,
                color: '#6b6b8a',
                fontSize: 11,
                fontFamily: "'JetBrains Mono', monospace",
                padding: '5px 12px',
                cursor: 'pointer',
                transition: 'border-color 0.15s, color 0.15s',
              }}
              onMouseEnter={e => { e.target.style.borderColor = '#818cf8'; e.target.style.color = '#e2e2e8' }}
              onMouseLeave={e => { e.target.style.borderColor = '#2a2a3a'; e.target.style.color = '#6b6b8a' }}
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
        {/* Source Editor */}
        <EditorPanel
          lang={sourceLang}
          value={sourceCode}
          onChange={(val) => setSourceCode(val || '')}
          readOnly={false}
          status="source"
        />

        {/* Translated Panels */}
        {targetLangs.map((tgt) => (
          <EditorPanel
            key={tgt}
            lang={tgt}
            value={translated[tgt] || ''}
            readOnly={true}
            status={status[tgt] || 'ready'}
          />
        ))}
      </div>

      {/* Status bar */}
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
