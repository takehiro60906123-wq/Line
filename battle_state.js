/**
 * battle_state.js - 完全版 (新スキルターゲット対応)
 */
class BattleState {
    constructor() {
        this.units = [];
    }

    init(deckData) {
        this.units = [];
        deckData.forEach(e => {
            if(typeof app !== 'undefined' && app.data) {
                let u = null;
                if (e.uid && app.data.getUnitInstance) u = app.data.getUnitInstance(e.uid);
                if (!u && e.unitId) u = app.data.getUnit(e.unitId);
                if(u) this.createUnit(u, 'player', e.anchorIdx);
            }
        });
        this.generateEnemy();
    }

    createUnit(uData, side, anchor) {
        if(!uData) return;
        uData.isDead = false; 
        uData.side = side; 
        uData.anchorIdx = anchor;
        uData.statusEffects = uData.statusEffects || [];
        uData.isStunned = false;
        uData.gutsUsed = false;

        const cardEff = uData.cardEffects || {};

        // ★カードの基本ステータス加算は Unit.calcStats() 側で反映済み
        let hpMul = 1;
        if (cardEff.hpDownPct) hpMul -= cardEff.hpDownPct / 100;
        uData.maxHp = Math.floor(uData.maxHp * Math.max(0.1, hpMul));
        uData.battleHp = uData.maxHp;

        let atkMul = 1;
        if (cardEff.atkDownPct) atkMul -= cardEff.atkDownPct / 100;
        uData.atk = Math.floor(uData.atk * Math.max(0.1, atkMul));
        uData.originalAtk = uData.atk;

        // ★v2: DEF / RES の初期化 (新5ステータス体系)
        uData.def = uData.def || uData.base.def || 30;
        uData.res = uData.res || uData.base.res || 30;
        uData.originalDef = uData.def;
        uData.originalRes = uData.res;

        // ★スキルレベルボーナス
        if (uData.save && cardEff.skillLvBonus) {
            uData.save.skillLv += cardEff.skillLvBonus;
        }

        uData.chargeCount = 0;
        uData.chargeMax = (uData.base && uData.base.skill && uData.base.skill.charge) ? uData.base.skill.charge : 99;

        // ★v2: スキルマスター特性 → チャージ-1
        const ability = uData.base.ability || uData.base.passive;
        if (ability && ability.type === 'SKILL_MASTER') {
            uData.chargeMax = Math.max(2, uData.chargeMax - (ability.val || 1));
        }

        if (cardEff.chargeReduce && cardEff.chargeReduce > 0) {
            uData.chargeMax = Math.max(2, uData.chargeMax - cardEff.chargeReduce);
        }
        if (cardEff.chargePen && cardEff.chargePen > 0) {
            uData.chargeMax += cardEff.chargePen;
        }

        uData.shield = 0;
        let totalShieldPct = (cardEff.shieldPct || 0);
        if (totalShieldPct > 0) {
            uData.shield = Math.floor(uData.maxHp * totalShieldPct / 100);
        }

        if (uData.save && uData.save.skillLv) {
            uData.chargeCount = Math.min(uData.chargeMax - 1, Math.floor(uData.save.skillLv / 5));
        }

        if (cardEff.initCharge && cardEff.initCharge > 0) {
            uData.chargeCount = Math.min(uData.chargeMax - 1, uData.chargeCount + cardEff.initCharge);
        }

        if (side === 'enemy') {
            uData.chargeCount = Math.floor(Math.random() * Math.ceil(uData.chargeMax * 0.5));
        }
        this.units.push(uData);
    }

    generateEnemy(occupied = []) {
        if (typeof DB === 'undefined' || !DB || DB.length === 0) return;
        
        for(let k=0; k<50; k++) {
            const base = DB[Math.floor(Math.random() * DB.length)];
            if(typeof Unit !== 'undefined') {
                const dummySave = { uid: 'enemy_' + Date.now() + '_' + k, unitId: base.id, lv: 15, maxLv: 50, skillLv: 1 };
                const u = new Unit(base, dummySave);
                const anchor = Math.floor(Math.random() * 8);
                const cells = u.getOccupiedCells(anchor);
                if (cells && !cells.some(c => occupied.includes(c))) {
                    cells.forEach(c => occupied.push(c)); 
                    this.createUnit(u, 'enemy', anchor);
                    if(this.units.filter(x => x.side === 'enemy').length >= 4) break;
                }
            }
        }
        if(this.units.filter(x => x.side === 'enemy').length === 0 && typeof Unit !== 'undefined') {
            const base = DB[0];
            const u = new Unit(base, { uid: 'enemy_boss', unitId: base.id, lv: 15, maxLv: 50, skillLv: 1 });
            this.createUnit(u, 'enemy', 0);
        }
    }

