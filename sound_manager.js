/**
 * sound_manager.js - ハイブリッドSEエンジン v2
 * 
 * ■ マスターチェイン: 全SE → コンプレッサー → コンボルバーリバーブ → マスターゲイン
 * ■ レイヤード合成: メイン + サブベース + ノイズ + 倍音 を重ねてリッチな音に
 * ■ FM合成: 金属音・魔法音を周波数変調で表現
 * ■ ファイルフォールバック: sounds/ にmp3/oggがあればそちらを優先再生
 */
class SoundManager {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.compressor = null;
        this.convolver = null;
        this.dryGain = null;
        this.wetGain = null;
        this.audioCache = {};
        this.fileChecked = false;

        const unlock = () => {
            this._ensureCtx();
            document.removeEventListener('click', unlock);
            document.removeEventListener('touchstart', unlock);
            document.removeEventListener('keydown', unlock);
        };
        document.addEventListener('click', unlock);
        document.addEventListener('touchstart', unlock);
        document.addEventListener('keydown', unlock);
    }

    // =========================================================
    //  初期化・マスターチェイン構築
    // =========================================================
    _ensureCtx() {
        if (this.ctx) {
            if (this.ctx.state === 'suspended') this.ctx.resume();
            return;
        }
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();

        // コンプレッサー (音圧を揃えてプロっぽく)
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.value = -24;
        this.compressor.knee.value = 12;
        this.compressor.ratio.value = 6;
        this.compressor.attack.value = 0.003;
        this.compressor.release.value = 0.15;

        // コンボルバーリバーブ (空間の残響)
        this.convolver = this.ctx.createConvolver();
        this._buildImpulse();

        // ドライ/ウェット ミックス
        this.dryGain = this.ctx.createGain();
        this.dryGain.gain.value = 0.82;
        this.wetGain = this.ctx.createGain();
        this.wetGain.gain.value = 0.18;

        // マスターゲイン
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.7;

        // ルーティング
        this.compressor.connect(this.dryGain);
        this.compressor.connect(this.convolver);
        this.convolver.connect(this.wetGain);
        this.dryGain.connect(this.masterGain);
        this.wetGain.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);

        this._preloadFiles();
    }

    init() { this._ensureCtx(); }

    // インパルスレスポンス生成 (ルームリバーブ 0.6秒)
    _buildImpulse() {
        const rate = this.ctx.sampleRate;
        const len = Math.floor(rate * 0.6);
        const buf = this.ctx.createBuffer(2, len, rate);
        for (let ch = 0; ch < 2; ch++) {
            const d = buf.getChannelData(ch);
            for (let i = 0; i < len; i++) {
                d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5) * 0.35;
            }
        }
        this.convolver.buffer = buf;
    }

    get _out() { return this.compressor; }

    play(key) {
        if (!this.ctx) this._ensureCtx();
        if (this.enabled === false) return;

        switch (key) {
            // --- 双六用追加SE ---
            case 'se_dash':  this.se_dash(); break;
            case 'se_run':   this.se_run(); break;
            case 'se_brake': this.se_brake(); break;
            case 'se_chest_open': this.se_chest_open(); break;
            case 'se_enemy_appear': this.se_enemy_appear(); break;
            case 'se_encounter': this.se_encounter(); break;
            // --- 既存SE（ここがエラー原因だったので引数を修正しました） ---
            case 'sys_decide': // 決定音
            case 'sys_gacha_open':
                // 修正: 引数を (波形, 開始Hz, 終了Hz, 時間, 音量) に合わせる
                this._osc('square', 880, 880, 0.1, 0.1); 
                break;
            case 'sys_cursor': // カーソル音
                this._osc('triangle', 440, 440, 0.05, 0.05);
                break;
            case 'sys_cancel': // キャンセル音
                this._osc('sawtooth', 220, 220, 0.1, 0.1);
                break;
            case 'sys_ok': 
                this._osc('sine', 1200, 1200, 0.1, 0.2);
                break;
            case 'sys_clear': 
                this._melody([523, 659, 783, 1046], 0.1);
                break;
            case 'sys_danger': 
                this._osc('sawtooth', 100, 100, 0.5, 0.5);
                break;
            case 'sys_recovery':
                this._slide(200, 800, 0.5);
                break;
            
            // ファイル直接指定系
            case 'attack': this.attack(); break;
            case 'damage': this.damage(); break;
            case 'heal':   this.heal(); break;
            case 'start':  this.start(); break;
            case 'win':    this.win(); break;
            case 'lose':   this.lose(); break;
            case 'thunder': this.thunder(); break;

            default:
                // 未定義の音
                if (!this._tryFile(key)) {
                    this._osc('sine', 800, 800, 0.05, 0.05);
                }
                break;
        }
    }

    // --- 以下、シンセサイザー用ヘルパー ---

    // 単音再生
    _osc(type, freq, dur, vol) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + dur);

        osc.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start();
        osc.stop(this.ctx.currentTime + dur);
    }

    // スライド音（回復キラキラなど）
    _slide(startFreq, endFreq, dur) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.frequency.setValueAtTime(startFreq, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(endFreq, this.ctx.currentTime + dur);
        
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + dur);

        osc.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start();
        osc.stop(this.ctx.currentTime + dur);
    }

    // メロディ再生
    _melody(freqs, stepTime) {
        freqs.forEach((f, i) => {
            setTimeout(() => this._osc('square', f, stepTime, 0.1), i * (stepTime * 1000));
        });
    }

    // 既存コード互換用（あれば）
    tap() { this.play('sys_cursor'); }
    start() { this._ensureCtx(); }


    // =========================================================
    //  ファイルフォールバック
    // =========================================================
    async _preloadFiles() {
        if (this.fileChecked) return;
        this.fileChecked = true;
        
        // file://プロトコルではfetchがCORSブロックされるのでスキップ
        if (location.protocol === 'file:') return;
        
        const names = [
            'tap','attack','damage','heal','start','win','lose',
            'gachaRare','gachaUr',
            'thunder',
            'attackSmash','attackBlast','attackSnipe','attackMulti',
            'attackLine','attackCross','attackVamp','attackBuff',
            'attackDebuff','attackPoison','attackStun',
            'attackSleep','attackParalyze','attackBlind','attackConfuse',
            'criticalHit','attackMiss','defeat',
            'se_dash', 'se_run', 'se_brake',
            'se_chest_open'
        ];
        for (const name of names) {
            for (const ext of ['mp3', 'ogg', 'wav']) {
                try {
                    const resp = await fetch(`sounds/${name}.${ext}`);
                    if (resp.ok) {
                        const ab = await resp.arrayBuffer();
                        this.audioCache[name] = await this.ctx.decodeAudioData(ab);
                        break;
                    }
                } catch(e) { /* ファイルなし → 合成音 */ }
            }
        }
    }

   _tryFile(name, vol = 1.0) {
        if (!this.audioCache[name]) return null; // 変更: false -> null
        const src = this.ctx.createBufferSource();
        src.buffer = this.audioCache[name];
        const g = this.ctx.createGain();
        g.gain.value = vol;
        src.connect(g);
        g.connect(this._out);
        src.start(0);
        return src; // 変更: true -> src
    }

    // =========================================================
    //  互換API: playTone (他ファイルから呼ばれる汎用トーン)
    // =========================================================
    playTone(freq, type, duration, volume) {
        this._ensureCtx();
        const vol = volume || 0.1;
        const dur = duration || 0.1;
        this._osc(type || 'sine', freq, freq * 0.5, dur, vol, 0.001, 0.02, 0.2, dur * 0.4);
    }

    // =========================================================
    //  合成ヘルパー
    // =========================================================
    _adsr(gn, vol, a, d, s, r, t) {
        const g = gn.gain;
        g.setValueAtTime(0, t);
        g.linearRampToValueAtTime(vol, t + a);
        g.linearRampToValueAtTime(vol * s, t + a + d);
        g.setValueAtTime(vol * s, t + a + d);
        g.linearRampToValueAtTime(0.001, t + a + d + r);
    }

    // 単一オシレータ
    _osc(type, f0, f1, dur, vol, a=0.001, d=0.05, s=0.5, r=0.05) {
        this._ensureCtx();
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(f0, t);
        if (f1 && f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(f1, 0.01), t + dur);
        this._adsr(g, vol, a, d, s, r, t);
        osc.connect(g); g.connect(this._out);
        osc.start(t); osc.stop(t + a + d + r + 0.02);
    }

    // レイヤード倍音 (コーラス・デチューン対応)
    _layer(freq, harmonics, vol, env) {
        this._ensureCtx();
        const t = this.ctx.currentTime;
        const e = env || {a:0.001, d:0.05, s:0.5, r:0.1};
        for (const h of harmonics) {
            const osc = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            osc.type = h.t || 'sine';
            const f = freq * h.m;
            osc.frequency.setValueAtTime(f, t);
            if (h.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(h.f1, 0.01), t + e.a + e.d + e.r);
            if (h.det) osc.detune.value = h.det;
            this._adsr(g, vol * h.v, e.a, e.d, e.s, e.r, t);
            osc.connect(g); g.connect(this._out);
            osc.start(t); osc.stop(t + e.a + e.d + e.r + 0.05);
        }
    }

    // FM合成
    _fm(cFreq, mFreq, mDepth, dur, vol, type='sine', env) {
        this._ensureCtx();
        const t = this.ctx.currentTime;
        const e = env || {a:0.001, d:0.05, s:0.4, r:0.15};
        const mod = this.ctx.createOscillator();
        const modG = this.ctx.createGain();
        mod.type = 'sine';
        mod.frequency.setValueAtTime(mFreq, t);
        modG.gain.setValueAtTime(mDepth, t);
        modG.gain.exponentialRampToValueAtTime(1, t + dur);
        mod.connect(modG);
        const car = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        car.type = type;
        car.frequency.setValueAtTime(cFreq, t);
        modG.connect(car.frequency);
        this._adsr(g, vol, e.a, e.d, e.s, e.r, t);
        car.connect(g); g.connect(this._out);
        mod.start(t); car.start(t);
        const end = t + e.a + e.d + e.r + 0.05;
        mod.stop(end); car.stop(end);
    }

    // フィルタ付きノイズバースト
    _noise(dur, vol, freq, fType='highpass', Q=1) {
        this._ensureCtx();
        const t = this.ctx.currentTime;
        const len = Math.floor(this.ctx.sampleRate * dur);
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const filt = this.ctx.createBiquadFilter();
        filt.type = fType; filt.frequency.value = freq; filt.Q.value = Q;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        src.connect(filt); filt.connect(g); g.connect(this._out);
        src.start(t);
        return src; // ★追加: 音源を返す
    }

    // フィルタスイープノイズ
    _sweep(dur, vol, f0, f1, fType='lowpass') {
        this._ensureCtx();
        const t = this.ctx.currentTime;
        const len = Math.floor(this.ctx.sampleRate * dur);
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const filt = this.ctx.createBiquadFilter();
        filt.type = fType;
        filt.frequency.setValueAtTime(f0, t);
        filt.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
        filt.Q.value = 4;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        src.connect(filt); filt.connect(g); g.connect(this._out);
        src.start(t);
    }

    // サブベース
    _sub(freq, dur, vol) {
        this._osc('sine', freq, Math.max(freq * 0.3, 10), dur, vol, 0.002, 0.04, 0.0, dur * 0.6);
    }

    // ディレイ実行
    _at(ms, fn) { setTimeout(() => { if (this.ctx) fn(); }, ms); }

    // =========================================================
    //  UI SE
    // =========================================================
    tap() {
        if (this._tryFile('tap')) return;
        this._ensureCtx();
        this._fm(1400, 80, 200, 0.04, 0.10, 'square', {a:0.001, d:0.01, s:0.0, r:0.02});
        this._noise(0.03, 0.06, 4000);
    }

    // =========================================================
    //  攻撃SE
    // =========================================================
    attack() {
        if (this._tryFile('attack')) return;
        this._ensureCtx();
        this._noise(0.08, 0.20, 1800, 'bandpass', 3);
        this._osc('sawtooth', 500, 50, 0.12, 0.14, 0.001, 0.03, 0.1, 0.06);
        this._sub(70, 0.12, 0.10);
    }

    damage() {
        if (this._tryFile('damage')) return;
        this._ensureCtx();
        this._osc('square', 120, 15, 0.15, 0.30, 0.001, 0.03, 0.0, 0.10);
        this._noise(0.12, 0.35, 900, 'lowpass', 2);
        this._sub(50, 0.15, 0.20);
        this._noise(0.06, 0.12, 3500);
    }

    heal() {
        if (this._tryFile('heal')) return;
        this._ensureCtx();
        [523, 659, 784].forEach((f, i) => {
            this._at(i * 100, () => {
                this._layer(f, [
                    {m:1, v:1.0, t:'sine'},
                    {m:2, v:0.4, t:'sine', det:3},
                    {m:3, v:0.15, t:'sine'},
                    {m:5, v:0.06, t:'sine'}
                ], 0.10, {a:0.005, d:0.10, s:0.25, r:0.20});
            });
        });
        this._at(200, () => this._noise(0.15, 0.03, 6000));
        this._at(280, () => this._noise(0.12, 0.02, 7000));
    }

    start() {
        if (this._tryFile('start')) return;
        this._ensureCtx();
        [440, 554, 659, 880].forEach((f, i) => {
            this._at(i * 100, () => {
                const last = (i === 3);
                this._layer(f, [
                    {m:1, v:1.0, t:'triangle'},
                    {m:2, v:0.35, t:'sine'},
                    {m:3, v:0.12, t:'sine', det: last ? 5 : 0}
                ], last ? 0.14 : 0.10,
                   {a:0.003, d:0.06, s: last ? 0.4 : 0.1, r: last ? 0.35 : 0.08});
                if (last) this._noise(0.08, 0.04, 5000);
            });
        });
    }

    win() {
        if (this._tryFile('win')) return;
        this._ensureCtx();
        [{f:523,d:0},{f:659,d:120},{f:784,d:240},{f:1047,d:400}].forEach(n => {
            this._at(n.d, () => {
                const last = n.d === 400;
                this._layer(n.f, [
                    {m:1, v:1.0, t:'triangle'},
                    {m:2, v:0.3, t:'sine', det:4},
                    {m:3, v:0.12, t:'sine'},
                    {m:4, v:0.05, t:'sine'}
                ], last ? 0.16 : 0.11,
                   {a:0.005, d:0.08, s: last ? 0.5 : 0.15, r: last ? 0.6 : 0.10});
            });
        });
        this._at(420, () => this._noise(0.20, 0.05, 5000));
    }

    lose() {
        if (this._tryFile('lose')) return;
        this._ensureCtx();
        this._layer(220, [
            {m:1, v:1.0, t:'sawtooth', f1:60},
            {m:1.06, v:0.5, t:'sawtooth', f1:55},
            {m:0.5, v:0.4, t:'sine', f1:25}
        ], 0.12, {a:0.01, d:0.15, s:0.3, r:0.40});
        this._noise(0.3, 0.06, 400, 'lowpass');
    }

    gachaRare() {
        if (this._tryFile('gachaRare')) return;
        this._ensureCtx();
        this._fm(880, 220, 500, 0.25, 0.12, 'sine', {a:0.005, d:0.08, s:0.3, r:0.15});
        this._at(80, () => this._layer(1320, [
            {m:1, v:1.0, t:'sine'}, {m:2, v:0.3, t:'sine', det:5}
        ], 0.10, {a:0.005, d:0.06, s:0.2, r:0.15}));
        this._at(100, () => this._noise(0.10, 0.04, 5000));
    }

    gachaUr() {
        if (this._tryFile('gachaUr')) return;
        this._ensureCtx();
        this._sub(80, 0.3, 0.15);
        this._noise(0.15, 0.12, 800, 'lowpass');
        [660, 880, 1047, 1320].forEach((f, i) => {
            this._at(150 + i * 90, () => {
                this._layer(f, [
                    {m:1, v:1.0, t:'sine', det:3},
                    {m:2, v:0.35, t:'sine'},
                    {m:3, v:0.12, t:'sine'}
                ], 0.10, {a:0.003, d:0.06, s:0.25, r:0.20});
            });
        });
        this._at(500, () => this._noise(0.20, 0.05, 6000));
    }

    // =========================================================
    //  スキル攻撃SE
    // =========================================================

    // 「ドゴォン！」大振り単体
    attackSmash() {
        if (this._tryFile('attackSmash')) return;
        this._ensureCtx();
        this._sub(55, 0.18, 0.25);
        this._osc('sawtooth', 280, 30, 0.15, 0.22, 0.001, 0.04, 0.1, 0.10);
        this._noise(0.12, 0.28, 600, 'lowpass', 2);
        this._noise(0.06, 0.10, 3000);
        this._at(40, () => this._fm(200, 50, 150, 0.12, 0.08, 'sine', {a:0.002, d:0.04, s:0.0, r:0.06}));
    }

    // 「ボォォン…」全体爆発
    attackBlast() {
        if (this._tryFile('attackBlast')) return;
        this._ensureCtx();
        this._sub(40, 0.25, 0.20);
        this._osc('sawtooth', 300, 25, 0.22, 0.22, 0.002, 0.06, 0.1, 0.14);
        this._sweep(0.30, 0.22, 2000, 100, 'lowpass');
        this._at(60, () => {
            this._osc('sine', 60, 18, 0.25, 0.12, 0.003, 0.08, 0.0, 0.14);
            this._noise(0.15, 0.08, 500, 'lowpass');
        });
    }

    // 「ヒュン→ズバッ」精密射撃
    attackSnipe() {
        if (this._tryFile('attackSnipe')) return;
        this._ensureCtx();
        this._osc('square', 1400, 200, 0.08, 0.14, 0.001, 0.02, 0.0, 0.04);
        this._noise(0.05, 0.12, 5000);
        this._at(50, () => {
            this._osc('sine', 120, 40, 0.15, 0.10, 0.001, 0.04, 0.0, 0.10);
            this._noise(0.08, 0.14, 1500, 'bandpass', 4);
            this._sub(60, 0.10, 0.08);
        });
    }

    // 「シュシュシュッ」高速連打
    attackMulti() {
        if (this._tryFile('attackMulti')) return;
        this._ensureCtx();
        for (let i = 0; i < 3; i++) {
            this._at(i * 70, () => {
                this._osc('square', 650 + i*80, 180, 0.06, 0.12, 0.001, 0.015, 0.1, 0.03);
                this._noise(0.05, 0.10, 3500);
            });
        }
        this._at(220, () => {
            this._osc('sawtooth', 400, 50, 0.12, 0.18, 0.001, 0.04, 0.1, 0.08);
            this._noise(0.10, 0.14, 1500, 'bandpass', 3);
            this._sub(65, 0.10, 0.10);
        });
    }

    // 「ズシャァ」ライン斬撃
    attackLine() {
        if (this._tryFile('attackLine')) return;
        this._ensureCtx();
        this._sweep(0.20, 0.18, 6000, 400, 'bandpass');
        this._osc('sawtooth', 800, 80, 0.20, 0.14, 0.001, 0.04, 0.3, 0.12);
        this._sub(100, 0.15, 0.08);
        this._fm(350, 180, 200, 0.12, 0.08, 'sine', {a:0.001, d:0.03, s:0.1, r:0.08});
    }

    // 「ガシャーン」十字爆撃
    attackCross() {
        if (this._tryFile('attackCross')) return;
        this._ensureCtx();
        this._osc('sawtooth', 380, 35, 0.18, 0.20, 0.002, 0.05, 0.1, 0.10);
        this._noise(0.14, 0.20, 600, 'lowpass', 2);
        this._sub(50, 0.18, 0.15);
        this._at(30, () => {
            this._osc('sawtooth', 300, 30, 0.16, 0.18, 0.002, 0.04, 0.1, 0.10);
            this._noise(0.12, 0.16, 800, 'lowpass');
        });
        this._at(50, () => this._fm(150, 60, 120, 0.15, 0.08));
    }

    // 「ジュウゥゥ…」HP吸収
    attackVamp() {
        if (this._tryFile('attackVamp')) return;
        this._ensureCtx();
        this._osc('sine', 80, 500, 0.35, 0.10, 0.02, 0.10, 0.3, 0.20);
        this._layer(65, [
            {m:1, v:0.8, t:'sine'},
            {m:2, v:0.4, t:'triangle'},
            {m:3.1, v:0.15, t:'sine', det:-8},
            {m:5, v:0.06, t:'sine'}
        ], 0.10, {a:0.015, d:0.10, s:0.25, r:0.25});
        this._sweep(0.30, 0.06, 200, 3000, 'bandpass');
    }

    // 「シャキーン！」バフ
    attackBuff() {
        if (this._tryFile('attackBuff')) return;
        this._ensureCtx();
        this._layer(523, [
            {m:1, v:1.0, t:'sine'},
            {m:2, v:0.4, t:'sine', det:4},
            {m:3, v:0.15, t:'sine'},
            {m:4, v:0.06, t:'sine'}
        ], 0.12, {a:0.005, d:0.08, s:0.30, r:0.18});
        this._at(100, () => {
            this._layer(784, [
                {m:1, v:1.0, t:'sine'},
                {m:2, v:0.35, t:'sine', det:5},
                {m:3, v:0.10, t:'sine'}
            ], 0.11, {a:0.005, d:0.07, s:0.25, r:0.22});
        });
        this._at(60, () => this._fm(1200, 300, 400, 0.10, 0.06, 'sine', {a:0.002, d:0.03, s:0.1, r:0.05}));
        this._at(120, () => this._noise(0.08, 0.04, 6000));
    }

    // =========================================================
    //  状態異常SE
    // =========================================================

    // 「ズゥゥゥン…」デバフ
    attackDebuff() {
        if (this._tryFile('attackDebuff')) return;
        this._ensureCtx();
        this._layer(200, [
            {m:1, v:1.0, t:'sine', f1:80},
            {m:1.5, v:0.5, t:'triangle', f1:55},
            {m:0.5, v:0.6, t:'sine', f1:30}
        ], 0.18, {a:0.01, d:0.10, s:0.35, r:0.25});
        this._sweep(0.25, 0.08, 1000, 100, 'lowpass');
        this._sub(45, 0.20, 0.12);
    }

    // 「ジュワワワ…」毒の浸食
    attackPoison() {
        if (this._tryFile('attackPoison')) return;
        this._ensureCtx();
        this._sweep(0.25, 0.18, 4000, 500, 'bandpass');
        this._osc('sine', 300, 120, 0.20, 0.12, 0.005, 0.08, 0.3, 0.15);
        this._at(50, () => {
            for (let i = 0; i < 4; i++) {
                this._at(i * 40, () => {
                    const f = 400 + Math.random() * 300;
                    this._osc('sine', f, f * 0.5, 0.05, 0.06, 0.002, 0.015, 0.0, 0.03);
                });
            }
        });
    }

    // 「ガキィィン！」スタン
    attackStun() {
        if (this._tryFile('attackStun')) return;
        this._ensureCtx();
        this._fm(1400, 340, 800, 0.15, 0.14, 'sine', {a:0.001, d:0.04, s:0.15, r:0.10});
        this._fm(880, 200, 500, 0.12, 0.10, 'square', {a:0.001, d:0.03, s:0.10, r:0.08});
        this._noise(0.06, 0.12, 7000);
        this._sub(80, 0.08, 0.08);
        this._at(40, () => this._fm(600, 180, 300, 0.08, 0.06, 'sine', {a:0.001, d:0.02, s:0.0, r:0.05}));
    }

    // 「ポワワン…」睡眠
    attackSleep() {
        if (this._tryFile('attackSleep')) return;
        this._ensureCtx();
        this._layer(440, [
            {m:1, v:1.0, t:'sine', det:5, f1:220},
            {m:1.01, v:0.8, t:'sine', det:-5, f1:218},
            {m:2, v:0.20, t:'sine', f1:440},
            {m:0.5, v:0.3, t:'sine', f1:110}
        ], 0.10, {a:0.02, d:0.15, s:0.35, r:0.35});
        this._sweep(0.4, 0.03, 3000, 500, 'lowpass');
        this._at(200, () => {
            this._layer(330, [
                {m:1, v:0.7, t:'sine', det:3},
                {m:1.5, v:0.3, t:'sine', det:-3}
            ], 0.06, {a:0.02, d:0.10, s:0.2, r:0.30});
        });
    }

    // 「バチバチバチッ！」麻痺
    attackParalyze() {
        if (this._tryFile('attackParalyze')) return;
        this._ensureCtx();
        for (let i = 0; i < 5; i++) {
            this._at(i * 45, () => {
                const f = 800 + Math.random() * 600;
                this._fm(f, f * 0.7, f * 1.5, 0.04, 0.10 + Math.random() * 0.05,
                    'square', {a:0.001, d:0.01, s:0.0, r:0.02});
                this._noise(0.03, 0.08 + Math.random() * 0.04, 4000 + Math.random() * 2000);
            });
        }
        this._at(250, () => this._sub(80, 0.08, 0.10));
    }

    // 「シュウゥゥ…」暗闇
    attackBlind() {
        if (this._tryFile('attackBlind')) return;
        this._ensureCtx();
        this._sweep(0.35, 0.15, 2000, 60, 'lowpass');
        this._osc('sine', 250, 50, 0.30, 0.10, 0.01, 0.10, 0.2, 0.20);
        this._layer(150, [
            {m:1, v:0.6, t:'sine', f1:40},
            {m:1.5, v:0.3, t:'triangle', f1:30}
        ], 0.08, {a:0.02, d:0.12, s:0.2, r:0.20});
    }

    // 「ピロピロピロ…」混乱
    attackConfuse() {
        if (this._tryFile('attackConfuse')) return;
        this._ensureCtx();
        const sc = [262, 330, 392, 494, 523, 659, 784, 988];
        const tt = ['sine', 'triangle', 'square'];
        for (let i = 0; i < 8; i++) {
            this._at(i * 40, () => {
                const f = sc[Math.floor(Math.random() * sc.length)];
                this._osc(tt[i % 3], f, f * 0.7, 0.06, 0.08, 0.001, 0.015, 0.1, 0.03);
            });
        }
        this._at(100, () => this._fm(440, 330, 600, 0.20, 0.06, 'sine', {a:0.01, d:0.08, s:0.2, r:0.12}));
        this._at(200, () => this._noise(0.12, 0.04, 3000, 'bandpass', 6));
    }

    // =========================================================
    //  その他SE
    // =========================================================

    // 「ズガァン！」クリティカル
    criticalHit() {
        if (this._tryFile('criticalHit')) return;
        this._ensureCtx();
        this._sub(40, 0.20, 0.25);
        this._osc('square', 400, 60, 0.10, 0.22, 0.001, 0.02, 0.0, 0.07);
        this._noise(0.08, 0.25, 1200, 'lowpass', 2);
        this._at(30, () => this._fm(1600, 400, 600, 0.10, 0.10, 'sine', {a:0.001, d:0.03, s:0.0, r:0.06}));
    }

    // 「ヒュッ」ミス
    attackMiss() {
        if (this._tryFile('attackMiss')) return;
        this._ensureCtx();
        this._osc('sine', 800, 200, 0.10, 0.06, 0.002, 0.03, 0.1, 0.06);
        this._noise(0.08, 0.04, 4000);
    }

    // 「ドォォォン→…」撃破
    defeat() {
        if (this._tryFile('defeat')) return;
        this._ensureCtx();
        this._sub(35, 0.30, 0.30);
        this._osc('sine', 180, 8, 0.40, 0.25, 0.001, 0.05, 0.1, 0.30);
        this._sweep(0.50, 0.25, 1500, 50, 'lowpass');
        this._noise(0.15, 0.15, 800, 'lowpass');
        this._at(100, () => {
            for (let i = 0; i < 3; i++) {
                this._at(i * 50, () => {
                    const f = 200 + Math.random() * 400;
                    this._fm(f, f * 0.5, f, 0.08, 0.06, 'sine', {a:0.001, d:0.02, s:0.0, r:0.04});
                });
            }
        });
        
    }
    // 「バリバリ！」雷（登場演出）
    thunder() {
        if (this._tryFile('thunder')) return;
        this._ensureCtx();
        // ファイルがない場合の予備（プログラム音）
        this._sub(60, 0.1, 0.5);
        this._noise(0.4, 0.8, 200, 'lowpass');
        for(let i=0; i<3; i++) {
            this._at(i*50, () => this._noise(0.1, 0.3, 1000));
        }
    }

    // =========================================================
    //  双六移動SE (ファイルがない場合のフォールバック)
    // =========================================================

    // 「シュッ！」移動開始
    se_dash() {
        // ファイルがあればそれを再生
        if (this._tryFile('se_dash')) return;
        
        this._ensureCtx();
        // 風切り音のようなノイズ
        this._noise(0.15, 0.15, 800, 'highpass');
        // ピッチが上がるスライド音を重ねて加速感を出す
        this._slide(200, 600, 0.15);
    }

    // 「タッ」足音
    se_run() {
        // 再生して、その音源を this.runSource に保存しておく
        const src = this._tryFile('se_run');
        if (src) {
            this.runSource = src;
        } else {
            this._ensureCtx();
            this.runSource = this._noise(0.04, 0.08, 400, 'lowpass');
        }
    }
    // 「キュッ！」停止
    se_brake() {
        // ★ここが重要: 走っている音があれば強制停止！
        if (this.runSource) {
            try { this.runSource.stop(); } catch(e) {}
            this.runSource = null;
        }

        if (this._tryFile('se_brake')) return;
        this._ensureCtx();
        this._noise(0.12, 0.10, 2000, 'bandpass', 2);
        this._osc('square', 600, 100, 0.1, 0.05, 0.01, 0.05, 0, 0.04);
    }

    // =========================================================
    //  宝箱オープン演出音
    // =========================================================
    se_chest_open() {
        if (this._tryFile('se_chest_open')) return;
        this._ensureCtx();

        // 1. 「ギギーッ」重い蓋が開く音 (ノコギリ波で軋む音)
        this._osc('sawtooth', 60, 150, 0.3, 0.15);
        this._noise(0.3, 0.1, 200, 'lowpass');

        // 2. 「パァァーン！」輝く音 (少し遅らせて鳴らす)
        setTimeout(() => {
            // キラキラ感のある高音スライド
            this._slide(600, 1500, 0.6); 
            // ベルのような倍音
            this._osc('triangle', 1200, 1200, 0.5, 0.1); 
        }, 150); // 0.15秒後に鳴らす
    }

    // =========================================================
    //  エンカウント（敵出現・戦闘移行）演出音
    // =========================================================

    // 「ジャジャーン！＋ドドン！」敵出現
    se_enemy_appear() {
        if (this._tryFile('se_enemy_appear')) return;
        this._ensureCtx();
        // 低い打撃音
        this._sub(60, 0.5, 0.4);
        this._noise(0.4, 0.3, 800, 'lowpass');
        // 不穏な和音（不協和音気味）
        this._layer(180, [
            {m:1, v:1.0, t:'sawtooth'},
            {m:1.1, v:0.8, t:'sawtooth'},
            {m:1.5, v:0.5, t:'square'}
        ], 0.15, {a:0.05, d:0.1, s:0.4, r:0.5});
    }

    // 「シュイィィン！」画面切り替わり・戦闘開始
    se_encounter() {
        if (this._tryFile('se_encounter')) return;
        this._ensureCtx();
        // 空間が歪むような吸い込み音
        this._sweep(0.6, 0.15, 200, 3000, 'bandpass');
        this._slide(200, 2000, 0.6);
        // 金属的な響き
        this._fm(800, 400, 600, 0.6, 0.1, 'square', {a:0.1, d:0.2, s:0.2, r:0.3});
    }
    
}
