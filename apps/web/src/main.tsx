import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { AuthProvider } from "./auth/AuthProvider";
import { DeveloperModeProvider } from "./contexts/DeveloperModeProvider";
import axios from "axios";

import "./index.css";
import "./config/api"; // API 설정 import (fetch 인터셉터 포함)

// Axios 글로벌 설정
axios.defaults.baseURL = import.meta.env.VITE_BFF_URL || 'http://localhost:8787';

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <DeveloperModeProvider>
        <RouterProvider router={router} />
      </DeveloperModeProvider>
    </AuthProvider>
  </StrictMode>
);
