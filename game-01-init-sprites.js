// ====== Utility ======
const rand = (a,b)=>Math.floor(Math.random()*(b-a+1))+a;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function shuffle(arr){for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]}return arr}
const key=(x,y)=>x+','+y;
// === Boss color variations (tints) ===
const BOSS_TINTS = [
  'hue-rotate(40deg)  saturate(1.35) brightness(1.05)',
  'hue-rotate(120deg) saturate(1.40) brightness(1.05)',
  'hue-rotate(200deg) saturate(1.35) brightness(1.05)',
  'hue-rotate(300deg) saturate(1.35) brightness(1.05)'
];
function randomBossTint(){
  return BOSS_TINTS[rand(0, BOSS_TINTS.length - 1)];
}

function showBanner(text, ms = 2500, color = null){
  const el = document.getElementById('banner');
  if (!el) return;

  // NEW: queue banners so they don’t overwrite each other
  if (!el._queue) el._queue = [];
  if (el._busy){
    el._queue.push({ text, ms, color });
    return;
  }
  el._busy = true;

  el.textContent = text;
  el.style.color = color || '#d9e7f5'; // Use custom color or default
  el.style.display = 'block';
  // start slightly lower, fade in, slide up a touch
  el.style.opacity = '0';
  el.style.transform = 'translate(-50%, 8px)';

  requestAnimationFrame(()=>{
    el.style.opacity = '1';
    el.style.transform = 'translate(-50%, 0)';
  });

  clearTimeout(el._hideT1); clearTimeout(el._hideT2);
  el._hideT1 = setTimeout(()=>{
    el.style.opacity = '0';
    el.style.transform = 'translate(-50%, 6px)';
  }, ms);
  el._hideT2 = setTimeout(()=>{
    el.style.display = 'none';
    el.style.transform = 'translate(-50%, 0)';

    // NEW: advance the queue
    el._busy = false;
    const next = el._queue.shift();
    if (next) showBanner(next.text, next.ms, next.color);
  }, ms + 260);
}


function hideBanner(){
  const el = document.getElementById('banner'); if (!el) return;
  clearTimeout(el._hideT1); clearTimeout(el._hideT2);
  el.style.display = 'none';
  el.style.opacity  = '0';
  el.style.transform = 'translate(-50%, 0)';

  // NEW: allow queued banners (and say()) to continue after a manual hide
  el._busy = false;
  if (el._queue && el._queue.length){
    const next = el._queue.shift();
    if (next) showBanner(next.text, next.ms);
  }
}

function waitForAdvance(){
  return new Promise(resolve=>{
    const cleanup = ()=>{
      window.removeEventListener('pointerdown', onClick);
      window.removeEventListener('keydown', onKey);
    };
    const onClick = ()=>{ cleanup(); resolve(); };
    const onKey = (e)=>{ if (e.key === 'Enter' || e.key === ' ') { cleanup(); resolve(); } };
    // slight delay so a click that *opened* the scene doesn’t auto-skip the first line
    setTimeout(()=>{
      window.addEventListener('pointerdown', onClick, { once:true });
      window.addEventListener('keydown', onKey, { once:true });
    }, 80);
  });
}

async function say(text){
  showBanner(text, 999999);   // stay up until the player advances
  await waitForAdvance();
  hideBanner();
}



const PLAYER_XP_START   = 22;   
const PLAYER_XP_GROWTH  = 1.20; // Smoother late-game leveling
const SKILL_XP_START    = 25;   // Increased starting XP required
const SKILL_XP_GROWTH   = 1.32; // Increased to slow down skill maxing



function isMerchantTile(x,y){
  const m = state.merchant;
  if (!m) return false;
  return (x===m.x && y===m.y) ||
         (m.left && x===m.left.x && y===m.left.y) ||
         (m.right && x===m.right.x && y===m.right.y);
}
function isNearMerchant(px,py){
  const m = state.merchant;
  if (!m) return false;
  const d = Math.abs(px - m.x) + Math.abs(py - m.y);
  return d === 1;
}

function isBlacksmithTile(x,y){
  const b = state.blacksmith;
  if (!b) return false;
  return (x===b.x && y===b.y) ||
         (b.left && x===b.left.x && y===b.left.y) ||
         (b.right && x===b.right.x && y===b.right.y);
}
function isNearBlacksmith(px,py){
  const b = state.blacksmith;
  if (!b) return false;
  const d = Math.abs(px - b.x) + Math.abs(py - b.y);
  return d === 1;
}

// ===== Jester NPC helpers =====
function isJesterTile(x,y){
  const j = state.jester;
  if (!j) return false;
  // FIX: Removed j.left check since the Jester is only 2 tiles wide (NPC + Wheel)
  return (x===j.x && y===j.y) ||
         (j.right && x===j.right.x && y===j.right.y);
}
function isNearJester(px,py){
  const j = state.jester;
  if (!j) return false;
  const d = Math.abs(px - j.x) + Math.abs(py - j.y);
  return d === 1;
}


// ===== Cartographer NPC helpers =====
function isCartographerTile(x,y){
  const c = state.cartographer;
  if (!c) return false;
  return (x===c.x && y===c.y) ||
         (c.left && x===c.left.x && y===c.left.y) ||
         (c.right && x===c.right.x && y===c.right.y);
}
function isNearCartographer(px,py){
  const c = state.cartographer;
   if (!c) return false;
  const d = Math.abs(px - c.x) + Math.abs(py - c.y);
  return d === 1;
}

// --- NEW: Cleric Helper ---
function isClericTile(x,y){
  return state.cleric && x === state.cleric.x && y === state.cleric.y;
}
// --------------------------


// NEW: find stairs + reveal full floor + draw arrow around player
function cartographerFindStairs(){
  if (state.cartographerArrowTarget) return state.cartographerArrowTarget;
  for (let y=0; y<state.size.h; y++){
    for (let x=0; x<state.size.w; x++){
      if (state.tiles?.[y]?.[x] === 4){
        state.cartographerArrowTarget = { x, y };
        return state.cartographerArrowTarget;
      }
    }
  }
  return null;
}
function cartographerRevealFloor(){
  if (!state.seen) state.seen = new Set();
  for (let y=0; y<state.size.h; y++){
    for (let x=0; x<state.size.w; x++){
      state.seen.add(key(x,y));
    }
  }
  cartographerFindStairs(); // cache target for arrow
}
function drawCartographerStairsArrow(ctx, ox, oy, tile){
  // Show if map is bought OR if boss stairs have spawned
  if (!state.cartographerMapActive && !state._bossStairsSpawned) return;
  const s = cartographerFindStairs();
  if (!s) return;

  const dx = (s.x - state.player.x);
  const dy = (s.y - state.player.y);
  if (dx === 0 && dy === 0) return;

  const ang = Math.atan2(dy, dx);
  const cx = (state.player.x - ox) * tile + tile/2;
  const cy = (state.player.y - oy) * tile + tile/2;

  const r = tile * 0.55;
  const tipX = cx + Math.cos(ang) * r;
  const tipY = cy + Math.sin(ang) * r;

  ctx.save();
  ctx.globalAlpha = 0.95;
  ctx.lineWidth = Math.max(2, tile * 0.10);
  ctx.strokeStyle = 'rgba(242,201,76,0.95)';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.stroke();

  const back = tile * 0.18;
  const side = tile * 0.14;
  ctx.fillStyle = 'rgba(242,201,76,0.95)';
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(
    tipX - Math.cos(ang)*back + Math.cos(ang+Math.PI/2)*side,
    tipY - Math.sin(ang)*back + Math.sin(ang+Math.PI/2)*side
  );
  ctx.lineTo(
    tipX - Math.cos(ang)*back + Math.cos(ang-Math.PI/2)*side,
    tipY - Math.sin(ang)*back + Math.sin(ang-Math.PI/2)*side
  );
  ctx.closePath(); ctx.fill();
  ctx.restore();
}



const CARTOGRAPHER_SPAWN_CHANCE = 0.20; // 20%
const CARTOGRAPHER_LOOP_URL = 'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/cartographer.mp3';
let cartographerAudio = null, cartographerGain = null, cartographerNode = null;

function ensureCartographerAudio(){
  initAudio();
  if (!cartographerGain){
    cartographerGain = audioCtx.createGain();
    cartographerGain.gain.value = 0;
    cartographerGain.connect(interactGain || masterGain); // Interactables slider
  }
  if (!cartographerAudio){
    cartographerAudio = new Audio();
    cartographerAudio.crossOrigin = 'anonymous';
    cartographerAudio.loop = true;
    cartographerAudio.preload = 'auto';
    cartographerAudio.setAttribute('playsinline','');
    cartographerAudio.src = CARTOGRAPHER_LOOP_URL;
    cartographerAudio.muted = true; // autoplay-safe priming
    cartographerAudio.play().catch(()=>{});
  }
  if (!cartographerNode && cartographerAudio){
    try{
      cartographerNode = audioCtx.createMediaElementSource(cartographerAudio);
      cartographerNode.connect(cartographerGain);
    }catch{}
  }
}

function stopCartographerAudio(){
  try{ if (cartographerAudio){ cartographerAudio.pause(); cartographerAudio.currentTime = 0; } }catch{}
  try{ if (cartographerNode){ cartographerNode.disconnect(); cartographerNode = null; } }catch{}
  cartographerAudio = null;
  if (cartographerGain) cartographerGain.gain.value = 0;
}

function updateCartographerAudio(){
  if (!cartographerGain) return;

  // if cartographer is gone (new floor / boss floor), force silence
  if (!state.cartographer){ cartographerGain.gain.value = 0; return; }

  // play until you're next to the NPC
  if (isNearCartographer(state.player.x, state.player.y)){
    cartographerGain.gain.value = 0;
    return;
  }

  const d = Math.abs(state.player.x - state.cartographer.x) + Math.abs(state.player.y - state.cartographer.y);
  const maxD = 20; // was 12
  const v = clamp(1 - (d/maxD), 0, 1);
  const shaped = Math.pow(v, 0.65);

  // NOTE: Interactables slider is already applied by interactGain
  cartographerGain.gain.value = shaped * 1;
}

// --- NEW: Cleric Audio ---
const CLERIC_LOOP_URL = 'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/priest.mp3';
let clericAudio = null, clericGain = null, clericNode = null;

