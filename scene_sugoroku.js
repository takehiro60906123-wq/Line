/**
 * scene_sugoroku.js - 栄冠ナイン式マスシステム v4
 * バグ修正 + 敵出現演出 + クリア回数スケーリング + 7ステージ
 * ★修正: 宝箱出現前の待ち時間を100msに短縮、全体テンポアップ
 */
class SugorokuScreen {
    constructor() {
        this.ui = new SugorokuUI(this);
        this.currentSquareIdx = 0;
        this.squares = [];
        this.deck = [];
        this.hand = [];
        this.selectedCardIdx = -1;
        this.isEventRunning = false;
        this.isGameActive = false;
        this.currentStageId = 1;
        this._resumeAfterBattle = false;
        this._isBossBattle = false;
        this._partyHpState = {}; // HP引継ぎ用 {uid: {hp, maxHp, isDead}}

        // ★ 冒険ログ（リザルト用）
        this.adventureLog = this._emptyLog();

         this.stageConfigs = this._loadStageConfigs();
    }



    _loadStageConfigs() {
        if (typeof SUGOROKU_STAGES !== 'undefined' && SUGOROKU_STAGES && Object.keys(SUGOROKU_STAGES).length > 0) {
            return SUGOROKU_STAGES;
        }

        console.warn('[Sugoroku] SUGOROKU_STAGES が未定義のためフォールバック設定を使用します');
        return {
            1: {
                name: '始まりの草原', totalSquares: 40, deckSize: 40,
                enemyLv: 5, bossLv: 10, bossId: 2,
                battleBg: 'images/bg_stage1.webp',
                sugorokuBattleBg: 'images/bg_stage1.webp',
                bgPath: 'images/stage/stage1/',
                layers: [
                    { file: 'layer1.webp', speed: 0.0, isFront: false },
                    { file: 'layer2.webp', speed: 0.1, isFront: false },
                    { file: 'layer3.webp', speed: 0.3, isFront: false },
                    { file: 'layer4.webp', speed: 0.6, isFront: false },
                    { file: 'layer5.webp', speed: 1.0, isFront: false },
                    { file: 'layer6.webp', speed: 1.2, isFront: true }
                ]
           
            }
        };
    }

    _emptyLog() {
        return { goldGained:0, gemsGained:0, candyGained:[], unitsGained:[],
                 battlesWon:0, battlesLost:0, squaresMoved:0, cardsUsed:0 };
    }

    // ========================================
    // ライフサイクル
    // ========================================
   onEnter(options = {}) {
    this.ui.setup('#screen-sugoroku');

    // ★修正: 戦闘から戻ってきた場合
    if (this._resumeAfterBattle) {
        this._resumeAfterBattle = false;
        this.resumeUI();
        // resumeUIで全て描画済み。スクロールとハイライトだけ後から実行
        setTimeout(() => {
            this.ui.scrollLaneToSquare(this.currentSquareIdx);
            this.ui.highlightReachableSquares(this.currentSquareIdx, this.hand);
        }, 150);

        // ★追加: 戦闘結果を受け取って後処理（勝利/敗北→クリア/ゲームオーバー等）
        if (options && options.fromBattle === true && typeof options.battleResult === 'boolean') {
            requestAnimationFrame(() => this.onBattleReturn(options.battleResult));
        }
        return;
    }

    this.loadStage(options.stageId || this.currentStageId);
}


    resumeUI() {
        const c = this.stageConfigs[this.currentStageId] || this.stageConfigs[1];
        this.ui.initStageView(c.layers, c.bgPath);
        this.ui.renderSquareLane(this.squares, this.currentSquareIdx);
        this.ui.renderHand(this.hand, this.deck.length);
        this.ui.updateGoalCounter(this.currentSquareIdx, this.squares.length);
        this.ui.syncParallax(this.currentSquareIdx);
    }

    loadStage(stageId) {
        this.currentStageId = stageId;
        const c = this.stageConfigs[stageId] || this.stageConfigs[1];
        this.currentSquareIdx = 0;
        this.selectedCardIdx = -1;
        this.isEventRunning = false;
        this.isGameActive = true;
        this._isBossBattle = false;
        this._partyHpState = {};
        this.adventureLog = this._emptyLog();

        this.generateSquares(c);
        this.generateDeck(c.deckSize);
        this.dealInitialHand();

        this.ui.initStageView(c.layers, c.bgPath);
        this.ui.renderSquareLane(this.squares, 0);
        this.ui.renderHand(this.hand, this.deck.length);
        this.ui.updateGoalCounter(0, this.squares.length);
        this.ui.syncParallax(0);
        this.ui.showMessage(c.name + ' スタート！');
        if (app.sound) app.sound.play('sys_decide');
        // ★追加: 初期ハイライト
        setTimeout(() => {
            this.ui.highlightReachableSquares(0, this.hand);
        }, 300);
    }

    updateCamera() {}
    onExit() { this.isGameActive = false; }

