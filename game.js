const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const menu = document.getElementById("menu");
const hud = document.getElementById("hud");
const gameOverScreen = document.getElementById("gameOver");

const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");

const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const levelEl = document.getElementById("level");
const timeEl = document.getElementById("time");
const goalEl = document.getElementById("goal");

const finalScoreEl = document.getElementById("finalScore");
const finalLevelEl = document.getElementById("finalLevel");
const gameOverReasonEl = document.getElementById("gameOverReason");
const messageEl = document.getElementById("message");

// ─── ELLIPTICAL ARENA ──────────────────────────────────────────
const ARENA = { cx: 700, cy: 400, rx: 680, ry: 380 };
const CENTER = { x: ARENA.cx, y: ARENA.cy, death: 50 };
const ORB_COUNT = 12;

const state = {
  running: false, score: 0, lives: 3, level: 1,
  timeLeft: 60, levelOrbs: 0, levelTarget: 8,
  levelBonus: 0, messageTimer: 0
};

let fx = defaultFx();

const player = { x: 0, y: 0, vx: 0, vy: 0, r: 16, invincible: 0 };
const hunter = { x: 0, y: 0, vx: 0, vy: 0, r: 15 };
const orbs = [];
const decoy = { x: 0, y: 0 };

const stars = Array.from({ length: 110 }, () => ({
  x: Math.random(), y: Math.random(),
  size: Math.random() * 2 + 0.4,
  alpha: Math.random() * 0.35 + 0.12
}));

const keys = new Set();
const joystick = {
  active: false, pointerId: null,
  baseX: 0, baseY: 0, knobX: 0, knobY: 0,
  dx: 0, dy: 0, radius: 65
};

let typed = "";
const secretTouch = { taps: [], last: 0 };

const CHEAT_CODES = [
  "nova","freeze","snail","calm","exile","shrinkhunter","confuse",
  "mirror","trap","swap","drain","solar","blind","fear",
  "turbo","rocket","flash","drift","anchor","glide","brake",
  "boost","blink","warp","tiny","giant",
  "feather","space","heavy","repel","surge","void","orbit",
  "stable","antigrav","pull",
  "clockstop","halfclock","rewind","future","eternity","moment",
  "era","zen","quicktime","overtime",
  "haste","bounty","skip","warpone","warpfive","warpten",
  "warpfifteen","warptwenty","warpthirty","warphundred",
  "life","twin","tax","medic","resurrect","tank",
  "rich","jackpot","gamble","interest","goldrush","lucky",
  "double","triple","combo","fortune","payday","dividend",
  "orbplus","orbstorm","orbquake","magnet","supermagnet",
  "scatter","collect","shuffleorbs","burst","ring","vortex","harvest",
  "heal","home","shield","safe","immortal","phantom","ghost",
  "decoy","pulse","cocoon",
  "chaos","mystery","omega","madness","godmode"
];

const SORTED_CODES = [...CHEAT_CODES].sort((a, b) => b.length - a.length);

const POSITIVE_POOL = [
  "nova","freeze","turbo","feather","rewind","rich","magnet",
  "life","orbstorm","clockstop","safe","goldrush","future",
  "rocket","supermagnet","heal","lucky","moment","anchor",
  "pulse","calm","home","shield","tiny"
];

function defaultFx() {
  return {
    freezeHunter: 0, slowHunter: 0, calmHunter: 0,
    shrinkHunter: 0, confuseHunter: 0, mirrorHunter: 0,
    trapHunter: 0, drainFactor: 1, solarStun: 0,
    blindHunter: 0, fearHunter: 0, dangerSpeed: 0,
    turbo: 0, rocket: 0, flash: 0, drift: 0,
    anchor: 0, glide: 0, boostFactor: 1,
    tiny: 0, giant: 0,
    feather: 0, zeroGravity: 0, heavy: 0, repel: 0,
    surge: 0, voidShrink: 0, orbitBoost: 0,
    stable: 0, antigrav: 0, pullBoost: 0,
    clockstop: 0, halfclock: 0, quicktime: 0,
    zen: 0, overtime: 0,
    interest: 0, goldrush: 0, lucky: 0,
    double: 0, triple: 0,
    comboLeft: 0, comboNext: 0,
    payday: 0, dividendUsed: false,
    magnet: 0, supermagnet: 0, vortex: 0,
    shieldHit: false, invincible: 0, phantom: 0,
    ghost: 0, decoyActive: 0,
    cocoon: 0, cocoonBurst: 0,
    scoreAccum: 0
  };
}

// ─── ELLIPSE MATH ──────────────────────────────────────────────

function ellipseValue(x, y) {
  const dx = x - ARENA.cx;
  const dy = y - ARENA.cy;
  return (dx * dx) / (ARENA.rx * ARENA.rx) + (dy * dy) / (ARENA.ry * ARENA.ry);
}

function isInsideEllipse(x, y) {
  return ellipseValue(x, y) <= 1;
}

function ellipseNormal(x, y) {
  const dx = (x - ARENA.cx) / (ARENA.rx * ARENA.rx);
  const dy = (y - ARENA.cy) / (ARENA.ry * ARENA.ry);
  const len = Math.hypot(dx, dy);
  if (len < 0.0001) return { x: 0, y: -1 };
  return { x: dx / len, y: dy / len };
}

function clampToEllipse(x, y, inset) {
  const ev = ellipseValue(x, y);
  const limit = Math.max(0.001, 1 - inset);
  if (ev <= limit) return { x, y, hit: false };
  const scale = Math.sqrt(limit / ev);
  return {
    x: ARENA.cx + (x - ARENA.cx) * scale,
    y: ARENA.cy + (y - ARENA.cy) * scale,
    hit: true
  };
}

function reflectOffEllipse(vx, vy, x, y, restitution) {
  const n = ellipseNormal(x, y);
  const dot = vx * n.x + vy * n.y;
  if (dot >= 0) return { x: vx, y: vy };
  return {
    x: vx - (1 + restitution) * dot * n.x,
    y: vy - (1 + restitution) * dot * n.y
  };
}

