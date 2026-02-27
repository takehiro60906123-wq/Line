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
        this.earnedExp = 0;
        this.earnedGold = 0;
        this.earnedCoins = 0;
        this.earnedGems = 0;
        this.monsterLvBonus = 0;
        this.enemyPhysDamageCap = null;
        this.enemyMagicDamageCap = null;
        this.isActive = true;
        this.isProcessing = false;
        this._chickGot = false;
        this._chickRewards = [];
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
        if (!this.isActive || this.isProcessing) return;
        const panel = this.grid[row][col];
        if (!panel || panel.removing) return;
        this.isProcessing = true;
        const type = panel.type;

      
        const chain = this.findChain(row, col, type);
        if (chain.length === 0) { this.isProcessing = false; return; }

        let killedLvUps = [];
        if (type === 'sword') killedLvUps = this._findAdjacentLvUps(chain);

        const allRemoving = [...chain, ...killedLvUps];

        await this.ui.animatePanelRemove(allRemoving);
        const effectDelayMs = this.applyPanelEffect(type, chain.length, killedLvUps.length);
        if (effectDelayMs > 0) await this.sleep(effectDelayMs);

        for (const pos of allRemoving) this.grid[pos.row][pos.col] = null;

        await this.dropAndFill();
        this.ui.renderAll(this);

        this.turnCount++;
        this.enemyActionCounter--;

        if (this.enemy.hp <= 0) { await this.sleep(300); this.endBattle(true); return; }

        if (this.enemyActionCounter <= 0) {
            await this.sleep(300);
            await this.doEnemyTurn();
            this.enemyActionCounter = this.enemyActionInterval;
            if (this.playerHp <= 0) { await this.sleep(300); this.endBattle(false); return; }
        }

        this.ui.renderAll(this);
        this.isProcessing = false;
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
    applyPanelEffect(type, chainCount, killedLvUpCount) {
        const cc = chainCount;
        let waitMs = 0;
        switch (type) {
            case 'sword': {
                 const resist = (this.enemy.resistPhys || 0);
                const hitCount = Math.max(1, cc);
                const perHitBase = Math.max(1, Math.floor(this.playerBaseAtk * 0.55));
                for (let i = 0; i < hitCount; i++) {
                    let hitDmg = Math.floor(perHitBase * (1 - resist));
                    hitDmg = Math.max(1, hitDmg);
                    hitDmg = this._applyEnemyDamageCap('physical', hitDmg);
                    this.enemy.hp = Math.max(0, this.enemy.hp - hitDmg);
                    this.ui.showDamageToEnemy(hitDmg, 'physical', 1, i);
                    if (this.enemy.hp <= 0) break;
                }
                if (killedLvUpCount > 0) {
                    this._applyMonsterLvUp(killedLvUpCount);
                }
                if (app && app.sound) app.sound.play('se_attack');
                break;
            }
            case 'magic': {
                const resist = (this.enemy.resistMagic || 0);
                const hitCount = Math.max(1, cc);
                const perHitBase = Math.max(1, Math.floor(this.playerBaseAtk * 0.6));
                for (let i = 0; i < hitCount; i++) {
                    let hitDmg = Math.floor(perHitBase * (1 - resist));
                    hitDmg = Math.max(1, hitDmg);
                    hitDmg = this._applyEnemyDamageCap('magic', hitDmg);
                    this.enemy.hp = Math.max(0, this.enemy.hp - hitDmg);
                       this.ui.showDamageToEnemy(hitDmg, 'magic', 1, i);
                    if (this.enemy.hp <= 0) break;
                }
                if (app && app.sound) app.sound.play('se_attack');
                break;
            }
            case 'heal': {
                const healAmt = Math.floor(this.playerMaxHp * 0.08 * cc);
                this.playerHp = Math.min(this.playerMaxHp, this.playerHp + healAmt);
                this.ui.showHealEffect(healAmt, cc);
                if (app && app.sound) app.sound.play('sys_decide');
                break;
            }
            case 'coin': {
                const coins = 10 * cc;
                this.earnedCoins += coins;
                this.ui.showCoinEffect(coins, cc);
                break;
            }

            case 'diamond': {
                const gems = 2 * cc;
                this.earnedGems += gems;
                this.ui.showDiamondEffect(gems, cc);
                break;
            }
            case 'chick': {
                  const pulls = Math.max(1, cc);
                const got = [];
                if (app && app.data && typeof DB !== 'undefined' && Array.isArray(DB) && DB.length > 0) {
                    for (let i = 0; i < pulls; i++) {
                        const base = (app.gachaScreen && typeof app.gachaScreen.spin === 'function')
                            ? app.gachaScreen.spin()
                            : DB[Math.floor(Math.random() * DB.length)];
                        if (!base || !base.id) continue;
                        app.data.addUnit(base.id, true);
                        got.push({ id: base.id, name: base.name, cost: base.cost });
                    }
                }
                if (got.length > 0) {
                    this._chickRewards.push(...got);
                    this._chickGot = true;
                    this.ui.showChickGet(cc);
                     waitMs = Math.max(waitMs, this.ui.showChickRewards(got));
                    if (app && app.sound) app.sound.play('sys_gacha_open');
                } else {
                    this.ui.showChickMiss(cc);
                }
                break;
            }
            case 'lvup': {
                this._applyMonsterLvUp(cc);
                if (app && app.sound) app.sound.play('se_attack');
                break;
            }
        }
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
    async doEnemyTurn() {
        const lvUpCount = this._countLvUpPanels();
        if (lvUpCount > 0) {
             this._applyMonsterLvUp(lvUpCount);
            await this.sleep(600);
        }

        let action = null;
        for (const p of this.enemy.pattern) {
            if (typeof p.turn === 'number' && this.turnCount > 0 && this.turnCount % p.turn === 0) action = p;
        }
        if (!action) action = this.enemy.pattern.find(p => p.turn === 'every') || { action: 'attack', power: 1.0, label: '攻撃' };

         this._setEnemyStance(action.action);

        if (action.action === 'guard_phys' || action.action === 'guard_magic') {
            await this.ui.showEnemyAction(action.label || '防御態勢', '#8bd3ff');
            return;
        }

        if (action.action === 'drain') {
            const dmg = Math.max(1, Math.floor(this.enemy.atk * (action.power || 1.0)));
            this.playerHp = Math.max(0, this.playerHp - dmg);
            const heal = Math.max(1, Math.floor(dmg * (action.healRate || 0.5)));
            this.enemy.hp = Math.min(this.enemyMaxHp, this.enemy.hp + heal);
            await this.ui.animateEnemyAttack(dmg, action.label || '吸血攻撃');
            this.ui.showEnemyAction(`+${heal} HP`, '#77ff77');
            return;
        }
        const dmg = Math.max(1, Math.floor(this.enemy.atk * (action.power || 1.0)));
        this.playerHp = Math.max(0, this.playerHp - dmg);
        await this.ui.animateEnemyAttack(dmg, action.label || '攻撃');
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
        let rewards = { isWin, exp: 0, gold: 0, coins: this.earnedCoins, gems: this.earnedGems, chickGot: this._chickGot, chickRewards: this._chickRewards.slice(), monsterLvBonus: this.monsterLvBonus, guaranteedPanels: [] };
        if (isWin) {
            const lvMul = 1 + this.monsterLvBonus * 0.15;
            rewards.exp = Math.floor((this.enemy.expBase || 30) * lvMul);
            rewards.gold = Math.floor((this.enemy.goldBase || 50) * lvMul) + this.earnedCoins;
        if (this.enemy.isStrong) rewards.guaranteedPanels = ['chick', 'diamond'];
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
            if (type === 'chick' && this._countPanelsByType('chick') >= MAX_CHICK_PANELS_ON_BOARD) continue;
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
}
