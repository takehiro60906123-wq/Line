/**
 * data_sugoroku_stages.js - クエストモード対応版（7ステージ）
 * deckSize, startDice, totalSquares を廃止
 * panelEnemies, totalEncounters, midbossAt を追加
 */
const SUGOROKU_STAGES = {
    1: {
        name: "始まりの草原",
        desc: "穏やかな平原エリア。\n冒険の第一歩を踏み出そう。",
        level: 10,
        bg: "images/bg_iconstage1.webp",
        battleBg: "images/bg_battle_grass.webp",
        totalEncounters: 10,
        midbossAt: 5,
        enemyLv: 5,
        bossLv: 10,
        bossId: 2,
        sugorokuBattleBg: "images/bg_stage1.webp",
        bgPath: "images/stage/stage1/",
        layers: [
            { file: 'layer1.webp', speed: 0.0, isFront: false },
            { file: 'layer2.webp', speed: 0.1, isFront: false },
            { file: 'layer3.webp', speed: 0.3, isFront: false },
            { file: 'layer4.webp', speed: 0.6, isFront: false },
            { file: 'layer5.webp', speed: 1.0, isFront: false },
            { file: 'layer6.webp', speed: 1.2, isFront: true }
        ],
        panelEnemies: [
            { id:'slime', name:'スライム', emoji:'🟢', hp:80, atk:12,
              resistPhys:0, resistMagic:0,
              pattern:[{turn:'every',action:'attack',power:1.0,label:'体当たり'}],
              expBase:20, goldBase:40 },
             { id:'bee', name:'キラービー', emoji:'🐝', hp:60, atk:15, actionInterval:1,
              resistPhys:-0.2, resistMagic:0.2,
              pattern:[{turn:'every',action:'attack',power:1.0,label:'針刺し'}],
              expBase:18, goldBase:35 }
        ]
    },
    2: {
        name: "迷いの森",
        desc: "深い霧に包まれた幻惑の森。\n油断すると道に迷うぞ。",
        level: 20,
        bg: "images/bg_iconstage2.webp",
        battleBg: "images/bg_battle_forest.webp",
        totalEncounters: 12,
        midbossAt: 6,
        enemyLv: 12,
        bossLv: 20,
        bossId: 13,
        sugorokuBattleBg: "images/bg_stage2.webp",
        bgPath: "images/stage/stage2/",
        layers: [
            { file: 'layer1.webp', speed: 0.0, isFront: false },
            { file: 'layer2.webp', speed: 0.1, isFront: false },
            { file: 'layer3.webp', speed: 0.3, isFront: false },
            { file: 'layer4.webp', speed: 0.6, isFront: false },
            { file: 'layer5.webp', speed: 1.0, isFront: false },
            { file: 'layer6.webp', speed: 1.2, isFront: true }
        ],
        panelEnemies: [
            { id:'goblin', name:'ゴブリン', emoji:'👺', hp:120, atk:18,
              resistPhys:0, resistMagic:0.3,
              pattern:[{turn:'every',action:'attack',power:1.0,label:'斬りつけ'},{turn:4,action:'heavy',power:2.5,label:'渾身の一撃'}],
              expBase:35, goldBase:60 },
            { id:'wolf', name:'ダイアウルフ', emoji:'🐺', hp:100, atk:20,
              resistPhys:0.1, resistMagic:-0.1,
              pattern:[{turn:'every',action:'attack',power:1.0,label:'噛みつき'},{turn:3,action:'heavy',power:2.0,label:'突進'}],
              expBase:30, goldBase:55 }
        ]
    },
    3: {
        name: "古代遺跡",
        desc: "太古の技術と罠が眠る遺跡。\n最深部を目指せ。",
        level: 30,
        bg: "images/bg_iconstage3.webp",
        battleBg: "images/bg_battle_ruins.webp",
        totalEncounters: 12,
        midbossAt: 6,
        enemyLv: 20,
        bossLv: 30,
        bossId: 24,
        sugorokuBattleBg: "images/bg_stage3.webp",
        bgPath: "images/stage/stage3/",
        layers: [
            { file: 'layer1.webp', speed: 0.0, isFront: false },
            { file: 'layer2.webp', speed: 0.1, isFront: false },
            { file: 'layer3.webp', speed: 0.3, isFront: false },
            { file: 'layer4.webp', speed: 0.6, isFront: false },
            { file: 'layer5.webp', speed: 1.0, isFront: false },
            { file: 'layer6.webp', speed: 1.2, isFront: true }
        ],
        panelEnemies: [
            { id:'skeleton', name:'スケルトン', emoji:'💀', hp:100, atk:22,
              resistPhys:0.5, resistMagic:-0.3,
              pattern:[{turn:'every',action:'attack',power:1.0,label:'骨撃ち'},{turn:3,action:'heavy',power:2.0,label:'骨旋風'}],
              expBase:40, goldBase:70 },
            { id:'mage', name:'ダークメイジ', emoji:'🧙', hp:90, atk:25,
              resistPhys:-0.3, resistMagic:0.5,
              pattern:[{turn:'every',action:'attack',power:0.8,label:'闇の弾'},{turn:5,action:'heavy',power:3.0,label:'メテオ'}],
              expBase:45, goldBase:80 }
        ]
    },
    4: {
        name: "灼熱の火山",
        desc: "溶岩流れる灼熱の大地。\n強力な炎の魔物が棲む。",
        level: 40,
        bg: "images/bg_iconstage4.webp",
        battleBg: "images/bg_battle_grass.webp",
        totalEncounters: 14,
        midbossAt: 7,
        enemyLv: 28,
        bossLv: 40,
        bossId: 54,
        sugorokuBattleBg: "images/bg_stage4.webp",
        bgPath: "images/stage/stage4/",
        layers: [
            { file: 'layer1.webp', speed: 0.0, isFront: false },
            { file: 'layer2.webp', speed: 0.1, isFront: false },
            { file: 'layer3.webp', speed: 0.3, isFront: false },
            { file: 'layer4.webp', speed: 0.6, isFront: false },
            { file: 'layer5.webp', speed: 1.0, isFront: false },
            { file: 'layer6.webp', speed: 1.2, isFront: true }
        ],
        panelEnemies: [
            { id:'golem', name:'ゴーレム', emoji:'🗿', hp:200, atk:15,
              resistPhys:0.4, resistMagic:0,
              pattern:[{turn:'every',action:'attack',power:1.0,label:'岩拳'},{turn:4,action:'heavy',power:2.8,label:'大地震'}],
              expBase:50, goldBase:90 },
            { id:'fire_spirit', name:'ファイアスピリット', emoji:'🔥', hp:110, atk:28,
              resistPhys:-0.2, resistMagic:0.6,
              pattern:[{turn:'every',action:'attack',power:1.0,label:'火炎弾'},{turn:3,action:'heavy',power:2.5,label:'火炎嵐'}],
              expBase:48, goldBase:85 }
        ]
    },
    5: {
        name: "氷雪の峠",
        desc: "凍てつく吹雪が行く手を阻む。\n極寒の峠を越えよ。",
        level: 50,
        bg: "images/bg_iconstage5.webp",
        battleBg: "images/bg_battle_forest.webp",
        totalEncounters: 14,
        midbossAt: 7,
        enemyLv: 35,
        bossLv: 50,
        bossId: 43,
        sugorokuBattleBg: "images/bg_stage5.webp",
        bgPath: "images/stage/stage5/",
        layers: [
            { file: 'layer1.webp', speed: 0.0, isFront: false },
            { file: 'layer2.webp', speed: 0.1, isFront: false },
            { file: 'layer3.webp', speed: 0.3, isFront: false },
            { file: 'layer4.webp', speed: 0.6, isFront: false },
            { file: 'layer5.webp', speed: 1.0, isFront: false },
            { file: 'layer6.webp', speed: 1.2, isFront: true }
        ],
        panelEnemies: [
            { id:'ice_golem', name:'アイスゴーレム', emoji:'🧊', hp:220, atk:20,
              resistPhys:0.3, resistMagic:0.2,
              pattern:[{turn:'every',action:'attack',power:1.0,label:'氷塊'},{turn:4,action:'heavy',power:2.5,label:'吹雪'}],
              expBase:55, goldBase:95 },
            { id:'dragon_baby', name:'ドラゴンパピー', emoji:'🐉', hp:150, atk:30,
              resistPhys:0.2, resistMagic:0.2,
              pattern:[{turn:'every',action:'attack',power:1.0,label:'噛みつき'},{turn:3,action:'heavy',power:2.2,label:'ブレス'}],
              expBase:55, goldBase:100 }
        ]
    },
    6: {
        name: "魔王の城",
        desc: "闇の力が渦巻く禁断の城。\n最強の魔物たちが待ち受ける。",
        level: 60,
        bg: "images/bg_iconstage6.webp",
        battleBg: "images/bg_battle_ruins.webp",
        totalEncounters: 16,
        midbossAt: 8,
        enemyLv: 50,
        bossLv: 75,
        bossId: 6,
        sugorokuBattleBg: "images/bg_stage7.webp",
        bgPath: "images/stage/stage7/",
        layers: [
            { file: 'layer1.webp', speed: 0.0, isFront: false },
            { file: 'layer2.webp', speed: 0.1, isFront: false },
            { file: 'layer3.webp', speed: 0.3, isFront: false },
            { file: 'layer4.webp', speed: 0.6, isFront: false },
            { file: 'layer5.webp', speed: 1.0, isFront: false },
            { file: 'layer6.webp', speed: 1.2, isFront: true }
        ],
        panelEnemies: [
            { id:'dark_knight', name:'暗黒騎士', emoji:'🖤', hp:250, atk:30,
              resistPhys:0.3, resistMagic:-0.2,
              pattern:[{turn:'every',action:'attack',power:1.0,label:'闇斬り'},{turn:3,action:'heavy',power:2.5,label:'暗黒剣'}],
              expBase:65, goldBase:120 },
            { id:'lich', name:'リッチ', emoji:'☠️', hp:180, atk:35,
              resistPhys:-0.3, resistMagic:0.6,
              pattern:[{turn:'every',action:'attack',power:0.8,label:'死霊弾'},{turn:4,action:'heavy',power:3.0,label:'死の宣告'}],
              expBase:70, goldBase:130 }
        ]
    },
    7: {
        name: "天空の神殿",
        desc: "雲の上に浮かぶ伝説の神殿。\n真の勇者のみが辿り着く。",
        level: 75,
        bg: "images/bg_iconstage7.webp",
        battleBg: "images/bg_battle_grass.webp",
        totalEncounters: 18,
        midbossAt: 9,
        enemyLv: 60,
        bossLv: 90,
        bossId: 55,
        panelEnemies: [
            { id:'seraph', name:'セラフィム', emoji:'👼', hp:300, atk:35,
              resistPhys:0.2, resistMagic:0.4,
              pattern:[{turn:'every',action:'attack',power:1.0,label:'聖光'},{turn:3,action:'heavy',power:2.8,label:'天罰'}],
              expBase:80, goldBase:150 },
            { id:'ancient_dragon', name:'エンシェントドラゴン', emoji:'🐲', hp:350, atk:40,
              resistPhys:0.3, resistMagic:0.3,
              pattern:[{turn:'every',action:'attack',power:1.0,label:'ドラゴンクロー'},{turn:4,action:'heavy',power:3.5,label:'メガフレア'}],
              expBase:90, goldBase:170 }
        ]
    }
};
