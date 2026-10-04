import { useEffect, type ReactNode } from "react";
import { useBackButton } from "../hooks/useBackButton";
import { Icon } from "./Icon";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ title, onClose, children }: ModalProps) {
  // Tombol Kembali di HP menutup dialog ini
  const requestClose = useBackButton(() => onClose());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && requestClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [requestClose]);

  return (
    <div className="modal-overlay" onClick={requestClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">
          <span>{title}</span>
          <button className="btn btn-ghost btn-sm" onClick={requestClose}>
            <Icon type="x" size={18} /> Tutup
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
