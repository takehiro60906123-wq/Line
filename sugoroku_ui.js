/**
 * sugoroku_ui.js - 栄冠ナイン式UI v4
 * 宝箱演出 + カードショップUI + マスタップ移動 + 敵出現演出 + リザルト強化
 */
class SugorokuUI {
    constructor(controller) {
        this.ctrl = controller;
        this.layers = [];
        this.pixelsPerSquare = 160;
    }

    // ========================================
    // セットアップ
    // ========================================
    setup(sel) {
        const c = document.querySelector(sel);
        if (!c) return;
        c.innerHTML = `
            <div class="sg-top-bar" id="sg-top-bar">
                <button class="sg-home-btn" id="sg-home-btn">🏠</button>
                <div class="sg-goal-counter" id="sg-goal-counter">ゴールまで --</div>
                <div class="sg-deck-info">🃁 <span id="sg-deck-count">0</span></div>
            </div>
            <div class="sg-square-lane" id="sg-square-lane">
                <div class="sg-lane-inner" id="sg-lane-inner"></div>
            </div>
            <div id="game-area" class="sg-game-area">
                <div id="char-container" class="char-container anim-idle">
                    <div id="char-visual" class="char-visual"></div>
                </div>
                <div id="sg-msg-log" class="sg-msg-log"></div>
            </div>
            <div class="sg-hand-area" id="sg-hand-area">
                <div class="sg-hand-cards" id="sg-hand-cards"></div>
            </div>
            <div id="sg-overlay" class="sg-overlay" style="display:none;"></div>
        `;

        
        

        const homeBtn = document.getElementById('sg-home-btn');
        if (homeBtn) {
            homeBtn.addEventListener('click', () => {
                if (this.ctrl && typeof this.ctrl.confirmGoHome === 'function') {
                    this.ctrl.confirmGoHome();
                }
            });
        }
    }

    // ========================================
    // 背景
    // ========================================
    initStageView(layerConfig, basePath) {
        const area = document.getElementById('game-area');
        const cc = document.getElementById('char-container');
        if (!area) return;
        area.querySelectorAll('.bg-layer').forEach(e => e.remove());
        // ★敵出現用のコンテナも削除
        area.querySelectorAll('.enemy-entrance-container').forEach(e => e.remove());
        this.layers = [];
        layerConfig.forEach((conf, i) => {
            const d = document.createElement('div');
            d.className = 'bg-layer';
            d.style.backgroundImage = `url('${basePath}${conf.file}')`;
            d.style.zIndex = i;
            if (conf.isFront) d.style.zIndex = 60 + i;
            if (!conf.isFront) area.insertBefore(d, cc); else area.appendChild(d);
            this.layers.push({ el: d, speed: conf.speed });
        });
        const cv = document.getElementById('char-visual');
        if (cv) cv.style.backgroundImage = "url('images/chara_run.webp')";
    }

    syncParallax(pos) {
        const px = pos * this.pixelsPerSquare;
        this.layers.forEach(l => { l.el.style.backgroundPositionX = `${-(px * l.speed)}px`; });
    }

    // ========================================
    // ゴールカウンター
    // ========================================
    updateGoalCounter(current, total) {
        const el = document.getElementById('sg-goal-counter');
        if (!el) return;
        const rest = Math.max(0, total - 1 - current);
        el.innerHTML = `
            <span class="sg-goal-label">GOALまで</span>
            <span class="sg-goal-val" data-val="${rest}">${rest}</span>
        `;
        if (rest <= 5) el.classList.add('sg-goal-near');
        else el.classList.remove('sg-goal-near');
    }

