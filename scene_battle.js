/**
 * scene_battle.js - 背景変更修正版
 */
class BattleScreen {
    constructor() {
        this.active = false;
        this.speed = 1.0;
        this.battleLogs = {}; 
        this.resultLoopId = null; 
        this.lastBattleResult = null;
        
        this.state = new BattleState();
        this.visuals = new BattleVisuals();
        this.effects = new BattleEffect(); 

        window.toggleSpeed = () => this.toggleSpeed();
        window.backToEdit = () => this.backToEdit();
        // CSS は style-battle-v2.css に外部化済み
    }

   async start(options = {}) {
        if (this.active) return; 
        this.currentOptions = options;
        
        console.log("Battle Options:", options); 

        if (!app.data.deck || app.data.deck.length === 0) {
            alert("部隊が編成されていません！");
            app.changeScene('screen-edit');
            return;
        }

        this.lastBattleResult = null; 

        try {
            if(app.sound) app.sound.start();
            this.active = true; 
            
            const oldRes = document.getElementById('battle-result-overlay');
            if(oldRes) oldRes.remove();

            // ※背景の設定は後で行うため、一旦スキップ（ロード完了後に設定します）
            const bg = options.bgImg || "images/bg_battle.webp";

            this.state.init(app.data.deck);
            this.state.units = this.state.units.filter(u => u.side === 'player');

            // ★双六HP引継ぎ
            if (options.sugorokuHpState && options.sugorokuMode) {
                const hpState = options.sugorokuHpState;
                this.state.units.forEach(u => {
                    if (hpState[u.uid]) {
                        u.battleHp = Math.max(1, hpState[u.uid].hp);
                        u.isDead = false;
                    }
                });
            }

            const enemyOccupied = [];
            const lv = options.enemyLv || 10;

            // ★敵の生成処理 (塔モード、双六・固定敵モード、通常戦闘)
            if (options.mode === 'tower') {
                if (options.pregenEnemies && options.pregenEnemies.length > 0) {
                    this._spawnPregenEnemies(options.pregenEnemies, enemyOccupied);
                } else {
                    this.state.generateTowerEnemy(options.floor, enemyOccupied);
                }
            }
            else if (options.fixedEnemyId) {
                // ... (既存の敵生成ロジックそのまま) ...
                const pid = options.fixedEnemyId;
                const pc = options.playerCount || 4;
                const bossBase = DB.find(u => u.id === pid) || DB.find(u => u.cost >= 3) || DB[0];
                const isBossType = bossBase.cost >= 4;

                if (isBossType) {
                    this.spawnEnemy(bossBase, 1, enemyOccupied, lv + 5);
                    const minionCount = Math.max(1, Math.floor(pc * 0.6) + Math.floor(Math.random() * 2));
                    const minions = DB.filter(u => u.cost <= 3);
                    if (minions.length > 0) {
                        for (let i = 0; i < minionCount; i++) {
                            const m = minions[Math.floor(Math.random() * minions.length)];
                            this.spawnEnemy(m, i % 8, enemyOccupied, lv);
                        }
                    }
                } else {
                    const count = Math.max(2, Math.floor(pc * 0.5) + Math.floor(Math.random() * Math.ceil(pc * 0.25)) + 1);
                    const pool = DB.filter(u => u.cost <= 2);
                    const elitePool = DB.filter(u => u.cost >= 3 && u.cost <= 4);
                    for (let i = 0; i < count; i++) {
                        const useElite = i === 0 && elitePool.length > 0 && Math.random() < 0.3;
                        const base = useElite ? elitePool[Math.floor(Math.random() * elitePool.length)]
                                              : (pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : DB[0]);
                        this.spawnEnemy(base, i % 8, enemyOccupied, lv);
                    }
                }
            }
            else {
                this.state.generateEnemy(enemyOccupied, lv);
            }

            // ====================================================
            // ★追加：アセットのプリロード（事前読み込み）処理
            // 敵も味方も出揃ったこのタイミングで画像をかき集めます
            // ====================================================
            const imagesToLoad = [bg]; // まず背景画像をリストに追加
            
            // 参加する全ユニット（味方＋敵）の画像をリストに追加
            this.state.units.forEach(u => {
                if (typeof IMG_DATA !== 'undefined' && IMG_DATA[u.base.id]) {
                    imagesToLoad.push(IMG_DATA[u.base.id]);
                }
            });

            // プリローダーを実行して待機 (ローディング画面の裏で処理される)
            if (typeof AssetLoader !== 'undefined') {
                await AssetLoader.preloadImages(imagesToLoad);
            }
            // ====================================================

            // ロードが完了してから、背景を画面に適用する (これで真っ黒にならない)
            const screen = document.getElementById('screen-battle');
            if (screen) {
                screen.style.setProperty('background-image', `url('${bg}')`, 'important');
                screen.style.backgroundSize = 'cover';
                screen.style.backgroundPosition = 'center bottom';
                screen.style.backgroundRepeat = 'no-repeat';
            }
            // --- 以下変更なし ---
            this.battleLogs = {};
            this.state.units.forEach(u => {
                this.battleLogs[u.uid] = { name: u.base.name, damage: 0, heal: 0, kills: 0, taken: 0, id: u.base.id };
            });

            this.visuals.initBoard(this.state.units);
            this.visuals.updateBattleStatus(this.state.units);

            // ★双六HP引継ぎ: 個別HPバーを初期表示時に反映
            if (options.sugorokuMode) {
                this.state.units.forEach(u => {
                    if (u.side === 'player') {
                        this.visuals.updateHp(u, false);
                    }
                });
            }
            
            await this.sleep(500);
            this.effects.playEntrance('player'); 
            await this.visuals.playEntrance('player'); 
            await this.sleep(500); 
            this.effects.playEntrance('enemy');
            await this.visuals.playEntrance('enemy');
            await this.sleep(800); 
            
            // ★v2.2: リーダースキル適用 (パッシブの前に)
            const pLeaderLogs = this.state.applyLeaderSkill('player');
            if(pLeaderLogs.length > 0) await this.visuals.playPassiveEffect(pLeaderLogs);
            
            const eLeaderLogs = this.state.applyLeaderSkill('enemy');
            if(eLeaderLogs.length > 0) await this.visuals.playPassiveEffect(eLeaderLogs);

            const pLogs = this.state.applyStartPassives('player');
            if(pLogs.length > 0) await this.visuals.playPassiveEffect(pLogs);
            
            const eLogs = this.state.applyStartPassives('enemy');
            if(eLogs.length > 0) await this.visuals.playPassiveEffect(eLogs);
            
            this.visuals.updateBattleStatus(this.state.units);
            
            // ★チャージゲージ初期表示
            for (const u of this.state.units) {
                if (!u.isDead && this.visuals.updateCharge) {
                    this.visuals.updateCharge(u);
                }
            }
            
            await this.loop();

        } catch (e) {
            console.error("Battle Start Error:", e);
            alert("戦闘開始エラー: " + e.message);
            this.active = false;
            this.backToEdit();
        }
    }

    // 【修正】育成状況（Lv, LB, Skill）による強化ロジックへ変更
    /** ★塔用: 事前に生成された敵データからユニットをスポーン */
    _spawnPregenEnemies(pregenEnemies, occupied) {
        if (typeof Unit === 'undefined') return;
        for (const e of pregenEnemies) {
            const base = DB.find(u => u.id === e.unitId);
            if (!base) { console.warn('[Tower] Unit not found:', e.unitId); continue; }
            const uid = 'tower_e_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
            const enemy = new Unit(base, { uid: uid, unitId: e.unitId, lv: e.lv, maxLv: e.maxLv, skillLv: e.skillLv });
            enemy.battleHp = enemy.maxHp;
            const cells = enemy.getOccupiedCells(e.anchor);
            if (cells) cells.forEach(c => occupied.push(c));
            this.state.createUnit(enemy, 'enemy', e.anchor);
            console.log('[Tower] Spawned:', base.name, 'Lv' + e.lv, 'anchor:' + e.anchor);
        }
    }

