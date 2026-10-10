/* ============================================================================
   hrcd-rekap : screens/akun.js — layar Akun (#/account).

   Akun panitia dan hak aksesnya (akun_hak), per peran dan per fitur.
   ========================================================================== */

import { bolehLihat, buatAkun, daftarAkun, daftarFitur, daftarHak,
         resetPasswordAkun, setAktifAkun, setHak, ubahPeranAkun,
         ubahUsernameAkun } from "../api.js";
import { kartuGalat, LAYAR, pasangKepala } from "../common/frame.js";
import { dialog, esc, h, kartuGagalMuat, notif, pemuat } from "../util.js";

/* ============================ AKUN ======================================= */

export const PERAN_LABEL = { admin: "Admin", registrasi: "Registrasi",
                      gerbang: "Gerbang", juri_pos: "Juri Pos",
                      koordinator_pos: "Koordinator Pos" };

/** Kartu password. Ditampilkan SEKALI — tidak disimpan di mana pun dan tidak
 *  bisa dibaca lagi setelah dialognya ditutup, persis seperti CSV hasil
 *  provision_accounts.py. Karena itu dialognya baca-saja: tidak ada tombol
 *  Batal yang bisa tertekan sebelum angkanya sempat dicatat. */
export function tampilkanPassword(judul, baris) {
  return dialog({
    judul,
    bacaSaja: true,
    labelAksi: "Sudah dicatat",
    kartuHtml: `
      <div class="card">
        <table class="table">
          <thead><tr><th>Nama akun</th><th>Password</th></tr></thead>
          <tbody>${baris.map(b => `
            <tr><td>${esc(b.username)}</td>
                <td><code style="font-size:1.15em">${esc(b.password)}</code></td></tr>`).join("")}
          </tbody>
        </table>
      </div>
      <p>Password ini tidak bisa dibuka lagi setelah kotak ini ditutup.</p>`,
  });
}

