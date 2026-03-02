/**
 * scene_sugoroku.js - クエストモード（自動進行式）
 * 双六のデッキ/手札/マスを全廃止。
 * 遭遇リストを自動進行し、パネルバトル or デッキバトルで戦う。
 */
class SugorokuScreen {
    constructor() {
        this.ui = new SugorokuUI(this);
        this.encounters = [];
        this.encounterIdx = 0;
        this.isEventRunning = false;
        this.isGameActive = false;
        this.currentStageId = 1;
        this._resumeAfterBattle = false;
        this._isBossBattle = false;
        this._partyHpState = {};
        this._panelBattleHp = 0; // パネルバトル間のHP引継ぎ

        this.adventureLog = this._emptyLog();
        this.stageConfigs = this._loadStageConfigs();
    }

    _loadStageConfigs() {
        if (typeof SUGOROKU_STAGES !== 'undefined' && SUGOROKU_STAGES && Object.keys(SUGOROKU_STAGES).length > 0) {
            return SUGOROKU_STAGES;
        }
        console.warn('[Quest] SUGOROKU_STAGES が未定義のためフォールバック使用');
        return { 1: { name:'草原', totalEncounters:8, midbossAt:4, enemyLv:5, bossLv:10, bossId:2, panelEnemies:[] } };
    }

    _emptyLog() {
        return { goldGained:0, gemsGained:0, candyGained:[], unitsGained:[],
                 battlesWon:0, battlesLost:0, enemiesDefeated:0 };
    }

    // ========================================
    // ライフサイクル
    // ========================================
    onEnter(options = {}) {
        this.ui.setup('#screen-sugoroku');

        // 戦闘（デッキバトル）から戻ってきた場合
        if (this._resumeAfterBattle) {
            this._resumeAfterBattle = false;
            this.ui.restoreView(this);
            if (options && options.fromBattle === true && typeof options.battleResult === 'boolean') {
                requestAnimationFrame(() => this.onBattleReturn(options.battleResult));
            }
            return;
        }

        this.loadStage(options.stageId || this.currentStageId);
    }

     // scene_sugoroku.js

    _applyQuestDefaultLayout(statusText = '移動中') {
        const pStats = this._getPlayerStats();
        const maxHp = pStats.maxHp || 1;
        const hp = Math.max(0, Math.min(this._panelBattleHp || maxHp, maxHp));

        if (app && app.panelBattleScreen && app.panelBattleScreen.ui) {
            const gridState = (typeof app.panelBattleScreen.getGridSnapshot === 'function')
                ? app.panelBattleScreen.getGridSnapshot()
                : null;
            app.panelBattleScreen.ui.setupQuestLayout(hp, maxHp, gridState);
            app.panelBattleScreen.ui.setQuestStatus(statusText);

            // ==========================================
            // ▼ 追加: グリッド背景を設定する（ステージ設定のbgPathを使用）
            // ==========================================
            const c = this.stageConfigs[this.currentStageId] || this.stageConfigs[1];
            if (c && c.bgPath && typeof app.panelBattleScreen.ui.setGridBackground === 'function') {
                // パネルバトルUIに背景画像を設定するメソッド（例：setGridBackground）があると想定
                app.panelBattleScreen.ui.setGridBackground(c.bgPath);
            }
        }
    }

    updateCamera() {}
    onExit() { this.isGameActive = false; }

    // ========================================
    // ステージ読み込み & 遭遇リスト生成
    // ========================================
    loadStage(stageId) {
        this.currentStageId = stageId;
        const c = this.stageConfigs[stageId] || this.stageConfigs[1];
        this.encounterIdx = 0;
        this.isEventRunning = false;
        this.isGameActive = true;
        this._isBossBattle = false;
        this._partyHpState = {};
        this.adventureLog = this._emptyLog();

        if (app && app.panelBattleScreen && typeof app.panelBattleScreen.resetGrid === 'function') {
            app.panelBattleScreen.resetGrid();
        }

        // プレイヤーステータスを計算
        const pStats = this._getPlayerStats();
        this._panelBattleHp = pStats.maxHp;

        // 遭遇リスト生成
        this.encounters = this._generateEncounters(c);

        // UI初期化
        if (c.layers && c.bgPath) {
            this.ui.initStageView(c.layers, c.bgPath);
        }
        const titleEl = document.getElementById('sg-stage-title');
        if (titleEl) titleEl.textContent = c.name || 'クエスト';

        this.ui.updateProgress(0, this.encounters.length);
        this.ui.showMessage(c.name + ' スタート！');
         this._applyQuestDefaultLayout('移動中');
        if (app.sound) app.sound.play('sys_decide');

        // 自動進行開始
        setTimeout(() => this.advanceToNext(), 400);
    }

