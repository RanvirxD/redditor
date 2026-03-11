/**
 * llmTranslator.js
 * Multi-provider LLM translation — supports all major DSA languages
 */

// ─── All supported languages ──────────────────────────────────────────────────

export const ALL_LANGUAGES = [
  { value: 'java',       label: 'Java',       monacoLang: 'java' },
  { value: 'python',     label: 'Python',     monacoLang: 'python' },
  { value: 'cpp',        label: 'C++',        monacoLang: 'cpp' },
  { value: 'c',          label: 'C',          monacoLang: 'c' },
  { value: 'csharp',     label: 'C#',         monacoLang: 'csharp' },
  { value: 'javascript', label: 'JavaScript', monacoLang: 'javascript' },
  { value: 'typescript', label: 'TypeScript', monacoLang: 'typescript' },
  { value: 'kotlin',     label: 'Kotlin',     monacoLang: 'kotlin' },
  { value: 'rust',       label: 'Rust',       monacoLang: 'rust' },
  { value: 'go',         label: 'Go',         monacoLang: 'go' },
  { value: 'scala',      label: 'Scala',      monacoLang: 'scala' },
  { value: 'ruby',       label: 'Ruby',       monacoLang: 'ruby' },
  { value: 'swift',      label: 'Swift',      monacoLang: 'swift' },
  { value: 'haskell',    label: 'Haskell',    monacoLang: 'haskell' },
  { value: 'perl',       label: 'Perl',       monacoLang: 'perl' },
  { value: 'php',        label: 'PHP',        monacoLang: 'php' },
  { value: 'ocaml',      label: 'OCaml',      monacoLang: 'ocaml' },
  { value: 'pascal',     label: 'Pascal',     monacoLang: 'pascal' },
  { value: 'd',          label: 'D',          monacoLang: 'd' },
]

// AST engine only supports Java as source
export const AST_SOURCE_LANGS = ['java']
export const AST_TARGET_LANGS = ['python', 'cpp']

// LLM supports everything
export const LLM_SOURCE_LANGS = ALL_LANGUAGES.map(l => l.value)
export const LLM_TARGET_LANGS = ALL_LANGUAGES.map(l => l.value)

// ─── Providers ────────────────────────────────────────────────────────────────

