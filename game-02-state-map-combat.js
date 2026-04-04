// ====== Game State ======
const state = {
  floor:1,
  size: {w:100,h:100}, // Increased from 64x64 to 84x84
  tiles: [],          // 0 wall, 1 floor, 2 door, 3 chest, 4 stairs, 5 pickup
  rooms: [],
  corridor: new Set(),
  seen:new Set(),
    player:{
  x:0,y:0,hp:20,hpMax:20,mp:10,mpMax:10,level:1,xp:0,next:PLAYER_XP_START,
  weapon:{name:'Fists',min:1,max:2,type:'hand',base:{min:1,max:2},dur:null,durMax:null},
  poisoned:false, poisonTicks:0,
  facing:'down',
  bow:{ range:5, loaded:0 }     // ← NEW: starts unloaded; you have a bow on day one
},
    gameOver: false,
lockedDoors: new Set(),

  skills:{},          // type -> {lvl, xp, next, shown}
  enemies:[],         // {x,y,size,type,hp,atk:[a,b],xp,boss?}
  inventory:{ lockpicks:0, potions:0, tonics:0, antidotes:0, weapons:{}, arrows:0, gold:0 },
 // weapons counts
  spells:[],          // learned spells
  equippedSpell:null,          // currently equipped spell (object or null)
  spellUpgrades:{},     // { SpellName: { dmg:0..5, range:0..5, shards:0.. } }
  pickups:{},         // key(x,y) -> {kind, payload}
  fovRadius:5,
  _log:[],
  _hitParity:0,
  _shieldParity:0, // counts successful hits; durability -1 on every second success

// simple travelling FX (magic bolts / arrows)
  projectiles: [],
  _projectileAnimating: false,
  floatingText: [], 
  particles: [] // NEW: Visual particle effects (blood, dust, etc)
};

state.ui = state.ui || {};
state.ui.invTab = state.ui.invTab || 'items';


const logEl = document.getElementById('log');

function renderLog(){
  if (!logEl) return;
  logEl.innerHTML = '';
  // Loop through the state array and create the text lines
  for(const line of state._log){
    const d = document.createElement('div');
    // If the line is an object {text, color}, use those; otherwise treat as string
    if (typeof line === 'object') {
      d.textContent = String(line.text);
      if (line.color) d.style.color = line.color;
    } else {
      d.textContent = String(line);
    }
    logEl.appendChild(d);
  }
  // Keep the scrollbar at the bottom
  logEl.scrollTop = logEl.scrollHeight;
}

function log(s, color = null){
  // Support both simple strings and colored messages
  const entry = color ? { text: s, color: color } : s;
  
  state._log.push(entry);
  
  // CAP THE LOG: Lowered from 150 to 50 for better performance and usability
  if(state._log.length > 39) {
    state._log.shift();
  }
  
  renderLog();
}

function inBounds(x,y){return x>=0 && y>=0 && x<state.size.w && y<state.size.h}

function findFreeFloorTile(minDistFromPlayer = 2){
  for (let pass = 0; pass < 2; pass++){                   // pass 0: random in any room; pass 1: scan rooms
    // random tries first
    for (let t = 0; t < 800; t++){
      const r = state.rooms[rand(0, state.rooms.length-1)];
      if (!r) break;
      const x = rand(r.x+1, r.x+r.w-2), y = rand(r.y+1, r.y+r.h-2);
      if (!inBounds(x,y)) continue;
      if (state.tiles[y][x] !== 1) continue;              // must be floor
      if (enemyAt(x,y)) continue;
      if (dist(x,y,state.player.x,state.player.y) < minDistFromPlayer) continue;
      return {x,y};
    }
    // deterministic scan as a guaranteed fallback
    for (const r of state.rooms){
      for (let y = r.y+1; y < r.y+r.h-1; y++){
        for (let x = r.x+1; x < r.x+r.w-1; x++){
          if (!inBounds(x,y)) continue;
          if (state.tiles[y][x] !== 1) continue;
          if (enemyAt(x,y)) continue;
          if (dist(x,y,state.player.x,state.player.y) < minDistFromPlayer) continue;
          return {x,y};
        }
      }
    }
  }
  return null;
}


function enemyAt(x,y){
  for(const e of state.enemies){
    const s = e.size||1;
    if(x>=e.x && x<e.x+s && y>=e.y && y<e.y+s) return e;
  }
  return null;
}
function isPassableForPlayer(x,y){
  const t=state.tiles[y][x];
  if(enemyAt(x,y)) return false; // cannot pass through enemies

  // NEW: NPCs occupy floor tiles, so block walking through them
  if (typeof isMerchantTile === 'function' && isMerchantTile(x,y)) return false;
  if (typeof isBlacksmithTile === 'function' && isBlacksmithTile(x,y)) return false;
  if (typeof isJesterTile === 'function' && isJesterTile(x,y)) return false;
  if (typeof isCartographerTile === 'function' && isCartographerTile(x,y)) return false;

  return (t===1 || t===4 || t===5); // floor, stairs, pickups
}
function enemyCanEnter(x,y){
  if (!inBounds(x,y)) return false;
  if (x===state.player.x && y===state.player.y) return false;
  if (enemyAt(x,y)) return false;

  const inSafe = (r,xx,yy)=> r && xx>=r.x && xx<r.x+r.w && yy>=r.y && yy<r.y+r.h;
  if (inSafe(state.safeRect,  x, y)) return false;
  if (inSafe(state.safeRect2, x, y)) return false;
  if (inSafe(state.safeRect3, x, y)) return false;
  if (inSafe(state.safeRect4, x, y)) return false; // NEW: cartographer safe-room protection
  
  // --- NEW: Block enemies from walking on the Cleric ---
  if (state.cleric && x === state.cleric.x && y === state.cleric.y) return false;

  // --- NEW: Block Golden Well (2x2) ---
  if (state.goldWell) {
     const w = state.goldWell;
     if (x >= w.x && x <= w.x+1 && y >= w.y && y <= w.y+1) return false;
  }

  const t = state.tiles[y][x];
  return t===1 || t===4;
}



// Single canonical Mimic spawner (keep this one)
function spawnMimic(x, y){
  const f   = state.floor|0;
  const hp  = 10 + Math.floor(f * 1.2);
  const atkMin = 2 + Math.floor(f/3);
  const atkMax = 4 + Math.floor(f/2);
  const xp  = 12 + Math.floor(f * 1.5);

  state.enemies.push({
    x, y, size:1, boss:false,
    type:'Mimic',
    hp,
    atk:[atkMin, atkMax],
    xp,
    fast:(f >= 6)
  });
}


function dist(a,b,c,d){return Math.abs(a-c)+Math.abs(b-d)}

// Custom names per boss type
const BOSS_NAMES = {
  Rat:      'The Rat King',
  Bat:      'Count Fang',
  Spider:   'Broodmother',
  Slime:    'Sir Squish',
  Goblin:   'Throngler',
  Skeleton: 'Mr. Humerus',
  Mage:     'Archon of Ash',
  Clone:    'Your Shadow' // floor 50 clone; change as you like
};

// Fallback to "<type> Boss" if you forget one
function getBossName(type){
  return BOSS_NAMES[type] || `${type} Boss`;
}


