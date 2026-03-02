/**
 * unit.js - ユニット（キャラクター）クラス
 * 
 * 旧: managers.js から分離
 * 依存: data.js (DB, LB_TABLE, LB_TEMPLATES), card_system.js (CardManager)
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
        let flatGrowth = 0; // ★低BST救済: レベル毎の固定値加算
        if (bst <= 340 || this.base.cost <= 2) { growthPerLv = 0.05; flatGrowth = 2; }
        else if (bst <= 520 || this.base.cost <= 4) { growthPerLv = 0.04; flatGrowth = 1; }
        const mul = 1 + growthPerLv * (this.save.lv - 1);
        const lvBonus = flatGrowth * (this.save.lv - 1); // Lv1=0, Lv50=98(低BST), 49(中BST)

        const baseHp  = (this.base.stats && this.base.stats.hp)  || this.base.hp  || 100;
        const baseAtk = (this.base.stats && this.base.stats.atk) || this.base.atk || 50;
        const baseDef = (this.base.stats && this.base.stats.def) || this.base.def || 30;
        const baseSpd = (this.base.stats && this.base.stats.spd) || this.base.spd || 10;
        const baseRes = (this.base.stats && this.base.stats.res) || this.base.res || 30;

        this.maxHp = Math.floor(baseHp * mul) + lvBonus * 5; // HP帯はスケール×5
        this.atk   = Math.floor(baseAtk * mul) + lvBonus;
        this.def   = Math.floor(baseDef * mul) + lvBonus;
        this.spd   = baseSpd + Math.floor((this.save.lv - 1) * flatGrowth * 0.15); // ★SPD微成長
        this.res   = Math.floor(baseRes * mul) + lvBonus;

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
                // ★低BST救済: 固定値加算タイプ
                if (b.type === 'FLAT_BOOST') {
                    this.maxHp += (b.hp || 0);
                    this.atk += (b.atk || 0);
                    this.def += (b.def || 0);
                    this.res += (b.res || 0);
                    this.spd += (b.spd || 0);
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

            // ★下剋上カード: BST低いほどフラット加算がスケーリング
            if (this.cardEffects.underdogAtk > 0 || this.cardEffects.underdogHp > 0) {
                const ubst = this.base.bst || 300;
                let scale = 0.25; // BST521+: ほぼ効果なし
                if (ubst <= 340) scale = 2.5;       // 序盤キャラ: ×2.5
                else if (ubst <= 520) scale = 1.0;   // 中堅: 等倍
                this.atk   += Math.floor((this.cardEffects.underdogAtk || 0) * scale);
                this.maxHp += Math.floor((this.cardEffects.underdogHp || 0) * scale);
            }
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

