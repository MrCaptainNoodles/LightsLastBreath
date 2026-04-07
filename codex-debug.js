(function () {
  if (window.__restartPatchInstalled) return;
  window.__restartPatchInstalled = true;

  function hide(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  }

  window.hardRestartGame = function hardRestartGame() {
    try {
      const S = window.gameState || window.state || (window.G && window.G.state);
      if (!S) {
  if (typeof window.doRestart === 'function') { window.doRestart(); }
  return;
}

      S.player = {
        x: 0, y: 0,
        hp: 20, mp: 10,
        maxHp: 20, maxMp: 10,
        level: 1, xp: 0,
        poisoned: false, poisonTicks: 0
      };

S.player.shield = null;     // 👉 add
S._shieldParity = 0; 

      S.inventory = { lockpicks: 0, potions: 0, tonics: 0 };
      S.inventory.shields = 0;
      S.weapons = {};
      S.equippedWeapon = null;
      S.spells = [];
      S.equippedSpell = null;
      state.player.bow.loaded = 0;
state.inventory.arrows = 0;   // or give a starter stash if you prefer
updateEquipUI();


      S.skillLevel = {
        handToHand: 1, oneHanded: 1, spear: 1, axe: 1, twoHanded: 1, lockpicking: 1
      };
      S.skillXp = {
        handToHand: 0, oneHanded: 0, spear: 0, axe: 0, twoHanded: 0, lockpicking: 0
      };

      S.floor = 1;
      S.entities = [];
      S.doors = [];
      S.chests = [];
      S.map = null;

      S.eventLog = [];
      S._log = []; // Clear the actual event log array
      if (typeof renderLog === 'function') renderLog(); // Update the UI immediately

      hide('gameOverModal');
      hide('inventoryModal');
      hide('spellsModal');
      hide('helpModal');

      const init = window.initGame || window.newRun || window.bootstrap || window.generateRun;
      if (typeof init === 'function') init();

      if (window.renderAll) window.renderAll();
      if (window.renderHud) window.renderHud();
      if (window.renderMap) window.renderMap();
      startRunTimer();


    } catch (e) {
  console.error('Hard restart failed:', e);
  if (typeof window.doRestart === 'function') { window.doRestart(); }
}
  };

// <!-- AFTER --> //
const restartBtn = document.getElementById('btnRestart') || document.getElementById('restartButton');
if (restartBtn) {
  restartBtn.onclick = (window.doRestart || window.hardRestartGame);
}


  window.addEventListener('keydown', function (ev) {
    if ((ev.key === 'r' || ev.key === 'R') && document.getElementById('gameOverModal')?.style.display === 'block') {
      ev.preventDefault();
      window.hardRestartGame();
    }
  });
})();

