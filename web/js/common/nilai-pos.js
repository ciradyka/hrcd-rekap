/* ============================================================================
   hrcd-rekap : common/nilai-pos.js — alat bersama layar penilaian pos.

   Dipakai Input Nilai Tabel, Input Nilai Per Lomba, dan Cek Nilai: sel isian
   per komponen dan cara membacanya, katalog pos, kartu regu, serta ANTREAN
   NILAI — nilai yang sudah diketik tetapi belum sampai ke server, disimpan di
   localStorage dan dikirim ulang sampai diterima.
   ========================================================================== */

import { daftarPos, ErrorApi, hapusNilaiPos, komponenSemua, sesi,
         simpanNilaiPos } from "../api.js";
import { dada3, detikSah, dialog, esc, GOLONGAN_LABEL, h, html, ikon,
         jamMenit, meterSah, nilaiBagian, nilaiTeks, notif,
         periksaJawabSimpan, varianUntuk } from "../util.js";
import { EDISI } from "./frame.js";

export const judulPos = (p) => p
  ? (p.bayangan ? `Pos Bayangan — ${p.name}` : `Pos ${p.nomor} — ${p.name}`)
  : "Pos";

/** Kotak isian satu komponen. BENTUKNYA DITENTUKAN KONFIGURASI, bukan ditulis
 *  per pos di sini — itu sebabnya tabel ini bisa mengikuti lembar mana pun
 *  tanpa menyentuh JavaScript:
 *
 *    form=biner        -> satu centang        (kolom "Kompas (v)")
 *    satuan=detik      -> SATU kotak waktu     ("47" atau "1:10" — lihat
 *                         detikSah di util.js; dulu dua kotak Menit dan
 *                         Detik, dan alasan menyatukannya ada di sana)
 *    satuan=meter      -> satu kotak meter     ("8.55", disimpan sentimeter)
 *    benar_kurang_salah-> Benar / Salah
 *    sisanya           -> satu kotak angka, batasnya dari rentang wajar
 */
