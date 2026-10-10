/* ============================================================================
   hrcd-rekap : screens/keberangkatan.js — layar Keberangkatan (#/keberangkatan).

   Ceklis regu di garis start, jam berangkat kloter, dan sisipan regu yang
   terlambat.
   ========================================================================== */

import { batalCeklisBerangkat, berangkatkanKloter, ceklisBerangkat,
         daftarSisipan, konfirmasiKontrak, kontrakOpsi, koreksiJamBerangkat,
         papanKeberangkatan, pindahKloter, reguKloter } from "../api.js";
import { EDISI, kartuGalat, LAYAR, layarButuhEdisi,
         pasangKepala } from "../common/frame.js";
import { dada3, dialog, esc, h, html, jamMenit, jamPadaHari, kartuGagalMuat,
         kotakJamHtml, notif, pasangKotakJam, pemuat,
         tanggalJam } from "../util.js";

/* ============================ KEBERANGKATAN ============================== */

export async function layarKeberangkatan() {
  if (!EDISI) { layarButuhEdisi("Keberangkatan"); return; }
  pasangKepala("Keberangkatan", true);
  LAYAR.replaceChildren(h(pemuat()));

  const layarIni = location.hash;
  let papan, opsi;

  /* Tanggalnya diambil dari perkiraan berangkat, yang selalu jatuh di tanggal
     lomba — BUKAN dari kalender alat pencatat. Petugas mengetik jam dinding,
     dan jam dinding tidak membawa tanggal.

     Ini bukan kehati-hatian teoretis: mencoba layar ini sebelum hari-H adalah
     persis yang menaruh "kloter 1 berangkat 2026-08-15 16:00" di database,
     enam bulan sebelum acaranya, dan membuat penalti seluruh kloter itu
     terhitung 190 hari. */
  const hariLomba = () =>
    papan.find(k => k.perkiraan_berangkat)?.perkiraan_berangkat || Date.now();
  try { [papan, opsi] = await Promise.all([papanKeberangkatan(), kontrakOpsi()]); }
  catch (e) { LAYAR.replaceChildren(kartuGagalMuat(e.message, layarKeberangkatan)); return; }
  // Daftar sisipan pindah ke sini bersama layar Pindah Kloter yang dihapus.
  // Ia TIDAK ikut dihapus: ini satu-satunya cara petugas staging tahu ada
  // nomor yang tidak tercetak di kertasnya. Boleh gagal — daftar kloternya
  // sendiri jauh lebih penting daripada hiasan ini.
  let sisipan = [];
  try { sisipan = await daftarSisipan(); } catch { /* daftar boleh telat */ }
  if (location.hash !== layarIni) return;   // lihat catatan di layarPembayaran

  if (!papan.length) {
    LAYAR.replaceChildren(h(`
      <div class="card">
        <h2>Belum ada kloter berisi regu</h2>
      </div>`));
    return;
  }

  // Kloter yang dibuka pertama: yang paling depan dan belum berangkat —
  // itulah yang sedang ditangani petugas garis start.
  let kloterAktif = (papan.find(k => !k.jam_berangkat) || papan[0]).nomor;

  /* Peringatan pemindahan terakhir, kalau ada. Ia hidup DI SINI, bukan
     ditempelkan ke DOM sesudah pemindahan, dan itu bukan kerapian.

     gambarKloter() mengosongkan #isi-kloter lalu menunggu reguKloter().
     Kartu yang ditempelkan sesudah pemanggilannya karena itu ditempelkan ke
     kotak yang SEBENTAR LAGI dikosongkan lagi: peringatannya tampil beberapa
     ratus milidetik lalu hilang sendiri — persis yang dilarang oleh
     komentarnya sendiri, dan tanpa notif() sebagai cadangan, jadi yang
     tersisa bukan pesan yang cepat melainkan tidak ada pesan sama sekali.

     Sebagai bagian dari penggambaran, ia bertahan sampai petugas berpindah
     kloter — perbuatan sadar, bukan jaringan yang kebetulan lebih cepat. */
  let peringatanPindah = null;
  let generasiKloter = 0;

  LAYAR.replaceChildren(h(`
    <div class="card">
      <div class="kloter-strip" id="pita-kloter"></div>
    </div>
    <div id="isi-kloter"></div>
  `));

  const gambarPita = () => {
    // Layarnya bisa SUDAH DITINGGALKAN. Menceklis regu memanggil server, dan
    // sesudah `await` itu petugas mungkin sudah menekan Home — pita kloternya
    // tidak ada lagi, dan `null.replaceChildren` melempar galat yang muncul
    // sebagai toast merah "Cannot read properties of null" di layar Home,
    // seolah Home yang rusak. Yang benar: tidak menggambar apa pun.
    const pita = document.getElementById("pita-kloter");
    if (!pita) return;
    pita.replaceChildren(h(papan.map(k => {
      /* Kloter yang SUDAH berangkat menampilkan JAMNYA, bukan kata
         "berangkat".

         Kata itu tidak menambah apa pun — chip-nya sudah berwarna hijau
         "berangkat", dan angka ceklis di sebelahnya sudah penuh. Sementara
         jamnya adalah hal yang justru dicari, dan sebelumnya hanya bisa
         dilihat dengan MENGETUK kloternya satu per satu lalu membaca pitanya.

         Panitia memeriksa jadwal keberangkatan dari luar — berdiri di garis
         start, melihat kloter mana berangkat pukul berapa, tanpa membuka
         satu-satu. Datanya sudah ikut di v_keberangkatan sejak awal; layar ini
         saja yang membuangnya. */
      /* Yang BELUM berangkat menampilkan PERKIRAANNYA, bukan kata "menunggu".

         "Menunggu" adalah hal yang sudah terbaca dari warna chip-nya, dan ia
         menjawab pertanyaan yang tidak ada yang ajukan. Yang ditanyakan
         sepanjang pagi cuma satu: "kloter 9 kira-kira jam berapa?" — dan
         jawabannya sudah dihitung sejak migrasi 0009, hanya belum pernah
         sampai ke layar ini (0053).

         Tandanya "~" supaya tidak pernah tertukar dengan jam yang benar-benar
         tercatat. Perkiraan bukan catatan — CLAUDE.md 10.6. */
      const label = k.jam_berangkat
        ? jamMenit(k.jam_berangkat)
        : k.perkiraan_berangkat ? `~${jamMenit(k.perkiraan_berangkat)}`
        : ({ siap: "siap", konfirmasi_kontrak: "kontrak",
             menunggu: "menunggu" }[k.posisi] || "");
      return html`
        <button type="button" class="kloter-chip ${k.posisi}${
                  k.lewat_batas && !k.jam_berangkat ? " lewat-batas" : ""}"
                data-kloter="${k.nomor}" aria-pressed="${k.nomor === kloterAktif}">
          <span class="chip-nomor">Kloter ${k.nomor}</span>
          <span class="chip-ket">${k.sudah_ceklis}/${k.jumlah_regu} · ${label}</span>
        </button>`;
    }).join("")));

    document.querySelectorAll("[data-kloter]").forEach(b =>
      b.addEventListener("click", () => {
        kloterAktif = Number(b.dataset.kloter);
        peringatanPindah = null;
        gambarPita();
        gambarKloter();
      }));
  };

  async function gambarKloter() {
    const nomor = kloterAktif;
    const giliran = ++generasiKloter;
    const kotak = document.getElementById("isi-kloter");
    kotak.replaceChildren(h(`<p>Memuat kloter ${nomor}…</p>`));

    let regu;
    try { regu = await reguKloter(nomor); }
    catch (e) {
      if (giliran !== generasiKloter || location.hash !== layarIni) return;
      kotak.replaceChildren(kartuGagalMuat(e.message, gambarKloter));
      return;
    }
    if (giliran !== generasiKloter || location.hash !== layarIni) return;

    const info = papan.find(k => k.nomor === nomor) || {};
    const sudahBerangkat = !!info.jam_berangkat;
    // Tujuan pindah = semua kloter lain, TERMASUK yang sudah berangkat.
    // Regu telat yang berlari menyusul kloter berikutnya memang berangkat
    // bersama kloter itu, pada jam kloter itu — menyembunyikannya memaksa
    // petugas mencatat kloter yang tidak ia jalani (migrasi 0018).
    const tujuanPindah = papan.filter(k => k.nomor !== nomor);
    const belumKontrak = regu.filter(r => r.sudah_ceklis && r.kontrak_menit === null);

    /* #peringatan-kontrak — Dibungkus supaya isinya bisa dihitung ulang tanpa
       menggambar ulang seluruh tabel — lihat perbaruiPeringatanKontrak(). */
    /* Kotak ketik, bukan <input type="time">: pemilih bawaan
       browser merender AM/PM kalau locale browsernya Inggris, dan
       tidak ada atribut yang bisa memaksanya 24 jam. Lihat
       jamSah() di util.js. */
    kotak.replaceChildren(h(`
      ${peringatanPindah ? kartuPeringatanPindah(peringatanPindah) : ""}
      ${kartuSisipan(sisipan.filter(s => s.kloter === nomor))}
      <div class="card">
        <div class="kloter-header">
          <h2>Kloter ${nomor}</h2>
          ${sudahBerangkat
            ? html`<span class="badge badge-green">BERANGKAT ${jamMenit(info.jam_berangkat)}</span>
                   <button class="icon-button icon-button-inline ikon-pensil" id="koreksi-jam" type="button"
                           title="Betulkan jam berangkat"
                           aria-label="Betulkan jam berangkat Kloter ${nomor}">&#9998;</button>`
            : `<span class="badge badge-yellow">BELUM BERANGKAT</span>`}
        </div>

        <div class="table-wrapper table-wrapper-tetap" style="margin-top:.6rem">
          <table class="table data-table table-tetap">
            <thead>
              <tr>
                <th class="text-center">Hadir</th><th>Nomor Dada</th><th>Regu</th>
                <th>Kontrak waktu</th><th>Pindah kloter</th>
              </tr>
            </thead>
            <tbody>
              ${regu.map(r => `
                <tr>
                  <td class="text-center">
                    <input type="checkbox" class="checkbox" data-ceklis="${esc(r.nomor_dada)}"
                           ${r.sudah_ceklis ? "checked" : ""}
                           aria-label="ceklis regu ${esc(r.nomor_dada)}">
                  </td>
                  <td class="angka">${dada3(r.nomor_dada)}</td>
                  <td>
                    <strong>${esc(r.nama_regu)}</strong>
                    <div class="sub">${esc(r.nama_sekolah)}${r.sisipan ? " · SISIPAN" : ""}</div>
                  </td>
                  <td>
                    <select class="select-small" data-kontrak="${esc(r.regu_id)}"
                            ${r.sudah_ceklis ? "disabled" : ""}>
                      <option value="">Belum dipilih</option>
                      ${opsi.map(o => `<option value="${esc(o.menit)}"
                        ${r.kontrak_menit === o.menit ? "selected" : ""}>${esc(o.label)}</option>`).join("")}
                    </select>
                  </td>
                  <td>
                    <select class="select-small" data-pindah="${esc(r.nomor_dada)}"
                            ${r.sudah_ceklis || !tujuanPindah.length ? "disabled" : ""}
                            aria-label="pindahkan regu ${esc(r.nomor_dada)} ke kloter lain">
                      <option value="">—</option>
                      ${tujuanPindah.map(k => `<option value="${esc(k.nomor)}">Kloter ${esc(k.nomor)}${
                        k.jam_berangkat ? " (sudah berangkat)" : ""}</option>`).join("")}
                    </select>
                  </td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>

        <div id="peringatan-kontrak">${!belumKontrak.length ? "" : kartuGalat(
          `${belumKontrak.length} regu sudah diceklis tapi belum punya kontrak waktu — ` +
          `keberangkatan akan ditolak.`)}</div>

        ${sudahBerangkat ? "" : `
          <div class="departure-bar">
            <div class="field" style="margin:0">
              <label for="jam-berangkat-hh">Jam berangkat</label>
              ${kotakJamHtml("jam-berangkat", jamMenit(new Date()))}
            </div>
            <button class="button button-primary" id="aksi-berangkat" type="button">
              🚩 Berangkatkan Kloter ${nomor}
            </button>
          </div>
        `}
      </div>
    `));

    /** Hitung ulang peringatan "sudah diceklis tapi belum punya kontrak"
     *  dari KEADAAN LAYAR, bukan dari data yang diambil saat tabel digambar.
     *  Ceklis dan kontrak waktu diubah tanpa menggambar ulang tabel (sengaja
     *  — menggambar ulang tiap centang membuat petugas kehilangan tempatnya
     *  saat mencentang belasan regu berturut-turut), jadi peringatan yang
     *  dihitung sekali di awal langsung basi: ia sempat tetap menuduh ada
     *  regu tanpa kontrak padahal kontraknya baru saja dipilih. */
    const perbaruiPeringatanKontrak = () => {
      const wadah = document.getElementById("peringatan-kontrak");
      if (!wadah) return;
      const kurang = [...kotak.querySelectorAll("[data-ceklis]")].filter(cb =>
        cb.checked && !cb.closest("tr")?.querySelector("[data-kontrak]")?.value);
      wadah.replaceChildren(...(kurang.length
        ? [h(kartuGalat(
            `${kurang.length} regu sudah diceklis tapi belum punya kontrak waktu — ` +
            `keberangkatan akan ditolak.`))]
        : []));
    };

    kotak.querySelectorAll("[data-ceklis]").forEach(cb => {
      // Klik beruntun diantrekan, TIDAK diblokir: petugas yang salah centang
      // langsung membatalkannya, dan kotak yang menolak klik kedua membuat
      // koreksi itu mustahil. Antrean menjaga urutannya tetap benar.
      let antre = Promise.resolve();
      cb.addEventListener("change", () => {
        const dada = Number(cb.dataset.ceklis);
        const mau = cb.checked;
        antre = antre.then(async () => {
          try {
            if (mau) await ceklisBerangkat(dada);
            else await batalCeklisBerangkat(dada);
            // Checkbox tetap menampilkan keadaan yang baru dipilih selama
            // request berjalan. Meredupkannya memberi kesan kliknya gagal
            // atau tertunda, padahal perubahan layar sudah terjadi langsung.
            // Dua dropdown di baris yang sama dikunci selama regunya
            // terceklis, dan status terkunci itu ditulis saat tabel
            // digambar. Sesudah ini yang digambar ulang hanya pita kloter di
            // atas, bukan barisnya — jadi tanpa baris ini kuncinya tertinggal
            // di keadaan lama: petugas membatalkan ceklis, lalu mendapati
            // kontrak waktu masih tidak bisa dipilih sampai layar dimuat
            // ulang. Persis keluhan di lapangan.
            const baris = cb.closest("tr");
            const kontrak = baris?.querySelector("[data-kontrak]");
            if (kontrak) kontrak.disabled = mau;
            const pindah = baris?.querySelector("[data-pindah]");
            // Pindah kloter punya syarat KEDUA: harus ada kloter tujuan.
            // Kalau tidak ada, isinya cuma "—" dan ia tetap terkunci.
            if (pindah) pindah.disabled = mau || pindah.options.length <= 1;
            perbaruiPeringatanKontrak();
            papan = await papanKeberangkatan();
            gambarPita();
          } catch (err) {
            notif(err.message, true);
            cb.checked = !mau;
          }
        });
      });
    });

    kotak.querySelectorAll("[data-kontrak]").forEach(sel =>
      sel.addEventListener("change", async () => {
        if (!sel.value) return;
        // TIDAK dinonaktifkan selama menyimpan. `select:disabled` digambar
        // abu-abu, dan abu-abu di layar ini punya arti yang sudah dipakai:
        // "regu sudah diceklis berangkat, kontraknya terkunci". Memakainya
        // juga untuk "sabar, sedang menyimpan" membuat petugas menyimpulkan
        // pilihannya tidak bisa diubah lagi — padahal bisa, dan sedetik lagi
        // kotaknya putih kembali tanpa penjelasan apa pun.
        //
        // Yang tetap dijaga adalah bahaya yang sebenarnya: dua perubahan
        // beruntun yang jawabannya datang terbalik, sehingga yang tersimpan
        // justru pilihan yang LEBIH LAMA. Nomor urut di bawah membuat jawaban
        // yang sudah ketinggalan tidak menggambar apa pun.
        const urut = String(Number(sel.dataset.urut || 0) + 1);
        sel.dataset.urut = urut;
        try {
          await konfirmasiKontrak(sel.dataset.kontrak, Number(sel.value));
          if (sel.dataset.urut !== urut) return;
          sel.classList.add("saved");
          setTimeout(() => sel.classList.remove("saved"), 1200);
        } catch (err) {
          notif(err.message, true);
        }
        perbaruiPeringatanKontrak();
      }));

    kotak.querySelectorAll("[data-pindah]").forEach(sel =>
      sel.addEventListener("change", async () => {
        const tujuan = Number(sel.value);
        if (!tujuan) return;
        const dada = Number(sel.dataset.pindah);
        const jawab = await dialog({
          judul: `Pindahkan nomor ${dada3(dada)} ke Kloter ${tujuan}?`,
          kartuHtml: html`<div class="card card-identity" style="margin-bottom:.8rem">
            <div class="nama">Dari Kloter ${nomor} ke Kloter ${tujuan}</div>
            <div class="detail">${papan.find(k => k.nomor === tujuan)?.jam_berangkat
              ? `Kloter ${tujuan} sudah berangkat — regu ini akan dinilai dari jam berangkat kloter itu.`
              : ""}</div>
          </div>`,
          medan: [{ label: "Alasan pemindahan",
                   contoh: "misal: terlambat, menyusul kloter berikutnya" }],
          labelAksi: "Pindahkan",
        });
        // Batal (atau gagal) mengembalikan select ke "—", kalau tidak ia
        // menampilkan kloter tujuan seolah pemindahan sudah terjadi.
        if (!jawab) { sel.value = ""; return; }
        sel.disabled = true;
        let hasil;
        try {
          hasil = await pindahKloter(dada, jawab[0], tujuan);
        } catch (err) {
          notif(err.message, true);
          sel.value = ""; sel.disabled = false;
          return;
        }
        // Peringatan sisipan TIDAK boleh berupa toast yang hilang sendiri:
        // petugas staging memegang kertas yang tidak memuat nomor ini. Jadi ia
        // dititipkan ke penggambaran, bukan ditempelkan sesudahnya.
        peringatanPindah = hasil.peringatan || null;
        if (!hasil.peringatan) {
          notif(`Nomor ${dada3(dada)} pindah dari Kloter ${hasil.kloter_lama} ke Kloter ${hasil.kloter_baru}.`);
        }
        papan = await papanKeberangkatan();
        // Daftar sisipan ikut disegarkan: nomor yang barusan pindah ke kloter
        // yang kertasnya sudah beredar BARU SAJA menjadi sisipan, dan tanpa
        // ini ia tidak muncul di kartu merah sampai layarnya dibuka ulang —
        // termasuk saat petugas membuka kloter tujuan untuk memeriksanya.
        try { sisipan = await daftarSisipan(); } catch { /* daftar boleh telat */ }
        gambarPita();
        gambarKloter();
      }));

    // Membetulkan jam yang sudah tercatat. Jam berangkat menentukan penalti
    // SELURUH regu di kloter ini, dan salah ketik tidak menimbulkan galat apa
    // pun — ia hanya muncul sebagai nilai yang salah saat klasemen keluar.
    // Karena itu koreksinya minta alasan dan tercatat di history.
    // Cetak daftar sisipan. Dipasang di sini, bukan lewat onclick di dalam
    // kartunya, supaya ia punya akses ke `sisipan` yang utuh — kartunya cuma
    // menampilkan kloter yang sedang dibuka, sedangkan yang dicetak semuanya.
    kotak.querySelector("[data-cetak-sisipan]")?.addEventListener("click", () => {
      const aktif = sisipan.filter(s => !s.sudah_berangkat);
      if (!aktif.length) { notif("Tidak ada regu sisipan yang belum berangkat.", true); return; }
      const n = siapkanCetakSisipan(aktif);
      notif(`${n} lembar sisipan — satu per kloter.`);
      window.print();
    });

    const tombolKoreksi = document.getElementById("koreksi-jam");
    if (tombolKoreksi) tombolKoreksi.addEventListener("click", async () => {
      // Jam kloter tetangga ditampilkan, BUKAN dipaksakan. Fungsi database
      // sengaja tidak menolak jam yang melanggar urutan (kalau menolak, dua
      // kloter yang jamnya sama-sama salah saling mengunci). Yang menangkap
      // salah ketik di sini adalah mata pencatat, jadi angka pembandingnya
      // ditaruh di depan mata.
      const sebelum = papan.filter(k => k.nomor < nomor && k.jam_berangkat).pop();
      const sesudah = papan.find(k => k.nomor > nomor && k.jam_berangkat);
      const tetangga = [
        sebelum && `Kloter ${sebelum.nomor} berangkat ${jamMenit(sebelum.jam_berangkat)}`,
        sesudah && `Kloter ${sesudah.nomor} berangkat ${jamMenit(sesudah.jam_berangkat)}`,
      ].filter(Boolean).join(" · ");

      const jawab = await dialog({
        judul: `Betulkan jam berangkat Kloter ${nomor}`,
        kartuHtml: html`<div class="card card-identity" style="margin-bottom:.8rem">
          <div class="nama">Sekarang tercatat ${jamMenit(info.jam_berangkat)}</div>
          <div class="detail">Mengubah jam ini menghitung ulang penalti waktu
            seluruh regu di Kloter ${nomor}.${tetangga ? ` ${tetangga}.` : ""}</div>
        </div>`,
        medan: [
          { label: "Jam berangkat yang benar", tipe: "jam",
            nilai: jamMenit(info.jam_berangkat) },
          { label: "Alasan koreksi", contoh: "misal: salah input" },
        ],
        labelAksi: "Simpan Koreksi",
      });
      if (!jawab) return;
      const [hhmm, alasan] = jawab;
      try {
        await koreksiJamBerangkat(nomor,
          jamPadaHari(hhmm, hariLomba()).toISOString(), alasan);
      } catch (err) { notif(err.message, true); return; }
      notif(`Jam berangkat Kloter ${nomor} dibetulkan jadi ${hhmm}.`);
      papan = await papanKeberangkatan();
      gambarPita();
      gambarKloter();
    });

    const kotakJamBerangkat = pasangKotakJam("jam-berangkat");

    const tombol = document.getElementById("aksi-berangkat");
    if (tombol) tombol.addEventListener("click", async () => {
      if (tombol.dataset.jalan === "1") return;
      if (kotakJamBerangkat.kosong()) {
        notif("Jam berangkat wajib diisi.", true); return;
      }
      // Ditolak, bukan ditebak. Jam berangkat menentukan penalti seluruh
      // kloter — menebak maksud "19:75" akan menghukum sepuluh regu sekaligus.
      const hhmm = kotakJamBerangkat.nilai();
      if (!hhmm) {
        kotakJamBerangkat.salah(true);
        kotakJamBerangkat.fokus();
        notif("Jam berangkat belum lengkap atau di luar 00:00–23:59. "
              + "Contoh: 07:15.", true);
        return;
      }
      kotakJamBerangkat.setNilai(hhmm);
      tombol.dataset.jalan = "1"; tombol.disabled = true; tombol.textContent = "Menyimpan…";
      try {
        await berangkatkanKloter(nomor,
          jamPadaHari(hhmm, hariLomba()).toISOString());
      } catch (err) {
        notif(err.message, true);
        tombol.dataset.jalan = ""; tombol.disabled = false;
        tombol.textContent = `🚩 Berangkatkan Kloter ${nomor}`;
        return;
      }
      notif(`Kloter ${nomor} berangkat ${hhmm}.`);
      papan = await papanKeberangkatan();
      gambarPita();
      gambarKloter();
    });
  }

  gambarPita();
  gambarKloter();
}

/* ============================ PINDAH KLOTER (HARI-H) ===================== */

/** Daftar sisipan: nomor-nomor yang TIDAK ADA di kertas petugas staging.
 *  Ditaruh paling atas dan diberi bingkai merah — ini satu-satunya cara
 *  petugas tahu ada regu tambahan di kloternya. */
/** Kartu merah "Bacakan ke petugas staging" — jawaban `pindah_kloter` saat
 *  nomor dipindahkan ke kloter yang kertasnya sudah beredar.
 *
 *  Dipisahkan supaya bentuknya sama dengan kartuSisipan di bawahnya: keduanya
 *  mengatakan hal yang sama kepada orang yang sama, dan dua bentuk untuk satu
 *  pesan membuat yang kedua terbaca seperti perkara lain. */
export function kartuPeringatanPindah(teks) {
  return html`
    <div class="card" style="border:3px solid var(--bahaya);background:var(--bahaya-muda)">
      <h2 style="color:var(--bahaya)">⚠️ Bacakan ke petugas staging</h2>
      <p style="font-size:1.1rem;margin-top:.4rem">${teks}</p>
    </div>`;
}

export function kartuSisipan(sisipan) {
  const aktif = sisipan.filter(s => !s.sudah_berangkat);
  if (!aktif.length) return "";
  const baris = aktif.map(s => html`
    <tr><td class="angka">${dada3(s.nomor_dada)}</td>
        <td><strong>${s.nama_regu}</strong><br>
            <span class="description">${s.nama_sekolah}</span></td>
        <td><span class="badge badge-red">Kloter ${s.kloter}</span></td>
        <td class="description">${s.alasan_sisip}</td></tr>`).join("");
  return `
    <div class="card" style="border:3px solid var(--bahaya);background:var(--bahaya-muda)">
      <h2 style="color:var(--bahaya)">⚠️ ${aktif.length} regu TIDAK ADA di kertas</h2>
      <p class="description">Nomor-nomor ini disisipkan setelah daftar kloter dicetak.
         Bacakan ke petugas staging kloter terkait, atau tulis tangan di kertasnya.</p>
      <table class="table" style="background:#fff;border-radius:8px;margin-top:.6rem">${baris}</table>
      <button class="button button-secondary" type="button" data-cetak-sisipan
              style="margin-top:.6rem">🖨️ Cetak daftar sisipan</button>
    </div>`;
}

/** LEMBAR SISIPAN — nomor-nomor yang tidak ada di kertas kloter.
 *
 *  KENAPA PERLU LEMBAR SENDIRI, dan kenapa `window.print()` telanjang tidak
 *  cukup: seluruh layar panitia disembunyikan waktu mencetak
 *  (`.header, .isi { display: none }` di @media print), dan yang tampil hanya
 *  `.printout`. Tombol yang cuma memanggil window.print() karena itu membuka
 *  dialog cetak berisi HALAMAN KOSONG — tanpa galat, tanpa tanda apa pun.
 *  Itulah yang dilaporkan sebagai "tombolnya tidak jalan".
 *
 *  SATU HALAMAN PER KLOTER, seperti daftar kloter, karena tiap lembar
 *  diserahkan ke petugas staging yang berbeda. Yang dicetak SELURUH kloter
 *  yang punya sisipan, bukan cuma kloter yang sedang dibuka: kertas ini
 *  dibawa berkeliling sekali jalan, dan menyuruh orang membuka kloter satu
 *  per satu lalu mencetak lagi adalah cara kloter terakhir terlewat.
 *
 *  Kolom Hadir ikut dicetak supaya lembar ini bisa dipakai persis seperti
 *  kertas kloter yang ia tambal — petugas mencentang di tempat yang sama.
 */
export function siapkanCetakSisipan(aktif) {
  document.getElementById("cetakan")?.remove();

  const perKloter = new Map();
  for (const s of aktif) {
    if (!perKloter.has(s.kloter)) perKloter.set(s.kloter, []);
    perKloter.get(s.kloter).push(s);
  }

  const dicetak = tanggalJam(new Date().toISOString());
  const halaman = [...perKloter.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([nomor, daftar]) => `
      <section class="print-page">
        <h1>SISIPAN KLOTER ${esc(String(nomor))} — ${esc(EDISI ? EDISI.name : "")}</h1>
        <p><strong>Nomor-nomor ini TIDAK ADA di daftar Kloter ${esc(String(nomor))}
           yang sudah dicetak.</strong> Tulis tangan di kertas kloternya, atau
           bacakan ke petugas staging.</p>
        <table class="print-table">
          <thead><tr>
            <th class="kotak">Hadir</th><th>No Dada</th><th>Nama Regu</th>
            <th>Sekolah</th><th>Alasan disisipkan</th>
          </tr></thead>
          <tbody>${daftar.map(s => html`
            <tr><td class="kotak"></td>
                <td class="dada">${dada3(s.nomor_dada)}</td>
                <td>${s.nama_regu}</td>
                <td>${s.nama_sekolah}</td>
                <td>${s.alasan_sisip}</td></tr>`).join("")}</tbody>
        </table>
        <p class="insert-note">Dicetak ${esc(dicetak)}. Regu yang disisipkan
           sesudah jam itu tidak ada di kertas ini juga.</p>
      </section>`).join("");

  document.body.appendChild(h(`<div id="cetakan" class="printout">${halaman}</div>`));
  return perKloter.size;
}
