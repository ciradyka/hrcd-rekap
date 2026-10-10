/* ============================================================================
   hrcd-rekap : screens/kejuaraan.js — layar Kejuaraan (#/kejuaraan).

   Daftar juara per golongan dan penghargaan lain, dan cetak daftar juara.
   ========================================================================== */

import { bolehLihat, cacheLiveScore, daftarSekolah, hasilKejuaraan,
         simpanKejuaraanManual, simpanKejuaraanTerjauh } from "../api.js";
import { EDISI, kartuGalat, LAYAR, pasangKepala } from "../common/frame.js";
import { angkaRapi, dada3, esc, GOLONGAN_LABEL, h, ikon, kartuGagalMuat, notif,
         pemuat, tanggalJam } from "../util.js";

/* ============================ KEJUARAAN ================================= */

/** DAFTAR JUARA DI ATAS KERTAS.
 *
 *  Dua pemakaian, dan keduanya menuntut kertas: dibacakan di panggung saat
 *  pengumuman, lalu jadi dasar menulis sertifikat. Sebelum ini satu-satunya
 *  cara mengeluarkannya dari layar adalah tangkapan layar HP.
 *
 *  BAGIANNYA DIPINJAM DARI LAYARNYA — `bagian` yang sama persis dioper ke
 *  sini, tidak ditulis ulang. Dua daftar penghargaan yang harus ikut benar
 *  setiap kali satu gelar ditambah adalah dua daftar yang suatu hari
 *  berselisih, dan yang berselisih di sini terbaca di panggung.
 *
 *  URUTANNYA BERBEDA DARI LAYARNYA, dan itu disengaja. Layar dipakai
 *  memeriksa — yang dicari mata Juara I, jadi ia di atas. Panggung dibacakan
 *  menaik: penghargaan pilihan dulu, lalu juara per golongan dari Harapan III
 *  sampai Juara I, dan Juara Umum penutupnya. Angka urutnya ikut menempel di
 *  tiap bagian di layarnya, jadi tetap satu daftar.
 *
 *  YANG BELUM DITENTUKAN IKUT DICETAK, dan tidak diredupkan. Pembawa acara
 *  yang menemukan gelar kosong di atas panggung tidak punya jalan keluar;
 *  yang menemukannya di kertas, sebelum naik, masih punya. Karena itu ia
 *  tertulis biasa — bukan miring, bukan abu — sementara yang sudah ada
 *  namanya ditebalkan: bedanya terbaca dari kejauhan tanpa dieja.
 *
 *  SATU DOKUMEN MENGALIR, bukan satu lembar per bagian. Sebelas bagian
 *  berarti sebelas lembar yang harus dibolak-balik di podium, padahal
 *  seluruhnya muat di dua. Yang dijaga cuma satu bagian tidak terbelah dua
 *  halaman, lewat `break-inside: avoid`.
 *
 *  Tanpa raster, tanpa abu, garis 1pt, huruf terkecil 9pt — kertas ini ikut
 *  digandakan di mesin fotokopi bersama yang lain (CLAUDE.md bagian 8). */