function ensureClericAudio(){
  initAudio();
  if (!clericGain){
    clericGain = audioCtx.createGain();
    clericGain.gain.value = 0;
    clericGain.connect(interactGain || masterGain);
  }
  if (!clericAudio){
    clericAudio = new Audio();
    clericAudio.crossOrigin = 'anonymous';
    clericAudio.loop = true;
    clericAudio.preload = 'auto';
    clericAudio.setAttribute('playsinline','');
    clericAudio.src = CLERIC_LOOP_URL;
    clericAudio.muted = true;
    clericAudio.play().catch(()=>{});
  }
  if (!clericNode && clericAudio){
    try{
      clericNode = audioCtx.createMediaElementSource(clericAudio);
      clericNode.connect(clericGain);
    }catch{}
  }
}

function stopClericAudio(){
  try{ if (clericAudio){ clericAudio.pause(); clericAudio.currentTime = 0; } }catch{}
  try{ if (clericNode){ clericNode.disconnect(); clericNode = null; } }catch{}
  clericAudio = null;
  if (clericGain) clericGain.gain.value = 0;
}

function updateClericAudio(){
  if (!clericGain) return;
  if (!state.cleric){ clericGain.gain.value = 0; return; }

  const d = Math.abs(state.player.x - state.cleric.x) + Math.abs(state.player.y - state.cleric.y);

  // RESTORED: Mute if you are on top of her or directly adjacent (distance <= 1)
  if (d <= 1){
    clericGain.gain.value = 0;
    return;
  }

  const maxD = 20;
  const v = clamp(1 - (d/maxD), 0, 1);
  const shaped = Math.pow(v, 0.65);
  
  // Volume is 60% max
  clericGain.gain.value = shaped * 1;
}






// Spawn chance (20% per non-boss floor)
const JESTER_SPAWN_CHANCE = 0.20; 
const JESTER_LOOP_URL = 'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/npc_jester_laugh.mp3';
let jesterAudio = null, jesterGain = null, jesterNode = null;

function ensureJesterAudio(){
  initAudio();
  if (!jesterGain){
    jesterGain = audioCtx.createGain();
    jesterGain.gain.value = 0;
    jesterGain.connect(interactGain || masterGain); // Interactables slider
  }
  if (!jesterAudio){
    jesterAudio = new Audio();
    jesterAudio.crossOrigin = 'anonymous';
    jesterAudio.loop = true;
    jesterAudio.preload = 'auto';
    jesterAudio.setAttribute('playsinline','');
    jesterAudio.src = JESTER_LOOP_URL;
    jesterAudio.muted = true; // autoplay-safe priming
    jesterAudio.play().catch(()=>{});
  }
  if (!jesterNode && jesterAudio){
    try{
      jesterNode = audioCtx.createMediaElementSource(jesterAudio);
      jesterNode.connect(jesterGain);
    }catch{}
  }
}

function stopJesterAudio(){
  try{ if (jesterAudio){ jesterAudio.pause(); jesterAudio.currentTime = 0; } }catch{}
  try{ if (jesterNode){ jesterNode.disconnect(); jesterNode = null; } }catch{}
  jesterAudio = null;
  if (jesterGain) jesterGain.gain.value = 0;
}

function updateJesterAudio(){
  if (!jesterGain) return;

  // if jester is gone (new floor / boss floor), force silence
  if (!state.jester){ jesterGain.gain.value = 0; return; }

  // play until you're next to the NPC
  if (isNearJester(state.player.x, state.player.y)){
    jesterGain.gain.value = 0;
    return;
  }

  const d = Math.abs(state.player.x - state.jester.x) + Math.abs(state.player.y - state.jester.y);
  const maxD = 20; // was 12
  const v = clamp(1 - (d/maxD), 0, 1);
  const shaped = Math.pow(v, 0.65);

  // NOTE: Interactables slider is already applied by interactGain
  jesterGain.gain.value = shaped * 1;
}






// ---- Default BGM (replace with your hosted URL) ----


const DEFAULT_BGM_URL = 'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/bg.mp3';

// --- NEW: Dynamic Music Config ---
const MUSIC_CONFIG = {
  // Biomes: [1-4] is 'early', [5-9] is 'late'
  sewers: { 
    early: 'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/music_sewers_1.mp3', 
    late:  'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/music_sewers_2.mp3' 
  },
  crypt: { 
    early: 'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/music_crypt_1.mp3', 
    late:  'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/music_crypt_1.mp3'
  },
  magma: { 
    early: 'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/music_sewers_1.mp3', 
    late:  'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/music_sewers_2.mp3'
  },
  ruins: { 
    early: 'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/music_sewers_1.mp3', 
    late:  'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/music_sewers_2.mp3'  
  },
  void: { 
    early: 'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/music_sewers_1.mp3', 
    late:  'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/music_sewers_2.mp3'
  },
  gilded: { 
    early: 'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/music_sewers_1.mp3', 
    late:  'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/music_sewers_2.mp3'
  },

  // Boss Tracks (Triggers on Floor 10, 20, 30...)
  bosses: {
    'Rat':      'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/demo_boss.mp3',
    'Bat':      'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/demo_boss.mp3',
    'Spider':   'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/demo_boss.mp3',
    'Slime':    'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/demo_boss.mp3',
    'Goblin':   'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/demo_boss.mp3',
    'Skeleton': 'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/demo_boss.mp3',
    'Mage':     'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/demo_boss.mp3',
    'Clone':    'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/demo_boss.mp3',    // Floor 50
    'Mad King': 'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/demo_boss.mp3'     // Floor 50 Phase 2
  }
};

// ---- NPC dialogue (one-shot voice lines) ----
// Replace these placeholder URLs with your recorded lines.
const NPC_DIALOGUE_URLS = {
  // Use arrays ['url1', 'url2'] for random variations.
  merchant: {
    interact: ['https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/npc_merchant_interact.mp3'],
    buy:      ['https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/npc_merchant_buy.mp3'],
    sell:     ['https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/npc_merchant_sell.mp3'],
    leave:    ['https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/npc_merchant_leave.mp3'],
  },
  blacksmith: {
    interact: ['https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/npc_blacksmith_interact.mp3'],
    partialrepair:   ['https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/npc_blacksmith_partial_repair.mp3'],
    fullrepair:   ['https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/npc_blacksmith_full_repair.mp3'],
    leave:    ['https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/npc_blacksmith_leave.mp3'],
  },
  jester: {
    interact: ['https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/npc_jester_interact1.mp3','https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/npc_jester_interact2.mp3','https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/npc_jester_interact3.mp3'],
    spin:     ['https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/npc_jester_spin1.mp3','https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/npc_jester_spin2.mp3','https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/npc_jester_spin3.mp3','https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/npc_jester_spin4.mp3','https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/npc_jester_spin5.mp3','https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/npc_jester_spin6.mp3'],
    leave:    ['https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/npc_jester_leave1.mp3','https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/npc_jester_leave2.mp3','https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/npc_jester_leave3.mp3','https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/npc_jester_leave4.mp3','https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/npc_jester_leave5.mp3'],
    win:      ['https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/npc_jester_win1.mp3','https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/npc_jester_win2.mp3','https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/npc_jester_win3.mp3'],
    lose:     ['https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/npc_jester_lose1.mp3','https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/npc_jester_lose2.mp3'],
  },
  cartographer: {
    interact: ['https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/npc_cartographer_interact.mp3'],
    buy:      ['https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/npc_cartographer_buy.mp3'],
    leave:    ['https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/npc_cartographer_leave.mp3'],
  },
cleric: {
    interact: ['https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/npc_cleric_interact.mp3'],
    buy:      ['https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/npc_cleric_buy.mp3'],
    purify:   ['https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/npc_cleric_purify.mp3'], 
    leave:    ['https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/npc_cleric_leave.mp3'],
  },
  shadow: {
    // Split into specific story beats for sync
    intro1: 'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/npc_shadow_intro.mp3',
    intro2: 'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/npc_shadow_intro2.mp3', // Placeholder: Swap this for the "Submit" line file
    defeat: 'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/npc_shadow_defeat.mp3'
  },
  madking: {
    intro:  ['https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/npc_madking_intro.mp3'],
    defeat: ['https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/npc_madking_defeat.mp3']
  }
};

const _npcDialogueEls = Object.create(null);
const _npcDialogueNodes = Object.create(null);

// Plays a one-shot voice line routed through Interactables volume (interactGain).
let _currentNpcAudio = null; // Global tracker

function playNpcDialogue(input){
  if (!input) return;

  // --- NEW: Randomize if Array ---
  // If input is an array ['a.mp3', 'b.mp3'], pick one. If string, use as is.
  const url = Array.isArray(input) 
    ? input[Math.floor(Math.random() * input.length)] 
    : input;
  // -------------------------------

  // STOP previous line if playing
  if (_currentNpcAudio) {
    try { _currentNpcAudio.pause(); _currentNpcAudio.currentTime = 0; } catch{}
    _currentNpcAudio = null;
  }

  try { initAudio(); } catch {}
  try { if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(()=>{}); } catch {}
  try { if (typeof muted !== 'undefined' && muted) return; } catch {}

  let el = _npcDialogueEls[url];
  if (!el){
    el = new Audio();
    el.preload = 'auto';
    el.crossOrigin = 'anonymous';
    el.setAttribute('playsinline','');
    el.src = url;
    _npcDialogueEls[url] = el;

    // Route through WebAudio so your "Interactables" slider affects the dialogue.
    try{
      const node = audioCtx.createMediaElementSource(el);
      node.connect(voiceGain || masterGain);
      _npcDialogueNodes[url] = node;
      el.volume = 1;
    }catch(e){
      // If routing fails, still try to play via element audio.
    }
  }

  try{
    el.currentTime = 0;
    el.play().catch(()=>{});
    _currentNpcAudio = el; // <--- FIX: Track the currently playing audio
  }catch{}
}

// Helper: Show banner and wait specifically for the audio file to finish
async function saySynced(text, url) {
  showBanner(text, 999999); // Show indefinitely
  
  await new Promise(resolve => {
    if (!url) { setTimeout(resolve, 2000); return; } // Fallback if no URL
    
    try {
      const a = new Audio();
      a.crossOrigin = 'anonymous';
      a.src = url;
      
      // Attempt to route through volume sliders
      if (typeof audioCtx !== 'undefined' && audioCtx && interactGain) {
         try {
           const src = audioCtx.createMediaElementSource(a);
           src.connect(interactGain);
         } catch(e){}
      }
      
      a.onended = resolve;
      a.onerror = () => { console.warn("Audio failed", url); resolve(); }; // Safety skip
      
      // If play fails (e.g. browser block), resolve immediately so game doesn't softlock
      a.play().catch(resolve); 
    } catch (e) {
      resolve();
    }
  });

  hideBanner(); // Hide immediately when audio ends
  await sleep(250); // Tiny pause between lines for pacing
}

// ---- Merchant config ----


const MERCHANT_SPAWN_CHANCE = .20; // 20% per non-boss floor
const MERCHANT_LOOP_URL = 'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/money.mp3'; // ← your loop SFX
let merchantAudio = null, merchantNode = null, merchantGain = null;

