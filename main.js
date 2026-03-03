/**
 * main.js - アプリケーションエントリーポイント
 * 
 * v3 リファクタリング:
 *  - シーンレジストリパターン（if-else地獄の解消）
 *  - ViewportManager分離 (viewport_manager.js)
 *  - CSS-in-JS除去 (style-theme.css)
 *  - グローバル関数のファサード化
 */

// ============================================================
// 1. 安全ガード（読み込み順序に依存しないための定義）
//    正式定義: scene_formation_redesign.js, scene_enhance.js,
//    scene_gacha.js, scene_zukan.js, scene_card_equip.js
// ============================================================
if (typeof FormationScreenRedesign === 'undefined') window.FormationScreenRedesign = class { onEnter(){} clear(){} refresh(){} };
if (typeof EnhanceScreen === 'undefined') window.EnhanceScreen = class { onEnter(){} levelUp(){} skillUp(){} limitBreak(){} };
if (typeof GachaScreen === 'undefined') window.GachaScreen = class { onEnter(){} };
if (typeof ZukanScreen === 'undefined') window.ZukanScreen = class { onEnter(){} };
if (typeof CardEquipScreen === 'undefined') window.CardEquipScreen = class { onEnter(){} render(){} };

// ============================================================
// 2. マップ選択画面
// ============================================================
class MapSelectScreen {
   onEnter() {
        const list = document.getElementById('stage-list');
        if (!list) return;
        list.innerHTML = '';

        if (typeof SUGOROKU_STAGES === 'undefined') {
            list.innerHTML = '<div style="color:#fff;padding:20px;">ステージデータが見つかりません</div>';
            return;
        }

        Object.keys(SUGOROKU_STAGES).forEach(key => {
            const id = parseInt(key);
            const stage = SUGOROKU_STAGES[id];
            
            // ▼ 修正: maxClearedStage がない場合は stageClearCounts から算出する
            let maxCleared = (app.data && app.data.maxClearedStage) ? app.data.maxClearedStage : 0;
            if (maxCleared === 0 && app.data && app.data.stageClearCounts) {
                const clearedIds = Object.keys(app.data.stageClearCounts).map(Number);
                if (clearedIds.length > 0) maxCleared = Math.max(...clearedIds);
            }
            
            const currentSlots = (app.data && app.data.maxSlots) ? app.data.maxSlots : 4;
            const isLocked = id > maxCleared + 1;
            const isCleared = id <= maxCleared;

            const div = document.createElement('div');
            div.className = `stage-card ${isLocked ? 'locked' : ''}`;
            if (stage.bg) div.style.backgroundImage = `url('${stage.bg}')`;

            const cc = (app.data && app.data.stageClearCounts) ? (app.data.stageClearCounts[id] || 0) : 0;
            const badgeHtml = cc > 0
                ? `<div style="position:absolute;top:6px;right:6px;background:linear-gradient(135deg,#4caf50,#2e7d32);color:#fff;font-size:10px;font-weight:900;padding:2px 8px;border-radius:10px;box-shadow:0 2px 6px rgba(76,175,80,0.4);z-index:5;">✅ ${cc}回クリア</div>`
                : '';

            let rewardHtml = '';
            if (!isCleared && currentSlots < 8) {
                rewardHtml = `
                    <div style="color:#00ffaa; font-size:11px; font-weight:bold; margin-top:2px; text-shadow:0 1px 2px #000; background:rgba(0,0,0,0.5); padding:2px 6px; border-radius:4px; width:fit-content; display:flex; align-items:center; gap:4px;">
                        <span>🎁</span> 初回報酬：<span style="color:#ffff00;">編成枠解放 (+1)</span>
                    </div>`;
            }

            // ▼ 追加: 1回でもクリアしていれば、エンドレスモードの説明を表示する
            let descText = stage.desc || '';
            if (cc > 0) {
                descText = `<span style="color:#ffd700; font-weight:bold; line-height:1.4;">【ENDLESS MODE 開放】</span><br><span style="font-size:11px;">100階層への挑戦が可能になりました。<br>深層には他エリアの敵も出現します。</span>`;
            }

            if (isLocked) {
                div.style.filter = 'grayscale(100%) brightness(0.6)';
                div.style.opacity = '0.8';
                div.innerHTML = `
                    <div class="lock-cover" style="position:absolute; top:5px; left:5px; background:rgba(0,0,0,0.7); color:#ff6666; padding:2px 8px; border-radius:4px; font-size:12px; font-weight:bold; z-index:5;">🔒 LOCKED</div>
                    <div class="stage-card-overlay" style="opacity:0.8; justify-content:center;">
                        <div class="stage-level">推奨Lv: ${stage.level || 1}</div>
                        <div class="stage-title" style="color:#ccc;">Stage ${id}: ???</div>
                        <div class="stage-desc" style="color:#aaa;">前のステージをクリアすると<br>解放されます</div>
                    </div>
                `;
                div.onclick = () => { 
                    if (app.sound) app.sound.play('sys_danger'); 
                    alert("このステージはまだ解放されていません！\n前のステージをクリアしてください。");
                };
            } else {
                div.innerHTML = `
                    ${badgeHtml}
                    <div class="stage-card-overlay">
                        <div class="stage-level">推奨Lv: ${stage.level || 1}</div>
                        ${rewardHtml}
                        <div class="stage-title">Stage ${id}: ${stage.name}</div>
                        <div class="stage-desc">${descText}</div>
                    </div>
                `;
                div.onclick = () => {
                    if (app.sound) app.sound.tap();
                    // ▼ 修正: デッキが空かどうかのチェックをここに追加
                    if (!app.data.deck || app.data.deck.length === 0) {
                        alert("部隊にキャラクターが編成されていません。\n「編成」画面からキャラクターを配置してください。");
                        return;
                    }
                    app.changeScene('screen-sugoroku', { stageId: id });
                };
            }
            list.appendChild(div);
        });
    }
}

