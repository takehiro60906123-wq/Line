/**
 * scene_manager.js - シーン遷移マネージャー
 * 
 * 旧: managers.js SceneManager (319行) からTIPS/トランジションUIを分離
 * 依存: tips_data.js (TransitionUI)
 */
class SceneManager {
    constructor() { 
        this.currentSceneId = 'screen-home'; 
        this.isTransitioning = false; 
    }

    change(sceneId, callback) {
        if (this.isTransitioning) return;
        if (this.currentSceneId === sceneId) return;

        // 旧トランジションの後片付け
        TransitionUI.cleanup();

        // 新トランジションを生成
        TransitionUI.setup();
        const layer = document.getElementById('dynamic-transition-layer');
        if (!layer) { this._fallbackChange(sceneId, callback); return; }

        if (typeof app !== 'undefined' && app.sound) { app.sound.init(); app.sound.tap(); }
        
        this.isTransitioning = true;
        requestAnimationFrame(() => layer.classList.add('active'));

        setTimeout(() => {
            this._applySceneSwitch(sceneId);

            if (typeof callback === 'function') {
                requestAnimationFrame(() => { callback(); });
            }
            layer.classList.remove('active');
            setTimeout(() => { this.isTransitioning = false; layer.remove(); }, 300);
        }, 1000); 
    }

    _fallbackChange(sceneId, callback) {
        this._applySceneSwitch(sceneId);
        if (typeof callback === 'function') callback();
    }

    /** DOM切替 + ヘッダー/フッター表示制御（共通処理） */
    _applySceneSwitch(sceneId) {
        const screens = document.querySelectorAll('.screen');
        screens.forEach(s => s.classList.remove('active'));
        const target = document.getElementById(sceneId);
        if (target) target.classList.add('active');
        this.currentSceneId = sceneId;

        const hiddenScenes = ['screen-battle', 'screen-sugoroku'];
        const footer = document.getElementById('global-footer');
        if (footer) footer.style.display = hiddenScenes.includes(sceneId) ? 'none' : 'flex';
        const header = document.getElementById('global-header');
        if (header) header.style.display = hiddenScenes.includes(sceneId) ? 'none' : 'flex';

        if (typeof app !== 'undefined' && typeof window.updateGlobalHeader === 'function') {
            window.updateGlobalHeader();
        }
    }
}