// ===== Debug Menu (secret combo: Ctrl + Alt + D, plus Depth long-press) =====
(function(){
  const dbg = {
    modal: null, inp: null, btn: null, depthChip: null,
    longTimer: null, longMs: 700
  };

  function showDebug(){
    if (!dbg.modal) return;
    dbg.modal.style.display = 'flex';
    document.body.classList.add('noscroll');
    // prefill with current floor
    if (dbg.inp) { dbg.inp.value = state.floor; dbg.inp.focus(); dbg.inp.select(); }
  }
  function hideDebug(){
    if (!dbg.modal) return;
    dbg.modal.style.display = 'none';
    document.body.classList.remove('noscroll');
  }

  function teleportToFloor(n){
  n = Math.max(1, Math.floor(Number(n)||1));
  state.floor = n;
  state.gameOver = false;

  // regenerate & redraw
  gen();
  enemyStep();            // ← ADD: give enemies a turn immediately
  if (typeof draw === 'function') draw();
  if (typeof updateBars === 'function') updateBars();
  if (typeof updateEquipUI === 'function') updateEquipUI();

  const fc = document.getElementById('floorChip');
  if (fc) fc.textContent = 'Depth ' + state.floor;
  hideDebug();
  log('[debug] Teleported to floor ' + state.floor + '.');
}


  // Wait for DOM (your file already uses DOMContentLoaded in a few places)
  
  document.addEventListener('DOMContentLoaded', ()=>{
    dbg.modal = document.getElementById('debugModal');
    dbg.inp   = document.getElementById('dbgFloor');
    dbg.btn   = document.getElementById('dbgGo');
    dbg.depthChip = document.getElementById('floorChip');

    // --- NEW: Clear Log early on Menu Return / Restart ---
    const clearLog = () => {
      if (typeof state !== 'undefined') state._log = [];
      if (typeof renderLog === 'function') renderLog();
    };
    // Attach to all buttons that leave a run or start class selection
    ['btnRestart', 'btnQuitNoSave', 'btnReturnToMenu', 'btnTutReturn', 'btnScoreMenu', 'btnClassic', 'btnTutorial'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', clearLog);
    });

    // --- NEW: Wire Insta Kill Button ---
    const btnKill = document.getElementById('dbgInstaKill');
    if(btnKill){
      btnKill.onclick = ()=>{
        window._instaKill = !window._instaKill;
        btnKill.textContent = `Insta Kill: ${window._instaKill ? 'ON' : 'OFF'}`;
        btnKill.style.background = window._instaKill ? '#7f1d1d' : '';
      };
    }

    // Close buttons (re-use your data-close pattern)
    document.querySelectorAll('[data-close="#debugModal"]').forEach(b=>{
      b.addEventListener('click', hideDebug);
    });

    if (dbg.btn) dbg.btn.addEventListener('click', ()=>{
      teleportToFloor(dbg.inp && dbg.inp.value);
    });
    if (dbg.inp) dbg.inp.addEventListener('keydown', (e)=>{
      if (e.key === 'Enter'){ e.preventDefault(); teleportToFloor(dbg.inp.value); }
      e.stopPropagation(); // prevent game movement while typing
    });

    // Secret keyboard combo: Ctrl + Alt + D
    window.addEventListener('keydown', (e)=>{
      if (e.ctrlKey && e.altKey && (e.code === 'KeyD')){
        e.preventDefault();
        showDebug();
      }
    });

    // Touch Easter egg: Triple-tap the "Depth" chip
    if (dbg.depthChip){
      let tapCount = 0;
      let tapTimer = null;
      
      dbg.depthChip.addEventListener('click', (e)=>{
        // prevent unintended clicks if needed, though usually fine on chip
        tapCount++;
        
        // Reset count if too much time passes between taps (e.g. 400ms)
        clearTimeout(tapTimer);
        tapTimer = setTimeout(() => { tapCount = 0; }, 400);

        if (tapCount >= 3){
           showDebug();
           tapCount = 0;
           clearTimeout(tapTimer);
        }
      });
    }

// --- NEW: Spawn All Floor Loot (Potions, Bombs, etc.) ---
const lootBtn = document.getElementById('dbgSpawnLoot');
if (lootBtn) lootBtn.addEventListener('click', () => {
  const items = [
    { kind: 'potion', payload: 1 },
    { kind: 'tonic', payload: 1 },
    { kind: 'antidote', payload: 1 },
    { kind: 'bomb', payload: 1 },
    { kind: 'warp', payload: 1 },
    { kind: 'lockpicks', payload: 3 },
    { kind: 'arrows', payload: 10 },
    { kind: 'spell', payload: { name: 'Spark', cost: 1, tier: 1 } },
    { kind: 'shield', payload: 'Kite Shield' },
    { kind: 'trinket', payload: 'Ring of Haste' }
  ];
  let idx = 0;
  // Spiral out 3 tiles from player to drop items
  for (let r = 1; r <= 3; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (idx >= items.length) break;
        const tx = state.player.x + dx, ty = state.player.y + dy;
        if (!inBounds(tx, ty) || state.tiles[ty][tx] !== 1 || enemyAt(tx, ty) || state.pickups[key(tx, ty)]) continue;
        state.tiles[ty][tx] = 5;
        state.pickups[key(tx, ty)] = items[idx++];
      }
    }
  }
  if (typeof draw === 'function') draw();
  hideDebug();
  log('[debug] Spawned detailed floor loot around you.');
});

// --- NEW: Spawn New Enemies ---
  const enemyBtn = document.getElementById('dbgSpawnEnemies');
  if (enemyBtn) enemyBtn.addEventListener('click', () => {
    const types = ['Rat', 'Bat', 'Spider', 'Goblin', 'Slime', 'Skeleton', 'Mage'];
    
    // Spawn them in a row 2 tiles below the player
    types.forEach((t, i) => {
        const tx = state.player.x + (i - 3); // Centered horizontally
        const ty = state.player.y + 2;       // 2 tiles down
        
        if (inBounds(tx, ty) && state.tiles[ty][tx] === 1 && !enemyAt(tx, ty)) {
            state.enemies.push({
                type: t,
                x: tx, y: ty,
                hp: 20,              // Dummy HP
                atk: [1, 2],         // Dummy Atk
                xp: 10,
                size: 1,
                sleep: true          // Spawn asleep so they don't instantly mob you
            });
        }
    });

    if (typeof draw === 'function') draw();
    hideDebug();
    log('[debug] Spawned new enemies below you.');
  });


    // --- NEW: Spawn All Weapons ---
  const allWepBtn = document.getElementById('dbgSpawnAllWeapons');
  if (allWepBtn) allWepBtn.addEventListener('click', ()=>{
      const pool = [
        {name:'Shortsword', type:'one'}, {name:'Claymore', type:'two'},
        {name:'Spear', type:'spear'}, {name:'Axe', type:'axe'},
        {name:'Knuckle Duster', type:'hand'}, {name:'Warhammer', type:'two'},
        {name:'Battleaxe', type:'axe'}, {name:'Halberd', type:'spear'},
        {name:'Claws', type:'hand'}, {name:'Fire Staff', type:'staff'},
        {name:'Ice Staff', type:'staff'}, {name:'Lightning Staff', type:'staff'},
        {name:'Wind Staff', type:'staff'}, {name:'Earth Staff', type:'staff'},
        {name:'Key of Destiny', type:'one'}
      ];
      let idx = 0;
      // Spiral out from player to find empty spots
      for (let r=1; r<8; r++) {
          for (let y = state.player.y - r; y <= state.player.y + r; y++) {
              for (let x = state.player.x - r; x <= state.player.x + r; x++) {
                  if (idx >= pool.length) break;
                  if (!inBounds(x,y)) continue;
                  if (state.tiles[y][x] !== 1) continue; // Floor only
                  const k = key(x,y);
                  if (state.pickups[k] || enemyAt(x,y)) continue;

                  state.tiles[y][x] = 5;
                  state.pickups[k] = { kind: 'weapon', payload: { ...pool[idx], min:1, max:1 } };
                  idx++;
              }
          }
      }
      draw?.();
      hideDebug?.();
      log('[debug] Spawned all weapons.');
  });

// --- NEW: Unlock All Classes Cheat ---
const clsBtn = document.getElementById('dbgUnlockClasses');
if (clsBtn) clsBtn.addEventListener('click', ()=>{
  const m = loadMeta();
  
  // Dynamic Loop: Unlocks EVERYTHING defined in the CLASSES object
  Object.keys(CLASSES).forEach(key => {
    m['unlocked_' + key] = true;
  });
  
  saveMeta(m);
  
  // FIX: Explicitly set the Endless Mode unlock flag!
  localStorage.setItem('endlessUnlocked', '1');

  hideDebug?.();
  log('[debug] All Classes & Endless Mode unlocked. Click Restart to see the menu.');
});

// --- NEW: Max All Skills Cheat ---
let skillBtn = document.getElementById('dbgMaxSkills');
if (!skillBtn && clsBtn) {
    // Dynamically inject the button if it doesn't exist in HTML
    skillBtn = document.createElement('button');
    skillBtn.id = 'dbgMaxSkills';
    skillBtn.className = 'btn';
    skillBtn.textContent = 'Max All Skills (Lv50)';
    clsBtn.parentNode.appendChild(skillBtn);
}
if (skillBtn) {
    skillBtn.addEventListener('click', ()=>{
        const allTypes = ['hand', 'one', 'two', 'spear', 'axe', 'bow', 'magic', 'survivability', 'lockpicking'];
        allTypes.forEach(type => {
            if (typeof ensureSkill === 'function') ensureSkill(type);
            if (!state.skills[type]) state.skills[type] = {lvl:1, xp:0, next:100, shown:true, perks:{}};
            
            state.skills[type].lvl = 50; // Sets to level 50, giving 50 perk points!
            state.skills[type].shown = true;
        });
        
        if (typeof renderSkills === 'function') renderSkills();
        if (typeof updateEquipUI === 'function') updateEquipUI();
        
        hideDebug?.();
        log('[debug] All skills set to Level 50! Open the Skill Menu to buy perks.');
    });
}

// --- NEW: God Mode Cheat ---
let godBtn = document.getElementById('dbgGodMode');
if (!godBtn && skillBtn) {
    godBtn = document.createElement('button');
    godBtn.id = 'dbgGodMode';
    godBtn.className = 'btn';
    godBtn.textContent = 'Toggle God Mode';
    skillBtn.parentNode.appendChild(godBtn);
}
if (godBtn) {
    godBtn.addEventListener('click', ()=>{
        window._godMode = !window._godMode;
        if (window._godMode && state.player) {
            state.player.hpMax = 9999;
            state.player.hp = 9999;
            state.player.mpMax = 9999;
            state.player.mp = 9999;
            state.player.staminaMax = 9999;
            state.player.stamina = 9999;
            state.player.poisoned = false;
            state.player.poisonTicks = 0;
        }
        if (typeof updateBars === 'function') updateBars();
        hideDebug?.();
        log('[debug] God Mode is now ' + (window._godMode ? 'ON' : 'OFF') + '. You are invincible.');
    });
}


// --- NEW: Cleric & Warp Debug Wiring ---
document.getElementById('dbgSpawnCleric')?.addEventListener('click', ()=>{
   state.cleric = { x: state.player.x, y: state.player.y + 1 };
   // Force reveal the tile so you can see her immediately
   state.seen.add(key(state.player.x, state.player.y+1)); 
   draw?.(); 
   log('[debug] Cleric spawned below.'); 
   hideDebug?.();
});



const stairsBtn = document.getElementById('dbgSpawnStairs');
if (stairsBtn) stairsBtn.addEventListener('click', ()=>{
  // place stairs at tile directly below player
  const px = state.player.x;
  const py = state.player.y + 1;

  if (!inBounds(px, py)) { log('[debug] Cannot spawn stairs: out of bounds.'); return; }
  if (typeof isMerchantTile === 'function' && isMerchantTile(px, py)) { log('[debug] Spot blocked by merchant.'); return; }
  if (enemyAt(px, py)) { log('[debug] Cannot spawn stairs: enemy on tile.'); return; }

  // must be empty floor or current pickup tile
  const t = state.tiles[py][px];
  if (!(t === 1 || t === 5)) { log('[debug] Tile below must be walkable floor.'); return; }

  // clear any pickup on that tile
  state.pickups ||= {};
  const kxy = key(px, py);
  if (state.pickups[kxy]) delete state.pickups[kxy];

  // 4 = stairs
  state.tiles[py][px] = 4;
  SFX?.bossDown?.();              // nice chime (optional)
  draw?.();
  hideDebug?.();
  log('[debug] Placed stairs one tile below you.');
});


  });
})();

