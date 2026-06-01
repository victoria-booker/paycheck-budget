import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import PaycheckBudget from "./paycheck-budget";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PaycheckBudget />
  </StrictMode>
);