    applyStartPassives(side) {
        const logs = []; 
        const actors = this.units.filter(u => u.side === side && !u.isDead);
        
        actors.forEach(actor => {
            const passives = (actor.passives && actor.passives.length > 0) 
                           ? actor.passives 
                           : (actor.base.passive ? [actor.base.passive] : []);
            
            passives.forEach(p => {
                if(!p) return;

                // ★v2: STAT_BOOST — 自身のステータス倍率UP (ATK/DEF/SPD/RES)
                if(p.type === 'STAT_BOOST') {
                    if(p.stat === 'atk') { actor.atk = Math.floor(actor.atk * p.val); actor.originalAtk = actor.atk; }
                    if(p.stat === 'def') { actor.def = Math.floor(actor.def * p.val); actor.originalDef = actor.def; }
                    if(p.stat === 'res') { actor.res = Math.floor(actor.res * p.val); actor.originalRes = actor.res; }
                    if(p.stat === 'spd') { actor.spd = Math.floor(actor.spd * p.val); }
                    if(p.stat === 'hp') {
                        const oldMax = actor.maxHp;
                        actor.maxHp = Math.floor(actor.maxHp * p.val);
                        actor.battleHp += (actor.maxHp - oldMax);
                    }
                    logs.push({ actor, name: p.name || 'Passive', desc: p.desc, targets: [actor] });
                }

                // ★v2: DUAL_DEF — DEF+RES同時UP
                if(p.type === 'DUAL_DEF') {
                    actor.def = Math.floor(actor.def * (p.defVal || 1.1)); actor.originalDef = actor.def;
                    actor.res = Math.floor(actor.res * (p.resVal || 1.1)); actor.originalRes = actor.res;
                    logs.push({ actor, name: p.name, desc: p.desc, targets: [actor] });
                }

                // ★v2: DUAL_BOOST — ATK+スキル威力同時UP (スキル威力は skillPow に反映)
                if(p.type === 'DUAL_BOOST') {
                    actor.atk = Math.floor(actor.atk * (p.atkVal || 1.1)); actor.originalAtk = actor.atk;
                    logs.push({ actor, name: p.name, desc: p.desc, targets: [actor] });
                }

                // ★v2: TEAM_BUFF — 味方全体ステUP
                if(p.type === 'TEAM_BUFF') {
                    const allies = this.units.filter(t => t.side === side && !t.isDead);
                    allies.forEach(t => {
                        if(p.stat === 'atk') { t.atk = Math.floor(t.atk * p.val); t.originalAtk = t.atk; }
                        if(p.stat === 'def') { t.def = Math.floor(t.def * p.val); t.originalDef = t.def; }
                        if(p.stat === 'res') { t.res = Math.floor(t.res * p.val); t.originalRes = t.res; }
                    });
                    logs.push({ actor, name: p.name, desc: p.desc, targets: allies });
                }

                // ★v2: INTIMIDATE — 戦闘開始時、敵全体ATK-N%
                if(p.type === 'INTIMIDATE') {
                    const enemySide = side === 'player' ? 'enemy' : 'player';
                    const enemies = this.units.filter(t => t.side === enemySide && !t.isDead);
                    enemies.forEach(t => {
                        t.atk = Math.floor(t.atk * (1 - p.val));
                        t.originalAtk = t.atk;
                    });
                    logs.push({ actor, name: p.name, desc: p.desc, targets: enemies });
                }

                // ★後方互換: 旧BUFF_RACE (種族バフ → element一致バフに変換)
                if(p.type === 'BUFF_RACE') {
                    let targets = [];
                    if (p.target === null || p.target === undefined) {
                        targets = [actor];
                    } else {
                        targets = this.units.filter(t => 
                            t.side === side && !t.isDead && t.base.type == p.target 
                        );
                    }
                    if(targets.length > 0) {
                        logs.push({ actor, name: p.name || 'Passive', desc: p.desc, targets });
                        targets.forEach(t => {
                            if(p.stat === 'atk') { t.atk = Math.floor(t.atk * p.val); t.originalAtk = t.atk; }
                            if(p.stat === 'hp') {
                                const oldMax = t.maxHp;
                                t.maxHp = Math.floor(t.maxHp * p.val);
                                t.battleHp += (t.maxHp - oldMax);
                            }
                        });
                    }
                }

                // ★後方互換: 群狼 (旧WOLF_PACK → BST350以下が3体以上でATK UP)
                if(p.type === 'WOLF_PACK') {
                    const lowBstCount = this.units.filter(u => 
                        u.side === side && !u.isDead && (u.base.bst ? u.base.bst <= 350 : u.base.cost <= 2)
                    ).length;
                    if(lowBstCount >= 3) {
                        actor.atk = Math.floor(actor.atk * (1 + p.val));
                        actor.originalAtk = actor.atk;
                        logs.push({ actor, name: p.name || '群狼', desc: `低BST${lowBstCount}体！ ATK+${Math.floor(p.val*100)}%`, targets: [actor] });
                    }
                }
            });
        });
        return logs;
    }

    getQueue() { return this.units.filter(u => !u.isDead).sort((a,b) => b.spd - a.spd); }


