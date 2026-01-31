import { auth, db } from "../services/firebase";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { safe } from "../utils/safe";

import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";

function formatTs(ts) {
  try {
    const d = ts?.toDate?.() ? ts.toDate() : null;
    if (!d) return "";
    return d.toLocaleString();
  } catch {
    return "";
  }
}

export default function ChatPage() {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  const { user } = useAuth();
  const uid = user?.uid;

  const messagesQuery = useMemo(() => {
    const ref = collection(db, "rooms", "public", "messages");
    return query(ref, orderBy("createdAt", "desc"), limit(50));
  }, []);

  useEffect(() => {
    // giriş yoksa listeyi temiz göster
    if (!uid) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsub = onSnapshot(
      messagesQuery,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMessages(rows);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        console.error("onSnapshot error:", err);
        alert(`Chat dinleme hata: ${err.code || ""} ${err.message || err}`);
      }
    );

    return () => unsub();
  }, [uid, messagesQuery]);

  async function onSubmit(e) {
    e.preventDefault();

    const trimmed = text.trim();
    if (!trimmed || !uid) return;

    setSending(true);
    try {
      const messagesRef = collection(db, "rooms", "public", "messages");
      await safe("Chat mesajı gönder", () =>
        addDoc(messagesRef, {
          text: trimmed,
          uid,
          name: auth.currentUser?.displayName || auth.currentUser?.email || "user",
          createdAt: serverTimestamp(),
        })
      );

      setText("");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="chat">
        <div className="msgs" style={{ display: "flex", flexDirection: "column-reverse" }}>
        {loading && <div style={{ opacity: 0.7 }}>Yükleniyor…</div>}

        {!loading && messages.length === 0 && (
            <div style={{ opacity: 0.7 }}>Henüz mesaj yok.</div>
        )}

        {messages.map((m) => (
            <div key={m.id} className={`msg ${m.uid === uid ? "me" : ""}`}>
            <div className="meta">
                <span>{m.name || "user"}</span>
                <span className="time">{formatTs(m.createdAt)}</span>
            </div>
            <div className="msg-content">{m.text}</div>
            </div>
        ))}
        </div>

        <form className="chatbar" onSubmit={onSubmit}>
        <input
            id="chatText"
            name="chatText"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1000}
            placeholder="Mesaj yaz…"
            autoComplete="off"
        />
        <button type="submit" disabled={sending || !uid}>
            {sending ? "Gönderiliyor..." : "Gönder"}
        </button>
        </form>
    </div>
);

}
