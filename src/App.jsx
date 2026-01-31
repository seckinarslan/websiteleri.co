import ChatPage from "./pages/ChatPage";
import SettlementPage from "./pages/SettlementPage";
import AuthBar from "./auth/AuthBar";
import { useState } from "react";

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 14px",
        borderRadius: 10,
        border: "1px solid #ddd",
        background: active ? "#111" : "#fff",
        color: active ? "#fff" : "#111",
        cursor: "pointer",
        fontWeight: 600,
      }}
    >
      {children}
    </button>
  );
}

export default function App() {
  const [tab, setTab] = useState("chat");

  return (
    <div className="wrap">
      <header className="top">
        <h2>websiteleri.co</h2>

        <div className="auth-section">
          <TabButton active={tab === "chat"} onClick={() => setTab("chat")}>
            Chat
          </TabButton>
          <TabButton
            active={tab === "settlement"}
            onClick={() => setTab("settlement")}
          >
            Mahsuplaşma
          </TabButton>

          <AuthBar />
        </div>
      </header>

      {tab === "chat" ? <ChatPage /> : <SettlementPage />}
    </div>
  );

}