    // ★ターゲット選定ロジック（新スキル対応）
    getTargets(actor, targetSide, skillType, skillCount) {
        // 自分自身が対象 (自己バフ)
        if (skillType === 'BUFF') return [actor];

        let searchSide = targetSide;
        // 回復や味方バフなら味方を検索
        if (skillType === 'HEAL' || skillType === 'HEAL_ALL' || skillType === 'BUFF_ALL' 
            || skillType === 'HEAL_BUFF' || skillType === 'DEF_BUFF_ALL'
            || skillType === 'HEAL_SHIELD' || skillType === 'HEAL_INVINCIBLE'
            || skillType === 'HEAL_RESIST' || skillType === 'HEAL_SPD'
            || skillType === 'CHARGE_ACCEL' || skillType === 'CHARGE_ACCEL_ALL') {
            searchSide = actor.side;
        }

        const targets = this.units.filter(u => u.side === searchSide && !u.isDead);
        if (targets.length === 0) return [];

        // 全体対象 (攻撃・回復・バフ・デバフ)
        if (skillType === 'BLAST' || skillType === 'HEAL_ALL' || skillType === 'BUFF_ALL'
            || skillType === 'DEBUFF_ALL' || skillType === 'POISON_ALL' 
            || skillType === 'DMG_DEBUFF_ALL' || skillType === 'HEAL_BUFF'
            || skillType === 'DEF_BUFF_ALL'
            || skillType === 'BLIND_ALL' || skillType === 'CONFUSE_ALL'
            || skillType === 'HEAL_SHIELD' || skillType === 'HEAL_RESIST' || skillType === 'HEAL_SPD'
            || skillType === 'CHARGE_DELAY_ALL' || skillType === 'CHARGE_ACCEL' || skillType === 'CHARGE_ACCEL_ALL') {
            return targets;
        }

        // 連撃 (MULTI) - ランダムに複数回
        if (skillType === 'MULTI') {
            const result = [];
            const count = skillCount || 3; 
            for(let i=0; i < count; i++) {
                const alive = this.units.filter(u => u.side === searchSide && !u.isDead);
                if(alive.length > 0) {
                    result.push(alive[Math.floor(Math.random() * alive.length)]);
                }
            }
            return result;
        }

        // --- 単体・範囲ターゲットの絞り込み ---

        // ★追加: 強敵狙い (ATKが一番高い敵を狙う)
        if (skillType === 'SNIPE_HIGH') {
            return [targets.sort((a,b) => b.atk - a.atk)[0]];
        }
        
        // 弱者狙い (HPが一番低い敵を狙う)
        if (skillType === 'SNIPE') {
            return [targets.sort((a,b) => a.battleHp - b.battleHp)[0]];
        }
        
        // 回復 (HP割合が一番低い味方)
        if (skillType === 'HEAL' || skillType === 'HEAL_INVINCIBLE') {
            return [targets.sort((a,b) => (a.battleHp/a.maxHp) - (b.battleHp/b.maxHp))[0]];
        }
        
        // ★デバフ・毒・スタン・状態異常系
        if (skillType === 'DEBUFF' || skillType === 'POISON' || skillType === 'STUN' 
            || skillType === 'DMG_DEBUFF' || skillType === 'SLEEP' || skillType === 'BLIND'
            || skillType === 'CONFUSE') {
            // スタンは強い敵を優先的に狙う
            if (skillType === 'STUN') {
                return [targets.sort((a,b) => b.atk - a.atk)[0]];
            }
            // その他はランダム
            return [targets[Math.floor(Math.random() * targets.length)]];
        }

        // ★麻痺: MULTI+状態異常のハイブリッド（countありならMULTI式）
        // ★チャージ遅延: チャージが最も貯まっている敵を狙う
        if (skillType === 'CHARGE_DELAY') {
            return [targets.sort((a,b) => b.chargeCount - a.chargeCount)[0]];
        }
        // ★チャージ加速: チャージが最も少ない味方を狙う
        if (skillType === 'CHARGE_ACCEL') {
            return [targets.sort((a,b) => (a.chargeCount/a.chargeMax) - (b.chargeCount/b.chargeMax))[0]];
        }

        if (skillType === 'PARALYZE') {
            if (skillCount && skillCount > 1) {
                const result = [];
                for(let i=0; i < skillCount; i++) {
                    const alive = this.units.filter(u => u.side === searchSide && !u.isDead);
                    if(alive.length > 0) result.push(alive[Math.floor(Math.random() * alive.length)]);
                }
                return result;
            }
            return [targets[Math.floor(Math.random() * targets.length)]];
        }
        
        // 暗殺 (後列優先)
        if (skillType === 'ASSASSIN') {
            const back = targets.filter(u => u.anchorIdx >= 4);
            if(back.length > 0) return [back[Math.floor(Math.random() * back.length)]];
        }

        // --- ここから位置依存系 ---
        
        // 中心ターゲット決定 (前列優先)
        const frontTargets = targets.filter(u => u.anchorIdx < 4);
        const activeTargets = frontTargets.length > 0 ? frontTargets : targets;
        const mainTarget = activeTargets[Math.floor(Math.random() * activeTargets.length)];
        const idx = mainTarget.anchorIdx;

        // 横一列 (LINE_H)
        if (skillType === 'LINE_H') {
            const row = Math.floor(idx / 4);
            return targets.filter(u => Math.floor(u.anchorIdx / 4) === row);
        }

        // 縦一列 (LINE_V)
        if (skillType === 'LINE_V') {
            const col = idx % 4;
            return targets.filter(u => (u.anchorIdx % 4) === col);
        }

        // 十字 (CROSS) or SPLASH
        if (skillType === 'CROSS' || skillType === 'SPLASH') {
            const row = Math.floor(idx / 4);
            const col = idx % 4;
            const neighbors = [idx];
            if(col > 0) neighbors.push(idx - 1);
            if(col < 3) neighbors.push(idx + 1);
            if(row > 0) neighbors.push(idx - 4);
            if(row < 1) neighbors.push(idx + 4);
            return targets.filter(u => neighbors.includes(u.anchorIdx));
        }

        // デフォルト (単体)
        return [mainTarget];
    }