function ensureMerchantAudio(){
  initAudio();
  if (!merchantGain){
    merchantGain = audioCtx.createGain();
    merchantGain.gain.value = 0;        // start silent
  merchantGain.connect(interactGain || masterGain);   // route via Interactables group
  }
  if (!merchantAudio){
    merchantAudio = new Audio();
    merchantAudio.crossOrigin = 'anonymous';
    merchantAudio.loop = true;
    merchantAudio.preload = 'auto';
    merchantAudio.setAttribute('playsinline','');
    merchantAudio.src = MERCHANT_LOOP_URL;
    merchantAudio.muted = true; // autoplay-safe priming
    merchantAudio.play().catch(()=>{});
  }
  if (!merchantNode && merchantAudio){
    try{
      merchantNode = audioCtx.createMediaElementSource(merchantAudio);
      merchantNode.connect(merchantGain);
    }catch{}
  }
}

function stopMerchantAudio(){
  try{ if (merchantAudio){ merchantAudio.pause(); merchantAudio.currentTime = 0; } }catch{}
  try{ if (merchantNode){ merchantNode.disconnect(); merchantNode = null; } }catch{}
  merchantAudio = null;
  if (merchantGain) merchantGain.gain.value = 0;
}

// volume rises as you approach the merchant
function updateMerchantAudio(){
  if (!merchantGain) return;

  // if merchant is gone (new floor / boss floor), force silence
  if (!state.merchant){ merchantGain.gain.value = 0; return; }

  // play until you're next to the NPC
  if (isNearMerchant(state.player.x, state.player.y)){
    merchantGain.gain.value = 0;
    return;
  }

  const d = Math.abs(state.player.x - state.merchant.x) + Math.abs(state.player.y - state.merchant.y);
  const maxD = 20; // was 12
  const v = clamp(1 - (d/maxD), 0, 1);
  const shaped = Math.pow(v, 0.65); // gentler falloff so it doesn't feel “short”

  // NOTE: Interactables slider is already applied by interactGain
  merchantGain.gain.value = shaped * 1;
}


// ---- Blacksmith config ----
const BLACKSMITH_SPAWN_CHANCE = 0.20; // 20% per non-boss floor
const BLACKSMITH_LOOP_URL = 'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/anvil-loop.mp3'; // add this file to your repo
let blacksmithAudio = null, blacksmithNode = null, blacksmithGain = null;

function ensureBlacksmithAudio(){
  initAudio();
  if (!blacksmithGain){
    blacksmithGain = audioCtx.createGain();
    blacksmithGain.gain.value = 0;
  blacksmithGain.connect(interactGain || masterGain);
  }
  if (!blacksmithAudio){
    blacksmithAudio = new Audio();
    blacksmithAudio.crossOrigin = 'anonymous';
    blacksmithAudio.loop = true;
    blacksmithAudio.preload = 'auto';
    blacksmithAudio.setAttribute('playsinline','');
    blacksmithAudio.src = BLACKSMITH_LOOP_URL;
    blacksmithAudio.muted = true;
    blacksmithAudio.play().catch(()=>{});
  }
  if (!blacksmithNode && blacksmithAudio){
    try{
      blacksmithNode = audioCtx.createMediaElementSource(blacksmithAudio);
      blacksmithNode.connect(blacksmithGain);
    }catch{}
  }
}

function stopBlacksmithAudio(){
  try{ if (blacksmithAudio){ blacksmithAudio.pause(); blacksmithAudio.currentTime = 0; } }catch{}
  try{ if (blacksmithNode){ blacksmithNode.disconnect(); blacksmithNode = null; } }catch{}
  blacksmithAudio = null;
  if (blacksmithGain) blacksmithGain.gain.value = 0;
}


function updateBlacksmithAudio(){
  if (!blacksmithGain) return;

  // if blacksmith is gone (new floor / boss floor), force silence
  if (!state.blacksmith){ blacksmithGain.gain.value = 0; return; }

  // play until you're next to the NPC
  if (isNearBlacksmith(state.player.x, state.player.y)){
    blacksmithGain.gain.value = 0;
    return;
  }

  const d = Math.abs(state.player.x - state.blacksmith.x) + Math.abs(state.player.y - state.blacksmith.y);
  const maxD = 20; // was 12
  const v = clamp(1 - (d/maxD), 0, 1);
  const shaped = Math.pow(v, 0.65);

  // NOTE: Interactables slider is already applied by interactGain
  blacksmithGain.gain.value = shaped * 1;
}



// ---- Shield config ----
const SHIELD_NAME = 'Round Shield';
const SHIELD_DR   = 0.20;   // 20% damage reduction
const SHIELD_DUR  = 20;     // max durability


// ====== Audio (WebAudio, synthesized SFX) ======

// Globals for backward compatibility (so your SFX calls still work)
var _volMaster=0.5, _volMusic=0.8, _volCombat=0.9, _volInteract=0.9, _volUi=0.9, _volFoot=1.0;
var audioCtx, masterGain, musicGain, combatGain, interactGain, uiGain, footstepGain, voiceGain;
let muted = false;
const SFX = {};

const AudioSystem = {
  channels: {
    music:    { def: 0.8, label: 'Music', var:'_volMusic', node:'musicGain' },
    voice:    { def: 1.0, label: 'Voice / Dialogue', var: null, node:'voiceGain' }, 
    combat:   { def: 0.9, label: 'Combat', var:'_volCombat', node:'combatGain' },
    enemy:    { def: 0.9, label: 'Monsters', var: null, node:'enemyGain' }, // <--- New Channel
    interact: { def: 0.9, label: 'Environment', var:'_volInteract', node:'interactGain' },
    foot:     { def: 1.0, label: 'Footsteps', var:'_volFoot', node:'footstepGain' },
    ui:       { def: 0.9, label: 'Interface', var:'_volUi', node:'uiGain' }
  },
  volumes: { master: 0.5 },

  init() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    // Create Master
    masterGain = audioCtx.createGain();
    masterGain.connect(audioCtx.destination);

    // Create Channels & Restore Saves
    Object.keys(this.channels).forEach(k => {
      const ch = this.channels[k];
      const g = audioCtx.createGain();
      g.connect(masterGain);
      
      // Assign to global variable (e.g. window.combatGain = g)
      window[ch.node] = g;

      // Load save
      const saved = localStorage.getItem(`vol_${k}`);
      this.volumes[k] = saved !== null ? parseFloat(saved) : ch.def;
    });

    const savedM = localStorage.getItem('vol_master');
    this.volumes.master = savedM !== null ? parseFloat(savedM) : 0.5;

    this.apply();
  },

  apply() {
    if (!audioCtx) return;
    // Apply Master
    const mv = muted ? 0 : this.volumes.master;
    masterGain.gain.value = mv;
    _volMaster = mv; // Sync global

    // Apply Channels
    Object.keys(this.channels).forEach(k => {
      const ch = this.channels[k];
      const vol = this.volumes[k];
      if (window[ch.node]) window[ch.node].gain.value = vol;
      // Sync legacy globals if they exist (e.g. _volMusic)
      if (ch.var && typeof window[ch.var] !== 'undefined') window[ch.var] = vol;
    });
  },

  setVol(key, val) {
    this.volumes[key] = Math.max(0, Math.min(1, val));
    this.apply();
    localStorage.setItem(`vol_${key}`, this.volumes[key]);
  }
};

// Map old init function to new system
function initAudio() { AudioSystem.init(); }
function applyGroupVolumes() { AudioSystem.apply(); }


// iOS/Android: unlock audio on first touch/click
window.addEventListener('pointerdown', initAudio, { once:true });

function tone(freq, dur=0.12, type='square', vol=0.7){
  if (!audioCtx || muted) return;
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t+0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
  o.connect(g); g.connect(masterGain);
  o.start(t); o.stop(t+dur+0.02);
}

function chord(freqs, dur=0.15, type='triangle', vol=0.5){
  const each = vol / Math.max(1, freqs.length);
  freqs.forEach(f=>tone(f, dur, type, each));
}

function noise(dur=0.08, vol=0.5, bandHz=1200){
  if (!audioCtx || muted) return;
  const n = audioCtx.sampleRate * dur;
  const buf = audioCtx.createBuffer(1, n, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i=0;i<n;i++) data[i] = (Math.random()*2-1)*0.6;

  const src = audioCtx.createBufferSource(); src.buffer = buf;
  const bp = audioCtx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=bandHz; bp.Q.value=0.7;
  const g = audioCtx.createGain(); g.gain.value = vol;
  src.connect(bp); bp.connect(g); g.connect(masterGain);
  src.start(); src.stop(audioCtx.currentTime + dur);
}

// Group-aware versions of the synth helpers
function toneTo(destGain, freq, dur=0.12, type='square', vol=0.7){
  if (!audioCtx || muted) return;
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t+0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
  o.connect(g); g.connect(destGain || masterGain);
  o.start(t);
  o.stop(t+dur+0.02);
}

function chordTo(destGain, freqs, dur=0.15, type='triangle', vol=0.5){
  const each = vol / Math.max(1, (freqs && freqs.length) || 1);
  (freqs || []).forEach(f => toneTo(destGain, f, dur, type, each));
}

function noiseTo(destGain, dur=0.08, vol=0.5, bandHz=1200){
  if (!audioCtx || muted) return;
  const n = audioCtx.sampleRate*dur;
  const buf = audioCtx.createBuffer(1, n, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i=0; i<n; i++){
    data[i] = (Math.random()*2-1)*0.6;
  }
  const src = audioCtx.createBufferSource();
  src.buffer = buf;

  const bp = audioCtx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = bandHz;
  bp.Q.value = 0.7;

  const g = audioCtx.createGain();
  g.gain.value = vol;

  src.connect(bp); bp.connect(g); g.connect(destGain || masterGain);
  src.start();
  src.stop(audioCtx.currentTime + dur);
}


// ---- Walking SFX (custom file) ----
// Replace with your hosted file (wav/ogg/mp3). Make sure it has CORS enabled.
const WALK_SFX_URL = 'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/footstep.mp3';

let walkBuf = null;
let _lastWalkAt = 0;

async function loadWalkSfx(url = WALK_SFX_URL){
  try{
    initAudio();
    const res = await fetch(url, { mode:'cors' });
    const arr = await res.arrayBuffer();
    walkBuf = await new Promise((ok, err)=>audioCtx.decodeAudioData(arr, ok, err));
  }catch(e){
    console.warn('walk sfx failed to load', e);
  }
}

