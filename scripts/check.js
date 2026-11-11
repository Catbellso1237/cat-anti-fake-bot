'use strict';
// npm run check: kiểm tra cú pháp mọi file .js, và nạp thử command/event nếu đã cài discord.js.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'data'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.js')) files.push(p);
  }
})(root);

let failed = 0;
for (const f of files) {
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
  } catch (err) {
    failed++;
    console.error(`LỖI CÚ PHÁP ${path.relative(root, f)}:\n${err.stderr}`);
  }
}
console.log(`Cú pháp: ${files.length - failed}/${files.length} file đạt`);

let hasLib = true;
try {
  require.resolve('discord.js', { paths: [root] });
} catch {
  hasLib = false;
  console.log('Chưa cài discord.js: bỏ qua bước nạp thử module (chạy npm install rồi chạy lại).');
}
if (hasLib) {
  for (const f of files.filter((p) => /src[\\/](commands|events)[\\/]/.test(p))) {
    try {
      const m = require(f);
      const isCmd = /commands/.test(f);
      if (isCmd && !(m.data && m.execute)) throw new Error('thiếu data hoặc execute');
      if (!isCmd && !(Array.isArray(m) ? m : [m]).every((e) => e.name && e.execute)) throw new Error('thiếu name hoặc execute');
    } catch (err) {
      failed++;
      console.error(`LỖI NẠP ${path.relative(root, f)}: ${err.message}`);
    }
  }
}
process.exit(failed ? 1 : 0);