export function selKomponen(k, nilai) {
  const n1 = nilai ? nilai.nilai_1 : null;
  const n2 = nilai ? nilai.nilai_2 : null;
  const kode = esc(k.kode);

  /* KOTAK KOSONG YANG MENYEBUT DIRINYA KOSONG — tapi hanya di tempat yang
     membutuhkannya.

     Di hampir semua lomba, kosong dan 0 berujung sama: nol kata benar dan
     belum dinilai sama-sama menyumbang 0 poin, jadi menandai kotak kosong
     tidak menjawab pertanyaan siapa pun — ia cuma menambah 38 garis kecil di
     tabel yang sudah penuh.

     Menaksir kebalikannya. Yang ditulis SELISIH, jadi 0 berarti taksirannya
     tepat dan bernilai 100 — nilai tertinggi — sementara kotak kosong berarti
     tidak dinilai dan bernilai 0. Di sanalah satu garis kecil sepadan.

     Penandanya ikut `petunjuk`, bukan daftar kode di dalam kode ini. Komponen
     yang sampai butuh keterangan sendiri adalah persis komponen yang kotak
     kosongnya perlu bicara — dan kalau tahun depan ada lomba lain yang diberi
     `petunjuk`, ia mendapat garis itu juga. Itu perilaku yang dimaksud, bukan
     kejutan. */
  const kosongTampak = k.petunjuk ? ` placeholder="–"` : "";

  if (k.form === "biner") {
    return `<input type="checkbox" class="checkbox" data-kode="${kode}"
                   ${Number(n1) > 0 ? "checked" : ""}
                   aria-label="${esc(k.name)}">`;
  }
  if (k.satuan === "detik") {
    // SATU kotak, dan bertipe text — bukan number — karena isinya boleh
    // memuat titik dua. inputmode="numeric" tetap memanggil papan angka di HP,
    // jadi yang hilang cuma tombol panah naik-turun yang memang tidak pernah
    // dipakai untuk mencatat waktu.
    return `<input type="text" class="small-input input-waktu" inputmode="numeric"
                   data-kode="${kode}" value="${esc(nilaiTeks(k, n1))}"${kosongTampak}
                   aria-label="${esc(k.name)} — detik, atau menit:detik">`;
  }
  if (k.satuan === "meter") {
    // Bertipe text, bukan number, karena isinya boleh memuat KOMA — peserta
    // menulis "8,55" di blangko dan petugas mengetik apa yang ia baca.
    // input[type=number] menolak koma diam-diam: kotaknya jadi kosong tanpa
    // sepatah kata, dan yang mengetiknya mengira angkanya sudah masuk.
    return `<input type="text" class="small-input input-meter" inputmode="decimal"
                   data-kode="${kode}" value="${esc(nilaiTeks(k, n1))}"${kosongTampak}
                   aria-label="${esc(k.name)} — meter, dua angka di belakang koma">`;
  }
  if (k.form === "benar_kurang_salah") {
    return `<span class="pos-pasangan">
      <input type="number" class="small-input" inputmode="numeric" step="1" min="0"
             data-kode="${kode}" data-slot="benar" value="${esc(nilaiTeks(k, n1))}"
             aria-label="${esc(k.name)} — jumlah benar">
      <span class="pos-pemisah" aria-hidden="true">/</span>
      <input type="number" class="small-input" inputmode="numeric" step="1" min="0"
             data-kode="${kode}" data-slot="salah" value="${esc(nilaiTeks(k, n2))}"
             aria-label="${esc(k.name)} — jumlah salah">
    </span>`;
  }
  // Sengaja placeholder, bukan nilai tersimpan. Menyimpan keadaan ketiga
  // bernama "–" akan memaksa setiap tempat yang membaca angka ini menebak
  // maksudnya, padahal database hanya punya dua: ada barisnya, atau tidak.
  // step="1" + inputmode="numeric", BUKAN step="any" + inputmode="decimal".
  // Nilai mentah tidak pernah pecahan (migrasi 0059), dan kotak yang
  // memanggil papan angka bertitik desimal adalah undangan mengetik koma.
  // Ini cuma membuatnya sulit — yang benar-benar menolak adalah constraint
  // nilai_mentah_bulat, karena import massal dan tempel dari spreadsheet
  // tidak lewat kotak ini sama sekali.
  return `<input type="number" class="small-input" inputmode="numeric" step="1"
                 min="${esc(k.rentang_mentah_min)}" max="${esc(k.rentang_mentah_maks)}"
                 data-kode="${kode}" value="${esc(nilaiTeks(k, n1))}"${kosongTampak}
                 aria-label="${esc(k.name)}">`;
}

/** Keterangan kecil di bawah judul kolom — rentang yang boleh diketik,
 *  diambil dari konfigurasi supaya tidak pernah berbeda dengan yang divalidasi
 *  server. Persis angka yang tercetak di judul kolom lembar kertas. */
/** Isi kotak yang tidak bisa dibaca sebagai angka/waktu. Sengaja BUKAN null:
 *  null berarti "kotak kosong", dan jalur simpan menerjemahkan itu jadi
 *  perintah MENGHAPUS nilai yang sudah tersimpan. */
export const TIDAK_SAH = Symbol("tidak sah");

/** Membaca satu komponen dari barisnya. null = kotaknya kosong, artinya
 *  komponen ini BELUM dinilai — bukan "dinilai nol".
 *
 *  Centang adalah pengecualian, dan sengaja: sebuah kotak centang tidak punya
 *  keadaan kosong, hanya dicentang atau tidak. Jadi aturannya "menyimpan satu
 *  baris berarti mengesahkan seluruh isinya" — centang yang dibiarkan kosong
 *  di baris yang disimpan berarti benar-benar tidak kena, dan tersimpan
 *  sebagai 0. Baris yang tidak disentuh tidak pernah dikirim sama sekali,
 *  jadi tidak ada regu yang mendadak "dinilai nol" karena tetangganya diisi. */
