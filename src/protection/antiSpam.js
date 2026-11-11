'use strict';
const buckets = new Map(); // `${guildId}:${userId}` -> { times, last, dupes }

// Cửa sổ trượt: quá nhiều tin trong windowMs, hoặc lặp cùng nội dung.
function checkSpam(key, content, { max, windowMs, maxDupes }) {
  const now = Date.now();
  const b = buckets.get(key) ?? { times: [], last: '', dupes: 0 };
  b.times = b.times.filter((t) => now - t < windowMs);
  b.times.push(now);
  b.dupes = content && content === b.last ? b.dupes + 1 : 0;
  b.last = content;
  buckets.set(key, b);
  return b.times.length > max || b.dupes >= maxDupes;
}

const INVITE_RE = /discord\.gg\/|discord(?:app)?\.com\/invite\//i;

// Dọn bộ nhớ để Map không phình mãi
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) {
    if (!b.times.length || now - b.times[b.times.length - 1] > 60_000) buckets.delete(k);
  }
}, 60_000).unref();

module.exports = { checkSpam, INVITE_RE };