// ====== Map Gen ======
function gen(){
   state.noFog = false;
   
   // Apply Cursed Descent flag from previous floor
   state.cursedFloor = state.nextFloorCursed || false;
   state.nextFloorCursed = false; // Reset for next time
   if (state.cursedFloor) showBanner("The air is heavy here... (Cursed Floor: +50% Enemy Dmg, 2x Drops)", 4500);

   // FIX: Reset boss/event flags so new floors can trigger them again
   state._bossStairsSpawned = false;
   
  const W=state.size.w,H=state.size.h;
  state.tiles = Array.from({length:H},()=>Array.from({length:W},()=>0));
  state.rooms=[]; state.corridor=new Set(); state.seen=new Set();
  state.enemies=[]; state.pickups={};
 state.props={}; // <--- NEW: Init props
  state.lockedDoors = new Set();     // ← reset per-floor
  state.puzzleDoors = new Set();
  state._starterChest = null;        // ← avoid stale pointer
  
  delete state._pendingOmen;         // <--- FIX: Ensure Omen flag resets every floor

// HARD RESET NPCs *before* any early return (boss floors)
state.merchant   = null;
state.blacksmith = null;
state.jester     = null;
state.cartographer = null;          // NEW
state.safeRect   = null;
state.safeRect2  = null;
state.safeRect3  = null;
state.safeRect4  = null;            // NEW

// ✅ reset jester-per-floor usage
state.jesterSpun = false;

// NEW: Cartographer/map state reset (important for boss-floor early return)
state.cartographerMapBought   = false;
state.cartographerMapActive   = false;
state.cartographerArrowTarget = null;

stopMerchantAudio?.();
stopBlacksmithAudio?.();
stopJesterAudio?.();
stopCartographerAudio?.();





  // Boss floors are a single room with just the boss
if(state.floor % 10 === 0){
  const rw = Math.max(12, Math.floor(W*0.6));
  const rh = Math.max(12, Math.floor(H*0.6));
  const rx = Math.floor((W - rw)/2);
  const ry = Math.floor((H - rh)/2);

  for(let y=ry;y<ry+rh;y++) for(let x=rx;x<rx+rw;x++) state.tiles[y][x]=1;
  state.rooms=[{x:rx,y:ry,w:rw,h:rh}];
  state.player.x = rx + 3;
  state.player.y = ry + Math.floor(rh/2);

// turn off fog for boss floors and pre-reveal the whole boss room
state.noFog = true;
for (let y = ry; y < ry + rh; y++) {
  for (let x = rx; x < rx + rw; x++) {
    state.seen.add(key(x,y));
    
    // --- NEW: Throne Room Columns (Floor 50 only) ---
    // FIX: Only generate pillars in Classic Mode (for the cutscene)
    if (state.floor === 50 && state.gameMode === 'classic') {
      // Create pillars in a grid pattern (every 4th tile)
      // Keep center clear for the cutscene walking
      const relX = x - rx;
      const relY = y - ry;
      
      // Safety lane in the middle (height/2)
      const isCenterLane = Math.abs(relY - Math.floor(rh/2)) < 2;
      
      if (!isCenterLane && relX > 2 && relX < rw-2 && relX % 4 === 0 && relY % 3 === 0) {
        state.tiles[y][x] = 8; // Solid obstacle (Pillar)
        // Optional: Assign a prop look if you want specific pillar art
        if(!state.props) state.props = {};
        state.props[key(x,y)] = { type: 'pillar' }; 
      }
    }
    // ------------------------------------------------
  }
}



  // === BOSSES ===
// If floor 50, spawn a clone of the player; otherwise randomize a boss archetype.
let placed = false, guard = 0;
while (!placed && guard < 300){
  guard++;
  const bx = rand(rx+2, rx+rw-3);
  const by = rand(ry+2, ry+rh-3);
  if (dist(bx,by,state.player.x,state.player.y) < 10) continue;
  if (state.tiles[by][bx]!==1 || state.tiles[by][bx+1]!==1 || state.tiles[by+1][bx]!==1 || state.tiles[by+1][bx+1]!==1) continue;

  let boss;

  // FIX: Only trigger the special scripted Clone boss in Classic Mode
  if (state.floor === 50 && state.gameMode === 'classic'){
    // --- 2×2 CLONE OF THE PLAYER ---
   const p = state.player;
const w = p.weapon || {min:1,max:2};

// depth-aware scaling knobs (mirrors boss math, but softened)
const f = state.floor|0;
const scale    = 1 + Math.max(0, f - 1) * 0.12;
const bossBump = (f % 10 === 0) ? 0.25 : 0;

// Compare player-based vs depth-based and take the tougher
const hpFromPlayer = Math.floor(p.hpMax * 1.6) + 20;           // beefed-up mirror
const hpFromDepth  = Math.round((24 + 4 * f) * (scale + bossBump));
const cloneHp      = Math.max(hpFromPlayer, Math.floor(hpFromDepth * 1.0)); // 22% of full boss HP

// ATK scales off your weapon but gets floor bonuses
const baseMin  = Math.max(1, w.min);
const baseMax  = Math.max(w.min + 1, w.max);
const cloneAtk = [baseMin + Math.floor(f / 4), baseMax + Math.floor(f / 3)];


    boss = {
    x: bx, y: by, size: 2, boss: true, xp: Math.round(60 * (1 + Math.max(0, (state.floor|0) - 1) * 0.10)),

    type: 'Clone',
    hp: cloneHp, atk: [cloneAtk[0], cloneAtk[1]],
    fast: !!(state.player.weapon?.type === 'two'),
    ranged: !!state.equippedSpell, range: 3,
    tint: 'hue-rotate(180deg) saturate(1.5) brightness(1.05)' // ← clone’s distinct look
  };

boss.hpMax = boss.hp;
boss.displayName = getBossName(boss.type);
 // change later if you like


  } else {
    // --- 2×2 BOSS FROM EXISTING MONSTER TYPES (with Endless extras) ---
const kinds = floorEnemyKinds();
const base  = kinds[Math.floor(Math.random() * kinds.length)];

const f = state.floor | 0;
const scale = 1 + Math.max(0, f - 1) * 0.12;
const bossBump = (f % 10 === 0) ? 0.25 : 0;
const hpBase = Math.round((24 + 4 * f) * (scale + bossBump));
const atkMin = base.atk[0] + Math.floor(f / 3);
const atkMax = base.atk[1] + Math.floor(f / 2);

let pickedSpecial = false;

// Endless only: fold the “non-cutscene Shadow and Mad King” into the rotation
if (state.gameMode === 'endless') {
  const r = Math.random();
  if (r < 0.15) {
    // Non-cutscene Shadow (Clone) — size 1, no cutscene
    boss = makeCloneBoss(bx, by);            // returns a boss-flagged 1×1
    pickedSpecial = true;
  } else if (r < 0.30) {
    // Non-cutscene Mad King — size 1, no cutscene
    boss = makeMadKing(bx, by);
    pickedSpecial = true;
  }
}

if (!pickedSpecial) {
  // Default: your existing 2×2 scaled “king” from a base species
  boss = {
    x: bx, y: by, size: 2, boss: true,
    xp: Math.round(30 * (1 + Math.max(0, (state.floor|0) - 1) * 0.10)),
    type: base.type,
    hp: hpBase, atk: [atkMin, atkMax],
    tint: randomBossTint()
  };
  boss.hpMax = boss.hp;
  boss.displayName = getBossName(boss.type);

  // Behaviors so it still feels like a big version of the species
  if (base.type === 'Rat')      boss.poisonChance = 0.40;
  if (base.type === 'Bat')      boss.vampiric = true; // handled in enemyStep by type check, but good for flags
  if (base.type === 'Spider')   boss.webChance = 1.0; 
  if (base.type === 'Goblin') { boss.fast = true; boss.stealChance = 0.40; }
  if (base.type === 'Slime')  { boss.slow = true; boss._skipMove = false; }
  if (base.type === 'Skeleton'){ boss._revived = false; }
  if (base.type === 'Mage')   { boss.ranged = true; boss.range = 3; }
}
  }

    if (state.gameMode === 'classic' &&
    state.floor === 50 &&
    !(state.flags && state.flags.depth50IntroDone)) {
  // Classic only: let the cutscene spawn the boss
  placed = true;
} else {
  state.enemies.push(boss);
  placed = true;
}


}

// ensure no safe-room NPCs remain on boss floors
state.merchant  = null;
state.blacksmith = null;
state.safeRect  = null;
state.safeRect2 = null;
if (typeof stopMerchantAudio   === 'function') stopMerchantAudio();
if (typeof stopBlacksmithAudio === 'function') stopBlacksmithAudio();

state.seen.add(state.player.x + ',' + state.player.y);
return;
}


  // --- rooms with occasional corner notch ---
  // Scale rooms slightly with floor depth (min 8, max 25)
  const roomCount = 8 + Math.min(17, Math.floor(state.floor / 2)); // Max rooms capped at 25
  let attempts=0;
  
  // NEW: Restrict normal room generation to the top-left 76x76 grid.
  // This guarantees the bottom-right corner (from 80,80 to 100,100) is a pure void reserved exclusively for Puzzle Dimensions.
  const genW = Math.min(W, 76);
  const genH = Math.min(H, 76);

  while(state.rooms.length<roomCount && attempts<1000){ 
    attempts++;
    const w=rand(6,12), h=rand(6,12);
    const x=rand(2,genW-w-3), y=rand(2,genH-h-3);
    let overlap=false;
    for(const r of state.rooms){
      if(!(x+w+2<r.x || y+h+2<r.y || x>r.x+r.w+2 || y>r.y+r.h+2)){overlap=true;break;}
    }
    if(!overlap){
      const r={x,y,w,h};
      state.rooms.push(r);
      for(let yy=y;yy<y+h;yy++) for(let xx=x;xx<x+w;xx++) state.tiles[yy][xx]=1;
      if(Math.random()<0.35){
        const nw=Math.max(1,Math.floor(w/4)), nh=Math.max(1,Math.floor(h/4));
        const cw=[0,w-1][Math.floor(Math.random()*2)];
        const ch=[0,h-1][Math.floor(Math.random()*2)];
        for(let dy=0;dy<nh;dy++){
          for(let dx=0;dx<nw;dx++){
            const tx = cw===0 ? x+dx : x+w-1-dx;
            const ty = ch===0 ? y+dy : y+h-1-dy;
            state.tiles[ty][tx]=0;
          }
        }
      }
    }
  }

  // Fallback: ensure at least one room exists so spawners have a target
if (state.rooms.length === 0) {
  const w = 10, h = 8;
  const x = Math.max(2, Math.floor(genW/2 - w/2));
  const y = Math.max(2, Math.floor(genH/2 - h/2));
  const r = { x, y, w, h };
  state.rooms.push(r);
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      state.tiles[yy][xx] = 1; // carve floor
    }
  }
}

  // --- connect rooms (guarantee degree >= 2) ---
  const centers = state.rooms.map(r=>({x:Math.floor(r.x+r.w/2),y:Math.floor(r.y+r.h/2)}));
  
  // NEW: Sort centers by X coordinate to encourage connecting neighbors first
  // This drastically reduces "cross-map" long corridors on early floors.
  centers.sort((a,b) => a.x - b.x);

  const used=[0]; const edges=[];
  while(used.length<centers.length){
    let best=null;
    for(const i of used){
      for(let j=0;j<centers.length;j++){
        if(used.includes(j)) continue;
        const d = dist(centers[i].x,centers[i].y,centers[j].x,centers[j].y);
        
        // NEW: Bias heavily against long corridors on early floors
        // If dist > 20 and we have few rooms, artificially inflate distance to discourage it
        let penalty = 1;
        if (state.rooms.length < 15 && d > 20) penalty = 3; 
        
        const weightedDist = d * penalty;

        if(!best || weightedDist < best.d) best={i,j,d: weightedDist, realD: d};
      }
    }
    used.push(best.j);
    edges.push([best.i,best.j]);
  }
  const deg = Array(centers.length).fill(0);
  edges.forEach(([a,b])=>{deg[a]++;deg[b]++;});
  for(let i=0;i<centers.length;i++){
    if(deg[i] >= 2) continue;
    let bestJ=-1, bestD=Infinity;
    for(let j=0;j<centers.length;j++){
      if(j===i) continue;
      const already = edges.some(e=>(e[0]===i&&e[1]===j)||(e[0]===j&&e[1]===i));
      if(already) continue;
      const d = dist(centers[i].x,centers[i].y,centers[j].x,centers[j].y);
      if(d<bestD){ bestD=d; bestJ=j; }
    }
    if(bestJ!==-1){ edges.push([i,bestJ]); deg[i]++; deg[bestJ]++; }
  }

  // carve all corridors
  function carveCorr(x1,y1,x2,y2){
    let x=x1,y=y1;
    const dx=Math.sign(x2-x1), dy=Math.sign(y2-y1);
    while(x!==x2){ state.tiles[y][x]=1; state.corridor.add(key(x,y)); x+=dx; }
    while(y!==y2){ state.tiles[y][x]=1; state.corridor.add(key(x,y)); y+=dy; }
    state.tiles[y][x]=1; state.corridor.add(key(x,y));
  }
  for(const [ai,bi] of edges){
    const a=centers[ai], b=centers[bi];
    if(Math.random()<0.5){
      carveCorr(a.x,a.y,b.x,a.y); carveCorr(b.x,a.y,b.x,b.y);
    }else{
      carveCorr(a.x,a.y,a.x,b.y); carveCorr(a.x,b.y,b.x,b.y);
    }
  }

// --- doors on corridor-room thresholds (narrow halls only, no clusters, never in rooms) ---
const Hm = H - 1, Wm = W - 1;
const doorChance = 0.30; // tune if you want more/fewer doors

function isWall(x,y){ return inBounds(x,y) && state.tiles[y][x] === 0; }
function isFloor(x,y){ return inBounds(x,y) && state.tiles[y][x] === 1; }
function inRoomCell(x,y){
  return state.rooms.some(r => x>=r.x && x<r.x+r.w && y>=r.y && y<r.y+r.h);
}

for (let y = 1; y < Hm; y++) for (let x = 1; x < Wm; x++) {
  // must be a corridor floor cell (not room interior)
  if (state.tiles[y][x] !== 1) continue;
  if (inRoomCell(x,y)) continue; // hard stop: don't place in rooms

  const kxy = x+','+y;
  if (!state.corridor.has(kxy)) continue;

  // must touch a room on exactly one side (a threshold)
  const rN = inRoomCell(x, y-1), rS = inRoomCell(x, y+1), rE = inRoomCell(x+1, y), rW = inRoomCell(x-1, y);
  const touchesRoom = (rN||rS||rE||rW) && !(rN&&rS) && !(rE&&rW);
  if (!touchesRoom) continue;

  // must be a 1-tile-wide hallway:
  // walls on L/R with floor N/S  OR  walls on U/D with floor E/W
  const narrowVertical   = isWall(x-1,y) && isWall(x+1,y) && isFloor(x,y-1) && isFloor(x,y+1);
  const narrowHorizontal = isWall(x,y-1) && isWall(x,y+1) && isFloor(x-1,y) && isFloor(x+1,y);
  if (!(narrowVertical || narrowHorizontal)) continue;

  // avoid door clusters
  let ok = true;
  for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[2,0],[-2,0],[0,2],[0,-2]]) {
    if (inBounds(x+dx,y+dy) && state.tiles[y+dy][x+dx] === 2) { ok = false; break; }
  }

  if (ENABLE_RANDOM_DOORS && ok && Math.random() < doorChance) {
  state.tiles[y][x] = 2;
  // ~50% of placed doors start locked (tweak as you like)
  if (Math.random() < 0.5) state.lockedDoors.add(x+','+y);
}

}


// remove any door not in a 1-tile-wide hallway (safety cleanup)
for (let y = 1; y < H-1; y++) for (let x = 1; x < W-1; x++) {
  if (state.tiles[y][x] !== 2) continue;
  const narrowV = state.tiles[y][x-1]===0 && state.tiles[y][x+1]===0 && state.tiles[y-1][x]===1 && state.tiles[y+1][x]===1;
  const narrowH = state.tiles[y-1][x]===0 && state.tiles[y+1][x]===0 && state.tiles[y][x-1]===1 && state.tiles[y][x+1]===1;
  if (!(narrowV || narrowH)) state.tiles[y][x] = 1;
}

// purge locks for any doors that got removed by cleanup
state.lockedDoors.forEach(k=>{
  const [dx,dy] = k.split(',').map(Number);
  if (state.tiles?.[dy]?.[dx] !== 2) state.lockedDoors.delete(k);
});

function ensurePathToStairsUnlocked(){
  // find stairs position
  let sx=-1, sy=-1;
  for(let y=0;y<state.size.h;y++){
    for(let x=0;x<state.size.w;x++){
      if(state.tiles[y][x]===4){ sx=x; sy=y; break; }
    }
    if(sx!==-1) break;
  }
  if(sx===-1) return;

  const W=state.size.w, H=state.size.h;
  const q=[[state.player.x, state.player.y]];
  const seen=new Set([state.player.x+','+state.player.y]);
  const parent=new Map();

  const passable = (x,y)=>{
    if(!inBounds(x,y)) return false;
    const t = state.tiles[y][x];
    // treat doors as passable for search; we’ll open them afterwards
    return (t===1 || t===2 || t===3 || t===4 || t===5);
  };

  while(q.length){
    const [x,y]=q.shift();
    if(x===sx && y===sy) break;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx, ny=y+dy, k=nx+','+ny;
      if(seen.has(k) || !passable(nx,ny)) continue;
      seen.add(k); parent.set(k, x+','+y); q.push([nx,ny]);
    }
  }

  // backtrack stairs → start and open any door tiles on the path
  let k = sx+','+sy;
  while(k && parent.has(k)){
    const [px,py] = k.split(',').map(Number);
    if(state.tiles[py][px]===2){
      state.tiles[py][px]=1;           // open permanently
      state.lockedDoors.delete(k);     // remove lock if any
    }
    k = parent.get(k);
  }
}




 // --- spawn point ---
const startRoom = state.rooms[0];
state.player.x = Math.floor(startRoom.x+startRoom.w/2);
state.player.y = Math.floor(startRoom.y+startRoom.h/2);

// keep a reference to the current floor's spawn room
state.startRoom = startRoom;

// a padded rectangle inside the start room that enemies can NEVER spawn in
const pad = 1; // keep 1 tile of padding from walls; tweak if you like
state.spawnRect = {
  x1: startRoom.x + pad,
  y1: startRoom.y + pad,
  x2: startRoom.x + startRoom.w - 1 - pad,
  y2: startRoom.y + startRoom.h - 1 - pad,
};

// tiny helper
function inSpawnRect(x, y){
  const r = state.spawnRect;
  return r && x >= r.x1 && x <= r.x2 && y >= r.y1 && y <= r.y2;
}


// --- stairs in farthest room center ---
let farIdx=0, farD=-1;
for(let i=0;i<state.rooms.length;i++){
  const c={x:Math.floor(state.rooms[i].x+state.rooms[i].w/2), y:Math.floor(state.rooms[i].y+state.rooms[i].h/2)};
  const d=dist(c.x,c.y,state.player.x,state.player.y);
  if(d>farD){farD=d; farIdx=i;}
}
const rr=state.rooms[farIdx];
const sx=Math.floor(rr.x+rr.w/2), sy=Math.floor(rr.y+rr.h/2);
state.tiles[sy][sx] = 4;
// remember the room that contains the stairs (for spawn exclusions)
state._stairsRoom = rr;



// --- starter chest only on floor 1 adjacent ---
if (state.floor===1){
  const adj = shuffle([[1,0],[-1,0],[0,1],[0,-1]]);
  for (const [dx,dy] of adj){
    const x=state.player.x+dx, y=state.player.y+dy;
    if (inBounds(x,y) && state.tiles[y][x]===1){
      state.tiles[y][x]=3;
      state._starterChest = x + ',' + y;   // <— mark the starter chest coords
      break;
    }
  }
}

