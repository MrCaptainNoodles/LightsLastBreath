// ====== Gameplay ======
function collectIfPickup(){
  const kxy=key(state.player.x,state.player.y);
  if(state.tiles[state.player.y][state.player.x]===5 && state.pickups[kxy]){
    const it=state.pickups[kxy];
    if(it.kind==='weapon'){
        // --- NEW: Check Category Limit ---
        const wType = getWeaponType(it.payload.name);
        const curCount = countWeaponsInCategory(wType);
        if (curCount >= MAX_WEAPON_CAT) {
            openWeaponSwapModal(it.payload, kxy, state.player.x, state.player.y);
            return; 
        }
        // ---------------------------------
        SFX.pickup();
        state.inventory.weapons[it.payload.name]=(state.inventory.weapons[it.payload.name]||0)+1;
        
        // --- FIX: Preserve thrown weapon durability ---
        if (it.payload.dur !== undefined) {
            state.inventory.stashed = state.inventory.stashed || {};
            if (!state.inventory.stashed[it.payload.name]) state.inventory.stashed[it.payload.name] = [];
            state.inventory.stashed[it.payload.name].push(it.payload);
        }
        // ----------------------------------------------
        
        log(`Picked up ${it.payload.name} (now x${state.inventory.weapons[it.payload.name]}).`);

        // --- NEW: Codex Unlock (Weapons) ---
        let cKey = 'Wep_' + it.payload.name.replace(/ /g,''); 
        // Handle irregular names
        if(it.payload.name === 'Knuckle Duster') cKey = 'Wep_Knuckles';
        if(it.payload.name === 'Key of Destiny') cKey = 'Wep_Key';
        if(it.payload.name.includes('Staff'))    cKey = 'Wep_Staff'; // Maps Fire Staff -> Wep_Staff
        unlockCodex(cKey, true);
        // -----------------------------------

        // --- TUTORIAL Step 4 (Pickup -> Equip) ---
      if (state.gameMode === 'tutorial' && state.tutorialStep === 4 && it.payload.name === 'Warhammer'){
        hideBanner();
        showBanner(`Warhammer acquired! Press (${getInputName('inventory')}) and go to weapons to equip it.`, 999999);
      }
      // -----------------------------------------

    }else if(it.kind==='potion'){
        SFX.pickup();    
      state.inventory.potions++; log(`Picked up a potion. (${state.inventory.potions})`);
    }else if(it.kind==='tonic'){
        SFX.pickup();    
      state.inventory.tonics++; log(`Picked up a tonic. (${state.inventory.tonics})`);
}else if(it.kind==='antidote'){
      SFX.pickup();
      state.inventory.antidotes++;
      log(`Picked up an antidote. (${state.inventory.antidotes})`);
    }else if(it.kind==='trinket'){
            SFX.pickup();
            state.inventory.trinkets = state.inventory.trinkets || {};
            state.inventory.trinkets[it.payload] = (state.inventory.trinkets[it.payload]||0) + 1;
            unlockCodex(it.payload, true); // <--- Updates Codex count & seen status
            log(`Picked up ${it.payload}.`);
        }else if(it.kind==='note'){
            SFX.pickup();
            unlockCodex(it.payload, true);
            log(`You found a note and recorded it in your Codex.`);
        }else if(it.kind==='idol'){
            // --- NEW: Idol Pickup ---
  SFX.pickup();
  state.inventory.idols = state.inventory.idols || {};
  state.inventory.idols[it.payload] = (state.inventory.idols[it.payload]||0) + 1;
  unlockCodex(it.payload, true); // <--- Updates Codex count & seen status
  log(`Picked up ${it.payload}. You feel a heavy burden...`);
// --- ADD THIS BLOCK ---
    }else if(it.kind==='shield'){
        SFX.pickup();
        // Add to inventory (Shields live in the 'weapons' list in your code)
        state.inventory.weapons[it.payload] = (state.inventory.weapons[it.payload]||0)+1; 
        log(`Picked up ${it.payload}.`);

        // Codex Unlock logic
        let sKey = 'Shld_' + it.payload.replace(' Shield',''); 
        if(it.payload === 'Buckler') sKey = 'Shld_Buckler';
        unlockCodex(sKey, true);
    }else if(it.kind==='bomb'){
      SFX.pickup();
      state.inventory.bombs = (state.inventory.bombs|0) + (it.payload||1);
      log(`Picked up ${it.payload||1} Bomb(s). (${state.inventory.bombs})`);
    }else if(it.kind==='warp'){
          SFX.pickup();
          state.inventory.warpStones = (state.inventory.warpStones|0) + (it.payload||1);
          log(`Picked up ${it.payload||1} Warp Stone(s). (${state.inventory.warpStones})`);
// ------------------------------------
        }else if(it.kind==='lore'){
        SFX.pickup();
        unlockCodex(it.payload.id, true);
        log(`You found a torn page! Check your Codex.`);
      }else if(it.kind==='lockpicks'){
        SFX.pickup();    
      state.inventory.lockpicks += it.payload; log(`Picked up ${it.payload} lockpick(s). (${state.inventory.lockpicks})`);
    } else if (it.kind === 'arrows'){
      SFX.pickup();
      state.inventory.arrows = (state.inventory.arrows | 0) + (it.payload | 0);
      log(`Picked up ${it.payload} arrows.`);

      // FIX: Auto-load bow if empty
      if (state.player.bow && state.player.bow.loaded === 0 && state.inventory.arrows > 0) {
        state.player.bow.loaded = 1;
        state.inventory.arrows--;
        if (typeof updateEquipUI === 'function') updateEquipUI();
      }
    } else if (it.kind === 'shield'){
  SFX.pickup();
  // FIX: Use the name from payload (fallback to Buckler if old save data)
  const sName = (typeof it.payload === 'string') ? it.payload : 'Buckler';
  
  // Add to named weapons inventory
  state.inventory.weapons[sName] = (state.inventory.weapons[sName]||0) + 1;
  
  log(`Picked up a ${sName}.`);
  
  // Auto-equip specific name
  if (!state.player.shield && isShieldAllowed()) { equipShield(sName); }
  else { updateEquipUI?.(); }

  updateEquipUI();
}else if(it.kind === 'spell'){
  SFX.pickup();
  const sp   = it.payload;      // { name, cost, tier }
  const name = sp.name;

  const have = state.spells.find(s => s.name === name);
  if (!have){
    // First copy → learn the spell, keep tier
    state.spells.push({
      name: name,
      cost: sp.cost,
      tier: sp.tier
    });
    // harmless even if we never use upgrades again
    if (typeof ensureSpellUpgradeSlot === 'function') ensureSpellUpgradeSlot(name);

    if (!state.equippedSpell){
      state.equippedSpell = state.spells[state.spells.length - 1];
    }
    log(`Learned spell: ${name} Lv${sp.tier}.`);

  } else if ((sp.tier|0) > (have.tier|0)) {
    // Higher-tier scroll replaces the lower-tier version
    have.tier = sp.tier;
    log(`${name} upgraded to Lv${have.tier}.`);

  } else {
          // Extra copies → Magic skill XP instead of shards
          ensureSkill('magic');
          const mg   = state.skills.magic;
          // Base 4 + 1 XP for every 5 floors depth
          const gain = MAGIC_SCROLL_XP + Math.floor(state.floor / 5);

          mg.xp += gain;
          if (!mg.shown) mg.shown = true;

    let leveled = false;
    while (mg.xp >= mg.next){
      mg.xp   -= mg.next;
      mg.lvl  += 1;
      mg.next  = Math.floor(mg.next * SKILL_XP_GROWTH);
      leveled  = true;
    }

    if (leveled){
      log(`You deepen your understanding of ${name}. Magic advanced to ${mg.lvl}.`);
    } else {
      log(`Studied another ${name} scroll (+${gain} Magic XP).`);
    }

    if (typeof renderSkills === 'function') renderSkills();
  }

  if (typeof updateSpellBody === 'function') updateSpellBody();
  if (typeof updateInvBody === 'function')   updateInvBody?.();

  delete state.pickups[kxy];
  state.tiles[state.player.y][state.player.x] = 1;
  if (typeof draw === 'function') draw();
}


    delete state.pickups[kxy];
    state.tiles[state.player.y][state.player.x]=1;
    updateInvBody();
    updateEquipUI();

    // FIX: Force immediate redraw so sprite vanishes now, not next turn
    if (typeof draw === 'function') draw();
  }
}

function tryMove(dx,dy){
  if (state.gameOver) return;
  if (state._inputLocked || state._descending) return;

  // (Empty - I removed the Idol of Stone block from here)

  // --- NEW: Idol of Rot (Self Damage on Move) ---
  if (state.inventory.idols?.['Idol of Rot']) {
      if (Math.random() < 0.20) { // 20% chance per step to take damage
          state.player.hp--; 
          spawnFloatText("-1", state.player.x, state.player.y, '#5f2e86'); // Purple
          if(state.player.hp<=0) { triggerGameOver(); return; }
          updateBars();
      }
  }

  const nx=state.player.x+dx, ny=state.player.y+dy;
  if(!inBounds(nx,ny)) return;
  const t=state.tiles[ny][nx];
  if(t===0) { 
    // Wall bump dust (Reduced count)
    spawnParticles(nx - (dx*0.4), ny - (dy*0.4), '#9ca3af', 3); 
    return; 
  }
  if(enemyAt(nx,ny)) { log('An enemy blocks the way.'); return; }
  if(t===2) { log(`A door blocks the way. Press ${getInputName('interact')} to open/unlock.`); return; }
  if(t===3) { log(`A chest blocks the way. Press ${getInputName('interact')} to open.`); return; }
  if(t===6) { log(`A mystical shrine blocks the way. Press ${getInputName('interact')} to interact.`); return; }
  
  // 1. ADDED: Block movement into scenery
  
  if(t===8) {
    const pKey = key(nx,ny);
    const pType = state.props[pKey]?.type || 'crate';
    
    // --- PORTAL TELEPORTS ---
    if (pType === 'puzzle_portal_dead') {
        log("The gateway has sealed shut permanently.");
        return;
    }
    if (pType === 'puzzle_portal') {
        log("You step through the Ethereal Gateway...");
        if (SFX.lockSuccess) SFX.lockSuccess(); 
        
        // --- VISION & CAMERA ADJUSTMENT ---
        state._prevFov = state.fovRadius;
        state.fovRadius = 22; // Large enough to see the whole 15x17 room
        state._inPuzzleRoom = true;
        // ----------------------------------

        state.puzzleEntryX = state.player.x;
        state.puzzleEntryY = state.player.y;
        state.puzzlePortalX = nx;
        state.puzzlePortalY = ny;
        
        state.player.x = state.puzzleStartX;
        state.player.y = state.puzzleStartY;
        state.player.rx = state.puzzleStartX;
        state.player.ry = state.puzzleStartY;
        draw();
        return;
    }
    if (pType === 'puzzle_exit') {
        log("You return to the dungeon...");
        if (SFX.lockSuccess) SFX.lockSuccess();

        // --- RESTORE VISION & CAMERA ---
        state.fovRadius = state._prevFov || 5;
        state._inPuzzleRoom = false;
        // -------------------------------

        state.player.x = state.puzzleEntryX;
        state.player.y = state.puzzleEntryY;
        state.player.rx = state.puzzleEntryX;
        state.player.ry = state.puzzleEntryY;
        draw();
        return;
    }

    if (pType === 'boulder') {
            const bx = nx + dx, by = ny + dy;
            const tNext = state.tiles[by]?.[bx];
            // Can push into floor or plate
            if (inBounds(bx, by) && (tNext === 1 || tNext === 16) && !enemyAt(bx, by) && !state.props[key(bx,by)]) {
                state.props[key(bx, by)] = state.props[pKey];
        delete state.props[pKey];
        state.tiles[by][bx] = 8;
        state.tiles[ny][nx] = state.props[key(bx,by)].underTile || 1;
        state.props[key(bx, by)].underTile = tNext;
        
        // --- MULTI-BOULDER COMPLETION CHECK ---
        if (state.boulderPuzzleActive) {
            let platesCovered = 0;
            for (const pk in state.props) {
                if (state.props[pk].type === 'boulder' && state.props[pk].underTile === 16) platesCovered++;
            }
            if (platesCovered >= state.puzzlePlatesCount) {
                log("A heavy mechanism grinds! The chasm closes!");
                if (SFX.lockSuccess) SFX.lockSuccess();
                // Fill in the pits blocking the lore note
                for (let x = state.puzzleRoomX; x < state.puzzleRoomX + state.puzzleRoomW; x++) {
                    if (state.tiles[state.puzzleGateY][x] === 15) {
                        state.tiles[state.puzzleGateY][x] = 1; // Turn pit to floor
                    }
                }
                state.boulderPuzzleActive = false; // Puzzle solved
            }
        }
      } else {
        log("The boulder won't budge.");
        return;
      }
    } else if (pType === 'lever' || pType === 'lever_locked') {
      if (pType === 'lever_locked') {
        log("The lever is jammed permanently.");
        return;
      }
      if (SFX.lockSuccess) SFX.lockSuccess();
      log("You pulled a lever! The architecture shifts.");
      for(let y=0; y<state.size.h; y++){
        for(let x=0; x<state.size.w; x++){
          if(state.tiles[y][x] === 17) state.tiles[y][x] = 18;
          else if(state.tiles[y][x] === 18) state.tiles[y][x] = 17;
        }
      }
      if (state.puzzlePullsLeft !== undefined) {
        state.puzzlePullsLeft--;
        if (state.puzzlePullsLeft <= 0) {
          log("The levers lock permanently in place!");
          for(let py=0; py<state.size.h; py++){
            for(let px=0; px<state.size.w; px++){
              if(state.props[key(px,py)]?.type === 'lever') state.props[key(px,py)].type = 'lever_locked';
            }
          }
        }
      }
      state.gameTurn = (state.gameTurn || 0) + 1;
      draw();
      return;
} else {
      log(`A ${pType} blocks the way. Press ${getInputName('attack')} to smash it!`);
      return;
    }
  }

  // Puzzle Pits
  if (t === 15 || t === 18) {
      log("You fall into the abyss!");
      state.player.hp = Math.max(1, state.player.hp - 2);
      if (typeof flashDamage === 'function') flashDamage();
      if (state.puzzleStartX) {
          state.player.x = state.puzzleStartX;
          state.player.y = state.puzzleStartY;
          state.player.rx = state.puzzleStartX;
          state.player.ry = state.puzzleStartY;
      }
      draw();
      return;
  
      
      if (SFX.step) SFX.step();
      if (typeof collectIfPickup === 'function') collectIfPickup();
      enemyStep();
      draw();
      return;
  }

  // --- NEW: Spike Trap Logic ---
  if(t===7) {
    if (state.skills?.lockpicking?.perks?.['loc_b3']) {
        state.tiles[ny][nx] = 1;
        spawnFloatText("DISARMED", nx, ny, '#9ca3af');
        log("You safely disarmed the spike trap.");
    } else if (state.skills?.lockpicking?.perks?.['loc_c6']) {
        state.armedTraps = state.armedTraps || new Set();
        state.armedTraps.add(key(nx,ny));
        spawnFloatText("ARMED", nx, ny, '#facc15');
    } else {
        let finalDmg = Math.max(5, Math.floor(state.player.hpMax * 0.10));
        if (state.skills?.survivability?.perks?.['sur_c4']) finalDmg = Math.ceil(finalDmg / 2); // Juggernaut
        if (window._godMode) finalDmg = 0;
        
        state.player.hp = clamp(state.player.hp - finalDmg, 0, state.player.hpMax);
        flashDamage();
        SFX.weaponBreak(); 
        log(`You step on spikes! Took ${finalDmg} damage.`);
        spawnFloatText(finalDmg, nx, ny, '#ff0000');
        updateBars();
        if(state.player.hp <= 0) { triggerGameOver(); return; }
    }
  }
  // NEW: block NPC tiles BEFORE moving
  if (isMerchantTile(nx, ny)) { log('The merchant blocks the way.'); return; }
  if (isBlacksmithTile(nx, ny)) { log('The blacksmith blocks the way.'); return; }
  if (isJesterTile(nx, ny)) { log('The jester blocks the way.'); return; }
  if (isCartographerTile(nx, ny)) { log('The cartographer blocks the way.'); return; }
  if (isClericTile(nx, ny)) { log('The priestess blocks the way.'); return; }

  // --- NEW: Gold Well Interaction ---
  if (state.goldWell) {
     const w = state.goldWell;
     // Block movement into the 2x2 area (x,y to x+1,y+1)
     if (nx >= w.x && nx <= w.x+1 && ny >= w.y && ny <= w.y+1) {
        log(`A Golden Well blocks the way. Press ${getInputName('interact')} to interact.`);
        return;
     }
  }

// NEW: set facing from movement
  if (dx>0) state.player.facing='right';
  else if (dx<0) state.player.facing='left';
  else if (dy>0) state.player.facing='down';
  else if (dy<0) state.player.facing='up';

  // Handle Player Slow (Spider web)
  if (state.player.slowed && state.player.slowTicks > 0) {
      // 50% chance to fail movement? Or move every other turn? 
      // Let's do: Movement takes 2 turns of enemy time.
      // Implementation: We move, but we call enemyStep() TWICE.
      enemyStep(); // Extra enemy turn cost
      state.player.slowTicks--;
      if (state.player.slowTicks <= 0) {
          state.player.slowed = false;
          log('You break free of the webs.');
      }
  }

  // Set facing based on final direction (dx, dy)
  if (dx>0) state.player.facing='right';
  else if (dx<0) state.player.facing='left';
  else if (dy>0) state.player.facing='down';
  else if (dy<0) state.player.facing='up';

// --- NEW: Glacial Freeze (Slide) for non-Sprint ---
  if (isEffectActive('GlacialFreeze')) { // FIX: Use isEffectActive
    // 1. CRITICAL: If the tile we just stepped onto (nx, ny) is STAIRS, STOP!
    if (state.tiles[ny][nx] !== 4) {

        // Current target is (nx, ny). We check one more tile ahead.
        const slideX = nx + dx;
        const slideY = ny + dy;
        
        // Check if the NEXT tile is walkable (1, 4, 5) AND not blocked by NPC/Enemy
        const tNext = state.tiles[slideY]?.[slideX];
        const validTile = (tNext === 1 || tNext === 4 || tNext === 5);
        
        if (inBounds(slideX, slideY) && validTile && !enemyAt(slideX, slideY) &&
            !isMerchantTile(slideX,slideY) && !isBlacksmithTile(slideX,slideY) &&
            !isJesterTile(slideX,slideY) && !isCartographerTile(slideX,slideY) &&
            !isClericTile(slideX,slideY)) { 
            
            // Before sliding, check intermediate pickup
            const kIntermediate = key(nx, ny);
            if (state.pickups[kIntermediate]) {
                state.player.x = nx; state.player.y = ny; 
                collectIfPickup(); 
                log('You grab an item as you slide!');
            }

            state.player.x = slideX;
            state.player.y = slideY;
            log('You slide on the ice!');
            
            SFX.step();
            collectIfPickup(); 
            enemyStep(); draw();
            return; 
        }
    }
 }
  // -----------------------------------------------------

      // --- NEW: Track Consecutive Steps for Perks ---
      const moveDir = dx + "," + dy;
      if (state.player._lastMoveDir === moveDir) state.player._consecutiveSteps = (state.player._consecutiveSteps || 0) + 1;
      else { state.player._consecutiveSteps = 1; state.player._lastMoveDir = moveDir; }
      
      state.player._fleetFooted = false; state.player._afterimage = false;
      if (state.player._consecutiveSteps >= 3) {
          if (state.skills?.one?.perks?.['one_b2']) state.player._fleetFooted = true;
          if (state.skills?.one?.perks?.['one_c3']) state.player._afterimage = true;
          if (state.skills?.one?.perks?.['one_c4']) state.player._momentumReady = true;
      }
      if (state.player._consecutiveSteps >= 2) {
          if (state.skills?.spear?.perks?.['spear_c7']) state.player._dragoonReady = true;
      }
      // ----------------------------------------------

  state.player.x = nx;
      state.player.y = ny;
      state.player._justMoved = true; // Perk: Track movement for Spear Lunge
      
      // FIX: Snap visuals if animation loop isn't active (fixes Tutorial movement freeze)
      
      // FIX: Snap visuals if animation loop isn't active (fixes Tutorial movement freeze)
      if (!state._animating) { state.player.rx = nx; state.player.ry = ny; draw(); }

      SFX.step();

      // --- NEW: Advance Turn & Check Toggle Spikes ---
  state.gameTurn = (state.gameTurn || 0) + 1;
  
  // --- FIX: Troll Blood (Heal 1 HP every 10 turns) ---
  if (state.gameTurn % 10 === 0 && state.skills?.survivability?.perks?.['sur_b3']) {
      if (state.player.hp < state.player.hpMax) {
          state.player.hp = Math.min(state.player.hpMax, state.player.hp + state.skills.survivability.perks['sur_b3']);
          spawnFloatText("+1", state.player.x, state.player.y, '#4ade80');
          updateBars();
      }
  }
  // --------------------------------------------------
  
  const spikesActive = Math.floor(state.gameTurn / 3) % 2 !== 0;
  
  // Check if we stepped onto a tile that is now active (Tile 9)
  if (state.tiles[ny][nx] === 9 && spikesActive) {
      if (state.skills?.lockpicking?.perks?.['loc_c6']) {
          spawnFloatText("IGNORED", nx, ny, '#facc15');
      } else {
          let finalDmg = Math.max(5, Math.floor(state.player.hpMax * 0.15));
          if (state.skills?.survivability?.perks?.['sur_c4'] ) finalDmg = Math.ceil(finalDmg / 2); // Juggernaut
          if (window._godMode) finalDmg = 0;

          state.player.hp = clamp(state.player.hp - finalDmg, 0, state.player.hpMax);
          flashDamage();
          SFX.weaponBreak();
          log(`Timed spikes impale you for ${finalDmg}!`);
          spawnFloatText(finalDmg, nx, ny, '#ff0000');
          updateBars();
          if(state.player.hp <= 0) { triggerGameOver(); return; }
      }
  }
  // -----------------------------------------------

  // (leave the rest of your function as-is)


// --- NEW: MIASMA ticks every other PLAYER STEP (movement only) ---
  if (isEffectActive('MiasmaChamber')){ // FIX: Use isEffectActive
    state._miasmaSteps = (state._miasmaSteps|0) + 1;
    if (state._miasmaSteps % 3 === 0){
      // Scale: 1 dmg base + 1 per 20 floors (Reduced scaling to prevent instant death loops)
      let p = 1 + Math.floor(state.floor/20); 
      
      // Juggernaut applies to Hazard damage
      if (state.skills?.survivability?.perks?.['sur_c4']) p = Math.ceil(p / 2);
      if (window._godMode) p = 0;

      state.player.hp = clamp(state.player.hp - p, 0, state.player.hpMax);
      flashDamage();
      if (p > 0) log(`The miasma burns you for ${p}.`);
      updateBars();
      if (state.player.hp <= 0){ triggerGameOver(); return; }
    }
  }
  // --- END: MIASMA step tick ---

  collectIfPickup();
  enemyStep();
  draw();
}

