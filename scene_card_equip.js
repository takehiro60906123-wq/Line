/**
 * scene_card_equip.js - カード管理画面
 * タブ: カード一覧 | 装備 | 覚醒 | 分解/生成
 */
class CardEquipScreen {
    constructor() {
        this.currentTab = 'list';     // list | equip | awaken | salvage
        this.selectedCardId = null;
        this.selectedUnitUid = null;   // 装備先ユニット
        this.awakenBaseId = null;
        this.awakenMatId = null;
        this.filterColor = 'all';
        this.sortKey = 'level';
        this.injectStyles();
    }

    onEnter(options = {}) {
        if (options && options.tab) this.currentTab = options.tab;
        if (options && options.unitUid) this.selectedUnitUid = options.unitUid;
        this.selectedCardId = null;
        this.awakenBaseId = null;
        this.awakenMatId = null;
        this.render();
    }

    render() {
        const container = document.getElementById('card-screen-content');
        if (!container) return;

        const cm = app.data.cardManager;
        if (!cm) {
            container.innerHTML = '<div style="padding:40px;text-align:center;color:#888;">カードシステム未初期化</div>';
            return;
        }

        let html = this._renderTabs();

        switch (this.currentTab) {
            case 'list':    html += this._renderListTab(); break;
            case 'equip':   html += this._renderEquipTab(); break;
            case 'awaken':  html += this._renderAwakenTab(); break;
            case 'salvage': html += this._renderSalvageTab(); break;
        }

        container.innerHTML = html;
        this._bindEvents();
    }

    setTab(tab) {
        if (app.sound) app.sound.tap();
        this.currentTab = tab;
        this.selectedCardId = null;
        this.awakenBaseId = null;
        this.awakenMatId = null;
        this.render();
    }

    setFilterColor(color) {
        if (app.sound) app.sound.tap();
        this.filterColor = color;
        this.render();
    }

    // =============================================
    // タブバー
    // =============================================
    _renderTabs() {
        const tabs = [
            { id: 'list',    icon: '📋', label: '一覧' },
            { id: 'equip',   icon: '⚔️', label: '装備' },
            { id: 'awaken',  icon: '✨', label: '覚醒' },
            { id: 'salvage', icon: '🔨', label: '分解' }
        ];
        const cm = app.data.cardManager;
        return `
        <div class="card-tab-bar">
            ${tabs.map(t => `
                <button class="card-tab-btn ${this.currentTab === t.id ? 'active' : ''}"
                        onclick="app.cardScreen.setTab('${t.id}')">
                    <span class="ctb-icon">${t.icon}</span>
                    <span class="ctb-label">${t.label}</span>
                </button>
            `).join('')}
        </div>
        <div class="card-inventory-bar">
            <span>📦 ${cm.cards.length}/${cm.maxCards}</span>
            <span class="cib-frags">
                🟥${cm.fragments.red || 0}
                🟨${cm.fragments.yellow || 0}
                🟦${cm.fragments.blue || 0}
                🟪${cm.fragments.purple || 0}
            </span>
        </div>`;
    }

    // =============================================
    // カラーフィルタバー
    // =============================================
    _renderColorFilter() {
        const colors = [
            { id: 'all', label: 'ALL' },
            { id: 'red', label: '🟥赤' },
            { id: 'yellow', label: '🟨黄' },
            { id: 'blue', label: '🟦青' },
            { id: 'purple', label: '🟪紫' }
        ];
        return `<div class="card-color-filter">
            ${colors.map(c => `
                <button class="ccf-btn ${this.filterColor === c.id ? 'active' : ''}"
                        onclick="app.cardScreen.setFilterColor('${c.id}')">${c.label}</button>
            `).join('')}
        </div>`;
    }

    // =============================================
    // フィルタ済みカード取得
    // =============================================
    _getFilteredCards() {
        const cm = app.data.cardManager;
        let cards = cm.getCardsSorted(this.sortKey, false);
        if (this.filterColor !== 'all') {
            cards = cards.filter(c => c.color === this.filterColor);
        }
        return cards;
    }

    // =============================================
    // カード1枚のHTML
    // =============================================
    _renderCardItem(card, options = {}) {
        const cm = app.data.cardManager;
        const eff = CARD_EFFECTS[card.effectType];
        if (!eff) return '';
        const rank = cm.getCardRank(card);
        const isSelected = options.selectedId === card.cardId;
        const isEquipped = this._isCardEquipped(card.cardId);

        let awakenStars = '';
        for (let i = 0; i < 5; i++) {
            awakenStars += i < card.awakening
                ? '<span class="aw-star filled">★</span>'
                : '<span class="aw-star">☆</span>';
        }

        const clickFn = options.onClick || `app.cardScreen.selectCard('${card.cardId}')`;

        return `
        <div class="card-item c-${card.color} ${isSelected ? 'selected' : ''} ${isEquipped ? 'equipped' : ''}"
             onclick="${clickFn}">
            <div class="ci-rank rank-${rank}">${rank}</div>
            <div class="ci-color-dot c-dot-${card.color}"></div>
            <div class="ci-name">${eff.name}</div>
            <div class="ci-level">Lv.${card.level}</div>
            <div class="ci-awaken">${awakenStars}</div>
            ${isEquipped ? '<div class="ci-equipped-badge">装備中</div>' : ''}
        </div>`;
    }

    // =============================================
    // カード詳細パネル
    // =============================================
    _renderCardDetail(cardId) {
        const cm = app.data.cardManager;
        const card = cm.getCard(cardId);
        if (!card) return '<div class="card-detail-empty">カードを選択してください</div>';

        const eff = CARD_EFFECTS[card.effectType];
        const colorInfo = cm.getCardColorInfo(card);
        const rank = cm.getCardRank(card);
        const desc = cm.getCardDescription(card);
        const calcEff = cm.calcCardEffect(card);

        let awakenStars = '';
        for (let i = 0; i < 5; i++) {
            awakenStars += i < card.awakening
                ? '<span class="aw-star-lg filled">★</span>'
                : '<span class="aw-star-lg">☆</span>';
        }

        // 覚醒ボーナス一覧
        let awakenList = '';
        if (eff.awakenBonus) {
            awakenList = eff.awakenBonus.map((b, i) => {
                const unlocked = card.awakening >= b.lv;
                return `<div class="awaken-step ${unlocked ? 'unlocked' : ''}">
                    <span class="as-lv">覚醒${b.lv}</span>
                    <span class="as-txt">${b.txt}</span>
                    ${unlocked ? '<span class="as-check">✅</span>' : ''}
                </div>`;
            }).join('');
        }

        // 効果値の表示
        let statsHtml = '';
        if (calcEff.atkPct) statsHtml += `<div class="cd-stat"><span class="cds-label">ATK</span><span class="cds-val atk">+${Math.floor(calcEff.atkPct)}%</span></div>`;
        if (calcEff.atkFlat) statsHtml += `<div class="cd-stat"><span class="cds-label">ATK固定</span><span class="cds-val atk">+${calcEff.atkFlat}</span></div>`;
        if (calcEff.hpPct) statsHtml += `<div class="cd-stat"><span class="cds-label">HP</span><span class="cds-val hp">+${Math.floor(calcEff.hpPct)}%</span></div>`;
        if (calcEff.hpFlat) statsHtml += `<div class="cd-stat"><span class="cds-label">HP固定</span><span class="cds-val hp">+${calcEff.hpFlat}</span></div>`;
        if (calcEff.spdFlat) statsHtml += `<div class="cd-stat"><span class="cds-label">SPD</span><span class="cds-val spd">+${calcEff.spdFlat}</span></div>`;
        if (calcEff.critPct) statsHtml += `<div class="cd-stat"><span class="cds-label">会心率</span><span class="cds-val crit">+${Math.floor(calcEff.critPct)}%</span></div>`;
        if (calcEff.statusResist) statsHtml += `<div class="cd-stat"><span class="cds-label">状態耐性</span><span class="cds-val res">+${Math.floor(calcEff.statusResist)}%</span></div>`;
        if (calcEff.chargeReduce) statsHtml += `<div class="cd-stat"><span class="cds-label">チャージ</span><span class="cds-val charge">-${calcEff.chargeReduce}T</span></div>`;
        if (calcEff.initCharge) statsHtml += `<div class="cd-stat"><span class="cds-label">開幕CT</span><span class="cds-val charge">+${calcEff.initCharge}</span></div>`;

        return `
        <div class="card-detail c-border-${card.color}">
            <div class="cd-header">
                <span class="cd-color-icon">${colorInfo.icon}</span>
                <span class="cd-eff-name">${eff.name}</span>
                <span class="cd-rank rank-${rank}">${rank}</span>
            </div>
            <div class="cd-level">Lv.${card.level}</div>
            <div class="cd-awaken-row">${awakenStars}</div>
            <div class="cd-desc">${desc}</div>
            <div class="cd-stats">${statsHtml}</div>
            <div class="cd-awaken-list">${awakenList}</div>
        </div>`;
    }