    // ========================================
    // マス生成（★ shop 追加）
    // ========================================
   generateSquares(config) {
        const N = config.totalSquares;
        this.squares = [];
        const mb1 = Math.floor(N * 0.33);
        const mb2 = Math.floor(N * 0.66);

        // 基本の重み付けリスト
        const W = [
            { type:'nothing',   w:12, color:'white', icon:'・', label:'' },
            { type:'gold',      w:14, color:'blue',  icon:'💰', label:'G' },
            { type:'candy',     w:11, color:'blue',  icon:'🍬', label:'アメ' },
            { type:'diamond',   w:5,  color:'gold',  icon:'💎', label:'ダイヤ' },
            { type:'gacha',     w:3,  color:'gold',  icon:'🎫', label:'ガチャ' },
            { type:'heal',      w:8,  color:'green', icon:'💚', label:'回復' },
            { type:'enemy',     w:12, color:'red',   icon:'⚔', label:'敵' },
            { type:'warp_fwd',  w:6,  color:'blue',  icon:'🌀', label:'前進' },
            { type:'warp_back', w:4,  color:'red',   icon:'💨', label:'後退' },
            { type:'gold_lose', w:4,  color:'red',   icon:'💸', label:'没収' },
            { type:'deck_bonus',w:4,  color:'blue',  icon:'🃏', label:'+3' },
            { type:'shop',      w:5,  color:'gold',  icon:'🛒', label:'ショップ' },
            // ▼▼▼ 新規マス ▼▼▼
            { type:'damage',    w:8,  color:'purple',icon:'☠️', label:'毒沼' },
            { type:'card_lose', w:5,  color:'red',   icon:'🕳️', label:'落とし穴' },
            { type:'equip_drop',w:6,  color:'gold',  icon:'🃏', label:'装備' }
        ];
        const tw = W.reduce((s, w) => s + w.w, 0);
        const pick = () => { let r = Math.random() * tw; for (const w of W) { r -= w.w; if (r <= 0) return w; } return W[0]; };

        // 1. まず通常生成
        for (let i = 0; i < N; i++) {
            if (i === 0) this.squares.push({ idx:i, type:'start', color:'white', icon:'🚩', label:'スタート' });
            else if (i === mb1 || i === mb2) this.squares.push({ idx:i, type:'enemy', color:'red', icon:'👹', label:'中ボス' });
            else if (i === N - 1) this.squares.push({ idx:i, type:'boss', color:'purple', icon:'💀', label:'BOSS' });
            else { const w = pick(); this.squares.push({ idx:i, type:w.type, color:w.color, icon:w.icon, label:w.label }); }
        }

        // 2. ギャンブルマスを1つだけランダムな位置に上書き（スタート・ボス・中ボス以外）
        // ※後半の方が出やすいように調整しても面白いですが、今回は完全ランダム
        let candidates = this.squares.filter(s => 
            s.type !== 'start' && s.type !== 'boss' && s.label !== '中ボス' && s.type !== 'shop'
        );
        if (candidates.length > 0) {
            const target = candidates[Math.floor(Math.random() * candidates.length)];
            target.type = 'gamble';
            target.color = 'gold';
            target.icon = '🎰';
            target.label = '賭場';
        }
    }

    // ========================================
    // デッキ・手札
    // ========================================
    generateDeck(size) {
        this.deck = [];
        for (let i = 0; i < size; i++) this.deck.push(Math.floor(Math.random() * 6) + 1);
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }
    dealInitialHand() { this.hand = []; for (let i = 0; i < 4; i++) if (this.deck.length > 0) this.hand.push(this.deck.pop()); }
    drawCard() { if (this.deck.length > 0 && this.hand.length < 4) { const c = this.deck.pop(); this.hand.push(c); return c; } return null; }

    // ========================================
    // カード選択
    // ========================================

    // ★追加: マスタップで移動（手札にその距離があれば移動）
 onSquareTap(targetIdx) {
    if (this.isEventRunning || !this.isGameActive) return;

    const dist = targetIdx - this.currentSquareIdx;
    if (dist <= 0) return;

    // まずは従来どおり「ぴったり」のカードを探す
    let handIndex = this.hand.indexOf(dist);

    // ★BOSS特例：ぴったりが無いなら「dist以上」の最小カードでOK
    if (handIndex === -1) {
        const sq = this.squares[targetIdx];
        if (sq && sq.type === 'boss') {
            let bestIdx = -1;
            let bestVal = Infinity;
            for (let i = 0; i < this.hand.length; i++) {
                const v = this.hand[i];
                if (v >= dist && v < bestVal) {
                    bestVal = v;
                    bestIdx = i;
                }
            }
            handIndex = bestIdx;
        }
    }

    if (handIndex === -1) return;
    this.confirmMove(handIndex);
}


    onCardSelect(handIndex) {
        if (this.isEventRunning || !this.isGameActive) return;
        if (handIndex < 0 || handIndex >= this.hand.length) return;
        this.confirmMove(handIndex);
    }

