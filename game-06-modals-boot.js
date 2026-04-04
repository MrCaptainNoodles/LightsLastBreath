// ===== Blacksmith modal wiring (repairs @ 2g per durability) =====
document.addEventListener('DOMContentLoaded', ()=>{
  const modal = document.getElementById('blacksmithModal');
  const bsMsg = document.getElementById('bsMsg');
  const bsGold= document.getElementById('bsGold');
  const b1 = document.getElementById('bsRepair1');
  const b5 = document.getElementById('bsRepair5');
  const bf = document.getElementById('bsRepairFull');

  let bsTarget = 'weapon'; // 'weapon' | 'shield'

function refreshBsUI(){
  const tgtW = document.getElementById('bsTargetWeapon');
  const tgtS = document.getElementById('bsTargetShield');

  const w  = state.player.weapon || {};
  const sh = state.player.shield || null;

  // Default target to something repairable if needed
  if (bsTarget === 'weapon' && !w.durMax && sh) bsTarget = 'shield';
  if (bsTarget === 'shield' && !sh && w.durMax) bsTarget = 'weapon';

  // Enable/disable target buttons based on availability
  if (tgtW) tgtW.disabled = !w.durMax;
  if (tgtS) tgtS.disabled = !sh;

  bsGold.textContent = (state.inventory.gold|0);

  let name, dur, max;
  if (bsTarget === 'shield'){
    name = sh ? (sh.name || SHIELD_NAME) : 'No Shield';
    dur = (sh?.dur|0);
    // FIX: Dynamic Max Durability for new shield types
    max = 20;
    if (name.includes('Buckler')) max = 15;
    else if (name.includes('Tower')) max = 35;
    else if (name.includes('Ancient')) max = 25;
  } else {
    name = w.name || '—';
    dur  = (w.dur|0);
    max  = (w.durMax|0);
  }

  if (!max){
    bsMsg.textContent = `Equipped: ${name}. This can’t be repaired.`;
    b1.disabled = b5.disabled = bf.disabled = true;
    return;
  }
  if (dur >= max){
    bsMsg.textContent = `Equipped: ${name} ${dur}/${max}. Already at full.`;
    b1.disabled = b5.disabled = bf.disabled = true;
    return;
  }

  const need = max - dur;
  // Cost scales: 2 base + 0.5 per floor. (Floor 10 = 7g/point, Floor 50 = 27g/point)
  const costPerPoint = Math.ceil(2 + (state.floor * 0.5)); 
  const costFull = need * costPerPoint;
  
  bsMsg.textContent = `Equipped: ${name} ${dur}/${max}. Repairs cost ${costPerPoint}g each. Full repair costs ${costFull}g.`;
  b1.disabled = (state.inventory.gold|0) < costPerPoint;
  b5.disabled = ((state.inventory.gold|0) < (costPerPoint * Math.min(5, need))) || need < 1;
  bf.disabled = (state.inventory.gold|0) < costFull;
}


function doRepair(points){
  const usingShield = (bsTarget === 'shield');
  let repairedToFull = false;
  let itemDur = 0;
  let itemMax = 0;
  let itemName = '';
  
  if (usingShield){
    const sh = state.player.shield;
    if (!sh) return;

    // FIX: Calculate correct Max for calculation
    let max = 20;
    const n = sh.name || SHIELD_NAME;
    if (n.includes('Buckler')) max = 15;
    else if (n.includes('Tower')) max = 35;
    else if (n.includes('Ancient')) max = 25;

    const need = Math.max(0, max - (sh.dur|0));
    if (need <= 0) return;
    const amt = Math.max(1, Math.min(points, need));
    const costPerPoint = Math.ceil(2 + (state.floor * 0.5));
    const cost = amt * costPerPoint;
    if ((state.inventory.gold|0) < cost){
      log('Not enough gold.');
      return;
    }
    // Perform Repair
    state.inventory.gold -= cost;
    sh.dur = (sh.dur|0) + amt;
    repairedToFull = sh.dur >= max;
    log(`Blacksmith repaired ${n} +${amt} for ${cost}g.`);
    itemName = n;
  } else {
    const w = state.player.weapon || {};
    if (!w.durMax) return;
    const need = Math.max(0, w.durMax - (w.dur|0));
    if (need <= 0) return;
    const amt  = Math.max(1, Math.min(points, need));
    const cost = amt * 2;
    if ((state.inventory.gold|0) < cost){ log('Not enough gold.'); return; }
    
    // Perform Repair
    state.inventory.gold -= cost;
    w.dur = (w.dur|0) + amt;
    repairedToFull = w.dur >= w.durMax;
    log(`Blacksmith repaired ${w.name} +${amt} for ${cost}g.`);
    itemName = w.name;
  }
  
  // --- NEW DIALOGUE LOGIC ---
  if (repairedToFull) {
    playNpcDialogue(NPC_DIALOGUE_URLS.blacksmith.fullrepair);
  } else {
    playNpcDialogue(NPC_DIALOGUE_URLS.blacksmith.partialrepair);
  }
  
unlockCodex('Blacksmith_Repair', true); // <--- TRACK REPAIR
  updateEquipUI?.(); updateInvBody?.(); refreshBsUI();
}


const tgtW = document.getElementById('bsTargetWeapon');
const tgtS = document.getElementById('bsTargetShield');
if (tgtW) tgtW.onclick = ()=>{ bsTarget='weapon'; refreshBsUI(); };
if (tgtS) tgtS.onclick = ()=>{ bsTarget='shield'; refreshBsUI(); };


  if (b1) b1.onclick = ()=>doRepair(1);
  if (b5) b5.onclick = ()=>doRepair(5);
  if (bf) bf.onclick = ()=>doRepair(999);

  // global open
 window.openBlacksmith = function openBlacksmith(){
  unlockCodex('Blacksmith'); // <--- ADD THIS
  playNpcDialogue(NPC_DIALOGUE_URLS.blacksmith.interact);

  refreshBsUI();
  modal.style.display = 'flex';

  // Lock player input while at the blacksmith
  state._inputLocked = true;

  setMobileControlsVisible(false);
};

});

document.addEventListener('DOMContentLoaded', ()=>{
  const modal   = document.getElementById('jesterModal');
  const msg     = document.getElementById('jesterMsg');
  const spinBtn = document.getElementById('jSpin');
  const doneBtn = document.getElementById('jDone');
  const closeBtn= document.getElementById('jBack');
  // (no local "spun" flag — rely on state.jesterSpun instead)

  drawJesterWheelCanvas(); // ✅ INSERT THIS TO INITIALLY DRAW THE WHEEL

  // Close button
if (closeBtn) {
  closeBtn.onclick = ()=>{
    playNpcDialogue(NPC_DIALOGUE_URLS.jester.leave);
    modal.style.display = 'none';
    state._inputLocked = false;
    if (!state._pauseOpen) setMobileControlsVisible?.(true);
  };
}

// Spin button
if (spinBtn) spinBtn.onclick = () => {
  if (state.jesterSpun) return;

  playNpcDialogue(NPC_DIALOGUE_URLS.jester.spin);

// In jesterModal wiring, inside spinBtn.onclick
  state.jesterSpun = true;
  spinBtn.disabled = true;

unlockCodex('Jester_Spin', true); // <--- TRACK SPIN

    const wheelCanvas = document.getElementById('jesterWheel');

    // 1) Spin to a random angle (so the result is visual-first)
    const baseTurns    = 25;                // Increased turns so it spins fast for 10s
    const extraDegrees = Math.random() * 360; // 0–359.999
    const finalDeg     = baseTurns * 360 + extraDegrees;

    // Override CSS transition to match the 10.6s audio length
    wheelCanvas.style.transition = "transform 10.6s ease-out";
    
    // Force browser reflow to ensure the transition takes hold
    wheelCanvas.getBoundingClientRect(); 
    
    wheelCanvas.style.transform = `rotate(${finalDeg}deg)`;

    // 2) Wait for the VISUAL animation to end (Syncs perfectly)
    const onSpinEnd = () => {
      wheelCanvas.classList.add('glow');

      const ctx = wheelCanvas.getContext('2d');
      const W = wheelCanvas.width, H = wheelCanvas.height;
      const centerX = W / 2, centerY = H / 2;
      const radius  = Math.min(W, H) / 2 - 10;

      // Normalize final rotation to [0, 360)
      const deg360 = ((finalDeg % 360) + 360) % 360;

      // Arrow is at 270° (straight up in canvas coords).
      // Convert that into wheel coordinates after rotation.
      const arrowInWheel = (270 - deg360 + 360) % 360;

      // 10 slices, each 36°
      const winningSlice = Math.floor(arrowInWheel / 36);

      // 3) Highlight the winning slice under the arrow
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      const startAngle = (2 * Math.PI / 10) * winningSlice;
      const endAngle   = startAngle + 2 * Math.PI / 10;
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = '#ffff00';
      ctx.fill();
      ctx.restore();

      // 4) Apply reward/punishment based on the color of that slice
if (winningSlice % 2 === 1) {
  // odd = green (your draw function alternates starting red at 0)
  state.player.hp = state.player.hpMax;
  state.inventory.gold = (state.inventory.gold|0) + 100;
  msg.textContent = "Lucky you!";
  playNpcDialogue(NPC_DIALOGUE_URLS.jester.win);
  log('[Jester] Landed on GREEN: healed & +100g.');
} else {
  // even = red
  state.player.hp = Math.max(1, Math.floor(state.player.hpMax * 0.05));
  msg.textContent = "Ha ha ha, better luck next time!";
  playNpcDialogue(NPC_DIALOGUE_URLS.jester.lose);
      log('[Jester] Landed on RED: HP dropped to 5%.');
    }

    updateBars?.();
    }; // End of onSpinEnd function

    // Attach the listener
    wheelCanvas.addEventListener('transitionend', onSpinEnd, { once: true });
  };


  // Done/Leave button
  if (doneBtn) doneBtn.onclick = ()=>{
  playNpcDialogue(NPC_DIALOGUE_URLS.jester.leave);
  modal.style.display = 'none';
  state._inputLocked = false;
  if (!state._pauseOpen) setMobileControlsVisible?.(true);
};

});

// NEW: Cartographer modal wiring
document.addEventListener('DOMContentLoaded', ()=>{
  const modal   = document.getElementById('cartographerModal');
  const msg     = document.getElementById('cartographerMsg');
  const buyBtn  = document.getElementById('cBuyMap');
  const doneBtn = document.getElementById('cDone');
  const closeBtn= document.getElementById('cBack');
  const goldNow = document.getElementById('cGoldNow');

  const mapCost = ()=> Math.max(15, 20 + (state.floor|0)*3);

  function renderCarto(){
    if (!modal) return;
    const cost = mapCost();
    if (goldNow) goldNow.textContent = state.inventory.gold|0;

    if (state.cartographerMapBought){
      if (msg) msg.textContent = "Already mapped. Follow the arrow to the stairs.";
      if (buyBtn){ buyBtn.disabled = true; buyBtn.textContent = "Map bought"; }
      return;
    }
    if (msg) msg.textContent = `For ${cost} gold, I will reveal the entire floor and mark the way down.`;
    if (buyBtn){ buyBtn.disabled = false; buyBtn.textContent = `Buy Map (${cost}g)`; }
  }

function close(){
  if (!modal) return;
  playNpcDialogue(NPC_DIALOGUE_URLS.cartographer.leave);
  modal.style.display = 'none';
  state._inputLocked = false;
  if (!state._pauseOpen) setMobileControlsVisible?.(true);
}

window.openCartographer = function openCartographer(){
  if (!modal) return;
  unlockCodex('Cartographer'); // <--- ADD THIS
  playNpcDialogue(NPC_DIALOGUE_URLS.cartographer.interact);
  renderCarto();
  modal.style.display = 'flex';
  state._inputLocked = true;
  setMobileControlsVisible?.(false);
};

// --- NEW: Cleric Wiring ---
(function(){
  const modal = document.getElementById('clericModal');
  const msg = document.getElementById('clericMsg');
  const buyBtn = document.getElementById('clBuyBless');
  const doneBtn = document.getElementById('clDone');
  const closeBtn = document.getElementById('clBack');
  const goldNow = document.getElementById('clGoldNow');

  function close(){
    if (modal && modal.style.display !== 'none') {
        playNpcDialogue(NPC_DIALOGUE_URLS.cleric.leave); // <--- Play Goodbye
        modal.style.display = 'none';
    }
    state._inputLocked = false;
    if (!state._pauseOpen) setMobileControlsVisible?.(true);
  }

window.openCleric = function(){
  if (!modal) return;
  unlockCodex('Cleric');
  unlockCodex('Cleric_Bless', true);
  playNpcDialogue(NPC_DIALOGUE_URLS.cleric.interact);
  if (goldNow) goldNow.textContent = state.inventory.gold|0;

  // --- NEW: Purge Idols Button ---
  const hasIdols = state.inventory.idols && Object.keys(state.inventory.idols).some(k => state.inventory.idols[k] > 0);

  if (hasIdols) {
      msg.textContent = "You carry cursed idols. I can cleanse them for 100 gold.";
      buyBtn.disabled = false;
      buyBtn.textContent = "Purge Idols (100g)";
      buyBtn.onclick = () => {
          if ((state.inventory.gold|0) < 100) {
              msg.textContent = "You lack the gold for this ritual.";
              return;
          }
          state.inventory.gold -= 100;
          state.inventory.idols = {}; // Wipe all idols
          SFX.spell();
          log("The Cleric destroys the cursed idols.");
          playNpcDialogue(NPC_DIALOGUE_URLS.cleric.purify);
          if (goldNow) goldNow.textContent = state.inventory.gold;
          msg.textContent = "Be clean, traveler.";
          buyBtn.disabled = true;
          buyBtn.textContent = "Cleansed";
          updateInvBody(); // Refresh inventory view
      };
      modal.style.display = 'flex';
      state._inputLocked = true;
      setMobileControlsVisible?.(false);
      return; // Exit function so we don't apply weapon/blessing logic
  }
  // -------------------------------

  const w = state.player.weapon;
    
    // --- NEW: Check for Cursed Weapon ---
    if (w && w.cursed) {
       msg.textContent = "I sense a dark binding on your weapon. I can purify it.";
       buyBtn.disabled = false;
       buyBtn.textContent = "Purify (100g)";
       
       // Override click handler for this specific case
       buyBtn.onclick = () => {
         if ((state.inventory.gold|0) < 100) {
           msg.textContent = "Purification requires a sacrifice of 100 gold.";
           return;
         }
         state.inventory.gold -= 100;
         
         // Remove curse properties
         delete w.cursed;
         delete w.curseType;
         // Note: We leave the high stats as a reward for surviving/paying!
         
         SFX.levelUp();
         playNpcDialogue(NPC_DIALOGUE_URLS.cleric.purify); // <--- Play Purify line
         log("The curse is lifted! The weapon is now yours to command.");
         close();
         updateEquipUI();
         updateInvBody();
         updateBars();
       };
    } 
    // Normal Blessing Logic
    else if (state.player.blessTicks > 0) {
       msg.textContent = "You are already walking in the light.";
       buyBtn.disabled = true;
       buyBtn.textContent = "Blessed";
    } else {
       msg.textContent = "The shadows are deep here. I can bless you for a price.";
       buyBtn.disabled = false;
       buyBtn.textContent = "Blessing (50g)";
       
       // Restore standard blessing handler
       buyBtn.onclick = ()=>{
         if ((state.inventory.gold|0) < 50) {
           msg.textContent = "The light is free, but my time is not. Come back with gold.";
           return;
         }
         state.inventory.gold -= 50;
         state.player.blessTicks = 50; 
         SFX.levelUp(); 
         spawnParticles(state.player.x, state.player.y, '#fbbf24', 12);
         log("You feel a holy power surround you! (+ATK, +DEF)");
         close();
         updateBars();
         draw();
       };
    }
    
    modal.style.display = 'flex';
    state._inputLocked = true;
    setMobileControlsVisible?.(false);
  };

  if (closeBtn) closeBtn.onclick = close;
  if (doneBtn) doneBtn.onclick = close;
  
  if (buyBtn) buyBtn.onclick = ()=>{
    if ((state.inventory.gold|0) < 50) {
      msg.textContent = "The light is free, but my time is not. Come back with gold.";
      return;
    }
    state.inventory.gold -= 50;
    state.player.blessTicks = 50; // Lasts 50 turns
    
    SFX.levelUp(); 
    playNpcDialogue(NPC_DIALOGUE_URLS.cleric.buy); // <--- Play Blessing line
    spawnParticles(state.player.x, state.player.y, '#fbbf24', 12);
    log("You feel a holy power surround you! (+ATK, +DEF)");
    
    close();
    updateBars();
    draw();
  };
})();
// --------------------------

  if (closeBtn) closeBtn.onclick = close;
  if (doneBtn)  doneBtn.onclick  = close;

if (buyBtn) buyBtn.onclick = ()=>{
  const cost = mapCost();
  if ((state.inventory.gold|0) < cost){
    if (msg) msg.textContent = "Come back when you can afford ink and parchment.";
    return;
  }

  state.inventory.gold = (state.inventory.gold|0) - cost;
  state.cartographerMapBought = true;
  state.cartographerMapActive = true;

  playNpcDialogue(NPC_DIALOGUE_URLS.cartographer.buy);
unlockCodex('Cartographer_Map', true); // <--- TRACK MAP PURCHASE
  cartographerRevealFloor();
  renderCarto();

  updateBars?.();
  draw?.();
  showBanner?.("A floor map is unrolled before you. The way down is marked.", 3200);
};

});


// Separate draw function you can place globally
function drawJesterWheelCanvas() {
  const canvas = document.getElementById('jesterWheel');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  // Use the canvas element's own size (from width/height attributes)
  const W = canvas.width;   // 180
  const H = canvas.height;  // 180

  const centerX = W / 2;
  const centerY = H / 2;
  const radius  = Math.min(W, H) / 2 - 8;

  const red   = '#bd2220';
  const green = '#22c55e';

  ctx.clearRect(0, 0, W, H);

  const sliceAngle = (Math.PI * 2) / 10;   // 10 equal slices

  for (let i = 0; i < 10; i++) {
    const startAngle = sliceAngle * i;
    const endAngle   = startAngle + sliceAngle;

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.closePath();

    // Even = red, odd = green  -> 5 of each, alternating
    ctx.fillStyle = (i % 2 === 0) ? red : green;
    ctx.fill();
  }
}



// Public opener
window.openJester = function openJester(){
  const modal = document.getElementById('jesterModal');
  if (!modal || state.jesterSpun) return;

  unlockCodex('Jester'); // <--- ADD THIS
  playNpcDialogue(NPC_DIALOGUE_URLS.jester.interact);

  msg = document.getElementById('jesterMsg');
  msg.textContent = 'Spin the wheel of fate! Land on green to win big, red means a big loss...';

  const wheel = document.getElementById('jesterWheel');
  wheel.classList.remove('glow');
  
  // Remove transition for instant reset
  wheel.style.transition = 'none'; 
  wheel.style.transform = 'rotate(0deg)';
  
  document.getElementById('jSpin').disabled = false;

  modal.style.display = 'flex';
  drawJesterWheelCanvas();   // ← ensure the wheel is visible
  state._inputLocked = true;
  setMobileControlsVisible?.(false);
};






function setMobileControlsVisible(on){
  const joy  = document.getElementById('joystick');
  const fabs = document.querySelector('.fabs');
  if (joy)  joy.style.display  = on ? '' : 'none';
  if (fabs) fabs.style.display = on ? '' : 'none';
}


document.addEventListener('click', (ev)=>{
  const t = ev.target.closest('[data-close]');
  if(!t) return;
  const sel = t.getAttribute('data-close');
  const modal = document.querySelector(sel);

  if (modal) {
    // 1. Audio feedback on close
    if (sel === '#blacksmithModal' && typeof playNpcDialogue === 'function') playNpcDialogue(NPC_DIALOGUE_URLS.blacksmith.leave);
    if (sel === '#merchantModal' && typeof playNpcDialogue === 'function') playNpcDialogue(NPC_DIALOGUE_URLS.merchant.leave);
    if (sel === '#jesterModal' && typeof playNpcDialogue === 'function') playNpcDialogue(NPC_DIALOGUE_URLS.jester.leave);
    if (sel === '#cartographerModal' && typeof playNpcDialogue === 'function') playNpcDialogue(NPC_DIALOGUE_URLS.cartographer.leave);

    modal.style.display='none';

    // 2. Unlock controls for ALL interaction modals
    // This list now includes Jester and Cartographer so you don't get stuck.
    const lockingModals = [
      '#blacksmithModal', 
      '#merchantModal', 
      '#jesterModal', 
      '#cartographerModal', 
      '#spellUpModal'
    ];

    if (lockingModals.includes(sel)) {
      state._inputLocked = false;
    }

    // 3. Restore mobile controls (unless paused)
    if (!state._pauseOpen) {
      if (typeof setMobileControlsVisible === 'function') setMobileControlsVisible(true);
    }
    
    // 4. Tutorial specific logic (keeps your existing tutorial flow working)
    if (sel === '#invModal' && state.gameMode === 'tutorial') {
      if (state.tutorialStep === 0 && !state._tutMoveDone) {
        showBanner("Tutorial: Move first — press W A S D (or ↑ ↓ ← →) once each.", 2200);
      }
      if (state.tutorialStep === 1) {
        hideBanner();
        state.tutorialStep = 2;
        say("Nice. Now press P to open your Spell Book.");
      }
    }
    if (sel === '#spellModal' && state.gameMode === 'tutorial') {
      if (state.tutorialStep === 3) {
        hideBanner();
        state.tutorialStep = 4;
        showBanner("Next: pick up the arrows on the floor. Then face the training rat and press B to shoot.", 999999);
      }
    }
  }
});





const invModal=document.getElementById('invModal');
const spellModal=document.getElementById('spellModal');
document.querySelectorAll('[data-close]:not(#mBack)')
  .forEach(b => b.addEventListener('click', e => {
    const sel = e.target.dataset.close;
    if (sel) {
      const modal = document.querySelector(sel);
      if (modal) {
        modal.style.display = 'none';

        // Tutorial (new Step 3): if we just closed the inventory via its Close button
if (sel === '#invModal' && state.gameMode === 'tutorial') {

  // movement safeguard
  if (state.tutorialStep === 0 && !state._tutMoveDone) {
    showBanner("Tutorial: Move first — press W A S D (or ↑ ↓ ← →) once each.", 2200);
  }

  // Step 3 advancement: close Inventory -> prompt Spell Book
  if (state.tutorialStep === 1) {
    hideBanner();
    state.tutorialStep = 2;
    say("Nice. Now press P to open your Spell Book.");
  }
}

// Tutorial (new Step 4): if we just closed the spell book via its Close button
if (sel === '#spellModal' && state.gameMode === 'tutorial') {
  if (state.tutorialStep === 3) {
    hideBanner();
    state.tutorialStep = 4;
    showBanner("Next: pick up the arrows on the floor. Then face the training rat and press B to shoot.", 999999);
  }
}


        // If we just closed merchant or blacksmith, unlock controls
        if (sel === '#blacksmithModal' || sel === '#merchantModal') {
          state._inputLocked = false;
        }

        if (!state._pauseOpen) {
          setMobileControlsVisible(true);
        }
      }
    }
  }));