function randomEllipsePos(edgeInset, centerMin) {
  for (let i = 0; i < 100; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * (1 - edgeInset);
    const x = ARENA.cx + Math.cos(angle) * r * ARENA.rx;
    const y = ARENA.cy + Math.sin(angle) * r * ARENA.ry;
    const dCenter = Math.hypot(x - CENTER.x, y - CENTER.y);
    if (dCenter > centerMin && isInsideEllipse(x, y)) {
      return { x, y };
    }
  }
  // Fallback: guaranteed safe position
  return { x: ARENA.cx + ARENA.rx * 0.5, y: ARENA.cy };
}

function rand(min, max) { return Math.random() * (max - min) + min; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// ─── RESIZE & INPUT ────────────────────────────────────────────

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

startBtn.addEventListener("click", () => {
  try { startGame(); } catch(e) { console.error("startGame error:", e); alert("Error: " + e.message); }
});
restartBtn.addEventListener("click", () => {
  try { startGame(); } catch(e) { console.error("startGame error:", e); alert("Error: " + e.message); }
});

const preventedKeys = ["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"];

window.addEventListener("keydown", (e) => {
  if (preventedKeys.includes(e.code)) e.preventDefault();
  if (!e.repeat) {
    if ((e.code === "Enter" || e.code === "Space") && !state.running) {
      try { startGame(); } catch(err) { console.error(err); }
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      typed += e.key.toLowerCase();
      typed = typed.slice(-14);
      checkTypedCheat();
    }
  }
  keys.add(e.code);
});

window.addEventListener("keyup", (e) => keys.delete(e.code));

window.addEventListener("blur", () => {
  keys.clear();
  joystick.active = false;
  joystick.dx = 0;
  joystick.dy = 0;
});

canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  if (handleSecretTouch(e.clientX, e.clientY)) return;
  joystick.active = true;
  joystick.pointerId = e.pointerId;
  joystick.baseX = e.clientX;
  joystick.baseY = e.clientY;
  joystick.knobX = e.clientX;
  joystick.knobY = e.clientY;
  updateJoystick();
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener("pointermove", (e) => {
  if (!joystick.active || e.pointerId !== joystick.pointerId) return;
  joystick.knobX = e.clientX;
  joystick.knobY = e.clientY;
  updateJoystick();
});

canvas.addEventListener("pointerup", endPointer);
canvas.addEventListener("pointercancel", endPointer);

function endPointer(e) {
  if (!joystick.active || e.pointerId !== joystick.pointerId) return;
  joystick.active = false;
  joystick.dx = 0;
  joystick.dy = 0;
}

function updateJoystick() {
  let dx = joystick.knobX - joystick.baseX;
  let dy = joystick.knobY - joystick.baseY;
  const len = Math.hypot(dx, dy);
  const max = joystick.radius;
  if (len > max) { dx = (dx / len) * max; dy = (dy / len) * max; }
  joystick.knobX = joystick.baseX + dx;
  joystick.knobY = joystick.baseY + dy;
  joystick.dx = dx / max;
  joystick.dy = dy / max;
}

function handleSecretTouch(x, y) {
  const margin = 70;
  let zone = null;
  if (x < margin && y < margin) zone = "L";
  else if (x > window.innerWidth - margin && y < margin) zone = "R";
  else { secretTouch.taps = []; return false; }
  const now = Date.now();
  if (now - secretTouch.last > 1500) secretTouch.taps = [];
  secretTouch.last = now;
  secretTouch.taps.push(zone);
  if (secretTouch.taps.length > 6) secretTouch.taps.shift();
  if (secretTouch.taps.join("") === "LLLRRR") {
    secretTouch.taps = [];
    const code = window.prompt("Secret code:");
    if (code) activateCheat(code);
    return true;
  }
  return false;
}

function checkTypedCheat() {
  for (const code of SORTED_CODES) {
    if (typed.endsWith(code)) {
      activateCheat(code);
      typed = "";
      return;
    }
  }
}

// ─── SCORE & PROGRESS ──────────────────────────────────────────

function scoreMultiplier() {
  let m = 1;
  if (fx.double > 0) m *= 2;
  if (fx.triple > 0) m *= 3;
  return m;
}

function addScore(amount) {
  state.score += Math.floor(amount * scoreMultiplier());
  updateHUD();
}

function addProgress(amount) {
  state.levelOrbs += amount;
  updateHUD();
  if (state.levelOrbs >= state.levelTarget) { completeLevel(); return true; }
  return false;
}

function checkLevelComplete() {
  if (state.levelOrbs >= state.levelTarget) completeLevel();
}

// ─── ORB MANAGEMENT ────────────────────────────────────────────

function randomOrbPosition() {
  return randomEllipsePos(0.08, 180);
}

function spawnOrb() {
  const p = randomOrbPosition();
  orbs.push({
    id: Math.random().toString(36).slice(2),
    x: p.x, y: p.y, r: 8,
    hue: Math.floor(Math.random() * 360)
  });
}

function shuffleOrbs() {
  for (const orb of orbs) {
    const p = randomOrbPosition();
    orb.x = p.x; orb.y = p.y;
  }
}

function scatterOrbs() {
  for (const orb of orbs) {
    let dx = orb.x - player.x, dy = orb.y - player.y;
    const d = Math.hypot(dx, dy) || 1;
    orb.x += (dx / d) * 250;
    orb.y += (dy / d) * 250;
    const clamped = clampToEllipse(orb.x, orb.y, 0.08);
    orb.x = clamped.x; orb.y = clamped.y;
    if (Math.hypot(orb.x - CENTER.x, orb.y - CENTER.y) < 180) {
      const p = randomOrbPosition();
      orb.x = p.x; orb.y = p.y;
    }
  }
}

function spawnOrbRing() {
  const count = 8;
  const radius = 280;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count;
    const x = ARENA.cx + Math.cos(angle) * radius;
    const y = ARENA.cy + Math.sin(angle) * radius;
    const clamped = clampToEllipse(x, y, 0.05);
    orbs.push({
      id: Math.random().toString(36).slice(2),
      x: clamped.x, y: clamped.y, r: 8,
      hue: Math.floor(360 * i / count)
    });
  }
}

function collectNearestOrb() {
  if (orbs.length === 0) return null;
  let ni = -1, nd = Infinity;
  for (let i = 0; i < orbs.length; i++) {
    const d = Math.hypot(player.x - orbs[i].x, player.y - orbs[i].y);
    if (d < nd) { nd = d; ni = i; }
  }
  if (ni === -1) return null;
  return collectOrbAt(ni);
}

