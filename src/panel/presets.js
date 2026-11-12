'use strict';
// Mức nhạy phát hiện raid dùng cho select menu trong bảng điều khiển (logic thuần, có test).
const PRESETS = {
  low: { label: 'Thấp', maxJoins: 12, windowMs: 10_000 },
  mid: { label: 'Vừa', maxJoins: 8, windowMs: 10_000 },
  high: { label: 'Cao', maxJoins: 5, windowMs: 10_000 },
  max: { label: 'Rất cao', maxJoins: 3, windowMs: 8_000 },
};

const describe = (p) => `${p.maxJoins} người vào trong ${p.windowMs / 1000} giây`;

// Trả về khóa preset đang khớp với cấu hình, hoặc null nếu đã chỉnh tay.
function presetOf(raid) {
  return Object.keys(PRESETS).find((k) => PRESETS[k].maxJoins === raid.maxJoins && PRESETS[k].windowMs === raid.windowMs) ?? null;
}

module.exports = { PRESETS, presetOf, describe };
