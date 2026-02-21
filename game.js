/**
 * game.js - クラス別ロジック完全版
 */



class Unit {
    constructor(baseData, saveData = null) {
        this.base = baseData;
        this.save = saveData || { lv: 1, maxLv: 50, skillLv: 1, exp: 0 };
        this.battleHp = 0; this.isDead = false; this.side = 'player'; this.anchorIdx = 0; this.elem = null; this.uid = Math.random(); this.gutsUsed = false;
        this.calcStats();
    }
    calcStats() {
        const mul = 1 + 0.05 * (this.save.lv - 1);
        this.maxHp = Math.floor(this.base.hp * mul);
        this.atk = Math.floor(this.base.atk * mul);
        this.spd = this.base.spd;
        this.skillPow = this.base.skill.pow ? parseFloat((this.base.skill.pow * (1 + 0.02 * (this.save.skillLv - 1))).toFixed(2)) : 0;
    }
    levelUp() { if (this.save.lv >= this.save.maxLv) return false; this.save.lv++; this.calcStats(); return true; }
    skillUp() { if (this.save.skillLv >= 10) return false; this.save.skillLv++; this.calcStats(); return true; }
    limitBreak() { if (this.save.maxLv >= 99) return false; this.save.maxLv += 5; return true; }
    getOccupiedCells(anchorIdx) {
        const cells = []; const r = Math.floor(anchorIdx / 4); const col = anchorIdx % 4;
        for (let dy = 0; dy < this.base.shape.h; dy++) {
            for (let dx = 0; dx < this.base.shape.w; dx++) {
                const tr = r + dy; const tc = col + dx;
                if (tr > 1 || tc > 3) return null;
                cells.push(tr * 4 + tc);
            }
        }
        return cells;
    }
}

class DataManager {
    constructor() { 
        this.userStats = {}; 
        this.deck = []; 
        // ★追加: クリア済みステージID (初期値0)
        this.maxClearedStage = 0; 
        this.load(); 
    }

    load() {
        const stats = localStorage.getItem('hero_stats_v1');
        if (stats) this.userStats = JSON.parse(stats);
        else DB.forEach(u => this.userStats[u.id] = { lv: 1, maxLv: 50, skillLv: 1, exp: 0 });
        
        const deck = localStorage.getItem('hero_deck_v16');
        if (deck) { try { this.deck = JSON.parse(deck); } catch (e) { this.deck = []; } }

        // ★追加: ステージ進行度の読み込み
        const progress = localStorage.getItem('hero_stage_progress_v1');
        if(progress) {
            this.maxClearedStage = parseInt(progress);
        }
    }

    saveStats() { localStorage.setItem('hero_stats_v1', JSON.stringify(this.userStats)); }
    saveDeck() { localStorage.setItem('hero_deck_v16', JSON.stringify(this.deck)); }
    
    // ★追加: ステージ進行度の保存
    saveProgress() {
        localStorage.setItem('hero_stage_progress_v1', this.maxClearedStage);
    }

    // ★追加: ステージクリア時の更新処理
    completeStage(stageId) {
        if(stageId > this.maxClearedStage) {
            this.maxClearedStage = stageId;
            this.saveProgress();
        }
    }

    getUnit(id) {
        if (!this.userStats[id]) this.userStats[id] = { lv: 1, maxLv: 50, skillLv: 1, exp: 0 };
        return new Unit(DB.find(u => u.id === id), this.userStats[id]);
    }
}
class SceneManager {
    constructor() { this.currentSceneId = 'screen-home'; }
    change(sceneId) {
        app.sound.init(); app.sound.tap();
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(sceneId).classList.add('active');
        this.currentSceneId = sceneId;
        const footer = document.getElementById('global-footer');
        if (footer) footer.style.display = (sceneId === 'screen-battle') ? 'none' : 'flex';
        
        // シーン初期化コールバック
        if(sceneId === 'screen-edit') app.formationScreen.onEnter();
        if(sceneId === 'screen-enhance') app.enhanceScreen.onEnter();
        if(sceneId === 'screen-battle') app.battleScreen.start();
    }
}

