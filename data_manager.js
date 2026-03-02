/**
 * data_manager.js - データ管理クラス
 * 
 * 旧: managers.js から分離
 * 依存: unit.js (Unit), data.js (DB), card_system.js (CardManager)
 * インベントリ、デッキ、ジェム、ゴールド、ステージ進行、カード装備等の永続化
 */
class DataManager {
    constructor() { 
        this.inventory = []; 
        this.candies = {}; 
        this.deck = []; 
        this.gems = 3000; 
        this.gold = 10000; 
        this.zukanRewards = {}; 
        
        // ★追加: クリア済みステージの管理
        this.maxClearedStage = 0; 
        this.stageClearCounts = {};  // ★追加: ステージ別クリア回数
        // ★追加: 塔の階層管理
        this.towerFloor = 1;
        this.towerEnemyData = null; // ★追加: 塔の敵データ
        this.maxSlots = 4;

        // ★カードシステム
        this.cardManager = (typeof CardManager !== 'undefined') ? new CardManager() : null;
        this.unitEquips = {};  // { unitUid: { red: cardId, yellow: cardId, blue: cardId, purple: cardId } }

        this.load(); 
    }

    load() {
        const inv = localStorage.getItem('hero_inventory_v2'); 
        if (inv) {
            this.inventory = JSON.parse(inv);
        }
        if (!this.inventory || this.inventory.length === 0) {
            this.inventory = [];
            this.addUnit(1);
        }

        const candy = localStorage.getItem('hero_candies_v1');
        if (candy) this.candies = JSON.parse(candy);

        const savedGems = localStorage.getItem('hero_gems_v1'); 
        if (savedGems) this.gems = parseInt(savedGems);

        const savedGold = localStorage.getItem('hero_gold_v1'); 
        if (savedGold) this.gold = parseInt(savedGold);
        
        const deck = localStorage.getItem('hero_deck_v16'); 
        if (deck) { try { this.deck = JSON.parse(deck); } catch (e) { this.deck = []; } }

        const zr = localStorage.getItem('hero_zukan_rewards_v1');
        if (zr) { try { this.zukanRewards = JSON.parse(zr); } catch(e) { this.zukanRewards={}; } }

        // ★追加: ステージ進行度の読み込み
        const stage = localStorage.getItem('hero_max_stage_v1');
        if (stage) this.maxClearedStage = parseInt(stage);
        // ★追加: クリア回数読み込み
        const scc = localStorage.getItem('hero_stage_clear_counts_v1');
        if (scc) { try { this.stageClearCounts = JSON.parse(scc); } catch(e) { this.stageClearCounts = {}; } }
        // ★追加: 塔データの読み込み
        const tf = localStorage.getItem('hero_tower_floor_v1');
        if (tf) this.towerFloor = parseInt(tf);
        // ★追加: 塔の敵データ読み込み
        const ted = localStorage.getItem('hero_tower_enemy_v1');
        if (ted) { try { this.towerEnemyData = JSON.parse(ted); } catch(e) { this.towerEnemyData = null; } }
        const ms = localStorage.getItem('hero_max_slots_v1');
        if (ms) this.maxSlots = Math.max(4, Math.min(8, parseInt(ms)));

        // ★カードシステム読み込み
        if (this.cardManager) {
            const cardData = localStorage.getItem('hero_cards_v1');
            if (cardData) {
                try { this.cardManager.loadSaveData(JSON.parse(cardData)); } catch(e) { console.warn('Card data load error:', e); }
            }
        }
        const eqData = localStorage.getItem('hero_unit_equips_v1');
        if (eqData) {
            try { this.unitEquips = JSON.parse(eqData); } catch(e) { this.unitEquips = {}; }
        }
    }

    save() { 
        localStorage.setItem('hero_inventory_v2', JSON.stringify(this.inventory)); 
        localStorage.setItem('hero_candies_v1', JSON.stringify(this.candies));
        localStorage.setItem('hero_gems_v1', this.gems);
        localStorage.setItem('hero_gold_v1', this.gold);
        localStorage.setItem('hero_deck_v16', JSON.stringify(this.deck));
        localStorage.setItem('hero_zukan_rewards_v1', JSON.stringify(this.zukanRewards));
        
        // ★追加: ステージ進行度の保存
        localStorage.setItem('hero_max_stage_v1', this.maxClearedStage);
        // ★追加: クリア回数保存
        localStorage.setItem('hero_stage_clear_counts_v1', JSON.stringify(this.stageClearCounts || {}));
        
        if(typeof window.updateGlobalHeader === 'function') window.updateGlobalHeader();
        // ★追加: 塔データの保存
        localStorage.setItem('hero_tower_floor_v1', this.towerFloor);
        localStorage.setItem('hero_max_slots_v1', this.maxSlots);
        // ★追加: 塔の敵データ保存
        if (this.towerEnemyData) {
            localStorage.setItem('hero_tower_enemy_v1', JSON.stringify(this.towerEnemyData));
        } else {
            localStorage.removeItem('hero_tower_enemy_v1');
        }

        // ★カードシステム保存
        if (this.cardManager) {
            localStorage.setItem('hero_cards_v1', JSON.stringify(this.cardManager.toSaveData()));
        }
        localStorage.setItem('hero_unit_equips_v1', JSON.stringify(this.unitEquips || {}));
    }
    
    // ★追加: ステージクリア処理
    completeStage(stageId) {
        if (stageId > this.maxClearedStage) {
            this.maxClearedStage = stageId;
            // ステージクリアごとに1枠開放（最大8）
            if (this.maxSlots < 8) {
                this.maxSlots = Math.min(8, this.maxSlots + 1);
            }
            this.save();
        }
    }

