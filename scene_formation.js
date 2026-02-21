/**
 * scene_formation.js - 双六遷移対応版
 * ・「出撃」ボタンの遷移先を戦闘(screen-battle)から双六(screen-sugoroku)へ変更
 * ・これにより編成画面からのテスト戦闘を廃止し、双六モードへ直行するように修正
 */
class FormationScreen {
    constructor() {
        this.selectedUid = null;
        this.currentTab = -1;
        this.injectStyles();    
    }

    onEnter() {
        this.selectedUid = null;
        this.currentTab = -1;
        this.refresh();

        const btn = document.getElementById('btn-start');
        if(btn) {
            btn.removeAttribute('onclick');
            btn.onclick = (e) => {
                e.stopPropagation();
                if(!app.data.deck || app.data.deck.length === 0) {
                    alert("部隊にキャラクターがいません");
                    return;
                }
                app.sound.tap();
                // ★変更: テスト戦闘ではなく、双六画面へ遷移するように変更
                app.changeScene('screen-sugoroku');
            };
        }
    }

    refresh() {
        this.renderTabs();
        this.renderList();
        this.renderBoard();
        this.updateHighlights();
        this.updateDetailPanel();
        this.updateDeckTotalStats();
        
        const btn = document.getElementById('btn-start');
        if(btn) {
            btn.disabled = (!app.data.deck || app.data.deck.length === 0);
        }
    }

    getCardBgUrl(typeId, cost) {
        const colors = ['purple', 'gold', 'pink', 'green', 'blue', 'red'];
        const color = colors[typeId] || 'red';
        let rarity = 'r';
        if (cost >= 5) rarity = 'ur';
        else if (cost >= 3) rarity = 'sr';
        return `images/bg/bg_${color}_${rarity}.webp`;
    }

    getRarityInfo(cost) {
        if (cost >= 5) return { label: 'UR', color: '#e100ff', stars: '★★★★★' };
        if (cost === 4) return { label: 'SSR', color: '#ffd700', stars: '★★★★' };
        if (cost === 3) return { label: 'SR', color: '#c0c0c0', stars: '★★★' };
        return { label: 'R', color: '#cd7f32', stars: '★'.repeat(cost) };
    }

    renderTabs() {
        const area = document.getElementById('tab-area');
        if (!area) return;
        let html = `<button class="tab-btn ${this.currentTab === -1 ? 'active' : ''}" onclick="app.formationScreen.setTab(-1)">ALL</button>`;
        if (typeof TYPES !== 'undefined') {
            TYPES.forEach(t => {
                const isActive = (this.currentTab === t.id) ? 'active' : '';
                html += `<button class="tab-btn ${isActive}" onclick="app.formationScreen.setTab(${t.id})">${t.icon} ${t.name}</button>`;
            });
        }
        area.innerHTML = html;
    }

    setTab(typeId) {
        if (this.currentTab === typeId) return;
        app.sound.tap();
        this.currentTab = typeId;
        this.selectedUid = null; 
        this.refresh();
    }

   // scene_formation.js (FormationScreenクラス内)

