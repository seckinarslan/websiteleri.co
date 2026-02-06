import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, addDoc, doc, setDoc, getDoc,
  query, orderBy, limit, onSnapshot, serverTimestamp, getDocs,
  deleteDoc, updateDoc, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initOwnerGate } from "./owner-gate.js";

/* ---------- GLOBAL ERROR CAPTURE ---------- */
window.addEventListener("unhandledrejection", (e) => {
  console.error("UNHANDLED PROMISE:", e.reason);
  alert("Unhandled promise: " + (e.reason?.code || "") + " " + (e.reason?.message || e.reason));
});

window.addEventListener("error", (e) => {
  console.error("WINDOW ERROR:", e.error || e.message);
});

/* ---------- SAFE WRAPPER ---------- */
async function safe(label, fn) {
  try {
    return await fn();
  } catch (e) {
    console.error(`[${label}]`, e);
    alert(`${label} hata: ${e.code || ""} ${e.message || e}`);
    throw e;
  }
}

/* ---------- FIREBASE ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyDN0zwDiK0MveXRkykgkhG-p-oqBvanF7U",
  authDomain: "websitelerico.firebaseapp.com",
  projectId: "websitelerico",
  storageBucket: "websitelerico.firebasestorage.app",
  messagingSenderId: "848484251740",
  appId: "1:848484251740:web:a7692eeef83ca05e3b4e99",
  measurementId: "G-9V22FDX9N0"
};

const payerSelect = document.getElementById("payerSelect");
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

/* ---------- VIEW MODE ---------- */
const params = new URLSearchParams(location.search);
const view = params.get("view") || "chat";

const pageTitle = document.getElementById("pageTitle");
const chatView = document.getElementById("chatView");
const settlementView = document.getElementById("settlementView");

const openSettlementBtn = document.getElementById("openSettlement");
const openChatBtn = document.getElementById("openChat");
const backToChatLocal = document.getElementById("backToChatLocal");

function currentBaseUrl() {
  return location.origin + location.pathname;
}

function openInNewTab(targetView) {
  const url = currentBaseUrl() + "?view=" + encodeURIComponent(targetView);
  window.open(url, "_blank", "noopener,noreferrer");
}

// UI switch
if (view === "settlement") {
  pageTitle.textContent = "Mahsuplaşma";
  settlementView.style.display = "flex";
  chatView.style.display = "none";
  openChatBtn.style.display = "inline-block";
  openSettlementBtn.style.display = "none";
} else {
  pageTitle.textContent = "Chat";
  chatView.style.display = "flex";
  settlementView.style.display = "none";
  openSettlementBtn.style.display = "inline-block";
  openChatBtn.style.display = "none";
}

openSettlementBtn.addEventListener("click", () => openInNewTab("settlement"));
openChatBtn.addEventListener("click", () => openInNewTab("chat"));
backToChatLocal.addEventListener("click", () => {
  location.href = currentBaseUrl() + "?view=chat";
});

/* ---------- AUTH UI ---------- */
const statusEl = document.getElementById("status");
const loginBtn = document.getElementById("login");
const logoutBtn = document.getElementById("logout");

loginBtn.addEventListener("click", async () => {
  try {
    loginBtn.disabled = true;
    loginBtn.textContent = "Giriş yapılıyor...";
    await safe("Login popup", () => signInWithPopup(auth, provider));
  } catch (e) {
    console.error(e);
    alert(e.code === "auth/popup-closed-by-user" ? "Giriş penceresi kapatıldı" : `Giriş hatası: ${e.code || ""} ${e.message || e}`);
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Google ile giriş";
  }
});

logoutBtn.addEventListener("click", async () => {
  await safe("Logout", () => signOut(auth));
});

/* ---------- HELPERS ---------- */
const esc = (v) => {
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && typeof v.toDate === "function") {
    v = v.toDate().toISOString();
  }
  const s = String(v);
  return s.replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
};

