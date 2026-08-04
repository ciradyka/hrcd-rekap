/* ============================================================================
   hrcd-rekap : daftar.js — form pendaftaran publik (alur 3).
   Wizard: SATU pertanyaan besar per layar, karena pengisinya bisa siapa saja —
   pembina, kakak kelas, atau orang tua — lewat HP di sinyal seadanya.

   Perlindungan untuk kondisi buruk (temuan review):
   - Isian disimpan di localStorage tiap langkah; refresh/HP mati tidak
     menghapus ketikan.
   - Tombol back HP = kembali satu langkah (history.pushState), bukan keluar.
   - Satu kunci kirim dipakai ulang saat mencoba lagi, sehingga sinyal putus
     di tengah pengiriman tidak melahirkan dua pendaftaran.
   - Kode pembayaran disimpan; kalau halaman dibuka lagi, kode itu ditampilkan
     kembali.
   ========================================================================== */

import { daftarSekolah, kirimPendaftaran, infoEdisi, GalatApi } from "./api.js";
import { esc, h, html, rupiah, notif, kartuGagalMuat } from "./util.js";

const LAYAR = document.getElementById("layar");
const GOLONGAN = [
  { kode: "penggalang_pa", label: "Penggalang Putra", ket: "SMP / MTs — putra" },
  { kode: "penggalang_pi", label: "Penggalang Putri", ket: "SMP / MTs — putri" },
  { kode: "penegak_pa",    label: "Penegak Putra",    ket: "SMA / SMK / MA — putra" },
  { kode: "penegak_pi",    label: "Penegak Putri",    ket: "SMA / SMK / MA — putri" },
];
const TOTAL_LANGKAH = 6;
const KUNCI_DRAF = "hrcd_draf";
const KUNCI_HASIL = "hrcd_hasil";

const kosong = () => ({
  sekolah: null, butuh_barak: null, jumlah_pendamping: 0,
  rincian: { penggalang_pa: 0, penggalang_pi: 0, penegak_pa: 0, penegak_pi: 0 },
  regu: [], kontak_wa: "",
  kunci_kirim: (crypto.randomUUID ? crypto.randomUUID()
                : String(Date.now()) + Math.random().toString(16).slice(2)),
});

let jawab = kosong();
let SEKOLAH = [];
let EDISI = null;
let langkahKini = 1;
let tokenTurnstile = null;

/* ---------------- draf & riwayat ---------------- */

const simpanDraf = () => {
  try { localStorage.setItem(KUNCI_DRAF, JSON.stringify({ jawab, langkah: langkahKini })); }
  catch { /* mode privat: jalan tanpa draf */ }
};
const hapusDraf = () => { try { localStorage.removeItem(KUNCI_DRAF); } catch {} };
const ambilDraf = () => {
  try { return JSON.parse(localStorage.getItem(KUNCI_DRAF) || "null"); } catch { return null; }
};

const LANGKAH_FN = {};   // diisi di bawah: 1..6 -> fungsi

function tampilkan(langkah, isiHtml, { dorongRiwayat = true } = {}) {
  langkahKini = langkah;
  wizardJalan = true;
  simpanDraf();
  if (dorongRiwayat) history.pushState({ langkah }, "", `#langkah-${langkah}`);
  LAYAR.replaceChildren(h(`
    <div class="langkah-bar" aria-hidden="true">
      ${Array.from({ length: TOTAL_LANGKAH }, (_, i) =>
        `<div class="titik ${i < langkah ? "aktif" : ""}"></div>`).join("")}
    </div>
    <p class="keterangan" style="margin:-.6rem 0 .8rem">Langkah ${langkah} dari ${TOTAL_LANGKAH}</p>
    ${isiHtml}
  `));
  const fokus = LAYAR.querySelector("input, button.pilihan");
  if (fokus) fokus.focus();
  window.scrollTo(0, 0);
}

let wizardJalan = false;   // popstate diabaikan sebelum wizard benar-benar dibuka

window.addEventListener("popstate", (e) => {
  if (!wizardJalan) return;
  const l = (e.state && e.state.langkah) || 1;
  const fn = LANGKAH_FN[l];
  if (fn) fn({ dorongRiwayat: false });
});

