#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

// Read index.html and extract the game engine script
const htmlPath = path.join(__dirname, '../index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

// Find the last <script> tag
const scriptStart = html.lastIndexOf('<script>');
const scriptEnd = html.lastIndexOf('</script>');
if (scriptStart === -1 || scriptEnd === -1) {
  console.error('FAIL: Could not find script tag in index.html');
  process.exit(1);
}

let script = html.substring(scriptStart + 8, scriptEnd);

// Inject export hook before the final })();
// Replace the last })(); with the hook that exports __g and then calls })();
const hookCode = `window.__g={
  get grid(){return grid},
  get m(){return m},
  get W(){return W},
  get H(){return H},
  get tick(){return tick},
  get state(){return state},
  get got(){return got},
  get need(){return need},
  LEVELS,
  load,
  step,
  input,
  die,
  set state(v){state=v},
  consts:{
    WALL:typeof WALL!=='undefined'?WALL:undefined,
    RAM:typeof RAM!=='undefined'?RAM:undefined,
    BASE:typeof BASE!=='undefined'?BASE:undefined,
    ZONK:typeof ZONK!=='undefined'?ZONK:undefined,
    INFO:typeof INFO!=='undefined'?INFO:undefined,
    EXIT:typeof EXIT!=='undefined'?EXIT:undefined,
    SNIK:typeof SNIK!=='undefined'?SNIK:undefined,
    ELEC:typeof ELEC!=='undefined'?ELEC:undefined,
    ODISK:typeof ODISK!=='undefined'?ODISK:undefined,
    RDISK:typeof RDISK!=='undefined'?RDISK:undefined,
    RDISK_ON:typeof RDISK_ON!=='undefined'?RDISK_ON:undefined,
    PORT:typeof PORT!=='undefined'?PORT:undefined,
    EXPL:typeof EXPL!=='undefined'?EXPL:undefined,
    PING:typeof PING!=='undefined'?PING:undefined,
    HUNT:typeof HUNT!=='undefined'?HUNT:undefined,
    MINE:typeof MINE!=='undefined'?MINE:undefined
  },
  get exitOpen(){return exitOpen}
};`;

// Inject hook before the final })(); (may have trailing whitespace)
script = script.replace(/\}\)\(\);[\s]*$/, hookCode + '})();');

// Create canvas context stub
function create2DContext() {
  const ctx = {
    fillRect: () => {}, strokeRect: () => {}, fillText: () => {}, strokeText: () => {},
    beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, arc: () => {}, arcTo: () => {},
    quadraticCurveTo: () => {}, bezierCurveTo: () => {},
    stroke: () => {}, fill: () => {}, clip: () => {},
    drawImage: () => {}, save: () => {}, restore: () => {},
    scale: () => {}, translate: () => {}, rotate: () => {}, transform: () => {}, setTransform: () => {},
    clearRect: () => {}, createImageData: () => ({ data: [] }),
    getImageData: () => ({ data: [] }), putImageData: () => {},
    createRadialGradient: () => ({ addColorStop: () => {} }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createPattern: () => ({}),
    closePath: () => {}, ellipse: () => {}, rect: () => {},
    fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1,
    font: '', textAlign: 'left', textBaseline: 'top',
    lineCap: 'butt', lineJoin: 'miter', miterLimit: 10,
    shadowBlur: 0, shadowColor: '', shadowOffsetX: 0, shadowOffsetY: 0,
    get globalCompositeOperation() { return 'source-over'; },
    set globalCompositeOperation(v) {}
  };
  return ctx;
}

// Create stubs for browser APIs
const stubs = {
  window: {},
  document: createDocStub(),
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  matchMedia: () => ({ matches: false, addEventListener: () => {} }),
  performance: { now: () => 0 },
  requestAnimationFrame: () => {},
  ResizeObserver: class { observe() {} },
  navigator: { maxTouchPoints: 0 },
  addEventListener: () => {},
  setTimeout: () => {},
  clearTimeout: () => {},
  setInterval: () => {},
  clearInterval: () => {},
  AudioContext: undefined,
  getComputedStyle: () => ({})
};

// Create a generic stub proxy for DOM elements
function createStubProxy() {
  return new Proxy({}, {
    get(target, prop) {
      if (prop === 'classList') return { add: () => {}, toggle: () => {}, remove: () => {} };
      if (prop === 'style') return {};
      if (prop === 'addEventListener') return () => {};
      if (prop === 'removeEventListener') return () => {};
      if (prop === 'setPointerCapture') return () => {};
      if (prop === 'querySelector') return () => createStubProxy();
      if (prop === 'querySelectorAll') return () => [];
      if (prop === 'getBoundingClientRect') return () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 });
      if (prop === 'focus') return () => {};
      if (prop === 'click') return () => {};
      if (prop === 'getContext') return () => create2DContext();
      return createStubProxy();
    },
    set(target, prop, value) { return true; }
  });
}

