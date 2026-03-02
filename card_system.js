/**
 * card_system.js - カード（装備）システム
 * ハクスラ・トレハン要素の中核
 * 
 * ■ 色(スロット): 赤=攻撃系, 黄=防御系, 青=補助系, 紫=万能系
 * ■ レベル: 1〜20 (ドロップ時に確定、後から上げられない)
 * ■ 覚醒(Awakening): 0〜5 (同色Lv15+カード合成で上昇)
 * ■ キャラ1体につき4スロット(赤・黄・青・紫 各1)
 */

// =============================================
// カード色定義
// =============================================
const CARD_COLORS = {
    RED:    { id: 'red',    name: '赤', icon: '🟥', label: 'アグレッシブ', desc: '攻撃力・火力を底上げ' },
    YELLOW: { id: 'yellow', name: '黄', icon: '🟨', label: 'ディフェンシブ', desc: '耐久力・生存力を向上' },
    BLUE:   { id: 'blue',   name: '青', icon: '🟦', label: 'テクニカル',     desc: '速度・スキル回転を操作' },
    PURPLE: { id: 'purple', name: '紫', icon: '🟪', label: 'ゴッド',         desc: '全能力を押し上げる' }
};

// =============================================
// カード効果タイプ定義
// =============================================
const CARD_EFFECTS = {
    // --- 🟥 赤カード ---
    ATK_UP: {
        color: 'red', name: '猛攻', desc: 'ATKを#val#%アップ',
        calc: (lv) => ({ atkPct: 1 + lv * 2 }),   // Lv1=2%, Lv20=40%
        awakenBonus: [
            { lv:1, atkFlat: 50,  txt: 'ATK+50' },
            { lv:2, atkFlat: 100, txt: 'ATK+100' },
            { lv:3, atkFlat: 200, txt: 'ATK+200' },
            { lv:4, atkFlat: 500, txt: 'ATK+500' },
            { lv:5, atkFlat: 1000, txt: 'ATK+1000' }
        ]
    },
    CRIT_UP: {
        color: 'red', name: '会心', desc: 'クリティカル率+#val#%',
        calc: (lv) => ({ critPct: 2 + lv * 1.5 }),  // Lv1=3.5%, Lv20=32%
        awakenBonus: [
            { lv:1, atkFlat: 30,  txt: 'ATK+30' },
            { lv:2, critPct: 5,   txt: '会心率+5%' },
            { lv:3, atkFlat: 150, txt: 'ATK+150' },
            { lv:4, critPct: 10,  txt: '会心率+10%' },
            { lv:5, atkFlat: 500, txt: 'ATK+500 & 会心ダメ1.5倍' }
        ]
    },

    CRIT_DMG_UP: {
        color: 'red', name: '痛撃', desc: '会心ダメージ+#val#%',
        calc: (lv) => ({ critDmgPct: 10 + lv * 2 }), 
        awakenBonus: [{lv:3, critDmgPct: 10, txt: '会心ダメ+10%'}, {lv:5, critDmgPct: 20, txt: '会心ダメ+20%'}]
    },
    RED_LIFESTEAL: {
        color: 'red', name: '鮮血', desc: '与ダメの#val#%回復',
        calc: (lv) => ({ lifestealPct: 1 + lv * 1 }),
        awakenBonus: [{lv:3, lifestealPct: 3, txt: '吸血+3%'}, {lv:5, lifestealPct: 5, txt: '吸血+5%'}]
    },
    RED_DESPERATION: {
        color: 'red', name: '逆境', desc: 'HP50%以下でATK+#val#%',
        calc: (lv) => ({ desperationAtkPct: 10 + lv * 2 }),
        awakenBonus: [{lv:3, desperationAtkPct: 10, txt: '背水+10%'}, {lv:5, desperationAtkPct: 20, txt: '背水+20%'}]
    },
    TYPE_SLAYER: {
        color: 'red', name: '特攻', desc: '有利属性へのダメージ+#val#%',
        calc: (lv) => ({ weakSlayerPct: 10 + lv * 2 }),
        awakenBonus: [{lv:3, weakSlayerPct: 10, txt: '特攻+10%'}, {lv:5, weakSlayerPct: 20, txt: '特攻+20%'}]
    },
    EXTRA_ATTACK: {
        color: 'red', name: '追撃', desc: '#val#%の確率で追撃発生',
        calc: (lv) => ({ extraAttackProb: 5 + Math.floor(lv * 1.5) }),
        awakenBonus: [{lv:3, extraAttackProb: 5, txt: '追撃+5%'}, {lv:5, extraAttackProb: 15, txt: '追撃+15%'}]
    },
    GENDER_SLAYER: {
        color: 'red', name: '異性特攻', desc: '異性へのダメージ+#val#%',
        calc: (lv) => ({ genderSlayerPct: 10 + lv * 2 }),
        awakenBonus: [{lv:3, genderSlayerPct: 10, txt: '特攻+10%'}, {lv:5, genderSlayerPct: 20, txt: '特攻+20%'}]
    },
    GLASS_CANNON: {
        color: 'red', name: '諸刃', desc: 'ATK+#aval#% / HP#hval#%減',
        calc: (lv) => ({ atkPct: 15 + lv * 3, hpDownPct: 10 + Math.floor(lv * 0.5) }),
        awakenBonus: [{lv:3, atkPct: 10, txt: 'ATK+10%'}, {lv:5, atkPct: 30, txt: 'ATK+30%'}]
    },

    // --- 🟨 黄カード ---
    HP_UP: {
        color: 'yellow', name: '堅守', desc: '最大HPを#val#%アップ',
        calc: (lv) => ({ hpPct: 1 + lv * 2 }),     // Lv1=2%, Lv20=40%
        awakenBonus: [
            { lv:1, hpFlat: 200,  txt: 'HP+200' },
            { lv:2, hpFlat: 500,  txt: 'HP+500' },
            { lv:3, hpFlat: 1000, txt: 'HP+1000' },
            { lv:4, hpFlat: 2500, txt: 'HP+2500' },
            { lv:5, hpFlat: 5000, txt: 'HP+5000' }
        ]
    },
    STATUS_RES: {
        color: 'yellow', name: '抗体', desc: '状態異常耐性+#val#%',
        calc: (lv) => ({ statusResist: 1 + lv * 2 }),  // Lv1=2%, Lv20=40%
        awakenBonus: [
            { lv:1, hpFlat: 100,      txt: 'HP+100' },
            { lv:2, statusResist: 10,  txt: '状態異常耐性+10%' },
            { lv:3, hpFlat: 500,       txt: 'HP+500' },
            { lv:4, statusResist: 20,  txt: '状態異常耐性+20%' },
            { lv:5, hpFlat: 2000,      txt: 'HP+2000 & 耐性+30%' }
        ]
    },

    DMG_CUT: {
        color: 'yellow', name: '防壁', desc: '被ダメージ-#val#%',
        calc: (lv) => ({ dmgCutPct: 2 + Math.floor(lv * 0.5) }),
        awakenBonus: [{lv:3, dmgCutPct: 3, txt: 'ダメカ+3%'}, {lv:5, dmgCutPct: 5, txt: 'ダメカ+5%'}]
    },
    TYPE_RESIST: {
        color: 'yellow', name: '耐性', desc: '不利属性からの被ダメ-#val#%',
        calc: (lv) => ({ weakResistPct: 5 + lv * 1 }),
        awakenBonus: [{lv:3, weakResistPct: 5, txt: '属性耐性+5%'}, {lv:5, weakResistPct: 10, txt: '属性耐性+10%'}]
    },
    DODGE_UP: {
        color: 'yellow', name: '見切り', desc: '回避率+#val#%',
        calc: (lv) => ({ dodgePct: 2 + Math.floor(lv * 0.5) }),
        awakenBonus: [{lv:3, dodgePct: 3, txt: '回避+3%'}, {lv:5, dodgePct: 5, txt: '回避+5%'}]
    },
    YELLOW_SHIELD: {
        color: 'yellow', name: '初動障壁', desc: '開幕シールド HP#val#%',
        calc: (lv) => ({ shieldPct: 5 + lv * 1 }),
        awakenBonus: [{lv:3, shieldPct: 5, txt: 'シールド+5%'}, {lv:5, shieldPct: 10, txt: 'シールド+10%'}]
    },
    HEAL_BOOST: {
        color: 'yellow', name: '治癒力', desc: '受ける回復量+#val#%',
        calc: (lv) => ({ healBoostPct: 10 + lv * 2 }),
        awakenBonus: [{lv:3, healBoostPct: 10, txt: '回復量+10%'}, {lv:5, healBoostPct: 20, txt: '回復量+20%'}]
    },
    FRONT_RESIST: {
        color: 'yellow', name: '前衛防護', desc: '前衛からの被ダメ-#val#%',
        calc: (lv) => ({ frontResistPct: 5 + lv * 1 }),
        awakenBonus: [{lv:3, frontResistPct: 5, txt: '前衛ダメカ+5%'}, {lv:5, frontResistPct: 10, txt: '前衛ダメカ+10%'}]
    },
    BACK_RESIST: {
        color: 'yellow', name: '後衛防護', desc: '後衛からの被ダメ-#val#%',
        calc: (lv) => ({ backResistPct: 5 + lv * 1 }),
        awakenBonus: [{lv:3, backResistPct: 5, txt: '後衛ダメカ+5%'}, {lv:5, backResistPct: 10, txt: '後衛ダメカ+10%'}]
    },
    TANK_MODE: {
        color: 'yellow', name: '重装', desc: 'HP+#hval#% / ATK#aval#%減',
        calc: (lv) => ({ hpPct: 15 + lv * 3, atkDownPct: 10 + Math.floor(lv * 0.5) }),
        awakenBonus: [{lv:3, hpPct: 10, txt: 'HP+10%'}, {lv:5, hpPct: 30, txt: 'HP+30%'}]
    },

    // --- 🟦 青カード ---
    SPD_UP: {
        color: 'blue', name: '疾風', desc: 'SPDを+#val#アップ',
        calc: (lv) => ({ spdFlat: Math.ceil(lv * 0.5) }),  // Lv1=+1, Lv20=+10
        awakenBonus: [
            { lv:1, spdFlat: 1, txt: 'SPD+1' },
            { lv:2, spdFlat: 2, txt: 'SPD+2' },
            { lv:3, spdFlat: 3, txt: 'SPD+3' },
            { lv:4, spdFlat: 2, txt: 'SPD+2' },
            { lv:5, spdFlat: 3, txt: 'SPD+3 & 回避+10%' }
        ]
    },
    CHARGE_DOWN: {
        color: 'blue', name: '神速詠唱', desc: 'チャージ-1 & ATK+#val#%',
        // メイン: chargeMax -1 (固定)、サブ: ATK% (レベル依存)
        calc: (lv) => ({ chargeReduce: 1, atkPct: lv * 2 }),  // ATK: Lv1=2%, Lv20=40%
        awakenBonus: [
            { lv:1, atkFlat: 30,    txt: 'ATK+30' },
            { lv:2, spdFlat: 2,     txt: 'SPD+2' },
            { lv:3, atkFlat: 100,   txt: 'ATK+100' },
            { lv:4, spdFlat: 3,     txt: 'SPD+3' },
            { lv:5, chargeReduce: 1, txt: '追加チャージ-1 (合計-2)' }
        ]
    },
    INIT_CHARGE: {
        color: 'blue', name: '先手必勝', desc: '開幕チャージ+1 & SPD+#val#',
        // メイン: 開幕chargeCount +1 (固定)、サブ: SPD固定値 (レベル依存)
        calc: (lv) => ({ initCharge: 1, spdFlat: Math.ceil(lv * 0.4) }),  // SPD: Lv1=+1, Lv20=+8
        awakenBonus: [
            { lv:1, spdFlat: 1,    txt: 'SPD+1' },
            { lv:2, spdFlat: 2,    txt: 'SPD+2' },
            { lv:3, initCharge: 1, txt: '開幕チャージ+1 (合計+2)' },
            { lv:4, spdFlat: 3,    txt: 'SPD+3' },
            { lv:5, initCharge: 1, txt: '開幕チャージ+1 (合計+3)' }
        ]
    },

    STATUS_RES: { // 黄から青へ移動
        color: 'blue', name: '抗体', desc: '状態異常耐性+#val#%',
        calc: (lv) => ({ statusResist: 1 + lv * 2 }),
        awakenBonus: [{ lv:3, statusResist: 10, txt: '耐性+10%' }, { lv:5, statusResist: 20, txt: '耐性+20%' }]
    },
    SKILL_LV_UP: {
        color: 'blue', name: '技巧', desc: 'スキルLv+#val#',
        calc: (lv) => ({ skillLvBonus: Math.ceil(lv / 5) }), 
        awakenBonus: [{lv:3, skillLvBonus: 1, txt: 'スキルLv+1'}, {lv:5, skillLvBonus: 2, txt: 'スキルLv+2'}]
    },
    POWER_UP: {
        color: 'blue', name: '闘気', desc: '戦闘力(ATK&HP)アップ',
        calc: (lv) => ({ atkFlat: lv * 15, hpFlat: lv * 50 }),
        awakenBonus: [{lv:3, atkFlat: 100, hpFlat: 300, txt: 'ATK+100 HP+300'}, {lv:5, atkFlat: 300, hpFlat: 1000, txt: 'ATK+300 HP+1000'}]
    },
    HEAVY_SKILL: {
        color: 'blue', name: '大魔術', desc: 'スキルLv+大 & チャージ延長',
        calc: (lv) => ({ skillLvBonus: Math.ceil(lv / 2.5), chargePen: 2 }), // Lv20で+8
        awakenBonus: [{lv:3, skillLvBonus: 1, txt: 'スキルLv+1'}, {lv:5, skillLvBonus: 3, txt: 'スキルLv+3'}]
    },
    PROB_SKILL: {
        color: 'blue', name: '気まぐれ', desc: '#val#%でCT無視スキル発動',
        calc: (lv) => ({ probSkillActivate: 5 + lv * 1 }),
        awakenBonus: [{lv:3, probSkillActivate: 5, txt: '発動率+5%'}, {lv:5, probSkillActivate: 15, txt: '発動率+15%'}]
    },

    // --- 🟪 紫カード ---
    ALL_UP: {
        color: 'purple', name: '全能', desc: 'HP+#hval#% & ATK+#aval#%',
        calc: (lv) => ({ hpPct: lv * 1, atkPct: lv * 1 }),  // 各 Lv1=1%, Lv20=20%
        awakenBonus: [
            { lv:1, atkFlat: 100, hpFlat: 500,  txt: 'ATK+100 HP+500' },
            { lv:2, atkFlat: 150, hpFlat: 800,  txt: 'ATK+150 HP+800' },
            { lv:3, atkFlat: 250, hpFlat: 1200, txt: 'ATK+250 HP+1200' },
            { lv:4, atkFlat: 400, hpFlat: 2000, txt: 'ATK+400 HP+2000' },
            { lv:5, atkFlat: 700, hpFlat: 3500, txt: 'ATK+700 HP+3500' }
        ]
    },

    // ★融合型（各色の上位互換）
    FIERCE: {
        color: 'purple', name: '鬼神', desc: 'ATK+#aval#% & 会心+#cval#%',
        calc: (lv) => ({ atkPct: lv * 1.5, critPct: lv * 1 }),  // Lv20: ATK+30%, 会心+20%
        awakenBonus: [
            { lv:1, atkFlat: 80,  txt: 'ATK+80' },
            { lv:2, critPct: 5,   txt: '会心率+5%' },
            { lv:3, atkFlat: 300, txt: 'ATK+300' },
            { lv:4, critPct: 10,  txt: '会心率+10%' },
            { lv:5, atkFlat: 800, critPct: 15, txt: 'ATK+800 & 会心+15%' }
        ]
    },
    FORTRESS: {
        color: 'purple', name: '金剛', desc: 'HP+#hval#% & 耐性+#rval#%',
        calc: (lv) => ({ hpPct: lv * 1.5, statusResist: lv * 1 }),  // Lv20: HP+30%, 耐性+20%
        awakenBonus: [
            { lv:1, hpFlat: 300,      txt: 'HP+300' },
            { lv:2, statusResist: 8,  txt: '耐性+8%' },
            { lv:3, hpFlat: 1000,     txt: 'HP+1000' },
            { lv:4, statusResist: 15, txt: '耐性+15%' },
            { lv:5, hpFlat: 3000, statusResist: 20, txt: 'HP+3000 & 耐性+20%' }
        ]
    },
    GALE: {
        color: 'purple', name: '神風', desc: 'SPD+#val# & チャージ短縮',
        calc: (lv) => ({ spdFlat: Math.ceil(lv * 0.4), chargeReduce: lv >= 10 ? 1 : 0 }),
        // Lv1: SPD+1, Lv10: SPD+4 & CT-1, Lv20: SPD+8 & CT-1
        awakenBonus: [
            { lv:1, spdFlat: 2,       txt: 'SPD+2' },
            { lv:2, spdFlat: 2,       txt: 'SPD+2' },
            { lv:3, chargeReduce: 1,  txt: '追加CT-1' },
            { lv:4, spdFlat: 3,       txt: 'SPD+3' },
            { lv:5, initCharge: 1,    txt: '開幕CT+1' }
        ]
    },

    // ★オンリーワン型（紫限定）
    SHIELD: {
        color: 'purple', name: '結界', desc: '開幕シールド HP#val#%',
        calc: (lv) => ({ shieldPct: 5 + lv * 2 }),  // Lv1=7%, Lv20=45%
        awakenBonus: [
            { lv:1, hpFlat: 200,    txt: 'HP+200' },
            { lv:2, shieldPct: 5,   txt: 'シールド+5%' },
            { lv:3, hpFlat: 800,    txt: 'HP+800' },
            { lv:4, shieldPct: 10,  txt: 'シールド+10%' },
            { lv:5, shieldPct: 15, hpFlat: 2000, txt: 'シールド+15% & HP+2000' }
        ]
    },
    DESPERATION: {
        color: 'purple', name: '背水', desc: 'HP50%以下でATK+#val#%',
        calc: (lv) => ({ desperationAtkPct: 10 + lv * 3 }),  // Lv1=13%, Lv20=70%
        awakenBonus: [
            { lv:1, atkFlat: 50,            txt: 'ATK+50' },
            { lv:2, desperationAtkPct: 8,   txt: '背水ATK+8%' },
            { lv:3, atkFlat: 200,           txt: 'ATK+200' },
            { lv:4, desperationAtkPct: 15,  txt: '背水ATK+15%' },
            { lv:5, desperationAtkPct: 25, atkFlat: 500, txt: '背水ATK+25% & ATK+500' }
        ]
    },
    LIFESTEAL: {
        color: 'purple', name: '吸血', desc: '与ダメの#val#%をHP回復',
        calc: (lv) => ({ lifestealPct: 2 + lv * 1 }),  // Lv1=3%, Lv20=22%
        awakenBonus: [
            { lv:1, atkFlat: 50,       txt: 'ATK+50' },
            { lv:2, lifestealPct: 3,   txt: '吸血+3%' },
            { lv:3, atkFlat: 200,      txt: 'ATK+200' },
            { lv:4, lifestealPct: 5,   txt: '吸血+5%' },
            { lv:5, lifestealPct: 10, atkFlat: 500, txt: '吸血+10% & ATK+500' }
        ]
    },

    // ★低BST救済カード: BSTが低いほど効果倍増
    UNDERDOG: {
        color: 'purple', name: '下剋上', desc: '弱者の誇り：ATK&HP大幅UP(低BST優遇)',
        calc: (lv) => ({ underdogAtk: lv * 4, underdogHp: lv * 12 }),
        // BST≤340: ×2.5, BST341~520: ×1.0, BST521+: ×0.25
        // Lv20 BST≤340: ATK+200, HP+600 (base only)
        awakenBonus: [
            { lv:1, underdogAtk: 15,  underdogHp: 50,  txt: 'ATK&HP UP(小)' },
            { lv:2, underdogAtk: 25,  underdogHp: 80,  txt: 'ATK&HP UP(中)' },
            { lv:3, underdogAtk: 40,  underdogHp: 120, critPct: 10, txt: 'ATK&HP UP(大) 会心+10%' },
            { lv:4, underdogAtk: 60,  underdogHp: 180, txt: 'ATK&HP UP(特大)' },
            { lv:5, underdogAtk: 100, underdogHp: 300, spdFlat: 5, txt: 'ATK&HP UP(極) SPD+5' }
        ]
    }
};

