/**
 * data.js - v2.0 大改修版 (フェーズ1: プロトタイプ30体)
 * ・SPEC_v2.md準拠: 6属性・5ステータス・BST制・行動回数
 * ・旧121体を完全破棄し、新フォーマットで30体のプロトタイプを定義
 * ・後方互換: TYPES, base.type, base.cost は維持（UI画面が壊れないように）
 */

// =============================================
// ★属性定義 (旧TYPESを置換)
// =============================================
const ELEMENTS = [
    {id:0, name:'火',  label:'FIRE',    icon:'🔥', key:'fire'},
    {id:1, name:'水',  label:'WATER',   icon:'💧', key:'water'},
    {id:2, name:'草',  label:'GRASS',   icon:'🌿', key:'grass'},
    {id:3, name:'光',  label:'LIGHT',   icon:'☀️', key:'light'},
    {id:4, name:'闇',  label:'DARK',    icon:'🌑', key:'dark'},
    {id:5, name:'無',  label:'NEUTRAL', icon:'⚪', key:'neutral'}
];

// ★後方互換: 旧TYPESエイリアス (formation, gacha, zukanのタブ表示用)
const TYPES = ELEMENTS;

// 属性キー → ID変換マップ
const ELEMENT_ID = { fire:0, water:1, grass:2, light:3, dark:4, neutral:5 };

// =============================================
// ★属性相性テーブル
// =============================================
// 火→草→水→火 (三すくみ), 光⇔闇 (相互弱点), 無=等倍のみ
function getElementAdvantage(atkElem, defElem) {
    // 三すくみ (有利 → ×1.5)
    if (atkElem === 'fire'  && defElem === 'grass') return 1.5;
    if (atkElem === 'grass' && defElem === 'water') return 1.5;
    if (atkElem === 'water' && defElem === 'fire')  return 1.5;
    // 三すくみ (不利 → ×0.75)
    if (atkElem === 'grass' && defElem === 'fire')  return 0.75;
    if (atkElem === 'water' && defElem === 'grass') return 0.75;
    if (atkElem === 'fire'  && defElem === 'water') return 0.75;
    // 光⇔闇 (相互弱点 → ×1.5)
    if (atkElem === 'light' && defElem === 'dark')  return 1.5;
    if (atkElem === 'dark'  && defElem === 'light') return 1.5;
    // 無属性は弱点なし・突けない、その他も等倍
    return 1.0;
}

// =============================================
// ★シェイプ定義 (変更なし)
// =============================================
const SHAPE = {
    S1:{w:1,h:1,code:'S1x1',label:'1x1', grid:[1,0,0,0], slots:1},
    V2:{w:1,h:2,code:'V1x2',label:'縦2', grid:[1,0,1,0], slots:2},
    H2:{w:2,h:1,code:'H2x1',label:'横2', grid:[1,1,0,0], slots:2},
    L4:{w:2,h:2,code:'L2x2',label:'4枠', grid:[1,1,1,1], slots:4}
};

// =============================================
// ★シェイプ別行動回数テーブル (SPEC_v2 Section 5)
// =============================================
// 返り値: 行動回数 (1~3)
function rollActionCount(shape) {
    const slots = shape.slots || 1;
    if (slots === 1) return 1; // 1x1: 固定1回
    if (slots === 2) {
        // 2枠: 1回(40%), 2回(60%)
        return Math.random() < 0.40 ? 1 : 2;
    }
    if (slots === 4) {
        // 4枠: 1回(20%), 2回(50%), 3回(30%)
        const r = Math.random();
        if (r < 0.20) return 1;
        if (r < 0.70) return 2;
        return 3;
    }
    return 1;
}

// =============================================
// ★ダメージ計算 (SPEC_v2 Section 3)
// =============================================
const DMG_COEFFICIENT = 50; // 調整つまみ

function calcNormalDamage(atkStat, defStat, elementMul) {
    const rand = 0.85 + Math.random() * 0.15; // 0.85~1.0
    return Math.max(1, Math.floor((atkStat / Math.max(1, defStat)) * DMG_COEFFICIENT * rand * elementMul));
}

function calcSkillDamage(atkStat, skillPowerPct, resStat, elementMul) {
    const rand = 0.85 + Math.random() * 0.15;
    return Math.max(1, Math.floor((atkStat * (skillPowerPct / 100) / Math.max(1, resStat)) * DMG_COEFFICIENT * rand * elementMul));
}

