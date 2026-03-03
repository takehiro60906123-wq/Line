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
    // 画面レンダリング (編成ボードと同じデザインで構築)
    // =============================================
   render() {
        const floorNum = document.getElementById('tower-floor-num');
        const enemyInfo = document.getElementById('tower-enemy-info');

        if (floorNum) floorNum.style.display = 'none'; // 古い上部テキストは隠し、新しいヘッダーに統合

        const estLv = this.floor;
        const isBoss = (this.floor % 5 === 0);
        const rewardGem = isBoss ? 500 : 500;
        const rewardGold = this.floor * 1000;

        let totalHp = 0, totalAtk = 0;
        this.enemyUnits.forEach(u => { totalHp += u.maxHp; totalAtk += u.atk; });

        if (enemyInfo) {
            // 空マスのデザイン (少し暗く、リッチな質感に)
            let cellsHtml = '';
            for (let i = 0; i < 8; i++) {
                let label = i < 4 ? 'FRONT ' + (i + 1) : 'BACK ' + (i - 3);
                cellsHtml += `<div class="grid-cell" data-idx="${i}" style="position:relative; background:rgba(20, 25, 35, 0.8); border:1px solid rgba(255,255,255,0.06); box-shadow: inset 0 0 12px rgba(0,0,0,0.8); display:flex; align-items:center; justify-content:center; color:rgba(255,255,255,0.15); font-size:10px; font-weight:900; font-family:Arial, sans-serif; letter-spacing:1px; border-radius:4px; box-sizing:border-box;">${label}</div>`;
            }

            const headerColor = isBoss ? '#ff4444' : '#00ced1';
            const headerText = isBoss ? '⚠ BOSS BATTLE' : 'ENEMY FORMATION';

         enemyInfo.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid ${headerColor}; padding-bottom: 4px; margin-bottom: 6px; position:relative;">
                    
                    <button onclick="app.changeScene('screen-home')" style="position:absolute; top:-2px; right:0; z-index:10; background:rgba(0,0,0,0.6); border:1px solid rgba(255,255,255,0.3); color:#fff; border-radius:50%; width:30px; height:30px; font-size:14px; display:flex; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.5);">🏠</button>

                    <div style="position:absolute; bottom:0; left:0; width:60%; height:2px; background:linear-gradient(90deg, #fff, transparent); z-index:2;"></div>
                    
                    <div style="font-size: 15px; font-weight: 900; color: #fff; text-shadow: 0 2px 4px rgba(0,0,0,0.8), 0 0 10px ${headerColor}; letter-spacing: 1px; line-height: 1.1; padding-top:2px;">
                        <span style="font-size: 9px; color: ${headerColor}; text-shadow:none; font-family: Arial, sans-serif;">FLOOR ${this.floor}</span><br>
                        ${headerText}
                    </div>
                    <div style="text-align:right; padding-right: 36px;">
                        <div style="font-size: 9px; color: #aaa; font-weight: bold;">敵Lv目安</div>
                        <div style="font-size: 15px; color: #fff; font-weight: 900; font-family: 'Arial Black', sans-serif; text-shadow: 1px 1px 0 #000, 0 0 5px rgba(255,255,255,0.4);">Lv.${estLv}</div>
                    </div>
                </div>

                <div class="formation-board-large" style="margin: 0 auto 6px auto !important; width: 80% !important; aspect-ratio: 2 / 1; position: relative;">
                    <div class="grid-bg" id="tower-grid-bg" style="display:grid; grid-template-columns:repeat(4,1fr); grid-template-rows:repeat(2,1fr); width:100%; height:100%; gap:2px; padding:2px; box-sizing:border-box; background:rgba(10, 15, 25, 0.8);">
                        ${cellsHtml}
                    </div>
                    <div id="tower-enemy-board-layer" style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none;"></div>
                </div>

                <div id="tower-leader-skill-area" style="margin-bottom: 6px;"></div>

                <div style="background: linear-gradient(135deg, rgba(20,25,35,0.95), rgba(10,15,25,0.95)); border: 1px solid rgba(100, 120, 150, 0.3); border-radius: 6px; padding: 6px 10px; margin-bottom: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.6);">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed rgba(255,255,255,0.15); padding-bottom: 4px; margin-bottom: 4px;">
                        <div style="font-size: 9px; color: #88c0d0; font-weight: bold; letter-spacing: 0.5px;">ENEMY STATS</div>
                        <div style="display: flex; gap: 12px; font-size: 11px; font-weight: 900; font-family: Arial, sans-serif; text-shadow: 1px 1px 0 #000;">
                            <span style="color:#ff6b6b; display:flex; align-items:center; gap:2px;"><span style="font-size:8px; color:#aaa;">HP</span> ${totalHp.toLocaleString()}</span>
                            <span style="color:#f6c177; display:flex; align-items:center; gap:2px;"><span style="font-size:8px; color:#aaa;">ATK</span> ${totalAtk.toLocaleString()}</span>
                        </div>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="font-size: 9px; color: #d8dee9; font-weight: bold; letter-spacing: 0.5px;">CLEAR REWARD</div>
                        <div style="display: flex; gap: 12px; font-size: 12px; font-weight: 900; font-family: Arial, sans-serif; text-shadow: 1px 1px 0 #000;">
                            <span style="color: #55ffff; filter: drop-shadow(0 0 2px rgba(0,255,255,0.6));">💎 ${rewardGem}</span>
                            <span style="color: #ffdd55; filter: drop-shadow(0 0 2px rgba(255,221,0,0.6));">💰 ${rewardGold.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                <button onclick="app.towerScreen.rerollEnemy()" style="width: 100%; padding: 8px; background: linear-gradient(180deg, #4a2b4d, #25162b); border: 1px solid #c678dd; border-radius: 6px; color: #fff; font-size: 12px; font-weight: 900; box-shadow: 0 2px 5px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.2); cursor: pointer; text-shadow: 1px 1px 2px #000; display: flex; align-items: center; justify-content: center; gap: 10px;">
                    <span>🔄 敵部隊を再探索する</span>
                    <span style="background: rgba(0,0,0,0.6); padding: 2px 6px; border-radius: 10px; font-size: 9px; border: 1px solid rgba(255,255,255,0.2); color: #e06c75; font-weight: bold;">消費 💎10</span>
                </button>
            `;
        }

        this.renderEnemyCards();
    }

   // =============================================
    // ★カードグリッド表示 (編成画面の配置ロジック)
    // =============================================
   renderEnemyCards() {
        const layer = document.getElementById('tower-enemy-board-layer');
        const bg = document.getElementById('tower-grid-bg');
        if (!layer || !bg) return;
        layer.innerHTML = '';

        // ★高品質なリーダースキル装飾
        if (this.enemyUnits.length > 0) {
            const leader = this.enemyUnits.reduce((a,b) => (a._anchor <= b._anchor) ? a : b);
            const ls = leader.base && leader.base.leaderSkill;
            const lsArea = document.getElementById('tower-leader-skill-area');
            
            if (ls && lsArea) {
                lsArea.innerHTML = `
                    <div style="background: linear-gradient(90deg, rgba(40,30,10,0.95) 0%, rgba(80,60,15,0.85) 50%, rgba(40,30,10,0.95) 100%); border: 1px solid #e5c07b; border-radius: 6px; padding: 6px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.7), inset 0 0 15px rgba(229,192,123,0.15); display: flex; align-items: center; gap: 8px;">
                        <div style="font-size: 24px; filter: drop-shadow(0 0 5px #e5c07b); line-height:1;">👑</div>
                        <div style="flex: 1; text-align: left;">
                            <div style="font-size: 9px; color: #e5c07b; font-weight: 900; margin-bottom: 2px; letter-spacing: 0.5px;">LEADER EFFECT</div>
                            <div style="font-size: 12px; color: #fff; font-weight: bold; text-shadow: 1px 1px 0 #000; margin-bottom: 2px;">${ls.name} <span style="font-size:9px; color:#aaa; font-weight:normal;">(${leader.base.name})</span></div>
                            <div style="font-size: 10px; color: #ddd; line-height: 1.3; text-shadow: 1px 1px 0 #000;">${ls.desc}</div>
                        </div>
                    </div>
                `;
            }
            
            // リーダーマスの枠を光らせる
            const cell = bg.querySelector(`.grid-cell[data-idx="${leader._anchor}"]`);
            if (cell) {
                cell.innerHTML = '<span style="font-size:14px; filter:drop-shadow(0 0 2px #e5c07b);">👑</span>';
                cell.style.borderColor = 'rgba(229, 192, 123, 0.9)';
                cell.style.boxShadow = 'inset 0 0 15px rgba(229, 192, 123, 0.4)';
                cell.style.background = 'rgba(80, 60, 15, 0.6)';
            }
        }

        this.enemyUnits.forEach(unit => {
            const anchor = unit._anchor;
            
            // マスの色付け (属性カラー)
            const occupiedCells = unit.getOccupiedCells ? unit.getOccupiedCells(anchor) : [anchor];
            occupiedCells.forEach(idx => {
                const cellEl = bg.querySelector(`.grid-cell[data-idx="${idx}"]`);
                if (cellEl) cellEl.classList.add('type-color-' + unit.base.type);
            });

            // キャラ画像 (盤面用)
            const card = document.createElement('div');
            card.className = `board-unit size-${unit.base.shape.code}`;
            card.style.pointerEvents = 'auto'; // クリック可能に
            card.style.cursor = 'pointer';

            if (typeof IMG_DATA !== 'undefined' && IMG_DATA[unit.base.id]) {
                card.style.backgroundImage = `url(${IMG_DATA[unit.base.id]})`;
            } else {
                card.innerHTML = `<div style="color:#fff;font-size:10px;text-align:center;">${unit.base.name}</div>`;
            }

            // 位置計算 (編成画面と同じ計算式)
            const row = Math.floor(anchor / 4);
            const col = anchor % 4;
            const cellW = 25; 
            const cellH = 50; 
            card.style.left = `calc(${col * cellW}% + 2px)`;
            card.style.top = `calc(${row * cellH}% + 2px)`;

            // 星の表示
            const starEl = document.createElement('div');
            starEl.className = 'board-unit-stars';
            starEl.innerHTML = this._renderRarityStars(unit.base.cost, unit.lbCount || 0, 5);
            card.appendChild(starEl);

            // ★クリック＆長押しで詳細パネルを表示
            const showDetail = () => {
                if (app.sound) app.sound.tap();
                if (app.formationScreen && app.formationScreen.showLongPressUnitDetail) {
                    app.formationScreen.showLongPressUnitDetail(unit);
                }
            };

            let pressTimer = null;
            let longPressed = false;
            
            const startPress = (e) => {
                if (e.type === 'mousedown' && e.button !== 0) return;
                longPressed = false;
                if (pressTimer) clearTimeout(pressTimer);
                pressTimer = setTimeout(() => {
                    longPressed = true;
                    showDetail();
                }, 450);
            };
            const cancelPress = () => {
                if (pressTimer) {
                    clearTimeout(pressTimer);
                    pressTimer = null;
                }
            };

            card.addEventListener('touchstart', startPress, { passive: true });
            card.addEventListener('touchend', cancelPress);
            card.addEventListener('touchcancel', cancelPress);
            card.addEventListener('touchmove', cancelPress, { passive: true });
            card.addEventListener('mousedown', startPress);
            card.addEventListener('mouseup', cancelPress);
            card.addEventListener('mouseleave', cancelPress);
            card.addEventListener('contextmenu', (e) => e.preventDefault());

            card.onclick = () => {
                if (!longPressed) showDetail();
            };

            layer.appendChild(card);
        });
    }

    // 編成画面と同じ星アイコン生成ロジック
   _getStarIconPath(kind = 'normal') {
        return kind === 'awaken' ? 'images/icons/star_awaken.webp' : 'images/icons/star_normal.webp';
    }

   _renderRarityStars(cost = 0, awakenCount = 0, total = 5) {
        let html = '';
        for (let i = 0; i < total; i++) {
            let kind = 'normal';
            let cls = 'empty';
            if (i < awakenCount) { kind = 'awaken'; cls = 'filled'; } 
            else if (i < cost)   { kind = 'normal'; cls = 'filled'; }
            html += `<span class="star-icon ${kind} ${cls}"><img src="${this._getStarIconPath(kind)}" alt="*"></span>`;
        }
        return html;
    }

    _getCardBgUrl(typeId, cost) {
      // 編成画面と同じ属性→背景色マッピング
        // 火:赤 / 水:青 / 草:緑 / 闇:紫 / 光:金 / 無:白
        if (typeId === 5) return 'images/bg/bg_white_ur.webp';
        const colors = ['red', 'blue', 'green', 'purple', 'gold', 'white'];
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

        const saved = app.data.towerEnemyData;
        app.changeScene('screen-battle', {
            mode: 'tower',
            floor: this.floor,
            pregenEnemies: (saved && saved.enemies) ? saved.enemies : null
        });
    }
}
