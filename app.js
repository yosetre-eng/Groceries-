import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  initializeFirestore, persistentLocalCache, getFirestore,
  collection, addDoc, onSnapshot, updateDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy, writeBatch, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { PRODUCTS, matchProduct } from "./products-db.js";

const firebaseConfig = {
  apiKey: "AIzaSyBiDsbdwu31UOLXl8E-3bweMAWB8_K6Ph0",
  authDomain: "groceries-b1f9f.firebaseapp.com",
  projectId: "groceries-b1f9f",
  storageBucket: "groceries-b1f9f.firebasestorage.app",
  messagingSenderId: "935993344640",
  appId: "1:935993344640:web:a6388852f042201aa41c65"
};

export const DEFAULT_CATEGORIES = [
  { id:"produce",  label:"ירקות ופירות",        icon:"🥬", color:"#8FBF6B" },
  { id:"dairy",    label:"מוצרי חלב וביצים",     icon:"🧀", color:"#E8D9A0" },
  { id:"meat",     label:"בשר עוף ודגים",        icon:"🍗", color:"#D9776B" },
  { id:"bakery",   label:"מאפים ולחם",           icon:"🍞", color:"#D9A441" },
  { id:"frozen",   label:"קפואים",               icon:"❄️", color:"#7EC8D9" },
  { id:"cans",     label:"שימורים ורטבים",       icon:"🥫", color:"#C98F5E" },
  { id:"dry",      label:"אורז, פסטה וקטניות",   icon:"🍚", color:"#C9B26E" },
  { id:"spices",   label:"תבלינים ואפייה",       icon:"🧂", color:"#B98CD9" },
  { id:"snacks",   label:"חטיפים וממתקים",       icon:"🍫", color:"#D97AA0" },
  { id:"drinks",   label:"משקאות",               icon:"🥤", color:"#6BB8D9" },
  { id:"clean",    label:"ניקיון",               icon:"🧽", color:"#7FA5A0" },
  { id:"toiletry", label:"טואלטיקה וקוסמטיקה",   icon:"🧴", color:"#A0A6D9" },
  { id:"other",    label:"שונות",                icon:"📦", color:"#9AA79E" },
];
const catMap = Object.fromEntries(DEFAULT_CATEGORIES.map(c => [c.id, c]));

let app, db;
try {
  app = initializeApp(firebaseConfig);
  try { db = initializeFirestore(app, { localCache: persistentLocalCache() }); }
  catch (e) { db = getFirestore(app); }
} catch (e) { console.error("Firebase init failed", e); }

/* ---------- status (click to reload/reconnect) ---------- */
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
function setStatus(ok, text){ statusDot.classList.toggle('off', !ok); statusText.textContent = text; }
document.getElementById('status').onclick = () => location.reload();

/* ---------- profile ---------- */
let profile = localStorage.getItem('shopping_profile') || 'יוסף';
const pYosef = document.getElementById('profileYosef');
const pAgam = document.getElementById('profileAgam');
function renderProfile(){
  pYosef.classList.toggle('active', profile === 'יוסף');
  pAgam.classList.toggle('active', profile === 'אגם');
}
pYosef.onclick = () => { profile='יוסף'; localStorage.setItem('shopping_profile', profile); renderProfile(); render(); };
pAgam.onclick = () => { profile='אגם'; localStorage.setItem('shopping_profile', profile); renderProfile(); render(); };
renderProfile();

/* ---------- local UI state ---------- */
let shoppingModeOn = localStorage.getItem('shopping_mode') === '1';
let viewFilter = localStorage.getItem('view_filter') || 'all';
let collapsedCats = new Set(JSON.parse(localStorage.getItem('collapsed_cats') || '[]'));
document.body.classList.toggle('shopping-mode', shoppingModeOn);

const toggleShoppingBtn = document.getElementById('toggleShopping');
const toggleViewBtn = document.getElementById('toggleView');
function syncToggleButtons(){
  toggleShoppingBtn.classList.toggle('toggled', shoppingModeOn);
  toggleViewBtn.classList.toggle('toggled', viewFilter === 'mine');
  toggleViewBtn.textContent = viewFilter === 'mine' ? '👤' : '👁';
}
syncToggleButtons();

toggleShoppingBtn.onclick = () => {
  shoppingModeOn = !shoppingModeOn;
  localStorage.setItem('shopping_mode', shoppingModeOn ? '1' : '0');
  document.body.classList.toggle('shopping-mode', shoppingModeOn);
  syncToggleButtons();
  if (shoppingModeOn) requestWakeLock(); else releaseWakeLock();
  render();
};
toggleViewBtn.onclick = () => {
  viewFilter = viewFilter === 'mine' ? 'all' : 'mine';
  localStorage.setItem('view_filter', viewFilter);
  syncToggleButtons();
  render();
};

/* ---------- wake lock ---------- */
let wakeLockRef = null;
async function requestWakeLock(){
  try { if ('wakeLock' in navigator) wakeLockRef = await navigator.wakeLock.request('screen'); }
  catch (e) { console.warn('wakeLock failed', e); }
}
function releaseWakeLock(){ try { wakeLockRef?.release?.(); } catch(e){} wakeLockRef = null; }
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && shoppingModeOn) requestWakeLock();
});
if (shoppingModeOn) requestWakeLock();

/* ---------- toast with undo ---------- */
const toastEl = document.getElementById('toast');
const toastMsg = document.getElementById('toastMsg');
const toastUndo = document.getElementById('toastUndo');
let toastTimer = null;
function showToast(message, undoFn){
  toastMsg.textContent = message;
  toastUndo.style.display = undoFn ? 'block' : 'none';
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 5000);
  toastUndo.onclick = () => { toastEl.classList.remove('show'); clearTimeout(toastTimer); if (undoFn) undoFn(); };
}

