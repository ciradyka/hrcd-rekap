/* ============================================================================
   hrcd-rekap : screens/live-score.js — layar Live Score (#/live-score).

   Klasemen sementara per golongan, fase papan peserta, dan cetak rekap nilai.
   ========================================================================== */

import { aturFaseLive, bolehLihat, cacheLiveScore, segarkanLiveScore,
         statusAcara } from "../api.js";
import { EDISI, LAYAR, pasangKepala, putusSaatPindah,
         sinyalLayarBaru } from "../common/frame.js";
import { angkaRapi, dada3, dialog, esc, GOLONGAN_LABEL, h, ikon, ikonRefresh,
         jamMenit, kartuGagalMuat, kelompokLomba, kolomPos, kontrakTeks, notif,
         pemuat, ringkasLomba, tanggalJam, URUT_GOLONGAN } from "../util.js";

/** Kepala kolom pos untuk tabel rekap — SATU entri per pos, dua baris kepala
 *  masing-masing. Dipakai papan Live Score DAN cetakannya.
 *
 *  Mengembalikan larik, bukan dua string jadi, karena kertas memerlukan
 *  kelompoknya utuh: 29 kolom tidak muat di satu lembar A4 dan pembelahannya
 *  harus jatuh di ANTARA pos, tidak pernah di tengah-tengah pos. Papan di
 *  layar merangkainya kembali dengan join("") dan mendapat bentuk yang sama
 *  seperti sebelumnya.
 *
 *  Sepasang mutlak dengan selPosRegu() di bawah. Yang satu memutuskan berapa
 *  <th> yang digambar, yang lain berapa <td> — dan aturannya sama-sama
 *  bergantung pada "pos ini punya lebih dari satu lomba atau tidak". Kalau
 *  keduanya pernah berbeda pendapat, seluruh tabel bergeser satu kolom tanpa
 *  satu pun galat: nilai Pos 2 tercetak di bawah judul Pos 3, dan kertas itu
 *  terlihat benar sampai ada yang mencocokkannya dengan layar. `lebar` di tiap
 *  entri adalah angka yang menyatukan keduanya.
 *
 *  Kolom "Nilai" per pos hanya digambar kalau posnya memuat LEBIH DARI SATU
 *  lomba. Pos 4 cuma punya PBB dan Pos 5 cuma punya Yel-Yel: di sana
 *  "PBB 82 | Nilai 82" adalah angka yang sama dua kali, bersebelahan. */
export const kepalaPosRekap = (posKolom) => posKolom.map(p => {
  const satuLomba = p.lomba.length === 1;
  const lebar = p.lomba.length + (satuLomba ? 0 : 1);
  return {
    lebar,
    atas: `<th colspan="${lebar}" class="rekap-batas">Pos ${esc(String(p.nomor))} · ${esc(p.name)}</th>`,
    bawah: p.lomba.map((l, i) =>
      `<th class="pos-kol${satuLomba && i === p.lomba.length - 1
        ? " rekap-batas" : ""}">${esc(l.nama)}</th>`).join("")
      + (satuLomba ? "" : `<th class="pos-kol rekap-batas">Nilai</th>`),
  };
});

/** Sel kolom pos untuk SATU regu — dipakai papan Live Score DAN cetakannya.
 *
 *  Mengembalikan TEKS beserta penandanya, bukan HTML jadi: papan membungkus
 *  lomba yang tidak berlaku dengan <span class="sel-mati"> supaya ia pudar di
 *  antara angka, sedangkan kertas cukup mencetak tanda hubungnya — pucat di
 *  kertas yang difotokopi justru hilang (CLAUDE.md 8.4).
 *
 *  Satu tempat, karena dua salinan aturan "lomba mana yang berlaku untuk
 *  golongan ini" persis bentuk kegagalan yang sudah terjadi di sistem ini
 *  (CLAUDE.md 11.9, dan varianUntuk() di util.js ditulis untuk alasan yang
 *  sama). Salinan yang menyimpang tidak menggagalkan apa pun — ia cuma
 *  membuat layar dan kertas saling membantah di depan pembina yang sedang
 *  memegang keduanya.
 *
 *  `berlaku === 0` berarti lomba itu memang bukan untuk golongan regu ini,
 *  BUKAN berarti nilainya belum masuk. Poin per KOMPONEN (0107) mengisi sel
 *  lomba, poin per POS mengisi kolom Nilai di ujung tiap kelompok — dua hal
 *  berbeda, dua kunci berbeda (`pos.kode` lawan `pos`).
 *
 *  Yang keluar POIN AKHIR komponennya, bukan angka mentahnya. Angka mentah
 *  tidak bisa dibandingkan antar kolom — "4" di Semaphore, "8.55" di Menaksir,
 *  dan "01:14" di Bakiak adalah tiga satuan berbeda, dan tidak satu pun
 *  menyebut sumbangannya ke Total di ujung baris. Papan dan kertas ini justru
 *  dibaca orang yang tidak memegang tangga poin tiap lomba: pembina, peserta,
 *  dan panitia yang bukan juri lomba itu.
 *
 *  Angkanya datang JADI dari `v_rekap_penuh.poin` (migrasi 0107). Tidak ada
 *  yang dihitung di sini — alasannya sama dengan Nilai Pos di layar Input Pos:
 *  mesin skor kedua adalah mesin skor yang suatu hari berbeda pendapat dengan
 *  yang pertama.
 *
 *  Sel kosong berarti komponennya belum dinilai. Nol yang SUDAH dinilai tetap
 *  tergambar "0" — itu angka, bukan ketiadaan. */
export function selPosRegu(k, posKolom, rekapDada) {
  const rk = rekapDada.get(k.nomor_dada) || {};
  const poinKomponen = rk.poin || {};
  const poin = k.poin_per_pos || {};
  return posKolom.flatMap(p => {
    const satuLomba = p.lomba.length === 1;
    const sel = p.lomba.map((l, i) => {
      const r = ringkasLomba(l, k.golongan, p.nomor, poinKomponen);
      const batas = satuLomba && i === p.lomba.length - 1;
      if (!r.berlaku) return { teks: "–", mati: true, batas };
      return { teks: r.terisi ? angkaRapi(r.jumlah) : "–", batas };
    });
    if (!satuLomba) {
      const v = poin[String(p.nomor)];
      sel.push({ teks: v === undefined ? "–" : angkaRapi(v),
                 nilai: true, batas: true });
    }
    return sel;
  });
}

/** Berapa KOLOM NILAI yang muat di satu lembar, di luar empat kolom identitas
 *  dan kolom Total yang selalu ikut.
 *
 *  DIUKUR DI BROWSER atas data 143 regu, bukan ditaksir (CLAUDE.md 15.9 dan
 *  15.11). Pada 12 kolom nilai satu lembar berisi 17 kolom, dan lebar
 *  min-content-nya \u2014 selebar-sempitnya tabel itu bisa menjadi dengan setiap
 *  nama sudah membungkus di spasinya \u2014 terukur 222,7mm dari 281mm yang
 *  tersedia (A4 melintang 297mm dikurangi margin 8mm dua sisi). Sisa 58mm,
 *  dan sisa itulah yang membuat nama regu dan sekolah TIDAK PERNAH dipatah
 *  di tengah kata.
 *
 *  Angka ini tidak boleh dinaikkan tanpa diukur ulang. Seluruh 29 kolom dalam
 *  satu lembar pernah dicoba dan lebar min-content-nya 347,7mm \u2014 lebih 66mm
 *  dari kertasnya, jadi sepertiga kanan tabel terpotong. Yang menghabiskannya
 *  kepala kolom, bukan angkanya: "Pengetahuan Umum", "Kepramukaan",
 *  "Berangkat" adalah kata yang tidak bisa dipatahkan, dan 7pt adalah BATAS
 *  BAWAH huruf (CLAUDE.md 8.6). Kalau kolomnya bertambah lagi tahun depan,
 *  yang bertambah lembarnya \u2014 bukan yang berkurang ukuran hurufnya. */
export const KOLOM_NILAI_PER_LEMBAR = 12;