function playWalkSfx(){
  if (!audioCtx || muted) return;
  const now = audioCtx.currentTime || 0;

  // throttle: joystick can step every ~120ms; keep SFX tidy
  if (now - _lastWalkAt < 0.08) return;
  _lastWalkAt = now;

  if (walkBuf){
    const src = audioCtx.createBufferSource();
    src.buffer = walkBuf;
    src.playbackRate.value = 0.95 + Math.random()*0.1; // tiny variation
    const g = audioCtx.createGain();
    g.gain.value = 0.35; // footstep volume
  src.connect(g);
  g.connect(footstepGain || masterGain); // Footsteps group
    src.start(now);
  }else{
    // fallback: your old beep if the file isn't decoded yet
    tone(220, 0.05, 'square', 0.18);
  }
}

// ---- Drink + Cast SFX (custom files) ----
// Replace these with your hosted files (CORS-enabled)
const POTION_SFX_URL = 'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/potion.mp3';
const CAST_SFX_URL   = 'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/magic.mp3';

let drinkBuf = null;
let castBuf  = null;

async function loadPotionSfx(url = POTION_SFX_URL){
  try{
    initAudio();
    const res = await fetch(url, { mode:'cors' });
    const arr = await res.arrayBuffer();
    drinkBuf = await new Promise((ok, err)=>audioCtx.decodeAudioData(arr, ok, err));
  }catch(e){ console.warn('drink sfx failed to load', e); }
}

async function loadCastSfx(url = CAST_SFX_URL){
  try{
    initAudio();
    const res = await fetch(url, { mode:'cors' });
    const arr = await res.arrayBuffer();
    castBuf = await new Promise((ok, err)=>audioCtx.decodeAudioData(arr, ok, err));
  }catch(e){ console.warn('cast sfx failed to load', e); }
}

function playDrinkSfx(){
  if (!audioCtx || muted) return;
  const now = audioCtx.currentTime || 0;

  if (drinkBuf){
    const src = audioCtx.createBufferSource();
    src.buffer = drinkBuf;
    src.playbackRate.value = 0.98 + Math.random()*0.04; // tiny variation
    const g = audioCtx.createGain();
  g.gain.value = 0.32;
  src.connect(g); g.connect(interactGain || masterGain); // Interactables group
  src.start();
} else{
  console.warn('drink sfx failed / not loaded', e);
  // fallback still respects Interactables slider
  toneTo(interactGain, 500, 0.08, 'triangle', 0.18);
}
}

function playCastSfx(){
  if (!audioCtx || muted) return;
  const now = audioCtx.currentTime || 0;

  if (castBuf){
    const src = audioCtx.createBufferSource();
    src.buffer = castBuf;
    src.playbackRate.value = 0.98 + Math.random()*0.04;
    const g = audioCtx.createGain();
  g.gain.value = 0.30;
  src.connect(g); g.connect(combatGain || masterGain); // Combat group
  src.start();
} else {
  console.warn('cast sfx failed / not loaded', e);
  // fallback in Combat group
  chordTo(combatGain, [660,880], 0.12, 'sine', 0.24);
}
}

const WEAPON_SFX = {
  one:    'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/one_handed.mp3',
  two:    'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/two_handed.mp3',
  spear:  'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/spear.mp3',
  axe:    'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/axe.mp3',
  hand:   'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/punch.mp3',
  bowShot:'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/arrow.mp3',
  break:   'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/weapon_break.mp3',
  descend: 'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/steps.mp3',

};

const _weaponBufs = {};

// generic file loader
async function _loadBuf(key, url){
  try{
    initAudio();
    const res = await fetch(url, { mode:'cors' });
    const arr = await res.arrayBuffer();
    _weaponBufs[key] = await new Promise((ok, err)=>audioCtx.decodeAudioData(arr, ok, err));
  }catch(e){ console.warn('weapon sfx failed', key, e); }
}

// load all the above in parallel
async function loadWeaponSfx(map = WEAPON_SFX){
  await Promise.all(Object.entries(map).map(([k,u])=> _loadBuf(k,u)));
}

// play a decoded buffer (with tiny pitch variation)
function playBuf(key, gain=0.4, rateJitter=0.05){
  if (!audioCtx || muted) return false;
  const now = audioCtx.currentTime || 0;
  const b = _weaponBufs[key];
  if (!b) return false;
  const src = audioCtx.createBufferSource();
  src.buffer = b;
  src.playbackRate.value = 1 - rateJitter + Math.random()*rateJitter*2;
   const g = audioCtx.createGain();
  g.gain.value = gain;

  // Route weapon / descend buffers to the correct group
  let dest = masterGain;
  switch (key){
    case 'one':
    case 'two':
    case 'spear':
    case 'axe':
    case 'hand':
    case 'bowShot':
    case 'bowDraw':
    case 'break':
      dest = combatGain || masterGain;
      break;
    case 'descend':
      dest = interactGain || masterGain;
      break;
    default:
      dest = masterGain;
  }

  src.connect(g); g.connect(dest);
  src.start(now);
  return true;
}

// tasteful synthesized fallbacks so you’re never silent
function synthSwing(type){
  const dest = combatGain || masterGain;
  switch(type){
    case 'one':   noiseTo(dest, 0.06, 0.32, 2200); break;                           // quick swish
    case 'two':   toneTo(dest, 120,0.06,'sine',0.35); noiseTo(dest,0.08,0.28,1400); break; // heavy whoosh + thump
    case 'spear': noiseTo(dest,0.05,0.28,2600); break;                              // airy thrust
    case 'axe':   toneTo(dest,180,0.05,'square',0.40); noiseTo(dest,0.04,0.22,900); break; // chunky chop
    case 'hand':  toneTo(dest,90, 0.05,'sine',0.35); break;                         // punch thud
    default:      chordTo(dest,[440,660], 0.08, 'square', 0.25);
  }
}

function playWeaponSwing(type){
  if (playBuf(type, ({two:0.48, axe:0.45}[type] || 0.38))) return;
  synthSwing(type);
}

function playBowShot(){
  if (playBuf('bowShot', 0.42, 0.03)) return;
  // fallback: bow "twang" in Combat group
  const dest = combatGain || masterGain;
  toneTo(dest, 300,0.05,'triangle',0.28);
  noiseTo(dest,0.04,0.24,1800);
}

function playBowDraw(){
  if (playBuf('bowDraw', 0.34, 0.02)) return;
  // subtle draw fallback in Combat group
  toneTo(combatGain || masterGain, 220,0.04,'sine',0.22);
}


// expose through your SFX object
function extendSfxForWeapons(){
  SFX.swingFor = (t)=>playWeaponSwing(t); // t = 'one'|'two'|'spear'|'axe'|'hand'
  SFX.bowShot  = ()=>playBowShot();
  SFX.bowDraw  = ()=>playBowDraw();       // call this when loading an arrow
}

// new: simple players (uses the same playBuf loader/fallback system)
SFX.weaponBreak = () => {
  // a touch louder, tiny pitch variance
  if (!playBuf('break', 1, 0.03)) {
    // synth fallback if file hasn't loaded
    noise(0.20, 0.30, 1600);
    tone(160, 0.06, 'square', 0.30);
  }
};

SFX.descend = () => {
  if (!playBuf('descend', 0.42, 0.02)) {
    // soft low “whoomp” fallback
    tone(180, 0.18, 'sine', 0.40);
  }
};


// kick off loads at boot (after AudioContext exists)
document.addEventListener('DOMContentLoaded', ()=>{
  extendSfxForWeapons();
  loadWeaponSfx(); // safe if files 404 — fallbacks cover you
});

// --- Custom URLs (replace with your own, CORS-enabled) ---
const SKELETON_REVIVE_URL = 'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/skeleton.mp3'; // <--- PASTE HERE
let skelReviveBuf = null;

async function loadSkelRevive(){ 
  try{ 
    initAudio(); 
    const arr = await (await fetch(SKELETON_REVIVE_URL, {mode:'cors'})).arrayBuffer(); 
    skelReviveBuf = await new Promise((ok,err)=>audioCtx.decodeAudioData(arr,ok,err)); 
  } catch(e){ console.warn('skel load fail', e); } 
}
function playSkelRevive(){
  if(!audioCtx || muted) return;
  if(skelReviveBuf){ 
    const src = audioCtx.createBufferSource(); 
    src.buffer = skelReviveBuf; 
    const g = audioCtx.createGain(); 
    g.gain.value = 0.5; 
    // Routed to the new enemy channel
    src.connect(g); g.connect(enemyGain||masterGain); 
    src.start(); 
  } else { 
    SFX.weaponBreak(); // Fallback if file isn't loaded yet
  }
}
document.addEventListener('DOMContentLoaded', loadSkelRevive);

const MISS_SFX_URL        = 'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/miss.mp3';
const LOCK_SUCCESS_SFX_URL= 'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/lockpick_success.mp3';
const CHEST_OPEN_SFX_URL  = 'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/chest.mp3';
// --- Boss BGMs (replace with your own CORS-enabled URLs) ---
const BOSS1_BGM_URL = 'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/boss1.mp3';
const BOSS2_BGM_URL = 'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/boss2.mp3';

// Buffers
let missBuf = null, lockOkBuf = null, chestOpenBuf = null;

// Loaders
async function loadMissSfx(url = MISS_SFX_URL){
  try { initAudio();
    const arr = await (await fetch(url, {mode:'cors'})).arrayBuffer();
    missBuf = await new Promise((ok, err)=>audioCtx.decodeAudioData(arr, ok, err));
  } catch (e){ console.warn('miss sfx failed to load', e); }
}
async function loadLockOkSfx(url = LOCK_SUCCESS_SFX_URL){
  try { initAudio();
    const arr = await (await fetch(url, {mode:'cors'})).arrayBuffer();
    lockOkBuf = await new Promise((ok, err)=>audioCtx.decodeAudioData(arr, ok, err));
  } catch (e){ console.warn('lock success sfx failed to load', e); }
}
async function loadChestOpenSfx(url = CHEST_OPEN_SFX_URL){
  try { initAudio();
    const arr = await (await fetch(url, {mode:'cors'})).arrayBuffer();
    chestOpenBuf = await new Promise((ok, err)=>audioCtx.decodeAudioData(arr, ok, err));
  } catch (e){ console.warn('chest open sfx failed to load', e); }
}

// Players (fall back to your current synth tones if file not ready)
function playMissSfx(){
  if (!audioCtx || muted) return;
  if (missBuf){
    const src = audioCtx.createBufferSource();
    src.buffer = missBuf;
    const g = audioCtx.createGain();
    g.gain.value = 0.32;
    src.connect(g); g.connect(combatGain || masterGain);
    src.start();
  } else {
    // fallback if file not loaded (Combat group)
    toneTo(combatGain, 220, 0.08, 'square', 0.24);
  }
}

