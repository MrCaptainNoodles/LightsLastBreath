// ====== Rendering ======
const canvas=document.getElementById('view');
const ctx=canvas.getContext('2d');
function setupCanvas(){
  const dpr=window.devicePixelRatio||1;
  const wrap=document.getElementById('cw');
  const w=wrap.clientWidth, h=wrap.clientHeight;
  canvas.width=w*dpr; canvas.height=h*dpr; canvas.style.width=w+'px'; canvas.style.height=h+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.imageSmoothingEnabled=false;
}
window.addEventListener('resize',setupCanvas,{passive:true});

// Centers an N×N pixel grid inside a tile.
// Returns { s, bx, by, R } where R(cx,cy,w,h,color) draws a rect in grid units.
function gridN(ctx, x, y, tile, N){
  const s   = Math.max(1, Math.floor(tile / N));
  const off = Math.floor((tile - s * N) / 2);
  const bx  = x + off, by = y + off;
  const R   = (cx,cy,w,h,c)=>{ ctx.fillStyle=c; ctx.fillRect(bx + cx*s, by + cy*s, w*s, h*s); };
  return { s, bx, by, R };
}



// 12×12 grid helper
function _R12(ctx, px, py, s, cx, cy, w, h, color){
  ctx.fillStyle = color;
  ctx.fillRect(px + cx*s, py + cy*s, w*s, h*s);
}

// === Simple projectile helpers (magic bolts + arrows) ===
function projectileColorForMagic(name){
  switch(name){
    case 'Spark':  return '#ffd93b'; // bright yellow
    case 'Ember':  return '#ff7f50'; // orange / fire
    case 'Frost':  return '#6ec5ff'; // icy blue
    case 'Gust':   return '#f5f5f5'; // pale wind
    case 'Pebble': return '#b8b2a0'; // stone
    default:       return '#ffffff';
  }
}


// --- OPTIMIZED: Float Text with Hard Cap ---
const MAX_FLOAT_TEXT = 8; // Limit overlapping numbers

function spawnFloatText(text, x, y, color='#fff') {
  if(!state.floatingText) state.floatingText = [];
  
  state.floatingText.push({
    text: String(text),
    x: x, 
    y: y, 
    start: Date.now(),      
    duration: 1200,         // Reduced duration (was 2000ms) to clear buffer faster
    color: color
  });

  // Culling: If too many numbers, remove the oldest
  if (state.floatingText.length > MAX_FLOAT_TEXT) {
    state.floatingText.shift(); 
  }

  if (!state._animating) { state._animating = true; requestAnimationFrame(draw); }
}

// --- OPTIMIZED: Particle Spawner with Hard Cap ---
const MAX_PARTICLES = 30; // Hard limit on total particles

function spawnParticles(x, y, color, count=4) {
  if(!state.particles) state.particles = [];
  
  // 1. Reduced count for low-end safety (default was 5-6)
  const safeCount = Math.min(count, 4); 
  
  for(let i=0; i<safeCount; i++){
    state.particles.push({
      x: x, 
      y: y,
      vx: (Math.random() - 0.5) * 0.15, 
      vy: (Math.random() - 0.5) * 0.15, 
      life: rand(40, 70), // Slightly shorter life
      color: color,
      size: rand(2, 3)
    });
  }

  // 2. FIFO Culling: If we have too many, remove the oldest ones immediately
  if (state.particles.length > MAX_PARTICLES) {
    // Remove the excess from the beginning of the array
    state.particles.splice(0, state.particles.length - MAX_PARTICLES);
  }

  if (!state._animating) { state._animating = true; requestAnimationFrame(draw); }
}

// draws one projectile in a tile-sized slot (screenX,screenY are in pixels)
function drawProjectilePixel(ctx, proj, screenX, screenY, tile){
  const { R } = gridN(ctx, screenX, screenY, tile, 12);
  const c = proj.color || '#ffffff';

  if (proj.kind === 'arrow'){
    // very simple arrow, oriented by dx/dy
    if (Math.abs(proj.dx) === 1){
      // horizontal arrow
      R(1,5,10,2,c);                 // shaft
      if (proj.dx > 0){
        R(10,4,2,4,c);               // head →
      } else {
        R(0,4,2,4,c);                // head ←
      }
    } else {
      // vertical arrow
      R(5,1,2,10,c);
      if (proj.dy > 0){
        R(4,10,4,2,c);               // head ↓
      } else {
        R(4,0,4,2,c);                // head ↑
      }
    }
  } else {
    // magic bolt: little diamond
    R(5,3,2,2,c);
    R(4,5,4,2,c);
    R(5,7,2,2,c);
  }
}