/** Blok cetak Rekap Nilai \u2014 isinya kolom yang SAMA dengan papan Live Score,
 *  lewat kepalaPosRekap() dan selPosRegu() yang sama.
 *
 *  SATU BAGIAN PER GOLONGAN, bukan satu tabel campuran. Keempat golongan
 *  berlomba terpisah (CLAUDE.md bagian 11), dan peringkat di kolom # adalah
 *  peringkat DI DALAM golongannya \u2014 satu tabel campuran akan mencetak empat
 *  baris bernomor 1 tanpa satu pun keterangan kenapa. Urutan bagiannya
 *  URUT_GOLONGAN, sama dengan tab di layar dan dengan corong saat juara
 *  diumumkan. Golongan karena itu TIDAK jadi kolom ke-30: ia judul bagian,
 *  tempat ia terbaca sekali per halaman alih-alih diulang di tiap baris.
 *
 *  TIAP GOLONGAN DIBELAH LAGI JADI BEBERAPA BAGIAN, sebanyak yang diperlukan
 *  KOLOM_NILAI_PER_LEMBAR di atas. Bagian adalah potongan KOLOM, bukan
 *  potongan kertas: bagian-bagiannya MENGALIR, jadi sekolah bersatu regu
 *  keluar satu halaman berisi dua bagian bertumpuk, bukan dua halaman yang
 *  masing-masing terisi 12% (terukur, dan itu keluhan yang memperbaikinya). Pembelahannya selalu jatuh DI ANTARA pos,
 *  tidak pernah di tengah-tengah pos: kepala "Pos 3 \u00b7 P3K" membentang di atas
 *  kolom-kolomnya, dan pos yang terbelah dua lembar akan mencetak kepala itu
 *  dua kali di atas separuh kolomnya masing-masing.
 *
 *  Empat kolom identitas dan kolom Total ADA DI SETIAP LEMBAR. Itu yang
 *  membuat tiap lembar berdiri sendiri: kertas ini beredar sebagai lembaran
 *  lepas, dan lembar tanpa nomor dada tidak bisa dicocokkan dengan apa pun,
 *  sementara Total adalah angka yang paling sering dicari di lembar mana pun.
 *
 *  Kolom perjalanan \u2014 kontrak, kloter, berangkat, datang, anggota, penalti \u2014
 *  ikut sebagai satu kelompok utuh di belakang pos terakhir, dan urutan itu
 *  yang membuatnya berguna: Penalti selalu dibaca dengan pertanyaan "dari
 *  mana", dan jawabannya persis kolom-kolom di sebelahnya.
 *
 *  Nama regu dan sekolah MEMBUNGKUS, tidak dipotong: nama yang terpotong
 *  kehilangan gunanya sebagai cek silang, sementara baris yang tingginya tidak
 *  rata cuma tidak enak dilihat. Kertas ini DIBACA, bukan ditulisi \u2014 garis
 *  pandang mendatar yang dijaga lembar pos (CLAUDE.md 8) tidak sedang
 *  dipertaruhkan di sini.
 *
 *  Yang tercetak persis yang tergambar: `baris` datang dari klasemen layar,
 *  jadi ia sudah tersaring ke regu yang SUDAH BERANGKAT dan sudah terurut.
 *  Kertas yang diam-diam berbeda dari layar yang tombolnya baru saja ditekan
 *  adalah kertas yang salah. Buka ulang layar untuk mengambil nilai terbaru.
 *
 *  Mengembalikan jumlah baris yang benar-benar masuk cetakan, supaya
 *  pemanggilnya bisa menolak membuka dialog cetak untuk nol baris \u2014 kertas
 *  kosong yang keluar dari printer tidak menjelaskan apa pun. */
export function siapkanCetakRekap({ judul, baris, posKolom, rekapDada }) {
  document.getElementById("cetakan")?.remove();
  const dicetak = tanggalJam(new Date().toISOString());
  const kepalaPos = kepalaPosRekap(posKolom);

  const isiGolongan = URUT_GOLONGAN
    .map(g => [g, baris.filter(k => k.golongan === g)])
    .filter(([, isi]) => isi.length);
  const jumlah = isiGolongan.reduce((n, isi) => n + isi[1].length, 0);
  if (!jumlah) return 0;

  /* Empat kolom identitas, sama di setiap lembar. Angka peringkatnya saja,
     TANPA medali: medali di papan adalah emoji, dan emoji di kertas keluar
     sebagai gambar berwarna atau kotak kosong tergantung printer dan fon yang
     ada di alat itu \u2014 dua hal yang tidak diketahui saat kertasnya dibangun.
     Angkanya sendiri sudah menyebut peringkatnya. */
  const kepalaIdentitas = `
    <th rowspan="2">#</th>
    <th rowspan="2">No Dada</th>
    <th rowspan="2">Regu</th>
    <th rowspan="2" class="rekap-batas">Organisasi</th>`;
  const selIdentitas = (k) => `
    <td class="text-center">${esc(String(k.peringkat ?? ""))}</td>
    <td class="text-center">${esc(dada3(k.nomor_dada))}</td>
    <td>${esc(k.nama_regu)}</td>
    <td class="rekap-batas">${esc(k.nama_sekolah)}</td>`;
  const selTotal = (k) =>
    `<td class="text-center"><strong>${esc(angkaRapi(k.total))}</strong></td>`;

  /* KELOMPOK KOLOM \u2014 satu per pos, lalu satu untuk perjalanan. `lebar` adalah
     angka yang menjaga kepala dan badan tetap sepasang; ia datang dari
     kepalaPosRekap() untuk pos, dan diketik sekali di sini untuk perjalanan.

     Sel pos diiris dari selPosRegu() memakai `lebar` yang sama, jadi tidak ada
     tempat kedua yang memutuskan kolom mana milik pos mana. */
  const KELOMPOK = [
    ...kepalaPos.map((kp, i) => {
      const mulai = kepalaPos.slice(0, i).reduce((n, x) => n + x.lebar, 0);
      return {
        lebar: kp.lebar, atas: kp.atas, bawah: kp.bawah,
        sel: (k) => selPosRegu(k, posKolom, rekapDada)
          .slice(mulai, mulai + kp.lebar)
          .map(sel => `<td class="text-center${sel.batas ? " rekap-batas" : ""}">${
            esc(sel.teks)}</td>`).join(""),
      };
    }),
    {
      lebar: 6,
      atas: `
        <th rowspan="2">Kontrak</th>
        <th rowspan="2">Kloter</th>
        <th rowspan="2">Berangkat</th>
        <th rowspan="2">Datang</th>
        <th rowspan="2">Anggota</th>
        <th rowspan="2" class="rekap-batas">Penalti</th>`,
      bawah: "",
      sel: (k) => {
        const rk = rekapDada.get(k.nomor_dada) || {};
        return `
          <td class="text-center">${esc(kontrakTeks(rk.kontrak_menit))}</td>
          <td class="text-center">${esc(rk.kloter ?? "\u2014")}</td>
          <td class="text-center">${esc(rk.jam_berangkat
            ? jamMenit(rk.jam_berangkat) : "\u2014")}</td>
          <td class="text-center">${esc(rk.jam_datang
            ? jamMenit(rk.jam_datang) : "\u2014")}</td>
          <td class="text-center">${esc(rk.anggota_hadir ?? "\u2014")}</td>
          <td class="text-center rekap-batas">${esc(angkaRapi(
            Number(k.penalti_waktu) + Number(k.penalti_checkout)
            + Number(k.penalti_anggota)))}</td>`;
      },
    },
  ];

  /* Dimasukkan ke lembar secara berurutan, kelompok demi kelompok utuh.
     Satu kelompok yang sendirian sudah melebihi jatah tetap mendapat
     lembarnya sendiri \u2014 membelahnya di tengah pos akan mencetak kepala pos
     yang sama di dua lembar, dan itu lebih membingungkan daripada satu lembar
     yang agak lebih penuh. */
  const LEMBAR = [];
  for (const kel of KELOMPOK) {
    const akhir = LEMBAR[LEMBAR.length - 1];
    if (akhir && akhir.lebar + kel.lebar <= KOLOM_NILAI_PER_LEMBAR) {
      akhir.lebar += kel.lebar;
      akhir.kelompok.push(kel);
    } else {
      LEMBAR.push({ lebar: kel.lebar, kelompok: [kel] });
    }
  }

  /* .lembar-kepala — "Bagian 1/2", BUKAN "Lembar 1/2". Bagian-bagian ini
     mengalir dan bisa berbagi satu halaman kertas: sekolah bersatu regu keluar
     satu halaman, bukan dua yang masing-masing terisi 12%. Menyebutnya lembar
     akan membohongi yang memegangnya — ia mencari lembar kedua yang tidak
     pernah keluar dari printer.

     Penandanya tetap ditulis karena kertas ini berpindah tangan sebagai
     lembaran lepas: bagian kedua yang berdiri sendiri tanpa penanda
     terbaca seperti rekap yang kehilangan separuh kolomnya. */
  const halaman = isiGolongan.flatMap(([g, isi]) =>
    LEMBAR.map((lembar, i) => `
    <section class="print-page rekap-cetak">
      <h1>REKAP NILAI \u00b7 ${esc(judul)} \u00b7 ${esc(GOLONGAN_LABEL[g] || g)}</h1>
      <p class="lembar-kepala">${esc(EDISI ? EDISI.name : "")} \u00b7
         ${esc(String(isi.length))} regu \u00b7 Bagian ${i + 1}/${LEMBAR.length}
         \u00b7 Dicetak ${esc(dicetak)}</p>
      <table class="print-table">
        <thead>
          <tr>${kepalaIdentitas}${lembar.kelompok.map(x => x.atas).join("")}
              <th rowspan="2">Total</th></tr>
          <tr>${lembar.kelompok.map(x => x.bawah).join("")}</tr>
        </thead>
        <tbody>
          ${isi.map(k => `<tr>${selIdentitas(k)}${
            lembar.kelompok.map(x => x.sel(k)).join("")}${selTotal(k)}</tr>`).join("")}
        </tbody>
      </table>
    </section>`)).join("");

  document.body.appendChild(h(`<div id="cetakan" class="printout">${halaman}</div>`));
  return jumlah;
}

