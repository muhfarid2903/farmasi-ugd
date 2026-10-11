import { describe, expect, it } from "vitest";
import { DriveError, driveErrorFor, driveFileId, fetchDriveXlsx, sheetUrl } from "../src/lib/drive";

const ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz012345";

describe("driveFileId", () => {
  it("mengambil id dari berbagai bentuk link", () => {
    expect(driveFileId(`https://docs.google.com/spreadsheets/d/${ID}/edit?gid=1575815756#gid=1575815756`)).toBe(ID);
    expect(driveFileId(`https://drive.google.com/file/d/${ID}/view?usp=drivesdk`)).toBe(ID);
    expect(driveFileId(`https://drive.google.com/open?id=${ID}`)).toBe(ID);
    expect(driveFileId(`  ${ID}  `)).toBe(ID);
    expect(driveFileId("https://example.com/bukan-drive")).toBeNull();
    expect(sheetUrl(ID)).toBe(`https://docs.google.com/spreadsheets/d/${ID}/edit`);
  });
});

describe("driveErrorFor", () => {
  it("membedakan masalah kunci, akses file, dan lainnya", () => {
    expect(driveErrorFor(403, "API_KEY_SERVICE_BLOCKED").reason).toBe("kunci");
    expect(driveErrorFor(403, "API_KEY_HTTP_REFERRER_BLOCKED").reason).toBe("kunci");
    expect(driveErrorFor(400, "").reason).toBe("kunci");
    expect(driveErrorFor(404, "notFound").reason).toBe("akses");
    expect(driveErrorFor(403, "forbidden").reason).toBe("akses");
    expect(driveErrorFor(500, "backendError").reason).toBe("lain");
  });
});

describe("fetchDriveXlsx", () => {
  const error = (status: number, reason: string) =>
    new Response(JSON.stringify({ error: { errors: [{ reason }], details: [{ reason }] } }), { status });

  it("mengunduh isi file dengan kunci", async () => {
    const urls: string[] = [];
    const data = await fetchDriveXlsx(ID, "kunci", async (url) => {
      urls.push(String(url));
      return new Response(new Uint8Array([0x50, 0x4b, 1, 2]));
    });
    expect(new Uint8Array(data)[0]).toBe(0x50);
    expect(urls).toEqual([`https://www.googleapis.com/drive/v3/files/${ID}?alt=media&key=kunci`]);
  });

  it("Google Spreadsheet asli diekspor ke .xlsx", async () => {
    const urls: string[] = [];
    await fetchDriveXlsx(ID, "kunci", async (url) => {
      urls.push(String(url));
      return urls.length === 1 ? error(403, "fileNotDownloadable") : new Response(new Uint8Array([0x50, 0x4b]));
    });
    expect(urls[1]).toContain(`/files/${ID}/export?mimeType=`);
  });

  it("kunci ditolak dan sinyal putus menjadi pesan yang bisa dipahami", async () => {
    await expect(fetchDriveXlsx(ID, "kunci", async () => error(403, "API_KEY_SERVICE_BLOCKED"))).rejects.toMatchObject({
      reason: "kunci",
    });
    const offline = fetchDriveXlsx(ID, "kunci", async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(offline).rejects.toBeInstanceOf(DriveError);
    await expect(offline).rejects.toMatchObject({ reason: "jaringan" });
  });
});