// --- NEW: Debug Prop Spawner (Floating UI) ---
setTimeout(initDebugSpawner, 2000); // Wait for DOM/Game load

function initDebugSpawner() {
  // 1. Define Categories based on your drawPropPixel logic
  const library = {
    'Storage': ['crate', 'barrel', 'toxic barrel', 'pipe debris'],
    'Dungeon': ['bone', 'skull pile', 'pillar', 'iron chain', 'broken grate', 'gargoyle', 'candle'],
    'Crypt': ['coffin', 'broken tomb', 'urn', 'gold vase', 'treasure pile', 'red carpet'],
    'Nature': ['fern', 'vine cluster', 'giant flower', 'rat nest', 'slime puddle', 'spider web'],
    'Elemental': ['magma rock', 'obsidian shard', 'lava vent'],
    'Void': ['crystal shard', 'floating rock', 'star mote', 'dark monolith'],
    'Debris': ['rubble']
  };

  // 2. Create Panel (Hidden by default)
  const panel = document.createElement('div');
  panel.style.cssText = "position:fixed; top:120px; left:10px; width:150px; max-height:60vh; overflow-y:auto; background:rgba(10,15,20,0.95); border:1px solid #444; color:#fff; font-family:monospace; font-size:11px; z-index:11000; padding:4px; box-shadow: 2px 2px 10px #000; display:none;";
  panel.id = 'debugPropPanel';
  panel.innerHTML = '<div style="color:#facc15; border-bottom:1px solid #555; margin-bottom:6px; font-weight:bold; cursor:pointer; text-align:right;" onclick="this.parentElement.style.display=\'none\'">CLOSE [X]</div>';

  // 3. Build Accordion Buttons
  for (const [biome, props] of Object.entries(library)) {
    const header = document.createElement('div');
    header.textContent = `▼ ${biome}`;
    header.style.cssText = "color:#9ca3af; margin-top:4px; font-weight:bold; cursor:pointer; background:#1f2937; padding:4px; border-radius:4px;";
    panel.appendChild(header);

    const container = document.createElement('div');
    container.style.paddingLeft = "4px";
    
    props.forEach(type => {
      const btn = document.createElement('button');
      btn.textContent = type;
      btn.style.cssText = "display:block; width:100%; text-align:left; background:transparent; color:#d1d5db; border:none; border-left:1px solid #374151; margin:1px 0; padding:2px 6px; cursor:pointer; font-size:11px;";
      
      // Hover
      btn.onmouseenter = () => { btn.style.color = '#fff'; btn.style.background = '#374151'; };
      btn.onmouseleave = () => { btn.style.color = '#d1d5db'; btn.style.background = 'transparent'; };

      btn.onclick = () => {
        // Spawn Logic
        const gx = state.player.x; 
        const gy = state.player.y;
        
        // Try offsets: Right, Left, Down, Up
        const offsets = [[1,0], [-1,0], [0,1], [0,-1]];
        let placed = false;
        
        for(let o of offsets) {
           const tx = gx + o[0];
           const ty = gy + o[1];
           const k = (typeof key === 'function') ? key(tx,ty) : `${tx},${ty}`;
           
           // Only spawn if empty floor or existing prop (overwrite prop is ok)
           // Check bounds, floor tile (1), no pickup, no enemy
           if(inBounds(tx,ty) && state.tiles[ty][tx] === 1 && !state.pickups[k] && !enemyAt(tx,ty)) {
             state.props[k] = { type: type };
             state.tiles[ty][tx] = 8; // Mark as prop/obstacle
             placed = true;
             console.log(`Spawned [${type}] at ${tx},${ty}`);
             if(typeof draw === 'function') draw();
             break;
           }
        }
        if(!placed) alert('Move to an open space (needs empty tile adjacent to player).');
      };
      container.appendChild(btn);
    });
    panel.appendChild(container);
    
    // Accordion Toggle
    header.onclick = () => {
       const isHidden = container.style.display === 'none';
       container.style.display = isHidden ? 'block' : 'none';
       header.textContent = (isHidden ? '▼ ' : '► ') + biome;
    };
  }
  document.body.appendChild(panel);

  // 4. Inject Spawner Buttons into Debug Modal
  const dbgContainer = document.querySelector('#debugModal .row[style*="margin-top"]');
  if(dbgContainer) {
      // 4a. Prop Spawner Button
      const toggle = document.createElement('button');
      toggle.className = 'btn';
      toggle.textContent = "Open Prop Spawner";
      toggle.style.borderColor = "#a855f7";
      toggle.onclick = () => {
          const p = document.getElementById('debugPropPanel');
          if(p) { p.style.display = 'block'; document.getElementById('debugModal').style.display = 'none'; document.body.classList.remove('noscroll'); }
      };
      dbgContainer.appendChild(toggle);

      // 4b. NEW: Puzzle Spawner Button
      const puzzleToggle = document.createElement('button');
      puzzleToggle.className = 'btn';
      puzzleToggle.textContent = "Open Puzzle Spawner";
      puzzleToggle.style.borderColor = "#60a5fa";
      puzzleToggle.style.color = "#60a5fa";
      puzzleToggle.onclick = () => {
          const p = document.getElementById('debugPuzzlePanel');
          if(p) { p.style.display = 'block'; document.getElementById('debugModal').style.display = 'none'; document.body.classList.remove('noscroll'); }
      };
      dbgContainer.appendChild(puzzleToggle);
  }

  // --- 5. NEW: Puzzle Selection Panel ---
  const puzzlePanel = document.createElement('div');
  puzzlePanel.id = 'debugPuzzlePanel';
  puzzlePanel.style.cssText = "position:fixed; top:120px; right:10px; width:180px; max-height:60vh; overflow-y:auto; background:rgba(10,15,20,0.95); border:1px solid #60a5fa; color:#fff; font-family:monospace; font-size:11px; z-index:11000; padding:4px; box-shadow: 2px 2px 10px #000; display:none;";
  puzzlePanel.innerHTML = '<div style="color:#60a5fa; border-bottom:1px solid #555; margin-bottom:6px; font-weight:bold; cursor:pointer; text-align:right;" onclick="this.parentElement.style.display=\'none\'">CLOSE [X]</div>';

  const puzzleLib = {
    'Boulder Puzzles': [
      { name: '1: Easy Trio (3)', type: 0, diff: 0 },
      { name: '2: Central Cross (3)', type: 0, diff: 1 },
      { name: '3: Small Triangle (3)', type: 0, diff: 2 },
      { name: '4: Wide Plates (4)', type: 0, diff: 3 },
      { name: '5: Compact Square (4)', type: 0, diff: 4 },
      { name: '6: Split Core (4)', type: 0, diff: 5 },
      { name: '7: Twin Gate (4)', type: 0, diff: 6 },
      { name: '8: Offset T (4)', type: 0, diff: 7 },
      { name: '9: Corner Block (5)', type: 0, diff: 8 },
      { name: '10: Hallway Line (5)', type: 0, diff: 9 },
      { name: '11: Blockade (5)', type: 0, diff: 10 },
      { name: '12: Checker Columns (6)', type: 0, diff: 11 },
      { name: '13: Extreme Offset (6)', type: 0, diff: 12 },
      { name: '14: Six Pack (6)', type: 0, diff: 13 },
      { name: '15: Seven Seas (7)', type: 0, diff: 14 },
      { name: '16: Hexahedron (7)', type: 0, diff: 15 },
      { name: '17: Chaos (7)', type: 0, diff: 16 }
    ],
  };

  for (const [cat, variations] of Object.entries(puzzleLib)) {
      const h = document.createElement('div'); h.textContent = cat; h.style.cssText = "color:#9ca3af; margin-top:4px; font-weight:bold; background:#1f2937; padding:4px;";
      puzzlePanel.appendChild(h);
      variations.forEach(v => {
          const b = document.createElement('button'); b.textContent = v.name;
          b.style.cssText = "display:block; width:100%; text-align:left; background:transparent; color:#d1d5db; border:none; margin:1px 0; padding:4px; cursor:pointer;";
          b.onclick = () => {
              if (!state._inPuzzleRoom) {
                  state.puzzleEntryX = state.player.x;
                  state.puzzleEntryY = state.player.y;
                  state._prevFov = state.fovRadius;
              }
              state.fovRadius = 22; // Let there be light!
              state._inPuzzleRoom = true;
              state.puzzlePortalX = null;
              
              generatePuzzleArea(v.type, v.diff);
              state.player.x = state.puzzleStartX;
              state.player.y = state.puzzleStartY;
              state.player.rx = state.puzzleStartX;
              state.player.ry = state.puzzleStartY;
              log(`[debug] Teleported to ${cat}: ${v.name}`);
              draw();
          };
          puzzlePanel.appendChild(b);
      });
  }
  document.body.appendChild(puzzlePanel);
}