    applyDamage(target, val, actor) {
        const flags = { dodged: false, crit: false, guts: false };
        let finalDmg = val;

        // ★v2: 属性相性計算 (新6属性: 火→草→水→火, 光⇔闇)
        if (actor && actor.base && target && target.base) {
            const atkElem = actor.base.element || 'neutral';
            const defElem = target.base.element || 'neutral';
            const elemMul = (typeof getElementAdvantage === 'function') 
                ? getElementAdvantage(atkElem, defElem) : 1.0;
            
            if (elemMul > 1.0) {
                let weakMul = elemMul;
                if (actor.cardEffects && actor.cardEffects.weakSlayerPct) weakMul += actor.cardEffects.weakSlayerPct / 100;
                if (target.cardEffects && target.cardEffects.weakResistPct) weakMul = Math.max(1.0, weakMul - target.cardEffects.weakResistPct / 100);
                finalDmg = Math.floor(finalDmg * weakMul);
                flags.weak = true;
            }
            else if (elemMul < 1.0) {
                finalDmg = Math.floor(finalDmg * elemMul);
                flags.resist = true;
            }
        }

        // ★性別特攻 (簡易判定: 姫(ID:2)を女性、それ以外を男性とみなして判定)
        if (actor && actor.cardEffects && actor.cardEffects.genderSlayerPct > 0) {
            const aGender = actor.base.type === 2 ? 'F' : 'M';
            const tGender = target.base.type === 2 ? 'F' : 'M';
            if (aGender !== tGender) {
                finalDmg = Math.floor(finalDmg * (1 + actor.cardEffects.genderSlayerPct / 100));
            }
        }

        // ★前衛・後衛からのダメージカット
        if (target && target.cardEffects && actor) {
            const isActorFront = actor.anchorIdx < 4;
            if (isActorFront && target.cardEffects.frontResistPct > 0) {
                finalDmg = Math.floor(finalDmg * (1 - target.cardEffects.frontResistPct / 100));
            } else if (!isActorFront && target.cardEffects.backResistPct > 0) {
                finalDmg = Math.floor(finalDmg * (1 - target.cardEffects.backResistPct / 100));
            }
        }

        // ★全体ダメージカット
        if (target && target.cardEffects && target.cardEffects.dmgCutPct > 0) {
            finalDmg = Math.floor(finalDmg * (1 - target.cardEffects.dmgCutPct / 100));
        }

        // --- DODGE（カード回避率加算） ---
        let dodgeProb = 0;
        if (target.cardEffects && target.cardEffects.dodgePct) dodgeProb += target.cardEffects.dodgePct / 100;
        const tPassives = (target.passives && target.passives.length > 0) ? target.passives : (target.base.passive ? [target.base.passive] : []);
        for (const p of tPassives) {
            if (p.type === 'DODGE' || p.code === 'DODGE') dodgeProb += p.val;
        }
        if (dodgeProb > 0 && Math.random() < dodgeProb) {
            flags.dodged = true;
            return { hp: target.battleHp, flags };
        }

        // --- 無敵・ダメ半減 ---
        if (target.statusEffects) {
            for (const se of target.statusEffects) {
                if (se.type === 'INVINCIBLE') { flags.invincible = true; return { hp: target.battleHp, flags }; }
                if (se.type === 'HALF_DMG') finalDmg = Math.floor(finalDmg * (se.val || 0.5));
            }
        }

        // --- CRIT判定 (会心ダメージUP追加) ---
        if (actor && !flags.crit) {
            let isCrit = false;
            const cardCrit = (actor.cardCritPct || 0) / 100;
            if (cardCrit > 0 && Math.random() < cardCrit) isCrit = true;
            if (!isCrit && actor.passives) {
                for (const p of actor.passives) {
                    if (p.code === 'CRIT_UP' && Math.random() < p.val) { isCrit = true; break; }
                }
            }
            if (isCrit) {
                let critMul = 1.5;
                if (actor.cardEffects && actor.cardEffects.critDmgPct > 0) critMul += actor.cardEffects.critDmgPct / 100;
                finalDmg = Math.floor(finalDmg * critMul);
                flags.crit = true;
            }
        }

        // --- 対高コスト特効など既存のパッシブ・状態異常処理 ---
        // (省略せずそのまま残してください)

        // --- 背水 (紫と赤の合算) ---
        if (actor && actor.cardEffects) {
            const desp = (actor.cardEffects.desperationAtkPct || 0);
            if (desp > 0 && actor.battleHp <= actor.maxHp * 0.5) {
                finalDmg = Math.floor(finalDmg * (1 + desp / 100));
                flags.desperation = true;
            }
        }

        // ★追い打ち (追加ダメージ化: 簡易的にダメージ1.5倍にして表現)
        if (actor && actor.cardEffects && actor.cardEffects.extraAttackProb > 0) {
            if (Math.random() * 100 < actor.cardEffects.extraAttackProb) {
                finalDmg = Math.floor(finalDmg * 1.5);
                flags.extraAttack = true; // ログ等で「追撃！」と出す用
            }
        }

        // --- 結界 ---
        if (target.shield && target.shield > 0) {
            if (target.shield >= finalDmg) {
                target.shield -= finalDmg; flags.shieldAbsorb = finalDmg; finalDmg = 0;
            } else {
                finalDmg -= target.shield; flags.shieldAbsorb = target.shield; target.shield = 0; flags.shieldBreak = true;
            }
        }

        target.battleHp = Math.max(0, target.battleHp - finalDmg);

        // --- 吸血 (紫と赤の合算) ---
        if (actor && actor.cardEffects && finalDmg > 0) {
            const lifeSteal = (actor.cardEffects.lifestealPct || 0);
            if (lifeSteal > 0 && !actor.isDead) {
                const healAmt = Math.floor(finalDmg * lifeSteal / 100);
                actor.battleHp = Math.min(actor.maxHp, actor.battleHp + healAmt);
                flags.lifesteal = healAmt;
            }
        }

       // --- GUTS判定: 致死ダメージを一度だけ耐える ---
        if (target.battleHp <= 0 && !target.gutsUsed) {
            for (const p of tPassives) {
                // 通常のGUTS、または専用パッシブ 'EVA_RAMPAGE'
                if (['GUTS', 'GUTS_EX', 'EVA_RAMPAGE'].includes(p.type) || ['GUTS', 'GUTS_EX'].includes(p.code)) {
                    target.battleHp = 1;
                    target.gutsUsed = true;
                    flags.guts = true;
                    console.log(`[Guts] ${target.base.name} が根性で耐えた！`);

                    // ★追加: 初号機専用「暴走」ロジック
                    if (p.type === 'EVA_RAMPAGE') {
                        // HPを30%まで回復
                        target.battleHp = Math.floor(target.maxHp * 0.3);
                        // ATKを3倍(元の2.0倍加算)にする
                        target.atk = Math.floor(target.atk * 2.0);
                        // ログ用演出（次の行動で反映）
                        target.isBerserk = true; 
                        console.log(`[EVA] ${target.base.name} が暴走！ ATK 3倍！`);
                        
                        // エフェクト用にフラグを立てる（任意）
                        flags.special = true; 
                    }
                    break;
                }
            }
        }

        if (target.battleHp <= 0) target.isDead = true;
        return { hp: target.battleHp, flags, damage: finalDmg };
    }