state.mimicChests = new Set();
  state.redChests = new Map(); state.redChestEvent = null;

  // (Moved Red Chest logic to end of gen() so it detects NPCs correctly)

  // --- Puzzle Rooms (Pocket Dimensions) ---
  state.puzzleRooms = new Set();
  state.boulderPuzzleActive = false;
  state.icePuzzleActive = false;

  window.generatePuzzleArea = function(puzzleType, diff) {
      const r = { x: 80, y: 80, w: 13, h: 13 }; // Increased room size for more boulder space
      state.puzzleRooms.add(r);
      
      // Cleanup a large fixed block to ensure no old puzzle walls or ice remains
      for(let y=78; y<102; y++){
          for(let x=78; x<102; x++){
              if (inBounds(x,y)) {
                  if (!state.tiles[y]) state.tiles[y] = [];
                  state.tiles[y][x] = 0; 
                  delete state.props[key(x,y)];
                  delete state.pickups[key(x,y)];
              }
          }
      }
      
      // Paint the frame for the specific room dimensions
      for(let y=r.y; y<r.y+r.h; y++){
          for(let x=r.x; x<r.x+r.w; x++){
              state.tiles[y][x] = (x === r.x || x === r.x+r.w-1 || y === r.y || y === r.y+r.h-1) ? 0 : 1;
          }
      }

      const midX = Math.floor(r.x + r.w / 2);
      const spawnY = r.y + r.h - 3; 

      const chasmY = r.y + 2;
      const noteY = r.y + 1;
      for (let x = r.x + 1; x < r.x + r.w - 1; x++) state.tiles[chasmY][x] = 15;

      const d = (diff !== null && diff !== undefined) ? diff : rand(0, 16); 
      let pPos = [], bPos = [], walls = [];
      if (d === 0) { pPos = [[r.x+4, r.y+4], [r.x+6, r.y+4], [r.x+8, r.y+4]]; bPos = [[r.x+4, r.y+8], [r.x+8, r.y+8], [r.x+6, r.y+9]]; walls = [[r.x+4, r.y+6], [r.x+5, r.y+6], [r.x+7, r.y+6], [r.x+8, r.y+6], [r.x+6, r.y+5], [r.x+6, r.y+7]]; }
      else if (d === 1) { pPos = [[r.x+6, r.y+3], [r.x+5, r.y+4], [r.x+7, r.y+4]]; bPos = [[r.x+5, r.y+8], [r.x+7, r.y+8], [r.x+6, r.y+9]]; walls = [[r.x+6, r.y+5], [r.x+6, r.y+6], [r.x+6, r.y+7], [r.x+5, r.y+5], [r.x+7, r.y+5], [r.x+4, r.y+7], [r.x+8, r.y+7]]; }
      else if (d === 2) { pPos = [[r.x+6, r.y+3], [r.x+5, r.y+4], [r.x+7, r.y+4]]; bPos = [[r.x+4, r.y+8], [r.x+8, r.y+8], [r.x+6, r.y+9]]; walls = [[r.x+5, r.y+7], [r.x+6, r.y+7], [r.x+7, r.y+7], [r.x+4, r.y+5], [r.x+5, r.y+5], [r.x+7, r.y+5], [r.x+8, r.y+5]]; }
      else if (d === 3) { pPos = [[r.x+3, r.y+4], [r.x+4, r.y+4], [r.x+8, r.y+4], [r.x+9, r.y+4]]; bPos = [[r.x+4, r.y+8], [r.x+6, r.y+8], [r.x+8, r.y+8], [r.x+6, r.y+9]]; walls = [[r.x+5, r.y+6], [r.x+6, r.y+6], [r.x+7, r.y+6], [r.x+5, r.y+7], [r.x+7, r.y+7], [r.x+5, r.y+5], [r.x+7, r.y+5]]; }
      else if (d === 4) { pPos = [[r.x+5, r.y+4], [r.x+6, r.y+4], [r.x+5, r.y+5], [r.x+6, r.y+5]]; bPos = [[r.x+4, r.y+8], [r.x+6, r.y+8], [r.x+8, r.y+8], [r.x+5, r.y+9]]; walls = [[r.x+4, r.y+6], [r.x+5, r.y+6], [r.x+7, r.y+6], [r.x+8, r.y+6], [r.x+4, r.y+7], [r.x+8, r.y+7], [r.x+7, r.y+4], [r.x+4, r.y+4]]; }
      else if (d === 5) { pPos = [[r.x+4, r.y+3], [r.x+8, r.y+3], [r.x+4, r.y+5], [r.x+8, r.y+5]]; bPos = [[r.x+3, r.y+8], [r.x+5, r.y+8], [r.x+7, r.y+8], [r.x+9, r.y+8]]; walls = [[r.x+6, r.y+4], [r.x+6, r.y+5], [r.x+6, r.y+6], [r.x+6, r.y+7], [r.x+6, r.y+8], [r.x+4, r.y+7], [r.x+8, r.y+7]]; }
      else if (d === 6) { pPos = [[r.x+5, r.y+3], [r.x+7, r.y+3], [r.x+5, r.y+4], [r.x+7, r.y+4]]; bPos = [[r.x+4, r.y+8], [r.x+8, r.y+8], [r.x+5, r.y+9], [r.x+7, r.y+9]]; walls = [[r.x+6, r.y+4], [r.x+6, r.y+5], [r.x+6, r.y+6], [r.x+6, r.y+7], [r.x+4, r.y+6], [r.x+5, r.y+6], [r.x+7, r.y+6], [r.x+8, r.y+6]]; }
      else if (d === 7) { pPos = [[r.x+4, r.y+4], [r.x+5, r.y+4], [r.x+6, r.y+4], [r.x+6, r.y+5]]; bPos = [[r.x+4, r.y+8], [r.x+6, r.y+8], [r.x+8, r.y+8], [r.x+7, r.y+9]]; walls = [[r.x+5, r.y+6], [r.x+6, r.y+6], [r.x+7, r.y+6], [r.x+7, r.y+7], [r.x+7, r.y+8], [r.x+5, r.y+5], [r.x+4, r.y+7]]; }
      else if (d === 8) { pPos = [[r.x+3, r.y+3], [r.x+4, r.y+3], [r.x+5, r.y+3], [r.x+3, r.y+4], [r.x+4, r.y+4]]; bPos = [[r.x+4, r.y+8], [r.x+6, r.y+8], [r.x+8, r.y+8], [r.x+5, r.y+9], [r.x+7, r.y+9]]; walls = [[r.x+6, r.y+4], [r.x+6, r.y+5], [r.x+6, r.y+6], [r.x+7, r.y+6], [r.x+8, r.y+6], [r.x+4, r.y+7], [r.x+5, r.y+7]]; }
      else if (d === 9) { pPos = [[r.x+4, r.y+4], [r.x+5, r.y+4], [r.x+6, r.y+4], [r.x+7, r.y+4], [r.x+8, r.y+4]]; bPos = [[r.x+3, r.y+8], [r.x+5, r.y+8], [r.x+7, r.y+8], [r.x+9, r.y+8], [r.x+6, r.y+9]]; walls = [[r.x+4, r.y+6], [r.x+5, r.y+6], [r.x+7, r.y+6], [r.x+8, r.y+6], [r.x+4, r.y+7], [r.x+8, r.y+7]]; }
      else if (d === 10) { pPos = [[r.x+4, r.y+3], [r.x+6, r.y+3], [r.x+8, r.y+3], [r.x+5, r.y+4], [r.x+7, r.y+4]]; bPos = [[r.x+3, r.y+8], [r.x+5, r.y+8], [r.x+7, r.y+8], [r.x+9, r.y+8], [r.x+6, r.y+9]]; walls = [[r.x+3, r.y+6], [r.x+4, r.y+6], [r.x+5, r.y+6], [r.x+7, r.y+6], [r.x+8, r.y+6], [r.x+9, r.y+6], [r.x+5, r.y+7], [r.x+7, r.y+7]]; }
      else if (d === 11) { pPos = [[r.x+4, r.y+3], [r.x+6, r.y+3], [r.x+8, r.y+3], [r.x+4, r.y+5], [r.x+6, r.y+5], [r.x+8, r.y+5]]; bPos = [[r.x+3, r.y+8], [r.x+5, r.y+8], [r.x+7, r.y+8], [r.x+9, r.y+8], [r.x+4, r.y+9], [r.x+8, r.y+9]]; walls = [[r.x+5, r.y+6], [r.x+7, r.y+6], [r.x+5, r.y+7], [r.x+7, r.y+7], [r.x+5, r.y+4], [r.x+7, r.y+4]]; }
      else if (d === 12) { pPos = [[r.x+3, r.y+3], [r.x+4, r.y+3], [r.x+5, r.y+3], [r.x+7, r.y+5], [r.x+8, r.y+5], [r.x+9, r.y+5]]; bPos = [[r.x+4, r.y+8], [r.x+6, r.y+8], [r.x+8, r.y+8], [r.x+5, r.y+9], [r.x+7, r.y+9], [r.x+9, r.y+9]]; walls = [[r.x+6, r.y+4], [r.x+6, r.y+5], [r.x+6, r.y+6], [r.x+6, r.y+7], [r.x+4, r.y+6], [r.x+8, r.y+7]]; }
      else if (d === 13) { pPos = [[r.x+5, r.y+4], [r.x+6, r.y+4], [r.x+7, r.y+4], [r.x+5, r.y+5], [r.x+6, r.y+5], [r.x+7, r.y+5]]; bPos = [[r.x+4, r.y+8], [r.x+6, r.y+8], [r.x+8, r.y+8], [r.x+3, r.y+9], [r.x+5, r.y+9], [r.x+7, r.y+9]]; walls = [[r.x+4, r.y+6], [r.x+5, r.y+6], [r.x+7, r.y+6], [r.x+8, r.y+6], [r.x+6, r.y+7], [r.x+4, r.y+7], [r.x+8, r.y+7]]; }
      else if (d === 14) { pPos = [[r.x+3, r.y+4], [r.x+4, r.y+4], [r.x+5, r.y+4], [r.x+6, r.y+4], [r.x+7, r.y+4], [r.x+8, r.y+4], [r.x+9, r.y+4]]; bPos = [[r.x+3, r.y+8], [r.x+5, r.y+8], [r.x+7, r.y+8], [r.x+9, r.y+8], [r.x+4, r.y+9], [r.x+6, r.y+9], [r.x+8, r.y+9]]; walls = [[r.x+4, r.y+6], [r.x+6, r.y+6], [r.x+8, r.y+6], [r.x+5, r.y+7], [r.x+7, r.y+7], [r.x+4, r.y+5], [r.x+8, r.y+5]]; }
      else if (d === 15) { pPos = [[r.x+5, r.y+3], [r.x+6, r.y+3], [r.x+7, r.y+3], [r.x+4, r.y+4], [r.x+8, r.y+4], [r.x+5, r.y+5], [r.x+7, r.y+5]]; bPos = [[r.x+3, r.y+8], [r.x+5, r.y+8], [r.x+7, r.y+8], [r.x+9, r.y+8], [r.x+4, r.y+9], [r.x+6, r.y+9], [r.x+8, r.y+9]]; walls = [[r.x+4, r.y+7], [r.x+6, r.y+7], [r.x+8, r.y+7], [r.x+5, r.y+6], [r.x+7, r.y+6], [r.x+6, r.y+5]]; }
      else { pPos = [[r.x+4, r.y+3], [r.x+6, r.y+3], [r.x+8, r.y+3], [r.x+5, r.y+4], [r.x+7, r.y+4], [r.x+4, r.y+5], [r.x+8, r.y+5]]; bPos = [[r.x+3, r.y+8], [r.x+5, r.y+8], [r.x+7, r.y+8], [r.x+9, r.y+8], [r.x+4, r.y+9], [r.x+6, r.y+9], [r.x+8, r.y+9]]; walls = [[r.x+3, r.y+6], [r.x+5, r.y+6], [r.x+7, r.y+6], [r.x+9, r.y+6], [r.x+4, r.y+7], [r.x+8, r.y+7], [r.x+6, r.y+7]]; }


      
      
      pPos.forEach(p => state.tiles[p[1]][p[0]] = 16);
      walls.forEach(w => { state.tiles[w[1]][w[0]] = 0; });
      bPos.forEach(b => { state.props[key(b[0], b[1])] = { type: 'boulder', underTile: 1 }; state.tiles[b[1]][b[0]] = 8; });

      state.boulderPuzzleActive = true;
      state.puzzleGateY = chasmY;
      state.puzzleRoomX = r.x + 1;
      state.puzzleRoomW = r.w - 2;
      state.puzzlePlatesCount = pPos.length;
      
      state.pickups[key(midX, noteY)] = { kind: 'lore', payload: { id: 'Note_'+rand(1,10), title: 'Ancient Fragment' } };
      state.tiles[noteY][midX] = 5;

      state.puzzleStartX = midX; state.puzzleStartY = spawnY;
      state.props[key(midX, spawnY + 1)] = { type: 'puzzle_exit' };
      state.tiles[spawnY + 1][midX] = 8;
  };

  
  // --- Shrines (tile 6) ---
ensurePathToStairsUnlocked(); 