    // =============================================
    // ★共通: 画像付きリッチカード描画メソッド
    // =============================================
   // =============================================
    // ★共通: 画像付きリッチカード描画メソッド (完全図鑑互換版)
    // =============================================
    _renderRichCard(c, options = {}) {
        const cm = app.data.cardManager;
        const eff = CARD_EFFECTS[c.effectType];
        
        const rank = cm.getCardRank(c);
        const rankChar = rank.charAt(0); // SSSやSSから頭文字(S, A, B...)を取得
        const stars = '★'.repeat(c.awakening) + '☆'.repeat(5 - c.awakening);
        
        const isEquipped = this._isCardEquipped(c.cardId);
        const isSelected = options.selectedId === c.cardId;
        const clickFn = options.onClick || `app.cardScreen.showCardModal('${c.cardId}')`;
        const extraHtml = options.extraHtml || '';

        // 図鑑と同じ背景画像パス
        const cardImagePath = `images/card_bg_${c.color}.webp`;

        // 図鑑の list-card および zukan-card-item クラスをそのまま適用
        return `
        <div class="list-card zukan-card-item ${isEquipped ? 'equipped' : ''} ${isSelected ? 'selected' : ''}" 
             onclick="${clickFn}"
             style="background: url('${cardImagePath}') center/contain no-repeat !important; 
                    border: ${isSelected ? '2px solid #ffd700' : 'none'} !important; 
                    background-color: transparent !important;">
            
            <div class="zc-stars">${stars}</div>
            <div class="zc-lv">lv.${c.level}</div>
            <div class="zc-rank rank-${rankChar}">${rankChar}</div>
            <div class="zc-name">${eff ? eff.name : '?'}</div>
            
            ${isEquipped ? '<div class="zc-eq-badge">装備中</div>' : ''}
            ${extraHtml}
        </div>`;
    }

    // =============================================
    // Tab: カード一覧
    // =============================================
_renderListTab() {
        // ★ .filter(c => !this._isCardEquipped(c.cardId)) を追加して装備中カードを除外
        const cards = this._getFilteredCards().filter(c => !this._isCardEquipped(c.cardId));

        return `
        ${this._renderColorFilter()}
        <div class="card-list-rich-scroll">
            ${cards.length === 0
                ? '<div class="card-empty-msg">未装備のカードがありません</div>'
                : cards.map(c => this._renderRichCard(c)).join('')}
        </div>`;
    }
    selectCard(cardId) {
        if (app.sound) app.sound.tap();
        this.selectedCardId = (this.selectedCardId === cardId) ? null : cardId;
        this.render();
    }

    // タップで詳細モーダルを表示する
    showCardModal(cardId) {
        if (app.sound) app.sound.tap();
        
        const detailHtml = this._renderCardDetail(cardId);
        
        const overlay = document.createElement('div');
        overlay.id = 'card-detail-modal';
        overlay.className = 'card-picker-overlay'; 
        overlay.innerHTML = `
        <div class="card-picker-modal" style="padding: 10px;">
            ${detailHtml}
            <button class="cpm-close" style="margin-top: 10px; width: 100%; border-radius: 6px;" onclick="document.getElementById('card-detail-modal').remove()">閉じる</button>
        </div>`;
        document.body.appendChild(overlay);
    }