    async confirmMove(handIndex) {
        if (this.isEventRunning) return;
        this.isEventRunning = true;
        this.selectedCardIdx = -1;
        const moveVal = this.hand[handIndex];
        const target = Math.min(this.currentSquareIdx + moveVal, this.squares.length - 1);
        this.adventureLog.cardsUsed++;
        this.adventureLog.squaresMoved += (target - this.currentSquareIdx);

        this.hand.splice(handIndex, 1);
        this.ui.playCardUse(handIndex);
        if (app.sound) app.sound.play('sys_decide');
        await this.moveToSquare(target);
        this.ui.updateGoalCounter(this.currentSquareIdx, this.squares.length);

        await this.executeSquareEvent(this.squares[target]);
        if (!this.isGameActive) return;
        // ★修正: 戦闘に移行した場合はここで止める
        if (this._resumeAfterBattle) return;

        const nc = this.drawCard();
        this.ui.renderHand(this.hand, this.deck.length, nc !== null ? this.hand.length - 1 : -1);
        this.ui.renderSquareLane(this.squares, this.currentSquareIdx);
        // ★追加: カード使用後に必ずハイライト再適用
        setTimeout(() => {
            this.ui.scrollLaneToSquare(this.currentSquareIdx);
            this.ui.highlightReachableSquares(this.currentSquareIdx, this.hand);
        }, 100);
        if (this.hand.length === 0) { await this.sleep(500); this.gameOver('カードがなくなった！'); return; }
        this.isEventRunning = false;
    }

    // ========================================
    // 移動
    // ========================================
    // ========================================
    // 移動（サウンド完全版）
    // ========================================
    async moveToSquare(targetIdx) {
        const from = this.currentSquareIdx;
        if (from === targetIdx) return;

        // 1. 移動開始演出
        this.ui.setCharRunning(true);
        if (app.sound) app.sound.play('se_dash'); // ★ダッシュ音

        const steps = Math.abs(targetIdx - from);
        // 距離に応じて時間を調整（最低300ms、最大1200ms）
        const dur = Math.min(1200, 300 + steps * 120);
        
        const t0 = performance.now();
        let lastStepTime = 0; // 足音管理用
        const stepInterval = 250; // 足音の間隔(ms)

        await new Promise(res => {
            const anim = (now) => {
                const timePassed = now - t0;
                const p = Math.min(1, timePassed / dur);
                
                // イージング (EaseOutQuad: だんだんゆっくりになる)
                const e = 1 - (1 - p) * (1 - p);
                
                const currentPos = from + (targetIdx - from) * e;

                // 画面更新
                this.ui.syncParallax(currentPos);
                this.ui.updateLaneScroll(currentPos);

                // ★足音ループ処理
                // (移動中かつ、前回の足音から一定時間経過している場合)
                if (p < 1.0 && (now - lastStepTime > stepInterval)) {
                    // ※最初のフレーム(p=0付近)はダッシュ音とかぶるので避けるなどの微調整も可
                    if (app.sound) app.sound.play('se_run'); // ★足音
                    lastStepTime = now;
                }

                if (p < 1) {
                    requestAnimationFrame(anim);
                } else {
                    res();
                }
            };
            requestAnimationFrame(anim);
        });

        // 2. 到着確定
        this.currentSquareIdx = targetIdx;
        this.ui.setCharRunning(false);
        this.ui.renderSquareLane(this.squares, this.currentSquareIdx); // 位置ズレ補正

        // 3. 停止演出
        if (app.sound) app.sound.play('se_brake'); // ★停止音
    }

    // ========================================
    // イベント実行（★ shop 追加）
    // ========================================
    async executeSquareEvent(sq) {
        switch (sq.type) {
            case 'start': case 'nothing': 
                this.ui.showMessage('何もなかった…'); 
                await this.sleep(300); // ★テンポアップ: 600->300
                break;
            case 'gold': await this.doGoldGacha(); break;
            case 'diamond': await this.doDiamondGacha(); break;
            case 'candy': await this.doCandyGacha(); break;
            case 'gacha': await this.doFreeGacha(); break;
            case 'heal': await this.doHeal(); break;
            case 'enemy': await this.doEnemyBattle(sq); return;
            case 'boss': await this.doBossBattle(); return;
            case 'warp_fwd': await this.doWarp(true); break;
            case 'warp_back': await this.doWarp(false); break;
            case 'gold_lose': await this.doGoldLose(); break;
            case 'deck_bonus': await this.doDeckBonus(); break;
            case 'shop': await this.doCardShop(); break;
            // ▼▼▼ 新規イベント処理 ▼▼▼
            case 'gamble': await this.doGamble(); break;
            case 'damage': await this.doDamage(); break;
            case 'card_lose': await this.doCardLose(); break;
            case 'equip_drop': await this.doEquipCardDrop(); break;
        }
    }

