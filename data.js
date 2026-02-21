/**
 * data.js - リリース版 (全121体)
 * ・限界突破（下克上）システムが最も活きるピラミッド型バランス
 * ・低コスト（1〜2）のモブキャラ・サポートキャラを大量追加
 */

// =============================================
// ★画像データの自動登録
// =============================================
const IMG_DATA = {};

// キャラクターIDの一覧 (全121体)
const CHARA_IDS = [
    // 神 (19体: 既存6 + 新規13)
    1, 2, 3, 4, 5, 6, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113,
    // 覇王 (19体: 既存6 + 新規13)
    11, 12, 13, 14, 15, 16, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133,
    // 姫 (19体: 既存6 + 新規13)
    21, 22, 23, 24, 25, 26, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153,
    // 武将 (20体: 既存7 + 新規13)
    31, 32, 33, 34, 35, 36, 37, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173,
    // 豪族 (19体: 既存6 + 新規13)
    41, 42, 43, 44, 45, 46, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193,
    // 妖怪 (19体: 既存6 + 新規13)
    51, 52, 53, 54, 55, 56, 211, 212, 213, 214, 215, 216, 217, 218, 219, 220, 221, 222, 223,
    // エヴァ (3体)
    201, 202, 203,
    // 使徒 (3体)
    301, 302, 303
];

CHARA_IDS.forEach(id => {
    IMG_DATA[id] = `images/${id}.webp`;
});

// =============================================
// 定数・設定
// =============================================
const TYPES = [
    {id:0, name:'神',   label:'GOD',    icon:'🍑'},
    {id:1, name:'覇王', label:'LORD',   icon:'👑'},
    {id:2, name:'姫',   label:'HIME',   icon:'👸'},
    {id:3, name:'武将', label:'HERO',   icon:'⚔️'},
    {id:4, name:'豪族', label:'MECHA',  icon:'⚙️'},
    {id:5, name:'妖怪', label:'MONSTER',icon:'👻'}
];

const SHAPE = { 
    S1:{w:1,h:1,code:'S1x1',label:'1x1', grid:[1,0,0,0]}, 
    V2:{w:1,h:2,code:'V1x2',label:'縦2', grid:[1,0,1,0]}, 
    H2:{w:2,h:1,code:'H2x1',label:'横2', grid:[1,1,0,0]}, 
    L4:{w:2,h:2,code:'L2x2',label:'4枠', grid:[1,1,1,1]} 
};

