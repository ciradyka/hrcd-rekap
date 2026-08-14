/* ============================================================================
   hrcd-rekap : live.js — halaman rekap untuk PESERTA dan PEMBINA.

   Satu pertanyaan yang harus dijawab halaman ini sepanjang lomba: "nilai regu
   saya sudah masuk belum, atau hilang?" Jawabannya centang per pos. TIDAK ada
   angka nilai — dan itu bukan dijaga di sini, melainkan di database: selama
   fase masih 'progres', live.json memang tidak memuat satu pun angka nilai
   (lihat kepala migrasi 0026). Menyembunyikannya di sisi tampilan akan
   percuma; siapa pun bisa membuka berkas JSON-nya langsung.

   Tanpa framework, tanpa build step, tanpa kunci apa pun. Satu fetch ke
   live.json, sisanya menggambar tabel.
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

const dada = (n) => String(n).padStart(3, "0");

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

/** "17 Agustus 2026 15:30" — dipakai cap sinkronisasi, yang bisa menunjuk
 *  hari lain: peserta membuka halaman ini kapan saja, termasuk besok paginya,
 *  dan "17:30" telanjang akan terbaca sebagai setengah jam lalu. */
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

let DATA = null;
let cari = "";

/* ---------------------------------------------------------------------------
   Cap sinkronisasi. Yang ditampilkan adalah jam DATA DIBUAT di server, bukan
   jam halaman ini dimuat — kalau workflow-nya tersendat, orang harus bisa
   melihat bahwa angkanya sudah tua, bukan mengira halamannya baru.
   ------------------------------------------------------------------------- */
function gambarSinkron() {
  const el = document.getElementById("sinkron");
  if (!DATA) { el.textContent = "Memuat…"; return; }
  const t = new Date(DATA.dibuat_pada);
  const tua = Date.now() - t.getTime() > 15 * 60000;
  el.className = `sinkron${tua ? " basi" : ""}`;
  el.textContent = `Sinkronisasi terakhir: ${tanggalJam(DATA.dibuat_pada)}`
    + ` (${berapaLalu(DATA.dibuat_pada)})`
    + (tua ? " — data mungkin tertinggal" : "");
}

/* ---------------------------------------------------------------------------
   Fase 'pra' — belum ada yang berjalan.
   ------------------------------------------------------------------------- */
function gambarPra() {
  const r = DATA.ringkas || {};
  const per = r.per_golongan || {};
  return `
    <div class="kartu tengah">
      <h2>Belum dimulai</h2>
      <p>Rekap live akan tampil di halaman ini begitu lomba berjalan.</p>
      <p class="angka-besar">${esc(String(r.jumlah_regu_lunas ?? 0))}</p>
      <p>regu terdaftar</p>
      <!-- Sebelum lomba, yang dicari orang di alamat ini bukan rekap
           melainkan formulirnya. Halaman rekap yang kosong tanpa jalan ke
           pendaftaran adalah jalan buntu bagi tamu yang paling banyak
           datang saat itu. -->
      <p><a class="tombol" href="daftar.html">Daftar Sekarang</a></p>
      <div class="pil-baris">
        ${URUT_GOLONGAN.filter(g => per[g]).map(g =>
          `<span class="pil">${esc(GOLONGAN[g])}: ${esc(String(per[g]))}</span>`).join("")}
      </div>
    </div>`;
}

/* ---------------------------------------------------------------------------
   Fase 'progres' dan 'penuh' — tabel centang per pos.

   Kolom pos dibangun dari daftar pos di live.json, bukan ditulis di sini:
   jumlah dan namanya berubah tiap edisi.
   ------------------------------------------------------------------------- */
function barisCocok(b) {
  if (!cari) return true;
  return dada(b.nomor_dada).includes(cari)
    || (b.nama_regu || "").toLowerCase().includes(cari)
    || (b.nama_sekolah || "").toLowerCase().includes(cari);
}