function formatTime(ts) {
  if (!ts?.toDate) return "";
  const d = ts.toDate();
  return d.toLocaleDateString("tr-TR") + " " + d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

function formatDateAny(x) {
  if (!x) return "";
  if (typeof x === "string") return x.split("-").reverse().join(".");
  if (x?.toDate) return x.toDate().toLocaleDateString("tr-TR");
  return "";
}

/* ---------- USERS ---------- */
async function upsertUser(user) {
  if (!user) return;
  const userRef = doc(db, "users", user.uid);
  await safe("User upsert", () =>
    setDoc(userRef, {
      uid: user.uid,
      displayName: user.displayName || "",
      email: user.email || "",
      photoURL: user.photoURL || "",
      lastSeenAt: serverTimestamp()
    }, { merge: true })
  );
}

/* ---------- CHAT ---------- */
const msgsEl = document.getElementById("msgs");
const chatForm = document.getElementById("chatForm");
const chatText = document.getElementById("chatText");
const sendChat = document.getElementById("sendChat");

let uid = null;
let unsubChat = null;

function renderMsg(d) {
  const mine = d.uid === uid;
  const el = document.createElement("div");
  el.className = "msg" + (mine ? " me" : "");
  el.innerHTML = `
    <div class="meta">
      <span>${mine ? "sen" : esc(d.name || d.uid?.slice(0,6) || "user")}</span>
      <span class="time">${d.createdAt ? esc(formatTime(d.createdAt)) : ""}</span>
    </div>
    <div class="msg-content">${esc(d.text)}</div>
  `;
  msgsEl.appendChild(el);
}

function scrollBottom() {
  setTimeout(() => { msgsEl.scrollTop = msgsEl.scrollHeight; }, 60);
}

chatForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = chatText.value.trim();
  if (!text || !uid) return;

  sendChat.disabled = true;
  sendChat.textContent = "Gönderiliyor...";
  try {
    const messagesRef = collection(db, "rooms", "public", "messages");
    await safe("Chat mesajı gönder", () =>
      addDoc(messagesRef, {
        text,
        uid,
        name: auth.currentUser?.displayName || auth.currentUser?.email || "user",
        createdAt: serverTimestamp()
      })
    );
    chatText.value = "";
  } finally {
    sendChat.disabled = false;
    sendChat.textContent = "Gönder";
    chatText.focus();
  }
});

/* ---------- SETTLEMENT ---------- */
const stTitle = document.getElementById("stTitle");
const stAmount = document.getElementById("stAmount");
const stCurrency = document.getElementById("stCurrency");
const stDate = document.getElementById("stDate");
const stCategory = document.getElementById("stCategory");
const stNote = document.getElementById("stNote");
const participantsContainer = document.getElementById("participantsContainer");
const selectAllParticipants = document.getElementById("selectAllParticipants");
const clearSelection = document.getElementById("clearSelection");
const selectedCount = document.getElementById("selectedCount");
const stManualName = document.getElementById("stManualName");
const addManualParticipantBtn = document.getElementById("addManualParticipant");
const saveExpenseBtn = document.getElementById("saveExpense");
const clearFormBtn = document.getElementById("clearForm");
const stStatus = document.getElementById("stStatus");
const expensesList = document.getElementById("expensesList");
const expensesCount = document.getElementById("expensesCount");
const refreshExpensesBtn = document.getElementById("refreshExpenses");
const filterCategory = document.getElementById("filterCategory");
const calculateSettlementBtn = document.getElementById("calculateSettlement");
const totalExpenseEl = document.getElementById("totalExpense");
const expenseCountEl = document.getElementById("expenseCount");
const participantCountEl = document.getElementById("participantCount");
const averagePerPersonEl = document.getElementById("averagePerPerson");
const balanceTableContainer = document.getElementById("balanceTableContainer");
const exportDataBtn = document.getElementById("exportData");
const sendSummaryBtn = document.getElementById("sendSummary");
const expenseModal = document.getElementById("expenseModal");
const closeModalBtns = document.querySelectorAll("#closeModal, #closeModal2");
const editExpenseBtn = document.getElementById("editExpense");
const deleteExpenseBtn = document.getElementById("deleteExpense");
const expenseDetailContent = document.getElementById("expenseDetailContent");
const stEntryType = document.getElementById("stEntryType");


// default date
if (stDate) stDate.value = new Date().toISOString().split("T")[0];

let usersCache = [];
let manualParticipants = [];
let selectedParticipants = new Set();
let payerId = null;
let allExpenses = [];
let selectedExpenseId = null;
let editingExpenseId = null;

async function loadUsersForParticipants() {
  const usersRef = collection(db, "users");
  const snap = await safe("Kullanıcıları yükle", () => getDocs(usersRef));
  usersCache = [];
  snap.forEach(d => usersCache.push(d.data()));
  renderParticipantsList();
}

function renderParticipantsList() {
  participantsContainer.innerHTML = "";

  const currentUser = usersCache.find(u => u.uid === uid);
  if (currentUser) addParticipantItem(currentUser);

  usersCache.forEach(user => {
    if (user.uid !== uid) addParticipantItem(user);
  });

  manualParticipants.forEach((name, index) => addManualParticipantItem(name, index));

  renderPayerOptions();
  updateSelectedCount();
}