    // =============================================
    // Tab: 装備
    // =============================================
  _renderEquipTab() {
        const inv = app.data.inventory || [];
        const deckUids = (app.data.deck || []).map(d => d.uid);

        // ユニット一覧（編成中のものを優先表示、次にレベル順）
        const sorted = [...inv].sort((a, b) => {
            const aInDeck = deckUids.includes(a.uid) ? 0 : 1;
            const bInDeck = deckUids.includes(b.uid) ? 0 : 1;
            return aInDeck - bInDeck || b.lv - a.lv;
        });

        // 未選択時に自動で先頭のキャラを選択
        if (!this.selectedUnitUid && sorted.length > 0) {
            this.selectedUnitUid = sorted[0].uid;
        }

        // ▼ 下部のユニット選択リスト
        let unitListHtml = sorted.map(s => {
            const base = typeof DB !== 'undefined' ? DB.find(u => u.id === s.unitId) : null;
            if (!base) return '';
            const isSelected = this.selectedUnitUid === s.uid;
            const inDeck = deckUids.includes(s.uid);
            
            const imgUrl = (typeof IMG_DATA !== 'undefined' && IMG_DATA[base.id]) ? `url('${IMG_DATA[base.id]}')` : 'none';
            const getBg = (type, cost) => {
                const colors = ['purple', 'gold', 'pink', 'green', 'blue', 'red'];
                const c = colors[type] || 'red';
                let r = 'r'; if(cost>=5) r='ur'; else if(cost>=3) r='sr';
                return `images/bg/bg_${c}_${r}.webp`;
            };
            const bgUrl = getBg(base.type, base.cost);
            const stars = '★'.repeat(base.cost);
            
            return `
            <div class="list-card ${isSelected ? 'selected' : ''}" 
                 onclick="app.cardScreen.selectUnit('${s.uid}')"
                 style="background-image: ${imgUrl}, url('${bgUrl}'); background-size: cover, cover;">
                <div class="lc-lv-badge-top">Lv.${s.lv}</div>
                ${inDeck ? '<div class="lc-deck-badge">編成中</div>' : ''}
                <div class="lc-card-footer">
                    <div class="footer-grid">
                        <div class="shape-icon">
                            ${base.shape.grid.map(bit => `<div class="shape-cell-dot ${bit?'on':''}"></div>`).join('')}
                        </div>
                    </div>
                    <div class="footer-stars" style="color:${base.cost>=5?'#f0f':base.cost===4?'#fd0':'#fff'}">${stars}</div>
                </div>
            </div>`;
        }).join('');

        const unit = this.selectedUnitUid ? app.data.getUnitInstance(this.selectedUnitUid) : null;
        let rightPanelHtml = '';

        if (!unit) {
            rightPanelHtml = `<div style="padding: 40px; text-align: center; color: #888;">装備するキャラクターを選択してください。</div>`;
        } else {
            const base = unit.base;
            const imgUrl = (typeof IMG_DATA !== 'undefined' && IMG_DATA[base.id]) ? `url('${IMG_DATA[base.id]}')` : 'none';
            const getBg = (type, cost) => {
                const colors = ['purple', 'gold', 'pink', 'green', 'blue', 'red'];
                const c = colors[type] || 'red';
                let r = 'r'; if(cost>=5) r='ur'; else if(cost>=3) r='sr';
                return `images/bg/bg_${c}_${r}.webp`;
            };
            const bgUrl = getBg(base.type, base.cost);

            // 🌟 バグ修正: 正しい装備データを app.data.getUnitEquips から取得する
            const equipCards = app.data.getUnitEquips ? app.data.getUnitEquips(unit.uid) : ((app.data.unitEquips && app.data.unitEquips[unit.uid]) || {});
            
            const cm = app.data.cardManager;
            const cBonus = cm.calcEquippedEffects(equipCards);
            
            const hpBonus = Math.floor(unit.maxHp * ((cBonus.hpPct || 0) - (cBonus.hpDownPct || 0)) / 100) + (cBonus.hpFlat || 0);
            const atkBonus = Math.floor(unit.atk * ((cBonus.atkPct || 0) - (cBonus.atkDownPct || 0)) / 100) + (cBonus.atkFlat || 0);
            const spdBonus = (cBonus.spdFlat || 0);
            
            const formatBonus = (val) => val > 0 ? `<span class="eq-stat-bonus">+${val}</span>` : (val < 0 ? `<span class="eq-stat-penalty">${val}</span>` : '');

            // プログレスバーの割合計算
            const hpPct = Math.min(100, (unit.maxHp / 2500) * 100);
            const atkPct = Math.min(100, (unit.atk / 800) * 100);
            const spdPct = Math.min(100, (unit.spd / 30) * 100);

            const slots = [
                { id: 'red', name: '🟥 攻撃', colorClass: 's-red' },
                { id: 'yellow', name: '🟨 防御', colorClass: 's-yellow' },
                { id: 'blue', name: '🟦 補助', colorClass: 's-blue' },
                { id: 'purple', name: '🟪 万能', colorClass: 's-purple' }
            ];

            let slotsHtml = slots.map(slot => {
                const cardId = equipCards[slot.id];
                const card = cardId ? cm.getCard(cardId) : null;

                if (card) {
                    const rank = cm.getCardRank(card);
                    const rankChar = rank.charAt(0);
                    const stars = '★'.repeat(card.awakening) + '☆'.repeat(5 - card.awakening);
                    const eff = CARD_EFFECTS[card.effectType];
                    const cardImagePath = `images/card_bg_${card.color}.webp`;
                    
                    return `
                    <div class="eq-slot-wrapper">
                        <div class="eq-slot-header">${slot.name}</div>
                        <div class="list-card zukan-card-item" 
                             onclick="app.cardScreen.openCardPicker('${this.selectedUnitUid}','${slot.id}')"
                             style="background: url('${cardImagePath}') center/contain no-repeat !important; background-color: transparent !important; border:none !important; margin:0 auto; width: 100%; aspect-ratio: 3/4; overflow: visible !important;">
                            <div class="zc-stars">${stars}</div>
                            <div class="zc-lv">lv.${card.level}</div>
                            <div class="zc-rank rank-${rankChar}">${rankChar}</div>
                            <div class="zc-name">${eff ? eff.name : '?'}</div>
                            
                            <button onclick="event.stopPropagation(); app.cardScreen.unequipSlot('${this.selectedUnitUid}','${slot.id}')"
                                    style="position: absolute; top: -4px; right: -4px; width: 22px; height: 22px; background: #e33; color: #fff; border: 2px solid #fff; border-radius: 50%; font-size: 10px; font-weight: bold; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 20; box-shadow: 0 2px 4px rgba(0,0,0,0.6); padding: 0;">✖</button>
                        </div>
                    </div>`;
                } else {
                    return `
                    <div class="eq-slot-wrapper">
                        <div class="eq-slot-header">${slot.name}</div>
                        <div class="eq-slot-empty ${slot.colorClass}" onclick="app.cardScreen.openCardPicker('${this.selectedUnitUid}','${slot.id}')">
                            <div class="empty-plus">+</div>
                            <span>装備</span>
                        </div>
                    </div>`;
                }
            }).join('');

            rightPanelHtml = `
            <div class="eq-detail-panel">
                <div class="eq-detail-top">
                    <div class="eq-detail-img-box" style="background-image: ${imgUrl}, url('${bgUrl}');">
                        <div class="eq-detail-name">${base.name} <span style="color:#ffd700;font-size:11px;">Lv.${unit.save.lv}</span></div>
                    </div>
                    <div class="eq-detail-stats-box">
                         <div class="status-bar-row">
                             <div class="stat-cell">
                                 <div class="stat-bg-bar"><div class="stat-fill-bar" style="width:${hpPct}%; background:#7f7;"></div></div>
                                 <div class="stat-content"><span class="lbl">HP</span> <span class="val" style="color:#bfb">${unit.maxHp} ${formatBonus(hpBonus)}</span></div>
                             </div>
                         </div>
                         <div class="status-bar-row">
                             <div class="stat-cell">
                                 <div class="stat-bg-bar"><div class="stat-fill-bar" style="width:${atkPct}%; background:#f77;"></div></div>
                                 <div class="stat-content"><span class="lbl">ATK</span> <span class="val" style="color:#fbb">${unit.atk} ${formatBonus(atkBonus)}</span></div>
                             </div>
                         </div>
                         <div class="status-bar-row">
                             <div class="stat-cell">
                                 <div class="stat-bg-bar"><div class="stat-fill-bar" style="width:${spdPct}%; background:#7ff;"></div></div>
                                 <div class="stat-content"><span class="lbl">SPD</span> <span class="val" style="color:#bff">${unit.spd} ${formatBonus(spdBonus)}</span></div>
                             </div>
                         </div>
                    </div>
                </div>
                <div class="eq-slots-grid-4">
                    ${slotsHtml}
                </div>
            </div>`;
        }

        return `
        <div class="equip-layout-vertical">
            <div class="eq-detail-area">${rightPanelHtml}</div>
            <div class="eq-unit-grid-scroll">${unitListHtml}</div>
        </div>`;
    }
    selectUnit(uid) {
        if (app.sound) app.sound.tap();
        this.selectedUnitUid = uid;
        this.render();
    }

   openCardPicker(unitUid, color) {
        if (app.sound) app.sound.tap();
        const cm = app.data.cardManager;
        const cards = cm.getCardsByColor(color).sort((a, b) => b.level - a.level);

        if (cards.length === 0) {
            alert(`${color === 'red' ? '赤' : color === 'yellow' ? '黄' : color === 'blue' ? '青' : '紫'}カードがありません`);
            return;
        }

        const overlay = document.createElement('div');
        overlay.id = 'card-picker-overlay';
        overlay.className = 'card-picker-overlay';
        const colorLabel = { red: '🟥 赤', yellow: '🟨 黄', blue: '🟦 青', purple: '🟪 紫' }[color];

        let listHtml = cards.map(c => this._renderRichCard(c, {
            onClick: `app.cardScreen.pickCard('${unitUid}','${c.cardId}')`
        })).join('');

        overlay.innerHTML = `
        <div class="card-picker-modal">
            <div class="cpm-header">${colorLabel}カードを選択</div>
            <div class="cpm-list card-list-rich-scroll" style="padding: 10px;">${listHtml}</div>
            <button class="cpm-close" onclick="document.getElementById('card-picker-overlay').remove()">閉じる</button>
        </div>`;

        document.body.appendChild(overlay);
    }

    pickCard(unitUid, cardId) {
        const overlay = document.getElementById('card-picker-overlay');
        if (overlay) overlay.remove();

        const result = app.data.equipCard(unitUid, cardId);
        if (result.success) {
            if (app.sound) app.sound.play('sys_gacha_open');
        } else {
            alert('装備に失敗しました: ' + (result.reason || ''));
        }
        this.render();
    }

