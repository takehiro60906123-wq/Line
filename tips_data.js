/**
 * tips_data.js - TIPS定義 + トランジション画面UI
 * 
 * 旧: managers.js SceneManager内の以下を分離
 *   - getRandomTipContent() → TIPS_CONTENT配列 + TransitionUI.getRandomTip()
 *   - setupTransitionLayer() → TransitionUI.setup() + TransitionUI.STYLE
 * 
 * TIPS追加時はこのファイルのTIPS_CONTENTに追加するだけでOK
 */

// ============================================================
// TIPS コンテンツ定義（データのみ）
// ============================================================
const TIPS_CONTENT = [
    {
        title: "属性相関図",
        html: `
            <div class="type-chart-container">
                <div class="chart-row">
                    <span class="type-badge t0">👼神</span><span class="chart-arrow">▶</span>
                    <span class="type-badge t1">👑覇王</span><span class="chart-arrow">▶</span>
                    <span class="type-badge t2">👸姫</span>
                </div>
                <div class="chart-mid-arrows"><span class="chart-arrow-up">▲</span><span class="chart-arrow-down">▼</span></div>
                <div class="chart-row">
                    <span class="type-badge t5">👻妖怪</span><span class="chart-arrow">◀</span>
                    <span class="type-badge t4">⚙️豪族</span><span class="chart-arrow">◀</span>
                    <span class="type-badge t3">⚔️武将</span>
                </div>
            </div>
            <div class="tips-desc">有利属性で <span style="color:#ffd700;">ダメージ1.5倍</span>！ </div>
        `
    },
    {
        title: "前衛の守り",
        html: `
            <div class="formation-tip-visual">
                <div class="f-row"><div class="f-cell enemy">敵</div></div>
                <div class="f-arrow">通常 ▶</div>
                <div class="f-row">
                    <div class="f-cell front active">🛡️前衛</div>
                    <div class="f-cell back safe">後衛</div>
                </div>
            </div>
            <div class="tips-desc">
                前列に味方がいる限り<br>
                後列への<span style="color:#00ced1;">通常攻撃は届かない</span>！ 
            </div>
        `
    },
    {
        title: "スキルの射程",
        html: `
            <div class="formation-tip-visual">
                <div class="f-row"><div class="f-cell enemy cast">敵</div></div>
                <div class="f-arrow skill">⚡SKILL ▶▶</div>
                <div class="f-row">
                    <div class="f-cell front">前衛</div>
                    <div class="f-cell back hit">💥後衛</div>
                </div>
            </div>
            <div class="tips-desc">
                通常攻撃とは違い、<br>
                <span style="color:#ffeb3b;">攻撃スキル</span>は<span style="color:#ff6666;">後衛を直接狙える</span>！ 
            </div>
        `
    },
    {
        title: "スキルの発動率",
        html: `
            <div class="skill-tip-visual">
                <div class="skill-icon">⚡SKILL CHANCE</div>
                <div class="skill-bar">
                    <div class="sb-base">基本率</div>
                    <div class="sb-plus">+ Lv補正</div>
                </div>
            </div>
            <div class="tips-desc">
                スキルLvを上げると<br>
                <span style="color:#ff6666;">発動率</span>と<span style="color:#ff6666;">威力</span>が上昇！ 
            </div>
        `
    },
    {
        title: "睡眠と大ダメージ",
        html: `
            <div class="status-tip-visual">
                <div class="f-cell enemy status-sleep">💤Sleep</div>
                <div class="f-arrow big-dmg">💥Dmg 1.5x</div>
            </div>
            <div class="tips-desc">
                睡眠中の相手への攻撃は<br>
                <span style="color:#ffd700;">ダメージ1.5倍</span>＋<span style="color:#aaa;">叩くと起きる</span>！ 
            </div>
        `
    },
    {
        title: "素早さの重要性",
        html: `
            <div class="spd-tip-visual">
                <div class="spd-row fast">
                    <span class="spd-val">SPD 150</span>
                    <span class="spd-bar b-fast">First! ⏩</span>
                </div>
                <div class="spd-row slow">
                    <span class="spd-val">SPD 100</span>
                    <span class="spd-bar b-slow">Wait...</span>
                </div>
            </div>
            <div class="tips-desc">
                行動順は<span style="color:#00ced1;">SPD(素早さ)</span>で決まる。<br>
                先手を取って戦局を支配せよ！ 
            </div>
        `
    },
    {
        title: "図鑑報酬でジェムGET",
        html: `
            <div class="zukan-tip-visual">
                <div class="zukan-char-box">
                    <span class="zukan-new-badge">NEW!</span>
                    <div class="zukan-char-silhouette">?</div>
                </div>
                <div class="zukan-arrow">➡</div>
                <div class="zukan-gem-box">
                    <div class="zukan-gem">💎</div>
                    <div class="zukan-get-text">GET!</div>
                </div>
            </div>
            <div class="tips-desc">
                新キャラを入手したら<br>
                <span style="color:#00ffff;">図鑑</span>を開こう！<span style="color:#ffd700;">ジェム</span>が貰えるぞ！ 
            </div>
        `
    }
];

