/**
 * managers.js - 各種マネージャー（Unit, DataManager, SceneManager, DeckManager関係）
 */

class Unit {
    constructor(baseData, saveData) {
        this.base = baseData;
        this.save = saveData || { 
            uid: Date.now() + Math.random(), 
            unitId: baseData.id,
            lv: 1, maxLv: 50, skillLv: 1, exp: 0,
            createTime: Date.now(),
            isLocked: false
        };
        this.isLocked = !!this.save.isLocked;
        this.uid = this.save.uid;
        this.lbCount = Math.floor((this.save.maxLv - 50) / 5);
        this.passives = [];
        this.calcStats();
    }

    calcStats() {
        // ★v2: 5ステータス体系 (HP/ATK/DEF/SPD/RES)
        // BST基準の成長率: 低BSTほどレベルで伸びやすい
        const bst = this.base.bst || 300;
        let growthPerLv = 0.03;
        if (bst <= 340 || this.base.cost <= 2) growthPerLv = 0.05;
        else if (bst <= 520 || this.base.cost <= 4) growthPerLv = 0.04;
        const mul = 1 + growthPerLv * (this.save.lv - 1);

        const baseHp  = (this.base.stats && this.base.stats.hp)  || this.base.hp  || 100;
        const baseAtk = (this.base.stats && this.base.stats.atk) || this.base.atk || 50;
        const baseDef = (this.base.stats && this.base.stats.def) || this.base.def || 30;
        const baseSpd = (this.base.stats && this.base.stats.spd) || this.base.spd || 10;
        const baseRes = (this.base.stats && this.base.stats.res) || this.base.res || 30;

        this.maxHp = Math.floor(baseHp * mul);
        this.atk   = Math.floor(baseAtk * mul);
        this.def   = Math.floor(baseDef * mul);
        this.spd   = baseSpd;
        this.res   = Math.floor(baseRes * mul);

        // =================================================
        // ★修正: スキルレベル依存の倍率計算 (タイプ別強化)
        // =================================================
        let growthRate = 0.02; // デフォルト 2%

        if (this.base.skill) {
            const t = this.base.skill.type;

            // 1. 単体・特化系 (強撃, 狙撃, 強敵狙い, 吸血, 暗殺, スタン, デバフ, 睡眠, 混乱, 暗闇) -> 1Lvあたり +5%
            if (['SMASH', 'SINGLE', 'SNIPE', 'SNIPE_HIGH', 'VAMP', 'ASSASSIN', 'STUN', 'DMG_DEBUFF', 'SLEEP', 'CONFUSE', 'BLIND'].includes(t)) {
                growthRate = 0.05; 
            }
            // 2. 範囲・連撃系 (全体, 十字, 列, 連撃, 全体デバフ攻撃) -> 1Lvあたり +3%
            else if (['BLAST', 'MULTI', 'CROSS', 'LINE_H', 'LINE_V', 'SPLASH', 'DMG_DEBUFF_ALL', 'BLIND_ALL', 'CONFUSE_ALL', 'PARALYZE'].includes(t)) {
                growthRate = 0.03; 
            }
            // 3. 回復・バフ・デバフ・状態異常系 -> 1Lvあたり +4%
            else if (['HEAL', 'HEAL_ALL', 'BUFF', 'BUFF_ALL', 'HEAL_BUFF', 'DEF_BUFF_ALL', 'DEBUFF', 'DEBUFF_ALL', 'POISON', 'POISON_ALL'].includes(t)) {
                growthRate = 0.04; 
            }
        }

        // スキル倍率のベース値 (1.0 + 成長率 * (Lv-1))
        let skillMul = 1 + growthRate * (this.save.skillLv - 1);
        
        // パッシブ初期化
        this.passives = [];
        if(this.base.passive) this.passives.push(this.base.passive);
        // ★v2: ability も参照 (ability と passive が異なる場合)
        if(this.base.ability && this.base.ability !== this.base.passive) {
            this.passives = [this.base.ability];
        }

        // 限界突破(LB)ボーナスの適用
        const bonuses = this.getLbConfig();
        bonuses.forEach(b => {
            if (this.lbCount >= b.lv) {
                if (b.type === 'STAT') {
                    if(b.stat === 'hp')  this.maxHp = Math.floor(this.maxHp * b.val);
                    if(b.stat === 'atk') this.atk = Math.floor(this.atk * b.val);
                    if(b.stat === 'def') this.def = Math.floor(this.def * b.val);
                    if(b.stat === 'res') this.res = Math.floor(this.res * b.val);
                    if(b.stat === 'spd') this.spd += b.val;
                    if(b.stat === 'all') {
                        this.maxHp = Math.floor(this.maxHp * b.val);
                        this.atk = Math.floor(this.atk * b.val);
                        this.def = Math.floor(this.def * b.val);
                        this.res = Math.floor(this.res * b.val);
                        this.spd += (b.val > 1 ? 2 : 0);
                    }
                }
                if (b.type === 'SKILL_BOOST') skillMul *= b.val;
                if (b.type === 'PASSIVE') this.passives.push(b);
                if (b.type === 'STATUS_RESIST') {
                    this.lbResist = (this.lbResist || 0) + b.val;
                }
            }
        });

        // ★v2: スキル威力計算 (新: power%, 旧: pow倍率)
        if (this.base.skill && this.base.skill.power) {
            this.skillPow = parseFloat((this.base.skill.power * skillMul / 100).toFixed(3));
            this.skillPowerPct = parseFloat((this.base.skill.power * skillMul).toFixed(1));
        } else {
            this.skillPow = this.base.skill && this.base.skill.pow 
                ? parseFloat((this.base.skill.pow * skillMul).toFixed(2)) : 0;
            this.skillPowerPct = this.skillPow * 100;
        }

        // =================================================
        // ★カード（装備）効果の適用
        // =================================================
        this.cardEffects = { atkPct:0, atkFlat:0, hpPct:0, hpFlat:0, spdFlat:0, critPct:0, statusResist:0, chargeReduce:0, initCharge:0, shieldPct:0, desperationAtkPct:0, lifestealPct:0 };
        if (typeof app !== 'undefined' && app.data && app.data.cardManager && this.uid) {
            const equips = app.data.getUnitEquips(this.uid);
            this.cardEffects = app.data.cardManager.calcEquippedEffects(equips);

            // 割合ボーナス適用（現在値に対する%加算）
            if (this.cardEffects.hpPct > 0) {
                this.maxHp = Math.floor(this.maxHp * (1 + this.cardEffects.hpPct / 100));
            }
            if (this.cardEffects.atkPct > 0) {
                this.atk = Math.floor(this.atk * (1 + this.cardEffects.atkPct / 100));
            }

            // 固定値ボーナス適用（覚醒による暴力的加算）
            this.maxHp += Math.floor(this.cardEffects.hpFlat || 0);
            this.atk += Math.floor(this.cardEffects.atkFlat || 0);
            this.spd += Math.floor(this.cardEffects.spdFlat || 0);

            // クリティカル率（バトル側で参照）
            this.cardCritPct = this.cardEffects.critPct || 0;
            // 状態異常耐性（LB耐性に加算）
            this.lbResist = (this.lbResist || 0) + (this.cardEffects.statusResist || 0) / 100;
        }
    }

