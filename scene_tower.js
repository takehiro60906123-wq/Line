/**
 * scene_tower.js - 久遠の塔 画面管理
 * ・戦闘前に敵編成をカードグリッドでプレビュー
 * ・倒すまで敵固定 (localStorageに保存)
 * ・10ジェムで敵入替え
 */
class TowerScreen {
    constructor() {
        this.floor = 1;
        this.enemyUnits = [];
    }

    onEnter() {
        // ★デバッグ用: 強制的に1階に戻す場合はここを有効化
        //app.data.towerFloor = 1; app.data.save();

        this.floor = app.data.towerFloor || 1;
        
        // 階層データが不正(0以下など)なら1に戻す安全策
        if (this.floor < 1) this.floor = 1;

        this.ensureEnemyData();
        this.render();
    }

    // =============================================
    // 敵データの生成・復元
    // =============================================
    ensureEnemyData() {
        const saved = app.data.towerEnemyData;
        if (saved && saved.floor === this.floor && saved.enemies && saved.enemies.length > 0) {
            this.enemyUnits = this._restoreUnits(saved.enemies);
        } else {
            this.generateAndSave();
        }
    }

    generateAndSave() {
        const enemies = this._generateEnemyData(this.floor);
        app.data.towerEnemyData = { floor: this.floor, enemies: enemies };
        app.data.save();
        this.enemyUnits = this._restoreUnits(enemies);
    }

    _generateEnemyData(floor) {
        if (typeof DB === 'undefined' || typeof Unit === 'undefined') return [];

        const result = [];
        const occupied = [];
        const lv = floor;
        const isBoss = (floor % 5 === 0);

        let lbCount = 0;
        if (lv >= 30) lbCount = 1;
        if (lv >= 50) lbCount = 2;
        if (lv >= 70) lbCount = 3;
        if (lv >= 90) lbCount = 4;
        if (lv >= 100) lbCount = 5;
        const skillLv = Math.min(10, 1 + Math.floor(floor / 5));

        let maxUnits = 4;
        if (isBoss) {
            maxUnits = 8;
        } else {
            if (floor >= 10) maxUnits = 5;
            if (floor >= 20) maxUnits = 6;
            if (floor >= 30) maxUnits = 7;
            if (floor >= 40) maxUnits = 8;
        }

        // ★v2.2: テーマ編成 — リーダーバフが活きるよう属性を統一
        const elements = ['fire','water','grass','light','dark','neutral'];
        const teamElement = elements[Math.floor(Math.random() * elements.length)];
        const elementPool = DB.filter(u => u.element === teamElement);
        const allPool = DB;

        if (isBoss) {
            // ボス: 同属性の高BST or 伝説キャラをリーダーに
            const bossPool = elementPool.filter(u => u.cost >= 5) || allPool.filter(u => u.cost >= 5);
            const bossBase = (bossPool.length > 0) ? bossPool[Math.floor(Math.random() * bossPool.length)] 
                           : (elementPool.length > 0 ? elementPool.reduce((a,b) => a.bst > b.bst ? a : b) : DB[0]);
            const leaderLv = lv + 5;
            const maxLv = Math.max(leaderLv, 50 + (lbCount * 5));
            const tryAnchors = [1, 2, 5, 6, 0, 3, 4, 7];
            const tmpUnit = new Unit(bossBase, { uid: 'tmp', unitId: bossBase.id, lv: leaderLv, maxLv: maxLv, skillLv: skillLv });
            for (const anchor of tryAnchors) {
                const cells = tmpUnit.getOccupiedCells(anchor);
                if (cells && !cells.some(c => occupied.includes(c))) {
                    cells.forEach(c => occupied.push(c));
                    result.push({ unitId: bossBase.id, anchor: anchor, lv: leaderLv, maxLv: maxLv, skillLv: skillLv });
                    break;
                }
            }
        }

        // 残りは同属性70% + ランダム30% で埋める (リーダーバフ条件が満たされやすい)
        for (let k = 0; k < 50; k++) {
            if (result.length >= maxUnits) break;
            if (occupied.length >= 8) break;

            let base;
            const useSameElement = Math.random() < 0.70 && elementPool.length > 0;
            if (isBoss) {
                const midPool = elementPool.filter(u => u.cost >= 3);
                if (useSameElement && midPool.length > 0) {
                    base = midPool[Math.floor(Math.random() * midPool.length)];
                } else if (useSameElement && elementPool.length > 0) {
                    base = elementPool[Math.floor(Math.random() * elementPool.length)];
                } else {
                    base = allPool[Math.floor(Math.random() * allPool.length)];
                }
            } else {
                if (useSameElement) {
                    base = elementPool[Math.floor(Math.random() * elementPool.length)];
                } else {
                    base = allPool[Math.floor(Math.random() * allPool.length)];
                }
            }

            const myMaxLv = Math.max(lv, 50 + (lbCount * 5));
            const tmpUnit = new Unit(base, { uid: 'tmp', unitId: base.id, lv: lv, maxLv: myMaxLv, skillLv: skillLv });
            const anchor = Math.floor(Math.random() * 8);
            const cells = tmpUnit.getOccupiedCells(anchor);

            if (cells && !cells.some(c => occupied.includes(c))) {
                cells.forEach(c => occupied.push(c));
                result.push({ unitId: base.id, anchor: anchor, lv: lv, maxLv: myMaxLv, skillLv: skillLv });
            }
        }

        if (result.length === 0) {
            result.push({ unitId: DB[0].id, anchor: 0, lv: lv, maxLv: 99, skillLv: 1 });
        }
        return result;
    }

