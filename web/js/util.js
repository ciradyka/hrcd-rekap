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

/** Cincin berputar di TENGAH layar, menggantikan tulisan "Memuat…".
 *
 *  Tampil SEKETIKA, tanpa jeda. Versi sebelumnya menahannya 180 ms supaya
 *  muat yang cepat tidak berkedip; akibatnya layar terlihat kosong dulu
 *  sebelum apa pun terjadi, dan diam itu justru terbaca sebagai macet.
 *  Kedipan sesekali ternyata harga yang lebih murah daripada keraguan
 *  "ini jalan atau tidak" pada tiap perpindahan layar.
 *
 *  Letaknya di tengah, bukan menempel di bawah header — mata mencari
 *  penanda muat di tempat isi halaman akan muncul, bukan di baris pertama.
 *  Tingginya diatur `.pemuat` di style.css.
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

/** WAKTU LOMBA, SATU KOTAK. Menerima apa pun yang tertera di stopwatch:
 *
 *    "32"    -> 32 detik        "0:32"  -> 32 detik
 *    "1:10"  -> 70 detik        "95"    -> 95 detik
 *
 *  Aturannya satu kalimat: ada titik dua berarti menit:detik, tanpa titik dua
 *  berarti detik. Tidak ada tebakan di antaranya — "120" selalu 120 detik,
 *  tidak pernah 1 menit 20.
 *
 *  Dulu ini dua kotak, Menit dan Detik terpisah. Yang membunuhnya bukan selera
 *  melainkan hitungan: tangga poin Pos 2 habis di 40 detik, jadi kotak menit
 *  berisi 0 di hampir setiap baris — 46 regu x 3 lomba = 138 ketukan hanya
 *  untuk mengetik nol, di layar yang sudah harus digeser ke samping.
 *
 *  null = bukan waktu yang sah. Teks kosong juga null, dan itu BUKAN nol:
 *  kotak kosong berarti belum dinilai (lihat bacaSel di app.js).
 *
 *  Menit tidak dibatasi — lomba yang molor sampai 90 menit tetap tercatat apa
 *  adanya. Detik dibatasi 0-59: "1:75" adalah salah ketik, bukan 135 detik,
 *  dan menerimanya diam-diam berarti mencatat waktu yang tidak pernah ada. */
export function detikSah(teks) {
  const t = String(teks ?? "").trim().replace(/[.\s]/g, ":");
  if (t === "") return null;
  if (!/^\d+(:\d{1,2})?$/.test(t)) return null;

  const [a, b] = t.split(":");
  if (b === undefined) return Number(a);
  const d = Number(b);
  if (d > 59) return null;
  return Number(a) * 60 + d;
}

/** Kebalikan detikSah: bentuk yang akan diketik petugas untuk waktu ini.
 *  Di bawah semenit ditulis polos ("32"), semenit ke atas pakai titik dua
 *  ("1:10") — supaya angka yang tergambar ulang ke kotak persis angka yang
 *  tadi diketik, dan menyimpan ulang baris tidak pernah mengubah apa pun. */
export function detikTeks(total) {
  if (total === null || total === undefined || total === "") return "";
  const d = Math.round(Number(total));
  if (!Number.isFinite(d)) return "";
  return d < 60 ? String(d) : `${Math.floor(d / 60)}:${dua(d % 60)}`;
}

/** Kotak jam 24 orang-ketik. Dipasang di setiap `<input>` yang menerima jam:
 *  membetulkan bentuknya saat kotak ditinggalkan, dan menandainya merah kalau
 *  isinya bukan jam. Membetulkan saat blur, BUKAN saat tiap ketukan — menata
 *  ulang teks di tengah orang mengetik memindahkan kursornya dan membuat
 *  angka berikutnya mendarat di tempat yang salah. */
/** DUA KOTAK JAM: [HH] : [MM], tapi mengetik "1503" beruntun tetap jalan.
 *
 *  Dua kotak supaya bagian menit bisa diklik dan diperbaiki sendiri tanpa
 *  mengetik ulang jamnya. Satu kotak tidak bisa memberi itu: mengklik di tengah
 *  lalu mengetik membuat kursor melompat ke ujung.
 *
 *  Yang tidak boleh hilang karena pemisahan itu adalah mengetik beruntun.
 *  Petugas keberangkatan mengetik empat angka tanpa melihat layar, dan memaksa
 *  mereka berpindah kotak di tengah akan lebih lambat daripada sebelumnya. Jadi
 *  HH MELUAP sendiri ke MM begitu ia penuh.
 *
 *  KAPAN HH DIANGGAP PENUH — dan di sinilah satu aturan menyelamatkan bentuk
 *  ketikan yang paling sering:
 *
 *    dua angka           -> penuh. "15" lalu lompat.
 *    satu angka 3-9      -> penuh JUGA, dan dijadikan "07".
 *
 *  Jam tertinggi 23, jadi angka pertama 3-9 mustahil menjadi awal jam dua
 *  angka: kalau yang diketik 7, satu-satunya bacaan yang mungkin adalah 07.
 *  Karena itu "745" jadi 07:45 — bentuk yang paling sering diketik untuk jam
 *  pagi, dan lomba ini berangkat pukul tujuh.
 *
 *  Yang dikorbankan: "250" tidak lagi terbaca 2:50, karena angka pertama 2
 *  memang bisa menjadi awal jam 20-23. Jam dua pagi tidak pernah terjadi di
 *  lomba yang berangkat pukul 07.00 dan selesai sore.
 */

