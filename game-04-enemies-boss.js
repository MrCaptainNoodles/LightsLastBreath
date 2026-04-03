// ====== Enemy Step (chase) ======
function neighbors4(x,y){ return [[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>({x:x+dx,y:y+dy})) }
function clearStraightLine(a,b,c,d){
  // Only supports same row or same column LOS
  if (a!==c && b!==d) return false;
  const sx = Math.sign(c-a), sy = Math.sign(d-b);
  let x = a, y = b;
  // step UNTIL destination, checking blockers on the path
  while (x !== c || y !== d){
    x += sx; y += sy;
    if (!inBounds(x,y)) return false;
    const t = state.tiles[y][x];
    // walls (0) and CLOSED doors (2) block line of sight
    if (t === 0 || t === 2) return false;
  }
  return true;
}

// --- Footprint-aware helpers for big enemies (boss = 2x2) ---
function enemyFootprintMinDist(x, y, size){
  // min Manhattan distance from any tile in its footprint to the player
  let best = Infinity;
  for (let yy=0; yy<size; yy++){
    for (let xx=0; xx<size; xx++){
      best = Math.min(best, Math.abs((x+xx)-state.player.x) + Math.abs((y+yy)-state.player.y));
    }
  }
  return best;
}

// --- replace your whole enemyCanEnterSize with this ---
function enemyCanEnterSize(x, y, size, ignoreEnemy = null){
  for (let yy = 0; yy < size; yy++){
    for (let xx = 0; xx < size; xx++){
      const gx = x + xx, gy = y + yy;
      if (!inBounds(gx, gy)) return false;
      if (gx === state.player.x && gy === state.player.y) return false;

      const occ = enemyAt(gx, gy);           // may be self
      if (occ && occ !== ignoreEnemy) return false;

      const t = state.tiles[gy][gx];
      if (!(t === 1 || t === 4)) return false;
    }
  }
  return true;
}


// Greedy chase step (try axis that closes distance; then fallbacks)
function greedyStepToward(e){
  const size = e.size || 1;
  const canEnter = size>1 ? (x,y)=>enemyCanEnterSize(x,y,size,e) : (x,y)=>enemyCanEnter(x,y);

  const dx = Math.sign(state.player.x - e.x);
  const dy = Math.sign(state.player.y - e.y);

  const primaryFirst = (Math.abs(state.player.x - e.x) >= Math.abs(state.player.y - e.y))
    ? [[dx,0],[0,dy],[dx,dy],[dx,-dy],[-dx,dy]]
    : [[0,dy],[dx,0],[dx,dy],[dx,-dy],[-dx,dy]];

  const curD = size>1 ? enemyFootprintMinDist(e.x,e.y,size)
                      : Math.abs(e.x-state.player.x)+Math.abs(e.y-state.player.y);

  let equal = null;
  for (const [sx,sy] of primaryFirst){
    const nx = e.x+sx, ny = e.y+sy;
    if (!canEnter(nx,ny)) continue;
    const nd = size>1 ? enemyFootprintMinDist(nx,ny,size)
                      : Math.abs(nx-state.player.x)+Math.abs(ny-state.player.y);
    if (nd < curD) return {x:nx,y:ny, better:true};
    if (nd === curD) equal = {x:nx,y:ny, better:false};
  }
  return equal || null;
}

function bfsStepToward(e, maxSteps=48){
  const size = e.size || 1;
  const canEnter = size>1 ? (x,y)=>enemyCanEnterSize(x,y,size,e) : (x,y)=>enemyCanEnter(x,y);


  const startKey = e.x+','+e.y;
  const q = [{x:e.x,y:e.y}];
  const parent = new Map([[startKey, null]]);
  let foundKey = null;

  while (q.length && parent.size < 1200){
    const cur = q.shift();
    if (cur.x === state.player.x && cur.y === state.player.y){ foundKey = cur.x+','+cur.y; break; }
    for (const n of neighbors4(cur.x,cur.y)){
      if (!canEnter(n.x,n.y)) continue;
      const k = n.x+','+n.y;
      if (parent.has(k)) continue;
      parent.set(k, cur);
      q.push({x:n.x,y:n.y});
    }
    if (--maxSteps <= 0) break;
  }

  if (!foundKey){
    // choose reached node closest to player
    let bestK = null, bestD = Infinity;
    for (const [k] of parent){
      const [x,y] = k.split(',').map(Number);
      const d = Math.abs(x - state.player.x) + Math.abs(y - state.player.y);
      if (d < bestD){ bestD = d; bestK = k; }
    }
    if (!bestK || bestK === startKey) return null;
    foundKey = bestK;
  }

  // walk back one step from foundKey to first move from start
  let curK = foundKey, prev = parent.get(curK);
  while (prev && (prev.x+','+prev.y) !== startKey){
    curK = prev.x+','+prev.y;
    prev = parent.get(curK);
  }
  const [sx, sy] = curK.split(',').map(Number);
  if (sx === e.x && sy === e.y) return null;
  return { x:sx, y:sy };
}

// Small BFS to route around obstacles when greedy can't progress
function bfsStepToward(e, maxSteps=48){
  const size = e.size || 1;
  const canEnter = size>1 ? (x,y)=>enemyCanEnterSize(x,y,size,e) : (x,y)=>enemyCanEnter(x,y);

  const start = e.x+','+e.y;
  const q = [{x:e.x,y:e.y}];
  const parent = new Map([[start, null]]);
  let foundKey = null;

  while (q.length && parent.size < 1200){
    const cur = q.shift();
    const k = cur.x+','+cur.y;

    // stop early if we reached any tile adjacent (or best) to the player
    const d = size>1 ? enemyFootprintMinDist(cur.x,cur.y,size)
                     : Math.abs(cur.x - state.player.x) + Math.abs(cur.y - state.player.y);
    if (d <= 1){ foundKey = k; break; }

    for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx = cur.x+dx, ny = cur.y+dy;
      const nk = nx+','+ny;
      if (parent.has(nk)) continue;
      if (!canEnter(nx,ny)) continue;
      parent.set(nk, k);
      q.push({x:nx,y:ny});
      if (--maxSteps <= 0) break;
    }
    if (maxSteps <= 0) break;
  }

  if (!foundKey){
    // pick the explored node that minimized distance if none hit d<=1
    let bestKey = null, bestD = Infinity;
    for (const nk of parent.keys()){
      const [xx,yy] = nk.split(',').map(Number);
      const dd = size>1 ? enemyFootprintMinDist(xx,yy,size)
                        : Math.abs(xx - state.player.x) + Math.abs(yy - state.player.y);
      if (dd < bestD){ bestD = dd; bestKey = nk; }
    }
    foundKey = bestKey;
  }
  if (!foundKey) return null;

  // backtrack one step from foundKey toward start
  let stepKey = foundKey;
  while (stepKey && parent.get(stepKey) !== start){
    stepKey = parent.get(stepKey);
  }
  if (!stepKey || stepKey === start) return null;
  const [sx,sy] = stepKey.split(',').map(Number);
  return {x:sx,y:sy, better:true};
}


// remove one thing from player and return a descriptor (or null)
function goblinStealOne(){
  // priority: potion > tonic > lockpicks > one weapon stack
  if (state.inventory.potions>0){ state.inventory.potions--; return {kind:'potion', payload:1}; }
  if (state.inventory.tonics>0){ state.inventory.tonics--; return {kind:'tonic', payload:1}; }
  if (state.inventory.lockpicks>0){ state.inventory.lockpicks--; return {kind:'lockpicks', payload:1}; }
  const entries = Object.entries(state.inventory.weapons);
  if (entries.length){
    const [name,count] = entries[0];
    state.inventory.weapons[name] = Math.max(0, count-1);
    if (state.inventory.weapons[name]===0) delete state.inventory.weapons[name];
    return {kind:'weapon', payload:{name}};
  }
  return null;
}