    // ========================================
    // ★ 1. ギャンブルマス（ハイ＆ロー）
    // ========================================
   async doGamble() {
        this.ui.showMessage('🎰 賭場に到着！');
        if (app.sound) app.sound.play('sys_decide');
        await this.sleep(500);

        // 1. 参加確認
        const choice = await this.ui.showGambleEntryDialog();
        
        if (!choice) {
            this.ui.showMessage('勝負を降りた。');
            return;
        }

        // 2. 資金徴収
        const isGem = (choice === 'gem');
        const betAmount = isGem ? 100 : 1000;
        const maxReward = isGem ? 3200 : 32000;

        if (isGem) {
            if (app.data.gems < betAmount) { this.ui.showMessage('ダイヤが足りない…'); return; }
            app.data.consumeGems(betAmount);
        } else {
            if (app.data.gold < betAmount) { this.ui.showMessage('ゴールドが足りない…'); return; }
            app.data.consumeGold(betAmount);
        }

        // 3. ゲーム開始
        let currentReward = betAmount;
        let winCount = 0;
        let isGameActive = true;
        let currentNum = Math.floor(Math.random() * 13) + 1;

        while (isGameActive) {
            // UI表示 (High/Low/Drop選択)
            const result = await this.ui.showHighLowGame(currentNum, currentReward, winCount, isGem);

            // ▼ ドロップ（降りる）
            if (result === 'drop') {
                // 先にUIを閉じる
                await this.ui.closeGambleUI();

                this.ui.showMessage(`勝負あり！ ${currentReward.toLocaleString()} ${isGem?'ダイヤ':'G'} 獲得！`);
                if(isGem) app.data.addGems(currentReward);
                else app.data.addGold(currentReward);
                if (app.sound) app.sound.play('sys_gacha_open');
                return; // 終了
            }

            // ▼ 勝負続行
            let nextNum = Math.floor(Math.random() * 13) + 1;
            while(nextNum === currentNum) { nextNum = Math.floor(Math.random() * 13) + 1; }

            // 結果演出
            await this.ui.showHighLowResult(nextNum);

            const isHigh = (result === 'high');
            const isWin = (isHigh && nextNum > currentNum) || (!isHigh && nextNum < currentNum);

            if (isWin) {
                if (app.sound) app.sound.play('sys_decide');
                currentReward *= 2;
                winCount++;
                currentNum = nextNum;

                // 上限チェック
                if (currentReward >= maxReward) {
                    await this.sleep(500);
                    // UIを閉じてから結果表示
                    await this.ui.closeGambleUI();

                    this.ui.showMessage(`🎉 上限到達！ ${currentReward.toLocaleString()} ${isGem?'ダイヤ':'G'} 獲得！`);
                    if(isGem) app.data.addGems(currentReward);
                    else app.data.addGold(currentReward);
                    if (app.sound) app.sound.play('sys_gacha_open');
                    return; // 終了
                }
            } else {
                // 負け
                if (app.sound) app.sound.play('sys_danger');
                await this.sleep(1000); // 少し間をおく
                
                // ★修正: 負けた場合もUIを閉じる
                await this.ui.closeGambleUI();

                this.ui.showMessage('残念… 没収です。');
                isGameActive = false; // ループを抜ける
            }
        }
    }
    // ========================================
    // ★ 2. ダメージマス（毒沼）
    // ========================================
    async doDamage() {
        if (app.sound) app.sound.play('sys_danger');
        await this.ui.showDamageEffect(); 
        
        // パーティ全員のHPを20%削る
        if (this._partyHpState) {
            Object.keys(this._partyHpState).forEach(uid => {
                const s = this._partyHpState[uid];
                if (!s.isDead && s.hp > 1) {
                    const dmg = Math.floor(s.maxHp * 0.2);
                    s.hp = Math.max(1, s.hp - dmg);
                }
            });
        }
        
        // ★テキスト変更
        this.ui.showMessage(`💥 罠を踏んでしまった！ パーティがダメージを受けた…`);
    }

    // ========================================
    // ★ 3. カード没収マス（転倒）
    // ========================================
   async doCardLose() {
        if (app.sound) app.sound.play('sys_danger');
        
        // ★修正: 手札(hand)ではなく山札(deck)を減らす
        // 3〜5枚くらい減らす
        const lostCount = 3 + Math.floor(Math.random() * 3); // 3~5枚
        
        // 実際に削除
        // ※ this.deck は数値の配列 [1, 5, 3...]
        const actualLost = Math.min(this.deck.length, lostCount);
        this.deck.splice(0, actualLost);
        
        // 演出
        await this.ui.showCardLostEffect(actualLost); 
        
        // UI更新（デッキ残数を更新）
        this.ui.renderHand(this.hand, this.deck.length);

        if (actualLost > 0) {
            this.ui.showMessage(`転んで 山札のカードを ${actualLost}枚 落としてしまった！`);
        } else {
            this.ui.showMessage(`転んでしまった！ ...が、山札はもう無かった。`);
        }
    }
   // ========================================
    // 各イベント（★宝箱演出調整版）
    // ========================================
   async doGoldGacha() {
        const a = [100,200,300,500,800,1000,1500,2000][Math.floor(Math.random()*8)];
        if (app.data) app.data.addGold(a);
        this.adventureLog.goldGained += a;
        if (app.sound) app.sound.play('sys_gacha_open');
        
        await this.sleep(100);
        
        // フィールド上で宝箱演出（完了まで待機）
        await this.ui.showTreasureBox('gold');

        // ★削除: 余韻のwaitは不要になったため削除
        // await this.sleep(500);

        // 結果表示UIへ直行
        await this.ui.showRewardOverlay('', `${a.toLocaleString()} G`, 'gold', 'images/sg_icon_gold.webp');
    }

    async doDiamondGacha() {
        const a = [50,100,150,200,300,500][Math.floor(Math.random()*6)];
        if (app.data) app.data.addGems(a);
        this.adventureLog.gemsGained += a;
        if (app.sound) app.sound.play('sys_gacha_open');
        
        await this.sleep(100);
        
        await this.ui.showTreasureBox('diamond');

        // ★削除
        // await this.sleep(500);

        await this.ui.showRewardOverlay('', `${a} ダイヤ`, 'diamond', 'images/sg_icon_diamond.webp');
    }