export const PROVIDERS = [
  {
    id: 'megallm',
    name: 'MegaLLM',
    baseUrl: 'https://ai.megallm.io/v1',
    format: 'openai',
    keyPlaceholder: 'Your MegaLLM API key',
    keyHint: 'Get from MegaLLM dashboard → API Keys',
    models: [
      { id: 'gemini-2.5-flash-lite',       label: 'Gemini 2.5 Flash Lite',  badge: '💚 Budget' },
      { id: 'alibaba-qwen3-coder-flash',    label: 'Qwen 3 Coder Flash',     badge: '🔵 Balanced' },
      { id: 'gpt-4o-mini',                 label: 'GPT-4o Mini',            badge: '🔵 Reliable' },
      { id: 'gemini-2.5-flash',            label: 'Gemini 2.5 Flash',       badge: '🔵 Fast' },
      { id: 'gpt-5.3-codex',              label: 'GPT-5.3 Codex',          badge: '🔴 Best Code' },
      { id: 'alibaba-qwen3-coder-plus',    label: 'Qwen 3 Coder Plus',      badge: '🔴 Power' },
      { id: 'alibaba-qwen3-32b',           label: 'Qwen 3 32B',             badge: '🔵 Smart' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    format: 'openai',
    keyPlaceholder: 'sk-...',
    keyHint: 'Get from platform.openai.com → API Keys',
    models: [
      { id: 'gpt-4o-mini',  label: 'GPT-4o Mini',  badge: '💚 Fast' },
      { id: 'gpt-4o',       label: 'GPT-4o',        badge: '🔵 Balanced' },
      { id: 'gpt-4-turbo',  label: 'GPT-4 Turbo',  badge: '🔴 Best' },
    ],
  },
  {
    id: 'groq',
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    format: 'openai',
    keyPlaceholder: 'gsk_...',
    keyHint: 'Free tier at console.groq.com — extremely fast',
    models: [
      { id: 'llama-3.1-8b-instant',        label: 'Llama 3.1 8B',     badge: '💚 Free+Fast' },
      { id: 'llama-3.3-70b-versatile',     label: 'Llama 3.3 70B',    badge: '🔵 Balanced' },
      { id: 'qwen-qwq-32b',                label: 'Qwen QwQ 32B',     badge: '🔵 Reasoning' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    format: 'anthropic',
    keyPlaceholder: 'sk-ant-...',
    keyHint: 'Get from console.anthropic.com → API Keys',
    models: [
      { id: 'claude-haiku-4-5-20251001',   label: 'Claude Haiku 4.5',   badge: '💚 Fast' },
      { id: 'claude-sonnet-4-5-20250929',  label: 'Claude Sonnet 4.5',  badge: '🔵 Balanced' },
    ],
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    format: 'openai',
    keyPlaceholder: 'AIza...',
    keyHint: 'Free tier at aistudio.google.com → API Keys',
    models: [
      { id: 'gemini-2.0-flash',  label: 'Gemini 2.0 Flash',  badge: '💚 Free' },
      { id: 'gemini-2.5-flash',  label: 'Gemini 2.5 Flash',  badge: '🔵 Balanced' },
      { id: 'gemini-2.5-pro',    label: 'Gemini 2.5 Pro',    badge: '🔴 Best' },
    ],
  },
]

export const WEBLLM_MODELS = [
  {
    id: 'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC',
    label: 'Qwen 2.5 Coder 1.5B',
    size: '~900MB',
    description: 'Best in-browser code model',
  },
  {
    id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    label: 'Llama 3.2 1B',
    size: '~700MB',
    description: 'Lightweight, general purpose',
  },
]

// ─── Prompt ───────────────────────────────────────────────────────────────────

function getLangName(value) {
  return ALL_LANGUAGES.find(l => l.value === value)?.label || value
}

function buildPrompt(code, fromLang, toLang) {
  const from = getLangName(fromLang)
  const to   = getLangName(toLang)

  const langSpecific = {
    python:     'Use proper indentation. No braces. No class wrapper around standalone main.',
    cpp:        'Include all necessary headers. Use std namespace.',
    c:          'Use only C standard library. No C++ features.',
    haskell:    'Use idiomatic functional style with pattern matching where appropriate.',
    rust:       'Use idiomatic Rust with ownership and borrowing. Add use statements.',
    go:         'Use idiomatic Go. Add package main and necessary imports.',
    pascal:     'Use standard Pascal syntax with Begin/End blocks.',
    ocaml:      'Use idiomatic functional OCaml style.',
    javascript: 'Use modern ES6+ syntax.',
    kotlin:     'Use idiomatic Kotlin with val/var, data classes where appropriate.',
    scala:      'Use idiomatic Scala. Prefer immutable values.',
  }

  const hint = langSpecific[toLang] ? `\n- ${langSpecific[toLang]}` : ''

  return `You are an expert competitive programmer and code translator.
Convert the following ${from} code to ${to}.

Rules:
- Output ONLY the translated code, nothing else
- No markdown fences, no explanations, no comments about the translation itself
- Preserve all logic, algorithms, and data structures exactly
- Use idiomatic ${to} patterns and standard library equivalents${hint}
- Keep variable and function names the same where possible

${from} code:
${code}

${to} translation:`
}

function stripFences(text) {
  return text.replace(/^```[\w]*\n?/m, '').replace(/```\s*$/m, '').trim()
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

async function fetchOpenAI({ baseUrl, apiKey, modelId, prompt }) {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 4096,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `HTTP ${res.status}`)
  }
  const data = await res.json()
  return stripFences(data?.choices?.[0]?.message?.content || '')
}

async function fetchAnthropic({ apiKey, modelId, prompt }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `HTTP ${res.status}`)
  }
  const data = await res.json()
  return stripFences(data?.content?.[0]?.text || '')
}

// ─── Main translate function ──────────────────────────────────────────────────

export async function translateWithAPI(code, fromLang, toLang, { apiKey, providerId, modelId }) {
  if (!apiKey) throw new Error('No API key set. Open LLM Settings to add your key.')
  const provider = PROVIDERS.find(p => p.id === providerId)
  if (!provider) throw new Error(`Unknown provider: ${providerId}`)
  const prompt = buildPrompt(code, fromLang, toLang)
  if (provider.format === 'anthropic') return fetchAnthropic({ apiKey, modelId, prompt })
  return fetchOpenAI({ baseUrl: provider.baseUrl, apiKey, modelId, prompt })
}

// ─── WebLLM ───────────────────────────────────────────────────────────────────

let webllmEngine = null
let loadedModelId = null

export async function loadWebLLMModel(modelId, onProgress) {
  const { CreateMLCEngine } = await import('https://esm.run/@mlc-ai/web-llm')
  if (loadedModelId === modelId && webllmEngine) {
    onProgress?.({ text: 'Model already loaded', progress: 1 })
    return
  }
  webllmEngine = await CreateMLCEngine(modelId, {
    initProgressCallback: (r) => onProgress?.({ text: r.text, progress: r.progress }),
  })
  loadedModelId = modelId
}

export async function translateWithWebLLM(code, fromLang, toLang) {
  if (!webllmEngine) throw new Error('No model loaded. Open LLM Settings → Offline tab.')
  const reply = await webllmEngine.chat.completions.create({
    messages: [{ role: 'user', content: buildPrompt(code, fromLang, toLang) }],
    temperature: 0.1,
    max_tokens: 2048,
  })
  return stripFences(reply?.choices?.[0]?.message?.content || '')
}

export const isWebLLMReady  = () => webllmEngine !== null
export const getLoadedModelId = () => loadedModelId
//