export function siapkanCetakJuara(hasil, bagian) {
  document.getElementById("cetakan")?.remove();
  const dicetak = tanggalJam(new Date().toISOString());

  /* KOLOM KANAN PERSIS SEPERTI JUDULNYA: skor regu, atau poin juara untuk
     Juara Umum. Tidak ada yang ketiga — Peserta Terbanyak menghitung REGU dan
     Pangkalan Terjauh tidak punya angka sama sekali, jadi keduanya dibiarkan
     kosong di kolom itu dan angkanya tetap tertulis lengkap dengan satuannya
     di baris di bawah namanya.

     Kolomnya sempat tanpa judul dan hanya berisi skor regu; judulnya yang
     membuat poin juara boleh ikut masuk, karena sekarang ada yang
     mengatakan angka itu bisa dua macam. Yang tidak boleh masuk tetap yang
     satuannya lain lagi (bagian 9.3): kolom berisi tiga jenis angka menuntut
     tiap barisnya diartikan sendiri-sendiri, dan kolom ini justru ada supaya
     bisa dibaca lurus ke bawah. */
  const angka = (x) => {
    if (x.nama_regu) return x.total == null ? "" : angkaRapi(x.total);
    if (x.kode.startsWith("juara_umum")) return angkaRapi(x.poin_juara);
    return "";
  };

  const isiJuara = (x) => {
    if (x.nama_regu) {
      return `<strong>${esc(dada3(x.nomor_dada))} · ${esc(x.nama_regu)}</strong>`
        + `<br><span class="juara-sekolah">${esc(x.nama_sekolah || "")}</span>`;
    }
    if (x.nama_sekolah) {
      /* Poin juaranya TIDAK diulang di sini — ia sudah berdiri di kolom
         kanan. Yang tersisa di baris ini justru yang tidak muat di sana:
         total skor enam besar, angka kedua yang menjelaskan dari mana poin
         itu datang. */
      const ket = x.kode.startsWith("juara_umum")
        ? `${angkaRapi(x.jumlah_skor)} total skor (6 besar)`
        : x.kode === "peserta_terbanyak" ? `${angkaRapi(x.total)} regu bernomor dada` : "";
      return `<strong>${esc(x.nama_sekolah)}</strong>`
        + (ket ? `<br><span class="juara-sekolah">${esc(ket)}</span>` : "");
    }
    return `<span class="juara-kosong">Belum ditentukan</span>`;
  };

  /* URUTAN BACA DI DALAM SATU BAGIAN, dan satu aturan melayani ketiga
     bentuknya karena kode penghargaannya sendiri yang membawanya:

       penggalang_pi_6        golongan + peringkat  -> Harapan III dulu
       kostum_penggalang_pi   golongan saja         -> urut golongan
       terjauh                keduanya tidak ada    -> biarkan apa adanya

     Peringkatnya dibalik (6 dulu, 1 terakhir) karena panggung dibacakan
     menaik: Harapan III lebih dulu, Juara I penutupnya.

     DAFTAR GOLONGAN DI SINI BUKAN SALINAN `URUT_GOLONGAN`, dan tidak boleh
     diganti dengan itu. Yang di util.js urutan TAMPIL — dipakai tab Live
     Score dan kolom rekap; yang ini urutan DIBACAKAN, diminta pemilik acara:
     putri lebih dulu di tiap tingkat, dan Penggalang sebelum Penegak. Dua
     fakta berbeda yang kebetulan sama bentuknya. */
  const URUT_BACA_GOLONGAN =
    ["penggalang_pi", "penggalang_pa", "penegak_pi", "penegak_pa"];
  const kunciBaca = (x) => {
    const g = URUT_BACA_GOLONGAN.findIndex(k => x.kode.includes(k));
    const p = x.kode.match(/_(\d+)$/);
    return [g < 0 ? URUT_BACA_GOLONGAN.length : g, p ? -Number(p[1]) : 0];
  };

  const isi = bagian.map(([judul, masuk, label, kelas]) => {
    const punya = hasil.filter(masuk).sort((a, b) => {
      const ka = kunciBaca(a), kb = kunciBaca(b);
      return ka[0] - kb[0] || ka[1] - kb[1];
    });
    if (!punya.length) return "";
    /* Kelas letaknya DIBAWA APA ADANYA dari layarnya, dan itu yang membuat
       kertas ini benar-benar salinan layarnya: satu blok aturan grid di
       style.css menempatkan kedua-duanya — Juara Umum di atas melintang,
       sisanya berpasangan dua kolom — jadi menggeser satu kartu di layar
       menggeser kartu yang sama di kertas, tanpa ada yang perlu diingat. */
    /* .print-table — JUDUL HANYA UNTUK KOLOM KANAN. Dua kolom pertama sudah
       terbaca dari bentuknya sendiri — gelar kecil di kiri, nama juara besar
       di tengah — dan "GELAR | JUARA" yang tercetak sebelas kali cuma
       mengulang sesuatu yang tidak pernah ditanyakan (bagian 9.3). Angka di
       kanan tidak begitu: 1673 dan 42 duduk di kolom yang sama padahal yang
       satu skor regu dan yang satu poin juara, dan tanpa judul tidak ada yang
       mengatakan itu.

       SATU SEL MELINTANG TIGA KOLOM, rata kanan — bukan sel di kolom
       ketiga. Kolom itu selebar angkanya saja, dan "Skor / Poin Juara"
       di dalamnya patah jadi tiga baris: satu blok tulisan menggantung
       dengan ruang kosong di kirinya, sebelas kali. Melintang, ia satu
       baris yang duduk tepat di atas angkanya. */
    return `
      <section class="juara-bagian ${esc(kelas)}">
        <h2>${esc(judul)}</h2>
        <table class="print-table">
          <thead><tr><th colspan="3" class="juara-kepala">Skor / Poin Juara</th></tr></thead>
          <tbody>${punya.map(x => `
            <tr><td class="juara-gelar">${esc(label(x))}</td>
                <td>${isiJuara(x)}</td>
                <td class="juara-skor">${esc(angka(x))}</td></tr>`).join("")}</tbody>
        </table>
      </section>`;
  }).join("");

  document.body.appendChild(h(`<div id="cetakan" class="printout juara-cetak">
    <section class="print-page">
      <h1>DAFTAR JUARA — ${esc(EDISI ? EDISI.name : "")}</h1>
      <div class="kejuaraan-bagian">${isi}</div>
      <p class="print-note">Dicetak ${esc(dicetak)}.</p>
    </section>
  </div>`));
}

