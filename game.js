// ============================================================
//  PIG CAN FLY  –  Phaser 3 browser game
// ============================================================

const W = 1280;
const H = 720;
const GROUND_Y = 628;          // top of ground strip

// ---- world / physics constants ----
const PIG_RUN_H    = 77;   // target display height for run pig body
const PIG_FLY_SCALE = 0.6619; // 15% smaller than original 0.7741
const SCROLL_SPEED_BASE  = 280;  // px/s
const GRAVITY            = 1800;
const JUMP_VELOCITY      = -700;
const JUMP_VELOCITY_HIGH = -950; // Lightfoot power

// ---- fruit types ----
const FRUITS = [
  { name:'Apple',      emoji:'🍎', color:0xe53935, power:'Lightfoot'     },
  { name:'Orange',     emoji:'🍊', color:0xfb8c00, power:'OrangeSmash'   },
  { name:'Banana',     emoji:'🍌', color:0xfdd835, power:'Flight'        },
  { name:'Pineapple',  emoji:'🍍', color:0xc0ca33, power:'PineappleShield'},
  { name:'Strawberry', emoji:'🍓', color:0xe91e63, power:'StrawberrySpeed'},
  { name:'Grapes',     emoji:'🍇', color:0x7b1fa2, power:'Magnet'        },
];

// ---- obstacle types ----
const OBSTACLES = [
  { name:'Haystack',  color:0xd4a017, w:70,  h:55  },
  { name:'Gate',      color:0x795548, w:90,  h:110 },
  { name:'Bush',      color:0x388e3c, w:80,  h:50  },
  { name:'Tractor',   color:0xb71c1c, w:160, h:130 },
  { name:'Boulder',   color:0x607d8b, w:75,  h:65  },
];

// ---- power durations ----
const POWER_DURATION = {
  Lightfoot:      15000,
  Flight:         20000,
  OrangeSmash:    12000,  // destroy obstacles but slow you down
  StrawberrySpeed: 8000,  // fast + score multiplier, short window
  PineappleShield: 0,     // absorbs one hit then ends — no timer
  Magnet:         15000,
};

const POWER_COLORS = {
  Lightfoot:       0xffd700,
  Flight:          0x42a5f5,
  OrangeSmash:     0xff8800,
  StrawberrySpeed: 0xff1744,
  PineappleShield: 0xc6ff00,
  Magnet:          0xce93d8,
};

// ---- difficulty phase settings ----
const PHASE_SPEEDS      = [200, 280, 380];   // phase 1 / 2 / 3
const PHASE_FRUIT_DIST  = [250, 450, 650];   // distance between fruit spawns
const PHASE_OBS_SCALE   = [0.50, 1.0, 1.0]; // obstacle height scale — 50% smaller in phase 1

// ---- power strength (higher wins) ----
const POWER_STRENGTH = {
  Flight:          5,
  OrangeSmash:     4,
  PineappleShield: 3,
  StrawberrySpeed: 3,
  Lightfoot:       2,
  Magnet:          1,
};

