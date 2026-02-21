/**
 * sugoroku_map.js
 * �}�b�v�f�[�^�̕ێ��A���[�g�����A���W�v�Z��S��
 */
class SugorokuMapManager {
    constructor() {
        this.data = [];
        this.stageInfo = null;
        this.tileSize = 74; // �^�C���T�C�Y��`
    }

    /**
     * �X�e�[�W�f�[�^�����[�h����
     */
    load(stageId) {
        if (typeof SUGOROKU_STAGES === 'undefined' || !SUGOROKU_STAGES[stageId]) {
            console.error("Stage Data Not Found:", stageId);
            return false;
        }
        this.stageInfo = SUGOROKU_STAGES[stageId];
        this.data = this.stageInfo.generate();
        this._validate();
        return true;
    }

  

    getStartTile() {
        return this.data.find(t => t.type === 'START') || this.data[0];
    }

   
   
    /**
     * ��ʏ�̍ő卂�����v�Z�i�X�N���[���̈�p�j
     */
    getTrackHeight() {
        const maxY = Math.max(...this.data.map(t => t.y)) + 2;
        return maxY * this.tileSize;
    }
}