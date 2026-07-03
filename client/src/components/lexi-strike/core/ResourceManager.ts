import * as PIXI from 'pixi.js';

interface TextureCache {
  player: PIXI.Texture;
  monster: PIXI.Texture;
  monsterBoss: PIXI.Texture;
  bullet: PIXI.Texture;
  hpBar: PIXI.Texture;
  hpBarBg: PIXI.Texture;
  explosion: PIXI.Texture;
  buttonA: PIXI.Texture;
  buttonB: PIXI.Texture;
  buttonC: PIXI.Texture;
}

interface SoundCache {
  shoot: () => void;
  hit: () => void;
  wrong: () => void;
  combo: () => void;
  bgm: { start: () => void; stop: () => void };
  bossAlert: () => void;
}

export class ResourceManager {
  public textures!: TextureCache;
  public sounds!: SoundCache;
  private audioCtx: AudioContext | null = null;
  private bgmOsc: OscillatorNode | null = null;
  private bgmGain: GainNode | null = null;

  generateTextures(app: PIXI.Application): TextureCache {
    const g = new PIXI.Graphics();

    g.clear();
    g.beginFill(0x00FF9C);
    g.drawRect(-15, -10, 30, 20);
    g.endFill();
    g.beginFill(0xFFFFFF);
    g.drawRect(8, -3, 18, 6);
    g.endFill();
    g.beginFill(0x00CC7A);
    g.drawRect(-18, -8, 36, 4);
    g.endFill();
    const playerTex = app.renderer.generateTexture(g);

    g.clear();
    g.beginFill(0xFF4757);
    g.drawCircle(0, 0, 18);
    g.endFill();
    g.beginFill(0x000000);
    g.drawCircle(-5, -4, 3);
    g.drawCircle(5, -4, 3);
    g.endFill();
    g.beginFill(0xFFFFFF);
    g.drawCircle(-5, -4, 1);
    g.drawCircle(5, -4, 1);
    g.endFill();
    g.lineStyle(2, 0x000000);
    g.arc(0, 2, 6, 0, Math.PI, false);
    const monsterTex = app.renderer.generateTexture(g);

    g.clear();
    g.beginFill(0xFFD700);
    g.drawCircle(0, 0, 24);
    g.endFill();
    g.beginFill(0x000000);
    g.drawCircle(-7, -5, 4);
    g.drawCircle(7, -5, 4);
    g.endFill();
    g.beginFill(0xFF0000);
    g.drawCircle(-7, -5, 2);
    g.drawCircle(7, -5, 2);
    g.endFill();
    g.lineStyle(3, 0x000000);
    g.arc(0, 3, 8, 0, Math.PI, false);
    g.lineStyle(1, 0xFF4757);
    g.drawCircle(0, 0, 26);
    const bossTex = app.renderer.generateTexture(g);

    g.clear();
    g.beginFill(0xFFD700);
    g.drawCircle(0, 0, 4);
    g.endFill();
    g.beginFill(0xFFFFFF);
    g.drawCircle(0, 0, 2);
    g.endFill();
    const bulletTex = app.renderer.generateTexture(g);

    g.clear();
    g.beginFill(0x333333);
    g.drawRect(0, 0, 60, 6);
    g.endFill();
    const hpBarBgTex = app.renderer.generateTexture(g);

    g.clear();
    g.beginFill(0x00FF9C);
    g.drawRect(0, 0, 60, 6);
    g.endFill();
    const hpBarTex = app.renderer.generateTexture(g);

    g.clear();
    g.beginFill(0xFFD700);
    g.drawCircle(0, 0, 5);
    g.endFill();
    g.beginFill(0xFF8800);
    g.drawCircle(0, 0, 3);
    g.endFill();
    const explosionTex = app.renderer.generateTexture(g);

    g.clear();
    g.beginFill(0xFF4757);
    g.drawRoundedRect(-40, -18, 80, 36, 8);
    g.endFill();
    const buttonATex = app.renderer.generateTexture(g);

    g.clear();
    g.beginFill(0x0066FF);
    g.drawRoundedRect(-40, -18, 80, 36, 8);
    g.endFill();
    const buttonBTex = app.renderer.generateTexture(g);

    g.clear();
    g.beginFill(0x00FF9C);
    g.drawRoundedRect(-40, -18, 80, 36, 8);
    g.endFill();
    const buttonCTex = app.renderer.generateTexture(g);

    this.textures = {
      player: playerTex,
      monster: monsterTex,
      monsterBoss: bossTex,
      bullet: bulletTex,
      hpBar: hpBarTex,
      hpBarBg: hpBarBgTex,
      explosion: explosionTex,
      buttonA: buttonATex,
      buttonB: buttonBTex,
      buttonC: buttonCTex,
    };

    return this.textures;
  }

  generateSounds(): SoundCache {
    this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

    const shoot = () => {
      if (!this.audioCtx) return;
      const ctx = this.audioCtx;
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length * 0.3));
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const gain = ctx.createGain();
      gain.gain.value = 0.3;
      src.connect(gain).connect(ctx.destination);
      src.start();
    };

    const hit = () => {
      if (!this.audioCtx) return;
      const ctx = this.audioCtx;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 200;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    };

    const wrong = () => {
      if (!this.audioCtx) return;
      const ctx = this.audioCtx;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 110;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    };

    const combo = () => {
      if (!this.audioCtx) return;
      const ctx = this.audioCtx;
      [440, 554, 660].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.08 + 0.2);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.08);
        osc.stop(ctx.currentTime + i * 0.08 + 0.2);
      });
    };

    const bossAlert = () => {
      if (!this.audioCtx) return;
      const ctx = this.audioCtx;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(400, ctx.currentTime + 0.3);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    };

    const bgm = {
      start: () => {
        if (!this.audioCtx || this.bgmOsc) return;
        const ctx = this.audioCtx;
        this.bgmOsc = ctx.createOscillator();
        this.bgmOsc.type = 'sine';
        this.bgmOsc.frequency.value = 55;
        this.bgmGain = ctx.createGain();
        this.bgmGain.gain.value = 0.05;
        this.bgmOsc.connect(this.bgmGain).connect(ctx.destination);
        this.bgmOsc.start();
      },
      stop: () => {
        if (this.bgmOsc) {
          this.bgmOsc.stop();
          this.bgmOsc.disconnect();
          this.bgmOsc = null;
          this.bgmGain = null;
        }
      },
    };

    this.sounds = { shoot, hit, wrong, combo, bgm, bossAlert };
    return this.sounds;
  }

  resumeAudio(): void {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  destroy(): void {
    this.sounds.bgm.stop();
    if (this.audioCtx) {
      this.audioCtx.close();
    }
  }
}