window.addEventListener("beforeunload", (e) => {
  const adaIsi = jawab.sekolah || jawab.regu.length || jawab.kontak_wa;
  if (adaIsi && !sessionStorage.getItem("hrcd_selesai")) {
    e.preventDefault(); e.returnValue = "";
  }
});

const totalRincian = () => Object.values(jawab.rincian).reduce((a, b) => a + b, 0);
const normal = s => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/* ---------------- Langkah 1 : sekolah ---------------- */

function langkah1(opsi) {
  tampilkan(1, `
    <div class="kartu">
      <h2>Dari sekolah mana?</h2>
      <p class="keterangan">Ketik nama sekolahmu, lalu tekan Lanjut.</p>
      <div class="medan" style="margin-top:.8rem">
        <label for="cari">Nama sekolah</label>
        <input type="text" id="cari" autocomplete="off"
               placeholder="contoh: SMPN 1 Ciamis" value="${esc(jawab.sekolah?.nama ?? "")}">
        <div class="saran" id="saran" hidden></div>
      </div>
      <button class="tombol tombol-utama" id="lanjut1" type="button">Lanjut</button>
      <div id="konfirmasi"></div>
    </div>
  `, opsi);

  const cari = document.getElementById("cari");
  const saran = document.getElementById("saran");

  const tampilSaran = () => {
    const q = normal(cari.value.trim());
    document.getElementById("konfirmasi").replaceChildren();
    if (q.length < 2) { saran.hidden = true; return; }
    const cocok = SEKOLAH.filter(s => normal(s.nama).includes(q)).slice(0, 8);
    saran.hidden = cocok.length === 0;
    saran.replaceChildren(...cocok.map(s => {
      const b = document.createElement("button");
      b.type = "button";
      b.innerHTML = html`<strong>${s.nama}</strong><span class="alamat">${s.alamat}</span>`;
      b.addEventListener("click", () => konfirmasiSekolah(s));
      return b;
    }));
  };
  cari.addEventListener("input", tampilSaran);
  cari.addEventListener("keydown", e => { if (e.key === "Enter") document.getElementById("lanjut1").click(); });

  document.getElementById("lanjut1").addEventListener("click", () => {
    const teks = cari.value.trim();
    if (!teks) { cari.focus(); notif("Isi dulu nama sekolahmu.", true); return; }
    const persis = SEKOLAH.find(s => normal(s.nama) === normal(teks));
    if (persis) { konfirmasiSekolah(persis); return; }
    const mirip = SEKOLAH.filter(s => normal(s.nama).includes(normal(teks))
                                   || normal(teks).includes(normal(s.nama))).slice(0, 5);
    if (mirip.length) { tawarkanMirip(teks, mirip); return; }
    sekolahManual(teks);
  });

  function konfirmasiSekolah(s) {
    saran.hidden = true;
    cari.value = s.nama;
    document.getElementById("konfirmasi").replaceChildren(h(html`
      <div class="kartu kartu-identitas" style="margin-top:.8rem">
        <div class="nama">${s.nama}</div>
        <div class="detail">📍 ${s.alamat}</div>
      </div>`));
    document.getElementById("konfirmasi").appendChild(h(`
      <p style="margin-top:.4rem">Benar ini sekolahmu?</p>
      <div class="pilihan-baris" style="margin-top:.6rem">
        <button class="tombol tombol-utama" id="ya" type="button">Ya, benar</button>
        <button class="tombol tombol-kalem" id="bukan" type="button">Bukan</button>
      </div>`));
    document.getElementById("ya").addEventListener("click", () => {
      jawab.sekolah = { id: s.id, nama: s.nama, alamat: s.alamat, baru: false };
      langkah2();
    });
    document.getElementById("bukan").addEventListener("click", () => {
      document.getElementById("konfirmasi").replaceChildren();
      cari.focus(); cari.select();
    });
  }

  function tawarkanMirip(teks, mirip) {
    saran.hidden = true;
    const box = document.getElementById("konfirmasi");
    box.replaceChildren(h(`
      <div class="kartu" style="margin-top:.8rem;border-color:var(--utama)">
        <h2 style="font-size:1.05rem">Mungkin maksudmu:</h2>
        <div class="saran" id="mirip"></div>
        <p class="keterangan" style="margin-top:.8rem">Kalau bukan salah satu di atas,
           lanjut isi alamat sekolahmu sendiri.</p>
        <button class="tombol tombol-kalem" id="tetap-manual" type="button">
          Bukan, isi sendiri
        </button>
      </div>`));
    document.getElementById("mirip").replaceChildren(...mirip.map(s => {
      const b = document.createElement("button");
      b.type = "button";
      b.innerHTML = html`<strong>${s.nama}</strong><span class="alamat">${s.alamat}</span>`;
      b.addEventListener("click", () => konfirmasiSekolah(s));
      return b;
    }));
    document.getElementById("tetap-manual").addEventListener("click", () => sekolahManual(teks));
  }

  function sekolahManual(nilaiAwal) {
    saran.hidden = true;
    document.getElementById("konfirmasi").replaceChildren(h(html`
      <div class="kartu" style="margin-top:.8rem; border-color: var(--utama)">
        <h2>Isi data sekolah</h2>
        <div class="medan">
          <label for="m-nama">Nama sekolah (lengkap)</label>
          <input type="text" id="m-nama" value="${nilaiAwal ?? ""}" placeholder="contoh: SMAN 2 Banjar">
          <div class="galat" id="g-nama" hidden>Nama sekolah wajib diisi.</div>
        </div>
        <div class="medan">
          <label for="m-alamat">Alamat sekolah (jalan + kota)</label>
          <input type="text" id="m-alamat" placeholder="contoh: Jl. Raya Banjar No. 2, Kota Banjar">
          <div class="galat" id="g-alamat" hidden>Alamat wajib diisi — untuk membedakan sekolah bernama sama.</div>
        </div>
        <button class="tombol tombol-utama" id="lanjut-manual" type="button">Lanjut</button>
      </div>`));
    document.getElementById("lanjut-manual").addEventListener("click", () => {
      const nama = document.getElementById("m-nama").value.trim();
      const alamat = document.getElementById("m-alamat").value.trim();
      document.getElementById("g-nama").hidden = !!nama;
      document.getElementById("g-alamat").hidden = !!alamat;
      if (!nama || !alamat) return;
      jawab.sekolah = { nama, alamat, baru: true };
      langkah2();
    });
  }
}

