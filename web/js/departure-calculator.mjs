/* ============================================================================
   Kalkulator pembagian kloter dan waktu keberangkatan.

   Murni perhitungan: tidak membaca DOM dan tidak menyimpan ke database. Karena
   itu rumus yang sama bisa diuji di Node dan dipakai Kalkulator Keberangkatan.
   ========================================================================== */

function menitDariJam(jam) {
  const cocok = String(jam || "").match(/^(\d{2}):(\d{2})$/);
  if (!cocok) return null;
  const jamAngka = Number(cocok[1]);
  const menitAngka = Number(cocok[2]);
  if (jamAngka > 23 || menitAngka > 59) return null;
  return jamAngka * 60 + menitAngka;
}

function jamDariMenit(total) {
  const jam = Math.floor(total / 60);
  const menit = total % 60;
  return `${String(jam).padStart(2, "0")}:${String(menit).padStart(2, "0")}`;
}

/**
 * Jadwal PLANNING untuk kloter yang SUDAH terbentuk.
 *
 * Menjawab pertanyaan yang berbeda dari hitungRekomendasiKloter() di bawah.
 * Yang itu proyeksi SEBELUM daftar ulang: "kalau nanti ada 300 regu, berapa
 * kloter dan jam berapa". Yang ini rencana SESUDAHNYA: "kloter-kloter ini
 * sudah ada isinya, jam berapa masing-masing berangkat" — dan itulah yang
 * dibagikan ke peserta.
 *
 * Disebar ke kloter yang ADA, bukan ke seluruh kloter edisi. Sepuluh kloter
 * yang disebar ke 75 slot berangkat semua sebelum pukul 07:25, dan jendela
 * sampai pukul sepuluh tidak terpakai sama sekali — sementara pasal 10.1
 * menuntut yang terakhir berangkat pukul sepuluh.
 *
 * Nomor kloter TIDAK harus berurutan tanpa lubang: yang menentukan urutan
 * berangkat adalah urutan nomornya, dan kloter yang kosong memang tidak ada
 * di daftar ini. Yang dipakai posisinya dalam daftar, bukan nomornya.
 *
 * `floor`, bukan `round` — sama dengan sibling-nya di bawah, dan sebuah
 * rencana keberangkatan yang membulatkan ke bawah tidak pernah melewati
 * ujung jendelanya.
 *
 * @returns {Map<number, string>} nomor kloter -> "HH:MM"
 */
export function jadwalPlanning(nomorKloter, waktuPertama, waktuTerakhir,
                               jedaMaksMenit = Infinity) {
  const pertama = menitDariJam(waktuPertama);
  const terakhir = menitDariJam(waktuTerakhir);
  if (pertama === null || terakhir === null) {
    throw new Error("Waktu keberangkatan belum lengkap.");
  }
  if (terakhir <= pertama) {
    throw new Error("Waktu berangkat terakhir harus setelah waktu pertama.");
  }

  const urut = [...new Set(nomorKloter.map(Number))]
    .filter(n => Number.isFinite(n))
    .sort((a, b) => a - b);
  const rentang = terakhir - pertama;

  /* JEDANYA DIBATASI, dan itu yang membuat jendela bukan perintah menyebar.

     Menyebar rata ke seluruh jendela benar ketika kloternya banyak, dan
     konyol ketika sedikit: dua kloter di jendela 07:00-10:00 terbaca "07:00
     dan 10:00", seolah kloter kedua menunggu tiga jam di lapangan. Yang
     sebenarnya terjadi di lapangan: kloter berangkat beruntun, dan jarak
     antar kloter tidak pernah lebih dari beberapa menit.

     Jadi jendelanya jadi BATAS ATAS, bukan target: jeda = yang lebih kecil
     antara "rata di jendela" dan jeda maksimal. Kloter terakhir boleh
     berangkat jauh sebelum ujung jendela — memang begitu kalau regunya
     sedikit. */
  const jedaMaks = Number(jedaMaksMenit) || Infinity;
  // Yang dibandingkan JARAK DARI KLOTER PERTAMA, bukan jeda per langkah:
  // `rentang / (n-1) * i` menumpuk pembulatan pecahan dan membuat kloter
  // terakhir meleset satu menit ke bawah, sementara `rentang * i / (n-1)`
  // jatuh tepat di ujung jendela — bentuk yang sama dengan database.
  // `i === 0` disebut sendiri, dan itu BUKAN kerapian: tanpa batas jeda,
  // `jedaMaks` bernilai Infinity, dan `Infinity * 0` di JavaScript adalah NaN
  // — bukan 0. Kloter pertama lalu tercetak "NaN:NaN" pada jalur yang paling
  // sering dipakai.
  const menit = (i) => (i === 0 || urut.length === 1)
    ? pertama
    : pertama + Math.floor(Math.min(rentang * i / (urut.length - 1), jedaMaks * i));

  return new Map(urut.map((nomor, i) => [nomor, jamDariMenit(menit(i))]));
}

