"use client";

import { useEffect } from "react";

interface ToastProps {
  message: string;
  onClose: () => void;
  duration?: number;
  action?: { label: string; onClick: () => void };
}

export function Toast({ message, onClose, duration = 3000, action }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  return (
    <div className="safe-area-toast fixed bottom-4 right-4 z-50 bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] px-4 py-2 rounded-lg shadow-lg text-sm animate-fade-in flex items-center gap-3">
      <span>{message}</span>
      {action && (
        <button
          onClick={() => {
            action.onClick();
            onClose();
          }}
          className="text-[var(--amber)] hover:underline font-medium"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