function addParticipantItem(user) {
  const item = document.createElement("div");
  item.className = "participant-item";
  item.dataset.id = user.uid;
  item.dataset.type = "user";
  item.dataset.name = user.displayName || user.email || user.uid;

  const isSelected = selectedParticipants.has(user.uid);
  const isPayer = payerId === user.uid;

  if (isSelected) item.classList.add("selected");
  if (isPayer) item.classList.add("payer");

  item.innerHTML = `
    <div class="checkbox"></div>
    <div class="participant-name">${esc(user.displayName || user.email || user.uid)}</div>
    ${isPayer ? '<div class="role-badge">Ödeyen</div>' : ""}
  `;

  item.addEventListener("click", (e) => {
    if (e.target.closest(".participant-item") !== item) return;

    const entryType = stEntryType?.value || "EXPENSE";

    // CTRL/Meta ile payer set etme davranışını KALDIR (özellikle mobilde zaten yok)
    // payer her zaman dropdown'dan seçilecek

    if (entryType === "TRANSFER") {
      // transferde tıklanan kişi = alıcı (tek)
      selectedParticipants.clear();
      selectedParticipants.add(user.uid);

      // payer alıcıyla aynı olamaz → aynıysa payer'i sıfırla
      if (payerId === user.uid) payerId = null;

      renderParticipantsList();
      return;
    }

    // EXPENSE: eski multi-select davranışı
    if (selectedParticipants.has(user.uid)) {
      selectedParticipants.delete(user.uid);
      if (payerId === user.uid) payerId = null;
    } else {
      selectedParticipants.add(user.uid);
    }

    renderParticipantsList();
  });


  participantsContainer.appendChild(item);
}

function addManualParticipantItem(name, index) {
  const item = document.createElement("div");
  item.className = "participant-item";
  item.dataset.id = `manual_${index}`;
  item.dataset.type = "manual";
  item.dataset.name = name;

  const isSelected = selectedParticipants.has(`manual_${index}`);
  const isPayer = payerId === `manual_${index}`;

  if (isSelected) item.classList.add("selected");
  if (isPayer) item.classList.add("payer");

  item.innerHTML = `
    <div class="checkbox"></div>
    <div class="participant-name">${esc(name)}</div>
    <div class="chip manual">manuel</div>
    ${isPayer ? '<div class="role-badge">Ödeyen</div>' : ""}
  `;

  item.addEventListener("click", (e) => {
    if (e.target.closest(".participant-item") !== item) return;

    const entryType = stEntryType?.value || "EXPENSE";
    const id = `manual_${index}`;

    if (entryType === "TRANSFER") {
      selectedParticipants.clear();
      selectedParticipants.add(id);
      if (payerId === id) payerId = null;
      renderParticipantsList();
      return;
    }

    if (selectedParticipants.has(id)) {
      selectedParticipants.delete(id);
      if (payerId === id) payerId = null;
    } else {
      selectedParticipants.add(id);
    }

    renderParticipantsList();
  });


  participantsContainer.appendChild(item);
}

function updateSelectedCount() {
  const entryType = stEntryType?.value || "EXPENSE";
  const count = selectedParticipants.size;

  selectedCount.textContent = `${count} katılımcı seçildi`;

  if (entryType === "TRANSFER") {
    const recipient = selectedParticipants.values().next().value || null;
    const ok = !!stTitle.value.trim() && !!stAmount.value && !!payerId && !!recipient && payerId !== recipient;
    saveExpenseBtn.disabled = !ok;
    return;
  }

  // EXPENSE
  saveExpenseBtn.disabled = count === 0 || !stTitle.value.trim() || !stAmount.value || !payerId;
}


// Seçim kurallarını uygula
function applyEntryTypeRules() {
  if (!stEntryType) return;
  const type = stEntryType.value || "EXPENSE";

  selectAllParticipants.disabled = (type === "TRANSFER");

  if (type === "TRANSFER") {
    // transferde sadece 1 alıcı kalsın
    if (selectedParticipants.size > 1) {
      const first = selectedParticipants.values().next().value;
      selectedParticipants = new Set([first]);
    }
    // payer alıcıyla aynı olamaz
    const recipient = selectedParticipants.values().next().value || null;
    if (recipient && payerId === recipient) payerId = null;
  }

  renderParticipantsList();
  updateSelectedCount();
}


// Change event'ini ekle
if (stEntryType) {
  stEntryType.addEventListener("change", applyEntryTypeRules);
}

selectAllParticipants.addEventListener("click", () => {
  selectedParticipants.clear();
  usersCache.forEach(user => selectedParticipants.add(user.uid));
  manualParticipants.forEach((_, index) => selectedParticipants.add(`manual_${index}`));
  if (usersCache.length > 0 && !payerId) payerId = usersCache[0].uid;
  renderParticipantsList();
});

clearSelection.addEventListener("click", () => {
  selectedParticipants.clear();
  payerId = null;
  renderParticipantsList();
});

addManualParticipantBtn.addEventListener("click", () => {
  const name = stManualName.value.trim();
  if (!name) return;
  manualParticipants.push(name);
  stManualName.value = "";
  stStatus.textContent = `Manuel katılımcı eklendi: ${name}`;
  setTimeout(() => stStatus.textContent = "Hazır", 1500);
  renderParticipantsList();
});

