import * as PIXI from 'pixi.js';
import { ResourceManager } from './ResourceManager';
import { WordManager, WordEntry } from './WordManager';
import { InputManager } from './InputManager';

export type GameMode = 'road' | 'arena';
export type GameStatus = 'playing' | 'paused' | 'over';

interface MonsterInstance {
  sprite: PIXI.Sprite;
  container: PIXI.Container;
  word: WordEntry;
  choices: string[];
  correctIndex: number;
  hp: number;
  maxHp: number;
  speed: number;
  isBoss: boolean;
  lane: number;
  alive: boolean;
  hpBar: PIXI.Graphics;
  hpBarBg: PIXI.Graphics;
  wordText: PIXI.Text;
  lockIndicator: PIXI.Graphics;
}

interface BulletInstance {
  sprite: PIXI.Sprite;
  vx: number;
  vy: number;
  alive: boolean;
  targetMonster?: MonsterInstance;
}

export interface GameState {
  mode: GameMode;
  status: GameStatus;
  score: number;
  combo: number;
  maxCombo: number;
  hp: number;
  maxHp: number;
  kills: number;
  wave: number;
  totalWaves: number;
  timeLeft: number;
  xpGained: number;
  accuracy: number;
  correctAnswers: number;
  wrongAnswers: number;
}

export interface FeedbackInfo {
  correct: boolean;
  word: string;
  meaning: string;
}

export class GameLoop {
  app: PIXI.Application;
  resources: ResourceManager;
  wordManager: WordManager;
  input: InputManager;

  state: GameState = {
    mode: 'road',
    status: 'playing',
    score: 0, combo: 0, maxCombo: 0,
    hp: 100, maxHp: 100, kills: 0,
    wave: 1, totalWaves: 10, timeLeft: 60,
    xpGained: 0, accuracy: 100,
    correctAnswers: 0, wrongAnswers: 0,
  };

  monsters: MonsterInstance[] = [];
  bullets: BulletInstance[] = [];
  playerContainer!: PIXI.Container;
  roadContainer!: PIXI.Container;
  arenaContainer!: PIXI.Container;
  hudContainer!: PIXI.Container;
  roadBg!: PIXI.Graphics;
  crosshair!: PIXI.Graphics;

  currentArenaWord: WordEntry | null = null;
  arenaChoices: string[] = [];
  arenaWordText!: PIXI.Text;
  arenaFighter!: PIXI.Container;
  arenaMonsterFighter!: PIXI.Container;
  arenaMonsterHpBar!: PIXI.Graphics;
  arenaMonsterHpBg!: PIXI.Graphics;
  arenaPlayerHpBar!: PIXI.Graphics;
  arenaPlayerHpBg!: PIXI.Graphics;
  modeText!: PIXI.Text;
  scoreText!: PIXI.Text;
  comboText!: PIXI.Text;
  hpBar!: PIXI.Graphics;
  hpBarBg!: PIXI.Graphics;
  timeText!: PIXI.Text;
  waveText!: PIXI.Text;

  roadChoices: string[] = [];
  targetedWord: string = '';
  targetedMonsterIndex: number = -1;
  lastFeedback: FeedbackInfo | null = null;
  feedbackTimer: number = 0;
  feedbackText!: PIXI.Text;
  feedbackIcon!: PIXI.Text;

  spawnTimer = 0;
  spawnInterval = 2000;
  gameTime = 0;
  waveTime = 0;
  roadToArenaDistance = 100;

  onStateUpdate: ((state: GameState) => void) | null = null;
  onGameOver: ((result: 'victory' | 'defeat') => void) | null = null;
  onModeSwitch: ((mode: GameMode) => void) | null = null;
  onChoicesUpdate: ((word: string, choices: string[]) => void) | null = null;
  onFeedback: ((info: FeedbackInfo) => void) | null = null;

  constructor(app: PIXI.Application, resources: ResourceManager, wordManager: WordManager, input: InputManager) {
    this.app = app;
    this.resources = resources;
    this.wordManager = wordManager;
    this.input = input;
  }

