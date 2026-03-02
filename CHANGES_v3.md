# リファクタリング変更点 v3（完全版）

## 概要
1. デッドコード削除 (game.js, scene_formation.js)
2. GameApp分割 + シーンレジストリ化
3. CSS-in-JS → 外部CSS化
4. managers.js → 5ファイル分割（TIPS分離含む）
5. SceneManager内の重複コード解消

---

## 削除ファイル

| ファイル | 行数 | 理由 |
|---------|------|------|
| game.js | 453 | index.htmlに未読込。全クラスが再実装済み |
| scene_formation.js | 468 | index.htmlに未読込。scene_formation_redesign.jsで置換済み |
| managers.js | 960 | 5ファイルに分割 |

## 新規ファイル (7ファイル)

| ファイル | 行数 | 元 |
|---------|------|-----|
| unit.js | 263 | managers.js Unit |
| data_manager.js | 293 | managers.js DataManager |
| tips_data.js | 279 | managers.js SceneManager内TIPS |
| scene_manager.js | 64 | managers.js SceneManager本体 |
| deck_manager.js | 100 | managers.js DeckManager+AssetLoader |
| viewport_manager.js | 78 | main.js ビューポート管理 |
| style-theme.css | 132 | main.js injectPowerProTheme() |

## 変更ファイル

### main.js (619行 → 446行)
- injectPowerProTheme() 155行 → style-theme.css
- detectPWAMode/updateViewportHeight/scheduleViewportSync → viewport_manager.js
- changeScene() if-else地獄 → SceneRegistry (Mapベース)
- バグ修正: enhanceScreen.onLeave() 2回呼出→1回

### index.html
- style-theme.css読み込み追加
- managers.js → 5ファイル置換
- viewport_manager.js読み込み追加