// ==========================================
// 2. Helper: UI Builder
// ==========================================
const UIHelper = {
    createCard(unit, isEnhanceMode) {
        const el = document.createElement('div');
        el.className = `list-card type-${unit.base.type}`;
        if (IMG_DATA[unit.base.id]) el.style.backgroundImage = `url('${IMG_DATA[unit.base.id]}')`;
        
        let headerContent = '';
        if (!isEnhanceMode) {
            let gridHtml = '<div class="shape-icon">';
            unit.base.shape.grid.forEach(bit => { gridHtml += `<div class="shape-cell-dot ${bit?'on':''}"></div>`; });
            gridHtml += '</div>';
            headerContent = `<div class="lc-header">${gridHtml}</div>`;
        }
        
        el.innerHTML = `${headerContent}<div class="lc-rarity">${'★'.repeat(unit.base.cost)}</div>`;
        return el;
    },
    updatePanel(prefix, unit) {
        if (!unit) { document.getElementById(prefix + '-name').innerText = '選択なし'; return; }
        
        document.getElementById(prefix + '-name').innerText = unit.base.name;
        const rarEl = document.getElementById(prefix + '-rarity');
        if(rarEl) rarEl.innerText = '★'.repeat(unit.base.cost);

        const imgBox = document.getElementById(prefix + '-img');
        const url = IMG_DATA[unit.base.id] ? `url('${IMG_DATA[unit.base.id]}')` : 'none';
        if(imgBox) imgBox.style.backgroundImage = url;

        document.getElementById(prefix + '-lv').innerText = `${unit.save.lv}/${unit.save.maxLv}`;
        document.getElementById(prefix + '-hp').innerText = unit.maxHp;
        document.getElementById(prefix + '-atk').innerText = unit.atk;
        
        const spdEl = document.getElementById(prefix + '-spd');
        if(spdEl) spdEl.innerText = unit.spd; 

        const barLv = document.getElementById(prefix + '-bar-lv');
        if(barLv) barLv.style.width = (unit.save.lv / unit.save.maxLv * 100) + '%';
        const barHp = document.getElementById(prefix + '-bar-hp');
        if(barHp) barHp.style.width = Math.min(100, unit.maxHp / 1500 * 100) + '%';
        const barAtk = document.getElementById(prefix + '-bar-atk');
        if(barAtk) barAtk.style.width = Math.min(100, unit.atk / 500 * 100) + '%';

        const sNameEl = document.getElementById(prefix + '-skill-name');
        if(sNameEl) sNameEl.innerText = unit.base.skill.name;
        
        const sDescEl = document.getElementById(prefix + '-skill-desc');
        if(sDescEl) sDescEl.innerText = unit.base.skill.desc || '-';
        
        const sLvEl = document.getElementById('enh-skill-lv');
        if(sLvEl && prefix === 'enh') sLvEl.innerText = `Lv.${unit.save.skillLv}`;
    }
};

// ==========================================
// 3. Screen Classes (Unity Scripts)
// ==========================================

// --- Formation Screen (編成) ---
class FormationScreen {
    constructor() {
        this.selectedId = null;
        this.tab = -1;
    }

    onEnter() {
        this.setupTabs();
        this.renderList();
        this.renderBoard();
        
        // Grid Event Binding
        const cells = document.querySelectorAll('#edit-board .grid-cell');
        cells.forEach(c => {
            c.onclick = () => { if(this.selectedId) this.placeUnit(this.selectedId, parseInt(c.dataset.idx)); };
        });
    }

    setupTabs() {
        const area = document.getElementById('tab-area');
        if(!area) return;
        area.innerHTML = `<button class="tab-btn active" onclick="app.formationScreen.setTab(-1)">全部</button>` + 
            TYPES.map(t => `<button class="tab-btn" onclick="app.formationScreen.setTab(${t.id})">${t.name}</button>`).join('');
    }

    setTab(tid) {
        app.sound.tap(); this.tab = tid;
        document.querySelectorAll('#tab-area .tab-btn').forEach(b => b.classList.remove('active'));
        event.target.classList.add('active'); 
        this.renderList();
    }