document.getElementById('btnInv').onclick=()=>{ updateInvBody(); invModal.style.display='flex'; setMobileControlsVisible(false); }
document.getElementById('btnSpells').onclick=()=>{ updateSpellBody(); spellModal.style.display='flex'; setMobileControlsVisible(false); }



function updateInvBody(){
  const b = document.getElementById('invBody');
  const tab = (state.ui && state.ui.invTab) || 'items';

  // Tabs header
  b.innerHTML = `
    <div class="row" style="gap:6px; margin-bottom:8px;">
      <button class="btn" id="tabItems" ${tab==='items' ? 'disabled':''}>Items</button>
      <button class="btn" id="tabTrinkets" ${tab==='trinkets' ? 'disabled':''}>Trinkets</button>
      <button class="btn" id="tabShield" ${tab==='shield' ? 'disabled':''}>Shields</button>
      <button class="btn" id="tabWeapons" ${tab==='weapons' ? 'disabled':''}>Weapons</button>
    </div>
    <div id="invSection"></div>
  `;
  const sec = b.querySelector('#invSection');

  // ---- Trinkets tab ----
  function renderTrinkets(){
    sec.innerHTML = '';
    // 1. Equipped
    if(state.player.trinket){
      const t = state.player.trinket;
      const row = document.createElement('div');
      row.className = 'row'; row.style.justifyContent = 'space-between';
      row.innerHTML = `<span style="color:#facc15; font-weight:bold;">${t.name}</span> (Equipped)`;
      const btn = document.createElement('button'); btn.className='btn'; btn.textContent='Unequip';
      btn.onclick=()=>{
        // Revert stats
        if(t.name==='Ring of Haste'){ state.player.staminaMax--; state.player.stamina = Math.min(state.player.stamina, state.player.staminaMax); updateBars(); }
        // Return to inv
        state.inventory.trinkets = state.inventory.trinkets||{};
        state.inventory.trinkets[t.name] = (state.inventory.trinkets[t.name]||0)+1;
        state.player.trinket = null;
        updateInvBody();
      };
      row.appendChild(btn); sec.appendChild(row);
    }
    // 2. Inventory
    const list = state.inventory.trinkets||{};
    for(const [name,count] of Object.entries(list)){
      if(count<=0) continue;
      const row = document.createElement('div');
      row.className = 'row'; row.style.justifyContent = 'space-between';
      row.innerHTML = `${name} x${count}`;
      const btn = document.createElement('button'); btn.className='btn'; btn.textContent='Equip';
      btn.onclick=()=>{
        // 1. Swap: Auto-Unequip current if exists
        if(state.player.trinket){
          const old = state.player.trinket;
          // Revert stats of the OLD item
          if(old.name==='Ring of Haste'){ state.player.staminaMax--; state.player.stamina = Math.min(state.player.stamina, state.player.staminaMax); updateBars(); }
          // Return OLD to inventory
          state.inventory.trinkets[old.name] = (state.inventory.trinkets[old.name]||0)+1;
        }

        // 2. Equip the NEW item
        state.inventory.trinkets[name]--;
        state.player.trinket = {name};
        
        // Apply stats of the NEW item
        if(name==='Ring of Haste'){ state.player.staminaMax+=2; state.player.stamina+=2; updateBars(); }
        if(name==="Warrior's Ring"){ state.globalWeaponFlatBonus = (state.globalWeaponFlatBonus||0) + 1; recomputeWeapon(); }
        
        log(`Equipped ${name}.`);
        updateInvBody();
      };
      row.appendChild(btn); sec.appendChild(row);
    }
    if(sec.innerHTML==='') sec.innerHTML = '<div>(none)</div>';
  }

  // ---- Items tab ----
  function renderItems(){
  sec.innerHTML = `
    <div class="row" style="justify-content:space-between"><div>Gold x${state.inventory.gold||0}</div></div>
    <div class="row" style="justify-content:space-between; border-bottom:1px solid var(--chipBorder); padding-bottom:8px; margin-bottom:8px;">
      <div>Lockpicks x${state.inventory.lockpicks}</div>
    </div>

    <div class="row" style="justify-content:space-between"><div>Potions x${state.inventory.potions}</div><button class="btn" id="btnUsePot" ${state.inventory.potions ? '' : 'disabled'}>Use</button></div>
    <div class="row" style="justify-content:space-between"><div>Tonics x${state.inventory.tonics}</div><button class="btn" id="btnUseTon" ${state.inventory.tonics ? '' : 'disabled'}>Use</button></div>
    <div class="row" style="justify-content:space-between"><div>Antidotes x${state.inventory.antidotes || 0}</div><button class="btn" id="btnUseAnt" ${state.inventory.antidotes ? '' : 'disabled'}>Use</button></div>
    
    <div style="margin-top:8px; padding-top:8px; border-top:1px solid var(--chipBorder); opacity:0.9; font-size:12px; font-weight:800;">COMBAT ITEMS</div>
    <div class="row" style="justify-content:space-between"><div>Bombs x${state.inventory.bombs || 0}</div><button class="btn" id="btnUseBomb" ${state.inventory.bombs ? '' : 'disabled'}>Throw</button></div>
    <div class="row" style="justify-content:space-between"><div>Warp Stones x${state.inventory.warpStones || 0}</div><button class="btn" id="btnUseWarp" ${state.inventory.warpStones ? '' : 'disabled'}>Warp</button></div>
  `;
  sec.querySelector('#btnUsePot')?.addEventListener('click', usePotion);
  sec.querySelector('#btnUseTon')?.addEventListener('click', useTonic);
  sec.querySelector('#btnUseAnt')?.addEventListener('click', useAntidote);
  
  // Wire new buttons
  sec.querySelector('#btnUseBomb')?.addEventListener('click', useBomb);
  sec.querySelector('#btnUseWarp')?.addEventListener('click', useWarpStone);

  // --- NEW: Render Cursed Idols ---
  if (state.inventory.idols) {
      const d = document.createElement('div');
      d.style.cssText = 'margin-top:10px; padding-top:8px; border-top:1px solid var(--chipBorder); font-size:12px; font-weight:800; color:#ef4444;';
      d.textContent = 'CURSED IDOLS';
      sec.appendChild(d);
      for(const [name, count] of Object.entries(state.inventory.idols)){
          if(count > 0){
              const r = document.createElement('div');
              r.style.cssText = 'display:flex; justify-content:space-between; margin-top:4px; font-size:13px;';
              r.innerHTML = `<span>${name}</span> <span style="opacity:0.7">x${count}</span>`;
              sec.appendChild(r);
          }
      }
  }
}


  // ---- Shield tab ----
function renderShield(){
    sec.innerHTML = '';
    
    // Helper to render a shield row
    const renderRow = (name, count, isEquipped) => {
        const row = document.createElement('div');
        row.className = 'row';
        row.style.justifyContent = 'space-between';
        
        const dur = isEquipped && state.player.shield ? ` (Dur ${state.player.shield.dur})` : '';
        
        // Calculate Block %
        let blockChance = '20%';
        if (name.includes('Buckler')) blockChance = '15%';
        else if (name.includes('Tower')) blockChance = '35%';
        else if (name.includes('Ancient')) blockChance = '25%';

        const left = document.createElement('div');
        const countTxt = isEquipped ? (count > 0 ? `x${count} (1 Equipped)` : `(Equipped)`) : `x${count}`;
        
        // Green text if equipped
        const nameHtml = isEquipped 
            ? `<span style="color:#4ade80; font-weight:bold;">${name}</span>` 
            : name;

        left.innerHTML = `${nameHtml} ${countTxt} <span style="opacity:0.7; font-size:12px;">(${blockChance} Block)${dur}</span>`;
        
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.textContent = isEquipped ? 'Unequip' : 'Equip';
        btn.onclick = () => { isEquipped ? unequipShield() : equipShield(name); };
        
        row.append(left, btn);
        sec.appendChild(row);
    };

    // 1. Render Currently Equipped Shield (if it exists)
    const currentName = state.player.shieldName;
    if (currentName) {
        // If it's a generic "Standard", handle it
        if (currentName === 'Standard') {
            const count = state.inventory.shields|0;
            renderRow('Standard Shield', count, true);
        } 
        // If it's a named shield (Tower, etc.)
        else {
            const count = state.inventory.weapons[currentName] || 0;
            renderRow(currentName, count, true);
        }
    }

    // 2. Render Inventory Shields (Standard)
    // Only if NOT equipped (otherwise handled above)
    if (state.inventory.shields > 0 && currentName !== 'Standard') {
        renderRow('Standard Shield', state.inventory.shields, false);
    }

    // 3. Render Inventory Shields (Named)
    // Only if NOT equipped (otherwise handled above)
    for (const [name, count] of Object.entries(state.inventory.weapons || {})) {
        if (getWeaponType(name) !== 'shield') continue;
        if (name === currentName) continue; // Already rendered as equipped
        renderRow(name, count, false);
    }

    if (sec.innerHTML === '') sec.innerHTML = '<div>(none)</div>';
    
    const tip = document.createElement('div');
    tip.style.opacity = 0.8;
    tip.style.marginTop = '15px';
    tip.style.borderTop = '1px solid rgba(255,255,255,0.1)';
    tip.style.paddingTop = '5px';
    tip.textContent = 'Shields block damage based on their Block Chance.';
    sec.appendChild(tip);
  }

  // ---- Weapons tab ----
  function renderWeapons(){
    sec.innerHTML = '<div id="weaponsList"></div>';
    const wDiv = sec.querySelector('#weaponsList');
    const entries = Object.entries(state.inventory.weapons);

    // Helper to get type safely (handles Key of Destiny + Affixes)
    const getType = (name) => {
      if (name === 'Key of Destiny') return 'one';
      // FIX: Force anything containing "Shield" to be type 'shield'
      if (name.includes('Shield')) return 'shield';
      return weaponStatsFor(name)?.type || 'hand';
    };

    // Sort by Skill Name so groups stay together
    entries.sort((a, b) => {
      const skillA = typeNice(getType(a[0]));
      const skillB = typeNice(getType(b[0]));
      return skillA.localeCompare(skillB);
    });

    if (!entries.length) {
      wDiv.innerHTML = '<div>(none)</div>';
      return;
    }
    
    wDiv.innerHTML = '';
    let lastSkill = null; // Tracks the current group header

    for (const [name,count] of entries) {
      // --- NEW: Header Logic ---
      const wType = getType(name); 
      
      // --- FIX: Hide Shields from Weapon Tab ---
      if (wType === 'shield') continue;
      // ---------------------------------------

      const skillLabel = typeNice(wType); // e.g. "One-Handed"

      if (skillLabel !== lastSkill) {
        const h = document.createElement('div');
        h.style.cssText = 'color:#f9d65c; font-weight:800; font-size:12px; text-transform:uppercase; margin:10px 0 4px 0; border-bottom:1px solid rgba(255,255,255,0.1); opacity:0.8;';
        h.textContent = skillLabel;
        wDiv.appendChild(h);
        lastSkill = skillLabel;
      }
      // ------------------------

      const row = document.createElement('div');
      row.className = 'row';
      row.style.justifyContent = 'space-between';

      const left = document.createElement('div');
      
      // Determine stats: Use ACTUAL equipped stats (including Omen buffs to base) if equipped
      const isEquipped = state.player.weapon && state.player.weapon.name === name;
      let ws;
      
      if (isEquipped && state.player.weapon.base) {
          // Use the live modified base stats from the player object
        ws = { ...state.player.weapon.base, type: state.player.weapon.type };
    } else {
// -------------------- START OF FIX BLOCK --------------------
        // Check for 'Key of Destiny' or default to standard stats lookup
        if (name === 'Key of Destiny') {
            // Hardcode base stats for Key of Destiny when unequipped
            ws = { min: 5, max: 7, type: 'one' }; 
        } else {
            // Use the template stats for unequipped items (will return null for 'Key of Destiny')
            ws = weaponStatsFor(name) || (name === 'Fists' 
                ? { min: 1, max: 2, type: 'hand' } 
                : { min: 1, max: 1, type: wType });
        }
// -------------------- END OF FIX BLOCK --------------------
    }

// --- FIX: Include Global Omen Bonus ---
const flat = state.globalWeaponFlatBonus || 0;
const bonus = skillDamageBonus(ws.type) + flat;
// --------------------------------------
const pMin  = ws.min + bonus;
const pMax  = ws.max + bonus;

// --- NEW: Apply Floor Modifiers to Display ---
let dMin = pMin, dMax = pMax;
let dStyle = ''; 
let dNote  = '';

if (state.floorEffect === 'AntiMagic') {
    if (wType === 'staff') {
        dStyle = 'color:#f87171; text-decoration:line-through;'; // Red + Strike
        dNote = ' (SILENCED)';
    } else {
        dMin = Math.ceil(dMin * 1.5);
        dMax = Math.ceil(dMax * 1.5);
        dStyle = 'color:#4ade80; font-weight:bold;'; // Green (Buff)
    }
} else if (state.floorEffect === 'ArcaneFlux') {
    if (wType === 'staff') {
        dMin = Math.ceil(dMin * 1.5);
        dMax = Math.ceil(dMax * 1.5);
        dStyle = 'color:#4ade80; font-weight:bold;'; // Green (Buff)
    } else {
        dMin = Math.max(1, Math.ceil(dMin * 0.25));
        dMax = Math.max(1, Math.ceil(dMax * 0.25));
        dStyle = 'color:#f87171; font-weight:bold;'; // Red (Nerf)
    }
}
// ---------------------------------------------

const durTxt = (isEquipped && Number.isFinite(state.player.weapon.durMax))
  ? ` — Dur ${state.player.weapon.dur}/${state.player.weapon.durMax}` : '';

// --- NEW: Comparison Logic (Updated to use modified values) ---
let diffHTML = '';
if (!isEquipped) {
  const cur = state.player.weapon; // Note: 'cur' stats in state are technically raw, but we want to compare apples to apples
  
  // Recalculate equipped effective dmg for fair comparison
  let curMin = cur.min, curMax = cur.max;
  const curIsStaff = (cur.type === 'staff');

  if (state.floorEffect === 'ArcaneFlux') {
      const mult = curIsStaff ? 1.5 : 0.25;
      curMin = Math.ceil(curMin * mult); curMax = Math.ceil(curMax * mult);
  } else if (state.floorEffect === 'AntiMagic') {
      const mult = curIsStaff ? 0 : 1.5; // 0 effectively handles silence for math
      curMin = Math.ceil(curMin * mult); curMax = Math.ceil(curMax * mult);
  }
  
  const curAvg = (curMin + curMax) / 2;
  const rowAvg = (dMin + dMax) / 2;
  
  const diff = rowAvg - curAvg;
  if (diff > 0) diffHTML = ` <span style="color:#4ade80; font-weight:bold;">(+${diff.toFixed(1)})</span>`;
  else if (diff < 0) diffHTML = ` <span style="color:#f87171; font-weight:bold;">(${diff.toFixed(1)})</span>`;
  else diffHTML = ` <span style="color:#9ca3af;">(=)</span>`;
}

left.innerHTML = `${name} x${count} — <span style="${dStyle}">Dmg ${dMin}–${dMax}${dNote}</span>${durTxt}${diffHTML}`;// -----------------------------


      const btn = document.createElement('button');
      btn.className = 'btn';
      
      // --- NEW: Cursed Logic ---
      const curWep = state.player.weapon;
      if (curWep && curWep.cursed) {
        // If we are currently holding a cursed weapon...
        if (isEquipped) {
          btn.textContent = "BOUND";
          btn.disabled = true;
          btn.style.color = "#ef4444"; // Red text
          btn.title = "Visit a Cleric to remove this curse.";
        } else {
          // Cannot equip other things while cursed
          btn.textContent = "Equip";
          btn.disabled = true;
          btn.style.opacity = "0.5";
        }
      } else {
        // Normal behavior
        btn.textContent = isEquipped ? 'Unequip' : 'Equip';
      }
      // --------------------------

      // Hide button when you truly have zero copies (keeps row but disables action)
      const stashCount = (state.inventory.stashed?.[name]?.length) || 0;
      const hasCopies  = (name === 'Fists') || (count && count > 0) || (stashCount > 0);
      if (!hasCopies && !isEquipped) {
        left.style.opacity = 0.6;
        row.append(left);
        wDiv.appendChild(row);
        continue;
      }

      btn.addEventListener('click', ()=>{
        const currentlyEquipped = state.player.weapon && state.player.weapon.name === name;
        if (currentlyEquipped){
          if (!state.inventory.stashed) state.inventory.stashed = {};
          const cur = state.player.weapon;
          if (Number.isFinite(cur?.durMax) && cur.dur > 0){
            (state.inventory.stashed[cur.name] ||= []).push({ ...cur, base: { ...cur.base } });
          }
          state.player.weapon = {name:'Fists', min:1, max:2, type:'hand', base:{min:1,max:2}, dur:null, durMax:null};
          recomputeWeapon(); updateEquipUI(); log(`Unequipped ${name}.`); updateInvBody();
         } else {
          equipWeaponByName(name);

          // >>> Tutorial: after equipping the Shortsword, move to next step
          if (state.gameMode === 'tutorial' &&
              state.tutorialStep === 2 &&
              name === 'Shortsword') {
            state.tutorialStep = 3;
            say("Nice. Now attack a rat with SPACE.");
          }
          // <<<

          log(`Equipped ${name}.`);
          updateInvBody();
        }
      });

      row.append(left, btn);
      wDiv.appendChild(row);
    }
  }

  // Render selected tab
  if (tab==='items')      renderItems();
  else if (tab==='shield')renderShield();
  else                    renderWeapons();

  // Wire tabs
  b.querySelector('#tabItems')  ?.addEventListener('click', ()=>{ state.ui.invTab='items';   updateInvBody(); });
  b.querySelector('#tabShield') ?.addEventListener('click', ()=>{ state.ui.invTab='shield';  updateInvBody(); });
  b.querySelector('#tabWeapons')?.addEventListener('click', ()=>{ state.ui.invTab='weapons'; updateInvBody(); });
  b.querySelector('#tabTrinkets')?.addEventListener('click', ()=>{ state.ui.invTab='trinkets'; updateInvBody(); });

  if (tab==='trinkets') renderTrinkets();
}


// --- NEW: Consumable Logic (Bomb & Warp Stone) ---
function useBomb(){
  if ((state.inventory.bombs|0) > 0) {
    state.inventory.bombs--;
    SFX.weaponBreak(); // FIX: Explosion sound instead of stairs
    
    // --- FIX: Throw 3 tiles in facing direction ---
    const range = 3;
    const dirs = {up:[0,-1], down:[0,1], left:[-1,0], right:[1,0]};
    // Default to down if facing is undefined
    const [dx, dy] = dirs[state.player.facing || 'down']; 
    
    const targetX = state.player.x + (dx * range);
    const targetY = state.player.y + (dy * range);
    // ----------------------------------------------

    // 3x3 Explosion centered on targetX, targetY
    const rad = 1; 
    let hitCount = 0;
    for(let y = -rad; y <= rad; y++){
      for(let x = -rad; x <= rad; x++){
        const tx = targetX + x;
        const ty = targetY + y;
        
        // Visuals
        spawnFloatText("💥", tx, ty, '#ff0000');
        spawnParticles(tx, ty, '#f97316', 6); // Fire
        spawnParticles(tx, ty, '#4b5563', 4); // Smoke
        
        // Damage Enemy
        const e = enemyAt(tx, ty);
        if (e) {
           const dmg = 10 + Math.floor(state.floor * 1.5);
           e.hp -= dmg;
           spawnFloatText(dmg, e.x, e.y, '#ff0000');
           if (e.hp <= 0) {
             
             // --- FIX: Depth 50 Boss Cutscene Checks ---
             if (state.floor === 50 && e.boss) {
                // Phase 1 -> Phase 2
                if (e.type === 'Clone' && !state.flags.depth50Phase2) {
                   runDepth50Phase2(e); 
                   return; // Stop here, let the cutscene handle the rest
                }
                // Phase 2 -> Outro
                if (e.type === 'Mad King' && !state.flags.depth50Done) {
                   runDepth50Outro(e); 
                   return; // Stop here, let the cutscene handle the rest
                }
             }
             // ------------------------------------------

             state.enemies = state.enemies.filter(en => en !== e);
             state.run.kills++;
             
             // --- FIX: Trigger Stairs if Boss ---
             if (e.boss) {
                spawnBossStairs(e.x, e.y);
                log("The explosion clears the path!");
             }
             // ----------------------------------
             
             // --- FIX: Award Player XP Only (No Skill XP) ---
             state.player.xp += (e.xp || 1);
             
             // Check for Level Up
             while(state.player.xp >= state.player.next){
               state.player.xp -= state.player.next;
               state.player.level++;
               state.player.next = Math.floor(state.player.next * 1.30); 
               
               // Trigger Level Up UI
               state._inputLocked = true;
               if (typeof setMobileControlsVisible === 'function') setMobileControlsVisible(false);
               const m = document.getElementById('lvlupModal');
               if(m) m.style.display = 'flex';
               SFX.levelUp();
             }
             // -----------------------------------------------
           }
           hitCount++;
        }
      }
    }
log(`You throw a bomb! Hit ${hitCount} foes.`);
    
    // Force close inventory to show the explosion
    const m = document.getElementById('invModal');
    if (m && m.style.display !== 'none') {
      m.style.display = 'none';
      if (!state._pauseOpen) setMobileControlsVisible?.(true);
    }

    updateInvBody();
    
// --- TUTORIAL Step 11 (Bomb) ---
    if (state.gameMode === 'tutorial' && state.tutorialStep === 11) {
       state.tutorialStep = 12;
       // Spawn Lockpicks
       state.pickups['10,42'] = {kind:'lockpicks', payload:3};
       state.tiles[42][10]=5;
       
       hideBanner();
       showBanner(`Step 12: Pickup Lockpicks. Unlock the Door below (${getInputName('interact')}). Note: It may fail!`, 999999);
    }
    // ----------------------------

    draw();
    enemyStep(); 
  }
}

function useWarpStone(){
  if ((state.inventory.warpStones|0) > 0) {
    state.inventory.warpStones--;
    SFX.spell();
    
    // Find random safe spot
    const spot = findFreeFloorTile(5); // Minimum 5 tiles away
    if (spot) {
      state.player.x = spot.x;
      state.player.y = spot.y;
      // Snap visuals instantly
      state.player.rx = spot.x; state.player.ry = spot.y; 
      
      log("You warp through the ether!");
      spawnFloatText("WARP", state.player.x, state.player.y, '#00ffff');
    } else {
      log(" The warp fizzles...");
    }
    
    updateInvBody();
    draw();
    enemyStep();
  }
}

// (Original Potion function remains, just ensuring we sit next to it)
function usePotion(){
  // --- NEW: Idol of War Curse ---
  if (state.inventory.idols?.['Idol of War']) {
      log("Idol of War forbids healing!");
      return;
  }
  if (state.inventory.potions > 0) {
    state.inventory.potions--;
    const before = state.player.hp|0;
    let gain = Math.max(1, Math.round(state.player.hpMax * POTION_PCT));
    
    // --- NEW CODE: Check for Poison Debuff ---
    if (state.player.poisoned) {
      gain = Math.max(1, Math.floor(gain / 2)); // Halve the healing power
      log(`The poison saps the potion's power.`);
    }
    // --- END NEW CODE ---

    state.player.hp = clamp(before + gain, 0, state.player.hpMax);
   const healed = state.player.hp - before;
    spawnFloatText("+" + healed, state.player.x, state.player.y, '#0f0'); 
    SFX.drink();
    
    // --- NEW: Record heal for Shadow ---
    state.lastPlayerAction = { type: 'heal', amount: healed };
    updateBars();
    log(`Drank a potion (+${healed} HP).`);

    // --- TUTORIAL Step 7 (Potion Part) ---
    if (state.gameMode === 'tutorial' && state.tutorialStep === 7) {
       state._tutProgress['potion'] = true;
       checkStep7Completion();
    }
    // -------------------------------------

    updateInvBody();
    draw();
  }
}