    // ========================================
    // ★ マスレーン（タップ移動対応）
    // ========================================
  // ========================================
    // ★ マスレーン（タップ移動対応）
    // ========================================
    renderSquareLane(squares, currentIdx) {
        const inner = document.getElementById('sg-lane-inner');
        if (!inner) return;

        let html = '';
        squares.forEach((sq, i) => {
            const isCur = (i === currentIdx);
            const isPast = (i < currentIdx);
            
            let nodeClasses = 'sq-node';
            if (isCur) nodeClasses += ' sq-current';
            if (isPast) nodeClasses += ' sq-past';

            const baseImg = `images/sg_base_${sq.color}.webp`;
            const iconImg = `images/sg_icon_${sq.type}.webp`;

            // ★修正: data-sq-idx を追加（タップ移動用）
            html += `<div class="${nodeClasses}" id="sq-node-${i}" data-sq-idx="${i}">`;

            html += `<div class="sq-circle" style="background-image: url('${baseImg}');">`;
            
            // ▼▼▼ 修正箇所: typeが 'nothing' の場合はアイコン画像を表示しない ▼▼▼
            if (sq.type !== 'nothing') {
                html += `  <img src="${iconImg}" class="sq-icon-img" alt="${sq.type}" onerror="this.style.display='none'">`;
            }
            // ▲▲▲ 修正ここまで ▲▲▲

            html += `</div>`;

            if (isCur) {
                html += `<div class="sq-marker">▲</div>`;
            }

            const dist = i - currentIdx;
            if (dist > 0 && dist <= 6) {
                html += `<div class="sq-dist-val">${dist}</div>`;
            }

            html += `</div>`;

            if (i < squares.length - 1) {
                html += `<div class="sq-connector ${isPast ? 'sq-past' : ''}"></div>`;
            }
        });

        inner.innerHTML = html;

        // ★追加: マスタップイベント登録
        inner.querySelectorAll('.sq-node[data-sq-idx]').forEach(node => {
            node.addEventListener('click', (e) => {
                const idx = parseInt(node.dataset.sqIdx, 10);
                if (!isNaN(idx) && this.ctrl) {
                    this.ctrl.onSquareTap(idx);
                }
            });
        });

        if (this.syncParallax) this.syncParallax(currentIdx);
        else if (this.scrollLaneToSquare) this.scrollLaneToSquare(currentIdx);
    }

    scrollLaneToSquare(idx) {
        const lane = document.getElementById('sg-square-lane');
        const target = document.getElementById(`sq-node-${idx}`);
        if (lane && target) {
            const targetLeft = target.offsetLeft;
            const offset = 10;
            lane.scrollTo({ left: targetLeft - offset, behavior: 'smooth' });
        }
    }
    updateLaneScroll(pos) { this.scrollLaneToSquare(Math.round(pos)); }

    highlightTarget(targetIdx) {
        document.querySelectorAll('.sq-node.sq-target').forEach(el => el.classList.remove('sq-target'));
        const node = document.getElementById(`sq-node-${targetIdx}`);
        if (node) node.classList.add('sq-target');
    }

    // ========================================
    // ★ ハイライト（安定動作版）
    // ========================================
   highlightReachableSquares(currentIdx, hand) {
    // 1. 全てリセット
    document.querySelectorAll('.sq-node').forEach(el => {
        el.classList.remove('sq-reachable', 'sq-dim');
    });

    if (!hand || hand.length === 0) return;

    let current = parseInt(currentIdx, 10);
    if (isNaN(current)) return;

    // 行ける距離のリスト（数値化）
    const steps = hand
        .map(c => {
            if (typeof c === 'object' && c) return Number(c.val ?? c.value ?? 0);
            return Number(c);
        })
        .filter(n => Number.isFinite(n) && n > 0);

    const maxStep = steps.length ? Math.max(...steps) : 0;

    // 未来のマス（current+1～+6）を判定
    for (let i = 1; i <= 6; i++) {
        const targetIdx = current + i;
        const targetNode = document.getElementById(`sq-node-${targetIdx}`);
        if (!targetNode) continue;

        // ★BOSSマスだけ特例：残り距離以上のカードがあればreachable
        const sq = (this.ctrl && this.ctrl.squares) ? this.ctrl.squares[targetIdx] : null;
        const isBoss = sq && sq.type === 'boss';

        const reachable = steps.includes(i) || (isBoss && maxStep >= i);

        if (reachable) targetNode.classList.add('sq-reachable');
        else targetNode.classList.add('sq-dim');
    }
}


    // ========================================
    // 手札
    // ========================================
    renderHand(hand, deckCount, newIdx = -1) {
        const dc = document.getElementById('sg-deck-count');
        if (dc) dc.textContent = deckCount;
        const box = document.getElementById('sg-hand-cards');
        if (!box) return;
        let h = '';
        hand.forEach((v, i) => {
            const cc = v >= 5 ? 'sg-card-high' : v >= 3 ? 'sg-card-mid' : 'sg-card-low';
            h += `<div class="sg-card ${cc} ${i===newIdx?'sg-card-new':''}" data-idx="${i}">
                    <div class="sg-card-num">${v}</div><div class="sg-card-sub">${v}マス</div></div>`;
        });
        for (let i = hand.length; i < 4; i++) h += `<div class="sg-card sg-card-empty"><div class="sg-card-num">-</div></div>`;
        box.innerHTML = h;
        
        box.querySelectorAll('.sg-card[data-idx]').forEach(card => {
            card.addEventListener('click', () => {
                const idx = parseInt(card.dataset.idx, 10);
                if (!Number.isNaN(idx) && this.ctrl && typeof this.ctrl.onCardSelect === 'function') {
                    this.ctrl.onCardSelect(idx);
                }
            });
        });
    }

