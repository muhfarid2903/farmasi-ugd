import { useEffect, useState } from "react";
import * as repo from "../../lib/repository";
import type { PadananMap } from "../../lib/stokOpname";
import type { Item, Transaction, UserProfile } from "../../types";
import { AsistenChat } from "./AsistenChat";

interface AsistenPageProps {
  allItems: Item[];
  transactions: Transaction[];
  profile: UserProfile;
  /** Kirim penulisan ke Firestore; pesan sukses opsional (tanpa pesan = hanya laporkan bila gagal). */
  save: (promise: Promise<void>, success?: string) => void;
  notify: (text: string, kind: "success" | "error") => void;
  onBack: () => void;
}

/** Asisten Stok Opname (khusus admin): mengisi kolom UGD di file stok opname puskesmas. */
export function AsistenPage({ allItems, transactions, profile, save, notify, onBack }: AsistenPageProps) {
  const [meta, setMeta] = useState<repo.StokOpnameMeta | null | undefined>(undefined);
  const [padanan, setPadanan] = useState<PadananMap>({});
  useEffect(() => repo.subscribeStokOpnameMeta(setMeta), []);
  useEffect(() => repo.subscribePadanan(setPadanan), []);

  return (
    <>
      <div className="page-actions">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>
          ← Pengaturan
        </button>
      </div>
      <h1 className="page-title">Asisten Stok Opname</h1>
      <p className="page-sub">
        Mengisi kolom UGD di file stok opname puskesmas dari stok akhir bulan di aplikasi. File itu tidak diubah oleh
        bot: Anda yang menempelkan kolomnya, lalu bot memeriksa hasilnya.
      </p>
      <AsistenChat
        allItems={allItems}
        transactions={transactions}
        meta={meta}
        padanan={padanan}
        onSaveMeta={(file) => save(repo.setStokOpnameMeta(file, profile.email), "Pengaturan file disimpan")}
        onSavePadanan={(entries) => save(repo.savePadanan(entries, profile.email))}
        notify={notify}
      />
    </>
  );
}