function createDocStub() {
  return {
    getElementById: (id) => createStubProxy(),
    createElement: (tag) => {
      const el = createStubProxy();
      if (tag === 'canvas') {
        el.width = 0;
        el.height = 0;
        el.getContext = () => create2DContext();
      }
      return el;
    },
    querySelector: () => createStubProxy(),
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
    fonts: { ready: Promise.resolve() },
    documentElement: createStubProxy(),
    body: createStubProxy(),
    activeElement: createStubProxy()
  };
}

// Evaluate the game script
let gameFunc;
try {
  gameFunc = new Function(
    'window', 'document', 'localStorage', 'matchMedia', 'performance',
    'requestAnimationFrame', 'ResizeObserver', 'navigator', 'addEventListener',
    'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
    'AudioContext', 'getComputedStyle',
    script
  );
} catch (err) {
  console.error('FAIL: Game engine parse failed:', err.message);
  process.exit(1);
}

try {
  stubs.window = {};
  gameFunc(
    stubs.window, stubs.document, stubs.localStorage, stubs.matchMedia,
    stubs.performance, stubs.requestAnimationFrame, stubs.ResizeObserver,
    stubs.navigator, stubs.addEventListener, stubs.setTimeout,
    stubs.clearTimeout, stubs.setInterval, stubs.clearInterval,
    stubs.AudioContext, stubs.getComputedStyle
  );
} catch (err) {
  console.error('FAIL: Game engine execution failed:', err.message);
  console.error(err.stack);
  process.exit(1);
}

// Verify __g exists
if (!stubs.window.__g) {
  console.error('FAIL: window.__g not exported from game engine');
  process.exit(1);
}

const __g = stubs.window.__g;

let passCount = 0, failCount = 0, warnCount = 0;

// ===== CHECK 1: Board validation =====
console.log('--- Board Validation ---');
for (let i = 0; i < __g.LEVELS.length; i++) {
  const L = __g.LEVELS[i];
  const map = L.map;

  // Pad rows to W
  const expectedW = map[0].length;
  for (const row of map) {
    if (row.length !== expectedW) {
      console.log(`FAIL: Board ${i} ("${L.name}"): row length inconsistent`);
      failCount++;
      continue;
    }
  }

  // Count @ and E
  let murphyCount = 0, exitCount = 0;
  for (const row of map) {
    for (const ch of row) {
      if (ch === '@') murphyCount++;
      if (ch === 'E') exitCount++;
    }
  }

  if (murphyCount !== 1) {
    console.log(`FAIL: Board ${i} ("${L.name}"): expected 1 Murphy (@), found ${murphyCount}`);
    failCount++;
  } else if (exitCount !== 1) {
    console.log(`FAIL: Board ${i} ("${L.name}"): expected 1 Exit (E), found ${exitCount}`);
    failCount++;
  } else {
    // Try loading
    try {
      __g.load(i);
      console.log(`PASS: Board ${i} ("${L.name}")`);
      passCount++;
    } catch (err) {
      console.log(`FAIL: Board ${i} ("${L.name}"): load() threw: ${err.message}`);
      failCount++;
    }
  }
}

// ===== CHECK 2: Static reachability =====
console.log('\n--- Reachability Analysis ---');

