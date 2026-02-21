/**
 * main.js - マップ選択・ステージ解放対応版
 * ★フッター黒帯修正完全版（padding計算式の修正）
 */

// 読み込みエラー回避用のダミー定義
if (typeof FormationScreenRedesign === 'undefined') window.FormationScreenRedesign = class { onEnter(){} clear(){} refresh(){} };
if (typeof EnhanceScreen === 'undefined') window.EnhanceScreen = class { onEnter(){} levelUp(){} skillUp(){} limitBreak(){} };
if (typeof GachaScreen === 'undefined') window.GachaScreen = class { onEnter(){} };
if (typeof ZukanScreen === 'undefined') window.ZukanScreen = class { onEnter(){} };
if (typeof CardEquipScreen === 'undefined') window.CardEquipScreen = class { onEnter(){} render(){} };

/**
 * マップ選択画面クラス
 */
class MapSelectScreen {
    onEnter() {
        const list = document.getElementById('stage-list');
        if(!list) return;
        list.innerHTML = '';

        if (typeof SUGOROKU_STAGES === 'undefined') {
            list.innerHTML = '<div style="color:#fff;padding:20px;">ステージデータが見つかりません</div>';
            return;
        }

        Object.keys(SUGOROKU_STAGES).forEach(key => {
            const id = parseInt(key);
            const stage = SUGOROKU_STAGES[id];
            
            // 安全にデータ取得
            const maxCleared = (app.data && app.data.maxClearedStage) ? app.data.maxClearedStage : 0;
            const currentSlots = (app.data && app.data.maxSlots) ? app.data.maxSlots : 4;
            
            // ロック・クリア判定
            const isLocked = id > (maxCleared + 1);
            const isCleared = id <= maxCleared; // クリア済みかどうか

            const div = document.createElement('div');
            div.className = `stage-card ${isLocked ? 'locked' : ''}`;
            if(stage.bg) div.style.backgroundImage = `url('${stage.bg}')`;

            // クリア回数バッジ
            const cc = (app.data && app.data.stageClearCounts) ? (app.data.stageClearCounts[id] || 0) : 0;
            const badgeHtml = cc > 0
                ? `<div style="position:absolute;top:6px;right:6px;background:linear-gradient(135deg,#4caf50,#2e7d32);color:#fff;font-size:10px;font-weight:900;padding:2px 8px;border-radius:10px;box-shadow:0 2px 6px rgba(76,175,80,0.4);z-index:5;">✅ ${cc}回クリア</div>`
                : '';

            // ★追加: 初回報酬のHTML生成（未クリア かつ 枠が8未満のとき）
            let rewardHtml = '';
            if (!isCleared && currentSlots < 8) {
                rewardHtml = `
                    <div style="color:#00ffaa; font-size:11px; font-weight:bold; margin-top:2px; text-shadow:0 1px 2px #000; background:rgba(0,0,0,0.5); padding:2px 6px; border-radius:4px; width:fit-content; display:flex; align-items:center; gap:4px;">
                        <span>🎁</span> 初回報酬：<span style="color:#ffff00;">編成枠解放 (+1)</span>
                    </div>`;
            }

            if (isLocked) {
                div.innerHTML = `
                    <div class="lock-cover">🔒 LOCKED</div>
                    <div class="stage-card-overlay" style="opacity:0.3">
                        <div class="stage-title">Stage ${id}: ???</div>
                    </div>
                `;
                // ロック時はクリック音(エラー)だけ鳴らす
                div.onclick = () => { if(app.sound) app.sound.play('sys_danger'); };

            } else {
                div.innerHTML = `
                    ${badgeHtml}
                    <div class="stage-card-overlay">
                        <div class="stage-level">推奨Lv: ${stage.level || 1}</div>
                        ${rewardHtml}
                        <div class="stage-title">Stage ${id}: ${stage.name}</div>
                        <div class="stage-desc">${stage.desc || ''}</div>
                    </div>
                `;
                div.onclick = () => {
                    if(app.sound) app.sound.tap();
                    app.changeScene('screen-sugoroku', { stageId: id });
                };
            }
            list.appendChild(div);
        });
    }
}

