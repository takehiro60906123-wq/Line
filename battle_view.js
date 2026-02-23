/**
 * battle_view.js - 完全修正版 (Ver.23)
 * ・CSS定義を統合し、キャラ消失バグを修正
 * ・バフアイコン画像化に対応 (innerHTML使用)
 * ・HPバー位置：足元
 * ・ダメージ/回復：足元
 * ・バフ表示：頭上
 */

// ★追加: バフIDと画像パスの対応表
const BUFF_ICONS = {
    'INVINCIBLE':       'images/icons/buff_invincible.webp',
    'HALF_DMG':         'images/icons/buff_protect.webp',
    'ATK_UP':           'images/icons/buff_atk_up.webp',
    'DEF_UP':           'images/icons/buff_def_up.webp',
    'SPD_UP':           'images/icons/buff_spd_up.webp',
    'STATUS_RESIST_UP': 'images/icons/buff_resist.webp',
    'ATK_DOWN':         'images/icons/debuff_atk_down.webp',
    'POISON':           'images/icons/debuff_poison.webp',
    'STUN':             'images/icons/debuff_stun.webp',
    'SLEEP':            'images/icons/debuff_sleep.webp',
    'PARALYZE':         'images/icons/debuff_paralyze.webp',
    'BLIND':            'images/icons/debuff_blind.webp',
    'CONFUSE':          'images/icons/debuff_confuse.webp'
};

class BattleVisuals {
    constructor() {
        this.injectStyles();
    }

    initBattleStatusUI() {
        const screen = document.getElementById('screen-battle');
        if(!screen) return;

        // --- VS表記の削除 ---
        const allDivs = screen.querySelectorAll('div');
        allDivs.forEach(div => {
            if(div.textContent.trim() === 'VS') {
                div.style.display = 'none';
            }
        });

        // --- ステータスバー（敵） ---
        if(!document.getElementById('bs-top')) {
            const topBar = document.createElement('div');
            topBar.id = 'bs-top';
           topBar.className = 'battle-party-bar bs-merged';
            topBar.innerHTML = `
               <div class="party-panel party-player-panel">
                    <div class="party-label">プレイヤーパーティー</div>
                    <div id="party-player-icons" class="party-icons"></div>
                </div>
                <div class="party-panel party-enemy-panel">
                    <div class="party-label">エネミーパーティー</div>
                    <div id="party-enemy-icons" class="party-icons"></div>
                </div>
            `;
            screen.insertBefore(topBar, screen.firstChild);
        }

        // --- ステータスバー（味方） ---
         const oldBottomBar = document.getElementById('bs-bot');
        if (oldBottomBar) oldBottomBar.remove();

        // --- コントロールバー ---
        if(!document.getElementById('battle-ctrl-bar')) {
            const oldSpeed = document.getElementById('btn-speed');
            if(oldSpeed) oldSpeed.style.display = 'none';
            
            const oldRetreatBtns = screen.querySelectorAll('button');
            oldRetreatBtns.forEach(btn => {
                if(btn.innerText.includes('撤退') || btn.getAttribute('onclick')?.includes('backToEdit')) {
                    btn.style.display = 'none';
                }
            });

            const ctrlBar = document.createElement('div');
            ctrlBar.id = 'battle-ctrl-bar';
            ctrlBar.className = 'battle-ctrl-bar';
             // ▼操作バーの位置はここで指定（px）
            const ctrlBarBottom = 88;
            ctrlBar.style.setProperty('--ctrl-bar-bottom', `${ctrlBarBottom}px`);

    
            
            const btnSpd = document.createElement('button');
            btnSpd.className = 'b-ctrl-btn btn-spd';
            btnSpd.onclick = () => { if(window.toggleSpeed) window.toggleSpeed(); }; 
            btnSpd.innerHTML = `<span class="c-icon">⏩</span> <span id="new-speed-val">x1.0</span>`;
            
            const btnRet = document.createElement('button');
            btnRet.className = 'b-ctrl-btn btn-ret';
            btnRet.onclick = () => { if(window.backToEdit) window.backToEdit(); };
            btnRet.innerHTML = `<span class="c-icon">🏳️</span> 撤退`;

            ctrlBar.appendChild(btnSpd);
            ctrlBar.appendChild(btnRet);
            screen.appendChild(ctrlBar);
        }
    }

    updateBattleStatus(units) {
        if(!units) return;

       this.renderPartyIcons('enemy', units.filter(u => u.side === 'enemy'));
        this.renderPartyIcons('player', units.filter(u => u.side === 'player'));

        this.updateBuffAuras(units);
    }

