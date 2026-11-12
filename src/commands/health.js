'use strict';
const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { checkGuild, healthEmbed } = require('../protection/hierarchy');

const data = new SlashCommandBuilder()
  .setName('health')
  .setDescription('Kiểm tra quyền, thứ bậc role của bot và các lỗi cấu hình')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

async function execute(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral }); // tải role/thành viên mất hơn 3 giây
  const r = await checkGuild(interaction.guild);
  return interaction.editReply({ embeds: [healthEmbed(r)] });
}

module.exports = { data, execute, cooldownSeconds: 15 };
