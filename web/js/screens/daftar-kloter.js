/* ============================================================================
   hrcd-rekap : screens/daftar-kloter.js — layar Daftar Kloter (#/cetak-kloter).

   Daftar regu per kloter dengan perkiraan jam berangkat, dan cetak untuk
   petugas dan peserta.
   ========================================================================== */

import { aturPlanningBerangkat, daftarKloter, infoPengaturanKloter,
         tandaiKloterDicetak } from "../api.js";
import { EDISI, LAYAR, pasangKepala } from "../common/frame.js";
import { jadwalPlanning } from "../departure-calculator.mjs";
import { dada3, esc, GOLONGAN_LABEL, h, html, ikon, jamMenit, jamPadaHari,
         kartuGagalMuat, kotakJamHtml, notif, pasangKotakJam, pemuat,
         tanggalJam } from "../util.js";

export async function layarCetakKloter() {
  pasangKepala("Daftar Kloter");
  LAYAR.replaceChildren(h(pemuat()));

  let baris, cfg;
  // Jendela keberangkatan datang dari konfigurasi edisi — itu nilai awalnya,
  // bukan nilai matinya. Panitia menggesernya di layar ini sesudah melihat
  // berapa regu yang benar-benar mengambil nomor dada.
  try { [baris, cfg] = await Promise.all([daftarKloter(), infoPengaturanKloter()]); }
  catch (e) { LAYAR.replaceChildren(kartuGagalMuat(e.message, layarCetakKloter)); return; }

  if (!baris.length) {
    LAYAR.replaceChildren(h(`<div class="card">
      <h2>Belum ada regu berkloter</h2>
    </div>`));
    return;
  }

  // Kelompokkan per kloter. Dipakai ulang tiap kali tombol cetak ditekan,
  // karena datanya diambil segar saat itu juga.
  const kelompokkan = (rows) => {
    const peta = new Map();
    for (const b of rows) {
      if (!peta.has(b.kloter)) peta.set(b.kloter, {
        jamBerangkat: b.jam_berangkat,
        perkiraanBerangkat: b.perkiraan_berangkat,
        isi: [],
      });
      peta.get(b.kloter).isi.push(b);
    }
    return peta;
  };

  let perKloter = kelompokkan(baris);

  /* Yang dihitung REGU YANG SUDAH MENGAMBIL NOMOR DADA, bukan yang mendaftar.
     Keduanya berbeda jauh pada pagi hari-H: sekolah yang mendaftar tapi tidak
     datang tetap ada di `pendaftaran`, dan merencanakan keberangkatan dari
     angka itu menyebar jendela ke kloter yang tidak akan pernah berangkat.

     Sumbernya baris yang sudah ada di layar ini — tiap baris `v_daftar_kloter`
     adalah regu yang berkloter, dan constraint `regu_check` menjamin nomor
     dada dan kloter selalu ada bersama-sama. Jadi tidak ada permintaan kedua
     ke server untuk menghitungnya. */
  const jumlahIntern = baris.filter(
    b => String(b.golongan || "").startsWith("intern_")).length;
  const jumlahEksternal = baris.length - jumlahIntern;

  const jamPendek = (nilai) => {
    const teks = String(nilai || "");
    return /^\d{2}:\d{2}/.test(teks) ? teks.slice(0, 5) : "";
  };

  /* .table — Empat angka MENDATAR: label jadi kepala kolom, angkanya satu baris
     di bawahnya. Sebagai empat baris ia memakan setengah layar HP untuk
     empat angka yang cuma dilirik — dan yang dicari di bawahnya, kotak
     jam dan tombol Cetak, terdorong keluar layar.

     Tetap tabel, bukan grid: kepala kolom table th sudah membawa
     bentuk label yang dipakai tabel lain di layar ini, dan angkanya
     tetap sel angka yang sama. */
  /* .two-column — Rencana berangkat berdiri DI ATAS tombol cetak, dan urutan
     itu berarti: yang tercetak adalah jam yang baru saja diatur di sini.
     Menaruhnya di bawah membuat petugas menekan Cetak lebih dulu, lalu
     menemukan kotak jamnya sesudah kertasnya keluar.

     SEBARIS BERDUA, kiri dan kanan, di lebar berapa pun. Keduanya dua
     ujung dari SATU jendela — yang diatur bukan dua jam melainkan
     rentangnya — dan bertumpuk mereka terbaca seperti dua setelan yang
     tidak berhubungan, sekaligus memakan dua kali tingginya di HP.

     TANPA judul dan TANPA paragraf penjelas. Labelnya sendiri sudah
     menyebut jamnya, jadi judul di atasnya cuma mengulang
     label yang ada di bawahnya (pasal 9.3),
     dan kalimat "jam ini dibagi rata lalu tercetak untuk peserta"
     menjelaskan sesuatu yang terlihat sendiri begitu jamnya diubah
     sekali (pasal 9.1 dan 9.6). */
  LAYAR.replaceChildren(h(`
    <div class="card" style="border-color:var(--utama)">
      <table class="table table-ringkas-kloter">
        <thead>
          <tr>
            <th>Total Kloter</th><th>Total Regu</th>
            <th>Eksternal</th><th>Internal</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="angka">${perKloter.size}</td>
            <td class="angka">${baris.length}</td>
            <td class="angka">${jumlahEksternal}</td>
            <td class="angka">${jumlahIntern}</td>
          </tr>
        </tbody>
      </table>
      <div class="two-column planning-jam" style="margin-top:1rem">
        <div class="field">
          <label for="planning-pertama-hh">Jam Berangkat Pertama</label>
          ${kotakJamHtml("planning-pertama", jamPendek(
            cfg.planning_berangkat_pertama || cfg.jam_mulai_berangkat))}
        </div>
        <div class="field">
          <label for="planning-terakhir-hh">Jam Berangkat Terakhir</label>
          ${kotakJamHtml("planning-terakhir", jamPendek(
            cfg.planning_berangkat_terakhir || cfg.jam_batas_berangkat))}
        </div>
      </div>
      <div class="error" id="planning-galat" hidden></div>
      <div class="option-row" style="margin-top:.9rem">
        <button class="button button-primary" id="cetak-petugas" type="button">
          ${ikon("printer")} Cetak Kloter untuk Petugas
        </button>
        <button class="button button-primary" id="cetak-peserta" type="button">
          ${ikon("printer")} Cetak Kloter untuk Peserta
        </button>
      </div>
    </div>
    <div id="pratayang"></div>
  `));

  const waktuPertama = pasangKotakJam("planning-pertama");
  const waktuTerakhir = pasangKotakJam("planning-terakhir");
  const galatPlanning = document.getElementById("planning-galat");

  /** Jam planning tiap kloter, atau Map kosong kalau jendelanya belum sah.
   *  Kosong = kartu jatuh kembali ke perkiraan database, bukan kartu tanpa
   *  jam sama sekali — layar ini tetap harus bisa dibaca sambil jendelanya
   *  sedang diketik. */
  let planning = new Map();

  const hitungPlanning = () => {
    galatPlanning.hidden = true;
    waktuTerakhir.salah(false);
    const pertama = waktuPertama.nilai();
    const terakhir = waktuTerakhir.nilai();
    if (!pertama || !terakhir) { planning = new Map(); return; }
    try {
      planning = jadwalPlanning([...perKloter.keys()], pertama, terakhir,
                                Number(cfg.interval_berangkat_menit) || Infinity);
    } catch (e) {
      planning = new Map();
      if (/waktu berangkat terakhir/i.test(e.message)) waktuTerakhir.salah(true);
      galatPlanning.textContent = e.message;
      galatPlanning.hidden = false;
    }
  };

  /** Satu baris jam untuk kartu kloter — planning, dan yang sebenarnya.
   *
   *  KEDUANYA ditampilkan begitu kloter berangkat, bukan yang satu menggantikan
   *  yang lain. Panitia perlu menyandingkannya: rencana yang dibagikan ke
   *  peserta lawan apa yang benar-benar terjadi, dan selisihnya adalah kabar
   *  yang mereka pakai memutuskan apakah kloter berikutnya perlu digeser.
   *
   *  Yang tercatat itu pula dasar penalti seluruh regu di kloter ini, jadi ia
   *  tidak boleh terbaca seperti jadwal — pasal 10.6. */
  const barisJamKloter = (nomor, v) => {
    const rencana = planning.get(Number(nomor))
      // Jendela belum diketik lengkap: pakai perkiraan database, supaya
      // kartunya tidak pernah kehilangan jam sama sekali.
      || (v.perkiraanBerangkat ? jamMenit(v.perkiraanBerangkat) : null);

    const bagian = [];
    if (rencana) bagian.push(html`<strong>Rencana</strong> ${rencana}`);
    if (v.jamBerangkat) {
      bagian.push(html`<strong>Real</strong> ${jamMenit(v.jamBerangkat)}`);
    }
    if (!bagian.length) return "";

    let selisih = "";
    if (rencana && v.jamBerangkat) {
      // Tanggalnya diambil dari jam yang TERCATAT, bukan dari kalender alat:
      // "07:20" tidak membawa tanggal, dan layar ini dibuka juga di hari-hari
      // selain hari-H (alasan yang sama dengan hariLomba() di Keberangkatan).
      const menit = Math.round(
        (new Date(v.jamBerangkat) - jamPadaHari(rencana, v.jamBerangkat)) / 60000);
      // Kata, bukan tanda. "+15" menuntut pembacanya mengingat mana yang
      // rencana dan mana yang nyata sebelum tandanya berarti apa-apa; "telat
      // 15 menit" tidak menuntut apa pun.
      const kata = menit === 0 ? "tepat waktu"
        : menit > 0 ? `telat ${menit} menit`
        : `terlalu cepat ${Math.abs(menit)} menit`;
      selisih = html` <span class="sub">(${kata})</span>`;
    }
    return `<p>${ikon("clock")} ${bagian.join(" · ")}${selisih}</p>`;
  };

  const gambarPratayang = (peta) => {
    // CATATAN: baris tabel dirakit dengan html`` (nilai di-escape), lalu
    // digabung memakai template BIASA. Menyisipkan HTML jadi ke dalam html``
    // akan meng-escape-nya dua kali dan tabelnya tampil sebagai teks mentah.
    document.getElementById("pratayang").replaceChildren(h(
      [...peta.entries()].map(([nomor, v]) => {
        const baris = v.isi.map(r => html`
          <tr><td class="angka">${dada3(r.nomor_dada)}</td>
              <td><strong>${r.nama_regu}</strong></td>
              <td>${r.nama_sekolah}</td>
              <td>${GOLONGAN_LABEL[r.golongan] || r.golongan}</td></tr>`).join("");
        /* Labelnya menyebut ASAL angkanya, bukan cuma "jam berangkat".
           Keduanya jam yang terlihat sama di layar dan sama sekali bukan
           hal yang sama: yang satu dihitung sistem untuk merencanakan
           pagi, yang satu diketik petugas dari jam dinding dan menjadi
           dasar penalti SELURUH regu di kloter itu (pasal 10.6).

           "di Lapangan" bukan hiasan. Tanpa itu "Jam berangkat" terbaca
           seperti jadwal — dan petugas yang membaca kartu ini untuk
           memutuskan apakah sebuah kloter sudah jalan tidak punya cara
           membedakan keduanya selain mengingat kloter mana yang sudah
           ia ceklis. */
        return `
          <div class="card">
            <h2>Kloter ${esc(nomor)}</h2>
            ${barisJamKloter(nomor, v)}
            <table class="table">${baris}</table>
          </div>`;
      }).join("")));
  };

  /** Cetak semua kloter yang terlihat di pratayang, termasuk yang sudah pernah
   *  dicetak. `window.print()` HARUS tetap berada dalam giliran event tap:
   *  Safari iPhone memblokirnya bila ada `await` lebih dulu karena sesudah itu
   *  panggilannya tidak lagi dianggap berasal langsung dari pengguna.
   *
   *  Data layar sudah diambil saat layar dibuka. Menyamakan kertas dengan
   *  pratayang juga menghindari kertas diam-diam berbeda dari yang baru saja
   *  diperiksa petugas. Buka ulang layar untuk mengambil perubahan terbaru. */
  function cetak(bentuk) {
    const semuaKloter = [...perKloter.entries()];
    // Jam yang tercetak = jam yang barusan diatur di layar ini. Kertas yang
    // menyebut jam lain dari layar yang tombolnya baru saja ditekan adalah
    // kertas yang salah, dan yang memegangnya peserta.
    siapkanCetakKloter(semuaKloter, bentuk, planning);
    window.print();
    catatWaktuCetak(semuaKloter.map(([n]) => Number(n)));
  }

  /** Waktu cetak dicatat SENDIRI, tanpa bertanya.
   *
   *  Dulu ada dialog "Kertasnya sudah keluar?" supaya catatannya cuma ditulis
   *  kalau kertasnya benar-benar keluar. Yang dibeli ketelitian itu tidak
   *  sebanding harganya: TIDAK ADA SATU LAYAR PUN yang membaca `dicetak_pada`,
   *  dan sejak 0066 ia tidak lagi memagari apa pun — pengacakan otomatis cuma
   *  melihat `jam_berangkat` (CLAUDE.md 12.3). Jadi pertanyaannya menghentikan
   *  petugas yang sedang mencetak demi ketelitian sebuah catatan yang tidak
   *  pernah dibaca siapa pun.
   *
   *  Akibat yang diterima: kloter yang lembar cetaknya dibatalkan tetap
   *  tercatat pernah dicetak. Itu catatan yang keliru, bukan pekerjaan yang
   *  rusak — mencetak ulang selalu boleh (CLAUDE.md 12.1).
   *
   *  Sesudah `window.print()`, bukan sebelumnya: di iPhone lembar cetak baru
   *  mulai menggambar preview-nya sesudah baris itu lewat, dan apa pun yang
   *  menahan utas di sana membuatnya berhenti di "Loading Preview..." selamanya.
   *  Panggilan ini tidak menahan utas, tapi urutannya tetap dipertahankan.
   *
   *  Gagalnya tetap bersuara. Catatan yang tidak dibaca layar mana pun toh
   *  masih ditanyakan orang ("kloter 12 dicetak jam berapa?"), dan gagal
   *  menulis yang benar-benar diam tidak pernah bisa diperbaiki. */
  async function catatWaktuCetak(nomor) {
    try { await tandaiKloterDicetak(nomor); }
    catch (err) { notif(`Waktu cetak tidak tersimpan: ${err.message}`, true); }
  }

  document.getElementById("cetak-petugas").addEventListener("click", () => cetak("staging"));
  document.getElementById("cetak-peserta").addEventListener("click", () => cetak("umum"));

  /* Simpan jendelanya, jangan biarkan hilang saat layar dimuat ulang.
     Panitia menggesernya berkali-kali sepanjang pagi, dan jendela yang
     kembali ke 07:00 tiap refresh membuat kertas yang dicetak sesudahnya
     berbeda dari yang sebelumnya tanpa ada yang sengaja mengubahnya.

     DITUNDA 800 ms sesudah ketikan terakhir. `dengar` menyala pada tiap
     penekanan tombol, dan "0"-"7"-"3"-"0" adalah empat keadaan yang tiga di
     antaranya belum berarti apa-apa.

     Gagalnya TIDAK diam: jam yang terlihat di layar tapi tidak tersimpan
     adalah kertas yang dicetak dari rencana yang cuma ada di satu HP. */
  let jadwalSimpan = null;
  const simpanPlanning = () => {
    clearTimeout(jadwalSimpan);
    const pertama = waktuPertama.nilai();
    const terakhir = waktuTerakhir.nilai();
    if (!pertama || !terakhir || !planning.size) return;
    jadwalSimpan = setTimeout(async () => {
      try {
        await aturPlanningBerangkat(pertama, terakhir);
      } catch (err) {
        galatPlanning.textContent = `Rencana belum tersimpan: ${err.message}`;
        galatPlanning.hidden = false;
      }
    }, 800);
  };

  const perbarui = () => { hitungPlanning(); gambarPratayang(perKloter); };
  waktuPertama.dengar(() => { perbarui(); simpanPlanning(); });
  waktuTerakhir.dengar(() => { perbarui(); simpanPlanning(); });
  perbarui();
}

