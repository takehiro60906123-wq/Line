/**
 * viewport_manager.js - ビューポート管理・PWA検出
 * 
 * 旧: main.js GameApp内の以下メソッドを分離
 *   - detectPWAMode()
 *   - updateViewportHeight()
 *   - scheduleViewportSync()
 *   - handleResize() のビューポート部分
 */
class ViewportManager {
    constructor() {
        this._resizeTimer = null;
        this.detectPWAMode();
        this.updateHeight();
        this._bindEvents();
        this.scheduleSync();
    }

    /** PWAスタンドアロン/ブラウザモード判定 */
    detectPWAMode() {
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
            || window.navigator.standalone 
            || document.referrer.includes('android-app://');
        
        if (isStandalone) {
            document.documentElement.classList.add('pwa-standalone');
            document.documentElement.style.setProperty('--browser-top-offset', '0px');
        } else {
            document.documentElement.classList.add('pwa-browser');
        }
        
        window.matchMedia('(display-mode: standalone)').addEventListener('change', (e) => {
            document.documentElement.classList.toggle('pwa-standalone', e.matches);
            document.documentElement.classList.toggle('pwa-browser', !e.matches);
            this.updateHeight();
        });
    }

    /** CSS変数 --vh, --app-height, --app-width を更新 */
    updateHeight() {
        const vv = window.visualViewport;
        const vvHeight = vv ? Math.round(vv.height) : 0;
        const innerHeight = Math.round(window.innerHeight || 0);
        const vh = Math.max(innerHeight, vvHeight, 1);
        const vw = Math.round(window.innerWidth || (vv ? vv.width : 0) || 1);
        
        document.documentElement.style.setProperty('--vh', (vh * 0.01) + 'px');
        document.documentElement.style.setProperty('--app-height', vh + 'px');
        document.documentElement.style.setProperty('--app-width', vw + 'px');
    }

    /** 初期表示時に複数フレームで再計算 */
    scheduleSync() {
        this.updateHeight();
        requestAnimationFrame(() => this.updateHeight());
        setTimeout(() => this.updateHeight(), 120);
        setTimeout(() => this.updateHeight(), 360);
    }

    /** リサイズ時の処理（デバウンス付き） */
    onResize(callback) {
        this._resizeCallback = callback;
    }

    _bindEvents() {
        window.addEventListener('resize', () => {
            clearTimeout(this._resizeTimer);
            this._resizeTimer = setTimeout(() => {
                this.updateHeight();
                if (this._resizeCallback) this._resizeCallback();
            }, 100);
        });
        window.addEventListener('pageshow', () => this.scheduleSync());
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', () => this.updateHeight());
        }
    }
}