    _generateEncounters(config) {
        const baseTotal = config.totalEncounters || 10;
        const total = Math.max(baseTotal + 6, Math.floor(baseTotal * 1.8));
        const midbossRatio = Math.max(0.25, Math.min(0.8, (config.midbossAt || Math.floor(baseTotal / 2)) / Math.max(1, baseTotal)));
        const midbossAt = Math.max(3, Math.min(total - 2, Math.round(total * midbossRatio)));
        const list = [];
        const clearCount = this._getClearedStageCount();

        // イベント種類の候補
        const events = ['gold', 'diamond', 'candy', 'heal', 'gamble', 'shop', 'equip_drop'];
        const eventWeights = [20, 8, 12, 15, 5, 5, 10];
        const totalW = eventWeights.reduce((sum, w) => sum + w, 0);

        const pickEvent = () => {
            let r = Math.random() * totalW;
            for (let i = 0; i < events.length; i++) {
                r -= eventWeights[i];
                if (r <= 0) return events[i];
            }
            return 'gold';
        };

        // 共有モンスター + ステージ固有モンスターを混ぜる。
        // 固有モンスターは「10戦ごとに2体ずつ」解放していく。
        const stageEnemies = Array.isArray(config.panelEnemies) ? config.panelEnemies : [];
        const sharedEnemies = (typeof PANEL_BATTLE_ENEMIES !== 'undefined' && Array.isArray(PANEL_BATTLE_ENEMIES))
            ? PANEL_BATTLE_ENEMIES
            : [];

        const pickEnemy = (encounterIndex = 0, totalEncounters = total) => {
            const scaledLv = this._scaledEnemyLv(config.enemyLv || 5);
            const progressRatio = totalEncounters > 1 ? (encounterIndex / (totalEncounters - 1)) : 0;
           const strongRate = Math.min(0.72, 0.2 + progressRatio * 0.4 + clearCount * 0.05);
            const isStrong = Math.random() < strongRate;
            // クリア周回と現在遭遇位置を合算して、10戦ごとに固有枠を2体解放
            const battleProgress = clearCount * Math.max(1, config.totalEncounters || 10) + encounterIndex + 1;
            const unlockedStageCount = Math.max(0, Math.min(stageEnemies.length, Math.floor(battleProgress / 10) * 2));
            const unlockedStageEnemies = stageEnemies.slice(0, unlockedStageCount);

            const mergedPool = [];
            const seenIds = new Set();
            for (const e of [...sharedEnemies, ...unlockedStageEnemies]) {
                if (!e || !e.id || seenIds.has(e.id)) continue;
                seenIds.add(e.id);
                mergedPool.push(e);
            }

            let enemy;
             if (mergedPool.length > 0) {
                const template = mergedPool[Math.floor(Math.random() * mergedPool.length)];
                enemy = JSON.parse(JSON.stringify(template));
                const stageScale = 1 + (scaledLv - 1) * 0.14 + clearCount * 0.06;
                enemy.atk = Math.floor(enemy.atk * stageScale);
                enemy.expBase = Math.floor(enemy.expBase * stageScale);
                enemy.goldBase = Math.floor(enemy.goldBase * stageScale);
            } else {
                enemy = PanelBattleScreen.generateEnemy(config.enemyLv || 5, clearCount);
            }

         const combatHpMul = 1.45 + progressRatio * 0.55 + clearCount * 0.08;
            const combatAtkMul = 1.22 + progressRatio * 0.34 + clearCount * 0.05;
           // =========================================
            // ▼ 修正: 最後に「* 1.2」を追加して、全体のHPを20%アップさせる！
            // =========================================
            enemy.hp = Math.floor(enemy.hp * combatHpMul * 2);

            enemy.atk = Math.floor(enemy.atk * combatAtkMul);
            enemy.expBase = Math.floor((enemy.expBase || 30) * (1.05 + progressRatio * 0.2));
            enemy.goldBase = Math.floor((enemy.goldBase || 50) * (1.05 + progressRatio * 0.2));

            const monsterPanelBonus = Math.floor(Math.max(0, scaledLv - 5) * 1.1 + progressRatio * 7 + clearCount * 0.8);
            enemy.monsterPanelBonus = monsterPanelBonus;
            enemy.level = Math.max(1, scaledLv + (isStrong ? 3 : 0));
            enemy.isStrong = isStrong;

            if (isStrong) {
                enemy.hp = Math.floor(enemy.hp * 1.65);
                enemy.atk = Math.floor(enemy.atk * 1.4);
                enemy.expBase = Math.floor(enemy.expBase * 1.55);
                enemy.goldBase = Math.floor(enemy.goldBase * 1.35);
                enemy.name = `強敵${enemy.name}`;
            }
            
             return enemy;
        };

        let battlesSinceEvent = 0;
        for (let i = 0; i < total; i++) {
            if (i === midbossAt - 1) {
                
                list.push({ type: 'midboss' });
            } else if (i === total - 1) {
                
                list.push({ type: 'boss' });
            } else {
                 const forceEvent = battlesSinceEvent >= 5;
                const shouldEvent = forceEvent || (battlesSinceEvent >= 3 && Math.random() < 0.18);
                if (shouldEvent) {
                    list.push({ type: pickEvent() });
                    battlesSinceEvent = 0;
                } else {
                    list.push({ type: 'enemy', enemyData: pickEnemy(i, total) });
                    battlesSinceEvent++;
                }
            }
        }

        // 最低1つギャンブルが入るようにする（まだ無ければ）
       if (!list.some(e => e.type === 'gamble') && list.length > 6) {
            const idx = 3 + Math.floor(Math.random() * (list.length - 5));
            if (list[idx].type !== 'midboss' && list[idx].type !== 'boss' && list[idx].type !== 'enemy') {
                list[idx] = { type: 'gamble' };
            }
        }

        return list;
    }