// drop a stolen thing near (x,y) without overwriting stairs
function dropStolenNear(x, y, stolen){
  // If the tile is not stairs, prefer here; else try adjacent.
  const isStairs = inBounds(x,y) && state.tiles[y][x] === 4;

  const tryPlace = (tx, ty) => {
    if (!inBounds(tx,ty)) return false;
    // don’t place on stairs; only on floor with no enemy or pickup
    if (state.tiles[ty][tx] !== 1) return false;
    const k = key(tx,ty);
    if (state.pickups[k]) return false;
    if (enemyAt(tx,ty)) return false;
    state.pickups[k] = (stolen.kind === 'weapon')
      ? {kind:'weapon', payload: stolen.payload}
      : {kind: stolen.kind, payload: (stolen.payload||1)};
    state.tiles[ty][tx] = 5;
    return true;
  };

  if (!isStairs) {
    if (tryPlace(x,y)) return;
  }

  // try the four cardinals
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  for (const [dx,dy] of dirs) {
    if (tryPlace(x+dx, y+dy)) return;
  }

  // last resort: find any free floor a few tiles away
  const spot = (typeof findFreeFloorTile === 'function') ? findFreeFloorTile(3) : null;
  if (spot) {
    tryPlace(spot.x, spot.y);
  }
}


let _hurtTO;
function flashDamage(){
  const f = document.getElementById('hurtFlash');
  if(!f) return;

  // cancel any in-progress fade so consecutive hits feel responsive
  if (_hurtTO) clearTimeout(_hurtTO);

  // pop to darker red and hold very briefly
  f.style.background = 'rgba(255,0,0,0.38)'; // slightly darker
  _hurtTO = setTimeout(()=>{
    f.style.background = 'rgba(255,0,0,0.0)'; // then fade via CSS
    _hurtTO = null;
  }, 90); // hold ~90ms before fading over 480ms
}
function flashEnemy(e, color='red', ms=100){
  e._flashColor = color;
  e._flashTime = Date.now() + ms;
  
  // Force the game to redraw after the flash time is up
  // This ensures the red/green tint disappears even if you don't move
  setTimeout(() => {
    if (typeof draw === 'function') draw();
  }, ms + 20);
}
// ===== Per-floor enemy templates =====
function floorEnemyKinds(){
  const f = state.floor | 0;
  const scale = 1 + Math.max(0, f - 1) * 0.12; // +12% per floor

  // base (floor 1) stats, then scale every floor
  const base = {
    Rat:      { hp: 4, atk:[1,2], xp: 3 },
    Bat:      { hp: 3, atk:[1,2], xp: 3 }, // Weak but heals
    Spider:   { hp: 5, atk:[2,3], xp: 4 }, // Slows you
    Slime:    { hp: 5, atk:[1,3], xp: 4 },
    Goblin:   { hp: 6, atk:[2,4], xp: 5 },
    Skeleton: { hp: 7, atk:[2,5], xp: 6 },
    Mage:     { hp: 8, atk:[3,6], xp: 7 }
  };

  // progressive availability
  const pool = [];
  if (f >= 1) pool.push('Rat');
  if (f >= 2) pool.push('Bat');    // Early unlock
  if (f >= 3) pool.push('Slime');
  if (f >= 4) pool.push('Spider'); // Mid-early unlock
  if (f >= 5) pool.push('Goblin');
  if (f >= 7) pool.push('Skeleton');
  if (f >= 8) pool.push('Mage');

  // build scaled kinds
  const kinds = pool.map(name=>{
    const b = base[name];
    return {
      type: name,
      hp: Math.max(1, Math.round(b.hp * scale)),
      atk: [
        Math.max(0, Math.floor(b.atk[0] * scale)),
        Math.max(1, Math.floor(b.atk[1] * scale))
      ],
      xp: Math.max(1, Math.round(b.xp * (1 + Math.max(0, f - 1) * 0.10)))

    };
  });

  return kinds;
}



// ===== Respawn helper =====
function tryRespawnOneEnemy(){
  if (!Array.isArray(state.rooms) || !state.rooms.length) return;
  if (!Array.isArray(state.enemies)) state.enemies = [];
  const cap = (typeof state.enemyCap === 'number') ? state.enemyCap : Infinity;
if (state.enemies.length >= cap) return;

  // pick a random non-start room
  let guard = 0;
  while (guard++ < 400) {
    const r = state.rooms[rand(1, state.rooms.length - 1)];
    if (!r) continue;
    const x = rand(r.x + 1, r.x + r.w - 2);
    const y = rand(r.y + 1, r.y + r.h - 2);

    // safe tile, not near player, no enemy sitting there
    if (state.tiles?.[y]?.[x] !== 1) continue;
    if (dist(x, y, state.player.x, state.player.y) <= 6) continue;
    if (enemyAt(x, y)) continue;

    // SAFE ROOM: block respawns
if (state.safeRect){
  const r = state.safeRect;
  if (x >= r.x && x < r.x+r.w && y >= r.y && y < r.y+r.h) continue;
}


    // pick a kind similar to your floor generation
    const kinds = floorEnemyKinds();
    const k = kinds[Math.floor(Math.random() * kinds.length)];

    const e = { x, y, type: k.type, hp: k.hp, atk: [...k.atk], xp: k.xp };
    if (k.type === 'Rat')      e.poisonChance = 0.20;
    if (k.type === 'Goblin') { e.fast = true; e.stealChance = 0.20; }
    if (k.type === 'Slime')  { e.slow = true; e._skipMove = false; }
    if (k.type === 'Skeleton'){ e._revived = false; }
    if (k.type === 'Mage')   { e.ranged = true; e.range = 3; }

    state.enemies.push(e);
    break;
  }
}

function triggerGameOver(){
  if (state.gameOver) return;

  // Perk: Phoenix (Revive with 50% HP once per run)
  if (state.skills?.survivability?.perks?.['sur_b2'] && !state.run.phoenixUsed) {
      state.run.phoenixUsed = true;
      state.player.hp = Math.floor(state.player.hpMax * 0.5);
      spawnFloatText("PHOENIX", state.player.x, state.player.y, '#f97316');
      log("You rise from the ashes!");
      if (typeof updateBars === 'function') updateBars();
      return; // Intercept Game Over
  }

  // --- FIX: Delete Save on Death ---
  localStorage.removeItem('dc_save_v1');

  state.gameOver = true;
  const m = document.getElementById('gameOverModal');
  if (m) {
    m.style.display = 'flex';
    
    // KH REFERENCE: Rare death message
    const title = m.querySelector('.title');
    if (title) {
        if (Math.random() < 0.10) { 
            title.textContent = "Your heart has been lost...";
            title.style.color = "#ff0000"; // Optional: make it red
        } else {
            title.textContent = "Game Over";
            title.style.color = ""; // Reset color
        }
    }
  }
  
  state.run.ended = true;
  stopRunTimerFreeze(); 
  // FIX: Instead of just calling openScoreEntry, we must hide the Game Over modal 
  // and trigger the score flow, which is tied to the scoreModal being opened.
  if (typeof openScoreEntry === 'function') {
      // Hide the initial Game Over screen so the Score Entry can appear
      m.style.display = 'none'; 
      openScoreEntry(); 
  }
}


