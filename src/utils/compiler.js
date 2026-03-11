/**
 * compiler.js
 * Wandbox API — completely free, no API key, no signup
 * https://wandbox.org/
 */

// ─── Wandbox compiler map ─────────────────────────────────────────────────────

const WANDBOX_COMPILERS = {
  c:          { compiler: 'gcc-12.2.0',          options: '-x c' },
  cpp:        { compiler: 'gcc-12.2.0',           options: '' },
  java:       { compiler: 'openjdk-jdk-17+35',    options: '' },
  python:     { compiler: 'cpython-3.11.3',       options: '' },
  ruby:       { compiler: 'ruby-3.2.1',           options: '' },
  go:         { compiler: 'go-1.20.4',            options: '' },
  rust:       { compiler: 'rust-1.70.0',          options: '' },
  scala:      { compiler: 'scala-3.3.0',          options: '' },
  haskell:    { compiler: 'ghc-9.4.5',            options: '' },
  ocaml:      { compiler: 'ocaml-4.14.0',         options: '' },
  perl:       { compiler: 'perl-5.37.3',          options: '' },
  php:        { compiler: 'php-8.2.6',            options: '' },
  swift:      { compiler: 'swift-5.8.1',          options: '' },
  lua:        { compiler: 'lua-5.4.4',            options: '' },
}

// Languages Wandbox doesn't support — show friendly message
const UNSUPPORTED = {
  csharp:     'C# (try dotnetfiddle.net)',
  kotlin:     'Kotlin (try play.kotlinlang.org)',
  typescript: 'TypeScript (try replit.com)',
  javascript: 'JavaScript (try replit.com)',
  pascal:     'Pascal (try tio.run)',
  d:          'D (try run.dlang.io)',
}

// File extension for Wandbox
const EXTENSIONS = {
  c: 'c', cpp: 'cpp', java: 'java', python: 'py', ruby: 'rb',
  go: 'go', rust: 'rs', scala: 'scala', haskell: 'hs',
  ocaml: 'ml', perl: 'pl', php: 'php', swift: 'swift', lua: 'lua',
}

const WANDBOX_URL = 'https://wandbox.org/api/compile.json'

// ─── Main run function ────────────────────────────────────────────────────────

export async function runCode(code, langValue, stdin = '') {
  // Unsupported language
  if (UNSUPPORTED[langValue]) {
    return {
      stdout: '',
      stderr: `In-browser execution not supported for ${UNSUPPORTED[langValue]}`,
      success: false,
      isUnsupported: true,
    }
  }

  const runtime = WANDBOX_COMPILERS[langValue]
  if (!runtime) {
    return {
      stdout: '',
      stderr: `No compiler configured for: ${langValue}`,
      success: false,
    }
  }

  // Java: filename must match public class name
  let filename = `code.${EXTENSIONS[langValue] || 'txt'}`
  if (langValue === 'java') {
    const match = code.match(/public\s+class\s+(\w+)/)
    filename = match ? `${match[1]}.java` : 'Main.java'
  }

  const body = {
    compiler: runtime.compiler,
    code,
    stdin,
    'compiler-option-raw': runtime.options || undefined,
  }

  const res = await fetch(WANDBOX_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Wandbox error: HTTP ${res.status}. ${text}`)
  }

  const data = await res.json()

  /**
   * Wandbox response fields:
   * status        — exit code (string, "0" = success)
   * compiler_output / compiler_error — compile phase
   * program_output / program_error   — run phase
   * signal        — e.g. "Killed"
   */

  const compileErr  = (data.compiler_error  || '').trim()
  const stdout      = (data.program_output  || '').trim()
  const stderr      = (data.program_error   || '').trim()
  const exitCode    = parseInt(data.status ?? '0', 10)
  const hasCompErr  = compileErr.length > 0

  return {
    stdout,
    stderr:      hasCompErr ? compileErr : stderr,
    exitCode,
    success:     !hasCompErr && exitCode === 0,
    isCompileErr: hasCompErr,
    lang:        langValue,
  }
}
