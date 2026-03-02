/**
 * sugoroku_ui.js - クエストモードUI
 * 手札/マスレーン/サイコロを全削除。
 * パララックス背景 + 進行度バー + 既存演出(宝箱/報酬/敵出現/ギャンブル/リザルト)
 */
class SugorokuUI {
    constructor(controller) {
        this.ctrl = controller;
        this.layers = [];
        this._scrollPos = 0;
        this._baseParallaxPx = 0;
        this._cloudDriftPx = 0;
        this._cloudDriftRaf = null;
        this._cloudDriftLastTs = 0;
        this._pixelsPerStep = 160;
    }

    // ========================================
    // セットアップ（HTMLはindex.htmlで定義済み）
    // ========================================
    setup(sel) {
        const homeBtn = document.getElementById('sg-home-btn');
        if (homeBtn) {
            const newBtn = homeBtn.cloneNode(true);
            homeBtn.parentNode.replaceChild(newBtn, homeBtn);
            newBtn.addEventListener('click', () => {
                if (this.ctrl && typeof this.ctrl.confirmGoHome === 'function') {
                    this.ctrl.confirmGoHome();
                }
            });
        }
    }

    // ========================================
    // 戦闘復帰時のビュー復元
    // ========================================
    restoreView(state) {
        // パネルバトルのUI残骸を片付け
        const container = document.getElementById('pb-container');
        if (container) container.style.display = 'none';
        const hud = document.getElementById('pb-battle-hud');
        if (hud) hud.remove();
        // game-areaのバトルモード解除
        const gameArea = document.getElementById('game-area');
        if (gameArea) gameArea.classList.remove('pb-battle-mode');
        // クエストの通常レイアウトでは下部パネル構成を優先
        const progressBar = document.getElementById('sg-progress-bar');
        if (progressBar) progressBar.style.display = 'none';
        const msgBar = document.getElementById('sg-msg-bar');
       if (msgBar) msgBar.style.display = 'none';

        if (this.ctrl && this.ctrl.encounters) {
            this.updateProgress(this.ctrl.encounterIdx, this.ctrl.encounters.length);
        }
    }

    // ========================================
    // 背景（既存流用）
    // ========================================
    initStageView(layerConfig, basePath) {
        const area = document.getElementById('game-area');
        const cc = document.getElementById('char-container');
        if (!area) return;
        area.querySelectorAll('.bg-layer').forEach(e => e.remove());
        area.querySelectorAll('.enemy-entrance-container').forEach(e => e.remove());
        this.layers = [];
        this._scrollPos = 0;
        this._baseParallaxPx = 0;
        this._cloudDriftPx = 0;
        this._stopCloudDrift();
        layerConfig.forEach((conf, i) => {
            const d = document.createElement('div');
            d.className = 'bg-layer';
            d.style.backgroundImage = `url('${basePath}${conf.file}')`;
            d.style.zIndex = i;
            if (conf.isFront) d.style.zIndex = 60 + i;
            if (!conf.isFront) area.insertBefore(d, cc); else area.appendChild(d);
            this.layers.push({ el: d, speed: conf.speed });
        });
        
    this._startCloudDrift();
    }

    syncParallax(pos) {
        this._baseParallaxPx = pos * this._pixelsPerStep;
        this._applyParallax();
    }

    _applyParallax() {
        this.layers.forEach((l, i) => {
            const drift = i === 0 ? this._cloudDriftPx : 0;
            l.el.style.backgroundPositionX = `${-((this._baseParallaxPx * l.speed) + drift)}px`;
        });
    }

    _startCloudDrift() {
        this._stopCloudDrift();
        this._cloudDriftLastTs = 0;
        const speedPxPerSec = 7;
        const tick = (ts) => {
            if (!this.layers || this.layers.length === 0) {
                this._cloudDriftRaf = null;
                return;
            }
            if (!this._cloudDriftLastTs) this._cloudDriftLastTs = ts;
            const dt = Math.max(0, ts - this._cloudDriftLastTs);
            this._cloudDriftLastTs = ts;
            this._cloudDriftPx += (dt / 1000) * speedPxPerSec;
            this._applyParallax();
            this._cloudDriftRaf = requestAnimationFrame(tick);
        };
        this._cloudDriftRaf = requestAnimationFrame(tick);
    }