  init(): void {
    this.roadContainer = new PIXI.Container();
    this.app.stage.addChild(this.roadContainer);
    this.arenaContainer = new PIXI.Container();
    this.arenaContainer.visible = false;
    this.app.stage.addChild(this.arenaContainer);
    this.hudContainer = new PIXI.Container();
    this.app.stage.addChild(this.hudContainer);

    this.createRoadBackground();
    this.createPlayer();
    this.createHUD();
    this.createArenaScene();
    this.createCrosshair();
    this.createFeedbackUI();

    this.input.onSelect((key) => this.handleSelect(key));

    this.resources.sounds.bgm.start();
    this.startWave();
  }

  private createRoadBackground(): void {
    this.roadBg = new PIXI.Graphics();
    const w = this.app.screen.width;
    const h = this.app.screen.height;

    this.roadBg.beginFill(0x0A0A0A);
    this.roadBg.drawRect(0, 0, w, h);
    this.roadBg.endFill();

    const roadLeft = w * 0.15;
    const roadRight = w * 0.85;
    this.roadBg.beginFill(0x111118);
    this.roadBg.drawRect(roadLeft, 0, roadRight - roadLeft, h);
    this.roadBg.endFill();

    this.roadBg.lineStyle(1, 0x00FF9C, 0.2);
    this.roadBg.moveTo(roadLeft, 0);
    this.roadBg.lineTo(roadLeft, h);
    this.roadBg.moveTo(roadRight, 0);
    this.roadBg.lineTo(roadRight, h);

    const centerX = (roadLeft + roadRight) / 2;
    for (let y = 0; y < h; y += 40) {
      this.roadBg.lineStyle(1, 0x00FF9C, 0.1);
      this.roadBg.moveTo(centerX, y);
      this.roadBg.lineTo(centerX, y + 20);
    }

    this.roadContainer.addChild(this.roadBg);
  }

  private createPlayer(): void {
    const textures = this.resources.textures;
    this.playerContainer = new PIXI.Container();
    const playerSprite = new PIXI.Sprite(textures.player);
    playerSprite.anchor.set(0.5);
    playerSprite.scale.set(1.5);
    this.playerContainer.addChild(playerSprite);
    this.playerContainer.x = 100;
    this.playerContainer.y = this.app.screen.height / 2;
    this.roadContainer.addChild(this.playerContainer);
  }

  private createCrosshair(): void {
    this.crosshair = new PIXI.Graphics();
    this.crosshair.lineStyle(1.5, 0x00FF9C, 0.8);
    const s = 12;
    this.crosshair.moveTo(-s, 0);
    this.crosshair.lineTo(-s / 3, 0);
    this.crosshair.moveTo(s / 3, 0);
    this.crosshair.lineTo(s, 0);
    this.crosshair.moveTo(0, -s);
    this.crosshair.lineTo(0, -s / 3);
    this.crosshair.moveTo(0, s / 3);
    this.crosshair.lineTo(0, s);
    this.crosshair.drawCircle(0, 0, s / 2);
    this.hudContainer.addChild(this.crosshair);
  }

  private createFeedbackUI(): void {
    const style = new PIXI.TextStyle({
      fontFamily: 'monospace',
      fontSize: 22,
      fontWeight: 'bold',
      dropShadow: true,
      dropShadowColor: '#000000',
      dropShadowBlur: 4,
      dropShadowDistance: 2,
    });
    this.feedbackIcon = new PIXI.Text('', style);
    this.feedbackIcon.anchor.set(0.5);
    this.feedbackIcon.x = this.app.screen.width / 2;
    this.feedbackIcon.y = this.app.screen.height / 2 - 50;
    this.feedbackIcon.visible = false;
    this.hudContainer.addChild(this.feedbackIcon);

    this.feedbackText = new PIXI.Text('', { ...style, fontSize: 18, fill: '#FFFFFF' });
    this.feedbackText.anchor.set(0.5);
    this.feedbackText.x = this.app.screen.width / 2;
    this.feedbackText.y = this.app.screen.height / 2 - 15;
    this.feedbackText.visible = false;
    this.hudContainer.addChild(this.feedbackText);
  }

