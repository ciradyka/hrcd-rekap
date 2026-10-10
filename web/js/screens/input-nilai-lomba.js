/* ============================================================================
   hrcd-rekap : screens/input-nilai-lomba.js — layar Input Nilai Per Lomba (#/pos2).

   Satu lomba, satu regu pada satu waktu: pemilih lomba, kotak nilai, dan
   stopwatch untuk lomba berwaktu.
   ========================================================================== */

import { bolehLihat, daftarFotoLembar, hapusFotoLembar, lembarPosSatu, sesi,
         tautanFotoBanyak, unggahFotoLembar } from "../api.js";
import { aturHashLayar, ekorRute, kartuGalat, LAYAR, pasangDada3, pasangKepala,
         sinyalLayarBaru } from "../common/frame.js";
import { gambarPitaAntrean, judulIsian, judulLomba, judulPos, kartuReguNilai,
         kirimAntrean, kirimNilaiRegu, muatKatalogPos, posUntukAkun,
         selKomponen } from "../common/nilai-pos.js";
import { dada3, detikDariMs, detikSah, detikTeks, dialog, esc, GOLONGAN_LABEL,
         h, html, ikon, jamMenit, kapital, kartuGagalMuat, katalogLomba,
         kecilkanFoto, notif, pemuat, petunjukKolom, stopwatchTeks, tanggalJam,
         ukuranRapi, varianUntuk } from "../util.js";

/* ========================= INPUT NILAI POS v2 =============================

   Layar Input Nilai Pos yang lama bertanya "kamu di pos mana?", lalu
   menggambar SELURUH lomba pos itu sebagai kolom di satu tabel selebar layar
   dua kali. Bentuk itu benar untuk meja IT: di sana memang datang setumpuk
   blangko satu pos sekaligus, dan mata petugas menyusuri kolom.

   Di lapangan pertanyaannya lain. Satu petugas memegang SATU lomba selama
   satu pagi — ia tidak menyalin apa pun, ia berdiri di sebelah lomba yang
   sedang berjalan. Tabel 34 kolom di layar HP-nya adalah 33 kolom yang harus
   digeser lewat sebelum sampai ke pekerjaannya. Jadi layar ini mulai dari
   pemilih lomba lintas pos, lalu menggambar bentuk yang cocok untuk lomba
   ITU SAJA — bentuknya ditentukan jenisLomba() di util.js, dari konfigurasi:

     waktu   Bakiak, Lari Balok, Balap Karung. Ketik nomor dada, jalankan
             stopwatch, hentikan, simpan. Stopwatch boleh mulai SEBELUM
             nomornya diketik: regu berangkat lebih dulu daripada petugas
             sempat mengetik tiga angka.
     soal    Keagamaan, Kepramukaan, Kesehatan, Pengetahuan Umum, Logika.
             Peserta menjawab di lembar soalnya sendiri, jadi yang ada di
             tangan petugas setumpuk kertas — difoto borongan, lalu tiap
             ubin foto diberi nomor dada DAN angkanya sekaligus.
     nilai   sisanya. Ketik nomor dada, isi kotak tiap kriteria, simpan.

   LAYAR LAMA TIDAK DIBUANG. Selama acara berjalan (bagian 17) meja IT masih
   memakainya, dan blangko hanya bisa dicetak dari sana. Keduanya menulis
   lewat pintu yang SAMA — simpan_nilai_massal — jadi tidak ada mesin nilai
   kedua yang bisa berbeda pendapat dengan v_poin_pos.

   TIDAK ADA MIGRASI DI SINI. Seluruh RPC yang dipakai layar ini sudah ada
   sejak 0044, 0074, dan 0081; yang baru cuma susunan layarnya.
   ========================================================================= */

/* PILIHAN LOMBA TIDAK DIINGAT ANTAR KUNJUNGAN, dan itu yang membuat tombol
   "Ganti Lomba" tidak perlu ada.

   Versi pertama mengingatnya, supaya petugas yang memegang satu lomba sepagian
   tidak memilihnya ulang ratusan kali — lalu butuh satu tombol di kepala tiap
   layar untuk membatalkan ingatan itu. Tombol itu duduk di sana sepanjang pagi
   demi pekerjaan yang dilakukan sekali.

   Sekarang membuka `#/pos2` selalu mendarat di pemilih. Yang hilang cuma satu
   ketukan, dan hanya bagi orang yang MENINGGALKAN layarnya — sepanjang shift
   petugas tidak pernah pergi dari sini. */

/** "Baru saja tersimpan", SATU LARIK PER LOMBA.
 *
 *  Satu juri memegang satu lomba sepanjang pagi, dan yang ia perlu lihat di
 *  bawah layarnya cuma regu yang BARU SAJA ia nilai — untuk menjawab "tadi
 *  004 sudah masuk belum?" tanpa mengetik nomornya lagi.
 *
 *  Sebelumnya larik ini satu untuk seluruh lomba, jadi layar Bakiak
 *  menuliskan baris Semaphore yang disimpan setengah jam sebelumnya oleh
 *  orang yang sama di layar lain. Itu bukan sekadar keramaian: daftar yang
 *  memuat lomba lain membuat "sudah masuk belum" terjawab SALAH, karena regu
 *  yang tercantum di sana ternyata tercatat untuk lomba yang bukan ini.
 *
 *  Berkunci `kunci` katalog (pos + kode lomba), bukan kode lomba saja —
 *  "kekompakan" dipakai PBB di Pos 4 dan Yel-Yel di Pos 5. */
export const terakhirLomba = new Map();

export const catatLomba = (l, apa, detail) => {
  const daftar = terakhirLomba.get(l.kunci) || [];
  daftar.unshift({ jam: jamMenit(new Date()), apa, detail });
  terakhirLomba.set(l.kunci, daftar);
};

/* ---------------------------------------------------------------------------
   LAYAR 1 — pemilih lomba, lalu bentuk pengisiannya.
   ------------------------------------------------------------------------ */

export async function layarInputPos2() {
  const s = sesi();
  if (!bolehLihat("pos")) {
    pasangKepala("Input Nilai Per Lomba");
    LAYAR.replaceChildren(h(html`
      <div class="card">
        <h2>Akun meja, bukan akun pos</h2>
        <p class="description">Akun ${s.username} dipakai di meja. Input nilai
           pos memakai akun posnya sendiri — hubungi koordinator.</p>
      </div>`));
    return;
  }

  pasangKepala("Input Nilai Per Lomba", true);
  LAYAR.replaceChildren(h(pemuat()));

  const layarIni = location.hash;
  let katalogMentah;
  try { katalogMentah = await muatKatalogPos(); }
  catch (e) { LAYAR.replaceChildren(kartuGagalMuat(e.message, layarInputPos2)); return; }
  if (location.hash !== layarIni) return;

  const katalog = katalogLomba(
    posUntukAkun(s, katalogMentah.pos), katalogMentah.komponen);

  if (!katalog.length) {
    LAYAR.replaceChildren(h(`
      <div class="card"><h2>Belum ada lomba berpenilaian</h2></div>`));
    return;
  }

  /* LOMBA YANG SEDANG DIBUKA DITULIS DI ALAMATNYA — `#/pos2/2:bakiak`.

     Sebelumnya memilih lomba cuma mengganti isi layar, jadi alamatnya tetap
     `#/pos2` dan tombol Back HP melompat ke Home: petugas yang salah menekan
     Semaphore harus menempuh Home -> Input Nilai Pos v2 untuk kembali ke
     daftar yang baru saja ia tinggalkan.

     Sekarang pemilih dan lomba adalah dua alamat, jadi Back mengembalikan
     pemilihnya — perilaku yang tidak perlu diajarkan ke siapa pun. Kuncinya
     `pos:kode` (katalogLomba), dan kode lomba datang dari database, jadi ia
     di-encode. */
  const ekor = ekorRute(layarIni);
  if (ekor) {
    const l = katalog.find(x => x.kunci === ekor);
    if (l) { await bukaLomba(l); return; }
    // Kunci yang tidak dikenal — bookmark dari edisi lain, atau konfigurasi
    // yang berubah sejak alamatnya disimpan. Pemilihnya digambar, dan
    // alamatnya dirapikan tanpa menambah entri Back palsu.
    history.replaceState(null, "", "#/pos2");
    aturHashLayar("#/pos2");
  }

  gambarPemilihLomba(katalog);
}