/* ---------- confetti ---------- */
const confettiCanvas = document.getElementById('confettiCanvas');
const ctx = confettiCanvas.getContext('2d');
function resizeConfetti(){ confettiCanvas.width = innerWidth; confettiCanvas.height = innerHeight; }
resizeConfetti();
window.addEventListener('resize', resizeConfetti);
const CONFETTI_COLORS = ['#D9A441','#7FA57A','#C0533E','#7EC8D9','#D97AA0','#F2EFE6'];
function burstConfetti(){
  const particles = [];
  const count = 90;
  for (let i = 0; i < count; i++) {
    particles.push({
      x: confettiCanvas.width / 2, y: confettiCanvas.height * 0.3,
      vx: (Math.random() - 0.5) * 12, vy: Math.random() * -10 - 4,
      size: Math.random() * 6 + 4, color: CONFETTI_COLORS[Math.floor(Math.random()*CONFETTI_COLORS.length)],
      rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3, life: 100
    });
  }
  let frame = 0;
  function tick(){
    frame++;
    ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    let alive = false;
    for (const p of particles) {
      if (p.life <= 0) continue;
      p.vy += 0.35; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life--;
      if (p.life > 0) alive = true;
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color; ctx.globalAlpha = Math.min(1, p.life / 30);
      ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size*0.6);
      ctx.restore();
    }
    if (alive && frame < 160) requestAnimationFrame(tick);
    else ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  }
  tick();
}

/* ---------- category order (shared) ---------- */
let categoryOrder = DEFAULT_CATEGORIES.map(c => c.id);
const catOrderRef = db ? doc(db, 'meta', 'categoryOrder') : null;
if (catOrderRef) {
  onSnapshot(catOrderRef, snap => {
    if (snap.exists() && Array.isArray(snap.data().order) && snap.data().order.length) categoryOrder = snap.data().order;
    render();
  });
}
async function moveCategory(id, dir){
  const idx = categoryOrder.indexOf(id);
  const swapWith = idx + dir;
  if (idx < 0 || swapWith < 0 || swapWith >= categoryOrder.length) return;
  const next = categoryOrder.slice();
  [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
  categoryOrder = next;
  render();
  try { await setDoc(catOrderRef, { order: next }); } catch(e){ console.error(e); }
}

/* ---------- category assignment ---------- */
let categoryAssignments = {};
const catAssignRef = db ? doc(db, 'meta', 'categoryAssignments') : null;
if (catAssignRef) {
  onSnapshot(catAssignRef, snap => { categoryAssignments = snap.exists() ? snap.data() : {}; render(); });
}
async function cycleAssignment(id){
  const current = categoryAssignments[id] || null;
  const next = !current ? 'יוסף' : (current === 'יוסף' ? 'אגם' : null);
  categoryAssignments = { ...categoryAssignments, [id]: next };
  render();
  try { await setDoc(catAssignRef, { [id]: next }, { merge:true }); } catch(e){ console.error(e); }
}

/* ---------- product autocomplete + qty stepper + voice + barcode ---------- */
const productList = document.getElementById('productList');
productList.innerHTML = PRODUCTS.map(p => `<option value="${p.name}"></option>`).join('');
const catSelect = document.getElementById('itemCategory');
catSelect.innerHTML = DEFAULT_CATEGORIES.map(c => `<option value="${c.id}">${c.icon} ${c.label}</option>`).join('');

const nameInput = document.getElementById('itemName');
const priceHint = document.getElementById('priceHint');
let currentQty = 1;
const qtyDisplay = document.getElementById('qtyDisplay');
document.getElementById('qtyMinus').onclick = () => { currentQty = Math.max(1, currentQty - 1); qtyDisplay.textContent = currentQty; };
document.getElementById('qtyPlus').onclick = () => { currentQty += 1; qtyDisplay.textContent = currentQty; };

nameInput.addEventListener('input', () => {
  const m = matchProduct(nameInput.value);
  if (m) { catSelect.value = m.category; priceHint.textContent = `≈ ₪${m.price} / ${m.unit}`; }
  else { priceHint.textContent = ''; }
});
document.getElementById('addBtn').onclick = () => {
  addItem(nameInput.value, catSelect.value, currentQty, 'manual');
  currentQty = 1; qtyDisplay.textContent = 1;
};
nameInput.addEventListener('keydown', e => { if(e.key === 'Enter') document.getElementById('addBtn').click(); });

const micBtn = document.getElementById('micBtn');
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  micBtn.style.display = 'flex';
  const recognizer = new SpeechRecognition();
  recognizer.lang = 'he-IL'; recognizer.interimResults = false; recognizer.maxAlternatives = 1;
  let listening = false;
  micBtn.onclick = () => {
    if (listening) { recognizer.stop(); return; }
    try { recognizer.start(); listening = true; micBtn.classList.add('listening'); } catch(e){ console.error(e); }
  };
  recognizer.onresult = (e) => {
    nameInput.value = e.results[0][0].transcript;
    nameInput.dispatchEvent(new Event('input'));
    nameInput.focus();
  };
  recognizer.onend = () => { listening = false; micBtn.classList.remove('listening'); };
  recognizer.onerror = () => { listening = false; micBtn.classList.remove('listening'); };
}

