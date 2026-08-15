/* ============================================================================
   hrcd-rekap : live.js — halaman rekap untuk PESERTA dan PEMBINA.

   Satu pertanyaan yang harus dijawab halaman ini sepanjang lomba: "nilai regu
   saya sudah masuk belum, atau hilang?" Jawabannya centang per pos. TIDAK ada
   angka nilai — dan itu bukan dijaga di sini, melainkan di database: selama
   fase masih 'progres', berkas yang terbit memang tidak memuat satu pun angka
   nilai (lihat kepala migrasi 0026). Menyembunyikannya di sisi tampilan akan
   percuma; siapa pun bisa membuka berkas JSON-nya langsung.

   ---------------------------------------------------------------------------
   DUA BERKAS, BUKAN SATU — INI YANG MENAHAN 3.000 HP SEKALIGUS

   Pesertanya 1.500-3.000 orang dan mereka membuka alamat yang sama, berkali-
   kali, dalam jendela waktu yang sama. Satu berkas gemuk yang diunduh ulang
   tiap menit oleh tiap HP adalah cara paling mudah membuat halaman ini terasa
   berat justru di jam tersibuk. Maka isinya dipecah dua:

     live.json   ±1 KB   fase, edisi, daftar pos, ringkasan, dan `versi`.
                         INI yang di-poll tiap 60 detik.
     rekap.json  puluhan KB   seluruh baris regu + klasemen.
                         Diambil HANYA saat benar-benar dibutuhkan, dan hanya
                         sekali per `versi`.

   `rekap.json` diminta dengan `?v=<versi>`, jadi alamatnya berubah hanya
   ketika isinya berubah. Selama versinya sama, jawabannya datang dari cache
   browser atau cache tepi Cloudflare — bukan dari mana-mana. Begitu panitia
   menerbitkan ulang, `versi` di live.json berganti dan HP mengambil yang baru
   satu kali.

   Ditambah satu hal lagi: sebelum lomba dimulai `rekap.json` TIDAK PERNAH
   diambil sama sekali, dan selama lomba ia baru diambil setelah peserta
   benar-benar mencari sekolahnya. HP yang membuka halaman lalu menutupnya
   mengunduh ±1 KB, bukan puluhan.

   ---------------------------------------------------------------------------
   PENCARIAN DULU, BARU TABEL

   Peserta tidak pernah ingin membaca 300 baris; ia ingin melihat regunya
   sendiri. Jadi yang tampil lebih dulu adalah kotak "ketik nama sekolahmu",
   dan tabelnya baru muncul untuk sekolah yang cocok. Selain lebih cepat
   dibaca di layar HP, ini juga yang membuat pengambilan `rekap.json` bisa
   ditunda sampai orangnya benar-benar mencari sesuatu.

   Tanpa framework, tanpa build step, tanpa kunci apa pun.
   ========================================================================== */

const GOLONGAN = {
  penggalang_pa: "Penggalang PA", penggalang_pi: "Penggalang PI",
  penegak_pa: "Penegak PA", penegak_pi: "Penegak PI",
};
const URUT_GOLONGAN = ["penegak_pa", "penegak_pi", "penggalang_pa", "penggalang_pi"];

/** Peserta menyalin nama regu dan nama sekolah dari formulir yang mereka isi
 *  sendiri — teks dari luar, dan halaman ini dibaca ratusan orang. */
const esc = (v) => v === null || v === undefined ? "" : String(v)
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#39;");

const dada = (n) => n === null || n === undefined
  ? "—" : String(n).padStart(3, "0");

/* Bentuk waktu baku. Sengaja DISALIN dari web/js/util.js dan bukan diimpor:
   halaman ini di-deploy sebagai Worker terpisah dan tidak boleh bergantung
   pada berkas di proyek lain. Kalau bentuknya diubah di sana, ubah juga di
   sini — hanya ada tiga fungsi, dan salinan yang jujur lebih baik daripada
   ketergantungan yang diam-diam putus saat deploy. */
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni",
               "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const dua = (n) => String(n).padStart(2, "0");