// ============================================================
// トランジションUI（DOM生成・スタイル管理）
// ============================================================
class TransitionUI {

    /** ランダムなTIPSを1つ返す */
    static getRandomTip() {
        return TIPS_CONTENT[Math.floor(Math.random() * TIPS_CONTENT.length)];
    }

    /** トランジションレイヤーのDOM + styleを生成してbodyに追加 */
    static setup() {
        if (document.getElementById('dynamic-transition-layer')) return;
        if (!document.body) return;

        const tip = TransitionUI.getRandomTip();

        // --- DOM ---
        const layer = document.createElement('div');
        layer.id = 'dynamic-transition-layer';
        layer.innerHTML = `
            <div class="loading-center-panel">
                <div class="tips-header">TIPS: ${tip.title}</div>
                <div class="tips-body-container">${tip.html}</div>
            </div>
            <div class="loading-bottom-right">
                <div class="loading-text-mini">Now Loading...</div>
                <img src="images/loading_run.webp" alt="running" class="mini-runner">
            </div>
        `;
        document.body.appendChild(layer);

        // --- Style ---
        const style = document.createElement('style');
        style.id = 'dynamic-transition-style';
        style.innerHTML = TransitionUI.STYLE;
        document.head.appendChild(style);
    }

    /** トランジションレイヤーとスタイルを削除 */
    static cleanup() {
        const layer = document.getElementById('dynamic-transition-layer');
        if (layer) layer.remove();
        const style = document.getElementById('dynamic-transition-style');
        if (style) style.remove();
    }
}