// =============================================
// ドロップ確率テーブル
// =============================================
const CARD_DROP_CONFIG = {
    // レベル分布（重み）: 低レベルほど出やすい
    levelWeights: [
        { min:1,  max:5,  weight: 40 },   // 40%
        { min:6,  max:10, weight: 30 },   // 30%
        { min:11, max:15, weight: 18 },   // 18%
        { min:16, max:19, weight: 10 },   // 10%
        { min:20, max:20, weight: 2  }    //  2% (神引き)
    ],
    // 色分布（重み）
    colorWeights: {
        red: 30, yellow: 30, blue: 25, purple: 15
    },
    // 色ごとの効果タイプ候補
    effectPool: {
        red:    ['ATK_UP', 'CRIT_UP', 'CRIT_DMG_UP', 'RED_LIFESTEAL', 'RED_DESPERATION', 'TYPE_SLAYER', 'EXTRA_ATTACK', 'GENDER_SLAYER', 'GLASS_CANNON'],
        yellow: ['HP_UP', 'DMG_CUT', 'TYPE_RESIST', 'DODGE_UP', 'YELLOW_SHIELD', 'HEAL_BOOST', 'FRONT_RESIST', 'BACK_RESIST', 'TANK_MODE'],
        blue:   ['SPD_UP', 'CHARGE_DOWN', 'INIT_CHARGE', 'STATUS_RES', 'SKILL_LV_UP', 'POWER_UP', 'HEAVY_SKILL', 'PROB_SKILL'],
        purple: ['ALL_UP', 'FIERCE', 'FORTRESS', 'GALE', 'SHIELD', 'DESPERATION', 'LIFESTEAL', 'UNDERDOG']
    }
};

