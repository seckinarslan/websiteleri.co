import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

const OWNER_UID = "4S7u8Syq1dYfJyVhCrUJNhY1QmD3";

const firebaseConfig = {
  apiKey: "AIzaSyDN0zwDiK0MveXRkykgkhG-p-oqBvanF7U",
  authDomain: "websitelerico.firebaseapp.com",
  projectId: "websitelerico",
  storageBucket: "websitelerico.firebasestorage.app",
  messagingSenderId: "848484251740",
  appId: "1:848484251740:web:a7692eeef83ca05e3b4e99",
  measurementId: "G-9V22FDX9N0"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export function initOwnerGate() {
  const openMainThreadBtn = document.getElementById("openMainThread");
  
  if (!openMainThreadBtn) return;

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      openMainThreadBtn.style.display = "none";
      return;
    }

    openMainThreadBtn.style.display = "inline-block";

    if (user.uid === OWNER_UID) {
      openMainThreadBtn.disabled = false;
      openMainThreadBtn.style.opacity = "1";
      openMainThreadBtn.style.pointerEvents = "auto";
      openMainThreadBtn.removeAttribute("title");
      openMainThreadBtn.title = "";
      openMainThreadBtn.addEventListener("click", () => {
        window.open("main-thread.html", "_blank", "noopener,noreferrer");
      });
    } else {
      openMainThreadBtn.disabled = true;
      openMainThreadBtn.style.opacity = "0.5";
      openMainThreadBtn.style.pointerEvents = "none";
      openMainThreadBtn.title = "Sadece owner açabilir";
    }
  });
}
