import { useAuth } from "../auth/AuthContext";

export default function AuthBar() {
  const { user, login, logout } = useAuth();

  if (user === undefined) {
    return <div style={{ opacity: 0.7 }}>Giriş kontrol ediliyor…</div>;
  }

  if (!user) {
    return (
      <button
        onClick={login}
        style={{
          padding: "10px 14px",
          borderRadius: 10,
          border: "1px solid #ddd",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        Google ile giriş
      </button>
    );
  }

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <div style={{ opacity: 0.8, fontSize: 14 }}>
        {user.displayName || user.email}
      </div>
      <button
        onClick={logout}
        style={{
          padding: "10px 14px",
          borderRadius: 10,
          border: "1px solid #ddd",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        Çıkış
      </button>
    </div>
  );
}