// =============================================
// カード覚醒（合成）設定
// =============================================
const CARD_AWAKEN_CONFIG = {
    // 素材カードのレベル別成功率
    successRate: [
        { minLv: 20, rate: 1.00 },   // Lv20: 確定
        { minLv: 15, rate: 0.70 },   // Lv15-19: 70%
        { minLv: 10, rate: 0.40 },   // Lv10-14: 40%
        { minLv: 1,  rate: 0.15 }    // Lv1-9:  15%
    ],
    // 覚醒段階ごとのゴールド費用
    goldCost: [500, 1000, 2500, 5000, 10000],
    // ベースカードの最低レベル
    baseMinLevel: 15
};

// =============================================
// カード分解（サルベージ）設定
// =============================================
const CARD_SALVAGE_CONFIG = {
    // レベル別に得られる欠片数
    getFragments(card) {
        const base = Math.max(1, Math.floor(card.level / 4));  // Lv1=1, Lv20=5
        const awakenBonus = card.awakening * 3;                 // 覚醒1あたり+3
        return base + awakenBonus;
    },
    // 欠片からカード生成コスト
    craftCost: {
        red: 20, yellow: 20, blue: 25, purple: 40
    },
    // 生成時のレベル範囲 (ランダムだが最低保証あり)
    craftLevelRange: { min: 5, max: 15 }
};

