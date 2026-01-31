import { initGlobalErrorCapture } from "./utils/errorCapture";
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import "./styles/app.css";
import { AuthProvider } from "./auth/AuthContext";
import App from './App.jsx'

initGlobalErrorCapture();
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
