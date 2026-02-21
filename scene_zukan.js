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

        this.injectStyles();
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
                    const rank = cm.getCardRank(best); // SSS, SS, S, A, B など
                    // ランクの頭文字1文字だけ取得
                    const rankChar = rank.charAt(0);
                    // 星の文字列
                    const stars = '★'.repeat(best.awakening) + '☆'.repeat(5 - best.awakening);

                    el.innerHTML = `
                        <div class="zc-stars">${stars}</div>
                        <div class="zc-lv">lv.${best.level}</div>
                        <div class="zc-rank rank-${rankChar}">${rankChar}</div>
                        <div class="zc-name">${effDef.name}</div>
                    `;
                } else {
                    el.innerHTML = `
                        <div class="lock-icon">🔒</div>
                        <div class="zc-name" style="color:#888;">???</div>
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

    closeDetail() {
        app.sound.tap();
        document.getElementById('zukan-detail-modal').style.display = 'none';
        this.renderList();
    }

    injectStyles() {
        const oldStyles = document.querySelectorAll('style[id^="zukan-style"]');
        oldStyles.forEach(s => s.remove());

        const style = document.createElement('style');
        style.id = 'zukan-style-final-v19';
        style.innerHTML = `
            #screen-zukan {
                background: linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), url('images/bg_main.webp') center/cover no-repeat fixed !important;
                flex-direction: column;
                height: 100vh;
                height: 100dvh;
                overflow: hidden !important;
                padding-bottom: 70px;
                box-sizing: border-box;
            }
            #screen-zukan.active { display: flex !important; }

            .tab-area { flex: 0 0 auto; display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; padding: 4px; background: rgba(17,17,17,0.4); border-radius: 4px; margin-top: 5px; }
            
            .zukan-counter {
                grid-column: 1 / -1;
                text-align: center;
                padding: 6px 10px;
                background: linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(139,90,43,0.4) 20%, rgba(139,90,43,0.4) 80%, rgba(0,0,0,0) 100%);
                border-bottom: 1px solid rgba(139,90,43,0.5);
                font-size: 13px;
                color: #ccc;
            }
            .zukan-counter .counter-label { color: #ffd700; font-weight: bold; }
            .zukan-counter .counter-num { color: #00ced1; font-weight: bold; font-size: 16px; }
            .zukan-counter .counter-slash { color: #666; }
            .zukan-counter .counter-total { color: #aaa; font-size: 14px; }
            .zukan-counter .counter-pct { color: #ffd700; font-size: 11px; }

            #zukan-list {
                flex: 1; min-height: 0; overflow-y: auto !important; overflow-x: hidden;
                background-color: rgba(60, 40, 25, 0.3) !important; border: 3px solid #8b5a2b !important;
                border-radius: 6px !important; box-shadow: inset 0 0 20px rgba(0,0,0,0.5), 0 5px 15px rgba(0,0,0,0.5) !important;
                padding: 10px !important; margin: 5px;
                display: grid !important; grid-template-columns: repeat(5, 1fr) !important;
                gap: 20px 6px !important; 
                grid-auto-rows: max-content !important; 
                align-content: start !important;
            }
            #zukan-list::-webkit-scrollbar { width: 6px; }
            #zukan-list::-webkit-scrollbar-track { background: rgba(0,0,0,0.3); }
            #zukan-list::-webkit-scrollbar-thumb { background: #8b5a2b; border-radius: 3px; }

            /* カード図鑑モード: グリッドを解除してブロック表示 (今回は外すので未使用) */
            #zukan-list.card-catalog-mode {
                display: block !important;
                grid-template-columns: none !important;
            }

            #zukan-list .list-card {
                width: 100% !important; 
                min-height: 120px !important;
                aspect-ratio: 3/4 !important;
                border: 1px solid #555; border-radius: 4px; position: relative; cursor: pointer;
                background-size: cover, cover !important; background-position: top center, center !important; 
                background-repeat: no-repeat, no-repeat !important; background-color: rgba(34, 34, 34, 0.8);
                overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.5); margin: 0 !important;
            }

            #zukan-list .list-card.not-owned { filter: grayscale(100%) brightness(0.4); border-color: #333 !important; }
            .lock-icon { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 24px; text-shadow: 0 0 5px #000; }
            .lc-header { top: 5px !important; left: 5px !important; background: rgba(0, 0, 0, 0.8) !important; padding: 3px !important; border-radius: 4px !important; border: 1px solid rgba(255,255,255,0.3) !important; box-shadow: 0 0 5px rgba(0,0,0,0.5) !important; z-index: 10; }
            .shape-icon { width: 22px !important; height: 22px !important; gap: 2px !important; display: grid !important; grid-template-columns: 1fr 1fr !important; }
            .shape-cell-dot { background: #222 !important; border: 1px solid #555 !important; border-radius: 2px !important; }
            .shape-cell-dot.on { background: #00ff00 !important; border-color: #fff !important; box-shadow: 0 0 4px #00ff00 !important; }
            
            /* ★カード図鑑用 グリッド内要素 */
            .zukan-card-item {
                position: relative;
                border-radius: 6px !important;
                transition: transform 0.1s;
            }
            .zukan-card-item:active { transform: scale(0.95); }
            
            .zc-stars {
                position: absolute;
                top: 3px; left: 0; width: 100%;
                text-align: center;
                font-size: 8px;
                color: #ffd700;
                text-shadow: 1px 1px 0 #000;
                letter-spacing: -1px;
                z-index: 2;
            }
            .zc-lv {
                position: absolute;
                top: 15px; left: 3px;
                font-size: 10px;
                font-weight: 900;
                color: #fff;
                text-shadow: 1px 1px 2px #000;
                z-index: 2;
                font-family: Arial, sans-serif;
            }
            .zc-rank {
                position: absolute;
                top: 13px; right: 3px;
                width: 20px; height: 20px;
                border-radius: 50%;
                border: 2px solid #fff;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 13px;
                font-weight: 900;
                color: #fff;
                background: rgba(0,0,0,0.6);
                box-shadow: 0 2px 4px rgba(0,0,0,0.8);
                text-shadow: 1px 1px 0 #000;
                z-index: 2;
                font-family: Arial, sans-serif;
            }
            .zc-name {
                position: absolute;
                bottom: 0; left: 0; width: 100%;
                background: rgba(0,0,0,0.75);
                color: #fff;
                font-size: 10px;
                text-align: center;
                padding: 4px 2px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                font-weight: bold;
                z-index: 2;
                box-sizing: border-box;
            }
            
            /* ランク別の色 */
            .zc-rank.rank-S { border-color: #ffd700; color: #ffd700; }
            .zc-rank.rank-A { border-color: #ff6666; color: #ff6666; }
            .zc-rank.rank-B { border-color: #66ccff; color: #66ccff; }
            .zc-rank.rank-C { border-color: #66ff66; color: #66ff66; }
            .zc-rank.rank-D { border-color: #aaaaaa; color: #aaaaaa; }

            /* ポップアップ(詳細) */
            .enhance-layout-panel.popup-mode {
                width: 90%; max-width: 400px;
                height: 600px !important; 
                border: none !important; 
                background: transparent !important;
                box-shadow: none !important;
                animation: popIn 0.3s; 
                position: relative; 
            }
            .not-owned-img { filter: grayscale(100%) brightness(0); opacity: 0.7; }
            
            .popup-mode .enh-chara-layer {
                top: 5px !important;
                height: 45% !important; 
                background-size: contain !important;
                background-position: center bottom !important;
                z-index: 2; 
            }

            .anim-char-appear { animation: charAppearEpic 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
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

            .enh-footer-area {
                height: 55% !important; 
                bottom: 0; position: absolute; width: 100%; box-sizing: border-box;
                background: linear-gradient(to top, rgba(0,0,0,1) 70%, rgba(0,0,0,0.8) 90%, rgba(0,0,0,0)) !important;
                padding: 10px 10px 5px 10px;
                display: flex; flex-direction: column; justify-content: flex-end;
                z-index: 10;
                border-top: none !important;
                box-shadow: none !important;
            }
            
            .enh-detail-grid { display: flex; flex-direction: column; gap: 3px; height: 100%; overflow: hidden; justify-content: flex-end; }
            
            .status-bar-row {
                display: flex; justify-content: space-between; align-items: center;
                gap: 4px; margin-bottom: 2px;
            }
            .stat-cell { 
                flex: 1; position: relative; height: 20px; 
                background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.2); 
                border-radius: 4px; overflow: hidden;
            }
            .stat-bg-bar { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; }
            .stat-fill-bar { height: 100%; opacity: 0.4; transition: width 0.5s ease-out; }
            .stat-content { 
                position: absolute; top: 0; left: 0; width: 100%; height: 100%; 
                display: flex; align-items: center; justify-content: space-between; 
                padding: 0 4px; box-sizing: border-box; z-index: 1;
            }
            .stat-cell .lbl { font-size: 8px; color: #ddd; font-weight: bold; }
            .stat-cell .val { font-size: 11px; font-weight: 900; font-family: monospace; text-shadow: 1px 1px 0 #000; }

            .f-section-compact { margin-bottom: 1px !important; padding: 3px 6px !important; border-radius: 4px; background: rgba(50,50,50,0.5); border-left: 2px solid #555; }
            .f-section-compact .head { font-size: 10px; font-weight: bold; margin-bottom: 1px; }
            .f-section-compact .desc { font-size: 10px; line-height: 1.2; color: #ccc; }
            
            .f-ability-list-compact { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; }
            .f-ab-item-row { font-size: 9px; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

            .tab-btn { background: rgba(60, 60, 60, 0.6) !important; border: 1px solid #666; color: #ccc; font-size: 11px; padding: 6px 10px; border-radius: 4px; transition: 0.2s; cursor: pointer; }
            .tab-btn.active { background: #00ced1 !important; color: #000 !important; font-weight: bold; border-color: #fff; box-shadow: 0 0 5px #00ced1; }
            
            .nav-side-btn {
                position: absolute; top: 50%; width: 50px; height: 80px; background: rgba(0,0,0,0.5);
                border: 2px solid #fff; color: #fff; font-size: 28px; display: flex; align-items: center; justify-content: center;
                cursor: pointer; z-index: 100; transform: translateY(-50%); transition: 0.2s; box-shadow: 0 0 10px rgba(0,0,0,0.5);
            }
            .nav-side-btn:hover { background: rgba(0,255,255,0.4); box-shadow: 0 0 15px #0ff; }
            .nav-side-btn.prev { left: -60px; border-radius: 8px 0 0 8px; }
            .nav-side-btn.next { right: -60px; border-radius: 0 8px 8px 0; }
            
            .reward-badge { position: absolute; top: -5px; right: -5px; width: 20px; height: 20px; background: #f00; border: 2px solid #fff; color: #fff; border-radius: 50%; font-weight: bold; font-size: 14px; display: flex; align-items: center; justify-content: center; z-index: 20; box-shadow: 0 0 5px #f00; animation: bounce 1s infinite; }
            @keyframes bounce { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.2); } }
            .reward-box { background: rgba(50, 20, 0, 0.5); border: 1px solid #a64; margin-bottom: 2px; }
            .reward-row { display: flex; justify-content: space-between; align-items: center; margin-top: 1px; font-size: 10px; color: #ddd; border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 1px; }
            .btn-reward { border: none; padding: 1px 6px; border-radius: 3px; font-weight: bold; font-size: 9px; cursor: default; width: 60px; }
            .btn-reward.locked { background: #333; color: #666; border: 1px solid #555; }
            .btn-reward.active { background: linear-gradient(to bottom, #00ced1, #008b8b); color: #fff; border: 1px solid #fff; cursor: pointer; box-shadow: 0 0 5px #00ced1; animation: pulseBtn 1s infinite alternate; }
            .btn-reward.claimed { background: transparent; color: #0f0; border: 1px solid #0f0; opacity: 0.7; }
            @keyframes pulseBtn { from { filter: brightness(1); } to { filter: brightness(1.3); } }

            /* カード効果詳細モーダル */
            .zk-card-detail-modal {
                width: 90%;
                max-width: 360px;
                max-height: 80vh;
                background: #1a1a2e;
                border: 1px solid #555;
                border-radius: 12px;
                overflow: hidden;
                display: flex;
                flex-direction: column;
            }
            .zk-cdm-header {
                padding: 12px;
                text-align: center;
                background: rgba(0,0,0,0.5);
                border-bottom: 2px solid #555;
            }
            .zk-cdm-icon { font-size: 20px; margin-right: 6px; }
            .zk-cdm-name { font-size: 16px; font-weight: 900; color: #fff; }
            .zk-cdm-best { display: block; font-size: 11px; color: #ffd700; margin-top: 4px; }
            .zk-cdm-body { flex: 1; overflow-y: auto; padding: 10px; }
            .zk-detail-section { margin-bottom: 10px; }
            .zk-ds-title { font-size: 12px; font-weight: bold; color: #ccc; border-bottom: 1px solid #333; padding-bottom: 4px; margin-bottom: 6px; }
            .zk-ds-row {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 4px 6px;
                font-size: 11px;
                color: #666;
                border-bottom: 1px solid rgba(255,255,255,0.05);
            }
            .zk-ds-row.on { color: #ffd700; }
            .zk-ds-lv { font-weight: bold; width: 45px; flex-shrink: 0; }
            .zk-ds-check { margin-left: auto; flex-shrink: 0; }
            .zk-lv-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 10px;
            }
            .zk-lv-table th {
                background: rgba(0,0,0,0.4);
                color: #aaa;
                padding: 4px 6px;
                text-align: left;
                border-bottom: 1px solid #444;
            }
            .zk-lv-table td {
                padding: 3px 6px;
                color: #ccc;
                border-bottom: 1px solid rgba(255,255,255,0.05);
            }
            .zk-lv-table tr.highlight td { color: #ffd700; font-weight: bold; background: rgba(255,215,0,0.1); }
            .zk-lv-table tr.milestone td { border-bottom: 1px solid #444; }
            .zk-cdm-close {
                padding: 10px;
                background: rgba(255,255,255,0.1);
                border: none;
                color: #aaa;
                font-size: 13px;
                cursor: pointer;
                border-top: 1px solid #333;
            }
            .zk-cdm-close:active { background: rgba(255,255,255,0.2); }
        `;
        document.head.appendChild(style);
    }
}