/**
 * scene_gacha.js - 本体＆レバー連動振動版
 */
class GachaScreen {
    constructor() {
        this.singleCost = 300;
        this.tenCost = 3000;
        this.cardSingleCost = 200;
        this.cardTenCost = 1800;
        this.gachaMode = 'unit'; // unit | card
        this.isModeSwitching = false;
        this.isFever = false;
        
        // 画像パス設定
        this.imgBody = 'images/gacha_body.webp';
        this.imgHandle = 'images/gacha_handle.webp';
        this.bgImage = 'images/bg_gacha.webp'; 

        this.raritySettings = [
            { code: 'UR',  minCost: 5, rate: 5,  label: 'UR (★5)' },
            { code: 'SSR', minCost: 4, rate: 15, label: 'SSR (★4)' },
            { code: 'SR',  minCost: 3, rate: 40, label: 'SR (★3)' },
            { code: 'R',   minCost: 1, rate: 40, label: 'R (★1~2)' }
        ];

        this.injectStyles();
    }

    onEnter() {
        this.updateUI();
        this.renderMachine();
        this.resetViews();
        
        if(!document.getElementById('gacha-detail-modal')) {
            const m = document.createElement('div');
            m.id = 'gacha-detail-modal';
            m.className = 'gacha-result-overlay';
            m.style.display = 'none';
            m.style.zIndex = '3100'; 
            m.onclick = (e) => { if(e.target === m) this.closeDetail(); };
            document.body.appendChild(m);
        }
    }

    resetViews() {
        ['gacha-result', 'gacha-rate-modal', 'gacha-detail-modal'].forEach(id => {
            const el = document.getElementById(id);
            if(el) { el.style.display = 'none'; el.innerHTML = ''; }
        });
        
        // アニメーションリセット
        const machine = document.getElementById('g-machine');
        const handle = document.querySelector('.g-handle-img');
        const body = document.querySelector('.g-body-img');
        
        // ★修正: マシン全体(wrapper)の揺れを止める
        if(machine) machine.classList.remove('gacha-shake');
        if(handle) handle.classList.remove('anim-pull');
        if(body) body.style.filter = ''; // フィルタもリセット
    }

    updateUI() {
        const gemEl = document.getElementById('gacha-gem-display');
        if(gemEl && app.data) gemEl.innerText = `💎 ${app.data.gems}`;
    }

    renderMachine() {
        const mainContainer = document.querySelector('.gacha-container');
        if(!mainContainer) return;

        const modeCaption = this.gachaMode === 'card' ? 'カード召喚モード' : '英雄召喚モード';

        // ★修正: wrapperにID 'g-machine' を付与
        mainContainer.innerHTML = `
            <div class="gacha-machine-wrapper mode-${this.gachaMode}" id="g-machine">
                <img src="${this.imgBody}" class="g-body-img" id="g-body">
                <div class="g-handle-wrapper">
                    <img src="${this.imgHandle}" class="g-handle-img" id="g-handle">
                </div>
                <div id="spit-layer" class="spit-layer"></div>
            </div>

            <div class="gacha-btn-area">
                <div class="gacha-mode-switch">
                    <button class="g-mode-btn ${this.gachaMode === 'unit' ? 'active' : ''}" onclick="app.gachaScreen.setMode('unit')">英雄召喚</button>
                    <button class="g-mode-btn ${this.gachaMode === 'card' ? 'active' : ''}" onclick="app.gachaScreen.setMode('card')">カード召喚</button>
                </div>
                <div class="gacha-mode-caption">${modeCaption}</div>
                <div class="g-btn-row">
                    <button class="gacha-btn" onclick="app.gachaScreen.playGacha(1)">
                        <div class="g-label">${this.gachaMode === 'card' ? 'カード1枚' : '1回召喚'}</div>
                        <div class="g-cost">💎${this.gachaMode === 'card' ? this.cardSingleCost : this.singleCost}</div>
                    </button>
                    <button class="gacha-btn ten-pull" onclick="app.gachaScreen.playGacha(10)">
                        <div class="g-label">${this.gachaMode === 'card' ? 'カード10連' : '10連召喚'}</div>
                        <div class="g-cost">💎${this.gachaMode === 'card' ? this.cardTenCost : this.tenCost}</div>
                    </button>
                </div>
                <div class="rate-link" onclick="app.gachaScreen.showRateList()">
                    [ 提供割合・排出リスト ]
                </div>
            </div>
            <div id="gacha-rate-modal" class="gacha-result-overlay" style="display:none;"></div>
        `;
    }

    spin() {
        const rand = Math.random() * 100;
        let cumulative = 0;
        let targetRarity = this.raritySettings[this.raritySettings.length - 1];

        for (const setting of this.raritySettings) {
            cumulative += setting.rate;
            if (rand < cumulative) {
                targetRarity = setting;
                break;
            }
        }
        
        const pool = DB.filter(u => {
            if (targetRarity.code === 'UR') return u.cost >= 5;
            if (targetRarity.code === 'SSR') return u.cost === 4;
            if (targetRarity.code === 'SR') return u.cost === 3;
            return u.cost < 3;
        });

        if (pool.length === 0) return DB[Math.floor(Math.random() * DB.length)];
        return pool[Math.floor(Math.random() * pool.length)];
    }