clearFormBtn.addEventListener("click", () => {
  stTitle.value = "";
  stAmount.value = "";
  stNote.value = "";
  stDate.value = new Date().toISOString().split("T")[0];
  stManualName.value = "";
  selectedParticipants.clear();
  payerId = null;
  manualParticipants = [];
  editingExpenseId = null;
  saveExpenseBtn.textContent = "Kaydet";
  stEntryType.value = "EXPENSE";
  applyEntryTypeRules();
  renderParticipantsList();
  stStatus.textContent = "Form temizlendi";
});

stTitle.addEventListener("input", updateSelectedCount);
stAmount.addEventListener("input", updateSelectedCount);

function getParticipantName(id) {
  if (!id) return "";
  if (id.startsWith("manual_")) {
    const index = parseInt(id.split("_")[1], 10);
    return manualParticipants[index] || "";
  }
  const user = usersCache.find(u => u.uid === id);
  return user?.displayName || user?.email || id;
}

saveExpenseBtn.addEventListener("click", async () => {
  if (!uid) return;

  const title = stTitle.value.trim();
  const amount = Number(stAmount.value);
  const currency = stCurrency.value;
  const entryType = stEntryType ? stEntryType.value : "EXPENSE";
  const date = stDate?.value || new Date().toISOString().split("T")[0];
  const category = (entryType === "TRANSFER") ? "transfer" : (stCategory?.value || "diger");
  const note = stNote?.value?.trim?.() || "";

  if (!title) return alert("Harcama başlığı gerekli");
  if (!amount || amount <= 0) return alert("Geçerli bir tutar girin");
  if (selectedParticipants.size === 0) return alert("En az bir katılımcı seçin");
  if (!payerId) return alert("Ödeyen kişiyi belirleyin (Ctrl+Click ile)");

  if (entryType === "TRANSFER") {
    if (selectedParticipants.size !== 1) return alert("Transfer için tam 1 alıcı seçin.");
    const onlyRecipient = [...selectedParticipants][0];
    if (payerId === onlyRecipient) return alert("Transferde ödeyen ve alıcı aynı olamaz.");
  }

  const participants = [];
  selectedParticipants.forEach(id => {
    if (id.startsWith("manual_")) {
      const index = parseInt(id.split("_")[1], 10);
      participants.push({ type: "manual", name: manualParticipants[index] });
    } else {
      const user = usersCache.find(u => u.uid === id);
      participants.push({ type: "user", uid: id, name: user?.displayName || user?.email || id });
    }
  });

  saveExpenseBtn.disabled = true;
  saveExpenseBtn.classList.add("loading");
  stStatus.textContent = editingExpenseId ? "Güncelleniyor..." : "Kaydediliyor...";

  try {
    const payload = {
      entryType, title, amount, currency, date, category, note,
      participants,
      payer: payerId,
      payerName: getParticipantName(payerId),
      updatedAt: serverTimestamp()
    };

    if (editingExpenseId) {
      await safe("Harcama güncelle", () =>
        updateDoc(doc(db, "expenses", editingExpenseId), payload)
      );
      stStatus.textContent = "Harcama güncellendi ✅";
    } else {
      await safe("Harcama kaydet", () =>
        addDoc(collection(db, "expenses"), {
          ...payload,
          createdByUid: uid,
          createdByName: auth.currentUser?.displayName || auth.currentUser?.email || "user",
          createdAt: serverTimestamp()
        })
      );
      stStatus.textContent = "Harcama kaydedildi ✅";
      if (entryType === "TRANSFER") {
        playTransferSound();
      } else {
        playSettlementSound();
      }
    }

    setTimeout(() => stStatus.textContent = "Hazır", 1500);

    // reset
    stTitle.value = "";
    stAmount.value = "";
    stNote.value = "";
    selectedParticipants.clear();
    payerId = null;
    manualParticipants = [];
    editingExpenseId = null;
    saveExpenseBtn.textContent = "Kaydet";
    renderParticipantsList();
  } catch {
    stStatus.textContent = "Hata";
  } finally {
    saveExpenseBtn.disabled = false;
    saveExpenseBtn.classList.remove("loading");
  }

  await safe("Harcama listesini yenile", () => loadExpenses());
});

async function loadExpenses() {
  try {
    expensesList.innerHTML = `<div class="text-center" style="opacity:.7; padding: 20px;">Yükleniyor…</div>`;

    const expensesRef = collection(db, "expenses");
    let snap;

    try {
      const q1 = query(expensesRef, orderBy("createdAt", "desc"));
      snap = await safe("Harcama listele (createdAt)", () => getDocs(q1));
    } catch (e) {
      console.warn("createdAt orderBy başarısız, date fallback:", e);
      const q2 = query(expensesRef, orderBy("date", "desc"));
      snap = await safe("Harcama listele (date)", () => getDocs(q2));
    }

    allExpenses = [];
    snap.forEach(d => allExpenses.push({ id: d.id, ...d.data() }));

    renderExpensesList();
    updateExpensesCount();
  } catch (e) {
    console.error("loadExpenses hata:", e);
    expensesList.innerHTML = `
      <div class="text-center" style="opacity:.85; padding: 20px;">
        Harcama geçmişi yüklenemedi ❌<br/>
        <div style="opacity:.7; font-size:.9rem; margin-top:6px;">
          Konsolda hata detayı var (F12 → Console).
        </div>
      </div>
    `;
    expensesCount.textContent = `0 harcama bulundu`;
  }
}

