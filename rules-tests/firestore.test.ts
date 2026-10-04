// Tes aturan keamanan Firestore. Jalankan dengan: npm run test:rules (butuh Java untuk emulator).
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, increment, setDoc, updateDoc, deleteDoc, writeBatch, type Firestore } from "firebase/firestore";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let env: RulesTestEnvironment;

const ADMIN = "admin@gmail.com";
const ANI = "ani@gmail.com";
const BUDI = "budi@gmail.com";
const NONAKTIF = "lama@gmail.com";
const ASING = "asing@gmail.com";

const as = (email: string, verified = true) =>
  env.authenticatedContext(email, { email, email_verified: verified }).firestore() as unknown as Firestore;

const txBase = (email: string, extra: Record<string, unknown> = {}) => ({
  itemId: "epi",
  itemName: "Epinefrin",
  type: "keluar",
  qty: 2,
  date: "2026-10-05",
  note: "",
  operator: "Nama",
  email,
  createdAt: "2026-10-05T01:00:00Z",
  ...extra,
});

/** Batch seperti aplikasi: transaksi baru + perubahan stok (+ tandai transaksi asli jika pembatalan). */
function txBatch(db: Firestore, txId: string, data: Record<string, unknown>, stockDelta: number) {
  const b = writeBatch(db);
  b.set(doc(db, "transactions", txId), data);
  b.update(doc(db, "items", data.itemId as string), { stock: increment(stockDelta), lastTxId: txId });
  if (data.voidsTxId) b.update(doc(db, "transactions", data.voidsTxId as string), { voidedBy: txId });
  return b.commit();
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "farmasi-ugd-test",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});
afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "users", ADMIN), { name: "Admin", role: "admin", active: true });
    await setDoc(doc(db, "users", ANI), { name: "Ani", role: "petugas", active: true });
    await setDoc(doc(db, "users", BUDI), { name: "Budi", role: "petugas", active: true });
    await setDoc(doc(db, "users", NONAKTIF), { name: "Lama", role: "petugas", active: false });
    await setDoc(doc(db, "items", "epi"), {
      name: "Epinefrin",
      category: "Obat",
      unit: "ampul",
      stock: 10,
      minStock: 3,
      kritis: true,
    });
    await setDoc(doc(db, "transactions", "t-ani"), txBase(ANI, { type: "masuk", qty: 4 }));
    // Transaksi dari sebelum ada login: tanpa kolom email
    const { email: _email, ...legacy } = txBase(ANI, { type: "masuk", qty: 1 });
    await setDoc(doc(db, "transactions", "t-lama"), legacy);
  });
});

describe("akses baca", () => {
  it("tanpa login ditolak", async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "items", "epi")));
  });
  it("akun yang tidak terdaftar ditolak", async () => {
    await assertFails(getDoc(doc(as(ASING), "items", "epi")));
  });
  it("akun nonaktif ditolak", async () => {
    await assertFails(getDoc(doc(as(NONAKTIF), "items", "epi")));
  });
  it("email belum terverifikasi ditolak", async () => {
    await assertFails(getDoc(doc(as(ANI, false), "items", "epi")));
  });
  it("petugas aktif boleh membaca item & transaksi", async () => {
    await assertSucceeds(getDoc(doc(as(ANI), "items", "epi")));
    await assertSucceeds(getDoc(doc(as(ANI), "transactions", "t-ani")));
  });
  it("petugas hanya boleh membaca profilnya sendiri", async () => {
    await assertSucceeds(getDoc(doc(as(ANI), "users", ANI)));
    await assertFails(getDoc(doc(as(ANI), "users", BUDI)));
    await assertSucceeds(getDoc(doc(as(ADMIN), "users", BUDI)));
  });
  it("akun tak terdaftar boleh mengecek profilnya sendiri (untuk layar 'belum terdaftar')", async () => {
    await assertSucceeds(getDoc(doc(as(ASING), "users", ASING)));
  });
});

describe("transaksi baru", () => {
  it("transaksi + perubahan stok yang sesuai diterima", async () => {
    await assertSucceeds(txBatch(as(ANI), "t1", txBase(ANI), -2));
  });
  it("transaksi tanpa perubahan stok ditolak", async () => {
    await assertFails(setDoc(doc(as(ANI), "transactions", "t1"), txBase(ANI)));
  });
  it("perubahan stok tanpa transaksi ditolak", async () => {
    await assertFails(updateDoc(doc(as(ANI), "items", "epi"), { stock: 99 }));
    await assertFails(updateDoc(doc(as(ANI), "items", "epi"), { stock: increment(5), lastTxId: "palsu" }));
  });
  it("perubahan stok yang tidak sama dengan jumlah transaksi ditolak", async () => {
    await assertFails(txBatch(as(ANI), "t1", txBase(ANI), -5));
    await assertFails(txBatch(as(ANI), "t1", txBase(ANI), +2));
  });
  it("mencatat atas nama email orang lain ditolak", async () => {
    await assertFails(txBatch(as(ANI), "t1", txBase(BUDI), -2));
  });
  it("jumlah nol, negatif, atau desimal ditolak", async () => {
    for (const qty of [0, -2, 1.5]) await assertFails(txBatch(as(ANI), "t1", txBase(ANI, { qty }), -qty));
  });
  it("kolom tak dikenal atau tipe salah ditolak", async () => {
    await assertFails(txBatch(as(ANI), "t1", txBase(ANI, { hack: true }), -2));
    await assertFails(txBatch(as(ANI), "t1", txBase(ANI, { type: "hilang" }), -2));
    await assertFails(txBatch(as(ANI), "t1", txBase(ANI, { date: "kemarin" }), -2));
  });
  it("transaksi tidak bisa diubah atau dihapus", async () => {
    await assertFails(updateDoc(doc(as(ANI), "transactions", "t-ani"), { qty: 40 }));
    await assertFails(deleteDoc(doc(as(ANI), "transactions", "t-ani")));
    await assertFails(deleteDoc(doc(as(ADMIN), "transactions", "t-ani")));
  });
});