    async setMode(mode) {
        if (this.gachaMode === mode || this.isModeSwitching) return;
        this.isModeSwitching = true;
        if (app.sound) app.sound.tap();

        const currentMachine = document.getElementById('g-machine');
        if (currentMachine) {
            currentMachine.classList.add('machine-leave');
            await this.sleep(220);
        }

        this.gachaMode = mode;
        this.resetViews();
        this.renderMachine();
        this.updateUI();

        const nextMachine = document.getElementById('g-machine');
        if (nextMachine) {
            nextMachine.classList.add('machine-enter');
            requestAnimationFrame(() => nextMachine.classList.add('machine-enter-active'));
            setTimeout(() => {
                nextMachine.classList.remove('machine-enter', 'machine-enter-active');
            }, 260);
        }

        this.isModeSwitching = false;
    }

    async playGacha(count) {
        if (this.gachaMode === 'card') {
            return this.playCardGacha(count);
        }
        return this.playUnitGacha(count);
    }

    async playUnitGacha(count) {
        if (!app.data.consumeGems((count === 10) ? this.tenCost : this.singleCost)) {
            alert("ジェムが足りません！");
            return;
        }
        this.updateUI();

        const btns = document.querySelectorAll('.gacha-btn, .g-mode-btn');
        btns.forEach(b => b.disabled = true);

        const results = [];
        let maxRarityCode = 'R';
        for(let i=0; i<count; i++) {
            const base = this.spin();
            const unit = app.data.addUnit(base.id, true);
            results.push({ unit, isMax: false });
            if(base.cost >= 5) maxRarityCode = 'UR';
            else if(base.cost >= 4 && maxRarityCode !== 'UR') maxRarityCode = 'SSR';
        }
        app.data.saveStats();
        
        await this.runMachineAnimation(results, maxRarityCode);

        this.showCardRevealView(results);
        btns.forEach(b => b.disabled = false);
    }

    async playCardGacha(count) {
        if (!app.data || !app.data.cardManager) {
            alert('カードシステムが初期化されていません');
            return;
        }

        const cost = (count === 10) ? this.cardTenCost : this.cardSingleCost;
        if (!app.data.consumeGems(cost)) {
            alert('ジェムが足りません！');
            return;
        }
        this.updateUI();

        const btns = document.querySelectorAll('.gacha-btn, .g-mode-btn');
        btns.forEach(b => b.disabled = true);

        const drawCount = count;
        const results = [];
        let maxRarityCode = 'R';

        for (let i = 0; i < drawCount; i++) {
            const card = app.data.dropCard();
            if (!card) {
                alert('カード所持上限です。カード画面で整理してください。');
                break;
            }
            results.push({ card });
            if (card.level >= 16) maxRarityCode = 'UR';
            else if (card.level >= 11 && maxRarityCode !== 'UR') maxRarityCode = 'SSR';
        }

        if (results.length === 0) {
            btns.forEach(b => b.disabled = false);
            return;
        }

        await this.runMachineAnimation(results, maxRarityCode);
        this.showEquipCardRevealView(results);
        btns.forEach(b => b.disabled = false);
    }

  async runMachineAnimation(results, maxRarity) {
        const machine = document.getElementById('g-machine'); 
        const body = document.getElementById('g-body');       
        const handle = document.getElementById('g-handle');   
        
        // 1. レバーを下ろす
        app.sound.playTone(300, 'square', 0.1, 0.1);
        handle.classList.add('anim-pull');
        await this.sleep(500);
        
        // 2. マシン全体が震える
        app.sound.playTone(150, 'sawtooth', 0.8, 0.2);
        machine.classList.add('gacha-shake');
        
        // ▼▼▼▼▼ ここから変更 ▼▼▼▼▼
        
        // ★修正: 演出は最高レア(UR)の時のみ！
        if (maxRarity === 'UR') {
            await this.sleep(200);
            
            // 派手な爆発発動 (引数なしでOK)
            this.triggerExplosion(); 
            
            // UR演出: 本体発光＆サウンド
            body.style.filter = 'drop-shadow(0 0 15px #f0f) brightness(1.3)';
            app.sound.playTone(80, 'sawtooth', 1.0, 0.5);

            // 煙が充満するのを少し長く待つ
            await this.sleep(1200); 
        } else {
            // SSR以下はあっさり
            await this.sleep(400);
        }

        // ▲▲▲▲▲ ここまで変更 ▲▲▲▲▲

        // 3. カード排出
        for(let i=0; i<results.length; i++) {
            this.spitOutCard(this.getResultVisualCost(results[i]));
            const interval = (results.length === 1) ? 800 : 150; 
            await this.sleep(interval);
        }

        await this.sleep(500);

        // 終了処理
        handle.classList.remove('anim-pull');
        machine.classList.remove('gacha-shake'); 
        body.style.filter = '';
    }

  // ★修正: 煙と爆発をもっと派手に
    triggerExplosion() {
        const machine = document.getElementById('g-machine');
        if(!machine) return;

        // 1. フラッシュ（UR専用の強力な光）
        const flash = document.createElement('div');
        flash.className = 'gacha-flash-explosion flash-ur';
        machine.appendChild(flash);
        setTimeout(() => flash.remove(), 800);

        // 2. 煙パーティクル (数を40個に増量)
        const count = 40; 
        for(let i=0; i<count; i++) {
            const smoke = document.createElement('div');
            smoke.className = 'gacha-smoke';
            
            // 発生位置: 中央付近から少し広範囲に
            const startX = 140 + (Math.random() - 0.5) * 60;
            const startY = 220 + (Math.random() - 0.5) * 40;
            
            smoke.style.left = startX + 'px';
            smoke.style.top = startY + 'px';
            
            // ★変更点: さらに高く、激しく拡散
            // tx (横移動): -120px 〜 +120px
            const tx = (Math.random() - 0.5) * 240;
            
            // ty (縦移動): -300px 〜 -600px (画面上部まで突き抜ける勢い)
            const ty = -300 - Math.random() * 300; 
            
            smoke.style.setProperty('--tx', `${tx}px`);
            smoke.style.setProperty('--ty', `${ty}px`);
            
            // サイズを巨大化 (3倍〜7倍)
            const scale = 3 + Math.random() * 4;
            smoke.style.setProperty('--target-scale', scale);

            // アニメーション時間もランダムに (0.8s ~ 1.4s)
            const duration = 0.8 + Math.random() * 0.6;
            smoke.style.animationDuration = `${duration}s`;

            machine.appendChild(smoke);
            setTimeout(() => smoke.remove(), duration * 1000);
        }
    }

