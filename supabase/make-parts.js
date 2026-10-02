// Splits schema.sql into pieces of at most 100 lines (supabase/parts/),
// for SQL editors that only accept short pastes. Run after editing schema.sql:
//   node supabase/make-parts.js
const fs = require('fs'), path = require('path');
const MAX = 100, dir = path.join(__dirname, 'parts');
const lines = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8').split('\n');

// Split only where a new statement starts at the beginning of a line.
const start = /^(create|alter|grant|revoke|insert|set)\b/;
const blocks = []; let cur = [];
for (const l of lines) {
  if (start.test(l) && cur.some(x => x.trim() && !x.startsWith('--'))) { blocks.push(cur); cur = []; }
  cur.push(l);
}
blocks.push(cur);

const parts = []; let part = [];
for (const b of blocks) {
  const body = b.filter(l => !/^--/.test(l)).join('\n').replace(/\n{3,}/g, '\n\n').trim().split('\n');
  if (part.length + body.length + 1 > MAX - 4) { parts.push(part); part = []; }
  part.push(...body, '');
}
parts.push(part);

fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir);
parts.forEach((p, i) => {
  const head = [`-- Timbro database, part ${i + 1} of ${parts.length}. Run the parts in order.`,
    'set search_path = timbro, extensions;', ''];
  const out = (i === 0 ? [head[0]] : head).concat(p).join('\n').trimEnd() + '\n';
  if (out.split('\n').length - 1 > MAX) throw new Error('part ' + (i + 1) + ' is too long');
  fs.writeFileSync(path.join(dir, `${i + 1}.sql`), out);
});
console.log(parts.length + ' parts written to supabase/parts/');