/** トランジション画面用CSS */
TransitionUI.STYLE = `
    #dynamic-transition-layer {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background-color: #000; z-index: 99999; 
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        pointer-events: none; opacity: 0; transition: opacity 0.3s ease; 
    }
    #dynamic-transition-layer.active { opacity: 1; pointer-events: auto; }

    .loading-center-panel {
        width: 85%; max-width: 380px; height: 220px;
        background: rgba(30, 30, 30, 0.9);
        border: 2px solid #555; border-radius: 12px;
        padding: 15px; display: flex; flex-direction: column; align-items: center;
        box-shadow: 0 0 20px rgba(0,0,0,0.8);
    }
    .tips-header {
        font-size: 16px; font-weight: bold; color: #00ced1;
        margin-bottom: 15px; letter-spacing: 2px;
        border-bottom: 2px solid #00ced1; padding-bottom: 4px; width: 100%; text-align: center;
    }
    .tips-body-container {
        flex: 1; display: flex; flex-direction: column; 
        align-items: center; justify-content: center; width: 100%;
    }
    .tips-desc { 
        font-size: 14px; color: #ddd; font-weight: bold; 
        text-align: center; line-height: 1.6; margin-top: 10px;
    }

    .type-chart-container { display: flex; flex-direction: column; align-items: center; gap: 5px; }
    .chart-row { display: flex; align-items: center; gap: 5px; }
    .chart-mid-arrows { display: flex; justify-content: space-between; width: 100%; padding: 0 10px; box-sizing: border-box; }
    .type-badge { font-size: 11px; font-weight: bold; color: #fff; padding: 4px 6px; border-radius: 4px; border: 1px solid #fff; min-width: 45px; text-align: center; }
    .t0 { background: #e100ff; } .t1 { background: #ff8c00; } .t2 { background: #ff69b4; } 
    .t3 { background: #4caf50; } .t4 { background: #607d8b; } .t5 { background: #795548; }
    .chart-arrow, .chart-arrow-up, .chart-arrow-down { color: #aaa; font-size: 10px; }

    .formation-tip-visual, .status-tip-visual { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
    .f-row { display: flex; gap: 4px; }
    .f-cell { width: 45px; height: 45px; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold; color: #fff; border: 1px solid #555; background: #222; transition: all 0.2s; }
    
    .f-cell.enemy { background: #a00; border-color: #f55; }
    .f-cell.enemy.cast { animation: enemyCast 0.5s infinite alternate; box-shadow: 0 0 10px #ff00ff; border-color: #ff00ff; }
    .f-cell.front { background: #008888; border-color: #00aaaa; }
    .f-cell.front.active { background: #00ced1; border-color: #fff; color: #000; box-shadow: 0 0 10px #00ced1; z-index: 2; transform: scale(1.1); }
    .f-cell.back { background: #004488; border-color: #5588cc; opacity: 0.6; }
    .f-cell.back.safe { color: #88ccff; }
    .f-cell.back.hit { background: #ff4444; border-color: #ffaaaa; color: #fff; opacity: 1; animation: shakeHit 0.3s infinite; box-shadow: 0 0 10px #f00; }
    
    .f-arrow { color: #aaa; font-weight: bold; font-size: 10px; white-space: nowrap; }
    .f-arrow.skill { color: #ffeb3b; text-shadow: 0 0 5px #ff8c00; font-size: 11px; animation: slideArrowSkill 0.5s infinite; }
    
    .f-cell.status-sleep { background: #663399; border-color: #cc99ff; animation: pulseSleep 1.5s infinite; }
    .f-arrow.big-dmg { color: #ffd700; font-size: 14px; font-weight: 900; text-shadow: 0 0 5px #f00; }

    .spd-tip-visual { width: 90%; display: flex; flex-direction: column; gap: 8px; }
    .spd-row { display: flex; align-items: center; gap: 5px; width: 100%; }
    .spd-val { font-size: 10px; color: #aaa; width: 50px; text-align: right; }
    .spd-bar { height: 16px; border-radius: 4px; display: flex; align-items: center; padding-left: 5px; font-size: 10px; color: #000; font-weight: bold; width: 0; animation: growBar 1s forwards; }
    .b-fast { background: #00ffaa; width: 90%; box-shadow: 0 0 5px #00ffaa; }
    .b-slow { background: #555; width: 60%; color: #aaa; }

    .skill-tip-visual { width: 80%; display: flex; flex-direction: column; gap: 5px; margin-bottom: 5px; }
    .skill-icon { text-align: center; color: #ffeb3b; font-weight: bold; text-shadow: 0 0 5px #f00; font-size: 16px; }
    .skill-bar { display: flex; height: 20px; border-radius: 10px; overflow: hidden; border: 1px solid #fff; }
    .sb-base { width: 30%; background: #444; font-size: 9px; display: flex; align-items: center; justify-content: center; }
    .sb-plus { flex: 1; background: linear-gradient(90deg, #ff8c00, #ffeb3b); color: #000; font-size: 10px; font-weight: bold; display: flex; align-items: center; justify-content: center; animation: barFlash 2s infinite; }

    .zukan-tip-visual { display: flex; align-items: center; gap: 20px; margin-bottom: 5px; }
    .zukan-char-box { width: 45px; height: 55px; border: 2px solid #fff; position: relative; background: #222; display: flex; align-items: center; justify-content: center; border-radius: 4px; }
    .zukan-char-silhouette { font-size: 20px; color: #555; font-weight: bold; }
    .zukan-new-badge { position: absolute; top: -8px; right: -12px; background: #f00; color: #fff; font-size: 9px; padding: 2px 4px; border-radius: 4px; font-weight: bold; border: 1px solid #fff; animation: bounceNew 0.5s infinite alternate; }
    .zukan-arrow { font-size: 16px; color: #aaa; }
    .zukan-gem-box { display: flex; flex-direction: column; align-items: center; color: #00ffff; text-shadow: 0 0 5px #00ffff; }
    .zukan-gem { font-size: 32px; animation: pulseGem 1.5s infinite; }
    .zukan-get-text { font-size: 12px; font-weight: bold; color: #ffd700; margin-top: -5px; }

    @keyframes bounceNew { 0%{transform:translateY(0);} 100%{transform:translateY(-3px);} }
    @keyframes pulseGem { 0%{transform:scale(1); filter:brightness(1);} 50%{transform:scale(1.1); filter:brightness(1.3);} 100%{transform:scale(1); filter:brightness(1);} }
    @keyframes enemyCast { 0%{filter:brightness(1);} 100%{filter:brightness(1.5);} }
    @keyframes slideArrowSkill { 0%{transform:translateX(0) scale(1);} 50%{transform:translateX(5px) scale(1.2);} 100%{transform:translateX(0) scale(1);} }
    @keyframes shakeHit { 0%{transform:translate(0,0);} 25%{transform:translate(-2px,1px);} 50%{transform:translate(2px,-1px);} 75%{transform:translate(-1px,2px);} 100%{transform:translate(0,0);} }
    @keyframes pulseSleep { 0%{transform:scale(1);} 50%{transform:scale(1.05);} 100%{transform:scale(1);} }
    @keyframes growBar { from{width:0;} to{opacity:1;} }
    @keyframes barFlash { 0%{filter:brightness(1);} 50%{filter:brightness(1.3);} 100%{filter:brightness(1);} }

    .loading-bottom-right { position: absolute; bottom: 20px; right: 20px; display: flex; align-items: flex-end; gap: 10px; }
    .loading-text-mini { color: #fff; font-family: monospace; font-size: 14px; margin-bottom: 10px; letter-spacing: 1px; animation: blinkMini 0.8s infinite alternate; }
    .mini-runner { width: 60px; height: auto; object-fit: contain; animation: bounceRunner 0.4s infinite alternate; }
    @keyframes blinkMini { 0% { opacity: 0.2; } 100% { opacity: 1; } }
    @keyframes bounceRunner { 0% { transform: translateY(0); } 100% { transform: translateY(-3px); } }
`;
