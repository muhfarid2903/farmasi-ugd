import type { ReactNode } from "react";

export function Header({ right }: { right?: ReactNode }) {
  return (
    <div className="header">
      <div className="header-logo" aria-hidden="true">
        +
      </div>
      <div>
        <div className="header-title">UGD Liukang Tupabbiring</div>
        <div className="header-sub">Catatan Obat & Bahan Medis</div>
      </div>
      {right && <div className="header-right">{right}</div>}
    </div>
  );
}