if (state.gameMode === 'endless' || state.gameMode === 'classic') {
  let shrineCount = rand(1, 2); 
  const shrineRooms = new Set();

  while(shrineCount > 0){ 
    // Pick a random room index
    const roomIndex = rand(0, state.rooms.length-1);
    const r = state.rooms[roomIndex]; 

    if(!r) break; 
    
    // NEW: Skip this room if a shrine is already placed here
    if (shrineRooms.has(roomIndex)) {
        continue; // Try picking a new room index
    }
    
    // Pick a random tile within that room
    const x = rand(r.x+1, r.x+r.w-2); 
    const y = rand(r.y+1, r.y+r.h-2); 

    // Only place on empty floor tiles (t===1) and ensure no enemy is there 
    if(state.tiles[y][x] === 1 && !enemyAt(x,y)){ 
      state.tiles[y][x] = 6; // Place Shrine (Tile ID 6) 
      shrineCount--; 
      // NEW: Mark the room as used
      shrineRooms.add(roomIndex);
    } 
  }
}
// --- NEW: Spike Traps (Tile 7) ---
// Scale with floor: 2 traps at floor 1, up to 12 at floor 50
// --- NEW: Toggle Spikes (Tile 9) ---
  state.gameTurn = 0; // Reset turn timer on new floor
  state.stairsFoundTurn = 0; // Reset Reaper timer
  state.reaperSpawned = false; 

  let toggleCount = rand(3, 6) + Math.floor(state.floor / 4);
  let toggleSafe = 0;
  while(toggleCount > 0 && toggleSafe < 500){
    toggleSafe++;
    const r = state.rooms[rand(0, state.rooms.length-1)];
    if(!r) continue;
    const x = rand(r.x+1, r.x+r.w-2);
    const y = rand(r.y+1, r.y+r.h-2);
    // Must be floor, no enemies, no static traps, not start room
    if(state.tiles[y][x] === 1 && !enemyAt(x,y) && r !== state.startRoom){
      state.tiles[y][x] = 9; // Tile 9 = Toggle Spike
      toggleCount--;
    }
  }

  let trapCount = Math.min(12, 2 + Math.floor(state.floor / 5));
  let trapSafe = 0;
  while(trapCount > 0 && trapSafe < 500){
  trapSafe++;
  // Pick random room
  const r = state.rooms[rand(0, state.rooms.length-1)];
  if(!r) continue;
  
  // Pick spot
  const x = rand(r.x+1, r.x+r.w-2);
  const y = rand(r.y+1, r.y+r.h-2);
  
  // Check validity: must be floor, no enemies, not start room
  if(state.tiles[y][x] === 1 && !enemyAt(x,y) && r !== state.startRoom){
    state.tiles[y][x] = 7;
    trapCount--;
  }
}


// ===== Merchant & Blacksmith safe-room spawns =====
state.merchant = null;
  state.blacksmith = null;
  state.jester = null;
  state.cartographer = null;
  state.safeRect = null;
  state.safeRect2 = null;
  state.safeRect3 = null;
  state.safeRect4 = null;
  stopMerchantAudio();
stopBlacksmithAudio();
stopJesterAudio?.();
stopCartographerAudio?.();
stopClericAudio?.(); // <--- NEW

  // Cartographer/map state gets cleared every floor
  state.cartographerMapBought  = false;
  state.cartographerMapActive  = false;
  state.cartographerArrowTarget = null;

  let spawnedMerchant   = false;
  let spawnedBlacksmith = false;
  let spawnedJester     = false;
  let spawnedCartographer = false;
  let spawnedCleric     = false; // <--- NEW


if (state.gameMode !== 'tutorial' && state.floor % 10 !== 0 && Math.random() < MERCHANT_SPAWN_CHANCE){
  const rooms = state.rooms
  .slice(1)                                   // avoid start room
  .filter(r => r !== state._stairsRoom);      // NEW: never the stairs room
const pick  = rooms.length ? rooms[rand(0, rooms.length-1)] : null;

  if (pick){
    // safe room interior bounds
    const rx = pick.x+1, ry = pick.y+1;
    const rw = Math.max(1, pick.w-2), rh = Math.max(1, pick.h-2);

    // need at least 3 interior tiles horizontally
    if (rw >= 3){
      const cx = rand(rx+1, rx+rw-2); // center so left/right fit inside
      const cy = rand(ry,    ry+rh-1);

      state.merchant = {
  x: cx, y: cy,
  left:  { x: cx-1, y: cy },
  right: { x: cx+1, y: cy },
  room: { x: rx, y: ry, w: rw, h: rh },
  stock: null            // ← per-floor, filled on first Buy open
};

      state.safeRect = { x: rx, y: ry, w: rw, h: rh };
spawnedMerchant = true;
ensureMerchantAudio();

    }
  }
}

// ---- Blacksmith safe-room spawn (25%) — 3-wide: [anvil][smith][anvil]
if (state.gameMode !== 'tutorial' && state.floor % 10 !== 0 && Math.random() < BLACKSMITH_SPAWN_CHANCE){
  // Rooms eligible: not start, not stairs, and NOT the merchant's room
  const rooms2 = state.rooms
    .slice(1)
    .filter(r => r !== state._stairsRoom)
    .filter(r => {
      if (!state.merchant?.room) return true;
      // skip if this room's interior equals the merchant safe interior
      const rx = r.x+1, ry = r.y+1;
      const rw = Math.max(1, r.w-2), rh = Math.max(1, r.h-2);
      const mr = state.merchant.room;
      return !(rx===mr.x && ry===mr.y && rw===mr.w && rh===mr.h);
    });

  const pick2 = rooms2.length ? rooms2[rand(0, rooms2.length-1)] : null;
  if (pick2){
    const rx2 = pick2.x+1, ry2 = pick2.y+1;
    const rw2 = Math.max(1, pick2.w-2), rh2 = Math.max(1, pick2.h-2);
    if (rw2 >= 3){
      const cx2 = rand(rx2+1, rx2+rw2-2);
      const cy2 = rand(ry2,    ry2+rh2-1);

      state.blacksmith = {
        x: cx2, y: cy2,
        left:  { x: cx2-1, y: cy2 },
        right: { x: cx2+1, y: cy2 },
        room:  { x: rx2, y: ry2, w: rw2, h: rh2 }
      };

      state.safeRect2 = { x: rx2, y: ry2, w: rw2, h: rh2 };
      spawnedBlacksmith = true;
      ensureBlacksmithAudio();
    }
  }
}

// ---- Jester spawn (20% chance on non-boss floors) ----
if (state.gameMode === 'endless' && state.floor % 10 !== 0 && Math.random() < JESTER_SPAWN_CHANCE){
  // Eligible rooms: not start, not stairs, not merchant/blacksmith rooms
  const rooms3 = state.rooms
    .slice(1)
    .filter(r => r !== state._stairsRoom)
    .filter(r => {
      // skip merchant and blacksmith safe rooms
      const mr = state.merchant?.room, br = state.blacksmith?.room;
      const rx = r.x+1, ry = r.y+1;
      const rw = Math.max(1, r.w-2), rh = Math.max(1, r.h-2);
      if (mr && rx===mr.x && ry===mr.y && rw===mr.w && rh===mr.h) return false;
      if (br && rx===br.x && ry===br.y && rw===br.w && rh===br.h) return false;
      return true;
    });
  const pick3 = rooms3.length ? rooms3[rand(0, rooms3.length-1)] : null;
  if (pick3){
    const rx3 = pick3.x+1, ry3 = pick3.y+1;
    const rw3 = Math.max(1, pick3.w-2), rh3 = Math.max(1, pick3.h-2);
    if (rw3 >= 3){
      const cx3 = rand(rx3+1, rx3+rw3-2);
      const cy3 = rand(ry3,    ry3+rh3-1);
      state.jester = {
        x: cx3, y: cy3,
        left:  { x: cx3-1, y: cy3 },
        right: { x: cx3+1, y: cy3 },
        room:  { x: rx3, y: ry3, w: rw3, h: rh3 }
      };
      state.safeRect3 = { x: rx3, y: ry3, w: rw3, h: rh3 };
      spawnedJester = true;
      ensureJesterAudio();
    }
  }
}

// --- NEW: Gold Well (Rare 2x2 Prop) ---
// 25% Chance on non-boss floors (Can now co-exist with NPCs)
state.goldWell = null;
if (state.gameMode !== 'tutorial' && state.floor % 10 !== 0 && Math.random() < 0.25) {
  // Filter out rooms already taken by NPCs
  const availableRooms = state.rooms.slice(1).filter(r => 
      r !== state._stairsRoom &&
      r !== state.merchant?.room &&
      r !== state.blacksmith?.room &&
      r !== state.jester?.room
  );

  if (availableRooms.length > 0) {
      const r = availableRooms[rand(0, availableRooms.length-1)];
      if (r && r.w >= 4 && r.h >= 4) {
         const wx = Math.floor(r.x + r.w/2) - 1;
         const wy = Math.floor(r.y + r.h/2) - 1;
         
         // Helper to check a specific point against all NPCs
         const isBlocked = (x,y) => isMerchantTile(x,y) || isBlacksmithTile(x,y) || isJesterTile(x,y) || isCartographerTile(x,y);

         // Ensure all 4 tiles of the 2x2 well are free
         if (state.tiles[wy][wx]===1 && state.tiles[wy+1][wx+1]===1 &&
             !isBlocked(wx, wy) && !isBlocked(wx+1, wy) && 
             !isBlocked(wx, wy+1) && !isBlocked(wx+1, wy+1)) {
             
           state.goldWell = { x:wx, y:wy, used:false, room:r }; // Store room ref for later NPCs
           showBanner("A Golden Well shimmers nearby...", 4000); 
         }
      }
  }
}

// ---- Cartographer safe-room spawn ----
  if ((state.gameMode === 'endless' || state.gameMode === 'classic') && state.floor % 10 !== 0 && Math.random() < CARTOGRAPHER_SPAWN_CHANCE) {
    const rooms4 = state.rooms
      .slice(1)
      .filter(r => r !== state._stairsRoom)
      .filter(r => {
        const mr = state.merchant?.room;
        const br = state.blacksmith?.room;
        const jr = state.jester?.room;
        const rx = r.x+1, ry = r.y+1;
        const rw = Math.max(1, r.w-2), rh = Math.max(1, r.h-2);
        if (mr && rx===mr.x && ry===mr.y && rw===mr.w && rh===mr.h) return false;
        if (br && rx===br.x && ry===br.y && rw===br.w && rh===br.h) return false;
        if (jr && rx===jr.x && ry===jr.y && rw===jr.w && rh===jr.h) return false;
        // NEW: Don't spawn in the Gold Well's room
        if (state.goldWell?.room === r) return false;
        return true;
      });

    const pick4 = rooms4.length ? rooms4[rand(0, rooms4.length-1)] : null;
    if (pick4) {
      const rx4 = pick4.x+1, ry4 = pick4.y+1;
      const rw4 = Math.max(1, pick4.w-2), rh4 = Math.max(1, pick4.h-2);
      if (rw4 >= 3) {
        const cx4 = rand(rx4+1, rx4+rw4-2);
        const cy4 = rand(ry4,   ry4+rh4-1);
        state.cartographer = {
          x: cx4, y: cy4,
          left:  { x: cx4-1, y: cy4 },
          right: { x: cx4+1, y: cy4 },
          room:  { x: rx4, y: ry4, w: rw4, h: rh4 }
        };
        state.safeRect4 = { x: rx4, y: ry4, w: rw4, h: rh4 };
spawnedCartographer = true;
ensureCartographerAudio();
      }
    }
  }

  // --- NEW: Cleric Spawn (15% chance, non-boss floors) ---
  state.cleric = null; // Reset

  // FIX: Boost spawn chance if player carries Cursed Idols
  let cChance = 0.20;
  if (state.inventory.idols && Object.keys(state.inventory.idols).length > 0) cChance = 0.60;

  // RESTRICTED: Endless Mode only