// =============================================
// CardManager クラス
// =============================================
class CardManager {
    constructor() {
        this.cards = [];         // カードインベントリ [{cardId, color, effectType, level, awakening, createTime}]
        this.fragments = { red: 0, yellow: 0, blue: 0, purple: 0 };  // 色別欠片
        this.maxCards = 100;     // 所持上限
    }

    // --- セーブ / ロード ---
    toSaveData() {
        return {
            cards: this.cards,
            fragments: this.fragments
        };
    }

    loadSaveData(data) {
        if (!data) return;
        this.cards = data.cards || [];
        this.fragments = data.fragments || { red: 0, yellow: 0, blue: 0, purple: 0 };
    }

    // --- カード生成（ドロップ） ---
    generateCard(options = {}) {
        const color = options.color || this._rollColor();
        const effectType = options.effectType || this._rollEffect(color);
        const level = options.level || this._rollLevel();

        const card = {
            cardId: 'card_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            color: color,
            effectType: effectType,
            level: level,
            awakening: 0,
            createTime: Date.now()
        };
        return card;
    }

    /** カードをインベントリに追加。上限チェックあり。 */
    addCard(card) {
        if (this.cards.length >= this.maxCards) {
            return { success: false, reason: 'full' };
        }
        this.cards.push(card);
        return { success: true, card: card };
    }