function harvestOrbs(radius) {
  let count = 0;
  for (let i = orbs.length - 1; i >= 0; i--) {
    const d = Math.hypot(player.x - orbs[i].x, player.y - orbs[i].y);
    if (d < radius) {
      collectOrbAt(i);
      count++;
      if (!state.running) return;
    }
  }
  if (count === 0) showMessage("No orbs in range");
  else showMessage(`Harvested ${count} orbs`);
}

function collectOrbAt(index) {
  orbs.splice(index, 1);
  const orbScore = fx.goldrush > 0 ? 20 : 10;
  const orbProgress = fx.lucky > 0 ? 2 : 1;

  addScore(orbScore);

  if (fx.comboLeft > 0) {
    addScore(fx.comboNext * 10);
    fx.comboNext++;
    fx.comboLeft--;
  }

  if (fx.overtime > 0) {
    state.timeLeft = Math.min(999, state.timeLeft + 3);
  }

  state.levelOrbs += orbProgress;
  updateHUD();
  if (state.levelOrbs >= state.levelTarget) { completeLevel(); return true; }
  spawnOrb();
  return false;
}

// ─── LEVEL MANAGEMENT ──────────────────────────────────────────

function getLevelConfig(level) {
  return {
    time: Math.max(20, 65 - level * 4),
    target: Math.min(25, 6 + level * 2),
    gravity: 430 + level * 65,
    hunterSpeed: 125 + level * 20,
    hunterAccel: 330 + level * 25
  };
}

function startGame() {
  resetGame();
}

function resetGame() {
  state.running = true;
  state.score = 0;
  state.lives = 3;
  state.level = 1;
  state.levelBonus = 0;
  state.messageTimer = 0;
  fx = defaultFx();

  menu.classList.add("hidden");
  gameOverScreen.classList.add("hidden");
  hud.classList.remove("hidden");

  startLevel();
}

function startLevel(messageOverride) {
  const config = getLevelConfig(state.level);
  state.timeLeft = config.time;
  state.levelOrbs = 0;
  state.levelTarget = config.target;
  state.levelBonus = 0;

  orbs.length = 0;
  for (let i = 0; i < ORB_COUNT; i++) spawnOrb();

  resetPlayer();
  resetHunter();

  fx.drainFactor = 1;
  fx.boostFactor = 1;

  updateHUD();

  const message = messageOverride ||
    `Level ${state.level}: Collect ${state.levelTarget} orbs in ${Math.ceil(state.timeLeft)}s.`;
  showMessage(message, 3.5);
}

function completeLevel() {
  const timeBonus = Math.max(0, Math.floor(state.timeLeft)) * 5;
  const total = timeBonus + state.levelBonus;
  state.score += total;
  const done = state.level;
  state.level++;

  let bonusLife = "";
  if (state.level % 3 === 0 && state.lives < 6) {
    state.lives++;
    bonusLife = " Bonus life!";
  }

  const config = getLevelConfig(state.level);
  const msg = `Level ${done} complete! Bonus +${total}.${bonusLife} ` +
    `Level ${state.level}: Collect ${config.target} orbs in ${Math.ceil(config.time)}s.`;
  startLevel(msg);
}

function resetPlayer() {
  const pos = randomEllipsePos(0.15, 200);
  player.x = pos.x;
  player.y = pos.y;
  player.vx = 0;
  player.vy = 0;
  player.r = 16;
  player.invincible = 2;
}

function resetHunter() {
  for (let i = 0; i < 30; i++) {
    const p = randomEllipsePos(0.15, 200);
    if (Math.hypot(p.x - player.x, p.y - player.y) > 300) {
      hunter.x = p.x;
      hunter.y = p.y;
      hunter.vx = 0;
      hunter.vy = 0;
      hunter.r = 15;
      return;
    }
  }
  const fallback = randomEllipsePos(0.15, 200);
  hunter.x = fallback.x;
  hunter.y = fallback.y;
  hunter.vx = 0;
  hunter.vy = 0;
  hunter.r = 15;
}

function randomSafePosition() {
  for (let i = 0; i < 40; i++) {
    const p = randomEllipsePos(0.1, 220);
    if (Math.hypot(p.x - hunter.x, p.y - hunter.y) > 200) return p;
  }
  return randomEllipsePos(0.15, 200);
}

// ─── HUD & MESSAGES ────────────────────────────────────────────

function showMessage(text, time = 2.6) {
  messageEl.textContent = text;
  messageEl.classList.remove("hidden");
  state.messageTimer = time;
}

function updateHUD() {
  scoreEl.textContent = Math.floor(state.score);
  livesEl.textContent = state.lives <= 6
    ? ("❤".repeat(Math.max(0, state.lives)) || "0")
    : `x${state.lives}`;
  levelEl.textContent = state.level;
  timeEl.textContent = Math.max(0, Math.ceil(state.timeLeft));
  goalEl.textContent = `${state.levelOrbs}/${state.levelTarget}`;
}

function isProtected() {
  return player.invincible > 0 || fx.invincible > 0 || fx.phantom > 0;
}

function loseLife(reason) {
  if (fx.shieldHit) {
    fx.shieldHit = false;
    showMessage("Shield blocked hit");
    player.invincible = Math.max(player.invincible, 1);
    resetHunter();
    return;
  }
  if (isProtected()) {
    showMessage("Protected");
    resetPlayer();
    resetHunter();
    return;
  }
  state.lives--;
  updateHUD();
  if (state.lives <= 0) gameOver(reason);
  else {
    showMessage(`${reason}. Lives: ${state.lives}`);
    resetPlayer();
    resetHunter();
  }
}

function gameOver(reason) {
  state.running = false;
  finalScoreEl.textContent = Math.floor(state.score);
  finalLevelEl.textContent = state.level;
  gameOverReasonEl.textContent = reason;
  gameOverScreen.classList.remove("hidden");
  hud.classList.add("hidden");
}

// ─── FX UPDATE ─────────────────────────────────────────────────

