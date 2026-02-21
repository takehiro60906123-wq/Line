/**
 * data_sugoroku_stages.js - 7ステージ完全版
 * マップ選択画面に対応したステージデータ定義
 */
const SUGOROKU_STAGES = {
    1: {
        name: "始まりの草原",
        desc: "穏やかな平原エリア。\n冒険の第一歩を踏み出そう。",
        level: 10,
        bg: "images/bg_iconstage1.webp",
        battleBg: "images/bg_battle_grass.webp",
        startDice: 15
    },
    2: {
        name: "迷いの森",
        desc: "深い霧に包まれた幻惑の森。\n油断すると道に迷うぞ。",
        level: 20,
        bg: "images/bg_iconstage2.webp",
        battleBg: "images/bg_battle_forest.webp",
        startDice: 20
    },
    3: {
        name: "古代遺跡",
        desc: "太古の技術と罠が眠る遺跡。\n最深部を目指せ。",
        level: 30,
        bg: "images/bg_iconstage3.webp",
        battleBg: "images/bg_battle_ruins.webp",
        startDice: 25
    },
    4: {
        name: "灼熱の火山",
        desc: "溶岩流れる灼熱の大地。\n強力な炎の魔物が棲む。",
        level: 40,
        bg: "images/bg_iconstage4.webp",
        battleBg: "images/bg_battle_grass.webp",
        startDice: 25
    },
    5: {
        name: "氷雪の峠",
        desc: "凍てつく吹雪が行く手を阻む。\n極寒の峠を越えよ。",
        level: 50,
        bg: "images/bg_iconstage5.webp",
        battleBg: "images/bg_battle_forest.webp",
        startDice: 25
    },
    6: {
        name: "魔王の城",
        desc: "闇の力が渦巻く禁断の城。\n最強の魔物たちが待ち受ける。",
        level: 60,
        bg: "images/bg_iconstage6.webp",
        battleBg: "images/bg_battle_ruins.webp",
        startDice: 25
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
