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
        // CSS は style-battle-v2.css に外部化済み
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

}