    renderList() {
        const list = document.getElementById('formation-list'); // HTMLでIDを変更済み
        if(!list) {
            // 後方互換: HTML未更新時のフォールバック
            const oldList = document.getElementById('card-list');
            if(oldList) oldList.innerHTML = '';
            else return;
        } else {
            list.innerHTML = '';
        }
        
        const targetList = list || document.getElementById('card-list');
        const deckIds = app.data.deck.map(d => d.unitId);

        DB.filter(u => this.tab === -1 || u.type === this.tab).forEach(base => {
            const unit = app.data.getUnit(base.id);
            const el = UIHelper.createCard(unit, false);
            
            if (deckIds.includes(unit.base.id)) el.classList.add('disabled');
            if (this.selectedId === unit.base.id) el.classList.add('selected');
            
            if (!el.classList.contains('disabled')) {
                el.onclick = () => {
                    app.sound.tap();
                    this.selectedId = (this.selectedId === unit.base.id) ? null : unit.base.id;
                    this.renderList();
                    this.updateHighlights();
                    UIHelper.updatePanel('udp', this.selectedId ? unit : null);
                };
            }
            targetList.appendChild(el);
        });
    }

    placeUnit(id, anchor) {
        if (app.data.deck.some(d => d.unitId === id)) return;
        const unit = app.data.getUnit(id);
        const cells = unit.getOccupiedCells(anchor);
        if (!cells) { alert("配置不可"); return; }
        for (let c of cells) {
            const occupied = app.data.deck.some(e => app.data.getUnit(e.unitId).getOccupiedCells(e.anchorIdx).includes(c));
            if (occupied) { alert("重なっています"); return; }
        }
        app.sound.tap();
        app.data.deck.push({ uid: Date.now(), unitId: id, anchorIdx: anchor });
        app.data.saveDeck();
        this.selectedId = null;
        this.updateHighlights();
        this.renderBoard();
        this.renderList();
    }

    removeUnit(uid) {
        app.sound.tap();
        app.data.deck = app.data.deck.filter(d => d.uid !== uid);
        app.data.saveDeck();
        this.renderBoard();
        this.renderList();
    }

    clear() {
        if(confirm("全解除？")) { app.sound.tap(); app.data.deck = []; app.data.saveDeck(); this.renderBoard(); this.renderList(); }
    }

    renderBoard() {
        const layer = document.getElementById('edit-units-layer');
        if(!layer) return;
        layer.innerHTML = '';
        let tHp=0, tAtk=0;
        app.data.deck.forEach(e => {
            const u = app.data.getUnit(e.unitId);
            tHp += u.maxHp; tAtk += u.atk;
            const d = document.createElement('div');
            d.className = `unit-card type-${u.base.type} size-${u.base.shape.code}`;
            if(IMG_DATA[u.base.id]) d.style.backgroundImage = `url('${IMG_DATA[u.base.id]}')`;
            else d.innerHTML = `<div class="lc-name">${u.base.name}</div>`;
            const r = Math.floor(e.anchorIdx / 4); const c = e.anchorIdx % 4;
            d.style.left = (c * 75) + 'px'; d.style.top = (r * 90) + 'px';
            d.onclick = (ev) => { ev.stopPropagation(); this.removeUnit(e.uid); };
            layer.appendChild(d);
        });
        document.getElementById('total-hp').innerText = tHp;
        document.getElementById('total-atk').innerText = tAtk;
        const count = app.data.deck.length;
        document.getElementById('deck-slots-display').innerText = `${count}/8`;
        document.getElementById('btn-start').disabled = (count === 0);
    }

    updateHighlights() {
        document.querySelectorAll('.grid-cell').forEach(c => c.classList.remove('valid'));
        if (!this.selectedId) return;
        const unit = app.data.getUnit(this.selectedId);
        for (let i=0; i<8; i++) {
            const cells = unit.getOccupiedCells(i);
            if (cells) {
                let ok = true;
                for(let cell of cells) {
                    if(app.data.deck.some(e => app.data.getUnit(e.unitId).getOccupiedCells(e.anchorIdx).includes(cell))) ok = false;
                }
                if(ok) document.querySelector(`.grid-cell[data-idx="${i}"]`).classList.add('valid');
            }
        }
    }
}

