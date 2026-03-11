/**
 * compiler.js
 * Piston API — free, no API key, supports 100+ languages
 * https://github.com/engineer-man/piston
 * Endpoint: https://emkc.org/api/v2/piston/execute
 */

// ─── Piston language + version map ───────────────────────────────────────────
// These are the runtime names Piston uses (not the same as our internal values)

export const PISTON_RUNTIMES = {
  java:       { language: 'java',        version: '15.0.2'  },
  python:     { language: 'python',      version: '3.10.0'  },
  cpp:        { language: 'c++',         version: '10.2.0'  },
  c:          { language: 'c',           version: '10.2.0'  },
  csharp:     { language: 'csharp',      version: '6.12.0'  },
  javascript: { language: 'javascript',  version: '18.15.0' },
  typescript: { language: 'typescript',  version: '5.0.3'   },
  kotlin:     { language: 'kotlin',      version: '1.8.20'  },
  rust:       { language: 'rust',        version: '1.68.2'  },
  go:         { language: 'go',          version: '1.20.3'  },
  scala:      { language: 'scala',       version: '3.2.2'   },
  ruby:       { language: 'ruby',        version: '3.0.1'   },
  swift:      { language: 'swift',       version: '5.3.3'   },
  php:        { language: 'php',         version: '8.2.3'   },
  haskell:    { language: 'haskell',     version: '9.4.4'   },
  perl:       { language: 'perl',        version: '5.36.0'  },
  pascal:     { language: 'pascal',      version: '3.2.2'   },
  d:          { language: 'd',           version: '10.3.0'  },
  ocaml:      { language: 'ocaml',       version: '4.14.0'  },
}

const PISTON_URL = 'https://emkc.org/api/v2/piston/execute'

// File extension Piston needs per language
const EXTENSIONS = {
  java: 'java', python: 'py', cpp: 'cpp', c: 'c',
  csharp: 'cs', javascript: 'js', typescript: 'ts',
  kotlin: 'kt', rust: 'rs', go: 'go', scala: 'scala',
  ruby: 'rb', swift: 'swift', php: 'php', haskell: 'hs',
  perl: 'pl', pascal: 'pas', d: 'd', ocaml: 'ml',
}

// ─── Main run function ────────────────────────────────────────────────────────

export async function runCode(code, langValue, stdin = '') {
  const runtime = PISTON_RUNTIMES[langValue]
  if (!runtime) throw new Error(`No Piston runtime for: ${langValue}`)

  const ext = EXTENSIONS[langValue] || 'txt'

  // Java: Piston needs the filename to match the public class name
  let filename = `code.${ext}`
  if (langValue === 'java') {
    const classMatch = code.match(/public\s+class\s+(\w+)/)
    filename = classMatch ? `${classMatch[1]}.java` : 'Main.java'
  }

  const res = await fetch(PISTON_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      language: runtime.language,
      version:  runtime.version,
      files: [{ name: filename, content: code }],
      stdin,
      run_timeout: 10000,   // 10s max
      compile_timeout: 15000,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.message || `Piston API error: HTTP ${res.status}`)
  }

  const data = await res.json()

  // Piston returns { run: { stdout, stderr, code, signal }, compile?: { stdout, stderr } }
  const compileErr  = data?.compile?.stderr || data?.compile?.stdout || ''
  const runStdout   = data?.run?.stdout || ''
  const runStderr   = data?.run?.stderr || ''
  const exitCode    = data?.run?.code ?? 0

  const hasCompileErr = compileErr.trim().length > 0
  const hasRuntimeErr = runStderr.trim().length > 0

  return {
    stdout:      runStdout,
    stderr:      hasCompileErr ? compileErr : runStderr,
    exitCode,
    success:     !hasCompileErr && exitCode === 0,
    isCompileErr: hasCompileErr,
    lang:        langValue,
  }
}

// ─── Piston runtime availability check ───────────────────────────────────────

let cachedRuntimes = null

export async function fetchAvailableRuntimes() {
  if (cachedRuntimes) return cachedRuntimes
  try {
    const res = await fetch('https://emkc.org/api/v2/piston/runtimes')
    cachedRuntimes = await res.json()
    return cachedRuntimes
  } catch {
    return []
  }
}
