/**
 * scene_panel_battle.js - ピヨピヨクエスト式 6×6 パネルバトル
 * 雑魚戦専用。BOSS戦は既存デッキバトル(scene_battle.js)を使用。
 */

const PANEL_IMAGE_EXTENSIONS = ['png', 'webp'];
const PANEL_IMAGE_CACHE_BUSTER = `v=${Date.now()}`;
const PANEL_IMAGE_BASE_DIRS = ['images/panels', 'panels', '.'];

function panelImageCandidates(panelId) {
  const candidates = [];
    for (const baseDir of PANEL_IMAGE_BASE_DIRS) {
        for (const ext of PANEL_IMAGE_EXTENSIONS) {
            const normalizedBase = baseDir === '.' ? '' : `${baseDir}/`;
            const path = `${normalizedBase}${panelId}.${ext}`;
            candidates.push(`${path}?${PANEL_IMAGE_CACHE_BUSTER}`);
        }
    }
    return candidates;
}

const PANEL_TYPES = {
    sword:   { id: 'sword',   icon: '⚔',  label: 'こうげき',   color: '#4488ff', weight: 20, image: panelImageCandidates('sword') },
    magic:   { id: 'magic',   icon: '🔥', label: 'まほう',     color: '#ff6622', weight: 20, image: panelImageCandidates('magic') },
    coin:    { id: 'coin',    icon: '💰', label: 'こいん',     color: '#ddaa00', weight: 20, image: panelImageCandidates('coin') },
    heal:    { id: 'heal',    icon: '💚', label: '回復',       color: '#44cc44', weight: 20, image: panelImageCandidates('heal') },
    lvup:    { id: 'lvup',    icon: '😈', label: 'モンスター', color: '#8844aa', weight: 20, image: panelImageCandidates('lvup') },
    chick:   { id: 'chick',   icon: '🎫', label: 'チケット',   color: '#ffdd44', weight: 4, image: panelImageCandidates('chick') },
    diamond: { id: 'diamond', icon: '💎', label: 'ダイア',     color: '#66e0ff', weight: 2, image: panelImageCandidates('diamond') }
};
const MAX_CHICK_PANELS_ON_BOARD = 2;

const PANEL_ENEMIES = (typeof PANEL_BATTLE_ENEMIES !== 'undefined' && Array.isArray(PANEL_BATTLE_ENEMIES)) ? PANEL_BATTLE_ENEMIES : [];

class PanelBattleScreen {
    constructor() {
        this.ui = new PanelBattleUI(this);
        this.grid = [];
        this.rows = 6;
        this.cols = 6;
        this.playerHp = 0;
        this.playerMaxHp = 0;
        this.playerBaseAtk = 0;
        this.enemy = null;
        this.enemyMaxHp = 0;
        this.turnCount = 0;
        this.enemyActionCounter = 0;
        this.enemyActionInterval = 3;
        this.enemyPhysDamageCap = null;
        this.enemyMagicDamageCap = null;
        this.earnedExp = 0;
        this.earnedGold = 0;
        this.earnedCoins = 0;
        this.monsterLvBonus = 0;
        this.isActive = false;
        this.isProcessing = false;
        this.onEndCallback = null;
        this._chickGot = false;
        this._chickRewards = [];
       this._panelWeights = this._buildPanelWeights(0);
        this._totalWeight = this._panelWeights.reduce((sum, p) => sum + p.weight, 0);
    }

