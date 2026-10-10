/* ============================================================================
   hrcd-rekap : screens/input-nilai-tabel.js — layar Input Nilai Tabel (#/pos).

   Lembar satu pos: satu baris per regu, satu kolom per penilaian, dan cetak
   lembar pos serta blangko per lomba.
   ========================================================================== */

import { bolehLihat, daftarFotoLembar, daftarPos, ErrorApi, fotoLembarPos,
         hapusFotoLembar, hapusNilaiPos, komponenPos, lembarPos, lembarPosSatu,
         rentangNomorDada, riwayatNilai, sesi, simpanNilaiPos,
         tautanFotoBanyak, unggahFotoLembar } from "../api.js";
import { alatTabel, aturSegarkanDiTempat, chipSaringHtml, EDISI, kartuGalat,
         LAYAR, pasangAlatTabel, pasangKepala, sinyalLayarBaru,
         tandaiChip } from "../common/frame.js";
import { bacaSel, judulIsian, judulPos, selKomponen,
         TIDAK_SAH } from "../common/nilai-pos.js";
import { nomorStok } from "../nomor-dada-series.mjs";
import { angkaRapi, berapaLalu, dada3, detikSah, detikTeks, dialog, esc,
         GOLONGAN_LABEL, h, html, ikon, jamMenit, kapital, kartuGagalMuat,
         kecilkanFoto, kelompokLomba, kolomPos, kotakBerikutnyaDalamKolom,
         nilaiTeks, notif, pemuat, tanggalJam, tanggalPanjang, ukuranRapi,
         URUT_GOLONGAN, varianUntuk } from "../util.js";

/** Golongan versi pendek, HANYA untuk kertas. Di layar tetap panjang — di sana
 *  lebar tidak diperebutkan siapa pun, dan dua nama untuk satu hal cuma
 *  sepadan kalau ada yang dibeli dengannya.
 *
 *  Di lembar cadangan ia diperebutkan, dan yang kalah selama ini nama regu dan
 *  sekolah: keduanya dipotong elipsis supaya tinggi baris tetap seragam.
 *  "Penggalang PA" 13 huruf jadi "Pgl Pa" 6 huruf — sekitar 10mm kembali ke
 *  kolom nama, di kertas yang memang sedang kekurangan.
 *
 *  Singkatannya dipilih panitia: Pgl dan Pgk. Versi pertama saya "Png" untuk
 *  Penegak, dan itu lebih buruk — Png dan Pgl berbeda di dua huruf TENGAH yang
 *  sama-sama tidak menonjol, sementara Pgk dan Pgl berbeda di huruf TERAKHIR,
 *  tempat mata berhenti.
 *
 *  Sekalipun tertukar, akibatnya terbatas: kolom ini keterangan, bukan kunci.
 *  Nilai mengalir lewat nomor dada, jadi golongan yang salah baca tidak pernah
 *  memindahkan angka ke regu lain. */
export const GOLONGAN_SINGKAT = {
  penegak_pa: "Pgk Pa", penegak_pi: "Pgk Pi",
  penggalang_pa: "Pgl Pa", penggalang_pi: "Pgl Pi",
  intern_pa: "Int Pa", intern_pi: "Int Pi",
};

/* ============================ INPUT POS ================================== */

/** Pos yang sedang dibuka admin. Operator pos tidak memakainya — posnya
 *  melekat di akun dan tidak bisa dipindah dari layar. */
export const posDipilih = { nomor: null };

/** Kolom KERTAS untuk satu kolom layar. Sebagian memakan dua kolom, dan
 *  pembagiannya sama persis dengan kotak di layar — supaya petugas yang
 *  menyalin dari kertas ke layar menemukan urutan yang sama, tidak perlu
 *  mencocokkan apa pun di kepalanya. */
export const kolomCetakPos = (kolom) => kolom.flatMap(kol => {
  // Bentuk isian sama untuk semua varian satu lomba — yang berbeda antar
  // golongan hanya skalanya, bukan cara menulisnya.
  const k = kol.varian[0];
  // Waktu memakan SATU petak di kertas juga. Dua petak Menit|Detik memaksa
  // petugas memecah angka stopwatch sebelum menuliskannya; satu petak
  // menerima "32" maupun "1:10" apa adanya, persis seperti kotak di layar.
  if (k.satuan === "detik") return [{ nama: kol.nama, petunjuk: kol.petunjuk }];
  if (k.satuan === "meter") return [{ nama: kol.nama, petunjuk: kol.petunjuk }];
  if (k.form === "benar_kurang_salah") return [
    { nama: kol.nama, petunjuk: "benar" }, { nama: "", petunjuk: "salah" }];
  return [{ nama: kol.nama, petunjuk: kol.petunjuk }];
});

/** Lembar nilai untuk DITULIS TANGAN di pos (alur-lomba.md 8.8).
 *
 *  Identitas regu sudah tercetak, kolom nilainya kosong. Satu hal yang
 *  sengaja TIDAK ada di kertas ini: kolom Nilai Pos. Petugas lapangan hanya
 *  mencatat data mentah dan tidak pernah menghitung poin (alur-lomba.md 8.1)
 *  — menyediakan kotak berjudul "Nilai Pos" justru mengundang mereka
 *  menjumlahkan sendiri, dan angka hasil hitungan tangan yang berbeda dengan
 *  angka sistem adalah sengketa yang tidak perlu ada.
 *
 *  Nama pos ikut di dalam <thead>, bukan hanya di judul halaman pertama.
 *  Kertas ini beredar sebagai lembaran lepas yang berpindah tangan lewat
 *  foto; halaman yang tidak menyebutkan posnya sendiri bisa dinilaikan ke
 *  pos yang salah. Browser mengulang <thead> di tiap halaman, jadi itu
 *  gratis. */
/** Regu per lembar A4 landscape. Dipatok, bukan diserahkan ke pemenggalan
 *  otomatis browser: dengan 300 regu, halaman yang dipenggal sendiri bisa
 *  memotong satu baris di tengah, dan angka pastinya juga yang menentukan
 *  berapa lembar harus difotokopi.
 *
 *  30 pada huruf 12pt hanya mungkin setelah tinggi barisnya ditekan ke
 *  4,8mm — yang kebetulan persis tinggi baris bawaan Excel. Tiga hal yang
 *  menentukannya, dan ketiganya ditemukan dengan MENGUKUR, bukan menalar:
 *
 *    1. line-height, bukan tinggi kotak isian. Pada nilai bawaan (1,6) satu
 *       baris setinggi 32px meski kotaknya diminta 6mm.
 *    2. Sel TERTINGGI yang menang. Nomor dada sempat 14pt dan dialah yang
 *       menaikkan seluruh baris jadi 21px sementara sel 12pt lain cuma butuh
 *       18px — selisih 3px dikali 30 baris persis yang membuat halaman
 *       tumpah.
 *    3. Lebar. Di 12pt tabel Pos 1 selebar 201mm, sedangkan A4 potret hanya
 *       menyediakan 180mm; karena itu lembar ini landscape.
 *
 *  Sisa ruang setelah semuanya: 10-21mm per halaman, tergantung pos. */
// 40, naik dari 30. Diukur — bukan ditaksir — pada A4 melintang:
//
//   tinggi tersedia (margin atas-bawah 6mm)   198,00mm
//   judul + kepala + thead + catatan           17,57mm
//   sisa untuk baris                          180,43mm
//   tinggi satu baris (nomor dada 11pt)         4,45mm
//   -> 40 baris, sisa 2,35mm
//
// Empat langkah membawanya dari 30 ke 40, dan HANYA YANG TERAKHIR
// mengecilkan huruf:
//
//   padding vertikal sel   0,5pt -> 0,25pt
//   margin halaman         10mm -> 6mm atas-bawah
//   jarak baris kepala     1,2  -> 1,1
//   nomor dada             12pt -> 11pt        <- ini yang membeli 38-40
//
// Sel isian KOSONG tidak punya line box, jadi tingginya cuma padding +
// garis. Yang mengangkat tinggi baris adalah sel berisi yang paling besar,
// dan itu nomor dada — karena itu ia satu-satunya huruf yang berpengaruh.
//
// Lembar cadangan dicetak untuk SELURUH nomor dada termasuk yang belum
// terdaftar — 510 baris. Jadi 17 lembar turun ke 13.
//
// Kalau 11pt ternyata terlalu kecil dibaca ulang dari FOTO lembar,
// kembalikan ke 12pt di style.css dan angka ini ke 37.
export const REGU_PER_LEMBAR = 40;

export function siapkanCetakLembarPos(pos, kolomLayar, baris) {
  document.getElementById("cetakan")?.remove();
  const set = [{ judul: null, kolom: kolomCetakPos(kolomLayar) }];
  const judul = pos.bayangan ? `POS BAYANGAN — ${pos.name}`
                             : `POS ${pos.nomor} — ${pos.name}`;
  const tanggal = tanggalPanjang(new Date());

  const halaman = [];
  for (let i = 0; i < baris.length; i += REGU_PER_LEMBAR) {
    halaman.push(baris.slice(i, i + REGU_PER_LEMBAR));
  }

  // Sel identitas lewat tag html`` (isinya diketik orang luar); kotak kosong
  // ditempel sebagai HTML biasa karena memang tidak ada isinya.
  // Nomor yang belum ada regunya di sistem tetap mendapat barisnya, dan
  // identitasnya dibiarkan KOSONG — bukan ditandai "tidak dipakai".
  //
  // Dua jalan menuju baris kosong, dan keduanya nyata. Sebagian sekolah
  // mendaftar OFFLINE, jadi regunya memakai nomor dada fisik tanpa pernah
  // masuk sistem sampai daftar ulang menyusulkan datanya. Dan kertas ini
  // DICETAK LEBIH DULU, sebelum pendaftaran ditutup — regu yang menyusul
  // sesudahnya tetap harus punya tempat.
  // Barisnya harus bisa DITULISI: petugas mengisi nama regu dan sekolahnya di
  // tempat itu, dan meja daftar ulang memakainya untuk melengkapi data
  // belakangan. Garis "tidak dipakai" akan membuat petugas mencari tempat
  // lain — biasanya pinggir kertas, tempat tidak ada yang mencarinya.
  const barisHtml = (kolom) => (r) => r.kosong ? `
    <tr>
      ${html`<td class="dada">${dada3(r.nomor_dada)}</td>`}
      <td></td><td></td><td></td>
      ${kolom.map(() => `<td class="isian"></td>`).join("")}
    </tr>` : `
    <tr>
      ${html`<td class="dada">${dada3(r.nomor_dada)}</td>
      <td>${r.nama_regu}</td>
      <td>${r.nama_sekolah}</td>
      <td>${GOLONGAN_SINGKAT[r.golongan] || r.golongan}</td>`}
      ${kolom.map(() => `<td class="isian"></td>`).join("")}
    </tr>`;

  // Tiap lembar berdiri sendiri: judul pos, nomor halaman, dan baris tanda
  // tangannya sendiri. Kertas ini beredar sebagai lembaran lepas yang
  // berpindah tangan lewat foto — halaman yang tidak menyebutkan posnya
  // sendiri bisa dinilaikan ke pos yang salah. Di mode per lomba nama
  // lombanya ikut, karena sekarang beredar beberapa lembar berbeda dari pos
  // yang sama sekaligus, dan "Pos 1 halaman 2/2" ada tiga.
  /* "Gol.", bukan "Golongan": judulnyalah yang melebarkan
     kolom ini, bukan isinya. "GOLONGAN" di 8pt butuh ~17mm
     sementara "Pgl Pi" di 10pt cuma ~13mm, dan selisihnya
     diambil dari kolom Organisasi yang justru terpotong. */
  const lembar = set.map(({ judul: judulLomba, kolom }) =>
    halaman.map((grup, i) => `
    <section class="print-page lembar-pos">
      <h1>LEMBAR CADANGAN · ${esc(judul)}${judulLomba ? ` · ${esc(judulLomba)}` : ""}
          · Halaman ${i + 1}/${halaman.length}</h1>
      <p class="lembar-kepala">${esc(EDISI ? EDISI.name : "")} · ${esc(tanggal)} ·
         dada ${esc(dada3(grup[0].nomor_dada))}–${esc(dada3(grup[grup.length - 1].nomor_dada))}
         · Petugas: ______________ · Diperiksa: ______________</p>
      <table class="print-table">
        <thead>
          <tr>
            <th>No Dada</th><th>Nama Regu</th><th>Organisasi</th><th>Gol.</th>
            ${kolom.map(c => `<th class="isian">${esc(c.nama)}
              <span class="kolom-petunjuk">${esc(c.petunjuk)}</span></th>`).join("")}
          </tr>
        </thead>
        <tbody>${grup.map(barisHtml(kolom)).join("")}</tbody>
      </table>
      ${i === 0 ? `<p class="print-note">Tulis data mentahnya apa adanya, JANGAN
         menjumlahkan sendiri. Baris tanpa nama = regu yang belum terdaftar;
         tulis nama regu dan sekolahnya di situ.</p>` : ""}
    </section>`).join("")).join("");

  document.body.appendChild(h(`<div id="cetakan" class="printout">${lembar}</div>`));
}

/** Keterangan di bawah judul: rentang yang boleh ditulis, dan untuk waktu satu
 *  contoh nyata. Contoh itu bukan hiasan — ia mencegah seluruh kelas kesalahan
 *  yang tidak bisa dicegah kalimat mana pun: petugas yang menulis "0:47" di
 *  kotak berlabel DETIK, atau menulis poin alih-alih data mentah.
 *
 *  Menerima KOLOM, bukan komponen tunggal, dan itu yang penting. Satu blangko
 *  dipakai regu golongan mana pun, sementara Tebak Simpul punya dua skala —
 *  5 simpul untuk Penggalang, 10 untuk Penegak. Mengambil rentang dari varian
 *  pertama saja akan mencetak "0 – 10" di kertas yang separuhnya dipegang regu
 *  Penggalang: bukan sekadar kurang lengkap, tapi salah.
 *
 *  `kol.petunjuk` sudah menggabungkan rentang yang berbeda jadi
 *  "0 – 10 / 0 – 5", sama persis dengan yang tercetak di form tabel. Keduanya
 *  benar, tergantung golongan, dan petugas lomba itu tahu yang mana. */