if (state.gameMode === 'endless' && state.floor % 10 !== 0 && Math.random() < cChance) { 
     // Added check for state.goldWell?.room
     const rooms5 = state.rooms.slice(1).filter(r => 
        r !== state._stairsRoom && 
        !state.merchant?.room && 
        !state.blacksmith?.room && 
        !state.jester?.room && 
        !state.cartographer?.room &&
        r !== state.goldWell?.room
     );
     const pick5 = rooms5.length ? rooms5[rand(0, rooms5.length-1)] : null;
     
     if (pick5) {
       const cx = Math.floor(pick5.x + pick5.w/2);
       const cy = Math.floor(pick5.y + pick5.h/2);
       // Simple single tile spawn in center
       // FIX: Save 'room' so Red Chests/Events know this room is occupied
       state.cleric = { x:cx, y:cy, room:pick5 }; 
       spawnedCleric = true;
       ensureClericAudio();
     }
  }
  // ------------------------------------------------------

  // 10% Spawn Chance check (Moved here to properly avoid NPCs)
  if (state.rooms.length > 2 && Math.random() < 0.10) {
      const pCands = state.rooms.slice(1).filter(r => {
          if (r === state._stairsRoom || r === state.cleric?.room || r === state.goldWell?.room) return false;
          
          const rx = r.x+1, ry = r.y+1, rw = Math.max(1, r.w-2), rh = Math.max(1, r.h-2);
          const mr = state.merchant?.room, br = state.blacksmith?.room, jr = state.jester?.room, cr = state.cartographer?.room;
          
          if (mr && rx===mr.x && ry===mr.y && rw===mr.w && rh===mr.h) return false;
          if (br && rx===br.x && ry===br.y && rw===br.w && rh===br.h) return false;
          if (jr && rx===jr.x && ry===jr.y && rw===jr.w && rh===jr.h) return false;
          if (cr && rx===cr.x && ry===cr.y && rw===cr.w && rh===cr.h) return false;
          
          return true;
      });
      
      if (pCands.length > 0) {
          const entryRoom = pCands[rand(0, pCands.length - 1)];
          const portalX = Math.floor(entryRoom.x + entryRoom.w/2), portalY = Math.floor(entryRoom.y + entryRoom.h/2);
          state.props[key(portalX, portalY)] = { type: 'puzzle_portal' };
          state.tiles[portalY][portalX] = 8;
          
          state.puzzleEntryRoom = entryRoom; // Track for busy set

          generatePuzzleArea(0, null); // Always spawn boulder variations

          if (typeof window.playPuzzleMusic === 'function') window.playPuzzleMusic();
          log("An Ethereal Gateway has appeared somewhere on this floor...");
      }
  }

  // --- NEW: Cursed Spawns (Stairs & Red Chest) ---
  // We handle both here, AFTER NPCs spawn, to ensure they don't overlap.
  
  // 1. Build "Busy" Set (Start + Stairs + NPCs + Wells + Shrines)
  const busy = new Set([state.startRoom, state._stairsRoom]);
  if (state.puzzleEntryRoom) busy.add(state.puzzleEntryRoom);
  if (state.merchant?.room) busy.add(state.merchant.room);
  if (state.blacksmith?.room) busy.add(state.blacksmith.room);
  if (state.jester?.room) busy.add(state.jester.room);
  if (state.cartographer?.room) busy.add(state.cartographer.room);
  if (state.cleric?.room) busy.add(state.cleric.room);
  if (state.goldWell?.room) busy.add(state.goldWell.room);
  if (state.shrines) state.shrines.forEach(s => busy.add(s.room));
  if (state.puzzleRooms) state.puzzleRooms.forEach(pr => busy.add(pr)); // Block everything else from Puzzle Rooms!

  // 2. Cursed Stairs (Moved from earlier)
  if (state.floor % 10 !== 0 && state.rooms.length > 2 && Math.random() < 0.4) {
    const cands = state.rooms.slice(1).filter(r => !busy.has(r));
    if (cands.length > 0) {
      const r = cands[rand(0, cands.length - 1)];
      const rsx = Math.floor(r.x + r.w/2);
      const rsy = Math.floor(r.y + r.h/2);
      if (state.tiles[rsy][rsx] === 1) {
        state.tiles[rsy][rsx] = 10; // Tile 10 = Red Cursed Stairs
        busy.add(r); // Mark this room as busy so Red Chest doesn't use it
      }
    }
  }

  // 3. Red Chest Room
  if ((state.gameMode === 'classic' || state.gameMode === 'endless') && Math.random() < 0.15) { 
    const cands = state.rooms.slice(1).filter(r => !busy.has(r));
    if (cands.length > 0) {
      const r = cands[rand(0, cands.length - 1)];
      state.redChestRoom = r;
      // Clear room interior (remove props/traps)
      for(let y=r.y+1; y<r.y+r.h-1; y++) for(let x=r.x+1; x<r.x+r.w-1; x++) state.tiles[y][x] = 1;
      const cx = Math.floor(r.x + r.w/2), cy = Math.floor(r.y + r.h/2);
      state.tiles[cy][cx] = 3;
      state.redChests.set(`${cx},${cy}`, { room:r, active:false, cleared:false, wave:0 });
    }
  }

// --- NEW: Dynamic Spawn Message (Handles any combination of 5 NPCs) ---
const sounds = [];
if (spawnedMerchant)     sounds.push("jingling coins");
if (spawnedBlacksmith)   sounds.push("a hammer ringing");
if (spawnedJester)       sounds.push("raucous laughter");
if (spawnedCartographer) sounds.push("parchment rustling");
if (spawnedCleric)       sounds.push("soft chanting");

if (sounds.length > 0) {
  // Join with commas and an Oxford comma/and
  let text = "You hear " + sounds[0];
  if (sounds.length === 2) {
    text = `You hear ${sounds[0]} and ${sounds[1]} nearby`;
  } else if (sounds.length > 2) {
    const last = sounds.pop();
    text = `You hear ${sounds.join(", ")}, and ${last} nearby`;
  } else {
    text = `You hear ${sounds[0]} nearby`;
  }
  showBanner(text, 3600);
  log(text); // Add to Event Log
}
// ---------------------------------------------------------------------





  
// --- extra random chests ---
  let chestCount = rand(1,3) + Math.floor(state.floor/4);
  let safe=0;
  while(chestCount>0 && safe<2000){
    safe++;
    const r = state.rooms[rand(0,state.rooms.length-1)];
    if(!r) continue;
    const x=rand(r.x+1,r.x+r.w-2), y=rand(r.y+1,r.y+r.h-2);

    // NEW: never place chests on top of NPC tiles
if (isMerchantTile(x,y) || isBlacksmithTile(x,y) || isJesterTile(x,y) || isCartographerTile(x,y)) continue;

    // Block Golden Well (2x2)
    if (state.goldWell && x >= state.goldWell.x && x <= state.goldWell.x+1 && y >= state.goldWell.y && y <= state.goldWell.y+1) continue;


    if(x===state.player.x && y===state.player.y) continue;
    if(state.tiles[y][x]!==1) continue;
    if(state.tiles[y][x]===4) continue;
    if(state.floor===1 && r===startRoom) continue;
    // always place a chest tile
    state.tiles[y][x] = 3;


// 25% chance: this chest is actually a Mimic (revealed when opened)
const key = `${x},${y}`;
if (key !== state._starterChest && Math.random() < 0.25) {
  state.mimicChests.add(key);
}

chestCount--;
  }

// --- enemies ---
let toSpawn = (state.floor === 1 ? rand(5,8) : rand(6,10) + Math.floor(state.floor/2));
const kinds = floorEnemyKinds();  // ← use floor-scaled templates

let guard = 0;
while (toSpawn > 0 && guard < 2000) {
  guard++;

  // pick a room and coordinates you already consider valid
  // inside spawnEnemies while (toSpawn > 0) { ... }
const r = state.rooms[rand(0, state.rooms.length - 1)];
if (!r) continue;

// ⛔ NEW: never spawn in the player's spawn room
if (r === state.startRoom) continue;

const x = rand(r.x + 1, r.x + r.w - 2);
const y = rand(r.y + 1, r.y + r.h - 2);

// ⛔ NEW: keep the start-room interior clear
if (typeof inSpawnRect === 'function' && inSpawnRect(x, y)) continue;

// ... keep your existing legality checks (floor, not blocked, etc.)

  if (!inBounds(x,y)) continue;
  if (state.tiles[y][x] !== 1) continue;       // floor tile
  if (enemyAt(x,y)) continue;                  // no stacking
  if (x === state.player.x && y === state.player.y) continue;
    
// SAFE ROOMS: block initial spawns here
const inSafe = (r,x,y)=> r && x>=r.x && x<r.x+r.w && y>=r.y && y<r.y+r.h;
if (
      inSafe(state.safeRect,  x, y) ||
      inSafe(state.safeRect2, x, y) ||
      inSafe(state.safeRect3, x, y) ||
      inSafe(state.safeRect4, x, y)
    ) continue;

// NEVER spawn enemies in puzzle rooms
let inPuzzleEnemy = false;
if (state.puzzleRooms) {
    for (const pr of state.puzzleRooms) {
        if (x >= pr.x && x < pr.x + pr.w && y >= pr.y && y < pr.y + pr.h) inPuzzleEnemy = true;
    }
}
if (inPuzzleEnemy) continue;


// pick kind and build enemy
  const k = kinds[Math.floor(Math.random() * kinds.length)];
  const e = { x, y, size:1, boss:false, type:k.type, hp:k.hp, atk:[...k.atk], xp:k.xp };

  // SHADOW LABYRINTH: 40% chance to spawn a Heartless instead
  if (state.floorEffect?.includes('ShadowLabyrinth') && Math.random() < 0.40) {
    e.type = 'Heartless';
    e.hp = Math.max(1, Math.floor(e.hp * 0.8)); // Slightly weaker than avg
    e.fast = true;                              // But fast/twitchy
    e.xp = Math.max(1, e.xp - 1);               // Worth slightly less XP
    // Reset specific traits from the original roll
    e.poisonChance = 0; 
    e.stealChance = 0;
    e.ranged = false;
  }

  // per-type traits (mirror what you do elsewhere)
  if (k.type === 'Rat')      { e.poisonChance = 0.20; }
  if (k.type === 'Goblin')   { e.fast = true; e.stealChance = 0.20; }
  if (k.type === 'Slime')    { e.slow = true; e._skipMove = false; }
  if (k.type === 'Skeleton') { e._revived = false; }
  if (k.type === 'Mage')     { e.ranged = true; e.range = 3; }


  state.enemies.push(e);
  toSpawn--;
}


  // keep cap in sync
// --- NEW: Mini-Boss Spawn (Floors 5, 15, 25... in Endless) ---
  if (state.gameMode === 'endless' && state.floor % 5 === 0 && state.floor % 10 !== 0) {
      // Try 50 times to find a valid room center
      for(let i=0; i<50; i++) {
          const r = state.rooms[rand(0, state.rooms.length-1)];
          const ex = Math.floor(r.x + r.w/2);
          const ey = Math.floor(r.y + r.h/2);
          
          // Don't spawn on top of player, existing enemy, or NPCs
          if (dist(ex, ey, state.player.x, state.player.y) > 5 && !enemyAt(ex, ey) &&
              !isMerchantTile(ex,ey) && !isBlacksmithTile(ex,ey)) {
              
              // Pick a random visual from existing sprites
              const sprites = ['Rat', 'Bat', 'Spider', 'Goblin', 'Skeleton', 'Mage', 'Slime'];
              const randomSprite = sprites[Math.floor(Math.random() * sprites.length)];

              const miniBoss = {
                  type: randomSprite,     // Random visual base
                  displayName: 'Warlord', // Custom Name override
                  x: ex, y: ey,
                  hp: 25 + (state.floor * 4), 
                  hpMax: 25 + (state.floor * 4),
                  atk: [4 + Math.floor(state.floor/3), 7 + Math.floor(state.floor/2)],
                  xp: 100, 
                  miniBoss: true,         // Triggers Omen on death
                  size: 1,
                  tint: 'hue-rotate(-45deg) saturate(2)' // Reddish tint
              };
              state.enemies.push(miniBoss);
              log("A Warlord guards this floor...");
              break; 
          }
      }
  }

  state.enemyCap = state.enemies.length;

  // --- NEW: Scenery / Props Generation ---
// Add 8-15 random flavor objects (passable) per floor
// --- NEW: Scenery / Props Generation ---
let propCount = rand(8, 15);
let propSafe = 0;
while(propCount > 0 && propSafe < 1000){
  propSafe++;
  const rx = rand(1, state.size.w-2);
  const ry = rand(1, state.size.h-2);
  
  // 1. NEW: Must be strictly inside a room (padded by 1) to avoid blocking hallways/doors
  const inRoom = state.rooms.some(r => 
    rx >= r.x + 1 && rx < r.x + r.w - 1 && 
    ry >= r.y + 1 && ry < r.y + r.h - 1
  );
  if (!inRoom) continue;

  // Must be empty floor (1), no pickup (5), no stairs (4), no trap (7)
  if (state.tiles[ry][rx] !== 1) continue; 
  if (state.pickups[key(rx,ry)]) continue;
  if (enemyAt(rx,ry)) continue;
  if (rx===state.player.x && ry===state.player.y) continue;
  
// Don't put on NPC tiles
  // FIX: Added isClericTile check so crates don't spawn on her head
  if (isMerchantTile(rx,ry) || isBlacksmithTile(rx,ry) || isJesterTile(rx,ry) || isCartographerTile(rx,ry) || isClericTile(rx,ry)) continue;
  
  // NEVER spawn random props inside puzzle rooms
  let inPuzzle = false;
  if (state.puzzleRooms) {
      for (const pr of state.puzzleRooms) {
          if (rx >= pr.x && rx < pr.x + pr.w && ry >= pr.y && ry < pr.y + pr.h) inPuzzle = true;
      }
  }
  if (inPuzzle) continue;

// Determine prop pool based on floor depth
  let types = ['crate','barrel','rubble']; // Default fallback
  const f = state.floor;
  
  if (f <= 10) { // Sewers
    types = ['crate','barrel','rubble','slime puddle','pipe debris','rat nest','broken grate','toxic barrel'];
  } else if (f <= 20) { // Crypt
    types = ['coffin','urn','bone','broken tomb','candle stand','gargoyle','spider web','skull pile'];
  } else if (f <= 30) { // Magma
    types = ['obsidian_shard','ash pile','magma rock','burnt cage','lava vent','iron chain','dragon bone'];
  } else if (f <= 40) { // Jungle/Ruins
    types = ['fern','broken pillar','vine cluster','mossy rock','giant flower','stone idol','ancient pot'];
  } else if (f <= 50) { // Void
    types = ['floating rock','crystal shard','void tendril','star mote','dark monolith','energy swirl'];
  } else { // Gilded
    types = ['gold vase','statue head','velvet stool','treasure pile','red carpet','chandelier fallen'];
  }

  state.props[key(rx,ry)] = { type: types[rand(0, types.length-1)] };
  
  // Set tile to 8 (Obstacle)
  state.tiles[ry][rx] = 8;
  
  propCount--;
}
// ---------------------------------------


// === PICKUP TOP-UP: guarantee a higher amount per floor ===
state.enemyCap    = state.enemies.length;
state.respawnTick = 0;
state.respawnEvery = 50 + Math.floor(state.floor/2); // tweak pacing here



