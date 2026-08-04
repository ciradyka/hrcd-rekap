/* ============================================================================
   hrcd-rekap : util.js — alat bersama yang dipakai semua layar.
   Yang terpenting: esc(). Nama sekolah dan nama regu diketik orang luar dan
   ditampilkan ke panitia — tanpa escape, satu nama berisi tag HTML bisa
   menjalankan skrip di layar panitia (temuan review: XSS tersimpan).
   ========================================================================== */

/** Escape teks agar aman ditaruh di dalam HTML maupun di dalam atribut. */
export function esc(v) {
  if (v === null || v === undefined) return "";
  return String(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Bangun fragmen DOM dari string HTML. */
export function h(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content;
}

/** Tag template literal yang meng-escape SEMUA nilai yang disisipkan.
 *  Pakai html`...${namaSekolah}...` alih-alih string biasa. */
export function html(potongan, ...nilai) {
  return potongan.reduce((hasil, p, i) =>
    hasil + p + (i < nilai.length ? esc(nilai[i]) : ""), "");
}

export const rupiah = n => "Rp " + Number(n || 0).toLocaleString("id-ID");

export const jamSekarang = () =>
  new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

/** Notifikasi bawah layar. Galat TIDAK hilang sendiri — orang awam sering
 *  sedang melihat papan ketik saat pesan muncul (temuan review). */
export function notif(pesan, galat = false) {
  document.querySelectorAll(".notif").forEach(n => n.remove());
  const n = h(html`<div class="notif ${galat ? "galat" : ""}" role="alert">
      <span>${pesan}</span>
      ${galat ? '<button class="notif-tutup" type="button" aria-label="tutup">✕</button>' : ""}
    </div>`);
  document.body.appendChild(n);
  const el = document.body.lastElementChild;
  if (galat) el.querySelector(".notif-tutup").addEventListener("click", () => el.remove());
  else setTimeout(() => el.remove(), 4000);
}

/** Dialog sederhana pengganti prompt(): punya judul, kartu identitas,
 *  beberapa isian, dan tombol batal yang jelas (temuan review: prompt()
 *  beruntun membingungkan dan batalnya senyap). */
export function dialog({ judul, kartuHtml = "", medan = [], labelAksi = "Simpan" }) {
  return new Promise(resolve => {
    const wadah = h(html`<div class="tirai" role="dialog" aria-modal="true"></div>`);
    document.body.appendChild(wadah);
    const el = document.body.lastElementChild;
    el.innerHTML = `
      <div class="dialog">
        <h2>${esc(judul)}</h2>
        ${kartuHtml}
        ${medan.map((m, i) => `
          <div class="medan">
            <label for="dlg-${i}">${esc(m.label)}</label>
            <input id="dlg-${i}" type="${m.tipe || "text"}"
                   inputmode="${m.tipe === "number" ? "numeric" : "text"}"
                   value="${esc(m.nilai ?? "")}" placeholder="${esc(m.contoh ?? "")}">
            ${m.bantuan ? `<div class="bantuan">${esc(m.bantuan)}</div>` : ""}
          </div>`).join("")}
        <div class="dialog-galat galat" hidden></div>
        <div class="pilihan-baris">
          <button class="tombol tombol-kalem" data-batal type="button">Batal</button>
          <button class="tombol tombol-utama" data-ok type="button">${esc(labelAksi)}</button>
        </div>
      </div>`;

    const tutup = hasil => { el.remove(); resolve(hasil); };
    el.querySelector("[data-batal]").addEventListener("click", () => tutup(null));
    el.addEventListener("click", e => { if (e.target === el) tutup(null); });
    el.querySelector("[data-ok]").addEventListener("click", () => {
      const nilai = medan.map((_, i) => el.querySelector(`#dlg-${i}`).value.trim());
      const kosong = medan.findIndex((m, i) => m.wajib !== false && !nilai[i]);
      if (kosong >= 0) {
        const g = el.querySelector(".dialog-galat");
        g.textContent = `${medan[kosong].label} wajib diisi.`;
        g.hidden = false;
        el.querySelector(`#dlg-${kosong}`).focus();
        return;
      }
      tutup(nilai);
    });
    const p = el.querySelector("input");
    if (p) p.focus();
    el.addEventListener("keydown", e => {
      if (e.key === "Escape") tutup(null);
      if (e.key === "Enter") el.querySelector("[data-ok]").click();
    });
  });
}

/** Kartu galat besar dengan tombol coba lagi — pengganti layar "Memuat…"
 *  yang menggantung selamanya (temuan review). */
export function kartuGagalMuat(pesan, saatCobaLagi) {
  const frag = h(html`
    <div class="kartu" style="border-color:var(--bahaya);background:var(--bahaya-muda)">
      <h2>Gagal memuat</h2>
      <p class="keterangan">${pesan}</p>
      <button class="tombol tombol-utama" data-ulang type="button" style="margin-top:.8rem">
        Coba lagi
      </button>
    </div>`);
  frag.querySelector("[data-ulang]").addEventListener("click", saatCobaLagi);
  return frag;
}