// Helper: Check if effect is active (handles Array or String)
function isEffectActive(name){
  if (Array.isArray(state.floorEffect)) return state.floorEffect.includes(name);
  return state.floorEffect === name;
}

// Helper: Stamina cost multiplier
function getStaminaCost(base){
  return isEffectActive('StaminaDrain') ? base * 2 : base;
}

function enemyStep(){
  // --- REAPER MECHANIC ---
  if (!state.gameOver && !state._inputLocked && !state._descending) {
      state.gameTurn = (state.gameTurn || 0) + 1;
      
      // 1. Detect Stairs Visibility
      if (!state.stairsFoundTurn) {
        for (let y=0; y<state.size.h; y++) {
          for (let x=0; x<state.size.w; x++) {
            if (state.tiles[y][x] === 4 && state.seen.has(x+','+y)) {
               state.stairsFoundTurn = state.gameTurn;
               log("The stairs are revealed... you feel a cold presence.");
            }
          }
        }
      }
      // 2. Spawn Reaper (e.g., 50 turns after finding stairs)
    if (state.stairsFoundTurn && !state.reaperSpawned && (state.gameTurn - state.stairsFoundTurn > 250) && state.floor % 10 !== 0) {
      state.reaperSpawned = true;
      // Try to spawn far from player
         let spawn = findFreeFloorTile(15) || {x:1, y:1};
         state.enemies.push({
           type: 'Reaper', x: spawn.x, y: spawn.y,
           hp: 999, hpMax: 999, atk: [999,999], xp: 0,
           invincible: true
         });
         showBanner("THE REAPER HAS AWOKEN", 4000);
         SFX.descend(); // Reuse descend sound for spooky effect
      }
  }
  // -----------------------

  // --- NEW: Stamina Regen ---
  if (state._skipStaminaRegen) {
    state._skipStaminaRegen = false; 
  } 
  else if (state.player.stamina < state.player.staminaMax) {
    // Stamina Drain Effect: Regenerate every OTHER turn
    if (isEffectActive('StaminaDrain')) {
       if (state._stamDrainTick) state.player.stamina++;
       state._stamDrainTick = !state._stamDrainTick;
    } else {
       state.player.stamina++;
    }
    updateBars();
  }

  // (Passive MP Regen REMOVED)

  // --- NEW: Idol of Rot (Aura Damage) ---
  // Deals 1 damage to all enemies within 3 tiles every turn
  if (state.inventory.idols?.['Idol of Rot']) {
      state.enemies.forEach(e => {
          if (dist(state.player.x, state.player.y, e.x, e.y) <= 3) { 
              e.hp -= 1;
              spawnFloatText("Rot", e.x, e.y, '#5f2e86'); 
              if (e.hp <= 0) handleEnemyDeath(e, 'rot');
          }
      });
      // Cleanup dead
      state.enemies = state.enemies.filter(e => e.hp > 0);
  }

  // --- NEW: Cursed Weapon Tick ---
  const cw = state.player.weapon;
  if (cw && cw.cursed) {
    if (cw.curseType === 'blood') {
      // 15% chance per turn to lose 1 HP
      if (Math.random() < 0.15) {
        state.player.hp = Math.max(1, state.player.hp - 1);
        spawnFloatText("-1 HP", state.player.x, state.player.y, '#ef4444');
        log("The cursed blade drinks your blood.");
        updateBars();
      }
    } else if (cw.curseType === 'greed') {
      // 20% chance per turn to lose 1-2 Gold
      if (Math.random() < 0.20 && state.inventory.gold > 0) {
        const loss = rand(1,2);
        state.inventory.gold = Math.max(0, state.inventory.gold - loss);
        spawnFloatText("-" + loss + "g", state.player.x, state.player.y, '#facc15');
        log("The cursed blade consumes your wealth.");
      }
    }
  }
  // ------------------------------

  // --- NEW: Cooldown & Buff Ticks ---
  if (state.player.rampageTicks > 0) {
    state.player.rampageTicks--;
    if (state.player.rampageTicks === 0) log("Your rampage subsides.");
  }

  if (state.player.artCooldown > 0) {
    state.player.artCooldown--;
    
    // FIX: Update UI every turn so the number visibly counts down (9..8..7..)
    updateEquipUI();

    if (state.player.artCooldown === 0) {
      log("Weapon Art ready!");
      SFX.pickup(); // Chime sound
    }
  }
  // -------------------------

// === player status that ticks once per enemy phase ===
  // Trinket: Amulet of Life (1 HP per 50 turns)
  if (state.player.trinket?.name === 'Amulet of Life') {
    state.player.regenTicker = (state.player.regenTicker || 0) + 1;
    if (state.player.regenTicker >= 20) { // Buffed: 50 -> 20 turns
      state.player.regenTicker = 0;
      if (state.player.hp < state.player.hpMax) {
        state.player.hp++;
        updateBars();
        log("Amulet of Life restores 1 HP.");
      }
    }
  }

  // Perk: Troll Blood (Regen 1 HP every 10 turns)
  if (state.skills?.survivability?.perks?.['sur_b3']) {
    state.player.trollTicker = (state.player.trollTicker || 0) + 1;
    if (state.player.trollTicker >= 10) {
      state.player.trollTicker = 0;
      if (state.player.hp < state.player.hpMax) {
        state.player.hp++;
        updateBars();
        spawnFloatText("+1", state.player.x, state.player.y, '#4ade80');
      }
    }
  }

  // --- NEW: Cleric Blessing Tick ---
  if (state.player.blessTicks > 0) {
    state.player.blessTicks--;
    if (state.player.blessTicks === 0) log("The holy blessing fades.");
  }
  // --------------------------------

  if (state.player.poisoned && state.player.poisonTicks > 0){
    state.player.poisonTicks--;
    const t = state.player.poisonTicks;
    if (t > 0 && (t % 2 === 0)){
      // Scale: 1 dmg base + 1 per 15 floors (F1=1, F15=2, F30=3)
      const p = damageAfterDR(1 + Math.floor(state.floor/15));
      if (p > 0){
        state.player.hp = clamp(state.player.hp - p, 0, state.player.hpMax);
        flashDamage();
        SFX.poisonTick?.();
        log(`Poison burns you for ${p}.`);
        updateBars();
        if (state.player.hp <= 0){ triggerGameOver(); return; }
      } else {
        log('Your Survivability shrugs off the poison.');
      }
    }
    if (t === 0){ state.player.poisoned = false; log('The poison fades.'); }
  }

if ((state.player.bow?.loaded|0) === 0 && (state.inventory.arrows|0) > 0){
    state.inventory.arrows--;
    state.player.bow.loaded = 1;
    log('You notch a new arrow.');
    updateEquipUI?.();
  }

  // --- NEW: Volatile Aether Ticks ---
  if (state.explosions && state.explosions.length) {
    // Iterate backwards to safely remove
    for (let i = state.explosions.length - 1; i >= 0; i--) {
      const bomb = state.explosions[i];
      bomb.timer--;
      
      if (bomb.timer > 0) {
        spawnFloatText(bomb.timer + "...", bomb.x, bomb.y, '#f97316');
      } else {
        // EXPLODE
        state.explosions.splice(i, 1);
        spawnParticles(bomb.x, bomb.y, '#f97316', 8);
        SFX.weaponBreak(); // Explosion sound
        
        // 3x3 AoE
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const tx = bomb.x + dx, ty = bomb.y + dy;
            
            // Hit Player
            if (tx === state.player.x && ty === state.player.y) {
              const dmg = damageAfterDR(10);
              state.player.hp -= dmg;
              flashDamage();
              log(`Aether explosion hits you for ${dmg}!`);
            }
            
           // Hit Enemy
            const e = enemyAt(tx, ty);
            if (e) {
              e.hp -= 10;
              spawnFloatText(10, e.x, e.y, '#f97316');
              if (e.hp <= 0) {
                 // Force central death handler
                 // Note: handleEnemyDeath will spawn the NEXT explosion for us
                 handleEnemyDeath(e, 'magic');
              
            

                 // --- FIX: Award XP for Explosion Kills ---
                 state.player.xp += (e.xp || 1);
                 while(state.player.xp >= state.player.next){
                    state.player.xp -= state.player.next;
                    state.player.level++;
                    state.player.next = Math.floor(state.player.next * 1.30);
                    if(typeof openLevelUpModal === 'function') openLevelUpModal(); 
                 }
                 // ----------------------------------------
              }
            }
          }
        }
      }
    }
  }
  // ----------------------------------

