/* ============================================================================
   hrcd-rekap : screens/kedatangan.js — layar Kedatangan (#/finish).

   Mencatat regu yang tiba di garis finish.
   ========================================================================== */

import { cariRegu, catatFinish, infoPenalti } from "../api.js";
import { catatTerakhir, kartuGalat, LAYAR, pasangDada3, pasangKepala,
         terakhir } from "../common/frame.js";
import { bacaAnggotaHadir, dada3, esc, GOLONGAN_LABEL, h, html, jamMenit,
         jamPadaHari, kotakJamHtml, notif, pasangKotakJam } from "../util.js";

/* ============================ MEJA FINISH ================================ */

/** Target panitia: DUA aksi, ±3 detik per regu — "ketik nomor, klik Sampai".
 *  Karena itu TIDAK ADA tombol Cari: detail regu muncul sendiri sambil
 *  mengetik, dan Enter sama dengan menekan tombol. Echo-confirm tetap ada
 *  karena kartu identitas sudah terpampang saat operator menekan.
 *
 *  Jam yang tersimpan adalah jam saat TOMBOL DITEKAN di laptop panitia —
 *  bukan cap waktu server saat data sampai (alur 10.2). Untuk pencatatan
 *  susulan dari kertas, jamnya bisa diubah.
 */