    spawnEnemy(base, preferredIdx = 0, occupied = [], baseDifficulty = 1) {
        if (typeof Unit === 'undefined') return;

        const uniqueId = 'enemy_' + Date.now() + '_' + Math.floor(Math.random() * 10000);

        // ========================================================
        // ★強さの計算ロジック
        // baseDifficulty: 双六から渡される「敵レベル目安」（1～40想定）
        // ========================================================
        
        // 1. レベル決定: プレイヤー人数(8体)に対抗するため、目安の1.5倍～2倍のレベルにする
        // 例: ステージLv1 → 敵Lv5, ステージLv30 → 敵Lv60
        let actualLv = Math.floor(baseDifficulty * 1.5) + Math.floor(Math.random() * 5);
        if(actualLv < 5) actualLv = 5; // 最低Lv5

        // 2. 限界突破(LB)数決定 (0～5)
        // Lv30以上でLB1, Lv50以上でLB3, Lv70以上でLB5(完凸) のように段階的に強くする
        let lbCount = 0;
        if (actualLv >= 20) lbCount = 1;
        if (actualLv >= 35) lbCount = 2;
        if (actualLv >= 50) lbCount = 3; // ここで強力なパッシブ解禁
        if (actualLv >= 65) lbCount = 4;
        if (actualLv >= 80) lbCount = 5; // 完凸（ステータス大幅UP）

        // 3. 最大レベル(maxLv)の設定
        // LB数に合わせてmaxLvを設定しないと、Unitクラス側でLBボーナスが適用されないため
        // LB0=50, LB1=55, ... LB5=75。さらにレベル上限突破用に 99 まで確保。
        const calcMaxLv = Math.max(actualLv, 50 + (lbCount * 5));

        // 4. スキルレベル決定 (1～10)
        const skillLv = Math.min(10, 1 + Math.floor(actualLv / 10));

        // ユニット生成
        const enemySaveData = { 
            uid: uniqueId, 
            unitId: base.id, 
            lv: actualLv, 
            maxLv: calcMaxLv, 
            skillLv: skillLv 
        };
        const enemy = new Unit(base, enemySaveData);

        // ========================================================
        // ★ボス補正（オプション）
        // システム通りの強化だけでは、HPが低すぎて8人の集中攻撃で瞬殺される場合のみ
        // 「ボス補正」として少しだけHPを盛る（以前の3倍のような無茶な数値にはしない）
        // ========================================================
        if (base.bst >= 500 || base.cost >= 5) { // BST500以上の大型キャラのみ
            enemy.maxHp = Math.floor(enemy.maxHp * 1.5); // HP1.5倍（ボス補正）
            enemy.battleHp = enemy.maxHp;
        }
        
        // アンカー候補（指定位置優先）
        const allAnchors = [4, 5, 6, 7, 0, 1, 2, 3];
        const candidates = [preferredIdx, ...allAnchors.filter(x => x !== preferredIdx)];
        
        for (let anchor of candidates) {
            const cells = enemy.getOccupiedCells(anchor);
            if (cells && !cells.some(c => occupied.includes(c))) {
                cells.forEach(c => occupied.push(c));
                this.state.createUnit(enemy, 'enemy', anchor);
                // コンソールで強さを確認できるように出力
                console.log(`敵生成: ${base.name} Lv.${actualLv} (LB${lbCount}) Skill.${skillLv}`);
                return;
            }
        }
        console.warn("配置スペースがなく、敵の生成をスキップしました:", base.name);
    }

   async loop() {
        this.effects.playCutin("BATTLE START!!", '#00e5ff');
        this.visuals.cutin('player', "BATTLE START!!", null, null); 
        await this.sleep(2500);
        
        while (this.active) {
            let queue = this.state.getQueue();
            if (queue.length === 0) break;
            
            for (const actor of queue) {
                if (!this.active) break;
                if (actor.isDead) continue; 
                
                const result = this.state.checkResult();
                if (result) { this.endBattle(result); break; }

                // ★ターン開始時のステータス異常処理
                const turnStart = this.state.processStartOfTurn(actor);
                for (const log of turnStart.logs) {
                    if (log.type === 'STUN') {
                        this.visuals.showVal(actor.elem, "💫スタン！", false, false);
                        await this.effects.play('STUN', actor.elem);
                        await this.sleep(800);
                    } else if (log.type === 'SLEEP') {
                        this.visuals.showVal(actor.elem, "💤Zzz…", false, false);
                        await this.effects.play('SLEEP', actor.elem);
                        await this.sleep(800);
                    } else if (log.type === 'SLEEP_WAKE') {
                        this.visuals.showVal(actor.elem, "💤目覚めた！", false, true);
                        await this.sleep(500);
                    } else if (log.type === 'PARALYZE') {
                        this.visuals.showVal(actor.elem, "⚡しびれて動けない！", false, false);
                        await this.effects.play('PARALYZE', actor.elem);
                        await this.sleep(800);
                    } else if (log.type === 'PARALYZE_OK') {
                        this.visuals.showVal(actor.elem, "⚡痺れながらも…", false, true);
                        await this.sleep(300);
                    } else if (log.type === 'CONFUSE_ACTIVE') {
                        this.visuals.showVal(actor.elem, "🌀混乱中…", false, false);
                        await this.sleep(400);
                    } else if (log.type === 'POISON') {
                        this.visuals.showVal(actor.elem, "☠️毒！-" + log.val, false, false);
                        this.effects.play('POISON', actor.elem);
                        this.visuals.updateHp(actor, true);
                        this.visuals.updateBattleStatus(this.state.units);
                        await this.sleep(600);
                    } else if (log.type === 'DEBUFF_END' || log.type === 'BUFF_END' || log.type === 'POISON_END') {
                        this.visuals.showVal(actor.elem, log.text, false, true);
                        this.visuals.updateBattleStatus(this.state.units);
                        await this.sleep(400);
                    }
                }
                // スタン中は行動スキップ
                if (turnStart.skipTurn) {
                    await this.sleep(500);
                    continue;
                }
                
                // --- REGEN: base.passive と passives配列の両方を走査 ---
                const allP = (actor.passives && actor.passives.length > 0) 
                    ? actor.passives 
                    : (actor.base.passive ? [actor.base.passive] : []);
                let regenVal = 0;
                for (const p of allP) {
                    if (p.type === 'REGEN') { regenVal = Math.max(regenVal, p.val); break; }
                }
                if (regenVal > 0 && actor.battleHp < actor.maxHp) {
                    const heal = Math.floor(actor.maxHp * regenVal);
                    const actualHeal = Math.min(actor.maxHp - actor.battleHp, heal);
                    this.state.heal(actor, actualHeal);
                    if(this.battleLogs[actor.uid]) this.battleLogs[actor.uid].heal += actualHeal;
                    this.effects.play('REGEN', actor.elem); 
                    this.visuals.showVal(actor.elem, actualHeal, false, true); 
                    this.visuals.updateHp(actor, true);
                    this.visuals.updateBattleStatus(this.state.units);
                    await this.sleep(500); 
                }

                // ★チャージシステム: ターン毎にチャージ+1、満タンでスキル発動
                const hasSkill = actor.base.skill && actor.base.skill.type !== 'NONE';
                let skillAct = false;
                if (hasSkill && actor.chargeMax < 99) {
                    actor.chargeCount = (actor.chargeCount || 0) + 1;
                    if (actor.chargeCount >= actor.chargeMax) {
                        skillAct = true;
                        actor.chargeCount = 0; // チャージリセット
                    }
                    // チャージゲージUI更新
                    if (this.visuals && this.visuals.updateCharge) {
                        this.visuals.updateCharge(actor);
                    }
                }
                
                const isBackRow = (actor.anchorIdx >= 4);
                const hasFrontLives = this.state.units.some(u => u.side === actor.side && !u.isDead && u.anchorIdx < 4);
                if (isBackRow && hasFrontLives && !skillAct) continue; 

                // ★v2: シェイプ別行動回数 (SPEC_v2 Section 5)
                let actionCount = 1;
                if (typeof rollActionCount === 'function' && actor.base.shape) {
                    actionCount = rollActionCount(actor.base.shape);
                    // ★特性: 安定行動 → 2回固定
                    const abil = actor.base.ability || actor.base.passive;
                    if (abil && abil.type === 'STABLE_ACTION') actionCount = 2;
                    // ★特性: 暴走 → 最大値+1
                    if (abil && abil.type === 'RAMPAGE') actionCount = Math.min(actionCount + 1, 4);
                }

                // ★v2: 連撃の構え特性 (2回以上行動時ATK+20%)
                const comboAbil = actor.base.ability || actor.base.passive;
                if (actionCount >= 2 && comboAbil && comboAbil.type === 'COMBO_STANCE') {
                    actor.atk = Math.floor(actor.atk * (1 + (comboAbil.val || 0.20)));
                }

                // ★v2: 加速特性 (毎ターンSPD+10%)
                if (comboAbil && comboAbil.type === 'ACCELERATE') {
                    actor.spd = Math.floor(actor.spd * (1 + (comboAbil.val || 0.10)));
                }

                for (let actionIdx = 0; actionIdx < actionCount; actionIdx++) {
                    if (actor.isDead) break;
                    // 結果チェック (途中で決着ついたら中断)
                    if (this.state.checkResult()) break;

                    // 1回目のみスキル発動可能、2回目以降は通常攻撃のみ
                    const useSkill = (actionIdx === 0) ? skillAct : false;

                    // ★v2.2: 2回目以降のダメージ減衰 (×0.7)
                    if (actionIdx >= 1) {
                        actor._actionDecay = 0.7;
                    } else {
                        actor._actionDecay = 1.0;
                    }

                    const targetSide = (actor.side === 'player') ? 'enemy' : 'player';
                    const currentSkillType = useSkill ? actor.base.skill.type : 'NORMAL';
                    const currentSkillCount = (useSkill && actor.base.skill.count) ? actor.base.skill.count : 1;
                    
                    // ★混乱チェック: 30%で味方を攻撃
                    let actualTargetSide = targetSide;
                    const isConfused = actor.statusEffects && actor.statusEffects.find(se => se.type === 'CONFUSE');
                    if (isConfused && Math.random() < 0.30) {
                        actualTargetSide = actor.side;
                        this.visuals.showVal(actor.elem, "🌀味方を攻撃！", false, false);
                        await this.sleep(500);
                    }
                    
                    const targets = this.state.getTargets(actor, actualTargetSide, currentSkillType, currentSkillCount);
                    
                    if (targets && targets.length > 0) { 
                        await this.executeAction(actor, targets, useSkill); 
                        // 多段行動時は間隔を短く
                        await this.sleep(actionCount > 1 ? 600 : 1000);
                    }
                }
            }
        }
    }