export function bacaSel(tr, k) {
  const kotak = tr.querySelectorAll(`[data-kode="${CSS.escape(k.kode)}"]`);
  if (k.form === "biner") return { nilai_1: kotak[0].checked ? 1 : 0, nilai_2: null };

  if (k.satuan === "detik") {
    // TIGA keadaan, bukan dua. Kotak kosong dan kotak berisi "1:75" tidak
    // boleh diperlakukan sama, dan dulu keduanya sama-sama mengembalikan null.
    //
    // Akibatnya senyap dan merusak: jalur simpan membaca null sebagai "kotak
    // dikosongkan", jadi nilai yang SUDAH tersimpan di database ikut DIHAPUS —
    // lalu barisnya tetap mendapat centang hijau. Petugas salah ketik satu
    // huruf dan kehilangan angka yang sudah benar, tanpa satu pun tanda.
    if (!kotak[0].value.trim()) return null;
    const detik = detikSah(kotak[0].value);
    return detik === null ? TIDAK_SAH : { nilai_1: detik, nilai_2: null };
  }
  if (k.satuan === "meter") {
    // TIGA keadaan, sama seperti detik: kosong berarti "hapus nilainya",
    // tidak terbaca berarti "jangan kirim apa pun". Menyamakan keduanya
    // membuat salah ketik satu huruf MENGHAPUS angka yang sudah benar,
    // lalu barisnya tetap mendapat centang hijau.
    if (!kotak[0].value.trim()) return null;
    const cm = meterSah(kotak[0].value);
    return cm === null ? TIDAK_SAH : { nilai_1: cm, nilai_2: null };
  }
  // KOTAK ANGKA BAWAAN BROWSER PUNYA KEADAAN KETIGA JUGA, dan ia tidak
  // kelihatan. `input[type=number]` yang berisi ketikan yang tidak bisa ia
  // urai — "2 5", "25e", koma di sebagian locale — melaporkan `value` KOSONG
  // sambil tetap MENAMPILKAN teksnya. Tanpa memeriksa `validity.badInput`,
  // baris di bawah membacanya sebagai "kotak dikosongkan", dan jalur simpan
  // menerjemahkan itu jadi perintah menghapus nilai yang sudah tersimpan —
  // lalu barisnya tetap mendapat centang hijau selama komponen lain terisi.
  // Persis kegagalan yang sudah dijaga di kotak detik dan meter di atas; yang
  // ini ketinggalan karena kotaknya bertipe number, bukan text.
  const takTerbaca = (el) => !!(el && el.validity && el.validity.badInput);

  if (k.form === "benar_kurang_salah") {
    // Kotak SALAH ikut dijaga: kalau ia tidak terbaca, mengirim nilai_2 null
    // berarti mencatat "tidak ada yang salah" — angka yang berbeda dari yang
    // diketik, bukan angka yang hilang.
    if (takTerbaca(kotak[0]) || takTerbaca(kotak[1])) return TIDAK_SAH;
    const b = kotak[0].value.trim(), sa = kotak[1].value.trim();
    if (b === "") return null;
    return { nilai_1: Number(b), nilai_2: sa === "" ? null : Number(sa) };
  }
  if (takTerbaca(kotak[0])) return TIDAK_SAH;
  const v = kotak[0].value.trim();
  return v === "" ? null : { nilai_1: Number(v), nilai_2: null };
}

/** Judul besar di atas kotak isian: APA yang harus ditulis di sana.
 *
 *  Konfigurasi menang. Empat dari lima bentuk penilaian bisa diterjemahkan
 *  sendiri, karena bentuknya menentukan artinya — `satuan = detik` selalu
 *  berarti waktu, `besar_baik` selalu berarti jumlah benar.
 *
 *  `bertingkat` tidak bisa. Ia cuma tangga angka, dan angkanya bisa detik,
 *  meter, selisih, atau apa pun yang panitia putuskan tahun itu. Menebaknya
 *  pernah menghasilkan "Hasil ukur" untuk Menaksir — kata yang membaca seperti
 *  perintah menulis jarak TERUKUR, padahal yang diminta SELISIH-nya. Kalau
 *  petugas menulis 12 alih-alih 2, tangga Menaksir habis di atas 4 meter dan
 *  hampir setiap regu mendapat 0, tanpa satu galat pun.
 *
 *  Jadi bentuk itu membawa judulnya sendiri lewat `judul_isian` (0039), dan
 *  cadangannya sengaja tidak menjanjikan apa-apa. */