// --- Helper for Step 7 ---
function checkStep7Completion() {
   if (state._tutProgress['antidote'] && state._tutProgress['potion']) {
      state.tutorialStep = 8;
      // Spawn Arrows ONLY at Y=26
      state.pickups['11,26'] = {kind:'arrows', payload:10};
      state.tiles[26][11]=5;
      
      hideBanner();
      showBanner(`Step 8: Pickup Arrows. Face the Rat and press (${getInputName('bow')}) to shoot.`, 999999);
   }
}

function useTonic(){
  if (state.inventory.tonics > 0) {
    state.inventory.tonics--;
    const before = state.player.mp|0;
    const gain   = Math.max(1, Math.round(state.player.mpMax * TONIC_PCT));
    state.player.mp = clamp(before + gain, 0, state.player.mpMax);
    const restored = state.player.mp - before;

    SFX.drink();
    updateBars();
    log(`Used a tonic (+${restored} MP).`);
    
    // --- TUTORIAL Step 10 (Tonic) ---
    if (state.gameMode === 'tutorial' && state.tutorialStep === 10) {
       state.tutorialStep = 11;
       // Spawn Bomb
       state.pickups['10,40'] = {kind:'bomb', payload:1};
       state.tiles[40][10]=5;
       hideBanner();
       showBanner(`Step 11: Pickup Bomb. Press (${getInputName('bomb')}) to throw it.`, 999999);
    }

    updateInvBody();
    draw();
  }
}


function useAntidote(){
  if (state.inventory.antidotes > 0) {
    state.inventory.antidotes--;
    if (state.player.poisoned) { state.player.poisoned = false; state.player.poisonTicks = 0; }
    SFX.drink();;
    updateBars();
    log('You use an antidote. The poison is cured.');
    
    // --- TUTORIAL Step 7 (Antidote Part) ---
    if (state.gameMode === 'tutorial' && state.tutorialStep === 7) {
       state._tutProgress['antidote'] = true;
       checkStep7Completion();
    }
    // ---------------------------------------

    updateInvBody();
    draw();
  }
}


function updateSpellBody(){
  const b = document.getElementById('spellBody');
  if(!state.spells.length){ b.innerHTML = '<div>No spells learned.</div>'; return; }
  b.innerHTML = '';
  state.spells.forEach((s)=>{
    const row = document.createElement('div');
    row.className = 'row';
    row.style.justifyContent = 'space-between';

    const left = document.createElement('div');
    const up = (state.spellUpgrades && state.spellUpgrades[s.name]) || { dmg:0, range:0 };
    const st = getSpellStats(s.name); // use tiered stats for ALL spells (incl. Heal)
    
    // --- NEW: Spell Floor Modifiers ---
    let sMin = st.min, sMax = st.max;
    let sStyle = "";
    let sNote = "";

    if (state.floorEffect === 'ArcaneFlux') {
        sMin = Math.ceil(sMin * 1.5);
        sMax = Math.ceil(sMax * 1.5);
        sStyle = "color:#4ade80; font-weight:bold;"; // Green
    } else if (state.floorEffect === 'AntiMagic') {
        sNote = " (SILENCED)";
        sStyle = "color:#f87171; text-decoration:line-through;"; // Red + Strike
    }
    // ----------------------------------

    if (s.name === 'Heal'){
      const pct = Math.round((st.pct || 0) * 100);
      // Heal is usually unaffected by damage flux, but blocked by AntiMagic
      if (state.floorEffect === 'AntiMagic') {
          left.innerHTML = `${s.name} Lv${s.tier||1} — <span style="${sStyle}">SILENCED</span>`;
        } else {
          // Calculate flat amount for clarity
          const flat = Math.round(state.player.hpMax * (st.pct || 0));
          left.textContent = `${s.name} Lv${s.tier||1} — ${st.cost} MP — Heals ${pct}% (${flat} HP)`;
        }
    } else {
      left.innerHTML = `${s.name} Lv${s.tier||1} — ${st.cost} MP — <span style="${sStyle}">${sMin}–${sMax} DMG${sNote}</span> — Range ${st.range}`;
    }

    const btn = document.createElement('button');
    btn.className='btn';
    const isEquipped = state.equippedSpell && state.equippedSpell.name===s.name;
    btn.textContent = isEquipped ? 'Unequip' : 'Equip';
    btn.onclick = ()=>{
      const isEquipped = state.equippedSpell && state.equippedSpell.name === s.name;
      if (isEquipped){
        state.equippedSpell = null;
        log(`Unequipped ${s.name}.`);
      }else{
        state.equippedSpell = s;
        log(`Equipped ${s.name}.`);
      }
      updateEquipUI();
      updateSpellBody();
    };

    row.append(left, btn);
    b.appendChild(row);
  });
}



// ---- Level-up scaling helpers ----
function dangerFactor() {
  // Scales with floor; boss floors (every 10th) get a bump
  const base = 1 + (state.floor - 1) * 0.12;   // +12% per floor
  const bossBump = (state.floor % 10 === 0) ? 0.25 : 0; // +25% on boss floors
  return Math.max(1, base + bossBump);
}

function levelHpGain() {
  const L = state.player.level; // current level (pre-gain)
  // FIX: Removed floor multiplier and dangerFactor to prevent exponential scaling
  const raw = 5 + 0.2 * L; 
  return Math.max(3, Math.round(raw));
}

function levelMpGain() {
  const L = state.player.level;
  const magicLvl = (state.skills?.magic?.lvl || 1);
  const casterBias = Math.min(2, Math.floor(magicLvl / 3)) * 0.5; 
  // FIX: Flattened scaling
  const raw = 5 + 0.2 * L + casterBias;
  return Math.max(2, Math.round(raw)); 
}

// --- NEW: Stamina Scaling ---
function levelStamGain() {
  const L = state.player.level;
  // FIX: Constant small growth
  const raw = 5 + 0.2 * L;
  return Math.max(2, Math.round(raw));
}


// ====== Level Up choice modal (HP / MP / Stamina) ======
const lvlupModal = document.getElementById('lvlupModal');
const btnHP      = document.getElementById('btnHP');
const btnMP      = document.getElementById('btnMP');
const btnStam    = document.getElementById('btnStam'); // <--- NEW

function openLevelUpModal(){
  if (!lvlupModal) return;
  
  // --- FIX: Reset the title so it doesn't say "Golden Well" ---
  const t = lvlupModal.querySelector('.title');
  if(t) t.innerText = "Level Up!";
  // ------------------------------------------------------------

  lvlupModal.style.display = 'flex';
  state._inputLocked = true;

  // hide mobile controls while choosing
  setMobileControlsVisible?.(false);
}
window.openLevelUpModal = openLevelUpModal;

if (btnHP){
  btnHP.onclick = ()=>{
    const inc = (typeof levelHpGain === 'function') ? levelHpGain() : 5;
    state.player.hpMax += inc;

    const before = state.player.hp|0;
    const gain   = Math.max(1, Math.round(state.player.hpMax * POTION_PCT));
    state.player.hp = clamp(before + gain, 0, state.player.hpMax);

    updateBars();
    // Check if an Omen was waiting for us to level up
    if (state._pendingOmen) {
        delete state._pendingOmen;
        window.offerPick2Choice('start'); 
    }
    lvlupModal.style.display='none';
    state._inputLocked = false;

    // restore mobile controls (unless paused)
    if (!state._pauseOpen) setMobileControlsVisible?.(true);

    log('You feel more attuned to magic.');
  };
}

// --- NEW: Stamina Level Up Logic ---
if (btnStam){
  btnStam.onclick = ()=>{
    // Increase Max Stamina (Scaled)
    const inc = (typeof levelStamGain === 'function') ? levelStamGain() : 4;
    state.player.staminaMax = (state.player.staminaMax || 10) + inc;
    
    // Full Refill (Reward for picking it)
    state.player.stamina = state.player.staminaMax;

    updateBars();
    // Check if an Omen was waiting for us to level up
    if (state._pendingOmen) {
        delete state._pendingOmen;
        window.offerPick2Choice('start'); 
    }
    lvlupModal.style.display='none';
    state._inputLocked = false;

    if (!state._pauseOpen) setMobileControlsVisible?.(true);

    log('Your endurance grows. Max Stamina increased.');
  };
}
if (btnMP){
  btnMP.onclick = ()=>{
    const inc = (typeof levelMpGain === 'function') ? levelMpGain() : 5;
    state.player.mpMax += inc;

    const before = state.player.mp|0;
    const gain   = Math.max(1, Math.round(state.player.mpMax * TONIC_PCT));
    state.player.mp = clamp(before + gain, 0, state.player.mpMax);

    updateBars();
    // Check if an Omen was waiting for us to level up
    if (state._pendingOmen) {
        delete state._pendingOmen;
        window.offerPick2Choice('start'); 
    }
    lvlupModal.style.display='none';
    state._inputLocked = false;

    // restore mobile controls (unless paused)
    if (!state._pauseOpen) setMobileControlsVisible?.(true);

    log('You feel more attuned to magic.');
  };
}





// ====== Pick 1 of 2 (run modifiers) ======
const pick2Modal  = document.getElementById('pick2Modal');
const pick2Title  = document.getElementById('pick2Title');
const pick2Desc   = document.getElementById('pick2Desc');
const btnPick2A   = document.getElementById('btnPick2A');
const btnPick2B   = document.getElementById('btnPick2B');

// global flat bonus for all weapons; used in recomputeWeapon()
state.globalWeaponFlatBonus = state.globalWeaponFlatBonus || 0;

// pool of possible blessing/curse pairs
const PICK2_POOL = [
  // ===== Stamina Omens =====
  {
    id: 'second_wind',
    label: '+10 Max Stamina / -5 Max MP',
    apply(){
      const p = state.player;
      p.staminaMax += 10;
      p.stamina = p.staminaMax;
      p.mpMax = Math.max(0, p.mpMax - 5);
      if (p.mp > p.mpMax) p.mp = p.mpMax;
      updateBars?.();
      log('[Omen] Lungs of iron... mind of fog.');
    }
  },
  {
    id: 'heavy_heart',
    label: '+12 Max HP / -8 Max Stamina',
    apply(){
      const p = state.player;
      p.hpMax += 12;
      p.hp = p.hpMax;
      p.staminaMax = Math.max(5, p.staminaMax - 8);
      p.stamina = Math.min(p.stamina, p.staminaMax);
      updateBars?.();
      log('[Omen] A mountain of health... that cannot move.');
    }
  },
  {
    id: 'adrenaline_rush',
    label: '+Full Stamina Restore +2 Bombs / -15% Max HP',
    apply(){
      state.player.stamina = state.player.staminaMax;
      state.inventory.bombs = (state.inventory.bombs|0) + 2;
      state.player.hpMax = Math.max(1, Math.floor(state.player.hpMax * 0.85));
      if(state.player.hp > state.player.hpMax) state.player.hp = state.player.hpMax;
      updateBars?.(); updateInvBody?.();
      log('[Omen] Explosive energy... at a cost.');
    }
  },
  // --- NEW CREATIVE OMENS ---
  {
    id: 'titan_grip',
    label: '+15 ATK (all weapons) / -Max Stamina set to 5',
    apply(){
      state.globalWeaponFlatBonus = (state.globalWeaponFlatBonus || 0) + 15;
      if (typeof recomputeWeapon === 'function') recomputeWeapon();
      state.player.staminaMax = 5; 
      state.player.stamina = Math.min(state.player.stamina, 5);
      updateBars?.();
      log('[Omen] You are a juggernaut... slow and deadly.');
    }
  },
  {
    id: 'rogues_gambit',
    label: '+3 Warp Stones / -All Gold',
    apply(){
      state.inventory.warpStones = (state.inventory.warpStones|0) + 3;
      state.inventory.gold = 0;
      updateInvBody?.();
      log('[Omen] You escape fate... but leave your fortune behind.');
    }
  },
  {
    id: 'glass_sprinter',
    label: '+15 Max Stamina / -Max HP set to 10',
    apply(){
      state.player.staminaMax += 15;
      state.player.stamina = state.player.staminaMax;
      state.player.hpMax = 10;
      state.player.hp = Math.min(state.player.hp, 10);
      updateBars?.();
      log('[Omen] You can run forever... if you survive.');
    }
  },
  // ===== originals =====
  {
    id: 'mp_up_hp_down',
    label: '+12 Max MP / -6 Max HP',
    apply(){
      const p = state.player;
      p.mpMax += 12;
      p.mp = Math.min(p.mp + 12, p.mpMax);
      p.hpMax = Math.max(5, p.hpMax - 6);
      if (p.hp > p.hpMax) p.hp = p.hpMax;
      if (typeof updateBars === 'function') updateBars();
      log('[Omen] +12 Max MP, -6 Max HP.');
    }
  },
  {
    id: 'atk_up_vision_down',
    label: '+3 ATK (all weapons) / -1 Vision Range',
    apply(){
      state.globalWeaponFlatBonus = (state.globalWeaponFlatBonus || 0) + 3;
      if (typeof recomputeWeapon === 'function') recomputeWeapon();
      state.fovRadius = Math.max(2, (state.fovRadius || 5) - 1);
      log('[Omen] +3 weapon damage, -1 vision range.');
    }
  },
  {
    id: 'hp_up_mp_down',
    label: '+10 Max HP / -10 Max MP',
    apply(){
      const p = state.player;
      p.hpMax += 10;
      p.hp = Math.min(p.hp + 10, p.hpMax);
      p.mpMax = Math.max(0, p.mpMax - 10);
      if (p.mp > p.mpMax) p.mp = p.mpMax;
      if (typeof updateBars === 'function') updateBars();
      log('[Omen] +10 Max HP, -10 Max MP.');
    }
  },
  {
    id: 'gold_up_hp_down',
    label: '+35 Gold / -6 Max HP',
    apply(){
      state.inventory.gold = (state.inventory.gold|0) + 35;
      const p = state.player;
      p.hpMax = Math.max(5, p.hpMax - 6);
      if (p.hp > p.hpMax) p.hp = p.hpMax;
      if (typeof updateBars === 'function') updateBars();
      if (typeof updateInvBody === 'function') updateInvBody();
      log('[Omen] +60 gold, -6 Max HP.');
    }
  },

  // ===== new spicy ones =====
  {
    id: 'night_eyes',
    label: '+2 Vision Range / -4 Max HP',
    apply(){
      state.fovRadius = Math.min(8, (state.fovRadius || 5) + 2);
      const p = state.player;
      p.hpMax = Math.max(5, p.hpMax - 4);
      if (p.hp > p.hpMax) p.hp = p.hpMax;
      if (typeof updateBars === 'function') updateBars();
      log('[Omen] Your eyes sharpen… but your body thins.');
    }
  },
  {
    id: 'tunnel_curse',
    label: '+4 ATK (all weapons) / -2 Vision Range',
    apply(){
      state.globalWeaponFlatBonus = (state.globalWeaponFlatBonus || 0) + 4;
      if (typeof recomputeWeapon === 'function') recomputeWeapon();
      state.fovRadius = Math.max(2, (state.fovRadius || 5) - 2);
      log('[Omen] Brutal power, brutal blindness.');
    }
  },
  {
    id: 'hawkeye',
    label: '+2 Bow Range +10 Arrows / -6 Max MP',
    apply(){
      const b = state.player.bow || (state.player.bow = { range:5, loaded:0 });
      b.range = Math.min(10, (b.range|0) + 2);
      state.inventory.arrows = (state.inventory.arrows|0) + 10;

      const p = state.player;
      p.mpMax = Math.max(0, p.mpMax - 6);
      if (p.mp > p.mpMax) p.mp = p.mpMax;

      if (typeof updateBars === 'function') updateBars();
      if (typeof updateInvBody === 'function') updateInvBody();
      log('[Omen] Hawkeye’s gift… with a mana tax.');
    }
  },
  {
    id: 'quickdraw',
    label: '+Loaded Shot +1 Bow Range / -6 Max HP',
    apply(){
      const b = state.player.bow || (state.player.bow = { range:5, loaded:0 });
      b.range = Math.min(10, (b.range|0) + 1);
      b.loaded = Math.max(1, b.loaded|0);

      const p = state.player;
      p.hpMax = Math.max(5, p.hpMax - 6);
      if (p.hp > p.hpMax) p.hp = p.hpMax;

      if (typeof updateBars === 'function') updateBars();
      log('[Omen] A shot chambered… paid in blood.');
    }
  },
  {
    id: 'pack_rat',
    label: '+2 Potions +1 Tonic / -40 Gold',
    apply(){
      state.inventory.potions = (state.inventory.potions|0) + 2;
      state.inventory.tonics  = (state.inventory.tonics|0) + 1;
      state.inventory.gold    = Math.max(0, (state.inventory.gold|0) - 40);
      if (typeof updateInvBody === 'function') updateInvBody();
      log('[Omen] Supplies secured… coin spent.');
    }
  },
  {
    id: 'locksmith',
    label: '+4 Lockpicks / -1 Vision Range',
    apply(){
      state.inventory.lockpicks = (state.inventory.lockpicks|0) + 4;
      state.fovRadius = Math.max(2, (state.fovRadius || 5) - 1);
      if (typeof updateInvBody === 'function') updateInvBody();
      log('[Omen] Doors fear you. Darkness doesn’t.');
    }
  },
  {
    id: 'alchemist',
    label: '+2 Antidotes +6 Max HP / -8 Max MP',
    apply(){
      state.inventory.antidotes = (state.inventory.antidotes|0) + 2;

      const p = state.player;
      p.hpMax += 6;
      p.hp = Math.min(p.hp + 6, p.hpMax);

      p.mpMax = Math.max(0, p.mpMax - 8);
      if (p.mp > p.mpMax) p.mp = p.mpMax;

      if (typeof updateBars === 'function') updateBars();
      if (typeof updateInvBody === 'function') updateInvBody();
      log('[Omen] Better living through chemistry… worse magic.');
    }
  },
  {
    id: 'ironhide',
    label: '+1 Shield +2 ATK (all weapons) / -1 Vision Range',
    apply(){
      state.inventory.shields = (state.inventory.shields|0) + 1;
      state.globalWeaponFlatBonus = (state.globalWeaponFlatBonus || 0) + 2;
      if (typeof recomputeWeapon === 'function') recomputeWeapon();
      state.fovRadius = Math.max(2, (state.fovRadius || 5) - 1);

      if (typeof updateInvBody === 'function') updateInvBody();
      log('[Omen] Steel favors you. Sight does not.');
    }
  },
  {
    id: 'blood_tithe',
    label: '+120 Gold / Become Poisoned',
    apply(){
      state.inventory.gold = (state.inventory.gold|0) + 120;

      const p = state.player;
      p.poisoned = true;
      p.poisonTicks = Math.max(p.poisonTicks|0, 6);

      if (typeof updateInvBody === 'function') updateInvBody();
      log('[Omen] The coins are warm… and wrong.');
    }
  },
  {
    id: 'overcharge',
    label: '+10 Max MP (Full MP) / -10 Max HP',
    apply(){
      const p = state.player;
      p.mpMax += 10;
      p.mp = p.mpMax;

      p.hpMax = Math.max(5, p.hpMax - 10);
      if (p.hp > p.hpMax) p.hp = p.hpMax;

      if (typeof updateBars === 'function') updateBars();
      log('[Omen] Mana floods in. Your frame buckles.');
    }
  },
  {
    id: 'battle_trance',
    label: '+Full Heal / -6 Max MP',
    apply(){
      const p = state.player;
      p.hp = p.hpMax;

      p.mpMax = Math.max(0, p.mpMax - 6);
      if (p.mp > p.mpMax) p.mp = p.mpMax;

      if (typeof updateBars === 'function') updateBars();
      log('[Omen] You breathe easy… magic chokes.');
    }
  },
  {
    id: 'gambler',
    label: '+120 Gold / -2 Vision Range',
    apply(){
      state.inventory.gold = (state.inventory.gold|0) + 120;
      state.fovRadius = Math.max(2, (state.fovRadius || 5) - 2);
      if (typeof updateInvBody === 'function') updateInvBody();
      log('[Omen] Riches, at the edge of darkness.');
    }
  },
  {
    id: 'scavenger',
    label: '+80 Gold & +8 Arrows / -1 Potion',
    apply(){
      state.inventory.gold   = (state.inventory.gold|0) + 80;
      state.inventory.arrows = (state.inventory.arrows|0) + 8;
      state.inventory.potions = Math.max(0, (state.inventory.potions|0) - 1);
      if (typeof updateInvBody === 'function') updateInvBody();
      log('[Omen] Loot in hand… medicine denied.');
    }
  },
  {
    id: 'clarity',
    label: '+6 Max MP +1 Vision Range / -6 Max HP',
    apply(){
      const p = state.player;
      p.mpMax += 6;
      p.mp = Math.min(p.mp + 6, p.mpMax);

      state.fovRadius = Math.min(8, (state.fovRadius || 5) + 1);

      p.hpMax = Math.max(5, p.hpMax - 6);
      if (p.hp > p.hpMax) p.hp = p.hpMax;

      if (typeof updateBars === 'function') updateBars();
      log('[Omen] Mind sharpened. Body thinned.');
    }
  },
  {
    id: 'starved_power',
    label: '+5 ATK (all weapons) / -2 Potions',
    apply(){
      state.globalWeaponFlatBonus = (state.globalWeaponFlatBonus || 0) + 5;
      if (typeof recomputeWeapon === 'function') recomputeWeapon();

      state.inventory.potions = Math.max(0, (state.inventory.potions|0) - 2);
      if (typeof updateInvBody === 'function') updateInvBody();

      log('[Omen] Damage rises. Safety evaporates.');
    }
  },
  {
    id: 'fogwalker',
    label: '+3 Vision Range / -12 Gold',
    apply(){
      state.fovRadius = Math.min(8, (state.fovRadius || 5) + 3);
      state.inventory.gold = Math.max(0, (state.inventory.gold|0) - 12);
      if (typeof updateInvBody === 'function') updateInvBody();
      log('[Omen] The fog parts. Your purse doesn’t.');
    }
  },

  // ======= EVEN MORE OMENS (go nuts) =======

  {
    id: 'blacksmith_boil',
    label: 'Repair Weapon (Full Durability) / -60 Gold',
    apply(){
      const w = state.player.weapon;
      if (Number.isFinite(w?.durMax)){
        w.dur = w.durMax;
        updateEquipUI?.();
      }
      state.inventory.gold = Math.max(0, (state.inventory.gold|0) - 60);
      updateInvBody?.();
      log('[Omen] The blade sings again… your coin goes quiet.');
    }
  },
  {
    id: 'tempered_edge',
    label: '+1 Weapon Base Damage / -5 Weapon Max Durability',
    apply(){
      const w = state.player.weapon;
      if (w?.base){
        w.base.min += 1;
        w.base.max += 1;
        if (Number.isFinite(w.durMax)){
          w.durMax = Math.max(1, (w.durMax|0) - 5);
          w.dur = Math.min(w.dur|0, w.durMax);
        }
        if (typeof recomputeWeapon === 'function') recomputeWeapon();
        updateEquipUI?.();
      }
      log('[Omen] Sharper steel… shorter life.');
    }
  },
  {
    id: 'rust_tax',
    label: '+180 Gold / -8 Weapon Max Durability',
    apply(){
      state.inventory.gold = (state.inventory.gold|0) + 180;
      const w = state.player.weapon;
      if (Number.isFinite(w?.durMax)){
        w.durMax = Math.max(1, (w.durMax|0) - 8);
        w.dur = Math.min(w.dur|0, w.durMax);
        updateEquipUI?.();
      }
      updateInvBody?.();
      log('[Omen] Heavy purse… rusted edge.');
    }
  },
  {
    id: 'glass_cannon',
    label: '+7 ATK (all weapons) / -30% Max HP',
    apply(){
      state.globalWeaponFlatBonus = (state.globalWeaponFlatBonus || 0) + 7;
      if (typeof recomputeWeapon === 'function') recomputeWeapon();

      const p = state.player;
      p.hpMax = Math.max(5, Math.floor(p.hpMax * 0.70));
      if (p.hp > p.hpMax) p.hp = p.hpMax;
      updateBars?.();
      log('[Omen] You hit like a storm… and break like glass.');
    }
  },
  {
    id: 'tunnel_vision_extreme',
    label: '+9 ATK (all weapons) / Set Vision to 2',
    apply(){
      state.globalWeaponFlatBonus = (state.globalWeaponFlatBonus || 0) + 9;
      if (typeof recomputeWeapon === 'function') recomputeWeapon();
      state.fovRadius = 2;
      log('[Omen] Power without sight.');
    }
  },
  {
    id: 'night_market',
    label: '+3 Potions +2 Tonics / -120 Gold',
    apply(){
      state.inventory.potions = (state.inventory.potions|0) + 3;
      state.inventory.tonics  = (state.inventory.tonics|0) + 2;
      state.inventory.gold    = Math.max(0, (state.inventory.gold|0) - 120);
      updateInvBody?.();
      log('[Omen] A bargain… if you never look at the receipt.');
    }
  },
  {
    id: 'snake_oil',
    label: '+4 Tonics / Become Poisoned',
    apply(){
      state.inventory.tonics = (state.inventory.tonics|0) + 4;
      const p = state.player;
      p.poisoned = true;
      p.poisonTicks = Math.max(p.poisonTicks|0, 8);
      updateInvBody?.();
      log('[Omen] Sweet medicine… bitter aftertaste.');
    }
  },
  {
    id: 'antivenom_cache_plus',
    label: '+4 Antidotes +1 Vision / -2 Potions',
    apply(){
      state.inventory.antidotes = (state.inventory.antidotes|0) + 4;
      state.fovRadius = Math.min(8, (state.fovRadius || 5) + 1);
      state.inventory.potions = Math.max(0, (state.inventory.potions|0) - 2);
      updateInvBody?.();
      log('[Omen] You’ll survive toxins… if you survive the next hit.');
    }
  },
  {
    id: 'quiver_king',
    label: '+25 Arrows +Loaded Shot / -1 Vision Range',
    apply(){
      state.inventory.arrows = (state.inventory.arrows|0) + 25;
      state.player.bow = state.player.bow || { range:5, loaded:0 };
      state.player.bow.loaded = Math.max(1, state.player.bow.loaded|0);
      state.fovRadius = Math.max(2, (state.fovRadius || 5) - 1);
      updateInvBody?.();
      updateEquipUI?.();
      log('[Omen] The quiver fattens… the dark creeps closer.');
    }
  },
  {
    id: 'bowstring_hymn',
    label: '+3 Bow Range / -8 Max HP',
    apply(){
      const b = state.player.bow || (state.player.bow = { range:5, loaded:0 });
      b.range = Math.min(12, (b.range|0) + 3);
      const p = state.player;
      p.hpMax = Math.max(5, p.hpMax - 8);
      if (p.hp > p.hpMax) p.hp = p.hpMax;
      updateBars?.(); updateEquipUI?.();
      log('[Omen] Long shots… short life.');
    }
  },
  {
    id: 'loaded_lie',
    label: '+Loaded Shot (Free) +10 Gold / -6 Max MP',
    apply(){
      state.player.bow = state.player.bow || { range:5, loaded:0 };
      state.player.bow.loaded = 1;
      state.inventory.gold = (state.inventory.gold|0) + 10;

      const p = state.player;
      p.mpMax = Math.max(0, p.mpMax - 6);
      if (p.mp > p.mpMax) p.mp = p.mpMax;

      updateBars?.(); updateEquipUI?.(); updateInvBody?.();
      log('[Omen] A free arrow… paid in mana.');
    }
  },
  {
    id: 'skill_drill_weapon',
    label: '+2 Levels (Current Weapon Skill) / -1 Vision Range',
    apply(){
      const t = state.player?.weapon?.type;
      if (t){
        ensureSkill(t);
        state.skills[t].lvl = (state.skills[t].lvl|0) + 2;
        state.skills[t].shown = true;
        if (typeof recomputeWeapon === 'function') recomputeWeapon();
        renderSkills?.();
      }
      state.fovRadius = Math.max(2, (state.fovRadius || 5) - 1);
      log('[Omen] Training pays… the dark collects interest.');
    }
  },
  {
    id: 'skill_drill_magic',
    label: '+2 Magic Levels (Full MP) / -1 Potion',
    apply(){
      ensureSkill('magic');
      state.skills.magic.lvl = (state.skills.magic.lvl|0) + 2;
      state.skills.magic.shown = true;

      const p = state.player;
      p.mp = p.mpMax;

      state.inventory.potions = Math.max(0, (state.inventory.potions|0) - 1);

      updateBars?.(); updateInvBody?.(); renderSkills?.();
      log('[Omen] Your mind expands… your supplies shrink.');
    }
  },
  {
    id: 'survivor_ritual',
    label: '+3 Survivability Levels / -10 Max MP',
    apply(){
      ensureSkill('survivability');
      state.skills.survivability.lvl = (state.skills.survivability.lvl|0) + 3;
      state.skills.survivability.shown = true;

      const p = state.player;
      p.mpMax = Math.max(0, p.mpMax - 10);
      if (p.mp > p.mpMax) p.mp = p.mpMax;

      updateBars?.(); renderSkills?.();
      log('[Omen] Your body learns… your mana forgets.');
    }
  },
  {
    id: 'cache_of_steel',
    label: '+2 Shields +2 Lockpicks / -2 Vision Range',
    apply(){
      state.inventory.shields  = (state.inventory.shields|0) + 2;
      state.inventory.lockpicks = (state.inventory.lockpicks|0) + 2;
      state.fovRadius = Math.max(2, (state.fovRadius || 5) - 2);
      updateInvBody?.();
      log('[Omen] Tools in hand… darkness at your throat.');
    }
  },
  {
    id: 'miserly_lantern',
    label: '+3 Vision Range / -200 Gold',
    apply(){
      state.fovRadius = Math.min(8, (state.fovRadius || 5) + 3);
      state.inventory.gold = Math.max(0, (state.inventory.gold|0) - 200);
      updateInvBody?.();
      log('[Omen] Light for sale. No refunds.');
    }
  },
  {
    id: 'blood_lantern',
    label: '+4 Vision Range / -12 Max HP',
    apply(){
      state.fovRadius = Math.min(8, (state.fovRadius || 5) + 4);
      const p = state.player;
      p.hpMax = Math.max(5, p.hpMax - 12);
      if (p.hp > p.hpMax) p.hp = p.hpMax;
      updateBars?.();
      log('[Omen] The light is warm… because it’s yours.');
    }
  },
  {
    id: 'spellbook_stolen',
    label: 'Learn Random Spell / -8 Max HP',
    apply(){
      const p = state.player;
      p.hpMax = Math.max(5, p.hpMax - 8);
      if (p.hp > p.hpMax) p.hp = p.hpMax;

      if (typeof randomSpell === 'function'){
        const sp = randomSpell();
        if (sp){
          const have = state.spells.find(s => s.name === sp.name);
          if (!have){
            state.spells.push(sp);
            if (typeof ensureSpellUpgradeSlot === 'function') ensureSpellUpgradeSlot(sp.name);
            if (!state.equippedSpell) state.equippedSpell = sp;
            log(`[Omen] You stole a spell: ${sp.name} Lv${sp.tier}.`);
          } else {
            ensureSkill('magic');
            state.skills.magic.xp += 4; // MAGIC_SCROLL_XP default in your file
            renderSkills?.();
            log('[Omen] The pages were duplicates… but you learned something.');
          }
        }
      }

      updateBars?.();
      log('[Omen] Knowledge costs flesh.');
    }
  },
  {
    id: 'armory_raffle',
    label: '+Random Weapon +50 Gold / -1 Vision Range',
    apply(){
      const names = ['Shortsword','Claymore','Spear','Axe','Knuckle Duster'];
      const name  = names[(Math.random()*names.length)|0];
      state.inventory.weapons[name] = (state.inventory.weapons[name] || 0) + 1;
      state.inventory.gold = (state.inventory.gold|0) + 50;
      state.fovRadius = Math.max(2, (state.fovRadius || 5) - 1);
      updateInvBody?.();
      log(`[Omen] The armory smiles: +1 ${name}.`);
    }
  },
  {
    id: 'poverty_pack',
    label: '+6 Lockpicks +2 Potions / -150 Gold',
    apply(){
      state.inventory.lockpicks = (state.inventory.lockpicks|0) + 6;
      state.inventory.potions   = (state.inventory.potions|0) + 2;
      state.inventory.gold      = Math.max(0, (state.inventory.gold|0) - 150);
      updateInvBody?.();
      log('[Omen] You can open anything… except your wallet.');
    }
  },
  {
    id: 'mana_for_gold',
    label: '+240 Gold / -12 Max MP',
    apply(){
      state.inventory.gold = (state.inventory.gold|0) + 240;
      const p = state.player;
      p.mpMax = Math.max(0, p.mpMax - 12);
      if (p.mp > p.mpMax) p.mp = p.mpMax;
      updateBars?.(); updateInvBody?.();
      log('[Omen] Riches now… spells later.');
    }
  },
  {
    id: 'blood_for_gold',
    label: '+180 Gold / -15% Max HP',
    apply(){
      state.inventory.gold = (state.inventory.gold|0) + 180;
      const p = state.player;
      p.hpMax = Math.max(5, Math.floor(p.hpMax * 0.85));
      if (p.hp > p.hpMax) p.hp = p.hpMax;
      updateBars?.(); updateInvBody?.();
      log('[Omen] The price is measured in heartbeats.');
    }
  },
  {
    id: 'merciless_focus',
    label: '+5 ATK (all weapons) +1 Vision / -3 Potions',
    apply(){
      state.globalWeaponFlatBonus = (state.globalWeaponFlatBonus || 0) + 5;
      if (typeof recomputeWeapon === 'function') recomputeWeapon();

      state.fovRadius = Math.min(8, (state.fovRadius || 5) + 1);
      state.inventory.potions = Math.max(0, (state.inventory.potions|0) - 3);

      updateInvBody?.();
      log('[Omen] Sharper senses… fewer second chances.');
    }
  },
  {
    id: 'panic_heal',
    label: '+Full Heal +2 Potions / -2 Vision Range',
    apply(){
      const p = state.player;
      p.hp = p.hpMax;
      state.inventory.potions = (state.inventory.potions|0) + 2;
      state.fovRadius = Math.max(2, (state.fovRadius || 5) - 2);
      updateBars?.(); updateInvBody?.();
      log('[Omen] You live… but the dark presses close.');
    }
  },
  {
    id: 'altar_of_thorns',
    label: '+15 Max HP / Become Poisoned (10 ticks)',
    apply(){
      const p = state.player;
      p.hpMax += 15;
      p.hp = Math.min(p.hp + 15, p.hpMax);

      p.poisoned = true;
      p.poisonTicks = Math.max(p.poisonTicks|0, 10);

      updateBars?.();
      log('[Omen] A stronger body… a thorned soul.');
    }
  }
];