    _restoreUnits(enemies) {
        const units = [];
        for (const e of enemies) {
            const base = DB.find(u => u.id === e.unitId);
            if (!base) continue;
            const unit = new Unit(base, {
                uid: 'tower_preview_' + e.anchor,
                unitId: e.unitId,
                lv: e.lv,
                maxLv: e.maxLv,
                skillLv: e.skillLv
            });
            unit._anchor = e.anchor;
            units.push(unit);
        }
        return units;
    }

    // =============================================
    // 敵入替え (10ジェム)
    // =============================================
    rerollEnemy() {
        const cost = 10;
        if (app.data.gems < cost) {
            alert('ジェムが足りません (必要: 💎' + cost + ')');
            return;
        }
        if (!confirm('💎' + cost + ' を消費して敵を入替えますか？')) return;
        app.data.consumeGems(cost);
        if (app.sound) app.sound.tap();
        this.generateAndSave();
        this.render();
    }

    // =============================================
    // 画面レンダリング
    // =============================================
    render() {
        const floorNum = document.getElementById('tower-floor-num');
        const enemyInfo = document.getElementById('tower-enemy-info');

        if (floorNum) floorNum.innerText = '第 ' + this.floor + ' 階層';

       // 【修正前】 const estLv = 10 + (this.floor * 2);
        // 【修正後】 生成部分の計算式と同じにする
        const estLv = this.floor;
        const isBoss = (this.floor % 5 === 0);
        const rewardGem = isBoss ? 500 : 500;
        const rewardGold = this.floor * 1000;

        let totalHp = 0, totalAtk = 0;
        this.enemyUnits.forEach(u => { totalHp += u.maxHp; totalAtk += u.atk; });

        if (enemyInfo) {
            enemyInfo.innerHTML = ''
                + '<div class="tower-info-row" style="margin-bottom:6px;">'
                + '  敵Lv.' + estLv + ' '
                + (isBoss ? '<span style="color:#ff4444;font-weight:bold;">⚠ BOSS階層</span>' : '(通常階層)')
                + '</div>'
                + '<div class="tower-section-label">敵 編成</div>'
                + '<div class="tower-card-grid" id="tower-card-grid"></div>'
                + '<div class="tower-enemy-stats">'
                + '  <span class="tes-item">❤️ ' + totalHp.toLocaleString() + '</span>'
                + '  <span class="tes-item">⚔️ ' + totalAtk.toLocaleString() + '</span>'
                + '  <span class="tes-item">👥 ' + this.enemyUnits.length + '体</span>'
                + '</div>'
                + '<button class="btn-tower-reroll" onclick="app.towerScreen.rerollEnemy()">'
                + '  🔄 敵を入替え <span style="font-size:11px;opacity:0.8;">(💎10)</span>'
                + '</button>'
                + '<div class="tower-reward">'
                + '  <div style="font-size:11px;color:#aaa;margin-bottom:3px;">クリア報酬</div>'
                + '  <div style="display:flex;align-items:center;gap:15px;justify-content:center;font-size:14px;">'
                + '    <span>💎 ' + rewardGem + '</span>'
                + '    <span>💰 ' + rewardGold.toLocaleString() + '</span>'
                + '  </div>'
                + '</div>';
        }

        this.renderEnemyCards();
    }