// =============================================
// ★スキル定義 (効果を数値で可視化)
// =============================================
const SKILL = { 
    NONE:   {type:'NONE',   name:'-',       desc:'なし', charge:99}, 

    // --- 既存・専用攻撃スキル --- (charge: チャージ必要ターン数)
    MOMO_KICK: {type:'SMASH',  name:'鬼殺し',   pow:2.2, prob:0.95, charge:4, desc:'敵単体に#val#%ダメージ'}, 
    KIN_AXE:   {type:'LINE_V', name:'大木断ち', pow:1.4, prob:0.90, charge:4, desc:'縦一列に#val#%ダメージ'},
    ISSUN_NDL: {type:'SNIPE',  name:'針の一刺', pow:2.0, prob:1.0,  charge:3, desc:'HPが低い敵に#val#%ダメージ'},
    BISHAMON:  {type:'SNIPE_HIGH', name:'武神の理', pow:2.5, prob:1.0, charge:5, desc:'ATKが高い敵に#val#%ダメージ'},
    BENKEI:    {type:'CROSS',  name:'仁王立ち', pow:1.3, prob:0.90, charge:4, desc:'十字範囲に#val#%ダメージ'},
    NOBU_GUN:  {type:'MULTI',  name:'三段撃ち', count:3, pow:0.9, prob:0.85, charge:4, desc:'ランダム対象に#val#%×3回攻撃'},
    M_DRAGON:  {type:'SMASH',  name:'独眼竜',   pow:2.4, prob:0.95, charge:5, desc:'敵単体に#val#%ダメージ'},
    MAOU_BLAST:{type:'BLAST',  name:'第六天魔王', pow:1.6, prob:0.90, charge:5, desc:'敵全体に#val#%ダメージ'},
    SISTERS:   {type:'MULTI',  name:'三姉妹の絆', count:3, pow:0.8, prob:0.90, charge:4, desc:'ランダム対象に#val#%×3回攻撃'},
    MUSASHI:   {type:'MULTI',  name:'二天一流',  count:2, pow:1.4, prob:0.95, charge:4, desc:'ランダム対象に#val#%×2回攻撃'},
    KOJIRO:    {type:'SNIPE_HIGH',name:'燕返し', pow:2.2, prob:1.0, charge:4, desc:'ATKが高い敵に#val#%ダメージ'},
    IEYASU:    {type:'BLAST',  name:'大権現砲',  pow:1.5, prob:0.90, charge:5, desc:'敵全体に#val#%ダメージ'},
    URASHIMA:  {type:'LINE_H', name:'亀甲波',    pow:1.3, prob:0.95, charge:3, desc:'横一列に#val#%ダメージ'},
    FLY_BOY:   {type:'SNIPE',  name:'空爆',      pow:1.6, prob:0.90, charge:3, desc:'HPが低い敵に#val#%ダメージ'},
    KANSUKE:   {type:'LINE_V', name:'キツツキ',  pow:1.5, prob:0.95, charge:4, desc:'縦一列に#val#%ダメージ'},
    MOURI:     {type:'BLAST',  name:'百万一心',  pow:1.4, prob:0.95, charge:5, desc:'敵全体に#val#%ダメージ'},
    KITARO:    {type:'SNIPE',  name:'リモコン下駄', pow:1.7, prob:1.0, charge:3, desc:'HPが低い敵に#val#%ダメージ'},
    TORORO:    {type:'SMASH',  name:'のしかかり', pow:2.0, prob:0.90, charge:4, desc:'敵単体に#val#%ダメージ'},
    DAIDARA:   {type:'BLAST',  name:'天地返し',  pow:1.6, prob:0.90, charge:5, desc:'敵全体に#val#%ダメージ'},

    // --- 汎用攻撃系 (新規モブ用) ---
    ATK_NORMAL:{type:'SMASH',  name:'強撃',      pow:1.4, prob:0.95, charge:3, desc:'敵単体に#val#%ダメージ'},
    ATK_HEAVY: {type:'SMASH',  name:'粉砕撃',    pow:2.0, prob:0.85, charge:4, desc:'敵単体に#val#%ダメージ'},
    ATK_LINE_V:{type:'LINE_V', name:'貫通撃',    pow:1.3, prob:0.90, charge:3, desc:'縦一列に#val#%ダメージ'},
    ATK_LINE_H:{type:'LINE_H', name:'薙ぎ払い',  pow:1.2, prob:0.95, charge:3, desc:'横一列に#val#%ダメージ'},
    ATK_CROSS: {type:'CROSS',  name:'十字攻撃',  pow:1.2, prob:0.90, charge:3, desc:'十字範囲に#val#%ダメージ'},
    ATK_MULTI_2:{type:'MULTI', name:'乱れ撃ち',  count:2, pow:0.9, prob:0.90, charge:3, desc:'ランダム対象に#val#%×2回攻撃'},
    ATK_MULTI_3:{type:'MULTI', name:'百裂拳',    count:3, pow:0.8, prob:0.85, charge:4, desc:'ランダム対象に#val#%×3回攻撃'},
    SUICIDE:   {type:'BLAST',  name:'特攻自爆',  pow:2.5, prob:0.95, charge:5, desc:'敵全体に特大ダメージ(自身反動)'},

    // --- 回復・バフ系 ---
    OICHI_PRAY:{type:'HEAL',   name:'流転の祈り', pow:1.2, prob:1.0, charge:3, desc:'味方単体のHPを#val#%回復'},
    CHIHIRO:   {type:'HEAL',   name:'薬草',    pow:0.8, prob:1.0, charge:2, desc:'味方単体のHPを#val#%回復'},
    HEAL_MINI: {type:'HEAL',   name:'手当て',  pow:0.6, prob:1.0, charge:2, desc:'味方単体のHPを微回復'},
    HEAL_ALL:  {type:'HEAL_ALL',name:'癒やしの光',pow:0.8, prob:1.0, charge:3, desc:'味方全体のHPを#val#%回復'},
    JEANNE:    {type:'HEAL_ALL',name:'奇跡の旗', pow:0.9, prob:1.0, charge:5, desc:'味方全体のHPを#val#%回復'},
    HIDE_GOLD: {type:'BUFF_ALL',name:'黄金の茶室', val:1.3, prob:1.0, charge:5, desc:'味方全体のATK+#val_add#%(永続)'},
    BUFF_ATK:  {type:'BUFF',   name:'気合',    val:1.5, prob:1.0, charge:2, desc:'自身のATKをアップ'},
    BUFF_ATK_ALL:{type:'BUFF_ALL',name:'号令', val:1.2, prob:1.0, charge:3, desc:'味方全体のATKをアップ'},
    HIMIKO:    {type:'HEAL_BUFF',name:'鬼道',   pow:0.5, val:1.2, prob:1.0, charge:4, desc:'味方全体HP回復+ATK20%UP'},
    UJ_WALL:   {type:'DEF_BUFF_ALL', name:'小田原城', val:0.6, turns:3, prob:1.0, charge:4, desc:'味方全体の被ダメ-40%(3T)'},
    SHIELD_ALL:{type:'DEF_BUFF_ALL', name:'防壁展開', val:0.7, turns:3, prob:1.0, charge:3, desc:'味方全体の被ダメ-30%(3T)'},
    SPD_UP:    {type:'BUFF',   name:'神速の舞', val:1.5, prob:1.0, charge:2, desc:'味方単体のSPDアップ'},

    // --- 状態異常・デバフ系 ---
    SHUTEN:     {type:'STUN',  name:'鬼の宴',    pow:1.8, ailRate:0.70, prob:0.85, charge:4, desc:'単体に#val#%dmg+スタン(1T)'},
    STUN_ATK:   {type:'STUN',  name:'脳天割り',  pow:1.2, ailRate:0.60, prob:0.90, charge:3, desc:'単体にdmg+確率でスタン(1T)'},
    NOFACE:     {type:'SLEEP', name:'暴食の眠り', pow:0.8, ailRate:0.75, turns:2, prob:1.0, charge:4, desc:'敵単体にdmg+睡眠(2T)'},
    LULLABY:    {type:'SLEEP', name:'子守唄',     pow:0.5, ailRate:0.80, turns:2, prob:1.0, charge:3, desc:'敵単体にdmg+睡眠(2T)'},
    SLEEP_ALL:  {type:'SLEEP', name:'睡蓮の香り', pow:0.3, ailRate:0.50, turns:2, prob:0.90, charge:5, desc:'敵全体にdmg+確率睡眠(2T)'},
    THUNDER_PARA:{type:'PARALYZE', name:'10万ボルト', pow:1.0, count:3, ailRate:0.60, turns:3, prob:0.90, charge:4, desc:'ランダム3回dmg+麻痺(3T)'},
    ASITAKA:    {type:'PARALYZE', name:'呪いの矢', pow:1.5, ailRate:0.65, turns:3, prob:1.0, charge:4, desc:'敵単体にdmg+麻痺(3T)'},
    KANBEI:     {type:'BLIND_ALL', name:'水攻め', pow:0.6, ailRate:0.70, turns:3, prob:0.90, charge:4, desc:'敵全体にdmg+暗闇(3T)'},
    SMOKE:      {type:'BLIND', name:'煙幕',       pow:0.0, ailRate:0.80, turns:3, prob:1.0, charge:2, desc:'敵単体に暗闇(3T)'},
    BLIND_ALL:  {type:'BLIND_ALL',name:'宵闇',    pow:0.4, ailRate:0.60, turns:3, prob:0.90, charge:3, desc:'敵全体にdmg+暗闇(3T)'},
    HANBEI:     {type:'CONFUSE_ALL', name:'八門遁甲', pow:0.8, ailRate:0.55, turns:2, prob:0.90, charge:4, desc:'敵全体にdmg+混乱(2T)'},
    TRICK:      {type:'CONFUSE', name:'幻惑',      pow:0.6, ailRate:0.70, turns:2, prob:0.95, charge:3, desc:'敵単体にdmg+混乱(2T)'},
    VENOM:      {type:'POISON',    name:'猛毒の霧', pow:0.15, turns:3, prob:0.95, charge:3, desc:'敵単体に猛毒(3T)'},
    POISON_ATK: {type:'POISON',    name:'毒矢',     pow:1.0, turns:3, prob:0.95, charge:3, desc:'単体dmg+毒(3T)'},
    CURSE:      {type:'DEBUFF',    name:'呪縛',     val:0.6, turns:3, prob:1.0, charge:3, desc:'敵単体のATKダウン(3T)'},
    WAR_CRY:    {type:'DEBUFF_ALL',name:'威圧',     val:0.7, turns:2, prob:0.90, charge:4, desc:'敵全体のATKダウン(2T)'},
    VAMP_BITE:  {type:'VAMP', name:'吸血', pow:1.5, prob:1.0, charge:3, desc:'単体に#val#%dmg+HP吸収'},

    // --- チャージ干渉スキル (新規) ---
    CHARGE_BREAK:  {type:'CHARGE_DELAY', name:'封印の呪', delayTurns:2, prob:1.0, charge:3, desc:'敵単体のチャージを2T遅延'},
    CHARGE_BREAK_ALL:{type:'CHARGE_DELAY_ALL', name:'時空封印', delayTurns:1, prob:0.90, charge:5, desc:'敵全体のチャージを1T遅延'},
    CHARGE_BOOST:  {type:'CHARGE_ACCEL', name:'活力注入', accelTurns:2, prob:1.0, charge:3, desc:'味方単体のチャージを2T加速'},
    CHARGE_BOOST_ALL:{type:'CHARGE_ACCEL_ALL', name:'英霊招来', accelTurns:1, prob:1.0, charge:4, desc:'味方全体のチャージを1T加速'},

    // --- エヴァ・使徒・その他専用 ---
    AURORA_BEAM: {type:'LINE_H', name:'オーロラ光線', pow:1.5, prob:0.95, charge:5, desc:'横一列に氷撃'},
    HYPER_BEAM:  {type:'SMASH',  name:'破壊光線',    pow:2.8, prob:0.90, charge:6, desc:'敵単体に超絶ダメージ'},
    FIRE_BLAST:  {type:'CROSS',  name:'大文字焼き',  pow:1.6, prob:0.90, charge:5, desc:'十字範囲に炎ダメージ'},
    HYDRO_CAN:   {type:'LINE_V', name:'ハイドロカノン', pow:1.8, prob:0.90, charge:5, desc:'縦一列に水流ダメージ'},
    PSY_STRIKE:  {type:'BLAST',  name:'サイコブレイク', pow:1.9, prob:1.0, charge:6, desc:'敵全体に精神ダメージ'},
    EVA_01_ROAR: {type: 'STUN', name: '咆哮', pow: 2.8, ailRate: 0.90, prob: 0.90, charge: 6, desc: '単体を蹂躙し高確率スタン'},
    EVA_02_ASSAULT: {type: 'MULTI', name: 'ニードルガン連射', count: 5, pow: 1.0, prob: 0.90, charge: 5, desc: 'ランダム5回攻撃'},
    EVA_00_SHIELD: {type: 'DEF_BUFF_ALL', name: 'A.T.フィールド全開', val: 0.3, turns: 3, prob: 1.0, charge: 5, desc: '味方全体の被ダメ70%カット'},
    ANGEL_SNIPE: {type:'SNIPE_HIGH', name:'加粒子砲', pow:3.0, prob:1.0, charge:6, desc:'ATK最大の敵を狙撃'},
    ANGEL_BLAST: {type:'BLAST', name:'光帯攻撃', pow:2.2, prob:0.90, charge:6, desc:'対象と周囲をなぎ払う'},
    ANGEL_PILE:  {type:'SPLASH', name:'光のパイル', pow:1.8, prob:0.95, charge:5, desc:'十字状にエネルギー炸裂'}
};