class GameApp {
    constructor() {
        this.sound = new SoundManager();
        this.data = new DataManager();
        this.deckManager = new DeckManager(); 
        this.sceneManager = new SceneManager();
        
        this.formationScreen = new FormationScreenRedesign(); 
        this.enhanceScreen = new EnhanceScreen();
        this.battleScreen = new BattleScreen();
        this.gachaScreen = new GachaScreen();
        this.zukanScreen = new ZukanScreen();
        this.cardScreen = new CardEquipScreen();
        this.sugorokuScreen = new SugorokuScreen();
        this.mapSelectScreen = new MapSelectScreen();

        this.detectPWAMode();
        this.updateViewportHeight();

        // リサイズ監視の最適化
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => this.handleResize(), 100);
        });
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.updateViewportHeight(), 200);
        });
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', () => this.updateViewportHeight());
        }
        
        // ★修正ポイント: テーマ適用を実行
        this.injectPowerProTheme();
    }

    detectPWAMode() {
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
            || window.navigator.standalone 
            || document.referrer.includes('android-app://');
        
        if (isStandalone) {
            document.documentElement.classList.add('pwa-standalone');
            document.documentElement.style.setProperty('--browser-top-offset', '0px');
            console.log('PWA Standalone Mode Detected');
        } else {
            document.documentElement.classList.add('pwa-browser');
            console.log('Browser Mode Detected');
        }
        
        window.matchMedia('(display-mode: standalone)').addEventListener('change', (e) => {
            if (e.matches) {
                document.documentElement.classList.remove('pwa-browser');
                document.documentElement.classList.add('pwa-standalone');
            } else {
                document.documentElement.classList.remove('pwa-standalone');
                document.documentElement.classList.add('pwa-browser');
            }
            this.updateViewportHeight();
        });
    }

   // ★★★ デザイン強制適用（フッター修正版） ★★★
    injectPowerProTheme() {
        if(document.getElementById('power-pro-theme-v3')) return; 
        
        const old1 = document.getElementById('power-pro-theme-v1');
        const old2 = document.getElementById('power-pro-theme-v2');
        if(old1) old1.remove();
        if(old2) old2.remove();

        const style = document.createElement('style');
        style.id = 'power-pro-theme-v3';
        style.innerHTML = `
            /* ==================================================
               【強制適用】パワプロ風 ヘッダー＆フッター設定 (v3改)
               ================================================== */

            .header-bar {
                background: linear-gradient(to bottom, #0055aa 0%, #003366 100%) !important;
                border-bottom: 3px solid #ffd700 !important;
                box-shadow: 0 4px 8px rgba(0,0,0,0.4) !important;
                min-height: 40px !important;
                height: auto !important;
                padding: 8px 10px !important;
                padding-top: calc(8px + env(safe-area-inset-top, 0px)) !important;
                z-index: 99999 !important;
                display: flex !important;
                align-items: center !important;
            }
            .header-bar::after { content: none !important; display: none !important; }

            /* 編成画面(screen-edit)を追加して、ヘッダーを確実に消す */
            #screen-enhance > .header-bar,
            #screen-gacha > .header-bar,
            #screen-zukan > .header-bar,
            #screen-edit > .header-bar,
            #screen-cards > .header-bar,
            #screen-map-select > .header-bar {
                display: none !important;
            }

            .global-header {
                background: linear-gradient(to bottom, #000 0%, rgba(0,0,0,0.9) 80%, rgba(0,0,0,0.7) 100%) !important;
                height: calc(var(--header-h, 50px) + env(safe-area-inset-top, 0px)) !important;
                padding-top: env(safe-area-inset-top, 0px) !important;
            }

            .btn-back {
                background: linear-gradient(to bottom, #ffd700 0%, #ff8c00 100%) !important;
                border: 2px solid #fff !important;
                color: #5d3a00 !important;
                border-radius: 20px !important;
                padding: 4px 15px !important;
                font-weight: 900 !important;
                font-size: 13px !important;
                box-shadow: 0 3px 0 #b8860b !important;
                transform: skewX(-10deg) !important;
            }
            .btn-back span { display:inline-block; transform: skewX(10deg); }

            .header-title {
                color: #fff !important;
                font-style: italic !important;
                text-shadow: 2px 2px 0 #002244, -1px -1px 0 #002244 !important;
                font-size: 18px !important;
            }

            /* --- ★共通フッター (修正箇所) --- */
            .global-footer {
                position: fixed !important;
                bottom: 0 !important;
                left: 0 !important;
                width: 100% !important;

                background: linear-gradient(to bottom, #0055aa 0%, #003366 100%) !important;
                border-top: 3px solid #ffd700 !important;
                box-shadow: 0 -4px 10px rgba(0,0,0,0.5) !important;
                
                /* 高さを固定せず、paddingで確保する */
                height: auto !important;
                
                /* ★ここを修正しました★ */
                /* 「-15px」を削除し、セーフエリア分をそのまま確保 */
                padding-bottom: env(safe-area-inset-bottom, 20px) !important;
                
                z-index: 99999 !important;
            }

            .gf-btn {
                color: #fff !important; 
                background: transparent !important;
                opacity: 0.8 !important;
                transition: all 0.2s !important;
                /* ボタンの高さ */
                height: 55px !important;
                /* ボタン内の余白調整 */
                padding-bottom: 5px !important;
            }
            .gf-btn:active {
                opacity: 1 !important;
                transform: scale(0.95) !important;
            }
            
            .gf-btn.main-btn {
                background: radial-gradient(circle, #ffd700, #ff8c00) !important;
                border: 2px solid #fff !important;
                box-shadow: 0 0 15px rgba(255, 215, 0, 0.5) !important;
                color: #5d3a00 !important;
                opacity: 1 !important;
                margin-bottom: 5px !important;
                height: 60px !important;
                width: 60px !important;
                border-radius: 50% !important;
            }

            /* ★★★ 画面のpadding調整 ★★★ */
            #screen-sugoroku,
            #screen-map-select,
            #screen-tower,
            #screen-edit,
            #screen-enhance,
            #screen-gacha,
            #screen-zukan,
            #screen-home {
                padding-top: calc(var(--header-h, 50px) + env(safe-area-inset-top, 0px)) !important;
                /* フッター+セーフエリア分の余白を確保して、コンテンツが隠れないようにする */
                padding-bottom: calc(60px + env(safe-area-inset-bottom, 20px)) !important;
            }
            
            #screen-battle {
                padding-top: env(safe-area-inset-top, 0px) !important;
                padding-bottom: 0 !important;
            }

            .screen {
                padding-bottom: calc(60px + env(safe-area-inset-bottom, 0px)) !important;
            }
        `;
        document.head.appendChild(style);
    }

    init() { 
        this.sound.init(); 
        this.changeScene('screen-home'); 
        
        if(this.data) {
            if(this.data.gems < 3000) this.data.gems = 3000;
            if(this.data.saveStats) this.data.saveStats();
        }
        
        if(window.updateGlobalHeader) window.updateGlobalHeader();
    }

    updateViewportHeight() {
        // height: 100vh の代わりに innerHeight を使うことで、
        // アドレスバー等の影響による黒帯発生を防ぐ
        const vh = window.innerHeight;
        const vw = window.innerWidth;
        
        document.documentElement.style.setProperty('--vh', (vh * 0.01) + 'px');
        document.documentElement.style.setProperty('--app-height', vh + 'px');
        document.documentElement.style.setProperty('--app-width', vw + 'px');
    }

    handleResize() {
        this.updateViewportHeight();
        
        const activeScene = this.sceneManager.currentSceneId;
        
        if(activeScene === 'screen-battle' && this.battleScreen.active) {
            if(this.battleScreen.visuals && this.battleScreen.visuals.fitToScreen) {
                this.battleScreen.visuals.fitToScreen();
            }
        }
        
        if(activeScene === 'screen-sugoroku' && this.sugorokuScreen.isGameActive) {
            this.sugorokuScreen.updateCamera(false);
        }

        setTimeout(() => window.scrollTo(0, 0), 100);
    }

    changeScene(id, options = {}) {
        let targetId = id;
        
        if(id === 'edit' || id === 'quest') targetId = 'screen-edit';
        if(id === 'enhance') targetId = 'screen-enhance';
        if(id === 'battle') targetId = 'screen-battle';
        if(id === 'home') targetId = 'screen-home';
        if(id === 'gacha') targetId = 'screen-gacha';
        if(id === 'zukan') targetId = 'screen-zukan';
        if(id === 'cards') targetId = 'screen-cards';
        if(id === 'sugoroku') targetId = 'screen-sugoroku';
        if(id === 'tower') targetId = 'screen-tower';
        if(id === 'map-select') targetId = 'screen-map-select'; 
        
        const onSceneReady = () => {
            if(targetId === 'screen-edit' && this.formationScreen) this.formationScreen.onEnter(options);
            if(targetId === 'screen-enhance' && this.enhanceScreen) this.enhanceScreen.onEnter(options);
            if(targetId === 'screen-gacha' && this.gachaScreen) this.gachaScreen.onEnter(options);
            if(targetId === 'screen-zukan' && this.zukanScreen) this.zukanScreen.onEnter(options);
            if(targetId === 'screen-cards' && this.cardScreen) this.cardScreen.onEnter(options);
            if(targetId === 'screen-map-select' && this.mapSelectScreen) this.mapSelectScreen.onEnter(options);

            if(targetId === 'screen-sugoroku' && this.sugorokuScreen) {
                if(options && options.stageId) {
                    this.sugorokuScreen.currentStageId = options.stageId;
                }
                this.sugorokuScreen.onEnter(options);
            }
            
            if(targetId === 'screen-tower') {
                if (!this.towerScreen) this.towerScreen = new TowerScreen();
                this.towerScreen.onEnter();
            }

            if(targetId === 'screen-battle' && this.battleScreen) this.battleScreen.start(options);
            
            this.handleResize();
        };

        if(this.sceneManager) {
            this.sceneManager.change(targetId, onSceneReady);
        } else {
            const screens = document.querySelectorAll('.screen');
            screens.forEach(s => s.classList.remove('active'));
            const t = document.getElementById(targetId);
            if(t) t.classList.add('active');
            onSceneReady();
        }
    }
}