// --- pickups ---
  let pickupCount = rand(4,8);
  if (state.cursedFloor) pickupCount *= 2; // Cursed Descent: 2x Drops

  let tries=0;
  while(pickupCount>0 && tries<3000){
    tries++;
    const r=state.rooms[rand(0,state.rooms.length-1)];
    if(!r) continue;
    const x=rand(r.x+1,r.x+r.w-2), y=rand(r.y+1,r.y+r.h-2);

    // NEW: never place floor loot on NPC tiles
if (isMerchantTile(x,y) || isBlacksmithTile(x,y) || isJesterTile(x,y) || isCartographerTile(x,y)) continue;

    // Block Golden Well (2x2)
    if (state.goldWell && x >= state.goldWell.x && x <= state.goldWell.x+1 && y >= state.goldWell.y && y <= state.goldWell.y+1) continue;


    if(state.tiles[y][x]!==1) continue;
    if(dist(x,y,state.player.x,state.player.y)<3) continue;
    const kxy=key(x,y);
    if(state.pickups[kxy]) continue;

    const roll = Math.random();
    let kind, payload;
// ORDER MATTERS: lowest → highest
if (roll < 0.14) { kind='weapon';    payload=randomWeapon(); }  // was 0.18
else if (roll < 0.35) { kind='potion';    payload=1; }
else if (roll < 0.47) { kind='tonic';     payload=1; }
else if (roll < 0.65) { kind='lockpicks'; payload=rand(1,3); }
else if (roll < 0.75) { kind='antidote';  payload=1; }
else if (roll < 0.87) { kind='arrows';    payload=rand(4,9); }
else { kind='spell';   payload=randomSpell(); }


    state.pickups[kxy]={kind,payload};
    state.tiles[y][x]=5;
    pickupCount--;
  }

  // --- SAFETY FALLBACKS (guarantee minimum spawns) ---
  // If no enemies made it onto the map, seed a few
  if (state.enemies.length === 0) {
    const kinds = floorEnemyKinds();
    const want = Math.max(3, Math.floor(3 + state.floor / 6));
    let placed = 0, guardAll = 0;

    while (placed < want && guardAll++ < 2000) {
      const r = state.rooms[rand(1, state.rooms.length - 1)] || state.rooms[0];
      if (!r) break;
      const x = rand(r.x + 1, r.x + r.w - 2);
      const y = rand(r.y + 1, r.y + r.h - 2);

      if (!inBounds(x,y)) continue;
      if (state.tiles[y][x] !== 1) continue;
      if (enemyAt(x,y)) continue;
      if (x === state.player.x && y === state.player.y) continue;

// SAFE ROOM: block respawns (merchant, blacksmith, jester)
    const inSafeRoom = (r)=> r && x >= r.x && x < r.x+r.w && y >= r.y && y < r.y+r.h;
    if (inSafeRoom(state.safeRect) || inSafeRoom(state.safeRect2) || inSafeRoom(state.safeRect3)) continue;


      const k = kinds[Math.floor(Math.random() * kinds.length)];
      state.enemies.push({ x, y, size:1, boss:false, type:k.type, hp:k.hp, atk:[...k.atk], xp:k.xp });

      // mirror your per-type traits
      if (k.type === 'Rat')      state.enemies[state.enemies.length-1].poisonChance = 0.20;
      if (k.type === 'Goblin') { state.enemies[state.enemies.length-1].fast = true; state.enemies[state.enemies.length-1].stealChance = 0.20; }
      if (k.type === 'Slime')  { state.enemies[state.enemies.length-1].slow = true; state.enemies[state.enemies.length-1]._skipMove = false; }
      if (k.type === 'Skeleton') state.enemies[state.enemies.length-1]._revived = false;
      if (k.type === 'Mage')    { state.enemies[state.enemies.length-1].ranged = true; state.enemies[state.enemies.length-1].range = 3; }

      placed++;
    }
  }

  // If pickups failed to place, drop at least one near—but not next to—the player
  if (Object.keys(state.pickups).length === 0) {
    let tries2 = 0;
    while (tries2++ < 500) {
      const r = state.rooms[rand(0, state.rooms.length-1)];
      if (!r) break;
      const x = rand(r.x + 1, r.x + r.w - 2);
      const y = rand(r.y + 1, r.y + r.h - 2);
      if (!inBounds(x,y)) continue;
      if (state.tiles[y][x] !== 1) continue;
      if (dist(x,y,state.player.x,state.player.y) < 3) continue;
      const kxy = key(x,y);
      if (state.pickups[kxy]) continue;

      state.pickups[kxy] = { kind:'potion', payload:1 };
      state.tiles[y][x] = 5;
      break;
    }
  }

  // Sync respawn cap with whatever we actually have now
  state.enemyCap = state.enemies.length;



// If pickups are still 0, force-drop a potion at a valid tile.
if (Object.keys(state.pickups).length === 0){
  const spot = findFreeFloorTile(3);               // keep a little distance from player
  if (spot){
    const kxy = key(spot.x,spot.y);
    state.pickups[kxy] = { kind:'potion', payload:1 };
    state.tiles[spot.y][spot.x] = 5;
  }
}

// Keep your respawn cap in sync with whatever we ended up with
state.enemyCap = state.enemies.length;

// === FINAL GUARANTEE (cannot fail) ===
if (state.enemies.length === 0){
  const spot = findFreeFloorTile(2);
  if (spot){
    const kinds = floorEnemyKinds();
    const k = kinds[Math.floor(Math.random()*kinds.length)];
    const e = { x:spot.x, y:spot.y, size:1, boss:false, type:k.type, hp:k.hp, atk:[...k.atk], xp:k.xp };
    if (k.type === 'Rat')      e.poisonChance = 0.20;
    if (k.type === 'Goblin') { e.fast = true; e.stealChance = 0.20; }
    if (k.type === 'Slime')  { e.slow = true; e._skipMove = false; }
    if (k.type === 'Skeleton') e._revived = false;
    if (k.type === 'Mage')   { e.ranged = true; e.range = 3; }
    state.enemies.push(e);
  } else if (state.rooms.length) {
    // deterministic last-ditch: first interior cell of the first room
    // fallback: pick the first NON-start room, else default to rooms[0]
const r = state.rooms.find(room => room !== state.startRoom) || state.rooms[0];

// choose a safe interior cell
let x = Math.min(r.x + 2, r.x + r.w - 2);
let y = Math.min(r.y + 2, r.y + r.h - 2);

// ⛔ also respect the no-spawn rectangle here
if (typeof inSpawnRect === 'function' && inSpawnRect(x, y)) {
  // walk the room until you find a cell outside the spawn rect
  outer:
  for (let yy = r.y + 1; yy < r.y + r.h - 1; yy++) {
    for (let xx = r.x + 1; xx < r.x + r.w - 1; xx++) {
      if (!inSpawnRect(xx, yy)) { x = xx; y = yy; break outer; }
    }
  }
}


// SAFE ROOM: if this spot is inside, pick an alternate free tile
if (state.safeRect){
  const sr = state.safeRect;
  if (x >= sr.x && x < sr.x+sr.w && y >= sr.y && y < sr.y+sr.h){
    const alt = (typeof findFreeFloorTile === 'function') ? findFreeFloorTile(2) : null;
    if (alt){ x = alt.x; y = alt.y; }
  }
}

state.enemies.push({ x, y, size:1, boss:false, type:'Rat', hp:4, atk:[1,2], xp:3 });

  }
}

if (Object.keys(state.pickups).length === 0){
  const spot = findFreeFloorTile(3);
  if (spot){
    const kxy = key(spot.x,spot.y);
    state.pickups[kxy] = { kind:'potion', payload:1 };
    state.tiles[spot.y][spot.x] = 5;
  } else if (state.rooms.length) {
    // deterministic last-ditch: opposite corner of start room
    const r = state.rooms[0];
    const x = Math.min(r.x + r.w - 3, r.x + 2);
    const y = Math.min(r.y + r.h - 3, r.y + 2);
    const kxy = key(x,y);
    state.pickups[kxy] = { kind:'potion', payload:1 };
    state.tiles[y][x] = 5;
  }
}

// keep cap in sync

// === ONE ELITE ENEMY PER FLOOR (non-boss floors) ===
// Elite = tinted like bosses, but weaker than bosses (size 1, no stairs on death)
if ((state.gameMode === 'endless' || state.gameMode === 'classic') && (state.floor % 10) !== 0 && Array.isArray(state.enemies) && state.enemies.length) {
  const candidates = state.enemies.filter(e => e && !e.boss && e.size === 1 && !e.elite);
  if (candidates.length) {
    const elite = candidates[rand(0, candidates.length - 1)];
    elite.elite = true;
    elite.tint  = randomBossTint();

    // Slightly stronger (but not boss-tier)
elite.hp = Math.max(1, Math.round((elite.hp || 1) * 1.50));
elite.hpMax = elite.hp;

if (Array.isArray(elite.atk) && elite.atk.length === 2) {
  elite.atk[0] = Math.max(0, Math.floor(elite.atk[0] * 1.25) + 1);
  elite.atk[1] = Math.max(elite.atk[0], Math.floor(elite.atk[1] * 1.25) + 1);
}

elite.xp = Math.max(1, Math.round((elite.xp || 1) * 2.00));
  }
}


state.enemyCap = state.enemies.length;


// === PICKUP TOP-UP: guarantee a higher amount per floor ===



// === PICKUP TOP-UP: guarantee a higher amount per floor ===
// target = base (2) + 60% of rooms + small depth bonus (max +4)
{
  const base = 2;
  const roomBonus = Math.round(state.rooms.length * 0.6);
  const depthBonus = Math.min(4, Math.floor((state.floor|0) / 3));
  const want = base + roomBonus + depthBonus;

  const isFreeFloor = (x,y)=> inBounds(x,y) && state.tiles[y][x] === 1
    && dist(x,y,state.player.x,state.player.y) >= 2
    && !enemyAt(x,y);

  // local helper: try random room cells, then scan deterministically
  const pickSpot = ()=>{
    // random tries across rooms
    for (let t = 0; t < 600; t++){
      const r = state.rooms[rand(0, state.rooms.length-1)];
      if (!r) break;
      const x = rand(r.x+1, r.x+r.w-2);
      const y = rand(r.y+1, r.y+r.h-2);
      if (isFreeFloor(x,y)) return {x,y};
    }
    // deterministic scan so we never fail entirely
    for (const r of state.rooms){
      for (let y = r.y+1; y < r.y+r.h-1; y++){
        for (let x = r.x+1; x < r.x+r.w-1; x++){
          if (isFreeFloor(x,y)) return {x,y};
        }
      }
    }
    return null;
  };

  let tries = 1200;
  while (Object.keys(state.pickups).length < want && tries-- > 0){
    const spot = pickSpot();
    if (!spot) break;
    const kxy = key(spot.x, spot.y);
    if (state.pickups[kxy]) continue;   
    // keep NPC tiles clear
if (typeof isMerchantTile === 'function' && isMerchantTile(spot.x, spot.y)) continue;
if (typeof isBlacksmithTile === 'function' && isBlacksmithTile(spot.x, spot.y)) continue;
if (typeof isJesterTile === 'function' && isJesterTile(spot.x, spot.y)) continue;
if (typeof isCartographerTile === 'function' && isCartographerTile(spot.x, spot.y)) continue;
if (typeof isClericTile === 'function' && isClericTile(spot.x, spot.y)) continue; // --- NEW ---

    // NEVER place random loot in puzzle rooms
    let inPuzzleLootTopUp = false;
    if (state.puzzleRooms) {
        for (const pr of state.puzzleRooms) {
            if (spot.x >= pr.x && spot.x < pr.x + pr.w && spot.y >= pr.y && spot.y < pr.y + pr.h) inPuzzleLootTopUp = true;
        }
    }
    if (inPuzzleLootTopUp) continue;

    // Block Golden Well (2x2)
    if (state.goldWell && spot.x >= state.goldWell.x && spot.x <= state.goldWell.x+1 && spot.y >= state.goldWell.y && spot.y <= state.goldWell.y+1) continue;
    
         // already something here

// simple, stable distribution; tweak as you like
    let kind, payload;
    const r = Math.random();

    if (r < 0.12){
      kind = 'weapon';                      // ~12%
      payload = randomWeapon();
    } else if (r < 0.18){
      kind = 'spell';                       // +6%
      payload = randomSpell();
    } else if (r < 0.24){
      kind = 'arrows';                      // +6%
      payload = rand(2, 6);
    } else if (r < 0.27){                   // --- NEW: 3% Chance for Bomb
      kind = 'bomb';
      payload = 1;
    } else if (r < 0.29){                   // --- NEW: 2% Chance for Warp Stone
      kind = 'warp';
      payload = 1;
    } else if (r < 0.44){                   // Adjusted: 15% Potion (was 23%)
      kind = 'potion';                      
      payload = 1;
    } else if (r < 0.59){                   // Adjusted: 15% Tonic (was 23%)
      kind = 'tonic';                       
      payload = 1;
    } else if (r < 0.65){                   // Shifted down (maintains ~6% Shield)
      kind = 'shield';
      // FIX: Pick a specific shield name instead of generic "1"
      const sTypes = ['Buckler', 'Kite Shield', 'Tower Shield', 'Ancient Shield'];
      payload = sTypes[Math.floor(Math.random() * sTypes.length)];
    } else if (r < 0.69){                   // Shifted down (maintains ~4% Trinket)
      // --- NEW: Trinket Drop Chance (4%) ---
      kind = 'trinket';
  // Buffed & Expanded Pool
  const tPool = [
    'Ring of Haste',   // +2 Stamina
    'Amulet of Life',  // Regen HP
    "Thief's Band",    // Gold +25%
    "Warrior's Ring",  // +1 Dmg
    "Stone Charm",     // +10% Armor
    "Scholar's Lens"   // +15% XP
  ];
  payload = tPool[Math.floor(Math.random() * tPool.length)];
}  else {
  kind = 'antidote';                    
  payload = 1;
}


state.pickups[kxy] = { kind, payload };
state.tiles[spot.y][spot.x] = 5;
            // mark pickup tile
  }
}



