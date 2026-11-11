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
