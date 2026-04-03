(function(){
  const onTouch = ()=> document.documentElement.classList.add('touch');
  window.addEventListener('touchstart', onTouch, { once:true, passive:true });
  window.addEventListener('pointerdown', e=>{
    if (e.pointerType && e.pointerType !== 'mouse') onTouch();
  }, { once:true });
})();