function playLockOkSfx(){
  if (!audioCtx || muted) return;
  const now = audioCtx.currentTime || 0;
  if (lockOkBuf){
    const src = audioCtx.createBufferSource(); src.buffer = lockOkBuf;
    src.playbackRate.value = 0.98 + Math.random()*0.04;
    const g = audioCtx.createGain(); g.gain.value = 0.36;
src.connect(g); g.connect(interactGain || masterGain);
    src.start(now);
  } else {
toneTo(interactGain, 660, 0.10, 'triangle', 0.22);
  }
}
function playChestOpenSfx(){
  if (!audioCtx || muted) return;
  const now = audioCtx.currentTime || 0;
  if (chestOpenBuf){
    const src = audioCtx.createBufferSource(); src.buffer = chestOpenBuf;
    src.playbackRate.value = 0.98 + Math.random()*0.04;
    const g = audioCtx.createGain(); g.gain.value = 0.40;
src.connect(g); g.connect(interactGain || masterGain);
    src.start(now);
  } else {
chordTo(interactGain, [440,550], 0.15, 'square', 0.26);
  }
}

// Wire the new players into your SFX map
function extendSfxForUtility(){
  SFX.miss        = ()=>playMissSfx();
  SFX.lockSuccess = ()=>playLockOkSfx();
  SFX.openChest   = ()=>playChestOpenSfx();
}

// ---- Level Up SFX (custom file) ----
// swap this URL for your own hosted/CORS-enabled file
const LEVEL_UP_SFX_URL = 'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/level_up.mp3';
// Replace with your actual hosted file
const ARACHNO_SFX_URL  = 'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/arachnophobia_mode.mp3'; 

let levelUpBuf = null;

function playArachnoSound(){
    // Simple one-shot player
    const a = new Audio(ARACHNO_SFX_URL);
    a.volume = 0.5;
    a.play().catch(()=>{});
}

async function loadLevelUpSfx(url = LEVEL_UP_SFX_URL){
  try{
    initAudio();
    const res = await fetch(url, { mode:'cors' });
    const arr = await res.arrayBuffer();
    levelUpBuf = await new Promise((ok, err)=>audioCtx.decodeAudioData(arr, ok, err));
  }catch(e){ console.warn('level up sfx failed to load', e); }
}

function playLevelUpSfx(){
  if (!audioCtx || muted) return;
  const now = audioCtx.currentTime || 0;

  if (levelUpBuf){
    const src = audioCtx.createBufferSource();
    src.buffer = levelUpBuf;
    src.playbackRate.value = 1.0;
    const g = audioCtx.createGain(); g.gain.value = 0.42;
    // Changed: Routes to UI Gain instead of Combat Gain
    src.connect(g); g.connect(uiGain || masterGain);
    src.start(now);
  }else{
    // Fallback: Routes to UI Gain
    chordTo(uiGain, [392,523,659], 0.28, 'triangle', 0.32);
    toneTo(uiGain, 1046.5, 0.10, 'sine', 0.22); 
  }
}

// --- NEW: Puzzle Room Music Cue ---
const PUZZLE_ROOM_SFX_URL = 'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/puzzle_spawn.mp3'; // Replace with actual filename
let puzzleSpawnBuf = null;

async function loadPuzzleSpawnSfx(url = PUZZLE_ROOM_SFX_URL){
  try{
    initAudio();
    const res = await fetch(url, { mode:'cors' });
    const arr = await res.arrayBuffer();
    puzzleSpawnBuf = await new Promise((ok, err)=>audioCtx.decodeAudioData(arr, ok, err));
  }catch(e){ console.warn('puzzle room sfx failed to load', e); }
}

window.playPuzzleMusic = function(){
  if (!audioCtx || muted) return;
  const now = audioCtx.currentTime || 0;

  if (puzzleSpawnBuf){
    const src = audioCtx.createBufferSource();
    src.buffer = puzzleSpawnBuf;
    src.playbackRate.value = 1.0;
    const g = audioCtx.createGain(); g.gain.value = 0.50; 
    src.connect(g); g.connect(musicGain || masterGain); // Routes to Music Volume Slider
    src.start(now);
  }else{
    // Fallback synth sound if file isn't loaded yet
    chordTo(musicGain || masterGain, [440,660,880], 0.5, 'sine', 0.4);
  }
};


// Preload on boot (alongside your other loads)
document.addEventListener('DOMContentLoaded', ()=>{
  extendSfxForUtility();
  loadMissSfx();
  loadLockOkSfx();
  loadChestOpenSfx(); 
  loadLevelUpSfx();          // <-- add this line
  loadPuzzleSpawnSfx();
});

function defineSfx(){
  // --- NEW: Developer Placeholder Helper (for logging) ---
  const devSfx = (name, fn) => () => {
    // Check for the global flag (defined in settings section)
    if (window._devSounds) console.log(`[DEV SFX] ${name}`);
    if (fn) fn();
  };
  // ----------------------------------------------------
  
  SFX.step = devSfx('Step', ()=>playWalkSfx());
  SFX.drink = devSfx('Drink Potion/Tonic/Antidote', ()=>playDrinkSfx());

  // Combat (Attacks, Hits, Deaths)
  SFX.attack      = devSfx('Melee Hit: Generic Attack', ()=>chordTo(combatGain, [440,660], 0.08, 'square', 0.25));
  SFX.miss        = devSfx('Melee/Ranged Miss', ()=>playMissSfx());
  SFX.enemyHit    = devSfx('Player Hurt', ()=>toneTo(enemyGain, 140, 0.10, 'sawtooth', 0.28));
  SFX.kill        = devSfx('Enemy Kill', ()=>chordTo(enemyGain, [392, 523, 659], 0.20, 'triangle', 0.32));
  
  // Environment (Interactables: Chests, Doors, Stairs)
  SFX.openChest   = devSfx('Chest Open', ()=>playChestOpenSfx()); // Uses interactGain internally
  SFX.lockSuccess = devSfx('Lockpick Success', ()=>playLockOkSfx()); // Uses interactGain internally
  SFX.lockFail    = devSfx('Lockpick Fail', ()=>toneTo(interactGain, 110, 0.12, 'sawtooth', 0.22));
  SFX.bossDown    = devSfx('Boss Down/Stairs Spawn', ()=>chordTo(interactGain, [196, 262, 392, 523], 0.35, 'triangle', 0.35)); // Moved to Interact

  // UI / System (Pickups, Level Up)
  SFX.pickup      = devSfx('Item/Gold Pickup/Upgrade Ready', ()=>chordTo(uiGain, [880,1320], 0.08, 'triangle', 0.22)); // Moved to UI
  SFX.levelUp     = devSfx('Player Level Up/Upgrade', ()=>playLevelUpSfx()); // Route changed in player function below

  // Magic / Status (Combat)
  SFX.spell       = devSfx('Spell Cast', ()=>playCastSfx());
  SFX.rangedZap   = devSfx('Enemy Ranged Hit', ()=>toneTo(enemyGain, 900, 0.11, 'sine', 0.26));
  SFX.poisonTick  = devSfx('Poison Tick', ()=>noiseTo(enemyGain, 0.06, 0.25, 1000));
  SFX.antidote    = devSfx('Antidote Cure', ()=>chordTo(combatGain, [523,659], 0.12, 'triangle', 0.24));
}

document.addEventListener('DOMContentLoaded', defineSfx);

// Mute button
document.addEventListener('DOMContentLoaded', ()=>{
  const b = document.getElementById('btnMute');
  if (!b) return;
  b.onclick = ()=>{
    initAudio();
    muted = !muted;
    if (masterGain) masterGain.gain.value = muted ? 0 : 0.5;
    b.textContent = muted ? '🔇' : '🔊';
  };
});

// --- NEW: Tab Switching Logic ---
window.switchTab = function(tabName) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  if(event) event.target.classList.add('active');
  document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-' + tabName).classList.add('active');
};

