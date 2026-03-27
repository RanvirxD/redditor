# Redditor

Multi-language code editor and translator for competitive programmers and educators.

**Live:** [redditorcode.vercel.app](https://redditorcode.vercel.app)

---

## What it does

Write code in one language, see it translated into multiple languages side by side in real time. Every panel has a real compiler — run and verify output without leaving the editor.

---

## Translation Modes

**AST Engine**
Custom token-based parser. Java only as source, translates to Python and C++. Fires automatically on every keystroke with a 600ms debounce. No API key, no cost, instant.

**LLM Mode**
AI-powered translation via your choice of provider. Supports all 19 languages as both source and target. Manual trigger or configurable auto-run interval (5s / 10s / 20s / 30s). The Run LLM button glows when code has changed since the last run.

---

## Compiler (Building)

By [Piston](https://github.com/engineer-man/piston) — free, open source, sandboxed execution. No API key required.

Each editor panel has a Run button in its header. Output appears in an inline terminal below the editor showing stdout, stderr, and compile errors separately. Stdin input is supported for programs that read from the terminal.

---

## Supported Languages

```
Java, Python, C++, C, C#, JavaScript, TypeScript,
Kotlin, Rust, Go, Scala, Ruby, Swift, PHP,
Haskell, Perl, OCaml, Pascal, D
```

AST engine supports Java as source, Python and C++ as targets only.
LLM mode supports all 19 languages in both directions.

---

## LLM Providers

| Provider       | Key format   | Free tier |
|----------------|-------------|-----------|
| MegaLLM        | custom      | yes       |
| OpenAI         | sk-...      | no        |
| Groq           | gsk_...     | yes       |
| Anthropic      | sk-ant-...  | no        |
| Google Gemini  | AIza...     | yes       |

API keys are stored in `localStorage` and never leave your browser. Switch providers and models from the settings modal (gear icon in LLM mode).

**Offline mode:** WebLLM runs a quantized model entirely in your browser via WebGPU. Requires Chrome 113+ or Edge 113+. Models are downloaded once and cached.

---

## File Structure

```
code-sync-editor/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── src/
    ├── main.jsx
    ├── index.css
    ├── App.jsx                  # layout, mode toggle, source/target language state
    ├── components/
    │   ├── EditorPanel.jsx      # Monaco editor + Run button + inline terminal
    │   └── LLMSettings.jsx      # provider/model/key settings modal
    └── utils/
        ├── translator.js        # AST engine (Java -> Python / C++)
        ├── llmTranslator.js     # LLM providers, prompt builder, WebLLM
        └── compiler.js          # Piston API integration
```

---

## Running Locally

```bash
git clone https://github.com/yourusername/redditor
cd redditor
npm install
npm run dev
```

Opens at `http://localhost:5173`.

---

## Tech Stack

| Layer       | Tech                          |
|-------------|-------------------------------|
| Framework   | React 18 + Vite 5             |
| Editor      | Monaco Editor                 |
| AST         | Custom JS token-based parser  |
| Compiler    | Piston API                    |
| LLM online  | OpenAI-compatible + Anthropic |
| LLM offline | WebLLM (WebGPU)               |
| Styling     | Tailwind CSS + inline styles  |
| Fonts       | JetBrains Mono + Syne         |
| Hosting     | Vercel                        |

---

## Notes

- The AST engine handles OOP patterns, collections, Scanner input, switch statements, lambdas, and more — but only for Java source. For everything else use LLM mode.
- Piston has a public rate limit. For heavy use consider self-hosting: [github.com/engineer-man/piston](https://github.com/engineer-man/piston).
- WebLLM models are 700MB–900MB. First load takes time depending on connection speed.

---

## License

MIT
