const app=document.querySelector('#app');
const KEY='mitsunoHaccpV2';
const OLD_KEY='mitsunoHaccpV1';
const BEE_KEY='beeManagerV1';
const BRIDGE_KEY='beeHaccpBridgeV1';
const defaultDB={version:2,harvests:[],bottles:[],sales:[],processedBeeRecordIds:[]};
let db=loadDB();
let pendingSelection=[];
let bottleSelection=[];

const harvestChecks=['体調は良い','手洗い・清潔な服装ができている','作業台・作業場所は清潔','採蜜器具は洗浄済みで乾いている','巣蜜にカビ・虫・異常な臭いがない','異物混入のおそれがない','濾過器具は清潔','移し替える容器は清潔で乾いている'];
const harvestSteps=['重箱を準備','巣蜜を取り出す','蜂蜜を採取・濾過','清潔な容器へ移す'];
const bottleChecks=['体調は良い','手洗い・清潔な服装ができている','作業台・作業場所は清潔','瓶と蓋は清潔で乾いており破損がない','瓶詰め器具は清潔','異物混入のおそれがない'];
const bottleSteps=['採蜜ロットの確認','瓶・蓋の準備','清潔な瓶に蜂蜜を詰める','ラベルの貼り付け'];

function loadDB(){
  try{
    const v2=JSON.parse(localStorage.getItem(KEY)||'null');
    if(v2)return normalizeDB(v2);
    const old=JSON.parse(localStorage.getItem(OLD_KEY)||'null');
    if(old){
      const migrated={...defaultDB,harvests:(old.harvests||[]).map((h,i)=>({id:String(h.id||`old-h-${i}`),date:h.date||today(),lot:h.lot||`旧-${i+1}`,kg:h.kg||'',container:'',mixed:false,sourceBeeRecordIds:[],hives:[{id:'',name:h.hive||'不明',beeHarvestDate:h.date||''}],checks:Array.from({length:Number(h.total||harvestChecks.length)},(_,j)=>j<Number(h.ok||0)),steps:[true,true,true,true],memo:h.memo||'',createdAt:Number(h.id||Date.now())})),bottles:(old.bottles||[]).map((b,i)=>({id:String(b.id||`old-b-${i}`),date:b.date||today(),lot:b.lot||`旧P-${i+1}`,srcIds:[],srcLots:[b.src].filter(Boolean),grams:Number(b.grams||300),count:Number(b.count||0),checks:[],memo:'',createdAt:Number(b.id||Date.now())})),sales:old.sales||[],processedBeeRecordIds:[]};
      localStorage.setItem(KEY,JSON.stringify(migrated));return normalizeDB(migrated);
    }
  }catch(e){}
  return JSON.parse(JSON.stringify(defaultDB));
}
function normalizeDB(x){return {version:2,harvests:Array.isArray(x.harvests)?x.harvests:[],bottles:Array.isArray(x.bottles)?x.bottles:[],sales:Array.isArray(x.sales)?x.sales:[],processedBeeRecordIds:Array.isArray(x.processedBeeRecordIds)?x.processedBeeRecordIds.map(String):[]}}
function save(){localStorage.setItem(KEY,JSON.stringify(db))}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function q(id){return document.getElementById(id)}
function today(){const d=new Date(),o=d.getTimezoneOffset();return new Date(d.getTime()-o*60000).toISOString().slice(0,10)}
function fmtDate(s){if(!s)return'-';try{return new Date(s+'T00:00:00').toLocaleDateString('ja-JP')}catch(e){return s}}
function uid(prefix){return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`}
function shell(title,body,sub='採蜜・瓶詰め・HACCP衛生管理'){app.innerHTML=`<div class="brand">小さな蜜の舎</div><div class="hero"><h1>${title}</h1><p>${sub}</p></div>${body}`;window.scrollTo({top:0,behavior:'auto'})}
function nextLot(prefix,date,list){const ymd=(date||today()).replaceAll('-','').slice(2),head=`${prefix}-${ymd}-`;const nums=list.map(x=>String(x.lot||'')).filter(l=>l.startsWith(head)).map(l=>Number(l.slice(head.length))).filter(Number.isFinite);const n=(nums.length?Math.max(...nums):0)+1;return `${head}${String(n).padStart(2,'0')}`}

function readBee(){
  try{
    const bridge=JSON.parse(localStorage.getItem(BRIDGE_KEY)||'null');
    if(bridge&&Array.isArray(bridge.records)&&Array.isArray(bridge.hives))return {records:bridge.records,hives:bridge.hives};
  }catch(e){}
  try{const d=JSON.parse(localStorage.getItem(BEE_KEY)||'null');if(d&&Array.isArray(d.records)&&Array.isArray(d.hives))return d}catch(e){}
  return {records:[],hives:[]};
}
function beePending(){
  const bee=readBee(),done=new Set(db.processedBeeRecordIds.map(String));
  return bee.records.filter(r=>(r.workType||'')==='harvest'&&!done.has(String(r.id))).map(r=>{
    const h=bee.hives.find(x=>String(x.id)===String(r.hiveId))||{};
    return {id:String(r.id),hiveId:String(r.hiveId||''),hiveName:h.name||'名称未設定',place:h.place||'',date:r.date||'',harvestBoxes:Number(r.harvestBoxes||0),harvestBoxTiers:Array.isArray(r.harvestBoxTiers)?r.harvestBoxTiers:[],harvestFlows:Array.isArray(r.harvestFlows)?r.harvestFlows:[],memo:r.memo||''};
  }).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
}
function harvestInitialGrams(h){return Math.max(0,Math.round(Number(h.kg||0)*1000))}
function harvestUsage(hid){let product=0,loss=0;for(const b of db.bottles){if(Array.isArray(b.allocations)){for(const a of b.allocations){if(String(a.harvestId)===String(hid)){product+=Number(a.productGrams||0);loss+=Number(a.lossGrams||0)}}}else if((b.srcIds||[]).map(String).includes(String(hid))){const h=db.harvests.find(x=>String(x.id)===String(hid));product+=harvestInitialGrams(h||{})}}return {product,loss,total:product+loss}}
function harvestRemainingGrams(h){if(h.closed)return 0;return Math.max(0,harvestInitialGrams(h)-harvestUsage(h.id).total)}
function unbottledHarvests(){return db.harvests.filter(h=>harvestRemainingGrams(h)>0)}

function home(){
  const pending=beePending(),waiting=unbottledHarvests();
  shell('HACCP管理',`<div class="grid"><div class="card" onclick="page('harvest')">🍯<b>採蜜</b><small>重箱から蜂蜜を採取</small></div><div class="card" onclick="page('bottle')">🫙<b>瓶詰め</b><small>採蜜後の蜂蜜を製品化</small></div><div class="card" onclick="page('records')">▤<b>記録を見る</b><small>ロット・衛生記録</small></div><div class="card" onclick="page('stock')">📦<b>在庫・販売</b><small>製品本数を管理</small></div></div>
  <h2 class="section">採蜜待ち <span class="badge blue">${pending.length}件</span></h2>${pending.length?pending.slice(0,6).map(r=>pendingCard(r,false)).join(''):'<div class="empty panel">Beeレコードの未処理の採蜜作業はありません。</div>'}${pending.length>6?`<div class="hint">ほか ${pending.length-6}件</div>`:''}
  <h2 class="section">瓶詰め待ち <span class="badge gold">${waiting.length}ロット</span></h2>${waiting.length?waiting.slice(0,6).map(h=>harvestWaitCard(h,false)).join(''):'<div class="empty panel">瓶詰め待ちの採蜜ロットはありません。</div>'}${waiting.length>6?`<div class="hint">ほか ${waiting.length-6}ロット</div>`:''}
  <div class="panel" style="margin-top:20px"><b>現在の記録</b><div class="hint">採蜜 ${db.harvests.length}件 ／ 瓶詰め ${db.bottles.length}件 ／ 販売 ${db.sales.length}件</div></div>`)
}
function pendingCard(r,tap=false){const extra=[r.harvestBoxes?`重箱 ${r.harvestBoxes}箱`:'' ,r.harvestFlows.length?`フローハイブ ${r.harvestFlows.length}基`:'' ].filter(Boolean).join(' ／ ')||'採蜜作業';return `<div class="pending-card ${tap?'tap':''}" ${tap?`onclick="openHarvestWith('${esc(r.id)}')"`:''}><div class="pending-main"><div class="pending-title">🐝 ${esc(r.hiveName)}</div><div class="pending-meta">Beeレコード採蜜日：${esc(fmtDate(r.date))}${r.place?`<br>場所：${esc(r.place)}`:''}<br>${esc(extra)}</div></div></div>`}
function harvestWaitCard(h,tap=false){const names=(h.hives||[]).map(x=>x.name).filter(Boolean).join('・')||'群情報なし',rem=harvestRemainingGrams(h);return `<div class="pending-card ${tap?'tap':''}" ${tap?`onclick="openBottleWith('${esc(h.id)}')"`:''}><div class="pending-main"><div class="pending-title">🍯 ${esc(h.lot)}</div><div class="pending-meta">採蜜日：${esc(fmtDate(h.date))}<br>由来：${esc(names)}<br>残量：約 ${esc(rem)}g${h.kg?` ／ 採蜜時 ${esc(h.kg)}kg`:''}</div></div></div>`}

function harvest(){
  pendingSelection=[];const p=beePending();
  shell('採蜜',`<div class="panel"><b>このアプリでの「採蜜」</b><div class="hint">群から重箱を切り取る作業ではなく、切り取った重箱から蜂蜜を採取・濾過して容器へ移す工程を記録します。</div></div><h2 class="section">Beeレコードから採蜜作業を選ぶ</h2>${p.length?p.map(r=>`<label class="pending-card"><input type="checkbox" class="beePick" value="${esc(r.id)}"><div class="pending-main"><div class="pending-title">🐝 ${esc(r.hiveName)}</div><div class="pending-meta">Beeレコード採蜜日：${esc(fmtDate(r.date))}${r.place?` ／ ${esc(r.place)}`:''}<br>${r.harvestBoxes?`重箱 ${r.harvestBoxes}箱 `:''}${r.harvestBoxTiers.length?`（${r.harvestBoxTiers.join('・')}段目）`:''}${r.harvestFlows.length?` フローハイブ ${r.harvestFlows.length}基`:''}</div></div></label>`).join(''):'<div class="empty panel">未処理の採蜜作業はありません。<br><span class="mini">Beeレコードで「採蜜」を登録すると、ここに表示されます。</span></div>'}${p.length?`<button class="action primary" onclick="startHarvestForm()">選んだ採蜜作業を登録</button>`:''}`)
}
function openHarvestWith(id){page('harvest');requestAnimationFrame(()=>{const el=[...document.querySelectorAll('.beePick')].find(x=>x.value===id);if(el){el.checked=true;startHarvestForm()}})}
function startHarvestForm(){
  const ids=[...document.querySelectorAll('.beePick:checked')].map(x=>x.value);if(!ids.length)return alert('採蜜作業を1件以上選んでください。');
  const source=beePending().filter(r=>ids.includes(r.id));pendingSelection=source;
  shell('採蜜記録',`<div class="panel"><b>選択した群</b><div class="pillline">${source.map(r=>`<span class="badge blue">${esc(r.hiveName)}・${esc(fmtDate(r.date))}</span>`).join('')}</div></div>
  <h2 class="section">採蜜前の衛生チェック</h2>${harvestChecks.map((x,i)=>`<label class="check"><input class="hCk" type="checkbox"><span>${i+1}. ${esc(x)}</span></label>`).join('')}
  <h2 class="section">採蜜工程</h2>${harvestSteps.map((s,i)=>`<label class="step"><input class="stepCk" type="checkbox" style="width:24px;height:24px"><span class="step-num">${i+1}</span><span class="step-text">${esc(s)}</span></label>`).join('')}
  <div class="field"><label>採蜜作業日（重箱から蜜を採取した日）</label><input id="hDate" type="date" value="${today()}"></div>
  <div class="field"><label>採蜜量（kg）</label><input id="hKg" type="number" min="0" step="0.1" placeholder="例：5.2"></div>
  <div class="field"><label>移し替え先の容器・容器番号</label><input id="hContainer" placeholder="例：ステンレス容器1"></div>
  <div class="field"><label>複数群の蜜について</label><select id="hMixed"><option value="auto">選択内容から判断</option><option value="yes">混ざっている</option><option value="no">混ざっていない</option></select><div class="hint">複数の群を同じ容器へ移す場合は「混ざっている」を選択してください。</div></div>
  <div class="field"><label>メモ・異常</label><textarea id="hMemo" rows="4"></textarea></div><button class="action primary" onclick="saveHarvest()">採蜜記録を保存</button>`)
}
function saveHarvest(){
  if(!pendingSelection.length)return alert('Beeレコードの採蜜作業を選び直してください。');
  const steps=[...document.querySelectorAll('.stepCk')].map(x=>x.checked),checks=[...document.querySelectorAll('.hCk')].map(x=>x.checked);if(steps.some(x=>!x))if(!confirm('採蜜工程に未チェックがあります。このまま保存しますか？'))return;
  const date=q('hDate').value||today(),lot=nextLot('H',date,db.harvests),mix=q('hMixed').value;
  const hives=pendingSelection.map(r=>({id:r.hiveId,name:r.hiveName,place:r.place,beeHarvestDate:r.date,harvestBoxes:r.harvestBoxes,harvestBoxTiers:r.harvestBoxTiers,harvestFlows:r.harvestFlows,beeRecordId:r.id}));
  const uniqueHives=new Set(hives.map(x=>x.id||x.name));const mixed=mix==='yes'||(mix==='auto'&&uniqueHives.size>1);
  const rec={id:uid('h'),date,lot,kg:q('hKg').value,container:q('hContainer').value.trim(),mixed,sourceBeeRecordIds:pendingSelection.map(x=>x.id),hives,steps,checks,memo:q('hMemo').value.trim(),createdAt:Date.now()};
  db.harvests.unshift(rec);db.processedBeeRecordIds=[...new Set([...db.processedBeeRecordIds,...rec.sourceBeeRecordIds.map(String)])];save();pendingSelection=[];
  shell('採蜜記録を保存しました',`<div class="card"><small>採蜜ロット</small><div class="lot">${esc(lot)}</div><p>${mixed?'複数群混合':'単一群または非混合'} ／ ${esc(rec.kg||'-')} kg</p><p>由来：${esc(hives.map(x=>x.name).join('・'))}</p><p class="${checks.every(Boolean)?'ok':'danger'}">衛生チェック ${checks.filter(Boolean).length}/${checks.length}</p></div><button class="action primary" onclick="page('home')">ホームへ</button>`)
}

function bottle(){
  bottleSelection=[];const hs=unbottledHarvests();
  shell('瓶詰め',`<div class="panel"><b>瓶詰め待ちの採蜜ロット</b><div class="hint">採蜜日と瓶詰め日が別の日でも、瓶詰め当日の衛生チェックを記録します。複数の採蜜ロットを選んで混ぜることもできます。</div></div><h2 class="section">使用する採蜜ロットを選ぶ</h2>${hs.length?hs.map(h=>`<label class="pending-card"><input type="checkbox" class="lotPick" value="${esc(h.id)}"><div class="pending-main"><div class="pending-title">🍯 ${esc(h.lot)}</div><div class="pending-meta">採蜜日：${esc(fmtDate(h.date))}<br>由来：${esc((h.hives||[]).map(x=>x.name).join('・')||'-')}${h.kg?` ／ 採蜜時 ${esc(h.kg)}kg`:''}<br>残量：約 ${harvestRemainingGrams(h)}g</div></div></label>`).join(''):'<div class="empty panel">瓶詰め待ちの採蜜ロットはありません。</div>'}${hs.length?`<button class="action primary" onclick="startBottleForm()">選んだロットを瓶詰め</button>`:''}`)
}
function openBottleWith(id){page('bottle');requestAnimationFrame(()=>{const el=[...document.querySelectorAll('.lotPick')].find(x=>x.value===id);if(el){el.checked=true;startBottleForm()}})}
function startBottleForm(){
  const ids=[...document.querySelectorAll('.lotPick:checked')].map(x=>x.value);if(!ids.length)return alert('採蜜ロットを1件以上選んでください。');bottleSelection=unbottledHarvests().filter(h=>ids.includes(String(h.id)));
  shell('瓶詰め記録',`<div class="panel"><b>使用する採蜜ロット</b><div class="pillline">${bottleSelection.map(h=>`<span class="badge gold">${esc(h.lot)}（残 ${harvestRemainingGrams(h)}g）</span>`).join('')}</div>${bottleSelection.length>1?'<div class="hint">複数ロットを混ぜる場合は、それぞれから製品に使用する量を入力してください。</div>':''}</div>
  <h2 class="section">瓶詰め前の衛生チェック</h2>${bottleChecks.map((x,i)=>`<label class="check"><input class="bCk" type="checkbox"><span>${i+1}. ${esc(x)}</span></label>`).join('')}
  <h2 class="section">瓶詰めの作業工程</h2>${bottleSteps.map((x,i)=>`<label class="step"><input class="bStepCk" type="checkbox" style="width:24px;height:24px"><span class="step-num">${i+1}</span><span class="step-text">${esc(x)}</span></label>`).join('')}
  <div class="field"><label>瓶詰め日</label><input id="bDate" type="date" value="${today()}"></div><div class="row"><div class="field"><label>内容量（g）</label><input id="bGrams" type="number" value="300" min="1" oninput="updateBottleTotals()"></div><div class="field"><label>本数</label><input id="bCount" type="number" min="1" placeholder="例：5" oninput="updateBottleTotals()"></div></div>
  <div class="panel"><b>採蜜ロットごとの使用量</b><div class="hint">「製品に入った量」の合計が、内容量×本数と同じになるよう入力します。瓶や器具への付着・こぼれはロス量へ入力してください。</div>${bottleSelection.map((h,i)=>`<div class="source-use"><b>${esc(h.lot)}</b><div class="mini">現在残量：約 ${harvestRemainingGrams(h)}g</div><div class="row"><div class="field"><label>製品に使用（g）</label><input class="srcProduct" data-id="${esc(h.id)}" type="number" min="0" step="1" value="${bottleSelection.length===1?'0':''}" oninput="updateBottleTotals()"></div><div class="field"><label>ロス量（g・任意）</label><input class="srcLoss" data-id="${esc(h.id)}" type="number" min="0" step="1" value="0" oninput="updateBottleTotals()"></div></div><label class="check"><input class="srcFinish" data-id="${esc(h.id)}" type="checkbox"><span>この採蜜ロットを今回で使い切った</span></label></div>`).join('')}<div id="bTotal" class="lot">瓶詰め予定量：0g</div></div>
  <div class="field"><label>メモ・異常</label><textarea id="bMemo" rows="4"></textarea></div><button class="action primary" onclick="saveBottle()">瓶詰め記録を保存</button>`);updateBottleTotals()
}
function updateBottleTotals(){const grams=Number(q('bGrams')?.value||0),count=Number(q('bCount')?.value||0),target=grams*count,ps=[...document.querySelectorAll('.srcProduct')];if(ps.length===1&&document.activeElement!==ps[0])ps[0].value=target||0;const product=ps.reduce((a,x)=>a+Number(x.value||0),0),loss=[...document.querySelectorAll('.srcLoss')].reduce((a,x)=>a+Number(x.value||0),0);if(q('bTotal'))q('bTotal').innerHTML=`瓶詰め予定量：${target}g<br><span class="mini">製品使用 ${product}g ／ ロス ${loss}g</span>`}
function saveBottle(){
  if(!bottleSelection.length)return alert('採蜜ロットを選び直してください。');const count=Number(q('bCount').value||0);if(count<=0)return alert('本数を入れてください。');const grams=Number(q('bGrams').value||0);if(grams<=0)return alert('内容量を入れてください。');
  const target=grams*count,products=[...document.querySelectorAll('.srcProduct')],losses=[...document.querySelectorAll('.srcLoss')],finishes=[...document.querySelectorAll('.srcFinish')];const productTotal=products.reduce((a,x)=>a+Number(x.value||0),0);if(Math.abs(productTotal-target)>0.5)return alert(`製品に使用する量の合計を ${target}g にしてください。現在は ${productTotal}g です。`);
  const allocations=bottleSelection.map(h=>{const pe=products.find(x=>x.dataset.id===String(h.id)),le=losses.find(x=>x.dataset.id===String(h.id)),fe=finishes.find(x=>x.dataset.id===String(h.id));const productGrams=Number(pe?.value||0),lossGrams=Number(le?.value||0),before=harvestRemainingGrams(h);return {harvestId:String(h.id),lot:h.lot,productGrams,lossGrams,beforeGrams:before,finish:Boolean(fe?.checked)}});
  try{for(const a of allocations){if(a.productGrams+a.lossGrams>a.beforeGrams+0.5)throw new Error(`${a.lot} の使用量＋ロス量が残量を超えています。`)}}catch(e){return alert(e.message)}
  const steps=[...document.querySelectorAll('.bStepCk')].map(x=>x.checked);if(steps.some(x=>!x)&&!confirm('瓶詰め工程に未チェックがあります。このまま保存しますか？'))return;
  const date=q('bDate').value||today(),lot=nextLot('P',date,db.bottles),checks=[...document.querySelectorAll('.bCk')].map(x=>x.checked),srcIds=bottleSelection.map(x=>String(x.id)),srcLots=bottleSelection.map(x=>x.lot);
  const rec={id:uid('b'),date,lot,srcIds,srcLots,grams,count,allocations,steps,checks,memo:q('bMemo').value.trim(),createdAt:Date.now()};db.bottles.unshift(rec);for(const a of allocations){if(a.finish){const h=db.harvests.find(x=>String(x.id)===a.harvestId);if(h){const after=Math.max(0,a.beforeGrams-a.productGrams-a.lossGrams);a.finalLossGrams=after;h.closed=true;h.closedAt=Date.now()}}}save();bottleSelection=[];
  const loss=allocations.reduce((a,x)=>a+Number(x.lossGrams||0)+Number(x.finalLossGrams||0),0);shell('瓶詰め記録を保存しました',`<div class="card"><small>製品ロット</small><div class="lot">${esc(lot)}</div><p>${grams}g × ${count}本（${target}g）</p><p>採蜜ロット：${esc(srcLots.join(' ＋ '))}</p><p>作業ロス：${loss}g</p><p class="${checks.every(Boolean)?'ok':'danger'}">衛生チェック ${checks.filter(Boolean).length}/${checks.length}</p></div><button class="action primary" onclick="page('home')">ホームへ</button>`)
}

function bottleSoldCount(b){return db.sales.filter(s=>String(s.lot)===String(b.lot)).reduce((n,s)=>n+Number(s.count||0),0)}
function bottleRemainingCount(b){return Math.max(0,Number(b.count||0)-bottleSoldCount(b))}
function bottleRemainingGrams(b){return bottleRemainingCount(b)*Number(b.grams||0)}
function bottleUsesHarvest(b,hid){return Array.isArray(b.allocations)?b.allocations.some(a=>String(a.harvestId)===String(hid)):(b.srcIds||[]).map(String).includes(String(hid))}
function togglePast(id){const el=q(id);if(!el)return;el.hidden=!el.hidden;const btn=q(id+'Btn');if(btn)btn.textContent=el.hidden?btn.dataset.closed:btn.dataset.open}

function records(){
  const allDates=[...db.harvests,...db.bottles,...db.sales].map(x=>x.date).filter(Boolean).sort(),minDate=allDates[0]||today(),maxDate=today();
  const activeH=db.harvests.filter(h=>harvestRemainingGrams(h)>0),pastH=db.harvests.filter(h=>harvestRemainingGrams(h)<=0);
  const activeB=db.bottles.filter(b=>bottleRemainingCount(b)>0),pastB=db.bottles.filter(b=>bottleRemainingCount(b)<=0);
  shell('記録',`<div class="report-filter"><div class="row"><div class="field"><label>開始日</label><input id="rFrom" type="date" value="${esc(minDate)}"></div><div class="field"><label>終了日</label><input id="rTo" type="date" value="${esc(maxDate)}"></div></div><div class="toolbar"><button onclick="exportCSV()">CSVを書き出す</button><button onclick="printReport()">PDF提出用</button></div><div class="hint">「PDF提出用」は印刷画面を開きます。iPhoneでは印刷プレビューから共有・“ファイルに保存”でPDFとして保存できます。</div></div>
  <h2 class="section">採蜜記録</h2>${activeH.length?activeH.map(h=>harvestRecordHtml(h,true)).join(''):'<div class="empty panel">現在残っている採蜜ロットはありません。</div>'}
  <button id="harvestPastBtn" class="record-toggle" data-closed="過去の採蜜記録を見る（${pastH.length}件）" data-open="過去の採蜜記録を閉じる" onclick="togglePast('harvestPast')">過去の採蜜記録を見る（${pastH.length}件）</button><div id="harvestPast" hidden>${pastH.length?pastH.map(h=>harvestRecordHtml(h,false)).join(''):'<div class="empty panel">過去の採蜜記録はありません。</div>'}</div>
  <h2 class="section">瓶詰め記録</h2>${activeB.length?activeB.map(b=>bottleRecordHtml(b,true)).join(''):'<div class="empty panel">現在在庫がある製品ロットはありません。</div>'}
  <button id="bottlePastBtn" class="record-toggle" data-closed="過去の瓶詰め記録を見る（${pastB.length}件）" data-open="過去の瓶詰め記録を閉じる" onclick="togglePast('bottlePast')">過去の瓶詰め記録を見る（${pastB.length}件）</button><div id="bottlePast" hidden>${pastB.length?pastB.map(b=>bottleRecordHtml(b,false)).join(''):'<div class="empty panel">過去の瓶詰め記録はありません。</div>'}</div>
  <h2 class="section">販売記録</h2><button class="record-toggle sales-link" onclick="salesRecords()">販売記録を見る（${db.sales.length}件）</button>`)
}
function harvestRecordHtml(h,active=true){const rem=harvestRemainingGrams(h),used=harvestUsage(h.id);return `<div class="item"><div class="record-head"><div><b>🍯 ${esc(h.lot)}</b><div class="mini">${esc(fmtDate(h.date))} ／ ${h.mixed?'複数群混合':'非混合'}</div></div><span class="remaining ${rem>0?'okbg':'mutedbg'}">残り ${esc(rem)}g</span></div><div class="pillline">${(h.hives||[]).map(x=>`<span class="badge blue">${esc(x.name)}</span>`).join('')}</div><div class="pending-meta">採蜜時：${esc(harvestInitialGrams(h))}g${h.container?` ／ 容器：${esc(h.container)}`:''}<br>瓶詰め使用：${esc(used.product)}g ／ ロス：${esc(used.loss)}g<br>衛生チェック ${(h.checks||[]).filter(Boolean).length}/${(h.checks||[]).length||harvestChecks.length}${h.memo?`<br>メモ：${esc(h.memo)}`:''}</div><button class="delete-btn" onclick="deleteHarvest('${esc(h.id)}')">この採蜜記録を削除</button></div>`}
function bottleRecordHtml(b,active=true){const rem=bottleRemainingCount(b),sold=bottleSoldCount(b);return `<div class="item"><div class="record-head"><div><b>🫙 ${esc(b.lot)}</b><div class="mini">${esc(fmtDate(b.date))}</div></div><span class="remaining ${rem>0?'okbg':'mutedbg'}">残り ${esc(rem)}本${b.grams?`・${esc(bottleRemainingGrams(b))}g`:''}</span></div><div class="pillline">${(b.srcLots||[]).map(x=>`<span class="badge gold">${esc(x)}</span>`).join('')}</div><div class="pending-meta">製造：${esc(b.grams)}g × ${esc(b.count)}本 ／ 販売済み：${esc(sold)}本${Array.isArray(b.allocations)?`<br>使用：${b.allocations.map(a=>`${esc(a.lot)} ${esc(a.productGrams)}g`).join(' ／ ')}<br>ロス：${b.allocations.reduce((n,a)=>n+Number(a.lossGrams||0)+Number(a.finalLossGrams||0),0)}g`:''}<br>衛生チェック ${(b.checks||[]).filter(Boolean).length}/${(b.checks||[]).length||bottleChecks.length}${b.memo?`<br>メモ：${esc(b.memo)}`:''}</div><button class="delete-btn" onclick="deleteBottle('${esc(b.id)}')">この瓶詰め記録を削除</button></div>`}
function saleRecordHtml(s){return `<div class="item"><div class="record-head"><div><b>🧾 ${esc(s.lot||'製品ロット未設定')}</b><div class="mini">${esc(fmtDate(s.date))}</div></div><span class="remaining">${esc(s.count||0)}本</span></div><div class="pending-meta">販売先・注文番号：${esc(s.dest||'-')}</div><button class="delete-btn" onclick="deleteSale('${esc(s.id)}')">この販売記録を削除</button></div>`}
function salesRecords(){shell('販売記録',`${db.sales.length?db.sales.map(s=>saleRecordHtml(s)).join(''):'<div class="empty panel">販売記録はありません。</div>'}<button class="action secondary" onclick="page('records')">記録ページへ戻る</button>`) }

function deleteSale(id){const s=db.sales.find(x=>String(x.id)===String(id));if(!s)return;if(!confirm(`${s.lot||'この製品ロット'} の販売記録 ${s.count||0}本を削除しますか？\n削除すると製品在庫へ戻ります。`))return;db.sales=db.sales.filter(x=>String(x.id)!==String(id));save();salesRecords()}
function deleteBottle(id){const b=db.bottles.find(x=>String(x.id)===String(id));if(!b)return;const related=db.sales.filter(s=>String(s.lot)===String(b.lot));if(related.length)return alert(`この瓶詰めロットには販売記録が ${related.length}件あります。\n先に「販売記録」から関連する販売記録を削除してください。`);if(!confirm(`${b.lot} の瓶詰め記録を削除しますか？\n使用した採蜜ロットの残量は自動で戻ります。`))return;const affected=(Array.isArray(b.allocations)?b.allocations.map(a=>String(a.harvestId)):(b.srcIds||[]).map(String));db.bottles=db.bottles.filter(x=>String(x.id)!==String(id));for(const hid of affected){const h=db.harvests.find(x=>String(x.id)===hid);if(!h)continue;const stillClosed=db.bottles.some(x=>Array.isArray(x.allocations)&&x.allocations.some(a=>String(a.harvestId)===hid&&a.finish));h.closed=stillClosed;if(stillClosed){h.closedAt=h.closedAt||Date.now()}else{delete h.closedAt}}save();records()}
function deleteHarvest(id){const h=db.harvests.find(x=>String(x.id)===String(id));if(!h)return;const related=db.bottles.filter(b=>bottleUsesHarvest(b,id));if(related.length)return alert(`この採蜜ロットは瓶詰め記録で使用されています。\n先に関連する瓶詰めロット（${related.map(x=>x.lot).join('・')}）を削除してください。`);if(!confirm(`${h.lot} の採蜜記録を削除しますか？\nBeeレコード由来の採蜜作業は「採蜜待ち」に戻ります。`))return;db.harvests=db.harvests.filter(x=>String(x.id)!==String(id));const src=new Set((h.sourceBeeRecordIds||[]).map(String));db.processedBeeRecordIds=db.processedBeeRecordIds.filter(x=>!src.has(String(x)));save();records()}

function reportRange(){const from=q('rFrom')?.value||'0000-00-00',to=q('rTo')?.value||'9999-99-99';return {from,to,harvests:db.harvests.filter(x=>x.date>=from&&x.date<=to),bottles:db.bottles.filter(x=>x.date>=from&&x.date<=to),sales:db.sales.filter(x=>(x.date||'')>=from&&(x.date||'')<=to)}}
function exportCSV(){
  const r=reportRange(),rows=[['区分','日付','ロット','由来群/採蜜ロット/販売先','採蜜量kg/内容量g','本数','残量','衛生チェック','メモ']];
  r.harvests.forEach(h=>rows.push(['採蜜',h.date,h.lot,(h.hives||[]).map(x=>x.name).join('・'),h.kg||'', '',`${harvestRemainingGrams(h)}g`,`${(h.checks||[]).filter(Boolean).length}/${(h.checks||[]).length}`,h.memo||'']));
  r.bottles.forEach(b=>rows.push(['瓶詰め',b.date,b.lot,(b.srcLots||[]).join('＋'),b.grams||'',b.count||'',`${bottleRemainingCount(b)}本`,`${(b.checks||[]).filter(Boolean).length}/${(b.checks||[]).length}`,b.memo||'']));
  r.sales.forEach(s=>rows.push(['販売',s.date||'',s.lot||'',s.dest||'','',s.count||'','','','']));
  const csv='\ufeff'+rows.map(row=>row.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\r\n');downloadText(csv,`小さな蜜の舎_HACCP記録_${r.from}_${r.to}.csv`,'text/csv;charset=utf-8');
}
async function downloadText(text,name,type){try{const file=new File([text],name,{type});if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:name});return}}catch(e){if(e?.name==='AbortError')return}const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function printReport(){
  const r=reportRange(),w=window.open('','_blank');if(!w)return alert('印刷画面を開けませんでした。Safariのポップアップ設定を確認してください。');
  const rowsH=r.harvests.map(h=>`<tr><td>${esc(h.date)}</td><td>${esc(h.lot)}</td><td>${esc((h.hives||[]).map(x=>x.name).join('・'))}</td><td>${esc(h.kg||'-')}</td><td>${esc(harvestRemainingGrams(h))}g</td><td>${(h.checks||[]).filter(Boolean).length}/${(h.checks||[]).length}</td><td>${esc(h.memo||'')}</td></tr>`).join('')||'<tr><td colspan="7">記録なし</td></tr>';
  const rowsB=r.bottles.map(b=>`<tr><td>${esc(b.date)}</td><td>${esc(b.lot)}</td><td>${esc((b.srcLots||[]).join('＋'))}</td><td>${esc(b.grams)}g</td><td>${esc(b.count)}</td><td>${esc(bottleRemainingCount(b))}本</td><td>${esc(b.memo||'')}</td></tr>`).join('')||'<tr><td colspan="7">記録なし</td></tr>';
  const rowsS=r.sales.map(s=>`<tr><td>${esc(s.date||'')}</td><td>${esc(s.lot||'')}</td><td>${esc(s.count||0)}本</td><td>${esc(s.dest||'')}</td></tr>`).join('')||'<tr><td colspan="4">記録なし</td></tr>';
  w.document.write(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>小さな蜜の舎 HACCP衛生管理記録</title><style>body{font-family:-apple-system,'Hiragino Sans','Yu Gothic',sans-serif;color:#222;padding:24px}h1{font-size:22px}h2{font-size:16px;margin-top:26px}p{font-size:12px}table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #888;padding:5px;vertical-align:top}th{background:#eee}@media print{body{padding:0}}</style></head><body><h1>小さな蜜の舎 HACCP衛生管理記録</h1><p>対象期間：${esc(r.from)} ～ ${esc(r.to)}</p><h2>採蜜記録</h2><table><thead><tr><th>日付</th><th>採蜜ロット</th><th>由来群</th><th>採蜜量kg</th><th>残量</th><th>衛生</th><th>メモ</th></tr></thead><tbody>${rowsH}</tbody></table><h2>瓶詰め記録</h2><table><thead><tr><th>日付</th><th>製品ロット</th><th>採蜜ロット</th><th>内容量</th><th>製造本数</th><th>残り本数</th><th>メモ</th></tr></thead><tbody>${rowsB}</tbody></table><h2>販売記録</h2><table><thead><tr><th>日付</th><th>製品ロット</th><th>販売本数</th><th>販売先・注文番号</th></tr></thead><tbody>${rowsS}</tbody></table><script>setTimeout(()=>window.print(),300)<\/script></body></html>`);w.document.close();
}