export function contohIsian(kol) {
  const k = kol.varian[0];
  // KERTAS MENGIKUTI LAYAR, tidak menulis kalimatnya sendiri. Sebelumnya baris
  // ini berbunyi "dalam DETIK · contoh: 47" sementara kepala kolom di layar
  // sudah berbunyi "menit:detik" dan kotaknya sudah menulis "00:47" — juri
  // yang mengikuti kertas dan juri yang mengikuti layar menulis dua hal
  // berbeda untuk waktu yang sama, dan blangko sudah difotokopi sebelum ada
  // yang menyadarinya. Contohnya tetap ada, karena contoh nyata mencegah
  // sekelas kesalahan yang tidak bisa dicegah kalimat mana pun.
  if (k.satuan === "detik") return `${kol.petunjuk} · contoh: 00:47`;
  if (k.satuan === "meter") return `${kol.petunjuk} · contoh: 8.55`;
  // Keterangan yang ditulis panitia sendiri dipakai apa adanya — ia sudah
  // berupa kalimat, bukan rentang yang perlu diberi kata "angka".
  if (k.petunjuk || k.form === "biner") return kol.petunjuk;
  return `angka ${kol.petunjuk}`;
}

/** FORM PER LOMBA — BLANGKO KOSONG, satu lembar untuk satu regu di satu lomba
 *  (alur-lomba.md 8.3).
 *
 *  KENAPA KOSONG, PADAHAL SISTEM TAHU SEMUA NAMA REGUNYA.
 *
 *  Karena regu datang ke pos dalam urutan ACAK. Kloter berangkat berurutan,
 *  tetapi rute, kecepatan, dan antrean membuat siapa yang muncul berikutnya
 *  tidak bisa ditebak. Kalau tiap kertas sudah tercetak identitasnya, petugas
 *  harus MENCARI kertas nomor 005 di tumpukan berisi ratusan lembar setiap
 *  kali satu regu masuk — pekerjaan yang lebih lama daripada lombanya sendiri,
 *  dilakukan sambil regu menunggu.
 *
 *  Jadi semua kertas identik; sistem mencetak BENTUKNYA, bukan satu lembar
 *  yang sudah diisi untuk tiap regu. Petugas menulis nomor dada, nama regu,
 *  dan pangkalan/sekolah, lalu melingkari satu kategori. Identitas yang tetap
 *  menempel pada lembar lepas itu menjadi pemeriksaan kedua bila nomor dada
 *  salah tulis atau sulit dibaca.
 *
 *  Nomor dada mendapat kotak terbesar karena itulah kunci utama saat tim IT
 *  mengurutkan dan mengetik ratusan lembar. Kategori tidak ditulis ulang:
 *  pilihannya sudah tercetak agar satu lingkaran cukup dan tidak bisa salah
 *  eja. Nama lomba, satuan, tempat nilai, dan tanda tangan juga sudah menjadi
 *  bagian bentuk yang sama pada setiap master.
 */
export function siapkanCetakBlangko(pos, kolomLayar) {
  document.getElementById("cetakan")?.remove();

  const judulPos = pos.bayangan ? pos.name : `Pos ${pos.nomor} · ${pos.name}`;

  /* IDENTITAS REGU — sama di semua lomba.

     Nomor dada dibuat besar karena ia dibaca dua kali dalam keadaan
     sama-sama tergesa: saat ditulis di tengah antrean, dan saat tim IT
     mengurutkan ratusan lembar lepas dengan hanya melihat sudut kertas.

     KATEGORI DILINGKARI, bukan ditulis. Empat golongan sudah pasti, jadi
     menuliskannya berarti menyalin dua kata yang sudah ada di kertas —
     sementara satu lingkaran tidak bisa salah eja dan terbaca dari jarak
     satu meja.

     URUTANNYA DIBACA DARI URUT_GOLONGAN, tidak ditulis ulang di sini. Kertas
     dan layar harus menyebut keempatnya dalam urutan yang sama — petugas yang
     menyalin dari satu ke yang lain menghitung posisi, bukan membaca nama —
     dan salinan kelima dari daftar ini persis yang sudah dibersihkan sekali
     (lihat kepala URUT_GOLONGAN di util.js). */
  const identitas = `
      <table class="bl-identitas"><tbody>
        <tr>
          <td class="bl-dada"><span class="bl-label">No Dada</span></td>
          <td class="bl-regu"><span class="bl-label">Nama Regu</span></td>
          <td class="bl-sekolah"><span class="bl-label">Pangkalan / Sekolah</span></td>
        </tr>
        <tr>
          <td class="bl-kategori" colspan="3">
            <span class="bl-label">Kategori &mdash; lingkari salah satu</span>
            <span class="bl-pilihan">${URUT_GOLONGAN.filter(g => !g.startsWith("intern_")).map(g =>
              `<span>${esc(GOLONGAN_LABEL[g])}</span>`).join("")}</span>
          </td>
        </tr>
      </tbody></table>`;

  /* BAGIAN PANITIA BERBENTUK PITA, bukan kotak setinggi kotak nilai.

     Satu lembar kini dipegang DUA tangan — peserta menulis jawabannya,
     panitia menulis angkanya — jadi label "diisi panitia" harus menempel
     pada kotaknya, bukan melayang sebagai judul di atasnya. Menempel juga
     yang membuatnya muat: A5 melintang tidak punya ruang untuk dua judul
     berdiri sendiri ditambah dua kotak setinggi 30mm, dan diukur memang
     meluap 15 sampai 28mm sebelum bentuk ini dipakai.

     Angkanya paling banyak dua digit, jadi 21mm sudah tinggi untuk ditulis
     besar — yang butuh ruang di lembar ini isian peserta, bukan isian
     panitia.

     LABEL DI KIRI, kotaknya mengisi sisa lebar. Bentuk bertumpuk sempat
     dipakai waktu Menaksir masih punya dua kotak — di sana label yang
     berjajar mendatar terbaca sebagai pasangan maju atau pasangan mundur.
     Sejak Menaksir tidak lagi dinilai tangan, tiap pita cuma punya SATU
     kotak dan kekaburan itu hilang; yang tersisa keuntungannya, yaitu kotak
     selebar sisa halaman untuk menulis angka besar-besar. */
  const pitaPanitia = (sel) => `
      <div class="bl-panitia">
        <span class="bl-panitia-siapa">Diisi panitia</span>
        ${sel.map(([judul, petunjuk]) => `
        <span class="bl-panitia-sel">
          <span class="bl-panitia-judul">${esc(judul)}</span>
          <span class="bl-panitia-contoh">${esc(petunjuk)}</span>
        </span>
        <span class="bl-panitia-kotak"></span>`).join("")}
      </div>`;

  const penanda = (siapa) => `<p class="bl-siapa">${esc(siapa)}</p>`;

  /* LEMBAR BERNOMOR — sepuluh jawaban peserta, satu angka dari panitia.

     Dipakai tiga lomba yang bentuknya sama persis: Tebak Simpul, KIM Lihat,
     KIM Cium. Yang berbeda cuma apa yang ditulis peserta dan nama hitungan
     panitianya, jadi ketiganya memanggil bentuk ini alih-alih menyalinnya —
     tiga salinan berarti perbaikan berikutnya harus diketik tiga kali dan
     dua di antaranya akan terlewat.

     SEPULUH nomor pada satu master. Penggalang mengisi 1-5 di Tebak Simpul
     dan membiarkan sisanya kosong; dua tumpukan yang berbeda bentuknya adalah
     dua tumpukan yang bisa tertukar di lapangan, dan nomor kosong tidak
     pernah salah dibaca sebagai jawaban.

     Nomornya menurun PER LAJUR — 1-5 di kiri, 6-10 di kanan — bukan
     berselang-seling kiri-kanan. Dua lajur lima baris, bukan satu lajur
     sepuluh: A5 melintang lebar dan pendek, dan sepuluh baris berurutan ke
     bawah tidak muat tanpa mengecilkan barisnya sampai tidak bisa ditulisi. */
  const lembarBernomor = (yangDitulis, judulPanitia, petunjuk) => `
      ${penanda(`Diisi peserta — ${yangDitulis}`)}
      <div class="bl-nomor-grid">
        ${[0, 1, 2, 3, 4].flatMap(r => [r + 1, r + 6]).map(n => `
        <div class="bl-nomor-baris">
          <span class="bl-nomor">${n}.</span>
          <span class="bl-nomor-garis"></span>
        </div>`).join("")}
      </div>
      ${pitaPanitia([[judulPanitia, petunjuk]])}`;

  /* ---------------------------------------------------------------------
     BENTUK KHUSUS PER LOMBA.

     Tiga lomba mengisi lembarnya berdua: peserta menulis jawaban, panitia
     menulis angkanya. Bentuk itu TIDAK bisa diturunkan dari konfigurasi —
     `wahana` tahu rentang dan satuan, tidak tahu bahwa Semaphore punya lima
     amplop atau bahwa Tebak Simpul bernomor sampai sepuluh.

     Kuncinya `kode_lomba` — kunci BEKU dari migrasi 0079, yang sama dengan
     yang dipakai foto slip. Bukan `kode` wahana (Tebak Simpul punya empat,
     satu per golongan) dan bukan namanya (mengganti nama lomba akan
     mengembalikan lembarnya ke bentuk generik tanpa satu pun galat).

     Lomba yang tidak ada di sini memakai bentuk generik di bawah, dan itu
     keadaan yang sah — bukan kekurangan yang menunggu dilengkapi. */
  const bentukKhusus = {
    /* SEMAPHORE. Peserta mengambil satu dari lima amplop, tiap amplop berisi
       lima huruf. Yang ditulis peserta: nomor amplopnya dan kelima hurufnya.
       Panitia mencocokkan dengan kunci amplop itu lalu menghitung berapa
       huruf yang benar — 0 sampai 5, sama dengan rentang di konfigurasi.

       SATU kotak besar untuk kelima hurufnya, bukan lima kotak. Lima petak
       memaksa tulisan mengikuti petaknya, dan huruf semaphore yang ditulis
       tergesa lebih sering melebar daripada rapi — satu kotak lebar tidak
       pernah kekurangan tempat. Kotak nomor amplopnya selebar tulisan
       "Nomor Amplop" di atasnya, jadi lebarnya sendiri sudah memberi tahu
       bahwa yang ditulis di sana cuma satu angka. */
    "semaphore": () => `
      ${penanda("Diisi peserta")}
      <div class="bl-amplop">
        <div class="bl-amplop-nomor">
          <span class="bl-nilai-judul">Nomor Amplop</span>
          <div class="bl-kotak-huruf"></div>
        </div>
        <div class="bl-amplop-jawab">
          <span class="bl-nilai-judul">Jawaban Semaphore</span>
          <div class="bl-kotak-huruf"></div>
        </div>
      </div>
      ${pitaPanitia([["Jumlah huruf yang benar", "( 0 – 5 )"]])}`,

    /* Tiga lomba di bawah ini memakai bentuk yang sama; alasannya di
       lembarBernomor(). */
    "tebak-simpul": () => lembarBernomor(
      "nama simpulnya", "Jumlah simpul yang benar", "( 0 – 5 / 0 – 10 )"),

    /* KIM LIHAT dan KIM CIUM: dua lomba, dua lembar, bentuk yang sama dengan
       Tebak Simpul. Peserta menuliskan sepuluh jawabannya, panitia menghitung
       berapa yang benar. */
    "kim-lihat": () => lembarBernomor(
      "benda yang dilihat", "Jumlah benar", "( 0 – 10 )"),
    "kim-cium": () => lembarBernomor(
      "benda yang dicium", "Jumlah benar", "( 0 – 10 )"),

    /* MENAKSIR — SATU-SATUNYA lembar tanpa bagian panitia.

       Yang diketik ke sistem adalah TAKSIRAN PESERTA apa adanya, bukan
       selisihnya: jawaban sebenarnya tersimpan di konfigurasi, dan mesin
       skor yang menghitung selisihnya. Jadi tidak ada yang perlu dinilai
       tangan di kertas ini — panitia cuma membaca angka yang sudah ditulis
       peserta lalu mengetiknya.

       Kotak jawaban sebenarnya SENGAJA tidak dicetak. Ia sama untuk semua
       regu, dan angka yang tercetak di 300 lembar adalah 300 kesempatan
       peserta membacanya sebelum menaksir.

       "contoh: 7.34" memakai TITIK, dan contohnya ada justru karena itu:
       peserta menulis koma seperti kebiasaan menulis angka di Indonesia,
       sementara yang diterima kotak isian di layar adalah titik. Satu contoh
       nyata mencegah seluruh kelas kesalahan itu tanpa satu kalimat pun. */
    "menaksir": () => `
      ${penanda("Diisi peserta")}
      <div class="bl-taksir">
        <span class="bl-nilai-judul">Hasil Taksir</span>
        <span class="bl-nilai-contoh">meter, dua angka di belakang koma — contoh: 7.34</span>
        <div class="bl-taksir-kotak"></div>
      </div>`,
  };

  const satuBlangko = (lomba) => {
    const kols = lomba.kolom;
    // Varian mana pun boleh dipakai untuk menurunkan bentuknya: yang berbeda
    // antar golongan hanya skalanya, dan skala tidak dicetak di blangko —
    // justru itu gunanya. Petugas menulis jumlah benar apa adanya, dan sistem
    // yang tahu 5 simpul untuk Penggalang, 10 untuk Penegak.
    const generik = () => `
      ${penanda("Diisi panitia")}
      <div class="bl-nilai${kols.length > 1 ? " bl-nilai-banyak" : ""}">
        ${kols.map(kol => `
        <div class="bl-nilai-sel">
          <div class="bl-nilai-kepala">
            <span class="bl-nilai-judul">${esc(kols.length > 1
              ? kol.nama : judulIsian(kol.varian[0]))}</span>
            <span class="bl-nilai-contoh">${esc(contohIsian(kol))}</span>
          </div>
          <div class="bl-nilai-kotak"></div>
        </div>`).join("")}
      </div>`;

    const khusus = bentukKhusus[lomba.kode];
    const badan = (khusus || generik)();

    /* Catatan "tulis angkanya saja" hanya di bentuk generik. Di lembar
       khusus ia sudah dijawab dua kali — pita panitia menyebut satuan dan
       rentangnya, dan kotaknya sendiri bernama "Jumlah ... yang Benar" —
       sementara satu baris di A5 yang sudah penuh adalah 6mm yang dipakai
       kotak tulis (CLAUDE.md 9.3). */
    const catatan = khusus ? "" : `
      <p class="bl-catatan"><strong>Tulis angkanya saja — jangan menghitung
         poin.</strong></p>`;

    /* .bl-ttd — TIGA JURI, bukan satu petugas. Satu lomba dinilai bersama, dan
       tanda tangan yang cuma satu membuat dua juri lain tidak punya
       tempat menyatakan bahwa angka itu juga angka mereka. Namanya
       ditulis tangan: yang bertugas di sebuah pos berganti sepanjang
       pagi, dan blangko sudah difotokopi jauh sebelum itu diputuskan. */
    return `
    <article class="blangko">
      <p class="bl-pos">${esc(judulPos)}</p>
      <h2 class="bl-lomba">${esc(lomba.nama)}</h2>
      <p class="bl-acara">${esc(EDISI ? EDISI.name : "")}</p>

      ${identitas}

      ${badan}

      ${catatan}

      <div class="bl-ttd">
        ${[1, 2, 3].map(i => `
        <div class="bl-ttd-sel">
          <span class="bl-ttd-nama">Juri ${i}</span>
          <span class="bl-ttd-garis"></span>
        </div>`).join("")}
      </div>
    </article>`;
  };

  // SATU HALAMAN A5 MELINTANG PER LOMBA, bukan sebanyak jumlah regu.
  //
  // Yang dicetak dari sini adalah MASTER, bukan tumpukannya. Blangko
  // diperbanyak dengan mesin fotokopi — 500 regu di pos berisi tiga lomba
  // membutuhkan 1.500 lembar, dan mencetak sebanyak itu lewat browser berarti
  // menghabiskan satu toner printer kantor untuk pekerjaan yang diselesaikan
  // mesin fotokopi dalam beberapa menit.
  //
  // Jadi keluarannya tiga halaman untuk Pos 1: Semaphore, Tebak Simpul,
  // Menaksir. Panitia menggandakan tiap halaman sebanyak yang dibutuhkan, dan
  // tiap tumpukan otomatis berisi satu lomba saja.
  /* LOMBA SOAL TIDAK PUNYA BLANGKO, dan itu bukan penghematan kertas.
     Kepramukaan, Keagamaan, Kesehatan, Pengetahuan Umum, dan Logika dijawab
     peserta di LEMBAR SOALNYA SENDIRI — lembar itulah bukti dan lembar itu
     pula yang dikumpulkan. Blangko kosong di sampingnya cuma kertas kedua
     untuk satu angka yang sudah tertulis di kertas pertama, dan kertas kedua
     yang tidak dipakai tetap difotokopi 1.500 kali.

     Dikenali dari `type`, bukan dari namanya: `soal` adalah kolom di database
     dan panitia yang menentukan isinya (0076). Menyaring dengan daftar nama
     berarti lomba soal tahun depan tercetak lagi tanpa ada yang tahu kenapa. */
  const lombaSoal = (l) => l.kolom.every(kol => kol.varian[0].type === "soal");
  const daftarLomba = kelompokLomba(kolomLayar).filter(l => !lombaSoal(l));
  if (!daftarLomba.length) return 0;

  const cetakan = daftarLomba.map(l => `
    <section class="print-page blangko-halaman">${satuBlangko(l)}</section>`).join("");

  document.body.appendChild(h(`<div id="cetakan" class="printout">${cetakan}</div>`));
  return daftarLomba.length;
}

