/* ============================================================================
   hrcd-rekap : screens/ganti-password.js — layar Ganti Password (#/ganti-password).

   Mengganti password akun yang sedang masuk.
   ========================================================================== */

import { gantiPasswordSendiri } from "../api.js";
import { LAYAR, pasangKepala } from "../common/frame.js";
import { h, notif } from "../util.js";

/* ============================ GANTI PASSWORD ============================= */

// Kode konfirmasi TETAP, sengaja tidak ditulis di label atau pesan galat —
// panitia tahu kodenya dari koordinator, bukan dari layar ini. Tapi ini
// TETAP BUKAN pemeriksaan identitas sungguhan: nilainya sama untuk semua
// orang, dan ada apa adanya di berkas JS ini — siapa pun yang membuka
// devtools browser bisa membacanya. Identitas yang sungguhan diperiksa
// sudah dibuktikan lewat sesi login yang sedang aktif; kode ini cuma jeda
// sadar sebelum ganti password benar-benar terjadi, karena HP panitia
// sering berpindah tangan sebentar di lapangan.
export const KODE_KONFIRMASI_PASSWORD = "ABCD";

export function layarGantiPassword() {
  pasangKepala("Ganti Password");
  LAYAR.replaceChildren(h(`
    <div class="card" style="max-width:480px;margin:0 auto">
      <h2>Ganti Password Akun Sendiri</h2>
      <div class="field">
        <label for="gp-baru">Password baru</label>
        <input type="password" id="gp-baru" autocomplete="new-password">
      </div>
      <div class="field">
        <label for="gp-kode">Kode Konfirmasi</label>
        <input type="password" id="gp-kode" autocomplete="off">
      </div>
      <div class="error" id="gp-galat" hidden></div>
      <button class="button button-primary" id="gp-simpan" type="button">Simpan Password Baru</button>
    </div>
  `));

  const baru = document.getElementById("gp-baru");
  const kode = document.getElementById("gp-kode");
  const galat = document.getElementById("gp-galat");
  const btn = document.getElementById("gp-simpan");

  btn.addEventListener("click", async () => {
    galat.hidden = true;
    if (!baru.value || baru.value.length < 6) {
      galat.textContent = "Password baru minimal 6 karakter.";
      galat.hidden = false; baru.focus(); return;
    }
    if (kode.value.trim() !== KODE_KONFIRMASI_PASSWORD) {
      galat.textContent = "Kode konfirmasi salah. Tanyakan koordinator kalau lupa.";
      galat.hidden = false; kode.focus(); return;
    }
    if (btn.dataset.jalan === "1") return;
    btn.dataset.jalan = "1"; btn.disabled = true; btn.textContent = "Menyimpan…";
    try {
      await gantiPasswordSendiri(baru.value);
      notif("Password berhasil diganti.");
      baru.value = ""; kode.value = "";
    } catch (err) {
      galat.textContent = err.message; galat.hidden = false;
    } finally {
      btn.dataset.jalan = ""; btn.disabled = false; btn.textContent = "Simpan Password Baru";
    }
  });
  baru.focus();
}