/* ---------------- Langkah 2 : penginapan ---------------- */

function langkah2(opsi) {
  tampilkan(2, `
    <div class="kartu">
      <h2>Perlu tempat menginap?</h2>
      <p class="keterangan">Panitia menyediakan ruang kelas untuk menginap malam sebelum lomba, gratis.</p>
      <div class="pilihan-baris" style="margin-top:.9rem">
        <button class="pilihan" id="p-ya"    aria-pressed="${jawab.butuh_barak === true}"  type="button">Ya, perlu</button>
        <button class="pilihan" id="p-tidak" aria-pressed="${jawab.butuh_barak === false}" type="button">Tidak perlu</button>
      </div>
      <div id="pendamping" style="margin-top:1rem"></div>
      <div class="pilihan-baris" style="margin-top:1.2rem">
        <button class="tombol tombol-kalem" id="mundur" type="button">← Kembali</button>
        <button class="tombol tombol-utama" id="maju" type="button" disabled>Lanjut</button>
      </div>
    </div>
  `, opsi);

  const maju = document.getElementById("maju");
  const boks = document.getElementById("pendamping");
  const setPilihan = (ya) => {
    jawab.butuh_barak = ya;
    document.getElementById("p-ya").setAttribute("aria-pressed", String(ya));
    document.getElementById("p-tidak").setAttribute("aria-pressed", String(!ya));
    maju.disabled = false;
    boks.replaceChildren();
    if (ya) boks.appendChild(h(`
      <div class="medan">
        <label for="n-pendamping">Berapa pendamping (pembina/guru) yang ikut menginap?</label>
        <input type="number" id="n-pendamping" min="0" max="30" inputmode="numeric"
               value="${esc(jawab.jumlah_pendamping)}">
        <div class="bantuan">Boleh 0 kalau belum tahu — nanti bisa diubah saat daftar ulang.</div>
      </div>`));
    simpanDraf();
  };
  document.getElementById("p-ya").addEventListener("click", () => setPilihan(true));
  document.getElementById("p-tidak").addEventListener("click", () => setPilihan(false));
  if (jawab.butuh_barak !== null) setPilihan(jawab.butuh_barak);

  document.getElementById("mundur").addEventListener("click", () => langkah1());
  maju.addEventListener("click", () => {
    const n = document.getElementById("n-pendamping");
    jawab.jumlah_pendamping = jawab.butuh_barak && n ? Math.max(0, Number(n.value) || 0) : 0;
    langkah3();
  });
}

