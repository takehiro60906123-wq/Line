/**
 * scene_zukan.js - 演出超強化版 (v18)
 * カード図鑑をグリッド表示（参考画像風デザイン）に改修
 */
class ZukanScreen {
    constructor() {
        this.selectedId = null;
        this.currentTab = -1; // -1: ALL
        this.currentList = []; 
        this.detailIndex = 0;
        
        // ★報酬設定
        this.REWARD_OWNED = 500;  // 入手ボーナス
        this.REWARD_MAXLV = 1000; // LvMAXボーナス

        // CSS は style-zukan.css に外部化済み
    }

    onEnter() {
        this.forceRebuildLayout();
        this.refresh();
        
        if(!document.getElementById('zukan-detail-modal')) {
            const m = document.createElement('div');
            m.id = 'zukan-detail-modal';
            m.className = 'gacha-result-overlay'; 
            m.style.display = 'none';
            m.style.zIndex = '3100';
            m.onclick = (e) => { if(e.target === m) this.closeDetail(); };
            document.body.appendChild(m);
        }
    }

    refresh() {
        this.renderTabs();
        if (this.currentTab === 'cards') {
            this.renderCardCatalog();
        } else {
            this.renderList();
        }
    }

    _getCardDisplayLevel(card) {
        if (card?.color === 'purple') return 20;
        const level = Number(card?.level);
        return Number.isFinite(level) && level > 0 ? level : 1;
    }

    // ★報酬状態のチェック
    getRewardStatus(unitId) {
        if (!app.data.zukanRewards) app.data.zukanRewards = {};
        if (!app.data.zukanRewards[unitId]) app.data.zukanRewards[unitId] = { owned: false, maxLv: false };

        const history = app.data.zukanRewards[unitId];
        const isOwned = app.data.inventory.some(u => u.unitId === unitId);
        
        const maxLvUnit = app.data.inventory
            .filter(u => u.unitId === unitId)
            .sort((a,b) => b.lv - a.lv)[0];
        
        const isMaxLv = maxLvUnit && (maxLvUnit.lv >= maxLvUnit.maxLv);

        return {
            owned: history.owned ? 'CLAIMED' : (isOwned ? 'CLAIMABLE' : 'LOCKED'),
            maxLv: history.maxLv ? 'CLAIMED' : (isMaxLv ? 'CLAIMABLE' : 'LOCKED')
        };
    }

    // ★報酬を受け取る処理
    claimReward(index, type) {
        const base = this.currentList[index];
        if(!base) return;
        const unitId = base.id;
        const status = this.getRewardStatus(unitId);

        if(status[type] === 'CLAIMABLE') {
            const amount = (type === 'owned') ? this.REWARD_OWNED : this.REWARD_MAXLV;
            
            app.data.zukanRewards[unitId][type] = true;
            if(app.data.addGems) {
                app.data.addGems(amount);
            } else {
                app.data.gems += amount;
                app.data.save();
            }
            
            app.sound.win();
            alert(`ボーナス獲得！\nジェム x${amount} を手に入れました！`);
            
            this.openDetail(index); 
            this.renderList();      
        }
    }

    forceRebuildLayout() {
        const screen = document.getElementById('screen-zukan');
        if (!screen) return;
        const oldContainer = screen.querySelector('.inventory-area');
        if (oldContainer) oldContainer.remove();

        if (!document.getElementById('zukan-tab-area')) {
            const tabArea = document.createElement('div');
            tabArea.id = 'zukan-tab-area';
            tabArea.className = 'tab-area';
            const header = screen.querySelector('.header-bar');
            if(header && header.nextSibling) screen.insertBefore(tabArea, header.nextSibling);
            else screen.appendChild(tabArea);
        }

        if (!document.getElementById('zukan-list')) {
            const listArea = document.createElement('div');
            listArea.className = 'zukan-list-area'; 
            listArea.id = 'zukan-list';
            screen.appendChild(listArea);
        }
    }

