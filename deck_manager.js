/**
 * deck_manager.js - デッキ（部隊編成）管理 + アセットプリローダー
 * 
 * 旧: managers.js から分離
 * 依存: unit.js (Unit), data_manager.js (app.data)
 */

class DeckManager {
    // 開放順: F1(0),F2(1),B1(4),B2(5),F3(2),B3(6),F4(3),B4(7)
    static SLOT_ORDER = [0, 1, 4, 5, 2, 6, 3, 7];

    static getOpenSlots() {
        const n = (app && app.data) ? (app.data.maxSlots || 4) : 4;
        return DeckManager.SLOT_ORDER.slice(0, n);
    }

    isSlotOpen(cellIdx) {
        return DeckManager.getOpenSlots().includes(cellIdx);
    }

    canPlace(unit, anchorIdx) { 
        if (!unit) return false;
        const cells = unit.getOccupiedCells(anchorIdx); 
        if (!cells) return false; 
        // ロック枠チェック: 全セルが開放済みか確認
        for (let c of cells) {
            if (!this.isSlotOpen(c)) return false;
        }
        for (let c of cells) { 
            const occupied = app.data.deck.some(entry => { 
                const existingUnit = app.data.getUnitInstance(entry.uid); 
                if (!existingUnit) return false;
                const existingCells = existingUnit.getOccupiedCells(entry.anchorIdx); 
                return existingCells && existingCells.includes(c); 
            }); 
            if (occupied) return false; 
        } 
        return true; 
    }

    addUnit(uid, anchorIdx) { 
        if (app.sugorokuScreen && app.sugorokuScreen.isGameActive) { alert("双六モード中は編成変更できません"); return; }
        if (app.data.deck.length >= (app.data.maxSlots || 8)) { alert("枠が上限です（" + (app.data.maxSlots || 8) + "枠）\n双六ステージをクリアすると開放！"); return; }
        if (app.data.deck.some(d => d.uid === uid)) { alert("配置済みです"); return; } 
        const unit = app.data.getUnitInstance(uid); 
        if (!unit) return;
        if (!this.canPlace(unit, anchorIdx)) { alert("配置できません"); return; } 
        app.sound.tap(); 
        app.data.deck.push({ uid: uid, unitId: unit.base.id, anchorIdx: anchorIdx }); 
        app.data.saveDeck(); 
        app.formationScreen.refresh(); 
    }

    removeUnit(uid) { 
        app.sound.tap(); 
        app.data.deck = app.data.deck.filter(d => d.uid !== uid); 
        app.data.saveDeck(); 
        app.formationScreen.refresh(); 
    }

    clear() { 
        if (confirm("全部隊を解除しますか？")) { 
            app.sound.tap(); 
            app.data.deck = []; 
            app.data.saveDeck(); 
            app.formationScreen.refresh(); 
        } 
    }
}

// ============================================================
// アセットプリローダー（画像の事前読み込み）
// ============================================================
class AssetLoader {
    /**
     * 与えられたURLの画像をすべて裏でダウンロードし、完了を待つ
     * @param {string[]} urls - 読み込む画像のURL配列
     * @returns {Promise<void>}
     */
    static preloadImages(urls) {
        const uniqueUrls = [...new Set(urls.filter(url => url))];
        if (uniqueUrls.length === 0) return Promise.resolve();

        console.log(`[AssetLoader] ${uniqueUrls.length}個の画像をプリロード中...`);

        const promises = uniqueUrls.map(url => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => resolve();
                img.onerror = () => {
                    console.warn(`[AssetLoader] 画像の読み込みに失敗しました: ${url}`);
                    resolve();
                };
                img.src = url;
            });
        });

        return Promise.all(promises);
    }
}
