import type { ReactNode } from "react";

export function Header({ right }: { right?: ReactNode }) {
  return (
    <div className="header">
      <img className="header-logo" src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width="40" height="40" />
      <div>
        <div className="header-title">
          {/* "e-Stok" tidak dipotong di tanda hubung saat bar atas sempit */}
          <span className="nowrap">e-Stok</span> UGD
        </div>
        <div className="header-sub">Puskesmas Liukang Tupabbiring</div>
      </div>
      {right && <div className="header-right">{right}</div>}
    </div>
  );
}