// ============================================================
//  BootScene – generate textures, load images
// ============================================================
class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    // Pig sprites
    this.load.spritesheet('pigrun_sheet', 'assets/pig_run_sheet.png', {
      frameWidth: 117, frameHeight: 96, endFrame: 11
    });
    this.load.image('pignowing', 'assets/pigrun.jpg');
    this.load.image('pigjump',  'assets/pigjump0wing.jpg');
    this.load.image('pigopen',  'pigmouthopen.PNG');
    this.load.image('pigcalm',  'pigflymouthclose.PNG');
    this.load.image('pigfly',   'assets/pigfly_clean.png');
    this.load.spritesheet('pigfly_sheet', 'assets/pig_fly_sheet.png', {
      frameWidth: 300, frameHeight: 169, endFrame: 11
    });
    // Fruit PNGs
    // Obstacle PNGs
    for (let i = 0; i < 8; i++) this.load.image('crow_f' + i, 'assets/crow_f' + i + '.png');
    this.load.image('obs_haystack', 'assets/obs_haystack.PNG');
    this.load.image('obs_gate',     'assets/obs_gate.PNG');
    this.load.image('obs_bush',     'assets/obs_bush.PNG');
    this.load.image('obs_tractor',  'assets/obs_tractor.PNG');
    this.load.image('obs_boulder',  'assets/obs_boulder.PNG');
    // Fruit PNGs
    this.load.image('fruit_apple',      'assets/apple.PNG');
    this.load.image('fruit_orange',     'assets/orange.PNG');
    this.load.image('fruit_banana',     'assets/banana.PNG');
    this.load.image('fruit_pineapple',  'assets/pineapple.PNG');
    this.load.image('fruit_strawberry', 'assets/strawberry.PNG');
    this.load.image('fruit_grapes',     'assets/grapes.PNG');
  }

  create() {
    this._makeTextures();
    this.scene.start('Start');
  }

  _makeTextures() {
    const g = this.make.graphics({ add: false });
    this._genSky(g);
    this._genClouds(g);
    this._genHills(g);
    this._genGround(g);
    // Fruits — loaded as PNGs in preload(), no generation needed
    this._genObstacles(g);
    // Aura
    g.clear();
    g.lineStyle(4, 0xffffff, 0.6);
    g.strokeCircle(30, 30, 28);
    g.generateTexture('aura', 60, 60);

    // Star (for death animation)
    g.clear();
    g.fillStyle(0xffee44);
    const pts = 5;
    const cx = 16, cy = 16, ro = 14, ri = 6;
    g.beginPath();
    for (let i = 0; i < pts * 2; i++) {
      const angle = (i * Math.PI / pts) - Math.PI / 2;
      const r = i % 2 === 0 ? ro : ri;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.closePath();
    g.fillPath();
    g.lineStyle(1, 0xffaa00);
    g.strokePath();
    g.generateTexture('star', 32, 32);

    g.destroy();
  }

    _genSky(g) {
        g.clear();
        for (let y = 0; y < H; y++) {
            const t = y / H;
            const r = Math.floor(135 + t * 50);
            const gr = Math.floor(195 + t * 30);
            const b = Math.floor(235 - t * 20);
            g.fillStyle(Phaser.Display.Color.GetColor(r, gr, b));
            g.fillRect(0, y, W, 1);
        }
        g.generateTexture('sky', W, H);
    }

    _genClouds(g) {
        g.clear();
        const cw = 2560;
        for (let i = 0; i < 12; i++) {
            const cx = Phaser.Math.Between(50, cw - 50);
            const cy = Phaser.Math.Between(30, 200);
            const s = Phaser.Math.FloatBetween(0.6, 1.2);
            g.fillStyle(0xffffff, 0.85);
            g.fillEllipse(cx, cy, 120 * s, 50 * s);
            g.fillEllipse(cx - 40 * s, cy + 10, 80 * s, 40 * s);
            g.fillEllipse(cx + 40 * s, cy + 10, 90 * s, 45 * s);
            g.fillStyle(0xffffff, 0.6);
            g.fillEllipse(cx + 10, cy - 10, 100 * s, 35 * s);
        }
        g.generateTexture('clouds', cw, 250);
    }

    _genHills(g) {
        g.clear();
        const hw = 2560;
        const hh = 300;
        // Distant hills
        g.fillStyle(0x7cb87c, 0.7);
        g.beginPath();
        g.moveTo(0, hh);
        for (let x = 0; x <= hw; x += 2) {
            const y = hh - 80 - Math.sin(x * 0.004) * 50 - Math.sin(x * 0.007) * 30 - Math.sin(x * 0.013) * 15;
            g.lineTo(x, y);
        }
        g.lineTo(hw, hh);
        g.closePath();
        g.fillPath();

        // Closer hills
        g.fillStyle(0x5da05d, 0.8);
        g.beginPath();
        g.moveTo(0, hh);
        for (let x = 0; x <= hw; x += 2) {
            const y = hh - 40 - Math.sin(x * 0.006 + 1) * 35 - Math.sin(x * 0.011 + 2) * 20;
            g.lineTo(x, y);
        }
        g.lineTo(hw, hh);
        g.closePath();
        g.fillPath();

        g.generateTexture('hills', hw, hh);
    }

    _genGround(g) {
        g.clear();
        const gw = 2560;

        // Dirt path
        g.fillStyle(0xc4955a);
        g.fillRect(0, 0, gw, 100);

        // Grass top edge
        g.fillStyle(0x6abf4b);
        g.fillRect(0, 0, gw, 12);

        // Grass tufts
        g.fillStyle(0x7dd35f);
        for (let x = 0; x < gw; x += 15) {
            const h = Phaser.Math.Between(5, 14);
            g.fillTriangle(x, 12, x + 4, 12 - h, x + 8, 12);
        }

        // Subtle dirt texture
        for (let i = 0; i < 200; i++) {
            g.fillStyle(0xb08545, 0.3);
            const rx = Phaser.Math.Between(0, gw);
            const ry = Phaser.Math.Between(15, 100 - 5);
            g.fillCircle(rx, ry, Phaser.Math.Between(1, 3));
        }

        // Small flowers
        for (let x = 0; x < gw; x += Phaser.Math.Between(60, 120)) {
            const colors = [0xffdddd, 0xffffdd, 0xddddff, 0xffccee];
            g.fillStyle(Phaser.Math.RND.pick(colors));
            g.fillCircle(x, 8, 3);
            g.fillStyle(0xffff88);
            g.fillCircle(x, 8, 1.5);
        }

        g.generateTexture('ground', gw, 100);
    }

    _genFruit(g, type) {
        g.clear();
        const s = 40;
        const c = s / 2;

        switch (type) {
            case 'apple':
                g.fillStyle(0xff3333);
                g.fillCircle(c, c + 4, 14);
                g.fillCircle(c - 4, c + 2, 12);
                g.fillCircle(c + 4, c + 2, 12);
                g.fillStyle(0x44aa22);
                g.fillRect(c - 1, c - 12, 3, 8);
                g.fillEllipse(c + 6, c - 8, 8, 5);
                // Highlight
                g.fillStyle(0xffffff, 0.4);
                g.fillCircle(c - 4, c - 2, 4);
                break;
            case 'orange':
                g.fillStyle(0xff8800);
                g.fillCircle(c, c + 2, 15);
                g.fillStyle(0xffaa33, 0.5);
                g.fillCircle(c - 3, c - 2, 6);
                g.fillStyle(0x44aa22);
                g.fillRect(c - 1, c - 14, 3, 6);
                g.fillEllipse(c + 5, c - 11, 7, 4);
                g.fillStyle(0xffffff, 0.3);
                g.fillCircle(c - 4, c - 3, 4);
                break;
            case 'banana':
                g.fillStyle(0xffdd22);
                // Curved banana shape using arcs
                g.beginPath();
                g.arc(c, c + 15, 20, -2.3, -0.8, false);
                g.arc(c, c + 15, 14, -0.8, -2.3, true);
                g.closePath();
                g.fillPath();
                g.fillStyle(0x886611);
                g.fillCircle(c + 10, c - 2, 2);
                g.fillCircle(c - 12, c + 8, 2);
                g.fillStyle(0xffffff, 0.3);
                g.fillEllipse(c - 2, c + 2, 8, 4);
                break;
            case 'pineapple':
                g.fillStyle(0xddaa00);
                g.fillEllipse(c, c + 4, 22, 28);
                // Cross-hatch pattern
                g.lineStyle(1, 0xcc8800, 0.5);
                for (let i = -8; i <= 8; i += 4) {
                    g.lineBetween(c - 11, c + i, c + 11, c + i + 6);
                    g.lineBetween(c - 11, c + i + 6, c + 11, c + i);
                }
                // Crown
                g.fillStyle(0x33aa22);
                g.fillTriangle(c - 6, c - 10, c - 3, c - 22, c, c - 10);
                g.fillTriangle(c - 2, c - 10, c + 1, c - 24, c + 4, c - 10);
                g.fillTriangle(c + 2, c - 10, c + 5, c - 20, c + 8, c - 10);
                break;
            case 'strawberry':
                g.fillStyle(0xff2255);
                g.fillTriangle(c - 12, c - 4, c + 12, c - 4, c, c + 16);
                g.fillCircle(c, c - 2, 13);
                // Seeds
                g.fillStyle(0xffee88);
                for (let i = 0; i < 6; i++) {
                    const a = (i / 6) * Math.PI * 2;
                    g.fillCircle(c + Math.cos(a) * 7, c + Math.sin(a) * 5, 1.5);
                }
                // Leaves
                g.fillStyle(0x33aa22);
                g.fillEllipse(c - 5, c - 12, 8, 5);
                g.fillEllipse(c + 5, c - 12, 8, 5);
                g.fillEllipse(c, c - 13, 6, 6);
                g.fillStyle(0xffffff, 0.3);
                g.fillCircle(c - 4, c - 4, 3);
                break;
            case 'grapes':
                g.fillStyle(0x8833bb);
                const positions = [
                    [0, -6], [-6, 0], [6, 0], [-3, 6], [3, 6], [0, 12],
                    [-9, 6], [9, 6], [-6, 12], [6, 12]
                ];
                positions.forEach(([ox, oy]) => {
                    g.fillCircle(c + ox, c + oy, 5);
                });
                g.fillStyle(0xaa55dd, 0.5);
                positions.slice(0, 4).forEach(([ox, oy]) => {
                    g.fillCircle(c + ox - 1, c + oy - 1, 2);
                });
                g.fillStyle(0x33aa22);
                g.fillRect(c - 1, c - 14, 2, 8);
                g.fillEllipse(c + 4, c - 11, 6, 4);
                break;
        }

        g.generateTexture('fruit_' + type, s, s);
    }

    _genObstacles(g) {
        // Obstacles loaded as PNGs in preload() — no generation needed
    }

    _genParticle(g) {
        g.clear();
        g.fillStyle(0xffffff);
        g.fillCircle(4, 4, 4);
        g.generateTexture('particle', 8, 8);

        g.clear();
        g.fillStyle(0xffdd44);
        // Draw a star shape manually
        const cx = 8, cy = 8, points = 5, outerR = 8, innerR = 3;
        g.beginPath();
        for (let i = 0; i < points * 2; i++) {
            const r = i % 2 === 0 ? outerR : innerR;
            const angle = (i * Math.PI / points) - Math.PI / 2;
            const sx = cx + Math.cos(angle) * r;
            const sy = cy + Math.sin(angle) * r;
            if (i === 0) g.moveTo(sx, sy);
            else g.lineTo(sx, sy);
        }
        g.closePath();
        g.fillPath();
        g.generateTexture('star', 16, 16);

        // Debris chunk
        g.clear();
        g.fillStyle(0xaa8844);
        g.fillRect(0, 0, 12, 10);
        g.fillStyle(0x997733);
        g.fillRect(2, 2, 8, 6);
        g.generateTexture('debris', 12, 10);

        // Dust puff
        g.clear();
        g.fillStyle(0xddccaa, 0.6);
        g.fillCircle(8, 8, 8);
        g.generateTexture('dust', 16, 16);
    }

    _genPowerIcons(g) {
        Object.entries(POWER_INFO).forEach(([fruit, info]) => {
            g.clear();
            g.fillStyle(info.color, 0.8);
            g.fillRoundedRect(0, 0, 36, 36, 6);
            g.lineStyle(2, 0xffffff, 0.8);
            g.strokeRoundedRect(0, 0, 36, 36, 6);
            g.generateTexture('power_icon_' + fruit, 36, 36);
        });
    }
}

// ============================================================
//  StartScene
// ============================================================
class StartScene extends Phaser.Scene {
  constructor() { super('Start'); }

