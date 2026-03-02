/**
 * scene_formation_redesign.js
 * 修正版: デッキパネルを完全に画面幅100%に密着させる
 * ・width: 96vw -> 100%
 * ・margin-left/right -> 0
 * ・左右のボーダーと角丸を削除してフラットに
 */
class FormationScreenRedesign {
    constructor() {
        this.selectedUid = null;
        this.currentFilter = 'all';
        
        // 種族定義
        this.types = (typeof TYPES !== 'undefined') ? TYPES : [
            { id: 0, name: '神', icon: '😇' },
            { id: 1, name: '覇王', icon: '👑' },
            { id: 2, name: '姫', icon: '👸' },
            { id: 3, name: '武将', icon: '⚔️' },
            { id: 4, name: '豪族', icon: '💰' },
            { id: 5, name: '妖怪', icon: '👻' }
        ];
    }

    onEnter() {
        this.selectedUid = null;
        this.currentFilter = 'all';
        
        this.setupCustomLayout(); // レイアウト構築
        this.rearrangeControls(); // ボタンの配置移動
        this.setupBottomTabs();   // 下部タブ生成
        this.hideOldFilters();    // 古いフィルターを隠す
        
        this.refresh();
        this.setupEventListeners();
    }

    // --- データ取得関連 ---
    _getAllUnits() {
        const units = [];
        (app.data.inventory || []).forEach(saved => {
            try {
                const base = DB.find(u => u.id === saved.unitId);
                if (!base) return;
                units.push(new Unit(base, saved));
            } catch(e) { /* skip */ }
        });
        return units;
    }

    _getUnit(uid) {
        const saved = (app.data.inventory || []).find(u => u.uid === uid);
        if (!saved) return null;
        try {
            const base = DB.find(u => u.id === saved.unitId);
            if (!base) return null;
            return new Unit(base, saved);
        } catch(e) { return null; }
    }

    getCardBgUrl(typeId, cost) {
       // 属性とカード背面の色を一致させる
        // 火:赤 / 水:青 / 草:緑 / 闇:紫 / 光:金 / 無:白
        // 無属性の白背景は単素材運用のため、レアリティに関わらず white_ur を利用
        if (typeId === 5) return 'images/bg/bg_white_ur.webp';
        const colors = ['red', 'blue', 'green', 'purple', 'gold', 'white'];
        const color = colors[typeId] || 'red';
        let rarity = 'r';
        if (cost >= 5) rarity = 'ur';
        else if (cost >= 3) rarity = 'sr';
        return `images/bg/bg_${color}_${rarity}.webp`;
    }

     getTypeIconUrl(typeId) {
       const icons = ['red', 'blue', 'green', 'purple', 'gold', 'void_white'];
        const key = icons[typeId] || 'red';
        return `images/icons/type_${key}.webp`;
    }

     _getStarIconPath(kind = 'normal') {
        return kind === 'awaken'
            ? 'images/icons/star_awaken.webp'
            : 'images/icons/star_normal.webp';
    }

    _renderRarityStars(cost = 0, awakenCount = 0, total = 5) {
        let html = '';
        for (let i = 0; i < total; i++) {
            let kind = 'normal';
            let cls = 'empty';
            if (i < awakenCount) {
                kind = 'awaken';
                cls = 'filled';
            } else if (i < cost) {
                kind = 'normal';
                cls = 'filled';
            }
            html += `<span class="star-icon ${kind} ${cls}"><img src="${this._getStarIconPath(kind)}" alt="*"></span>`;
        }
        return html;
    }

