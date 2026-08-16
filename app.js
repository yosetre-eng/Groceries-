import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  initializeFirestore, persistentLocalCache, getFirestore,
  collection, addDoc, onSnapshot, updateDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy, writeBatch, getDocs, setDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { PRODUCTS, matchProduct } from "./products-db.js";

/* =========================================================
   הגדרות Firebase
   ========================================================= */
const firebaseConfig = {
  apiKey: "AIzaSyBiDsbdwu31UOLXl8E-3bweMAWB8_K6Ph0",
  authDomain: "groceries-b1f9f.firebaseapp.com",
  projectId: "groceries-b1f9f",
  storageBucket: "groceries-b1f9f.firebasestorage.app",
  messagingSenderId: "935993344640",
  appId: "1:935993344640:web:a6388852f042201aa41c65"
};

export const DEFAULT_CATEGORIES = [
  { id:"produce",  label:"ירקות ופירות",        icon:"🥬" },
  { id:"dairy",    label:"מוצרי חלב וביצים",     icon:"🧀" },
  { id:"meat",     label:"בשר עוף ודגים",        icon:"🍗" },
  { id:"bakery",   label:"מאפים ולחם",           icon:"🍞" },
  { id:"frozen",   label:"קפואים",               icon:"❄️" },
  { id:"cans",     label:"שימורים ורטבים",       icon:"🥫" },
  { id:"dry",      label:"אורז, פסטה וקטניות",   icon:"🍚" },
  { id:"spices",   label:"תבלינים ואפייה",       icon:"🧂" },
  { id:"snacks",   label:"חטיפים וממתקים",       icon:"🍫" },
  { id:"drinks",   label:"משקאות",               icon:"🥤" },
  { id:"clean",    label:"ניקיון",               icon:"🧽" },
  { id:"toiletry", label:"טואלטיקה וקוסמטיקה",   icon:"🧴" },
  { id:"other",    label:"שונות",                icon:"📦" },
];
const catMap = Object.fromEntries(DEFAULT_CATEGORIES.map(c => [c.id, c]));

let app, db;
try {
  app = initializeApp(firebaseConfig);
  try {
    db = initializeFirestore(app, { localCache: persistentLocalCache() });
  } catch (e) {
    // fails if multiple tabs open persistence at once - fall back gracefully
    db = getFirestore(app);
  }
} catch (e) {
  console.error("Firebase init failed", e);
}

/* ---------- status ---------- */
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
function setStatus(ok, text){
  statusDot.classList.toggle('off', !ok);
  statusText.textContent = text;
}

/* ---------- profile ---------- */
let profile = localStorage.getItem('shopping_profile') || 'יוסף';
const pYosef = document.getElementById('profileYosef');
const pAgam = document.getElementById('profileAgam');
function renderProfile(){
  pYosef.classList.toggle('active', profile === 'יוסף');
  pAgam.classList.toggle('active', profile === 'אגם');
}
pYosef.onclick = () => { profile='יוסף'; localStorage.setItem('shopping_profile', profile); renderProfile(); };
pAgam.onclick = () => { profile='אגם'; localStorage.setItem('shopping_profile', profile); renderProfile(); };
renderProfile();

