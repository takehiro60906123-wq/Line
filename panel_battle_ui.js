/**
 * panel_battle_ui.js - サイドビュー + パネルグリッド 分割レイアウト
 * 上部: 既存パララックス背景 + キャラ + 敵スプライト + HPバー
 * 下部: 6×6パネルグリッド + ターンカウンター + EXP表示
 */
function createEnemyAnchorTextElement(text, className, color, order = 0) {
    const layer = document.getElementById('pb-effect-layer');
    const enemyArea = document.getElementById('pb-enemy-area');
    if (!layer || !enemyArea) return null;

    const layerRect = layer.getBoundingClientRect();
    const enemyRect = enemyArea.getBoundingClientRect();
    const spriteEl = document.getElementById('pb-enemy-sprite');
    const targetBox = spriteEl ? spriteEl.getBoundingClientRect() : enemyRect;

    const el = document.createElement('div');
    el.className = `pb-floating-text pb-result-pop ${className || ''}`;
    el.textContent = text;
    if (color) el.style.color = color;

    const popupX = targetBox.left - layerRect.left + targetBox.width * 0.5;
    const popupY = targetBox.top - layerRect.top - 12 + order * 4;
    const x = Math.max(20, Math.min(layerRect.width - 20, popupX));
    const y = Math.max(20, Math.min(layerRect.height - 20, popupY));
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    return el;
}