    renderPartyIcons(side, units) {
        const holder = document.getElementById(side === 'enemy' ? 'party-enemy-icons' : 'party-player-icons');
        if (!holder) return;

       const grid = Array.from({ length: 2 }, () => Array(4).fill(null));
        const sorted = [...units].sort((a, b) => (a.anchorIdx || 0) - (b.anchorIdx || 0));

        sorted.forEach(u => {
            const anchor = u.anchorIdx || 0;
            const r = Math.floor(anchor / 4);
            const c = anchor % 4;
            const sw = Math.max(1, Math.min(2, (u.base.shape && u.base.shape.w) || 1));
            const sh = Math.max(1, Math.min(2, (u.base.shape && u.base.shape.h) || 1));

            for (let rr = r; rr < Math.min(2, r + sh); rr++) {
                for (let cc = c; cc < Math.min(4, c + sw); cc++) {
                    grid[rr][cc] = {
                        u,
                        root: rr === r && cc === c,
                        originR: r,
                        originC: c,
                        sw,
                        sh
                    };
                }
            }
        });
         const renderUnitIcon = (u, sw, sh) => {
            const hasImage = (typeof IMG_DATA !== 'undefined' && !!IMG_DATA[u.base.id]);
            const hpRate = Math.max(0, Math.min(100, (u.battleHp / u.maxHp) * 100));
            const chargeMax = u.chargeMax || 99;
            const hasSkill = !(chargeMax >= 99 || !u.base.skill || u.base.skill.type === 'NONE');
            const remain = hasSkill ? Math.max(0, chargeMax - (u.chargeCount || 0)) : '';
const shapeBadge = (sw > 1 || sh > 1) ? `<span class="party-shape-badge">${sw}x${sh}</span>` : '';
            return `
                    <div class="party-icon ${u.isDead ? 'is-dead' : ''} span-w-${sw}">
                    <div class="party-icon-image" style="${hasImage ? `background-image:url('${IMG_DATA[u.base.id]}')` : ''}">
                        ${hasImage ? '' : `<span class="party-icon-fallback">${u.base.name}</span>`}
                    </div>
                    ${shapeBadge}
                    <div class="party-icon-ui">
                        <div class="party-hp-track"><div class="party-hp-fill ${side}" style="width:${hpRate}%"></div></div>
                    </div>
                    ${hasSkill ? `<div class="party-skill-count">${remain}</div>` : ''}
                </div>
            `;
        };

         const renderRow = (rowIdx) => {
            const cells = [];
            for (let c = 0; c < 4; c++) {
                const occ = grid[rowIdx][c];
                if (!occ) {
                    cells.push('<div class="party-slot-empty"></div>');
                    continue;
                }

                if (occ.root) {
                    cells.push(renderUnitIcon(occ.u, occ.sw, occ.sh));
                    c += occ.sw - 1;
                    continue;
                }

                const isVerticalStart = rowIdx > occ.originR && c === occ.originC;
                if (isVerticalStart) {
                    cells.push(`<div class="party-icon-cont span-w-${occ.sw}"><span>↕ ${occ.sw}x${occ.sh}</span></div>`);
                    c += occ.sw - 1;
                }
            }
            return cells.join('');
        };

        holder.innerHTML = `
            <div class="party-row party-row-front">
                <div class="party-row-label">前列</div>
             <div class="party-row-icons">${renderRow(0)}</div>
            </div>
            <div class="party-row party-row-back">
                <div class="party-row-label">後列</div>
                <div class="party-row-icons">${renderRow(1)}</div>
            </div>
        `;
    }

    initBoard(units) {
        this.initBattleStatusUI();

        const pBoard = document.getElementById('player-board');
        const eBoard = document.getElementById('enemy-board');
        
        [pBoard, eBoard].forEach(b => {
            if(!b) return;
            b.innerHTML = ''; 
            b.style.position = 'relative';
            b.style.width = '340px'; 
            b.style.height = '220px'; 
            b.style.margin = '0 auto';
        });

        units.forEach(u => this.createUnitElement(u));
        this.fitToScreen();
        window.onresize = () => this.fitToScreen();
    }

    createUnitElement(u) {
        const con = (u.side === 'player') ? document.getElementById('player-board') : document.getElementById('enemy-board');
        if(!con) return;

        const container = document.createElement('div');
        const shapeCode = (u.base.shape && u.base.shape.code) ? u.base.shape.code : '1x1';
        container.className = `unit-container size-${shapeCode}`;
        
        if (u.base.cost >= 5) {
            container.classList.add('rarity-5');
        } else if (u.base.cost === 4) {
            container.classList.add('rarity-4');
        }
        
        container.style.opacity = '0';
        container.dataset.side = u.side;

        let innerHTML = '<div class="unit-shadow"></div>';
        const imgId = 'u-img-' + u.uid; 
        
        innerHTML += `<div class="unit-img-box type-${u.base.type} side-${u.side}" id="${imgId}"></div>`;
        innerHTML += `<div class="battle-ui-layer"><div class="hp-plate"><div class="hp-fill" style="width:100%"></div></div></div>`;
        innerHTML += `<div class="charge-countdown"></div>`;
        innerHTML += `<div class="hp-num"></div>`;

        container.innerHTML = innerHTML;

        const imgBox = container.querySelector('.unit-img-box');
        if(typeof IMG_DATA !== 'undefined' && IMG_DATA[u.base.id]) {
            imgBox.style.backgroundImage = "url('" + IMG_DATA[u.base.id] + "')";
        } else {
            imgBox.innerHTML = '<div class="no-img-text">' + u.base.name + '</div>';
        }

        const r = Math.floor(u.anchorIdx / 4); 
        const c = u.anchorIdx % 4;             
        
        const colW = 80;      
        const rowStep = 72;   
        const cellH = 90;     
        const offsetX = 10;   

        const sw = u.base.shape.w || 1;
        const sh = u.base.shape.h || 1;

        let elW = 100; let elH = 120; 
        if (shapeCode === 'V1x2') { elW = 100; elH = 210; }
        if (shapeCode === 'H2x1') { elW = 180; elH = 120; }
        if (shapeCode === 'L2x2') { elW = 180; elH = 210; }

        let gridCenterX, gridCenterY;
        gridCenterX = offsetX + (c * colW) + (sw * colW / 2);

        if (u.side === 'player') {
            const topBase = -50;
            const startY = r * rowStep;
            const endY = (r + sh - 1) * rowStep;
            gridCenterY = topBase + (startY + endY + cellH) / 2;
            u.baseZIndex = (r + sh - 1) * 10; 
        } else {
            const topBase = 10;
            const y_row0 = rowStep; 
            const y_row1 = 0;       
            let occupiedY1 = (r === 0) ? y_row0 : y_row1; 
            let occupiedY2 = occupiedY1;
            if (sh > 1) { occupiedY1 = y_row0; occupiedY2 = y_row1; }

            gridCenterY = topBase + (occupiedY1 + occupiedY2 + cellH) / 2;
            const frontRow = (sh > 1) ? 0 : r; 
            u.baseZIndex = (1 - frontRow) * 10; 
        }

        const left = gridCenterX - (elW / 2);
        const top = gridCenterY - (elH / 2);

        container.style.left = left + 'px';
        container.style.top = top + 'px';
        container.style.zIndex = u.baseZIndex;
        
        u.elem = container; 
        u.imgElem = imgBox; 
        u.uiElem = container.querySelector('.battle-ui-layer');
        u.hpTxtElem = container.querySelector('.hp-num');

        con.appendChild(container);
    }