    spitOutCard(cost) {
        const layer = document.getElementById('spit-layer');
        const card = document.createElement('div');
        
        let className = 'flying-card';
        if(cost >= 5) className += ' fly-ur';
        else if(cost >= 4) className += ' fly-ssr';
        else className += ' fly-n';
        
        card.className = className;
        app.sound.tap();
        layer.appendChild(card);

        setTimeout(() => { card.remove(); }, 800);
    }

    getResultVisualCost(result) {
        if (result && result.unit && result.unit.base) {
            return result.unit.base.cost;
        }
        if (result && result.card) {
            const lv = result.card.level || 1;
            if (lv >= 16) return 5;
            if (lv >= 11) return 4;
            if (lv >= 6) return 3;
            return 2;
        }
        return 2;
    }

    showCardRevealView(results) {
        const resLayer = document.getElementById('gacha-result');
        resLayer.style.display = 'flex';
        resLayer.innerHTML = '';

        const container = document.createElement('div');
        container.className = 'reveal-container';
        if(results.length > 1) container.classList.add('grid-view');

        results.forEach((res, idx) => {
            const cardWrap = document.createElement('div');
            cardWrap.className = 'card-wrapper';
            
            cardWrap.onclick = () => {
                if(!cardWrap.classList.contains('flipped')) {
                    this.flipCard(cardWrap, res);
                } else {
                    this.openDetail(res.unit);
                }
            };

            const back = document.createElement('div');
            back.className = 'card-back';
            if(res.unit.base.cost >= 5) back.classList.add('back-ur');
            else if(res.unit.base.cost >= 4) back.classList.add('back-ssr');

            cardWrap.appendChild(back);
            container.appendChild(cardWrap);
        });

        const ctrlPanel = document.createElement('div');
        ctrlPanel.className = 'reveal-controls';
        
        const btnAll = document.createElement('button');
        btnAll.className = 'btn-mini btn-reveal-all';
        btnAll.innerText = '一括公開';
        btnAll.onclick = () => this.flipAll(results);

        const btnClose = document.createElement('button');
        btnClose.className = 'btn-red btn-result-close';
        btnClose.innerText = '閉じる';
        btnClose.style.display = 'none';
        btnClose.onclick = () => this.closeResult();

        this.closeBtnRef = btnClose; 

        ctrlPanel.appendChild(btnAll);
        ctrlPanel.appendChild(btnClose);

        resLayer.appendChild(container);
        resLayer.appendChild(ctrlPanel);
    }


    showEquipCardRevealView(results) {
        const resLayer = document.getElementById('gacha-result');
        resLayer.style.display = 'flex';
        resLayer.innerHTML = '';

        const container = document.createElement('div');
        container.className = 'reveal-container grid-view';

        results.forEach((res) => {
            const cardWrap = document.createElement('div');
            cardWrap.className = 'card-wrapper';
            cardWrap.onclick = () => {
                if (!cardWrap.classList.contains('flipped')) {
                    this.flipEquipCard(cardWrap, res);
                }
            };

            const back = document.createElement('div');
            back.className = 'card-back';
            const visualCost = this.getResultVisualCost(res);
            if (visualCost >= 5) back.classList.add('back-ur');
            else if (visualCost >= 4) back.classList.add('back-ssr');

            cardWrap.appendChild(back);
            container.appendChild(cardWrap);
        });

        const ctrlPanel = document.createElement('div');
        ctrlPanel.className = 'reveal-controls';

        const btnAll = document.createElement('button');
        btnAll.className = 'btn-mini btn-reveal-all';
        btnAll.innerText = '一括公開';
        btnAll.onclick = () => {
            const wraps = document.querySelectorAll('.card-wrapper');
            wraps.forEach((w, i) => {
                if (!w.classList.contains('flipped')) {
                    setTimeout(() => this.flipEquipCard(w, results[i]), i * 80);
                }
            });
        };

        const btnClose = document.createElement('button');
        btnClose.className = 'btn-red btn-result-close';
        btnClose.innerText = '閉じる';
        btnClose.style.display = 'none';
        btnClose.onclick = () => this.closeResult();

        this.closeBtnRef = btnClose;
        ctrlPanel.appendChild(btnAll);
        ctrlPanel.appendChild(btnClose);

        resLayer.appendChild(container);
        resLayer.appendChild(ctrlPanel);
    }