// =============================================
// ★役割テンプレート (BST配分比率, SPEC_v2 Section 8)
// =============================================
const ROLE_TEMPLATES = {
    PHY_ATK:   { hp:0.15, atk:0.28, def:0.10, spd:0.25, res:0.12 }, // 物理アタッカー
    SKL_ATK:   { hp:0.14, atk:0.25, def:0.11, spd:0.19, res:0.12 }, // スキルアタッカー
    PHY_WALL:  { hp:0.20, atk:0.11, def:0.26, spd:0.04, res:0.12 }, // 物理壁
    RES_WALL:  { hp:0.19, atk:0.08, def:0.12, spd:0.05, res:0.26 }, // 特殊壁
    BOTH_WALL: { hp:0.22, atk:0.07, def:0.17, spd:0.10, res:0.17 }, // 両受け
    SPEED:     { hp:0.11, atk:0.18, def:0.08, spd:0.27, res:0.08 }, // 速攻型
    BALANCE:   { hp:0.16, atk:0.16, def:0.16, spd:0.16, res:0.16 }, // バランス
    SUPPORT:   { hp:0.18, atk:0.10, def:0.14, spd:0.14, res:0.18 }, // ヒーラー/サポート
};

/** BST + 役割テンプレからステータスを自動生成
 *  HPは他ステと異なるスケール (300~600帯) が必要なため ×HP_SCALE で補正 */
const HP_SCALE = 6;

function generateStats(bst, role) {
    const t = ROLE_TEMPLATES[role] || ROLE_TEMPLATES.BALANCE;
    return {
        hp:  Math.floor(bst * t.hp * HP_SCALE),  // HP: 300~600帯
        atk: Math.floor(bst * t.atk),             // ATK: 20~170帯
        def: Math.floor(bst * t.def),
        spd: Math.floor(bst * t.spd),
        res: Math.floor(bst * t.res)
    };
}