// ====== Mobile Joystick — continuous movement while held ======
(() => {
  const joy  = document.getElementById('joystick');
  const knob = document.getElementById('joyStick');
  if (!joy || !knob) return;

  // prevent rubber-band scrolling on iOS over the joystick
  joy.style.touchAction = 'none';

  let held = false, stepTimer = null;
  let vecX = 0, vecY = 0;   // latest pointer delta from center

  const MAX_TRAVEL = 44;    // knob travel radius (px)
  const DEADZONE   = 12;    // ignore tiny nudges (px)
  const STEP_MS    = 120;   // how often we issue a move

  function setKnob(dx, dy){
    const len = Math.hypot(dx, dy) || 1;
    const kx = Math.max(-MAX_TRAVEL, Math.min(MAX_TRAVEL, (dx/len)*MAX_TRAVEL));
    const ky = Math.max(-MAX_TRAVEL, Math.min(MAX_TRAVEL, (dy/len)*MAX_TRAVEL));
    knob.style.transform = `translate(${kx}px, ${ky}px)`;
  }
  function resetKnob(){ knob.style.transform = 'translate(0,0)'; }

  function dirToStep(dx, dy){
    const ax = Math.abs(dx), ay = Math.abs(dy);
    if (Math.max(ax, ay) < DEADZONE) return [0, 0];
    // 4-way: whichever axis has the larger magnitude wins
    if (ax > ay) return [dx > 0 ? 1 : -1, 0];
    return [0, dy > 0 ? 1 : -1];
  }

  function readPointer(ev){
    const t = ev.touches ? ev.touches[0] : ev;
    const r = joy.getBoundingClientRect();
    return { x: t.clientX - (r.left + r.width/2), y: t.clientY - (r.top + r.height/2) };
  }

  function startStepping(){
    if (stepTimer) clearInterval(stepTimer);
    stepTimer = setInterval(() => {
      const [sx, sy] = dirToStep(vecX, vecY);
      if (sx || sy) tryMove(sx, sy);
    }, STEP_MS);
  }
  function stopStepping(){
    if (stepTimer) { clearInterval(stepTimer); stepTimer = null; }
  }

  function onStart(ev){
    held = true;
    const p = readPointer(ev);
    vecX = p.x; vecY = p.y;
    setKnob(vecX, vecY);
    startStepping();
    ev.preventDefault();
  }
  function onMove(ev){
    if (!held) return;
    const p = readPointer(ev);
    vecX = p.x; vecY = p.y;
    setKnob(vecX, vecY);
    ev.preventDefault();
  }
  function onEnd(){
    held = false;
    vecX = vecY = 0;
    resetKnob();
    stopStepping();
  }

  joy.addEventListener('touchstart', onStart, { passive:false });
  joy.addEventListener('touchmove',  onMove,  { passive:false });
  joy.addEventListener('touchend',   onEnd,   { passive:false });
  joy.addEventListener('touchcancel',onEnd,   { passive:false });
})();

// helper: descend a floor with audio + short fade
function doDescend(){

  if (state.gameOver || state._descending) return;
  state._descending = true;

// make sure flags exists for depth-50 checks later
state.flags ||= {};

// Hide boss HUD during the whole stair transition
state._suppressBossHud = true;
if (typeof updateBossHud === 'function') updateBossHud();

// create (or reuse) a black overlay in the canvas wrap
const wrap = document.getElementById('cw') || document.body;
let fx = document.getElementById('fadeBlack');
if (!fx){
fx = document.createElement('div');
fx.id = 'fadeBlack';
Object.assign(fx.style, {
position:'absolute', left:0, top:0, right:0, bottom:0,
background:'#000', opacity:'0', pointerEvents:'none',
zIndex:'12', transition:'opacity 340ms ease-in-out'
});
wrap.appendChild(fx);
}

// start fade and play the descend sfx
fx.style.opacity = '1';
if (SFX?.descend) SFX.descend();

// after fade-in completes, do the actual floor transition while screen is black
setTimeout(() => {
// -----------------------------------------------------------
    // --- START: CLEAR PREVIOUS FLOOR EFFECTS AND SHRINE EFFECTS ---
    
    // Cleanup from the Shrine Gamble effects
    if (state.player.tempMaxHPBoost) {
        state.player.hpMax -= state.player.tempMaxHPBoost; // Revert the Max HP change
        state.player.hp = clamp(state.player.hp, 0, state.player.hpMax);
    }
    delete state.player.tempMaxHPBoost;
    delete state.player.movementSlowed;

// Cleanup Floor Effects
const prevEffect = Array.isArray(state.floorEffect) ? state.floorEffect[0] : state.floorEffect;
state.floorEffect = []; 
delete state.player.tempVisionRange;

// reset “every other step” counter when entering a new floor
state._miasmaSteps = 0;

// --- APPLY FLOOR EFFECTS ---
const isEndless = state.gameMode !== 'classic';
const nextFloor = state.floor + 1; 
let newBgColor = 'rgba(0,0,0,0)'; 

// Only apply effects if it's NOT a boss floor
if (nextFloor % 10 !== 0) {
    
    // --- COMBINATION LOGIC (Depth 51+) ---
    if (isEndless && nextFloor > 50 && (nextFloor % 50 !== 0)) { // (Updated check to ensure it runs on non-boss floors)
        // Calculate number of effects (starts at 2 for floor 51+, 3 for 101+, max 8)
        const numEffects = Math.min(8, 2 + Math.floor((nextFloor - 51) / 50));
        
        const ALL_EFFECTS = [
            'MiasmaChamber', 'ShadowLabyrinth', 'Bloodhunt', 
            'GlacialFreeze', 'VolatileAether', 'AntiMagic', 
            'ArcaneFlux', 'StaminaDrain'
        ];
        
        // Pick unique effects
        state.floorEffect = shuffle([...ALL_EFFECTS]).slice(0, numEffects);
        
        // Apply immediate flags
        if (state.floorEffect.includes('ShadowLabyrinth')) state.player.tempVisionRange = 2;
        if (state.floorEffect.includes('VolatileAether')) state.explosions = []; 

        // Visuals: Pick a tint based on the first effect
        const base = state.floorEffect[0];
        if (base === 'MiasmaChamber') newBgColor = 'rgba(34,197,94,0.18)';
        else if (base === 'Bloodhunt') newBgColor = 'rgba(190,24,93,0.14)';
        else if (base === 'GlacialFreeze') newBgColor = 'rgba(165, 243, 252, 0.15)';
        else if (base === 'VolatileAether') newBgColor = 'rgba(234, 88, 12, 0.15)';
        else if (base === 'AntiMagic') newBgColor = 'rgba(100, 100, 100, 0.25)';
        else if (base === 'ArcaneFlux') newBgColor = 'rgba(147, 51, 234, 0.15)';
        else if (base === 'StaminaDrain') newBgColor = 'rgba(234, 234, 234, 0.15)';
        
        log(`Depth ${nextFloor}: ${numEffects} active curses!`);
    }
    // --- CLASSIC MODE ---
    else if (!isEndless) {
       let picked = false;
       while (!picked) {
           const roll = Math.random();
           let eff = null;
           let bg = 'rgba(0,0,0,0)';
           
           if (roll < 0.20) { eff = 'Bloodhunt'; bg = 'rgba(190,24,93,0.14)'; }
           else if (roll < 0.40) { eff = 'AntiMagic'; bg = 'rgba(100, 100, 100, 0.25)'; }
           else if (roll < 0.60) { eff = 'ArcaneFlux'; bg = 'rgba(147, 51, 234, 0.15)'; }
           else if (roll < 0.80) { eff = 'MiasmaChamber'; bg = 'rgba(34,197,94,0.18)'; }

           if (eff && eff === prevEffect) continue; // Reroll if it's a duplicate of the last floor
           
           if (eff) { state.floorEffect = eff; newBgColor = bg; }
           picked = true;
       }
    }
    // --- ENDLESS MODE (Floors 1-49) ---
    else {
       let picked = false;
       while (!picked) {
           const roll = Math.random();
           let eff = null;
           let bg = 'rgba(0,0,0,0)';
           let doVision = false;
           let doExplosions = false;

           if (roll < 0.12) { eff = 'MiasmaChamber'; bg = 'rgba(34,197,94,0.18)'; }
           else if (roll < 0.24) { eff = 'ShadowLabyrinth'; doVision = true; }
           else if (roll < 0.36) { eff = 'Bloodhunt'; bg = 'rgba(190,24,93,0.14)'; }
           else if (roll < 0.48) { eff = 'GlacialFreeze'; bg = 'rgba(165, 243, 252, 0.15)'; }
           else if (roll < 0.60) { eff = 'VolatileAether'; bg = 'rgba(234, 88, 12, 0.15)'; doExplosions = true; }
           else if (roll < 0.72) { eff = 'AntiMagic'; bg = 'rgba(100, 100, 100, 0.25)'; }
           else if (roll < 0.84) { eff = 'ArcaneFlux'; bg = 'rgba(147, 51, 234, 0.15)'; }
           else if (roll < 0.96) { eff = 'StaminaDrain'; bg = 'rgba(234, 234, 234, 0.15)'; }

           if (eff && eff === prevEffect) continue; // Reroll if it's a duplicate of the last floor

           if (eff) { 
               state.floorEffect = eff; 
               newBgColor = bg; 
               if (doVision) state.player.tempVisionRange = 2;
               if (doExplosions) state.explosions = [];
           }
           picked = true;
       }
    }
}

// Set the tint ONLY on the play area (canvas wrap), not the whole page
const tintEl = document.getElementById('floorTint');
if (tintEl) tintEl.style.background = newBgColor;

    // --- END: FLOOR EFFECTS SETUP ---

    // -----------------------------------------------------------


log('You descend.');

// recover HP (Base 25%)
let heal = Math.ceil(state.player.hpMax * 0.25);

// --- FIX: Survivability Regeneration (Heal 1 HP per level per floor) ---
if (state.skills?.survivability?.perks?.['sur_b1']) {
    heal += state.skills.survivability.perks['sur_b1'];
}
// Regeneration (sur_c6) - Heal +5 HP per level
if (state.skills?.survivability?.perks?.['sur_c6']) {
    heal += (5 * state.skills.survivability.perks['sur_c6']);
}
// -----------------------------------------------------------------------

state.player.hp = Math.min(state.player.hp + heal, state.player.hpMax);
log(`You recover ${heal} HP.`);

// recover 20% MP (min 1)
let mpHeal = Math.max(1, Math.ceil(state.player.mpMax * 0.20));

// --- NEW: Mana Surge (mag_c8) ---
if (state.skills?.magic?.perks?.['mag_c8']) {
    mpHeal = state.player.mpMax; // Full Restore
}

state.player.mp = Math.min(state.player.mp + mpHeal, state.player.mpMax);
log(`You also recover ${mpHeal} MP.`);
updateBars();


// go deeper
state.floor++;
state.run.depth = Math.max(state.run.depth, state.floor);

// build the next floor while we’re still black
gen(); 

// (Sixth Sense removed, ID loc_c1 repurposed to Bounty)

updateDynamicMusic(); // <--- NEW: Switch track based on new floor
enemyStep(); draw?.(); updateBars(); updateEquipUI(); 

    // sync Depth chip
    const fc = document.getElementById('floorChip');
    if (fc) fc.textContent = 'Depth ' + state.floor;

    // keep it black a touch longer so the sound “reads”, then fade back in
    setTimeout(() => {
      fx.style.opacity = '0';
      setTimeout(() => {
        state._descending = false;

        // re-enable boss HUD now that the fade is fully finished
        state._suppressBossHud = false;
        if (typeof updateBossHud === 'function') updateBossHud();

        // --- NEW: floor-effect popup banner ---
        
        // 1. Normalize active effects to an array (handles Strings or Arrays)
        const active = Array.isArray(state.floorEffect) 
            ? state.floorEffect 
            : (state.floorEffect ? [state.floorEffect] : []);

        // 2. Unlock Codex for ALL active effects
        active.forEach(eff => unlockCodex(eff));

        // 3. Define text mappings (Short names for combos, Long for single)
        const TEXT_MAP = {
            MiasmaChamber:   { short: "Miasma",   long: "Miasma Chamber — the air itself poisons you." },
            ShadowLabyrinth: { short: "Shadows",  long: "Shadow Labyrinth — your vision is strangled by darkness." },
            Bloodhunt:       { short: "Bloodhunt",long: "Bloodhunt — in the unseen, enemies surge toward you." },
            GlacialFreeze:   { short: "Ice",      long: "Glacial Freeze — the floor is slick. Momentum carries you." },
            VolatileAether:  { short: "Aether",   long: "Volatile Aether — the air hums. Enemies explode upon death." },
            AntiMagic:       { short: "Silence",  long: "Anti-Magic Field — spells act strangely silent, but your blade sings." },
            ArcaneFlux:      { short: "Flux",     long: "Arcane Flux — raw magic surges, but your physical strength wanes." },
            StaminaDrain:    { short: "Fatigue",  long: "Stamina Drain — every action requires double effort." }
        };

        // 4. Generate Banner
          if (active.length === 1) {
            // Single Effect: Show full flavor text
            const info = TEXT_MAP[active[0]];
            if (info) {
                showBanner(info.long, 4000);
                log(info.long); // <--- ADDED: Log to history
            }
          } else if (active.length > 1) {
            // Combo Effect: Join short names (e.g. "CURSES: Miasma + Shadows + Fatigue")
            const names = active.map(e => TEXT_MAP[e] ? TEXT_MAP[e].short : e);
            const msg = `CURSES: ${names.join(" + ")}`;
            showBanner(msg, 5000);
            log(msg); // <--- ADDED: Log to history
          }
        
        // --- END: floor-effect popup banner ---

        // Depth 50 Classic: trigger intro cutscene (it will hide HUD again)
        if (state.gameMode === 'classic' &&
            state.floor === 50 &&
            !state.flags.depth50IntroDone) {
          setTimeout(() => runDepth50Intro(), 50);
        }
      }, 360);
    }, 2200); // hold time while the sound plays
  }, 340);    // fade-in duration
}