    getLbConfig() {
        if (typeof LB_TABLE !== 'undefined' && LB_TABLE[this.base.id]) return LB_TABLE[this.base.id];
        if (typeof LB_TEMPLATES === 'undefined') return [];
        
        // ★v2: BST基準でLBテンプレを選択
        const bst = this.base.bst || 0;
        
        // BST530以上(エース~伝説): HIGH_BST
        if (bst >= 530 || this.base.cost >= 5) {
            return LB_TEMPLATES.HIGH_BST || LB_TEMPLATES.HIGH_COST || [];
        }
        // BST350~520(中堅~主力): MID_BST
        if (bst >= 350 || this.base.cost >= 3) {
            return LB_TEMPLATES.MID_BST || LB_TEMPLATES.MID_COST || [];
        }
        // BST350未満(序盤): LOW_BST
        return LB_TEMPLATES.LOW_BST || LB_TEMPLATES.LOW_COST || [];
    }

    levelUp() { 
        if (this.save.lv >= this.save.maxLv) return false; 
        this.save.lv++; this.calcStats(); return true; 
    }
    skillUp() { 
        if (this.save.skillLv >= 10) return false; 
        this.save.skillLv++; this.calcStats(); return true; 
    }
    limitBreak() { 
        if (this.save.maxLv >= 75) return false;
        this.save.maxLv += 5; 
        this.lbCount = Math.floor((this.save.maxLv - 50) / 5);
        this.calcStats(); 
        return true; 
    }

    getAbilityStatus() {
        const conf = this.getLbConfig();
        return conf.map(c => ({
            lb: c.lv, text: c.txt, unlocked: this.lbCount >= c.lv,
            isSpecial: c.lv === 3, isMax: c.lv === 5
        }));
    }

    getOccupiedCells(anchorIdx) {
        const cells = []; const r = Math.floor(anchorIdx / 4); const col = anchorIdx % 4;
        for (let dy = 0; dy < this.base.shape.h; dy++) {
            for (let dx = 0; dx < this.base.shape.w; dx++) {
                const tr = r + dy; const tc = col + dx;
                if (tr > 1 || tc > 3) return null;
                cells.push(tr * 4 + tc);
            }
        }
        return cells;
    }

    getSkillCurrentDesc() {
        if (!this.base.skill) return "-";
        
        const skill = this.base.skill;
        let desc = skill.desc || '-';

        // 置換用の具体値
        const powerPct = Math.floor(this.skillPowerPct || (this.skillPow ? this.skillPow * 100 : 0));
        if (desc.includes('#val#') && powerPct > 0) {
            desc = desc.replaceAll('#val#', powerPct);
        }
        
        if (skill.val != null) {
            const val = skill.val;
            if (desc.includes('#val_rate#')) {
                desc = desc.replaceAll('#val_rate#', val.toFixed(1));
            }
             if (desc.includes('#val_add#')) {
                const add = Math.floor((val - 1) * 100);
               desc = desc.replaceAll('#val_add#', add);
            }
        }

         // テンプレ未使用の曖昧説明向けに、具体値を補足で付与する
        const extras = [];
        if (powerPct > 0) {
            extras.push(`攻撃力の${powerPct}%`);
        }
        if (skill.val != null) {
            const val = skill.val;
            if (val > 1) {
                extras.push(`効果量+${Math.floor((val - 1) * 100)}%`);
            } else if (val > 0 && val < 1) {
                extras.push(`倍率${Math.floor(val * 100)}%`);
            }
        }
        if (skill.turns) {
            extras.push(`${skill.turns}T`);
        }
        if (extras.length > 0 && !desc.includes('（')) {
            desc += `（${extras.join(' / ')}）`;
        }
        
        return desc;
    }
}