/** "15:30" — titik dua, bukan titik: "07.04" mudah terbaca sebagai desimal. */
const jam = (t) => {
  if (!t) return "—";
  const d = new Date(t);
  return `${dua(d.getHours())}:${dua(d.getMinutes())}`;
};

/** "17 Agustus 2026 15:30" — dipakai cap update, yang bisa menunjuk hari
 *  lain: peserta membuka halaman ini kapan saja, termasuk besok paginya, dan
 *  "17:30" telanjang akan terbaca sebagai setengah jam lalu. */
const tanggalJam = (t) => {
  if (!t) return "—";
  const d = new Date(t);
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()} ${jam(t)}`;
};

const kontrak = (menit) => {
  if (!menit) return "—";
  const j = Math.floor(menit / 60), m = menit % 60;
  return m ? `${j},${m === 30 ? "5" : m} jam` : `${j} jam`;
};

const berapaLalu = (t) => {
  const menit = Math.floor((Date.now() - new Date(t).getTime()) / 60000);
  if (menit < 1) return "barusan";
  if (menit < 60) return `${menit} menit lalu`;
  return `${Math.floor(menit / 60)} jam lalu`;
};

let META = null;        // isi live.json
let REKAP = null;       // isi rekap.json, kalau sudah diambil
let versiRekap = null;  // versi milik REKAP yang sedang dipegang
let mengambil = false;  // penjaga supaya tidak dua permintaan sekaligus
let cari = "";

const fase = () => (META && META.fase) || "pra";
const mulai = () => fase() !== "pra";

/* ---------------------------------------------------------------------------
   Cap update. Yang ditampilkan adalah jam DATA DIBUAT di server, bukan jam
   halaman ini dimuat — kalau penerbitannya tersendat, orang harus bisa
   melihat bahwa angkanya sudah tua, bukan mengira halamannya baru.
   ------------------------------------------------------------------------- */
function gambarSinkron() {
  const el = document.getElementById("sinkron");
  if (!META) { el.textContent = "Memuat…"; return; }
  const t = new Date(META.dibuat_pada);
  const tua = Date.now() - t.getTime() > 15 * 60000;
  // Warnanya tetap berubah setelah 15 menit — petunjuk yang tidak menambah
  // satu kata pun ke barisnya. Ekor "data mungkin tertinggal" dibuang:
  // "(1 jam lalu)" sudah mengatakan hal yang sama, dan kalimat tambahan di
  // sebelahnya membuat baris ini terbaca seperti galat padahal normal.
  el.className = `sinkron${tua ? " basi" : ""}`;
  el.textContent = `Update terakhir: ${tanggalJam(META.dibuat_pada)}`
    + ` (${berapaLalu(META.dibuat_pada)})`;
}

/* ---------------------------------------------------------------------------
   Fase 'pra' — rekap TIDAK dibuka untuk siapa pun.

   Ini keputusan panitia, bukan kebetulan teknis: sebelum lomba dimulai tidak
   ada yang boleh dilihat peserta. Yang tetap ada di sini hanya jalan ke
   formulir — sebelum lomba, itu memang satu-satunya yang dicari orang di
   alamat ini, dan halaman buntu tanpa jalan ke pendaftaran membuang tamu yang
   paling banyak datang saat itu.
   ------------------------------------------------------------------------- */
function gambarPra() {
  const r = META.ringkas || {};
  const per = r.per_golongan || {};
  const t = META.edisi && META.edisi.tanggal_lomba
    ? new Date(META.edisi.tanggal_lomba) : null;
  return `
    <div class="kartu tengah">
      <h2>Belum dimulai</h2>
      <p>Rekap live terbuka saat lomba berjalan${t
        ? ` — ${esc(String(t.getDate()))} ${esc(BULAN[t.getMonth()])} ${esc(String(t.getFullYear()))}`
        : ""}. Saat itu kamu bisa memeriksa apakah nilai regumu sudah masuk
        dari tiap pos.</p>
      <p class="angka-besar">${esc(String(r.jumlah_regu_lunas ?? 0))}</p>
      <p>regu terdaftar</p>
      <p><a class="tombol" href="daftar.html">Daftar Sekarang</a></p>
      <div class="pil-baris">
        ${URUT_GOLONGAN.filter(g => per[g]).map(g =>
          `<span class="pil">${esc(GOLONGAN[g])}: ${esc(String(per[g]))}</span>`).join("")}
      </div>
    </div>`;
}

/* ---------------------------------------------------------------------------
   Kotak cari. Selalu digambar begitu lomba mulai, bahkan sebelum rekap.json
   ada di tangan — kotaknya sendiri yang MEMICU pengambilan berkas itu.
   ------------------------------------------------------------------------- */
function gambarCari() {
  return `
    <div class="kartu">
      <h2>Cari sekolahmu</h2>
      <p class="keterangan">Ketik nama sekolahmu — boleh sebagiannya saja,
         misalnya "purwadadi". Seluruh regu sekolah itu akan tampil.</p>
      <div class="cari-baris">
        <input type="search" id="cari" inputmode="search"
               placeholder="Nama sekolah…"
               value="${esc(cari)}" autocomplete="off">
      </div>
    </div>`;
}

/* ---------------------------------------------------------------------------
   Hasil pencarian: dikelompokkan per SEKOLAH, dan di dalamnya urut nomor
   dada dari awal sampai akhir.

   Selama lomba yang tampil hanya centang. Kolom kloter, kontrak, dan jam baru
   ikut muncul setelah hasilnya diumumkan (fase 'penuh') — saat itu halaman
   ini memang berubah jadi papan hasil lengkap.
   ------------------------------------------------------------------------- */
/** Dicocokkan ke NAMA SEKOLAH saja — bukan nama regu, bukan nomor dada.
 *
 *  Itu keputusan sadar, bukan penyederhanaan. Sekolah adalah satu-satunya
 *  kata kunci yang pasti diketahui setiap orang yang membuka halaman ini,
 *  dan membatasi pencarian ke sana membuat halaman menjawab "bagaimana regu
 *  KAMI" alih-alih berubah jadi alat mengintip nilai regu lain satu per satu.
 *  Yang tampil sesudahnya memang seluruh regu sekolah itu — satu sekolah
 *  adalah satu rombongan, dan pembinanya mengurus semuanya sekaligus. */
function cocok(b) {
  return (b.nama_sekolah || "").toLowerCase().includes(cari);
}

function gambarHasil() {
  const pos = (META && META.pos) || [];
  const penuh = fase() === "penuh";

  if (cari.length < 2) {
    return `<div class="kartu tengah">
      <p class="keterangan">Ketik minimal dua huruf nama sekolahmu untuk
         melihat seluruh regunya.</p></div>`;
  }
  if (!REKAP) {
    return `<div class="kartu tengah"><p class="keterangan">Mencari…</p></div>`;
  }

  const baris = (REKAP.progres || []).filter(cocok);
  if (!baris.length) {
    return `<div class="kartu tengah">
      <h2>Sekolah tidak ditemukan</h2>
      <p class="keterangan">Tidak ada sekolah yang cocok dengan
         "${esc(cari)}". Coba potong jadi satu kata saja — misalnya
         "purwadadi" alih-alih nama lengkapnya. Kalau tetap tidak muncul,
         pembayaran sekolahmu mungkin belum diverifikasi panitia.</p></div>`;
  }

  // Dikelompokkan per sekolah supaya satu sekolah yang mengirim sepuluh regu
  // terbaca sebagai satu blok, bukan sepuluh baris yang tercecer.
  const sekolah = new Map();
  for (const b of baris) {
    const k = b.nama_sekolah || "—";
    if (!sekolah.has(k)) sekolah.set(k, []);
    sekolah.get(k).push(b);
  }

  const kepalaPos = pos.map(p =>
    `<th class="pos">${esc(p.bayangan ? p.name : `Pos ${p.nomor}`)}</th>`).join("");

  return [...sekolah.entries()].sort((a, b) => a[0].localeCompare(b[0], "id"))
    .map(([nama, isi]) => {
      isi.sort((a, b) => (a.nomor_dada ?? 1e9) - (b.nomor_dada ?? 1e9));
      const kolomEkstra = penuh
        ? `<th>Kloter</th><th>Kontrak</th><th>Berangkat</th><th>Datang</th>` : "";
      return `
        <div class="kartu">
          <h2>${esc(nama)}</h2>
          <p class="keterangan">${esc(String(isi.length))} regu${penuh ? "" :
            " · centang = nilai regu itu sudah diterima sistem dari pos tersebut"}</p>
          <div class="gulir">
            <table class="tabel">
              <thead>
                <tr>
                  <th>No<br>Dada</th><th>Regu</th><th>Golongan</th>
                  ${kolomEkstra}${kepalaPos}
                </tr>
              </thead>
              <tbody>
                ${isi.map(b => {
                  const lewat = b.pos_terlewati || {};
                  const sel = pos.map(p => {
                    const ada = lewat[String(p.nomor)];
                    return `<td class="pos ${ada ? "ada" : "belum"}">${ada ? "✓" : "–"}</td>`;
                  }).join("");
                  const ekstra = penuh ? `
                    <td>${b.kloter ? esc(String(b.kloter)) : "—"}</td>
                    <td>${esc(kontrak(b.kontrak_menit))}</td>
                    <td>${esc(jam(b.jam_berangkat))}</td>
                    <td>${esc(jam(b.jam_datang))}</td>` : "";
                  return `
                    <tr>
                      <td class="dada">${esc(dada(b.nomor_dada))}</td>
                      <td class="regu">${esc(b.nama_regu)}</td>
                      <td class="gol">${esc(GOLONGAN[b.golongan] || b.golongan)}</td>
                      ${ekstra}${sel}
                    </tr>`;
                }).join("")}
              </tbody>
            </table>
          </div>
        </div>`;
    }).join("");
}

/* ---------------------------------------------------------------------------
   Fase 'penuh' — klasemen per golongan, juara di atas. Tampil tanpa perlu
   mencari apa pun: inilah pengumumannya.
   ------------------------------------------------------------------------- */
/* ---------------------------------------------------------------------------
   Kemajuan input per pos.

   Sepanjang hari peserta menanyakan satu hal: "nilai regu saya sudah masuk
   belum?" Centang per pos di bawah sudah menjawabnya, tapi centang KOSONG
   punya dua arti yang jauh berbeda — "regu kamu terlewat" atau "pos itu
   memang baru mulai diinput" — dan dari kursi peserta keduanya terlihat sama
   persis.

   Satu angka per pos memisahkan keduanya, dan pertanyaan yang tadinya jadi
   antrean di meja panitia terjawab sebelum diajukan.
   ------------------------------------------------------------------------- */
/* Merah / kuning / hijau, dan hijau sengaja mahal — 90, bukan 80. Pos dengan
   300 regu yang berhenti di 85% masih kehilangan 45 regu, dan warna hijau di
   angka itu mengabarkan "selesai" kepada peserta yang regunya justru termasuk
   45 itu. Angkanya selalu tertulis di dalam cincin, jadi yang tidak bisa
   membedakan merah dari hijau membaca keadaan yang sama persis. */
const warnaPersen = (s) => s >= 90 ? "var(--hijau)"
                         : s >= 50 ? "var(--kuning)" : "var(--bahaya)";

function gambarKelengkapan() {
  const daftar = (META && META.kelengkapan) || [];
  if (!daftar.length) return "";

  return `
    <div class="kartu">
      <h2>Kemajuan input</h2>
      <p class="keterangan">Berapa banyak regu yang nilainya sudah masuk di tiap
        pos. Angka ini bukan nilai — nilai baru terbit saat hasil diumumkan.</p>
      <ul class="kemajuan">
        ${daftar.map(p => {
          const persen = Number(p.persen) || 0;
          return `
          <li>
            <div class="cincin" style="--persen:${persen};--warna:${warnaPersen(persen)}"
                 role="img"
                 aria-label="Pos ${esc(String(p.pos))} ${esc(String(persen))} persen selesai">
              <span>${esc(String(persen))}<i>%</i></span>
            </div>
            <div class="c-nama">Pos ${esc(String(p.pos))} · ${esc(p.nama_pos)}</div>
            <div class="c-angka">${esc(String(p.lengkap))} / ${esc(String(p.regu_total))} regu${
              Number(p.sebagian) > 0
                ? `<br>${esc(String(p.sebagian))} baru sebagian` : ""}</div>
          </li>`;
        }).join("")}
      </ul>
    </div>`;
}

/* Emas, perak, perunggu. Angka peringkat tetap ada di bawahnya untuk yang
   tidak menampilkan emoji — medali di sini menggantikan angka besar, bukan
   satu-satunya penanda juara. */
const MEDALI = { 1: "🥇", 2: "🥈", 3: "🥉" };

function gambarKlasemen() {
  const semua = (REKAP && REKAP.klasemen) || [];
  if (!semua.length) return "";
  // Kolom rincian dibentuk dari daftar pos yang terbit di live.json, bukan
  // ditulis di sini: jumlah pos berubah tiap edisi, dan halaman peserta tidak
  // boleh jadi tempat kedua yang harus ikut disunting saat itu terjadi.
  const POS = (META && META.pos) || [];

  return URUT_GOLONGAN.map(g => {
    const baris = semua.filter(k => k.golongan === g);
    if (!baris.length) return "";
    const juara = baris.filter(k => k.peringkat <= 3);
    return `
      <div class="kartu">
        <h2>${esc(GOLONGAN[g])}</h2>
        <div class="podium">
          ${juara.map(k => `
            <div class="juara j${esc(String(k.peringkat))}">
              <div class="medali" aria-hidden="true">${MEDALI[k.peringkat] || ""}</div>
              <div class="peringkat">Juara ${esc(String(k.peringkat))}</div>
              <div class="dada-juara">${esc(dada(k.nomor_dada))}</div>
              <div class="nama">${esc(k.nama_regu)}</div>
              <div class="sekolah">${esc(k.nama_sekolah)}</div>
              <div class="total">${esc(String(k.total))}</div>
            </div>`).join("")}
        </div>
        <div class="gulir">
          <table class="tabel">
            <thead>
              <tr><th>#</th><th>No<br>Dada</th><th>Regu</th>
                  ${POS.map(p => `<th class="pos-kol" title="${esc(p.name)}"
                    >P${esc(String(p.nomor))}</th>`).join("")}
                  <th>Nilai Pos</th><th>Penalti</th><th>Total</th></tr>
            </thead>
            <tbody>
              ${baris.map(k => {
                const perPos = k.poin_per_pos || {};
                return `
                <tr class="${k.peringkat <= 3 ? "atas" : ""}">
                  <td class="dada">${MEDALI[k.peringkat] || ""}${esc(String(k.peringkat))}</td>
                  <td class="dada">${esc(dada(k.nomor_dada))}</td>
                  <td class="regu">${esc(k.nama_regu)}<span class="sekolah">${esc(k.nama_sekolah)}</span></td>
                  ${POS.map(p => {
                    const v = perPos[String(p.nomor)];
                    // Garis pendek, bukan nol. Pos yang belum menyetor nilai
                    // dan pos yang benar-benar memberi nol adalah dua hal
                    // berbeda, dan angka 0 menyamakan keduanya.
                    return `<td class="pos-kol">${v === undefined || v === null
                      ? "–" : esc(String(v))}</td>`;
                  }).join("")}
                  <td>${esc(String(k.total_pos))}</td>
                  <td>${esc(String(
                       Number(k.penalti_waktu) + Number(k.penalti_checkout) + Number(k.penalti_anggota)))}</td>
                  <td class="total">${esc(String(k.total))}</td>
                </tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>`;
  }).join("");
}