  create() {
    const top2 = Leaderboard.top().slice(0, 1);

    // Sky
    this.add.image(W/2, H/2, 'sky');

    // Scrolling hills + clouds in background
    this._bg1 = this.add.tileSprite(W/2, H - 200, W, 160, 'hills').setOrigin(0.5, 1);
    this._bg2 = this.add.tileSprite(W/2, 120, W, 120, 'clouds').setOrigin(0.5, 0);
    this.add.tileSprite(W/2, H, W, 100, 'ground').setOrigin(0.5, 1);

    // Title
    this.add.text(W/2, 140, 'PIG CAN FLY', {
      fontFamily: 'Impact, Arial Black, sans-serif',
      fontSize: '96px',
      color: '#fff',
      stroke: '#d32f2f',
      strokeThickness: 8,
      shadow: { offsetX: 4, offsetY: 4, color: '#000', blur: 0, fill: true }
    }).setOrigin(0.5);

    // Top 2 scores
    const s0 = top2[0] || 0;
    this.add.text(W/2, 250, `🥇  ${s0 > 0 ? s0.toLocaleString() : '---'}`, {
      fontFamily: 'Arial Black, Arial', fontSize: '28px',
      color: '#ffd700', stroke: '#000', strokeThickness: 4
    }).setOrigin(0.5);

    // Animated pig on start screen
    const pig = this.add.sprite(W/2, GROUND_Y, 'pigrun_sheet', 0).setOrigin(0.5, 1);
pig.play('pig_run');
    pig.setScale(Math.min(103 / pig.width, 77 / pig.height));
    this.tweens.add({
      targets: pig,
      y: GROUND_Y - 4,
      duration: 300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Tap to start
    const tapText = this.add.text(W/2, 480, 'TAP OR PRESS SPACE TO START', {
      fontFamily: 'Arial', fontSize: '36px', color: '#fff', stroke:'#000', strokeThickness:4
    }).setOrigin(0.5);

    this.tweens.add({ targets: tapText, alpha: 0, duration: 500, yoyo: true, repeat: -1 });

    // Controls hint
    this.add.text(W/2, 560, 'SPACE / TAP  =  Jump  |  Double Jump allowed', {
      fontFamily: 'Arial', fontSize: '22px', color: '#e0e0e0', stroke:'#000', strokeThickness:3
    }).setOrigin(0.5);



    this._startGame = () => { PigMusicPlayer.start(); this.scene.start('Game'); };

    this.input.keyboard.once('keydown-SPACE', this._startGame);
    this.input.once('pointerdown', this._startGame);
  }

  update() {
    this._bg1.tilePositionX += 1;
    this._bg2.tilePositionX += 0.3;
  }
}

// ============================================================
//  GameScene  (the main game)
// ============================================================
class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  // ----------------------------------------------------------
  create() {
    this._score        = 0;
    this._distance     = 0;
    this._phase        = 1;
    this._maxJumps     = 1;
    this._scrollSpeed  = PHASE_SPEEDS[0];
    this._alive        = true;
    this._jumpCount    = 0;     // 0,1,2
    this._onGround     = true;
    this._velY         = 0;
    this._pigY         = GROUND_Y;   // pig bottom y
    this._fruitCounts  = {};
    FRUITS.forEach(f => { this._fruitCounts[f.name] = 0; });
    this._totalFruitsCollected = 0;
    this._activePower  = null;
    this._powerTimer   = 0;
    this._powersUsed   = new Set();
    this._nextObsDist  = 600;
    this._nextFruitDist = PHASE_FRUIT_DIST[0];
    this._distSinceLastObs  = 0;
    this._distSinceLastFruit= 0;
    this._flightVelY   = 0;
    this._magnetRadius = 220;
    this._deathTriggered = false;
    this._scoreMultiplier = 1;
    this._shieldHits = 0;

    // Pre-place first obstacle so it arrives at pig in ~4 seconds
    // pig is at x=200, scroll speed=200px/s → obstacle starts at 200 + (4 * 200) = 1000
    this.time.delayedCall(100, () => {
      const def = { name:'Haystack', color:0xd4a017, w:70, h:55 }; // simple starter obstacle
      const obs = this.add.image(1000, GROUND_Y, 'obs_haystack').setOrigin(0, 1).setDepth(3);
      obs.setDisplaySize(def.w, def.h * 0.50); // phase 1 scale
      obs._def = def;
      obs._hitW = def.w * 0.5;
      obs._hitH = def.h * 0.5 * 0.50;
      this._obstacles.add(obs);
    });

    // Delay auto-spawning so second obstacle doesn't come too soon
    this._distSinceLastObs = -400;

    // ---- Background layers ----
    this.add.image(W/2, H/2, 'sky');
    this._cloudLayer = this.add.tileSprite(W/2, 110, W, 120, 'clouds').setOrigin(0.5, 0);
    this._hillLayer  = this.add.tileSprite(W/2, H - 200, W, 160, 'hills').setOrigin(0.5, 1);
    this._groundLayer= this.add.tileSprite(W/2, H, W, 100, 'ground').setOrigin(0.5, 1);

    // ---- Groups ----
    this._obstacles = this.add.group();
    this._fruits    = this.add.group();

    // ---- Pig fly animation ----
    if (!this.anims.exists('pig_run')) {
      this.anims.create({
        key: 'pig_run',
        frames: this.anims.generateFrameNumbers('pigrun_sheet', { start: 0, end: 11 }),
        frameRate: 12,
        repeat: -1
      });
    }
    if (!this.anims.exists('pig_fly')) {
      this.anims.create({
        key: 'pig_fly',
        frames: this.anims.generateFrameNumbers('pigfly_sheet', { start: 0, end: 11 }),
        frameRate: 12,
        repeat: -1
      });
    }
    if (!this.anims.exists('crow_fly')) {
      this.anims.create({
        key: 'crow_fly',
        frames: [0,1,2,3,4,5,6,7].map(i => ({ key: 'crow_f' + i })),
        frameRate: 8,
        repeat: -1
      });
    }
    this._crows = this.add.group();
    this._nextCrowDist = 600;
    this._crowDistSince = 0;

    // ---- Pig (wingless image) ----
    this._pig = this.add.sprite(200, GROUND_Y + 2, 'pigrun_sheet', 0).setOrigin(0.5, 1).setDepth(4);
this._pig.play('pig_run');
    this._pigBounceTween = null;
    // ---- Wings overlay (sprite so it can animate; hidden by default) ----
    this._wings = null;
    this._scalePig();

    // ---- Aura (power visual) ----
    this._aura = this.add.image(0, 0, 'aura').setAlpha(0).setDepth(3); // depth below pig so never overlaps

    // ---- HUD ----
    this._buildHUD();

    // ---- Input ----
    this.input.keyboard.on('keydown-SPACE', () => this._doJump());
    this.input.on('pointerdown', () => this._doJump());

    // (debris particles are spawned imperatively in _explodeObstacle)
  }

  _scalePig() {
    const pig = this._pig;
    const targetH = PIG_RUN_H;
    const s = targetH / pig.height;
    pig.setScale(s);
    
  }

  _setPigTexture(key) {
    this._pig.stop();
    this._pig.setTexture(key);
    // Use natural texture height, not display height
    const naturalH = this._pig.texture.source[0].height;
    this._pig.setScale(72 / naturalH);
  }

  _setPigAnim(key, ignoreIfPlaying) {
    this._pig.play(key, ignoreIfPlaying);
    this._pig.setScale(72 / (this._pig.height || 66));
  }

  // ----------------------------------------------------------
  //  HUD
  // ----------------------------------------------------------
  _buildHUD() {
    const style = (size, color='#fff') => ({
      fontFamily: 'Arial Black, Arial', fontSize: `${size}px`,
      color, stroke: '#000', strokeThickness: 3
    });

    // Score
    this._scoreTxt = this.add.text(20, 16, 'Score: 0', style(28)).setDepth(10);

    // Top 2 leaderboard (top-left below score)
    this.add.text(20, 52, '🏆 TOP SCORE', {
      fontFamily: 'Arial Black', fontSize: '13px',
      color: '#ffe082', stroke: '#000', strokeThickness: 3
    }).setDepth(10);
    this._lbTexts = [];
    const medals = ['🥇','🥈'];
    const initScores = Leaderboard.top();
    for (let i = 0; i < 2; i++) {
      const s = initScores[i] || 0;
      const col = i === 0 ? '#ffd700' : '#c0c0c0';
      const t = this.add.text(20, 68 + i * 18,
        medals[i] + ' ' + (s > 0 ? s.toLocaleString() : '---'), {
        fontFamily: 'Arial', fontSize: '13px',
        color: col, stroke: '#000', strokeThickness: 3
      }).setDepth(10);
      this._lbTexts.push(t);
    }

    // Fruit counters (top-right)
    this._fruitHUD = [];
    FRUITS.forEach((f, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = W - 280 + col * 90;
      const y = 12 + row * 36;
      const icon = this.add.text(x, y, f.emoji, { fontSize: '22px' }).setDepth(10);
      const cnt  = this.add.text(x + 28, y + 2, '0', style(20)).setDepth(10);
      this._fruitHUD.push({ icon, cnt });
    });

    // Power bar (centre-top)
    const barX = W/2 - 150;
    const barY = 14;
    this._powerBg  = this.add.rectangle(W/2, barY + 10, 300, 20, 0x333333, 0.7).setOrigin(0.5, 0).setDepth(10);
    this._powerBar = this.add.rectangle(barX, barY + 10, 0, 20, 0xffd700).setOrigin(0, 0).setDepth(11);
    this._powerLbl = this.add.text(W/2, barY + 30, '', style(18, '#ffe082')).setOrigin(0.5, 0).setDepth(11);
    this._powerIcon= this.add.text(W/2, barY - 4, '', { fontSize: '28px' }).setOrigin(0.5, 0).setDepth(11);
  }

  _updateHUD() {
    this._scoreTxt.setText('Score: ' + Math.floor(this._score));
    FRUITS.forEach((f, i) => {
      this._fruitHUD[i].cnt.setText(String(this._fruitCounts[f.name]));
    });

    if (this._activePower) {
      const pct = this._activePower === 'PineappleShield' ? 1 : this._powerTimer / POWER_DURATION[this._activePower];
      this._powerBar.width = 300 * pct;
      const col = POWER_COLORS[this._activePower];

      // Panic flap in final 3 seconds
      const isShield = this._activePower === 'PineappleShield';
      const finalSeconds = !isShield && this._powerTimer <= 3000;

      if (finalSeconds) {
        // Ramp up wing animation speed based on how close to expiry
        const panicRate = Math.floor(Phaser.Math.Linear(24, 48, 1 - this._powerTimer / 3000));
        if (this._pig.anims.currentAnim) {
          this._pig.anims.msPerFrame = 1000 / panicRate;
        }
        // Shake pig slightly for extra drama
        this._pig.setX(200 + Phaser.Math.Between(-2, 2));
      } else {
        // Reset animation speed to normal
        if (this._pig.anims.currentAnim) {
          this._pig.anims.msPerFrame = 1000 / 12;
        }
        this._pig.setX(200);
      }

      // Pulse red in final 3 seconds
      if (finalSeconds) {
        const pulse = Math.sin(this.time.now / 80);  // fast pulse
        const r = pulse > 0 ? 0xff0000 : 0xff4400;    // alternates red shades
        this._powerBar.fillColor = r;
        this._powerBg.setAlpha(0.5 + 0.4 * Math.abs(pulse)); // bg flashes too
        this._powerLbl.setColor(pulse > 0 ? '#ff0000' : '#ff6600');
        // Scale bar slightly for drama
        const scl = 1 + 0.06 * Math.abs(pulse);
        this._powerBar.setScale(1, scl);
      } else {
        this._powerBar.fillColor = col;
        this._powerBg.setAlpha(0.7);
        this._powerLbl.setColor('#ffe082');
        this._powerBar.setScale(1, 1);
      }
      this._powerLbl.setText('');
      // No aura during Flight — it washes out the wings
      if (this._activePower === 'Flight') {
        this._aura.setAlpha(0);
      } else {
        this._aura.setTint(col).setAlpha(0.35 + 0.1 * Math.sin(this.time.now / 120));
      }
    } else {
      this._powerBar.width = 0;
      this._powerLbl.setText('');
      this._powerIcon.setText('');
      this._aura.setAlpha(0);
    }
  }

  // ----------------------------------------------------------
  //  Input
  // ----------------------------------------------------------
  _doJump() {
    if (!this._alive) return;
    if (this._activePower === 'Flight') {
      // Nudge upward in flight mode
      this._flightVelY = -350;
      return;
    }
    if (this._jumpCount < this._maxJumps) {
      PigSFX.jump();
      const vel = (this._activePower === 'Lightfoot') ? JUMP_VELOCITY_HIGH : JUMP_VELOCITY;
      this._velY = vel;
      this._jumpCount++;
      this._onGround = false;
    }
  }

  // ----------------------------------------------------------
  //  Spawning
  // ----------------------------------------------------------
  _spawnObstacle() {
    // Phase-gated obstacles:
    // Phase 1: Haystack, Bush, Boulder only
    // Phase 2: + Gate
    // Phase 3: + Tractor
    const available = OBSTACLES.filter(o => {
      if (o.name === 'Tractor') return this._phase >= 3;
      if (o.name === 'Gate')    return this._phase >= 2;
      return true;
    });
    const def = Phaser.Utils.Array.GetRandom(available);
    const x = W + def.w;
    // origin(0,1): x=left edge, y=bottom edge
    const obs = this.add.image(x, GROUND_Y, 'obs_' + def.name.toLowerCase()).setOrigin(0, 1).setDepth(3);
    const hScale = PHASE_OBS_SCALE[this._phase - 1];
    obs.setDisplaySize(def.w, def.h * hScale);
    obs._def = def;
    obs._hitW = def.w * 0.5;
    obs._hitH = def.name === 'Tractor' ? 75 : def.h * hScale * 0.5;
    this._obstacles.add(obs);
  }

  _spawnFruit() {
    // TEST MODE: 80% chance of banana so Flight mode triggers quickly
    const rand = Math.random();
    // Before 1000pts: no bananas, all other fruits
    // After 1000pts: bananas gradually increase from 10% to 60% by 3000pts
    const bananaChance = this._score < 1000 ? 0 : Math.min(0.60, 0.10 + ((this._score - 1000) / 2000) * 0.50);
    const nonBananaFruits = FRUITS.filter(f => f.name !== 'Banana');
    const def = rand < bananaChance ? FRUITS.find(f => f.name === 'Banana') : Phaser.Utils.Array.GetRandom(nonBananaFruits);
    const x = W + 30;
    const minY = 160;
    const maxY = GROUND_Y - 40;
    const y = Phaser.Math.Between(minY, maxY);
    const fr = this.add.image(x, y, 'fruit_' + def.name.toLowerCase()).setDepth(3).setDisplaySize(40, 40);
    fr._def = def;
    fr._baseY = y;
    fr._phase = Math.random() * Math.PI * 2;

    // Sparkle emitter around the fruit
    const sparkle = this.add.particles(x, y, 'star', {
      speed: { min: 20, max: 55 },
      scale: { start: 0.18, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: { min: 400, max: 700 },
      frequency: 80,
      quantity: 1,
      emitZone: { type: 'random', source: new Phaser.Geom.Circle(0, 0, 22) },
      tint: [ 0xffffff, 0xffff88, 0xffdd00, 0xff88ff, 0x88ffff ],
      blendMode: 'ADD',
      depth: 4
    });
    fr._sparkle = sparkle;
    this._fruits.add(fr);
  }

  // ----------------------------------------------------------
  //  Power activation
  // ----------------------------------------------------------
  _activatePower(powerName) {
    // Phase 1 blocks Flight — fall back to Lightfoot
    if (powerName === 'Flight' && this._phase < 2) {
      powerName = 'Lightfoot';
    }

    // If already in Flight, just reset the timer — don't pull pig back
    if (this._activePower === 'Flight' && powerName === 'Flight') {
      this._powerTimer = POWER_DURATION['Flight'];
      this._showExtendedHint();
      return;
    }

    // Power hierarchy: ignore if current power is stronger or equal
    if (this._activePower && this._activePower !== powerName) {
      const currentStr = POWER_STRENGTH[this._activePower] || 0;
      const newStr     = POWER_STRENGTH[powerName]         || 0;
      if (newStr > currentStr) {

        this._deactivatePower();
      } else {
        return; // new power is weaker or equal — ignore
      }
    }

    this._activePower = powerName;
    PigSFX.powerup();
    this._powerTimer  = POWER_DURATION[powerName];
    this._powersUsed.add(powerName);

    // Set power icon emoji
    const emojiMap = {
      Lightfoot: '✨', Flight: '🪽', OrangeSmash: '🍊💥',
      StrawberrySpeed: '🍓💨', PineappleShield: '🍍🛡️', Magnet: '🔮'
    };


    if (powerName === 'StrawberrySpeed') {
      this._scrollSpeed = PHASE_SPEEDS[this._phase - 1] * 2.0;
      this._scoreMultiplier = 3; // triple score during speed burst
    }
    if (powerName === 'OrangeSmash') {
      this._scrollSpeed = PHASE_SPEEDS[this._phase - 1] * 0.65; // slowed down
    }
    if (powerName === 'PineappleShield') {
      this._shieldHits = 1; // absorbs 1 hit then power ends
    }

    if (powerName === 'Flight') {
      this._flightVelY = 0;
    }

    // Show wings for any power

  }

  _deactivatePower() {
    if (this._activePower === 'StrawberrySpeed') {
      this._scrollSpeed = PHASE_SPEEDS[this._phase - 1];
      this._scoreMultiplier = 1;
    }
    if (this._activePower === 'OrangeSmash') {
      this._scrollSpeed = PHASE_SPEEDS[this._phase - 1];
    }
    if (this._activePower === 'PineappleShield') {
      this._shieldHits = 0;
    }
    if (this._activePower === 'Flight') {
      // Let pig fall naturally from wherever it is in the air
      this._onGround = false;
      this._velY = 0; // gravity takes over
      this._flightVelY = 0;
      this._jumpCount = 0;
    }
    
    this._activePower = null;
    this._powerTimer  = 0;
  }

  // ----------------------------------------------------------
  //  Phase management
  // ----------------------------------------------------------
  _updatePhase() {
    const score = this._score;
    let newPhase;
    if (score >= 2000) {
      newPhase = 3;
    } else if (score >= 1000) {
      newPhase = 2;
    } else {
      newPhase = 1;
    }

    if (newPhase !== this._phase) {
      this._phase = newPhase;
      this._maxJumps = newPhase >= 2 ? 2 : 1;
      // Update fruit spawn distance for new phase
      this._nextFruitDist = PHASE_FRUIT_DIST[this._phase - 1];
      // Update scroll speed (only when no speed-overriding power is active)
      if (!this._activePower || this._activePower !== 'Speed') {
        const flightActive = this._activePower === 'Flight';
        const base = PHASE_SPEEDS[this._phase - 1];
        this._scrollSpeed = flightActive ? base * 0.85 : base;
      }

    }
  }

  // Show a brief centred flash message
  _showFlash(msg, color) {
    const txt = this.add.text(W / 2, H / 2 - 60, msg, {
      fontFamily: 'Impact, Arial Black',
      fontSize: '64px',
      color: '#' + color.toString(16).padStart(6, '0'),
      stroke: '#000',
      strokeThickness: 6,
    }).setOrigin(0.5).setDepth(20);

    this.tweens.add({
      targets: txt,
      alpha: 0,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 900,
      ease: 'Sine.easeIn',
      onComplete: () => txt.destroy(),
    });
  }

  _showExtendedHint() {
    // Small "+EXTENDED" text that pops up right below the power bar
    const barY = 14;
    const txt = this.add.text(W / 2 + 160, barY + 8, '+EXTENDED', {
      fontFamily: 'Arial Black, Arial',
      fontSize: '13px',
      color: '#42a5f5',
      stroke: '#000',
      strokeThickness: 3,
    }).setOrigin(0.5, 0).setDepth(20);

    this.tweens.add({
      targets: txt,
      alpha: 0,
      y: barY - 10,
      duration: 1000,
      ease: 'Sine.easeIn',
      onComplete: () => txt.destroy(),
    });
  }

  // ----------------------------------------------------------
  //  Pig physics
  // ----------------------------------------------------------
  _updatePig(dt) {
    const dtSec = dt / 1000;
    const pig = this._pig;

    if (this._activePower === 'Flight') {
      // Flappy-bird vertical in middle band
      const bandTop = H * 0.2;
      const bandBot = H * 0.65;
      this._flightVelY += GRAVITY * 0.45 * dtSec;
      this._pigY += this._flightVelY * dtSec;
      this._pigY = Phaser.Math.Clamp(this._pigY, bandTop, bandBot);
      if (this._pigY >= bandBot) this._flightVelY = 0;
      if (this._pigY <= bandTop) this._flightVelY = 0;
      pig.y = this._pigY;
      // Use animated fly sheet
      if (!pig.anims.isPlaying || pig.anims.currentAnim?.key !== 'pig_fly') {
        pig.setTexture('pigfly_sheet', 0);
        pig.play('pig_fly', true);
        pig.setScale(PIG_FLY_SCALE);
        pig.setAlpha(1);
        pig.clearTint();
      }
      pig.y = this._pigY;
    } else {
      // Normal jump/fall
      if (!this._onGround) {
        
        this._velY += GRAVITY * dtSec;
        this._pigY += this._velY * dtSec;
      }
      if (this._pigY >= GROUND_Y) {
        const wasAirborne = !this._onGround;
        this._pigY = GROUND_Y;
        this._velY = 0;
        this._onGround = true;
        this._jumpCount = 0;
        if (wasAirborne) {
          pig.y = GROUND_Y;
          
        }
      }
      pig.y = this._pigY; // always sync
      if (pig.anims.currentAnim?.key !== 'pig_run') { pig.setTexture('pigrun_sheet', 0); }
      pig.play('pig_run', true); this._scalePig();
      // Sync leg animation speed to scroll speed so feet match ground
      const baseSpeed = PHASE_SPEEDS[0]; // 200px/s = base
      const syncedRate = Math.round(12 * (this._scrollSpeed / baseSpeed));
      if (pig.anims.currentAnim && !this._activePower || this._activePower !== 'PineappleShield') {
        pig.anims.msPerFrame = 1000 / Math.max(8, Math.min(syncedRate, 30));
      }
    }

    // Wings follow pig every update
    

    // Aura follows pig — hidden during Flight so it doesn't cover wings
    if (this._activePower !== 'Flight') {
      const pigW = pig.displayWidth;
      this._aura.setPosition(pig.x, pig.y - pig.displayHeight / 2);
      const auraSize = Math.max(pigW, pig.displayHeight) * 1.6;
      this._aura.setDisplaySize(auraSize, auraSize);
    } else {
      this._aura.setAlpha(0);
    }
  }

  // ----------------------------------------------------------
  //  Collision
  // ----------------------------------------------------------
  _checkCollisions() {
    const pig = this._pig;
    const px = pig.x;
    const py = pig.y;        // bottom of pig
    const pw = pig.displayWidth  * 0.6;
    const ph = pig.displayHeight * 0.8;
    const pigLeft   = px - pw / 2;
    const pigRight  = px + pw / 2;
    const pigTop    = py - ph;
    const pigBottom = py;

    // --- Obstacles ---
    this._obstacles.getChildren().forEach(obs => {
      if (!obs.active) return;
      const ox = obs.x;
      const oy = GROUND_Y;  // always use real ground for collision bottom
      const ow = obs._hitW;
      const oh = obs._hitH;
      const ol = ox;
      const or = ox + ow;
      const ot = oy - oh;
      const ob2 = oy;

      const hit = pigRight > ol && pigLeft < or && pigBottom > ot && pigTop < ob2;
      if (!hit) return;

      if (this._activePower === 'OrangeSmash' || this._activePower === 'StrawberrySpeed') {
        // Smash obstacle — destroy it
        this._explodeObstacle(obs);
      } else if (this._activePower === 'Flight') {
        // Immune during flight
      } else if (this._activePower === 'PineappleShield' && this._shieldHits > 0) {
        // Shield absorbs one hit then ends
        this._shieldHits--;
        this._explodeObstacle(obs);

        this._deactivatePower(); // power ends immediately after absorbing hit
      } else {
        // Death
        if (!this._deathTriggered) this._killPig();
      }
    });

    // --- Fruits ---
    const isMagnet = this._activePower === 'Magnet';
    this._fruits.getChildren().forEach(fr => {
      if (!fr.active) return;
      const dist = Phaser.Math.Distance.Between(px, py - ph/2, fr.x, fr.y);
      const collect = isMagnet ? (dist < this._magnetRadius) : (dist < 55);
      if (collect) {
        this._collectFruit(fr);
      }
    });
  }

  _explodeObstacle(obs) {
    this._obstacles.remove(obs, false, false);
    const cx = obs.x + obs._def.w / 2;
    const cy = obs.y - obs._def.h / 2;
    this._score += 50;

    // Debris particles
    const cols = [obs._def.color, 0xffffff, 0xaaaaaa];
    for (let i = 0; i < 18; i++) {
      const p = this.add.rectangle(
        cx + Phaser.Math.Between(-20, 20),
        cy + Phaser.Math.Between(-15, 15),
        Phaser.Math.Between(5, 14),
        Phaser.Math.Between(5, 14),
        Phaser.Utils.Array.GetRandom(cols)
      ).setDepth(8);
      const vx = Phaser.Math.Between(-180, 180);
      const vy = Phaser.Math.Between(-250, -50);
      this.tweens.add({
        targets: p,
        x: p.x + vx * 0.6,
        y: p.y + vy * 0.6 + 120,
        alpha: 0,
        angle: Phaser.Math.Between(-180, 180),
        duration: 600,
        onComplete: () => p.destroy()
      });
    }
    obs.destroy();
  }

  _collectFruit(fr) {
    // Remove from group immediately to prevent double-collection
    this._fruits.remove(fr, false, false);

    const def = fr._def;
    this._fruitCounts[def.name]++;
    PigSFX.collect();
    this._totalFruitsCollected++;
    this._score += 20;

    // Pop animation then destroy
    this.tweens.add({
      targets: fr,
      scaleX: 0, scaleY: 0, alpha: 0,
      duration: 180,
      onComplete: () => {
        if (fr._sparkle) fr._sparkle.destroy();
        fr.destroy();
      }
    });

    // If already in Flight, collecting 3 bananas resets the timer
    if (this._activePower === 'Flight' && fr._def.name === 'Banana') {
      if (this._fruitCounts['Banana'] >= 3) {
        this._powerTimer = POWER_DURATION['Flight'];
        this._fruitCounts['Banana'] = 0;
        this._showExtendedHint();
      }
      // fall through — still counts toward the 5-fruit power trigger
    }

    // Check super power trigger (every 5 fruits)
    if (this._totalFruitsCollected % 5 === 0) {
      // If 2 or more of the collected fruits are bananas → Flight
      if (this._fruitCounts['Banana'] >= 2) {
        this._activatePower('Flight');
      } else {
        const dominant = this._getDominantFruit();
        if (dominant) this._activatePower(dominant.power);
      }
      // Reset counts after power triggers
      FRUITS.forEach(f => { this._fruitCounts[f.name] = 0; });
    }
  }

  _getDominantFruit() {
    let best = null, bestCount = -1;
    // Only consider the last 5 collected — approximate by current max
    FRUITS.forEach(f => {
      if (this._fruitCounts[f.name] > bestCount) {
        bestCount = this._fruitCounts[f.name];
        best = f;
      }
    });
    return best;
  }

  // ----------------------------------------------------------
  //  Death
  // ----------------------------------------------------------
  _killPig() {
    this._deathTriggered = true;
    this._alive = false;
    PigSFX.squeal();
    PigSFX.crash();
    PigMusicPlayer.stop();

    const pig = this._pig;
    const px = pig.x, py = pig.y;
    const wasFlying = this._activePower === 'Flight';

    // 1. Flash white
    pig.setTint(0xffffff);
    this.time.delayedCall(80, () => pig.clearTint());


    // 3. "OINK!!" text pops up
    const oink = this.add.text(px, py - 90, 'OINK!!', {
      fontFamily: 'Impact', fontSize: '52px',
      color: '#ff1744', stroke: '#000', strokeThickness: 5
    }).setOrigin(0.5).setDepth(20).setScale(0);
    this.tweens.add({
      targets: oink,
      scaleX: 1.3, scaleY: 1.3, duration: 200, ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({ targets: oink, alpha: 0, y: py - 150, duration: 500, delay: 300, onComplete: () => oink.destroy() });
      }
    });

    if (wasFlying) {
      // Flying death — pig tumbles and plummets straight down from the sky
      this.tweens.add({
        targets: pig,
        angle: pig.angle + 540,
        y: GROUND_Y + 80,
        duration: 900,
        ease: 'Sine.easeIn',
        onComplete: () => {
          this.cameras.main.shake(200, 0.02);
          this.tweens.add({ targets: pig, alpha: 0, duration: 300 });
        }
      });
    } else {
      // Ground death — spin bounce then fall off screen
      this.tweens.add({
        targets: pig,
        angle: 900,
        y: py - 120,
        scaleX: 1.3, scaleY: 1.3,
        duration: 500,
        ease: 'Back.easeOut',
        onComplete: () => {
          this.tweens.add({
            targets: pig,
            y: py + 300,
            angle: 1440,
            alpha: 0,
            scaleX: 0.3, scaleY: 0.3,
            duration: 600,
            ease: 'Sine.easeIn',
          });
        }
      });
    }

    // Screen shake
    this.cameras.main.shake(300, 0.015);

    // Save high score & transition
    const final = Math.floor(this._score);
    const top5 = Leaderboard.add(final);
    const prev = top5[0] || 0;
    // Refresh top-left leaderboard display
    if (this._lbTexts) {
      const medals = ['🥇','🥈'];
      for (let i = 0; i < 2; i++) {
        const s = top5[i] || 0;
        if (this._lbTexts[i]) this._lbTexts[i].setText(medals[i] + ' ' + (s > 0 ? s.toLocaleString() : '---'));
      }
    }

    this.time.delayedCall(1400, () => {
      this.scene.start('GameOver', {
        score: final,
        highScore: Math.max(final, prev),
        powersUsed: [...this._powersUsed]
      });
    });
  }

  // ----------------------------------------------------------
  //  update loop
  // ----------------------------------------------------------
  update(time, delta) {
    if (!this._alive) {
      // Scroll slows after death
      this._scrollSpeed = Math.max(0, this._scrollSpeed - 300 * (delta / 1000));
      this._scrollBg(delta);
      return;
    }

    const dt = delta;
    const dtSec = dt / 1000;

    // ---- Phase update ----
    this._updatePhase();

    // ---- Power timer ----
    if (this._activePower) {
      // PineappleShield ends on hit, not timer — skip countdown
      if (this._activePower !== 'PineappleShield') {
        this._powerTimer -= dt;
        if (this._powerTimer <= 0) this._deactivatePower();
      }
    }

    // ---- Scroll background ----
    this._scrollBg(dt);

    // ---- Pig physics ----
    this._updatePig(dt);

    // ---- Distance & score ----
    this._distance += this._scrollSpeed * dtSec;
    this._score    += this._scrollSpeed * dtSec * 0.05 * this._scoreMultiplier;

    // ---- Spawn obstacles ----
    this._distSinceLastObs += this._scrollSpeed * dtSec;
    if (this._distSinceLastObs >= this._nextObsDist) {
      this._spawnObstacle();
      this._distSinceLastObs = 0;
      this._nextObsDist = Phaser.Math.Between(350, 700);
    }

    // ---- Spawn fruits ----
    this._distSinceLastFruit += this._scrollSpeed * dtSec;
    if (this._distSinceLastFruit >= this._nextFruitDist) {
      // Phase 1: clusters of 2-3; Phase 2: 1-2; Phase 3: 1
      const count = this._phase === 1
        ? Phaser.Math.Between(2, 3)
        : this._phase === 2
          ? Phaser.Math.Between(1, 2)
          : 1;
      for (let i = 0; i < count; i++) this._spawnFruit();
      this._distSinceLastFruit = 0;
      this._nextFruitDist = PHASE_FRUIT_DIST[this._phase - 1];
    }

    // ---- Move obstacles ----
    this._obstacles.getChildren().forEach(obs => {
      obs.x -= this._scrollSpeed * dtSec;
      if (obs.x < -200) obs.destroy();
    });

    // ---- Crows (appear from 1000pts, increase with score) ----
    if (this._score >= 1000) {
      this._crowDistSince += this._scrollSpeed * dtSec;
      // Spawn gap shrinks as score rises: 1000pts=800-1400, 2000pts=500-900, 3000pts+=300-600
      const minDist = Math.max(300, 800 - Math.floor((this._score - 1000) / 500) * 100);
      const maxDist = Math.max(600, 1400 - Math.floor((this._score - 1000) / 500) * 200);
      if (this._crowDistSince >= this._nextCrowDist) {
        this._crowDistSince = 0;
        this._nextCrowDist = Phaser.Math.Between(minDist, maxDist);
        // Spawn 1 crow normally, 2 crows at phase 3+
        const count = this._phase >= 3 ? (Math.random() < 0.4 ? 2 : 1) : 1;
        for (let c = 0; c < count; c++) {
          const crowY = Phaser.Math.Between(H * 0.05, H * 0.55);
          const crow = this.add.sprite(W + 80 + c * 120, crowY, 'crow_f0').setOrigin(0.5).setDepth(3).setDisplaySize(180, 108);
          crow.play('crow_fly');
          this._crows.add(crow);
        }
      }
    }
    this._crows.getChildren().forEach(crow => {
      crow.x -= 120 * dtSec; // slow fixed speed
      if (crow.x < -150) { crow.destroy(); return; }
      // Collision — pig always dies, no immunity
      if (!this._alive || this._deathTriggered) return;
      const pig = this._pig;
      const dx = Math.abs(pig.x - crow.x);
      const dy = Math.abs((pig.y - pig.displayHeight / 2) - crow.y);
      if (dx < 50 && dy < 30 && this._activePower === 'Flight') {
        if (!this._deathTriggered) this._killPig();
      }
    });



    // ---- Move fruits (bob + scroll) ----
    const t = time / 1000;
    this._fruits.getChildren().forEach(fr => {
      fr.x -= this._scrollSpeed * dtSec;
      fr.y = fr._baseY + Math.sin(t * 2 + fr._phase) * 8;
      if (fr._sparkle) fr._sparkle.setPosition(fr.x, fr.y);
      if (fr.x < -60) {
        if (fr._sparkle) fr._sparkle.destroy();
        fr.destroy();
      }
    });

    // ---- Magnet pull ----
    if (this._activePower === 'Magnet') {
      const px = this._pig.x;
      const py = this._pig.y - this._pig.displayHeight / 2;
      this._fruits.getChildren().forEach(fr => {
        const dist = Phaser.Math.Distance.Between(px, py, fr.x, fr.y);
        if (dist < this._magnetRadius) {
          const angle = Math.atan2(py - fr.y, px - fr.x);
          fr.x += Math.cos(angle) * 5;
          fr.y += Math.sin(angle) * 5;
        }
      });
    }

    // ---- Collisions ----
    this._checkCollisions();

    // ---- HUD ----
    this._updateHUD();

    // ---- Set scroll speed from phase (when Speed Burst is not active) ----
    if (this._activePower !== 'StrawberrySpeed' && this._activePower !== 'OrangeSmash') {
      const base = PHASE_SPEEDS[this._phase - 1];
      this._scrollSpeed = this._activePower === 'Flight' ? base * 0.85 : base;
    }
  }

  _scrollBg(dt) {
    const dtSec = dt / 1000;
    this._cloudLayer.tilePositionX += this._scrollSpeed * 0.15 * dtSec;
    this._hillLayer.tilePositionX  += this._scrollSpeed * 0.45 * dtSec;
    this._groundLayer.tilePositionX+= this._scrollSpeed * dtSec;
  }
}

// ============================================================
//  GameOverScene
// ============================================================
class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOver'); }