// =============================================
// ★パッシブ特性定義
// =============================================
const PASSIVE = { 
    NONE: null, 
    P_GOD:  {type:'BUFF_RACE', target:0, stat:'atk', val:1.25, name:'神の加護', desc:'味方[神]ATK+25%'}, 
    P_DEV:  {type:'BUFF_RACE', target:1, stat:'atk', val:1.25, name:'覇道の理', desc:'味方[覇]ATK+25%'}, 
    P_SPI:  {type:'BUFF_RACE', target:2, stat:'atk', val:1.25, name:'姫の祈り', desc:'味方[姫]ATK+25%'}, 
    P_HUM:  {type:'BUFF_RACE', target:3, stat:'atk', val:1.25, name:'武士の魂', desc:'味方[将]ATK+25%'}, 
    P_ROB:  {type:'BUFF_RACE', target:4, stat:'atk', val:1.25, name:'機巧陣形', desc:'味方[豪]ATK+25%'}, 
    P_MON:  {type:'BUFF_RACE', target:5, stat:'atk', val:1.25, name:'百鬼夜行', desc:'味方[妖]ATK+25%'}, 
    
    REGEN:  {type:'REGEN', val:0.15, name:'自動回復', desc:'毎T、HP15%回復'},
    GUTS:   {type:'GUTS', val:1, name:'ド根性', desc:'致死Dmg時、一度だけ耐える'},
    COUNTER:{type:'COUNTER', val:0.5, name:'迎撃', desc:'被弾時50%で反撃'},
    AVENGER:{type:'AVENGER', val:0.5, name:'復讐', desc:'味方が倒れるとATK大幅UP'},
    BERSERK:{type:'BERSERK', val:0.1, name:'狂戦士', desc:'攻撃する度ATK10%UP'},
    DODGE:  {type:'DODGE', val:0.30, name:'見切り', desc:'30%で攻撃を回避'},
    AGILE:  {type:'DODGE', val:0.50, name:'神速', desc:'50%で攻撃を回避'}, // 新規: 高確率回避
    
    SSR_REGEN: {type:'REGEN', val:0.25, name:'不滅の体', desc:'毎T、HP25%回復'},
    SSR_MIGHTY:{type:'BUFF_RACE', target:null, stat:'atk', val:1.5, name:'単独最強', desc:'自身のATK常時1.5倍'},
    WOLF_PACK:{type:'WOLF_PACK', val:0.15, name:'群狼', desc:'味方にコスト1-2が3体以上でATK+15%'},

    IRON_WILL:  {type:'STATUS_RESIST', resist:0.50, name:'鉄の意志', desc:'状態異常耐性50%'},
    CLARITY:    {type:'STATUS_RESIST', resist:0.35, name:'明鏡止水', desc:'状態異常耐性35%'},
    PURIFY:     {type:'STATUS_RESIST', resist:1.00, name:'浄化', desc:'状態異常完全無効'},
    TENACITY:   {type:'STATUS_RESIST', resist:0.40, name:'不屈', desc:'状態異常耐性40%'},

    EVA_01_PASSIVE: {type: 'EVA_RAMPAGE', val: 0, name: 'ユイの魂', desc: '致死Dmg時に暴走(復活&ATK3倍)' },
    EVA_02_PASSIVE: {type: 'BERSERK', val: 0.20, name: 'アスカのプライド', desc: '攻撃毎ATK20%UP+会心率UP' },
    EVA_00_PASSIVE: {type: 'STATUS_RESIST', resist: 1.0, name: '綾波レイ', desc: '状態異常無効+毎T HP10%回復' }
};