/* Dibatalkan tiap kali layar Live Score dibuka lagi: panel penyaring hidup di
   <body>, jadi tidak ada yang membuangnya saat pindah layar. */
export let pengendaliFilterSekolah = null;

/* Golongan yang sedang dibuka, DIINGAT melewati kunjungan berikutnya ke layar
   ini \u2014 panitia yang bolak-balik antara Live Score dan layar input sepanjang
   pagi hampir selalu menanyakan golongan yang sama.

   Di luar layarLiveScore() karena fungsi itu menggambar papan dari nol tiap
   kali dipanggil.

   `null` berarti belum ada yang dipilih, dan itu beda dari "memilih golongan
   pertama": golongan yang diingat dipakai HANYA kalau ia masih punya baris,
   supaya papan tidak terbuka pada tab kosong.

   PASANGANNYA, `guliranLiveScore`, SUDAH TIDAK ADA. Ia ada karena Refresh
   dulu menggambar ulang seluruh layar dan melempar guliran ke puncak; sejak
   Refresh menukar angkanya di tempat, tidak ada lagi yang melempar apa pun. */
export let golonganLiveScore = null;

/** Satu request yang putus tidak boleh merobohkan seluruh papan.
 *
 *  Live Score menarik snapshot skor dan status acara. Di koneksi lapangan,
 *  salah satunya kadang putus walau yang lain sudah sampai; Promise.all lalu
 *  membuang hasil yang berhasil dan mengganti seluruh layar dengan kartu galat.
 *  Semua pembacaan ini idempotent, jadi yang gagal aman dicoba sekali lagi.
 *
 *  Status acara dan cincin kelengkapan hanya keterangan tambahan. Setelah
 *  percobaan kedua pun gagal, papan skor tetap lebih berguna daripada layar
 *  kosong; sumber inti tetap wajib berhasil agar angka tidak menyesatkan. */
export async function muatDataLiveScore(ambil, kosong) {
  try { return await ambil(); }
  catch (pertama) {
    try { return await ambil(); }
    catch (kedua) {
      if (arguments.length > 1) return kosong;
      throw kedua;
    }
  }
}