    highlightCard(idx) {
        document.querySelectorAll('.sg-card').forEach(el => el.classList.remove('sg-card-selected'));
        const cards = document.querySelectorAll('.sg-card[data-idx]');
        if (cards[idx]) cards[idx].classList.add('sg-card-selected');
    }
    playCardUse(idx) {
        const cards = document.querySelectorAll('.sg-card[data-idx]');
        if (cards[idx]) cards[idx].classList.add('sg-card-used');
    }

    // ========================================
    // キャラ
    // ========================================
    setCharRunning(on) {
        const c = document.getElementById('char-container');
        if (!c) return;
        c.classList.toggle('anim-run', on);
        c.classList.toggle('anim-idle', !on);
    }

    // ========================================
    // メッセージ
    // ========================================
    showMessage(text) {
        const el = document.getElementById('sg-msg-log');
        if (!el) return;
        el.textContent = text;
        el.style.opacity = text ? 1 : 0;
        if (text) { clearTimeout(this._mt); this._mt = setTimeout(() => { el.style.opacity = 0; }, 2500); }
    }

    // ========================================
    // ★ 敵出現演出（左から飛び出し）
    // ========================================
    showEnemyEntrance(enemyId, isBoss) {
        return new Promise(resolve => {
            const area = document.getElementById('game-area');
            if (!area) { resolve(); return; }

            // 既存の演出を削除
            area.querySelectorAll('.enemy-entrance-container').forEach(e => e.remove());

            // 敵画像を取得
            const imgSrc = (typeof IMG_DATA !== 'undefined' && IMG_DATA[enemyId]) ? IMG_DATA[enemyId] : '';

            // コンテナ作成
            const container = document.createElement('div');
            container.className = 'enemy-entrance-container';
            container.innerHTML = `
                <div class="enemy-entrance-shadow"></div>
                <div class="enemy-entrance-sprite ${isBoss ? 'enemy-entrance-boss' : ''}">
                    ${imgSrc ? `<img src="${imgSrc}" class="enemy-entrance-img" alt="enemy">` : `<div class="enemy-entrance-fallback">${isBoss ? '💀' : '⚔️'}</div>`}
                </div>
                <div class="enemy-entrance-label">${isBoss ? '⚠ BOSS 出現！' : '⚔️ 敵 出現！'}</div>
                <div class="enemy-entrance-flash"></div>
            `;
            container.style.zIndex = '55';
            area.appendChild(container);

            // アニメーション開始
            requestAnimationFrame(() => {
                container.classList.add('enemy-entrance-active');
            });

          // ★ボスは「出現！」のあとに「BOSS戦！」へ切り替え
    if (isBoss) {
      setTimeout(() => {
        const lbl = container.querySelector('.enemy-entrance-label');
        if (lbl) {
          lbl.textContent = '🔥 BOSS戦！';
          lbl.classList.add('boss-battle');
        }
      }, 900);
    }

     setTimeout(() => {
       container.classList.add('enemy-entrance-exit');
       setTimeout(() => {
         container.remove();
         resolve();
       }, 400);
     }, 1800);
   });
 }
   // ========================================
    // ★ 宝箱/アイコン演出（ガチャ対応版）
    // ========================================
    showTreasureBox(type) {
        return new Promise(resolve => {
            const area = document.getElementById('game-area');
            if (!area) { resolve(); return; }

            // 1. 画像のパスとサイズ設定
            let chestImgPath;
            let imgWidth = '130px'; // 基本サイズ

            switch(type) {
                case 'gold':    chestImgPath = 'images/sg_chest_gold.webp'; break;
                case 'diamond': chestImgPath = 'images/sg_chest_diamond.webp'; break;
                // ▼▼▼ 追加: ガチャ用アイコン設定 ▼▼▼
                case 'gacha':
                    chestImgPath = 'images/sg_icon_gacha.webp';
                    imgWidth = '110px'; // アイコンなので少し小さめに調整
                    break;
                // ▲▲▲ 追加ここまで ▲▲▲
                case 'candy':
                default:        chestImgPath = 'images/sg_chest_wood.webp'; break;
            }

            // 2. コンテナ作成
            const container = document.createElement('div');
            // ... (中略: スタイル定義はそのまま) ...
            container.style.position = 'absolute';
            container.style.top = '0';
            container.style.left = '0';
            container.style.width = '100%';
            container.style.height = '100%';
            container.style.pointerEvents = 'none';
            container.style.zIndex = '45';

            // 3. 画像作成
            const img = document.createElement('img');
            img.src = `${chestImgPath}?t=${Date.now()}`; 
            
            // 初期位置：画面右外（110%）
            Object.assign(img.style, {
                position: 'absolute',
                bottom: '18%',
                left: '110%',
                width: imgWidth, // ★widthを変数で指定
                height: 'auto',
                objectFit: 'contain',
                transform: 'translateX(-50%)',
                transition: 'left 0.6s ease-out',
                filter: 'drop-shadow(0 5px 15px rgba(0,0,0,0.5))'
            });

            container.appendChild(img);
            area.appendChild(container);

            // ... (以下略: アニメーション処理はそのまま) ...
            // リフロー強制
            void img.offsetWidth;

            // 4. 演出開始
            this.setCharRunning(true);
            img.style.left = '70%'; // 停止位置

            // 5. 到着時の処理
            setTimeout(() => {
                this.setCharRunning(false);
                // 弾む演出
                img.style.transition = 'transform 0.2s ease-out';
                img.style.transform = 'translateX(-50%) scale(1.1) translateY(-10px)';
                
                setTimeout(() => {
                    img.style.transform = 'translateX(-50%) scale(1.0) translateY(0)';
                    // フェードアウト
                    setTimeout(() => {
                        img.style.transition = 'opacity 0.2s';
                        img.style.opacity = '0';
                        setTimeout(() => {
                            container.remove();
                            resolve();
                        }, 200);
                    }, 600);
                }, 200);
            }, 600);
        });
    }
    // ========================================
    // 報酬オーバーレイ（演出付き）
    // ========================================
    showRewardOverlay(icon, text, category, imgUrl) {
        return new Promise(resolve => {
            const ov = document.getElementById('sg-overlay');
            if (!ov) { resolve(); return; }

            const bg = { gold:'reward-bg-blue', diamond:'reward-bg-gold', gacha:'reward-bg-gold',
                         lose:'reward-bg-red', heal:'reward-bg-green', candy:'reward-bg-blue',
                         deck:'reward-bg-blue' }[category] || 'reward-bg-blue';

            let particles = '';
            const pCount = (category === 'diamond' || category === 'gacha') ? 20 : 12;
            const emojis = { gold:'💰', diamond:'💎✨', candy:'🍬', gacha:'⭐✨', heal:'💚✨', deck:'🃁', lose:'💸' }[category] || '✨';
            const emojiArr = [...emojis];
            for (let i = 0; i < pCount; i++) {
                const x = Math.random() * 100, delay = Math.random() * 0.6;
                const e = emojiArr[Math.floor(Math.random() * emojiArr.length)];
                particles += `<div class="reward-particle" style="left:${x}%;animation-delay:${delay}s">${e}</div>`;
            }

            let charHtml = imgUrl ? `<div class="reward-char" style="background-image:url('${imgUrl}')"></div>` : '';
            if(app.sound) app.sound.play('se_chest_open');
            ov.innerHTML = `
                <div class="reward-popup ${bg}">
                    <div class="reward-particles">${particles}</div>
                    <div class="reward-icon-big">${icon}</div>
                    ${charHtml}
                    <div class="reward-text">${text}</div>
                    <div class="reward-tap">TAP</div>
                </div>`;
            ov.style.display = 'flex';
            requestAnimationFrame(() => ov.classList.add('show'));

 let closed = false;
            const close = () => {
                if (closed) return;
                closed = true;
                ov.classList.remove('show');
                setTimeout(() => {
                    ov.style.display = 'none';
                    resolve();
                }, 200);
            };

            // ★テンポ改善:
            // 以前は報酬表示後800ms待たないとタップで閉じられず、
            // 「GET後にカード表示まで待つ」体感遅延が発生していた。
            // 150msでタップ可能にしつつ、誤タップは最小限に抑える。
            setTimeout(() => {
                ov.addEventListener('click', close, { once: true });
                }, 150);

            // 自動クローズも短縮（3.5s -> 2.4s）
            setTimeout(close, 2400);
        });
    }

