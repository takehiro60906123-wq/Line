# フェーズ1 変更サマリー — データ・バトルシステム大改修

## 変更ファイル: 4件

---

### `data.js` — **全面書き換え**

旧121体・旧6すくみ・旧コスト制を完全破棄。新30体プロトタイプ。

| # | 変更内容 | 詳細 |
|---|---------|------|
| 1 | `ELEMENTS[]` | 新6属性定義 (火/水/草/光/闇/無) |
| 2 | `TYPES` | `ELEMENTS`のエイリアス (後方互換) |
| 3 | `getElementAdvantage()` | **新関数** 火→草→水→火, 光⇔闇, 無=等倍 |
| 4 | `rollActionCount()` | **新関数** シェイプ別行動回数 (1枠=1回, 2枠=1~2回, 4枠=1~3回) |
| 5 | `calcNormalDamage()` | **新関数** (ATK/DEF)×50×乱数×属性 |
| 6 | `calcSkillDamage()` | **新関数** (ATK×威力%/RES)×50×乱数×属性 |
| 7 | `ROLE_TEMPLATES` | **新定義** BST配分テンプレート8種 |
| 8 | `generateStats()` | **新関数** BST+役割からステ自動生成 |
| 9 | `SKILL{}` | 新スキル30種 (新フォーマット: element/power/accuracy/charge/effect) |
| 10 | `ABILITY{}` | 新特性25種 (旧PASSIVE置換、エイリアス保持) |
| 11 | `LB_TEMPLATES{}` | BST基準 (LOW_BST/MID_BST/HIGH_BST) + 旧名エイリアス |
| 12 | `makeChar()` | **新関数** 後方互換フィールド自動生成 (type/cost/hp/atk/spd/passive) |
| 13 | `DB[]` | 新30体 (各属性5体) |

#### 30体の構成
| 属性 | 1x1 ATK | 1x1 壁 | 1x1 他 | 2枠 エース | 4枠 伝説 |
|------|---------|--------|--------|-----------|---------|
| 🔥火 | 火トカゲの子 | 灼熱の鎧武者 | 灯りの精 | 業火竜(V2) | 創世の炎龍(L4) |
| 💧水 | 水精の子 | 珊瑚の守り手 | 泡カエル | 深海竜(V2) | 深淵の海神(L4) |
| 🌿草 | 花蜂 | 棘の騎士 | 種の妖精 | 花の精霊(V2) | 巨木の番人(1x1) |
| ☀️光 | 光の子犬 | 光の盾持ち | 祝福の妖精 | 天角の聖獣(V2) | 聖剣の勇者(1x1) |
| 🌑闇 | 影ネズミ | 骸骨兵 | 影の暗殺者 | 闇夜の王(V2) | 虚無の支配者(L4) |
| ⚪無 | 放浪の剣豪 | 鉄壁のカメ | スライム | 大鷲獅子(H2) | メタルスライム(1x1) |

---

### `battle_state.js` — 6箇所

| # | メソッド | 変更内容 |
|---|---------|---------|
| 1 | `createUnit()` | DEF/RES初期化追加, スキルマスター特性でチャージ-1 |
| 2 | `applyStartPassives()` | 新アビリティ対応 (STAT_BOOST/TEAM_BUFF/INTIMIDATE/DUAL_DEF/DUAL_BOOST) + 旧互換維持 |
| 3 | `applyDamage()` | 旧6すくみ→新6属性相性 (`getElementAdvantage()`) |
| 4 | `getStatusResist()` | BST基準の基礎耐性 (BST530+→30%) |
| 5 | `generateEnemy()` | 敵Lv 10→15に調整 |
| 6 | `generateTowerEnemy()` | ボスフィルタをBST基準に変更 |

---

### `managers.js` — 2箇所

| # | メソッド | 変更内容 |
|---|---------|---------|
| 1 | `Unit.calcStats()` | 5ステータス体系 (HP/ATK/DEF/SPD/RES), BST基準成長率, 新skill.power対応, ability参照追加 |
| 2 | `Unit.getLbConfig()` | BST基準でLBテンプレ選択 (旧:cost基準) |

---

### `scene_battle.js` — 5箇所

| # | メソッド/箇所 | 変更内容 |
|---|-------------|---------|
| 1 | `runTurn()` バトルループ | **行動回数システム追加**: `rollActionCount()`, 1回目=スキルor通常, 2回目以降=通常のみ, 連撃の構え/暴走/安定行動/加速対応 |
| 2 | `executeAction()` ダメージ計算 | **新ダメージ計算式**: 通常=(ATK/DEF)×50×乱数, スキル=(ATK×pow%/RES)×50×乱数 (5箇所) |
| 3 | `executeAction()` サウンド | SINGLEタイプ追加 (新スキルtype) |
| 4 | `executeAction()` 属性表示 | 「効果抜群！」「いまひとつ…」テキスト表示追加 |
| 5 | `executeAction()` ABSORB | 吸収体質アビリティの回復処理追加 |
| 6 | ボスカットイン条件 | BST500以上で発動 (旧: cost>=5) |

---

## ダメージバランス検証

| 場面 | ATK | DEF/RES | 倍率 | ダメージ | SPEC値 |
|------|-----|---------|------|---------|--------|
| 序盤ATK→序盤壁 | 80 | 60 | 1.0 | 66 | 67 ✅ |
| エース→序盤壁 | 150 | 60 | 1.0 | 125 | 125 ✅ |
| エース→エース壁 | 150 | 120 | 1.0 | 62 | 63 ✅ |
| エース強スキル(180%)→エース壁 | 150 | 120 | 1.8 | 112 | 113 ✅ |
| 序盤→伝説壁 | 80 | 150 | 1.0 | 26 | 27 ✅ |

## 後方互換性

以下のフィールドを維持し、formation/gacha/zukanの画面は変更不要:
- `base.type` (数値0~5) → `ELEMENT_ID[element]`
- `base.cost` (数値) → `bstToCost(bst)`
- `base.hp / atk / spd` → `stats`からフラット展開
- `TYPES[]` → `ELEMENTS`のエイリアス
- `PASSIVE` → `ABILITY`のエイリアス
- `base.passive` → `ability`のコピー
