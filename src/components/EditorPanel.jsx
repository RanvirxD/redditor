import { useState, useRef } from 'react'
import Editor from '@monaco-editor/react'
import { runCode } from '../utils/compiler'

const MONACO_LANG_MAP = {
  java: 'java', python: 'python', cpp: 'cpp', c: 'c',
  csharp: 'csharp', javascript: 'javascript', typescript: 'typescript',
  kotlin: 'kotlin', rust: 'rust', go: 'go', scala: 'scala',
  ruby: 'ruby', swift: 'swift', php: 'php',
  haskell: 'plaintext', perl: 'perl', ocaml: 'plaintext',
  pascal: 'pascal', d: 'plaintext',
}

const LANG_DISPLAY = {
  java: 'Java', python: 'Python', cpp: 'C++', c: 'C',
  csharp: 'C#', javascript: 'JavaScript', typescript: 'TypeScript',
  kotlin: 'Kotlin', rust: 'Rust', go: 'Go', scala: 'Scala',
  ruby: 'Ruby', swift: 'Swift', php: 'PHP', haskell: 'Haskell',
  perl: 'Perl', ocaml: 'OCaml', pascal: 'Pascal', d: 'D',
}

const STATUS_STYLE = {
  ready:       { color: '#4ade80', label: 'AST Ready'     },
  llm_ready:   { color: '#818cf8', label: 'LLM Ready'     },
  translating: { color: '#facc15', label: 'Translating...' },
  source:      { color: '#818cf8', label: 'Editable'      },
  error:       { color: '#f87171', label: 'Error'         },
}

// ─── Inline Terminal ──────────────────────────────────────────────────────────