// (debug log below stays as-is)

  // Debug: show what ultimately spawned this floor
  //    if (typeof log === 'function') {
  //    log(`Depth ${state.floor}: spawned ${state.enemies.length} enemies, ${Object.keys(state.pickups).length} pickups`);
  //    } 

  

  // === ACCESS GUARANTEE PASSES ===
  function thresholdsForRoom(r){
    const list=[];
    let open=0, doors=0;
    const inRoom=(xx,yy)=> xx>=r.x&&xx<r.x+r.w&&yy>=r.y&&yy<r.y+r.h;
    state.corridor.forEach(k=>{
      const [cx,cy]=k.split(',').map(Number);
      const t = state.tiles[cy]?.[cx];
      if(t!==1 && t!==2) return;
      const rN=inRoom(cx,cy-1), rS=inRoom(cx,cy+1), rE=inRoom(cx+1,cy), rW=inRoom(cx-1,cy);
      const touches = (rN||rS||rE||rW) && !(rN&&rS) && !(rE&&rW);
      if(!touches) return;
      list.push([cx,cy]);
      if(t===1) open++; else doors++;
    });
    return {list, open, doors};
  }

  for(const r of state.rooms){
    let info = thresholdsForRoom(r);
    if(info.list.length >= 2) continue;
    let bestK=null, bestD=Infinity, bestC=null;
    state.corridor.forEach(k=>{
      const [cx,cy]=k.split(',').map(Number);
      if(info.list.some(([x,y])=>x===cx&&y===cy)) return;
      const rx = (cx < r.x) ? r.x : (cx > r.x + r.w - 1 ? r.x + r.w - 1 : cx);
      const ry = (cy < r.y) ? r.y : (cy > r.y + r.h - 1 ? r.y + r.h - 1 : cy);
      const d = Math.abs(cx - rx) + Math.abs(cy - ry);
      if(d < bestD){ bestD=d; bestK=k; bestC={cx,cy,rx,ry}; }
    });
    if(bestK){
      const {cx,cy,rx,ry} = bestC;
      let tx = cx, ty = cy;
      while (tx !== rx) {
  if (state.tiles[ty][tx] === 0 || state.tiles[ty][tx] === 2) {
    state.tiles[ty][tx] = 1;
    state.corridor.add(key(tx,ty));
  }
  tx += Math.sign(rx - tx);
}
      while (ty !== ry) {
  if (state.tiles[ty][tx] === 0 || state.tiles[ty][tx] === 2) {
    state.tiles[ty][tx] = 1;
    state.corridor.add(key(tx,ty));
  }
  ty += Math.sign(ry - ty);
}

      if (state.tiles[ty][tx] === 0 || state.tiles[ty][tx] === 2) {
  state.tiles[ty][tx] = 1;
  state.corridor.add(key(tx,ty));
}

      info = thresholdsForRoom(r);
    }
  }

  for(const r of state.rooms){
    const info = thresholdsForRoom(r);
    if(info.list.length === 0) continue;
    if(info.open === 0){
      const [cx,cy] = info.list[0];
      if (state.tiles[cy][cx] === 0 || state.tiles[cy][cx] === 2) {
  state.tiles[cy][cx] = 1;
}

    }
  }

  state.seen.add(key(state.player.x,state.player.y));
}



function tierForDepth(floor){
  if (floor >= 41) return 5; // 41–50 → Lv5
  if (floor >= 31) return 4; // 31–40 → Lv4
  if (floor >= 21) return 3; // 21–30 → Lv3
  if (floor >= 11) return 2; // 11–20 → Lv2
  return 1;                  // 1–10  → Lv1
}


function currentSpellTier(name){
  const s = state.spells?.find(sp => sp.name === name);
  return Math.max(1, s?.tier || 1);
}
function baseForTier(name, tier){
  const def = SPELL_BOOK[name];
  if (!def) return { baseMin:2, baseMax:4, baseRange:4, cost:2 };

  // MP cost still scales per tier (yours may use the constant if you added it)
  const tiersAbove = Math.max(0, (tier|0) - 1);
  let cost = Math.max(1, def.cost + tiersAbove * (typeof SPELL_COST_STEP_PER_TIER === 'number' ? SPELL_COST_STEP_PER_TIER : 1));

  // PERK: Mana Flow & Archmage
  const magPerks = state.skills?.magic?.perks;
  if (magPerks) {
    if (magPerks['mag_a1']) cost = Math.max(1, cost - magPerks['mag_a1']);
    if (magPerks['mag_a3'] && state.player.hp === state.player.hpMax) cost = 0;
  }

  // NEW: flat damage bump per tier
  const minTier = def.baseMin + tiersAbove * SPELL_DMG_STEP_PER_TIER_MIN;
  const maxTier = def.baseMax + tiersAbove * SPELL_DMG_STEP_PER_TIER_MAX;

  const bonus = getSpellBonusFor(name); // { dmg, range }

const skillBonus = magicPowerBonus(); // +1 dmg bonus for every 2 Magic levels (up to +6)

  return {
    baseMin: minTier + bonus.dmg + skillBonus, // <--- MODIFIED
        baseMax: maxTier + bonus.dmg + skillBonus, // <--- MODIFIED
        baseRange: def.baseRange + bonus.range,
        cost
  };
}





function randomWeapon(){
const pool=[
    {name:'Shortsword',min:3,max:5,type:'one'},
    {name:'Claymore',min:5,max:9,type:'two'},
    {name:'Spear',min:4,max:7,type:'spear'},
    {name:'Axe',        min:4,max:8,type:'axe'},
    {name:'Knuckle Duster',min:3,max:5,type:'hand'},
    {name:'Key of Destiny',min:5,max:7,type:'one'},
    // New Melee
    {name:'Warhammer',min:6,max:10,type:'two'},
    {name:'Battleaxe',min:5,max:10,type:'axe'},
    {name:'Halberd',min:5,max:9,type:'spear'},
    {name:'Claws',min:4,max:6,type:'hand'},
    // Staffs
    {name:'Fire Staff',min:2,max:4,type:'staff'},
    {name:'Ice Staff',min:2,max:4,type:'staff'},
    {name:'Lightning Staff',min:2,max:4,type:'staff'},
    {name:'Wind Staff',min:2,max:4,type:'staff'},
    {name:'Earth Staff',min:2,max:4,type:'staff'},
  // SHIELDS REMOVED FROM WEAPON POOL. They now spawn only via the 'shield' pickup kind.
  ];
  let choice = { ...pool[rand(0,pool.length-1)] }; // Shallow copy to avoid modifying the template

  // --- NEW: Affix System (25% chance) ---
  // MODIFIED: Exclude Key of Destiny AND Shields from getting random affixes
  if (choice.name !== 'Key of Destiny' && choice.type !== 'shield' && Math.random() < 0.25) {
    const roll = Math.random();
    
    // --- NEW: Cursed Weapons (5% chance within affix roll) ---
    if (roll < 0.15) { // Ultra Rare (Increased from 5% to 15%)
      const cTypes = ['blood', 'greed', 'rust', 'frailty'];
      const type = cTypes[Math.floor(Math.random() * cTypes.length)];
      const niceType = type.charAt(0).toUpperCase() + type.slice(1); // Capitalize

      choice.name = 'Cursed ' + niceType + ' ' + choice.name; 
      
      // Scale bonus based on weapon type
      let bonus = 4; // Standard
      if (choice.type === 'two' || choice.type === 'axe') bonus = 6; // Heavy
      if (choice.type === 'staff' || choice.type === 'hand' || choice.type === 'shield') bonus = 3; // Light

      choice.min += bonus; 
      choice.max += (bonus + 1); 
      choice.cursed = true;
      choice.curseType = type;
      
      // Unlock specific curse in Codex
      const key = 'Curse_' + choice.curseType.charAt(0).toUpperCase() + choice.curseType.slice(1);
      unlockCodex(key, true);
    }
    // Standard Affixes
    else if (roll < 0.3) {
      choice.name = 'Sharp ' + choice.name;
      choice.min += 1; choice.max += 1;
      unlockCodex('Sharp'); // <--- Unlock
    } else if (roll < 0.6) {
      choice.name = 'Heavy ' + choice.name;
      choice.max += 3; 
      unlockCodex('Heavy'); // <--- Unlock
    } else if (roll < 0.8) {
      choice.name = 'Vampiric ' + choice.name;
      choice.vampiric = true; 
      unlockCodex('Vampiric'); // <--- Unlock
    } else {
      choice.name = 'Ancient ' + choice.name;
      choice.min += 2; choice.max += 2;
      unlockCodex('Ancient'); // <--- Unlock
    }
  }
  return choice;
}
function randomSpell(){
  const pool = [
    {name:'Spark',  cost:2},
    {name:'Ember',  cost:3},
    {name:'Frost',  cost:3},
    {name:'Gust',   cost:2},
    {name:'Pebble', cost:1},
    {name:'Heal',   cost:4}
  ];
  const base = pool[rand(0,pool.length-1)];
  const tier = tierForDepth(state.floor);
  return { ...base, tier };
}




// ====== Spell scaling (duplicate scroll upgrades) ======
const SPELL_BOOK = {
  // Buffed: Spark cost 2->1. Gust cost 2->1.
  Spark:  { cost:1, baseMin:2, baseMax:3, baseRange:2 },
  Ember:  { cost:3, baseMin:3, baseMax:5, baseRange:3 },
  Frost:  { cost:3, baseMin:2, baseMax:4, baseRange:3 },
  Gust:   { cost:1, baseMin:1, baseMax:3, baseRange:2 }, 
  Pebble: { cost:1, baseMin:1, baseMax:4, baseRange:3 },
  Heal:   { cost:4, baseMin:4, baseMax:6, baseRange:0 }
};

const MAX_SPELL_BONUS = 5; // cap for +dmg and +range
const SHARDS_PER_UPGRADE = 5; // how many duplicate shards to buy one upgrade


function isOffensiveSpell(name){
  return name !== 'Heal' && Object.prototype.hasOwnProperty.call(SPELL_BOOK, name);
}

function getSpellBonusFor(name){
  const up = (state.spellUpgrades && state.spellUpgrades[name]) || {};
  return {
    dmg:   Math.min(MAX_SPELL_BONUS, (up.dmg   | 0)),
    range: Math.min(MAX_SPELL_BONUS, (up.range | 0))
  };
}


function ensureSpellUpgradeSlot(name){
  if (!state.spellUpgrades[name]){
    state.spellUpgrades[name] = { dmg:0, range:0, shards:0 };
  }
  return state.spellUpgrades[name];
}



function getSpellStats(name){
  const t    = currentSpellTier(name);
  const base = baseForTier(name, t);

  const up   = (state.spellUpgrades && state.spellUpgrades[name]) || { dmg:0, range:0 };
  const dmgBonus = Math.min(MAX_SPELL_BONUS, up.dmg|0);
  const rngBonus = Math.min(MAX_SPELL_BONUS, up.range|0);

// New: Heal uses percentage instead of flat values
    if (name === 'Heal'){
      // Scale with Magic Skill: +2% Heal per magic bonus point (approx +1% per level)
      const mag = (typeof magicPowerBonus === 'function' ? magicPowerBonus() : 0) * 0.02;
      const pct = Math.max(0, HEAL_PCT_BASE + (t - 1) * HEAL_PCT_PER_TIER + mag);
      return {
        cost:  base.cost,   // still scales +1 MP per tier via baseForTier
        pct,                 // e.g., 0.20, 0.26, 0.32...
        range: 0
      };
    }

// Offensive spells: shards + Magic level both boost damage
const pow = magicPowerBonus();  // +1 power every 2 Magic levels
let perkDmg = 0;
if (state.skills?.magic?.perks && state.skills.magic.perks['mag_a2']) {
  perkDmg = state.skills.magic.perks['mag_a2'];
}

return {
  cost:  base.cost,
  min:   base.baseMin + dmgBonus + pow + perkDmg,
  max:   base.baseMax + dmgBonus + pow + perkDmg,
  range: base.baseRange + rngBonus
};
}



// ====== Spell upgrade modal wiring (duplicate scroll shards) ======
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('spellUpModal');
  const titleEl = document.getElementById('spellUpTitle');
  const msgEl   = document.getElementById('spellUpMsg');
  const btnDmg  = document.getElementById('btnSpellUpDmg');
  const btnRng  = document.getElementById('btnSpellUpRange');

  function openUpgrade(spellName){
  if (!modal) return false;
  ensureSpellUpgradeSlot(spellName);
  const up = state.spellUpgrades[spellName];
  if (!isOffensiveSpell(spellName)) return false;
  if ((up.shards|0) < SHARDS_PER_UPGRADE) return false;

  modal.dataset.spell = spellName;
  titleEl.textContent = `Upgrade ${spellName}`;
  msgEl.textContent   = `You have ${up.shards} shard${up.shards===1?'':'s'}. Spend ${SHARDS_PER_UPGRADE} for +1 Damage or +1 Range.`;
  setMobileControlsVisible(false);            // ← add this
  modal.style.display = 'flex';
  return true;
}

function spend(kind){
  const spellName = modal.dataset.spell;
  if (!spellName) { modal.style.display='none'; setMobileControlsVisible(true); return; }

  const up = ensureSpellUpgradeSlot(spellName);
  if ((up.shards|0) < SHARDS_PER_UPGRADE) { modal.style.display='none'; setMobileControlsVisible(true); return; }

  // ... your existing upgrade logic ...

  // close if we can't chain another upgrade
  if (!openUpgrade(spellName)) { modal.style.display = 'none'; setMobileControlsVisible(true); }


    up.shards -= SHARDS_PER_UPGRADE;
    if (kind === 'dmg') {
      up.dmg = Math.min(MAX_SPELL_BONUS, (up.dmg|0) + 1);
      log(`${spellName} upgraded: +1 Damage (now +${up.dmg}).`);
    } else {
      up.range = Math.min(MAX_SPELL_BONUS, (up.range|0) + 1);
      log(`${spellName} upgraded: +1 Range (now +${up.range}).`);
    }

    updateSpellBody();

    // If they still have enough shards for another upgrade, keep the modal open
    if (!openUpgrade(spellName)) { modal.style.display = 'none'; setMobileControlsVisible(true); }
}

  if (btnDmg) btnDmg.onclick = () => spend('dmg');
  if (btnRng) btnRng.onclick = () => spend('range');

  // expose a hook your loot code can call
  window.__maybePromptSpellUpgrade = (name) => openUpgrade(name);
  if (modal) modal.style.display = 'none';

});




