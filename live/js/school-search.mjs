/* ============================================================================
   hrcd-rekap : school-search.mjs — pencocokan nama sekolah untuk autocomplete
   form pendaftaran.

   Murni perhitungan: tidak membaca DOM dan tidak memanggil server. Karena itu
   aturan yang sama bisa diuji di Node dan dipakai `daftar.js`.

   KENAPA BUKAN `includes()` LAGI

   Sampai 27 Agustus 2026 pencariannya satu baris: nama sekolah dan ketikan
   sama-sama dirapatkan jadi satu kata tanpa spasi, lalu `includes()`. Bentuk
   itu menuntut ketikan menjadi POTONGAN UTUH dari namanya, dan pembina tidak
   mengetik begitu — dilaporkan dari lapangan:

       ketik "SMA 2"  ->  "sma2"        (ketikan)
                          "sman2ciamis" (SMAN 2 Ciamis di database)

   `"sman2ciamis".includes("sma2")` bernilai false karena satu huruf `n` di
   tengah, jadi sekolahnya seolah tidak terdaftar — dan pembina mendaftarkan
   ulang sebagai baris baru. Persis itu yang terjadi: `sma 2 ciamis` dengan
   alamat `jl ahmad yani` sekarang duduk di sebelah `SMAN 2 Ciamis`, dan baris
   kembar memecah pencarian, rekap, dan identitas pendaftaran (CLAUDE.md 12.9).

   Huruf `N` itu justru yang paling sering hilang: orang menyebut sekolahnya
   "SMA 2", bukan "SMA Negeri 2". Yang salah bukan ketikannya — yang salah
   pencarian yang menuntut ketikan berurutan huruf demi huruf.

   GANTINYA: PER KATA, BUKAN PER POTONGAN

   Ketikan dipecah jadi kata, dan tiap kata cukup jadi AWALAN salah satu kata
   di nama sekolah. "sma" adalah awalan "sman", jadi "sma 2" menemukan
   "SMAN 2 Ciamis" tanpa satu pun aturan khusus tentang huruf N.

   DUA KUNCI, DAN JANGAN TERTUKAR (CLAUDE.md 12.10)

   - `kunciSekolah()` menjawab "ini sekolah yang SAMA?" dan harus sama persis
     dengan `kunci_sekolah()` di database (migrasi 0062). Sengaja jinak.
   - `cariSekolah()` menjawab "ini yang mungkin DIMAKSUD?" dan boleh jauh
     lebih longgar: hasilnya cuma daftar saran yang dibaca manusia, dan yang
     dipilih tetap baris database beserta id-nya.

   Melonggarkan yang pertama akan melebur dua sekolah yang berbeda. Yang kedua
   paling buruk memunculkan satu saran yang tidak diklik siapa pun.
   ========================================================================== */

/** Ketikan sependek ini menyaring terlalu sedikit: satu huruf mencocokkan
 *  ratusan sekolah, dan daftar saran yang panjang sama tidak bergunanya
 *  dengan daftar yang kosong. */
const MIN_KETIKAN = 2;

/** Kata yang seluruhnya angka: nomor sekolah, dan itu dicocokkan utuh. */
const ANGKA = /^[0-9]+$/;

/**
 * Penyamaan untuk MENYIMPAN — cerminan `kunci_sekolah()` di database.
 *
 * Urutan penggantinya ikut dicerminkan, bukan cuma hasilnya: huruf status
 * Dapodik dibuang SELAGI spasinya masih ada, karena `^(sma)s\b` tidak akan
 * pernah cocok kalau spasinya sudah lebih dulu dirapatkan.
 *
 * Yang disamakan cuma yang PASTI sama: besar-kecil huruf, tanda baca, bentuk
 * "Negeri", dan huruf status Swasta. `SMAT` (Terpadu) dan `SMAI` (Islam)
 * sengaja dibiarkan — membuang T dari "SMA Terpadu X" akan menyamakannya
 * dengan "SMA X", dan itu bisa saja dua sekolah yang berbeda.
 */
