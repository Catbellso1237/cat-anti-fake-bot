'use strict';
// Logic thuần (không phụ thuộc discord.js) để kiểm tra thứ bậc role và quyền của bot.
// Dữ liệu đầu vào do hierarchy.js lấy từ guild, nên hàm này test được mà không cần token.

// Quyền nguy hiểm: ai giữ role có quyền này đều có thể phá hoặc chiếm server.
const DANGEROUS = [
  'Administrator',
  'ManageGuild',
  'ManageRoles',
  'ManageChannels',
  'ManageWebhooks',
  'BanMembers',
  'KickMembers',
];

// Quyền bot cần để các tính năng hoạt động: [tên quyền, dùng để làm gì]
const REQUIRED = [
  ['ManageChannels', 'khóa/mở kênh, /setup, reset kênh'],
  ['ManageRoles', 'cấp role xác minh, gỡ role khi anti-nuke'],
  ['ManageGuild', 'tăng mức xác minh khi raid'],
  ['ModerateMembers', 'timeout thành viên'],
  ['KickMembers', 'kick bot lạ'],
  ['ViewAuditLog', 'biết ai thêm bot, ai xóa kênh/role'],
  ['ManageMessages', 'xóa tin của raider, /purge'],
  ['SendMessages', 'gửi mod-log'],
  ['EmbedLinks', 'gửi embed'],
];

/**
 * @param {object} i
 * @param {number} i.botTopPosition  vị trí role cao nhất của bot (0 = chưa có role riêng)
 * @param {string[]} i.botHas        tên các quyền cần thiết mà bot đang có
 * @param {{id,name,position,managed,everyone,dangerous:string[],memberCount:number}[]} i.roles
 * @param {{name:string,position:number}|null} i.verifiedRole
 * @param {boolean} i.verifiedRoleMissing  đã cấu hình nhưng role không còn
 * @param {'ok'|'unset'|'missing'|'noaccess'} i.logChannel
 * @param {'ok'|'none'|'invalid'} i.webhook
 * @param {'log'|'act'} i.mode
 */
function analyze(i) {
  const issues = [];
  const add = (level, text) => issues.push({ level, text });

  if (i.botTopPosition === 0) {
    add('error', 'Bot chưa có role riêng nên nằm dưới mọi role. Kéo role của bot lên trên cùng.');
  }

  for (const [perm, why] of REQUIRED) {
    if (!i.botHas.includes(perm)) add('error', `Bot thiếu quyền **${perm}** (${why}).`);
  }

  const everyone = i.roles.find((r) => r.everyone);
  if (everyone?.dangerous.length) {
    add('error', `@everyone đang có quyền nguy hiểm: ${everyone.dangerous.join(', ')}. Gỡ ngay.`);
  }

  const above = i.roles.filter((r) => !r.everyone && r.position > i.botTopPosition);
  const botIsTop = above.length === 0;
  if (!botIsTop) {
    add('warn', `Role của bot chưa ở trên cùng: có ${above.length} role nằm trên. Bot không thể timeout, kick hay gỡ role người giữ các role đó.`);
  }
  for (const r of above) {
    if (!r.dangerous.length) continue;
    const perms = r.dangerous.join(', ');
    if (r.managed) {
      add('warn', `Ứng dụng/bot khác (role **${r.name}**) nằm trên bot và có quyền ${perms}.`);
    } else {
      const who = r.memberCount ? ` (${r.memberCount} thành viên)` : '';
      add('error', `Role **${r.name}** nằm trên bot và có quyền ${perms}${who}: bot không xử lý được người giữ role này.`);
    }
  }

  if (i.verifiedRoleMissing) {
    add('warn', 'Role xác minh đã cấu hình nhưng không còn tồn tại. Chạy /setup để tạo lại.');
  } else if (i.verifiedRole && i.verifiedRole.position >= i.botTopPosition) {
    add('error', `Role xác minh **${i.verifiedRole.name}** nằm ngang hoặc trên bot: nút xác minh sẽ không cấp được role.`);
  }

  if (i.logChannel === 'unset') add('warn', 'Chưa đặt kênh mod-log (dùng /setup hoặc /security logchannel).');
  if (i.logChannel === 'missing') add('error', 'Kênh mod-log đã cấu hình nhưng không còn tồn tại.');
  if (i.logChannel === 'noaccess') add('error', 'Bot không xem/gửi/nhúng embed được trong kênh mod-log.');

  if (i.webhook === 'none') add('info', 'Chưa có webhook cảnh báo raid (dùng /security webhook).');
  if (i.webhook === 'invalid') add('warn', 'URL webhook không hợp lệ.');

  if (i.mode === 'log') add('info', 'Đang ở chế độ log: bot chỉ ghi log, chưa xử lý thật.');

  return {
    ok: !issues.some((x) => x.level === 'error'),
    botIsTop,
    aboveCount: above.length,
    issues,
  };
}

module.exports = { DANGEROUS, REQUIRED, analyze };