/** Buka satu lomba: kepala layarnya, lalu bentuk pengisiannya.
 *
 *  Bar atas menyebut POS, kartu di bawahnya menyebut LOMBA. Keduanya dulu
 *  menyebut lomba, jadi "Semaphore" tercetak dua kali beruntun sementara
 *  nama pos — satu-satunya keterangan yang memberi tahu petugas ia sedang
 *  melayani meja yang mana — tidak muncul di mana pun. */
export async function bukaLomba(l) {
  pasangKepala(judulPos({ nomor: l.pos, name: l.namaPos, bayangan: l.bayangan }));
  await gambarLombaNilai(l);
}

/** Kotak per lomba, DIKELOMPOKKAN PER POS.
 *
 *  Lima belas kotak berderet tanpa kepala pos adalah lima belas nama yang
 *  harus dibaca satu per satu; dengan kepala pos, petugas Pos 2 melompat ke
 *  blok Pos 2 lalu membaca tiga. Akun yang terkunci ke satu pos cuma melihat
 *  satu blok, dan kepalanya tetap berguna di sana — ia menyebut pos mana yang
 *  dilayani akun ini, hal yang tidak tertulis di mana pun lagi di layar ini. */
export function gambarPemilihLomba(katalog) {
  const perPos = [];
  for (const l of katalog) {
    let blok = perPos.find(b => b.pos === l.pos);
    if (!blok) {
      blok = {
        pos: l.pos,
        judul: l.bayangan ? l.namaPos : `Pos ${l.pos} — ${l.namaPos}`,
        isi: [],
      };
      perPos.push(blok);
    }
    blok.isi.push(l);
  }

  /* SATU WARNA PER POS, bentuk yang sama dengan layar Kejuaraan: tepi kiri
     tebal dan judul sewarna, di atas latar tint pucat. Lima kartu seragam
     memaksa juri membaca judul tiap kartu untuk tahu ia sedang melihat pos
     mana — dan yang membuka layar ini berdiri di SATU pos, sepanjang pagi,
     mencari blok yang sama berulang kali.

     Warnanya tidak pernah jadi satu-satunya pembeda: judul tiap kartu tetap
     tertulis penuh, dan nomor posnya ada di dalam judul itu.

     Nomor posnya dibawa kelas, bukan gaya sebaris: warna adalah keputusan
     style.css, dan menuliskannya di sini berarti dua tempat harus ikut benar
     setiap kali paletnya berubah. Pos di luar 1-5 — pos bayangan — jatuh ke
     warna bawaan `.pos-blok`, bukan ke kartu tanpa warna. */
  LAYAR.replaceChildren(h(`<div id="pita-antrean"></div>` + perPos.map(b => `
    <div class="card pos-blok pos-warna-${esc(String(b.pos))}">
      <h2>${esc(b.judul)}</h2>
      <div class="pilih-lomba">
        ${b.isi.map(l => `
          <button type="button" class="lomba-kotak" data-kunci="${esc(l.kunci)}">
            <span class="lomba-nama">${esc(l.nama)}</span>
          </button>`).join("")}
      </div>
    </div>`).join("")));

  gambarPitaAntrean();
  kirimAntrean();

  LAYAR.addEventListener("click", (e) => {
    const b = e.target.closest("[data-kunci]");
    if (!b) return;
    // Yang membuka lombanya arahkan(), bukan baris ini: satu jalur saja yang
    // menggambar layar lomba, dan jalur itu sama entah petugas menekan
    // kotaknya, menekan Back, atau membuka alamatnya langsung.
    location.hash = `#/pos2/${encodeURIComponent(b.dataset.kunci)}`;
  }, { signal: sinyalLayarBaru() });
}

/** Kepala layar tiap bentuk pengisian: nama lombanya, dan tidak lebih.
 *
 *  Judul bar di atas sudah menyebut hal yang sama, tapi ia hilang di HP saat
 *  papan ketik naik dan halamannya tergulir; kartu ini ikut bergulir bersama
 *  isinya. Yang dijawabnya satu pertanyaan yang mahal kalau salah — "angka
 *  yang saya ketik ini masuk ke lomba mana?" */
export const kepalaLomba = (l) => `
  <div class="card baris-lomba">
    <h2 class="lomba-judul">${esc(l.nama)}</h2>
  </div>`;

/* ---------------------------------------------------------------------------
   BENTUK "nilai" DAN "waktu" — satu regu satu layar.

   Keduanya satu fungsi, dan itu disengaja: lomba waktu adalah lomba biasa
   yang kebetulan punya satu kolom bersatuan detik, dan stopwatch cuma alat
   pengisi kotak itu. Memisahkannya jadi dua layar berarti dua jalur simpan
   untuk satu tabel — dan jalur kedua yang jarang dipakailah yang akan
   ketinggalan waktu aturannya berubah.
   ------------------------------------------------------------------------ */