    async doCandyGacha() {
        if (typeof DB === 'undefined' || DB.length === 0) return;
        const u = DB[Math.floor(Math.random()*DB.length)];
        const c = 1 + Math.floor(Math.random()*3);
        if (app.data) { app.data.addCandy(u.id, c); app.data.save(); }
        this.adventureLog.candyGained.push({ name:u.name, id:u.id, count:c });
        if (app.sound) app.sound.play('sys_gacha_open');
        const img = (typeof IMG_DATA !== 'undefined' && IMG_DATA[u.id]) ? IMG_DATA[u.id] : '';
        
        await this.sleep(100);
        
        await this.ui.showTreasureBox('candy');

        // ★削除
        // await this.sleep(500);

        await this.ui.showRewardOverlay('', `${u.name}のアメ x${c}`, 'candy', 'images/sg_icon_candy.webp');
    }
    async doHeal() {
        if (app.sound) app.sound.play('sys_heal');
        // ★パーティHP全回復
        Object.keys(this._partyHpState).forEach(uid => {
            const s = this._partyHpState[uid];
            s.hp = s.maxHp;
            s.isDead = false;
        });
        await this.ui.showRewardOverlay('💚', 'パーティ全回復！', 'heal');
    }
    async doWarp(fwd) {
        if (fwd) {
            const d = 2 + Math.floor(Math.random()*4);
            const t = Math.min(this.currentSquareIdx + d, this.squares.length - 2);
            this.ui.showMessage('🌀 ワープ！ ' + d + 'マス前進！');
            this.adventureLog.squaresMoved += (t - this.currentSquareIdx);
            if (app.sound) app.sound.play('sys_decide');
            await this.sleep(500);
            await this.moveToSquare(t);
            this.ui.updateGoalCounter(this.currentSquareIdx, this.squares.length);
            const ls = this.squares[t];
            if (ls.type !== 'start' && ls.type !== 'nothing') await this.executeSquareEvent(ls);
        } else {
            const d = 1 + Math.floor(Math.random()*2);
            const t = Math.max(0, this.currentSquareIdx - d);
            this.ui.showMessage('💨 突風！ ' + d + 'マス後退！');
            if (app.sound) app.sound.play('sys_danger');
            await this.sleep(500);
            this.ui.setCharRunning(true);
            const from = this.currentSquareIdx, dur = 600, t0 = performance.now();
            await new Promise(res => {
                const a = (now) => { const p = Math.min(1,(now-t0)/dur); this.ui.syncParallax(from+(t-from)*p); this.ui.updateLaneScroll(from+(t-from)*p); if(p<1) requestAnimationFrame(a); else res(); };
                requestAnimationFrame(a);
            });
            this.currentSquareIdx = t;
            this.ui.setCharRunning(false);
            this.ui.renderSquareLane(this.squares, this.currentSquareIdx);
            this.ui.updateGoalCounter(this.currentSquareIdx, this.squares.length);
        }
    }
    async doGoldLose() {
        const a = Math.floor((app.data ? app.data.gold : 0) * 0.1);
        if (app.data && a > 0) app.data.consumeGold(a);
        if (app.sound) app.sound.play('sys_danger');
        await this.ui.showRewardOverlay('💸', `${a.toLocaleString()} G 没収…`, 'lose');
    }
    async doDeckBonus() {
        for (let i = 0; i < 3; i++) this.deck.push(Math.floor(Math.random()*6)+1);
        if (app.sound) app.sound.play('sys_gacha_open');
       await this.ui.showRewardOverlay('', 'カード +3枚！', 'deck', 'images/sg_icon_deck_bonus.webp');
    }

    // ========================================
    // ★装備カードドロップイベント
    // ========================================
    async doEquipCardDrop() {
        if (!app.data || !app.data.cardManager) {
            this.ui.showMessage('カードシステム未初期化');
            return;
        }

        // ステージレベルに応じてドロップ品質を補正
        const stageId = this.currentStageId || 1;
        const options = {};
        // 高難度ステージほど高レベルカードが出やすい（紫の確率も微増）
        if (stageId >= 5) {
            // 後半ステージ: 紫確率UP
            if (Math.random() < 0.08 * stageId) options.color = 'purple';
        }

        const card = app.data.dropCard(options);

        if (!card) {
            // インベントリ上限
            if (app.sound) app.sound.play('sys_danger');
            await this.ui.showRewardOverlay('📦', '装備カードが上限です！\n分解して空きを作ろう', 'lose');
            return;
        }

        if (app.sound) app.sound.play('sys_gacha_open');
        await this.sleep(100);
        await this.ui.showTreasureBox('diamond');

        // カード情報の表示用テキスト
        const colorInfo = (typeof CARD_COLORS !== 'undefined') 
            ? Object.values(CARD_COLORS).find(c => c.id === card.color) 
            : null;
        const effectDef = (typeof CARD_EFFECTS !== 'undefined') ? CARD_EFFECTS[card.effectType] : null;
        const colorIcon = colorInfo ? colorInfo.icon : '🃏';
        const effectName = effectDef ? effectDef.name : card.effectType;
        const rank = app.data.cardManager.getCardRank(card);

        // 冒険ログに記録
        if (!this.adventureLog.cardsDropped) this.adventureLog.cardsDropped = [];
        this.adventureLog.cardsDropped.push({ name: effectName, color: card.color, level: card.level });

        await this.ui.showRewardOverlay(
            colorIcon, 
            `${effectName} Lv.${card.level} [${rank}]`, 
            card.level >= 16 ? 'diamond' : 'gold'
        );
    }