// === each enemy acts ===
  for (const e of state.enemies){
    // --- NEW: Reaper Logic ---
    if (e.type === 'Reaper') {
  // Move logic: Tick counter (set % 1 to move every turn)
  e._tick = (e._tick || 0) + 1;
  if (e._tick % 1 !== 0) continue; 
  
  // Ignore walls: Simply step towards player
        let nx = e.x;
        let ny = e.y;
        if (Math.abs(state.player.x - e.x) > Math.abs(state.player.y - e.y)) {
          nx += Math.sign(state.player.x - e.x);
        } else {
          ny += Math.sign(state.player.y - e.y);
        }

        let inPuzzle = false;
        if (state.puzzleRooms) {
          for (const pr of state.puzzleRooms) {
            if (nx >= pr.x && nx < pr.x + pr.w && ny >= pr.y && ny < pr.y + pr.h) inPuzzle = true;
          }
        }
        if (!inPuzzle) {
          e.x = nx;
          e.y = ny;
        }

        // Kill if ON TOP (0) or ADJACENT (1)
  const dist = Math.abs(e.x - state.player.x) + Math.abs(e.y - state.player.y);
  if (dist <= 1) {
    state.player.hp = 0;
    triggerGameOver();
    log("The Reaper claims your soul.");
  }
  continue; // Skip standard logic
}
    // -------------------------

    // 1. FIXED: Calculate distance inline (Math.abs) and use unique name (d2p) to avoid errors
    const d2p = Math.abs(e.x - state.player.x) + Math.abs(e.y - state.player.y);

    // --- NEW: Aggro/Vision Check ---
    // If enemy is far away (8+ tiles) and healthy, they stay idle.
    // (Exceptions: Bosses, Elites, or if they've been damaged)
    const AGGRO_RANGE = 8;
    if (d2p > AGGRO_RANGE && !e.boss && !e.elite && e.hp >= e.hpMax) {
      continue; // Skip turn (Idle)
    }

    // --- NEW: Lazy Init HP Max (Ensures healing works for standard mobs) ---
    if (!e.hpMax) e.hpMax = e.hp;

// --- SAFE MAGE HEALING LOGIC ---
    if (e.type === 'Mage' && e.hp > 0 && !e.recovering && !e.stunTicks && !e.sleep && !e.charging) {
      // 1. Safety: Explicitly grab the latest enemy list to avoid targeting dead units
      const currentEnemies = state.enemies || [];

      // 2. Find injured ally: Must be ALIVE (hp > 0), not self, and close
      const ally = currentEnemies.find(a => 
        a !== e && 
        a.hp > 0 && 
        (Math.abs(a.x - e.x) + Math.abs(a.y - e.y)) <= 4 && 
        a.hp < a.hpMax
      );

      if (ally) {
        const amt = rand(3, 6);
        ally.hp = Math.min(ally.hp + amt, ally.hpMax);
        
        // Visuals
        if (typeof spawnFloatText === 'function') spawnFloatText("+" + amt, ally.x, ally.y, '#4ade80');
        if (typeof flashEnemy === 'function') flashEnemy(ally, 'green');

        // 3. Projectile Safety: Wrap in try-catch to prevent "Input Lock" freezes
        if (state.seen.has(key(e.x, e.y))) {
          log(`The Mage heals the ${ally.type}!`);
          try {
            if (typeof spawnProjectileEffect === 'function') {
              spawnProjectileEffect({ 
                kind: 'magic', color: '#4ade80', 
                fromX: e.x, fromY: e.y, 
                toX: ally.x, toY: ally.y, 
                speed: 0.15, 
                onDone: ()=>{} // Empty callback is safer than missing one
              });
            }
          } catch(err) {
            console.warn("Heal animation failed (prevented freeze):", err);
          }
        }
        continue; // End Mage turn
      }
    }
    // -------------------------------

    // --- NEW: Reaper Logic ---
    if (e.type === 'Reaper') {
       // Move only on even turns (Slow)
       if ((state.gameTurn % 2) !== 0) continue; 
       
       // Ignore walls: Simply step towards player
       if (Math.abs(state.player.x - e.x) > Math.abs(state.player.y - e.y)) {
          e.x += Math.sign(state.player.x - e.x);
       } else {
          e.y += Math.sign(state.player.y - e.y);
       }
       
       // Kill on touch
       if (e.x === state.player.x && e.y === state.player.y) {
          state.player.hp = 0;
          triggerGameOver();
          log("The Reaper claims your soul.");
       }
       continue; // Skip standard logic
    }

    // --- NEW: Shadow / Clone Logic ---
    if (e.type === 'Clone' || e.type === 'Shadow') {
       
       // A. WEAPON MIRRORING (Passive Melee Only)
       const pWep = state.player.weapon;
       
       // If player changed melee weapon, copy it (reset range to 1)
       if (e._lastWep !== pWep.name) {
          e._lastWep = pWep.name;
          e.range = 1;
          e.ranged = false; 
          // Only log if it's a significant shift (not just init)
          if(e._lastWep) spawnFloatText("SHIFT", e.x, e.y, '#a78bfa');
       }

       // B. ACTION MIMICRY (Active)
       if (state.lastPlayerAction) {
          const act = state.lastPlayerAction;
          let didMimic = false; // <--- Track if we actually did something

          // 1. BOW SHOT MIMICRY
          if (act.type === 'bow') {
             e.range = 5;
             e.ranged = true;
             spawnFloatText("DRAW!", e.x, e.y, '#a78bfa');
             log(`The Shadow pulls a bow from the void!`);
             
             spawnProjectileEffect({
                kind: 'arrow', color: '#a78bfa',
                fromX: e.x, fromY: e.y, toX: state.player.x, toY: state.player.y,
                onDone: () => {
                   const dmg = rand(2, 5); 
                   state.player.hp = clamp(state.player.hp - dmg, 0, state.player.hpMax);
                   flashDamage();
                   spawnFloatText(dmg, state.player.x, state.player.y, '#a78bfa');
                   updateBars();
                }
             });
             didMimic = true;
          }
          
          // 2. HEAL MIMICRY
          else if (act.type === 'heal') {
             const healAmt = Math.max(1, Math.ceil(act.amount * 0.25));
             e.hp = Math.min(e.hp + healAmt, e.hpMax);
             spawnFloatText("+" + healAmt, e.x, e.y, '#0f0');
             log("The Shadow mocks your weakness and heals!");
             flashEnemy(e, 'green');
             didMimic = true;
          }
          
          // 3. SPELL ECHO
          else if (act.type === 'spell') {
             spawnFloatText(act.name.toUpperCase(), e.x, e.y, '#a78bfa');
             log(`The Shadow echoes your ${act.name}!`);
             
             // Calculate trajectory so it stops at walls (max range 10)
             const dx = Math.sign(state.player.x - e.x);
             const dy = Math.sign(state.player.y - e.y);
             const endPos = getProjectileEnd(e.x, e.y, dx, dy, 10);

             spawnProjectileEffect({
                kind: 'magic', element: 'Shadow', color: '#a78bfa',
                fromX: e.x, fromY: e.y, toX: endPos.x, toY: endPos.y,
                onDone: () => {
                   // Only damage if it actually hit the player
                   if (endPos.x === state.player.x && endPos.y === state.player.y) {
                       const dmg = rand(3, 6);
                       state.player.hp = clamp(state.player.hp - dmg, 0, state.player.hpMax);
                       flashDamage();
                       spawnFloatText(dmg, state.player.x, state.player.y, '#a78bfa');
                       updateBars();
                   } else {
                       spawnFloatText("Blocked", e.x, e.y, '#9ca3af');
                   }
                }
             });
             didMimic = true;
          }
          
          // 4. WEAPON ART ECHO
          else if (act.type === 'art') {
             spawnFloatText(act.name.toUpperCase() + "!", e.x, e.y, '#ff0000');
             log(`The Shadow mimics your ${act.name}!`);
             const dmg = rand(5, 8);
             state.player.hp = clamp(state.player.hp - dmg, 0, state.player.hpMax);
             flashDamage();
             updateBars();
             didMimic = true;
          }

          // <--- CRITICAL FIX: STOP TURN IF MIMIC HAPPENED ---
          if (didMimic) {
             state.lastPlayerAction = null; 
             continue; // Forces the game to skip the "Zap" or "Attack" logic below
          }
       }
    }
    // ---------------------------------
    
    // 1. RECOVERY PHASE (The "Rest")
    if (e.recovering) {
      e.recovering = false; // Clear flag, act next turn
      spawnFloatText("Vulnerable!", e.x, e.y, '#9ca3af');
      continue; // Skip turn entirely
    }

    // 2. CHARGE EXECUTION (The "Crush")
    if (e.charging) {
      e.charging = false; 
      e.recovering = true; // <--- Restore: Boss must rest next turn
      
      // Check adjacency
      let adj = false;
      const s = e.size || 1;
      for (let yy=0; yy<s; yy++){
        for (let xx=0; xx<s; xx++){
          if (Math.abs((e.x+xx) - state.player.x) + Math.abs((e.y+yy) - state.player.y) === 1) adj = true;
        }
      }
      
      if (adj) {
        const dmg = rand(e.atk[1] * 2, e.atk[1] * 3); // Massive Dmg
        state.player.hp = clamp(state.player.hp - dmg, 0, state.player.hpMax);
        flashDamage();
        spawnFloatText("CRUSH: " + dmg, state.player.x, state.player.y, '#ff0000');
        log(`The ${e.type} CRUSHES you for ${dmg}!`);
        updateBars();
        if (state.player.hp <= 0){ triggerGameOver(); return; }
      } else {
        log(`The ${e.type} swings wildly and misses!`);
        spawnFloatText("Miss!", e.x, e.y, '#9ca3af');
      }
      continue; 
    }

   // --- NEW: Mad King Summon Ability ---
    // If it's the Mad King, not charging, and player is far away (range > 4)
    if (e.type === 'Mad King' && !e.charging && d2p > 4 && Math.random() < 0.20) {
       // Try to spawn a Skeleton nearby
       const spot = neighbors4(e.x, e.y).find(n => state.tiles[n.y]?.[n.x] === 1 && !enemyAt(n.x, n.y));
       if (spot) {
         spawnFloatText("ARISE!", e.x, e.y, '#a78bfa');
         // Spawn a weak "Royal Guard" (Skeleton)
         state.enemies.push({
           type: 'Skeleton', x: spot.x, y: spot.y, 
           hp: 4, atk: [2,3], xp: 0, // Low HP/XP minions
           _revived: true // Don't let them revive, keep clutter down
         });
         spawnParticles(spot.x, spot.y, '#a78bfa', 8);
         log('The Mad King summons a Royal Guard!');
         continue; // Use turn
       }
    }
    // ------------------------------------

// 3. START CHARGE (15% Chance if Player is close)
    // "Sprinkled in" - mostly they will skip this and do normal attacks below
    if ((e.boss || e.elite) && !e.charging && !e.recovering && d2p <= 2 && Math.random() < 0.15) {
       e.charging = true;
       log(`The ${e.type} begins to charge a massive attack!`);
       spawnFloatText("⚠️ CHARGING", e.x, e.y, '#ffae00');
       continue; // Skip normal movement
    }
    // -------------------------------------

    const s = e.size || 1;

    // status effects on the enemy
    if (e.bleedTicks > 0){
      e.bleedTicks--;
      e.hp -= (e.bleedDmg|0) || 1;
      if (e.hp <= 0){
        // Route through central handler
        handleEnemyDeath(e, 'spear'); // Assume spear/bleed source
        continue;
      }
    }
    if (e.stunTicks > 0){ e.stunTicks--; continue; }

    // “slow” = act every other enemy phase
    if (e.slowTicks > 0){
      e._skipMove = !e._skipMove;
      if (e._skipMove){ e.slowTicks--; continue; }
      e.slowTicks--;
    }

// how many steps can this enemy attempt this phase
let moves = 1;
if (e.fast) moves = 2;
if (e.slow){ e._skipMove = !e._skipMove; if (e._skipMove) moves = 0; }

const eRange = e.range || 1; 
const distToPlayer = dist(e.x, e.y, state.player.x, state.player.y);

// Bloodhunt (Endless only): if the enemy is outside your vision radius, it gets +1 move.
if (state.gameMode !== 'classic' && state.floorEffect === 'Bloodhunt') {
  const rad = state.player.tempVisionRange || state.fovRadius;
  if (distToPlayer > rad) moves += 1;
}


// If enemy is ranged (range > 1) AND is currently within attack range 
// AND is NOT adjacent to the player (dist > 1) 
if (eRange > 1 && distToPlayer <= eRange && distToPlayer > 1) {
    // Halt movement to maintain the optimal firing distance.
    moves = 0; 
    // We still allow 'fast' enemies (like Goblins) to keep moving to prevent
    // them from stacking up right outside their attack range.
    if (e.fast) moves = 1; 
}


    // helper that respects 2×2 bodies AND ignores the mover itself
    const canEnterPoint = (x, y) => {
      return (s > 1) ? enemyCanEnterSize(x, y, s, e) // ← pass e so 2×2 doesn’t collide with itself
                     : enemyCanEnter(x, y);
    };

    // --- FEAR MECHANIC: Run Away ---
    if (e.fearTicks > 0) {
      e.fearTicks--;
      // Emoji removed here. Logic remains.
      
      // Find the neighbor furthest from the player
      let bestAway = null;
      let maxDist = dist(e.x, e.y, state.player.x, state.player.y);
      const nbs = [[0,-1], [0,1], [-1,0], [1,0]];
      
      for(const [dx, dy] of nbs) {
        const nx = e.x + dx, ny = e.y + dy;
        if (canEnterPoint(nx, ny)) {
          const d = dist(nx, ny, state.player.x, state.player.y);
          if (d > maxDist) {
            maxDist = d;
            bestAway = {x:nx, y:ny};
          }
        }
      }
      if (bestAway) { e.x = bestAway.x; e.y = bestAway.y; }
      continue; // Skip Attack/Chase Logic
    }

    // Mage: if straight LOS and in range, cast instead of moving
const manhattan = Math.abs(e.x - state.player.x) + Math.abs(e.y - state.player.y);
if (e.ranged && s === 1 && manhattan > 1 && manhattan <= (e.range||3) &&
(e.x === state.player.x || e.y === state.player.y) &&
clearStraightLine(e.x, e.y, state.player.x, state.player.y)) {

  let dmgRoll = rand(e.atk[0], e.atk[1]);
      if (state.gameMode !== 'classic' && state.floorEffect === 'Bloodhunt'){
        dmgRoll = Math.max(1, Math.round(dmgRoll * 1.20));
      }

      let dmg = damageAfterDR(dmgRoll);
      let attackLanded = true;
      SFX.rangedZap?.();

      // Perk: Evasion
      if (state.skills?.one?.perks?.['one_b1'] && Math.random() < (0.05 * state.skills.one.perks['one_b1'])) {
          dmg = state.skills.one.perks['one_b3'] ? 0 : Math.ceil(dmg / 2);
          spawnFloatText("DODGE", state.player.x, state.player.y, '#60a5fa');
          if (dmg === 0) attackLanded = false;
      }
      
      // Perk: Phalanx
      if (attackLanded && state.player.shield && state.skills?.spear?.perks?.['spear_b1'] && Math.random() < (0.05 * state.skills.spear.perks['spear_b1'])) {
          dmg = state.skills.spear.perks['spear_b2'] ? 0 : Math.ceil(dmg / 2);
          spawnFloatText("BLOCK", state.player.x, state.player.y, '#cbd5e1');
          if (dmg === 0) attackLanded = false;
      }

      // Perk: Immortal
      if (attackLanded && state.player.hp - dmg <= 0 && state.skills?.survivability?.perks?.['sur_a3'] && !state.run.immortalUsed) {
          state.run.immortalUsed = true;
          dmg = Math.max(0, state.player.hp - 1);
          spawnFloatText("IMMORTAL", state.player.x, state.player.y, '#facc15');
          log("Your Immortal perk saves you from a fatal spell!");
      }

      if (attackLanded) {
          state.player.hp = clamp(state.player.hp - dmg, 0, state.player.hpMax);
          flashDamage();
          log(`${e.type} zaps you from afar for ${dmg}.`);
          updateBars();
          if (state.player.hp <= 0){ triggerGameOver(); return; }
      }
      continue; // mage ends turn with the cast
}

    // If adjacent to ANY tile of a multi-tile enemy, do a melee hit
let adjacent = false;
for (let yy=0; yy<s && !adjacent; yy++){
  for (let xx=0; xx<s && !adjacent; xx++){
    if (Math.abs((e.x+xx) - state.player.x) + Math.abs((e.y+yy) - state.player.y) === 1){
      adjacent = true;
    }
  }
}

if (adjacent){
  
  // --- NEW: Enemy Accuracy Check ---
  // Base 85% accuracy. Bosses/Elites get 95%.
  const accuracy = (e.boss || e.elite) ? 0.95 : 0.85;
  
  if (Math.random() > accuracy) {
        spawnFloatText("Miss", state.player.x, state.player.y, '#9ca3af');
        log(`The ${e.type} attacks but misses you.`);
        continue; // Skip the rest of the attack logic
      }
      // ---------------------------------
      let dmgRoll = rand(e.atk[0], e.atk[1]);
        
        // Perk: Axe Maim (Crippled enemies deal half damage)
        if (e.slowTicks > 0 && state.skills?.axe?.perks?.['axe_a3']) {
            dmgRoll = Math.max(1, Math.floor(dmgRoll / 2));
        }
        
        // Cursed Descent: +50% Enemy Damage
        if (state.cursedFloor) {
           dmgRoll = Math.ceil(dmgRoll * 1.5);
        }

        // Pack Tactics: +2 damage if another enemy of the same type is adjacent to player
        const hasPack = state.enemies.some(other => other !== e && other.type === e.type && (Math.abs(other.x - state.player.x) + Math.abs(other.y - state.player.y) === 1) );
        if (hasPack) dmgRoll += 2;

        if (state.gameMode !== 'classic' && state.floorEffect === 'Bloodhunt'){
          dmgRoll = Math.max(1, Math.round(dmgRoll * 1.20));
        }
      let dmg = damageAfterDR(dmgRoll);
      let attackLanded = true;

      // Perk: Evasion (One-Handed)
      if (state.skills?.one?.perks?.['one_b1'] && Math.random() < (0.05 * state.skills.one.perks['one_b1'])) {
          dmg = state.skills.one.perks['one_b3'] ? 0 : Math.ceil(dmg / 2); // Shadow Step negates all dmg
          spawnFloatText("DODGE", state.player.x, state.player.y, '#60a5fa');
          
          // Perk: Counter Attack
          if (state.skills.one.perks['one_b2']) {
             const counterDmg = rand(state.player.weapon.min, state.player.weapon.max);
             e.hp -= counterDmg;
             spawnFloatText(counterDmg, e.x, e.y, '#fff');
             log(`You dodge and counter-attack for ${counterDmg}!`);
             if (e.hp <= 0) handleEnemyDeath(e, 'one');
          }
          if (dmg === 0) attackLanded = false;
      }
      
      // Perk: Phalanx (Spear Block)
      if (attackLanded && state.player.shield && state.skills?.spear?.perks?.['spear_b1'] && Math.random() < (0.05 * state.skills.spear.perks['spear_b1'])) {
          dmg = state.skills.spear.perks['spear_b2'] ? 0 : Math.ceil(dmg / 2); // Impenetrable negates all dmg
          spawnFloatText("BLOCK", state.player.x, state.player.y, '#cbd5e1');
          
          // Perk: Spiked Shield
          if (state.skills.spear.perks['spear_b3']) {
              e.hp -= 1;
              spawnFloatText("1", e.x, e.y, '#fff');
              if (e.hp <= 0) handleEnemyDeath(e, 'spear');
          }
          if (dmg === 0) attackLanded = false;
      }

      // Perk: Immortal (Survivability)
      if (attackLanded && state.player.hp - dmg <= 0 && state.skills?.survivability?.perks?.['sur_a3'] && !state.run.immortalUsed) {
          state.run.immortalUsed = true;
          dmg = Math.max(0, state.player.hp - 1);
          spawnFloatText("IMMORTAL", state.player.x, state.player.y, '#facc15');
          log("Your Immortal perk saves you from a fatal blow!");
      }

      if (attackLanded) {
          state.player.hp = clamp(state.player.hp - dmg, 0, state.player.hpMax);
          flashDamage();
          SFX.enemyHit?.();
          log(`${e.type} hits you for ${dmg}.`);
          updateBars();
          if (state.player.hp <= 0){ triggerGameOver(); return; }
      }

      // on-hit poison (rats, etc.)
      if (e.poisonChance && Math.random() < e.poisonChance){
        if (state.skills?.survivability?.perks?.['sur_a2']) {
             // Juggernaut Immunity
        } else {
            if (!state.player.poisoned) log('You are poisoned!');
            state.player.poisoned = true;
            state.player.poisonTicks = Math.max(state.player.poisonTicks|0, 15);
        }
      }

      // BAT: Vampiric (heals dmg dealt)
      if (e.type === 'Bat' && dmg > 0) {
        // Nerf: Bosses only heal 33% of damage dealt, regular bats 100%
        const ratio = (e.boss || e.elite) ? 0.33 : 1.0; 
        const healAmt = Math.max(1, Math.floor(dmg * ratio));

        const oldHp = e.hp;
        e.hp = Math.min(e.hp + healAmt, (e.hpMax || 999));
        if (e.hp > oldHp) {
            flashEnemy(e, 'green');
            if (e.boss) spawnFloatText("+" + healAmt, e.x, e.y, '#0f0'); // Visual feedback
        }
      }

      // SPIDER: Web/Slow (100% chance or adjust as needed)
      if (e.type === 'Spider') {
         if (state.skills?.survivability?.perks?.['sur_a2']) {
             // Juggernaut Immunity
         } else {
             if (!state.player.slowed) {
                 state.player.slowed = true;
                 state.player.slowTicks = 5; // 5 steps
                 log('The Spider webs you! (Slowed)');
             } else {
                 state.player.slowTicks = Math.max(state.player.slowTicks, 5);
             }
         }
      }

      // Goblins: chance to steal on hit
      if (e.type === 'Goblin' &&
          e.stealChance &&
          typeof goblinStealOne === 'function' &&
          Math.random() < e.stealChance) {

        const stolen = goblinStealOne();
        if (stolen){
          // Support both single and multi-steal for compatibility
          if (!e.stolenItems) e.stolenItems = [];
          e.stolenItems.push(stolen);

          // Keep the older single-slot field around too
          if (!e.stolen) e.stolen = stolen;

          log('The Goblin steals something from you!');
          if (typeof updateInvBody === 'function') updateInvBody();
        }
      }

      // melee ends their action; no follow-up move this tick
      continue;
    }



    // Not adjacent → try to move up to `moves` steps using greedy→BFS (size-aware)
    for (let step = 0; step < moves; step++){
  // 1) quick greedy step
  const g = greedyStepToward?.(e);
  if (g && canEnterPoint(g.x, g.y)) { e.x = g.x; e.y = g.y; continue; }

  // 2) short BFS (bigger budget for bosses / bigger maps)
  const b = bfsStepToward?.(e, e.boss ? 160 : 96);
  if (b && canEnterPoint(b.x, b.y)) { e.x = b.x; e.y = b.y; continue; }

    // 3) Fallback: take any passable neighbor that most reduces Manhattan distance
  let best = null, bestD = Infinity;
  for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const nx = e.x + dx, ny = e.y + dy;
    if (!canEnterPoint(nx, ny)) continue;
    const d = Math.abs(nx - state.player.x) + Math.abs(ny - state.player.y);
    if (d < bestD){ bestD = d; best = {x:nx,y:ny}; }
  }
  if (best){ e.x = best.x; e.y = best.y; continue; }

  // truly boxed in
  break;
}



  }

  // FORCE CLEAR ACTION: Prevents Shadow from mimicking the same arrow on the next turn (e.g. during a Sprint)
  state.lastPlayerAction = null; 

  // === lightweight enemy respawn pacing ===
  // Only respawn on non-boss floors so boss fights stay clean
  if (!state.gameOver && (state.floor % 10 !== 0)) {
    state.respawnTick = (state.respawnTick | 0) + 1;
    if (state.respawnTick >= (state.respawnEvery | 0)) {
      state.respawnTick = 0;
      tryRespawnOneEnemy();
    }
  }
}



