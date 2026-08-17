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

/* Fase yang BERLAKU = yang paling ketat antara berkas dan database.
 *
 *  `live.json` hanya berubah kalau publish-live.yml dijalankan, jadi
 *  mematikan papan berarti membuka GitHub Actions — bukan yang dilakukan
 *  orang saat kerumunan sedang panas. `FASE_DB` diambil langsung dari
 *  Supabase tiap poll, jadi saklar di layar panitia berlaku dalam hitungan
 *  detik.
 *
 *  Hanya MEMPERKETAT, tidak pernah membuka. Berkas yang terbit saat fase
 *  `progres` memang TIDAK MEMUAT satu angka pun — bukan memuat angka yang
 *  disembunyikan tampilan. Kalau saklar ini bisa membuka lebih dari isi
 *  berkasnya, jaminan itu berubah jadi "angkanya ada di CDN, cuma tidak
 *  digambar", dan siapa pun yang membuka rekap.json langsung melihatnya.
 *
 *  Jadi: mematikan seketika, menyalakan tetap lewat penerbitan. */
const URUT_FASE = { pra: 0, progres: 1, penuh: 2 };
let FASE_DB = null;
let denyutFase = null;

const fase = () => {
  const berkas = (META && META.fase) || "pra";
  if (!FASE_DB) return berkas;
  return URUT_FASE[FASE_DB] < URUT_FASE[berkas] ? FASE_DB : berkas;
};

async function ambilFaseDb() {
  const K = window.HRCD || {};
  if (!K.supabaseUrl || !K.anonKey) return;
  try {
    const r = await fetch(`${K.supabaseUrl}/rest/v1/v_fase_live?select=fase_live`,
      { headers: { apikey: K.anonKey, Authorization: `Bearer ${K.anonKey}` },
        cache: "no-store" });
    if (!r.ok) return;                       // diamkan: berkas tetap dipakai
    const d = await r.json();
    if (Array.isArray(d) && d[0] && URUT_FASE[d[0].fase_live] !== undefined) {
      FASE_DB = d[0].fase_live;
    }
  } catch {
    // Sambungan ke Supabase mati bukan alasan mengosongkan papan: tanpa
    // FASE_DB, yang berlaku fase di berkas — keadaan sebelum berkas ini ada.
  }
}
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
      <!-- Sebelum lomba, halaman ini dibuka orang yang BELUM mendaftar —
           bukan peserta yang mencari nilainya. "Belum dimulai" menjawab
           pertanyaan yang tidak mereka punya; ajakan mendaftar menjawab
           yang mereka punya. Tanggal lombanya ikut hilang: ia ada di
           halaman pendaftaran, dan di sini cuma memberi alasan menunda. -->
      <h2>Segera daftarkan dirimu di<br>Hiking Rally Ciradyka XXXVII</h2>
      <p class="angka-besar">${esc(String(r.jumlah_regu_daftar ?? r.jumlah_regu_lunas ?? 0))}</p>
      <p>regu sudah mendaftar</p>
      <p><a class="tombol" href="daftar.html">Daftar Sekarang</a></p>
      <div class="pil-baris">
        ${URUT_GOLONGAN.filter(g => per[g]).map(g =>
          `<span class="pil">${esc(GOLONGAN[g])}: ${esc(String(per[g]))}</span>`).join("")}
      </div>
    </div>`;
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

function gambarKelengkapan() {
  const daftar = (META && META.kelengkapan) || [];
  if (!daftar.length) return "";

  return `
    <div class="kartu">
      <h2>Status</h2>
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
            <div class="c-angka">${esc(String(p.lengkap))} / ${esc(String(p.regu_total))} regu</div>
          </li>`;
        }).join("")}
      </ul>
    </div>`;
}

/* Emas, perak, perunggu. Angka peringkat tetap ada di bawahnya untuk yang
   tidak menampilkan emoji — medali di sini menggantikan angka besar, bukan
   satu-satunya penanda juara. */
const MEDALI = { 1: "🥇", 2: "🥈", 3: "🥉" };


/* ---------------------------------------------------------------------------
   PAPAN — bentuknya SAMA dengan layar Live Score panitia.

   Empat tab golongan, judul "Klasemen sementara", podium tiga medali, lalu
   tabel: No Dada, Regu, Organisasi, satu kolom per KOMPONEN, Penalti, Total.

   Yang berbeda dari panitia hanya satu, dan itu bukan tata letak melainkan
   ISI SEL:

     progres  centang kalau nilainya sudah masuk, kosong kalau belum
     penuh    angka yang sebenarnya

   Dan itu bukan tirai. Di fase `progres`, `nilai` memang objek kosong di
   rekap.json (migrasi 0072) — angkanya belum diterbitkan, bukan diterbitkan
   lalu disembunyikan.

   Kotak "Cari sekolahmu" DIGANTI penyaring Organisasi di kepala kolomnya,
   sama seperti panitia. Kotak cari menuntut orang mengetik nama sekolahnya
   dengan benar sebelum melihat apa pun; daftar centang menunjukkan seluruh
   pilihan yang ada.
   ------------------------------------------------------------------------- */