    // ========================================
    // ★追加: ガチャマス用イベント（消えていた場合はここに追加）
    // ========================================
    async doFreeGacha() {
        // DB（キャラデータ）がない場合は中断
        if (typeof DB === 'undefined' || DB.length === 0) return;

        // --- 抽選ロジック ---
        let pool; const r = Math.random();
        if (r < 0.05) pool = DB.filter(u => u.cost >= 5); // 5% UR
        else if (r < 0.25) pool = DB.filter(u => u.cost >= 3 && u.cost <= 4); // 20% SR
        else pool = DB.filter(u => u.cost <= 2); // 75% R
        
        if (!pool || pool.length === 0) pool = DB;
        const u = pool[Math.floor(Math.random()*pool.length)];

        // --- データ反映 ---
        if (app.data) app.data.addUnit(u.id, true);
        this.adventureLog.unitsGained.push({ name:u.name, id:u.id, cost:u.cost });

        if (app.sound) app.sound.play('sys_gacha_open');
        
        // --- 演出 ---
        await this.sleep(100);

        // ★ここにも新しい宝箱スライド演出を適用（ガチャなので豪華にGold）
        await this.ui.showTreasureBox('gacha');

        const img = (typeof IMG_DATA !== 'undefined' && IMG_DATA[u.id]) ? IMG_DATA[u.id] : '';
        const rl = u.cost >= 5 ? 'UR' : u.cost >= 3 ? 'SR' : 'R';
        
        // 結果表示
        await this.ui.showRewardOverlay('🎫', `【${rl}】${u.name} 加入！`, 'gacha', img);
    }

   // ========================================
    // ★追加: カードショップイベント（キャラ・アメ販売対応版）
    // ========================================
    async doCardShop() {
        this.ui.showMessage('🛒 ショップ発見！');
        if (app.sound) app.sound.play('sys_decide');
        
        await this.sleep(300);

        const shopItems = this._generateShopItems();
        const gold = app.data ? app.data.gold : 0;
        const gems = app.data ? app.data.gems : 0;

        // ショップUIを開く
        await this.ui.showCardShop(shopItems, gold, gems, (item) => {
            // --- 購入処理 ---
            let success = false;
            
            if (item.currency === 'gold') {
                if (app.data && app.data.gold >= item.price) {
                    app.data.consumeGold(item.price);
                    success = true;
                }
            } else {
                if (app.data && app.data.gems >= item.price) {
                    app.data.consumeGems(item.price);
                    success = true;
                }
            }

            if (success) {
                this._applyShopItem(item);
                if (app.sound) app.sound.play('sys_gacha_open'); // 購入音
                return true;
            } else {
                if (app.sound) app.sound.play('sys_danger'); // 資金不足
                return false;
            }
        });
    }

    // 商品リスト生成（キャラ、アメ、移動カード、デッキ補充）
    _generateShopItems() {
        const items = [];
        
        // 1. キャラクター販売 (Unit)
        if (typeof DB !== 'undefined' && DB.length > 0) {
            // ランダムに1体選出
            // 確率でレア度変化 (10%で高レア・ダイヤ販売)
            const r = Math.random();
            let pool, rarityLabel, price, currency;
            
            if (r < 0.15) { 
                // UR/SSR級 (ダイヤ販売)
                pool = DB.filter(u => u.cost >= 4);
                rarityLabel = 'SSR+';
                price = 300; 
                currency = 'gem';
            } else if (r < 0.5) { 
                // SR級 (ゴールド販売・高額)
                pool = DB.filter(u => u.cost === 3);
                rarityLabel = 'SR';
                price = 5000; 
                currency = 'gold';
            } else {
                // R級 (ゴールド販売・手頃)
                pool = DB.filter(u => u.cost <= 2);
                rarityLabel = 'R';
                price = 1500; 
                currency = 'gold';
            }
            
            if (!pool || pool.length === 0) pool = DB;
            const u = pool[Math.floor(Math.random() * pool.length)];
            const img = (typeof IMG_DATA !== 'undefined' && IMG_DATA[u.id]) ? IMG_DATA[u.id] : null;

            items.push({
                id: 'shop_unit_' + u.id,
                type: 'unit',
                label: u.name,
                desc: `【${rarityLabel}】ユニット加入`,
                value: u.id, // unitId
                cost: u.cost,
                price: price,
                currency: currency,
                img: img, // 顔アイコン用
                icon: '👤' // 画像がない場合のフォールバック
            });
        }

        // 2. アメ販売 (Candy)
        if (typeof DB !== 'undefined' && DB.length > 0) {
             const u = DB[Math.floor(Math.random() * DB.length)];
             const count = 5 + Math.floor(Math.random() * 6); // 5~10個
             const img = (typeof IMG_DATA !== 'undefined' && IMG_DATA[u.id]) ? IMG_DATA[u.id] : null;

             items.push({
                 id: 'shop_candy_' + u.id,
                 type: 'candy',
                 label: `${u.name}のアメ`,
                 desc: `覚醒アイテム x${count}`,
                 value: u.id,
                 count: count,
                 price: 2000,
                 currency: 'gold',
                 img: img,
                 icon: '🍬'
             });
        }

        // 3. 移動カード (1枠確保: ゲーム進行用)
        const moveVal = 4 + Math.floor(Math.random() * 3); // 4~6
        items.push({ 
            id: 'shop_card_move', 
            type: 'card', 
            label: `${moveVal}マスカード`, 
            desc: `手札に「${moveVal}」を追加`,
            value: moveVal, 
            price: 500, 
            currency: 'gold', 
            icon: '🃏' 
        });

        // 4. デッキ補充 (固定枠)
        items.push({ 
            id: 'deck_refill', 
            type: 'deck', 
            label: 'デッキ補充 +5', 
            desc: '山札にカードを5枚追加',
            value: 5, 
            price: 1000, 
            currency: 'gold', 
            icon: '📦' 
        });

        return items;
    }