  private createHUD(): void {
    const style = new PIXI.TextStyle({
      fontFamily: 'monospace',
      fontSize: 16,
      fill: '#00FF9C',
      fontWeight: 'bold',
    });

    this.modeText = new PIXI.Text('ROAD', { ...style, fontSize: 20 });
    this.modeText.x = this.app.screen.width / 2;
    this.modeText.y = 10;
    this.modeText.anchor.set(0.5, 0);
    this.hudContainer.addChild(this.modeText);

    this.scoreText = new PIXI.Text('SCORE: 0', style);
    this.scoreText.x = 10;
    this.scoreText.y = 10;
    this.hudContainer.addChild(this.scoreText);

    this.comboText = new PIXI.Text('', { ...style, fill: '#FFD700' });
    this.comboText.x = this.app.screen.width / 2;
    this.comboText.y = 40;
    this.comboText.anchor.set(0.5, 0);
    this.hudContainer.addChild(this.comboText);

    this.timeText = new PIXI.Text('60s', style);
    this.timeText.x = this.app.screen.width - 10;
    this.timeText.y = 10;
    this.timeText.anchor.set(1, 0);
    this.hudContainer.addChild(this.timeText);

    this.waveText = new PIXI.Text('WAVE 1/10', { ...style, fontSize: 12 });
    this.waveText.x = this.app.screen.width - 10;
    this.waveText.y = 35;
    this.waveText.anchor.set(1, 0);
    this.hudContainer.addChild(this.waveText);

    this.hpBarBg = new PIXI.Graphics();
    this.hpBarBg.beginFill(0x333333);
    this.hpBarBg.drawRect(0, 0, 200, 16);
    this.hpBarBg.endFill();
    this.hpBarBg.x = 10;
    this.hpBarBg.y = this.app.screen.height - 30;
    this.hudContainer.addChild(this.hpBarBg);

    this.hpBar = new PIXI.Graphics();
    this.hpBar.x = 10;
    this.hpBar.y = this.app.screen.height - 30;
    this.hudContainer.addChild(this.hpBar);
  }

  private createArenaScene(): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;

    const bg = new PIXI.Graphics();
    bg.beginFill(0x1A0A0A);
    bg.drawRect(0, 0, w, h);
    bg.endFill();

    bg.lineStyle(2, 0xFF4757, 0.15);
    bg.drawCircle(w / 2, h / 2, 180);
    for (let i = 0; i < 8; i++) {
      const x = w * (0.1 + i * 0.1);
      bg.lineStyle(1, 0x00FF9C, 0.03);
      bg.moveTo(x, 0);
      bg.lineTo(x, h);
    }
    this.arenaContainer.addChild(bg);

    this.arenaFighter = new PIXI.Container();
    const fighterSprite = new PIXI.Sprite(this.resources.textures.player);
    fighterSprite.anchor.set(0.5);
    fighterSprite.scale.set(2.5);
    this.arenaFighter.addChild(fighterSprite);
    this.arenaFighter.x = 180;
    this.arenaFighter.y = h / 2;
    this.arenaContainer.addChild(this.arenaFighter);

    this.arenaMonsterFighter = new PIXI.Container();
    const monsterSprite = new PIXI.Sprite(this.resources.textures.monsterBoss);
    monsterSprite.anchor.set(0.5);
    monsterSprite.scale.set(2.5);
    this.arenaMonsterFighter.addChild(monsterSprite);
    this.arenaMonsterFighter.x = w - 180;
    this.arenaMonsterFighter.y = h / 2;
    this.arenaContainer.addChild(this.arenaMonsterFighter);

    const wordStyle = new PIXI.TextStyle({
      fontFamily: 'monospace',
      fontSize: 36,
      fill: '#FFFFFF',
      fontWeight: 'bold',
      dropShadow: true,
      dropShadowColor: '#FF4757',
      dropShadowBlur: 4,
      dropShadowDistance: 0,
    });
    this.arenaWordText = new PIXI.Text('', wordStyle);
    this.arenaWordText.anchor.set(0.5);
    this.arenaWordText.x = w / 2;
    this.arenaWordText.y = h / 2 - 100;
    this.arenaContainer.addChild(this.arenaWordText);