/** Markup sepasang kotak jam. `id` jadi patokan: `<id>-hh` dan `<id>-mm`. */
export function kotakJamHtml(id, nilai = "") {
  const [hh = "", mm = ""] = String(nilai || "").split(":");
  return `<span class="jam-pasang" id="${id}">
    <input type="text" class="jam-ketik jam-hh" id="${id}-hh" value="${hh}"
           inputmode="numeric" maxlength="2" autocomplete="off"
           spellcheck="false" placeholder="HH" aria-label="Jam">
    <span class="jam-titik" aria-hidden="true">:</span>
    <input type="text" class="jam-ketik jam-mm" id="${id}-mm" value="${mm}"
           inputmode="numeric" maxlength="2" autocomplete="off"
           spellcheck="false" placeholder="MM" aria-label="Menit">
  </span>`;
}

/** Menyalakan sepasang kotak jam dan mengembalikan kendalinya.
 *
 *  Sengaja BUKAN objek yang menyamar jadi <input>. Layar memanggil nilai() dan
 *  setNilai() dengan nama itu, jadi terbaca bahwa yang dipegang adalah sepasang
 *  kotak — bukan satu kotak yang kebetulan punya titik dua. */
export function pasangKotakJam(id) {
  const wadah = document.getElementById(id);
  if (!wadah) return null;
  const hh = document.getElementById(`${id}-hh`);
  const mm = document.getElementById(`${id}-mm`);
  const pendengar = [];

  const gabung = () => `${hh.value.trim()}${mm.value.trim()}`;
  const nilai = () => jamSah(gabung());

  /* ISI DIPILIH SAAT KOTAKNYA DIKETUK, dan tanpa ini kotak yang sudah terisi
     tidak bisa diperbaiki.

     Kotak HH berisi "10". Petugas mengetuknya untuk mengubah jam, menekan 1,
     dan yang terjadi bukan "1" melainkan "110" — angka baru DISISIPKAN di
     sebelah yang lama. Tiga angka lalu terbaca sebagai ketikan beruntun, jadi
     luapannya menendang satu angka ke kotak menit. Petugas menekan satu tombol
     dan kursornya sudah pindah kotak.

     Memilih seluruh isi saat fokus membuat ketukan pertama MENGGANTI, bukan
     menyisipkan — perilaku yang sama dengan kotak jam di aplikasi mana pun.
     Mengetuk kedua kali tetap menaruh kursor seperti biasa, jadi menyunting
     satu angka masih mungkin bagi yang menginginkannya.

     Lewat setTimeout karena Safari iOS membatalkan select() yang dipanggil di
     dalam penanganan focus itu sendiri — dan HP iOS adalah yang dipegang
     petugas di garis start. */
  const pilihIsi = (el) => setTimeout(() => {
    if (document.activeElement === el) { try { el.select(); } catch { /* abaikan */ } }
  }, 0);
  hh.addEventListener("focus", () => pilihIsi(hh));
  mm.addEventListener("focus", () => pilihIsi(mm));

  /* LAPIS KEDUA: kotak yang sudah PENUH, angka berikutnya memulai dari awal.
     Berlaku di mana pun kursornya berada.

     Memilih isi saat fokus (di atas) sudah menyelesaikan kasus yang dilaporkan,
     tapi ia bergantung pada browser menghormati select() — dan Safari iOS
     punya beberapa keadaan di mana ia tidak. Aturan ini tidak bergantung pada
     apa pun: kalau kotak sudah memuat dua angka dan yang diketik satu angka
     lagi, isinya DIGANTI, bukan disisipi. Kursor di awal, di tengah, atau di
     ujung tidak mengubah hasilnya.

     Ketikan beruntun tidak terganggu. Mengetik 1503 dari kosong tidak pernah
     memasukkan angka ketiga ke kotak jam — begitu dua angka penuh, fokusnya
     sudah pindah ke menit. Satu-satunya cara kotak penuh menerima ketikan lagi
     adalah petugas sengaja kembali ke sana, dan saat itu maksudnya mengganti.

     MENEMPEL dikecualikan: menempel "1503" memang harus meluap ke menit, dan
     itu jalur yang dipakai saat layar mengisi kotak dari data. */
  const menimpaBilaPenuh = (el) => el.addEventListener("beforeinput", (e) => {
    if (e.inputType !== "insertText" || !/^\d$/.test(e.data || "")) return;
    const penuh = el.value.replace(/\D/g, "").length >= 2;
    const semuaTerpilih = el.selectionStart === 0
                       && el.selectionEnd === el.value.length;
    if (!penuh || semuaTerpilih) return;
    e.preventDefault();
    el.value = e.data;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  menimpaBilaPenuh(hh);
  menimpaBilaPenuh(mm);

  const tandai = () => {
    const kosong = !hh.value.trim() && !mm.value.trim();
    const buruk = !kosong && !nilai();
    // Merah dipasang di WADAH, bukan di salah satu kotak: yang salah adalah
    // jamnya sebagai satu kesatuan, dan menyalahkan kotak menit untuk jam 25
    // menyuruh petugas membetulkan tempat yang benar.
    wadah.classList.toggle("jam-salah", buruk);
    return !buruk;
  };

  const beri = (fn) => { pendengar.forEach(fn); };

  hh.addEventListener("input", () => {
    const angka = hh.value.replace(/\D/g, "");
    // Ketikan beruntun / tempel: sisanya dijatuhkan ke menit, bukan dibuang.
    if (angka.length > 2) {
      hh.value = angka.slice(0, 2);
      mm.value = angka.slice(2, 4);
      mm.focus(); mm.setSelectionRange(mm.value.length, mm.value.length);
    } else if (angka.length === 2) {
      hh.value = angka; mm.focus(); mm.select();
    } else if (angka.length === 1 && Number(angka) > 2) {
      hh.value = `0${angka}`; mm.focus(); mm.select();
    } else {
      hh.value = angka;
    }
    tandai(); beri(f => f());
  });

  mm.addEventListener("input", () => {
    mm.value = mm.value.replace(/\D/g, "").slice(0, 2);
    tandai(); beri(f => f());
  });

  // Backspace di menit yang sudah kosong melompat balik ke jam. Tanpa itu
  // petugas harus mengangkat tangan dari papan angka untuk mengetuk kotak
  // sebelahnya — satu-satunya gerakan yang tidak bisa dilakukan sambil menatap
  // regu di depan meja.
  mm.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" && mm.value === "") {
      hh.focus(); hh.setSelectionRange(hh.value.length, hh.value.length);
    }
  });

  // Dirapikan saat SEPASANG kotak ini ditinggalkan, bukan saat pindah antar
  // keduanya: "7" di jam belum tentu salah, ia mungkin sedang menuju "07".
  const rapikan = () => {
    setTimeout(() => {
      if (document.activeElement === hh || document.activeElement === mm) return;
      const v = nilai();
      if (v) { [hh.value, mm.value] = v.split(":"); }
      tandai();
    }, 0);
  };
  hh.addEventListener("blur", rapikan);
  mm.addEventListener("blur", rapikan);

  return {
    nilai,
    setNilai(v) {
      const [a = "", b = ""] = String(v || "").split(":");
      hh.value = a; mm.value = b; tandai();
    },
    kosong: () => !hh.value.trim() && !mm.value.trim(),
    salah(ya) { wadah.classList.toggle("jam-salah", !!ya); },
    fokus() { hh.focus(); hh.select(); },
    dengar(fn) { pendengar.push(fn); },
    // Peristiwa DOM dipasang ke KEDUA kotak. Enter di kotak menit harus
    // menyimpan sama seperti Enter di kotak jam — petugas tidak boleh perlu
    // tahu kotak mana yang sedang aktif.
    pada(nama, fn) { hh.addEventListener(nama, fn); mm.addEventListener(nama, fn); },
  };
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
/** Dialog. `bacaSaja: true` membuang tombol Batal.
 *
 *  "Batal" pada dialog yang tidak mengubah apa pun bukan sekadar mubazir: ia
 *  menyiratkan ada sesuatu yang sedang berjalan dan bisa diurungkan. Orang yang
 *  membuka riwayat lalu melihat Batal akan berhenti sejenak memikirkan apa yang
 *  ia batalkan.
 *
 *  Penandanya EKSPLISIT, bukan diterka dari `medan` yang kosong. Lima dari enam
 *  pemanggil dialog di sistem ini tidak punya medan sama sekali — mereka
 *  konfirmasi ya/tidak yang justru paling membutuhkan tombol Batal. Menerka
 *  akan mencabutnya dari kelimanya sekaligus, dan yang tersisa cuma tombol
 *  "Ya". */
export function dialog({ judul, kartuHtml = "", medan = [], labelAksi = "Simpan",
                         bacaSaja = false }) {
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
          ${bacaSaja ? "" : `<button class="button button-secondary" data-batal
            type="button">Batal</button>`}
          <button class="button button-primary" data-ok type="button">${esc(labelAksi)}</button>
        </div>
      </div>`;

    const tutup = hasil => { el.remove(); resolve(hasil); };
    el.querySelector("[data-batal]")?.addEventListener("click", () => tutup(null));
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
