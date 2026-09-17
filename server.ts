import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { SpreadsheetDatabase, SPREADSHEET_ID } from "./src/server/spreadsheetDb";

const GAS_WEBAPP_URL =
  process.env.GAS_WEBAPP_URL ||
  "https://script.google.com/macros/s/AKfycbyPMN2vvUNysv-Tn_2YCfzNcBLHC8FluGF0BwdHt07YrKT4lHMxQqkKjYsPd2DJ2v9ekQ/exec";

// Google Apps Script developer endpoint with live registerUser function
const GAS_DEV_URL = GAS_WEBAPP_URL.replace(/\/exec(\?.*)?$/, "/dev$1");

// Helper for invoking Google Apps Script endpoints safely with timeout
async function callGasRemote(url: string, action: string, data: any): Promise<any> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const gasResponse = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify({ action, data }),
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const responseText = await gasResponse.text();
    if (
      !responseText.includes("<!DOCTYPE") &&
      !responseText.includes("<!doctype") &&
      !responseText.includes("<html")
    ) {
      let json = JSON.parse(responseText);
      if (typeof json === "string") {
        try {
          json = JSON.parse(json);
        } catch (_) {}
      }
      return json;
    }
  } catch (err: any) {
    console.log(`[API /api/gas] Remote GAS call for ${action} (${err?.message || 'offline'})`);
  }
  return null;
}