function renderExpensesList() {
  expensesList.innerHTML = "";

  const categoryFilter = filterCategory.value;
  const filteredExpenses = categoryFilter
    ? allExpenses.filter(exp => exp.category === categoryFilter)
    : allExpenses;

  if (filteredExpenses.length === 0) {
    expensesList.innerHTML = `
      <div class="text-center" style="opacity: 0.7; padding: 40px;">
        Henüz harcama kaydı bulunmuyor
      </div>
    `;
    return;
  }

  filteredExpenses.forEach(expense => {
    try {
      const card = document.createElement("div");
      card.className = "expense-card cursor-pointer";
      card.dataset.id = expense.id;

      const participantNames = expense.participants?.map(p => {
        return p.type === "manual" ? p.name :
          usersCache.find(u => u.uid === p.uid)?.displayName ||
          usersCache.find(u => u.uid === p.uid)?.email ||
          p.uid?.slice(0, 6);
      }).join(", ") || "";

      const isTransfer = (expense.entryType || "EXPENSE") === "TRANSFER";

      card.innerHTML = `
        <div class="expense-header">
          <div class="expense-title">
            ${esc(expense.title)}
            <!-- YENİ: Transfer badge'i -->
            ${(expense.entryType || "EXPENSE") === "TRANSFER" 
              ? '<span class="chip" style="margin-left:8px; opacity:.9;">🔁 Transfer</span>' 
              : ''}
          </div>
          <div class="expense-amount">${Number(expense.amount || 0)} ${esc(expense.currency || "TRY")}</div>
        </div>
        <div class="expense-details">
          <div class="expense-meta">
            <div>📅 ${esc(formatDateAny(expense.date) || formatDateAny(expense.createdAt))}</div>
            <div>🏷️ ${esc(getCategoryLabel(expense.category))}</div>
            <div>👤 ${esc(expense.payerName || "")} ${isTransfer ? "gönderdi" : "ödedi"}</div>
          </div>
          ${expense.note ? `<div class="expense-note">${esc(expense.note)}</div>` : ""}
          <div class="expense-participants">
            <div style="font-size: 0.85rem; opacity: 0.8; margin-bottom: 4px;">Katılımcılar:</div>
            <div style="display: flex; flex-wrap: wrap; gap: 4px;">
              ${participantNames.split(", ").filter(Boolean).map(name => `<span class="chip">${esc(name)}</span>`).join("")}
            </div>
          </div>
        </div>
      `;

      card.addEventListener("click", () => showExpenseDetail(expense.id));
      expensesList.appendChild(card);
    } catch (e) {
      console.error("Expense render hatası, id:", expense?.id, e);
    }
  });
}

function getCategoryLabel(category) {
  const labels = {
    yemek: "Yemek",
    market: "Market",
    ulasim: "Ulaşım",
    eglence: "Eğlence",
    konaklama: "Konaklama",
    diger: "Diğer",
    transfer: "Transfer"
  };
  return labels[category] || category;
}

function updateExpensesCount() {
  expensesCount.textContent = `${allExpenses.length} harcama bulundu`;
}

refreshExpensesBtn.addEventListener("click", async () => {
  refreshExpensesBtn.disabled = true;
  const old = refreshExpensesBtn.textContent;
  refreshExpensesBtn.textContent = "Yükleniyor…";
  try {
    await safe("Harcama yenile", () => loadExpenses());
  } finally {
    refreshExpensesBtn.disabled = false;
    refreshExpensesBtn.textContent = old;
  }
});

filterCategory.addEventListener("change", renderExpensesList);
payerSelect?.addEventListener("change", () => {
  payerId = payerSelect.value || null;
  updateSelectedCount();
});