export function judulIsian(k) {
  if (k.judul_isian) return k.judul_isian;
  // "Waktu", bukan "Waktu tempuh". Kotaknya sudah berdiri di layar lomba
  // waktu, di bawah stopwatch, dengan keterangan "menit:detik" — tidak ada
  // waktu lain yang mungkin dimaksud, jadi "tempuh" cuma satu kata lagi yang
  // dilewati mata sebelum sampai ke angkanya (bagian 9.3).
  if (k.satuan === "detik") return "Waktu";
  if (k.satuan === "meter") return "Hasil taksir";
  if (k.form === "biner") return "Kena / tidak";
  if (k.form === "benar_kurang_salah") return "Benar dan salah";
  if (k.form === "bertingkat") return "Data mentah";
  return "Jumlah benar";
}

/* ================== ANTREAN NILAI YANG BELUM TERKIRIM =====================

   MASALAH YANG DIPECAHKAN. Di pos, sinyal putus adalah keadaan biasa. Layar
   Input Nilai Pos v2 mengosongkan dirinya setiap selesai satu regu, jadi
   angka yang gagal terkirim tidak punya tempat tinggal di layar sama sekali —
   petugas sudah pindah ke regu berikutnya, dan yang tersisa cuma satu
   notifikasi merah yang hilang sendiri. Angka itu hilang tanpa jejak.

   DI MANA ANTREANNYA TINGGAL: `localStorage` di HP petugas. Bukan di memori
   halaman seperti lembar pos lama — di sana layarnya tidak pernah dikosongkan,
   jadi barisnya sendiri yang jadi antrean. Di sini halamannya bisa dibuang
   browser karena memori penuh, HP-nya bisa terkunci, tab-nya bisa tertutup;
   ketiganya keadaan biasa di lapangan, dan ketiganya menghapus memori halaman.

   APA YANG DIJANJIKAN, DAN APA YANG TIDAK. Yang dijanjikan: "terkirim begitu
   halaman ini terbuka dan ada sinyal". BUKAN "pasti terkirim nanti" — dan
   perbedaan itu bukan kehati-hatian berlebihan:

     tab terbuka & terlihat   putaran 15 detik jalan
     internet kembali         `online` menyala, dikirim seketika
     tab di latar / terkunci  timer dicekik jadi ~sekali semenit lalu DIBEKUKAN
     tab dibuang browser      tidak ada JS yang hidup sama sekali
     dibuka lagi              antrean dibaca dari localStorage lalu dikirim

   Tidak ada cara membuatnya benar-benar berjalan di latar belakang di sini:
   situs ini aset statis tanpa service worker, dan Background Sync tidak ada
   di Safari iOS — jadi menambahkan service worker pun tidak menutup lubangnya
   untuk sebagian HP. Karena itu pitanya harus MENGGANGGU, bukan sopan: ia
   satu-satunya yang memberi tahu petugas bahwa halaman ini masih harus
   dibiarkan terbuka.

   DUA KEADAAN, DAN INI YANG PALING MUDAH SALAH. Gagal jaringan boleh dicoba
   ulang selamanya. Ditolak server TIDAK: `simpan_nilai_massal` menolak karena
   nilainya di luar rentang, regunya tergembok, atau komponennya bukan untuk
   golongan itu — tidak satu pun sembuh dengan menunggu. Mencoba ulang yang
   ditolak berarti satu baris rusak menyumbat seluruh antrean di belakangnya,
   selamanya, tanpa satu pun tanda. Jadi yang ditolak dikeluarkan dari putaran
   dan ditampilkan sampai ada orang yang mengurusnya.
   ========================================================================= */

export const KUNCI_ANTREAN = "hrcd_antrean_nilai";

/** Isi antrean di memori. localStorage yang jadi salinan tahan-matinya. */
export let antreanNilai = (() => {
  try {
    const isi = JSON.parse(localStorage.getItem(KUNCI_ANTREAN) || "[]");
    return Array.isArray(isi) ? isi : [];
  } catch { return []; }
})();

export let jamAntreanSinkron = null;

export let sedangKirimAntrean = false;

/** Menulis ke localStorage TIDAK BOLEH menjatuhkan apa pun.
 *
 *  Ia melempar saat kuota penuh dan di mode penyamaran sebagian browser. Kalau
 *  itu terjadi, antreannya tetap hidup di memori halaman — persis sebaik
 *  lembar pos lama, tidak lebih buruk — dan pitanya tetap menyuruh halaman ini
 *  dibiarkan terbuka. Yang tidak boleh terjadi: satu galat penyimpanan
 *  membatalkan simpanan yang sebenarnya sudah aman. */
