'use strict';
// Lưu cấu hình theo từng server vào data/config.json (ghi nguyên tử, không cần DB ngoài).
const fs = require('node:fs');
const path = require('node:path');

const FILE = path.join(__dirname, '..', 'data', 'config.json');

const DEFAULTS = Object.freeze({
  mode: 'log', // 'log' = chỉ ghi log, 'act' = hành động thật
  logChannelId: null,
  webhookUrl: null,
  verifiedRoleId: null,
  minAccountAgeMs: 3 * 24 * 3_600_000,
  quarantineMs: 60 * 60_000, // timeout cho tài khoản đáng ngờ
  raid: {
    maxJoins: 8,
    windowMs: 10_000,
    autoLockdown: true, // tự khóa kênh khi raid
    lockdownMs: 10 * 60_000, // tự mở khóa sau khoảng này
    purgeRaiders: true, // tự xóa tin nhắn của người vào trong lúc raid
    raiseVerification: true,
  },
  spam: { max: 6, windowMs: 5_000, maxDupes: 3, timeoutMs: 10 * 60_000 },
  nuke: { maxActions: 3, windowMs: 10_000 },
  escalation: { enabled: true, revert: true }, // chống cấp quyền/role nguy hiểm trái phép
  trustedUserIds: [],
  trustedBotIds: [],
  exemptRoleIds: [],
  lockdown: null, // { until, snapshot: {channelId: true|false|null}, prevVerification }
});

let store = {};
let loaded = false;
const initialized = new Set(); // server đã được gộp với mặc định

function load() {
  if (loaded) return;
  loaded = true;
  try {
    store = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('Không đọc được config.json, dùng mặc định:', err.message);
    store = {};
  }
}

function merge(base, over) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(over ?? {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
      out[k] = merge(base[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function getConfig(guildId) {
  load();
  // lần đầu tạo đầy đủ mặc định; các lần sau bổ sung khóa mới nếu bản cập nhật thêm cấu hình
  // Chỉ gộp một lần: các nơi gọi phải nhận cùng một object, nếu không thay đổi có thể bị mất khi lưu.
  if (!initialized.has(guildId)) {
    store[guildId] = merge(structuredClone(DEFAULTS), store[guildId]);
    initialized.add(guildId);
  }
  return store[guildId];
}

let writing = Promise.resolve();
function saveConfig() {
  // xếp hàng ghi để hai lần lưu liên tiếp không đè nhau
  writing = writing
    .then(async () => {
      await fs.promises.mkdir(path.dirname(FILE), { recursive: true });
      const tmp = `${FILE}.tmp`;
      await fs.promises.writeFile(tmp, JSON.stringify(store, null, 2));
      await fs.promises.rename(tmp, FILE);
    })
    .catch((err) => console.error('Lỗi lưu config:', err));
  return writing;
}

function allGuildIds() {
  load();
  return Object.keys(store);
}

module.exports = { getConfig, saveConfig, allGuildIds, DEFAULTS };