/**
 * Isi kloter FIFO dengan kuota terpisah Eksternal dan Intern, lalu sebarkan
 * jam K1 sampai kloter terakhir merata di seluruh jendela.
 */
export function hitungRekomendasiKloter({
  waktuPertama,
  waktuTerakhir,
  jumlahEksternal,
  jumlahIntern,
  maksEksternalPerKloter,
  maksInternPerKloter,
  kloterMaks,
  jedaMaksMenit = Infinity,
}) {
  const pertama = menitDariJam(waktuPertama);
  const terakhir = menitDariJam(waktuTerakhir);
  const eksternal = Number(jumlahEksternal);
  const intern = Number(jumlahIntern);
  const kapasitasEksternal = Number(maksEksternalPerKloter);
  const kapasitasIntern = Number(maksInternPerKloter);
  const batasKloter = Number(kloterMaks);

  if (pertama === null || terakhir === null) {
    throw new Error("Waktu keberangkatan belum lengkap.");
  }
  if (terakhir <= pertama) {
    throw new Error("Waktu berangkat terakhir harus setelah waktu pertama.");
  }
  if (!Number.isInteger(eksternal) || eksternal < 0 ||
      !Number.isInteger(intern) || intern < 0 || eksternal + intern < 1) {
    throw new Error("Jumlah regu minimal 1.");
  }
  if (!Number.isInteger(kapasitasEksternal) || kapasitasEksternal < 1 ||
      !Number.isInteger(kapasitasIntern) || kapasitasIntern < 1) {
    throw new Error("Kapasitas kloter belum dikonfigurasi.");
  }
  if (!Number.isInteger(batasKloter) || batasKloter < 1) {
    throw new Error("Batas jumlah kloter belum dikonfigurasi.");
  }

  const jumlahKloter = Math.max(
    Math.ceil(eksternal / kapasitasEksternal),
    Math.ceil(intern / kapasitasIntern),
  );
  if (jumlahKloter > batasKloter) {
    throw new Error(
      `${eksternal + intern} regu membutuhkan ${jumlahKloter} kloter, melebihi batas ${batasKloter}.`
    );
  }

  /* PEMBAGINYA `batasKloter`, BUKAN `jumlahKloter`, dan itu bukan pilihan
     gaya — ia menyamakan kalkulator ini dengan `perkiraan_berangkat_kloter()`
     di database (migrasi 0105).

     Database menyebar seluruh kloter edisi, termasuk cadangan, supaya kloter
     ke-61 dan seterusnya tetap punya perkiraan DI DALAM jendela 07:00-10:00
     (CLAUDE.md 10.1: yang terakhir sudah berangkat pukul sepuluh). Membagi
     dengan jumlah yang dibutuhkan saja membuat cadangan yang benar-benar
     terpakai berangkat sesudah pukul sepuluh.

     Angka databaselah yang tercetak di kertas kloter yang dibagikan ke peserta
     dan yang muncul sebagai `~HH:MM` di chip layar Keberangkatan. Kalkulator
     ini dipakai menyusun jadwal pagi. Dengan dua pembagi, keduanya menyebut
     jam berbeda untuk kloter yang sama: pada 60 kloter dan batas 75, K60
     terbaca 10:00 di sini dan 09:23 di sana — selisih 37 menit.

     BARISNYA tetap sebanyak kloter yang dibutuhkan: yang direncanakan cuma
     kloter yang benar-benar diisi.

     `floor`, bukan `round`: database mengembalikan timestamptz berdetik dan
     layar menampilkannya lewat jamMenit(), yang MEMOTONG detik. K10 di sana
     07:21:53 terbaca "07:21"; membulatkan di sini akan menuliskannya 07:22. */
  const rentang = terakhir - pertama;
  // Jeda maksimalnya sama dengan yang dipakai jadwalPlanning() dan
  // perkiraan_berangkat_kloter(): satu aturan lapangan, bukan tiga.
  const jedaMaks = Number(jedaMaksMenit) || Infinity;
  return Array.from({ length: jumlahKloter }, (_, indeks) => {
    // `indeks === 0` disebut sendiri: `Infinity * 0` adalah NaN (lihat
    // catatan yang sama di jadwalPlanning).
    const waktu = (indeks === 0 || batasKloter === 1)
      ? pertama
      : pertama + Math.floor(Math.min(rentang * indeks / (batasKloter - 1),
                                      jedaMaks * indeks));
    return {
      kloter: indeks + 1,
      jumlahEksternal: Math.max(0, Math.min(kapasitasEksternal,
        eksternal - indeks * kapasitasEksternal)),
      jumlahIntern: Math.max(0, Math.min(kapasitasIntern,
        intern - indeks * kapasitasIntern)),
      waktuBerangkat: jamDariMenit(waktu),
    };
  });
}
