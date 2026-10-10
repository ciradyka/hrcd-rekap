/* ============================================================================
   hrcd-rekap : screens/foto-jawaban.js — layar Foto Jawaban Sekaligus (#/foto).

   Mengunggah foto slip jawaban satu lomba sekaligus dan menautkannya ke nomor
   dada.
   ========================================================================== */

import { daftarFotoBelumTaut, daftarPos, komponenPos, kuotaFoto, sesi,
         tautanFoto, tautkanFoto, unggahFotoMasuk } from "../api.js";
import { EDISI, LAYAR, layarButuhEdisi, pasangKepala, putusSaatPindah,
         sinyalLayarBaru } from "../common/frame.js";
import { judulPos } from "../common/nilai-pos.js";
import { dada3, esc, h, ikon, jamMenit, kartuGagalMuat, kecilkanFoto,
         kelompokLomba, kolomPos, notif, pemuat,
         ukuranRapi } from "../util.js";

/* ============================ RUTE ======================================= */

/* ============================== FOTO JAWABAN ==============================

   Foto lembar jawaban yang diambil DI POS, banyak sekaligus, nomor dadanya
   ditautkan belakangan (migrasi 0074).

   KENAPA LAYAR INI ADA PADAHAL SUDAH ADA TOMBOL KAMERA DI MEJA IT

   Tombol kamera di layar Input Pos memfoto satu regu yang nomor dadanya baru
   saja diketik — fotonya tertaut sendiri, tanpa pekerjaan tambahan, dan itu
   tetap jalur utamanya. Yang tidak bisa dilakukannya: memotret setumpuk
   kertas di pos, sebelum kertas itu berangkat ke meja IT. Migrasi 0047 sendiri
   mengakui lubang itu — "slip yang HILANG DI JALAN antara pos dan meja IT
   tidak pernah difoto sama sekali".

   Harganya jujur: foto borongan tidak tahu nomor dadanya, jadi ia menganggur
   di antrean sampai ada yang menautkannya. Karena itu jumlah yang belum
   tertaut ditampilkan sebagai ANGKA di layar, bukan disembunyikan — antrean
   yang tidak terlihat adalah antrean yang tidak pernah dikerjakan.
   ========================================================================= */
