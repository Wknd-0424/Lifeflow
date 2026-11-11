const $ = s => document.querySelector(s);
const groups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const pages = { dashboard: 'Overview', inventory: 'Blood inventory', requests: 'Hospital requests', expiry: 'Expiry monitor', reports: 'Reports' };
let state, page = 'dashboard', formType, busy = false;
let expiryWindow = 7, checkerGroup = 'O+', checkerUnits = 1;
const escape = v => String(v).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const date = v => new Date(v + 'T00:00:00').toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
const days = v => Math.round((new Date(v) - new Date(state.today)) / 86400000);
const pill = v => `<span class="pill ${v.toLowerCase()}">${escape(v)}</span>`;
const status = b => b.units === 0 ? 'Depleted' : b.expires < state.today ? 'Expired' : days(b.expires) <= 7 ? 'Expiring' : 'Available';
const empty = text => `<div class="empty">${text}</div>`;
async function api(url, body) {
  const response = await fetch(url, body === undefined ? {} : { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Unable to reach the server.');
  return result;
}
let toastTimer;
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4500); }
function heading(title, description, actions = true, hero = false) {
  return `<div class="page-heading${hero ? ' dashboard-hero' : ''}">${hero ? '<canvas class="hero-particles" aria-hidden="true"></canvas>' : ''}<div><span class="eyebrow">CONNECTED BY CARE</span><h1>${title}</h1><p class="subtitle">${description}</p></div>${actions ? '<div class="actions"><button class="button secondary" data-modal="request">↗ &nbsp; New request</button><button class="button primary" data-modal="donation">＋ &nbsp; Add donation</button></div>' : ''}</div>`;
}
function stats() {
  return `<div class="stats-grid">${[
    ['Total available units',state.stats.available,'units','Ready to make a difference','positive','♧',''],
    ['Hospital requests',state.stats.pending,'pending','Awaiting allocation','','⇄','red'],
    ['Expiring this week',state.stats.expiring,'units','Prioritize these for dispatch','','◷','amber'],
    ['Units dispatched',state.stats.fulfilled,'units','From fulfilled hospital requests','positive','✓','']
  ].map(([label,value,unit,note,cls,icon,color])=>`<div class="stat"><div class="stat-label">${label}</div><span class="stat-icon ${color}">${icon}</span><div class="stat-value">${value}<small>${unit}</small></div><div class="stat-note ${cls}">${note}</div></div>`).join('')}</div>`;
}
function dashboardWidgets() {
  const healthy=state.stock.filter(s=>s.units>=10).length;
  const percentage=Math.round(healthy/8*100);
  return `<div class="widget-grid">
    <section class="glass-widget health-widget"><div class="widget-heading"><span class="widget-kicker">INVENTORY PULSE</span><span class="widget-badge">Live</span></div><h2>Stock health</h2><div class="health-content"><div class="health-ring"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="ring-track" cx="60" cy="60" r="49"/><circle class="ring-value" cx="60" cy="60" r="49" stroke-dasharray="307.88" stroke-dashoffset="${307.88*(1-percentage/100)}"/></svg><div><strong>${percentage}<small>%</small></strong><span>groups ready</span></div></div><div class="health-copy"><strong>${healthy} of 8 groups</strong><p>have at least 10 units</p><div class="health-dots" aria-label="${healthy} blood groups have sufficient stock">${state.stock.map(s=>`<span class="health-dot ${s.units>=10?'ready':''}" title="${s.group}: ${s.units} units"></span>`).join('')}</div><button class="text-button" data-page="inventory">Explore inventory ↗</button></div></div><div class="widget-foot">${8-healthy} groups below the low-stock threshold</div></section>
    <section class="glass-widget checker-widget"><div class="widget-heading"><span class="widget-kicker">QUICK CHECK</span><span class="widget-glyph">↔</span></div><h2>Find a match</h2><p class="widget-description">Check exact-group stock before requesting.</p><div class="checker-fields"><label>Blood group<select id="checker-group">${groups.map(g=>`<option ${g===checkerGroup?'selected':''}>${g}</option>`).join('')}</select></label><label>Units needed<input id="checker-units" type="number" min="1" max="1000" step="1" value="${checkerUnits}"></label></div><output id="checker-result" class="checker-result" aria-live="polite"></output><button class="widget-link" data-checker-request>Create hospital request <span>↗</span></button></section>
    <section class="glass-widget forecast-widget"><div class="widget-heading"><span class="widget-kicker">EXPIRY FORECAST</span><div class="segmented" role="group" aria-label="Forecast period"><button data-window="7" aria-pressed="${expiryWindow===7}">7 days</button><button data-window="14" aria-pressed="${expiryWindow===14}">14 days</button></div></div><h2>Stay one step ahead</h2><div id="forecast-content">${forecastMarkup()}</div><button class="widget-link" data-page="expiry">Open expiry monitor <span>↗</span></button></section>
  </div>`;
}
function forecastMarkup() {
  const totals=Array.from({length:expiryWindow},(_,i)=>state.batches.filter(b=>days(b.expires)===i).reduce((sum,b)=>sum+b.units,0));
  const max=Math.max(1,...totals);
  return `<p class="widget-description"><strong>${totals.reduce((s,n)=>s+n,0)} units</strong> expiring over the next ${expiryWindow} days</p><div class="forecast-chart"><svg viewBox="0 0 280 78" role="img" aria-label="Units expiring by day: ${totals.map((n,i)=>`day ${i+1}: ${n}`).join(', ')}"><line x1="0" y1="73" x2="280" y2="73" class="chart-baseline"/>${totals.map((n,i)=>`<rect x="${i*280/expiryWindow+3}" y="${73-Math.max(n/max*62,3)}" width="${280/expiryWindow-6}" height="${Math.max(n/max*62,3)}" rx="4" class="forecast-bar ${n?'':'zero'}"><title>${date(new Date(new Date(state.today).getTime()+i*86400000).toISOString().slice(0,10))}: ${n} units</title></rect>`).join('')}</svg><div class="chart-labels"><span>Today</span><span>Next ${expiryWindow} days →</span></div></div>`;
}
function updateChecker() {
  if(!$('#checker-result'))return;
  checkerGroup=$('#checker-group').value;checkerUnits=Number($('#checker-units').value);
  const units=state.stock.find(s=>s.group===checkerGroup).units;
  const valid=Number.isInteger(checkerUnits)&&checkerUnits>=1&&checkerUnits<=1000;
  const ready=valid&&units>=checkerUnits;
  $('#checker-result').classList.toggle('shortfall',!ready);
  $('#checker-result').textContent=!valid?'Enter a whole number from 1 to 1000.':ready?`✓ ${units} units available · Ready to request`:`↗ ${units} available · ${checkerUnits-units} more needed`;
}
const stockCapacity = 40; // Dashboard display capacity per blood group.