class DataManager {
    constructor() { 
        this.inventory = []; 
        this.candies = {}; 
        this.deck = []; 
        this.gems = 3000; 
        this.gold = 10000; 
        this.zukanRewards = {}; 
        
        // ★追加: クリア済みステージの管理
        this.maxClearedStage = 0; 
        this.stageClearCounts = {};  // ★追加: ステージ別クリア回数
        // ★追加: 塔の階層管理
        this.towerFloor = 1;
        this.towerEnemyData = null; // ★追加: 塔の敵データ
        this.maxSlots = 4;

        // ★カードシステム
        this.cardManager = (typeof CardManager !== 'undefined') ? new CardManager() : null;
        this.unitEquips = {};  // { unitUid: { red: cardId, yellow: cardId, blue: cardId, purple: cardId } }

        this.load(); 
    }

    load() {
        const inv = localStorage.getItem('hero_inventory_v2'); 
        if (inv) {
            this.inventory = JSON.parse(inv);
        }
        if (!this.inventory || this.inventory.length === 0) {
            this.inventory = [];
            this.addUnit(1);
        }

        const candy = localStorage.getItem('hero_candies_v1');
        if (candy) this.candies = JSON.parse(candy);

        const savedGems = localStorage.getItem('hero_gems_v1'); 
        if (savedGems) this.gems = parseInt(savedGems);

        const savedGold = localStorage.getItem('hero_gold_v1'); 
        if (savedGold) this.gold = parseInt(savedGold);
        
        const deck = localStorage.getItem('hero_deck_v16'); 
        if (deck) { try { this.deck = JSON.parse(deck); } catch (e) { this.deck = []; } }

        const zr = localStorage.getItem('hero_zukan_rewards_v1');
        if (zr) { try { this.zukanRewards = JSON.parse(zr); } catch(e) { this.zukanRewards={}; } }

        // ★追加: ステージ進行度の読み込み
        const stage = localStorage.getItem('hero_max_stage_v1');
        if (stage) this.maxClearedStage = parseInt(stage);
        // ★追加: クリア回数読み込み
        const scc = localStorage.getItem('hero_stage_clear_counts_v1');
        if (scc) { try { this.stageClearCounts = JSON.parse(scc); } catch(e) { this.stageClearCounts = {}; } }
        // ★追加: 塔データの読み込み
        const tf = localStorage.getItem('hero_tower_floor_v1');
        if (tf) this.towerFloor = parseInt(tf);
        // ★追加: 塔の敵データ読み込み
        const ted = localStorage.getItem('hero_tower_enemy_v1');
        if (ted) { try { this.towerEnemyData = JSON.parse(ted); } catch(e) { this.towerEnemyData = null; } }
        const ms = localStorage.getItem('hero_max_slots_v1');
        if (ms) this.maxSlots = Math.max(4, Math.min(8, parseInt(ms)));

        // ★カードシステム読み込み
        if (this.cardManager) {
            const cardData = localStorage.getItem('hero_cards_v1');
            if (cardData) {
                try { this.cardManager.loadSaveData(JSON.parse(cardData)); } catch(e) { console.warn('Card data load error:', e); }
            }
        }
        const eqData = localStorage.getItem('hero_unit_equips_v1');
        if (eqData) {
            try { this.unitEquips = JSON.parse(eqData); } catch(e) { this.unitEquips = {}; }
        }
    }

    save() { 
        localStorage.setItem('hero_inventory_v2', JSON.stringify(this.inventory)); 
        localStorage.setItem('hero_candies_v1', JSON.stringify(this.candies));
        localStorage.setItem('hero_gems_v1', this.gems);
        localStorage.setItem('hero_gold_v1', this.gold);
        localStorage.setItem('hero_deck_v16', JSON.stringify(this.deck));
        localStorage.setItem('hero_zukan_rewards_v1', JSON.stringify(this.zukanRewards));
        
        // ★追加: ステージ進行度の保存
        localStorage.setItem('hero_max_stage_v1', this.maxClearedStage);
        // ★追加: クリア回数保存
        localStorage.setItem('hero_stage_clear_counts_v1', JSON.stringify(this.stageClearCounts || {}));
        
        if(typeof window.updateGlobalHeader === 'function') window.updateGlobalHeader();
        // ★追加: 塔データの保存
        localStorage.setItem('hero_tower_floor_v1', this.towerFloor);
        localStorage.setItem('hero_max_slots_v1', this.maxSlots);
        // ★追加: 塔の敵データ保存
        if (this.towerEnemyData) {
            localStorage.setItem('hero_tower_enemy_v1', JSON.stringify(this.towerEnemyData));
        } else {
            localStorage.removeItem('hero_tower_enemy_v1');
        }

        // ★カードシステム保存
        if (this.cardManager) {
            localStorage.setItem('hero_cards_v1', JSON.stringify(this.cardManager.toSaveData()));
        }
        localStorage.setItem('hero_unit_equips_v1', JSON.stringify(this.unitEquips || {}));
    }
    