window.app = new GameApp();

window.addEventListener('DOMContentLoaded', () => {
    app.init();
});

function getSafeImageUrl(id) {
    if (typeof IMG_DATA !== 'undefined' && IMG_DATA[id]) {
        return IMG_DATA[id];
    }
    return '';
}

window.updateGlobalHeader = () => {
    if(!app || !app.data) return;
    const elGem = document.getElementById('gh-gem');
    const elGold = document.getElementById('gh-gold');
    if(elGem) elGem.innerText = (app.data.gems || 0).toLocaleString();
    if(elGold) elGold.innerText = (app.data.gold || 0).toLocaleString();
    const slotInfo = document.getElementById('home-slot-info');
    if(slotInfo) slotInfo.textContent = (app.data.deck ? app.data.deck.length : 0) + ' / ' + (app.data.maxSlots || 4);
};

window.changeScene = (id, options) => { if(app) app.changeScene(id, options); };

window.goHome = () => app.changeScene('screen-home');
window.goToQuest = () => app.changeScene('screen-edit');
window.goToFormation = () => app.changeScene('screen-edit');
window.goToEnhance = () => app.changeScene('screen-enhance');

window.goToSugoroku = () => app.changeScene('screen-map-select');

window.clearFormation = () => { if(app.formationScreen) app.formationScreen.clear(); };
window.startBattle = () => app.changeScene('screen-sugoroku'); 

