import { createRoot } from "react-dom/client";
import { setExtraHeadersGetter } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";
import { getAdminToken } from "./lib/admin-token-store";

document.documentElement.classList.add("dark");

setExtraHeadersGetter(() => {
  const t = getAdminToken();
  return t ? { "x-admin-token": t } : null;
});

createRoot(document.getElementById("root")!).render(<App />);