    // ★追加: ステージクリア処理
    completeStage(stageId) {
        if (stageId > this.maxClearedStage) {
            this.maxClearedStage = stageId;
            // ステージクリアごとに1枠開放（最大8）
            if (this.maxSlots < 8) {
                this.maxSlots = Math.min(8, this.maxSlots + 1);
            }
            this.save();
        }
    }

    resetAllData() {
        const keys = [
            'hero_inventory_v2','hero_candies_v1','hero_gems_v1','hero_gold_v1',
            'hero_deck_v16','hero_zukan_rewards_v1','hero_max_stage_v1',
            'hero_stage_clear_counts_v1','hero_tower_floor_v1','hero_tower_enemy_v1',
            'hero_max_slots_v1',
            'hero_cards_v1','hero_unit_equips_v1'
        ];
        keys.forEach(k => localStorage.removeItem(k));
        location.reload();
    }

    saveStats() { this.save(); } 
    saveDeck() { this.save(); }

    getUnitInstance(uid) {
        const saved = this.inventory.find(u => u.uid === uid);
        if (!saved) return null;
        const base = DB.find(u => u.id === saved.unitId);
        return new Unit(base, saved);
    }
    
    getUnit(unitId) { 
        const saved = this.inventory.find(u => u.unitId === unitId);
        const base = DB.find(u => u.id === unitId);
        if(!base) return null;
        return new Unit(base, saved || { uid:null, unitId:unitId, lv:1, maxLv:50, skillLv:1 });
    }

    addUnit(unitId, isNewObtained = false) {
        const base = DB.find(u => u.id === unitId);
        if(!base) return null;
        const newUnit = {
            uid: Date.now() + Math.random().toString(36).substring(2),
            unitId: unitId,
            lv: 1, maxLv: 50, skillLv: 1, exp: 0,
            createTime: Date.now()
        };
        this.inventory.push(newUnit);
        if(isNewObtained) this.addCandy(unitId, 3);
        this.save();
        return this.getUnitInstance(newUnit.uid);
    }

    addCandy(unitId, amount) {
        if(!this.candies[unitId]) this.candies[unitId] = 0;
        this.candies[unitId] += amount;
    }
    
    consumeCandy(unitId, amount) {
        if(!this.candies[unitId] || this.candies[unitId] < amount) return false;
        this.candies[unitId] -= amount;
        this.save();
        return true;
    }

    // ★追加: 塔の階層を進める
    advanceTowerFloor() {
        this.towerFloor++;
        this.towerEnemyData = null; // ★次階層用に敵データをリセット
        this.save();
    }

    toggleLock(uid) {
        const unitData = this.inventory.find(u => u.uid === uid);
        if (unitData) {
            // ロック状態を反転
            unitData.isLocked = !unitData.isLocked;
            this.save();
            return unitData.isLocked;
        }
        return false;
    }

    // ★★★ releaseUnit (売却) もロック対応に書き換え ★★★
    releaseUnit(uid) {
        const idx = this.inventory.findIndex(u => u.uid === uid);
        if(idx === -1) return 0;

        // ロックチェック
        if(this.inventory[idx].isLocked) return 0;
        // デッキ編成チェック
        if(this.deck.some(d => d.uid === uid)) return 0;

        const unitId = this.inventory[idx].unitId;
        const base = DB.find(u => u.id === unitId);
        
        // レアリティによらず一律50個に変更（ユーザー希望）
        let amount = 50; 

        // 削除と保存
        this.inventory.splice(idx, 1);
        this.addCandy(unitId, amount);
        this._cleanupEquipsForUnit(uid);
        this.save();
        
        return amount; // 獲得した飴の数を返す
    }

    consumeGems(amount) { if (this.gems >= amount) { this.gems -= amount; this.save(); return true; } return false; }
    addGems(amount) { this.gems += amount; this.save(); }
    addGold(amount) { this.gold += amount; this.save(); }
    consumeGold(amount) { if (this.gold >= amount) { this.gold -= amount; this.save(); return true; } return false; }

    // =============================================
    // ★ カード装備系メソッド
    // =============================================

    /** ユニットにカードを装備（色スロット自動判定） */
    equipCard(unitUid, cardId) {
        if (!this.cardManager) return { success: false, reason: 'no_card_manager' };
        const card = this.cardManager.getCard(cardId);
        if (!card) return { success: false, reason: 'card_not_found' };

        if (!this.unitEquips[unitUid]) {
            this.unitEquips[unitUid] = { red: null, yellow: null, blue: null, purple: null };
        }

        // 他ユニットが装備中なら外す
        for (const uid of Object.keys(this.unitEquips)) {
            const eq = this.unitEquips[uid];
            if (eq[card.color] === cardId) {
                eq[card.color] = null;
            }
        }

        // 装備先スロットに既にカードがあれば外す
        const prevCardId = this.unitEquips[unitUid][card.color];
        this.unitEquips[unitUid][card.color] = cardId;
        this.save();
        return { success: true, prevCardId: prevCardId };
    }