    async playEntrance(side) {
        const boardId = (side === 'player') ? 'player-board' : 'enemy-board';
        const board = document.getElementById(boardId);
        if(!board) return;

        const thunder = document.createElement('div');
        thunder.className = 'lightning-bolt';
        board.appendChild(thunder);

        if(typeof app !== 'undefined' && app.sound) {
            app.sound.thunder();
        }

        await new Promise(r => setTimeout(r, 150)); 

        const units = board.querySelectorAll(`.unit-container[data-side="${side}"]`);
        units.forEach(u => {
            u.style.animation = 'unitAppear 0.4s ease-out forwards';
        });

        const flash = document.createElement('div');
        flash.className = 'lightning-flash';
        board.appendChild(flash);

        setTimeout(() => {
            if(thunder.parentNode) thunder.remove();
            if(flash.parentNode) flash.remove();
        }, 1000);

        await new Promise(r => setTimeout(r, 600));
    }

    async playPassiveEffect(logs) {
        if(!logs || logs.length === 0) return;

        for(const log of logs) {
            let imgUrl = null;
            if(typeof IMG_DATA !== 'undefined' && IMG_DATA[log.actor.base.id]) {
                imgUrl = IMG_DATA[log.actor.base.id];
            }
            this.cutin(log.actor.side, log.name, log.desc, imgUrl);
            
            if(typeof app !== 'undefined' && app.sound) app.sound.attackBuff();
            if(log.actor.imgElem) {
                log.actor.imgElem.style.filter = "brightness(2)";
                setTimeout(() => log.actor.imgElem.style.filter = "", 300);
            }
            await new Promise(r => setTimeout(r, 500));

            log.targets.forEach(t => {
                this.showBuffIcon(t.elem, "UP");
                this.updateHp(t, true);
                if(t.imgElem) {
                    t.imgElem.classList.remove('anim-buff');
                    void t.imgElem.offsetWidth;
                    t.imgElem.classList.add('anim-buff');
                }
            });
            await new Promise(r => setTimeout(r, 800)); 
        }
    }

    // battle_view.js 内

    showBuffIcon(el, typeOrText) {
        if(!el) return;
        
        const d = document.createElement('div');
        const iconPath = BUFF_ICONS[typeOrText]; 

        if (iconPath) {
            d.className = 'buff-pop-img';
            d.innerHTML = `<img src="${iconPath}" alt="${typeOrText}">`;
        } else {
            d.className = 'buff-pop';
            d.innerText = typeOrText + "▲";
        }
        
        const r = el.getBoundingClientRect();
        
        // ★修正: 1.5倍サイズ(72px)に合わせて位置調整
        // width 72px の半分 = 36px を引いて中央に
        d.style.left = (r.left + r.width/2 - 36) + 'px';
        
        // 少し大きくなるので、表示開始位置も少し上に調整
        d.style.top = (r.top - 40) + 'px'; 
        
        document.body.appendChild(d);
        setTimeout(() => d.remove(), 1200);
    }

    fitToScreen() {
        const pBoard = document.getElementById('player-board');
        const eBoard = document.getElementById('enemy-board');
        const screenWidth = window.innerWidth;
        let scale = screenWidth / 340;
        
        [pBoard, eBoard].forEach(b => {
            if(b) {
                b.style.transformOrigin = 'center top';
                b.style.transform = 'scale(' + scale + ')';
                b.style.marginBottom = ((scale - 1) * 120) + 'px'; 
            }
        });
    }