/* barcode scanner (real product lookup via Open Food Facts public API) */
const scanBtn = document.getElementById('scanBtn');
const scannerModal = document.getElementById('scannerModal');
const scannerVideo = document.getElementById('scannerVideo');
const scanHint = document.getElementById('scanHint');
let scanStream = null, scanning = false;
if ('BarcodeDetector' in window) {
  scanBtn.style.display = 'flex';
  scanBtn.onclick = openScanner;
  document.getElementById('closeScanner').onclick = closeScanner;
} 
async function openScanner(){
  scannerModal.classList.add('open');
  scanHint.textContent = 'כוונו את המצלמה לברקוד המוצר';
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    scannerVideo.srcObject = scanStream;
    const detector = new window.BarcodeDetector({ formats: ['ean_13','ean_8','upc_a','upc_e'] });
    scanning = true;
    const loop = async () => {
      if (!scanning) return;
      try {
        const codes = await detector.detect(scannerVideo);
        if (codes.length) { scanning = false; await handleBarcode(codes[0].rawValue); return; }
      } catch(e) { /* frame not ready yet */ }
      requestAnimationFrame(loop);
    };
    loop();
  } catch(e) {
    scanHint.textContent = 'לא ניתן לגשת למצלמה — בדקו הרשאות בדפדפן.';
  }
}
function closeScanner(){
  scanning = false;
  scannerModal.classList.remove('open');
  if (scanStream) { scanStream.getTracks().forEach(t => t.stop()); scanStream = null; }
}
async function handleBarcode(code){
  scanHint.textContent = 'מחפש מוצר...';
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json`);
    const data = await res.json();
    if (data.status === 1 && data.product) {
      const name = data.product.product_name_he || data.product.product_name || data.product.generic_name || code;
      nameInput.value = name;
      nameInput.dispatchEvent(new Event('input'));
      showToast(`נמצא: ${name}`);
    } else {
      showToast('המוצר לא נמצא במאגר — הזינו ידנית');
      nameInput.focus();
    }
  } catch(e) {
    showToast('שגיאה בחיפוש המוצר');
  }
  closeScanner();
}

async function addItem(rawName, category, qtyVal, source){
  const name = (rawName || '').trim();
  if(!name || !db) return;
  const match = matchProduct(name);
  const qty = qtyVal ? Number(qtyVal) : 1;
  try{
    await addDoc(collection(db, 'items'), {
      name: match ? match.name : name,
      category: category || (match ? match.category : 'other'),
      qty, unit: match ? match.unit : null, price: match ? match.price : null,
      done:false, unavailable:false, addedBy:profile, source: source || 'manual',
      createdAt: serverTimestamp()
    });
    nameInput.value = ''; priceHint.textContent = '';
  }catch(e){ console.error(e); setStatus(false, 'שגיאה בשמירה'); }
}

/* mini floating add (shopping mode) */
const fabAdd = document.getElementById('fabAdd');
const miniAdd = document.getElementById('miniAdd');
const miniAddInput = document.getElementById('miniAddInput');
fabAdd.onclick = () => { miniAdd.classList.add('open'); miniAddInput.focus(); };
document.getElementById('miniAddBtn').onclick = () => { addItem(miniAddInput.value, null, 1, 'manual'); miniAddInput.value = ''; miniAdd.classList.remove('open'); };
miniAddInput.addEventListener('keydown', e => { if(e.key === 'Enter') document.getElementById('miniAddBtn').click(); });

/* ---------- live items ---------- */
const listEl = document.getElementById('list');
const quickAddEl = document.getElementById('quickAdd');
const celebrationEl = document.getElementById('celebration');
let items = [];
let historyDocs = [];
let firstLoad = true;
let wasComplete = false;

if(db){
  onSnapshot(query(collection(db, 'items'), orderBy('createdAt', 'asc')), snap => {
    items = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    setStatus(true, 'מסונכרן');
    firstLoad = false;
    render();
  }, err => { console.error(err); setStatus(false, 'אין חיבור — לחצו לרענון'); });

  onSnapshot(collection(db, 'history'), snap => {
    historyDocs = snap.docs.map(d => d.data());
    renderQuickAdd();
    renderStats();
  }, err => console.error(err));
}

/** סופר פריטים גם מהיסטוריית "נקנה ונוקה מהרשימה" וגם מקבלות סרוקות - כדי שסריקת קבלה תשפיע גם על הסטטיסטיקה */
function aggregatedPurchaseCounts(){
  const counts = {};
  for (const h of historyDocs) { const key = (h.name || '').trim(); if (key) counts[key] = (counts[key] || 0) + 1; }
  for (const r of receipts) { for (const it of (r.items || [])) { const key = (it.name || '').trim(); if (key) counts[key] = (counts[key] || 0) + 1; } }
  return counts;
}

function renderQuickAdd(){
  const counts = aggregatedPurchaseCounts();
  const activeNames = new Set(items.map(i => (i.name||'').trim().toLowerCase()));
  const top = Object.entries(counts)
    .filter(([name]) => !activeNames.has(name.toLowerCase()))
    .sort((a,b) => b[1]-a[1]).slice(0, 8);
  if(!top.length){ quickAddEl.innerHTML = ''; quickAddEl.style.display='none'; return; }
  quickAddEl.style.display = 'flex';
  quickAddEl.innerHTML = top.map(([name]) => `<div class="qa-chip" data-qa="${escapeHtml(name)}">+ ${escapeHtml(name)}</div>`).join('');
}

function render(){
  const totalCount = items.length;
  const doneCount = items.filter(i => i.done).length;
  document.getElementById('totalCount').textContent = totalCount;
  document.getElementById('doneCount').textContent = doneCount;
  const pct = totalCount ? (doneCount/totalCount)*100 : 0;
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('cartRider').style.left = pct + '%';

  const budget = items.reduce((sum, i) => sum + (i.price ? i.price * (i.qty||1) : 0), 0);
  document.getElementById('budgetText').textContent = budget > 0 ? `≈ ₪${budget.toFixed(0)}` : '—';

  const isComplete = totalCount > 0 && doneCount === totalCount;
  if (isComplete && !wasComplete) burstConfetti();
  wasComplete = isComplete;

  if(totalCount === 0){
    listEl.innerHTML = `<div class="empty"><span class="big">📝</span>הרשימה ריקה כרגע.<br>הוסיפו את הדבר הראשון שחסר בבית!</div>`;
    celebrationEl.classList.remove('show');
    return;
  }

  let working = items.slice();
  if (shoppingModeOn) working = working.filter(i => !i.done);

  const byCat = {};
  for(const it of working){
    const c = it.category && catMap[it.category] ? it.category : 'other';
    (byCat[c] = byCat[c] || []).push(it);
  }

  let order = categoryOrder.filter(id => byCat[id]?.length);
  if (viewFilter === 'mine') order = order.filter(id => { const a = categoryAssignments[id]; return !a || a === profile; });

  if (order.length === 0) {
    if (shoppingModeOn && isComplete) { listEl.innerHTML = ''; celebrationEl.classList.add('show'); }
    else { listEl.innerHTML = `<div class="empty"><span class="big">✅</span>אין פריטים להצגה כרגע.</div>`; celebrationEl.classList.remove('show'); }
    return;
  }
  celebrationEl.classList.remove('show');

  listEl.innerHTML = order.map((id, idx) => {
    const c = catMap[id];
    const collapsed = collapsedCats.has(id);
    const catItems = byCat[id].slice().sort((a,b) => (a.done === b.done) ? 0 : (a.done ? 1 : -1));
    const openCount = catItems.filter(i => !i.done).length;
    const assign = categoryAssignments[id];
    const assignLabel = assign ? `👤 ${assign}` : '👤 לא משויך';
    return `
      <div class="category ${collapsed ? 'collapsed' : ''}" data-cat="${id}">
        <div class="cat-head" style="--cat-color:${c.color}">
          <span class="collapse-arrow">▾</span>
          <span class="cat-icon">${c.icon}</span>
          <span class="cat-title">${c.label}</span>
          <span class="cat-count">${openCount} לקנייה</span>
          <button class="assign-tag" data-assign="${id}">${assignLabel}</button>
          <div class="reorder">
            <button class="reorder-btn" data-up="${id}" ${idx===0?'disabled':''}>▲</button>
            <button class="reorder-btn" data-down="${id}" ${idx===order.length-1?'disabled':''}>▼</button>
          </div>
        </div>
        <div class="cat-items"><div class="cat-items-inner">${catItems.map(itemRow).join('')}</div></div>
      </div>`;
  }).join('');
}

function itemRow(it){
  const qtyBadge = it.qty && it.qty > 1 ? `<span class="item-qty">×${it.qty}</span>` : '';
  const priceBadge = it.price ? `<span class="item-qty">₪${(it.price*(it.qty||1)).toFixed(0)}</span>` : '';
  const unavailTag = it.unavailable ? `<span class="unavail-tag">⚠ חסר בסניף</span>` : '';
  return `
    <div class="item-wrap" data-id="${it.id}">
      <div class="swipe-bg"></div>
      <div class="item ${it.done ? 'done':''} ${it.unavailable ? 'unavail':''}">
        <div class="check ${it.done?'done':''}" data-check="${it.id}" data-doneval="${!it.done}">${it.done ? '✓' : ''}</div>
        <div class="item-name">${escapeHtml(it.name)}</div>
        ${unavailTag}${qtyBadge}${priceBadge}
        <div class="item-who">${it.addedBy || ''}</div>
        <button class="del" data-del="${it.id}">✕</button>
      </div>
    </div>`;
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

async function toggleDone(id, val){ if(!db) return; try{ await updateDoc(doc(db, 'items', id), { done: val }); } catch(e){ console.error(e); } }
async function toggleUnavailable(id){
  if(!db) return;
  const it = items.find(i => i.id === id);
  if(!it) return;
  try{ await updateDoc(doc(db, 'items', id), { unavailable: !it.unavailable }); } catch(e){ console.error(e); }
}
async function removeItemWithUndo(id, cachedItem){
  if(!db || !cachedItem) return;
  try{ await deleteDoc(doc(db, 'items', id)); } catch(e){ console.error(e); return; }
  showToast(`"${cachedItem.name}" נמחק`, async () => {
    try {
      await addDoc(collection(db, 'items'), {
        name: cachedItem.name, category: cachedItem.category, qty: cachedItem.qty||1,
        unit: cachedItem.unit||null, price: cachedItem.price||null,
        done:false, unavailable:false, addedBy:profile, source:'undo', createdAt: serverTimestamp()
      });
    } catch(e){ console.error(e); }
  });
}

document.getElementById('clearBtn').onclick = async () => {
  if(!db) return;
  const doneItems = items.filter(i => i.done);
  if(doneItems.length === 0) return;
  try{
    const batch = writeBatch(db);
    doneItems.forEach(i => {
      const hRef = doc(collection(db, 'history'));
      batch.set(hRef, { name:i.name, category:i.category, qty:i.qty||1, price:i.price||null, purchasedBy:profile, purchasedAt: serverTimestamp() });
      batch.delete(doc(db, 'items', i.id));
    });
    await batch.commit();
  }catch(e){ console.error(e); }
};

/* ---------- delegated events ---------- */
listEl.addEventListener('click', (e) => {
  const checkEl = e.target.closest('[data-check]');
  if(checkEl){ toggleDone(checkEl.dataset.check, checkEl.dataset.doneval==='true'); return; }
  const delEl = e.target.closest('[data-del]');
  if(delEl){ const it = items.find(i=>i.id===delEl.dataset.del); removeItemWithUndo(delEl.dataset.del, it); return; }
  const upEl = e.target.closest('[data-up]');
  if(upEl){ moveCategory(upEl.dataset.up, -1); return; }
  const downEl = e.target.closest('[data-down]');
  if(downEl){ moveCategory(downEl.dataset.down, 1); return; }
  const assignEl = e.target.closest('[data-assign]');
  if(assignEl){ cycleAssignment(assignEl.dataset.assign); return; }
  const head = e.target.closest('.cat-head');
  if(head){
    const catEl = head.closest('.category');
    const id = catEl.dataset.cat;
    if(collapsedCats.has(id)) collapsedCats.delete(id); else collapsedCats.add(id);
    localStorage.setItem('collapsed_cats', JSON.stringify([...collapsedCats]));
    catEl.classList.toggle('collapsed');
  }
});
quickAddEl.addEventListener('click', (e) => { const el = e.target.closest('[data-qa]'); if(el) addItem(el.dataset.qa, null, 1, 'quick'); });

/* ---------- swipe gestures + long-press ---------- */
let drag = null;
listEl.addEventListener('pointerdown', (e) => {
  const wrap = e.target.closest('.item-wrap');
  if(!wrap || e.target.closest('[data-check],[data-del]')) return;
  const itemEl = wrap.querySelector('.item');
  const bg = wrap.querySelector('.swipe-bg');
  drag = { id: wrap.dataset.id, itemEl, bg, startX:e.clientX, startY:e.clientY, dx:0, dragging:false };
  drag.timer = setTimeout(() => {
    if(drag && !drag.dragging){ if(navigator.vibrate) navigator.vibrate(30); toggleUnavailable(drag.id); }
  }, 550);
});
listEl.addEventListener('pointermove', (e) => {
  if(!drag) return;
  const dx = e.clientX - drag.startX;
  const dy = e.clientY - drag.startY;
  if(!drag.dragging){
    if(Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)){ drag.dragging = true; clearTimeout(drag.timer); }
    else if(Math.abs(dy) > 12){ clearTimeout(drag.timer); drag = null; return; }
  }
  if(drag && drag.dragging){
    drag.dx = dx;
    const clamped = Math.max(-140, Math.min(140, dx));
    drag.itemEl.style.transition = 'none';
    drag.itemEl.style.transform = `translateX(${clamped}px)`;
    if(dx > 10){ drag.bg.style.background = 'var(--leaf)'; drag.bg.textContent = '✓ נקנה'; drag.bg.style.opacity = Math.min(1, dx/90); }
    else if(dx < -10){ drag.bg.style.background = 'var(--danger)'; drag.bg.textContent = '🗑 מחיקה'; drag.bg.style.opacity = Math.min(1, -dx/90); }
    else { drag.bg.style.opacity = 0; }
  }
});
window.addEventListener('pointerup', () => {
  if(!drag) return;
  clearTimeout(drag.timer);
  if(drag.dragging){
    const dx = drag.dx, id = drag.id;
    if(dx > 90){ drag.itemEl.style.transition = 'transform .2s ease'; drag.itemEl.style.transform = 'translateX(400px)'; setTimeout(() => toggleDone(id, true), 150); }
    else if(dx < -90){ const cached = items.find(i => i.id === id); drag.itemEl.style.transition = 'transform .2s ease'; drag.itemEl.style.transform = 'translateX(-400px)'; setTimeout(() => removeItemWithUndo(id, cached), 150); }
    else { drag.itemEl.style.transition = 'transform .2s ease'; drag.itemEl.style.transform = 'translateX(0)'; drag.bg.style.opacity = 0; }
  }
  drag = null;
});

/* ---------- recipe parser ---------- */
const UNIT_WORDS = ['גרם','ג\'','ק"ג','קג','מ"ל','מל','ליטר','כוס','כוסות','כפית','כפיות','כפות','כף','יחידות','יחידה','חבילה','חבילות','קופסה','קופסאות'];
function parseRecipeText(text){
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  return lines.map(line => {
    let working = line.replace(/^[-•*]\s*/, '');
    const qtyMatch = working.match(/^(\d+(\.\d+)?(\/\d+)?)\s*/);
    let qty = 1;
    if(qtyMatch){ qty = parseFloat(qtyMatch[1]) || 1; working = working.slice(qtyMatch[0].length); }
    for(const u of UNIT_WORDS){
      const re = new RegExp(`^${u}\\s+(של\\s+)?`);
      if(re.test(working)){ working = working.replace(re, ''); break; }
    }
    working = working.trim();
    const match = matchProduct(working);
    return { raw: line, name: match ? match.name : working, category: match ? match.category : 'other', unit: match ? match.unit : null, price: match ? match.price : null, qty };
  }).filter(r => r.name);
}
const recipeModal = document.getElementById('recipeModal');
document.getElementById('openRecipe').onclick = () => { recipeModal.classList.add('open'); document.getElementById('recipePreview').innerHTML=''; document.getElementById('confirmRecipeBtn').style.display='none'; };
document.getElementById('closeRecipe').onclick = () => recipeModal.classList.remove('open');
document.getElementById('parseRecipeBtn').onclick = () => {
  const text = document.getElementById('recipeText').value;
  const parsed = parseRecipeText(text);
  const preview = document.getElementById('recipePreview');
  if(!parsed.length){ preview.innerHTML = '<div class="empty">לא זוהו רכיבים. נסו לפרק לשורות, שורה לכל רכיב.</div>'; return; }
  preview.innerHTML = parsed.map((p, i) => `<label class="recipe-row"><input type="checkbox" checked data-idx="${i}"><span>${escapeHtml(p.name)}</span><span class="item-qty">×${p.qty}${p.unit ? ' · '+p.unit : ''}</span></label>`).join('');
  preview.dataset.parsed = JSON.stringify(parsed);
  document.getElementById('confirmRecipeBtn').style.display = 'block';
};
document.getElementById('confirmRecipeBtn').onclick = async () => {
  const preview = document.getElementById('recipePreview');
  const parsed = JSON.parse(preview.dataset.parsed || '[]');
  const checks = preview.querySelectorAll('input[type=checkbox]');
  for(const cb of checks){ if(!cb.checked) continue; const p = parsed[Number(cb.dataset.idx)]; await addItem(p.name, p.category, p.qty, 'recipe'); }
  recipeModal.classList.remove('open');
};

/* ---------- stats + CSV export + price comparison (tabs) ---------- */
const statsModal = document.getElementById('statsModal');
document.getElementById('openStats').onclick = () => { statsModal.classList.add('open'); switchStatsTab('most'); };
document.getElementById('closeStats').onclick = () => statsModal.classList.remove('open');
document.getElementById('tabMostBought').onclick = () => switchStatsTab('most');
document.getElementById('tabPriceCompare').onclick = () => switchStatsTab('compare');
function switchStatsTab(which){
  document.getElementById('tabMostBought').classList.toggle('active', which==='most');
  document.getElementById('tabPriceCompare').classList.toggle('active', which==='compare');
  document.getElementById('statsBody').style.display = which==='most' ? 'block':'none';
  document.getElementById('priceCompareBody').style.display = which==='compare' ? 'block':'none';
  if(which==='most') renderStats(); else renderPriceCompare();
}
function renderStats(){
  const box = document.getElementById('statsBody');
  const counts = aggregatedPurchaseCounts();
  if(!Object.keys(counts).length){ box.innerHTML = '<div class="empty">עדיין אין נתונים.<br>ברגע שתסמנו ותנקו פריטים, או שתסרקו קבלה, הנתונים יופיעו כאן.</div>'; return; }
  const top = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0, 10);
  const max = top[0]?.[1] || 1;
  box.innerHTML = top.map(([name, count]) => `<div class="stat-row"><div class="stat-label">${escapeHtml(name)}</div><div class="stat-track"><div class="stat-fill" style="width:${(count/max)*100}%"></div></div><div class="stat-count">${count}</div></div>`).join('');
}
document.getElementById('exportCsvBtn').onclick = () => {
  if(!historyDocs.length){ showToast('אין עדיין היסטוריה לייצוא'); return; }
  const rows = [['שם','קטגוריה','כמות','מחיר','נקנה על ידי']];
  for(const h of historyDocs) rows.push([h.name||'', catMap[h.category]?.label || h.category || '', h.qty||1, h.price||'', h.purchasedBy||'']);
  const csv = '\uFEFF' + rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `היסטוריית-קניות-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
};

