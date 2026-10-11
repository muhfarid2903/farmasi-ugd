import { describe, expect, it } from "vitest";
import { colLetter, colNumber, parseRange, readXlsx, XlsxError } from "../src/lib/xlsx";
import { contohXlsx } from "./fixtures/contoh";

/** Arsip zip tanpa pemadatan, untuk menguji bentuk XML yang tidak dibuat openpyxl. */
function storedZip(files: Record<string, string>): ArrayBuffer {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const n = enc.encode(name);
    const d = enc.encode(text);
    const local = new Uint8Array(30 + n.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint32(18, d.length, true);
    lv.setUint32(22, d.length, true);
    lv.setUint16(26, n.length, true);
    local.set(n, 30);
    const cen = new Uint8Array(46 + n.length);
    const cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint32(20, d.length, true);
    cv.setUint32(24, d.length, true);
    cv.setUint16(28, n.length, true);
    cv.setUint32(42, offset, true);
    cen.set(n, 46);
    parts.push(local, d);
    central.push(cen);
    offset += local.length + d.length;
  }
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, central.length, true);
  ev.setUint16(10, central.length, true);
  ev.setUint32(
    12,
    central.reduce((s, c) => s + c.length, 0),
    true,
  );
  ev.setUint32(16, offset, true);
  const all = [...parts, ...central, eocd];
  const out = new Uint8Array(all.reduce((s, p) => s + p.length, 0));
  let p = 0;
  for (const a of all) {
    out.set(a, p);
    p += a.length;
  }
  return out.buffer;
}

describe("alamat sel", () => {
  it("huruf kolom ↔ nomor", () => {
    expect(colNumber("A")).toBe(1);
    expect(colNumber("L")).toBe(12);
    expect(colNumber("AJ")).toBe(36);
    expect(colLetter(12)).toBe("L");
    expect(colLetter(36)).toBe("AJ");
    expect(colLetter(colNumber("XFD"))).toBe("XFD");
  });
  it("rentang tabel", () => {
    expect(parseRange("J11:K337")).toEqual({ c1: 10, r1: 11, c2: 11, r2: 337 });
    expect(parseRange("$G$19")).toEqual({ c1: 7, r1: 19, c2: 7, r2: 19 });
    expect(parseRange("bukan")).toBeNull();
  });
});

describe("readXlsx: file Excel biasa", () => {
  it("membaca daftar tab, teks, angka, rumus, baris tersembunyi, dan tabel", async () => {
    const wb = await readXlsx(contohXlsx());
    expect(wb.sheetNames).toEqual(["SEPTEMBER 2026", "MEI", "NOP 2026", "Sheet1"]);
    const s = await wb.sheet("SEPTEMBER 2026");
    expect(s.value(7, 2)).toBe("NAMA OBAT");
    expect(s.value(7, 6)).toBe("UGD");
    expect(s.value(12, 2)).toBe("Epinefrin (adrenalin) inj 1 mg/ml");
    expect(s.value(12, 6)).toBe(3);
    expect(s.value(21, 2)).toBe("Kasa & plester <steril>");
    expect(s.value(21, 6)).toBe(2.5);
    // Teks bergaya tersimpan sebagai beberapa potongan: digabung kembali
    expect(s.value(22, 2)).toBe("Infusion set anak (Dak)");
    expect(s.hasFormula(10, 7)).toBe(true);
    expect(s.hasFormula(10, 6)).toBe(false);
    expect(s.value(18, 2)).toBeNull();
    expect(s.hiddenRows.has(19)).toBe(true);
    expect(s.tables).toEqual([{ name: "Tabel1", ref: "D11:E15" }]);
    expect(s.maxRow).toBe(22);
  });

  it("tab yang sama dibaca sekali saja", async () => {
    const wb = await readXlsx(contohXlsx());
    expect(await wb.sheet("MEI")).toBe(await wb.sheet("MEI"));
  });

  it("menolak file yang bukan Excel dan tab yang tidak ada", async () => {
    await expect(readXlsx(new TextEncoder().encode("bukan file excel sama sekali").buffer)).rejects.toThrow(XlsxError);
    const wb = await readXlsx(contohXlsx());
    await expect(wb.sheet("Tidak ada")).rejects.toThrow(XlsxError);
  });
});

describe("readXlsx: bentuk XML lain", () => {
  it("teks langsung di sel, hasil rumus teks, benar/salah, error, sel tanpa alamat, dan alamat file mutlak", async () => {
    const wb = await readXlsx(
      storedZip({
        "xl/workbook.xml":
          '<workbook xmlns:r="r"><sheets><sheet name="Uji &amp; Coba" sheetId="1" r:id="rId1"/></sheets></workbook>',
        "xl/_rels/workbook.xml.rels":
          '<Relationships><Relationship Id="rId1" Type="x/worksheet" Target="/xl/worksheets/sheet1.xml"/></Relationships>',
        "xl/worksheets/sheet1.xml":
          "<worksheet><sheetData>" +
          '<row r="1"><c r="A1" t="inlineStr"><is><t>NAMA</t><t xml:space="preserve"> OBAT</t></is></c>' +
          '<c t="str"><f>A1</f><v>hasil &lt;rumus&gt;</v></c><c t="b"><v>1</v></c><c t="e"><v>#REF!</v></c></row>' +
          '<row><c r="B2"><v>1.5E2</v></c><c/></row>' +
          '<row r="4" hidden="1"><c r="D4"><v>7</v></c></row>' +
          "</sheetData></worksheet>",
      }),
    );
    expect(wb.sheetNames).toEqual(["Uji & Coba"]);
    const s = await wb.sheet("Uji & Coba");
    expect(s.value(1, 1)).toBe("NAMA OBAT");
    expect(s.value(1, 2)).toBe("hasil <rumus>");
    expect(s.hasFormula(1, 2)).toBe(true);
    expect(s.value(1, 3)).toBe(true);
    expect(s.value(1, 4)).toBe("#REF!");
    expect(s.value(2, 2)).toBe(150);
    expect(s.value(2, 3)).toBeNull();
    expect(s.value(4, 4)).toBe(7);
    expect([...s.hiddenRows]).toEqual([4]);
    expect(s.tables).toEqual([]);
  });
});
