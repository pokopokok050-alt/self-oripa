'use strict';
const KEY='self_oripa_pwa_v12', depositAmounts=[500,1000,2000,3000], ticketAmounts=[100,200,300,400,500,1000,2000,3000];
const multipliers=[0.5,...Array.from({length:91},(_,i)=>Number((1+i/10).toFixed(1)))];
const weights=multipliers.map(m=>Math.exp(-.7*(m-.5))),weightSum=weights.reduce((a,b)=>a+b,0);
const targetExpectedMultiplier=1/3;
const conditionalMean= multipliers.reduce((sum,m,i)=>sum+m*weights[i],0)/weightSum;
const nonzeroProbability=targetExpectedMultiplier/conditionalMean;
const zeroProbability=1-nonzeroProbability;
const $=id=>document.getElementById(id),yen=n=>'¥'+n.toLocaleString('ja-JP');
const day=t=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t));
const now=()=>new Date().toISOString();
const empty=()=>({version:12,deposits:[],draws:[],spends:[],events:[]});
function load(){
  try {let v=JSON.parse(localStorage.getItem(KEY));
    if(v && Array.isArray(v.deposits) && Array.isArray(v.draws) && Array.isArray(v.events)) return {...v,spends:Array.isArray(v.spends)?v.spends:[]};
  }catch(e){} return empty();
}
let state=load(),depositAmount=500,ticketAmount=500,busy=false;
let revealTimers=[],finishReveal=null;
function clearRevealTimers(){revealTimers.forEach(clearTimeout);revealTimers=[];}
function stagePhase(phase,label){$('stage').className='stage '+phase;$('stageLabel').textContent=label;}
function resetStage(){clearRevealTimers();finishReveal=null;$('skipBtn').classList.add('hidden');stagePhase('','宝箱を開けよう');$('result').textContent='？？？倍';$('payout').textContent='0倍は約84.85%、期待還元率33.33%';}