// =============================================
// ★スキル定義 (SPEC_v2 Section 6 新フォーマット)
// =============================================
const SKILL = {
    NONE: {name:'-', type:'NONE', element:'neutral', power:0, accuracy:100, charge:99, effect:null, effectRate:0, desc:'なし'},

    // === 火属性 攻撃 ===
    FIRE_BALL:     {name:'烈火弾',     type:'SINGLE', element:'fire', power:80,  accuracy:95,  charge:3, effect:null, effectRate:0, desc:'炎を纏った弾を放つ'},
    FIRE_BREATH:   {name:'火炎の陣',   type:'LINE_H', element:'fire', power:70,  accuracy:85,  charge:4, effect:null, effectRate:0, desc:'横一列を火計で焼く'},
    INFERNO:       {name:'焦土の計', type:'BLAST',  element:'fire', power:60,  accuracy:80,  charge:6, effect:null, effectRate:0, desc:'敵全体を焼き尽くす火計'},
    ERUPTION:      {name:'炎帝の剣',       type:'SINGLE', element:'fire', power:180, accuracy:75,  charge:7, effect:null, effectRate:0, desc:'覇者の全てを賭けた一撃'},
    FLAME_SLASH:   {name:'烈火斬',     type:'SINGLE', element:'fire', power:90,  accuracy:90,  charge:3, effect:'burn', effectRate:30, desc:'炎を纏った斬撃+火傷'},

    // === 水属性 攻撃 ===
    WATER_SHOT:    {name:'水撃',       type:'SINGLE', element:'water', power:80,  accuracy:95,  charge:3, effect:null, effectRate:0, desc:'水の力で打つ'},
    TIDAL_WAVE:    {name:'荒波の陣',     type:'BLAST',  element:'water', power:60,  accuracy:80,  charge:6, effect:null, effectRate:0, desc:'敵全体を波濤で飲み込む'},
    ICE_FANG:      {name:'氷結の突き',     type:'SINGLE', element:'water', power:100, accuracy:90,  charge:4, effect:'paralyze', effectRate:20, desc:'凍てつく槍の一突き'},
    ABYSS_CANNON:  {name:'蒼海の怒り',     type:'SINGLE', element:'water', power:190, accuracy:70,  charge:8, effect:null, effectRate:0, desc:'海の全てを解き放つ奥義'},
    BUBBLE_SHIELD: {name:'水盾の術',   type:'SINGLE', element:'water', power:50,  accuracy:100, charge:3, effect:null, effectRate:0, desc:'水の攻撃+防御の術'},

    // === 草属性 攻撃 ===
    VINE_WHIP:     {name:'藤打ち',   type:'SINGLE', element:'grass', power:70,  accuracy:95,  charge:3, effect:null, effectRate:0, desc:'藤の棒で打つ'},
    SOLAR_BEAM:    {name:'陽光の矢',   type:'LINE_V', element:'grass', power:100, accuracy:85,  charge:5, effect:null, effectRate:0, desc:'縦一列を光の矢で射抜く'},
    POISON_STING:  {name:'毒塗りの矢',       type:'SINGLE', element:'grass', power:50,  accuracy:90,  charge:3, effect:'poison', effectRate:60, desc:'毒を塗った矢で射る'},
    SLEEP_SPORE:   {name:'睡眠薬',     type:'SINGLE', element:'grass', power:30,  accuracy:85,  charge:3, effect:'sleep', effectRate:70, desc:'調合した薬で眠らせる'},
    NEEDLE_STORM:  {name:'連続射撃',       type:'MULTI',  element:'grass', power:30,  accuracy:85,  charge:4, effect:null, effectRate:0, count:3, desc:'ランダムに3回射る'},

    // === 光属性 攻撃/回復 ===
    HOLY_STRIKE:   {name:'聖剣の一閃', type:'SINGLE', element:'light', power:80,  accuracy:95,  charge:3, effect:null, effectRate:0, desc:'聖なる剣で斬る'},
    HEAL_LIGHT:    {name:'治癒の祈り',   type:'HEAL',   element:'light', power:50,  accuracy:100, charge:3, effect:null, effectRate:0, desc:'祈りで味方を癒す'},
    HEAL_ALL_LIGHT:{name:'聖なる祈り', type:'HEAL_ALL',element:'light', power:35,  accuracy:100, charge:4, effect:null, effectRate:0, desc:'味方全体HP回復'},
    INSPIRE:       {name:'鼓舞の号令',   type:'BUFF_ALL',element:'light', power:0,   accuracy:100, charge:4, val:1.25, effect:null, effectRate:0, desc:'号令で味方全体ATK+25%'},
    JUDGMENT:      {name:'天罰の光',   type:'BLAST',  element:'light', power:65,  accuracy:80,  charge:6, effect:null, effectRate:0, desc:'敵全体に神の裁き'},

    // === 闇属性 攻撃 ===
    SHADOW_CLAW:   {name:'暗器投げ',     type:'SINGLE', element:'dark', power:80,  accuracy:90,  charge:3, effect:null, effectRate:0, desc:'暗器を投げて仕留める'},
    DARK_PULSE:    {name:'闇討ち',   type:'BLAST',  element:'dark', power:65,  accuracy:85,  charge:5, effect:null, effectRate:0, desc:'敵全体を闇に葬る'},
    VAMP_BITE:     {name:'生命吸収',       type:'VAMP',   element:'dark', power:80,  accuracy:95,  charge:3, effect:null, effectRate:0, desc:'相手の生命力を奪い取る'},
    DARK_CURSE:    {name:'呪縛',       type:'DEBUFF', element:'dark', power:0,   accuracy:100, charge:3, val:0.7, turns:3, effect:null, effectRate:0, desc:'敵ATK-30%(3T)'},
    VOID_BURST:    {name:'暗殺奥義',   type:'SINGLE', element:'dark', power:200, accuracy:70,  charge:8, effect:null, effectRate:0, desc:'全てを終わらせる暗殺の極み'},

    // === 無属性 ===
    BODY_SLAM:     {name:'突撃',   type:'SINGLE', element:'neutral', power:90,  accuracy:90, charge:3, effect:null, effectRate:0, desc:'全力で突撃する'},
    QUICK_SLASH:   {name:'早斬り', type:'SINGLE', element:'neutral', power:50,  accuracy:100,charge:2, effect:null, effectRate:0, desc:'素早い一太刀'},
    SHIELD_WALL:   {name:'防壁の陣',   type:'DEF_BUFF_ALL', element:'neutral', power:0, accuracy:100, charge:4, val:0.7, turns:3, effect:null, effectRate:0, desc:'陣形で味方全体の被ダメ-30%(3T)'},
    METAL_GUARD:   {name:'鉄壁の構え',   type:'BUFF',   element:'neutral', power:0, accuracy:100, charge:2, val:1.5, effect:null, effectRate:0, desc:'構えを固めてDEF大幅UP'},
    WIND_SLASH:    {name:'旋風斬',     type:'LINE_V', element:'neutral', power:80,  accuracy:90, charge:4, effect:null, effectRate:0, desc:'縦一列を斬り裂く剣技'},
};