// Settings sliders → per-group volume
document.addEventListener('DOMContentLoaded', ()=>{
  const container = document.getElementById('audioSettingsList');
  if (container) {
    // Define the Visual Layout (Headers + Sliders)
    const layout = [
      { type: 'slider', key: 'master', label: 'Master Volume', class: 'master-slider' },
      
      { type: 'header', label: 'Music & Voice' },
      { type: 'slider', key: 'music', label: 'Background Music' },
      { type: 'slider', key: 'voice', label: 'NPC Dialogue' }, 
      
      { type: 'header', label: 'Sound Effects' },
      { type: 'slider', key: 'combat',   label: 'Player Combat' },
      { type: 'slider', key: 'enemy',    label: 'Monsters & Enemies' }, // <--- New Slider
      { type: 'slider', key: 'interact', label: 'World & Environment' },
      { type: 'slider', key: 'foot',     label: 'Footsteps' },
      { type: 'slider', key: 'ui',       label: 'Menus & UI' },
    ];

    container.innerHTML = '';

    layout.forEach(item => {
      if (item.type === 'header') {
        const h = document.createElement('div');
        h.style.cssText = 'color:#f9d65c; font-size:12px; font-weight:800; text-transform:uppercase; margin:15px 0 5px 0; border-bottom:1px solid rgba(255,255,255,0.1); opacity:0.8;';
        h.textContent = item.label;
        container.appendChild(h);
        return;
      }

      // Render Slider
      const val = AudioSystem.volumes[item.key] ?? 0.5;
      const div = document.createElement('div');
      div.className = 'vol-group';
      if(item.class) div.classList.add(item.class);

      div.innerHTML = `
        <div class="vol-header" style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:14px;">
          <span>${item.label}</span>
          <span id="label_${item.key}" style="opacity:0.8">${Math.round(val * 100)}%</span>
        </div>
        <input type="range" class="custom-slider" min="0" max="100" value="${val * 100}" style="width:100%; cursor:pointer;">
      `;

      const input = div.querySelector('input');
      const label = div.querySelector(`#label_${item.key}`);

      input.addEventListener('input', (e) => {
        const v = e.target.value / 100;
        AudioSystem.setVol(item.key, v);
        label.textContent = Math.round(v * 100) + '%';
        if (!audioCtx) AudioSystem.init();
      });

      container.appendChild(div);
    });
  }

  // --- Window Mode Wiring (Electron Only) ---
  const selWin = document.getElementById('selWindowMode');
  const titleBar = document.getElementById('titleBar');
  
  // Helper to toggle bar visibility
  const updateTitleBar = (mode) => {
    if (titleBar) titleBar.style.display = (mode === 'windowed') ? 'flex' : 'none';
  };

  // Wire up the Traffic Light Buttons
  if (typeof require !== 'undefined') {
    try {
      const { ipcRenderer } = require('electron');
      document.getElementById('btnWinMin')?.addEventListener('click', () => ipcRenderer.send('win-min'));
      document.getElementById('btnWinMax')?.addEventListener('click', () => ipcRenderer.send('win-max'));
      document.getElementById('btnWinClose')?.addEventListener('click', () => window.close());
    } catch(e){}
  }

  const savedMode = localStorage.getItem('windowMode') || 'fullscreen'; // Changed default to fullscreen
  
  if (selWin) {
      selWin.value = savedMode;
      updateTitleBar(savedMode); // Apply visual state immediately

      selWin.addEventListener('change', () => {
          const mode = selWin.value;
          localStorage.setItem('windowMode', mode);
          updateTitleBar(mode); // Toggle the bar
          
          if (typeof require !== 'undefined') {
              try {
                  require('electron').ipcRenderer.send('set-window-mode', mode);
              } catch(e) {}
          }
      });
      
      // Force apply logic on startup
      if (typeof require !== 'undefined') {
          try { require('electron').ipcRenderer.send('set-window-mode', savedMode); } catch(e){}
      }
  }

  // --- Arachnophobia Mode Wiring ---
  const chkArachno = document.getElementById('chkArachno');
  window._arachnophobiaMode = (localStorage.getItem('arachnoMode') === '1');
  if (chkArachno) {
    chkArachno.checked = window._arachnophobiaMode;
    chkArachno.addEventListener('change', ()=>{
       window._arachnophobiaMode = chkArachno.checked;
       localStorage.setItem('arachnoMode', chkArachno.checked ? '1' : '0');
       if (chkArachno.checked && typeof playArachnoSound === 'function') playArachnoSound();
       if(typeof draw === 'function') draw();
    });
  }

  // --- Reset Data Wiring ---
  document.getElementById('btnResetData')?.addEventListener('click', () => {
    if(confirm("Are you sure? This will wipe ALL progress, purchases, and high scores forever.")){
      localStorage.clear();
      window.location.reload();
    }
  });

  // --- Developer Sounds Wiring ---
  const chkDev = document.getElementById('chkDevSounds');
  window._devSounds = (localStorage.getItem('devSounds') === '1');
  let devTries = 0;
  // Temporary denial sounds (placeholders)
  const devDenials = [
    'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/miss.mp3', // Placeholder 1
    'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/miss.mp3', // Placeholder 2
    'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/miss.mp3', // Placeholder 3
    'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/miss.mp3', // Placeholder 4
    'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/miss.mp3'  // Placeholder 5
  ];

  if (chkDev) {
    chkDev.checked = window._devSounds;
    chkDev.addEventListener('click', (e) => {
        // If enabling, and not fully unlocked (tries < 5), intercept
        if (chkDev.checked && devTries < 5) {
            e.preventDefault(); // Stop it from checking
            
            // Play Audio Bite (Blocking)
            const audio = new Audio(devDenials[devTries]);
            // Lock input/UI
            document.body.style.pointerEvents = 'none'; 
            audio.play().catch(()=>{});
            
            audio.onended = () => {
                document.body.style.pointerEvents = 'auto'; // Unlock
                devTries++;
            };
            // Fallback unlock if audio fails
            audio.onerror = () => { document.body.style.pointerEvents = 'auto'; devTries++; };
            return;
        }

        // 6th click or disabling: Allow toggle
        window._devSounds = chkDev.checked;
        localStorage.setItem('devSounds', chkDev.checked ? '1' : '0');
        if (window._devSounds) alert("Developer Sounds Activated! (Placeholder: Implement audio swap logic here)");
    });
  }
});


// ====== Background Music (custom file) ======
let bgmAudio = null;   // <audio> element
let bgmNode  = null;   // MediaElementAudioSourceNode
let bgmGain  = null;   // gain for BGM (routes into masterGain)
let bgmUrl   = null;   // object URL for the chosen file

function attachBgmNodeIfNeeded(){
  // Fix: Connect immediately if context exists, regardless of state.
  // This prevents the audio from playing "raw" (loud) before routing.
  if (!audioCtx) return; 
  
  if (!bgmAudio || bgmNode) return;
  try {
    bgmNode = audioCtx.createMediaElementSource(bgmAudio);
    bgmNode.connect(bgmGain);
  } catch (e) {
    // ignore
  }
}



function ensureBgmNodes(){
  initAudio();
  if (!bgmGain){
  bgmGain = audioCtx.createGain();
  bgmGain.gain.value = 0.25;       // BGM base volume
  bgmGain.connect(musicGain || masterGain); // route through Music group
}

}

function stopBgm(){
  if (bgmAudio){
    bgmAudio.pause();
    bgmAudio.currentTime = 0;
  }
}

function unloadBgm(){
  stopBgm();
  if (bgmNode){ try{ bgmNode.disconnect(); }catch{} bgmNode = null; }
  if (bgmAudio){ bgmAudio.src=''; bgmAudio = null; }
  if (bgmUrl){ URL.revokeObjectURL(bgmUrl); bgmUrl = null; }
}

function setBgmFromFile(file){
  ensureBgmNodes();
  unloadBgm();

  bgmAudio = new Audio();
  bgmAudio.muted = true;                 // prime for autoplay
  bgmAudio.crossOrigin = 'anonymous';
  bgmAudio.loop = true;
  bgmAudio.preload = 'auto';
  bgmAudio.setAttribute('playsinline','');
  bgmAudio.volume = 1;

  bgmUrl = URL.createObjectURL(file);
  bgmAudio.src = bgmUrl;

  // Do NOT connect to AudioContext until first user gesture
  // (attach happens inside kick)
  bgmAudio.play().catch(()=>{});         // will succeed after first tap
}

function setBgmUrl(url){
  ensureBgmNodes();
  unloadBgm();

  bgmAudio = new Audio();
  bgmAudio.muted = true;                 // prime for autoplay
  bgmAudio.crossOrigin = 'anonymous';
  bgmAudio.loop = true;
  bgmAudio.preload = 'auto';
  bgmAudio.setAttribute('playsinline','');
  bgmAudio.volume = 1;

  bgmAudio.src = url;

  // Do NOT connect to AudioContext until first user gesture
  // (attach happens inside kick)
  bgmAudio.play().catch(()=>{});         // will succeed after first tap
}




function setBgmVolume(v){ // optional helper: 0..1
  ensureBgmNodes();
  bgmGain.gain.value = Math.max(0, Math.min(1, v));
}

// Wire the BGM button + file input
document.addEventListener('DOMContentLoaded', ()=>{
  const btn = document.getElementById('btnBgm');
  const inp = document.getElementById('bgmFile');
  if (!btn || !inp) return;

  // Click BGM → choose a local audio file
  btn.onclick = ()=>{
    initAudio();
    inp.click();
  };

  // Load & loop the chosen track
  inp.onchange = ()=>{
  const f = inp.files && inp.files[0];
  if (!f) return;

  setBgmFromFile(f);

  // IMPORTANT: user just interacted, so we can safely wire + unmute now
  attachBgmNodeIfNeeded();
  if (bgmAudio){
    bgmAudio.muted = false;
    bgmAudio.play()?.catch(()=>{});
  }

  btn.textContent = 'BGM ▶';
};

  // Optional: middle-click BGM to pause/resume
btn.addEventListener('auxclick', ()=>{
  if (!bgmAudio) return;
  if (bgmAudio.paused){ bgmAudio.play(); btn.textContent='BGM ▶'; }
  else { bgmAudio.pause(); btn.textContent='BGM ❚❚'; }
});
}); // <-- end of the BGM button wiring block

// Gameplay / Menu BGM
const CLASSIC_BGM_URL = 'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/bg.mp3';
const ENDLESS_BGM_URL = 'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/bg.mp3';

// Title + Menu BGM (set these to your actual files)
const TITLE_BGM_URL = 'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/title_music.mp3';

// IMPORTANT: change this to your menu track you uploaded
const MENU_BGM_URL  = 'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/DungeonCrawlerAudio@main/title_music.mp3';

function playTitleBgm(){
  // 1. If track is loaded but paused (autoplay blocked), try playing again
  if (bgmAudio && bgmAudio.src === TITLE_BGM_URL) {
    if (bgmAudio.paused) bgmAudio.play()?.catch(()=>{});
    return;
  }

  // 2. Otherwise load and play fresh
  ensureBgmNodes();
  setBgmUrl(TITLE_BGM_URL);
  attachBgmNodeIfNeeded();
  if (bgmAudio){ 
    bgmAudio.volume = 1.0;
    bgmAudio.muted = false; 
    bgmAudio.play()?.catch(()=>{}); 
  }
}

// (Deleted)

function playGameBgm(url){
  ensureBgmNodes();
  setBgmUrl(url);              
  attachBgmNodeIfNeeded();     
  if (bgmAudio){ bgmAudio.muted = false; bgmAudio.play()?.catch(()=>{}); }
}

// --- NEW: Dynamic Music Selector ---
function updateDynamicMusic() {
  let url = DEFAULT_BGM_URL;
  const f = state.floor;

  // 1. BOSS FLOORS (10, 20, 30...)
  if (f % 10 === 0) {
    // Find the boss entity to get its Type
    const boss = state.enemies && state.enemies.find(e => e.boss);
    if (boss && MUSIC_CONFIG.bosses[boss.type]) {
       url = MUSIC_CONFIG.bosses[boss.type];
    } else {
       // Fallback for generic boss or if spawn hasn't happened yet (Cutscenes)
       url = MUSIC_CONFIG.bosses['Clone']; 
    }
  } 
  // 2. EXPLORATION FLOORS
  else {
    const biomes = ['sewers', 'crypt', 'magma', 'ruins', 'void', 'gilded'];
    // Cycle through biomes (0-5), looping for Endless mode
    const biomeIndex = Math.floor((f - 1) / 10) % biomes.length;
    const biomeKey = biomes[biomeIndex];
    
    // Floors 1-4 = Early, 5-9 = Late
    const subFloor = f % 10;
    if (subFloor >= 1 && subFloor <= 4) {
       url = MUSIC_CONFIG[biomeKey].early;
    } else {
       url = MUSIC_CONFIG[biomeKey].late;
    }
  }

  // Only switch if the URL is different from what's playing
    // FIX: If it matches but is paused (due to restart), force play
    if (bgmAudio && bgmAudio.src === url) {
       if (bgmAudio.paused) bgmAudio.play().catch(()=>{});
       return;
    } 
    playGameBgm(url);
}