    // ========================================
    // 自動進行
    // ========================================
    async advanceToNext() {
        if (!this.isGameActive) return;
        if (this.encounterIdx >= this.encounters.length) return;

        this.isEventRunning = true;
        this._applyQuestDefaultLayout('移動中');

        // パララックス背景をスクロール
        await this.ui.scrollAdvance(this.encounterIdx, this.encounters.length);
        this.ui.updateProgress(this.encounterIdx + 1, this.encounters.length);

        const enc = this.encounters[this.encounterIdx];
        await this.processEncounter(enc);
    }

    async processEncounter(enc) {
        switch (enc.type) {
            case 'enemy':
                       this._applyQuestDefaultLayout('敵と遭遇！');
                await this.doEnemyPanelBattle(enc.enemyData);
                break;
            case 'midboss':
                await this.doMidbossBattle();
                break;
            case 'boss':
                await this.doBossBattle();
                break;
            case 'gold':    await this.doGoldGacha(); this._nextEncounter(); break;
            case 'diamond': await this.doDiamondGacha(); this._nextEncounter(); break;
            case 'candy':   await this.doCandyGacha(); this._nextEncounter(); break;
            case 'heal':    await this.doHeal(); this._nextEncounter(); break;
            case 'gamble':  await this.doGamble(); this._nextEncounter(); break;
            case 'shop':    await this.doCardShop(); this._nextEncounter(); break;
            case 'equip_drop': await this.doEquipCardDrop(); this._nextEncounter(); break;
            default:
                this.ui.showMessage('何もなかった…');
                await this.sleep(400);
                this._applyQuestDefaultLayout('移動中');
                this._nextEncounter();
                break;
        }
    }

    _nextEncounter() {
        this.encounterIdx++;
        this.isEventRunning = false;
        if (this.encounterIdx < this.encounters.length && this.isGameActive) {
           this._applyQuestDefaultLayout('移動中');
            setTimeout(() => this.advanceToNext(), 220);
        }
    }

    // ========================================
    // プレイヤーステータス（デッキから算出）
    // ========================================
    _getPlayerStats() {
        let totalHp = 0, totalAtk = 0;
        if (app.data && app.data.deck) {
            app.data.deck.forEach(entry => {
                const unit = app.data.getUnit(entry.unitId || entry.uid);
                if (unit) {
                    totalHp += unit.maxHp || 100;
                    totalAtk += unit.atk || 20;
                }
            });
        }
        if (totalHp === 0) { totalHp = 200; totalAtk = 30; }
        // パネルバトルは長期戦になりやすいので、元デッキ合計値をそのまま使うと
        // プレイヤーが硬すぎるケースが出る。ここで専用補正を掛ける。
        const deckCount = Math.max(1, app.data?.deck?.length || 1);
        const avgHp = totalHp / deckCount;
        const partyHpFactor = 2.2 + Math.min(1.2, deckCount * 0.08);
        const panelHp = Math.max(180, Math.min(1200, Math.floor(avgHp * partyHpFactor)));
        const panelAtk = Math.max(18, Math.floor((totalAtk / deckCount) * 0.9));
        return { hp: panelHp, maxHp: panelHp, atk: panelAtk };
    }