// Local execution helper matching GAS Spreadsheet backend
function executeLocalSpreadsheetAction(action: string, data: any) {
  switch (action) {
    case "lookupKodeAhm":
      return SpreadsheetDatabase.lookupKodeAhm(data?.kodeAhm || "");
    case "registerUser":
      return SpreadsheetDatabase.registerUser(data?.formData || data || {});
    case "loginUser":
      return SpreadsheetDatabase.loginUser(data?.email || "", data?.kodeAhm || "");
    case "getMasterDataKlaim":
      return SpreadsheetDatabase.getMasterDataKlaim();
    case "getRecentClaims":
      return SpreadsheetDatabase.getRecentClaims(data?.kodeAhm || "");
    case "getDashboardStats":
      return SpreadsheetDatabase.getDashboardStats(data?.kodeAhm || "");
    case "simpanPengajuanKlaim":
      return SpreadsheetDatabase.simpanPengajuanKlaim(data?.payload || data || {});
    case "dealerKonfirmasiSelesai":
      return SpreadsheetDatabase.dealerKonfirmasiSelesai(data?.idKlaim || "");
    case "checkDataVersion":
      return SpreadsheetDatabase.checkDataVersion(data?.clientVersion || "");
    default:
      return { success: false, message: `Action '${action}' tidak dikenali.` };
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Support JSON payloads (such as claim photos in base64)
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ extended: true, limit: "25mb" }));

  // API Proxy / Database Handler (Matches Spreadsheet ID 1Xy9095taEr4EQC7dWqOj_nPjaIDNsxyf6k6eN7Tb3Mc)
  app.post("/api/gas", async (req, res) => {
    const { action, data } = req.body;
    if (!action) {
      return res.status(400).json({ success: false, message: "Parameter 'action' diperlukan." });
    }

    console.log(`[API /api/gas] Eksekusi action: ${action}`);

    // Try remote GAS first with sufficient timeout for Google Sheets querying
    let remoteJson: any = null;
    const canAttemptRemote = Boolean(GAS_WEBAPP_URL && GAS_WEBAPP_URL.trim().length > 0);
    if (canAttemptRemote) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 seconds for Google Apps Script

        const gasResponse = await fetch(GAS_WEBAPP_URL, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain;charset=utf-8",
          },
          body: JSON.stringify({ action, data }),
          redirect: "follow",
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const responseText = await gasResponse.text();
        // If GAS returned valid JSON, parse it (handle possible double-stringified JSON)
        if (
          !responseText.includes("<!DOCTYPE") &&
          !responseText.includes("<!doctype") &&
          !responseText.includes("<html")
        ) {
          try {
            remoteJson = JSON.parse(responseText);
            if (typeof remoteJson === "string") {
              try {
                remoteJson = JSON.parse(remoteJson);
              } catch (_) {}
            }
          } catch (_) {}
        }
      } catch (err: any) {
        console.log(`[API /api/gas] Remote GAS notice (${err?.message || 'offline'}). Melanjutkan dengan basis data lokal.`);
      }
    }

    // Handle specific actions with intelligent synchronization
    if (action === "lookupKodeAhm") {
      const targetKode =
        typeof data === "string"
          ? data
          : data?.kodeAhm || data?.code || data?.kode || "";

      // If remote GAS returned dealer data
      if (remoteJson && remoteJson.found) {
        SpreadsheetDatabase.upsertDealer(remoteJson);
        return res.json(remoteJson);
      }

      // Check local database (already pre-seeded with real master dealers)
      const localResult = SpreadsheetDatabase.lookupKodeAhm(targetKode);
      if (localResult && localResult.found) {
        return res.json(localResult);
      }

      // If remote explicitly returned not found, return remote message
      if (remoteJson && remoteJson.found === false) {
        return res.json(remoteJson);
      }

      return res.json(localResult);
    }

    if (action === "loginUser") {
      const cleanEmail = (data?.email || "").trim().toLowerCase();
      const cleanKode = (data?.kodeAhm || "").trim();

      // Bangun variasi kode AHM (prioritaskan 5 digit resmi Honda: misal 999 -> [00999, 999])
      const digits = cleanKode.replace(/\D/g, '');
      const variants: string[] = [];
      if (digits) {
        if (digits.length <= 5) {
          const padded = digits.padStart(5, '0');
          variants.push(padded);
        }
        if (!variants.includes(cleanKode)) {
          variants.push(cleanKode);
        }
        const noZero = digits.replace(/^0+/, '');
        if (noZero && !variants.includes(noZero)) {
          variants.push(noZero);
        }
      } else {
        variants.push(cleanKode);
      }

      console.log(`[API /api/gas] loginUser verifikasi email: ${cleanEmail} dengan variasi kode:`, variants);

      let authUser = null;
      let authStatus = null;
      let lastRemoteJson = null;

      // Periksa remote GAS untuk setiap variasi kode AHM
      for (const variant of variants) {
        const webappRes = await callGasRemote(GAS_WEBAPP_URL, "loginUser", {
          email: cleanEmail,
          kodeAhm: variant,
        });
        if (webappRes && webappRes.status === "SUCCESS" && webappRes.user) {
          authUser = webappRes.user;
          authStatus = "SUCCESS";
          lastRemoteJson = webappRes;
          console.log(`[API /api/gas] loginUser cocok di remote GAS dengan variasi: ${variant}`);
          break;
        }

        const devLoginRes = await callGasRemote(GAS_DEV_URL, "loginUser", {
          email: cleanEmail,
          kodeAhm: variant,
        });
        if (devLoginRes && devLoginRes.status === "SUCCESS" && devLoginRes.user) {
          authUser = devLoginRes.user;
          authStatus = "SUCCESS";
          lastRemoteJson = devLoginRes;
          console.log(`[API /api/gas] loginUser cocok di remote DEV GAS dengan variasi: ${variant}`);
          break;
        }

        if (!lastRemoteJson && (webappRes || devLoginRes)) {
          lastRemoteJson = webappRes || devLoginRes;
        }
      }

      // Jika remote GAS berhasil memverifikasi user dari Users_Mobile
      if (authStatus === "SUCCESS" && authUser) {
        try {
          SpreadsheetDatabase.registerUser({
            email: authUser.email,
            namaLengkap: authUser.nama || authUser.namaLengkap || "",
            noHp: authUser.noHp || "",
            kodeAhm: authUser.kodeAhm || "",
            namaDealer: authUser.namaDealer || "",
            kodeDealer: authUser.kodeDealer || "",
            kategori: authUser.kategori || "",
            kota: authUser.kota || "",
            sentraDistribusi: authUser.sentraDistribusi || "",
            role: authUser.role || "PDI Man",
          });
        } catch (_) {}
        return res.json(lastRemoteJson);
      }

      // Jika remote GAS menolak seluruh variasi kode AHM dari Users_Mobile
      if (lastRemoteJson && lastRemoteJson.status === "FAILED") {
        console.log(`[API /api/gas] Login ditolak oleh backend remote Users_Mobile setelah mencoba semua variasi untuk: ${cleanEmail}`);
        return res.json(lastRemoteJson);
      }

      // Fallback ke basis data lokal (sudah mendukung isCodeMatch dengan/tanpa nol) jika GAS unreachable
      const localResult = SpreadsheetDatabase.loginUser(cleanEmail, cleanKode);
      return res.json(localResult);
    }

    if (action === "registerUser") {
      const payloadData = data?.formData || data || {};

      // If remote GAS responded
      if (remoteJson && typeof remoteJson.success === "boolean") {
        if (remoteJson.success) {
          try {
            SpreadsheetDatabase.registerUser(payloadData);
          } catch (_) {}
          // Ensure user object is present in success response for seamless login
          const userObj = remoteJson.user || {
            email: payloadData.email,
            nama: payloadData.namaLengkap || payloadData.nama,
            noHp: payloadData.noHp,
            kodeAhm: payloadData.kodeAhm,
            namaDealer: payloadData.namaDealer,
            kodeDealer: payloadData.kodeDealer,
            kategori: payloadData.kategori,
            kota: payloadData.kota,
            sentraDistribusi: payloadData.sentraDistribusi,
            role: payloadData.role || "PDI Man",
          };
          return res.json({
            ...remoteJson,
            user: userObj,
          });
        }
        return res.json(remoteJson);
      }

      // Fallback local registration if remote is unreachable
      const localResult = SpreadsheetDatabase.registerUser(payloadData);
      return res.json(localResult);
    }

    if (action === "getRecentClaims") {
      // Jika remote GAS merespons (sukses baik berisi data maupun array kosong []), kembalikan data remote tersebut secara mutlak
      if (remoteJson && (remoteJson.success || Array.isArray(remoteJson.data))) {
        return res.json({
          success: true,
          data: Array.isArray(remoteJson.data) ? remoteJson.data : [],
        });
      }
      // Jika remote GAS unreachable/offline, fallback ke local db
      const localResult = SpreadsheetDatabase.getRecentClaims(data?.kodeAhm || "");
      return res.json(localResult);
    }

    if (action === "getDashboardStats") {
      if (remoteJson && typeof remoteJson.draft === "number") {
        return res.json(remoteJson);
      }
      const localResult = SpreadsheetDatabase.getDashboardStats(data?.kodeAhm || "");
      return res.json(localResult);
    }

    if (action === "simpanPengajuanKlaim") {
      const localResult = SpreadsheetDatabase.simpanPengajuanKlaim(data?.payload || data || {});
      return res.json(remoteJson?.success ? remoteJson : localResult);
    }

    if (action === "dealerKonfirmasiSelesai") {
      const localResult = SpreadsheetDatabase.dealerKonfirmasiSelesai(data?.idKlaim || "");
      return res.json(remoteJson?.success ? remoteJson : localResult);
    }

    if (action === "getMasterDataKlaim") {
      const localResult = SpreadsheetDatabase.getMasterDataKlaim();
      if (remoteJson && remoteJson.success) {
        // Merge transporters
        const mergedTransporters = [
          ...(remoteJson.transporterList || []),
          ...localResult.transporterList,
        ];
        // Deduplicate
        const seenNopol = new Set();
        const dedupedTransporters = mergedTransporters.filter((t) => {
          const key = (t.nopol || '').toUpperCase().trim();
          if (!key || seenNopol.has(key)) return false;
          seenNopol.add(key);
          return true;
        });

        return res.json({
          ...localResult,
          transporterList: dedupedTransporters.length > 0 ? dedupedTransporters : localResult.transporterList,
          motorList: remoteJson.motorList?.length ? remoteJson.motorList : localResult.motorList,
          partList: remoteJson.partList?.length ? remoteJson.partList : localResult.partList,
        });
      }
      return res.json(localResult);
    }

    // Default fallback
    const defaultResult = executeLocalSpreadsheetAction(action, data);
    return res.json(remoteJson || defaultResult);
  });

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      spreadsheetId: SPREADSHEET_ID,
      gasTarget: GAS_WEBAPP_URL,
    });
  });

  // Manifest endpoint with proper application/manifest+json MIME type
  app.get(["/manifest.webmanifest", "/manifest.json"], (_req, res) => {
    const publicManifest = path.join(process.cwd(), "public", "manifest.webmanifest");
    const rootManifest = path.join(process.cwd(), "manifest.webmanifest");
    const manifestFile = fs.existsSync(publicManifest) ? publicManifest : rootManifest;
    res.type("application/manifest+json").sendFile(manifestFile);
  });

  // Service Worker endpoint with proper MIME type and no-cache header
  app.get("/sw.js", (_req, res) => {
    const swFile = path.join(process.cwd(), "public", "sw.js");
    if (fs.existsSync(swFile)) {
      res.type("application/javascript").set("Cache-Control", "no-cache, no-store, must-revalidate").sendFile(swFile);
    } else {
      res.status(404).send("Service worker file not found");
    }
  });

  // Serve static assets from public folder explicitly
  app.use(express.static(path.join(process.cwd(), "public")));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  server.on("error", (err: any) => {
    if (err.code === "EADDRINUSE") {
      console.error(`[Server] Port ${PORT} sedang digunakan. Keluar agar process supervisor dapat mengatur ulang.`);
      process.exit(1);
    } else {
      console.error("[Server] Kesalahan listener:", err);
    }
  });

  const handleShutdown = () => {
    console.log("[Server] Menutup koneksi server secara aman...");
    server.close(() => {
      process.exit(0);
    });
  };

  process.on("SIGTERM", handleShutdown);
  process.on("SIGINT", handleShutdown);
}

startServer();
