/**
 * panel_battle_enemies.js
 * パネルバトルで使用する敵テンプレート定義。
 */

const PANEL_BATTLE_ENEMIES = [
    {
        id: 'slime', name: 'スライム', emoji: '🟢',
        hp: 80, atk: 12, resistPhys: 0.0, resistMagic: 0.0, actionInterval: 2,
        pattern: [
            { turn: 'every', action: 'attack', power: 1.0, label: '体当たり' },
            { turn: 4, action: 'guard_phys', label: 'ぬるぬる装甲' }
        ],
        expBase: 20, goldBase: 40
    },
    {
        id: 'goblin', name: 'ゴブリン', emoji: '👺',
        hp: 120, atk: 18, resistPhys: 0.0, resistMagic: 0.3, actionInterval: 1,
        pattern: [
            { turn: 'every', action: 'attack', power: 0.85, label: '斬りつけ' },
            { turn: 3, action: 'heavy', power: 1.8, label: '渾身の一撃' },
            { turn: 5, action: 'guard_magic', label: '呪詛の護り' }
        ],
        expBase: 35, goldBase: 60
    },
    {
        id: 'skeleton', name: 'スケルトン', emoji: '💀',
        hp: 100, atk: 22, resistPhys: 0.5, resistMagic: -0.3, actionInterval: 2,
        pattern: [
            { turn: 'every', action: 'attack', power: 1.0, label: '骨撃ち' },
            { turn: 3, action: 'guard_phys', label: '骨盾展開' },
            { turn: 4, action: 'heavy', power: 1.9, label: '骨旋風' }
        ],
        expBase: 40, goldBase: 70
    },
    {
        id: 'mage', name: 'ダークメイジ', emoji: '🧙',
        hp: 90, atk: 25, resistPhys: -0.3, resistMagic: 0.5, actionInterval: 1,
        pattern: [
            { turn: 'every', action: 'attack', power: 0.75, label: '闇の弾' },
            { turn: 2, action: 'drain', power: 0.9, healRate: 0.8, label: '吸血呪文' },
            { turn: 4, action: 'guard_magic', label: '魔障壁' }
        ],
        expBase: 45, goldBase: 80
    },
    {
        id: 'golem', name: 'ゴーレム', emoji: '🗿',
        hp: 200, atk: 15, resistPhys: 0.4, resistMagic: 0.0, actionInterval: 2,
        pattern: [
            { turn: 'every', action: 'attack', power: 1.0, label: '岩拳' },
            { turn: 2, action: 'guard_phys', label: '岩肌硬化' },
            { turn: 5, action: 'heavy', power: 2.4, label: '大地震' }
        ],
        expBase: 50, goldBase: 90
    },
    {
        id: 'dragon_baby', name: 'ドラゴンパピー', emoji: '🐉',
        hp: 150, atk: 20, resistPhys: 0.2, resistMagic: 0.2, actionInterval: 1,
        pattern: [
            { turn: 'every', action: 'attack', power: 0.9, label: '噛みつき' },
            { turn: 3, action: 'drain', power: 1.0, healRate: 0.5, label: '吸血噛み' },
            { turn: 4, action: 'guard_magic', label: '鱗の結界' },
            { turn: 6, action: 'heavy', power: 2.3, label: 'ブレス' }
        ],
        expBase: 55, goldBase: 100
    }
];
