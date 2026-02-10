"use client";

import { Toaster } from "sonner";

export function ToastProvider() {
  return (
    <Toaster
      theme="dark"
      position="bottom-right"
      toastOptions={{
        style: {
          background: "rgba(10, 10, 10, 0.95)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          color: "#E5E5E5",
          backdropFilter: "blur(12px)",
        },
      }}
      closeButton
    />
  );
}