function interact(){
  if (state.gameOver) return;
  if (state._inputLocked || state._descending) return;

  // Blacksmith first, then Merchant
  if (isNearBlacksmith(state.player.x, state.player.y)){
    if (typeof window.openBlacksmith === 'function') window.openBlacksmith();
    else if (typeof openBlacksmith === 'function') openBlacksmith();
    return;
  }

  if (isNearMerchant(state.player.x, state.player.y)){
    if (typeof window.openMerchant === 'function') window.openMerchant();
    else if (typeof openMerchant === 'function') openMerchant();
    return;
  }

  if (isNearJester(state.player.x, state.player.y)){
    if (typeof window.openJester === 'function') window.openJester();
    else if (typeof openJester === 'function') openJester();
    return;
  }

  if (isNearCartographer(state.player.x, state.player.y)){
    if (typeof window.openCartographer === 'function') window.openCartographer();
    else if (typeof openCartographer === 'function') openCartographer();
    return;
  }

  // --- NEW: Cleric Check ---
  if (state.cleric && Math.abs(state.player.x - state.cleric.x) + Math.abs(state.player.y - state.cleric.y) <= 1) {
    if (typeof window.openCleric === 'function') window.openCleric();
    return;
  }
  
  // --- NEW: Gold Well Check ---
  if (state.goldWell) {
     const w = state.goldWell;
     // Check proximity: Player must be adjacent to the 2x2 box
     // The well covers (w.x, w.y) to (w.x+1, w.y+1).
     // We expand bounds by 1 to check adjacency.
     if (state.player.x >= w.x - 1 && state.player.x <= w.x + 2 &&
         state.player.y >= w.y - 1 && state.player.y <= w.y + 2) {
         // Ensure we aren't somehow inside it (though tryMove blocks that)
         const inside = (state.player.x >= w.x && state.player.x <= w.x+1 && state.player.y >= w.y && state.player.y <= w.y+1);
         if (!inside && typeof window.openGoldWell === 'function') { 
            window.openGoldWell(); 
            return; 
         }
     }
  }
  // -------------------------
  // -------------------------

  let did = false;
  for(const nb of neighbors4(state.player.x,state.player.y)){
    

    if(inBounds(nb.x,nb.y) && state.tiles[nb.y][nb.x]===3){
      openChest(nb.x,nb.y); did=true;
    }


    // --- SHRINE INTERACTION LOGIC ---
if(inBounds(nb.x,nb.y) && state.tiles[nb.y][nb.x]===6){
  state.tiles[nb.y][nb.x] = 1; // Change shrine to used floor tile
  SFX.spell(); 
  unlockCodex('Shrine', true);
  
  const roll = Math.random();
  
  // 1. Blood Altar (20%): Pay HP for an Item
  if (roll < 0.20) {
    const cost = Math.floor(state.player.hpMax * 0.3);
    state.player.hp = Math.max(1, state.player.hp - cost);
    updateBars();
    flashDamage();
    log(`The shrine demands blood! (-${cost} HP)`);
    // Drop a weapon or good item
    const dropType = Math.random() < 0.5 ? 'weapon' : 'scroll';
    const k = key(nb.x, nb.y);
    state.tiles[nb.y][nb.x] = 5; // Pickup tile
    
    if(dropType === 'weapon'){
        state.pickups[k] = { kind:'weapon', payload: randomWeapon() };
        log("A weapon materializes from the blood.");
    } else {
        state.pickups[k] = { kind:'spell', payload: randomSpell() };
        log("A scroll materializes from the blood.");
    }
    spawnParticles(nb.x, nb.y, '#ef4444', 8); 
    unlockCodex('Shrine_Blood', true);

  // 2. Midas Touch (20%): Pay HP for Gold
  } else if (roll < 0.40) {
    const dmg = Math.floor(state.player.hpMax * 0.15);
    state.player.hp = Math.max(1, state.player.hp - dmg);
    const gold = rand(25, 75) + (state.floor * 3); // <--- Reduced base (25-75) and scaling (*3)
    state.inventory.gold += gold;
    updateBars();
    flashDamage();
    log(`The shrine turns your flesh to gold! (-${dmg} HP, +${gold}g)`);
    spawnParticles(state.player.x, state.player.y, '#fbbf24', 8); 
    unlockCodex('Shrine_Midas', true);

  // 3. Summon Mimic (Trap) (20%)
  } else if (roll < 0.60) {
    log('The shrine hums... and traps you!');
    if (typeof spawnMimic === 'function') spawnMimic(nb.x, nb.y); 
    unlockCodex('Shrine_Mimic', true);

  // 4. Full Heal (20%)
  } else if (roll < 0.80) {
    state.player.hp = state.player.hpMax;
    state.player.mp = state.player.mpMax;
    state.player.stamina = state.player.staminaMax; // <--- ADDED
    log('Divine light restores your vitality and endurance!');
    updateBars();
    unlockCodex('Shrine_Heal', true);
    spawnParticles(state.player.x, state.player.y, '#fff', 8);

  // 5. XP Boost (~16%)
  } else if (roll < 0.84) {
    const xp = 50 + (state.floor * 5);
    log(`Ancient knowledge flows into you. (+${xp} XP)`);
    state.player.xp += xp; 
    while(state.player.xp >= state.player.next){
       state.player.xp -= state.player.next;
       state.player.level++;
       state.player.next = Math.floor(state.player.next * 1.30);
       openLevelUpModal();
    }
    unlockCodex('Shrine_XP', true);
    updateBars();
    spawnParticles(state.player.x, state.player.y, '#60a5fa', 8);

  // 6. TELEPORT (~16%)
  } else {
    // Find a random safe spot far away
    const spot = findFreeFloorTile(8); // Min 8 tiles away
    if (spot) {
      state.player.x = spot.x;
      state.player.y = spot.y;
      state.player.rx = spot.x; state.player.ry = spot.y; // Snap visuals
      
      log("The shrine warps space around you!");
      spawnFloatText("WARP", state.player.x, state.player.y, '#00ffff');
      SFX.spell(); 
      unlockCodex('Shrine_Teleport', true);
    } else {
      log("The shrine flickers... nothing happens.");
    }
  }
  
  did = true;
  // Only turn if something happened (which it did)
  enemyStep(); 
  draw();


  // 👇 ADD THESE TWO LINES HERE 👇
  // This advances the turn, which is necessary for effects like enemy spawning (Mimic) 
  // or immediate redraws (Teleport/HP update) to properly resolve without a player move.
  if (typeof enemyStep === 'function') enemyStep(); 
  if (typeof draw === 'function') draw();
  
  did = true;
}
        if(inBounds(nb.x,nb.y) && state.tiles[nb.y][nb.x]===2){
      // Check for Key of Destiny
      const hasKey = state.player.weapon?.name?.includes('Key of Destiny');
      
      if(hasKey || state.inventory.lockpicks>0){
        ensureSkill('lockpicking');
        
        // Perk: Locksmith (15% chance per level to not consume lockpick) & Skeleton Key (Unbreakable)
        let keepPick = false;
        if (state.skills?.lockpicking?.perks?.['loc_base']) keepPick = Math.random() < (0.15 * state.skills.lockpicking.perks['loc_base']);
        if (state.skills?.lockpicking?.perks?.['loc_c5']) keepPick = true;
        

        // Tutorial OR Key = Instant Success
        let success;
        if (state.gameMode === 'tutorial' || hasKey ) {
          success = true; // loc_a2 = Master Thief (Guaranteed Success)
        } else {
          const L = state.skills['lockpicking'].lvl || 1;
          const chance = Math.max(0.10, Math.min(0.95, 0.35 + 0.10*(L-1)));
          success = (Math.random() < chance);
        }
        
        if (!success && !hasKey && !keepPick) {
            state.inventory.lockpicks--;
            updateInvBody?.(); // Ensure UI reflects the used pick on failure
        }

      if (success){
          incrementMetaStat('locks'); // <--- NEW: Track lockpick success
          state.tiles[nb.y][nb.x] = 1;
          
          // Only grant XP if we actually used a lockpick (no Key)
          if (!hasKey) {
            state.skills['lockpicking'].shown = true;
            state.skills['lockpicking'].xp += 6;
            while (state.skills['lockpicking'].xp >= state.skills['lockpicking'].next){
              state.skills['lockpicking'].xp -= state.skills['lockpicking'].next;
              state.skills['lockpicking'].lvl++;
              state.skills['lockpicking'].next = Math.floor(state.skills['lockpicking'].next * 1.5);
              log('Lockpicking advanced to ' + state.skills['lockpicking'].lvl + '.');
            }
          }

          renderSkills();
          SFX.lockSuccess();

          if (hasKey) log('The Key of Destiny unlocks the path.');
          else        log(`You pick the lock and open the door. (${state.inventory.lockpicks})`);

          if (state.gameMode === 'tutorial') {
            // --- TUTORIAL Step 12 (Door) ---
            if (state.tutorialStep === 12) {
              state.tutorialStep = 13;
              hideBanner();
              showBanner(`Step 13: Open the Chest with (${getInputName('interact')}) to finish!`, 999999);
            }
          }
        } else {
          SFX.lockFail();
          log(`Lockpick attempt failed. (${state.inventory.lockpicks})`);
        }

        draw(); did = true;
      } else {
        log('It is locked. Need a lockpick.');
        did = true;
      }
    }

  }

  // --- Tutorial: once door + chest are cleared, reveal the stairs ---
  if (state.gameMode === 'tutorial' && state.tutorialStep === 5 &&
      state.tiles[27][15] === 1 && state.tiles[24][15] === 1) {
    // stairs in the lower room (29,17)
    state.tiles[29][17] = 4;
    if (SFX.bossDown) SFX.bossDown();
    draw();
    state.tutorialStep = 6;
    say("The stairs appear! Step onto them to finish the tutorial.");
  }

  // Normal Stairs
  if (state.tiles[state.player.y][state.player.x] === 4){
    state.nextFloorCursed = false; // Clear curse
    // In the tutorial, stepping on the stairs sends you back to the main menu.
    if (state.gameMode === 'tutorial') {
      // optional: mark run over / stop timer if you use one
      state.gameOver = true;
      if (typeof stopRunTimer === 'function') stopRunTimer();

      // Go back to the main menu overlay
      if (typeof goMenu === 'function') goMenu();
    } else {
      // Normal behavior for Classic / Endless
      doDescend();
    }
    return;
  }

  // Red Cursed Stairs
  if (state.tiles[state.player.y][state.player.x] === 10){
    state.nextFloorCursed = true;
    spawnFloatText("CURSED!", state.player.x, state.player.y, '#ef4444');
    SFX.bossDown(); 
    doDescend();
    return;
  }

  if(!did) log('Nothing to interact with.');
}



// --- NEW: Prop Smashing Logic ---
function handlePropSmash(x, y) {
  const k = key(x, y); // <--- MOVED UP: Define 'k' at the very top so it is available everywhere

  // --- TUTORIAL OVERRIDE (Step 3 -> 4) ---
  // Allow smash to advance tutorial even if previous steps (like Sprint) were missed
  if (state.gameMode === 'tutorial') {
    delete state.props[k]; // Use 'k' here
    state.tiles[y][x] = 1; 
    SFX.weaponBreak();
    spawnParticles(x, y, '#8b5a2b', 5);

    // 1. Spawn Warhammer (Two-Handed) on floor
    state.pickups[k] = {
      kind: 'weapon',
      payload: {name:'Warhammer', type:'two', min:6, max:10, base:{min:6,max:10}, durMax:15, dur:15}
    };
    state.tiles[y][x] = 5; // Pickup tile

    // 2. Force Step 4 (Pickup phase)
    state.tutorialStep = 4;
    hideBanner();
    showBanner("Step 4: Walk over the Warhammer to pick it up.", 999999);
    
    draw();
    return;
  }
  const prop = state.props[k];
  const name = prop ? prop.type : 'crate';

  // --- PUZZLE PROTECTION ---
  if (name === 'boulder' || name === 'puzzle_portal' || name === 'puzzle_exit' || name.includes('lever')) {
      log("Your weapon clangs uselessly against it.");
      return; 
  }

  // Remove prop visual and physical block
  if (state.props[k]) delete state.props[k];
  state.tiles[y][x] = 1; // Turn into floor
  
  SFX.weaponBreak(); // Crunch sound
  spawnParticles(x, y, '#8b5a2b', 5); // Wood chips

  const roll = Math.random();

  // 1. Bad Outcome (10%): Enemy or Poison
  if (roll < 0.10) {
    if (Math.random() < 0.5) {
      // Spawn Rat or Slime
      const type = (Math.random() < 0.5) ? 'Rat' : 'Slime';
      const hp = (type === 'Rat') ? 4 : 5;
      state.enemies.push({ x, y, type, hp, atk:[1,2], xp:3, size:1 });
      log(`A ${type} bursts out of the ${name}!`);
      spawnFloatText("!", x, y, '#ef4444');
    } else {
      // Poison Cloud (Damage Player)
      const dmg = damageAfterDR(3);
      state.player.hp = clamp(state.player.hp - dmg, 0, state.player.hpMax);
      
      if (!state.skills?.survivability?.perks?.['sur_b2']) {
          state.player.poisoned = true; 
          state.player.poisonTicks = 8;
          spawnFloatText("POISON", x, y, '#22c55e');
          log(`Noxious gas leaks from the ${name}! Took ${dmg} dmg.`);
      } else {
          log(`Noxious gas leaks from the ${name}, but you are immune to poison! Took ${dmg} dmg.`);
      }
      
      flashDamage();
      updateBars();
    }
  }
  // 2. Good Outcome (20%): Loot
  else if (roll < 0.30) {
    const lootR = Math.random();
    if (lootR < 0.4) {
      const g = rand(5, 15);
      state.inventory.gold += g;
      log(`Found ${g} gold inside. (${state.inventory.gold})`);
      spawnFloatText(`+${g}g`, x, y, '#facc15');
    } else if (lootR < 0.7) {
      state.inventory.arrows += 3;
      log(`Found a bundle of arrows. (${state.inventory.arrows})`);
      spawnFloatText("+3 Arrows", x, y, '#9ca3af');
    } else if (lootR < 0.9) {
      state.inventory.potions++;
      log(`Found a potion. (${state.inventory.potions})`);
      spawnFloatText("+1 Potion", x, y, '#ef4444');
    } else {
      state.inventory.bombs++;
      log(`Found a bomb! (${state.inventory.bombs})`);
      spawnFloatText("+1 Bomb", x, y, '#f97316');
    }
    updateInvBody();
  }
  // 3. Empty (70%)
  else {
    log(`You smash the ${name}. It was empty.`);
  }
  
  enemyStep(); // Consumes a turn
  draw();
}

// Chest weapon chance scales with depth (floor 1 ≈ 45%, +1%/floor, capped 65%)
const CHEST_WEAPON_BASE        = 0.40;
const CHEST_WEAPON_FLOOR_BONUS = 0.01;
const CHEST_WEAPON_MAX         = 0.50;

// Weighted picker for non-weapon chest loot
function pickWeighted(weights){
  let total = 0;
  for (const k in weights) total += Math.max(0, weights[k]|0);
  if (total <= 0) return Object.keys(weights)[0] || 'potion';
  let r = Math.random() * total;
  for (const k in weights){
    r -= Math.max(0, weights[k]|0);
    if (r <= 0) return k;
  }
  return Object.keys(weights)[0] || 'potion';
}

// Base weights for non-weapon chest items (relative, not %)
const NON_WEAPON_BASE = {
  potion: 20,    // Reduced (was 34)
  tonic: 15,     // Reduced (was 24)
  antidote: 18,
  arrows: 16,
  lockpicks: 8,
  shield: 12,
  bomb: 6,       // NEW: Rare offensive drop
  warp: 4        // NEW: Very rare utility drop
};

// Depth scaling: fewer basic heals deeper; more MP/spells deeper
function scaleNonWeaponWeights(base){
  const f = state.floor | 0;
  const w = { ...base };
  w.potion = Math.max(10, w.potion - Math.floor(f * 2));
  w.tonic  = w.tonic  + Math.floor(f * 2);
  w.spell  = w.spell  + Math.floor(f * 2);
  return w;
}


