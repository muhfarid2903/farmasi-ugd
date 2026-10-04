import { useCallback, useState } from "react";
import { FontSizeModal } from "./components/FontSizeModal";
import { Header } from "./components/Header";
import { Icon, type IconName } from "./components/Icon";
import { SyncBadge } from "./components/SyncBadge";
import { Toast, type ToastMessage } from "./components/Toast";
import { BerandaPage } from "./features/beranda/BerandaPage";
import { ExportModal } from "./features/laporan/ExportModal";
import { BantuanPage } from "./features/bantuan/BantuanPage";
import { TourModal } from "./features/bantuan/TourModal";
import { PengaturanPage } from "./features/pengaturan/PengaturanPage";
import { ItemFormModal } from "./features/stok/ItemFormModal";
import { StokPage } from "./features/stok/StokPage";
import { TransaksiPage } from "./features/transaksi/TransaksiPage";
import { TxWizard, type NewTx } from "./features/transaksi/TxWizard";
import { VoidTxModal } from "./features/transaksi/VoidTxModal";
import { logout } from "./hooks/useAuth";
import { useFirstVisit } from "./hooks/useFirstVisit";
import { useFontScale } from "./hooks/useFontScale";
import { useInventory } from "./hooks/useInventory";
import { nowISO, todayStr } from "./lib/date";
import * as repo from "./lib/repository";
import { canVoid, isLowStock, stockChanges, validateStockChanges, voidTxData } from "./lib/stock";
import type { Item, Page, Transaction, TxType, UserProfile } from "./types";

type ModalState =
  | { kind: "tx"; type: TxType }
  | { kind: "void"; tx: Transaction }
  | { kind: "item"; editItem?: Item }
  | { kind: "export" }
  | { kind: "font" }
  | { kind: "tour" }
  | null;

const NAV: { page: Page; label: string; icon: IconName; adminOnly?: boolean }[] = [
  { page: "beranda", label: "Beranda", icon: "home" },
  { page: "stok", label: "Stok", icon: "package" },
  { page: "riwayat", label: "Riwayat", icon: "clock" },
  { page: "bantuan", label: "Bantuan", icon: "help" },
  { page: "pengaturan", label: "Pengaturan", icon: "settings", adminOnly: true },
];