/* ---------------------------------------------------------------------------
   Menggambar ulang. Kotak cari dipasang ulang tiap kali, dan posisi kursornya
   dikembalikan — tanpa itu, mengetik satu huruf membuat fokusnya lepas dan
   huruf kedua hilang.
   ------------------------------------------------------------------------- */
function gambar() {
  const isi = document.getElementById("isi");
  if (!META) return;

  document.getElementById("judul").textContent =
    `Rekap Live${META.edisi ? ` — ${META.edisi.name}` : ""}`;
  document.title = `Rekap Live — ${META.edisi ? META.edisi.name : "Hiking Rally Ciradyka"}`;

  isi.innerHTML = !mulai()
    ? gambarPra()
    : (fase() === "penuh" ? gambarKlasemen() : "")
      + gambarKelengkapan() + gambarCari() + gambarHasil();

  const kotak = document.getElementById("cari");
  if (kotak) {
    kotak.addEventListener("input", () => {
      cari = kotak.value.trim().toLowerCase();
      const posisi = kotak.selectionStart;
      // Berkas besar diambil saat orangnya benar-benar mencari, bukan saat
      // halaman dibuka. Inilah yang membuat ribuan HP yang cuma melirik
      // halaman ini tidak mengunduh apa pun selain live.json.
      if (cari.length >= 2 && !REKAP) muatRekap().then(gambar);
      gambar();
      const baru = document.getElementById("cari");
      if (baru) { baru.focus(); baru.setSelectionRange(posisi, posisi); }
    });
  }
  gambarSinkron();
}

