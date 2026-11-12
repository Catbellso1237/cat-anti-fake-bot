'use strict';
const { Events, MessageFlags } = require('discord.js');
const { getConfig } = require('../config');
const { onCooldown } = require('../utils/cooldown');
const { isRaidActive } = require('../protection/raid');
const { handle: handlePanel, isPanelId } = require('../panel/controlPanel');

const EPHEMERAL = MessageFlags.Ephemeral;

async function safeReply(interaction, payload) {
  const msg = { ...payload, flags: EPHEMERAL };
  if (interaction.replied || interaction.deferred) return interaction.followUp(msg).catch(() => {});
  return interaction.reply(msg).catch(() => {});
}

// Nút xác minh dùng customId cố định nên vẫn hoạt động sau khi bot khởi động lại.
async function handleVerify(interaction) {
  if (!interaction.inGuild()) return;
  const cfg = getConfig(interaction.guildId);
  if (!cfg.verifiedRoleId) return safeReply(interaction, { content: 'Server chưa cấu hình role xác minh.' });
  if (isRaidActive(interaction.guildId)) {
    return safeReply(interaction, { content: 'Server đang bị raid, xác minh tạm dừng. Thử lại sau ít phút.' });
  }
  const role = interaction.guild.roles.cache.get(cfg.verifiedRoleId);
  if (!role) return safeReply(interaction, { content: 'Role xác minh không còn tồn tại, hãy báo admin.' });
  if (interaction.member.roles.cache.has(role.id)) return safeReply(interaction, { content: 'Bạn đã được xác minh.' });
  const ok = await interaction.member.roles.add(role, 'Xác minh bằng nút').then(() => true, () => false);
  return safeReply(interaction, { content: ok ? 'Đã xác minh.' : 'Không cấp được role, hãy báo admin (kiểm tra thứ tự role của bot).' });
}

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    try {
      if (interaction.isButton() && interaction.customId === 'verify') return await handleVerify(interaction);
      // Bảng điều khiển: nút và select menu có tiền tố "panel:"
      if ((interaction.isButton() || interaction.isStringSelectMenu()) && isPanelId(interaction.customId)) {
        return await handlePanel(interaction);
      }
      if (!interaction.isChatInputCommand()) return;

      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) return;
      if (!interaction.inGuild()) return safeReply(interaction, { content: 'Lệnh này chỉ dùng trong server.' });

      const wait = onCooldown(interaction.user.id, interaction.commandName, (command.cooldownSeconds ?? 3) * 1000);
      if (wait) return safeReply(interaction, { content: `Chờ ${wait}s nữa rồi thử lại.` });

      await command.execute(interaction);
    } catch (err) {
      console.error(`Lỗi lệnh ${interaction.commandName ?? interaction.customId}:`, err);
      await safeReply(interaction, { content: 'Có lỗi khi xử lý, đã ghi log.' });
    }
  },
};