 async executeAction(actor, targets, isSkill) {
        try {
            const skill = actor.base.skill;
            const skillType = isSkill ? skill.type : 'NORMAL';

            // ★スキル発動時のカットイン
            if (isSkill) {
                let imgUrl = null;
                if (typeof IMG_DATA !== 'undefined' && IMG_DATA[actor.base.id]) imgUrl = IMG_DATA[actor.base.id];
                
                // 動的な説明文があれば優先（状態異常特効などの数値変動対応）
                const skillDesc = (typeof actor.getSkillCurrentDesc === 'function') 
                    ? actor.getSkillCurrentDesc() 
                    : skill.desc;

                this.visuals.cutin(actor.side, skill.name, skillDesc, imgUrl);
                await this.sleep(2400); 
            }
            
            // ====================================================
            // バフ・デバフ系スキル (アイコン表示に対応)
            // ====================================================

            // --- ★BUFF: 自身のATKアップ ---
            if (skillType === 'BUFF') {
                const buffVal = skill.val || 1.5;
                actor.atk = Math.floor(actor.atk * buffVal);
                actor.originalAtk = actor.atk;
                if(app.sound) app.sound.attackBuff();
                this.visuals.showBuffIcon(actor.elem, 'ATK_UP'); // ★アイコン化
                await this.effects.playBuffActive(actor.elem);
                this.visuals.updateBattleStatus(this.state.units);
                return;
            }

            // --- ★BUFF_ALL: 味方全体のATKアップ ---
            if (skillType === 'BUFF_ALL') {
                const buffVal = skill.val || 1.3;
                for (const t of targets) {
                    if (t.isDead) continue;
                    t.atk = Math.floor(t.atk * buffVal);
                    t.originalAtk = t.atk;
                    if(app.sound) app.sound.attackBuff();
                    this.visuals.showBuffIcon(t.elem, 'ATK_UP'); // ★アイコン化
                    await this.effects.playBuffActive(t.elem);
                }
                this.visuals.updateBattleStatus(this.state.units);
                return;
            }

            // --- ★DEBUFF: 敵単体のATKダウン ---
            if (skillType === 'DEBUFF') {
                for (const t of targets) {
                    if (t.isDead) continue;
                    // 鎧砕きタイプ (DEF DOWN画像がない場合はテキスト、あればID指定)
                    if (skill.name === '鎧砕き' || skill.desc.includes('防御崩壊') || skill.desc.includes('被ダメ')) {
                        this.state.applyStatusEffect(t, { type: 'ARMOR_BREAK', val: skill.val, turns: skill.turns || 3, name: skill.name });
                        this.visuals.showVal(t.elem, "💔DEF DOWN", false, false); 
                    } else {
                        this.state.applyStatusEffect(t, { type: 'ATK_DOWN', val: skill.val, turns: skill.turns || 3, name: skill.name });
                        this.visuals.showBuffIcon(t.elem, 'ATK_DOWN'); // ★アイコン化
                    }
                    if(app.sound) app.sound.attackSnipe();
                    await this.effects.play('DEBUFF', t.elem);
                }
                this.visuals.updateBattleStatus(this.state.units);
                return;
            }

            // --- ★DEBUFF_ALL: 敵全体のATKダウン ---
            if (skillType === 'DEBUFF_ALL') {
                for (const t of targets) {
                    if (t.isDead) continue;
                    this.state.applyStatusEffect(t, { type: 'ATK_DOWN', val: skill.val, turns: skill.turns || 2, name: skill.name });
                    if(app.sound) app.sound.attackBlast();
                    this.visuals.showBuffIcon(t.elem, 'ATK_DOWN'); // ★アイコン化
                    await this.effects.play('DEBUFF', t.elem);
                }
                this.visuals.updateBattleStatus(this.state.units);
                return;
            }

            // --- ★POISON / POISON_ALL: 毒付与 (耐性判定あり) ---
            // --- ★CHARGE_DELAY: 敵のチャージを遅延 ---
            if (skillType === 'CHARGE_DELAY' || skillType === 'CHARGE_DELAY_ALL') {
                for (const t of targets) {
                    if (t.isDead) continue;
                    const delay = skill.delayTurns || 1;
                    t.chargeCount = Math.max(0, (t.chargeCount || 0) - delay);
                    if(app.sound) app.sound.attackSnipe();
                    this.visuals.showVal(t.elem, "⏳チャージ-" + delay, false, false);
                    await this.effects.play('DEBUFF', t.elem);
                    if (this.visuals.updateCharge) this.visuals.updateCharge(t);
                    await this.sleep(300);
                }
                this.visuals.updateBattleStatus(this.state.units);
                return;
            }

            // --- ★CHARGE_ACCEL: 味方のチャージを加速 ---
            if (skillType === 'CHARGE_ACCEL' || skillType === 'CHARGE_ACCEL_ALL') {
                for (const t of targets) {
                    if (t.isDead) continue;
                    const accel = skill.accelTurns || 1;
                    t.chargeCount = Math.min(t.chargeMax - 1, (t.chargeCount || 0) + accel);
                    if(app.sound) app.sound.attackBuff();
                    this.visuals.showVal(t.elem, "⚡チャージ+" + accel, false, true);
                    await this.effects.playBuffActive(t.elem);
                    if (this.visuals.updateCharge) this.visuals.updateCharge(t);
                    await this.sleep(300);
                }
                this.visuals.updateBattleStatus(this.state.units);
                return;
            }

            if (skillType === 'POISON' || skillType === 'POISON_ALL') {
                for (const t of targets) {
                    if (t.isDead) continue;
                    const applyResult = this.state.applyStatusEffect(t, { type: 'POISON', val: skill.pow || 0.10, turns: skill.turns || 3, name: skill.name });
                    if (applyResult.applied) {
                        if(app.sound) app.sound.attackPoison();
                        this.visuals.showBuffIcon(t.elem, 'POISON'); // ★アイコン化
                        await this.effects.play('POISON', t.elem);
                    } else if (applyResult.resisted) {
                        this.visuals.showVal(t.elem, "耐性！無効", false, true);
                    }
                    await this.sleep(200);
                }
                this.visuals.updateBattleStatus(this.state.units);
                return;
            }

            // ====================================================
            // ダメージ + 状態異常付与系 (STUN, SLEEP, PARALYZE...)
            // ====================================================

            // --- ★STUN: ダメージ + スタン付与 ---
            if (skillType === 'STUN') {
                if(app.sound) app.sound.attackSmash();
                this.visuals.setAttackMotion(actor, true);
                await this.sleep(300);
                for (const t of targets) {
                    if (t.isDead) continue;
                    let basePower = actor.skillPow || skill.pow || 1.0;
                    let val;
                    { // v2 damage calc
                        const _res = t.res || t.base.res || 30;
                        const _c = (typeof DMG_COEFFICIENT !== 'undefined') ? DMG_COEFFICIENT : 50;
                        if (actor.skillPowerPct) {
                            val = Math.max(1, Math.floor((actor.atk * (actor.skillPowerPct / 100) / Math.max(1, _res)) * _c * (0.85 + Math.random() * 0.15)));
                        } else {
                            val = Math.floor(actor.atk * basePower);
                            val = Math.floor(val * (0.9 + Math.random() * 0.2));
                        }
                    }
                    await this.effects.play('SMASH', t.elem);
                    const oldHp = t.battleHp;
                    const dmgResult = this.state.applyDamage(t, val, actor);
                    
                    if (dmgResult.flags && dmgResult.flags.dodged) {
                        this.visuals.showVal(t.elem, "DODGE!", false, false);
                        continue;
                    }
                    if (dmgResult.flags && dmgResult.flags.invincible) {
                        this.visuals.showVal(t.elem, "✨無敵！", false, false);
                        continue;
                    }
                    
                    if(app.sound) app.sound.damage();
                    this.visuals.showVal(t.elem, dmgResult.damage, dmgResult.flags);
                    this.visuals.playHitEffect(t);
                    this.visuals.updateHp(t, true);
                    if(this.battleLogs[actor.uid]) this.battleLogs[actor.uid].damage += (oldHp - t.battleHp);
                    if(this.battleLogs[t.uid]) this.battleLogs[t.uid].taken += (oldHp - t.battleHp);

                    // スタン付与判定
                    if (!t.isDead) {
                        await this.sleep(300);
                        const ailRate = skill.ailRate || 0.70;
                        const applyResult = (Math.random() < ailRate)
                            ? this.state.applyStatusEffect(t, { type: 'STUN', val: 1, turns: 1, name: skill.name })
                            : { applied: false, resisted: false };
                        
                        if (applyResult.applied) {
                            this.visuals.showBuffIcon(t.elem, 'STUN'); // ★アイコン化
                            await this.effects.play('STUN', t.elem);
                        } else if (applyResult.resisted) {
                            this.visuals.showVal(t.elem, "耐性！無効", false, true);
                        } else {
                            this.visuals.showVal(t.elem, "RESIST!", false, true);
                        }
                    } else {
                        await this.sleep(400);
                        this.visuals.setDead(t);
                        if(app.sound) app.sound.defeat();
                        if(this.battleLogs[actor.uid]) this.battleLogs[actor.uid].kills += 1;
                    }
                    if (dmgResult.flags && dmgResult.flags.guts) {
                        await this.sleep(300);
                        this.visuals.showVal(t.elem, "根性!", false, true);
                    }
                }
                this.visuals.updateBattleStatus(this.state.units);
                this.visuals.setAttackMotion(actor, false);
                return;
            }

            // --- ★DMG_DEBUFF: ダメージ + ATKデバフ(単体) ---
            if (skillType === 'DMG_DEBUFF') {
                if(app.sound) app.sound.attackSmash();
                this.visuals.setAttackMotion(actor, true);
                await this.sleep(300);
                for (const t of targets) {
                    if (t.isDead) continue;
                    let basePower = actor.skillPow || skill.pow || 1.0;
                    let val;
                    { // v2 damage calc
                        const _res = t.res || t.base.res || 30;
                        const _c = (typeof DMG_COEFFICIENT !== 'undefined') ? DMG_COEFFICIENT : 50;
                        if (actor.skillPowerPct) {
                            val = Math.max(1, Math.floor((actor.atk * (actor.skillPowerPct / 100) / Math.max(1, _res)) * _c * (0.85 + Math.random() * 0.15)));
                        } else {
                            val = Math.floor(actor.atk * basePower);
                            val = Math.floor(val * (0.9 + Math.random() * 0.2));
                        }
                    }
                    await this.effects.play('SMASH', t.elem);
                    const oldHp = t.battleHp;
                    const dmgResult = this.state.applyDamage(t, val, actor);
                    if (dmgResult.flags && dmgResult.flags.dodged) {
                        this.visuals.showVal(t.elem, "DODGE!", false, false);
                        continue;
                    }
                    if (dmgResult.flags && dmgResult.flags.invincible) {
                        this.visuals.showVal(t.elem, "✨無敵！", false, false);
                        continue;
                    }
                    if(app.sound) app.sound.damage();
                    this.visuals.showVal(t.elem, dmgResult.damage, dmgResult.flags);
                    this.visuals.playHitEffect(t);
                    this.visuals.updateHp(t, true);
                    if(this.battleLogs[actor.uid]) this.battleLogs[actor.uid].damage += (oldHp - t.battleHp);
                    
                    if (!t.isDead) {
                        await this.sleep(300);
                        this.state.applyStatusEffect(t, { type: 'ATK_DOWN', val: skill.val || 0.7, turns: skill.turns || 2, name: skill.name });
                        this.visuals.showBuffIcon(t.elem, 'ATK_DOWN'); // ★アイコン化
                        await this.effects.play('DEBUFF', t.elem);
                    } else {
                        await this.sleep(400);
                        this.visuals.setDead(t);
                        if(app.sound) app.sound.defeat();
                        if(this.battleLogs[actor.uid]) this.battleLogs[actor.uid].kills += 1;
                    }
                    if (dmgResult.flags && dmgResult.flags.guts) {
                        await this.sleep(300);
                        this.visuals.showVal(t.elem, "根性!", false, true);
                    }
                }
                this.visuals.updateBattleStatus(this.state.units);
                this.visuals.setAttackMotion(actor, false);
                return;
            }

            // --- ★DMG_DEBUFF_ALL: 全体ダメージ + ATKデバフ ---
            if (skillType === 'DMG_DEBUFF_ALL') {
                if(app.sound) app.sound.attackBlast();
                this.visuals.setAttackMotion(actor, true);
                await this.sleep(300);
                for (const t of targets) {
                    if (t.isDead) continue;
                    let basePower = actor.skillPow || skill.pow || 1.0;
                    let val;
                    { // v2 damage calc
                        const _res = t.res || t.base.res || 30;
                        const _c = (typeof DMG_COEFFICIENT !== 'undefined') ? DMG_COEFFICIENT : 50;
                        if (actor.skillPowerPct) {
                            val = Math.max(1, Math.floor((actor.atk * (actor.skillPowerPct / 100) / Math.max(1, _res)) * _c * (0.85 + Math.random() * 0.15)));
                        } else {
                            val = Math.floor(actor.atk * basePower);
                            val = Math.floor(val * (0.9 + Math.random() * 0.2));
                        }
                    }
                    await this.effects.play('BLAST', t.elem);
                    const oldHp = t.battleHp;
                    const dmgResult = this.state.applyDamage(t, val, actor);
                    if (dmgResult.flags && dmgResult.flags.dodged) {
                        this.visuals.showVal(t.elem, "DODGE!", false, false);
                        continue;
                    }
                    if (dmgResult.flags && dmgResult.flags.invincible) {
                        this.visuals.showVal(t.elem, "✨無敵！", false, false);
                        continue;
                    }
                    if(app.sound) app.sound.damage();
                    this.visuals.showVal(t.elem, dmgResult.damage, dmgResult.flags);
                    this.visuals.playHitEffect(t);
                    this.visuals.updateHp(t, true);
                    if(this.battleLogs[actor.uid]) this.battleLogs[actor.uid].damage += (oldHp - t.battleHp);
                    
                    if (!t.isDead) {
                        this.state.applyStatusEffect(t, { type: 'ATK_DOWN', val: skill.val || 0.75, turns: skill.turns || 2, name: skill.name });
                        this.visuals.showBuffIcon(t.elem, 'ATK_DOWN'); // ★アイコン化
                    } else {
                        this.visuals.setDead(t);
                        if(app.sound) app.sound.defeat();
                        if(this.battleLogs[actor.uid]) this.battleLogs[actor.uid].kills += 1;
                    }
                    if (dmgResult.flags && dmgResult.flags.guts) {
                        this.visuals.showVal(t.elem, "根性!", false, true);
                    }
                    await this.sleep(200);
                }
                this.visuals.updateBattleStatus(this.state.units);
                this.visuals.setAttackMotion(actor, false);
                return;
            }

            // ====================================================
            // 回復 + バフ付与系
            // ====================================================

            // --- ★HEAL_BUFF: 味方全体回復 + ATKバフ ---
            if (skillType === 'HEAL_BUFF') {
                for (const t of targets) {
                    if (t.isDead) continue;
                    // 回復
                    let healVal = Math.floor(t.maxHp * (skill.pow || 0.5));
                    healVal = Math.floor(healVal * (0.9 + Math.random() * 0.2));
                    this.state.heal(t, healVal);
                    if(this.battleLogs[actor.uid]) this.battleLogs[actor.uid].heal += healVal;
                    if(app.sound) app.sound.heal();
                    this.visuals.showVal(t.elem, healVal, false, true);
                    this.visuals.updateHp(t, true);
                    
                    // ATKバフ
                    const buffVal = skill.val || 1.2;
                    t.atk = Math.floor(t.atk * buffVal);
                    t.originalAtk = t.atk;
                    await this.effects.playBuffActive(t.elem);
                    this.visuals.showBuffIcon(t.elem, 'ATK_UP'); // ★アイコン化
                    await this.sleep(200);
                }
                this.visuals.updateBattleStatus(this.state.units);
                return;
            }

            // --- ★DEF_BUFF_ALL: 味方全体 被ダメ軽減 ---
            if (skillType === 'DEF_BUFF_ALL') {
                for (const t of targets) {
                    if (t.isDead) continue;
                    this.state.applyStatusEffect(t, { type: 'DEF_UP', val: skill.val || 0.6, turns: skill.turns || 3, name: skill.name });
                    if(app.sound) app.sound.attackBuff();
                    this.visuals.showBuffIcon(t.elem, 'DEF_UP'); // ★アイコン化
                    await this.effects.playBuffActive(t.elem);
                    await this.sleep(150);
                }
                this.visuals.updateBattleStatus(this.state.units);
                return;
            }


            // --- ★HEAL_SHIELD: 味方全体回復 + ダメカット ---
            if (skillType === 'HEAL_SHIELD') {
                for (const t of targets) {
                    if (t.isDead) continue;
                    let healVal = Math.floor(t.maxHp * (skill.pow || 0.6));
                    healVal = Math.floor(healVal * (0.9 + Math.random() * 0.2));
                    this.state.heal(t, healVal);
                    if(this.battleLogs[actor.uid]) this.battleLogs[actor.uid].heal += healVal;
                    if(app.sound) app.sound.heal();
                    this.visuals.showVal(t.elem, healVal, false, true);
                    this.visuals.updateHp(t, true);
                    
                    this.state.applyStatusEffect(t, { type: 'HALF_DMG', val: skill.val || 0.5, turns: skill.turns || 1, name: skill.name });
                    await this.effects.playBuffActive(t.elem);
                    this.visuals.showBuffIcon(t.elem, 'HALF_DMG'); // ★アイコン化
                    await this.sleep(200);
                }
                this.visuals.updateBattleStatus(this.state.units);
                return;
            }

            // --- ★HEAL_INVINCIBLE: 味方単体大回復 + 無敵 ---
            if (skillType === 'HEAL_INVINCIBLE') {
                for (const t of targets) {
                    if (t.isDead) continue;
                    let healVal = Math.floor(t.maxHp * (skill.pow || 1.5));
                    healVal = Math.floor(healVal * (0.9 + Math.random() * 0.2));
                    this.state.heal(t, healVal);
                    if(this.battleLogs[actor.uid]) this.battleLogs[actor.uid].heal += healVal;
                    if(app.sound) app.sound.heal();
                    this.visuals.showVal(t.elem, healVal, false, true);
                    this.visuals.updateHp(t, true);
                    await this.sleep(300);
                    
                    this.state.applyStatusEffect(t, { type: 'INVINCIBLE', val: 0, turns: skill.turns || 1, name: skill.name });
                    await this.effects.playBuffActive(t.elem);
                    this.visuals.showBuffIcon(t.elem, 'INVINCIBLE'); // ★アイコン化
                    await this.sleep(200);
                }
                this.visuals.updateBattleStatus(this.state.units);
                return;
            }

            // --- ★HEAL_RESIST: 味方全体回復 + 状態異常耐性UP ---
            if (skillType === 'HEAL_RESIST') {
                for (const t of targets) {
                    if (t.isDead) continue;
                    let healVal = Math.floor(t.maxHp * (skill.pow || 0.5));
                    healVal = Math.floor(healVal * (0.9 + Math.random() * 0.2));
                    this.state.heal(t, healVal);
                    if(this.battleLogs[actor.uid]) this.battleLogs[actor.uid].heal += healVal;
                    if(app.sound) app.sound.heal();
                    this.visuals.showVal(t.elem, healVal, false, true);
                    this.visuals.updateHp(t, true);
                    
                    this.state.applyStatusEffect(t, { type: 'STATUS_RESIST_UP', val: skill.resistVal || 0.50, turns: skill.turns || 3, name: skill.name });
                    await this.effects.playBuffActive(t.elem);
                    this.visuals.showBuffIcon(t.elem, 'STATUS_RESIST_UP'); // ★アイコン化
                    await this.sleep(200);
                }
                this.visuals.updateBattleStatus(this.state.units);
                return;
            }

            // --- ★HEAL_SPD: 味方全体回復 + SPD UP ---
            if (skillType === 'HEAL_SPD') {
                for (const t of targets) {
                    if (t.isDead) continue;
                    let healVal = Math.floor(t.maxHp * (skill.pow || 0.5));
                    healVal = Math.floor(healVal * (0.9 + Math.random() * 0.2));
                    this.state.heal(t, healVal);
                    if(this.battleLogs[actor.uid]) this.battleLogs[actor.uid].heal += healVal;
                    if(app.sound) app.sound.heal();
                    this.visuals.showVal(t.elem, healVal, false, true);
                    this.visuals.updateHp(t, true);
                    
                    this.state.applyStatusEffect(t, { type: 'SPD_UP', val: skill.spdMul || 1.5, turns: skill.turns || 3, name: skill.name });
                    await this.effects.playBuffActive(t.elem);
                    this.visuals.showBuffIcon(t.elem, 'SPD_UP'); // ★アイコン化
                    await this.sleep(200);
                }
                this.visuals.updateBattleStatus(this.state.units);
                return;
            }

            // ====================================================
            // 状態異常攻撃系 (SLEEP, PARALYZE, BLIND, CONFUSE)
            // ====================================================

            // --- ★SLEEP: ダメージ + 睡眠付与 ---
            if (skillType === 'SLEEP') {
                if(app.sound) app.sound.attackSleep();
                this.visuals.setAttackMotion(actor, true);
                await this.sleep(300);
                for (const t of targets) {
                    if (t.isDead) continue;
                    let basePower = actor.skillPow || skill.pow || 0.5;
                    let val = Math.floor(actor.atk * basePower);
                    val = Math.floor(val * (0.9 + Math.random() * 0.2));
                    if (val > 0) {
                        await this.effects.play('SMASH', t.elem);
                        const oldHp = t.battleHp;
                        const dmgResult = this.state.applyDamage(t, val, actor);
                        if (dmgResult.flags && dmgResult.flags.dodged) {
                            this.visuals.showVal(t.elem, "DODGE!", false, false);
                            continue;
                        }
                        if (dmgResult.flags && dmgResult.flags.invincible) {
                            this.visuals.showVal(t.elem, "✨無敵！", false, false);
                            continue;
                        }
                        if(app.sound) app.sound.damage();
                        this.visuals.showVal(t.elem, dmgResult.damage, dmgResult.flags);
                        this.visuals.playHitEffect(t);
                        this.visuals.updateHp(t, true);
                        if(this.battleLogs[actor.uid]) this.battleLogs[actor.uid].damage += (oldHp - t.battleHp);
                    }
                    if (!t.isDead) {
                        await this.sleep(300);
                        const ailRate = skill.ailRate || 0.75;
                        const applyResult = (Math.random() < ailRate) 
                            ? this.state.applyStatusEffect(t, { type: 'SLEEP', val: 0, turns: skill.turns || 2, name: skill.name })
                            : { applied: false, resisted: false };
                        if (applyResult.applied) {
                            this.visuals.showBuffIcon(t.elem, 'SLEEP'); // ★アイコン化
                            await this.effects.play('SLEEP', t.elem);
                        } else if (applyResult.resisted) {
                            this.visuals.showVal(t.elem, "耐性！無効", false, true);
                        } else {
                            this.visuals.showVal(t.elem, "RESIST!", false, true);
                        }
                    } else {
                        await this.sleep(400);
                        this.visuals.setDead(t);
                        if(app.sound) app.sound.defeat();
                        if(this.battleLogs[actor.uid]) this.battleLogs[actor.uid].kills += 1;
                    }
                }
                this.visuals.updateBattleStatus(this.state.units);
                this.visuals.setAttackMotion(actor, false);
                return;
            }

            // --- ★PARALYZE: ダメージ + 麻痺付与 (MULTI型対応) ---
            if (skillType === 'PARALYZE') {
                if(app.sound) app.sound.attackParalyze();
                this.visuals.setAttackMotion(actor, true);
                await this.sleep(300);
                const paraApplied = new Set(); 
                for (const t of targets) {
                    if (t.isDead) continue;
                    let basePower = actor.skillPow || skill.pow || 1.0;
                    let val;
                    { // v2 damage calc
                        const _res = t.res || t.base.res || 30;
                        const _c = (typeof DMG_COEFFICIENT !== 'undefined') ? DMG_COEFFICIENT : 50;
                        if (actor.skillPowerPct) {
                            val = Math.max(1, Math.floor((actor.atk * (actor.skillPowerPct / 100) / Math.max(1, _res)) * _c * (0.85 + Math.random() * 0.15)));
                        } else {
                            val = Math.floor(actor.atk * basePower);
                            val = Math.floor(val * (0.9 + Math.random() * 0.2));
                        }
                    }
                    await this.effects.play('STUN', t.elem);
                    const oldHp = t.battleHp;
                    const dmgResult = this.state.applyDamage(t, val, actor);
                    if (dmgResult.flags && dmgResult.flags.dodged) {
                        this.visuals.showVal(t.elem, "DODGE!", false, false);
                        await this.sleep(200);
                        continue;
                    }
                    if (dmgResult.flags && dmgResult.flags.invincible) {
                        this.visuals.showVal(t.elem, "✨無敵！", false, false);
                        continue;
                    }
                    if(app.sound) app.sound.damage();
                    this.visuals.showVal(t.elem, dmgResult.damage, dmgResult.flags);
                    this.visuals.playHitEffect(t);
                    this.visuals.updateHp(t, true);
                    if(this.battleLogs[actor.uid]) this.battleLogs[actor.uid].damage += (oldHp - t.battleHp);
                    
                    if (!t.isDead && !paraApplied.has(t.uid)) {
                        paraApplied.add(t.uid);
                        const ailRate = skill.ailRate || 0.60;
                        if (Math.random() < ailRate) {
                            const applyResult = this.state.applyStatusEffect(t, { type: 'PARALYZE', val: 0.40, turns: skill.turns || 3, name: skill.name });
                            if (applyResult.applied) {
                                this.visuals.showBuffIcon(t.elem, 'PARALYZE'); // ★アイコン化
                                await this.effects.play('PARALYZE', t.elem);
                            } else if (applyResult.resisted) {
                                this.visuals.showVal(t.elem, "耐性！無効", false, true);
                            }
                        }
                    } else if (t.isDead) {
                        this.visuals.setDead(t);
                        if(app.sound) app.sound.defeat();
                        if(this.battleLogs[actor.uid]) this.battleLogs[actor.uid].kills += 1;
                    }
                    if (dmgResult.flags && dmgResult.flags.guts) {
                        await this.sleep(300);
                        this.visuals.showVal(t.elem, "根性!", false, true);
                    }
                    await this.sleep(200);
                }
                this.visuals.updateBattleStatus(this.state.units);
                this.visuals.setAttackMotion(actor, false);
                return;
            }

            // --- ★BLIND / BLIND_ALL: ダメージ + 暗闇付与 ---
            if (skillType === 'BLIND' || skillType === 'BLIND_ALL') {
                if(app.sound) app.sound.attackBlind();
                this.visuals.setAttackMotion(actor, true);
                await this.sleep(300);
                for (const t of targets) {
                    if (t.isDead) continue;
                    let basePower = actor.skillPow || skill.pow || 0.6;
                    let val = Math.floor(actor.atk * basePower);
                    val = Math.floor(val * (0.9 + Math.random() * 0.2));
                    if (val > 0) {
                        await this.effects.play('DEBUFF', t.elem);
                        const oldHp = t.battleHp;
                        const dmgResult = this.state.applyDamage(t, val, actor);
                        if (dmgResult.flags && dmgResult.flags.dodged) {
                            this.visuals.showVal(t.elem, "DODGE!", false, false);
                            await this.sleep(200);
                            continue;
                        }
                        if (dmgResult.flags && dmgResult.flags.invincible) {
                            this.visuals.showVal(t.elem, "✨無敵！", false, false);
                            continue;
                        }
                        if(app.sound) app.sound.damage();
                        this.visuals.showVal(t.elem, dmgResult.damage, dmgResult.flags);
                        this.visuals.playHitEffect(t);
                        this.visuals.updateHp(t, true);
                        if(this.battleLogs[actor.uid]) this.battleLogs[actor.uid].damage += (oldHp - t.battleHp);
                    }
                    if (!t.isDead) {
                        const ailRate = skill.ailRate || 0.70;
                        if (Math.random() < ailRate) {
                            const applyResult = this.state.applyStatusEffect(t, { type: 'BLIND', val: 0.50, turns: skill.turns || 3, name: skill.name });
                            if (applyResult.applied) {
                                this.visuals.showBuffIcon(t.elem, 'BLIND'); // ★アイコン化
                                await this.effects.play('BLIND', t.elem);
                            } else if (applyResult.resisted) {
                                this.visuals.showVal(t.elem, "耐性！無効", false, true);
                            }
                        }
                    } else {
                        this.visuals.setDead(t);
                        if(app.sound) app.sound.defeat();
                        if(this.battleLogs[actor.uid]) this.battleLogs[actor.uid].kills += 1;
                    }
                    await this.sleep(200);
                }
                this.visuals.updateBattleStatus(this.state.units);
                this.visuals.setAttackMotion(actor, false);
                return;
            }

            // --- ★CONFUSE / CONFUSE_ALL: ダメージ + 混乱付与 ---
            if (skillType === 'CONFUSE' || skillType === 'CONFUSE_ALL') {
                if(app.sound) app.sound.attackConfuse();
                this.visuals.setAttackMotion(actor, true);
                await this.sleep(300);
                for (const t of targets) {
                    if (t.isDead) continue;
                    let basePower = actor.skillPow || skill.pow || 0.6;
                    let val = Math.floor(actor.atk * basePower);
                    val = Math.floor(val * (0.9 + Math.random() * 0.2));
                    if (val > 0) {
                        await this.effects.play('DEBUFF', t.elem);
                        const oldHp = t.battleHp;
                        const dmgResult = this.state.applyDamage(t, val, actor);
                        if (dmgResult.flags && dmgResult.flags.dodged) {
                            this.visuals.showVal(t.elem, "DODGE!", false, false);
                            await this.sleep(200);
                            continue;
                        }
                        if (dmgResult.flags && dmgResult.flags.invincible) {
                            this.visuals.showVal(t.elem, "✨無敵！", false, false);
                            continue;
                        }
                        if(app.sound) app.sound.damage();
                        this.visuals.showVal(t.elem, dmgResult.damage, dmgResult.flags);
                        this.visuals.playHitEffect(t);
                        this.visuals.updateHp(t, true);
                        if(this.battleLogs[actor.uid]) this.battleLogs[actor.uid].damage += (oldHp - t.battleHp);
                    }
                    if (!t.isDead) {
                        const ailRate = skill.ailRate || 0.55;
                        if (Math.random() < ailRate) {
                            const applyResult = this.state.applyStatusEffect(t, { type: 'CONFUSE', val: 0.30, turns: skill.turns || 2, name: skill.name });
                            if (applyResult.applied) {
                                this.visuals.showBuffIcon(t.elem, 'CONFUSE'); // ★アイコン化
                                await this.effects.play('CONFUSE', t.elem);
                            } else if (applyResult.resisted) {
                                this.visuals.showVal(t.elem, "耐性！無効", false, true);
                            }
                        }
                    } else {
                        this.visuals.setDead(t);
                        if(app.sound) app.sound.defeat();
                        if(this.battleLogs[actor.uid]) this.battleLogs[actor.uid].kills += 1;
                    }
                    await this.sleep(200);
                }
                this.visuals.updateBattleStatus(this.state.units);
                this.visuals.setAttackMotion(actor, false);
                return;
            }

            // ====================================================
            // 通常攻撃・その他攻撃スキル
            // ====================================================

            // スタイル別に攻撃音を分岐
            if(app.sound) {
                switch(skillType) {
                    case 'SMASH':
                    case 'SINGLE':      app.sound.attackSmash(); break;
                    case 'BLAST':
                    case 'SPLASH':      app.sound.attackBlast(); break;
                    case 'SNIPE':
                    case 'SNIPE_HIGH':  app.sound.attackSnipe(); break;
                    case 'MULTI':       app.sound.attackMulti(); break;
                    case 'LINE_H':
                    case 'LINE_V':      app.sound.attackLine();  break;
                    case 'CROSS':       app.sound.attackCross(); break;
                    case 'VAMP':        app.sound.attackVamp();  break;
                    case 'ASSASSIN':    app.sound.attackSnipe(); break;
                    default:            app.sound.attack();      break;
                }
            }
            this.visuals.setAttackMotion(actor, true);
            await this.sleep(300); 
            
            let baseProb = isSkill ? (skill.prob !== undefined ? skill.prob : 1.0) : 0.95;
            if (isSkill) baseProb += (actor.save.skillLv - 1) * 0.02;
            
            // ★AoE命中率補正: 全体・範囲スキルは対象数に応じて命中率低下
            const AOE_SKILL_TYPES = ['BLAST', 'LINE_H', 'LINE_V', 'CROSS', 'SPLASH'];
            if (isSkill && AOE_SKILL_TYPES.includes(skillType) && targets.length > 1) {
                const aoePenalty = Math.max(0.55, 1.0 - (targets.length * 0.10));
                baseProb *= aoePenalty;
                console.log(`[AoE HitRate] ${skill.name} targets=${targets.length} prob=${baseProb.toFixed(2)}`);
            }

            // ★暗闇チェック: 命中率-50%
            const isBlinded = actor.statusEffects && actor.statusEffects.find(se => se.type === 'BLIND');
            if (isBlinded) baseProb *= 0.50;

            for (let i = 0; i < targets.length; i++) {
                const t = targets[i];
                if (!t) continue;
                if (t.isDead && skillType !== 'HEAL' && skillType !== 'HEAL_ALL') continue;
                
                const isHeal = (skillType === 'HEAL' || skillType === 'HEAL_ALL');
                const isHit = isHeal ? true : (Math.random() < baseProb);

                if (!isHit) {
                    if(app.sound) app.sound.attackMiss();
                    if (isBlinded) this.visuals.showVal(t.elem, "🌑MISS!", false, false);
                    this.visuals.playDodgeMotion(t);
                    if (targets.length > 1) await this.sleep(200);
                    continue; 
                }

                await this.effects.play(skillType, t.elem);
                
                let basePower = isSkill ? (actor.skillPow || 1.0) : 1.0;

                if (isHeal) {
                    // ★v2: 回復量 = ATK × power% (新), or ATK × pow (旧)
                    let healPow = (skill.power) ? (skill.power / 100) : (skill.pow || 1.0);
                    let val = Math.floor(actor.atk * healPow);
                    val = Math.floor(val * (0.85 + Math.random() * 0.15));
                    const actualHeal = Math.min(t.maxHp - t.battleHp, val);
                    this.state.heal(t, val);
                    if(this.battleLogs[actor.uid]) this.battleLogs[actor.uid].heal += actualHeal;
                    if(app.sound) app.sound.heal();
                    this.visuals.showVal(t.elem, val, false, true); 
                    this.visuals.updateHp(t, true);
                } else {
                    // ★v2: 新ダメージ計算式 (SPEC_v2 Section 3)
                    let val;
                    const targetDef = t.def || t.base.def || 30;
                    const targetRes = t.res || t.base.res || 30;
                    const coeff = (typeof DMG_COEFFICIENT !== 'undefined') ? DMG_COEFFICIENT : 50;
                    const rand = 0.85 + Math.random() * 0.15;

                    if (isSkill && actor.skillPowerPct) {
                        // スキル攻撃: (ATK × スキル威力% / RES) × 50 × 乱数
                        val = Math.max(1, Math.floor((actor.atk * (actor.skillPowerPct / 100) / Math.max(1, targetRes)) * coeff * rand));
                    } else if (isSkill) {
                        // 旧スキル互換: ATK × skillPow (倍率)
                        val = Math.floor(actor.atk * basePower);
                        val = Math.floor(val * (0.85 + Math.random() * 0.15));
                    } else {
                        // 通常攻撃: (ATK / DEF) × 50 × 乱数
                        val = Math.max(1, Math.floor((actor.atk / Math.max(1, targetDef)) * coeff * rand));
                    }
                    
                    // ★睡眠中の敵は被ダメ1.5倍 + 覚醒
                    const wasSleeping = this.state.wakeOnHit(t);
                    if (wasSleeping) val = Math.floor(val * 1.5);

                    // ★v2.2: 複数行動の減衰 (2回目以降×0.7)
                    if (actor._actionDecay && actor._actionDecay < 1.0) {
                        val = Math.floor(val * actor._actionDecay);
                    }
                    
                    if (skillType === 'VAMP') {
                        const drain = Math.floor(val * 0.5);
                        this.state.heal(actor, drain);
                        if(this.battleLogs[actor.uid]) this.battleLogs[actor.uid].heal += drain;
                        this.visuals.showVal(actor.elem, drain, false, true);
                        this.visuals.updateHp(actor, true);
                    }
                    const oldHp = t.battleHp;
                    const result = this.state.applyDamage(t, val, actor);

                    // --- DODGE: 回避成功 ---
                    if (result.flags && result.flags.dodged) {
                        if(app.sound) app.sound.attackMiss();
                        this.visuals.showVal(t.elem, "DODGE!", false, false);
                        this.visuals.playDodgeMotion(t);
                        if (targets.length > 1) await this.sleep(200);
                        continue;
                    }

                    if (result.flags && result.flags.invincible) {
                        this.visuals.showVal(t.elem, "✨無敵！", false, false);
                        if (targets.length > 1) await this.sleep(200);
                        continue;
                    }
                    // ★睡眠から覚醒した表示
                    if (wasSleeping) {
                        this.visuals.showVal(t.elem, "💤目覚めた！ 1.5x", false, false);
                        await this.sleep(200);
                    }

                    const damageDealt = oldHp - t.battleHp;
                    if(this.battleLogs[actor.uid]) this.battleLogs[actor.uid].damage += damageDealt;
                    if(this.battleLogs[t.uid]) this.battleLogs[t.uid].taken += damageDealt;
                    
                    if(app.sound) app.sound.damage();
                    this.visuals.showVal(t.elem, result.damage, result.flags); 
                    this.visuals.playHitEffect(t);
                    this.visuals.updateHp(t, true);

                    // ★v2: 属性相性テキスト表示
                    if (result.flags && result.flags.weak) {
                        await this.sleep(200);
                        this.visuals.showVal(t.elem, "効果抜群！", false, false);
                    } else if (result.flags && result.flags.resist) {
                        await this.sleep(200);
                        this.visuals.showVal(t.elem, "いまひとつ…", false, false);
                    }

                    // --- GUTS: 根性で耐えた演出 ---
                    if (result.flags && result.flags.guts) {
                        await this.sleep(300);
                        this.visuals.showVal(t.elem, "根性!", false, true);
                        console.log(`[Guts演出] ${t.base.name}`);
                    }

                    // --- COUNTER: 反撃処理 ---
                    if (!t.isDead) {
                        const tAllP = (t.passives && t.passives.length > 0) ? t.passives : (t.base.passive ? [t.base.passive] : []);
                        for (const p of tAllP) {
                            if ((p.type === 'COUNTER' || p.code === 'COUNTER') && Math.random() < p.val) {
                                const counterDmg = Math.floor(t.atk * 0.5);
                                const oldAHp = actor.battleHp;
                                this.state.applyDamage(actor, counterDmg, null);
                                const cDealt = oldAHp - actor.battleHp;
                                if(this.battleLogs[t.uid]) this.battleLogs[t.uid].damage += cDealt;
                                if(app.sound) app.sound.damage();
                                this.visuals.showVal(actor.elem, "反撃!" + counterDmg, false, false);
                                this.visuals.playHitEffect(actor);
                                this.visuals.updateHp(actor, true);
                                if (actor.isDead) {
                                    await this.sleep(400);
                                    this.visuals.setDead(actor);
                                    if(app.sound) app.sound.defeat();
                                }
                                console.log(`[Counter] ${t.base.name} -> ${actor.base.name} ${counterDmg}dmg`);
                                break;
                            }
                        }
                    }

                    // 死亡時の処理
                    if (t.isDead) {
                        await this.sleep(400);
                        this.visuals.setDead(t);
                        if(app.sound) app.sound.defeat();
                        if(this.battleLogs[actor.uid]) this.battleLogs[actor.uid].kills += 1;

                        // --- AVENGER: 味方が倒れた時、同陣営のAVENGER持ちのATK UP ---
                        const allies = this.state.units.filter(u => u.side === t.side && !u.isDead && u !== t);
                        for (const ally of allies) {
                            const allyP = (ally.passives && ally.passives.length > 0) ? ally.passives : (ally.base.passive ? [ally.base.passive] : []);
                            for (const p of allyP) {
                                if (p.type === 'AVENGER' || p.code === 'AVENGER') {
                                    ally.atk = Math.floor(ally.atk * (1 + p.val));
                                    this.visuals.showVal(ally.elem, "復讐!ATK UP", false, true);
                                    console.log(`[Avenger] ${ally.base.name} ATK -> ${ally.atk}`);
                                }
                            }
                        }
                    }
                }
                this.visuals.updateBattleStatus(this.state.units);
                if (targets.length > 1) await this.sleep(400); 
            }

            // --- BERSERK: 攻撃後にATK上昇 ---
            if (!actor.isDead) {
                const actorP = (actor.passives && actor.passives.length > 0) ? actor.passives : (actor.base.passive ? [actor.base.passive] : []);
                for (const p of actorP) {
                    if (p.type === 'BERSERK' || p.code === 'BERSERK') {
                        actor.atk = Math.floor(actor.atk * (1 + p.val));
                        this.visuals.showVal(actor.elem, "狂化!ATK UP", false, true);
                        console.log(`[Berserk] ${actor.base.name} ATK -> ${actor.atk}`);
                        break;
                    }
                }
                // ★v2: ABSORB — 攻撃ダメージの一部をHP回復
                for (const p of actorP) {
                    if (p.type === 'ABSORB') {
                        const totalDmg = this.battleLogs[actor.uid] ? this.battleLogs[actor.uid].damage : 0;
                        if (totalDmg > 0) {
                            const healAmt = Math.floor(totalDmg * (p.val || 0.15) * 0.3);
                            if (healAmt > 0 && actor.battleHp < actor.maxHp) {
                                this.state.heal(actor, healAmt);
                                this.visuals.showVal(actor.elem, `吸収+${healAmt}`, false, true);
                                this.visuals.updateHp(actor, true);
                            }
                        }
                        break;
                    }
                }
            }

            await this.sleep(300);
            this.visuals.setAttackMotion(actor, false);
            await this.sleep(800); 

        } catch (e) {
            console.error("Action Error:", e);
            this.active = false;
        }
    }