/* ---------- templates ---------- */
let templates = [];
const templatesModal = document.getElementById('templatesModal');
document.getElementById('openTemplates').onclick = () => { templatesModal.classList.add('open'); renderTemplates(); };
document.getElementById('closeTemplates').onclick = () => templatesModal.classList.remove('open');
if (db) {
  onSnapshot(collection(db, 'templates'), snap => { templates = snap.docs.map(d => ({ id:d.id, ...d.data() })); renderTemplates(); });
}
document.getElementById('saveTemplateBtn').onclick = async () => {
  const openItems = items.filter(i => !i.done);
  if (!openItems.length) { showToast('אין פריטים פתוחים לשמירה'); return; }
  const name = prompt('שם לתבנית (למשל: קניות שבוע):');
  if (!name) return;
  try {
    await addDoc(collection(db, 'templates'), {
      name, createdAt: serverTimestamp(),
      items: openItems.map(i => ({ name:i.name, category:i.category, qty:i.qty||1, unit:i.unit||null, price:i.price||null }))
    });
    showToast('התבנית נשמרה');
  } catch(e){ console.error(e); }
};
function renderTemplates(){
  const box = document.getElementById('templatesList');
  if (!templates.length) { box.innerHTML = '<div class="empty">אין תבניות שמורות עדיין.</div>'; return; }
  box.innerHTML = templates.map(t => `
    <div class="template-row">
      <span class="t-name">${escapeHtml(t.name)}</span>
      <span class="t-count">${(t.items||[]).length} פריטים</span>
      <button data-load="${t.id}">טענו</button>
      <button class="t-del" data-deltpl="${t.id}">✕</button>
    </div>`).join('');
}
document.getElementById('templatesList').addEventListener('click', async (e) => {
  const loadEl = e.target.closest('[data-load]');
  if (loadEl) {
    const t = templates.find(x => x.id === loadEl.dataset.load);
    if (t) { for (const it of t.items) await addItem(it.name, it.category, it.qty, 'template'); showToast(`נטענה תבנית "${t.name}"`); templatesModal.classList.remove('open'); }
    return;
  }
  const delEl = e.target.closest('[data-deltpl]');
  if (delEl) { try { await deleteDoc(doc(db, 'templates', delEl.dataset.deltpl)); } catch(err){ console.error(err); } }
});