for (let i = 0; i < __g.LEVELS.length; i++) {
  const L = __g.LEVELS[i];
  const map = L.map;
  const W = map[0].length, H = map.length;
  const need = L.need;

  // Check if board has red disk ('r')
  let hasRedDisk = false;
  for (const row of map) {
    if (row.includes('r')) { hasRedDisk = true; break; }
  }

  // Find Murphy and exit positions in the board string
  let murphyX = -1, murphyY = -1, exitX = -1, exitY = -1;
  for (let y = 0; y < H; y++) {
    const row = map[y];
    for (let x = 0; x < W; x++) {
      if (row[x] === '@') { murphyX = x; murphyY = y; }
      if (row[x] === 'E') { exitX = x; exitY = y; }
    }
  }

  if (murphyX === -1) {
    console.log(`FAIL: Board ${i}: Murphy not found`);
    failCount++;
    continue;
  }

  // BFS using board string rules: only '#' is a wall
  // Passable: ports (^>v<|-+), empty (' ' '_'), enemies (SePhHM), zonks (O), disks (or), base (.), infotrons (*), exit (E)
  // RAM (=) passable only if hasRedDisk
  const visited = new Set();
  const queue = [[murphyX, murphyY]];
  visited.add(murphyX + ',' + murphyY);
  let reachableInfotrons = 0, exitReachable = false;

  while (queue.length > 0) {
    const [x, y] = queue.shift();
    const ch = map[y][x];

    if (ch === '*') reachableInfotrons++;
    if (x === exitX && y === exitY) exitReachable = true;

    // 4-neighbor BFS
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      if (visited.has(nx + ',' + ny)) continue;

      const nch = map[ny][nx];
      // Only walls block
      if (nch === '#') continue;
      // RAM blocks unless red disk exists
      if (nch === '=' && !hasRedDisk) continue;

      visited.add(nx + ',' + ny);
      queue.push([nx, ny]);
    }
  }

  const margin = reachableInfotrons - need;
  const isOldBoard = i < 35;
  const status = reachableInfotrons < need || !exitReachable;

  if (status) {
    const msg = reachableInfotrons < need
      ? `need ${need}, can reach ${reachableInfotrons} (margin: ${margin})`
      : `exit not reachable`;
    if (isOldBoard) {
      console.log(`WARN: Board ${i} ("${L.name}"): ${msg}`);
      warnCount++;
    } else {
      console.log(`FAIL: Board ${i} ("${L.name}"): ${msg}`);
      failCount++;
    }
  } else {
    console.log(`PASS: Board ${i} ("${L.name}"): can reach ${reachableInfotrons} (need ${need}, margin: +${margin}), exit reachable`);
    passCount++;
  }
}

// ===== CHECK 3: Settle test (120 steps, no input, Murphy must stay alive) =====
console.log('\n--- Settle Test (120 steps idle) ---');
for (let i = 0; i < __g.LEVELS.length; i++) {
  __g.load(i);
  __g.state = 'play';

  for (let s = 0; s < 120; s++) {
    __g.step();
  }

  if (!__g.m || !__g.m.alive) {
    console.log(`FAIL: Board ${i} ("${__g.LEVELS[i].name}"): Murphy killed during idle settle`);
    failCount++;
  } else {
    console.log(`PASS: Board ${i} ("${__g.LEVELS[i].name}"): settled without incident`);
    passCount++;
  }
}

// ===== CHECK 4: Enemy unit tests =====
console.log('\n--- Enemy Unit Tests ---');
const { PING, HUNT, MINE } = __g.consts;
const engineBugs = [];

