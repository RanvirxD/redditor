/**
 * translator.js
 * Token-based multi-language AST translator — Java → Python / C++
 *
 * Handles:
 *  - imports (java.util.* → proper equivalents or stripped)
 *  - access modifiers (public/private/protected)
 *  - class declarations + constructors
 *  - field declarations inside classes
 *  - ArrayList / collections → list / vector
 *  - Scanner → input() / cin
 *  - System.out.println / print
 *  - if / else if / else
 *  - for (standard + enhanced) / while / do-while
 *  - switch statements (classic + arrow syntax)
 *  - method declarations (with self injection for Python)
 *  - @Override / @annotations
 *  - toString() → __str__
 *  - String.format → f-string / sprintf
 *  - new ClassName() → ClassName() for Python
 *  - return statements
 *  - operator maps (&&, ||, !, true, false, null)
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const JAVA_PRIMITIVES = ['int', 'double', 'float', 'long', 'short', 'byte', 'char', 'boolean', 'String', 'void']

const TYPE_TO_CPP = {
  int: 'int', double: 'double', float: 'float', long: 'long',
  short: 'short', byte: 'int8_t', char: 'char', boolean: 'bool',
  String: 'string', void: 'void',
}

const IMPORT_TO_CPP = {
  'java.util.ArrayList': '#include <vector>',
  'java.util.List':      '#include <vector>',
  'java.util.LinkedList':'#include <list>',
  'java.util.HashMap':   '#include <unordered_map>',
  'java.util.Map':       '#include <map>',
  'java.util.Scanner':   null,
  'java.util.Arrays':    '#include <algorithm>',
  'java.lang.Math':      '#include <cmath>',
}

const OP_TO_PYTHON = {
  '&&': 'and', '||': 'or', '!': 'not ', 'true': 'True', 'false': 'False', 'null': 'None',
}

const OP_TO_CPP = {
  'true': 'true', 'false': 'false', 'null': 'nullptr',
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function applyOpMap(code, map) {
  let result = code
  for (const [from, to] of Object.entries(map)) {
    const isWord = /^\w+$/.test(from)
    const pat = isWord
      ? new RegExp(`\\b${escapeRegex(from)}\\b`, 'g')
      : new RegExp(escapeRegex(from), 'g')
    result = result.replace(pat, to)
  }
  return result
}

function ind(depth) {
  return '    '.repeat(depth)
}

function stripSemi(s) {
  return s.replace(/;+$/, '').trim()
}

function stripAccessModifiersKeepStatic(s) {
  return s
    .replace(/\b(public|private|protected|final|abstract|synchronized)\s+/g, '')
    .trim()
}

function convertCollectionType(type) {
  const m1 = type.match(/ArrayList<(.+)>/)
  if (m1) return { python: 'list', cpp: `vector<${m1[1]}>` }
  const m2 = type.match(/List<(.+)>/)
  if (m2) return { python: 'list', cpp: `vector<${m2[1]}>` }
  const m3 = type.match(/HashMap<(.+),\s*(.+)>/)
  if (m3) return { python: 'dict', cpp: `unordered_map<${m3[1]}, ${m3[2]}>` }
  return null
}

function convertNewCollection(val) {
  if (/new\s+ArrayList(<.*>)?\(\)/.test(val)) return { python: '[]', cpp: '{}' }
  if (/new\s+LinkedList(<.*>)?\(\)/.test(val)) return { python: '[]', cpp: '{}' }
  if (/new\s+HashMap(<.*>)?\(\)/.test(val)) return { python: '{}', cpp: '{}' }
  return null
}

function convertNewInstance(val) {
  return val.replace(/\bnew\s+(\w+)(<[^>]*>)?\s*\(/g, '$1(')
}

function convertCollectionMethodsPython(line) {
  return line
    .replace(/(\w+)\.add\((.+)\)/g, '$1.append($2)')
    .replace(/(\w+)\.isEmpty\(\)/g, 'len($1) == 0')
    .replace(/(\w+)\.size\(\)/g, 'len($1)')
    .replace(/(\w+)\.get\((\d+)\)/g, '$1[$2]')
    .replace(/(\w+)\.remove\((\d+)\)/g, '$1.pop($2)')
    .replace(/(\w+)\.contains\((.+)\)/g, '$2 in $1')
    .replace(/(\w+)\.clear\(\)/g, '$1.clear()')
}

function convertCollectionMethodsCpp(line) {
  return line
    .replace(/(\w+)\.add\((.+)\)/g, '$1.push_back($2)')
    .replace(/(\w+)\.isEmpty\(\)/g, '$1.empty()')
    .replace(/(\w+)\.size\(\)/g, '$1.size()')
    .replace(/(\w+)\.get\((\d+)\)/g, '$1[$2]')
    .replace(/(\w+)\.remove\((\d+)\)/g, '$1.erase($1.begin() + $2)')
    .replace(/(\w+)\.contains\((.+)\)/g, 'find($1.begin(), $1.end(), $2) != $1.end()')
    .replace(/(\w+)\.clear\(\)/g, '$1.clear()')
}

function convertStringFormatPython(line) {
  const m = line.match(/String\.format\("([^"]*)"(,\s*(.+))?\)/)
  if (!m) return line
  let template = m[1]
  const args = m[3] ? m[3].split(',').map(a => a.trim()) : []
  let i = 0
  template = template.replace(/%[\d.]*[sdf]/g, () => `{${args[i++] || ''}}`)
  return line.replace(/String\.format\("[^"]*"(,\s*.+)?\)/, `f"${template}"`)
}

function convertStringFormatCpp(line) {
  return line.replace(/String\.format\(/, '/* use printf */ sprintf(buffer, ')
}

