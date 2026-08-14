/* ============================================================================
   hrcd-rekap : util.js — alat bersama yang dipakai semua layar.
   Yang terpenting: esc(). Nama sekolah dan nama regu diketik orang luar dan
   ditampilkan ke panitia — tanpa escape, satu nama berisi tag HTML bisa
   menjalankan skrip di layar panitia (temuan review: XSS tersimpan).
   ========================================================================== */

/** Escape teks agar aman ditaruh di dalam HTML maupun di dalam atribut. */
export function esc(v) {
  if (v === null || v === undefined) return "";
  return String(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Bangun fragmen DOM dari string HTML. */
export function h(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content;
}

/** Tag template literal yang meng-escape SEMUA nilai yang disisipkan.
 *  Pakai html`...${namaSekolah}...` alih-alih string biasa. */
export function html(potongan, ...nilai) {
  return potongan.reduce((hasil, p, i) =>
    hasil + p + (i < nilai.length ? esc(nilai[i]) : ""), "");
}

export const rupiah = n => "Rp " + Number(n || 0).toLocaleString("id-ID");

/* ---------------------------------------------------------------------------
   WAKTU — tiga bentuk, dan hanya tiga. Semua layar memakai yang ini.

     jamMenit(t)       15:30
     tanggalPanjang(t) 17 Agustus 2026
     tanggalJam(t)     17 Agustus 2026 15:30

   ATURAN MEMILIH: pakai jamMenit kalau HARINYA sudah jelas dari kedudukannya
   (jam berangkat kloter hari ini, jam datang regu barusan). Pakai tanggalJam
   kalau tidak — cap yang bisa menunjuk hari lain wajib menyebutkan harinya,
   kalau tidak "17:30" terbaca sebagai setengah jam lalu padahal kemarin sore.

   Kenapa nama bulannya ditulis sendiri dan bukan lewat toLocaleDateString:
   berkas data locale tidak selalu lengkap di WebView Android bawaan, dan
   kalau 'id-ID' tidak ada, browser diam-diam mundur ke Inggris — kertas
   kwitansi tercetak "14 August 2026" tanpa ada yang gagal. Larik ini
   menghilangkan seluruh kemungkinan itu.

   Titik dua, BUKAN titik. toLocaleTimeString('id-ID') memberi "07.04", yang
   di layar mudah terbaca sebagai angka desimal.
   ------------------------------------------------------------------------- */

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni",
               "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

const dua = (n) => String(n).padStart(2, "0");

/** "15:30" — 24 jam. Kosong jadi "—", bukan "NaN:NaN". */
export function jamMenit(t) {
  if (!t) return "—";
  const d = new Date(t);
  return `${dua(d.getHours())}:${dua(d.getMinutes())}`;
}

/** "17 Agustus 2026" */
export function tanggalPanjang(t) {
  if (!t) return "—";
  const d = new Date(t);
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

/** "17 Agustus 2026 15:30" */
export function tanggalJam(t) {
  if (!t) return "—";
  return `${tanggalPanjang(t)} ${jamMenit(t)}`;
}

/** Cincin berputar di tengah layar, menggantikan tulisan "Memuat…".
 *
 *  YANG PALING MENENTUKAN DI SINI BUKAN BENTUKNYA, MELAINKAN JEDANYA.
 *
 *  Sebagian besar layar meja terisi di bawah 200 ms. Penanda muat yang tampil
 *  seketika karena itu lebih sering terlihat sebagai KEDIPAN — muncul dan
 *  hilang sebelum sempat dibaca — dan kedipan terasa seperti layar yang
 *  tersendat, bukan layar yang cepat. Maka cincin ini punya
 *  `animation-delay` 180 ms: kalau datanya keburu datang, ia tidak pernah
 *  terlihat sama sekali. Yang melihatnya hanya orang yang memang menunggu.
 *
 *  `role="status"` + satu baris tersembunyi menjaga pembaca layar tetap
 *  mendapat kabar — bagi mereka perputaran tidak berarti apa-apa. */
export function pemuat(teks = "Memuat…") {
  return `<div class="pemuat" role="status" aria-live="polite">
    <span class="pemuat-cincin" aria-hidden="true"></span>
    <span class="visually-hidden">${esc(teks)}</span>
  </div>`;
}

/** Ikon refresh — dua panah melingkar, sama seperti yang dipakai dashboard
 *  pada umumnya.
 *
 *  SVG, bukan huruf Unicode dan bukan emoji, dan itu keputusan sadar: `↻`
 *  tampil berbeda-beda tebal di tiap sistem dan hilang sama sekali di
 *  sebagian font Android, sedangkan `🔄` datang dengan warnanya sendiri yang
 *  bertabrakan dengan deretan tombol abu-abu di sekitarnya. Yang ini
 *  mengikuti `currentColor`, jadi ia mewarisi warna tombolnya — termasuk saat
 *  tombolnya dipudarkan sedang berputar.
 *
 *  Tanpa ukuran tetap: mengikuti `font-size` tombolnya lewat `1em`. */
export const ikonRefresh = `
  <svg class="ikon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"
       aria-hidden="true" focusable="false">
    <path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-7.4-3.9"/>
    <path d="M3 12a9 9 0 0 1 9-9 9 9 0 0 1 7.4 3.9"/>
    <polyline points="19.6 2.6 19.6 7 15.2 7"/>
    <polyline points="4.4 21.4 4.4 17 8.8 17"/>
  </svg>`;

/** "barusan" · "23 menit lalu" · "2 jam lalu".
 *
 *  Umur sebuah cap, bukan jamnya. Dipakai berdampingan dengan `jamMenit`,
 *  tidak menggantikannya: "14:32" menjawab kapan, "(23 menit lalu)" menjawab
 *  apakah itu masih baru — dan orang yang baru menoleh ke layar butuh
 *  keduanya sekaligus. */
export function berapaLalu(t) {
  const menit = Math.floor((Date.now() - new Date(t).getTime()) / 60000);
  if (menit < 1) return "barusan";
  if (menit < 60) return `${menit} menit lalu`;
  return `${Math.floor(menit / 60)} jam lalu`;
}

/** Membaca jam yang DIKETIK panitia dan mengembalikannya sebagai "HH:MM"
 *  24 jam — atau `null` kalau bukan jam yang sah.
 *
 *  Ini menggantikan `<input type="time">` di dua meja yang mencatat jam.
 *  Alasannya bukan selera: kotak jam bawaan browser dirender menurut locale
 *  BROWSER, bukan `lang="id"` halaman ini, jadi laptop panitia yang Chrome-nya
 *  berbahasa Inggris menampilkan "07:15 AM" — dan tidak ada atribut HTML mana
 *  pun yang bisa memaksanya 24 jam. Satu meja memakai AM/PM sementara semua
 *  kertas, semua layar lain, dan seluruh sisa sistem memakai 00:00-23:59
 *  adalah cara yang murah sekali untuk mencatat 07:15 sebagai 19:15.
 *
 *  Yang diterima sengaja longgar, karena pencatat menyalin dari kertas dan
 *  mengetik cepat: "745", "0745", "7:45", "7.45", "07 45" — semuanya jadi
 *  "07:45". Yang di luar 00:00-23:59 ditolak, bukan dibetulkan diam-diam. */
export function jamSah(teks) {
  const angka = String(teks ?? "").replace(/\D/g, "");
  if (angka.length < 3 || angka.length > 4) return null;
  // "745" dibaca 7:45, bukan 74:5 — jam selalu bagian KIRI dan boleh satu
  // digit; menitnya selalu dua digit terakhir.
  const j = Number(angka.slice(0, angka.length - 2));
  const m = Number(angka.slice(-2));
  if (!Number.isInteger(j) || !Number.isInteger(m)) return null;
  if (j > 23 || m > 59) return null;
  return `${dua(j)}:${dua(m)}`;
}

/** Kotak jam 24 orang-ketik. Dipasang di setiap `<input>` yang menerima jam:
 *  membetulkan bentuknya saat kotak ditinggalkan, dan menandainya merah kalau
 *  isinya bukan jam. Membetulkan saat blur, BUKAN saat tiap ketukan — menata
 *  ulang teks di tengah orang mengetik memindahkan kursornya dan membuat
 *  angka berikutnya mendarat di tempat yang salah. */
export function pasangKotakJam(el) {
  if (!el) return;
  const nilai = () => jamSah(el.value);
  el.addEventListener("blur", () => {
    if (!el.value.trim()) { el.classList.remove("jam-salah"); return; }
    const v = nilai();
    if (v) { el.value = v; el.classList.remove("jam-salah"); }
    else el.classList.add("jam-salah");
  });
  el.addEventListener("input", () => {
    if (nilai() || !el.value.trim()) el.classList.remove("jam-salah");
  });
}

/** Notifikasi bawah layar.
 *
 *  Keduanya hilang sendiri, tapi galat diberi waktu DUA KALI LIPAT: 8 detik
 *  lawan 4. Sebelumnya galat tidak hilang sama sekali — orang awam sering
 *  sedang menatap papan ketik saat pesan muncul (temuan review), dan pesan
 *  yang keburu pergi sama saja dengan tidak pernah ada. Tapi pesan yang
 *  menetap selamanya punya harganya sendiri: ia menumpuk di bawah layar
 *  sepanjang hari dan menutupi tombol di sana, sampai panitia belajar
 *  mengabaikannya. Delapan detik cukup untuk mengangkat kepala dan membaca,
 *  dan tombol tutupnya tetap ada untuk yang ingin membuangnya lebih cepat.
 *
 *  Redupnya dilakukan lewat kelas .pudar, bukan animasi JavaScript, supaya
 *  aturan prefers-reduced-motion di gaya ikut berlaku: pengguna yang memilih
 *  "kurangi gerak" mendapat hilang seketika, bukan pudar. */
const DETIK_NOTIF      = 4000;
const DETIK_NOTIF_GALAT = 8000;

export function notif(pesan, galat = false) {
  document.querySelectorAll(".notification").forEach(n => n.remove());
  // Template BIASA, bukan tag html`` — tombol tutupnya HTML yang memang
  // harus DIRENDER. Tag html`` meng-escape SEMUA yang disisipkan (itu
  // gunanya, mencegah XSS dari nama sekolah), jadi tombolnya ikut jadi
  // korban dan tampil apa adanya sebagai teks di layar panitia.
  // Pesannya tetap lewat esc() — itu satu-satunya bagian dari luar.
  // Pesan galat dari database lahir huruf kecil — itu konvensi SQL
  // (`raise exception 'regu ... belum konfirmasi kontrak waktu'`). Di layar
  // panitia ia terbaca seperti potongan log, bukan kalimat. Huruf pertama
  // dibesarkan DI SINI, satu tempat, supaya pesan dari mana pun ikut rapi
  // tanpa perlu menyentuh belasan `raise exception` di migrasi.
  const kalimat = String(pesan).charAt(0).toUpperCase() + String(pesan).slice(1);
  const n = h(`<div class="notification ${galat ? "error" : ""}" role="alert">
      <span>${esc(kalimat)}</span>
      ${galat ? '<button class="notification-close" type="button" aria-label="tutup">✕</button>' : ""}
    </div>`);
  document.body.appendChild(n);
  const el = document.body.lastElementChild;
  if (galat) el.querySelector(".notification-close").addEventListener("click", () => el.remove());

  // Dipudarkan dulu, baru dibuang setelah transisinya selesai (.35s di gaya).
  // Kalau sudah ditutup manual, el sudah lepas dari halaman dan kedua baris
  // ini tidak melakukan apa-apa — remove() pada simpul yang sudah lepas aman.
  const jeda = galat ? DETIK_NOTIF_GALAT : DETIK_NOTIF;
  setTimeout(() => {
    el.classList.add("pudar");
    setTimeout(() => el.remove(), 400);
  }, jeda);
}

/** Dialog sederhana pengganti prompt(): punya judul, kartu identitas,
 *  beberapa isian, dan tombol batal yang jelas (temuan review: prompt()
 *  beruntun membingungkan dan batalnya senyap). */
export function dialog({ judul, kartuHtml = "", medan = [], labelAksi = "Simpan" }) {
  return new Promise(resolve => {
    const wadah = h(html`<div class="overlay" role="dialog" aria-modal="true"></div>`);
    document.body.appendChild(wadah);
    const el = document.body.lastElementChild;
    el.innerHTML = `
      <div class="dialog">
        <h2>${esc(judul)}</h2>
        ${kartuHtml}
        ${medan.map((m, i) => `
          <div class="field">
            <label for="dlg-${i}">${esc(m.label)}</label>
            <input id="dlg-${i}" type="${m.tipe || "text"}"
                   inputmode="${m.tipe === "number" ? "numeric" : "text"}"
                   value="${esc(m.nilai ?? "")}" placeholder="${esc(m.contoh ?? "")}">
            ${m.bantuan ? `<div class="hint">${esc(m.bantuan)}</div>` : ""}
          </div>`).join("")}
        <div class="dialog-error error" hidden></div>
        <div class="option-row">
          <button class="button button-secondary" data-batal type="button">Batal</button>
          <button class="button button-primary" data-ok type="button">${esc(labelAksi)}</button>
        </div>
      </div>`;

    const tutup = hasil => { el.remove(); resolve(hasil); };
    el.querySelector("[data-batal]").addEventListener("click", () => tutup(null));
    el.addEventListener("click", e => { if (e.target === el) tutup(null); });
    el.querySelector("[data-ok]").addEventListener("click", () => {
      const nilai = medan.map((_, i) => el.querySelector(`#dlg-${i}`).value.trim());
      const kosong = medan.findIndex((m, i) => m.wajib !== false && !nilai[i]);
      if (kosong >= 0) {
        const g = el.querySelector(".dialog-error");
        g.textContent = `${medan[kosong].label} wajib diisi.`;
        g.hidden = false;
        el.querySelector(`#dlg-${kosong}`).focus();
        return;
      }
      tutup(nilai);
    });
    const p = el.querySelector("input");
    if (p) p.focus();
    el.addEventListener("keydown", e => {
      if (e.key === "Escape") tutup(null);
      if (e.key === "Enter") el.querySelector("[data-ok]").click();
    });
  });
}

/** Kartu galat besar dengan tombol coba lagi — pengganti layar "Memuat…"
 *  yang menggantung selamanya (temuan review). */
export function kartuGagalMuat(pesan, saatCobaLagi) {
  const frag = h(html`
    <div class="card" style="border-color:var(--bahaya);background:var(--bahaya-muda)">
      <h2>Gagal memuat</h2>
      <p class="description">${pesan}</p>
      <button class="button button-primary" data-ulang type="button" style="margin-top:.8rem">
        Coba lagi
      </button>
    </div>`);
  frag.querySelector("[data-ulang]").addEventListener("click", saatCobaLagi);
  return frag;
}