    // 3. 回復量UPの適用
    heal(target, val) {
        if(!target) return;
        let finalVal = val;
        if (target.cardEffects && target.cardEffects.healBoostPct > 0) {
            finalVal = Math.floor(val * (1 + target.cardEffects.healBoostPct / 100));
        }
        target.battleHp = Math.min(target.maxHp, target.battleHp + finalVal);
        return target.battleHp;
    }

   // ★v2: ステータス異常の耐性値を計算（パッシブ + LB + BST補正 + カード）
    getStatusResist(unit) {
        let resist = 0;
        // ★v2: BST530以上(エース級)は基礎耐性30% (旧: cost >= 8)
        const bst = unit.base.bst || 0;
        if (bst >= 530 || unit.base.cost >= 8) resist += 0.30;
        
        // パッシブからの耐性
        const allP = (unit.passives && unit.passives.length > 0) 
            ? unit.passives : (unit.base.passive ? [unit.base.passive] : []);
        for (const p of allP) {
            if (p.type === 'STATUS_RESIST') resist += (p.resist || 0);
            if (p.code === 'STATUS_RESIST') resist += (p.val || 0);
            // ★v2: 毒・火傷無効特性
            if (p.type === 'POISON_IMMUNE') resist += 0; // 別途判定
        }
        
        // LBからの耐性
        if (unit.lbResist) resist += unit.lbResist;

        // カード効果からの耐性
        if (unit.cardEffects && unit.cardEffects.statusResist > 0) {
            resist += (unit.cardEffects.statusResist / 100);
        }

        // バフによる耐性UP
        if (unit.statusEffects) {
            for (const se of unit.statusEffects) {
                if (se.type === 'STATUS_RESIST_UP') resist += (se.val || 0.50);
            }
        }
        return Math.min(resist, 0.95); // 最大95%
    }