function stock(){const made=db.bottles.reduce((a,x)=>a+Number(x.count||0),0),sold=db.sales.reduce((a,x)=>a+Number(x.count||0),0),left=Math.max(0,made-sold),available=db.bottles.filter(b=>bottleRemainingCount(b)>0);let opts=available.map(x=>`<option value="${esc(x.lot)}">${esc(x.lot)}（残り ${esc(bottleRemainingCount(x))}本）</option>`).join('');shell('在庫・販売',`<div class="summary"><div class="panel"><span class="mini">製造</span><strong>${made}</strong>本</div><div class="panel"><span class="mini">販売</span><strong>${sold}</strong>本</div><div class="panel"><span class="mini">残り</span><strong>${left}</strong>本</div></div><h2 class="section">販売を記録</h2>${available.length?`<div class="field"><label>製品ロット</label><select id="saleLot">${opts}</select></div><div class="field"><label>販売本数</label><input id="saleCount" type="number" min="1"></div><div class="field"><label>販売先・注文番号</label><input id="dest" placeholder="例：BASE #1234"></div><button class="action primary" onclick="saveSale()">販売を保存</button>`:'<div class="empty panel">販売できる製品ロットがありません。</div>'}`)}
function saveSale(){const lot=q('saleLot')?.value,count=Number(q('saleCount')?.value||0);if(!lot)return alert('販売できる製品ロットがありません。');if(count<=0)return alert('販売本数を入れてください。');const b=db.bottles.find(x=>String(x.lot)===String(lot));if(!b)return alert('製品ロットが見つかりません。');const rem=bottleRemainingCount(b);if(count>rem)return alert(`この製品ロットの残りは ${rem}本です。販売本数を確認してください。`);db.sales.unshift({id:uid('s'),date:today(),lot,count,dest:q('dest').value.trim(),createdAt:Date.now()});save();stock()}

function page(p){({home,harvest,bottle,records,stock}[p]||home)()}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>page(b.dataset.page));
window.addEventListener('storage',e=>{if(e.key===BEE_KEY||e.key===BRIDGE_KEY){if(document.visibilityState==='visible')home()}});
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js');
home();
