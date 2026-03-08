import Editor from '@monaco-editor/react'

const LANG_DISPLAY = {
  java: 'Java',
  python: 'Python',
  cpp: 'C++',
}

const MONACO_LANG = {
  java: 'java',
  python: 'python',
  cpp: 'cpp',
}

const STATUS_STYLE = {
  ready:       { color: '#4ade80', label: 'AST Ready' },
  llm_ready:   { color: '#818cf8', label: 'LLM Ready' },
  translating: { color: '#facc15', label: 'Translating...' },
  source:      { color: '#818cf8', label: 'Editable' },
  error:       { color: '#f87171', label: 'Error' },
}

export default function EditorPanel({ lang, value, onChange, readOnly, status = 'ready' }) {
  const statusInfo = STATUS_STYLE[status] || STATUS_STYLE.ready

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      border: '1px solid #1e1e2e',
      borderRadius: 6,
      overflow: 'hidden',
      background: '#0d0d14',
    }}>
      {/* Panel Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 14px',
        background: '#111119',
        borderBottom: '1px solid #1e1e2e',
      }}>
        <span style={{
          fontFamily: "'Syne', sans-serif",
          fontWeight: 800,
          fontSize: 13,
          letterSpacing: '0.08em',
          color: '#e2e2e8',
        }}>
          {LANG_DISPLAY[lang] || lang.toUpperCase()}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: statusInfo.color,
            display: 'inline-block',
            boxShadow: `0 0 6px ${statusInfo.color}`,
          }} />
          <span style={{
            fontSize: 10,
            color: '#6b6b8a',
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: '0.05em',
          }}>
            {readOnly ? statusInfo.label : 'Editable'}
          </span>
        </div>
      </div>

      {/* Monaco Editor */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Editor
          height="100%"
          language={MONACO_LANG[lang] || lang}
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
            scrollbar: {
              verticalScrollbarSize: 4,
              horizontalScrollbarSize: 4,
            },
          }}
          theme="vs-dark"
        />
      </div>
    </div>
  )
}
