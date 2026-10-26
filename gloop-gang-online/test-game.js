'use strict';
const fs=require('fs');const vm=require('vm');const assert=require('node:assert/strict');
class ClassList{constructor(init=[]){this.set=new Set(init);}add(s){this.set.add(s);}remove(s){this.set.delete(s);}contains(s){return this.set.has(s);}toggle(s,on){if(on===undefined)on=!this.contains(s);if(on)this.add(s);else this.remove(s);return on;}}
const elements=new Map();
const fakeCtx=new Proxy({}, {get:(target,key)=>{if(key==='createRadialGradient')return ()=>({addColorStop(){}});if(!target[key])target[key]=()=>{};return target[key];},set:(t,k,v)=>(t[k]=v,true)});
function element(id){if(!elements.has(id)){const e={id,classList:new ClassList(id==='menuScreen'?['active']:id==='upgradeModal'||id==='pauseModal'?['hidden']:[]),style:{},value:'',textContent:'',innerHTML:'',disabled:false,onclick:null,listeners:{},getContext:()=>fakeCtx,getBoundingClientRect:()=>({width:390,height:844,left:0,top:0}),addEventListener:function(type,fn){this.listeners[type]=fn;},setPointerCapture(){},getAttribute(k){return this[k]},click(){this.onclick?.();this.listeners.click?.({});}};elements.set(id,e);}return elements.get(id);}
const document={getElementById:element,querySelectorAll:()=>[],activeElement:{tagName:'BODY'}};
let currentRAF=null;const handlers={};const window={addEventListener(type,fn){handlers[type]=fn;},devicePixelRatio:1};
let seed=12345678;const gameMath=Object.create(Math);gameMath.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const now={t:1000};const ctx={window,document,performance:{now:()=>now.t},requestAnimationFrame:(cb)=>currentRAF=cb,localStorage:{getItem:()=>null,setItem(){}},navigator:{},location:{protocol:'file:',search:'',pathname:'/index.html'},history:{replaceState(){}},URLSearchParams,Math:gameMath,console,clearTimeout,setTimeout:()=>0,WebSocket:undefined};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/public/app.js','utf8'),ctx,{filename:'app.js'});
assert.equal(element('perksGrid').innerHTML.includes('EXTRA HEARTS'),true);
element('nameInput').value='Arcade Test';element('soloBtn').click();assert.equal(element('gameScreen').classList.contains('active'),true);
let hadKills=false,hadWave=false,hadLevel=false,ended=false;
const directions=['d','s','a','w'];let prevKey=null;
for(let i=1;i<9000;i++){if(i===1||i%65===0){if(prevKey)handlers.keyup?.({key:prevKey});prevKey=directions[Math.floor(i/65)%4];handlers.keydown?.({key:prevKey,repeat:false,preventDefault(){}});}now.t+=45;if(!currentRAF)throw new Error('Animation loop stopped');currentRAF(now.t);
 const kills=+element('killText').textContent;if(kills>0)hadKills=true;
 if(String(element('waveText').textContent)!=='WAVE 1')hadWave=true;
 if(String(element('levelText').textContent)!=='LVL 1')hadLevel=true;
 // Select random offered upgrades to keep gameplay moving and test upgrades.
 if(!element('upgradeModal').classList.contains('hidden'))handlers.keydown?.({key:'1',repeat:false,preventDefault(){}});
 if(element('resultScreen').classList.contains('active')){ended=true;break;}
}
assert.equal(ended,true,'Run should terminate with a results screen');
assert.equal(hadKills,true,'Automatic weapons should defeat enemies');
assert.equal(hadLevel,true,'Collecting experience should trigger level-ups');
assert.equal(hadWave,true,'Surviving should advance to later waves');
assert.equal(element('resultCoins').textContent.startsWith('+'),true);
console.log('PASS: offline solo run starts, enemy movement/combat works, kills recorded, level system processes, results and permanent currency credited', {hadWave,hadLevel,earned:element('resultCoins').textContent});