// ============================================================
// 3. シーンレジストリ（ID解決 + onEnter/onLeave を一元管理）
// ============================================================
class SceneRegistry {
    constructor() {
        /** ID短縮名 → 正式ID */
        this._aliases = new Map([
            ['edit',       'screen-edit'],
            ['quest',      'screen-edit'],
            ['enhance',    'screen-enhance'],
            ['battle',     'screen-battle'],
            ['home',       'screen-home'],
            ['gacha',      'screen-gacha'],
            ['zukan',      'screen-zukan'],
            ['cards',      'screen-cards'],
            ['sugoroku',   'screen-sugoroku'],
            ['tower',      'screen-tower'],
            ['map-select', 'screen-map-select'],
        ]);

        /** sceneId → { enterFn?, leaveFn? } */
        this._handlers = new Map();
    }

    /**
     * シーンハンドラを登録
     * @param {string} sceneId  - 'screen-edit' 等
     * @param {object} handler  - { enterFn?: (options)=>void, leaveFn?: ()=>void }
     */
    register(sceneId, handler) {
        this._handlers.set(sceneId, handler);
    }

    /** 短縮名を正式IDに解決 */
    resolveId(id) {
        return this._aliases.get(id) || id;
    }

    /** シーン退場処理 */
    triggerLeave(sceneId) {
        const h = this._handlers.get(sceneId);
        if (h && h.leaveFn) h.leaveFn();
    }

    /** シーン入場処理 */
    triggerEnter(sceneId, options) {
        const h = this._handlers.get(sceneId);
        if (h && h.enterFn) h.enterFn(options);
    }
}

// ============================================================
// 4. GameApp（スリム版）
// ============================================================
class GameApp {
    constructor() {
        // --- コアマネージャー ---
        this.sound = new SoundManager();
        this.data = new DataManager();
        this.deckManager = new DeckManager();
        this.sceneManager = new SceneManager();
        this.viewport = new ViewportManager();

        // --- 各画面インスタンス ---
        this.formationScreen = new FormationScreenRedesign();
        this.enhanceScreen = new EnhanceScreen();
        this.battleScreen = new BattleScreen();
        this.gachaScreen = new GachaScreen();
        this.zukanScreen = new ZukanScreen();
        this.cardScreen = new CardEquipScreen();
        this.sugorokuScreen = new SugorokuScreen();
        this.panelBattleScreen = new PanelBattleScreen();
        this.mapSelectScreen = new MapSelectScreen();

        this._homeSpriteTimer = null;
        this._homeSpriteKey = '';

        // --- シーンレジストリ ---
        this.sceneRegistry = new SceneRegistry();
        this._registerScenes();

        // --- リサイズ時のシーン固有処理 ---
        this.viewport.onResize(() => this._onResize());
    }