  // ========================================
    // 開始
    // ========================================
    start(enemyData, playerStats, onEnd, options = {}) {
        this.enemy = JSON.parse(JSON.stringify(enemyData));
        this.enemyMaxHp = this.enemy.hp;
        this.playerHp = playerStats.hp || 200;
        this.playerMaxHp = playerStats.maxHp || 200;
        this.playerBaseAtk = playerStats.atk || 30;
        this.turnCount = 0;
        this.enemyActionInterval = Math.max(1, Math.floor(this.enemy.actionInterval || 3));
        this.enemyActionCounter = this.enemyActionInterval;
        this.enemyActionIndex = 0;
        this.earnedExp = 0;
        this.earnedGold = 0;
        this.earnedCoins = 0;
        this.earnedGems = 0;
        this.monsterLvBonus = 0;
        this.enemyPhysDamageCap = null;
        this.enemyMagicDamageCap = null;
        this.playerHasShield = false; 
        if (this.ui && typeof this.ui.setPlayerShield === 'function') {
            this.ui.setPlayerShield(false);
        }
        this.playerHasShield = false;
        this.isActive = true;
        this.isProcessing = false;
        this._chickGot = false;
        this._chickRewards = [];
        this.isScouted = false;
        this.onEndCallback = onEnd;
        const monsterPanelBonus = Math.max(0, options.monsterPanelBonus || 0);
        this._panelWeights = this._buildPanelWeights(monsterPanelBonus);
        this._totalWeight = this._panelWeights.reduce((sum, p) => sum + p.weight, 0);

        const shouldPreserveGrid = !!options.preserveGrid;
        if (!shouldPreserveGrid || !this._hasValidGrid()) {
            this.generateGrid();
        }
        this.ui.setup();
        this.ui.renderAll(this);
        
        // =========================================
        // ▼ 追加: 画面の描画が終わった直後に、敵の登場アニメーションを呼び出す
        // =========================================
        if (this.ui && typeof this.ui.animateEnemyAppear === 'function') {
            this.ui.animateEnemyAppear();
        }

        // =========================================
        // ▼ 修正: 画面の準備が終わった「ここ」で演出の命令を出す！
        // =========================================
        if (this.enemy && this.enemy.isStrong) {
            
            // 強敵用の背景演出をオン！
            if (this.ui && typeof this.ui.startGridEffect === 'function') {
                this.ui.startGridEffect('strong_enemy');
            }

            setTimeout(() => {
                if (app && app.sound) app.sound.play('sys_danger');
                if (this.ui && typeof this.ui._showFloatingText === 'function') {
                    this.ui._showFloatingText('⚠️ 強敵出現！ ⚠️', 'pb-enemy-sprite', '#ff3300', -80);
                }
            }, 400);
            
        } else {
            // ▼ 追加: 通常の敵の場合は、背景を「半透明」にして明るくする！
            if (this.ui && typeof this.ui.stopGridEffect === 'function') {
                this.ui.stopGridEffect();
            }
        }
        
        // ▼ 登場演出の余韻に合わせて…（以降はそのまま）
        setTimeout(() => {
            if (this.isActive) this._updateEnemyChargeState();
        }, 1500);
        
        this.ui.setInputLocked(false);
    }

    // ========================================
    // グリッド生成
    // ========================================
    generateGrid() {
         // 初期盤面は固定パターン（攻撃・魔法・コインのみ）
        // 斜めグラデーション風に配置して、序盤から連鎖を作りやすくする
        this.grid = [];
           const fixedTypes = ['sword', 'magic', 'coin'];
        for (let r = 0; r < this.rows; r++) {
            const row = [];
            for (let c = 0; c < this.cols; c++) {
                 const idx = Math.floor((r + c) / 2) % fixedTypes.length;
                row.push({ type: fixedTypes[idx], removing: false });
            }
            this.grid.push(row);
        }
    }

    _hasValidGrid() {
        if (!Array.isArray(this.grid) || this.grid.length !== this.rows) return false;
        return this.grid.every(row => Array.isArray(row) && row.length === this.cols && row.every(cell => cell && cell.type));
    }

    resetGrid() {
        this.grid = [];
    }

    getGridSnapshot() {
        if (!this._hasValidGrid()) return null;
        return this.grid.map(row => row.map(cell => ({ type: cell.type, removing: !!cell.removing })));
    }

     _buildPanelWeights(monsterPanelBonus = 0) {
        const base = Object.values(PANEL_TYPES).map(p => ({ ...p }));
        const monster = base.find(p => p.id === 'lvup');
        if (monster) monster.weight += Math.floor(monsterPanelBonus);

        // 難易度上昇分は主に通常パネルから按分して、レア率は維持
        const normalIds = ['sword', 'magic', 'coin', 'heal'];
        const reducePool = normalIds.map(id => base.find(p => p.id === id)).filter(Boolean);
        let debt = Math.floor(monsterPanelBonus);
        let idx = 0;
        while (debt > 0 && reducePool.length > 0) {
            const target = reducePool[idx % reducePool.length];
            if (target.weight > 10) {
                target.weight -= 1;
                debt -= 1;
            }
            idx++;
            if (idx > 200) break;
        }
        return base;
    }

    _randomPanel() {
        const chickCount = this._countPanelsByType('chick');
        const lockChick = chickCount >= MAX_CHICK_PANELS_ON_BOARD;
        const pool = lockChick ? this._panelWeights.filter(p => p.id !== 'chick') : this._panelWeights;
        const totalWeight = pool.reduce((sum, p) => sum + p.weight, 0);

        let roll = Math.random() * Math.max(1, totalWeight);
        for (const p of pool) {
            roll -= p.weight;
            if (roll <= 0) return { type: p.id, removing: false };
        }
        return { type: 'sword', removing: false };
    }