function updateFx(dt) {
  let scoreRate = 0;
  if (fx.interest > 0) scoreRate += 5;
  if (fx.heavy > 0) scoreRate += 2;
  if (fx.payday > 0) scoreRate += 30;
  if (scoreRate > 0) {
    fx.scoreAccum += scoreRate * scoreMultiplier() * dt;
    if (fx.scoreAccum >= 1) {
      const add = Math.floor(fx.scoreAccum);
      fx.scoreAccum -= add;
      state.score += add;
    }
  }

  if (fx.cocoon > 0) {
    fx.cocoon -= dt;
    if (fx.cocoon <= 0) {
      fx.cocoonBurst = 3;
      fx.invincible = Math.max(fx.invincible, 3);
      showMessage("Cocoon burst! Invincible 3s");
    }
  }

  for (const key of Object.keys(fx)) {
    if (key === "scoreAccum" || key === "drainFactor" || key === "boostFactor" ||
        key === "shieldHit" || key === "dividendUsed" || key === "comboNext" ||
        key === "comboLeft" || key === "cocoon") continue;
    if (typeof fx[key] === "number" && fx[key] > 0) {
      fx[key] = Math.max(0, fx[key] - dt);
    }
  }
}

// ─── MAIN UPDATE LOOP ─────────────────────────────────────────

function update(dt) {
  updateFx(dt);

  let timeRate = 1;
  if (fx.clockstop > 0) timeRate = 0;
  else if (fx.quicktime > 0) timeRate = 0.3;
  else if (fx.halfclock > 0) timeRate = 0.5;
  state.timeLeft -= dt * timeRate;

  if (state.messageTimer > 0) {
    state.messageTimer -= dt;
    if (state.messageTimer <= 0) messageEl.classList.add("hidden");
  }

  if (state.timeLeft <= 0) {
    state.timeLeft = 0;
    updateHUD();
    gameOver("Time's up");
    return;
  }

  updatePlayer(dt);
  if (!state.running) return;
  updateHunter(dt);
  if (!state.running) return;
  updateOrbs(dt);
  updateHUD();
}

// ─── PLAYER PHYSICS (ELLIPTICAL) ──────────────────────────────

function updatePlayer(dt) {
  if (fx.cocoon > 0) {
    player.vx = 0; player.vy = 0;
    return;
  }

  let dx = 0, dy = 0;
  if (keys.has("ArrowLeft") || keys.has("KeyA")) dx -= 1;
  if (keys.has("ArrowRight") || keys.has("KeyD")) dx += 1;
  if (keys.has("ArrowUp") || keys.has("KeyW")) dy -= 1;
  if (keys.has("ArrowDown") || keys.has("KeyS")) dy += 1;
  if (joystick.active) { dx += joystick.dx; dy += joystick.dy; }
  const len = Math.hypot(dx, dy);
  if (len > 1) { dx /= len; dy /= len; }

  let acceleration = 1250 * fx.boostFactor;
  if (fx.turbo > 0) acceleration *= 1.8;
  if (fx.rocket > 0) acceleration *= 3;
  if (fx.flash > 0) acceleration *= 5;
  if (fx.cocoonBurst > 0) acceleration *= 2;

  player.vx += dx * acceleration * dt;
  player.vy += dy * acceleration * dt;

  const toCenterX = CENTER.x - player.x;
  const toCenterY = CENTER.y - player.y;
  const centerDistance = Math.hypot(toCenterX, toCenterY) || 1;

  const radX = toCenterX / centerDistance;
  const radY = toCenterY / centerDistance;
  const tanX = -radY;
  const tanY = radX;

  const vRadial = player.vx * radX + player.vy * radY;
  const vTangential = player.vx * tanX + player.vy * tanY;

  const config = getLevelConfig(state.level);
  let gravityPower = 1;
  if (fx.zeroGravity > 0) gravityPower = 0;
  else if (fx.feather > 0) gravityPower = 0.35;
  else if (fx.heavy > 0) gravityPower = 2;
  else if (fx.repel > 0) gravityPower = -0.8;
  else if (fx.antigrav > 0) gravityPower = -0.3;
  else if (fx.stable > 0) gravityPower = 0.5;
  else if (fx.pullBoost > 0) gravityPower = 1.5;

  if (fx.surge > 0) {
    gravityPower *= 0.5 + Math.sin(performance.now() / 300) * 0.8;
  }
  if (fx.zen > 0) gravityPower *= 0.7;

  const pullStrength = config.gravity * gravityPower;
  player.vx += radX * pullStrength * dt;
  player.vy += radY * pullStrength * dt;

  const orbitalRange = 480;
  if (centerDistance < orbitalRange && fx.stable <= 0) {
    const proximity = 1 - centerDistance / orbitalRange;
    let tangentialForce = 200 * proximity;
    if (vRadial > 0) tangentialForce += 160 * proximity * Math.min(1, vRadial / 250);
    tangentialForce += Math.abs(vTangential) * proximity * 0.45;
    if (fx.orbitBoost > 0) tangentialForce *= 2;
    let rotDir = Math.abs(vTangential) > 2 ? (vTangential > 0 ? 1 : -1) : 1;
    if (vRadial < 0) tangentialForce *= 0.55;
    player.vx += tanX * tangentialForce * rotDir * dt;
    player.vy += tanY * tangentialForce * rotDir * dt;
  }

  let friction = 3.5;
  if (fx.drift > 0) friction = 1.0;
  if (fx.anchor > 0) friction = 6.5;
  if (fx.glide > 0) friction = 0;
  const damping = Math.max(0, 1 - friction * dt);
  player.vx *= damping;
  player.vy *= damping;

  player.x += player.vx * dt;
  player.y += player.vy * dt;

  player.r = 16;
  if (fx.tiny > 0) player.r *= 0.55;
  if (fx.giant > 0) player.r *= 1.5;

  const inset = player.r / Math.min(ARENA.rx, ARENA.ry);
  const boundary = clampToEllipse(player.x, player.y, inset);
  if (boundary.hit) {
    player.x = boundary.x;
    player.y = boundary.y;
    const reflected = reflectOffEllipse(player.vx, player.vy, player.x, player.y, 0.55);
    player.vx = reflected.x;
    player.vy = reflected.y;
  }

  player.invincible = Math.max(0, player.invincible - dt);

  let deathRadius = CENTER.death;
  if (fx.voidShrink > 0) deathRadius *= 0.5;
  const holeDistance = Math.hypot(player.x - CENTER.x, player.y - CENTER.y);
  if (holeDistance < deathRadius + player.r * 0.25) {
    if (isProtected() || fx.shieldHit) {
      if (fx.shieldHit) { fx.shieldHit = false; showMessage("Shield blocked hole"); }
      else showMessage("Protected from hole");
      resetPlayer();
    } else {
      loseLife("The singularity consumed you");
    }
  }
}