    /** ユニットの指定色スロットからカードを取り外し */
    unequipCard(unitUid, color) {
        if (!this.unitEquips[unitUid]) return null;
        const cardId = this.unitEquips[unitUid][color];
        this.unitEquips[unitUid][color] = null;
        this.save();
        return cardId;
    }

    /** ユニットの装備状況を取得 */
    getUnitEquips(unitUid) {
        return this.unitEquips[unitUid] || { red: null, yellow: null, blue: null, purple: null };
    }

    /** カードドロップ（生成してインベントリに追加） */
    dropCard(options = {}) {
        if (!this.cardManager) return null;
        const card = this.cardManager.generateCard(options);
        const result = this.cardManager.addCard(card);
        if (result.success) {
            this.save();
            return card;
        }
        return null; // インベントリ上限
    }

    /** ユニット売却時に装備カードを自動取り外し */
    _cleanupEquipsForUnit(uid) {
        if (this.unitEquips[uid]) {
            delete this.unitEquips[uid];
        }
    }
}

/**
 * managers.js - SceneManager 
 * (TIPS 7種類: 図鑑報酬を追加)
 */
class SceneManager {
    constructor() { 
        this.currentSceneId = 'screen-home'; 
        this.isTransitioning = false; 
    }
    
    // TIPSのコンテンツ定義
    getRandomTipContent() {
        const tips = [
            // --- ① 属性相関図 ---
            {
                title: "属性相関図",
                html: `
                    <div class="type-chart-container">
                        <div class="chart-row">
                            <span class="type-badge t0">👼神</span><span class="chart-arrow">▶</span>
                            <span class="type-badge t1">👑覇王</span><span class="chart-arrow">▶</span>
                            <span class="type-badge t2">👸姫</span>
                        </div>
                        <div class="chart-mid-arrows"><span class="chart-arrow-up">▲</span><span class="chart-arrow-down">▼</span></div>
                        <div class="chart-row">
                            <span class="type-badge t5">👻妖怪</span><span class="chart-arrow">◀</span>
                            <span class="type-badge t4">⚙️豪族</span><span class="chart-arrow">◀</span>
                            <span class="type-badge t3">⚔️武将</span>
                        </div>
                    </div>
                    <div class="tips-desc">有利属性で <span style="color:#ffd700;">ダメージ1.5倍</span>！ </div>
                `
            },
            // --- ② 前衛の守り ---
            {
                title: "前衛の守り",
                html: `
                    <div class="formation-tip-visual">
                        <div class="f-row"><div class="f-cell enemy">敵</div></div>
                        <div class="f-arrow">通常 ▶</div>
                        <div class="f-row">
                            <div class="f-cell front active">🛡️前衛</div>
                            <div class="f-cell back safe">後衛</div>
                        </div>
                    </div>
                    <div class="tips-desc">
                        前列に味方がいる限り<br>
                        後列への<span style="color:#00ced1;">通常攻撃は届かない</span>！ 
                    </div>
                `
            },
            // --- ③ スキルの射程 ---
            {
                title: "スキルの射程",
                html: `
                    <div class="formation-tip-visual">
                        <div class="f-row"><div class="f-cell enemy cast">敵</div></div>
                        <div class="f-arrow skill">⚡SKILL ▶▶</div>
                        <div class="f-row">
                            <div class="f-cell front">前衛</div>
                            <div class="f-cell back hit">💥後衛</div>
                        </div>
                    </div>
                    <div class="tips-desc">
                        通常攻撃とは違い、<br>
                        <span style="color:#ffeb3b;">攻撃スキル</span>は<span style="color:#ff6666;">後衛を直接狙える</span>！ 
                    </div>
                `
            },
            // --- ④ スキルの発動率 ---
            {
                title: "スキルの発動率",
                html: `
                    <div class="skill-tip-visual">
                        <div class="skill-icon">⚡SKILL CHANCE</div>
                        <div class="skill-bar">
                            <div class="sb-base">基本率</div>
                            <div class="sb-plus">+ Lv補正</div>
                        </div>
                    </div>
                    <div class="tips-desc">
                        スキルLvを上げると<br>
                        <span style="color:#ff6666;">発動率</span>と<span style="color:#ff6666;">威力</span>が上昇！ 
                    </div>
                `
            },
            // --- ⑤ 状態異常：睡眠 ---
            {
                title: "睡眠と大ダメージ",
                html: `
                    <div class="status-tip-visual">
                        <div class="f-cell enemy status-sleep">💤Sleep</div>
                        <div class="f-arrow big-dmg">💥Dmg 1.5x</div>
                    </div>
                    <div class="tips-desc">
                        睡眠中の相手への攻撃は<br>
                        <span style="color:#ffd700;">ダメージ1.5倍</span>＋<span style="color:#aaa;">叩くと起きる</span>！ 
                    </div>
                `
            },
            // --- ⑥ 素早さと行動順 ---
            {
                title: "素早さの重要性",
                html: `
                    <div class="spd-tip-visual">
                        <div class="spd-row fast">
                            <span class="spd-val">SPD 150</span>
                            <span class="spd-bar b-fast">First! ⏩</span>
                        </div>
                        <div class="spd-row slow">
                            <span class="spd-val">SPD 100</span>
                            <span class="spd-bar b-slow">Wait...</span>
                        </div>
                    </div>
                    <div class="tips-desc">
                        行動順は<span style="color:#00ced1;">SPD(素早さ)</span>で決まる。<br>
                        先手を取って戦局を支配せよ！ 
                    </div>
                `
            },
            // --- ⑦ 図鑑報酬 ---
            {
                title: "図鑑報酬でジェムGET",
                html: `
                    <div class="zukan-tip-visual">
                        <div class="zukan-char-box">
                            <span class="zukan-new-badge">NEW!</span>
                            <div class="zukan-char-silhouette">?</div>
                        </div>
                        <div class="zukan-arrow">➡</div>
                        <div class="zukan-gem-box">
                            <div class="zukan-gem">💎</div>
                            <div class="zukan-get-text">GET!</div>
                        </div>
                    </div>
                    <div class="tips-desc">
                        新キャラを入手したら<br>
                        <span style="color:#00ffff;">図鑑</span>を開こう！<span style="color:#ffd700;">ジェム</span>が貰えるぞ！ 
                    </div>
                `
            }
        ];

        const idx = Math.floor(Math.random() * tips.length);
        return tips[idx];
    }