    unequipSlot(unitUid, color) {
        if (app.sound) app.sound.tap();
        app.data.unequipCard(unitUid, color);
        this.render();
    }

    // =============================================
    // Tab: 覚醒
    // =============================================
   _renderAwakenTab() {
        const cm = app.data.cardManager;
        const baseCandidates = cm.cards.filter(c => c.level >= CARD_AWAKEN_CONFIG.baseMinLevel && c.awakening < 5)
            .sort((a, b) => b.level - a.level || b.awakening - a.awakening);
        const baseCard = this.awakenBaseId ? cm.getCard(this.awakenBaseId) : null;

        let matCandidates = [];
        if (baseCard) {
            matCandidates = cm.cards.filter(c => c.cardId !== baseCard.cardId && c.color === baseCard.color)
                .sort((a, b) => b.level - a.level);
        }
        const matCard = this.awakenMatId ? cm.getCard(this.awakenMatId) : null;

        let cost = 0, rate = 0;
        if (baseCard) {
            cost = CARD_AWAKEN_CONFIG.goldCost[baseCard.awakening] || 10000;
            if (matCard) {
                for (const entry of CARD_AWAKEN_CONFIG.successRate) {
                    if (matCard.level >= entry.minLv) { rate = entry.rate; break; }
                }
            }
        }

        return `
        <div class="awaken-layout">
            <div class="aw-section">
                <div class="aw-section-title">ベースカード (Lv${CARD_AWAKEN_CONFIG.baseMinLevel}以上)</div>
                <div class="card-list-rich-scroll aw-scroll-override">
                    ${baseCandidates.length === 0
                        ? '<div class="card-empty-msg">覚醒可能なカードがありません<br>(Lv15以上 & 覚醒5未満)</div>'
                        : baseCandidates.map(c => this._renderRichCard(c, {
                            selectedId: this.awakenBaseId,
                            onClick: `app.cardScreen.selectAwakenBase('${c.cardId}')`
                        })).join('')}
                </div>
            </div>

            ${baseCard ? `
            <div class="aw-merge-area">
                <div class="aw-merge-visual">
                    <div class="aw-merge-card c-border-${baseCard.color}">
                        <div>🎴 ${CARD_EFFECTS[baseCard.effectType]?.name || '?'}</div>
                        <div>Lv.${baseCard.level} 覚醒${baseCard.awakening}/5</div>
                    </div>
                    <div class="aw-merge-plus">＋</div>
                    <div class="aw-merge-card ${matCard ? 'c-border-' + matCard.color : 'empty'}">
                        ${matCard
                            ? `<div>🎴 ${CARD_EFFECTS[matCard.effectType]?.name || '?'}</div>
                               <div>Lv.${matCard.level}</div>`
                            : '<div>素材を選択↓</div>'}
                    </div>
                </div>
                ${matCard ? `
                <div class="aw-info-row">
                    <span>成功率: <b style="color:${rate >= 0.7 ? '#0f0' : rate >= 0.4 ? '#ff0' : '#f66'}">${Math.floor(rate * 100)}%</b></span>
                    <span>費用: <b style="color:#ffd700">💰${cost.toLocaleString()}</b></span>
                </div>
                <button class="btn-awaken-exec" onclick="app.cardScreen.execAwaken()">覚醒実行</button>
                ` : ''}
            </div>

            <div class="aw-section">
                <div class="aw-section-title">素材カード (同色: ${baseCard.color})</div>
                <div class="card-list-rich-scroll aw-scroll-override">
                    ${matCandidates.length === 0
                        ? '<div class="card-empty-msg">同色のカードがありません</div>'
                        : matCandidates.map(c => this._renderRichCard(c, {
                            selectedId: this.awakenMatId,
                            onClick: `app.cardScreen.selectAwakenMat('${c.cardId}')`
                        })).join('')}
                </div>
            </div>
            ` : ''}
        </div>`;
    }

    selectAwakenBase(cardId) {
        if (app.sound) app.sound.tap();
        this.awakenBaseId = (this.awakenBaseId === cardId) ? null : cardId;
        this.awakenMatId = null;
        this.render();
    }

    selectAwakenMat(cardId) {
        if (app.sound) app.sound.tap();
        this.awakenMatId = (this.awakenMatId === cardId) ? null : cardId;
        this.render();
    }

    execAwaken() {
        if (!this.awakenBaseId || !this.awakenMatId) return;

        const cm = app.data.cardManager;
        const base = cm.getCard(this.awakenBaseId);
        if (!base) return;

        const cost = CARD_AWAKEN_CONFIG.goldCost[base.awakening] || 10000;
        if (app.data.gold < cost) {
            alert(`ゴールドが足りません (必要: ${cost.toLocaleString()}G)`);
            return;
        }

        if (!confirm(`覚醒を実行しますか？\n費用: 💰${cost.toLocaleString()}\n※素材カードは成否に関わらず消費されます`)) return;

        app.data.consumeGold(cost);
        const result = cm.awakenCard(this.awakenBaseId, this.awakenMatId, cost);
        app.data.save();

        if (result.success) {
            if (app.sound) app.sound.play('sys_clear');
            alert(`✨ 覚醒成功！ → 覚醒${result.newAwakening}`);
        } else if (result.reason === 'failed') {
            if (app.sound) app.sound.play('sys_danger');
            alert(`💫 覚醒失敗… (成功率: ${Math.floor(result.rate * 100)}%)`);
        } else {
            alert('エラー: ' + (result.reason || '不明'));
        }

        this.awakenMatId = null;
        // ベースが存在しなくなった場合リセット
        if (!cm.getCard(this.awakenBaseId)) this.awakenBaseId = null;
        this.render();
    }

    // =============================================
    // Tab: 分解 / 生成
    // =============================================
  _renderSalvageTab() {
        const cm = app.data.cardManager;
        
        // ★ 装備中のカードを除外
        const cards = this._getFilteredCards().filter(c => !this._isCardEquipped(c.cardId));

        const colors = ['red', 'yellow', 'blue', 'purple'];
        const colorNames = { red: '🟥赤', yellow: '🟨黄', blue: '🟦青', purple: '🟪紫' };
        let craftHtml = colors.map(color => {
            const cost = CARD_SALVAGE_CONFIG.craftCost[color];
            const have = cm.fragments[color] || 0;
            const canCraft = have >= cost;
            return `
            <div class="craft-item">
                <span class="craft-color">${colorNames[color]}</span>
                <span class="craft-frag">${have}/${cost}</span>
                <button class="btn-craft ${canCraft ? '' : 'disabled'}" 
                        onclick="app.cardScreen.craftCard('${color}')"
                        ${canCraft ? '' : 'disabled'}>生成</button>
            </div>`;
        }).join('');

        return `
        ${this._renderColorFilter()}
        <div class="salvage-layout">
            <div class="salvage-section">
                <div class="aw-section-title">🔨 未装備カードをタップして分解</div>
                <div class="card-list-rich-scroll aw-scroll-override">
                    ${cards.length === 0
                        ? '<div class="card-empty-msg">分解できるカードがありません</div>'
                        : cards.map(c => {
                            const frags = CARD_SALVAGE_CONFIG.getFragments(c);
                            const extraHtml = `<span class="sci-frag-badge">→ ${frags}欠片</span>`;
                            return this._renderRichCard(c, { 
                                onClick: `app.cardScreen.salvageOne('${c.cardId}')`,
                                extraHtml: extraHtml
                            });
                        }).join('')}
                </div>
            </div>

            <div class="salvage-section">
                <div class="aw-section-title">⚒️ 欠片からカード生成 (Lv5〜15)</div>
                <div class="craft-grid">${craftHtml}</div>
            </div>
        </div>`;
    }