// =============================================
// ★限界突破(LB)テーブル (下克上システム)
// =============================================
const LB_TEMPLATES = {
    LOW_COST: [
        { lv:1, type:'STAT', stat:'hp', val:1.8, txt:'HP+80%(覚醒)' },
        { lv:2, type:'STAT', stat:'atk', val:1.8, txt:'ATK+80%(覚醒)' },
        { lv:3, type:'SKILL_BOOST', val:2.0, txt:'スキル威力2倍' },
        { lv:4, type:'STATUS_RESIST', val:0.50, txt:'状態異常耐性50%' },
        { lv:5, type:'PASSIVE', code:'GIANT_KILLER', val:2.5, txt:'下克上(対高コスト特効)' }
    ],
    MID_COST: [
        { lv:1, type:'STAT', stat:'hp', val:1.4, txt:'HP+40%' },
        { lv:2, type:'STAT', stat:'atk', val:1.4, txt:'ATK+40%' },
        { lv:3, type:'PASSIVE', code:'CRIT_UP', val:0.5, txt:'会心率+50%' },
        { lv:4, type:'STATUS_RESIST', val:0.40, txt:'状態異常耐性40%' },
        { lv:5, type:'PASSIVE', code:'DODGE', val:0.4, txt:'見切り(回避40%)' }
    ],
    HIGH_COST: [
        { lv:1, type:'STAT', stat:'hp', val:1.2, txt:'HP+20%' },
        { lv:2, type:'STAT', stat:'atk', val:1.2, txt:'ATK+20%' },
        { lv:3, type:'SKILL_BOOST', val:1.5, txt:'スキル威力1.5倍' },
        { lv:4, type:'STATUS_RESIST', val:0.60, txt:'状態異常耐性60%' },
        { lv:5, type:'PASSIVE', code:'GUTS_EX', val:1, txt:'超根性(復活)' }
    ]
};