export async function layarKejuaraan() {
  pasangKepala("Kejuaraan", true);
  if (!bolehLihat("live_score")) {
    LAYAR.replaceChildren(h(kartuGalat("Akun ini tidak berhak membuka Kejuaraan.")));
    return;
  }
  LAYAR.replaceChildren(h(pemuat()));
  const layarIni = location.hash;
  const bisaUbah = bolehLihat("pengaturan");
  let hasil, snapshot, semuaSekolah;
  try {
    [hasil, snapshot, semuaSekolah] = await Promise.all([
      hasilKejuaraan(), bisaUbah ? cacheLiveScore() : Promise.resolve(null),
      bisaUbah ? daftarSekolah() : Promise.resolve([]),
    ]);
  }
  catch (e) { LAYAR.replaceChildren(kartuGagalMuat(e.message, layarKejuaraan)); return; }
  if (location.hash !== layarIni) return;

  /* Pilihan penghargaan manual hanya butuh identitas regu dan jam datang.
     Semuanya sudah ada di snapshot Live Score; menjalankan v_rekap_penuh lagi
     di sini membuat layar Kejuaraan mengulang seluruh kalkulasi skor. */
  const regu = snapshot ? snapshot.rekap || [] : [];
  const opsi = [...new Map(regu.filter(r => r.nomor_dada != null && r.jam_datang != null
      && !String(r.golongan).startsWith("intern_"))
    .map(r => [r.regu_id, r])).values()]
    .sort((a, b) => Number(a.nomor_dada) - Number(b.nomor_dada));
  /* Pangkalan Terjauh menunjuk SEKOLAH; daftarnya dipersempit ke sekolah yang
     benar-benar mengirim regu. Master `sekolah` memuat seluruh sekolah kurasi
     — 189 baris — dan menawarkan semuanya membuat satu salah klik memberi
     gelar kepada pangkalan yang tidak hadir. */
  const ikut = new Set(opsi.map(r => r.nama_sekolah));
  const sekolah = (semuaSekolah || []).filter(s => ikut.has(s.name));

  /* Kostum dan Terfavorit dipilih PER GOLONGAN, jadi kotak carinya hanya boleh
     menawarkan regu golongan itu. Golongannya dibaca dari ekor kode
     (`kostum_penegak_pa`). RPC-nya menolak pasangan yang salah juga — ini yang
     membuat panitia tidak perlu sampai ditolak. */
  const golonganKode = (kode) =>
    (kode.match(/(?:penegak|penggalang)_(?:pa|pi)$/) || [""])[0];
  const labelRegu = (r) => `${dada3(r.nomor_dada)} · ${r.nama_regu} · ${r.nama_sekolah}`;
  /* Skornya berdiri di kanan baris, bukan ikut mengalir di bawah nama sekolah:
     panitia membaca kolom itu ke bawah untuk mengecek urutan juara, dan angka
     yang letaknya berpindah-pindah menuntut mata mencarinya tiap baris. */
  const skor = (x) => x.total == null ? ""
    : `<span class="kejuaraan-skor">${esc(angkaRapi(x.total))}</span>`;
  const nilai = (x) => {
    if (x.nama_regu) return `<div class="kejuaraan-isi"><div class="kejuaraan-nama">
      <strong>${esc(dada3(x.nomor_dada))} · ${esc(x.nama_regu)}</strong>
      <span class="description">${esc(x.nama_sekolah || "")}</span></div>${skor(x)}</div>`;
    if (x.nama_sekolah) return `<strong>${esc(x.nama_sekolah)}</strong>${x.kode.startsWith("juara_umum")
      ? `<span class="description">${esc(angkaRapi(x.poin_juara))} poin juara · ${esc(angkaRapi(x.jumlah_skor))} total skor (6 besar)</span>`
      : x.kode === "peserta_terbanyak"
        ? `<span class="description">${esc(angkaRapi(x.total))} regu bernomor dada</span>` : ""}`;
    return `<span class="description">Belum ditentukan</span>`;
  };
  const bisaPilih = (x) =>
    bisaUbah && (x.sumber === "manual" || x.sumber === "manual_sekolah");
  const baris = (x, label = x.nama_penghargaan) => bisaPilih(x) ? `
    <tr><th>${esc(label)}</th><td>
      <div class="kejuaraan-terkunci" ${x.nama_sekolah ? "" : "hidden"}>
        <div class="kejuaraan-nilai">${nilai(x)}</div>
        <button type="button" class="button button-secondary button-small kejuaraan-ubah">
          Ubah Juara
        </button>
      </div>
      <div class="kejuaraan-isian" ${x.nama_sekolah ? "hidden" : ""}>
        <div class="kejuaraan-cari">
          <input type="search" class="small-input kejuaraan-pilih" data-kode="${esc(x.kode)}"
            data-jenis="${x.sumber === "manual_sekolah" ? "sekolah" : "regu"}"
            data-golongan="${esc(golonganKode(x.kode))}"
            autocomplete="off" aria-label="Pilih ${esc(x.nama_penghargaan)}"
            placeholder="${x.sumber === "manual_sekolah"
              ? "Cari nama sekolah…" : "Cari nomor dada / regu / sekolah…"}"
            value="${esc(x.sumber === "manual_sekolah"
              ? (x.nama_sekolah || "") : (x.regu_id ? labelRegu(x) : ""))}">
          <div class="suggestions kejuaraan-saran" hidden></div>
        </div>
      </div></td></tr>` : `<tr><th>${esc(label)}</th><td>${nilai(x)}</td></tr>`;

  /* Label golongan diambil dari GOLONGAN_LABEL, tidak ditulis ulang di sini:
     satu-satunya tempatnya `util.js`, dan `periksa_urutan_golongan.py` yang
     menjaganya tetap satu. */
  /* SATU DAFTAR untuk layar dan kertas, termasuk urutannya. Kertasnya salinan
     layarnya — Juara Umum di atas, sisanya berpasangan — keputusan pemilik
     acara, 2 September 2026. Yang berbeda cuma urutan BARIS di dalam tiap
     kartu; lihat kunciBaca() di pembuat cetakannya. */
  const gelarGolongan = (kode, kelas) => [
    GOLONGAN_LABEL[kode], x => x.kode.startsWith(kode + "_"),
    x => x.nama_penghargaan.replace(GOLONGAN_LABEL[kode] + " ", ""), kelas];

  const bagian = [
    ["Juara Umum", x => x.kode === "juara_umum",
      x => x.nama_penghargaan.replace(/^Juara Umum /, ""), "kejuaraan-umum"],
    ["Juara Umum Penegak", x => x.kode === "juara_umum_penegak",
      () => "PENEGAK", "kejuaraan-umum-penegak"],
    gelarGolongan("penegak_pa", "kejuaraan-penegak-pa"),
    gelarGolongan("penegak_pi", "kejuaraan-penegak-pi"),
    ["Juara Umum Penggalang", x => x.kode === "juara_umum_penggalang",
      () => "PENGGALANG", "kejuaraan-umum-penggalang"],
    gelarGolongan("penggalang_pa", "kejuaraan-penggalang-pa"),
    gelarGolongan("penggalang_pi", "kejuaraan-penggalang-pi"),
    ["Juara Kostum", x => x.kode.startsWith("kostum_"),
      x => x.nama_penghargaan.replace(/^Juara Kostum /, ""),
      "kejuaraan-kostum kejuaraan-pilihan"],
    ["Juara Yel Yel", x => x.kode.startsWith("yel_yel_"),
      x => x.nama_penghargaan.replace(/^Juara Yel Yel /, ""), "kejuaraan-yel-yel"],
    ["Peserta Terfavorit", x => x.kode.startsWith("terfavorit_"),
      x => x.nama_penghargaan.replace(/^Peserta Terfavorit /, ""),
      "kejuaraan-terfavorit kejuaraan-pilihan"],
    ["Penghargaan Khusus",
      x => x.kode === "terjauh" || x.kode === "peserta_terbanyak",
      x => x.nama_penghargaan, "kejuaraan-khusus kejuaraan-pilihan"],
  ];

  LAYAR.replaceChildren(h(`
    <div class="card">
      <div class="option-row">
        <button class="button button-primary" id="cetak-juara" type="button">
          ${ikon("printer")} Cetak Daftar Juara
        </button>
      </div>
    </div>
    <div class="kejuaraan-bagian">
      ${bagian.map(([judul, masuk, label, kelas]) => `
        <section class="card ${kelas}"><h2>${esc(judul)}</h2>
          <table class="table data-table table-kejuaraan"><tbody>
            ${hasil.filter(masuk).map(x => baris(x, label(x))).join("")}
          </tbody></table>
        </section>`).join("")}
    </div>`));

  /* TIDAK async, dan itu keputusan yang sama dengan kedua tombol cetak di
     Live Score: `window.print()` harus tetap berada di dalam giliran ketukan
     jarinya. Safari iPhone memblokirnya begitu ada satu `await` lebih dulu,
     karena sesudah itu panggilannya tidak lagi dianggap datang dari pengguna.
     Seluruh daftarnya sudah di tangan sejak layar ini digambar, jadi memang
     tidak ada yang perlu ditunggu. */
  document.getElementById("cetak-juara")?.addEventListener("click", () => {
    siapkanCetakJuara(hasil, bagian);
    window.print();
  });

  LAYAR.querySelectorAll(".kejuaraan-pilih").forEach(pilih => {
    const saran = pilih.nextElementSibling;
    const isian = pilih.closest(".kejuaraan-isian");
    const terkunci = pilih.closest("td").querySelector(".kejuaraan-terkunci");
    const ubah = terkunci.querySelector(".kejuaraan-ubah");
    /* Satu kotak cari, dua macam isi: Kostum dan Terfavorit menunjuk regu,
       Pangkalan Terjauh menunjuk sekolah. Yang membedakan cuma data-jenis;
       sisanya — saran, blur, simpan, kunci lagi — sama persis. */
    const sekolahan = pilih.dataset.jenis === "sekolah";
    const golongan = pilih.dataset.golongan;
    const calon = sekolahan ? sekolah
      : golongan ? opsi.filter(r => r.golongan === golongan) : opsi;
    const kunci = (c) => sekolahan ? c.id : c.regu_id;
    const teks = (c) => sekolahan ? `${c.name} ${c.address || ""}`
      : `${c.nomor_dada} ${dada3(c.nomor_dada)} ${c.nama_regu} ${c.nama_sekolah}`;
    const isiKotak = (c) => sekolahan ? c.name : labelRegu(c);
    const gambarSaran = () => {
      const q = pilih.value.trim().toLocaleLowerCase("id");
      const ditemukan = calon
        .filter(c => teks(c).toLocaleLowerCase("id").includes(q)).slice(0, 8);
      saran.innerHTML = ditemukan.map(c => `
        <button type="button" data-pilihan="${esc(kunci(c))}">
          <strong>${esc(sekolahan ? c.name : `${dada3(c.nomor_dada)} · ${c.nama_regu}`)}</strong>
          <span class="alamat">${esc(sekolahan ? (c.address || "") : c.nama_sekolah)}</span>
        </button>`).join("");
      saran.hidden = !ditemukan.length;
    };
    pilih.addEventListener("focus", gambarSaran);
    pilih.addEventListener("input", gambarSaran);
    pilih.addEventListener("blur", () => setTimeout(() => { saran.hidden = true; }, 100));
    saran.addEventListener("mousedown", e => e.preventDefault());
    saran.addEventListener("click", async e => {
      const tombol = e.target.closest("[data-pilihan]");
      if (!tombol) return;
      const dipilih = calon.find(c => kunci(c) === tombol.dataset.pilihan);
      if (!dipilih) return;
      pilih.disabled = true;
      try {
        if (sekolahan) await simpanKejuaraanTerjauh(dipilih.id);
        else await simpanKejuaraanManual(pilih.dataset.kode, dipilih.regu_id);
        terkunci.querySelector(".kejuaraan-nilai").innerHTML = nilai(
          sekolahan ? { kode: "terjauh", nama_sekolah: dipilih.name } : dipilih);
        pilih.value = isiKotak(dipilih);
        saran.hidden = true;
        isian.hidden = true;
        terkunci.hidden = false;
        notif("Kejuaraan tersimpan.");
      } catch (e) { notif(e.message, true); }
      finally { pilih.disabled = false; }
    });
    ubah.addEventListener("click", () => {
      terkunci.hidden = true;
      isian.hidden = false;
      pilih.value = "";
      pilih.focus();
    });
  });
}