// Spawns a projectile that moves from (fromX,fromY) to (toX,toY)
// and then runs onDone(). If the enemy is right next to the player,
// we just resolve immediately with NO animation.
function spawnProjectileEffect(opts){
  const fromX = opts.fromX, fromY = opts.fromY;
  const toX   = opts.toX,   toY   = opts.toY;
  const dx    = (opts.dx !== undefined ? opts.dx : Math.sign(toX - fromX));
  const dy    = (opts.dy !== undefined ? opts.dy : Math.sign(toY - fromY));

  const tiles = Math.max(Math.abs(toX - fromX), Math.abs(toY - fromY));

  // "Right up next to the player" -> 1 tile away or same tile: no animation
  if (!Number.isFinite(tiles) || tiles <= 1){
    if (typeof opts.onDone === 'function') opts.onDone();
    return;
  }

  const kind  = opts.kind || 'magic';
  const color = opts.color ||
    (kind === 'magic' ? projectileColorForMagic(opts.element) : '#f7e9c5');

  const proj = {
    kind,
    element: opts.element || null,
    color,
    fromX, fromY,
    toX, toY,
    dx, dy,
    t: 0,
    // a bit slower for farther shots
    duration: 120 + tiles * 40,
    startTime: performance.now(),
    onDone: opts.onDone || null
  };

  if (!Array.isArray(state.projectiles)) state.projectiles = [];
  state.projectiles.push(proj);
  state._projectileAnimating = true;
  state._inputLocked = true; // Lock inputs while ANY projectile is flying

  function step(now){
    // FIX: If the projectile was removed externally, don't trap the animation loop
    if (!state.projectiles.includes(proj)) return;
    
    const elapsed = now - proj.startTime;
    proj.t = Math.min(1, elapsed / proj.duration);

    // redraw with updated projectile position
    draw();

    if (proj.t >= 1){
      // reach target → clean up
      state.projectiles = state.projectiles.filter(p => p !== proj);
      
      // FIX: Only turn off the animating flag if NO projectiles are left
      if (state.projectiles.length === 0) {
          state._projectileAnimating = false;
      }

      // Execute effect logic
      if (typeof proj.onDone === 'function') proj.onDone();
      
      // FIX: Only unlock inputs if NO projectiles are left, AND we aren't leveling up
      if (state.projectiles.length === 0) {
          const lvlModal = document.getElementById('lvlupModal');
          if (!lvlModal || lvlModal.style.display === 'none') {
              state._inputLocked = false;
          }
      }
      
      draw();
    } else {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}

// Replaced drawPlayerHelmet with a High-Detail Directional Knight
function drawPlayerHelmet(ctx, x, y, tile, facing='down') {
  const { s, R } = gridN(ctx, x, y, tile, 12);
  // Expanded Palette for Depth
  const steel = '#a7b3c1', shine = '#dfe6ee', shade = '#475569', dark = '#0b141d';
  const plume = '#9d1d2b', plumeL = '#dc2626';
  const cape = '#1e3a8a', capeL = '#3b82f6';
  const leather = '#78350f', gold = '#fbbf24';

  ctx.save();
  if (facing === 'left') {
      ctx.translate(x + tile/2, y + tile/2);
      ctx.scale(-1, 1);
      ctx.translate(-(x + tile/2), -(y + tile/2));
  }

  if (facing === 'up') {
      // BACK VIEW
      R(4,1,4,4,steel); R(5,1,2,1,shine); // Helmet dome + highlight
      R(3,4,6,1,dark); // Helmet base rim
      
      // Plume trailing wildly back
      R(5,-1,2,3,plumeL); R(4,0,1,4,plume); R(7,1,1,2,plume);
      
      // Shoulders peeking
      R(2,5,2,2,steel); R(8,5,2,2,steel);
      
      // Majestic Cape covering the back
      R(3,5,6,6,cape); 
      R(4,6,1,5,capeL); R(7,6,1,4,capeL); // Cape folds/highlights
      
      // Legs stepping
      R(4,10,1,2,shade); R(7,10,1,2,shade);
      R(3,11,2,1,dark); R(7,11,2,1,dark); // Heels

  } else if (facing === 'right' || facing === 'left') {
      // SIDE PROFILE
      // Plume flowing behind
      R(4,0,3,1,plumeL); R(2,1,2,1,plume); R(1,2,1,2,plume);
      
      // Helmet Profile
      R(4,1,5,4,steel); R(5,1,2,1,shine); // Dome
      R(7,3,2,1,dark); R(8,4,1,1,dark); // Eye slit / breathing gap
      R(4,5,5,1,shade); // Chin rim
      
      // Cape billowing backwards
      R(3,5,2,6,cape); R(2,7,1,4,capeL); R(1,9,1,2,cape);
      
      // Torso & Arm
      R(5,5,3,4,steel); R(7,5,1,3,shine); // Breastplate pushed forward
      R(4,9,4,1,leather); // Side belt
      
      // Arm resting / slightly bent
      R(6,6,2,2,steel); // Pauldron
      R(6,8,2,2,shade); // Gauntlet
      
      // Walking legs
      R(4,9,1,2,dark); R(3,11,2,1,shade); // Back leg & boot
      R(6,9,1,2,shade); R(6,11,2,1,steel); // Front leg & boot

  } else {
      // DEFAULT FRONT VIEW
      // Plume
      R(5,-1,2,2,plumeL); R(4,0,1,1,plume); R(7,0,1,1,plume);
      
      // Helmet Front
      R(4,1,4,3,steel); R(5,1,2,1,shine); // Dome
      R(3,4,2,2,steel); R(7,4,2,2,steel); // Cheek plates
      R(4,3,4,1,dark); R(5,4,2,2,dark);   // T-Visor
      
      // Cape peeking past shoulders
      R(1,6,1,5,cape); R(10,6,1,5,cape);
      R(0,8,1,3,capeL); R(11,8,1,3,capeL); // Folds
      
      // Pauldrons
      R(2,6,2,2,steel); R(8,6,2,2,steel); 
      R(2,6,1,1,shine); R(9,6,1,1,shine);
      
      // Chest
      R(4,6,4,3,steel); R(4,6,4,1,shine);
      
      // Belt
      R(4,9,4,1,leather); R(5,9,2,1,gold); // Buckle
      
      // Arms (Gauntlets)
      R(2,8,2,2,shade); R(8,8,2,2,shade);
      
      // Legs
      R(4,10,1,2,shade); R(7,10,1,2,shade); // Tights/chainmail
      R(3,11,2,1,steel); R(7,11,2,1,steel); // Iron Boots
  }
  ctx.restore();
}

// Updated drawChestPixel (original lines ~4247–4278) – added a dark frame outline for clarity
function drawChestPixel(ctx, x, y, tile){
  const { s, R } = gridN(ctx, x, y, tile, 12);
  const woodD = '#5a381f', woodM = '#7a4a26', woodL = '#b87946';
  const metal = '#c9b26a', lockC = '#0b141d', shade = '#2a1a10';
  const dark = '#0b141d';

  // frame outline (dark border around chest edges)
  R(0,3,1,8,dark);   // left edge
  R(11,3,1,8,dark);  // right edge
  R(0,10,12,1,dark); // bottom edge

  // chest body fills most of tile
  R(1,3,10,8,woodM);

  // lid and top edge highlight
  R(1,3,10,1,woodD); // top edge (wood dark)
  R(1,4,10,1,woodL); // band of lighter wood below

  // vertical board seams
  R(3,3,1,8,woodD);
  R(8,3,1,8,woodD);

  // metal band
  R(1,7,10,1,metal);

  // bottom shadow line so it sits on ground
  R(1,10,10,1,shade);

  // lock plate and keyhole
  R(5,5,2,3,metal);
  R(6,6,1,1,lockC);
}

function drawPropPixel(ctx, type, px, py, tile){
  const { R } = gridN(ctx, px, py, tile, 12);
  const t = (type || '').toLowerCase(); // Safety check

  // --- 1. LIQUIDS (Fix for Grey Squares) ---
  if (t.includes('slime') || t.includes('puddle') || t.includes('acid')) {
    ctx.save();
    ctx.globalAlpha = 0.8; // Translucent
    R(2,8,2,2,'#16a34a'); R(4,7,5,4,'#16a34a'); R(9,8,2,2,'#16a34a'); // Main pool
    ctx.globalAlpha = 1.0;
    R(3,8,1,1,'#4ade80'); R(5,7,4,1,'#4ade80'); R(9,8,1,1,'#4ade80'); // Surface tension rim
    R(6,5,1,1,'#dcfce7'); // Pop bubble
    R(4,8,1,1,'#14532d'); R(7,9,1,1,'#14532d'); // Deep chunks
    ctx.restore();
    return;
  }
  if (t.includes('blood')) {
    R(3,8,6,3,'#991b1b'); R(2,9,2,1,'#991b1b'); // Dark red pool
    R(4,8,1,1,'#ef4444'); R(7,9,1,1,'#ef4444'); // Fresh glint
    return;
  }

  // --- 2. CONTAINERS ---
  if (t === 'crate') {
    const wD='#3e2723', wM='#5d4037', wL='#8d6e63';
    R(1,1,10,10,wD); // Outline
    R(2,2,8,8,wM);   // Base
    R(2,2,8,1,wL); R(2,3,1,7,wL); // Top/Left Highlight
    // Reinforced Corners & Center
    R(2,2,1,2,wD); R(9,2,1,2,wD); R(2,8,1,2,wD); R(9,8,1,2,wD);
    R(5,5,2,2,wD);
    // Nails
    R(2,2,1,1,'#d4d4d4'); R(9,2,1,1,'#d4d4d4'); R(9,9,1,1,'#d4d4d4');
    return;
  }
  if (t.includes('barrel')) {
    const isTox = t.includes('toxic');
    const b = isTox ? '#15803d' : '#854d0e';
    const s = isTox ? '#14532d' : '#713f12';
    // Rounded shape (cut corners)
    R(2,2,8,8,b); R(1,3,1,6,b); R(10,3,1,6,b);
    R(2,3,2,6,s); R(9,3,2,6,s); // Cylindrical shading
    R(1,3,10,2,'#1f2937'); R(1,7,10,2,'#1f2937'); // Iron bands
    if(isTox){
       R(4,2,4,1,'#14532d'); // Open lid
       R(5,5,2,4,'#bef264'); // Leak
    } else {
       R(5,5,2,2,'#2a1d17'); // Bung
    }
    return;
  }

  // --- 3. DUNGEON / STONE ---
  if (t.includes('bone') || t.includes('skull')) {
    const white='#f3f4f6', shadow='#d1d5db', dark='#171717';
    
    // A. Complex Skull Pile
    if(t.includes('pile')){
       R(1,9,10,3,'#78716c'); // Dark base
       R(2,8,8,2,'#a8a29e');  // Mid-tone ash
       R(4,5,4,3,white);      // Center Skull
       R(4,6,1,1,dark); R(7,6,1,1,dark); // Eyes
       R(5,7,2,1,white);      // Jaw
       R(1,8,3,3,shadow); R(8,8,3,2,shadow); // Side skulls
       R(2,4,1,3,white);      // Stray Rib vertical
    } 
    // B. Plain Scattered Bones (Ribcage + Limbs)
    else if (t === 'bone') {
       // Spine & Pelvis
       R(6,3,1,6,white);      // Spine column
       R(5,9,3,2,white);      // Pelvis bone
       R(5,9,1,1,shadow); R(7,9,1,1,shadow); // Hip sockets

       // Ribcage (Curved)
       R(4,4,5,1,white);      // Top Rib
       R(4,5,1,1,white); R(8,5,1,1,white); // Rib tips
       R(4,6,5,1,white);      // Bottom Rib
       R(5,5,3,1,dark);       // Hollow chest cavity

       // Scattered Limbs
       R(2,5,1,3,white);      // Left Arm
       R(2,5,1,1,shadow);     // Shoulder joint
       R(9,4,1,4,white);      // Right Femur lying nearby
       R(9,8,1,1,shadow);     // Knee joint
    }
    // C. Single Skull (Fallback)
    else {
       R(4,7,4,3,white);      // Cranium
       R(4,8,1,1,dark); R(7,8,1,1,dark); // Eyes
       R(5,9,2,1,shadow);     // Teeth
    }
    return;
  }
  if (t === 'rubble' || t === 'debris') {
    const sM='#57534e', sL='#a8a29e';
    R(1,9,3,3,sM); R(1,9,2,1,sL); // Rock A
    R(5,8,4,4,'#1c1917'); R(5,8,3,1,sM); R(6,9,1,1,sL); // Rock B (Darker)
    R(9,10,2,2,sM); // Pebble
    R(2,6,1,1,'#d6d3d1'); R(8,5,1,1,'#d6d3d1'); // Floating dust
    return;
  }
  if (t === 'pillar') {
    R(1,1,10,2,'#e5e7eb'); // Capital
    R(2,3,8,1,'#9ca3af');  // Shadow
    R(2,4,8,6,'#374151');  // Shaft Dark
    R(3,4,1,6,'#e5e7eb'); R(5,4,1,6,'#e5e7eb'); R(7,4,1,6,'#e5e7eb'); // Fluting
    R(1,10,10,2,'#9ca3af'); // Base
    return;
  }
if (t.includes('gargoyle')) { // Gargoyle Statue
     R(4,6,4,4,'#57534e'); // Squat Body
     R(5,5,2,2,'#78716c'); // Head
     R(2,5,2,4,'#292524'); R(8,5,2,4,'#292524'); // Folded Wings
     R(5,6,1,1,'#ef4444'); R(6,6,1,1,'#ef4444'); // Red Eyes
     R(4,10,4,1,'#44403c'); // Base
     return;
  }
  // --- Floor Grates (Broken or Intact) ---
  if (t.includes('grate')) {
    const metal='#475569', dark='#1e293b', rust='#7f1d1d';
    const pit='#020617';

    // 1. The Pit (Deep Background)
    R(1,1,10,10,pit); 

    // 2. Outer Frame
    R(1,1,10,1,metal); R(1,10,10,1,metal); // Top/Bottom
    R(1,2,1,8,metal);  R(10,2,1,8,metal);  // Sides
    R(1,1,1,1,rust);   R(10,10,1,1,rust);  // Rusted corners

    // 3. Vertical Bars
    // Left Bar: Broken top & bottom
    R(3,1,2,3,metal);  R(3,3,2,1,dark); // Top segment stub
    R(3,7,2,3,metal);  R(3,7,2,1,'#94a3b8'); // Bottom segment top (shiny break)
    
    // Center Bar: Intact but corroded
    R(6,1,2,10,metal); 
    R(6,2,1,8,'#94a3b8'); // Highlight
    R(6,5,2,2,rust);      // Rust patch
    
    // Right Bar: Bent/Dark
    R(9,1,1,10,dark);     // Shadowy bar
    return;
  }

  // --- 4. CRYPT / TREASURE ---
  if (t.includes('coffin') || t.includes('tomb')) {
    const stone = '#57534e', dark = '#292524', moss = '#4ade80';
    R(3,2,6,10,stone);     // Slab
    R(4,3,4,8,dark);       // Recess
    
    // Cross Relief (Only if not totally destroyed)
    if(!t.includes('rubble')) { 
      R(5,4,2,4,'#78716c'); R(4,5,4,2,'#78716c'); 
    }

    // Specific "Broken" Details
    if(t.includes('broken')) {
      R(2,6,8,2,dark);     // Large Crack across middle
      R(3,7,2,1,dark);     // Crack variation
      R(8,5,2,2,stone);    // Debris chunk on top
      R(2,10,3,1,'#a8a29e'); // Dust at base
      R(1,8,2,2,moss);     // Moss growing in crack
    }
    return;
  }
  if (t === 'urn' || t === 'vase') {
    R(4,3,4,1,'#d97706'); // Rim
    R(5,4,2,1,'#b45309'); // Neck
    R(3,5,6,6,'#d97706'); // Body
    R(3,5,1,6,'#92400e'); // Shadow
    R(6,6,1,4,'#fcd34d'); // Vertical Shine
    return;
  }
  if (t === 'treasure_pile') {
    R(1,9,10,3,'#b45309'); // Base Gold
    R(2,8,8,2,'#fbbf24');  // Mid
    R(4,6,4,2,'#fef3c7');  // Top
    R(2,8,1,1,'#fff'); R(8,6,1,1,'#fff'); // Sparkles
    R(5,7,2,2,'#dc2626');  // Ruby
    return;
  }

  // --- 5. NATURE / SPECIAL ---
if (t === 'rat_nest') {
    R(2,8,8,4,'#5c4033'); // Nest Base
    R(3,8,6,2,'#3e2723'); // Inner shadow
    R(4,8,1,1,'#000'); R(6,8,1,1,'#000'); // Eyes
    R(5,9,1,1,'#fca5a5'); // Pink Nose
    R(2,9,1,1,'#d4d4d4'); // Bone fragment
    R(8,9,1,1,'#fbbf24'); // Stolen coin (shiny)
    return;
  }
if (t === 'fern' || t.includes('plant')) {
    R(5,9,2,3,'#166534'); 
    R(2,6,3,3,'#22c55e'); R(7,6,3,3,'#22c55e'); 
    R(4,3,4,4,'#22c55e'); R(5,4,2,4,'#86efac'); 
    return;
  }
// --- 5b. SPECIAL DECOR: Spiderweb (Pixel Art) ---
  if (t.includes('web')) {
     const web = 'rgba(255, 255, 255, 0.5)'; // Main thread
     const dim = 'rgba(255, 255, 255, 0.2)'; // Faint spokes

     // 1. Spokes (The Skeleton)
     // Diagonals
     R(0,0,1,1,dim); R(11,0,1,1,dim); R(0,11,1,1,dim); R(11,11,1,1,dim);
     R(2,2,1,1,dim); R(9,2,1,1,dim); R(2,9,1,1,dim); R(9,9,1,1,dim);
     // Cardinals (Cross)
     R(6,1,1,2,dim); R(6,9,1,2,dim); // Vert
     R(1,6,2,1,dim); R(9,6,2,1,dim); // Horz
     
     // 2. Inner Ring (The Trap)
     R(4,4,1,1,web); R(7,4,1,1,web); R(4,7,1,1,web); R(7,7,1,1,web); // Corners
     R(5,3,2,1,web); R(5,8,2,1,web); // Top/Bot
     R(3,5,1,2,web); R(8,5,1,2,web); // Left/Right

     // 3. Outer Ring (Draping)
     R(1,3,1,1,web); R(3,1,1,1,web); // TL Curve
     R(8,1,1,1,web); R(10,3,1,1,web); // TR Curve
     R(1,8,1,1,web); R(3,10,1,1,web); // BL Curve
     R(8,10,1,1,web); R(10,8,1,1,web); // BR Curve
     
     // 4. Center Knot & Spider
     R(5,5,2,2,dim); 
     // Tiny Spider
     ctx.fillStyle = '#171717'; // Dark Body
     ctx.fillRect(px+5, py+5, 3, 3);
     ctx.fillStyle = '#ef4444'; // Red Eye
     ctx.fillRect(px+6, py+6, 1, 1);
     // Legs (Pixel perfect)
     R(4,5,1,1,'#000'); R(8,5,1,1,'#000');
     R(4,7,1,1,'#000'); R(8,7,1,1,'#000');
     
     return;
  }
// A. Magic Crystal (Cluster of Thin Spikes)
  if (t.includes('crystal')) { 
     const cMain='#a855f7', cLit='#e9d5ff', cDark='#6b21a8';
     
     // 1. Tall Center Spike
     R(5,2,2,8,cMain); 
     R(6,2,1,8,cLit); // Sharp Highlight
     
     // 2. Angled Left Spike
     R(2,6,2,4,cMain);
     R(2,6,1,4,cLit);
     
     // 3. Angled Right Spike
     R(8,5,2,5,cMain);
     R(9,5,1,5,cLit);
     
     // 4. Base Glow
     R(4,9,4,1,cDark);
     ctx.save();
     ctx.fillStyle = 'rgba(168, 85, 247, 0.4)';
     ctx.fillRect(px+3, py+7, 6, 3);
     ctx.restore();
     return;
  }

  // B. Obsidian Shard (Thick, jagged, volcanic glass)
  if (t.includes('obsidian')) { 
     const obBase='#020617', obMid='#1e293b', obShin='#4f46e5';

     // 1. Heavy Jagged Mass (Asymmetric)
     R(2,7,9,4,obBase); // Wide Base
     R(3,4,6,3,obBase); // Mid Bulk
     R(6,2,2,2,obBase); // Sharp Tip offset

     // 2. Razor Sharp Facets (Reflective Lines)
     R(4,4,1,5,obShin); // Vertical sheen
     R(5,7,4,1,obShin); // Horizontal sheen
     R(3,8,1,2,obMid);  // Surface texture
     
     // 3. Void Particles (Dark Aura)
     R(1,5,1,1,'#312e81'); R(10,3,1,1,'#312e81'); R(9,9,1,1,'#312e81');
     return;
  }

// --- NEW: Industrial Pipe Debris ---
  if (t.includes('pipe')) {
     const metal = '#64748b', shadow = '#334155', rust = '#a16207';
     
     // 1. Horizontal Segment
     R(1,7,8,4,metal);      // Main body
     R(1,7,8,1,'#94a3b8');  // Top cylindric highlight
     R(1,10,8,1,shadow);    // Bottom shadow
     
     // 2. Vertical Segment (Elbow joint)
     R(6,2,4,6,metal);
     R(6,2,1,6,'#94a3b8');  // Left highlight
     R(9,2,1,6,shadow);     // Right shadow

     // 3. Flange / Connector Ring
     R(3,6,2,6,'#475569');  // The bulky ring
     R(3,6,1,6,'#cbd5e1');  // Ring highlight
     
     // 4. Details (Rust & Holes)
     R(4,8,1,1,rust); R(7,4,1,1,rust); // Corrosion
     R(9,8,2,2,'#0f172a');  // Broken open end (Right)
     R(7,1,2,1,'#0f172a');  // Broken open end (Top)
     return;
  }

// --- NEW: Lighting Props ---
  if (t.includes('candle') || t.includes('lamp')) {
     const gold = '#d97706', dark = '#78350f', light = '#fbbf24';
     const wax = '#fff7ed', flame = '#ef4444';
     
     // 1. Tall Floor Stand
     R(2,10,8,1,dark);  // Wide Base Bottom
     R(3,9,6,1,gold);   // Base Taper
     R(5,5,2,4,gold);   // Vertical Stem
     R(6,5,1,4,light);  // Stem Highlight
     R(3,5,6,1,dark);   // Cup / Tray
     
     // 2. The Candle
     R(5,2,2,3,wax);    // Wax Body
     R(4,3,1,2,wax);    // Dripping Wax (Left)
     
     // 3. The Flame
     R(5,1,2,1,'#fcd34d'); // Bright Core
     R(6,0,1,1,flame);     // Tip
     
     // 4. Glow Halo (Subtle)
     ctx.save();
     ctx.fillStyle = 'rgba(251, 191, 36, 0.2)';
     ctx.fillRect(px+2, py, tile-4, tile/2);
     ctx.restore();
     return;
  }

// --- 5. DECOR: Chains & Carpets ---
  if (t.includes('chain')) { // Iron Chain
     for(let i=0; i<12; i+=3) {
       R(5,i,2,2,'#9ca3af'); // Link Light
       R(5,i+1,2,1,'#4b5563'); // Link Shadow
       R(5,i,1,1,'#d1d5db'); // Highlight
     }
     return;
  }
  if (t.includes('carpet')) { // Red Carpet
     R(2,0,8,12,'#991b1b'); // Red Base
     R(1,0,1,12,'#fbbf24'); R(10,0,1,12,'#fbbf24'); // Gold Trim
     R(5,0,2,12,'#7f1d1d'); // Darker center path
     R(2,0,1,12,'#ef4444'); // Fabric Highlight
     return;
  }
  if (t.includes('vase') || t.includes('urn')) { // Golden Vase / Urn
     const isGold = t.includes('gold');
     const cBase = isGold ? '#fbbf24' : '#d97706';
     const cShad = isGold ? '#b45309' : '#92400e';
     const cHigh = isGold ? '#fef3c7' : '#fbbf24';
     
     R(4,3,4,1,cBase); // Rim
     R(5,4,2,1,cShad); // Neck
     R(3,5,6,6,cBase); // Body
     R(3,5,1,6,cShad); // Side Shadow
     R(6,6,1,4,cHigh); // Shine
     return;
  }

  // --- 6. NATURE: Plants & Nests ---
  if (t.includes('vine')) { // Vine Cluster
     R(5,0,2,12,'#15803d'); // Main thick vine
     R(2,3,3,3,'#16a34a');  // Leaf clump left
     R(7,6,3,3,'#16a34a');  // Leaf clump right
     R(3,9,3,3,'#16a34a');  // Leaf clump bottom
     R(6,2,1,1,'#86efac'); R(8,7,1,1,'#86efac'); // Highlights
     return;
  }
  if (t.includes('flower')) { // Giant Flower
     R(5,7,2,5,'#166534'); // Stalk
     R(2,3,8,4,'#db2777'); // Pink petals wide
     R(3,2,6,6,'#be185d'); // Darker inner
     R(5,5,2,2,'#fef08a'); // Pollen center
     R(2,8,3,2,'#15803d'); // Base leaves
     return;
  }
  if (t.includes('rat')) { // Rat Nest
     R(2,8,8,4,'#5c4033'); // Twigs/Trash
     R(3,9,2,1,'#a3a3a3'); // Grey fluff
     R(4,7,1,1,'#ef4444'); R(6,7,1,1,'#ef4444'); // Glowing eyes
     R(7,9,1,1,'#fca5a5'); // Pink tail?
     return;
  }
  if (t.includes('web')) { // Spiderweb
     ctx.save();
     ctx.strokeStyle = 'rgba(255,255,255,0.4)';
     ctx.lineWidth = 1;
     ctx.beginPath();
     ctx.moveTo(px,px); ctx.lineTo(px+tile,py+tile); // Cross 1
     ctx.moveTo(px+tile,py); ctx.lineTo(px,py+tile); // Cross 2
     ctx.stroke();
     ctx.beginPath(); ctx.arc(px+tile/2, py+tile/2, tile*0.25, 0, 7); ctx.stroke(); // Ring
     ctx.restore();
     return;
  }

  // --- 7. ELEMENTAL: Magma & Rock ---
  if (t.includes('magma') || t.includes('lava')) { 
     if(t.includes('vent')) { // Lava Vent
        R(2,8,8,4,'#271c19'); // Volcano Base
        R(4,8,4,2,'#ef4444'); // Magma rim
        R(5,5,2,3,'#f97316'); // Fire Plume
        R(5,3,2,2,'#7f1d1d'); // Smoke
     } else { // Magma Rock
        R(2,8,8,4,'#1c1917'); // Dark Rock
        R(3,7,2,2,'#1c1917');
        R(4,9,4,1,'#ef4444'); R(7,8,1,2,'#ef4444'); // Molten cracks
        R(5,9,2,1,'#fbbf24'); // Heat core
     }
     return;
  }
  if (t.includes('float')) { // Floating Rock
     R(3,4,6,5,'#57534e'); // The Rock
     R(4,3,4,1,'#a8a29e'); // Top highlight
     R(4,10,4,1,'#000');   // Shadow on ground (detached)
     return;
  }

  // --- 8. VOID / CRYSTAL ---
  if (t.includes('mote')) { // Star Mote
     R(5,5,2,2,'#f0abfc'); // Core
     ctx.save();
     ctx.fillStyle = 'rgba(232, 121, 249, 0.6)';
     ctx.fillRect(px+2, py+5, 8, 2); // Horizontal glow
     ctx.fillRect(px+5, py+2, 2, 8); // Vertical glow
     ctx.restore();
     return;
  }
  
  if (t.includes('crystal') || t.includes('shard')) { // Crystal & Obsidian
     const isObs = t.includes('obsidian');
     const col = isObs ? '#1f2937' : '#a855f7'; // Dark Grey vs Purple
     const lit = isObs ? '#3730a3' : '#e9d5ff'; // Indigo vs Lavender highlight
     
     // Main Shard
     R(5,3,2,8,col); 
     R(6,3,1,8,lit); // Highlight edge
     
     // Base Cluster
     R(3,8,2,3,col); R(8,8,2,3,col);
     
     // Aura / Particles
     if(isObs) {
       R(2,5,1,1,'#4c1d95'); R(9,6,1,1,'#4c1d95'); // Dark aura particles
     } else {
       ctx.save();
       ctx.fillStyle = 'rgba(168, 85, 247, 0.3)'; // Glow
       ctx.fillRect(px+2, py+2, 8, 8);
       ctx.restore();
     }
     return;
  }

  if (t.includes('float')) { // Floating Rock
     // Levitation Glow
     ctx.save();
     ctx.fillStyle = 'rgba(147, 197, 253, 0.2)'; 
     ctx.fillRect(px+2, py+8, 8, 2);
     ctx.restore();

     // The Rock (Hovering High)
     R(3,3,6,5,'#57534e'); // Rock Body
     R(3,3,2,1,'#a8a29e'); // Top Lit
     R(5,8,2,1,'#60a5fa'); // Magic Thruster/Rune
     R(4,11,4,1,'#000');   // Shadow on floor
     return;
  }
  
  if (t.includes('monolith')) { // Dark Monolith
        R(3,1,6,10,'#0f172a'); 
        R(4,3,1,7,'#2e1065'); // Dark purple groove
        R(7,3,1,7,'#2e1065');
        R(5,5,2,1,'#d8b4fe'); // Glowing Rune 1
        R(5,8,2,1,'#d8b4fe'); // Glowing Rune 2
        return;
    }

    // --- 9. GILDED HALLS ---
    if (t.includes('gold vase')) {
        R(4,2,4,1,'#fcd34d'); // Rim highlight
        R(3,3,6,1,'#f59e0b'); // Neck
        R(4,4,4,1,'#b45309'); // Neck shadow
        R(2,5,8,5,'#f59e0b'); // Body
        R(3,10,6,1,'#b45309'); // Base
        R(7,6,2,3,'#fef3c7'); // Bright reflection
        R(4,6,1,3,'#b45309'); // Etching/detail
        return;
    }
    if (t.includes('statue')) { // Statue Head
        R(3,2,6,8,'#e2e8f0'); // Marble base head
        R(4,2,4,1,'#f8fafc'); // Top highlight
        R(3,5,1,2,'#94a3b8'); // Left ear/side shadow
        R(8,5,1,2,'#94a3b8'); // Right ear/side shadow
        R(4,5,1,1,'#64748b'); // Eye socket L
        R(7,5,1,1,'#64748b'); // Eye socket R
        R(5,6,2,2,'#94a3b8'); // Nose shadow
        R(4,8,4,1,'#64748b'); // Mouth line
        R(2,10,8,2,'#94a3b8'); // Base/neck broken
        return;
    }
    if (t.includes('stool')) { // Velvet Stool
        R(2,7,1,4,'#b45309'); // Left leg
        R(9,7,1,4,'#b45309'); // Right leg
        R(3,8,6,1,'#f59e0b'); // Crossbar
        R(1,4,10,3,'#9f1239'); // Velvet cushion
        R(2,4,8,1,'#e11d48'); // Cushion highlight
        R(1,7,10,1,'#fcd34d'); // Gold trim on cushion bottom
        return;
    }
    if (t.includes('treasure')) { // Treasure Pile
        R(1,8,10,3,'#d97706'); // Pile base shadow
        R(2,6,8,4,'#f59e0b'); // Main gold mound
        R(3,4,6,3,'#fbbf24'); // Mid gold
        R(5,2,2,3,'#fcd34d'); // Top peak
        R(3,7,1,1,'#fff'); // Sparkle
        R(8,5,1,1,'#fff'); // Sparkle
        R(6,3,1,1,'#fff'); // Sparkle
        R(4,6,2,2,'#be123c'); // Ruby embedded
        R(7,8,2,2,'#1d4ed8'); // Sapphire embedded
        return;
    }
    if (t.includes('carpet')) { // Red Carpet (Rolled)
        R(2,2,8,8,'#9f1239'); // Carpet base square-ish
        R(3,3,6,6,'#be123c'); // Lighter red inner
        R(4,2,4,8,'#fcd34d'); // Gold pattern stripe down middle
        R(2,9,8,1,'#fbbf24'); // Fringes bottom
        R(2,2,8,1,'#fbbf24'); // Fringes top
        return;
    }
    if (t.includes('chandelier')) { // Chandelier Fallen
        R(3,7,6,2,'#b45309'); // Main brass ring
        R(2,6,8,1,'#f59e0b'); // Top brass ring
        R(4,8,4,2,'#78350f'); // Broken center support
        // Broken candles/glass
        R(1,5,2,2,'#f8fafc'); // Left shattered glass
        R(9,8,2,2,'#f8fafc'); // Right shattered glass
        R(1,4,1,1,'#fcd34d'); // Flicker/spark?
        R(6,5,1,2,'#fef3c7'); // Center candle bent
        R(5,9,2,1,'#fef3c7'); // Another candle on floor
        return;
    }

    // Fallback (Generic Box)
    R(2,2,8,8,'#52525b');
    R(2,2,8,1,'#a1a1aa');
}


function drawShadowPixel(ctx, x, y, tile){
  const { s, R } = gridN(ctx, x, y, tile, 12);
  const dark='#0b141d', deep='#060a10';
  // oval silhouette
  R(3,2,6,2,dark);
  R(2,4,8,6,dark);
  R(3,10,6,1,deep);
}
function drawHeartlessPixel(ctx, x, y, tile, enemy){
  const { s, R } = gridN(ctx, x, y, tile, 12);
  const body = '#0f172a'; // Ink black
  const eyeColor  = '#facc15'; // Glowing yellow
  const facing = enemy?.facing || 'down';
  const twitch = Math.floor(Date.now() / 200) % 2; 

  // Antennae
  if (twitch === 0) {
    R(4,1, 1,3, body); R(7,2, 1,2, body);
  } else {
    R(5,2, 1,2, body); R(8,1, 1,3, body);
  }

  // Round head + small body
  R(3,4, 6,5, body); // Head
  R(4,9, 4,2, body); // Body/Feet base

  if (facing === 'up') {
      // No eyes visible
  } else if (facing === 'right' || facing === 'left') {
      R(7,5, 1,1, eyeColor); // Side eye
  } else {
      R(4,5, 1,1, eyeColor); R(7,5, 1,1, eyeColor); // Both eyes
  }
}


function drawHoodedPixel(ctx, x, y, tile){
  const { s, R } = gridN(ctx, x, y, tile, 12);
  // palette
  const hood='#0d1118', inner='#06090e', trim='#334257', pin='#b7c6e1';
  const robe='#131c28', fold='#101a25', arm='#101723', hands='#cbbba0';

  // shadowed hood silhouette + inner darkness
  R(2,0,8,3,hood);             // crown of hood
  R(3,1,6,1,inner);            // deep shadow inside hood

  // hood trim + brooch pin
  R(2,3,8,1,trim);
  R(5,4,2,1,pin);

  // shoulders / arms (clearer outline)
  R(1,4,2,2,arm);              // left shoulder block
  R(9,4,2,2,arm);              // right shoulder block

  // robe body with 2 fold bands for depth
  R(2,5,8,6,robe);
  R(3,7,6,1,fold);
  R(3,9,6,1,fold);

  // tiny hands peeking (helps readability)
  R(3,10,1,1,hands);
  R(8,10,1,1,hands);
}





/* ================= MIMIC (chest look, subtle tells) ================= */
function drawMimicPixel(ctx, x, y, tile){
  const { s, R } = gridN(ctx, x, y, tile, 12);

  // base chest colors (same family as chest)
  const woodD = '#53341e';
  const woodM = '#734425';
  const woodL = '#c58753';
  const metal = '#d4be74';
  const shadow= '#22150d';

  // body (same silhouette)
  R(1,3,10,8,woodM);
  R(1,3,10,1,woodD);   // top edge
  R(1,4,10,1,woodL);   // highlight
  R(3,3,1,8,woodD);    // boards
  R(8,3,1,8,woodD);
  R(1,7,10,1,metal);   // band
  R(1,10,10,1,shadow); // sit shadow

  // “tells”: off-center lock + tiny teeth + peeking tongue
  const lockC = '#0b141d';
  R(6,5,2,3,metal);     // lock plate shifted right a bit
  R(7,6,1,1,lockC);

  // little teeth (white nubs) under the band
  const tooth = '#e9e9e9';
  R(4,8,1,1,tooth);
  R(7,8,1,1,tooth);

  // tongue (just a hint)
  const tongue = '#b54646';
  R(5,9,2,1,tongue);
}

function drawBatPixel(ctx, x, y, tile){
  const { R } = gridN(ctx, x, y, tile, 12);
  const dark='#0f172a', membrane='#4c1d95', bone='#1e1b4b';

  // Wings (Scalloped "M" shape, not bird-like)
  // Top Ridge (Bone)
  R(1,2,1,1,bone); R(2,1,3,1,bone); // Left Wing Top
  R(10,2,1,1,bone); R(7,1,3,1,bone); // Right Wing Top
  
  // Membrane (Webbing hanging down)
  R(1,3,1,3,membrane); R(2,2,2,3,membrane); // Left
  R(10,3,1,3,membrane); R(8,2,2,3,membrane); // Right
  
  // Body (Small, centered, furry)
  R(5,3,2,3,dark);     // Torso
  R(5,2,2,1,dark);     // Head
  R(4,1,1,2,dark); R(7,1,1,2,dark); // Large pointed ears
  R(5,3,1,1,'#facc15'); R(6,3,1,1,'#facc15'); // Glowing yellow eyes
  
  // Feet (Hanging)
  R(5,6,1,1,'#78350f'); R(6,6,1,1,'#78350f');
}

function drawSpiderPixel(ctx, x, y, tile){
  // 1. Arachnophobia Mode (Centered Text)
  if (window._arachnophobiaMode) { 
    ctx.fillStyle = '#fff'; 
    ctx.fillRect(x, y, tile, tile); 
    ctx.fillStyle = '#000'; 
    ctx.font = 'bold ' + (tile/3.5) + 'px sans-serif'; 
    ctx.textAlign = 'center'; 
    ctx.textBaseline = 'middle'; 
    ctx.fillText('SPIDER', x + tile/2, y + tile/2); 
    return; 
  }

  const { R } = gridN(ctx, x, y, tile, 12);
  // Color Palette - Legs are now pure BLACK (#000000)
  const leg='#000000', body='#1e293b', ab='#020617', shine='#334155', red='#ef4444';

  // --- LEGS (All set to 'leg' color) ---
  
  // Front Legs (Reaching forward)
  R(1,4,1,1,leg); R(2,3,1,1,leg); R(3,4,1,1,leg); // Front-Left
  R(10,4,1,1,leg); R(9,3,1,1,leg); R(8,4,1,1,leg); // Front-Right
  
  // Mid Legs (Sprawled wide)
  R(0,7,1,1,leg); R(1,6,1,1,leg); R(3,6,1,1,leg); // Mid-Left
  R(11,7,1,1,leg); R(10,6,1,1,leg); R(8,6,1,1,leg); // Mid-Right

  // Back Legs (Dragging behind)
  R(2,9,1,1,leg); R(3,8,1,1,leg); // Back-Left
  R(9,9,1,1,leg); R(8,8,1,1,leg); // Back-Right

  // --- BODY ---
  
  // Abdomen (Large, Bulbous)
  R(4,5,4,5,ab);        // Main dark mass
  R(3,6,1,3,ab); R(8,6,1,3,ab); // Rounding sides
  R(4,6,1,2,shine);     // Wet Highlight
  
  // Hourglass
  R(5,7,2,2,red);       
  R(5,7,1,1,'#fca5a5'); // Glint

  // Cephalothorax (Head)
  R(5,4,2,2,body); 
  R(4,5,1,1,red); R(7,5,1,1,red); // Fangs
  R(5,4,2,1,red); // Eyes
}

// Updated drawRatPixel with Directional Sprites
function drawRatPixel(ctx, x, y, tile, enemy){
  const { R } = gridN(ctx, x, y, tile, 12);
  const fur='#5d4037', furL='#8d6e63', skin='#ffab91', dark='#0f172a';
  const facing = enemy?.facing || 'down';

  if (facing === 'up') {
      R(3,5,6,6,fur); R(4,5,4,1,furL); // Body facing away
      R(2,5,2,2,skin); R(8,5,2,2,skin); // Ears on back
      R(5,11,2,1,skin); R(6,11,1,1,skin); // Tail hanging straight down
      R(3,11,2,1,skin); R(7,11,2,1,skin); // Paws
  } else if (facing === 'right' || facing === 'left') {
      R(3,6,6,4,fur); R(4,5,4,1,furL); // Body
      R(8,7,3,2,furL); // Snout
      R(11,8,1,1,skin); // Nose tip
      R(5,5,2,2,skin); // 1 Ear
      R(9,7,1,1,'#ef4444'); // 1 Eye
      R(2,8,2,1,skin); R(1,9,1,1,skin); R(0,10,2,1,skin); // Tail trailing backwards
      R(4,10,2,1,skin); R(7,10,2,1,skin); // Paws
  } else {
      // Default Down
      R(1,6,3,1,dark); R(0,7,1,2,dark); R(1,9,2,1,dark); // Head outline
      R(3,5,6,1,dark); R(9,6,2,1,dark); // Back outline
      R(11,7,1,2,dark); R(3,10,8,1,dark); // Rump/Belly outline
      R(2,6,7,4,fur); R(3,5,5,1,fur); // Body Gradient
      R(4,6,4,1,furL); // Top highlight
      R(1,7,2,2,furL); // Head Details
      R(0,8,1,1,skin); // Nose
      R(2,5,2,2,skin); // Big Ear
      R(2,7,1,1,'#ef4444'); // Red Eye
      R(11,8,1,1,skin); R(10,9,1,1,skin); R(9,9,1,1,skin); R(8,10,1,1,skin); // Tail
      R(3,11,2,1,skin); R(8,11,2,1,skin); // Paws
  }
}

// Updated drawGoblinPixel with 4-way Directional Art
function drawGoblinPixel(ctx, x, y, tile, enemy){
  const { R } = gridN(ctx, x, y, tile, 12);
  const skin='#15803d', skinL='#4ade80', leather='#854d0e', metal='#cbd5e1';
  const facing = enemy?.facing || 'down';

  // Base Body & Feet (mostly identical across directions)
  R(4,7,4,4,leather); R(4,8,4,1,'#a16207'); // Belt
  R(3,11,2,1,'#5c4033'); R(7,11,2,1,'#5c4033'); // Feet

  if (facing === 'up') {
      // BACK OF HEAD: No eyes, no nose.
      R(3,2,6,5,skin);
      R(1,3,2,1,skin); R(9,3,2,1,skin); // Ears
      R(2,8,2,2,skin); R(8,8,2,2,skin); // Arms (behind back)
      // Weapon held up/behind
      R(9,4,1,3,metal); R(8,7,3,1,'#78350f'); 
      
  } else if (facing === 'right' || facing === 'left') {
      // SIDE PROFILE: Facing Right (The canvas mirror handles 'left' automatically!)
      R(4,2,5,5,skin); // Thinner head
      R(4,3,2,1,skin); // Back ear
      R(7,3,1,1,'#ef4444'); // Single front eye
      R(8,4,2,2,skinL); // Nose pointing forward/right
      R(5,8,2,2,skin); // Single front arm visible
      // Weapon held in front
      R(7,6,1,3,metal); R(6,9,3,1,'#78350f'); 
      
  } else {
      // DEFAULT: Facing Down (Original Sprite)
      R(3,2,6,5,skin);
      R(1,3,2,1,skin); R(9,3,2,1,skin); // Ears
      R(4,3,1,1,'#ef4444'); R(7,3,1,1,'#ef4444'); // Eyes
      R(5,4,2,2,skinL); // Nose Highlight
      R(2,8,2,2,skin); R(8,8,2,2,skin); // Both Arms
      // Weapon at side
      R(9,6,1,3,metal); R(8,9,3,1,'#78350f');
  }
}

function drawSlimePixel(ctx, x, y, tile){
  const { R } = gridN(ctx, x, y, tile, 12);
  const gel='#22c55e', gelD='#14532d', shine='#86efac', core='#15803d';
  // Outline (Dark Green)
  R(2,5,8,6,gelD); R(3,4,6,1,gelD); R(1,9,10,2,gelD);
  // Main Body
  R(3,5,6,5,gel); R(2,9,8,2,gel);
  // Inner Core (Floating Skull/Bone hint)
  R(5,6,2,2,core);
  // Specular Highlights (Jelly look)
  R(3,5,2,1,shine); R(3,6,1,2,shine);
  R(8,5,1,1,shine);
  // Drips
  R(2,11,1,1,gel); R(9,11,1,1,gel);
}

function drawMadKingPixel(ctx, x, y, tile, enemy){
  const { s, R } = gridN(ctx, x, y, tile, 12);
  const gold='#e0c14f', gem='#64d2ff', ruby='#ff6b6b';
  const steel='#a7b1c4', plate='#8a96ab';
  const face='#ecd9bf', eye='#0b141d', hair='#b88d3a', beard='#a67c2e';
  const fur='#cfc8b6', cape='#5c0a16', capeDeep='#3d080f', shade='#0b141d';
  const facing = enemy?.facing || 'down';

  if (facing === 'up') {
      R(2,0,8,2,gold); R(4,-1,1,1,gold); R(6,-1,1,1,gold); R(8,-1,1,1,gold); // Crown back
      R(3,2,6,3,hair); // Back of hair
      R(1,5,10,2,fur); // Mantle across back
      R(1,7,10,5,cape); // Wide cape covering back
      R(2,8,8,4,capeDeep); // Cape folds
  } else if (facing === 'right' || facing === 'left') {
      R(3,0,6,2,gold); R(4,-1,1,1,gold); R(6,-1,1,1,gold); R(8,-1,1,1,gold); // Crown side
      R(7,1,1,1,ruby);
      R(4,2,4,3,face); // Side face
      R(7,3,1,1,eye); // One eye
      R(6,4,2,2,beard); // Side beard
      R(3,2,2,4,hair); // Hair trailing back
      R(2,6,8,2,fur); // Mantle profile
      R(4,8,4,4,plate); // Chest plate
      R(1,7,3,5,cape); // Cape flowing back
      R(5,7,2,4,steel); // Arm front
  } else {
      // Default Down
      R(2,0,8,1,gold); R(4,-1,1,1,gold); R(6,-1,1,1,gold); R(8,-1,1,1,gold);
      R(5,0,1,1,gem); R(7,0,1,1,ruby);
      R(3,1,6,1,hair);
      R(3,2,6,3,face);
      R(4,3,1,1,eye); R(7,3,1,1,eye); 
      R(5,4,2,1,beard); R(4,5,4,1,beard); 
      R(1,6,10,1,fur); 
      R(3,7,6,3,plate); R(4,8,4,1,steel); 
      R(1,7,1,4,cape); R(10,7,1,4,cape); 
      R(0,8,1,3,capeDeep); R(11,8,1,3,capeDeep);
      R(3,10,6,1,shade); 
  }
}


function drawReaperPixel(ctx, x, y, tile){
  const { s, R } = gridN(ctx, x, y, tile, 12);
  
  // Palette
  const hood = '#0f172a';   // Deep dark blue-grey
  const shadow = '#000000'; // Pure void
  const cloak = '#1e293b';  // Lighter slate for body
  const bone = '#e5e5e5';   // White bone
  const glow = '#ef4444';   // Red eyes
  const wood = '#451a03';   // Scythe handle
  const steel = '#94a3b8';  // Scythe blade
  const shine = '#cbd5e1';  // Blade highlight

  // --- Scythe (Draw first so it's behind/held) ---
  R(10, 1, 1, 11, wood);    // Long handle
  R(5, 1, 5, 1, steel);     // Blade Top
  R(4, 2, 1, 1, steel);     // Blade Curve
  R(4, 3, 1, 2, shine);     // Blade Tip (shiny)
  R(5, 4, 1, 1, steel);     // Blade Connection

  // --- Hood & Head ---
  R(3, 0, 6, 4, hood);      // Main Hood Shape
  R(4, 1, 4, 3, shadow);    // Face Void
  
  // Eyes
  R(4, 2, 1, 1, glow);
  R(7, 2, 1, 1, glow);

  // --- Cloak / Body ---
  R(2, 4, 8, 2, cloak);     // Shoulders/Mantle
  R(3, 6, 6, 5, cloak);     // Central body
  
  // Arms / Sides (Darker to simulate folds)
  R(2, 6, 1, 4, hood);      // Left side
  R(9, 6, 1, 4, hood);      // Right side

  // Skeletal Hand Reaching Out
  R(9, 6, 2, 1, bone); 

  // --- Tattered Hem (Ragged bottom) ---
  R(2, 10, 1, 1, cloak);
  R(3, 11, 1, 1, cloak);
  R(5, 11, 1, 1, cloak);
  R(7, 11, 1, 1, cloak);
  R(8, 11, 1, 1, cloak);
  R(9, 10, 1, 1, cloak);
}

function drawSkeletonPixel(ctx, x, y, tile, enemy){
  const { R } = gridN(ctx, x, y, tile, 12);
  const isElite = enemy && (enemy.elite || enemy.boss);
  const bone   = isElite ? '#57534e' : '#f1f5f9'; 
  const shadow = isElite ? '#292524' : '#94a3b8';
  const eyes   = isElite ? '#ef4444' : '#0f172a'; 
  const dark   = '#0f172a';
  const facing = enemy?.facing || 'down';

  if (facing === 'up') {
      R(4,1,4,3,bone); R(4,2,4,1,bone); // Back of skull
      R(5,5,2,4,bone); // spine
      R(3,6,6,1,bone); R(4,8,4,1,bone); // ribs
      R(4,9,4,1,bone); // Pelvis
      R(2,5,1,3,bone); R(9,5,1,3,bone); // Arms behind
      R(4,10,1,2,bone); R(7,10,1,2,bone); // Legs
      R(9,3,1,4,'#cbd5e1'); R(9,7,1,1,'#475569'); // Scimitar held back
  } else if (facing === 'right' || facing === 'left') {
      R(4,1,4,3,bone); R(4,2,3,1,bone); // Side skull
      R(7,2,1,1,dark); // One eye
      R(5,5,2,1,bone); R(5,7,2,1,bone); R(5,8,1,1,bone); // spine
      R(6,6,2,1,bone); // protruding rib
      R(4,9,3,1,bone); // Pelvis
      R(6,5,1,3,bone); // One arm
      R(5,10,1,2,bone); R(7,10,1,2,shadow); // Legs offset
      R(8,6,3,1,'#cbd5e1'); R(7,6,1,1,'#475569'); R(9,5,1,1,'#cbd5e1'); // Scimitar forward
  } else {
      // Default Down
      R(4,1,4,3,bone); R(4,2,4,1,bone); // Forehead
      R(4,2,1,1,dark); R(7,2,1,1,dark); // Eyes
      R(5,3,2,1,eyes); // Nose hole
      R(3,5,6,1,bone); R(4,5,4,1,shadow); // Top Rib
      R(3,6,6,1,dark); // Gap
      R(4,7,4,1,bone); // Bottom Rib
      R(5,8,2,1,bone); // Spine
      R(4,9,4,1,bone); // Pelvis
      R(2,5,1,3,bone); R(9,5,1,3,bone); // Arms
      R(4,10,1,2,bone); R(7,10,1,2,bone); // Legs
      R(10,4,1,4,'#cbd5e1'); R(10,8,1,1,'#475569'); R(9,7,1,1,'#cbd5e1'); // Scimitar
  }
}

function drawMagePixel(ctx, x, y, tile, enemy){
  const { R } = gridN(ctx, x, y, tile, 12);
  const robe='#4c1d95', trim='#c084fc', skin='#fca5a5', dark='#0f172a';
  const facing = enemy?.facing || 'down';

  if (facing === 'up') {
      R(3,4,6,7,robe); // Robe Body back
      R(3,1,6,3,robe); // Hood back (no eyes)
      R(9,2,1,10,'#78350f'); // Staff behind
      R(8,1,3,2,'#facc15'); R(9,1,1,1,'#ef4444'); // Staff Head
  } else if (facing === 'right' || facing === 'left') {
      R(4,4,4,7,robe); // Robe profile
      R(6,4,1,8,trim); // Sash offset
      R(4,1,5,3,robe); // Hood profile
      R(7,2,2,2,dark); // Face shadow offset
      R(8,3,1,1,'#fbbf24'); // Single Glowing Eye
      R(7,5,1,1,skin); // Hand reaching out
      R(8,5,2,1,'#38bdf8'); // Sparkles front
      R(4,2,1,10,'#78350f'); // Staff side
      R(3,1,3,2,'#facc15'); R(4,1,1,1,'#ef4444'); // Staff Head side
  } else {
      // Default Down
      R(3,4,6,7,robe);
      R(5,4,2,8,trim); // Central sash
      R(3,1,6,3,robe);
      R(4,2,4,2,dark); // Face shadow
      R(5,3,1,1,'#fbbf24'); R(7,3,1,1,'#fbbf24'); // Glowing Eyes
      R(9,2,1,10,'#78350f'); // Staff (Right Hand)
      R(8,1,3,2,'#facc15'); R(9,1,1,1,'#ef4444'); // Gold Head / Ruby
      R(1,5,2,1,skin); // Magic (Left Hand)
      R(1,3,1,2,'#38bdf8'); R(2,4,1,1,'#38bdf8'); // Sparkles
  }
}






// Generic dispatcher, scales to tile or 2*tile for bosses
// Backward-compatible: accepts (ctx, type, x, y, sizePx) OR (ctx, enemyObj, x, y, sizePx)
function drawEnemyPixel(ctx, typeOrEnemy, x, y, sizePx){
  const enemy = (typeof typeOrEnemy === 'string' || !typeOrEnemy || !typeOrEnemy.type)
    ? { type: typeOrEnemy }
    : typeOrEnemy;

  // apply boss/elite tint or damage/heal flash
ctx.save();
if (enemy._flashColor && enemy._flashTime > Date.now()) {
    // Override filter for flash effect
    // Red flash (damage) or Green flash (heal)
    const color = enemy._flashColor;
    // Simple filter hack: brightness/sepia/hue-rotate to approximate color
    if (color === 'red') ctx.filter = 'brightness(0.6) sepia(1) hue-rotate(-50deg) saturate(5)'; 
    else if (color === 'green') ctx.filter = 'brightness(1.2) sepia(1) hue-rotate(50deg) saturate(5)';
} else if (enemy.burning) {
    ctx.filter = 'sepia(1) hue-rotate(-50deg) saturate(3)';
} else if (enemy.bleeding) {
        ctx.filter = 'sepia(1) hue-rotate(-50deg) saturate(1) brightness(0.7)';
    } else if ((enemy.boss || enemy.elite) && enemy.tint){
      ctx.filter = enemy.tint;
    }

    // --- NEW: Horizontal Sprite Mirroring Only ---
    // Flips the "Right" side-profile pixel art to face "Left" automatically.
    if (enemy.facing === 'left') {
        ctx.translate(x + sizePx / 2, y + sizePx / 2);
        ctx.scale(-1, 1);
        ctx.translate(-(x + sizePx / 2), -(y + sizePx / 2));
    }

      const t = String(enemy.type || '').toLowerCase();
        if (t.includes('mad') && t.includes('king')) { drawMadKingPixel(ctx, x, y, sizePx, enemy); ctx.restore(); return; }
  if (t.includes('hood'))                     { drawHoodedPixel(ctx, x, y, sizePx);  ctx.restore(); return; }
  if (t.includes('shadow'))                   { drawShadowPixel(ctx, x, y, sizePx);  ctx.restore(); return; }
// --- NEW: Link Reaper ---
  if (t.includes('reaper'))    { drawReaperPixel(ctx, x, y, sizePx);    ctx.restore(); return; }

  if (t.includes('heartless')) { drawHeartlessPixel(ctx, x, y, sizePx, enemy); ctx.restore(); return; }
  if (t.includes('rat'))       { drawRatPixel(ctx, x, y, sizePx, enemy);       ctx.restore(); return; }
  if (t.includes('bat'))       { drawBatPixel(ctx, x, y, sizePx, enemy); ctx.restore(); return; }
  if (t.includes('spider'))    { drawSpiderPixel(ctx, x, y, sizePx, enemy); ctx.restore(); return; }
  if (t.includes('goblin'))    { drawGoblinPixel(ctx, x, y, sizePx, enemy); ctx.restore(); return; } 
  if (t.includes('slime'))     { drawSlimePixel(ctx, x, y, sizePx, enemy); ctx.restore(); return; }
  if (t.includes('skeleton')) { drawSkeletonPixel(ctx, x, y, sizePx, enemy); ctx.restore(); return; }
  if (t.includes('mage'))      { drawMagePixel(ctx, x, y, sizePx, enemy); ctx.restore(); return; }
  if (t.includes('mimic')) { drawMimicPixel(ctx, x, y, sizePx); ctx.restore(); return; } // Added ctx.restore()
  if (t.includes('clone') || t.includes('mirror')){
    drawPlayerHelmet(ctx, x, y, sizePx, state.player.facing || 'down');
    ctx.restore();
    return;
  }
if (t === 'warlord') {
      ctx.fillStyle = '#ef4444'; 
      ctx.font = 'bold ' + (sizePx) + 'px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline='middle';
      ctx.fillText('W', x + sizePx/2, y + sizePx/2);
      ctx.restore(); return;
  }
  // fallback blocky monster
  const s = Math.max(1, Math.floor(sizePx/6)), px=x, py=y;
  const R=(cx,cy,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(px+cx*s,py+cy*s,w*s,h*s);};
  R(1,2,4,3,'#7a2b2b'); R(2,3,1,1,'#0b141d'); R(3,3,1,1,'#0b141d');
  ctx.restore();
}


// Full-tile door (flush to edges). Variants: 'wood' (default) or 'iron'.
function drawDoorPixel(ctx, x, y, tile, variant='wood'){
  const { s, R } = gridN(ctx, x, y, tile, 12);

  if (variant === 'iron'){
    // outer shadow border (full tile)
    R(0,0,12,12,'#0b141d');
    // thick steel frame
    R(1,1,10,10,'#2a343f');
    // inner slab
    R(2,2,8,8,'#3a4654');
    // rivets
    R(3,3,1,1,'#c7d0db'); R(8,3,1,1,'#c7d0db');
    R(3,8,1,1,'#c7d0db'); R(8,8,1,1,'#c7d0db');
    // hinge strip (left)
    R(1,3,1,2,'#0b141d'); R(1,7,1,2,'#0b141d');
    // handle
    R(8,6,1,1,'#e6edf5'); R(9,6,1,1,'#9aa7b5');
    return;
  }

  // === WOOD (default) ===
  // outer shadow border (full tile)
  R(0,0,12,12,'#0b141d');

  // heavy frame filling the tile minus 1px inset
  const frame   = '#2b1c10';
  R(1,1,10,10,frame);

  // wood slab inside the frame
  const wood1   = '#7a4f2b';
  const wood2   = '#684225';
  const hi      = '#9b6a3c';
  const shadow  = '#20150c';
  const brass   = '#d7b46a';

  // horizontal planks (fill the entire inner area)
  R(2,2,8,2,wood2);
  R(2,4,8,2,wood1);
  R(2,6,8,2,wood2);
  R(2,8,8,2,wood1);

  // subtle bevel: top highlight & bottom shadow on the frame
  R(1,1,10,1,hi);           // top rim highlight
  R(1,10,10,1,shadow);      // bottom rim shadow
  R(1,1,1,10,shadow);       // left rim shadow
  R(10,1,1,10,shadow);      // right rim shadow

  // hinges (left) for visual read
  R(1,3,1,2,shadow);
  R(1,7,1,2,shadow);

  // handle (right)
  R(9,6,1,1,brass);
  R(8,6,1,1,'#b0894e');     // tiny shade behind the knob
}



// Full-tile 12×12 pickup sprites (scaled to the tile with no padding)
function drawPickupPixel(ctx, item, px, py, tile){
  const kind = item?.kind;
  const pl = item?.payload; 
  // Safety: handle payload being a number (potions) or object (weapons)
  const name = (typeof pl === 'string' ? pl : (pl?.name || ''));

  const u = (tile || 12) / 12; 
  const P = (x,y,c,w=1,h=1)=>{ 
    ctx.fillStyle = c; 
    ctx.fillRect(px + x*u, py + y*u, w*u, h*u); 
  };

  // Palette
  const wood='#855e42', woodD='#5c4033', steel='#94a3b8', iron='#475569';
  const gold='#fbbf24', goldD='#b45309', red='#ef4444', blue='#3b82f6';
  const green='#22c55e', gem='#a5f3fc', dark='#0f172a', fuse='#fca5a5';

      if (kind === 'weapon') {
        const t = pl.type || 'one';
        const n = (pl.name||'').toLowerCase();
        
        // High Detail Palette
        const wD='#3f2e22', wM='#8d6e63', wL='#a18e84'; // Wood
        const sD='#334155', sM='#94a3b8', sL='#f1f5f9'; // Steel
        const gD='#b45309', gM='#f59e0b', gL='#fcd34d'; // Gold
        const bD='#1e3a8a'; // Blue (for Key handle)

        if(n.includes('key of destiny')) { 
           // Kingdom Key (Vertical Alignment)
           
           // 1. The Guard (Gold Box Frame)
           P(3,8,gL,6,1);  // Top bar of guard
           P(4,11,gL,4,1); // Bottom bar of guard
           P(3,9,gL,1,2);  // Left vertical
           P(8,9,gL,1,2);  // Right vertical
           
           // 2. The Grip (Blue)
           P(4,9,'#2563eb',4,2); // Royal Blue handle inside guard
           
           // 3. The Shaft (Silver)
           P(5,2,sL,2,6); // Main silver rod
           P(6,2,sM,1,6); // Rod shading
           
           // 4. The Teeth (Crown Shape)
           P(7,2,sL,3,2); // The protruding bit
           P(8,2,sD,1,2); // The negative space (notch) defining the crown teeth
           
           // 5. Keychain
           P(5,11,sM,2,1); // Silver link at bottom
        }
        else if(t==='axe'){
           P(5,4,wD,2,7); P(6,4,wM,1,7); // Handle with grain
           P(5,11,sD,2,1); // Pommel
           // Detailed Head
           P(3,2,sD,6,3); // Dark center
           P(2,2,sL,1,5); P(9,2,sL,1,5); // Sharp Edges
           P(3,2,sM,1,2); P(8,2,sM,1,2); // Bevels
           P(4,3,sL,1,1); P(7,3,sL,1,1); // Glint
        } 
        else if(t==='spear'){
           // Long Pole with Grip
           P(2,10,wD,2,2); P(4,8,wM,2,2); P(6,6,wD,2,2); P(8,4,wM,2,2);
           P(9,3,gD,2,2); // Mounting
           P(10,1,sL,2,3); // Spearhead main
           P(11,2,sM,1,2); // Spearhead shadow
           P(12,0,sL,1,1); // Tip sharpness
        } 
        else if(t==='two'){ // Claymore
           P(4,10,wD,2,2); // Pommel
           P(5,8,wM,2,2); // Grip
           // V-Shape Guard
           P(3,7,gD,6,1); P(2,6,gD,1,1); P(9,6,gD,1,1);
           // Wide Blade
           P(5,1,sM,2,6); // Mid ridge
           P(4,1,sL,1,6); P(7,1,sL,1,6); // Edges
           P(5,2,sD,2,2); // Fuller (groove)
        } 
        else if(t==='staff'){
           P(6,4,wD,2,8); P(7,4,wM,1,8); // Staff shaft
           // Colors
           let gem = '#d946ef'; // Pink
           let head = gD; // Gold mount
           if (n.includes('fire')) { gem='#ef4444'; head='#7f1d1d'; }
           else if (n.includes('ice')) { gem='#06b6d4'; head='#164e63'; }
           else if (n.includes('lightning')) { gem='#facc15'; head='#854d0e'; }
           else if (n.includes('poison')) { gem='#22c55e'; head='#14532d'; }
           else if (n.includes('void')) { gem='#7e22ce'; head='#3b0764'; }
           else if (n.includes('wind')) { gem='#f8fafc'; head='#94a3b8'; } // White/Silver
           else if (n.includes('earth')) { gem='#92400e'; head='#451a03'; } // Brown/Dark Wood

           // Ornate Head
           P(5,1,head,4,3); // Casing
           P(6,2,gem,2,2); // Big Gem
           P(5,0,gem,1,1); P(8,0,gem,1,1); // Floating bits
           P(4,2,head,1,1); P(9,2,head,1,1); // Side prongs
        } 
        else if(t==='hand'){ // Claws
           // Grip
           P(2,8,wD,8,2); P(3,8,wL,6,1);
           // Triple Blades
           P(2,4,sL,2,4); P(5,3,sL,2,5); P(8,4,sL,2,4); 
           P(3,4,sM,1,4); P(6,3,sM,1,5); P(9,4,sM,1,4); // Blade shadows
        } 
        else { // Shortsword
           P(2,9,wD,2,2); // Pommel
           P(3,8,wM,2,1); // Grip
           P(3,7,gM,4,1); // Guard
           P(2,7,gD,1,1); P(7,7,gD,1,1); // Guard ends
           P(4,6,sM,2,1); // Base
           P(4,2,sL,2,4); // Blade
           P(5,2,sD,1,4); // Ridge
        }
        return;
      }

      if (kind === 'gold') {
          P(2,9,gold,3,2);
          P(5,8,gold,3,3);
          P(8,9,gold,2,2);
          // Pile
          P(3,9,'#fff',1,1);
          P(6,9,'#fff',1,1); // Sparkles
          return;
      }
  
// Enhanced Palette for Loot
    const sD='#334155', sM='#94a3b8', sL='#f1f5f9'; // Steel
    const gD='#b45309', gM='#f59e0b', gL='#fcd34d'; // Gold
    const pD='#4a0404', pL='#f87171'; // Potion Shading

    if (kind === 'potion' || kind === 'tonic' || kind === 'antidote') {
      const c = kind==='potion'?[red,pD,pL]:kind==='tonic'?[blue,'#1e3a8a','#60a5fa']:[green,'#064e3b','#4ade80'];
      P(4,4,dark,4,8); P(3,5,dark,6,6); P(2,6,dark,8,4); // Rounder Bottle silhouette
      P(4,5,c[1],4,6); P(3,6,c[1],6,4); // Liquid base shadow
      P(4,6,c[0],3,4); P(3,7,c[0],5,2); // Liquid core
      P(5,2,woodD,2,2); P(5,3,dark,2,1); // Cork & Rim
      P(4,6,c[2],1,1); P(7,7,'#fff',1,1); // Refraction & Glint
      return;
    }

    if (kind === 'bomb') {
      P(3,4,dark,6,7); P(2,5,dark,8,5); P(4,3,dark,4,2); // Round Iron body
      P(4,5,iron,4,5); P(3,6,iron,6,3); // Metal texture
      P(5,1,fuse,1,3); P(6,0,gL,1,1); P(4,1,gM,1,1); // Burning Fuse
      P(4,6,sL,1,1); P(7,6,sM,1,1); // Specular metal highlights
      return;
    }

    if (kind === 'warp') {
      P(4,1,dark,4,10); P(2,3,dark,8,6); // Jagged base
      P(4,2,gem,4,8); P(3,4,gem,6,4); // Glowing body
      P(5,3,'#fff',2,6); P(4,5,'#fff',4,2); // Core energy pulse
      P(2,2,gem,1,1); P(9,9,gem,1,1); P(9,2,gem,1,1); // Floating particulates
      return;
    }

    if (kind === 'lockpicks') {
      P(1,5,dark,10,3); P(2,6,iron,8,1); // Main leather roll
      P(3,1,sM,1,5); P(3,1,sL,1,1); // Vertical pick 1 (hook)
      P(5,2,sD,1,4); P(5,2,sM,1,1); // Vertical pick 2 (rake)
      P(7,1,gM,1,5); // Tension tool (brass)
      P(2,6,dark,1,1); P(9,6,dark,1,1); // Stitching detail
      return;
    }

    if (kind === 'arrows') {
      P(5,0,woodD,1,11); P(6,1,wood,1,9); // Shaded dual-tone shaft
      P(4,0,sD,3,2); P(5,-1,sL,1,3); // Sharp Steel Broadhead
      P(4,9,red,3,3); P(5,10,pD,1,2); // Fletching feathers with spine
      return;
    }

   if (kind === 'spell') {
      // Wooden Spindles (Top and Bottom)
      P(2,1,woodD,8,2); P(2,9,woodD,8,2); // Dark wood base
      P(1,1,wood,1,2); P(10,1,wood,1,2);  // Left/Right spindle caps top
      P(1,9,wood,1,2); P(10,9,wood,1,2); // Left/Right spindle caps bottom
      
      // Parchment Body (Rolled Look)
      P(3,2,dark,6,8);         // Background silhouette
      P(3,3,'#fef3c7',6,6);    // Main paper surface
      P(3,3,'#f5e6ab',6,1);    // Top shadow under spindle
      P(3,8,'#d4c38d',6,1);    // Bottom shadow near roll
      
      // Detailed Ink and Seal
      P(4,5,dark,4,1); P(4,7,dark,3,1); // Runic scribbles
      P(7,6,red,2,2);          // Wax Seal
      P(8,6,'#f87171',1,1);    // Seal highlight
      
      // Lighting
      P(4,3,'#fff',1,1);       // Paper glint
      return;
    }

    if (kind === 'shield') {
      // Rounded Buckler Silhouette
      P(3,1,dark,6,10); P(2,2,dark,8,8); P(1,3,dark,10,6); 
      // Beveled Rim
      P(3,2,iron,6,8); P(2,3,iron,8,6);
      // Inner Face
      P(4,3,steel,4,6); P(3,4,steel,6,4);
      // Golden Center Boss (with highlight)
      P(5,5,gM,2,2); P(5,5,gL,1,1);
      // Rim Studs/Rivets
      P(3,3,sL,1,1); P(8,3,sL,1,1); P(3,8,sL,1,1); P(8,8,sL,1,1);
      return;
    }

    if (kind === 'trinket') {
      P(3,3,gD,6,6); P(4,4,gM,4,4); // Golden locket frame
      P(5,5,gem,2,2); P(5,5,'#fff',1,1); // Faceted gemstone center
      P(4,3,gL,3,1); P(3,4,gL,1,3); // Polished rim glint
      P(5,1,sM,2,2); // Silver chain loop
      return;
    }

  

  // Fallback Box
  P(2,3,wood,8,6);
  P(1,3,woodD,1,6); P(10,3,woodD,1,6);
  P(2,2,woodD,8,1); P(2,9,woodD,8,1);
}





// Tiny pixel stairs (12×12 grid) — rotated 180° so longest tread is at bottom
function drawStairsPixel(ctx, x, y, tile){
  // fill full tile background first (unchanged look)
  ctx.fillStyle = '#0b141d';
  ctx.fillRect(x, y, tile, tile);

  const { s, R } = gridN(ctx, x, y, tile, 12);
  const stone='#7c8a99', stoneHi='#a9b6c4', shadow='#0b141d';

  // background fill so it clearly occupies full tile
  R(0,0,12,12,'#0b141d');

  // treads (widest bottom, stepping up)
  R(1,9,10,1,stoneHi);
  R(1,7,8,1,stone);
  R(1,5,6,1,stoneHi);
  R(1,3,4,1,stone);
  R(1,1,2,1,stoneHi);

  // risers (right-side shadows)
  R(11,9,1,1,shadow);
  R(9,7,1,1,shadow);
  R(7,5,1,1,shadow);
  R(5,3,1,1,shadow);

  // bottom pit mouth
  R(9,10,2,1,shadow);
}

function drawCandlePixel(ctx, x, y, tile){
  const { s, R } = gridN(ctx, x, y, tile, 12);
  const wax   = '#f6f1d5';
  const wick  = '#3b2f2f';
  const flame = '#f9d65c';
  const glow  = '#ffef9a';
  const base  = '#6b3f1f';

  // base holder
  R(4,9,4,2,base);
  // wax
  R(5,6,2,3,wax);
  // wick
  R(6,5,1,1,wick);
  // flame core + glow
  R(6,4,1,1,flame);
  R(5,4,1,1,glow); R(7,4,1,1,glow);
}

// NEW: a "two candles" tile used by merchant/cartographer stands
function drawCandlesPixel(ctx, x, y, tile){
  const { R } = gridN(ctx, x, y, tile, 12);
  const wax   = '#f6f1d5';
  const wick  = '#3b2f2f';
  const flame = '#f9d65c';
  const glow  = '#ffef9a';
  const base  = '#6b3f1f';

  // subtle pooled light so the tile reads as "lit"
  ctx.save();
  ctx.globalAlpha = 0.18;
  R(1,8,10,4,glow);
  ctx.restore();

  // LEFT candle
  R(2,9,3,2,base);
  R(3,6,1,3,wax);
  R(3,5,1,1,wick);
  R(3,4,1,1,flame);
  R(2,4,1,1,glow); R(4,4,1,1,glow);

  // RIGHT candle
  R(7,9,3,2,base);
  R(8,6,1,3,wax);
  R(8,5,1,1,wick);
  R(8,4,1,1,flame);
  R(7,4,1,1,glow); R(9,4,1,1,glow);
}


function drawMerchantNpcPixel(ctx, x, y, tile){
  const { s, R } = gridN(ctx, x, y, tile, 12);
  const hood  = '#2a4466';
  const robe  = '#335a86';
  const trim  = '#6b3f1f';
  const face  = '#efd8b8';
  const hair  = '#3b2f2f';
  const eyes  = '#0b141d';
  const gold  = '#f2c94c';

  // boots
  R(4,10,2,1,trim); R(6,10,2,1,trim);

  // robe
  R(3,6,6,4,robe);
  R(3,8,6,1,hood);
  // belt / coin pouch
  R(3,8,1,1,trim); R(8,8,1,1,trim);
  R(6,8,1,1,gold);

  // arms
  R(2,7,1,2,robe);
  R(9,7,1,2,robe);

  // head + hood
  R(4,3,4,3,face);
  R(4,3,1,1,hair); R(7,3,1,1,hair);
  R(4,4,1,1,eyes); R(7,4,1,1,eyes);
  R(3,2,6,2,hood);
  R(3,4,1,1,hood); R(8,4,1,1,hood);
}

function drawAnvilPixel(ctx, x, y, tile){
  const { R } = gridN(ctx, x, y, tile, 12);
  const steel='#8a98a6', dark='#0b141d';
  R(2,8,8,1,steel);   // base
  R(3,7,6,1,steel);   // body
  R(4,6,4,1,steel);   // top
  R(8,5,2,1,steel);   // horn
  R(9,6,1,1,dark);    // horn shadow
}

// --- ADD: Blacksmith forge tile (12x12) ---
function drawForgePixel(ctx, x, y, tile){
  const { R } = gridN(ctx, x, y, tile, 12);
  const bg    = '#0b141d';
  const stone = '#374151';
  const stone2= '#4b5563';
  const iron  = '#9ca3af';
  const dark  = '#111827';
  const ember = '#ef4444';
  const glow1 = '#f97316';
  const glow2 = '#fbbf24';

  // background
  // R(0,0,12,12,bg);

  // forge body
  R(1,7,10,5,stone);
  R(2,8,8,3,stone2);

  // opening
  R(3,9,6,2,dark);

  // coals
  R(4,10,1,1,ember);
  R(5,10,1,1,glow1);
  R(6,10,1,1,glow2);
  R(7,10,1,1,glow1);

  // grate lip
  R(3,8,6,1,iron);

  // chimney
  R(5,1,2,6,stone2);
  R(5,0,2,1,stone);

  // tiny sparks
  R(4,2,1,1,glow2);
  R(7,3,1,1,glow1);
}

// --- ADD: Merchant table tile (12x12) ---
function drawTablePixel(ctx, x, y, tile){
  const { R } = gridN(ctx, x, y, tile, 12);
  const bg     = '#0b141d';
  const wood1  = '#6b3f1f';
  const wood2  = '#8b5a2b';
  const shadow = '#3b2f2f';
  const hi     = '#b0894e';
  const gold   = '#f2c94c';

  // background
  // R(0,0,12,12,bg);

  // tabletop + apron
  R(1,4,10,1,wood2);
  R(1,5,10,3,wood1);
  R(1,8,10,1,wood2);

  // simple depth
  R(1,6,10,1,shadow);
  R(2,5,8,1,hi);

  // legs
  R(2,9,2,3,wood2);
  R(8,9,2,3,wood2);

  // little coin pile
  R(5,6,2,1,gold);
  R(6,7,1,1,gold);
}

// --- ADD: 2-candle stand tile (matches your drawCandlesPixel calls) ---
function drawCandlesPixel(ctx, x, y, tile){
  const { R } = gridN(ctx, x, y, tile, 12);
  const bg    = '#0b141d';
  const cloth = '#152231';
  const wax   = '#f6f1d5';
  const wick  = '#3b2f2f';
  const flame = '#f9d65c';
  const glow  = '#ffef9a';
  const base  = '#6b3f1f';

  // R(0,0,12,12,bg);

  // little table/cloth patch so the candles read
  R(1,7,10,4,cloth);

  // left candle
  R(3,9,2,2,base);
  R(3,6,2,3,wax);
  R(4,5,1,1,wick);
  R(4,4,1,1,flame);
  R(3,4,1,1,glow); R(5,4,1,1,glow);

  // right candle
  R(7,9,2,2,base);
  R(7,6,2,3,wax);
  R(8,5,1,1,wick);
  R(8,4,1,1,flame);
  R(7,4,1,1,glow); R(9,4,1,1,glow);
}

function drawBlacksmithNpcPixel(ctx, x, y, tile){
  const { R } = gridN(ctx, x, y, tile, 12);
  const apron='#4b5563', shirt='#9ca3af', skin='#f3d7b6', hair='#3b2f2f', eye='#0b141d';
  R(4,10,2,1,apron); R(6,10,2,1,apron);         // boots
  R(3,6,6,4,apron);                              // apron
  R(4,3,4,3,skin); R(4,4,1,1,eye); R(7,4,1,1,eye); // head
  R(3,2,6,1,hair);
  R(2,7,1,2,shirt); R(9,7,1,2,shirt);           // arms
}


function drawJesterNpcPixel(ctx, x, y, tile) {
  const { s, R } = gridN(ctx, x, y, tile, 12);
  // Colors: 3-point hat (red, green, blue), two-tone tunic (purple, red), white face, black eyes
  const hatRed    = '#bd2220', hatGreen = '#22c55e', hatBlue  = '#2252be';
  const tunicPurple = '#5a2b9a', tunicRed = '#bd2220';
  const faceColor = '#ffffff', eyeColor = '#000000';
  const shoeColor = '#6e7378';
  // Hat: three points with bells (top row and second row)
  R(3, 0, 2, 1, hatRed);
  R(5, 0, 2, 1, hatGreen);
  R(7, 0, 2, 1, hatBlue);
  R(3, 1, 1, 1, hatRed);
  R(5, 1, 4, 1, hatGreen); // spans cols 5–8
  R(7, 1, 3, 1, hatBlue);
  // Face (white) and eyes
  R(4, 3, 4, 2, faceColor);
  R(5, 4, 1, 1, eyeColor);
  R(7, 4, 1, 1, eyeColor);
  // Tunic/body: left half purple, right half red, with arms
  R(3, 5, 3, 4, tunicPurple);
  R(6, 5, 3, 4, tunicRed);
  R(2, 5, 1, 3, tunicPurple); // left sleeve
  R(9, 5, 1, 3, tunicRed);    // right sleeve
  // Shoes (pointy)
  R(3, 9, 2, 1, shoeColor);
  R(7, 9, 2, 1, shoeColor);
}

// NEW: Cartographer pixel sprite (12x12)
function drawCartographerNpcPixel(ctx, x, y, tile){
  const { R } = gridN(ctx, x, y, tile, 12);
  const cloak = '#2f6b4f';
  const cloak2= '#24523c';
  const face  = '#efd8b8';
  const hair  = '#3b2f2f';
  const eyes  = '#0b141d';
  const belt  = '#6b3f1f';
  const paper = '#f6f1d5';
  const ink   = '#213a57';
  const boots = '#2b2b2b';

  // boots
  R(4,10,2,1,boots); R(6,10,2,1,boots);

  // cloak/body
  R(3,6,6,4,cloak);
  R(3,8,6,1,cloak2);

  // belt
  R(3,8,6,1,belt);

  // arms
  R(2,7,1,2,cloak);
  R(9,7,1,2,cloak);

  // head
  R(4,3,4,3,face);
  R(4,3,1,1,hair); R(7,3,1,1,hair);
  R(4,4,1,1,eyes); R(7,4,1,1,eyes);

  // scroll/map in hands
  R(5,7,3,2,paper);
  R(5,7,3,1,ink); // top ink line
  R(5,8,1,1,ink); R(7,8,1,1,ink); // dots
}

function drawJesterWheelPixel(ctx, x, y, tile) {

  const { s, R } = gridN(ctx, x, y, tile, 12);
  const red = '#bd2220', green = '#22c55e';
  // Draw a 10-slice wheel pattern (alternating red/green) on a 12×12 grid.
  // Row 0
  R(3, 0, 3, 1, red);
  R(6, 0, 2, 1, green);
  // Row 1
  R(2, 1, 4, 1, red);
  R(6, 1, 2, 1, green);
  R(8, 1, 2, 1, red);
  // Row 2
  R(1, 2, 2, 1, green);
  R(3, 2, 3, 1, red);
  R(6, 2, 1, 1, green);
  R(7, 2, 3, 1, red);
  // Row 3
  R(0, 3, 4, 1, green);
  R(4, 3, 2, 1, red);
  R(6, 3, 1, 1, green);
  R(7, 3, 3, 1, red);
  R(10,3, 1, 1, green);
  // Row 4
  R(0, 4, 3, 1, red);
  R(3, 4, 1, 1, green);
  R(4, 4, 4, 1, red);
  R(8, 4, 3, 1, green);
  // Row 5
  R(0, 5, 8, 1, red);
  R(8, 5, 3, 1, green);
  // Row 6
  R(0, 6, 3, 1, red);
  R(3, 6, 2, 1, green);
  R(5, 6, 1, 1, red);
  R(6, 6, 1, 1, green);
  R(7, 6, 1, 1, red);
  R(8, 6, 3, 1, green);
  // Row 7
  R(0, 7, 1, 1, red);
  R(1, 7, 3, 1, green);
  R(4, 7, 2, 1, red);
  R(6, 7, 1, 1, green);
  R(7, 7, 4, 1, red);
  // Row 8
  R(1, 8, 3, 1, green);
  R(4, 8, 2, 1, red);
  R(6, 8, 2, 1, green);
  R(8, 8, 2, 1, red);
  // Row 9
  R(2, 9, 1, 1, green);
  R(3, 9, 3, 1, red);
  R(6, 9, 3, 1, green);
  // Row 10
  R(3,10, 3, 1, red);
  R(6,10, 2, 1, green);
  // (Row 11 left blank)
}

// --- NEW: Biome & Trap Visuals ---
function getBiomePalette(floor) {
  // Define the Biome Cycle (Order matters)
  const BIOMES = [
    { name: 'Sewers',          wall:'#061018', floor:'#152231', top:'#111c26' }, // 1-10
    { name: 'Crypt',           wall:'#1a1a24', floor:'#2a2a35', top:'#252530' }, // 11-20
    { name: 'Magma Caverns',   wall:'#261010', floor:'#3d1c1c', top:'#331515' }, // 21-30
    { name: 'Overgrown Ruins', wall:'#0f291e', floor:'#1b3b2b', top:'#163024' }, // 31-40 (New: Green/Jungle)
    { name: 'The Void',        wall:'#000000', floor:'#1a0b2e', top:'#0d001a' }, // 41-50 (New: Deep Purple/Space)
    { name: 'Gilded Halls',    wall:'#2e2616', floor:'#423825', top:'#594d33' }  // 51-60 (New: Gold/Brown)
  ];

  // Calculate index based on floor (1-10 = 0, 11-20 = 1, etc.)
  // The % BIOMES.length ensures it loops forever (Endless safe)
  const cycleIndex = Math.floor((floor - 1) / 10) % BIOMES.length;
  
  return BIOMES[cycleIndex];
}

function drawSpikePixel(ctx, x, y, tile, state='up'){
  const { R } = gridN(ctx, x, y, tile, 12);
  const plate = '#334155', dark = '#1e293b', holes = '#020617';
  const steel = '#94a3b8', shine = '#e2e8f0';
  const blood = '#991b1b', fresh = '#ef4444';

  // 1. Base Plate (Heavy Iron Frame)
  R(1,1,10,10, dark); // Shadow/Recess
  R(1,1,1,1,'#64748b'); R(10,1,1,1,'#64748b'); // Bolts
  R(1,10,1,1,'#64748b'); R(10,10,1,1,'#64748b');

  // 2. The Mechanics (5-point pattern)
  const pts = [
    {x:3, y:3}, {x:8, y:3},
    {x:5, y:6},
    {x:3, y:8}, {x:8, y:8}
  ];

  if (state === 'down') {
    // --- SAFE STATE: Retracted Holes ---
    R(2,2,8,8, plate); // Plate cover
    pts.forEach(p => {
      R(p.x, p.y, 2, 2, holes);    // The pit
      R(p.x, p.y+1, 2, 1, '#000'); // Deep shadow
    });
  } else {
    // --- DANGER STATE: Extended Spikes ---
    R(2,2,8,8, plate); 
    pts.forEach((p, i) => {
      // Base collar
      R(p.x, p.y+1, 2, 1, dark);
      // Spike Shaft
      R(p.x, p.y-1, 2, 3, steel);
      R(p.x, p.y-1, 1, 3, shine); // Highlight left edge
      // Sharp Tip
      R(p.x, p.y-3, 2, 2, steel); // Taper
      R(p.x, p.y-4, 1, 1, shine); // Point
      
      // Blood Tips (on center and corners)
      if(i%2===0) {
         R(p.x, p.y-3, 2, 2, blood); 
         R(p.x, p.y-4, 1, 1, fresh);
      }
    });
  }
}



// Helper: Line of Sight (Blocks vision through Walls/Closed Doors)
function checkLOS(x0, y0, x1, y1) {
  let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  let sx = (x0 < x1) ? 1 : -1, sy = (y0 < y1) ? 1 : -1;
  let err = dx - dy;

  while (true) {
    if (x0 === x1 && y0 === y1) return true; // Reached target
    
    // Check if current tile blocks vision (Wall=0, Door=2)
    // We start check AFTER the first step so we don't block ourselves
    const t = state.tiles[y0][x0];
    if (t === 0 || t === 2) {
       // If we hit a wall/door, we can't see PAST it.
       return false; 
    }

    let e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
}

function draw(){
  setupCanvas();
  const w = canvas.width/(window.devicePixelRatio||1), h = canvas.height/(window.devicePixelRatio||1);
  const tile = 35;
  const viewW = Math.floor(w/tile), viewH = Math.floor(h/tile);

  // --- NEW: Smooth Movement Math ---
  // 1. Init if missing (legacy save safety)
  if (state.player.rx === undefined) { state.player.rx = state.player.x; state.player.ry = state.player.y; }

  
  // 2. Player Sprite Interpolation (Smooth, consistent speed)
    const lerp = 0.25;
    let sx = (state.player.x - state.player.rx) * lerp;
    let sy = (state.player.y - state.player.ry) * lerp;

    // Reduced slide speed so it doesn't move too fast on ice
    if (sx > 0.35) sx = 0.35;
    if (sx < -0.35) sx = -0.35;
    if (sy > 0.35) sy = 0.35;
    if (sy < -0.35) sy = -0.35;
    
    state.player.rx += sx;
    state.player.ry += sy;

    if (Math.abs(state.player.x - state.player.rx) < 0.01) state.player.rx = state.player.x;
    if (Math.abs(state.player.y - state.player.ry) < 0.01) state.player.ry = state.player.y;

    // --------------------------------
    // Camera centered on the visual interpolated position so it pans smoothly
    const ox = Math.round(state.player.rx) - Math.floor(viewW/2);
    const oy = Math.round(state.player.ry) - Math.floor(viewH/2);
  const rad = state.player.tempVisionRange || state.fovRadius;

  const bossesToDraw = []; // {sym, px, py}
  const fogRects = [];     // {px, py}
  
  // --- NEW: Fetch Palette ---
  const pal = getBiomePalette(state.floor); 

  for (let y=-1; y+oy<state.size.h && y<viewH+1; y++){
    for (let x=-1; x+ox<state.size.w && x<viewW+1; x++){
      const gx=ox+x, gy=oy+y;
      const px=x*tile, py=y*tile;

      ctx.fillStyle='#0b141d'; // Void color
      ctx.fillRect(px,py,tile,tile);
      if(!inBounds(gx,gy)) continue;

      const d = Math.abs(gx-state.player.x)+Math.abs(gy-state.player.y);
      // FIX: Vision requires distance AND clear line of sight
      const vis = d<=rad && (state._inPuzzleRoom || checkLOS(state.player.x, state.player.y, gx, gy));

      const kxy = key(gx,gy);
      if (vis) state.seen.add(kxy);
      const seen = state.seen.has(kxy);

      if (!seen){ ctx.fillStyle='#081018'; ctx.fillRect(px,py,tile,tile); fogRects.push({px,py}); continue; }

      const t = state.tiles[gy][gx];

      // base floor
      if (t===0){ 
        // --- NEW: Dynamic Wall Colors ---
        ctx.fillStyle = pal.wall; 
        ctx.fillRect(px,py,tile,tile); 
        
        ctx.fillStyle = pal.top; 
        ctx.fillRect(px, py, tile, tile - 10); 
        
        fogRects.push({px,py}); 
        continue; 
      }
      
     // --- NEW: Dynamic Floor Color ---
      ctx.fillStyle = pal.floor;
      ctx.fillRect(px,py,tile,tile);

      // props
      // --- NEW: Render Scenery (Tile 8) ---
      if (t===8) {
        if (state.props && state.props[kxy]) {
          drawPropPixel(ctx, state.props[kxy].type, px, py, tile);
        }
      }
      // ------------------------------------
      // --- NEW: Render Spikes (Tile 7) ---
          if (t===7) {
            drawSpikePixel(ctx, px, py, tile, 'up'); // Always active
          }
          // --- NEW: Timed Spikes (Tile 9) ---
          if (t===9){
            // Active if (turn / 3) is odd
            const isActive = Math.floor((state.gameTurn||0) / 3) % 2 !== 0;
            // Pass 'up' or 'down' to show correct mechanical state
            drawSpikePixel(ctx, px, py, tile, isActive ? 'up' : 'down');
          }
      // -----------------------------------
      
if (t===2){
        const locked = state.lockedDoors?.has(kxy);
        if (state.puzzleDoors?.has(kxy)) {
            ctx.save();
            ctx.filter = 'hue-rotate(200deg) saturate(1.5)';
            drawDoorPixel(ctx, px, py, tile, !!locked);
            ctx.restore();
        } else {
            drawDoorPixel(ctx, px, py, tile, !!locked);
        }
      } else if (t===3){
        // Check if this specific chest is a Red Challenge Chest
        if (state.redChests && state.redChests.has(kxy)) {
          drawRedChestPixel(ctx, px, py, tile);
        } else {
          drawChestPixel(ctx, px, py, tile);
        }
      } else if (t===13 || t===14) {
          // Highly Detailed Ice Base
          ctx.fillStyle='#0ea5e9'; ctx.fillRect(px, py, tile, tile); // Base deep blue
          ctx.fillStyle='#38bdf8'; ctx.fillRect(px+2, py+2, tile-4, tile-4); // Mid ice layer
          ctx.fillStyle='#7dd3fc'; ctx.fillRect(px+4, py+4, tile-8, tile-8); // Light inner freeze
          ctx.fillStyle='#e0f2fe'; ctx.fillRect(px+6, py+6, tile-12, 4); // Bright surface reflection
          ctx.fillStyle='#bae6fd'; ctx.fillRect(px+tile-8, py+tile-8, 4, 4); // Secondary glint
          
          if (t===14) {
              // Intricate Cracks for Fragile Ice
              ctx.strokeStyle='#0284c7'; ctx.lineWidth=2; 
              ctx.beginPath(); 
              ctx.moveTo(px+4, py+4); ctx.lineTo(px+12, py+14); ctx.lineTo(px+8, py+22);
              ctx.moveTo(px+12, py+14); ctx.lineTo(px+24, py+10); ctx.lineTo(px+28, py+18);
              ctx.moveTo(px+16, py+24); ctx.lineTo(px+22, py+16);
              ctx.stroke();
              // White frost highlights on crack edges
              ctx.strokeStyle='#f0f9ff'; ctx.lineWidth=1;
              ctx.beginPath();
              ctx.moveTo(px+5, py+5); ctx.lineTo(px+11, py+13);
              ctx.moveTo(px+13, py+15); ctx.lineTo(px+23, py+11);
              ctx.stroke();
          }
        } else if (t===15 || t===18) {
          // Highly Detailed Abyss / Pit
          ctx.fillStyle='#0f172a'; ctx.fillRect(px, py, tile, tile); // Base dark edge
          ctx.fillStyle='#020617'; ctx.fillRect(px+2, py+4, tile-4, tile-4); // Deep void
          // Fading rocky edges falling into the pit
          ctx.fillStyle='#1e293b'; 
          ctx.fillRect(px+2, py+2, 8, 4); ctx.fillRect(px+18, py+2, 10, 3);
          ctx.fillRect(px+4, py+6, 4, 4); ctx.fillRect(px+22, py+5, 4, 3);
        } else if (t===16) {
          // Highly Detailed Pressure Plate (Empty)
          ctx.fillStyle='#334155'; ctx.fillRect(px+2, py+2, tile-4, tile-4); // Outer rim shadow
          ctx.fillStyle='#475569'; ctx.fillRect(px+2, py+2, tile-4, 2); // Rim highlight top
          ctx.fillStyle='#475569'; ctx.fillRect(px+2, py+2, 2, tile-4); // Rim highlight left
          ctx.fillStyle='#1e293b'; ctx.fillRect(px+4, py+4, tile-8, tile-8); // Inner depression
          ctx.fillStyle='#94a3b8'; ctx.fillRect(px+6, py+6, tile-12, tile-12); // The unpressed plate
          ctx.fillStyle='#cbd5e1'; ctx.fillRect(px+6, py+6, tile-12, 2); // Plate highlight
          ctx.fillStyle='#0f172a'; ctx.fillRect(px+(tile/2)-2, py+(tile/2)-2, 4, 4); // Center rune
        } else if (t===17) {
          ctx.fillStyle='#78350f'; ctx.fillRect(px, py, tile, tile); // Raised Bridge
          ctx.fillStyle='#451a03'; ctx.fillRect(px, py+4, tile, 2);
        } else if (t===8 && state.props[kxy]?.type === 'puzzle_portal_dead') {
          // Dead Gateway Sprite
          ctx.fillStyle = '#1e293b'; 
          ctx.beginPath(); ctx.arc(px+tile/2, py+tile/2 + 2, tile/2-2, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#334155'; 
          ctx.beginPath(); ctx.arc(px+tile/2, py+tile/2, tile/2-4, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#475569'; 
          ctx.beginPath(); ctx.arc(px+tile/2, py+tile/2, tile/4, 0, Math.PI*2); ctx.fill();
        } else if (t===8 && state.props[kxy]?.type === 'puzzle_portal_dead') {
          // Dead Gateway Sprite
          ctx.fillStyle = '#1e293b'; 
          ctx.beginPath(); ctx.arc(px+tile/2, py+tile/2 + 2, tile/2-2, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#334155'; 
          ctx.beginPath(); ctx.arc(px+tile/2, py+tile/2, tile/2-4, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#475569'; 
          ctx.beginPath(); ctx.arc(px+tile/2, py+tile/2, tile/4, 0, Math.PI*2); ctx.fill();
        } else if (t===8 && (state.props[kxy]?.type === 'puzzle_portal' || state.props[kxy]?.type === 'puzzle_exit')) {
          // Ethereal Gateway Sprite
          ctx.fillStyle = '#3b0764'; // Deep purple outer shadow
          ctx.beginPath(); ctx.arc(px+tile/2, py+tile/2 + 2, tile/2-2, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#7e22ce'; // Bright purple mid
          ctx.beginPath(); ctx.arc(px+tile/2, py+tile/2, tile/2-4, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#d8b4fe'; // Glowing center core
          ctx.beginPath(); ctx.arc(px+tile/2, py+tile/2, tile/4, 0, Math.PI*2); ctx.fill();
        } else if (t===8 && state.props[kxy]?.type === 'boulder') {
          // If on a plate, draw the pressed plate underneath
          if (state.props[kxy].underTile === 16) {
              ctx.fillStyle='#334155'; ctx.fillRect(px+2, py+2, tile-4, tile-4); // Rim
              ctx.fillStyle='#0f172a'; ctx.fillRect(px+4, py+4, tile-8, tile-8); // Inner depression
              ctx.fillStyle='#64748b'; ctx.fillRect(px+6, py+8, tile-12, tile-12-2); // Pressed plate (lower)
              ctx.fillStyle='#38bdf8'; ctx.fillRect(px+(tile/2)-2, py+(tile/2)-2 + 2, 4, 4); // Glowing center rune!
          }
          // Highly Detailed Boulder
          ctx.fillStyle='#27272a'; ctx.beginPath(); ctx.arc(px+tile/2, py+tile/2 + 2, tile/2 - 2, 0, Math.PI*2); ctx.fill(); // Drop shadow
          
          ctx.fillStyle='#52525b'; ctx.fillRect(px+4, py+4, tile-8, tile-8); // Base rock
          ctx.fillStyle='#71717a'; ctx.fillRect(px+6, py+4, tile-12, tile-10); // Mid tone
          ctx.fillStyle='#a1a1aa'; ctx.fillRect(px+8, py+4, tile-16, 4); // Top highlight
          
          // Chipping / Texture
          ctx.fillStyle='#3f3f46'; ctx.fillRect(px+4, py+tile-8, tile-8, 4); // Bottom shadow
          ctx.fillStyle='#27272a'; ctx.fillRect(px+6, py+tile-6, tile-12, 2); // Deep bottom shadow
          
          // Cracks and craters
          ctx.fillStyle='#3f3f46'; 
          ctx.fillRect(px+8, py+8, 2, 2); // crater 1
          ctx.fillRect(px+16, py+12, 4, 2); // crater 2
          ctx.fillRect(px+10, py+16, 2, 4); // crack
          ctx.fillRect(px+12, py+18, 2, 2); // crack end
        } else if (t===8 && state.props[kxy]?.type.includes('lever')) {
          ctx.fillStyle='#333'; ctx.fillRect(px+tile/2-4, py+tile/2-4, 8, 8); // Lever Base
          ctx.fillStyle=(state.props[kxy].type === 'lever_locked') ? '#ef4444' : '#22c55e';
          ctx.fillRect(px+tile/2-2, py+4, 4, tile/2); // Stick
        } else if (t===4){
          drawStairsPixel(ctx, px, py, tile);
        } else if (t===10){
          // Cursed Stairs: Red tint
        ctx.save();
        ctx.filter = 'sepia(1) saturate(5) hue-rotate(-50deg) contrast(1.2)';
        drawStairsPixel(ctx, px, py, tile);
        ctx.restore();
      } else if (t===5){
  const it = state.pickups[kxy];
  if (it){ + drawPickupPixel(ctx, it, px, py, tile); }
} else if (t===6){
             // --- NEW: Mystical Shrine (Levitating Crystal Altar) ---
             const { R } = gridN(ctx, px, py, tile, 12);
             const stone = '#475569', dark = '#1e293b', lit = '#94a3b8';
             const rune = '#c084fc'; // Purple/Pink mystic energy

             // 1. Stone Pedestal (Tiered)
             R(1,10,10,2,dark);    // Bottom Foundation
             R(2,8,8,3,stone);     // Main Plinth
             R(2,8,1,3,dark);      // Side Shadow (Left)
             R(9,8,1,3,lit);       // Side Highlight (Right)
             R(3,7,6,1,lit);       // Pedestal Top Surface
             
             // 2. Floating Shadow (Cast by the crystal)
             R(4,7,4,1,'#0f172a'); 

             // 3. Levitating Artifact (Glowing Crystal)
             ctx.save();
             ctx.shadowColor = rune; 
             ctx.shadowBlur = 15;  // Strong magical glow
             
             // The Crystal Shape
             R(5,2,2,5,rune);      // Vertical Core
             R(4,3,4,3,rune);      // Horizontal Body
             R(5,3,2,3,'#fff');    // Bright Inner Light
             
             ctx.shadowBlur = 0;
             ctx.restore();

             // 4. Orbiting Particles
             R(3,4,1,1,'#e9d5ff'); // Left mote
             R(8,2,1,1,'#e9d5ff'); // Right mote
          }
// --- NEW: Draw Gold Well (2x2) ---
    if (state.goldWell) {
       const gw = state.goldWell;
       // FIX: Draw when at the BOTTOM-RIGHT tile so we render ON TOP of the floor
       if (gx === gw.x + 1 && gy === gw.y + 1) {
          const s = tile; // base size
          // Draw 2x2 Well (Calculate Top-Left relative to current Bottom-Right)
          const wx = (gw.x - ox) * tile;
          const wy = (gw.y - oy) * tile;
          
          const water = gw.used ? '#374151' : '#facc15'; // Gold if unused, Grey if used
          
          // Advanced Well Art (2x2)
          const { R } = gridN(ctx, wx, wy, s*2, 24); // 24x24 pixel grid spread over 2 tiles
          
          // 1. Base Platform (Stone steps)
          R(1, 1, 22, 22, '#1f2937'); // Dark shadow/base
          R(2, 2, 20, 20, '#374151'); // Stone Step 1
          
          // 2. The Well Wall (Marble/White Stone)
          R(4, 4, 16, 16, '#9ca3af'); // Outer wall
          R(5, 5, 14, 14, '#e5e7eb'); // Inner rim highlight
          R(5, 5, 14, 1,  '#f3f4f6'); // Top lip highlight

          // 3. The Liquid (Gold or Empty)
          if (gw.used) {
             R(6, 6, 12, 12, '#111827'); // Empty/Dark
          } else {
             R(6, 6, 12, 12, '#eab308'); // Gold Base
             R(7, 7, 10, 10, '#facc15'); // Gold Shine
             
             // Dynamic Sparkles inside liquid
             const tick = Math.floor(Date.now() / 300);
             if (tick % 3 === 0) R(8, 8, 2, 2, '#fff');
             if (tick % 3 === 1) R(13, 10, 2, 2, '#fff');
             if (tick % 3 === 2) R(10, 13, 2, 2, '#fff');
          }

          // 4. Roof Structure (Wooden supports & Roof)
          // Pillars
          R(3, 8, 2, 12, '#5c4033'); // Left Pillar
          R(19, 8, 2, 12, '#5c4033'); // Right Pillar
          
          // Roof (Triangle ish)
          R(2, 6, 20, 2, '#78350f'); // Base beam
          R(3, 4, 18, 2, '#92400e'); // Roof mid
          R(5, 2, 14, 2, '#b45309'); // Roof top
          R(11, 0, 2, 2, '#fcd34d'); // Gold finial on top

          // 5. Aura (if active)
          if (!gw.used) {
             ctx.save();
             ctx.shadowColor = '#facc15'; ctx.shadowBlur = 20;
             ctx.fillStyle = 'rgba(250, 204, 21, 0.15)';
             ctx.fillRect(wx, wy, s*2, s*2);
             ctx.restore();
          }
       }
    }

// Merchant / Blacksmith NPC stands
    if (state.merchant){
      if (gx===state.merchant.left.x && gy===state.merchant.left.y){
        drawCandlesPixel(ctx, px, py, tile);
      } else if (gx===state.merchant.x && gy===state.merchant.y){
        drawMerchantNpcPixel(ctx, px, py, tile);
      } else if (gx===state.merchant.right.x && gy===state.merchant.right.y){
        drawTablePixel(ctx, px, py, tile);
      }
    }
    if (state.blacksmith){
      if (gx===state.blacksmith.left.x && gy===state.blacksmith.left.y){
        drawAnvilPixel(ctx, px, py, tile);
      } else if (gx===state.blacksmith.x && gy===state.blacksmith.y){
        drawBlacksmithNpcPixel(ctx, px, py, tile);
      } else if (gx===state.blacksmith.right.x && gy===state.blacksmith.right.y){
        drawForgePixel(ctx, px, py, tile);
      }
    }
    // Cartographer NPC stand
    if (state.cartographer){
      if (gx===state.cartographer.left.x && gy===state.cartographer.left.y){
        // tiny map table or candle reused
        drawCandlesPixel(ctx, px, py, tile);
      } else if (gx===state.cartographer.x && gy===state.cartographer.y){
        drawCartographerNpcPixel(ctx, px, py, tile);
      } else if (gx===state.cartographer.right.x && gy===state.cartographer.right.y){
        drawCandlesPixel(ctx, px, py, tile);
      }
    }

// After fix (only draw on right side of the jester)
if (state.jester) {
    if (gx === state.jester.x && gy === state.jester.y) {
        drawJesterNpcPixel(ctx, px, py, tile);
    } else if (gx === state.jester.right.x && gy === state.jester.right.y) {
        drawJesterWheelPixel(ctx, px, py, tile);
    }
}



      
// --- NEW: Draw Volatile Aether Bombs ---
if (state.explosions) {
  for (const bomb of state.explosions) {
    if (!state.seen.has(key(bomb.x, bomb.y))) continue;
    
    // Draw pulsing red zone
    const sx = (bomb.x - ox) * tile;
    const sy = (bomb.y - oy) * tile;
    
    ctx.fillStyle = `rgba(255, 69, 0, ${0.3 + (Math.sin(Date.now() / 100) * 0.1)})`;
    ctx.fillRect(sx, sy, tile, tile);
    
    // Draw Text Timer
    ctx.font = "bold 16px monospace";
    ctx.fillStyle = '#fff';
    ctx.textAlign = "center";
    ctx.fillText(bomb.timer, sx + tile/2, sy + tile/2 + 5);
  }
}
// ---------------------------------------

// enemies (collect bosses for later, now pixel-based)
for (const e of state.enemies){
  const s = e.size || 1;
  
  // Handle flash expiration
  if (e._flashTime && Date.now() > e._flashTime) {
    e._flashTime = 0; e._flashColor = null;
  }

  if (s === 1){
    // FIX: Only draw enemy if tile is currently visible (vis)
    if (e.x === gx && e.y === gy && vis) {
        drawEnemyPixel(ctx, e, px, py, tile); 
        
        // --- NEW: Warlord Label ---
        if (e.miniBoss) {
            ctx.fillStyle = '#ef4444';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText("MINI", px + tile/2, py + tile - 2);
        }
        // --------------------------
    }
  } else {
    if (gx === e.x && gy === e.y) bossesToDraw.push({ enemy: e, px, py }); // keep the whole enemy
  }
}



      if (!vis) fogRects.push({px,py});
    }
  }

  // draw stretched bosses AFTER tiles (2× footprint)
  for (const b of bossesToDraw){
    drawEnemyPixel(ctx, b.enemy, b.px, b.py, tile*2); // pass enemy object
  }

  // projectiles (magic bolts / arrows) on top of tiles, under player
  if (Array.isArray(state.projectiles) && state.projectiles.length){
    for (const proj of state.projectiles){
      // interpolate world → screen position
      const gx = proj.fromX + (proj.toX - proj.fromX) * proj.t;
      const gy = proj.fromY + (proj.toY - proj.fromY) * proj.t;
      const sx = (gx - ox) * tile;
      const sy = (gy - oy) * tile;

      // only draw if on-screen
      if (sx + tile < 0 || sy + tile < 0 || sx > w || sy > h) continue;
      drawProjectilePixel(ctx, proj, sx, sy, tile);
    }
  }

// player on top (pixel helmet) - USE SMOOTH COORDS (rx/ry)
const ppx = (state.player.rx-ox)*tile, ppy = (state.player.ry-oy)*tile;

// --- NEW: Draw Aura ---
if (state.player.blessTicks > 0) {
  ctx.save();
  // Pulsing gold glow
  ctx.globalAlpha = 0.3 + (Math.sin(Date.now() / 200) * 0.1); 
  ctx.fillStyle = '#fbbf24'; 
  ctx.beginPath();
  ctx.arc(ppx + tile/2, ppy + tile/2, tile * 0.75, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
// ----------------------

drawPlayerHelmet(ctx, ppx, ppy, tile, state.player.facing || 'down');

// --- NEW: Draw Cleric NPC ---
if (state.cleric) {
  const cx = (state.cleric.x - ox) * tile;
  const cy = (state.cleric.y - oy) * tile;
  if (state.seen.has(key(state.cleric.x, state.cleric.y))) {
     // High Priestess Sprite (Complex)
     const { R } = gridN(ctx, cx, cy, tile, 12);
     // Palette: White/Blue/Gold/Silver for high detail
     const robeWhite = '#f8fafc';
     const robeBlue = '#94a3b8';
     const face = '#ffe4c4';
     const gold = '#fbbf24';
     const silver = '#d1d5db';
     const shadow = '#0b141d';

     // Hood and Head (Lots of layers)
     R(3, 1, 6, 3, robeBlue);   // Hood base
     R(4, 2, 4, 2, face);       // Face peeking
     R(3, 2, 6, 1, shadow);     // Inner hood shadow
     R(4, 3, 1, 1, shadow); R(7, 3, 1, 1, shadow); // Eyes

     // Body and White Robe
     R(2, 4, 8, 8, robeWhite);  // Main white robe base
     R(3, 5, 6, 6, robeBlue);   // Inner blue layer for depth

     // Vestment and Trim (Gold/Silver)
     R(4, 4, 4, 1, gold);       // Top gold trim
     R(5, 5, 2, 6, silver);     // Vertical silver vestment
     R(4, 7, 4, 1, silver);     // Horizontal silver trim
     
     // Heavy Shadows (gives 3D effect)
     R(2, 10, 1, 2, shadow); R(9, 10, 1, 2, shadow); // Feet/Bottom corners

     // Staff (Silver Scepter with Gold Finial)
     R(10, 1, 1, 11, silver);   // Silver staff shaft
     R(10, 0, 1, 2, gold);      // Gold cap
     
     // Magic Aura (Subtle, Pulsing)
     ctx.save();
     const tick = Math.floor(Date.now() / 200) % 2;
     ctx.globalAlpha = 0.5;
     if (tick === 0) R(1, 5, 1, 1, '#6ec5ff'); // Blue aura left
     else R(1, 6, 1, 1, '#6ec5ff'); 
     ctx.restore();
  }
}
// ----------------------------

// NEW: cartographer arrow overlay (points to stairs)
drawCartographerStairsArrow(ctx, ox, oy, tile);



updateMerchantAudio();
if (merchantAudio && merchantAudio.muted && audioCtx && audioCtx.state === 'running') merchantAudio.muted = false;

updateBlacksmithAudio();
if (blacksmithAudio && blacksmithAudio.muted && audioCtx && audioCtx.state === 'running') blacksmithAudio.muted = false;

updateJesterAudio();
if (jesterAudio && jesterAudio.muted && audioCtx && audioCtx.state === 'running') jesterAudio.muted = false;

updateCartographerAudio();
if (cartographerAudio && cartographerAudio.muted && audioCtx && audioCtx.state === 'running') cartographerAudio.muted = false;

// --- FIX: Add Cleric Here ---
updateClericAudio();
if (clericAudio && clericAudio.muted && audioCtx && audioCtx.state === 'running') clericAudio.muted = false;
// ----------------------------


  // fog last so it still darkens bosses & player outside FOV
  if (!state.noFog && !state.cartographerMapActive) {
    ctx.fillStyle='rgba(0,0,0,0.55)';
    for (const f of fogRects) ctx.fillRect(f.px, f.py, tile, tile);
  }


  updateBossHud();

  // --- NEW: Miasma Chamber green screen tint ---
  if (state.floorEffect === 'MiasmaChamber' && !state.gameOver) {
    ctx.fillStyle = 'rgba(0, 80, 0, 0.22)';
    ctx.fillRect(0, 0, w, h);
  }
  // --- END: Miasma tint ---

  if (state.player.hp / state.player.hpMax <= 0.30 && !state.gameOver) {
    const grad = ctx.createRadialGradient(
      w/2, h/2, 40,
      w/2, h/2, Math.max(w,h)/1.2
    );
    grad.addColorStop(0, 'rgba(140,0,0,0)');
    grad.addColorStop(1, 'rgba(140,0,0,0.62)');
ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  // --- NEW: Enemy Intent Icons ---
  ctx.font = "bold 16px sans-serif";
  ctx.textAlign = "center";
  for (const e of state.enemies) {
    // Only show intent if we can see the enemy
    const kxy = key(e.x, e.y);
    if (!state.seen.has(kxy)) continue;
    
    // Convert logic coords to screen coords (same math as main loop)
    const sx = (e.x - ox) * tile + tile/2;
    const sy = (e.y - oy) * tile - 10; // Floating above head

    if (e.charging) {
      ctx.fillStyle = '#ff0000';
      ctx.fillText("⚠️", sx, sy); // Telegraphed Attack Warning
    } else if (e.stunTicks > 0) {
      ctx.fillText("💫", sx, sy); // Stunned
    } else if (e.sleep) {
      ctx.fillText("💤", sx, sy); // Asleep
    }
  }

  

  // --- Particle Rendering (Optimized) ---
  let activeEffects = false;

  if (state.particles && state.particles.length > 0) {
    activeEffects = true;
    state.particles = state.particles.filter(p => p.life > 0);
    state.particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      
      const sx = (p.x - ox) * tile + tile/2;
      const sy = (p.y - oy) * tile + tile/2;
      
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life < 20 ? p.life / 20 : 1.0;
      ctx.fillRect(sx, sy, p.size, p.size);
      ctx.globalAlpha = 1.0;
    });
  }

  // --- Floating Text (Time-Based & Optimized) ---
// --- Floating Text (Highly Optimized) ---
  if (state.floatingText && state.floatingText.length > 0) {
    activeEffects = true;
    const now = Date.now();
    ctx.font = "bold 14px monospace";
    ctx.textAlign = "center";
    
    // Filter expired
    state.floatingText = state.floatingText.filter(ft => now < ft.start + ft.duration);
    
    state.floatingText.forEach(ft => {
      const elapsed = now - ft.start;
      const pct = elapsed / ft.duration;
      
      const rise = pct * 30; 
      
      // OPTIMIZATION: Math.floor coords prevents sub-pixel rendering lag
      const sx = Math.floor((ft.x - ox) * tile + tile/2);
      const sy = Math.floor((ft.y - oy) * tile - rise); 
      
      // Fade out logic
      if (pct > 0.8) ctx.globalAlpha = 1 - (pct - 0.8) * 5;
      
      // OPTIMIZATION: Removed the black shadow text draw. 
      // It doubles the render cost. If visibility is an issue, 
      // use a darker background color or just keep it simple.
      
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, sx, sy);
      
      ctx.globalAlpha = 1.0;
    });
  }

// --- REAPER OVERRIDE: Always draw (Glowing) on top of fog ---
  const _reaper = state.enemies.find(e => e.type === 'Reaper');
  if (_reaper) {
      const _rx = (_reaper.x - ox) * tile;
      const _ry = (_reaper.y - oy) * tile;
      // Draw if on screen
      if (_rx > -tile*2 && _rx < canvas.width && _ry > -tile*2 && _ry < canvas.height) {
          ctx.save();
          ctx.shadowColor = '#ef4444'; // Red glow
          ctx.shadowBlur = 20;         // Strong glow radius
          // Use the standard enemy drawer (which calls drawReaperPixel)
          if (typeof drawEnemyPixel === 'function') drawEnemyPixel(ctx, _reaper, _rx, _ry, tile);
          ctx.restore();
      }
  }


  // Smart Loop: Run if effects active OR player is still sliding
  const isMoving = (Math.abs(state.player.x - state.player.rx) > 0.01 || Math.abs(state.player.y - state.player.ry) > 0.01);
  state._animating = activeEffects || isMoving;
  if (state._animating) {
    requestAnimationFrame(draw);
  }
}




function updateBars(){
  // --- FIX: Purifier (Status Immunity) ---
  if (state.skills?.survivability?.perks?.['sur_b2']) {
      state.player.poisoned = false;
      state.player.poisonTicks = 0;
  }
  // -----------------------------------------
  
  // --- FIX: Ensure Max Stats include Perks (Fixes save/load bug) ---
  if (!state._maxStatsRecalculated) {
        state._maxStatsRecalculated = true;
        
        // Base stats derived from level
        let expectedHpMax = 20 + ((state.player.level - 1) * 2); // Assuming +2 HP per level
        let expectedMpMax = 20 + (state.player.level - 1); // Assuming +1 MP per level
        let expectedStaminaMax = 20;

        // Add Skill Perks
      if (state.skills?.survivability?.perks?.['sur_base']) expectedHpMax += (2 * state.skills.survivability.perks['sur_base']);
      if (state.skills?.hand?.perks?.['hand_b1']) expectedHpMax += (1 * state.skills.hand.perks['hand_b1']);
      if (state.skills?.magic?.perks?.['mag_b1']) expectedMpMax += (2 * state.skills.magic.perks['mag_b1']);
      if (state.skills?.survivability?.perks?.['sur_c1']) expectedStaminaMax += (1 * state.skills.survivability.perks['sur_c1']); // It's +1 per level, not +5

      // Only apply if there's a discrepancy to avoid infinite loops
      if (state.player.hpMax < expectedHpMax) state.player.hpMax = expectedHpMax;
      if (state.player.mpMax < expectedMpMax) state.player.mpMax = expectedMpMax;
      if (state.player.staminaMax < expectedStaminaMax) state.player.staminaMax = expectedStaminaMax;
  }
  // -----------------------------------------------------------------

  document.querySelector('.bar.hp')?.classList.toggle('poison', !!state.player.poisoned); // <— add
  document.getElementById('hpText').textContent = state.player.hp + '/' + state.player.hpMax;
  document.getElementById('mpText').textContent = state.player.mp + '/' + state.player.mpMax;
  document.getElementById('hpFill').style.width = clamp((state.player.hp/state.player.hpMax)*100,0,100)+'%';
  
  // FIX: Handle division by zero/zero max MP (e.g., Paladin at start)
  let mpFillPct = 0;
  if (state.player.mpMax > 0) {
    mpFillPct = clamp((state.player.mp / state.player.mpMax) * 100, 0, 100);
  }
  document.getElementById('mpFill').style.width = mpFillPct + '%';
  
  // --- NEW: Update Stamina Bar ---
  const stm = state.player.stamina || 0;
  const stmMax = state.player.staminaMax || 10;
  document.getElementById('stmText').textContent = stm + '/' + stmMax;
  document.getElementById('stmFill').style.width = clamp((stm/stmMax)*100, 0, 100)+'%';
  
  document.getElementById('levelChip').textContent = `Lvl ${state.player.level} — ${state.player.xp}/${state.player.next}`;
  document.getElementById('floorChip').textContent = `Depth ${state.floor}`;
}

function currentBoss(){
  return state.enemies?.find(e => e && e.boss);
}

function updateBossHud(){
  const hud = document.getElementById('bossHud');
  if (!hud) return;

 // NEW: allow cutscenes to hide the boss bar even if a boss entity exists
  if (state._suppressBossHud) { hud.style.display = 'none'; return; }

  const b = currentBoss();

  if (!b){
    hud.style.display = 'none';
    return;
  }

  // Ensure boss has a max for the bar
  if (!Number.isFinite(b.hpMax)) b.hpMax = Math.max(b.hp|0, 1);

  document.getElementById('bossName').textContent =
    b.displayName || (b.type ? `${b.type} Boss` : 'Boss');

  const pct = clamp((b.hp / (b.hpMax||1))*100, 0, 100);
  document.getElementById('bossHpFill').style.width = pct + '%';
  document.getElementById('bossHpText').textContent = `${Math.max(0, b.hp|0)}/${b.hpMax|0}`;

  hud.style.display = 'block';
}

function unlockControls(src){
  state._inputLocked = false;
  state._suppressBossHud = false;
  updateBossHud?.();
  enemyStep?.();          // ← ADD: let enemies act after cutscenes
  draw?.();
}


function updateEquipUI(){
  const w=state.player.weapon;
  const showDur = Number.isFinite(w?.durMax);
  
  // --- NEW: Show Art Status ---
  let artStatus = "";
  if (state.player.artCooldown > 0) {
    artStatus = ` [Art: ${state.player.artCooldown}]`;
  } else {
    artStatus = ` [Art: Ready]`;
  }
  
  const nameTxt = (showDur ? `${w.name} (Dur ${w.dur}/${w.durMax})` : w.name) + artStatus;
  document.getElementById('equipName').textContent = nameTxt;

  // --- NEW: Calculate True Weapon Damage (Split by Type) ---
  let effMin = w.min, effMax = w.max;
  let dispText = `ATK: ${effMin}–${effMax}`;

  // 1. Staff Logic (Magic)
  if (w.type === 'staff') {
      if (isEffectActive('AntiMagic')) {
          dispText = `ATK: SILENCED`;
      } else if (isEffectActive('ArcaneFlux')) {
          effMin = Math.ceil(effMin * 1.5);
          effMax = Math.ceil(effMax * 1.5);
          dispText = `ATK: ${effMin}–${effMax}`;
      }
  } 
  // 2. Melee Logic (Physical)
  else {
      // Apply AntiMagic Buff FIRST (if active)
      if (isEffectActive('AntiMagic')) {
          effMin = Math.ceil(effMin * 1.5);
          effMax = Math.ceil(effMax * 1.5);
      }
      // Apply ArcaneFlux Nerf SECOND (if active) - this handles the rare case where BOTH are active
      if (isEffectActive('ArcaneFlux')) {
          effMin = Math.max(1, Math.ceil(effMin * 0.25));
          effMax = Math.max(1, Math.ceil(effMax * 0.25));
      }
      dispText = `ATK: ${effMin}–${effMax}`;
  }
  
  document.getElementById('equipAtk').textContent = dispText;
  // ----------------------------------------

  const es = state.equippedSpell;
if (es){
  const st   = getSpellStats(es.name);
  const mp   = st.cost|0;
  
  // --- NEW: Calculate True Spell Damage ---
    let sMsg = "";
    if (isEffectActive('AntiMagic')) {
      sMsg = `${es.name} (SILENCED)`;
    } else if (es.name === 'Heal') {
      sMsg = `${es.name} (${mp} MP)`;
    } else {
     let sMin = st.min, sMax = st.max;
     if (state.floorEffect === 'ArcaneFlux') {
       sMin = Math.ceil(sMin * 1.5);
       sMax = Math.ceil(sMax * 1.5);
     }
     sMsg = `${es.name} (${mp} MP) ${sMin}–${sMax} Dmg`;
  }
  document.getElementById('equipSpell').textContent = sMsg;
  // ----------------------------------------
} else {
  document.getElementById('equipSpell').textContent = 'No Spells';
}


  // NEW: Bow (Loaded/Total)
  const loaded = state.player.bow.loaded|0;
  const total  = loaded + (state.inventory.arrows|0);
  document.getElementById('equipBow').textContent = `Bow (${loaded}/${total})`;

  const sh = state.player.shield;
  // Fix: Use the shield's own name property, defaulting to constant if missing
  const sName = sh ? (sh.name || SHIELD_NAME) : 'No Shield';
  
  // Calculate correct max durability for display
  let sMax = 20;
  if (sName.includes('Buckler')) sMax = 15;
  else if (sName.includes('Tower')) sMax = 35;
  else if (sName.includes('Ancient')) sMax = 25;

  const shText = sh
    ? `${sName} (Dur ${sh.dur}/${sMax})`
    : 'No Shield';
  document.getElementById('equipShield').textContent = shText;
}




function renderSkills(){
  const wrap = document.getElementById('skillsList'); 
  if (!wrap) return;
  wrap.innerHTML = '';

  for (const [type, s] of Object.entries(state.skills)){
    if (!s.shown) continue;

    const L = s.lvl | 0;
    const spent = s.spentPoints || 0;
    const available = Math.max(0, (L - 1) - spent);

    const chip = document.createElement('button');
    chip.className   = 'skill';
    chip.type        = 'button';
    chip.dataset.type= type;
    chip.textContent = `${typeNice(type)} (${s.lvl}) — ${s.xp}/${s.next}`;
    
    // --- FIX 3: Glow Gold if points are unused ---
    if (available > 0) {
        chip.style.boxShadow = "0 0 10px 2px rgba(251, 191, 36, 0.6)";
        chip.style.borderColor = "#fbbf24";
        chip.style.color = "#fbbf24";
        chip.style.fontWeight = "bold";
        chip.textContent = `★ ` + chip.textContent; 
    }
    
    chip.onclick     = () => showSkillDetails(type);

    wrap.appendChild(chip);
  }
}

// ===== Skill Details UI =====
function ensureSkillInfoModal(){
  let m = document.getElementById('skillInfoModal');
  if (m) return m;

  m = document.createElement('div');
  m.id = 'skillInfoModal';
  m.className = 'modal';
  m.style.display = 'none';
// --- FIX 4: Widen modal and add side-by-side flex layout for Stats ---
m.innerHTML = `
    <div class="sheet" style="max-width: 1600px; width: 99%; height: 85vh; display: flex; flex-direction: column;">
      <div class="row" style="flex-shrink: 0;">
        <div class="title" id="skillInfoTitle">Skill Details</div>
        <button class="btn" id="btnCloseSkillInfo">Close</button>
      </div>
      <div style="display:flex; flex-direction:row; gap:12px; flex: 1; min-height: 0; margin-top: 10px;">
        <div id="skillInfoBody" style="flex: 1; display: flex; flex-direction: column; min-height: 0; overflow: hidden;"></div>
        <div id="skillInfoStats" style="width: 280px; flex-shrink: 0; background:rgba(0,0,0,0.3); padding:10px; border-radius:8px; border:1px solid #334155; overflow-y:auto; height: 100%;"></div>
      </div>
    </div>`;
  document.body.appendChild(m);

  const close = () => {
    m.style.display = 'none';
    state._inputLocked = false; // UNLOCKS MOVEMENT!
    if (typeof setMobileControlsVisible === 'function') setMobileControlsVisible(true);
  };
  m.querySelector('#btnCloseSkillInfo')?.addEventListener('click', close);
  m.addEventListener('click', (e)=>{ if (e.target === m) close(); });
  return m;
}

function pct(x){ return Math.round(x*100) + '%'; }
function lvlOf(type){ return (state.skills?.[type]?.lvl || 1); }
function extraLevels(type){ return Math.max(0, lvlOf(type) - 1); }

// Use same formula as quirks: 2% per level beyond 1, hard-capped at 40%
function quirkChanceUI(type){
  const chance = 0.02 * extraLevels(type);
  return Math.min(0.40, chance);
}

function showSkillDetails(type){
  if (!type) return;

  // --- FIX: Close the Skills Menu (if open) before showing the Tree ---
  const closeSkillsBtn = document.getElementById('closeSkillsModalBtn');
  if (closeSkillsBtn) {
      const sm = document.getElementById('skillsModalWrapper');
      if (sm && sm.style.display !== 'none') {
          closeSkillsBtn.click();
      }
  }
  // -------------------------------------------------------------------

  // Use the robust modal builder already present in your code
  const modal = ensureSkillInfoModal();
  const title = document.getElementById('skillInfoTitle');
  const body = document.getElementById('skillInfoBody');
  if (!modal || !title || !body) return;

  const s = state.skills[type] || { lvl:1 };
  const L = s.lvl | 0;
  
  // Initialize perk tracking & logic cleanly derived from Level
  s.perks = s.perks || {};
  s.spentPoints = s.spentPoints || 0;
  const available = Math.max(0, (L - 1) - s.spentPoints);

  // Define Skyrim-like branched trees for each category with Max Levels
  const trees = {
  one: [
    { id: 'one_base', name: 'Blade Mastery', max: 5, desc: '+1 Base Damage per level.', req: null },
    
    { id: 'one_a1', name: 'Evasion', max: 5, desc: '5% chance per level to Dodge.', req: 'one_base' },
    { id: 'one_a2', name: 'Lacerate', max: 5, desc: '10% chance per level to Bleed enemies.', req: 'one_base' },
    
    { id: 'one_b1', name: 'Shadow Step', max: 1, desc: 'Take 0 damage when you dodge instead of partial.', req: 'one_a1' },
    { id: 'one_b2', name: 'Fleet Footed', max: 1, desc: 'Moving 3 tiles without stopping grants +50% Dodge chance for 1 turn.', req: 'one_a1' },
    { id: 'one_b3', name: 'Relentless', max: 5, desc: '10% chance per level for a free follow-up attack.', req: 'one_a2' },
    { id: 'one_b4', name: 'Deep Cuts', max: 5, desc: 'Bleed deals +2 extra damage per tick per level.', req: 'one_a2' },
    
    { id: 'one_c1', name: 'Phantom Strike', max: 1, desc: 'Dodging guarantees your next attack is a Critical Hit.', req: 'one_b1' },
    { id: 'one_c2', name: 'Riposte', max: 1, desc: 'Dodging triggers an immediate, free counter-attack.', req: 'one_b1' },
    { id: 'one_c3', name: 'Afterimage', max: 1, desc: 'Moving 3 tiles without stopping guarantees you dodge the next attack.', req: 'one_b2' },
    { id: 'one_c4', name: 'Momentum', max: 1, desc: 'Moving 3 tiles without stopping doubles your next attack damage.', req: 'one_b2' },
    { id: 'one_c5', name: 'Flurry', max: 1, desc: 'Follow-up attacks can trigger a second follow-up.', req: 'one_b3' },
    { id: 'one_c6', name: 'Thousand Cuts', max: 5, desc: 'Each consecutive hit on the same target adds +1 Damage per level.', req: 'one_b3' },
    { id: 'one_c7', name: 'Hemorrhage', max: 1, desc: 'Bleeding enemies take 50% more damage from all your attacks.', req: 'one_b4' },
    { id: 'one_c8', name: 'Bloodthirst', max: 5, desc: 'Attacking a bleeding enemy heals you for 1 HP per level.', req: 'one_b4' }
  ],
  two: [
    { id: 'two_base', name: 'Heavy Grip', max: 5, desc: '+1 Base Damage per level.', req: null },
    
    { id: 'two_a1', name: 'Follow-Through', max: 1, desc: 'Excess overkill damage is dealt to an adjacent enemy.', req: 'two_base' },
    { id: 'two_a2', name: 'Sunder', max: 1, desc: '+50% Damage to Bosses and Warlords.', req: 'two_base' },
    
    { id: 'two_b1', name: 'Brutal Force', max: 1, desc: 'Overkill damage ignores enemy Armor and Damage Reduction.', req: 'two_a1' },
    { id: 'two_b2', name: 'Stagger', max: 1, desc: 'Critical hits push enemies back 1 tile.', req: 'two_a1' },
    { id: 'two_b3', name: 'Crush', max: 5, desc: 'Attacks deal +10% damage per level to Bosses and Elites.', req: 'two_a2' },
    { id: 'two_b4', name: 'Ruthless', max: 5, desc: 'Killing an enemy grants +2 Damage per level to your next attack.', req: 'two_a2' },
    
    { id: 'two_c1', name: 'Shockwave', max: 1, desc: 'Regular attacks also damage the tile directly behind the target.', req: 'two_b1' },
    { id: 'two_c2', name: 'Meteor Strike', max: 1, desc: 'Your Weapon Art permanently Stuns all 8 surrounding enemies for 2 turns.', req: 'two_b1' },
    { id: 'two_c3', name: 'Colossus', max: 1, desc: 'Enemies knocked back are also Stunned for 1 turn.', req: 'two_b2' },
    { id: 'two_c4', name: 'Executioner', max: 1, desc: 'Knocking enemies into a wall deals triple damage.', req: 'two_b2' },
    { id: 'two_c5', name: 'Giant Slayer', max: 1, desc: 'Attacks against Bosses/Warlords cannot miss and roll max damage.', req: 'two_b3' },
    { id: 'two_c6', name: 'Obliterate', max: 1, desc: 'Critical hits deal 3x damage instead of 2x.', req: 'two_b3' },
    { id: 'two_c7', name: 'Rampage', max: 1, desc: 'Kills instantly restore 2 Stamina.', req: 'two_b4' },
    { id: 'two_c8', name: 'Decimate', max: 1, desc: 'Deal double damage if the enemy is at full HP.', req: 'two_b4' }
  ],
  axe: [
    { id: 'axe_base', name: 'Chopper', max: 5, desc: '+1 Base Damage per level.', req: null },
    
    { id: 'axe_a1', name: 'Savage Strikes', max: 5, desc: '+10% Critical Hit Chance per level.', req: 'axe_base' },
    { id: 'axe_a2', name: 'Cripple', max: 5, desc: '10% chance per level to Slow enemies.', req: 'axe_base' },
    
    { id: 'axe_b1', name: 'Bloodlust', max: 5, desc: 'Melee kills heal you for 1 HP per level.', req: 'axe_a1' },
    { id: 'axe_b2', name: 'Berserker', max: 5, desc: 'Gain +1 Damage per level for every 20% missing HP.', req: 'axe_a1' },
    { id: 'axe_b3', name: 'Executioner\'s Mark', max: 5, desc: 'Slowed enemies take +2 Damage from your attacks per level.', req: 'axe_a2' },
    { id: 'axe_b4', name: 'Deep Wounds', max: 5, desc: '10% chance per level to Bleed enemies.', req: 'axe_a2' },
    
    { id: 'axe_c1', name: 'Vampirism', max: 1, desc: 'Bloodlust now heals 10% of Max HP.', req: 'axe_b1' },
    { id: 'axe_c2', name: 'Feast', max: 1, desc: 'Killing a Warlord or Boss permanently increases Max HP by 1.', req: 'axe_b1' },
    { id: 'axe_c3', name: 'Death Wish', max: 1, desc: 'Dropping below 20% HP grants 100% Crit Chance.', req: 'axe_b2' },
    { id: 'axe_c4', name: 'Unstoppable', max: 1, desc: 'While below 50% HP, you are immune to Stun and Slow.', req: 'axe_b2' },
    { id: 'axe_c5', name: 'Decapitate', max: 1, desc: 'Crits against Slowed enemies instantly kill non-bosses.', req: 'axe_b3' },
    { id: 'axe_c6', name: 'Shatter', max: 1, desc: 'Attacking a Slowed enemy completely strips their Armor.', req: 'axe_b3' },
    { id: 'axe_c7', name: 'Agony', max: 1, desc: 'Bleeding enemies are automatically Slowed as well.', req: 'axe_b4' },
    { id: 'axe_c8', name: 'Carnage', max: 1, desc: 'Killing a Bleeding enemy causes them to explode, dealing Bleed damage to adjacent enemies.', req: 'axe_b4' }
  ],
  spear: [
    { id: 'spear_base', name: 'Reach', max: 4, desc: '+5% Base Accuracy per level.', req: null },
    
    { id: 'spear_a1', name: 'First Strike', max: 5, desc: 'Your attacks against enemies at 100% HP deal +2 damage per level.', req: 'spear_base' },
    { id: 'spear_a2', name: 'Phalanx', max: 5, desc: '5% chance per level to Parry incoming damage.', req: 'spear_base' },
    
    { id: 'spear_b1', name: 'Impale', max: 5, desc: '15% chance per level to pierce and hit the enemy directly behind your target.', req: 'spear_a1' },
    { id: 'spear_b2', name: 'Keep Away', max: 1, desc: 'Hitting an enemy forcefully pushes them back 1 tile.', req: 'spear_a1' },
    { id: 'spear_b3', name: 'Impenetrable', max: 1, desc: 'Parries block 100% of damage instead of a percentage.', req: 'spear_a2' },
    { id: 'spear_b4', name: 'Sweeping Strike', max: 5, desc: 'Hitting an enemy has a 20% chance per level to hit all diagonally adjacent enemies.', req: 'spear_a2' },
    
    { id: 'spear_c1', name: 'Gungnir', max: 1, desc: 'Impale pierces infinitely in a straight line.', req: 'spear_b1' },
    { id: 'spear_c2', name: 'Skewer', max: 1, desc: 'Pierced enemies are pinned and Stunned for 1 turn.', req: 'spear_b1' },
    { id: 'spear_c3', name: 'Pinning Strike', max: 1, desc: 'Pushing an enemy into a wall Stuns them for 2 turns.', req: 'spear_b2' },
    { id: 'spear_c4', name: 'Hit and Run', max: 1, desc: 'Killing an enemy refunds 1 Stamina and lets you move 1 tile for free.', req: 'spear_b2' },
    { id: 'spear_c5', name: 'Phalanx Commander', max: 1, desc: 'Successfully Parrying triggers a free counter-attack.', req: 'spear_b3' },
    { id: 'spear_c6', name: 'Perfect Stance', max: 1, desc: 'While you have full Stamina, your Parry chance is doubled.', req: 'spear_b3' },
    { id: 'spear_c7', name: 'Dragoon', max: 1, desc: 'Moving straight toward an enemy for 2+ tiles guarantees your attack is a Crit.', req: 'spear_b4' },
    { id: 'spear_c8', name: 'Zoning', max: 5, desc: 'Enemies that step into your melee range take 1 damage automatically per level.', req: 'spear_b4' }
  ],
  hand: [
    { id: 'hand_base', name: 'Iron Fists', max: 5, desc: '+1 Base Damage per level.', req: null },
    
    { id: 'hand_a1', name: 'Knockout', max: 5, desc: '5% chance per level to Stun enemies.', req: 'hand_base' },
    { id: 'hand_a2', name: 'Deflect', max: 5, desc: '10% chance per level to reduce incoming damage by 50%.', req: 'hand_base' },
    
    { id: 'hand_b1', name: 'Disarm', max: 5, desc: '5% chance per level to permanently reduce enemy Attack power.', req: 'hand_a1' },
    { id: 'hand_b2', name: 'Earthbreaker', max: 1, desc: 'Crits trigger a 3x3 shockwave damaging nearby enemies.', req: 'hand_a1' },
    { id: 'hand_b3', name: 'Counter-Throw', max: 5, desc: '15% chance per level when attacked to swap places with enemy.', req: 'hand_a2' },
    { id: 'hand_b4', name: 'Chi Focus', max: 5, desc: 'Permanently gain +5 Max HP per level.', req: 'hand_a2' },
    
    { id: 'hand_c1', name: 'Pressure Points', max: 1, desc: 'Crits apply Slow and halve enemy damage for 3 turns.', req: 'hand_b1' },
    { id: 'hand_c2', name: 'Nerve Strike', max: 1, desc: 'Stunned enemies take double damage from all sources.', req: 'hand_b1' },
    { id: 'hand_c3', name: 'Quake', max: 1, desc: 'Earthbreaker shockwave now also Stuns any enemies hit.', req: 'hand_b2' },
    { id: 'hand_c4', name: 'Palm Strike', max: 1, desc: 'Attacking a Stunned enemy forcefully throws them 2 tiles away.', req: 'hand_b2' },
    { id: 'hand_c5', name: 'Judo', max: 1, desc: 'Counter-Throw also Stuns the thrown enemy for 2 turns.', req: 'hand_b3' },
    { id: 'hand_c6', name: 'Redirection', max: 1, desc: 'Deflecting an attack reflects the blocked damage back to the attacker.', req: 'hand_b3' },
    { id: 'hand_c7', name: 'Flowing Water', max: 5, desc: 'Successfully Deflecting or Dodging an attack restores 2 HP per level.', req: 'hand_b4' },
    { id: 'hand_c8', name: 'Iron Body', max: 1, desc: '10% of Max HP converts into flat Damage Reduction.', req: 'hand_b4' }
  ],
  bow: [
    { id: 'bow_base', name: 'Eagle Eye', max: 5, desc: '+2% Base Accuracy per level.', req: null },
    
    { id: 'bow_a1', name: 'Tension', max: 5, desc: '+1 Range per level.', req: 'bow_base' },
    { id: 'bow_a2', name: 'Fletching', max: 5, desc: '5% chance per level to not consume an arrow.', req: 'bow_base' },
    
    { id: 'bow_b1', name: 'Sniper', max: 5, desc: '+10% Critical Hit Chance per level.', req: 'bow_a1' },
    { id: 'bow_b2', name: 'Bodkin', max: 1, desc: 'Arrows pierce through 1 enemy.', req: 'bow_a1' },
    { id: 'bow_b3', name: 'Multishot', max: 5, desc: 'Fire 1 extra arrow at a random visible enemy per level.', req: 'bow_a2' },
    { id: 'bow_b4', name: 'Scavenger (Arrows)', max: 1, desc: 'Enemies killed by arrows have 50% chance to drop an arrow.', req: 'bow_a2' },
    
    { id: 'bow_c1', name: 'Headshot', max: 1, desc: 'Crits instantly kill non-bosses.', req: 'bow_b1' },
    { id: 'bow_c2', name: 'Assassin', max: 1, desc: 'Shooting an enemy at maximum range deals double damage.', req: 'bow_b1' },
    { id: 'bow_c3', name: 'Railgun', max: 1, desc: 'Bodkin arrows deal full damage to all pierced targets.', req: 'bow_b2' },
    { id: 'bow_c4', name: 'Pinning Shot', max: 1, desc: 'Piercing an enemy pins them to a wall, Stunning for 3 turns.', req: 'bow_b2' },
    { id: 'bow_c5', name: 'Volley', max: 1, desc: 'Multishot fires twice as many extra arrows.', req: 'bow_b3' },
    { id: 'bow_c6', name: 'Seeker Arrows', max: 1, desc: 'Arrows fired into empty space automatically seek out the nearest visible enemy.', req: 'bow_b3' },
    { id: 'bow_c7', name: 'Endless Quiver', max: 1, desc: 'Fletching chance increases to 50%.', req: 'bow_b4' },
    { id: 'bow_c8', name: 'Explosive Tipped', max: 1, desc: 'Arrows explode on impact, dealing half damage to adjacent tiles.', req: 'bow_b4' }
  ],
  magic: [
    { id: 'mag_base', name: 'Arcane Focus', max: 5, desc: '+5% Spell Accuracy per level.', req: null },
    
    { id: 'mag_a1', name: 'Empower', max: 5, desc: '+1 Spell Damage per level.', req: 'mag_base' },
    { id: 'mag_a2', name: 'Leyline', max: 5, desc: '+2 Max MP per level.', req: 'mag_base' },
    
    { id: 'mag_b1', name: 'Overcharge', max: 5, desc: '10% chance per level for a spell to deal double damage.', req: 'mag_a1' },
    { id: 'mag_b2', name: 'Echo', max: 5, desc: '10% chance per level to cast a second time for free at half damage.', req: 'mag_a1' },
    { id: 'mag_b3', name: 'Siphon', max: 5, desc: 'Melee kills restore 1 MP per level.', req: 'mag_a2' },
    { id: 'mag_b4', name: 'Channeling', max: 5, desc: 'Spells cost 1 less MP per level.', req: 'mag_a2' },
    
    { id: 'mag_c1', name: 'Devastation', max: 1, desc: 'Overcharge deals 3x damage instead of 2x.', req: 'mag_b1' },
    { id: 'mag_c2', name: 'Arcane Chain', max: 1, desc: 'Overcharged spells automatically bounce to a second nearby enemy.', req: 'mag_b1' },
    { id: 'mag_c3', name: 'Resonance', max: 1, desc: 'Echo triggers a 3rd cast at quarter damage.', req: 'mag_b2' },
    { id: 'mag_c4', name: 'Archmage', max: 1, desc: 'Spells ignore Line of Sight and can be cast through walls.', req: 'mag_b2' },
    { id: 'mag_c5', name: 'Blood Magic', max: 1, desc: 'Cast spells using HP if you are out of MP.', req: 'mag_b3' },
    { id: 'mag_c6', name: 'Mana Shield', max: 1, desc: 'Take damage to MP instead of HP while above 0 MP.', req: 'mag_b3' },
    { id: 'mag_c7', name: 'Elemental Weaver', max: 1, desc: 'Casting a spell reduces your next different spell\'s cost to 0.', req: 'mag_b4' },
    { id: 'mag_c8', name: 'Mana Surge', max: 1, desc: 'Descending the stairs to a new floor completely restores your MP to max.', req: 'mag_b4' }
  ],
  survivability: [
    { id: 'sur_base', name: 'Thick Skin', max: 5, desc: '+2 Max HP per level.', req: null },
    
    { id: 'sur_a1', name: 'Hardened', max: 5, desc: '-1 Flat Damage Taken per level.', req: 'sur_base' },
    { id: 'sur_a2', name: 'Athleticism', max: 5, desc: '+5 Max Stamina per level.', req: 'sur_base' },
    
    { id: 'sur_b1', name: 'Spiked Armor', max: 5, desc: 'Enemies take 1 damage per level when they hit you.', req: 'sur_a1' },
    { id: 'sur_b2', name: 'Purifier', max: 1, desc: 'Immune to Poison and Status effects.', req: 'sur_a1' },
    { id: 'sur_b3', name: 'Troll Blood', max: 5, desc: 'Heal 1 HP per level every 10 turns.', req: 'sur_a2' },
    { id: 'sur_b4', name: 'Alchemist', max: 1, desc: 'Potions heal 50% more.', req: 'sur_a2' },
    
    { id: 'sur_c1', name: 'Retribution', max: 1, desc: 'Reflect 50% of blocked/reduced damage back to the attacker.', req: 'sur_b1' },
    { id: 'sur_c2', name: 'Titan\'s Grip', max: 1, desc: 'Allows you to equip a Shield alongside a Two-Handed weapon.', req: 'sur_b1' },
    { id: 'sur_c3', name: 'Indomitable', max: 1, desc: 'Take half damage from Bosses.', req: 'sur_b2' },
    { id: 'sur_c4', name: 'Juggernaut', max: 1, desc: 'Take 50% less damage from Traps and Hazards.', req: 'sur_b2' },
    { id: 'sur_c5', name: 'Second Wind', max: 1, desc: 'Once per floor, dropping below 20% HP instantly heals 50% HP.', req: 'sur_b3' },
    { id: 'sur_c6', name: 'Regeneration', max: 5, desc: 'Heal +5 HP per level when using stairs.', req: 'sur_b3' },
    { id: 'sur_c7', name: 'Iron Stomach', max: 1, desc: 'Drinking a potion also grants you a +2 Damage buff for 10 turns.', req: 'sur_b4' },
    { id: 'sur_c8', name: 'Immortal', max: 1, desc: 'Once per run, survive a fatal blow at 1 HP.', req: 'sur_b4' }
  ],
  lockpicking: [
    { id: 'loc_base', name: 'Tinkerer', max: 5, desc: '+10% Lockpick Success Chance per level.', req: null },
    
    { id: 'loc_a1', name: 'Scavenger', max: 5, desc: 'Find 20% more gold per level.', req: 'loc_base' },
    { id: 'loc_a2', name: 'Trap Sense', max: 1, desc: 'Spike Traps deal half damage to you.', req: 'loc_base' },
    
    { id: 'loc_b1', name: 'Appraiser', max: 1, desc: 'Chests have a +25% chance to drop Affixed weapons.', req: 'loc_a1' },
    { id: 'loc_b2', name: 'Haggle', max: 1, desc: 'Merchant prices are permanently reduced by 20%.', req: 'loc_a1' },
    { id: 'loc_b3', name: 'Saboteur', max: 1, desc: 'Walking over Spike Traps permanently breaks them.', req: 'loc_a2' },
    { id: 'loc_b4', name: 'Scout', max: 1, desc: 'Field of vision in the darkness is permanently increased by 2 tiles.', req: 'loc_a2' },
    
    { id: 'loc_c1', name: 'Bounty', max: 1, desc: 'Warlords and Bosses drop 3x the normal amount of gold.', req: 'loc_b1' },
    { id: 'loc_c2', name: 'Alchemist\'s Bag', max: 1, desc: 'Using any consumable has a 25% chance to not be consumed.', req: 'loc_b1' },
    { id: 'loc_c3', name: 'Silver Tongue', max: 1, desc: 'Sell items to the merchant for 50% more gold.', req: 'loc_b2' },
    { id: 'loc_c4', name: 'Mercenary', max: 5, desc: 'Deal +1% bonus weapon damage for every 100 gold you are carrying per level.', req: 'loc_b2' },
    { id: 'loc_c5', name: 'Master Thief', max: 1, desc: 'Lockpicks never break.', req: 'loc_b3' },
    { id: 'loc_c6', name: 'Trapmaster', max: 1, desc: 'Safely walk over traps, "arming" them to deal double damage to enemies.', req: 'loc_b3' },
    { id: 'loc_c7', name: 'Shadow Walk', max: 1, desc: 'Enemies cannot spot or aggro onto you unless you are within 2 tiles of them.', req: 'loc_b4' },
    { id: 'loc_c8', name: 'Lucky Coin', max: 1, desc: 'Flat 10% chance to take 0 damage from any source.', req: 'loc_b4' }
  ]
};

  const perks = trees[type] || [];
  title.textContent = `${typeNice(type)} Mastery`;
  
  // --- NEW: Map perks to a hierarchical visual tree structure ---
  const perkMap = {};
  const roots = [];
  perks.forEach(p => { perkMap[p.id] = { ...p, children: [] }; });
  perks.forEach(p => {
      // Find parent, push to children array. If none, it's a root.
      if (p.req && perkMap[p.req]) perkMap[p.req].children.push(perkMap[p.id]);
      else roots.push(perkMap[p.id]);
  });

  let html = `
    <style>
      .st-tree { display:flex; justify-content:center; padding:10px 10px 20px 10px; flex:1; overflow:auto; min-height:0; }
      .st-children { display:flex; justify-content:center; padding-top:20px; position:relative; }
      .st-child-wrap { display:flex; flex-direction:column; align-items:center; float:left; text-align:center; position:relative; padding:20px 2px 0 2px; }
      
      /* Horizontal Lines connecting siblings */
      .st-child-wrap::before, .st-child-wrap::after {
          content:''; position:absolute; top:0; right:50%; border-top:2px solid #475569; width:50%; height:20px;
      }
      .st-child-wrap::after { right:auto; left:50%; border-left:2px solid #475569; }
      
      /* Clean up edges so lines don't overhang */
      .st-child-wrap:only-child::after, .st-child-wrap:only-child::before { display:none; }
      .st-child-wrap:only-child { padding-top:0; }
      .st-child-wrap:first-child::before, .st-child-wrap:last-child::after { border:0 none; }
      .st-child-wrap:last-child::before { border-right:2px solid #475569; border-radius:0 6px 0 0; }
      .st-child-wrap:first-child::after { border-radius:6px 0 0 0; }
      
      /* Vertical Line going down from parent */
      .st-children::before {
          content:''; position:absolute; top:0; left:50%; border-left:2px solid #475569; width:0; height:20px; transform:translateX(-50%);
      }
    </style>
    <div style="text-align:center; margin-bottom:12px; font-size:14px; flex-shrink:0;">
      Level ${L} | Skill Points: <span style="color:#f9d65c; font-weight:900; font-size:16px;">${available}</span>
    </div>
    <div class="st-tree">
  `;

  // Recursive UI Builder
  function buildNode(node) {
      const curLvl = s.perks[node.id] || 0;
      const maxed = curLvl >= node.max;
      
      // --- FIX: Strict Max-Level Requirement Check ---
      let reqMet = true;
      if (node.req) {
          const reqPerkData = perks.find(x => x.id === node.req);
          if (!reqPerkData || (s.perks[node.req] || 0) < reqPerkData.max) reqMet = false;
      }
      const canUnlock = !maxed && reqMet && available > 0;
      
      let border = 'var(--chipBorder)';
      let bg = 'rgba(255,255,255,0.03)';
      let color = '#9ca3af';
      let cursor = 'not-allowed';
      
      if (maxed) {
        bg = '#15803d'; border = '#22c55e'; color = '#fff';
      } else if (curLvl > 0) {
        bg = canUnlock ? '#1b2a3a' : 'rgba(255,255,255,0.05)';
        border = canUnlock ? '#f9d65c' : 'var(--chipBorder)';
        color = '#d9e7f5'; cursor = canUnlock ? 'pointer' : 'not-allowed';
      } else if (canUnlock) {
        bg = '#1b2a3a'; border = '#f9d65c'; color = '#d9e7f5'; cursor = 'pointer';
      } else if (reqMet) {
        color = '#d9e7f5';
      }

      let reqName = 'Previous';
      if (node.req) {
          const rP = perks.find(x => x.id === node.req);
          if (rP) reqName = rP.name;
      }

      // Compact "Card" style button for the tree
      const card = `
        <button class="perk-btn" data-id="${node.id}" data-can="${canUnlock}" style="position:relative; z-index:2; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; width:110px; min-height:90px; text-align:center; background:${bg}; border:2px solid ${border}; color:${color}; padding:6px; border-radius:8px; cursor:${cursor}; transition:transform 0.1s; box-shadow:0 4px 6px rgba(0,0,0,0.3);">
          <div style="font-weight:800; font-size:11px; margin-bottom:4px; line-height:1.1;">${node.name}</div>
          <div style="font-size:9.5px; font-weight:bold; color:#f9d65c; margin-bottom:4px; background:rgba(0,0,0,0.4); padding:2px 6px; border-radius:4px;">Lv ${curLvl}/${node.max}</div>
          <div style="font-size:9px; opacity:0.85; line-height:1.2; flex:1;">${node.desc}</div>
          ${!reqMet ? `<div style="margin-top:4px; font-size:8.5px; color:#fca5a5; line-height:1.1; border-top:1px dashed rgba(255,255,255,0.2); padding-top:4px; width:100%;">Req Max:<br><b style="color:#ef4444;">${reqName}</b></div>` : ''}
        </button>
      `;

      let childrenHtml = '';
      if (node.children && node.children.length > 0) {
          childrenHtml = `<div class="st-children">` + node.children.map(c => `<div class="st-child-wrap">${buildNode(c)}</div>`).join('') + `</div>`;
      }
      return card + childrenHtml;
  }

  // Draw the tree starting from the roots
  if (roots.length > 0) {
      html += `<div style="display:flex; gap:20px;">` + roots.map(r => `<div style="display:flex; flex-direction:column; align-items:center;">${buildNode(r)}</div>`).join('') + `</div>`;
  } else {
      html += `<div style="opacity:0.5; text-align:center; padding:10px; width:100%;">No skill tree available for this category.</div>`;
  }
  html += `</div>`;
  body.innerHTML = html;

  // --- FIX 4 (Cont): Build the Stats Panel ---
  const statsPanel = document.getElementById('skillInfoStats');
  if (statsPanel) {
      let statsHtml = `<div style="font-weight:800; color:#f9d65c; margin-bottom:12px; font-size:14px; border-bottom:1px solid #475569; padding-bottom:6px;">Active Bonuses</div>`;
      let hasAny = false;
      let totalsMap = {}; 

      perks.forEach(p => {
          const curLvl = s.perks[p.id] || 0;
          if (curLvl > 0) {
              let descText = p.desc;
              
              // Extract the numbers and calculate the total inline bonus
              const isScaling = p.desc.toLowerCase().includes('per level') || p.max > 1;
              const fullNumMatch = p.desc.match(/\+?[0-9.]+%?/);
              
              if (fullNumMatch && isScaling) {
                  const numOnly = parseFloat(fullNumMatch[0].replace(/[^0-9.]/g, ''));
                  const totalVal = numOnly * curLvl;
                  const hasPct = fullNumMatch[0].includes('%');
                  const prefix = fullNumMatch[0].includes('+') ? '+' : '';
                  
                  // Append the calculated total right next to the description
                  descText += ` <b style="color:#f9d65c;">(${prefix}${totalVal}${hasPct?'%':''})</b>`;
                  
                  // Clean up the text string to extract the raw stat name for the summary
                  let statName = p.desc.replace(fullNumMatch[0], '').replace(/per level/gi, '').trim();
                  statName = statName.replace(/\s+/g, ' '); // remove double spaces
                  statName = statName.charAt(0).toUpperCase() + statName.slice(1);
                  
                  // Accumulate into the Totals Tracker
                  if (!totalsMap[statName]) totalsMap[statName] = { val: 0, hasPct, prefix };
                  totalsMap[statName].val += totalVal;
              }

              statsHtml += `<div style="font-size:12px; color:#d9e7f5; margin-bottom:8px; line-height:1.3;">
                              <span style="color:#4ade80; margin-right:4px;">✔</span> <b>${p.name} (Lv ${curLvl})</b><br>
                              <span style="opacity:0.8; padding-left:16px; display:block;">${descText}</span>
                            </div>`;
              hasAny = true;
          }
      });
      
      if (!hasAny) {
          statsHtml += `<div style="font-size:12px; opacity:0.5; font-style:italic;">No perks unlocked yet.</div>`;
      } else {
          // Append the Aggregated Summary block at the bottom
          const totalsKeys = Object.keys(totalsMap);
          if (totalsKeys.length > 0) {
              statsHtml += `<div style="margin-top:16px; border-top:1px dashed #475569; padding-top:12px;">
                              <div style="font-weight:800; color:#f9d65c; margin-bottom:8px; font-size:13px;">Total Tree Bonuses</div>`;
              totalsKeys.forEach(k => {
                  const t = totalsMap[k];
                  
                  // --- FIX: Endless Quiver Override ---
                  if (type === 'bow' && s.perks['bow_c7'] && k.toLowerCase().includes('consume an arrow')) {
                      t.val = 50;
                  }
                  
                  let displayVal = `${t.prefix}${parseFloat(t.val.toFixed(2))}${t.hasPct?'%':''}`;
                  
                  // --- FIX: Add Base Stat Math & Context for Accuracy ---
                  if (k.includes('Accuracy')) {
                      let base = 75; // Default magic/unarmed base
                      try {
                          if (typeof baseAccuracy === 'function' && type !== 'magic') {
                              // Pulls the actual base accuracy of the weapon type from your combat script
                              base = Math.round(baseAccuracy(type) * 100) || 75;
                          }
                      } catch(e){}
                      
                      const total = base + t.val;
                      const cappedTotal = Math.min(100, total); // Cap visual at 100%
                      displayVal = `<b style="color:#4ade80;">${cappedTotal}%</b> <span style="font-size:10px; color:#9ca3af; font-weight:normal;">(${base}% base + ${t.val}% bonus)</span>`;
                  } else {
                      displayVal = `<b style="color:#4ade80;">${displayVal}</b>`;
                  }
                  
                  statsHtml += `<div style="font-size:12px; color:#d9e7f5; display:flex; justify-content:space-between; margin-bottom:4px; align-items:baseline;">
                                  <span style="opacity:0.9;">Total ${k}</span>
                                  <div style="text-align:right;">${displayVal}</div>
                                </div>`;
              });
              statsHtml += `</div>`;
          }
      }
      statsPanel.innerHTML = statsHtml;
  }
  
  // Wire up clicks
  const btns = body.querySelectorAll('.perk-btn');
  btns.forEach(btn => {
    btn.onclick = () => {
      if (btn.dataset.can === 'true') {
        const pId = btn.dataset.id;
        // Increment the level of the perk
        s.perks[pId] = (s.perks[pId] || 0) + 1;
        s.spentPoints += 1;
        
        // Immediate generic stat application logic
        if (pId === 'sur_base') { // Thick Skin (+2 Max HP)
          state.player.hpMax += 2;
          state.player.hp += 2;
          if (typeof updateBars === 'function') updateBars();
        }
        if (pId === 'hand_b4') { // Chi Focus (+5 Max HP)
          state.player.hpMax += 5;
          state.player.hp += 5;
          if (typeof updateBars === 'function') updateBars();
        }
        if (pId === 'mag_a2') { // Leyline (+2 Max MP)
          state.player.mpMax += 2;
          state.player.mp += 2;
          if (typeof updateBars === 'function') updateBars();
        }
        if (pId === 'sur_a2') { // Athleticism (+5 Max Stamina)
          state.player.staminaMax = (state.player.staminaMax || 10) + 5;
          state.player.stamina += 5;
          if (typeof updateBars === 'function') updateBars();
        }
        if (pId === 'loc_b4') { // Scout (+2 Vision)
          state.fovRadius = (state.fovRadius || 5) + 2;
          if (typeof draw === 'function') draw();
        }
        
        if (typeof recomputeWeapon === 'function') {
            recomputeWeapon();
            if (typeof updateEquipUI === 'function') updateEquipUI(); // FIX: Update main HUD for base damage perks like Iron Fists
        }
        // Play SFX and re-render
        if (typeof SFX !== 'undefined' && SFX.pickup) SFX.pickup();
        showSkillDetails(type); 
        if (typeof renderSkills === 'function') renderSkills(); 
      }
    };
  });

  modal.style.display = 'flex';
  state._inputLocked = true;
  if (typeof setMobileControlsVisible === 'function') setMobileControlsVisible(false);
}




