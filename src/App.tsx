import { useCallback, useState } from "react";
import { Header } from "./components/Header";
import { Icon, type IconName } from "./components/Icon";
import { SyncBadge } from "./components/SyncBadge";
import { Toast, type ToastMessage } from "./components/Toast";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { ExportModal } from "./features/laporan/ExportModal";
import { ItemFormModal } from "./features/stok/ItemFormModal";
import { StokPage } from "./features/stok/StokPage";
import { TransaksiPage } from "./features/transaksi/TransaksiPage";
import { TxFormModal } from "./features/transaksi/TxFormModal";
import { useInventory } from "./hooks/useInventory";
import * as repo from "./lib/repository";
import { isLowStock } from "./lib/stock";
import type { Item, Page, Transaction, TxType } from "./types";

type ModalState =
  { kind: "tx"; type: TxType; editTx?: Transaction } | { kind: "item"; editItem?: Item } | { kind: "export" } | null;

const NAV: { page: Page; label: string; short: string; icon: IconName }[] = [
  { page: "dashboard", label: "Dashboard", short: "Home", icon: "home" },
  { page: "stok", label: "Data Stok", short: "Stok", icon: "package" },
  { page: "transaksi", label: "Transaksi", short: "Transaksi", icon: "clock" },
];

export default function App() {
  const { items, transactions, loading, syncStatus, error } = useInventory();
  const [page, setPage] = useState<Page>("dashboard");
  const [modal, setModal] = useState<ModalState>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

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

  function handleSaveTx(data: repo.TxData, prev?: Transaction) {
    write(repo.saveTransaction(data, prev), prev ? "Transaksi diperbarui" : "Transaksi tersimpan");
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

  const openNewTx = (type: TxType) => setModal({ kind: "tx", type });
  const openEditTx = (tx: Transaction) => setModal({ kind: "tx", type: tx.type, editTx: tx });
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

  return (
    <div className="app">
      <Header right={<SyncBadge status={syncStatus} />} />
      <div className="main-area">
        <nav className="sidebar">
          {NAV.map((n) => (
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
              onEditTx={openEditTx}
              onAddItem={openAddItem}
              onExport={openExport}
            />
          )}
          {page === "stok" && (
            <StokPage
              items={items}
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
              onEditTx={openEditTx}
              onExport={openExport}
            />
          )}
        </main>
      </div>

      <nav className="mobile-nav">
        <div className="mobile-nav-inner">
          {NAV.map((n) => (
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
          editTx={modal.editTx}
          initialType={modal.type}
          onSubmit={handleSaveTx}
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