function save(){localStorage.setItem(KEY,JSON.stringify(state));}
function sum(arr,key){return arr.reduce((a,x)=>a+(Number(x[key])||0),0);}
function totals(){
  const total=sum(state.deposits,'amount');
  const spent=sum(state.draws,'ticket');
  const paid=sum(state.draws,'payout');
  const used=sum(state.spends||[],'amount');
  return {total:total-used,credit:total-spent+paid-used,used};
}
function today(){let d=day(now());return {
  deposit:sum(state.deposits.filter(x=>day(x.at)===d),'amount'),
  payout:sum(state.draws.filter(x=>day(x.at)===d),'payout'),
  draw:state.draws.filter(x=>day(x.at)===d).length
};}
function rand(){let a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]/4294967296;}
function drawM(){if(rand()<zeroProbability)return 0;let r=rand()*weightSum;for(let i=0;i<weights.length;i++){r-=weights[i];if(r<0)return multipliers[i];}return 10;}
function choose(id,selected,fn){$(id).replaceChildren();for(let a of (id==='ticketChoices'?ticketAmounts:depositAmounts)){let b=document.createElement('button');b.textContent=yen(a);b.className=a===selected?'selected':'';b.onclick=()=>{fn(a);choose(id,a,fn);renderButtons();};$(id).append(b);}}
function renderButtons(){let t=today(),s=totals();$('depositBtn').disabled=busy||t.deposit+depositAmount>3000;$('drawBtn').disabled=busy||s.credit<ticketAmount;$('spendBtn').disabled=busy||s.credit<=0;}
function render(){let s=totals(),t=today();$('total').textContent=yen(s.total);$('credit').textContent=yen(s.credit);$('spendAvailable').textContent=yen(s.credit);$('todayDeposit').textContent=`${yen(t.deposit)} / ¥3,000`;$('todayDraw').textContent=`${t.draw}回`;$('payoutToday').textContent=yen(t.payout);renderButtons();renderHistory();}
function deposit(){if(busy)return;if(today().deposit+depositAmount>3000)return alert('本日の新規仮想入金は3,000円が上限です。');let at=now();state.deposits.push({at,amount:depositAmount});state.events.push({at,type:'新規仮想入金',detail:yen(depositAmount)});save();render();}
function recordSpend(){
  if(busy)return;
  const input=$('spendAmount');
  const amount=Number(input.value);
  if(!Number.isSafeInteger(amount)||amount<=0){alert('1円以上の整数で使用金額を入力してください。');return;}
  const available=totals().credit;
  if(amount>available || amount>totals().total){alert(`残高が不足しています。クレジット：${yen(available)}、仮想貯金：${yen(totals().total)}です。`);return;}
  if(!confirm(`${yen(amount)}を現実で使用した金額として記録し、クレジットと仮想貯金総額の両方から差し引きますか？`))return;
  const at=now();
  state.spends.push({at,amount});
  state.events.push({at,type:'現実で使用',detail:`${yen(amount)} 減算`});
  save();input.value='';render();
  alert(`${yen(amount)}を両方から減算しました。クレジット残高：${yen(totals().credit)}`);
}
function draw(){
  if(busy)return;
  let s=totals();
  if(s.credit<ticketAmount){alert('購入可能クレジットが足りません。仮想入金してください。');return;}
  busy=true;renderButtons();
  let m=drawM(),at=now(),payout=ticketAmount*Math.round(m*10)/10;
  // 例：1000円チケット・2倍なら必ず2000円をクレジットに加算する。
  state.draws.push({at,ticket:ticketAmount,multiplier:m,payout});
  state.events.push({at,type:'チケット購入・抽選',detail:`購入 ${yen(ticketAmount)} / ${m.toFixed(1)}倍 / 払出 ${yen(payout)}`});
  save();render();
  clearRevealTimers();$('result').textContent='？？？倍';$('payout').textContent='抽選結果は確定済み';
  $('skipBtn').classList.remove('hidden');stagePhase('phase-enter','宝箱が現れた');
  finishReveal=()=>{if(!busy)return;clearRevealTimers();$('skipBtn').classList.add('hidden');stagePhase('phase-result revealed '+(m>=10?'rainbow':m>=3?'gold':''),'抽選結果');$('result').textContent=m.toFixed(1)+'倍';$('payout').textContent=`${yen(payout)} 払出 / 現在 ${yen(totals().credit)}`;busy=false;render();};
  revealTimers.push(setTimeout(()=>stagePhase('phase-orbit','光の輪が回転する'),900));
  revealTimers.push(setTimeout(()=>stagePhase('phase-charge','宝箱の封印がほどける'),2200));
  revealTimers.push(setTimeout(()=>stagePhase('phase-open','宝箱が開く'),3400));
  revealTimers.push(setTimeout(()=>finishReveal?.(),4600));
}
function renderHistory(){let e=[...state.events].reverse().slice(0,80);$('records').replaceChildren();if(!e.length){$('records').innerHTML='<p class="empty">履歴はまだありません。</p>';return;}for(let x of e){let d=document.createElement('div');d.className='record';d.textContent=`${x.type}：${x.detail}`;let s=document.createElement('small');s.textContent=new Date(x.at).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'});d.append(s);$('records').append(d);}}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('hidden',p.id!==b.dataset.tab));});

$('spendBtn').onclick=recordSpend;$('depositBtn').onclick=deposit;$('drawBtn').onclick=draw;$('skipBtn').onclick=()=>finishReveal?.();
$('exportBtn').onclick=()=>{let url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='self-oripa-v18-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('importInput').onchange=async e=>{let f=e.target.files?.[0];if(!f)return;try{let s=JSON.parse(await f.text());if(s.version!==12||!Array.isArray(s.deposits)||!Array.isArray(s.draws)||!Array.isArray(s.events))throw Error();if(!confirm('履歴を上書きしますか？'))return;state={...s,spends:Array.isArray(s.spends)?s.spends:[]};save();render();}catch(err){alert('対応する形式のバックアップを読み込めませんでした');}e.target.value='';};
$('resetBtn').onclick=()=>{if(confirm('仮想データをすべて削除しますか？')){state=empty();save();resetStage();render();}};
choose('depositChoices',depositAmount,x=>depositAmount=x);choose('ticketChoices',ticketAmount,x=>ticketAmount=x);render();
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