function createPlayerAnchorTextElement(text, className, color, order = 0) {
    const layer = document.getElementById('pb-effect-layer');
    const charEl = document.getElementById('char-container') || document.getElementById('my-character');
    if (!layer || !charEl) return null;

    const layerRect = layer.getBoundingClientRect();
    const charRect = charEl.getBoundingClientRect();

    const el = document.createElement('div');
    el.className = `pb-floating-text ${className || ''}`;
    el.textContent = text;
    if (color) el.style.color = color;

    const popupX = charRect.left - layerRect.left + charRect.width * 0.5;
    const popupY = charRect.top - layerRect.top - 10 + order * 3;
    const x = Math.max(20, Math.min(layerRect.width - 20, popupX));
    const y = Math.max(20, Math.min(layerRect.height - 20, popupY));
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    return el;
}

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
         if (progressBar) {
            progressBar.style.display = '';
            progressBar.classList.add('pb-progress-inline');
        }
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

        const enemyArea = document.querySelector('#pb-battle-hud .pb-enemy-area');
        if (enemyArea) enemyArea.style.display = '';
        this.setEnemyHudMoving(false);
        this.setInputLocked(false);

    }

     // ========================================
    // クエスト通常時のレイアウト（非戦闘）
    // ========================================
    setupQuestLayout(playerHp, playerMaxHp, gridState = null) {
        const progressBar = document.getElementById('sg-progress-bar');
        const msgBar = document.getElementById('sg-msg-bar');
        if (progressBar) {
            progressBar.style.display = '';
            progressBar.classList.add('pb-progress-inline');
        }
        if (msgBar) msgBar.style.display = 'none';

        const gameArea = document.getElementById('game-area');
        if (gameArea) gameArea.classList.add('pb-battle-mode');

        this._setupBattleHUD(gameArea);
        this._setupGridContainer();

        const charContainer = document.getElementById('char-container');
        if (charContainer) {
            charContainer.classList.remove('anim-run');
            charContainer.classList.add('anim-idle');
        }

        const nameEl = document.getElementById('pb-enemy-name');
        const spriteEl = document.getElementById('pb-enemy-sprite');
        const weakEl = document.getElementById('pb-enemy-weak');
        const realNameEl = document.getElementById('pb-enemy-real-name');
       const atkEl = document.getElementById('pb-enemy-atk');
        const enemyHpText = document.getElementById('pb-enemy-hp-text');
        const enemyHpSlider = document.getElementById('pb-enemy-hp-slider');
       if (nameEl) nameEl.textContent = '敵の様子';
        if (spriteEl) spriteEl.textContent = '';
        if (weakEl) weakEl.textContent = '弱点: -';
        if (realNameEl) realNameEl.textContent = '-';
        if (atkEl) atkEl.textContent = 'ATK 0';
        if (enemyHpText) enemyHpText.textContent = 'HP 0 / 0';
       if (enemyHpSlider) {
            enemyHpSlider.max = '100';
            enemyHpSlider.value = '0';
            enemyHpSlider.style.setProperty('--pb-enemy-hp-pct', '0%');
        }
        this.setEnemyHudMoving(true);
        this.setInputLocked(false);
         const enemyArea = document.getElementById('pb-enemy-area');
        if (enemyArea) {
            enemyArea.classList.remove('pb-enemy-area-detail-open');
            enemyArea.setAttribute('aria-expanded', 'false');
        }
        const safeMax = Math.max(1, playerMaxHp || playerHp || 1);
        const safeHp = Math.max(0, playerHp || safeMax);
        this.renderPlayerHP(safeHp, safeMax);
        this.setQuestStatus('移動中');
        this.renderBottomInfo(0, 0);
        this.renderQuestGrid(gridState);
    }

    setQuestStatus(text) {
        const counterBox = document.getElementById('pb-enemy-counter');
        if (!counterBox) return;
        counterBox.classList.remove('pb-counter-warn', 'pb-counter-danger');
         const label = text || '移動中';
        counterBox.textContent = label;
        this._renderEnemyFootCounter(label);
    }

    setEnemyHudMoving(isMoving) {
        const enemyArea = document.getElementById('pb-enemy-area');
        const walkLabel = document.getElementById('pb-enemy-walk-label');
        if (enemyArea) enemyArea.classList.toggle('pb-enemy-moving', !!isMoving);
        if (walkLabel) walkLabel.style.display = isMoving ? 'block' : 'none';
    }

     _renderEnemyFootCounter(labelText) {
        const footCounter = document.getElementById('pb-enemy-foot-counter');
        if (!footCounter) return;

        footCounter.textContent = labelText || '';
    }

    renderQuestGrid(gridState = null) {
        const gridEl = document.getElementById('pb-grid');
        if (!gridEl) return;
        gridEl.innerHTML = '';

        const hasState = Array.isArray(gridState) && gridState.length > 0;
        if (hasState) {
            for (let r = 0; r < gridState.length; r++) {
                for (let c = 0; c < gridState[r].length; c++) {
                    const panel = gridState[r][c];
                    const pType = panel && PANEL_TYPES[panel.type] ? PANEL_TYPES[panel.type] : PANEL_TYPES.sword;
                    const cell = document.createElement('div');
                    cell.className = `pb-panel pb-panel-${pType.id} pb-panel-locked`;
                    this._setPanelVisual(cell, pType);
                    gridEl.appendChild(cell);
                }
            }
            return;
        }

        for (let i = 0; i < 36; i++) {
            const cell = document.createElement('div');
            cell.className = 'pb-panel pb-panel-sword pb-panel-locked';
            this._setPanelVisual(cell, PANEL_TYPES.sword);
            gridEl.appendChild(cell);
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
            <div class="pb-enemy-area" id="pb-enemy-area" role="button" aria-label="敵詳細を表示" aria-expanded="false" tabindex="0">
                <div class="pb-enemy-visual-stack">
                    <div class="pb-enemy-sprite" id="pb-enemy-sprite">🟢</div>
                    <input type="range" id="pb-enemy-hp-slider" class="pb-hp-slider pb-enemy-slider" min="0" max="100" value="100" style="--pb-enemy-hp-pct: 100%;" disabled>
                    <div class="pb-enemy-foot-counter" id="pb-enemy-foot-counter" aria-live="polite">敵攻撃まで あと 3</div>
                </div>
                <div class="pb-enemy-hud-box">
                  <div class="pb-enemy-basic">
                        <div class="pb-enemy-name" id="pb-enemy-name">スライム</div>
                      
                     <div class="pb-enemy-walk-label" id="pb-enemy-walk-label">🚶 移動中...</div>
                       
                    <div class="pb-enemy-detail" id="pb-enemy-detail">
                        <div class="pb-enemy-real-name" id="pb-enemy-real-name">-</div>
                        <div class="pb-enemy-title-row">
                            <div class="pb-enemy-lv" id="pb-enemy-lv">Lv.1</div>
                            <div class="pb-enemy-atk" id="pb-enemy-atk">ATK 0</div>
                        </div>
                        <div class="pb-enemy-hp-text" id="pb-enemy-hp-text">HP 0 / 0</div>
                        <div class="pb-enemy-weak" id="pb-enemy-weak">弱点: -</div>
                    </div>
                 
                </div>
            </div>

           
            <div class="pb-effect-layer" id="pb-effect-layer"></div>
        `;
        gameArea.appendChild(hud);
        this._hud = hud;
         const enemyArea = document.getElementById('pb-enemy-area');
        if (enemyArea) {
            const toggle = () => {
                enemyArea.classList.toggle('pb-enemy-area-detail-open');
                enemyArea.setAttribute('aria-expanded', enemyArea.classList.contains('pb-enemy-area-detail-open') ? 'true' : 'false');
            };
            enemyArea.addEventListener('click', toggle);
            enemyArea.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggle();
                }
            });
        }
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
                        <div id="pb-player-hp-gauge" class="pb-player-hp-gauge"><div id="pb-player-hp-fill-inline" class="pb-player-hp-fill-inline"></div></div
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
         const enemyArea = document.querySelector('#pb-battle-hud .pb-enemy-area');
        if (enemyArea) enemyArea.style.display = '';
         this.setEnemyHudMoving(false);
        const nameEl = document.getElementById('pb-enemy-name');
        const lvEl = document.getElementById('pb-enemy-lv');
        const spriteEl = document.getElementById('pb-enemy-sprite');
        const hpText = document.getElementById('pb-enemy-hp-text');
        const realNameEl = document.getElementById('pb-enemy-real-name');
        const hpSlider = document.getElementById('pb-enemy-hp-slider');
        const weakEl = document.getElementById('pb-enemy-weak');
        const atkEl = document.getElementById('pb-enemy-atk');
         if (nameEl) nameEl.textContent = '敵の様子';
        if (realNameEl) realNameEl.textContent = enemy.name || '-';
        if (lvEl) lvEl.textContent = `Lv.${Math.max(1, enemy.level || enemy.lv || 1)}`;
         if (spriteEl) {
            const hasImage = !!(enemy.imageUrl);
            spriteEl.classList.toggle('has-image', hasImage);
            if (hasImage) {
                spriteEl.textContent = '';
                spriteEl.style.backgroundImage = `url('${enemy.imageUrl}')`;
            } else {
                spriteEl.style.backgroundImage = '';
                spriteEl.textContent = enemy.emoji || '👾';
            }
        }
        const safeMax = Math.max(1, maxHp || enemy.hp || 1);
        const safeHp = Math.max(0, enemy.hp || 0);
        if (hpText) hpText.textContent = `HP ${safeHp} / ${safeMax}`;
         if (atkEl) atkEl.textContent = `ATK ${Math.max(0, Math.floor(enemy.atk || 0))}`;
        if (hpSlider) {
            hpSlider.max = String(safeMax);
            hpSlider.value = String(Math.min(safeHp, safeMax));
            const pct = Math.max(0, Math.min(100, (safeHp / safeMax) * 100));
            hpSlider.style.setProperty('--pb-enemy-hp-pct', `${pct}%`);
        }
        if (weakEl) {
            let w = [];
            if (enemy.resistPhys < 0) w.push('⚔弱点');
            if (enemy.resistPhys > 0.3) w.push('⚔耐性');
            if (enemy.resistMagic < 0) w.push('🔥弱点');
            if (enemy.resistMagic > 0.3) w.push('🔥耐性');
            weakEl.textContent = `弱点/耐性: ${w.join(' ') || 'なし'}`;
        }
    }

    renderPlayerHP(hp, maxHp) {
        
        
        const text2 = document.getElementById('pb-player-hp-text2');
         const fill = document.getElementById('pb-player-hp-fill-inline');
        const safeMax = Math.max(1, maxHp || hp || 1);
        const safeHp = Math.max(0, hp || 0);
        const pct = Math.max(0, Math.min(100, (safeHp / safeMax) * 100));
        
        if (text2) text2.textContent = `${safeHp}`;
        if (fill) fill.style.width = `${pct}%`;
    }

   renderTurnInfo(turnCount, counterLeft) {
    const safeCounter = Number.isFinite(Number(counterLeft)) ? Number(counterLeft) : 0;
    const turnEl = document.getElementById('pb-turn-num');
    const counterEl = document.getElementById('pb-counter-num');
    const counterBox = document.getElementById('pb-enemy-counter');
    if (turnEl) turnEl.textContent = turnCount;
    if (counterEl) counterEl.textContent = safeCounter;

    const isDanger = safeCounter <= 1;
    const isWarn = !isDanger && safeCounter <= 2;
    if (counterBox) {
        counterBox.classList.remove('pb-counter-warn', 'pb-counter-danger');
        if (isDanger) counterBox.classList.add('pb-counter-danger');
        else if (isWarn) counterBox.classList.add('pb-counter-warn');
    }

   this._renderEnemyFootCounter(`敵攻撃まで あと ${safeCounter}`);
}


    renderBottomInfo(exp, coins) {
        const expEl = document.getElementById('pb-earned-exp');
        const coinEl = document.getElementById('pb-earned-coins');
        if (expEl) expEl.textContent = exp;
        if (coinEl) coinEl.textContent = coins;
    }


    _setPanelVisual(cell, pType) {
        if (!cell || !pType) return;
        const iconEl = document.createElement('span');
        iconEl.className = 'pb-panel-icon';
        iconEl.textContent = pType.icon || '⚔';

         const imageCandidates = Array.isArray(pType.image)
            ? pType.image.filter(Boolean)
            : (pType.image ? [pType.image] : []);

        if (pType._imageUnavailable) {
            cell.appendChild(iconEl);
            return;
        }

        const resolvedSrc = pType._resolvedImage || null;
        const sources = resolvedSrc ? [resolvedSrc] : imageCandidates;

        if (sources.length > 0) {
            cell.classList.add('pb-panel-has-art');
            const imgEl = document.createElement('img');
            imgEl.className = 'pb-panel-art';
            imgEl.src = sources[0];
            imgEl.alt = pType.label || pType.id || 'panel';
            imgEl.loading = 'lazy';
            iconEl.style.display = 'none';
            let candidateIndex = 0;
            imgEl.addEventListener('load', () => {
                pType._resolvedImage = imgEl.currentSrc || imgEl.src;
                pType._imageUnavailable = false;
            }, { once: true });

            imgEl.addEventListener('error', () => {
                candidateIndex += 1;
                   if (candidateIndex < sources.length) {
                    imgEl.src = sources[candidateIndex];
                    return;
                }
                 pType._imageUnavailable = true;
                imgEl.remove();
                cell.classList.remove('pb-panel-has-art');
                iconEl.style.display = '';
             });
            cell.appendChild(imgEl);
        }

        cell.appendChild(iconEl);
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
                    this._setPanelVisual(cell, pType);
                    const dropSteps = Math.max(0, Number(panel.dropSteps) || 0);
                    if (dropSteps > 0) {
                        cell.classList.add('pb-panel-dropping');
                        cell.style.setProperty('--pb-drop-distance', `${Math.min(240, dropSteps * 38)}px`);
                        cell.style.setProperty('--pb-drop-delay', `${Math.min(220, dropSteps * 22)}ms`);
                    }
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

     animateDrop(grid = null) {
        const maxDropSteps = Array.isArray(grid)
            ? grid.flat().reduce((m, p) => Math.max(m, (p && p.dropSteps) ? p.dropSteps : 0), 0)
            : 0;
        const duration = 220 + Math.min(260, maxDropSteps * 45);
        return new Promise(resolve => setTimeout(resolve, duration));
    }
 showDamageToEnemy(dmg, type, chainCount, hitIndex = 0) {
       
         const delay = Math.max(0, (hitIndex || 0) * 140);
        setTimeout(() => {
            
          const layer = document.getElementById('pb-effect-layer');
          
            if (!layer) return;
             const showImpact = () => {
                const spriteEl = document.getElementById('pb-enemy-sprite');
                if (spriteEl) { spriteEl.classList.add('pb-enemy-hit'); setTimeout(() => spriteEl.classList.remove('pb-enemy-hit'), 220); }
                this._spawnHitEffect(type, hitIndex);

                const el = createEnemyAnchorTextElement(`${dmg}`, 'pb-dmg-text', null, hitIndex);
                if (!el) return;
                layer.appendChild(el);
                setTimeout(() => el.remove(), 1200);
            };

            if (type === 'magic') {
                this._spawnMagicBullet(hitIndex, showImpact);
            } else {
                showImpact();
            }
            
        }, delay);
    }

    showHealEffect(amount) { this._showFloatingText(`💚 +${amount}`, 'pb-heal-text', '#44cc44'); }
    showCoinEffect(coins) { this._showFloatingText(`💰 +${coins}`, 'pb-coin-text', '#ddaa00'); }
    showDiamondEffect(gems) { this._showFloatingText(`💎 +${gems}`, 'pb-coin-text', '#66e0ff'); }
    showChickGet() { this._showFloatingText(`🎫 GET!`, 'pb-chick-text', '#ffdd44'); }
    showChickMiss() { this._showFloatingText(`🐤 ...`, 'pb-chick-miss', '#888'); }


     showChickRewards(units = []) {
        if (!Array.isArray(units) || units.length === 0) return 0;
       
        const layer = document.getElementById('pb-effect-layer');
        if (!layer) return;

        const queue = units.slice(0, 3).map(unit => {
            const name = unit && unit.name ? unit.name : '???';
           
            return `🎉 ${name} 入手!`;
        });
        
        if (units.length > 3) queue.push(`+${units.length - 3} 体`);

        const slotMs = 2100; // 2秒表示 + 少しの間隔
        queue.forEach((text, idx) => {
            setTimeout(() => {
              
                const el = document.createElement('div');
                el.className = 'pb-floating-text pb-chick-reward-text';
                el.textContent = text;
                el.style.color = '#ffef8a';
                layer.appendChild(el);
                setTimeout(() => el.remove(), 2000);
            }, idx * slotMs);
        });
        return (queue.length - 1) * slotMs + 2000;
    }
    showEnemyLvUp(count) {
        const spriteEl = document.getElementById('pb-enemy-sprite');
        if (spriteEl) { spriteEl.classList.add('pb-enemy-lvup'); setTimeout(() => spriteEl.classList.remove('pb-enemy-lvup'), 600); }
        this._showEnemyPopupText(`😈 敵Lv UP ×${count}!`, 'pb-lvup-text', '#aa44ff');
    }

     showEnemyAction(text, color = '#8bd3ff') {
        this._showFloatingText(text, 'pb-enemy-atk-label', color);
        return new Promise(resolve => setTimeout(resolve, 500));
    }

    animateEnemyAttack(dmg, label) {
        return new Promise(resolve => {
            this._showFloatingText(`${label}!`, 'pb-enemy-atk-label', '#ff4444');
            const screen = document.getElementById('screen-sugoroku');
            if (screen) { screen.classList.add('pb-screen-shake'); setTimeout(() => screen.classList.remove('pb-screen-shake'), 400); }
            setTimeout(() => {
                this._showPlayerPopupText(`-${dmg}`, 'pb-player-dmg-text', '#ff4444');
                if (app && app.sound) app.sound.play('se_damage');
            }, 300);
            setTimeout(resolve, 800);
        });
    }

    // ========================================
    // リザルト表示
    // ========================================
    showBattleResult(rewards, onClose) {
        const isWin = !!rewards.isWin;
        const lines = [];
        lines.push({ text: isWin ? '🎉 勝利！' : '💀 敗北…', cls: isWin ? 'pb-result-pop-win' : 'pb-result-pop-lose', color: isWin ? '#ffd700' : '#ff6666' });
        if (isWin) {
            lines.push({ text: `📊 EXP +${rewards.exp || 0}`, cls: 'pb-result-pop-reward', color: '#9ee6ff' });
            lines.push({ text: `💰 ゴールド +${rewards.gold || 0}`, cls: 'pb-result-pop-reward', color: '#ffde7a' });
            if ((rewards.coins || 0) > 0) lines.push({ text: `🪙 コイン +${rewards.coins}`, cls: 'pb-result-pop-reward', color: '#ffd86b' });
            if ((rewards.gems || 0) > 0) lines.push({ text: `💎 ダイア +${rewards.gems}`, cls: 'pb-result-pop-reward', color: '#8be9ff' });
            if (rewards.chickGot) lines.push({ text: '🎫 チケット GET!', cls: 'pb-result-pop-special', color: '#ffef8a' });
            if (rewards.guaranteedPanels && rewards.guaranteedPanels.length > 0) {
                lines.push({ text: '次戦 🎫/💎 確定追加！', cls: 'pb-result-pop-special', color: '#ffef8a' });
            }
            if ((rewards.monsterLvBonus || 0) > 0) {
                lines.push({ text: `😈 LvUPボーナス ×${rewards.monsterLvBonus}`, cls: 'pb-result-pop-special', color: '#caa4ff' });
            }
        }
        const delay = 420;
        const finalWait = 900;
        lines.forEach((item, index) => {
            setTimeout(() => {
                this._showEnemyPopupText(item.text, item.cls, item.color, index);
                if (index === 0 && app && app.sound) app.sound.play(isWin ? 'sys_decide' : 'se_damage');
            }, index * delay);
        });
        const total = (Math.max(lines.length, 1) - 1) * delay + finalWait;
        setTimeout(() => {
            this._teardown();
            if (onClose) onClose();
        }, total);
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
        if (progressBar) {
            progressBar.classList.remove('pb-progress-inline');
            progressBar.style.display = '';
        }
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
        if (!layer) return 0;
        const el = document.createElement('div');
        el.className = `pb-floating-text ${className || ''}`;
        el.textContent = text;
        if (color) el.style.color = color;
        layer.appendChild(el);
        setTimeout(() => el.remove(), 1200);
    }
     _createEnemyAnchorText(text, className, color, order = 0) {
        return createEnemyAnchorTextElement(text, className, color, order);
    }

    _showEnemyPopupText(text, className, color, order = 0) {
        const layer = document.getElementById('pb-effect-layer');
        const el = createEnemyAnchorTextElement(text, className, color, order);
        if (!layer || !el) {
            this._showFloatingText(text, className, color);
            return;
        }
        layer.appendChild(el);
        setTimeout(() => el.remove(), 1400);
    }

    _showPlayerPopupText(text, className, color, order = 0) {
        const layer = document.getElementById('pb-effect-layer');
        const el = createPlayerAnchorTextElement(text, className, color, order);
        if (!layer || !el) {
            this._showFloatingText(text, className, color);
            return;
        }
        layer.appendChild(el);
        setTimeout(() => el.remove(), 1200);
    }

    setInputLocked(locked) {
        const container = document.getElementById('pb-container');
        if (!container) return;
        container.classList.toggle('pb-input-locked', !!locked);
    }

    _spawnMagicBullet(hitIndex = 0, onHit) {
        const layer = document.getElementById('pb-effect-layer');
        const enemyArea = document.getElementById('pb-enemy-area');
        if (!layer || !enemyArea) {
            if (onHit) onHit();
            return;
        }

        const layerRect = layer.getBoundingClientRect();
        const enemyRect = enemyArea.getBoundingClientRect();
        const spriteEl = document.getElementById('pb-enemy-sprite');
        const targetBox = spriteEl ? spriteEl.getBoundingClientRect() : enemyRect;
        const aim = {
            x: targetBox.left - layerRect.left + targetBox.width * 0.5,
            y: targetBox.top - layerRect.top + targetBox.height * 0.56 + Math.min(10, hitIndex * 2)
        };

        const bulletSize = 28;
        const half = bulletSize * 0.5;
        const startX = Math.max(18, layerRect.width * 0.26) - half;
        const startY = Math.max(24, layerRect.height * 0.62 - Math.min(16, hitIndex * 3)) - half;
        const endX = aim.x - half;
        const endY = aim.y - half;
        const bullet = document.createElement('div');
        bullet.className = 'pb-magic-bullet';
        bullet.style.setProperty('--pb-bullet-sx', `${startX}px`);
        bullet.style.setProperty('--pb-bullet-sy', `${startY}px`);
        bullet.style.setProperty('--pb-bullet-ex', `${endX}px`);
        bullet.style.setProperty('--pb-bullet-ey', `${endY}px`);
        layer.appendChild(bullet);

        const travelMs = 380;
        setTimeout(() => {
            bullet.remove();
            if (onHit) onHit();
        }, travelMs);
    }

     _spawnHitEffect(type, hitIndex = 0) {
        const layer = document.getElementById('pb-effect-layer');
        const enemyArea = document.getElementById('pb-enemy-area');
        if (!layer || !enemyArea) return;

        const layerRect = layer.getBoundingClientRect();
        const spriteEl = document.getElementById('pb-enemy-sprite');
        const anchorRect = spriteEl ? spriteEl.getBoundingClientRect() : enemyArea.getBoundingClientRect();
        const cx = anchorRect.left - layerRect.left + anchorRect.width * 0.5;
        const cy = anchorRect.top - layerRect.top + anchorRect.height * 0.56 + Math.min(16, hitIndex * 3);
        const physical = type === 'physical';
        const particleCount = physical ? 7 : 10;
        const hue = physical ? 210 : 18;

         const core = document.createElement('div');
        core.className = physical ? 'pb-hit-core-slash' : 'pb-hit-core-fire';
        core.style.left = `${cx}px`;
        core.style.top = `${cy}px`;
        if (physical) {
            core.style.setProperty('--pb-slash-rot', `${-28 + Math.random() * 56}deg`);
        }
        layer.appendChild(core);
        setTimeout(() => core.remove(), physical ? 300 : 420);

        const burst = document.createElement('div');
        burst.className = `pb-hit-burst ${physical ? 'pb-hit-burst-physical' : 'pb-hit-burst-magic'}`;
        burst.style.left = `${cx}px`;
        burst.style.top = `${cy}px`;
        layer.appendChild(burst);
        setTimeout(() => burst.remove(), 420);

        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.25;
            const speed = (physical ? 28 : 34) + Math.random() * 24;
            const px = Math.cos(angle) * speed;
            const py = Math.sin(angle) * speed;
            const particle = document.createElement('div');
            particle.className = `pb-hit-particle ${physical ? 'pb-hit-particle-physical' : 'pb-hit-particle-magic'}`;
            particle.style.left = `${cx}px`;
            particle.style.top = `${cy}px`;
            particle.style.setProperty('--pb-px', `${px}px`);
            particle.style.setProperty('--pb-py', `${py}px`);
            particle.style.setProperty('--pb-pr', `${1.6 + Math.random() * 2.2}px`);
            particle.style.setProperty('--pb-hue', `${hue + (Math.random() * 16 - 8)}`);
            particle.style.animationDelay = `${Math.random() * 40}ms`;
            layer.appendChild(particle);
            setTimeout(() => particle.remove(), 520);
        }
    }
}