describe("pembatalan transaksi", () => {
  const voidOf = (email: string, extra: Record<string, unknown> = {}) =>
    txBase(email, { type: "keluar", qty: 4, voidsTxId: "t-ani", ...extra });

  it("pembuat boleh membatalkan transaksinya", async () => {
    await assertSucceeds(txBatch(as(ANI), "v1", voidOf(ANI), -4));
  });
  it("admin boleh membatalkan transaksi siapa pun, termasuk transaksi lama tanpa email", async () => {
    await assertSucceeds(txBatch(as(ADMIN), "v1", voidOf(ADMIN), -4));
    await assertSucceeds(txBatch(as(ADMIN), "v2", txBase(ADMIN, { type: "keluar", qty: 1, voidsTxId: "t-lama" }), -1));
  });
  it("petugas lain tidak boleh membatalkan", async () => {
    await assertFails(txBatch(as(BUDI), "v1", voidOf(BUDI), -4));
  });
  it("pembatalan dengan jumlah atau tipe berbeda ditolak", async () => {
    await assertFails(txBatch(as(ANI), "v1", voidOf(ANI, { qty: 3 }), -3));
    await assertFails(txBatch(as(ANI), "v1", voidOf(ANI, { type: "masuk" }), +4));
  });
  it("tidak bisa dibatalkan dua kali", async () => {
    await assertSucceeds(txBatch(as(ANI), "v1", voidOf(ANI), -4));
    await assertFails(txBatch(as(ANI), "v2", voidOf(ANI), -4));
  });
  it("transaksi pembatalan tanpa menandai transaksi aslinya ditolak", async () => {
    const db = as(ANI);
    const b = writeBatch(db);
    b.set(doc(db, "transactions", "v1"), voidOf(ANI));
    b.update(doc(db, "items", "epi"), { stock: increment(-4), lastTxId: "v1" });
    await assertFails(b.commit());
  });
});

describe("kelola item", () => {
  it("petugas tidak boleh menambah, mengubah, atau menghapus item", async () => {
    await assertFails(setDoc(doc(as(ANI), "items", "baru"), { name: "X", stock: 1 }));
    await assertFails(updateDoc(doc(as(ANI), "items", "epi"), { minStock: 0 }));
    await assertFails(updateDoc(doc(as(ANI), "items", "epi"), { kritis: false }));
    await assertFails(deleteDoc(doc(as(ANI), "items", "epi")));
  });
  it("admin boleh mengelola item, termasuk koreksi stok langsung", async () => {
    await assertSucceeds(setDoc(doc(as(ADMIN), "items", "baru"), { name: "X", stock: 1 }));
    await assertSucceeds(updateDoc(doc(as(ADMIN), "items", "epi"), { stock: 7, minStock: 5 }));
    await assertSucceeds(deleteDoc(doc(as(ADMIN), "items", "baru")));
  });
});

describe("kelola petugas", () => {
  const user = { name: "Citra", role: "petugas", active: true, createdAt: "2026-10-05T00:00:00Z" };
  it("petugas tidak boleh mendaftarkan atau mengubah petugas", async () => {
    await assertFails(setDoc(doc(as(ANI), "users", "citra@gmail.com"), user));
    await assertFails(setDoc(doc(as(ANI), "users", ANI), { ...user, name: "Ani", role: "admin" }));
  });
  it("akun tak terdaftar tidak bisa mendaftarkan dirinya sendiri", async () => {
    await assertFails(setDoc(doc(as(ASING), "users", ASING), user));
  });
  it("admin boleh mendaftarkan dan menonaktifkan petugas", async () => {
    await assertSucceeds(setDoc(doc(as(ADMIN), "users", "citra@gmail.com"), user));
    await assertSucceeds(setDoc(doc(as(ADMIN), "users", BUDI), { ...user, name: "Budi", active: false }));
  });
  it("email harus huruf kecil dan peran harus valid", async () => {
    await assertFails(setDoc(doc(as(ADMIN), "users", "Citra@gmail.com"), user));
    await assertFails(setDoc(doc(as(ADMIN), "users", "citra@gmail.com"), { ...user, role: "superadmin" }));
  });
  it("admin tidak bisa menonaktifkan atau menurunkan dirinya sendiri", async () => {
    await assertFails(setDoc(doc(as(ADMIN), "users", ADMIN), { ...user, name: "Admin", role: "petugas" }));
    await assertFails(setDoc(doc(as(ADMIN), "users", ADMIN), { ...user, name: "Admin", role: "admin", active: false }));
  });
  it("petugas tidak bisa dihapus (cukup dinonaktifkan)", async () => {
    await assertFails(deleteDoc(doc(as(ADMIN), "users", BUDI)));
  });
});