    /** 全シーンのonEnter/onLeaveをレジストリに登録 */
    _registerScenes() {
        const r = this.sceneRegistry;

        r.register('screen-home', {});

        r.register('screen-edit', {
            enterFn: (opts) => this.formationScreen.onEnter(opts),
        });

        r.register('screen-enhance', {
            enterFn: (opts) => this.enhanceScreen.onEnter(opts),
            leaveFn: () => { if (this.enhanceScreen.onLeave) this.enhanceScreen.onLeave(); },
        });

        r.register('screen-gacha', {
            enterFn: (opts) => this.gachaScreen.onEnter(opts),
        });

        r.register('screen-zukan', {
            enterFn: (opts) => this.zukanScreen.onEnter(opts),
            leaveFn: () => { if (this.zukanScreen.onLeave) this.zukanScreen.onLeave(); },
        });

        r.register('screen-cards', {
            enterFn: (opts) => this.cardScreen.onEnter(opts),
        });

        r.register('screen-map-select', {
            enterFn: (opts) => this.mapSelectScreen.onEnter(opts),
        });

        r.register('screen-sugoroku', {
            enterFn: (opts) => {
                if (opts && opts.stageId) {
                    this.sugorokuScreen.currentStageId = opts.stageId;
                }
                this.sugorokuScreen.onEnter(opts);
            },
        });

        r.register('screen-tower', {
            enterFn: () => {
                if (!this.towerScreen) this.towerScreen = new TowerScreen();
                this.towerScreen.onEnter();
            },
        });

        r.register('screen-battle', {
            enterFn: (opts) => this.battleScreen.start(opts),
        });
    }

    init() {
        this.sound.init();
        this.changeScene('screen-home');
        this.startHomeSpriteAnimation();
        if (this.data) {
            if (this.data.gems < 3000) this.data.gems = 3000;
            if (this.data.saveStats) this.data.saveStats();
        }
        if (window.updateGlobalHeader) window.updateGlobalHeader();
    }

    // ==========================================================
    // changeScene — レジストリベース
    // ==========================================================
    changeScene(id, options = {}) {
        const targetId = this.sceneRegistry.resolveId(id);

        this.updateFooterActive(targetId);

        // 旧シーンのonLeave
        const currentSceneId = this.sceneManager
            ? this.sceneManager.currentSceneId
            : (document.querySelector('.screen.active')?.id || null);

        if (currentSceneId && currentSceneId !== targetId) {
            this.sceneRegistry.triggerLeave(currentSceneId);
        }

        // シーン切替完了後のコールバック
        const onSceneReady = () => {
            this.sceneRegistry.triggerEnter(targetId, options);
            this.viewport.updateHeight();
            setTimeout(() => window.scrollTo(0, 0), 100);
        };

        if (this.sceneManager) {
            this.sceneManager.change(targetId, onSceneReady);
        } else {
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            const t = document.getElementById(targetId);
            if (t) t.classList.add('active');
            onSceneReady();
        }
    }

    updateFooterActive(targetSceneId) {
        document.querySelectorAll('#global-footer .gf-btn[data-scene]').forEach(btn => {
            const isActive = btn.dataset.scene === targetSceneId;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-current', isActive ? 'page' : 'false');
        });
    }

    /** リサイズ時のシーン固有処理 */
    _onResize() {
        const activeScene = this.sceneManager.currentSceneId;

        if (activeScene === 'screen-battle' && this.battleScreen.active) {
            if (this.battleScreen.visuals && this.battleScreen.visuals.fitToScreen) {
                this.battleScreen.visuals.fitToScreen();
            }
        }
        if (activeScene === 'screen-sugoroku' && this.sugorokuScreen.isGameActive) {
            this.sugorokuScreen.updateCamera(false);
        }
        setTimeout(() => window.scrollTo(0, 0), 100);
    }