   setupCustomLayout() {
        if (!document.getElementById('formation-custom-style')) {
            const style = document.createElement('style');
            style.id = 'formation-custom-style';
            style.innerHTML = `
                /* --- デッキエリア調整 (親コンテナ) --- */
                .formation-middle-area {
                    overflow: visible !important;
                    width: 100% !important;
                    padding-top: 0 !important; 
                    padding-bottom: 2px !important;
                    flex-shrink: 0;
                    display: flex;
                    flex-direction: column;
                    justify-content: flex-start;
                    gap: 2px !important;
                    /* 親自体も余白なし */
                    padding-left: 0 !important;
                    padding-right: 0 !important;
                }

                /* --- ボード本体 (完全100%幅) --- */
                .formation-board-large {
                    background: rgba(26, 26, 36, 0.8) !important;
                    border: 2px solid #aaa !important;
                    
                    /* ★修正: 完全に画面幅いっぱい */
                    width: 100% !important;
                    max-width: none !important;
                    
                    /* ★修正: 左右ボーダーと角丸を消して密着させる */
                    border-left: none !important;
                    border-right: none !important;
                    border-radius: 0 !important;
                    
                    /* 比率(4:2)を維持して高さを自動拡大 */
                    aspect-ratio: 2 / 1 !important;
                    height: auto !important;

                    box-sizing: border-box !important;
                    
                    /* ★修正: 左右マージンを0にする */
                    margin: 15px 0 5px 0 !important; 
                    
                    position: relative;
                    overflow: visible !important; 
                    z-index: 5; 
                }
                
                .formation-board-large .grid-bg {
                    background: rgba(0, 0, 0, 0.3) !important;
                    overflow: hidden !important;
                }
                .formation-board-large .grid-cell.slot-locked {
                    background: rgba(30,30,30,0.9) !important;
                    border-color: #333 !important;
                    color: #555 !important;
                    pointer-events: none !important;
                    font-size: 14px !important;
                }

                 .formation-board-large .grid-cell.type-color-0 { background: rgba(255, 64, 64, 0.32) !important; border-color: rgba(255,120,120,0.55) !important; }
                .formation-board-large .grid-cell.type-color-1 { background: rgba(72, 150, 255, 0.32) !important; border-color: rgba(130,190,255,0.55) !important; }
                .formation-board-large .grid-cell.type-color-2 { background: rgba(80, 200, 120, 0.32) !important; border-color: rgba(140,230,170,0.55) !important; }
                .formation-board-large .grid-cell.type-color-3 { background: rgba(165, 90, 255, 0.32) !important; border-color: rgba(205,150,255,0.55) !important; }
                .formation-board-large .grid-cell.type-color-4 { background: rgba(255, 215, 90, 0.34) !important; border-color: rgba(255,235,150,0.6) !important; }
                .formation-board-large .grid-cell.type-color-5 { background: rgba(240, 245, 255, 0.30) !important; border-color: rgba(255,255,255,0.72) !important; }



                /* --- ユニット配置レイヤー --- */
                #edit-units-layer-large {
                    overflow: visible !important;
                    position: absolute;
                    top: 0; left: 0;
                    width: 100%; height: 100%;
                    pointer-events: none;
                }

                .formation-board-large .board-unit {
                    pointer-events: auto;
                    filter: drop-shadow(0 5px 5px rgba(0,0,0,0.8));
                }

                 .board-unit-stars {
                    position: absolute;
                    
                    left: 50%;
                    bottom: 8px;
                    transform: translateX(-50%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index:40;
                    
                    background: rgba(0, 0, 0, 0.55);
                    border: 1px solid rgba(255, 255, 255, 0.18);
                    border-radius: 10px;
                    padding: 1px 6px;
                    white-space: nowrap;
                    pointer-events: none;
                }
                .board-unit-stars .star-icon {
                    width: 17px;
                    height: 17px;
                    margin-right: -4px;
                }
                .board-unit-stars .star-icon:last-child {
                    margin-right: 0;
                }

                /* --- デッキステータスバー --- */
                .deck-total-stats {
                    display: flex !important;
                    flex-direction: row !important;
                    justify-content: space-between !important;
                    align-items: center !important;
                    padding: 4px 8px !important;
                    height: auto !important;
                    min-height: 44px;
                    gap: 4px !important;
                    background: rgba(15, 15, 30, 0.9) !important;
                    border-top: 1px solid #555 !important;
                    border-bottom: 1px solid #555 !important;
                    border-radius: 0 !important;
                    margin: 0 !important;
                    box-shadow: none !important;
                }

                .deck-stats-group {
                    display: flex;
                    gap: 12px;
                    align-items: center;
                }

                .deck-buttons-group {
                    display: flex;
                    gap: 6px;
                    align-items: center;
                }

                .deck-stat-item {
                    align-items: flex-start !important; 
                    gap: 0 !important;
                }
                .deck-stat-label { font-size: 9px !important; color: #aaa !important; }
                .deck-stat-value { font-size: 14px !important; line-height: 1.1 !important; }

                .btn-mini-control {
                    padding: 4px 10px !important;
                    font-size: 11px !important;
                    height: 32px !important;
                    white-space: nowrap !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    border-radius: 4px !important;
                    cursor: pointer !important;
                }
                .btn-start-battle {
                    padding: 4px 16px !important;
                    font-size: 12px !important;
                    height: 34px !important;
                    box-shadow: none !important;
                    border-width: 1px !important;
                    white-space: nowrap !important;
                }
                
                .formation-controls { display: none !important; }


                /* --- 所持カードリスト --- */
                #formation-cards-horizontal {
                    display: flex !important;
                    flex-wrap: nowrap !important;
                    justify-content: flex-start !important;
                    align-items: flex-start !important;
                    padding: 2px !important;
                    gap: 4px !important;
                    overflow-x: auto !important;
                    overflow-y: hidden !important;
                    -webkit-overflow-scrolling: touch;
                }
                .card-item-horizontal {
                    width: 70px !important;
                    min-width: 70px !important;
                    padding: 2px !important;
                    margin: 0 !important;
                    flex-grow: 0 !important;
                    flex-shrink: 0 !important;
                    box-sizing: border-box !important;
                }
                .card-item-horizontal .list-card {
                    width: 100% !important;
                    height: 100% !important;
                    margin: 0 !important;
                }

                /* --- 詳細エリア --- */
                .formation-top-area {
                    position: relative;
                    z-index: 10;
                    min-height: 190px !important;
                    max-height: 230px !important;
                    padding: 8px !important;
                    display: flex;
                    gap: 12px;
                    background: rgba(10, 15, 30, 0.75) !important;
                    backdrop-filter: blur(4px);
                    border-bottom: 2px solid #d4af37;
                    align-items: flex-start;
                    margin-bottom: 0 !important;
                }
                .selected-card-detail { width: 100px !important; flex-shrink: 0; display: flex; flex-direction: column; gap: 4px; }
                .f-detail-img { width: 100%; height: 133px; border: 2px solid #ffd700; box-shadow: 0 4px 10px rgba(0,0,0,0.6); position: relative; background-size: cover; background-position: center; border-radius: 4px; }
                
                .f-stats-under-img { display: flex; flex-direction: column; gap: 2px; background: rgba(0,0,0,0.3); padding: 2px; border-radius: 4px; }
                .f-mini-stat-row { display: flex; align-items: center; height: 12px; font-size: 9px; color: #fff; background: #111; border-radius: 2px; overflow: hidden; position: relative; }
               .f-shape-under-stats {
                    margin-top: 4px;
                    height: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: flex-start;
                    padding-left: 2px;
                    background: rgba(0, 0, 0, 0.5);
                    border-radius: 2px;
                }
                .f-shape-under-stats .shape-icon {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1px;
                    width: 12px;
                    height: 12px;
                }
                .f-mini-label { width: 22px; background: #333; text-align: center; font-weight: bold; z-index: 2; font-size: 8px; line-height: 12px; }
                .f-mini-bar-bg { flex: 1; position: relative; height: 100%; }
                .f-mini-bar-fill { height: 100%; position: absolute; top: 0; left: 0; }
                .f-mini-val { position: absolute; right: 2px; top: 0; height: 100%; line-height: 12px; z-index: 2; text-shadow: 1px 1px 0 #000; font-family: monospace; }
                
                .selected-card-stats { flex: 1; display: flex; flex-direction: column; gap: 5px; overflow-y: auto; height: 100%; }
                .f-info-name { font-size: 16px; font-weight: bold; color: #00ced1; text-shadow: 0 0 5px rgba(0,206,209,0.5); border-bottom: 1px solid #444; padding-bottom: 2px; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .f-info-sub { font-size: 10px; color: #aaa; margin-left: 5px; }
                .f-info-box { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; padding: 4px 6px; }
                .f-info-head { font-size: 10px; font-weight: bold; color: #aaa; margin-bottom: 2px; border-bottom: 1px dashed rgba(255,255,255,0.1); display: flex; justify-content: space-between; }
                .f-info-body { font-size: 11px; color: #eee; line-height: 1.3; }
                .f-ab-grid { display: flex; flex-wrap: wrap; gap: 3px; }
                .f-ab-chip { font-size: 9px; background: #222; border: 1px solid #555; color: #777; padding: 1px 4px; border-radius: 2px; }
                .f-ab-chip.on { background: #004444; border-color: #00ced1; color: #00ced1; }
                .c-hp { background: #00cc00; } .c-atk { background: #cc0000; } .c-spd { background: #cccc00; }

                /* --- 下部エリア (背景透過) --- */
                .formation-bottom-area {
                    background: rgba(10, 10, 20, 0.7) !important;
                    backdrop-filter: blur(4px);
                    border-top: 2px solid rgba(255, 215, 0, 0.3);
                    flex: 1 1 auto !important; 
                }

                .formation-bottom-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    background: rgba(0, 0, 0, 0.6) !important;
                    border-bottom: 1px solid #444;
                    padding: 4px 8px;
                    flex-shrink: 0;
                }
                .f-owned-label {
                    font-size: 11px; color: #ccc;
                    display: flex; align-items: center; gap: 5px;
                    white-space: nowrap;
                    margin-right: 10px;
                }
                .f-owned-val { color: #00ced1; font-weight: bold; font-size: 14px; }
                
                .f-race-tabs {
                    display: flex;
                    gap: 4px;
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                    padding-bottom: 2px;
                }
                .f-race-tab {
                    background: rgba(50,50,50,0.6);
                    border: 1px solid #555;
                    color: #aaa;
                    font-size: 10px;
                    padding: 4px 8px;
                    border-radius: 4px;
                    cursor: pointer;
                    white-space: nowrap;
                    transition: all 0.2s;
                }
                .f-race-tab.active {
                    background: #00ced1;
                    color: #000;
                    border-color: #fff;
                    font-weight: bold;
                }

                .cards-horizontal-scroll {
                    background: transparent !important;
                }

                #filter-buttons, .filter-buttons-area {
                    display: none !important;
                }
                /* ★追加: カード下部の新レイアウト (強化画面と統一) */
              .lc-card-footer {
                position: absolute; bottom: 0; left: 0; width: 100%;
                height: 24px; 
                background: rgba(0,0,0,0.85); 
                display: flex; align-items: center; 
                padding-left: 3px;  /* 左の余白を少し微調整 */
                gap: 1px;           /* ★修正: 間隔を狭くする (4px -> 2px) */
                border-radius: 0 0 4px 4px; 
                z-index: 25 !important;
                overflow: hidden; /* はみ出し防止 */
            }

            .footer-grid .shape-icon { 
                display: grid; grid-template-columns: 1fr 1fr; gap: 1px; 
                width: 10px; height: 10px; 
                flex-shrink: 0; /* グリッドが潰れないようにする */
            }
            .footer-grid .shape-cell-dot { background: #555; border-radius: 1px; }
            .footer-grid .shape-cell-dot.on { background: #0f0; box-shadow: 0 0 3px #0f0; }

            /* ★修正: 星のサイズと間隔を詰める */
           .footer-stars { 
                display: flex;
                align-items: center;
                justify-content: flex-start;
                gap: 0;
                margin-top: -1px;
                margin-left: 1px;
                white-space: nowrap;
                overflow: visible;
            }

           .star-icon { width: 11px; height: 11px; display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; }
            .star-icon img { width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 0 1px rgba(0,0,0,0.9)); }
            .star-icon.awaken img { filter: drop-shadow(0 0 2px rgba(255,80,180,0.95)); }
            .star-icon.empty { opacity: 0.35; }
            .footer-stars .star-icon { margin-right: -3px; }
            .footer-stars .star-icon:last-child { margin-right: 0; }

            /* 星表示（上部）：薄い黒バックパネル */
            .lc-card-stars-top {
                position: absolute;
                top: 2px;
                left: 3px;
                display: flex;
                justify-content: flex-start;
                align-items: center;
                z-index: 30;
                background: rgba(0, 0, 0, 0.45);
                border-radius: 4px;
                padding: 1px 3px;
            }

           /* ★修正: レベルバッジを右上に配置 */
            .lc-lv-badge-top {
                position: absolute; 
                top: 0; right: 0; /* ★右上に固定 */
                left: auto;       /* 左指定を解除 */
                
                background: rgba(0, 0, 0, 0.85); /* 濃い黒背景 */
                border-left: 1px solid #666;     /* ★左側に境界線 */
                border-bottom: 1px solid #666;
                border-radius: 0 2px 0 4px;      /* ★左下を丸くする */
                
                color: #fff;
                font-family: sans-serif;
                font-weight: bold;
                font-size: 11px;
                padding: 2px 6px;
                
                text-shadow: 1px 1px 0 #000;
                box-shadow: -1px 1px 2px rgba(0,0,0,0.5); /* 影の向きも調整 */
                z-index: 26 !important;
            }

            /* --- ★追加: 詳細パネル用 (所持カード一覧と同じ表示構成) --- */
            .f-detail-img.portrait-style {
                background-position: center 34%, center;
                background-size: 92% 92%, cover;
            }
            /* フッター (詳細版) */
        
            .f-detail-img.portrait-style .card-lv-label {
                position: absolute;
                top: 4px;
                left: 5px;
                color: #f3fbff;
                font-size: 15px;
                font-weight: 800;
                line-height: 1;
                letter-spacing: 0.2px;
                -webkit-text-stroke: 0.8px rgba(8, 22, 42, 0.9);
                text-shadow:
                    0 1px 0 rgba(0, 0, 0, 0.85),
                    0 0 4px rgba(16, 60, 120, 0.85),
                    0 0 8px rgba(0, 0, 0, 0.65);
                z-index: 4;
            }
             .f-detail-img.portrait-style .card-type-icon {
                position: absolute;
                top: 2px;
                right: 3px;
                width: 20px;
                height: 20px;
                object-fit: contain;
                filter:
                    drop-shadow(0 1px 0 rgba(0, 0, 0, 0.9))
                    drop-shadow(0 0 4px rgba(5, 16, 34, 0.95));
                z-index: 4;
            }
            .f-detail-img.portrait-style .lc-card-stars-bottom {
                position: absolute;
                left: 4px;
               right: 4px;
                bottom: 3px;
                display: flex;
                justify-content: center;
                z-index: 3;
            }
             .f-detail-img.portrait-style .lc-card-stars-bottom .footer-stars {
                display: flex;
                gap: 0;
            }
            .f-detail-img.portrait-style .lc-card-stars-bottom .star-icon {
                width: 18px;
                height: 18px;
                margin-right: -6px;
            }
            .f-detail-img.portrait-style .lc-card-stars-bottom .star-icon:last-child {
                margin-right: 0;
            }
            

             /* 所持カード一覧：縦長カード風の見た目（画像2イメージ） */
            .card-item-horizontal {
                width: 74px;
                min-width: 74px;
                align-items: center;
                gap: 4px;
            }

            .card-item-horizontal .list-card.portrait-style {
            position: relative;
                width: 64px;
                height: 92px;
                border-radius: 8px;
                border: 2px solid #9fb8d8;
                box-shadow:
                    inset 0 0 0 2px rgba(10, 20, 50, 0.75),
                    0 2px 6px rgba(0, 0, 0, 0.7);
                background-position: center 34%, center;
                background-size: 92% 92%, cover;
            }

         

            

            .card-item-horizontal .list-card.portrait-style .card-lv-label {
                position: absolute;
                top: 4px;
                left: 5px;
                color: #f3fbff;
                font-size: 13px;
                font-weight: 800;
                line-height: 1;
                
                letter-spacing: 0.2px;
               -webkit-text-stroke: 0.7px rgba(8, 22, 42, 0.9);
                text-shadow:
                    0 1px 0 rgba(0, 0, 0, 0.85),
                    0 0 4px rgba(16, 60, 120, 0.85),
                    0 0 8px rgba(0, 0, 0, 0.65);
                z-index: 4;
            }

            .card-item-horizontal .list-card.portrait-style .card-type-icon {
                position: absolute;
                 top: 2px;
                right: 3px;
                width: 18px;
                height: 18px;
                object-fit: contain;
                filter:
                    drop-shadow(0 1px 0 rgba(0, 0, 0, 0.9))
                    drop-shadow(0 0 4px rgba(5, 16, 34, 0.95));
                z-index: 4;
            }

            .card-item-horizontal .list-card.portrait-style .lc-card-stars-bottom {
                position: absolute;
                left: 4px;
                right: 4px;
                bottom: 2px;
                display: flex;
                justify-content: center;
                z-index: 3;
            }

            .card-item-horizontal .list-card.portrait-style .lc-card-stars-bottom .footer-stars {
                display: flex;
                gap: 0;
            }

            .card-item-horizontal .list-card.portrait-style .lc-card-stars-bottom .star-icon {
                width: 15px;
                height: 15px;
                margin-right: -5px;
            }

            .card-item-horizontal .list-card.portrait-style .lc-card-stars-bottom .star-icon:last-child {
                margin-right: 0;
            }

            .card-item-horizontal .list-card.portrait-style {
                transition: transform 0.2s, box-shadow 0.2s;
            }

            .card-item-horizontal .list-card.portrait-style.selected {
                box-shadow:
                    inset 0 0 0 2px rgba(60, 140, 255, 0.85),
                    0 0 12px rgba(90, 180, 255, 0.75);
                transform: translateY(-2px);
            }

            .card-item-horizontal .list-card.portrait-style.in-deck {
                filter: saturate(0.85) brightness(0.85);
            }
            `;
            document.head.appendChild(style);
        }
    }

