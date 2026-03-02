/**
 * panel_battle_enemies.js
 * パネルバトルで使用する敵テンプレート定義。
 *
 * 方針:
 * - DB(実装済みキャラ30体)が存在する場合は、それを敵テンプレートに変換して使用。
 * - DBが未ロード時のみフォールバックとして従来の専用敵を利用。
 */

const LEGACY_PANEL_BATTLE_ENEMIES = [
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

function clampPanelEnemyValue(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function buildPanelEnemyPattern(chara) {
    const pattern = [];
    const def = Number(chara.def || (chara.stats && chara.stats.def) || 0);
    const res = Number(chara.res || (chara.stats && chara.stats.res) || 0);
    const atk = Number(chara.atk || (chara.stats && chara.stats.atk) || 0);
    const hp = Number(chara.hp || (chara.stats && chara.stats.hp) || 0);

    // 行動1: 基本は通常攻撃から入る
    pattern.push({ action: 'attack', power: 1.0, label: '通常攻撃' });

    // 行動2: 攻撃力が高い場合は大技を組み込む
    if (atk >= 120) {
        pattern.push({ action: 'heavy', power: 1.75, label: '強打' });
    } else {
        pattern.push({ action: 'attack', power: 1.0, label: '通常攻撃' });
    }

    // 行動3: 物理防御が高い場合は「ガード → すぐ反撃」のコンボ
    if (def >= 90) {
        pattern.push({ action: 'guard_phys', label: '物理ガード' });
        pattern.push({ action: 'heavy', power: 1.3, label: 'シールドバッシュ' });
    }

    // 行動4: HPが高い場合は吸収攻撃
    if (hp >= 520) {
        pattern.push({ action: 'drain', power: 0.95, healRate: 0.55, label: '吸収攻撃' });
    }

    // 行動5: 魔法防御が高い場合は「魔法ガード → すぐ反撃」のコンボ
    if (res >= 90) {
        pattern.push({ action: 'guard_magic', label: '魔法ガード' });
        pattern.push({ action: 'heavy', power: 1.3, label: 'マジックバースト' });
    }

    return pattern;
}

function normalizePanelEnemySpriteSheet(asset) {
    if (!asset || typeof asset !== 'object') return null;
    const src = String(asset.src || asset.url || '').trim();
    const cols = Math.max(1, Math.floor(Number(asset.cols || asset.columns || asset.col || 1)));
    const requestedFrames = Math.max(1, Math.floor(Number(asset.frames || asset.frame || asset.frameCount || (cols || 1))));
    const rowsFromAsset = Math.floor(Number(asset.rows || asset.row || 0));
    const rows = Math.max(1, rowsFromAsset > 0 ? rowsFromAsset : Math.ceil(requestedFrames / cols));
    const totalFrames = Math.max(1, cols * rows);
     const frames = Math.max(1, Math.min(totalFrames, requestedFrames));
    const fps = Math.max(1, Math.floor(Number(asset.fps || asset.speed || asset.frameRate || 8)));
    if (!src) return null;
    return {
        src,
        cols,
        rows,
        frames,
        fps,
        loop: asset.loop !== false
    };
}


function buildPanelEnemyFromCharacter(chara) {
    const elementEmoji = {
        fire: '🔥',
        water: '💧',
        grass: '🌿',
        dark: '🌑',
        light: '✨',
        neutral: '⚪'
    };

    const rawHp = Number(chara.hp || (chara.stats && chara.stats.hp) || 200);
    const rawAtk = Number(chara.atk || (chara.stats && chara.stats.atk) || 40);
    const rawDef = Number(chara.def || (chara.stats && chara.stats.def) || 40);
    const rawRes = Number(chara.res || (chara.stats && chara.stats.res) || 40);
    const rawSpd = Number(chara.spd || (chara.stats && chara.stats.spd) || 40);
    const rawBst = Number(chara.bst || 300);

    const resistPhys = clampPanelEnemyValue((rawDef - 60) / 220, -0.35, 0.45);
    const resistMagic = clampPanelEnemyValue((rawRes - 60) / 220, -0.35, 0.45);

    const imageAsset = (typeof IMG_DATA !== 'undefined' && IMG_DATA) ? IMG_DATA[chara.id] : '';
    const spriteSheet = normalizePanelEnemySpriteSheet(imageAsset);
    const imageUrl = typeof imageAsset === 'string'
        ? imageAsset
        : ((spriteSheet && spriteSheet.src) ? spriteSheet.src : '');

    return {
        id: `db_${chara.id}`,
        name: chara.name,
        emoji: elementEmoji[chara.element] || '👾',
        imageUrl,
        spriteSheet,
        hp: Math.max(90, Math.floor(rawHp * 0.34)),
        atk: Math.max(10, Math.floor(rawAtk * 0.42)),
        resistPhys,
        resistMagic,
        actionInterval: rawSpd >= 95 ? 1 : (rawSpd <= 35 ? 3 : 2),
        pattern: buildPanelEnemyPattern(chara),
        expBase: Math.max(20, Math.floor(rawBst * 0.08)),
        goldBase: Math.max(35, Math.floor(rawBst * 0.11))
    };
}

const PANEL_BATTLE_ENEMIES = (typeof DB !== 'undefined' && Array.isArray(DB) && DB.length > 0)
    ? DB.map(buildPanelEnemyFromCharacter)
    : LEGACY_PANEL_BATTLE_ENEMIES;