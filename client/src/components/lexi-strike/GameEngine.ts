import { WordData, WordTarget, Particle, Bullet, Explosion, PlayerStats, LevelConfig, InputState, COLORS, ActiveEffect, PlayerInventory, ITEMS, WORD_BOOKS } from './types';
import { ObjectPool } from './ObjectPool';
import { SRSAlgorithm } from './SRSAlgorithm';
import { InputManager } from './InputManager';

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class GameEngine {
  canvas: HTMLCanvasElement | null = null;
  ctx: CanvasRenderingContext2D | null = null;
  w = 0;
  h = 0;

  input: InputManager;
  srs: SRSAlgorithm;
  running = false;
  time = 0;
  deltaTime = 0;
  lastTime = 0;
  screenShake = 0;
  comboPopup = '';
  comboPopupTimer = 0;
  damageNumbers: { x: number; y: number; text: string; life: number; color: string }[] = [];

  level: LevelConfig | null = null;
  stats: PlayerStats = this.createDefaultStats();
  inventory: PlayerInventory = {
    gold: 500,
    diamonds: 50,
    items: ITEMS.map(i => ({ ...i })),
    activeEffects: [],
    wordBooks: ['free_core'],
    selectedBook: 'free_core',
    cosmetics: [],
    activeSkin: 'default',
  };

  wordBank: WordData[] = [];
  targets: WordTarget[] = [];
  particles: Particle[] = [];
  bullets: Bullet[] = [];
  explosions: Explosion[] = [];

  private targetPool: ObjectPool<WordTarget>;
  private particlePool: ObjectPool<Particle>;
  private bulletPool: ObjectPool<Bullet>;
  private explosionPool: ObjectPool<Explosion>;

  spawnTimer = 0;
  waveTimer = 0;
  remainingTime = 0;
  missedCount = 0;
  waveComplete = false;
  levelComplete = false;
  paused = false;

  onStatsUpdate: ((stats: PlayerStats) => void) | null = null;
  onGameOver: ((result: 'victory' | 'defeat') => void) | null = null;
  onWaveComplete: ((wave: number) => void) | null = null;

  constructor() {
    this.input = new InputManager();
    this.srs = new SRSAlgorithm();
    this.srs.loadFromStorage();

    this.targetPool = new ObjectPool(
      () => ({
        id: 0, wordData: null as unknown as WordData,
        x: 0, y: 0, vx: 0, vy: 0, size: 40, hp: 1, maxHp: 1,
        isBoss: false as boolean, active: false as boolean, hitFlash: 0, alpha: 1,
      }),
      (t) => { t.active = false; t.alpha = 1; t.hitFlash = 0; },
      30,
    );

    this.particlePool = new ObjectPool(
      () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, color: '#fff', size: 0, gravity: 0 }),
      (p) => { p.life = 0; },
      200,
    );

    this.bulletPool = new ObjectPool(
      () => ({ x: 0, y: 0, vx: 0, vy: 0, active: false as boolean, isEnemy: false as boolean }),
      (b) => { b.active = false; },
      50,
    );

    this.explosionPool = new ObjectPool(
      () => ({ x: 0, y: 0, radius: 0, maxRadius: 0, alpha: 0, color: '#fff' }),
      (e) => { e.alpha = 0; e.radius = 0; },
      20,
    );
  }

  private createDefaultStats(): PlayerStats {
    return {
      score: 0, combo: 0, maxCombo: 0, kills: 0,
      hp: 100, maxHp: 100, shield: 0, maxShield: 50,
      wave: 1, totalWaves: 1, timeLeft: 60, totalTime: 0,
      xpGained: 0, correctAnswers: 0, wrongAnswers: 0,
      accuracy: 100, energy: 100, maxEnergy: 100,
    };
  }

  init(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    this.input.setup(canvas);
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.w = this.canvas.width;
    this.h = this.canvas.height;
  }

  getActiveEffects(): ActiveEffect[] {
    return this.inventory.activeEffects.filter(e => e.remainingTime > 0);
  }

  getEffectValue(attribute: string): number {
    const effects = this.getActiveEffects().filter(e => e.attribute === attribute);
    let total = 0;
    for (const e of effects) total += e.value;
    const permanent = this.inventory.items
      .filter(i => i.type === 'permanent' && i.owned && i.effect.attribute === attribute);
    for (const p of permanent) total += p.effect.value;
    return total;
  }

  useItem(itemId: string): boolean {
    const item = this.inventory.items.find(i => i.id === itemId);
    if (!item || item.quantity <= 0) return false;

    item.quantity--;

    if (item.effect.duration > 0) {
      this.inventory.activeEffects.push({
        itemId: item.id,
        attribute: item.effect.attribute,
        value: item.effect.value,
        remainingTime: item.effect.duration,
      });
    } else {
      switch (item.effect.attribute) {
        case 'hp':
          this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + item.effect.value);
          break;
        case 'shield':
          this.stats.shield = Math.min(this.stats.maxShield, this.stats.shield + item.effect.value);
          break;
        case 'energy':
          this.stats.energy = Math.min(this.stats.maxEnergy, this.stats.energy + item.effect.value);
          break;
      }
    }
    return true;
  }

  startLevel(level: LevelConfig, words: WordData[]): void {
    this.level = level;
    this.wordBank = words;
    this.stats = this.createDefaultStats();
    this.stats.totalWaves = level.waves;
    this.stats.wave = 1;
    this.stats.timeLeft = level.timePerWave;
    this.stats.totalTime = level.timePerWave * level.waves;
    this.missedCount = 0;
    this.waveComplete = false;
    this.levelComplete = false;
    this.paused = false;
    this.screenShake = 0;
    this.remainingTime = level.timePerWave;
    this.spawnTimer = 0;
    this.waveTimer = 0;

    this.targets = [];
    this.particles = [];
    this.bullets = [];
    this.explosions = [];
    this.damageNumbers = [];
    this.comboPopup = '';
    this.comboPopupTimer = 0;

    this.running = true;
    this.lastTime = performance.now();
    this.gameLoop();
  }

  private gameLoop(): void {
    if (!this.running || !this.canvas || !this.ctx) return;

    const now = performance.now();
    this.deltaTime = (now - this.lastTime) / 1000;
    this.lastTime = now;
    this.time += this.deltaTime * 1000;

    if (!this.paused) {
      this.update(this.deltaTime);
      this.updateEffects(this.deltaTime);
    }
    this.render();

    if (this.stats.hp <= 0) {
      this.running = false;
      this.onGameOver?.('defeat');
      return;
    }

    if (this.levelComplete) {
      this.running = false;
      this.onGameOver?.('victory');
      return;
    }

    requestAnimationFrame(() => this.gameLoop());
  }

  private update(dt: number): void {
    if (!this.level) return;

    this.waveTimer += dt;
    this.remainingTime = this.level.timePerWave - this.waveTimer;

    if (this.remainingTime <= 0 && this.stats.wave < this.level.waves) {
      this.stats.wave++;
      this.waveTimer = 0;
      this.remainingTime = this.level.timePerWave;
      this.waveComplete = true;
      this.onWaveComplete?.(this.stats.wave);
      setTimeout(() => { this.waveComplete = false; }, 2000);
    }

    if (this.stats.wave >= this.level.waves && this.remainingTime <= 0) {
      this.levelComplete = true;
    }

    this.stats.timeLeft = Math.ceil(this.remainingTime);

    if (this.level.mode === 'fps' || this.level.mode === 'fusion') {
      this.updateFPSTargets(dt);
    }

    this.updateParticles(dt);
    this.updateBullets(dt);
    this.updateExplosions(dt);
    this.updateDamageNumbers(dt);
    this.updateComboPopup(dt);

    if (this.screenShake > 0) this.screenShake -= dt * 10;
  }

  private updateFPSTargets(dt: number): void {
    if (!this.level) return;

    const config = this.level.enemyConfig;
    this.spawnTimer += dt * 1000;

    const effectiveRate = config.spawnRate / (1 + this.getEffectValue('speed') / 100);

    if (this.spawnTimer >= effectiveRate) {
      this.spawnTimer = 0;
      this.spawnTarget();
    }

    for (let i = this.targets.length - 1; i >= 0; i--) {
      const t = this.targets[i];
      if (!t.active) {
        this.targets.splice(i, 1);
        continue;
      }

      t.y += t.vy * dt * 60;
      t.x += t.vx * dt * 60;

      if (t.x < t.size / 2) t.vx = Math.abs(t.vx);
      if (t.x > this.w - t.size / 2) t.vx = -Math.abs(t.vx);

      if (t.y > this.h + 100) {
        t.active = false;
        this.targetPool.release(t);
        this.targets.splice(i, 1);
        this.missedCount++;
        this.stats.combo = 0;
        this.stats.hp = Math.max(0, this.stats.hp - 3);

        if (this.missedCount >= this.level.loseCondition.value && this.level.loseCondition.type === 'missed') {
          this.stats.hp = 0;
        }
      }

      if (t.hitFlash > 0) t.hitFlash -= dt * 10;
    }
  }

  private spawnTarget(): void {
    if (!this.level || this.wordBank.length === 0) return;

    const config = this.level.enemyConfig;
    const isBoss = Math.random() < config.bossChance;
    const wave = this.stats.wave;

    const word = this.wordBank[Math.floor(Math.random() * this.wordBank.length)];
    const distractorWords = shuffleArray(this.wordBank.filter(w => w.id !== word.id)).slice(0, 3);

    const wordData: WordData = {
      ...word,
      distractors: config.distractors ? distractorWords.map(w => w.definition) : [],
    };

    const margin = 80;
    const x = margin + Math.random() * (this.w - margin * 2);
    const speed = config.baseSpeed * (0.7 + Math.random() * 0.6) * Math.pow(config.speedScale, wave - 1);
    const hp = isBoss ? Math.ceil(config.baseHp * 3 * Math.pow(config.hpScale, wave - 1)) : Math.ceil(config.baseHp * Math.pow(config.hpScale, wave - 1));
    const size = isBoss ? config.size * 1.8 : config.size + Math.random() * 15;

    const target = this.targetPool.acquire();
    target.id = Date.now() + Math.random();
    target.wordData = wordData;
    target.x = x;
    target.y = -60;
    target.vx = (Math.random() - 0.5) * speed * 0.5;
    target.vy = speed * (0.8 + Math.random() * 0.4);
    target.size = size;
    target.hp = hp;
    target.maxHp = hp;
    target.isBoss = isBoss;
    target.active = true;
    target.hitFlash = 0;
    target.alpha = 1;

    this.targets.push(target);
  }

  handleFPSShot(): void {
    if (!this.level || this.level.mode === 'fighting') return;

    const pos = this.input.getCanvasPosition(this.canvas!);

    for (let i = this.targets.length - 1; i >= 0; i--) {
      const t = this.targets[i];
      if (!t.active) continue;

      const dx = pos.x - t.x;
      const dy = pos.y - t.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < t.size / 2 + 15) {
        this.hitTarget(t, i);
        return;
      }
    }
  }

  private hitTarget(target: WordTarget, index: number): void {
    const attackBonus = 1 + this.getEffectValue('attack') / 100;
    const baseDamage = 10 * attackBonus;
    const comboBonus = Math.floor(this.stats.combo / 5) * 5;
    const damage = baseDamage + comboBonus + (target.isBoss ? 5 : 0);

    target.hp -= damage;
    target.hitFlash = 1;

    this.damageNumbers.push({
      x: target.x, y: target.y,
      text: `-${damage}`,
      life: 1, color: target.isBoss ? COLORS.alert : COLORS.neon,
    });

    this.spawnParticles(target.x, target.y, target.isBoss ? COLORS.gold : COLORS.neon, 8);

    if (target.hp <= 0) {
      this.stats.combo++;
      this.stats.maxCombo = Math.max(this.stats.maxCombo, this.stats.combo);
      this.stats.kills++;
      this.srs.recordAnswer(target.wordData.id, true);

      const scoreGain = 10 + comboBonus + (target.isBoss ? 30 : 0);
      this.stats.score += scoreGain;
      this.stats.correctAnswers++;
      this.stats.energy = Math.min(this.stats.maxEnergy, this.stats.energy + 5);

      if (this.stats.combo >= 5) {
        this.comboPopup = `${this.stats.combo} COMBO!`;
        this.comboPopupTimer = 1.5;
      }

      this.spawnExplosion(target.x, target.y, target.isBoss ? COLORS.gold : COLORS.neon, target.size * 1.5);
      this.screenShake = target.isBoss ? 8 : 3;

      target.active = false;
      this.targetPool.release(target);
      this.targets.splice(index, 1);
    } else {
      this.spawnParticles(target.x, target.y, '#FFFFFF', 5);
    }
  }

  handleArenaAnswer(choice: string, currentWord: WordData): boolean {
    const correct = choice === currentWord.definition;

    if (correct) {
      this.stats.combo++;
      this.stats.maxCombo = Math.max(this.stats.maxCombo, this.stats.combo);
      this.stats.kills++;
      this.stats.correctAnswers++;
      this.srs.recordAnswer(currentWord.id, true);

      const comboBonus = Math.floor(this.stats.combo / 5) * 5;
      this.stats.score += 15 + comboBonus;
      this.stats.energy = Math.min(this.stats.maxEnergy, this.stats.energy + 8);

      this.spawnParticles(this.w / 2, this.h * 0.4, COLORS.neon, 15);
      this.spawnExplosion(this.w / 2, this.h * 0.4, COLORS.neon, 60);

      if (this.stats.combo >= 5) {
        this.comboPopup = `${this.stats.combo} COMBO!`;
        this.comboPopupTimer = 1.5;
      }
    } else {
      this.stats.combo = 0;
      this.stats.wrongAnswers++;
      this.srs.recordAnswer(currentWord.id, false);

      const shieldAbsorb = Math.min(this.stats.shield, 12);
      this.stats.shield -= shieldAbsorb;
      this.stats.hp = Math.max(0, this.stats.hp - (12 - shieldAbsorb));

      this.spawnParticles(this.w / 2, this.h * 0.4, COLORS.alert, 10);
      this.screenShake = 6;
    }

    this.stats.accuracy = this.stats.correctAnswers + this.stats.wrongAnswers > 0
      ? Math.round((this.stats.correctAnswers / (this.stats.correctAnswers + this.stats.wrongAnswers)) * 100)
      : 100;

    return correct;
  }

  private updateEffects(dt: number): void {
    for (let i = this.inventory.activeEffects.length - 1; i >= 0; i--) {
      this.inventory.activeEffects[i].remainingTime -= dt;
      if (this.inventory.activeEffects[i].remainingTime <= 0) {
        this.inventory.activeEffects.splice(i, 1);
      }
    }
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.vy += p.gravity * dt * 60;
      if (p.life <= 0) {
        this.particlePool.release(p);
        this.particles.splice(i, 1);
      }
    }
  }

  private updateBullets(dt: number): void {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      if (!b.active) { this.bullets.splice(i, 1); continue; }
      b.x += b.vx * dt * 60;
      b.y += b.vy * dt * 60;
      if (b.x < -50 || b.x > this.w + 50 || b.y < -50 || b.y > this.h + 50) {
        b.active = false;
        this.bulletPool.release(b);
        this.bullets.splice(i, 1);
      }
    }
  }

  private updateExplosions(dt: number): void {
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const e = this.explosions[i];
      e.radius += (e.maxRadius - e.radius) * dt * 3;
      e.alpha -= dt * 2;
      if (e.alpha <= 0) {
        this.explosionPool.release(e);
        this.explosions.splice(i, 1);
      }
    }
  }

  private updateDamageNumbers(dt: number): void {
    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      const d = this.damageNumbers[i];
      d.life -= dt;
      d.y -= 30 * dt;
      if (d.life <= 0) this.damageNumbers.splice(i, 1);
    }
  }

  private updateComboPopup(dt: number): void {
    if (this.comboPopupTimer > 0) {
      this.comboPopupTimer -= dt;
      if (this.comboPopupTimer <= 0) this.comboPopup = '';
    }
  }

  private spawnParticles(x: number, y: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 2 + Math.random() * 4;
      const p = this.particlePool.acquire();
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 0.6 + Math.random() * 0.4;
      p.maxLife = p.life;
      p.color = color;
      p.size = 2 + Math.random() * 3;
      p.gravity = 0.5 + Math.random();
      this.particles.push(p);
    }
  }

  private spawnExplosion(x: number, y: number, color: string, maxRadius: number): void {
    const e = this.explosionPool.acquire();
    e.x = x;
    e.y = y;
    e.radius = 0;
    e.maxRadius = maxRadius;
    e.alpha = 0.8;
    e.color = color;
    this.explosions.push(e);
  }

  render(): void {
    const ctx = this.ctx!;
    const w = this.w;
    const h = this.h;

    ctx.save();
    if (this.screenShake > 0) {
      ctx.translate((Math.random() - 0.5) * this.screenShake * 2, (Math.random() - 0.5) * this.screenShake * 2);
    }

    this.renderScene(ctx, w, h);
    this.renderTargets(ctx, w, h);
    this.renderBullets(ctx);
    this.renderExplosions(ctx);
    this.renderParticles(ctx);
    this.renderDamageNumbers(ctx);
    this.renderHUD(ctx, w, h);
    this.renderScanLine(ctx, w, h);
    this.renderComboPopup(ctx, w, h);

    ctx.restore();
  }

  private renderScene(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, w, h);

    if (!this.level) return;

    const scene = this.level.scene;
    const time = this.time;

    if (scene === 'road' || scene === 'hybrid') {
      const roadW = w * 0.5;
      const roadX = (w - roadW) / 2;
      ctx.fillStyle = '#1A1A2E';
      ctx.fillRect(roadX, 0, roadW, h);

      ctx.strokeStyle = COLORS.neonDim;
      ctx.lineWidth = 1;
      ctx.strokeRect(roadX, 0, roadW, h);

      const dashOffset = (time * 0.15) % 50;
      ctx.strokeStyle = 'rgba(0, 255, 156, 0.1)';
      ctx.setLineDash([30, 20]);
      ctx.beginPath();
      ctx.moveTo(w / 2, dashOffset - 50);
      ctx.lineTo(w / 2, h + 50);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = 'rgba(255, 71, 87, 0.15)';
      ctx.setLineDash([20, 20]);
      const sideOffset = (time * 0.15) % 40;
      ctx.beginPath();
      ctx.moveTo(roadX + 10, sideOffset - 40);
      ctx.lineTo(roadX + 10, h + 40);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(roadX + roadW - 10, sideOffset - 40);
      ctx.lineTo(roadX + roadW - 10, h + 40);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (scene === 'arena' || scene === 'hybrid') {
      for (let i = 0; i < 8; i++) {
        const x = (time * 0.02 + i * w / 8) % w;
        const y = h * 0.3 + Math.sin(time * 0.003 + i) * 30;
        ctx.fillStyle = 'rgba(0, 255, 156, 0.02)';
        ctx.fillRect(x, y, 2, h * 0.4);
      }

      ctx.strokeStyle = 'rgba(255, 71, 87, 0.15)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.42, 150, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(0, 255, 156, 0.03)';
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.42, 145, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderTargets(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    for (const t of this.targets) {
      if (!t.active) continue;

      const pulse = 1 + Math.sin(this.time * 0.005 + t.id) * 0.03;
      const r = (t.size * pulse) / 2;

      if (t.hitFlash > 0) {
        ctx.globalAlpha = 0.5 + t.hitFlash * 0.5;
      }

      const gradient = ctx.createRadialGradient(t.x, t.y, r * 0.2, t.x, t.y, r);
      if (t.isBoss) {
        gradient.addColorStop(0, '#FF4757');
        gradient.addColorStop(0.5, '#FF6B81');
        gradient.addColorStop(1, '#8B0000');
        ctx.shadowColor = COLORS.alert;
        ctx.shadowBlur = 20 + Math.sin(this.time * 0.008) * 10;
      } else {
        gradient.addColorStop(0, '#2C2C2C');
        gradient.addColorStop(0.5, '#404040');
        gradient.addColorStop(1, '#1A1A1A');
      }
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.strokeStyle = t.isBoss ? COLORS.alert : COLORS.neon;
      ctx.lineWidth = t.isBoss ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold ${Math.max(11, r * 0.35)}px "Orbitron", system-ui, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.wordData.word, t.x, t.y - r * 0.15);

      ctx.font = `${Math.max(9, r * 0.25)}px system-ui, sans-serif`;
      ctx.fillStyle = COLORS.grayLight;
      ctx.fillText(t.wordData.definition, t.x, t.y + r * 0.3);

      if (t.maxHp > 1) {
        const hpW = r * 1.4;
        const hpH = 4;
        const hpY = t.y - r - 10;
        ctx.fillStyle = '#333';
        ctx.fillRect(t.x - hpW / 2, hpY, hpW, hpH);
        const hpRatio = t.hp / t.maxHp;
        ctx.fillStyle = hpRatio > 0.5 ? COLORS.neon : COLORS.alert;
        ctx.fillRect(t.x - hpW / 2, hpY, hpW * hpRatio, hpH);
      }

      ctx.globalAlpha = 1;
    }
  }

  private renderBullets(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = COLORS.neon;
    for (const b of this.bullets) {
      if (!b.active) continue;
      ctx.fillRect(b.x - 2, b.y - 2, 4, 4);
    }
  }

  private renderExplosions(ctx: CanvasRenderingContext2D): void {
    for (const e of this.explosions) {
      ctx.globalAlpha = e.alpha;
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private renderParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  private renderDamageNumbers(ctx: CanvasRenderingContext2D): void {
    for (const d of this.damageNumbers) {
      ctx.globalAlpha = d.life;
      ctx.fillStyle = d.color;
      ctx.font = 'bold 16px "Orbitron", system-ui, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(d.text, d.x, d.y);
    }
    ctx.globalAlpha = 1;
  }

  private renderHUD(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = COLORS.white;
    ctx.font = '14px "Orbitron", system-ui, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE: ${this.stats.score.toLocaleString()}`, 16, 30);
    ctx.fillText(`COMBO: ${this.stats.combo}x`, 16, 52);

    const hpW = 200;
    const hpH = 12;
    const hpX = 16;
    const hpY = 66;
    ctx.fillStyle = '#333';
    ctx.fillRect(hpX, hpY, hpW, hpH);
    const hpRatio = this.stats.hp / this.stats.maxHp;
    ctx.fillStyle = hpRatio > 0.5 ? COLORS.neon : hpRatio > 0.25 ? COLORS.gold : COLORS.alert;
    ctx.fillRect(hpX, hpY, hpW * hpRatio, hpH);
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.strokeRect(hpX, hpY, hpW, hpH);

    if (this.stats.shield > 0) {
      const shieldY = hpY + hpH + 4;
      const sH = 6;
      ctx.fillStyle = '#333';
      ctx.fillRect(hpX, shieldY, hpW, sH);
      ctx.fillStyle = COLORS.blue;
      ctx.fillRect(hpX, shieldY, hpW * (this.stats.shield / this.stats.maxShield), sH);
    }

    ctx.fillStyle = COLORS.white;
    ctx.font = '10px system-ui, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`HP ${this.stats.hp}/${this.stats.maxHp}`, hpX + hpW / 2, hpY + hpH - 2);

    ctx.textAlign = 'right';
    ctx.font = '12px "Orbitron", system-ui, monospace';
    ctx.fillStyle = COLORS.neon;
    ctx.fillText(`WAVE ${this.stats.wave}/${this.stats.totalWaves}`, w - 16, 30);

    ctx.fillStyle = this.stats.timeLeft <= 10 ? COLORS.alert : COLORS.white;
    ctx.font = 'bold 20px "Orbitron", system-ui, monospace';
    ctx.fillText(`${this.stats.timeLeft}s`, w - 16, 56);

    const eW = 100;
    const eH = 8;
    const eY = 70;
    ctx.fillStyle = '#333';
    ctx.fillRect(w - 16 - eW, eY, eW, eH);
    ctx.fillStyle = COLORS.blue;
    ctx.fillRect(w - 16 - eW, eY, eW * (this.stats.energy / this.stats.maxEnergy), eH);
    ctx.fillStyle = COLORS.white;
    ctx.font = '8px system-ui, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`NRG ${Math.round(this.stats.energy)}`, w - 16 - eW / 2, eY + eH - 1);

    if (this.stats.combo >= 5) {
      ctx.globalAlpha = 0.5 + Math.sin(this.time * 0.005) * 0.3;
      ctx.fillStyle = this.stats.combo >= 20 ? COLORS.gold : this.stats.combo >= 10 ? COLORS.orange : COLORS.neon;
      ctx.font = 'bold 24px "Orbitron", system-ui, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${this.stats.combo} COMBO!`, w / 2, h - 100);
      ctx.globalAlpha = 1;
    }

    if (this.waveComplete) {
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = COLORS.neon;
      ctx.font = 'bold 32px "Orbitron", system-ui, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`WAVE ${this.stats.wave} CLEAR!`, w / 2, h / 2);
      ctx.globalAlpha = 1;
    }
  }

  private renderScanLine(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const y = (this.time * 0.05) % h;
    ctx.fillStyle = 'rgba(0, 255, 156, 0.02)';
    ctx.fillRect(0, y, w, 1);
  }

  private renderComboPopup(ctx: CanvasRenderingContext2D, w: number, _h: number): void {
    if (this.comboPopupTimer <= 0) return;
    ctx.globalAlpha = this.comboPopupTimer / 1.5;
    ctx.fillStyle = COLORS.gold;
    ctx.font = 'bold 36px "Orbitron", system-ui, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(this.comboPopup, w / 2, 120);
    ctx.globalAlpha = 1;
  }

  renderCrosshair(ctx: CanvasRenderingContext2D): void {
    const pos = this.input.getCanvasPosition(this.canvas!);
    const x = pos.x;
    const y = pos.y;
    const s = 14;

    const hasNeonSkin = this.inventory.activeSkin === 'neon';
    const color = hasNeonSkin ? COLORS.blue : COLORS.neon;

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - s, y); ctx.lineTo(x - s / 3, y);
    ctx.moveTo(x + s / 3, y); ctx.lineTo(x + s, y);
    ctx.moveTo(x, y - s); ctx.lineTo(x, y - s / 3);
    ctx.moveTo(x, y + s / 3); ctx.lineTo(x, y + s);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, s / 2, 0, Math.PI * 2);
    ctx.stroke();

    if (hasNeonSkin) {
      ctx.shadowColor = COLORS.blue;
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  destroy(): void {
    this.running = false;
    this.input.destroy();
    window.removeEventListener('resize', () => this.resize());
  }
}