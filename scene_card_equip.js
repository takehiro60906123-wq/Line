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
        // CSS は style-card-equip.css に外部化済み
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

    _getCenterEffectIcon(effectType) {
        const iconPath = this._getEffectIconPath(effectType);
        if (!iconPath) return '';
        return `<div class="zc-center-icon" style="background-image:url('${iconPath}')"></div>`;
    }

    

    // =============================================
    // カード1枚のHTML
    // =============================================
    _renderCardItem(card, options = {}) {
        const cm = app.data.cardManager;
        if (!eff) return '';
        const rank = cm.getCardRank(card);
        const isSelected = options.selectedId === card.cardId;
        const isEquipped = this._isCardEquipped(card.cardId);

         const awakenStars = this._renderStarIcons(card.awakening, 5, { activeKind: 'awaken', inactiveKind: 'normal' });

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

       const awakenStars = this._renderStarIcons(card.awakening, 5, { activeKind: 'awaken', inactiveKind: 'normal' });

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
     _getEffectIconPath(effectType) {
        if (!effectType) return '';
        return `images/icons/icon_${effectType}.webp`;
    }

   _getCardDisplayLevel(card) {
        if (card?.color === 'purple') return 20;
        const level = Number(card?.level);
        return Number.isFinite(level) && level > 0 ? level : 1;
    }

    _getStarIconPath(kind = 'normal') {
        return kind === 'awaken'
            ? 'images/icons/star_awaken.webp'
            : 'images/icons/star_normal.webp';
    }

    _renderStarIcons(filledCount, total = 5, options = {}) {
        const activeKind = options.activeKind || 'awaken';
        const inactiveKind = options.inactiveKind || 'normal';
        let html = '';
        for (let i = 0; i < total; i++) {
            const filled = i < filledCount;
            const kind = filled ? activeKind : inactiveKind;
            const src = this._getStarIconPath(kind);
            html += `<span class="star-icon ${filled ? 'filled' : 'empty'} ${kind}"><img src="${src}" alt="*"></span>`;
        }
        return html;
    }

    _renderRichCard(c, options = {}) {
   const stars = this._renderStarIcons(c.awakening, 5, { activeKind: 'awaken', inactiveKind: 'normal' });
    const isSelected = options.selectedId === c.cardId;
    const clickFn = options.onClick || `app.cardScreen.showCardModal('${c.cardId}')`;
    const extraHtml = options.extraHtml || '';
    const centerIconHtml = this._getCenterEffectIcon(c.effectType);

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
        <div class="zc-lv">Lv.${this._getCardDisplayLevel(c)}</div>
        ${centerIconHtml}
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
            const stars = this._renderStarIcons(base.cost, 5, { activeKind: 'normal', inactiveKind: 'normal' });
            
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
                    
                   const stars = this._renderStarIcons(card.awakening, 5, { activeKind: 'awaken', inactiveKind: 'normal' });
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
                                ${this._getCenterEffectIcon(card.effectType)}
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

          const cm = app.data.cardManager;
        const card = cm ? cm.getCard(cardId) : null;
        const unit = app.data.getUnitInstance(unitUid);
        if (!card || !unit) {
            alert('カード情報の取得に失敗しました。');
            this.render();
            return;
        }

        this.openEquipConfirm(unitUid, card);
    }

    openEquipConfirm(unitUid, card) {
        const unit = app.data.getUnitInstance(unitUid);
        const base = unit ? unit.base : null;
        const cm = app.data.cardManager;
        if (!unit || !base || !cm || !card) {
            alert('装備確認の表示に失敗しました。');
            this.render();
            return;
        }

        const colorLabel = { red: '🟥 赤', yellow: '🟨 黄', blue: '🟦 青', purple: '🟪 紫' }[card.color] || card.color;
        const desc = cm.getCardDescription(card) || '効果説明なし';
        const rank = cm.getCardRank(card);
        const currentEquips = app.data.getUnitEquips(unitUid);
        const replacingId = currentEquips[card.color];
        const replacingCard = replacingId ? cm.getCard(replacingId) : null;

        const overlay = document.createElement('div');
        overlay.id = 'equip-confirm-overlay';
        overlay.className = 'card-picker-overlay';
        overlay.innerHTML = `
        <div class="card-picker-modal" style="max-width:420px;">
            <div class="cpm-header">装備確認</div>
            <div style="padding:12px; color:#eee; font-size:13px; line-height:1.45;">
                <div style="margin-bottom:8px;">対象ユニット：<b style="color:#7bf7ff;">${base.name}</b></div>
                <div style="border:1px solid rgba(255,255,255,0.2); border-radius:8px; padding:10px; background:rgba(0,0,0,0.35); margin-bottom:8px;">
                    <div style="font-weight:800; color:#ffd700;">${rank} / ${colorLabel}</div>
                    <div style="font-size:12px; color:#fff; margin-top:2px;">Lv.${card.level} ・ 覚醒${card.awakening}</div>
                    <div style="font-size:12px; color:#cfe; margin-top:6px;">${desc}</div>
                </div>
                ${replacingCard ? `<div style="font-size:12px; color:#ffb4b4; margin-bottom:8px;">同色スロットの装備中カード（Lv.${replacingCard.level}）は外れます。</div>` : ''}
                <div style="font-size:12px; color:#bbb;">このカードを装備しますか？</div>
            </div>
            <div style="display:flex; gap:8px; justify-content:center; padding:0 12px 12px;">
                <button class="cpm-close" style="margin:0; background:#666;" onclick="document.getElementById('equip-confirm-overlay')?.remove()">キャンセル</button>
                <button class="cpm-close" style="margin:0; background:#008b8b;" onclick="app.cardScreen.confirmEquipCard('${unitUid}','${card.cardId}')">装備する</button>
            </div>
        </div>`;

        document.body.appendChild(overlay);
    }

    confirmEquipCard(unitUid, cardId) {
        const overlay = document.getElementById('equip-confirm-overlay');
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


    
}