// --- Global modal helpers (accessible from gameplay code) ---
window.openModal = function openModal(sel){
  const m = document.querySelector(sel);
  if (!m) return;
  m.style.display = 'flex';
  document.body.classList.add('noscroll');
};
window.closeModal = function closeModal(sel){
  const m = document.querySelector(sel);
  if (!m) return;
  m.style.display = 'none';
  document.body.classList.remove('noscroll');
};



// ====== Boot: Title → Menu → Game ======
document.addEventListener('DOMContentLoaded', ()=>{
  // Preload default BGM element (muted); we’ll unmute on first user gesture
  

  // Small helper to open/close our simple modals (reuses your .modal styles)
 
  document.addEventListener('click', (e)=>{
    const btn = e.target.closest('[data-close]');
    if (!btn) return;
    const sel = btn.getAttribute('data-close');
    const m = document.querySelector(sel);
    if (m){ m.style.display = 'none'; document.body.classList.remove('noscroll'); }
  });

  // Unlock audio + connect loops + preload some sfx (safe to call multiple times)
function unlockAudioAndLoops(){
  try { initAudio?.(); } catch {}
  try {
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(()=>{});
  } catch {}

  // NPC loops (ok if not present yet)
  try { ensureMerchantAudio?.(); if (merchantAudio){ merchantAudio.muted=false; merchantAudio.play()?.catch(()=>{}); } } catch {}
  try { ensureBlacksmithAudio?.(); if (blacksmithAudio){ blacksmithAudio.muted=false; blacksmithAudio.play()?.catch(()=>{}); } } catch {}
try { ensureJesterAudio?.(); if (jesterAudio){ jesterAudio.muted=false; jesterAudio.play()?.catch(()=>{}); } } catch {}
  try { ensureCartographerAudio?.(); if (cartographerAudio){ cartographerAudio.muted=false; cartographerAudio.play()?.catch(()=>{}); } } catch {}
  try { ensureClericAudio?.(); if (clericAudio){ clericAudio.muted=false; clericAudio.play()?.catch(()=>{}); } } catch {}

  // Preload a few common SFX so first use isn’t delayed
  try { loadWalkSfx?.(); loadPotionSfx?.(); loadCastSfx?.(); } catch {}
}


  // Transition: Title → Menu
const title = document.getElementById('titleScreen');
const menu  = document.getElementById('mainMenu');

// ✅ Start title BGM while we're waiting on "Press to Start"
try {
  if (typeof playTitleBgm === 'function') playTitleBgm();
} catch {}

function syncEndlessUnlockUI(){
  const unlocked = localStorage.getItem('endlessUnlocked') === '1';
  const el = document.getElementById('btnEndless');
  if (!el) return;

  if (unlocked){
    el.textContent = 'Endless Mode';
    el.classList.remove('disabled');
    el.removeAttribute('aria-disabled');
    el.setAttribute('title','');
    el.style.pointerEvents = 'auto';
    el.tabIndex = 0;
  } else {
    el.textContent = '???';
    el.classList.add('disabled');
    el.setAttribute('aria-disabled','true');
    el.setAttribute('title','Unlock after beating Classic');
    el.style.pointerEvents = 'none';
    el.tabIndex = -1;
  }
}


// --- NEW: Save/Load System ---
const SAVE_KEY = 'dc_save_v1';

window.saveRun = function(){
  if(state.gameOver) return;
  const copy = { ...state };

  // --- FIX: Freeze Timer for Save ---
  if (state.run && typeof currentRunMs === 'function') {
      copy.run.elapsedMs = currentRunMs(); 
      copy.run.startAt = 0;
  }
  
  // Explicitly ensure floorEffect is preserved in the copy
  copy.floorEffect = state.floorEffect;

  // Serialize Sets/Maps
  copy.seen = Array.from(state.seen||[]);
  copy.corridor = Array.from(state.corridor||[]);
  copy.lockedDoors = Array.from(state.lockedDoors||[]);
  copy.puzzleDoors = Array.from(state.puzzleDoors||[]);
  copy.mimicChests = Array.from(state.mimicChests||[]);
  if(state.redChests) copy.redChests = Array.from(state.redChests.entries());
  
  // Clean heavy objects
  delete copy.particles; delete copy.floatingText; delete copy.projectiles;
  localStorage.setItem(SAVE_KEY, JSON.stringify(copy));
  showBanner("Game Saved.", 2000);
};

window.loadRun = function(){
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if(!raw) return false;
    const d = JSON.parse(raw);
    
    // Restore Sets/Maps
    d.seen = new Set(d.seen);
    d.corridor = new Set(d.corridor);
    d.lockedDoors = new Set(d.lockedDoors);
    d.puzzleDoors = new Set(d.puzzleDoors);
    d.mimicChests = new Set(d.mimicChests);
    if(d.redChests) d.redChests = new Map(d.redChests);

    Object.assign(state, d);

    // --- FIX: Refresh Floor Effect Visuals (Tint) ---
    const tintEl = document.getElementById('floorTint');
    if (tintEl) {
        // Handle both single strings and arrays (Endless Mode)
        const active = Array.isArray(state.floorEffect) ? state.floorEffect[0] : state.floorEffect;
        let c = 'rgba(0,0,0,0)';
        if (active === 'MiasmaChamber') c = 'rgba(34,197,94,0.18)';
        else if (active === 'Bloodhunt') c = 'rgba(190,24,93,0.14)';
        else if (active === 'GlacialFreeze') c = 'rgba(165,243,252,0.15)';
        else if (active === 'VolatileAether') c = 'rgba(234, 88, 12, 0.15)';
        else if (active === 'AntiMagic') c = 'rgba(100, 100, 100, 0.25)';
        else if (active === 'ArcaneFlux') c = 'rgba(147, 51, 234, 0.15)';
        else if (active === 'StaminaDrain') c = 'rgba(234, 234, 234, 0.15)';
        tintEl.style.background = c;
    }
    
    // --- FIX: Resume Timer ---
    if (state.run) {
        state.run.startAt = Date.now();
        state.run.endAt = 0;
        if (typeof __runTimerIvl !== 'undefined' && __runTimerIvl) clearInterval(__runTimerIvl);
        if (typeof updateRunTimerNow === 'function') {
            updateRunTimerNow();
            window.__runTimerIvl = setInterval(updateRunTimerNow, 100);
        }
    }
    // -------------------------
    
    // --- FIX: Force Unlock Inputs & Visuals ---
    state._inputLocked = false;   
    state._pauseOpen = false;     
    state.gameOver = false;       
    
    // Close any lingering modals (Pause, Inventory, etc.)
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
    
    // Restore Visuals
    enemyStep(); 
    draw(); 
    updateBars(); 
    updateEquipUI(); 
    renderSkills();
    
    // --- FIX: Force Music Restart ---
    if(typeof initAudio === 'function') initAudio(); 
    if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    
    // Stop Menu Music & Start Game Music
    if(typeof stopBgm === 'function') stopBgm();
    setTimeout(() => {
        if(typeof updateDynamicMusic === 'function') updateDynamicMusic();
    }, 100); // Slight delay to ensure audio context is ready
    
    return true;
  } catch(e){ console.error(e); return false; }
};

function goMenu(e){
  if (e?.preventDefault) e.preventDefault();

  const b = document.getElementById('banner');
  if (b) b._queue = []; 
  hideBanner();         

  unlockAudioAndLoops();

  if (typeof playTitleBgm === 'function') {
    playTitleBgm();
  }

  if (title) title.style.display = 'none';
  if (menu)  menu.style.display  = 'flex';

  // Reset Submenus
  if(document.getElementById('mm-main')) document.getElementById('mm-main').style.display = 'flex';
  if(document.getElementById('mm-play')) document.getElementById('mm-play').style.display = 'none';
  if(document.getElementById('mm-stats')) document.getElementById('mm-stats').style.display = 'none';

  syncEndlessUnlockUI();
  if(typeof updateMainMenuShopLabel === 'function') updateMainMenuShopLabel(); 

// --- NEW: Check Save & Wire Continue Button ---
  const hasSave = !!localStorage.getItem(SAVE_KEY);
  const btnCont = document.getElementById('btnContinue');
  
  if(btnCont){
    // Update: Button is now in the sub-menu, but logic is same
    btnCont.style.display = hasSave ? 'block' : 'none';
    
    btnCont.onclick = (ev) => {
      ev.preventDefault();
      if(window.loadRun()){
        // Hide Main Menu overlay
        document.getElementById('mainMenu').style.display='none';
        
        // Ensure "Play" submenu resets for next time
        document.getElementById('mm-main').style.display = 'flex';
        document.getElementById('mm-play').style.display = 'none';
      }
    };
  }
}


  // ▶ Make goMenu available to the pause menu and other scripts
  window.goMenu = goMenu;

async function startTutorial(e){
  if (e?.preventDefault) e.preventDefault();
  if (menu) menu.style.display = 'none';
  playGameBgm(CLASSIC_BGM_URL);
  
  state.gameMode = 'tutorial';
  doRestart('Adventurer'); 

  // --- 1. Init Tutorial State ---
  state.tutorialStep = 1; // Start at Step 1
  state._tutProgress = {}; // Generic container for sub-flags (wasd, items used)
  state._tutMoveWASD = { w:false, a:false, s:false, d:false }; // Movement tracking
  state._inputLocked = false;

  // --- 2. Build Linear Map (10 wide, 60 high) ---
  state.tiles = Array(60).fill().map(()=>Array(20).fill(0));
  state.rooms = [{x:5,y:5,w:10,h:50}];
  for(let y=5; y<55; y++){
    for(let x=5; x<15; x++){
      state.tiles[y][x] = 1;
    }
  }

 // --- 3. Player Start ---
  state.player.x = 10; state.player.y = 6;
  state.player.rx=10; state.player.ry=6;
  state.player.stamina = 20;
  state.seen = new Set(['10,6']);

  // --- 4. Place Static Obstacles ---
  
  // Step 3: Crate at Y=12
  for(let x=5; x<15; x++) state.tiles[12][x] = 0; // Wall row
  state.tiles[12][10] = 8; // Prop
  state.props['10,12'] = { type:'crate' }; 

  // Step 5: 3 Stunned Rats at Y=18
  state.enemies = [
    {x:9, y:18, type:'Rat', hp:1, atk:[0,0], xp:0, stunTicks:9999, tutorialDummy:true},
    {x:10, y:18, type:'Rat', hp:1, atk:[0,0], xp:0, stunTicks:9999, tutorialDummy:true},
    {x:11, y:18, type:'Rat', hp:1, atk:[0,0], xp:0, stunTicks:9999, tutorialDummy:true},
    // REMOVED: Step 6 rat (now spawns dynamically in useWeaponArt)
    // Step 8: 1 Stationary Rat at Y=30 (Bow Target)
    {x:10, y:30, type:'Rat', hp:1, atk:[0,0], xp:0, stunTicks:9999, tutorialDummy:true}
  ];

  // Step 12: Locked Door at Y=45
  for(let x=5; x<15; x++) state.tiles[45][x] = 0; 
  state.tiles[45][10] = 2; 
  state.lockedDoors = new Set(['10,45']);

  // Step 13: Chest at Y=48
  state.tiles[48][10] = 3;

  updateBars(); updateEquipUI(); draw();

  showBanner(`Step 1: Move with (${getInputName('move')}). Press all 4 directions to continue.`, 999999);
}


 function startClassic(e){
  if (e?.preventDefault) e.preventDefault();
  if (menu) menu.style.display = 'none';
  
  state.gameMode = 'classic';
  
  // Trigger Restart logic (Checks for Classes)
  // Music is now handled INSIDE doRestart()
  doRestart(); 
}

function startEndless(e){
  if (e?.preventDefault) e.preventDefault();
  if (menu) menu.style.display = 'none';
  window.state = window.state || {};

  // Mark mode + music
  state.gameMode = 'endless';
 
  // Trigger Restart logic (Checks for Classes)
  // Music is now handled INSIDE doRestart()
  doRestart();
}



document.getElementById('btnEndless')?.addEventListener('click', startEndless);
syncEndlessUnlockUI();  // ← ensures the label shows ??? or Endless Mode on first load

document.getElementById('btnReturnToMenu')?.addEventListener('click', ()=>{
  // unlock Endless
  localStorage.setItem('endlessUnlocked', '1');

  // close the modal
  const m = document.querySelector('#classicClearModal');
  if (m){ m.style.display='none'; document.body.classList.remove('noscroll'); }

  // reflect unlock in the menu
  if (typeof syncEndlessUnlockUI === 'function') syncEndlessUnlockUI();
  
  // --- FIX: Go to Score Entry instead of Menu ---
  // This triggers the saveScore() logic which awards Soul Shards
  if (typeof openScoreEntry === 'function') {
      openScoreEntry();
  } else {
      if (typeof goMenu === 'function') goMenu();
  }
});



// Title: click/tap anywhere or press Enter/Space to go to Menu
if (title){
  const go = (e)=>{ goMenu(e); };

  // pointer/touch anywhere on title
  title.addEventListener('pointerdown', go, { once:true });
  title.addEventListener('touchstart',  go, { once:true, passive:true });

  // keyboard (Enter/Space)
  title.addEventListener('keydown', (e)=>{
    if (e.key === 'Enter' || e.key === ' ') goMenu(e);
  });

  // make container focusable for keyboard
  title.focus?.();
}



// Wire Menu buttons
  // -- Navigation Logic --
  const showMenuLayer = (id) => {
    ['mm-main','mm-play','mm-stats'].forEach(x => {
      const el = document.getElementById(x);
      if(el) el.style.display = (x === id) ? 'flex' : 'none';
    });
  };

  document.getElementById('btnMenuPlay')?.addEventListener('click', () => showMenuLayer('mm-play'));
  document.getElementById('btnMenuStats')?.addEventListener('click', () => showMenuLayer('mm-stats'));
  document.getElementById('btnMenuBackPlay')?.addEventListener('click', () => showMenuLayer('mm-main'));
  document.getElementById('btnMenuBackStats')?.addEventListener('click', () => showMenuLayer('mm-main'));

  // -- Actions --
  document.getElementById('btnTutorial')?.addEventListener('click', startTutorial);
  document.getElementById('btnClassic') ?.addEventListener('click', startClassic);
  // Fix: Force z-index higher than Main Menu (9999) so they are clickable
  document.getElementById('btnSettings')?.addEventListener('click', ()=>{
    // FIX: Wake up audio engine and wire up the music so sliders work immediately
    try {
      if (typeof initAudio === 'function') initAudio();
      
      const doWire = () => {
        // Connect the "naked" audio element to the volume controls
        if (typeof attachBgmNodeIfNeeded === 'function') attachBgmNodeIfNeeded();
        // Force the current slider values to apply instantly
        if (typeof applyGroupVolumes === 'function') applyGroupVolumes();
      };

      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().then(doWire).catch(()=>{});
      } else {
        doWire();
      }
    } catch(e) { console.warn(e); }

    const m = document.querySelector('#settingsOverlay');
    if(m) m.style.zIndex = '10001'; 
    openModal('#settingsOverlay');
  });
  
  document.getElementById('btnCredits') ?.addEventListener('click', ()=>{
    const m = document.querySelector('#creditsOverlay');
    if(m) m.style.zIndex = '10001';
    openModal('#creditsOverlay');
  });

  // --- NEW: Quit Game Button ---
  document.getElementById('btnQuitGame')?.addEventListener('click', ()=>{
    // Standard way to close the window (works in Browser tabs and Electron)
    window.close();
  });
  