    updateHp(u, showTemp) {
        if(!u.uiElem) return;
        const bar = u.uiElem.querySelector('.hp-fill');
        const txt = u.hpTxtElem;
        const pct = Math.max(0, u.battleHp / u.maxHp * 100);
        
        if(bar) {
            bar.style.width = pct + '%';
            if(u.side === 'player') bar.style.background = '#00bfff';
            else bar.style.background = '#ff4444'; 
        }
        if(txt) txt.innerText = u.battleHp; 

        if(showTemp && !u.isDead) {
            u.uiElem.classList.add('show');
            txt.classList.add('show');
            if(u.elem) u.elem.style.zIndex = 500;

            if(u.hpTimer) clearTimeout(u.hpTimer);
            u.hpTimer = setTimeout(() => {
                if(u.uiElem && u.hpTxtElem) {
                    u.uiElem.classList.remove('show');
                    txt.classList.remove('show');
                    if(u.elem) u.elem.style.zIndex = u.baseZIndex;
                }
            }, 2000); 
        }
    }

    updateCharge(u) {
        if(!u || !u.elem) return;
        const cd = u.elem.querySelector('.charge-countdown');
        if(!cd) return;
        // 要望対応: 戦闘中ユニット上のチャージ表示は非表示
        cd.style.display = 'none';
    }

    setDead(u) {
        if(u.elem) {
            u.elem.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-in';
            u.elem.style.opacity = '0';
            u.elem.style.transform = 'scale(0.8)';
            u.elem.style.pointerEvents = 'none';

            setTimeout(() => {
                if(u.elem) u.elem.style.display = 'none';
            }, 500);
        }

        if(u.uiElem) u.uiElem.style.opacity = 0;
        if(u.hpTxtElem) u.hpTxtElem.style.opacity = 0;
        const cdElem = u.elem ? u.elem.querySelector('.charge-countdown') : null;
        if(cdElem) cdElem.style.display = 'none';
    }

    setAttackMotion(actor, active) {
        if(!actor.imgElem) return;
        if(active) {
            const moveY = (actor.side === 'player') ? -30 : 30;
            actor.elem.style.zIndex = 1000;
            actor.imgElem.style.transition = 'transform 0.15s cubic-bezier(0.1, 0.9, 0.2, 1)';
            actor.imgElem.style.transform = `translateY(${moveY}px) scale(1.4)`;
        } else {
            actor.imgElem.style.transition = 'transform 0.3s ease-out';
            actor.imgElem.style.transform = 'translateY(0) scale(1)';
            setTimeout(() => {
                if(actor.elem) actor.elem.style.zIndex = actor.baseZIndex;
            }, 300);
        }
    }

    playHitEffect(target) {
        if (target.imgElem) {
            target.imgElem.classList.remove('anim-shake');
            void target.imgElem.offsetWidth; 
            target.imgElem.classList.add('anim-shake'); 

            let flashCount = 0;
            const interval = setInterval(() => {
                target.imgElem.style.filter = (flashCount % 2 === 0) ? "brightness(5)" : "brightness(1)";
                flashCount++;
                if (flashCount >= 6) {
                    clearInterval(interval);
                    target.imgElem.style.filter = "";
                }
            }, 50);
        }
    }

    playDodgeMotion(u) {
        if(u.imgElem) {
            u.imgElem.classList.remove('anim-dodge');
            void u.imgElem.offsetWidth;
            u.imgElem.classList.add('anim-dodge');
        }
    }

    /**
     * showVal - 修正版
     * ・HPバーの少し上（足元付近）に表示
     * ・回復テキストもダメージと同じ位置（中央ランダム）に変更
     */
    showVal(el, val, arg3, arg4) { 
        if(!el) return;
        
        let flags = {};
        if (typeof arg3 === 'object') {
            flags = arg3;
        } else {
            flags = { crit: arg3, heal: arg4 };
        }

        const d = document.createElement('div'); 
        let cName = 'dmg-pop';
        
        if (flags.crit) cName += ' crit';
        if (flags.heal) cName += ' heal';
        if (flags.weak) cName += ' weak';
        if (flags.resist) cName += ' resist';
        
        d.className = cName;
        
        let text = val;
        if(flags.heal) text = "+" + val;
        if(flags.weak) text = val + "\nWEAK!";
        if(flags.resist) text = val + "\nResist";

        d.innerText = text; 
        d.setAttribute('data-text', text); 

        // 座標計算
        const r = el.getBoundingClientRect(); 
        
        // 基本X座標（中央）
        let posX = r.left + r.width/2 - 20; 
        
        // ★修正: 基本Y座標を「足元（HPバー）の少し上」に設定
        let posY = r.bottom - 50; 

        // 文字列（数値以外＝MISSやバフ名など）の場合のみ、位置をずらす
        if (typeof val === 'string' && isNaN(val)) {
            posX -= 60; 
            posY -= 30; 
        } 
        else {
            // ダメージ・回復は中央付近でランダムに少しばらつかせる
            posX += (Math.random() - 0.5) * 30; 
            posY += (Math.random() - 0.5) * 20;
        }

        d.style.left = posX + 'px'; 
        d.style.top = posY + 'px'; 
        
        document.body.appendChild(d); 
        
        setTimeout(() => { if(d && d.parentNode) d.remove(); }, 2500); 
    }

    updateOrder(queue, current) {
        // 行動順バー撤去のため何もしない
    }