    flipEquipCard(wrapper, res) {
        if (wrapper.classList.contains('flipped')) return;
        wrapper.classList.add('flipped');
        app.sound.tap();

        const card = res.card;
        const cm = app.data.cardManager;
        const effect = CARD_EFFECTS[card.effectType];
        const rank = cm ? cm.getCardRank(card) : 'B';
        const iconPath = `images/icons/icon_${card.effectType}.webp`;

        const front = document.createElement('div');
        front.className = 'equip-card-front';
        front.style.backgroundImage = `url('images/card_bg_${card.color}.webp')`;
        front.innerHTML = `
            <div class="ecf-rank">${rank}</div>
            <div class="ecf-lv">Lv.${card.level}</div>
            <div class="ecf-icon" style="background-image:url('${iconPath}')"></div>
            <div class="ecf-name">${effect ? effect.name : card.effectType}</div>
        `;
        wrapper.appendChild(front);

        const allFlipped = document.querySelectorAll('.card-wrapper.flipped').length === document.querySelectorAll('.card-wrapper').length;
        if (allFlipped) this.showCloseButton();
    }

    flipCard(wrapper, res) {
        if(wrapper.classList.contains('flipped')) return;

        app.sound.tap();
        wrapper.classList.add('flipped');
        
        const u = res.unit;
        const front = document.createElement('div');
        front.className = `list-card type-${u.base.type} card-front`;
        
        const charImg = IMG_DATA[u.base.id] ? `url('${IMG_DATA[u.base.id]}')` : 'none';
        const bgImg = `url('${this.getCardBgUrl(u.base.type, u.base.cost)}')`;
        front.style.backgroundImage = `${charImg}, ${bgImg}`;

        let glowClass = '';
        if(u.base.cost >= 5) { glowClass = 'glow-rainbow'; app.sound.win(); } 
        else if(u.base.cost >= 4) { glowClass = 'glow-gold'; app.sound.heal(); }

        let gridHtml = '<div class="shape-icon">';
        u.base.shape.grid.forEach(bit => { 
            gridHtml += `<div class="shape-cell-dot ${bit?'on':''}"></div>`; 
        });
        gridHtml += '</div>';

        front.innerHTML = `
            <div class="result-halo ${glowClass}"></div>
            <div class="lc-header">${gridHtml}</div> <div class="lc-rarity">${'★'.repeat(u.base.cost)}</div>
            <div class="result-msg">${res.isMax ? "MAX!" : "UP!"}</div>
            <div class="result-name">${u.base.name}</div>
        `;
        
        wrapper.appendChild(front);

        const allFlipped = document.querySelectorAll('.card-wrapper.flipped').length === document.querySelectorAll('.card-wrapper').length;
        if(allFlipped) this.showCloseButton();
    }

    flipAll(results) {
        const wraps = document.querySelectorAll('.card-wrapper');
        wraps.forEach((w, i) => {
            if(!w.classList.contains('flipped')) {
                setTimeout(() => this.flipCard(w, results[i]), i * 100);
            }
        });
    }

    showCloseButton() {
        if(this.closeBtnRef) {
            this.closeBtnRef.style.display = 'inline-block';
            this.closeBtnRef.classList.add('popIn'); 
        }
        const revealBtn = document.querySelector('.btn-reveal-all');
        if(revealBtn) revealBtn.style.display = 'none'; 
    }

    closeResult() {
        app.sound.tap();
        document.getElementById('gacha-result').style.display = 'none';
        this.resetViews();
    }