// ===== Depth 50 Two-Phase Boss: Cutscene + Helpers =====

// Ensure flags container exists
state.flags = state.flags || {};

// tiny async helpers
const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));

// simple black fade overlay (separate from descend's)
function ensureCutFade(){
  let fx = document.getElementById('cutFade');
  if (!fx){
    const wrap = document.getElementById('cw') || document.body;
    fx = document.createElement('div');
    fx.id = 'cutFade';
    Object.assign(fx.style, {
      position:'absolute', left:0, top:0, right:0, bottom:0,
      background:'#000', opacity:'0', pointerEvents:'none',
      zIndex:'20', transition:'opacity 320ms ease-in-out'
    });
    wrap.appendChild(fx);
  }
  return fx;
}

async function fadeToBlack(durMs=320){ const fx = ensureCutFade(); fx.style.opacity='1'; await sleep(durMs); }
async function fadeFromBlack(durMs=320){ const fx = ensureCutFade(); fx.style.opacity='0'; await sleep(durMs); }

// quick white flash overlay (for the triple flash)
function ensureWhiteFlash(){
  let f = document.getElementById('whiteFlash');
  if (!f){
    const wrap = document.getElementById('cw') || document.body;
    f = document.createElement('div');
    f.id = 'whiteFlash';
    Object.assign(f.style, {
      position:'absolute', left:0, top:0, right:0, bottom:0,
      background:'#fff', opacity:'0', pointerEvents:'none',
      zIndex:'19', transition:'opacity 120ms ease-in-out'
    });
    wrap.appendChild(f);
  }
  return f;
}
async function flashWhite(times=1, gapMs=220){
  const f = ensureWhiteFlash();
  for (let i=0;i<times;i++){
    f.style.opacity='1'; await sleep(90);
    f.style.opacity='0'; await sleep(gapMs);
  }
}

