import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { AuthProvider } from "./auth/AuthProvider";
import { DeveloperModeProvider } from "./contexts/DeveloperModeProvider";
import axios from "axios";

import "./index.css";

// Axios 글로벌 설정
axios.defaults.baseURL = import.meta.env.VITE_API_BASE;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <DeveloperModeProvider>
        <RouterProvider router={router} />
      </DeveloperModeProvider>
    </AuthProvider>
  </StrictMode>
);