function showExpenseDetail(expenseId) {
  const expense = allExpenses.find(e => e.id === expenseId);
  if (!expense) return;

  selectedExpenseId = expenseId;

  expenseDetailContent.innerHTML = `
    <div style="margin-bottom: 16px;">
      <div style="font-size: 1.2rem; font-weight: 700; color: var(--accent);">
        ${esc(expense.title)}
      </div>
      <div style="font-size: 1.5rem; font-weight: 700; color: var(--accent-green); margin-top: 8px;">
        ${esc(expense.amount)} ${esc(expense.currency)}
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
      <div>
        <div style="font-size: 0.85rem; opacity: 0.8;">Tarih</div>
        <div>${esc(formatDateAny(expense.date) || formatDateAny(expense.createdAt))}</div>
      </div>
      <div>
        <div style="font-size: 0.85rem; opacity: 0.8;">Kategori</div>
        <div>${esc(getCategoryLabel(expense.category))}</div>
      </div>
      <div>
        <div style="font-size: 0.85rem; opacity: 0.8;">Ödeyen</div>
        <div style="color: var(--accent-yellow); font-weight: 600;">
          ${esc(expense.payerName || "")}
        </div>
      </div>
      <div>
        <div style="font-size: 0.85rem; opacity: 0.8;">Oluşturan</div>
        <div>${esc(expense.createdByName || "")}</div>
      </div>
    </div>

    ${expense.note ? `
      <div style="margin-bottom: 16px;">
        <div style="font-size: 0.85rem; opacity: 0.8; margin-bottom: 4px;">Notlar</div>
        <div style="background: rgba(0,0,0,.1); padding: 12px; border-radius: 8px;">
          ${esc(expense.note)}
        </div>
      </div>
    ` : ""}

    <div style="margin-bottom: 16px;">
      <div style="font-size: 0.85rem; opacity: 0.8; margin-bottom: 8px;">Katılımcılar</div>
      <div style="display: flex; flex-wrap: wrap; gap: 6px;">
        ${(expense.participants || []).map(p => {
          const name = p.type === "manual" ? p.name :
            usersCache.find(u => u.uid === p.uid)?.displayName ||
            usersCache.find(u => u.uid === p.uid)?.email ||
            p.uid?.slice(0, 6);
          return `<span class="chip ${p.uid === expense.payer ? "payer" : "user"}">${esc(name)}</span>`;
        }).join("")}
      </div>
    </div>

    <div style="font-size: 0.85rem; opacity: 0.7; margin-top: 16px;">
      Oluşturulma: ${esc(formatTime(expense.createdAt))}
    </div>
  `;

  expenseModal.classList.remove("hidden");
}

closeModalBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    expenseModal.classList.add("hidden");
    selectedExpenseId = null;
  });
});

editExpenseBtn.addEventListener("click", () => {
  if (!selectedExpenseId) return;

  const expense = allExpenses.find(e => e.id === selectedExpenseId);
  if (!expense) return;

  // ✅ entryType editte korunacak
  if (stEntryType) {
    stEntryType.value = expense.entryType || "EXPENSE";
    applyEntryTypeRules();
  }

  editingExpenseId = expense.id;

  stTitle.value = expense.title || "";
  stAmount.value = expense.amount ?? "";
  stCurrency.value = expense.currency || "TRY";
  stDate.value = expense.date || new Date().toISOString().split("T")[0];
  stCategory.value = expense.category || "diger";
  stNote.value = expense.note || "";

  manualParticipants = [];
  selectedParticipants.clear();

  const manualIndexByName = new Map();

  (expense.participants || []).forEach(p => {
    if (p?.type === "manual") {
      const name = String(p?.name || "").trim();
      if (!name) return;

      if (!manualIndexByName.has(name)) {
        manualParticipants.push(name);
        manualIndexByName.set(name, manualParticipants.length - 1);
      }
      const idx = manualIndexByName.get(name);
      selectedParticipants.add(`manual_${idx}`);
    } else {
      if (p?.uid) selectedParticipants.add(p.uid);
    }
  });

  if (expense.payer?.startsWith?.("manual_")) {
    const payerName = String(expense.payerName || "").trim();
    if (payerName) {
      if (!manualIndexByName.has(payerName)) {
        manualParticipants.push(payerName);
        manualIndexByName.set(payerName, manualParticipants.length - 1);
      }
      payerId = `manual_${manualIndexByName.get(payerName)}`;
    } else {
      payerId = null;
    }
  } else {
    payerId = expense.payer || null;
  }

  saveExpenseBtn.textContent = "Güncelle";
  stStatus.textContent = "Düzenleme modu: kaydı güncelle";
  expenseModal.classList.add("hidden");
  renderParticipantsList();
});


deleteExpenseBtn.addEventListener("click", async () => {
  if (!selectedExpenseId || !confirm("Bu harcamayı silmek istediğinize emin misiniz?")) return;

  try {
    await safe("Harcama sil", () => deleteDoc(doc(db, "expenses", selectedExpenseId)));
    expenseModal.classList.add("hidden");
    await safe("Harcama listesini yenile", () => loadExpenses());
    stStatus.textContent = "Harcama silindi";
  } catch {
    // safe zaten alertledi
  }
});

calculateSettlementBtn.addEventListener("click", calculateSettlement);