function extractCondition(line) {
  const m = line.match(/\((.+)\)\s*[\{;]?\s*$/)
  return m ? m[1].trim() : ''
}

// ─── Line Classifier ──────────────────────────────────────────────────────────

function classifyLine(raw) {
  const line = raw.trim()

  if (line === '') return { type: 'blank' }
  if (line === '{') return { type: 'open_brace' }
  if (line === '}' || line === '};') return { type: 'close_brace' }

  if (/^@\w+/.test(line)) return { type: 'annotation', line }
  if (line.startsWith('//')) return { type: 'comment', line }
  if (line.startsWith('/*') || line.startsWith('*') || line.startsWith('*/')) return { type: 'comment', line }

  const importMatch = line.match(/^import\s+([\w.]+);$/)
  if (importMatch) return { type: 'import', line, pkg: importMatch[1] }

  if (/^package\s+/.test(line)) return { type: 'skip' }

  if (/\bclass\s+\w+/.test(line)) {
    const m = line.match(/\bclass\s+(\w+)(?:\s+extends\s+(\w+))?/)
    return { type: 'class_decl', line, name: m[1], parent: m?.[2] }
  }

  if (/public\s+static\s+void\s+main\s*\(/.test(line)) return { type: 'main_method', line }

  // Constructor
  const ctorMatch = line.match(/^(?:public|private|protected)?\s*([A-Z]\w+)\s*\(([^)]*)\)\s*\{?$/)
  if (ctorMatch && !JAVA_PRIMITIVES.includes(ctorMatch[1])) {
    return { type: 'constructor', line, name: ctorMatch[1], params: ctorMatch[2] }
  }

  // Method
  const methodMatch = line.match(
    /^(?:(?:public|private|protected|static|final|synchronized|abstract)\s+)*(\w[\w<>\[\]]*)\s+(\w+)\s*\(([^)]*)\)\s*(?:throws\s+[\w,\s]+)?\{?$/
  )
  if (methodMatch && (JAVA_PRIMITIVES.includes(methodMatch[1]) || /^[A-Z]/.test(methodMatch[1]))) {
    return { type: 'method_decl', line, returnType: methodMatch[1], name: methodMatch[2], params: methodMatch[3] }
  }

  // this.field = value
  const thisAssign = line.match(/^this\.(\w+)\s*=\s*(.+);$/)
  if (thisAssign) return { type: 'this_assign', line, field: thisAssign[1], value: thisAssign[2] }

  // Field with access modifier
  const fieldMatch = line.match(/^(?:public|private|protected|static|final)\s+(?:(?:public|private|protected|static|final)\s+)*([\w<>\[\]]+)\s+(\w+)\s*(?:=\s*(.+))?;$/)
  if (fieldMatch) return { type: 'field_decl', line, ftype: fieldMatch[1], fname: fieldMatch[2], fval: fieldMatch[3] }

  // Local variable
  const varMatch = line.match(/^([\w<>\[\]]+)\s+(\w+)\s*=\s*(.+);$/)
  if (varMatch && (JAVA_PRIMITIVES.includes(varMatch[1]) || /ArrayList|List|HashMap|Map/.test(varMatch[1]))) {
    return { type: 'var_decl', line, vtype: varMatch[1], vname: varMatch[2], vval: varMatch[3] }
  }

  const varOnlyMatch = line.match(/^([\w<>\[\]]+)\s+(\w+);$/)
  if (varOnlyMatch && JAVA_PRIMITIVES.includes(varOnlyMatch[1])) {
    return { type: 'var_decl_only', line, vtype: varOnlyMatch[1], vname: varOnlyMatch[2] }
  }

  if (/System\.out\.println\(/.test(line)) return { type: 'print_ln', line }
  if (/System\.out\.print\(/.test(line)) return { type: 'print', line }

  if (/Scanner\s+\w+\s*=\s*new\s+Scanner/.test(line)) return { type: 'scanner_init', line }
  if (/=\s*scanner\.(next|nextLine|nextInt|nextDouble)\(\)/.test(line)) return { type: 'scanner_input', line }

  if (/^switch\s*\(/.test(line)) return { type: 'switch_stmt', line }
  const caseArrow = line.match(/^case\s+(.+)\s*->\s*(.+);?$/)
  if (caseArrow) return { type: 'case_arrow', line, val: caseArrow[1].trim(), body: caseArrow[2].trim() }
  const caseColon = line.match(/^case\s+(.+):$/)
  if (caseColon) return { type: 'case_colon', line, val: caseColon[1].trim() }
  if (/^default\s*[:\-]/.test(line)) return { type: 'case_default', line }
  if (/^break;?$/.test(line)) return { type: 'break_stmt', line }

  if (/^if\s*\(/.test(line)) return { type: 'if_stmt', line }
  if (/^}\s*else\s+if\s*\(/.test(line) || /^else\s+if\s*\(/.test(line)) return { type: 'elif_stmt', line }
  if (/^}\s*else\s*\{?$/.test(line) || /^else\s*\{?$/.test(line)) return { type: 'else_stmt', line }

  const forEachMatch = line.match(/^for\s*\(\s*(?:\w+\s+)?(\w+)\s+(\w+)\s*:\s*(\w+)\s*\)/)
  if (forEachMatch) return { type: 'foreach', line, varName: forEachMatch[2], collection: forEachMatch[3] }

  const forMatch = line.match(/^for\s*\(\s*(?:int\s+)?(\w+)\s*=\s*([^;]+);\s*\1\s*([<>!=]+)\s*([^;]+);\s*(.+)\)/)
  if (forMatch) return { type: 'for_loop', line, varName: forMatch[1], start: forMatch[2].trim(), op: forMatch[3], end: forMatch[4].trim(), step: forMatch[5].trim() }

  if (/^while\s*\(/.test(line)) return { type: 'while_loop', line }
  if (/^do\s*\{?$/.test(line)) return { type: 'do_while_start', line }
  if (/^}\s*while\s*\(/.test(line)) return { type: 'do_while_end', line }

  if (/^return\b/.test(line)) return { type: 'return_stmt', line }
  if (/^\}/.test(line)) return { type: 'close_brace', line }

  return { type: 'raw', line }
}

function extractPrintArg(line) {
  const m = line.match(/System\.out\.print(?:ln)?\((.+)\);?$/)
  return m ? m[1].trim() : '""'
}

function paramsToPython(params, addSelf = true) {
  if (!params.trim()) return addSelf ? 'self' : ''
  const args = params.split(',').map(p => {
    const parts = p.trim().split(/\s+/)
    return parts[parts.length - 1]
  }).join(', ')
  return addSelf ? `self, ${args}` : args
}

function paramsToCpp(params) {
  if (!params.trim()) return ''
  return params.split(',').map(p => {
    const parts = p.trim().split(/\s+/)
    if (parts.length >= 2) {
      const t = TYPE_TO_CPP[parts[0]] || parts[0]
      return `${t} ${parts.slice(1).join(' ')}`
    }
    return p.trim()
  }).join(', ')
}

// ─── Java → Python ────────────────────────────────────────────────────────────

export function translateToPython(javaCode) {
  const lines = javaCode.split('\n')
  const out = []
  let depth = 0
  let inClass = false
  let inSwitch = false
  let switchVar = ''
  let switchDepth = 0
  let firstCase = true

  const pad = () => ind(depth)

  for (const raw of lines) {
    const { type, line, ...rest } = classifyLine(raw)

    switch (type) {
      case 'blank': out.push(''); break
      case 'open_brace': depth++; break
      case 'close_brace': {
        if (depth > 0) depth--
        if (inSwitch && depth <= switchDepth) inSwitch = false
        break
      }
      case 'skip': break
      case 'annotation': break

      case 'import': {
        const pkg = rest.pkg
        if (pkg.includes('Math')) out.push('import math')
        // All Java collection/IO imports are built-in in Python — skip
        break
      }

      case 'comment': {
        const clean = line.replace(/^\/\/\s?/, '').replace(/^\/\*+\s?/, '').replace(/\*+\/$/, '').replace(/^\*+\s?/, '').trim()
        if (clean) out.push(`${pad()}# ${clean}`)
        break
      }

      case 'class_decl': {
        const parent = rest.parent ? `(${rest.parent})` : ''
        out.push(`${pad()}class ${rest.name}${parent}:`)
        depth++
        inClass = true
        break
      }

      case 'main_method': {
        out.push(`${pad()}def main():`)
        depth++
        break
      }

      case 'constructor': {
        out.push(`${pad()}def __init__(${paramsToPython(rest.params, true)}):`)
        depth++
        break
      }

      case 'method_decl': {
        const mName = rest.name === 'toString' ? '__str__' : rest.name
        const params = paramsToPython(rest.params, inClass)
        out.push(`${pad()}def ${mName}(${params}):`)
        if (line.trim().endsWith('{')) depth++
        break
      }

      case 'field_decl': {
        const coll = convertCollectionType(rest.ftype)
        const newColl = rest.fval ? convertNewCollection(rest.fval) : null
        if (newColl) {
          out.push(`${pad()}${rest.fname} = ${newColl.python}`)
        } else if (rest.fval) {
          const val = applyOpMap(convertNewInstance(convertStringFormatPython(stripSemi(rest.fval))), OP_TO_PYTHON)
          out.push(`${pad()}${rest.fname} = ${val}`)
        } else {
          out.push(`${pad()}${rest.fname} = None`)
        }
        break
      }

      case 'this_assign': {
        const val = applyOpMap(convertNewInstance(stripSemi(rest.value)), OP_TO_PYTHON)
        out.push(`${pad()}self.${rest.field} = ${val}`)
        break
      }

      case 'var_decl': {
        const newColl = convertNewCollection(rest.vval)
        if (newColl) {
          out.push(`${pad()}${rest.vname} = ${newColl.python}`)
        } else {
          let val = stripSemi(rest.vval)
          val = convertCollectionMethodsPython(val)
          val = convertStringFormatPython(val)
          val = convertNewInstance(val)
          val = applyOpMap(val, OP_TO_PYTHON)
          out.push(`${pad()}${rest.vname} = ${val}`)
        }
        break
      }

      case 'var_decl_only': {
        out.push(`${pad()}${rest.vname} = None`)
        break
      }

      case 'scanner_init': break

      case 'scanner_input': {
        const vm = line.match(/(\w+)\s*=\s*scanner\.(next\w*)\(\)/)
        if (vm) {
          const cast = vm[2] === 'nextInt' ? 'int(input())' : vm[2] === 'nextDouble' ? 'float(input())' : 'input()'
          out.push(`${pad()}${vm[1]} = ${cast}`)
        }
        break
      }

      case 'print_ln': {
        const arg = applyOpMap(convertStringFormatPython(extractPrintArg(line)), OP_TO_PYTHON)
        out.push(`${pad()}print(${arg})`)
        break
      }

      case 'print': {
        const arg = applyOpMap(convertStringFormatPython(extractPrintArg(line)), OP_TO_PYTHON)
        out.push(`${pad()}print(${arg}, end='')`)
        break
      }

      case 'switch_stmt': {
        switchVar = extractCondition(line)
        inSwitch = true
        switchDepth = depth
        firstCase = true
        depth++
        break
      }

      case 'case_arrow': {
        const kw = firstCase ? 'if' : 'elif'
        firstCase = false
        out.push(`${ind(depth - 1)}${kw} ${switchVar} == ${rest.val}:`)
        out.push(`${pad()}${applyOpMap(stripSemi(rest.body), OP_TO_PYTHON)}`)
        break
      }

      case 'case_colon': {
        const kw = firstCase ? 'if' : 'elif'
        firstCase = false
        out.push(`${ind(depth - 1)}${kw} ${switchVar} == ${rest.val}:`)
        break
      }

      case 'case_default': {
        out.push(`${ind(depth - 1)}else:`)
        break
      }

      case 'break_stmt': break

      case 'if_stmt': {
        const cond = applyOpMap(extractCondition(line), OP_TO_PYTHON)
        out.push(`${pad()}if ${cond}:`)
        depth++
        break
      }

      case 'elif_stmt': {
        if (depth > 0) depth--
        const cond = applyOpMap(extractCondition(line), OP_TO_PYTHON)
        out.push(`${pad()}elif ${cond}:`)
        depth++
        break
      }

      case 'else_stmt': {
        if (depth > 0) depth--
        out.push(`${pad()}else:`)
        depth++
        break
      }

      case 'foreach': {
        out.push(`${pad()}for ${rest.varName} in ${rest.collection}:`)
        depth++
        break
      }

      case 'for_loop': {
        const { varName, start, op, end, step } = rest
        let rangeStr
        if (start === '0' && op === '<') rangeStr = `range(${end})`
        else if (op === '<') rangeStr = `range(${start}, ${end})`
        else if (op === '<=') rangeStr = `range(${start}, ${end} + 1)`
        else if (step.includes('--')) rangeStr = `range(${start}, ${end}, -1)`
        else rangeStr = `range(${start}, ${end})`
        out.push(`${pad()}for ${varName} in ${rangeStr}:`)
        depth++
        break
      }

      case 'while_loop': {
        out.push(`${pad()}while ${applyOpMap(extractCondition(line), OP_TO_PYTHON)}:`)
        depth++
        break
      }

      case 'do_while_start': {
        out.push(`${pad()}while True:`)
        depth++
        break
      }

      case 'do_while_end': {
        if (depth > 0) depth--
        out.push(`${pad()}    if not (${applyOpMap(extractCondition(line), OP_TO_PYTHON)}): break`)
        break
      }

      case 'return_stmt': {
        const val = applyOpMap(stripSemi(line.replace(/^return\s*/, '')), OP_TO_PYTHON)
        out.push(`${pad()}return${val ? ' ' + val : ''}`)
        break
      }

      case 'raw': {
        let cleaned = stripSemi(line)
        cleaned = convertCollectionMethodsPython(cleaned)
        cleaned = convertStringFormatPython(cleaned)
        cleaned = convertNewInstance(cleaned)
        cleaned = applyOpMap(cleaned, OP_TO_PYTHON)
        cleaned = cleaned.replace(/^(public|private|protected|static|final)\s+/g, '')
        if (cleaned.trim()) out.push(`${pad()}${cleaned}`)
        break
      }
    }
  }

  return out.join('\n')
}

// ─── Java → C++ ───────────────────────────────────────────────────────────────

export function translateToCpp(javaCode) {
  const lines = javaCode.split('\n')

  const includes = new Set(['#include <iostream>', '#include <string>'])
  if (/ArrayList|List</.test(javaCode)) includes.add('#include <vector>')
  if (/HashMap|Map</.test(javaCode)) includes.add('#include <unordered_map>')
  if (/Math\./.test(javaCode)) includes.add('#include <cmath>')
  if (/String\.format/.test(javaCode)) includes.add('#include <cstdio>')

  const hasMain = /public\s+static\s+void\s+main/.test(javaCode)

  const out = []
  for (const inc of includes) out.push(inc)
  out.push('using namespace std;')
  out.push('')

  let depth = 0
  let inClass = false
  let inSwitch = false

  for (const raw of lines) {
    const origIndent = raw.match(/^(\s*)/)[1]
    const { type, line, ...rest } = classifyLine(raw)

    switch (type) {
      case 'blank': out.push(''); break
      case 'open_brace': out.push(origIndent + '{'); depth++; break
      case 'close_brace': {
        if (depth > 0) depth--
        out.push(origIndent + '}')
        break
      }
      case 'skip': break
      case 'annotation': break // @Override stripped; C++ uses `override` keyword inline

      case 'import': break // all handled by pre-scan includes

      case 'comment': out.push(origIndent + line); break

      case 'class_decl': {
        const parent = rest.parent ? ` : public ${rest.parent}` : ''
        out.push(`${origIndent}class ${rest.name}${parent} {`)
        out.push(`${origIndent}public:`)
        inClass = true
        depth++
        break
      }

      case 'main_method': {
        out.push(`${origIndent}int main() {`)
        depth++
        break
      }

      case 'constructor': {
        out.push(`${origIndent}${rest.name}(${paramsToCpp(rest.params)}) {`)
        depth++
        break
      }

      case 'method_decl': {
        const ret = TYPE_TO_CPP[rest.returnType] || rest.returnType
        const params = paramsToCpp(rest.params)
        const hasBrace = line.trim().endsWith('{')
        out.push(`${origIndent}${ret} ${rest.name}(${params})${hasBrace ? ' {' : ';'}`)
        if (hasBrace) depth++
        break
      }

      case 'field_decl': {
        const coll = convertCollectionType(rest.ftype)
        if (coll) {
          out.push(`${origIndent}${coll.cpp} ${rest.fname};`)
        } else {
          const cppType = TYPE_TO_CPP[rest.ftype] || rest.ftype
          if (rest.fval) {
            const newColl = convertNewCollection(rest.fval)
            const val = newColl ? '' : ` = ${applyOpMap(rest.fval.replace(/\bnew\s+([A-Z]\w+)\s*\(/g, '$1('), OP_TO_CPP)}`
            out.push(`${origIndent}${cppType} ${rest.fname}${val};`)
          } else {
            out.push(`${origIndent}${cppType} ${rest.fname};`)
          }
        }
        break
      }

      case 'this_assign': {
        const val = applyOpMap(convertCollectionMethodsCpp(stripSemi(rest.value)), OP_TO_CPP)
        out.push(`${origIndent}this->${rest.field} = ${val};`)
        break
      }

      case 'var_decl': {
        const coll = convertCollectionType(rest.vtype)
        const newColl = convertNewCollection(rest.vval)
        if (coll) {
          out.push(`${origIndent}${coll.cpp} ${rest.vname};`)
        } else {
          const cppType = TYPE_TO_CPP[rest.vtype] || rest.vtype
          let val = stripSemi(rest.vval)
          val = convertCollectionMethodsCpp(val)
          val = val.replace(/\bnew\s+([A-Z]\w+)\s*\(/g, '$1(')
          val = applyOpMap(val, OP_TO_CPP)
          out.push(`${origIndent}${cppType} ${rest.vname} = ${val};`)
        }
        break
      }

      case 'var_decl_only': {
        const cppType = TYPE_TO_CPP[rest.vtype] || rest.vtype
        out.push(`${origIndent}${cppType} ${rest.vname};`)
        break
      }

      case 'scanner_init': {
        out.push(`${origIndent}// cin used directly for input (no Scanner in C++)`)
        break
      }

      case 'scanner_input': {
        const vm = line.match(/(\w+)\s*=\s*scanner\.(next\w*)\(\)/)
        if (vm) out.push(`${origIndent}cin >> ${vm[1]};`)
        break
      }

      case 'print_ln': {
        const arg = applyOpMap(extractPrintArg(line), OP_TO_CPP)
        out.push(`${origIndent}cout << ${arg} << endl;`)
        break
      }

      case 'print': {
        const arg = applyOpMap(extractPrintArg(line), OP_TO_CPP)
        out.push(`${origIndent}cout << ${arg};`)
        break
      }

      case 'switch_stmt': {
        out.push(`${origIndent}switch (${extractCondition(line)}) {`)
        depth++
        inSwitch = true
        break
      }

      case 'case_arrow': {
        const body = applyOpMap(convertCollectionMethodsCpp(rest.body), OP_TO_CPP)
        out.push(`${origIndent}case ${rest.val}: {`)
        out.push(`${origIndent}    ${body};`)
        out.push(`${origIndent}    break;`)
        out.push(`${origIndent}}`)
        break
      }

      case 'case_colon': out.push(`${origIndent}case ${rest.val}:`); break
      case 'case_default': out.push(`${origIndent}default:`); break
      case 'break_stmt': out.push(`${origIndent}break;`); break

      case 'if_stmt': {
        const cond = applyOpMap(extractCondition(line), OP_TO_CPP)
        const hasBrace = line.trim().endsWith('{')
        out.push(`${origIndent}if (${cond})${hasBrace ? ' {' : ''}`)
        if (hasBrace) depth++
        break
      }

      case 'elif_stmt': {
        if (depth > 0) depth--
        const cond = applyOpMap(extractCondition(line), OP_TO_CPP)
        out.push(`${origIndent}} else if (${cond}) {`)
        depth++
        break
      }

      case 'else_stmt': {
        if (depth > 0) depth--
        out.push(`${origIndent}} else {`)
        depth++
        break
      }

      case 'foreach': {
        out.push(`${origIndent}for (auto& ${rest.varName} : ${rest.collection}) {`)
        depth++
        break
      }

      case 'for_loop': {
        const { varName, start, op, end, step } = rest
        const s = step.includes(varName) ? step : `${varName}++`
        out.push(`${origIndent}for (int ${varName} = ${start}; ${varName} ${op} ${end}; ${s}) {`)
        depth++
        break
      }

      case 'while_loop': {
        const cond = applyOpMap(extractCondition(line), OP_TO_CPP)
        out.push(`${origIndent}while (${cond}) {`)
        depth++
        break
      }

      case 'do_while_start': out.push(`${origIndent}do {`); depth++; break

      case 'do_while_end': {
        if (depth > 0) depth--
        out.push(`${origIndent}} while (${applyOpMap(extractCondition(line), OP_TO_CPP)});`)
        break
      }

      case 'return_stmt': {
        const val = applyOpMap(stripSemi(line.replace(/^return\s*/, '')), OP_TO_CPP)
        out.push(`${origIndent}return${val ? ' ' + val : ''};`)
        break
      }

      case 'raw': {
        let cleaned = line
        cleaned = convertCollectionMethodsCpp(cleaned)
        cleaned = cleaned.replace(/\bnew\s+([A-Z]\w+)\s*\(/g, '$1(')
        cleaned = applyOpMap(cleaned, OP_TO_CPP)
        cleaned = stripAccessModifiersKeepStatic(cleaned)
        if (!cleaned.trim()) break
        const t = cleaned.trim()
        if (!t.endsWith(';') && !t.endsWith('{') && !t.endsWith('}') && !t.startsWith('#') && !t.startsWith('//')) {
          cleaned += ';'
        }
        out.push(origIndent + cleaned)
        break
      }
    }
  }

  if (hasMain) {
    const lastBrace = out.lastIndexOf('}')
    if (lastBrace !== -1 && !out.slice(Math.max(0, lastBrace - 3), lastBrace).join('').includes('return 0')) {
      out.splice(lastBrace, 0, '    return 0;')
    }
  }

  return out.join('\n')
}

// ─── Entry ────────────────────────────────────────────────────────────────────

export function translate(code, fromLang, toLang) {
  if (!code.trim()) return ''
  if (fromLang === 'java' && toLang === 'python') return translateToPython(code)
  if (fromLang === 'java' && toLang === 'cpp') return translateToCpp(code)
  return `// Translation from ${fromLang} to ${toLang} — coming in next phase`
}