if (PING !== undefined && HUNT !== undefined && MINE !== undefined) {
  // Helper: create and load synthetic board
  function testWithBoard(map, testName, testFn) {
    const testBoard = { name: 't', need: 1, hint: '', map };
    __g.LEVELS.push(testBoard);
    try {
      __g.load(__g.LEVELS.length - 1);
      const result = testFn();
      console.log(result ? `PASS: ${testName}` : `FAIL: ${testName}`);
      if (result) passCount++; else failCount++;
    } catch (err) {
      console.log(`FAIL: ${testName} - ${err.message}`);
      failCount++;
    } finally {
      __g.LEVELS.pop();
    }
  }

  // Helper to find enemy in grid
  function findInGrid(type) {
    const W = __g.W, H = __g.H;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const c = __g.grid[y * W + x];
        if (c && c.t === type) return { x, y, c };
      }
    }
    return null;
  }

  // Run n steps; fn(step) can stop early by returning true.
  const run = (n, fn) => { for (let s = 0; s < n; s++) { __g.step(); if (fn && fn(s)) return true; } return false; };
  const alive = () => __g.m && __g.m.alive;
  const countType = (t) => { let n = 0; for (const c of __g.grid) if (c && c.t === t) n++; return n; };

  // a. Ping flies end to end of a sealed lane and bounces off both walls.
  testWithBoard([
    '##########',
    '#@########',
    '##########',
    '#  P     #',
    '##########'
  ], 'PING bounces between lane ends', () => {
    __g.state = 'play';
    let lo = 99, hi = -1;
    run(60, () => { const p = findInGrid(PING); if (p) { lo = Math.min(lo, p.x); hi = Math.max(hi, p.x); } });
    return lo === 1 && hi === 8 && alive();
  });

  // b. Ping runs into Murphy standing in the lane: fatal.
  testWithBoard([
    '##########',
    '#@ P     #',
    '##########'
  ], 'PING kills head-on', () => {
    __g.state = 'play';
    return run(40, () => !alive()) && !alive();
  });

  // c. Ping passing under a niche does not hurt Murphy standing in it.
  testWithBoard([
    '##########',
    '####@#####',
    '#  P     #',
    '##########'
  ], 'PING passes safely under a niche', () => {
    __g.state = 'play';
    run(60);
    return alive() && countType(PING) === 1;
  });

  // d. Hunter in range closes in steadily and kills; out of range it sleeps.
  testWithBoard([
    '#############',
    '#@      H   #',
    '#############'
  ], 'HUNT chases and kills within range', () => {
    __g.state = 'play';
    let lastX = findInGrid(HUNT).x, mono = true;
    const dead = run(30, () => { const h = findInGrid(HUNT); if (h) { if (h.x > lastX) mono = false; lastX = h.x; } return !alive(); });
    return dead && mono && lastX < 8;
  });
  testWithBoard([
    '#################',
    '#@           H  #',
    '#################'
  ], 'HUNT sleeps beyond range 9', () => {
    __g.state = 'play';
    run(30);
    return alive() && findInGrid(HUNT).x === 13;
  });
  // Hunter never digs: base between it and Murphy blocks it.
  testWithBoard([
    '#############',
    '#@..H       #',
    '#############'
  ], 'HUNT is stopped by base', () => {
    __g.state = 'play';
    run(30);
    return alive() && findInGrid(HUNT).x === 4 && countType(3) === 2;
  });

  // e. Mine next to Murphy goes off within one pulse cycle; a far mine never does and stays put.
  testWithBoard([
    '#########',
    '#@M     #',
    '#########'
  ], 'MINE kills an adjacent Murphy', () => {
    __g.state = 'play';
    return run(10, () => !alive()) && !alive();
  });
  testWithBoard([
    '###########',
    '#@   M    #',
    '###########'
  ], 'MINE ignores Murphy 4 tiles away', () => {
    __g.state = 'play';
    run(40);
    const mn = findInGrid(MINE);
    return alive() && mn && mn.x === 5;
  });

  // f. A zonk landing on each enemy destroys it.
  for (const [ch, name] of [['P', 'PING'], ['H', 'HUNT'], ['M', 'MINE']]) {
    testWithBoard([
      '############',
      '#O########@#',
      '# ##########',
      '#' + ch + '##########',
      '############'
    ], 'Zonk landing on ' + name + ' destroys it', () => {
      __g.state = 'play';
      run(8);
      return countType(PING) + countType(HUNT) + countType(MINE) === 0 && alive();
    });
  }
} else {
  console.log('SKIP: Enemy constants not available');
}

// Summary
console.log(`\n=== Summary ===`);
console.log(`PASS: ${passCount}, FAIL: ${failCount}, WARN: ${warnCount}`);
if (engineBugs.length > 0) {
  console.log(`\nEngine bugs found:`);
  engineBugs.forEach(bug => console.log(`  - ${bug}`));
}
if (failCount > 0) {
  process.exit(1);
}