const LB_EVA = [
    { lv:1, type:'STAT', stat:'hp', val:1.5, txt:'HP+50%' },
    { lv:2, type:'STAT', stat:'atk', val:1.5, txt:'ATK+50%' },
    { lv:3, type:'SKILL_BOOST', val:1.5, txt:'スキル威力1.5倍' },
    { lv:4, type:'STATUS_RESIST', val:1.0, txt:'状態異常無効' }, 
    { lv:5, type:'PASSIVE', code:'GUTS_EX', val:1, txt:'再起動(復活)' } 
];

const LB_EVA_01 = [
    { lv:1, type:'STAT', stat:'atk', val:1.5, txt:'ATK+50%' },
    { lv:2, type:'STAT', stat:'hp', val:1.5, txt:'HP+50%' },
    { lv:3, type:'PASSIVE', code:'CRIT_UP', val:0.5, txt:'暴走準備(会心率UP)' },
    { lv:4, type:'SKILL_BOOST', val:1.8, txt:'スキル威力1.8倍' },
    { lv:5, type:'STAT', stat:'atk', val:2.0, txt:'シンクロ率400%(ATK倍化)' }
];

const make = (id, name, type, shape, cost, hp, atk, spd, skill=SKILL.NONE, passive=PASSIVE.NONE) => ({id, name, type, shape, cost, hp, atk, spd, skill, passive});