/* ---------- receipt scanning (on-device OCR via Tesseract.js) + price comparison ---------- */
let receipts = [];
if (db) { onSnapshot(collection(db, 'receipts'), snap => { receipts = snap.docs.map(d => ({ id:d.id, ...d.data() })); renderQuickAdd(); renderStats(); }); }

function loadScript(src){
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = () => resolve(); s.onerror = () => reject(new Error('script load failed'));
    document.head.appendChild(s);
  });
}
async function ensureTesseract(){
  if (window.Tesseract) return;
  await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js');
}

async function ensurePdfJs(){
  if (window.pdfjsLib) return;
  const mod = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/legacy/build/pdf.min.mjs');
  window.pdfjsLib = mod;
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/legacy/build/pdf.worker.min.mjs';
}

/** מחלץ טקסט אמיתי מה-PDF (קבלה דיגיטלית), ומשחזר שבירות שורה לפי מיקום אנכי (Y) של כל קטע טקסט -
 *  כי pdf.js לא מחזיר שבירות שורה מובנות, רק רשימת קטעי טקסט עם קואורדינטות. בלי זה כל העמוד
 *  היה הופך לשורה אחת ארוכה, מה שהרס את מבנה "שם/ברקוד/מחיר" שהפרסר מזהה. */
async function extractPdfText(file){
  await ensurePdfJs();
  const buf = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let lastY = null;
    let line = '';
    for (const item of content.items) {
      const y = item.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        if (line.trim()) fullText += line.trim() + '\n';
        line = '';
      }
      line += item.str + ' ';
      lastY = y;
    }
    if (line.trim()) fullText += line.trim() + '\n';
  }
  return { text: fullText, pdf };
}