    // =============================================
    // ★カードグリッド表示 (編成画面と同じスタイル)
    // =============================================
    renderEnemyCards() {
        const grid = document.getElementById('tower-card-grid');
        if (!grid) return;
        grid.innerHTML = '';

        const ELEM_ICONS = { fire:'🔥', water:'💧', grass:'🌿', light:'☀️', dark:'🌑', neutral:'⚪' };

        // ★リーダースキル表示
        if (this.enemyUnits.length > 0) {
            const leader = this.enemyUnits.reduce((a,b) => (a._anchor <= b._anchor) ? a : b);
            const ls = leader.base && leader.base.leaderSkill;
            if (ls) {
                const lsDiv = document.createElement('div');
                lsDiv.style.cssText = 'text-align:center;margin:4px 0;padding:4px 8px;background:rgba(255,215,0,0.15);border:1px solid rgba(255,215,0,0.4);border-radius:6px;font-size:12px;color:#ffd700;';
                lsDiv.innerHTML = '👑 ' + leader.base.name + '「' + ls.name + '」<br><span style="font-size:11px;color:#ccc;">' + ls.desc + '</span>';
                grid.parentNode.insertBefore(lsDiv, grid);
            }
        }

        this.enemyUnits.forEach(unit => {
            const card = document.createElement('div');
            card.className = 'tower-enemy-card';

            const bgUrl = this._getCardBgUrl(unit.base.type, unit.base.cost);
            const charImg = (typeof IMG_DATA !== 'undefined' && IMG_DATA[unit.base.id])
                ? 'url(' + IMG_DATA[unit.base.id] + ')'
                : 'none';
            card.style.backgroundImage = charImg + ', url(\'' + bgUrl + '\')';
            card.style.backgroundSize = 'cover, cover';
            card.style.backgroundPosition = 'center, center';

            if (unit.base.cost >= 5) card.classList.add('rarity-ur');

            const lvBadge = document.createElement('div');
            lvBadge.className = 'tec-lv-badge';
            lvBadge.textContent = 'Lv' + unit.save.lv;
            card.appendChild(lvBadge);

            // ★属性アイコン (旧typeバッジの代替)
            const elemIcon = ELEM_ICONS[unit.base.element] || '⚪';
            const typeBadge = document.createElement('div');
            typeBadge.className = 'tec-type-badge';
            typeBadge.textContent = elemIcon;
            card.appendChild(typeBadge);

            const footer = document.createElement('div');
            footer.className = 'tec-footer';
            const cost = unit.base.cost;
            const lbCount = unit.lbCount || 0;
            let starsHtml = '';
            for (let i = 0; i < 5; i++) {
                if (i < lbCount) starsHtml += '<span style="color:#ff0055;text-shadow:0 0 5px #ff0055;">★</span>';
                else if (i < cost) starsHtml += '<span style="color:#ffd700;text-shadow:1px 1px 0 #000;">★</span>';
                else starsHtml += '<span style="color:#444;">★</span>';
            }
            footer.innerHTML = starsHtml;
            card.appendChild(footer);

            if (charImg === 'none') {
                const nameFallback = document.createElement('div');
                nameFallback.className = 'tec-name-fallback';
                nameFallback.textContent = unit.base.name;
                card.appendChild(nameFallback);
            }

            grid.appendChild(card);
        });
    }

    _getCardBgUrl(typeId, cost) {
        const colors = ['purple', 'gold', 'pink', 'green', 'blue', 'red'];
        const color = colors[typeId] || 'red';
        let rarity = 'r';
        if (cost >= 5) rarity = 'ur';
        else if (cost >= 3) rarity = 'sr';
        return 'images/bg/bg_' + color + '_' + rarity + '.webp';
    }

    _getRarityInfo(cost) {
        if (cost >= 5) return { label: 'UR', color: '#e100ff', stars: '★★★★★' };
        if (cost === 4) return { label: 'SSR', color: '#ffd700', stars: '★★★★' };
        if (cost === 3) return { label: 'SR', color: '#c0c0c0', stars: '★★★' };
        return { label: 'R', color: '#cd7f32', stars: '★'.repeat(Math.max(1, cost)) };
    }

    // =============================================
    // ★戦闘開始 (事前生成データをそのまま渡す)
    // =============================================
    startBattle() {
        if (!app.data.deck || app.data.deck.length === 0) {
            alert("部隊を編成してください");
            return;
        }
        if (app.sound) app.sound.tap();

        // 保存済みの敵データをそのまま渡す
        const saved = app.data.towerEnemyData;
        app.changeScene('screen-battle', {
            mode: 'tower',
            floor: this.floor,
            pregenEnemies: (saved && saved.enemies) ? saved.enemies : null
        });
    }
}