export async function gambarLombaNilai(l) {
  const sinyal = sinyalLayarBaru();
  const waktu = l.jenis === "waktu";

  /* .dada-baris — DISKUALIFIKASI DUDUK DI SINI, sejauh mungkin dari tombol
     berhenti.

     Tempatnya tidak dipilih karena maknanya berdekatan dengan nomor
     dada — melainkan karena JARAK adalah satu-satunya pengaman yang
     bekerja saat orang menekan tergesa. Selama ia bertetangga dengan
     play/stop, jempol yang meleset sekali menyimpan 0 poin untuk regu
     yang menyelesaikan lomba, dan tidak ada satu pun galat yang
     muncul saat itu terjadi.

     Kotaknya sendiri tetap yang pertama dijangkau: ia mengisi sisa
     lebar barisnya, tombolnya hanya selebar tulisannya. */
  /* #v2-foto — FOTO JAWABAN DI SINI, sebelum tombol simpan.

     Slip penilaian berpindah tangan dari pos ke kotak ke meja IT, dan
     begitu hilang tidak ada apa pun yang bisa memulihkan angkanya
     (migrasi 0047). Difoto di layar ini karena di sinilah fotonya
     tertaut sendiri ke nomor dada dan lomba yang tepat — petugas baru
     saja mengetik nomornya, dan lombanya adalah layar tempat ia berdiri.

     SEBELUM tombol simpan, bukan sesudah: sesudah menekan Simpan
     layarnya dikosongkan untuk regu berikutnya, dan foto yang belum
     diambil pada saat itu tidak akan pernah diambil. */
  /* #v2-foto-nav — TOMBOL, bukan cuma geser. Petak yang bisa digeser tidak
     mengumumkan dirinya: yang terlihat cuma satu foto, dan foto kedua
     baru ada kalau seseorang kebetulan menyapu layarnya. Penghitung
     "1 / 2" yang menyatakan ada berapa, dan panahnya yang menyatakan
     bisa dipindah — keduanya terbaca tanpa mencoba apa pun.

     Hanya muncul kalau memang lebih dari satu foto. Satu foto dengan
     panah mati di kiri-kanannya adalah dua tombol yang tidak pernah
     melakukan apa pun. */
  LAYAR.replaceChildren(h(`
    <div id="pita-antrean"></div>
    ${kepalaLomba(l)}
    <div class="card" id="v2-kartu" style="border-color:var(--utama)">
      <div class="field" style="margin-bottom:0">
        <label for="v2-dada">Nomor dada</label>
        <div class="dada-baris">
          <input type="text" id="v2-dada" class="besar" inputmode="numeric"
                 autocomplete="off" enterkeyhint="next" placeholder="001">
          ${waktu ? `<button type="button" class="button button-danger button-small sw-dq"
                  data-sw="dq">Diskualifikasi</button>` : ""}
        </div>
      </div>
      <div id="v2-regu" style="margin-top:.7rem"></div>
      ${waktu ? panelStopwatchHtml() : ""}
      <div id="v2-isian" class="isian-lomba" hidden></div>
      <div id="v2-foto" class="foto-nilai" hidden>
        <span class="foto-judul">Foto Jawaban</span>
        <span class="foto-status" id="v2-foto-status"></span>
        <span class="foto-aksi">
          <label class="button button-secondary button-small" title="Kamera">
            <input type="file" accept="image/*" capture="environment" multiple
                   hidden data-foto-ambil
                   aria-label="Foto jawaban pakai kamera">${ikon("camera")}
          </label>
          <label class="button button-secondary button-small" title="Galeri">
            <input type="file" accept="image/*" multiple hidden data-foto-ambil
                   aria-label="Foto jawaban dari galeri">${ikon("image")}
          </label>
        </span>
        <div class="foto-geser" id="v2-foto-petak" hidden></div>
        <div class="foto-navigasi" id="v2-foto-nav" hidden>
          <button type="button" class="button button-secondary button-small foto-panah"
                  data-foto-geser="-1" aria-label="Foto sebelumnya">&lsaquo;</button>
          <span class="badge foto-hitung" id="v2-foto-hitung"></span>
          <button type="button" class="button button-secondary button-small foto-panah"
                  data-foto-geser="1" aria-label="Foto berikutnya">&rsaquo;</button>
        </div>
      </div>
      <button class="button button-primary v2-simpan-lekat" id="v2-simpan"
              type="button" disabled>SIMPAN NILAI</button>
    </div>
    <div id="v2-riwayat"></div>
  `));

  gambarPitaAntrean();
  kirimAntrean();

  const inp = document.getElementById("v2-dada");
  pasangDada3(inp, sinyal);
  const kotakRegu = document.getElementById("v2-regu");
  const wadah = document.getElementById("v2-isian");
  const tombol = document.getElementById("v2-simpan");
  const barisFoto = document.getElementById("v2-foto");
  const statusFoto = document.getElementById("v2-foto-status");
  const petakFoto = document.getElementById("v2-foto-petak");
  const navFoto = document.getElementById("v2-foto-nav");
  const hitungFoto = document.getElementById("v2-foto-hitung");
  let regu = null;      // baris v_lembar_pos regu yang sedang terbuka
  let jeda = null;

  /* Kotak waktunya dicari LAGI tiap kali dipakai, tidak dipegang.
     Ia lahir ulang setiap regu — digambar oleh gambarIsian() — sementara
     panel stopwatch terpasang sekali di awal. Memegang elemennya berarti
     stopwatch menulis ke kotak milik regu yang sudah lewat. */
  /** Nama yang ditulis DI ATAS kotak atau deretan tombol satu kriteria.

   *  Nama kriteria menang, KECUALI kalau ia cuma mengulang judul lombanya.
   *  "Posisi Bidai" menyebutkan sesuatu yang tidak ada di judul "Pembidaian",
   *  jadi ia bertahan; "Semaphore" di bawah kartu bertuliskan "Semaphore"
   *  tidak menyebutkan apa pun (bagian 9.3) — dan sambil mengulang, ia
   *  menyembunyikan satu-satunya hal yang tidak bisa ditebak dari layar:
   *  bahwa 5 berarti lima kata BENAR, bukan nilai lima dari seratus.
   *
   *  Yang menggantikannya judulIsian(), fungsi yang sudah dipakai blangko
   *  kertas — jadi kata di layar dan kata di kertas tidak bisa berbeda. */
  const labelIsian = (kol, k) => (kol.nama === l.nama ? judulIsian(k) : kol.nama);

  const kotakWaktu = () => wadah.querySelector(".input-waktu");
  // Penyegar catatan diskualifikasi. null untuk lomba non-waktu, yang memang
  // tidak punya panel stopwatch sama sekali.
  const segarkanStopwatch = waktu
    ? pasangStopwatch(document.getElementById("v2-kartu"), wadah, kotakWaktu, sinyal)
    : null;

  inp.focus();
  gambarRiwayatNilai();

  const bersihkan = () => {
    regu = null;
    kotakRegu.replaceChildren();
    wadah.replaceChildren();
    wadah.hidden = true;
    barisFoto.hidden = true;
    statusFoto.textContent = "";
    fotoLomba = null;
    petakFoto.hidden = true;
    petakFoto.replaceChildren();
    navFoto.hidden = true;
    tombol.disabled = true;
    segarkanStopwatch?.();
  };

  inp.addEventListener("input", () => {
    clearTimeout(jeda);
    const dada = Number(inp.value.trim());
    // Begitu angkanya berubah, hasil lookup lama tidak boleh dipakai lagi —
    // pagar yang sama dengan layar Kedatangan, dan alasannya sama: tanpa ini
    // ketukan cepat menyimpan nilai atas nama regu SEBELUMNYA.
    if (!regu || Number(regu.nomor_dada) !== dada) bersihkan();
    if (!dada) return;
    jeda = setTimeout(() => cariDanGambar(dada), 160);
  }, { signal: sinyal });

  /* ISI KOTAK DIPILIH SAAT DIKETUK, jadi ketukan pertama MENGGANTI.
     Sesudah menyimpan, nomor dadanya sengaja dibiarkan di kotaknya sebagai
     keterangan siapa yang barusan disimpan — dan tanpa aturan ini, mengetik
     nomor berikutnya akan MENYAMBUNG ke nomor lama: "010" lalu "7" jadi
     "0107". Itu bukan nomor siapa pun, tapi "01" lalu "0" jadi "010" adalah
     nomor yang SAH milik regu lain.

     Lewat setTimeout dengan alasan yang sama dengan kotak nilai di lembar pos
     lama: Safari iOS membatalkan select() yang dipanggil di dalam penanganan
     focus itu sendiri. */
  inp.addEventListener("focusin", () => {
    if (!inp.value) return;
    setTimeout(() => {
      if (document.activeElement === inp) { try { inp.select(); } catch { /* abaikan */ } }
    }, 0);
  }, { signal: sinyal });

  inp.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    /* Enter di kotak nomor dada TIDAK menyimpan. Di layar Kedatangan ia boleh,
       karena di sana tidak ada apa pun lagi yang harus diisi sesudah nomornya;
       di sini kotak nilainya justru belum disentuh, dan Enter yang menyimpan
       akan mengirim baris kosong. Jadi ia memindahkan fokus ke kotak pertama —
       gerakan yang sama dengan Tab, tanpa melepas tangan dari papan angka. */
    const pertama = wadah.querySelector("input:not([disabled])");
    if (pertama) { pertama.focus(); if (pertama.select) pertama.select(); }
  }, { signal: sinyal });

  /** Foto lomba ini yang sudah tertaut ke regu yang sedang terbuka.
   *  null = permintaannya gagal, jadi keadaannya tidak diketahui — berbeda
   *  dari larik kosong, yang berarti benar-benar belum ada. */
  let fotoLomba = null;

  const gambarStatusFoto = () => {
    statusFoto.textContent = fotoLomba === null
      ? "foto tidak terbaca"
      : (fotoLomba.length ? `${fotoLomba.length} foto` : "belum ada");
  };

  /** Petak foto: SELEBAR KARTUNYA, satu foto satu layar penuh.
   *
   *  Yang dilihat di sini tulisan tangan di slip penilaian, dan petak kecil
   *  tidak menjawab pertanyaan yang membuat orang membukanya — "angka di
   *  kertas ini benar-benar 3 atau 8?". Jadi lebarnya penuh dan tingginya
   *  dibiarkan sampai 60% layar.
   *
   *  Lebih dari satu foto DIGESER ke samping, bukan ditumpuk ke bawah:
   *  ditumpuk, foto kedua mendorong tombol SIMPAN NILAI keluar layar, dan
   *  tombol itu yang paling sering ditekan di kartu ini. `scroll-snap`
   *  membuat gesernya berhenti tepat di satu foto, bukan di antara dua.
   *
   *  Tautan bertanda tangan diambil sekali untuk seluruh foto regu ini
   *  (tautanFotoBanyak), bukan satu permintaan per gambar. */
  /** Foto keberapa yang sedang terlihat, dipegang SENDIRI dan bukan dihitung
   *  ulang dari posisi gulirnya setiap kali.
   *
   *  Versi pertama membacanya dari `scrollLeft` di dalam penangan `scroll`,
   *  dan itu menaruh seluruh penghitungnya di atas satu peristiwa yang tidak
   *  dijamin datang: `scroll` dikirim pada frame berikutnya, jadi tab yang
   *  sedang tidak menggambar tidak mengirimkannya sama sekali — terukur nol
   *  kali walau `scrollLeft` benar-benar berpindah. Penghitung yang bertahan
   *  di "1 / 3" sementara fotonya sudah berganti lebih buruk daripada tidak
   *  ada penghitung.
   *
   *  Jadi tombolnya yang memindahkan angkanya, langsung. `scroll` tetap
   *  didengar, tapi tugasnya cuma satu: menyamakan angka ini kalau yang
   *  menggeser jari, bukan tombol. */
  let fotoKe = 0;

  const perbaruiHitungFoto = () => {
    const jml = petakFoto.children.length;
    hitungFoto.textContent = jml ? `${fotoKe + 1} / ${jml}` : "";
    // Panah yang mati di ujung menyatakan "tidak ada lagi" tanpa satu kata.
    navFoto.querySelector('[data-foto-geser="-1"]').disabled = fotoKe <= 0;
    navFoto.querySelector('[data-foto-geser="1"]').disabled = fotoKe >= jml - 1;
  };

  async function gambarPetakFoto() {
    if (!fotoLomba || !fotoLomba.length) {
      petakFoto.hidden = true;
      petakFoto.replaceChildren();
      navFoto.hidden = true;
      return;
    }
    const milik = fotoLomba;
    let peta = {};
    try { peta = await tautanFotoBanyak(milik.map(f => f.path)); }
    catch { peta = {}; }
    // Regunya bisa sudah berganti selagi tanda tangannya di jalan.
    if (fotoLomba !== milik) return;

    petakFoto.hidden = false;
    petakFoto.replaceChildren(h(milik.map((f, i) => {
      const url = peta[f.path];
      const kapan = f.diunggah_pada ? tanggalJam(f.diunggah_pada) : "";
      const judul = `Foto ${i + 1} dari ${milik.length}${kapan ? ` · ${kapan}` : ""}`;
      /* Silang hanya untuk baris yang PUNYA id. Baris hasil unggahan yang
         daftarnya gagal dibaca ulang tidak punya id, dan tombol hapus yang
         tidak tahu apa yang dihapusnya lebih baik tidak ada. */
      const silang = f.id ? `
        <button type="button" class="ubin-silang" data-hapus-foto="${esc(f.id)}"
                title="Hapus foto ${i + 1}"
                aria-label="Hapus foto ${i + 1}">${ikon("x")}</button>` : "";
      return `<div class="foto-lembar" data-putar="${esc(String(f.putaran || 0))}">
        ${url
          ? `<a class="foto-tautan" href="${esc(url)}" target="_blank" rel="noopener"
                title="${esc(judul)}"><img src="${esc(url)}" alt="${esc(judul)}"
                loading="lazy"></a>`
          : `<span class="foto-tautan foto-lembar-kosong">link gagal</span>`}
        ${silang}
      </div>`;
    }).join("")));

    petakFoto.scrollLeft = 0;
    fotoKe = 0;
    navFoto.hidden = milik.length < 2;
    perbaruiHitungFoto();
  }

  /* DIBACA SESUDAH GULIRANNYA BERHENTI, bukan pada tiap peristiwa.

     `scroll` menyala berkali-kali selama animasi, dan di tengah animasi
     `scrollLeft` masih membulat ke foto LAMA — jadi penghitungnya berkedip
     1-2-1-2 sebelum akhirnya diam di 2. Yang salah bukan rumusnya melainkan
     KAPAN ia dijalankan.

     Mematikan `scroll` selama animasi bukan jawabannya: jari juga menggeser,
     dan geseran jari tidak punya tanda mulai atau selesai. Menunggu sepersepuluh
     detik hening menutup keduanya sekaligus. */
  let jedaGulirFoto = null;
  petakFoto.addEventListener("scroll", () => {
    clearTimeout(jedaGulirFoto);
    jedaGulirFoto = setTimeout(() => {
      const jml = petakFoto.children.length;
      if (!jml) return;
      const ke = Math.max(0, Math.min(jml - 1,
        Math.round(petakFoto.scrollLeft / (petakFoto.clientWidth || 1))));
      if (ke !== fotoKe) { fotoKe = ke; perbaruiHitungFoto(); }
    }, 120);
  }, { signal: sinyal });

  /** Membaca ulang daftar foto lomba ini dari server, lalu menggambarnya.
   *
   *  Dipakai sesudah mengunggah DAN sesudah menghapus. Sesudah mengunggah ia
   *  punya alasan kedua: unggahFotoLembar tidak mengembalikan `id`, dan tanpa
   *  id foto yang baru saja diambil tidak bisa dihapus lagi sampai layarnya
   *  dibuka ulang. */
  async function segarkanFotoLomba(dada) {
    try {
      const segar = await daftarFotoLembar(l.pos, dada);
      fotoLomba = segar.filter(f => f.kode_lomba === l.kode);
    } catch { return false; }
    if (fotoKe >= fotoLomba.length) fotoKe = Math.max(0, fotoLomba.length - 1);
    gambarStatusFoto();
    await gambarPetakFoto();
    return true;
  }

  /* ALASANNYA WAJIB, dan itu bukan formalitas: foto slip adalah bukti,
     dipanggil justru ketika sebuah nilai dipertanyakan. Menghapusnya
     menghapus kemampuan menjawab pertanyaan itu, dan tidak ada satu pun galat
     yang muncul saat bukti hilang. RPC 0081 menolak alasan kosong; dialog ini
     cuma menanyakannya sebelum perjalanan jaringan.

     Kata-katanya SAMA PERSIS dengan dialog hapus foto di lembar pos lama —
     dua layar yang menghapus benda yang sama tidak boleh menanyakannya dengan
     dua kalimat berbeda. */
  petakFoto.addEventListener("click", async (e) => {
    const x = e.target.closest("[data-hapus-foto]");
    if (!x || !regu) return;
    e.preventDefault();
    const petak = x.closest(".foto-lembar");
    const ke = [...petakFoto.children].indexOf(petak) + 1;

    /* TANPA JUDUL DAN TANPA KALIMAT PENJELAS. Fotonya masih terlihat di atas
       dialog ini, jadi "foto mana" sudah terjawab layar; dan medan berlabel
       "Alasan menghapus" di atas tombol "Hapus Foto" sudah menyebutkan apa
       yang akan terjadi. Judul yang mengulang keduanya cuma mendorong medan
       isiannya turun — di HP, sampai ke bawah papan ketik (bagian 9.2). */
    const jawab = await dialog({
      medan: [{ label: "Alasan menghapus", contoh: "misal: buram, difoto ulang" }],
      labelAksi: "Hapus Foto",
    });
    if (jawab === null) return;

    x.disabled = true;
    try { await hapusFotoLembar(x.dataset.hapusFoto, jawab[0]); }
    catch (err) {
      x.disabled = false;
      notif(`Foto tidak bisa dihapus: ${err.message}`, true);
      return;
    }
    notif("Foto dihapus.");
    await segarkanFotoLomba(Number(regu.nomor_dada));
  }, { signal: sinyal });

  navFoto.addEventListener("click", (e) => {
    const b = e.target.closest("[data-foto-geser]");
    if (!b || b.disabled) return;
    const jml = petakFoto.children.length;
    fotoKe = Math.max(0, Math.min(jml - 1, fotoKe + Number(b.dataset.fotoGeser)));
    petakFoto.scrollTo({ left: fotoKe * petakFoto.clientWidth, behavior: "smooth" });
    perbaruiHitungFoto();
  }, { signal: sinyal });

  async function cariDanGambar(dada) {
    let r, foto;
    try {
      /* SATU perjalanan, bukan dua berurutan. Di pos jaringan sering putus,
         dan dua permintaan berantai berarti dua kali peluang menunggu lama
         untuk satu ketikan nomor dada.

         Daftar fotonya boleh gagal sendiri tanpa menjatuhkan barisnya:
         `null` berarti status fotonya TIDAK diketahui, dan itu berbeda dari
         "belum ada foto". Menuliskan "belum ada" untuk permintaan yang gagal
         adalah tuduhan terhadap pekerjaan yang mungkin sudah selesai. */
      [r, foto] = await Promise.all([
        lembarPosSatu(l.pos, dada),
        daftarFotoLembar(l.pos, dada).catch(() => null),
      ]);
    }
    catch (e) { kotakRegu.replaceChildren(h(kartuGalat(e.message))); return; }
    if (Number(inp.value.trim()) !== dada) return;   // sudah diketik lagi

    if (!r) {
      bersihkan();
      kotakRegu.replaceChildren(h(kartuGalat(
        `Nomor ${dada3(dada)} tidak ada di lembar ${judulLomba(l)}.`)));
      return;
    }
    regu = r;
    kotakRegu.replaceChildren(h(kartuReguNilai(r)));

    gambarIsian(r);

    /* Gembok TIDAK mematikan tombol foto. Mengunci berarti angkanya final;
       fotonya justru bukti untuk angka final itu, dan menolak bukti sesudah
       putusan adalah urutan yang terbalik. */
    barisFoto.hidden = false;
    fotoLomba = foto === null ? null : foto.filter(f => f.kode_lomba === l.kode);
    gambarStatusFoto();
    gambarPetakFoto();
  }

  /* Diunggah SEKARANG, bukan ditahan sampai tombol Simpan.
     Foto adalah bukti dan berdiri sendiri dari angkanya (0047): kalau
     unggahannya gagal, yang gagal cuma fotonya, dan angkanya tetap boleh
     disimpan. Menggabungkan keduanya di satu tombol berarti satu unggahan
     yang putus di tengah menahan nilai yang sudah benar. */
  barisFoto.addEventListener("change", async (e) => {
    const inpFoto = e.target.closest("[data-foto-ambil]");
    if (!inpFoto || !inpFoto.files || !inpFoto.files.length) return;
    if (!regu) { notif("Ketik nomor dadanya dulu.", true); inpFoto.value = ""; return; }
    const dada = Number(regu.nomor_dada);
    const berkas = [...inpFoto.files];
    // Dikosongkan supaya memilih berkas YANG SAMA lagi tetap memicu change —
    // persis yang dilakukan orang sesudah unggahan pertama gagal.
    inpFoto.value = "";

    for (const f of berkas) {
      let blob;
      try {
        statusFoto.textContent = "mengecilkan…";
        blob = await kecilkanFoto(f);
      } catch (err) { statusFoto.textContent = err.message; continue; }
      try {
        statusFoto.textContent = `mengirim ${ukuranRapi(blob.size)}…`;
        const hasil = await unggahFotoLembar(l.pos, l.kode, l.nama, dada, blob);
        /* Dibaca ulang dari server, bukan sekadar disisipkan ke daftar di
           layar: yang kembali dari unggahan cuma `path`, dan tombol hapus
           butuh `id`. Kalau pembacaannya gagal — sinyal pos memang begitu —
           barisnya tetap disisipkan supaya fotonya langsung terlihat; ia cuma
           belum bisa dihapus sampai layarnya dibuka ulang. */
        if (!(await segarkanFotoLomba(dada))) {
          fotoLomba = [{ path: hasil.path, diunggah_pada: new Date().toISOString() },
                       ...(fotoLomba || [])];
          gambarStatusFoto();
          await gambarPetakFoto();
        }
      } catch (err) {
        statusFoto.textContent = `gagal — ${err.message}`;
        notif(`Foto ${dada3(dada)} gagal terkirim: ${err.message}`, true);
      }
    }
  }, { signal: sinyal });

  /* DULU DI SINI ADA DERETAN TOMBOL ANGKA, satu tombol per nilai, dan ia
     dibuang setelah dicoba di lapangan.

     Alasan membuatnya masuk akal di atas kertas: papan angka HP menutupi
     separuh layar, jadi satu ketukan menggantikan empat. Yang tidak terlihat
     sebelum dipakai adalah harganya — Kreativitas Yel-Yel 0-35 jadi tiga baris
     berisi tiga puluh enam petak yang harus DICARI dengan mata satu per satu,
     dan empat kriteria di satu layar menjadikannya dinding. Mengetik "27"
     ternyata lebih cepat daripada menemukan 27 di antara 36 petak yang
     seragam, dan lebih sulit salah.

     Jadi kalau ide ini muncul lagi: ia sudah dicoba, dan yang mematikannya
     bukan jumlah ketukan melainkan waktu mencari. Kalau tetap ingin dicoba
     ulang, batasi pada rentang yang benar-benar kecil (0-5) dan ukur di
     lapangan, bukan di layar laptop. */

