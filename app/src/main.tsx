import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { StudioErrorBoundary } from "./shell/ErrorBoundary";
import "./styles.css";

// D89: any render error shows a card with its text, «أعد المحاولة» and «ارجع إلى الرئيسية» — never a white page.
createRoot(document.getElementById("root")!).render(<StudioErrorBoundary scope="app"><App /></StudioErrorBoundary>);
