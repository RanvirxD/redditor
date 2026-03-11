import * as mod from './src/utils/translator.js'

const examples = [
  'System.out.println("ok");',
  'if (a != b) {\n  System.out.println("ok");\n}\n',
  'for (int[] b : buildings) {\n  System.out.println(b);\n}\n',
]

for (const ex of examples) {
  console.log('----- INPUT -----')
  console.log(ex)
  console.log('----- PYTHON -----')
  console.log(mod.translate(ex, 'java', 'python'))
  console.log('----- CPP -----')
  console.log(mod.translate(ex, 'java', 'cpp'))
}
