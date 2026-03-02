# v2.2 変更ログ — リーダースキル・性別・減衰実装

## 変更ファイル一覧

| ファイル | 変更概要 |
|---------|---------|
| data.js | 性別/リーダースキル定義・30キャラ更新・4枠テーブル修正・特性変更 |
| battle_state.js | applyLeaderSkill()追加・COMMANDER特性・テーマ敵生成 |
| scene_battle.js | リーダースキル呼出・減衰ルール(×0.7) |
| scene_formation_redesign.js | リーダー王冠表示・リーダースキルUI |
| scene_formation.js | 同上(旧バージョン用) |
| scene_tower.js | テーマ編成敵生成・属性アイコン・リーダースキル表示 |

---

## data.js

### 変更メソッド: `rollActionCount(shape)`
- 4枠テーブル: `1回20%/2回50%/3回30%` → `1回30%/2回50%/3回20%`
- 期待値: 2.1 → 1.9

### 変更定義: `ABILITY.INSPIRE_AURA`
- 旧: `{type:'TEAM_BUFF', stat:'atk', val:1.10, name:'鼓舞'}`
- 新: `{type:'COMMANDER', atkVal:1.15, defVal:1.15, name:'指揮官の心得'}`

### 変更定義: `ABILITY.MIND_BARRIER`
- 旧: `{type:'TEAM_BUFF', stat:'res', val:1.10, name:'精神結界'}`
- 新: `{type:'STAT_BOOST', stat:'res', val:1.30, name:'精神集中'}`

### 新定義: `LEADER_SKILLS` (19種)
属性染め6種 + 性別条件4種 + 組合せ条件6種 + 汎用3種

### 変更関数: `makeChar()`
- 引数追加: `gender`(3番目), `leaderSkillId`(11番目)
- 戻り値に `gender`, `leaderSkill` フィールド追加

### 全30キャラ更新
- gender: M×22, F×5, N×1
- leaderSkill: キャラに応じた固有リーダースキル割り当て

---

## battle_state.js

### 新メソッド: `applyLeaderSkill(side)`
- anchorIdxが最小のユニットをリーダーとして検出
- 条件判定(属性/性別/数量/シェイプ/全属性)
- 対象に効果適用(HP/ATK/DEF/SPD/RES/crit/statusImmune/regen)

### 変更メソッド: `applyStartPassives(side)`
- `COMMANDER` タイプ追加

### 変更メソッド: `generateTowerEnemy(floor)`
- テーマ属性で敵生成(同属性70%)

---

## scene_battle.js

### 変更メソッド: `start(options)`
- リーダースキル適用をパッシブ前に挿入

### 変更メソッド: `loop()`
- 2回目以降に `_actionDecay = 0.7` 設定・ダメージ乗算

---

## scene_formation_redesign.js

### 変更メソッド: `renderBoard()` — 👑バッジ追加
### 変更メソッド: `updateDeckStats()` — リーダースキル表示

---

## scene_tower.js

### 変更メソッド: `_generateEnemyData(floor)` — テーマ編成
### 変更メソッド: `renderEnemyCards()` — 属性アイコン + リーダースキル表示