    _stopCloudDrift() {
        if (this._cloudDriftRaf) {
            cancelAnimationFrame(this._cloudDriftRaf);
            this._cloudDriftRaf = null;
        }
        this._cloudDriftLastTs = 0;
    }

    // ========================================
    // 自動スクロール演出（遭遇間の移動）
    // ========================================
    scrollAdvance(encounterIdx, totalEncounters) {
        return new Promise(resolve => {
            const targetPos = this._scrollPos + 1;
            const startPos = this._scrollPos;
            const duration = 500;
            const startTime = performance.now();

            this.setCharRunning(true);

            const animate = (now) => {
                const elapsed = now - startTime;
                const t = Math.min(1, elapsed / duration);
                const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
                const current = startPos + (targetPos - startPos) * eased;
                this.syncParallax(current);

                if (t < 1) {
                    requestAnimationFrame(animate);
                } else {
                    this._scrollPos = targetPos;
                    this.setCharRunning(false);
                    resolve();
                }
            };
            requestAnimationFrame(animate);
        });
    }

    // ========================================
    // 進行度バー
    // ========================================
    updateProgress(current, total) {
        const textEl = document.getElementById('sg-progress-text');
        const fillEl = document.getElementById('sg-progress-fill');
        if (textEl) textEl.textContent = `${current} / ${total}`;
        if (fillEl) {
            const pct = total > 0 ? (current / total) * 100 : 0;
            fillEl.style.width = pct + '%';
            if (pct >= 80) fillEl.classList.add('sg-progress-near');
            else fillEl.classList.remove('sg-progress-near');
        }
    }