  init(data) {
    this._score      = data.score      || 0;
    this._highScore  = data.highScore  || 0;
    this._powersUsed = data.powersUsed || [];
  }

  create() {
    this.add.image(W/2, H/2, 'sky');
    this.add.tileSprite(W/2, H - 200, W, 160, 'hills').setOrigin(0.5, 1);
    this.add.tileSprite(W/2, H, W, 100, 'ground').setOrigin(0.5, 1);

    const isNew = this._score >= this._highScore && this._score > 0;

    // Funny messages based on score
    const msgs = this._score < 200
      ? [
          'Oink! Try again! 🐷',
          'The fence won... 🚜',
          'Even bacon gives up sometimes!',
          'Did you even try? 😅',
          'The haystack is laughing at you 🌾',
          'That pig needs more practice! 🐽',
          'Shortest flight ever recorded 🪽',
          'The tractor sends its regards 🚜',
          'Oink oink... splat! 💥',
          'This pig needs wings! 🪽',
        ]
      : this._score < 600
      ? [
          'Not bad, little piggy! 🐷',
          'You almost flew! 🪽',
          'The tractor disagrees! 🚜',
          'More ham needed for fuel! 🍖',
          'Getting warmer, piggy! 🔥',
          'That snout has potential! 🐽',
          'Oink with confidence next time! 💪',
          'The bushes are impressed 🌿',
          'A valiant effort, Sir Oinks-a-Lot! 🎖️',
          'Almost airborne... almost! ✈️',
        ]
      : this._score < 1200
      ? [
          'Impressive snout! 🐽',
          'Flying pig spotted! 🪽',
          'Oink oink, respect! 🐷',
          'This pig means business! 💼',
          'Certified flying bacon! 🥓🪽',
          'The tractor fears you now! 🚜😱',
          'Sir Oinksalot strikes again! 🎖️',
          'That\'s one talented pig! 🌟',
          'Newton was wrong — pigs DO fly! 🪽',
          'Absolute unit of a pig! 💪🐷',
        ]
      : [
          'YOU ARE THE HAM CHAMPION! 🏆',
          'UNSTOPPABLE BACON! 🐷💨',
          'CALL NASA — PIG IN ORBIT! 🚀🐷',
          'FARMERS HATE THIS ONE WEIRD TRICK! 😂',
          'OINK OINK MOTHERCLUCKERS! 💥🐷',
          'THIS PIG DEFIES ALL LAWS OF PHYSICS! 🌍',
          'BACON LEVEL: MAXIMUM! 🥓🔥',
        ];

    // If new record, always show one of the special messages
    const newRecordMsgs = [
      'LEGENDARY FLYING PIG! 🪽🔥',
      'THE GREATEST PIG WHO EVER LIVED! 👑',
      'KNEEL BEFORE THE FLYING SWINE! 🐷👑',
    ];
    const msg = isNew
      ? newRecordMsgs[Math.floor(Math.random() * newRecordMsgs.length)]
      : msgs[Math.floor(Math.random() * msgs.length)];

    // Game over panel — darker blue than sky
    this.add.rectangle(W/2, H/2 - 20, 724, 484, 0x2a6080, 0.6).setOrigin(0.5);
    const panel = this.add.rectangle(W/2, H/2 - 20, 716, 476, 0x2a6080, 0.88).setOrigin(0.5);

    // GAME OVER — drop in from top
    const title = this.add.text(W/2, -80, 'GAME OVER', {
      fontFamily: 'Impact, Arial Black', fontSize: '90px',
      color: '#ff1744', stroke: '#000', strokeThickness: 8,
      shadow: { offsetX: 4, offsetY: 4, color: '#880000', blur: 0, fill: true }
    }).setOrigin(0.5);
    this.tweens.add({ targets: title, y: 145, duration: 500, ease: 'Bounce.easeOut' });

    // Funny message — fade in
    const funTxt = this.add.text(W/2, 210, msg, {
      fontFamily: 'Arial Black', fontSize: '24px',
      color: '#ffeb3b', stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: funTxt, alpha: 1, duration: 400, delay: 400 });

    // Score — count up animation
    const scoreTxt = this.add.text(W/2, 275, 'Score: 0', {
      fontFamily: 'Arial Black', fontSize: '48px',
      color: '#ffffff', stroke: '#000', strokeThickness: 5
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: scoreTxt, alpha: 1, duration: 300, delay: 500 });
    // Count up
    let displayed = 0;
    const target = this._score;
    this.time.addEvent({
      delay: 20, repeat: 40, startAt: 500,
      callback: () => {
        displayed = Math.min(displayed + Math.ceil(target / 40), target);
        scoreTxt.setText('Score: ' + displayed.toLocaleString());
      }
    });



    // Best score
    const hsColor = isNew ? '#ffd700' : '#ffe082';
    const hsTxt = this.add.text(W/2, 335, `🏆 Best: ${this._highScore.toLocaleString()}${isNew ? '  🆕 NEW RECORD!' : ''}`, {
      fontFamily: 'Arial Black', fontSize: '26px',
      color: hsColor, stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: hsTxt, alpha: 1, duration: 400, delay: 700 });

    // NEW RECORD burst
    if (isNew) {
      const burst = this.add.text(W/2, 370, '🎉 NEW RECORD! 🎉', {
        fontFamily: 'Impact', fontSize: '36px',
        color: '#ffd700', stroke: '#ff0000', strokeThickness: 4
      }).setOrigin(0.5).setScale(0);
      this.tweens.add({ targets: burst, scaleX: 1.2, scaleY: 1.2, duration: 400, delay: 900, ease: 'Back.easeOut', yoyo: true, repeat: -1 });
    }

    // Confetti particles
    const confettiColors = [0xff1744, 0xffd740, 0x00e676, 0x40c4ff, 0xf50057, 0x69f0ae];
    confettiColors.forEach(color => {
      this.add.particles(Phaser.Math.Between(0, W), -10, 'star', {
        speed: { min: 100, max: 300 },
        angle: { min: 60, max: 120 },
        scale: { start: 0.15, end: 0 },
        lifespan: { min: 1500, max: 3000 },
        frequency: 200,
        quantity: 1,
        tint: color,
        gravityY: 200,
        depth: 5
      });
    });

    // Play Again button
    const playMsgs = [
      '🐷  PLAY AGAIN  🐷',
      '🪽  FLY AGAIN!  🪽',
      '🔥  ONE MORE GO!  🔥',
      '💪  TRY HARDER!  💪',
      '🚀  LAUNCH THE PIG!  🚀',
      '🥓  RETRY BACON!  🥓',
      '👑  CLAIM THE CROWN!  👑',
      '😤  I CAN DO BETTER!  😤',
      '🐽  OINK AGAIN!  🐽',
      '⚡  FASTER PIG!  ⚡',
    ];
    const playMsg = playMsgs[Math.floor(Math.random() * playMsgs.length)];
    const btn = this.add.text(W/2, 470, playMsg, {
      fontFamily: 'Impact, Arial Black', fontSize: '42px',
      color: '#fff', backgroundColor: '#e53935',
      padding: { x: 30, y: 14 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setScale(0);

    btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#c62828' }));
    btn.on('pointerout',  () => btn.setStyle({ backgroundColor: '#e53935' }));
    btn.on('pointerdown', () => { PigMusicPlayer.start(); this.scene.start('Game'); });
    this.input.keyboard.once('keydown-SPACE', () => { PigMusicPlayer.start(); this.scene.start('Game'); });

    this.tweens.add({ targets: btn, scaleX: 1, scaleY: 1, duration: 400, delay: 600, ease: 'Back.easeOut' });
    // Pulse button
    this.time.delayedCall(1100, () => {
      this.tweens.add({ targets: btn, scaleX: 1.05, scaleY: 1.05, duration: 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
  }
}



// ============================================================
//  MUSIC — Original: Mario bounce + Tetris drive
// ============================================================
const PigMusicPlayer = (() => {
  let ctx = null, playing = false, nextTime = 0, timeout = null;

  const BPM = 150;
  const q  = 60 / BPM;
  const h  = q * 2;
  const e  = q / 2;
  const de = q * 0.75;
  const s  = q / 4;

  // Original melody blending Mario bounce with Tetris stepwise motion
  const melody = [
    // Phrase 1 — Mario bounce feel, short notes
    [523.25,e],[659.25,e],[783.99,e],[1046.50,e],
    [783.99,e],[659.25,e],[523.25,q],[0,q],
    [587.33,e],[739.99,e],[880.00,e],[1108.73,e],
    [880.00,e],[739.99,e],[587.33,q],[0,q],

    // Phrase 2 — Tetris stepwise descent
    [1046.50,de],[880.00,e],[783.99,q],[659.25,q],
    [783.99,de],[659.25,e],[523.25,q],[440.00,q],
    [523.25,de],[587.33,e],[659.25,q],[783.99,q],
    [880.00,h],[659.25,h],

    // Phrase 3 — Mario bounce variation
    [659.25,e],[523.25,e],[440.00,e],[523.25,e],
    [659.25,e],[783.99,e],[880.00,q],[0,q],
    [783.99,e],[659.25,e],[587.33,e],[659.25,e],
    [783.99,e],[880.00,e],[1046.50,q],[0,q],

    // Phrase 4 — Tetris resolution
    [1046.50,de],[880.00,e],[783.99,q],[659.25,q],
    [523.25,de],[587.33,e],[659.25,q],[523.25,q],
    [440.00,q],[523.25,q],[587.33,q],[659.25,q],
    [523.25,h],[523.25,h],
  ];

  // Bass — bouncy Mario oom-pah style
  const bass = [
    [130.81,e],[261.63,e],[130.81,e],[261.63,e],
    [130.81,e],[261.63,e],[130.81,q],[0,q],
    [146.83,e],[293.66,e],[146.83,e],[293.66,e],
    [146.83,e],[293.66,e],[146.83,q],[0,q],

    [261.63,q],[196.00,q],[164.81,q],[130.81,q],
    [196.00,q],[261.63,q],[130.81,q],[164.81,q],
    [130.81,q],[146.83,q],[164.81,q],[196.00,q],
    [220.00,h],[164.81,h],

    [164.81,e],[130.81,e],[110.00,e],[130.81,e],
    [164.81,e],[196.00,e],[220.00,q],[0,q],
    [196.00,e],[164.81,e],[146.83,e],[164.81,e],
    [196.00,e],[220.00,e],[261.63,q],[0,q],

    [261.63,q],[196.00,q],[164.81,q],[130.81,q],
    [130.81,q],[146.83,q],[164.81,q],[130.81,q],
    [110.00,q],[130.81,q],[146.83,q],[164.81,q],
    [130.81,h],[130.81,h],
  ];

  // Harmony — adds Mario chord richness
  const harmony = [
    [329.63,h],[392.00,h],[349.23,h],[440.00,h],
    [523.25,h],[392.00,h],[349.23,h],[329.63,h],
    [329.63,h],[392.00,h],[349.23,h],[440.00,h],
    [523.25,h],[392.00,h],[329.63,h],[261.63,h],
  ];

  function note(freq, start, dur, gain, type) {
    if (!freq || freq === 0) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.001, start);
    g.gain.linearRampToValueAtTime(gain, start + 0.015);
    g.gain.setValueAtTime(gain, start + dur * 0.7);
    g.gain.linearRampToValueAtTime(0.001, start + dur * 0.95);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(start); osc.stop(start + dur);
  }

  function scheduleLoop() {
    if (!playing) return;
    const start = nextTime;
    let t = start, loopLen = 0;

    // Melody — square wave like old Mario/Tetris
    t = start;
    for (const [f, d] of melody) { note(f, t, d*0.85, 0.07, "square"); t += d; }
    loopLen = t - start;

    // Bass — triangle for warmth
    t = start;
    for (const [f, d] of bass) { note(f, t, d*0.6, 0.06, "triangle"); t += d; }

    // Harmony — sine for smoothness
    t = start;
    for (const [f, d] of harmony) { note(f, t, d*0.8, 0.04, "sine"); t += d; }

    nextTime = start + loopLen;
    timeout = setTimeout(scheduleLoop, (loopLen - 0.15) * 1000);
  }

  return {
    start() {
      if (playing) return;
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === "suspended") ctx.resume();
        playing = true;
        nextTime = ctx.currentTime + 0.1;
        scheduleLoop();
      } catch(e) { console.warn("Audio:", e); }
    },
    stop() {
      playing = false;
      if (timeout) clearTimeout(timeout);
      if (ctx) { try { ctx.close(); } catch(e){} ctx = null; }
    }
  };
})();

// ============================================================
//  SOUND EFFECTS
// ============================================================
const PigSFX = {
  _ctx() {
    if (!this._audioCtx) {
      try { this._audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){}
    }
    if (this._audioCtx && this._audioCtx.state === 'suspended') this._audioCtx.resume();
    return this._audioCtx;
  },
  _audioCtx: null,

  jump() {
    const ctx = this._ctx(); if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.12);
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.15);
  },

  crash() {
    const ctx = this._ctx(); if (!ctx) return;
    // Noise burst
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.3, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    // Low pass for crunch
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    src.connect(filter); filter.connect(g); g.connect(ctx.destination);
    src.start(); src.stop(ctx.currentTime + 0.4);

    // Low thud
    const osc = ctx.createOscillator();
    const g2 = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.3);
    g2.gain.setValueAtTime(0.4, ctx.currentTime);
    g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.connect(g2); g2.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.3);
  },