// --- Enhance Screen (強化) ---
class EnhanceScreen {
    constructor() { this.selectedId = null; }
    onEnter() {
        if (DB.length > 0 && !this.selectedId) this.select(DB[0].id);
        else { this.renderList(); if(this.selectedId) this.select(this.selectedId); }
    }
    renderList() {
        const list = document.getElementById('enhance-list');
        list.innerHTML = '';
        DB.forEach(base => {
            const unit = app.data.getUnit(base.id);
            const el = UIHelper.createCard(unit, true);
            if (this.selectedId === unit.base.id) el.classList.add('selected');
            el.onclick = () => { app.sound.tap(); this.select(unit.base.id); };
            list.appendChild(el);
        });
    }
    select(id) {
        this.selectedId = id;
        this.renderList();
        UIHelper.updatePanel('enh', app.data.getUnit(id));
    }
    levelUp() { this._enhAction(u => u.levelUp(), "レベル最大"); }
    skillUp() { this._enhAction(u => u.skillUp(), "スキル最大"); }
    limitBreak() { this._enhAction(u => u.limitBreak(), "限界突破最大"); }
    _enhAction(actionFn, failMsg) {
        if (!this.selectedId) return;
        const unit = app.data.getUnit(this.selectedId);
        if (actionFn(unit)) { app.sound.tap(); app.data.saveStats(); this.select(this.selectedId); } 
        else { alert(failMsg); }
    }
}