    setupTransitionLayer() {
        if (document.getElementById('dynamic-transition-layer')) return;
        if (!document.body) return;

        const tip = this.getRandomTipContent();

        const layer = document.createElement('div');
        layer.id = 'dynamic-transition-layer';
        
        layer.innerHTML = `
            <div class="loading-center-panel">
                <div class="tips-header">TIPS: ${tip.title}</div>
                <div class="tips-body-container">${tip.html}</div>
            </div>
            <div class="loading-bottom-right">
                <div class="loading-text-mini">Now Loading...</div>
                <img src="images/loading_run.webp" alt="running" class="mini-runner">
            </div>
        `;
        document.body.appendChild(layer);

        const style = document.createElement('style');
        style.id = 'dynamic-transition-style';
        style.innerHTML = `
            #dynamic-transition-layer {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background-color: #000; z-index: 99999; 
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                pointer-events: none; opacity: 0; transition: opacity 0.3s ease; 
            }
            #dynamic-transition-layer.active { opacity: 1; pointer-events: auto; }

            .loading-center-panel {
                width: 85%; max-width: 380px; height: 220px;
                background: rgba(30, 30, 30, 0.9);
                border: 2px solid #555; border-radius: 12px;
                padding: 15px; display: flex; flex-direction: column; align-items: center;
                box-shadow: 0 0 20px rgba(0,0,0,0.8);
            }
            .tips-header {
                font-size: 16px; font-weight: bold; color: #00ced1;
                margin-bottom: 15px; letter-spacing: 2px;
                border-bottom: 2px solid #00ced1; padding-bottom: 4px; width: 100%; text-align: center;
            }
            .tips-body-container {
                flex: 1; display: flex; flex-direction: column; 
                align-items: center; justify-content: center; width: 100%;
            }
            .tips-desc { 
                font-size: 14px; color: #ddd; font-weight: bold; 
                text-align: center; line-height: 1.6; margin-top: 10px;
            }

            .type-chart-container { display: flex; flex-direction: column; align-items: center; gap: 5px; }
            .chart-row { display: flex; align-items: center; gap: 5px; }
            .chart-mid-arrows { display: flex; justify-content: space-between; width: 100%; padding: 0 10px; box-sizing: border-box; }
            .type-badge { font-size: 11px; font-weight: bold; color: #fff; padding: 4px 6px; border-radius: 4px; border: 1px solid #fff; min-width: 45px; text-align: center; }
            .t0 { background: #e100ff; } .t1 { background: #ff8c00; } .t2 { background: #ff69b4; } 
            .t3 { background: #4caf50; } .t4 { background: #607d8b; } .t5 { background: #795548; }
            .chart-arrow, .chart-arrow-up, .chart-arrow-down { color: #aaa; font-size: 10px; }

            .formation-tip-visual, .status-tip-visual { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
            .f-row { display: flex; gap: 4px; }
            .f-cell { width: 45px; height: 45px; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold; color: #fff; border: 1px solid #555; background: #222; transition: all 0.2s; }
            
            .f-cell.enemy { background: #a00; border-color: #f55; }
            .f-cell.enemy.cast { animation: enemyCast 0.5s infinite alternate; box-shadow: 0 0 10px #ff00ff; border-color: #ff00ff; }
            .f-cell.front { background: #008888; border-color: #00aaaa; }
            .f-cell.front.active { background: #00ced1; border-color: #fff; color: #000; box-shadow: 0 0 10px #00ced1; z-index: 2; transform: scale(1.1); }
            .f-cell.back { background: #004488; border-color: #5588cc; opacity: 0.6; }
            .f-cell.back.safe { color: #88ccff; }
            .f-cell.back.hit { background: #ff4444; border-color: #ffaaaa; color: #fff; opacity: 1; animation: shakeHit 0.3s infinite; box-shadow: 0 0 10px #f00; }
            
            .f-arrow { color: #aaa; font-weight: bold; font-size: 10px; white-space: nowrap; }
            .f-arrow.skill { color: #ffeb3b; text-shadow: 0 0 5px #ff8c00; font-size: 11px; animation: slideArrowSkill 0.5s infinite; }
            
            .f-cell.status-sleep { background: #663399; border-color: #cc99ff; animation: pulseSleep 1.5s infinite; }
            .f-arrow.big-dmg { color: #ffd700; font-size: 14px; font-weight: 900; text-shadow: 0 0 5px #f00; }

            .spd-tip-visual { width: 90%; display: flex; flex-direction: column; gap: 8px; }
            .spd-row { display: flex; align-items: center; gap: 5px; width: 100%; }
            .spd-val { font-size: 10px; color: #aaa; width: 50px; text-align: right; }
            .spd-bar { height: 16px; border-radius: 4px; display: flex; align-items: center; padding-left: 5px; font-size: 10px; color: #000; font-weight: bold; width: 0; animation: growBar 1s forwards; }
            .b-fast { background: #00ffaa; width: 90%; box-shadow: 0 0 5px #00ffaa; }
            .b-slow { background: #555; width: 60%; color: #aaa; }

            .skill-tip-visual { width: 80%; display: flex; flex-direction: column; gap: 5px; margin-bottom: 5px; }
            .skill-icon { text-align: center; color: #ffeb3b; font-weight: bold; text-shadow: 0 0 5px #f00; font-size: 16px; }
            .skill-bar { display: flex; height: 20px; border-radius: 10px; overflow: hidden; border: 1px solid #fff; }
            .sb-base { width: 30%; background: #444; font-size: 9px; display: flex; align-items: center; justify-content: center; }
            .sb-plus { flex: 1; background: linear-gradient(90deg, #ff8c00, #ffeb3b); color: #000; font-size: 10px; font-weight: bold; display: flex; align-items: center; justify-content: center; animation: barFlash 2s infinite; }

            .zukan-tip-visual { display: flex; align-items: center; gap: 20px; margin-bottom: 5px; }
            .zukan-char-box { width: 45px; height: 55px; border: 2px solid #fff; position: relative; background: #222; display: flex; align-items: center; justify-content: center; border-radius: 4px; }
            .zukan-char-silhouette { font-size: 20px; color: #555; font-weight: bold; }
            .zukan-new-badge { position: absolute; top: -8px; right: -12px; background: #f00; color: #fff; font-size: 9px; padding: 2px 4px; border-radius: 4px; font-weight: bold; border: 1px solid #fff; animation: bounceNew 0.5s infinite alternate; }
            .zukan-arrow { font-size: 16px; color: #aaa; }
            .zukan-gem-box { display: flex; flex-direction: column; align-items: center; color: #00ffff; text-shadow: 0 0 5px #00ffff; }
            .zukan-gem { font-size: 32px; animation: pulseGem 1.5s infinite; }
            .zukan-get-text { font-size: 12px; font-weight: bold; color: #ffd700; margin-top: -5px; }

            @keyframes bounceNew { 0%{transform:translateY(0);} 100%{transform:translateY(-3px);} }
            @keyframes pulseGem { 0%{transform:scale(1); filter:brightness(1);} 50%{transform:scale(1.1); filter:brightness(1.3);} 100%{transform:scale(1); filter:brightness(1);} }
            @keyframes enemyCast { 0%{filter:brightness(1);} 100%{filter:brightness(1.5);} }
            @keyframes slideArrowSkill { 0%{transform:translateX(0) scale(1);} 50%{transform:translateX(5px) scale(1.2);} 100%{transform:translateX(0) scale(1);} }
            @keyframes shakeHit { 0%{transform:translate(0,0);} 25%{transform:translate(-2px,1px);} 50%{transform:translate(2px,-1px);} 75%{transform:translate(-1px,2px);} 100%{transform:translate(0,0);} }
            @keyframes pulseSleep { 0%{transform:scale(1);} 50%{transform:scale(1.05);} 100%{transform:scale(1);} }
            @keyframes growBar { from{width:0;} to{opacity:1;} }
            @keyframes barFlash { 0%{filter:brightness(1);} 50%{filter:brightness(1.3);} 100%{filter:brightness(1);} }

            .loading-bottom-right { position: absolute; bottom: 20px; right: 20px; display: flex; align-items: flex-end; gap: 10px; }
            .loading-text-mini { color: #fff; font-family: monospace; font-size: 14px; margin-bottom: 10px; letter-spacing: 1px; animation: blinkMini 0.8s infinite alternate; }
            .mini-runner { width: 60px; height: auto; object-fit: contain; animation: bounceRunner 0.4s infinite alternate; }
            @keyframes blinkMini { 0% { opacity: 0.2; } 100% { opacity: 1; } }
            @keyframes bounceRunner { 0% { transform: translateY(0); } 100% { transform: translateY(-3px); } }
        `;
        document.head.appendChild(style);
    }