export function tulisAntrean() {
  try { localStorage.setItem(KUNCI_ANTREAN, JSON.stringify(antreanNilai)); }
  catch { /* antreannya tetap di memori; pitanya tetap memberi tahu */ }
}

export const antreanTertunda = () => antreanNilai.filter(p => !p.ditolak);

export const antreanDitolak = () => antreanNilai.filter(p => p.ditolak);

export function antreanTambah(pekerjaan) {
  antreanNilai.push(pekerjaan);
  tulisAntrean();
  gambarPitaAntrean();
}

/** Satu putaran kirim. Berhenti pada kegagalan PERTAMA yang bisa diulang —
 *  kalau jaringannya mati, mencoba sisanya cuma memperpanjang penantian tanpa
 *  satu pun peluang berhasil. */
export async function kirimAntrean() {
  if (sedangKirimAntrean || !sesi() || !navigator.onLine) return;
  if (!antreanTertunda().length) return;
  sedangKirimAntrean = true;
  let adaYangBerhasil = false;

  try {
    for (const p of antreanTertunda()) {
      try {
        if (p.baris && p.baris.length) {
          // Aturannya di util.js, diuji mesin — lihat periksaJawabSimpan().
          const periksa = periksaJawabSimpan(p.baris.length,
            await simpanNilaiPos(p.baris, p.pos));
          if (!periksa.ok) {
            const e = new ErrorApi(periksa.alasan);
            e.dariServer = periksa.dariServer;
            throw e;
          }
          // Nilainya sudah mendarat. Dikosongkan supaya percobaan berikutnya
          // tidak mengirimkannya lagi kalau penghapusan di bawah yang gagal.
          p.baris = [];
          tulisAntrean();
        }
        while (p.hapus && p.hapus.length) {
          await hapusNilaiPos(p.dada, p.hapus[0], p.pos);
          p.hapus.shift();
          tulisAntrean();
        }
        antreanNilai = antreanNilai.filter(x => x !== p);
        jamAntreanSinkron = new Date();
        adaYangBerhasil = true;
        tulisAntrean();
      } catch (err) {
        if (err && err.dariServer) {
          // Ditolak server: menunggu tidak akan mengubah jawabannya.
          p.ditolak = err.message;
          tulisAntrean();
          continue;
        }
        break;   // gagal jaringan: sisanya pun akan gagal sekarang
      }
    }
  } finally {
    sedangKirimAntrean = false;
    gambarPitaAntrean();
  }

  if (adaYangBerhasil && !antreanTertunda().length) {
    notif("Nilai yang tertunda sudah terkirim.");
  }
}

/** Pita antrean, digambar ke `#pita-antrean` kalau layarnya menyediakannya.
 *
 *  DI DALAM ALIRAN HALAMAN, bukan melayang. Bilah melayang harus berebut
 *  tempat dengan menu bawah HP, dengan notifikasi, dan dengan papan ketik yang
 *  naik — tiga hal yang sudah punya aturannya sendiri di berkas ini. Pita ini
 *  duduk di atas kartu kerjanya, tempat mata petugas memang sudah lewat. */