// =============================================
// ★キャラクターデータベース (全121体)
// =============================================
const DB = [
    // ---------------------------------------------
    // 0:神 (GOD) - 19体
    // ---------------------------------------------
    make(1, "桃太郎", 0, SHAPE.S1, 3, 280, 65, 14, SKILL.MOMO_KICK, PASSIVE.P_GOD),
    make(2, "金太郎", 0, SHAPE.V2, 5, 650, 110, 10, SKILL.KIN_AXE, PASSIVE.GUTS), 
    make(3, "一寸法師", 0, SHAPE.S1, 2, 120, 45, 22, SKILL.ISSUN_NDL, PASSIVE.DODGE), 
    make(4, "毘沙門・謙信", 0, SHAPE.L4, 9, 1100, 190, 13, SKILL.BISHAMON, PASSIVE.IRON_WILL),
    make(5, "牛若＆弁慶", 0, SHAPE.H2, 4, 380, 85, 16, SKILL.BENKEI, PASSIVE.COUNTER), 
    make(6, "スイクン", 0, SHAPE.H2, 5, 750, 90, 18, SKILL.AURORA_BEAM, PASSIVE.SSR_REGEN),
    // 神 - 新規(13体)
    make(101, "お地蔵様", 0, SHAPE.S1, 1, 110, 20, 12, SKILL.HEAL_MINI, PASSIVE.WOLF_PACK),
    make(102, "神社の使い(烏)", 0, SHAPE.S1, 1, 90, 30, 20, SKILL.SMOKE, PASSIVE.DODGE),
    make(103, "狛犬・阿", 0, SHAPE.S1, 1, 120, 40, 14, SKILL.ATK_NORMAL, PASSIVE.WOLF_PACK),
    make(104, "白狐", 0, SHAPE.S1, 1, 100, 35, 18, SKILL.ATK_NORMAL, PASSIVE.AGILE),
    make(105, "狛犬・吽", 0, SHAPE.S1, 2, 160, 45, 13, SKILL.SHIELD_ALL, PASSIVE.COUNTER),
    make(106, "雲の精霊", 0, SHAPE.S1, 2, 140, 25, 16, SKILL.HEAL_ALL, PASSIVE.DODGE),
    make(107, "天女の付き人", 0, SHAPE.S1, 2, 130, 20, 17, SKILL.HEAL_MINI, PASSIVE.P_GOD),
    make(108, "若き神官", 0, SHAPE.S1, 2, 150, 30, 15, SKILL.CHARGE_BOOST, PASSIVE.TENACITY),
    make(109, "かぐや姫の使者", 0, SHAPE.S1, 3, 220, 50, 19, SKILL.LULLABY, PASSIVE.CLARITY),
    make(110, "浦島太郎の亀", 0, SHAPE.H2, 3, 400, 40, 8, SKILL.SHIELD_ALL, PASSIVE.IRON_WILL),
    make(111, "アマビエ", 0, SHAPE.S1, 3, 240, 60, 15, SKILL.HEAL_ALL, PASSIVE.PURIFY),
    make(112, "恵比寿様", 0, SHAPE.S1, 3, 250, 55, 14, SKILL.BUFF_ATK_ALL, PASSIVE.P_GOD),
    make(113, "大黒天", 0, SHAPE.V2, 3, 300, 80, 12, SKILL.ATK_HEAVY, PASSIVE.P_GOD),

    // ---------------------------------------------
    // 1:覇王 (LORD) - 19体
    // ---------------------------------------------
    make(11, "鉄砲・信長", 1, SHAPE.S1, 4, 320, 95, 15, SKILL.NOBU_GUN, PASSIVE.BERSERK), 
    make(12, "千成・秀吉", 1, SHAPE.S1, 3, 250, 60, 18, SKILL.HIDE_GOLD, PASSIVE.AVENGER),
    make(13, "眼帯・政宗", 1, SHAPE.V2, 5, 620, 130, 14, SKILL.M_DRAGON, PASSIVE.P_DEV), 
    make(14, "第六天魔王", 1, SHAPE.L4, 10, 1300, 220, 8, SKILL.MAOU_BLAST, PASSIVE.TENACITY), 
    make(15, "お市の方", 1, SHAPE.S1, 2, 180, 30, 12, SKILL.OICHI_PRAY, PASSIVE.WOLF_PACK), 
    make(16, "カイリュー", 1, SHAPE.L4, 7, 1100, 160, 12, SKILL.HYPER_BEAM, PASSIVE.GUTS),
    // 覇王 - 新規(13体)
    make(121, "長槍足軽", 1, SHAPE.V2, 1, 130, 35, 10, SKILL.ATK_LINE_V, PASSIVE.WOLF_PACK),
    make(122, "弓足軽", 1, SHAPE.S1, 1, 100, 40, 14, SKILL.ISSUN_NDL, PASSIVE.DODGE),
    make(123, "狂信者", 1, SHAPE.S1, 1, 80, 60, 18, SKILL.SUICIDE, PASSIVE.BERSERK),
    make(124, "盗賊の下っ端", 1, SHAPE.S1, 1, 110, 35, 16, SKILL.CURSE, PASSIVE.WOLF_PACK),
    make(125, "鉄砲隊", 1, SHAPE.H2, 2, 160, 50, 12, SKILL.ATK_MULTI_3, PASSIVE.P_DEV),
    make(126, "騎馬兵", 1, SHAPE.S1, 2, 150, 45, 19, SKILL.ATK_LINE_H, PASSIVE.AGILE),
    make(127, "海賊兵", 1, SHAPE.S1, 2, 170, 55, 14, SKILL.ATK_NORMAL, PASSIVE.BERSERK),
    make(128, "影の忍者", 1, SHAPE.S1, 2, 120, 40, 22, SKILL.POISON_ATK, PASSIVE.DODGE),
    make(129, "足軽大将", 1, SHAPE.S1, 3, 260, 70, 15, SKILL.BUFF_ATK_ALL, PASSIVE.WOLF_PACK),
    make(130, "鉄砲頭", 1, SHAPE.S1, 3, 240, 85, 16, SKILL.ATK_HEAVY, PASSIVE.DODGE),
    make(131, "騎馬隊長", 1, SHAPE.V2, 3, 290, 80, 20, SKILL.ATK_LINE_V, PASSIVE.P_DEV),
    make(132, "悪徳代官", 1, SHAPE.S1, 3, 270, 65, 13, SKILL.WAR_CRY, PASSIVE.CLARITY),
    make(133, "野盗の首領", 1, SHAPE.S1, 3, 280, 75, 18, SKILL.VAMP_BITE, PASSIVE.BERSERK),

    // ---------------------------------------------
    // 2:姫 (HIME) - 19体
    // ---------------------------------------------
    make(21, "卑弥呼", 2, SHAPE.S1, 3, 260, 80, 12, SKILL.HIMIKO, PASSIVE.P_SPI),
    make(22, "旅人チヒロ", 2, SHAPE.S1, 1, 100, 25, 20, SKILL.CHIHIRO, PASSIVE.DODGE),
    make(23, "山守の姫", 2, SHAPE.S1, 4, 350, 70, 16, SKILL.HEAL_ALL, PASSIVE.REGEN),
    make(24, "浅井三姉妹", 2, SHAPE.H2, 5, 550, 90, 14, SKILL.SISTERS, PASSIVE.P_SPI),
    make(25, "聖女ジャンヌ", 2, SHAPE.V2, 6, 800, 70, 10, SKILL.JEANNE, PASSIVE.PURIFY), 
    make(26, "ミュウツー", 2, SHAPE.V2, 9, 850, 220, 20, SKILL.PSY_STRIKE, PASSIVE.SSR_MIGHTY),
    // 姫 - 新規(13体)
    make(141, "町娘", 2, SHAPE.S1, 1, 90, 15, 14, SKILL.HEAL_MINI, PASSIVE.WOLF_PACK),
    make(142, "村の子供", 2, SHAPE.S1, 1, 80, 10, 22, SKILL.SPD_UP, PASSIVE.AGILE),
    make(143, "茶屋の看板娘", 2, SHAPE.S1, 1, 100, 20, 16, SKILL.BUFF_ATK, PASSIVE.P_SPI),
    make(144, "見習い巫女", 2, SHAPE.S1, 1, 110, 25, 15, SKILL.HEAL_MINI, PASSIVE.DODGE),
    make(145, "侍女", 2, SHAPE.S1, 2, 130, 30, 14, SKILL.HEAL_ALL, PASSIVE.P_SPI),
    make(146, "踊り子", 2, SHAPE.S1, 2, 140, 35, 19, SKILL.WAR_CRY, PASSIVE.DODGE),
    make(147, "くノ一", 2, SHAPE.S1, 2, 120, 45, 21, SKILL.LULLABY, PASSIVE.AGILE),
    make(148, "琵琶法師(女)", 2, SHAPE.S1, 2, 150, 25, 13, SKILL.CHARGE_BREAK, PASSIVE.CLARITY),
    make(149, "御局様", 2, SHAPE.S1, 3, 260, 50, 12, SKILL.CHARGE_BREAK_ALL, PASSIVE.IRON_WILL),
    make(150, "舞妓", 2, SHAPE.S1, 3, 220, 40, 15, SKILL.HEAL_ALL, PASSIVE.P_SPI),
    make(151, "男装の麗人", 2, SHAPE.S1, 3, 280, 75, 18, SKILL.BUFF_ATK, PASSIVE.COUNTER),
    make(152, "花魁", 2, SHAPE.H2, 3, 250, 60, 14, SKILL.HANBEI, PASSIVE.TENACITY),
    make(153, "琴の奏者", 2, SHAPE.S1, 3, 230, 55, 16, SKILL.SLEEP_ALL, PASSIVE.P_SPI),

    // ---------------------------------------------
    // 3:武将 (HERO) - 20体
    // ---------------------------------------------
    make(31, "二刀流・武蔵", 3, SHAPE.S1, 4, 340, 110, 16, SKILL.MUSASHI, PASSIVE.COUNTER), 
    make(32, "燕返し小次郎", 3, SHAPE.S1, 3, 290, 100, 19, SKILL.KOJIRO, PASSIVE.CLARITY), 
    make(33, "旅人アシタカ", 3, SHAPE.S1, 4, 310, 85, 15, SKILL.ASITAKA, PASSIVE.P_HUM),
    make(34, "鉄壁・氏康", 3, SHAPE.S1, 3, 600, 60, 6, SKILL.UJ_WALL, PASSIVE.IRON_WILL), 
    make(35, "黄金・家康", 3, SHAPE.L4, 8, 1200, 160, 9, SKILL.IEYASU, PASSIVE.AVENGER), 
    make(36, "浦島太郎", 3, SHAPE.S1, 2, 160, 50, 15, SKILL.URASHIMA, PASSIVE.WOLF_PACK), 
    make(37, "ピカチュウ", 3, SHAPE.S1, 3, 220, 95, 24, SKILL.THUNDER_PARA, PASSIVE.DODGE),
    // 武将 - 新規(13体)
    make(161, "はぐれ浪人", 3, SHAPE.S1, 1, 120, 40, 14, SKILL.ATK_NORMAL, PASSIVE.COUNTER),
    make(162, "道場の門下生", 3, SHAPE.S1, 1, 130, 35, 12, SKILL.ATK_NORMAL, PASSIVE.WOLF_PACK),
    make(163, "落ち武者", 3, SHAPE.S1, 1, 140, 30, 10, SKILL.ATK_NORMAL, PASSIVE.GUTS),
    make(164, "伝令兵", 3, SHAPE.S1, 1, 100, 20, 22, SKILL.SPD_UP, PASSIVE.DODGE),
    make(165, "新選組 平隊士", 3, SHAPE.S1, 2, 160, 55, 16, SKILL.ISSUN_NDL, PASSIVE.WOLF_PACK),
    make(166, "辻斬り", 3, SHAPE.S1, 2, 150, 60, 18, SKILL.POISON_ATK, PASSIVE.BERSERK),
    make(167, "弓の達人", 3, SHAPE.S1, 2, 140, 50, 17, SKILL.SMOKE, PASSIVE.CLARITY),
    make(168, "槍術士", 3, SHAPE.V2, 2, 180, 45, 13, SKILL.ATK_LINE_V, PASSIVE.P_HUM),
    make(169, "新選組 伍長", 3, SHAPE.H2, 3, 270, 75, 16, SKILL.ATK_LINE_H, PASSIVE.AVENGER),
    make(170, "剣豪の弟子", 3, SHAPE.S1, 3, 250, 85, 18, SKILL.BISHAMON, PASSIVE.COUNTER),
    make(171, "剣術師範", 3, SHAPE.S1, 3, 300, 65, 12, SKILL.SHIELD_ALL, PASSIVE.IRON_WILL),
    make(172, "槍騎兵", 3, SHAPE.V2, 3, 280, 80, 19, SKILL.ATK_HEAVY, PASSIVE.P_HUM),
    make(173, "影武者", 3, SHAPE.S1, 3, 320, 40, 15, SKILL.UJ_WALL, PASSIVE.GUTS),

    // ---------------------------------------------
    // 4:豪族 (MECHA) - 19体
    // ---------------------------------------------
    make(41, "飛行少年", 4, SHAPE.S1, 1, 110, 45, 21, SKILL.FLY_BOY, PASSIVE.DODGE),
    make(42, "竹中半兵衛", 4, SHAPE.H2, 4, 360, 95, 13, SKILL.HANBEI, PASSIVE.P_ROB), 
    make(43, "山本勘助", 4, SHAPE.V2, 5, 600, 105, 10, SKILL.KANSUKE, PASSIVE.CLARITY),
    make(44, "毛利元就", 4, SHAPE.L4, 9, 1150, 190, 7, SKILL.MOURI, PASSIVE.BERSERK), 
    make(45, "黒田官兵衛", 4, SHAPE.S1, 3, 280, 88, 12, SKILL.KANBEI, PASSIVE.TENACITY), 
    make(46, "リザードン", 4, SHAPE.V2, 5, 580, 140, 16, SKILL.FIRE_BLAST, PASSIVE.BERSERK),
    // 豪族 - 新規(13体)
    make(181, "木っ端からくり", 4, SHAPE.S1, 1, 90, 50, 15, SKILL.SUICIDE, PASSIVE.WOLF_PACK),
    make(182, "ゼンマイ歩兵", 4, SHAPE.S1, 1, 120, 35, 11, SKILL.ATK_NORMAL, PASSIVE.P_ROB),
    make(183, "補給兵", 4, SHAPE.S1, 1, 110, 20, 14, SKILL.HEAL_MINI, PASSIVE.DODGE),
    make(184, "飛脚", 4, SHAPE.S1, 1, 100, 25, 24, SKILL.SPD_UP, PASSIVE.AGILE),
    make(185, "からくり弓兵", 4, SHAPE.H2, 2, 160, 45, 14, SKILL.ATK_MULTI_2, PASSIVE.P_ROB),
    make(186, "観測気球", 4, SHAPE.S1, 2, 140, 30, 18, SKILL.CHARGE_BOOST_ALL, PASSIVE.CLARITY),
    make(187, "見習い発明家", 4, SHAPE.S1, 2, 130, 40, 16, SKILL.SMOKE, PASSIVE.DODGE),
    make(188, "樽爆弾", 4, SHAPE.S1, 2, 110, 70, 10, SKILL.ATK_CROSS, PASSIVE.BERSERK),
    make(189, "大筒からくり", 4, SHAPE.H2, 3, 260, 85, 11, SKILL.ATK_LINE_H, PASSIVE.IRON_WILL),
    make(190, "からくり鳥", 4, SHAPE.S1, 3, 240, 60, 21, SKILL.BLIND_ALL, PASSIVE.AGILE),
    make(191, "天才発明家", 4, SHAPE.S1, 3, 250, 55, 16, SKILL.HIDE_GOLD, PASSIVE.TENACITY),
    make(192, "装甲馬車", 4, SHAPE.V2, 3, 350, 50, 12, SKILL.SHIELD_ALL, PASSIVE.IRON_WILL),
    make(193, "絡繰り武者", 4, SHAPE.S1, 3, 280, 80, 14, SKILL.STUN_ATK, PASSIVE.P_ROB),

    // ---------------------------------------------
    // 5:妖怪 (MONSTER) - 19体
    // ---------------------------------------------
    make(51, "鬼太郎", 5, SHAPE.S1, 3, 270, 75, 16, SKILL.KITARO, PASSIVE.REGEN),
    make(52, "カオナシ", 5, SHAPE.S1, 2, 220, 60, 8, SKILL.NOFACE, PASSIVE.WOLF_PACK),
    make(53, "里主トロロ", 5, SHAPE.H2, 6, 900, 120, 10, SKILL.TORORO, PASSIVE.SSR_REGEN),
    make(54, "酒呑童子", 5, SHAPE.V2, 5, 680, 140, 11, SKILL.SHUTEN, PASSIVE.BERSERK),
    make(55, "ダイダラボッチ", 5, SHAPE.L4, 10, 1600, 250, 5, SKILL.DAIDARA, PASSIVE.P_MON),
    make(56, "カメックス", 5, SHAPE.L4, 6, 1200, 110, 8, SKILL.HYDRO_CAN, PASSIVE.COUNTER),
    // 妖怪 - 新規(13体)
    make(211, "鬼火", 5, SHAPE.S1, 1, 100, 45, 16, SKILL.ATK_NORMAL, PASSIVE.BERSERK),
    make(212, "からかさ小僧", 5, SHAPE.S1, 1, 110, 30, 18, SKILL.ATK_NORMAL, PASSIVE.AGILE),
    make(213, "一つ目小僧", 5, SHAPE.S1, 1, 120, 35, 14, SKILL.STUN_ATK, PASSIVE.WOLF_PACK),
    make(214, "提灯お化け", 5, SHAPE.S1, 1, 90, 40, 15, SKILL.SMOKE, PASSIVE.DODGE),
    make(215, "小豆洗い", 5, SHAPE.S1, 2, 140, 45, 17, SKILL.ISSUN_NDL, PASSIVE.P_MON),
    make(216, "化け猫", 5, SHAPE.S1, 2, 130, 50, 20, SKILL.TRICK, PASSIVE.AGILE),
    make(217, "泥田坊", 5, SHAPE.V2, 2, 170, 40, 10, SKILL.WAR_CRY, PASSIVE.REGEN),
    make(218, "垢舐め", 5, SHAPE.S1, 2, 150, 40, 16, SKILL.POISON_ATK, PASSIVE.DODGE),
    make(219, "河童の頭領", 5, SHAPE.V2, 3, 270, 75, 15, SKILL.ATK_LINE_V, PASSIVE.REGEN),
    make(220, "鎌鼬", 5, SHAPE.H2, 3, 240, 80, 23, SKILL.ATK_MULTI_3, PASSIVE.AGILE),
    make(221, "塗壁", 5, SHAPE.V2, 3, 400, 30, 8, SKILL.SHIELD_ALL, PASSIVE.IRON_WILL),
    make(222, "子泣き爺", 5, SHAPE.S1, 3, 260, 60, 12, SKILL.CURSE, PASSIVE.TENACITY),
    make(223, "砂かけ婆", 5, SHAPE.S1, 3, 250, 55, 14, SKILL.BLIND_ALL, PASSIVE.P_MON),

    // ---------------------------------------------
    // エヴァンゲリオン (SSR級)
    // ---------------------------------------------
    make(201, "EVA初号機", 4, SHAPE.S1, 8, 1100, 240, 18, SKILL.EVA_01_ROAR, PASSIVE.EVA_01_PASSIVE),
    make(202, "EVA零号機", 0, SHAPE.S1, 7, 1800, 80, 12, SKILL.EVA_00_SHIELD, PASSIVE.EVA_00_PASSIVE),
    make(203, "EVA2号機", 1, SHAPE.S1, 7, 900, 280, 24, SKILL.EVA_02_ASSAULT, PASSIVE.EVA_02_PASSIVE),

    // ---------------------------------------------
    // 使徒 (Boss級)
    // ---------------------------------------------
    make(301, "第6の使徒", 5, SHAPE.L4, 9, 1500, 240, 10, SKILL.ANGEL_SNIPE, PASSIVE.COUNTER),
    make(302, "第10の使徒", 5, SHAPE.V2, 10, 1800, 260, 15, SKILL.ANGEL_BLAST, PASSIVE.PURIFY),
    make(303, "第4の使徒", 5, SHAPE.S1, 8, 1300, 180, 16, SKILL.ANGEL_PILE, PASSIVE.REGEN)
];