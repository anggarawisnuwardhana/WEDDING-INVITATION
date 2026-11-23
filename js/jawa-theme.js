/* Dekorasi tema Jawa: wayang (gunungan) 3D, mandala kawung, partikel, tilt 3D. Tidak menyentuh fungsi halaman. */
(function(){
  var gunungan='<svg viewBox="0 0 100 200" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">'+
  '<path d="M50 2C66 34 98 62 98 124V198H2V124C2 62 34 34 50 2Z" fill="currentColor" fill-opacity=".12"/>'+
  '<path d="M50 14C62 40 88 66 88 124V190H12V124C12 66 38 40 50 14Z"/>'+
  '<path d="M50 40V170M50 70C38 66 30 74 28 84M50 70C62 66 70 74 72 84M50 100C36 96 26 106 26 118M50 100C64 96 74 106 74 118M50 132C40 130 34 138 34 148M50 132C60 130 66 138 66 148"/>'+
  '<circle cx="50" cy="30" r="4" fill="currentColor"/><circle cx="28" cy="84" r="3" fill="currentColor"/><circle cx="72" cy="84" r="3" fill="currentColor"/>'+
  '<path d="M20 176H80M26 184H74" /></svg>';
  var ring='<svg viewBox="0 0 200 200" fill="none" stroke="currentColor" stroke-width=".8">'+
  '<circle cx="100" cy="100" r="96"/><circle cx="100" cy="100" r="70" stroke-dasharray="3 5"/><circle cx="100" cy="100" r="44"/>'+
  '<g id="p"><ellipse cx="100" cy="50" rx="10" ry="30"/></g>'+
  [45,90,135,180,225,270,315].map(function(a){return '<use href="#p" transform="rotate('+a+' 100 100)"/>'}).join('')+
  '<circle cx="100" cy="100" r="6" fill="currentColor"/></svg>';

  function build(){
    if(document.querySelector('.jv-stage'))return;
    var s=document.createElement('div');s.className='jv-stage';s.setAttribute('aria-hidden','true');
    s.innerHTML='<div class="jv-batik"></div><div class="jv-glow"></div>'+
      '<div class="jv-ring">'+ring+'</div>'+
      '<div class="jv-wayang l">'+gunungan+'</div><div class="jv-wayang r">'+gunungan+'</div>';
    var n=window.innerWidth<700?9:16;
    for(var i=0;i<n;i++){
      var p=document.createElement('i');p.className='jv-spark';
      p.style.left=(Math.random()*100)+'%';p.style.bottom=(-5+Math.random()*20)+'%';
      p.style.animationDuration=(9+Math.random()*10)+'s';p.style.animationDelay=(-Math.random()*14)+'s';
      p.style.width=p.style.height=(4+Math.random()*6)+'px';
      s.appendChild(p);
    }
    document.body.insertBefore(s,document.body.firstChild);
  }

  function tilt(){
    if(window.matchMedia('(prefers-reduced-motion:reduce)').matches||!window.matchMedia('(hover:hover)').matches)return;
    var sel='.card,.quick-card,.export-card,.inv-event-card,.gift-card,.inv-count-item,.inv-photo-frame,.eticket-card,.search-card,.scan-frame,.guest-box';
    document.addEventListener('pointermove',function(e){
      var el=e.target.closest&&e.target.closest(sel);
      if(!el)return;
      var r=el.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;
      el.classList.add('jv-tilt');
      el.style.transition='transform .12s';
      el.style.transform='perspective(800px) rotateX('+(-y*7).toFixed(2)+'deg) rotateY('+(x*9).toFixed(2)+'deg) translateZ(6px)';
    },{passive:true});
    document.addEventListener('pointerout',function(e){
      var el=e.target.closest&&e.target.closest(sel);
      if(!el||el.contains(e.relatedTarget))return;
      el.style.transition='transform .5s';el.style.transform='';
    },{passive:true});
  }

  function init(){build();tilt();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