    cutin(side, mainText, subText, imgUrl) { 
        const l = document.getElementById('cutin-layer'); 
        if(!l) return;
        const d = document.createElement('div'); 
        const cls = 'cutin-box ' + (side==='player' ? 'cp' : 'ce');
        d.className = cls;
        let contentHtml = `<div class="cutin-text-wrap"><div class="cutin-main">${mainText}</div>${subText ? `<div class="cutin-sub">${subText}</div>` : ''}</div>`;
        if(imgUrl) contentHtml += `<div class="cutin-img" style="background-image:url(${imgUrl})"></div>`;
        d.innerHTML = contentHtml; 
        l.appendChild(d); 
        setTimeout(() => { if(d && d.parentNode) d.remove(); }, 2200); 
    }

    // ★バフオーラ更新: ユニットのバフ状態に応じてオーラCSSを付与
    updateBuffAuras(units) {
        if (!units) return;
        const AURA_MAP = {
            'INVINCIBLE':       'buff-aura-gold',
            'HALF_DMG':         'buff-aura-green',
            'DEF_UP':           'buff-aura-blue',
            'SPD_UP':           'buff-aura-cyan',
            'STATUS_RESIST_UP': 'buff-aura-purple'
        };
        const ALL_AURAS = Object.values(AURA_MAP);

        for (const u of units) {
            if (!u.elem || u.isDead) {
                if (u.elem) ALL_AURAS.forEach(a => u.elem.classList.remove(a));
                continue;
            }

            const activeBuffs = new Set();
            if (u.statusEffects) {
                for (const se of u.statusEffects) {
                    if (AURA_MAP[se.type]) activeBuffs.add(AURA_MAP[se.type]);
                }
            }

            ALL_AURAS.forEach(a => u.elem.classList.remove(a));
            const priority = ['buff-aura-gold', 'buff-aura-green', 'buff-aura-blue', 'buff-aura-cyan', 'buff-aura-purple'];
            for (const p of priority) {
                if (activeBuffs.has(p)) {
                    u.elem.classList.add(p);
                    break;
                }
            }

            let existing = u.elem.querySelector('.buff-status-icons');
            const icons = this.getBuffIcons(u);
            if (icons) {
                if (!existing) {
                    existing = document.createElement('div');
                    existing.className = 'buff-status-icons';
                    u.elem.appendChild(existing);
                }
                // ★修正: 画像タグを含むため innerHTML を使用
                existing.innerHTML = icons; 
            } else if (existing) {
                existing.remove();
            }
        }
    }

    getBuffIcons(u) {
        if (!u.statusEffects || u.statusEffects.length === 0) return '';
        
        let html = '';
        for (const se of u.statusEffects) {
            // 定数リストに画像パスがあるかチェック
            const iconPath = BUFF_ICONS[se.type];
            
            if (iconPath) {
                // 画像がある場合
                html += `<img src="${iconPath}" class="status-icon-img" alt="${se.type}">`;
            } else {
                // 画像がない場合の予備（必要なら実装）
            }
        }
        return html;
    }

