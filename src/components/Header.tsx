import type { ReactNode } from "react";

export function Header({ right }: { right?: ReactNode }) {
  return (
    <div className="header">
      <div className="header-logo">+</div>
      <div>
        <div className="header-title">UGD Puskesmas L. Tupabbiring</div>
        <div className="header-sub">Kab. Pangkep</div>
      </div>
      {right && <div className="header-right">{right}</div>}
    </div>
  );
}
