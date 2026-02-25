/**
 * panel_battle_ui.js - サイドビュー + パネルグリッド 分割レイアウト
 * 上部: 既存パララックス背景 + キャラ + 敵スプライト + HPバー
 * 下部: 6×6パネルグリッド + ターンカウンター + EXP表示
 */
class PanelBattleUI {
    constructor(controller) {
        this.ctrl = controller;
        this.container = null;
        this._hud = null;
    }

    // ========================================
    // セットアップ（分割レイアウト）
    // ========================================
    setup() {
        // --- 既存UI要素を隠す ---
        const progressBar = document.getElementById('sg-progress-bar');
        const msgBar = document.getElementById('sg-msg-bar');
        if (progressBar) progressBar.style.display = 'none';
        if (msgBar) msgBar.style.display = 'none';

        // --- game-areaを上部に縮小 ---
        const gameArea = document.getElementById('game-area');
        if (gameArea) {
            gameArea.classList.add('pb-battle-mode');
        }

        // --- バトルHUDをgame-areaに追加 ---
        this._setupBattleHUD(gameArea);

        // --- グリッドコンテナを作成（下部） ---
        this._setupGridContainer();

        // キャラをidle状態に
        const charContainer = document.getElementById('char-container');
        if (charContainer) {
            charContainer.classList.remove('anim-run');
            charContainer.classList.add('anim-idle');
        }
    }

    _setupBattleHUD(gameArea) {
        const oldHud = document.getElementById('pb-battle-hud');
        if (oldHud) oldHud.remove();
        if (!gameArea) return;

        const hud = document.createElement('div');
        hud.id = 'pb-battle-hud';
        hud.className = 'pb-battle-hud';
        hud.innerHTML = `
            <div class="pb-enemy-area">
                <div class="pb-enemy-sprite" id="pb-enemy-sprite">🟢</div>
                <div class="pb-enemy-hud-box">
                    <div class="pb-enemy-name" id="pb-enemy-name">スライム</div>
                    <div class="pb-enemy-hp-bar"><div class="pb-enemy-hp-fill" id="pb-enemy-hp-fill"></div></div>
                    <div class="pb-enemy-weak" id="pb-enemy-weak"></div>
                </div>
            </div>
            <div class="pb-player-hud-box">
                <span class="pb-hp-label">HP:</span>
                <span class="pb-hp-val" id="pb-player-hp-text">200</span>
                <div class="pb-player-hp-bar"><div class="pb-player-hp-fill" id="pb-player-hp-fill"></div></div>
            </div>
            <div class="pb-effect-layer" id="pb-effect-layer"></div>
        `;
        gameArea.appendChild(hud);
        this._hud = hud;
    }

    _setupGridContainer() {
        let container = document.getElementById('pb-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'pb-container';
            container.className = 'pb-container';
            const sgScreen = document.getElementById('screen-sugoroku');
            if (sgScreen) sgScreen.appendChild(container);
        }
        this.container = container;

        container.innerHTML = `
            <div class="pb-counter-bar" id="pb-counter-bar">
                <div class="pb-counter-bar-inner">
                    <div class="pb-counter-left">
                        <span class="pb-hp-label-sm">HP:</span>
                        <span class="pb-hp-val-sm" id="pb-player-hp-text2">200</span>
                    </div>
                    <div class="pb-enemy-counter" id="pb-enemy-counter">
                        あと <span id="pb-counter-num">3</span> ターン
                    </div>
                    <div class="pb-counter-right">
                        <span class="pb-turn-label">T:</span>
                        <span class="pb-turn-num" id="pb-turn-num">0</span>
                    </div>
                </div>
            </div>
            <div class="pb-grid-wrapper">
                <div class="pb-grid" id="pb-grid"></div>
            </div>
            <div class="pb-bottom-bar">
                <div class="pb-exp-info">
                    <span>GET EXP <span id="pb-earned-exp">0</span></span>
                    <span>💰 <span id="pb-earned-coins">0</span></span>
                </div>
            </div>
            <div class="pb-overlay" id="pb-overlay" style="display:none;"></div>
        `;
        container.style.display = 'flex';
    }

    // ========================================
    // レンダリング
    // ========================================
    renderAll(state) {
        this.renderEnemy(state.enemy, state.enemyMaxHp);
        this.renderPlayerHP(state.playerHp, state.playerMaxHp);
        this.renderGrid(state.grid);
        this.renderTurnInfo(state.turnCount, state.enemyActionCounter);
        this.renderBottomInfo(state.earnedExp, state.earnedCoins);
    }