/* ---------------- Langkah 3 : berapa regu ---------------- */

function langkah3(opsi) {
  tampilkan(3, `
    <div class="kartu">
      <h2>Mendaftarkan berapa regu?</h2>
      <p class="keterangan">1 regu = 5 orang. Rincikan per golongan dengan tombol + dan −.</p>
      <div style="margin-top:1rem">
        ${GOLONGAN.map(g => `
          <div class="medan" style="display:flex;align-items:center;gap:1rem;justify-content:space-between">
            <div>
              <strong style="font-size:1.1rem">${g.label}</strong>
              <div class="bantuan">${g.ket}</div>
            </div>
            <div class="stepper">
              <button type="button" aria-label="kurangi ${g.label}" data-kurang="${g.kode}">−</button>
              <span class="angka" id="n-${g.kode}" aria-live="polite">${jawab.rincian[g.kode]}</span>
              <button type="button" aria-label="tambah ${g.label}" data-tambah="${g.kode}">+</button>
            </div>
          </div>`).join("")}
      </div>
      <div class="kartu" style="background:var(--utama-muda);border-color:var(--utama)">
        <strong style="font-size:1.2rem">Total: <span id="total">0</span> regu</strong>
        <div id="biaya" class="keterangan"></div>
      </div>
      <div class="pilihan-baris">
        <button class="tombol tombol-kalem" id="mundur" type="button">← Kembali</button>
        <button class="tombol tombol-utama" id="maju" type="button" disabled>Lanjut</button>
      </div>
    </div>
  `, opsi);

  const perbarui = () => {
    const total = totalRincian();
    document.getElementById("total").textContent = total;
    document.getElementById("biaya").textContent = total
      ? `Biaya pendaftaran: ${total} × ${rupiah(EDISI.biaya_per_regu)} = ${rupiah(total * EDISI.biaya_per_regu)}`
      : "";
    document.getElementById("maju").disabled = total < 1;
    simpanDraf();
  };
  LAYAR.querySelectorAll("[data-tambah]").forEach(b => b.addEventListener("click", () => {
    const k = b.dataset.tambah;
    if (totalRincian() >= 30) { notif("Maksimal 30 regu per pendaftaran. Hubungi panitia bila lebih.", true); return; }
    jawab.rincian[k]++; document.getElementById(`n-${k}`).textContent = jawab.rincian[k]; perbarui();
  }));
  LAYAR.querySelectorAll("[data-kurang]").forEach(b => b.addEventListener("click", () => {
    const k = b.dataset.kurang;
    if (jawab.rincian[k] > 0) { jawab.rincian[k]--; document.getElementById(`n-${k}`).textContent = jawab.rincian[k]; perbarui(); }
  }));
  perbarui();

  document.getElementById("mundur").addEventListener("click", () => langkah2());
  document.getElementById("maju").addEventListener("click", () => {
    const lama = jawab.regu;
    jawab.regu = [];
    for (const g of GOLONGAN) {
      const bekas = lama.filter(r => r.golongan === g.kode);
      for (let i = 0; i < jawab.rincian[g.kode]; i++)
        jawab.regu.push(bekas[i] ?? { golongan: g.kode, nama_regu: "", nama_ketua: "" });
    }
    langkah4();
  });
}

/* ---------------- Langkah 4 : nama tiap regu ---------------- */