   // ========================================
    // ★ カードショップUI（勝手に閉じるバグ修正版）
    // ========================================
    showCardShop(items, gold, gems, onBuy) {
        return new Promise(resolve => {
            let ov = document.getElementById('sg-overlay');
            if (!ov) { resolve(); return; }

            // ▼▼▼ 修正箇所: 過去のクリックイベント(宝箱等)を強制削除 ▼▼▼
            // 要素をクローンして置き換えることで、残留しているイベントリスナーを全て消します
            const newOv = ov.cloneNode(false); // false=ガワだけコピー
            if (ov.parentNode) {
                ov.parentNode.replaceChild(newOv, ov);
            }
            ov = newOv; // 変数を新しい要素に更新
            // ▲▲▲ 修正ここまで ▲▲▲

            const purchasedSet = new Set();

            const renderShop = () => {
                const currentGold = app.data ? app.data.gold : gold;
                const currentGems = app.data ? app.data.gems : gems;

                let itemsHtml = '';
                items.forEach((item, idx) => {
                    const sold = purchasedSet.has(item.id);
                    const currIcon = item.currency === 'gem' ? '💎' : '💰';
                    const canBuy = !sold && (
                        item.currency === 'gold' ? currentGold >= item.price : currentGems >= item.price
                    );
                    
                    // アイコン表示ロジック
                    let iconHtml = '';
                    if (item.img) {
                        iconHtml = `<img src="${item.img}" style="width:100%;height:100%;object-fit:cover;border-radius:6px;">`;
                    } else if (item.type === 'card') {
                        const valClass = item.value >= 5 ? 'shop-val-high' : item.value >= 4 ? 'shop-val-mid' : '';
                        iconHtml = `<span class="shop-card-num ${valClass}" style="font-size:20px;">${item.value}</span>`;
                    } else {
                        iconHtml = `<span class="shop-item-emoji">${item.icon}</span>`;
                    }

                    itemsHtml += `
                        <div class="shop-item ${sold ? 'shop-sold' : ''} ${!canBuy && !sold ? 'shop-cant' : ''}" data-shop-idx="${idx}">
                            <div class="shop-item-icon">
                                ${iconHtml}
                            </div>
                            <div class="shop-item-info">
                                <div class="shop-item-name">${item.label}</div>
                                <div class="shop-item-desc">${item.desc}</div>
                            </div>
                            <div class="shop-item-price ${sold ? '' : (canBuy ? 'shop-price-ok' : 'shop-price-ng')}">
                                ${sold ? '<span class="shop-sold-label">SOLD</span>' : `${currIcon} ${item.price.toLocaleString()}`}
                            </div>
                        </div>`;
                });

                ov.innerHTML = `
                    <div class="shop-panel">
                        <div class="shop-header">
                            <div class="shop-title">🛒 ショップ</div>
                            <div class="shop-wallet">
                                <span class="shop-wallet-item">💰 ${currentGold.toLocaleString()}</span>
                                <span class="shop-wallet-item">💎 ${currentGems}</span>
                            </div>
                        </div>
                        <div class="shop-items">${itemsHtml}</div>
                        <button class="shop-close-btn" id="shop-close-btn">立ち去る</button>
                    </div>`;

                ov.querySelectorAll('.shop-item:not(.shop-sold)').forEach(el => {
                    el.addEventListener('click', () => {
                        const idx = parseInt(el.dataset.shopIdx);
                        const item = items[idx];
                        if (!item || purchasedSet.has(item.id)) return;
                        const ok = onBuy(item);
                        if (ok) {
                            purchasedSet.add(item.id);
                            el.classList.add('shop-bought-flash');
                            setTimeout(() => renderShop(), 400);
                        } else {
                            el.classList.add('shop-shake');
                            setTimeout(() => el.classList.remove('shop-shake'), 500);
                        }
                    });
                });

                document.getElementById('shop-close-btn').addEventListener('click', () => {
                    if (app.sound) app.sound.play('sys_decide');
                    ov.classList.remove('show');
                    setTimeout(() => { ov.style.display = 'none'; resolve(); }, 200);
                });
            };

            ov.style.display = 'flex';
            requestAnimationFrame(() => ov.classList.add('show'));
            renderShop();
        });
    }

