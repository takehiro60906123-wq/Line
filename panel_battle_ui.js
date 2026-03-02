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

const PANEL_PLAYER_SPRITE_SHEETS = {
    idle:   { src: 'images/player_main_idle_sheet.png',   cols: 4, rows: 4, frames: 7,  fps: 8,  loop: true },
    move:   { src: 'images/player_main_move_sheet.png',   cols: 4, rows: 4, frames: 5,  fps: 10, loop: true },
    attack: { src: 'images/player_main_attack_sheet.png', cols: 4, rows: 4, frames: 6,  fps: 24, loop: false },
    damage: { src: 'images/player_main_damage_sheet.png', cols: 4, rows: 4, frames: 5,  fps: 10, loop: false },
    die:    { src: 'images/player_main_die_sheet.png',    cols: 4, rows: 4, frames: 10, fps: 10, loop: false }
};

// ▼ 追加：画像を事前にブラウザに読み込ませて、切り替え時のチラつき（一瞬消える現象）を防ぐ
Object.values(PANEL_PLAYER_SPRITE_SHEETS).forEach(sheet => {
    const img = new Image();
    img.src = sheet.src;
});
class PanelBattleUI {
    constructor(controller) {
        this.ctrl = controller;
        this.container = null;
        this._hud = null;
        this._spriteAnimTimer = null;
        this._spriteAnimKey = '';
        this._playerAnimTimer = null;
        this._playerAnimKey = '';
        this._playerAnimFallbackTimer = null;
        this._playerVisualSnapshot = null;
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
        this.setPlayerMotion('idle');

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
        if (nameEl) { nameEl.textContent = '🔍 敵の様子'; nameEl.classList.add('pb-enemy-look-icon'); }
        if (spriteEl) spriteEl.textContent = '';
        if (weakEl) weakEl.textContent = '弱点: -';
        if (realNameEl) realNameEl.textContent = '-';
         const safeAtk = 0;
        if (atkEl) atkEl.textContent = `ATK ${safeAtk}`;
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

    // ▼ 追加: 敵のチャージ（力溜め）エフェクトのON/OFF
   // ▼ 修正: 敵のチャージ（力溜め）エフェクトとテキストの変更
    setEnemyCharging(isCharging, counter) {
        const spriteEl = document.getElementById('pb-enemy-sprite');
        if (spriteEl) {
            if (isCharging) {
                spriteEl.classList.add('pb-enemy-charging');
            } else {
                spriteEl.classList.remove('pb-enemy-charging');
            }
        }

        // ▼ 追加: スキル時はテキストを「大技」など危険な表示に切り替える
        if (counter !== undefined) {
            // 足元のテキスト
            const text = isCharging ? `⚠️ 大技まで あと ${counter}` : `敵攻撃まで あと ${counter}`;
            this._renderEnemyFootCounter(text);
            
            // （おまけ）画面上部のターンカウンターもスキル時は赤くしてテキストを変える
            const counterBox = document.getElementById('pb-enemy-counter');
            if (counterBox) {
                counterBox.innerHTML = isCharging 
                    ? `<span style="color:#ff6666;">⚠️大技まで <span id="pb-counter-num">${counter}</span></span>` 
                    : `あと <span id="pb-counter-num">${counter}</span> ターン`;
            }
        }
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
                           <div class="pb-enemy-hp-text" id="pb-enemy-hp-text">HP 0 / 0</div>     
                        </div>
                       <div class="pb-enemy-atk" id="pb-enemy-atk">ATK 0</div>
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

      _getPlayerVisualEl() {
        return document.getElementById('char-visual');
    }

    _clearPlayerMotionTimer() {
        if (this._playerAnimTimer) {
            clearInterval(this._playerAnimTimer);
            this._playerAnimTimer = null;
        }
        if (this._playerAnimFallbackTimer) {
            clearTimeout(this._playerAnimFallbackTimer);
            this._playerAnimFallbackTimer = null;
        }
        this._playerAnimKey = '';
    }

    _restorePlayerVisualSnapshot() {
        const visualEl = this._getPlayerVisualEl();
        if (!visualEl || !this._playerVisualSnapshot) return;
        visualEl.style.backgroundImage = this._playerVisualSnapshot.backgroundImage;
        visualEl.style.backgroundSize = this._playerVisualSnapshot.backgroundSize;
        visualEl.style.backgroundPosition = this._playerVisualSnapshot.backgroundPosition;
        this._playerVisualSnapshot = null;
    }

    setPlayerMotion(motion) {
        const cfg = PANEL_PLAYER_SPRITE_SHEETS[motion];
        const visualEl = this._getPlayerVisualEl();
        const charContainer = document.getElementById('char-container');
        if (!visualEl || !cfg || !cfg.src) return;

        if (!this._playerVisualSnapshot) {
            this._playerVisualSnapshot = {
                backgroundImage: visualEl.style.backgroundImage || '',
                backgroundSize: visualEl.style.backgroundSize || '',
                backgroundPosition: visualEl.style.backgroundPosition || ''
            };
        }

        this._clearPlayerMotionTimer();

        if (charContainer) {
            charContainer.classList.toggle('anim-run', motion === 'move');
            charContainer.classList.toggle('anim-idle', motion !== 'move');
        }

        const cols = Math.max(1, Math.floor(cfg.cols || 1));
        const rows = Math.max(1, Math.floor(cfg.rows || 1));
        const frames = Math.max(1, Math.floor(cfg.frames || (cols * rows)));
        const fps = Math.max(1, Math.floor(cfg.fps || 8));
        const loop = cfg.loop !== false;

       visualEl.style.backgroundImage = `url('${cfg.src}')`;
        visualEl.style.backgroundSize = `${cols * 100}% ${rows * 100}%`;
        visualEl.style.backgroundRepeat = 'no-repeat'; // 👈 追加（ループさせない）
        visualEl.style.imageRendering = 'pixelated';   // 👈 追加（ドットをくっきりさせる
        let frame = 0;
        const frameMs = Math.max(40, Math.floor(1000 / fps));
        const key = `${motion}|${cfg.src}|${cols}|${rows}|${frames}|${fps}|${loop}`;
        this._playerAnimKey = key;

        const applyFrame = (idx) => {
            const safe = Math.max(0, Math.min(frames - 1, idx));
            const col = safe % cols;
            const row = Math.floor(safe / cols);
            const xPct = cols <= 1 ? 0 : (col / (cols - 1)) * 100;
            const yPct = rows <= 1 ? 0 : (row / (rows - 1)) * 100;
            visualEl.style.backgroundPosition = `${xPct}% ${yPct}%`;
        };

        applyFrame(0);
        this._playerAnimTimer = setInterval(() => {
            const current = this._getPlayerVisualEl();
            if (!current || current !== visualEl || this._playerAnimKey !== key) {
                this._clearPlayerMotionTimer();
                return;
            }
            frame += 1;
            if (frame >= frames) {
                if (loop) {
                    frame = 0;
                } else {
                    frame = frames - 1;
                    applyFrame(frame);
                    this._clearPlayerMotionTimer();
                    this._playerAnimFallbackTimer = setTimeout(() => {
                        this.setPlayerMotion(motion === 'die' ? 'die' : 'idle');
                    }, motion === 'attack' ? 100 : 180);
                    return;
                }
            }
            applyFrame(frame);
        }, frameMs);
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
          if (nameEl) { nameEl.textContent = '🔍 敵の様子'; nameEl.classList.add('pb-enemy-look-icon'); }
        if (realNameEl) realNameEl.textContent = enemy.name || '-';
        if (lvEl) lvEl.textContent = `Lv.${Math.max(1, enemy.level || enemy.lv || 1)}`;
         if (spriteEl) {
            spriteEl.classList.remove('pb-enemy-defeated');
            spriteEl.style.visibility = '';
            spriteEl.style.opacity = '';
             this._renderEnemySprite(enemy, spriteEl);
        }
        const safeMax = Math.max(1, maxHp || enemy.hp || 1);
        const safeHp = Math.max(0, enemy.hp || 0);
      const enemyAtk = Math.max(0, Math.floor(enemy.atk || 0));
        if (hpText) hpText.textContent = `HP ${safeHp} / ${safeMax}`;
        if (atkEl) atkEl.textContent = `ATK ${enemyAtk}`;
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

     _clearEnemySpriteAnimation(spriteEl = null, resetStyles = true) {
        if (this._spriteAnimTimer) {
            clearInterval(this._spriteAnimTimer);
            this._spriteAnimTimer = null;
        }
        this._spriteAnimKey = '';
        const target = spriteEl || document.getElementById('pb-enemy-sprite');
        if (!target || !resetStyles) return;
        target.style.backgroundSize = 'contain';
        target.style.backgroundPosition = 'center';
    }

    _renderEnemySprite(enemy, spriteEl) {
        this._clearEnemySpriteAnimation(spriteEl);
        const sheet = enemy && enemy.spriteSheet;
        const hasSheet = !!(sheet && sheet.src && sheet.cols > 0 && sheet.rows > 0 && sheet.frames > 0);
        const hasImage = hasSheet || !!(enemy && enemy.imageUrl);
        spriteEl.classList.toggle('has-image', hasImage);
        spriteEl.classList.toggle('has-sheet', hasSheet);

        if (!hasImage) {
            spriteEl.style.backgroundImage = '';
            spriteEl.textContent = (enemy && enemy.emoji) || '👾';
            return;
        }

        spriteEl.textContent = '';
        spriteEl.style.backgroundImage = `url('${hasSheet ? sheet.src : enemy.imageUrl}')`;

        spriteEl.style.backgroundRepeat = 'no-repeat';
        if (!hasSheet) return;

        const key = `${sheet.src}|${sheet.cols}|${sheet.rows}|${sheet.frames}|${sheet.fps}|${sheet.loop !== false}`;
        this._spriteAnimKey = key;
        spriteEl.style.backgroundSize = `${sheet.cols * 100}% ${sheet.rows * 100}%`;

        let frame = 0;
        const frameMs = Math.max(40, Math.floor(1000 / Math.max(1, sheet.fps || 8)));
        const applyFrame = (idx) => {
            const safeIdx = Math.max(0, Math.min((sheet.frames || 1) - 1, idx));
            const col = safeIdx % sheet.cols;
            const row = Math.floor(safeIdx / sheet.cols);
            const xPct = sheet.cols <= 1 ? 0 : (col / (sheet.cols - 1)) * 100;
            const yPct = sheet.rows <= 1 ? 0 : (row / (sheet.rows - 1)) * 100;
            spriteEl.style.backgroundPosition = `${xPct}% ${yPct}%`;
        };

        applyFrame(frame);
        this._spriteAnimTimer = setInterval(() => {
            const current = document.getElementById('pb-enemy-sprite');
            if (!current || current !== spriteEl || this._spriteAnimKey !== key) {
                this._clearEnemySpriteAnimation(spriteEl);
                return;
            }
            frame += 1;
            if (frame >= sheet.frames) {
                if (sheet.loop === false) {
                    frame = sheet.frames - 1;
                    applyFrame(frame);
                      this._clearEnemySpriteAnimation(spriteEl, false);
                    return;
                }
                frame = 0;
            }
            applyFrame(frame);
        }, frameMs);
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
    // パネルの魔法変換演出 (😈 -> 💰) コイン版
    // ========================================
    animatePanelsTransform(changedCoords, finalGridData) {
        return new Promise((resolve) => {
            const gridEl = document.getElementById('pb-grid');
            if (!gridEl) {
                resolve();
                return;
            }

            const panelsToAnimate = [];
            changedCoords.forEach(coord => {
                const panelEl = gridEl.querySelector(`.pb-panel[data-row="${coord.r}"][data-col="${coord.c}"]`);
                if (panelEl) {
                    panelsToAnimate.push({ el: panelEl, coord: coord });
                }
            });

            if (panelsToAnimate.length === 0) {
                resolve();
                return;
            }

            const totalDuration = 1000;
            const staggerDelay = 50; 

            panelsToAnimate.forEach((item, index) => {
                const panelEl = item.el;
                const delay = index * staggerDelay;

                const glowEl = document.createElement('div');
                glowEl.className = 'pb-transform-glow';
                glowEl.style.position = 'absolute';
                glowEl.style.inset = '-5px'; 
                glowEl.style.borderRadius = 'inherit';
                glowEl.style.boxShadow = '0 0 10px 5px rgba(255, 100, 100, 0.5)'; 
                glowEl.style.zIndex = '1';
                panelEl.appendChild(glowEl);

                panelEl.animate([
                    { transform: 'rotateY(0deg) scale(1)', filter: 'brightness(1)' },
                    { transform: 'rotateY(90deg) scale(1.1)', filter: 'brightness(1.5)', offset: 0.5 }, 
                    { transform: 'rotateY(180deg) scale(1)', filter: 'brightness(1)', offset: 1.0 }
                ], {
                    duration: 600,
                    delay: delay,
                    easing: 'ease-in-out'
                });

                // ▼ 修正: コインに合わせて光の色を「金色（ゴールド）」に変更！
                glowEl.animate([
                    { boxShadow: '0 0 10px 5px rgba(255, 100, 100, 0.5)', opacity: 0.8 }, 
                    { boxShadow: '0 0 20px 10px #fff', opacity: 1, offset: 0.5 }, 
                    { boxShadow: '0 0 15px 8px rgba(255, 215, 0, 0.8)', opacity: 1, offset: 0.6 }, // 💰 (金色)
                    { boxShadow: '0 0 10px 5px rgba(255, 215, 0, 0.5)', opacity: 0, offset: 1.0 }  // 消える
                ], {
                    duration: totalDuration - staggerDelay,
                    delay: delay,
                    easing: 'ease-out'
                });

                setTimeout(() => {
                    // ▼ 修正: クラスを😈から💰(coin)へ変更
                    panelEl.classList.remove('pb-panel-lvup');
                    panelEl.classList.add('pb-panel-coin');
                    
                    // ▼ 修正: 取得するパネルデータを 'coin' に変更
                    panelEl.innerHTML = ''; 
                    const pType = typeof PANEL_TYPES !== 'undefined' ? PANEL_TYPES['coin'] : null;
                    if (pType) {
                        this._setPanelVisual(panelEl, pType);
                    }

                    glowEl.remove(); 

                    const rect = panelEl.getBoundingClientRect();
                    const centerX = rect.left + rect.width / 2;
                    const centerY = rect.top + rect.height / 2;
                    if (this._createTransformSparkle) {
                        this._createTransformSparkle(centerX, centerY);
                    } else if (this._createProgrammaticEffect) {
                        this._createProgrammaticEffect('success', centerY, centerX);
                    }

                }, delay + 300); 
            });

            const maxDelay = (panelsToAnimate.length - 1) * staggerDelay;
            const completeDelay = maxDelay + totalDuration + 200; 

            setTimeout(() => {
                this.renderGrid(finalGridData);
                resolve();
            }, completeDelay);
        });
    }

    // ========================================
    // 変換時のキラキラエフェクト（内部用）
    // ========================================
    _createTransformSparkle(x, y) {
        const effectLayer = document.getElementById('pb-effect-layer');
        if (!effectLayer) return;

        // キラキラ（星）の生成
        for (let i = 0; i < 4; i++) {
            const star = document.createElement('div');
            star.style.position = 'absolute';
            star.style.left = `${x}px`;
            star.style.top = `${y}px`;
            star.style.width = '3px';
            star.style.height = '3px';
            star.style.borderRadius = '50%';
            star.style.backgroundColor = '#fff';
            star.style.boxShadow = '0 0 10px #fff';
            star.style.zIndex = '101';
            star.style.pointerEvents = 'none';

            effectLayer.appendChild(star);

            const angle = Math.random() * Math.PI * 2;
            const dist = 30 + Math.random() * 20;
            const dx = Math.cos(angle) * dist;
            const dy = Math.sin(angle) * dist;

            star.animate([
                { transform: 'translate(0, 0) scale(1)', opacity: 1 },
                { transform: `translate(${dx}px, ${dy}px) scale(3)`, opacity: 0, offset: 0.7 },
                { transform: `translate(${dx * 1.2}px, ${dy * 1.2}px) scale(0)`, opacity: 0, offset: 1.0 }
            ], {
                duration: 500 + Math.random() * 200,
                easing: 'ease-out'
            });

            setTimeout(() => star.remove(), 700);
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

      animatePanelEnergyTransfer(panelList = []) {
        const layer = document.getElementById('pb-effect-layer');
        const gridEl = document.getElementById('pb-grid');
        if (!layer || !gridEl || !Array.isArray(panelList) || panelList.length === 0) return 0;

        const layerRect = layer.getBoundingClientRect();
        const charEl = document.getElementById('char-container') || document.getElementById('my-character');
        const enemyArea = document.getElementById('pb-enemy-area');
        const enemySprite = document.getElementById('pb-enemy-sprite');
        const enemyRect = (enemySprite || enemyArea) ? (enemySprite || enemyArea).getBoundingClientRect() : null;
        const playerRect = charEl ? charEl.getBoundingClientRect() : null;

        const playerTarget = playerRect
            ? {
                x: playerRect.left - layerRect.left + playerRect.width * 0.52,
                y: playerRect.top - layerRect.top + playerRect.height * 0.45
            }
            : { x: layerRect.width * 0.24, y: layerRect.height * 0.65 };
        const enemyTarget = enemyRect
            ? {
                x: enemyRect.left - layerRect.left + enemyRect.width * 0.5,
                y: enemyRect.top - layerRect.top + enemyRect.height * 0.6
            }
            : { x: layerRect.width * 0.75, y: layerRect.height * 0.45 };

        let maxMs = 0;
        panelList.forEach((pos, i) => {
            if (!pos || typeof pos.row !== 'number' || typeof pos.col !== 'number') return;
            const idx = pos.row * 6 + pos.col;
            const cell = gridEl.children[idx];
            if (!cell) return;

            const cellRect = cell.getBoundingClientRect();
            const sx = cellRect.left - layerRect.left + cellRect.width * 0.5;
            const sy = cellRect.top - layerRect.top + cellRect.height * 0.5;
            const toEnemy = pos.type === 'lvup';
            const target = toEnemy ? enemyTarget : playerTarget;
            const delay = i * 22;
            const duration = 240 + Math.min(140, i * 4);

            const orb = document.createElement('div');
            orb.className = `pb-energy-orb ${toEnemy ? 'pb-energy-orb-enemy' : 'pb-energy-orb-player'}`;
            orb.style.setProperty('--pb-energy-sx', `${sx}px`);
            orb.style.setProperty('--pb-energy-sy', `${sy}px`);
            orb.style.setProperty('--pb-energy-ex', `${target.x}px`);
            orb.style.setProperty('--pb-energy-ey', `${target.y}px`);
            orb.style.setProperty('--pb-energy-delay', `${delay}ms`);
            orb.style.setProperty('--pb-energy-duration', `${duration}ms`);
            orb.style.setProperty('--pb-energy-color', this._getEnergyColor(pos.type));
            layer.appendChild(orb);
            const ttl = delay + duration + 90;
            maxMs = Math.max(maxMs, ttl);
            setTimeout(() => orb.remove(), ttl);
        });

        return maxMs;
    }

     animateDrop(grid = null) {
        const maxDropSteps = Array.isArray(grid)
            ? grid.flat().reduce((m, p) => Math.max(m, (p && p.dropSteps) ? p.dropSteps : 0), 0)
            : 0;
        const duration = 220 + Math.min(260, maxDropSteps * 45);
        return new Promise(resolve => setTimeout(resolve, duration));
    }
// ▼ 修正: 引数の最後に `isCritical = false` を追加
    showDamageToEnemy(dmg, type, chainCount, hitIndex = 0, isCritical = false) {
          const layer = document.getElementById('pb-effect-layer');
          
            if (!layer) return 0;
             const showImpact = () => {
                const spriteEl = document.getElementById('pb-enemy-sprite');
                if (spriteEl) { spriteEl.classList.add('pb-enemy-hit'); setTimeout(() => spriteEl.classList.remove('pb-enemy-hit'), 220); }
                this._spawnHitEffect(type, hitIndex);

                const el = createEnemyAnchorTextElement(`${dmg}`, 'pb-dmg-text', null, hitIndex);
                if (!el) return;

                // =========================================
                // ▼ 追加: クリティカルの時は数字をド派手に強調する！
                // =========================================
                if (isCritical) {
                    el.style.setProperty('color', '#ffff00', 'important'); // 真っ黄色に！
                    el.style.setProperty('font-size', '26px', 'important'); // 文字をデカく！(通常より目立たせる)
                    el.style.setProperty('font-weight', '900', 'important'); // さらに太字に！
                    el.style.setProperty('text-shadow', '0px 0px 4px #ff0000, 0px 0px 8px #000000', 'important'); // 赤と黒のフチ取りで会心っぽく！
                    el.style.setProperty('z-index', '3000', 'important'); // 他の通常ダメージの数字より手前に表示させる
                }

                layer.appendChild(el);
                setTimeout(() => el.remove(), 2000);
            };

            if (type === 'magic') {
                this._spawnMagicBullet(hitIndex, showImpact);
             return 420;
            }
            
       showImpact();
            return 180;
    }

   // =========================================
    // ▼ バトル勝利時（敵撃破）のド派手な演出
    // =========================================
    animateEnemyDefeat() {
        return new Promise(async resolve => {
            const enemySpriteEl = document.getElementById('pb-enemy-sprite');
            if (!enemySpriteEl) return resolve();

            // 1. 既存のフワフワアニメーションを強制停止
            enemySpriteEl.style.animation = 'none';
            enemySpriteEl.style.transition = 'none';

            // 2. 致死ダメージの硬直（赤く激しく光ってビクッとする）
            if (app && app.sound) app.sound.play('se_damage');
            enemySpriteEl.style.filter = 'brightness(2) sepia(1) hue-rotate(-50deg) saturate(5)';
            enemySpriteEl.style.transform = 'scale(1.15) rotate(8deg)'; // 少し傾ける

            // 画面を激しく揺らす（2回連続でドメスティックに）
            const screen = document.getElementById('screen-sugoroku') || document.body;
            if (screen) {
                screen.classList.add('pb-screen-shake');
                setTimeout(() => screen.classList.remove('pb-screen-shake'), 200);
                setTimeout(() => screen.classList.add('pb-screen-shake'), 250);
                setTimeout(() => screen.classList.remove('pb-screen-shake'), 500);
            }

            // 硬直時間（トドメを刺した手応えを味わう）
            await new Promise(r => setTimeout(r, 500));

            // 3. 爆発エフェクトと崩壊
            if (app && app.sound) {
                app.sound.play('se_damage');
                setTimeout(() => app.sound.play('se_attack'), 150); // 崩れる音の代用
            }

            // ▼ JSのみで完結する爆発の火花（パーティクル）を15個飛ばす
            const rect = enemySpriteEl.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;

            for (let i = 0; i < 15; i++) {
                const p = document.createElement('div');
                p.style.position = 'fixed';
                p.style.left = `${cx}px`;
                p.style.top = `${cy}px`;
                p.style.width = `${10 + Math.random() * 15}px`; // 大小バラバラの破片
                p.style.height = p.style.width;
                // 赤・オレンジ・黄色の火花カラー
                p.style.backgroundColor = Math.random() > 0.6 ? '#ff3300' : (Math.random() > 0.5 ? '#ffaa00' : '#ffffff');
                p.style.borderRadius = '50%';
                p.style.boxShadow = '0 0 10px gold';
                p.style.zIndex = '3000';
                p.style.pointerEvents = 'none';
                
                // 飛んでいく方向と距離（全方位にランダム）
                const angle = Math.random() * Math.PI * 2;
                const distance = 80 + Math.random() * 100;
                const tx = Math.cos(angle) * distance;
                const ty = Math.sin(angle) * distance;
                
                p.style.transition = `transform ${0.4 + Math.random() * 0.4}s ease-out, opacity 0.6s ease-out`;
                p.style.transform = 'translate(-50%, -50%) scale(1)';
                
                document.body.appendChild(p);
                
                // 次のフレームで一斉に弾け飛ぶ
                requestAnimationFrame(() => {
                    p.style.transform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(0)`;
                    p.style.opacity = '0';
                });
                
                // ゴミ掃除
                setTimeout(() => p.remove(), 800);
            }

            // 4. 本体が黒焦げになりながら下へ落ちて消える
            // cubic-bezier(0.55, 0.085, 0.68, 0.53) = 重力で加速しながら落ちる動き
            enemySpriteEl.style.transition = 'transform 0.6s cubic-bezier(0.55, 0.085, 0.68, 0.53), filter 0.6s, opacity 0.6s';
            enemySpriteEl.style.transform = 'translateY(150px) scale(0.3) rotate(-30deg)';
            enemySpriteEl.style.filter = 'brightness(0) grayscale(1) blur(4px)'; // 黒焦げ＆ボヤける
            enemySpriteEl.style.opacity = '0';

            // 完全に消えるまで待つ（余韻）
            await new Promise(r => setTimeout(r, 1000));
            resolve();
        });
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

  // ▼ 修正: CSSのアニメーション干渉を防ぎ、強制的に動かすように変更
    animateEnemySkill(label, dmg = 0, type = 'attack') {
        return new Promise(resolve => {
            this._showFloatingText(`${label}!`, 'pb-enemy-atk-label', '#ff4444');
            
            const spriteEl = document.getElementById('pb-enemy-sprite');
            let originalAnimation = '';
            let originalFilter = '';
            
            if (spriteEl) {
                // ▼ 修正: チャージ中（ブルブル）のクラスを一旦解除して干渉を防ぐ
                spriteEl.classList.remove('pb-enemy-charging');

                originalAnimation = spriteEl.style.animation;
                originalFilter = spriteEl.style.filter;
                
                // ▼ 修正: JS側からも「important」を指定して、どんなCSSにも負けずに強制的に動かす！
                spriteEl.style.setProperty('animation', 'none', 'important');
                spriteEl.style.setProperty('transition', 'transform 0.15s ease-in, filter 0.1s', 'important');

                if (type === 'attack') {
                    spriteEl.style.setProperty('transform', 'translate(-60px, 30px) scale(1.35)', 'important');
                    spriteEl.style.setProperty('filter', 'brightness(1.5) drop-shadow(0 0 15px red)', 'important');
                } else if (type === 'buff') {
                    spriteEl.style.setProperty('transform', 'scale(1.4)', 'important');
                    spriteEl.style.setProperty('filter', 'brightness(1.3) drop-shadow(0 0 20px blue)', 'important');
                }
                
                setTimeout(() => {
                    spriteEl.style.setProperty('transition', 'transform 0.4s ease-out, filter 0.4s', 'important');
                    spriteEl.style.transform = ''; 
                    spriteEl.style.filter = originalFilter;
                    
                    setTimeout(() => {
                        spriteEl.style.animation = originalAnimation;
                    }, 400);
                }, 150);
            }

            const screen = document.getElementById('screen-sugoroku');
            if (screen) { screen.classList.add('pb-screen-shake'); setTimeout(() => screen.classList.remove('pb-screen-shake'), 400); }
            
            if (dmg > 0) {
                setTimeout(() => {
                    this._showPlayerPopupText(`-${dmg}`, 'pb-player-dmg-text', '#ff4444');
                    if (app && app.sound) app.sound.play('se_damage');
                }, 300);
            }
            
            setTimeout(resolve, 800);
        });
    }

    // =========================================
    // ▼ スカウト演出用メソッド（絶対エラーにならない完全防御版）
    // =========================================

 // 1. プレイヤーの頭上に吹き出しを表示（座標計算・完全版）
    showPlayerSpeechBubble(text) {
        try {
            const oldBubble = document.getElementById('pb-speech-bubble');
            if (oldBubble) oldBubble.remove();

            const bubbleEl = document.createElement('div');
            bubbleEl.id = 'pb-speech-bubble';
            bubbleEl.className = 'pb-speech-bubble';
            bubbleEl.innerText = text;

            // ▼ 修正: 確実な配置のため、画面の一番外側(body)に直接追加する
            document.body.appendChild(bubbleEl);
            
            // ▼ 修正: プレイヤーの画像（またはエリア）を全力で探しに行く
            const playerImg = document.getElementById('pb-player-sprite') || 
                              document.querySelector('.sg-char-container') || 
                              document.getElementById('pb-player-area');
            
            if (playerImg) {
                // 画像の現在の画面上の絶対座標(XY)を取得
                const rect = playerImg.getBoundingClientRect();
                
                // 画像の【上端】から少し上(10px)に、下から押し上げるように配置
                bubbleEl.style.bottom = `${window.innerHeight - rect.top + 10}px`; 
                // 画像の左端に合わせて配置
                bubbleEl.style.left = `${rect.left}px`;
            } else {
                // 万が一キャラ画像が見つからなかった場合の安全な位置
                bubbleEl.style.bottom = '50%';
                bubbleEl.style.left = '20px';
            }

            requestAnimationFrame(() => bubbleEl.classList.add('pb-bubble-show'));

            setTimeout(() => {
                bubbleEl.classList.remove('pb-bubble-show');
                setTimeout(() => bubbleEl.remove(), 300);
            }, 1800);
        } catch (e) { console.error("吹き出しエラー回避:", e); }
    }

   // 2. ▼新演出：エネミー画像を変形させてスカウト中を演出する
    animateScoutRolling(panelEl, isSuccess) {
        return new Promise(async resolve => {
            try {
                // エネミー画像を探す
                const enemySpriteEl = document.getElementById('pb-enemy-sprite');
                if (!enemySpriteEl) return resolve(false); // 敵がいなければ終了

                // --- A. 交渉(チケット)が飛んでくるフリ (音だけ) ---
                if (app && app.sound) app.sound.play('se_attack'); 

                // --- B. 敵が躊躇する（迷っている）演出 ---
                let originalAnimation = enemySpriteEl.style.animation;
                enemySpriteEl.style.animation = 'none'; // 通常の待機フワフワを止める

                // 「迷っている」アニメーションを適用
                enemySpriteEl.classList.add('pb-enemy-confused');
                if (app && app.sound) app.sound.play('se_check_slow'); 

                // ワクワクする待機音
                if (app && app.sound) {
                    app.sound.play('se_check'); 
                    setTimeout(() => app.sound.play('se_check'), 600); 
                    setTimeout(() => app.sound.play('se_check'), 1200); 
                }

                // 躊躇演出の完了を待つ (1.8秒)
                await new Promise(r => setTimeout(r, 1800));

                enemySpriteEl.classList.remove('pb-enemy-confused');

                // --- C. 結果の実行 ---
                // ▼ ここで確実に敵の現在座標を取得する！
                const rect = enemySpriteEl.getBoundingClientRect();
                const effectTop = rect.top + rect.height / 2;
                const effectLeft = rect.left + rect.width / 2;

                if (isSuccess) {
                    // 【成功時は光に包まれる】
                    if (app && app.sound) app.sound.play('se_chest_open'); 
                    
                    // プログラムエフェクト（成功）を呼び出す
                    if (typeof this._createProgrammaticEffect === 'function') {
                        this._createProgrammaticEffect('success', effectTop, effectLeft);
                    }
                    
                    enemySpriteEl.style.setProperty('transition', 'transform 0.8s ease-out, filter 0.8s, opacity 0.8s', 'important');
                    enemySpriteEl.style.setProperty('transform', 'translateY(-40px) scale(1.05)', 'important'); 
                    enemySpriteEl.style.setProperty('filter', 'brightness(2) drop-shadow(0 0 20px #ffffff)', 'important'); 
                    enemySpriteEl.style.setProperty('opacity', '0', 'important');

                    await new Promise(r => setTimeout(r, 800)); // 余韻
                    resolve(true);
                } else {
                    // 【失敗時は飛び出して威嚇】
                    if (app && app.sound) app.sound.play('se_damage'); 

                    // プログラムエフェクト（失敗）を呼び出す
                    if (typeof this._createProgrammaticEffect === 'function') {
                        this._createProgrammaticEffect('fail', effectTop, effectLeft);
                    }

                    enemySpriteEl.style.setProperty('transition', 'transform 0.2s ease-out, opacity 0.2s', 'important');
                    enemySpriteEl.style.setProperty('transform', 'scale(1.2) rotate(-5deg)', 'important');
                    enemySpriteEl.style.opacity = '1';
                    
                    setTimeout(() => {
                        enemySpriteEl.style.setProperty('transition', 'transform 0.3s ease-out, filter 0.3s', 'important');
                        enemySpriteEl.style.transform = ''; 
                        enemySpriteEl.style.filter = '';
                        setTimeout(() => enemySpriteEl.style.animation = originalAnimation, 300);
                    }, 200);

                    await new Promise(r => setTimeout(r, 500)); 
                    resolve(false);
                }
            } catch (err) {
                console.error("演出エラー回避:", err);
                resolve(true); 
            }
        });
    }

  // ========================================
    // エネミーの登場演出（ハイクオリティ版）
    // ========================================
    animateEnemyAppear() {
        const enemySpriteEl = document.getElementById('pb-enemy-sprite');
        if (!enemySpriteEl) return;

        // 登場の予兆音
        if (app && app.sound) app.sound.play('se_enemy_appear');

        // 1. よりダイナミックなキーフレーム（極小で高速接近 → 激突で潰れる → 反動で伸びる → 着地）
        enemySpriteEl.animate([
            { transform: 'translate(200px, -150px) scale(0.1) rotate(45deg)', opacity: 0, filter: 'brightness(3) blur(4px)' },
            { transform: 'translate(0, 0) scale(1.3, 0.7) rotate(0deg)', opacity: 1, filter: 'brightness(1.5) blur(0px)', offset: 0.5 }, // 激突＆潰れ (50%のタイミング)
            { transform: 'translate(0, -30px) scale(0.9, 1.1)', filter: 'brightness(1)', offset: 0.75 }, // 反動で少し浮く＆縦伸び
            { transform: 'translate(0, 0) scale(1, 1)', filter: 'brightness(1)', offset: 1.0 } // 最終着地
        ], {
            duration: 600,
            easing: 'ease-out'
        });

        // 2. 激突の瞬間（duration 600ms の 50% = 300ms後）に合わせて画面効果を発動
        setTimeout(() => {
            // ドスッという重い衝撃音（あれば。なければ通常の攻撃音でもOK）
            if (app && app.sound) app.sound.play('se_damage'); 

            // 画面をガツンと揺らす
            const screen = document.getElementById('screen-sugoroku') || document.body;
            if (screen) {
                screen.classList.add('pb-screen-shake');
                setTimeout(() => screen.classList.remove('pb-screen-shake'), 300);
            }

            // 3. 足元に広がる衝撃波（リング）エフェクトを動的に生成
            const effectLayer = document.getElementById('pb-effect-layer');
            if (effectLayer) {
                const ring = document.createElement('div');
                const rect = enemySpriteEl.getBoundingClientRect();
                const layerRect = effectLayer.getBoundingClientRect();
                
                // 敵の足元の座標を計算
                const cx = rect.left - layerRect.left + rect.width / 2;
                const cy = rect.top - layerRect.top + rect.height - 10; 

                // リングのスタイル設定
                ring.style.position = 'absolute';
                ring.style.left = `${cx}px`;
                ring.style.top = `${cy}px`;
                ring.style.width = '0px';
                ring.style.height = '0px';
                ring.style.border = '4px solid rgba(255, 255, 255, 0.8)';
                ring.style.borderRadius = '50%';
                ring.style.transform = 'translate(-50%, -50%) rotateX(60deg)'; // 奥行きを出して地面の波紋っぽく
                ring.style.boxShadow = '0 0 15px #fff, inset 0 0 10px #fff';
                ring.style.zIndex = '100';
                ring.style.pointerEvents = 'none';

                effectLayer.appendChild(ring);

                // 波紋が広がって消えるアニメーション
                ring.animate([
                    { width: '0px', height: '0px', opacity: 1, borderWidth: '8px' },
                    { width: '180px', height: '180px', opacity: 0, borderWidth: '1px' }
                ], {
                    duration: 400,
                    easing: 'ease-out'
                });

                // 終わったらゴミ掃除
                setTimeout(() => ring.remove(), 400);
            }
        }, 300); // アニメーションの offset: 0.5 と同期
    }
    // =========================================
    // ▼ プログラム生成エフェクト（キラキラ・バツ）
    // =========================================
    
    // エフェクトを生成して表示し、自動的に削除する
    _createProgrammaticEffect(type, x, y) {
        // コンテナを作成
        const container = document.createElement('div');
        container.className = 'pb-effect-container';
        container.style.top = `${x}px`; // 引数がx,yだが、CSS的にtop,leftに
        container.style.left = `${y}px`;
        document.body.appendChild(container);
        
        // --- 成功エフェクト(光のパルス ＋ キラキラ粒子) ---
        if (type === 'success') {
            // 中心パルス
            const pulse = document.createElement('div');
            pulse.className = 'pb-effect-success-pulse';
            container.appendChild(pulse);
            
            // キラキラ粒子を15個生成
            for (let i = 0; i < 15; i++) {
                const sparkle = document.createElement('div');
                sparkle.className = 'pb-effect-success-sparkle';
                sparkle.style.top = '50%'; sparkle.style.left = '50%';
                
                // 飛び散る方向と距離をランダムにCSS変数として渡す
                // 角度をランダムにして、そこからXY座標を計算
                const angle = Math.random() * Math.PI * 2;
                const distance = 50 + Math.random() * 80; // 50〜130px
                sparkle.style.setProperty('--tx', `${Math.cos(angle) * distance - 3}px`); // 中心補正(-3px)
                sparkle.style.setProperty('--ty', `${Math.sin(angle) * distance - 3}px`);
                
                // 再生時間を少しランダムに
                sparkle.style.animationDuration = `${0.8 + Math.random() * 0.4}s`;
                
                container.appendChild(sparkle);
            }
        
        // --- 失敗エフェクト(赤いバツ印 ＋ 黒い煙粒子) ---
        } else if (type === 'fail') {
            // 赤いバツ
            const xCross = document.createElement('div');
            xCross.className = 'pb-effect-fail-x';
            
            const line1 = document.createElement('div'); line1.className = 'pb-fail-line pb-fail-line-1'; xCross.appendChild(line1);
            const line2 = document.createElement('div'); line2.className = 'pb-fail-line pb-fail-line-2'; xCross.appendChild(line2);
            container.appendChild(xCross);
            
            // 煙粒子を8個生成
            for (let i = 0; i < 8; i++) {
                const smoke = document.createElement('div');
                smoke.className = 'pb-effect-fail-smoke';
                smoke.style.top = '50%'; smoke.style.left = '50%';
                
                // 飛び散る方向（上寄り）と距離をランダムに
                const angle = Math.PI + (Math.random() - 0.5) * Math.PI; // 真上中心の半円
                const distance = 40 + Math.random() * 60; // 40〜100px
                smoke.style.setProperty('--tx', `${Math.cos(angle) * distance - 15}px`); // 中心補正(-15px)
                smoke.style.setProperty('--ty', `${Math.sin(angle) * distance - 15}px`);
                
                // 再生時間・遅延をランダムに
                smoke.style.animationDuration = `${1.0 + Math.random() * 0.5}s`;
                smoke.style.animationDelay = `${Math.random() * 0.3}s`;
                
                container.appendChild(smoke);
            }
        }
        
        // エフェクト終了後にDOMから削除（最長の失敗煙に合わせて1.5秒後）
        setTimeout(() => container.remove(), 1500);
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
        const delay = 150;
        const finalWait = 400;
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
         this._clearEnemySpriteAnimation();
        this._clearPlayerMotionTimer();
        this._restorePlayerVisualSnapshot();

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

    // =========================================
    // ▼ フワッと浮かぶテキストを表示する機能（色変更対応版）
    // =========================================
    _showFloatingText(text, targetId, color = '#ffffff', offsetY = 0) {
        let targetEl = document.getElementById(targetId);
        
        // =========================================
        // ▼ 修正: IDの名前に 'player' が入っていたら、プレイヤー側を予備にする！
        // =========================================
        if (!targetEl) {
            if (targetId.includes('player')) {
                // プレイヤー用の予備（プレイヤー画像 or 全体のHUD）
                targetEl = document.getElementById('pb-player-sprite') || document.getElementById('pb-battle-hud');
            } else {
                // 敵用の予備
                targetEl = document.getElementById('pb-enemy-sprite'); 
            }
        }
        if (!targetEl) targetEl = document.body; // 最後の予備

        const rect = targetEl.getBoundingClientRect();
        const textEl = document.createElement('div');
        
        // （これ以降はそのままです！）
        
        textEl.innerText = text;
        
        textEl.style.setProperty('color', color, 'important');
        textEl.style.textShadow = '0px 0px 4px #000, 0px 0px 4px #000, 0px 0px 6px #000';
        textEl.style.fontWeight = 'bold';
        
        // =========================================
        // ▼ 修正1: 文字サイズを小さめにし、折り返しを禁止する
        // =========================================
        textEl.style.fontSize = '15px'; // 18pxから少し小さく
        textEl.style.whiteSpace = 'nowrap'; // 狭い画面でも文字が縦に潰れないようにする
        textEl.style.pointerEvents = 'none';
        textEl.style.zIndex = '4000';
        textEl.style.position = 'fixed';
        
        // =========================================
        // ▼ 修正2: 文字が重ならないように、出現位置をランダムに散らす！
        // =========================================
        const randomX = (Math.random() - 0.5) * 80; // 左右に最大40pxズラす
        const randomY = (Math.random() - 0.5) * 40; // 上下に最大20pxズラす

        const startX = rect.left + rect.width / 2 + randomX;
        const startY = rect.top + rect.height / 2 + offsetY + randomY;
        
        textEl.style.left = `${startX}px`;
        textEl.style.top = `${startY}px`;
        textEl.style.transform = 'translate(-50%, -50%)';
        
        // アニメーション時間の設定（1秒かけてフワッと消える）
        textEl.style.transition = 'transform 1.0s ease-out, opacity 1.0s ease-in';
        
        document.body.appendChild(textEl);
        
        // ほんの少し待ってから移動とフェードアウトを開始
        setTimeout(() => {
            // ▼ 修正3: scale(1.2)を消して巨大化を防ぎ、上に逃がす距離を少し伸ばす
            textEl.style.transform = 'translate(-50%, calc(-50% - 50px)) scale(1.0)';
            textEl.style.opacity = '0';
        }, 50);
        
        // アニメーションが終わったらゴミ掃除
        setTimeout(() => textEl.remove(), 1100);
    }


     _getEnergyColor(type) {
        const fallback = '#ffffff';
        if (typeof PANEL_TYPES !== 'undefined' && PANEL_TYPES[type] && PANEL_TYPES[type].color) {
            return PANEL_TYPES[type].color;
        }
        const map = {
            sword: '#4488ff',
            magic: '#ff6622',
            coin: '#ddaa00',
            heal: '#44cc44',
            lvup: '#8844aa',
            chick: '#ffdd44',
            diamond: '#66e0ff'
        };
        return map[type] || fallback;
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
        setTimeout(() => el.remove(), 2000);
    }

    _showPlayerPopupText(text, className, color, order = 0) {
        const layer = document.getElementById('pb-effect-layer');
        const el = createPlayerAnchorTextElement(text, className, color, order);
        if (!layer || !el) {
            this._showFloatingText(text, className, color);
            return;
        }
        layer.appendChild(el);
        setTimeout(() => el.remove(), 2000);
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
         const charEl = document.getElementById('char-container') || document.getElementById('my-character');
        const charRect = charEl ? charEl.getBoundingClientRect() : null;
        const launch = charRect
            ? {
                x: charRect.left - layerRect.left + charRect.width * 0.72,
                y: charRect.top - layerRect.top + charRect.height * 0.42 - Math.min(10, hitIndex * 2)
            }
            : {
                x: Math.max(18, layerRect.width * 0.26),
                y: Math.max(24, layerRect.height * 0.62 - Math.min(16, hitIndex * 3))
            };
        const startX = launch.x - half;
        const startY = launch.y - half;
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

  // ========================================
    // 背景の演出を開始する機能
    // ========================================
 startGridEffect(type) {
        // IDではなく「クラス名」で確実に要素を捕まえる！
        const gridWrapper = document.querySelector('.pb-grid-wrapper'); // パネルのすぐ裏
        const gridArea = document.querySelector('.pb-container');       // 下半分全体
        const battleScreen = document.getElementById('screen-panel-battle') || document.getElementById('game-area');

        if (type === 'strong_enemy') {
            if (gridWrapper) {
                // パネルの真裏を赤黒く発光させる
                gridWrapper.style.setProperty('background', 'radial-gradient(circle, rgba(150,0,0,0.8) 0%, rgba(20,0,0,0.8) 100%)', 'important');
                gridWrapper.style.setProperty('box-shadow', '0 0 40px #ff0000 inset', 'important');
            }
            if (gridArea) {
                gridArea.style.setProperty('background', 'rgba(50, 0, 0, 0.8)', 'important');
            }
            if (battleScreen) {
                battleScreen.style.setProperty('background', 'rgba(50, 0, 0, 0.6)', 'important');
            }
        }
    }

  // ========================================
    // 背景の演出を停止して、通常モードを明るくする機能
    // ========================================
    stopGridEffect() {
        const gridWrapper = document.querySelector('.pb-grid-wrapper');
        const gridArea = document.querySelector('.pb-container');
        const battleScreen = document.getElementById('screen-panel-battle') || document.getElementById('game-area');

        if (gridWrapper) {
            gridWrapper.style.removeProperty('background');
            gridWrapper.style.removeProperty('box-shadow');
        }
        
        if (gridArea) {
            // ▼ 修正: 透明だと「黒い下地」が見える罠があるため、
            // RPGらしい「透明感のあるクリスタルブルー（すりガラス風）」の背景を敷いて明るくする！
            gridArea.style.setProperty('background', 'linear-gradient(to bottom, rgba(70, 130, 200, 0.5), rgba(30, 70, 130, 0.8))', 'important');
            gridArea.style.setProperty('backdrop-filter', 'blur(4px)', 'important');
            gridArea.style.setProperty('-webkit-backdrop-filter', 'blur(4px)', 'important'); // iOS対応
            gridArea.style.setProperty('box-shadow', 'inset 0 2px 10px rgba(255, 255, 255, 0.2)', 'important'); // 上部にうっすら光るフチ
        }
        
        if (battleScreen) {
            // 上部の青空背景は、JSの上書きを解除して確実に元のCSSを活かす
            battleScreen.style.removeProperty('background');
            battleScreen.style.background = '';
        }
    }

// ========================================
    // プレイヤーのシールド（残像）表示切り替え
    // ========================================
    setPlayerShield(isActive) {
        const charContainer = document.getElementById('char-container');
        if (!charContainer) return;

        // もし古い「🛡️」アイコンが画面に残っていたら消しておく
        const oldIcon = document.getElementById('pb-player-shield-icon');
        if (oldIcon) oldIcon.remove();

        if (isActive) {
            // すでに残像が出ている状態なら何もしない
            if (charContainer.dataset.hasShield === 'true') return;
            charContainer.dataset.hasShield = 'true';

            // drop-shadowを使って、キャラの左右に水色の「分身（残像）」をフワフワさせる
            charContainer._shieldAnim = charContainer.animate([
                { filter: 'drop-shadow(0px 0px 0px rgba(100, 200, 255, 0)) drop-shadow(0px 0px 0px rgba(100, 255, 200, 0))' },
                // 左右に15pxズレた半透明の分身を出現させる
                { filter: 'drop-shadow(-15px 0px 2px rgba(100, 200, 255, 0.7)) drop-shadow(15px 0px 2px rgba(100, 200, 255, 0.7))', offset: 0.5 },
                { filter: 'drop-shadow(0px 0px 0px rgba(100, 200, 255, 0)) drop-shadow(0px 0px 0px rgba(100, 255, 200, 0))' }
            ], {
                duration: 1200, // 1.2秒周期でフワフワ
                iterations: Infinity, // 解除されるまで無限ループ
                easing: 'ease-in-out'
            });

        } else {
            // シールドを消費（またはリセット）した時
            if (charContainer.dataset.hasShield === 'true') {
                charContainer.dataset.hasShield = 'false';
                // 残像アニメーションを停止して元の状態に戻す
                if (charContainer._shieldAnim) {
                    charContainer._shieldAnim.cancel();
                    charContainer._shieldAnim = null;
                }
            }
        }
    }

    animatePlayerDodge() {
        const charContainer = document.getElementById('char-container');
        if (!charContainer) return;

        if (app && app.sound) app.sound.play('se_check_slow'); // 回避音

        // 現在のレイアウト設定を崩さないための安全策
        const baseTransform = getComputedStyle(charContainer).transform;
        const transformStr = baseTransform === 'none' ? '' : baseTransform;

        charContainer.animate([
            { transform: `${transformStr} translateX(0px)` },
            // サッと素早く後ろに下がる
            { transform: `${transformStr} translateX(-40px)`, offset: 0.2 },
            // その位置で少し待機して攻撃をかわす
            { transform: `${transformStr} translateX(-40px)`, offset: 0.7 },
            // スッと元の位置に戻る
            { transform: `${transformStr} translateX(0px)` }
        ], {
            duration: 400, // 0.4秒のキレのある動き
            easing: 'ease-in-out'
        });
    }
}



// =========================================
// ▼ 追記: キャラクター画像の強制プリロード（チラつき防止）
// =========================================
(function forcePreloadPlayerSprites() {
    const preloadContainer = document.createElement('div');
    // ブラウザに「画面内に表示されている」と誤認させて確実にデコードさせるためのCSS
    preloadContainer.style.cssText = 'position:absolute; top:-9999px; left:-9999px; width:1px; height:1px; opacity:0.01; pointer-events:none; z-index:-1;';
    
    // スプライトシート全種を強制的にDOMに追加
    Object.values(PANEL_PLAYER_SPRITE_SHEETS).forEach(sheet => {
        if (!sheet.src) return;
        const img = new Image();
        img.src = sheet.src;
        preloadContainer.appendChild(img);
    });

    // DOMの準備ができたらbodyに追加
    const appendToBody = () => {
        if (document.body) document.body.appendChild(preloadContainer);
        else setTimeout(appendToBody, 100);
    };
    appendToBody();

    

    
})();