// ====== Combat & XP ======


// Chance to award gold on kill
const GOLD_DROP_CHANCE = 0.50;


// --- Gold reward helper ---
function goldFor(enemy){
  const table = {
    Rat:[1,3], Slime:[1,2],
    Goblin:[2,5], Skeleton:[3,6], Mage:[3,6]
  };
  const [lo, hi]   = table[enemy.type] || [1,3];
  const depthBonus = Math.floor((state.floor|0)/3);

  let base = rand(lo + depthBonus, hi + depthBonus);
  // Trinket: Thief's Band (+30% Gold)
  if (state.player.trinket?.name === "Thief's Band") { base = Math.ceil(base * 1.30); }
  
  // --- NEW: Idol of Greed (+50% Gold) ---
  if (state.inventory.idols?.['Idol of Greed']) { base = Math.ceil(base * 1.50); }

  if (state.gameMode !== 'classic' && state.floorEffect === 'Bloodhunt'){
    return Math.max(1, Math.round(base * 1.35));
  }
  return base;
}



// ---- Survivability damage reduction: +5% DR every 5 levels (5,10,15,...)
function damageAfterDR(raw){
  let dr = 0;
  const sv = state.skills?.survivability;
  if (sv){ 
    dr += Math.min(0.05 * (sv.lvl||0), 0.50); 
    // Perk: Thick Skin (+2% DR per level)
    if (sv.perks && sv.perks['sur_a1']) dr += 0.02 * sv.perks['sur_a1'];
  }

  let usedShield = false;
  const sh = state.player?.shield;
  if (sh && sh.dur > 0){ 
      // Use specific block chance (Buckler 15%, Tower 35%, etc)
      const chance = state.player.blockChance || 0.20; 
      if (Math.random() < chance) {
          dr += SHIELD_DR; 
          usedShield = true;
          log(`Blocked with ${state.player.shieldName}!`);
      }
  }

  // Cleric Blessing: +20% Damage Reduction
if (state.player.blessTicks > 0) { dr += 0.20; }
// Trinket: Stone Charm (+10% DR)
  if (state.player.trinket?.name === "Stone Charm") { dr += 0.10; }
  
  // --- NEW: Idol of Stone (+15% DR) ---
  if (state.inventory.idols?.['Idol of Stone']) { dr += 0.15; }

  // Perk: Iron Body (Hand-to-Hand)
  if (state.skills?.hand?.perks && state.skills.hand.perks['hand_b3']) {
    dr += 0.05 * state.skills.hand.perks['hand_b3'];
  }

  dr = Math.min(dr, 0.80);                 // cap total DR at 80%

  let dmg = Math.ceil(raw * (1 - dr));

  // --- NEW: Idol of Greed (+50% Damage Taken) ---
  if (state.inventory.idols?.['Idol of Greed']) { 
      dmg = Math.ceil(dmg * 1.5); 
  }

  // Frailty Curse: You take +2 damage from everything
  if (state.player.weapon?.curseType === 'frailty' && dmg > 0) {
    dmg += 2;
  }

  if (usedShield && dmg > 0){              // only when it actually reduced real damage           // only when it actually reduced real damage
  state._shieldParity = (state._shieldParity + 1);
  if (state._shieldParity % 2 === 0){    // every other hit taken
    sh.dur = Math.max(0, (sh.dur|0) - 1);
    if (sh.dur <= 0){
      state.player.shield = null;
      log('Your shield shatters!');
    }
    updateEquipUI?.();
  }
}

  return dmg;
}




function baseAccuracy(type){
  return ({hand:0.9, one:0.85, spear:0.8, axe:0.75, two:0.7}[type] ?? 0.90);
}
function accuracyBonusFromSkill(type){
  const s = state.skills[type];
  if (!s) return 0;
  const extra = Math.max(0, (s.lvl || 1) - 1);
  const base = 0.02 * extra;                   // all melee skills
  const bowBonus = (type === 'bow') ? 0.01*extra : 0; // +1%/level more for Bow
  
  // Perk: +5% Accuracy per level from base perks
  const perkBonus = (s.perks && s.perks[type + '_base']) ? (s.perks[type + '_base'] * 0.05) : 0;
  
  return base + bowBonus + perkBonus;
}
// +5% success per level after 1 (L2=+5%, L3=+10%, ...)
function lockpickBonusFromSkill(){
  const s = state.skills?.lockpicking;
  const L = (s?.lvl || 1);
  let bonus = 0.05 * Math.max(0, L - 1);
  
  // Perk: Steady Hands
  if (s && s.perks && s.perks['loc_base']) {
    bonus += 0.05 * s.perks['loc_base'];
  }
  return bonus;
}


function rollHitFor(type){
  // --- FIX: 100% Accuracy during the Tutorial ---
  if (typeof state !== 'undefined' && state.gameMode === 'tutorial') {
      return true;
  }
  
  if (type === 'magic'){
    // Magic accuracy: every 2 Magic levels improves hit chance
    const tiers = magicPowerBonus();   // 0,1,2,... based on Magic lvl
    const base  = 0.75;
    const bonus = tiers * 0.02;       // +2% per 2 Magic levels
    const p = Math.max(0.05, Math.min(0.99, base + bonus));
    return Math.random() < p;
  }

  // Weapons: use baseAccuracy + skill bonus, clamped so we never hit 100%
  const raw = baseAccuracy(type) + accuracyBonusFromSkill(type);
  const p   = Math.max(0.05, Math.min(0.99, raw));
  return Math.random() < p;
}

// ======== Weapon Quirk Tunables & Helpers ========
const QUIRK_CAP = 0.40;       // hard cap 40%
const BLEED_TICKS = 5;        // spear
const BLEED_DMG   = 1;
const SLOW_TICKS  = 3;        // axe
const STUN_TICKS  = 3;        // hand-to-hand

// 2% per skill level (beyond 1), capped (feel free to tweak the 0.02)
function quirkChance(type){
  const s = state.skills?.[type];
  const lvl = (s?.lvl || 1);
  const extra = Math.max(0, lvl - 1);
  let chance = Math.min(QUIRK_CAP, 0.02 * extra);

  // Apply Skill Tree Perks (+5% per level for A1 traits)
  if (s && s.perks) {
    const pKey = type + '_a1';
    if (s.perks[pKey]) {
      chance += (s.perks[pKey] * 0.05);
    }
  }

  return chance;
}
const proc = (p)=> Math.random() < p;

// enemy status applicators
function applyBleed(e, ticks=BLEED_TICKS, perTick=BLEED_DMG){
  let bonusTicks = 0;
  let bonusDmg = 0;
  if (state.skills?.spear?.perks) {
    if (state.skills.spear.perks['spear_a3']) bonusTicks += 3;
    if (state.skills.spear.perks['spear_a2']) bonusDmg += state.skills.spear.perks['spear_a2'];
  }
  e.bleedTicks = Math.max(e.bleedTicks|0, 0) + ticks + bonusTicks;
  e.bleedDmg   = perTick + bonusDmg;
}
function applySlow(e, ticks=SLOW_TICKS){
  let bonusTicks = 0;
  if (state.skills?.axe?.perks && state.skills.axe.perks['axe_a2']) bonusTicks += 2;
  e.slowTicks = Math.max(e.slowTicks|0, 0) + ticks + bonusTicks;
  e._skipMove = false; // used for every-other-turn slow
}
function applyStun(e, ticks=STUN_TICKS){
  if (e.boss) return; // Bosses are immune
  let bonusTicks = 0;
  if (state.skills?.hand?.perks && state.skills.hand.perks['hand_a2']) bonusTicks += 2;
  e.stunTicks = Math.max(e.stunTicks|0, 0) + ticks + bonusTicks;
}




// === Magic power scaling (caps the bonus) ===
function magicPowerBonus(){
  const ml = (state.skills?.magic?.lvl || 1);
  // +1 power every 2 Magic levels starting at lvl 3: 3,5,7,9...
  // Cap the total bonus so early spells don’t overtake late-game spells
  return Math.min(6, Math.max(0, Math.floor((ml - 1) / 2)));
}

// XP gain when you pick up an extra copy of a spell scroll
const MAGIC_SCROLL_XP = 4;

function ensureSkill(type){
  if(!state.skills[type]) state.skills[type]={lvl:1,xp:0,next:SKILL_XP_START,shown:false}
}

function skillDamageBonus(type){
  const s=state.skills[type];
  if(!s) return 0;
  let bonus = Math.floor((s.lvl-1)/2);
  
  // Apply Skill Tree Perks for Damage
  if (s.perks) {
    if (type === 'one' && s.perks['one_a2']) bonus += s.perks['one_a2'];
    if (type === 'two' && s.perks['two_a2']) bonus += s.perks['two_a2'];
    if (type === 'hand' && s.perks['hand_b2']) bonus += s.perks['hand_b2'];
  }
  
  return bonus;
}
function recomputeWeapon(){
  const w = state.player.weapon;
  if (!w || !w.base) return;

  // --- FIX: Staffs do not benefit from generic physical ATK omens ---
  let flat = state.globalWeaponFlatBonus || 0;
  if (w.type === 'staff') flat = 0; 
  // ----------------------------------------------------------------

  const bonus = skillDamageBonus(w.type) + flat;

  w.min = w.base.min + bonus;
  w.max = w.base.max + bonus;
}

function awardKill(type,amount){
  // If killed by infighting, grant NO XP and do NOT count stats
  if (type === 'infighting') return;

  // --- PERKS: On-Kill Effects ---
  if (type === 'axe' && state.skills?.axe?.perks?.['axe_b1']) {
    const healAmt = state.skills.axe.perks['axe_b1'];
    state.player.hp = Math.min(state.player.hpMax, state.player.hp + healAmt);
  }
  if (type === 'magic' && state.skills?.magic?.perks?.['mag_c1']) {
    state.player.mp = Math.min(state.player.mpMax, state.player.mp + 1);
  }

  incrementMetaStat('kills_' + type);

  // --- XP Multiplier based on Effect Count ---
  let count = 0;
  if (Array.isArray(state.floorEffect)) count = state.floorEffect.length;
  else if (state.floorEffect) count = 1;

  if (count > 0) {
      // 1 effect = 1.5x, 2 = 2.0x ... 8 = 5.0x
      const mult = 1.0 + (count * 0.5);
      amount = Math.max(1, Math.round(amount * mult));
  }

  // Bloodhunt bonus stacks on top
  if (state.gameMode !== 'classic' && isEffectActive('Bloodhunt')){
    amount = Math.max(1, Math.round(amount * 1.35));
  }
  // Trinket: Scholar's Lens (+15% XP)
  if (state.player.trinket?.name === "Scholar's Lens") {
    amount = Math.ceil(amount * 1.15);
  }
  state.player.xp += amount;
  let leveled=false;
  while(state.player.xp>=state.player.next){
    state.player.xp-=state.player.next;
    state.player.level++;
    state.player.next = Math.floor(state.player.next * PLAYER_XP_GROWTH);
    leveled=true;
  }


  // Tutorial: after your first kill, move to the spell-menu step
  if (state.gameMode === 'tutorial' && state.tutorialStep === 3) {
    state.tutorialStep = 4;
    say("Nice! You killed a rat. Now press P to open your spell menu.");
  }

  if (leveled){
    SFX.levelUp();
    // HARD-LOCK player input until a choice is made
    state._inputLocked = true;

  // Optional: hide on-screen mobile controls while locked
  if (typeof setMobileControlsVisible === 'function') setMobileControlsVisible(false);

  // Show the choice modal
  document.getElementById('lvlupModal').style.display = 'flex';
}


  // Consolidate Staff -> Magic
  if (type === 'staff') type = 'magic';

  ensureSkill(type);
  const s=state.skills[type];
  s.xp+=amount;
  if(!s.shown){ s.shown=true; }
  let up=false;
  while(s.xp>=s.next){ s.xp-=s.next; s.lvl++; s.next = Math.floor(s.next * SKILL_XP_GROWTH); up=true; }
  if(up){ log(typeNice(type)+' advanced to '+s.lvl+'.'); }

  // NEW: Survivability also gains XP from kills
  ensureSkill('survivability');
  const sv = state.skills['survivability'];
  sv.xp += amount;
  if(!sv.shown){ sv.shown = true; }
  let upS = false;
  while(sv.xp >= sv.next){
    sv.xp -= sv.next;
    sv.lvl++;
    sv.next = Math.floor(sv.next * SKILL_XP_GROWTH);
    upS = true;
  }
  if (upS){ log('Survivability advanced to ' + sv.lvl + '.'); }

  if(state.player.weapon.type===type){
    recomputeWeapon();
  }
  updateEquipUI();
  renderSkills();
}

function typeNice(type){
  return ({
    hand:'Hand to Hand',
    one:'One-Handed',
    two:'Two-Handed',
    spear:'Polearm', // Changed display name
    axe:'Hafted',
    bow:'Archery',
    lockpicking:'Lockpicking',
    magic:'Magic',
    survivability:'Survivability'
  })[type] || type;
}