// =============================================
// ★特性(アビリティ)定義 (SPEC_v2 Section 7)
// =============================================
const ABILITY = {
    NONE: null,
    // 攻撃強化系
    POWER_UP:    {type:'STAT_BOOST', stat:'atk', val:1.20, name:'豪腕',     desc:'ATK+20%'},
    MAGIC_AMP:   {type:'SKILL_BOOST',            val:1.20, name:'魔力増幅',   desc:'スキル威力+20%'},
    DUAL_STANCE: {type:'DUAL_BOOST', atkVal:1.10, skillVal:1.10, name:'両刀の構え', desc:'ATK+10%, スキル威力+10%'},
    BERSERK:     {type:'BERSERK',    val:0.10, name:'闘志',   desc:'攻撃毎ATK+10%(累積)'},
    CRIT_EYE:    {type:'CRIT_UP',    val:0.30, name:'必殺の目', desc:'会心率+30%'},
    // 防御強化系
    HARD_SCALE:  {type:'STAT_BOOST', stat:'def', val:1.20, name:'重装',     desc:'DEF+20%'},
    SPIRIT_WALL: {type:'STAT_BOOST', stat:'res', val:1.20, name:'精神の壁',   desc:'RES+20%'},
    IRON_WALL:   {type:'DUAL_DEF',   defVal:1.10, resVal:1.10, name:'鉄壁', desc:'DEF+10%, RES+10%'},
    GUTS:        {type:'GUTS',       val:1, name:'不屈の魂',       desc:'致死ダメージ時HP1で耐える(1回)'},
    // 速度・回避系
    SWIFT:       {type:'STAT_BOOST', stat:'spd', val:1.20, name:'疾風',       desc:'SPD+20%'},
    EVASION:     {type:'DODGE',      val:0.30, name:'見切り',   desc:'30%で攻撃を回避'},
    NIMBLE:      {type:'DODGE',      val:0.50, name:'残影',     desc:'50%で攻撃を回避'},
    // 回復系
    REGEN:       {type:'REGEN',      val:0.10, name:'自然治癒',     desc:'毎ターンHP10%回復'},
    SUPER_REGEN: {type:'REGEN',      val:0.20, name:'超回復',   desc:'毎ターンHP20%回復'},
    ABSORB:      {type:'ABSORB',     val:0.15, name:'吸血体質', desc:'攻撃ダメージの15%をHP回復'},
    // 反撃系
    COUNTER:     {type:'COUNTER',    val:0.50, name:'反撃の構え',     desc:'被弾時50%で反撃'},
    AVENGER:     {type:'AVENGER',    val:0.50, name:'報復の誓い',     desc:'味方が倒されるとATK+50%'},
    // 耐性系
    PURIFY:      {type:'STATUS_RESIST', resist:1.00, name:'浄化', desc:'状態異常完全無効'},
    TENACITY:    {type:'STATUS_RESIST', resist:0.50, name:'強靭', desc:'状態異常耐性50%'},
    POISON_GUARD:{type:'POISON_IMMUNE',              name:'耐毒', desc:'毒・火傷無効'},
    // 味方強化系
    INSPIRE_AURA:{type:'TEAM_BUFF', stat:'atk', val:1.10, name:'鼓舞',     desc:'味方全体ATK+10%'},
    MIND_BARRIER:{type:'TEAM_BUFF', stat:'res', val:1.10, name:'精神結界', desc:'味方全体RES+10%'},
    // 特殊系
    INTIMIDATE:  {type:'INTIMIDATE', val:0.10, name:'威圧',       desc:'戦闘開始時、敵全体ATK-10%'},
    CURSED_BODY: {type:'CURSED_BODY',val:0.30, name:'呪いの返し',   desc:'被弾時30%で相手に毒付与'},
    ACCELERATE:  {type:'ACCELERATE', val:0.10, name:'加速',       desc:'毎ターンSPD+10%(累積)'},
    SKILL_MASTER:{type:'SKILL_MASTER',val:1,   name:'達人', desc:'チャージターン-1'},
    // 行動回数関連 (2枠・4枠用)
    STABLE_ACT:  {type:'STABLE_ACTION', name:'安定行動', desc:'行動回数が必ず2回固定'},
    RAMPAGE:     {type:'RAMPAGE',       name:'猛攻',     desc:'行動回数の最大値+1'},
    COMBO_STANCE:{type:'COMBO_STANCE', val:0.20, name:'連撃の構え', desc:'2回以上行動時ATK+20%'},
};