export function layarFinish() {
  pasangKepala("Kedatangan");
  /* TOMBOL adalah pencatat utama di meja ini; kertas panitia hanya
     untuk cek silang. Jadi jam & anggota sengaja TIDAK sejajar dengan tombol —
     keduanya dipakai saat memperbaiki hasil verifikasi, bukan tiap regu. */
  /* Kotak ketik, alasan sama dengan jam berangkat: pemilih bawaan
     browser bisa muncul sebagai AM/PM. Lihat jamSah() di util.js. */
  LAYAR.replaceChildren(h(`
    <div class="card" style="border-color:var(--utama)">
      <div class="field" style="margin-bottom:0">
        <label for="dada">Nomor dada</label>
        <input type="text" id="dada" class="besar" inputmode="numeric"
               autocomplete="off" placeholder="001">
      </div>
      <div id="kartu-regu" style="margin-top:.7rem"></div>
      <button class="button button-primary" id="sampai" type="button" disabled
              style="margin-top:.7rem;min-height:60px;font-size:1.2rem">
        ✅ SAMPAI DI FINISH
      </button>
      <details style="margin-top:.6rem">
        <summary style="cursor:pointer;min-height:40px;font-size:.9rem;color:var(--tinta-lembut)">
          Perbaiki jam atau jumlah anggota
        </summary>
        <div class="two-column pasangan-sempit" style="margin-top:.5rem">
          <div class="field" style="margin:0">
            <label for="jam-hh">Jam datang</label>
            ${kotakJamHtml("jam")}
          </div>
          <div class="field" style="margin:0">
            <label for="hadir">Anggota hadir</label>
            <input type="number" id="hadir" min="0" max="5" inputmode="numeric" value="5">
          </div>
        </div>
        <div id="dampak-jam" style="margin-top:.5rem"></div>
      </details>
    </div>
    <div id="riwayat-finish"></div>
  `));

  const inp = document.getElementById("dada");
  pasangDada3(inp);
  const kotak = document.getElementById("kartu-regu");
  const tombol = document.getElementById("sampai");
  const inpJam = pasangKotakJam("jam");
  const inpHadir = document.getElementById("hadir");
  let regu = null;
  let jeda = null;

  /* NOMOR DADA yang isian koreksinya diisi oleh SISTEM, atau null kalau
     isinya diketik petugas sendiri.

     Dua kebutuhan bertabrakan di dua kotak yang sama. Regu yang sudah tercatat
     ditampilkan jam lamanya supaya verifikasi terhadap kertas tinggal
     membandingkan; sementara petugas yang menyalin sederet catatan kertas
     sering mengetik jamnya lebih dulu lalu membetulkan nomornya — itu sebabnya
     bersihkan() sengaja tidak mengosongkan keduanya.

     Bedanya cuma SIAPA yang mengisi. Isian sistem milik satu regu tertentu dan
     harus pergi bersama regu itu; isian petugas miliknya sendiri dan tidak
     boleh disentuh. Tanpa pembedaan ini, mengetik 042 yang sudah tercatat
     10:30 lalu berpindah ke 043 yang baru masuk pukul 11:05 menyimpan 043
     sebagai datang 10:30 — di kotak yang tidak terlihat, karena panelnya
     tertutup. */
  let isianDariSistem = null;

  inp.focus();
  gambarRiwayat();

  const enter = (e) => {
    if (e.key === "Enter" && !tombol.disabled) { e.preventDefault(); tombol.click(); }
  };
  inpJam.pada("keydown", enter);
  inpHadir.addEventListener("keydown", enter);

  // Angka penalti dipakai untuk menjawab pertanyaan yang sebenarnya saat
  // membandingkan catatan kertas dengan jam tombol: bukan "beda berapa menit",
  // melainkan "apakah bedanya MENGUBAH penalti". Sejak migrasi 0089 setiap
  // selisih satu menit mengubah penalti satu poin; badge yang ikut berubah pada
  // tiap menit adalah perilaku yang disengaja, bukan noise.
  let PENALTI = null;
  infoPenalti().then(p => { PENALTI = p; }).catch(() => {});

  const hitungPenalti = (jam, target) => {
    if (!PENALTI || !target) return null;
    const selisih = Math.abs(new Date(jam) - new Date(target)) / 60000;
    return Math.floor(selisih / PENALTI.blok_menit) * Number(PENALTI.penalti_per_blok);
  };

  const perbaruiDampak = () => {
    const el = document.getElementById("dampak-jam");
    if (!el) return;
    if (!regu || !regu.target_datang || !PENALTI) { el.replaceChildren(); return; }
    // Pembandingnya beda menurut keadaan: regu yang BELUM tercatat dibandingkan
    // dengan jam tombol sekarang; yang SUDAH tercatat dibandingkan dengan jam
    // yang tersimpan — itulah angka yang sedang diverifikasi terhadap kertas.
    const dasar = regu.sudah_finish && regu.jam_datang
      ? new Date(regu.jam_datang) : new Date();
    // Setengah jam yang sedang diketik ("07" menuju "07:15") bukan jam, dan
    // menghitung dampak dari angka setengah jadi membuat lencananya
    // berkedip-kedip menampilkan penalti yang tidak pernah berlaku.
    const isi = inpJam.nilai();
    const jamIsi = isi ? jamPadaHari(isi, regu.target_datang) : dasar;
    const pDasar = hitungPenalti(dasar, regu.target_datang);
    const pIsi = hitungPenalti(jamIsi, regu.target_datang);
    const tulis = (n) => n === 0 ? "0" : `−${n}`;

    if (!isi) {
      el.innerHTML = html`<span class="badge badge-gray">Penalti waktu: ${tulis(pDasar)}</span>`;
      return;
    }
    const beda = Math.round((jamIsi - dasar) / 60000);
    if (beda === 0) {
      el.innerHTML = html`<span class="badge badge-green">Sama dengan catatan — penalti ${tulis(pIsi)}</span>`;
      return;
    }
    const arah = beda > 0 ? `${beda} menit lebih lambat` : `${-beda} menit lebih awal`;
    el.innerHTML = pIsi === pDasar
      ? html`<span class="badge badge-green">${arah} — penalti tetap ${tulis(pIsi)}</span>`
      : html`<span class="badge badge-yellow">${arah} — penalti berubah ${tulis(pDasar)} → ${tulis(pIsi)}</span>`;
  };
  /* Panel koreksi DIBUKA begitu salah satu kotaknya berisi. Isi yang tidak
     terlihat tetap ikut tersimpan saat tombol ditekan, dan lencana "penalti
     berubah" yang seharusnya memperingatkan justru ikut tersembunyi di
     dalamnya. Yang punya akibat harus kelihatan. */
  const panelKoreksi = inpHadir.closest("details");
  const bukaKalauBerisi = () => {
    if (!panelKoreksi) return;
    const berisi = !inpJam.kosong() || inpHadir.value.trim() !== "5";
    if (berisi) panelKoreksi.open = true;
  };

  // Ketikan petugas membatalkan penanda: sejak itu isinya miliknya, dan
  // berpindah regu tidak boleh membuangnya.
  inpJam.dengar(() => { isianDariSistem = null; bukaKalauBerisi(); perbaruiDampak(); });
  inpHadir.addEventListener("input", () => {
    isianDariSistem = null;
    if (bacaAnggotaHadir(inpHadir.value, inpHadir.validity?.badInput) !== null) {
      inpHadir.removeAttribute("aria-invalid");
    }
    bukaKalauBerisi();
  });
  // Bentuknya dirapikan saat kotak ditinggalkan, jadi lencana dampaknya ikut
  // dihitung ulang sesudah itu — tanpa ini "745" yang jadi "07:45" saat blur
  // meninggalkan lencana menampilkan hitungan dari teks yang sudah tidak ada.

  const bersihkan = () => {
    regu = null;
    kotak.replaceChildren();
    tombol.disabled = true;
    // Jam & anggota TIDAK dikosongkan di sini: saat menyalin sederet catatan
    // kertas, operator sering mengetik jam lalu baru memperbaiki nomornya.
  };

  // Lookup otomatis sambil mengetik — jeda pendek supaya tidak memanggil
  // server di tiap ketukan, tapi tetap terasa seketika.
  inp.addEventListener("input", () => {
    clearTimeout(jeda);
    const dada = Number(inp.value.trim());
    // PENTING: begitu angkanya berubah, hasil lookup lama tidak boleh dipakai
    // lagi. Tanpa ini, operator yang mengetik nomor baru lalu langsung menekan
    // Enter akan menyimpan regu SEBELUMNYA — mencatat regu yang salah datang.
    // (Ditemukan saat menguji alur ketik-Enter.)
    if (!regu || regu.nomor_dada !== dada) {
      regu = null;
      tombol.disabled = true;
    }
    if (!dada) { bersihkan(); return; }
    jeda = setTimeout(() => cariDanTampilkan(dada), 160);
  });

  inp.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (!tombol.disabled) tombol.click();
  });

  async function cariDanTampilkan(dada) {
    let r;
    try { r = await cariRegu(dada); }
    catch (e) { kotak.replaceChildren(h(kartuGalat(e.message))); return; }
    if (Number(inp.value.trim()) !== dada) return;   // operator sudah mengetik lagi

    if (!r) {
      regu = null; tombol.disabled = true;
      kotak.replaceChildren(h(kartuGalat(`Nomor ${esc(dada)} tidak dikenal.`)));
      return;
    }
    regu = r;

    // Keadaan yang menghalangi, ditampilkan jelas alih-alih jadi galat nanti.
    let halangan = null;
    if (!r.sudah_berangkat) halangan = `Kloter ${r.kloter} belum tercatat berangkat.`;
    else if (!r.sudah_ceklis) halangan = "Regu ini belum diceklis berangkat di staging.";

    kotak.replaceChildren(h(`
      ${kartuReguFinish(r)}
      ${r.sudah_finish ? `<div class="card" style="border-color:var(--kuning);background:var(--kuning-muda);margin-top:.5rem">
          <strong>Sudah tercatat datang ${esc(jamMenit(r.jam_datang))}.</strong>
        </div>` : ""}
      ${halangan ? kartuGalat(halangan) : ""}
    `));

    tombol.disabled = !!halangan;
    tombol.textContent = r.sudah_finish ? "✏️ PERBAIKI JAM DATANG" : "✅ SAMPAI DI FINISH";

    // Dua hal yang jarang dipakai disembunyikan supaya jalur cepat tetap dua
    // aksi: jumlah anggota (default 5) dan jam susulan dari kertas.
    // Regu yang sudah tercatat: tampilkan jam lamanya di kolom perbaikan,
    // supaya verifikasi terhadap kertas tinggal membandingkan lalu mengubah.
    if (r.sudah_finish && r.jam_datang) {
      inpJam.setNilai(jamMenit(r.jam_datang));
      inpHadir.value = r.anggota_hadir ?? 5;
      isianDariSistem = dada;
      bukaKalauBerisi();
    } else if (isianDariSistem !== null && isianDariSistem !== dada) {
      // Isian tadi milik regu LAIN yang sudah tercatat. Membawanya ke regu ini
      // berarti menyimpan jam dan jumlah anggota regu sebelumnya atas namanya.
      inpJam.setNilai("");
      inpHadir.value = "5";
      isianDariSistem = null;
    }
    perbaruiDampak();
  }

  tombol.addEventListener("click", async () => {
    if (!regu || tombol.dataset.jalan === "1") return;
    // Jaring kedua: yang disimpan HARUS regu yang nomornya sedang terlihat di
    // kotak isian, bukan sisa lookup sebelumnya.
    if (regu.nomor_dada !== Number(inp.value.trim())) {
      notif("Nomor berubah — tunggu detailnya muncul dulu.", true);
      return;
    }
    // Kolom jam susulan kosong = jalur cepat, itu keadaan normal. Tapi kolom
    // yang DIISI dan tidak terbaca sebagai jam harus menghentikan langkah,
    // bukan diam-diam dilewati: petugas mengetiknya justru karena jam tombol
    // salah, dan menyimpan jam tombol setelah ia mengetik yang lain adalah
    // membuang koreksi yang sedang dia kerjakan.
    const jamIsi = inpJam.kosong() ? null : inpJam.nilai();
    if (!inpJam.kosong() && !jamIsi) {
      inpJam.salah(true);
      inpJam.fokus();
      notif("Jam datang belum lengkap atau di luar 00:00–23:59. "
            + "Kosongkan untuk memakai jam saat tombol ditekan.", true);
      return;
    }
    const hadir = bacaAnggotaHadir(inpHadir.value, inpHadir.validity?.badInput);
    if (hadir === null) {
      inpHadir.setAttribute("aria-invalid", "true");
      inpHadir.focus();
      notif("Anggota hadir harus angka 0–5. Kosongkan untuk memakai 5.", true);
      return;
    }
    tombol.dataset.jalan = "1"; tombol.disabled = true;

    // Jam dikunci DI SINI — saat tombol ditekan, dari jam laptop panitia.
    // Kolom jam hanya dipakai bila memang diisi (koreksi hasil verifikasi).
    const jam = jamIsi ? jamPadaHari(jamIsi, regu.target_datang) : new Date();
    const dada = regu.nomor_dada;
    const nama = regu.nama_regu;
    try {
      await catatFinish(dada, jam.toISOString(), hadir, null);
    } catch (err) {
      notif(err.message, true);
      tombol.dataset.jalan = ""; tombol.disabled = false;
      return;
    }
    catatTerakhir("finish", dada3(dada),
      `${nama} — ${jamMenit(jam)}${hadir < 5 ? ` · ${hadir} anggota` : ""}`);
    tombol.dataset.jalan = "";
    inp.value = ""; inpJam.setNilai(""); inpHadir.value = "5";
    isianDariSistem = null;
    bersihkan(); inp.focus();
    gambarRiwayat();
    notif(`${dada3(dada)} tercatat ${jamMenit(jam)}.`);
  });

  function gambarRiwayat() {
    const daftar = terakhir.finish || [];
    document.getElementById("riwayat-finish").replaceChildren(h(
      daftar.length ? `
        <div class="card">
          <h2 style="font-size:1rem;color:var(--tinta-lembut)">
            Baru saja tercatat (${daftar.length})</h2>
          <table class="table">${daftar.slice(0, 12).map(b => html`
            <tr><td class="angka">${b.apa}</td><td>${b.detail}</td></tr>`).join("")}
          </table>
        </div>` : ""));
  }
}

export function kartuReguFinish(r) {
  return `
    <div class="card card-identity" style="margin:0">
      ${html`<div class="nama">${dada3(r.nomor_dada)} · ${r.nama_regu}</div>
      <div class="detail">${r.nama_sekolah} · ${GOLONGAN_LABEL[r.golongan] || r.golongan}</div>
      <div class="detail">Kloter ${r.kloter} · berangkat ${jamMenit(r.jam_berangkat)}${
        r.target_datang ? ` · target ${jamMenit(r.target_datang)}` : ""}</div>`}
      ${r.sisipan
        ? `<div style="margin-top:.4rem"><span class="badge badge-red">sisipan</span></div>`
        : ""}
    </div>`;
}
