/* ============================================================================
   hrcd-rekap : screens/daftar-ulang.js — layar Meja Daftar Ulang (#/daftar-ulang).

   Memberi nomor dada kepada regu yang sudah lunas, dan menukar nomor yang
   rusak.
   ========================================================================== */

import { daftarPendaftaran, daftarUlang, rentangNomorDada,
         tukarNomor } from "../api.js";
import { alatTabel, barisTerakhirHtml, catatTerakhir, cocokCari, EDISI, LAYAR,
         layarButuhEdisi, pasangAlatTabel, pasangKepala,
         reguAktif } from "../common/frame.js";
import { pasangCentangRiwayat,
         tombolRiwayat } from "../common/riwayat-pendaftaran.js";
import { deretCocok, deretIntern, pesanDeret } from "../nomor-dada-series.mjs";
import { dada3, dialog, esc, GOLONGAN_LABEL, h, html, kartuGagalMuat, notif,
         pemuat } from "../util.js";

/* ============================ MEJA DAFTAR ULANG ========================== */

export async function layarDaftarUlang() {
  if (!EDISI) { layarButuhEdisi("Meja Daftar Ulang"); return; }
  pasangKepala("Meja Daftar Ulang", true);
  LAYAR.replaceChildren(h(pemuat()));

  const layarIni = location.hash;
  let semua, rentang;
  try {
    // Rentang deret ikut diambil di sini supaya nomor dari deret yang salah
    // memerah DI KOTAKNYA, bukan baru ditolak server sesudah belasan kotak
    // terisi. Gagal mengambilnya tidak boleh mematikan meja: `null` berarti
    // layar berhenti menilai deret, dan database tetap yang memutuskan.
    [semua, rentang] = await Promise.all([
      daftarPendaftaran(),
      rentangNomorDada().catch(() => null),
    ]);
  }
  catch (e) { LAYAR.replaceChildren(kartuGagalMuat(e.message, layarDaftarUlang)); return; }
  if (location.hash !== layarIni) return;   // lihat catatan di layarPembayaran

  // Batch yang daftar isian nomor dadanya sedang dibuka, dan nomor yang sudah
  // sempat diketik (regu_id -> nomor). Keduanya hidup di luar gambar(): meja
  // sering mengetik separuh lalu mengoreksi jumlah pendamping atau mencari
  // sekolah lain, dan tabel digambar ulang setiap kali. Tanpa ini, angka yang
  // sudah dibacakan dari kain fisik hilang diam-diam — persis kejadian yang
  // paling mahal di meja daftar ulang.
  const dibukaNomor = new Set();
  const nilaiDada = new Map();

  /* Tidak ada kolom Regu di sini. Jumlahnya sudah tercetak di
     dalam tombol "Isi N Nomor Dada" di kolom terakhir, dan
     kolom sendiri hanya untuk mengulanginya adalah lebar yang
     terbuang — di jendela sempit lebar itulah yang membuat
     tombolnya terdorong keluar layar. */
  /* Empat kolom, dua terakhir tanpa judul: nomor dada, lalu
     tombol tukar. Dulu keduanya berbagi satu kolom, dan
     tombolnya jatuh ke baris kedua tiap kali nomornya lebih
     dari dua — tinggi baris jadi dua kali lipat untuk
     sebagian sekolah saja, dan tabelnya bergerigi. */
  LAYAR.replaceChildren(h(`
    <div class="card">
      ${alatTabel({
        saringan: [
          { kode: "semua", label: "Semua" },
          { kode: "belum", label: "Perlu Nomor Dada", pendek: "Belum" },
          { kode: "sudah", label: "Selesai" },
        ],
        saringAktif: "belum",
        jumlah: semua.length,
      })}
      <div class="table-wrapper">
        <table class="table data-table table-daftar-ulang">
          <thead>
            <tr>
              <th>Kode Bayar</th><th>Sekolah</th><th></th><th></th>
            </tr>
          </thead>
          <tbody id="isi-tabel"></tbody>
        </table>
      </div>
    </div>
    ${barisTerakhirHtml("daftar-ulang")}
  `));

  const gambar = (cari, saring) => {
    // Hanya batch lunas yang relevan di meja ini — yang belum bayar
    // diarahkan ke meja pembayaran dulu, bukan ditampilkan lalu ditolak.
    const lunas = semua.filter(b => b.status === "lunas");
    const belumSemua = (b) => reguAktif(b).some(r => r.nomor_dada === null);
    const baris = lunas.filter(b =>
      cocokCari(b, cari) &&
      (saring === "semua" || (saring === "sudah" ? !belumSemua(b) : belumSemua(b))));

    document.getElementById("tabel-jumlah").textContent = `${baris.length} baris`;
    const tbody = document.getElementById("isi-tabel");

    if (!baris.length) {
      tbody.replaceChildren(h(`<tr><td colspan="4" class="table-empty">
        Tidak ada yang cocok.</td></tr>`));
      return;
    }

    tbody.replaceChildren(h(baris.map(b => {
      const aktif = reguAktif(b);
      const menunggu = aktif.filter(r => r.nomor_dada === null);
      // Pil nomor dada = penanda "sudah selesai" di layar ini, jadi PIL ITU
      // yang jadi tombol riwayat — sejajar dengan lencana LUNAS di Meja
      // Pembayaran, dan tanpa menggambar satu lambang baru pun. Bentuknya
      // tidak berubah sedikit pun; yang bertambah cuma bisa diketuk.
      //
      // TAPI hanya kalau seluruh regunya sudah bernomor. Batch yang baru
      // separuh terisi juga menampilkan nomor yang sudah masuk, di bawah
      // tombol "Isi N Nomor Dada" — dan di sana pil yang bisa diketuk
      // menyatakan baris itu selesai, padahal petugas justru sedang berdiri
      // di tengah pekerjaannya.
      const pilNomor = (bisaKlik) => aktif.filter(r => r.nomor_dada !== null)
        .sort((x, y) => x.nomor_dada - y.nomor_dada)
        .map(r => {
          const isi = html`${dada3(r.nomor_dada)}<span
            class="kloter-pill">K${r.kloter_nomor}</span>`;
          return bisaKlik
            ? tombolRiwayat(b.kode_pembayaran, isi, "pill-number")
            : `<span class="pill-number">${isi}</span>`;
        }).join(" ");

      const kode = esc(b.kode_pembayaran);
      const tombolTukar = aktif.some(r => r.nomor_dada !== null)
        ? `<button class="button button-secondary button-mini" type="button"
                   data-tukar="${kode}">Tukar nomor rusak…</button>`
        : "";
      // Nomor dada DIKETIK petugas, tidak diterbitkan sistem (migrasi 0011):
      // kainnya benda fisik di meja, dan yang ada di tangan petugas belum
      // tentu nomor terkecil yang tersedia. Jadi tombolnya membuka daftar
      // regu untuk diisi satu per satu, bukan langsung menarik stok.
      const terbuka = dibukaNomor.has(b.kode_pembayaran);
      const aksi = menunggu.length
        ? `<button class="button-detail" type="button"
                   data-isi="${kode}" data-jumlah="${menunggu.length}"
                   aria-expanded="${terbuka}">
             ${terbuka ? "▾" : "▸"} Isi ${menunggu.length} Nomor Dada
           </button>${aktif.some(r => r.nomor_dada !== null)
             ? `<div class="sub">${pilNomor(false)}</div>` : ""}`
        : `<div class="pill-row">${pilNomor(true)}</div>`;

      // Template biasa (lihat catatan sama di layar Pembayaran).
      /* Nama-nama regu TIDAK ditampilkan di sini. Barisnya panjang dan
         memakan lebar yang dibutuhkan kolom di kanannya, padahal yang
         dicari petugas di layar ini adalah SEKOLAHNYA — nama regunya
         baru relevan saat mengisi nomor dada, dan di sana ia memang
         tampil satu per satu di rincian. Pencarian tetap mengenali
         nama regu (lihat cocokCari), jadi mengetik nama regu tetap
         menemukan sekolahnya. */
      /* Sel kosong terakhir menyeimbangkan kolom "Tukar nomor
         rusak…" di tabel induk. Tanpa itu jumlah kolom kedua
         tabel berbeda, dan di layar lebar (table-layout: fixed)
         kotak nomor dada tidak lagi jatuh tepat di bawah tombol
         yang membukanya. Disembunyikan di bawah 941px — lihat
         style.css. */
      return `
        <tr data-baris="${kode}">
          <td class="mono" data-label="Kode Bayar">${kode}</td>
          <td data-label="Sekolah">
            <strong>${esc(b.sekolah?.name || "—")}</strong>
          </td>
          <td data-label="" class="kol-dada">${aksi}</td>
          <td data-label="" class="kol-tukar">${tombolTukar}</td>
        </tr>
        ${!menunggu.length ? "" : `
        <tr class="detail-row" data-nomor-untuk="${kode}" ${terbuka ? "" : "hidden"}>
          <td colspan="4" class="detail-cell-flush">
            <table class="detail-table detail-table-dada">
              <thead>
                <tr><th>Regu</th><th>Kategori</th><th>Ketua</th>
                    <th>Nomor dada${deretIntern(menunggu) && rentang
                      ? `<span class="sub">Internal ${rentang.internMulai}–${rentang.internSampai}</span>`
                      : ""}</th>
                    <th class="kol-imbang"></th></tr>
              </thead>
              <tbody>
                ${menunggu.map(r => `
                  <tr>
                    <td><strong>${esc(r.nama_regu)}</strong></td>
                    <td>${esc(GOLONGAN_LABEL[r.golongan] || r.golongan)}</td>
                    <td>${esc(r.nama_ketua)}</td>
                    <td><input type="number" class="small-input" inputmode="numeric" min="1"
                               data-dada="${esc(r.id)}" data-untuk="${kode}"
                               data-golongan="${esc(r.golongan)}"
                               value="${esc(nilaiDada.get(r.id) ?? "")}"></td>
                    <td class="kol-imbang"></td>
                  </tr>`).join("")}
              </tbody>
            </table>
            <div class="action-row action-row-simpan" style="margin-top:.6rem">
              <span class="sub">Nomor dada yang diinput <strong>HARUS SAMA</strong>
                dengan yang diberikan ke regunya.</span>
              <button class="button button-primary button-small" type="button"
                      data-simpan-dada="${kode}">Simpan ${menunggu.length} Nomor Dada</button>
            </div>
          </td>
        </tr>`}`;
    }).join("")));

    // Riwayat perubahan pendaftaran ini — lihat catatan sama di Meja Pembayaran.
    pasangCentangRiwayat(tbody);

    // Nomor rusak/sobek di lapangan: nomor lama PENSIUN (tidak pernah terbit
    // ulang), supaya lembar nilai lama tidak menilai regu yang salah.
    tbody.querySelectorAll("[data-tukar]").forEach(btn =>
      btn.addEventListener("click", async () => {
        const kode = btn.dataset.tukar;
        const b = semua.find(x => x.kode_pembayaran === kode);
        const bernomor = reguAktif(b).filter(r => r.nomor_dada !== null);
        if (!bernomor.length) { notif("Sekolah ini belum punya nomor dada.", true); return; }
        const jawab = await dialog({
          judul: "Tukar nomor dada yang rusak",
          kartuHtml: `<table class="table" style="margin-bottom:.8rem">${bernomor.map(r => html`
              <tr><td class="angka">${dada3(r.nomor_dada)}</td>
                  <td>${r.nama_regu}</td></tr>`).join("")}</table>`,
          medan: [
            { label: "Nomor lama (yang rusak)", tipe: "number" },
            { label: "Nomor pengganti (dari stok)", tipe: "number" },
            { label: "Alasan", contoh: "misal: kain sobek" },
          ],
          labelAksi: "Tukar nomor",
        });
        if (!jawab) return;
        const [lama, baru, alasan] = jawab;
        const regu = bernomor.find(r => r.nomor_dada === Number(lama));
        if (!regu) { notif(`Nomor ${lama} bukan milik sekolah ini.`, true); return; }
        if (!Number.isInteger(Number(baru)) || Number(baru) <= 0) {
          notif("Nomor pengganti harus angka.", true); return;
        }
        try {
          await tukarNomor(regu.id, Number(baru), alasan);
          regu.nomor_dada = Number(baru);
          catatTerakhir("daftar-ulang", kode, `tukar nomor ${lama} → ${baru}`);
          notif(`Nomor ${lama} diganti ${baru}. Nomor lama tidak dipakai lagi.`);
          gambar(cari, saring);
        } catch (err) { notif(err.message, true); }
      }));

    // Buka daftar regu untuk diisi nomornya, lalu taruh kursor di regu pertama.
    tbody.querySelectorAll("[data-isi]").forEach(btn =>
      btn.addEventListener("click", () => {
        const kode = btn.dataset.isi;
        const barisNomor = tbody.querySelector(`[data-nomor-untuk="${CSS.escape(kode)}"]`);
        const buka = barisNomor.hidden;

        // AKORDEON: hanya SATU sekolah terbuka pada satu waktu. Dua daftar
        // isian terbuka bersamaan membuat petugas mudah mengetik nomor
        // sekolah A ke baris sekolah B — kesalahan yang tidak menimbulkan
        // galat apa pun dan baru ketahuan saat klasemen keluar. Angka yang
        // sudah diketik TIDAK hilang: tersimpan di nilaiDada dan muncul lagi
        // saat sekolahnya dibuka ulang.
        if (buka) {
          tbody.querySelectorAll("[data-nomor-untuk]").forEach(lain => {
            if (lain !== barisNomor) lain.hidden = true;
          });
          tbody.querySelectorAll("[data-isi]").forEach(lainBtn => {
            if (lainBtn === btn) return;
            lainBtn.setAttribute("aria-expanded", "false");
            lainBtn.textContent = `▸ Isi ${lainBtn.dataset.jumlah} Nomor Dada`;
          });
          dibukaNomor.clear();
        }

        if (buka) dibukaNomor.add(kode); else dibukaNomor.delete(kode);
        barisNomor.hidden = !buka;
        btn.setAttribute("aria-expanded", String(buka));
        const jumlah = barisNomor.querySelectorAll("[data-dada]").length;
        btn.textContent = `${buka ? "▾" : "▸"} Isi ${jumlah} Nomor Dada`;
        // Auto-focus HANYA di layar lebar. Di HP, focus() memunculkan
        // keyboard dan menggeser halaman, sehingga ketukan berikutnya
        // meleset dari tombol ini — terasa seperti tombolnya tidak bisa
        // diklik ulang (laporan pengguna).
        if (buka && window.matchMedia("(min-width: 561px)").matches)
          barisNomor.querySelector("[data-dada]")?.focus();
      }));

    // Loop ketik-Enter (rancangan-b.md 10.1.4): Enter pindah ke regu
    // berikutnya, dan di regu terakhir langsung menyimpan — satu sekolah
    // selesai tanpa memegang mouse.
    // Deret yang salah memerah SAMBIL DIKETIK, tidak menunggu tombol Simpan.
    // Kain Internal bertulis 001 sama seperti kain Eksternal, jadi mengetik tiga
    // angka untuk regu Internal adalah kekeliruan yang paling mungkin terjadi di
    // meja — dan menahannya sampai Simpan berarti petugas sudah mengetik
    // sepuluh nomor sebelum tahu yang pertama salah.
    const tandaiDeret = (inp) => {
      const isi = inp.value.trim();
      const angka = Number(isi);
      const salah = !!isi && rentang && Number.isInteger(angka) && angka > 0
        && !deretCocok(rentang, inp.dataset.golongan, angka);
      inp.classList.toggle("input-error", salah);
    };

    tbody.querySelectorAll("[data-dada]").forEach(inp => {
      tandaiDeret(inp);
      inp.addEventListener("input", () => {
        nilaiDada.set(inp.dataset.dada, inp.value);
        tandaiDeret(inp);
      });
      inp.addEventListener("keydown", e => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        const untuk = CSS.escape(inp.dataset.untuk);
        const sekelompok = [...tbody.querySelectorAll(`[data-dada][data-untuk="${untuk}"]`)];
        const berikut = sekelompok[sekelompok.indexOf(inp) + 1];
        if (berikut) berikut.focus();
        else tbody.querySelector(`[data-simpan-dada="${untuk}"]`)?.click();
      });
    });

    tbody.querySelectorAll("[data-simpan-dada]").forEach(btn =>
      btn.addEventListener("click", async () => {
        if (btn.dataset.jalan === "1") return;
        const kode = btn.dataset.simpanDada;
        const b = semua.find(x => x.kode_pembayaran === kode);
        const isian = [...tbody.querySelectorAll(
          `[data-dada][data-untuk="${CSS.escape(kode)}"]`)];

        // Gagal itu nyaring dan LOKAL (rancangan-b.md 10.1.11): isian yang
        // salah memerah di tempatnya, bukan cuma pesan umum di bawah layar.
        isian.forEach(i => i.classList.remove("input-error"));
        const pasangan = [];
        const dipakai = new Set();
        let keluhan = null;
        for (const inp of isian) {
          const angka = Number(inp.value.trim());
          if (!inp.value.trim() || !Number.isInteger(angka) || angka <= 0) {
            inp.classList.add("input-error");
            keluhan = keluhan || "Setiap regu harus diberi nomor dada berupa angka.";
            continue;
          }
          if (dipakai.has(angka)) {
            inp.classList.add("input-error");
            keluhan = keluhan || `Nomor ${angka} diketik untuk dua regu.`;
            continue;
          }
          // Kain Internal bertulis 001 sama seperti kain Eksternal, dan
          // mengetik apa yang terbaca adalah hal paling wajar sedunia —
          // karena itu yang ditolak di sini bukan salah ketik, melainkan
          // kekeliruan yang PASTI terjadi kalau tidak ditolak.
          if (rentang && !deretCocok(rentang, inp.dataset.golongan, angka)) {
            inp.classList.add("input-error");
            keluhan = keluhan || pesanDeret(rentang, inp.dataset.golongan);
            continue;
          }
          dipakai.add(angka);
          pasangan.push({ regu_id: inp.dataset.dada, nomor_dada: angka });
        }
        if (keluhan) {
          notif(keluhan, true);
          isian.find(i => i.classList.contains("input-error"))?.focus();
          return;
        }

        btn.dataset.jalan = "1"; btn.disabled = true; btn.textContent = "Menyimpan…";
        let hasil;
        try {
          hasil = await daftarUlang(kode, pasangan);
        } catch (err) {
          notif(err.message, true);
          btn.dataset.jalan = ""; btn.disabled = false;
          btn.textContent = `Simpan ${isian.length} Nomor Dada`;
          return;
        }
        // Tempelkan nomor + kloter ke data lokal. Kloternya yang baru: itu
        // satu-satunya bagian yang masih ditentukan sistem, jadi itu yang
        // disebut di notifikasi.
        hasil.forEach(x => {
          const r = (b.regu || []).find(y => y.id === x.regu_id);
          if (r) { r.nomor_dada = x.nomor_dada; r.kloter_nomor = x.kloter; }
        });
        dibukaNomor.delete(kode);
        pasangan.forEach(p => nilaiDada.delete(p.regu_id));
        catatTerakhir("daftar-ulang", kode, hasil.map(x =>
          `${x.nama_regu} ${dada3(x.nomor_dada)}`).join(", "));
        const kloter = [...new Set(hasil.map(x => x.kloter))].sort((x, y) => x - y).join(", ");
        notif(`${b.sekolah?.name || kode}: ${hasil.length} regu tersimpan — kloter ${kloter}.`);
        gambar(cari, saring);
      }));
  };

  pasangAlatTabel(gambar);
}
