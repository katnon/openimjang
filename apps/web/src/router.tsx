import { createBrowserRouter } from "react-router-dom";
import Home from "@/pages/Home";

export const router = createBrowserRouter([
    { path: "/", element: <Home /> },
    // 추후: { path: "/detail/:id", element: <Detail /> },
    // 추후: { path: "/my", element: <MyImjang /> },
]);