// move player one step even while inputs are locked (no enemy turn)
function forceStep(dx,dy){
  const nx = state.player.x + dx, ny = state.player.y + dy;
  if (!inBounds(nx,ny)) return false;
  if (state.tiles[ny][nx] === 0) return false; // walls

  // NEW: block NPC tiles here too
  if (isMerchantTile(nx, ny)) return false;
  if (isBlacksmithTile(nx, ny)) return false;
  if (isJesterTile(nx, ny)) return false;
  if (isCartographerTile(nx, ny)) return false;

  state.player.x = nx; state.player.y = ny;
  if (SFX?.step) SFX.step();
  draw();
  return true;
}


// Find a floor cell ~5 tiles to the right (fallback left) on same row
function findFiveAway(px, py){
  const tryOffsets = [5, -5, 4, -4, 3, -3];
  for (const off of tryOffsets){
    const tx = clamp(px + off, 0, state.size.w - 1);
    if (inBounds(tx,py) && state.tiles[py][tx] === 1) return {x:tx, y:py};
  }
  return {x:clamp(px+3,0,state.size.w-1), y:py};
}

// Build the phase-1 boss (Clone) at x,y; size 1 (same as player)
function makeCloneBoss(x, y){
  const f = state.floor | 0;

  // --- same scaling as other bosses/enemies ---
  const scale    = 1 + Math.max(0, f - 1) * 0.12;        // +12% per floor
  const bossBump = (f % 10 === 0) ? 0.25 : 0;             // +25% on boss floors
  const hpBase   = Math.round((24 + 4 * f) * (scale + bossBump));

  // Use strongest floor mob as ATK baseline, like your other bosses do
  const kinds = floorEnemyKinds();
  const base  = kinds[kinds.length - 1] || { atk:[3,6] };
  const atkMin = base.atk[0] + Math.floor(f / 3);
  const atkMax = base.atk[1] + Math.floor(f / 2);

  return {
    type: 'Clone',
    displayName: 'Your Shadow',
    x, y,
    hp: hpBase, hpMax: hpBase,            // ← identical HP scaling to other bosses
    atk: [atkMin, atkMax],
    xp: Math.round(60 * (1 + Math.max(0, f - 1) * 0.10)),
    boss: true,
    size: 1,
    tint: 'grayscale(1) brightness(0.9) contrast(1.2)'
  };
}