    // ★ステータス異常を付与（耐性判定あり）
    applyStatusEffect(target, effect) {
        if (!target || target.isDead) return { applied: false, resisted: false };
        if (!target.statusEffects) target.statusEffects = [];
        
        // 行動阻害系は相互排他（STUN/SLEEP/PARALYZE/CONFUSE）
        // バフ系はpurify/耐性をバイパス
        const BUFF_TYPES = ['DEF_UP', 'INVINCIBLE', 'HALF_DMG', 'SPD_UP', 'STATUS_RESIST_UP'];
        const isBuff = BUFF_TYPES.includes(effect.type);

        const ACTION_IMPAIR = ['STUN', 'SLEEP', 'PARALYZE', 'CONFUSE'];
        const isActionImpair = ACTION_IMPAIR.includes(effect.type);
        
        // 浄化パッシブチェック（完全無効）
        const allP = (target.passives && target.passives.length > 0) 
            ? target.passives : (target.base.passive ? [target.base.passive] : []);
        for (const p of allP) {
            if (!isBuff && p.type === 'STATUS_RESIST' && p.resist >= 1.0) {
                console.log(`[Purify] ${target.base.name} は浄化でステータス異常を完全無効！`);
                return { applied: false, resisted: true };
            }
        }
        
        // 耐性判定（行動阻害系 + 毒 + 暗闇のみ。ATKデバフやDEF系は耐性で弾かない）
        const RESISTABLE = [...ACTION_IMPAIR, 'POISON', 'BLIND'];
        if (RESISTABLE.includes(effect.type)) {
            const resist = this.getStatusResist(target);
            if (Math.random() < resist) {
                console.log(`[Resist] ${target.base.name} が${effect.type}に耐えた！ (耐性${Math.floor(resist*100)}%)`);
                return { applied: false, resisted: true };
            }
        }
        
        // 行動阻害系は既存のものを上書き（同時に2つかからない）
        if (isActionImpair) {
            target.statusEffects = target.statusEffects.filter(se => !ACTION_IMPAIR.includes(se.type));
            target.isStunned = false;
        }
        
        // 同タイプの効果は上書き
        target.statusEffects = target.statusEffects.filter(se => se.type !== effect.type);
        target.statusEffects.push({ ...effect });
        
        // 即時適用
        if (effect.type === 'ATK_DOWN') {
            const baseAtk = target.originalAtk || target.atk;
            target.atk = Math.floor(baseAtk * effect.val);
            console.log(`[Debuff] ${target.base.name} ATK: ${baseAtk} -> ${target.atk}`);
        }
        if (effect.type === 'STUN') {
            target.isStunned = true;
        }
        if (effect.type === 'PARALYZE') {
            // SPD半減
            target.spd = Math.floor(target.spd * 0.5);
            console.log(`[Paralyze] ${target.base.name} SPD半減 -> ${target.spd}`);
        }
        
        if (effect.type === 'SPD_UP') {
            if (!target.originalSpd) target.originalSpd = target.spd;
            target.spd = Math.floor(target.originalSpd * effect.val);
            console.log(`[SpdUp] ${target.base.name} SPD: ${target.originalSpd} -> ${target.spd}`);
        }
        return { applied: true, resisted: false };
    }

    // ★被弾時の睡眠覚醒チェック
    wakeOnHit(target) {
        if (!target || !target.statusEffects) return false;
        const sleep = target.statusEffects.find(se => se.type === 'SLEEP');
        if (sleep) {
            target.statusEffects = target.statusEffects.filter(se => se.type !== 'SLEEP');
            console.log(`[Wake] ${target.base.name} が被弾で目覚めた！`);
            return true;
        }
        return false;
    }