    salvageOne(cardId) {
        if (this._isCardEquipped(cardId)) {
            alert('装備中のカードは分解できません。先に外してください。');
            return;
        }
        const cm = app.data.cardManager;
        const card = cm.getCard(cardId);
        if (!card) return;

        const frags = CARD_SALVAGE_CONFIG.getFragments(card);
        const eff = CARD_EFFECTS[card.effectType];
        if (!confirm(`${eff ? eff.name : '?'} Lv.${card.level} を分解しますか？\n→ ${frags} 欠片を獲得`)) return;

        const result = cm.salvageCard(cardId);
        if (result) {
            if (app.sound) app.sound.tap();
            app.data.save();
        }
        this.render();
    }

    craftCard(color) {
        const cm = app.data.cardManager;
        const result = cm.craftCard(color);
        if (result.success) {
            if (app.sound) app.sound.play('sys_gacha_open');
            app.data.save();
            const card = result.card;
            const eff = CARD_EFFECTS[card.effectType];
            alert(`✨ 生成成功！\n${eff ? eff.name : '?'} Lv.${card.level}`);
        } else {
            alert('欠片が足りません');
        }
        this.render();
    }

    // =============================================
    // ヘルパー
    // =============================================
    _isCardEquipped(cardId) {
        const equips = app.data.unitEquips || {};
        for (const uid of Object.keys(equips)) {
            const eq = equips[uid];
            if (eq.red === cardId || eq.yellow === cardId || eq.blue === cardId || eq.purple === cardId) {
                return true;
            }
        }
        return false;
    }

    _bindEvents() {
        // Future: drag-drop, long-press etc.
    }