// ====== CODEX SYSTEM ======
const CODEX_KEY = 'dc_codex_v1';
const CODEX_DEF = {
  // Enemies
  Rat: { name:'Rat', desc:'A disease-ridden rodent wandering the dungeon floors.', seen:false, kills:0 },
  Bat: { name:'Bat', desc:'Flits in the shadows. Drinks blood to heal.', seen:false, kills:0 },
  Slime: { name:'Slime', desc:'A mindless blob of acidic jelly.', seen:false, kills:0 },
  Spider: { name:'Spider', desc:'Web-spinning hunter. Slows its prey.', seen:false, kills:0 },
  Goblin: { name:'Goblin', desc:'Quick and greedy. Steals items.', seen:false, kills:0 },
  Skeleton: { name:'Skeleton', desc:'Animated bones. Often reassembles.', seen:false, kills:0 },
  Mage: { name:'Mage', desc:'Casts spells from a distance.', seen:false, kills:0 },
  Mimic: { name:'Mimic', desc:'A chest with teeth. Surprise!', seen:false, kills:0 },
  // Bosses
  'The Rat King': { name:'The Rat King', desc:'What was once a ordinary rat has now become monstrous in size due to the fallout of the great Mage War.', seen:false, kills:0 },
  'Count Fang': { name:'Count Fang', desc:'', seen:false, kills:0 },
  'Broodmother': { name:'Broodmother', desc:'', seen:false, kills:0 },
  'Sir Squish': { name:'Sir Squish', desc:'', seen:false, kills:0 },
  'Throngler': { name:'Throngler', desc:'The lone survivor of his clan. Watched in horror as his village was burned to the ground in the crossfire of the Battle of Stoneburn.', seen:false, kills:0 },
  'Mr. Humerus': { name:'Mr. Humerus', desc:'.', seen:false, kills:0 },
  'Archon of Ash': { name:'Archon of Ash', desc:'', seen:false, kills:0 },
  'Your Shadow': { name:'Your Shadow', desc:'', seen:false, kills:0 },
  'The Mad King': { name:'The Mad King', desc:'', seen:false, kills:0 },
  // NPCs
  Merchant: { name:'Merchant', desc:'Buys and sells goods.', seen:false },
  Blacksmith: { name:'Blacksmith', desc:'Repairs your equipment.', seen:false },
 Jester: { name:'Jester', desc:'Plays games of chance.', seen:false },
  Cartographer: { name:'Cartographer', desc:'Maps the floor for a price.', seen:false },
  Cleric: { name:'Cleric', desc:'A holy figure who offers blessings and purification.', seen:false }, // <--- NEW
  // Effects
  MiasmaChamber: { name:'Miasma Chamber', desc:'Poisonous air fills the floor.', seen:false },
  ShadowLabyrinth: { name:'Shadow Labyrinth', desc:'Vision is severely limited.', seen:false },
  Bloodhunt: { name:'Bloodhunt', desc:'Enemies are stronger and faster.', seen:false },
  
  // --- NEW: Endless Floor Effects ---
  GlacialFreeze:  { name:'Glacial Freeze',  desc:'The floor is ice. Movement carries momentum.', seen:false },
  VolatileAether: { name:'Volatile Aether', desc:'Enemies explode shortly after death.', seen:false },
  AntiMagic:      { name:'Anti-Magic Field',desc:'Magic is disabled, but Melee is stronger.', seen:false },
  ArcaneFlux:     { name:'Arcane Flux',     desc:'Magic is amplified, but Melee is weak.', seen:false },
  StaminaDrain:   { name:'Stamina Drain',   desc:'Every action requires double effort.', seen:false }, // NEW
// Existing Interactable
  Shrine: { name:'Mystical Shrine', desc:'A holy altar that offers a blessing... or a curse.', seen:false, triggered:0 }, 
  Gold_Well: { name:'Golden Well', desc:'Toss 500g to wish for power.', seen:false, activated:0 }, // <--- ADDED
  
// New Shrine Effect Trackers (Inferred from interact() function)
  Shrine_Mimic:   { name:'Shrine: Summoned Mimic',   desc:'Triggers a surprise Mimic encounter.', seen:false, activated:0 },
  Shrine_Heal:    { name:'Shrine: Full Restore',     desc:'Restores all HP and MP.', seen:false, activated:0 },
  Shrine_XP:      { name:'Shrine: XP Boost',         desc:'Grants +50 Magic XP.', seen:false, activated:0 },
  Shrine_Teleport: { name:'Shrine: Teleport',        desc:'Teleports you to a random floor tile.', seen:false, activated:0 },
  // --- NEW: Shrine Variants ---
  Shrine_Blood:   { name:'Shrine: Blood Altar',      desc:'Demands HP in exchange for an Item.', seen:false, activated:0 },
  Shrine_Midas:   { name:'Shrine: Midas Touch',      desc:'Converts HP directly into Gold.', seen:false, activated:0 },
  // ----------------------------
  
  // New NPC Interaction Trackers
  Merchant_Bought:   { name:'Merchant: Items Bought',    desc:'Total items purchased (potions, tonics, lockpicks).', seen:false, interactions:0 }, 
  Merchant_Sold:     { name:'Merchant: Items Sold',      desc:'Total items sold to the Merchant.', seen:false, interactions:0 },      
  Blacksmith_Repair: { name:'Blacksmith: Repairs Done',  desc:'Total times durability was restored.', seen:false, interactions:0 },  
  Jester_Spin:       { name:'Jester: Wheel Spins',       desc:'Total spins of the Wheel of Fate.', seen:false, interactions:0 },      
  Cartographer_Map:  { name:'Cartographer: Maps Bought', desc:'Total maps purchased.', seen:false, interactions:0 },  
  Cleric_Bless:      { name:'Cleric: Blessings',         desc:'Total times purified or blessed by the Cleric.', seen:false, interactions:0 },

  // --- Weapon Effects ---
  Sharp:    { name:'Prefix: Sharp',    desc:'Refined edge. Increases Min and Max damage by 1.', seen:false },
  Heavy:    { name:'Prefix: Heavy',    desc:'Weighted for impact. Increases Max damage by 3.', seen:false },
  Vampiric: { name:'Prefix: Vampiric', desc:'Drains life essence. Heals 1 HP on successful hits.', seen:false },
Ancient:  { name:'Prefix: Ancient',  desc:'Lost technology. Increases Min and Max damage by 2.', seen:false },
  
  // --- NEW: Curses ---
  Curse_Blood:   { name:'Curse: Blood',   desc:'The weapon hungers. Drains HP periodically.', seen:false },
  Curse_Greed:   { name:'Curse: Greed',   desc:'A hole in your pocket. Drains Gold periodically.', seen:false },
  Curse_Rust:    { name:'Curse: Rust',    desc:'Brittle steel. Durability degrades twice as fast.', seen:false },
  Curse_Frailty: { name:'Curse: Frailty', desc:'Cursed skin. You take +2 Damage from all sources.', seen:false },

  // --- NEW: Weapon Arts ---
  Art_Cleave:   { name:'Art: Cleave',   desc:'(Axe/2H) A circular swing that hits all adjacent foes.', seen:false, activated:0 },
  Art_Hurl:     { name:'Art: Hurl',     desc:'(Axe) Throws weapon 5 tiles for 3x damage. Must be retrieved.', seen:false, activated:0 }, // <--- ADD THIS
  Art_Pierce:   { name:'Art: Pierce',   desc:'(Spear) Strikes two tiles in a straight line.', seen:false, activated:0 },
  Art_Backstab: { name:'Art: Backstab', desc:'(Sword) Teleports behind a foe for a critical strike.', seen:false, activated:0 },
  Art_Flurry:   { name:'Art: Flurry',   desc:'(Fists) Unleashes three rapid strikes.', seen:false, activated:0 },
  Art_Overload: { name:'Art: Overload', desc:'(Staff) Unleashes a massive wave of raw magic.', seen:false, activated:0 },

  // --- NEW: Trinkets ---
  'Ring of Haste':  { name:'Ring of Haste',  desc:'Increases Max Stamina by 2.', picked:0, seen:false },
  'Amulet of Life': { name:'Amulet of Life', desc:'Slowly regenerates HP over time.', picked:0, seen:false },
  "Thief's Band":   { name:"Thief's Band",   desc:'Increases Gold found by 30%.', picked:0, seen:false },
  "Warrior's Ring": { name:"Warrior's Ring", desc:'Adds +1 Flat Damage to all attacks.', picked:0, seen:false },
  "Stone Charm":    { name:"Stone Charm",    desc:'Increases Damage Reduction by 10%.', picked:0, seen:false },
  "Scholar's Lens": { name:"Scholar's Lens", desc:'Increases XP gain by 15%.', picked:0, seen:false },

  // --- NEW: Cursed Idols ---
  'Idol of War':   { name:'Idol of War',   desc:'+20% Damage, but you cannot Heal.', picked:0, seen:false },
  'Idol of Stone': { name:'Idol of Stone', desc:'+15% Damage Reduction, but you move at half speed.', picked:0, seen:false },
  'Idol of Greed': { name:'Idol of Greed', desc:'+50% Gold found, but you take +50% Damage.', picked:0, seen:false },
  'Idol of Rot': { name:'Idol of Rot', desc:'Deals damage to nearby enemies, but hurts you when moving.', picked:0, seen:false },

  // --- LORE NOTES ---
  Note_1: { name:'Torn Page 1', desc:'" "', seen:false },
  Note_2: { name:'Torn Page 2', desc:'" "', seen:false },
  Note_3: { name:'Torn Page 3', desc:'" "', seen:false },
  Note_4: { name:'Torn Page 4', desc:'" "', seen:false },
  Note_5: { name:'Torn Page 5', desc:'" "', seen:false },
  Note_6: { name:'Torn Page 6', desc:'" "', seen:false },
  Note_7: { name:'Torn Page 7', desc:'" "', seen:false },
  Note_8: { name:'Torn Page 8', desc:'" "', seen:false },
  Note_9: { name:'Torn Page 9', desc:'" "', seen:false },
  Note_10: { name:'Torn Page 10', desc:'" "', seen:false },
  Note_11: { name:'Torn Page 11', desc:'" "', seen:false },
  Note_12: { name:'Torn Page 12', desc:'" "', seen:false },
  Note_13: { name:'Torn Page 13', desc:'" "', seen:false },
  Note_14: { name:'Torn Page 14', desc:'" "', seen:false },
  Note_15: { name:'Torn Page15', desc:'" "', seen:false },
  
  // --- BASE EQUIPMENT ---
  Wep_Shortsword: { name:'Shortsword', desc:'', seen:false },
  Wep_Claymore: { name:'Claymore', desc:'', seen:false },
  Wep_Spear: { name:'Spear', desc:'', seen:false },
 Wep_Axe: { name:'Axe', desc:'', seen:false },
    Wep_Warhammer: { name:'Warhammer', desc:'', seen:false },
    Wep_Battleaxe: { name:'Battleaxe', desc:'', seen:false },
    Wep_Halberd: { name:'Halberd', desc:'', seen:false },
    Wep_Knuckles: { name:'Knuckle Duster', desc:'', seen:false },
    Wep_Claws: { name:'Claws', desc:'', seen:false },
    Wep_Staff: { name:'Wizards Staff', desc:'', seen:false },
    Wep_Key: { name:'Key of Destiny', desc:'You feel this weapon resonate deep within your heart. Some say it can open any lock.', seen:false },
  Shld_Buckler: { name:'Buckler', desc:'', seen:false },
  Shld_Kite: { name:'Kite Shield', desc:'', seen:false },
  Shld_Tower: { name:'Tower Shield', desc:'', seen:false },
  Shld_Ancient: { name:'Ancient Shield', desc:'', seen:false },
};
if (typeof PICK2_POOL !== 'undefined') {
  PICK2_POOL.forEach(p => {
    const niceName = p.id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    CODEX_DEF[p.id] = { 
      name: niceName, 
      desc: p.label, 
      seen: false,
      picked: 0  // <--- ADD THIS LINE
    };
  });
}
function loadCodex(){
  const stored = JSON.parse(localStorage.getItem(CODEX_KEY)||'{}');
  const merged = { ...CODEX_DEF }; // Start with the complete default definition
  
  for (const k in stored) {
    if (merged[k]) {
        // Merge the saved data INTO the default definition,
      // preserving default properties like 'interactions: 0' if not present in 'stored'.
      merged[k] = {
        ...merged[k], // default properties (like interactions:0)
        ...stored[k], // saved values (like kills:10 or seen:true)
        
        // --- FIX: Force fresh text from code (ignores saved legacy text) ---
        name: merged[k].name,
        desc: merged[k].desc
      };
    }
  }
  return merged;
}
function saveCodex(c){ localStorage.setItem(CODEX_KEY, JSON.stringify(c)); }