function langkah4(opsi) {
  tampilkan(4, `
    <div class="kartu">
      <h2>Nama tiap regu</h2>
      <p class="keterangan">Isi nama regu dan nama ketuanya. Nama anggota lain tidak perlu.</p>
    </div>
    ${jawab.regu.map((r, i) => html`
      <div class="kartu">
        <span class="lencana lencana-hijau">Regu ${i + 1} — ${GOLONGAN.find(g => g.kode === r.golongan).label}</span>
        <div class="medan" style="margin-top:.7rem">
          <label for="r-nama-${i}">Nama regu</label>
          <input type="text" id="r-nama-${i}" value="${r.nama_regu}" placeholder="contoh: Rajawali">
        </div>
        <div class="medan">
          <label for="r-ketua-${i}">Nama ketua regu</label>
          <input type="text" id="r-ketua-${i}" value="${r.nama_ketua}" placeholder="contoh: Andi Saputra">
        </div>
      </div>`).join("")}
    <div class="pilihan-baris">
      <button class="tombol tombol-kalem" id="mundur" type="button">← Kembali</button>
      <button class="tombol tombol-utama" id="maju" type="button">Lanjut</button>
    </div>
  `, opsi);

  LAYAR.querySelectorAll("input").forEach(i => i.addEventListener("input", () => { simpanIsian(); simpanDraf(); }));
  document.getElementById("mundur").addEventListener("click", () => { simpanIsian(); langkah3(); });
  document.getElementById("maju").addEventListener("click", () => {
    simpanIsian();
    const kosongIdx = jawab.regu.findIndex(r => !r.nama_regu || !r.nama_ketua);
    if (kosongIdx >= 0) {
      notif(`Regu ${kosongIdx + 1} belum lengkap — isi nama regu dan ketuanya.`, true);
      const inp = document.getElementById(
        jawab.regu[kosongIdx].nama_regu ? `r-ketua-${kosongIdx}` : `r-nama-${kosongIdx}`);
      inp.setAttribute("aria-invalid", "true");
      inp.scrollIntoView({ block: "center" }); inp.focus();
      return;
    }
    langkah5();
  });

  function simpanIsian() {
    jawab.regu.forEach((r, i) => {
      r.nama_regu = document.getElementById(`r-nama-${i}`).value.trim();
      r.nama_ketua = document.getElementById(`r-ketua-${i}`).value.trim();
    });
  }
}

/* ---------------- Langkah 5 : kontak WA ---------------- */

function langkah5(opsi) {
  tampilkan(5, html`
    <div class="kartu">
      <h2>Nomor WhatsApp yang bisa dihubungi</h2>
      <p class="keterangan">Satu nomor untuk semua regu — panitia menghubungi lewat sini.</p>
      <div class="medan" style="margin-top:.8rem">
        <label for="wa">Nomor WA</label>
        <input type="tel" id="wa" inputmode="numeric" value="${jawab.kontak_wa}"
               placeholder="contoh: 081234567890">
        <div class="galat" id="g-wa" hidden>Isi nomor WA yang benar (minimal 9 angka).</div>
      </div>
      <div class="pilihan-baris">
        <button class="tombol tombol-kalem" id="mundur" type="button">← Kembali</button>
        <button class="tombol tombol-utama" id="maju" type="button">Lanjut</button>
      </div>
    </div>
  `, opsi);
  document.getElementById("mundur").addEventListener("click", () => langkah4());
  const lanjut = () => {
    const wa = document.getElementById("wa").value.replace(/[^0-9+]/g, "");
    const sah = wa.replace(/\D/g, "").length >= 9;
    document.getElementById("g-wa").hidden = sah;
    if (!sah) { document.getElementById("wa").setAttribute("aria-invalid", "true"); return; }
    jawab.kontak_wa = wa;
    langkah6();
  };
  document.getElementById("maju").addEventListener("click", lanjut);
  document.getElementById("wa").addEventListener("keydown", e => { if (e.key === "Enter") lanjut(); });
}

/* ---------------- Langkah 6 : ringkasan + kirim ---------------- */