let _pick2Current = null;

function hidePick2Modal(){
  if (pick2Modal) pick2Modal.style.display = 'none';
  state._inputLocked = false;
  if (!state._pauseOpen && typeof setMobileControlsVisible === 'function'){
    setMobileControlsVisible(true);
  }
  if (typeof draw === 'function') draw();
}

// === UPDATE INSIDE choosePick2 ===
function choosePick2(idx){
  if (!_pick2Current || !_pick2Current[idx]) return;
  const cfg = _pick2Current[idx];
  try { cfg.apply(); } catch (err) { console.error(err); }
  
  // Pass 'true' to increment the "Picked" count
  unlockCodex(cfg.id, true); 

  // FIX: Force update the equipped weapon display immediately
  if (typeof updateEquipUI === 'function') updateEquipUI(); 

  hidePick2Modal();
}

if (btnPick2A){
  btnPick2A.onclick = ()=>choosePick2(0);
}
if (btnPick2B){
  btnPick2B.onclick = ()=>choosePick2(1);
}

// expose a helper so game logic can trigger the choice
window.offerPick2Choice = function offerPick2Choice(context){
  // safety: if the modal or buttons aren't there, do nothing
  if (!pick2Modal || !btnPick2A || !btnPick2B) return;
  
  // Omen/Pick 1 of 2 is exclusive to Endless Mode.
  if (state.gameMode !== 'endless') return;

  // Boss Reward pick should only fire if we are actually in Endless mode
  if (context === 'boss' && state.gameMode !== 'endless') return; // Redundant, but harmless safety.

  if (!Array.isArray(PICK2_POOL) || PICK2_POOL.length < 2) return;

  // pick two distinct options
  let i = Math.floor(Math.random() * PICK2_POOL.length);
  let j = Math.floor(Math.random() * PICK2_POOL.length);
  if (j === i) j = (j + 1) % PICK2_POOL.length;

  _pick2Current = [PICK2_POOL[i], PICK2_POOL[j]];

if (pick2Title){
    if (context === 'start') pick2Title.textContent = "Starting Omen";
    else if (context === 'warlord') pick2Title.textContent = "Warlord Reward";
    else if (context === 'boss') pick2Title.textContent = "Boss Reward";
    else pick2Title.textContent = "A Dark Omen";
  }
  if (pick2Desc){
    pick2Desc.textContent = 'Each choice has a blessing and a curse.';
  }

  btnPick2A.textContent = _pick2Current[0].label;
  btnPick2B.textContent = _pick2Current[1].label;

  state._inputLocked = true;
  if (typeof setMobileControlsVisible === 'function'){
    setMobileControlsVisible(false);
  }

  pick2Modal.style.display = 'flex';
};


// ====== Pause Menu helpers ======
const pauseOverlay = document.getElementById('pauseOverlay');
const btnResume    = document.getElementById('btnResume');
const btnHelp      = document.getElementById('btnHelp');
const btnQuit      = document.getElementById('btnQuit');


// ====== Pause Menu helpers ======
function openPauseMenu(){
  const modal = document.getElementById('pauseModal');
  if (!modal) return;

  // mark game as paused
  state._pauseOpen = true;
  state._inputLocked = true;

  if (typeof setMobileControlsVisible === 'function') {
    setMobileControlsVisible(false);
  }

  modal.style.display = 'flex';
}

function closePauseMenu(){
  const modal = document.getElementById('pauseModal');
  if (!modal) return;

  modal.style.display = 'none';

  state._pauseOpen = false;
  state._inputLocked = false;

  if (typeof setMobileControlsVisible === 'function') {
    setMobileControlsVisible(true);
  }
}

// Wire Pause menu buttons
(function(){
  const modal       = document.getElementById('pauseModal');
  if (!modal) return;

  const btnResume = document.getElementById('btnPauseResume');
  const btnHelp = document.getElementById('btnPauseHelp');
  const btnCodex = document.getElementById('btnPauseCodex');
  const btnSettings = document.getElementById('btnPauseSettings');
  const btnQuit = document.getElementById('btnPauseQuit');

  if (btnCodex) {
    btnCodex.addEventListener('click', () => {
      if (typeof renderCodexUI === 'function') renderCodexUI();
      const m = document.getElementById('codexOverlay');
      if (m) {
        m.style.zIndex = '10001'; // Ensure it sits above the pause menu
        m.style.display = 'flex';
      }
    });
  }

  if (btnResume){
    btnResume.addEventListener('click', () => {
      closePauseMenu();
    });
  }

  if (btnHelp){
    btnHelp.addEventListener('click', () => {
      // keep paused; just show Help on top
      const h = document.getElementById('helpModal');
      if (h) h.style.display = 'flex';
    });
  }

  if (btnSettings){
    btnSettings.addEventListener('click', () => {
      // keep paused; open Settings full-screen overlay
      const s = document.getElementById('settingsOverlay');
      if (s) {
          s.style.zIndex = '10001'; // Ensure it sits visually above the pause menu
          s.style.display = 'flex';
      }
    });
  }

if (btnQuit) {
    btnQuit.addEventListener('click', () => {
      // Open the new confirmation modal instead of quitting immediately
      const qm = document.getElementById('quitConfirmModal');
      if(qm) qm.style.display = 'flex';
    });
  }

  // --- NEW: Quit Confirmation Wiring ---
  const btnQSave   = document.getElementById('btnQuitSave');
  const btnQNoSave = document.getElementById('btnQuitNoSave');
  const btnQCancel = document.getElementById('btnQuitCancel');
  const qModal     = document.getElementById('quitConfirmModal');

  if(btnQSave) {
    btnQSave.onclick = () => {
      if(typeof window.saveRun === 'function') window.saveRun(); // Save
      qModal.style.display = 'none';
      closePauseMenu();
      goMenu();
    };
  }
  if(btnQNoSave) {
    btnQNoSave.onclick = () => {
      // Don't save, just leave
      qModal.style.display = 'none';
      closePauseMenu();
      goMenu();
    };
  }
  if(btnQCancel) {
    btnQCancel.onclick = () => {
      qModal.style.display = 'none'; // Go back to pause menu
    };
  }

  // Optional: clicking the dark backdrop also resumes
  modal.addEventListener('click', (e) => {
    if (e.target === modal){
      closePauseMenu();
    }
  });
})();


// ====== Input Buttons ======
document.getElementById('btnE').onclick=interact;
document.getElementById('btnAtk').onclick=attack;
document.getElementById('btnCast').onclick=cast;
document.getElementById('btnBow').onclick = shootBow; 

// swipe controls (no page scroll)
const wrap=document.getElementById('cw');
let touchStart=null;
wrap.addEventListener('touchstart',e=>{ document.body.classList.add('noscroll'); touchStart = {x:e.touches[0].clientX,y:e.touches[0].clientY}; },{passive:false});
wrap.addEventListener('touchmove',e=>{ e.preventDefault(); },{passive:false});
wrap.addEventListener('touchend',e=>{
  document.body.classList.remove('noscroll');
  if(!touchStart) return;
  const dx=(e.changedTouches[0].clientX-touchStart.x), dy=(e.changedTouches[0].clientY-touchStart.y);
  const ax=Math.abs(dx), ay=Math.abs(dy);
  if(Math.max(ax,ay)<24) return;
  if(ax>ay){ tryMove(dx>0?1:-1,0); } else { tryMove(0,dy>0?1:-1); }
  touchStart=null; updateBars();
});

// --- Controller & Input UI Support ---
window.lastInputType = 'keyboard'; // Attached to window so it never drops out of scope!
let menuIdx = 0;
const gpState = { buttons: {}, moving: false };

// --- NEW: Global Input Label Helper ---
window.getInputName = function(action) {
  const type = window.lastInputType || 'keyboard';
  const isPS = type === 'playstation';
  const isGP = type !== 'keyboard';
  switch(action) {
      case 'interact': return isGP ? (isPS ? 'Square' : 'X') : 'E';
      case 'attack': return isGP ? (isPS ? 'Cross' : 'A') : 'SPACE';
      case 'cast': return isGP ? (isPS ? 'Circle' : 'B') : 'Q';
      case 'cycle_spell': return isGP ? (isPS ? 'Triangle' : 'Y') : 'F';
      case 'bow': return isGP ? (isPS ? 'L2' : 'LT') : 'B';
      case 'art': return isGP ? (isPS ? 'R2' : 'RT') : 'R';
      case 'inventory': return isGP ? (isPS ? 'Share' : 'Select') : 'I';
      case 'spell_menu': return isGP ? (isPS ? 'R1' : 'RB') : 'P';
      case 'sprint': return isGP ? (isPS ? 'L1' : 'LB') : 'SHIFT';
      case 'move': return isGP ? 'L-Stick' : 'WASD/Arrows';
      case 'potion': return isGP ? 'D-Pad Up' : '1';
      case 'tonic': return isGP ? 'D-Pad Down' : '2';
      case 'antidote': return isGP ? 'D-Pad Left' : '3';
      case 'bomb': return isGP ? 'D-Pad Right' : '4';
      case 'warp': return isGP ? '(Unmapped)' : '5';
  }
  return action;
};

function updateControlUI(type) {
  if (window.lastInputType === type) return;
  window.lastInputType = type;
  const grid = document.getElementById('helpGrid');
  const title = document.getElementById('helpTitle');
  if (!grid || !title) return;

  const isGP = type !== 'keyboard';
  const isPS = type === 'playstation';
  title.textContent = isGP ? (isPS ? 'PlayStation Controls' : 'Xbox Controls') : 'Keyboard Controls';

  const controls = isGP ? [
    ['L-Stick', 'Move / Navigate'],
    [isPS ? 'L1' : 'LB', 'Sprint (Hold)'],
    [isPS ? 'Cross' : 'A', 'Attack / Select'],
    [isPS ? 'Square' : 'X', 'Interact / Open'],
    [isPS ? 'Circle' : 'B', 'Cast Spell'],
    [isPS ? 'Triangle' : 'Y', 'Cycle Spells'],
    [isPS ? 'R2' : 'RT', 'Weapon Art'],
    [isPS ? 'L2' : 'LT', 'Bow (Shoot)'],
    ['D-Pad Up', 'Use Potion'],
    ['D-Pad Down', 'Use Tonic'],
    ['D-Pad Left', 'Use Antidote'],
    ['D-Pad Right', 'Use Bomb'],
    ['R3', 'Skills Menu'],
    [isPS ? 'Share' : 'Select', 'Inventory / Pause'],
    ['L3', 'Toggle Help']
  ] : [
    ['WASD / Arrows', 'Move'], ['Shift + Move', 'Sprint'], ['Space', 'Attack'], ['E', 'Interact'], ['Q', 'Cast'],
    ['F', 'Cycle Spells'], ['R', 'Weapon Art'], ['B', 'Bow'], 
    ['1', 'Use Potion'], ['2', 'Use Tonic'], ['3', 'Use Antidote'], ['4', 'Use Bomb'], ['5', 'Warp Stone'],
    ['I', 'Inventory'], ['P', 'Spells'], ['K', 'Skills Menu'], ['H', 'Show Help']
  ];

  grid.innerHTML = controls.map(c => `<div><b>${c[0]}</b></div><div>${c[1]}</div>`).join('');
}

