import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { installGlobalErrorHandlers } from "./lib/error-report";
import { initNavTracking } from "./lib/nav-history";

installGlobalErrorHandlers();
initNavTracking();

createRoot(document.getElementById("root")!).render(<App />);