export function gambarPitaAntrean() {
  const el = document.getElementById("pita-antrean");
  if (!el) return;
  const tunda = antreanTertunda();
  const tolak = antreanDitolak();
  if (!tunda.length && !tolak.length) { el.replaceChildren(); return; }

  const nomor = (daftar) => daftar.map(p => dada3(p.dada)).join(", ");
  const cap = jamAntreanSinkron
    ? ` Terakhir terkirim ${jamMenit(jamAntreanSinkron)}.` : "";

  el.replaceChildren(h(`
    ${tunda.length ? `
    <div class="pita-antrean pita-tunda">
      <div>
        <strong>${esc(String(tunda.length))} nilai belum terkirim</strong>
        — jangan tutup halaman ini.${esc(cap)}
        <div class="pita-nomor">${esc(nomor(tunda))}</div>
      </div>
      <button type="button" class="button button-secondary button-small"
              id="antrean-kirim">Kirim sekarang</button>
    </div>` : ""}
    ${tolak.length ? `
    <div class="pita-antrean pita-tolak">
      <div>
        <strong>${esc(String(tolak.length))} nilai ditolak server</strong>
        — tidak akan terkirim sendiri.
        <div class="pita-nomor">${tolak.map(p =>
          `${esc(dada3(p.dada))}: ${esc(p.ditolak)}`).join("<br>")}</div>
      </div>
      <button type="button" class="button button-danger button-small"
              id="antrean-buang">Buang</button>
    </div>` : ""}`));

  el.querySelector("#antrean-kirim")?.addEventListener("click", () => kirimAntrean());
  el.querySelector("#antrean-buang")?.addEventListener("click", async () => {
    /* Membuang berarti angka itu TIDAK PERNAH tercatat di mana pun. Sesudah
       ini tidak ada satu pun jejaknya — bukan di database, bukan di HP ini.
       Karena itu ditanya dulu, dengan angkanya disebutkan. */
    const jawab = await dialog({
      judul: `Buang ${antreanDitolak().length} nilai yang ditolak?`,
      kartuHtml: `<p>Angkanya hilang sama sekali. Yang masih dibutuhkan harus
        diketik ulang di layar ini.</p>`,
      labelAksi: "Buang",
    });
    if (jawab === null) return;
    antreanNilai = antreanTertunda();
    tulisAntrean();
    gambarPitaAntrean();
    notif("Nilai yang ditolak dibuang.");
  });
}

/** SATU PINTU MENYIMPAN NILAI SATU REGU, dipakai layar input DAN Cek Nilai.
 *
 *  Kenapa satu dan bukan dua: aturannya bukan "kirim kotak-kotak ini". Ia
 *  memuat empat keputusan yang semuanya mahal kalau berbeda antar layar —
 *  kotak yang tidak terbaca tidak boleh menyentuh angka lama, kotak yang
 *  dikosongkan berarti HAPUS dan bukan nol, angka yang sama persis tidak
 *  dikirim ulang supaya kepengarangan tidak bergeser, dan gagal jaringan
 *  masuk antrean sementara ditolak server tidak. Menyalinnya ke layar kedua
 *  berarti empat keputusan itu boleh menyimpang diam-diam.
 *
 *  `labelUntuk` dipisah karena hanya itu yang memang berbeda: layar input
 *  menuliskan "Jumlah benar 3" di riwayatnya, Cek Nilai tidak memakainya.
 *
 *  Mengembalikan KEADAAN, bukan melempar dan bukan pula memasang notifikasi
 *  sendiri. Kalimat yang pantas berbeda di tiap layar, dan fungsi yang
 *  menuliskannya sendiri memaksa keduanya berbunyi sama. */