    rearrangeControls() {
        const statsBar = document.querySelector('.deck-total-stats');
        const oldControls = document.querySelector('.formation-controls');
        
        if (statsBar && statsBar.querySelector('.deck-buttons-group')) return;
        
        if (statsBar && oldControls) {
            const statsGroup = document.createElement('div');
            statsGroup.className = 'deck-stats-group';
            while (statsBar.firstChild) {
                statsGroup.appendChild(statsBar.firstChild);
            }
            statsBar.appendChild(statsGroup);

            const btnGroup = document.createElement('div');
            btnGroup.className = 'deck-buttons-group';

            const clearBtn = oldControls.querySelector('.btn-clear-all');
            if (clearBtn) {
                clearBtn.className = 'btn-mini-control';
                clearBtn.style.background = '#444';
                clearBtn.style.border = '1px solid #888';
                clearBtn.style.color = '#ccc';
                btnGroup.appendChild(clearBtn);
            }

            const removeBtn = document.createElement('button');
            removeBtn.id = 'btn-remove-integrated';
            removeBtn.className = 'btn-mini-control';
            removeBtn.style.background = '#600';
            removeBtn.style.border = '1px solid #f88';
            removeBtn.style.color = '#fff';
            removeBtn.textContent = '解除';
            removeBtn.disabled = true;
            removeBtn.onclick = () => {
                if (!this.selectedUid) return;
                const inDeck = (app.data.deck || []).some(d => d.uid === this.selectedUid);
                if (inDeck) {
                    if (app.sound) app.sound.tap();
                    app.deckManager.removeUnit(this.selectedUid);
                    this.selectedUid = null;
                    this.refresh();
                }
            };
            btnGroup.appendChild(removeBtn);

            const startBtn = oldControls.querySelector('.btn-start-battle');
            if (startBtn) {
                startBtn.id = 'btn-start-new-integrated';
                startBtn.textContent = '出撃';
                btnGroup.appendChild(startBtn);
            }

            statsBar.appendChild(btnGroup);
        }
    }