function calculateSettlement() {
  if (allExpenses.length === 0) {
    balanceTableContainer.innerHTML = `
      <div class="text-center" style="opacity: 0.7; padding: 20px;">
        Hesaplama yapmak için harcama kaydı bulunmuyor
      </div>
    `;
    return;
  }

  const balances = {};
  const total = { amount: 0, count: 0 };
  const allParticipants = new Set();

  allExpenses.forEach(expense => {
    const entryType = expense.entryType || "EXPENSE"; // YENİ

    // EXPENSE (mevcut mantık)
    if (entryType === "EXPENSE") {
      total.amount += expense.amount;
      total.count++;

      expense.participants?.forEach(p => {
        const id = p.type === "manual" ? p.name : p.uid;
        allParticipants.add(id);
      });

      const rawPayer = expense.payer;
      let payerKey = rawPayer;

      if (rawPayer?.startsWith?.("manual_")) {
        const idx = parseInt(rawPayer.split("_")[1], 10);
        payerKey = expense.payerName || `manual_${idx}`;
      }

      if (payerKey) balances[payerKey] = (balances[payerKey] || 0) + expense.amount;

      const participantCount = expense.participants?.length || 1;
      const share = expense.amount / participantCount;

      expense.participants?.forEach(p => {
        const id = p.type === "manual" ? p.name : p.uid;
        balances[id] = (balances[id] || 0) - share;
      });
    }
    // TRANSFER (yeni mantık) - YENİ
    else if (entryType === "TRANSFER") {
      // payerKey = gönderen
      const rawPayer = expense.payer;
      let payerKey = rawPayer;

      if (rawPayer?.startsWith?.("manual_")) {
        const idx = parseInt(rawPayer.split("_")[1], 10);
        payerKey = expense.payerName || `manual_${idx}`;
      }

      // alıcı = participants içindeki tek kişi
      const recipient = expense.participants?.[0];
      if (!payerKey || !recipient) return;

      const recipientKey = recipient.type === "manual" ? recipient.name : recipient.uid;

      // Transfer: gönderenin bakiyesi artar (+amount), alıcının bakiyesi azalır (-amount)
      balances[payerKey] = (balances[payerKey] || 0) + expense.amount;
      balances[recipientKey] = (balances[recipientKey] || 0) - expense.amount;

      // istatistiklere dahil et
      total.amount += expense.amount;
      total.count++;

      allParticipants.add(payerKey);
      allParticipants.add(recipientKey);
    }
  });

  totalExpenseEl.textContent = `${total.amount.toFixed(2)} TRY`;
  expenseCountEl.textContent = total.count;
  participantCountEl.textContent = allParticipants.size;
  averagePerPersonEl.textContent = allParticipants.size > 0
    ? `${(total.amount / allParticipants.size).toFixed(2)} TRY`
    : "0 TRY";

  let tableHTML = `
    <table class="balance-table">
      <thead>
        <tr>
          <th>Kişi</th>
          <th>Durum</th>
          <th>Tutar</th>
        </tr>
      </thead>
      <tbody>
  `;

  Object.entries(balances).forEach(([id, balance]) => {
    const name = getParticipantName(id) || id;
    const isPositive = balance > 0;
    const isNegative = balance < 0;
    const absBalance = Math.abs(balance);

    tableHTML += `
      <tr>
        <td>${esc(name)}</td>
        <td>${isPositive ? "Alacaklı" : isNegative ? "Borçlu" : "Dengeli"}</td>
        <td class="amount-cell ${isPositive ? "positive" : isNegative ? "negative" : "neutral"}">
          ${isPositive ? "+" : isNegative ? "-" : ""}${absBalance.toFixed(2)} TRY
        </td>
      </tr>
    `;
  });

  tableHTML += `
      </tbody>
    </table>
  `;

  balanceTableContainer.innerHTML = tableHTML;
}