function Terminal({ result, running, onClose, onStdinChange, stdin }) {
  return (
    <div style={{
      borderTop: '1px solid #1e1e2e',
      background: '#080810',
      flexShrink: 0,
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 12,
      maxHeight: 220,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Terminal header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '5px 12px', borderBottom: '1px solid #1a1a2a', background: '#0d0d18',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#4a4a6a', fontSize: 10 }}>▸ terminal</span>
          {result && (
            <span style={{
              fontSize: 9, padding: '1px 6px', borderRadius: 3,
              background: result.success ? '#0d2a1a' : '#2a0d0d',
              color: result.success ? '#4ade80' : '#f87171',
              border: `1px solid ${result.success ? '#4ade80' : '#f87171'}`,
            }}>
              {result.success ? '✓ ok' : result.isCompileErr ? '✗ compile error' : '✗ runtime error'}
            </span>
          )}
          {running && (
            <span style={{ fontSize: 9, color: '#facc15' }}>● running...</span>
          )}
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#4a4a6a', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</button>
      </div>

      {/* stdin input */}
      <div style={{ padding: '6px 12px', borderBottom: '1px solid #111120' }}>
        <input
          placeholder="stdin (optional — press Enter or just Run)"
          value={stdin}
          onChange={e => onStdinChange(e.target.value)}
          style={{
            width: '100%', background: 'transparent', border: 'none',
            outline: 'none', color: '#6b6b8a', fontSize: 11,
            fontFamily: "'JetBrains Mono', monospace", boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Output area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
        {!result && !running && (
          <span style={{ color: '#3a3a5a', fontSize: 11 }}>Press ▶ Run to execute</span>
        )}

        {result?.stdout && (
          <pre style={{ margin: 0, color: '#e2e2e8', fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {result.stdout}
          </pre>
        )}

        {result?.stderr && (
          <pre style={{
            margin: result.stdout ? '8px 0 0' : 0,
            color: '#f87171', fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {result.stderr}
          </pre>
        )}

        {result && !result.stdout && !result.stderr && result.success && (
          <span style={{ color: '#4a4a6a', fontSize: 11 }}>✓ No output</span>
        )}
      </div>
    </div>
  )
}

// ─── EditorPanel ──────────────────────────────────────────────────────────────

export default function EditorPanel({ lang, value, onChange, readOnly, status = 'ready' }) {
  const [running, setRunning]         = useState(false)
  const [runResult, setRunResult]     = useState(null)
  const [terminalOpen, setTerminalOpen] = useState(false)
  const [runError, setRunError]       = useState(null)
  const [stdin, setStdin]             = useState('')

  const statusInfo  = STATUS_STYLE[status] || STATUS_STYLE.ready
  const monacoLang  = MONACO_LANG_MAP[lang] || 'plaintext'
  const displayName = LANG_DISPLAY[lang] || lang.toUpperCase()

  async function handleRun() {
    setRunning(true)
    setRunResult(null)
    setRunError(null)
    setTerminalOpen(true)
    try {
      const result = await runCode(value, lang, stdin)
      setRunResult(result)
    } catch (e) {
      setRunError(e.message)
      setRunResult({ stdout: '', stderr: e.message, success: false, isCompileErr: false })
    }
    setRunning(false)
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', flex: 1,
      border: '1px solid #1e1e2e', borderRadius: 6,
      overflow: 'hidden', background: '#0d0d14',
      minWidth: 0,
    }}>

      {/* ── Panel Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 14px', background: '#111119', borderBottom: '1px solid #1e1e2e',
        flexShrink: 0,
      }}>
        {/* Left: lang name */}
        <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 13, letterSpacing: '0.08em', color: '#e2e2e8' }}>
          {displayName}
        </span>

        {/* Center: Run button */}
        <button
          onClick={handleRun}
          disabled={running || !value?.trim()}
          title={`Run ${displayName}`}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '4px 12px', borderRadius: 4,
            border: `1px solid ${running ? '#facc15' : '#4ade80'}`,
            background: running ? '#1a1a10' : '#0d2a1a',
            color: running ? '#facc15' : '#4ade80',
            fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
            cursor: running || !value?.trim() ? 'not-allowed' : 'pointer',
            opacity: !value?.trim() ? 0.4 : 1,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { if (!running && value?.trim()) { e.currentTarget.style.background = '#4ade80'; e.currentTarget.style.color = '#000' }}}
          onMouseLeave={e => { e.currentTarget.style.background = running ? '#1a1a10' : '#0d2a1a'; e.currentTarget.style.color = running ? '#facc15' : '#4ade80' }}
        >
          {running ? (
            <><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#facc15', boxShadow: '0 0 5px #facc15' }} /> running</>
          ) : (
            <>▶ Run</>
          )}
        </button>

        {/* Right: status dot */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Show terminal toggle if there's output */}
          {runResult && (
            <button
              onClick={() => setTerminalOpen(o => !o)}
              style={{
                background: 'none', border: '1px solid #2a2a3a',
                borderRadius: 4, color: '#6b6b8a', fontSize: 10,
                cursor: 'pointer', padding: '2px 8px',
                fontFamily: "'JetBrains Mono', monospace',",
              }}
            >
              {terminalOpen ? 'hide output' : 'show output'}
            </button>
          )}
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusInfo.color, display: 'inline-block', boxShadow: `0 0 6px ${statusInfo.color}` }} />
          <span style={{ fontSize: 10, color: '#6b6b8a', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.05em' }}>
            {readOnly ? statusInfo.label : 'Editable'}
          </span>
        </div>
      </div>

      {/* ── Monaco Editor ── */}
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <Editor
          height="100%"
          language={monacoLang}
          value={value}
          onChange={onChange}
          options={{
            readOnly,
            minimap: { enabled: false },
            fontSize: 17,
            fontFamily: "'JetBrains Mono', monospace",
            fontLigatures: true,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            renderLineHighlight: readOnly ? 'none' : 'line',
            cursorBlinking: 'smooth',
            smoothScrolling: true,
            padding: { top: 12, bottom: 12 },
            scrollbar: { verticalScrollbarSize: 4, horizontalScrollbarSize: 4 },
          }}
          theme="vs-dark"
        />
      </div>

      {/* ── Inline Terminal ── */}
      {terminalOpen && (
        <Terminal
          result={runResult}
          running={running}
          stdin={stdin}
          onStdinChange={setStdin}
          onClose={() => setTerminalOpen(false)}
        />
      )}
    </div>
  )
}