// --- Battle Screen (戦闘) ---
class BattleScreen {
    constructor() { this.active = false; this.units = []; this.speed = 1.0; }
    async start() {
        if (app.data.deck.length === 0) return;
        app.sound.start();
        this.active = true; this.units = [];
        app.data.deck.forEach(e => this.createUnit(app.data.getUnit(e.unitId), 'player', e.anchorIdx));
        this.generateEnemy(); this.renderBoard(); await this.loop();
    }
    createUnit(uData, side, anchor) {
        uData.battleHp = uData.maxHp; uData.isDead = false; uData.side = side; uData.anchorIdx = anchor; uData.gutsUsed = false;
        this.units.push(uData);
    }
    generateEnemy() {
        let occupied = [];
        for(let k=0; k<50; k++) {
            const base = DB[Math.floor(Math.random() * DB.length)];
            const u = new Unit(base, {lv:10, maxLv:50, skillLv:1});
            const anchor = Math.floor(Math.random() * 8);
            const cells = u.getOccupiedCells(anchor);
            if (cells && !cells.some(c => occupied.includes(c))) {
                cells.forEach(c => occupied.push(c)); this.createUnit(u, 'enemy', anchor);
                if(this.units.filter(x=>x.side==='enemy').length >= 4) break;
            }
        }
        if(this.units.filter(x=>x.side==='enemy').length === 0) this.createUnit(new Unit(DB[0]), 'enemy', 0);
    }
    renderBoard() {
        ['player-board','enemy-board'].forEach(id => document.getElementById(id).innerHTML='');
        this.units.forEach(u => {
            const con = document.getElementById(u.side==='player'?'player-board':'enemy-board');
            const d = document.createElement('div');
            d.className = `unit-card type-${u.base.type} size-${u.base.shape.code}`;
            if(IMG_DATA[u.base.id]) d.style.backgroundImage = `url('${IMG_DATA[u.base.id]}')`;
            else d.innerHTML = `<div class="lc-name">${u.base.name}</div>`;
            const r = Math.floor(u.anchorIdx / 4); const c = u.anchorIdx % 4;
            d.style.left = (c * 75) + 'px'; d.style.top = (r * 90) + 'px';
            d.innerHTML += `<div class="buff-indicator">UP</div><div class="hp-wrap"><div class="hp-val" style="width:100%"></div></div><div class="hp-txt">${u.battleHp}</div>`;
            u.elem = d; con.appendChild(d);
        });
    }
    async loop() {
        this.cutin('player', "BATTLE START!!"); await this.sleep(1000);
        while (this.active) {
            let queue = this.units.filter(u=>!u.isDead).sort((a,b)=>b.spd-a.spd);
            if (queue.length === 0) break;
            this.updateOrder(queue);
            for (const actor of queue) {
                if (!this.active) break; if (actor.isDead) continue; if (this.checkEnd()) { this.active = false; break; }
                this.updateOrder(queue, actor);
                if (actor.base.passive && actor.base.passive.type === 'REGEN') {
                    const heal = Math.floor(actor.maxHp * actor.base.passive.val);
                    if (actor.battleHp < actor.maxHp) { actor.battleHp = Math.min(actor.maxHp, actor.battleHp + heal); this.showVal(actor.elem, heal, false, true); this.updateHp(actor); }
                }
                const skillAct = (Math.random() < 0.35); const targets = this.getTargets(actor, actor.side==='player'?'enemy':'player', skillAct);
                if (targets.length > 0) { await this.act(actor, targets, skillAct); await this.sleep(1000); }
            }
        }
    }
    getTargets(actor, targetSide, isSkill) {
        const lives = this.units.filter(u => u.side === targetSide && !u.isDead);
        if (lives.length === 0) return [];
        return [lives[Math.floor(Math.random() * lives.length)]];
    }
    async act(actor, targets, isSkill) {
        let actName = isSkill ? `<span class="skill-name-disp">${actor.base.skill.name}</span>` : "攻撃";
        this.cutin(actor.side, `${actor.base.name}の${actName}!`);
        app.sound.attack();
        const dir = actor.side==='player' ? -1 : 1;
        actor.elem.style.transform = `translateY(${dir*30}px) scale(1.1)`; actor.elem.style.zIndex = 100;
        await this.sleep(300);
        for (let t of targets) {
            if(t.isDead) continue;
            let val = Math.floor(actor.atk * (isSkill ? actor.skillPow : 1.0));
            t.battleHp = Math.max(0, t.battleHp - val);
            app.sound.damage(); this.showVal(t.elem, val, false); t.elem.classList.add('anim-shake'); this.updateHp(t); await this.sleep(200); t.elem.classList.remove('anim-shake');
           if (t.battleHp <= 0) { 
    t.isDead = true; 
    t.elem.classList.add('dead'); 
    app.sound.defeat(); // ★ここに追加！
    await this.sleep(100); 
}
        }
        actor.elem.style.transform = ''; actor.elem.style.zIndex = '';
    }
    checkEnd() {
        const p = this.units.some(u => u.side==='player' && !u.isDead); const e = this.units.some(u => u.side==='enemy' && !u.isDead);
        if (!p || !e) { setTimeout(() => { if(p) { app.sound.win(); alert("勝利！"); } else { app.sound.lose(); alert("敗北"); } app.changeScene('screen-edit'); }, 500); return true; }
        return false;
    }
    backToEdit() { this.active = false; app.changeScene('screen-edit'); }
    updateOrder(queue, current) { const list = document.getElementById('order-list'); list.innerHTML=''; queue.slice(0,6).forEach(u => { const d = document.createElement('div'); d.className=`micro-card type-${u.base.type}`; if(u.side==='enemy') d.classList.add('is-enemy'); if(u===current) d.classList.add('active-turn'); d.setAttribute('data-type', TYPES[u.base.type].icon); list.appendChild(d); }); }
    showVal(el, val, crit, heal) { const d = document.createElement('div'); d.className = crit ? 'dmg-txt crit' : 'dmg-txt'; d.innerText = val; const r = el.getBoundingClientRect(); d.style.left=(r.left+20)+'px'; d.style.top=(r.top)+'px'; document.body.appendChild(d); setTimeout(()=>d.remove(), 1000); }
    cutin(side, html) { const l = document.getElementById('cutin-layer'); const d = document.createElement('div'); d.className = `cutin-msg ${side==='player'?'c-player':'c-enemy'}`; d.innerHTML = html; l.appendChild(d); setTimeout(()=>{ d.style.animation='fadeOut 0.2s forwards'; setTimeout(()=>d.remove(), 200); }, 1200); }
    updateHp(u) { const bar = u.elem.querySelector('.hp-val'); const txt = u.elem.querySelector('.hp-txt'); const pct = Math.max(0, u.battleHp / u.maxHp * 100); bar.style.width = pct + '%'; txt.innerText = u.battleHp; }
    sleep(ms) { return new Promise(r => setTimeout(r, ms/this.speed)); }
    toggleSpeed() { this.speed = (this.speed===1.0)? 2.0 : 1.0; document.getElementById('btn-speed').innerText="x"+this.speed.toFixed(1); }
}

// ==========================================
// Main App Controller
// ==========================================
class GameApp {
    constructor() {
        this.sound = new SoundManager();
        this.data = new DataManager();
        this.sceneManager = new SceneManager();
        this.formationScreen = new FormationScreen();
        this.enhanceScreen = new EnhanceScreen();
        this.battleScreen = new BattleScreen();
    }
    init() { this.sound.init(); this.changeScene('screen-home'); }
    changeScene(id) {
        // ID変換 (HTMLのonclickで使っている名前 -> HTML ID)
        let targetId = id;
        if(id === 'edit' || id === 'quest') targetId = 'screen-edit';
        if(id === 'enhance') targetId = 'screen-enhance';
        if(id === 'battle') targetId = 'screen-battle';
        if(id === 'home') targetId = 'screen-home';
        
        this.sceneManager.change(targetId);
    }
}