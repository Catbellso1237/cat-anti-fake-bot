'use strict';
const cooldowns = new Map();

// Trả về số giây còn phải chờ, 0 nếu được phép chạy.
function onCooldown(userId, cmd, ms) {
  const key = `${cmd}:${userId}`;
  const now = Date.now();
  const until = cooldowns.get(key) ?? 0;
  if (now < until) return Math.ceil((until - now) / 1000);
  cooldowns.set(key, now + ms);
  setTimeout(() => cooldowns.delete(key), ms).unref();
  return 0;
}

module.exports = { onCooldown };