window.execLevelUp = () => { if(app.enhanceScreen) app.enhanceScreen.levelUp(); };
window.execSkillUp = () => { if(app.enhanceScreen) app.enhanceScreen.skillUp(); };
window.execLimitBreak = () => { if(app.enhanceScreen) app.enhanceScreen.limitBreak(); };

window.backToEdit = () => {
    if(app.battleScreen && app.battleScreen.backToEdit) {
        app.battleScreen.backToEdit();
    } else {
        app.changeScene('screen-edit');
    }
};
window.toggleSpeed = () => { if(app.battleScreen) app.battleScreen.toggleSpeed(); };
/* main.js の一番下（既存のsimulateNotchをこれで上書き） */

// ★テスター用：URLに ?notch=1 がある場合のみ、強制的にiPhoneのノッチを再現する
(function simulateNotch() {
    if (window.location.search.includes('notch=1')) {
        console.log("Simulating iPhone Notch...");
        const style = document.createElement('style');
        style.innerHTML = `
            /* ヘッダー自体の高さを拡張（ノッチ分59px追加） */
            .global-header {
                padding-top: 59px !important;
                height: calc(var(--header-h, 50px) + 59px) !important;
            }

            /* ★修正ポイント: クラス(.screen)ではなくIDを列挙して優先度を勝たせる */
            /* これでコンテンツ全体がググッと下に下がります */
            #screen-home,
            #screen-map-select,
            #screen-edit,
            #screen-enhance,
            #screen-gacha,
            #screen-zukan,
            #screen-tower,
            #screen-sugoroku {
                padding-top: calc(var(--header-h, 50px) + 59px) !important;
                /* 下部のバー対応（必要な場合） */
                padding-bottom: calc(60px + 34px) !important;
            }

            /* バトル画面など特殊な画面の調整 */
            #screen-battle {
                padding-top: 59px !important;
                padding-bottom: 0 !important;
            }

            /* フッターの下に余白を追加 */
            .global-footer {
                padding-bottom: 34px !important;
                height: auto !important;
            }

            /* ノッチの横調整 */
            .gh-right {
                margin-right: 15px !important;
            }
        `;
        document.head.appendChild(style);
    }
})();