    openDetail(unit) {
        app.sound.tap();
        const modal = document.getElementById('gacha-detail-modal');
        modal.innerHTML = '';
        modal.style.display = 'flex';
        
        const skill = unit.base.skill || {name:'なし', desc:'-'};
        const passive = unit.base.passive || {name:'-', desc:'-'};
        const abilities = unit.getAbilityStatus ? unit.getAbilityStatus() : [];
        
        const imgUrl = IMG_DATA[unit.base.id] ? `url('${IMG_DATA[unit.base.id]}')` : 'none';
        const bgUrl = this.getCardBgUrl(unit.base.type, unit.base.cost);

        
        const hpPct = Math.min(100, (unit.maxHp / 2500) * 100);
        const atkPct = Math.min(100, (unit.atk / 800) * 100);
        const spdPct = Math.min(100, (unit.spd / 30) * 100);
        const lvPct = (unit.save.lv / unit.save.maxLv) * 100;

        let abilityHtml = `<div class="f-ability-list-compact">`;
        abilities.forEach(ab => {
            const icon = ab.unlocked ? '🔓' : '🔒';
            const color = ab.unlocked ? '#fff' : '#666';
            abilityHtml += `<div class="f-ab-item-row" style="color:${color}"><span style="font-size:8px;">${icon}</span> ${ab.text}</div>`;
        });
        abilityHtml += `</div>`;

        const container = document.createElement('div');
        container.className = 'enhance-layout-panel popup-mode';
        container.style.overflow = 'visible'; 
        container.style.background = 'transparent';
        container.style.border = 'none';
        
        container.innerHTML = `
            <div class="popup-inner-mask" style="
                position: relative; width: 100%; height: 100%; overflow: hidden; border-radius: 6px;
                background: linear-gradient(to bottom, rgba(50,50,50,0.6), rgba(0,0,0,0.95)), url('${bgUrl}') center / 100% 100% no-repeat;
                border: 1px solid rgba(255,255,255,0.4);
                box-shadow: 0 0 20px #000;
            ">
                <div class="bg-particle-layer"></div>
                <div class="bg-glow-layer"></div>
                <div class="enh-flash-overlay"></div>

                <div class="enh-chara-layer anim-char-appear" style="background-image:${imgUrl}"></div>
                
                <div class="enh-ui-layer">
                    <div class="enh-header-area">
                        <div class="enh-info-left">
                            <div class="f-rarity-row">
                                <span class="f-rarity">${'★'.repeat(unit.base.cost)}</span>
                                <span class="f-type type-${unit.base.type}">${TYPES[unit.base.type].name}</span>
                            </div>
                            <div class="f-name large">${unit.base.name}</div>
                            <div class="f-lb-row"><span style="color:#0f0">NEW!</span></div>
                        </div>
                    </div>
                    
                    <div class="enh-footer-area">
                        <div class="enh-detail-grid">
                            
                            <div class="status-bar-row">
                                <div class="stat-cell">
                                    <div class="stat-bg-bar"><div class="stat-fill-bar" style="width:${lvPct}%; background:#d4af37;"></div></div>
                                    <div class="stat-content"><span class="lbl">LV</span> <span class="val">${unit.save.lv}</span></div>
                                </div>
                                <div class="stat-cell">
                                    <div class="stat-bg-bar"><div class="stat-fill-bar" style="width:${hpPct}%; background:#7f7;"></div></div>
                                    <div class="stat-content"><span class="lbl">HP</span> <span class="val" style="color:#bfb">${unit.maxHp}</span></div>
                                </div>
                                <div class="stat-cell">
                                    <div class="stat-bg-bar"><div class="stat-fill-bar" style="width:${atkPct}%; background:#f77;"></div></div>
                                    <div class="stat-content"><span class="lbl">ATK</span> <span class="val" style="color:#fbb">${unit.atk}</span></div>
                                </div>
                                <div class="stat-cell">
                                    <div class="stat-bg-bar"><div class="stat-fill-bar" style="width:${spdPct}%; background:#7ff;"></div></div>
                                    <div class="stat-content"><span class="lbl">SPD</span> <span class="val" style="color:#bff">${unit.spd}</span></div>
                                </div>
                            </div>

                            <div class="info-group">
                                <div class="f-section-compact c-skill">
                                    <div class="head">SKILL: ${skill.name}</div>
                                    <div class="desc">${skill.desc}</div>
                                </div>
                                <div class="f-section-compact c-passive">
                                    <div class="head">PASSIVE: ${passive.name || 'なし'}</div>
                                    <div class="desc">${passive.desc || '-'}</div>
                                </div>
                            </div>

                            <div class="f-section-compact c-ability">
                                <div class="head">LIMIT BREAK BONUS</div>
                                ${abilityHtml}
                            </div>

                        </div>
                        <div style="text-align:center; margin-top:5px;">
                            <button class="btn-red" onclick="app.gachaScreen.closeDetail()">閉じる</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        modal.appendChild(container);
    }
    
    getCardBgUrl(typeId, cost) {
        const colors = ['purple', 'gold', 'pink', 'green', 'blue', 'red'];
        const color = colors[typeId] || 'red';
        let rarity = 'r';
        if (cost >= 5) rarity = 'ur';
        else if (cost >= 3) rarity = 'sr';
        return `images/bg/bg_${color}_${rarity}.webp`;
    }

    closeDetail() {
        app.sound.tap();
        document.getElementById('gacha-detail-modal').style.display = 'none';
    }

    showRateList() {
        const modal = document.getElementById('gacha-rate-modal');
        modal.style.display = 'flex';

        if (this.gachaMode === 'card') {
            const colorWeights = (typeof CARD_DROP_CONFIG !== 'undefined') ? CARD_DROP_CONFIG.colorWeights : {};
            const levelWeights = (typeof CARD_DROP_CONFIG !== 'undefined') ? CARD_DROP_CONFIG.levelWeights : [];
            const colorRows = Object.entries(colorWeights).map(([k, v]) => `<li>${k}: ${v}%</li>`).join('');
            const levelRows = levelWeights.map(l => `<li>Lv${l.min}-${l.max}: ${l.weight}%</li>`).join('');
            modal.innerHTML = `
                <div style="background:#222; padding:20px; border:1px solid #fff; color:#fff; max-width:90%;">
                    <h3 style="margin-top:0;">カード召喚 提供割合</h3>
                    <div>色抽選</div>
                    <ul>${colorRows || '<li>設定なし</li>'}</ul>
                    <div>レベル抽選</div>
                    <ul>${levelRows || '<li>設定なし</li>'}</ul>
                    <button onclick="this.parentElement.parentElement.style.display='none'">閉じる</button>
                </div>`;
            return;
        }

        modal.innerHTML = `<div style="background:#222; padding:20px; border:1px solid #fff; color:#fff;">提供割合(省略)<br><button onclick="this.parentElement.parentElement.style.display='none'">閉じる</button></div>`;
    }

    sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    injectStyles() {
        if(document.getElementById('gacha-style-v17')) return; 
        const style = document.createElement('style');
        style.id = 'gacha-style-v17';
        style.innerHTML = `
            /* メイン画面背景 */
            #screen-gacha {
                background: linear-gradient(rgba(0,0,0,0.2), rgba(0,0,0,0.5)), url('${this.bgImage}') center/cover no-repeat !important;
            }
            .gacha-container {
                display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;
                overflow: hidden; 
                background: transparent !important; 
            }

