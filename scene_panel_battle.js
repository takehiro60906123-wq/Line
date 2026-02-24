class PanelBattleScreen {
  constructor() { this.size = 6; }
  start(enemyData, playerStats, onFinish) {
    this.enemy = Object.assign({ name:'Enemy', emoji:'👾', hp:100, atk:10, goldBase:30, expBase:20 }, enemyData || {});
    this.player = { hp: (playerStats && playerStats.hp) || 200, atk: (playerStats && playerStats.atk) || 20 };
    this.onFinish = onFinish;
    this.turn = 1;
    this.grid = Array.from({length:this.size*this.size}, ()=> this.randomPanel());
    this.render();
  }
  randomPanel(){ const r=Math.random(); if(r<.25)return'⚔'; if(r<.45)return'🔥'; if(r<.63)return'💚'; if(r<.75)return'😈'; if(r<.9)return'💰'; return '🐤'; }
  render(){ if(!this.ui) this.ui = new PanelBattleUI(this); this.ui.render(); }
  tap(idx){
    const kind=this.grid[idx]; if(!kind || kind==='😈') return;
    const chain=this.collect(idx,kind); chain.forEach(i=> this.grid[i]=null);
    const n=chain.length;
    if(kind==='⚔'||kind==='🔥') this.enemy.hp -= Math.max(1,Math.floor(this.player.atk*n));
    if(kind==='💚') this.player.hp += 8*n;
    for(let i=0;i<this.grid.length;i++) if(!this.grid[i]) this.grid[i]=this.randomPanel();
    if(this.enemy.hp<=0) return this.finish(true, { isWin:true, gold:this.enemy.goldBase+n*5, exp:this.enemy.expBase+n*3, chickGot: kind==='🐤' && n>=4 });
    this.player.hp -= this.enemy.atk;
    if(this.player.hp<=0) return this.finish(false, { isWin:false, gold:0, exp:0, chickGot:false });
    this.turn++; this.render();
  }
  collect(start,kind){ const q=[start],v=new Set([start]); const res=[]; const W=this.size;
    while(q.length){ const i=q.shift(); res.push(i); const x=i%W,y=Math.floor(i/W); [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy])=>{ const nx=x+dx, ny=y+dy; if(nx<0||ny<0||nx>=W||ny>=W) return; const ni=ny*W+nx; if(!v.has(ni)&&this.grid[ni]===kind){v.add(ni);q.push(ni);} }); }
    return res;
  }
  finish(isWin, reward){ this.ui.close(); if(this.onFinish) this.onFinish(reward); }
}
