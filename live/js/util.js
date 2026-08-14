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
