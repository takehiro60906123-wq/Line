class SugorokuScreen {
  constructor() {
    this.ui = new SugorokuUI(this);
    this.currentStageId = 1;
    this.stageConfigs = (typeof SUGOROKU_STAGES !== 'undefined') ? SUGOROKU_STAGES : {};
    this.isGameActive = false;
    this.isEventRunning = false;
    this.encounters = [];
    this.encounterIndex = 0;
    this._resumeAfterBattle = false;
    this._pendingEncounter = null;
    this._isBossBattle = false;
    this.adventureLog = this._emptyLog();
  }

  _emptyLog() { return { goldGained:0, gemsGained:0, candyGained:[], unitsGained:[], battlesWon:0, battlesLost:0 }; }
  sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
  _getStage(){ return this.stageConfigs[this.currentStageId] || this.stageConfigs[1]; }

  onEnter(options = {}) {
    this.ui.setup('#screen-sugoroku');
    if (this._resumeAfterBattle && options.fromBattle) {
      this._resumeAfterBattle = false;
      this.onBattleReturn(!!options.battleResult);
      return;
    }
    this.loadStage(options.stageId || this.currentStageId);
  }

  loadStage(stageId) {
    this.currentStageId = stageId;
    this.isGameActive = true;
    this.isEventRunning = false;
    this.adventureLog = this._emptyLog();
    const stage = this._getStage();
    this.encounters = this._buildEncounters(stage);
    this.encounterIndex = 0;
    this.ui.initStageView(stage.layers || [], stage.bgPath || '');
    this.ui.updateProgress(this.encounterIndex, this.encounters.length);
    this.ui.showMessage(`${stage.name} スタート！`);
    this.runAutoQuest();
  }

  _buildEncounters(stage) {
    if (Array.isArray(stage.encounters) && stage.encounters.length) return stage.encounters;
    const total = stage.totalEncounters || 12;
    const mid = stage.midbossAt || Math.floor(total / 2);
    const list = [];
    for (let i = 1; i <= total; i++) {
      if (i === total) list.push({ type: 'boss' });
      else if (i === mid) list.push({ type: 'midboss' });
      else if (i % 5 === 0) list.push({ type: 'gold' });
      else if (i % 7 === 0) list.push({ type: 'gamble' });
      else list.push({ type: 'enemy', enemyData: this._pickPanelEnemy(stage) });
    }
    return list;
  }

  _pickPanelEnemy(stage) {
    const pool = (stage.panelEnemies && stage.panelEnemies.length) ? stage.panelEnemies : [{ name:'スライム', emoji:'🟢', hp:80, atk:10, expBase:20, goldBase:35 }];
    return JSON.parse(JSON.stringify(pool[Math.floor(Math.random() * pool.length)]));
  }

  async runAutoQuest() {
    if (this.isEventRunning) return;
    this.isEventRunning = true;
    while (this.isGameActive && this.encounterIndex < this.encounters.length) {
      const enc = this.encounters[this.encounterIndex];
      this.ui.setCharRunning(true);
      await this.sleep(400);
      this.ui.syncParallax(this.encounterIndex + 1);
      this.ui.setCharRunning(false);
      await this.handleEncounter(enc);
      this.encounterIndex += 1;
      this.ui.updateProgress(this.encounterIndex, this.encounters.length);
    }
    this.isEventRunning = false;
  }

  async handleEncounter(enc) {
    if (enc.type === 'enemy') {
      await this.ui.showEnemyEntrance(1, false);
      await new Promise(resolve => {
        app.panelBattleScreen.start(enc.enemyData, this._buildPlayerStats(), (result) => {
          if (!result.isWin) return this.gameOver('パネルバトルで敗北…');
          this.adventureLog.battlesWon++;
          if (app.data) app.data.addGold(result.gold || 0);
          this.adventureLog.goldGained += (result.gold || 0);
          resolve();
        });
      });
      return;
    }
    if (enc.type === 'midboss' || enc.type === 'boss') {
      this._isBossBattle = enc.type === 'boss';
      this._pendingEncounter = enc;
      const stage = this._getStage();
      await this.ui.showEnemyEntrance(stage.bossId || 2, true);
      this.startBattle({ enemyLv: enc.type === 'boss' ? stage.bossLv : stage.enemyLv, fixedEnemyId: stage.bossId || 2, bgImg: stage.sugorokuBattleBg || stage.battleBg, isBossBattle: enc.type === 'boss' });
      await new Promise(r => { this._battleResume = r; });
      return;
    }
    if (enc.type === 'gold') return this.doGoldGacha();
    if (enc.type === 'diamond') return this.doDiamondGacha();
    if (enc.type === 'candy') return this.doCandyGacha();
    if (enc.type === 'heal') return this.doHeal();
    if (enc.type === 'gamble') return this.doGamble();
  }

  _buildPlayerStats() { return { hp: 200, atk: 20 }; }

  async doGoldGacha(){ const a = 200 + Math.floor(Math.random()*400); if (app.data) app.data.addGold(a); this.adventureLog.goldGained += a; await this.ui.showTreasureBox('gold'); await this.ui.showRewardOverlay('', `${a} G`, 'gold', 'images/sg_icon_gold.webp'); }
  async doDiamondGacha(){ const a = 2 + Math.floor(Math.random()*4); if (app.data) app.data.addGems(a); this.adventureLog.gemsGained += a; await this.ui.showTreasureBox('diamond'); await this.ui.showRewardOverlay('', `${a} ダイヤ`, 'diamond', 'images/sg_icon_diamond.webp'); }
  async doCandyGacha(){ if (!app.data || typeof DB === 'undefined') return; const u = DB[Math.floor(Math.random()*DB.length)]; app.data.addCandy(u.id, 1); this.adventureLog.candyGained.push({id:u.id,count:1,name:u.name}); await this.ui.showTreasureBox('candy'); await this.ui.showRewardOverlay('', `${u.name}のアメ x1`, 'candy', 'images/sg_icon_candy.webp'); }
  async doHeal(){ await this.ui.showRewardOverlay('💚', 'パーティ全回復！', 'heal'); }

  async doGamble() {
    const choice = await this.ui.showGambleEntryDialog();
    if (!choice) return;
    const isGem = choice === 'gem'; const bet = isGem ? 100 : 1000;
    if (isGem ? !app.data.consumeGems(bet) : !app.data.consumeGold(bet)) return;
    const current = Math.floor(Math.random()*13)+1;
    const cmd = await this.ui.showHighLowGame(current, bet, 0, isGem);
    if (cmd === 'drop') return;
    const next = Math.floor(Math.random()*13)+1;
    await this.ui.showHighLowResult(next);
    const win = (cmd === 'high' && next > current) || (cmd === 'low' && next < current);
    if (win) { if (isGem) app.data.addGems(bet*2); else app.data.addGold(bet*2); }
    await this.ui.closeGambleUI();
  }

  startBattle(options) {
    this._resumeAfterBattle = true;
    window.battleCallback = (isWin) => {
      window.battleCallback = null;
      app.changeScene('screen-sugoroku', { fromBattle: true, battleResult: !!isWin });
    };
    app.changeScene('screen-battle');
    if (app.battleScreen) app.battleScreen.start(options);
  }

  onBattleReturn(isWin) {
    if (!isWin) return this.gameOver('戦闘に敗北した…');
    if (this._isBossBattle) return this.gameClear();
    if (typeof this._battleResume === 'function') this._battleResume();
  }

  gameClear() {
    this.isGameActive = false;
    if (app.data) {
      app.data.maxClearedStage = Math.max(app.data.maxClearedStage || 0, this.currentStageId);
      app.data.stageClearCounts = app.data.stageClearCounts || {};
      app.data.stageClearCounts[this.currentStageId] = (app.data.stageClearCounts[this.currentStageId] || 0) + 1;
      app.data.save();
    }
    this.ui.showResultScreen(true, 'ステージクリア！', this.adventureLog, () => app.changeScene('screen-map-select'));
  }

  gameOver(reason) {
    this.isGameActive = false;
    this.ui.showResultScreen(false, reason, this.adventureLog, () => app.changeScene('screen-map-select'));
  }

  updateCamera() {}
}