    endBattle(result) {
        this.active = false;
        this.lastBattleResult = result; 
        const isWin = (result === 'win');
        if(app.sound) {
            if(isWin) app.sound.win();
            else app.sound.lose();
        }
        setTimeout(() => { this.showResultPanel(isWin); }, 1000);
    }

   /**
     * リザルト画面の表示 (MVP、グラフ、報酬)
     * 修正ポイント: 変数参照の安定化とアニメーションの確実な実行
     */
    showResultPanel(isWin) {
        let bestScore = -1;
        let mvpUnit = null;
        let maxDmg = 1;

        // 最大ダメージの算出
        this.state.units.forEach(u => {
            const log = this.battleLogs[u.uid] || {damage:0};
            if(log.damage > maxDmg) maxDmg = log.damage;
        });

        // MVPの選出
        const playerUnits = this.state.units.filter(u => u.side === 'player');
        playerUnits.forEach(u => {
            const log = this.battleLogs[u.uid];
            if(!log) return;
            const score = log.damage + (log.heal * 1.5) + (log.kills * 500);
            if(score > bestScore) { bestScore = score; mvpUnit = u; }
        });

        // ドロップ報酬の計算
        const drops = [];
        if (isWin) {
            this.state.units.forEach(u => {
                if (u.side === 'enemy' && u.isDead) {
                    const count = 1 + (Math.random() < 0.3 ? 1 : 0);
                    if (app.data.addCandy) app.data.addCandy(u.base.id, count);
                    drops.push({ name: u.base.name, id: u.base.id, count: count });
                }
            });
            app.data.save();
        }

        // 行のHTML生成
        const createRow = (u, log) => {
            const imgUrl = (typeof IMG_DATA !== 'undefined' && IMG_DATA[u.base.id]) ? IMG_DATA[u.base.id] : '';
            const barWidth = Math.min(100, Math.floor((log.damage / maxDmg) * 100));
            const barColor = (u.side === 'player') ? '#00ced1' : '#ff4444';
            return `
                <div class="score-row-enhanced">
                    <div class="score-icon-box" style="background-image:url('${imgUrl}')"></div>
                    <div class="score-info-col">
                        <div class="info-line-top">
                            <div class="unit-name-row">${u.base.name}</div>
                            <div class="stats-row">
                                ${log.damage > 0 ? `<span class="stat-badge dmg">⚔️${log.damage}</span>` : ''}
                                ${log.heal > 0 ? `<span class="stat-badge heal">💖${log.heal}</span>` : ''}
                                ${log.kills > 0 ? `<span class="stat-badge kill">💀${log.kills}</span>` : ''}
                            </div>
                        </div>
                        <div class="damage-bar-track">
                            <div class="damage-bar-fill" style="width:${barWidth}%; background:${barColor};"></div>
                        </div>
                    </div>
                </div>`;
        };

        const pList = playerUnits.map(u => createRow(u, this.battleLogs[u.uid] || {damage:0,heal:0,kills:0})).join('');
        const eList = this.state.units.filter(u => u.side === 'enemy').map(u => createRow(u, this.battleLogs[u.uid] || {damage:0,heal:0,kills:0})).join('');

        let rewardHtml = '';
        if (drops.length > 0) {
            let itemsHtml = drops.map(d => {
                const imgUrl = (typeof IMG_DATA !== 'undefined' && IMG_DATA[d.id]) ? IMG_DATA[d.id] : '';
                return `<div class="reward-item"><div class="reward-icon" style="background-image:url('${imgUrl}')"></div><div class="reward-val">x${d.count}</div></div>`;
            }).join('');
            rewardHtml = `<div class="reward-section"><div class="reward-title">GET REWARDS</div><div class="reward-list">${itemsHtml}</div></div>`;
        }

        const overlay = document.createElement('div');
        overlay.id = 'battle-result-overlay';
        overlay.className = 'result-overlay';
        overlay.style.backgroundImage = `url('images/bg_result.webp')`;

        let mvpHtml = '';
        if(mvpUnit) {
            const imgUrl = (typeof IMG_DATA !== 'undefined' && IMG_DATA[mvpUnit.base.id]) ? IMG_DATA[mvpUnit.base.id] : '';
            mvpHtml = `
                <div class="mvp-container-fixed">
                    <div class="mvp-bg-ray"></div>
                    <div class="mvp-char-layer" style="background-image:url('${imgUrl}')"></div>
                    <div class="mvp-ribbon">MVP</div>
                    <div class="mvp-name-label">${mvpUnit.base.name}</div>
                </div>`;
        }

        const titleText = isWin ? "VICTORY" : "DEFEAT";
        const titleClass = isWin ? "win" : "lose";

        overlay.innerHTML = `
            <canvas id="result-effect-canvas" style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:1;"></canvas>
            <div class="result-panel-v7">
                <div class="result-title ${titleClass}">${titleText}</div>
                ${mvpHtml}
                <div class="result-lists-wrapper">
                    <div class="r-list-col">
                        <div class="r-col-head p-head">PLAYER TEAM</div>
                        <div class="r-scroll-box">${pList}</div>
                    </div>
                    <div class="r-center-divider">VS</div>
                    <div class="r-list-col">
                        <div class="r-col-head e-head">ENEMY TEAM</div>
                        <div class="r-scroll-box">${eList}</div>
                    </div>
                </div>
                ${rewardHtml}
                <div class="result-actions">
                    <button class="btn-return" onclick="app.battleScreen.closeResult()">帰還</button>
                </div>
            </div>`;

        // リザルトCSS は style-battle-v2.css に外部化済み

        document.body.appendChild(overlay);
        
        // ダメージバーのアニメーション
        requestAnimationFrame(() => {
            const bars = overlay.querySelectorAll('.damage-bar-fill');
            bars.forEach(b => {
                const targetW = b.style.width; 
                b.style.width = '0%';
                setTimeout(() => { b.style.width = targetW; }, 100);
            });
        });

        this.startResultEffect(isWin);
    }