/** Kotak isian kriteria lomba ini UNTUK GOLONGAN REGU INI.
   *
   *  varianUntuk() yang memilihnya, sama seperti layar lama — Tebak Simpul
   *  punya empat baris wahana dan regu ini cuma berhak atas satu. Lomba yang
   *  tidak punya varian untuk golongan itu bukan konfigurasi rusak: lomba
   *  lapangan memang tidak berlaku untuk regu Internal (migrasi 0091). */
  function gambarIsian(r) {
    const dipakai = l.kolom
      .map(kol => ({ kol, k: varianUntuk(kol, r.golongan) }))
      .filter(x => x.k);

    if (!dipakai.length) {
      wadah.hidden = true;
      wadah.replaceChildren();
      tombol.disabled = true;
      kotakRegu.append(h(kartuGalat(
        `${l.nama} bukan untuk ${GOLONGAN_LABEL[r.golongan] || r.golongan}.`)));
      return;
    }

    const nilai = r.nilai || {};
    wadah.hidden = false;
    wadah.replaceChildren(h(dipakai.map(({ kol, k }) => `
      <div class="isian-baris">
        <label class="isian-nama" for="sel-${esc(k.kode)}">
          ${esc(labelIsian(kol, k))}<span
            class="isian-petunjuk">${esc(petunjukKolom(k))}</span>
        </label>
        ${selKomponen(k, nilai[k.kode])}
      </div>`).join("")));

    /* selKomponen menulis data-kode, bukan id — id-nya dipasang di sini
       supaya <label for> punya sasaran. Menekan nama kriterianya lalu
       mendarat di kotaknya adalah sasaran sentuh selebar barisnya, dan di HP
       itulah yang membedakan kotak 32px dari baris 44px. */
    dipakai.forEach(({ k }) => {
      const el = wadah.querySelector(`[data-kode="${CSS.escape(k.kode)}"]`);
      if (el) el.id = `sel-${k.kode}`;
    });

    /* ISYARAT TOMBOL PAPAN KETIK. Rantai `10 → 3 →` sudah bekerja sejak
       awal, tetapi tidak ada apa pun yang mengumumkannya: tombol pojok kanan
       bawah papan angka Android berlabel panah generik, dan juri menggulir
       lalu menekan SIMPAN NILAI ratusan kali per pagi tanpa tahu ada jalan
       yang lebih pendek. `enterkeyhint` membuat tombol itu sendiri yang
       mengatakannya — nol teks tambahan di layar.

       Yang terakhir "done", sisanya "next", supaya labelnya cocok dengan apa
       yang benar-benar terjadi saat ditekan (lihat penangan keydown). */
    const kotakIsi = [...wadah.querySelectorAll("input")];
    kotakIsi.forEach((el, i) => {
      el.setAttribute("enterkeyhint", i === kotakIsi.length - 1 ? "done" : "next");
    });

    /* Gembok LOMBA INI, bukan gembok posnya (0166). Layar ini menampilkan
       satu lomba pada satu waktu, jadi `r.terkunci` — yang berarti "ada lomba
       pos ini yang tergembok" — akan mematikan lomba yang justru belum
       diperiksa siapa pun.

       `lomba_terkunci` datang dari v_lembar_pos. Baris lama yang belum
       membawanya jatuh ke larik kosong, bukan ke "semuanya terkunci": yang
       menegakkan tetap server, dan layar yang mengunci sendiri karena datanya
       belum sampai lebih membingungkan daripada layar yang membiarkannya. */
    const kunci = (r.lomba_terkunci || []).includes(l.kode);
    wadah.querySelectorAll("input").forEach(el => { el.disabled = kunci; });
    tombol.disabled = kunci;
    tombol.textContent = kunci ? "DIKUNCI" : "SIMPAN NILAI";

    /* Kotak waktu dirapikan dan ditandai merah saat DITINGGALKAN, aturan yang
       sama persis dengan lembar pos lama. "1:75" terbaca wajar oleh mata tapi
       bukan waktu mana pun; tanpa penanda ia berakhir sebagai angka yang tidak
       pernah tersimpan, tanpa satu pun tanda merah. */
    const jam = kotakWaktu();
    if (jam) {
      jam.addEventListener("focusout", () => {
        const detik = detikSah(jam.value);
        if (!jam.value.trim()) jam.removeAttribute("aria-invalid");
        else if (detik === null) jam.setAttribute("aria-invalid", "true");
        else { jam.value = detikTeks(detik); jam.removeAttribute("aria-invalid"); }
      }, { signal: sinyal });
      jam.addEventListener("input", () => {
        if (detikSah(jam.value) !== null || !jam.value.trim()) {
          jam.removeAttribute("aria-invalid");
        }
      }, { signal: sinyal });
    }

    // Kotaknya baru saja lahir kembali: catatan diskualifikasi dan tombolnya
    // harus ikut membaca isi kotak YANG BARU, bukan kotak regu sebelumnya.
    segarkanStopwatch?.();
  }

  // Enter di kotak isian = simpan. Di sini ia memang aksi terakhir barisnya:
  // sesudah angkanya diketik, petugas tidak punya urusan lain dengan regu itu.
  /* ENTER BERPINDAH KE KOTAK BERIKUTNYA, dan hanya MENYIMPAN dari yang
     terakhir.

     Sebelumnya Enter di kotak mana pun langsung menyimpan. Untuk lomba
     berkriteria satu itu benar — dan hampir semua lomba begitu, jadi
     salahnya tidak pernah terlihat. Untuk Pembidaian yang punya LIMA
     kriteria, menekan Enter sesudah kriteria pertama menyimpan satu angka
     beserta empat kotak kosong, lalu mengosongkan layar untuk regu
     berikutnya. Tidak ada galat, tidak ada yang merah: juri mengira ia
     berpindah kolom, dan yang tersimpan cuma seperlima penilaiannya. */
  wadah.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.target.tagName !== "INPUT") return;
    e.preventDefault();
    const kotak = [...wadah.querySelectorAll("input:not([disabled])")];
    const i = kotak.indexOf(e.target);
    if (i >= 0 && i < kotak.length - 1) {
      const berikut = kotak[i + 1];
      berikut.focus();
      if (berikut.select) { try { berikut.select(); } catch { /* abaikan */ } }
      return;
    }
    if (!tombol.disabled) tombol.click();
  }, { signal: sinyal });

  tombol.addEventListener("click", async () => {
    if (!regu || tombol.dataset.jalan === "1") return;
    // Jaring kedua: yang disimpan HARUS regu yang nomornya sedang terlihat di
    // kotak isian, bukan sisa lookup sebelumnya.
    if (Number(regu.nomor_dada) !== Number(inp.value.trim())) {
      notif("Nomor berubah — tunggu detailnya muncul dulu.", true);
      return;
    }

    const jawab = await kirimNilaiRegu({
      pos: l.pos, kolom: l.kolom, regu, wadah, labelUntuk: labelIsian,
    });

    if (jawab.hasil === "takTerbaca") {
      notif(`${jawab.nama.join(", ")}: isinya bukan angka/waktu yang bisa `
            + "dibaca. Angka lamanya TIDAK diubah.", true);
      return;
    }
    if (jawab.hasil === "kosong") {
      notif("Tidak ada angka yang berubah.", true);
      return;
    }

    tombol.dataset.jalan = "1"; tombol.disabled = true;
    const dada = Number(regu.nomor_dada);
    const nama = regu.nama_regu;

    if (jawab.hasil === "ditolak") {
      notif(`Nomor Dada ${dada3(dada)}.\n${kapital(jawab.pesan)}`, true);
      tombol.dataset.jalan = ""; tombol.disabled = false;
      return;
    }
    if (jawab.hasil === "antre") {
      // Yang gagal TIDAK PERNAH terlihat berhasil: pesannya menyebut "BELUM
      // terkirim", dan barisnya sengaja tidak dicatat ke "Baru saja tersimpan".
      notif(`${dada3(dada)} BELUM terkirim — masuk antrean, `
            + "dikirim otomatis saat ada sinyal.", true);
      tombol.dataset.jalan = "";
      inp.value = "";
      bersihkan();
      inp.focus();
      return;
    }

    /* YANG DITULIS ANGKA MENTAH YANG BARUSAN DIKETIK, BUKAN POIN.
       Baris ini sempat berbunyi "50 poin" untuk regu yang baru saja diberi 0,
       dan angkanya tidak salah — ia `nilai_pos`, JUMLAH seluruh lomba pos itu.
       Jadi ia menjawab pertanyaan yang tidak ditanya siapa pun di sini, dengan
       angka yang datang dari lomba lain, di layar yang justru dibuat supaya
       satu juri tidak melihat lomba lain.

       Angka mentah juga yang benar menurut pembagian kerjanya: petugas
       lapangan mencatat data mentah dan tidak pernah menghitung poin
       (alur-lomba.md 8.1) — itu sebabnya blangko kertasnya pun sengaja tidak
       punya kolom Nilai Pos. */
    const ringkas = jawab.ringkasan || [];
    catatLomba(l, dada3(dada),
      `${nama}${ringkas.length ? ` · ${ringkas.join(" · ")}` : ""}`);

    /* LAYARNYA DIKOSONGKAN DAN FOKUS KEMBALI KE KOTAK NOMOR DADA.

       Satu regu selesai berarti regu berikutnya sudah berdiri di depan
       petugas, dan pekerjaan berikutnya SELALU sama: ketik nomor dadanya.
       Mengembalikan layar ke keadaan itu menghemat dua gerakan per regu —
       menggulir ke atas, lalu mengosongkan kotaknya — dikalikan ratusan regu
       sepagi.

       INI PERNAH DIBALIK, dan pembalikannya dibatalkan; kedua kalinya
       diputuskan pemilik acara. Yang membuatnya sempat terlihat salah:
       halamannya menyusut dari 929 ke 776 piksel saat dikosongkan — persis
       setinggi layar — jadi gulirannya jatuh ke 0 dan terbaca seperti layar
       yang melompat sendiri. Ia memang melompat; lompatan itu yang diinginkan.

       YANG TIDAK BOLEH IKUT MELOMPAT adalah menghapus foto. Di sana petugas
       sedang di tengah memeriksa, bukan menyelesaikan satu regu, dan tidak ada
       "berikutnya" yang menunggu di atas layar. Karena itu segarkanFotoLomba()
       hanya menggambar ulang petak fotonya dan tidak menyentuh apa pun di
       luar itu — dan tinggi petaknya dipatok supaya jumlah foto yang berubah
       tidak menggeser isi di bawahnya. */
    tombol.dataset.jalan = "";
    inp.value = "";
    bersihkan();
    inp.focus();
    gambarRiwayatNilai();
    notif(`${dada3(dada)} tersimpan.`);
  }, { signal: sinyal });

  function gambarRiwayatNilai() {
    const daftar = terakhirLomba.get(l.kunci) || [];
    document.getElementById("v2-riwayat").replaceChildren(h(
      daftar.length ? `
        <div class="card">
          <h2 style="font-size:1rem;color:var(--tinta-lembut)">
            Baru saja tersimpan (${daftar.length})</h2>
          <table class="table">${daftar.slice(0, 12).map(b => html`
            <tr><td class="angka">${b.apa}</td><td>${b.detail}</td></tr>`).join("")}
          </table>
        </div>` : ""));
  }
}