    /** カードをIDで取得 */
    getCard(cardId) {
        return this.cards.find(c => c.cardId === cardId) || null;
    }

    /** カードを削除 */
    removeCard(cardId) {
        const idx = this.cards.findIndex(c => c.cardId === cardId);
        if (idx === -1) return false;
        this.cards.splice(idx, 1);
        return true;
    }

    // --- カード分解 ---
    salvageCard(cardId) {
        const card = this.getCard(cardId);
        if (!card) return null;

        const frags = CARD_SALVAGE_CONFIG.getFragments(card);
        this.fragments[card.color] = (this.fragments[card.color] || 0) + frags;
        this.removeCard(cardId);
        return { color: card.color, fragments: frags };
    }

    /** 一括分解（cardId配列） */
    salvageBulk(cardIds) {
        let total = { red: 0, yellow: 0, blue: 0, purple: 0 };
        cardIds.forEach(id => {
            const result = this.salvageCard(id);
            if (result) total[result.color] += result.fragments;
        });
        return total;
    }

    // --- 欠片からカード生成（クラフト） ---
    craftCard(color) {
        const cost = CARD_SALVAGE_CONFIG.craftCost[color];
        if (!cost || (this.fragments[color] || 0) < cost) {
            return { success: false, reason: 'not_enough_fragments' };
        }
        this.fragments[color] -= cost;

        const { min, max } = CARD_SALVAGE_CONFIG.craftLevelRange;
        const level = min + Math.floor(Math.random() * (max - min + 1));
        const card = this.generateCard({ color, level });
        return this.addCard(card);
    }