/* ---------------------------------------------------------------------------
   Pengambilan berkas.

   live.json  : kecil, tanpa cache, tiap 60 detik.
   rekap.json : besar, dialamati `?v=<versi>` sehingga boleh di-cache selamanya
                oleh browser dan oleh tepi Cloudflare. Versi berganti = alamat
                berganti = satu unduhan baru, lalu diam lagi.
   ------------------------------------------------------------------------- */
async function muatRekap() {
  if (!META || mengambil) return;
  if (REKAP && versiRekap === META.versi) return;   // sudah yang terbaru
  mengambil = true;
  try {
    const r = await fetch(`rekap.json?v=${encodeURIComponent(META.versi || "0")}`);
    if (!r.ok) throw new Error(String(r.status));
    REKAP = await r.json();
    versiRekap = META.versi;
  } catch {
    // Diamkan: yang lama tetap dipakai kalau ada, dan percobaan berikutnya
    // datang sendiri pada poll berikutnya.
  } finally {
    mengambil = false;
  }
}

async function muat() {
  try {
    const r = await fetch(`live.json?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    const baru = await r.json();
    const versiBerubah = !META || META.versi !== baru.versi;
    META = baru;

    // Rekap diambil ulang hanya kalau memang sudah dipegang (peserta sedang
    // melihatnya) atau memang harus tampil tanpa dicari (fase 'penuh').
    if (versiBerubah && (REKAP || fase() === "penuh")) await muatRekap();
    else if (fase() === "penuh" && !REKAP) await muatRekap();

    gambar();
  } catch {
    if (!META) {
      document.getElementById("isi").innerHTML = `
        <div class="kartu tengah">
          <h2>Belum bisa dimuat</h2>
          <p>Periksa sambungan internetmu, lalu muat ulang halaman ini.</p>
        </div>`;
    }
  }
}

muat();

/* Polling hanya berjalan saat halamannya benar-benar dilihat. Ribuan HP yang
   tertinggal terbuka di saku adalah beban yang tidak menghasilkan apa pun —
   dan mereka tetap mendapat data segar begitu layarnya dibuka lagi. */
let denyut = null;
const nyalakan = () => {
  if (denyut === null) denyut = setInterval(muat, 60000);
};
const matikan = () => {
  if (denyut !== null) { clearInterval(denyut); denyut = null; }
};
document.addEventListener("visibilitychange", () => {
  if (document.hidden) matikan();
  else { nyalakan(); muat(); }
});
if (!document.hidden) nyalakan();

// Cap "berapa menit lalu" ikut berjalan meski datanya belum berubah.
setInterval(gambarSinkron, 30000);