    // ========================================
    // キャラ
    // ========================================
    setCharRunning(on) {
        // ▼ 修正: 古いCSSクラスの切り替え処理を削除・変更し、新しい setPlayerMotion を呼び出す
        if (app && app.panelBattleScreen && app.panelBattleScreen.ui) {
            // パネルバトルのUI機能を使って、スプライトシートのアニメーションを切り替える
            app.panelBattleScreen.ui.setPlayerMotion(on ? 'move' : 'idle');
        } else {
            // ※念のためのフォールバック (appが参照できない場合などのため)
            const c = document.getElementById('char-container');
            if (c) {
                c.classList.toggle('anim-run', on);
                c.classList.toggle('anim-idle', !on);
            }
        }
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
    // 敵出現演出（既存流用）
    // ========================================
    showEnemyEntrance(enemyId, isBoss) {
        return new Promise(resolve => {
            const area = document.getElementById('game-area');
            if (!area) { resolve(); return; }

            area.querySelectorAll('.enemy-entrance-container').forEach(e => e.remove());

            const imgSrc = (typeof IMG_DATA !== 'undefined' && IMG_DATA[enemyId]) ? IMG_DATA[enemyId] : '';

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

            requestAnimationFrame(() => {
                container.classList.add('enemy-entrance-active');
            });

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
    // 宝箱演出（既存流用）
    // ========================================
    showTreasureBox(type) {
        return new Promise(resolve => {
            const area = document.getElementById('game-area');
            if (!area) { resolve(); return; }

            let chestImgPath;
            let imgWidth = '130px';

            switch(type) {
                case 'gold':    chestImgPath = 'images/sg_chest_gold.webp'; break;
                case 'diamond': chestImgPath = 'images/sg_chest_diamond.webp'; break;
                case 'gacha':
                    chestImgPath = 'images/sg_icon_gacha.webp';
                    imgWidth = '110px';
                    break;
                case 'candy':
                default:        chestImgPath = 'images/sg_chest_wood.webp'; break;
            }

            const container = document.createElement('div');
            container.style.position = 'absolute';
            container.style.top = '0';
            container.style.left = '0';
            container.style.width = '100%';
            container.style.height = '100%';
            container.style.pointerEvents = 'none';
            container.style.zIndex = '45';

            const img = document.createElement('img');
            img.src = `${chestImgPath}?t=${Date.now()}`;
            
            Object.assign(img.style, {
                position: 'absolute',
                bottom: '18%',
                left: '110%',
                width: imgWidth,
                height: 'auto',
                objectFit: 'contain',
                transform: 'translateX(-50%)',
                transition: 'left 0.6s ease-out',
                filter: 'drop-shadow(0 5px 15px rgba(0,0,0,0.5))'
            });

            container.appendChild(img);
            area.appendChild(container);

            void img.offsetWidth;

            this.setCharRunning(true);
            img.style.left = '70%';

            setTimeout(() => {
                this.setCharRunning(false);
                img.style.transition = 'transform 0.2s ease-out';
                img.style.transform = 'translateX(-50%) scale(1.1) translateY(-10px)';
                
                setTimeout(() => {
                    img.style.transform = 'translateX(-50%) scale(1.0) translateY(0)';
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
    // 報酬ポップアップ（軽量表示）
    // ========================================
    showRewardOverlay(icon, text, category, imgUrl) {
        const host = document.getElementById('game-area') || document.getElementById('screen-sugoroku');
        return new Promise(resolve => {
            if (!host) { resolve(); return; }

            try {
                const toneClass = `sg-reward-toast-${category || 'normal'}`;
                const toast = document.createElement('div');
                toast.className = `sg-reward-toast ${toneClass}`;

                const safeIcon = icon || '';
                const safeText = text || '';
                const safeImgUrl = imgUrl ? encodeURI(String(imgUrl)) : '';
                const thumbHtml = safeImgUrl ? `<div class="sg-reward-toast-thumb" style="background-image:url("${safeImgUrl}")"></div>` : '';
                toast.innerHTML = `
                    <div class="sg-reward-toast-inner">
                        ${safeIcon ? `<span class="sg-reward-toast-icon">${safeIcon}</span>` : ''}
                        ${thumbHtml}
                        <span class="sg-reward-toast-text">${safeText}</span>
                    </div>
                `;
           if (app && app.sound) app.sound.play('se_chest_open');
           
            host.appendChild(toast);
                requestAnimationFrame(() => toast.classList.add('show'));
 let closed = false;
                const close = () => {
                    if (closed) return;
                    closed = true;
                    toast.classList.remove('show');
                    toast.classList.add('hide');
                    setTimeout(() => {
                        toast.remove();
                        resolve();
                    }, 220);
                };

                toast.addEventListener('click', close, { once: true });
                setTimeout(close, 1300);
            } catch (err) {
                console.warn('[SugorokuUI] showRewardOverlay fallback:', err);
                resolve();
            }
        });
    }

    // ========================================
    // カードショップUI（既存流用）
    // ========================================
    showCardShop(items, gold, gems, onBuy) {
        return new Promise(resolve => {
            let ov = document.getElementById('sg-overlay');
            if (!ov) { resolve(); return; }

            const newOv = ov.cloneNode(false);
            if (ov.parentNode) {
                ov.parentNode.replaceChild(newOv, ov);
            }
            ov = newOv;

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
                    
                    let iconHtml = '';
                    if (item.img) {
                        iconHtml = `<img src="${item.img}" style="width:100%;height:100%;object-fit:cover;border-radius:6px;">`;
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
    // リザルト画面（既存流用）
    // ========================================
    showResultScreen(isWin, subtitle, log, onClose) {
        const ov = document.getElementById('sg-overlay');
        if (!ov) return;

        const newOv = ov.cloneNode(false);
        if (ov.parentNode) ov.parentNode.replaceChild(newOv, ov);
        
        const title = isWin ? '🏆 STAGE CLEAR!' : '💀 GAME OVER';
        const cls = isWin ? 'win' : 'lose';

        let itemsHtml = '';
        let delay = 0.3;

        if (log.goldGained > 0) {
            itemsHtml += `
                <div class="rs-item rs-item-anim" style="animation-delay:${delay}s">
                    <span class="rs-icon">💰</span>
                    <span class="rs-val">${log.goldGained.toLocaleString()} G</span>
                </div>`;
            delay += 0.1;
        }

        if (log.gemsGained > 0) {
            itemsHtml += `
                <div class="rs-item rs-item-anim" style="animation-delay:${delay}s">
                    <span class="rs-icon">💎</span>
                    <span class="rs-val">${log.gemsGained}</span>
                </div>`;
            delay += 0.1;
        }

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

        // 装備カードドロップ表示
        if (log.cardsDropped && log.cardsDropped.length > 0) {
            log.cardsDropped.forEach(cd => {
                itemsHtml += `
                    <div class="rs-item rs-item-anim" style="animation-delay:${delay}s">
                        <span class="rs-icon">🃏</span>
                        <div class="rs-text-col">
                            <span class="rs-name" style="color:#ffd700;">${cd.name} Lv.${cd.level}</span>
                            <span class="rs-count">DROP!</span>
                        </div>
                    </div>`;
                delay += 0.1;
            });
        }

        if (itemsHtml === '') {
            itemsHtml = `<div style="color:#aaa; font-size:12px; margin:10px;">獲得アイテムなし</div>`;
        }

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

        newOv.style.display = 'flex';
        requestAnimationFrame(() => newOv.classList.add('show'));

        document.getElementById('rs-ok-btn').addEventListener('click', () => {
            if (app.sound) app.sound.play('sys_decide');
            newOv.classList.remove('show');
            setTimeout(() => {
                newOv.style.display = 'none';
                if (onClose) onClose();
            }, 300);
        });
    }

    // ========================================
    // 中断確認ダイアログ（既存流用）
    // ========================================
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
    // ギャンブル：参加確認ダイアログ（既存流用）
    // ========================================
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

    // ========================================
    // ギャンブル：ゲーム画面（既存流用）
    // ========================================
    showHighLowGame(currentNum, currentReward, winCount, isGem) {
        return new Promise(resolve => {
            const ov = this._getOverlay();
            const unit = isGem ? 'ダイヤ' : 'G';
            
            const renderCard = (num, isHidden=false) => {
                if(isHidden) return `<div class="sg-card back">?</div>`;
                let color = (num === 1 || num === 11 || num === 12 || num === 13) ? '#f00' : '#000';
                let disp = num;
                if(num===1) disp='A';
                if(num===11) disp='J';
                if(num===12) disp='Q';
                if(num===13) disp='K';
                return `<div class="sg-card front" style="color:${color}">♠<br>${disp}</div>`;
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

            document.getElementById('btn-low').onclick = () => resolve('low');
            document.getElementById('btn-high').onclick = () => resolve('high');
            document.getElementById('btn-drop').onclick = () => resolve('drop');
        });
    }

    // ========================================
    // ギャンブル：結果オープン演出（既存流用）
    // ========================================
    showHighLowResult(nextNum) {
        return new Promise(resolve => {
            const area = document.getElementById('sg-next-card-area');
            if(!area) { resolve(); return; }

            let color = (nextNum === 1 || nextNum >= 11) ? '#f00' : '#000';
            let disp = nextNum;
            if(nextNum===1) disp='A'; else if(nextNum===11) disp='J'; else if(nextNum===12) disp='Q'; else if(nextNum===13) disp='K';
            const html = `<div class="sg-card front" style="color:${color}">♠<br>${disp}</div>`;
            
            area.innerHTML = html;
            area.querySelector('.sg-card').classList.add('open-anim');

            setTimeout(() => {
                resolve();
            }, 1500);
        });
    }

    // ========================================
    // ギャンブル画面を閉じる（既存流用）
    // ========================================
    closeGambleUI() {
        return new Promise(resolve => {
           const ov = document.getElementById('sg-overlay');
            if (!ov) { resolve(); return; }
            
            ov.classList.remove('show');
            setTimeout(() => {
                ov.style.display = 'none';
                ov.innerHTML = '';
                resolve();
            }, 200);
        });
    }

    // ========================================
    // 内部ヘルパー
    // ========================================
    _getOverlay() {
        let ov = document.getElementById('sg-overlay');
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
}