// Build the phase-2 boss (Mad King) at x,y; slightly tougher than the Clone
function makeMadKing(x, y){
  const f = state.floor | 0;

  // --- same scaling as other bosses/enemies ---
  const scale    = 1 + Math.max(0, f - 1) * 0.12;
  const bossBump = (f % 10 === 0) ? 0.25 : 0;
  const hpBase   = Math.round((24 + 4 * f) * (scale + bossBump));

  const kinds = floorEnemyKinds();
  const base  = kinds[kinds.length - 1] || { atk:[3,6] };
  const atkMin = base.atk[0] + Math.floor(f / 2);   // a touch meaner than Clone
  const atkMax = base.atk[1] + Math.floor((2 * f) / 3);

  const kingHp = Math.round(hpBase * 1.25);         // phase 2 gets +25% HP

  return {
    type: 'Mad King',
    displayName: 'The Mad King',
    x, y,
    hp: kingHp, hpMax: kingHp,
    atk: [atkMin, atkMax],
    xp: Math.round(100 * (1 + Math.max(0, f - 1) * 0.10)),
    boss: true,
    size: 1,
    tint: 'sepia(0.2) saturate(1.15) brightness(1.05)'
  };
}



// Depth 50 — Intro sequence
async function runDepth50Intro(){
  state.flags ||= {};
  if (state.flags.depth50IntroRunning || state.flags.depth50IntroDone) return; // re-entry guard
  state.flags.depth50IntroRunning = true;

  state._suppressBossHud = true;
  state._inputLocked = true;
  if (typeof stopBgm === 'function') stopBgm();

  try {
    // Walk player 5 tiles to the right (slower)
    for (let i=0;i<5;i++){ if (!forceStep(1,0)) break; await sleep(160); }

    // Shadow appears underfoot, then glides 5 to the right
    const sh = { type:'Shadow', x:state.player.x, y:state.player.y, hp:1, boss:false, size:1, tint:'brightness(0.15) saturate(0.8)', _scene:true, static:true };
    state.enemies.push(sh); draw();
    const to = findFiveAway(sh.x, sh.y);
    while (sh.x < to.x){ sh.x++; draw(); await sleep(160); }

    // Triple white flash, then the clone pops in (size 1 — same as player)
    await flashWhite(3, 260);
    const clone = makeCloneBoss(sh.x, sh.y);
    state.enemies.push(clone); draw();

    // FIX: Synced Audio/Text Sequence
    // Line 1: "So you've finally made it..."
    await saySynced('So you’ve finally made it. This is where your journey ends.', NPC_DIALOGUE_URLS.shadow.intro1);
    
    // Line 2: "Submit to the darkness!"
    await saySynced('Submit to darkness!', NPC_DIALOGUE_URLS.shadow.intro2);

    // Cut to black, remove shadow, start boss music, fade back
    await fadeToBlack(360);
    state.enemies = state.enemies.filter(e => e !== sh);
    if (typeof setBgmUrl === 'function') setBgmUrl(BOSS1_BGM_URL);
    await fadeFromBlack(360);

    forceBossHud();                      // show bar now
  } finally {
    state.flags.depth50IntroDone = true;
    state.flags.depth50IntroRunning = false;
    unlockControls('intro');
  }
}


