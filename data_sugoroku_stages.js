/**
 * data_sugoroku_stages.js - 7ステージ完全版
 */
const SUGOROKU_STAGES = {
    1: {
        name: "始まりの草原",
        desc: "穏やかな平原エリア。\n冒険の第一歩を踏み出そう。",
        level: 10,
        bg: "images/bg_iconstage1.webp",
        battleBg: "images/bg_battle_grass.webp",
        startDice: 15,
        totalSquares: 40,
        deckSize: 40,
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
        ]
    },
    2: {
        name: "迷いの森",
        desc: "深い霧に包まれた幻惑の森。\n油断すると道に迷うぞ。",
        level: 20,
        bg: "images/bg_iconstage2.webp",
        battleBg: "images/bg_battle_forest.webp",
   startDice: 20,
        totalSquares: 45,
        deckSize: 42,
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
        ]
    },
    3: {
        name: "古代遺跡",
        desc: "太古の技術と罠が眠る遺跡。\n最深部を目指せ。",
        level: 30,
        bg: "images/bg_iconstage3.webp",
        battleBg: "images/bg_battle_ruins.webp",
       startDice: 25,
        totalSquares: 50,
        deckSize: 44,
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
        ]
    },
    4: {
        name: "灼熱の火山",
        desc: "溶岩流れる灼熱の大地。\n強力な炎の魔物が棲む。",
        level: 40,
        bg: "images/bg_iconstage4.webp",
        battleBg: "images/bg_battle_grass.webp",
       startDice: 25,
        totalSquares: 55,
        deckSize: 46,
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
        ]
    },
    5: {
        name: "氷雪の峠",
        desc: "凍てつく吹雪が行く手を阻む。\n極寒の峠を越えよ。",
        level: 50,
        bg: "images/bg_iconstage5.webp",
        battleBg: "images/bg_battle_forest.webp",
      startDice: 25,
        totalSquares: 55,
        deckSize: 46,
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
        ]
    },
    6: {
        name: "魔王の城",
        desc: "闇の力が渦巻く禁断の城。\n最強の魔物たちが待ち受ける。",
        level: 60,
        bg: "images/bg_iconstage6.webp",
        battleBg: "images/bg_battle_ruins.webp",
        startDice: 25,
        totalSquares: 65,
        deckSize: 50,
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
        ]
    },
    7: {
        name: "天空の神殿",
        desc: "雲の上に浮かぶ伝説の神殿。\n真の勇者のみが辿り着く。",
        level: 75,
        bg: "images/bg_iconstage7.webp",
        battleBg: "images/bg_battle_grass.webp",
        startDice: 25
    }
};