    updateDetailPanel() {
        const panel = document.getElementById('unit-detail-panel');
        if(!panel) return;

        if(!this.selectedUid) {
            panel.innerHTML = `<div class="empty-msg">キャラクターを選択してください</div>`;
            return;
        }

        const unit = app.data.getUnitInstance(this.selectedUid);
        if(!unit) {
            this.selectedUid = null;
            this.refresh();
            return;
        }

        // --- ★ここを修正: スキル説明文を計算済み数値に置き換え ---
        const skillBase = unit.base.skill || {name:'None', desc:'-'};
        const skillDesc = (typeof unit.getSkillCurrentDesc === 'function') 
            ? unit.getSkillCurrentDesc() 
            : skillBase.desc;
        
        const skill = { name: skillBase.name, desc: skillDesc };
        // -----------------------------------------------------

        const passive = unit.base.passive || {name:'-', desc:'-'};
        const abilities = unit.getAbilityStatus();
        
        const charImg = IMG_DATA[unit.base.id] ? `url('${IMG_DATA[unit.base.id]}')` : 'none';
        const bgImg = `url('${this.getCardBgUrl(unit.base.type, unit.base.cost)}')`;
        const rarity = this.getRarityInfo(unit.base.cost);

        let abilityHtml = `<div class="f-ability-list">`;
        abilities.forEach(ab => {
            const statusClass = ab.unlocked ? 'unlocked' : 'locked';
            const icon = ab.unlocked ? '🔓' : '🔒';
            abilityHtml += `<div class="f-ab-item ${statusClass}"><span class="icon">${icon}</span> ${ab.text}</div>`;
        });
        abilityHtml += `</div>`;

        let gridHtml = '<div class="shape-icon">';
        unit.base.shape.grid.forEach(bit => { 
            gridHtml += `<div class="shape-cell-dot ${bit?'on':''}"></div>`; 
        });
        gridHtml += '</div>';

        const lbBadge = unit.lbCount >= 5 ? '<span class="f-lb-max">👑MAX</span>' : `<span class="f-lb-val">凸${unit.lbCount}</span>`;

        panel.innerHTML = `
            <div class="f-panel-container">
                <div class="f-left-col">
                    <div id="formation-char-img" class="f-img-box anim-char-appear" style="background-image: ${charImg}, ${bgImg};">
                        <div class="lc-header">${gridHtml}</div>
                    </div>
                    <div class="f-basic-info">
                        <div class="f-name">${unit.base.name} ${lbBadge}</div>
                        <div class="f-rarity" style="color:${rarity.color}">
                            <span class="r-label">${rarity.label}</span> <span class="r-stars">${rarity.stars}</span>
                            <span class="f-type type-${unit.base.type}">${TYPES[unit.base.type].name}</span>
                        </div>
                        <div class="f-stats-grid">
                            <div class="f-stat"><span class="lbl">LV</span> <span class="val">${unit.save.lv}/${unit.save.maxLv}</span></div>
                            <div class="f-stat"><span class="lbl">HP</span> <span class="val">${unit.maxHp}</span></div>
                            <div class="f-stat"><span class="lbl">ATK</span> <span class="val">${unit.atk}</span></div>
                            <div class="f-stat"><span class="lbl">SPD</span> <span class="val">${unit.spd}</span></div>
                        </div>
                    </div>
                </div>

                <div class="f-right-col">
                    <div class="f-section">
                        <div class="f-sec-title c-skill">SKILL: ${skill.name} <span class="lv">Lv.${unit.save.skillLv}</span></div>
                        <div class="f-sec-desc">${skill.desc}</div>
                        <div class="f-sec-charge">${skillBase.charge && skillBase.charge < 99 ? '⚡チャージ: ' + skillBase.charge + 'T' : ''}</div>
                    </div>
                    <div class="f-section">
                        <div class="f-sec-title c-passive">PASSIVE: ${passive.name || 'None'}</div>
                        <div class="f-sec-desc">${passive.desc || '-'}</div>
                    </div>
                    <div class="f-section ability-box">
                        <div class="f-sec-title c-ability">BONUS</div>
                        ${abilityHtml}
                    </div>
                </div>
            </div>
        `;

        const img = document.getElementById('formation-char-img');
        if(img) {
            img.classList.remove('anim-char-appear');
            void img.offsetWidth; 
            img.classList.add('anim-char-appear');
        }
    }