   // ========================================
    // ★ リザルト画面（完全修正版）
    // ========================================
    showResultScreen(isWin, subtitle, log, onClose) {
        // オーバーレイの取得とリセット
        const ov = document.getElementById('sg-overlay');
        if (!ov) return;

        // イベントリスナー重複防止のためのクローン置換
        const newOv = ov.cloneNode(false);
        if (ov.parentNode) ov.parentNode.replaceChild(newOv, ov);
        
        const title = isWin ? '🏆 STAGE CLEAR!' : '💀 GAME OVER';
        const cls = isWin ? 'win' : 'lose';

        // --- 獲得アイテムリスト生成 ---
        let itemsHtml = '';
        let delay = 0.3;

        // 1. ゴールド
        if (log.goldGained > 0) {
            itemsHtml += `
                <div class="rs-item rs-item-anim" style="animation-delay:${delay}s">
                    <span class="rs-icon">💰</span>
                    <span class="rs-val">${log.goldGained.toLocaleString()} G</span>
                </div>`;
            delay += 0.1;
        }

        // 2. ダイヤ
        if (log.gemsGained > 0) {
            itemsHtml += `
                <div class="rs-item rs-item-anim" style="animation-delay:${delay}s">
                    <span class="rs-icon">💎</span>
                    <span class="rs-val">${log.gemsGained}</span>
                </div>`;
            delay += 0.1;
        }

        // 3. アメ（配列）
        if (log.candyGained && log.candyGained.length > 0) {
            log.candyGained.forEach(c => {
                const imgUrl = (typeof IMG_DATA !== 'undefined' && IMG_DATA[c.id]) ? IMG_DATA[c.id] : null;
                const iconHtml = imgUrl 
                    ? `<img src="${imgUrl}" class="rs-img-icon">` 
                    : `<span class="rs-icon">🍬</span>`;
                
                itemsHtml += `
                    <div class="rs-item rs-item-anim" style="animation-delay:${delay}s">
                        ${iconHtml}
                        <div class="rs-text-col">
                            <span class="rs-name">${c.name}のアメ</span>
                            <span class="rs-count">x${c.count}</span>
                        </div>
                    </div>`;
                delay += 0.1;
            });
        }

        // 4. ユニット（配列）
        if (log.unitsGained && log.unitsGained.length > 0) {
            log.unitsGained.forEach(u => {
                const imgUrl = (typeof IMG_DATA !== 'undefined' && IMG_DATA[u.id]) ? IMG_DATA[u.id] : null;
                const iconHtml = imgUrl 
                    ? `<img src="${imgUrl}" class="rs-img-icon">` 
                    : `<span class="rs-icon">👤</span>`;

                itemsHtml += `
                    <div class="rs-item rs-item-anim" style="animation-delay:${delay}s">
                        ${iconHtml}
                        <div class="rs-text-col">
                            <span class="rs-name" style="color:#00ffff;">${u.name}</span>
                            <span class="rs-count">JOIN!</span>
                        </div>
                    </div>`;
                delay += 0.1;
            });
        }

        // 何も獲得していない場合
        if (itemsHtml === '') {
            itemsHtml = `<div style="color:#aaa; font-size:12px; margin:10px;">獲得アイテムなし</div>`;
        }

        // --- 次回情報（クリア時のみ） ---
        let nextInfoHtml = '';
        if (isWin && log.nextEnemyLv) {
            nextInfoHtml = `
                <div class="rs-next-info rs-item-anim" style="animation-delay:${delay + 0.2}s">
                    <div class="rs-next-title">NEXT CHALLENGE</div>
                    <div class="rs-next-row">敵Lv: <span class="val">${log.nextEnemyLv}</span></div>
                    <div class="rs-next-row">報酬: <span class="val">UP!</span></div>
                    <div class="rs-next-desc">周回するほど敵が強くなり報酬が増加します</div>
                </div>`;
        }

        // HTML構築
        newOv.innerHTML = `
            <div class="rs-container ${cls}">
                <div class="rs-header">
                    <div class="rs-title">${title}</div>
                    <div class="rs-subtitle">${subtitle}</div>
                </div>
                <div class="rs-body">
                    <div class="rs-label">RESULT</div>
                    <div class="rs-list">${itemsHtml}</div>
                    ${nextInfoHtml}
                </div>
                <button class="rs-ok-btn" id="rs-ok-btn">OK</button>
            </div>
        `;

        // 表示
        newOv.style.display = 'flex';
        requestAnimationFrame(() => newOv.classList.add('show'));

        // OKボタンイベント
        document.getElementById('rs-ok-btn').addEventListener('click', () => {
            if (app.sound) app.sound.play('sys_decide');
            newOv.classList.remove('show');
            setTimeout(() => {
                newOv.style.display = 'none';
                if (onClose) onClose(); // ここでシーン遷移などを実行
            }, 300);
        });
    }

    