    resetAllData() {
        const keys = [
            'hero_inventory_v2','hero_candies_v1','hero_gems_v1','hero_gold_v1',
            'hero_deck_v16','hero_zukan_rewards_v1','hero_max_stage_v1',
            'hero_stage_clear_counts_v1','hero_tower_floor_v1','hero_tower_enemy_v1',
            'hero_max_slots_v1',
            'hero_cards_v1','hero_unit_equips_v1'
        ];
        keys.forEach(k => localStorage.removeItem(k));
        location.reload();
    }

    saveStats() { this.save(); } 
    saveDeck() { this.save(); }

    getUnitInstance(uid) {
        const saved = this.inventory.find(u => u.uid === uid);
        if (!saved) return null;
        const base = DB.find(u => u.id === saved.unitId);
        return new Unit(base, saved);
    }
    
    getUnit(unitId) { 
        const saved = this.inventory.find(u => u.unitId === unitId);
        const base = DB.find(u => u.id === unitId);
        if(!base) return null;
        return new Unit(base, saved || { uid:null, unitId:unitId, lv:1, maxLv:50, skillLv:1 });
    }

    addUnit(unitId, isNewObtained = false) {
        const base = DB.find(u => u.id === unitId);
        if(!base) return null;
        const newUnit = {
            uid: Date.now() + Math.random().toString(36).substring(2),
            unitId: unitId,
            lv: 1, maxLv: 50, skillLv: 1, exp: 0,
            createTime: Date.now()
        };
        this.inventory.push(newUnit);
        if(isNewObtained) this.addCandy(unitId, 3);
        this.save();
        return this.getUnitInstance(newUnit.uid);
    }

    addCandy(unitId, amount) {
        if(!this.candies[unitId]) this.candies[unitId] = 0;
        this.candies[unitId] += amount;
    }
    
    consumeCandy(unitId, amount) {
        if(!this.candies[unitId] || this.candies[unitId] < amount) return false;
        this.candies[unitId] -= amount;
        this.save();
        return true;
    }

    // ★追加: 塔の階層を進める
    advanceTowerFloor() {
        this.towerFloor++;
        this.towerEnemyData = null; // ★次階層用に敵データをリセット
        this.save();
    }

    toggleLock(uid) {
        const unitData = this.inventory.find(u => u.uid === uid);
        if (unitData) {
            // ロック状態を反転
            unitData.isLocked = !unitData.isLocked;
            this.save();
            return unitData.isLocked;
        }
        return false;
    }

    // ★★★ releaseUnit (売却) もロック対応に書き換え ★★★
    releaseUnit(uid) {
        const idx = this.inventory.findIndex(u => u.uid === uid);
        if(idx === -1) return 0;

        // ロックチェック
        if(this.inventory[idx].isLocked) return 0;
        // デッキ編成チェック
        if(this.deck.some(d => d.uid === uid)) return 0;

        const unitId = this.inventory[idx].unitId;
        const base = DB.find(u => u.id === unitId);
        
        // レアリティによらず一律50個に変更（ユーザー希望）
        let amount = 50; 

        // 削除と保存
        this.inventory.splice(idx, 1);
        this.addCandy(unitId, amount);
        this._cleanupEquipsForUnit(uid);
        this.save();
        
        return amount; // 獲得した飴の数を返す
    }

    consumeGems(amount) { if (this.gems >= amount) { this.gems -= amount; this.save(); return true; } return false; }
    addGems(amount) { this.gems += amount; this.save(); }
    addGold(amount) { this.gold += amount; this.save(); }
    consumeGold(amount) { if (this.gold >= amount) { this.gold -= amount; this.save(); return true; } return false; }

    // =============================================
    // ★ カード装備系メソッド
    // =============================================

    /** ユニットにカードを装備（色スロット自動判定） */
    equipCard(unitUid, cardId) {
        if (!this.cardManager) return { success: false, reason: 'no_card_manager' };
        const card = this.cardManager.getCard(cardId);
        if (!card) return { success: false, reason: 'card_not_found' };

        if (!this.unitEquips[unitUid]) {
            this.unitEquips[unitUid] = { red: null, yellow: null, blue: null, purple: null };
        }

        // 他ユニットが装備中なら外す
        for (const uid of Object.keys(this.unitEquips)) {
            const eq = this.unitEquips[uid];
            if (eq[card.color] === cardId) {
                eq[card.color] = null;
            }
        }

        // 装備先スロットに既にカードがあれば外す
        const prevCardId = this.unitEquips[unitUid][card.color];
        this.unitEquips[unitUid][card.color] = cardId;
        this.save();
        return { success: true, prevCardId: prevCardId };
    }

    /** ユニットの指定色スロットからカードを取り外し */
    unequipCard(unitUid, color) {
        if (!this.unitEquips[unitUid]) return null;
        const cardId = this.unitEquips[unitUid][color];
        this.unitEquips[unitUid][color] = null;
        this.save();
        return cardId;
    }

    /** ユニットの装備状況を取得 */
    getUnitEquips(unitUid) {
        return this.unitEquips[unitUid] || { red: null, yellow: null, blue: null, purple: null };
    }

    /** カードドロップ（生成してインベントリに追加） */
    dropCard(options = {}) {
        if (!this.cardManager) return null;
        const card = this.cardManager.generateCard(options);
        const result = this.cardManager.addCard(card);
        if (result.success) {
            this.save();
            return card;
        }
        return null; // インベントリ上限
    }

    /** ユニット売却時に装備カードを自動取り外し */
    _cleanupEquipsForUnit(uid) {
        if (this.unitEquips[uid]) {
            delete this.unitEquips[uid];
        }
    }
}