    hideOldFilters() {
        const oldFilter = document.getElementById('filter-buttons');
        if (oldFilter) oldFilter.style.display = 'none';
        
        const oldFilterClass = document.querySelector('.filter-buttons-area');
        if (oldFilterClass) oldFilterClass.style.display = 'none';
    }

    setupBottomTabs() {
        const bottomArea = document.querySelector('.formation-bottom-area');
        if (!bottomArea) return;

        const oldLabel = bottomArea.querySelector('.owned-cards-label');
        if (oldLabel) oldLabel.remove();

        let header = bottomArea.querySelector('.formation-bottom-header');
        if (!header || !header.querySelector('.f-race-tabs')) {
            if (header) header.remove();

            header = document.createElement('div');
            header.className = 'formation-bottom-header';
            
            const labelDiv = document.createElement('div');
            labelDiv.className = 'f-owned-label';
            labelDiv.innerHTML = `所持 <span id="f-owned-count" class="f-owned-val">0</span>`;
            header.appendChild(labelDiv);

            const tabsDiv = document.createElement('div');
            tabsDiv.className = 'f-race-tabs';
            
            const allBtn = document.createElement('div');
            allBtn.className = 'f-race-tab active';
            allBtn.textContent = 'ALL';
            allBtn.dataset.type = 'all';
            allBtn.onclick = () => this.onTabClick(allBtn, 'all');
            tabsDiv.appendChild(allBtn);

            this.types.forEach(t => {
                const btn = document.createElement('div');
                btn.className = 'f-race-tab';
                btn.textContent = t.name;
                btn.dataset.type = t.id;
                btn.onclick = () => this.onTabClick(btn, t.id);
                tabsDiv.appendChild(btn);
            });

            header.appendChild(tabsDiv);
            bottomArea.insertBefore(header, bottomArea.firstChild);
        }
    }