// ★後方互換: 旧PASSIVEエイリアス
const PASSIVE = ABILITY;

// =============================================
// ★限界突破(LB)テーブル (SPEC_v2対応)
// =============================================
const LB_TEMPLATES = {
    // BST 250~340 (序盤)
    LOW_BST: [
        { lv:1, type:'STAT', stat:'hp',  val:1.5, txt:'HP+50%' },
        { lv:2, type:'STAT', stat:'atk', val:1.5, txt:'ATK+50%' },
        { lv:3, type:'STAT', stat:'all', val:1.3, txt:'全ステ+30%' },
        { lv:4, type:'STATUS_RESIST', val:0.50, txt:'状態異常耐性50%' },
        { lv:5, type:'STAT', stat:'all', val:1.3, txt:'全ステ+30%(2回目)' }
    ],
    // BST 350~520 (中堅~主力)
    MID_BST: [
        { lv:1, type:'STAT', stat:'hp',  val:1.3, txt:'HP+30%' },
        { lv:2, type:'STAT', stat:'atk', val:1.3, txt:'ATK+30%' },
        { lv:3, type:'PASSIVE', code:'CRIT_UP', val:0.3, txt:'会心率+30%' },
        { lv:4, type:'STATUS_RESIST', val:0.40, txt:'状態異常耐性40%' },
        { lv:5, type:'PASSIVE', code:'DODGE', val:0.3, txt:'見切り(回避30%)' }
    ],
    // BST 530~600 (エース~伝説)
    HIGH_BST: [
        { lv:1, type:'STAT', stat:'hp',  val:1.2, txt:'HP+20%' },
        { lv:2, type:'STAT', stat:'atk', val:1.2, txt:'ATK+20%' },
        { lv:3, type:'SKILL_BOOST', val:1.5, txt:'スキル威力1.5倍' },
        { lv:4, type:'STATUS_RESIST', val:0.60, txt:'状態異常耐性60%' },
        { lv:5, type:'PASSIVE', code:'GUTS_EX', val:1, txt:'超根性(復活)' }
    ],
    // ★後方互換: 旧テンプレート名をエイリアス
    get LOW_COST()  { return this.LOW_BST; },
    get MID_COST()  { return this.MID_BST; },
    get HIGH_COST() { return this.HIGH_BST; },
};

// =============================================
// ★キャラクター生成ヘルパー
// =============================================
/** BST → 旧コスト値への変換 (後方互換用) */
function bstToCost(bst) {
    if (bst >= 600) return 10;
    if (bst >= 530) return 7;
    if (bst >= 450) return 5;
    if (bst >= 350) return 3;
    return 1;
}

/** レアリティ文字 (ガチャ排出・表示用) */
function bstToRarity(bst) {
    if (bst >= 600) return 'UR';
    if (bst >= 530) return 'SSR';
    if (bst >= 450) return 'SR';
    if (bst >= 350) return 'R';
    return 'C';
}

/**
 * キャラデータ生成関数
 * @param {number} id - ユニークID
 * @param {string} name - キャラ名
 * @param {string} element - 属性キー (fire/water/grass/light/dark/neutral)
 * @param {Object} shape - SHAPE.S1 etc.
 * @param {number} bst - 種族値合計
 * @param {string} role - ROLE_TEMPLATES のキー
 * @param {Object|null} statsOverride - ステータス手動指定 (nullならテンプレ自動生成)
 * @param {string[]} skillIds - スキルID配列
 * @param {string} abilityId - アビリティID
 * @param {Object|null} evolution - {next: id, level: lv} or null
 * @param {string} family - 進化系統ID
 * @param {number} stage - 進化段階 (1=初期, 2=中間, 3=最終)
 */