    change(sceneId, callback) {
        if (this.isTransitioning) return;
        if (this.currentSceneId === sceneId) return;

        const oldLayer = document.getElementById('dynamic-transition-layer');
        if (oldLayer) oldLayer.remove();
        const oldStyle = document.getElementById('dynamic-transition-style');
        if (oldStyle) oldStyle.remove();

        this.setupTransitionLayer();
        const layer = document.getElementById('dynamic-transition-layer');
        if (!layer) { this._fallbackChange(sceneId, callback); return; }

        if(typeof app !== 'undefined' && app.sound) { app.sound.init(); app.sound.tap(); }
        
        this.isTransitioning = true;
        requestAnimationFrame(() => layer.classList.add('active'));

        setTimeout(() => {
            const screens = document.querySelectorAll('.screen');
            screens.forEach(s => s.classList.remove('active'));
            const target = document.getElementById(sceneId);
            if(target) target.classList.add('active');
            this.currentSceneId = sceneId;

            const footer = document.getElementById('global-footer'); 
            const hiddenScenes = ['screen-battle', 'screen-sugoroku'];
            if (footer) footer.style.display = hiddenScenes.includes(sceneId) ? 'none' : 'flex';
            const header = document.getElementById('global-header');
            if (header) header.style.display = ['screen-battle','screen-sugoroku'].includes(sceneId) ? 'none' : 'flex';
            
            if(typeof app !== 'undefined' && typeof window.updateGlobalHeader === 'function') {
                window.updateGlobalHeader();
            }
            if (typeof callback === 'function') {
                requestAnimationFrame(() => { callback(); });
            }
            layer.classList.remove('active');
            setTimeout(() => { this.isTransitioning = false; layer.remove(); }, 300);
        }, 1000); 
    }

