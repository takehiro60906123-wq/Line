/**
 * scene_enhance.js - 縦型レイアウト改修版
 */
class EnhanceScreen {
    constructor() {
        this.selectedUid = null;
        this.currentTab = -1; 
        
        // 一括モード管理用
        this.isBulkMode = false;
        this.bulkSelection = new Set(); 
        

        this.detailHtmlCache = '';
        // CSS は style-enhance.css に外部化済み
    }

    onEnter() {
        this.ensureTabArea();
         this.ensureDetailModal();
        
        // モードリセット
        this.isBulkMode = false;
        this.bulkSelection.clear();

        if (!this.selectedUid && app.data.inventory.length > 0) {
            const sorted = [...app.data.inventory].sort((a,b) => b.createTime - a.createTime);
            this.selectedUid = sorted[0].uid;
        }
        this.currentTab = -1; 
        this.refresh();
    }

     onLeave() {
        this.closeDetailModal();
    }

    refresh() {
        this.renderTabs();
        this.renderList();
        this.updateDetailPanel();
        this.syncDetailModalIfOpen();
    }

    ensureTabArea() {
        const screen = document.getElementById('screen-enhance');
        if (!screen) return;
        let tabArea = document.getElementById('enh-tab-area');
        if (!tabArea) {
            tabArea = document.createElement('div');
            tabArea.id = 'enh-tab-area';
            tabArea.className = 'tab-area';
            const listArea = screen.querySelector('.enhance-list-area');
            if (listArea) screen.insertBefore(tabArea, listArea);
            else screen.appendChild(tabArea);
        }
    }

