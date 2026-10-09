import { useCallback, useEffect, useMemo, useState } from "react";
import { FontSizeModal } from "./components/FontSizeModal";
import { Header } from "./components/Header";
import { Icon, type IconName } from "./components/Icon";
import { SyncBadge } from "./components/SyncBadge";
import { Toast, type ToastMessage } from "./components/Toast";
import { BerandaPage } from "./features/beranda/BerandaPage";
import { DaruratPage } from "./features/darurat/DaruratPage";
import { ExportModal } from "./features/laporan/ExportModal";
import { GabungPage } from "./features/gabung/GabungPage";
import { KosongkanPage } from "./features/opname/KosongkanPage";
import { LplpoPage } from "./features/lplpo/LplpoPage";
import { OpnamePage } from "./features/opname/OpnamePage";
import { BantuanPage } from "./features/bantuan/BantuanPage";
import { TourModal } from "./features/bantuan/TourModal";
import { PindahAlamatBanner, PindahAlamatScreen } from "./features/pindah/PindahAlamat";
import { PengaturanPage } from "./features/pengaturan/PengaturanPage";
import { ExpiryModal } from "./features/stok/ExpiryModal";
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
import { backupDue, daysSince } from "./lib/backup";
import { expiryPatch, formatExpiry } from "./lib/expiry";
import type { Signer } from "./lib/lplpo";
import { withMergedIds, type MergeGroup, type MergeUpdate } from "./lib/merge";
import * as repo from "./lib/repository";
import { canVoid, isLowStock, stockChanges, validateStockChanges, voidTxData, type StockFilter } from "./lib/stock";
import type { Item, OpnameEntry, Page, Transaction, TxType, UserProfile } from "./types";

type ModalState =
  | { kind: "tx"; type: TxType }
  | { kind: "void"; tx: Transaction }
  | { kind: "item"; editItem?: Item }
  | { kind: "expiry"; item: Item }
  | { kind: "export" }
  | { kind: "font" }
  | { kind: "tour" }
  | null;

const NAV: { page: Page; label: string; icon: IconName; adminOnly?: boolean }[] = [
  { page: "beranda", label: "Beranda", icon: "home" },
  { page: "stok", label: "Stok", icon: "package" },
  { page: "riwayat", label: "Riwayat", icon: "clock" },
  { page: "lplpo", label: "LPLPO", icon: "printer" },
  { page: "pengaturan", label: "Pengaturan", icon: "settings", adminOnly: true },
];