    // ========================================
    // パネルバトル（雑魚戦）
    // ========================================
    async doEnemyPanelBattle(enemyData) {
        const pStats = this._getPlayerStats();
        pStats.hp = Math.max(1, Math.min(this._panelBattleHp || pStats.maxHp, pStats.maxHp));

        // ==========================================
        // ▼ 追加: 強敵なら、バトル開始前に専用の背景演出をオンにする！
        // ==========================================
        if (enemyData.isStrong && app.panelBattleScreen && app.panelBattleScreen.ui && typeof app.panelBattleScreen.ui.startGridEffect === 'function') {
            app.panelBattleScreen.ui.startGridEffect('strong_enemy');
        }

        // パネルバトル開始
        app.panelBattleScreen.start(enemyData, pStats, (rewards) => {
            
            // ==========================================
            // ▼ 追加: バトルが終わったら（勝敗に関わらず）演出をオフにする！
            // ==========================================
            if (app.panelBattleScreen && app.panelBattleScreen.ui && typeof app.panelBattleScreen.ui.stopGridEffect === 'function') {
                app.panelBattleScreen.ui.stopGridEffect();
            }

            // パネルバトル終了後のコールバック
            if (rewards.isWin) {
                this.adventureLog.battlesWon++;
                this.adventureLog.enemiesDefeated++;
                this._panelBattleHp = app.panelBattleScreen.playerHp; // HP引継ぎ

                // 経験値・ゴールド付与
                if (app.data) {
                    app.data.addGold(rewards.gold || 0);
                    this.adventureLog.goldGained += (rewards.gold || 0);
                    if ((rewards.gems || 0) > 0) {
                        app.data.addGems(rewards.gems);
                        this.adventureLog.gemsGained += rewards.gems;
                    }
                }

                if (rewards.guaranteedPanels && rewards.guaranteedPanels.length > 0) {
                    app.panelBattleScreen.injectPanels(rewards.guaranteedPanels);
                    this.ui.showMessage('強敵撃破！ 次戦用に🎫/💎パネル追加');
                }

              // チケットパネル効果で即時ガチャした結果をログに反映
                if (Array.isArray(rewards.chickRewards) && rewards.chickRewards.length > 0) {
                    for (const unit of rewards.chickRewards) {
                        this.adventureLog.unitsGained.push({ name: unit.name, id: unit.id, cost: unit.cost });
                    }
                }

                // 装備カードドロップ（30%）
                if (app.data && app.data.cardManager && Math.random() < 0.30) {
                    const card = app.data.dropCard();
                    if (card) {
                        const effectDef = (typeof CARD_EFFECTS !== 'undefined') ? CARD_EFFECTS[card.effectType] : null;
                        const name = effectDef ? effectDef.name : '???';
                        if (!this.adventureLog.cardsDropped) this.adventureLog.cardsDropped = [];
                        this.adventureLog.cardsDropped.push({ name, color: card.color, level: card.level });
                    }
                }

                this._nextEncounter();
            } else {
                // パネルバトル敗北 → ゲームオーバー
                this.adventureLog.battlesLost++;
                this.gameOver('パネルバトルに敗北した…');
            }
        }, { preserveGrid: true, monsterPanelBonus: enemyData.monsterPanelBonus || 0 });
    }

    // ========================================
    // 中ボス戦（デッキバトル）
    // ========================================
    async doMidbossBattle() {
        const c = this.stageConfigs[this.currentStageId] || this.stageConfigs[1];
        const lv = this._scaledEnemyLv(c.enemyLv || 10);
        const playerCount = app.data.deck ? app.data.deck.length : 4;

        if (app.sound) {
            app.sound.play('se_enemy_appear');
        }
        await this.ui.showEnemyEntrance(8, true);

        if (app.sound) app.sound.play('se_encounter');
        await this.sleep(400);

        this.startBattle({
            enemyLv: Math.floor(lv * 1.5),
            fixedEnemyId: 8,
            bgImg: c.sugorokuBattleBg || c.battleBg || 'images/bg_battle.webp',
            playerCount: playerCount
        });
    }