exportDataBtn.addEventListener("click", () => {
  if (allExpenses.length === 0) return alert("Dışa aktarılacak veri bulunmuyor");

  const data = {
    expenses: allExpenses,
    summary: {
      total: totalExpenseEl.textContent,
      count: expenseCountEl.textContent,
      participants: participantCountEl.textContent,
      average: averagePerPersonEl.textContent
    },
    exportedAt: new Date().toISOString()
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mahsuplasma-${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);

  stStatus.textContent = "Veri dışa aktarıldı";
});

sendSummaryBtn.addEventListener("click", async () => {
  if (!uid) return;

  try {
    const messagesRef = collection(db, "rooms", "public", "messages");
    await safe("Özet chat'e gönder", () =>
      addDoc(messagesRef, {
        text: `📊 Mahsuplaşma özeti:\nToplam: ${totalExpenseEl.textContent}\nHarcama sayısı: ${expenseCountEl.textContent}\nKatılımcılar: ${participantCountEl.textContent}`,
        uid,
        name: auth.currentUser?.displayName || auth.currentUser?.email || "user",
        createdAt: serverTimestamp()
      })
    );

    stStatus.textContent = "Özet chat'e gönderildi";
    setTimeout(() => stStatus.textContent = "Hazır", 1500);
  } catch {
    // safe zaten alertledi
  }
});

function renderPayerOptions() {
  if (!payerSelect) return;

  const entryType = stEntryType?.value || "EXPENSE";
  const currentUiValue = payerSelect.value; // UI'daki mevcut seçim
  payerSelect.innerHTML = `<option value="">— Seç —</option>`;

  // TRANSFER: alıcı = selectedParticipants içindeki tek kişi
  const recipientId = entryType === "TRANSFER"
    ? (selectedParticipants.values().next().value || null)
    : null;

  const options = [];

  if (entryType === "TRANSFER") {
    // payer seçenekleri: tüm user + tüm manual (alıcı hariç)
    usersCache.forEach(u => {
      if (u.uid !== recipientId) {
        options.push({ id: u.uid, name: u.displayName || u.email || u.uid });
      }
    });

    manualParticipants.forEach((name, index) => {
      const id = `manual_${index}`;
      if (id !== recipientId) {
        options.push({ id, name: name || "manuel" });
      }
    });
  } else {
    // EXPENSE: payer seçenekleri sadece seçili katılımcılardan
    selectedParticipants.forEach(id => {
      if (id.startsWith("manual_")) {
        const idx = parseInt(id.split("_")[1], 10);
        options.push({ id, name: manualParticipants[idx] || "manuel" });
      } else {
        const u = usersCache.find(x => x.uid === id);
        options.push({ id, name: u?.displayName || u?.email || id });
      }
    });
  }

  options
    .sort((a, b) => a.name.localeCompare(b.name, "tr"))
    .forEach(o => {
      const opt = document.createElement("option");
      opt.value = o.id;
      opt.textContent = o.name;
      payerSelect.appendChild(opt);
    });

  // payerId/UI seçim koruma (TRANSFER'de recipient olamaz)
  const isValid = (id) => {
    if (!id) return false;
    if (entryType === "TRANSFER" && recipientId && id === recipientId) return false;
    return options.some(o => o.id === id);
  };

  if (isValid(currentUiValue)) {
    payerSelect.value = currentUiValue;
    payerId = currentUiValue;
    return;
  }

  if (isValid(payerId)) {
    payerSelect.value = payerId;
    return;
  }

  // otomatik payer seçme: TRANSFER'de otomatik seçme yapma (kullanıcı seçsin)
  payerId = null;
  payerSelect.value = "";
}



/* ---------- AUTH STATE ---------- */
onAuthStateChanged(auth, async (user) => {
  try {
    if (!user) {
      uid = null;
      statusEl.textContent = "Giriş bekleniyor…";
      loginBtn.style.display = "inline-block";
      logoutBtn.style.display = "none";

      sendChat && (sendChat.disabled = true);
      saveExpenseBtn && (saveExpenseBtn.disabled = true);

      if (unsubChat) { unsubChat(); unsubChat = null; }
      return;
    }

    uid = user.uid;
    const displayName = user.displayName || user.email || "Bağlandı";
    statusEl.textContent = displayName.length > 18 ? displayName.slice(0, 18) + "…" : displayName;
    statusEl.title = displayName;

    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";

    initOwnerGate();

    await upsertUser(user);

    if (view === "chat") {
      sendChat.disabled = false;

      if (unsubChat) { unsubChat(); unsubChat = null; }
      const q = query(collection(db, "rooms", "public", "messages"), orderBy("createdAt", "asc"), limit(300));
      unsubChat = onSnapshot(q, (snap) => {
        msgsEl.innerHTML = "";
        snap.forEach(docSnap => renderMsg(docSnap.data()));
        scrollBottom();
      }, (e) => {
        console.error("onSnapshot error:", e);
        statusEl.textContent = `Chat hata: ${e.code || ""}`;
        alert(`Chat dinleme hatası: ${e.code || ""} ${e.message || e}`);
      });
    }

    if (view === "settlement") {
      saveExpenseBtn.disabled = false;
      await loadUsersForParticipants();
      await loadExpenses();
    }
  } catch (e) {
    console.error("authStateChanged fatal:", e);
    alert(`Auth state hata: ${e.code || ""} ${e.message || e}`);
  }
});

function playSettlementSound() {
  try {
    const a = document.getElementById("settlementSound");
    if (!a) return;
    a.currentTime = 0;
    a.play().catch(() => {
      // autoplay engeline takılabilir; kullanıcı etkileşimi sonrası çalışır
    });
  } catch (e) {
    console.warn("sound play failed", e);
  }
}

function playTransferSound() {
  try {
    const a = document.getElementById("transferSound");
    if (!a) return;
    a.currentTime = 0;
    a.play().catch(() => {
      // autoplay engeline takılabilir
    });
  } catch (e) {
    console.warn("transfer sound play failed", e);
  }
}