function getVisibleModal() {
  const modals = Array.from(document.querySelectorAll('.modal, .fullOverlay')).filter(m => {
    const style = window.getComputedStyle(m);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });
  
  if (modals.length === 0) return null;
  
  // Sort strictly by computed z-index (highest wins). If tie, last in DOM wins.
  modals.sort((a, b) => {
    const zA = parseInt(window.getComputedStyle(a).zIndex) || 0;
    const zB = parseInt(window.getComputedStyle(b).zIndex) || 0;
    if (zA === zB) {
      return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
    }
    return zA - zB;
  });
  
  return modals[modals.length - 1];
}

window.openSkillsModal = function() {
    let sm = document.getElementById('skillsModalWrapper');
    if (!sm) {
        sm = document.createElement('div');
        sm.id = 'skillsModalWrapper';
        sm.className = 'modal';
        sm.style.zIndex = '10005';
        sm.innerHTML = `
          <div class="sheet" style="max-height:80vh; overflow-y:auto; width:min(600px, 94vw);">
            <div class="row"><div class="title">Skills</div><button class="btn" id="closeSkillsModalBtn">Close</button></div>
            <div id="skillsModalBody"></div>
          </div>`;
        document.body.appendChild(sm);
        
        const origParent = document.getElementById('skillsList').parentNode;
        document.getElementById('closeSkillsModalBtn').onclick = () => {
            origParent.appendChild(document.getElementById('skillsList'));
            sm.style.display = 'none';
            state._inputLocked = false;
            if (!state._pauseOpen && typeof setMobileControlsVisible === 'function') setMobileControlsVisible(true);
        };
    }
    const list = document.getElementById('skillsList');
    if (list) document.getElementById('skillsModalBody').appendChild(list);
    sm.style.display = 'flex';
    state._inputLocked = true;
    if (typeof setMobileControlsVisible === 'function') setMobileControlsVisible(false);
};

// --- Virtual Cursor State ---
let vCursor = null;
let vcX = null;
let vcY = null;

function pollGamepad() {
  const gamepads = navigator.getGamepads();
  const gp = gamepads[0] || gamepads[1] || gamepads[2] || gamepads[3];
  if (!gp) return requestAnimationFrame(pollGamepad);

  // --- NEW: Wrap everything in a try-catch so a text error NEVER kills the loop! ---
  try {
      const id = gp.id.toLowerCase();
      const type = (id.includes('dualshock') || id.includes('dualsense') || id.includes('playstation') || id.includes('wireless controller')) ? 'playstation' : 'xbox';
      
      let padActive = false;
  for(let i=0; i<gp.buttons.length; i++) { if(gp.buttons[i].pressed) padActive = true; }
  for(let i=0; i<gp.axes.length; i++) { if(Math.abs(gp.axes[i]) > 0.2) padActive = true; }
  if (padActive) updateControlUI(type);

  const openModal = getVisibleModal();
  const threshold = 0.5;

  // Helper for one-shot button presses
  const btn = (idx, callback) => {
    if (gp.buttons[idx]?.pressed) {
      if (!gpState.buttons[idx]) { gpState.buttons[idx] = true; callback(); }
    } else { gpState.buttons[idx] = false; }
  };

 // 1. MENU NAVIGATION (Controller Snapping)
  if (openModal) {
    const thresh = 0.5;

    // Gather Navigable Elements
    // ADDED: .menuLink to catch Endless Mode (which is a span) and removed aria-disabled block
    const navs = Array.from(openModal.querySelectorAll('button, a, .btn, .tab-btn, .menuLink, input[type="range"], .card, .item, .slot, .item-slot, .perk-btn, .menu-btn, .menu-item, [onclick], [tabindex="0"]'))
      .filter(el => {
        const r = el.getBoundingClientRect();
        const comp = window.getComputedStyle(el);
        return r.width > 0 && r.height > 0 && comp.visibility !== 'hidden' && comp.opacity !== '0';
      });

    let focusEl = document.querySelector('.controller-focus');

    // --- Spatial UI Navigation (Left Stick / D-Pad) ---
    let lsX = 0, lsY = 0;
    if (gp.axes[0] < -thresh || gp.buttons[14]?.pressed) lsX = -1;
    else if (gp.axes[0] > thresh || gp.buttons[15]?.pressed) lsX = 1;
    if (gp.axes[1] < -thresh || gp.buttons[12]?.pressed) lsY = -1;
    else if (gp.axes[1] > thresh || gp.buttons[13]?.pressed) lsY = 1;

    if (lsX !== 0 || lsY !== 0) {
        if (!gpState.navMoving) {
            gpState.navMoving = true;

            if (focusEl && focusEl.tagName === 'INPUT' && focusEl.type === 'range' && lsX !== 0) {
               // Slider adjustment
               const min = focusEl.min ? Number(focusEl.min) : 0;
               const max = focusEl.max ? Number(focusEl.max) : 100;
               const step = (max - min) * 0.05 || 5;
               focusEl.value = Math.max(min, Math.min(max, Number(focusEl.value) + lsX * step));
               focusEl.dispatchEvent(new Event('input'));
            } else if (navs.length > 0) {
               if (!navs.includes(focusEl)) {
                   // If lost or first move, snap to the very first item
                   document.querySelectorAll('.controller-focus').forEach(e => e.classList.remove('controller-focus'));
                   focusEl = navs[0];
                   focusEl.classList.add('controller-focus');
                   focusEl.scrollIntoView({behavior:'smooth', block:'nearest'});
               } else {
                   // Find best neighbor
                   const cx = focusEl.getBoundingClientRect().left + focusEl.getBoundingClientRect().width/2;
                   const cy = focusEl.getBoundingClientRect().top + focusEl.getBoundingClientRect().height/2;
                   let best = null, bestDist = Infinity;
                   navs.forEach(el => {
                       if(el === focusEl) return;
                       const r = el.getBoundingClientRect();
                       const ex = r.left + r.width/2;
                       const ey = r.top + r.height/2;
                       const dx = ex - cx, dy = ey - cy;
                       let valid = false;
                       
                       // WIDENED CONE: Full 180 degrees to guarantee finding tabs directly above wide sliders
                       if (lsX === 1 && dx > 0) valid = true;
                       else if (lsX === -1 && dx < 0) valid = true;
                       else if (lsY === 1 && dy > 0) valid = true;
                       else if (lsY === -1 && dy < 0) valid = true;

                       if (valid) {
                           const dist = Math.sqrt(dx*dx + dy*dy);
                           // Penalize items not aligned to the stick's axis to keep navigation predictable
                           const align = (lsX !== 0) ? Math.abs(dy) : Math.abs(dx);
                           const score = dist + align*4;
                           if(score < bestDist){ bestDist = score; best = el; }
                       }
                   });
                   if (best) {
                       focusEl.classList.remove('controller-focus');
                       best.classList.add('controller-focus');
                       best.scrollIntoView({behavior:'smooth', block:'nearest'});
                   }
               }
            }
            setTimeout(() => { gpState.navMoving = false; }, 180);
        }
    } else {
        if (gpState.navMoving) gpState.navMoving = false; 
    }

    // Select (A / Cross)
    btn(0, () => { 
        let focusedEl = document.querySelector('.controller-focus');
        
        // Auto-target the first item if nothing is focused (Fixes Main Menu bug)
        if (!focusedEl && navs.length > 0) {
            focusedEl = navs[0];
            focusedEl.classList.add('controller-focus');
        }

        if (focusedEl) {
            focusedEl.click();
        } else if (openModal) {
            openModal.click();
        }
    });

    // Close/Back (B / Circle)
    btn(1, () => {
        const closeBtn = openModal.querySelector('[data-close], #mBack, #jBack, #cBack, #clBack, #gwClose, #closeSkillsModalBtn');
        if (closeBtn) closeBtn.click();
        else if (typeof closePauseMenu === 'function') closePauseMenu();
    });

    // --- NEW: Bumper Tab Swapping (L1 / R1) ---
    const cycleTabs = (dir) => {
        const tabs = Array.from(openModal.querySelectorAll('.tab-btn, .settings-tab, button[id*="tab"]'))
            .filter(el => {
                const comp = window.getComputedStyle(el);
                return comp.display !== 'none' && comp.visibility !== 'hidden' && comp.opacity !== '0';
            });
        if (tabs.length > 1) {
            let activeIdx = tabs.findIndex(t => t.classList.contains('active') || t.disabled);
            if (activeIdx === -1) activeIdx = 0;
            tabs[(activeIdx + dir + tabs.length) % tabs.length].click();
        }
    };
    btn(4, () => cycleTabs(-1)); // L1 / LB
    btn(5, () => cycleTabs(1));  // R1 / RB

    // Clean up old cursor if it's still stuck on screen
    const oldCursor = document.getElementById('virtual-cursor');
    if (oldCursor) oldCursor.style.display = 'none';

    return requestAnimationFrame(pollGamepad);
  } else {
    // Hide the virtual cursor when no menus are open
    if (vCursor) vCursor.style.display = 'none';
  }

  // 2. WORLD GAMEPLAY
  if (state._inputLocked || state.gameOver || state._descending || !!state._pauseOpen) {
    return requestAnimationFrame(pollGamepad);
  }

  // Standard Mappings
  btn(0, () => attack());
  btn(1, () => cast());
  btn(2, () => interact());
  btn(3, () => {
    if (state.spells?.length) {
      let idx = state.equippedSpell ? state.spells.findIndex(s => s.name === state.equippedSpell.name) : -1;
      state.equippedSpell = state.spells[(idx + 1) % state.spells.length];
      updateEquipUI();
      spawnFloatText(state.equippedSpell.name, state.player.x, state.player.y, '#60a5fa');
    }
  });
  btn(10, () => { const h = document.getElementById('helpModal'); if(h) h.style.display = h.style.display==='flex'?'none':'flex'; });
  btn(5, () => { updateSpellBody(); document.getElementById('spellModal').style.display = 'flex'; setMobileControlsVisible(false); });
  btn(6, () => shootBow());
  btn(7, () => useWeaponArt());
  btn(8, () => { updateInvBody(); document.getElementById('invModal').style.display = 'flex'; setMobileControlsVisible(false); });
  btn(9, () => openPauseMenu());

  // World Movement
  const x = gp.axes[0], y = gp.axes[1];
  let dx = 0, dy = 0;
  if (y < -threshold) dy = -1;
  else if (y > threshold) dy = 1;
  else if (x < -threshold) dx = -1;
  else if (x > threshold) dx = 1;

  const isSprinting = gp.buttons[4]?.pressed; // L1 / LB

  if ((dx !== 0 || dy !== 0) && !gpState.moving) {
    gpState.moving = true;
    
    // --- CRASH PREVENTION: Queue the unlock BEFORE any game logic runs! ---
    // This guarantees the joystick never gets permanently stuck if an error occurs below.
    setTimeout(() => { gpState.moving = false; }, 150);

    // --- FIX: Allow Controller to pass Tutorial Step 1 ---
    if (typeof state !== 'undefined' && state.gameMode === 'tutorial' && state.tutorialStep === 1) {
        if (!state._tutMoveWASD) state._tutMoveWASD = {};
        if (dy === -1) state._tutMoveWASD.w = true;
        if (dx === -1) state._tutMoveWASD.a = true;
        if (dy === 1)  state._tutMoveWASD.s = true;
        if (dx === 1)  state._tutMoveWASD.d = true;

        if (state._tutMoveWASD.w && state._tutMoveWASD.a && state._tutMoveWASD.s && state._tutMoveWASD.d) {
            state.tutorialStep = 2;
            if (typeof hideBanner === 'function') hideBanner();
            // Fallback ensures no ReferenceError if the function drops out of scope
            if (typeof showBanner === 'function') showBanner(`Step 2: Sprinting. Hold (${window.getInputName ? window.getInputName('sprint') : 'Sprint'}) while moving.`, 999999);
        }
    }
    // ----------------------------------------------------

    if (isSprinting) {
        const key = dx === 1 ? 'd' : dx === -1 ? 'a' : dy === 1 ? 's' : 'w';
        const ev = new KeyboardEvent('keydown', { key: key, shiftKey: true });
        Object.defineProperty(ev, 'isGamepad', {value: true});
        window.dispatchEvent(ev);
    } else {
        tryMove(dx, dy);
    }
  }

  // Quick Consumables (D-Pad)
  if (gp.buttons[12]?.pressed) { if(!gpState.dpadU) { usePotion(); gpState.dpadU=true; } } else gpState.dpadU = false;
  if (gp.buttons[13]?.pressed) { if(!gpState.dpadD) { useTonic(); gpState.dpadD=true; } } else gpState.dpadD = false;
  if (gp.buttons[14]?.pressed) { if(!gpState.dpadL) { useAntidote(); gpState.dpadL=true; } } else gpState.dpadL = false;
  if (gp.buttons[15]?.pressed) { if(!gpState.dpadR) { useBomb(); gpState.dpadR=true; } } else gpState.dpadR = false;

  // Skills Menu (R3)
  btn(11, () => {
      if (typeof window.openSkillsModal === 'function') window.openSkillsModal();
  });

  } catch (error) {
      console.warn("Caught Controller Error (Loop Saved):", error);
  }

  // Safely queue the next frame exactly once
  requestAnimationFrame(pollGamepad);
}
requestAnimationFrame(pollGamepad);

// --- FIX 2: Monkey Easter Egg ---
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'm' && document.activeElement.tagName !== 'INPUT') {
    const audio = new Audio('https://cdn.jsdelivr.net/gh/MrCaptainNoodles/LightsLastBreath@main/monkey.mp3');
    audio.volume = 0.6;
    audio.play().catch(err => console.warn("Browser blocked audio auto-play:", err));
    
    let img = document.getElementById('monkeyEasterEggImg');
    if (!img) {
      img = document.createElement('img');
      img.id = 'monkeyEasterEggImg';
      img.src = 'https://cdn.jsdelivr.net/gh/MrCaptainNoodles/LightsLastBreath@main/monkey.png';
      img.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); z-index:9999999; max-width:80vmin; max-height:80vmin; pointer-events:none;';
      document.body.appendChild(img);
    }
    img.style.display = 'block';
    setTimeout(() => { if (img) img.style.display = 'none'; }, 1500);
  }
});

