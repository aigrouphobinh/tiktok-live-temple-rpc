'use strict';

const BASE_EVENT = Object.freeze({
  user: 'TEST • BẢNG ĐIỀU KHIỂN',
  uniqueId: 'control-effect-test',
  avatar: '',
  wish: 'Kiểm tra hiệu ứng hệ thống — không tính công đức',
  merit: 0,
  ttsText: '',
  ttsVoice: 'maichi',
  testOnly: true
});

const TEST_PRESETS = Object.freeze({
  incense: {
    label: 'Thắp hương',
    event: { type: 'burnIncense', count: 3 }
  },
  lantern: {
    label: 'Hoa đăng',
    event: { type: 'sendPrayer' }
  },
  woodenFish: {
    label: 'Tiếng mõ',
    event: { type: 'strikeWoodenFish', count: 5 }
  },
  bell: {
    label: 'Đại hồng chung',
    event: { type: 'ringBell', count: 1 }
  },
  fortune: {
    label: 'Xin xăm',
    event: {
      type: 'drawFortune',
      fortune: {
        number: 1,
        rank: 'Thượng Thượng Cát',
        title: 'Nhật Xuất Đông Phương',
        poem: 'Đông phương nhật xuất chiếu Càn Khôn\nHoa nở đầy cành rạng sắc xuân\nCông danh tài lộc đều viên mãn\nGia đạo bình an phúc lộc tồn.',
        meaning: 'Quẻ test: mọi việc hanh thông, gia đạo bình an.'
      }
    }
  },
  lotusGift: {
    label: 'Dâng hoa sen',
    event: {
      type: 'offerGift',
      giftType: 'lotus',
      giftName: 'Hoa Sen Vàng',
      coins: 15,
      diamondCount: 15
    }
  },
  rocket: {
    label: 'Tên lửa',
    gift: {
      type: 'offerGift',
      giftType: 'lamp',
      giftName: 'Rocket',
      coins: 20,
      diamondCount: 20
    }
  },
  dragon: {
    label: 'Rồng',
    gift: {
      type: 'offerGift',
      giftType: 'dragon',
      giftName: 'Dragon',
      coins: 500,
      diamondCount: 500
    }
  },
  donut: {
    label: 'Donut',
    gift: {
      type: 'offerGift',
      giftType: 'fruit',
      giftName: 'Donut',
      coins: 30,
      diamondCount: 30
    }
  },
  rose: {
    label: 'Hoa hồng',
    gift: {
      type: 'offerGift',
      giftType: 'lotus',
      giftName: 'Rose',
      coins: 1,
      diamondCount: 1
    }
  },
  grand: {
    label: 'Đại lễ / hào quang',
    gift: {
      type: 'grandCeremony',
      giftType: 'dragon',
      giftName: 'Đại Lễ Kim Long (Dragon)',
      coins: 1000,
      diamondCount: 1000
    }
  }
});

function buildEffectTestPayload(effect, options = {}) {
  if (typeof effect !== 'string' || !Object.prototype.hasOwnProperty.call(TEST_PRESETS, effect)) {
    throw new Error('Hiệu ứng test không hợp lệ: ' + String(effect || ''));
  }

  const preset = TEST_PRESETS[effect];
  const withTarget = Boolean(options.withTarget);
  const events = [];

  if (preset.gift && withTarget) {
    events.push({
      ...BASE_EVENT,
      type: 'burnIncense',
      count: 1,
      testSeed: true,
      wish: 'Thí chủ thử nghiệm bước vào Chánh Điện'
    });
  }

  events.push({
    ...BASE_EVENT,
    ...(preset.event || preset.gift)
  });

  return {
    effect,
    label: preset.label,
    withTarget: Boolean(preset.gift && withTarget),
    events
  };
}

module.exports = {
  TEST_PRESETS,
  buildEffectTestPayload
};