// --- FIX: Codex Button Wiring ---
  document.getElementById('btnCodex')?.addEventListener('click', () => {
    // 1. Populate the content (so it's not empty)
    if (typeof renderCodexUI === 'function') renderCodexUI();
    
    // 2. Show the overlay
    const m = document.getElementById('codexOverlay');
    if (m) {
        m.style.zIndex = '10001'; // Force it above the Main Menu
        m.style.display = 'flex';
    }
  });

// Leaderboard button in stats menu
  document.getElementById('btnShowLeaderboard')?.addEventListener('click', () => {
    const m = document.getElementById('scoreModal');
    const ent = document.getElementById('scoreEntry');
    const lst = document.getElementById('hiscoreList');
    if (m && lst) {
        m.style.zIndex = '10001';           // <--- FIX: Force z-index above Main Menu (9999)
        m.style.display = 'flex';
        if(ent) ent.style.display = 'none'; // Hide entry form
        lst.style.display = 'block';        // Show list
        if(typeof renderHiscores === 'function') renderHiscores();
    }
  });

  // --- NEW: Soul Shop Button ---
  document.getElementById('btnShop')?.addEventListener('click', (e)=>{
    e.preventDefault();
    // Ensure audio context is unlocked if clicking from a cold start
    try { if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); } catch{}
    
    renderShopUI();
    
    // Manual display set in case window.openModal isn't catching the z-index override
    const m = document.getElementById('shopModal');
    if(m) {
        m.style.display = 'flex';
        m.style.zIndex = '10001'; // Force it via JS too, just to be safe
    }
  });
  updateMainMenuShopLabel(); // Init label on load
  syncEndlessUnlockUI();                     // ← ensures label is correct on first open





  function syncEndlessUnlockUI(){
  const el = document.getElementById('btnEndless');
  if (!el) return;
  if (localStorage.getItem('endlessUnlocked') === '1'){
    el.textContent = 'Endless Mode';
    el.classList.remove('disabled');
    el.removeAttribute('aria-disabled');
    el.title = '';
  } else {
    el.textContent = '???';
    el.classList.add('disabled');
    el.setAttribute('aria-disabled','true');
    el.title = 'Unlock after beating Classic';
  }
}


  // Fallback: if overlays are missing, just start immediately (dev safety)
  if (!title && !menu){
    unlockAudioAndLoops();
    try { if (typeof boot === 'function') boot(); } catch {}
    requestAnimationFrame(()=>{ try { draw?.(); } catch {} });
  }
});




// (optional niceties)
document.addEventListener('visibilitychange', ()=>{
  if (document.visibilityState==='visible' && audioCtx && audioCtx.state==='suspended'){
    audioCtx.resume().catch(()=>{});
  }
});
window.addEventListener('beforeunload', ()=>{ try{ unloadBgm(); }catch{} });



// ---- Config (add this) ----
const ENABLE_RANDOM_DOORS = true;

// --- Healing percentages ---
const POTION_PCT = 0.25;   // 35% of Max HP (change as you like)
const TONIC_PCT  = 0.30;   // 40% of Max MP (change as you like)
// --- Heal spell percentage (per tier) ---
const HEAL_PCT_BASE     = 0.20; // Lv1 Heal = 20% of Max HP
const HEAL_PCT_PER_TIER = 0.075; // +7.5% per tier (Lv2=26%, Lv3=32%, etc.)
// === Magic config ===
// MP cost increment per tier (Lv1 is baseline)
const SPELL_COST_STEP_PER_TIER = 8;  // Increased: High level spells drain MP fast
const SPELL_DMG_STEP_PER_TIER_MIN = 4;  // Reduced: Slower power creep
const SPELL_DMG_STEP_PER_TIER_MAX = 4;  // Reduced: Slower power creep



const DURABILITY = {
  Shortsword: 22,
  'Key of Destiny': 20,
  Claymore:   10,
  'Warhammer': 8,
  Spear:      18,
  'Halberd':   16,
  Axe:        14,
  'Battleaxe': 12,
  'Knuckle Duster': 26,
  'Claws':     24,
  
  // Staffs
  'Fire Staff':      15,
  'Ice Staff':       15,
  'Lightning Staff': 15,
  'Wind Staff':      15,
  'Earth Staff':     15
};
function defaultDurabilityFor(name){
  if (!name) return null;
  let baseName = name;
  
  // Strip upgrades so the dictionary finds it
  const match = baseName.match(/(.+) \+(\d+)$/);
  if (match) baseName = match[1];

  // Strip affixes
  if (baseName.includes('Cursed ')) {
     baseName = baseName.replace('Cursed ', '');
     baseName = baseName.replace('Blood ', '').replace('Greed ', '').replace('Rust ', '').replace('Frailty ', '');
  }
  if (baseName.includes('Sharp '))       baseName = baseName.replace('Sharp ', '');
  else if (baseName.includes('Heavy '))  baseName = baseName.replace('Heavy ', '');
  else if (baseName.includes('Vampiric ')) baseName = baseName.replace('Vampiric ', '');
  else if (baseName.includes('Ancient ')) baseName = baseName.replace('Ancient ', '');

  return Number.isFinite(DURABILITY[baseName]) ? DURABILITY[baseName] : null; // fists/null => no durability
}


// ====== Sprites (emoji-based; zero assets) ======
const SPRITES = {
  Rat: '🐀',
  Goblin: '🧌',   // surprise me
  Slime: '🟢',    // surprise me
  Skeleton: '💀',
  Mage: '🧙',
  Door: '🚪',
  Chest: '💰'
};
function drawEmoji(ctx, glyph, x, y, w, h){
  // Draws a single emoji centered in the rect (x,y,w,h)
  const size = Math.min(w, h) * 0.9; // slight padding
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  ctx.font = `bold ${size}px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif`;
  ctx.fillText(glyph, x + w/2, y + h/2);
}