    // =============================================
    // CSS注入
    // =============================================
    injectStyles() {
        if (document.getElementById('card-equip-style')) return;
        const style = document.createElement('style');
        style.id = 'card-equip-style';
        style.textContent = `
        /* ============================
           カード管理画面 スタイル
           ============================ */
        #screen-cards {
            background: linear-gradient(to bottom, #0a0a1a, #1a1030);
        }
        #screen-cards > .header-bar { display: none !important; }

        .card-screen-body {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            padding-top: calc(var(--header-h, 50px) + env(safe-area-inset-top, 0px));
        }

        #card-screen-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        /* タブバー */
        .card-tab-bar {
            display: flex;
            background: #111;
            border-bottom: 2px solid #444;
            flex-shrink: 0;
        }
        .card-tab-btn {
            flex: 1;
            padding: 10px 2px;
            background: transparent;
            border: none;
            color: #888;
            font-size: 12px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 2px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .card-tab-btn.active {
            color: #fff;
            background: rgba(255,215,0,0.15);
            border-bottom: 2px solid #ffd700;
        }
        .ctb-icon { font-size: 18px; }
        .ctb-label { font-size: 10px; font-weight: bold; }

        /* インベントリバー */
        .card-inventory-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 4px 10px;
            background: rgba(0,0,0,0.5);
            font-size: 11px;
            color: #aaa;
            flex-shrink: 0;
        }
        .cib-frags { display: flex; gap: 6px; font-size: 10px; }

        /* カラーフィルタ */
        .card-color-filter {
            display: flex;
            gap: 4px;
            padding: 6px 8px;
            flex-shrink: 0;
        }
        .ccf-btn {
            flex: 1;
            padding: 5px 2px;
            background: rgba(255,255,255,0.1);
            border: 1px solid #444;
            border-radius: 6px;
            color: #aaa;
            font-size: 10px;
            cursor: pointer;
        }
        .ccf-btn.active { background: rgba(255,215,0,0.2); border-color: #ffd700; color: #fff; }

        /* カード一覧 (上下分割) */
        .card-list-split {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        .card-list-scroll {
            flex: 1;
            overflow-y: auto;
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 4px;
            padding: 6px;
            align-content: start;
        }
        .card-detail-panel {
            flex-shrink: 0;
            max-height: 45%;
            overflow-y: auto;
            border-top: 1px solid #444;
        }

        /* カードアイテム */
        .card-item {
            position: relative;
            padding: 8px 6px;
            border-radius: 8px;
            background: rgba(255,255,255,0.05);
            border: 1px solid #333;
            text-align: center;
            cursor: pointer;
            transition: all 0.15s;
        }
        .card-item.selected { border-color: #ffd700; background: rgba(255,215,0,0.15); box-shadow: 0 0 8px rgba(255,215,0,0.3); }
        .card-item.equipped { opacity: 0.6; }
        .card-item.c-red { border-left: 3px solid #f44; }
        .card-item.c-yellow { border-left: 3px solid #fa0; }
        .card-item.c-blue { border-left: 3px solid #4af; }
        .card-item.c-purple { border-left: 3px solid #a4f; }

        .ci-rank { position: absolute; top: 2px; right: 4px; font-size: 9px; font-weight: 900; }
        .ci-color-dot { width: 8px; height: 8px; border-radius: 50%; margin: 0 auto 2px; }
        .c-dot-red { background: #f44; }
        .c-dot-yellow { background: #fa0; }
        .c-dot-blue { background: #4af; }
        .c-dot-purple { background: #a4f; }
        .ci-name { font-size: 11px; font-weight: bold; color: #fff; }
        .ci-level { font-size: 10px; color: #ccc; }
        .ci-awaken { font-size: 8px; line-height: 1; }
        .aw-star { color: #555; }
        .aw-star.filled { color: #ffd700; }
        .ci-equipped-badge { font-size: 8px; color: #f90; background: rgba(255,150,0,0.2); padding: 1px 4px; border-radius: 4px; margin-top: 2px; }

        .rank-SSS { color: #ff0; text-shadow: 0 0 4px #f80; }
        .rank-SS { color: #f0f; text-shadow: 0 0 4px #a0f; }
        .rank-S { color: #0ff; }
        .rank-A { color: #0f0; }
        .rank-B { color: #aaa; }

        /* カード詳細 */
        .card-detail {
            padding: 10px;
            background: rgba(0,0,0,0.4);
            border-left: 4px solid #555;
        }
        .c-border-red { border-left-color: #f44 !important; }
        .c-border-yellow { border-left-color: #fa0 !important; }
        .c-border-blue { border-left-color: #4af !important; }
        .c-border-purple { border-left-color: #a4f !important; }

        .cd-header { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
        .cd-color-icon { font-size: 18px; }
        .cd-eff-name { font-size: 16px; font-weight: 900; color: #fff; }
        .cd-rank { font-size: 14px; font-weight: 900; margin-left: auto; }
        .cd-level { font-size: 13px; color: #ccc; }
        .cd-awaken-row { margin: 4px 0; }
        .aw-star-lg { font-size: 16px; }
        .aw-star-lg.filled { color: #ffd700; }
        .cd-desc { font-size: 11px; color: #aaa; margin: 6px 0; padding: 4px; background: rgba(255,255,255,0.05); border-radius: 4px; }
        .cd-stats { display: flex; flex-wrap: wrap; gap: 4px; margin: 6px 0; }
        .cd-stat { background: rgba(0,0,0,0.3); padding: 3px 8px; border-radius: 4px; font-size: 10px; }
        .cds-label { color: #888; margin-right: 4px; }
        .cds-val { font-weight: bold; }
        .cds-val.atk { color: #f66; }
        .cds-val.hp { color: #6f6; }
        .cds-val.spd { color: #6ef; }
        .cds-val.crit { color: #ff0; }
        .cds-val.res { color: #af0; }
        .cds-val.charge { color: #4af; }

        .cd-awaken-list { display: flex; flex-direction: column; gap: 3px; margin-top: 6px; }
        .awaken-step { display: flex; align-items: center; gap: 6px; padding: 3px 6px; background: rgba(255,255,255,0.03); border-radius: 4px; font-size: 10px; color: #666; }
        .awaken-step.unlocked { color: #ffd700; background: rgba(255,215,0,0.08); }
        .as-lv { font-weight: bold; width: 40px; flex-shrink: 0; }
        .as-txt { flex: 1; }
        .as-check { flex-shrink: 0; }

        .card-detail-empty, .card-empty-msg {
            padding: 30px;
            text-align: center;
            color: #666;
            font-size: 12px;
        }

        

        /* ============================
           装備タブ
           ============================ */
        .equip-layout { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .eq-unit-list-scroll { display: flex; overflow-x: auto; gap: 4px; padding: 6px; flex-shrink: 0; }
        .eq-unit-item {
            flex-shrink: 0;
            padding: 6px 12px;
            background: rgba(255,255,255,0.05);
            border: 1px solid #333;
            border-radius: 8px;
            cursor: pointer;
            text-align: center;
        }
        .eq-unit-item.selected { border-color: #ffd700; background: rgba(255,215,0,0.15); }
        .eq-unit-item.in-deck { border-color: #4a4; }
        .eq-unit-name { font-size: 11px; font-weight: bold; color: #fff; }
        .eq-unit-info { font-size: 9px; color: #888; }

        .eq-detail-area { flex: 1; overflow-y: auto; padding: 0 8px 8px; }
        .eq-unit-header { text-align: center; padding: 8px; border-bottom: 1px solid #333; margin-bottom: 8px; }
        .eq-uh-name { font-size: 16px; font-weight: 900; color: #fff; display: block; }
        .eq-uh-stats { font-size: 11px; color: #aaa; }

        .eq-slots-grid { display: flex; flex-direction: column; gap: 6px; }
        .eq-slot {
            padding: 10px;
            border-radius: 8px;
            background: rgba(0,0,0,0.3);
            border-left: 4px solid #555;
        }
        .eq-slot.filled { background: rgba(0,0,0,0.5); }
        .eq-slot-label { font-size: 11px; font-weight: bold; color: #ccc; margin-bottom: 4px; }
        .eq-slot-card { font-size: 12px; color: #fff; }
        .eq-sc-name { font-weight: bold; }
        .eq-sc-lv { color: #aaa; margin-left: 4px; }
        .eq-sc-aw { color: #ffd700; font-size: 10px; margin-left: 4px; }
        .eq-slot-empty-msg { color: #555; font-size: 11px; }
        .eq-slot-actions { display: flex; gap: 6px; margin-top: 6px; }

        .btn-eq-set, .btn-eq-change, .btn-eq-remove {
            padding: 5px 14px;
            border: 1px solid #555;
            border-radius: 6px;
            font-size: 11px;
            cursor: pointer;
            background: rgba(255,255,255,0.1);
            color: #fff;
        }
        .btn-eq-set { background: rgba(0,200,100,0.2); border-color: #0c6; color: #0f8; }
        .btn-eq-change { background: rgba(255,215,0,0.15); border-color: #c90; color: #ffd700; }
        .btn-eq-remove { background: rgba(255,60,60,0.15); border-color: #c33; color: #f66; }

        /* カードピッカーモーダル */
        .card-picker-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.8);
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .card-picker-modal {
            width: 90%;
            max-width: 360px;
            max-height: 70vh;
            background: #1a1a2e;
            border: 1px solid #555;
            border-radius: 12px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }
        .cpm-header {
            padding: 12px;
            text-align: center;
            font-weight: 900;
            font-size: 14px;
            background: rgba(0,0,0,0.5);
            border-bottom: 1px solid #444;
        }
        .cpm-list { flex: 1; overflow-y: auto; padding: 8px; }
        .picker-card-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px;
            border-radius: 6px;
            margin-bottom: 4px;
            cursor: pointer;
            background: rgba(255,255,255,0.05);
            border: 1px solid #333;
        }
        .picker-card-item:active { background: rgba(255,215,0,0.2); }
        .pci-rank { font-size: 12px; font-weight: 900; width: 30px; text-align: center; }
        .pci-name { font-size: 12px; font-weight: bold; flex: 1; }
        .pci-lv { font-size: 11px; color: #aaa; }
        .pci-aw { font-size: 10px; color: #ffd700; }
        .pci-eq { font-size: 9px; color: #f90; background: rgba(255,150,0,0.2); padding: 2px 4px; border-radius: 3px; }
        .cpm-close {
            padding: 10px;
            background: rgba(255,255,255,0.1);
            border: none;
            color: #aaa;
            font-size: 13px;
            cursor: pointer;
            border-top: 1px solid #333;
        }

        /* ============================
           覚醒タブ
           ============================ */
        .awaken-layout { flex: 1; overflow-y: auto; padding: 6px 8px; }
        .aw-section { margin-bottom: 8px; }
        .aw-section-title { font-size: 12px; font-weight: bold; color: #ccc; padding: 4px 0; border-bottom: 1px solid #333; margin-bottom: 6px; }
        .aw-card-scroll { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; max-height: 150px; overflow-y: auto; }

        .aw-merge-area { text-align: center; padding: 10px 0; }
        .aw-merge-visual { display: flex; align-items: center; justify-content: center; gap: 8px; }
        .aw-merge-card {
            padding: 10px;
            border-radius: 8px;
            background: rgba(0,0,0,0.4);
            border: 2px solid #555;
            font-size: 11px;
            min-width: 100px;
            text-align: center;
        }
        .aw-merge-card.empty { border-style: dashed; color: #666; }
        .aw-merge-plus { font-size: 20px; color: #ffd700; font-weight: 900; }
        .aw-info-row { display: flex; justify-content: center; gap: 20px; margin: 8px 0; font-size: 12px; color: #ccc; }

        .btn-awaken-exec {
            padding: 10px 40px;
            background: linear-gradient(135deg, #b000e0, #6a00ff);
            border: 2px solid #deaaff;
            border-radius: 30px;
            color: #fff;
            font-size: 14px;
            font-weight: 900;
            cursor: pointer;
            margin-top: 6px;
        }
        .btn-awaken-exec:active { filter: brightness(1.3); }

        /* ============================
           分解タブ
           ============================ */
        .salvage-layout { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .salvage-section { margin-bottom: 8px; padding: 0 8px; }
        .salvage-section:first-child { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
        .salvage-card-scroll {
            flex: 1; overflow-y: auto;
            display: flex; flex-direction: column;
            gap: 3px;
        }
        .salvage-card-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 10px;
            background: rgba(255,255,255,0.05);
            border: 1px solid #333;
            border-radius: 6px;
            cursor: pointer;
            font-size: 11px;
        }
        .salvage-card-item.equipped { opacity: 0.4; pointer-events: none; }
        .salvage-card-item.c-red { border-left: 3px solid #f44; }
        .salvage-card-item.c-yellow { border-left: 3px solid #fa0; }
        .salvage-card-item.c-blue { border-left: 3px solid #4af; }
        .salvage-card-item.c-purple { border-left: 3px solid #a4f; }
        .salvage-card-item:active { background: rgba(255,60,60,0.2); }
        .sci-name { color: #fff; font-weight: bold; }
        .sci-frag { color: #aaa; }
        .sci-eq { color: #f90; font-size: 9px; }

        .craft-grid { display: flex; flex-direction: column; gap: 6px; padding: 4px 0; }
        .craft-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 10px;
            background: rgba(255,255,255,0.05);
            border: 1px solid #333;
            border-radius: 6px;
        }
        .craft-color { font-size: 12px; width: 50px; }
        .craft-frag { flex: 1; color: #aaa; font-size: 12px; }
        .btn-craft {
            padding: 5px 14px;
            background: rgba(0,200,100,0.2);
            border: 1px solid #0c6;
            border-radius: 6px;
            color: #0f8;
            font-size: 11px;
            cursor: pointer;
        }
        .btn-craft.disabled { opacity: 0.3; cursor: default; }

        /* 編成画面内の装備カードスロット表示 */
        .f-eq-slot {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 3px 6px;
            background: rgba(0,0,0,0.3);
            border-radius: 4px;
        }
            /* ==========================================
           装備画面 リッチUI用CSS
           ========================================== */
        .equip-container { padding: 10px; display: flex; flex-direction: column; }
        
        /* キャラクターパネル */
        .eq-unit-card { background: linear-gradient(135deg, #2a2a35, #111118); border: 1px solid #444; border-radius: 8px; padding: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.6); }
        .eq-unit-top { display: flex; gap: 12px; margin-bottom: 10px; }
        .eq-unit-img-wrapper { width: 64px; height: 64px; border-radius: 6px; overflow: hidden; background: #000; border: 1px solid #555; flex-shrink: 0; box-shadow: 0 2px 4px rgba(0,0,0,0.5); }
        .eq-unit-img { width: 100%; height: 100%; object-fit: cover; }
        .eq-unit-img-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #fff; text-align: center; }
        
        .eq-unit-info { flex: 1; display: flex; flex-direction: column; justify-content: space-between; }
        .eq-unit-name { font-size: 16px; font-weight: bold; color: #fff; text-shadow: 1px 1px 0 #000; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px; }
        .eq-unit-lv { font-size: 12px; color: #ffd700; margin-left: 6px; font-weight: normal; }
        
        /* ステータス表示 */
        .eq-unit-stats { display: flex; gap: 8px; margin-top: 4px; }
        .eq-stat-box { background: rgba(0,0,0,0.4); padding: 4px; border-radius: 4px; border: 1px solid #333; flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; }
        .eq-stat-lbl { font-size: 9px; color: #aaa; margin-bottom: 2px; }
        .eq-stat-val { font-family: 'Courier New', monospace; font-size: 14px; font-weight: bold; color: #fff; }
        .eq-stat-bonus { color: #00ffaa; font-size: 10px; margin-left: 2px; font-weight: bold; }
        .eq-stat-penalty { color: #ff5555; font-size: 10px; margin-left: 2px; font-weight: bold; }
        
        /* スキル・特性表示 */
        .eq-unit-skills { font-size: 11px; color: #ddd; background: rgba(0,0,0,0.3); padding: 8px; border-radius: 6px; border: 1px inset #333; }
        .eq-skill-row { margin-bottom: 4px; display: flex; align-items: center; }
        .eq-skill-row:last-child { margin-bottom: 0; }
        .eq-badge { padding: 2px 6px; border-radius: 3px; font-size: 9px; font-weight: bold; margin-right: 6px; color: #fff; }
        .eq-badge.skill { background: #d32f2f; }
        .eq-badge.passive { background: #1976d2; }

        /* スロット 2x2グリッド */
        .eq-slots-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .eq-slot-item { 
            background: rgba(30,30,35,0.9); border: 1px solid #444; border-radius: 8px; 
            padding: 8px; position: relative; display: flex; flex-direction: column; 
            min-height: 90px; box-shadow: inset 0 0 20px rgba(0,0,0,0.5); 
            transition: transform 0.1s;
        }
        .eq-slot-item:active { transform: scale(0.96); filter: brightness(1.2); }
        
        /* 色別グラデーション装飾 */
        .eq-slot-item.s-red { border-top: 3px solid #ff4444; background: linear-gradient(180deg, rgba(255,68,68,0.15) 0%, rgba(20,20,20,0.9) 100%); }
        .eq-slot-item.s-yellow { border-top: 3px solid #ffbb33; background: linear-gradient(180deg, rgba(255,187,51,0.15) 0%, rgba(20,20,20,0.9) 100%); }
        .eq-slot-item.s-blue { border-top: 3px solid #33b5e5; background: linear-gradient(180deg, rgba(51,181,229,0.15) 0%, rgba(20,20,20,0.9) 100%); }
        .eq-slot-item.s-purple { border-top: 3px solid #aa66cc; background: linear-gradient(180deg, rgba(170,102,204,0.15) 0%, rgba(20,20,20,0.9) 100%); }
        
        .eq-slot-header { font-size: 10px; font-weight: bold; color: #ccc; margin-bottom: 6px; border-bottom: 1px dashed rgba(255,255,255,0.2); padding-bottom: 4px; }
        .eq-card-name { font-size: 12px; color: #fff; font-weight: bold; margin-bottom: 4px; display: flex; align-items: center; gap: 4px; }
        .eq-card-lv { font-size: 10px; color: #aaa; font-weight: normal; }
        .eq-card-desc { font-size: 10px; color: #bbb; line-height: 1.3; }
        .awaken-stars { color: #ffeb3b; font-size: 10px; margin-top: auto; padding-top: 4px; letter-spacing: 1px; }
        
        .eq-btn-remove { position: absolute; top: 6px; right: 6px; background: rgba(255,50,50,0.2); border: 1px solid #f00; color: #fff; font-size: 9px; padding: 3px 8px; border-radius: 4px; cursor: pointer; }
        
        /* 空きスロット */
        .eq-slot-item.empty { align-items: center; justify-content: center; opacity: 0.8; border-top-style: dashed; }
        .empty-body { display: flex; flex-direction: column; align-items: center; font-size: 10px; color: #888; margin-top: 10px; }
        .empty-plus { font-size: 24px; color: #555; margin-bottom: 4px; font-weight: lighter; }
        
        /* レアリティバッジ */
        .rank-badge { padding: 1px 4px; border-radius: 3px; font-size: 8px; font-weight: bold; text-shadow: none; }
        .rank-SSS { background: linear-gradient(45deg, #ff00ff, #ff8800); color: #fff; }
        .rank-SS { background: linear-gradient(45deg, #ff0000, #ff8800); color: #fff; }
        .rank-S { background: #ffd700; color: #000; }
        .rank-A { background: #c0c0c0; color: #000; }
        .rank-B { background: #cd7f32; color: #fff; }
     /* ==========================================
           リッチカード一覧用CSS (完全図鑑互換版)
           ========================================== */
        .card-list-rich-scroll {
            flex: 1;
            overflow-y: auto;
            display: grid;
            grid-template-columns: repeat(4, 1fr); /* 4列グリッド（スマホで見やすいサイズ） */
            gap: 12px 6px;
            padding: 10px;
            align-content: start;
        }

        /* 図鑑と同じ縦長カードのベース設定 */
        .list-card.zukan-card-item {
            width: 100% !important; 
            aspect-ratio: 3/4 !important;
            position: relative;
            border-radius: 6px !important;
            transition: transform 0.1s;
            cursor: pointer;
            box-shadow: 0 4px 6px rgba(0,0,0,0.5);
            overflow: hidden;
            box-sizing: border-box;
        }
        .list-card.zukan-card-item:active { transform: scale(0.95); }
        .list-card.zukan-card-item.equipped { filter: brightness(0.6); }
        .list-card.zukan-card-item.selected { 
            box-shadow: 0 0 10px #ffd700, inset 0 0 10px #ffd700; 
            filter: brightness(1.2); 
        }

        /* 図鑑のテキストとアイコン装飾 */
        .zc-stars { position: absolute; top: 3px; left: 0; width: 100%; text-align: center; font-size: 8px; color: #ffd700; text-shadow: 1px 1px 0 #000; letter-spacing: -1px; z-index: 2; }
        .zc-lv { position: absolute; top: 15px; left: 3px; font-size: 10px; font-weight: 900; color: #fff; text-shadow: 1px 1px 2px #000; z-index: 2; font-family: Arial, sans-serif; }
        .zc-rank { position: absolute; top: 13px; right: 3px; width: 20px; height: 20px; border-radius: 50%; border: 2px solid #fff; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 900; color: #fff; background: rgba(0,0,0,0.6); box-shadow: 0 2px 4px rgba(0,0,0,0.8); text-shadow: 1px 1px 0 #000; z-index: 2; font-family: Arial, sans-serif; }
        .zc-name { position: absolute; bottom: 0; left: 0; width: 100%; background: rgba(0,0,0,0.75); color: #fff; font-size: 10px; text-align: center; padding: 4px 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: bold; z-index: 2; box-sizing: border-box; }
        
        /* 装備画面・分解画面 特有のバッジ */
        .zc-eq-badge { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(255,150,0,0.85); color: #fff; font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 4px; border: 1px solid #fff; z-index: 5; pointer-events: none; text-shadow: 1px 1px 0 #000; }
        .sci-frag-badge { position: absolute; bottom: 18px; left: 50%; transform: translateX(-50%); background: rgba(0,255,100,0.9); color: #000; font-size: 9px; font-weight: bold; padding: 1px 4px; border-radius: 3px; white-space: nowrap; z-index: 3; box-shadow: 0 1px 3px rgba(0,0,0,0.5); }

        /* ランク別の色 */
        .zc-rank.rank-S { border-color: #ffd700; color: #ffd700; }
        .zc-rank.rank-A { border-color: #ff6666; color: #ff6666; }
        .zc-rank.rank-B { border-color: #66ccff; color: #66ccff; }
        .zc-rank.rank-C { border-color: #66ff66; color: #66ff66; }
        .zc-rank.rank-D { border-color: #aaaaaa; color: #aaaaaa; }

        /* 覚醒・分解画面用 スクロール制限 */
        .aw-scroll-override {
            max-height: 220px;
            padding: 4px;
        }/* ==========================================
           装備画面 縦型レイアウト (強化画面風)
           ========================================== */
       /* ==========================================
           装備画面 縦型レイアウト (キャラ詳細 → スロット → 一覧)
           ========================================== */
        .equip-layout-vertical {
            flex: 1; display: flex; flex-direction: column; overflow: hidden;
        }
        .eq-detail-area {
            flex: 0 0 auto; /* 中身の高さに合わせて広がる */
            padding: 8px;
            background: linear-gradient(to bottom, #111, #000);
            border-bottom: 2px solid #555;
            z-index: 2;
            box-shadow: 0 4px 6px rgba(0,0,0,0.5);
        }
        .eq-unit-grid-scroll {
            flex: 1; /* 残りの画面高さを全てリストが使う */
            overflow-y: auto;
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 4px;
            padding: 6px;
            background: rgba(0,0,0,0.3);
            align-content: start;
        }

        /* キャラクターリストアイテム (強化画面風流用) */
        .list-card {
            width: 100%; aspect-ratio: 3/4;
            position: relative; border: 1px solid #555; border-radius: 4px;
            overflow: hidden; cursor: pointer;
            box-shadow: 0 4px 6px rgba(0,0,0,0.5);
            background-color: #222;
        }
        .list-card.selected { border-color: #ffd700; box-shadow: 0 0 8px #ffd700; filter: brightness(1.2); }
        .lc-lv-badge-top { position: absolute; top: 0; left: 0; background: rgba(0,0,0,0.7); color: #fff; font-size: 10px; padding: 2px 4px; font-weight: bold; z-index: 2; border-bottom-right-radius: 4px; }
        .lc-deck-badge { position: absolute; top: 0; right: 0; background: rgba(0,255,0,0.6); color: #fff; font-size: 9px; padding: 2px 4px; font-weight: bold; z-index: 2; border-bottom-left-radius: 4px; }
        .lc-card-footer { position: absolute; bottom: 0; left: 0; width: 100%; background: rgba(0,0,0,0.8); padding: 2px 4px; display: flex; justify-content: space-between; align-items: center; box-sizing: border-box; }
        .footer-grid .shape-icon { width: 14px; height: 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 1px; }
        .footer-grid .shape-cell-dot { background: #333; border-radius: 1px; }
        .footer-grid .shape-cell-dot.on { background: #0f0; box-shadow: 0 0 2px #0f0; }
        .footer-stars { font-size: 8px; text-shadow: 1px 1px 0 #000; letter-spacing: -1px; }

        /* 詳細パネル */
        .eq-detail-panel { display: flex; flex-direction: column; gap: 10px; height: 100%; }
        .eq-detail-top { display: flex; gap: 10px; height: 100px; flex-shrink: 0; }
        .eq-detail-img-box {
            width: 80px; height: 100%;
            border-radius: 6px; border: 1px solid #555;
            background-size: cover; background-position: center;
            position: relative;
        }
        .eq-detail-name {
            position: absolute; bottom: 0; left: 0; width: 100%;
            background: rgba(0,0,0,0.7); color: #fff; font-size: 11px;
            text-align: center; padding: 2px 0; font-weight: bold;
        }
        .eq-detail-stats-box {
            flex: 1; display: flex; flex-direction: column; justify-content: space-around;
            background: rgba(0,0,0,0.4); padding: 6px; border-radius: 6px; border: 1px solid #333;
        }
        
        /* ステータスバー */
        .status-bar-row { display: flex; justify-content: space-between; align-items: center; gap: 4px; margin-bottom: 2px; }
        .stat-cell { flex: 1; position: relative; height: 20px; background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; overflow: hidden; }
        .stat-bg-bar { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; }
        .stat-fill-bar { height: 100%; opacity: 0.4; transition: width 0.5s ease-out; }
        .stat-content { position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: space-between; padding: 0 4px; box-sizing: border-box; z-index: 1; }
        .stat-cell .lbl { font-size: 9px; color: #ddd; font-weight: bold; }
        .stat-cell .val { font-size: 11px; font-weight: 900; font-family: monospace; text-shadow: 1px 1px 0 #000; }
        .eq-stat-bonus { color: #00ffaa; font-size: 10px; margin-left: 4px; }
        .eq-stat-penalty { color: #ff5555; font-size: 10px; margin-left: 4px; }

        /* スロット 4列配置 */
        .eq-slots-grid-4 {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 6px;
        }
        .eq-slot-wrapper {
            display: flex; flex-direction: column; align-items: center; gap: 4px;
            background: rgba(255,255,255,0.05); padding: 4px; border-radius: 6px; border: 1px solid #444;
        }
        .eq-slot-header { font-size: 10px; font-weight: bold; color: #ccc; text-align: center; }
        
        /* 空きスロット */
        .eq-slot-empty {
            width: 100%; aspect-ratio: 3/4;
            border: 1px dashed #666; border-radius: 4px;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            font-size: 9px; color: #888; cursor: pointer;
            background: rgba(0,0,0,0.3);
        }
        .eq-slot-empty .empty-plus { font-size: 20px; font-weight: lighter; margin-bottom: 2px; }
        .eq-slot-empty.s-red { border-color: #f44; color: #f88; background: rgba(255,68,68,0.1); }
        .eq-slot-empty.s-yellow { border-color: #fa0; color: #fd8; background: rgba(255,187,51,0.1); }
        .eq-slot-empty.s-blue { border-color: #4af; color: #8cf; background: rgba(51,181,229,0.1); }
        .eq-slot-empty.s-purple { border-color: #a4f; color: #d8f; background: rgba(170,102,204,0.1); }

        .eq-btn-remove {
            background: rgba(255,50,50,0.2); border: 1px solid #f00; color: #fff;
            font-size: 9px; padding: 2px 6px; border-radius: 4px; cursor: pointer; width: 100%; margin-top: auto;
        }
        `
        
        ;

        
        document.head.appendChild(style);
    }

    
}