    // ========================================
    // ボス戦（デッキバトル）
    // ========================================
    async doBossBattle() {
        const c = this.stageConfigs[this.currentStageId] || this.stageConfigs[1];
        const bossLv = this._scaledEnemyLv(c.bossLv || c.enemyLv + 10);
        const playerCount = app.data.deck ? app.data.deck.length : 4;

        if (app.sound) {
            app.sound.play('thunder');
            setTimeout(() => app.sound.play('se_enemy_appear'), 200);
        }
        await this.ui.showEnemyEntrance(c.bossId || 14, true);

        if (app.sound) app.sound.play('se_encounter');
        await this.sleep(400);

        this._isBossBattle = true;

        this.startBattle({
            enemyLv: bossLv,
            fixedEnemyId: c.bossId || 14,
            bgImg: c.sugorokuBattleBg || c.battleBg || 'images/bg_battle.webp',
            playerCount: playerCount,
            isBossBattle: true
        });
    }

    startBattle(options) {
        this._resumeAfterBattle = true;
        options.sugorokuHpState = this._partyHpState;
        options.sugorokuMode = true;

        window.battleCallback = (isWin) => {
            window.battleCallback = null;
            app.changeScene('screen-sugoroku', { fromBattle: true, battleResult: !!isWin });
        };

        app.changeScene('screen-battle');
        if (app.battleScreen) app.battleScreen.start(options);
    }

    onBattleReturn(isWin) {
        // 戦闘後のHP状態を保存
        if (app.battleScreen && app.battleScreen.state) {
            const playerUnits = app.battleScreen.state.units.filter(u => u.side === 'player');
            playerUnits.forEach(u => {
                this._partyHpState[u.uid] = {
                    hp: u.isDead ? 1 : Math.max(1, u.battleHp),
                    maxHp: u.maxHp,
                    isDead: false
                };
            });
        }

        if (isWin) {
            this.adventureLog.battlesWon++;
            if (this._isBossBattle) {
                this._isBossBattle = false;
                this.gameClear();
                return;
            }
            this.ui.showMessage('⚔ 戦闘勝利！');
            if (app.sound) app.sound.play('sys_clear');

            // 装備カードドロップ（30%）
            if (app.data && app.data.cardManager && Math.random() < 0.30) {
                const card = app.data.dropCard();
                if (card) {
                    const effectDef = (typeof CARD_EFFECTS !== 'undefined') ? CARD_EFFECTS[card.effectType] : null;
                    const name = effectDef ? effectDef.name : '???';
                    if (!this.adventureLog.cardsDropped) this.adventureLog.cardsDropped = [];
                    this.adventureLog.cardsDropped.push({ name, color: card.color, level: card.level });
                    setTimeout(() => this.ui.showMessage(`🃏 ${name} Lv.${card.level} をドロップ！`), 800);
                }
            }
this._applyQuestDefaultLayout('移動中');
            this._nextEncounter();
        } else {
            this.adventureLog.battlesLost++;
            this._isBossBattle = false;
            this.gameOver('戦闘に敗北した…');
        }
    }

    // ========================================
    // ギャンブル（ハイ＆ロー）— 既存流用
    // ========================================
    async doGamble() {
        this.ui.showMessage('🎰 賭場に到着！');
        if (app.sound) app.sound.play('sys_decide');
        await this.sleep(500);

        const choice = await this.ui.showGambleEntryDialog();
        if (!choice) { this.ui.showMessage('勝負を降りた。'); return; }

        const isGem = (choice === 'gem');
        const betAmount = isGem ? 100 : 1000;
        const maxReward = isGem ? 3200 : 32000;

        if (isGem) {
            if (app.data.gems < betAmount) { this.ui.showMessage('ダイヤが足りない…'); return; }
            app.data.consumeGems(betAmount);
        } else {
            if (app.data.gold < betAmount) { this.ui.showMessage('ゴールドが足りない…'); return; }
            app.data.consumeGold(betAmount);
        }

        let currentReward = betAmount;
        let winCount = 0;
        let isGameStillOn = true;
        let currentNum = Math.floor(Math.random() * 13) + 1;

        while (isGameStillOn) {
            const result = await this.ui.showHighLowGame(currentNum, currentReward, winCount, isGem);

            if (result === 'drop') {
                await this.ui.closeGambleUI();
                this.ui.showMessage(`勝負あり！ ${currentReward.toLocaleString()} ${isGem?'ダイヤ':'G'} 獲得！`);
                if (isGem) app.data.addGems(currentReward); else app.data.addGold(currentReward);
                if (isGem) this.adventureLog.gemsGained += currentReward;
                else this.adventureLog.goldGained += currentReward;
                if (app.sound) app.sound.play('sys_gacha_open');
                return;
            }

            let nextNum = Math.floor(Math.random() * 13) + 1;
            while (nextNum === currentNum) { nextNum = Math.floor(Math.random() * 13) + 1; }
            await this.ui.showHighLowResult(nextNum);

            const isHigh = (result === 'high');
            const isWin = (isHigh && nextNum > currentNum) || (!isHigh && nextNum < currentNum);

            if (isWin) {
                if (app.sound) app.sound.play('sys_decide');
                currentReward *= 2;
                winCount++;
                currentNum = nextNum;
                if (currentReward >= maxReward) {
                    await this.sleep(500);
                    await this.ui.closeGambleUI();
                    this.ui.showMessage(`🎉 上限到達！ ${currentReward.toLocaleString()} ${isGem?'ダイヤ':'G'} 獲得！`);
                    if (isGem) app.data.addGems(currentReward); else app.data.addGold(currentReward);
                    if (isGem) this.adventureLog.gemsGained += currentReward;
                    else this.adventureLog.goldGained += currentReward;
                    if (app.sound) app.sound.play('sys_gacha_open');
                    return;
                }
            } else {
                if (app.sound) app.sound.play('sys_danger');
                await this.sleep(1000);
                await this.ui.closeGambleUI();
                this.ui.showMessage('残念… 没収です。');
                isGameStillOn = false;
            }
        }
    }