// Depth 50 — Phase 2 transition (called when Clone hits 0 HP)
async function runDepth50Phase2(deadClone){
  state.flags ||= {};
  if (state.flags.depth50Phase2Running || state.flags.depth50Done) return;
  state.flags.depth50Phase2Running = true;

  state._inputLocked = true;
  state._suppressBossHud = true;

  try {
    updateBossHud?.();                   // hide HUD under black
    await fadeToBlack(900);
    state.enemies = state.enemies.filter(e => e !== deadClone);

    // Place 1×1 clone 5 tiles away for the line (while still black)
const far = findFiveAway(state.player.x, state.player.y);
const remnant = makeCloneBoss(far.x, far.y);
remnant.size = 1; remnant.boss = false; remnant.hp = remnant.hpMax = 1;
state.enemies.push(remnant);

// draw while black so the “move” happens during the fade
    draw?.();
    await fadeFromBlack(360);

    // FIX: Synced Defeat Line
    // Line 3: "No! This cannot be!"
    await saySynced('No! This cannot be!', NPC_DIALOGUE_URLS.shadow.defeat);

    // Remove remnant → triple flash → hooded appears
    state.enemies = state.enemies.filter(e => e !== remnant); draw();
    await flashWhite(3, 260);
    const hood = { type:'Hooded', x:far.x, y:far.y, hp:1, size:1, _scene:true, static:true };
    state.enemies.push(hood); draw();

    playNpcDialogue(NPC_DIALOGUE_URLS.madking.intro); // <--- VOICE: King appears
    await say("You’ve come this far, and yet you understand nothing.");
    await say('Fine, I will be your opponent.');  // click to dismiss

    // Immediately swap to crowned king
    await fadeToBlack(360);               // cut to black
state.enemies = state.enemies.filter(e => e !== hood);
const king = makeMadKing(far.x, far.y);   // ← fix bad arg
state.enemies.push(king);

// heal + music while still black
state.player.hp = state.player.hpMax;
state.player.mp = state.player.mpMax;
updateBars?.();
if (typeof setBgmUrl === 'function') setBgmUrl(BOSS2_BGM_URL);

// draw the King frame while black so he’s ready on reveal
draw?.();

await fadeFromBlack(360);

// now reveal the bar with the correct sprite on screen
state._suppressBossHud = false;
updateBossHud?.();
draw?.();
                      // show bar now
  } finally {
    state.flags.depth50Phase2 = true;
    state.flags.depth50Phase2Running = false;
    unlockControls('phase2');
  }
}



// Depth 50 — Outro on Mad King death
async function runDepth50Outro(deadKing){
  state.flags ||= {};
  if (state.flags.depth50OutroRunning || state.flags.depth50Done) return;
  state.flags.depth50OutroRunning = true;

  state._inputLocked = true;
  state._suppressBossHud = true;

    updateBossHud?.();                  // ← ADD THIS: hide the bar immediately


  try {
    await fadeToBlack(260);
    const far = findFiveAway(state.player.x, state.player.y);
    deadKing.x = far.x; deadKing.y = far.y;
    if (!state.enemies.includes(deadKing)) state.enemies.push(deadKing);

    await fadeFromBlack(260);
    
    playNpcDialogue(NPC_DIALOGUE_URLS.madking.defeat); // <--- VOICE ADDED
    await say('Very well, you may have bested me. But be warned there are even worse things deeper down in the dungeon.');

    await fadeToBlack(260);
    state.enemies = state.enemies.filter(e => e !== deadKing);

if (state.gameMode === 'classic') {
  // No stairs — unlock Endless
  localStorage.setItem('endlessUnlocked', '1');
  
  // --- FIX: Finalize Run Stats ---
  state.gameOver = true;       // Stop game loop/inputs
  state.run.ended = true;      // Flag run as complete
  stopRunTimerFreeze();        // Lock the timer
  // -----------------------------

  if (typeof window.openModal === 'function') {
    window.openModal('#classicClearModal');
  } else {
    const m = document.getElementById('classicClearModal');
    if (m){ m.style.display = 'flex'; document.body.classList.add('noscroll'); }
  }
} else {
  // Endless or anything else: drop stairs as usual
  state.tiles[far.y][far.x] = 4;
  SFX?.bossDown?.();
}

await fadeFromBlack(260);

  } finally {
    state.flags.depth50Done = true;
    state.flags.depth50OutroRunning = false;
    unlockControls('outro');
  }
}