    renderEnemy(enemy, maxHp) {
        const nameEl = document.getElementById('pb-enemy-name');
        const spriteEl = document.getElementById('pb-enemy-sprite');
        const hpFill = document.getElementById('pb-enemy-hp-fill');
        const weakEl = document.getElementById('pb-enemy-weak');
        if (nameEl) nameEl.textContent = enemy.name;
        if (spriteEl) spriteEl.textContent = enemy.emoji || '👾';
        const pct = Math.max(0, (enemy.hp / maxHp) * 100);
        if (hpFill) {
            hpFill.style.width = pct + '%';
            hpFill.className = 'pb-enemy-hp-fill';
            if (pct <= 25) hpFill.classList.add('critical');
            else if (pct <= 50) hpFill.classList.add('warning');
        }
        if (weakEl) {
            let w = [];
            if (enemy.resistPhys < 0) w.push('⚔弱点');
            if (enemy.resistPhys > 0.3) w.push('⚔耐性');
            if (enemy.resistMagic < 0) w.push('🔥弱点');
            if (enemy.resistMagic > 0.3) w.push('🔥耐性');
            weakEl.textContent = w.join(' ');
        }
    }

    renderPlayerHP(hp, maxHp) {
        const fill = document.getElementById('pb-player-hp-fill');
        const text = document.getElementById('pb-player-hp-text');
        const text2 = document.getElementById('pb-player-hp-text2');
        const pct = Math.max(0, (hp / maxHp) * 100);
        if (fill) {
            fill.style.width = pct + '%';
            fill.className = 'pb-player-hp-fill';
            if (pct <= 25) fill.classList.add('critical');
            else if (pct <= 50) fill.classList.add('warning');
        }
        const hpStr = `${Math.max(0, hp)}`;
        if (text) text.textContent = hpStr;
        if (text2) text2.textContent = hpStr;
    }

    renderTurnInfo(turnCount, counterLeft) {
        const turnEl = document.getElementById('pb-turn-num');
        const counterEl = document.getElementById('pb-counter-num');
        const counterBox = document.getElementById('pb-enemy-counter');
        if (turnEl) turnEl.textContent = turnCount;
        if (counterEl) counterEl.textContent = counterLeft;
        if (counterBox) {
            counterBox.classList.remove('pb-counter-warn', 'pb-counter-danger');
            if (counterLeft <= 1) counterBox.classList.add('pb-counter-danger');
            else if (counterLeft <= 2) counterBox.classList.add('pb-counter-warn');
        }
    }

    renderBottomInfo(exp, coins) {
        const expEl = document.getElementById('pb-earned-exp');
        const coinEl = document.getElementById('pb-earned-coins');
        if (expEl) expEl.textContent = exp;
        if (coinEl) coinEl.textContent = coins;
    }

    renderGrid(grid) {
        const gridEl = document.getElementById('pb-grid');
        if (!gridEl) return;
        gridEl.innerHTML = '';
        for (let r = 0; r < grid.length; r++) {
            for (let c = 0; c < grid[r].length; c++) {
                const panel = grid[r][c];
                const cell = document.createElement('div');
                cell.className = 'pb-panel';
                cell.dataset.row = r;
                cell.dataset.col = c;
                if (panel) {
                    const pType = PANEL_TYPES[panel.type];
                    cell.classList.add(`pb-panel-${panel.type}`);
                    cell.innerHTML = `<span class="pb-panel-icon">${pType.icon}</span>`;
                    cell.addEventListener('click', () => this.ctrl.onPanelTap(r, c));
                }
                gridEl.appendChild(cell);
            }
        }
    }

    // ========================================
    // アニメーション
    // ========================================
    animatePanelRemove(panelList) {
        return new Promise(resolve => {
            const gridEl = document.getElementById('pb-grid');
            if (!gridEl || panelList.length === 0) { resolve(); return; }
            if (panelList.length >= 2) this._showFloatingText(`×${panelList.length} CHAIN!`, 'pb-chain-text');
            panelList.forEach((pos, i) => {
                const idx = pos.row * 6 + pos.col;
                const cell = gridEl.children[idx];
                if (cell) setTimeout(() => cell.classList.add('pb-panel-removing'), i * 40);
            });
            setTimeout(resolve, panelList.length * 40 + 300);
        });
    }

    animateDrop() {
        return new Promise(resolve => setTimeout(resolve, 150));
    }

    showDamageToEnemy(dmg, type, chainCount) {
        const spriteEl = document.getElementById('pb-enemy-sprite');
        if (spriteEl) { spriteEl.classList.add('pb-enemy-hit'); setTimeout(() => spriteEl.classList.remove('pb-enemy-hit'), 400); }
        const label = type === 'physical' ? '⚔' : '🔥';
        const color = type === 'physical' ? '#4488ff' : '#ff6622';
        this._showFloatingText(`${label} ${dmg}`, 'pb-dmg-text', color);
    }