    injectStyles() {
        if(document.getElementById('battle-style-v21')) return;
        const style = document.createElement('style');
        style.id = 'battle-style-v21';
        style.innerHTML = `
            #screen-battle { background: url('images/bg_battle.webp') no-repeat center bottom / cover !important; position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 100; display: none; flex-direction: column; overflow: hidden; }
            #screen-battle.active { display: flex !important; }
            
            .battle-field { flex: 1; width: 100%; position: relative; display: flex; flex-direction: column; justify-content: space-between; padding: 10px 0 100px 0; }
            
            .battle-party-bar { width: 100%; min-height: 110px; background: linear-gradient(180deg, rgba(0,35,55,0.88), rgba(0,20,35,0.82)); border-top: 2px solid #27d7ff; border-bottom: 2px solid #27d7ff; box-shadow: 0 6px 14px rgba(0,0,0,0.45); display: flex; justify-content: space-between; align-items: stretch; padding: 6px 8px; box-sizing: border-box; color: #fff; z-index: 50; gap: 8px; }
            .party-panel { width: calc(50% - 4px); display: flex; flex-direction: column; gap: 3px; padding: 2px 4px; border-radius: 6px; }
          .party-player-panel { border: 1px solid rgba(70,220,255,0.6); }
            .party-enemy-panel { border: 1px solid rgba(255,140,140,0.6); }
            
              .party-label { font-weight: 900; font-size: 12px; letter-spacing: 1px; white-space: nowrap; text-shadow: 0 0 5px #000; }
            .party-player-panel .party-label { color: #7bf7ff; text-align: right; }
            .party-enemy-panel .party-label { color: #ff9b9b; text-align: left; }
            .party-icons { flex: 1; display: flex; flex-direction: column; gap: 4px; justify-content: center; padding: 0; }
            .party-row { display: flex; align-items: center; gap: 6px; min-height: 42px; }
            .party-player-panel .party-row { flex-direction: row-reverse; }
            .party-row-label { width: 26px; font-size: 10px; font-weight: 700; color: #ddd; text-align: center; letter-spacing: 1px; }
              .party-row-icons { flex: 1; display: grid; grid-template-columns: repeat(4, 40px); gap: 6px; align-items: center; justify-content: flex-start; min-height: 40px; }
            .party-player-panel .party-row-icons { justify-content: end; }
            .party-enemy-panel .party-row-icons { justify-content: start; }
            .party-slot-empty { width: 40px; height: 40px; border: 1px dashed rgba(255,255,255,0.15); border-radius: 6px; background: rgba(255,255,255,0.04); }
            .party-icon { position: relative; width: 40px; height: 40px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.45); background: #111; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.45); }
            .party-icon.span-w-2, .party-icon-cont.span-w-2 { width: 86px; grid-column: span 2; }
            .party-icon.is-dead { filter: grayscale(1) brightness(0.45); }
            .party-icon-image { width: 100%; height: 100%; background-size: cover; background-position: center; }
            .party-icon-fallback { display: flex; width: 100%; height: 100%; align-items: center; justify-content: center; text-align: center; font-size: 8px; font-weight: bold; padding: 2px; }
               .party-shape-badge { position: absolute; left: 2px; top: 2px; font-size: 8px; font-weight: 900; padding: 0 3px; border-radius: 3px; color: #fff; background: rgba(20,20,20,0.85); border: 1px solid rgba(255,255,255,0.7); }
            .party-icon-cont { height: 40px; border-radius: 6px; border: 1px dashed rgba(255,255,255,0.45); display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.28); color: #ddd; font-size: 9px; font-weight: 700; }
            .party-icon-ui { position: absolute; left: 4px; right: 4px; bottom: 3px; }
            .party-hp-track { width: 100%; height: 6px; border-radius: 0; background: rgba(0,0,0,0.8); overflow: hidden; border: 1px solid #555; }
            .party-hp-fill { height: 100%; }
            .party-hp-fill.enemy { background: #ffe600; }
            .party-hp-fill.player { background: #ffe600; }
            .party-skill-count { position: absolute; top: 2px; right: 2px; min-width: 15px; height: 15px; border-radius: 999px; background: rgba(0,0,0,0.75); color: #fff; font-size: 9px; font-weight: 900; line-height: 15px; text-align: center; border: 1px solid rgba(255,255,255,0.7); text-shadow: 1px 1px 0 #000; }
            .battle-ctrl-bar {
             position: fixed;
               left: 50%;
                bottom: 85px;
                transform: translateX(-50%);
                width: auto;
                height: auto;
                display: flex;
               flex-direction: row;
                justify-content: center;
                align-items: center;
                gap: 12px;
                z-index: 2000;
                pointer-events: none;
            }
            
            .b-ctrl-btn {
                pointer-events: auto;

               width: 108px; height: 34px;
                border-radius: 6px; 
                border: none;
                font-family: "Hiragino Kaku Gothic ProN", sans-serif;
                font-weight: 900; font-size: 13px; color: #fff;
                display: flex; align-items: center; justify-content: center; gap: 6px;
                cursor: pointer; transition: all 0.15s;
                box-shadow: 0 4px 12px rgba(0,0,0,0.6);
                backdrop-filter: blur(4px);
                text-shadow: 1px 1px 0 rgba(0,0,0,0.5);
                border: 2px solid rgba(255,255,255,0.3);
            }
            .b-ctrl-btn:active { transform: scale(0.95); box-shadow: 0 2px 5px rgba(0,0,0,0.5); }
            
            .btn-spd {
                background: linear-gradient(180deg, #00ced1, #008b8b);
                border-color: #aaffff; box-shadow: 0 4px 0 #006666, 0 10px 10px rgba(0,0,0,0.5);
            }
            .btn-spd:active { transform: translateY(4px); box-shadow: 0 0 0 #006666; }

            .btn-ret {
                background: linear-gradient(180deg, #ff4444, #8b0000);
                border-color: #ffaaaa; box-shadow: 0 4px 0 #660000, 0 10px 10px rgba(0,0,0,0.5);
            }
            .btn-ret:active { transform: translateY(4px); box-shadow: 0 0 0 #660000; }

            .c-icon { font-size: 18px; filter: drop-shadow(0 0 2px rgba(0,0,0,0.5)); }

            .order-bar-container { display: none !important; }

            .battle-area-container { width: 100%; height: 220px; display: flex; justify-content: center; pointer-events: none; }
            .battle-area-enemy { position: fixed; top: 300px; left: 0; right: 0; }
         
            .battle-area-player { position: fixed; bottom: 170px; left: 0; right: 0; }
            .battle-board { border: none !important; background: transparent !important; }
            .unit-container { position: absolute; pointer-events: auto; background: transparent !important; border: none !important; }
            .unit-container.size-S1x1 { width: 100px; height: 120px; }
            .unit-container.size-V1x2 { width: 100px; height: 210px; }
            .unit-container.size-H2x1 { width: 180px; height: 120px; }
            .unit-container.size-L2x2 { width: 180px; height: 210px; }
            .unit-shadow { position: absolute; bottom: 8px; left: 50%; width: 70%; height: 15%; transform: translateX(-50%); background: radial-gradient(ellipse at center, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 70%); border-radius: 50%; z-index: 0; }
            .unit-img-box { position: absolute; bottom: 12px; left: 0; width: 100%; height: 100%; background-size: contain; background-position: center center; background-repeat: no-repeat; filter: brightness(1.0); transition: transform 0.2s, filter 0.2s; transform-origin: center bottom; z-index: 1; background-color: transparent !important; border: none !important; }
            .unit-img-box.side-enemy { filter: brightness(0.9); }
            .no-img-text { position: absolute; bottom: 0; width: 100%; color: #fff; font-size: 10px; font-weight: bold; text-align: center; text-shadow: 1px 1px 2px #000; background: transparent !important; }
            
            /* HPバー位置修正: 足元(bottom: 8px)へ */
            .battle-ui-layer { position: absolute; bottom: 8px; left: 0; width: 100%; height: 20px; pointer-events: none; display: flex; justify-content: center; align-items: flex-end; z-index: 10; opacity: 0; transition: opacity 0.3s; }
            .battle-ui-layer.show { opacity: 1; }
            .hp-plate { width: 80%; height: 6px; background: rgba(0,0,0,0.8); border: 1px solid #555; border-radius: 0; overflow: hidden; }
            .hp-fill { height: 100%; transition: width 0.2s; }
           .charge-countdown { 
           display: none !important;
                position: absolute; 
                top: 0px; 
                right: 0px; 
                color: #fff; 
                font-family: 'Arial Black', Impact, sans-serif; 
                font-size: 15px; /* サイズアップ */
                font-weight: 900; 
                display: none; 
                align-items: center; 
                justify-content: center; 
                pointer-events: none; 
                z-index: 100; /* 最前面へ */
                line-height: 1; 
                min-width: 20px; 
                text-align: center; 
                padding: 0;
                background: transparent; /* 背景透明化 */
                /* 強めの縁取りで文字を浮き立たせる */
                text-shadow: 2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 0 5px rgba(0,0,0,0.8);
            }
            .charge-countdown.charge-soon { 
                color: #ffee33; 
                font-size: 15px; /* 少し強調 */
            }
            .charge-countdown.charge-imminent { 
                color: #ff4444; 
                font-size: 15px; /* さらに強調 */
                text-shadow: 2px 2px 0 #000, -1px -1px 0 #000, 0 0 10px #ff0000; 
            }
            /* HP数値: バーのすぐ下 */
            .hp-num { position: absolute; bottom: -14px; width: 100%; text-align: center; font-family: 'Arial Black', sans-serif; font-size: 11px; color: #fff; text-shadow: 1px 1px 0 #000; pointer-events: none; z-index: 11; opacity: 0; transition: opacity 0.3s; }
            .hp-num.show { opacity: 1; }
            
            /* ポップアップアニメーション */
            .dmg-pop { position: fixed; z-index: 9999; font-family: 'Impact', sans-serif; font-size: 28px; color: #fff; -webkit-text-stroke: 1px #000; text-shadow: 2px 2px 0 #b00; pointer-events: none; animation: popUpArt 2.5s cubic-bezier(0.22, 1, 0.36, 1) forwards; transform-origin: center center; }
            .dmg-pop.crit { font-size: 34px; color: #ffeb3b; text-shadow: 2px 2px 0 #f00; }
            .dmg-pop.heal { color: #00ffaa; text-shadow: 1px 1px 0 #004d40; -webkit-text-stroke: 0; }
            
            @keyframes popUpArt {
                0% { transform: translateY(0) scale(0.3); opacity: 0; }
                10% { transform: translateY(-50px) scale(1.4); opacity: 1; }
                20% { transform: translateY(-45px) scale(1.0); }
                85% { transform: translateY(-55px) scale(1.05); opacity: 1; }
                100% { transform: translateY(-90px) scale(0.5); opacity: 0; }
            }

            .micro-icon { width: 24px; height: 24px; border-radius: 50%; background: #333; border: 1px solid #aaa; display: flex; justify-content: center; align-items: center; font-size: 14px; }
            .micro-icon.is-enemy { border-color: #f00; background: #300; }
            .micro-icon.active-turn { transform: scale(1.3); border-color: #0ff; box-shadow: 0 0 5px #0ff; }
            .anim-shake { animation: shake 0.3s; }
            @keyframes shake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-6px); } 40% { transform: translateX(6px); } 60% { transform: translateX(-3px); } 80% { transform: translateX(3px); } }
            .unit-img-box.dead { filter: grayscale(100%) brightness(0.3) blur(2px); opacity: 0.5; transform: scale(0.9); }
            
            .cutin-box { position: fixed; top: 35%; width: 320px; height: 60px; display: block; z-index: 99999; transform: skewX(-20deg); box-shadow: 0 4px 15px rgba(0,0,0,0.6); opacity: 0; pointer-events: none; border: none !important; }
            .cutin-box.cp { left: -20px; background: linear-gradient(90deg, rgba(0,100,255,1) 0%, rgba(0,200,255,0.7) 80%, rgba(0,0,0,0) 100%); animation: slideInLeft 2.0s ease-out forwards; }
            .cutin-box.cp .cutin-text-wrap { position: absolute; top: 0; bottom: 0; left: 40px; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; width: 210px; text-align: left; }
            .cutin-box.cp .cutin-img { position: absolute; bottom: -25px; right: -30px; width: 180px; height: 180px; }
            .cutin-box.ce { right: -20px; background: linear-gradient(-90deg, rgba(255,0,80,1) 0%, rgba(255,100,100,0.7) 80%, rgba(0,0,0,0) 100%); animation: slideInRight 2.0s ease-out forwards; }
            .cutin-box.ce .cutin-text-wrap { position: absolute; top: 0; bottom: 0; right: 40px; display: flex; flex-direction: column; justify-content: center; align-items: flex-end; width: 210px; text-align: right; }
            .cutin-box.ce .cutin-img { position: absolute; bottom: -25px; left: -30px; width: 180px; height: 180px; }
            .cutin-img { background-size: contain; background-position: center bottom; background-repeat: no-repeat; transform: skewX(20deg); filter: drop-shadow(0 0 10px rgba(255,255,255,0.9)); }
            .cutin-main { color: #fff; font-weight: 900; font-size: 18px; transform: skewX(20deg); text-shadow: 2px 2px 0 #000; white-space: nowrap; line-height: 1.2; }
            .cutin-sub { color: #eee; font-size: 11px; font-weight: bold; transform: skewX(20deg); text-shadow: 1px 1px 0 #000; white-space: nowrap; margin-top: 2px; background: rgba(0,0,0,0.3); padding: 1px 6px; border-radius: 4px; }
            
            @keyframes slideInLeft { 0% { transform: translateX(-120%) skewX(-20deg); opacity: 0; } 15% { transform: translateX(5%) skewX(-20deg); opacity: 1; } 25% { transform: translateX(0%) skewX(-20deg); opacity: 1; } 80% { transform: translateX(0%) skewX(-20deg); opacity: 1; } 100% { transform: translateX(-120%) skewX(-20deg); opacity: 0; } }
            @keyframes slideInRight { 0% { transform: translateX(120%) skewX(-20deg); opacity: 0; } 15% { transform: translateX(-5%) skewX(-20deg); opacity: 1; } 25% { transform: translateX(0%) skewX(-20deg); opacity: 1; } 80% { transform: translateX(0%) skewX(-20deg); opacity: 1; } 100% { transform: translateX(120%) skewX(-20deg); opacity: 0; } }
            
            .lightning-bolt { position: absolute; bottom: 0; left: 50%; width: 40px; height: 300px; background: linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,100,1) 40%, rgba(255,255,255,1) 50%, rgba(100,200,255,1) 60%, rgba(255,255,255,0) 100%); transform: translateX(-50%) scaleY(0); transform-origin: bottom center; animation: boltStrike 0.3s ease-out; box-shadow: 0 0 30px #0ff; z-index: 900; }
            .lightning-flash { position: absolute; top:0; left:0; width:100%; height:100%; background:#fff; animation: flashFade 0.5s ease-out forwards; z-index: 950; pointer-events: none; }
            
            @keyframes boltStrike { 0% { transform: translateX(-50%) scaleY(2) translateY(-100%); opacity: 0; } 30% { transform: translateX(-50%) scaleY(1) translateY(0); opacity: 1; } 100% { transform: translateX(-50%) scaleY(0) translateY(10px); opacity: 0; } }
            @keyframes flashFade { 0% { opacity: 0.8; } 100% { opacity: 0; } }
            
            /* ★ユニット登場アニメーション (これが消えていたためキャラが表示されなかった) */
            @keyframes unitAppear { 0% { opacity: 0; transform: scale(0.8) translateY(20px); filter: brightness(3); } 100% { opacity: 1; transform: scale(1) translateY(0); filter: brightness(1); } }
            
            /* バフ画像用スタイル */
            .buff-pop-img {
                position: fixed;
                width: 72px;
                height: 72px;
                z-index: 10060;
                pointer-events: none;
                animation: iconFloatUp 1.2s cubic-bezier(0.22, 1, 0.36, 1) forwards;
                filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
            }
            .buff-pop-img img {
                width: 100%; height: 100%; object-fit: contain;
            }
            @keyframes iconFloatUp {
                0% { transform: translateY(0) scale(0.5); opacity: 0; }
                15% { transform: translateY(-20px) scale(1.3); opacity: 1; }
                30% { transform: translateY(-25px) scale(1.0); opacity: 1; }
                80% { transform: translateY(-30px) scale(1.0); opacity: 1; }
                100% { transform: translateY(-50px) scale(0.8); opacity: 0; }
            }

            .buff-pop { position: fixed; color: #00ffaa; font-weight: bold; font-size: 16px; text-shadow: 1px 1px 0 #000; animation: floatUp 1s forwards; z-index: 9999; }
            @keyframes floatUp { 0%{transform:translateY(0); opacity:1;} 100%{transform:translateY(-30px); opacity:0;} }
            
            .anim-buff { 
                animation: buffJump 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); 
                z-index: 100 !important; 
            }
            @keyframes buffJump { 
                0% { transform: scale(1) translateY(0); filter: brightness(1); } 
                30% { transform: scale(1.1) translateY(-40px); filter: brightness(1.7); } 
                50% { transform: scale(1.1) translateY(-20px); filter: brightness(1.5); }
                100% { transform: scale(1) translateY(0); filter: brightness(1); } 
            }

            .status-icon-img {
                width: 20px;
                height: 20px;
                margin: 0 1px;
                vertical-align: bottom;
                filter: drop-shadow(0 1px 2px #000);
            }
            .buff-status-icons {
                position: absolute;
                top: -24px;
                left: 0;
                width: 100%;
                text-align: center;
                pointer-events: none;
                z-index: 20;
                white-space: nowrap;
            }
        `;
        document.head.appendChild(style);
    }
}