function langkah6(opsi) {
  const total = jawab.regu.length;
  const tagihan = total * EDISI.biaya_per_regu;
  const perluTurnstile = window.HRCD.mode === "supabase" && window.HRCD.turnstileSiteKey;
  tampilkan(6, html`
    <div class="kartu">
      <h2>Periksa dulu, lalu kirim</h2>
      <table class="tabel" style="margin-top:.6rem">
        <tr><td>Sekolah</td><td><strong>${jawab.sekolah.nama}</strong><br><span class="keterangan">${jawab.sekolah.alamat}</span></td></tr>
        <tr><td>Menginap</td><td><strong>${jawab.butuh_barak ? (jawab.jumlah_pendamping ? `Ya — ${jawab.jumlah_pendamping} pendamping` : "Ya") : "Tidak"}</strong></td></tr>
        <tr><td>Jumlah regu</td><td><strong>${total}</strong></td></tr>
        <tr><td>Kontak WA</td><td><strong>${jawab.kontak_wa}</strong></td></tr>
        <tr><td>Total biaya</td><td><strong style="font-size:1.3rem">${rupiah(tagihan)}</strong></td></tr>
      </table>
    </div>
    <div class="kartu">
      <h2 style="font-size:1.05rem">Daftar regu</h2>
      <table class="tabel">
        ${jawab.regu.map((r, i) => html`
          <tr><td>${i + 1}. <strong>${r.nama_regu}</strong></td>
              <td>${GOLONGAN.find(g => g.kode === r.golongan).label}</td>
              <td>Ketua: ${r.nama_ketua}</td></tr>`).join("")}
      </table>
    </div>
    ${perluTurnstile ? `<div class="kartu"><div id="turnstile"></div>
        <p class="keterangan">Centang kotak di atas dulu (bukti kamu bukan robot).</p></div>` : ""}
    <div class="pilihan-baris">
      <button class="tombol tombol-kalem" id="mundur" type="button">← Kembali</button>
      <button class="tombol tombol-utama" id="kirim" type="button" ${perluTurnstile ? "disabled" : ""}>
        Kirim Pendaftaran
      </button>
    </div>
  `, opsi);

  document.getElementById("mundur").addEventListener("click", () => langkah5());

  if (perluTurnstile) {
    const pasang = () => window.turnstile.render("#turnstile", {
      sitekey: window.HRCD.turnstileSiteKey,
      callback: (t) => { tokenTurnstile = t; document.getElementById("kirim").disabled = false; },
      "expired-callback": () => { tokenTurnstile = null; document.getElementById("kirim").disabled = true; },
      "error-callback": () => notif("Verifikasi keamanan gagal dimuat. Periksa internet, lalu muat ulang.", true),
    });
    if (window.turnstile) pasang();
    else {
      const s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true; s.onload = pasang;
      s.onerror = () => notif("Verifikasi keamanan gagal dimuat. Periksa internet, lalu muat ulang.", true);
      document.head.appendChild(s);
    }
  }

  document.getElementById("kirim").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    if (btn.dataset.jalan === "1") return;
    btn.dataset.jalan = "1"; btn.disabled = true; btn.textContent = "Mengirim…";
    try {
      const hasil = await kirimPendaftaran({
        nama_sekolah: jawab.sekolah.nama,
        alamat_sekolah: jawab.sekolah.alamat,
        butuh_barak: jawab.butuh_barak,
        jumlah_pendamping: jawab.jumlah_pendamping,
        kontak_wa: jawab.kontak_wa,
        regu: jawab.regu,
        kunci_kirim: jawab.kunci_kirim,   // sama saat mencoba lagi
      }, tokenTurnstile);
      sessionStorage.setItem("hrcd_selesai", "1");
      try { localStorage.setItem(KUNCI_HASIL, JSON.stringify(hasil)); } catch {}
      hapusDraf();
      sukses(hasil);
    } catch (err) {
      btn.dataset.jalan = ""; btn.disabled = false; btn.textContent = "Kirim Pendaftaran";
      // Galat pada tombol paling penting: tampil MENETAP di layar, bukan
      // toast yang hilang sendiri (temuan review).
      document.getElementById("kirim").insertAdjacentElement("beforebegin",
        h(html`<div class="kartu" style="border-color:var(--bahaya);background:var(--bahaya-muda)">
          <strong>Belum terkirim.</strong> ${err instanceof GalatApi ? err.message : "Coba lagi ya."}
          <div class="keterangan" style="margin-top:.3rem">Isianmu tersimpan — tekan "Kirim Pendaftaran" lagi.</div>
        </div>`).firstElementChild);
    }
  });
}

/* ---------------- sukses ---------------- */