            .gacha-mode-switch {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 8px;
                width: 100%;
                margin-bottom: 8px;
            }
            .gacha-mode-caption {
                margin: 2px 0 10px;
                font-size: 12px;
                color: #ffe082;
                font-weight: bold;
                text-align: center;
                text-shadow: 1px 1px 0 #000;
            }
            .g-mode-btn {
                border: 1px solid #666;
                border-radius: 16px;
                background: rgba(0,0,0,0.45);
                color: #ddd;
                padding: 6px 10px;
                font-size: 12px;
                font-weight: bold;
            }
            .g-mode-btn.active {
                background: rgba(255, 215, 0, 0.2);
                border-color: #ffd700;
                color: #fff;
            }
            .g-mode-btn:disabled { opacity: 0.6; }
            .equip-card-front {
                position: absolute;
                inset: 0;
                border: 2px solid #fff;
                border-radius: 4px;
                background-size: cover;
                background-position: center;
                overflow: hidden;
                transform: rotateY(180deg);
            }
            .ecf-rank, .ecf-lv, .ecf-name {
                position: absolute;
                background: rgba(0,0,0,0.72);
                color: #fff;
                font-weight: bold;
                text-shadow: 1px 1px 0 #000;
            }
            .ecf-rank { top: 4px; right: 4px; width: 42px; height: 42px; padding: 0; border-radius: 50%; border: 3px solid #fff; display:flex; align-items:center; justify-content:center; color: #fff; font-size: 28px; background: rgba(0,0,0,0.2); }
            .ecf-lv { top: 26px; left: 8px; padding: 2px 6px; border-radius: 6px; text-transform: lowercase; font-size: 16px; }
            .ecf-icon {
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 68%;
                height: 46%;
                background: center/contain no-repeat;
                filter: drop-shadow(0 2px 3px rgba(0,0,0,0.65));
            }
            .ecf-name { left: 0; right: 0; bottom: 0; padding: 6px; font-size: 11px; text-align: center; }

            /* --- マシン本体 --- */
            .gacha-machine-wrapper {
                position: relative;
                width: 280px; height: 350px;
                margin-top: -30px;
                display: flex; justify-content: center; align-items: center;
            }
            .gacha-machine-wrapper.mode-card {
                filter: hue-rotate(165deg) saturate(1.15);
            }
            .gacha-machine-wrapper.machine-leave {
                opacity: 0;
                transform: translateX(-28px) scale(0.92);
                transition: transform 0.22s ease, opacity 0.22s ease;
            }
            .gacha-machine-wrapper.machine-enter {
                opacity: 0;
                transform: translateX(32px) scale(0.92);
            }
            .gacha-machine-wrapper.machine-enter-active {
                opacity: 1;
                transform: translateX(0) scale(1);
                transition: transform 0.24s ease, opacity 0.24s ease;
            }
            .g-body-img {
                width: 100%; height: auto;
                position: relative; z-index: 5;
                filter: drop-shadow(0 10px 20px rgba(0,0,0,0.8));
            }
            .g-handle-wrapper {
                position: absolute; top: 170px; z-index: 10; right: -10px;
                width: 90px; height: 90px;
            }
            .g-handle-img {
                width: 100%; height: auto;
                transform-origin: 45px 45px; transition: transform 0.1s; filter: brightness(1.1);
            }

            .anim-pull { animation: leverAction 0.5s ease-in-out; }
            @keyframes leverAction { 0% { transform: rotate(0deg); } 50% { transform: rotate(180deg); } 100% { transform: rotate(0deg); } }
            
            /* 振動アニメーション (戦闘シーンと競合しない名前に) */
            .gacha-shake { animation: heavyShake 0.1s infinite; }
            @keyframes heavyShake { 0% { transform: translate(0, 0); } 25% { transform: translate(-3px, 3px); } 50% { transform: translate(3px, -2px); } 75% { transform: translate(-2px, -3px); } 100% { transform: translate(0, 0); } }
            /* ▼▼▼▼▼ ここから追加 ▼▼▼▼▼ */

          /* ▼▼▼▼▼ ここから変更（CSS部分） ▼▼▼▼▼ */

            /* ★爆発エフェクト（超巨大化） */
            .gacha-flash-explosion {
                position: absolute; top: 50%; left: 50%; width: 20px; height: 20px;
                background: #fff; border-radius: 50%;
                transform: translate(-50%, -50%);
                z-index: 15; pointer-events: none;
                box-shadow: 0 0 50px 20px #fff;
                animation: flashExpand 0.5s ease-out forwards;
            }
            .flash-ur { box-shadow: 0 0 50px 30px #f0f; background: #faffff; }

            @keyframes flashExpand {
                0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
                /* scale 30倍で画面全体を白く飛ばす */
                100% { transform: translate(-50%, -50%) scale(30); opacity: 0; } 
            }

            /* ★煙エフェクト（濃く、速く） */
            .gacha-smoke {
                position: absolute; width: 40px; height: 40px;
                background: radial-gradient(circle, #fff 10%, #ddd 40%, transparent 70%);
                border-radius: 50%; z-index: 14; pointer-events: none;
                opacity: 0;
                animation: smokeMove 1.0s ease-out forwards;
            }
            @keyframes smokeMove {
                0% { transform: translate(0,0) scale(0.5); opacity: 0.8; }
                20% { opacity: 1; } /* 一気に濃くなる */
                100% { 
                    transform: translate(var(--tx), var(--ty)) scale(var(--target-scale)); 
                    opacity: 0; 
                }
            }
            
            /* ▲▲▲▲▲ ここまで変更 ▲▲▲▲▲ */

            /* ▲▲▲▲▲ ここまで追加 ▲▲▲▲▲ */
            /* --- カード飛び出し (左へ) --- */
            .spit-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 2; }
            .flying-card {
                position: absolute; top: 60%; left: 45%; 
                width: 40px; height: 56px;
                background: #333; border: 2px solid #aaa; border-radius: 2px;
                background-image: repeating-linear-gradient(45deg, #333 0, #333 5px, #444 5px, #444 10px);
                box-shadow: 0 0 5px #000;
                animation: flyLeft 0.6s forwards cubic-bezier(0.1, 0.7, 1.0, 0.1);
                z-index: 20; 
            }
            .fly-ur { border-color: #f0f; box-shadow: 0 0 15px #f0f; }
            .fly-ssr { border-color: #ffd700; box-shadow: 0 0 15px #ffd700; }
            @keyframes flyLeft {
                0% { transform: translate(0, 0) scale(0.2) rotate(0deg); opacity: 0; }
                10% { opacity: 1; transform: translate(0, 0) scale(0.5) rotate(45deg); }
                100% { transform: translate(-300px, 100px) scale(1.5) rotate(-720deg); opacity: 0; }
            }

            .gacha-btn-area { margin-top: 20px; width: 100%; display: flex; flex-direction: column; align-items: center; z-index: 20; }
            .g-btn-row { display: flex; gap: 20px; }
            .gacha-btn {
                background: linear-gradient(#b71c1c, #500); border: 2px solid #ffd700; border-radius: 30px; color: #fff;
                width: 140px; height: 50px; cursor: pointer;
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                box-shadow: 0 5px 10px rgba(0,0,0,0.5);
            }
            .gacha-btn:active { transform: scale(0.95); }
            .gacha-btn:disabled { filter: grayscale(100%); opacity: 0.5; }

            /* --- 結果画面 --- */
            .gacha-result-overlay { 
                position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
                background: linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url('${this.bgImage}') center/cover no-repeat !important;
                z-index: 3000; 
                display: flex; flex-direction: column;
                align-items: center; justify-content: center;
                overflow-y: auto; 
            }
            
            .reveal-container { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; perspective: 1000px; flex-shrink: 0; }
            
            .reveal-container.grid-view { 
                display: grid; 
                grid-template-columns: repeat(5, 1fr);
                gap: 8px; 
                width: 98%; max-width: 600px; 
                padding: 10px;
                box-sizing: border-box;
                background: transparent;
            }
            
            .reveal-container.grid-view .card-wrapper { 
                width: 100%; height: auto; aspect-ratio: 3/4;
            }
            .reveal-container:not(.grid-view) .card-wrapper { width: 180px; height: 240px; }

            .card-wrapper { position: relative; transform-style: preserve-3d; transition: transform 0.6s; }
            .card-wrapper.flipped { transform: rotateY(180deg); }
            .card-back { position: absolute; width: 100%; height: 100%; backface-visibility: hidden; background: #333; border: 2px solid #aaa; border-radius: 4px; display: flex; align-items: center; justify-content: center; }
            .card-back::after { content: '?'; color: #666; font-weight: bold; font-size: 24px; }
            .card-front { position: absolute; width: 100%; height: 100%; backface-visibility: hidden; transform: rotateY(180deg); border: 2px solid #fff; background-size: cover, cover; background-position: top center, center; background-repeat: no-repeat; background-color: #222; }
            .back-ssr { border-color: #ffd700; box-shadow: 0 0 10px #ffd700; animation: pulseGold 1s infinite; }
            .back-ur { border-color: #f0f; box-shadow: 0 0 15px #f0f; animation: pulseRainbow 0.5s infinite; }
            @keyframes pulseGold { 50%{box-shadow:0 0 20px #ffd700;} }
            @keyframes pulseRainbow { 0%{border-color:red;} 50%{border-color:blue;} 100%{border-color:red;} }
            
            /* アイコン設定 */
            #gacha-result .shape-icon { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; width: 24px; height: 24px; }
            #gacha-result .shape-cell-dot { background: #444; } 
            #gacha-result .shape-cell-dot.on { background: #0f0; box-shadow: 0 0 2px #0f0; }
            #gacha-result .lc-header { 
                position: absolute; top: 5px; left: 5px; 
                background: rgba(0,0,0,0.8); 
                padding: 3px; border-radius: 4px; 
                width: auto; 
                display:flex; pointer-events:none; 
                border: 1px solid rgba(255,255,255,0.3);
            }
            #gacha-result .lc-rarity { position: absolute; bottom: 0; width: 100%; text-align: center; color: #ffd700; text-shadow: 1px 1px 0 #000; font-size: 10px; background: rgba(0,0,0,0.6); }
            
            .result-msg { position: absolute; top: 50%; width: 100%; text-align: center; transform: translateY(-50%) rotate(-20deg); font-weight: 900; color: #fff; text-shadow: 2px 2px 0 #f00; font-size: 14px; z-index: 10; pointer-events: none; }
            .result-name { position: absolute; bottom: -18px; width: 120%; left: -10%; text-align: center; font-size: 10px; color: #fff; white-space: nowrap; overflow:hidden; text-overflow:ellipsis; text-shadow: 1px 1px 0 #000; }
            .result-halo { position: absolute; top:0; left:0; width:100%; height:100%; pointer-events: none; }
            .glow-gold { box-shadow: inset 0 0 10px #ffd700; }
            .glow-rainbow { box-shadow: inset 0 0 10px #f0f; animation: rainbowGlow 2s infinite; }
            
            /* コントロールエリア */
            .reveal-controls { 
                position: static; 
                width: 100%; margin-top: 30px; 
                text-align: center;
                display: flex; justify-content: center; gap: 20px;
                z-index: 3100; pointer-events: auto;
                padding-bottom: 150px; 
            }
            .btn-reveal-all { font-size: 16px; padding: 10px 30px; border-radius: 20px; border: 1px solid #fff; background: #000; color: #fff; box-shadow: 0 0 10px #fff; }
            .btn-result-close { font-size: 16px; padding: 10px 40px; border-radius: 25px; box-shadow: 0 0 15px #f00; display: none; }
            .popIn { animation: popIn 0.3s forwards; }

            /* リッチ詳細ポップアップ用スタイル */
            .enhance-layout-panel.popup-mode {
                width: 90%; max-width: 400px;
                height: 600px;
                background: transparent;
                box-shadow: none;
                animation: popIn 0.3s;
                position: relative;
            }
            .popup-inner-mask {
                position: relative; width: 100%; height: 100%; overflow: hidden; border-radius: 6px;
                background-size: 100% 100%; 
            }
            .popup-mode .enh-chara-layer {
                top: 5px; height: 45%; 
                background-size: contain;
                background-position: center bottom;
                z-index: 2; position: absolute; width: 100%; background-repeat: no-repeat;
            }
            .anim-char-appear {
                animation: charAppearEpic 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards;
            }
            @keyframes charAppearEpic {
                0% { opacity: 0; transform: scale(1.5) translateY(20px); filter: brightness(3) blur(10px); }
                40% { opacity: 1; transform: scale(1) translateY(0); filter: brightness(1) blur(0px); }
                60% { transform: scale(1.05) translateY(-5px); filter: brightness(1.2); }
                100% { transform: scale(1) translateY(0); filter: brightness(1); }
            }
            .enh-flash-overlay {
                position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                background: white; z-index: 20; pointer-events: none;
                animation: flashBang 0.6s ease-out forwards;
                mix-blend-mode: overlay;
            }
            @keyframes flashBang { 0% { opacity: 1; } 100% { opacity: 0; } }
            
            .bg-particle-layer {
                position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1; pointer-events: none;
                background-image: radial-gradient(white, rgba(255,255,255,.4) 3px, transparent 6px), radial-gradient(white, rgba(255,255,255,.3) 2px, transparent 4px), radial-gradient(white, rgba(255,255,255,.2) 2px, transparent 5px);
                background-size: 400px 400px, 300px 300px, 200px 200px;
                background-position: 0 0, 0 0, 0 0;
                animation: bgParticles 15s linear infinite; opacity: 0.8; mix-blend-mode: screen;
            }
            @keyframes bgParticles { from { background-position: 0 0, 0 0, 0 0; } to { background-position: 400px 400px, 300px 300px, 200px 200px; } }
            .bg-glow-layer {
                position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1; pointer-events: none;
                background: radial-gradient(circle at center, rgba(255,255,255,0.4) 0%, transparent 80%);
                animation: bgGlowPulse 3s infinite alternate; mix-blend-mode: overlay;
            }
            @keyframes bgGlowPulse { 0% { opacity: 0.4; transform: scale(1); } 100% { opacity: 0.8; transform: scale(1.2); } }

            .enh-ui-layer { position: absolute; top:0; left:0; width:100%; height:100%; z-index: 10; display: flex; flex-direction: column; }
            .enh-header-area { padding: 10px; display: flex; justify-content: space-between; align-items: flex-start; }
            .f-rarity-row { font-size: 14px; margin-bottom: 2px; text-shadow: 0 0 5px #000; }
            .f-rarity { color: #ffd700; letter-spacing: -2px; margin-right: 5px; }
            .f-type { font-size: 10px; padding: 2px 6px; border-radius: 4px; background: #333; color: #fff; border: 1px solid #aaa; }
            .f-name.large { font-size: 24px; font-weight: 900; color: #fff; text-shadow: 0 0 10px #00ced1, 2px 2px 0 #000; margin-bottom: 2px; }
            .f-lb-row { font-size: 12px; font-weight: bold; }

            .enh-footer-area {
                margin-top: auto; 
                background: linear-gradient(to top, rgba(0,0,0,1) 70%, rgba(0,0,0,0.8) 90%, rgba(0,0,0,0));
                padding: 10px 10px 5px 10px;
                display: flex; flex-direction: column; justify-content: flex-end;
            }
            .enh-detail-grid { display: flex; flex-direction: column; gap: 3px; }
            
            .status-bar-row { display: flex; justify-content: space-between; gap: 4px; margin-bottom: 2px; }
            .stat-cell { flex: 1; position: relative; height: 20px; background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; overflow: hidden; }
            .stat-bg-bar { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; }
            .stat-fill-bar { height: 100%; opacity: 0.4; transition: width 0.5s ease-out; }
            .stat-content { position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: space-between; padding: 0 4px; z-index: 1; }
            .stat-cell .lbl { font-size: 8px; color: #ddd; font-weight: bold; }
            .stat-cell .val { font-size: 11px; font-weight: 900; font-family: monospace; text-shadow: 1px 1px 0 #000; }

            .f-section-compact { margin-bottom: 1px; padding: 3px 6px; border-radius: 4px; background: rgba(50,50,50,0.5); border-left: 2px solid #555; }
            .f-section-compact .head { font-size: 10px; font-weight: bold; margin-bottom: 1px; }
            .f-section-compact .desc { font-size: 10px; line-height: 1.2; color: #ccc; }
            .f-ability-list-compact { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; }
            .f-ab-item-row { font-size: 9px; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            
            @keyframes popIn { 0%{transform:scale(0.8);opacity:0;} 100%{transform:scale(1);opacity:1;} }
        `;
        document.head.appendChild(style);
    }
}