export async function layarAkun() {
  pasangKepala("Akun", true);

  // RLS yang sebenarnya menahan — ini supaya layarnya tidak tampak kosong dan
  // membingungkan kalau alamatnya diketik langsung.
  if (!bolehLihat("akun")) {
    LAYAR.replaceChildren(h(kartuGalat("Hanya admin yang bisa mengelola akun.")));
    return;
  }

  LAYAR.replaceChildren(h(pemuat()));
  const layarIni = location.hash;
  let akun, fitur, hak;
  try { [akun, fitur, hak] = await Promise.all([daftarAkun(), daftarFitur(), daftarHak()]); }
  catch (e) { LAYAR.replaceChildren(kartuGagalMuat(e.message, layarAkun)); return; }
  if (location.hash !== layarIni) return;

  // Dijodohkan di browser: 20 akun x 11 fitur cuma 220 baris, jadi satu
  // bacaan lebih murah daripada satu query per akun.
  const punya = new Set(hak.map(x => `${x.user_id}|${x.fitur}`));
  const opsiPeran = (dipilih) => Object.entries(PERAN_LABEL)
    .map(([k, v]) => `<option value="${k}"${k === dipilih ? " selected" : ""}>${esc(v)}</option>`)
    .join("");

  /* .table-toolbar, bukan .option-row: option-row itu grid DUA kolom
     (style.css), jadi empat isian di dalamnya jatuh 2x2 dan kotak Pos
     yang isinya satu angka mendapat setengah lebar kartu. */
  /* Rata BAWAH, bukan rata tengah seperti toolbar saring: di sana label
     kotak carinya visually-hidden sehingga tidak memakan tinggi, di
     sini labelnya terlihat — dan rata tengah membuat tombolnya melayang
     setinggi label, tidak sejajar dengan kotak isian di sebelahnya. */
  /* .form-akun — Bentuknya sama dengan form pendaftaran: label di atas, isian
     SELEBAR kartunya. Sebelumnya ia .table-toolbar dengan lebar
     dipatok inline (14rem, 5rem) — di HP ketiganya terjepit ke kanan,
     labelnya melayang di tengah, dan kotak Pos menyusut jadi seukuran
     ibu jari. Lebar tetap di dalam wadah yang menyempit selalu
     berakhir begitu.

     Di layar lebar ia kembali sebaris lewat grid, tanpa satu pun ukuran
     dipatok tangan. */
  /* Peringatan "baru kolom Akun yang mengunci" dihapus di migrasi 0064:
     seluruh policy dan RPC sudah pindah ke boleh(), jadi kalimat itu
     tidak benar lagi. Yang tersisa satu baris, dan ia bertahan karena
     memuat akibat yang tidak bisa dibaca dari layar (CLAUDE.md 9.4):
     mengubah peran MENIMPA centang yang sudah diatur tangan. */
  /* .table-wrapper — Gaya yang sama dengan lembar Input Nilai Pos: di HP ini
     TETAP tabel dan digeser ke samping, kolom nama menempel di kiri, kepala
     tabel menempel di atas. Semua itu sudah ada di .table-pos — matriks ini
     tidak perlu aturan sendiri. */
  LAYAR.replaceChildren(h(`
    <div class="card">
      <h2>Buat Akun</h2>
      <div class="form-akun">
        <div class="field"><label for="ak-nama">Nama akun</label>
          <input id="ak-nama" type="text" class="small-input" autocomplete="off"
            placeholder="misal: aji.furqon"></div>
        <div class="field"><label for="ak-peran">Peran</label>
          <select id="ak-peran" class="select-small">${opsiPeran("registrasi")}</select></div>
        <div class="field" id="ak-pos-kotak" hidden><label for="ak-pos">Pos</label>
          <input id="ak-pos" type="number" class="small-input" inputmode="numeric"
            min="1" max="20" disabled></div>
        <button class="button button-primary" id="ak-buat" type="button">Buat Akun</button>
      </div>
      <div class="error" id="ak-galat" hidden></div>
    </div>

    <div class="card">
      <div class="table-toolbar">
        <h2 style="margin:0">Akun</h2>
        <span class="hint">${akun.length} akun</span>
      </div>
      <p>Mengganti peran mengisi ulang centangnya.</p>
      <div class="table-wrapper table-wrapper-tetap">
      <table class="table data-table table-tetap table-pos matriks-hak">
        <thead><tr>
          <th>Nama akun</th><th>Peran</th><th>Pos</th>
          ${fitur.map(f => `<th class="text-center">${esc(f.nama)}</th>`).join("")}
        </tr></thead>
        <tbody id="ak-tabel">
          ${akun.map(a => `
            <tr data-uid="${esc(a.user_id)}" data-nama="${esc(a.username)}"
                ${a.is_active ? "" : 'class="mati"'}>
              <td><button class="tautan" data-aksi type="button">${esc(a.username)}</button>${
                a.is_active ? "" : ' <span class="badge badge-gray">nonaktif</span>'}</td>
              <td><select class="select-small" data-peran>${opsiPeran(a.peran)}</select></td>
              <td><input type="number" class="small-input" data-pos min="1" max="20" style="width:4.5rem"
                    value="${a.pos ?? ""}" ${a.peran === "juri_pos" ? "" : "disabled"}></td>
              ${fitur.map(f => `
                <td class="text-center"><input type="checkbox" class="checkbox"
                  data-fitur="${esc(f.kode)}"
                  ${punya.has(`${a.user_id}|${f.kode}`) ? "checked" : ""}
                  aria-label="${esc(a.username)} - ${esc(f.nama)}"></td>`).join("")}
            </tr>`).join("")}
        </tbody>
      </table>
      </div>
    </div>
  `));

  const galat = document.getElementById("ak-galat");
  const lapor = (pesan) => { galat.textContent = pesan; galat.hidden = false; };
  const peranBaru = document.getElementById("ak-peran");
  const posBaru = document.getElementById("ak-pos");

  /* Pos hanya milik juri_pos — itu check constraint di database, bukan
     selera. Kotaknya DISEMBUNYIKAN, bukan sekadar dimatikan: kotak mati
     tetap memakan sebaris di layar HP dan tetap mengajukan pertanyaan yang
     jawabannya tidak ada. Yang tidak berlaku sebaiknya tidak terlihat. */
  const posKotak = document.getElementById("ak-pos-kotak");
  const setelPos = () => {
    const perlu = peranBaru.value === "juri_pos";
    posKotak.hidden = !perlu;
    posBaru.disabled = !perlu;
    if (!perlu) posBaru.value = "";
  };
  peranBaru.addEventListener("change", setelPos);
  setelPos();

  /* Nama akun jadi alamat email: `<nama>@ciradyka.com` (worker gateway).
     Jadi yang boleh hanya yang sah di bagian sebelum @ — huruf, angka, dan
     titik — dan titiknya tidak boleh di ujung atau berdempetan.

     Ditolak DI SINI supaya pesannya menyebut apa yang salah. Tanpa ini
     GoTrue yang menolak, dengan kalimat Inggris tentang format email yang
     tidak menyebut kotak mana yang harus dibetulkan. */
  const POLA_NAMA = /^[a-z0-9]+(\.[a-z0-9]+)*$/;
  const namaSah = (t) => POLA_NAMA.test(t);

  async function kirimBuat(daftar, tombol) {
    galat.hidden = true;
    if (tombol.dataset.jalan === "1") return;
    tombol.dataset.jalan = "1"; tombol.disabled = true;
    try {
      const { hasil } = await buatAkun(daftar);
      const jadi = hasil.filter(x => x.ok);
      const gagal = hasil.filter(x => !x.ok);
      if (jadi.length) await tampilkanPassword(`${jadi.length} Akun Dibuat`, jadi);
      if (gagal.length) lapor(gagal.map(x => `${x.username}: ${x.pesan}`).join(" — "));
      if (jadi.length) layarAkun();
    } catch (e) { lapor(e.message); }
    finally { tombol.dataset.jalan = ""; tombol.disabled = false; }
  }

  document.getElementById("ak-buat").addEventListener("click", (ev) => {
    const nama = document.getElementById("ak-nama").value.trim().toLowerCase();
    if (!nama) { lapor("Nama akun wajib diisi."); return; }
    if (!namaSah(nama)) {
      lapor("Nama akun hanya boleh huruf, angka, dan titik — dan titik tidak "
            + "boleh di awal, di akhir, atau berdempetan. Contoh: pos1hrcd37 "
            + "atau aji.furqon.");
      return;
    }
    kirimBuat([{ username: nama, peran: peranBaru.value,
      pos: peranBaru.value === "juri_pos" ? Number(posBaru.value) || null : null }],
      ev.currentTarget);
  });

  const tabel = document.getElementById("ak-tabel");
  // Satu antrean untuk SELURUH matriks, bukan per kotak: dua centang
  // beruntun di baris yang sama harus mendarat urut, dan urutan itulah
  // yang menentukan hak akhirnya.
  let antreHak = Promise.resolve();

  tabel.addEventListener("change", async (ev) => {
    const tr = ev.target.closest("tr");
    galat.hidden = true;

    // Centang: satu kotak = satu baris akun_hak. Dikirim seketika, dan
    // DIKEMBALIKAN kalau ditolak — kotak yang tetap tercentang padahal
    // servernya menolak adalah kebohongan yang baru ketahuan besok.
    //
    // Bentuknya SAMA PERSIS dengan ceklis keberangkatan, dan itu disengaja:
    // diredupkan selagi disimpan (bukan di-disable, lihat .checkbox.saving di
    // style.css), klik beruntun DIANTREKAN bukan diblokir supaya salah
    // centang bisa langsung dibatalkan, dan gagalnya lewat notif() — di tabel
    // yang tergulir ke kanan, tulisan galat di kartu paling atas ada di luar
    // layar.
    if (ev.target.matches("[data-fitur]")) {
      const kotak = ev.target;
      const mau = kotak.checked;
      kotak.classList.add("saving");
      antreHak = antreHak.then(async () => {
        try {
          await setHak(tr.dataset.uid, kotak.dataset.fitur, mau);
        } catch (e) {
          kotak.checked = !mau;
          notif(e.message, true);
        } finally {
          kotak.classList.remove("saving");
        }
      });
      return;
    }

    const peran = tr.querySelector("[data-peran]").value;
    const kotakPos = tr.querySelector("[data-pos]");
    if (ev.target.matches("[data-peran]")) {
      kotakPos.disabled = peran !== "juri_pos";
      if (kotakPos.disabled) kotakPos.value = "";
      else if (!kotakPos.value) { kotakPos.focus(); return; }
    }
    const pos = peran === "juri_pos" ? Number(kotakPos.value) || null : null;
    if (peran === "juri_pos" && !pos) { kotakPos.focus(); return; }
    try {
      await ubahPeranAkun(tr.dataset.uid, peran, pos);
      notif(`${tr.dataset.nama} sekarang ${PERAN_LABEL[peran]}${pos ? ` pos ${pos}` : ""}.`);
      // Kalimat "Mengganti peran mengisi ulang centangnya" di atas tabel itu
      // BENAR — tapi yang mengisinya database (trigger 0077), bukan layar ini,
      // jadi centang yang sedang tergambar sudah basi begitu perannya berganti.
      // Dulu ia baru betul sesudah halamannya dimuat ulang, dan sampai itu
      // terjadi layar memperlihatkan hak peran LAMA untuk peran BARU.
      await segarkanCentangBaris(tr);
    } catch (e) { lapor(e.message); layarAkun(); }
  });

  // Klik NAMA membuka aksi akunnya. Ditaruh di balik nama, bukan sebagai tiga
  // tombol per baris, karena barisnya sudah punya sebelas kotak centang —
  // tombol tambahan di situ akan mendorong matriksnya keluar layar HP.
  /* Centang satu baris dibaca ULANG dari server, bukan ditebak di sini.

     Menyalin isi paket_peran() ke browser akan membuat centangnya muncul
     tanpa satu permintaan pun — dan membuat dua tempat memutuskan hak yang
     sama, yang persis dilarang CLAUDE.md 13.1. Peta itu tinggal di database,
     dipakai trigger 0077 dan paket_peran(); salinan di layar akan benar hari
     ini dan diam-diam salah pada edisi yang menambah satu fitur.

     Harganya satu GET — jauh lebih murah daripada layarAkun(), yang menarik
     ketiga daftarnya sekaligus lalu menggambar ulang seluruh layar. */
  const segarkanCentangBaris = async (tr) => {
    const hak = await daftarHak();
    const punya = new Set(hak.filter(x => x.user_id === tr.dataset.uid)
                             .map(x => x.fitur));
    tr.querySelectorAll("[data-fitur]").forEach(kotak => {
      kotak.checked = punya.has(kotak.dataset.fitur);
    });
  };

  /* Rupa baris "nonaktif": kelas peredup di <tr> dan pil kecil di sebelah
     namanya. Ditulis sekali di sini supaya ia tidak berbeda pendapat dengan
     template di atas — dua tempat yang menggambar keadaan yang sama adalah
     dua tempat yang suatu hari tidak sepakat. */
  const tandaiBarisAktif = (tr, hidup) => {
    tr.classList.toggle("mati", !hidup);
    const sel = tr.querySelector("td");
    sel.querySelector(".badge")?.remove();
    if (!hidup)
      sel.insertAdjacentHTML("beforeend",
        ' <span class="badge badge-gray">nonaktif</span>');
  };

  tabel.addEventListener("click", async (ev) => {
    const tombol = ev.target.closest("[data-aksi]");
    if (!tombol) return;
    const tr = tombol.closest("tr");
    const uid = tr.dataset.uid, nama = tr.dataset.nama;
    const aktif = !tr.classList.contains("mati");
    galat.hidden = true;

    const pilih = await dialog({
      judul: nama,
      bacaSaja: true,
      silangSaja: true,
      kartuHtml: `
        <div class="option-row" style="flex-direction:column;gap:8px;align-items:stretch">
          <button class="button button-primary" data-pilih="password" type="button">Reset Password</button>
          <button class="button button-secondary" data-pilih="nama" type="button">Ubah Nama Akun</button>
          <button class="button button-secondary" data-pilih="aktif" type="button">${
            aktif ? "Nonaktifkan" : "Aktifkan"}</button>
        </div>`,
      pasang: (el, tutup) => el.querySelectorAll("[data-pilih]").forEach(b =>
        b.addEventListener("click", () => tutup(b.dataset.pilih))),
    });
    // Silang di pojok mengembalikan hal yang sama dengan Batal, dan array
    // kosong itu truthy — jadi yang diperiksa jenisnya, bukan kebenarannya.
    if (typeof pilih !== "string") return;

    try {
      if (pilih === "password") {
        const { password } = await resetPasswordAkun(uid);
        await tampilkanPassword(`Password Baru ${nama}`, [{ username: nama, password }]);
        return;
      }
      if (pilih === "nama") {
        const jawab = await dialog({
          judul: `Ubah nama akun ${nama}`,
          kartuHtml: "<p>Mulai sekarang dia login memakai nama yang baru.</p>",
          medan: [{ label: "Nama akun baru", nilai: nama }],
          labelAksi: "Ubah Nama",
        });
        if (jawab === null) return;
        await ubahUsernameAkun(uid, jawab[0]);
      }
      if (pilih === "aktif") {
        if (aktif) {
          const ya = await dialog({
            judul: `Nonaktifkan ${nama}?`,
            kartuHtml: "<p>Dia tidak bisa masuk lagi. Riwayat yang sudah dicatatnya tetap ada.</p>",
            labelAksi: "Nonaktifkan",
          });
          if (ya === null) return;
        }
        await setAktifAkun(uid, !aktif);
        // SATU BARIS yang berubah, jadi satu baris itu yang digambar ulang.
        // layarAkun() menarik ulang ketiga daftarnya, mengganti seluruh isi
        // layar, lalu memindahkan fokus ke kotak "Nama akun" di atas — di
        // tabel 13 akun yang digeser ke samping, posisi gulir mendatar dan
        // baris yang sedang dilihat ikut hilang. Yang berubah dari
        // mengaktifkan cuma dua hal, dan dua-duanya ada di baris ini.
        tandaiBarisAktif(tr, !aktif);
        return;
      }
      layarAkun();
    } catch (e) { lapor(e.message); }
  });

  document.getElementById("ak-nama").focus();
}
