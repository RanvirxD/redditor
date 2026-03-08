/**
 * llmTranslator.js
 * Handles LLM-based translation via MegaLLM API (online) or WebLLM (offline)
 */

// ─── MegaLLM Models ───────────────────────────────────────────────────────────

export const LLM_MODELS = [
  {
    id: 'gemini-2.5-flash-lite',
    label: 'Gemini 2.5 Flash Lite',
    provider: 'Google',
    tier: 'budget',
    badge: '💚 Budget',
  },
  {
    id: 'alibaba-qwen3-coder-flash',
    label: 'Qwen 3 Coder Flash',
    provider: 'Alibaba',
    tier: 'balanced',
    badge: '🔵 Balanced',
  },
  {
    id: 'gpt-5.3-codex',
    label: 'GPT-5.3 Codex',
    provider: 'OpenAI',
    tier: 'best',
    badge: '🔴 Best',
  },
  {
    id: 'gpt-4o-mini',
    label: 'GPT-4o Mini',
    provider: 'OpenAI',
    tier: 'balanced',
    badge: '🔵 Reliable',
  },
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    provider: 'Google',
    tier: 'balanced',
    badge: '🔵 Balanced',
  },
  {
    id: 'alibaba-qwen3-coder-plus',
    label: 'Qwen 3 Coder Plus',
    provider: 'Alibaba',
    tier: 'best',
    badge: '🔴 Power',
  },
]

// ─── WebLLM Offline Models ────────────────────────────────────────────────────

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

// ─── Prompt Builder ───────────────────────────────────────────────────────────

function buildPrompt(code, fromLang, toLang) {
  const langName = { java: 'Java', python: 'Python', cpp: 'C++' }
  return `You are an expert code translator. Convert the following ${langName[fromLang]} code to ${langName[toLang]}.

Rules:
- Output ONLY the translated code, no explanations, no markdown fences, no comments about the translation
- Preserve all logic exactly
- Use idiomatic ${langName[toLang]} patterns and conventions
- For Python: use proper indentation, no Java-style braces
- For C++: include necessary headers, use std namespace
- Do NOT wrap output in \`\`\` code blocks

${langName[fromLang]} code:
${code}

${langName[toLang]} translation:`
}

// ─── Online: MegaLLM API ──────────────────────────────────────────────────────

export async function translateWithAPI(code, fromLang, toLang, { apiKey, baseUrl = 'https://ai.megallm.io/v1', modelId = 'alibaba-qwen3-coder-flash' }) {
  if (!apiKey) throw new Error('No API key set. Open LLM Settings to add your MegaLLM key.')
  if (!baseUrl) throw new Error('No base URL configured.')

  const url = baseUrl.replace(/\/$/, '') + '/chat/completions'

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: 'user', content: buildPrompt(code, fromLang, toLang) }
      ],
      temperature: 0.1,
      max_tokens: 4096,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `API error ${res.status}`)
  }

  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content || ''

  // Strip any accidental markdown fences the model added anyway
  return text
    .replace(/^```[\w]*\n?/m, '')
    .replace(/```$/m, '')
    .trim()
}

// ─── Offline: WebLLM ──────────────────────────────────────────────────────────

let webllmEngine = null
let loadedModelId = null

export async function loadWebLLMModel(modelId, onProgress) {
  const { CreateMLCEngine } = await import('https://esm.run/@mlc-ai/web-llm')

  if (loadedModelId === modelId && webllmEngine) {
    onProgress?.({ text: 'Model already loaded', progress: 1 })
    return
  }

  webllmEngine = await CreateMLCEngine(modelId, {
    initProgressCallback: (report) => {
      onProgress?.({
        text: report.text,
        progress: report.progress,
      })
    },
  })
  loadedModelId = modelId
}

export async function translateWithWebLLM(code, fromLang, toLang) {
  if (!webllmEngine) throw new Error('No model loaded. Download a model first in LLM Settings.')

  const reply = await webllmEngine.chat.completions.create({
    messages: [{ role: 'user', content: buildPrompt(code, fromLang, toLang) }],
    temperature: 0.1,
    max_tokens: 2048,
  })

  const text = reply?.choices?.[0]?.message?.content || ''
  return text
    .replace(/^```[\w]*\n?/m, '')
    .replace(/```$/m, '')
    .trim()
}

export function isWebLLMReady() {
  return webllmEngine !== null
}

export function getLoadedModelId() {
  return loadedModelId
}