let golAktif = URUT_GOLONGAN[0];

function barisPapan() {
  const progres = (REKAP && REKAP.progres) || [];
  const klasemen = (REKAP && REKAP.klasemen) || [];
  const perDada = new Map(progres.map(p => [p.nomor_dada, p]));
  // Klasemen yang memimpin urutannya kalau ada — ia sudah berperingkat. Di
  // fase `progres` klasemen memang kosong, jadi urutannya jatuh ke nomor dada.
  if (klasemen.length) {
    return klasemen.map(k => ({ ...perDada.get(k.nomor_dada), ...k }));
  }
  return [...progres].sort((a, b) => (a.nomor_dada ?? 1e9) - (b.nomor_dada ?? 1e9));
}

function gambarTab(semua) {
  return `<div class="tab-golongan">${URUT_GOLONGAN.map(g => {
    const n = semua.filter(b => b.golongan === g).length;
    return `<button type="button" class="tab ${g === golAktif ? "aktif" : ""}"
              data-gol="${esc(g)}">${esc(GOLONGAN[g] || g)}
              <span class="jml">${esc(String(n))}</span></button>`;
  }).join("")}</div>`;
}

function gambarPapan() {
  if (!REKAP) return `<div class="kartu tengah"><p class="keterangan">Memuat…</p></div>`;
  const semua = barisPapan();
  const penuh = fase() === "penuh";
  const pos = (META && META.pos) || [];
  const komponen = (META && META.komponen) || [];

  // Satu kolom per komponen; versi per golongan digabung jadi satu kolom
  // bernama sama — persis kolomPos() di layar panitia.
  const perPos = pos.map(p => {
    const milik = komponen.filter(w => w.pos === p.nomor);
    const nama = [];
    for (const w of milik) if (!nama.includes(w.name)) nama.push(w.name);
    return { pos: p, nama, milik };
  }).filter(x => x.nama.length);

  const kartu = URUT_GOLONGAN.map(g => {
    const baris = semua.filter(b => b.golongan === g);
    const sekolahAda = [...new Set(baris.map(b => b.nama_sekolah).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "id"));
    const juara = baris.filter(b => b.peringkat && b.peringkat <= 3);

    const isi = !baris.length
      ? `<p class="keterangan tengah">Belum ada regu golongan ini yang bisa
           diperingkat.</p>`
      : `
        ${!juara.length ? "" : `<div class="podium">${juara.map(k => `
          <div class="juara j${esc(String(k.peringkat))}">
            <div class="medali" aria-hidden="true">${MEDALI[k.peringkat] || ""}</div>
            <div class="j-teks">
              <div class="peringkat">Juara ${esc(String(k.peringkat))}
                <span class="dada-juara">${esc(dada(k.nomor_dada))}</span></div>
              <div class="nama">${esc(k.nama_regu)}</div>
              <div class="sekolah">${esc(k.nama_sekolah)}</div>
            </div>
            <div class="total">${esc(String(k.total))}</div>
          </div>`).join("")}</div>`}

        <div class="isi-filter" hidden>
          <input type="search" class="cari-filter" placeholder="Ketik nama sekolah…"
                 aria-label="Cari sekolah">
          <div class="daftar-filter">
            ${sekolahAda.map(nm => `
              <label><input type="checkbox" value="${esc(nm)}"> ${esc(nm)}</label>`).join("")}
          </div>
          <button type="button" class="tombol-kecil tombol-semua">Hapus Filter</button>
        </div>
        <div class="gulir">
          <table class="tabel ${penuh ? "ada-rank" : ""}">
            <thead>
              <tr>
                ${penuh ? `<th rowspan="2" class="rank-th">#</th>` : ""}
                <th rowspan="2" class="dada-th">No<br>Dada</th>
                <th rowspan="2" class="regu-th">Regu</th>
                <th rowspan="2" class="th-saring" tabindex="0" role="button"
                    aria-expanded="false"
                    title="Klik untuk menyaring per sekolah">Organisasi
                  <span class="hitung-filter"></span> <span aria-hidden="true">▾</span></th>
                ${perPos.map(x => `<th class="pos" colspan="${x.nama.length}"
                  >${esc(x.pos.bayangan ? x.pos.name : `Pos ${x.pos.nomor}`)}</th>`).join("")}
                ${penuh ? `<th rowspan="2">Penalti</th><th rowspan="2">Total</th>` : ""}
              </tr>
              <tr>${perPos.map(x => x.nama.map(nm =>
                `<th class="pos kol-komponen">${esc(nm)}</th>`).join("")).join("")}</tr>
            </thead>
            <tbody>
              ${baris.map(b => {
                const terisi = b.komponen_terisi || {};
                const angka = b.nilai || {};
                const sel = perPos.map(x => x.nama.map(nm => {
                  const w = x.milik.find(k =>
                    k.name === nm && (!k.golongan || k.golongan === b.golongan));
                  if (!w) return `<td class="pos belum">–</td>`;
                  const kunci = `${x.pos.nomor}.${w.kode}`;
                  if (!penuh) {
                    const ada = terisi[kunci];
                    return `<td class="pos ${ada ? "ada" : "belum"}">${ada ? "✓" : ""}</td>`;
                  }
                  const v = angka[kunci];
                  if (!v || v.nilai_1 === null || v.nilai_1 === undefined) {
                    return `<td class="pos belum">–</td>`;
                  }
                  return `<td class="pos ada">${esc(String(v.nilai_1))}${
                    v.nilai_2 === null || v.nilai_2 === undefined
                      ? "" : ` / ${esc(String(v.nilai_2))}`}</td>`;
                }).join("")).join("");
                const penalti = penuh
                  ? Number(b.penalti_waktu || 0) + Number(b.penalti_checkout || 0)
                    + Number(b.penalti_anggota || 0)
                  : null;
                return `
                <tr data-sekolah="${esc(b.nama_sekolah || "")}"
                    class="${b.peringkat && b.peringkat <= 3 ? "atas" : ""}">
                  ${penuh ? `<td class="rank-sel">${MEDALI[b.peringkat] || ""}${
                      esc(String(b.peringkat ?? ""))}</td>` : ""}
                  <td class="dada">${esc(dada(b.nomor_dada))}</td>
                  <td class="regu">${esc(b.nama_regu)}</td>
                  <td class="sekolah-sel">${esc(b.nama_sekolah || "—")}</td>
                  ${sel}
                  ${penuh ? `<td>${esc(String(penalti))}</td>
                     <td class="total">${esc(String(b.total ?? "—"))}</td>` : ""}
                </tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>`;

    return `<div class="panel-gol kartu" data-gol="${esc(g)}"${
      g === golAktif ? "" : " hidden"}>
        <h2 class="tengah">Klasemen sementara</h2>
        ${isi}
      </div>`;
  }).join("");

  return gambarTab(semua) + kartu;
}

function pasangPapan() {
  document.querySelectorAll(".tab-golongan .tab").forEach(t => {
    t.addEventListener("click", () => {
      golAktif = t.dataset.gol;
      document.querySelectorAll(".tab-golongan .tab").forEach(x =>
        x.classList.toggle("aktif", x.dataset.gol === golAktif));
      document.querySelectorAll(".panel-gol").forEach(p => {
        p.hidden = p.dataset.gol !== golAktif;
      });
    });
  });

  document.querySelectorAll(".panel-gol").forEach(panel => {
    const kotak = [...panel.querySelectorAll(".isi-filter input[type=checkbox]")];
    const kepala = panel.querySelector(".th-saring");
    const isi = panel.querySelector(".isi-filter");
    const hitung = panel.querySelector(".hitung-filter");
    if (!kepala || !isi) return;

    // Panel MENGAMBANG di bawah kepala kolomnya, posisinya fixed dan
    // koordinatnya dihitung tiap kali dibuka: tabelnya duduk di wadah
    // bergulir, dan panel yang koordinatnya dihitung sekali akan tertinggal
    // di tempat lamanya begitu tabel digulir ke samping.
    const cariKotak = panel.querySelector(".cari-filter");
    // Panelnya DIPINDAH ke <body> saat dibuka. `position: fixed` hanya
    // relatif ke viewport selama tidak ada leluhur yang punya transform,
    // filter, atau will-change — begitu ada satu saja, ia jadi relatif ke
    // leluhur itu dan panelnya mendarat di tempat yang sama sekali lain.
    // Memindahkannya ke body menghapus seluruh pertanyaan itu.
    if (isi.parentElement !== document.body) document.body.appendChild(isi);
    const tempel = () => {
      const r = kepala.getBoundingClientRect();
      isi.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 300)) + "px";
      isi.style.top = (r.bottom + 2) + "px";
    };
    const tutup = () => {
      isi.hidden = true;
      kepala.setAttribute("aria-expanded", "false");
    };
    const buka = () => {
      if (isi.hidden) { tempel(); isi.hidden = false; } else isi.hidden = true;
      kepala.setAttribute("aria-expanded", String(!isi.hidden));
      if (!isi.hidden && cariKotak) cariKotak.focus();
    };
    document.addEventListener("click", e => {
      if (!isi.hidden && !isi.contains(e.target) && !kepala.contains(e.target)) tutup();
    });
    document.addEventListener("keydown", e => { if (e.key === "Escape") tutup(); });
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
    kepala.addEventListener("click", buka);
    kepala.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); buka(); }
    });

    const terapkan = () => {
      const pilih = new Set(kotak.filter(c => c.checked).map(c => c.value));
      panel.querySelectorAll("tbody tr[data-sekolah]").forEach(tr => {
        tr.hidden = pilih.size > 0 && !pilih.has(tr.dataset.sekolah);
      });
      hitung.textContent = pilih.size ? `(${pilih.size})` : "";
      kepala.classList.toggle("menyaring", pilih.size > 0);
    };
    kotak.forEach(c => c.addEventListener("change", terapkan));
    const semua = panel.querySelector(".tombol-semua");
    if (semua) semua.addEventListener("click", () => {
      kotak.forEach(c => { c.checked = false; });
      terapkan();
    });
  });
}