    // ★ 中断確認ダイアログ
    showQuitConfirm(onQuit) {
        const ov = document.getElementById('sg-overlay');
        if (!ov) return;
        ov.innerHTML = `
            <div class="sg-quit-dialog">
                <div class="sg-quit-title">⚠ 冒険を中断しますか？</div>
                <div class="sg-quit-desc">進行状況は失われます</div>
                <div class="sg-quit-btns">
                    <button class="sg-quit-btn sg-quit-yes" id="sg-quit-yes">中断する</button>
                    <button class="sg-quit-btn sg-quit-no" id="sg-quit-no">続ける</button>
                </div>
            </div>`;
        ov.style.display = 'flex';
        requestAnimationFrame(() => ov.classList.add('show'));
        document.getElementById('sg-quit-yes').addEventListener('click', () => {
            if (app.sound) app.sound.play('sys_decide');
            ov.classList.remove('show');
            setTimeout(() => { ov.style.display = 'none'; if (onQuit) onQuit(); }, 200);
        });
        document.getElementById('sg-quit-no').addEventListener('click', () => {
            if (app.sound) app.sound.play('sys_decide');
            ov.classList.remove('show');
            setTimeout(() => { ov.style.display = 'none'; }, 200);
        });
    }

    // ========================================
    // ★ 新規イベント用UI
    // ========================================