    // ★ターン開始時のステータス処理
    processStartOfTurn(actor) {
        if (!actor || actor.isDead || !actor.statusEffects) return { logs: [], skipTurn: false };
        const logs = [];
        let skipTurn = false;
        
        // === スタン: 確定スキップ、1T解除 ===
        if (actor.isStunned) {
            skipTurn = true;
            actor.isStunned = false;
            logs.push({ type: 'STUN', text: '💫スタン！ 行動不能', target: actor });
            actor.statusEffects = actor.statusEffects.filter(se => se.type !== 'STUN');
        }
        
        // === 睡眠: スキップだが毎ターン自然解除判定あり(50%) ===
        const sleep = actor.statusEffects.find(se => se.type === 'SLEEP');
        if (sleep && !skipTurn) {
            if (Math.random() < 0.50) {
                // 自然に目覚めた
                actor.statusEffects = actor.statusEffects.filter(se => se.type !== 'SLEEP');
                logs.push({ type: 'SLEEP_WAKE', text: '💤目が覚めた！', target: actor });
            } else {
                skipTurn = true;
                logs.push({ type: 'SLEEP', text: '💤ぐっすり眠っている…', target: actor });
            }
        }
        
        // === 麻痺: 40%で行動失敗(スキップではなく失敗) ===
        const para = actor.statusEffects.find(se => se.type === 'PARALYZE');
        if (para && !skipTurn) {
            if (Math.random() < 0.40) {
                skipTurn = true;
                logs.push({ type: 'PARALYZE', text: '⚡痺れて動けない！', target: actor });
            } else {
                logs.push({ type: 'PARALYZE_OK', text: '⚡痺れながらも動いた', target: actor });
            }
        }

        // === 混乱: 行動はするが30%で味方攻撃（scene_battle側で処理） ===
        // ここではログだけ出す
        const confuse = actor.statusEffects.find(se => se.type === 'CONFUSE');
        if (confuse && !skipTurn) {
            logs.push({ type: 'CONFUSE_ACTIVE', text: '🌀混乱中…', target: actor });
        }
        
        // === 毒ダメージ ===
        const poison = actor.statusEffects.find(se => se.type === 'POISON');
        if (poison) {
            const dmg = Math.floor(actor.maxHp * poison.val);
            actor.battleHp = Math.max(1, actor.battleHp - dmg);
            logs.push({ type: 'POISON', text: `☠️毒！ -${dmg}`, target: actor, val: dmg });
        }
        
        // === ターン経過・解除 ===
        actor.statusEffects = actor.statusEffects.filter(se => {
            se.turns--;
            if (se.turns <= 0) {
                if (se.type === 'ATK_DOWN' && actor.originalAtk) {
                    actor.atk = actor.originalAtk;
                    logs.push({ type: 'DEBUFF_END', text: 'ATKダウン解除', target: actor });
                }
                if (se.type === 'DEF_UP') {
                    logs.push({ type: 'BUFF_END', text: '防御バフ解除', target: actor });
                }
                if (se.type === 'ARMOR_BREAK') {
                    logs.push({ type: 'DEBUFF_END', text: '防御崩壊解除', target: actor });
                }
                if (se.type === 'POISON') {
                    logs.push({ type: 'POISON_END', text: '毒が消えた', target: actor });
                }
                if (se.type === 'PARALYZE') {
                    actor.spd = actor.base.spd; // SPD復帰
                    logs.push({ type: 'DEBUFF_END', text: '麻痺が治った', target: actor });
                }
                if (se.type === 'BLIND') {
                    logs.push({ type: 'DEBUFF_END', text: '暗闇が晴れた', target: actor });
                }
                if (se.type === 'CONFUSE') {
                    logs.push({ type: 'DEBUFF_END', text: '混乱が解けた', target: actor });
                }
                if (se.type === 'SLEEP') {
                    logs.push({ type: 'DEBUFF_END', text: '目が覚めた', target: actor });
                }
                if (se.type === 'INVINCIBLE') {
                    logs.push({ type: 'BUFF_END', text: '✨無敵解除', target: actor });
                }
                if (se.type === 'HALF_DMG') {
                    logs.push({ type: 'BUFF_END', text: '🔰ダメ半減解除', target: actor });
                }
                if (se.type === 'SPD_UP') {
                    if (actor.originalSpd) actor.spd = actor.originalSpd;
                    logs.push({ type: 'BUFF_END', text: '💨SPD UP解除', target: actor });
                }
                if (se.type === 'STATUS_RESIST_UP') {
                    logs.push({ type: 'BUFF_END', text: '🛡️耐性UP解除', target: actor });
                }
                return false;
            }
            return true;
        });

        // ★青カード「気まぐれ」: 確率でチャージをMAXにする
        if (!skipTurn && actor.cardEffects && actor.cardEffects.probSkillActivate > 0) {
            if (Math.random() * 100 < actor.cardEffects.probSkillActivate) {
                actor.chargeCount = actor.chargeMax;
                logs.push({ type: 'PROB_SKILL', text: '💡スキル即時発動！', target: actor });
            }
        }
        
        return { logs, skipTurn };
    }

    // ★ステータス異常アイコン
    getStatusIcons(unit) {
        if (!unit || !unit.statusEffects) return '';
        const icons = [];
        for (const se of unit.statusEffects) {
            switch(se.type) {
                case 'ATK_DOWN':    icons.push('⬇️'); break;
                case 'POISON':      icons.push('☠️'); break;
                case 'STUN':        icons.push('💫'); break;
                case 'DEF_UP':      icons.push('🛡️'); break;
                case 'ARMOR_BREAK': icons.push('💔'); break;
                case 'SLEEP':       icons.push('💤'); break;
                case 'PARALYZE':    icons.push('⚡'); break;
                case 'BLIND':       icons.push('🕶️'); break;
                case 'CONFUSE':     icons.push('🌀'); break;
                case 'INVINCIBLE':  icons.push('✨'); break;
                case 'HALF_DMG':    icons.push('🔰'); break;
                case 'SPD_UP':      icons.push('💨'); break;
                case 'STATUS_RESIST_UP': icons.push('🛡️'); break;
            }
        }
        return icons.join('');
    }