    // ========================================
    // イベント処理（既存流用）
    // ========================================
    async doGoldGacha() {
        const a = [100,200,300,500,800,1000,1500,2000][Math.floor(Math.random()*8)];
        if (app.data) app.data.addGold(a);
        this.adventureLog.goldGained += a;
        if (app.sound) app.sound.play('sys_gacha_open');
        await this.sleep(100);
        await this.ui.showTreasureBox('gold');
        await this.ui.showRewardOverlay('', `${a.toLocaleString()} G`, 'gold', 'images/sg_icon_gold.webp');
    }

    async doDiamondGacha() {
        const a = [50,100,150,200,300,500][Math.floor(Math.random()*6)];
        if (app.data) app.data.addGems(a);
        this.adventureLog.gemsGained += a;
        if (app.sound) app.sound.play('sys_gacha_open');
        await this.sleep(100);
        await this.ui.showTreasureBox('diamond');
        await this.ui.showRewardOverlay('', `${a} ダイヤ`, 'diamond', 'images/sg_icon_diamond.webp');
    }

    async doCandyGacha() {
        if (typeof DB === 'undefined' || DB.length === 0) return;
        const u = DB[Math.floor(Math.random()*DB.length)];
        const c = 1 + Math.floor(Math.random()*3);
        if (app.data) { app.data.addCandy(u.id, c); app.data.save(); }
        this.adventureLog.candyGained.push({ name:u.name, id:u.id, count:c });
        if (app.sound) app.sound.play('sys_gacha_open');
        await this.sleep(100);
        await this.ui.showTreasureBox('candy');
        const img = (typeof IMG_DATA !== 'undefined' && IMG_DATA[u.id]) ? IMG_DATA[u.id] : '';
        await this.ui.showRewardOverlay('', `${u.name}のアメ x${c}`, 'candy', 'images/sg_icon_candy.webp');
    }

    async doHeal() {
        if (app.sound) app.sound.play('sys_heal');
        // パネルバトルHP全回復
        const pStats = this._getPlayerStats();
        this._panelBattleHp = pStats.maxHp;
        // デッキバトルHP全回復
        Object.keys(this._partyHpState).forEach(uid => {
            const s = this._partyHpState[uid];
            s.hp = s.maxHp;
            s.isDead = false;
        });
        await this.ui.showRewardOverlay('💚', 'パーティ全回復！', 'heal');
    }

    async doGoldLose() {
        const a = Math.floor((app.data ? app.data.gold : 0) * 0.1);
        if (app.data && a > 0) app.data.consumeGold(a);
        if (app.sound) app.sound.play('sys_danger');
        await this.ui.showRewardOverlay('💸', `${a.toLocaleString()} G 没収…`, 'lose');
    }

    async doEquipCardDrop() {
        if (!app.data || !app.data.cardManager) { this.ui.showMessage('カードシステム未初期化'); return; }
        const stageId = this.currentStageId || 1;
        const options = {};
        if (stageId >= 5 && Math.random() < 0.08 * stageId) options.color = 'purple';
        const card = app.data.dropCard(options);
        if (!card) {
            if (app.sound) app.sound.play('sys_danger');
            await this.ui.showRewardOverlay('📦', '装備カードが上限です！\n分解して空きを作ろう', 'lose');
            return;
        }
        if (app.sound) app.sound.play('sys_gacha_open');
        await this.sleep(100);
        await this.ui.showTreasureBox('diamond');
        const colorInfo = (typeof CARD_COLORS !== 'undefined') ? Object.values(CARD_COLORS).find(c => c.id === card.color) : null;
        const effectDef = (typeof CARD_EFFECTS !== 'undefined') ? CARD_EFFECTS[card.effectType] : null;
        const colorIcon = colorInfo ? colorInfo.icon : '🃏';
        const effectName = effectDef ? effectDef.name : card.effectType;
        const rank = app.data.cardManager.getCardRank(card);
        if (!this.adventureLog.cardsDropped) this.adventureLog.cardsDropped = [];
        this.adventureLog.cardsDropped.push({ name: effectName, color: card.color, level: card.level });
        await this.ui.showRewardOverlay(colorIcon, `${effectName} Lv.${card.level} [${rank}]`, card.level >= 16 ? 'diamond' : 'gold');
    }