    _countPanelsByType(type) {
        let count = 0;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c] && this.grid[r][c].type === type) count++;
            }
        }
        return count;
    }

    // ========================================
    // パネルタップ
    // ========================================
    async onPanelTap(row, col) {
        if (this.isProcessing || !this._hasValidGrid()) return;
        
        // ▼ 修正: r, c ではなく row, col を使う！
        const panel = this.grid[row][col];
        if (!panel) return;

        // ▼ 文字列でもオブジェクトでも、確実にチケット(chick)を判定する
        const isChick = panel === 'chick' || panel.type === 'chick' || panel.id === 'chick';
        
        if (isChick) {
            const speeches = [
                "君、いい根性してるね！仲間にならない？",
                "俺と一緒に、世界の果てを目指そうぜ！",
                "スカウトしたいんだけど、どうかな？",
                "悪いようにはしない。手を取り合おう！"
            ];
            const speechText = speeches[Math.floor(Math.random() * speeches.length)];
            
            // 吹き出しメソッドが存在すれば呼び出す
            if (this.ui && typeof this.ui.showPlayerSpeechBubble === 'function') {
                this.ui.showPlayerSpeechBubble(speechText);
            }
            if (app && app.sound) app.sound.play('se_panel_touch'); 
        } else {
            if (app && app.sound) app.sound.play('se_panel_touch'); 
        }
        this.isProcessing = true;
        this.ui.setInputLocked(true);
       
        const type = panel.type;

      
        const chain = this.findChain(row, col, type);
       if (chain.length === 0) {
            this.isProcessing = false;
            this.ui.setInputLocked(false);
          
            return;
        }
        let killedLvUps = [];
        if (type === 'sword') killedLvUps = this._findAdjacentLvUps(chain);

        const allRemoving = [...chain, ...killedLvUps];

         const removingWithType = allRemoving.map(pos => ({
            row: pos.row,
            col: pos.col,
            type: (this.grid[pos.row] && this.grid[pos.row][pos.col] && this.grid[pos.row][pos.col].type) || type
        }));

        await this.ui.animatePanelRemove(allRemoving);
        const energyMs = this.ui.animatePanelEnergyTransfer(removingWithType);
       if (energyMs > 0) await this.sleep(energyMs);

        await this.applyPanelEffect(type, chain.length, killedLvUps.length);
   // ▼ 通常通り、プレイヤーのモーションを戻し、パネルを消して落下させる処理を先に行う
        if (this.ui && typeof this.ui.setPlayerMotion === 'function') this.ui.setPlayerMotion('idle');
        
        for (const pos of allRemoving) this.grid[pos.row][pos.col] = null;

        await this.dropAndFill(); // ★パネルが落下して隙間を埋める

        // =========================================
        // ▼ 修正: スカウト成功時は「敵の再描画」を防ぎ、そのまま終了する！
        // =========================================
        if (this.isScouted) {
            // パネルの盤面だけを綺麗に更新して、敵は消えたままにする
            if (this.ui && typeof this.ui.renderGrid === 'function') {
                this.ui.renderGrid(this.grid);
            }
            this.endBattle(true);
            return;
        }

        // --- 通常時（スカウトしていない時）のみ、画面全体（敵を含む）を更新する ---
        this.ui.renderAll(this)
        this.turnCount++;
        this.enemyActionCounter--;

      if (this.enemy.hp <= 0) {
            this.ui.setInputLocked(false);
            await this.ui.animateEnemyDefeat();
            await this.sleep(120);
            this.endBattle(true);
            return;
        }
        if (this.enemyActionCounter <= 0) {
            await this.sleep(1200);
            let currentAction = this.enemy.pattern[this.enemyActionIndex % this.enemy.pattern.length];
            await this.doEnemyTurn();
            if (currentAction && (currentAction.action === 'guard_phys' || currentAction.action === 'guard_magic')) {
                this.enemyActionCounter = 1;
            } else {
                this.enemyActionCounter = this.enemyActionInterval;
            }
          if (this.playerHp <= 0) { this.ui.setInputLocked(false); await this.sleep(300); this.endBattle(false); return; }
        }

        this.ui.renderAll(this);
        this._updateEnemyChargeState();
        this.isProcessing = false;
        this.ui.setInputLocked(false);
    }

    // ========================================
    // 連鎖探索（BFS）
    // ========================================
    findChain(startRow, startCol, type) {
        const visited = new Set();
        const queue = [{ row: startRow, col: startCol }];
        const chain = [];
        const key = (r, c) => `${r},${c}`;
        visited.add(key(startRow, startCol));

        while (queue.length > 0) {
            const { row, col } = queue.shift();
            const p = this.grid[row][col];
            if (!p || p.type !== type) continue;
            chain.push({ row, col });
            for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
                const nr = row + dr, nc = col + dc;
                if (nr < 0 || nr >= this.rows || nc < 0 || nc >= this.cols) continue;
                const k = key(nr, nc);
                if (visited.has(k)) continue;
                visited.add(k);
                const np = this.grid[nr][nc];
                if (np && np.type === type) queue.push({ row: nr, col: nc });
            }
        }
        return chain;
    }

    _findAdjacentLvUps(swordChain) {
        const lvUps = [];
        const found = new Set();
        for (const { row, col } of swordChain) {
            for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
                const nr = row + dr, nc = col + dc;
                if (nr < 0 || nr >= this.rows || nc < 0 || nc >= this.cols) continue;
                const k = `${nr},${nc}`;
                if (found.has(k)) continue;
                const p = this.grid[nr][nc];
                if (p && p.type === 'lvup') { found.add(k); lvUps.push({ row: nr, col: nc }); }
            }
        }
        return lvUps;
    }

    // ========================================
    // 効果適用
    // ========================================
    async applyPanelEffect(type, chainCount, killedLvUpCount) {
        const cc = chainCount;
        let waitMs = 0;
        switch (type) {
          case 'sword': {
                const resist = (this.enemy.resistPhys || 0);
                const hitCount = Math.max(1, cc);
                const perHitBase = Math.max(1, Math.floor(this.playerBaseAtk * 0.55));
                for (let i = 0; i < hitCount; i++) {
                    if (this.ui && typeof this.ui.setPlayerMotion === 'function') this.ui.setPlayerMotion('attack');
                    
                    let hitDmg = Math.floor(perHitBase * (1 - resist));
                    
                    // =========================================
                    // ▼ 追加: 1ヒットごとに10%の確率で会心判定！
                    // =========================================
                 // =========================================
                    // ▼ 修正: テキスト表示をやめて、クリティカルフラグ（isCrit）を作る
                    // =========================================
                    const isCritical = Math.random() < 0.20; // 20%
                    let isCrit = false;
                    
                    if (isCritical) {
                        hitDmg = Math.floor(hitDmg * 1.5); 
                        isCrit = true; // クリティカルだったという印だけ立てる
                    }

                    hitDmg = Math.max(1, hitDmg);
                    hitDmg = this._applyEnemyDamageCap('physical', hitDmg);
                    this.enemy.hp = Math.max(0, this.enemy.hp - hitDmg);
                    this.ui.renderEnemy(this.enemy, this.enemyMaxHp);
                    
                    if (app && app.sound) {
                        if (isCritical) app.sound.play('se_critical'); 
                        else app.sound.play('se_attack');
                    }
                    
                    // ▼ 修正: 最後に `isCrit` を第5引数として追加してUIに渡す！
                    const hitAnimMs = this.ui.showDamageToEnemy(hitDmg, 'physical', 1, i, isCrit);
                    const hitWaitMs = Math.max(200, Math.floor(hitAnimMs || 0));
                    await this.sleep(hitWaitMs);
                    if (this.enemy.hp <= 0) break;
                }
                break;
            }
            case 'magic': {
                const resist = (this.enemy.resistMagic || 0);
                const hitCount = Math.max(1, cc);
                const perHitBase = Math.max(1, Math.floor(this.playerBaseAtk * 0.6));
                for (let i = 0; i < hitCount; i++) {
                    if (this.ui && typeof this.ui.setPlayerMotion === 'function') this.ui.setPlayerMotion('attack');
                    
                    let hitDmg = Math.floor(perHitBase * (1 - resist));

                    // =========================================
                    // ▼ 追加: 魔法も1ヒットごとに10%の確率で会心判定！
                    // =========================================
                   // =========================================
                    // ▼ 修正: 魔法も同様にテキスト表示をやめる
                    // =========================================
                    const isCritical = Math.random() < 0.20;
                    let isCrit = false;
                    
                    if (isCritical) {
                        hitDmg = Math.floor(hitDmg * 1.5); 
                        isCrit = true;
                    }

                    hitDmg = Math.max(1, hitDmg);
                    hitDmg = this._applyEnemyDamageCap('magic', hitDmg);
                    this.enemy.hp = Math.max(0, this.enemy.hp - hitDmg);
                    this.ui.renderEnemy(this.enemy, this.enemyMaxHp);
                    
                    if (app && app.sound) {
                        if (isCritical) app.sound.play('se_critical'); 
                        else app.sound.play('se_attack');
                    }
                    
                    // ▼ 修正: 最後に `isCrit` を第5引数として追加してUIに渡す！
                    const hitAnimMs = this.ui.showDamageToEnemy(hitDmg, 'magic', 1, i, isCrit);
                    const hitWaitMs = 250; 
                    await this.sleep(hitWaitMs);
                    if (this.enemy.hp <= 0) break;
                }
                break;
            }
            case 'heal': {
                // 回復量の計算（既存の計算式があればそれに合わせてください）
                const healAmount = Math.floor(this.playerMaxHp * 0.05 * cc); 
                this.playerHp = Math.min(this.playerMaxHp, this.playerHp + healAmount);
                
                // ▼ 修正: 確実に目視できる回復テキストを画面中央付近に長めに出す
                if (this.ui && typeof this.ui._showFloatingText === 'function') {
                    // 少し大きめの文字で、緑色で表示
                   this.ui._showFloatingText(`💚 +${healAmount}`, 'pb-player-sprite', '#33ff33', -20);
                }
                if (app && app.sound) app.sound.play('sys_heal');
                
                waitMs = 300;
                break;
            }
            // =========================================
            // ▼ 追加: モンスターパネルを「直接タッチ」して消した時の処理
            // =========================================
            case 'lvup': {
                // タッチした数（チェイン数）だけ敵をレベルアップさせる（ハイリスク）
                // ※ _applyMonsterLvUp の中で報酬アップ(monsterLvBonus)も加算されます
                this._applyMonsterLvUp(cc);
                
                // 敵が強くなった警告として、危なそうな音を鳴らす
                if (app && app.sound) app.sound.play('sys_danger');
                
                waitMs = 600; // 演出を見せるためのタメ時間
                break;
            }
            case 'coin': {
                const coins = 50 * cc;
                this.earnedCoins += coins;
                this.ui.showCoinEffect(coins, cc);
                break;
            }

            case 'diamond': {
                const gems = 10 * cc;
                this.earnedGems += gems;
                this.ui.showDiamondEffect(gems, cc);
                break;
            }
          case 'chick': {
                // =========================================
                // ★ 新システム：スカウト（捕獲）処理（HP優劣の補正追加版）
                // =========================================
                
                // 1. 確率計算
                const baseRate = 0.05; // 基礎確率 5%
                
                const enemyHpPercent = this.enemy.hp / this.enemyMaxHp;
                const playerHpPercent = this.playerHp / this.playerMaxHp;
                
                // ① 敵のHPが減っているほどボーナス（最大 +40%）
                const enemyHpBonus = (1 - enemyHpPercent) * 0.40; 
                
                // ② プレイヤーのHP割合が敵より高いとプラス、低いとマイナス補正（最大 ±20%）
                const advantageBonus = (playerHpPercent - enemyHpPercent) * 0.20;
                
                // ③ チェインボーナス（1チェインにつき +15%）
                const chainBonus = cc * 0.15; 
                
                // 合計確率を計算（ペナルティでマイナスになっても、最低1%のワンチャンは残す）
                let totalRate = baseRate + enemyHpBonus + advantageBonus + chainBonus;
                totalRate = Math.max(0.01, Math.min(1.0, totalRate));
                
                // 表示用の確率
                const rateText = `${Math.floor(totalRate * 100)}%`;

                // 2. 成功 / 失敗 の判定を先に行う
                const isSuccess = Math.random() < totalRate;

                // 3. UI側に追加した「コロコロ演出」を呼び出す
                if (this.ui && typeof this.ui.animateScoutRolling === 'function') {
                    // ★修正ポイント: エラーの原因だった「r, c」を使わず、画面にあるパネルを直接探す
                    let firstPanelEl = null;
                    if (cc === 0) { // 最初の1チェイン目だけボールを投げる
                        firstPanelEl = document.querySelector('[data-type="chick"]') || document.querySelector('.pb-panel');
                    }
                    // コロコロアニメーションが完了するまで待機
                    await this.ui.animateScoutRolling(firstPanelEl, isSuccess);
                }

                // 演出（コロコロ）が終わった後に、確率を表示
                this.ui._showFloatingText(`スカウト確率 ${rateText}!`, 'pb-enemy-atk-label', '#00ffff');
                
                if (isSuccess) {
                    // -----------------------------
                    // ▼ 成功時の処理（GET!）
                    // -----------------------------
                    if (app && app.sound) {
                        app.sound.play('se_chest_open'); // ゲット音の代用
                        setTimeout(() => app.sound.play('se_chest_open'), 200); // 豪華にする
                    }
                    this.ui._showFloatingText('GET!', 'pb-chain-text', '#ffcc00', 0);
                    
                    // 吸い込まれる余韻（※敵が縮小する演出はanimateScoutRolling内で実行済み）
                    await this.sleep(1000);
                    
                    // 敵のIDを抽出して仲間に加える
                    let unitId = null;
                    if (this.enemy.id && String(this.enemy.id).startsWith('db_')) {
                        unitId = parseInt(this.enemy.id.replace('db_', ''));
                    } else if (this.enemy.id) {
                        unitId = parseInt(this.enemy.id);
                    }
                    
                   // データ保存とリザルト通知
                    if (!isNaN(unitId) && app.data && typeof app.data.addUnit === 'function') {
                        app.data.addUnit(unitId, true); 
                        
                        // ▼ 修正: alert() を廃止し、ゲーム内のテキスト演出に変更！
                        this.ui._showFloatingText(`✨ ${this.enemy.name}が仲間になった！ ✨`, 'pb-enemy-atk-label', '#ffff00', 0);
                        this._chickGot = true; // （リザルト画面などでも使えるようにフラグを立てておく）
                        
                    } else {
                        // DBに紐付かない特殊敵の場合
                        this.ui._showFloatingText(`✨ 特殊モンスターを捕獲！(500G) ✨`, 'pb-enemy-atk-label', '#cccccc', 0);
                        if(app.data) app.data.addGold(500); 
                    }
                    
                    // =========================================
                    // 撃破演出を止めるためのフラグ
                    // =========================================
                    this.isScouted = true; 
                    this.enemy.hp = 0; 
                    return;
                    
                } else {
                    // -----------------------------
                    // ▼ 失敗時の処理
                    // -----------------------------
                    // （※ボールが弾けて敵が飛び出す演出はanimateScoutRolling内で実行済み）
                    this.ui._showFloatingText('スカウト失敗...', 'pb-dmg-text', '#aaaaaa', 0);
                    
                    // 失敗時はそのまま戦闘継続（敵のターン進行へ）
                }
                break;
            }
        }
        // =========================================
        // ▼ 追加: 5連鎖以上で「確定回避シールド」を付与！
        // （※スカウト成功で戦闘が終わっている場合は除く）
       if (cc >= 5 && !this.isScouted) {
            this.playerHasShield = true; 
            if (this.ui && typeof this.ui.setPlayerShield === 'function') {
                this.ui.setPlayerShield(true);
            }
            if (this.ui && typeof this.ui._showFloatingText === 'function') {
                // ▼ 修正: 'pb-player-sprite' を 'char-container' に変更！
                this.ui._showFloatingText('🛡️ 絶対回避!', 'char-container', '#aaddff', -40);
            }
            if (app && app.sound) app.sound.play('sys_buff'); 
            waitMs = Math.max(waitMs, 600);
        }
        if (waitMs > 0) await this.sleep(waitMs);
        return waitMs;
    }

       _applyMonsterLvUp(count) {
        const stacks = Math.max(0, Math.floor(count));
        if (stacks <= 0) return;
        for (let i = 0; i < stacks; i++) {
            this.enemy.atk = Math.floor(this.enemy.atk * 1.1);
            this.enemy.hp = Math.min(this.enemyMaxHp, this.enemy.hp + Math.floor(this.enemyMaxHp * 0.05));
           this.enemy.level = Math.max(1, Math.floor((this.enemy.level || this.enemy.lv || 1) + 1)); 
            this.monsterLvBonus++;
        }
        this.ui.showEnemyLvUp(stacks);
    }

   

       _applyEnemyDamageCap(kind, damage) {
        const cap = kind === 'physical' ? this.enemyPhysDamageCap : this.enemyMagicDamageCap;
        if (!Number.isFinite(cap)) return damage;
        return Math.max(1, Math.min(damage, cap));
    }

    _clearEnemyStance() {
        this.enemyPhysDamageCap = null;
        this.enemyMagicDamageCap = null;
    }

    _setEnemyStance(action) {
        this._clearEnemyStance();
        if (action === 'guard_phys') this.enemyPhysDamageCap = 1;
        if (action === 'guard_magic') this.enemyMagicDamageCap = 1;
    }

    // ========================================
    // 落下＆補充
    // ========================================
    async dropAndFill() {
        for (let c = 0; c < this.cols; c++) {
            let writeRow = this.rows - 1;
            for (let r = this.rows - 1; r >= 0; r--) {
                if (this.grid[r][c] !== null) {
                   const panel = this.grid[r][c];
                    const dropSteps = Math.max(0, writeRow - r);
                    if (r !== writeRow) {
                        this.grid[writeRow][c] = panel;
                        this.grid[r][c] = null;
                    }
                    if (this.grid[writeRow][c]) this.grid[writeRow][c].dropSteps = dropSteps;
                    writeRow--;
                }
            }
              for (let r = writeRow; r >= 0; r--) {
                const newPanel = this._randomPanel();
                newPanel.dropSteps = Math.max(1, writeRow - r + 2);
                this.grid[r][c] = newPanel;
            }
        }

        // 先に新しい盤面を描画してから落下アニメを再生
        this.ui.renderGrid(this.grid);
        await this.ui.animateDrop(this.grid);

        // アニメ専用フラグは除去
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c]) delete this.grid[r][c].dropSteps;
            }
        }
        
    }

  // ========================================
    // 敵ターン
    // ========================================
   // ========================================
    // 敵ターン
    // ========================================
    // ========================================
    // 敵ターン (シールド回避対応版)
    // ========================================
    async doEnemyTurn() {
        let action = this.enemy.pattern[this.enemyActionIndex % this.enemy.pattern.length];
        this.enemyActionIndex++; 

        this._setEnemyStance(action.action);

        if (action.action === 'guard_phys' || action.action === 'guard_magic') {
            await this.ui.animateEnemySkill(action.label || '防御態勢', 0, 'buff');
            this.ui.showEnemyAction(action.label || '防御態勢', '#8bd3ff');
            return;
        }

       // =========================================
        // ▼ 修正: 完全回避 ＋ 10%の通常回避 の両方に対応！
        // =========================================
        const checkShieldAndDodge = () => {
            let isEvaded = false;

            // ① まず「完全回避シールド」があるかチェック (100%回避)
            if (this.playerHasShield) {
                isEvaded = true;
                this.playerHasShield = false; // シールドを消費
                
                // 残像オーラを消す
                if (this.ui && typeof this.ui.setPlayerShield === 'function') {
                    this.ui.setPlayerShield(false);
                }
            } 
            // ② シールドが無い場合、10%の確率で通常の回避が発生！
            else if (Math.random() < 0.10) { 
                isEvaded = true;
                // ※シールドは使っていないので消費処理はなし
            }

            // どちらかの回避が成功していた場合の共通アニメーション処理
            if (isEvaded) {
                // MISS表示
                if (this.ui && typeof this.ui._showFloatingText === 'function') {
                    this.ui._showFloatingText('💨 MISS!', 'char-container', '#ffffff', -20);
                }

                // 残像すり抜けモーション
                const playerEl = document.getElementById('char-container');
                if (playerEl) {
                    playerEl.animate([
                        { opacity: 1, filter: 'brightness(1) blur(0px)' },
                        { opacity: 0.1, filter: 'brightness(2) blur(5px)', offset: 0.15 },
                        { opacity: 0.1, filter: 'brightness(2) blur(5px)', offset: 0.8 },
                        { opacity: 1, filter: 'brightness(1) blur(0px)' }
                    ], { duration: 600, easing: 'ease-in-out' });
                }
                
                return true; // 敵の攻撃ダメージを0にする
            }

            return false; // 回避失敗（ダメージを受ける）
        };

        // --- 吸収攻撃(drain)の処理 ---
        if (action.action === 'drain') {
            let dmg = Math.max(1, Math.floor(this.enemy.atk * (action.power || 1.0)));
            
            // ★ 回避チェック
            const isEvaded = checkShieldAndDodge(); 
            if (isEvaded) dmg = 0; // 回避時はダメージ0
            
            this.playerHp = Math.max(0, this.playerHp - dmg);
            
            if (this.ui && typeof this.ui.setPlayerMotion === 'function') {
                // ダメージを受けた時だけ「やられモーション」にする
                if (!isEvaded) this.ui.setPlayerMotion(this.playerHp <= 0 ? 'die' : 'damage');
            }
            
            // 敵の回復処理（回避した場合は回復させない）
            const heal = isEvaded ? 0 : Math.max(1, Math.floor(dmg * (action.healRate || 0.5)));
            this.enemy.hp = Math.min(this.enemyMaxHp, this.enemy.hp + heal);
            
            await this.ui.animateEnemySkill(action.label || '吸血攻撃', dmg, 'attack');
            
            if (heal > 0) {
                this.ui.showEnemyAction(`+${heal} HP`, '#77ff77');
            } else if (isEvaded) {
                this.ui.showEnemyAction(`ガード!`, '#ffffff');
            }
            return;
        }
        
        // --- 通常攻撃・強打(attack / heavy)などの処理 ---
        let dmg = Math.max(1, Math.floor(this.enemy.atk * (action.power || 1.0)));
        
        // ★ 回避チェック
        const isEvaded = checkShieldAndDodge(); 
        if (isEvaded) dmg = 0; // 回避時はダメージ0
        
        this.playerHp = Math.max(0, this.playerHp - dmg);
        
        if (this.ui && typeof this.ui.setPlayerMotion === 'function') {
            // ダメージを受けた時だけ「やられモーション」にする
            if (!isEvaded) this.ui.setPlayerMotion(this.playerHp <= 0 ? 'die' : 'damage');
        }
        
        await this.ui.animateEnemySkill(action.label || '攻撃', dmg, 'attack');
    }
    _countLvUpPanels() {
        let count = 0;
        for (let r = 0; r < this.rows; r++)
            for (let c = 0; c < this.cols; c++)
                if (this.grid[r][c] && this.grid[r][c].type === 'lvup') count++;
        return count;
    }