// ─── HUNTER PHYSICS (ELLIPTICAL) ──────────────────────────────

function updateHunter(dt) {
  if (fx.solarStun > 0 || fx.freezeHunter > 0) {
    hunter.vx = 0; hunter.vy = 0;
    hunter.r = fx.shrinkHunter > 0 ? 8 : 15;
    return;
  }

  hunter.r = fx.shrinkHunter > 0 ? 8 : 15;

  const config = getLevelConfig(state.level);
  let targetX, targetY;

  if (fx.decoyActive > 0) {
    targetX = decoy.x; targetY = decoy.y;
  } else if (fx.mirrorHunter > 0 || fx.fearHunter > 0) {
    targetX = hunter.x + (hunter.x - player.x);
    targetY = hunter.y + (hunter.y - player.y);
  } else if (fx.trapHunter > 0) {
    targetX = CENTER.x; targetY = CENTER.y;
  } else {
    targetX = player.x; targetY = player.y;
  }

  const dx = targetX - hunter.x;
  const dy = targetY - hunter.y;
  const d = Math.hypot(dx, dy) || 1;

  let targetSpeed = config.hunterSpeed + Math.min(120, state.score * 0.03);
  targetSpeed *= fx.drainFactor;
  if (fx.slowHunter > 0) targetSpeed *= 0.25;
  if (fx.calmHunter > 0) targetSpeed *= 0.6;
  if (fx.dangerSpeed > 0) targetSpeed *= 1.45;
  if (fx.zen > 0) targetSpeed *= 0.5;
  if (fx.fearHunter > 0) targetSpeed *= 1.6;
  if (fx.blindHunter > 0) targetSpeed *= 0.4;

  const accel = config.hunterAccel;

  if (fx.confuseHunter > 0 || fx.blindHunter > 0 || fx.ghost > 0) {
    hunter.vx += rand(-450, 450) * dt;
    hunter.vy += rand(-450, 450) * dt;
  } else {
    hunter.vx += (dx / d) * accel * dt;
    hunter.vy += (dy / d) * accel * dt;
  }

  const dampH = Math.max(0, 1 - 2.6 * dt);
  hunter.vx *= dampH;
  hunter.vy *= dampH;

  const speed = Math.hypot(hunter.vx, hunter.vy);
  if (speed > targetSpeed) {
    hunter.vx = (hunter.vx / speed) * targetSpeed;
    hunter.vy = (hunter.vy / speed) * targetSpeed;
  }

  hunter.x += hunter.vx * dt;
  hunter.y += hunter.vy * dt;

  const hInset = hunter.r / Math.min(ARENA.rx, ARENA.ry);
  const hBound = clampToEllipse(hunter.x, hunter.y, hInset);
  if (hBound.hit) {
    hunter.x = hBound.x;
    hunter.y = hBound.y;
    const ref = reflectOffEllipse(hunter.vx, hunter.vy, hunter.x, hunter.y, 0.8);
    hunter.vx = ref.x;
    hunter.vy = ref.y;
  }

  let deathRadius = CENTER.death;
  if (fx.voidShrink > 0) deathRadius *= 0.5;
  const holeDist = Math.hypot(hunter.x - CENTER.x, hunter.y - CENTER.y);
  if (holeDist < deathRadius + hunter.r * 0.4) {
    addScore(15);
    showMessage("Hunter consumed +15");
    resetHunter();
    return;
  }

  const hitDist = Math.hypot(player.x - hunter.x, player.y - hunter.y);
  if (hitDist < player.r + hunter.r && player.invincible <= 0) {
    if (fx.phantom > 0) return;
    if (fx.shieldHit) {
      fx.shieldHit = false;
      showMessage("Shield blocked hunter");
      player.invincible = Math.max(player.invincible, 1);
      resetHunter();
      return;
    }
    if (fx.invincible > 0) {
      resetHunter();
      showMessage("Protected");
      return;
    }
    loseLife("The hunter caught you");
  }
}

// ─── ORB PHYSICS ───────────────────────────────────────────────

function updateOrbs(dt) {
  const magnetPower =
    fx.supermagnet > 0 ? 700 :
    fx.vortex > 0 ? 500 :
    fx.magnet > 0 ? 280 : 0;

  if (magnetPower > 0) {
    for (const orb of orbs) {
      const dx = player.x - orb.x, dy = player.y - orb.y;
      const d = Math.hypot(dx, dy);
      if (d > 1 && d < 560) {
        let mx = (dx / d) * magnetPower * dt;
        let my = (dy / d) * magnetPower * dt;
        if (fx.vortex > 0) {
          const tx = -dy / d, ty = dx / d;
          mx += tx * magnetPower * 0.4 * dt;
          my += ty * magnetPower * 0.4 * dt;
        }
        orb.x += mx;
        orb.y += my;
        const oc = clampToEllipse(orb.x, orb.y, 0.05);
        if (oc.hit) { orb.x = oc.x; orb.y = oc.y; }
      }
    }
  }

  for (let i = 0; i < orbs.length; i++) {
    const orb = orbs[i];
    const d = Math.hypot(player.x - orb.x, player.y - orb.y);
    if (d < player.r + orb.r + 2) {
      collectOrbAt(i);
      return;
    }
  }
}

// ─── RENDERING (ELLIPTICAL ARENA) ─────────────────────────────

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawStars();

  const scaleX = canvas.width / (ARENA.rx * 2 + 80);
  const scaleY = canvas.height / (ARENA.ry * 2 + 80);
  const scale = Math.min(scaleX, scaleY);
  const offsetX = (canvas.width - ARENA.rx * 2 * scale) / 2;
  const offsetY = (canvas.height - ARENA.ry * 2 * scale) / 2;

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  ctx.translate(-ARENA.cx + ARENA.rx, -ARENA.cy + ARENA.ry);

  drawArena();
  drawHole();
  drawOrbs();
  if (fx.decoyActive > 0) drawDecoy();
  drawHunter();
  drawPlayer();

  ctx.restore();

  if (joystick.active) drawJoystick();
}