/** Layar Input Pos — lembar kertas yang dipindah ke layar.
 *
 *  Bentuknya sengaja SAMA dengan lembar Google Sheets yang dipakai panitia
 *  selama ini: identitas regu di kiri, satu kolom per hal yang dinilai, Nilai
 *  Pos di kanan. Petugas yang menyalin dari foto lembar tidak perlu belajar
 *  bentuk baru — matanya sudah tahu di mana harus mendarat.
 *
 *  Nilai Pos TIDAK dihitung di browser. Angkanya dibaca ulang dari database
 *  tiap kali satu baris tersimpan, supaya tidak pernah ada mesin skor kedua
 *  yang bisa berbeda pendapat dengan v_poin_pos — dan supaya angka yang
 *  dilihat petugas adalah angka yang benar-benar tersimpan, bukan tebakan
 *  layar tentang apa yang akan tersimpan.
 */
export async function layarInputPos() {
  const s = sesi();
  if (!bolehLihat("pos")) {
    pasangKepala("Input Nilai Tabel");
    LAYAR.replaceChildren(h(html`
      <div class="card">
        <h2>Akun meja, bukan akun pos</h2>
        <p class="description">Akun ${s.username} dipakai di meja. Input nilai
           pos memakai akun posnya sendiri — hubungi koordinator.</p>
      </div>`));
    return;
  }

  pasangKepala("Input Nilai Tabel", "lembar");
  LAYAR.replaceChildren(h(pemuat()));

  const layarIni = location.hash;
  let semuaPos;
  try { semuaPos = await daftarPos(); }
  catch (e) { LAYAR.replaceChildren(kartuGagalMuat(e.message, layarInputPos)); return; }
  if (location.hash !== layarIni) return;

  // Tidak semua pos dinilai. Pos 0 (Keberangkatan) dan Pos 6 (Kedatangan)
  // adalah garis start dan garis finish — yang dicatat di sana waktu, lewat
  // layar Keberangkatan dan Kedatangan. Admin dibuka di pos yang benar-benar
  // bisa diisi, bukan di pos pertama menurut nomor.
  const posDinilai = semuaPos.filter(p => Number(p.jumlah_komponen) > 0);

  // Operator pos tidak memilih apa pun — posnya sudah melekat di akunnya, dan
  // RLS akan menolak pos lain seandainya layar ini mencoba.
  // Terkunci = punya kolom `pos`, bukan = berperan juri_pos. Koordinator Pos
  // tidak punya pos, jadi ia ikut jalur pemilih di bawah.
  // SATU patokan untuk dua keputusan: pos mana yang dibuka, dan apakah tombol
  // cetak ikut tampil di HP. Keduanya bertanya hal yang sama — "akun ini
  // melayani satu pos, atau seluruh pos?" — dan menjawabnya dua kali dengan
  // cara berbeda adalah cara keduanya berselisih diam-diam.
  const terkunciPos = s.pos != null && s.pos !== "";
  const nomorPos = terkunciPos
    ? Number(s.pos)
    : (posDipilih.nomor
       ?? (posDinilai.length ? posDinilai[0].nomor
                             : (semuaPos.length ? semuaPos[0].nomor : null)));
  const pos = semuaPos.find(p => Number(p.nomor) === Number(nomorPos));

  if (!pos) {
    LAYAR.replaceChildren(h(kartuGalat(
      "Edisi ini belum punya pos sama sekali. Admin harus mengisinya dulu.")));
    return;
  }
  posDipilih.nomor = pos.nomor;
  pasangKepala(`Input ${judulPos(pos)}`, "lembar");

  let komponen, lembar;
  // Rentang stok nomor dada diambil DI SINI, bukan saat tombol cetak ditekan.
  // Alasannya bukan kecepatan: `window.print()` harus tetap berada di giliran
  // event tap, dan Safari iPhone memblokirnya begitu ada satu `await` lebih
  // dulu (lihat catatan yang sama di layarCetakKloter). Stok nomor dada juga
  // tidak berubah di tengah lomba — ia dicetak di kain, bukan di database.
  // Gagal membacanya tidak boleh menghalangi apa pun: nol berarti lembar
  // dicetak apa adanya, tanpa baris kosong penambal.
  let rentangStok = null;
  /* null = status fotonya TIDAK diketahui, dan itu berbeda dari "tidak ada
     foto". Kalau permintaannya gagal — pos memang sering kehilangan sinyal —
     menandai semua baris "belum foto" akan menuduh ratusan regu sekaligus.
     Yang benar: berhenti menilai fotonya, dan katakan begitu di saringannya. */
  let fotoPos = null;
  try {
    [komponen, lembar, rentangStok, fotoPos] = await Promise.all([
      komponenPos(EDISI.nomor, pos.nomor),
      lembarPos(pos.nomor),
      rentangNomorDada().catch(() => null),
      fotoLembarPos(pos.nomor).catch(() => null),
    ]);
  } catch (e) {
    LAYAR.replaceChildren(kartuGagalMuat(e.message, layarInputPos)); return;
  }
  if (location.hash !== layarIni) return;

  if (!komponen.length) {
    // Dua sebab yang berbeda, dan layar tidak bisa membedakannya dari data:
    // pos yang MEMANG tidak dinilai, dan pos yang komponennya belum diisi.
    // Jadi keduanya disebut, alih-alih menuduh salah satunya.
    // Template BIASA, bukan tag html`` — pilihPosHtml sudah berupa HTML dan
    // akan tampil apa adanya sebagai teks kalau ikut di-escape. Nama pos
    // datang dari database, jadi ia lewat esc() sendiri.
    LAYAR.replaceChildren(h(`
      <div class="card">${pilihPosHtml(s, semuaPos)}</div>
      <div class="card">
        <h2>${esc(judulPos(pos))} tidak punya kolom penilaian</h2>
      </div>`));
    pasangPilihPos(s);
    return;
  }

  // Satu kolom per LOMBA, bukan per baris wahana. Tebak Simpul punya empat
  // baris (satu per golongan) dan tetap satu kolom — lihat kolomPos().
  const kolom = kolomPos(komponen);

  /** Komponen yang boleh diisi baris ini. Dipakai saat MENYIMPAN, bukan cuma
   *  saat menggambar: kotak milik golongan lain memang tidak ada di DOM, tapi
   *  memutar seluruh daftar komponen di sini akan membuat bacaSel() mencari
   *  kotak yang tidak pernah ada dan jatuh di `kotak[0].value`. */
  const komponenBaris = (tr) =>
    kolom.map(kol => varianUntuk(kol, tr.dataset.golongan)).filter(Boolean);

  // Cermin nilai yang ADA DI DATABASE, bukan yang ada di kotak isian. Yang
  // dikirim ke server hanya selisih antara keduanya — kotak yang tidak diubah
  // tidak pernah ditulis ulang, jadi kepengarangan nilai tidak bergeser dan
  // riwayat tidak dibanjiri baris yang tidak mengubah apa-apa.
  const asli = new Map(lembar.map(r => [Number(r.nomor_dada), r.nilai || {}]));

  /* Pita keadaan simpan. Duduk DI ATAS tabel, bukan di bawahnya:
     tabelnya bergulir sendiri (max-height), jadi apa pun yang ditaruh
     di bawah bisa berada di luar layar justru saat petugas sedang
     mengetik di baris ke-80. */
  /* Pita keadaannya ada DI DALAM toolbar, di sebelah pemilih pos.
     SELALU terlihat, tidak pernah hidden: pita yang hanya muncul saat
     ada masalah tidak bisa dipercaya, karena petugas tidak punya cara
     membedakan "semuanya aman" dari "pitanya sedang rusak". Google
     Sheets menampilkan capnya terus-menerus untuk alasan yang sama. */
  /* .table-wrapper — table-tetap: di HP lembar ini TETAP tabel dan digeser ke
     samping, tidak ditumpuk jadi kartu seperti layar meja. Alasannya di
     style.css, bagian LEMBAR INPUT POS. */
  LAYAR.replaceChildren(h(`
    <div class="card">
      ${alatTabel({
        /* Pita keadaan duduk DI SEBELAH pemilih pos, bukan di baris sendiri.
           Keduanya menjawab pertanyaan yang sama — "saya sedang di pos mana,
           dan apakah yang saya ketik sudah aman" — dan itu satu lirikan, bukan
           dua. Di HP baris sendiri berarti satu baris lagi yang harus digulir
           sebelum sampai ke tabelnya. */
        kiri: `<div class="baris-pos">${pilihPosHtml(s, semuaPos)}
                 <div id="pos-simpan" class="pos-simpan aman"></div></div>`,
        // Dua bentuk kertas, dan URUTANNYA menyatakan mana yang utama.
        // Form per lomba dipakai setiap hari lomba di setiap pos; form tabel
        // hanya kalau slipnya habis atau sinyal mati. Tombol cadangan yang
        // berdiri lebih dulu akan dipakai orang yang tidak tahu bedanya.
        //
        // Namanya memakai kosakata panitia persis — "form per lomba" dan
        // "form tabel" adalah kata yang mereka ucapkan sendiri, dan tombol
        // bernama lain memaksa penerjemahan di kepala setiap kali dipakai.
        //
        // Dibungkus `.alat-cetak` supaya bisa disembunyikan di HP: mencetak
        // dari HP tidak pernah terjadi — kertasnya keluar dari mesin fotokopi
        // di sekretariat — dan dua tombol selebar layar di antara penyaring
        // dan tabel memaksa petugas menggulir melewatinya ratusan kali per
        // shift untuk sampai ke pekerjaannya.
        //
        // Di HP ia tetap tampil untuk akun yang TIDAK terkunci ke satu pos —
        // koordinator pos dan admin. Merekalah yang menyiapkan kertas untuk
        // pos lain, dan patokannya kolom `pos` yang kosong, bukan nama
        // perannya (patokan yang sama dengan pemilih pos di bawah).
        kanan: `<span class="alat-cetak${terkunciPos ? "" : " alat-cetak-hp"}">
                <button class="button button-secondary button-small" type="button"
                        id="cetak-per-lomba">🖨️ Form per Lomba</button>
                <button class="button button-secondary button-small" type="button"
                        id="cetak-lembar">🖨️ Form Tabel (cadangan)</button></span>`,
        // Pendek dengan sengaja: kartunya kini selebar tabel, dan petunjuk
        // panjang terpotong di tengah kata — yang justru lebih buruk daripada
        // petunjuk singkat, karena terlihat seperti layar yang rusak.
        cariContoh: "Cari nomor dada / regu / organisasi…",
        /* Empat saringan, dan keduanya yang "belum" TIDAK saling meniadakan:
           satu regu bisa belum diinput DAN belum difoto, lalu muncul di
           kedua-duanya. Itu benar — ini pandangan, bukan kotak yang harus
           berisi tepat satu kali tiap regu.

           "Lengkap" menuntut KEDUANYA: nilai penuh dan foto penuh. Kalau ia
           cuma menuntut nilainya, regu yang fotonya kurang akan berdiri di
           "Belum Foto" dan di "Lengkap" sekaligus — dua label yang saling
           membantah tentang regu yang sama. */
        saringan: [
          { kode: "semua", label: "Semua" },
          { kode: "belum-input", label: "Belum Input" },
          { kode: "belum-foto", label: "Belum Foto" },
          { kode: "lengkap", label: "Lengkap" },
        ],
        saringAktif: "semua",
        jumlah: lembar.length,
      })}
      <div class="table-wrapper table-wrapper-tetap">
        <table class="table data-table table-tetap table-pos"
               ${lembar.length ? "" : "hidden"}>
          <thead>
            <tr>
              <th class="text-center">Nomor<br>Dada</th>
              <th>Nama Regu</th>
              <th>Organisasi</th>
              <th>Golongan</th>
              ${kolom.map(kol => `
                <th class="text-center">
                  <span class="kolom-nama">${esc(kol.nama)}</span>
                  <span class="kolom-petunjuk">${esc(kol.petunjuk)}</span></th>`).join("")}
              <th class="text-center">Nilai<br>${esc(pos.bayangan ? pos.name : `Pos ${pos.nomor}`)}</th>
              <th class="text-center"><span class="visually-hidden">Status simpan</span></th>
              <th class="text-center"><span class="visually-hidden">Foto</span></th>
              <th class="text-center"><span class="visually-hidden">Gembok</span></th>
            </tr>
          </thead>
          <tbody id="isi-tabel"></tbody>
        </table>
        ${lembar.length ? "" : `<p class="table-empty">Belum ada regu yang
          menerima nomor dada.</p>`}
      </div>
    </div>
  `));

  /* ---------- status foto per regu ----------

     Satu slip = satu LOMBA (bagian 11.6), bukan satu penilaian: Pembidaian
     lima kriteria berbagi satu kertas dan satu `kode_lomba`. Jadi yang
     dihitung kurang di sini lomba, bukan kolom.

     Lomba yang komponennya tidak berlaku untuk golongan regu itu TIDAK ikut
     dituntut — regu Penggalang tidak pernah punya slip Tebak Simpul Penegak,
     dan menuduhnya belum foto adalah alarm yang tidak bisa dipenuhi siapa
     pun. */
  const lombaPos = kelompokLomba(kolom);
  const fotoPunya = new Map();
  (fotoPos || []).forEach(f => {
    const dada = Number(f.nomor_dada);
    if (!fotoPunya.has(dada)) fotoPunya.set(dada, new Set());
    fotoPunya.get(dada).add(f.kode_lomba);
  });

  /** "1" kurang, "0" lengkap, "" belum diketahui (permintaannya gagal). */
  const tandaFoto = (r) => {
    if (fotoPos === null) return "";
    const punya = fotoPunya.get(Number(r.nomor_dada)) || new Set();
    const kurang = lombaPos.some(l =>
      l.kolom.some(kol => varianUntuk(kol, r.golongan)) && !punya.has(l.kode));
    return kurang ? "1" : "0";
  };

  const tbody = document.getElementById("isi-tabel");
  tbody.replaceChildren(h(lembar.map(r => `
    <tr data-dada="${esc(r.nomor_dada)}" data-terisi="${esc(r.jumlah_terisi)}"
        data-golongan="${esc(r.golongan)}" data-komponen="${esc(r.jumlah_komponen)}"
        data-foto-kurang="${tandaFoto(r)}"
        data-terkunci="${r.terkunci ? "1" : ""}">
      <td class="angka text-center" data-label="Nomor Dada">${esc(dada3(r.nomor_dada))}</td>
      <td data-label="Nama Regu"><strong>${esc(r.nama_regu)}</strong></td>
      <td data-label="Organisasi">${esc(r.nama_sekolah)}</td>
      <td data-label="Golongan">${esc(GOLONGAN_LABEL[r.golongan] || r.golongan)}</td>
      ${kolom.map(kol => {
        const k = varianUntuk(kol, r.golongan);
        // Sel mati, bukan kotak kosong. Kotak yang bisa diketik tapi selalu
        // ditolak adalah jebakan; garis pendek menjawab pertanyaannya sebelum
        // ditanya — kolom ini bukan untuk golongan regu ini.
        return `<td class="text-center" data-label="${esc(kol.nama)}">
          ${k ? selKomponen(k, (r.nilai || {})[k.kode])
              : `<span class="sel-mati" title="Bukan untuk ${esc(GOLONGAN_LABEL[r.golongan] || r.golongan)}">–</span>`}</td>`;
      }).join("")}
      <td class="text-center pos-nilai" data-label="Nilai Pos">${esc(angkaRapi(r.nilai_pos))}</td>
      <td class="pos-status" data-label=""></td>
      <td class="pos-foto text-center" data-label="">
        <button type="button" class="badge badge-tombol" data-foto
          title="Foto jawaban regu ini">${ikon("camera")}</button></td>
      <td class="pos-gembok" data-label=""></td>
    </tr>`).join("")));

  /* Kamera dipasang lewat satu pendengar di tbody, bukan satu per baris.
     Tombolnya digambar sekali di template dan tidak pernah digambar ulang —
     berbeda dengan gembok dan penanda simpan, yang berganti rupa mengikuti
     keadaan barisnya. Menempelkan ~300 pendengar untuk tombol yang tidak
     pernah berubah adalah ongkos yang tidak dibayar apa-apa. */
  /** Baca ulang status foto sepos, lalu tandai ulang tiap baris.
   *
   *  Dipanggil sesudah dialog foto ditutup: di dalamnya foto bisa diunggah
   *  atau dihapus, dan penanda yang tidak ikut berubah membuat saringan
   *  "Belum Foto" berbohong tentang pekerjaan yang baru saja selesai. */
  const segarkanFoto = async () => {
    let baru;
    try { baru = await fotoLembarPos(pos.nomor); }
    catch { return; }   // pos sering kehilangan sinyal; penanda lama dibiarkan
    if (location.hash !== layarIni) return;
    fotoPos = baru;
    fotoPunya.clear();
    baru.forEach(f => {
      const dada = Number(f.nomor_dada);
      if (!fotoPunya.has(dada)) fotoPunya.set(dada, new Set());
      fotoPunya.get(dada).add(f.kode_lomba);
    });
    [...tbody.children].forEach(tr => {
      tr.dataset.fotoKurang = tandaFoto({
        nomor_dada: tr.dataset.dada, golongan: tr.dataset.golongan,
      });
    });
    terapkanSaringan();
  };

  tbody.addEventListener("click", (e) => {
    const b = e.target.closest("[data-foto]");
    if (b) bukaFoto(b.closest("tr")).then(segarkanFoto);
  });

  /* ---------- keadaan simpan per baris ----------

     Pertanyaan yang harus bisa dijawab layar ini sambil dilirik, tanpa
     menekan apa pun: "angka yang barusan saya ketik, sudah masuk database
     atau belum?" Di pos, internet putus adalah kejadian biasa — dan angka
     yang hanya ada di layar sama saja dengan angka yang tidak pernah dicatat.

     Empat keadaan, dan tidak ada baris yang boleh berada di luar keempatnya:

       (kosong)    belum ada nilai sama sekali
       belum       sudah diketik, BELUM sampai ke server
       menyimpan   sedang di jalan
       tersimpan   ✓ ada di database — ini yang dibaca ulang dari sana
       gagal       tidak sampai; tetap tersimpan di layar dan dicoba lagi

     Yang paling penting justru `belum`. Sebelumnya keadaan itu tidak ada:
     antara petugas mengetik dan meninggalkan kotaknya, layar diam saja —
     terlihat persis sama dengan baris yang sudah aman.                    */

  const statusBaris = (tr, keadaan, pesan) => {
    const sel = tr.querySelector(".pos-status");
    tr.dataset.keadaan = keadaan || "";
    tr.classList.toggle("baris-gagal", keadaan === "gagal");
    tr.classList.toggle("baris-belum", keadaan === "belum");

    if (keadaan === "belum") {
      sel.replaceChildren(h(`<span class="badge badge-yellow" title="Belum terkirim ke server">belum</span>`));
    } else if (keadaan === "menyimpan") {
      sel.replaceChildren(h(`<span class="badge badge-gray">…</span>`));
    } else if (keadaan === "tersimpan") {
      // Centangnya SEKALIGUS pintu riwayat. Bukan tombol tambahan di kolom
      // terpisah: lembar ini sudah selebar layar dua kali, dan satu kolom lagi
      // dibayar setiap baris walau riwayatnya hampir tidak pernah ditanya.
      //
      // Yang ditanyakan orang saat menatap centang hijau memang persis ini —
      // "angka ini sudah masuk, tapi siapa yang menaruhnya, dan apakah ia
      // mengganti angka lain?" Jadi jawabannya ditaruh di tempat pertanyaannya
      // muncul.
      sel.replaceChildren(h(`<button class="badge badge-green badge-tombol"
        type="button" data-riwayat title="Sudah masuk database">✓</button>`));
      sel.querySelector("[data-riwayat]")
         .addEventListener("click", () => bukaRiwayat(tr));
    } else if (keadaan === "gagal") {
      sel.replaceChildren(h(html`<button class="button button-danger button-mini"
        type="button" data-ulang title="${pesan}">Ulangi</button>`));
      sel.querySelector("[data-ulang]").addEventListener("click", () => simpanBaris(tr, true));
    } else {
      sel.replaceChildren();
    }
    perbaruiRingkasan();
  };

  /** Gembok satu baris: rupanya, dan apa yang ikut mati bersamanya.
   *
   *  Terbuka adalah keadaan bawaan — semua baris bisa diisi sampai ada yang
   *  menyatakan selesai. Sesudah dikunci, kotaknya benar-benar dimatikan, bukan
   *  sekadar dipudarkan: kotak yang masih bisa diketik tapi selalu ditolak
   *  adalah jebakan, dan penolakannya baru muncul sesudah petugas mengetik
   *  angka yang ia kira tersimpan.
   *
   *  Yang menegakkan aturannya tetap server (0044). Ini supaya petugas tahu
   *  SEBELUM mengetik, bukan sesudah ditolak. */
  const gambarGembok = (tr) => {
    const kunci = tr.dataset.terkunci === "1";
    tr.classList.toggle("baris-terkunci", kunci);
    tr.querySelectorAll("input").forEach(el => { el.disabled = kunci; });

    /* LAMBANG, BUKAN TOMBOL — sejak 0166 menggembok pindah seluruhnya ke layar
       Cek Nilai, per lomba (keputusan pemilik acara, 31 Agustus 2026).

       Kenapa dipindah: yang menggembok menyatakan "angka ini sudah dicocokkan
       dengan foto slipnya", dan pencocokan itu tidak terjadi di sini — layar
       ini tidak memperlihatkan fotonya. Juri yang menggembok dari sini
       menyatakan sesuatu yang tidak bisa ia lihat.

       Lambangnya TETAP DIGAMBAR, dan justru itu gunanya sekarang: barisnya
       mati, dan tanpa lambang gembok petugas cuma melihat kotak yang tidak
       bisa diketik tanpa satu pun keterangan kenapa. Yang hilang cuma
       kemampuan mengetuknya.

       `terkunci` di baris ini berarti "ADA lomba pos ini yang tergembok"
       (0166 pasal 4). Lebih menahan daripada perlu, dan itu memang arah yang
       benar: menahan yang boleh diubah cuma merepotkan, meloloskan yang sudah
       diverifikasi menghapus pekerjaan orang. */
    const sel = tr.querySelector(".pos-gembok");
    sel.replaceChildren(h(`<span class="gembok gembok-tanda"
      title="${kunci ? "Terkunci di Cek Nilai — buka di sana"
                     : "Belum dikunci"}"
      aria-label="${kunci ? "terkunci" : "belum dikunci"}">${
      ikon(kunci ? "lock" : "lock-open")}</span>`));
  };

  /** Riwayat perubahan nilai satu regu di pos ini.
   *
   *  Dibaca saat DIKETUK, bukan ikut dimuat bersama lembarnya: lembar pos
   *  memuat ratusan baris dan hampir semuanya tidak pernah ditanya riwayatnya.
   *
   *  Yang ditampilkan sengaja apa adanya — angka lama, angka baru, siapa,
   *  kapan — tanpa menyimpulkan mana yang "mencurigakan". Yang tahu apakah
   *  suatu perubahan wajar adalah orang yang berdiri di pos itu, bukan layar. */
  async function bukaRiwayat(tr) {
    const dada = Number(tr.dataset.dada);
    const nama = tr.children[1].textContent.trim();
    let baris;
    try {
      baris = await riwayatNilai(pos.nomor, dada);
    } catch (err) {
      notif(`Riwayat tidak bisa dibaca: ${err.message}`, true);
      return;
    }

    /* Sengaja RINGKAS: satu baris per perubahan, tanpa kepala tabel.
       Yang dicari orang saat membukanya cuma tiga hal — lomba apa, dari berapa
       jadi berapa, dan siapa. Kepala tabel dan kalimat penjelas menambah teks
       yang harus dilewati mata sebelum sampai ke jawabannya. */
    if (!baris.length) {
      await dialog({
        judul: `${dada3(dada)} · ${nama}`,
        kartuHtml: `<p class="description">Belum pernah diubah.</p>`,
        labelAksi: "Tutup", bacaSaja: true,
      });
      return;
    }

    /* SARINGAN PER LOMBA, dan hanya muncul kalau memang ada yang disaring.
       Satu regu di Pos 3 bisa punya delapan lomba dan puluhan perubahan; yang
       ditanyakan biasanya satu — "Bidai-nya kenapa berubah dua kali?".
       Menyaringnya di sini lebih cepat daripada menyusuri daftar.

       Di pos berlomba satu, chip-nya cuma akan berbunyi "Semua" dan nama lomba
       itu sendiri — dua tombol yang tidak menyaring apa pun. Jadi ia tidak
       digambar sama sekali. */
    /* Chip diurutkan seperti URUTAN PENILAIAN, bukan seperti urutan perubahan.
       Daftar riwayat di bawahnya urut waktu-terbaru-dulu, dan chip yang ikut
       urutan itu berpindah tempat setiap kali ada nilai baru masuk — tombol
       yang berpindah antar kunjungan harus dibaca ulang tiap kali.
       kolom[] datang dari kolomPos() yang sudah urut sort_order, jadi
       chip-nya berbaris sama dengan kolom di lembar: Semaphore, Tebak Simpul,
       Menaksir. Lomba yang tidak dikenali kolom (mis. komponen yang sudah
       dihapus admin tapi masih punya riwayat) jatuh ke belakang. */
    const urutLomba = new Map(kolom.map((k, i) => [k.nama, i]));
    const lomba = [...new Map(baris.map(b => [b.kode_lomba, b.nama_lomba]))]
      .sort((a, b) => (urutLomba.get(a[1]) ?? 1e9) - (urutLomba.get(b[1]) ?? 1e9));
    const chip = lomba.length < 2 ? "" : `
      <div class="option-row saring-riwayat">${chipSaringHtml([
        { kode: "", label: "Semua" },
        ...lomba.map(([kode, nama]) => ({ kode, label: nama })),
      ], "", "lomba")}</div>`;

    /* Angkanya ditulis PERSIS seperti kotak isiannya menulisnya — "8.55",
       bukan 855; "00:47", bukan 47. Yang membuka riwayat sedang membandingkan
       dengan kotak yang ada di depannya, dan dua bentuk untuk satu angka
       membuat perbandingan itu harus diterjemahkan dulu. Komponen yang sudah
       dihapus admin tidak ada di `komponen` lagi; nilaiTeks menuliskannya
       polos, dan itu tetap lebih baik daripada barisnya hilang. */
    const metaKode = new Map(komponen.map(k => [k.kode, k]));
    const isi = chip + `<ul class="riwayat">${baris.map(b => {
      const k = metaKode.get(b.kode_lomba);
      return html`
      <li data-lomba="${b.kode_lomba}">
        <span class="r-lomba">${b.nama_lomba}</span>
        <span class="r-nilai">${b.nilai_lama === null ? "—" : nilaiTeks(k, b.nilai_lama)}
          → <strong>${b.nilai_baru === null ? "hapus" : nilaiTeks(k, b.nilai_baru)}</strong></span>
        <span class="r-oleh">${b.oleh} · ${tanggalJam(b.changed_at)}</span>
      </li>`;
    }).join("")}</ul>`;

    // dialog() menempelkan kartunya ke DOM secara SINKRON sebelum janjinya
    // menunggu, jadi penyaringnya boleh dipasang sebelum di-await. Menunggu
    // dulu berarti menunggu sampai dialognya ditutup.
    const janji = dialog({
      judul: `${dada3(dada)} · ${nama}`,
      kartuHtml: isi,
      labelAksi: "Tutup",
      bacaSaja: true,
    });

    const kartu = document.querySelector(".dialog .saring-riwayat");
    if (kartu) {
      kartu.addEventListener("click", (e) => {
        const b = e.target.closest("[data-lomba]");
        if (!b) return;
        const pilih = b.dataset.lomba;
        tandaiChip(kartu, "lomba", pilih);
        document.querySelectorAll(".dialog .riwayat li").forEach(li => {
          li.hidden = !!pilih && li.dataset.lomba !== pilih;
        });
      });
    }

    await janji;
  }

  /** Foto slip penilaian satu regu — satu foto per lomba (migrasi 0047).
   *
   *  Kertas berpindah tangan dari pos ke kotak ke meja IT, dan begitu hilang
   *  tidak ada apa pun yang bisa memulihkan angkanya. Difoto di sini, di meja
   *  IT, karena di sinilah fotonya tertaut sendiri ke nomor dada dan lomba
   *  yang tepat — petugas baru saja mengetiknya.
   *
   *  Gembok TIDAK mematikan tombol ini. Mengunci berarti angkanya final;
   *  fotonya justru bukti untuk angka final itu, dan menolak bukti setelah
   *  putusan adalah urutan yang terbalik. */
  async function bukaFoto(tr) {
    const dada = Number(tr.dataset.dada);
    const namaRegu = tr.children[1].textContent.trim();
    const tiga = dada3(dada);

    let sudah = [];
    try {
      sudah = await daftarFotoLembar(pos.nomor, dada);
    } catch (err) {
      notif(`Daftar foto tidak bisa dibaca: ${err.message}`, true);
    }

    /* SELURUH barisnya disimpan per lomba, bukan cuma yang terbaru.
       Dulu hanya path pertama yang dipegang, jadi "Lihat" pada baris berbunyi
       "9 foto" tetap membuka SATU gambar — dan yang delapan lagi tidak punya
       satu pun jalan untuk dilihat. Angkanya benar, tombolnya yang berbohong.

       Urutannya sudah terbaru dulu (order diunggah_pada.desc di api.js), dan
       itu urutan yang benar: slip yang baru difoto adalah yang sedang
       dipertanyakan orang. */
    const hitung = {};
    const perLomba = {};
    sudah.forEach(f => {
      hitung[f.kode_lomba] = (hitung[f.kode_lomba] || 0) + 1;
      (perLomba[f.kode_lomba] ||= []).push(f);
    });

    /* Daftarnya per LOMBA, bukan per penilaian. Satu slip adalah satu lomba
       (bagian 11.5): Pembidaian punya lima kriteria di SATU kertas, dan
       menawarkan lima baris foto di sini berarti satu kertas yang sama bisa
       mendarat di lima kode berbeda.

       Ini juga yang membuat dua pintu bertemu. Layar Foto Jawaban menulis
       `kode_lomba` dari kelompokLomba() dan RPC `catat_foto_masuk` menolak
       kode yang bukan lomba pos itu (migrasi 0074). Selama dialog ini masih
       memakai slug PENILAIAN, foto yang diunggah borongan tidak akan pernah
       muncul di sini — dan justru dialog inilah yang dipakai memeriksa hasil
       penautan. */
    const lomba = kelompokLomba(kolom).map(l => [l.kode, l.nama]);

    /* Template BIASA, bukan tag html`` — sama alasannya dengan notif(): tag
       html`` meng-escape SETIAP sisipan, dan ikon("camera") adalah HTML yang
       memang harus dirender. Ditulis dengan html``, jalur SVG-nya tampil apa
       adanya sebagai teks hijau sepanjang tiga baris di dalam tombolnya.
       Yang datang dari luar tetap lewat esc() satu per satu. */

    /* DUA TOMBOL, bukan satu. Yang membedakannya cuma `capture` di tombol
       kiri, dan atribut itulah seluruh isi perbaikan ini.

       `<input type="file" accept="image/*">` telanjang menyerahkan pilihannya
       ke sistem: iOS memunculkan menu "Ambil Foto / Pustaka Foto / Pilih
       Berkas", sedangkan sebagian HP Android langsung membuka galeri tanpa
       menawarkan kamera sama sekali. Petugas pos yang mau memotret lembar di
       depannya jadi harus keluar aplikasi, memotret lewat aplikasi kamera,
       lalu kembali ke sini dan mencarinya di galeri.

       `capture="environment"` membuka kamera belakang langsung — tapi ia juga
       MENUTUP jalur galeri, jadi ia tidak bisa dipasang di satu-satunya
       tombol: foto yang sudah terlanjur diambil di luar aplikasi tidak akan
       bisa diunggah. Karena itu jalurnya dipisah jadi dua tombol yang namanya
       menyebut tujuannya, dan pilihannya jadi sama di Android maupun iPhone.

       `multiple` sengaja tetap ditulis di tombol Kamera walau kamera hanya
       mengembalikan satu foto: pada peramban yang mengabaikan `capture` —
       hampir semua peramban laptop — tombol itu jatuh kembali jadi pemilih
       berkas biasa, dan di sana memilih banyak sekaligus tetap berguna.

       IKON SAJA DI SINI, berbeda dengan layar Foto Jawaban yang menuliskan
       katanya. Bukan karena tempatnya sempit — melainkan karena pasangan ini
       BERULANG sekali per lomba. Lima "Kamera" dan lima "Galeri" bertumpuk di
       satu dialog cuma dibaca pada pasangan pertama; sisanya jadi keramaian
       yang mendorong tombolnya turun ke baris kedua di HP. Di layar Foto
       Jawaban pasangannya cuma satu dan barisnya lapang, jadi katanya gratis
       dan tetap ditulis.

       Namanya tidak hilang, cuma pindah: `title` untuk kursor di layar lebar,
       `aria-label` di input untuk pembaca layar — dan aria-label-nya menyebut
       nama lombanya, karena "Kamera" saja tidak memberi tahu kamera yang
       mana dari lima yang ada.

       TOMBOL "LIHAT" IKUT MASUK ke .f-aksi, tidak berdiri sebagai anak <li>
       sendiri. Ketiganya adalah satu kelompok tombol di kanan baris, dan
       barisnya sekarang grid dua kolom (lihat style.css) — satu area untuk
       tombol, bukan tiga anak yang bisa terpisah sendiri-sendiri. Selama ia
       di luar, baris yang sudah punya foto memuat nama + keterangan + Lihat
       di baris pertama dan MENDORONG pasangan Kamera/Galeri turun ke baris
       kedua. */
    const isi = `<ul class="foto-lomba">${lomba.map(([kode, nama]) => `
      <li data-kode="${esc(kode)}" data-nama="${esc(nama)}">
        <span class="f-nama">${esc(nama)}</span>
        <span class="f-jumlah" data-jumlah>${hitung[kode]
          ? `${esc(String(hitung[kode]))} foto` : "belum ada"}</span>
        <span class="f-aksi">
          <button type="button" class="button button-mini" data-lihat
            ${hitung[kode] ? "" : "hidden"}>Lihat</button>
          <label class="button button-mini button-primary" title="Kamera">
            <input type="file" accept="image/*" capture="environment" multiple
                   hidden data-ambil
                   aria-label="Foto ${esc(nama)} pakai kamera">${ikon("camera")}
          </label>
          <label class="button button-mini button-secondary" title="Galeri">
            <input type="file" accept="image/*" multiple hidden data-ambil
                   aria-label="Foto ${esc(nama)} dari galeri">${ikon("image")}
          </label>
        </span>
      </li>`).join("")}</ul>
`;

    // Sama seperti bukaRiwayat: dialog() menempelkan kartunya secara SINKRON,
    // jadi pendengarnya boleh dipasang sebelum janjinya ditunggu.
    const janji = dialog({
      judul: `Foto Jawaban · ${tiga} · ${namaRegu}`,
      kartuHtml: isi,
      labelAksi: "Tutup",
      bacaSaja: true,
    });

    const kartu = document.querySelector(".dialog .foto-lomba");
    if (kartu) {
      kartu.addEventListener("click", async (e) => {
        const b = e.target.closest("[data-lihat]");
        if (!b) return;
        const li = b.closest("li");
        const kode = li.dataset.kode, namaLomba = li.dataset.nama;
        if (!(perLomba[kode] || []).length) return;

        b.disabled = true;
        let daftar = [], peta = {};
        try {
          /* DIBACA ULANG dari server, bukan dari daftar yang dipegang layar.
             Dua sebabnya, dan keduanya soal `id`: baris yang baru diunggah di
             dialog ini belum punya id (catat_foto_lembar mengembalikan void),
             dan tombol silang butuh id. Sekalian daftarnya jadi mutakhir —
             foto yang dihapus petugas lain tidak muncul sebagai petak yang
             hilang begitu ditekan. */
          const semua = await daftarFotoLembar(pos.nomor, dada);
          daftar = semua.filter(f => f.kode_lomba === kode);
          perLomba[kode] = daftar;
          hitung[kode] = daftar.length;
          const jml = li.querySelector("[data-jumlah]");
          if (jml) jml.textContent = hitung[kode] ? `${hitung[kode]} foto` : "belum ada";
          if (!daftar.length) { b.hidden = true; b.disabled = false; return; }
          peta = await tautanFotoBanyak(daftar.map(f => f.path));
        } catch (err) {
          b.disabled = false;
          notif(`Foto tidak bisa dibuka: ${err.message}`, true);
          return;
        }
        b.disabled = false;

        /* Gambarnya dipasang langsung, tidak dibuka di tab baru satu per satu.
           Sembilan tab adalah sembilan kali menekan "kembali" di HP, dan
           urutannya hilang di antaranya.

           Tautan penuhnya TETAP ada di tiap gambar, dan karena seluruh tanda
           tangan sudah di tangan sebelum dialog ini digambar, membukanya tidak
           perlu await — jadi tidak ada window.open() sesudah await yang akan
           diblokir browser HP sebagai popup. */
        /* THUMBNAIL, bukan gambar penuh. Sembilan slip ukuran penuh adalah
           sembilan layar yang harus digulir sebelum yang dicari terlihat;
           petak kecil memperlihatkan kesembilannya sekaligus, dan yang perlu
           dibaca angkanya tinggal ditekan. */
        const petak = (f, i) => {
          const url = peta[f.path];
          const ke = daftar.length - i;            // terbaru dulu, jadi dihitung mundur
          const kapan = f.diunggah_pada ? tanggalJam(f.diunggah_pada) : "";
          const judul = `Foto ${ke} ${namaLomba}${kapan ? ` · ${kapan}` : ""}`;
          return `<li data-id="${esc(f.id)}" data-ke="${esc(String(ke))}"
                      data-putar="${esc(String(f.putaran || 0))}">
            ${url
              ? `<a class="fg-petak" href="${esc(url)}" target="_blank" rel="noopener"
                    title="${esc(judul)}">
                   <img src="${esc(url)}" alt="${esc(judul)}" loading="lazy"></a>`
              : `<span class="fg-petak fg-kosong">link gagal</span>`}
            <button type="button" class="fg-hapus" data-hapus
                    title="Hapus foto ${esc(String(ke))}"
                    aria-label="Hapus foto ${esc(String(ke))} ${esc(namaLomba)}"
              >&times;</button>
            <span class="fg-kapan">${esc(kapan)}</span>
          </li>`;
        };
        const galeri = daftar.map(petak).join("");

        const janjiGaleri = dialog({
          judul: `${namaLomba} · ${daftar.length} foto`,
          kartuHtml: `<ul class="foto-galeri">${galeri}</ul>`,
          bacaSaja: true,
          silangSaja: true,
          pasang: (el, tutup) => {
            const ul = el.querySelector(".foto-galeri");
            const judulEl = el.querySelector("h2");
            ul.addEventListener("click", async (ev) => {
              const x = ev.target.closest("[data-hapus]");
              if (!x) return;
              const petakLi = x.closest("li");
              const id = petakLi.dataset.id;

              /* ALASANNYA WAJIB, dan itu bukan formalitas: foto slip adalah
                 bukti, dipanggil justru ketika sebuah nilai dipertanyakan.
                 Menghapusnya menghapus kemampuan menjawab pertanyaan itu, dan
                 tidak ada satu pun galat yang muncul saat bukti hilang. RPC
                 0081 menolak alasan kosong; kotak ini cuma menanyakannya
                 sebelum perjalanan jaringan. */
              const jawab = await dialog({
                judul: `Hapus foto ${petakLi.dataset.ke} ${namaLomba}?`,
                kartuHtml: "<p>Fotonya hilang dari daftar dan dari penyimpanan.</p>",
                medan: [{ label: "Alasan menghapus", contoh: "misal: buram, difoto ulang" }],
                labelAksi: "Hapus Foto",
              });
              if (jawab === null) return;

              x.disabled = true;
              try {
                await hapusFotoLembar(id, jawab[0]);
              } catch (err) {
                x.disabled = false;
                notif(`Foto tidak bisa dihapus: ${err.message}`, true);
                return;
              }

              // Daftar di belakang dialog ini ikut disesuaikan, supaya
              // hitungannya tidak menyebut foto yang sudah tidak ada.
              perLomba[kode] = (perLomba[kode] || []).filter(f => f.id !== id);
              hitung[kode] = perLomba[kode].length;
              const barisAsal = kartu.querySelector(`li[data-kode="${CSS.escape(kode)}"]`);
              if (barisAsal) {
                const jml = barisAsal.querySelector("[data-jumlah]");
                if (jml) jml.textContent = hitung[kode] ? `${hitung[kode]} foto` : "belum ada";
                const lihat = barisAsal.querySelector("[data-lihat]");
                if (lihat) lihat.hidden = !hitung[kode];
              }

              petakLi.remove();
              /* Judulnya ikut turun. "9 foto" yang bertahan di atas galeri
                 berisi lima petak terbaca sebagai empat petak yang gagal
                 digambar — dan orang yang baru saja menghapus bukti akan
                 menghapus lagi untuk mengejar angka yang tidak akan bergerak. */
              if (judulEl) {
                judulEl.textContent = `${namaLomba} · ${ul.children.length} foto`;
              }
              notif("Foto dihapus.");
              if (!ul.children.length) tutup(null);
            });
          },
        });
        await janjiGaleri;
      });

      kartu.addEventListener("change", async (e) => {
        const inp = e.target.closest("[data-ambil]");
        if (!inp || !inp.files || !inp.files.length) return;
        const li = inp.closest("li");
        const kode = li.dataset.kode;
        const status = li.querySelector("[data-jumlah]");
        const berkas = [...inp.files];
        // Dikosongkan supaya memilih BERKAS YANG SAMA lagi tetap memicu change
        // — persis yang dilakukan orang setelah unggahan pertama gagal.
        inp.value = "";

        for (const f of berkas) {
          let blob;
          try {
            status.textContent = "mengecilkan…";
            blob = await kecilkanFoto(f);
          } catch (err) {
            status.textContent = err.message;
            continue;
          }
          try {
            status.textContent = `mengirim ${ukuranRapi(blob.size)}…`;
            const hasil = await unggahFotoLembar(
              pos.nomor, kode, li.dataset.nama, dada, blob);
            hitung[kode] = (hitung[kode] || 0) + 1;
            // Disisipkan DI DEPAN: daftarnya terbaru dulu, dan yang barusan
            // difoto adalah yang paling baru. Tanpa ini "Lihat" sesudah
            // mengunggah tidak memperlihatkan foto yang baru saja dikirim.
            (perLomba[kode] ||= []).unshift(
              { path: hasil.path, diunggah_pada: new Date().toISOString() });
            status.textContent = `${hitung[kode]} foto · ${ukuranRapi(blob.size)}`;
            const lihat = li.querySelector("[data-lihat]");
            if (lihat) lihat.hidden = false;
          } catch (err) {
            // Blob-nya sudah tidak dipegang, tapi berkas aslinya masih di
            // galeri HP — dan itulah antreannya. Petugas memilih ulang berkas
            // yang sama, dan input di atas sengaja sudah dikosongkan supaya
            // pilihan itu terbaca.
            status.textContent = `gagal — ${err.message}`;
            notif(`Foto ${tiga} ${li.dataset.nama} gagal terkirim: ${err.message}`, true);
          }
        }
      });
    }

    await janji;
  }

  /** "Nomor Dada 007." lalu pesannya, DUA BARIS.
   *
   *  Notifikasi ini muncul di bawah layar, terlepas dari baris yang gagal —
   *  angka telanjang di depan kalimat tidak memberi tahu angka APA, dan di
   *  lembar yang penuh angka itu justru yang paling perlu disebut namanya.
   *
   *  Dipatahkan, bukan digandeng dengan titik dua. Keduanya menjawab
   *  pertanyaan yang berbeda — baris MANA, lalu kotak mana di baris itu — dan
   *  sebagai satu kalimat panjang bagian pertamanya terbaca seperti awalan
   *  yang boleh dilewati. Yang mematahkannya `white-space: pre-line` di
   *  .notif-teks; tanpa aturan itu ganti barisnya cuma jadi spasi.  */
  const pesanBaris = (dada, pesan) =>
    `Nomor Dada ${dada3(dada)}.\n${kapital(pesan)}`;

  /* ---------- pita keadaan + kirim ulang sendiri ----------

     Dua hal yang tidak boleh diserahkan ke kewaspadaan petugas:

     1. MENGHITUNG sendiri berapa baris yang belum aman. Baris merah di
        tengah tabel 300 baris tidak akan terlihat oleh orang yang sedang
        menatap kolom Semaphore di baris ke-80.
     2. MENEKAN "Ulangi" satu per satu setelah internet kembali. Layar yang
        tahu koneksinya sudah pulih tapi menunggu diperintah hanya
        memindahkan pekerjaan ke orang yang paling sibuk di ruangan itu.  */

  const pita = document.getElementById("pos-simpan");
  let jamUlang = null;

  // Jam terakhir kali sesuatu BENAR-BENAR masuk database. Diisi saat lembar
  // dimuat, karena saat itu angka di layar memang baru dibaca dari sana.
  let jamSinkron = new Date();
  // Setiap request penyegaran dan setiap simpanan yang terkonfirmasi memajukan
  // versi ini. Respons hanya boleh menulis DOM bila versinya masih terbaru.
  let versiLembar = 0;

  function perbaruiRingkasan() {
    const baris = [...tbody.children];
    const belum = baris.filter(t => t.dataset.keadaan === "belum").length;
    const gagal = baris.filter(t => t.dataset.keadaan === "gagal").length;
    const sibuk = baris.some(t => t.dataset.keadaan === "menyimpan");
    const putus = !navigator.onLine;
    // Umurnya SELALU ikut, bukan hanya saat gagal. Capnya kini HH:MM (bentuk
    // baku, lihat util.js) dan tanpa detik dua simpanan dalam satu menit
    // terlihat identik — "barusan" yang menggantikannya sebagai tanda bahwa
    // pitanya memang masih hidup, dan sekaligus menjawab pertanyaan yang
    // sebenarnya: seberapa tua angka ini.
    const cap = `Sinkronisasi Terakhir: ${jamMenit(jamSinkron)} (${berapaLalu(jamSinkron)})`;

    if (gagal || putus) {
      pita.className = "pos-simpan bahaya";
      pita.removeAttribute("title");
      pita.textContent = putus
        ? `Internet putus — ${belum + gagal} baris belum tersimpan. Jangan tutup halaman ini. ${cap}.`
        // Kedua-duanya disebut. Pita yang hanya menghitung baris GAGAL sempat
        // menulis "1 baris" padahal ada dua yang belum aman di layar —
        // angka yang tidak lengkap justru menghapus gunanya sebagai jaminan.
        : `${gagal} baris gagal terkirim${belum ? ` dan ${belum} baris masih diketik` : ""}`
          + ` — jangan tutup halaman ini. ${cap}.`;
      if (gagal) jadwalkanUlang();
      return;
    }
    /* MENUNGGU diringkas seperti AMAN — ikon + jam, cuma warnanya kuning.
       Bentuknya sengaja SAMA PERSIS supaya lebarnya tidak bergerak: pitanya
       duduk di `.baris-pos` yang membungkus, jadi kalimat "1 baris belum
       tersimpan. Sinkronisasi Terakhir: 23:38 (barusan)" melebarkannya sampai
       tombol di sebelahnya terlempar ke baris berikutnya — dan seluruh tabel
       ikut turun, tepat saat petugas sedang mengetik di dalamnya. Layar yang
       bergeser sendiri di bawah jari lebih mahal daripada kalimat yang
       dijelaskannya.

       Kalimatnya tidak hilang tanpa ganti: baris yang bersangkutan SUDAH
       menyandang penanda "belum" di kolom statusnya sendiri, jadi jumlahnya
       terbaca dari tabel — pita ini cuma mengulanginya (bagian 9.3).

       MERAH TETAP PANJANG, dan itu bukan ketidakkonsistenan. Hanya ia yang
       berarti "ada nilai yang bisa hilang": ia menuntut tindakan, menyebut
       berapa baris yang terancam, dan melarang menutup halaman (bagian 9.4).
       Pergeseran layar sepadan untuk yang satu itu. */
    if (sibuk || belum) {
      pita.className = "pos-simpan menunggu ringkas";
      pita.title = sibuk ? `Menyimpan… ${cap}` : `${belum} baris belum tersimpan. ${cap}`;
      pita.innerHTML = `${ikon("circle-alert")}<span>${esc(jamMenit(jamSinkron))}</span>`;
      return;
    }
    /* Keadaan AMAN: ikon + jam. Ia tidak menuntut apa pun — satu-satunya fakta
       yang tidak bisa dibaca dari layar adalah KAPAN, dan itulah yang tersisa.

       "Data Tersimpan" mengulang apa yang sudah dikatakan warna hijau dan
       centangnya, dan pita ini dibaca ratusan kali per shift (bagian 9.1). */
    pita.className = "pos-simpan aman ringkas";
    pita.title = cap;
    pita.innerHTML = `${ikon("circle-check-big")}<span>${esc(jamMenit(jamSinkron))}</span>`;
  }

  function ulangYangGagal() {
    if (!document.body.contains(tbody)) return false;   // layar sudah ditinggalkan
    if (!navigator.onLine) return true;
    [...tbody.children]
      .filter(t => t.dataset.keadaan === "gagal")
      .forEach(t => simpanBaris(t));
    return true;
  }

  function jadwalkanUlang() {
    if (jamUlang) return;
    jamUlang = setInterval(() => {
      // Layar ini bisa ditinggalkan kapan saja; jam yang terus berdetak di
      // atas tabel yang sudah lepas dari halaman adalah kebocoran.
      if (!document.body.contains(tbody)
          || ![...tbody.children].some(t => t.dataset.keadaan === "gagal")) {
        clearInterval(jamUlang); jamUlang = null;
        return;
      }
      ulangYangGagal();
    }, 15000);
  }

  // Internet kembali: jangan menunggu putaran 15 detik berikutnya.
  // Keduanya dilepas saat layar ini ditinggalkan — termasuk saat dropdown
  // pemilih pos memanggil layar ini lagi, yang tidak lewat arahkan().
  const sinyalLayar = sinyalLayarBaru();
  window.addEventListener("online", ulangYangGagal, { signal: sinyalLayar });
  window.addEventListener("offline", perbaruiRingkasan, { signal: sinyalLayar });

  // Baris yang sudah berisi nilai memang berasal dari database — ✓-nya
  // benar sejak halaman dibuka, bukan hanya untuk yang diketik hari ini.
  [...tbody.children].forEach(tr => {
    if (Number(tr.dataset.terisi) > 0) statusBaris(tr, "tersimpan");
    gambarGembok(tr);
  });
  perbaruiRingkasan();

  async function simpanBaris(tr, beriTahu = false) {
    // Satu baris punya banyak kotak, dan tiap kotak yang ditinggalkan memicu
    // simpanan sendiri. Petugas yang mengetik cepat menghasilkan lima
    // panggilan beruntun, dan yang kedua sampai kelima datang selagi yang
    // pertama masih di jalan.
    //
    // MENOLAKNYA adalah kesalahan yang sempat ada di sini: barisnya tetap
    // diberi ✓ hijau — karena simpanan pertama memang berhasil — sementara
    // empat angka berikutnya tidak pernah terkirim. Petugas melihat tanda
    // berhasil untuk nilai yang hilang. Jadi yang datang saat sibuk DIANTRE,
    // lalu dijalankan sekali lagi sesudahnya; putaran kedua membaca ulang
    // seluruh baris, sehingga berapa pun ketukan yang menumpuk cukup
    // diselesaikan satu kali.
    if (tr.dataset.jalan === "1") { tr.dataset.antre = "1"; return; }
    const dada = Number(tr.dataset.dada);
    // Baris tergembok tidak pernah dikirim. Kotaknya memang sudah mati, tapi
    // simpanBaris juga dipanggil dari antrean dan dari tombol Ulangi. Tombol
    // itu harus menjelaskan jalan keluarnya; putaran otomatis tetap diam agar
    // tidak menyemburkan notifikasi setiap 15 detik.
    if (tr.dataset.terkunci === "1") {
      const pesan = "Nilai sudah dikunci. Buka kunci sebelum mengirim ulang.";
      statusBaris(tr, "gagal", pesan);
      if (beriTahu) notif(pesanBaris(dada, pesan), true);
      return;
    }
    const lama = asli.get(dada) || {};
    const baris = [], dihapus = [], takTerbaca = [];

    for (const k of komponenBaris(tr)) {
      const baru = bacaSel(tr, k);
      const ada = lama[k.kode] || null;
      // Kotak berisi sesuatu yang tidak terbaca: JANGAN disentuh sama sekali.
      // Bukan dikirim, dan bukan pula dianggap kosong — angka lamanya tetap di
      // tempatnya sampai petugas membetulkan ketikannya.
      if (baru === TIDAK_SAH) { takTerbaca.push(k.name); continue; }
      if (baru === null) {
        // Kotak dikosongkan padahal sebelumnya ada isinya = angka itu masuk ke
        // regu yang salah. Dihapus, bukan ditimpa nol.
        if (ada) dihapus.push(k.kode);
        continue;
      }
      const samaSaja = ada
        && Number(ada.nilai_1) === baru.nilai_1
        && (ada.nilai_2 === null || ada.nilai_2 === undefined
              ? null : Number(ada.nilai_2)) === baru.nilai_2;
      if (!samaSaja) {
        baris.push({ nomor_dada: dada, kode: k.kode,
                     nilai_1: baru.nilai_1, nilai_2: baru.nilai_2 });
      }
    }
    // Ada kotak yang tidak terbaca: barisnya berakhir MERAH, bukan hijau.
    //
    // Yang sah tetap dikirim — memaksa petugas mengetik ulang kotak yang sudah
    // benar karena satu kotak lain salah adalah hukuman yang tidak perlu. Tapi
    // barisnya tidak boleh terlihat selesai selama masih ada yang salah, dan
    // merahnya juga yang menahan penyegaran 20 detik agar tidak menghapus
    // ketikan yang sedang dibetulkan (baris "gagal" termasuk sibuk).
    const pesanTakTerbaca = takTerbaca.length
      ? `${takTerbaca.join(", ")}: isinya bukan angka/waktu yang bisa dibaca. `
        + `Angka lamanya TIDAK diubah.`
      : null;

    if (pesanTakTerbaca && !baris.length && !dihapus.length) {
      statusBaris(tr, "gagal", pesanTakTerbaca);
      notif(pesanBaris(dada, pesanTakTerbaca), true);
      return;
    }

    // Tidak ada yang berubah — misalnya angka diketik ulang sama persis.
    // Barisnya dikembalikan ke keadaan istirahat, BUKAN ditinggalkan dalam
    // keadaan "belum": tanda kuning yang tidak akan pernah hilang sendiri
    // mengajari petugas mengabaikan tanda kuning.
    if (!baris.length && !dihapus.length) {
      statusBaris(tr, Number(tr.dataset.terisi) > 0 ? "tersimpan" : "");
      return;
    }

    tr.dataset.jalan = "1";
    statusBaris(tr, "menyimpan");
    try {
      if (baris.length) {
        const hasil = await simpanNilaiPos(baris, pos.nomor);
        // Server memeriksa ulang tiap baris dan menolaknya satu per satu;
        // yang pertama ditolak sudah cukup menjelaskan apa yang salah.
        const ditolak = (hasil || []).find(x => x.status === "ditolak");
        if (ditolak) throw new ErrorApi(ditolak.alasan || "nilai ditolak server");
      }
      for (const kode of dihapus) await hapusNilaiPos(dada, kode, pos.nomor);

      const segar = await lembarPosSatu(pos.nomor, dada);
      // Membatalkan snapshot lembar penuh yang mulai diambil sebelum simpanan
      // ini selesai. Tanpa ini respons lama bisa menimpa angka yang baru saja
      // dikonfirmasi dari database.
      versiLembar += 1;
      if (segar) {
        asli.set(dada, segar.nilai || {});
        tr.querySelector(".pos-nilai").textContent = angkaRapi(segar.nilai_pos);
        tr.dataset.terisi = String(segar.jumlah_terisi);
      }
      // Cap waktunya dipasang DI SINI, bukan saat permintaan dikirim: yang
      // dijanjikan cap itu adalah "sudah ada di database", dan yang
      // membuktikannya adalah baris yang barusan dibaca kembali dari sana.
      jamSinkron = new Date();
      if (pesanTakTerbaca) {
        statusBaris(tr, "gagal", pesanTakTerbaca);
        notif(pesanBaris(dada, pesanTakTerbaca), true);
      } else {
        statusBaris(tr, Number(tr.dataset.terisi) > 0 ? "tersimpan" : "");
      }
      hitungUlangJumlah();
    } catch (err) {
      statusBaris(tr, "gagal", err.message);
      notif(pesanBaris(dada, err.message), true);
    } finally {
      tr.dataset.jalan = "";
      // Ketukan yang menumpuk selagi baris ini sibuk. Dijalankan juga setelah
      // GAGAL: yang tersimpan sebagian lalu ditinggalkan adalah keadaan
      // terburuk dari semuanya.
      if (tr.dataset.antre === "1") { tr.dataset.antre = ""; simpanBaris(tr); }
    }
  }

  /* ---------- perilaku isian ---------- */

  // Ditandai sejak KETUKAN PERTAMA, bukan menunggu kotaknya ditinggalkan.
  // Di antara keduanya bisa lewat semenit — petugas mengetik lalu menoleh ke
  // lembar berikutnya — dan selama semenit itu angkanya hanya ada di layar.
  tbody.addEventListener("input", (e) => {
    const tr = e.target.closest("tr");
    if (tr && tr.dataset.jalan !== "1") statusBaris(tr, "belum");
  });

  tbody.addEventListener("change", (e) => {
    const tr = e.target.closest("tr");
    if (tr) simpanBaris(tr);
  });

  // Mengetik ulang angka yang sama memicu `input`, tetapi browser tidak
  // selalu memicu `change`: nilai ketika fokus masuk dan keluar tetap sama.
  // Selesaikan penanda kuning saat kotaknya ditinggalkan. Pagar `belum`
  // mencegah focusout mengantrekan simpanan kedua ketika `change` sudah lebih
  // dulu menjalankan simpanBaris().
  tbody.addEventListener("focusout", (e) => {
    const tr = e.target.closest("tr");
    if (tr?.dataset.keadaan === "belum") simpanBaris(tr);
  });

  /* ISI KOTAK DIPILIH SAAT DIKETUK, jadi ketukan pertama MENGGANTI.

     Kotak nilai tidak pernah dimaksudkan untuk DITAMBAHI — tidak ada juri yang
     bermaksud "sambung angka ini ke angka yang sudah ada". Tanpa seleksi,
     mengetuk kotak berisi 1 lalu menekan 8 menghasilkan 18, dan di situlah
     bahayanya: untuk Bidai yang rentangnya 0-20, 18 adalah angka SAH. Server
     menerimanya, tidak ada yang memerah, dan yang tersimpan bukan yang
     dimaksud siapa pun.

     Di Semaphore (0-5) kesalahan yang sama tertolak dan terlihat. Justru itu
     yang membuatnya berbahaya di tempat lain: ia hanya senyap di kolom yang
     rentangnya cukup lebar untuk menampung angka gabungan.

     Hanya saat DIKETUK. Mengetik beruntun di kotak yang sedang dipegang tidak
     terganggu — "12" untuk Menaksir tetap 12, karena seleksi cuma terjadi
     sekali saat fokus masuk, bukan tiap ketukan.

     Lewat setTimeout dengan alasan yang sama dengan kotak jam: Safari iOS
     membatalkan select() yang dipanggil di dalam penanganan focus itu sendiri. */
  tbody.addEventListener("focusin", (e) => {
    const el = e.target;
    if (el.tagName !== "INPUT" || el.type === "checkbox" || !el.value) return;
    setTimeout(() => {
      if (document.activeElement === el) { try { el.select(); } catch { /* abaikan */ } }
    }, 0);
  });

  /* Kotak waktu: dirapikan dan diperiksa saat DITINGGALKAN.

     Satu kotak yang menerima "32" maupun "1:10" punya satu kelemahan yang
     tidak dimiliki dua kotak angka: isinya bisa BUKAN waktu. "1:75" terbaca
     wajar oleh mata, tapi bukan waktu mana pun, dan bacaSel() menolaknya
     dengan mengembalikan null — yang di jalur simpan berarti "kotak kosong",
     alias tidak dikirim.

     Tanpa penanda, itu jenis kegagalan yang paling buruk: petugas mengetik
     angka, tidak ada yang merah, tidak ada yang gagal, dan nilainya tidak
     pernah ada. Jadi kotaknya diberi aria-invalid, yang sudah punya gaya merah
     sendiri di style.css dan sekaligus terbaca pembaca layar.

     Dirapikan saat blur, bukan tiap ketukan: menata angka sementara orang
     masih mengetiknya memindahkan kursor di bawah jarinya. Pola dan alasannya
     sama dengan pasangKotakJam() di util.js. */
  tbody.addEventListener("focusout", (e) => {
    const el = e.target;
    if (!el.classList || !el.classList.contains("input-waktu")) return;
    const kosong = !el.value.trim();
    const detik = detikSah(el.value);
    if (kosong) el.removeAttribute("aria-invalid");
    else if (detik === null) el.setAttribute("aria-invalid", "true");
    else {
      // "32" jadi "00:32", "95" jadi "01:35" — bentuk yang sama dengan yang
      // digambar ulang dari database, supaya menyimpan baris yang tidak
      // disentuh tidak pernah terlihat sebagai perubahan.
      el.value = detikTeks(detik);
      el.removeAttribute("aria-invalid");
    }
  });

  // Merah hilang begitu isinya jadi waktu yang sah — menunggu blur untuk
  // memadamkan peringatan membuat petugas mengira ketikan barunya juga salah.
  tbody.addEventListener("input", (e) => {
    const el = e.target;
    if (!el.classList || !el.classList.contains("input-waktu")) return;
    if (detikSah(el.value) !== null || !el.value.trim()) {
      el.removeAttribute("aria-invalid");
    }
  });

  // Enter = turun satu regu di kolom yang sama, seperti menyalin dari kertas
  // ke bawah. Berpindah fokus memicu change-nya sendiri, jadi barisnya
  // tersimpan tanpa perlu dipanggil dua kali.
  tbody.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.target.tagName !== "INPUT") return;
    e.preventDefault();
    const tr = e.target.closest("tr");
    const tujuan = kotakBerikutnyaDalamKolom(tr, e.target);
    if (tujuan) { tujuan.focus(); if (tujuan.select) tujuan.select(); }
    else e.target.blur();
  });

  /* ---------- cari & saring ---------- */

  // Baris DISEMBUNYIKAN, bukan dibangun ulang. Menggambar ulang tabel akan
  // membuang isi kotak yang belum sempat tersimpan — dan petugas tidak akan
  // sadar angkanya hilang, karena yang ia lihat hanyalah daftar yang menyusut.
  const cocok = (tr, cari) => !cari
    || tr.dataset.dada.padStart(3, "0").includes(cari)
    || tr.children[1].textContent.toLowerCase().includes(cari)
    || tr.children[2].textContent.toLowerCase().includes(cari);

  // Pembanding wajib jumlah komponen BARIS ITU, bukan jumlah kolom tabel.
  // Regu Internal di Pos 1 punya dua komponen sementara tabelnya berkolom
  // lima — dibandingkan dengan lima, regu itu tidak pernah bisa "lengkap",
  // dan saringan "Belum lengkap" ikut menampilkannya terus.
  const lengkap = (tr) =>
    Number(tr.dataset.terisi) >= Number(tr.dataset.komponen);

  function hitungUlangJumlah() {
    const baris = [...tbody.children];
    const tampil = baris.filter(tr => !tr.hidden).length;
    // SATU pecahan. "47/53 lengkap" dibuang karena chip di sebelahnya sudah
    // menjawabnya: dengan saringan "Belum lengkap" menyala, yang ditampilkan
    // ITULAH yang belum lengkap — 6/53 dan 47/53 adalah angka yang sama
    // dibaca dari dua arah. Dua pecahan bersebelahan justru menuntut orang
    // memeriksa mana yang mana sebelum bisa membacanya.
    document.getElementById("tabel-jumlah").textContent =
      `${tampil}/${baris.length} ditampilkan`;
  }

  /* ---------- cetak lembar kosong ---------- */

  // Form Tabel mencetak baris yang SEDANG TAMPIL, bukan selalu semuanya.
  // Dua kebutuhan berbeda terlayani satu tombol: sebelum lomba cetak "Semua"
  // untuk lembar kosong, dan di tengah lomba saring "Belum lengkap" dulu
  // supaya kertas susulan hanya memuat regu yang memang belum dinilai.
  //
  // Form per Lomba tidak membaca baris sama sekali. Ia adalah master kosong
  // yang bentuk dan jumlah halamannya ditentukan konfigurasi lomba di pos;
  // belum adanya satu pun regu tidak boleh menghalangi pencetakannya.
  /* TIDAK async, dan itu disengaja. `window.print()` di bawah harus tetap
     berada dalam giliran event tap — Safari iPhone memblokirnya kalau ada
     `await` lebih dulu, dan yang terlihat cuma tombol yang tidak melakukan
     apa-apa. Fungsi biasa membuat pelanggarannya jadi galat sintaks, bukan
     bug yang cuma muncul di iPhone orang lain. */
  const cetak = (slip) => {
    if (slip) {
      // Yang dicetak MASTER, bukan tumpukannya — jadi daftar ulang yang belum
      // ditutup tidak berpengaruh di sini, dan jumlah regu yang sedang tampil
      // pun tidak. Blangkonya kosong; berapa banyak yang dibutuhkan diputuskan
      // di mesin fotokopi, bukan di layar ini.
      const n = siapkanCetakBlangko(pos, kolom);
      // Nol berarti pos ini seluruhnya lomba soal — dijawab di lembar soalnya
      // sendiri, jadi tidak ada blangko yang perlu dicetak. Tanpa cabang ini
      // browser membuka dialog cetak untuk halaman kosong, dan yang menekan
      // tombolnya menyimpulkan bahwa pencetakannya rusak.
      if (!n) {
        notif("Pos ini seluruhnya lomba soal — dijawab di lembar soalnya "
              + "sendiri, jadi tidak ada blangko yang perlu dicetak.", true);
        return;
      }
      notif(`${n} master A5 melintang, satu per lomba.`);
      window.print();
      return;
    }

    const tampil = [...tbody.children].filter(tr => !tr.hidden)
      .map(tr => lembar.find(r => Number(r.nomor_dada) === Number(tr.dataset.dada)))
      .filter(Boolean);
    if (!tampil.length) { notif("Tidak ada baris yang bisa dicetak.", true); return; }

    /* NOMOR DADA BERURUTAN 001 SAMPAI BATAS STOK, TANPA LOMPATAN.

       Dua sebab, dan yang kedua yang menentukan.

       Tim IT menyortir tumpukan slip menurut nomor dada lalu menyusurinya dari
       atas. Lembar yang melompati satu nomor menghentikan pekerjaan itu:
       "slip 012 hilang, atau memang tidak pernah ada?" — pertanyaan yang tidak
       bisa dijawab dari kertas.

       Dan sebagian sekolah MENDAFTAR OFFLINE. Regunya memakai nomor dada fisik
       yang nyata, tetapi belum ada di database saat lembar ini dicetak. Kalau
       lembarnya hanya memuat regu yang sudah terdaftar, regu itu tidak punya
       baris sama sekali — dan nilainya ditulis di pinggir kertas, atau tidak
       ditulis. Barisnya karena itu dicetak kosong dan siap ditulisi.

       Batasnya diambil dari STOK nomor dada, bukan dari regu terdaftar: stok
       adalah nomor fisik yang benar-benar dibawa panitia, dan mana pun di
       antaranya bisa muncul di kotak penilaian.

       HANYA saat tidak ada saringan. Lembar susulan justru dicetak untuk
       sebagian regu — menyisipkan seluruh nomor kosong ke dalamnya
       mengembalikan tumpukan kertas yang tadi sengaja dipersempit. */
    let semua = tampil;
    if (!slip && rentangStok && [...tbody.children].every(tr => !tr.hidden)) {
      const peta = new Map(tampil.map(r => [Number(r.nomor_dada), r]));
      semua = nomorStok(rentangStok).map(
        n => peta.get(n) || { nomor_dada: n, kosong: true });
    }

    siapkanCetakLembarPos(pos, kolom, semua);
    window.print();
  };

  document.getElementById("cetak-lembar")
    .addEventListener("click", () => cetak(false));

  // Tombolnya ada di SEMUA pos, termasuk yang berlomba satu. Di Pos 4 dan
  // Pos 5 slipnya memang cuma satu per regu, tapi bentuknya tetap berbeda dari
  // tabel — dan alur kotak penilaian berlaku di sana juga.
  document.getElementById("cetak-per-lomba")
    .addEventListener("click", () => cetak(true));

  const terapkanSaringan = pasangAlatTabel((cari, saring) => {
    [...tbody.children].forEach(tr => {
      // `fotoKurang` kosong berarti BELUM DIKETAHUI, bukan lengkap: saringan
      // "Belum Foto" lalu tidak menuduh siapa pun, dan "Lengkap" berhenti
      // menilai fotonya alih-alih menyatakan lengkap tanpa dasar.
      const fotoKurang = tr.dataset.fotoKurang === "1";
      const fotoTahu = tr.dataset.fotoKurang !== "";
      const lolosSaring =
        saring === "semua" ? true
        : saring === "belum-input" ? !lengkap(tr)
        : saring === "belum-foto" ? fotoKurang
        : lengkap(tr) && !(fotoTahu && fotoKurang);
      tr.hidden = !(cocok(tr, cari) && lolosSaring);
    });
    hitungUlangJumlah();
  });

  pasangPilihPos(s);

  /* ==========================================================================
     LEMBAR INI MENYEGARKAN DIRINYA SENDIRI.

     Satu akun operator per pos, dipakai di HP mana pun yang ada di pos itu —
     jadi dua orang membuka lembar yang sama adalah kejadian biasa, bukan
     kasus ganjil. Sampai sekarang lembar ini hanya membaca ulang BARIS YANG
     IA SIMPAN SENDIRI; segala yang masuk dari HP sebelah tidak pernah muncul.

     Yang paling berbahaya bukan angkanya tidak terlihat, melainkan
     akibatnya saat menghapus. `asli` adalah cermin keadaan database, dan
     penghapusan dijalankan HANYA untuk komponen yang ada di cermin itu
     (`if (ada) dihapus.push(...)`). Nilai yang masuk dari HP lain setelah
     halaman ini dibuka tidak ada di cermin — jadi mengosongkan kotaknya tidak
     menghapus apa pun. Petugas melihat kotak kosong, menekan simpan, mendapat
     centang hijau, dan angka yang ia kira sudah dibuang masih di database.

     Menyegarkan lembar penuh angka yang sedang diketik jelas berisiko, jadi
     baris DILEWATI kalau ia sedang disentuh:

       - ada kursor di dalamnya          -> orangnya sedang mengetik
       - keadaan "belum"/"menyimpan"     -> ada ketikan yang belum sampai
       - keadaan "gagal"                 -> pesan galatnya belum dibaca
       - sedang jalan / mengantre        -> simpanBaris yang mengurusnya

     Baris yang dilewati akan tersegarkan sendiri begitu tersimpan, karena
     jalur simpan memang membaca ulang barisnya. Jadi tidak ada baris yang
     tertinggal basi selamanya — yang ada hanya baris yang menunggu gilirannya.
     ========================================================================== */
  const segarkanLembar = async () => {
    const versiPermintaan = ++versiLembar;
    let baru;
    try { baru = await lembarPos(pos.nomor); }
    catch { return; }   // pos sering kehilangan sinyal; percobaan berikutnya 20 detik lagi
    if (location.hash !== layarIni || versiPermintaan !== versiLembar) return;

    const peta = new Map(baru.map(r => [Number(r.nomor_dada), r]));
    let berubah = false;

    for (const tr of tbody.children) {
      const sibuk = tr.dataset.jalan === "1" || tr.dataset.antre === "1"
        || ["belum", "menyimpan", "gagal"].includes(tr.dataset.keadaan || "")
        || tr.contains(document.activeElement);
      if (sibuk) continue;

      const r = peta.get(Number(tr.dataset.dada));
      if (!r) continue;

      asli.set(Number(r.nomor_dada), r.nilai || {});
      // Gembok yang dipasang dari HP lain menyusul lewat penyegaran ini —
      // paling lama 20 detik, dan server tetap menolak lebih cepat dari itu.
      const kunciBaru = r.terkunci ? "1" : "";
      if (tr.dataset.terkunci !== kunciBaru) {
        tr.dataset.terkunci = kunciBaru;
        gambarGembok(tr);
      }
      if (tr.dataset.terisi !== String(r.jumlah_terisi)) berubah = true;
      tr.dataset.terisi = String(r.jumlah_terisi);
      tr.querySelector(".pos-nilai").textContent = angkaRapi(r.nilai_pos);

      // Kotaknya ditulis ulang hanya kalau isinya memang berbeda. Menyetel
      // .value ke teks yang sama pun sudah cukup untuk memindahkan kursor di
      // sebagian browser, dan baris ini bisa saja baru saja ditinggalkan.
      for (const kol of kolom) {
        const k = varianUntuk(kol, tr.dataset.golongan);
        if (!k) continue;
        const nilai = (r.nilai || {})[k.kode];
        const kotak = tr.querySelectorAll(`[data-kode="${CSS.escape(k.kode)}"]`);
        if (!kotak.length) continue;

        if (k.form === "biner") {
          const centang = !!(nilai && Number(nilai.nilai_1) > 0);
          if (kotak[0].checked !== centang) kotak[0].checked = centang;
        } else if (k.form === "benar_kurang_salah") {
          const b = nilaiTeks(k, nilai ? nilai.nilai_1 : null);
          const sa = nilaiTeks(k, nilai ? nilai.nilai_2 : null);
          if (kotak[0].value !== b) kotak[0].value = b;
          if (kotak[1] && kotak[1].value !== sa) kotak[1].value = sa;
        } else {
          // detik, meter, dan kotak angka biasa memakai satu penulis yang
          // sama dengan selKomponen — kalau tidak, penyegaran 20 detik bisa
          // menulis ulang kotak dengan bentuk yang berbeda dari yang tadi
          // digambar, dan kotak yang berubah sendiri terbaca seperti nilai
          // yang berubah sendiri.
          const v = nilaiTeks(k, nilai ? nilai.nilai_1 : null);
          if (kotak[0].value !== v) kotak[0].value = v;
        }
      }

      statusBaris(tr, Number(tr.dataset.terisi) > 0 ? "tersimpan" : "");
    }

    jamSinkron = new Date();
    // Angka "sudah lengkap" ikut, tapi SARINGANNYA tidak dijalankan ulang.
    // Baris yang jadi lengkap sementara petugas menyaring "Belum lengkap"
    // tetap terlihat sampai ia menyentuh saringan lagi — dan itu disengaja:
    // baris yang lenyap sendiri dari bawah jari orang yang sedang mengetik
    // lebih membingungkan daripada satu baris yang tertinggal sebentar.
    if (berubah) hitungUlangJumlah();
    perbaruiRingkasan();
  };

  // Denyut yang membersihkan dirinya sendiri, pola yang sama dengan layar
  // Rekapitulasi: berhenti saat pindah layar atau tab disembunyikan, dan
  // dinyalakan lagi oleh kepulangan itu sendiri lewat segarkanDiTempat.
  let denyut = null;
  const mulaiDenyut = () => {
    if (denyut !== null) return;
    denyut = setInterval(() => {
      if (location.hash !== layarIni || document.hidden) {
        clearInterval(denyut); denyut = null; return;
      }
      segarkanLembar();
    }, 20000);
  };
  aturSegarkanDiTempat(() => { segarkanLembar(); mulaiDenyut(); });
  mulaiDenyut();
}