// keyboard controls (desktop)
window.addEventListener('keydown', (e) => {
  if (!e.isGamepad) updateControlUI('keyboard');
  // Don’t hijack keys while typing in inputs/textareas
  if (document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;

  const k = (e.key || '').toLowerCase();
  const isPaused = !!state._pauseOpen;

  // Prevent page scrolling / default behavior for our game keys
  if (['arrowup','arrowdown','arrowleft','arrowright',' ','e','q','w','a','s','d','h','i','p','b','1','2','3','escape'].includes(k)) {
    e.preventDefault();
  }

  // --- Escape: toggle Pause menu while in a run ---
  if (k === 'escape') {
    const title    = document.getElementById('titleScreen');
    const menu     = document.getElementById('mainMenu');
    const demoEnd  = document.getElementById('demoEndOverlay');
    const settings = document.getElementById('settingsOverlay');
    const credits  = document.getElementById('creditsOverlay');

    const onTitle   = title    && title.style.display !== 'none';
    const onMenu    = menu     && menu.style.display !== 'none';
    const inOverlay = (demoEnd  && demoEnd.style.display  !== 'none') ||
                      (settings && settings.style.display !== 'none') ||
                      (credits  && credits.style.display  !== 'none');

    const inRun = !onTitle && !onMenu && !inOverlay && !state.gameOver;

    if (isPaused) {
      // Already paused → Resume
      closePauseMenu();
    } else if (inRun && !state._inputLocked && !state._descending) {
    // Start pause only during active runs, not during level-up/cutscenes
    openPauseMenu();
  }

    return; // don’t let Escape fall through
  }

  // If paused, ignore all other keys (mouse-only while menu is open)
  if (isPaused) {
    return;
  }

  // If input is hard-locked (level-up, merchant, blacksmith, cutscenes, STAIRS), ignore keys
  if (state._inputLocked || state._descending) {
    return;
  }

 // Tutorial Step 1: Movement
if (state.gameMode === 'tutorial' && state.tutorialStep === 1){
  if (k === 'w' || k === 'arrowup') state._tutMoveWASD.w = true;
  if (k === 'a' || k === 'arrowleft') state._tutMoveWASD.a = true;
  if (k === 's' || k === 'arrowdown') state._tutMoveWASD.s = true;
  if (k === 'd' || k === 'arrowright') state._tutMoveWASD.d = true;

  if (state._tutMoveWASD.w && state._tutMoveWASD.a && state._tutMoveWASD.s && state._tutMoveWASD.d){
            state.tutorialStep = 2;
            hideBanner();
            // Use fallback ternary to ensure it safely resolves in all scopes
            showBanner(`Step 2: Sprinting. Hold (${window.getInputName ? window.getInputName('sprint') : 'Sprint'}) while moving to Sprint. Be careful this consumes stamina.`, 999999);
          }
}

// --- normal controls (Updated for Sprint) ---
  if (k === 'arrowup' || k === 'w' || k === 'arrowdown' || k === 's' || k === 'arrowleft' || k === 'a' || k === 'arrowright'|| k === 'd') {
    
    // --- NEW: Idol of Stone (Slow) - Applies to Walk AND Sprint ---
    if (state.inventory.idols?.['Idol of Stone']) {
        // Toggle the skip flag
        state._stoneSkip = !state._stoneSkip;
        
        // If it's a skip turn, process enemies and STOP.
        if (state._stoneSkip) {
            spawnFloatText("Slow...", state.player.x, state.player.y, '#9ca3af');
            enemyStep(); // Enemies take their turn
            draw();      // Update screen
            return;      // BLOCK PLAYER INPUT
        }
    }

    let dx = 0, dy = 0;
    if (k === 'arrowup' || k === 'w') dy = -1;
  if (k === 'arrowdown' || k === 's') dy = 1;
  if (k === 'arrowleft' || k === 'a') dx = -1;
  if (k === 'arrowright'|| k === 'd') dx = 1;

// SPRINT CHECK: Holding Shift?
    if (e.shiftKey) {
      const sprintCost = getStaminaCost(3);
      if (state.player.stamina >= sprintCost) {
         const x1 = state.player.x + dx;
         const y1 = state.player.y + dy;
         
         // 1. Check first tile
         if (isPassableForPlayer(x1,y1)) {
             let finalX = x1, finalY = y1;
             let stopNow = (state.tiles[y1][x1] === 4); // STOP if x1 is stairs

             // 2. If x1 is NOT stairs, try moving to x2
             if (!stopNow) {
                 const x2 = x1 + dx, y2 = y1 + dy;
                 if (isPassableForPlayer(x2,y2)) {
                     finalX = x2; finalY = y2;
                     stopNow = (state.tiles[y2][x2] === 4); // STOP if x2 is stairs
                     
                     // 3. Glacial Freeze: If x2 is valid & NOT stairs, try x3 (Slide)
                     if (!stopNow && isEffectActive('GlacialFreeze')) { // Use helper
                         const x3 = x2 + dx, y3 = y2 + dy;
                         if (isPassableForPlayer(x3, y3)) {
                             finalX = x3; finalY = y3;
                         }
                     }
                 }
             }

             // If we calculated a valid sprint target (at least 2 steps, OR 1 step onto stairs)
             const dist = Math.abs(finalX - state.player.x) + Math.abs(finalY - state.player.y);
             if (dist >= 2 || (dist === 1 && stopNow)) {
                 state.player.stamina -= sprintCost;
                 
                 // --- TUTORIAL: Step 2 -> 3 (Sprint) ---
                 if (state.gameMode === 'tutorial' && state.tutorialStep === 2) {
                    state.tutorialStep = 3;
                    hideBanner();
                    showBanner(`Step 3: Break the Crate! Walk up to it and press (${getInputName('attack')}). Be careful this consumes stamina`, 999999);
                 }

                 updateBars();
                 state._skipStaminaRegen = true; 
                 
                 // FIX: Show "Slide!" if we moved 3 tiles, otherwise "Sprint"
                 if (dist >= 3) {
                    spawnFloatText("Slide!", state.player.x, state.player.y, '#6ec5ff');
                 } else {
                    spawnFloatText("Sprint", state.player.x, state.player.y, '#4ade80');
                 }
                 
                 if (dx>0) state.player.facing='right'; else if (dx<0) state.player.facing='left';
                 else if (dy>0) state.player.facing='down'; else if (dy<0) state.player.facing='up';
                 
                 state.player.x = finalX; state.player.y = finalY;
                 SFX.step(); 
                 collectIfPickup();
                 enemyStep(); 
                 draw();
                 return; // Handled
             }
         }
      } else {
         spawnFloatText("No Stamina", state.player.x, state.player.y, '#9ca3af');
      }
    }
  
  // Normal Move (1 tile)
  tryMove(dx, dy);
}

  else if (k === 'e') interact();
  else if (k === ' ') attack();        // melee
  else if (k === 'b') {                // bow
  const hadArrowLoaded = (state.player?.bow?.loaded|0) > 0;

  shootBow();

  // Tutorial (new): confirm they actually fired a shot (not "No arrow loaded.")
// IMPORTANT: do NOT advance the tutorial here — advancement happens when the stationary rat dies.
if (state.gameMode === 'tutorial' && (state._tutGotArrows || state._tutArrowsPicked) && hadArrowLoaded && !state._tutFiredBowOnce){
  state._tutFiredBowOnce = true;
}


  return;                            // consume the key so enemies don’t also move
}

  else if (k === 'q') cast();
  else if (k === 'r') useWeaponArt(); // --- NEW: Bind R for Ability ---
  else if (k === 'k') {
      if (typeof window.openSkillsModal === 'function') window.openSkillsModal();
  }

  // --- NEW: Cycle Spells (F) ---
  else if (k === 'f') {
    if (state.spells && state.spells.length > 0) {
       let idx = -1;
       if (state.equippedSpell) {
         idx = state.spells.findIndex(s => s.name === state.equippedSpell.name);
       }
       // Cycle forward, loop to start
       const next = state.spells[(idx + 1) % state.spells.length];
       state.equippedSpell = next;
       
       updateEquipUI();
       spawnFloatText(next.name, state.player.x, state.player.y, '#60a5fa'); // Blue text
       SFX.pickup(); // Click sound
    } else {
       log("No spells memorized.");
    }
  }
  // -----------------------------

    // --- Hotkeys / modals / tutorial steps ---
    else if (k === '1') {

      // === Tutorial Step 6: must use antidote (3) before potion (1) ===
      if (state.gameMode === 'tutorial' && state.tutorialStep === 6) {

        // Don’t let them waste the only potion before curing poison
        if (!state._tutStep6UsedAntidote) {
          hideBanner();
          showBanner("Use 3 first (antidote). Then use 1 (potion).", 2200);
        } else {
          // drink potion
          usePotion();

          if (!state._tutStep6UsedPotion) {
            state._tutStep6UsedPotion = true;
            // INSERT NEW STEP: Weapon Arts
            state.tutorialStep = 6.5; 
            
            // Reset cooldown so they can use it immediately
            state.player.artCooldown = 0;
            updateEquipUI();

            // --- FIX: Check flag so we don't spawn 4 rats if attack() already spawned 2 ---
            if (!state._tutArtTargetSpawned) {
              state._tutArtTargetSpawned = true;
              
              // Spawn 2 rats horizontally adjacent (18,15 and 19,15)
              // ADDED: stunTicks:9999 so they don't move/attack
              state.enemies.push({
                x:18, y:15, type:'Rat', hp:1, atk:[1,2], xp:3, 
                stunTicks:9999, tutorialDummy:true
              });
              state.enemies.push({
                x:19, y:15, type:'Rat', hp:1, atk:[1,2], xp:3, 
                stunTicks:9999, tutorialDummy:true
              });
            }
            // -----------------------------------------------------------------------------

            hideBanner();
            showBanner("Health restored. New targets ahead! Walk up to them and press R to use your Axe's CLEAVE ability.", 999999);
          }
        }

      } else {
        // normal behavior
        usePotion();

        // Tutorial: (legacy) advancement disabled — new tutorial uses different steps now
        if (state.gameMode === 'tutorial' && state.tutorialStep === 999) {
          state.tutorialStep = 2;
          say("Great! Now use the WASD/Arrow Keys to pick up and equip the weapon off the floor.");
        }
      }
    }
  else if (k === '2') {
    useTonic();

    // Tutorial Step 8 -> 9 (Tonic used)
    if (state.gameMode === 'tutorial' && state.tutorialStep === 8) {
      state.tutorialStep = 9;
      hideBanner();
      showBanner("Mana restored. Walk to the locked door below and press E to use a lockpick.", 999999);
    }
  }
  else if (k === '3') {
    useAntidote();
  }
  // --- NEW: Keybinds for Consumables ---
  else if (k === '4') { useBomb(); }
  else if (k === '5') { useWarpStone(); }
  // -------------------------------------

  else if (k === 'h') {
    const m = document.getElementById('helpModal');
    if (m) m.style.display = (m.style.display === 'flex' ? 'none' : 'flex');
  }
    else if (k === 'i') {
  const m = document.getElementById('invModal');

  if (m && m.style.display === 'flex') {
    // closing inventory
    m.style.display = 'none';

    // clear tab highlight (in case we added it)
    try{
      ['tabItems','tabShield','tabWeapons'].forEach(id=>{
        const btn = document.getElementById(id);
        if (btn){ btn.style.outline=''; btn.style.outlineOffset=''; }
      });
    }catch{}

    // Tutorial Step 2 safeguard (movement first)
    if (state.gameMode === 'tutorial' && state.tutorialStep === 0 && !state._tutMoveDone) {
      showBanner("Tutorial: Move first — press W A S D (or ↑ ↓ ← →) once each.", 2200);
    }

    // Tutorial Step 3: after they close Inventory, prompt Spell Book (P)
    if (state.gameMode === 'tutorial' && state.tutorialStep === 1) {
      hideBanner();
      state.tutorialStep = 2;
      say("Nice. Now press P to open your Spell Book.");
    }

} else {
  // opening inventory

  // Tutorial: when they press I the first time after movement, clear the "press I" prompt immediately
  if (state.gameMode === 'tutorial' && state.tutorialStep === 1 && state._tutMoveDone && !state._tutInvPromptCleared){
    state._tutInvPromptCleared = true;
    hideBanner();
  }

  updateInvBody();
  if (m) {
    m.style.display = 'flex';
  }

  // Tutorial Step 3: show tabs + highlight them once
  if (state.gameMode === 'tutorial' && state.tutorialStep === 1 && !state._tutInvTabsShown) {
    state._tutInvTabsShown = true;
    showBanner("Inventory tabs: Items / Shield / Weapons. Click a tab, then press I to close.", 999999);

    try{
      ['tabItems','tabShield','tabWeapons'].forEach(id=>{
        const btn = document.getElementById(id);
        if (btn){ btn.style.outline='2px solid #f9d65c'; btn.style.outlineOffset='2px'; }
      });
    }catch{}
  }
}

}

else if (k === 'p') {
  const m = document.getElementById('spellModal');

  if (m && m.style.display === 'flex') {
    // closing spell menu
    m.style.display = 'none';

    // Tutorial Step 4: ONLY after closing Spell Book, prompt arrows pickup
    if (state.gameMode === 'tutorial' && state.tutorialStep === 3) {
      hideBanner();
      state.tutorialStep = 4;
      showBanner("Next: pick up the arrows on the floor. Then face the training rat and press B to shoot.", 999999);
    }

  } else {
    updateSpellBody();
    if (m) {
      m.style.display = 'flex';

      // Tutorial Step 3: open Spell Book, but DON'T mention arrows yet
      if (state.gameMode === 'tutorial' && state.tutorialStep === 2) {
        hideBanner();
        state.tutorialStep = 3;
        showBanner("Spell Book opened. This is where you manage spells. Press P again to close.", 999999);
      }

      // keep your existing (legacy) tutorial logic untouched for now
      if (state.gameMode === 'tutorial' && state.tutorialStep === 4) {
        state.tutorialStep = 5;
        say("Spell menu opened. Press Q to use your equipped spell. Close the spell menu, then stand next to the locked door and press E to pick the lock.");
      }
    }
  }
}




  updateBars();
});


// ====== Boot ======
function boot(){
  updateControlUI('keyboard'); // Initialize help text
  gen();
  enemyStep();            // ← ADD: wake AI on room load
  // NEW: make sure the starting tile is revealed immediately
  state.seen.add(key(state.player.x, state.player.y));

  state.spells = [];
  updateBars(); updateEquipUI(); renderSkills();
  log('You awaken with nothing. Explore, loot, survive.');
  log('A chest is nearby.');
  renderLog();
  draw();
}



// === High score / run stats bootstrap ===
const HS_KEY = 'dc_hi10';
const META_KEY = 'dc_meta_v1';

const CLASSES = {
  Adventurer: { name:'Adventurer', desc:'Just a basic adventurer.', unlock:true },
  
  // Basic Classes
  Rogue:      { name:'Rogue',      desc:'Shortsword, 8 Picks, Bomb. +5 Stam/MP, -2 HP.', req:'locks', val:15, msg:'Unlock: Pick 15 locks.' }, 
  Barbarian:  { name:'Barbarian',  desc:'Battleaxe, Potion. +15 HP, +5 Stam. No Magic.', req:'kills_axe', val:50, msg:'Unlock: 50 Axe kills.' }, 
  Wizard:     { name:'Wizard',     desc:'Fire Staff, Spark, Ember. +25 MP, -8 HP.', req:'kills_magic', val:50, msg:'Unlock: 50 Magic kills.' }, 
  
  // Endless: Intermediate Classes
  Mercenary:  { name:'Mercenary',  desc:'Claymore, 50g. +5 HP, +2 Stam, -5 MP.', req:'kills_two', val:75, msg:'Unlock: 75 Two-Handed kills.', endless:true }, 
  Monk:       { name:'Monk',       desc:'Claws, Heal Spell. +15 MP, +8 Stam, -2 HP.', req:'kills_hand', val:75, msg:'Unlock: 75 Hand to Hand kills.', endless:true }, 
  Ranger:     { name:'Ranger',     desc:'Sword, 30 Arrows, Gust. +5 MP, +5 Stam.', req:'kills_bow', val:50, msg:'Unlock: 50 Bow kills.', endless:true }, 
  Lancer:     { name:'Lancer',     desc:'Halberd, 2 Bombs. +12 Stam, +2 HP, -8 MP.', req:'kills_spear', val:75, msg:'Unlock: 75 Polearm kills.', endless:true }, 
  Soldier:    { name:'Soldier',    desc:'Sword, Kite Shield, Potion. +8 HP, +2 Stam.', req:'depth', val:15, msg:'Unlock: Reach Depth 15.', endless:true }, 

  // Endless: Expert Classes
  Spellblade: { name:'Spellblade', desc:'Sword, Ice Staff, Frost. +15 MP, +3 Stam, -2 HP.', req:'kills_magic', val:200, msg:'Unlock: 200 Magic kills.', endless:true }, 
  Legionary:  { name:'Legionary',  desc:'Sword, Tower Shield, 2 Potions. +12 HP. No Magic.', req:'kills_one', val:200, msg:'Unlock: 200 One-Handed kills.', endless:true }, 
  Paladin:    { name:'Paladin',    desc:'Warhammer, Antidotes. +30 HP. Low Stam/MP.', req:'depth', val:40, msg:'Unlock: Reach Depth 40.', endless:true }, 
};

// --- NEW: Soul Shop Definitions ---
const SOUL_UPGRADES = {
  vitality: { name:'Vitality', desc:'Start with +5 Max HP.', cost:100, max:5 },
  greed:    { name:'Greed',    desc:'Start with +25 Gold.',  cost:75,  max:5 },
  wisdom:   { name:'Wisdom',   desc:'Start with +10 Max MP.',cost:100, max:5 },
  endurance:{ name:'Endurance',desc:'Start with +5 Max Stamina.', cost:100, max:5 }, // <--- Added this line
  pockets:  { name:'Deep Pockets', desc:'Start with +1 Potion.', cost:150, max:3 },
  vision:   { name:'Owl Eyes', desc:'Start with +1 Vision Range.', cost:300, max:2 }
};

function getSoulBalance(){
  const m = loadMeta();
  return m.shards || 0;
}

function renderShopUI(){
  const list = document.getElementById('shopList');
  const balEl = document.getElementById('shopBalance');
  const modeLabel = document.getElementById('shopModeLabel');
  
  // Default to Classic if not set
  if (!state.ui) state.ui = {};
  if (!state.ui.shopTab) state.ui.shopTab = 'classic'; 

  const isEndlessUnlocked = localStorage.getItem('endlessUnlocked') === '1';
  // If Endless is not unlocked, force user onto Classic tab
  if (!isEndlessUnlocked) state.ui.shopTab = 'classic'; 

  const isEndless = (state.ui.shopTab === 'endless');
  const prefix = isEndless ? 'endless_upg_' : 'upg_'; // Separate save keys

  // Update Tab Visuals
  const btnC = document.getElementById('btnShopClassic');
  const btnE = document.getElementById('btnShopEndless');
  if(btnC) {
      btnC.style.border = isEndless ? '1px solid var(--chipBorder)' : '2px solid #f9d65c';
      btnC.style.opacity = isEndless ? '0.6' : '1.0';
      btnC.onclick = () => { state.ui.shopTab = 'classic'; renderShopUI(); };
  }
  if(btnE) {
      // NEW: Show/Hide Endless Button
      btnE.style.display = isEndlessUnlocked ? '' : 'none';
      
      btnE.style.border = isEndless ? '2px solid #f9d65c' : '1px solid var(--chipBorder)';
      btnE.style.opacity = isEndless ? '1.0' : '0.6';
      btnE.onclick = () => { state.ui.shopTab = 'endless'; renderShopUI(); };
  }
  
  if (modeLabel) modeLabel.textContent = isEndless ? "Endless Mode Upgrades" : "Classic Mode Upgrades";

  const m = loadMeta();
  const bal = m.shards || 0;
  
  balEl.textContent = `${bal} Shards`;
  list.innerHTML = '';

  for(const [k, def] of Object.entries(SOUL_UPGRADES)){
    // Use the prefix to load specific data
    const level = m[prefix + k] || 0; 
    
    const isMax = level >= def.max;
    const cost = Math.floor(def.cost * (1 + level * 0.5));
    
    const row = document.createElement('div');
    row.className = 'card';
    row.style.padding = '10px';
    row.style.display = 'flex';
    row.style.justifyContent = 'space-between';
    row.style.alignItems = 'center';
    row.style.backgroundColor = 'rgba(0,0,0,0.2)';
    
    const info = document.createElement('div');
    info.innerHTML = `<div style="font-weight:bold; color:#d9e7f5">${def.name} <span style="opacity:0.6">(${level}/${def.max})</span></div>
                      <div style="font-size:13px; opacity:0.8">${def.desc}</div>`;
    
    const btn = document.createElement('button');
    btn.className = 'btn';
    
    if(isMax){
      btn.textContent = 'MAX';
      btn.disabled = true;
      btn.style.opacity = 0.5;
    } else {
      btn.textContent = `Buy (${cost})`;
      if(bal < cost) {
        btn.disabled = true;
        btn.style.opacity = 0.5;
      }
      btn.onclick = () => {
        m.shards -= cost;
        // Use the prefix to SAVE specific data
        m[prefix + k] = level + 1;
        saveMeta(m);
        SFX.levelUp(); 
        renderShopUI(); 
        updateMainMenuShopLabel();
      };
    }
    
    row.appendChild(info);
    row.appendChild(btn);
    list.appendChild(row);
  }
}

function updateMainMenuShopLabel(){
  const el = document.getElementById('btnShop');
  if(el) el.textContent = `Soul Shop`;
}

function loadMeta(){ try{ return JSON.parse(localStorage.getItem(META_KEY)||'{}'); }catch{ return {}; } }
function saveMeta(m){ localStorage.setItem(META_KEY, JSON.stringify(m)); }

function incrementMetaStat(key, amt=1){
  const m = loadMeta();
  m[key] = (m[key]||0) + amt;
  
  // Check for unlocks immediately
  for(const cKey in CLASSES){
    const c = CLASSES[cKey];

    // --- NEW: Prevent unlocking Endless classes while playing Classic ---
    if (c.endless && state.gameMode !== 'endless') continue;
    // ------------------------------------------------------------------

    if(c.req === key && m[key] >= c.val && !m['unlocked_'+cKey]){
      m['unlocked_'+cKey] = true;
      showBanner(`Unlocked Class: ${c.name}!`, 4000);
      SFX.levelUp?.();
    }
  }
  saveMeta(m);
}

function loadHi(){ try{ return JSON.parse(localStorage.getItem(HS_KEY)||'[]'); }catch{ return []; } }
function saveHi(list){ localStorage.setItem(HS_KEY, JSON.stringify(list)); }

function freshRunStats(){
  return {
    initials: '',
    depth: 1,
    level: 1,
    kills: 0,
    ended: false,
    when: Date.now(),     // tiebreak
    startAt: 0,           // timer start
    endAt:   0,           // timer freeze
    elapsedMs: 0,
    finalMs: 0,
    timeMs:  0
  };
}

state.run = freshRunStats();
state._hiscores = loadHi();

// ===== Run Timer helpers =====
let __runTimerIvl = null;

function formatRunTime(ms){
  ms = Math.max(0, ms|0);
  const totalS = Math.floor(ms / 1000);
  const h = Math.floor(totalS / 3600);
  const m = Math.floor((totalS % 3600) / 60);
  const s = totalS % 60;
  const hh = String(h).padStart(2,'0');
  const mm = String(m).padStart(2,'0');
  const ss = String(s).padStart(2,'0');
  return `${hh}:${mm}:${ss}`;
}


function ensureRunTimerNode(){
  let el = document.getElementById('runTimer');
  if (!el){
    const cw = document.getElementById('cw');
    if (cw){
      el = document.createElement('div');
      el.id = 'runTimer';
      el.textContent = '00:00:00';
      el.style.cssText = 'position:absolute; top:8px; left:8px; z-index:16; padding:4px 8px; border-radius:8px; background:rgba(0,0,0,.45); border:1px solid rgba(255,255,255,.15); color:#eaf2ff; font:800 13px/1 ui-sans-serif,system-ui; letter-spacing:.02em;';
      cw.appendChild(el);
    }
  }
  return el;
}

function currentRunMs(){
  const r = (typeof state !== 'undefined' && state.run) ? state.run : { startAt:0, elapsedMs:0, endAt:0 };
  if (!r.startAt) return 0;
  const end = r.endAt || Date.now();
  return (r.elapsedMs|0) + (end - r.startAt);
}

function updateRunTimerNow(){
  const el = ensureRunTimerNode();
  if (!el) return;
  const ms = currentRunMs();
  el.textContent = formatRunTime(ms);
}

function startRunTimer(){
  // reset and start
  state.run.startAt = Date.now();
  state.run.endAt   = 0;
  state.run.elapsedMs = 0;
  state.run.finalMs = 0;
  state.run.timeMs  = 0;
  updateRunTimerNow();
  if (__runTimerIvl) clearInterval(__runTimerIvl);
  __runTimerIvl = setInterval(updateRunTimerNow, 100); // smooth ticking even when idle
}

function stopRunTimerFreeze(){
  if (!state.run.endAt){
    state.run.endAt  = Date.now();
    state.run.finalMs = currentRunMs();
    state.run.timeMs  = state.run.finalMs;
  }
  updateRunTimerNow();
}


function doRestart(className){
  // --- FIX: Wipe old save & Clear Visuals immediately ---
  localStorage.removeItem('dc_save_v1');

  // 1. HARD RESET: Wipe everything visual logic uses
  state.particles = [];
  state.floatingText = [];
  state.projectiles = [];
  state.explosions = [];
  state.enemies = []; 
  
  // 2. Clear Props & Pickups (The "Ghost Objects" you were seeing)
  state.props = {};
  state.pickups = {};
  state.decals = []; 
  
  // 3. Reset Map & Fog (Prevents Boss Floor "No Fog" form revealing the empty map)
  const W = state.size.w || 50, H = state.size.h || 50;
  state.tiles = Array.from({length:H}, ()=>Array(W).fill(0)); 
  state.seen = new Set(); 
  state.noFog = false; // <--- CRITICAL: Turns fog back on so you don't see the black void
  
// 4. Force Clear Canvas
  state._animating = false;

  // FIX: Correct ID is "bossHud" (camelCase), not "boss-hud"
  const hud = document.getElementById('bossHud');
  if (hud) hud.style.display = 'none';

  const cvs = document.getElementById('view');
  const cx = cvs ? cvs.getContext('2d') : null;
  if (cx) {
    // Robust clear: reset transform, clear rect, then fill
    cx.save();
    cx.setTransform(1, 0, 0, 1, 0, 0); 
    cx.clearRect(0, 0, cvs.width, cvs.height);
    cx.fillStyle = '#0b141d';
    cx.fillRect(0, 0, cvs.width, cvs.height);
    cx.restore();
  }

  // 5. Stop Audio
  if(typeof stopBgm === 'function') stopBgm();
  // -----------------------------------------------------

  // --- FIX: Toggle UI Bars ---
  // Hide bars if in menu (no className), Show them if starting run (has className)
  const uiBars = document.querySelector('.bars');
  if (uiBars) uiBars.style.visibility = className ? 'visible' : 'hidden';

  // --- Class Selection Intercept ---
  if (!className) {
    const meta = loadMeta();
    let available = Object.keys(CLASSES);

    // FILTER: If Classic Mode, hide classes marked 'endless: true'
    if (state.gameMode === 'classic') {
      available = available.filter(k => !CLASSES[k].endless);
    }

    // Determine which of the available classes are actually unlocked
      const unlocked = available.filter(k => CLASSES[k].unlock || meta['unlocked_'+k]);

      // Show menu if ANY class is available (even just the default)
      // Show menu if ANY class is available (even just the default)
      if (unlocked.length >= 1) {
          // --- FIX: Stop Audio & Safely Wipe Visuals ---
          if(typeof stopBgm === 'function') stopBgm(); 
          state.enemies = [];      
          state.particles = [];    
          state.floatingText = []; 
          state.projectiles = [];
          
          // CRITICAL FIX: Create a valid empty map (all walls).
          // Setting tiles=[] caused draw() to crash and freeze the old screen.
          const W = state.size.w || 50, H = state.size.h || 50;
          state.tiles = Array.from({length:H}, ()=>Array(W).fill(0)); 
          state.seen = new Set(); // Clear vision so nothing is drawn
          
          // Clear canvas explicitly
          const cvs = document.getElementById('view');
          const cx = cvs ? cvs.getContext('2d') : null;
          if (cx) {
              cx.fillStyle = '#0b141d';
              cx.fillRect(0, 0, cvs.width, cvs.height);
          }
          const ft = document.getElementById('floorTint');
          if (ft) ft.style.background = 'rgba(0,0,0,0)';
          // --------------------------------------------------
          // --------------------------------------------------
          
          const m = document.getElementById('classSelectModal');
          const b = document.getElementById('classSelectBody');
      b.innerHTML = '';
      // --- NEW: Grid Layout Styles (4 Columns Fixed) ---
      b.style.display = 'grid';
      b.style.gridTemplateColumns = 'repeat(4, 1fr)'; 
      b.style.gap = '10px';
      b.style.padding = '10px';
      
      // 1. Show Unlocked Classes
      unlocked.forEach(k => {
        const c = CLASSES[k];
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.style.textAlign = 'center';
        
        // Force Square Shape & Center Content
        btn.style.aspectRatio = '1 / 1'; 
        btn.style.display = 'flex';
        btn.style.flexDirection = 'column';
        btn.style.justifyContent = 'center';
        btn.style.alignItems = 'center';
        btn.style.padding = '4px';
        btn.style.minHeight = '0'; // Reset min-height so aspect-ratio rules
        
        const badge = c.endless ? '<div style="color:#a78bfa; font-size:9px; margin-bottom:2px;">(Endless)</div>' : '';
        
        // Name is bold, Description is small (visible inside the square)
        btn.innerHTML = `
            ${badge}
            <div style="font-weight:800; font-size:13px; color:#f9d65c; line-height:1.1; margin-bottom:4px;">${c.name}</div>
            <div style="font-size:10px; opacity:0.8; line-height:1.1; overflow:hidden;">${c.desc}</div>
        `;
        
        // Also add full description as tooltip just in case it cuts off
        btn.title = c.desc; 
        
        btn.onclick = () => {
          m.style.display = 'none';
          doRestart(k); 
        };
        b.appendChild(btn);
      });
      
      // 2. Show Locked Classes (grayed out)
      available.forEach(k => {
        if (unlocked.includes(k)) return;
        const c = CLASSES[k];
        const d = document.createElement('div');
        d.className = 'chip';
        d.style.opacity = '0.5';
        d.style.textAlign = 'left';
        d.innerHTML = `🔒 <b>${c.name}</b><br><span style="font-size:12px">${c.msg || 'Locked'}</span>`;
        b.appendChild(d);
      });

      m.style.display = 'flex';
      const go = document.getElementById('gameOverModal');
      if (go) go.style.display = 'none';
      return; 
    }
    
    className = 'Peasant';
  }
  // --------------------------------------

  state.gameOver = false;
  state._inputLocked = false; 
  state.player.poisoned = false;
  state.player.poisonTicks = 0;
  state.gameMode = state.gameMode || 'classic';

  // 1. ADDED: Clear run flags (cutscenes, boss states)
  state.flags = {}; 

  delete state.floorEffect;
  delete state.player.tempVisionRange;
  state._miasmaSteps = 0;
  const tintEl = document.getElementById('floorTint');
  if (tintEl) tintEl.style.background = 'rgba(0,0,0,0)';

  state.run = freshRunStats();
  if (!state._hiscores) state._hiscores = loadHi();

  state.floor = 1;
  state.player.level = 1;
  state.player.xp = 0;
  state.player.next = PLAYER_XP_START;          
  state.player.hpMax = 20;
  state.player.mpMax = 10;
  
  // --- NEW: Stamina Init ---
  state.player.staminaMax = 10;
  state.player.stamina = 10;

// --- HARD RESET PLAYER STATE (Moved Above Class Modifiers) ---
  state.player = {
    x:0, y:0, rx:0, ry:0,
    level:1, xp:0, next:PLAYER_XP_START,
    hpMax:20, mpMax:10,
    hp:20, mp:10,
    stamina:10, staminaMax:10,
  poisoned:false, poisonTicks:0,
  facing:'down',
  bow:{ range:5, loaded:0 },
  artCooldown: 0,
  shield: null,
  trinket: null,  // NEW: Slot for passive gear
  regenTicker: 0  // NEW: Counter for HP regen effects
};

  // --- Apply Class Stats Modifiers ---
  // Adjusted for thematic attunement
  if (className === 'Barbarian') {
    state.player.hpMax += 15; state.player.hp = state.player.hpMax; // Tanky
    state.player.staminaMax += 5; state.player.stamina = state.player.staminaMax; // High endurance
    state.player.mpMax = 0; state.player.mp = 0; // No magic
  } else if (className === 'Wizard') {
    state.player.mpMax += 25; state.player.mp = state.player.mpMax; // Huge mana pool
    state.player.hpMax -= 8;  state.player.hp = state.player.hpMax; // Very fragile
    state.player.staminaMax -= 2; state.player.stamina = state.player.staminaMax; // Physically weak
  } else if (className === 'Rogue') {
    state.player.staminaMax += 5; state.player.stamina = state.player.staminaMax; // Agile
    state.player.hpMax -= 2;  state.player.hp = state.player.hpMax;
    state.player.mpMax += 5;  state.player.mp = state.player.mpMax; // Utility magic
  } else if (className === 'Mercenary') {
    state.player.hpMax += 5;  state.player.hp = state.player.hpMax;
    state.player.staminaMax += 2; state.player.stamina = state.player.staminaMax;
    state.player.mpMax = Math.max(0, state.player.mpMax - 5); state.player.mp = state.player.mpMax;
  } else if (className === 'Monk') {
    state.player.staminaMax += 8; state.player.stamina = state.player.staminaMax; // Stamina heavy (Flurry)
    state.player.mpMax += 15; state.player.mp = state.player.mpMax; // Chi/Mana focus
    state.player.hpMax -= 2;  state.player.hp = state.player.hpMax;
  } else if (className === 'Ranger') {
    state.player.staminaMax += 5; state.player.stamina = state.player.staminaMax; // Kiting stamina
    state.player.mpMax += 5;  state.player.mp = state.player.mpMax;
  } else if (className === 'Lancer') {
    state.player.staminaMax += 12; state.player.stamina = state.player.staminaMax; // Needs stamina for Pierce
    state.player.hpMax += 2; state.player.hp = state.player.hpMax;
    state.player.mpMax = Math.max(0, state.player.mpMax - 8); state.player.mp = state.player.mpMax;
  } else if (className === 'Soldier') {
    state.player.hpMax += 8;       state.player.hp = state.player.hpMax;
    state.player.staminaMax += 2;  state.player.stamina = state.player.staminaMax;
    state.player.mpMax = Math.max(0, state.player.mpMax - 8); state.player.mp = state.player.mpMax;
  } else if (className === 'Spellblade') {
    state.player.mpMax += 15; state.player.mp = state.player.mpMax; // Needs MP for spells & melee
    state.player.staminaMax += 3; state.player.stamina = state.player.staminaMax;
    state.player.hpMax -= 2; state.player.hp = state.player.hpMax; // Glass cannon hybrid
  } else if (className === 'Paladin') {
    state.player.hpMax += 30; state.player.hp = state.player.hpMax; // Massive Tank
    state.player.staminaMax -= 2; state.player.stamina = state.player.staminaMax; // Heavy armor penalty
    state.player.mpMax = Math.max(0, state.player.mpMax - 10); 
    state.player.mp = state.player.mpMax;
    if (state.player.mpMax <= 0) state.player.mp = 0;
  } else if (className === 'Legionary') {
    state.player.hpMax += 12; state.player.hp = state.player.hpMax;
    state.player.staminaMax += 5; state.player.stamina = state.player.staminaMax; // Shield work takes stamina
    state.player.mpMax = 0; state.player.mp = 0; // Pure martial
  }

  // --- Apply Soul Shop Upgrades (IF NOT TUTORIAL) ---
  const meta = loadMeta();
  // Disable shop upgrades for Tutorial to keep it standard
  const upgPrefix = (state.gameMode === 'endless') ? 'endless_upg_' : 'upg_';
  const isTut = (state.gameMode === 'tutorial');

  if (!isTut) {
    state.player.hpMax += ((meta[upgPrefix+'vitality']||0) * 5);
    state.player.mpMax += ((meta[upgPrefix+'wisdom']||0) * 10);
    state.player.staminaMax += ((meta[upgPrefix+'endurance']||0) * 5); // <--- Added: Apply Max Stamina boost
  }

  state.player.hp = state.player.hpMax;
  state.player.mp = state.player.mpMax;
  state.player.stamina = state.player.staminaMax; // <--- Added: Fill Stamina to new Max

  // Defaults
  state.player.weapon = { name:'Fists', type:'hand', min:1, max:2, base:{min:1,max:2}, dur:null, durMax:null };
  state.player.artCooldown = 0; 

  state.fovRadius = 5 + ((meta[upgPrefix+'vision']||0) * 1);
  state.spells = [];
  state.equippedSpell = null;
  state.player.bow = { range:5, loaded:0 };
  state._hitParity = 0;
  state.player.shield = null;     
  state._shieldParity = 0;
  state.skills = {};

// Disable shop items for Tutorial
  const pockets = isTut ? 0 : ((meta[upgPrefix+'pockets']||0) * 1);
  const greed   = isTut ? 0 : ((meta[upgPrefix+'greed']||0) * 25);

  state.inventory = {
    lockpicks: 0, 
    potions: pockets, 
    tonics: 0, antidotes: 0, 
    weapons: {}, stashed: {}, arrows: 0, 
    gold: greed,     
    shields: 0, bombs:0, warpStones:0
  };

  // --- Apply Class Gear ---
  if (className === 'Rogue') {
    state.inventory.weapons['Shortsword'] = 1; 
    equipWeaponByName('Shortsword');
    state.inventory.lockpicks = 8; // More picks for the thief archetype
    state.inventory.bombs = 1; // A tool for sticky situations
  } else if (className === 'Barbarian') {
    state.inventory.weapons['Battleaxe'] = 1; // Upgraded from Axe to Battleaxe
    equipWeaponByName('Battleaxe');
    state.inventory.potions = 1; // Self-sustain for melee
  } else if (className === 'Wizard') {
    state.inventory.weapons['Fire Staff'] = 1; equipWeaponByName('Fire Staff');
    state.spells.push({name:'Ember', cost:3, tier:1}); 
    state.spells.push({name:'Spark', cost:1, tier:1}); // Basic low-cost spell backup
    state.equippedSpell = state.spells[0];  
    state.inventory.tonics = 2; // Mana sustain
  }
// -- New Classes --
  else if (className === 'Mercenary') {
    state.inventory.weapons['Claymore'] = 1;
    equipWeaponByName('Claymore');
    state.inventory.gold = 50; // Mercenaries start with coin
  } else if (className === 'Monk') {
    state.inventory.weapons['Claws'] = 1; // Upgraded from Knuckle Duster to Claws
    equipWeaponByName('Claws');
    state.spells.push({name:'Heal', cost:4, tier:1}); // Self-sufficiency
    state.equippedSpell = state.spells[0];
  } else if (className === 'Ranger') {
    state.inventory.weapons['Shortsword'] = 1;
    equipWeaponByName('Shortsword');
    state.inventory.arrows = 30; // More ammo
    state.player.bow.loaded = 1;
    state.spells.push({name:'Gust', cost:2, tier:1}); // Control spell (Wind)
    state.equippedSpell = state.spells[0];
  } else if (className === 'Lancer') {
    state.inventory.weapons['Halberd'] = 1; equipWeaponByName('Halberd');
    state.inventory.bombs = 2; // Zone control
  } else if (className === 'Soldier') {
    state.inventory.weapons['Shortsword'] = 1; equipWeaponByName('Shortsword');
    state.inventory.weapons['Kite Shield'] = 1; equipShield('Kite Shield');
    state.inventory.potions = 1; // Standard issue
  } else if (className === 'Spellblade') {
    state.inventory.weapons['Shortsword'] = 1; equipWeaponByName('Shortsword');
    state.inventory.weapons['Ice Staff'] = 1; 
    state.spells.push({name:'Frost', cost:3, tier:1}); // Ice synergy
    state.spells.push({name:'Spark', cost:1, tier:1}); // Fast cast
    state.equippedSpell = state.spells[0];
  } else if (className === 'Legionary') {
    state.inventory.weapons['Shortsword'] = 1; equipWeaponByName('Shortsword');
    state.inventory.weapons['Tower Shield'] = 1; equipShield('Tower Shield'); // Tankiest shield
    state.inventory.potions = 2; // Sustain
  } else if (className === 'Paladin') {
    state.inventory.weapons['Warhammer'] = 1; equipWeaponByName('Warhammer');
    state.inventory.antidotes = 2; // Purity theme
    state.inventory.shields = 1; // Starts with spare standard shield
  }

  // Finalize
  gen();
  state.player.rx = state.player.x;
  state.player.ry = state.player.y;
  enemyStep();
  draw?.();
  updateBars();
  updateEquipUI();
  renderSkills && renderSkills();
  startRunTimer();
  updateRunTimerNow();
  
  // --- FIX: Start Floor 1 Music Here ---
  // We do this AFTER gen() so state.floor is correct (1)
  if(typeof updateDynamicMusic === 'function') updateDynamicMusic();
  // -------------------------------------

  // 1. ADDED: Restore the opening flavor text
  log('You awaken with nothing. Explore, loot, survive.');
  log('A chest is nearby.');

  const m = document.getElementById('gameOverModal');
  if (m) m.style.display = 'none';

  // Pick 1 of 2 (Endless only)
  if (state.gameMode === 'endless') {
    requestAnimationFrame(()=>{
      const f = window.offerPick2Choice;
      if (f) { try { f('start'); } catch(e){} }
    });
  }
}


// === Arcade score flow ===
function openScoreEntry(){
  stopRunTimerFreeze();                    // ← add this line
  const m  = document.getElementById('scoreModal');
  const inp= document.getElementById('scoreInitials');
  const ent= document.getElementById('scoreEntry');
  const lst= document.getElementById('hiscoreList');
  if (!m) return;

  // snapshot final values once
  state.run.level = state.player.level;
state.run.depth = state.floor|0;                  // ← NEW
state.run.timeMs = state.run.finalMs || currentRunMs();  // ← NEW

  ent.style.display = 'block';
  lst.style.display = 'none';
  m.style.display = 'flex';
if (typeof setMobileControlsVisible === 'function') setMobileControlsVisible(false);

  setTimeout(()=>{ if (inp){ inp.focus(); inp.select(); } }, 0);
}

function renderHiscores(){
  const tables = document.querySelectorAll('#hiscoreTable');
  tables.forEach(tbl=>{
    tbl.innerHTML = '';

    ['Initials','Depth','Time','Level','Kills'].forEach(h=>{
      const d = document.createElement('div');
      d.style.fontWeight = '800';
      d.textContent = h;
      tbl.appendChild(d);
    });

    (state._hiscores || []).forEach(row=>{
      const cells = [
        (row.initials || '???').toUpperCase(),
        row.depth|0,
        formatRunTime(row.timeMs ?? row.finalMs ?? 0),
        row.level|0,
        row.kills|0
      ];
      cells.forEach(v=>{
        const d = document.createElement('div');
        d.textContent = v;
        tbl.appendChild(d);
      });
    });
  });

}

function saveScore(initialsRaw){
  const initials = (initialsRaw||'???').toUpperCase().replace(/[^A-Z]/g,'').slice(0,3) || '???';
  const row = { initials, depth: state.run.depth|0, level: state.run.level|0, kills: state.run.kills|0, when: state.run.when|0, timeMs: state.run.timeMs|0  };
  // --- NEW: Calculate & Save Shards ---
  // --- Adjusted Shard Scaling ---
  // Formula: (Depth * 1) + (Kills * 0.5) + (Level * 2)
  const earnedShards = (state.gameMode === 'tutorial') ? 0 
     : Math.floor((state.run.depth * 1) + (state.run.kills * 0.5) + (state.run.level * 2));

  if (earnedShards > 0) {
    const m = loadMeta();
    m.shards = (m.shards || 0) + earnedShards;
    saveMeta(m);
    showBanner(`Soul Shards Earned: +${earnedShards}`, 4000);
    updateMainMenuShopLabel();
  }
  // ------------------------------------

  const list = (state._hiscores||[]).concat([row]).sort((a,b)=>{
    // sort by depth desc, then kills desc, then level desc, then earlier date
    if (b.depth !== a.depth) return b.depth - a.depth;
    if (b.kills !== a.kills) return b.kills - a.kills;
    if (b.level !== a.level) return b.level - a.level;
    return a.when - b.when;
  }).slice(0,10);
  state._hiscores = list;
  saveHi(list);
}

document.addEventListener('DOMContentLoaded', ()=>{   // <-- ensure elements exist
  (function attachScoreUI(){
    const m  = document.getElementById('gameOverModal');
    const scoreM = document.getElementById('scoreModal');
    const btnSave = document.getElementById('btnSaveScore');
    const inp = document.getElementById('scoreInitials');
    const ent= document.getElementById('scoreEntry');
    const lst= document.getElementById('hiscoreList');
    const playAgain = document.getElementById('btnPlayAgain');
    // NEW: Grab the header menu button
    const headerMenu = document.getElementById('btnScoreMenu');

    // NEW: Wire header menu button to go back safely
    if (headerMenu) headerMenu.addEventListener('click', () => {
      document.getElementById('scoreModal').style.display = 'none';
      if (typeof goMenu === 'function') goMenu();
    });

    if (btnSave) btnSave.addEventListener('click', ()=>{
      // If entry is visible, allow save regardless of run.ended being set.
      if (ent && ent.style.display !== 'none') {
        saveScore(inp && inp.value);
        ent.style.display = 'none';
        lst.style.display = 'block';
        renderHiscores();
      }
    });

    if (inp) inp.addEventListener('keydown', (e)=>{
      e.stopPropagation(); // don't move the player while typing
      if (e.key === 'Enter'){ e.preventDefault(); btnSave?.click(); }
    });

    // after:  const playAgain = document.getElementById('btnPlayAgain');
if (playAgain) playAgain.addEventListener('click', ()=>{
      // hide leaderboard modal
      const scoreM = document.getElementById('scoreModal');
      if (scoreM) scoreM.style.display = 'none';
      
      // Also ensure Game Over modal is closed (it might be underneath)
      const goM = document.getElementById('gameOverModal');
      if (goM) goM.style.display = 'none';

      // Return to Main Menu instead of instant restart
      if (typeof goMenu === 'function') goMenu();
    });

    // Observe Game Over modal becoming visible → trigger score entry once
    if (m){
      const obs = new MutationObserver(()=>{
        // consider any visible state, not just "block" (your modal uses flex)
        if (getComputedStyle(m).display !== 'none' && !state.run._scoreOpened){
          state.run._scoreOpened = true;   // guard so it only opens once
          // make sure save button isn’t blocked by this flag
          state.run.ended = true;          // <-- guarantees Save handler can proceed
          openScoreEntry();
        }
      });
      obs.observe(m, { attributes:true, attributeFilter:['style'] });
    }
  })();
});

// === Spell upgrade modal wiring ===
(function(){
  let _pendingSpellToUpgrade = null;

  function maybePromptSpellUpgrade(name){
    const up = ensureSpellUpgradeSlot(name);
    const canDmg   = up.dmg   < MAX_SPELL_BONUS;
    const canRange = up.range < MAX_SPELL_BONUS;
    if (up.shards >= 5 && (canDmg || canRange)){
      _pendingSpellToUpgrade = name;
      const t = document.getElementById('spellUpTitle');
      const m = document.getElementById('spellUpMsg');
      if (t) t.textContent = `Upgrade ${name}`;
      if (m) m.textContent = `You’ve collected 5 duplicate ${name} scrolls. Choose an upgrade:`;
      const modal = document.getElementById('spellUpModal');
      if (modal) modal.style.display='flex';
    }
  }

  window.__maybePromptSpellUpgrade = maybePromptSpellUpgrade;

  const modal = document.getElementById('spellUpModal');
  const close = ()=>{ if (modal) modal.style.display='none'; _pendingSpellToUpgrade=null; setMobileControlsVisible(true); };

  const bD = document.getElementById('btnSpellUpDmg');
  const bR = document.getElementById('btnSpellUpRange');

  function consumeFiveShardsAndApply(name, which){
    const up = ensureSpellUpgradeSlot(name);
    if (up.shards < 5) return;
    if (which==='dmg'   && up.dmg   < MAX_SPELL_BONUS){ up.dmg++;   up.shards -= 5; log(`${name} damage increased (+1).`); }
    if (which==='range' && up.range < MAX_SPELL_BONUS){ up.range++; up.shards -= 5; log(`${name} range increased (+1).`); }
    if (typeof updateSpellBody === 'function') updateSpellBody();
  }

  if (bD) bD.onclick = ()=>{ if (_pendingSpellToUpgrade) consumeFiveShardsAndApply(_pendingSpellToUpgrade,'dmg'); close(); };
  if (bR) bR.onclick = ()=>{ if (_pendingSpellToUpgrade) consumeFiveShardsAndApply(_pendingSpellToUpgrade,'range'); close(); };
  if (modal) modal.addEventListener('click', e=>{ if (e.target===modal) close(); });
})();


document.addEventListener('click', (ev)=>{
  if(ev.target && ev.target.id==='btnRestart'){ 
    document.getElementById('gameOverModal').style.display = 'none';
    // FIX: Go to score entry instead of menu to save run data
    if (typeof openScoreEntry === 'function') {
       openScoreEntry(); 
    } else {
       // Fallback
       goMenu();
    }
  }
});

window.openGoldWell = function(){
  // 1. Inject HTML if missing (Restores the Popup)
  if (!document.getElementById('goldWellModal')) {
    const d = document.createElement('div');
    d.id = 'goldWellModal'; d.className = 'modal'; d.style.display = 'none';
    d.innerHTML = `
      <div class="sheet">
        <div class="row"><div class="title">Golden Well</div><button class="btn" id="gwClose">Close</button></div>
        <div id="gwMsg" style="opacity:.9; margin:10px 0; text-align:center;">
           A mystical well glows with power. Toss 500 gold to receive a blessing?
        </div>
        <div class="row" style="justify-content:center; gap:10px;">
           <button class="btn" id="gwBuy">Toss Gold (500g)</button>
        </div>
        <div style="text-align:center; margin-top:8px; opacity:0.8;">
           Gold: <span id="gwGold">0</span>
        </div>
      </div>`;
    document.body.appendChild(d);
    
    // Wire buttons
    d.querySelector('#gwClose').onclick = () => {
       d.style.display = 'none'; 
       state._inputLocked = false;
       if (!state._pauseOpen) setMobileControlsVisible(true);
    };
    
    d.querySelector('#gwBuy').onclick = () => {
       const w = state.goldWell;
       if (!w || w.used) { document.getElementById('gwMsg').textContent = "The well is empty."; return; }
       if ((state.inventory.gold|0) < 500) { document.getElementById('gwMsg').textContent = "Not enough gold."; return; }
       
       // Pay Logic
       state.inventory.gold -= 500;
       w.used = true;
       unlockCodex('Gold_Well', true);
       
       SFX.levelUp();
       spawnParticles(state.player.x, state.player.y, '#facc15', 12);
       updateBars(); updateInvBody();
       
       // Close the Confirmation Modal
       d.style.display = 'none';
       
       // Open the Choice Modal (Helper)
       // We keep input locked here because the Choice modal takes over immediately
       if (typeof openGoldenWellChoice === 'function') {
           openGoldenWellChoice();
       } else {
           // Fallback safety
           state.player.hpMax += 5; state.player.hp = state.player.hpMax;
           log("Vitality surges! (+5 Max HP)");
           state._inputLocked = false;
           if (!state._pauseOpen) setMobileControlsVisible(true);
       }
    };
  }
  
  // Logic to Open the Confirmation Modal
  const m = document.getElementById('goldWellModal');
  const w = state.goldWell;
  const msg = document.getElementById('gwMsg');
  const btn = document.getElementById('gwBuy');
  const g = document.getElementById('gwGold');
  
  if (g) g.textContent = state.inventory.gold|0;
  unlockCodex('Gold_Well'); 
  
  if (w.used) {
     msg.textContent = "The waters are still. The magic is gone.";
     btn.style.display = 'none';
  } else {
     msg.textContent = "A mystical well glows with power. Toss 500 gold to receive a blessing?";
     btn.style.display = '';
     btn.textContent = "Toss Gold (500g)";
     btn.disabled = (state.inventory.gold|0) < 500;
  }
  
  m.style.display = 'flex';
  state._inputLocked = true;
  setMobileControlsVisible(false);
};

// --- NEW: Weapon Swap / Inventory Limit Logic ---
const MAX_WEAPON_CAT = 5;

function getWeaponType(name) {
  // FIX: Force anything containing "Shield" to be type 'shield' before checking stats
  if (name.includes('Shield')) return 'shield';
  // Reliance on weaponStatsFor ensures a single source of truth
  const st = weaponStatsFor(name);
  return st ? st.type : 'hand';
}

function countWeaponsInCategory(targetType) {
  let count = 0;
  for (const [name, qty] of Object.entries(state.inventory.weapons || {})) {
    if (getWeaponType(name) === targetType) count += (qty|0);
  }
  return count;
}

window.openWeaponSwapModal = function(newItemPayload, pickupKey, x, y) {
  // 1. Inject HTML if missing
  if (!document.getElementById('swapModal')) {
    const d = document.createElement('div');
    d.id = 'swapModal'; d.className = 'modal'; d.style.display = 'none'; d.style.zIndex = '10002';
    d.innerHTML = `
      <div class="sheet" style="width:min(600px, 94vw)">
        <div class="title" style="margin-bottom:10px; text-align:center; color:#f9d65c">Inventory Full</div>
        <div id="swapMsg" style="text-align:center; margin-bottom:15px; opacity:0.9">
           You can only carry ${MAX_WEAPON_CAT} weapons of this type.
        </div>
        
        <div style="display:grid; grid-template-columns:1fr 1px 1fr; gap:10px; align-items:start;">
           <div style="display:flex; flex-direction:column; gap:8px;">
              <div style="font-weight:bold; text-align:center; font-size:12px; opacity:0.7">SCRAP ONE:</div>
              <div id="swapList" style="display:flex; flex-direction:column; gap:6px;"></div>
           </div>
           
           <div style="background:rgba(255,255,255,0.2); height:100%;"></div>

           <div style="display:flex; flex-direction:column; gap:8px;">
              <div style="font-weight:bold; text-align:center; font-size:12px; opacity:0.7">OR LEAVE NEW:</div>
              <button class="btn" id="swapNewBtn" style="border:1px solid #facc15; padding:12px; text-align:left;"></button>
           </div>
        </div>
      </div>`;
    document.body.appendChild(d);
  }

  const m = document.getElementById('swapModal');
  const list = document.getElementById('swapList');
  const newBtn = document.getElementById('swapNewBtn');
  const msg = document.getElementById('swapMsg');
  
  const wType = getWeaponType(newItemPayload.name);
  const niceType = typeNice(wType);
  
  msg.textContent = `Your ${niceType} bag is full (${MAX_WEAPON_CAT}/${MAX_WEAPON_CAT}). Scrap an old one to take the new one?`;
  list.innerHTML = '';

  // 1. Helper to format stats (Shield-aware)
  const fmt = (name, min, max) => {
     // Check if it's a shield based on name
     const type = getWeaponType(name);
     
     if (type === 'shield') {
        let chance = '20%';
        if (name.includes('Buckler')) chance = '15%';
        else if (name.includes('Tower')) chance = '35%';
        else if (name.includes('Ancient')) chance = '25%';
        return `<b>${name}</b><br><span style="font-size:12px; opacity:0.8">Block: ${chance}</span>`;
     }

     // Normal Weapon Logic
     let dMin = min, dMax = max;
     const isStaff = (type === 'staff');

     // Arcane Flux: Staffs x1.5, Melee x0.25
     if (state.floorEffect === 'ArcaneFlux') {
        if (isStaff) { dMin = Math.ceil(dMin * 1.5); dMax = Math.ceil(dMax * 1.5); }
        else         { dMin = Math.ceil(dMin * 0.25); dMax = Math.ceil(dMax * 0.25); }
     } 
     // Anti-Magic: Staffs Silenced, Melee x1.5
     else if (state.floorEffect === 'AntiMagic') {
        if (isStaff) return `<b>${name}</b><br><span style="font-size:12px; opacity:0.8; color:#f87171; text-decoration:line-through;">SILENCED</span>`;
        dMin = Math.ceil(dMin * 1.5); dMax = Math.ceil(dMax * 1.5); 
     }
     
     return `<b>${name}</b><br><span style="font-size:12px; opacity:0.8">Dmg: ${dMin}-${dMax}</span>`;
  };

  // 2. Populate "Scrap" List (Current Inventory)
  for (const [name, qty] of Object.entries(state.inventory.weapons || {})) {
    if (getWeaponType(name) !== wType) continue; // Only show matching category
    
    const stats = weaponStatsFor(name) || { min:0, max:0 };
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.style.cssText = 'text-align:left; padding:8px; border:1px solid #ef4444; color:#fca5a5;';
    const xpVal = 10 + (state.floor * 2);
    btn.innerHTML = `SCRAP (+${xpVal} XP): ${fmt(name, stats.min, stats.max)}`;
    
    // ACTION: Scrap Old -> Take New
    btn.onclick = () => {
       // Remove Old
       state.inventory.weapons[name]--;
       if (state.inventory.weapons[name] <= 0) delete state.inventory.weapons[name];
       
       // Add New
       state.inventory.weapons[newItemPayload.name] = (state.inventory.weapons[newItemPayload.name]||0) + 1;
       
       // Clear Floor
       delete state.pickups[pickupKey];
       state.tiles[y][x] = 1;
       
// --- NEW: Grant Weapon Skill XP (Shields->Survivability, Staffs->Magic) ---
       const xpAmt = 10 + (state.floor * 2);
       
       // Detect special cases
       const isShield = (wType === 'shield');
       const isStaff  = (wType === 'staff');

       // Redirect XP: Shield->Survivability, Staff->Magic, Others->WeaponType
       let targetSkill = wType;
       if (isShield) targetSkill = 'survivability';
       if (isStaff)  targetSkill = 'magic';
       
       ensureSkill(targetSkill);
       const s = state.skills[targetSkill];
       s.shown = true; 
       s.xp += xpAmt;
       
       // Handle Level Up
       let leveled = false;
       while(s.xp >= s.next){ 
           s.xp -= s.next; 
           s.lvl++; 
           s.next = Math.floor(s.next * SKILL_XP_GROWTH); 
           leveled = true;
       }
       
       if(leveled) {
           // Nice name for log
           const skillName = (isShield ? "Survivability" : (isStaff ? "Magic" : typeNice(wType)));
           log(`${skillName} advanced to ${s.lvl}!`);
           
           renderSkills(); 
           // Only recompute weapon damage if it wasn't a shield
           if (!isShield && typeof recomputeWeapon === 'function') recomputeWeapon();
       }

       spawnFloatText(`+${xpAmt} XP`, state.player.x, state.player.y, '#a78bfa');
       // -------------------------------------

       log(`Dismantled ${name}. Learned from its design.`);
       SFX.weaponBreak(); // Crunch sound for scrapping
       SFX.pickup();      // Pickup sound
       
       m.style.display = 'none';
       state._inputLocked = false;
       updateInvBody();
       updateEquipUI();
       draw();
    };
    list.appendChild(btn);
  }

  // 3. Populate "Leave" Button (New Item)
  newBtn.innerHTML = `LEAVE: ${fmt(newItemPayload.name, newItemPayload.min, newItemPayload.max)}`;
  newBtn.onclick = () => {
     log(`You leave the ${newItemPayload.name} on the floor.`);
     m.style.display = 'none';
     state._inputLocked = false;
  };

  // Show
  m.style.display = 'flex';
  state._inputLocked = true;
};

// --- NEW HELPER FUNCTIONS ---
// Fix: Define the missing function that opens the Omen Menu
function offerPick2Choice(context) {
  // Only for Endless Mode
  if (state.gameMode !== 'endless') return;

  // Ensure we have omens to pick from
  const pool = (typeof PICK2_POOL !== 'undefined') ? PICK2_POOL : [];
  if (pool.length < 2) return;

  // Pick 2 Unique Random Omens
  const i1 = Math.floor(Math.random() * pool.length);
  let i2 = Math.floor(Math.random() * pool.length);
  while (i2 === i1) i2 = Math.floor(Math.random() * pool.length);
  const o1 = pool[i1];
  const o2 = pool[i2];

  // Setup UI
  const m = document.getElementById('pick2Modal');
  const t = document.getElementById('pick2Title');
  const d = document.getElementById('pick2Desc');
  const b1 = document.getElementById('btnPick2A');
  const b2 = document.getElementById('btnPick2B');

  if (m && b1 && b2) {
    if (t) {
        if (context === 'start') t.textContent = "Starting Omen";
        else if (context === 'warlord') t.textContent = "Warlord Reward";
        else if (context === 'boss') t.textContent = "Boss Reward";
        else t.textContent = "A Dark Omen";
    }
    if(d) d.textContent = "Accept a burden to gain power.";
    
    // Configure Button A
    b1.textContent = o1.label;
    b1.onclick = () => { 
        o1.apply(); 
        unlockCodex(o1.id, true);
        m.style.display = 'none'; 
        state._inputLocked = false; 
    };
    
    // Configure Button B
    b2.textContent = o2.label;
    b2.onclick = () => { 
        o2.apply(); 
        unlockCodex(o2.id, true);
        m.style.display = 'none'; 
        state._inputLocked = false; 
    };

    // Show
    m.style.display = 'flex';
    state._inputLocked = true;
  }
}
// Expose globally so other functions can find it
window.offerPick2Choice = offerPick2Choice;
// Helper: Find where a projectile actually hits (stops at walls/doors)
function getProjectileEnd(x, y, dx, dy, range) {
  let cx = x, cy = y;
  for (let i = 0; i < range; i++) {
    const nx = cx + dx, ny = cy + dy;
    if (!inBounds(nx, ny)) return { x: cx, y: cy };
    
    // Stop at Walls (0) or Closed Doors (2)
    const t = state.tiles[ny][nx];
    if (t === 0 || t === 2) return { x: cx, y: cy };
    
    cx = nx; cy = ny;
  }
  return { x: cx, y: cy };
}

function handleEnemyDeath(e, source) {
  // --- FIX: Mini-Boss Omen Trigger (Priority) ---
  // We handle this FIRST to ensure it never gets blocked by other logic.
  if (e.miniBoss && state.gameMode === 'endless') {
      log("The Warlord falls! A dark power calls to you...");
      spawnFloatText("OMEN!", e.x, e.y, '#a78bfa');

      // Trigger Fear on nearby enemies
      state.enemies.forEach(en => {
        if (en !== e && dist(en.x, en.y, state.player.x, state.player.y) <= 8) {
          en.fearTicks = 3;
          spawnFloatText("FEAR", en.x, en.y, '#9ca3af');
        }
      });
    
    // Trigger with delay, but check for conflicts (Level Up)
    setTimeout(() => {
      // 1. Check if the Level Up modal is blocking the screen
      const lvlModal = document.getElementById('lvlupModal');
      const isLeveling = (lvlModal && lvlModal.style.display === 'flex');

      if (isLeveling) {
        // Queue it! The Level Up modal will trigger this when closed.
        state._pendingOmen = true;
      } else {
        // Safe to show immediately.
        if (typeof window.offerPick2Choice === 'function') {
          window.offerPick2Choice('warlord');
        } else {
          console.error("offerPick2Choice function is missing!");
        }
      }
    }, 800);
  }
  // ----------------------------------------------

  // 1. Depth 50 Transitions (Classic/Endless) - Stop death if cutscene starts
  if (state.floor === 50 && e.boss) {
      if (e.type === 'Clone' && !state.flags.depth50Phase2) {
          runDepth50Phase2(e); return;
      }
      if (e.type === 'Mad King' && !state.flags.depth50Done) {
          runDepth50Outro(e); return;
      }
  }

  // 2. Skeleton Revive (One time only)
  // Warlords (miniBoss) should NOT revive to prevent annoyance
  if (e.type === 'Skeleton' && !e._revived && !e.miniBoss) { 
      e._revived = true;
      e.hp = Math.max(2, Math.floor((e.hpMax || 7) * 0.6));
      if(e.atk) { e.atk[0] = Math.max(0, e.atk[0]-1); }
      
      playSkelRevive(); // <--- Plays your custom file (or fallback)
      
      log('The Skeleton pulls itself back together!');
      return; 
  }

  // 3. Volatile Aether (Explosions)
  if (state.floorEffect === 'VolatileAether') {
      if (!state.explosions) state.explosions = [];
      state.explosions.push({ x: e.x, y: e.y, timer: 3 });
      spawnFloatText("3...", e.x, e.y, '#f97316');
  }

  // 4. Boss Logic (Stairs + Omen)
  if (e.boss) {
      spawnBossStairs(e.x, e.y); // Checks internally if already spawned
      if (typeof offerPick2Choice === 'function') offerPick2Choice('boss');
  }

  // 6. Loot Drops (Stolen items, Gold)
  if (e.stolenItems || e.stolen) {
      if (e.stolenItems) e.stolenItems.forEach(it => dropStolenNear(e.x, e.y, it));
      else dropStolenNear(e.x, e.y, e.stolen);
      log('Stolen items scatter on the floor!');
  }
  
  // Restore Auto-Gold (50% chance), but NO floating text
  if (!e.boss && !e.miniBoss && Math.random() < 0.5) { 
      const g = goldFor(e);
      state.inventory.gold = (state.inventory.gold|0) + g;
      if (typeof updateInvBody === 'function') updateInvBody(); 
  }

  // 7. Cleanup & Stats (MOVED UP)
  state.enemies = state.enemies.filter(x => x !== e);
  state.run.kills++;
  
  // Double XP on Cursed Floors
  let finalXp = Math.max(1, e.xp|0);
  if (state.cursedFloor) finalXp *= 2;
  awardKill(source, finalXp);

  // --- NEW: Red Chest Wave Logic ---
  if (state.redChestEvent && state.redChestEvent.active) {
      state.redChestEvent.killsReq--;
      if (state.redChestEvent.killsReq <= 0) {
          state.redChestEvent.wave++;
          const r = state.redChestEvent.room;
          if (state.redChestEvent.wave === 2) {
              spawnFloatText("WAVE 2", state.player.x, state.player.y, '#ef4444');
              state.redChestEvent.killsReq = 5;
              spawnRedChestWave(5, r, false); 
          } else if (state.redChestEvent.wave === 3) {
              spawnFloatText("ELITE WAVE", state.player.x, state.player.y, '#ef4444');
              state.redChestEvent.killsReq = 2;
              spawnRedChestWave(2, r, true); 
          } else {
              // Victory
              showBanner("VICTORY!", 3000);
              state.redChestEvent.active = false;
              state.redChestEvent.cleared = true;
              // Revert Temporary Walls to Floors
              if (state.redChestEvent.tempWalls) {
                  for (const key of state.redChestEvent.tempWalls) {
                      const [wx, wy] = key.split(',').map(Number);
                      state.tiles[wy][wx] = 1; // Open Floor
                      spawnParticles(wx, wy, '#888', 4);
                  }
              }
              state.redChestEvent = null;
          }
      }
  }
  SFX.kill();
  unlockCodex(e.displayName || e.type, true);
  log(`${e.displayName || e.type} falls.`);

}

function useStaff(w) {
    // --- FIX: Anti-Magic Field Block ---
    if (isEffectActive('AntiMagic')) {
        log('A field of silence prevents the staff from firing!');
        return;
    }
    // -----------------------------------

    // 1. Determine Match Synergy
    const s = state.equippedSpell;
    let isMatch = false;
    let spellStats = null;
    
    // Check elements if we have a spell equipped
    if (s) {
       const wn = w.name; 
       const sn = s.name;
       if (wn.includes('Fire') && sn === 'Ember') isMatch = true;
       else if (wn.includes('Light') && sn === 'Spark') isMatch = true;
       else if (wn.includes('Ice') && sn === 'Frost') isMatch = true;
       else if (wn.includes('Wind') && sn === 'Gust') isMatch = true;
       else if (wn.includes('Earth') && sn === 'Pebble') isMatch = true;
       
       if (isMatch) spellStats = getSpellStats(sn);
    }

    // 2. Calculate Costs & Stats based on match
    const cost = isMatch ? (spellStats.cost|0) : 2;
    
    if (state.player.mp < cost) {
        log("Out of mana! You bash with the staff.");
        const t = getFacingEnemy(); 
        if(t){
           t.hp -= 1; spawnFloatText("1", t.x, t.y, '#fff');
           
           // Bashing still uses durability logic if you want, but usually it's just a fallback.
           // We will leave durability for the main projectile attack for now.
           
           if(t.hp<=0) {
      // FIX: Route through central handler so Omens/Boss events trigger
      handleEnemyDeath(t, 'magic');
    }
        } else log("You swing at the air.");
        enemyStep(); draw(); return;
    }

    // 3. Determine Visuals
    let color='#fff', el='Magic';
    if(w.name.includes('Fire')){ color='#ef4444'; el='Fire'; }
    else if(w.name.includes('Ice')){ color='#06b6d4'; el='Ice'; }
    else if(w.name.includes('Light')){ color='#eab308'; el='Lightning'; }
    else if(w.name.includes('Wind')){ color='#a3a3a3'; el='Wind'; }
    else if(w.name.includes('Earth')){ color='#78350f'; el='Earth'; }

    // 4. Pay Mana
    state.player.mp -= cost; 
    updateBars();

    // 5. Fire Projectile
    const range = isMatch ? spellStats.range : 4;
    const t = findFirstLinedTarget(state.player.x, state.player.y, range);
    
    const dirs = {up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
    const [dx,dy] = dirs[state.player.facing||'down'];
    
    // Calculate actual end point so we don't shoot through doors
    const endPos = getProjectileEnd(state.player.x, state.player.y, dx, dy, range);
    const tx = t ? t.x : endPos.x;
    const ty = t ? t.y : endPos.y;

    // Safety: Wall Block
    if (tx === state.player.x && ty === state.player.y) {
       log("Blocked.");
       state.player.mp += cost; // Refund mana
       updateBars(); 
       return; 
    }

    spawnProjectileEffect({
        kind:'magic', element:el, color:color, fromX:state.player.x, fromY:state.player.y, toX:tx, toY:ty,
        onDone:()=>{
            if(t){
                let dmg = 0;
                
                if (isMatch) {
          // FIX: Use Weapon Damage + Bonus (so high-tier staves don't get nerfed by low-tier spells)
          // Was: rand(spellStats.min, spellStats.max) + 3
          dmg = rand(w.min, w.max) + 3; 
          spawnFloatText("SYNERGY!", state.player.x, state.player.y, color);
        } else {
                    // Basic Attack: Weak Staff Damage + Skill Bonus
                    const skillBonus = Math.floor((state.skills.magic?.lvl||1)/2);
                    dmg = rand(w.min, w.max) + skillBonus;
                }

                // --- FIX: Arcane Flux Boost ---
                if (isEffectActive('ArcaneFlux')) {
                    dmg = Math.ceil(dmg * 1.5);
                }
                // ------------------------------

                t.hp = Math.max(0, t.hp - dmg);
                spawnFloatText(dmg, t.x, t.y, color);
                // REMOVED: checkMiniBossReward(t); <-- This was triggering Omen on every hit!
                
                // Vampiric Logic
                if (w.vampiric && dmg > 0) {
                   const heal = Math.max(1, Math.floor(dmg * 0.25));
                   state.player.hp = Math.min(state.player.hp + heal, state.player.hpMax);
                   spawnFloatText("+" + heal, state.player.x, state.player.y, '#0f0');
                   updateBars();
                }

                // --- FIX: Apply Durability Loss ---
                handleSuccessfulHitDurabilityTick();
                // ----------------------------------

                if(t.hp<=0) {
                    // Use new central handler
                    handleEnemyDeath(t, 'magic');
                }
            }
            enemyStep(); draw();
        }
    });
}

function equipShield(variant = 'Standard'){
  if (typeof variant !== 'string') variant = 'Standard';
  if (variant === 'Standard Shield') variant = 'Standard';

  // --- FIX: Enforce Shield Rules (One-Handed / Fists Only) ---
  if (!isShieldAllowed()) {
    log('Shields can only be used with One-Handed or Hand-to-Hand weapons.');
    return;
  }
  // -----------------------------------------------------------

  // 1. Put away current shield (Swap Logic)
  if (state.player.shield) {
     const oldName = state.player.shieldName || 'Standard';
     if (oldName === 'Standard') {
         state.inventory.shields = (state.inventory.shields|0) + 1;
     } else {
         state.inventory.weapons[oldName] = (state.inventory.weapons[oldName]||0) + 1;
     }
  }

  // 2. Take new shield from inventory
  if (variant === 'Standard') {
      if ((state.inventory.shields|0) <= 0) { log("No Standard Shields left."); return; }
      state.inventory.shields--;
  } else {
      if (!state.inventory.weapons[variant]) { log(`No ${variant} left.`); return; }
      state.inventory.weapons[variant]--;
      // Clean up zero entries
      if (state.inventory.weapons[variant] <= 0) delete state.inventory.weapons[variant];
  }

  // 3. Set Stats
  let maxDur = 20; 
  let chance = 0.20;

  if (variant.includes('Buckler'))      { maxDur = 15; chance = 0.15; }
  else if (variant.includes('Tower'))   { maxDur = 35; chance = 0.35; }
  else if (variant.includes('Ancient')) { maxDur = 25; chance = 0.25; }
  else if (variant.includes('Kite'))    { maxDur = 20; chance = 0.20; }

  state.player.shield = { name: variant, dur: maxDur };
  state.player.shieldName = variant;
  state.player.blockChance = chance;
  
  log(`Equipped ${variant}.`);
  updateEquipUI(); 
  updateInvBody();
}

function openGoldenWellChoice(){
    const m = document.getElementById('lvlupModal');
    if(!m) return;
    
    const t = m.querySelector('.title');
    if(t) t.innerText = "Golden Well: Choose a Blessing";
    
    // Clone buttons to strip old listeners
    const bH = document.getElementById('btnHP'), bM = document.getElementById('btnMP'), bS = document.getElementById('btnStam');
    const nH = bH.cloneNode(true), nM = bM.cloneNode(true), nS = bS.cloneNode(true);
    bH.replaceWith(nH); bM.replaceWith(nM); bS.replaceWith(nS);

    // --- FIX: Use Game Scaling Helpers + Full Heal ---
    nH.onclick = () => { 
        // Use standard level-up formula (scales with floor/level)
        const inc = (typeof levelHpGain === 'function') ? levelHpGain() : 5;
        state.player.hpMax += inc; 
        state.player.hp = state.player.hpMax; // Full Heal
        log(`The well grants vitality! +${inc} Max HP (Healed)`); 
        closeWell(); 
    };
    
    nM.onclick = () => { 
        const inc = (typeof levelMpGain === 'function') ? levelMpGain() : 3;
        state.player.mpMax += inc; 
        state.player.mp = state.player.mpMax; // Full Mana
        log(`The well grants wisdom! +${inc} Max MP (Restored)`); 
        closeWell(); 
    };
    
    nS.onclick = () => { 
        const inc = (typeof levelStamGain === 'function') ? levelStamGain() : 3;
        state.player.staminaMax += inc; 
        state.player.stamina = state.player.staminaMax; // Full Stamina
        log(`The well grants endurance! +${inc} Max Stamina (Restored)`); 
        closeWell(); 
    };

    m.style.display = 'flex';
    state._inputLocked = true;
    
    function closeWell(){ 
        m.style.display='none'; 
        state._inputLocked=false; 
        updateBars(); 
        if(t) t.innerText = "Level Up!"; // Reset title for next time
    }
}

function triggerOmenChoice() {
    if (typeof PICK2_POOL === 'undefined' || PICK2_POOL.length < 2) return;
    const o1 = PICK2_POOL[Math.floor(Math.random() * PICK2_POOL.length)];
    let o2 = PICK2_POOL[Math.floor(Math.random() * PICK2_POOL.length)];
    while (o1.id === o2.id) { o2 = PICK2_POOL[Math.floor(Math.random() * PICK2_POOL.length)]; }

    const m = document.getElementById('pick2Modal'); 
    if (!m) return;
    m.querySelector('#pick2Title').innerText = "Choose an Omen";
    m.querySelector('#descPick1').innerText = o1.label;
    m.querySelector('#descPick2').innerText = o2.label;
    
    document.getElementById('btnPick2A').onclick = () => { o1.apply(); log(`Accepted: ${o1.id}`); m.style.display='none'; state._inputLocked=false; };
    document.getElementById('btnPick2B').onclick = () => { o2.apply(); log(`Accepted: ${o2.id}`); m.style.display='none'; state._inputLocked=false; };
    
    state._inputLocked = true; m.style.display = 'flex';
}

function getFacingEnemy(){
    const dirs = {up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
    const [dx,dy] = dirs[state.player.facing||'down'];
    return enemyAt(state.player.x+dx, state.player.y+dy);
}

// NEW: Custom Sprite for Red Chest
function drawRedChestPixel(ctx, x, y, tile){
  const { R } = gridN(ctx, x, y, tile, 12);
  const body = '#7f1d1d'; // Dark Crimson
  const trim = '#000000'; // Black Iron
  const light = '#ef4444'; // Bright Red Highlight
  const eye = '#facc15';  // Yellow "Eye" Lock
  
  // Outline
  R(0,3,1,8,trim); R(11,3,1,8,trim); R(0,10,12,1,trim);
  // Main Body
  R(1,3,10,8,body);
  // Lid separation line
  R(1,4,10,1,trim); 
  // Vertical Iron Bands
  R(3,3,1,8,trim); R(8,3,1,8,trim); 
  // Glowing Lock
  R(5,5,2,2,eye); 
  // Top corner highlights
  R(1,3,2,1,light); R(9,3,2,1,light); 
}

// NEW: Spawner Helper
function spawnRedChestWave(count, r, elite){
    const kinds = floorEnemyKinds();
    for(let i=0; i<count; i++){
        const k = kinds[Math.floor(Math.random()*kinds.length)];
        // Spawn strictly inside room (padded by 1)
        const x = rand(r.x+1, r.x+r.w-2);
        const y = rand(r.y+1, r.y+r.h-2);
        const e = { x,y, size:1, type:k.type, hp:k.hp, atk:[...k.atk], xp:k.xp };
        if (elite) {
            e.elite = true; e.tint = randomBossTint();
            e.hp = Math.floor(e.hp*1.5); e.hpMax = e.hp;
            e.atk[0]+=2; e.atk[1]+=2;
        }
        state.enemies.push(e);
        spawnParticles(x, y, '#ef4444', 12);
    }
}


