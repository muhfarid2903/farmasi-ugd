import { useEffect } from "react";

export interface ToastMessage {
  id: number;
  text: string;
  kind: "success" | "error";
}

export function Toast({ toast, onDone }: { toast: ToastMessage | null; onDone: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDone, toast.kind === "error" ? 9000 : 4500);
    return () => clearTimeout(t);
  }, [toast, onDone]);

  if (!toast) return null;
  return (
    <div className={`toast toast-${toast.kind}`} role="status" onClick={onDone}>
      {toast.text}
    </div>
  );
}
