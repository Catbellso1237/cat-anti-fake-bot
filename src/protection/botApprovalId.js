'use strict';
// customId của các nút duyệt bot: botapp:<hành động>:<guildId>:<botId>
// Có guildId để nút vẫn dùng được khi yêu cầu được gửi qua tin nhắn riêng (DM) cho chủ server.
const PREFIX = 'botapp:';
const ACTIONS = ['allow', 'confirm', 'cancel', 'deny'];

const buildId = (action, guildId, botId) => `${PREFIX}${action}:${guildId}:${botId}`;

function parseId(id) {
  if (typeof id !== 'string' || !id.startsWith(PREFIX)) return null;
  const [action, guildId, botId, ...rest] = id.slice(PREFIX.length).split(':');
  if (!ACTIONS.includes(action) || !/^\d+$/.test(guildId ?? '') || !/^\d+$/.test(botId ?? '') || rest.length) return null;
  return { action, guildId, botId };
}

const isBotAppId = (id) => typeof id === 'string' && id.startsWith(PREFIX);

module.exports = { buildId, parseId, isBotAppId, ACTIONS };