    async doFreeGacha() {
        if (typeof DB === 'undefined' || DB.length === 0) return;
        let pool; const r = Math.random();
        if (r < 0.05) pool = DB.filter(u => u.cost >= 5);
        else if (r < 0.25) pool = DB.filter(u => u.cost >= 3 && u.cost <= 4);
        else pool = DB.filter(u => u.cost <= 2);
        if (!pool || pool.length === 0) pool = DB;
        const u = pool[Math.floor(Math.random()*pool.length)];
        if (app.data) app.data.addUnit(u.id, true);
        this.adventureLog.unitsGained.push({ name:u.name, id:u.id, cost:u.cost });
        if (app.sound) app.sound.play('sys_gacha_open');
        await this.sleep(100);
        await this.ui.showTreasureBox('gacha');
        const img = (typeof IMG_DATA !== 'undefined' && IMG_DATA[u.id]) ? IMG_DATA[u.id] : '';
        const rl = u.cost >= 5 ? 'UR' : u.cost >= 3 ? 'SR' : 'R';
        await this.ui.showRewardOverlay('🎫', `【${rl}】${u.name} 加入！`, 'gacha', img);
    }

    // ========================================
    // ショップ（カード/デッキ商品を削除）
    // ========================================
    async doCardShop() {
        this.ui.showMessage('🛒 ショップ発見！');
        if (app.sound) app.sound.play('sys_decide');
        await this.sleep(300);

        const shopItems = this._generateShopItems();
        const gold = app.data ? app.data.gold : 0;
        const gems = app.data ? app.data.gems : 0;

        await this.ui.showCardShop(shopItems, gold, gems, (item) => {
            let success = false;
            if (item.currency === 'gold') {
                if (app.data && app.data.gold >= item.price) { app.data.consumeGold(item.price); success = true; }
            } else {
                if (app.data && app.data.gems >= item.price) { app.data.consumeGems(item.price); success = true; }
            }
            if (success) {
                this._applyShopItem(item);
                if (app.sound) app.sound.play('sys_gacha_open');
                return true;
            } else {
                if (app.sound) app.sound.play('sys_danger');
                return false;
            }
        });
    }

    _generateShopItems() {
        const items = [];

        // 1. キャラクター販売
        if (typeof DB !== 'undefined' && DB.length > 0) {
            const r = Math.random();
            let pool, rarityLabel, price, currency;
            if (r < 0.15) { pool = DB.filter(u => u.cost >= 4); rarityLabel='SSR+'; price=300; currency='gem'; }
            else if (r < 0.5) { pool = DB.filter(u => u.cost === 3); rarityLabel='SR'; price=5000; currency='gold'; }
            else { pool = DB.filter(u => u.cost <= 2); rarityLabel='R'; price=1500; currency='gold'; }
            if (!pool || pool.length === 0) pool = DB;
            const u = pool[Math.floor(Math.random() * pool.length)];
            const img = (typeof IMG_DATA !== 'undefined' && IMG_DATA[u.id]) ? IMG_DATA[u.id] : null;
            items.push({ id:'shop_unit_'+u.id, type:'unit', label:u.name,
                desc:`【${rarityLabel}】ユニット加入`, value:u.id, cost:u.cost,
                price, currency, img, icon:'👤' });
        }

        // 2. アメ販売
        if (typeof DB !== 'undefined' && DB.length > 0) {
            const u = DB[Math.floor(Math.random() * DB.length)];
            const count = 5 + Math.floor(Math.random() * 6);
            const img = (typeof IMG_DATA !== 'undefined' && IMG_DATA[u.id]) ? IMG_DATA[u.id] : null;
            items.push({ id:'shop_candy_'+u.id, type:'candy', label:`${u.name}のアメ`,
                desc:`覚醒アイテム x${count}`, value:u.id, count,
                price:2000, currency:'gold', img, icon:'🍬' });
        }

        // 3. HP回復薬
        items.push({ id:'shop_heal', type:'heal', label:'HP回復薬',
            desc:'パーティHP全回復', value:0,
            price:800, currency:'gold', icon:'💚' });

        return items;
    }

