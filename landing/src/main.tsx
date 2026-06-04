import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/geist-mono";
import "./index.css";
import { MotionConfig } from "motion/react";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </React.StrictMode>,
);
