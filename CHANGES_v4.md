# CHANGES_v4.md - CSS-in-JS完全除去 & CSS統合

## 概要
全画面のCSS-in-JSを外部CSSファイルに抽出し、v1+v2ペアを統合。
未使用グローバル関数の削除も実施。

---

## 変更一覧

### 1. バトルCSS-in-JS除去
**変更ファイル**: `battle_view.js`, `scene_battle.js`, `style-battle-v2.css`(新規→後に統合)

- `battle_view.js`: `injectStyles()` メソッド削除 (892→651行, -241行)
- `scene_battle.js`: `injectStyles()` (デッドコード) + リザルトCSS注入ブロック削除 (1729→1624行, -105行)
- 抽出CSS: `style-battle-v2.css` (280行) → 後にstyle-battle.cssに統合

### 2. 未使用グローバル関数削除
**変更ファイル**: `main.js` (446→442行)

削除した関数:
- `window.goToQuest` - どこからも未参照
- `window.goToFormation` - どこからも未参照
- `window.goToEnhance` - どこからも未参照
- `window.execLevelUp` - どこからも未参照
- `window.execSkillUp` - どこからも未参照
- `window.execLimitBreak` - どこからも未参照

### 3. 全画面CSS-in-JS一括除去
**変更ファイル**: 5つのscene_*.js + 5つの新規CSSファイル

| JSファイル | Before | After | 削減 | 抽出先CSS |
|-----------|--------|-------|------|-----------|
| scene_enhance.js | 1,285 | 679 | -606 | style-enhance.css (597行) |
| scene_gacha.js | 1,051 | 706 | -345 | style-gacha-v2.css (342行) |
| scene_zukan.js | 950 | 638 | -312 | style-zukan.css (308行) |
| scene_formation_redesign.js | 1,461 | 869 | -592 | style-formation-v2.css (588行) |
| scene_card_equip.js | 1,495 | 833 | -662 | style-card-equip.css (651行) |

各JSファイルで削除したメソッド:
- `scene_enhance.js`: `injectStyles()` (行683-1285)
- `scene_gacha.js`: `injectStyles()` (行707-1051)
- `scene_zukan.js`: `injectStyles()` (行639-950)
- `scene_formation_redesign.js`: `setupCustomLayout()` (行102-693) ※CSS注入のみ
- `scene_card_equip.js`: `injectStyles()` (行834-1492)

注意: scene_gacha.js内の `${this.bgImage}` はリテラル `images/bg_gacha.webp` に置換

### 4. CSS v1+v2統合
**変更ファイル**: `style-battle.css`, `style-formation.css`, `style-gacha.css`

| 統合ファイル | v1 | v2 | 統合後 | 削減 |
|-------------|-----|-----|--------|------|
| style-battle.css | 334 | 280 | 343 | -271 |
| style-formation.css | 889 | 588 | 1,014 | -463 |
| style-gacha.css | 36 | 342 | 360 | -18 |

削除した中間ファイル: style-battle-v2.css, style-formation-v2.css, style-gacha-v2.css

デッドCSS除去:
- battle: デッドセレクタ4個、未使用keyframes 5個
- formation: デッドセレクタ28個（旧formation画面の残骸）

### 5. バグ修正: formation CSS統合時のルール欠落
**変更ファイル**: `style-formation.css`

統合スクリプトが `formation-board-large` を含む全ルールを重複として除外してしまい、
子孫セレクタのルールが消失していた。以下を復元:

- `.formation-board-large .board-unit` 基本定義
- `.board-unit::after` / `:active` / `.selected` / `.selected::before`
- `.size-S1x1` ～ `.size-L2x2` (キャラサイズ定義)
- `@keyframes bounceArrow`
- `.board-unit-stars` ベース定義
- `.list-card::after` / `.f-detail-img::after` 光沢エフェクト
- `.in-deck::after` デッキ登録済み暗転
- `@media (max-width: 400px)` レスポンシブ
- `::-webkit-scrollbar` スクロールバー

---

## 最終index.html CSS読み込み順
```html
<link rel="stylesheet" href="style-base.css">
<link rel="stylesheet" href="style-gacha.css">
<link rel="stylesheet" href="style-battle.css">
<link rel="stylesheet" href="style-sugoroku.css">
<link rel="stylesheet" href="style-panel-battle.css">
<link rel="stylesheet" href="style-formation.css">
<link rel="stylesheet" href="style-enhance.css">
<link rel="stylesheet" href="style-zukan.css">
<link rel="stylesheet" href="style-card-equip.css">
<link rel="stylesheet" href="style-theme.css">
```

## 削除可能な未使用ファイル
- `style.css` (281行) - index.htmlから未参照