function openChest(x,y){
  const k = `${x},${y}`;

  // --- NEW: Red Chest Event ---
  const rc = state.redChests?.get(k);
  if (rc) {
    if (rc.active) { log("The chest is sealed by bloodlust! Defeat the waves!"); return; }
    if (!rc.cleared) {
        // Start Event
        rc.active = true; rc.wave = 1; rc.killsReq = 3; rc.tempWalls = new Set();
        state.redChestEvent = rc; 
        
        const r = rc.room;

        // NEW: Instantly kill any existing enemies inside the room
        for (let i = state.enemies.length - 1; i >= 0; i--) {
            const e = state.enemies[i];
            if (e.x > r.x && e.x < r.x + r.w && e.y > r.y && e.y < r.y + r.h) {
                state.enemies.splice(i, 1);
                spawnParticles(e.x, e.y, '#555', 8);
            }
        }
        
        // Lock Exits: Turn perimeter open tiles into WALLS (0)
        for(let py=r.y; py<r.y+r.h; py++) for(let px=r.x; px<r.x+r.w; px++) {
            if (px===r.x || px===r.x+r.w-1 || py===r.y || py===r.y+r.h-1) {
                if (state.tiles[py][px]===1 || state.tiles[py][px]===2) {
                    state.tiles[py][px] = 0; // Wall
                    rc.tempWalls.add(`${px},${py}`); 
                    spawnParticles(px, py, '#555', 4); 
                }
            }
        }
        
        // Visuals & Spawn
        const cvs = document.getElementById('view');
        if(cvs) { cvs.style.filter = "grayscale(1) contrast(1.2) brightness(0.8)"; setTimeout(()=>cvs.style.filter="none", 600); }
        showBanner("AMBUSH! SURVIVE 3 WAVES!", 4000);
        spawnRedChestWave(3, r, false); 
        return;
    }
    // Reward for clearing
    state.inventory.gold += 250;
    state.inventory.potions += 3;
    state.inventory.tonics = (state.inventory.tonics||0) + 3;
    state.inventory.antidotes = (state.inventory.antidotes||0) + 3;
    state.inventory.bombs = (state.inventory.bombs||0) + 3;
    log("The seal breaks! Found 250 Gold, 3 Potions, 3 Tonics, 3 Antidotes, 3 Bombs.");
    
    // Remove Chest from Map
    state.tiles[y][x] = 1; // Turn chest (3) into floor (1)
    SFX.openChest();
    state.redChests.delete(k); // Clear from registry
    spawnParticles(x, y, '#facc15', 10);
    
    return; 
  }

  // --- Mimic trap remains the same ---
  if (state.mimicChests && state.mimicChests.has(k)) {
    state.mimicChests.delete(k);
    state.tiles[y][x] = 1;     // chest disappears
    SFX.openChest();
    SFX.attack?.();            // bite sound
    const m = {
      type: 'Mimic',
      x, y,
      hp: 12,
      atk: [2,4],
      xp: 8,
      awake: true,
      fast: false
    };
    state.enemies.push(m);
    log('The chest snaps open—it\'s a Mimic!');
    enemyStep(); draw(); updateBars?.();
    return;
  }

  // Normal chest
  state.tiles[y][x] = 1;
  SFX.openChest();
  
// --- TUTORIAL OVERRIDE (Step 13 -> Finish) ---
  if (state.gameMode === 'tutorial') {
    if (state.tutorialStep === 13) {
       // Show the custom modal instead of alert()
       const m = document.getElementById('tutorialCompleteModal');
       if (m) {
         m.style.display = 'flex';
         // Ensure button works
         const btn = document.getElementById('btnTutReturn');
         if(btn) btn.onclick = () => {
            m.style.display = 'none';
            goMenu();
         };
       } else {
         // Fallback just in case
         goMenu();
       }
    }
    return; 
  }

  const lootMsg = [];

  const kxy = x + ',' + y;
  const isStarterChest = (state._starterChest === kxy);

  // --- Weapon roll (starter always, others scaled by depth) ---
  const f = state.floor | 0;
  let weaponChance = Math.min(
    CHEST_WEAPON_MAX, 
    CHEST_WEAPON_BASE + CHEST_WEAPON_FLOOR_BONUS * Math.max(0, f - 1)
  );

  // --- NEW: Cursed Idol Chance (10%) ---
    if (!isStarterChest && state.gameMode === 'endless' && Math.random() < 0.10) {
      // Expanded Pool
      const iPool = ['Idol of War', 'Idol of Stone', 'Idol of Greed', 'Idol of Rot'];
      const pick = iPool[Math.floor(Math.random() * iPool.length)];
      
      // AUTO-ADD directly to inventory instead of dropping on floor
      state.inventory.idols = state.inventory.idols || {};
      state.inventory.idols[pick] = (state.inventory.idols[pick]||0) + 1;
      unlockCodex(pick, true);
      
      // Show RED banner immediately (and don't push to lootMsg)
      showBanner(`${pick} (Cursed object added!)`, 4000, '#ef4444');
    } else if (isStarterChest || Math.random() < weaponChance){
    const w = randomWeapon();
    
    // --- NEW: Check Inventory Limit ---
    // Ensure helper functions exist (defined at bottom of script)
    const wType = (typeof getWeaponType === 'function') ? getWeaponType(w.name) : 'hand';
    const curCount = (typeof countWeaponsInCategory === 'function') ? countWeaponsInCategory(wType) : 0;
    const limit = (typeof MAX_WEAPON_CAT !== 'undefined') ? MAX_WEAPON_CAT : 5;

    if (curCount >= limit) {
       // Bag Full: Drop weapon on floor & trigger Swap
       const k = key(x,y);
       state.pickups[k] = { kind:'weapon', payload:w };
       state.tiles[y][x] = 5; // Change tile from Floor(1) to Pickup(5)
       
       lootMsg.push(`${w.name} (Dropped - Bag Full)`);
       
       // Trigger the UI after a brief delay so the chest log usually finishes processing
       setTimeout(() => {
          if(typeof openWeaponSwapModal === 'function') openWeaponSwapModal(w, k, x, y);
       }, 50);
    } else {
       // Normal Add
       state.inventory.weapons[w.name] = (state.inventory.weapons[w.name] || 0) + 1;
          lootMsg.push(`${w.name} (now x${state.inventory.weapons[w.name]})`);

          // --- NEW: Codex Unlock (Chest Weapons) ---
          // 1. Strip affixes (Sharp, Cursed Blood, etc) to get base name
          const clean = w.name.replace(/Cursed |Blood |Greed |Rust |Frailty |Sharp |Heavy |Vampiric |Ancient /g, '');
          // 2. Generate Key
          let cKey = 'Wep_' + clean.replace(/ /g,''); 
          if(clean === 'Knuckle Duster') cKey = 'Wep_Knuckles';
          if(clean === 'Key of Destiny') cKey = 'Wep_Key';
          if(clean.includes('Staff'))    cKey = 'Wep_Staff';
          unlockCodex(cKey, true);
          // -----------------------------------------
        }
    // ----------------------------------
  }

  // --- Starter chest keeps your guaranteed pack ---
  if (isStarterChest){
    state.inventory.potions   += 5;
    state.inventory.tonics    += 5;
    state.inventory.antidotes += 5;
    state.inventory.lockpicks += 5;
    lootMsg.push(`+5 potions`, `+5 tonics`, `+5 antidotes`, `+5 lockpicks`);
  } else {
    // --- Non-starter chest: lockpicks + one weighted non-weapon pick ---
    const lp = rand(1,3);
    state.inventory.lockpicks += lp;
    lootMsg.push(`+${lp} lockpicks`);

    // Build weights with depth & context
    let w = scaleNonWeaponWeights(NON_WEAPON_BASE);

    // Pity boosts if you're in trouble and have none
    const hpLow = (state.player.hp / state.player.hpMax) <= 0.35;
    const mpLow = (state.player.mp / state.player.mpMax) <= 0.35;
    if ((state.inventory.potions|0) === 0 && hpLow)  w.potion += 40;
    if ((state.inventory.tonics|0)  === 0 && mpLow)  w.tonic  += 40;

    // Early game: don't flood arrows if player isn't really using bow yet
    if (!state.skills || !state.skills.bow) w.arrows = Math.floor(w.arrows * 0.3);

    // Make a single, clean pick
    const pick = pickWeighted(w);
    switch (pick){
      case 'potion':
        state.inventory.potions++;
        lootMsg.push('+1 potion');
        break;

      case 'tonic':
        state.inventory.tonics++;
        lootMsg.push('+1 tonic');
        break;

      case 'antidote':
        state.inventory.antidotes++;
        lootMsg.push('+1 antidote');
        break;

      case 'bomb':
        state.inventory.bombs = (state.inventory.bombs||0) + 1;
        lootMsg.push('+1 Bomb');
        break;
      case 'warp':
        state.inventory.warpStones = (state.inventory.warpStones||0) + 1;
        lootMsg.push('+1 Warp Stone');
        break;

      case 'arrows': {
        const n = rand(3,8);
        state.inventory.arrows = (state.inventory.arrows || 0) + n;
        lootMsg.push(`+${n} arrows`);
        break;
      }
      
      case 'shield': {
        // Pick a random specific shield type
        const types = ['Buckler', 'Kite Shield', 'Tower Shield', 'Ancient Shield'];
        const name = types[Math.floor(Math.random() * types.length)];

        // Add to named inventory (not generic counter)
        state.inventory.weapons[name] = (state.inventory.weapons[name] || 0) + 1;
        lootMsg.push(`+1 ${name}`);

        // --- NEW: Codex Unlock (Chest Shields) ---
        let sKey = 'Shld_' + name.replace(' Shield','').replace(/ /g,''); 
        if(name === 'Buckler') sKey = 'Shld_Buckler';
        unlockCodex(sKey, true);
        // -----------------------------------------

        // Auto-equip if allowed
        if (!state.player.shield && isShieldAllowed()) {
          equipShield(name);              
        } else {
          updateEquipUI?.();          
        }
        break;
      }

      case 'spell': {
        const sp   = randomSpell();
        const name = sp.name;

        const have = state.spells.find(s => s.name === name);
        if (!have){
          state.spells.push(sp);
          if (typeof ensureSpellUpgradeSlot === 'function') ensureSpellUpgradeSlot(name);
          if (!state.equippedSpell) state.equippedSpell = sp;
          lootMsg.push(`spell: ${name} Lv${sp.tier}`);
        } else if (sp.tier > (have.tier || 1)) {
          have.tier = sp.tier;
          lootMsg.push(`${name} upgraded to Lv${have.tier} (replaces previous)`);
        } else {
          ensureSkill('magic');
          const mg   = state.skills.magic;
          const gain = MAGIC_SCROLL_XP;

          mg.xp += gain;
          if (!mg.shown) mg.shown = true;

          let leveled = false;
          while (mg.xp >= mg.next){
            mg.xp   -= mg.next;
            mg.lvl  += 1;
            mg.next  = Math.floor(mg.next * SKILL_XP_GROWTH);
            leveled  = true;
          }

          if (leveled){
            lootMsg.push(`extra ${name} scroll (+${gain} Magic XP, Magic ${mg.lvl})`);
          } else {
            lootMsg.push(`extra ${name} scroll (+${gain} Magic XP)`);
          }

          if (typeof renderSkills === 'function') renderSkills();
        }
        break;
      }

      default:
        state.inventory.potions++;
        lootMsg.push('+1 potion');
        break;
    }
  }

  if (isStarterChest) delete state._starterChest;

  // Perk: Treasure Hunter (Bonus Gold in chests)
  if (state.skills?.lockpicking?.perks?.['loc_a1']) {
      const extraGold = rand(5, 15) * state.skills.lockpicking.perks['loc_a1'];
      state.inventory.gold += extraGold;
      lootMsg.push(`+${extraGold}g`);
      spawnFloatText(`+${extraGold}g`, x, y, '#facc15');
  }

  log('Opened chest: ' + lootMsg.join(', ') + '.');
  updateInvBody();
  enemyStep();   // advance time on open
  draw();
}





function equipWeaponByName(name){
  // --- NEW: Redirect Shields to off-hand ---
  const st = weaponStatsFor(name);
  if (st && st.type === 'shield') {
      equipShield(name);
      return;
  }
  // ----------------------------------------

  // No-op if already equipped
  if (state.player.weapon?.name === name) return;
  // --- FIX: Prevent swapping IF current weapon is Cursed ---
  if (state.player.weapon?.cursed) {
    log("The cursed weapon binds to your hand. You cannot switch.");
    return; 
  }

  // Ensure stash exists
  if (!state.inventory.stashed) state.inventory.stashed = {};

  // 1) Preserve the CURRENTLY EQUIPPED weapon (if it has durability and isn't Fists)
  const cur = state.player.weapon;
  if (cur && cur.name !== 'Fists' && Number.isFinite(cur.durMax) && cur.dur > 0){
    (state.inventory.stashed[cur.name] ||= []).push({ ...cur, base: { ...cur.base } });
  }

  // 2) Equip requested weapon — prefer a stashed copy to keep its durability
  const spareCount = state.inventory.weapons[name] || 0;
  const stashArr   = state.inventory.stashed[name] || [];
  const stashedCnt = stashArr.length;

  // Block if you truly have none
  if (name !== 'Fists' && spareCount <= 0 && stashedCnt <= 0){
    log(`You don't have any ${name}s left.`);
    return;
  }

// --- TUTORIAL Step 4 -> 5 (Equip Warhammer) ---
    if (state.gameMode === 'tutorial' && state.tutorialStep === 4 && name === 'Warhammer') {
      state.tutorialStep = 5;
      state.player.stamina = 20; // Refill stamina for Art (updated for new max stats)
      hideBanner();
      showBanner(`Step 5: Weapon Arts: Walk to the 3 rats and press (${getInputName('art')}).`, 999999);
    }

  if (name !== 'Fists' && stashedCnt > 0){
  const w = stashArr.pop();

  // NEW: if this weapon can't use a shield, auto-unequip it
  if (state.player.shield && !isShieldAllowedFor(w.type)){
    unequipShield();
    log('You put away your shield to wield the ' + name + '.');
    updateEquipUI?.();
  }

  state.player.weapon = { ...w, base: { ...w.base } };
  ensureSkill(state.player.weapon.type);
  recomputeWeapon();
  updateEquipUI();
  return;
}

  // 3) Otherwise build a fresh copy (full durability)
  // --- FIX: Parse Affixes so we can look up base stats ---
  let baseName = name;
  let bonMin=0, bonMax=0, isVamp=false;
  
  if (name.includes('Sharp '))       { baseName = baseName.replace('Sharp ', '');   bonMin+=1; bonMax+=1; }
  else if (name.includes('Heavy '))  { baseName = baseName.replace('Heavy ', '');   bonMax+=3; }
  else if (name.includes('Vampiric ')){ baseName = baseName.replace('Vampiric ', ''); isVamp = true; } // <--- Added isVamp = true
  // Fix: Check that it isn't the specific item "Ancient Shield" before stripping
  else if (name.includes('Ancient ') && name !== 'Ancient Shield') { baseName = baseName.replace('Ancient ', '');  bonMin+=2; bonMax+=2; }
  
  // Strip Curse info to find base stats
  if (name.includes('Cursed ')) {
     baseName = baseName.replace('Cursed ', '');
     baseName = baseName.replace('Blood ', '').replace('Greed ', '').replace('Rust ', '').replace('Frailty ', '');
  }

// --- FIX: Use global stats lookup instead of hardcoded list ---
  const template = weaponStatsFor(baseName); 
  
  // Format it as [min, max, type] to match old logic, or null
  const stats = template ? [template.min, template.max, template.type] : null;

  if(!stats) {
      console.warn("Could not find stats for:", baseName); 
      return; 
  }

  // NEW: if this weapon can't use a shield, auto-unequip it
if (state.player.shield && !isShieldAllowedFor(stats[2])){
  unequipShield();
  log('You put away your shield to wield the ' + name + '.');
  updateEquipUI?.();
}
  // Lookup durability using the BASE name (e.g. "Shortsword")
  const durMax = defaultDurabilityFor(baseName);
  
  // --- NEW: Preserve Cursed properties when rebuilding fresh weapon ---
  const isCursed = name.includes('Cursed ');
  const nameLower = name.toLowerCase();
  const cType = isCursed ? (nameLower.includes('blood') ? 'blood' : (nameLower.includes('greed') ? 'greed' : (nameLower.includes('frailty') ? 'frailty' : 'rust'))) : null; 

  state.player.weapon = {
    name, // Keep full name "Cursed Shortsword"
    min: stats[0] + bonMin, 
    max: stats[1] + bonMax, 
    type: stats[2],
    base: { min: stats[0] + bonMin, max: stats[1] + bonMax },
    dur: durMax, 
    durMax,
    vampiric: isVamp,
    cursed: isCursed, // <--- CRITICAL FIX
    curseType: cType,  // <--- CRITICAL FIX
  };
  ensureSkill(stats[2]);
  recomputeWeapon();
  updateEquipUI();

  // New: Cursed Banner Notification
  if (state.player.weapon.cursed) {
    let msg = "You are Cursed.";
    if (state.player.weapon.curseType === 'blood') msg = "Blood Curse: The weapon drains your HP.";
    else if (state.player.weapon.curseType === 'greed') msg = "Greed Curse: The weapon consumes Gold.";
    else if (state.player.weapon.curseType === 'frailty') msg = "Frailty Curse: You take extra damage.";
    else if (state.player.weapon.curseType === 'rust') msg = "Rust Curse: Durability degrades rapidly.";
    
    showBanner(msg, 4000);
    SFX.descend(); // Ominous sound
  }
}

  // Tutorial: after equipping the Shortsword
  if (state.gameMode === 'tutorial' &&
      state.tutorialStep === 2 &&
      name === 'Shortsword') {
    state.tutorialStep = 3;
    say(`Weapon equipped. Now move next to a rat and press ${getInputName('attack')} to attack it. Be careful this consumes stamina`);
  }


function isShieldAllowedFor(t){
  // Titan's Grip (sur_c2) allows shields with two-handed weapons
  if (state.skills?.survivability?.perks?.['sur_c2'] && t === 'two') return true;

  // STRICT: Only 'one' (One-Handed) and 'hand' (Fists/Claws) can use shields.
  // !t implies no weapon equipped (Fists), which is also allowed.
  return t === 'one' || t === 'hand' || !t;
}
function isShieldAllowed(){
  const t = state.player?.weapon?.type;
  return isShieldAllowedFor(t);
}




function equipShield(){
  if (!isShieldAllowed()){ log('A shield can only be used with one-handed swords.'); return; }
  if (state.player.shield){ log('Already have a shield equipped.'); return; }
  const have = state.inventory.shields|0;
  if (have <= 0){ log('You have no spare shields.'); return; }
  state.inventory.shields = have - 1;
  state.player.shield = { name: SHIELD_NAME, dur: SHIELD_DUR };
  log('Equipped a shield.');
  updateInvBody?.(); updateEquipUI?.(); draw?.();
}
function unequipShield(){
  const sh = state.player.shield; 
  if (!sh) return;

  const name = state.player.shieldName || 'Standard';

  // Return to correct inventory slot
  if (name === 'Standard') {
    state.inventory.shields = (state.inventory.shields|0) + 1;
  } else {
    state.inventory.weapons[name] = (state.inventory.weapons[name] || 0) + 1;
  }

  state.player.shield = null;
  state.player.shieldName = null;
  
  log('Unequipped ' + name + '.');
  updateInvBody?.(); updateEquipUI?.(); draw?.();
}




function breakEquippedWeaponIfNeeded(){
  const w = state.player.weapon;
  if(!Number.isFinite(w?.durMax)) return;
  if(w.dur>0) return;

  if(state.inventory.weapons[w.name] > 0){
    state.inventory.weapons[w.name] -= 1;
    // NEW: purge zero-count entry so it won’t show x0 or be equippable
    if (state.inventory.weapons[w.name] <= 0){
      delete state.inventory.weapons[w.name];
    }
  }
    SFX.weaponBreak();
  log(`${w.name} breaks!`);
  state.player.weapon = {name:'Fists',min:1,max:2,type:'hand',base:{min:1,max:2},dur:null,durMax:null};
  recomputeWeapon();
  updateEquipUI();
  updateInvBody();
}


function handleSuccessfulHitDurabilityTick(){
  const w = state.player.weapon;
  state._hitParity = (state._hitParity + 1);
  
  // Rust Curse: degrades every hit. Normal: degrades every 2nd hit.
  const degrade = (w.curseType === 'rust') || (state._hitParity % 2 === 0);

  if(Number.isFinite(w?.durMax) && degrade){
    w.dur = Math.max(0, (w.dur ?? w.durMax) - 1);
    updateEquipUI();
    if(w.dur===0) breakEquippedWeaponIfNeeded();
  }
}