    checkResult() {
        const p = this.units.some(u => u.side === 'player' && !u.isDead); 
        const e = this.units.some(u => u.side === 'enemy' && !u.isDead);
        if (!p) return 'lose';
        if (!e) return 'win';
        return null;
    }

    // ★追加: 塔専用の敵生成ロジック (修正版)
    generateTowerEnemy(floor, playerOccupied = []) {
        if (typeof DB === 'undefined' || typeof Unit === 'undefined') return;

        const enemyOccupied = [];

        // --- 1. 強さの基準 (階層Lv) ---
        let lv = 10 + (floor * 2);
        
        // --- 2. 育成状況 ---
        let lbCount = 0;
        if (lv >= 30) lbCount = 1;
        if (lv >= 50) lbCount = 2;
        if (lv >= 70) lbCount = 3;
        if (lv >= 90) lbCount = 4;
        if (lv >= 100) lbCount = 5;

        const skillLv = Math.min(10, 1 + Math.floor(floor / 5));

        // --- 3. 生成数・枠の制限 ---
        const isBossFloor = (floor % 5 === 0);

        // ★修正点: 「8体」ではなく「8枠(フルメンバー)」を目指す設定にする
        // 通常階は徐々に増やすが、ボス階は上限を8枠(enemyOccupied.length >= 8)で止める
        let maxUnitsCap = 4; 
        if (isBossFloor) {
            maxUnitsCap = 8; // 最大8体までOK（ただし枠が埋まれば終了）
        } else {
            if (floor >= 10) maxUnitsCap = 5;
            if (floor >= 20) maxUnitsCap = 6;
            if (floor >= 30) maxUnitsCap = 7;
            if (floor >= 40) maxUnitsCap = 8;
        }

        let placedCount = 0;
        
        // --- 4. ボス配置 (ボス階のみ) ---
        if (isBossFloor) {
            const bossBase = DB.find(u => (u.bst >= 500 || u.cost >= 5)) || DB[0];
            const leaderLv = lv + 5;
            const leaderMaxLv = Math.max(leaderLv, 50 + (lbCount * 5));
            
            const boss = new Unit(bossBase, { 
                uid: 'tower_boss_' + Date.now(), 
                unitId: bossBase.id, 
                lv: leaderLv, 
                maxLv: leaderMaxLv, 
                skillLv: skillLv 
            });
            boss.battleHp = boss.maxHp;

            // 中央付近(1 or 2)を優先して配置 (2x2などの大型が真ん中に来やすくする)
            const tryAnchors = [1, 2, 5, 6, 0, 3, 4, 7];
            for(let anchor of tryAnchors) {
                const cells = boss.getOccupiedCells(anchor);
                // 重なりチェック
                if (cells && !cells.some(c => enemyOccupied.includes(c))) {
                    cells.forEach(c => enemyOccupied.push(c));
                    this.createUnit(boss, 'enemy', anchor);
                    placedCount++;
                    break;
                }
            }
        }

        // --- 5. 残りの枠を埋める ---
        for(let k=0; k < 50; k++) {
            // ★重要修正: 「ユニット数が上限」または「盤面(8枠)が全て埋まった」ら終了
            if (placedCount >= maxUnitsCap) break;
            if (enemyOccupied.length >= 8) break; 

            let base;
            if (isBossFloor) {
                // 取り巻き：基本は中堅以上(コスト3~)だが、隙間埋め用に30%で全キャラから抽選
                const midPool = DB.filter(u => (u.bst >= 350 || u.cost >= 3));
                if (Math.random() < 0.7 && midPool.length > 0) {
                    base = midPool[Math.floor(Math.random() * midPool.length)];
                } else {
                    base = DB[Math.floor(Math.random() * DB.length)];
                }
            } else {
                base = DB[Math.floor(Math.random() * DB.length)];
            }

            const myMaxLv = Math.max(lv, 50 + (lbCount * 5));
            const u = new Unit(base, { 
                uid: `tower_e_${Date.now()}_${k}`, 
                unitId: base.id, 
                lv: lv, 
                maxLv: myMaxLv, 
                skillLv: skillLv 
            });
            u.battleHp = u.maxHp;

            const anchor = Math.floor(Math.random() * 8);
            const cells = u.getOccupiedCells(anchor);
            
            if (cells && !cells.some(c => enemyOccupied.includes(c))) {
                cells.forEach(c => enemyOccupied.push(c));
                this.createUnit(u, 'enemy', anchor);
                placedCount++;
            }
        }

        // 保険: 1体も配置されなかった場合
        if (this.units.filter(x => x.side === 'enemy').length === 0) {
            const u = new Unit(DB[0], { uid: 'fallback', unitId: DB[0].id, lv: lv, maxLv: 99, skillLv: 1 });
            u.battleHp = u.maxHp;
            this.createUnit(u, 'enemy', 0);
        }
    }
}