/** גיבוי: אם ל-PDF אין שכבת טקסט (קובץ סרוק כתמונה), מרנדרים את העמוד הראשון לתמונה ומריצים OCR עליה. */
async function ocrPdfFirstPage(pdf){
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width; canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  await ensureTesseract();
  const worker = await window.Tesseract.createWorker('heb+eng');
  const { data:{ text } } = await worker.recognize(canvas.toDataURL('image/png'));
  await worker.terminate();
  return text;
}

const STORE_NAMES = ['שופרסל','רמי לוי','קרפור','carrefour','ויקטורי','victory','יינות ביתן','טיב טעם','אושר עד','חצי חינם','מגה בעיר','מגה','yellow','am:pm','סופר פארם','super-pharm','היפר כהן','זול ובגדול','פרש מרקט'];
const RECEIPT_SKIP = /(סה"?כ|סהכ|total|לתשלום|עודף|מזומן|אשראי|תודה|receipt|קבלה|עוסק|מס\s*עוסק|ח\.פ|טלפון|כתובת|תאריך|שעה|קופה|קופאי|invoice|תשלום|מע"?מ|עגלה|פריטים|כמות|מספר\s*(קבלה|קופה|עסקה|הזמנה|עסק)|מס\.?\s*כספית|תוכנה|UID|RRN|ATC|TVR|AID|שובר|עסקה|סכום\s*עיסקה|מטבע|verified|עותק\s*ללקוח|ולהתראות|VISA|MAX|CTL|EMV|רגיל)/i;

