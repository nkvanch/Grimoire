// Finds every TextInput that holds a name (its label says name, or it is bound to a `name` value) and is not numeric, in app/ and
// src/. Used by src/__tests__/nameInputs.test.ts; `node scripts/name-inputs.js --fix <file>` adds {...NAME_INPUT} and its import.
const ts = require('typescript');
const fs = require('fs');
const path = require('path');

function nameInputs(text, file) {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found = [];
  const visit = n => {
    if ((ts.isJsxSelfClosingElement(n) || ts.isJsxOpeningElement(n)) && n.tagName.getText() === 'TextInput') {
      const attrs = {};
      let spreadsName = false;
      for (const a of n.attributes.properties) {
        if (ts.isJsxAttribute(a)) attrs[a.name.getText()] = a.initializer ? a.initializer.getText() : 'true';
        else if (ts.isJsxSpreadAttribute(a) && a.expression.getText() === 'NAME_INPUT') spreadsName = true;
      }
      const label = [attrs.placeholder, attrs.accessibilityLabel, attrs.testID].filter(Boolean).join(' ');
      const bound = /\bname\b|Name\b/.test((attrs.value || '') + (attrs.onChangeText || ''));
      const numeric = /numeric|number-pad|decimal/.test(attrs.keyboardType || '');
      if (((/name/i.test(label) && !/search|filter|find/i.test(label)) || bound) && !numeric) {
        found.push({ line: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1, tagEnd: n.tagName.getEnd(), spreadsName });
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return found;
}

function tsxFiles(root) {
  const out = [];
  const walk = d => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.') || e.name === '__tests__') continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else if (p.endsWith('.tsx')) out.push(p);
    }
  };
  walk(path.join(root, 'app')); walk(path.join(root, 'src'));
  return out;
}

/** The text with {...NAME_INPUT} on every name box that lacks it, and the import added once. */
function fix(text, file) {
  const todo = nameInputs(text, file).filter(x => !x.spreadsName).sort((a, b) => b.tagEnd - a.tagEnd);
  if (!todo.length) return text;
  for (const x of todo) text = text.slice(0, x.tagEnd) + ' {...NAME_INPUT}' + text.slice(x.tagEnd);
  if (!/import \{ NAME_INPUT \}/.test(text)) {
    const rel = path.relative(path.dirname(path.resolve(file)), path.resolve('src/components/nameInput')).split(path.sep).join('/');
    const spec = rel.startsWith('.') ? rel : './' + rel;
    const imports = [...text.matchAll(/^import [^;]*;/gm)];
    const last = imports[imports.length - 1];
    const nl = text.includes('\r\n') ? '\r\n' : '\n';
    text = text.slice(0, last.index + last[0].length) + `${nl}import { NAME_INPUT } from '${spec}';` + text.slice(last.index + last[0].length);
  }
  return text;
}

module.exports = { nameInputs, tsxFiles, fix };

if (require.main === module && process.argv[2] === '--fix') {
  for (const f of process.argv.slice(3)) fs.writeFileSync(f, fix(fs.readFileSync(f, 'utf8'), f));
}
