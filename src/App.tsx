import { useCallback, useState } from "react";
import { Header } from "./components/Header";
import { Icon, type IconName } from "./components/Icon";
import { SyncBadge } from "./components/SyncBadge";
import { Toast, type ToastMessage } from "./components/Toast";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { ExportModal } from "./features/laporan/ExportModal";
import { PetugasPage } from "./features/petugas/PetugasPage";
import { ItemFormModal } from "./features/stok/ItemFormModal";
import { StokPage } from "./features/stok/StokPage";
import { TransaksiPage } from "./features/transaksi/TransaksiPage";
import { TxFormModal } from "./features/transaksi/TxFormModal";
import { VoidTxModal } from "./features/transaksi/VoidTxModal";
import { logout } from "./hooks/useAuth";
import { useInventory } from "./hooks/useInventory";
import { todayStr } from "./lib/date";
import * as repo from "./lib/repository";
import { canVoid, isLowStock, stockChanges, validateStockChanges, voidTxData, type TxData } from "./lib/stock";
import type { Item, Page, Transaction, TxType, UserProfile } from "./types";

type ModalState =
  | { kind: "tx"; type: TxType }
  | { kind: "void"; tx: Transaction }
  | { kind: "item"; editItem?: Item }
  | { kind: "export" }
  | null;

const NAV: { page: Page; label: string; short: string; icon: IconName; adminOnly?: boolean }[] = [
  { page: "dashboard", label: "Dashboard", short: "Home", icon: "home" },
  { page: "stok", label: "Data Stok", short: "Stok", icon: "package" },
  { page: "transaksi", label: "Transaksi", short: "Transaksi", icon: "clock" },
  { page: "petugas", label: "Petugas", short: "Petugas", icon: "users", adminOnly: true },
];

export default function App({ profile }: { profile: UserProfile }) {
  const { items, transactions, loading, syncStatus, error } = useInventory();
  const [page, setPage] = useState<Page>("dashboard");
  const [modal, setModal] = useState<ModalState>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const isAdmin = profile.role === "admin";
  const nav = NAV.filter((n) => !n.adminOnly || isAdmin);

  const notify = useCallback((text: string, kind: ToastMessage["kind"]) => {
    setToast({ id: Date.now(), text, kind });
  }, []);
  const clearToast = useCallback(() => setToast(null), []);
  const closeModal = useCallback(() => setModal(null), []);

  /**
   * Jalankan penulisan ke Firestore tanpa menunggu server. Perubahan langsung berlaku
   * di cache lokal (juga saat offline); kegagalan dari server dilaporkan lewat toast.
   */
  const write = useCallback(
    (promise: Promise<void>, success: string) => {
      notify(navigator.onLine ? success : `${success} (akan terkirim saat ada sinyal)`, "success");
      promise.catch((e: Error) => {
        console.error(e);
        notify(`Gagal menyimpan ke server: ${e.message}`, "error");
      });
    },
    [notify],
  );

  const userCanVoid = useCallback((tx: Transaction) => canVoid(tx, profile), [profile]);

  function handleSaveTx(data: Omit<TxData, "operator" | "email">) {
    write(repo.saveTransaction({ ...data, operator: profile.name, email: profile.email }), "Transaksi tersimpan");
    setModal(null);
  }

  function handleVoidTx(tx: Transaction, reason: string) {
    write(repo.saveTransaction(voidTxData(tx, profile, todayStr(), reason)), "Transaksi dibatalkan");
    setModal(null);
  }

  function handleSaveItem(data: repo.ItemData, editItem?: Item) {
    if (editItem) {
      // Stok hanya ditulis jika diubah, agar tidak menimpa transaksi dari perangkat lain
      const { stock, ...rest } = data;
      write(repo.updateItem(editItem.id, stock === editItem.stock ? rest : data), "Item diperbarui");
    } else {
      write(repo.addItem(data), "Item ditambahkan");
    }
    setModal(null);
  }

  function handleDeleteItem(item: Item) {
    if (window.confirm(`Yakin hapus "${item.name}"?`)) write(repo.deleteItem(item.id), "Item dihapus");
  }

  function handleToggleKritis(item: Item) {
    write(repo.updateItem(item.id, { kritis: !item.kritis }), item.kritis ? "Tanda kritis dilepas" : "Ditandai kritis");
  }

  function handleSaveUser(user: UserProfile, isNew: boolean) {
    write(repo.saveUser(user), isNew ? `${user.name} ditambahkan` : `${user.name} diperbarui`);
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
          <div>Menghubungkan ke database...</div>
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
            <div className="user-chip" title={profile.email}>
              <span className="user-name">{profile.name}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => logout()} aria-label="Keluar" title="Keluar">
                <Icon type="logout" size={14} />
              </button>
            </div>
          </>
        }
      />
      <div className="main-area">
        <nav className="sidebar">
          {nav.map((n) => (
            <button
              key={n.page}
              className={`nav-btn${page === n.page ? " active" : ""}`}
              onClick={() => setPage(n.page)}
            >
              <Icon type={n.icon} size={18} /> {n.label}
              {n.page === "stok" && lowCount > 0 && <span className="badge">{lowCount}</span>}
            </button>
          ))}
        </nav>
        <main className="content">
          {error && <div className="form-error">Gagal memuat data: {error}</div>}
          {page === "dashboard" && (
            <DashboardPage
              items={items}
              transactions={transactions}
              onNewTx={openNewTx}
              canVoid={userCanVoid}
              onVoidTx={openVoidTx}
              onAddItem={isAdmin ? openAddItem : undefined}
              onExport={openExport}
            />
          )}
          {page === "stok" && (
            <StokPage
              items={items}
              isAdmin={isAdmin}
              onAddItem={openAddItem}
              onEditItem={(item) => setModal({ kind: "item", editItem: item })}
              onDeleteItem={handleDeleteItem}
              onToggleKritis={handleToggleKritis}
            />
          )}
          {page === "transaksi" && (
            <TransaksiPage
              transactions={transactions}
              onNewTx={openNewTx}
              canVoid={userCanVoid}
              onVoidTx={openVoidTx}
              onExport={openExport}
            />
          )}
          {page === "petugas" && isAdmin && <PetugasPage currentEmail={profile.email} onSave={handleSaveUser} />}
        </main>
      </div>

      <nav className="mobile-nav">
        <div className="mobile-nav-inner">
          {nav.map((n) => (
            <button
              key={n.page}
              className={`mobile-nav-btn${page === n.page ? " active" : ""}`}
              onClick={() => setPage(n.page)}
            >
              <Icon type={n.icon} size={20} /> {n.short}
            </button>
          ))}
        </div>
      </nav>

      {modal?.kind === "tx" && (
        <TxFormModal
          items={items}
          initialType={modal.type}
          operatorName={profile.name}
          onSubmit={handleSaveTx}
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
        <ItemFormModal editItem={modal.editItem} onSubmit={handleSaveItem} onClose={closeModal} />
      )}
      {modal?.kind === "export" && <ExportModal transactions={transactions} onClose={closeModal} notify={notify} />}

      <Toast key={toast?.id} toast={toast} onDone={clearToast} />
    </div>
  );
}