    showHealEffect(amount) { this._showFloatingText(`💚 +${amount}`, 'pb-heal-text', '#44cc44'); }
    showCoinEffect(coins) { this._showFloatingText(`💰 +${coins}`, 'pb-coin-text', '#ddaa00'); }
    showChickGet() { this._showFloatingText(`🐤 GET!`, 'pb-chick-text', '#ffdd44'); }
    showChickMiss() { this._showFloatingText(`🐤 ...`, 'pb-chick-miss', '#888'); }

    showEnemyLvUp(count) {
        const spriteEl = document.getElementById('pb-enemy-sprite');
        if (spriteEl) { spriteEl.classList.add('pb-enemy-lvup'); setTimeout(() => spriteEl.classList.remove('pb-enemy-lvup'), 600); }
        this._showFloatingText(`😈 敵Lv UP ×${count}!`, 'pb-lvup-text', '#aa44ff');
    }

    animateEnemyAttack(dmg, label) {
        return new Promise(resolve => {
            this._showFloatingText(`${label}!`, 'pb-enemy-atk-label', '#ff4444');
            const screen = document.getElementById('screen-sugoroku');
            if (screen) { screen.classList.add('pb-screen-shake'); setTimeout(() => screen.classList.remove('pb-screen-shake'), 400); }
            setTimeout(() => {
                this._showFloatingText(`-${dmg}`, 'pb-player-dmg-text', '#ff4444');
                if (app && app.sound) app.sound.play('se_damage');
            }, 300);
            setTimeout(resolve, 800);
        });
    }

    // ========================================
    // リザルト表示
    // ========================================
    showBattleResult(rewards, onClose) {
        const ov = document.getElementById('pb-overlay');
        if (!ov) return;
        const isWin = rewards.isWin;
        const title = isWin ? '🎉 勝利！' : '💀 敗北…';
        const titleClass = isWin ? 'pb-result-win' : 'pb-result-lose';
        let rewardHtml = '';
        if (isWin) {
            rewardHtml = `<div class="pb-result-rewards">
                <div class="pb-result-item">📊 EXP: +${rewards.exp}</div>
                <div class="pb-result-item">💰 ゴールド: +${rewards.gold}</div>
                ${rewards.coins > 0 ? `<div class="pb-result-item">🪙 コイン: +${rewards.coins}</div>` : ''}
                ${rewards.chickGot ? `<div class="pb-result-item pb-result-special">🐤 ヒヨコ GET!</div>` : ''}
                ${rewards.monsterLvBonus > 0 ? `<div class="pb-result-item pb-result-bonus">😈 LvUPボーナス ×${rewards.monsterLvBonus}</div>` : ''}
            </div>`;
        }
        ov.innerHTML = `<div class="pb-result-box">
            <div class="pb-result-title ${titleClass}">${title}</div>
            ${rewardHtml}
            <button class="pb-result-btn" id="pb-result-ok">OK</button>
        </div>`;
        ov.style.display = 'flex';
        requestAnimationFrame(() => ov.classList.add('show'));
        document.getElementById('pb-result-ok').addEventListener('click', () => {
            if (app && app.sound) app.sound.play('sys_decide');
            ov.classList.remove('show');
            setTimeout(() => {
                ov.style.display = 'none';
                ov.innerHTML = '';
                this._teardown();
                if (onClose) onClose();
            }, 200);
        });
    }

    // ========================================
    // 後片付け（バトル終了時）
    // ========================================
    _teardown() {
        // HUD削除
        const hud = document.getElementById('pb-battle-hud');
        if (hud) hud.remove();
        this._hud = null;

        // グリッドコンテナ非表示
        if (this.container) {
            this.container.style.display = 'none';
            this.container.innerHTML = '';
        }

        // game-areaを元のサイズに戻す
        const gameArea = document.getElementById('game-area');
        if (gameArea) gameArea.classList.remove('pb-battle-mode');

        // 進行度バー・メッセージバーを復元
        const progressBar = document.getElementById('sg-progress-bar');
        const msgBar = document.getElementById('sg-msg-bar');
        if (progressBar) progressBar.style.display = '';
        if (msgBar) msgBar.style.display = '';
    }

    destroy() {
        this._teardown();
    }

    // ========================================
    // フローティングテキスト
    // ========================================
    _showFloatingText(text, className, color) {
        const layer = document.getElementById('pb-effect-layer');
        if (!layer) return;
        const el = document.createElement('div');
        el.className = `pb-floating-text ${className || ''}`;
        el.textContent = text;
        if (color) el.style.color = color;
        layer.appendChild(el);
        setTimeout(() => el.remove(), 1200);
    }
}
