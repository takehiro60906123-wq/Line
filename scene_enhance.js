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
        this.injectStyles();
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

 /* scene_enhance.js - EnhanceScreenクラス内 injectStylesメソッド (スタイル重複バグ修正版) */

    // --- CSS注入 (強力リセット版) ---
    injectStyles() {
        // ★修正: 過去のあらゆるバージョンのスタイルを削除する
        // (IDが v20〜v30 などのパターンになっているものを全て消す)
        const oldStyles = document.querySelectorAll('style[id^="enhance-style-final"]');
        oldStyles.forEach(el => el.remove());

        const style = document.createElement('style');
        style.id = 'enhance-style-final-v29'; // 最新ID
        style.innerHTML = `
            /* ベースレイアウト */
            #screen-enhance {
                background: linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url('images/bg_main.webp') center/cover no-repeat !important;
                display: none; flex-direction: column; height: 100dvh; overflow: hidden !important;
            }
            #screen-enhance.active { display: flex !important; }
            
            #enh-panel.enhance-layout-panel {
                flex: 0 0 62px !important; padding: 0 !important; margin: 0 !important;
                border-bottom: 2px solid #555 !important;
                background-color: rgba(8, 12, 20, 0.9) !important;
                overflow: hidden !important;
                 display: flex; align-items: center; justify-content: center;
            }
            #enh-panel .empty-msg { color: #bcd; font-size: 12px; }

             .enh-owned-strip {
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: flex-start;
                padding: 6px 10px;
                box-sizing: border-box;
                overflow: hidden;
            }
            .enh-owned-title {
                flex: 0 0 auto;
                font-size: 12px;
                color: #d6f4ff;
                font-weight: 700;
                white-space: nowrap;
            }
             .bulk-top-strip {
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 6px 8px;
                box-sizing: border-box;
                background: rgba(20, 24, 30, 0.95);
            }
            .bulk-top-title { color: #00d8ff; font-size: 11px; font-weight: 700; white-space: nowrap; }
            .bulk-top-count { color: #d8eaff; font-size: 10px; white-space: nowrap; }
            .bulk-top-count span { color: #ffd54f; font-weight: 700; }
            .btn-bulk-cancel.compact,
            .btn-bulk-exec.compact {
                padding: 5px 8px;
                font-size: 10px;
                border-radius: 4px;
                border: 1px solid #666;
                line-height: 1;
                white-space: nowrap;
            }
            .btn-bulk-cancel.compact { background: #353535; color: #fff; }
            .btn-bulk-exec.compact { background: #7a0000; color: #fff; border-color: #c33; }
            .btn-bulk-exec.compact.disabled { opacity: 0.45; pointer-events: none; }

            .enh-detail-modal {
                position: fixed; inset: 0; display: none; z-index: 12000;
                align-items: center; justify-content: center;
                background: rgba(0,0,0,0.72);
                padding: 12px;
            }
            .enh-detail-modal-card {
                width: min(96vw, 980px);
                max-height: 92vh;
                overflow: auto;
                border: 2px solid #d4af37;
                border-radius: 10px;
                background: #0b1020;
                box-shadow: 0 16px 38px rgba(0,0,0,0.6);
                position: relative;
            }
            .enh-detail-modal-close {
                position: sticky;
                top: 8px;
                float: right;
                margin: 8px 8px 0 0;
                width: 34px;
                height: 34px;
                border-radius: 50%;
                border: 1px solid #b99;
                background: #3a1a1a;
                color: #fff;
                font-size: 20px;
                z-index: 2;
            }

              #enh-detail-modal-body { clear: both; }
            .enh-new-layout { display: flex; width: 100%; height: 100%; }

       /* === 左カラム === */
.enh-col-left {
    flex: 0 0 45%; display: flex; flex-direction: column;
    border-right: 1px solid #444;
    
    /* ★修正: imageを消さないように color だけ透明にする */
    background-color: transparent !important; 
    
    /* 念のためサイズ指定などもCSS側で補強 */
    background-size: cover !important;
    background-position: center !important;
    background-repeat: no-repeat !important;
}

            /* 1. 名前エリア */
            .enh-name-header {
                flex: 0 0 auto; padding: 8px 4px; background: rgba(0,0,0,0.6) !important; /* 半透明に変更 */
    border-bottom: 1px solid rgba(255,255,255,0.2);
                display: flex; flex-direction: column; align-items: center; justify-content: center;
            }
            .f-name-center { 
                font-size: 16px; font-weight: bold; color: #fff; 
                text-shadow: 0 0 5px #00ced1; text-align: center;
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;
            }

            /* 2. 画像エリア */
            .enh-visual-box {
                flex: 1; position: relative; overflow: hidden; border-bottom: 1px solid #444;
                /* 背景色をカードリストと同じ色に設定 */
                background-color: transparent !important;
            }
            
            /* ★重要修正: opacityを1.0にし、かつ !important をつけて強制適用 */
     .enh-bg-base { 
    /* ★修正: 絶対配置にして親要素いっぱいに広げ、キャラの後ろ(z-index:0)に置く */
    position: absolute !important;
    top: 0; left: 0;
    width: 100%; height: 100%; 
    
    background-size: cover; background-position: center; 
    opacity: 1.0 !important; 
    filter: brightness(1.0);
    z-index: 0; 
}
            
            .enh-chara-img { 
                position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);
                width: 100%; height: 95%; 
                background-size: contain; background-repeat: no-repeat; background-position: center bottom; 
                z-index: 2; filter: drop-shadow(0 0 5px rgba(0,0,0,0.8));
            }

            /* --- 画像内配置要素 --- */
            
            /* 左上: 射程アイコン (大) */
            .visual-top-left {
                position: absolute; top: 6px; left: 6px; z-index: 10;
                background: rgba(0,0,0,0.6); padding: 4px; border-radius: 4px;
                border: 1px solid rgba(255,255,255,0.3);
            }
            .shape-icon-large { display: grid; grid-template-columns: repeat(2, 6px); gap: 2px; }
            .shape-cell-dot-large { width: 6px; height: 6px; background: #444; border-radius: 1px; }
            .shape-cell-dot-large.on { background: #0f0; box-shadow: 0 0 4px #0f0; }

            /* 右上: ロックボタン */
            .visual-top-right {
                position: absolute; top: 6px; right: 6px; z-index: 10;
            }
            .btn-lock-toggle { 
                width: 32px; height: 32px; border-radius: 50%; border: 2px solid #fff; 
                display: flex; align-items: center; justify-content: center; 
                font-size: 18px; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.5); 
            }
            .btn-lock-toggle.locked { background: #ff4500; border-color: #ff4500; color: #fff; }
            .btn-lock-toggle.unlocked { background: rgba(0,0,0,0.6); border-color: #aaa; color: #aaa; }

            /* 左下: レアリティ & タイプ */
            .visual-bottom-left {
                position: absolute; bottom: 4px; left: 4px; z-index: 5;
                display: flex; flex-direction: column; align-items: flex-start; gap: 2px;
            }
            .f-rarity { font-size: 10px; text-shadow: 1px 1px 0 #000; letter-spacing: -1px; }
            .type-badge { font-size: 9px; padding: 1px 6px; border-radius: 4px; background: #444; color: #fff; border: 1px solid #fff; }
            .type-badge.type-0 { background: #e100ff; } 
            .type-badge.type-1 { background: #ff8c00; }
            .type-badge.type-2 { background: #ff69b4; }
            .type-badge.type-3 { background: #4caf50; }
            .type-badge.type-4 { background: #607d8b; }
            .type-badge.type-5 { background: #795548; }

            /* 右下: 凸 & アメ */
            .visual-bottom-right {
                position: absolute; bottom: 4px; right: 4px; z-index: 5;
                display: flex; flex-direction: column; align-items: flex-end; gap: 2px;
            }
            .f-lb-val { background: #000; color: #fff; font-size: 10px; padding: 1px 6px; border-radius: 4px; border: 1px solid #fff; font-weight: bold; }
            .f-lb-max { background: linear-gradient(45deg, #ffd700, #ff8c00); color: #000; font-size: 10px; padding: 1px 6px; border-radius: 4px; border: 1px solid #fff; font-weight: bold; }
            .candy-stock-overlay { background: rgba(0,0,0,0.8); color: #fff; font-size: 10px; padding: 1px 6px; border-radius: 4px; border: 1px solid #aaa; }


            /* 3. ステータスバー */
            .enh-status-bars-compact {
                flex: 0 0 auto; padding: 4px; background: rgba(0,0,0,0.6) !important;; display: flex; flex-direction: column; gap: 2px;
            }
            .es-row { position: relative; width: 100%; height: 16px; background: #222; border: 1px solid #444; border-radius: 2px; }
            .es-bg-bar { position: absolute; top:0; left:0; width:100%; height:100%; }
            .es-fill-bar { height: 100%; opacity: 0.7; }
            .es-text { position: absolute; top:0; left:0; width:100%; height:100%; display: flex; justify-content: space-between; align-items: center; padding: 0 4px; z-index: 2; font-size: 9px; font-family: monospace; color: #fff; text-shadow: 1px 1px 0 #000; }
            .es-text .lbl { color: #aaa; font-weight: bold; font-size: 8px; }

            /* === 右カラム === */
         .enh-col-right {
    flex: 1; display: flex; flex-direction: column;
    
    /* ★修正: 編成画面の詳細パネルと同じ色 (紺色 + 透過) */
    background: rgba(10, 15, 30, 0.75) !important;
    backdrop-filter: blur(4px);
    
    /* お好みで左に境界線を入れる */
    border-left: 1px solid rgba(255, 215, 0, 0.3);
    
    padding: 6px; gap: 6px; overflow: hidden;
}

            /* 1. スペック詳細 (上部) */
            .enh-specs-list-top {
               flex: 0 0 70%;
                max-height: 70%;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .f-section-compact { padding: 3px 4px; background: rgba(0,0,0,0.3); border-left: 3px solid #555; border-radius: 2px; }
            .f-section-compact .head { font-size: 10px; font-weight: bold; margin-bottom: 1px; color: #ccc; }
            .f-section-compact .desc { font-size: 9px; color: #999; line-height: 1.15; }
            .c-skill { border-color: #00ced1; } .c-skill .head { color: #00ced1; }
            .c-passive { border-color: #ffd700; } .c-passive .head { color: #ffd700; }
            .c-ability { border-color: #f0f; } .c-ability .head { color: #f0f; }

            .f-ability-list-compact { display: flex; flex-wrap: wrap; gap: 4px; }
            .f-ab-item { font-size: 9px; padding: 2px 4px; background: #333; border-radius: 2px; color: #666; }
            .f-ab-item.unlocked { color: #fff; background: #444; border: 1px solid #666; }

            /* 2. 強化ボタン群 (中段) */
            .enh-ctrl-buttons-grid-mid {
                flex-shrink: 0; display: flex; gap: 4px;
            }
            .btn-enh { 
                flex: 1; height: 40px; border-radius: 4px; border: 1px solid #555; 
                background: linear-gradient(#444, #222); color: #fff; cursor: pointer;
                display: flex; flex-direction: column; align-items: center; justify-content: center;
            }
            .btn-enh:active { transform: translateY(1px); }
            .btn-enh.lb { border-color: #d0d; background: linear-gradient(#707, #404); }
            .btn-enh.disabled { opacity: 0.4; pointer-events: none; filter: grayscale(100%); }
            .btn-enh .main { font-size: 12px; font-weight: bold; }
            .btn-enh .sub { font-size: 9px; color: #aaa; }

            /* 3. アクションボタン (下部) */
            .enh-bottom-actions {
                flex-shrink: 0; display: flex; gap: 6px;
            }
            .btn-transfer { flex: 2; background: #300; border: 1px solid #800; color: #fcc; font-size: 11px; padding: 10px; border-radius: 4px; font-weight: bold; }
            .btn-transfer:active { background: #500; color: #fff; }
            .btn-bulk-start { flex: 1; background: #003; border: 1px solid #008; color: #ccf; font-size: 11px; padding: 10px; border-radius: 4px; font-weight: bold; }
            .btn-bulk-start:active { background: #005; color: #fff; }
.btn-bulk-start.top-inline { margin-left: auto; flex: 0 0 auto; padding: 6px 10px; font-size: 10px; }

            /* 一括モードなど */
            .bulk-panel-container { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #222; }
            .bulk-title { font-size: 18px; color: #00ced1; font-weight: bold; margin-bottom: 10px; }
            .bulk-count .num { font-size: 32px; color: #ff4500; font-weight: bold; }
            .bulk-actions { display: flex; gap: 10px; margin-top: 20px; width: 80%; }
            .btn-bulk-cancel { flex: 1; padding: 10px; background: #444; color: #fff; border: none; border-radius: 4px; }
            .btn-bulk-exec { flex: 1; padding: 10px; background: #900; color: #fff; border: 1px solid #f00; border-radius: 4px; }
            /* ★追加: 一括選択時のカードスタイル */
            .list-card.bulk-selected {
                border: 2px solid #ff4500;
                box-shadow: 0 0 8px #ff4500;
                transform: scale(0.95); /* 少し凹ませる */
            }

            /* ★追加: 「選択済」のオーバーレイ表示 */
            .lc-bulk-selected-label {
                position: absolute;
                top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0, 0, 0, 0.6); /* 背景を暗く */
                color: #ff4500; /* 文字色（赤オレンジ） */
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                font-weight: 900;
                text-shadow: 1px 1px 0 #fff; /* 白フチ */
                z-index: 30;
                pointer-events: none;
                animation: checkPop 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            }
            .lc-bulk-selected-label div {
                font-size: 24px;
                line-height: 1;
                margin-bottom: 2px;
                color: #ff4500;
                text-shadow: 2px 2px 0 #fff;
            }

            @keyframes checkPop {
                0% { transform: scale(0); opacity: 0; }
                100% { transform: scale(1); opacity: 1; }
            }
            /* リストエリア */
            .enhance-list-area { flex: 1; background: #111 !important; border-top: 2px solid #333 !important; padding: 6px !important; overflow: hidden; }
            .enhance-list-area .card-list { display: grid !important; grid-template-columns: repeat(auto-fill, minmax(70px, 1fr)); gap: 6px !important; overflow-y: auto !important; overflow-x: hidden !important; -webkit-overflow-scrolling: touch; padding: 4px !important; align-items: start; }
            .enhance-list-area .card-list .list-card { width: 100% !important; min-width: 0 !important; aspect-ratio: 3 / 4; }
            
           .tab-area { 
                display: flex; 
                width: 100%;             /* 横幅いっぱい */
                justify-content: space-between; /* 均等配置 */
                gap: 2px; 
                padding: 4px 2px;        /* 外側の余白を詰める */
                background: #222; 
                border-bottom: 1px solid #333; 
                box-sizing: border-box;
                overflow-x: hidden;      /* スクロールバーを出さない */
                white-space: nowrap;     /* 折り返し禁止 */
            }

            .tab-btn { 
                flex: 1;                 /* 全ボタンを均等幅に伸縮させて収める */
                background: #333; 
                border: 1px solid #555; 
                color: #888; 
                padding: 6px 0;          /* ★重要: 横パディングを0にする */
                border-radius: 4px; 
                font-size: 9px;          /* ★重要: 少し小さくして確実に入れる */
                white-space: nowrap;     /* 文字折り返し禁止 */
                display: flex; 
                align-items: center; 
                justify-content: center; 
                min-width: 0;            /* Flexboxでの縮小を許可 */
                cursor: pointer;
            }
            
            .tab-btn.active { background: #00ced1; color: #000; border-color: #00ced1; font-weight: bold; }
            /* カード */
            .list-card { width: 100%; aspect-ratio: 3/4; border: 1px solid #444; border-radius: 4px; position: relative; background-size: cover; background-position: center; background-color: #222; }
            .list-card.selected { border: 2px solid #00ced1; box-shadow: 0 0 5px #00ced1; transform: scale(1.05); z-index: 5; }
            /* ★追加: 編成中マークのデザイン */
            .deck-mark {
                position: absolute;
                top: 50%; left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(255, 69, 0, 0.85); /* 朱色っぽい背景 */
                color: white;
                font-size: 10px;
                font-weight: bold;
                padding: 2px 8px;
                border-radius: 4px;
                border: 1px solid #fff;
                z-index: 20;
                white-space: nowrap;
                box-shadow: 0 2px 5px rgba(0,0,0,0.5);
                pointer-events: none;
            }
            
            /* ★追加: 編成中は少し暗くする */
            .list-card.in-deck {
                filter: brightness(0.7); 
            }
            .lc-lv-badge { position: absolute; top:0; right:0; background:rgba(0,0,0,0.7); color:#fff; font-size:9px; padding:0 2px; }
            .card-lock-mark { position:absolute; top:3px; left:3px; font-size:12px; z-index:22; text-shadow:0 0 2px #000; }

                /* 編成画面と統一したカード表示（所持一覧） */
            #enhance-list .list-card.portrait-style {
                border: 2px solid rgba(255,255,255,0.35);
                border-radius: 6px;
                box-shadow: 0 0 8px rgba(0,0,0,0.5);
                background-size: cover, cover;
                background-position: center, center;
            }
            #enhance-list .list-card.portrait-style.selected {
                border-color: #ffd700;
                box-shadow: 0 0 10px #ffd700;
            }
            #enhance-list .list-card.portrait-style.in-deck {
                opacity: 0.85;
                filter: saturate(0.95);
            }
            #enhance-list .list-card.portrait-style .card-lv-label {
                position: absolute;
                top: 3px;
                right: 3px;
                background: rgba(0,0,0,0.75);
                border: 1px solid rgba(255,255,255,0.35);
                border-radius: 3px;
                color: #fff;
                font-size: 10px;
                padding: 1px 4px;
                z-index: 21;
            }
            #enhance-list .list-card.portrait-style .card-size-badge {
                position: absolute;
                top: 3px;
                left: 3px;
                background: rgba(0,0,0,0.62);
                border: 1px solid rgba(255,255,255,0.2);
                border-radius: 3px;
                padding: 2px;
                z-index: 21;
            }
            #enhance-list .list-card.portrait-style .shape-icon { display:grid; grid-template-columns:repeat(2,6px); gap:1px; }
            #enhance-list .list-card.portrait-style .shape-cell-dot { width:6px; height:6px; background:#444; border-radius:1px; }
            #enhance-list .list-card.portrait-style .shape-cell-dot.on { background:#39ff14; box-shadow:0 0 3px #39ff14; }
            #enhance-list .list-card.portrait-style .lc-card-stars-bottom {
                position: absolute;
                left: 0;
                bottom: 0;
                width: 100%;
                background: linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0.4));
                padding: 1px 2px 2px;
                z-index: 20;
            }
            #enhance-list .list-card.portrait-style .footer-stars {
                color: #ffd700;
                font-size: 10px;
                letter-spacing: -1px;
                text-shadow: 1px 1px 0 #000;
                white-space: nowrap;
            }

            /* =========================================
               強化画面専用：光沢エフェクト (Kira-Kira Effect)
               ========================================= */
            
            /* マスク設定 */
            #enhance-list .list-card,
            .enh-visual-box {
                position: relative;
                overflow: hidden; 
                z-index: 1;
            }

            /* 共通：光沢の本体（斜めの光） */
            #enhance-list .list-card::after,
            .enh-visual-box::after {
                content: '';
                position: absolute;
                top: 0; left: -150%; 
                width: 100%; height: 100%;
                
                /* 通常の光 */
                background: linear-gradient(
                    105deg, 
                    rgba(255,255,255,0) 20%, 
                    rgba(255,255,255,0.1) 40%, 
                    rgba(255,255,255,0.5) 50%, 
                    rgba(255,255,255,0.1) 60%, 
                    rgba(255,255,255,0) 80%
                );
                
                transform: skewX(-20deg);
                pointer-events: none;
                
                /* アニメーション (3.5秒周期) */
                animation: kiraShineEnhance 3.5s infinite ease-in-out;
                z-index: 10;
            }

            /* ★高レア(UR)専用：激しい光（黄金） */
            #enhance-list .list-card.rarity-ur::after,
            .enh-visual-box.rarity-ur::after {
                background: linear-gradient(
                    105deg, 
                    rgba(255,255,255,0) 10%, 
                    rgba(255, 230, 150, 0.4) 30%, 
                    rgba(255, 255, 255, 1.0) 50%, 
                    rgba(255, 230, 150, 0.4) 70%, 
                    rgba(255,255,255,0) 90%
                );
                filter: drop-shadow(0 0 5px rgba(255, 215, 0, 0.8));
            }

            /* アニメーション定義 */
            @keyframes kiraShineEnhance {
                0% { left: -150%; opacity: 0; }
                15% { opacity: 1; }
                35% { left: 150%; opacity: 1; }
                100% { left: 150%; opacity: 0; }
            }

            /* 選択不可のカードは光を弱く */
            #enhance-list .list-card.bulk-disabled::after {
                opacity: 0.2;
                filter: none;
            }

            /* 強化時の演出アニメーション */
            .anim-enhance-bounce {
                animation: enhanceBounce 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                z-index: 100 !important; /* 最前面に */
            }

            @keyframes enhanceBounce {
                0% { 
                    transform: translateX(-50%) scale(1); 
                    filter: brightness(1) drop-shadow(0 0 5px rgba(0,0,0,0.8)); 
                }
                30% { 
                    /* 少し拡大して光る */
                    transform: translateX(-50%) scale(1.15) translateY(-10px); 
                    filter: brightness(1.5) drop-shadow(0 0 20px rgba(255,255,255,0.8)); 
                }
                50% { 
                    transform: translateX(-50%) scale(1.1) translateY(-5px); 
                    filter: brightness(1.2) drop-shadow(0 0 15px rgba(255,255,255,0.6)); 
                }
                100% { 
                    transform: translateX(-50%) scale(1); 
                    filter: brightness(1) drop-shadow(0 0 5px rgba(0,0,0,0.8)); 
                }
            }

          /* テキストエフェクト（画面中央から浮き上がる） */
            .enh-float-text {
                position: absolute; 
                top: 50%; left: 50%; 
                transform: translate(-50%, -50%);
                
                /* ★修正: 文字サイズを小さく (32px -> 20px) */
                font-size: 20px; 
                
                font-weight: 900; 
                font-family: 'Arial Black', sans-serif;
                z-index: 200; pointer-events: none;
                white-space: nowrap;
                animation: floatTextAnim 1.2s forwards ease-out;
            }

       .lc-card-footer {
                position: absolute; bottom: 0; left: 0; width: 100%;
                height: 24px; 
                background: rgba(0,0,0,0.85); 
                display: flex; align-items: center; 
                padding-left: 3px; gap: 2px;
                border-radius: 0 0 4px 4px; 
                z-index: 5; overflow: hidden;
            }

          .footer-grid .shape-icon { 
                display: grid; grid-template-columns: 1fr 1fr; gap: 1px; 
                width: 10px; height: 10px; flex-shrink: 0;
            }
            .footer-grid .shape-cell-dot { background: #555; border-radius: 1px; }
            .footer-grid .shape-cell-dot.on { background: #0f0; box-shadow: 0 0 3px #0f0; }

            /* 星 (5つ並び・ピンク対応) */
            .footer-stars { 
                font-size: 9px; line-height: 1; margin-top: -1px; 
                text-shadow: 1px 1px 0 #000; letter-spacing: -1.5px; white-space: nowrap; 
            }
            /* 画像エリアのコンテナ設定 */
            #enh-detail-img {
                position: relative; 
                overflow: hidden; /* はみ出し防止 */
                background-size: cover; 
                background-position: center;
                border-radius: 4px;
                border: 1px solid #666;
            }

            /* 詳細版フッター (大きくする) */
            .lc-card-footer.detail-ver {
                height: 32px; 
                padding-left: 6px; gap: 6px;
            }
            /* 詳細版グリッド */
            .footer-grid.detail-ver .shape-icon {
                width: 16px; height: 16px; gap: 2px;
            }
            /* 詳細版星 */
            .footer-stars.detail-ver {
                font-size: 14px; 
                letter-spacing: -1px;
                margin-top: -2px;
            }
            /* 詳細版レベルバッジ */
            .lc-lv-badge-top.detail-ver {
                font-size: 14px; 
                padding: 3px 10px;
                border-radius: 0 4px 0 8px;
            }
            
            /* 古いレアリティテキスト表示を隠す（もしあれば） */
            #enh-detail-rarity { display: none; }
        `;
        document.head.appendChild(style);
    }
}