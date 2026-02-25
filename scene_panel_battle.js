/**
 * scene_panel_battle.js - ピヨピヨクエスト式 6×6 パネルバトル
 * 雑魚戦専用。BOSS戦は既存デッキバトル(scene_battle.js)を使用。
 */

const PANEL_TYPES = {
    sword:  { id: 'sword',  icon: '⚔',  label: 'ぶき',     color: '#4488ff', weight: 25 },
    magic:  { id: 'magic',  icon: '🔥', label: 'まほう',   color: '#ff6622', weight: 20 },
    heal:   { id: 'heal',   icon: '💚', label: '回復',     color: '#44cc44', weight: 18 },
    lvup:   { id: 'lvup',   icon: '😈', label: 'Lvアップ', color: '#8844aa', weight: 12 },
    coin:   { id: 'coin',   icon: '💰', label: 'コイン',   color: '#ddaa00', weight: 15 },
    chick:  { id: 'chick',  icon: '🐤', label: 'ヒヨコ',   color: '#ffdd44', weight: 10 }
};

const PANEL_ENEMIES = [
    {
        id: 'slime', name: 'スライム', emoji: '🟢',
        hp: 80, atk: 12, resistPhys: 0.0, resistMagic: 0.0,
        pattern: [{ turn: 'every', action: 'attack', power: 1.0, label: '体当たり' }],
        expBase: 20, goldBase: 40
    },
    {
        id: 'goblin', name: 'ゴブリン', emoji: '👺',
        hp: 120, atk: 18, resistPhys: 0.0, resistMagic: 0.3,
        pattern: [
            { turn: 'every', action: 'attack', power: 1.0, label: '斬りつけ' },
            { turn: 4, action: 'heavy', power: 2.5, label: '渾身の一撃' }
        ],
        expBase: 35, goldBase: 60
    },
    {
        id: 'skeleton', name: 'スケルトン', emoji: '💀',
        hp: 100, atk: 22, resistPhys: 0.5, resistMagic: -0.3,
        pattern: [
            { turn: 'every', action: 'attack', power: 1.0, label: '骨撃ち' },
            { turn: 3, action: 'heavy', power: 2.0, label: '骨旋風' }
        ],
        expBase: 40, goldBase: 70
    },
    {
        id: 'mage', name: 'ダークメイジ', emoji: '🧙',
        hp: 90, atk: 25, resistPhys: -0.3, resistMagic: 0.5,
        pattern: [
            { turn: 'every', action: 'attack', power: 0.8, label: '闇の弾' },
            { turn: 5, action: 'heavy', power: 3.0, label: 'メテオ' }
        ],
        expBase: 45, goldBase: 80
    },
    {
        id: 'golem', name: 'ゴーレム', emoji: '🗿',
        hp: 200, atk: 15, resistPhys: 0.4, resistMagic: 0.0,
        pattern: [
            { turn: 'every', action: 'attack', power: 1.0, label: '岩拳' },
            { turn: 4, action: 'heavy', power: 2.8, label: '大地震' }
        ],
        expBase: 50, goldBase: 90
    },
    {
        id: 'dragon_baby', name: 'ドラゴンパピー', emoji: '🐉',
        hp: 150, atk: 20, resistPhys: 0.2, resistMagic: 0.2,
        pattern: [
            { turn: 'every', action: 'attack', power: 1.0, label: '噛みつき' },
            { turn: 3, action: 'heavy', power: 2.2, label: 'ブレス' }
        ],
        expBase: 55, goldBase: 100
    }
];

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
        this.earnedExp = 0;
        this.earnedGold = 0;
        this.earnedCoins = 0;
        this.monsterLvBonus = 0;
        this.isActive = false;
        this.isProcessing = false;
        this.onEndCallback = null;
        this._chickGot = false;
        this._totalWeight = Object.values(PANEL_TYPES).reduce((s, p) => s + p.weight, 0);
    }

    // ========================================
    // 開始
    // ========================================
    start(enemyData, playerStats, onEnd) {
        this.enemy = JSON.parse(JSON.stringify(enemyData));
        this.enemyMaxHp = this.enemy.hp;
        this.playerHp = playerStats.hp || 200;
        this.playerMaxHp = playerStats.maxHp || 200;
        this.playerBaseAtk = playerStats.atk || 30;
        this.turnCount = 0;
        this.enemyActionCounter = this.enemyActionInterval;
        this.earnedExp = 0;
        this.earnedGold = 0;
        this.earnedCoins = 0;
        this.monsterLvBonus = 0;
        this.isActive = true;
        this.isProcessing = false;
        this._chickGot = false;
        this.onEndCallback = onEnd;

        this.generateGrid();
        this.ui.setup();
        this.ui.renderAll(this);
    }

    // ========================================
    // グリッド生成
    // ========================================
    generateGrid() {
        this.grid = [];
        for (let r = 0; r < this.rows; r++) {
            const row = [];
            for (let c = 0; c < this.cols; c++) {
                row.push(this._randomPanel());
            }
            this.grid.push(row);
        }
    }

    _randomPanel() {
        let roll = Math.random() * this._totalWeight;
        for (const p of Object.values(PANEL_TYPES)) {
            roll -= p.weight;
            if (roll <= 0) return { type: p.id, removing: false };
        }
        return { type: 'sword', removing: false };
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

        if (type === 'lvup') { this.isProcessing = false; return; }

        const chain = this.findChain(row, col, type);
        if (chain.length === 0) { this.isProcessing = false; return; }

        let killedLvUps = [];
        if (type === 'sword') killedLvUps = this._findAdjacentLvUps(chain);

        const allRemoving = [...chain, ...killedLvUps];

        await this.ui.animatePanelRemove(allRemoving);
        this.applyPanelEffect(type, chain.length, killedLvUps.length);

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
        switch (type) {
            case 'sword': {
                let dmg = Math.floor(this.playerBaseAtk * cc * 0.8);
                dmg = Math.floor(dmg * (1 - (this.enemy.resistPhys || 0)));
                dmg = Math.max(1, dmg);
                this.enemy.hp = Math.max(0, this.enemy.hp - dmg);
                this.ui.showDamageToEnemy(dmg, 'physical', cc);
                if (app && app.sound) app.sound.play('se_attack');
                break;
            }
            case 'magic': {
                let dmg = Math.floor(this.playerBaseAtk * cc * 0.9);
                dmg = Math.floor(dmg * (1 - (this.enemy.resistMagic || 0)));
                dmg = Math.max(1, dmg);
                this.enemy.hp = Math.max(0, this.enemy.hp - dmg);
                this.ui.showDamageToEnemy(dmg, 'magic', cc);
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
            case 'chick': {
                const rate = Math.min(0.8, 0.15 * cc);
                if (Math.random() < rate) {
                    this.ui.showChickGet(cc);
                    this._chickGot = true;
                } else {
                    this.ui.showChickMiss(cc);
                }
                break;
            }
        }
    }

    // ========================================
    // 落下＆補充
    // ========================================
    async dropAndFill() {
        for (let c = 0; c < this.cols; c++) {
            let writeRow = this.rows - 1;
            for (let r = this.rows - 1; r >= 0; r--) {
                if (this.grid[r][c] !== null) {
                    if (r !== writeRow) { this.grid[writeRow][c] = this.grid[r][c]; this.grid[r][c] = null; }
                    writeRow--;
                }
            }
            for (let r = writeRow; r >= 0; r--) this.grid[r][c] = this._randomPanel();
        }
        await this.ui.animateDrop();
    }

    // ========================================
    // 敵ターン
    // ========================================
    async doEnemyTurn() {
        const lvUpCount = this._countLvUpPanels();
        if (lvUpCount > 0) {
            for (let i = 0; i < lvUpCount; i++) {
                this.enemy.atk = Math.floor(this.enemy.atk * 1.1);
                this.enemy.hp = Math.min(this.enemyMaxHp, this.enemy.hp + Math.floor(this.enemyMaxHp * 0.05));
                this.monsterLvBonus++;
            }
            this.ui.showEnemyLvUp(lvUpCount);
            await this.sleep(600);
        }

        let action = null;
        for (const p of this.enemy.pattern) {
            if (typeof p.turn === 'number' && this.turnCount > 0 && this.turnCount % p.turn === 0) action = p;
        }
        if (!action) action = this.enemy.pattern.find(p => p.turn === 'every') || { action: 'attack', power: 1.0, label: '攻撃' };

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
        this.isActive = false;
        let rewards = { isWin, exp: 0, gold: 0, coins: this.earnedCoins, chickGot: this._chickGot, monsterLvBonus: this.monsterLvBonus };
        if (isWin) {
            const lvMul = 1 + this.monsterLvBonus * 0.15;
            rewards.exp = Math.floor((this.enemy.expBase || 30) * lvMul);
            rewards.gold = Math.floor((this.enemy.goldBase || 50) * lvMul) + this.earnedCoins;
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
        return enemy;
    }

    sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}