function shootBow(){
  if (state.gameOver) return;
  if (state._inputLocked || state._descending) return;
  
  state.player._consecutiveSteps = 0; // Reset movement tracker
  
  if (state.player.stamina < 1) { spawnFloatText("No Stamina", state.player.x, state.player.y, '#9ca3af'); return; }
  if (!state.player?.bow?.loaded){ log('No arrow loaded.'); return; }

  state.player.stamina--; 
  state._skipStaminaRegen = true; 
  updateBars();

  const bowLvl = (state.skills?.bow?.lvl || 1);
  const baseRange = state.player.bow?.range ?? 5;
  let range = baseRange + Math.floor(Math.max(0, bowLvl - 1) / 3);

  // NEW: Tension (bow_a1) - +1 Range per level
  if (state.skills?.bow?.perks?.['bow_a1']) range += state.skills.bow.perks['bow_a1'];

  const dirs = {up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
  const [dx,dy] = dirs[state.player.facing] || [0,0];
  if (!dx && !dy){ log('You fumble with the bow.'); return; }

  // NEW: Fletching (bow_a2) & Endless Quiver (bow_c7)
  let keepArrow = false;
  let fletchChance = 0;
  if (state.skills?.bow?.perks?.['bow_a2']) fletchChance = 0.05 * state.skills.bow.perks['bow_a2'];
  if (state.skills?.bow?.perks?.['bow_c7']) fletchChance = 0.50;
  
  if (Math.random() < fletchChance) {
      spawnFloatText("Arrow Saved", state.player.x, state.player.y, '#9ca3af');
  } else {
      state.player.bow.loaded = 0;
  }
  
  updateEquipUI();
  SFX.bowShot();

  // --- NEW: Signal Shadow to copy ---
  state.lastPlayerAction = { type: 'bow' };
  // ---------------------------------

  // NEW: Bodkin (bow_b2) - Pierce 1 enemy
  let pierceAllowed = state.skills?.bow?.perks?.['bow_b2'] ? 1 : 0;
  let enemiesPierced = 0;
  let hitAnything = false;
  let missX = state.player.x;
  let missY = state.player.y;

  for (let r=1; r<=range; r++){
    const x = state.player.x + dx*r;
    const y = state.player.y + dy*r;
    if (!inBounds(x,y)) break;
    const t = state.tiles[y][x];
    if (t===0 || t===2) break;                 
    missX = x; 
    missY = y;

    const e = enemyAt(x,y);
    if (e){
      hitAnything = true;
      ensureSkill('bow');
      
      if (!rollHitFor('bow')){
        spawnFloatText("Miss", e.x, e.y, '#9ca3af');
        SFX.miss();
        log(`Your arrow misses the ${e.type}.`);
      } else {
          const bonus = skillDamageBonus('bow');
          let dmg = (window._instaKill) ? 99999 : rand(3+bonus, 6+bonus);
          
          if (state.skills?.bow?.perks?.['bow_c2'] && r === range) {
              dmg *= 2;
              spawnFloatText("ASSASSIN", e.x, e.y, '#ef4444');
          }

          if (enemiesPierced > 0 && !state.skills?.bow?.perks?.['bow_c3']) {
              dmg = Math.max(1, Math.floor(dmg / 2));
          }

          let isCrit = false;
          if (state.skills?.bow?.perks?.['bow_b1'] && Math.random() < (0.10 * state.skills.bow.perks['bow_b1'])) {
              dmg *= 2;
              isCrit = true;
              if (state.skills.bow.perks['bow_c1'] && !e.boss) {
                  dmg = 99999;
                  spawnFloatText("HEADSHOT", e.x, e.y, '#ef4444');
              }
          }
          
          if (enemiesPierced > 0 && state.skills?.bow?.perks?.['bow_c4']) {
              applyStun(e, 3);
              spawnFloatText("PINNED", e.x, e.y, '#9ca3af');
          }

          SFX.rangedZap();                      
          e.hp -= dmg;
          
          spawnFloatText(dmg + (isCrit ? "!" : ""), e.x, e.y, isCrit ? '#ff0' : '#fff');
          if (typeof flashEnemy === 'function') flashEnemy(e, 'red'); 
          log(`You shoot an arrow for ${dmg}.`);

          if (state.skills?.bow?.perks?.['bow_c8']) {
              const expDmg = Math.floor(dmg / 2);
              spawnParticles(e.x, e.y, '#f97316', 6);
              state.enemies.forEach(en => {
                  if (en !== e && Math.abs(en.x - e.x) <= 1 && Math.abs(en.y - e.y) <= 1) {
                      en.hp -= expDmg;
                      spawnFloatText(expDmg, en.x, en.y, '#f97316');
                      if (en.hp <= 0) handleEnemyDeath(en, 'bow');
                  }
              });
          }

          // --- TUTORIAL OVERRIDE ---
          if (state.gameMode === 'tutorial' && state.tutorialStep === 8 && e.type === 'Rat') {
             if (e.hp <= 0) {
                state.tutorialStep = 9;
                state.pickups['10,35'] = {kind:'spell', payload:{name:'Spark', cost:1, tier:1}};
                state.tiles[35][10]=5;
                state.enemies.push({x:10, y:38, type:'Rat', hp:1, atk:[0,0], xp:0, stunTicks:9999, tutorialDummy:true});
                hideBanner();
                showBanner(`Step 9: Pickup Scroll. Press (${getInputName('spell_menu')}) to open your spell book. Press (${getInputName('cycle_spell')}) to swap between spells. Cast Magic with (${getInputName('cast')}) on the Rat.`, 999999);
             }
          }
          // -------------------------

          if (e.hp <= 0) handleEnemyDeath(e, 'bow');
      }

      enemiesPierced++;
      
      if (enemiesPierced > pierceAllowed) {
          const onDone = ()=>{ 
            let extraArrows = 0;
            if (state.skills?.bow?.perks?.['bow_b3']) extraArrows = state.skills.bow.perks['bow_b3'];
            if (state.skills?.bow?.perks?.['bow_c5']) extraArrows *= 2; 
            
            if (extraArrows > 0) {
               // Limit to enemies within reasonable bow range
               const targets = state.enemies.filter(en => en.hp > 0 && en !== e && state.seen.has(key(en.x, en.y)) && (Math.abs(en.x - state.player.x) + Math.abs(en.y - state.player.y)) <= range + 2);
               if (targets.length > 0) {
                   const shuffledTargets = shuffle([...targets]).slice(0, extraArrows);
                   shuffledTargets.forEach(extraTarget => {
                       const splashDmg = Math.max(1, Math.floor(rand(3+skillDamageBonus('bow'), 6+skillDamageBonus('bow'))));
                       extraTarget.hp -= splashDmg;
                       spawnFloatText(splashDmg, extraTarget.x, extraTarget.y, '#fff');
                       if (extraTarget.hp <= 0) handleEnemyDeath(extraTarget, 'bow');
                       spawnProjectileEffect({
                           kind: 'arrow', fromX: state.player.x, fromY: state.player.y, toX: extraTarget.x, toY: extraTarget.y
                       });
                   });
               }
            }
            enemyStep(); draw(); 
          };
          spawnProjectileEffect({ kind: 'arrow', fromX: state.player.x, fromY: state.player.y, toX: e.x, toY: e.y, dx, dy, onDone });
          return;
      } else {
          spawnProjectileEffect({ kind: 'arrow', fromX: state.player.x, fromY: state.player.y, toX: e.x, toY: e.y, dx, dy });
      }
    }
  }

  if (!hitAnything) {
      log('You loose an arrow into the hall.');
      
      const onMissDone = () => {
          if (state.skills?.bow?.perks?.['bow_c6']) {
              // Limit Seeker to targets within range + 2
              const targets = state.enemies.filter(en => en.hp > 0 && state.seen.has(key(en.x, en.y)) && (Math.abs(en.x - state.player.x) + Math.abs(en.y - state.player.y)) <= range + 2);
              if (targets.length > 0) {
                  // Sort to find the ACTUAL nearest target to the miss location
                  targets.sort((a,b) => (Math.abs(a.x - missX) + Math.abs(a.y - missY)) - (Math.abs(b.x - missX) + Math.abs(b.y - missY)));
                  const extraTarget = targets[0];
                  const splashDmg = Math.max(1, Math.floor(rand(3+skillDamageBonus('bow'), 6+skillDamageBonus('bow'))));
                  extraTarget.hp -= splashDmg;
                  spawnFloatText(splashDmg + " (Seeker)", extraTarget.x, extraTarget.y, '#c084fc');
                  if (extraTarget.hp <= 0) handleEnemyDeath(extraTarget, 'bow');
                  
                  // Seeker actually bounces from the wall/miss location!
                  spawnProjectileEffect({ kind: 'arrow', fromX: missX, fromY: missY, toX: extraTarget.x, toY: extraTarget.y, onDone: () => { enemyStep(); draw(); } });
                  return; // Don't step yet, wait for the seeker to land
              }
          } else {
              let extraArrows = 0;
              if (state.skills?.bow?.perks?.['bow_b3']) extraArrows = state.skills.bow.perks['bow_b3'];
              if (state.skills?.bow?.perks?.['bow_c5']) extraArrows *= 2; 
              
              if (extraArrows > 0 && enemiesPierced <= pierceAllowed) {
                 const targets = state.enemies.filter(en => en.hp > 0 && state.seen.has(key(en.x, en.y)) && (Math.abs(en.x - state.player.x) + Math.abs(en.y - state.player.y)) <= range + 2);
                 if (targets.length > 0) {
                     const shuffledTargets = shuffle([...targets]).slice(0, extraArrows);
                     shuffledTargets.forEach(extraTarget => {
                         const splashDmg = Math.max(1, Math.floor(rand(3+skillDamageBonus('bow'), 6+skillDamageBonus('bow'))));
                         extraTarget.hp -= splashDmg;
                         spawnFloatText(splashDmg, extraTarget.x, extraTarget.y, '#fff');
                         if (extraTarget.hp <= 0) handleEnemyDeath(extraTarget, 'bow');
                         spawnProjectileEffect({ kind: 'arrow', fromX: state.player.x, fromY: state.player.y, toX: extraTarget.x, toY: extraTarget.y });
                     });
                 }
              }
          }
          enemyStep(); draw();
      };
      
      // Animate the primary missed arrow hitting the wall first
      if (missX !== state.player.x || missY !== state.player.y) {
          spawnProjectileEffect({ kind: 'arrow', fromX: state.player.x, fromY: state.player.y, toX: missX, toY: missY, dx, dy, onDone: onMissDone });
      } else {
          onMissDone();
      }
      return; // Exit early since onMissDone handles enemyStep
  }
  
  // enemyStep handled in onDone for hits/pierces
}



function attack(){
    if (state.gameOver) return;
    if (state._inputLocked || state._descending) return;
    
    state.player._consecutiveSteps = 0; // Reset movement tracker

    // 1. Identify Neighbors & Targets FIRST
    const nbs = neighbors4(state.player.x,state.player.y);
    let target=null, ti=-1;
    for(let i=0;i<state.enemies.length;i++){
      const e=state.enemies[i]; const s=e.size||1;
      if(nbs.some(nb=> nb.x>=e.x && nb.x<e.x+s && nb.y>=e.y && nb.y<e.y+s)){ target=e; ti=i; break; }
    }

    // 2. Identify Props (if no enemy target)
    let propPos = null;
    if (!target) {
      for(const nb of nbs){
        if(inBounds(nb.x, nb.y) && state.tiles[nb.y][nb.x] === 8){
          propPos = nb; break;
        }
      }
    }

    // --- STAFF LOGIC REORDERED ---
    const isStaff = state.player.weapon && state.player.weapon.type === 'staff';
    
    // Use Staff Magic IF: We have an enemy OR (We have no enemy AND no prop to smash)
    // If we HAVE a prop and NO enemy, this skips, allowing us to smash the prop below.
    if (isStaff && (target || !propPos)) {
        useStaff(state.player.weapon); 
        return;
    }
    // -----------------------------

    // New: Stamina Cost for Normal Attack (Melee / Smash)
    const cost = getStaminaCost(1);
    if (state.player.stamina < cost) { 
       spawnFloatText("Resting...", state.player.x, state.player.y, '#9ca3af'); 
       log("You are out of breath and take a moment to recover.");
       enemyStep(); 
       draw();
       return; 
    }
    state.player.stamina -= cost; 
    state._skipStaminaRegen = true; 
    updateBars();

    // Tutorial Step 5 check
    if (state.gameMode === 'tutorial' && state._tutBowShot && !state._tutGotWeapon){
      showBanner("Tutorial: Step onto the Shortsword to pick it up first.", 2200);
      return;
    }

    // Execute Melee / Smash
    if(!target){ 
      if(propPos){
        handlePropSmash(propPos.x, propPos.y);
        return; 
      }
      log('No enemy adjacent.'); return; 
    }
    const w = state.player.weapon;
    
    // Reaper Invincibility
    if (target.type === 'Reaper') {
      log("Your weapon passes harmlessly through the spectre!");
      SFX.miss();
      return;
    }

    // --- NEW: Giant Slayer (two_c5) Cannot Miss ---
    let cannotMiss = false;
    if (w.type === 'two' && state.skills?.two?.perks?.['two_c5'] && (target.boss || target.elite || target.miniBoss)) cannotMiss = true;

    if (!cannotMiss && !rollHitFor(w.type)){
        spawnFloatText("Miss", target.x, target.y, '#9ca3af'); 
        log(`You miss the ${target.type}.`); SFX.miss(); 
        state.player._consecutiveHits = 0; // Reset consecutive hits
        enemyStep(); draw(); return;
    }

    SFX.swingFor(w.type);
    
    // base swing (Check Insta Kill Debug)
    let dmg = (window._instaKill) ? 99999 : rand(w.min, w.max);

    // --- NEW: Giant Slayer (two_c5) Roll Max Damage ---
    if (w.type === 'two' && state.skills?.two?.perks?.['two_c5'] && (target.boss || target.elite || target.miniBoss)) {
        dmg = (window._instaKill) ? 99999 : w.max;
    }

    // --- NEW PERKS: Pre-Damage Modifiers ---
    if (w.type === 'spear' && state.skills?.spear?.perks?.['spear_a1'] && target.hp === target.hpMax) {
        dmg += (2 * state.skills.spear.perks['spear_a1']); // First Strike
    }
    if (w.type === 'one' && state.player._momentumReady) {
        dmg *= 2; // Momentum
        state.player._momentumReady = false;
        spawnFloatText("MOMENTUM", state.player.x, state.player.y, '#facc15');
    }
    if (w.type === 'two' && state.skills?.two?.perks?.['two_c8'] && target.hp === target.hpMax) {
        dmg *= 2; // Decimate
    }
    if (w.type === 'two' && state.skills?.two?.perks?.['two_a2'] && (target.boss || target.elite || target.miniBoss)) {
        dmg = Math.floor(dmg * 1.5); // Sunder
        spawnFloatText("SUNDER!", target.x, target.y, '#facc15');
    }
    
    // --- NEW: Crush (two_b3) ---
    if (w.type === 'two' && state.skills?.two?.perks?.['two_b3'] && (target.boss || target.elite || target.miniBoss)) {
        dmg = Math.floor(dmg * (1 + (0.10 * state.skills.two.perks['two_b3'])));
    }

    if (w.type === 'axe' && state.skills?.axe?.perks?.['axe_b2']) {
        const missingPct = 1 - (state.player.hp / state.player.hpMax);
        const stacks = Math.floor(missingPct / 0.20);
        dmg += (stacks * state.skills.axe.perks['axe_b2']); // Berserker
    }
    if (w.type === 'axe' && state.skills?.axe?.perks?.['axe_b3'] && target.slowTicks > 0) {
        dmg += (2 * state.skills.axe.perks['axe_b3']); // Executioner's Mark
    }
    if (w.type === 'hand' && state.skills?.hand?.perks?.['hand_c2'] && target.stunTicks > 0) {
        dmg *= 2; // Nerve Strike
    }
    if (w.type === 'one' && state.skills?.one?.perks?.['one_c7'] && target.bleedTicks > 0) {
        dmg = Math.floor(dmg * 1.5); // Hemorrhage
    }
    if (w.type === 'one' && state.skills?.one?.perks?.['one_c6']) {
        target.id = target.id || Math.random().toString();
        if (state.player._lastTargetId === target.id) {
            state.player._consecutiveHits = (state.player._consecutiveHits || 0) + 1;
            dmg += (state.player._consecutiveHits * state.skills.one.perks['one_c6']); // Thousand Cuts
        } else {
            state.player._consecutiveHits = 1;
        }
        state.player._lastTargetId = target.id;
    } else {
        state.player._consecutiveHits = 0;
    }
    if (w.type === 'two' && state.player._ruthlessStacks > 0) {
        dmg += (2 * state.player._ruthlessStacks); // Ruthless buff from prior kill
        state.player._ruthlessStacks = 0; 
    }

    if (state.inventory.idols?.['Idol of War']) dmg = Math.ceil(dmg * 1.20);
    if (state.player.blessTicks > 0) dmg += 2; 

    if (isEffectActive('AntiMagic')) dmg = Math.ceil(dmg * 1.5); 
    if (isEffectActive('ArcaneFlux')) dmg = Math.max(1, Math.ceil(dmg * 0.25));

    let note = "";
    let isCrit = false;

    // --- NEW PERKS: Critical Hit Logic ---
    let critChance = quirkChance(w.type);
    if (w.type === 'axe' && state.skills?.axe?.perks?.['axe_a1']) critChance += (0.10 * state.skills.axe.perks['axe_a1']);

    let forceCrit = false;
    if (w.type === 'axe' && state.skills?.axe?.perks?.['axe_c3'] && (state.player.hp / state.player.hpMax) < 0.20) forceCrit = true; // Death Wish
    if (w.type === 'one' && state.player._phantomStrikeReady) { forceCrit = true; state.player._phantomStrikeReady = false; } // Phantom Strike
    if (w.type === 'spear' && state.player._dragoonReady) { forceCrit = true; state.player._dragoonReady = false; } // Dragoon

    if (forceCrit || Math.random() < critChance) {
        isCrit = true;
        note = " (CRITICAL!)";
        
        let critMult = 2;
        if (w.type === 'two' && state.skills?.two?.perks?.['two_c6']) critMult = 3; // Obliterate
        dmg *= critMult;

        if (w.type === 'two' && state.skills?.two?.perks?.['two_b2']) { // Stagger
            const pushX = target.x + Math.sign(target.x - state.player.x);
            const pushY = target.y + Math.sign(target.y - state.player.y);
            if (inBounds(pushX, pushY) && state.tiles[pushY][pushX] === 1 && !enemyAt(pushX, pushY)) {
                target.x = pushX; target.y = pushY;
                spawnFloatText("PUSHED", pushX, pushY, '#9ca3af');
                if (state.skills?.two?.perks?.['two_c3']) applyStun(target, 1); // Colossus
            } else if (state.skills?.two?.perks?.['two_c4']) {
                dmg *= 3; // Executioner (Crush against wall)
                spawnFloatText("CRUSHED!", target.x, target.y, '#ef4444');
            }
        }

        if (w.type === 'axe' && state.skills?.axe?.perks?.['axe_c5'] && target.slowTicks > 0 && !target.boss && !target.miniBoss && !target.elite) { // Decapitate
            dmg = 99999;
            spawnFloatText("DECAPITATED", target.x, target.y, '#ef4444');
        }

        if (w.type === 'hand' && state.skills?.hand?.perks?.['hand_b2']) { // Earthbreaker
            state.enemies.forEach(en => {
                if (en !== target && Math.abs(en.x - target.x) <= 1 && Math.abs(en.y - target.y) <= 1) {
                    const qDmg = Math.max(1, Math.floor(dmg / 2));
                    en.hp -= qDmg;
                    spawnFloatText(qDmg, en.x, en.y, '#facc15');
                    if (state.skills?.hand?.perks?.['hand_c3']) applyStun(en, 1); // Quake
                    if (en.hp <= 0) handleEnemyDeath(en, 'hand');
                }
            });
            log("Your critical strike shatters the earth!");
        }
        
        // --- NEW: Pressure Points (hand_c1) ---
        if (w.type === 'hand' && state.skills?.hand?.perks?.['hand_c1']) {
            if (typeof applySlow === 'function') applySlow(target, 3);
            target.atk[0] = Math.max(1, Math.floor(target.atk[0] / 2));
            target.atk[1] = Math.max(1, Math.floor(target.atk[1] / 2));
            spawnFloatText("WEAKENED", target.x, target.y, '#c084fc');
        }
    }

    let currentArmor = target.armor || 0;
    if (target.slowTicks > 0 && state.skills?.axe?.perks?.['axe_c6']) {
        if (currentArmor > 0) {
            log(`You SHATTERED the ${target.type}'s armor!`);
            spawnFloatText("SHATTERED", target.x, target.y, '#facc15'); 
        }
        currentArmor = 0;
        target.armor = 0;
    }
    let finalDmg = Math.max(1, dmg - currentArmor);

    target.hp -= finalDmg;
    if (typeof flashEnemy === 'function') flashEnemy(target, 'red'); 
    
    let dmgColor = (currentArmor > 0) ? '#94a3b8' : (isCrit ? '#ff0' : '#fff');
    spawnFloatText(finalDmg + (isCrit ? "!" : ""), target.x, target.y, dmgColor);
    if (finalDmg > 0) spawnParticles(target.x, target.y, '#ef4444', 6);
    
    if (w.vampiric && finalDmg > 0) {
      const heal = Math.max(1, Math.floor(finalDmg * 0.25));
      state.player.hp = Math.min(state.player.hp + heal, state.player.hpMax);
      spawnFloatText("+" + heal, state.player.x, state.player.y, '#0f0');
      updateBars();
    }
    
    log(`You hit the ${target.type} for ${finalDmg}.${note}`);

    // --- NEW PERKS: Post-Hit Effects ---
    if (w.type === 'one' && state.skills?.one?.perks?.['one_c8'] && target.bleedTicks > 0) { // Bloodthirst
        const heal = state.skills.one.perks['one_c8'];
        state.player.hp = Math.min(state.player.hp + heal, state.player.hpMax);
        spawnFloatText("+" + heal + " HP", state.player.x, state.player.y, '#4ade80');
        updateBars();
    }

    if (w.type === 'spear' && state.skills?.spear?.perks?.['spear_b2']) { // Keep Away
        const pushX = target.x + Math.sign(target.x - state.player.x);
        const pushY = target.y + Math.sign(target.y - state.player.y);
        if (inBounds(pushX, pushY) && state.tiles[pushY][pushX] === 1 && !enemyAt(pushX, pushY)) {
            target.x = pushX; target.y = pushY;
        } else if (state.skills?.spear?.perks?.['spear_c3']) { // Pinning Strike
            applyStun(target, 2);
            spawnFloatText("PINNED", target.x, target.y, '#facc15');
        }
    }

    if (w.type === 'hand' && state.skills?.hand?.perks?.['hand_c4'] && target.stunTicks > 0) { // Palm Strike
        const dx = Math.sign(target.x - state.player.x);
        const dy = Math.sign(target.y - state.player.y);
        for (let step=0; step<2; step++) {
            const nx = target.x + dx, ny = target.y + dy;
            if (inBounds(nx, ny) && state.tiles[ny][nx] === 1 && !enemyAt(nx, ny)) {
                target.x = nx; target.y = ny;
            } else break;
        }
    }

    if (w.type === 'two' && state.skills?.two?.perks?.['two_c1']) { // Shockwave
        const behindX = target.x + Math.sign(target.x - state.player.x);
        const behindY = target.y + Math.sign(target.y - state.player.y);
        const eBehind = enemyAt(behindX, behindY);
        if (eBehind) {
            const sDmg = Math.max(1, Math.floor(dmg / 2));
            eBehind.hp -= sDmg;
            spawnFloatText(sDmg, eBehind.x, eBehind.y, '#f97316');
            if (eBehind.hp <= 0) handleEnemyDeath(eBehind, 'two');
        }
    }

    if (w.type === 'spear' && state.skills?.spear?.perks?.['spear_b1']) { // Impale
        if (Math.random() < (0.15 * state.skills.spear.perks['spear_b1'])) {
            const dx = Math.sign(target.x - state.player.x);
            const dy = Math.sign(target.y - state.player.y);
            let currX = target.x, currY = target.y;
            
            while (true) {
                currX += dx; currY += dy;
                const pTarget = enemyAt(currX, currY);
                if (pTarget) {
                    pTarget.hp -= dmg;
                    spawnFloatText(dmg, pTarget.x, pTarget.y, '#fff');
                    flashEnemy(pTarget, 'red');
                    if (state.skills?.spear?.perks?.['spear_c2']) applyStun(pTarget, 1); // Skewer
                    if (pTarget.hp <= 0) handleEnemyDeath(pTarget, 'spear');
                }
                if (!state.skills?.spear?.perks?.['spear_c1']) break; // Gungnir goes infinite
                if (!inBounds(currX, currY) || state.tiles[currY][currX] !== 1) break; 
            }
        }
    }

    if (w.type === 'spear' && state.skills?.spear?.perks?.['spear_b4']) { // Sweeping Strike
        if (Math.random() < (0.20 * state.skills.spear.perks['spear_b4'])) {
            const diags = [[1,1], [1,-1], [-1,1], [-1,-1]];
            diags.forEach(([dx, dy]) => {
                const eDiag = enemyAt(target.x + dx, target.y + dy);
                if (eDiag && eDiag.hp > 0) {
                    eDiag.hp -= Math.floor(dmg / 2);
                    spawnFloatText(Math.floor(dmg / 2), eDiag.x, eDiag.y, '#f97316');
                    if (eDiag.hp <= 0) handleEnemyDeath(eDiag, 'spear');
                }
            });
        }
    }

    if (w.type === 'axe' && state.skills?.axe?.perks?.['axe_c6'] && target.slowTicks > 0) { // Shatter
        target.atk[0] = Math.max(0, target.atk[0] - 1);
        target.atk[1] = Math.max(1, target.atk[1] - 1);
        spawnFloatText("SHATTERED", target.x, target.y, '#9ca3af');
    }

    if (w.type === 'one' && target.hp > 0 && state.skills?.one?.perks?.['one_b3']) { // Relentless / Flurry
        let followUpChance = 0.10 * state.skills.one.perks['one_b3'];
        let hits = 0;
        let maxHits = state.skills?.one?.perks?.['one_c5'] ? 3 : 1;
        while (hits < maxHits && target.hp > 0 && Math.random() < followUpChance) {
            const d2 = rand(w.min, w.max);
            target.hp -= d2;
            spawnFloatText(d2, target.x, target.y, '#fff');
            log(`Follow-up strike hits for ${d2}.`);
            hits++;
        }
    }

    // --- TUTORIAL Step 6 (Melee + Poison) ---
    if (state.gameMode === 'tutorial' && state.tutorialStep === 6 && target.type === 'Rat') {
       if (!state.player.poisoned) {
          state.player.poisoned = true;
          state.player.poisonTicks = 20;
          state.player.hp = Math.max(1, state.player.hp - 5); 
          log("You are poisoned!");
          updateBars();
       }
       if (target.hp <= 0) {
          state.tutorialStep = 7;
          state.pickups['10,25'] = {kind:'antidote', payload:1};
          state.pickups['11,25'] = {kind:'potion', payload:1};
          state.tiles[25][10]=5; state.tiles[25][11]=5;
          hideBanner();
          showBanner(`Step 7: Pick up and USE the Antidote (${getInputName('antidote')}) and Potion (${getInputName('potion')}).`, 999999);
       }
    }

    if (dmg > 0) {
      const cvs = document.getElementById('view');
      if (cvs) {
        cvs.style.transform = `translate(${rand(-2,2)}px, ${rand(-2,2)}px)`;
        setTimeout(()=>{ cvs.style.transform = 'none'; }, 60); 
      }
    }

    if (w.type === 'hand' && state.skills?.hand?.perks?.['hand_b1'] && Math.random() < (0.05 * state.skills.hand.perks['hand_b1'])) {
        target.atk[0] = Math.max(0, target.atk[0] - 1);
        target.atk[1] = Math.max(1, target.atk[1] - 1);
        spawnFloatText("DISARMED", target.x, target.y, '#9ca3af');
    }

    if (w.type === 'axe' && proc(quirkChance('axe'))) { applySlow(target, SLOW_TICKS); log('You cripple the foe!'); }
    if (w.type === 'hand' && proc(quirkChance('hand'))) { applyStun(target, STUN_TICKS); log('Knockout! The foe is dazed!'); }
    if ((w.type === 'spear' && proc(quirkChance('spear'))) || 
        (w.type === 'one' && proc(quirkChance('one'))) ||
        (w.type === 'axe' && state.skills?.axe?.perks?.['axe_b4'] && Math.random() < (0.10 * state.skills.axe.perks['axe_b4']))) {
        applyBleed(target, BLEED_TICKS, BLEED_DMG); log('The foe is bleeding!');
        if (w.type === 'axe' && state.skills?.axe?.perks?.['axe_c7']) applySlow(target, SLOW_TICKS); // Agony
    }

    handleSuccessfulHitDurabilityTick();

    if (target.hp <= 0){
        const overkill = Math.abs(target.hp);
        
        if (w.type === 'axe' && state.skills?.axe?.perks?.['axe_c8'] && target.bleedTicks > 0) { // Carnage
            spawnParticles(target.x, target.y, '#ef4444', 12);
            const nbs = neighbors4(target.x, target.y);
            state.enemies.forEach(en => {
                if (en !== target && en.hp > 0 && nbs.some(n => n.x===en.x && n.y===en.y)) {
                    en.hp -= target.bleedDmg;
                    spawnFloatText(target.bleedDmg, en.x, en.y, '#ef4444');
                    if (en.hp <= 0) handleEnemyDeath(en, 'axe');
                }
            });
            log("The bleeding enemy explodes!");
        }

        handleEnemyDeath(target, state.player.weapon.type);

        if (w.type === 'two' && overkill > 0 && state.skills?.two?.perks?.['two_a1']) { // Follow-Through
            const nbs = neighbors4(target.x, target.y);
            const adj = state.enemies.find(en => en !== target && en.hp > 0 && nbs.some(n => n.x===en.x && n.y===en.y));
            if (adj) {
                let pDmg = overkill;
                if (!state.skills?.two?.perks?.['two_b1']) pDmg = Math.floor(overkill / 2); // Brutal Force ignores half penalty
                adj.hp -= pDmg;
                spawnFloatText(pDmg + " (Cleave)", adj.x, adj.y, '#f97316');
                if (adj.hp <= 0) handleEnemyDeath(adj, 'two');
            }
        }

        if (w.type === 'two' && state.skills?.two?.perks?.['two_b4']) { // Ruthless
            state.player._ruthlessStacks = state.skills.two.perks['two_b4'];
        }

        // Tutorial overrides (Keep these for tutorial flow)
        if (state.gameMode === 'tutorial' && state.tutorialStep === 6 && target.type === 'Rat' && !target.tutorialDummy){
            state._tutStep6Started = true;
            state.tutorialStep = 6;
            hideBanner();
            showBanner(`You’re poisoned. Press ${getInputName('antidote')} to use an antidote, then press ${getInputName('potion')} to drink a potion.`, 999999);
        }
        if (state.gameMode === 'tutorial' && state._tutStep6Started && !state._tutArtTargetSpawned) {
            state._tutArtTargetSpawned = true;
            state.enemies.push({ x:18, y:15, type:'Rat', hp:1, atk:[1,2], xp:3, stunTicks:9999, tutorialDummy:true });
            state.enemies.push({ x:19, y:15, type:'Rat', hp:1, atk:[1,2], xp:3, stunTicks:9999, tutorialDummy:true });
        }
        
        enemyStep();
        draw();
        return;
    }

    enemyStep();
    draw();
    return;
}

function spawnBossStairs(targetX, targetY){
  if (state._bossStairsSpawned) return;
  
  // Use passed coordinates, or fallback to room center
  let sx = targetX;
  let sy = targetY;
  
  if (sx === undefined || sy === undefined) {
      const r = state.rooms && state.rooms[0] ? state.rooms[0]
          : {x:0, y:0, w:state.size.w, h:state.size.h};
      sx = Math.floor(r.x + r.w/2);
      sy = Math.floor(r.y + r.h/2);
  }

  state.tiles[sy][sx] = 4;                 // put stairs down
  state._bossStairsSpawned = true;
  if (typeof ensurePathToStairsUnlocked === 'function'){
    ensurePathToStairsUnlocked();          // open any doors on path (already in your build)
  }
  log('A staircase appears!');
  draw();
}


// === player spell LOS helpers ===
function playerSpellRangeFor(name){
  // tune per spell
  return ({ Spark:2, Ember:3, Frost:3, Gust:2, Pebble:3, Heal:0 }[name] ?? 2);
}

function findFirstLinedTarget(px, py, range){
  const dirs = [
    {dx: 1, dy: 0},  // →
    {dx:-1, dy: 0},  // ←
    {dx: 0, dy: 1},  // ↓
    {dx: 0, dy:-1},  // ↑
  ];
  for (const {dx,dy} of dirs){
    for (let s=1; s<=range; s++){
      const tx = px + dx*s, ty = py + dy*s;
      if (!inBounds(tx,ty)) break;
      // stop if wall blocks
      if (!clearStraightLine(px,py,tx,ty)) break;
      const e = state.enemies.find(en => {
  if (en.size > 1) {
    // any tile in the boss's footprint is targetable
    return tx >= en.x && tx < en.x + en.size &&
           ty >= en.y && ty < en.y + en.size;
  }
  return en.x === tx && en.y === ty;
});
      if (e) return e;
      // if we hit a closed door tile etc, stop (optional depending on your tiles)
      if (state.tiles[ty][tx]===0) break;
    }
  }
  return null;
}



// --- NEW: Weapon Arts (Active Skills) ---
function useWeaponArt(){
  if (state.gameOver || state._inputLocked || state._descending) return;
  
  if (state.player.artCooldown > 0) {
    log(`Ability not ready (${state.player.artCooldown} turns).`);
    return;
  }

  const w = state.player.weapon;
  const t = w.type;

  // --- NEW: Stamina Check (Melee Only) ---
  if (t !== 'staff') {
      const STAMINA_COST = getStaminaCost(4);
      if (state.player.stamina < STAMINA_COST) {
        spawnFloatText("Need Stamina", state.player.x, state.player.y, '#9ca3af');
        log(`Not enough Stamina for Weapon Art (${state.player.stamina}/${STAMINA_COST}).`);
        return;
      }
      state.player.stamina -= STAMINA_COST;
      updateBars();
  }
  // ---------------------------------------

  let acted = false;

  // 1. CLEAVE (Two-Handed Only): Hit all adjacent enemies
  if (t === 'two') {
    SFX.swingFor(t);
    let hitCount = 0;
    const hitList = new Set(); 

    // Check 3x3 grid around player
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue; 
        
        const tx = state.player.x + dx;
        const ty = state.player.y + dy;
        const e = state.enemies.find(en => {
          const s = en.size || 1;
          return tx >= en.x && tx < en.x + s && ty >= en.y && ty < en.y + s;
        });
        
        if (e && !hitList.has(e)) {
          hitList.add(e);
          const dmg = Math.floor(rand(w.min, w.max) * 1.2);
          e.hp -= dmg;
          spawnFloatText(dmg+"!", e.x, e.y, '#ffae00');
          
          // --- NEW: Meteor Strike (two_c2) ---
          if (state.skills?.two?.perks?.['two_c2']) {
              if (typeof applyStun === 'function') applyStun(e, 2);
              spawnFloatText("STUNNED", e.x, e.y, '#facc15');
          }
          
          if(e.hp <= 0) {
             // Use central handler to ensure Stairs/Omens/Explosions trigger
             handleEnemyDeath(e, t);
          } else {
             flashEnemy(e, 'red');
          }
          hitCount++;
        }
      }
    }

    if(hitCount > 0) {
      log(`You Cleave around you, hitting ${hitCount} foes!`);
      acted = true;
      state.player.artCooldown = 15; 
    } else {
      log("No enemies to Cleave.");
    }
  }

  // 1.5 HURL (Axe / Hafted): Throw weapon 5 tiles
  else if (t === 'axe') {
    const range = 5; // Fixed range
    const dirs = {up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
    const [dx,dy] = dirs[state.player.facing || 'down'];
    
    let targetE = null;
    let tx = state.player.x;
    let ty = state.player.y;
    
    for (let r = 1; r <= range; r++) {
        tx = state.player.x + (dx * r);
        ty = state.player.y + (dy * r);
        
        // Stop at walls or closed doors
        if (!inBounds(tx, ty) || state.tiles[ty][tx] === 0 || state.tiles[ty][tx] === 2) {
            tx -= dx;
            ty -= dy;
            break;
        }
        
        const e = state.enemies.find(en => {
          const s = en.size || 1;
          return tx >= en.x && tx < en.x + s && ty >= en.y && ty < en.y + s;
        });
        
        if (e) {
            targetE = e;
            break;
        }
    }
    
    if (targetE) {
        // Calculate Massive Damage (3x Base)
        const dmg = rand(w.min, w.max) * 3;
        targetE.hp -= dmg;
        
        // Visuals
        SFX.swingFor('axe');
        spawnFloatText(dmg + "!!", targetE.x, targetE.y, '#ff0000');
        spawnParticles(targetE.x, targetE.y, '#ef4444', 8);
        flashEnemy(targetE, 'red');
        
        log(`You HURL your ${w.name} at the ${targetE.type}!`);
        
        // Handle Kill
        if(targetE.hp <= 0) { 
            handleEnemyDeath(targetE, t);
        }
    } else {
        SFX.swingFor('axe');
        log(`You HURL your ${w.name} through the air!`);
    }

    // DROP LOGIC
    // Drop 1 tile in front of where it hit/stopped (from player's perspective)
    const dropX = tx - dx;
    const dropY = ty - dy;
    
    if (inBounds(dropX, dropY) && state.tiles[dropY][dropX] === 1) {
        const k = key(dropX, dropY);
        // Create Pickup from current weapon data
        state.pickups[k] = { kind: 'weapon', payload: { ...w } };
        state.tiles[dropY][dropX] = 5; // Pickup tile
        
        // Remove from Inventory Count
        if (state.inventory.weapons[w.name]) {
            state.inventory.weapons[w.name]--;
            if (state.inventory.weapons[w.name] <= 0) delete state.inventory.weapons[w.name];
        }
        
        // Unequip (Switch to Fists)
        state.player.weapon = {name:'Fists',min:1,max:2,type:'hand',base:{min:1,max:2},dur:null,durMax:null};
        recomputeWeapon();
        updateInvBody(); // Update inventory UI counts
        log(`Your weapon drops to the floor.`);
    } else {
        log(`Your weapon shattered against the wall!`);
        state.player.weapon = {name:'Fists',min:1,max:2,type:'hand',base:{min:1,max:2},dur:null,durMax:null};
        recomputeWeapon();
    }

    acted = true;
    state.player.artCooldown = 15; 
    
    // Projectile Effect (Visual only)// Projectile Effect (Visual only)
    spawnProjectileEffect({
        kind: 'arrow', color: '#a3a3a3', // Metallic projectile
        fromX: state.player.x, fromY: state.player.y, 
        toX: tx, toY: ty
    });
  }
  
  // 2. PIERCE (Spear): Attack 2 tiles in a line
  else if (t === 'spear') {
    const dirs = {up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
    const [dx,dy] = dirs[state.player.facing || 'down'];
    
    // Check tile 1
    let tx = state.player.x + dx, ty = state.player.y + dy;
    let e1 = state.enemies.find(en => { const s = en.size || 1; return tx >= en.x && tx < en.x + s && ty >= en.y && ty < en.y + s; });
    
    // Check tile 2
    let tx2 = tx + dx, ty2 = ty + dy;
    let e2 = state.enemies.find(en => { const s = en.size || 1; return tx2 >= en.x && tx2 < en.x + s && ty2 >= en.y && ty2 < en.y + s && en !== e1; });
    
    if (e1 || e2) {
      SFX.swingFor('spear');
      const dmg = rand(w.min, w.max);
      
      if(e1) { e1.hp -= dmg; spawnFloatText(dmg, e1.x, e1.y, '#fff'); flashEnemy(e1); if(e1.hp<=0) handleEnemyDeath(e1, t); }
      if(e2) {
                    e2.hp -= dmg;
                    spawnFloatText(dmg, e2.x, e2.y, '#fff');
                    flashEnemy(e2);
                    if(e2.hp<=0) {
                        handleEnemyDeath(e2, t);
                    }
                }
      
      log("You Pierce through the line!");
      acted = true;
      state.player.artCooldown = 10;
    } else {
      log("Nothing to Pierce.");
    }
  }
  
  // 3. BACKSTAB (Shortsword/One-Handed): Teleport behind enemy and Crit
  else if (t === 'one') {
    // --- FIX: Auto-target any adjacent enemy regardless of which way the player is facing ---
    const nbs = neighbors4(state.player.x, state.player.y);
    const e = state.enemies.find(en => {
      const s = en.size || 1;
      return nbs.some(n => n.x >= en.x && n.x < en.x + s && n.y >= en.y && n.y < en.y + s);
    });
    
    if (e) {
      const s = e.size || 1;
      // Calc direction from player to enemy dynamically
      let dx = 0, dy = 0;
      if (state.player.x < e.x) dx = 1;
      else if (state.player.x >= e.x + s) dx = -1;
      if (state.player.y < e.y) dy = 1;
      else if (state.player.y >= e.y + s) dy = -1;
      
      // Calc spot behind enemy
      const bx = state.player.x + dx * (s + 1), by = state.player.y + dy * (s + 1);
      if (inBounds(bx, by) && state.tiles[by][bx] === 1 && !enemyAt(bx, by)) {
        // Teleport (Snap visuals)
        state.player.x = bx; state.player.y = by;
        state.player.rx = bx; state.player.ry = by;
        
        // Crit Damage
        const dmg = rand(w.min, w.max) * 2;
        e.hp -= dmg;
        spawnFloatText("CRIT " + dmg, e.x, e.y, '#ff0');
        flashEnemy(e, 'red');
        SFX.enemyHit();
        log(`Backstab! Critical hit for ${dmg}.`);
        
        if(e.hp <= 0) handleEnemyDeath(e, t);
        
        acted = true;
        state.player.artCooldown = 12;
      } else {
        log("No space behind foe to Backstab.");
      }
    } else {
      log("No enemy to Backstab.");
    }
  }
  
  // 4. FLURRY (Fists): 3 rapid hits for 60% dmg each
  else if (t === 'hand') {
    const nbs = neighbors4(state.player.x, state.player.y);
    const e = state.enemies.find(en => {
      const s = en.size || 1;
      return nbs.some(n => n.x >= en.x && n.x < en.x + s && n.y >= en.y && n.y < en.y + s);
    });
    
    if(e){
      let total = 0;
      for(let i=0; i<3; i++){
        const d = Math.ceil(rand(w.min, w.max) * 0.6);
        total += d;
        spawnFloatText(d, e.x, e.y - (i*0.2), '#fff');
      }
      e.hp -= total;
      flashEnemy(e);
      SFX.attack();
      log(`Flurry of blows! ${total} total damage.`);
      
      if(e.hp <= 0) handleEnemyDeath(e, t);
      
      acted = true;
      state.player.artCooldown = 8;
    } else {
      log("No enemy to Flurry.");
    }
  }

  // 5. OVERLOAD (Staff): Massive AOE Blast
  else if (t === 'staff') {
    // Calculate Cost: Base 10 + Equipped Spell Cost (Dynamic Scaling)
    let extraCost = 0;
    if (state.equippedSpell) {
        const stats = getSpellStats(state.equippedSpell.name);
        extraCost = stats.cost || 0;
    }
    const MP_COST = 10 + extraCost;

    if (state.player.mp < MP_COST) {
        log(`Not enough Mana for Overload (${state.player.mp}/${MP_COST}).`);
        return;
    }
    
    state.player.mp -= MP_COST;
    updateBars();

    spawnFloatText("OVERLOAD!", state.player.x, state.player.y, '#a78bfa');
    SFX.levelUp(); 
    
    let hitCount = 0;
      // Hit ALL enemies in vision
      state.enemies.forEach(e => {
        // CHANGED: Added range check (Max 3 tiles away)
        const dist = Math.max(Math.abs(e.x - state.player.x), Math.abs(e.y - state.player.y));
        if (state.seen.has(key(e.x, e.y)) && dist <= 3) {
          const bonus = Math.floor((state.skills.magic?.lvl||1));
          const dmg = rand(10, 15) + bonus; // Massive Base Damage
            
            e.hp -= dmg;
            spawnFloatText(dmg, e.x, e.y, '#a78bfa');
            // Bomb-style effects: Fire + Smoke
            spawnParticles(e.x, e.y, '#f97316', 6); 
            spawnParticles(e.x, e.y, '#4b5563', 4);
            
            if(e.hp <= 0) e._dead = true; 
            hitCount++;
        }
    });
    
    // Cleanup dead
    const kills = state.enemies.filter(e => e._dead);
    kills.forEach(k => {
       // Reset flag so handleEnemyDeath doesn't get confused (optional but safe)
       k._dead = false; 
       handleEnemyDeath(k, 'magic');
    });

    if (hitCount > 0) log(`You unleash raw Aether! Hit ${hitCount} enemies.`);
    else log("You release the energy, but no one is there.");
    
    acted = true;
    unlockCodex('Art_Overload', true);
    state.player.artCooldown = 20; 
  }

  // If we used a skill, trigger turns
  if(acted) {
    // 1. Determine the Name of the Art based on the weapon type 't'
    let artName = '';
    if (t === 'two')                artName = 'Cleave';
    else if (t === 'axe')           artName = 'Hurl'; // <--- NEW
    else if (t === 'spear')         artName = 'Pierce';
    else if (t === 'one')           artName = 'Backstab';
    else if (t === 'hand')          artName = 'Flurry';
    else if (t === 'staff')         artName = 'Overload';

    // 2. Record the action so the Shadow can copy it
    state.lastPlayerAction = { type: 'art', name: artName }; 
    
    // 3. Unlock the Codex entry for this specific art
    unlockCodex('Art_' + artName, true); 

    // --- TUTORIAL Step 5 -> 6 (Weapon Art) ---
    if (state.gameMode === 'tutorial' && state.tutorialStep === 5) {
      const liveDummies = state.enemies.filter(e => e.tutorialDummy && e.y === 18).length;
      if (liveDummies === 0 || acted) { 
         state.tutorialStep = 6;
         state.enemies = state.enemies.filter(e => !(e.tutorialDummy && e.y === 18));
         
         // FIX: Spawn the Step 6 Rat NOW
         state.enemies.push({x:10, y:22, type:'Rat', hp:2, atk:[1,2], xp:0, tutorialDummy:false});
         
         hideBanner();
         showBanner(`Step 6: Melee. Attack the next rat with (${getInputName('attack')}). Beware poison!`, 999999);
      }
    }
    
    // 5. (Existing) End turn and redraw
    updateEquipUI();
    draw();
    enemyStep();
  }
}

function cast(){
 if (state.gameOver) return;
 if (state._inputLocked || state._descending) return;
 
 state.player._consecutiveSteps = 0; // Reset movement tracker
 
 const btn = document.getElementById('btnCast');

  // restart flow (unchanged)
  if (btn.dataset.restart === '1'){
  btn.dataset.restart = '';

  // NEW: clear game-over lock + hide modal
  state.gameOver = false;
  const m = document.getElementById('gameOverModal');
  if (m) m.style.display = 'none';

  Object.assign(state.player, {
    hp:20,hpMax:20,mp:10,mpMax:10,level:1,xp:0,next:24,
    weapon:{name:'Fists',min:1,max:2,type:'hand',base:{min:1,max:2},dur:null,durMax:null,shield: null,}
  
    });
    state._hitParity = 0;
    state._shieldParity = 0;
    state.skills = {};
    state.inventory = {
  lockpicks:0, potions:0, tonics:0, antidotes:0,
  weapons:{}, arrows:0, gold:0,
  stashed:{}, shields: 0,          // ← keep damaged weapon instances here
};


    state.spells = [];
    state.floor = 1;
    gen(); updateBars(); updateEquipUI(); renderSkills();
    log('You awaken with nothing. Explore, loot, survive.');
    log('A chest is nearby.');
    renderLog(); draw(); return;
  }

  // need a spell selected
  if (!state.equippedSpell){
    if (!state.spells.length){ log('No spells have been learned yet.'); }
    else { log('Select a spell in the Spells menu.'); }
    return;
  }

  const spell = state.equippedSpell;

  // --- NEW: Anti-Magic Block ---
  if (isEffectActive('AntiMagic')) {
    log('A field of silence prevents magic here!');
    return;
  }
  // -----------------------------
  
  
// Heal resolves immediately (no target)
if (spell.name === 'Heal'){
  const st = getSpellStats('Heal');                 // { cost, pct, range:0 }
  if (state.player.mp < st.cost){ log('Not enough MP.'); return; }
  state.player.mp -= st.cost; 

  const before = state.player.hp|0;
  const gain   = Math.max(1, Math.round(state.player.hpMax * (st.pct || 0)));
  state.player.hp = clamp(before + gain, 0, state.player.hpMax);
  const healed = state.player.hp - before;

  updateBars();

  SFX.spell();
  log(`You cast Heal and restore ${healed} HP (${Math.round((st.pct||0)*100)}%).`);
  draw(); enemyStep(); return;
}



  // Damage/control spells: find LOS target first, THEN spend MP
  const st = getSpellStats(spell.name);               // { cost, min, max, range }
let target = findFirstLinedTarget(state.player.x, state.player.y, st.range);

// Archmage (mag_c4) Ignore LOS
if (!target && state.skills?.magic?.perks?.['mag_c4']) {
    target = state.enemies.find(en => dist(en.x, en.y, state.player.x, state.player.y) <= st.range);
}

if (!target){ log('No enemy in range/LOS.'); return; }

// Blood Magic (mag_c5)
let hpCost = 0;
if (state.player.mp < st.cost){ 
    if (state.skills?.magic?.perks?.['mag_c5']) {
        hpCost = st.cost;
        if (state.player.hp <= hpCost) {
            log('Not enough HP for Blood Magic.'); return;
        }
    } else {
        log('Not enough MP.'); return; 
    }
}

SFX.spell();

if (hpCost > 0) {
    state.player.hp -= hpCost;
    spawnFloatText("-" + hpCost + " HP", state.player.x, state.player.y, '#ef4444');
} else {
    if (st.cost === 0) spawnFloatText("FREE", state.player.x, state.player.y, '#60a5fa');
    state.player.mp -= st.cost; 
}
updateBars();

// Record spell for Shadow and Elemental Weaver tracking
state.lastPlayerAction = { type: 'spell', name: spell.name };
if (state.skills?.magic?.perks?.['mag_c7']) state.player._weaverSpell = spell.name;


  // hit/miss
  if (!rollHitFor('magic')){
    spawnFloatText("Miss", target.x, target.y, '#9ca3af'); 
    log(`Your ${spell.name} misses.`);
    SFX.miss();
    enemyStep(); draw(); return;
  }

  const { min, max } = getSpellStats(spell.name);
  let dmg = rand(min, max);

  // Empower (mag_a1) is now handled natively inside getSpellStats()

  // NEW: Overcharge (mag_b1) & Devastation (mag_c1)
  let isOvercharged = false;
  if (state.skills?.magic?.perks?.['mag_b1'] && Math.random() < (0.10 * state.skills.magic.perks['mag_b1'])) {
      dmg *= (state.skills?.magic?.perks?.['mag_c1'] ? 3 : 2);
      isOvercharged = true;
      spawnFloatText("OVERCHARGE", state.player.x, state.player.y, '#c084fc');
  }

  // Staff Elemental Boost
  const wName = state.player.weapon ? state.player.weapon.name : '';
  if (wName.includes('Fire') && spell.name === 'Ember') { dmg+=3; log('Fire Staff boost!'); }
  else if (wName.includes('Light') && spell.name === 'Spark') { dmg+=3; log('Lightning Staff boost!'); }
  else if (wName.includes('Ice') && spell.name === 'Frost') { dmg+=3; log('Ice Staff boost!'); }
  else if (wName.includes('Wind') && spell.name === 'Gust') { dmg+=3; log('Wind Staff boost!'); }
  else if (wName.includes('Earth') && spell.name === 'Pebble') { dmg+=3; log('Earth Staff boost!'); }
  
  if (isEffectActive('ArcaneFlux')) dmg = Math.ceil(dmg * 1.5);

  target.hp -= dmg;
  if (typeof flashEnemy === 'function') flashEnemy(target, 'red'); 
  spawnParticles(target.x, target.y, '#60a5fa', 6); 
  
  spawnFloatText(dmg, target.x, target.y, '#60a5fa');

  // --- NEW: Elemental Spell Effects (25% Proc Chance) ---
  if (spell.name === 'Ember' && Math.random() < 0.25) {
      if (typeof applyBleed === 'function') applyBleed(target, 3, 2); // Reusing Bleed logic for Burn DOT
      spawnFloatText("BURN", target.x, target.y, '#f97316');
      log(`The ${target.type} catches fire!`);
  }
  else if (spell.name === 'Frost' && Math.random() < 0.25) {
      if (typeof applySlow === 'function') applySlow(target, 3);
      spawnFloatText("SLOWED", target.x, target.y, '#38bdf8');
      log(`The ${target.type} is chilled to the bone!`);
  }
  else if (spell.name === 'Pebble' && Math.random() < 0.25) {
      if (typeof applyStun === 'function') applyStun(target, 2);
      spawnFloatText("STUNNED", target.x, target.y, '#facc15');
      log(`The ${target.type} is stunned by the impact!`);
  }
  else if (spell.name === 'Gust' && Math.random() < 0.25) {
      const dx = Math.sign(target.x - state.player.x);
      const dy = Math.sign(target.y - state.player.y);
      let pushed = false;
      for (let step = 0; step < 2; step++) {
          const pushX = target.x + dx;
          const pushY = target.y + dy;
          if (inBounds(pushX, pushY) && state.tiles[pushY][pushX] === 1 && !enemyAt(pushX, pushY)) {
              target.x = pushX; target.y = pushY;
              pushed = true;
          } else break;
      }
      if (pushed) {
          spawnFloatText("PUSHED", target.x, target.y, '#9ca3af');
          log(`The ${target.type} is blown back!`);
      }
  }
  else if (spell.name === 'Spark' && Math.random() < 0.25) {
      // Chain Lightning Logic
      let currentTarget = target;
      let chainChance = 1.0; // Guaranteed first jump if the 25% initial proc succeeds
      let chainDmg = Math.max(1, Math.floor(dmg * 0.75));
      const hitList = new Set([target]);

      // Allow up to 3 extra bounces max, decaying chance and damage each time
      for (let bounces = 0; bounces < 3; bounces++) {
          if (Math.random() > chainChance) break;
          
          // Find adjacent enemy not yet hit
          const nextTarget = state.enemies.find(en => 
              en.hp > 0 && !hitList.has(en) && 
              Math.abs(en.x - currentTarget.x) <= 1 && Math.abs(en.y - currentTarget.y) <= 1
          );
          
          if (!nextTarget) break; // No one close enough to jump to
          
          hitList.add(nextTarget);
          nextTarget.hp -= chainDmg;
          spawnFloatText(chainDmg + " (Chain)", nextTarget.x, nextTarget.y, '#fde047');
          spawnParticles(nextTarget.x, nextTarget.y, '#fde047', 6);
          log(`Lightning chains to the ${nextTarget.type} for ${chainDmg}!`);
          
          if (nextTarget.hp <= 0) handleEnemyDeath(nextTarget, 'magic');
          
          currentTarget = nextTarget;
          chainDmg = Math.max(1, Math.floor(chainDmg * 0.75)); // Decay damage 25%
          chainChance *= 0.50; // Decay jump chance 50%
      }
  }
  // ------------------------------------------------------

  // NEW: Arcane Chain (mag_c2) - Overcharge bounces to second enemy
  if (isOvercharged && state.skills?.magic?.perks?.['mag_c2']) {
      const secondary = state.enemies.find(en => en !== target && en.hp > 0 && Math.abs(en.x - target.x) <= 3 && Math.abs(en.y - target.y) <= 3);
      if (secondary) {
          secondary.hp -= dmg;
          spawnFloatText(dmg + " (Chain)", secondary.x, secondary.y, '#c084fc');
          spawnParticles(secondary.x, secondary.y, '#c084fc', 8);
          if (secondary.hp <= 0) handleEnemyDeath(secondary, 'magic');
      }
      log("The overcharged spell erupts in an Arcane Chain!");
  }

  // --- FIX: Magic Aether Nova (mag_a3 is gone, keeping base overcharge logic cleanly) ---

  log(`Your ${spell.name} hits for ${dmg}.`);

  // TUTORIAL Step 9 (Magic)
  if (state.gameMode === 'tutorial' && state.tutorialStep === 9) {
    state.tutorialStep = 10;
    state.player.mp = 0; 
    state.pickups['10,37'] = {kind:'tonic', payload:1};
    state.tiles[37][10]=5;
    hideBanner();
    showBanner(`Step 10: Low Mana! Pickup and use the Tonic (${getInputName('tonic')}) for instant recharge.`, 999999);
  }

  if (target.hp <= 0) handleEnemyDeath(target, 'magic');

  const onDone = ()=>{ 
      // NEW: Echo (mag_b2) & Resonance (mag_c3)
      let echoChance = 0;
      if (state.skills?.magic?.perks?.['mag_b2']) echoChance = 0.10 * state.skills.magic.perks['mag_b2'];

      if (Math.random() < echoChance && target.hp > 0) {
          spawnFloatText("ECHO!", target.x, target.y, '#a78bfa');
          const echoDmg = Math.ceil(dmg / 2);
          target.hp -= echoDmg;
          spawnFloatText(echoDmg, target.x, target.y, '#60a5fa');
          if (target.hp <= 0) handleEnemyDeath(target, 'magic');
          
          spawnProjectileEffect({
              kind: 'magic', element: spell.name,
              fromX: state.player.x, fromY: state.player.y, toX: target.x, toY: target.y,
              onDone: () => { 
                  // Resonance triggers a 3rd cast
                  if (state.skills?.magic?.perks?.['mag_c3'] && Math.random() < echoChance && target.hp > 0) {
                       spawnFloatText("RESONANCE!", target.x, target.y, '#c084fc');
                       const resDmg = Math.ceil(echoDmg / 2);
                       target.hp -= resDmg;
                       spawnFloatText(resDmg, target.x, target.y, '#60a5fa');
                       if (target.hp <= 0) handleEnemyDeath(target, 'magic');
                       spawnProjectileEffect({
                          kind: 'magic', element: spell.name, fromX: state.player.x, fromY: state.player.y, toX: target.x, toY: target.y,
                          onDone: () => { enemyStep(); draw(); }
                       });
                  } else {
                      enemyStep(); draw(); 
                  }
              }
          });
      } else {
          enemyStep(); draw(); 
      }
  };

  spawnProjectileEffect({ kind: 'magic', element: spell.name, fromX: state.player.x, fromY: state.player.y, toX: target.x, toY: target.y, onDone });
}


// --- Allowed merchant weapons (must match your game) ---
const MERCHANT_WEAPON_NAMES = ['Shortsword','Claymore','Spear','Axe','Knuckle Duster'];

// Pull stats from the same mapping used by equipWeaponByName()
function weaponStatsFor(name){
  if (!name) return null;
  let baseName = name;
  let bonMin=0, bonMax=0;
  
  // FIX: Extract +X upgrade level dynamically and add to base damage
  const match = baseName.match(/(.+) \+(\d+)$/);
  if (match) {
      baseName = match[1];
      const plus = parseInt(match[2], 10);
      bonMin += plus;
      bonMax += plus;
  }

  // FIX: Strip Cursed prefix so the base type/stats lookup works
  if (baseName.includes('Cursed ')) {
     baseName = baseName.replace('Cursed ', '');
     baseName = baseName.replace('Blood ', '').replace('Greed ', '').replace('Rust ', '').replace('Frailty ', '');
  }

  if (baseName.includes('Sharp '))       { baseName = baseName.replace('Sharp ', '');   bonMin+=1; bonMax+=1; }
  else if (baseName.includes('Heavy '))  { baseName = baseName.replace('Heavy ', '');   bonMax+=3; }
  else if (baseName.includes('Vampiric ')){ baseName = baseName.replace('Vampiric ', ''); }
  else if (baseName.includes('Ancient ')) { baseName = baseName.replace('Ancient ', '');  bonMin+=2; bonMax+=2; }

const stats = {
    'Shortsword': [3,5,'one'],
    'Claymore':   [5,9,'two'],
    'Spear':      [4,7,'spear'],
    'Axe':        [4,8,'axe'],
    'Knuckle Duster': [3,5,'hand'],
    'Key of Destiny': [5,7,'one'],
    
    // --- NEW MELEE ---
    'Warhammer':      [6,10,'two'],
    'Battleaxe':      [5,10,'axe'],
    'Halberd':        [5,9,'spear'],
    'Claws':          [4,6,'hand'],

    // --- NEW STAFFS ---
    'Fire Staff':     [2,4,'staff'], 
    'Ice Staff':      [2,4,'staff'], 
    'Lightning Staff':[2,4,'staff'],
    'Wind Staff':     [2,4,'staff'], 
    'Earth Staff':    [2,4,'staff'],

    // --- NEW SHIELDS ---
    'Buckler':        [1,2,'shield'], 
    'Kite Shield':    [2,3,'shield'], 
    'Tower Shield':   [3,4,'shield'], 
    'Ancient Shield': [2,4,'shield']
  }[baseName];
  
  return stats ? { name, min:stats[0]+bonMin, max:stats[1]+bonMax, type:stats[2] } : null;
}

// Simple price table (tune freely)
const MERCHANT_WEAPON_PRICES = {
  'Shortsword': 18,
  'Claymore':   28,
  'Spear':      22,
  'Axe':        24,
  'Knuckle Duster': 14
};

function makeWeaponOffer(){
  const name = MERCHANT_WEAPON_NAMES[rand(0, MERCHANT_WEAPON_NAMES.length-1)];
  const st = weaponStatsFor(name);
  const price = depthPrice(MERCHANT_WEAPON_PRICES[name] || 20);
  return {
    kind: 'buy',
    item: `${name} (${st.min}–${st.max})`,
    price,
    do: ()=>{
      // Add like chest loot does:
      // state.inventory.weapons[w.name] = (state.inventory.weapons[w.name] || 0) + 1;
      state.inventory.weapons[name] = (state.inventory.weapons[name] || 0) + 1;
    }
  };
}

function makeWeaponOffer(){
  const name = MERCHANT_WEAPON_NAMES[rand(0, MERCHANT_WEAPON_NAMES.length-1)];
  const st = weaponStatsFor(name);

  // SAFETY GUARD: if a name slipped in without stats, fall back to a potion
  if (!st) {
    console.warn('Merchant picked unknown weapon:', name);
    return { kind:'buy', item:'Potion', price: depthPrice(10),
             do:()=>{ state.inventory.potions=(state.inventory.potions|0)+1; } };
  }

  const price = depthPrice(MERCHANT_WEAPON_PRICES[name] || 20);
  return {
    kind: 'buy',
    item: `${name} (${st.min}–${st.max})`,
    price,
    do: ()=>{
      state.inventory.weapons[name] = (state.inventory.weapons[name] || 0) + 1;
    }
  };


  // merchant buys extras from player (defined here as >3 in stock)
  const sells = [];
  if ((state.inventory.potions|0)   > 3) sells.push({kind:'sell', item:'Potion',   price:5, do:()=>{ state.inventory.potions--;   state.inventory.gold=(state.inventory.gold|0)+5; }});
  if ((state.inventory.tonics|0)    > 3) sells.push({kind:'sell', item:'Tonic',    price:6, do:()=>{ state.inventory.tonics--;    state.inventory.gold=(state.inventory.gold|0)+6; }});
  if ((state.inventory.antidotes|0) > 3) sells.push({kind:'sell', item:'Antidote', price:7, do:()=>{ state.inventory.antidotes--; state.inventory.gold=(state.inventory.gold|0)+7; }});
  if ((state.inventory.lockpicks|0) > 3) sells.push({kind:'sell', item:'Lockpick', price:8, do:()=>{ state.inventory.lockpicks--; state.inventory.gold=(state.inventory.gold|0)+8; }});

  // 2 buys + 1 sell (if any)
  const out = [];
  // Grab two unique buys
  while (out.length < 2 && buys.length){
    const i = rand(0, buys.length-1);
    out.push(buys.splice(i,1)[0]);
  }
  // Add a sell if available
  if (sells.length) out.push(sells[rand(0, sells.length-1)]);

  return out;
}

// ===== Merchant modal wiring (Buy/Sell greeting) =====
document.addEventListener('DOMContentLoaded', ()=>{
  // DOM Elements
  const modal   = document.getElementById('merchantModal');
  const goldNow = document.getElementById('goldNow');
  const msg     = document.getElementById('merchantMsg');
  const btnA    = document.getElementById('mOfferA');
  const btnB    = document.getElementById('mOfferB');
  const btnC    = document.getElementById('mOfferC');
  const backBtn = document.getElementById('mBack');
  
  // Helper: Find or Create the Button Row and List Container
  const btnRow = btnA.parentElement; // The row holding A, B, C
  
  let listDiv = document.getElementById('merchantSellList');
  if (!listDiv) {
    listDiv = document.createElement('div');
    listDiv.id = 'merchantSellList';
    listDiv.style.cssText = 'display:none; flex-direction:column; gap:8px; max-height:50vh; overflow-y:auto; margin-bottom:10px; padding-right:4px;';
    btnRow.parentNode.insertBefore(listDiv, btnRow); // Insert before buttons
  }

  // --- Header Back/Close logic ---
  function setBackMode(mode){
    if (!backBtn) return;
    backBtn.removeAttribute('data-close');
    backBtn.onclick = null;

    if (mode === 'hide'){                 
      backBtn.style.display = 'none';
    } else if (mode === 'back'){          
      backBtn.style.display = '';
      backBtn.textContent = 'Back';
      backBtn.onclick = renderGreeting;
    } else {                              
      backBtn.style.display = '';
      backBtn.textContent = 'Close';
      backBtn.setAttribute('data-close','1');
      backBtn.onclick = ()=>{
        modal.style.display='none';
        state._inputLocked = false;
        if (!state._pauseOpen) setMobileControlsVisible?.(true);
      };
    }
  }

  // --- Pricing Helper ---
  function depthPrice(base){
    const f = state.floor | 0;
    const mult = 1 + 0.10 * Math.floor(Math.max(0, f - 1) / 3);
    let p = Math.ceil(base * mult);
    if (state.skills?.lockpicking?.perks?.['loc_b2']) p = Math.floor(p * 0.80); // Haggle (-20%)
    return Math.max(1, p);
  }

  // Persistent Stock (Buy Menu)
  function getBuyStock(){
    if (!state.merchant) state.merchant = {};
    if (!state.merchant.stock){
      state.merchant.stock = [
        { kind:'buy', item:'Potion',   price:depthPrice(10), stock:rand(1,5), do:()=>{ state.inventory.potions=(state.inventory.potions|0)+1; } },
        { kind:'buy', item:'Tonic',    price:depthPrice(12), stock:rand(1,5), do:()=>{ state.inventory.tonics=(state.inventory.tonics|0)+1; } },
        { kind:'buy', item:'Lockpick', price:depthPrice(15), stock:rand(1,5), do:()=>{ state.inventory.lockpicks=(state.inventory.lockpicks|0)+1; } }
      ].map(o => ({ ...o, sold:false }));
    }
    return state.merchant.stock;
  }

  // --- RENDERERS ---

  function renderBuy(){
    setBackMode('back');
    msg.textContent = "I've got plenty of things that might interest you.";
    
    // Toggle Views
    btnRow.style.display = 'flex'; // Show A/B/C buttons
    listDiv.style.display = 'none'; // Hide Sell List

    const offers = getBuyStock();
    
    const bindBuy = (btn, o) => {
      if (!o){ btn.style.display='none'; return; }
      const label = o.sold ? `${o.item} — SOLD` : `Buy ${o.item} — ${o.price}g (${o.stock})`;
      btn.textContent = label;
      btn.style.display = '';
      btn.disabled = !!o.sold;
      btn.style.opacity = o.sold ? 0.5 : 1;
      btn.onclick = () => {
        if ((state.inventory.gold|0) < o.price) { msg.textContent = 'Not enough gold.'; return; }
        state.inventory.gold -= o.price;
        o.do();
        o.stock--;
        if (o.stock <= 0) o.sold = true;
        
        unlockCodex('Merchant_Bought', true);
        goldNow.textContent = state.inventory.gold;
        updateInvBody?.();
        renderBuy(); // Refresh
      };
    };

    bindBuy(btnA, offers[0]);
    bindBuy(btnB, offers[1]);
    bindBuy(btnC, offers[2]);
  }

  function renderSell(){
    setBackMode('back');
    msg.textContent = "I'll buy just about anything you have.";
    
    // Toggle Views
    btnRow.style.display = 'none'; // Hide the 3 big buttons
    listDiv.style.display = 'flex'; // Show the scrollable list
    listDiv.innerHTML = ''; // Clear previous

    // Helper to create a sell row
    const addSellItem = (label, basePrice, onSell) => {
      const price = state.skills?.lockpicking?.perks?.['loc_c3'] ? Math.ceil(basePrice * 1.50) : basePrice;
      const row = document.createElement('div');
      row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:8px; border-radius:6px; border:1px solid rgba(255,255,255,0.1);';
      
      const txt = document.createElement('span');
      txt.textContent = `${label}`;
      txt.style.fontWeight = 'bold';
      
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = `Sell (+${price}g)`;
      btn.style.padding = '6px 12px';
      btn.style.fontSize = '14px';
      
      btn.onclick = () => {
        onSell();
        state.inventory.gold = (state.inventory.gold|0) + price;
        unlockCodex('Merchant_Sold', true);
        goldNow.textContent = state.inventory.gold;
        updateInvBody?.();
        renderSell(); // Re-render list to update counts
      };
      
      row.appendChild(txt);
      row.appendChild(btn);
      listDiv.appendChild(row);
    };

    let hasItems = false;

    // 1. Sell Consumables
    const cons = [
      { id:'potions', name:'Potion', price:5 },
      { id:'tonics', name:'Tonic', price:6 },
      { id:'antidotes', name:'Antidote', price:7 },
      { id:'lockpicks', name:'Lockpick', price:8 },
      { id:'bombs', name:'Bomb', price:15 },
      { id:'shields', name:'Std Shield', price:10 },
      { id:'warpStones', name:'Warp Stone', price:25 }
    ];
    cons.forEach(c => {
      const count = state.inventory[c.id]|0;
      if (count > 0) {
        hasItems = true;
        addSellItem(`${c.name} x${count}`, c.price, () => { state.inventory[c.id]--; });
      }
    });

    // 2. Sell Weapons (All of them)
    // Price = 50% of Buy Price (approx)
    const W_PRICES = { 'Shortsword':14, 'Claymore':21, 'Spear':18, 'Axe':19, 'Knuckle Duster':11, 'Shield':10 };
    
    for (const [wName, count] of Object.entries(state.inventory.weapons || {})) {
      if (count > 0) {
        hasItems = true;
        // Estimate price: Default 10g if unknown
        let baseP = W_PRICES[wName] || 15;
        if (wName.includes('Shield')) baseP = 12; // Shield fallback
        
        addSellItem(`${wName} x${count}`, baseP, () => {
           // Logic to handle selling equipped items safely
           const equipped = state.player.weapon?.name === wName;
           const stashedCnt = (state.inventory.stashed?.[wName]?.length) || 0;

           if (equipped && count <= 1 && stashedCnt === 0) {
              // Swap to Fists if selling last equipped weapon
              state.player.weapon = {name:'Fists',min:1,max:2,type:'hand',base:{min:1,max:2},dur:null,durMax:null};
              if (typeof recomputeWeapon === 'function') recomputeWeapon();
              if (typeof updateEquipUI === 'function') updateEquipUI();
              log(`Sold your last ${wName}. Equipped Fists.`);
           }
           
           state.inventory.weapons[wName]--;
           if (state.inventory.weapons[wName] <= 0) delete state.inventory.weapons[wName];
        });
      }
    }

    // --- 3. Sell Trinkets ---
    for (const [tName, count] of Object.entries(state.inventory.trinkets || {})) {
      if (count > 0) {
        hasItems = true;
        // Trinkets sell for 40g (flat rate)
        addSellItem(`${tName} x${count}`, 40, () => {
          state.inventory.trinkets[tName]--;
          if (state.inventory.trinkets[tName] <= 0) delete state.inventory.trinkets[tName];
        });
      }
    }

    if (!hasItems) {
      listDiv.innerHTML = '<div style="text-align:center; opacity:0.5; padding:20px;">You have nothing to sell.</div>';
    }
  }

  function renderGreeting(){
    setBackMode('hide');
    // Ensure button row is visible, list is hidden
    btnRow.style.display = 'flex';
    listDiv.style.display = 'none';
    
    msg.textContent = 'Hello adventurer, are you looking to buy or sell?';
    
    // Reset Buttons to Greeting Mode
    [btnA, btnB, btnC].forEach(b => { b.style.display=''; b.disabled=false; b.style.opacity=1; });
    
    btnA.textContent = 'Buy';
    btnA.onclick = () => { playNpcDialogue(NPC_DIALOGUE_URLS.merchant.buy); renderBuy(); };

    btnB.textContent = 'Sell';
    btnB.onclick = () => { playNpcDialogue(NPC_DIALOGUE_URLS.merchant.sell); renderSell(); };

    btnC.textContent = 'Leave';
    btnC.onclick = () => {
      playNpcDialogue(NPC_DIALOGUE_URLS.merchant.leave);
      modal.style.display='none';
      state._inputLocked = false;
      if (!state._pauseOpen) setMobileControlsVisible?.(true);
    };
  }

  // Public opener
  window.openMerchant = function openMerchant(){
    if (!modal) return;
    unlockCodex('Merchant');
    playNpcDialogue(NPC_DIALOGUE_URLS.merchant.interact);
    goldNow.textContent = state.inventory.gold|0;
    renderGreeting();
    modal.style.display = 'flex';
    state._inputLocked = true;
    setMobileControlsVisible?.(false);
  };
});


