'use strict';
const { time, TimestampStyles } = require('discord.js');

const UNITS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

// '10m' -> 600000, sai định dạng -> null
function parseDuration(text) {
  const m = /^(\d+)\s*([smhd])$/i.exec(String(text ?? '').trim());
  if (!m) return null;
  return Number(m[1]) * UNITS[m[2].toLowerCase()];
}

// Timestamp Discord tự đổi theo múi giờ người xem
const relative = (ms) => time(new Date(ms), TimestampStyles.RelativeTime);
const full = (ms) => time(new Date(ms), TimestampStyles.LongDateTime);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = { parseDuration, relative, full, sleep, UNITS };