  squeal() {
    const ctx = this._ctx(); if (!ctx) return;
    const t = ctx.currentTime;

    // Main squeal tone — sawtooth for nasal piggy quality
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(900, t);
    osc.frequency.linearRampToValueAtTime(1600, t + 0.15);
    osc.frequency.linearRampToValueAtTime(1200, t + 0.35);
    osc.frequency.linearRampToValueAtTime(1800, t + 0.5);
    osc.frequency.linearRampToValueAtTime(800, t + 0.7);

    // Vibrato LFO
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 18;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 60;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    // Bandpass filter to make it more nasal/piggy
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1400;
    filter.Q.value = 2;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.3, t + 0.05);
    g.gain.setValueAtTime(0.3, t + 0.5);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.75);

    osc.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);

    lfo.start(t); lfo.stop(t + 0.75);
    osc.start(t); osc.stop(t + 0.75);
  },

  collect() {
    const ctx = this._ctx(); if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.1);
    g.gain.setValueAtTime(0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.15);
  },

  powerup() {
    const ctx = this._ctx(); if (!ctx) return;
    const freqs = [523, 659, 784, 1047];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = f;
      const t = ctx.currentTime + i * 0.08;
      g.gain.setValueAtTime(0.1, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(t); osc.stop(t + 0.12);
    });
  }
};

// ============================================================
//  LEADERBOARD — Top 5 scores
// ============================================================
const Leaderboard = {
  KEY: 'pigScores',
  get() {
    try { return JSON.parse(localStorage.getItem(this.KEY) || '[]'); } catch(e) { return []; }
  },
  add(score) {
    const scores = this.get();
    scores.push(score);
    scores.sort((a,b) => b - a);
    const top5 = scores.slice(0, 5);
    localStorage.setItem(this.KEY, JSON.stringify(top5));
    return top5;
  },
  top() { return this.get().slice(0, 5); }
};

// ============================================================
//  Phaser config & launch
// ============================================================
const config = {
  type: Phaser.AUTO,
  width: W,
  height: H,
  backgroundColor: '#87ceeb',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [BootScene, StartScene, GameScene, GameOverScene],
  physics: { default: 'arcade' },
};

new Phaser.Game(config);