function drawStars() {
  const now = performance.now();
  for (const star of stars) {
    const x = ((star.x + now * 0.00002 * star.size) % 1) * canvas.width;
    const y = star.y * canvas.height;
    ctx.fillStyle = `rgba(255,255,255,${star.alpha})`;
    ctx.fillRect(x, y, star.size, star.size);
  }
}

function drawArena() {
  ctx.save();
  ctx.fillStyle = "rgba(3, 8, 20, 0.62)";
  ctx.beginPath();
  ctx.ellipse(ARENA.cx, ARENA.cy, ARENA.rx, ARENA.ry, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.clip();
  ctx.strokeStyle = "rgba(0, 245, 255, 0.06)";
  ctx.lineWidth = 1;
  for (let x = ARENA.cx - ARENA.rx; x <= ARENA.cx + ARENA.rx; x += 80) {
    ctx.beginPath(); ctx.moveTo(x, ARENA.cy - ARENA.ry); ctx.lineTo(x, ARENA.cy + ARENA.ry); ctx.stroke();
  }
  for (let y = ARENA.cy - ARENA.ry; y <= ARENA.cy + ARENA.ry; y += 80) {
    ctx.beginPath(); ctx.moveTo(ARENA.cx - ARENA.rx, y); ctx.lineTo(ARENA.cx + ARENA.rx, y); ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "rgba(0, 245, 255, 0.35)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(ARENA.cx, ARENA.cy, ARENA.rx, ARENA.ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawHole() {
  const t = performance.now() / 1000;
  let deathRadius = CENTER.death;
  if (fx.voidShrink > 0) deathRadius *= 0.5;

  const gradient = ctx.createRadialGradient(
    CENTER.x, CENTER.y, 4,
    CENTER.x, CENTER.y, 200
  );
  gradient.addColorStop(0, "rgba(0,0,0,1)");
  gradient.addColorStop(0.32, "rgba(122,0,255,0.55)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(CENTER.x, CENTER.y, 200, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.strokeStyle = "rgba(200,120,255,0.8)";
  ctx.lineWidth = 2;
  ctx.setLineDash([18, 12]);
  ctx.lineDashOffset = -t * 80;
  ctx.beginPath();
  ctx.arc(CENTER.x, CENTER.y, deathRadius + 14, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "rgba(100,60,200,0.15)";
  ctx.lineWidth = 1;
  for (let i = 1; i <= 4; i++) {
    ctx.beginPath();
    ctx.arc(CENTER.x, CENTER.y, deathRadius + 14 + i * 50, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawOrbs() {
  const t = performance.now() / 1000;
  for (const orb of orbs) {
    const pulse = 1 + Math.sin(t * 4 + orb.x * 0.01) * 0.18;
    ctx.save();
    ctx.shadowBlur = 18;
    ctx.shadowColor = `hsl(${orb.hue} 100% 70%)`;
    ctx.fillStyle = `hsl(${orb.hue} 100% 72%)`;
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, orb.r * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawDecoy() {
  const t = performance.now() / 1000;
  ctx.save();
  ctx.globalAlpha = 0.4 + Math.sin(t * 6) * 0.15;
  ctx.shadowBlur = 20;
  ctx.shadowColor = "#00f5ff";
  ctx.fillStyle = "#00f5ff";
  ctx.beginPath();
  ctx.arc(decoy.x, decoy.y, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHunter() {
  let color = "#ff3b3b";
  if (fx.freezeHunter > 0 || fx.solarStun > 0) color = "#7df9ff";
  else if (fx.confuseHunter > 0 || fx.blindHunter > 0) color = "#8a2be2";
  else if (fx.slowHunter > 0 || fx.calmHunter > 0) color = "#ff9f43";
  else if (fx.mirrorHunter > 0 || fx.fearHunter > 0) color = "#39ff14";
  else if (fx.ghost > 0) color = "#555";
  else if (fx.dangerSpeed > 0) color = "#ff00e5";

  ctx.save();
  ctx.shadowBlur = 25;
  ctx.shadowColor = color;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(hunter.x, hunter.y, hunter.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.arc(hunter.x + 3, hunter.y + 3, hunter.r * 0.35, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlayer() {
  ctx.save();
  if (player.invincible > 0 && Math.floor(performance.now() / 120) % 2 === 0) {
    ctx.globalAlpha = 0.35;
  }
  if (fx.phantom > 0) ctx.globalAlpha = 0.45;
  ctx.shadowBlur = 30;
  ctx.shadowColor = "#00f5ff";
  ctx.fillStyle = "#00f5ff";
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (fx.invincible > 0) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,215,0,0.85)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.r + 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  if (fx.shieldHit) {
    ctx.save();
    ctx.strokeStyle = "rgba(0,200,255,0.7)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.r + 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  if (fx.cocoon > 0) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,165,0,0.8)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.r + 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.r + 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawJoystick() {
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.beginPath();
  ctx.arc(joystick.baseX, joystick.baseY, joystick.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.30)";
  ctx.beginPath();
  ctx.arc(joystick.knobX, joystick.knobY, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ─── GAME LOOP ─────────────────────────────────────────────────

let last = performance.now();

function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (state.running) update(dt);
  render();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

// ─── CHEAT SYSTEM ──────────────────────────────────────────────

function activateCheat(rawCode) {
  if (!state.running) return;
  const code = String(rawCode || "").toLowerCase().trim();
  if (!CHEAT_CODES.includes(code)) return;

  switch (code) {
    case "nova": resetHunter(); showMessage("Hunter teleported"); break;
    case "freeze": fx.freezeHunter = 5; showMessage("Hunter frozen 5s"); break;
    case "snail": fx.slowHunter = 8; showMessage("Hunter crawling 8s"); break;
    case "calm": fx.calmHunter = 12; showMessage("Hunter calmed 12s"); break;
    case "exile": resetHunter(); fx.slowHunter = Math.max(fx.slowHunter, 3); showMessage("Hunter exiled"); break;
    case "shrinkhunter": fx.shrinkHunter = 10; showMessage("Hunter shrunk 10s"); break;
    case "confuse": fx.confuseHunter = 6; showMessage("Hunter confused 6s"); break;
    case "mirror": fx.mirrorHunter = 8; showMessage("Hunter fleeing 8s"); break;
    case "trap": fx.trapHunter = 6; showMessage("Hunter trapped 6s"); break;
    case "swap": {
      const tx = player.x, ty = player.y;
      player.x = hunter.x; player.y = hunter.y;
      hunter.x = tx; hunter.y = ty;
      player.vx = 0; player.vy = 0;
      hunter.vx = 0; hunter.vy = 0;
      player.invincible = Math.max(player.invincible, 1.5);
      showMessage("Positions swapped");
      break;
    }
    case "drain": fx.drainFactor = Math.max(0.15, fx.drainFactor - 0.15); showMessage(`Hunter drained (${Math.round(fx.drainFactor*100)}%)`); break;
    case "solar": {
      const sdx = hunter.x - player.x, sdy = hunter.y - player.y;
      const sd = Math.hypot(sdx, sdy) || 1;
      hunter.x += (sdx/sd)*400; hunter.y += (sdy/sd)*400;
      const sc = clampToEllipse(hunter.x, hunter.y, 0.1);
      hunter.x = sc.x; hunter.y = sc.y;
      hunter.vx = 0; hunter.vy = 0; fx.solarStun = 2;
      showMessage("Solar blast"); break;
    }
    case "blind": fx.blindHunter = 5; showMessage("Hunter blinded 5s"); break;
    case "fear": fx.fearHunter = 5; showMessage("Hunter terrified 5s"); break;
    case "turbo": fx.turbo = 8; showMessage("Turbo 8s"); break;
    case "rocket": fx.rocket = 4; showMessage("Rocket 4s"); break;
    case "flash": fx.flash = 1.5; showMessage("Flash 1.5s"); break;
    case "drift": fx.drift = 8; showMessage("Drift 8s"); break;
    case "anchor": fx.anchor = 8; showMessage("Anchor 8s"); break;
    case "glide": fx.glide = 6; showMessage("Glide 6s"); break;
    case "brake": player.vx = 0; player.vy = 0; showMessage("Full stop"); break;
    case "boost": fx.boostFactor = Math.min(3, fx.boostFactor * 1.1); showMessage(`Boost (${Math.round(fx.boostFactor*100)}%)`); break;
    case "blink": {
      let bdx = player.vx, bdy = player.vy;
      const blen = Math.hypot(bdx, bdy);
      if (blen > 1) { bdx /= blen; bdy /= blen; } else { bdx = 0; bdy = -1; }
      player.x += bdx*200; player.y += bdy*200;
      const bc = clampToEllipse(player.x, player.y, 0.1);
      player.x = bc.x; player.y = bc.y;
      player.invincible = Math.max(player.invincible, 0.5);
      showMessage("Blink"); break;
    }
    case "warp": { const pos = randomSafePosition(); player.x=pos.x; player.y=pos.y; player.vx=0; player.vy=0; player.invincible=Math.max(player.invincible,1); showMessage("Warped"); break; }
    case "tiny": fx.tiny = 10; showMessage("Tiny 10s"); break;
    case "giant": fx.giant = 10; showMessage("Giant 10s"); break;
    case "feather": fx.feather = 10; showMessage("Feather gravity 10s"); break;
    case "space": fx.zeroGravity = 4; showMessage("Zero gravity 4s"); break;
    case "heavy": fx.heavy = 6; showMessage("Heavy gravity + scoring 6s"); break;
    case "repel": fx.repel = 5; showMessage("Repel gravity 5s"); break;
    case "surge": fx.surge = 8; showMessage("Gravity surging 8s"); break;
    case "void": fx.voidShrink = 10; showMessage("Black hole shrunk 10s"); break;
    case "orbit": fx.orbitBoost = 8; showMessage("Orbital boost 8s"); break;
    case "stable": fx.stable = 6; showMessage("Stable zone 6s"); break;
    case "antigrav": fx.antigrav = 5; showMessage("Anti-gravity 5s"); break;
    case "pull": fx.pullBoost = 8; showMessage("Gravity pull 1.5x 8s"); break;
    case "clockstop": fx.clockstop = 5; showMessage("Time frozen 5s"); break;
    case "halfclock": fx.halfclock = 10; showMessage("Time slowed 10s"); break;
    case "rewind": state.timeLeft = Math.min(999, state.timeLeft + 10); showMessage("+10 seconds"); break;
    case "future": state.timeLeft = Math.min(999, state.timeLeft + 25); showMessage("+25 seconds"); break;
    case "eternity": state.timeLeft = 99; showMessage("Time set to 99"); break;
    case "moment": state.timeLeft = Math.min(999, state.timeLeft + 5); showMessage("+5 seconds"); break;
    case "era": state.timeLeft = Math.min(999, state.timeLeft + 40); showMessage("+40 seconds"); break;
    case "zen": fx.zen = 6; showMessage("Zen mode 6s"); break;
    case "quicktime": fx.quicktime = 6; showMessage("Quick time 6s"); break;
    case "overtime": fx.overtime = 8; showMessage("Overtime: orbs give +3s for 8s"); break;
    case "haste": state.levelTarget = Math.max(1, state.levelTarget - 2); showMessage("Goal reduced"); checkLevelComplete(); break;
    case "bounty": state.levelTarget += 3; state.levelBonus += 150; showMessage("Goal +3, bonus +150"); break;
    case "skip": completeLevel(); return;
    case "warpone": state.level=1; startLevel("Warped to level 1"); return;
    case "warpfive": state.level=5; startLevel("Warped to level 5"); return;
    case "warpten": state.level=10; startLevel("Warped to level 10"); return;
    case "warpfifteen": state.level=15; startLevel("Warped to level 15"); return;
    case "warptwenty": state.level=20; startLevel("Warped to level 20"); return;
    case "warpthirty": state.level=30; startLevel("Warped to level 30"); return;
    case "warphundred": state.level=100; startLevel("Warped to level 100"); return;
    case "life": state.lives++; showMessage("+1 life"); break;
    case "twin": state.lives+=2; state.score=Math.max(0,state.score-50); showMessage("+2 lives, -50 score"); break;
    case "tax": if(state.score>=100){state.score-=100;state.lives++;showMessage("Tax: +1 life");}else{showMessage("Need 100 score");} break;
    case "medic": state.lives++; resetPlayer(); showMessage("Medic: +1 life, healed"); break;
    case "resurrect": state.lives+=3; state.score=Math.max(0,state.score-200); showMessage("+3 lives, -200 score"); break;
    case "tank": state.lives+=5; fx.dangerSpeed=Math.max(fx.dangerSpeed,10); showMessage("+5 lives, hunter enraged"); break;
    case "rich": addScore(150); showMessage("+150 score"); break;
    case "jackpot": addScore(400); fx.dangerSpeed=Math.max(fx.dangerSpeed,10); showMessage("+400 score, hunter enraged"); break;
    case "gamble": if(Math.random()<0.5){addScore(500);showMessage("Gamble won: +500");}else{showMessage("Gamble lost");loseLife("Gamble lost");return;} break;
    case "interest": fx.interest=10; showMessage("Interest: +5/s for 10s"); break;
    case "goldrush": fx.goldrush=12; showMessage("Gold rush: 2x orb score 12s"); break;
    case "lucky": fx.lucky=10; showMessage("Lucky: 2x orb progress 10s"); break;
    case "double": fx.double=10; showMessage("Double score 10s"); break;
    case "triple": fx.triple=5; showMessage("Triple score 5s"); break;
    case "combo": fx.comboLeft=5; fx.comboNext=1; showMessage("Combo: next 5 orbs give bonus"); break;
    case "fortune": { const amt=Math.floor(rand(50,500)); addScore(amt); showMessage(`Fortune: +${amt} score`); break; }
    case "payday": fx.payday=3; showMessage("Payday: +30/s for 3s"); break;
    case "dividend": { const div=state.levelOrbs*2; addScore(div); showMessage(`Dividend: +${div} score`); break; }
    case "orbplus": if(!addProgress(1)) showMessage("+1 orb progress"); break;
    case "orbstorm": if(!addProgress(3)) showMessage("+3 orb progress"); break;
    case "orbquake": if(!addProgress(6)) showMessage("+6 orb progress"); break;
    case "magnet": fx.magnet=8; showMessage("Magnet 8s"); break;
    case "supermagnet": fx.supermagnet=4; showMessage("Super magnet 4s"); break;
    case "scatter": scatterOrbs(); showMessage("Orbs scattered"); break;
    case "collect": { const res=collectNearestOrb(); if(res===null) showMessage("No orb"); else if(!res) showMessage("Collected nearest orb"); break; }
    case "shuffleorbs": shuffleOrbs(); showMessage("Orbs shuffled"); break;
    case "burst": for(let i=0;i<5;i++) spawnOrb(); showMessage("+5 orbs spawned"); break;
    case "ring": spawnOrbRing(); showMessage("Orb ring spawned"); break;
    case "vortex": fx.vortex=6; showMessage("Vortex 6s"); break;
    case "harvest": harvestOrbs(250); break;
    case "heal": resetPlayer(); fx.invincible=Math.max(fx.invincible,3); showMessage("Healed + shield 3s"); break;
    case "home": { const hp=randomEllipsePos(0.3,250); player.x=hp.x; player.y=hp.y; player.vx=0; player.vy=0; player.invincible=Math.max(player.invincible,1); showMessage("Home"); break; }
    case "shield": fx.shieldHit=true; showMessage("Shield: blocks 1 hit"); break;
    case "safe": fx.invincible=Math.max(fx.invincible,5); showMessage("Safe 5s"); break;
    case "immortal": fx.invincible=Math.max(fx.invincible,12); showMessage("Immortal 12s"); break;
    case "phantom": fx.phantom=8; showMessage("Phantom 8s"); break;
    case "ghost": fx.ghost=6; showMessage("Ghost 6s"); break;
    case "decoy": {
      fx.decoyActive=8;
      decoy.x=player.x+rand(-200,200); decoy.y=player.y+rand(-200,200);
      const dc=clampToEllipse(decoy.x,decoy.y,0.1);
      decoy.x=dc.x; decoy.y=dc.y;
      showMessage("Decoy deployed 8s"); break;
    }
    case "pulse": {
      const pdx=hunter.x-player.x, pdy=hunter.y-player.y;
      const pd=Math.hypot(pdx,pdy)||1;
      hunter.x+=(pdx/pd)*350; hunter.y+=(pdy/pd)*350;
      const pc=clampToEllipse(hunter.x,hunter.y,0.1);
      hunter.x=pc.x; hunter.y=pc.y;
      hunter.vx=0; hunter.vy=0;
      showMessage("Pulse"); break;
    }
    case "cocoon": fx.cocoon=2; fx.cocoonBurst=0; player.vx=0; player.vy=0; showMessage("Cocoon forming..."); break;
    case "chaos": activateCheat(POSITIVE_POOL[Math.floor(Math.random()*POSITIVE_POOL.length)]); return;
    case "mystery": { const pool=CHEAT_CODES.filter(c=>c!=="mystery"&&c!=="madness"&&c!=="omega"); activateCheat(pool[Math.floor(Math.random()*pool.length)]); return; }
    case "omega": for(let i=0;i<3;i++) activateCheat(POSITIVE_POOL[Math.floor(Math.random()*POSITIVE_POOL.length)]); return;
    case "madness": { const pool=CHEAT_CODES.filter(c=>c!=="madness"&&c!=="omega"&&c!=="mystery"); for(let i=0;i<5;i++) activateCheat(pool[Math.floor(Math.random()*pool.length)]); return; }
    case "godmode":
      fx.invincible=Math.max(fx.invincible,12); fx.turbo=Math.max(fx.turbo,8);
      fx.supermagnet=Math.max(fx.supermagnet,4); fx.goldrush=Math.max(fx.goldrush,12);
      fx.double=Math.max(fx.double,10); fx.lucky=Math.max(fx.lucky,10);
      fx.orbitBoost=Math.max(fx.orbitBoost,8); fx.feather=Math.max(fx.feather,10);
      state.levelBonus+=150; state.levelTarget=Math.max(1,state.levelTarget-2);
      fx.shieldHit=true; fx.interest=Math.max(fx.interest,10); fx.payday=Math.max(fx.payday,3);
      addScore(150); completeLevel(); showMessage("GODMODE ACTIVATED"); return;
  }
  updateHUD();
}