    _applyShopItem(item) {
        if (item.type === 'unit') {
            if (app.data) app.data.addUnit(item.value, true);
            this.adventureLog.unitsGained.push({ name:item.label, id:item.value, cost:item.cost });
            this.ui.showMessage(`${item.label} が仲間になった！`);
        } else if (item.type === 'candy') {
            if (app.data) { app.data.addCandy(item.value, item.count); app.data.save(); }
            this.adventureLog.candyGained.push({ name:item.label.replace('のアメ',''), id:item.value, count:item.count });
            this.ui.showMessage(`${item.label} x${item.count} GET！`);
        } else if (item.type === 'heal') {
            const pStats = this._getPlayerStats();
            this._panelBattleHp = pStats.maxHp;
            Object.keys(this._partyHpState).forEach(uid => { this._partyHpState[uid].hp = this._partyHpState[uid].maxHp; this._partyHpState[uid].isDead = false; });
            this.ui.showMessage('HP全回復！');
        }
    }

    // ========================================
    // ゲーム終了 → リザルト
    // ========================================
    gameClear() {
        this.isGameActive = false;
        this.isEventRunning = true;
        if (app.sound) app.sound.play('sys_clear');
        const c = this.stageConfigs[this.currentStageId] || this.stageConfigs[1];
        const cc = this._getClearCount();
        const reward = this._scaledReward(5000, 1000);
        if (app.data) {
            app.data.addGems(reward.gems);
            app.data.addGold(reward.gold);
            app.data.completeStage(this.currentStageId);
            if (!app.data.stageClearCounts) app.data.stageClearCounts = {};
            app.data.stageClearCounts[this.currentStageId] = (app.data.stageClearCounts[this.currentStageId] || 0) + 1;

            if (app.data.cardManager) {
                const minLv = Math.min(10, this.currentStageId * 2);
                const level = minLv + Math.floor(Math.random() * (20 - minLv + 1));
                const card = app.data.dropCard({ level: Math.min(20, level) });
                if (card) {
                    const effectDef = (typeof CARD_EFFECTS !== 'undefined') ? CARD_EFFECTS[card.effectType] : null;
                    const name = effectDef ? effectDef.name : '???';
                    if (!this.adventureLog.cardsDropped) this.adventureLog.cardsDropped = [];
                    this.adventureLog.cardsDropped.push({ name, color: card.color, level: card.level });
                }
            }
            app.data.save();
        }
        this.adventureLog.gemsGained += reward.gems;
        this.adventureLog.goldGained += reward.gold;
        this.adventureLog.clearCount = cc + 1;
        this.adventureLog.nextEnemyLv = this._scaledEnemyLv(c.enemyLv || 10);
        this.adventureLog.nextReward = this._scaledReward(5000, 1000);
        this.ui.showResultScreen(true, c.name, this.adventureLog, () => { app.changeScene('screen-home'); });
    }

    gameOver(reason) {
        this.isGameActive = false;
        this.isEventRunning = true;
        if (app.sound) app.sound.play('sys_danger');
        this.ui.showResultScreen(false, reason, this.adventureLog, () => { app.changeScene('screen-home'); });
    }

    // ========================================
    // スケーリングヘルパー
    // ========================================
    _getClearCount() {
        if (app.data && app.data.stageClearCounts) return app.data.stageClearCounts[this.currentStageId] || 0;
        return 0;
    }

    _getClearedStageCount() {
        if (app.data && app.data.stageClearCounts) {
            return Object.values(app.data.stageClearCounts).filter(v => (v || 0) > 0).length;
        }
        return 0;
    }
    _scaledEnemyLv(baseLv) {
        const clearedStages = this._getClearedStageCount();
        return Math.floor(baseLv * (1 + clearedStages * 0.12));
    }
    _scaledReward(baseGold, baseGem) {
     const clearedStages = this._getClearedStageCount();
        return { gold: Math.floor(baseGold * (1 + clearedStages * 0.18)), gems: Math.floor(baseGem * (1 + clearedStages * 0.08)) };}

    confirmGoHome() {
        if (!this.isGameActive) { app.changeScene('screen-home'); return; }
        this.ui.showQuitConfirm(() => {
            this.isGameActive = false;
            this.isEventRunning = true;
            app.changeScene('screen-home');
        });
    }

    sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}