export async function layarFoto() {
  if (!EDISI) { layarButuhEdisi("Foto Jawaban Sekaligus"); return; }
  pasangKepala("Foto Jawaban Sekaligus", true);
  LAYAR.replaceChildren(h(pemuat()));

  const layarIni = location.hash;
  const s = sesi();
  let semuaPos;
  try { semuaPos = await daftarPos(); }
  catch (e) { LAYAR.replaceChildren(kartuGagalMuat(e.message, layarFoto)); return; }
  if (location.hash !== layarIni) return;

  const posDinilai = semuaPos.filter(p => Number(p.jumlah_komponen) > 0);
  if (!posDinilai.length) {
    LAYAR.replaceChildren(h(`<div class="card"><h2>Belum ada pos berpenilaian</h2></div>`));
    return;
  }

  /* Pemilih pos muncul kalau akunnya TIDAK terkunci ke satu pos — dibaca dari
     `sesi().pos`, bukan dari nama perannya. Sejak 0064 yang menentukan hak
     adalah centang di layar Akun (CLAUDE.md 13.1); akun yang diberi centang
     `pos` tanpa peran admin tetap boleh memilih pos selama posnya kosong, dan
     memeriksa nama peran akan mengunci akun itu ke pos pertama diam-diam. */
  const terkunci = s && s.pos != null && s.pos !== "";
  let nomorPos = terkunci ? Number(s.pos) : Number(posDinilai[0].nomor);
  let kodeLomba = null, namaLomba = null;

  /* Kamera dan Galeri dipisah jadi dua tombol, alasannya lengkap di
     bukaFotoLembar(): `capture` membuka kamera langsung tapi sekaligus
     menutup jalur galeri, jadi satu tombol tidak bisa melayani keduanya. */
  LAYAR.replaceChildren(h(`
    <div class="card">
      <div class="baris-pilih">
        <div class="field">
          <label for="foto-pos">Pos</label>
          <select id="foto-pos" class="select-small" ${terkunci ? "disabled" : ""}>
            ${posDinilai.map(p => `<option value="${esc(p.nomor)}"
              ${Number(p.nomor) === nomorPos ? "selected" : ""}
              >${esc(judulPos(p))}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="foto-lomba">Lomba</label>
          <select id="foto-lomba" class="select-small"></select>
        </div>
      </div>
      <div class="action-row" id="foto-aksi" hidden>
        <label class="button button-primary">
          <input type="file" accept="image/*" capture="environment" multiple
                 hidden class="foto-ambil">
          ${ikon("camera")} Kamera
        </label>
        <label class="button button-secondary">
          <input type="file" accept="image/*" multiple hidden class="foto-ambil">
          ${ikon("image")} Galeri
        </label>
        <span class="sub" id="foto-kuota"></span>
      </div>
    </div>
    <div class="card">
      <h2>Belum dihubungkan <span class="badge" id="foto-belum">0</span></h2>
      <div class="grid-foto" id="foto-grid"></div>
    </div>
  `));

  const elPos   = document.getElementById("foto-pos");
  const elLomba = document.getElementById("foto-lomba");
  const elAksi  = document.getElementById("foto-aksi");
  const elAmbil = [...document.querySelectorAll(".foto-ambil")];
  const elGrid  = document.getElementById("foto-grid");
  const elBelum = document.getElementById("foto-belum");
  const elKuota = document.getElementById("foto-kuota");

  /* ------------------------------------------------------------------------
     SATU PETAK, BUKAN DUA DAFTAR.

     Versi sebelumnya memisahkan antrean unggah (nama berkas + status) dari
     petak foto (gambar + kotak nomor dada). Dua daftar berarti petugas harus
     mencocokkan "IMG_20260221_084512.jpg" dengan salah satu gambar abu-abu di
     bawahnya sendiri — pekerjaan yang tidak pernah diminta siapa pun, di layar
     yang tugasnya justru mencocokkan gambar dengan nomor.

     Sekarang satu ubin per foto, dari detik berkasnya dipilih sampai nomor
     dadanya tersimpan. Namanya tertulis DI BAWAH gambarnya sendiri.

     Ubinnya juga tampil SEBELUM unggahannya selesai, memakai gambar dari
     berkas di HP (object URL). Di sinyal lapangan satu unggahan bisa memakan
     belasan detik, dan petak yang kosong selama itu terbaca seperti "tidak
     terjadi apa-apa".
     --------------------------------------------------------------------- */

  /* Kunci ubin: id foto dari server kalau sudah ada, kunci lokal kalau belum.
     Satu ubin memakai kunci lokal seumur hidupnya supaya kotak nomor dada dan
     kursor yang ada di dalamnya tidak pernah tergambar ulang saat unggahannya
     selesai — itu inti dari perbaikan sebelumnya, dan penyatuan ini tidak
     boleh membatalkannya. */
  let nomorLokal = 0;
  const ubin = new Map();          // kunci -> keadaan ubin
  const dadaDiketik = new Map();   // kunci -> angka yang sudah diketik

  /* jamMenit(), bukan toTimeString(): yang terakhir memakai zona waktu ALAT.
     Laptop meja IT yang zonanya UTC menulis "01:53" untuk foto yang diunggah
     pukul 08:53 WIB — dan di layar ini jam itulah satu-satunya pembeda antara
     dua foto yang gambarnya mirip, karena petugas menautkannya ke nomor dada
     dengan mencocokkan urutan dan waktunya.

     Kosongnya dijaga di sini, bukan diserahkan ke jamMenit(): ia mengembalikan
     "—" untuk nilai kosong, dan ubin bernama "Pukul —" terbaca seperti foto
     yang jamnya hilang, bukan seperti foto yang belum punya jam. */
  const jam = (iso) => (iso ? jamMenit(iso) : "");

  function hitungUbin() {
    elBelum.textContent = String(elGrid.querySelectorAll(".ubin-foto").length);
  }

  /* Nama berkas dipendekkan DI TENGAH, bukan di ujung. "IMG_20260221_084512"
     dan "IMG_20260221_084530" berbeda di enam huruf TERAKHIR, dan potongan
     yang membuang ekornya membuat dua berkas berbeda terbaca sama persis. */
  function namaRingkas(nama) {
    const t = String(nama || "");
    if (t.length <= 22) return t;
    return `${t.slice(0, 11)}…${t.slice(-10)}`;
  }

  function isiUbin(u) {
    const bisaSimpan = u.keadaan === "siap";
    const bisaBatal = u.keadaan === "antre" || u.keadaan === "jalan" || u.keadaan === "gagal";
    const nilai = dadaDiketik.get(u.kunci) ?? "";
    return `
      <div class="ubin-atas">
        <button type="button" class="ubin-gambar" data-lihat
          ${u.url ? `style="background-image:url(&quot;${esc(u.url)}&quot;)"` : ""}
          title="Buka foto">${u.url ? "" : `<span class="keterangan">Lihat</span>`}</button>
        ${bisaBatal ? `
        <button type="button" class="ubin-silang" data-batal
          aria-label="Batalkan ${esc(u.nama || "unggahan")}"
          title="Batalkan">${ikon("x")}</button>` : ""}
      </div>
      <figcaption>
        <span class="f-berkas" title="${esc(u.nama || "")}">${esc(namaRingkas(u.nama))}</span>
        <span class="f-status ${esc(u.keadaan)}">${esc(u.status || "")}</span>
        ${bisaSimpan ? `
          <input type="number" class="small-input" inputmode="numeric" min="1"
                 placeholder="No dada" data-dada aria-label="Nomor dada"
                 value="${esc(String(nilai))}">
          <button type="button" class="button button-mini button-primary"
                  data-taut>Simpan</button>` : ""}
        ${u.keadaan === "gagal" ? `
          <button type="button" class="button button-mini" data-ulang>Ulangi</button>` : ""}
      </figcaption>`;
  }

  /** Gambar ulang SATU ubin, bukan seluruh petak.
   *
   *  Kotak nomor dada di ubin lain — beserta angka dan kursor di dalamnya —
   *  tidak boleh ikut tersentuh hanya karena satu unggahan selesai. */
  function perbarui(u) {
    const pilih = `[data-kunci="${CSS.escape(u.kunci)}"]`;
    let el = elGrid.querySelector(pilih);
    if (!el) {
      /* Elemennya DICARI LAGI dari DOM sesudah append, tidak dipegang dari
         hasil h().

         h() mengembalikan DocumentFragment (util.js). Begitu di-append,
         seluruh isinya PINDAH ke DOM dan fragmennya tinggal cangkang kosong —
         dan menulis `innerHTML` ke DocumentFragment tidak melempar galat apa
         pun, ia cuma memasang properti yang tidak dibaca siapa-siapa. Yang
         terlihat di layar: ubin kosong selamanya, tanpa satu baris pun di
         konsol. */
      elGrid.append(h(`<figure class="ubin-foto" data-kunci="${esc(u.kunci)}"></figure>`));
      el = elGrid.querySelector(pilih);
      if (!el) return;
      pengamat.observe(el);
    }
    el.dataset.keadaan = u.keadaan;
    if (u.path) el.dataset.path = u.path;
    if (u.fotoId) el.dataset.id = u.fotoId;

    // Kotak yang sedang diketik JANGAN dibongkar: menggantinya di tengah
    // ketikan memindahkan kursor ke ujung dan menutup papan ketik di HP.
    const sedangDiketik = el.contains(document.activeElement)
      && document.activeElement.matches("[data-dada]");
    if (sedangDiketik) {
      const st = el.querySelector(".f-status");
      if (st) { st.textContent = u.status || ""; st.className = `f-status ${u.keadaan}`; }
      return;
    }
    el.innerHTML = isiUbin(u);
  }

  /* Thumbnail dari server diambil saat ubinnya masuk layar, bukan dua ratus
     link bertanda tangan sekaligus di awal. Satu pengamat untuk seumur
     layar. */
  const pengamat = new IntersectionObserver((masuk) => {
    for (const e of masuk) {
      if (!e.isIntersecting) continue;
      pengamat.unobserve(e.target);
      const u = ubin.get(e.target.dataset.kunci);
      if (u && !u.url && u.path) gambarUbin(u);
    }
  }, { rootMargin: "200px" });
  putusSaatPindah(sinyalLayarBaru(), pengamat);

  async function gambarUbin(u) {
    try {
      const url = await tautanFoto(u.path);
      if (!url) return;
      u.url = url;
      const tombol = elGrid.querySelector(`[data-kunci="${CSS.escape(u.kunci)}"] .ubin-gambar`);
      if (tombol) {
        tombol.style.backgroundImage = `url("${url}")`;
        const ket = tombol.querySelector(".keterangan");
        if (ket) ket.remove();
      }
    } catch { /* Ubin tanpa gambar tetap bisa diberi nomor — itu yang penting. */ }
  }

  async function isiLomba() {
    /* Pilihan lomba TIDAK diganti jadi "memuat…". Mengganti isi <select>
       berarti pilihan yang sedang terbaca hilang sekejap lalu muncul lagi,
       dan di HP itu terlihat seperti dropdown yang salah tekan sendiri.
       Selagi dimuat ia cuma dimatikan; yang berputar ada di petak di
       bawahnya, tempat isinya memang sedang berubah. */
    elLomba.disabled = true;
    elPos.disabled = true;
    elGrid.replaceChildren(h(pemuat("Memuat…", { kecil: true })));
    let komponen;
    try { komponen = await komponenPos(EDISI.nomor, nomorPos); }
    catch (e) {
      elLomba.disabled = false; elPos.disabled = terkunci;
      notif(`Lomba pos ${nomorPos} tidak terbaca: ${e.message}`, true);
      return;
    }
    const lomba = kelompokLomba(kolomPos(komponen));
    elLomba.innerHTML = lomba.map(l =>
      `<option value="${esc(l.kode)}">${esc(l.nama)}</option>`).join("");
    kodeLomba = lomba.length ? lomba[0].kode : null;
    namaLomba = lomba.length ? lomba[0].nama : null;
    elAksi.hidden = !kodeLomba;
    elLomba.disabled = false;
    elPos.disabled = terkunci;
    await muatBelum({ bersihkan: true });
  }

  /** Foto yang sudah di server tapi belum bernomor dada.
   *
   *  MENAMBAH, tidak menggambar ulang: ubin yang sudah ada dibiarkan apa
   *  adanya, beserta angka yang sedang diketik di dalamnya. Yang hilang dari
   *  daftar server juga tidak dibuang dari layar — satu-satunya cara sebuah
   *  ubin pergi adalah kita sendiri berhasil menyimpannya. */
  async function muatBelum({ bersihkan = false } = {}) {
    if (!kodeLomba) return;
    if (bersihkan) {
      // Ganti pos atau lomba: isinya memang himpunan yang berbeda.
      for (const u of ubin.values()) if (u.url && u.lokal) URL.revokeObjectURL(u.url);
      ubin.clear();
      dadaDiketik.clear();
      // Pemutar, bukan tulisan. Yang sedang terjadi selalu sama — sedang
      // dimuat — jadi kata yang mengatakannya tidak menambah apa pun, dan di
      // layar yang dipakai ratusan kali per shift ia terbaca berulang-ulang.
      elGrid.replaceChildren(h(pemuat("Memuat…", { kecil: true })));
    }
    let daftar;
    try { daftar = await daftarFotoBelumTaut(nomorPos, kodeLomba); }
    catch (e) {
      if (bersihkan) elGrid.replaceChildren(h(`<p class="keterangan">${esc(e.message)}</p>`));
      else notif(`Daftar foto tidak terbaca: ${e.message}`, true);
      return;
    }

    // Pemutar dibuang begitu daftarnya sampai.
    const pemutar = elGrid.querySelector(".pemuat");
    if (pemutar) pemutar.remove();
    const kosong = elGrid.querySelector(".keterangan");
    if (kosong) kosong.remove();

    const sudahDiUbin = new Set([...ubin.values()].map(u => u.fotoId).filter(Boolean));
    for (const f of daftar) {
      if (sudahDiUbin.has(f.id)) continue;
      const u = {
        kunci: f.id, fotoId: f.id, path: f.path, url: null, lokal: false,
        nama: `Pukul ${jam(f.diunggah_pada)}`,
        status: ukuranRapi(f.ukuran_bytes || 0), keadaan: "siap",
      };
      ubin.set(u.kunci, u);
      perbarui(u);
    }

    hitungUbin();
    if (!elGrid.querySelector(".ubin-foto")) {
      elGrid.replaceChildren(h(`<p class="keterangan">Tidak ada.</p>`));
    }
  }

  elPos.addEventListener("change", async () => {
    nomorPos = Number(elPos.value);
    await isiLomba();
  });
  elLomba.addEventListener("change", async () => {
    kodeLomba = elLomba.value;
    namaLomba = elLomba.options[elLomba.selectedIndex].textContent.trim();
    await muatBelum({ bersihkan: true });
  });

  // Tiap ketukan disimpan. Bukan saat kotaknya ditinggalkan: petugas berpindah
  // dari kotak ke kamera, dan `blur` yang tidak pernah terjadi berarti angka
  // yang tidak pernah tersimpan.
  elGrid.addEventListener("input", (e) => {
    const inp = e.target.closest("[data-dada]");
    if (!inp) return;
    const kunci = inp.closest(".ubin-foto").dataset.kunci;
    if (inp.value === "") dadaDiketik.delete(kunci); else dadaDiketik.set(kunci, inp.value);
  });

  elGrid.addEventListener("click", async (e) => {
    const el = e.target.closest(".ubin-foto");
    if (!el) return;
    const u = ubin.get(el.dataset.kunci);
    if (!u) return;

    /* Silang. Ia hanya ADA selagi fotonya belum sampai di server — sesudah
       itu tidak ada yang bisa dibatalkan: bucket `lembar` tidak punya policy
       hapus sama sekali, dan itu disengaja sejak 0047 ("tombol hapus pada
       backup adalah cara backup itu hilang"). */
    if (e.target.closest("[data-batal]")) {
      u.keadaan = "batal";
      if (u.url && u.lokal) URL.revokeObjectURL(u.url);
      ubin.delete(u.kunci);
      el.remove();
      hitungUbin();
      if (!elGrid.querySelector(".ubin-foto")) {
        elGrid.replaceChildren(h(`<p class="keterangan">Tidak ada.</p>`));
      }
      return;
    }

    if (e.target.closest("[data-ulang]")) {
      await kerjakan(u);
      return;
    }

    if (e.target.closest("[data-lihat]")) {
      // Jendelanya dibuka SEBELUM await. Dibuka sesudahnya, browser HP
      // menganggapnya popup yang tidak diminta pengguna dan memblokirnya.
      const jendela = window.open("", "_blank");
      try {
        const url = u.url || (u.path ? await tautanFoto(u.path) : null);
        if (jendela && url) jendela.location = url; else if (jendela) jendela.close();
      } catch (err) {
        if (jendela) jendela.close();
        notif(`Foto tidak bisa dibuka: ${err.message}`, true);
      }
      return;
    }

    const taut = e.target.closest("[data-taut]");
    if (!taut) return;
    const isian = el.querySelector("[data-dada]");
    const dada = Number(isian.value);
    if (!Number.isInteger(dada) || dada <= 0) {
      notif("Nomor dada harus angka.", true);
      isian.focus();
      return;
    }
    taut.disabled = true;
    try {
      await tautkanFoto(u.fotoId, dada, "tangan");
      notif(`Foto tersimpan untuk ${dada3(dada)}.`);
      dadaDiketik.delete(u.kunci);
      if (u.url && u.lokal) URL.revokeObjectURL(u.url);
      ubin.delete(u.kunci);
      el.remove();
      hitungUbin();
      if (!elGrid.querySelector(".ubin-foto")) {
        elGrid.replaceChildren(h(`<p class="keterangan">Tidak ada.</p>`));
      }
    } catch (err) {
      taut.disabled = false;
      notif(`Gagal menyimpan: ${err.message}`, true);
    }
  });

  /** Ukuran ASLI -> ukuran terkirim, ditulis di ubinnya.
   *
   *  Bukan hiasan. Pengecilan di HP adalah satu-satunya yang menjaga kuota
   *  1 GB tetap cukup untuk ~5.500 foto (migrasi 0047), dan kalau ia gagal
   *  diam-diam di satu merek HP, yang ketahuan cuma "kuota habis di tengah
   *  acara". Angka sebelum-sesudah membuat kegagalan itu terlihat pada foto
   *  PERTAMA. */
  const hemat = (asli, jadi) => `${ukuranRapi(asli)} → ${ukuranRapi(jadi)}`;

  async function kerjakan(u) {
    if (!ubin.has(u.kunci)) return;          // sudah dibatalkan
    u.keadaan = "jalan";
    try {
      u.status = "mengecilkan…"; perbarui(u);
      const blob = await kecilkanFoto(u.berkas);
      if (!ubin.has(u.kunci)) return;

      /* Pagar terakhir sebelum jaringan dipakai. Bucket menolak apa pun di
         atas 1 MB, dan penolakan itu datang sebagai galat HTTP yang tidak
         menjelaskan apa-apa ke petugas. */
      if (blob.size > 1024 * 1024) {
        throw new Error(`masih ${ukuranRapi(blob.size)}, di atas batas 1 MB`);
      }

      u.status = `mengirim ${hemat(u.berkas.size, blob.size)}…`; perbarui(u);
      const hasil = await unggahFotoMasuk(u.pos, u.kode, u.nama_lomba, blob);
      if (!ubin.has(u.kunci)) return;

      u.fotoId = hasil.id;
      u.path = hasil.path;
      u.keadaan = "siap";
      u.status = hemat(u.berkas.size, blob.size);
    } catch (err) {
      u.keadaan = "gagal";
      u.status = err.message;
    }
    perbarui(u);
    hitungUbin();
  }

  const terimaBerkas = async (inp) => {
    const berkas = [...(inp.files || [])];
    // Dikosongkan supaya memilih berkas YANG SAMA lagi tetap memicu change.
    inp.value = "";
    if (!berkas.length || !kodeLomba) return;

    const kosong = elGrid.querySelector(".keterangan");
    if (kosong) kosong.remove();

    const baru = [];
    for (const f of berkas) {
      const u = {
        kunci: `lokal-${++nomorLokal}`, fotoId: null, path: null, lokal: true,
        url: URL.createObjectURL(f), berkas: f, nama: f.name || "foto",
        status: "menunggu…", keadaan: "antre",
        pos: nomorPos, kode: kodeLomba, nama_lomba: namaLomba,
      };
      ubin.set(u.kunci, u);
      baru.push(u);
      perbarui(u);
    }
    hitungUbin();

    // Satu per satu, bukan serentak. Unggahan paralel dari HP di sinyal
    // lapangan saling menggerus dan menabrak batas waktu bersama-sama.
    for (const u of baru) if (ubin.has(u.kunci)) await kerjakan(u);

    await muatBelum();
    try {
      const k = await kuotaFoto();
      if (k) elKuota.textContent =
        `${k.jumlah_foto} foto · ${ukuranRapi(k.total_bytes || 0)} terpakai`;
    } catch { /* Kuota cuma keterangan; gagal membacanya tidak menghalangi apa pun. */ }
  };

  // Kamera dan Galeri memakai penangan yang SAMA — yang berbeda cuma dari mana
  // berkasnya datang, dan sesudah dipilih keduanya tidak bisa dibedakan lagi.
  elAmbil.forEach(inp => inp.addEventListener("change", () => terimaBerkas(inp)));

  await isiLomba();
}