function sukses(hasil) {
  tampilkan(TOTAL_LANGKAH, html`
    <div class="kartu" style="border-color:var(--hijau);background:var(--hijau-muda)">
      <h2>✅ Pendaftaran diterima!</h2>
      <p>Ini <strong>kode pembayaran</strong>-mu. Simpan baik-baik — kode ini dipakai
         saat membayar dan saat daftar ulang.</p>
      <div class="angka-raksasa" style="margin:1rem 0">${hasil.kode_pembayaran}</div>
      <button class="tombol tombol-kalem" id="salin" type="button">📋 Salin kode</button>
    </div>
    <div class="kartu">
      <h2 style="font-size:1.1rem">Cara membayar</h2>
      <p style="margin-top:.4rem">Transfer <strong>${rupiah(hasil.total_tagihan)}</strong>
         ke rekening panitia (tertera di poster/brosur), tulis kode
         <strong>${hasil.kode_pembayaran}</strong> di berita transfer —
         atau bayar tunai di meja pendaftaran.</p>
      <p class="keterangan" style="margin-top:.6rem">Setelah panitia memeriksa
         pembayaran, semua regumu (${hasil.jumlah_regu} regu) resmi terdaftar.</p>
    </div>
    <a class="tombol tombol-utama" style="text-decoration:none"
       href="https://wa.me/?text=${encodeURIComponent(
         `Kode pembayaran HRCD: ${hasil.kode_pembayaran} (${hasil.jumlah_regu} regu, total ${rupiah(hasil.total_tagihan)})`)}">
       Kirim kode ke WhatsApp
    </a>
  `);
  document.getElementById("salin").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(hasil.kode_pembayaran);
      notif("Kode tersalin.");
    } catch {
      notif("Salin otomatis tidak didukung di HP ini — catat manual atau kirim lewat WhatsApp.", true);
    }
  });
}

/* ---------------- mulai ---------------- */

async function mulai() {
  LAYAR.replaceChildren(h(`<p>Memuat…</p>`));
  try {
    [SEKOLAH, EDISI] = await Promise.all([daftarSekolah(), infoEdisi()]);
  } catch (e) {
    LAYAR.replaceChildren(kartuGagalMuat(e.message, mulai));
    return;
  }
  document.getElementById("label-edisi").textContent = EDISI.nama;

  // Kode dari pendaftaran sebelumnya (halaman dibuka lagi).
  let hasilLama = null;
  try { hasilLama = JSON.parse(localStorage.getItem(KUNCI_HASIL) || "null"); } catch {}
  const draf = ambilDraf();

  if (hasilLama && !draf) {
    LAYAR.replaceChildren(h(html`
      <div class="kartu" style="border-color:var(--hijau);background:var(--hijau-muda)">
        <h2>Pendaftaran terakhirmu</h2>
        <p>Kode pembayaran:</p>
        <div class="angka-raksasa" style="margin:.6rem 0">${hasilLama.kode_pembayaran}</div>
        <p class="keterangan">${hasilLama.jumlah_regu} regu · ${rupiah(hasilLama.total_tagihan)}</p>
      </div>
      <button class="tombol tombol-kalem" id="baru" type="button">Daftarkan sekolah lain</button>`));
    document.getElementById("baru").addEventListener("click", () => {
      try { localStorage.removeItem(KUNCI_HASIL); } catch {}
      sessionStorage.removeItem("hrcd_selesai");
      jawab = kosong(); langkah1();
    });
    return;
  }

  if (draf && draf.jawab && (draf.jawab.sekolah || draf.jawab.regu?.length)) {
    LAYAR.replaceChildren(h(html`
      <div class="kartu">
        <h2>Lanjutkan isian yang belum selesai?</h2>
        <p class="keterangan">Ada pendaftaran ${draf.jawab.sekolah?.nama ?? ""} yang
           belum sempat dikirim.</p>
        <div class="pilihan-baris" style="margin-top:.9rem">
          <button class="tombol tombol-utama" id="lanjutkan" type="button">Lanjutkan</button>
          <button class="tombol tombol-kalem" id="ulang" type="button">Mulai dari awal</button>
        </div>
      </div>`));
    document.getElementById("lanjutkan").addEventListener("click", () => {
      jawab = { ...kosong(), ...draf.jawab };
      (LANGKAH_FN[draf.langkah] || langkah1)();
    });
    document.getElementById("ulang").addEventListener("click", () => {
      hapusDraf(); jawab = kosong(); langkah1();
    });
    return;
  }

  langkah1();
}

Object.assign(LANGKAH_FN, { 1: langkah1, 2: langkah2, 3: langkah3, 4: langkah4, 5: langkah5, 6: langkah6 });
mulai();