    // 購入アイテムの適用
    _applyShopItem(item) {
        if (item.type === 'unit') {
            // キャラクター加入
            if (app.data) app.data.addUnit(item.value, true);
            this.adventureLog.unitsGained.push({ name:item.label, id:item.value, cost:item.cost });
            this.ui.showMessage(`${item.label} が仲間になった！`);
        }
        else if (item.type === 'candy') {
            // アメ入手
            if (app.data) {
                app.data.addCandy(item.value, item.count);
                app.data.save();
            }
            this.adventureLog.candyGained.push({ name:item.label.replace('のアメ',''), id:item.value, count:item.count });
            this.ui.showMessage(`${item.label} x${item.count} GET！`);
        }
        else if (item.type === 'card') { 
            // 移動カード
            if (this.hand.length < 4) this.hand.push(item.value); 
            else this.deck.push(item.value); 
            this.ui.renderHand(this.hand, this.deck.length);
        }
        else if (item.type === 'deck') { 
            // デッキ補充
            for (let i = 0; i < item.value; i++) this.deck.push(Math.floor(Math.random()*6)+1); 
            this.ui.renderHand(this.hand, this.deck.length);
        }
    }

    // ========================================
    // 戦闘（★ 敵出現演出 + スケーリング対応）
    // ========================================
    async doEnemyBattle(sq) {
        const c = this.stageConfigs[this.currentStageId] || this.stageConfigs[1];
        const lv = this._scaledEnemyLv(c.enemyLv || 10);
        const playerCount = app.data.deck ? app.data.deck.length : 4;
        const isMidBoss = (sq.label === '中ボス');
        const enemyId = isMidBoss ? 8 : 1;
        
        // ★登場音
        if (app.sound) app.sound.play('se_enemy_appear');

        // ▼▼▼ ここを修正（isMidBoss だけを渡す） ▼▼▼
         await this.ui.showEnemyEntrance(enemyId, isMidBoss);
        // ▲▲▲ 修正ここまで ▲▲▲
        
        // ★戦闘移行音
        if (app.sound) app.sound.play('se_encounter');
        await this.sleep(400);

        this.startBattle({ 
            enemyLv: isMidBoss ? Math.floor(lv*1.5) : lv, 
            fixedEnemyId: enemyId, 
             bgImg: c.sugorokuBattleBg || c.battleBg || 'images/bg_battle.webp',
            playerCount: playerCount
        });
    }
    async doBossBattle() {
        const c = this.stageConfigs[this.currentStageId] || this.stageConfigs[1];
        const bossLv = this._scaledEnemyLv(c.bossLv || c.enemyLv + 10);
        const playerCount = app.data.deck ? app.data.deck.length : 4;
        
        // ★登場音
        if (app.sound) {
            app.sound.play('thunder');
            setTimeout(() => app.sound.play('se_enemy_appear'), 200); 
        }

        // ▼▼▼ ここを修正（true だけを渡す） ▼▼▼
        await this.ui.showEnemyEntrance(c.bossId || 14, true);
        // ▲▲▲ 修正ここまで ▲▲▲
        
        // ★戦闘移行音
        if (app.sound) app.sound.play('se_encounter');
        await this.sleep(400);

        this._isBossBattle = true;

        this.startBattle({ 
            enemyLv: bossLv, 
            fixedEnemyId: c.bossId||14, 
            bgImg: c.sugorokuBattleBg || c.battleBg || 'images/bg_battle.webp',
            playerCount: playerCount,
            isBossBattle: true
        });
    }
   startBattle(options) {
    this._resumeAfterBattle = true;
    options.sugorokuHpState = this._partyHpState;
    options.sugorokuMode = true;

    // ★戦闘リザルト閉じた後：双六へ戻すだけ（勝敗は options に載せる）
    window.battleCallback = (isWin) => {
        window.battleCallback = null;
        app.changeScene('screen-sugoroku', { fromBattle: true, battleResult: !!isWin });
    };

    app.changeScene('screen-battle');
    if (app.battleScreen) app.battleScreen.start(options);
}