    renderList() {
        const list = document.getElementById('formation-list');
        if(!list) return;
        list.innerHTML = '';

        const inventory = [...app.data.inventory].sort((a,b) => {
            if(a.unitId !== b.unitId) return a.unitId - b.unitId;
            return b.lv - a.lv; 
        });

        inventory.forEach(save => {
            const base = DB.find(u => u.id === save.unitId);
            if(!base) return;
            if (this.currentTab !== -1 && base.type !== this.currentTab) return;

            const unit = app.data.getUnitInstance(save.uid);
            const inDeck = app.data.deck.some(d => d.uid === unit.uid);
            
            const el = document.createElement('div');
            el.className = `list-card type-${base.type} ${inDeck ? 'in-deck' : ''} ${this.selectedUid === unit.uid ? 'selected' : ''}`;
            
            const charImg = IMG_DATA[base.id] ? `url('${IMG_DATA[base.id]}')` : 'none';
            const bgImg = `url('${this.getCardBgUrl(base.type, base.cost)}')`;
            el.style.backgroundImage = `${charImg}, ${bgImg}`;

            let gridHtml = '<div class="shape-icon">';
            base.shape.grid.forEach(bit => { gridHtml += `<div class="shape-cell-dot ${bit?'on':''}"></div>`; });
            gridHtml += '</div>';

            const rarity = this.getRarityInfo(base.cost);
            const lvBadge = `<div class="lc-lv-badge" style="position:absolute; top:2px; right:2px; background:rgba(0,0,0,0.7); color:#fff; font-size:10px; padding:1px 3px; border-radius:3px;">Lv.${unit.save.lv}</div>`;
            
            el.innerHTML = `
                <div class="lc-header">${gridHtml}</div>
                ${lvBadge}
                <div class="lc-rarity" style="color:${rarity.color}">${rarity.stars}</div>
                ${inDeck ? '<div class="deck-mark">編成中</div>' : ''}
            `;
            el.onclick = () => {
                app.sound.tap();
                this.selectedUid = (this.selectedUid === unit.uid) ? null : unit.uid;
                this.renderList();
                this.updateDetailPanel();
                this.updateHighlights();
            };
            list.appendChild(el);
        });
    }

    renderBoard() {
        const boardLayer = document.getElementById('edit-units-layer');
        if(!boardLayer) return;
        boardLayer.innerHTML = '';
        
        app.data.deck.forEach(entry => {
            const unit = app.data.getUnitInstance(entry.uid);
            if(!unit) return;

            const el = document.createElement('div');
            el.className = `unit-card type-${unit.base.type} size-${unit.base.shape.code}`;
            
            const charImg = IMG_DATA[unit.base.id] ? `url('${IMG_DATA[unit.base.id]}')` : 'none';
            el.style.backgroundImage = charImg;
            if(!IMG_DATA[unit.base.id]) el.innerHTML = `<div class="lc-name">${unit.base.name}</div>`;
            
            const r = Math.floor(entry.anchorIdx / 4);
            const c = entry.anchorIdx % 4;
            const cellW = 75;
            const cellH = 90;
            const sw = unit.base.shape.w || 1;
            const sh = unit.base.shape.h || 1;
            const elW = (sw === 2) ? 148 : 73;
            const elH = (sh === 2) ? 178 : 88;
            const gridCenterX = (c * cellW) + (sw * cellW / 2);
            const gridCenterY = (r * cellH) + (sh * cellH / 2);
            const left = gridCenterX - (elW / 2);
            const top = gridCenterY - (elH / 2);

            el.style.left = left + 'px';
            el.style.top = top + 'px';

            const btn = document.createElement('button');
            btn.className = 'btn-remove';
            btn.innerText = '×';
            btn.onclick = (e) => { e.stopPropagation(); app.deckManager.removeUnit(entry.uid); };
            el.appendChild(btn);
            
            boardLayer.appendChild(el);
        });
    }

    updateHighlights() {
        document.querySelectorAll('.grid-cell').forEach(c => c.classList.remove('highlight', 'invalid'));
        if(!this.selectedUid) return;
        
        if(app.data.deck.some(d => d.uid === this.selectedUid)) return;
        
        const unit = app.data.getUnitInstance(this.selectedUid);
        if(!unit) return;

        for(let i=0; i<8; i++) {
            const cell = document.querySelector(`.grid-cell[data-idx="${i}"]`);
            if(!cell) continue;
            if(app.deckManager.canPlace(unit, i)) {
                cell.classList.add('highlight');
                cell.onclick = () => { app.deckManager.addUnit(this.selectedUid, i); cell.onclick = null; };
            }
        }
    }