/** Blok cetak daftar kloter — satu kloter per halaman kertas.
 *  Dua pembaca, dua bentuk (panitia menyebutkan keduanya):
 *   - 'staging' : dipegang petugas staging, ada kolom centang kehadiran dan
 *                 tempat menulis jam berangkat sebenarnya.
 *   - 'umum'    : ditempel di papan pengumuman & dibagikan ke barak, dibaca
 *                 peserta — perkiraan berangkat dibesarkan, kolom centang
 *                 dihilangkan karena tidak ada gunanya bagi peserta.
 */
export function siapkanCetakKloter(dipakai, bentuk = "staging", planning = new Map()) {
  document.getElementById("cetakan")?.remove();
  const dicetak = tanggalJam(new Date().toISOString());

  const halaman = dipakai.map(([nomor, v]) => {
    const contoh = v.isi[0] || {};
    // Planning dari layar kalau ada; perkiraan database sebagai cadangan,
    // supaya kertas tidak pernah keluar tanpa jam sama sekali.
    const perkiraan = planning.get(Number(nomor))
      || jamMenit(contoh.perkiraan_berangkat);

    const baris = v.isi.map(r => bentuk === "staging"
      ? html`
        <tr><td class="dada">${dada3(r.nomor_dada)}</td>
            <td>${r.nama_regu}${r.sisipan ? " ★" : ""}</td>
            <td>${r.nama_sekolah}</td>
            <td>${GOLONGAN_LABEL[r.golongan] || r.golongan}</td>
            <td class="kotak-kontrak"></td>
            <td class="kotak"></td></tr>`
      : html`
        <tr><td class="dada">${dada3(r.nomor_dada)}</td>
            <td>${r.nama_regu}</td>
            <td>${r.nama_sekolah}</td>
            <td>${GOLONGAN_LABEL[r.golongan] || r.golongan}</td></tr>`).join("");

    const adaSisipan = v.isi.some(r => r.sisipan);

    /* Petugas turun ke barisnya sendiri, dan tiap isian dijaga
       nowrap. Sebaris bertiga, "Petugas:" muat di ujung kanan tapi
       garis isiannya tidak — garisnya pindah ke baris berikutnya dan
       kertasnya keluar dengan nama tanpa tempat menulis. */
    /* DUA KOLOM YANG DITULISI, BERDAMPINGAN DI UJUNG KANAN:
       Kontrak Waktu lalu Hadir.

       Hadir dulu berada di kolom PALING KIRI, dan alasannya ditulis
       di tempat ini: petugas memegang kertas di satu tangan dan HP di
       tangan lain, jadi kotak centang di ujung yang berlawanan
       membuat matanya menyeberangi seluruh baris tiap regu. Alasan
       itu berdiri selama Hadir SATU-SATUNYA yang ditulisi.

       Sekarang ada dua. Menaruh yang satu di ujung kiri dan yang lain
       di ujung kanan membuat tangan menyeberangi baris DUA KALI per
       regu — lebih mahal daripada yang dihemat aturan lama.
       Berdampingan, keduanya terisi dalam satu gerakan.

       Keputusan pemilik acara, 31 Agustus 2026. */
    return bentuk === "staging" ? `
      <section class="print-page">
        <h1>KLOTER ${esc(nomor)} — ${esc(EDISI ? EDISI.name : "")}</h1>
        <p><strong>Perkiraan jam berangkat: ${esc(perkiraan)}</strong>
           · <span style="white-space:nowrap">Jam sebenarnya: ________</span><br>
           <span style="white-space:nowrap">Petugas: ________________</span></p>
        <table class="print-table">
          <thead><tr><th>No Dada</th><th>Nama Regu</th><th>Sekolah</th><th>Golongan</th><th class="kotak-kontrak">Kontrak Waktu</th><th class="kotak">Hadir</th></tr></thead>
          <tbody>${baris}</tbody>
        </table>
        ${adaSisipan ? `<p class="insert-note">★ = regu sisipan, ditambahkan setelah kertas ini dicetak.</p>` : ""}
        <p class="print-note">Dicetak ${esc(dicetak)}.</p>
      </section>` : `
      <section class="print-page">
        <h1>KLOTER ${esc(nomor)}</h1>
        <p class="jam-besar">Perkiraan jam berangkat: ${esc(perkiraan)}</p>
        <table class="print-table">
          <thead><tr><th>No Dada</th><th>Nama Regu</th><th>Sekolah</th><th>Golongan</th></tr></thead>
          <tbody>${baris}</tbody>
        </table>
        <p class="print-note">Bersiap di staging paling lambat 15 menit sebelum
           perkiraan berangkat.<br>
           Jam sebenarnya bisa bergeser, ikuti panggilan petugas.<br>
           Dicetak ${esc(dicetak)}.</p>
      </section>`;
  }).join("");
  document.body.appendChild(h(`<div id="cetakan" class="printout">${halaman}</div>`));
}