    renderTabs() {
        const area = document.getElementById('zukan-tab-area');
        if (!area) return;
        let html = `<button class="tab-btn ${this.currentTab === -1 ? 'active' : ''}" onclick="app.zukanScreen.setTab(-1)">ALL</button>`;
        if (typeof TYPES !== 'undefined') {
            TYPES.forEach(t => {
                const isActive = (this.currentTab === t.id) ? 'active' : '';
                html += `<button class="tab-btn ${isActive}" onclick="app.zukanScreen.setTab(${t.id})">${t.icon} ${t.name}</button>`;
            });
        }
        // ★カード図鑑タブ
        html += `<button class="tab-btn ${this.currentTab === 'cards' ? 'active' : ''}" onclick="app.zukanScreen.setTab('cards')">🃏 カード</button>`;
        area.innerHTML = html;
    }

    setTab(typeId) {
        if (this.currentTab === typeId) return;
        app.sound.tap();
        this.currentTab = typeId;
        this.renderTabs();
        if (typeId === 'cards') {
            this.renderCardCatalog();
        } else {
            this.renderList();
        }
        const list = document.getElementById('zukan-list');
        if(list) list.scrollTop = 0;
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

    renderList() {
        const list = document.getElementById('zukan-list');
        if(!list) return;
        list.innerHTML = '';
        list.classList.remove('card-catalog-mode');
        if (typeof DB === 'undefined') return;

        // 全キャラDB
        this.currentList = DB.filter(base => {
            if (this.currentTab !== -1 && base.type !== this.currentTab) return false;
            return true;
        });

        const inventoryMap = {};
        if (app.data && app.data.inventory) {
            app.data.inventory.forEach(u => {
                if (!inventoryMap[u.unitId]) {
                    inventoryMap[u.unitId] = u;
                } else {
                    const current = inventoryMap[u.unitId];
                    const isStronger = (u.maxLv > current.maxLv) || (u.maxLv === current.maxLv && u.lv > current.lv);
                    if (isStronger) inventoryMap[u.unitId] = u;
                }
            });
        }

        const totalCount = this.currentList.length;
        const ownedCount = this.currentList.filter(b => !!inventoryMap[b.id]).length;
        const pct = totalCount > 0 ? Math.floor((ownedCount / totalCount) * 100) : 0;
        const counterEl = document.createElement('div');
        counterEl.className = 'zukan-counter';
        counterEl.innerHTML = `<span class="counter-label">図鑑</span> <span class="counter-num">${ownedCount}</span><span class="counter-slash"> / </span><span class="counter-total">${totalCount}</span> <span class="counter-pct">(${pct}%)</span>`;
        list.appendChild(counterEl);

        this.currentList.forEach((base, index) => {
            const ownedUnit = inventoryMap[base.id];
            const isOwned = !!ownedUnit;
            
            const status = this.getRewardStatus(base.id);
            const hasReward = (status.owned === 'CLAIMABLE' || status.maxLv === 'CLAIMABLE');

            const el = document.createElement('div');
            let rarityClass = (base.cost >= 5) ? ' rarity-ur' : '';
            el.className = `list-card type-${base.type}${rarityClass} ${isOwned ? '' : 'not-owned'}`;
            
            const charImg = IMG_DATA[base.id] ? `url('${IMG_DATA[base.id]}')` : 'none';
            const bgImg = `url('${this.getCardBgUrl(base.type, base.cost)}')`;
            el.style.backgroundImage = `${charImg}, ${bgImg}`;
            el.style.backgroundSize = "cover, cover";

            let gridHtml = '<div class="shape-icon">';
            base.shape.grid.forEach(bit => { gridHtml += `<div class="shape-cell-dot ${bit?'on':''}"></div>`; });
            gridHtml += '</div>';

            const rarityInfo = this.getRarityInfo(base.cost);
            const badgeHtml = hasReward ? '<div class="reward-badge">!</div>' : '';

            el.innerHTML = `
                <div class="lc-header">${gridHtml}</div>
                ${badgeHtml}
                <div class="lc-rarity" style="color:${rarityInfo.color}">${rarityInfo.stars}</div>
                ${!isOwned ? '<div class="lock-icon">🔒</div>' : ''}
            `;
            
            el.onclick = () => { 
                app.sound.tap(); 
                this.openDetail(index);
            };
            list.appendChild(el);
        });
        
        const spacer = document.createElement('div');
        spacer.style.height = '100px';
        spacer.style.gridColumn = '1 / -1';
        list.appendChild(spacer);
    }

    // =============================================
    // ★カード図鑑タブ (グリッド表示版)
    // =============================================
    renderCardCatalog() {
        const list = document.getElementById('zukan-list');
        if (!list) return;
        list.innerHTML = '';
        
        // ★キャラ図鑑と同じグリッドを使用するためクラスを外す
        list.classList.remove('card-catalog-mode');

        if (typeof CARD_EFFECTS === 'undefined' || typeof CARD_COLORS === 'undefined') {
            list.innerHTML = '<div style="padding:40px;text-align:center;color:#888;">カードシステム未初期化</div>';
            return;
        }

        const cm = (app.data && app.data.cardManager) ? app.data.cardManager : null;

        // 所持カード統計
        const ownedByEffect = {};
        const bestByEffect = {};
        if (cm) {
            cm.cards.forEach(c => {
                const key = c.effectType;
                if (!ownedByEffect[key]) ownedByEffect[key] = 0;
                ownedByEffect[key]++;
                if (!bestByEffect[key] || c.level > bestByEffect[key].level ||
                    (c.level === bestByEffect[key].level && c.awakening > bestByEffect[key].awakening)) {
                    bestByEffect[key] = c;
                }
            });
        }

        // ヘッダー: 所持カード数
        const totalCards = cm ? cm.cards.length : 0;
        const totalEffects = Object.keys(CARD_EFFECTS).length;
        const discoveredEffects = Object.keys(ownedByEffect).length;
        const pct = totalEffects > 0 ? Math.floor((discoveredEffects / totalEffects) * 100) : 0;

        const headerEl = document.createElement('div');
        headerEl.className = 'zukan-counter';
        headerEl.innerHTML = `
            <span class="counter-label">カード図鑑</span>
            <span class="counter-num">${discoveredEffects}</span>
            <span class="counter-slash"> / </span>
            <span class="counter-total">${totalEffects} 種</span>
            <span class="counter-pct">(${pct}%)</span>`;
        list.appendChild(headerEl);

        // 色グループごとに表示
        const colorOrder = ['red', 'yellow', 'blue', 'purple'];
        const colorNames = { red: '赤（攻撃系）', yellow: '黄（防御系）', blue: '青（技巧系）', purple: '紫（万能系）' };
        const colorIcons = { red: '🟥', yellow: '🟨', blue: '🟦', purple: '🟪' };
        const colorBorders = { red: '#f44', yellow: '#fa0', blue: '#4af', purple: '#a4f' };

        const effectPool = (typeof CARD_DROP_CONFIG !== 'undefined') ? CARD_DROP_CONFIG.effectPool : {};

        colorOrder.forEach(color => {
            // 色セクションヘッダー (グリッド全幅を使用)
            const sectionEl = document.createElement('div');
            sectionEl.style.gridColumn = '1 / -1';
            sectionEl.style.padding = '6px 10px';
            sectionEl.style.fontSize = '12px';
            sectionEl.style.fontWeight = '900';
            sectionEl.style.color = '#fff';
            sectionEl.style.background = 'rgba(0,0,0,0.6)';
            sectionEl.style.borderLeft = `4px solid ${colorBorders[color]}`;
            sectionEl.style.marginTop = '10px';
            sectionEl.innerHTML = `${colorIcons[color]} ${colorNames[color]}`;
            list.appendChild(sectionEl);

           const effects = effectPool[color] || [];
            effects.forEach(effectType => {
                const effDef = CARD_EFFECTS[effectType];
                if (!effDef) return;

                const owned = ownedByEffect[effectType] || 0;
                const best = bestByEffect[effectType];
                const discovered = owned > 0;

               const el = document.createElement('div');
                el.className = `list-card zukan-card-item ${discovered ? '' : 'not-owned'}`;
                
                // ▼▼▼ ここから変更 ▼▼▼
                // 用意した各属性の画像ファイル名を指定
                // （ファイル名が違う場合は、ここを実際のファイル名に合わせてください）
                const cardImagePath = `images/card_bg_${color}.webp`;

                // 画像を合成せず、1枚の画像として全体を表示(contain)させる
                el.style.setProperty(
                    'background', 
                    `url('${cardImagePath}') center/contain no-repeat`, 
                    'important'
                );
                
                // 画像自体に枠が描かれているため、CSSの枠線は非表示にする
                el.style.setProperty('border', 'none', 'important');
                // 画像の縦横比と枠が合わない場合に備えて、背景色を透明に
                el.style.setProperty('background-color', 'transparent', 'important');

                // 未所持の場合は暗くする
                if (!discovered) {
                    el.style.setProperty('filter', 'brightness(0.3)', 'important');
                }
                // ▲▲▲ ここまで変更 ▲▲▲

                if (discovered) {
                    
                    // 星の文字列
                    const stars = '★'.repeat(best.awakening) + '☆'.repeat(5 - best.awakening);
  const iconPath = `images/icons/icon_${best.effectType}.webp`;
                    el.innerHTML = `
                        <div class="zc-stars">${stars}</div>
                       <div class="zc-lv">lv.${this._getCardDisplayLevel(best)}</div>
                        <div class="zc-center-icon" style="background-image:url('${iconPath}')"></div>

                    `;
                } else {
                    el.innerHTML = `
                        <div class="lock-icon">🔒</div>

                    `;
                }

                el.onclick = () => {
                    if (discovered) this.openCardEffectDetail(effectType, best);
                };

                list.appendChild(el);
            });
        });

        // スペーサー
        const spacerEl = document.createElement('div');
        spacerEl.style.height = '100px';
        spacerEl.style.gridColumn = '1 / -1';
        list.appendChild(spacerEl);
    }

    // ★カード効果の詳細モーダル
    openCardEffectDetail(effectType, bestCard) {
        const effDef = CARD_EFFECTS[effectType];
        if (!effDef) return;
        app.sound.tap();

        const cm = app.data.cardManager;
        const colorInfo = cm ? cm.getCardColorInfo(bestCard) : { name: '?', icon: '🃏' };

        const formatEffect = (calc) => {
            const parts = [];
            if (calc.atkPct) parts.push(`ATK+${Math.floor(calc.atkPct)}%`);
            if (calc.atkFlat) parts.push(`ATK+${calc.atkFlat}`);
            if (calc.hpPct) parts.push(`HP+${Math.floor(calc.hpPct)}%`);
            if (calc.hpFlat) parts.push(`HP+${calc.hpFlat}`);
            if (calc.critPct) parts.push(`会心+${Math.floor(calc.critPct)}%`);
            if (calc.statusResist) parts.push(`耐性+${Math.floor(calc.statusResist)}%`);
            if (calc.spdFlat) parts.push(`SPD+${calc.spdFlat}`);
            if (calc.chargeReduce) parts.push(`CT-${calc.chargeReduce}`);
            if (calc.initCharge) parts.push(`開幕CT+${calc.initCharge}`);
            if (calc.shieldPct) parts.push(`盾${Math.floor(calc.shieldPct)}%`);
            if (calc.desperationAtkPct) parts.push(`背水ATK+${Math.floor(calc.desperationAtkPct)}%`);
            if (calc.lifestealPct) parts.push(`吸血${Math.floor(calc.lifestealPct)}%`);
            return parts.join(' / ') || '-';
        };

        let tableRows = '';
        for (let lv = 1; lv <= 20; lv++) {
            const calc = effDef.calc(lv);
            const isBest = bestCard && bestCard.level === lv;
            tableRows += `<tr class="${isBest ? 'highlight' : ''} ${lv % 5 === 0 ? 'milestone' : ''}">
                <td>Lv.${lv}</td><td>${formatEffect(calc)}</td>
            </tr>`;
        }

        let awakenHtml = '';
        if (effDef.awakenBonus) {
            awakenHtml = '<div class="zk-detail-section"><div class="zk-ds-title">覚醒ボーナス</div>' +
                effDef.awakenBonus.map(b => {
                    const unlocked = bestCard && bestCard.awakening >= b.lv;
                    return `<div class="zk-ds-row ${unlocked ? 'on' : ''}">
                        <span class="zk-ds-lv">覚醒${b.lv}</span>
                        <span>${b.txt}</span>
                        ${unlocked ? '<span class="zk-ds-check">✅</span>' : ''}
                    </div>`;
                }).join('') + '</div>';
        }

        const modal = document.getElementById('zukan-detail-modal');
        if (!modal) return;
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="zk-card-detail-modal">
                <div class="zk-cdm-header" style="border-bottom-color:${bestCard ? ({'red':'#f44','yellow':'#fa0','blue':'#4af','purple':'#a4f'}[bestCard.color] || '#555') : '#555'}">
                    <span class="zk-cdm-icon">${colorInfo.icon}</span>
                    <span class="zk-cdm-name">${effDef.name}</span>
                    ${bestCard ? `<span class="zk-cdm-best">所持最高: Lv.${bestCard.level} ${'★'.repeat(bestCard.awakening)}${'☆'.repeat(5-bestCard.awakening)}</span>` : ''}
                </div>
                <div class="zk-cdm-body">
                    <div class="zk-detail-section">
                        <div class="zk-ds-title">レベル別効果値</div>
                        <table class="zk-lv-table">
                            <thead><tr><th>Lv</th><th>効果</th></tr></thead>
                            <tbody>${tableRows}</tbody>
                        </table>
                    </div>
                    ${awakenHtml}
                </div>
                <button class="zk-cdm-close" onclick="app.zukanScreen.closeDetail()">閉じる</button>
            </div>`;
    }

   openDetail(index) {
     this.detailIndex = index;
     const base = this.currentList[index];
     if(!base) return;

     const isOwned = app.data.inventory.some(u => u.unitId === base.id);
     const status = this.getRewardStatus(base.id);

     const modal = document.getElementById('zukan-detail-modal');
     modal.innerHTML = '';
     modal.style.display = 'flex';

     const hasPrev = (index > 0);
     const hasNext = (index < this.currentList.length - 1);

     const dummySave = { lv: 99, maxLv: 99, skillLv: 10, exp: 0 };
     const unit = new Unit(base, dummySave);
     
     const skillName = base.skill ? base.skill.name : 'なし';
     const skillDesc = unit.getSkillCurrentDesc(); 
     const passive = base.passive || {name:'-', desc:'-'};
     const abilities = unit.getAbilityStatus(); 
     
     const imgUrl = IMG_DATA[base.id] ? `url('${IMG_DATA[base.id]}')` : 'none';
     const bgUrl = this.getCardBgUrl(base.type, base.cost); 
     
     const hpPct = Math.min(100, (unit.maxHp / 2500) * 100);
     const atkPct = Math.min(100, (unit.atk / 800) * 100);
     const spdPct = Math.min(100, (unit.spd / 30) * 100);
     const lvPct = (unit.save.maxLv / 100) * 100;

     const charaClass = isOwned ? 'enh-chara-layer anim-char-appear' : 'enh-chara-layer not-owned-img anim-char-appear';

     const container = document.createElement('div');
     container.className = 'enhance-layout-panel popup-mode';
     container.style.overflow = 'visible'; 
     container.style.background = 'transparent';
     container.style.border = 'none';
     
     const createRewardBtn = (type, label, gem) => {
         const s = status[type]; 
         let btnClass = 'btn-reward';
         let btnText = `💎${gem}`;
         let onClick = `app.zukanScreen.claimReward(${index}, '${type}')`;
         
         if(s === 'LOCKED') {
             btnClass += ' locked';
             btnText = '未達成';
             onClick = '';
         } else if(s === 'CLAIMED') {
             btnClass += ' claimed';
             btnText = '受取済';
             onClick = '';
         } else {
             btnClass += ' active'; 
             btnText = `💎${gem} 受取`;
         }

         return `
             <div class="reward-row">
                 <div class="reward-label">${label}</div>
                 <button class="${btnClass}" onclick="${onClick}">${btnText}</button>
             </div>
         `;
     };

     let abilityHtml = `<div class="f-ability-list-compact">`;
     abilities.forEach(ab => {
         const icon = ab.unlocked ? '🔓' : '🔒';
         const color = ab.unlocked ? '#fff' : '#666';
         abilityHtml += `<div class="f-ab-item-row" style="color:${color}"><span style="font-size:8px;">${icon}</span> ${ab.text}</div>`;
     });
     abilityHtml += `</div>`;

     const navButtons = `
         ${hasPrev ? `<div class="nav-side-btn prev" onclick="app.zukanScreen.switchDetail(-1)">◀</div>` : ''}
         ${hasNext ? `<div class="nav-side-btn next" onclick="app.zukanScreen.switchDetail(1)">▶</div>` : ''}
     `;

     container.innerHTML = `
         ${navButtons} 
         
         <div class="popup-inner-mask" style="
             position: relative; width: 100%; height: 100%; overflow: hidden; border-radius: 6px;
             background: linear-gradient(to bottom, rgba(50,50,50,0.6), rgba(0,0,0,0.95)), url('${bgUrl}') center / 100% 100% no-repeat;
             border: 1px solid rgba(255,255,255,0.4);
             box-shadow: 0 0 20px #000;
         ">
             <div class="bg-particle-layer"></div>
             <div class="bg-glow-layer"></div>
             
             <div class="enh-flash-overlay"></div>

             <div class="${charaClass}" style="background-image:${imgUrl}"></div>
             
             <div class="enh-ui-layer">
                 <div class="enh-header-area">
                     <div class="enh-info-left">
                         <div class="f-rarity-row">
                             <span class="f-rarity">${'★'.repeat(base.cost)}</span>
                             <span class="f-type type-${base.type}">${TYPES[base.type].name}</span>
                         </div>
                         <div class="f-name large">${base.name}</div>
                         <div class="f-lb-row">${isOwned ? '<span style="color:#0f0">所持済</span>' : '<span style="color:#888">未所持</span>'}</div>
                     </div>
                 </div>
                 
                 <div class="enh-footer-area">
                     <div class="enh-detail-grid">
                         
                         <div class="status-bar-row">
                             <div class="stat-cell">
                                 <div class="stat-bg-bar"><div class="stat-fill-bar" style="width:${lvPct}%; background:#d4af37;"></div></div>
                                 <div class="stat-content"><span class="lbl">LV</span> <span class="val">${unit.save.maxLv}</span></div>
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

                         <div class="f-section-compact reward-box">
                             <div class="head" style="color:#ffd700;">COLLECTION BONUS</div>
                             ${createRewardBtn('owned', '入手ボーナス', this.REWARD_OWNED)}
                             ${createRewardBtn('maxLv', 'LvMAXボーナス', this.REWARD_MAXLV)}
                         </div>

                         <div class="info-group">
                             <div class="f-section-compact c-skill">
                                 <div class="head">SKILL: ${skillName}</div>
                                 <div class="desc">${skillDesc}</div>
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
                         <button class="btn-red" onclick="app.zukanScreen.closeDetail()">閉じる</button>
                     </div>
                 </div>
             </div>
         </div>
     `;
     
     modal.appendChild(container);
 }

    switchDetail(dir) {
        app.sound.tap();
        const newIndex = this.detailIndex + dir;
        if(newIndex >= 0 && newIndex < this.currentList.length) {
            this.openDetail(newIndex);
        }
    }

     hideDetailModal() {
        const modal = document.getElementById('zukan-detail-modal');
        if (!modal) return;
        modal.style.display = 'none';
        modal.innerHTML = '';
    }

    onLeave() {
        this.hideDetailModal();
    }

    closeDetail() {
        app.sound.tap();
         this.hideDetailModal();
        this.renderList();
    }

}