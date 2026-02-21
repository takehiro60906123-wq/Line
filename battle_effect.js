/**
 * battle_effect.js - 簡易バトルエフェクトシステム v3.0
 * Canvas2Dベースのパーティクル + シェイク + フラッシュ + 集中線 + 残像
 * 呼び出しインターフェースは既存と完全互換
 */
class BattleEffect {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.particles = [];
        this.emitters = [];
        this.texts = [];
        this.flashes = [];       // 画面フラッシュ
        this.shakeAmount = 0;    // 画面シェイク
        this.shakeDecay = 0.85;
        this.speedLines = [];    // 集中線
        this.afterImages = [];   // 残像
        this.width = 0;
        this.height = 0;
        this.loopId = null;
        this.time = 0;
    }

    // ========================================================
    //  初期化・ループ
    // ========================================================
    init() {
        if (this.canvas) return;
        if (!document.body) return;

        this.canvas = document.createElement('canvas');
        this.canvas.id = 'effect-canvas';
        Object.assign(this.canvas.style, {
            position: 'fixed', top: '0', left: '0',
            width: '100%', height: '100%',
            pointerEvents: 'none', zIndex: '9000'
        });
        document.body.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.startLoop();
    }

    resize() {
        if (!this.canvas) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.canvas.style.width = this.width + 'px';
        this.canvas.style.height = this.height + 'px';
        if (this.ctx) this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    startLoop() {
        const loop = (ts) => {
            this.time = ts || 0;
            this.update();
            this.draw();
            this.loopId = requestAnimationFrame(loop);
        };
        loop(0);
    }

    // ========================================================
    //  メインアップデート
    // ========================================================
    update() {
        if (!this.ctx) return;

        // 画面シェイク処理
        if (this.shakeAmount > 0.5) {
            this.shakeAmount *= this.shakeDecay;
        } else {
            this.shakeAmount = 0;
        }

        // フラッシュ更新
      for (let i = this.flashes.length - 1; i >= 0; i--) {
            const f = this.flashes[i];
            f.alpha -= f.fade;
            f.radius *= 0.88;
            if (f.alpha <= 0) this.flashes.splice(i, 1);
        }

        // エミッター
        for (let i = this.emitters.length - 1; i >= 0; i--) {
            const e = this.emitters[i];
            e.elapsed++;
            if (e.elapsed <= e.life) {
                const progress = e.elapsed / e.life;
                const count = Math.ceil(e.countPerFrame * (1 - progress * 0.5));
                for (let j = 0; j < count; j++) this.spawnParticle(e);
            } else {
                this.emitters.splice(i, 1);
            }
        }

        // パーティクル処理
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.elapsed++;
            const progress = p.elapsed / p.totalLife;
            p.x += p.vx;
            p.y += p.vy;

            if (p.type === 'spark') {
                /* 微調整: 速度減衰と重力 */
                p.vx *= 0.85;
                p.vy *= 0.85;
                
                p.vy += (p.gravity || 0);
                p.trail.push({ x: p.x, y: p.y });
                // 最適化: 軌跡を制限
                if (p.trail.length > 4) p.trail.shift(); 
            } else if (p.type === 'ring') {
                p.radius += p.expandSpeed;
                p.alpha = 1 - progress;
            } else if (p.type === 'slash') {
                p.alpha = progress < 0.3 ? (progress / 0.3) : (1 - (progress - 0.3) / 0.7);
                p.length += p.growSpeed;
            } else if (p.type === 'pillar') {
                p.alpha = progress < 0.15 ? (progress / 0.15) : Math.max(0, 1 - (progress - 0.15) / 0.85);
                p.scaleY = progress < 0.1 ? (progress / 0.1) : 1;
            } else if (p.type === 'orb') {
                p.vx *= p.friction;
                p.vy *= p.friction;
                p.vy += (p.gravity || 0);
                p.size *= p.shrink;
                p.alpha = Math.max(0, 1 - progress * 1.2);
            } else if (p.type === 'lightning') {
                p.alpha = 1 - progress;
            } else if (p.type === 'petal') {
                p.vy += p.gravity;
                p.vx += Math.sin(p.elapsed * 0.1) * 0.1;
                p.rotation += p.rotSpeed;
                p.alpha = progress < 0.2 ? (progress / 0.2) : Math.max(0, 1 - (progress - 0.5) / 0.5);
            } else if (p.type === 'beam') {
                p.alpha = progress < 0.2 ? (progress / 0.2) : Math.max(0, 1 - (progress - 0.2) / 0.8);
                p.width *= (progress < 0.2 ? 1.15 : 0.97);
            } else {
                // デフォルト (汎用)
                p.vx *= (p.friction || 0.95);
                p.vy *= (p.friction || 0.95);
                p.vy += (p.gravity || 0);
                p.size *= (p.shrink || 0.96);
                p.alpha -= (p.fade || 0.02);
            }

            if (p.elapsed >= p.totalLife || p.alpha <= 0 || (p.size !== undefined && p.size < 0.2)) {
                this.particles.splice(i, 1);
            }
        }

        // 集中線
        for (let i = this.speedLines.length - 1; i >= 0; i--) {
            const s = this.speedLines[i];
            s.elapsed++;
            s.alpha = Math.max(0, 1 - s.elapsed / s.totalLife);
            if (s.elapsed >= s.totalLife) this.speedLines.splice(i, 1);
        }

        // テキスト
        for (let i = this.texts.length - 1; i >= 0; i--) {
            const t = this.texts[i];
            t.elapsed++;
            t.scale += (t.targetScale - t.scale) * 0.12;
            const progress = t.elapsed / t.totalLife;
            t.alpha = progress > 0.7 ? Math.max(0, 1 - (progress - 0.7) / 0.3) : 1;
            if (t.elapsed >= t.totalLife) this.texts.splice(i, 1);
        }

        // 残像
        for (let i = this.afterImages.length - 1; i >= 0; i--) {
            const a = this.afterImages[i];
            a.alpha -= 0.04;
            if (a.alpha <= 0) this.afterImages.splice(i, 1);
        }
    }

    // ========================================================
    //  描画処理
    // ========================================================
    draw() {
        if (!this.ctx) return;
        const c = this.ctx;
        const W = this.width;
        const H = this.height;

        c.save();
        c.clearRect(0, 0, W, H);

        // 画面シェイク
        if (this.shakeAmount > 0) {
            const sx = (Math.random() - 0.5) * this.shakeAmount;
            const sy = (Math.random() - 0.5) * this.shakeAmount;
            c.translate(sx, sy);
        }

        // テキスト背景（黒）
        if (this.texts.length > 0) {
            const maxAlpha = Math.max(...this.texts.map(t => t.alpha));
            c.fillStyle = `rgba(0, 0, 0, ${0.6 * maxAlpha})`;
            c.fillRect(-20, -20, W + 40, H + 40);
        }

        // 集中線（lighter合成）
        if (this.speedLines.length > 0) {
            c.save();
            c.globalCompositeOperation = 'lighter';
            for (const s of this.speedLines) {
                c.strokeStyle = `rgba(${s.color}, ${s.alpha * 0.5})`;
                c.lineWidth = s.width;
                c.beginPath();
                c.moveTo(s.x1, s.y1);
                c.lineTo(s.x2, s.y2);
                c.stroke();
            }
            c.restore();
        }

        // パーティクル描画
        c.save();
        c.globalCompositeOperation = 'lighter';

        for (const p of this.particles) {
            if (p.alpha <= 0) continue;

            if (p.type === 'spark') {
                this._drawSpark(c, p);
            } else if (p.type === 'ring') {
                this._drawRing(c, p);
            } else if (p.type === 'slash') {
                this._drawSlash(c, p);
            } else if (p.type === 'pillar') {
                this._drawPillar(c, p);
            } else if (p.type === 'orb') {
                this._drawOrb(c, p);
            } else if (p.type === 'lightning') {
                this._drawLightning(c, p);
            } else if (p.type === 'petal') {
                this._drawPetal(c, p);
            } else if (p.type === 'beam') {
                this._drawBeam(c, p);
            } else {
                this._drawOrb(c, p);
            }
        }
        c.restore();

        // フラッシュ (source-over)
      for (const f of this.flashes) {
            const grd = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.radius);
            grd.addColorStop(0, `rgba(${f.color}, ${Math.max(0, f.alpha)})`);
            grd.addColorStop(0.6, `rgba(${f.color}, ${Math.max(0, f.alpha * 0.4)})`);
            grd.addColorStop(1, `rgba(${f.color}, 0)`);
            c.fillStyle = grd;
            c.fillRect(-20, -20, W + 40, H + 40);
        }

        // テキスト
        c.globalCompositeOperation = 'source-over';
        for (const t of this.texts) {
            this._drawText(c, t);
        }

        c.restore();
    }

    // ========================================================
    //  パーティクル描画ヘルパー
    // ========================================================
    _drawSpark(c, p) {
        // 軌跡描画
        if (p.trail.length > 1) {
            for (let i = 1; i < p.trail.length; i++) {
                const ratio = i / p.trail.length;
                c.strokeStyle = `rgba(${p.color}, ${p.alpha * ratio * 0.5})`;
                c.lineWidth = p.size * ratio;
                c.beginPath();
                c.moveTo(p.trail[i - 1].x, p.trail[i - 1].y);
                c.lineTo(p.trail[i].x, p.trail[i].y);
                c.stroke();
            }
        }
        // 核のグロー
        const grd = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
        grd.addColorStop(0, `rgba(${p.coreColor || '255,255,255'}, ${p.alpha})`);
        grd.addColorStop(0.4, `rgba(${p.color}, ${p.alpha * 0.6})`);
        grd.addColorStop(1, `rgba(${p.color}, 0)`);
        c.fillStyle = grd;
        c.beginPath();
        c.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        c.fill();
    }

    _drawRing(c, p) {
        c.strokeStyle = `rgba(${p.color}, ${p.alpha})`;
        c.lineWidth = p.lineWidth * (1 - p.elapsed / p.totalLife);
        c.beginPath();
        c.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        c.stroke();
        // インナーグロー
        c.strokeStyle = `rgba(255,255,255, ${p.alpha * 0.5})`;
        c.lineWidth = Math.max(1, c.lineWidth * 0.4);
        c.stroke();
    }

    _drawSlash(c, p) {
        c.save();
        c.translate(p.x, p.y);
        c.rotate(p.angle);
        // ラインスラッシュ
        const grad = c.createLinearGradient(-p.length / 2, 0, p.length / 2, 0);
        grad.addColorStop(0, `rgba(${p.color}, 0)`);
        grad.addColorStop(0.3, `rgba(${p.color}, ${p.alpha})`);
        grad.addColorStop(0.5, `rgba(255,255,255, ${p.alpha})`);
        grad.addColorStop(0.7, `rgba(${p.color}, ${p.alpha})`);
        grad.addColorStop(1, `rgba(${p.color}, 0)`);
        c.fillStyle = grad;
        c.fillRect(-p.length / 2, -p.thickness / 2, p.length, p.thickness);
        // ブライトコア
        c.fillStyle = `rgba(255,255,255, ${p.alpha * 0.8})`;
        c.fillRect(-p.length / 2, -p.thickness * 0.15, p.length, p.thickness * 0.3);
        c.restore();
    }

    _drawPillar(c, p) {
        c.save();
        c.translate(p.x, p.y);
        c.scale(1, p.scaleY || 1);
        const grad = c.createLinearGradient(0, 0, 0, -p.height);
        grad.addColorStop(0, `rgba(${p.color}, ${p.alpha})`);
        grad.addColorStop(0.5, `rgba(${p.color}, ${p.alpha * 0.6})`);
        grad.addColorStop(1, `rgba(${p.color}, 0)`);
        c.fillStyle = grad;
        c.fillRect(-p.w / 2, -p.height, p.w, p.height);
        // 光柱
        c.fillStyle = `rgba(255,255,255, ${p.alpha * 0.5})`;
        c.fillRect(-p.w * 0.15, -p.height, p.w * 0.3, p.height);
        c.restore();
    }

    _drawOrb(c, p) {
        const grd = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        grd.addColorStop(0, `rgba(255,255,255, ${p.alpha})`);
        grd.addColorStop(0.3, `rgba(${p.color}, ${p.alpha})`);
        grd.addColorStop(1, `rgba(${p.color}, 0)`);
        c.fillStyle = grd;
        c.beginPath();
        c.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        c.fill();
    }

    _drawLightning(c, p) {
        if (!p.path || p.path.length < 2) return;
        // グロー
        c.strokeStyle = `rgba(${p.color}, ${p.alpha * 0.3})`;
        c.lineWidth = p.size * 4;
        c.lineJoin = 'round';
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(p.path[0].x, p.path[0].y);
        for (let i = 1; i < p.path.length; i++) c.lineTo(p.path[i].x, p.path[i].y);
        c.stroke();
        // メインボルト
        c.strokeStyle = `rgba(255,255,255, ${p.alpha})`;
        c.lineWidth = p.size;
        c.beginPath();
        c.moveTo(p.path[0].x, p.path[0].y);
        for (let i = 1; i < p.path.length; i++) c.lineTo(p.path[i].x, p.path[i].y);
        c.stroke();
    }

    _drawPetal(c, p) {
        c.save();
        c.translate(p.x, p.y);
        c.rotate(p.rotation);
        c.fillStyle = `rgba(${p.color}, ${p.alpha})`;
        c.beginPath();
        c.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = `rgba(255,255,255, ${p.alpha * 0.5})`;
        c.beginPath();
        c.ellipse(0, 0, p.size * 0.5, p.size * 0.25, 0, 0, Math.PI * 2);
        c.fill();
        c.restore();
    }

    _drawBeam(c, p) {
        c.save();
        c.translate(p.x, p.y);
        c.rotate(p.angle);
        const grad = c.createLinearGradient(-p.length / 2, 0, p.length / 2, 0);
        grad.addColorStop(0, `rgba(${p.color}, 0)`);
        grad.addColorStop(0.1, `rgba(${p.color}, ${p.alpha})`);
        grad.addColorStop(0.5, `rgba(255,255,255, ${p.alpha})`);
        grad.addColorStop(0.9, `rgba(${p.color}, ${p.alpha})`);
        grad.addColorStop(1, `rgba(${p.color}, 0)`);
        c.fillStyle = grad;
        c.fillRect(-p.length / 2, -p.width / 2, p.length, p.width);
        c.restore();
    }

    _drawText(c, t) {
        c.save();
        c.globalCompositeOperation = 'source-over';
        c.translate(this.width / 2, this.height * 0.42);
        c.scale(t.scale, t.scale);
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        // 外枠グロー
        c.shadowColor = t.glowColor || t.color;
        c.shadowBlur = 30 * t.alpha;
        c.font = `900 ${t.fontSize || 60}px "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif`;
        c.strokeStyle = `rgba(0,0,0, ${t.alpha})`;
        c.lineWidth = 6;
        c.strokeText(t.text, 0, 0);
        c.fillStyle = t.color.replace(')', `, ${t.alpha})`).replace('rgb', 'rgba');
        // rgbならrgbaに、既定でrgbaならそのまま
        if (!t.color.startsWith('rgba')) {
            c.fillStyle = t.color;
            c.globalAlpha = t.alpha;
        }
        c.fillText(t.text, 0, 0);
        // 白ハイライト
        c.fillStyle = `rgba(255,255,255, ${t.alpha * 0.3})`;
        c.fillText(t.text, 0, -2);
        c.restore();
    }

    // ========================================================
    //  外部呼び出し
    // ========================================================
   addFlash(color = '255,255,255', alpha = 0.8, fade = 0.06, x, y) {
        this.flashes.push({
            color, alpha, fade,
            x: (x !== undefined) ? x : this.width / 2,
            y: (y !== undefined) ? y : this.height / 2,
            maxRadius: Math.sqrt(this.width * this.width + this.height * this.height) * 0.7,
            radius: Math.sqrt(this.width * this.width + this.height * this.height) * 0.7,
            startAlpha: alpha
        });
    }

    addShake(amount = 12) {
        this.shakeAmount = Math.max(this.shakeAmount, amount);
    }

    addSpeedLines(cx, cy, count = 30, color = '255,255,200', life = 15) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const innerR = 30 + Math.random() * 40;
            const outerR = this.width * 0.4 + Math.random() * this.width * 0.25;
            this.speedLines.push({
                x1: cx + Math.cos(angle) * innerR,
                y1: cy + Math.sin(angle) * innerR,
                x2: cx + Math.cos(angle) * outerR,
                y2: cy + Math.sin(angle) * outerR,
                color, alpha: 0.6 + Math.random() * 0.4,
                width: 1 + Math.random() * 3,
                elapsed: 0, totalLife: life + Math.random() * 10
            });
        }
    }

    // ========================================================
    //  パーティクル生成ヘルパー
    // ========================================================

    spawnParticle(e) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * (e.speed || 5);
        const spreadX = e.spreadX || 1;
        this.particles.push({
            type: 'spark',
            x: e.x + (Math.random() - 0.5) * (e.spread || 0),
            y: e.y + (Math.random() - 0.5) * (e.spread || 0),
            vx: Math.cos(angle) * speed * spreadX,
            vy: Math.sin(angle) * speed + (e.velocityY || 0),
            size: (e.particleSize || 3) + Math.random() * 4,
            color: e.color || '255,255,255',
            coreColor: e.coreColor || '255,255,255',
            alpha: 1, 
            
            /* 微調整: 重力を弱めに */
            gravity: (e.gravity !== undefined) ? e.gravity : 0.02, 
            
            trail: [],
            elapsed: 0, 
            
            /* 微調整: 寿命を短めに */
            totalLife: 10 + Math.random() * 10
        });
    }

    addEmitter(params) {
        this.emitters.push({
            x: params.x, y: params.y,
            life: params.life || 10,
            countPerFrame: params.count || 5,
            color: params.color || '255,255,255',
            coreColor: params.coreColor,
            speed: params.speed || 5,
            gravity: params.gravity || 0.15,
            velocityY: params.velocityY || 0,
            spreadX: params.spreadX || 1,
            spread: params.spread || 0,
            particleSize: params.particleSize || 3,
            elapsed: 0
        });
    }

    // ========================================================
    //  エフェクト: 斬撃系 (SMASH, MULTI, ASSASSIN, NORMAL)
    // ========================================================
   createSlash(x, y) {
        const mainAngle = -Math.PI / 4 + (Math.random() - 0.5) * 0.3;
        this.particles.push({
            type: 'slash', x, y,
            angle: mainAngle,
            length: 18, growSpeed: 24,
            thickness: 11,
            color: '200, 255, 255',
            alpha: 0, elapsed: 0, totalLife: 18, vx: 0, vy: 0
        });
        // 追撃斬り (遅延)
         setTimeout(() => {
            this.particles.push({
                type: 'slash', x: x + 10, y: y - 5,
                angle: mainAngle + Math.PI / 3,
                length: 12, growSpeed: 21,
                thickness: 7,
                color: '150, 220, 255',
                alpha: 0, elapsed: 0, totalLife: 15, vx: 0, vy: 0
            });
        }, 50);
        // インパクトリング
       this.particles.push({
            type: 'ring', x, y,
            radius: 5, expandSpeed: 5,
            lineWidth: 3,
            color: '200, 255, 255',
            alpha: 1, elapsed: 0, totalLife: 12, vx: 0, vy: 0
        });
        // 火花
       this.addEmitter({
            x, y, color: '255, 220, 100', coreColor: '255,255,255',
            count: 5, speed: 9, life: 4, spreadX: 1.2, gravity: 0.3, particleSize: 2
        });
       this.addShake(5);
        this.addFlash('255,255,255', 0.2, 0.06);
    }

   createMultiSlash(x, y, count = 3) {
        for (let i = 0; i < count; i++) {
            setTimeout(() => {
                const ox = (Math.random() - 0.5) * 40;
                const oy = (Math.random() - 0.5) * 40;
                this.particles.push({
                    type: 'slash', x: x + ox, y: y + oy,
                    angle: (Math.random() - 0.5) * Math.PI,
                    length: 12, growSpeed: 18,
                    thickness: 6,
                    color: '255, 200, 100',
                    alpha: 0, elapsed: 0, totalLife: 12, vx: 0, vy: 0
                });
                this.addEmitter({
                    x: x + ox, y: y + oy,
                    color: '255, 200, 50', count: 3, speed: 6,
                    life: 2, gravity: 0.2, particleSize: 2
                });
                this.addShake(3);
            }, i * 80);
        }
        setTimeout(() => {
            this.addFlash('255,200,50', 0.2, 0.05);
            this.addSpeedLines(x, y, 9, '255,200,100', 10);
        }, count * 80);
    }


    // ========================================================
    //  エフェクト: 爆発系 (BLAST, SPLASH)
    // ========================================================
    createExplosion(x, y) {
        this.addFlash('255,150,50', 0.3, 0.04);
        this.addShake(11);
        this.particles.push({
            type: 'ring', x, y,
            radius: 5, expandSpeed: 7,
            lineWidth: 5,
            color: '255, 150, 50',
            alpha: 1, elapsed: 0, totalLife: 15, vx: 0, vy: 0
        });
        setTimeout(() => {
            this.particles.push({
                type: 'ring', x, y,
                radius: 5, expandSpeed: 4,
                lineWidth: 3,
                color: '255, 80, 0',
                alpha: 1, elapsed: 0, totalLife: 20, vx: 0, vy: 0
            });
        }, 60);
        this.particles.push({
            type: 'orb', x, y, vx: 0, vy: 0,
            size: 48, color: '255, 200, 50',
            alpha: 1, friction: 1, shrink: 0.92, gravity: 0,
            elapsed: 0, totalLife: 20
        });
        this.addEmitter({
            x, y, color: '255, 100, 0', coreColor: '255,255,200',
            count: 9, speed: 12, life: 6,
            spreadX: 1.0, gravity: 0.4, particleSize: 2
        });
        for (let i = 0; i < 5; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * 30;
            this.particles.push({
                type: 'orb',
                x: x + Math.cos(angle) * dist,
                y: y + Math.sin(angle) * dist,
                vx: Math.cos(angle) * 2, vy: Math.sin(angle) * 2 - 1,
                size: 12 + Math.random() * 18,
                color: '100, 80, 60',
                alpha: 0.5, friction: 0.97, shrink: 1.01, gravity: -0.05,
                elapsed: 0, totalLife: 30 + Math.random() * 15
            });
        }
        this.addSpeedLines(x, y, 15, '255,150,50', 12);
    }

    // ========================================================
    //  エフェクト: 回復系 (HEAL, HEAL_ALL, REGEN)
    // ========================================================
    createHeal(x, y) {
        for (let i = 0; i < 9; i++) {
            setTimeout(() => {
                this.particles.push({
                    type: 'petal',
                    x: x + (Math.random() - 0.5) * 36,
                    y: y + 12 + Math.random() * 18,
                    vx: (Math.random() - 0.5) * 1.5,
                    vy: -2 - Math.random() * 3,
                    size: 4 + Math.random() * 6,
                    color: '100, 255, 180',
                    alpha: 0, gravity: -0.02,
                    rotation: Math.random() * Math.PI * 2,
                    rotSpeed: (Math.random() - 0.5) * 0.1,
                    elapsed: 0, totalLife: 50 + Math.random() * 20
                });
            }, i * 40);
        }
        this.particles.push({
            type: 'ring', x, y: y + 20,
            radius: 40, expandSpeed: -0.5,
            lineWidth: 3,
            color: '100, 255, 200',
            alpha: 1, elapsed: 0, totalLife: 30, vx: 0, vy: -1.5
        });
        this.particles.push({
            type: 'orb', x, y, vx: 0, vy: 0,
            size: 36, color: '100, 255, 150',
            alpha: 0.4, friction: 1, shrink: 0.98, gravity: 0,
            elapsed: 0, totalLife: 35
        });
    }

    // ========================================================
    //  エフェクト: 狙撃系 (SNIPE, ASSASSIN)
    // ========================================================
   createSnipe(x, y) {
        this.addSpeedLines(x, y, 24, '255, 100, 255', 8);
        this.addFlash('255,200,255', 0.25, 0.06);
        this.addShake(6);
        this.particles.push({
            type: 'beam', x, y, angle: 0,
            length: this.width * 1.5, width: 4,
            color: '255, 50, 255',
            alpha: 0, elapsed: 0, totalLife: 15, vx: 0, vy: 0
        });
        this.particles.push({
            type: 'beam', x, y, angle: Math.PI / 2,
            length: this.height * 1.5, width: 4,
            color: '255, 50, 255',
            alpha: 0, elapsed: 0, totalLife: 15, vx: 0, vy: 0
        });
        this.particles.push({
            type: 'ring', x, y,
            radius: 3, expandSpeed: 9,
            lineWidth: 2,
            color: '255, 150, 255',
            alpha: 1, elapsed: 0, totalLife: 10, vx: 0, vy: 0
        });
        this.addEmitter({
            x, y, color: '255, 0, 255', coreColor: '255,200,255',
            count: 9, speed: 15, life: 2, spreadX: 0.5, gravity: 0, particleSize: 2
        });
    }

    // ========================================================
    //  エフェクト: 吸血 (VAMP)
    // ========================================================
    createVamp(x, y) {
        for (let i = 0; i < 12; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 36 + Math.random() * 24;
            this.particles.push({
                type: 'orb',
                x: x + Math.cos(angle) * dist,
                y: y + Math.sin(angle) * dist,
                vx: -Math.cos(angle) * 3,
                vy: -Math.sin(angle) * 3,
                size: 5 + Math.random() * 5,
                color: '180, 0, 255',
                alpha: 0.8, friction: 0.95, shrink: 0.97, gravity: 0,
                elapsed: 0, totalLife: 25
            });
        }
        this.particles.push({
            type: 'orb', x, y, vx: 0, vy: 0,
            size: 24, color: '120, 0, 200',
            alpha: 0.6, friction: 1, shrink: 0.96, gravity: 0,
            elapsed: 0, totalLife: 30
        });
        this.addEmitter({
            x, y, color: '200, 50, 255', count: 5, speed: 3,
            gravity: -0.3, life: 20, particleSize: 2
        });
    }

    // ========================================================
    //  エフェクト: デバフ (DEBUFF) - 暗いオーラ降下
    // ========================================================
    createDebuff(x, y) {
        // 暗い紫のオーラが降りてくるイメージ
        for (let i = 0; i < 8; i++) {
            this.particles.push({
                type: 'orb',
                x: x + (Math.random() - 0.5) * 40,
                y: y - 40 - Math.random() * 30,
                vx: (Math.random() - 0.5) * 1,
                vy: 2 + Math.random() * 2,
                size: 8 + Math.random() * 6,
                color: '100, 0, 150',
                alpha: 0.7, friction: 0.98, shrink: 0.96, gravity: 0.1,
                elapsed: 0, totalLife: 25
            });
        }
        // 暗い下矢印パーティクル
        this.addEmitter({
            x, y: y - 20, color: '150, 50, 200', count: 6, speed: 2,
            gravity: 0.3, life: 20, particleSize: 3
        });
        // リングエフェクト（暗い色）
        this.particles.push({
            type: 'ring', x, y,
            radius: 5, expandSpeed: 3,
            lineWidth: 3,
            color: '120, 0, 180',
            alpha: 0.7, elapsed: 0, totalLife: 15, vx: 0, vy: 0
        });
        this.addShake(3);
    }

    // ========================================================
    //  エフェクト: 毒 (POISON) - 緑の泡が湧き上がる
    // ========================================================
    createPoison(x, y) {
        // 緑の泡が下から湧き上がるイメージ
        for (let i = 0; i < 10; i++) {
            const delay = i * 2;
            this.particles.push({
                type: 'orb',
                x: x + (Math.random() - 0.5) * 30,
                y: y + 10 + Math.random() * 20,
                vx: (Math.random() - 0.5) * 1.5,
                vy: -(2 + Math.random() * 3),
                size: 4 + Math.random() * 6,
                color: '0, 200, 50',
                alpha: 0.8, friction: 0.98, shrink: 0.97, gravity: -0.05,
                elapsed: -delay, totalLife: 30
            });
        }
        // 毒々しいリング
        this.particles.push({
            type: 'ring', x, y,
            radius: 3, expandSpeed: 2,
            lineWidth: 2,
            color: '50, 255, 50',
            alpha: 0.6, elapsed: 0, totalLife: 20, vx: 0, vy: 0
        });
        this.addEmitter({
            x, y, color: '0, 180, 80', count: 4, speed: 1.5,
            gravity: -0.2, life: 25, particleSize: 3
        });
    }

    // ========================================================
    //  エフェクト: スタン (STUN) - 星がくるくる回る
    // ========================================================
    createStun(x, y) {
        // 星のパーティクルが頭上を旋回
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI * 2 / 6) * i;
            this.particles.push({
                type: 'orb',
                x: x + Math.cos(angle) * 20,
                y: y - 20 + Math.sin(angle) * 10,
                vx: Math.cos(angle + Math.PI/2) * 3,
                vy: Math.sin(angle + Math.PI/2) * 1.5,
                size: 5 + Math.random() * 3,
                color: '255, 255, 0',
                alpha: 0.9, friction: 0.96, shrink: 0.95, gravity: 0,
                elapsed: 0, totalLife: 30
            });
        }
        // フラッシュ
        this.particles.push({
            type: 'ring', x, y: y - 15,
            radius: 2, expandSpeed: 2,
            lineWidth: 2,
            color: '255, 255, 100',
            alpha: 0.8, elapsed: 0, totalLife: 12, vx: 0, vy: 0
        });
        this.addShake(4);
    }

    // ★睡眠エフェクト: 青い泡がふわふわ上昇
    createSleep(x, y) {
        for (let i = 0; i < 8; i++) {
            this.particles.push({
                type: 'orb',
                x: x + (Math.random() - 0.5) * 30,
                y: y - 10,
                vx: (Math.random() - 0.5) * 0.8,
                vy: -1.5 - Math.random() * 1.5,
                size: 4 + Math.random() * 5,
                color: '100, 150, 255',
                alpha: 0.7, friction: 0.98, shrink: 0.97, gravity: -0.02,
                elapsed: i * 3, totalLife: 35
            });
        }
        this.particles.push({
            type: 'ring', x, y: y - 15,
            radius: 2, expandSpeed: 1.2,
            lineWidth: 2, color: '120, 160, 255',
            alpha: 0.5, elapsed: 0, totalLife: 20, vx: 0, vy: 0
        });
    }

    // ★麻痺エフェクト: 黄色い電撃スパーク
    createParalyze(x, y) {
        for (let i = 0; i < 10; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = 10 + Math.random() * 25;
            this.particles.push({
                type: 'orb',
                x: x + Math.cos(a) * r,
                y: y + Math.sin(a) * r,
                vx: Math.cos(a) * 4,
                vy: Math.sin(a) * 4,
                size: 2 + Math.random() * 3,
                color: '255, 230, 50',
                alpha: 0.9, friction: 0.88, shrink: 0.93, gravity: 0,
                elapsed: 0, totalLife: 18
            });
        }
        this.particles.push({
            type: 'ring', x, y,
            radius: 1, expandSpeed: 5,
            lineWidth: 3, color: '255, 255, 100',
            alpha: 0.9, elapsed: 0, totalLife: 8, vx: 0, vy: 0
        });
        this.addShake(3);
    }

    // ★暗闇エフェクト: 暗い霧が覆う
    createBlind(x, y) {
        for (let i = 0; i < 12; i++) {
            this.particles.push({
                type: 'orb',
                x: x + (Math.random() - 0.5) * 40,
                y: y + (Math.random() - 0.5) * 30,
                vx: (Math.random() - 0.5) * 1.5,
                vy: (Math.random() - 0.5) * 1.0,
                size: 8 + Math.random() * 10,
                color: '30, 20, 50',
                alpha: 0.6, friction: 0.97, shrink: 0.96, gravity: 0,
                elapsed: i * 2, totalLife: 30
            });
        }
        this.particles.push({
            type: 'ring', x, y,
            radius: 5, expandSpeed: 2,
            lineWidth: 4, color: '60, 40, 80',
            alpha: 0.7, elapsed: 0, totalLife: 15, vx: 0, vy: 0
        });
    }

    // ★混乱エフェクト: 多色の渦
    createConfuse(x, y) {
        const colors = ['255,100,100', '100,255,100', '100,100,255', '255,255,100'];
        for (let i = 0; i < 10; i++) {
            const angle = (Math.PI * 2 / 10) * i;
            const c = colors[i % colors.length];
            this.particles.push({
                type: 'orb',
                x: x + Math.cos(angle) * 18,
                y: y - 15 + Math.sin(angle) * 10,
                vx: Math.cos(angle + Math.PI/2) * 2.5,
                vy: Math.sin(angle + Math.PI/2) * 2.0,
                size: 4 + Math.random() * 3,
                color: c,
                alpha: 0.8, friction: 0.95, shrink: 0.95, gravity: 0,
                elapsed: 0, totalLife: 25
            });
        }
        this.particles.push({
            type: 'ring', x, y: y - 10,
            radius: 3, expandSpeed: 1.5,
            lineWidth: 2, color: '200, 100, 255',
            alpha: 0.6, elapsed: 0, totalLife: 18, vx: 0, vy: 0
        });
    }


    // ========================================================
    //  エフェクト: ライン攻撃 (LINE_H, LINE_V)
    // ========================================================
  // battle_effect.js 

    createLineSlash(x, y, dir) {
        const isH = (dir === 'horizontal');
        const angle = isH ? 0 : Math.PI / 2;
        const color = isH ? '100, 255, 255' : '255, 80, 80';
        
        // 微調整: 範囲を短めに
        const length = isH ? this.width * 0.8 : this.height * 0.5;

        this.particles.push({
            type: 'beam', x, y, angle,
            length, 
            width: 8, // 微調整
            color,
            alpha: 0, elapsed: 0, totalLife: 15, vx: 0, vy: 0 
        });
        this.particles.push({
            type: 'beam', x, y, angle,
            length: length * 0.9, 
            width: 3, // 微調整
            color: '255, 255, 255',
            alpha: 0, elapsed: 0, totalLife: 15, vx: 0, vy: 0
        });
        this.addEmitter({
            x, y, color, count: 6, speed: 9,
            life: 5, spreadX: isH ? 2.4 : 0.3,
            gravity: 0.1, particleSize: 2
        });
        this.addShake(3); 
        this.addFlash('255,255,255', 0.1, 0.05);
    }


    // ========================================================
    //  エフェクト: 十字爆発 (CROSS)
    // ========================================================
    // battle_effect.js 

    createCrossExplosion(x, y) {
        const color = '255, 200, 50';
        
        // 微調整: 範囲を調整
        const lenH = this.width * 0.8;
        const lenV = this.height * 0.5;
        const width = 8; // 微調整

        // 横ビーム
        this.particles.push({
            type: 'beam', x, y, angle: 0,
            length: lenH, width: width,
            color,
            alpha: 0, elapsed: 0, totalLife: 15, vx: 0, vy: 0
        });
        // 縦ビーム
        this.particles.push({
            type: 'beam', x, y, angle: Math.PI / 2,
            length: lenV, width: width,
            color,
            alpha: 0, elapsed: 0, totalLife: 15, vx: 0, vy: 0
        });
        
        // 白芯（横）
        this.particles.push({
            type: 'beam', x, y, angle: 0,
            length: lenH * 0.8, width: 3, 
            color: '255, 255, 255',
            alpha: 0, elapsed: 0, totalLife: 12, vx: 0, vy: 0
        });
        // 白芯（縦）
        this.particles.push({
            type: 'beam', x, y, angle: Math.PI / 2,
            length: lenV * 0.8, width: 3, 
            color: '255, 255, 255',
            alpha: 0, elapsed: 0, totalLife: 12, vx: 0, vy: 0
        });

        // 爆発リング
        this.particles.push({
            type: 'ring', x, y,
            radius: 5, expandSpeed: 6,
            lineWidth: 2, 
            color,
            alpha: 1, elapsed: 0, totalLife: 15, vx: 0, vy: 0
        });
        
        this.addEmitter({
            x, y, color: '255, 230, 100', count: 7, speed: 11,
            life: 5, gravity: 0.2, particleSize: 2
        });
        this.addShake(5); 
        this.addFlash('255,220,100', 0.15, 0.04); 
    }

    // ========================================================
    //  エフェクト: バフ (BUFF)
    // ========================================================
    async playBuffActive(el) {
        if (!this.canvas) this.init();
        if (!this.canvas || !el) return;
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        this.particles.push({
            type: 'pillar', x: cx, y: r.bottom,
            w: r.width * 0.36, height: r.height * 1.5,
            scaleY: 0,
            color: '255, 230, 100',
            alpha: 0, elapsed: 0, totalLife: 40, vx: 0, vy: 0
        });
        this.addEmitter({
            x: cx, y: r.bottom,
            color: '255, 255, 200', count: 4, speed: 3,
            gravity: 0, velocityY: -4, life: 5,
            spreadX: 0.3, particleSize: 3
        });
        this.particles.push({
            type: 'ring', x: cx, y: cy,
            radius: 5, expandSpeed: 3,
            lineWidth: 2,
            color: '255, 220, 100',
            alpha: 0.8, elapsed: 0, totalLife: 25, vx: 0, vy: 0
        });
    }

    // ========================================================
    //  エフェクト: 登場演出 (playEntrance)
    // ========================================================
  async playEntrance(side) {
        if (!this.canvas) this.init();
        if (!this.canvas) return;

        const endY = side === 'player' ? this.height * 0.7 : this.height * 0.3;
        const color = side === 'player' ? '100, 200, 255' : '255, 80, 180';
        const cx = this.width / 2;

        // --- Phase 1: ランダムに落雷 (3本、シェイクあり) ---
        for (let i = 0; i < 3; i++) {
            const bx = this.width * (0.15 + 0.7 * Math.random());
            const path = this._generateLightningPath(bx, -10, bx + (Math.random() - 0.5) * 80, endY);
            this.particles.push({
                type: 'lightning',
                x: 0, y: 0, vx: 0, vy: 0,
                path, size: 3 + Math.random() * 2,
                color,
                alpha: 1, elapsed: 0, totalLife: 18
            });
            // 分岐
            if (Math.random() > 0.3) {
                const branchIdx = Math.floor(path.length * 0.4 + Math.random() * path.length * 0.3);
                const branchPt = path[branchIdx];
                if (branchPt) {
                    const subPath = this._generateLightningPath(
                        branchPt.x, branchPt.y,
                        branchPt.x + (Math.random() - 0.5) * 100,
                        branchPt.y + 40 + Math.random() * 60
                    );
                    this.particles.push({
                        type: 'lightning',
                        x: 0, y: 0, vx: 0, vy: 0,
                        path: subPath, size: 1.5,
                        color,
                        alpha: 0.7, elapsed: 0, totalLife: 12
                    });
                }
            }
            // タイミングごとにフラッシュ＋Shake
            this.addFlash(side === 'player' ? '100,200,255' : '255,80,180', 0.15, 0.08);
            this.addShake(3);
            await new Promise(r => setTimeout(r, 100));
        }

        // --- Phase 2: 着弾点に爆発 ---
        this.particles.push({
            type: 'ring', x: cx, y: endY,
            radius: 5, expandSpeed: 8,
            lineWidth: 4,
            color,
            alpha: 1, elapsed: 0, totalLife: 18, vx: 0, vy: 0
        });
        this.particles.push({
            type: 'ring', x: cx, y: endY,
            radius: 5, expandSpeed: 4,
            lineWidth: 2,
            color: '255, 255, 255',
            alpha: 0.6, elapsed: 0, totalLife: 22, vx: 0, vy: 0
        });
        this.particles.push({
            type: 'orb', x: cx, y: endY, vx: 0, vy: 0,
            size: 40, color: side === 'player' ? '100, 200, 255' : '255, 80, 180',
            alpha: 0.9, friction: 1, shrink: 0.90, gravity: 0,
            elapsed: 0, totalLife: 18
        });
        this.addEmitter({
            x: cx, y: endY,
            color: side === 'player' ? '150, 220, 255' : '255, 150, 200',
            coreColor: '255,255,255',
            count: 8, speed: 12, life: 2,
            spreadX: 1.5, gravity: 0.2, particleSize: 2
        });
        this.addSpeedLines(cx, endY, 12, color, 10);

        // --- Phase 3: 大きなフラッシュ＋Shake (仕上げ) ---
        this.addFlash('255,255,255', 0.4, 0.06);
        this.addShake(7);
    }

    _generateLightningPath(x1, y1, x2, y2) {
        const path = [{ x: x1, y: y1 }];
        const steps = 12 + Math.floor(Math.random() * 8);
        const dx = (x2 - x1) / steps;
        const dy = (y2 - y1) / steps;
        let cx = x1, cy = y1;
        for (let i = 0; i < steps; i++) {
            cx += dx + (Math.random() - 0.5) * 50;
            cy += dy;
            path.push({ x: cx, y: cy });
        }
        path.push({ x: x2, y: y2 });
        return path;
    }

    // ========================================================
    //  エフェクト: カットイン (playCutin)
    // ========================================================
    async playCutin(text, colorCss = '#ffd700', sub, img) {
        if (!this.canvas) this.init();
        if (!this.canvas) return;

        this.texts.push({
            text,
            scale: 3.0, targetScale: 1.0,
            alpha: 1, fontSize: 36,
            color: colorCss,
            glowColor: colorCss,
            elapsed: 0, totalLife: 85
        });
        this.addEmitter({
            x: this.width / 2, y: this.height * 0.42,
            color: '255, 220, 100', count: 2, speed: 4,
            life: 20, spreadX: 2, gravity: 0.05,
            particleSize: 2, spread: 100
        });
    }

    // ========================================================
    //  呼び出しインターフェース (外部互換)
    // ========================================================
    async play(type, targetElem) {
        if (!this.canvas) this.init();
        if (!this.canvas || !targetElem) return;
        const rect = targetElem.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;

        switch (type) {
            case 'SMASH':
                this.createSlash(x, y);
                this.addSpeedLines(x, y, 15, '200,255,255', 10);
                break;

            case 'MULTI':
                this.createMultiSlash(x, y, 3);
                break;

            case 'ASSASSIN':
                this.createSlash(x, y);
                this.createSnipe(x, y);
                this.addShake(8);
                break;

            case 'BLAST':
            case 'SPLASH':
                this.createExplosion(x, y);
                break;

            case 'HEAL':
            case 'HEAL_ALL':
            case 'REGEN':
                this.createHeal(x, y);
                break;

            case 'SNIPE':
                this.createSnipe(x, y);
                break;

            case 'VAMP':
                this.createVamp(x, y);
                break;

            case 'BUFF':
                await this.playBuffActive(targetElem);
                break;

            case 'DEBUFF':
                this.createDebuff(x, y);
                break;

            case 'POISON':
                this.createPoison(x, y);
                break;

            case 'STUN':
                this.createStun(x, y);
                break;

            case 'SLEEP':
                this.createSleep(x, y);
                break;

            case 'PARALYZE':
                this.createParalyze(x, y);
                break;

            case 'BLIND':
                this.createBlind(x, y);
                break;

            case 'CONFUSE':
                this.createConfuse(x, y);
                break;

            case 'INVINCIBLE_BUFF':
            case 'HALF_DMG_BUFF':
            case 'SPD_UP_BUFF':
            case 'STATUS_RESIST_BUFF':
                await this.playBuffActive(targetElem);
                break;

            case 'LINE_H':
                this.createLineSlash(x, y, 'horizontal');
                break;

            case 'LINE_V':
                this.createLineSlash(x, y, 'vertical');
                break;

            case 'CROSS':
                this.createCrossExplosion(x, y);
                break;

            case 'NORMAL':
            default:
                this.particles.push({
                    type: 'ring', x, y,
                    radius: 2, expandSpeed: 4,
                    lineWidth: 2,
                    color: '255, 255, 240',
                    alpha: 0.8, elapsed: 0, totalLife: 10, vx: 0, vy: 0
                });
                this.addEmitter({
                    x, y, color: '255, 255, 200',
                    count: 2, speed: 6, life: 2,
                    spreadX: 1.2, gravity: 0.1, particleSize: 2
                });
                this.addShake(2);
                break;
        }

        await new Promise(r => setTimeout(r, 100));
    }

    // ========================================================
    //  ユーティリティ
    // ========================================================
    sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    clear() {
        this.particles = [];
        this.emitters = [];
        this.texts = [];
        this.flashes = [];
        this.speedLines = [];
        this.afterImages = [];
        this.shakeAmount = 0;
    }
}