    // --- カード覚醒（合成） ---
    awakenCard(baseCardId, materialCardId, goldAmount) {
        const base = this.getCard(baseCardId);
        const mat = this.getCard(materialCardId);

        if (!base || !mat) return { success: false, reason: 'not_found' };
        if (base.awakening >= 5) return { success: false, reason: 'max_awakening' };
        if (base.level < CARD_AWAKEN_CONFIG.baseMinLevel) return { success: false, reason: 'base_level_low' };
        if (base.color !== mat.color) return { success: false, reason: 'color_mismatch' };
        if (base.cardId === mat.cardId) return { success: false, reason: 'same_card' };

        const costIdx = base.awakening; // 現在の覚醒段階 = 次の覚醒のコストインデックス
        const cost = CARD_AWAKEN_CONFIG.goldCost[costIdx];
        if (goldAmount < cost) return { success: false, reason: 'not_enough_gold', cost: cost };

        // 成功率判定
        let rate = 0.15; // デフォルト
        for (const entry of CARD_AWAKEN_CONFIG.successRate) {
            if (mat.level >= entry.minLv) {
                rate = entry.rate;
                break;
            }
        }

        const isSuccess = Math.random() < rate;

        // 素材カードは成否に関わらず消費
        this.removeCard(materialCardId);

        if (isSuccess) {
            base.awakening += 1;
            return { success: true, newAwakening: base.awakening, rate: rate };
        } else {
            return { success: false, reason: 'failed', rate: rate };
        }
    }