/* ---------------------------------------------------------------------------
   STOPWATCH

   Dipisah dari layarnya karena ia punya satu aturan yang gampang hilang saat
   disisipkan di tengah fungsi lain: JAMNYA HARUS BERHENTI saat layarnya
   ditinggalkan. setInterval yang terus berdetak di atas DOM yang sudah lepas
   dari halaman tidak menunjukkan gejala apa pun — sampai satu HP kehabisan
   memori di tengah acara.
   ------------------------------------------------------------------------ */

/* SATU TOMBOL untuk Mulai DAN Berhenti, di satu tempat.
   Dua tombol bersebelahan menuntut jempol berpindah di antara dua ketukan yang
   jaraknya beberapa detik — dan yang kedua, ketukan berhenti, adalah ketukan
   yang menentukan angkanya. Memindahkan jempol sambil menatap regu yang
   mendekati garis adalah cara ketukan itu meleset.

   Bahaya khas tombol yang berganti arti di bawah jempol — ketukan kedua yang
   tidak sengaja langsung menjalankannya lagi — di sini terbatas: angka yang
   barusan diukur SUDAH masuk ke kotak Waktu pada saat berhenti, jadi jam yang
   telanjur jalan lagi tidak menghapusnya. Itulah sebabnya kotaknya diisi saat
   berhenti dan bukan saat Simpan ditekan. */
