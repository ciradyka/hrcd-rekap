/* ============================================================================
   hrcd-rekap : screens/kalkulator-keberangkatan.js — layar Kalkulator Keberangkatan (#/pengaturan-kloter).

   Pembagian kloter dan waktu keberangkatan dari jendela berangkat dan jumlah
   regu Eksternal dan Internal. Rumusnya di web/js/departure-calculator.mjs.
   ========================================================================== */

import { bolehLihat, infoPengaturanKloter } from "../api.js";
import { kartuGalat, LAYAR, pasangKepala } from "../common/frame.js";
import { hitungRekomendasiKloter } from "../departure-calculator.mjs";
import { h, html, kartuGagalMuat, kotakJamHtml, pasangKotakJam,
         pemuat } from "../util.js";

/* ============================ PENGATURAN KLOTER ========================== */

export async function layarPengaturanKloter() {
  pasangKepala("Kalkulator Keberangkatan");
  if (!bolehLihat("pengaturan")) {
    LAYAR.replaceChildren(h(kartuGalat(
      "Akun ini tidak berhak membuka Kalkulator Keberangkatan.")));
    return;
  }
  LAYAR.replaceChildren(h(pemuat()));

  let cfg;
  try { cfg = await infoPengaturanKloter(); }
  catch (e) {
    LAYAR.replaceChildren(kartuGagalMuat(e.message, layarPengaturanKloter));
    return;
  }

  // Postgres mengirim TIME sebagai HH:MM:SS. Kotak jam hanya perlu HH:MM.
  const jamPendek = nilai => {
    const teks = String(nilai || "");
    return /^\d{2}:\d{2}/.test(teks) ? teks.slice(0, 5) : "";
  };
  const pertamaAwal = jamPendek(cfg.jam_mulai_berangkat);
  const terakhirAwal = jamPendek(cfg.jam_batas_berangkat);
  const eksternalAwal = Number(cfg.jumlah_eksternal) > 0
    ? Number(cfg.jumlah_eksternal) : Number(cfg.perkiraan_regu_eksternal);
  const internAwal = Number(cfg.jumlah_intern) > 0
    ? Number(cfg.jumlah_intern) : Number(cfg.perkiraan_regu_intern);

  LAYAR.replaceChildren(h(`
    <div class="card">
      <div class="two-column">
        <div class="field">
          <label for="kloter-pertama-hh">Waktu Berangkat Pertama</label>
          ${kotakJamHtml("kloter-pertama", pertamaAwal)}
        </div>
        <div class="field">
          <label for="kloter-terakhir-hh">Waktu Berangkat Terakhir</label>
          ${kotakJamHtml("kloter-terakhir", terakhirAwal)}
        </div>
      </div>
      <div class="two-column">
        <div class="field">
          <label for="kloter-jumlah-eksternal">Regu Eksternal</label>
          <input type="number" id="kloter-jumlah-eksternal" inputmode="numeric"
                 min="0" value="${eksternalAwal}">
        </div>
        <div class="field">
          <label for="kloter-jumlah-intern">Regu Internal</label>
          <input type="number" id="kloter-jumlah-intern" inputmode="numeric"
                 min="0" value="${internAwal}">
        </div>
      </div>
      <div class="error" id="kloter-galat" hidden></div>
    </div>

    <div class="card" id="kloter-rekomendasi" hidden>
      <h2>Rekomendasi</h2>
      <div class="table-wrapper">
        <table class="table data-table table-tetap table-kloter-rekomendasi">
          <thead><tr>
            <th>Kloter</th>
            <th>Eksternal</th>
            <th>Internal</th>
            <th>Waktu Berangkat</th>
          </tr></thead>
          <tbody id="kloter-rekomendasi-baris"></tbody>
        </table>
      </div>
    </div>
  `));

  const waktuPertama = pasangKotakJam("kloter-pertama");
  const waktuTerakhir = pasangKotakJam("kloter-terakhir");
  const jumlahEksternal = document.getElementById("kloter-jumlah-eksternal");
  const jumlahIntern = document.getElementById("kloter-jumlah-intern");
  const galat = document.getElementById("kloter-galat");
  const rekomendasi = document.getElementById("kloter-rekomendasi");
  const tbody = document.getElementById("kloter-rekomendasi-baris");

  const gambar = () => {
    const pertama = waktuPertama.nilai();
    const terakhir = waktuTerakhir.nilai();
    const eksternalTeks = jumlahEksternal.value.trim();
    const internTeks = jumlahIntern.value.trim();

    galat.hidden = true;
    jumlahEksternal.setAttribute("aria-invalid", "false");
    jumlahIntern.setAttribute("aria-invalid", "false");
    rekomendasi.hidden = true;
    if (!pertama || !terakhir || !eksternalTeks || !internTeks) return;

    try {
      const baris = hitungRekomendasiKloter({
        waktuPertama: pertama,
        waktuTerakhir: terakhir,
        jumlahEksternal: Number(eksternalTeks),
        jumlahIntern: Number(internTeks),
        maksEksternalPerKloter: Number(cfg.maks_eksternal_per_kloter),
        maksInternPerKloter: Number(cfg.maks_intern_per_kloter),
        kloterMaks: Number(cfg.kloter_maks),
        jedaMaksMenit: Number(cfg.interval_berangkat_menit) || Infinity,
      });
      waktuTerakhir.salah(false);
      tbody.replaceChildren(h(baris.map(x => html`
        <tr>
          <td><strong>K${x.kloter}</strong></td>
          <td>${x.jumlahEksternal}</td>
          <td>${x.jumlahIntern}</td>
          <td>${x.waktuBerangkat}</td>
        </tr>`).join("")));
      rekomendasi.hidden = false;
    } catch (e) {
      const eksternalSalah = !Number.isInteger(Number(eksternalTeks)) || Number(eksternalTeks) < 0;
      const internSalah = !Number.isInteger(Number(internTeks)) || Number(internTeks) < 0;
      jumlahEksternal.setAttribute("aria-invalid", String(eksternalSalah));
      jumlahIntern.setAttribute("aria-invalid", String(internSalah));
      if (/waktu berangkat terakhir/i.test(e.message)) waktuTerakhir.salah(true);
      galat.textContent = e.message;
      galat.hidden = false;
    }
  };

  waktuPertama.dengar(gambar);
  waktuTerakhir.dengar(gambar);
  jumlahEksternal.addEventListener("input", gambar);
  jumlahIntern.addEventListener("input", gambar);
  gambar();
}
