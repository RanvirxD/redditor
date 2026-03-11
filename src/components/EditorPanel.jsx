import Editor from '@monaco-editor/react'

// Monaco has built-in support for most languages.
// For unsupported ones (Pascal, D, OCaml, Haskell, Perl) we fall back to plaintext
const MONACO_LANG_MAP = {
  java:       'java',
  python:     'python',
  cpp:        'cpp',
  c:          'c',
  csharp:     'csharp',
  javascript: 'javascript',
  typescript: 'typescript',
  kotlin:     'kotlin',
  rust:       'rust',
  go:         'go',
  scala:      'scala',
  ruby:       'ruby',
  swift:      'swift',
  php:        'php',
  haskell:    'plaintext',   // Monaco has no Haskell — plaintext still syntax-highlights nothing but works
  perl:       'perl',
  ocaml:      'plaintext',
  pascal:     'pascal',
  d:          'plaintext',
}

const LANG_DISPLAY = {
  java: 'Java', python: 'Python', cpp: 'C++', c: 'C',
  csharp: 'C#', javascript: 'JavaScript', typescript: 'TypeScript',
  kotlin: 'Kotlin', rust: 'Rust', go: 'Go', scala: 'Scala',
  ruby: 'Ruby', swift: 'Swift', php: 'PHP', haskell: 'Haskell',
  perl: 'Perl', ocaml: 'OCaml', pascal: 'Pascal', d: 'D',
}

const STATUS_STYLE = {
  ready:       { color: '#4ade80', label: 'AST Ready' },
  llm_ready:   { color: '#818cf8', label: 'LLM Ready' },
  translating: { color: '#facc15', label: 'Translating...' },
  source:      { color: '#818cf8', label: 'Editable' },
  error:       { color: '#f87171', label: 'Error' },
}

export default function EditorPanel({ lang, value, onChange, readOnly, status = 'ready' }) {
  const statusInfo  = STATUS_STYLE[status] || STATUS_STYLE.ready
  const monacoLang  = MONACO_LANG_MAP[lang] || 'plaintext'
  const displayName = LANG_DISPLAY[lang] || lang.toUpperCase()

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', flex: 1,
      border: '1px solid #1e1e2e', borderRadius: 6,
      overflow: 'hidden', background: '#0d0d14',
    }}>
      {/* Panel Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 14px', background: '#111119', borderBottom: '1px solid #1e1e2e',
      }}>
        <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 13, letterSpacing: '0.08em', color: '#e2e2e8' }}>
          {displayName}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: statusInfo.color, display: 'inline-block',
            boxShadow: `0 0 6px ${statusInfo.color}`,
          }} />
          <span style={{ fontSize: 10, color: '#6b6b8a', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.05em' }}>
            {readOnly ? statusInfo.label : 'Editable'}
          </span>
        </div>
      </div>

      {/* Monaco Editor */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
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
    </div>
  )
}