function unlockCodex(key, increment=false){
  if (!key) return;
  const c = loadCodex();
  
  // Handle loose mapping
  let entry = c[key];
  if (!entry && typeof getBossName === 'function') entry = c[getBossName(key)];
  
  if (entry){
    if (!entry.seen) entry.seen = true;
    
    if (increment) {
       // Is it an enemy?
       if (entry.kills !== undefined) {
         entry.kills++;
       } 
       // Is it an Omen?
       else if (entry.picked !== undefined || (typeof PICK2_POOL !== 'undefined' && PICK2_POOL.some(p => p.id === key))) {
         entry.picked = (entry.picked || 0) + 1;
       }
       // Is it a Shrine or NPC tracker? <--- NEW LOGIC HERE
       else if (entry.activated !== undefined) {
         entry.activated = (entry.activated || 0) + 1;
       }
       else if (entry.interactions !== undefined) {
         entry.interactions = (entry.interactions || 0) + 1; // <--- This line relies on interactions:0 being present
       }
    }
    saveCodex(c);
  }
}s

function renderCodexUI(){
  const list = document.getElementById('codexContent');
  if (!list) return;
  list.innerHTML = '';
  // Force flex column to override the CSS Grid layout
  list.style.display = 'flex';
  list.style.flexDirection = 'column';
  
  const c = loadCodex();

  // 1. Define Categories (Clustered with Sub-groups)
  const cats = [
    {
      title: 'Bestiary',
      groups: [
        { subtitle: 'Enemies', keys: ['Rat','Bat','Spider','Slime','Goblin','Skeleton','Mage','Mimic'] },
        { subtitle: 'Bosses', keys: ['The Rat King','Count Fang','Broodmother','Sir Squish','Throngler','Mr. Humerus','Archon of Ash','Your Shadow','The Mad King'] }
      ]
    },
    {
      title: 'Equipment',
      groups: [
        { subtitle: 'Base Weapons', keys: ['Wep_Shortsword','Wep_Key','Wep_Claymore','Wep_Warhammer','Wep_Spear','Wep_Halberd','Wep_Axe','Wep_Battleaxe','Wep_Knuckles','Wep_Claws','Wep_Staff'] },
        { subtitle: 'Shields', keys: ['Shld_Buckler','Shld_Kite','Shld_Tower','Shld_Ancient'] }
      ]
    },
    {
      title: 'World & NPCs',
      groups: [
        { subtitle: 'Inhabitants', keys: ['Merchant','Blacksmith','Jester','Cartographer','Cleric'] },
        { subtitle: 'Discoveries', keys: ['Shrine', 'Gold_Well'] },
        { subtitle: 'Floor Effects', keys: ['MiasmaChamber','ShadowLabyrinth','Bloodhunt','GlacialFreeze','VolatileAether','AntiMagic','ArcaneFlux'] },
        { subtitle: 'Shrine Outcomes', keys: ['Shrine_Mimic','Shrine_Heal','Shrine_XP','Shrine_Teleport','Shrine_Blood','Shrine_Midas'] },
        { subtitle: 'NPC Transactions', keys: ['Merchant_Bought','Merchant_Sold','Blacksmith_Repair','Jester_Spin','Cartographer_Map','Cleric_Bless'] }
      ]
    },
    {
      title: 'Collection',
      groups: [
        { subtitle: 'Weapon Arts', keys: ['Art_Cleave', 'Art_Hurl','Art_Pierce', 'Art_Backstab', 'Art_Flurry', 'Art_Overload'] },
        { subtitle: 'Weapon Traits', keys: ['Sharp', 'Heavy', 'Vampiric', 'Ancient'] },
        { subtitle: 'Trinkets', keys: ['Ring of Haste', 'Amulet of Life', "Thief's Band", "Warrior's Ring", "Stone Charm", "Scholar's Lens"] },
        { subtitle: 'Cursed Idols', keys: ['Idol of War', 'Idol of Stone', 'Idol of Greed', 'Idol of Rot'] }
      ]
    },
    {
      title: 'Notes',
      groups: [
        { subtitle: 'Dungeon Lore', keys: ['Note_1', 'Note_2', 'Note_3', 'Note_4', 'Note_5',
        'Note_6', 'Note_7', 'Note_8', 'Note_9', 'Note_10',
        'Note_11', 'Note_12', 'Note_13', 'Note_14', 'Note_15'] }
      ]
    }
  ];

  // Dynamic Omens (Added as a sub-group to Collection)
  if (typeof PICK2_POOL !== 'undefined') {
     const omenKeys = PICK2_POOL.map(p => p.id);
     cats[2].groups.push({ subtitle: 'Omens', keys: omenKeys });
  }

  // 2. Create Scrollable Tab Row
  const tabRow = document.createElement('div');
  tabRow.style.cssText = "display:flex; gap:8px; overflow-x:auto; padding:4px 4px 12px 4px; border-bottom:1px solid rgba(255,255,255,0.1); margin-bottom:10px; flex-shrink:0;";
  list.appendChild(tabRow);

  // 3. Create Content Container
  const contentBody = document.createElement('div');
  contentBody.style.cssText = "flex:1; overflow-y:auto; padding-right:4px; max-height:60vh;"; 
  list.appendChild(contentBody);

  // 4. Render Logic (Updated to handle Groups)
  const renderTab = (cat, activeBtn) => {
     // Reset all tab styles
     Array.from(tabRow.children).forEach(b => {
         b.style.background = 'transparent';
         b.style.color = '#9ca3af';
         b.style.borderColor = 'rgba(255,255,255,0.2)';
     });
     // Highlight active
     activeBtn.style.background = '#1b2a3a';
     activeBtn.style.color = '#f9d65c';
     activeBtn.style.borderColor = '#f9d65c';

     contentBody.innerHTML = '';
     
     // Loop through groups instead of flat keys
     cat.groups.forEach(group => {
         // Render Section Header if subtitle exists
         if(group.subtitle){
             const sub = document.createElement('div');
             sub.style.cssText = "font-size:13px; color:#f9d65c; margin:15px 0 8px 0; text-transform:uppercase; letter-spacing:1px; font-weight:700; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px; opacity:0.9;";
             sub.textContent = group.subtitle;
             contentBody.appendChild(sub);
         }

         group.keys.forEach(k => {
             const data = c[k];
             const row = document.createElement('div');
             row.className = 'card';
             row.style.marginBottom = '10px';
             row.style.padding = '10px';
             row.style.background = 'rgba(255,255,255,0.03)';

             if (data && data.seen) {
                 let statHtml = '';
                 if (data.kills !== undefined) statHtml = `<div style="font-size:12px; color:#ef4444; font-weight:700;">Kills: ${data.kills}</div>`;
                 else if (data.picked !== undefined) statHtml = `<div style="font-size:12px; color:#60a5fa; font-weight:700;">Picked: ${data.picked}</div>`;
                 else if (data.activated !== undefined) {
                     const label = (k === 'Gold_Well') ? 'Donated' : 'Activated';
                     statHtml = `<div style="font-size:12px; color:#7df9ff; font-weight:700;">${label}: ${data.activated}</div>`;
                 }
                 else if (data.interactions !== undefined) statHtml = `<div style="font-size:12px; color:#f6d66a; font-weight:700;">Count: ${data.interactions}</div>`;

                 row.innerHTML = `
                   <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                     <div>
                       <div style="font-weight:800; font-size:16px; color:#d9e7f5;">${data.name}</div>
                       <div style="font-size:13px; opacity:0.8; margin-top:4px; line-height:1.4;">${data.desc}</div>
                     </div>
                     <div style="text-align:right; min-width:60px;">${statHtml}</div>
                   </div>
                 `;
             } else {
                 row.innerHTML = `<div style="opacity:0.4; font-style:italic;">??? (Undiscovered)</div>`;
             }
             contentBody.appendChild(row);
         });
     });

     if(contentBody.innerHTML === '') {
        contentBody.innerHTML = '<div style="opacity:0.5; font-style:italic; padding:10px;">Nothing here yet.</div>';
     }
  };

  // 5. Initialize Tabs
  cats.forEach((cat, idx) => {
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = cat.title;
      // Button styling
      btn.style.cssText = "padding:6px 10px; font-size:13px; white-space:nowrap; border-radius:8px; border:1px solid rgba(255,255,255,0.2); background:transparent; color:#9ca3af; cursor:pointer;";
      
      btn.onclick = () => renderTab(cat, btn);
      tabRow.appendChild(btn);

      // Auto-select the first tab
      if (idx === 0) renderTab(cat, btn);
  });
}