    startResultEffect(isWin) {
        const canvas = document.getElementById('result-effect-canvas');
        if(!canvas) return;
        const ctx = canvas.getContext('2d');
        const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
        resize();
        window.addEventListener('resize', resize);
        const particles = [];
        const count = isWin ? 100 : 150;
        for(let i=0; i<count; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height - canvas.height,
                size: Math.random() * 6 + 3,
                color: isWin ? `hsl(${Math.random()*360}, 100%, 50%)` : `rgba(174, 194, 224, ${Math.random()*0.5+0.1})`,
                speed: Math.random() * 3 + 2,
                wobble: Math.random() * Math.PI * 2
            });
        }
        const loop = () => {
            if(!document.getElementById('battle-result-overlay')) { cancelAnimationFrame(this.resultLoopId); return; }
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if(!isWin) { ctx.fillStyle = 'rgba(0, 0, 20, 0.3)'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
            particles.forEach(p => {
                p.y += p.speed;
                if(isWin) {
                    p.x += Math.sin(p.wobble) * 1; p.wobble += 0.1;
                    if(p.y > canvas.height) p.y = -20;
                    ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size);
                } else {
                    if(p.y > canvas.height) p.y = -20;
                    ctx.strokeStyle = p.color; ctx.lineWidth = 1; 
                    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y+15); ctx.stroke();
                }
            });
            this.resultLoopId = requestAnimationFrame(loop);
        };
        this.resultLoopId = requestAnimationFrame(loop);
    }
        _runBattleCloseCallback(isWin) {
        const cb = this.currentOptions && this.currentOptions.onBattleClose;
        if (typeof cb === 'function') {
            cb(!!isWin);
            return true;
        }

        // 互換: 旧コールバック経路
        if (typeof window.battleCallback === 'function') {
            window.battleCallback(!!isWin);
            window.battleCallback = null;
            return true;
        }

        return false;
    }