/** `moved`: dibuka dari alamat lama padahal alamat baru sudah aktif. */
export default function App({ profile, moved = false }: { profile: UserProfile; moved?: boolean }) {
  const { items, allItems, transactions, loading, syncStatus, error } = useInventory();
  const [page, setPage] = useState<Page>("beranda");
  const [stokFilter, setStokFilter] = useState<StockFilter>("semua");
  const [modal, setModal] = useState<ModalState>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [fontScale, setFontScale] = useFontScale();
  const [firstVisit, markTourSeen] = useFirstVisit(`tour.${profile.email}`);
  const isAdmin = profile.role === "admin";
  const [backupMeta, setBackupMeta] = useState<repo.BackupMeta | null | undefined>(undefined);
  // Pengingat cadangan hanya untuk admin
  useEffect(() => (isAdmin ? repo.subscribeBackupMeta(setBackupMeta) : undefined), [isAdmin]);
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

  // Catatan barang yang sudah digabung tidak dibatalkan lagi: stoknya sudah dipindah ke barang tujuan
  const userCanVoid = useCallback(
    (tx: Transaction) => canVoid(tx, profile) && items.some((i) => i.id === tx.itemId),
    [profile, items],
  );
  // Untuk "barang yang sering dipakai": riwayat salinan lama dihitung pada barang hasil gabungan
  const wizardTxs = useMemo(() => withMergedIds(transactions, allItems), [transactions, allItems]);

  function handleWizardSave(data: NewTx): string {
    const item = items.find((i) => i.id === data.itemId);
    const { id, done } = repo.saveTransaction(
      { ...data, operator: profile.name, email: profile.email },
      item ? expiryPatch(item, data) : undefined,
    );
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
      // Perubahan stok dicatat sebagai transaksi koreksi (ada jejaknya), bukan ditimpa langsung
      const { stock, ...rest } = data;
      write(repo.updateItem(editItem.id, rest), "Data barang disimpan");
      const correction = repo.correctStock(editItem, stock, profile);
      if (correction) reportFailure(correction);
    } else {
      write(repo.addItem(data), "Barang baru ditambahkan");
    }
    setModal(null);
  }

  function handleDeleteItem(item: Item) {
    write(repo.deleteItem(item.id), `${item.name} dihapus dari daftar`);
    setModal(null);
  }

  function handleSetExpiry(item: Item, expiry: string | null) {
    write(
      repo.setExpiry(item.id, expiry),
      expiry ? `ED ${item.name} diperbarui: ${formatExpiry(expiry)}` : `ED ${item.name} dikosongkan`,
    );
    setModal(null);
  }

  function showStock(filter: StockFilter = "semua") {
    setStokFilter(filter);
    setPage("stok");
  }

  function handleSaveOpname(entries: OpnameEntry[], note: string) {
    const changed = entries.filter((e) => e.counted !== items.find((i) => i.id === e.itemId)?.stock).length;
    write(
      repo.saveOpname(entries, items, profile, note),
      `Stok opname tersimpan: ${entries.length} barang, ${changed} disesuaikan`,
    );
  }

  function handleEmptyAll(entries: OpnameEntry[]) {
    write(
      repo.saveOpname(entries, items, profile, "Pengosongan semua stok (awal hitungan baru)"),
      `Stok ${entries.length} barang dikosongkan`,
    );
  }

  function handleApplyDarurat(kritis: { id: string; kritis: boolean }[], units: { id: string; unit: string }[]) {
    write(
      repo.applyDaruratChanges(kritis, units),
      `Daftar obat darurat diperbarui: ${kritis.filter((c) => c.kritis).length} ditambah, ${kritis.filter((c) => !c.kritis).length} dilepas`,
    );
  }

  function handleMerge(groups: { group: MergeGroup; update: MergeUpdate }[]) {
    write(
      Promise.all(groups.map(({ group, update }) => repo.mergeItems(group, update, profile))).then(() => undefined),
      groups.length === 1
        ? `${groups[0].group.items.length} barang disatukan menjadi ${groups[0].update.name}`
        : `${groups.length} kelompok barang disatukan`,
    );
  }

  function closeTour() {
    markTourSeen();
    setModal(null);
  }

  function handleSaveUser(user: UserProfile, isNew: boolean) {
    write(repo.saveUser(user), isNew ? `${user.name} ditambahkan` : `Data ${user.name} disimpan`);
  }

  function handleSaveSigners(signers: Signer[]) {
    write(repo.setLplpoSigners(signers, profile.email), "Penanda tangan LPLPO disimpan");
  }

  function openLplpo() {
    setModal(null);
    setPage("lplpo");
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

  // Pindah alamat hanya setelah semua catatan terkirim, supaya catatan offline tidak tertinggal di alamat lama
  if (moved && syncStatus === "online") return <PindahAlamatScreen />;

  const lowCount = items.filter(isLowStock).length;
  const voidPreview = modal?.kind === "void" ? voidTxData(modal.tx, profile, todayStr(), "") : null;

  return (
    <div className="app">
      <Header
        right={
          <>
            <SyncBadge status={syncStatus} />
            {/* Bantuan di bar atas supaya selalu terlihat tanpa menambah tombol di menu bawah */}
            <button
              className={`btn btn-ghost btn-sm header-help${page === "bantuan" ? " active" : ""}`}
              aria-current={page === "bantuan" ? "page" : undefined}
              onClick={() => setPage("bantuan")}
            >
              <Icon type="help" size={18} /> Bantuan
            </button>
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
              onClick={() => (n.page === "stok" ? showStock() : setPage(n.page))}
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
          {moved && <PindahAlamatBanner />}
          {error && <div className="form-error">Data tidak bisa dibuka: {error}</div>}
          {page === "beranda" && (
            <BerandaPage
              userName={profile.name}
              items={items}
              allItems={allItems}
              transactions={transactions}
              onNewTx={openNewTx}
              onShowStock={showStock}
              onShowHistory={() => setPage("riwayat")}
              onExport={openExport}
              onAddItem={isAdmin ? openAddItem : undefined}
              backupReminder={
                isAdmin && backupMeta !== undefined && backupDue(backupMeta?.lastBackupAt ?? null)
                  ? { days: daysSince(backupMeta?.lastBackupAt ?? null), onGo: () => setPage("pengaturan") }
                  : undefined
              }
            />
          )}
          {page === "stok" && (
            <StokPage
              key={stokFilter}
              items={items}
              isAdmin={isAdmin}
              initialFilter={stokFilter}
              onAddItem={openAddItem}
              onEditItem={(item) => setModal({ kind: "item", editItem: item })}
              onEditExpiry={(item) => setModal({ kind: "expiry", item })}
            />
          )}
          {page === "riwayat" && (
            <TransaksiPage
              items={allItems}
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
              onShowStock={() => showStock()}
              onExport={openExport}
              onOpname={() => setPage("opname")}
              onDarurat={() => setPage("darurat")}
              onKosongkan={() => setPage("kosongkan")}
              onGabung={() => setPage("gabung")}
              onLplpo={openLplpo}
              notify={notify}
            />
          )}
          {page === "lplpo" && (
            <LplpoPage
              items={items}
              allItems={allItems}
              transactions={transactions}
              isAdmin={isAdmin}
              onSaveSigners={handleSaveSigners}
            />
          )}
          {page === "kosongkan" && isAdmin && (
            <KosongkanPage
              items={items}
              onConfirm={handleEmptyAll}
              onBackup={() => setPage("pengaturan")}
              onOpname={() => setPage("opname")}
              onBack={() => setPage("pengaturan")}
            />
          )}
          {page === "darurat" && isAdmin && (
            <DaruratPage items={items} onApply={handleApplyDarurat} onBack={() => setPage("pengaturan")} />
          )}
          {page === "gabung" && isAdmin && (
            <GabungPage
              items={items}
              onMerge={handleMerge}
              onBackup={() => setPage("pengaturan")}
              onBack={() => setPage("pengaturan")}
            />
          )}
          {page === "opname" && isAdmin && (
            <OpnamePage items={items} onSave={handleSaveOpname} onBack={() => setPage("pengaturan")} />
          )}
        </main>
      </div>

      <nav className="mobile-nav" aria-label="Menu utama">
        <div className={`mobile-nav-inner${nav.length > 4 ? " many" : ""}`}>
          {nav.map((n) => (
            <button
              key={n.page}
              className={`mobile-nav-btn${page === n.page ? " active" : ""}`}
              aria-current={page === n.page ? "page" : undefined}
              onClick={() => (n.page === "stok" ? showStock() : setPage(n.page))}
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
          transactions={wizardTxs}
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
      {modal?.kind === "expiry" && (
        <ExpiryModal item={modal.item} onSave={(expiry) => handleSetExpiry(modal.item, expiry)} onClose={closeModal} />
      )}
      {modal?.kind === "export" && (
        <ExportModal
          items={allItems}
          transactions={transactions}
          onClose={closeModal}
          onOpenLplpo={openLplpo}
          notify={notify}
        />
      )}
      {(modal?.kind === "tour" || (firstVisit && modal === null)) && <TourModal onClose={closeTour} />}
      {modal?.kind === "font" && <FontSizeModal scale={fontScale} onChange={setFontScale} onClose={closeModal} />}

      <Toast key={toast?.id} toast={toast} onDone={clearToast} />
    </div>
  );
}