export function kunciSekolah(nama) {
  return String(nama ?? "").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    // "SMP Negeri 1" dan "SMP N 1" adalah "SMPN 1".
    .replace(/\b(sd|smp|sma|smk|mi|mts|ma)\s+n(egeri)?\b/g, "$1n")
    // Huruf status Dapodik di AWAL nama: SMKS, SMAS, SMPS, MAS, MTsS, MIS.
    // "S" itu Swasta — status, bukan nama.
    .replace(/^(sd|smp|sma|smk|mi|mts|ma)s\b/, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Kata-kata untuk PENCARIAN.
 *
 * Sama dengan `kunciSekolah()`, ditambah satu hal: angka dipisahkan dari
 * huruf. "SMAN2" yang diketik tanpa spasi jadi kata yang sama dengan
 * "SMAN 2", dan angkanya bisa dibandingkan sebagai angka utuh — tanpa itu
 * "sman2" tidak akan pernah cocok dengan "sman 2 ciamis".
 */
export function kataSekolah(teks) {
  return kunciSekolah(teks)
    .replace(/([a-z])([0-9])/g, "$1 $2")
    .replace(/([0-9])([a-z])/g, "$1 $2")
    .split(" ")
    .filter(Boolean);
}

/**
 * Seberapa jauh sebuah nama sekolah dari ketikannya.
 *
 * Kecil berarti mirip; `-1` berarti tidak cocok sama sekali. Angkanya cuma
 * dipakai untuk MENGURUTKAN saran, jadi yang penting arahnya, bukan skalanya:
 *
 *   0  tiap kata yang diketik ada persis di namanya
 *   1  per kata yang cuma jadi awalan  ("sma" -> "sman")
 *   1  per kata yang merapatkan beberapa kata  ("almut" -> "Al-Muttaqin")
 *   2  per kata yang justru LEBIH PANJANG daripada kata di namanya
 *      (hanya kalau kata di namanya minimal tiga huruf)
 *
 * Yang ketiga terbalik dari yang kedua dan tetap dihitung cocok, karena
 * database sudah terlanjur memuat baris yang ditulis lebih pendek daripada
 * nama resminya. Pembina yang mengetik "SMAN 2 Ciamis" dengan benar tetap
 * harus melihat baris `sma 2 ciamis` yang sudah ada — kalau tidak, ia
 * membuat baris kembar yang KETIGA. Ia diberi skor lebih besar supaya duduk
 * di bawah yang ejaannya benar.
 *
 * Satu kata di nama sekolah hanya boleh dipakai satu kali, supaya ketikan
 * "ciamis ciamis" tidak cocok dengan "SMAN 1 Ciamis".
 *
 * ANGKA DICOCOKKAN UTUH, huruf boleh sepotong. Nomor sekolah adalah namanya,
 * bukan awalan namanya: "SMAN 18 Garut" bukan jawaban atas ketikan "sman 1",
 * dan "SMAN 1 Ciamis" bukan jawaban atas "sman 18". Tanpa aturan ini satu
 * ketikan "sman 1" memenuhi keenam baris saran dengan SMAN 10 sampai SMAN 18.
 */
export function skorSekolah(ketikan, nama) {
  const dicari = kataSekolah(ketikan);
  const dimiliki = kataSekolah(nama);
  if (!dicari.length) return -1;

  const terpakai = dimiliki.map(() => false);
  let skor = 0;

  for (const kata of dicari) {
    if (ANGKA.test(kata)) {
      const keAngka = dimiliki.findIndex((k, i) => !terpakai[i] && k === kata);
      if (keAngka < 0) return -1;
      terpakai[keAngka] = true;
      continue;
    }

    // Tiga putaran, dari yang paling meyakinkan ke yang paling longgar, dan
    // urutannya yang membuat skornya jujur: pada "MA Mandiri", ketikan "man"
    // harus mendarat di "mandiri" (awalan, skor 1), bukan di "ma" (terbalik,
    // skor 2) — dan yang belakangan juga akan memakai habis kata "ma" yang
    // mungkin masih dibutuhkan kata berikutnya.
    //
    // Serakah, tanpa mundur mencoba pasangan lain. Yang dipertaruhkan cuma
    // urutan enam baris saran, dan backtracking penuh menukar itu dengan kode
    // yang tidak bisa dibaca sekali lewat.
    let ke = dimiliki.findIndex((k, i) => !terpakai[i] && k === kata);
    let tambah = 0;
    if (ke < 0) {
      ke = dimiliki.findIndex((k, i) => !terpakai[i] && k.startsWith(kata));
      tambah = 1;
    }
    if (ke < 0) {
      // Singkatan yang MERAPATKAN kata berurutan: "Almut" untuk
      // "SMA Al-Muttaqin", "arrahman" untuk "MA Terpadu Ar-Rahman". Nama
      // sekolah di sini penuh partikel dua huruf — al, ar, as, el, nu —
      // dan yang menyebutnya tidak pernah memberi jeda di situ.
      const rentang = rentangGabungan(dimiliki, terpakai, kata);
      if (rentang) {
        for (let i = rentang[0]; i <= rentang[1]; i++) terpakai[i] = true;
        skor += 1;
        continue;
      }
    }

    if (ke < 0) {
      // Kata pendek TIDAK boleh dicocokkan terbalik. Tanpa batas ini
      // "nurul" mencocokkan "NU" pada "SMK Ma'arif NU Ciamis", dan dua
      // baris saran dihabiskan sekolah yang jelas bukan itu — "al", "it",
      // "bp", "nu" ada di belasan nama. Tiga huruf adalah yang terpendek
      // yang masih menyebut sesuatu: "sma" pada `sma 2 ciamis`.
      ke = dimiliki.findIndex(
        (k, i) => !terpakai[i] && k.length >= 3 && kata.startsWith(k));
      tambah = 2;
    }
    if (ke < 0) return -1;
    terpakai[ke] = true;
    skor += tambah;
  }
  return skor;
}

/**
 * Rentang kata BERURUTAN yang, kalau dirapatkan, diawali `kata`.
 *
 * Minimal dua kata: yang satu kata sudah diurus aturan awalan biasa, dan
 * membiarkannya di sini cuma menduakan jawaban yang sama.
 *
 * Yang dipakai habis seluruh rentangnya, bukan kata pertamanya saja — huruf
 * "muttaqin" memang ikut terketik di dalam "almut", jadi ia tidak boleh
 * dipakai lagi oleh kata berikutnya.
 *
 * @returns {[number, number] | null} indeks awal dan akhir, keduanya inklusif
 */
function rentangGabungan(dimiliki, terpakai, kata) {
  for (let awal = 0; awal < dimiliki.length; awal++) {
    if (terpakai[awal]) continue;
    let gabung = dimiliki[awal];
    for (let akhir = awal + 1; akhir < dimiliki.length && !terpakai[akhir]; akhir++) {
      gabung += dimiliki[akhir];
      if (gabung.startsWith(kata)) return [awal, akhir];
    }
  }
  return null;
}

/**
 * Saran sekolah untuk ketikan, sudah terurut: yang paling mirip di atas.
 *
 * Seri diputus oleh panjang nama. Alasannya sederhana: kalau "sman 1" cocok
 * dengan "SMAN 1 Ciamis" dan "SMAN 1 Cijeungjing", yang lebih pendek adalah
 * yang lebih sedikit menambahkan kata yang tidak diketik siapa pun.
 *
 * @param {Array<{name?: string, nama?: string}>} daftar seluruh tabel sekolah
 * @param {string} ketikan apa yang sedang diketik pembina
 * @param {number} maks jumlah saran yang digambar
 */
export function cariSekolah(daftar, ketikan, maks = 6) {
  const kata = kataSekolah(ketikan);
  if (kata.join("").length < MIN_KETIKAN) return [];

  return (daftar ?? [])
    .map(sekolah => ({ sekolah, skor: skorSekolah(ketikan, sekolah.name ?? sekolah.nama) }))
    .filter(x => x.skor >= 0)
    .sort((a, b) => a.skor - b.skor
      || namaSekolah(a.sekolah).length - namaSekolah(b.sekolah).length
      || namaSekolah(a.sekolah).localeCompare(namaSekolah(b.sekolah)))
    .slice(0, maks)
    .map(x => x.sekolah);
}

/** Baris database memakai `name`; isian manual di form memakai `nama`. Sudah
 *  begitu sejak migrasi 0014 dan keduanya memang beredar bersama. */
const namaSekolah = s => String(s.name ?? s.nama ?? "");