/* .button — BERTULISAN, tidak berlambang, berbeda dengan play/stop di atasnya.
   Play dan stop punya lambang yang sudah dikenal dari alat perekam
   mana pun; reset tidak — panah melingkar dipakai juga untuk "muat
   ulang", "putar ulang", dan "kembalikan", dan yang ini artinya
   menghapus hitungan. Satu kata menyelesaikannya, dan tombol ini
   ditekan sambil menatap layar, bukan sambil menatap lapangan. */
export const panelStopwatchHtml = () => `
  <div class="stopwatch" id="v2-stopwatch">
    <output class="sw-angka" id="sw-angka">00:00.0</output>
    <div class="sw-kendali">
      <button type="button" class="sw-bulat sw-jalan" data-sw="jalan"
              title="Mulai" aria-label="Mulai">${ikon("play", "ikon sw-ikon")}</button>
    </div>
    <div class="sw-kendali sw-kendali-bawah">
      <button type="button" class="button button-secondary button-small sw-ulang"
              data-sw="ulang"
              title="Kembalikan penunjuk ke 00:00 — kotak Waktu tidak ikut dikosongkan"
              disabled>Reset</button>
    </div>
    <span class="sw-catatan" id="sw-catatan" hidden>Waktu 00:00 — tidak
      menyelesaikan lomba, 0 poin.</span>
  </div>`;