export async function kirimNilaiRegu({ pos, kolom, regu, wadah, labelUntuk }) {
  const lama = regu.nilai || {};
  const dada = Number(regu.nomor_dada);
  const baris = [], dihapus = [], takTerbaca = [], ringkasan = [];

  for (const kol of kolom) {
    const k = varianUntuk(kol, regu.golongan);
    if (!k) continue;
    const baru = bacaSel(wadah, k);
    // Kotak berisi sesuatu yang tidak terbaca: JANGAN disentuh sama sekali.
    // Bukan dikirim, dan bukan pula dianggap kosong — angka lamanya tetap di
    // tempatnya sampai petugas membetulkan ketikannya.
    if (baru === TIDAK_SAH) { takTerbaca.push(kol.nama); continue; }
    if (baru !== null && labelUntuk) {
      ringkasan.push(`${labelUntuk(kol, k)} `
        + nilaiBagian(k, baru.nilai_1, baru.nilai_2).join(" / "));
    }
    const ada = lama[k.kode] || null;
    // Kotak dikosongkan padahal sebelumnya ada isinya = angka itu masuk ke
    // regu yang salah. Dihapus, bukan ditimpa nol.
    if (baru === null) { if (ada) dihapus.push(k.kode); continue; }
    const samaSaja = ada
      && Number(ada.nilai_1) === baru.nilai_1
      && (ada.nilai_2 === null || ada.nilai_2 === undefined
            ? null : Number(ada.nilai_2)) === baru.nilai_2;
    if (!samaSaja) {
      baris.push({ nomor_dada: dada, kode: k.kode,
                   nilai_1: baru.nilai_1, nilai_2: baru.nilai_2 });
    }
  }

  if (takTerbaca.length) return { hasil: "takTerbaca", nama: takTerbaca };
  if (!baris.length && !dihapus.length) return { hasil: "kosong" };

  try {
    if (baris.length) {
      // Aturannya di util.js, diuji mesin — lihat periksaJawabSimpan().
      const periksa = periksaJawabSimpan(baris.length,
        await simpanNilaiPos(baris, pos));
      if (!periksa.ok) {
        const e = new ErrorApi(periksa.alasan);
        e.dariServer = periksa.dariServer;
        throw e;
      }
    }
    for (const kode of dihapus) await hapusNilaiPos(dada, kode, pos);
  } catch (err) {
    /* DITOLAK SERVER DAN GAGAL JARINGAN DIPERLAKUKAN BERBEDA.

       Ditolak berarti angkanya memang tidak boleh masuk — di luar rentang,
       regunya tergembok, komponennya bukan untuk golongan itu. Mengantrekan
       yang begitu berarti menyimpan sesuatu yang tidak akan pernah diterima,
       dan petugas berhak tahu SEKARANG selagi regunya masih di depannya.

       Gagal jaringan sebaliknya: angkanya sah, cuma jalannya sedang putus. */
    if (err && err.dariServer) return { hasil: "ditolak", pesan: err.message };
    antreanTambah({ pos, dada, baris, hapus: [...dihapus],
                    pada: new Date().toISOString() });
    return { hasil: "antre" };
  }

  /* Cermin nilai di layar disamakan dengan yang barusan mendarat, supaya
     menekan Simpan dua kali tidak mengirim angka yang sama untuk kedua kali —
     yang kedua berbunyi "tidak ada yang berubah" dan tidak menambah baris
     riwayat yang tidak mengubah apa-apa. */
  regu.nilai = { ...lama };
  for (const b of baris) regu.nilai[b.kode] = { nilai_1: b.nilai_1, nilai_2: b.nilai_2 };
  for (const kode of dihapus) delete regu.nilai[kode];

  return { hasil: "tersimpan", ringkasan };
}

/** Katalog pos + komponen, dipegang seumur sesi.
 *
 *  Keduanya KONFIGURASI: diisi admin sebelum acara dan tidak berubah
 *  sepanjang pagi. Menanyakannya lagi setiap kali "Ganti Lomba" ditekan
 *  berarti dua perjalanan jaringan di tempat yang paling sering kehilangan
 *  sinyal — dan yang dibayar dengan itu cuma jawaban yang sama persis. */
export const katalogPos = { edisi: null, pos: null, komponen: null };

export async function muatKatalogPos() {
  if (katalogPos.edisi === EDISI.nomor) return katalogPos;
  const [pos, komponen] = await Promise.all([
    daftarPos(), komponenSemua(EDISI.nomor),
  ]);
  katalogPos.edisi = EDISI.nomor;
  katalogPos.pos = pos;
  katalogPos.komponen = komponen;
  return katalogPos;
}

/** "Pos 2 — Bakiak". Pos bayangan memakai namanya sendiri, sama seperti
 *  judulPos(): nomor pos bayangan tidak berarti apa-apa di lapangan. */
export const judulLomba = (l) =>
  `${l.bayangan ? l.namaPos : `Pos ${l.pos}`} — ${l.nama}`;

/* KOTAK PEMILIH TIDAK BERIKON, dan ketiadaannya disengaja.

   Sempat ada lambang jenis pengisian di depan tiap nama — jam untuk lomba
   waktu, kamera untuk lomba soal, pena untuk sisanya. Niatnya menjawab
   "kotak ini membuka stopwatch atau kamera?" tanpa satu kata pun.

   Yang tidak diperhitungkan: pertanyaan itu tidak pernah ditanya. Juri
   membuka lomba yang ia pegang, dan ia sudah tahu lombanya diisi bagaimana
   sebelum menyentuh layar — ia berdiri di sebelahnya sepagian. Jadi lambangnya
   cuma satu benda lagi di kiri tiap nama yang harus dilewati mata, di petak
   yang isinya memang cuma perlu dibaca namanya (bagian 9.1 dan 9.9).

   Kalau ide ini muncul lagi: ia sudah dicoba dan dibuang atas permintaan
   pemilik acara. */