// ========================================
    // バトル終了
    // ========================================
    endBattle(isWin) {
        let rewards = { 
            isWin, 
            exp: 0, 
            gold: 0, 
            coins: this.earnedCoins, 
            gems: this.earnedGems, 
            chickGot: this._chickGot, 
            chickRewards: this._chickRewards.slice(), 
            monsterLvBonus: this.monsterLvBonus, 
            guaranteedPanels: [] 
        };
        
        if (isWin) {
            const lvMul = 1 + this.monsterLvBonus * 0.15;
            rewards.exp = Math.floor((this.enemy.expBase || 30) * lvMul);
            rewards.gold = Math.floor((this.enemy.goldBase || 50) * lvMul) + this.earnedCoins;
            
            if (this.enemy.isStrong) {
                // 強敵撃破の確定報酬パネル (必要であれば diamond を coin に変えてもOKです)
                rewards.guaranteedPanels = ['chick', 'diamond'];

                // =========================================
                // ▼ 修正: モンスターパネル(lvup)をコイン(coin)に変換
                // =========================================
                const changedCoords = [];
                if (this.grid) {
                    for (let r = 0; r < this.rows; r++) {
                        for (let c = 0; c < this.cols; c++) {
                            if (this.grid[r][c] && this.grid[r][c].type === 'lvup') {
                                this.grid[r][c].type = 'coin'; // 💎 -> 💰 (データ上をコインに変更)
                                changedCoords.push({ r, c }); 
                            }
                        }
                    }
                    
                    if (changedCoords.length > 0 && this.ui && typeof this.ui.animatePanelsTransform === 'function') {
                        this.ui.setInputLocked(true);

                        if (app && app.sound) app.sound.play('sys_gacha_open'); 
                        if (this.ui._showFloatingText) {
                            // ▼ 修正: メッセージを「💰」に変更！色は金色っぽく
                            this.ui._showFloatingText(`✨ 😈が💰に変化！ ✨`, 'pb-battle-hud', '#ffdd44', -80);
                        }

                        this.ui.animatePanelsTransform(changedCoords, this.grid).then(() => {
                            this.ui.setInputLocked(false);
                            this.ui.showBattleResult(rewards, () => {
                                if (this.onEndCallback) this.onEndCallback(rewards);
                            });
                        });
                        return; 
                    }
                }
            }
        }
        
        this.ui.showBattleResult(rewards, () => {
            if (this.onEndCallback) this.onEndCallback(rewards);
        });
    }
    // ========================================
    // 敵生成ヘルパー（クエスト探索から呼ばれる）
    // ========================================
    static generateEnemy(stageLv, clearCount) {
        const template = PANEL_ENEMIES[Math.floor(Math.random() * PANEL_ENEMIES.length)];
        const enemy = JSON.parse(JSON.stringify(template));
        const scale = 1 + (stageLv - 1) * 0.08 + clearCount * 0.1;
        enemy.hp = Math.floor(enemy.hp * scale);
        enemy.atk = Math.floor(enemy.atk * scale);
        enemy.expBase = Math.floor(enemy.expBase * scale);
        enemy.goldBase = Math.floor(enemy.goldBase * scale);
        enemy.level = Math.max(1, Math.floor(stageLv));
        return enemy;
    }

     injectPanels(panelTypes = []) {
        if (!this._hasValidGrid() || !Array.isArray(panelTypes) || panelTypes.length === 0) return;
        for (const type of panelTypes) {
            if (!PANEL_TYPES[type]) continue;
           // if (type === 'chick' && this._countPanelsByType('chick') >= MAX_CHICK_PANELS_ON_BOARD) continue;
            const candidates = [];
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    const p = this.grid[r][c];
                    if (!p || p.type === type) continue;
                    if (p.type === 'chick' || p.type === 'diamond') continue;
                    candidates.push({ r, c });
                }
            }
            if (candidates.length === 0) continue;
            const pick = candidates[Math.floor(Math.random() * candidates.length)];
            this.grid[pick.r][pick.c] = { type, removing: false };
        }
    }

    sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    // ▼ 追加: 次の敵の行動を予測するメソッド
  _predictNextEnemyAction() {
        if (!this.enemy || !this.enemy.pattern) return null;
        // ▼ 修正: ローテーションで次に実行されるアクションを返す
        return this.enemy.pattern[this.enemyActionIndex % this.enemy.pattern.length];
    }

    // ▼ 追加: 予測に基づいてUI（チャージエフェクト）を更新する
    _updateEnemyChargeState() {
        const nextAction = this._predictNextEnemyAction();
        // 通常攻撃('attack')以外なら「スキル（力を溜める）」と判定
        const isSkill = nextAction && nextAction.action !== 'attack';
        
        if (this.ui && typeof this.ui.setEnemyCharging === 'function') {
            // ▼ 修正: UI側に「スキルかどうか」と「残りターン数」の両方を渡す
            this.ui.setEnemyCharging(isSkill, this.enemyActionCounter);
        }
    }
}
