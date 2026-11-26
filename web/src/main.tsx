import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "./App"
import { installApiFetch } from "./app/api-fetch"
import "./index.css"

installApiFetch()
const root = document.getElementById("root")
if (!root) throw new Error("Missing #root element")
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