    updateDeckTotalStats() {
        let hp = 0; let atk = 0;
        app.data.deck.forEach(d => { 
            const u = app.data.getUnitInstance(d.uid); 
            if(u) { hp += u.maxHp; atk += u.atk; }
        });
        const eHp = document.getElementById('total-hp');
        const eAtk = document.getElementById('total-atk');
        const eSlots = document.getElementById('deck-slots-display');
        if(eHp) eHp.innerText = hp;
        if(eAtk) eAtk.innerText = atk;
        if(eSlots) eSlots.innerText = `${app.data.deck.length}/8`;
    }

    injectStyles() {
        if(document.getElementById('formation-style-v19')) return; // Revert to v19
        const style = document.createElement('style');
        style.id = 'formation-style-v19';
        style.innerHTML = `
            #screen-edit {
                background: linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), url('images/bg_main.webp') center/cover no-repeat !important;
            }
            .enhance-layout-panel, .tab-area, .deck-status-bar {
                background-color: rgba(17, 17, 17, 0.85) !important;
                backdrop-filter: blur(2px);
                border-color: rgba(100, 100, 100, 0.5) !important;
            }
            .inventory-area {
                background-color: rgba(40, 30, 20, 0.95) !important; 
                border: 3px solid #8b5a2b !important;
                border-radius: 6px !important;
                box-shadow: inset 0 0 20px rgba(0,0,0,0.8), 0 5px 15px rgba(0,0,0,0.5) !important;
                margin-top: 4px; padding: 8px !important;
            }
            .card-list { grid-template-columns: repeat(4, 1fr) !important; gap: 8px !important; }
            
            .formation-board {
                background-color: rgba(34, 34, 34, 0.85) !important;
                border-color: rgba(100, 100, 100, 0.5) !important;
                transform: scale(min(1.2, calc(95vw / 300))) !important; 
                margin-top: 15px !important; margin-bottom: 15px !important;
                z-index: 1 !important; 
                position: relative !important;
            }
            
            #btn-start, .btn-red, .btn-mini {
                position: relative !important;
                z-index: 1000 !important;
                cursor: pointer !important;
            }

            .tab-btn {
                background: rgba(60, 60, 60, 0.6) !important; border: 1px solid #666; color: #ccc; font-size: 11px;
                padding: 6px 10px; border-radius: 4px; transition: 0.2s;
            }
            .tab-btn.active {
                background: #00ced1 !important; color: #000 !important; font-weight: bold; border-color: #fff; box-shadow: 0 0 5px #00ced1;
            }
            .lc-header {
                top: 5px !important; left: 5px !important; background: rgba(0, 0, 0, 0.8) !important; padding: 3px !important;
                border-radius: 4px !important; border: 1px solid rgba(255,255,255,0.3) !important; box-shadow: 0 0 5px rgba(0,0,0,0.5) !important; z-index: 10 !important;
            }
            .shape-icon {
                width: 22px !important; height: 22px !important; gap: 2px !important; display: grid !important; grid-template-columns: 1fr 1fr !important;
            }
            .shape-cell-dot { background: #222 !important; border: 1px solid #555 !important; border-radius: 2px !important; }
            .shape-cell-dot.on { background: #00ff00 !important; border-color: #fff !important; box-shadow: 0 0 4px #00ff00 !important; }

            .list-card { background-size: cover, cover !important; background-position: top center, center !important; background-repeat: no-repeat, no-repeat !important; background-color: rgba(34, 34, 34, 0.8); }
            .f-img-box {
                background-size: contain, cover !important; background-position: bottom center, center !important; background-repeat: no-repeat, no-repeat !important; background-color: rgba(34, 34, 34, 0.8);
                width: 100%; height: 120px; border: 1px solid #666; border-radius: 4px; position: relative !important;
            }
            
            .anim-char-appear {
                animation: charAppear 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            }
            @keyframes charAppear {
                0% { opacity: 0; transform: scale(0.9) translateY(10px); }
                100% { opacity: 1; transform: scale(1) translateY(0); }
            }

            .unit-card { 
                background-size: contain !important; 
                background-position: center center !important; 
                background-repeat: no-repeat !important; 
                background-color: transparent !important; 
            }
            
            #unit-detail-panel { height: 260px !important; padding: 5px !important; overflow: hidden; }
            .f-panel-container { display: flex; height: 100%; gap: 10px; }
            .f-left-col { width: 120px; display: flex; flex-direction: column; gap: 5px; flex-shrink: 0; }
            .f-right-col { flex: 1; display: flex; flex-direction: column; gap: 4px; overflow-y: auto; padding-right: 2px; }
            .f-name { font-size: 13px; font-weight: bold; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .f-rarity { font-size: 11px; margin-bottom: 2px; display: flex; align-items: center; gap: 4px; }
            .r-label { font-weight: 900; font-style: italic; font-size: 12px; }
            .r-stars { font-size: 10px; }
            .f-type { background: #444; color: #fff; padding: 0 4px; border-radius: 2px; font-size: 9px; margin-left: auto; }
            .type-0 { background: #e100ff; } .type-1 { background: #ff8c00; } .type-2 { background: #ff69b4; } 
            .type-3 { background: #4caf50; } .type-4 { background: #607d8b; } .type-5 { background: #795548; }
            .f-stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; font-size: 10px; background: rgba(0,0,0,0.3); padding: 2px; border-radius: 2px; }
            .f-stat .lbl { color: #aaa; } .f-stat .val { color: #fff; font-weight: bold; float: right; }
            .f-section { background: rgba(255,255,255,0.05); padding: 4px 6px; border-radius: 4px; border: 1px solid #444; }
            .f-section.ability-box { flex: 1; border-color: #f0f; background: rgba(255,0,255,0.05); overflow-y: auto; }
            .f-sec-title { font-size: 11px; font-weight: bold; border-bottom: 1px dashed rgba(255,255,255,0.2); margin-bottom: 2px; }
            .c-skill { color: #00ced1; } .c-passive { color: #ffd700; } .c-ability { color: #f0f; }
            .f-sec-desc { font-size: 10px; color: #ccc; line-height: 1.3; }
            .f-ability-list { margin-top: 2px; display: flex; flex-direction: column; gap: 1px; }
            .f-ab-item { font-size: 10px; color: #666; display: flex; align-items: center; }
            .f-ab-item.unlocked { color: #fff; font-weight: bold; }
            .f-ab-item .icon { width: 12px; text-align: center; margin-right: 2px; font-size: 8px; }
            .empty-msg { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #aaa; font-size: 14px; text-shadow: 1px 1px 2px #000; }
            .list-card.selected { border-color: #00ced1; box-shadow: 0 0 10px #00ced1; transform: scale(1.05); z-index: 10; }
            .list-card.in-deck { filter: brightness(0.6); }
            .deck-mark { position: absolute; top: 50%; left: 0; width: 100%; text-align: center; color: #fff; font-weight: bold; font-size: 12px; transform: translateY(-50%) rotate(-15deg); text-shadow: 1px 1px 2px #000; pointer-events: none; border: 2px solid #fff; padding: 2px 0; background: rgba(255,0,0,0.5); }
            .lb-badge { position: absolute; bottom: 2px; right: 2px; background: rgba(0,0,0,0.8); color: #0ff; font-size: 10px; padding: 1px 4px; border-radius: 4px; font-weight: bold; }
            .lb-badge.max { color: #f0f; border: 1px solid #f0f; }
            .f-lb-max, .f-lb-val { font-size: 10px; margin-left: 5px; }
            .f-lb-max { color: #f0f; } .f-lb-val { color: #0ff; }
            .grid-cell.highlight { background-color: rgba(0, 255, 255, 0.3); border: 2px solid #00ced1; cursor: pointer; animation: pulseGrid 1s infinite; }
            @keyframes pulseGrid { 0% { opacity: 0.5; } 50% { opacity: 1; } 100% { opacity: 0.5; } }
            .btn-remove { position: absolute; top: -5px; right: -5px; width: 20px; height: 20px; background: red; color: white; border: 1px solid white; border-radius: 50%; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 20; }
        `;
        document.head.appendChild(style);
    }
}