    _fallbackChange(sceneId, callback) {
        const screens = document.querySelectorAll('.screen');
        screens.forEach(s => s.classList.remove('active'));
        const target = document.getElementById(sceneId);
        if(target) target.classList.add('active');
        this.currentSceneId = sceneId;
        const footer = document.getElementById('global-footer'); 
        const hiddenScenes = ['screen-battle', 'screen-sugoroku'];
        if (footer) footer.style.display = hiddenScenes.includes(sceneId) ? 'none' : 'flex';
       const header = document.getElementById('global-header');
        if (header) header.style.display = hiddenScenes.includes(sceneId) ? 'none' : 'flex';
       
        if (typeof callback === 'function') callback();
    }
}

class DeckManager {
    // ★開放順: F1(0),F2(1),B1(4),B2(5),F3(2),B3(6),F4(3),B4(7)
    static SLOT_ORDER = [0, 1, 4, 5, 2, 6, 3, 7];

    static getOpenSlots() {
        const n = (app && app.data) ? (app.data.maxSlots || 4) : 4;
        return DeckManager.SLOT_ORDER.slice(0, n);
    }

    isSlotOpen(cellIdx) {
        return DeckManager.getOpenSlots().includes(cellIdx);
    }

    canPlace(unit, anchorIdx) { 
        if(!unit) return false;
        const cells = unit.getOccupiedCells(anchorIdx); 
        if (!cells) return false; 
        // ★ロック枠チェック: 全セルが開放済みか確認
        for (let c of cells) {
            if (!this.isSlotOpen(c)) return false;
        }
        for (let c of cells) { 
            const occupied = app.data.deck.some(entry => { 
                const existingUnit = app.data.getUnitInstance(entry.uid); 
                if(!existingUnit) return false;
                const existingCells = existingUnit.getOccupiedCells(entry.anchorIdx); 
                return existingCells && existingCells.includes(c); 
            }); 
            if (occupied) return false; 
        } 
        return true; 
    }
    addUnit(uid, anchorIdx) { 
        if (app.sugorokuScreen && app.sugorokuScreen.isGameActive) { alert("双六モード中は編成変更できません"); return; }
        if (app.data.deck.length >= (app.data.maxSlots || 8)) { alert("枠が上限です（" + (app.data.maxSlots || 8) + "枠）\n双六ステージをクリアすると開放！"); return; }
        if (app.data.deck.some(d => d.uid === uid)) { alert("配置済みです"); return; } 
        const unit = app.data.getUnitInstance(uid); 
        if(!unit) return;
        if (!this.canPlace(unit, anchorIdx)) { alert("配置できません"); return; } 
        app.sound.tap(); 
        app.data.deck.push({ uid: uid, unitId: unit.base.id, anchorIdx: anchorIdx }); 
        app.data.saveDeck(); 
        app.formationScreen.refresh(); 
    }
    removeUnit(uid) { 
        app.sound.tap(); 
        app.data.deck = app.data.deck.filter(d => d.uid !== uid); 
        app.data.saveDeck(); 
        app.formationScreen.refresh(); 
    }
    clear() { 
        if(confirm("全部隊を解除しますか？")) { app.sound.tap(); app.data.deck = []; app.data.saveDeck(); app.formationScreen.refresh(); } 
    }
}