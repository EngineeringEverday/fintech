import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Dark mode first — set on root before render.
document.documentElement.classList.add("dark");

if (!window.location.hash) {
  window.location.hash = "#/";
}

createRoot(document.getElementById("root")!).render(<App />);