function makeChar(id, name, element, shape, bst, role, statsOverride, skillIds, abilityId, evolution, family, stage) {
    const stats = statsOverride || generateStats(bst, role);
    const skills = skillIds.map(sid => SKILL[sid] || SKILL.NONE);
    const ability = ABILITY[abilityId] || ABILITY.NONE;
    const rarity = bstToRarity(bst);
    const cost = bstToCost(bst);

    return {
        // ★新フォーマット
        id,
        name,
        element,        // 'fire', 'water', etc.
        shape,
        bst,
        stats,          // {hp, atk, def, spd, res}
        skills: skillIds,
        skill: skills[0] || SKILL.NONE,  // ★後方互換: 旧コードは base.skill で参照
        ability,
        evolution: evolution || null,
        family: family || null,
        stage: stage || 1,
        rarity,

        // ★後方互換フィールド (旧コードが参照する)
        type: ELEMENT_ID[element] || 0,   // 数値タイプID (0~5)
        cost,                              // 旧コスト (BST換算)
        hp: stats.hp,                      // base.hp
        atk: stats.atk,                    // base.atk
        def: stats.def,                    // base.def (新)
        spd: stats.spd,                    // base.spd
        res: stats.res,                    // base.res (新)
        passive: ability,                  // base.passive (旧PASSIVEエイリアス)
    };
}

