// Cyber T-Rex Runner - Complete Arcade Game Engine

// Web Audio API Synthesizer (Zero external dependencies, instant sound effects)
class SoundFx {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
  }

  playJump() {
    if (!this.enabled || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      const now = this.ctx.currentTime;
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.12);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } catch (e) {}
  }

  playScoreMilestone() {
    if (!this.enabled || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.12, now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.09);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.09);
      });
    } catch (e) {}
  }

  playCrash() {
    if (!this.enabled || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.linearRampToValueAtTime(40, now + 0.35);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {}
  }
}

// Particle System for jump dust & death explosion
class Particle {
  constructor(x, y, color, vx, vy, size, life) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.vx = vx;
    this.vy = vy;
    this.size = size;
    this.life = life;
    this.maxLife = life;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life--;
  }

  draw(ctx) {
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.size, this.size);
    ctx.restore();
  }
}

// Main Game Controller
class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.sound = new SoundFx();

    // DOM UI
    this.currentScoreEl = document.getElementById('current-score');
    this.highScoreEl = document.getElementById('high-score');
    this.speedEl = document.getElementById('speed-indicator');
    this.overlay = document.getElementById('game-overlay');
    this.overlayTitle = document.getElementById('overlay-title');
    this.overlaySubtitle = document.getElementById('overlay-subtitle');
    this.startBtn = document.getElementById('start-btn');
    this.soundToggle = document.getElementById('audio-toggle');
    this.soundState = document.getElementById('sound-state');

    // Canvas settings
    this.W = this.canvas.width; // 900
    this.H = this.canvas.height; // 320
    this.groundY = 260;

    // High score from storage
    this.highScore = parseInt(localStorage.getItem('cyber_dino_hi') || '0', 10);
    this.highScoreEl.textContent = String(this.highScore).padStart(5, '0');

    // Game states
    this.state = 'START'; // 'START', 'PLAYING', 'GAMEOVER'
    this.score = 0;
    this.speed = 7.5;
    this.baseSpeed = 7.5;
    this.distance = 0;
    this.lastMilestone = 0;

    // Entities & Environmental state
    this.dino = {
      x: 70,
      y: this.groundY - 54,
      width: 44,
      height: 52,
      vy: 0,
      gravity: 0.72,
      jumpForce: -13.5,
      isGrounded: true,
      isDucking: false,
      legFrame: 0,
      animCounter: 0
    };

    this.obstacles = [];
    this.clouds = [];
    this.groundPoints = [];
    this.particles = [];
    this.spawnTimer = 0;

    this.initGround();
    this.initClouds();
    this.setupListeners();

    // Start loop
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  setupListeners() {
    const handleActionDown = (e) => {
      this.sound.init();
      if (this.state !== 'PLAYING') {
        if (e.code === 'Space' || e.code === 'ArrowUp' || e.type === 'click') {
          this.startGame();
          e.preventDefault();
        }
        return;
      }

      if (e.code === 'Space' || e.code === 'ArrowUp' || e.key === ' ') {
        this.jump();
        e.preventDefault();
      } else if (e.code === 'ArrowDown') {
        this.duck(true);
        e.preventDefault();
      }
    };

    const handleActionUp = (e) => {
      if (e.code === 'ArrowDown') {
        this.duck(false);
      }
    };

    window.addEventListener('keydown', handleActionDown);
    window.addEventListener('keyup', handleActionUp);

    this.startBtn.addEventListener('click', (e) => {
      this.sound.init();
      this.startGame();
    });

    // Sound toggle
    this.soundToggle.addEventListener('click', () => {
      this.sound.enabled = !this.sound.enabled;
      this.soundState.textContent = this.sound.enabled ? 'ON' : 'OFF';
    });

    // Touch support buttons
    const btnJump = document.getElementById('btn-jump');
    const btnDuck = document.getElementById('btn-duck');

    if (btnJump && btnDuck) {
      btnJump.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.sound.init();
        if (this.state !== 'PLAYING') this.startGame();
        else this.jump();
      });

      btnDuck.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (this.state === 'PLAYING') this.duck(true);
      });

      btnDuck.addEventListener('touchend', (e) => {
        e.preventDefault();
        this.duck(false);
      });
    }

    // Direct canvas tap to jump
    this.canvas.addEventListener('pointerdown', (e) => {
      this.sound.init();
      if (this.state !== 'PLAYING') this.startGame();
      else this.jump();
    });
  }

  initGround() {
    this.groundPoints = [];
    for (let x = 0; x <= this.W + 40; x += 30) {
      this.groundPoints.push({
        x: x,
        bump: (Math.random() - 0.5) * 4,
        speck: Math.random() > 0.6
      });
    }
  }

  initClouds() {
    this.clouds = [
      { x: 180, y: 55, speed: 0.6, width: 60 },
      { x: 490, y: 80, speed: 0.4, width: 75 },
      { x: 780, y: 45, speed: 0.7, width: 50 }
    ];
  }

  startGame() {
    this.score = 0;
    this.speed = this.baseSpeed;
    this.distance = 0;
    this.lastMilestone = 0;
    this.obstacles = [];
    this.particles = [];
    this.spawnTimer = 60;

    this.dino.y = this.groundY - 54;
    this.dino.vy = 0;
    this.dino.isGrounded = true;
    this.dino.isDucking = false;

    this.state = 'PLAYING';
    this.overlay.classList.add('hidden');
    this.speedEl.textContent = '1.0x';
  }

  gameOver() {
    this.state = 'GAMEOVER';
    this.sound.playCrash();

    // Create explosion particles
    for (let i = 0; i < 28; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6 + 2;
      this.particles.push(new Particle(
        this.dino.x + this.dino.width / 2,
        this.dino.y + this.dino.height / 2,
        Math.random() > 0.5 ? '#00f2fe' : '#ff2a85',
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        Math.random() * 4 + 3,
        40
      ));
    }

    // Check High Score
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('cyber_dino_hi', this.highScore.toString());
      this.highScoreEl.textContent = String(this.highScore).padStart(5, '0');
    }

    this.overlayTitle.textContent = 'GAME OVER';
    this.overlaySubtitle.textContent = `Score: ${this.score} • High Score: ${this.highScore}`;
    this.startBtn.textContent = 'RETRY';
    this.overlay.classList.remove('hidden');
  }

  jump() {
    if (this.dino.isGrounded) {
      this.dino.vy = this.dino.jumpForce;
      this.dino.isGrounded = false;
      this.sound.playJump();

      // Jump dust particles
      for (let i = 0; i < 6; i++) {
        this.particles.push(new Particle(
          this.dino.x + 8 + Math.random() * 16,
          this.groundY - 2,
          '#00f2fe',
          (Math.random() - 0.5) * 3 - 2,
          -Math.random() * 2,
          3,
          18
        ));
      }
    }
  }

  duck(isDucking) {
    if (this.dino.isDucking === isDucking) return;
    this.dino.isDucking = isDucking;
    if (isDucking) {
      this.dino.height = 32;
      if (!this.dino.isGrounded) {
        this.dino.vy += 6; // Quick fall
      }
    } else {
      this.dino.height = 52;
    }
  }

  spawnObstacle() {
    const isBird = this.score > 250 && Math.random() < 0.32;

    if (isBird) {
      // Pterodactyl at low, mid, or high altitude
      const heights = [this.groundY - 35, this.groundY - 60, this.groundY - 85];
      const y = heights[Math.floor(Math.random() * heights.length)];
      this.obstacles.push({
        type: 'bird',
        x: this.W + 20,
        y: y,
        width: 44,
        height: 32,
        wingFrame: 0,
        animCounter: 0
      });
    } else {
      // Cactus: single, double, or giant
      const rand = Math.random();
      let width, height;
      if (rand < 0.45) {
        width = 24;
        height = 46;
      } else if (rand < 0.8) {
        width = 46;
        height = 48;
      } else {
        width = 62;
        height = 54;
      }

      this.obstacles.push({
        type: 'cactus',
        x: this.W + 20,
        y: this.groundY - height,
        width: width,
        height: height
      });
    }
  }

  update(delta) {
    if (this.state === 'PLAYING') {
      // Progression & Speed scale
      this.distance++;
      if (this.distance % 5 === 0) {
        this.score++;
        this.currentScoreEl.textContent = String(this.score).padStart(5, '0');

        // Milestone beep every 100 points
        if (this.score > 0 && this.score % 100 === 0 && this.score !== this.lastMilestone) {
          this.lastMilestone = this.score;
          this.sound.playScoreMilestone();
        }
      }

      // Speed gradual acceleration up to cap
      this.speed = Math.min(17.5, this.baseSpeed + Math.floor(this.score / 100) * 0.7);
      this.speedEl.textContent = (this.speed / this.baseSpeed).toFixed(1) + 'x';

      // Dino physics
      this.dino.vy += this.dino.gravity;
      this.dino.y += this.dino.vy;

      const targetGround = this.groundY - this.dino.height;
      if (this.dino.y >= targetGround) {
        this.dino.y = targetGround;
        this.dino.vy = 0;
        this.dino.isGrounded = true;
      }

      // Dino animation frames
      this.dino.animCounter++;
      if (this.dino.animCounter % 6 === 0) {
        this.dino.legFrame = (this.dino.legFrame + 1) % 2;
      }

      // Spawning obstacles
      this.spawnTimer--;
      if (this.spawnTimer <= 0) {
        this.spawnObstacle();
        // Dynamic interval inversely proportional to speed
        const minGap = Math.max(45, 95 - Math.floor(this.speed * 2));
        const maxGap = minGap + 65;
        this.spawnTimer = Math.floor(Math.random() * (maxGap - minGap) + minGap);
      }

      // Obstacles update & collision
      for (let i = this.obstacles.length - 1; i >= 0; i--) {
        const obs = this.obstacles[i];
        obs.x -= this.speed;

        if (obs.type === 'bird') {
          obs.animCounter++;
          if (obs.animCounter % 8 === 0) {
            obs.wingFrame = (obs.wingFrame + 1) % 2;
          }
        }

        // Collision detection (with tight forgiving hitbox padding)
        const hitBoxPadX = 8;
        const hitBoxPadY = 6;
        if (
          this.dino.x + hitBoxPadX < obs.x + obs.width - hitBoxPadX &&
          this.dino.x + this.dino.width - hitBoxPadX > obs.x + hitBoxPadX &&
          this.dino.y + hitBoxPadY < obs.y + obs.height - hitBoxPadY &&
          this.dino.y + this.dino.height - hitBoxPadY > obs.y + hitBoxPadY
        ) {
          this.gameOver();
          break;
        }

        // Remove offscreen
        if (obs.x + obs.width < -30) {
          this.obstacles.splice(i, 1);
        }
      }

      // Ground animation
      for (let i = 0; i < this.groundPoints.length; i++) {
        this.groundPoints[i].x -= this.speed;
      }
      if (this.groundPoints.length > 0 && this.groundPoints[0].x < -40) {
        const first = this.groundPoints.shift();
        const last = this.groundPoints[this.groundPoints.length - 1];
        first.x = last.x + 30;
        this.groundPoints.push(first);
      }
    }

    // Clouds update
    for (let c of this.clouds) {
      c.x -= c.speed * (this.state === 'PLAYING' ? 1.5 : 0.8);
      if (c.x < -100) {
        c.x = this.W + Math.random() * 80;
        c.y = 35 + Math.random() * 70;
      }
    }

    // Particles update
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update();
      if (this.particles[i].life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  draw() {
    this.ctx.clearRect(0, 0, this.W, this.H);

    // Sky subtle backdrop gradient
    const grad = this.ctx.createLinearGradient(0, 0, 0, this.H);
    grad.addColorStop(0, '#0c1221');
    grad.addColorStop(1, '#111827');
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, this.W, this.H);

    // Grid horizon lines for synthwave depth
    this.ctx.strokeStyle = 'rgba(0, 242, 254, 0.05)';
    this.ctx.lineWidth = 1;
    for (let y = 140; y < this.groundY; y += 28) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.W, y);
      this.ctx.stroke();
    }

    // Draw Clouds
    this.drawClouds();

    // Draw Ground
    this.drawGround();

    // Draw Obstacles
    this.drawObstacles();

    // Draw Dino
    this.drawDino();

    // Draw Particles
    for (let p of this.particles) {
      p.draw(this.ctx);
    }
  }

  drawClouds() {
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    for (let c of this.clouds) {
      this.ctx.beginPath();
      this.ctx.roundRect(c.x, c.y, c.width, 18, 9);
      this.ctx.roundRect(c.x + 12, c.y - 8, c.width * 0.6, 16, 8);
      this.ctx.fill();
    }
  }

  drawGround() {
    // Glowing neon ground line
    this.ctx.strokeStyle = '#00f2fe';
    this.ctx.lineWidth = 2.5;
    this.ctx.shadowColor = '#00f2fe';
    this.ctx.shadowBlur = 8;
    this.ctx.beginPath();
    this.ctx.moveTo(0, this.groundY);
    this.ctx.lineTo(this.W, this.groundY);
    this.ctx.stroke();

    // Ground details / bumps
    this.ctx.shadowBlur = 0;
    this.ctx.fillStyle = '#1e293b';
    for (let pt of this.groundPoints) {
      if (pt.speck) {
        this.ctx.fillRect(pt.x, this.groundY + 8 + pt.bump, 4, 2);
        this.ctx.fillRect(pt.x + 14, this.groundY + 16, 8, 2);
      }
    }
  }

  drawDino() {
    this.ctx.save();
    const d = this.dino;

    // Glowing cyan cyber dino
    this.ctx.fillStyle = '#00f2fe';
    this.ctx.shadowColor = '#00f2fe';
    this.ctx.shadowBlur = this.state === 'PLAYING' ? 10 : 4;

    if (d.isDucking) {
      // Ducking pose (horizontal elongated body)
      // Body
      this.ctx.fillRect(d.x + 8, d.y + 10, 36, 16);
      // Head
      this.ctx.fillRect(d.x + 34, d.y + 4, 18, 14);
      // Eye
      this.ctx.fillStyle = '#0b0f19';
      this.ctx.fillRect(d.x + 44, d.y + 7, 4, 4);
      this.ctx.fillStyle = '#00f2fe';
      // Legs
      if (d.legFrame === 0 || !d.isGrounded) {
        this.ctx.fillRect(d.x + 14, d.y + 26, 6, 6);
        this.ctx.fillRect(d.x + 28, d.y + 26, 6, 4);
      } else {
        this.ctx.fillRect(d.x + 14, d.y + 26, 6, 4);
        this.ctx.fillRect(d.x + 28, d.y + 26, 6, 6);
      }
    } else {
      // Standing / Running pose
      // Head & Snout
      this.ctx.fillRect(d.x + 22, d.y, 22, 18);
      // Eye
      this.ctx.fillStyle = '#0b0f19';
      this.ctx.fillRect(d.x + 34, d.y + 4, 4, 4);
      this.ctx.fillStyle = '#00f2fe';

      // Neck & Back
      this.ctx.fillRect(d.x + 14, d.y + 14, 16, 20);
      // Main Body
      this.ctx.fillRect(d.x + 8, d.y + 22, 24, 18);
      // Tail
      this.ctx.fillRect(d.x, d.y + 24, 8, 8);
      this.ctx.fillRect(d.x + 4, d.y + 20, 6, 6);
      // Small arms
      this.ctx.fillRect(d.x + 30, d.y + 22, 8, 4);

      // Running Legs
      if (!d.isGrounded) {
        // Jumping legs tucked
        this.ctx.fillRect(d.x + 12, d.y + 40, 6, 8);
        this.ctx.fillRect(d.x + 24, d.y + 40, 6, 8);
      } else if (d.legFrame === 0) {
        // Leg 1 down, Leg 2 back
        this.ctx.fillRect(d.x + 12, d.y + 40, 6, 12);
        this.ctx.fillRect(d.x + 24, d.y + 40, 6, 6);
      } else {
        // Leg 1 back, Leg 2 down
        this.ctx.fillRect(d.x + 12, d.y + 40, 6, 6);
        this.ctx.fillRect(d.x + 24, d.y + 40, 6, 12);
      }
    }

    this.ctx.restore();
  }

  drawObstacles() {
    for (let obs of this.obstacles) {
      this.ctx.save();
      if (obs.type === 'cactus') {
        // Neon Pink / Rose Cacti
        this.ctx.fillStyle = '#ff2a85';
        this.ctx.shadowColor = '#ff2a85';
        this.ctx.shadowBlur = 8;

        const count = Math.round(obs.width / 22);
        for (let c = 0; c < count; c++) {
          const cx = obs.x + c * 22;
          // Main stem
          this.ctx.fillRect(cx + 6, obs.y, 8, obs.height);
          // Left arm
          this.ctx.fillRect(cx, obs.y + 12, 6, 16);
          this.ctx.fillRect(cx, obs.y + 12, 10, 5);
          // Right arm
          this.ctx.fillRect(cx + 14, obs.y + 8, 6, 16);
          this.ctx.fillRect(cx + 10, obs.y + 19, 10, 5);
        }
      } else if (obs.type === 'bird') {
        // Neon Yellow Pterodactyl
        this.ctx.fillStyle = '#fcee0a';
        this.ctx.shadowColor = '#fcee0a';
        this.ctx.shadowBlur = 9;

        // Bird Body & Beak
        this.ctx.fillRect(obs.x + 10, obs.y + 10, 24, 10);
        this.ctx.fillRect(obs.x + 34, obs.y + 12, 10, 5);
        // Eye
        this.ctx.fillStyle = '#0b0f19';
        this.ctx.fillRect(obs.x + 28, obs.y + 11, 3, 3);
        this.ctx.fillStyle = '#fcee0a';

        // Animated Wings
        if (obs.wingFrame === 0) {
          // Wings up
          this.ctx.fillRect(obs.x + 14, obs.y, 10, 10);
          this.ctx.fillRect(obs.x + 18, obs.y - 8, 6, 8);
        } else {
          // Wings down
          this.ctx.fillRect(obs.x + 14, obs.y + 20, 10, 10);
          this.ctx.fillRect(obs.x + 18, obs.y + 28, 6, 6);
        }
      }
      this.ctx.restore();
    }
  }

  loop(currentTime) {
    const delta = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    this.update(delta);
    this.draw();

    requestAnimationFrame((t) => this.loop(t));
  }
}

// Start Game instance on DOM load
window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