/** Pasang stopwatch pada kartu yang sudah tergambar.
 *
 *  `kartu`, bukan panel stopwatch-nya: Diskualifikasi sengaja duduk jauh dari
 *  play/stop — di sebelah kotak nomor dada — jadi ketiga tombol yang diurus
 *  fungsi ini tidak lagi berbagi satu induk selain kartunya.
 *
 *  `kotakWaktu` sebuah FUNGSI, bukan elemen — alasannya di pemanggilnya.
 *  Mengembalikan fungsi penyegar catatan diskualifikasi, karena kotaknya
 *  digambar ulang tiap regu dan panel ini tidak ikut tahu kapan. */
export function pasangStopwatch(kartu, wadah, kotakWaktu, sinyal) {
  const angka = document.getElementById("sw-angka");
  const catatan = document.getElementById("sw-catatan");
  const tombol = (nama) => kartu.querySelector(`[data-sw="${nama}"]`);

  /* Catatan hanya muncul saat kotaknya BENAR-BENAR berisi 00:00.
     Kalimat tetap yang selalu terpampang akan dibaca ratusan kali per shift
     untuk keadaan yang terjadi beberapa kali sepagi (bagian 9.1); yang
     dibutuhkan justru sebaliknya — ia harus muncul persis pada saat akibatnya
     berlaku, karena "00:00" sendiri tidak menyebutkan angka 0 poin di mana
     pun (bagian 9.4). */
  const perbaruiCatatan = () => {
    const kotak = kotakWaktu();
    catatan.hidden = !kotak || detikSah(kotak.value) !== 0;
    // Diskualifikasi mati selama belum ada regu di layar, atau selama nilainya
    // tergembok. Tombol yang bisa ditekan tapi tidak melakukan apa pun adalah
    // tombol yang mengajari orang bahwa layar ini kadang tidak menjawab.
    tombol("dq").disabled = !kotak || kotak.disabled;
  };
  wadah.addEventListener("input", perbaruiCatatan, { signal: sinyal });
  wadah.addEventListener("focusout", perbaruiCatatan, { signal: sinyal });

  /* performance.now(), BUKAN Date.now(): jam sistem HP bisa dikoreksi NTP di
     tengah lomba, dan koreksi satu detik ke belakang membuat stopwatch
     berjalan mundur. performance.now() monoton menurut definisinya. */
  let mulaiPada = null;   // null = tidak sedang berjalan
  let tertahan = 0;       // milidetik yang sudah terkumpul dari putaran lalu
  let tik = null;

  const terbaca = () =>
    tertahan + (mulaiPada === null ? 0 : performance.now() - mulaiPada);

  const gambar = () => { angka.textContent = stopwatchTeks(terbaca()); };

  const berhentiTik = () => { clearInterval(tik); tik = null; };
  // Satu saklar mengurus dua hal: pendengar dilepas AbortController, jamnya
  // dilepas di sini. Keduanya digantungkan ke sinyal yang sama.
  sinyal.addEventListener("abort", berhentiTik, { once: true });

  /* Satu tombol, dua lambang: play saat diam, stop saat jalan — di tempat
     yang sama. Warnanya ikut berganti, dan itu bukan hiasan: yang terbaca
     sambil menatap lapangan adalah warnanya, dan hijau yang berarti "sedang
     jalan" akan ditekan orang yang mengira ia berarti "mulai".

     Nama untuk pembaca layar ikut berganti bersama lambangnya. Tombol ikon
     yang aria-label-nya tetap "Mulai" sepanjang lomba adalah tombol yang
     berbohong kepada satu-satunya orang yang tidak bisa melihat lambangnya. */
  const perbaruiTombol = () => {
    const jalan = mulaiPada !== null;
    const b = tombol("jalan");
    const nama = jalan ? "Berhenti" : (tertahan ? "Lanjutkan" : "Mulai");
    b.innerHTML = ikon(jalan ? "square" : "play", "ikon sw-ikon");
    b.title = nama;
    b.setAttribute("aria-label", nama);
    b.classList.toggle("sw-berhenti", jalan);
    tombol("ulang").disabled = jalan || !tertahan;
  };

  kartu.addEventListener("click", (e) => {
    const b = e.target.closest("[data-sw]");
    if (!b) return;

    if (b.dataset.sw === "jalan" && mulaiPada === null) {
      mulaiPada = performance.now();
      // 100 ms: cukup rapat untuk menggerakkan persepuluh detik, cukup jarang
      // untuk tidak membebani HP yang juga sedang memegang layar ini.
      tik = setInterval(gambar, 100);
      gambar();
    } else if (b.dataset.sw === "jalan") {
      tertahan = terbaca();
      mulaiPada = null;
      berhentiTik();
      gambar();
      /* Angkanya masuk ke kotak isian SEKARANG, bukan nanti saat Simpan
         ditekan. Kotak itulah satu-satunya sumber waktu menyimpan, dan
         petugas harus bisa melihat — lalu membetulkan — angka yang akan
         benar-benar tersimpan sebelum menekan apa pun. */
      const kotak = kotakWaktu();
      if (kotak && !kotak.disabled) {
        kotak.value = detikTeks(detikDariMs(tertahan));
        kotak.removeAttribute("aria-invalid");
      }
    } else if (b.dataset.sw === "ulang" && mulaiPada === null) {
      /* KOTAK WAKTU SENGAJA TIDAK IKUT DIKOSONGKAN.
         "Ulang" disiapkan untuk regu berikutnya, dan yang sudah terukur belum
         tentu sudah tersimpan — regu yang jalannya diulang justru biasanya
         diketahui SESUDAH angkanya dicatat. Mengosongkan keduanya berarti satu
         ketukan tidak sengaja menghapus satu-satunya salinan angka yang tidak
         bisa diukur ulang. */
      tertahan = 0;
      gambar();
    } else if (b.dataset.sw === "dq") {
      /* DISKUALIFIKASI = WAKTU 00:00, bukan kolom sendiri.
         Migrasi 0147 sudah menetapkan artinya: waktu nol di Pos 2 berarti
         regu tidak menyelesaikan lomba, dan tangga poin ketiga lomba waktu
         memuat {sampai: 0, poin: 0} tepat untuk itu. Menyimpan penanda kedua
         di tempat lain berarti dua sumber untuk satu keadaan, dan yang kedua
         tidak dilihat v_poin_pos sama sekali.

         Waktu terbesar TIDAK bisa dipakai sebagai gantinya: tingkat terakhir
         berbunyi {sampai: 100000, poin: 20}, jadi regu yang didiskualifikasi
         justru pulang membawa 20 poin.

         Jamnya dihentikan dulu kalau masih berjalan — regu yang
         didiskualifikasi di tengah jalan adalah keadaan yang biasa, dan
         stopwatch yang terus berdetak di belakang angka 00:00 membingungkan
         petugas berikutnya yang melihat layar ini. */
      if (mulaiPada !== null) { tertahan = terbaca(); mulaiPada = null; berhentiTik(); }
      tertahan = 0;
      gambar();
      const kotak = kotakWaktu();
      if (kotak && !kotak.disabled) {
        kotak.value = detikTeks(0);
        kotak.removeAttribute("aria-invalid");
      }
    }
    perbaruiCatatan();
    perbaruiTombol();
  }, { signal: sinyal });

  gambar();
  perbaruiTombol();
  return perbaruiCatatan;
}