// =============================================
// ★キャラクターデータベース (プロトタイプ 30体)
// =============================================
const DB = [
    // =========================================
    // 🔥 火属性 — 軍事・武力 (5人)
    // =========================================
    // ID 1: 剣術の見習い — 物理アタッカー, 3段階昇格の見習い(F1)
    makeChar(1, '剣術の見習い', 'fire', SHAPE.S1, 300, 'PHY_ATK', 
        {hp:300, atk:80, def:30, spd:75, res:35},
        ['FIRE_BALL'], 'POWER_UP',
        {next:4, level:20}, 'F1', 1),

    // ID 2: 重装騎士 — 物理壁, 昇格なし
    makeChar(2, '重装騎士', 'fire', SHAPE.S1, 480, 'PHY_WALL',
        {hp:520, atk:55, def:125, spd:20, res:55},
        ['FLAME_SLASH', 'SHIELD_WALL'], 'HARD_SCALE',
        null, null, 1),

    // ID 3: 従者 — バランス型, 騎士系の見習い(F2)
    makeChar(3, '従者', 'fire', SHAPE.S1, 280, 'BALANCE',
        {hp:280, atk:45, def:42, spd:48, res:42},
        ['FIRE_BALL'], 'REGEN',
        null, 'F2', 1),

    // ID 4: 剣聖 — エース物理アタッカー, 剣士系の英雄級(F1)
    makeChar(4, '剣聖', 'fire', SHAPE.V2, 550, 'PHY_ATK',
        {hp:480, atk:150, def:55, spd:130, res:65},
        ['FIRE_BREATH', 'INFERNO'], 'BERSERK',
        null, 'F1', 3),

    // ID 5: 炎帝 — 伝説, BST600, 最強の武人
    makeChar(5, '炎帝', 'fire', SHAPE.L4, 600, 'PHY_ATK',
        {hp:550, atk:170, def:60, spd:145, res:65},
        ['ERUPTION', 'INFERNO'], 'INTIMIDATE',
        null, 'LEGEND', 1),

    // =========================================
    // 💧 水属性 — 海洋・交易 (5人)
    // =========================================
    // ID 6: 水夫 — スキルアタッカー, 航海士系の見習い(W1)
    makeChar(6, '水夫', 'water', SHAPE.S1, 300, 'SKL_ATK',
        {hp:280, atk:75, def:35, spd:60, res:40},
        ['WATER_SHOT'], 'MAGIC_AMP',
        {next:9, level:20}, 'W1', 1),

    // ID 7: 珊瑚の巫女 — RES壁, 昇格なし
    makeChar(7, '珊瑚の巫女', 'water', SHAPE.S1, 420, 'RES_WALL',
        {hp:460, atk:35, def:50, spd:22, res:110},
        ['BUBBLE_SHIELD', 'HEAL_LIGHT'], 'SPIRIT_WALL',
        null, null, 1),

    // ID 8: 海賊見習い — バランス型, 海賊系の見習い(W2)
    makeChar(8, '海賊見習い', 'water', SHAPE.S1, 290, 'BALANCE',
        {hp:290, atk:45, def:45, spd:45, res:45},
        ['WATER_SHOT'], 'TENACITY',
        null, 'W2', 1),

    // ID 9: 提督 — エーススキルアタッカー, 航海士系の英雄級(W1)
    makeChar(9, '提督', 'water', SHAPE.V2, 560, 'SKL_ATK',
        {hp:450, atk:140, def:65, spd:105, res:70},
        ['ICE_FANG', 'TIDAL_WAVE'], 'SKILL_MASTER',
        null, 'W1', 3),

    // ID 10: 蒼海の覇者 — 伝説, BST600, 全海域を支配した覇者
    makeChar(10, '蒼海の覇者', 'water', SHAPE.L4, 600, 'SKL_ATK',
        {hp:570, atk:155, def:70, spd:100, res:110},
        ['ABYSS_CANNON', 'TIDAL_WAVE'], 'PURIFY',
        null, 'LEGEND', 1),

    // =========================================
    // 🌿 草属性 — 自然・農耕 (5人)
    // =========================================
    // ID 11: 薬草摘み — ヒーラー/サポート, 薬師系の見習い(G1)
    makeChar(11, '薬草摘み', 'grass', SHAPE.S1, 280, 'SUPPORT',
        {hp:310, atk:28, def:40, spd:40, res:52},
        ['HEAL_LIGHT'], 'REGEN',
        null, 'G1', 1),

    // ID 12: 森の隠者 — 物理壁+反撃, 昇格なし
    makeChar(12, '森の隠者', 'grass', SHAPE.S1, 450, 'PHY_WALL',
        {hp:500, atk:50, def:115, spd:20, res:55},
        ['VINE_WHIP', 'SHIELD_WALL'], 'COUNTER',
        null, null, 1),

    // ID 13: 弓の見習い — 速攻物理+毒, 弓の達人系の見習い(G3)
    makeChar(13, '弓の見習い', 'grass', SHAPE.S1, 350, 'SPEED',
        {hp:250, atk:65, def:28, spd:95, res:28},
        ['POISON_STING', 'NEEDLE_STORM'], 'SWIFT',
        null, 'G4', 1),

    // ID 14: 薬師 — サポート, 薬師系の正規(G1)
    makeChar(14, '薬師', 'grass', SHAPE.V2, 420, 'SUPPORT',
        {hp:420, atk:42, def:58, spd:58, res:78},
        ['HEAL_ALL_LIGHT', 'SLEEP_SPORE'], 'MIND_BARRIER',
        null, 'G1', 2),

    // ID 15: 大樹の番人 — 両壁型, 昇格なし
    makeChar(15, '大樹の番人', 'grass', SHAPE.S1, 500, 'BOTH_WALL',
        {hp:580, atk:35, def:85, spd:50, res:85},
        ['VINE_WHIP', 'SHIELD_WALL'], 'IRON_WALL',
        null, null, 1),

    // =========================================
    // ☀️ 光属性 — 信仰・王権 (5人)
    // =========================================
    // ID 16: 従騎士 — 物理アタッカー, 白銀の騎士系の見習い(L5)
    makeChar(16, '従騎士', 'light', SHAPE.S1, 300, 'PHY_ATK',
        {hp:290, atk:82, def:30, spd:78, res:32},
        ['HOLY_STRIKE'], 'POWER_UP',
        null, 'L5', 1),

    // ID 17: 金の盾持ち — 物理壁+回復, 昇格なし
    makeChar(17, '金の盾持ち', 'light', SHAPE.S1, 450, 'PHY_WALL',
        {hp:500, atk:50, def:110, spd:22, res:55},
        ['HOLY_STRIKE', 'HEAL_LIGHT'], 'GUTS',
        null, null, 1),

    // ID 18: 祝福の修道女 — ヒーラー, 昇格なし
    makeChar(18, '祝福の修道女', 'light', SHAPE.S1, 380, 'SUPPORT',
        {hp:380, atk:38, def:52, spd:55, res:70},
        ['HEAL_ALL_LIGHT', 'INSPIRE'], 'REGEN',
        null, null, 1),

    // ID 19: 大司教 — エース バフ+回復, 聖職者系の英雄級(L1)
    makeChar(19, '大司教', 'light', SHAPE.V2, 540, 'SUPPORT',
        {hp:540, atk:55, def:75, spd:78, res:100},
        ['HEAL_ALL_LIGHT', 'INSPIRE'], 'PURIFY',
        null, 'L1', 3),

    // ID 20: 聖剣の騎士 — 物理アタッカー, 昇格なし
    makeChar(20, '聖剣の騎士', 'light', SHAPE.S1, 480, 'PHY_ATK',
        {hp:420, atk:135, def:48, spd:118, res:55},
        ['HOLY_STRIKE', 'JUDGMENT'], 'CRIT_EYE',
        null, null, 1),

    // =========================================
    // 🌑 闇属性 — 裏社会・諜報 (5人)
    // =========================================
    // ID 21: スリ — 速攻アタッカー, 盗賊系の見習い(D1)
    makeChar(21, 'スリ', 'dark', SHAPE.S1, 300, 'SPEED',
        {hp:220, atk:55, def:25, spd:82, res:25},
        ['SHADOW_CLAW'], 'SWIFT',
        null, 'D1', 1),

    // ID 22: 墓守の少年 — 物理壁+反撃, 死霊術師系の見習い(D8)
    makeChar(22, '墓守の少年', 'dark', SHAPE.S1, 350, 'PHY_WALL',
        {hp:400, atk:38, def:90, spd:15, res:42},
        ['SHADOW_CLAW', 'DARK_CURSE'], 'COUNTER',
        null, 'D8', 1),

    // ID 23: 影の暗殺者 — 速攻物理, 昇格なし
    makeChar(23, '影の暗殺者', 'dark', SHAPE.S1, 470, 'SPEED',
        {hp:300, atk:85, def:38, spd:128, res:38},
        ['SHADOW_CLAW', 'DARK_PULSE'], 'EVASION',
        null, null, 1),

    // ID 24: 影の支配者 — エース 吸血型, 暗殺者系の英雄級(D2)
    makeChar(24, '影の支配者', 'dark', SHAPE.V2, 550, 'SKL_ATK',
        {hp:470, atk:140, def:60, spd:108, res:68},
        ['VAMP_BITE', 'DARK_PULSE'], 'ABSORB',
        null, 'D2', 3),

    // ID 25: 影の宰相 — 伝説, BST600, 王国崩壊の黒幕
    makeChar(25, '影の宰相', 'dark', SHAPE.L4, 600, 'SKL_ATK',
        {hp:530, atk:168, def:55, spd:140, res:72},
        ['VOID_BURST', 'DARK_PULSE'], 'SKILL_MASTER',
        null, 'LEGEND', 1),

    // =========================================
    // ⚪ 無属性 — 市民・技術 (5人)
    // =========================================
    // ID 26: 旅の少年 — バランス型, 冒険者系の見習い(N1)
    makeChar(26, '旅の少年', 'neutral', SHAPE.S1, 270, 'BALANCE',
        {hp:280, atk:42, def:42, spd:42, res:42},
        ['BODY_SLAM'], 'REGEN',
        null, 'N1', 1),

    // ID 27: 老練の重装兵 — 超物理壁, 昇格なし
    makeChar(27, '老練の重装兵', 'neutral', SHAPE.S1, 460, 'PHY_WALL',
        {hp:530, atk:48, def:130, spd:18, res:55},
        ['BODY_SLAM', 'SHIELD_WALL'], 'IRON_WALL',
        null, null, 1),

    // ID 28: 放浪の剣豪 — 物理アタッカー, 昇格なし
    makeChar(28, '放浪の剣豪', 'neutral', SHAPE.S1, 500, 'PHY_ATK',
        {hp:430, atk:140, def:52, spd:125, res:55},
        ['QUICK_SLASH', 'WIND_SLASH'], 'CRIT_EYE',
        null, null, 1),

    // ID 29: 突撃騎兵 — エース物理, 騎兵系の昇格後(N3)
    makeChar(29, '突撃騎兵', 'neutral', SHAPE.H2, 480, 'PHY_ATK',
        {hp:410, atk:135, def:48, spd:118, res:55},
        ['BODY_SLAM', 'WIND_SLASH'], 'POWER_UP',
        null, 'N3', 2),

    // ID 30: 旅の道化師 — 超回避型, 昇格なし (特殊)
    makeChar(30, '旅の道化師', 'neutral', SHAPE.S1, 350, 'SPEED',
        {hp:150, atk:40, def:150, spd:120, res:150},
        ['QUICK_SLASH', 'METAL_GUARD'], 'NIMBLE',
        null, null, 1),
];

// =============================================
// ★画像データの自動登録 (後方互換)
// =============================================
const IMG_DATA = {};
const PANEL_SPRITE_SHEETS = {
    // 例:
    // 1: { src: 'images/panel_enemy_1_sheet.webp', cols: 5, rows: 1, frames: 5, fps: 8, loop: true }
};
const CHARA_IDS = DB.map(c => c.id);
CHARA_IDS.forEach(id => {
    
    IMG_DATA[id] = PANEL_SPRITE_SHEETS[id] || `images/${id}.webp`;
});
