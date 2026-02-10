// input: react-router + context/auth.tsx + context/vault.tsx + pages/*
// output: 应用根组件，路由 + Provider 组装
// pos: 整个 SPA 的入口组件，挂载在 main.tsx
// 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md。

import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { AuthProvider, useAuth } from "@/context/auth";
import { VaultProvider } from "@/context/vault";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Vault from "@/pages/Vault";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/vault"
        element={
          <RequireAuth>
            <VaultProvider>
              <Vault />
            </VaultProvider>
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/vault" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