/** מנתח קבלה דיגיטלית שבה כל פריט מופיע כשלוש שורות: שם, ברקוד/קוד פריט (שורת ספרות בלבד), ואז שורת כמות/מחיר. */
function parseReceiptTableFormat(lines){
  const items = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/^\d{4,14}$/.test(lines[i])) continue; // שורת ברקוד/קוד = עוגן (חלק מהמוצרים משתמשים בקוד פנימי קצר של 4 ספרות)
    let nameLine = lines[i - 1];
    if (!nameLine || /^\d+$/.test(nameLine) || RECEIPT_SKIP.test(nameLine)) continue;
    nameLine = nameLine.replace(/^\*+\s*/, '').trim(); // הסרת סימוני "**" שמסמנים מבצע

    let priceInfo = null;
    for (let j = i + 1; j <= Math.min(i + 2, lines.length - 1); j++) {
      const l = lines[j];
      const weightMatch = l.match(/(\d+(?:\.\d+)?)\s*ק"?ג\s*x\s*(\d+(?:\.\d+)?)\s*₪\s*(\d+(?:\.\d+)?)/);
      if (weightMatch) { priceInfo = { qty: parseFloat(weightMatch[1]) || 1, price: parseFloat(weightMatch[3]) }; break; }
      const unitMatch = l.match(/₪\s*(\d+(?:\.\d+)?)\s*(\d+)?\s*$/);
      if (unitMatch) { priceInfo = { qty: unitMatch[2] ? parseInt(unitMatch[2]) : 1, price: parseFloat(unitMatch[1]) }; break; }
    }
    if (!priceInfo || !priceInfo.price || priceInfo.price <= 0 || priceInfo.price > 2000) continue;

    const match = matchProduct(nameLine);
    items.push({ raw: nameLine, name: match ? match.name : nameLine, category: match ? match.category : 'other', price: priceInfo.price, qty: priceInfo.qty });
  }
  return items;
}