    // --- カード効果の計算 ---
    /**
     * 1枚のカードの最終効果値を計算して返す
     * @returns { atkPct, atkFlat, hpPct, hpFlat, spdFlat, critPct, 
     *            statusResist, chargeReduce, initCharge, ... }
     */
    calcCardEffect(card) {
        if (!card) return {};
        const effectDef = CARD_EFFECTS[card.effectType];
        if (!effectDef) return {};

        // ベース効果（レベル依存）
        const baseEffect = effectDef.calc(card.level);
        const result = { ...baseEffect };

        // 覚醒ボーナス（固定値加算）
        if (effectDef.awakenBonus) {
            effectDef.awakenBonus.forEach(bonus => {
                if (card.awakening >= bonus.lv) {
                    Object.keys(bonus).forEach(key => {
                        if (key === 'lv' || key === 'txt') return;
                        result[key] = (result[key] || 0) + bonus[key];
                    });
                }
            });
        }

        return result;
    }

    /**
     * ユニットに装備された全カードの合算効果を計算
     * @param equipCards { red: cardId, yellow: cardId, blue: cardId, purple: cardId }
     * @returns 合算された効果オブジェクト
     */
    calcEquippedEffects(equipCards) {
        const totals = {
            atkPct: 0, atkFlat: 0, hpPct: 0, hpFlat: 0, spdFlat: 0, critPct: 0,
            statusResist: 0, chargeReduce: 0, initCharge: 0, shieldPct: 0,
            desperationAtkPct: 0, lifestealPct: 0,
            // ▼ 追加項目
            critDmgPct: 0, weakSlayerPct: 0, extraAttackProb: 0, genderSlayerPct: 0, hpDownPct: 0,
            dmgCutPct: 0, weakResistPct: 0, dodgePct: 0, healBoostPct: 0, frontResistPct: 0, backResistPct: 0, atkDownPct: 0,
            skillLvBonus: 0, chargePen: 0, probSkillActivate: 0,
            // ★下剋上カード用
            underdogAtk: 0, underdogHp: 0
        };

        if (!equipCards) return totals;

        ['red', 'yellow', 'blue', 'purple'].forEach(color => {
            const cardId = equipCards[color];
            if (!cardId) return;
            const card = this.getCard(cardId);
            if (!card) return;
            const eff = this.calcCardEffect(card);
            Object.keys(totals).forEach(key => {
                if (eff[key]) totals[key] += eff[key];
            });
        });

        return totals;
    }