    // ==========================================================
    // ホーム画面スプライトアニメーション（変更なし）
    // ==========================================================
    startHomeSpriteAnimation() {
        const el = document.querySelector('.home-char-anim');
        if (!el) return;

        const cfg = {
            src: 'images/player_main_idle_sheet.png',
            cols: 4, rows: 4, frames: 7, fps: 8, loop: true
        };

        const cols = Math.max(1, Math.floor(cfg.cols));
        const rows = Math.max(1, Math.floor(cfg.rows));
        const frames = Math.max(1, Math.floor(cfg.frames));
        const fps = Math.max(1, Math.floor(cfg.fps));
        const loop = cfg.loop !== false;
        const key = `${cfg.src}|${cols}|${rows}|${frames}|${fps}|${loop}`;

        if (this._homeSpriteKey === key && this._homeSpriteTimer) return;
        this.stopHomeSpriteAnimation();

        el.style.backgroundImage = `url('${cfg.src}')`;
        el.style.backgroundRepeat = 'no-repeat';
        el.style.backgroundSize = `${cols * 100}% ${rows * 100}%`;

        let frame = 0;
        const frameMs = Math.max(40, Math.floor(1000 / fps));
        this._homeSpriteKey = key;

        const applyFrame = (idx) => {
            const safeIdx = Math.max(0, Math.min(frames - 1, idx));
            const c = safeIdx % cols;
            const r = Math.floor(safeIdx / cols);
            const xPct = cols <= 1 ? 0 : (c / (cols - 1)) * 100;
            const yPct = rows <= 1 ? 0 : (r / (rows - 1)) * 100;
            el.style.backgroundPosition = `${xPct}% ${yPct}%`;
        };

        applyFrame(frame);
        this._homeSpriteTimer = setInterval(() => {
            const currentEl = document.querySelector('.home-char-anim');
            if (!currentEl || currentEl !== el || this._homeSpriteKey !== key) {
                this.stopHomeSpriteAnimation();
                return;
            }
            frame += 1;
            if (frame >= frames) {
                frame = loop ? 0 : frames - 1;
                if (!loop) { applyFrame(frame); this.stopHomeSpriteAnimation(); return; }
            }
            applyFrame(frame);
        }, frameMs);
    }

    stopHomeSpriteAnimation() {
        if (this._homeSpriteTimer) {
            clearInterval(this._homeSpriteTimer);
            this._homeSpriteTimer = null;
        }
        this._homeSpriteKey = '';
    }
}

// ============================================================
// 5. アプリ起動
// ============================================================
window.app = new GameApp();

window.addEventListener('DOMContentLoaded', () => {
    app.init();
});

// ============================================================
// 6. グローバルユーティリティ（ファサード）
// ============================================================
function getSafeImageUrl(id) {
    return (typeof IMG_DATA !== 'undefined' && IMG_DATA[id]) ? IMG_DATA[id] : '';
}

window.updateGlobalHeader = () => {
    if (!app || !app.data) return;
    const elGem = document.getElementById('gh-gem');
    const elGold = document.getElementById('gh-gold');
    if (elGem) elGem.innerText = (app.data.gems || 0).toLocaleString();
    if (elGold) elGold.innerText = (app.data.gold || 0).toLocaleString();
    const slotInfo = document.getElementById('home-slot-info');
    if (slotInfo) slotInfo.textContent = (app.data.deck ? app.data.deck.length : 0) + ' / ' + (app.data.maxSlots || 4);
};

// --- シーン遷移ショートカット（HTMLのonclick用） ---
window.changeScene    = (id, opts) => app.changeScene(id, opts);
window.goHome         = () => app.changeScene('screen-home');

window.goToSugoroku    = () => app.changeScene('screen-map-select');

// --- 編成操作 ---
window.clearFormation = () => { if (app.formationScreen) app.formationScreen.clear(); };
window.startBattle    = () => app.changeScene('screen-sugoroku');

// --- 強化操作 ---


// --- バトル操作 ---
window.backToEdit = () => {
    if (app.battleScreen && app.battleScreen.backToEdit) {
        app.battleScreen.backToEdit();
    } else {
        app.changeScene('screen-edit');
    }
};
window.toggleSpeed = () => { if (app.battleScreen) app.battleScreen.toggleSpeed(); };

// ============================================================
// 7. テスター用ノッチシミュレーション（URLに ?notch=1）
// ============================================================
(function simulateNotch() {
    if (!window.location.search.includes('notch=1')) return;
    const style = document.createElement('style');
    style.innerHTML = `
        .global-header {
            padding-top: 59px !important;
            height: calc(var(--header-h, 50px) + 59px) !important;
        }
        #screen-home, #screen-map-select, #screen-edit, #screen-enhance,
        #screen-gacha, #screen-zukan, #screen-tower, #screen-sugoroku {
            padding-top: calc(var(--header-h, 50px) + 59px) !important;
            padding-bottom: calc(60px + 34px) !important;
        }
        #screen-battle {
            padding-top: 59px !important;
            padding-bottom: 0 !important;
        }
        .global-footer {
            padding-bottom: 34px !important;
            height: auto !important;
        }
        .gh-right { margin-right: 15px !important; }
    `;
    document.head.appendChild(style);
})();