export default function App({ profile }: { profile: UserProfile }) {
  const { items, transactions, loading, syncStatus, error } = useInventory();
  const [page, setPage] = useState<Page>("beranda");
  const [modal, setModal] = useState<ModalState>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [fontScale, setFontScale] = useFontScale();
  const [firstVisit, markTourSeen] = useFirstVisit(`tour.${profile.email}`);
  const isAdmin = profile.role === "admin";
  const nav = NAV.filter((n) => !n.adminOnly || isAdmin);

  const notify = useCallback((text: string, kind: ToastMessage["kind"]) => {
    setToast({ id: Date.now(), text, kind });
  }, []);
  const clearToast = useCallback(() => setToast(null), []);
  const closeModal = useCallback(() => setModal(null), []);

  /** Kegagalan dari server (biasanya baru diketahui setelah ada sinyal) dilaporkan lewat pesan merah. */
  const reportFailure = useCallback(
    (promise: Promise<void>) =>
      promise.catch((e: Error) => {
        console.error(e);
        notify(`Gagal menyimpan ke server. Periksa sinyal lalu coba lagi. (${e.message})`, "error");
      }),
    [notify],
  );

  /**
   * Jalankan penulisan ke Firestore tanpa menunggu server. Perubahan langsung berlaku
   * di cache lokal (juga saat offline).
   */
  const write = useCallback(
    (promise: Promise<void>, success: string) => {
      notify(navigator.onLine ? success : `${success}. Akan terkirim saat ada sinyal.`, "success");
      reportFailure(promise);
    },
    [notify, reportFailure],
  );

  const userCanVoid = useCallback((tx: Transaction) => canVoid(tx, profile), [profile]);

  function handleWizardSave(data: NewTx): string {
    const { id, done } = repo.saveTransaction({ ...data, operator: profile.name, email: profile.email });
    reportFailure(done);
    return id;
  }

  /** Batalkan transaksi yang baru disimpan dari layar "Tersimpan". */
  function handleWizardUndo(txId: string, data: NewTx): string | null {
    const tx: Transaction = { ...data, id: txId, operator: profile.name, email: profile.email, createdAt: nowISO() };
    const voidData = voidTxData(tx, profile, todayStr(), "Salah catat");
    const blocked = validateStockChanges(stockChanges(voidData), items);
    if (blocked) return blocked;
    reportFailure(repo.saveTransaction(voidData).done);
    return null;
  }

  function handleVoidTx(tx: Transaction, reason: string) {
    write(repo.saveTransaction(voidTxData(tx, profile, todayStr(), reason)).done, "Catatan sudah dibatalkan");
    setModal(null);
  }

  function handleSaveItem(data: repo.ItemData, editItem?: Item) {
    if (editItem) {
      // Stok hanya ditulis jika diubah, agar tidak menimpa transaksi dari perangkat lain
      const { stock, ...rest } = data;
      write(repo.updateItem(editItem.id, stock === editItem.stock ? rest : data), "Data barang disimpan");
    } else {
      write(repo.addItem(data), "Barang baru ditambahkan");
    }
    setModal(null);
  }

  function handleDeleteItem(item: Item) {
    write(repo.deleteItem(item.id), `${item.name} dihapus dari daftar`);
    setModal(null);
  }

  function closeTour() {
    markTourSeen();
    setModal(null);
  }

  function handleSaveUser(user: UserProfile, isNew: boolean) {
    write(repo.saveUser(user), isNew ? `${user.name} ditambahkan` : `Data ${user.name} disimpan`);
  }

  const openNewTx = (type: TxType) => setModal({ kind: "tx", type });
  const openVoidTx = (tx: Transaction) => setModal({ kind: "void", tx });
  const openAddItem = () => setModal({ kind: "item" });
  const openExport = () => setModal({ kind: "export" });

  if (loading) {
    return (
      <div className="app">
        <Header />
        <div className="loading-screen">
          <div className="spinner" />
          <div>Membuka data...</div>
        </div>
      </div>
    );
  }

  const lowCount = items.filter(isLowStock).length;
  const voidPreview = modal?.kind === "void" ? voidTxData(modal.tx, profile, todayStr(), "") : null;

  return (
    <div className="app">
      <Header
        right={
          <>
            <SyncBadge status={syncStatus} />
            <button className="btn btn-ghost btn-sm" onClick={() => setModal({ kind: "font" })}>
              Aa <span className="user-name">Ukuran huruf</span>
            </button>
            <div className="user-chip" title={profile.email}>
              <span className="user-name">{profile.name}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => logout()}>
                <Icon type="logout" size={16} /> Keluar
              </button>
            </div>
          </>
        }
      />
      <div className="main-area">
        <nav className="sidebar" aria-label="Menu utama">
          {nav.map((n) => (
            <button
              key={n.page}
              className={`nav-btn${page === n.page ? " active" : ""}`}
              aria-current={page === n.page ? "page" : undefined}
              onClick={() => setPage(n.page)}
            >
              <Icon type={n.icon} size={22} /> {n.label}
              {n.page === "stok" && lowCount > 0 && (
                <span className="badge" title={`${lowCount} barang hampir habis`}>
                  {lowCount}
                </span>
              )}
            </button>
          ))}
        </nav>
        <main className="content">
          {error && <div className="form-error">Data tidak bisa dibuka: {error}</div>}
          {page === "beranda" && (
            <BerandaPage
              userName={profile.name}
              items={items}
              transactions={transactions}
              onNewTx={openNewTx}
              onShowStock={() => setPage("stok")}
              onShowHistory={() => setPage("riwayat")}
              onExport={openExport}
              onAddItem={isAdmin ? openAddItem : undefined}
            />
          )}
          {page === "stok" && (
            <StokPage
              items={items}
              isAdmin={isAdmin}
              onAddItem={openAddItem}
              onEditItem={(item) => setModal({ kind: "item", editItem: item })}
            />
          )}
          {page === "riwayat" && (
            <TransaksiPage
              items={items}
              transactions={transactions}
              onNewTx={openNewTx}
              canVoid={userCanVoid}
              onVoidTx={openVoidTx}
              onExport={openExport}
            />
          )}
          {page === "bantuan" && <BantuanPage onShowTour={() => setModal({ kind: "tour" })} />}
          {page === "pengaturan" && isAdmin && (
            <PengaturanPage
              currentEmail={profile.email}
              onSaveUser={handleSaveUser}
              onAddItem={openAddItem}
              onShowStock={() => setPage("stok")}
              onExport={openExport}
            />
          )}
        </main>
      </div>

      <nav className="mobile-nav" aria-label="Menu utama">
        <div className="mobile-nav-inner">
          {nav.map((n) => (
            <button
              key={n.page}
              className={`mobile-nav-btn${page === n.page ? " active" : ""}`}
              aria-current={page === n.page ? "page" : undefined}
              onClick={() => setPage(n.page)}
            >
              <Icon type={n.icon} size={24} /> {n.label}
            </button>
          ))}
        </div>
      </nav>

      {modal?.kind === "tx" && (
        <TxWizard
          type={modal.type}
          items={items}
          transactions={transactions}
          operatorName={profile.name}
          onSave={handleWizardSave}
          onUndo={handleWizardUndo}
          onClose={closeModal}
        />
      )}
      {modal?.kind === "void" && voidPreview && (
        <VoidTxModal
          tx={modal.tx}
          blockedReason={validateStockChanges(stockChanges(voidPreview), items)}
          onConfirm={(reason) => handleVoidTx(modal.tx, reason)}
          onClose={closeModal}
        />
      )}
      {modal?.kind === "item" && (
        <ItemFormModal
          editItem={modal.editItem}
          onSubmit={handleSaveItem}
          onDelete={handleDeleteItem}
          onClose={closeModal}
        />
      )}
      {modal?.kind === "export" && <ExportModal transactions={transactions} onClose={closeModal} notify={notify} />}
      {(modal?.kind === "tour" || (firstVisit && modal === null)) && <TourModal onClose={closeTour} />}
      {modal?.kind === "font" && <FontSizeModal scale={fontScale} onChange={setFontScale} onClose={closeModal} />}

      <Toast key={toast?.id} toast={toast} onDone={clearToast} />
    </div>
  );
}
