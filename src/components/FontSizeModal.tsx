import { FONT_SCALES } from "../hooks/useFontScale";
import { Icon } from "./Icon";
import { Modal } from "./Modal";

interface FontSizeModalProps {
  scale: number;
  onChange: (scale: number) => void;
  onClose: () => void;
}

export function FontSizeModal({ scale, onChange, onClose }: FontSizeModalProps) {
  return (
    <Modal title="Ukuran Huruf" onClose={onClose}>
      <p className="page-sub">Pilih ukuran yang paling nyaman dibaca. Pilihan ini hanya berlaku di HP ini.</p>
      <div className="font-options">
        {FONT_SCALES.map((s) => (
          <button
            key={s.value}
            className={`font-option${scale === s.value ? " active" : ""}`}
            style={{ fontSize: `calc(${s.value}rem / var(--font-scale))` }}
            onClick={() => onChange(s.value)}
            aria-pressed={scale === s.value}
          >
            {s.label}
            {scale === s.value && <Icon type="check" size={20} />}
          </button>
        ))}
      </div>
      <div className="modal-actions spaced">
        <button className="btn btn-primary btn-block" onClick={onClose}>
          Selesai
        </button>
      </div>
    </Modal>
  );
}