/** גיבוי: פורמט פשוט יותר של שורה אחת לפריט "שם .... מחיר" (נפוץ בקבלות מצולמות/OCR) */
function parseReceiptSingleLineFormat(lines){
  const items = [];
  for (const line of lines) {
    if (RECEIPT_SKIP.test(line)) continue;
    const m = line.match(/^(.{2,40}?)[\s.]{1,}(\d{1,4}[.,]\d{2})\s*(₪|ש"ח)?\s*$/);
    if (!m) continue;
    let name = m[1].replace(/[.\-_*]{2,}/g, ' ').replace(/\s{2,}/g, ' ').trim();
    let price = parseFloat(m[2].replace(',', '.'));
    if (!name || price <= 0 || price > 800 || /^\d+$/.test(name)) continue;
    const match = matchProduct(name);
    items.push({ raw: line, name: match ? match.name : name, category: match ? match.category : 'other', price, qty: 1 });
  }
  return items;
}

function parseReceipt(text){
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  let store = null;
  for (const line of lines.slice(0, 15)) {
    const found = STORE_NAMES.find(s => line.toLowerCase().includes(s.toLowerCase()));
    if (found) { store = found; break; }
  }
  if (!store) store = lines[0] || 'חנות לא ידועה';

  let total = null;
  const totalIdx = lines.findIndex(l => /(סה"?כ|לתשלום|total)/i.test(l));
  if (totalIdx >= 0) {
    for (let i = totalIdx; i < Math.min(totalIdx + 2, lines.length); i++) {
      const m = lines[i].match(/(\d{1,3}(?:,\d{3})*\.\d{2})/);
      if (m) { total = parseFloat(m[1].replace(/,/g, '')); break; }
    }
  }

  let items = parseReceiptTableFormat(lines);
  if (!items.length) items = parseReceiptSingleLineFormat(lines);

  return { store, total, items };
}

const receiptModal = document.getElementById('receiptModal');
const receiptFile = document.getElementById('receiptFile');
document.getElementById('openReceipt').onclick = () => receiptFile.click();
document.getElementById('closeReceipt').onclick = () => receiptModal.classList.remove('open');

receiptFile.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  receiptModal.classList.add('open');
  const statusEl = document.getElementById('receiptStatus');
  const previewEl = document.getElementById('receiptPreview');
  previewEl.innerHTML = ''; previewEl.dataset.items = '[]'; previewEl.dataset.total = '';
  document.getElementById('confirmReceiptBtn').style.display = 'none';
  try {
    let text;
    if (file.type === 'application/pdf') {
      statusEl.textContent = 'קורא את קובץ ה-PDF...';
      const { text: pdfText, pdf } = await extractPdfText(file);
      if (pdfText.trim().length > 20) {
        text = pdfText; // קבלה דיגיטלית עם שכבת טקסט אמיתית - הכי מדויק
      } else {
        statusEl.textContent = 'ה-PDF נראה כתמונה סרוקה, מריץ זיהוי טקסט...';
        text = await ocrPdfFirstPage(pdf);
      }
    } else {
      statusEl.textContent = 'טוען מנוע זיהוי טקסט... (בפעם הראשונה זה לוקח קצת יותר זמן)';
      await ensureTesseract();
      statusEl.textContent = 'קורא את הקבלה... (יכול לקחת עד כ-20 שניות)';
      const worker = await window.Tesseract.createWorker('heb+eng');
      const { data:{ text: t } } = await worker.recognize(file);
      await worker.terminate();
      text = t;
    }
    const parsed = parseReceipt(text);
    renderReceiptPreview(parsed);
    statusEl.textContent = parsed.items.length
      ? `זוהו ${parsed.items.length} פריטים. בדקו ותקנו לפני שמירה — זיהוי טקסט אוטומטי לא תמיד מדויק במאה אחוז.`
      : 'לא זוהו פריטים ברורים. אפשר לנסות תמונה/קובץ אחר.';
  } catch(err) {
    console.error(err);
    statusEl.textContent = `שגיאה: ${err?.message || 'לא ידועה'}. נסו קובץ אחר, או פנו עם הפרטים האלה.`;
  }
  receiptFile.value = '';
});

function renderReceiptPreview(parsed){
  const previewEl = document.getElementById('receiptPreview');
  previewEl.dataset.total = parsed.total ?? '';
  previewEl.dataset.items = JSON.stringify(parsed.items);
  previewEl.innerHTML = `
    <div class="add-row2" style="margin:10px 0 4px;">
      <input type="text" id="receiptStore" value="${escapeHtml(parsed.store)}" placeholder="שם החנות" style="flex:1;">
    </div>
    ${parsed.items.map((it,i) => `
      <label class="recipe-row">
        <input type="checkbox" checked data-idx="${i}">
        <input type="text" class="r-name" data-idx="${i}" value="${escapeHtml(it.name)}">
        <input type="number" step="0.1" class="r-price" data-idx="${i}" value="${it.price}">
      </label>`).join('')}
    ${parsed.total ? `<div class="subtitle" style="margin-top:8px;">סה"כ שזוהה בקבלה: ₪${parsed.total.toFixed(2)}</div>` : ''}
  `;
  document.getElementById('confirmReceiptBtn').style.display = parsed.items.length ? 'block' : 'none';
}

document.getElementById('confirmReceiptBtn').onclick = async () => {
  if (!db) return;
  const previewEl = document.getElementById('receiptPreview');
  const baseItems = JSON.parse(previewEl.dataset.items || '[]');
  const byIdx = {};
  previewEl.querySelectorAll('input[type=checkbox][data-idx]').forEach(cb => { byIdx[cb.dataset.idx] = { checked: cb.checked }; });
  previewEl.querySelectorAll('.r-name').forEach(inp => { if(byIdx[inp.dataset.idx]) byIdx[inp.dataset.idx].name = inp.value.trim(); });
  previewEl.querySelectorAll('.r-price').forEach(inp => { if(byIdx[inp.dataset.idx]) byIdx[inp.dataset.idx].price = parseFloat(inp.value) || 0; });
  const finalItems = Object.entries(byIdx)
    .filter(([,v]) => v.checked && v.name && v.price > 0)
    .map(([idx,v]) => ({ name: v.name, price: v.price, category: baseItems[idx]?.category || 'other' }));
  if (!finalItems.length) { showToast('לא נבחרו פריטים לשמירה'); return; }
  const store = (document.getElementById('receiptStore').value || '').trim() || 'חנות לא ידועה';
  const totalStr = previewEl.dataset.total;
  const total = totalStr ? parseFloat(totalStr) : finalItems.reduce((s,i) => s+i.price, 0);
  try {
    await addDoc(collection(db, 'receipts'), { store, items: finalItems, total, scannedBy: profile, scannedAt: serverTimestamp() });
    showToast('הקבלה נשמרה');
    receiptModal.classList.remove('open');
  } catch(e){ console.error(e); showToast('שגיאה בשמירת הקבלה'); }
};

function renderPriceCompare(){
  const box = document.getElementById('priceCompareBody');
  if (!receipts.length) { box.innerHTML = '<div class="empty">עדיין אין קבלות סרוקות.<br>סרקו קבלה (📸) כדי להתחיל לעקוב אחרי מחירים.</div>'; return; }
  const agg = {};
  for (const r of receipts) {
    const store = r.store || 'לא ידוע';
    for (const it of (r.items || [])) {
      const key = (it.name || '').trim();
      if (!key) continue;
      agg[key] = agg[key] || {};
      if (!agg[key][store] || it.price < agg[key][store].price) agg[key][store] = { price: it.price };
    }
  }
  const comparable = Object.entries(agg).filter(([, stores]) => Object.keys(stores).length >= 2);
  if (!comparable.length) { box.innerHTML = '<div class="empty">עדיין אין מספיק קבלות ממספר חנויות שונות לאותו מוצר כדי להשוות.<br>ככל שתסרקו יותר קבלות מחנויות שונות, ההשוואה תתמלא.</div>'; return; }
  box.innerHTML = comparable.map(([name, stores]) => {
    const entries = Object.entries(stores).sort((a,b) => a[1].price - b[1].price);
    const min = entries[0][1].price;
    return `<div class="compare-card">
      <div class="compare-name">${escapeHtml(name)}</div>
      ${entries.map(([store,d]) => `<div class="compare-row ${d.price===min?'cheapest':''}"><span>${escapeHtml(store)}</span><span>₪${d.price.toFixed(2)}</span></div>`).join('')}
    </div>`;
  }).join('');
}

if(!db){ setStatus(false, 'לא הוגדר Firebase'); }
if('serviceWorker' in navigator){ window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(()=>{}); }); }
