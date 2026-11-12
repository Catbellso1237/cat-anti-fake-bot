'use strict';
// Test các hàm thuần, không cần discord.js hay token.
const test = require('node:test');
const assert = require('node:assert/strict');
const { isValidWebhookUrl, maskWebhook } = require('../src/utils/webhook');
const { checkSpam, INVITE_RE } = require('../src/protection/antiSpam');
const { getConfig, DEFAULTS } = require('../src/config');

test('webhook: chỉ nhận URL webhook của Discord', () => {
  assert.equal(isValidWebhookUrl('https://discord.com/api/webhooks/123456/abc-DEF_9'), true);
  assert.equal(isValidWebhookUrl('https://evil.example.com/api/webhooks/123/abc'), false);
  assert.equal(isValidWebhookUrl('http://discord.com/api/webhooks/123/abc'), false);
  assert.equal(isValidWebhookUrl('https://discord.com.evil.io/api/webhooks/1/a'), false);
  assert.equal(isValidWebhookUrl(null), false);
});

test('webhook: che token khi hiển thị', () => {
  const masked = maskWebhook('https://discord.com/api/webhooks/123456/secretToken');
  assert.ok(!masked.includes('secretToken'));
});

test('antiSpam: vượt số tin trong cửa sổ thì bị đánh dấu', () => {
  const opts = { max: 3, windowMs: 5000, maxDupes: 10 };
  const key = 'g:u1';
  assert.equal(checkSpam(key, 'a', opts), false);
  assert.equal(checkSpam(key, 'b', opts), false);
  assert.equal(checkSpam(key, 'c', opts), false);
  assert.equal(checkSpam(key, 'd', opts), true);
});

test('antiSpam: lặp cùng nội dung bị đánh dấu', () => {
  const opts = { max: 100, windowMs: 5000, maxDupes: 3 };
  const key = 'g:u2';
  checkSpam(key, 'x', opts);
  checkSpam(key, 'x', opts);
  checkSpam(key, 'x', opts);
  assert.equal(checkSpam(key, 'x', opts), true);
});

test('antiSpam: nhận diện link mời', () => {
  assert.ok(INVITE_RE.test('vào đây discord.gg/abc'));
  assert.ok(!INVITE_RE.test('hello world'));
});

test('config: mặc định an toàn (chế độ log) và không dùng chung object giữa các server', () => {
  const a = getConfig('test-guild-a');
  const b = getConfig('test-guild-b');
  assert.equal(a.mode, 'log');
  a.raid.maxJoins = 99;
  assert.equal(b.raid.maxJoins, DEFAULTS.raid.maxJoins);
  a.trustedUserIds.push('1');
  assert.equal(b.trustedUserIds.length, 0);
});

test('config: getConfig luôn trả về cùng một object cho một server', () => {
  const a = getConfig('same-ref-guild');
  a.mode = 'act';
  assert.equal(getConfig('same-ref-guild'), a);
  assert.equal(getConfig('same-ref-guild').mode, 'act');
});

// ---- hierarchyCheck (kiểm tra thứ bậc role kiểu Wick) ----
const { analyze, DANGEROUS, REQUIRED } = require('../src/protection/hierarchyCheck');

const ALL_PERMS = REQUIRED.map(([p]) => p);
const role = (o) => ({ id: o.name, managed: false, everyone: false, dangerous: [], memberCount: 0, ...o });
const base = (over = {}) => ({
  botTopPosition: 10,
  botHas: ALL_PERMS,
  roles: [role({ name: '@everyone', position: 0, everyone: true }), role({ name: 'Bot', position: 10, managed: true })],
  verifiedRole: null,
  verifiedRoleMissing: false,
  logChannel: 'ok',
  webhook: 'ok',
  mode: 'act',
  ...over,
});

test('hierarchy: bot ở trên cùng và đủ quyền thì không có lỗi', () => {
  const r = analyze(base());
  assert.equal(r.ok, true);
  assert.equal(r.botIsTop, true);
  assert.deepEqual(r.issues, []);
});

test('hierarchy: role có quyền Administrator nằm trên bot là lỗi nghiêm trọng', () => {
  const r = analyze(base({ roles: [...base().roles, role({ name: 'Mod', position: 12, dangerous: ['Administrator'], memberCount: 3 })] }));
  assert.equal(r.ok, false);
  assert.equal(r.botIsTop, false);
  assert.ok(r.issues.some((x) => x.level === 'error' && x.text.includes('Mod') && x.text.includes('3 thành viên')));
});

test('hierarchy: role thường nằm trên bot chỉ là cảnh báo', () => {
  const r = analyze(base({ roles: [...base().roles, role({ name: 'VIP', position: 12 })] }));
  assert.equal(r.ok, true);
  assert.equal(r.botIsTop, false);
  assert.ok(r.issues.some((x) => x.level === 'warn'));
});

test('hierarchy: bot khác có quyền cao hơn chỉ là cảnh báo', () => {
  const r = analyze(base({ roles: [...base().roles, role({ name: 'OtherBot', position: 15, managed: true, dangerous: ['Administrator'] })] }));
  assert.equal(r.ok, true);
  assert.ok(r.issues.some((x) => x.level === 'warn' && x.text.includes('OtherBot')));
});

test('hierarchy: thiếu quyền cần thiết và @everyone có quyền nguy hiểm', () => {
  const r = analyze(base({
    botHas: ALL_PERMS.filter((p) => p !== 'ModerateMembers'),
    roles: [role({ name: '@everyone', position: 0, everyone: true, dangerous: ['ManageRoles'] }), role({ name: 'Bot', position: 10, managed: true })],
  }));
  assert.equal(r.ok, false);
  assert.ok(r.issues.some((x) => x.text.includes('ModerateMembers')));
  assert.ok(r.issues.some((x) => x.text.includes('@everyone')));
});

test('hierarchy: bot chưa có role riêng, role xác minh cao hơn bot, kênh log lỗi', () => {
  const r = analyze(base({ botTopPosition: 0, verifiedRole: { name: 'Verified', position: 3 }, logChannel: 'noaccess' }));
  assert.equal(r.ok, false);
  const text = r.issues.map((x) => x.text).join('\n');
  assert.ok(text.includes('chưa có role riêng'));
  assert.ok(text.includes('Verified'));
  assert.ok(text.includes('mod-log'));
});

test('hierarchy: danh sách quyền nguy hiểm gồm Administrator và ManageRoles', () => {
  assert.ok(DANGEROUS.includes('Administrator'));
  assert.ok(DANGEROUS.includes('ManageRoles'));
});

// ---- panel presets ----
const { PRESETS, presetOf } = require('../src/panel/presets');

test('panel: nhận diện đúng mức nhạy từ cấu hình raid', () => {
  assert.equal(presetOf({ maxJoins: 8, windowMs: 10_000 }), 'mid');
  assert.equal(presetOf({ maxJoins: 3, windowMs: 8_000 }), 'max');
  assert.equal(presetOf({ maxJoins: 7, windowMs: 10_000 }), null); // chỉnh tay
});

test('panel: mặc định của config khớp mức Vừa, và mức càng cao càng nhạy', () => {
  assert.equal(presetOf(DEFAULTS.raid), 'mid');
  const { low, mid, high, max } = PRESETS;
  assert.ok(low.maxJoins > mid.maxJoins && mid.maxJoins > high.maxJoins && high.maxJoins > max.maxJoins);
});

test('panel: giới hạn của Discord cho select menu (nhãn/mô tả tối đa 100 ký tự)', () => {
  for (const p of Object.values(PRESETS)) assert.ok(p.label.length <= 100);
});
