class PanelBattleUI {
  constructor(ctrl){ this.ctrl=ctrl; }
  render(){
    let ov=document.getElementById('panel-battle-overlay');
    if(!ov){ ov=document.createElement('div'); ov.id='panel-battle-overlay'; ov.className='panel-battle-overlay'; document.body.appendChild(ov); }
    const c=this.ctrl;
    ov.innerHTML=`<div class='panel-battle-card'><div>ターン:${c.turn}</div><div>${c.enemy.emoji} ${c.enemy.name} HP:${Math.max(0,c.enemy.hp)}</div><div>PLAYER HP:${Math.max(0,c.player.hp)}</div><div class='pb-grid'>${c.grid.map((p,i)=>`<button class='pb-cell' data-i='${i}'>${p}</button>`).join('')}</div></div>`;
    ov.querySelectorAll('.pb-cell').forEach(b=>b.onclick=()=>c.tap(parseInt(b.dataset.i,10)));
  }
  close(){ const ov=document.getElementById('panel-battle-overlay'); if(ov) ov.remove(); }
}