    // --- カード効果の説明文生成 ---
    getCardDescription(card) {
        if (!card) return '';
        const effectDef = CARD_EFFECTS[card.effectType];
        if (!effectDef) return '';

        const eff = this.calcCardEffect(card);
        let desc = effectDef.desc;

        // プレースホルダー置換
        if (desc.includes('#val#')) {
            const val = eff.atkPct || eff.hpPct || eff.critPct || eff.statusResist || eff.spdFlat || eff.shieldPct || eff.desperationAtkPct || eff.lifestealPct || 0;
            desc = desc.replace('#val#', Math.floor(val));
        }
        if (desc.includes('#hval#')) desc = desc.replace('#hval#', Math.floor(eff.hpPct || 0));
        if (desc.includes('#aval#')) desc = desc.replace('#aval#', Math.floor(eff.atkPct || 0));
        if (desc.includes('#cval#')) desc = desc.replace('#cval#', Math.floor(eff.critPct || 0));
        if (desc.includes('#rval#')) desc = desc.replace('#rval#', Math.floor(eff.statusResist || 0));

        return desc;
    }

    /** カードのレアリティラベル (レベル帯で表示用ランクを付与) */
    getCardRank(card) {
        if (!card) return 'D';
        if (card.level >= 20) return 'SSS';
        if (card.level >= 16) return 'SS';
        if (card.level >= 11) return 'S';
        if (card.level >= 6)  return 'A';
        return 'B';
    }

    /** カードの色情報取得 */
    getCardColorInfo(card) {
        if (!card) return CARD_COLORS.RED;
        return Object.values(CARD_COLORS).find(c => c.id === card.color) || CARD_COLORS.RED;
    }

    // --- 内部: 抽選ロジック ---
    _rollColor() {
        const w = CARD_DROP_CONFIG.colorWeights;
        const total = Object.values(w).reduce((s, v) => s + v, 0);
        let r = Math.random() * total;
        for (const [color, weight] of Object.entries(w)) {
            r -= weight;
            if (r <= 0) return color;
        }
        return 'red';
    }

    _rollEffect(color) {
        const pool = CARD_DROP_CONFIG.effectPool[color];
        if (!pool || pool.length === 0) return 'ATK_UP';
        return pool[Math.floor(Math.random() * pool.length)];
    }

    _rollLevel() {
        const weights = CARD_DROP_CONFIG.levelWeights;
        const total = weights.reduce((s, w) => s + w.weight, 0);
        let r = Math.random() * total;
        for (const entry of weights) {
            r -= entry.weight;
            if (r <= 0) {
                return entry.min + Math.floor(Math.random() * (entry.max - entry.min + 1));
            }
        }
        return 1;
    }

    // --- ソート・フィルタ用ヘルパー ---
    getCardsByColor(color) {
        return this.cards.filter(c => c.color === color);
    }

    getCardsSorted(sortKey = 'level', ascending = false) {
        const sorted = [...this.cards];
        sorted.sort((a, b) => {
            let va, vb;
            switch(sortKey) {
                case 'level':    va = a.level; vb = b.level; break;
                case 'awakening': va = a.awakening; vb = b.awakening; break;
                case 'color':    va = a.color; vb = b.color; break;
                case 'time':     va = a.createTime; vb = b.createTime; break;
                default:         va = a.level; vb = b.level;
            }
            return ascending ? (va - vb) : (vb - va);
        });
        return sorted;
    }

    /** インベントリ残り枠数 */
    getRemainingSlots() {
        return this.maxCards - this.cards.length;
    }
}

// グローバルインスタンス（app初期化前にも参照可能にする）
if (typeof window !== 'undefined') {
    window.CardManager = CardManager;
    window.CARD_COLORS = CARD_COLORS;
    window.CARD_EFFECTS = CARD_EFFECTS;
    window.CARD_DROP_CONFIG = CARD_DROP_CONFIG;
    window.CARD_AWAKEN_CONFIG = CARD_AWAKEN_CONFIG;
    window.CARD_SALVAGE_CONFIG = CARD_SALVAGE_CONFIG;
}