/** Pemilih pos — hanya untuk admin. Operator pos melihat namanya saja, karena
 *  memberinya daftar pos lain hanya menawarkan sesuatu yang pasti ditolak
 *  server (RLS nilai_mentah) — pintu yang terkunci lebih baik tidak digambar.
 *
 *  Yang muncul HANYA pos yang benar-benar dinilai. Pos 0 (Keberangkatan) dan
 *  Pos 6 (Kedatangan) adalah garis start dan garis finish; yang dicatat di
 *  sana waktu, lewat layar Keberangkatan dan Kedatangan. Menawarkannya di
 *  sini berarti menawarkan lembar yang tidak akan pernah punya kolom — dan
 *  daftar yang memuat pilihan tanpa isi mengajari orang bahwa daftar itu
 *  tidak bisa dipercaya. */
export function pilihPosHtml(s, semuaPos) {
  /* Yang menentukan pemilih ini muncul BUKAN nama peran, melainkan apakah
     akunnya terkunci ke satu pos — dan itu kolom `pos`, bukan `peran`.

     Sebelumnya berbunyi `peran !== "admin"`, dan itu diam-diam mengunci
     Koordinator Pos ke pos pertama: ia tidak punya pos (justru itu gunanya),
     jadi layarnya jatuh ke posDinilai[0] tanpa satu pun cara berpindah.
     Pola yang sama juga akan menjerat akun mana pun yang diberi centang `pos`
     lewat matriks Akun tanpa berperan admin (bagian 13.1). */
  if (s.pos != null && s.pos !== "") return "";
  const dinilai = semuaPos.filter(p => Number(p.jumlah_komponen) > 0);
  return `
    <div class="field pilih-pos-field">
      <label for="pilih-pos" class="visually-hidden">Pos yang diinput</label>
      <select id="pilih-pos" class="select-small">
        ${dinilai.map(p => `<option value="${esc(p.nomor)}"
          ${Number(p.nomor) === Number(posDipilih.nomor) ? "selected" : ""}
          >${esc(judulPos(p))}</option>`).join("")}
      </select>
    </div>`;
}

export function pasangPilihPos(s) {
  /* Syaratnya HARUS sama persis dengan pilihPosHtml() di atas. Kalau yang satu
     menggambar pemilihnya dan yang satu menolak memasang pendengarnya,
     hasilnya dropdown yang bisa diklik, berubah pilihannya, dan tidak
     melakukan apa pun — bentuk kegagalan yang paling sulit dilaporkan orang,
     karena layarnya terlihat baik-baik saja.

     Karena itu keduanya tidak memeriksa apa pun sendiri: `sel` hanya ada
     kalau pilihPosHtml() memang menggambarnya. */
  const sel = document.getElementById("pilih-pos");
  if (!sel) return;
  sel.addEventListener("change", () => {
    posDipilih.nomor = Number(sel.value);
    layarInputPos();
  });
}