     ensureDetailModal() {
        let modal = document.getElementById('enh-detail-modal');
        if (modal) return;

        modal = document.createElement('div');
        modal.id = 'enh-detail-modal';
        modal.className = 'enh-detail-modal';
        modal.innerHTML = `
            <div class="enh-detail-modal-card">
                <button class="enh-detail-modal-close" onclick="app.enhanceScreen.closeDetailModal()">×</button>
                <div id="enh-detail-modal-body"></div>
            </div>
        `;
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeDetailModal();
        });
        document.body.appendChild(modal);
    }

    openDetailModal() {
        
        const modal = document.getElementById('enh-detail-modal');
        const body = document.getElementById('enh-detail-modal-body');
        if (!modal || !body || !this.detailHtmlCache) return;
        body.innerHTML = this.detailHtmlCache;
        modal.style.display = 'flex';
    }

    closeDetailModal() {
        const modal = document.getElementById('enh-detail-modal');
        if (modal) modal.style.display = 'none';
    }

    syncDetailModalIfOpen() {
        const modal = document.getElementById('enh-detail-modal');
        const body = document.getElementById('enh-detail-modal-body');
        if (!modal || !body) return;
        if (getComputedStyle(modal).display === 'none') return;

        if (!this.detailHtmlCache) {
            this.closeDetailModal();
            return;
        }
        body.innerHTML = this.detailHtmlCache;
    }


    startBulkFromDetail() {
        this.closeDetailModal();
        if (!this.isBulkMode) this.toggleBulkMode();
    }
    getFilteredInventory() {
        const inventory = [...app.data.inventory].sort((a, b) => {
            const inDeckA = app.data.deck.some(d => d.uid === a.uid) ? 1 : 0;
            const inDeckB = app.data.deck.some(d => d.uid === b.uid) ? 1 : 0;
            if (inDeckA !== inDeckB) return inDeckB - inDeckA;
            if (b.lv !== a.lv) return b.lv - a.lv;
            return a.unitId - b.unitId;
        });
        return inventory.filter(save => {
            const base = DB.find(u => u.id === save.unitId);
            if (!base) return false;
            return this.currentTab === -1 || base.type === this.currentTab;
        });
    }

    renderOwnedSummaryStrip() {
        const filtered = this.getFilteredInventory();
       

        return `
            <div class="enh-owned-strip">
                <div class="enh-owned-title">所持キャラ一覧 (${filtered.length})</div>
               <button class="btn-bulk-start top-inline" onclick="app.enhanceScreen.startBulkFromDetail()">一括整理</button>
            </div>
        `;
    }

    renderTabs() {
        const area = document.getElementById('enh-tab-area');
        if (!area) return;
        
        let modeHtml = this.isBulkMode 
            ? `<div class="mode-indicator">【一括選択モード】 対象を選択してください</div>` 
            : '';

        let html = `<button class="tab-btn ${this.currentTab === -1 ? 'active' : ''}" onclick="app.enhanceScreen.setTab(-1)">ALL</button>`;
        if (typeof TYPES !== 'undefined') {
            TYPES.forEach(t => {
                const isActive = (this.currentTab === t.id) ? 'active' : '';
                html += `<button class="tab-btn ${isActive}" onclick="app.enhanceScreen.setTab(${t.id})">${t.icon} ${t.name}</button>`;
            });
        }
        
        if(this.isBulkMode) {
            area.innerHTML = modeHtml + '<div style="display:flex; gap:2px;">' + html + '</div>';
        } else {
            area.innerHTML = html;
        }
    }

    setTab(typeId) {
        if (this.currentTab === typeId) return;
        app.sound.tap();
        this.currentTab = typeId;
        this.renderTabs();
        this.renderList();
    }

    // --- ロック切り替え ---
    toggleLock() {
        if(!this.selectedUid) return;
        const modal = document.getElementById('enh-detail-modal');
        const wasModalOpen = !!(modal && getComputedStyle(modal).display !== 'none');
        app.sound.tap();
        app.data.toggleLock(this.selectedUid);
        this.refresh(); 
        if (wasModalOpen) this.openDetailModal();
    }

    // --- 一括モード切り替え ---
    toggleBulkMode() {
        app.sound.tap();
        this.isBulkMode = !this.isBulkMode;
        this.bulkSelection.clear(); 
        this.refresh();
    }

    toggleBulkSelect(uid) {
        const unit = app.data.getUnitInstance(uid);
        if(!unit) return;
        
        if(unit.isLocked || app.data.deck.some(d => d.uid === uid)) {
            app.sound.playTone(150, 'sawtooth', 0.1); 
            return;
        }

        if(this.bulkSelection.has(uid)) {
            this.bulkSelection.delete(uid);
        } else {
            this.bulkSelection.add(uid);
        }
        app.sound.tap();
        this.refresh(); 
    }

    // --- 一括売却実行 ---
    execBulkTransfer() {
        const count = this.bulkSelection.size;
        if(count === 0) return;

        if(!confirm(`選択した ${count} 体を博士に送りますか？\n(高レアリティほど多くのアメを入手できます)`)) return;

        try {
            let successCount = 0;
            let totalCandy = 0;
            const targets = Array.from(this.bulkSelection);
            
            targets.forEach(uid => {
                const gained = (app.data.releaseUnit) ? app.data.releaseUnit(uid) : 0;
                if(typeof gained === 'number' && gained > 0) {
                    successCount++;
                    totalCandy += gained;
                } else if (gained === true) {
                    successCount++;
                    totalCandy++;
                }
            });

            if (successCount > 0) {
                if(app.sound && app.sound.win) app.sound.win();

                this.isBulkMode = false;
                this.bulkSelection.clear();
                this.selectedUid = null;

                if(app.data.inventory.length > 0) {
                    const sorted = [...app.data.inventory].sort((a,b) => b.createTime - a.createTime);
                    this.selectedUid = sorted[0].uid;
                }

                const panel = document.getElementById('enh-panel');
                if(panel) panel.innerHTML = '';
                this.refresh();

                setTimeout(() => {
                    alert(`${successCount} 体を送り、アメを合計 ${totalCandy} 個手に入れました！`);
                }, 200);

            } else {
                alert("送信できませんでした。");
            }
        } catch (e) {
            console.error(e);
            this.isBulkMode = false;
            this.refresh();
        }
    }

   // --- 詳細パネル更新 (修正版) ---
  updateDetailPanel() {
        const panel = document.getElementById('enh-panel');
        if(!panel) return;

        // 【一括モード時】
        if (this.isBulkMode) {
            this.detailHtmlCache = '';
            const count = this.bulkSelection.size;
            panel.innerHTML = `
                 <div class="bulk-top-strip">
                    <div class="bulk-top-title">一括送付モード</div>
                    <div class="bulk-top-count">選択: <span>${count}</span> 体</div>
                    <button class="btn-bulk-cancel compact" onclick="app.enhanceScreen.toggleBulkMode()">キャンセル</button>
                    <button class="btn-bulk-exec compact ${count===0?'disabled':''}" onclick="app.enhanceScreen.execBulkTransfer()">送る</button>
                </div>
            `;
            return;
        }

        // 【通常モード時】
        if(!this.selectedUid) {
           this.detailHtmlCache = '';
           panel.innerHTML = this.renderOwnedSummaryStrip();
            return;
        }

        const unit = app.data.getUnitInstance(this.selectedUid);
        if(!unit) { this.selectedUid = null; this.refresh(); return; }

        const rarityClass = (unit.base.cost >= 5) ? ' rarity-ur' : '';

        // --- データ準備 ---
        const skillBase = unit.base.skill || {name:'なし', desc:'-'};
        
        // ★修正: 計算済みのスキル説明文を取得して skill オブジェクトを再定義
        const skillDesc = (typeof unit.getSkillCurrentDesc === 'function') 
            ? unit.getSkillCurrentDesc() 
            : skillBase.desc;
            
        const skill = { name: skillBase.name, desc: skillDesc };

        const passive = unit.base.passive || {name:'-', desc:'-'};
        const abilities = unit.getAbilityStatus(); 
        const imgUrl = (typeof IMG_DATA !== 'undefined' && IMG_DATA[unit.base.id]) ? `url('${IMG_DATA[unit.base.id]}')` : 'none';
        
        // ★左カラムの背景用にURLを取得
        const bgUrl = this.getCardBgUrl(unit.base.type, unit.base.cost);
        
        const lbBadge = unit.lbCount >= 5 
            ? '<span class="f-lb-max">👑MAX</span>' 
            : `<span class="f-lb-val">凸${unit.lbCount}</span>`;

        // ステータス計算
        const lvPct = (unit.save.lv / unit.save.maxLv) * 100;
        const hpPct = Math.min(100, (unit.maxHp / 2500) * 100);
        const atkPct = Math.min(100, (unit.atk / 800) * 100);
        const spdPct = Math.min(100, (unit.spd / 30) * 100);
        
        const lvCostGold = unit.save.lv * 100; 
        const skillCostCandy = 15; // ★アメ15個/Lv (MAX合計135 ≈ 3体分)
        const lbCostGold = 5000; 
        const lbCostCandy = 50; 
        const candyCount = (app.data.candies && app.data.candies[unit.base.id]) || 0;

        const isMaxLv = unit.save.lv >= unit.save.maxLv;
        const isMaxSkill = unit.save.skillLv >= 10;
        const isMaxLb = unit.save.maxLv >= 75;

        const lockIcon = unit.isLocked ? '🔒' : '🔓';
        const lockClass = unit.isLocked ? 'locked' : 'unlocked';
        const lockBtnHtml = `<button class="btn-lock-toggle ${lockClass}" onclick="app.enhanceScreen.toggleLock()">${lockIcon}</button>`;

        let abilityHtml = `<div class="f-ability-list-compact">`;
        
        abilities.forEach(ab => {
            const statusClass = ab.unlocked ? 'unlocked' : 'locked';
            const icon = ab.unlocked ? '✨' : '🔒';
            abilityHtml += `<div class="f-ab-item ${statusClass}"><span class="icon">${icon}</span> ${ab.text}</div>`;
        });
        abilityHtml += `</div>`;

        let equipHtml = '';
         if (app.data.cardManager) {
             // ★正しい装備データの保存場所を読み込むように修正
             const equipCards = app.data.getUnitEquips ? app.data.getUnitEquips(unit.uid) : ((app.data.unitEquips && app.data.unitEquips[unit.uid]) || {});
             const cm = app.data.cardManager;
             const slots = [
                 { id: 'red', name: '🟥' },
                 { id: 'yellow', name: '🟨' },
                 { id: 'blue', name: '🟦' },
                 { id: 'purple', name: '🟪' }
             ];

             equipHtml = `
             <div class="f-section-compact c-equip">
                 <div class="head" style="color:#aaa;">EQUIPPED CARDS</div>
                 <div style="display: flex; gap: 4px; margin-top: 2px;">`;
                 
             slots.forEach(slot => {
                 const cardId = equipCards[slot.id];
                 const card = cardId ? cm.getCard(cardId) : null;
                 if (card) {
                     const rank = cm.getCardRank(card);
                     const rankChar = rank.charAt(0);
                     const eff = typeof CARD_EFFECTS !== 'undefined' ? CARD_EFFECTS[card.effectType] : null;
                     const effName = eff ? eff.name : '?';
                     const cardImagePath = `images/card_bg_${card.color}.webp`;
                     
                     equipHtml += `
                     <div style="flex: 1; aspect-ratio: 3/4; border-radius: 4px; overflow: hidden; position: relative; background: url('${cardImagePath}') center/contain no-repeat; background-color: transparent;">
                         <div style="position: absolute; top: 1px; left: 0; width: 100%; text-align: center; font-size: 6px; color: #ffd700; text-shadow: 1px 1px 0 #000; letter-spacing: -1px;">${'★'.repeat(card.awakening)}</div>
                         <div style="position: absolute; top: 6px; right: 2px; width: 14px; height: 14px; border-radius: 50%; border: 1px solid #fff; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: bold; color: #fff; background: rgba(0,0,0,0.6); box-shadow: 0 1px 2px rgba(0,0,0,0.8);">${rankChar}</div>
                         <div style="position: absolute; bottom: 0; left: 0; width: 100%; background: rgba(0,0,0,0.75); color: #fff; font-size: 8px; text-align: center; padding: 2px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: bold;">${effName}</div>
                     </div>`;
                 } else {
                     equipHtml += `
                     <div style="flex: 1; aspect-ratio: 3/4; border: 1px dashed #666; border-radius: 4px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.3);">
                         <span style="font-size: 10px; opacity: 0.5;">${slot.name}</span>
                     </div>`;
                 }
             });
             equipHtml += `</div></div>`;
         }

        const rarity = this.getRarityInfo(unit.base.cost);
        
        let gridHtml = '<div class="shape-icon-large">';
        unit.base.shape.grid.forEach(bit => { gridHtml += `<div class="shape-cell-dot-large ${bit?'on':''}"></div>`; });
        gridHtml += '</div>';

        const isInDeck = app.data.deck.some(d => d.uid === unit.uid);
        const canTransfer = !unit.isLocked && !isInDeck;
        
        const transferBtn = `<button class="btn-transfer ${canTransfer?'':'disabled'}" onclick="app.enhanceScreen.transferUnit()">
            ${unit.isLocked ? 'ロック中' : (isInDeck ? '編成中' : '博士に送る (🍬+)')}
        </button>`;
      const bulkStartBtn = `<button class="btn-bulk-start" onclick="app.enhanceScreen.startBulkFromDetail()">一括整理</button>`;
        // ★★★ レイアウト構築 ★★★
        const detailHtml = `
            <div class="enh-new-layout">
                
                <div class="enh-col-left" style="background-image: ${bgUrl}; background-size: cover; background-position: center;">
                    
                    <div class="enh-name-header">
                        <div class="f-name-center">${unit.base.name}</div>
                    </div>

                    <div class="enh-visual-box${rarityClass}">
                        <div class="enh-bg-base" style="background-image:${bgUrl};"></div>
                        <div class="enh-chara-img" style="background-image:${imgUrl}"></div>
                        
                        <div class="visual-top-left">${gridHtml}</div>
                        <div class="visual-top-right">${lockBtnHtml}</div>
                        <div class="visual-bottom-left">
                            <span class="f-rarity" style="color:${rarity.color}">${rarity.stars}</span>
                            <div class="type-badge type-${unit.base.type}">${TYPES[unit.base.type].name}</div>
                        </div>
                        <div class="visual-bottom-right">
                            ${lbBadge}
                            <span class="candy-stock-overlay">🍬${candyCount}</span>
                        </div>
                    </div>

                    <div class="enh-status-bars-compact">
                        <div class="es-row"><div class="es-bg-bar"><div class="es-fill-bar" style="width:${lvPct}%; background:linear-gradient(90deg, #d4af37, #f0e68c);"></div></div><div class="es-text"><span class="lbl">LV</span><span class="val">${unit.save.lv}<span class="max">/${unit.save.maxLv}</span></span></div></div>
                        <div class="es-row"><div class="es-bg-bar"><div class="es-fill-bar" style="width:${hpPct}%; background:linear-gradient(90deg, #006400, #00ff00);"></div></div><div class="es-text"><span class="lbl">HP</span><span class="val">${unit.maxHp}</span></div></div>
                        <div class="es-row"><div class="es-bg-bar"><div class="es-fill-bar" style="width:${atkPct}%; background:linear-gradient(90deg, #8b0000, #ff4500);"></div></div><div class="es-text"><span class="lbl">ATK</span><span class="val">${unit.atk}</span></div></div>
                        <div class="es-row"><div class="es-bg-bar"><div class="es-fill-bar" style="width:${spdPct}%; background:linear-gradient(90deg, #008b8b, #00ffff);"></div></div><div class="es-text"><span class="lbl">SPD</span><span class="val">${unit.spd}</span></div></div>
                    </div>
                </div>

                <div class="enh-col-right">
                    <div class="enh-specs-list-top">
                        <div class="f-section-compact c-skill">
                            <div class="head">SKILL: ${skill.name} <span class="lv">Lv.${unit.save.skillLv}</span></div>
                            <div class="desc">${skill.desc}</div>
                        </div>
                        <div class="f-section-compact c-passive">
                            <div class="head">PASSIVE: ${passive.name || 'なし'}</div>
                            <div class="desc">${passive.desc || '-'}</div>
                        </div>
                        <div class="f-section-compact c-ability">
                            <div class="head">ABILITY (凸ボーナス)</div>
                            ${abilityHtml}
                        </div>
                        
                        ${equipHtml}

                    </div>

                    <div class="enh-ctrl-buttons-grid-mid">
                        <button class="btn-enh ${isMaxLv?'disabled':''}" onclick="app.enhanceScreen.levelUp()">
                            <div class="main">強化</div><div class="sub">💰${lvCostGold}</div>
                        </button>
                        <button class="btn-enh ${isMaxSkill?'disabled':''}" onclick="app.enhanceScreen.skillUp()">
                            <div class="main">技強</div><div class="sub">🍬${skillCostCandy}</div>
                        </button>
                        <button class="btn-enh lb ${isMaxLb?'disabled':''}" onclick="app.enhanceScreen.limitBreak()">
                            <div class="main">限界突破</div><div class="sub">🍬${lbCostCandy}</div>
                        </button>
                    </div>

                    <div class="enh-bottom-actions">
                        ${transferBtn}
                        ${bulkStartBtn}
                    </div>
                </div>
            </div>
        `;
        this.detailHtmlCache = detailHtml;
       panel.innerHTML = this.renderOwnedSummaryStrip();
    }

    renderList() {
        const list = document.getElementById('enhance-list');
        if(!list) return;
        list.innerHTML = '';
        
       const inventory = this.getFilteredInventory();

        inventory.forEach(save => {
            const base = DB.find(u => u.id === save.unitId);
            if(!base) return;
            
            const unit = new Unit(base, save); 
            const el = document.createElement('div');
            
             let className = `list-card portrait-style type-${base.type}`;
            if (base.cost >= 5) className += ' rarity-ur';
            const isInDeck = app.data.deck.some(d => d.uid === unit.uid);
            const isLocked = unit.isLocked;

            if (this.isBulkMode) {
                if (this.bulkSelection.has(unit.uid)) className += ' bulk-selected';
                if (isInDeck || isLocked) className += ' bulk-disabled';
                el.onclick = () => { this.toggleBulkSelect(unit.uid); };
            } else {
                if (this.selectedUid === unit.uid) className += ' selected';
                if (isInDeck) className += ' in-deck';
                el.onclick = () => { app.sound.tap(); this.select(unit.uid); };
            }
            el.className = className;
            
            // 背景画像（編成画面と統一）
            const charImg = IMG_DATA[base.id] ? `url('${IMG_DATA[base.id]}')` : 'none';
            const bgImg = `url('${this.getCardBgUrl(base.type, base.cost)}')`;
            el.style.backgroundImage = `${charImg}, ${bgImg}`;
            el.style.backgroundSize = "cover, cover";
            
            // バッジ類
           
           const lockHtml = isLocked ? '<div class="card-lock-mark">🔒</div>' : '';
            const checkHtml = (this.isBulkMode && this.bulkSelection.has(unit.uid)) 
                ? '<div class="lc-bulk-selected-label"><div>✔</div>選択済</div>' : '';

            // グリッド生成（編成画面と統一）
            let gridHtml = '<div class="shape-icon">';
            unit.base.shape.grid.forEach(bit => { gridHtml += `<div class="shape-cell-dot ${bit?'on':''}"></div>`; });
            gridHtml += '</div>';

            // レアリティ（編成画面と統一）
            const rarity = this.getRarityInfo(base.cost);

            // ★編成画面と統一したHTML構造
            el.innerHTML = `
                 <div class="card-lv-label">Lv${unit.save.lv}</div>
                <div class="card-size-badge">${gridHtml}</div>
                <div class="lc-card-stars-bottom"><div class="footer-stars">${rarity.stars}</div></div>
                ${lockHtml}
                ${checkHtml}
                 ${isInDeck ? '<div class="card-deck-mark" style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%) rotate(-15deg); background:rgba(200,0,0,0.8); border:1px solid #fff; padding:2px 5px; font-size:10px; z-index:26;">編成中</div>' : ''}
            `;
            list.appendChild(el);
        });
    }

    select(uid) {
        this.selectedUid = uid;
        this.updateDetailPanel();
        this.renderList();
        this.openDetailModal();
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

    levelUp() { 
        const unit = app.data.getUnitInstance(this.selectedUid);
        if(!unit) return;
        const cost = unit.save.lv * 100;
        if(!app.data.consumeGold(cost)) { alert("Goldが足りません"); return; }
        if (unit.levelUp()) {
            app.sound.heal();
            app.data.saveStats();
            this.refresh();
            this.showEnhanceEffect('lv');
        }
    }
    skillUp() {
        const unit = app.data.getUnitInstance(this.selectedUid);
        if(!unit) return;
        const cost = 15;
        const have = app.data.candies[unit.base.id] || 0;
        if(have < cost) { alert("アメが足りません（必要:" + cost + " 所持:" + have + "）"); return; }
        app.data.consumeCandy(unit.base.id, cost);
        if (unit.skillUp()) {
            app.sound.heal();
            app.data.saveStats();
            this.refresh();
            this.showEnhanceEffect('skill');
        }
    }
   limitBreak() { 
        const unit = app.data.getUnitInstance(this.selectedUid);
        if(!unit) return;
        
        // ★修正: Goldのコスト定義を削除（または0にする）
        // const costGold = 5000; 
        const costCandy = 50;

        if((app.data.candies[unit.base.id] || 0) < costCandy) { alert(`アメが足りません`); return; }
        
        // ★修正: Goldの不足チェックを削除
        // if(app.data.gold < costGold) { alert("Goldが足りません"); return; }
        
        if (unit.limitBreak()) {
            // ★修正: Goldの消費処理を削除
            // app.data.consumeGold(costGold);
            
            app.data.consumeCandy(unit.base.id, costCandy);
            app.sound.win();
            app.data.saveStats();
            this.refresh();
            this.showEnhanceEffect('lb');
        }
    }
    transferUnit() {
        const unit = app.data.getUnitInstance(this.selectedUid);
        if(!unit) return;
       let estimate = 50;
        /*
        if(unit.base.cost >= 5) estimate = 100;
        else if(unit.base.cost >= 3) estimate = 50;
        */

        if(!confirm(`「${unit.base.name}」を博士に送りますか？\n(アメ +${estimate}個)`)) return;
        
        const gained = app.data.releaseUnit(this.selectedUid);
        if(gained > 0) {
            app.sound.tap();
            this.selectedUid = null;
            this.refresh();
            alert(`博士に送りました。\nアメを ${gained} 個手に入れました！`);
        } else {
            alert("デッキに編成中のキャラは送れません。");
        }
    }

   showEnhanceEffect(type) {
        // 1. キャラクターの跳ねるアニメーション
        const charImg = document.querySelector('.enh-chara-img');
        if (charImg) {
            charImg.classList.remove('anim-enhance-bounce');
            void charImg.offsetWidth; // リフロー（アニメーション再トリガー用）
            charImg.classList.add('anim-enhance-bounce');
        }

        // 2. テキスト演出 (LEVEL UP! など)
        // ★修正: 新しいレイアウトの画像エリア (.enh-visual-box) をターゲットにする
        const container = document.querySelector('.enh-visual-box'); 
        if (!container) return;

        const floatEl = document.createElement('div');
        floatEl.className = 'enh-float-text';
        
        let text = "";
        let color = "#fff";
        let glow = "#fff";

        if (type === 'lv') {
            text = "LEVEL UP!";
            color = "#ffd700"; // 金色
            glow = "#ff4500";  // オレンジ光
        } else if (type === 'skill') {
            text = "SKILL UP!";
            color = "#00ffff"; // 水色
            glow = "#0088ff";  // 青光
        } else if (type === 'lb') {
            text = "LIMIT BREAK!";
            color = "#ff00ff"; // ピンク
            glow = "#8800ff";  // 紫光
        }

        floatEl.innerText = text;
        floatEl.style.color = color;
        // 文字を見やすくするためのフチ取りと発光
        floatEl.style.textShadow = `
            2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000,
            0 0 10px ${glow}, 0 0 20px ${glow}
        `;

        container.appendChild(floatEl);

        // アニメーション終了後に削除
        setTimeout(() => { 
            if(floatEl.parentNode) floatEl.remove(); 
        }, 1500);
    }

}