export async function layarLiveScore() {
  pasangKepala("Live Score", true);
  LAYAR.replaceChildren(h(pemuat()));
  const layarIni = location.hash;

  let snapshot, status;
  try {
    [snapshot, status] = await Promise.all([
      muatDataLiveScore(cacheLiveScore),
      muatDataLiveScore(statusAcara, null),
    ]);
  } catch (e) {
    LAYAR.replaceChildren(kartuGagalMuat(e.message, layarLiveScore));
    return;
  }
  if (location.hash !== layarIni) return;

  /* `let`, bukan `const`, untuk yang datang dari snapshot: tombol Refresh
     menukar isinya DI TEMPAT dan tidak menggambar ulang layar ini. Yang tetap
     `const` konfigurasi — daftar pos dan komponennya menentukan KOLOM tabel,
     dan kolom yang berubah menuntut gambar ulang penuh. */
  let pos = snapshot.kelengkapan || [];
  const posSemua = snapshot.pos || [];
  const komponen = snapshot.komponen || [];
  let rekap = snapshot.rekap || [];

  /* v_rekap_penuh sudah menghitung peringkat, total, penalti, dan poin per pos
     yang sama dengan klasemen_live_score(). Meminta keduanya membuat database
     menjalankan seluruh rantai skor dua kali untuk setiap panitia yang membuka
     layar ini. Papan hanya memerlukan baris yang sudah berangkat; nama kolom
     poin dinormalkan di sini agar bentuk data untuk penggambar tidak berubah. */
  const hitungKlasemen = (baris) => baris
    .filter(r => r.sudah_berangkat)
    .map(r => ({ ...r, poin_per_pos: r.poin_pos }))
    .sort((a, b) => {
      const aPunyaPeringkat = a.peringkat != null;
      const bPunyaPeringkat = b.peringkat != null;
      if (aPunyaPeringkat !== bPunyaPeringkat) return aPunyaPeringkat ? -1 : 1;
      if (aPunyaPeringkat && a.peringkat !== b.peringkat)
        return Number(a.peringkat) - Number(b.peringkat);
      return Number(b.total) - Number(a.total);
    });
  let klasemen = hitungKlasemen(rekap);

  // `let`, bukan `const`: saklar di bawah memperbaruinya DI TEMPAT.
  let fase = (status && status.fase_live) || "pra";
  // Persen dihitung di sini, bukan di view. `v_kelengkapan_pos` sudah membawa
  // `lengkap` dan `regu_total`, dan menambah view yang menghitung pembagian
  // itu adalah tempat kedua yang harus ikut benar setiap kali definisi
  // "lengkap" berubah.
  const persenPos = (p) => !p.regu_total
    ? 0 : Math.floor(100 * p.lengkap / p.regu_total);

  /** Merah -> kuning -> hijau mengikuti persennya, bukan tiga anak tangga.

   *  Tangga membuat 49% dan 51% terlihat sangat berbeda padahal selisihnya satu
   *  regu, sementara 51% dan 89% terlihat sama padahal itu dua puluh regu.
   *  Gradasi menampilkan JARAKNYA, dan jarak itu yang ditanyakan orang saat
   *  melirik lima cincin sekaligus.
   *
   *  Rona 0 di 0%, 50 di 50%, 140 di 100% — merah, kuning, hijau. Angkanya
   *  tetap tertulis di dalam cincin, jadi warna tidak pernah jadi satu-satunya
   *  kabar bagi yang sulit membedakan merah dari hijau. */
  const warnaPersen = (s) => {
    const p = Math.max(0, Math.min(100, Number(s) || 0));
    const rona = p <= 50 ? p : 50 + (p - 50) * 1.8;
    return `hsl(${Math.round(rona)}, 72%, 40%)`;
  };

  /* Fungsi, bukan angka: Refresh menukar `pos` lalu memanggil keduanya lagi
     tanpa menggambar ulang kartunya. */
  const persenSemua = () => {
    const lengkap = pos.reduce((n, p) => n + Number(p.lengkap || 0), 0);
    const semua   = pos.reduce((n, p) => n + Number(p.regu_total || 0), 0);
    return semua ? Math.round(lengkap / semua * 100) : 0;
  };
  const cincinPos = () => pos.map(p => {
    const s = persenPos(p);
    return `
    <li>
      <div class="cincin" style="--persen:${s};--warna:${warnaPersen(s)}"
           role="img" aria-label="Pos ${esc(String(p.pos))} ${esc(String(s))} persen selesai">
        <span>${esc(String(s))}<i>%</i></span>
      </div>
      <div class="c-nama">Pos ${esc(String(p.pos))} · ${esc(p.nama_pos)}</div>
      <div class="c-angka">${esc(String(p.lengkap))} / ${esc(String(p.regu_total))} regu</div>
    </li>`;
  }).join("");

  const kemajuan = `
    <div class="card">
      <button type="button" class="judul-status" id="kemajuan-buka"
              aria-expanded="false" aria-controls="kemajuan-rinci">
        <span class="js-teks">Status</span>
        <span class="js-batang" aria-hidden="true"><span id="js-batang-isi"
          style="width:${persenSemua()}%;background:${warnaPersen(persenSemua())}"></span></span>
        <span class="js-persen" id="js-persen">${esc(String(persenSemua()))}%</span>
        <span class="kr-panah" aria-hidden="true">▾</span>
      </button>
      <div class="description toolbar-kanan">
        <span id="waktu-snapshot">Update ${esc(tanggalJam(snapshot.dibuat_pada))}</span>
        <button type="button" class="icon-button icon-button-inline"
                id="refresh-live-score" aria-label="Refresh Live Score"
                title="Refresh Live Score">${ikonRefresh}</button>
      </div>
      <ul class="kemajuan" id="kemajuan-rinci">${cincinPos()}</ul>
    </div>`;

  /* Enam besar, bukan tiga. Yang diumumkan di lapangan adalah Juara 1-3 lalu
     Harapan 1-3 — sama dengan daftar penghargaan yang dipilih layar Kejuaraan
     (migrasi 0139) — jadi papan yang berhenti di tiga membuat panitia menghitung
     sendiri siapa Harapan 1 dari baris tabel di bawahnya.

     Ketiga Harapan memakai PITA, satu lambang yang sama untuk ketiganya.
     Bentuknya sengaja tidak bundar: emas, perak, dan perunggu sudah habis di
     Juara 1-3, jadi medali bundar keempat cuma menambah satu benda yang mirip
     tiga benda di atasnya. Memberi Harapan 1 lambang yang berbeda dari
     Harapan 2 juga tidak dilakukan — itu mengarang tingkatan yang tidak ada
     di penghargaannya. */
  const MEDALI = { 1: "🥇", 2: "🥈", 3: "🥉",
                   4: "🎖️", 5: "🎖️", 6: "🎖️" };
  const gelar = (n) => n <= 3 ? `Juara ${n}` : `Harapan ${n - 3}`;
  /* Podium diurutkan SENDIRI, dengan pemecah seri yang sama persis dengan
     hasil_kejuaraan() (migrasi 0139): total, lalu yang paling dekat dengan
     kontrak waktunya, lalu nomor dada terkecil.

     Kolom # di tabel memakai `peringkat` dari rank(), dan itu memang benar di
     sana — dua regu berskor sama berbagi angka yang sama. Di podium ia salah:
     penghargaannya cuma satu per gelar, jadi rank() menuliskan "Harapan 1"
     dua kali lalu melompat ke "Harapan 3", sementara layar Kejuaraan
     menyerahkan Harapan 1 dan Harapan 2 kepada dua regu itu. Papan yang
     dibacakan panitia harus menyebut enam nama yang sama dengan lembar
     penghargaan. */
  const dekatKontrak = (k) => Math.abs(k.selisih_menit ?? 100000);
  const urutJuara = (a, b) =>
    Number(b.total) - Number(a.total)
    || dekatKontrak(a) - dekatKontrak(b)
    || Number(a.nomor_dada) - Number(b.nomor_dada);

  /* Kolom rincian dibangun dengan kolomPos() yang SAMA dengan layar Input Pos
     dan Rekapitulasi. Satu kolom per LOMBA, bukan per baris wahana — tanpa itu
     Pos 1 memakan empat kolom "Tebak Simpul" yang isinya saling meniadakan,
     satu per golongan, dan tabelnya memanjang tanpa menambah satu keterangan
     pun. */
  /* Satu kolom per LOMBA, bukan per penilaian — keputusan pemilik acara.
     Pembidaian lima kriteria jadi satu angka, PBB empat jadi satu, Yel-Yel
     empat jadi satu. Yang dibaca orang di papan ini adalah "berapa nilai
     Pembidaian regu itu", bukan berapa nilai Posisi Bidai-nya; rinciannya
     tetap utuh di Rekapitulasi dan di layar Input Pos, tempat ia memang
     menjawab pertanyaan.

     Ini TIDAK mengubah cara nilai dihitung. `poin_per_pos` tetap datang dari
     database; yang dijumlahkan di sini cuma tampilannya. */
  const posKolom = posSemua
    .filter(p => p.jumlah_komponen > 0)
    .map(p => ({
      ...p,
      lomba: kelompokLomba(kolomPos(komponen.filter(k => k.pos === p.nomor))),
    }));
  let rekapDada = new Map(rekap.map(r => [r.nomor_dada, r]));
  const kepalaPos = kepalaPosRekap(posKolom);
  /* KEEMPAT golongan selalu digambar, dengan urutan tetap — bukan hanya yang
     kebetulan sudah punya baris.
     Empat golongan berlomba TERPISAH: masing-masing punya juara sendiri, dan
     tidak ada satu pun peringkat yang membandingkan Penggalang dengan
     Penegak. Menggambar hanya golongan yang sudah terisi membuat papannya
     berubah bentuk sepanjang hari — Penegak PI muncul belakangan lalu
     menggeser semuanya — dan yang lebih buruk, golongan yang belum satu pun
     regunya masuk terlihat seperti golongan yang tidak ada. */
  const bisaPublish = bolehLihat("pengaturan");
  /* Label menyebut SIAPA YANG MELIHAT, bukan nama fase di database.
     "Pra" tidak mengatakan apa-apa kepada orang yang menekannya — ia nama
     tahapan, bukan akibat. "Internal" langsung menjawab pertanyaan yang
     sebenarnya ditanyakan: apakah peserta sudah bisa melihat ini.

     Kodenya TETAP pra/progres/penuh/top10/juara. Nilai itu duduk di status_acara,
     dipakai v_progres_publik, pagar-pagar "BOCOR" di publish-live.yml, dan migrasi
     0068/0070/0072 — menggantinya menuntut migrasi beserta seluruh policy,
     demi tiga kata di layar. */
  const FASE = [
    ["pra", "Internal"], ["progres", "Progress"], ["penuh", "Live"],
    ["top10", "Top 10"], ["juara", "Juara"],
  ];
  const saklar = !bisaPublish ? "" : `
    <div class="segmen-fase" role="group" aria-label="Fase Live Score">
      ${FASE.map(([kode, teks]) => `
        <button type="button" class="button ${kode === fase ? "button-primary" : ""}"
                data-fase="${esc(kode)}" ${kode === fase ? "aria-current=\"true\"" : ""}
                style="padding:.3rem .7rem;font-size:.85rem">${esc(teks)}</button>`).join("")}
    </div>`;

  /* PODIUM DAN BARIS TABEL DIPISAH dari kartunya, dan itu yang membuat tombol
     Refresh bisa menukar angkanya tanpa menggambar ulang layar: keduanya
     dipanggil lagi dari `pasangSnapshot()` di bawah, lalu hasilnya dipasang ke
     elemen yang sudah berdiri. Kartunya sendiri — kepala, saklar fase,
     penyaring sekolah, kepala kolom — tidak disentuh, jadi tab yang sedang
     dibuka, saringan yang sedang aktif, dan guliran tabelnya tetap. */
  const podiumGol = (g) => klasemen
    .filter(k => k.golongan === g && k.peringkat)
    .sort(urutJuara).slice(0, 6)
    .map((k, i) => `
              <div class="juara j${i + 1}${i >= 3 ? " harapan" : ""}">
                <div class="medali" aria-hidden="true">${MEDALI[i + 1] || ""}</div>
                <div class="j-teks">
                  <div class="peringkat">${esc(gelar(i + 1))}
                    <span class="dada-juara">${esc(dada3(k.nomor_dada))}</span></div>
                  <div class="nama">${esc(k.nama_regu)}</div>
                  <div class="sekolah">${esc(k.nama_sekolah)}</div>
                </div>
                <div class="total">${esc(angkaRapi(k.total))}</div>
              </div>`).join("");

  const barisGol = (g) => klasemen.filter(k => k.golongan === g).map(k => {
  const rk = rekapDada.get(k.nomor_dada) || {};
  /* Satu lomba bisa punya baris wahana berbeda per golongan;
     yang berlaku untuk regu INI yang dibaca. Aturannya
     duduk di selPosRegu(), bersama kepalaPosRekap() —
     kertas rekap memakai keduanya juga. */
  return `
  <tr data-sekolah="${esc(k.nama_sekolah || "")}">
    <td class="rekap-rank">${MEDALI[k.peringkat] || ""}<span class="rank-angka">${esc(String(k.peringkat ?? ""))}</span></td>
    <td class="angka">${esc(dada3(k.nomor_dada))}</td>
    <td>${esc(k.nama_regu)}</td>
    <td class="rekap-batas sub-kolom">${esc(k.nama_sekolah)}</td>
    ${selPosRegu(k, posKolom, rekapDada).map(sel =>
      `<td class="text-center${sel.nilai ? " pos-nilai" : ""}${
        sel.batas ? " rekap-batas" : ""}">${
        sel.mati ? `<span class="sel-mati">${esc(sel.teks)}</span>`
                 : esc(sel.teks)}</td>`).join("")}
    <td class="text-center">${esc(kontrakTeks(rk.kontrak_menit))}</td>
    <td class="text-center">${esc(rk.kloter ?? "—")}</td>
    <td class="text-center">${esc(rk.jam_berangkat
      ? jamMenit(rk.jam_berangkat) : "—")}</td>
    <td class="text-center">${esc(rk.jam_datang
      ? jamMenit(rk.jam_datang) : "—")}</td>
    <td class="text-center">${esc(rk.anggota_hadir ?? "—")}</td>
    <td class="text-center">${esc(angkaRapi(
      Number(k.penalti_waktu) + Number(k.penalti_checkout)
      + Number(k.penalti_anggota)))}</td>
    <td class="text-center"><strong>${esc(angkaRapi(k.total))}</strong></td>
  </tr>`;
  }).join("");

  const kartuGolongan = (g) => {
        const baris = klasemen.filter(k => k.golongan === g);
        const sekolahAda = [...new Set(baris.map(k => k.nama_sekolah).filter(Boolean))]
          .sort((a, b) => a.localeCompare(b, "id"));
        /* "sementara" yang membawa faktanya: papan ini memeringkat dari
           poin yang terkumpul SEKARANG, jadi urutannya bisa berubah
           sampai pos terakhir terisi. Tanpa kata itu, tiga medali di
           layar besar terbaca seperti hasil — dan itu yang diumumkan
           orang. */
        if (!baris.length) return `
        <div class="card">
          <div class="kepala-klasemen">
            <div class="sisi"></div>
            <h2>Klasemen sementara</h2>
            <div class="sisi kanan">${saklar}</div>
          </div>
          <p class="description">Belum ada regu golongan ini yang bisa
            diperingkat.</p>
        </div>`;
        /* "sementara" yang membawa faktanya: papan ini memeringkat dari
           poin yang terkumpul SEKARANG, jadi urutannya bisa berubah
           sampai pos terakhir terisi. Tanpa kata itu, tiga medali di
           layar besar terbaca seperti hasil — dan itu yang diumumkan
           orang. */
        /* Penyaring sekolah. Daftarnya dibangun dari baris golongan INI,
           bukan dari seluruh sekolah: memilih sekolah yang tidak punya
           regu di golongan yang sedang dibuka menghasilkan tabel kosong
           tanpa satu pun petunjuk kenapa.

           <details> biasa, bukan dropdown buatan sendiri — ia sudah bisa
           dibuka dengan sentuhan, ditutup dengan Esc, dan dibacakan
           pembaca layar tanpa satu baris JS pun. */
        /* Panelnya di ATAS tabel, tapi yang diklik KEPALA KOLOMNYA.
           Panel ini tidak bisa ditaruh di dalam <th>: tabelnya duduk di
           dalam wadah bergulir, dan apa pun yang mengambang di dalam sana
           terpotong begitu daftarnya lebih tinggi dari kepala tabel. */
        /* .isi-filter — Panel MENGAMBANG di bawah kepala kolomnya, bukan kotak
           yang mendorong tabel ke bawah. Posisinya fixed, koordinatnya
           dihitung saat dibuka: tabelnya duduk di wadah bergulir, dan apa pun
           yang mengambang DI DALAM sana terpotong begitu daftarnya lebih
           tinggi dari kepala tabel.

           Kotak ketik di atas daftar: 23 sekolah hari ini masih bisa
           disapu mata, ratusan tahun depan tidak. Bentuknya sengaja
           seperti saringan Excel — orang di meja panitia sudah tahu
           cara memakainya tanpa diberi tahu. */
        /* .rekap-batas — Kepala kolomnya SENDIRI yang jadi tombol saringan.
           Tombol terpisah di atas tabel menjauhkan aksinya dari
           kolom yang disaringnya, dan menambah satu benda lagi di
           layar yang sudah padat. */
        /* Kolom "Nilai" per pos hanya digambar kalau posnya
           memuat LEBIH DARI SATU lomba. Pos 4 cuma punya PBB dan
           Pos 5 cuma punya Yel-Yel: di sana "PBB 82 | Nilai 82"
           adalah angka yang sama dua kali, bersebelahan. */
        /* Lima kolom perjalanan mendahului Penalti, dan urutan
           itu yang membuatnya berguna: Penalti selalu dibaca
           dengan pertanyaan "dari mana", dan jawabannya persis
           kelima kolom ini -- kontrak yang dijanjikan, jam
           berangkat, jam datang, dan berapa anggota yang tiba.
           Menaruhnya SESUDAH Penalti memaksa mata melompat balik
           melewati seluruh kolom lomba. */
        /* Nama lomba saja, TANPA rentang. Rentang menjelaskan apa
           yang boleh DIKETIK, dan di papan ini tidak ada yang
           mengetik apa pun — yang tergambar sudah poin akhir, dan
           "0 – 5" di bawah kolom berisi 80 justru membantahnya.
           Rentangnya tetap ada di layar Input Pos dan di Lembar
           Cadangan, tempat ia memang menjawab pertanyaan. */
        return `
        <div class="card">
          <div class="kepala-klasemen">
            <div class="sisi"></div>
            <h2>Klasemen sementara</h2>
            <div class="sisi kanan">${saklar}</div>
          </div>
          <div class="podium">${podiumGol(g)}</div>
          <div class="isi-filter" hidden>
            <input type="search" class="cari-filter" placeholder="Ketik nama sekolah…"
                   aria-label="Cari sekolah">
            <div class="daftar-filter">
              ${sekolahAda.map(nm => `
                <label><input type="checkbox" value="${esc(nm)}"> ${esc(nm)}</label>`).join("")}
            </div>
            <button type="button" class="button tombol-semua"
                    style="padding:.25rem .6rem;font-size:.8rem">Hapus Filter</button>
          </div>
          <div class="table-wrapper table-wrapper-tetap">
            <table class="table data-table table-tetap table-rekap table-live">
              <thead>
                <tr>
                  <th rowspan="2">#</th>
                  <th rowspan="2">No<br>Dada</th>
                  <th rowspan="2">Regu</th>
                  <th rowspan="2" class="rekap-batas th-saring" tabindex="0"
                      role="button" aria-expanded="false"
                      title="Klik untuk menyaring per sekolah">Organisasi
                    <span class="hitung-filter"></span> <span aria-hidden="true">▾</span></th>
                  ${kepalaPos.map(x => x.atas).join("")}
                  <th rowspan="2">Kontrak</th>
                  <th rowspan="2">Kloter</th>
                  <th rowspan="2">Berangkat</th>
                  <th rowspan="2">Datang</th>
                  <th rowspan="2">Anggota</th>
                  <th rowspan="2">Penalti</th>
                  <th rowspan="2">Total</th>
                </tr>
                <tr>
                  ${kepalaPos.map(x => x.bawah).join("")}
                </tr>
              </thead>
              <tbody>
                ${barisGol(g)}
              </tbody>
            </table>
          </div>
        </div>`;
  };

  /* SATU golongan pada satu waktu, dipilih lewat tab.
     Empat papan bertumpuk berarti detail Penegak PI ada empat layar penuh di
     bawah — dan yang membuka layar ini hampir selalu sedang menanyakan SATU
     golongan, bukan membandingkan keempatnya. Keempat tab tetap terlihat
     sekaligus dengan jumlah regunya, jadi yang hilang cuma gulirannya.

     Semua panel digambar sekali lalu disembunyikan, bukan digambar ulang saat
     diklik: datanya sudah ada di tangan, dan berpindah tab yang menunggu
     apa pun terasa rusak. */
  const GOL = URUT_GOLONGAN;
  const jumlahGol = Object.fromEntries(
    GOL.map(g => [g, klasemen.filter(k => k.golongan === g).length]));
  // Tab pertama yang sudah ada isinya, supaya layar tidak terbuka pada
  // golongan kosong ketika golongan lain justru sudah penuh.
  const golAktif =
    (golonganLiveScore && jumlahGol[golonganLiveScore] > 0 && golonganLiveScore)
    || GOL.find(g => jumlahGol[g] > 0) || GOL[0];

  /* Dua tombol cetak, TANPA judul kartu dan TANPA paragraf penjelas: nama
     tombolnya sudah menyebut apa yang keluar dari printer (CLAUDE.md 9.2 dan
     9.9). Tempatnya di atas tab golongan, bukan di dalam panel golongan —
     kertasnya memuat KEEMPAT golongan sekaligus, jadi tombol yang duduk di
     dalam satu tab akan terbaca seperti "cetak tab ini saja".

     Ikut hilang bersama papannya waktu belum ada regu yang bisa diperingkat:
     tombol cetak di atas papan kosong cuma bisa menghasilkan kertas kosong. */
  const cetakRekap = !klasemen.length ? "" : `
    <div class="card">
      <div class="option-row">
        <button class="button button-primary" id="cetak-rekap-sekolah" type="button">
          ${ikon("printer")} Rekap Nilai per Sekolah
        </button>
        <button class="button button-primary" id="cetak-rekap-semua" type="button">
          ${ikon("printer")} Rekap Nilai Semua
        </button>
      </div>
    </div>`;

  const tab = !klasemen.length ? "" : `
    <div class="tab-golongan" role="tablist" aria-label="Golongan">
      ${GOL.map(g => `
        <button type="button" role="tab" class="tab-gol" data-gol="${esc(g)}"
                aria-selected="${g === golAktif ? "true" : "false"}">
          ${esc(GOLONGAN_LABEL[g])}
          <span class="tab-hitung">${esc(String(jumlahGol[g]))}</span>
        </button>`).join("")}
    </div>`;

  const papan = !klasemen.length
    ? `<div class="card">
         <div class="kepala-klasemen">
           <div class="sisi"></div>
           <h2>Klasemen sementara</h2>
           <div class="sisi kanan">${saklar}</div>
         </div>
         <p class="description">Belum ada regu yang bisa diperingkat di
           golongan mana pun.</p>
       </div>`
    : GOL.map(g => `<div class="panel-gol" data-gol="${esc(g)}"${
        g === golAktif ? "" : " hidden"}>${kartuGolongan(g)}</div>`).join("");

  /* Kartu pemberitahuan DIHAPUS (CLAUDE.md 9.1 dan 9.3). Judul layarnya
     sudah "Live Score" di kepala halaman; mengulanginya di dalam badan,
     ditambah dua paragraf yang mengajarkan arti fase, adalah tiga baris yang
     dibaca ratusan kali per shift untuk satu hal yang dipelajari sekali.
     Fase yang sedang berlaku sekarang dibawa TOMBOLNYA — di situ ia fakta
     yang tidak bisa dibaca dari layar, bukan pelajaran.

     Tombolnya hanya untuk yang memegang `pengaturan` — bawaannya admin. Yang
     lain tidak melihat apa pun di tempat ini, bukan tombol mati: tombol mati
     di pojok tidak memberi tahu apa pun selain ada sesuatu yang tidak boleh
     disentuh. */
  /* Judul di TENGAH, saklar lima keadaan di KANAN, satu baris.
     Tombol besar sebelumnya memakan tinggi layar untuk sesuatu yang ditekan
     beberapa kali sepanjang acara. Kelima keadaan ditampilkan sekaligus, bukan satu
     tombol yang berganti tulisan: dengan begitu fase yang SEDANG berlaku
     terbaca tanpa harus tahu apa arti tulisan tombolnya.

     "sementara" di judulnya membawa fakta yang tidak bisa dibaca dari layar:
     papan ini memeringkat dari poin yang terkumpul SEKARANG, jadi urutannya
     bisa berubah sampai pos terakhir terisi. Tanpa kata itu, tiga medali di
     layar besar terbaca seperti hasil — dan itu yang diumumkan orang. */
  LAYAR.replaceChildren(h(`
    ${kemajuan}
    ${cetakRekap}
    ${tab}
    ${papan}`));

  /* ---- Cetak Rekap Nilai ----

     `window.print()` HARUS tetap berada dalam giliran event tap: Safari
     iPhone memblokirnya bila ada `await` lebih dulu, karena sesudah itu
     panggilannya tidak lagi dianggap berasal langsung dari pengguna. Itu
     yang membentuk kedua alur di bawah, dan yang paling terasa di alur per
     sekolah — dialog pemilih TIDAK di-await lalu dicetak sesudahnya.
     Sebaliknya, klik pada nama sekolah ITU SENDIRI yang membangun cetakan
     dan memanggil print(), masih di dalam giliran tap-nya sendiri. */
  const cetak = (judul, baris) => {
    if (!siapkanCetakRekap({ judul, baris, posKolom, rekapDada })) {
      notif("Tidak ada regu yang bisa dicetak.", true);
      return;
    }
    window.print();
  };

  document.getElementById("cetak-rekap-semua")
    ?.addEventListener("click", () => cetak("SEMUA REGU", klasemen));

  document.getElementById("cetak-rekap-sekolah")?.addEventListener("click", () => {
    /* Daftarnya dibangun dari KLASEMEN, bukan dari seluruh sekolah peserta.
       Sekolah yang regunya belum satu pun berangkat tidak punya baris untuk
       dicetak, dan menawarkannya cuma menghasilkan kertas kosong beserta
       pertanyaan kenapa. Jumlah regunya ikut tertulis supaya petugas melihat
       lebih dulu berapa baris yang akan keluar. */
    const perSekolah = new Map();
    for (const k of klasemen) {
      const nm = k.nama_sekolah || "";
      perSekolah.set(nm, (perSekolah.get(nm) || 0) + 1);
    }
    const daftar = [...perSekolah.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], "id"));

    dialog({
      judul: "Rekap Nilai per Sekolah",
      /* Satu tombol per sekolah, bukan pilihan yang harus disusul tombol
         Cetak: menekan namanya SUDAH menyatakan maksudnya, dan tombol kedua
         cuma menambah satu ketukan pada layar yang dipakai sambil berdiri
         (CLAUDE.md 9.2). Kotak carinya ada karena 23 sekolah hari ini masih
         bisa disapu mata dan ratusan tahun depan tidak — bentuknya sama
         dengan saringan sekolah di tabel, yang sudah dipakai orang di meja
         ini tanpa diberi tahu.

         Penandanya `data-sekolah-cetak`, BUKAN `data-sekolah`: nama yang
         kedua sudah dipakai baris tabel di layar yang SAMA untuk saringan
         sekolah. closest() di bawah memang tidak akan pernah menemukan baris
         itu — pendengarnya duduk di dalam dialog dan barisnya di luar — tapi
         satu nama untuk dua arti di satu layar adalah perangkap yang menunggu
         pembaca berikutnya. */
      kartuHtml: `
        <input type="search" class="cari-sekolah-cetak"
               placeholder="Ketik nama sekolah…" aria-label="Cari sekolah">
        <div class="daftar-cetak-sekolah">
          ${daftar.map(([nm, n]) => `
            <button type="button" class="button pilih-sekolah-cetak"
                    data-sekolah-cetak="${esc(nm)}">
              <span>${esc(nm)}</span>
              <span class="tab-hitung">${esc(String(n))}</span>
            </button>`).join("")}
        </div>`,
      silangSaja: true,
      pasang: (el, tutup) => {
        const cari = el.querySelector(".cari-sekolah-cetak");
        cari?.addEventListener("input", () => {
          const q = cari.value.trim().toLowerCase();
          el.querySelectorAll("[data-sekolah-cetak]").forEach(b => {
            b.hidden = q.length > 0
              && !b.dataset.sekolahCetak.toLowerCase().includes(q);
          });
        });
        el.addEventListener("click", (e) => {
          const b = e.target.closest("[data-sekolah-cetak]");
          if (!b) return;
          const nm = b.dataset.sekolahCetak;
          // Ditutup DULU, lalu dicetak — keduanya di dalam giliran tap yang
          // sama, jadi print() tetap sah di iPhone. Urutannya bukan selera:
          // dialognya `position: fixed`, dan @media print membuang .overlay,
          // tapi yang tertinggal terbuka akan menyambut petugas lagi begitu
          // dialog cetak browser ditutup.
          tutup(null);
          cetak(nm, klasemen.filter(k => (k.nama_sekolah || "") === nm));
        });
      },
    });
  });

  /* Diperbarui DI TEMPAT, bukan dengan menggambar ulang layar.
     layarLiveScore() menarik snapshot dan status, lalu menggambar ulang
     seluruh papan.
     Untuk satu kolom yang berpindah itu mahal, dan yang paling terasa: papan
     berkedip dan tab golongan yang sedang dibuka kembali ke awal. Yang
     berubah di layar cuma tombol mana yang menyala. */
  /* Rincian per pos dibuka/ditutup dengan menekan JUDULNYA, di lebar mana pun.
     Dulu yang ditekan batang ringkas yang cuma ada di HP, dan di layar lebar
     kelima cincin selalu tampil tanpa bisa ditutup — dua perilaku untuk satu
     kartu, jadi apa yang dilihat orang bergantung pada lebar layarnya. */
  const tombolKemajuan = document.getElementById("kemajuan-buka");
  const rinciKemajuan = document.getElementById("kemajuan-rinci");
  if (tombolKemajuan && rinciKemajuan) {
    tombolKemajuan.addEventListener("click", () => {
      const buka = rinciKemajuan.classList.toggle("terbuka");
      tombolKemajuan.setAttribute("aria-expanded", String(buka));
      tombolKemajuan.classList.toggle("terbuka", buka);
    });
  }

  /* Saringan sekolah tiap panel, satu fungsi per panel. Diisi jauh di bawah
     saat panelnya dipasang; yang memanggilnya cuma pasangSnapshot(). */
  const saringUlang = [];

  /** Angka baru dipasang KE LAYAR YANG SUDAH BERDIRI.
   *
   *  Yang ditukar hanya yang datang dari snapshot: cap update, cincin
   *  kelengkapan, hitungan tab, podium tiap golongan, dan baris tabelnya.
   *  Yang TIDAK disentuh sama sekali: tab golongan yang sedang dibuka, panel
   *  saringan sekolah beserta centangnya, kepala kolom, saklar fase, dan
   *  guliran \u2014 halaman maupun guliran mendatar di dalam tabelnya.
   *
   *  Sebelumnya Refresh memanggil layarLiveScore() lagi, yang mengganti
   *  SELURUH isi layar dengan pemuat lalu menggambarnya dari nol. Akibatnya
   *  tiga hal yang semuanya terasa seperti kemunduran bagi yang menekannya:
   *  layarnya berkedip kosong, saringan sekolah yang sedang dipakai terhapus,
   *  dan gulirannya harus dipulihkan dengan angka yang diingat \u2014 padahal yang
   *  menekan Refresh justru sedang MEMBACA satu baris di tengah tabel,
   *  biasanya sesudah menyimpan nilai regu itu.
   *
   *  KOLOM TIDAK IKUT DITUKAR, dan itu disengaja: kolomnya ditentukan daftar
   *  pos dan komponen, yaitu konfigurasi yang tidak berubah sepanjang pagi.
   *  Kalau suatu saat memang berubah, yang benar menggambar ulang layarnya \u2014
   *  bukan menambal kepala tabel di sini. */
  const pasangSnapshot = (baru) => {
    snapshot = baru;
    pos = baru.kelengkapan || [];
    rekap = baru.rekap || [];
    klasemen = hitungKlasemen(rekap);
    rekapDada = new Map(rekap.map(r => [r.nomor_dada, r]));

    const p = persenSemua();
    const batang = document.getElementById("js-batang-isi");
    if (batang) {
      batang.style.width = `${p}%`;
      batang.style.background = warnaPersen(p);
    }
    const persen = document.getElementById("js-persen");
    if (persen) persen.textContent = `${p}%`;
    const waktu = document.getElementById("waktu-snapshot");
    if (waktu) waktu.textContent = `Update ${tanggalJam(snapshot.dibuat_pada)}`;
    const rinci = document.getElementById("kemajuan-rinci");
    if (rinci) rinci.replaceChildren(h(cincinPos()));

    LAYAR.querySelectorAll(".panel-gol").forEach(panel => {
      const g = panel.dataset.gol;
      const podium = panel.querySelector(".podium");
      if (podium) podium.replaceChildren(h(podiumGol(g)));
      const tbody = panel.querySelector("tbody");
      if (tbody) tbody.replaceChildren(h(barisGol(g)));
      const hitung = LAYAR.querySelector(
        `.tab-gol[data-gol="${CSS.escape(g)}"] .tab-hitung`);
      if (hitung) {
        hitung.textContent = String(klasemen.filter(k => k.golongan === g).length);
      }
    });
    // Barisnya baru, jadi saringan yang sedang aktif harus dijalankan lagi \u2014
    // ia menyembunyikan baris satu per satu, dan baris yang baru lahir belum
    // pernah dilewatinya.
    saringUlang.forEach(f => f());
  };

  /* Refresh diminta petugas, bukan berjalan sendiri.

     Refresh MEMINTA DATABASE MENGHITUNG ULANG lebih dulu, baru membaca
     snapshotnya. Membaca saja cuma mengembalikan `cache_live_score` yang
     sama: yang mengisi tabel itu satu-satunya cron `refresh-live-score.yml`,
     dan cron itu sengaja hanya hidup pada tanggal lomba (CLAUDE.md 16.9 \u2014
     cron adalah tagihan berjalan, jendelanya tidak dilebarkan). Di luar dua
     hari itu tombolnya memasang angka yang sama persis, tanpa satu pun galat,
     karena membaca snapshot beku memang berhasil.

     PEMBACAAN TETAP DIJALANKAN WALAU PENGHITUNGAN GAGAL. Snapshot lama masih
     berguna dan cap waktunya jujur (itu keputusan 0146); yang tidak boleh
     terjadi adalah tombol yang tidak melakukan apa-apa lalu diam.

     Tombolnya dimatikan selama bekerja. Penghitungan bisa memakan detik, dan
     tanpa ini panitia menekannya tiga kali \u2014 yang ditahan ambang 5 detik di
     database, tapi tetap terasa seperti tombol rusak. */
  document.getElementById("refresh-live-score")?.addEventListener("click", async (e) => {
    const tombol = e.currentTarget;
    tombol.disabled = true;
    tombol.classList.add("berputar");
    try {
      await segarkanLiveScore();
    } catch (err) {
      notif(err.message, true);
    }
    try {
      pasangSnapshot(await muatDataLiveScore(cacheLiveScore));
    } catch (err) {
      notif(err.message, true);
    }
    // Tombolnya DIHIDUPKAN lagi di sini, dan itu baris yang tidak boleh
    // hilang: dulu layarLiveScore() menggambar tombol yang baru sama sekali,
    // sekarang tombolnya elemen yang sama dari awal sampai akhir.
    tombol.classList.remove("berputar");
    tombol.disabled = false;
  });

  /* Kepala tabel Live Score ada DUA baris, dan keduanya menempel di atas.
     Aturan umum `.data-table thead th` memaku semuanya di `top: 0`, jadi baris
     kedua — nama lomba — mendarat tepat di atas baris pertama dan MENUTUPI
     nama posnya. Dari layar itu terbaca seperti "Pos 1 · Kepramukaan hilang
     waktu digulir", padahal ia masih ada di bawah tumpukan.

     Tingginya diukur, tidak ditebak: "Pos 1 · Kepramukaan" membungkus jadi dua
     baris di layar sempit dan satu baris di layar lebar, jadi angka tetap
     apa pun akan benar di satu ukuran dan meninggalkan celah atau tumpang
     tindih di ukuran lain. Diukur ulang saat lebarnya berubah, karena di situ
     pula pembungkusannya berubah. */
  const sinyalLayar = sinyalLayarBaru();
  LAYAR.querySelectorAll(".table-live").forEach(tabel => {
    const baris1 = tabel.tHead && tabel.tHead.rows[0];
    if (!baris1) return;
    const ukur = () => tabel.style.setProperty(
      "--kepala-baris1", `${Math.round(baris1.getBoundingClientRect().height)}px`);
    ukur();
    const pengamatUkur = new ResizeObserver(ukur);
    pengamatUkur.observe(baris1);
    putusSaatPindah(sinyalLayar, pengamatUkur);
  });

  LAYAR.querySelectorAll("[data-fase]").forEach(tb => {
    tb.addEventListener("click", async () => {
      const ke = tb.dataset.fase;
      if (ke === fase) return;
      const semua = LAYAR.querySelectorAll("[data-fase]");
      semua.forEach(x => { x.disabled = true; });
      try {
        await aturFaseLive(ke);
        fase = ke;
        semua.forEach(x => {
          const aktif = x.dataset.fase === ke;
          x.classList.toggle("button-primary", aktif);
          if (aktif) x.setAttribute("aria-current", "true");
          else x.removeAttribute("aria-current");
        });
        /* Pesannya menyebut AKIBATNYA bagi peserta, bukan nama fasenya.
           Halaman peserta ikut dalam hitungan detik: ia membaca fase langsung
           dari database tiap poll (0070).

           Kalimat kedua pada Live sengaja ditahan. Saklar ini cuma bisa
           MEMPERKETAT — ia tidak pernah menampilkan lebih dari isi berkas yang
           sudah terbit (CLAUDE.md 14.3), dan publish-live.yml menghapus
           klasemen dari berkas itu selama fasenya belum penuh. Jadi urutannya
           mengikat: nyalakan Live DULU, terbitkan SESUDAHNYA. Tanpa kalimat
           ini, admin menekan Live, membaca "peserta dapat melihat", dan
           peserta tetap melihat papan kosong tanpa satu pun tanda kenapa —
           cron penerbitan berkala masih dimatikan di luar minggu lomba. */
        notif(ke === "juara"
          ? "Papan peserta diganti daftar juara — jalankan Publish rekap "
            + "live supaya daftarnya ikut terbit."
          : ke === "top10"
          ? "Peserta dapat melihat Top 10 per golongan — jalankan Publish "
            + "rekap live supaya angkanya ikut terbit."
          : ke === "penuh"
          ? "Live Score aktif. Peserta dapat melihat rekapitulasi penuh — "
            + "jalankan Publish rekap live supaya angkanya ikut terbit."
          : ke === "progres" ? "Peserta dapat melihat progress live score."
          : "Live Score hanya dapat dilihat panitia.");
      } catch (e) {
        notif(e.message, true);
      } finally {
        semua.forEach(x => { x.disabled = false; });
      }
    });
  });

  /* Penyaring sekolah, satu per panel golongan.
   *
   *  Menyaring BARIS TABEL saja — podium juara dibiarkan utuh. Tiga medali
   *  itu menjawab "siapa juara golongan ini"; menyaringnya per sekolah akan
   *  menjadikan regu peringkat sembilan tampil sebagai Juara 1, dan itu
   *  gambar yang difoto lalu disebarkan.
   *
   *  Peringkat di kolom pertama juga TIDAK dihitung ulang: ia peringkat di
   *  golongannya, bukan nomor urut baris yang sedang tampil. Menyaring
   *  sekolah lalu melihat "1, 4, 7" adalah jawaban yang benar. */
  /* PANEL KUNJUNGAN SEBELUMNYA DIBUANG DULU, beserta pendengarnya.
     Tiap panel dipindah ke <body> saat dipasang (alasannya beberapa baris di
     bawah), jadi ia bukan lagi keturunan LAYAR — dan mengganti isi LAYAR saat
     pindah layar tidak menyentuhnya. Yang tertinggal bukan cuma sampah:
     pendengar `document` miliknya tetap jalan di SETIAP klik di layar mana
     pun, dan kunjungan berikutnya menambah empat panel lagi. */
  pengendaliFilterSekolah?.abort();
  pengendaliFilterSekolah = new AbortController();
  const { signal } = pengendaliFilterSekolah;
  document.querySelectorAll("body > .isi-filter").forEach(n => n.remove());

  LAYAR.querySelectorAll(".panel-gol").forEach(panel => {
    const kotak = [...panel.querySelectorAll(".isi-filter input[type=checkbox]")];
    const hitung = panel.querySelector(".hitung-filter");
    const semua = panel.querySelector(".tombol-semua");
    if (!kotak.length) return;

    const terapkan = () => {
      const pilih = new Set(kotak.filter(c => c.checked).map(c => c.value));
      panel.querySelectorAll("tbody tr[data-sekolah]").forEach(tr => {
        tr.hidden = pilih.size > 0 && !pilih.has(tr.dataset.sekolah);
      });
      // Angkanya, bukan kata "aktif": panitia perlu tahu BERAPA yang sedang
      // menyaring tanpa membuka daftarnya.
      hitung.textContent = pilih.size ? `(${pilih.size})` : "";
      panel.querySelector(".th-saring").classList.toggle("menyaring", pilih.size > 0);
    };
    // Dipanggil lagi oleh Refresh: barisnya ditukar, dan baris yang baru lahir
    // belum pernah dilewati saringan ini.
    saringUlang.push(terapkan);

    const kepala = panel.querySelector(".th-saring");
    const isi = panel.querySelector(".isi-filter");
    const cariKotak = panel.querySelector(".cari-filter");
    // Panelnya DIPINDAH ke <body> saat dibuka. `position: fixed` hanya
    // relatif ke viewport selama tidak ada leluhur yang punya transform,
    // filter, atau will-change — begitu ada satu saja, ia jadi relatif ke
    // leluhur itu dan panelnya mendarat di tempat yang sama sekali lain.
    // Memindahkannya ke body menghapus seluruh pertanyaan itu.
    if (isi.parentElement !== document.body) document.body.appendChild(isi);
    const tempel = () => {
      // Ditempel ke kepala kolomnya tiap kali dibuka, bukan sekali saat
      // digambar: tabelnya bisa digulir ke samping, dan panel yang koordinatnya
      // dihitung sekali akan tertinggal di tempat lamanya.
      const r = kepala.getBoundingClientRect();
      isi.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - 300))}px`;
      isi.style.top = `${r.bottom + 2}px`;
    };
    const tutup = () => {
      isi.hidden = true;
      kepala.setAttribute("aria-expanded", "false");
    };
    const buka = () => {
      if (isi.hidden) { tempel(); isi.hidden = false; }
      else isi.hidden = true;
      kepala.setAttribute("aria-expanded", String(!isi.hidden));
      if (!isi.hidden && cariKotak) cariKotak.focus();
    };
    // Ditutup dengan klik di luar dan dengan Esc — dua jalan yang sudah
    // dipakai orang tanpa diberi tahu.
    document.addEventListener("click", e => {
      if (!isi.hidden && !isi.contains(e.target) && e.target !== kepala
          && !kepala.contains(e.target)) tutup();
    }, { signal });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") tutup();
    }, { signal });
    if (cariKotak) cariKotak.addEventListener("input", () => {
      const q = cariKotak.value.trim().toLowerCase();
      // Dicari dari `isi`, BUKAN dari `panel`. Panelnya sudah dipindah ke
      // <body> saat dipasang, jadi ia bukan lagi keturunan .panel-gol dan
      // querySelectorAll dari sana mengembalikan nol elemen — kotak ketiknya
      // tampak mati padahal huruf-hurufnya masuk.
      isi.querySelectorAll(".daftar-filter label").forEach(l => {
        l.hidden = q.length > 0 && !l.textContent.toLowerCase().includes(q);
      });
    });
    if (kepala) {
      kepala.addEventListener("click", buka);
      // Keyboard juga: <th> bukan tombol, jadi Enter/Space tidak datang
      // sendiri walau tabindex dan role sudah dipasang.
      kepala.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); buka(); }
      });
    }

    kotak.forEach(c => c.addEventListener("change", terapkan));
    if (semua) semua.addEventListener("click", () => {
      kotak.forEach(c => { c.checked = false; });
      terapkan();
    });
  });

  const bilah = LAYAR.querySelector(".tab-golongan");
  if (bilah) {
    bilah.addEventListener("click", (e) => {
      const b = e.target.closest("[data-gol]");
      if (!b) return;
      const pilih = b.dataset.gol;
      // Diingat supaya Refresh berikutnya membuka tab yang sama.
      golonganLiveScore = pilih;
      bilah.querySelectorAll("[data-gol]").forEach(x =>
        x.setAttribute("aria-selected", String(x.dataset.gol === pilih)));
      LAYAR.querySelectorAll(".panel-gol").forEach(pn => {
        pn.hidden = pn.dataset.gol !== pilih;
      });
    });
  }
}