function gambarProgres() {
  const pos = DATA.pos || [];
  const baris = (DATA.progres || []).filter(barisCocok);

  const kepalaPos = pos.map(p => `<th class="pos">${esc(p.bayangan ? p.name : `Pos ${p.nomor}`)}</th>`).join("");

  const isi = baris.map(b => {
    const lewat = b.pos_terlewati || {};
    const sel = pos.map(p => {
      const ada = lewat[String(p.nomor)];
      return `<td class="pos ${ada ? "ada" : "belum"}">${ada ? "✓" : "–"}</td>`;
    }).join("");
    return `
      <tr>
        <td class="dada">${esc(dada(b.nomor_dada))}</td>
        <td class="regu">${esc(b.nama_regu)}<span class="sekolah">${esc(b.nama_sekolah)}</span></td>
        <td class="gol">${esc(GOLONGAN[b.golongan] || b.golongan)}</td>
        <td>${b.kloter ? esc(String(b.kloter)) : "—"}</td>
        <td>${esc(kontrak(b.kontrak_menit))}</td>
        <td>${esc(jam(b.jam_berangkat))}</td>
        <td>${esc(jam(b.jam_datang))}</td>
        ${sel}
      </tr>`;
  }).join("");

  return `
    <div class="kartu">
      <h2>Nilai regu sudah masuk?</h2>
      <p class="keterangan">Centang berarti nilai regu itu sudah diterima
         sistem dari pos tersebut. Angkanya sengaja belum ditampilkan — hasil
         lengkapnya dibuka setelah closing.</p>
      <div class="cari-baris">
        <input type="search" id="cari" inputmode="search"
               placeholder="Cari nomor dada, nama regu, atau sekolah…"
               value="${esc(cari)}" autocomplete="off">
        <span class="hitung">${esc(String(baris.length))} regu</span>
      </div>
      <div class="gulir">
        <table class="tabel">
          <thead>
            <tr>
              <th>No<br>Dada</th><th>Regu</th><th>Golongan</th>
              <th>Kloter</th><th>Kontrak</th><th>Berangkat</th><th>Datang</th>
              ${kepalaPos}
            </tr>
          </thead>
          <tbody>${isi || `<tr><td colspan="${7 + pos.length}" class="kosong">
            Tidak ada regu yang cocok dengan pencarian.</td></tr>`}</tbody>
        </table>
      </div>
    </div>`;
}

/* ---------------------------------------------------------------------------
   Fase 'penuh' — klasemen per golongan, juara di atas.
   ------------------------------------------------------------------------- */
function gambarKlasemen() {
  const semua = DATA.klasemen || [];
  if (!semua.length) return "";

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
              <div class="peringkat">${esc(String(k.peringkat))}</div>
              <div class="nama">${esc(k.nama_regu)}</div>
              <div class="sekolah">${esc(k.nama_sekolah)}</div>
              <div class="total">${esc(String(k.total))}</div>
            </div>`).join("")}
        </div>
        <div class="gulir">
          <table class="tabel">
            <thead>
              <tr><th>#</th><th>No<br>Dada</th><th>Regu</th>
                  <th>Nilai Pos</th><th>Penalti</th><th>Total</th></tr>
            </thead>
            <tbody>
              ${baris.map(k => `
                <tr class="${k.peringkat <= 3 ? "atas" : ""}">
                  <td class="dada">${esc(String(k.peringkat))}</td>
                  <td class="dada">${esc(dada(k.nomor_dada))}</td>
                  <td class="regu">${esc(k.nama_regu)}<span class="sekolah">${esc(k.nama_sekolah)}</span></td>
                  <td>${esc(String(k.total_pos))}</td>
                  <td>${esc(String(
                       Number(k.penalti_waktu) + Number(k.penalti_checkout) + Number(k.penalti_anggota)))}</td>
                  <td class="total">${esc(String(k.total))}</td>
                </tr>`).join("")}
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
  if (!DATA) return;

  document.getElementById("judul").textContent =
    `Rekap Live${DATA.edisi ? ` — ${DATA.edisi.name}` : ""}`;
  document.title = `Rekap Live — ${DATA.edisi ? DATA.edisi.name : "Hiking Rally Ciradyka"}`;

  const fase = DATA.fase || "pra";
  isi.innerHTML = fase === "pra"
    ? gambarPra()
    : (fase === "penuh" ? gambarKlasemen() : "") + gambarProgres();

  const kotak = document.getElementById("cari");
  if (kotak) {
    kotak.addEventListener("input", () => {
      cari = kotak.value.trim().toLowerCase();
      const posisi = kotak.selectionStart;
      gambar();
      const baru = document.getElementById("cari");
      if (baru) { baru.focus(); baru.setSelectionRange(posisi, posisi); }
    });
  }
  gambarSinkron();
}

/* ---------------------------------------------------------------------------
   Muat + segarkan sendiri. Penanda waktu di URL memaksa lewat cache browser;
   berkasnya kecil dan sudah bertanda no-cache, tapi sebagian jaringan seluler
   tetap menyimpannya sendiri.
   ------------------------------------------------------------------------- */
async function muat() {
  try {
    const r = await fetch(`live.json?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    DATA = await r.json();
    gambar();
  } catch {
    if (!DATA) {
      document.getElementById("isi").innerHTML = `
        <div class="kartu tengah">
          <h2>Belum bisa dimuat</h2>
          <p>Periksa sambungan internetmu, lalu muat ulang halaman ini.</p>
        </div>`;
    }
  }
}

muat();
setInterval(muat, 60000);
// Cap "berapa menit lalu" ikut berjalan meski datanya belum berubah.
setInterval(gambarSinkron, 30000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) muat(); });