    // --- ギャンブル：参加確認ダイアログ ---
    showGambleEntryDialog() {
        return new Promise(resolve => {
            const ov = this._getOverlay();
            ov.innerHTML = `
                <div class="sg-dialog-box">
                    <div class="sg-dialog-title">🎰 賭場</div>
                    <div class="sg-dialog-desc">
                        ハイ＆ローで資金を増やそう！<br>
                        勝てば賞金は倍々だ！<br>
                        <span style="font-size:11px;color:#aaa;">※最大5連勝まで</span>
                    </div>
                    <div class="sg-gamble-btns">
                        <button id="btn-gamble-gem" class="sg-btn-choice">
                            <div>💎 ダイヤで挑戦</div>
                            <div style="font-size:11px">掛け金: 100</div>
                        </button>
                        <button id="btn-gamble-gold" class="sg-btn-choice">
                            <div>💰 Gで挑戦</div>
                            <div style="font-size:11px">掛け金: 1,000</div>
                        </button>
                        <button id="btn-gamble-cancel" class="sg-btn-cancel">やめる</button>
                    </div>
                </div>
            `;
            ov.style.display = 'flex';
            requestAnimationFrame(() => ov.classList.add('show'));

            document.getElementById('btn-gamble-gem').onclick = () => this._closeOverlay(ov, () => resolve('gem'));
            document.getElementById('btn-gamble-gold').onclick = () => this._closeOverlay(ov, () => resolve('gold'));
            document.getElementById('btn-gamble-cancel').onclick = () => this._closeOverlay(ov, () => resolve(null));
        });
    }