    this.arenaPlayerHpBg = new PIXI.Graphics();
    this.arenaPlayerHpBg.beginFill(0x333333);
    this.arenaPlayerHpBg.drawRect(0, 0, 150, 12);
    this.arenaPlayerHpBg.endFill();
    this.arenaPlayerHpBg.x = 30;
    this.arenaPlayerHpBg.y = 30;
    this.arenaContainer.addChild(this.arenaPlayerHpBg);

    this.arenaPlayerHpBar = new PIXI.Graphics();
    this.arenaPlayerHpBar.x = 30;
    this.arenaPlayerHpBar.y = 30;
    this.arenaContainer.addChild(this.arenaPlayerHpBar);

    this.arenaMonsterHpBg = new PIXI.Graphics();
    this.arenaMonsterHpBg.beginFill(0x333333);
    this.arenaMonsterHpBg.drawRect(0, 0, 150, 12);
    this.arenaMonsterHpBg.endFill();
    this.arenaMonsterHpBg.x = w - 180;
    this.arenaMonsterHpBg.y = 30;
    this.arenaContainer.addChild(this.arenaMonsterHpBg);

    this.arenaMonsterHpBar = new PIXI.Graphics();
    this.arenaMonsterHpBar.x = w - 180;
    this.arenaMonsterHpBar.y = 30;
    this.arenaContainer.addChild(this.arenaMonsterHpBar);
  }

  private startWave(): void {
    this.state.wave = Math.min(this.state.wave, this.state.totalWaves);
    this.waveTime = 0;
    this.spawnTimer = 0;
    this.spawnInterval = Math.max(800, 2000 - (this.state.wave - 1) * 150);
    this.state.timeLeft = 60 - (this.state.wave - 1) * 3;
    this.state.mode = 'road';
    this.roadContainer.visible = true;
    this.arenaContainer.visible = false;
    this.roadChoices = [];
    this.targetedWord = '';
    this.targetedMonsterIndex = -1;
    this.onChoicesUpdate?.('', []);
  }

  update(delta: number): void {
    if (this.state.status !== 'playing') return;

    const dt = delta / 60;
    this.gameTime += dt;
    this.waveTime += dt;

    if (this.state.mode === 'road') {
      this.updateRoad(dt);
    } else {
      this.updateArena(dt);
    }

    this.updateBullets(dt);
    this.updateCrosshair();
    this.updateFeedback(dt);
    this.updateHUD();
    this.checkWaveEnd();
  }

  private updateFeedback(dt: number): void {
    if (this.lastFeedback) {
      this.feedbackTimer -= dt;
      if (this.feedbackTimer <= 0) {
        this.feedbackIcon.visible = false;
        this.feedbackText.visible = false;
        this.lastFeedback = null;
      } else {
        const alpha = Math.min(1, this.feedbackTimer * 3);
        this.feedbackIcon.alpha = alpha;
        this.feedbackText.alpha = alpha;
        this.feedbackIcon.y = this.app.screen.height / 2 - 50 - (1 - this.feedbackTimer) * 30;
        this.feedbackText.y = this.app.screen.height / 2 - 15 - (1 - this.feedbackTimer) * 30;
      }
    }
  }

  private updateRoad(dt: number): void {
    this.spawnTimer += dt * 1000;

    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this.spawnMonster();
    }

    let closestDist = Infinity;
    let closestIdx = -1;

    for (let i = this.monsters.length - 1; i >= 0; i--) {
      const m = this.monsters[i];
      if (!m.alive) continue;

      m.container.x -= m.speed * dt * 60;

      const distToPlayer = m.container.x - this.playerContainer.x;
      if (distToPlayer < this.roadToArenaDistance && distToPlayer > 0) {
        this.switchToArena(m.word);
        return;
      }

      if (m.container.x < -60) {
        m.alive = false;
        this.roadContainer.removeChild(m.container);
        this.monsters.splice(i, 1);
        this.state.combo = 0;
        this.state.hp = Math.max(0, this.state.hp - 5);
        this.state.wrongAnswers++;
        this.resources.sounds.wrong();
        this.showFeedback(false, m.word.en, m.word.zh);
        if (this.state.hp <= 0) {
          this.endGame('defeat');
        }
        continue;
      }

      const dist = m.container.x;
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }

      m.lockIndicator.visible = false;
    }

    if (closestIdx >= 0 && closestIdx !== this.targetedMonsterIndex) {
      this.targetedMonsterIndex = closestIdx;
      const m = this.monsters[closestIdx];
      if (m) {
        this.targetedWord = m.word.en;
        this.roadChoices = m.choices;
        this.onChoicesUpdate?.(m.word.en, m.choices);
      }
    } else if (closestIdx < 0 && this.targetedMonsterIndex >= 0) {
      this.targetedMonsterIndex = -1;
      this.targetedWord = '';
      this.roadChoices = [];
      this.onChoicesUpdate?.('', []);
    }

    if (this.targetedMonsterIndex >= 0) {
      const m = this.monsters[this.targetedMonsterIndex];
      if (m && m.alive) {
        m.lockIndicator.visible = true;
        m.lockIndicator.alpha = 0.5 + Math.sin(this.gameTime * 8) * 0.3;
      }
    }
  }

  private updateArena(_dt: number): void {
    if (this.arenaMonsterFighter) {
      this.arenaMonsterFighter.x += Math.sin(this.gameTime * 3) * 0.5;
      this.arenaFighter.x += Math.sin(this.gameTime * 3 + 1) * 0.3;
    }

    this.arenaPlayerHpBar.clear();
    const hpRatio = this.state.hp / this.state.maxHp;
    const hpColor = hpRatio > 0.5 ? 0x00FF9C : hpRatio > 0.25 ? 0xFFD700 : 0xFF4757;
    this.arenaPlayerHpBar.beginFill(hpColor);
    this.arenaPlayerHpBar.drawRect(0, 0, 150 * hpRatio, 12);
    this.arenaPlayerHpBar.endFill();

    this.arenaMonsterHpBar.clear();
    this.arenaMonsterHpBar.beginFill(0xFF4757);
    this.arenaMonsterHpBar.drawRect(0, 0, 150, 12);
    this.arenaMonsterHpBar.endFill();
  }

  private switchToArena(word: WordEntry): void {
    this.state.mode = 'arena';
    this.roadContainer.visible = false;
    this.arenaContainer.visible = true;
    this.currentArenaWord = word;
    this.arenaChoices = this.wordManager.getChoices(word);
    this.arenaWordText.text = word.en;
    this.onModeSwitch?.('arena');
    this.onChoicesUpdate?.(word.en, this.arenaChoices);
    this.resources.sounds.bossAlert();
  }

  switchToRoad(): void {
    this.state.mode = 'road';
    this.roadContainer.visible = true;
    this.arenaContainer.visible = false;
    this.currentArenaWord = null;
    this.onModeSwitch?.('road');
    this.onChoicesUpdate?.(this.targetedWord, this.roadChoices);
  }

  private spawnMonster(): void {
    const word = this.wordManager.getNextWord();
    if (!word) return;

    const isBoss = this.state.wave >= 3 && Math.random() < 0.15;
    const texture = isBoss ? this.resources.textures.monsterBoss : this.resources.textures.monster;

    const container = new PIXI.Container();
    const sprite = new PIXI.Sprite(texture);
    sprite.anchor.set(0.5);
    container.addChild(sprite);

    const wordText = new PIXI.Text(word.en, {
      fontFamily: 'monospace',
      fontSize: isBoss ? 16 : 13,
      fill: '#FFFFFF',
      fontWeight: 'bold',
    });
    wordText.anchor.set(0.5);
    wordText.y = isBoss ? 32 : 27;
    container.addChild(wordText);

    const hpBarBg = new PIXI.Graphics();
    hpBarBg.beginFill(0x333333);
    hpBarBg.drawRect(0, 0, 30, 4);
    hpBarBg.endFill();
    hpBarBg.x = -15;
    hpBarBg.y = isBoss ? 38 : 33;
    container.addChild(hpBarBg);

    const hpBar = new PIXI.Graphics();
    hpBar.beginFill(0x00FF9C);
    hpBar.drawRect(0, 0, 30, 4);
    hpBar.endFill();
    hpBar.x = -15;
    hpBar.y = isBoss ? 38 : 33;
    container.addChild(hpBar);

    const lockIndicator = new PIXI.Graphics();
    lockIndicator.lineStyle(2, 0x00FF9C, 0.9);
    lockIndicator.drawCircle(0, 0, 22);
    lockIndicator.visible = false;
    container.addChild(lockIndicator);

    const screenH = this.app.screen.height;
    const margin = 100;
    const lane = margin + Math.random() * (screenH - margin * 2);
    container.x = this.app.screen.width + 60;
    container.y = lane;

    const speed = 1.5 + Math.random() * 1 + (this.state.wave - 1) * 0.3;
    const hp = isBoss ? 5 + this.state.wave : 2;
    const choices = this.wordManager.getChoices(word);
    const correctIndex = choices.indexOf(word.zh);

    const monster: MonsterInstance = {
      sprite, container, word,
      choices, correctIndex,
      hp, maxHp: hp,
      speed, isBoss,
      lane, alive: true,
      hpBar, hpBarBg,
      wordText, lockIndicator,
    };

    this.monsters.push(monster);
    this.roadContainer.addChild(container);
  }

  private showFeedback(correct: boolean, word: string, meaning: string): void {
    this.lastFeedback = { correct, word, meaning };
    this.feedbackTimer = 1.5;

    this.feedbackIcon.text = correct ? '✓' : '✗';
    this.feedbackIcon.style.fill = correct ? '#00FF9C' : '#FF4757';
    this.feedbackIcon.style.fontSize = 36;
    this.feedbackIcon.visible = true;
    this.feedbackIcon.alpha = 1;
    this.feedbackIcon.x = this.app.screen.width / 2;
    this.feedbackIcon.y = this.app.screen.height / 2 - 50;

    this.feedbackText.text = `${word} = ${meaning}`;
    this.feedbackText.style.fill = correct ? '#00FF9C' : '#FF4757';
    this.feedbackText.visible = true;
    this.feedbackText.alpha = 1;
    this.feedbackText.x = this.app.screen.width / 2;
    this.feedbackText.y = this.app.screen.height / 2 - 15;

    this.onFeedback?.({ correct, word, meaning });
  }

  handleSelect(key: 'A' | 'B' | 'C'): void {
    const choiceMap: Record<string, number> = { A: 0, B: 1, C: 2 };
    const idx = choiceMap[key];

    if (this.state.mode === 'arena' && this.currentArenaWord) {
      if (idx === undefined || idx >= this.arenaChoices.length) return;
      const choice = this.arenaChoices[idx];
      const correct = choice === this.currentArenaWord.zh;

      if (correct) {
        this.applyCorrectAnswer(this.currentArenaWord.en);
        this.spawnArenaHitEffect(this.arenaMonsterFighter.x, this.arenaMonsterFighter.y);
        this.currentArenaWord = null;
        this.switchToRoad();
      } else {
        this.applyWrongAnswer(this.currentArenaWord.en, this.currentArenaWord.zh);
        this.spawnArenaMissEffect(this.arenaFighter.x, this.arenaFighter.y);
        this.currentArenaWord = null;
        this.switchToRoad();
        if (this.state.hp <= 0) {
          this.endGame('defeat');
        }
      }
      return;
    }

    if (this.state.mode === 'road' && this.targetedMonsterIndex >= 0) {
      const m = this.monsters[this.targetedMonsterIndex];
      if (!m || !m.alive) return;

      if (idx === undefined || idx >= m.choices.length) return;
      const correct = idx === m.correctIndex;

      if (correct) {
        this.fireBulletAtMonster(m);
        this.resources.sounds.shoot();
      } else {
        this.applyWrongAnswer(m.word.en, m.word.zh);
      }
    }
  }

  private fireBulletAtMonster(m: MonsterInstance): void {
    const texture = this.resources.textures.bullet;
    const bullet = new PIXI.Sprite(texture);
    bullet.anchor.set(0.5);
    bullet.x = this.playerContainer.x + 30;
    bullet.y = this.playerContainer.y;

    const dx = m.container.x - bullet.x;
    const dy = m.container.y - bullet.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const speed = 12;

    const bulletInst: BulletInstance = {
      sprite: bullet,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
      alive: true,
    };

    bulletInst.targetMonster = m;

    this.bullets.push(bulletInst);
    this.roadContainer.addChild(bullet);
  }

  private applyCorrectAnswer(wordEn: string): void {
    this.state.combo++;
    this.state.maxCombo = Math.max(this.state.maxCombo, this.state.combo);
    this.state.kills++;
    this.state.correctAnswers++;
    this.wordManager.recordAnswer(wordEn, true);

    const comboBonus = Math.floor(this.state.combo / 5) * 5;
    this.state.score += 10 + comboBonus;

    this.resources.sounds.hit();
    if (this.state.combo >= 5) this.resources.sounds.combo();
  }

  private applyWrongAnswer(wordEn: string, wordZh: string): void {
    this.state.combo = 0;
    this.state.wrongAnswers++;
    this.state.hp = Math.max(0, this.state.hp - 10);
    this.resources.sounds.wrong();
    this.wordManager.recordAnswer(wordEn, false);
    this.showFeedback(false, wordEn, wordZh);
  }

  private updateCrosshair(): void {
    if (!this.input.isMobile) {
      const mousePos = this.input.state.pointer;
      const canvas = this.app.view as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();
      this.crosshair.x = (mousePos.x - rect.left) * (canvas.width / rect.width);
      this.crosshair.y = (mousePos.y - rect.top) * (canvas.height / rect.height);
      this.crosshair.visible = true;
    } else {
      this.crosshair.visible = false;
    }
  }

  private updateBullets(dt: number): void {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      if (!b.alive) continue;

      if (b.targetMonster && b.targetMonster.alive) {
        const dx = b.targetMonster.container.x - b.sprite.x;
        const dy = b.targetMonster.container.y - b.sprite.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const speed = 12;
        b.vx = (dx / dist) * speed;
        b.vy = (dy / dist) * speed;
      }

      b.sprite.x += b.vx * dt * 60;
      b.sprite.y += b.vy * dt * 60;

      if (b.sprite.x > this.app.screen.width + 50 || b.sprite.x < -50 ||
          b.sprite.y > this.app.screen.height + 50 || b.sprite.y < -50) {
        b.alive = false;
        this.roadContainer.removeChild(b.sprite);
        this.bullets.splice(i, 1);
        continue;
      }

      for (let j = this.monsters.length - 1; j >= 0; j--) {
        const m = this.monsters[j];
        if (!m.alive) continue;

        const dx = b.sprite.x - m.container.x;
        const dy = b.sprite.y - m.container.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 25) {
          b.alive = false;
          this.roadContainer.removeChild(b.sprite);
          this.bullets.splice(i, 1);
          this.hitMonster(m, j);
          break;
        }
      }
    }
  }

  private hitMonster(m: MonsterInstance, index: number): void {
    m.hp--;
    this.resources.sounds.hit();

    m.hpBar.clear();
    const hpRatio = m.hp / m.maxHp;
    m.hpBar.beginFill(hpRatio > 0.5 ? 0x00FF9C : 0xFF4757);
    m.hpBar.drawRect(0, 0, 30 * hpRatio, 4);
    m.hpBar.endFill();

    if (m.hp <= 0) {
      m.alive = false;
      if (this.targetedMonsterIndex === index) {
        this.targetedMonsterIndex = -1;
        this.targetedWord = '';
        this.roadChoices = [];
        this.onChoicesUpdate?.('', []);
      }
      this.roadContainer.removeChild(m.container);
      this.monsters.splice(index, 1);

      this.applyCorrectAnswer(m.word.en);
      this.showFeedback(true, m.word.en, m.word.zh);

      const comboBonus = Math.floor(this.state.combo / 5) * 5;
      this.state.score += 10 + comboBonus + (m.isBoss ? 20 : 0);

      this.spawnExplosionEffect(m.container.x, m.container.y);
    }
  }

  private checkWaveEnd(): void {
    const total = this.state.correctAnswers + this.state.wrongAnswers;
    this.state.accuracy = total > 0 ? Math.round((this.state.correctAnswers / total) * 100) : 100;
    this.state.timeLeft = Math.max(0, Math.ceil(60 - this.waveTime));

    if (this.waveTime >= 60) {
      if (this.state.wave >= this.state.totalWaves) {
        this.endGame('victory');
      } else {
        this.state.wave++;
        this.startWave();
      }
    }
  }

  private endGame(result: 'victory' | 'defeat'): void {
    this.state.status = 'over';
    this.resources.sounds.bgm.stop();
    this.state.xpGained = this.state.score + this.state.kills * 5 + this.state.maxCombo * 3;
    this.onGameOver?.(result);
  }

  private spawnExplosionEffect(x: number, y: number): void {
    for (let i = 0; i < 8; i++) {
      const p = new PIXI.Sprite(this.resources.textures.explosion);
      p.anchor.set(0.5);
      p.x = x;
      p.y = y;
      p.scale.set(0.5 + Math.random() * 0.5);
      const angle = (Math.PI * 2 * i) / 8;
      const speed = 2 + Math.random() * 3;
      this.roadContainer.addChild(p);

      let life = 0.5;
      const animate = () => {
        life -= 0.016;
        p.x += Math.cos(angle) * speed;
        p.y += Math.sin(angle) * speed;
        p.alpha = life / 0.5;
        if (life <= 0) {
          this.roadContainer.removeChild(p);
        } else {
          requestAnimationFrame(animate);
        }
      };
      animate();
    }
  }

  private spawnArenaHitEffect(x: number, y: number): void {
    for (let i = 0; i < 12; i++) {
      const p = new PIXI.Sprite(this.resources.textures.explosion);
      p.anchor.set(0.5);
      p.x = x;
      p.y = y;
      p.scale.set(0.8 + Math.random() * 0.6);
      const angle = (Math.PI * 2 * i) / 12;
      const speed = 3 + Math.random() * 4;
      this.arenaContainer.addChild(p);

      let life = 0.6;
      const animate = () => {
        life -= 0.016;
        p.x += Math.cos(angle) * speed;
        p.y += Math.sin(angle) * speed;
        p.alpha = life / 0.6;
        if (life <= 0) {
          this.arenaContainer.removeChild(p);
        } else {
          requestAnimationFrame(animate);
        }
      };
      animate();
    }
  }

  private spawnArenaMissEffect(x: number, y: number): void {
    for (let i = 0; i < 8; i++) {
      const p = new PIXI.Graphics();
      p.beginFill(0xFF4757);
      p.drawCircle(0, 0, 3);
      p.endFill();
      p.x = x;
      p.y = y;
      const angle = (Math.PI * 2 * i) / 8;
      const speed = 2 + Math.random() * 2;
      this.arenaContainer.addChild(p);

      let life = 0.4;
      const animate = () => {
        life -= 0.016;
        p.x += Math.cos(angle) * speed;
        p.y += Math.sin(angle) * speed;
        p.alpha = life / 0.4;
        if (life <= 0) {
          this.arenaContainer.removeChild(p);
        } else {
          requestAnimationFrame(animate);
        }
      };
      animate();
    }
  }

  private updateHUD(): void {
    this.modeText.text = this.state.mode === 'road' ? 'ROAD' : 'ARENA';
    this.modeText.style.fill = this.state.mode === 'road' ? '#00FF9C' : '#FF4757';
    this.scoreText.text = `SCORE: ${this.state.score}`;
    this.timeText.text = `${this.state.timeLeft}s`;
    this.waveText.text = `WAVE ${this.state.wave}/${this.state.totalWaves}`;

    if (this.state.combo >= 3) {
      this.comboText.text = `${this.state.combo} COMBO!`;
      this.comboText.alpha = 0.6 + Math.sin(this.gameTime * 5) * 0.3;
    } else {
      this.comboText.text = '';
    }

    this.hpBar.clear();
    const hpRatio = this.state.hp / this.state.maxHp;
    const hpColor = hpRatio > 0.5 ? 0x00FF9C : hpRatio > 0.25 ? 0xFFD700 : 0xFF4757;
    this.hpBar.beginFill(hpColor);
    this.hpBar.drawRect(0, 0, 200 * hpRatio, 16);
    this.hpBar.endFill();

    this.onStateUpdate?.({ ...this.state });
  }

  destroy(): void {
    this.resources.destroy();
    this.input.destroy();
  }
}