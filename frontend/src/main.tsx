import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import App from "./App.tsx"

// Default to dark mode on initial load.
if (typeof document !== "undefined") {
  document.documentElement.classList.add("dark")
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