/* ---------------------------------------------------------------------------
   Menggambar ulang seluruh badan halaman.
   ------------------------------------------------------------------------- */
function gambar() {
  const isi = document.getElementById("isi");
  if (!META) return;

  document.getElementById("judul").textContent =
    `Live Score${META.edisi ? ` — ${META.edisi.name}` : ""}`;
  document.title = `Live Score — ${META.edisi ? META.edisi.name : "Hiking Rally Ciradyka"}`;

  // Susunannya SAMA dengan layar panitia: kemajuan di atas, lalu tab
  // golongan, lalu papan klasemen. Kotak cari sudah tidak ada — penyaring
  // Organisasi di kepala kolom menggantikannya.
  isi.innerHTML = !mulai()
    ? gambarPra()
    : gambarKelengkapan() + gambarPapan();

  if (mulai()) pasangPapan();
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
    // Diambil bersamaan, bukan berurutan: keduanya kecil dan salah satunya
    // boleh gagal tanpa menjatuhkan yang lain.
    await ambilFaseDb();
    const r = await fetch(`live.json?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    const baru = await r.json();
    const versiBerubah = !META || META.versi !== baru.versi;
    META = baru;

    // Rekap diambil ulang hanya kalau memang sudah dipegang (peserta sedang
    // melihatnya) atau memang harus tampil tanpa dicari (fase 'penuh').
    // Papan sekarang menggambar SELURUH regu begitu lomba mulai, bukan hanya
    // hasil pencarian — jadi rekap.json memang harus ada di tangan. Yang
    // menahan bebannya tetap alamat ber-versi: selama isinya tidak berubah,
    // tidak satu HP pun mengunduhnya dua kali.
    if (mulai() && (versiBerubah || !REKAP)) await muatRekap();

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
  /* FASE dipantau TERPISAH dan jauh lebih sering.
   *
   *  `live.json` di-poll 60 detik, dan itu tepat untuk isinya — ia berubah
   *  hanya ketika panitia menerbitkan ulang. Fase berbeda: ia ditekan justru
   *  ketika keadaan sedang panas, dan menunggu semenit bukan "langsung".
   *
   *  Permintaannya satu baris satu kolom, jadi 15 detik masih murah — beda
   *  jauh dari mengambil rekap.json lebih sering.
   *
   *  Dan yang paling menentukan di lapangan: BEGITU HP DIBUKA LAGI. Peserta
   *  mengunci layarnya lalu membukanya menit berikutnya; tanpa baris ini ia
   *  melihat papan basi sampai denyut berikutnya tiba. */
  if (denyutFase === null) {
    denyutFase = setInterval(async () => {
      const sebelum = FASE_DB;
      await ambilFaseDb();
      if (FASE_DB !== sebelum) gambar();
    }, 15000);
    const segera = async () => {
      if (document.visibilityState !== "visible") return;
      const sebelum = FASE_DB;
      await ambilFaseDb();
      if (FASE_DB !== sebelum) gambar();
    };
    document.addEventListener("visibilitychange", segera);
    window.addEventListener("focus", segera);
  }
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