closeResult() {
        if(app.sound) app.sound.tap();
        if(this.resultLoopId) cancelAnimationFrame(this.resultLoopId);
        
        // バトル結果のオーバーレイを削除
        const ol = document.getElementById('battle-result-overlay');
        if(ol) ol.remove();
        
        this.active = false;
        
        // ★重要: 双六などから呼び出された場合のコールバック実行
      const isWin = (this.lastBattleResult === 'win');
        if (this._runBattleCloseCallback(isWin)) return;
        // タワーモードの場合
        if (this.currentOptions && this.currentOptions.mode === 'tower') {
            if (this.lastBattleResult === 'win') {
                app.data.advanceTowerFloor();
                const floor = this.currentOptions.floor;
                const isBoss = (floor % 5 === 0);
                const rewardGem = isBoss ? 5000 : 500; 
                const rewardGold = floor * 1000;
                app.data.addGems(rewardGem);
                app.data.addGold(rewardGold);

                // ★塔クリア: 確定で装備カードドロップ（階層が高いほど高品質）
                let cardMsg = '';
                if (app.data.cardManager) {
                    const minLv = Math.min(15, Math.floor(floor / 2));
                    const level = Math.min(20, minLv + Math.floor(Math.random() * (20 - minLv + 1)));
                    const card = app.data.dropCard({ level });
                    if (card) {
                        const effectDef = (typeof CARD_EFFECTS !== 'undefined') ? CARD_EFFECTS[card.effectType] : null;
                        const name = effectDef ? effectDef.name : '???';
                        const colorInfo = (typeof CARD_COLORS !== 'undefined') ? Object.values(CARD_COLORS).find(c => c.id === card.color) : null;
                        const icon = colorInfo ? colorInfo.icon : '🃏';
                        cardMsg = `\n${icon} ${name} Lv.${card.level}`;
                    }
                }

                alert(`階層 ${floor} クリア！\n報酬: 💎${rewardGem} / 💰${rewardGold.toLocaleString()}G${cardMsg}`);
            }
            app.changeScene('screen-tower');
            return;
        } 
        
        // 通常は編成画面へ
        app.changeScene('screen-edit');
    }

    backToEdit() { 
        this.active = false; 
       if (!this._runBattleCloseCallback(false)) {
            app.changeScene('screen-edit'); 
        }
    }
    
    sleep(ms) { return new Promise(r => setTimeout(r, ms/this.speed)); }
    toggleSpeed() {
        // 1.0 -> 2.0 -> 3.0 -> 1.0 の順でローテーション
        if (this.speed === 1.0) {
            this.speed = 2.0;
        } else if (this.speed === 2.0) {
            this.speed = 3.0;
        } else {
            this.speed = 1.0;
        }

        // ボタンのテキスト更新
        const v = document.getElementById('new-speed-val');
        if (v) {
            v.innerText = "x" + this.speed.toFixed(1);
        }
    }
}