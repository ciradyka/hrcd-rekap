r"""Bangkitkan pratinjau cetak dari @media print di web/style.css.

KENAPA BERKAS INI ADA, DAN KENAPA PENYARINGNYA BUKAN REGEX.

Pratinjau ini dipakai memutuskan bentuk kertas — potret atau melintang,
memotong nama atau membungkusnya — jadi ia HARUS memakai CSS yang sama persis
dengan yang dicetak. Versi sebelumnya membuang aturan layar dengan regex
`\.(header|isi|notification|overlay)[^{]*\{[^}]*\}`, dan `.isi` di dalamnya
ikut menangkap `.isian` — kelas kotak nilai.

Akibatnya dua lapis. Aturan lebar kotak isian hilang, jadi kotaknya melar dan
menggencet kolom nama. Dan potongannya meninggalkan selektor menggantung
(`.lembar-pos .print-table th`) yang menempel ke aturan berikutnya, sehingga
`white-space: nowrap` tidak pernah berlaku — nama membungkus di pratinjau
padahal di cetakan sungguhan ia satu baris.

Keputusan bentuk kertas diambil beberapa putaran atas dasar pratinjau itu.
Karena itu penyaringnya sekarang mencocokkan SATU aturan yang diketahui, apa
adanya, dan berhenti dengan galat kalau aturan itu tidak ditemukan — lebih
baik gagal daripada diam-diam menghapus yang salah.
"""
import re
from pathlib import Path

AKAR = Path(__file__).resolve().parent.parent
# Satu-satunya aturan yang memang tidak boleh ikut: penyembunyi layar.
SEMBUNYI = (".header, .isi, .notification, .overlay,\n"
            "  .bottom-nav { display: none !important; }")


AWAL = "@media print {"


def _isi_blok(css: str, i: int) -> str:
    """Isi satu blok yang dimulai di `i`, dihitung dengan mencocokkan kurung."""
    dalam = 0
    for j in range(i, len(css)):
        if css[j] == "{":
            dalam += 1
        elif css[j] == "}":
            dalam -= 1
            if dalam == 0:
                return css[i + len(AWAL):j]
    raise SystemExit(f"Blok @media print di offset {i} tidak pernah ditutup.")


def css_cetak() -> str:
    """Isi SELURUH blok @media print, siap ditempel ke halaman pratinjau.

    Seluruhnya, bukan yang pertama. `style.css` punya lebih dari satu blok
    cetak, dan versi sebelumnya memakai `.index()` — yang mengambil kemunculan
    pertama saja. Aturan di blok kedua tidak pernah ikut pratinjau, tanpa satu
    pun tanda, sementara keputusan bentuk kertas diambil dari pratinjau itu.
    """
    css = (AKAR / "web" / "style.css").read_text(encoding="utf-8")

    potongan, i = [], css.find(AWAL)
    while i != -1:
        potongan.append(_isi_blok(css, i))
        i = css.find(AWAL, i + len(AWAL))

    if not potongan:
        raise SystemExit("Tidak ada blok @media print sama sekali di "
                         "web/style.css — aturan cetak hilang, atau "
                         "penulisannya berubah.")

    # Pagar yang menahan cacat ini kembali: kalau suatu hari ada yang
    # menggantinya dengan pembacaan satu blok lagi, jumlahnya tidak akan cocok
    # dan berkas ini berhenti dengan galat alih-alih diam-diam menerbitkan
    # pratinjau yang bohong.
    if len(potongan) != css.count(AWAL):
        raise SystemExit(
            f"{css.count(AWAL)} blok @media print di style.css, tetapi "
            f"{len(potongan)} yang terbaca. Pratinjau tidak boleh memakai "
            f"sebagian aturan cetak saja.")

    blok = "\n".join(potongan)

    if SEMBUNYI not in blok:
        raise SystemExit(
            "Aturan penyembunyi layar tidak ditemukan apa adanya di @media print.\n"
            "Jangan tebak — buka web/style.css, cocokkan teksnya, lalu perbarui\n"
            "SEMBUNYI di berkas ini. Menghapus yang salah membuat pratinjau\n"
            "berbohong, dan keputusan bentuk kertas diambil dari pratinjau.")
    blok = blok.replace(SEMBUNYI, "")

    # @page tidak berlaku di layar; dibuang supaya tidak membingungkan, dan
    # dicocokkan dengan pola yang tidak mungkin mengenai selektor kelas.
    blok = re.sub(r"@page\s+[\w-]*\s*\{[^}]*\}", "", blok)

    if ".isian" not in blok:
        raise SystemExit("Aturan .isian ikut terbuang — persis cacat yang "
                         "membuat berkas ini ditulis. Periksa penyaringnya.")
    return blok


if __name__ == "__main__":
    print(css_cetak()[:400])