    onTabClick(btn, type) {
        if (app.sound) app.sound.tap();
        document.querySelectorAll('.f-race-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = type;
        this.renderCardList();
    }

    setupEventListeners() {
        const bs = document.getElementById('btn-start-new-integrated');
        if (bs) {
            const nb = bs.cloneNode(true);
            bs.parentNode.replaceChild(nb, bs);
            nb.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!app.data.deck || app.data.deck.length === 0) {
                    alert("部隊にキャラクターがいません");
                    return;
                }
                if (app.sound) app.sound.tap();
                app.changeScene('screen-sugoroku');
            });
        }
    }

    refresh() {
        this.renderCardList();
        this.renderBoard();
        this.updateSelectedCardDetail();
        this.updateDeckStats();
        this.updateOwnedCount();
        this.updateControlButtons();
    }

    updateControlButtons() {
        const bs = document.getElementById('btn-start-new-integrated');
        if (bs) bs.disabled = (!app.data.deck || app.data.deck.length === 0);

        const rmBtn = document.getElementById('btn-remove-integrated');
        if (rmBtn) {
            const inDeck = this.selectedUid && (app.data.deck || []).some(d => d.uid === this.selectedUid);
            rmBtn.disabled = !inDeck;
            if (inDeck) {
                rmBtn.style.opacity = '1';
                rmBtn.style.cursor = 'pointer';
            } else {
                rmBtn.style.opacity = '0.5';
                rmBtn.style.cursor = 'default';
            }
        }
    }

    // scene_formation_redesign.js 内

   updateSelectedCardDetail() {
        const leftCol = document.querySelector('.selected-card-detail');
        const rightCol = document.querySelector('.selected-card-stats');

        if (!this.selectedUid) {
            if(leftCol) leftCol.innerHTML = '<div style="width:100%;height:133px;background:rgba(0,0,0,0.3);border:2px solid #555;display:flex;align-items:center;justify-content:center;color:#666;font-size:10px;">No Select</div>';
            if(rightCol) rightCol.innerHTML = '<div style="color:#aaa;text-align:center;padding-top:20px;">キャラクターを選択してください</div>';
            return;
        }

        const unit = this._getUnit(this.selectedUid);
        if (!unit) { this.selectedUid = null; this.updateSelectedCardDetail(); return; }

        // 左カラム（画像・ステータスバー）
        if (leftCol) {
            const bgUrl = this.getCardBgUrl(unit.base.type, unit.base.cost);
            const charImg = (typeof IMG_DATA !== 'undefined' && IMG_DATA[unit.base.id]) 
                            ? `url(${IMG_DATA[unit.base.id]})` : 'none';
            
            // --- グリッド生成 ---
            let gridHtml = '<div class="shape-icon">';
            unit.base.shape.grid.forEach(bit => { gridHtml += `<div class="shape-cell-dot ${bit?'on':''}"></div>`; });
            gridHtml += '</div>';
            
            // --- 星生成（通常星 + 覚醒星アイコン） ---
            const starsHtml = this._renderRarityStars(unit.base.cost, unit.lbCount || 0, 5);

            // --- ステータスバー計算 ---
            const maxHp = 3000, maxAtk = 1000, maxSpd = 50;
            const hpPct = Math.min(100, (unit.maxHp / maxHp) * 100);
            const atkPct = Math.min(100, (unit.atk / maxAtk) * 100);
            const spdPct = Math.min(100, (unit.spd / maxSpd) * 100);

             const typeIconUrl = this.getTypeIconUrl(unit.base.type);

            // ★HTML書き換え: 所持カード一覧と同じUI構成
            leftCol.innerHTML = `
                <div class="f-detail-img list-card portrait-style type-${unit.base.type}" style="background-image: ${charImg}, url('${bgUrl}')">
                    <div class="card-lv-label">Lv${unit.save.lv}</div>
                    <img class="card-type-icon" src="${typeIconUrl}" alt="${(this.types[unit.base.type] && this.types[unit.base.type].name) || ''}" onerror="this.style.display='none'">
                    <div class="lc-card-stars-bottom">
                        <div class="footer-stars">${starsHtml}</div>
                    </div>
                </div>

                <div class="f-stats-under-img">
                    <div class="f-mini-stat-row">
                        <div class="f-mini-label" style="color:#8f8">HP</div>
                        <div class="f-mini-bar-bg"><div class="f-mini-bar-fill c-hp" style="width:${hpPct}%"></div></div>
                        <div class="f-mini-val">${unit.maxHp}</div>
                    </div>
                    <div class="f-mini-stat-row">
                        <div class="f-mini-label" style="color:#f88">ATK</div>
                        <div class="f-mini-bar-bg"><div class="f-mini-bar-fill c-atk" style="width:${atkPct}%"></div></div>
                        <div class="f-mini-val">${unit.atk}</div>
                    </div>
                    <div class="f-mini-stat-row">
                        <div class="f-mini-label" style="color:#ff8">SPD</div>
                        <div class="f-mini-bar-bg"><div class="f-mini-bar-fill c-spd" style="width:${spdPct}%"></div></div>
                        <div class="f-mini-val">${unit.spd}</div>
                    </div>
                    <div class="f-shape-under-stats">${gridHtml}</div>
                </div>
            `;
        }

        // 右カラム（スキル・詳細情報）はそのまま維持
        if (rightCol) {
            const skillName = unit.base.skill ? unit.base.skill.name : 'なし';
            const skillDesc = (typeof unit.getSkillCurrentDesc === 'function')
                ? unit.getSkillCurrentDesc()
                : (unit.base.skill ? unit.base.skill.desc : '-');
            const passiveName = unit.base.passive ? unit.base.passive.name : 'なし';
            const passiveDesc = unit.base.passive ? unit.base.passive.desc : '-';
            
            // アビリティ情報の取得 (存在チェック付き)
            const abilities = (typeof unit.getAbilityStatus === 'function') ? unit.getAbilityStatus() : [];
            const abHtml = abilities.map(a => `<div class="f-ab-chip ${a.unlocked?'on':''}">${a.text}</div>`).join('');

            rightCol.innerHTML = `
                <div class="f-info-name">${unit.base.name}<span class="f-info-sub">(Size:${unit.base.shape.label})</span></div>
                <div class="f-info-box">
                    <div class="f-info-head">SKILL: ${skillName} ${unit.base.skill && unit.base.skill.charge && unit.base.skill.charge < 99 ? '<span style="color:#ffdd00;font-size:10px;">⚡' + unit.base.skill.charge + 'T</span>' : ''}</div>
                    <div class="f-info-body">${skillDesc}</div>
                </div>
                <div class="f-info-box" style="margin-top:2px;">
                    <div class="f-info-head">PASSIVE: ${passiveName}</div>
                    <div class="f-info-body">${passiveDesc}</div>
                </div>
                ${abilities.length > 0 ? `<div class="f-info-box" style="margin-top:2px;"><div class="f-info-head">ABILITY</div><div class="f-ab-grid">${abHtml}</div></div>` : ''}
                ${this._renderEquippedCards(unit)}
            `;
        }
    }

    /** ★装備カードの表示（ユニット詳細パネル内） */
    _renderEquippedCards(unit) {
        if (!unit || !unit.uid || !app.data.cardManager) return '';
        const equips = app.data.getUnitEquips(unit.uid);
        const cm = app.data.cardManager;
        const colors = [
            { id: 'red', label: '🟥', name: '赤' },
            { id: 'yellow', label: '🟨', name: '黄' },
            { id: 'blue', label: '🟦', name: '青' },
            { id: 'purple', label: '🟪', name: '紫' }
        ];

        let hasAny = false;
        let slotsHtml = colors.map(c => {
            const cardId = equips[c.id];
            const card = cardId ? cm.getCard(cardId) : null;
            if (card) {
                hasAny = true;
                const eff = (typeof CARD_EFFECTS !== 'undefined') ? CARD_EFFECTS[card.effectType] : null;
                return `<div class="f-eq-slot" style="border-left:3px solid ${c.id === 'red' ? '#f44' : c.id === 'yellow' ? '#fa0' : c.id === 'blue' ? '#4af' : '#a4f'};">
                    <span style="font-size:10px;">${c.label}</span>
                    <span style="font-size:10px;font-weight:bold;">${eff ? eff.name : '?'}</span>
                    <span style="font-size:9px;color:#aaa;">Lv.${card.level}</span>
                    <span style="font-size:8px;color:#ffd700;">${'★'.repeat(card.awakening)}</span>
                </div>`;
            }
            return `<div class="f-eq-slot" style="border-left:3px solid #333;opacity:0.4;">
                <span style="font-size:10px;">${c.label}</span>
                <span style="font-size:9px;color:#555;">空き</span>
            </div>`;
        }).join('');

        return `
        <div class="f-info-box" style="margin-top:2px;">
            <div class="f-info-head">EQUIP CARDS
                <span style="font-size:9px;color:#4af;margin-left:6px;cursor:pointer;" 
                      onclick="app.changeScene('cards',{tab:'equip',unitUid:'${unit.uid}'})">管理→</span>
            </div>
            <div style="display:flex;gap:3px;flex-wrap:wrap;">
                ${slotsHtml}
            </div>
        </div>`;
    }

    updateDeckStats() {
        let hp = 0, atk = 0, spd = 0, n = 0;
        (app.data.deck || []).forEach(e => {
            const u = this._getUnit(e.uid);
            if (u) { hp += u.maxHp; atk += u.atk; spd += u.spd; n++; }
        });
        const el = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
        el('total-hp-new', hp.toLocaleString());
        el('total-atk-new', atk.toLocaleString());
        el('avg-sp-new', n > 0 ? (spd / n).toFixed(1) : '0.0');
        // ★スロット情報
        const slotEl = document.getElementById('slot-count-info');
        if (slotEl) slotEl.textContent = n + '/' + (app.data.maxSlots || 4);

        // ★v2.2: リーダースキル表示
        let lsBox = document.getElementById('leader-skill-display');
        if (!lsBox) {
            // 初回: DOMに挿入
            const statsArea = document.querySelector('.deck-total-stats');
            if (statsArea) {
                lsBox = document.createElement('div');
                lsBox.id = 'leader-skill-display';
                lsBox.style.cssText = 'text-align:center;padding:3px 8px;background:rgba(255,215,0,0.12);border:1px solid rgba(255,215,0,0.3);border-radius:4px;font-size:11px;color:#ffd700;margin:4px 8px 0;display:none;';
                statsArea.parentNode.insertBefore(lsBox, statsArea.nextSibling);
            }
        }
        if (lsBox && n > 0) {
            const minAnchor = Math.min(...(app.data.deck || []).map(d => d.anchorIdx));
            const leaderEntry = (app.data.deck || []).find(d => d.anchorIdx === minAnchor);
            if (leaderEntry) {
                const leaderUnit = this._getUnit(leaderEntry.uid);
                if (leaderUnit && leaderUnit.base.leaderSkill) {
                    const ls = leaderUnit.base.leaderSkill;
                    lsBox.innerHTML = '👑 ' + leaderUnit.base.name + '「' + ls.name + '」<br><span style="font-size:10px;color:#ccc;">' + ls.desc + '</span>';
                    lsBox.style.display = 'block';
                } else {
                    lsBox.style.display = 'none';
                }
            }
        } else if (lsBox) {
            lsBox.style.display = 'none';
        }
    }

    updateOwnedCount() {
        const c = app.data.inventory ? app.data.inventory.length : 0;
        const el = document.getElementById('f-owned-count');
        if (el) el.textContent = c;
    }

 renderCardList() {
        const container = document.getElementById('formation-cards-horizontal');
        if (!container) return;
        container.innerHTML = '';

        let units = this._getAllUnits();
        
        // フィルタリング
        if (this.currentFilter !== 'all' && this.currentFilter !== 'rarity') {
            const tid = parseInt(this.currentFilter);
            if (!isNaN(tid)) units = units.filter(u => u.base.type === tid);
        }

        // ソート
        if (this.currentFilter === 'rarity') {
            units.sort((a, b) => b.base.cost - a.base.cost);
        } else {
            units.sort((a, b) => {
                if (b.base.cost !== a.base.cost) return b.base.cost - a.base.cost;
                return a.base.id - b.base.id;
            });
        }

        if (units.length === 0) {
            container.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">カードがありません</div>';
            return;
        }

        units.forEach(unit => {
            const inDeck = (app.data.deck || []).some(d => d.uid === unit.uid);
            
            const wrapper = document.createElement('div');
            wrapper.className = 'card-item-horizontal';

            const card = document.createElement('div');
            // レアリティ枠の色 (URのみ特別扱いは維持)
            let rarityClass = (unit.base.cost >= 5) ? ' rarity-ur' : '';
            
          card.className = `list-card portrait-style type-${unit.base.type}${rarityClass}`;
            if (this.selectedUid === unit.uid) card.classList.add('selected');
            if (inDeck) card.classList.add('in-deck');

            const bgUrl = this.getCardBgUrl(unit.base.type, unit.base.cost);
            const charImg = (typeof IMG_DATA !== 'undefined' && IMG_DATA[unit.base.id]) 
                            ? `url(${IMG_DATA[unit.base.id]})` : 'none';
            card.style.backgroundImage = `${charImg}, url('${bgUrl}')`;
            card.style.backgroundSize = "cover, cover"; 

           

           // --- 星の表示（通常星 + 覚醒星アイコン） ---
            const starsHtml = this._renderRarityStars(unit.base.cost, unit.lbCount || 0, 5);

            const typeIconUrl = this.getTypeIconUrl(unit.base.type);
            card.innerHTML = `
                 <div class="card-lv-label">Lv${unit.save.lv}</div>
                <img class="card-type-icon" src="${typeIconUrl}" alt="${(this.types[unit.base.type] && this.types[unit.base.type].name) || ''}" onerror="this.style.display='none'">
                <div class="lc-card-stars-bottom">
                    <div class="footer-stars">${starsHtml}</div>
                </div>
            `;

            if (inDeck) {
                card.innerHTML += `<div class="card-deck-mark" style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%) rotate(-15deg); background:rgba(200,0,0,0.8); border:1px solid #fff; padding:2px 5px; font-size:10px; z-index:26;">編成中</div>`;
            }

            card.onclick = () => {
                if (app.sound) app.sound.tap();
                this.selectCard(unit.uid);
            };
            
            wrapper.appendChild(card);
          
            container.appendChild(wrapper);
        });
    }

    selectCard(uid) {
        this.selectedUid = (this.selectedUid === uid) ? null : uid;
        this.refresh();
    }

    renderBoard() {
        const layer = document.getElementById('edit-units-layer-large');
        if (!layer) return;
        layer.innerHTML = '';
           const boardEl = document.querySelector('.formation-board-large');
        const isPlacingMode = !!(this.selectedUid && !(app.data.deck || []).some(d => d.uid === this.selectedUid));
        if (boardEl) boardEl.classList.toggle('placing-unit-mode', isPlacingMode);

        const openSlots = (typeof DeckManager !== 'undefined') ? DeckManager.getOpenSlots() : [0,1,4,5];
        document.querySelectorAll('.formation-board-large .grid-cell').forEach(c => {
            c.classList.remove('valid', 'slot-locked');
            for (let t = 0; t < 6; t++) c.classList.remove('type-color-' + t);
            c.style.cursor = '';
            const idx = parseInt(c.dataset.idx);
            // ★ 開放順ベースでロック表示
            if (!openSlots.includes(idx)) {
                c.classList.add('slot-locked');
                c.innerHTML = '🔒';
            } else {
                c.innerHTML = idx < 4 ? 'F' + (idx+1) : 'B' + (idx-3);
            }
        });

        (app.data.deck || []).forEach(entry => {
            const unit = this._getUnit(entry.uid);
            if (!unit) return;

            const occupiedCells = unit.getOccupiedCells ? unit.getOccupiedCells(entry.anchorIdx) : null;
            if (occupiedCells) {
                occupiedCells.forEach(idx => {
                    const cellEl = document.querySelector(`.formation-board-large .grid-cell[data-idx="${idx}"]`);
                    if (cellEl) cellEl.classList.add('type-color-' + unit.base.type);
                });
            } else {
                const cellEl = document.querySelector(`.formation-board-large .grid-cell[data-idx="${entry.anchorIdx}"]`);
                if (cellEl) cellEl.classList.add('type-color-' + unit.base.type);
            }

            const card = document.createElement('div');
            card.className = `board-unit size-${unit.base.shape.code}`;
            if (this.selectedUid === entry.uid) card.classList.add('selected');
            if (IMG_DATA && IMG_DATA[unit.base.id]) {
                card.style.backgroundImage = `url(${IMG_DATA[unit.base.id]})`;
            } else {
                card.innerHTML = `<div style="color:#fff;font-size:10px;text-align:center;">${unit.base.name}</div>`;
            }

            // ★v2.2: リーダーバッジ
            const minAnchor = Math.min(...(app.data.deck || []).map(d => d.anchorIdx));
            if (entry.anchorIdx === minAnchor) {
                const crown = document.createElement('div');
                crown.style.cssText = 'position:absolute;top:-10px;left:50%;transform:translateX(-50%);font-size:14px;z-index:20;filter:drop-shadow(0 0 2px gold);';
                crown.textContent = '👑';
                card.appendChild(crown);
            }
            const row = Math.floor(entry.anchorIdx / 4);
            const col = entry.anchorIdx % 4;
            
            const cellW = 25; 
            const cellH = 50; 
            
            card.style.left = `calc(${col * cellW}% + 2px)`;
            card.style.top = `calc(${row * cellH}% + 2px)`;
            

            
            const starEl = document.createElement('div');
            starEl.className = 'board-unit-stars';
           starEl.innerHTML = this._renderRarityStars(unit.base.cost, unit.lbCount || 0, 5);
             card.appendChild(starEl);

            card.addEventListener('click', () => {
                if (app.sound) app.sound.tap();
                this.selectedUid = entry.uid;
                this.refresh();
            });
            layer.appendChild(card);
        });

        if (this.selectedUid) {
            const unit = this._getUnit(this.selectedUid);
            if (unit && !(app.data.deck || []).some(d => d.uid === this.selectedUid)) {
                for (let i = 0; i < 8; i++) {
                    if (app.deckManager.canPlace(unit, i)) {
                        const cells = unit.getOccupiedCells(i);
                        if (cells) cells.forEach(idx => {
                            const c = document.querySelector(`.formation-board-large .grid-cell[data-idx="${idx}"]`);
                            if (c) { c.classList.add('valid'); c.style.cursor = 'pointer'; }
                        });
                    }
                }
            }
        }

        document.querySelectorAll('.formation-board-large .grid-cell').forEach(cell => {
            const nc = cell.cloneNode(true);
            cell.parentNode.replaceChild(nc, cell);
            nc.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!this.selectedUid) return;
                const idx = parseInt(nc.dataset.idx);
                const unit = this._getUnit(this.selectedUid);
                if (!unit) return;
                if ((app.data.deck || []).some(d => d.uid === this.selectedUid)) return;
                if (!app.deckManager.canPlace(unit, idx)) return;
                if (app.sound) app.sound.tap();
                app.deckManager.addUnit(this.selectedUid, idx);
                this.selectedUid = null;
            });
        });
    }

    getRarityInfo(cost) {
        if (cost >= 5) return { label: 'UR', color: '#e100ff', stars: '★★★★★' };
        if (cost === 4) return { label: 'SSR', color: '#ffd700', stars: '★★★★' };
        if (cost === 3) return { label: 'SR', color: '#c0c0c0', stars: '★★★' };
        return { label: 'R', color: '#cd7f32', stars: '★'.repeat(Math.max(1, cost)) };
    }

    clear() {
        if (confirm('全て解除しますか？')) {
            if (app.sound) app.sound.tap();
            app.data.deck = [];
            app.data.saveDeck();
            this.selectedUid = null;
            this.refresh();
        }
    }
}

window.autoRecommend = () => {
    if (!app || !app.data) return;
    app.data.deck = [];
    const units = [];
    (app.data.inventory || []).forEach(s => {
        try {
            const base = DB.find(u => u.id === s.unitId);
            if (!base) return;
            units.push(new Unit(base, s));
        } catch(e) { /* skip */ }
    });
    units.sort((a, b) => b.base.cost - a.base.cost);
    for (const u of units) {
        if (app.data.deck.length >= (app.data.maxSlots || 4)) break;
        for (let i = 0; i < 8; i++) {
            if (app.deckManager.canPlace(u, i)) {
                app.data.deck.push({ uid: u.uid, unitId: u.base.id, anchorIdx: i });
                break;
            }
        }
    }
    app.data.saveDeck();
    if (app.formationScreen) app.formationScreen.refresh();
};

window.saveDeck = () => {
    if (app && app.data) { app.data.saveDeck(); alert('デッキを保存しました'); }
};

window.clearFormation = () => {
    if (app.formationScreen) app.formationScreen.clear();
};