/**
 * translator.js
 * Token-based multi-language AST translator.
 * Handles: variable declarations, print, if/else, for/while loops,
 * functions, return statements, basic class structure.
 */

// ─── Type Maps ───────────────────────────────────────────────────────────────

const JAVA_TYPES = ['int', 'double', 'float', 'long', 'short', 'byte', 'char', 'boolean', 'String', 'void']

const TYPE_MAP_TO_CPP = {
  int: 'int', double: 'double', float: 'float', long: 'long',
  short: 'short', byte: 'int8_t', char: 'char', boolean: 'bool',
  String: 'string', void: 'void',
}

const OPERATOR_MAP_TO_PYTHON = {
  '&&': 'and', '||': 'or', '!': 'not ', 'true': 'True', 'false': 'False', 'null': 'None',
}

const OPERATOR_MAP_TO_CPP = {
  'true': 'true', 'false': 'false', 'null': 'nullptr',
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function applyOperatorMap(code, map) {
  let result = code
  for (const [from, to] of Object.entries(map)) {
    const isWord = /^\w+$/.test(from)
    const pattern = isWord
      ? new RegExp(`\\b${escapeRegex(from)}\\b`, 'g')
      : new RegExp(escapeRegex(from), 'g')
    result = result.replace(pattern, to)
  }
  return result
}

function getIndent(depth) {
  return '    '.repeat(depth)
}

function stripSemicolon(s) {
  return s.replace(/;$/, '').trim()
}

function stripOuterBraces(s) {
  return s.replace(/\s*\{$/, '').trim()
}

// ─── Java Tokenizer ───────────────────────────────────────────────────────────

function classifyLine(raw) {
  const line = raw.trim()

  if (line === '' || line === '{' || line === '}') return { type: 'structural', line }

  // Comments
  if (line.startsWith('//')) return { type: 'comment', line }
  if (line.startsWith('/*') || line.startsWith('*') || line.startsWith('*/')) return { type: 'comment', line }

  // Class declaration
  if (/^(public\s+)?(class)\s+\w+/.test(line)) return { type: 'class_decl', line }

  // Main method
  if (/public\s+static\s+void\s+main\s*\(/.test(line)) return { type: 'main_method', line }

  // Method/function declaration
  const methodMatch = line.match(/^(public|private|protected|static)?\s*(public|private|protected|static)?\s*(\w+)\s+(\w+)\s*\(([^)]*)\)\s*\{?$/)
  if (methodMatch && JAVA_TYPES.includes(methodMatch[3])) return { type: 'method_decl', line, match: methodMatch }

  // Variable declaration
  const varMatch = line.match(/^(int|double|float|long|short|byte|char|boolean|String|var)\s+(\w+)\s*=\s*(.+);$/)
  if (varMatch) return { type: 'var_decl', line, match: varMatch }

  // Variable declaration without assignment
  const varDeclMatch = line.match(/^(int|double|float|long|short|byte|char|boolean|String)\s+(\w+)\s*;$/)
  if (varDeclMatch) return { type: 'var_decl_only', line, match: varDeclMatch }

  // Print statements
  if (/System\.out\.println\(/.test(line)) return { type: 'print_ln', line }
  if (/System\.out\.print\(/.test(line)) return { type: 'print', line }

  // If statement
  if (/^if\s*\(/.test(line)) return { type: 'if_stmt', line }
  if (/^}\s*else\s+if\s*\(/.test(line) || /^else\s+if\s*\(/.test(line)) return { type: 'elif_stmt', line }
  if (/^}\s*else\s*\{?$/.test(line) || /^else\s*\{?$/.test(line)) return { type: 'else_stmt', line }

  // For loop — enhanced for
  const forEachMatch = line.match(/^for\s*\(\s*(\w+)\s+(\w+)\s*:\s*(\w+)\s*\)/)
  if (forEachMatch) return { type: 'foreach', line, match: forEachMatch }

  // For loop — standard
  const forMatch = line.match(/^for\s*\(\s*(?:int\s+)?(\w+)\s*=\s*(\S+);\s*\1\s*([<>!=]+)\s*(\S+);\s*\1(\+\+|--|[+\-]=\S+)\s*\)/)
  if (forMatch) return { type: 'for_loop', line, match: forMatch }

  // While loop
  if (/^while\s*\(/.test(line)) return { type: 'while_loop', line }

  // Return
  if (/^return\s/.test(line) || line === 'return;') return { type: 'return_stmt', line }

  // Closing brace
  if (/^\}/.test(line)) return { type: 'close_brace', line }

  return { type: 'raw', line }
}

// ─── Extract print argument ───────────────────────────────────────────────────

function extractPrintArg(line) {
  const m = line.match(/System\.out\.print(?:ln)?\((.+)\);?$/)
  return m ? m[1].trim() : '""'
}

// ─── Java → Python ────────────────────────────────────────────────────────────

export function translateToPython(javaCode) {
  const rawLines = javaCode.split('\n')
  const output = []
  let depth = 0
  let inClass = false
  let expectBlock = false

  const applyDepth = (s) => getIndent(depth) + s

  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i]
    const indent = raw.match(/^(\s*)/)[1]
    const { type, line, match } = classifyLine(raw)

    switch (type) {
      case 'structural': {
        if (line.trim() === '{') { depth++; break }
        if (line.trim() === '}') { if (depth > 0) depth--; break }
        output.push('')
        break
      }

      case 'comment': {
        const clean = line.replace(/^\/\/\s?/, '').replace(/^\/\*\s?/, '').replace(/\*\/$/, '').replace(/^\*\s?/, '').trim()
        if (clean) output.push(applyDepth(`# ${clean}`))
        break
      }

      case 'class_decl': {
        const name = line.match(/class\s+(\w+)/)[1]
        output.push(`class ${name}:`)
        depth++
        break
      }

      case 'main_method': {
        output.push(applyDepth('def main():'))
        depth++
        break
      }

      case 'method_decl': {
        const params = match[5] ? convertParamsToPython(match[5]) : ''
        output.push(applyDepth(`def ${match[4]}(${params}):`))
        depth++
        break
      }

      case 'var_decl': {
        let val = stripSemicolon(match[3])
        val = applyOperatorMap(val, OPERATOR_MAP_TO_PYTHON)
        output.push(applyDepth(`${match[2]} = ${val}`))
        break
      }

      case 'var_decl_only': {
        output.push(applyDepth(`${match[2]} = None`))
        break
      }

      case 'print_ln': {
        const arg = applyOperatorMap(extractPrintArg(line), OPERATOR_MAP_TO_PYTHON)
        output.push(applyDepth(`print(${arg})`))
        break
      }

      case 'print': {
        const arg = applyOperatorMap(extractPrintArg(line), OPERATOR_MAP_TO_PYTHON)
        output.push(applyDepth(`print(${arg}, end='')`))
        break
      }

      case 'if_stmt': {
        const cond = extractCondition(line)
        output.push(applyDepth(`if ${applyOperatorMap(cond, OPERATOR_MAP_TO_PYTHON)}:`))
        depth++
        break
      }

      case 'elif_stmt': {
        if (depth > 0) depth--
        const cond = extractCondition(line)
        output.push(applyDepth(`elif ${applyOperatorMap(cond, OPERATOR_MAP_TO_PYTHON)}:`))
        depth++
        break
      }

      case 'else_stmt': {
        if (depth > 0) depth--
        output.push(applyDepth('else:'))
        depth++
        break
      }

      case 'foreach': {
        output.push(applyDepth(`for ${match[2]} in ${match[3]}:`))
        depth++
        break
      }

      case 'for_loop': {
        const varName = match[1]
        const start = match[2]
        const op = match[3]
        const end = match[4]
        const step = match[5]

        let rangeStr = ''
        if (start === '0' && op === '<') {
          rangeStr = `range(${end})`
        } else if (op === '<') {
          rangeStr = `range(${start}, ${end})`
        } else if (op === '<=') {
          rangeStr = `range(${start}, ${end} + 1)`
        } else if (step === '--' || step.startsWith('-=')) {
          const decr = step === '--' ? 1 : parseInt(step.replace('-=', ''))
          rangeStr = `range(${start}, ${end}, -${decr})`
        } else {
          rangeStr = `range(${start}, ${end})`
        }

        output.push(applyDepth(`for ${varName} in ${rangeStr}:`))
        depth++
        break
      }

      case 'while_loop': {
        const cond = extractCondition(line)
        output.push(applyDepth(`while ${applyOperatorMap(cond, OPERATOR_MAP_TO_PYTHON)}:`))
        depth++
        break
      }

      case 'return_stmt': {
        const val = line.replace(/^return\s*/, '').replace(/;$/, '').trim()
        output.push(applyDepth(val ? `return ${applyOperatorMap(val, OPERATOR_MAP_TO_PYTHON)}` : 'return'))
        break
      }

      case 'close_brace': {
        if (depth > 0) depth--
        break
      }

      case 'raw': {
        // Pass through with basic operator replacement
        const cleaned = stripSemicolon(applyOperatorMap(line, OPERATOR_MAP_TO_PYTHON))
        if (cleaned) output.push(applyDepth(cleaned))
        break
      }
    }
  }

  return output.join('\n')
}

// ─── Java → C++ ───────────────────────────────────────────────────────────────

export function translateToCpp(javaCode) {
  const rawLines = javaCode.split('\n')
  const output = []
  let hasMainMethod = false
  let hasClass = false

  // Detect if main method exists to add includes
  if (/public\s+static\s+void\s+main/.test(javaCode)) {
    hasMainMethod = true
    output.push('#include <iostream>')
    output.push('#include <string>')
    output.push('using namespace std;')
    output.push('')
  }

  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i]
    const indentMatch = raw.match(/^(\s*)/)
    const indent = indentMatch ? indentMatch[1] : ''
    const { type, line, match } = classifyLine(raw)

    switch (type) {
      case 'structural': {
        if (line.trim() === '') output.push('')
        else output.push(indent + line.trim())
        break
      }

      case 'comment': {
        output.push(indent + line)
        break
      }

      case 'class_decl': {
        const name = line.match(/class\s+(\w+)/)[1]
        output.push(`class ${name} {`)
        output.push('public:')
        hasClass = true
        break
      }

      case 'main_method': {
        output.push(`${indent}int main() {`)
        break
      }

      case 'method_decl': {
        const retType = TYPE_MAP_TO_CPP[match[3]] || match[3]
        const params = match[5] ? convertParamsToCpp(match[5]) : ''
        const hasBrace = line.trim().endsWith('{')
        output.push(`${indent}${retType} ${match[4]}(${params})${hasBrace ? ' {' : ';'}`)
        break
      }

      case 'var_decl': {
        const cppType = TYPE_MAP_TO_CPP[match[1]] || match[1]
        let val = stripSemicolon(match[3])
        val = applyOperatorMap(val, OPERATOR_MAP_TO_CPP)
        output.push(`${indent}${cppType} ${match[2]} = ${val};`)
        break
      }

      case 'var_decl_only': {
        const cppType = TYPE_MAP_TO_CPP[match[1]] || match[1]
        output.push(`${indent}${cppType} ${match[2]};`)
        break
      }

      case 'print_ln': {
        const arg = applyOperatorMap(extractPrintArg(line), OPERATOR_MAP_TO_CPP)
        output.push(`${indent}cout << ${arg} << endl;`)
        break
      }

      case 'print': {
        const arg = applyOperatorMap(extractPrintArg(line), OPERATOR_MAP_TO_CPP)
        output.push(`${indent}cout << ${arg};`)
        break
      }

      case 'if_stmt': {
        const cond = extractCondition(line)
        output.push(`${indent}if (${applyOperatorMap(cond, OPERATOR_MAP_TO_CPP)}) {`)
        break
      }

      case 'elif_stmt': {
        const cond = extractCondition(line)
        output.push(`${indent}} else if (${applyOperatorMap(cond, OPERATOR_MAP_TO_CPP)}) {`)
        break
      }

      case 'else_stmt': {
        output.push(`${indent}} else {`)
        break
      }

      case 'foreach': {
        output.push(`${indent}for (auto ${match[2]} : ${match[3]}) {`)
        break
      }

      case 'for_loop': {
        output.push(`${indent}${stripOuterBraces(line)} {`)
        break
      }

      case 'while_loop': {
        const cond = extractCondition(line)
        output.push(`${indent}while (${applyOperatorMap(cond, OPERATOR_MAP_TO_CPP)}) {`)
        break
      }

      case 'return_stmt': {
        const val = line.replace(/^return\s*/, '').replace(/;$/, '').trim()
        output.push(`${indent}return ${applyOperatorMap(val, OPERATOR_MAP_TO_CPP)};`)
        break
      }

      case 'close_brace': {
        output.push(indent + '}')
        break
      }

      case 'raw': {
        let cleaned = applyOperatorMap(line, OPERATOR_MAP_TO_CPP)
        if (!cleaned.endsWith(';') && !cleaned.endsWith('{') && !cleaned.endsWith('}') && cleaned.trim() !== '') {
          cleaned += ';'
        }
        output.push(indent + cleaned)
        break
      }
    }
  }

  // Add return 0 before closing brace of main if needed
  if (hasMainMethod) {
    const lastLines = output.slice(-3).join('\n')
    if (!lastLines.includes('return 0')) {
      const lastClose = output.lastIndexOf('}')
      if (lastClose !== -1) output.splice(lastClose, 0, '    return 0;')
    }
  }

  return output.join('\n')
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractCondition(line) {
  const m = line.match(/\((.+)\)\s*\{?$/)
  return m ? m[1].trim() : ''
}

function convertParamsToPython(params) {
  if (!params.trim()) return ''
  return params.split(',').map(p => {
    const parts = p.trim().split(/\s+/)
    return parts[parts.length - 1]
  }).join(', ')
}

function convertParamsToCpp(params) {
  if (!params.trim()) return ''
  return params.split(',').map(p => {
    const parts = p.trim().split(/\s+/)
    if (parts.length >= 2) {
      const t = TYPE_MAP_TO_CPP[parts[0]] || parts[0]
      return `${t} ${parts[1]}`
    }
    return p.trim()
  }).join(', ')
}

// ─── Main translate entry ─────────────────────────────────────────────────────

export function translate(code, fromLang, toLang) {
  if (!code.trim()) return ''
  if (fromLang === 'java' && toLang === 'python') return translateToPython(code)
  if (fromLang === 'java' && toLang === 'cpp') return translateToCpp(code)
  // Placeholder for other directions (added in future)
  return `// Translation from ${fromLang} to ${toLang} coming soon`
}