    onBattleReturn(isWin) {
        // ★ 戦闘後のHP状態を保存
        if (app.battleScreen && app.battleScreen.state) {
            const playerUnits = app.battleScreen.state.units.filter(u => u.side === 'player');
            playerUnits.forEach(u => {
                this._partyHpState[u.uid] = {
                    hp: u.isDead ? 1 : Math.max(1, u.battleHp),
                    maxHp: u.maxHp,
                    isDead: false
                };
            });
        }

        if (isWin) {
            this.adventureLog.battlesWon++;
            if (this._isBossBattle) { this._isBossBattle = false; this.gameClear(); return; }
            this.ui.showMessage('⚔ 戦闘勝利！');
            if (app.sound) app.sound.play('sys_clear');
            // ★戦闘勝利時: 30%の確率で装備カードドロップ
            if (app.data && app.data.cardManager && Math.random() < 0.30) {
                const card = app.data.dropCard();
                if (card) {
                    const effectDef = (typeof CARD_EFFECTS !== 'undefined') ? CARD_EFFECTS[card.effectType] : null;
                    const name = effectDef ? effectDef.name : '???';
                    if (!this.adventureLog.cardsDropped) this.adventureLog.cardsDropped = [];
                    this.adventureLog.cardsDropped.push({ name, color: card.color, level: card.level });
                    setTimeout(() => this.ui.showMessage(`🃏 ${name} Lv.${card.level} をドロップ！`), 800);
                }
            }
        } else {
            this.adventureLog.battlesLost++;
            this._isBossBattle = false;
            this.gameOver('戦闘に敗北した…');
            return;
        }
        const nc = this.drawCard();
        this.ui.renderHand(this.hand, this.deck.length, nc !== null ? this.hand.length - 1 : -1);
        this.ui.renderSquareLane(this.squares, this.currentSquareIdx);
        // ★修正: 戦闘後にスクロール＆ハイライト
        setTimeout(() => {
            this.ui.scrollLaneToSquare(this.currentSquareIdx);
            this.ui.highlightReachableSquares(this.currentSquareIdx, this.hand);
        }, 150);
        if (this.hand.length === 0) { setTimeout(() => this.gameOver('カードがなくなった！'), 1000); return; }
        this.isEventRunning = false;
    }

    // ========================================
    // ゲーム終了 → リザルト（★スケーリング対応）
    // ========================================
    gameClear() {
        this.isGameActive = false;
        this.isEventRunning = true;
        if (app.sound) app.sound.play('sys_clear');
        const c = this.stageConfigs[this.currentStageId] || this.stageConfigs[1];
        // ★クリア回数＆スケーリング報酬
        const cc = this._getClearCount();
        const reward = this._scaledReward(5000, 1000);
        if (app.data) {
            app.data.addGems(reward.gems);
            app.data.addGold(reward.gold);
            app.data.completeStage(this.currentStageId);
            if (!app.data.stageClearCounts) app.data.stageClearCounts = {};
            app.data.stageClearCounts[this.currentStageId] = (app.data.stageClearCounts[this.currentStageId] || 0) + 1;

            // ★ステージクリア確定報酬: 装備カード1枚（ステージが高いほど高レベル）
            if (app.data.cardManager) {
                const minLv = Math.min(10, this.currentStageId * 2);  // Stage1=2, Stage7=14
                const level = minLv + Math.floor(Math.random() * (20 - minLv + 1));
                const card = app.data.dropCard({ level: Math.min(20, level) });
                if (card) {
                    const effectDef = (typeof CARD_EFFECTS !== 'undefined') ? CARD_EFFECTS[card.effectType] : null;
                    const name = effectDef ? effectDef.name : '???';
                    if (!this.adventureLog.cardsDropped) this.adventureLog.cardsDropped = [];
                    this.adventureLog.cardsDropped.push({ name, color: card.color, level: card.level });
                }
            }

            app.data.save();
        }
        this.adventureLog.gemsGained += reward.gems;
        this.adventureLog.goldGained += reward.gold;
        this.adventureLog.clearCount = cc + 1;
        this.adventureLog.nextEnemyLv = this._scaledEnemyLv(c.enemyLv || 10);
        this.adventureLog.nextReward = this._scaledReward(5000, 1000);
        this.ui.showResultScreen(true, c.name, this.adventureLog, () => { app.changeScene('screen-home'); });
    }
    gameOver(reason) {
        this.isGameActive = false;
        this.isEventRunning = true;
        if (app.sound) app.sound.play('sys_danger');
        this.ui.showResultScreen(false, reason, this.adventureLog, () => { app.changeScene('screen-home'); });
    }

    // ========================================
    // ★ スケーリングヘルパー
    // ========================================
    _getClearCount() {
        if (app.data && app.data.stageClearCounts) return app.data.stageClearCounts[this.currentStageId] || 0;
        return 0;
    }
    _scaledEnemyLv(baseLv) {
        const cc = this._getClearCount();
        return Math.floor(baseLv * (1 + cc * 0.15));
    }
    _scaledReward(baseGold, baseGem) {
        const cc = this._getClearCount();
        return { gold: Math.floor(baseGold * (1 + cc * 0.2)), gems: Math.floor(baseGem * (1 + cc * 0.1)) };
    }

    // ★ すごろく中断確認
    confirmGoHome() {
        if (!this.isGameActive) { app.changeScene('screen-home'); return; }
        this.ui.showQuitConfirm(() => {
            this.isGameActive = false;
            this.isEventRunning = true;
            app.changeScene('screen-home');
        });
    }

    sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}