/** Pos yang boleh dibuka akun ini.
 *
 *  Terkunci = punya kolom `pos`, BUKAN = berperan juri_pos — patokan yang
 *  sama dengan layar Input Pos lama dan layar Foto Jawaban. Koordinator pos
 *  tidak punya pos (bagian 13.2), jadi ia melihat kelimanya. */
export const posUntukAkun = (s, semuaPos) => {
  const terkunci = s && s.pos != null && s.pos !== "";
  return terkunci
    ? semuaPos.filter(p => Number(p.nomor) === Number(s.pos))
    : semuaPos;
};

/** Kartu identitas regu, bentuk yang sama dipakai ketiga layar di bawah.
 *
 *  IDENTITAS SAJA — nomor dada, nama regu, sekolah, golongan. Kartu ini ada
 *  untuk menjawab SATU pertanyaan: "nomor yang barusan saya ketik ini benar
 *  regu yang berdiri di depan saya?" Itu echo-confirm, dan setiap baris lain
 *  di dalamnya harus dilewati mata sebelum sampai ke jawabannya.
 *
 *  Versi pertama ikut menulis "Nilai Kepramukaan: 70 · 5/5 terisi". Keduanya
 *  fakta yang benar dan keduanya tidak dipakai di sini: nilai pos adalah
 *  JUMLAH seluruh lomba pos itu, bukan angka yang sedang diketik, dan hitungan
 *  terisi menjawab pertanyaan lembar pos — "mana yang belum dikerjakan" —
 *  yang tidak pernah ditanya orang yang sedang memegang satu regu di depannya
 *  (bagian 9.6).
 *
 *  Gembok tetap ada, dan itu bukan pengecualian: ia satu-satunya keadaan yang
 *  membuat kotak di bawahnya menolak diisi, jadi ia harus terbaca SEBELUM
 *  petugas mengetik (bagian 9.4).
 *
 *  Sejak 0166 ia menyebut BERAPA lomba, bukan sekadar "dikunci". Gembok kini
 *  per lomba: "dikunci" pada regu yang satu dari lima lombanya tergembok
 *  membaca seperti seluruh nilainya beku, dan petugas berhenti mengetik yang
 *  sebenarnya masih boleh diisi.
 *
 *  `ringkas` MEMBUANG KEDUANYA — barisnya jadi satu, dan penanda gembok
 *  hilang. Dipakai Cek Nilai, dan hanya di sana, karena di layar itu tiap
 *  lomba sudah membawa gemboknya sendiri tepat di sebelah angkanya: penanda
 *  "1 lomba dikunci" di kartu ini mengulang sesuatu yang tergambar dua
 *  sentimeter di bawahnya (bagian 9.3), dan tinggi yang dimakannya diambil
 *  dari foto slip. Layar Input Nilai Pos v2 TIDAK memakainya — di sana satu
 *  lomba terbuka pada satu waktu, jadi "berapa lomba pos ini yang sudah
 *  tergembok" memang tidak terbaca di tempat lain. */
export const kartuReguNilai = (r, { ringkas = false } = {}) => (ringkas ? `
  <div class="card card-identity identitas-sebaris" style="margin:0">
    ${html`<span class="nama">${dada3(r.nomor_dada)} · ${r.nama_regu}</span><span
      class="detail"> · ${r.nama_sekolah}<span class="identitas-golongan"> · ${
      GOLONGAN_LABEL[r.golongan] || r.golongan}</span></span>`}
  </div>` : `
  <div class="card card-identity" style="margin:0">
    ${html`<div class="nama">${dada3(r.nomor_dada)} · ${r.nama_regu}</div>
    <div class="detail">${r.nama_sekolah} · ${GOLONGAN_LABEL[r.golongan] || r.golongan}</div>`}
    ${(r.lomba_terkunci || []).length ? `<div style="margin-top:.4rem">
      <span class="badge badge-gray">${ikon("lock")} ${
        esc(String(r.lomba_terkunci.length))} lomba dikunci</span></div>` : ""}
  </div>`);
