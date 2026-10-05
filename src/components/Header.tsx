import type { ReactNode } from "react";

export function Header({ right }: { right?: ReactNode }) {
  return (
    <div className="header">
      <div className="header-logo" aria-hidden="true">
        +
      </div>
      <div>
        <div className="header-title">e-Stok UGD</div>
        <div className="header-sub">Puskesmas Liukang Tupabbiring</div>
      </div>
      {right && <div className="header-right">{right}</div>}
    </div>
  );
}