/* ---------- category order (shared, reorderable) ---------- */
let categoryOrder = DEFAULT_CATEGORIES.map(c => c.id);
const catOrderRef = db ? doc(db, 'meta', 'categoryOrder') : null;
if (catOrderRef) {
  onSnapshot(catOrderRef, snap => {
    if (snap.exists() && Array.isArray(snap.data().order) && snap.data().order.length) {
      categoryOrder = snap.data().order;
    }
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

/* ---------- product autocomplete ---------- */
const productList = document.getElementById('productList');
productList.innerHTML = PRODUCTS.map(p => `<option value="${p.name}"></option>`).join('');
const catSelect = document.getElementById('itemCategory');
catSelect.innerHTML = DEFAULT_CATEGORIES.map(c => `<option value="${c.id}">${c.icon} ${c.label}</option>`).join('');

const nameInput = document.getElementById('itemName');
const qtyInput = document.getElementById('itemQty');
const priceHint = document.getElementById('priceHint');
nameInput.addEventListener('input', () => {
  const m = matchProduct(nameInput.value);
  if (m) {
    catSelect.value = m.category;
    priceHint.textContent = `≈ ₪${m.price} / ${m.unit}`;
  } else {
    priceHint.textContent = '';
  }
});
document.getElementById('addBtn').onclick = () => addItem(nameInput.value, catSelect.value, qtyInput.value, 'manual');
nameInput.addEventListener('keydown', e => { if(e.key === 'Enter') document.getElementById('addBtn').click(); });

async function addItem(rawName, category, rawQty, source){
  const name = (rawName || '').trim();
  if(!name || !db) return;
  const match = matchProduct(name);
  const qty = rawQty ? Number(rawQty) : 1;
  try{
    await addDoc(collection(db, 'items'), {
      name: match ? match.name : name,
      category: category || (match ? match.category : 'other'),
      qty, unit: match ? match.unit : null, price: match ? match.price : null,
      done:false, addedBy:profile, source: source || 'manual',
      createdAt: serverTimestamp()
    });
    nameInput.value = ''; qtyInput.value = ''; priceHint.textContent = '';
    nameInput.focus();
  }catch(e){ console.error(e); setStatus(false, 'שגיאה בשמירה'); }
}

/* ---------- live items ---------- */
const listEl = document.getElementById('list');
const quickAddEl = document.getElementById('quickAdd');
let items = [];
let historyDocs = [];

if(db){
  onSnapshot(query(collection(db, 'items'), orderBy('createdAt', 'asc')), snap => {
    items = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    setStatus(true, 'מסונכרן');
    render();
  }, err => { console.error(err); setStatus(false, 'אין חיבור — בדקו את הגדרות Firebase'); });

  onSnapshot(collection(db, 'history'), snap => {
    historyDocs = snap.docs.map(d => d.data());
    renderQuickAdd();
    renderStats();
  }, err => console.error(err));
}

function renderQuickAdd(){
  const counts = {};
  for(const h of historyDocs){
    const key = (h.name || '').trim();
    if(!key) continue;
    counts[key] = (counts[key] || 0) + 1;
  }
  const activeNames = new Set(items.map(i => (i.name||'').trim().toLowerCase()));
  const top = Object.entries(counts)
    .filter(([name]) => !activeNames.has(name.toLowerCase()))
    .sort((a,b) => b[1]-a[1])
    .slice(0, 8);
  if(!top.length){ quickAddEl.innerHTML = ''; quickAddEl.style.display='none'; return; }
  quickAddEl.style.display = 'flex';
  quickAddEl.innerHTML = top.map(([name]) => `<div class="qa-chip" data-qa="${escapeHtml(name)}">+ ${escapeHtml(name)}</div>`).join('');
  quickAddEl.querySelectorAll('[data-qa]').forEach(el => {
    el.onclick = () => addItem(el.dataset.qa, null, 1, 'quick');
  });
}

function render(){
  const totalCount = items.length;
  const doneCount = items.filter(i => i.done).length;
  document.getElementById('totalCount').textContent = totalCount;
  document.getElementById('doneCount').textContent = doneCount;
  document.getElementById('progressFill').style.width = totalCount ? `${(doneCount/totalCount)*100}%` : '0%';

  const budget = items.reduce((sum, i) => sum + (i.price ? i.price * (i.qty||1) : 0), 0);
  document.getElementById('budgetText').textContent = budget > 0 ? `≈ ₪${budget.toFixed(0)}` : '—';

  if(totalCount === 0){
    listEl.innerHTML = `<div class="empty"><span class="big">📝</span>הרשימה ריקה כרגע.<br>הוסיפו את הדבר הראשון שחסר בבית!</div>`;
    return;
  }

  const byCat = {};
  for(const it of items){
    const c = it.category && catMap[it.category] ? it.category : 'other';
    (byCat[c] = byCat[c] || []).push(it);
  }

  const order = categoryOrder.filter(id => byCat[id]?.length);
  listEl.innerHTML = order.map((id, idx) => {
    const c = catMap[id];
    const catItems = byCat[id].slice().sort((a,b) => (a.done === b.done) ? 0 : (a.done ? 1 : -1));
    const openCount = catItems.filter(i => !i.done).length;
    return `
      <div class="category">
        <div class="cat-head">
          <span class="cat-icon">${c.icon}</span>
          <span class="cat-title">${c.label}</span>
          <span class="cat-count">${openCount} לקנייה</span>
          <div class="reorder">
            <button class="reorder-btn" data-up="${id}" ${idx===0?'disabled':''}>▲</button>
            <button class="reorder-btn" data-down="${id}" ${idx===order.length-1?'disabled':''}>▼</button>
          </div>
        </div>
        ${catItems.map(itemRow).join('')}
      </div>`;
  }).join('');

  listEl.querySelectorAll('[data-check]').forEach(el => el.onclick = () => toggleDone(el.dataset.check, el.dataset.doneval === 'true'));
  listEl.querySelectorAll('[data-del]').forEach(el => el.onclick = () => removeItem(el.dataset.del));
  listEl.querySelectorAll('[data-up]').forEach(el => el.onclick = () => moveCategory(el.dataset.up, -1));
  listEl.querySelectorAll('[data-down]').forEach(el => el.onclick = () => moveCategory(el.dataset.down, 1));
}

function itemRow(it){
  const qtyBadge = it.qty && it.qty > 1 ? `<span class="item-qty">×${it.qty}</span>` : '';
  const priceBadge = it.price ? `<span class="item-qty">₪${(it.price*(it.qty||1)).toFixed(0)}</span>` : '';
  return `
    <div class="item ${it.done ? 'done':''}">
      <div class="check" data-check="${it.id}" data-doneval="${!it.done}">${it.done ? '✓' : ''}</div>
      <div class="item-name">${escapeHtml(it.name)}</div>
      ${qtyBadge}${priceBadge}
      <div class="item-who">${it.addedBy || ''}</div>
      <button class="del" data-del="${it.id}">✕</button>
    </div>`;
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

async function toggleDone(id, val){
  if(!db) return;
  try{ await updateDoc(doc(db, 'items', id), { done: val }); } catch(e){ console.error(e); }
}
async function removeItem(id){
  if(!db) return;
  try{ await deleteDoc(doc(db, 'items', id)); } catch(e){ console.error(e); }
}

/* clear bought items -> archive to history, then delete */
document.getElementById('clearBtn').onclick = async () => {
  if(!db) return;
  const doneItems = items.filter(i => i.done);
  if(doneItems.length === 0) return;
  try{
    const batch = writeBatch(db);
    doneItems.forEach(i => {
      const hRef = doc(collection(db, 'history'));
      batch.set(hRef, {
        name:i.name, category:i.category, qty:i.qty||1, price:i.price||null,
        purchasedBy:profile, purchasedAt: serverTimestamp()
      });
      batch.delete(doc(db, 'items', i.id));
    });
    await batch.commit();
  }catch(e){ console.error(e); }
};

/* ---------- recipe parser ---------- */
const UNIT_WORDS = ['גרם','ג\'','ק"ג','קג','מ"ל','מל','ליטר','כוס','כוסות','כפית','כפיות','כפות','כף','יחידות','יחידה','חבילה','חבילות','קופסה','קופסאות'];
function parseRecipeText(text){
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  return lines.map(line => {
    let working = line;
    // strip leading bullet chars
    working = working.replace(/^[-•*]\s*/, '');
    // leading quantity (digits, possibly with fraction like 1/2)
    const qtyMatch = working.match(/^(\d+(\.\d+)?(\/\d+)?)\s*/);
    let qty = 1;
    if(qtyMatch){ qty = parseFloat(qtyMatch[1]) || 1; working = working.slice(qtyMatch[0].length); }
    // strip a leading unit word
    for(const u of UNIT_WORDS){
      const re = new RegExp(`^${u}\\s+(של\\s+)?`);
      if(re.test(working)){ working = working.replace(re, ''); break; }
    }
    working = working.trim();
    const match = matchProduct(working);
    return {
      raw: line,
      name: match ? match.name : working,
      category: match ? match.category : 'other',
      unit: match ? match.unit : null,
      price: match ? match.price : null,
      qty
    };
  }).filter(r => r.name);
}

const recipeModal = document.getElementById('recipeModal');
document.getElementById('openRecipe').onclick = () => { recipeModal.classList.add('open'); document.getElementById('recipePreview').innerHTML=''; };
document.getElementById('closeRecipe').onclick = () => recipeModal.classList.remove('open');
document.getElementById('parseRecipeBtn').onclick = () => {
  const text = document.getElementById('recipeText').value;
  const parsed = parseRecipeText(text);
  const preview = document.getElementById('recipePreview');
  if(!parsed.length){ preview.innerHTML = '<div class="empty">לא זוהו רכיבים. נסו לפרק לשורות, שורה לכל רכיב.</div>'; return; }
  preview.innerHTML = parsed.map((p, i) => `
    <label class="recipe-row">
      <input type="checkbox" checked data-idx="${i}">
      <span>${escapeHtml(p.name)}</span>
      <span class="item-qty">×${p.qty}${p.unit ? ' · '+p.unit : ''}</span>
    </label>`).join('');
  preview.dataset.parsed = JSON.stringify(parsed);
  document.getElementById('confirmRecipeBtn').style.display = 'block';
};
document.getElementById('confirmRecipeBtn').onclick = async () => {
  const preview = document.getElementById('recipePreview');
  const parsed = JSON.parse(preview.dataset.parsed || '[]');
  const checks = preview.querySelectorAll('input[type=checkbox]');
  for(const cb of checks){
    if(!cb.checked) continue;
    const p = parsed[Number(cb.dataset.idx)];
    await addItem(p.name, p.category, p.qty, 'recipe');
  }
  recipeModal.classList.remove('open');
};

/* ---------- stats ---------- */
const statsModal = document.getElementById('statsModal');
document.getElementById('openStats').onclick = () => { statsModal.classList.add('open'); renderStats(); };
document.getElementById('closeStats').onclick = () => statsModal.classList.remove('open');
function renderStats(){
  const box = document.getElementById('statsBody');
  if(!historyDocs.length){ box.innerHTML = '<div class="empty">עדיין אין היסטוריית קניות.<br>ברגע שתסמנו ותנקו פריטים, הנתונים יופיעו כאן.</div>'; return; }
  const counts = {};
  for(const h of historyDocs){
    const key = (h.name||'').trim();
    if(!key) continue;
    counts[key] = (counts[key] || 0) + 1;
  }
  const top = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0, 10);
  const max = top[0]?.[1] || 1;
  box.innerHTML = top.map(([name, count]) => `
    <div class="stat-row">
      <div class="stat-label">${escapeHtml(name)}</div>
      <div class="stat-track"><div class="stat-fill" style="width:${(count/max)*100}%"></div></div>
      <div class="stat-count">${count}</div>
    </div>`).join('');
}

if(!db){ setStatus(false, 'לא הוגדר Firebase'); }

if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  });
}