    // --- ギャンブル：ゲーム画面 ---
    showHighLowGame(currentNum, currentReward, winCount, isGem) {
        return new Promise(resolve => {
            const ov = this._getOverlay();
            const unit = isGem ? 'ダイヤ' : 'G';
            
            // トランプの絵柄（簡易表示）
            const renderCard = (num, isHidden=false) => {
                if(isHidden) return `<div class="sg-card back">?</div>`;
                let color = (num === 1 || num === 11 || num === 12 || num === 13) ? '#f00' : '#000';
                let mark = '♠'; // 簡易
                let disp = num;
                if(num===1) disp='A';
                if(num===11) disp='J';
                if(num===12) disp='Q';
                if(num===13) disp='K';
                return `<div class="sg-card front" style="color:${color}">${mark}<br>${disp}</div>`;
            };

            ov.innerHTML = `
                <div class="sg-gamble-board">
                    <div class="sg-gamble-header">
                        <div>${winCount}連勝中</div>
                        <div style="color:#ffd700">賞金: ${currentReward.toLocaleString()} ${unit}</div>
                    </div>
                    
                    <div class="sg-cards-area">
                        <div class="sg-card-wrapper">
                            <div class="sg-card-label">YOU</div>
                            ${renderCard(currentNum)}
                        </div>
                        <div class="sg-vs-text">VS</div>
                        <div class="sg-card-wrapper">
                            <div class="sg-card-label">NEXT</div>
                            <div id="sg-next-card-area">${renderCard(0, true)}</div>
                        </div>
                    </div>

                    <div class="sg-gamble-msg">次は High(高い)？ Low(低い)？</div>

                    <div class="sg-gamble-actions">
                        <button id="btn-low" class="sg-hl-btn low">LOW ⬇️</button>
                        <button id="btn-high" class="sg-hl-btn high">HIGH ⬆️</button>
                    </div>
                    <button id="btn-drop" class="sg-drop-btn">降りて確保する</button>
                </div>
            `;
            ov.style.display = 'flex';
            requestAnimationFrame(() => ov.classList.add('show'));

            // イベント設定
            // 結果表示はController側で次の showHighLowResult を呼ぶので、ここでは選択を返すだけ
            document.getElementById('btn-low').onclick = () => resolve('low');
            document.getElementById('btn-high').onclick = () => resolve('high');
            document.getElementById('btn-drop').onclick = () => resolve('drop');
        });
    }

    // --- ギャンブル：結果オープン演出 ---
    showHighLowResult(nextNum) {
        return new Promise(resolve => {
            const area = document.getElementById('sg-next-card-area');
            if(!area) { resolve(); return; }

            // カード生成
            let color = (nextNum === 1 || nextNum >= 11) ? '#f00' : '#000';
            let disp = nextNum;
            if(nextNum===1) disp='A'; else if(nextNum===11) disp='J'; else if(nextNum===12) disp='Q'; else if(nextNum===13) disp='K';
            const html = `<div class="sg-card front" style="color:${color}">♠<br>${disp}</div>`;
            
            // 少し溜めてからオープン
            area.innerHTML = html;
            area.querySelector('.sg-card').classList.add('open-anim'); // CSSでアニメ定義が必要

            // 結果を認識させる時間
            setTimeout(() => {
                resolve();
            }, 1500);
        });
    }

    // --- ダメージ演出 ---
    showDamageEffect() {
        return new Promise(resolve => {
            const ov = this._getOverlay();
            // 赤くフラッシュ
            ov.innerHTML = `<div style="width:100%;height:100%;background:rgba(255,0,0,0.5);animation:flashRed 0.5s ease-out;"></div>`;
            ov.style.display = 'flex';
            ov.classList.add('show');
            setTimeout(() => {
                this._closeOverlay(ov, resolve);
            }, 600);
        });
    }

    // --- カード没収演出 ---
    showCardLostEffect(val) {
        return new Promise(resolve => {
            const ov = this._getOverlay();
            ov.innerHTML = `
                <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;">
                    <div style="font-size:40px;animation:flyAway 1s forwards;">🃏 ${val}</div>
                </div>`;
            ov.style.display = 'flex';
            ov.classList.add('show');
            setTimeout(() => {
                this._closeOverlay(ov, resolve);
            }, 1000);
        });
    }

    // 内部ヘルパー: オーバーレイ取得とクリーンアップ
    _getOverlay() {
        let ov = document.getElementById('sg-overlay');
        // イベントリスナーのリセットのためクローン
        const newOv = ov.cloneNode(false);
        if (ov.parentNode) ov.parentNode.replaceChild(newOv, ov);
        return newOv;
    }
    _closeOverlay(ov, callback) {
        if(app.sound) app.sound.play('sys_decide');
        ov.classList.remove('show');
        setTimeout(() => {
            ov.style.display = 'none';
            ov.innerHTML = '';
            if(callback) callback();
        }, 200);
    }

    // ========================================
    // ★追加: ギャンブル画面を閉じる処理
    // ========================================
    closeGambleUI() {
        return new Promise(resolve => {
            const ov = document.getElementById('sg-overlay');
            if (!ov) { resolve(); return; }
            
            ov.classList.remove('show');
            setTimeout(() => {
                ov.style.display = 'none';
                ov.innerHTML = ''; // 中身をクリア
                resolve();
            }, 200);
        });
    }

}