function stockWave(units, index) {
  if (!units) return "";
  const level = Math.min(units / stockCapacity, 1) * 100;
  return `<svg class="stock-wave" aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none"><defs><linearGradient id="stock-fill-${index}" x2="0" y2="1"><stop stop-color="#FF2A54" stop-opacity=".10"/><stop offset="1" stop-color="#E63946" stop-opacity=".30"/></linearGradient></defs><path transform="translate(0 ${100 - level})" fill="url(#stock-fill-${index})" d="M0 2 Q25 -3 50 2 T100 2 V104 H0Z"/></svg>`;
}

function stockPanel() {
  return `<section class="panel"><div class="panel-header"><div><h2>Blood stock at a glance</h2><p>Available, unexpired units across all blood groups</p></div><div class="legend"><span><i class="dot"></i> Sufficient</span><span><i class="dot low"></i> Low stock &lt; 10</span></div></div><div class="blood-grid">${state.stock.map((s,index)=>`<div class="blood-card ${s.units<10?'low':''}">${stockWave(s.units,index)}<div class="blood-type"><strong>${s.group}</strong></div><div class="number">${s.units}</div><div class="unit-label">units available</div><progress class="stock-meter" value="${s.units}" max="${stockCapacity}" aria-label="${s.group} stock level">${s.units}</progress><div class="stock-status">${s.units===0?'Out of stock':s.units<10?'Low stock':'Sufficient stock'}</div></div>`).join('')}</div></section>`;
}
function requestTable(requests, compact = false) {
  if (!requests.length) return empty('No requests match this view.');
  return `<div class="table-wrap"><table><thead><tr><th>HOSPITAL / REQUEST</th><th>GROUP</th><th>UNITS</th><th>PRIORITY</th>${compact?'':'<th>STATUS</th>'}<th>ACTION</th></tr></thead><tbody>${requests.map(r=>`<tr><td><div class="hospital-name">${escape(r.hospital)}</div><div class="cell-sub">REQ-${String(r.id).padStart(3,'0')} · ${escape(r.contact)}</div></td><td><span class="group-label">${r.blood_group}</span></td><td>${r.units}</td><td>${r.priority === 'Urgent' && r.status === 'Pending' ? '<span class="pill urgent animate-vital"><i class="urgent-dot" aria-hidden="true"></i>Urgent</span>' : pill(r.priority)}</td>${compact?'':`<td>${pill(r.status)}</td>`}<td>${r.status==='Pending'?`<button class="table-action" data-fulfill="${r.id}">Fulfill ↗</button>${compact?'':`<button class="table-action cancel" data-cancel="${r.id}">Cancel</button>`}`:'<span class="cell-sub">Processed</span>'}</td></tr>`).join('')}</tbody></table></div>`;
}
function expiryPanel() {
  const expiring=state.batches.filter(b=>b.units>0 && days(b.expires)>=0 && days(b.expires)<=7).slice(0,4);
  return `<section class="panel"><div class="panel-header"><div><h2>Use soon, save more</h2><p>Units approaching their expiry date</p></div><span class="pill expiring">Next 7 days</span></div><div class="expiry-list">${expiring.length?expiring.map(b=>`<div class="expiry-row"><div class="expiry-group">${b.blood_group}</div><div class="expiry-detail">${b.units} units available<small>Batch B-${String(b.id).padStart(3,'0')}</small></div><div class="expiry-days">${days(b.expires)===0?'Today':`${days(b.expires)} days left`}<small>${date(b.expires)}</small></div></div>`).join(''):empty('No units expiring this week.')}</div><div class="notice">◷ &nbsp; First expiry, first out. Earlier-expiring batches are automatically allocated first.</div></section>`;
}
function activityPanel() {
  return `<section class="panel"><div class="panel-header"><div><h2>Recent activity</h2><p>A pulse on your blood bank</p></div><span class="cell-sub">Latest updates</span></div><div class="activity">${state.activity.map(a=>`<div class="activity-row"><span class="activity-symbol">${a.kind==='donation'?'+':a.kind==='dispatch'?'↗':'↔'}</span><div class="activity-copy">${escape(a.description)}</div><time class="activity-time">${new Date(a.created.replace(' ','T')+'Z').toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</time></div>`).join('')}</div></section>`;
}
function batchTable(batches) {
  if(!batches.length)return empty('No blood batches match your filters.');
  return `<div class="table-wrap"><table><thead><tr><th>BATCH / SOURCE</th><th>GROUP</th><th>UNITS</th><th>COLLECTED</th><th>EXPIRY DATE</th><th>STATUS</th></tr></thead><tbody>${batches.map(b=>`<tr><td><div class="hospital-name">B-${String(b.id).padStart(3,'0')}</div><div class="cell-sub">${escape(b.donor)}</div></td><td><span class="group-label">${b.blood_group}</span></td><td>${b.units}</td><td>${date(b.collected)}</td><td>${date(b.expires)}</td><td>${pill(status(b))}</td></tr>`).join('')}</tbody></table></div>`;
}
function toolbar(type) {
  return `<div class="toolbar"><input id="search" type="search" aria-label="Search ${type}" placeholder="Search ${type==='requests'?'hospital or contact':'batch or donor'}…"><select id="group-filter" aria-label="Filter blood group"><option value="">All blood groups</option>${groups.map(g=>`<option>${g}</option>`).join('')}</select><select id="status-filter" aria-label="Filter status"><option value="">All statuses</option>${(type==='requests'?['Pending','Fulfilled','Cancelled']:['Available','Expiring','Expired','Depleted']).map(s=>`<option>${s}</option>`).join('')}</select></div>`;
}
function reportPage() {
  return heading('Reports & insights','A clear picture of your inventory and hospital dispatches.',false)+stats()+`<div class="report-grid"><section class="panel"><div class="panel-header"><h2>Inventory by blood group</h2><button class="text-button" data-export="inventory">Export CSV ↓</button></div>${state.stock.map(s=>`<div class="report-row"><span>${s.group}</span><strong>${s.units} available units</strong></div>`).join('')}</section><section class="panel"><div class="panel-header"><h2>Request summary</h2><button class="text-button" data-export="requests">Export CSV ↓</button></div>${['Pending','Fulfilled','Cancelled'].map(s=>`<div class="report-row"><span>${s}</span><strong>${state.requests.filter(r=>r.status===s).length} requests</strong></div>`).join('')}<div class="report-row"><span>Expired stock (excluded from availability)</span><strong>${state.stats.expired} units</strong></div><p class="report-note">Allocation uses exact blood-group matching and first-expiry-first-out order. Expiry dates are entered from blood bag labels. This project uses sample data for educational demonstration.</p></section></div>`+activityPanel();
}
function render() {
  $('#breadcrumb').textContent=pages[page];
  $('#nav-count').textContent=state.stats.pending;
  document.querySelectorAll('[data-page]').forEach(b=>{b.classList.toggle('active',b.dataset.page===page);if(b.dataset.page===page)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  if(page==='dashboard') $('#main').innerHTML=`<div class="dashboard-layout"><div class="dashboard-feature">`+heading('A little care. A lot of life.','Your blood bank at a glance. Every unit is a possibility.',true,true)+`<section class="panel dashboard-requests"><div class="panel-header"><div><h2>Pending hospital requests <span class="pill pending">${state.stats.pending}</span></h2><p>Connect available blood with those who need it</p></div><button class="text-button" data-page="requests">View all →</button></div>${requestTable(state.requests.filter(r=>r.status==='Pending').sort((a,b)=>(b.priority==='Urgent')-(a.priority==='Urgent')||a.id-b.id).slice(0,4),true)}<div class="panel-footer">Exact blood-group matching · Unexpired stock only</div></section>${activityPanel()}</div><div class="dashboard-metrics">${stats()}${dashboardWidgets()}${stockPanel()}${expiryPanel()}</div></div>`;
  if(page==='inventory') $('#main').innerHTML=heading('Blood inventory','Track every batch, from donation to dispatch.')+stockPanel()+`<section class="panel"><div class="panel-header"><div><h2>All blood batches</h2><p>Live remaining quantities, collection dates and expiry status</p></div><button class="text-button" data-export="inventory">Export CSV ↓</button></div>${toolbar('inventory')}<div id="table-content">${batchTable(state.batches)}</div></section>`;
  if(page==='requests') $('#main').innerHTML=heading('Hospital requests','Manage hospital needs and allocate available blood.')+`<div class="alert-strip">Fulfillment allocates the earliest-expiring, unexpired batches of the requested blood group. Requests are fulfilled in full; insufficient stock leaves the request pending.</div><section class="panel"><div class="panel-header"><h2>All requests</h2><button class="text-button" data-export="requests">Export CSV ↓</button></div>${toolbar('requests')}<div id="table-content">${requestTable(state.requests)}</div></section>`;
  if(page==='expiry') $('#main').innerHTML=heading('Expiry monitor','Keep a close watch on time-sensitive stock.',false)+`<div class="alert-strip">${state.stats.expiring} units expire within 7 days. ${state.stats.expired} expired units are excluded from available stock and cannot be allocated.</div><div class="section-grid"><section class="panel"><div class="panel-header"><h2>Expiry watchlist</h2></div>${batchTable(state.batches.filter(b=>b.units>0 && days(b.expires)<=7))}</section>${expiryPanel()}</div>`;
  if(page==='reports') $('#main').innerHTML=reportPage();
  if(page==='dashboard') { updateChecker();$('#checker-group').addEventListener('change',updateChecker);$('#checker-units').addEventListener('input',updateChecker); }
  if($('#search')) { $('#search').addEventListener('input',filter);$('#group-filter').addEventListener('change',filter);$('#status-filter').addEventListener('change',filter); }
}
function filter() {
  const q=$('#search').value.toLowerCase().trim(), g=$('#group-filter').value, s=$('#status-filter').value;
  if(page==='requests') $('#table-content').innerHTML=requestTable(state.requests.filter(r=>(!g||r.blood_group===g)&&(!s||r.status===s)&&`${r.hospital} ${r.contact} REQ-${String(r.id).padStart(3,'0')}`.toLowerCase().includes(q)));
  else $('#table-content').innerHTML=batchTable(state.batches.filter(b=>(!g||b.blood_group===g)&&(!s||status(b)===s)&&`${b.donor} B-${String(b.id).padStart(3,'0')}`.toLowerCase().includes(q)));
}
function field(label,name,type='text',extra='') {return `<div class="field"><label for="field-${name}">${label}</label><input id="field-${name}" name="${name}" type="${type}" required ${extra}></div>`;}
function openForm(type) {
  formType=type; $('#form-error').textContent='';$('#entry-form').reset();$('#modal-title').textContent=type==='donation'?'Record a donation':'New hospital request';
  const groupSelect=`<div class="field"><label for="field-group">Blood group</label><select id="field-group" name="blood_group" required><option value="">Select group</option>${groups.map(g=>`<option>${g}</option>`).join('')}</select></div>`;
  $('#form-fields').innerHTML=(type==='donation'?field('Donor / donation source','donor','text','maxlength="120" placeholder="e.g. Campus donation drive"'):field('Hospital name','hospital','text','maxlength="120" placeholder="e.g. City General Hospital"')+field('Contact person / department','contact','text','maxlength="120" placeholder="e.g. Dr. Kumar, Emergency desk"'))+`<div class="field-row">${groupSelect}${field('Number of units','units','number','min="1" max="1000" step="1" placeholder="1"')}</div>`+(type==='donation'?`<div class="field-row">${field('Collection date','collected','date',`max="${state.today}" value="${state.today}"`)}${field('Expiry date','expires','date',`min="${state.today}"`)}</div><p class="form-hint">Enter the expiry date printed on the blood bag label. One unit represents one labelled donation unit.</p>`:`<div class="field"><label for="field-priority">Priority</label><select id="field-priority" name="priority"><option>Normal</option><option>Urgent</option></select></div><p class="form-hint">Submitting a request does not reserve stock. Fulfill it from the requests page when ready to dispatch.</p>`);
  $('#save-button').textContent=type==='donation'?'Save donation':'Create request';$('#entry-dialog').showModal();
}
function exportCsv(type) {
  const rows=type==='inventory'?[['Batch ID','Source','Blood group','Units remaining','Collected','Expires','Status'],...state.batches.map(b=>[b.id,b.donor,b.blood_group,b.units,b.collected,b.expires,status(b)])]:[['Request ID','Hospital','Contact','Blood group','Units','Priority','Status','Created UTC'],...state.requests.map(r=>[r.id,r.hospital,r.contact,r.blood_group,r.units,r.priority,r.status,r.created])];
  const csv='\uFEFF'+rows.map(row=>row.map(v=>{let str=String(v);if(/^[=+\-@\t\r]/.test(str))str="'"+str;return '"'+str.replace(/"/g,'""')+'"';}).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`lifeflow-${type}-${state.today}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('CSV report exported.');
}
document.addEventListener('click',async e=>{
  const period=e.target.closest('[data-window]');if(period){expiryWindow=Number(period.dataset.window);$('#forecast-content').innerHTML=forecastMarkup();document.querySelectorAll('[data-window]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.window)===expiryWindow)));}
  if(e.target.closest('[data-checker-request]')){updateChecker();if(!Number.isInteger(checkerUnits)||checkerUnits<1||checkerUnits>1000)return;openForm('request');$('#field-group').value=checkerGroup;$('#field-units').value=checkerUnits;}
  const nav=e.target.closest('[data-page]'); if(nav&&state){page=nav.dataset.page;render();window.scrollTo(0,0);}
  const modal=e.target.closest('[data-modal]');if(modal&&state)openForm(modal.dataset.modal);
  const exp=e.target.closest('[data-export]');if(exp)exportCsv(exp.dataset.export);
  const action=e.target.closest('[data-fulfill],[data-cancel]');if(!action||busy)return;
  const fulfill=action.hasAttribute('data-fulfill'),id=Number(fulfill?action.dataset.fulfill:action.dataset.cancel);
  if(!confirm(fulfill?'Fulfill this request and deduct the allocated units from inventory?':'Cancel this hospital request?'))return;
  busy=true;action.disabled=true;
  try{state=await api(`/api/requests/${id}/${fulfill?'fulfill':'cancel'}`,{});render();toast(fulfill?'Request fulfilled. Inventory updated.':'Request cancelled.');}catch(err){toast(err.message);}finally{busy=false;action.disabled=false;}
});
$('#close-dialog').onclick=$('#cancel-dialog').onclick=()=>$('#entry-dialog').close();
$('#entry-form').addEventListener('submit',async e=>{
  e.preventDefault();if(busy)return;const body=Object.fromEntries(new FormData(e.target));body.units=Number(body.units);busy=true;$('#save-button').disabled=true;$('#form-error').textContent='';
  try{state=await api(formType==='donation'?'/api/batches':'/api/requests',body);$('#entry-dialog').close();render();toast(formType==='donation'?'Donation saved. Stock updated.':'Hospital request created.');}catch(err){$('#form-error').textContent=err.message;}finally{busy=false;$('#save-button').disabled=false;}
});
$('#current-date').textContent=new Date().toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
async function initialize(){try{state=await api('/api/state');render();}catch(err){$('#main').innerHTML=empty(`${escape(err.message)} <button class="text-button" id="retry">Try again</button>`);$('#retry').onclick=initialize;}}
initialize();

const spotlightCards = '.stat, .panel, .glass-widget, .blood-card';
const spotlightPreference = matchMedia('(any-hover: hover) and (prefers-reduced-motion: no-preference)');
let spotlightCard = null;

function clearSpotlight() {
  spotlightCard?.removeAttribute('data-spotlight');
  spotlightCard = null;
}

document.addEventListener('pointermove', (event) => {
  if (!spotlightPreference.matches || event.pointerType === 'touch') return;

  const card = event.target.closest(spotlightCards);
  if (card !== spotlightCard) {
    clearSpotlight();
    spotlightCard = card;
  }
  if (!card) return;

  const bounds = card.getBoundingClientRect();
  card.style.setProperty('--spotlight-x', `${event.clientX - bounds.left}px`);
  card.style.setProperty('--spotlight-y', `${event.clientY - bounds.top}px`);
  card.setAttribute('data-spotlight', '');
});

document.addEventListener('pointerout', (event) => {
  if (!(event.relatedTarget instanceof Element) ||
      event.relatedTarget.closest(spotlightCards) !== spotlightCard) {
    clearSpotlight();
  }
});
document.addEventListener('pointercancel', clearSpotlight);
window.addEventListener('blur', clearSpotlight);
spotlightPreference.addEventListener('change', clearSpotlight);
