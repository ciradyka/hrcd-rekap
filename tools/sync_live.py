r"""Salin berkas bersama web/ -> live/, lalu isi setiap `?v=` dari isi berkasnya.

KENAPA BERKAS INI ADA

Situs peserta (live/) memakai empat berkas yang sama dengan situs panitia:
style.css, config.js, js/api.js, dan js/util.js. Salinannya harus byte-identik,
dan setiap kali isinya berubah, alamatnya di HTML (`style.css?v=...`) juga harus
berubah — tab yang sudah terbuka sejak pagi, halaman yang dipulihkan dari
bfcache, dan perantara yang memegang salinan sendiri hanya mengambil berkas baru
kalau alamatnya berganti.

Dulu keduanya dikerjakan tangan: cp, lalu menaikkan nomor di tiga berkas HTML.
Nomornya pernah tertinggal empat kali berturut-turut (#874-#877), dan dua dari
tiga penghitung tidak dijaga apa pun — web/index.html berhenti di v=63 melewati
enam perubahan style.css, daftar.js melewati 27 perubahan dengan v=4.

Di sini `?v=` bukan nomor urut melainkan SIDIK JARI ISI berkasnya (12 huruf
pertama sha256, akhiran baris dinormalkan ke LF). Berkas berubah = alamat
berubah, tanpa ada yang perlu ingat.

PAKAI

    python tools/sync_live.py             # salin + isi ?v=
    python tools/sync_live.py --periksa   # hanya periksa; exit 1 kalau basi

Tes tests/live_asset_version.test.mjs memeriksa hal yang sama setiap kali
`node --test` dijalankan, jadi lupa menjalankan skrip ini membuat tes merah.

config.js TIDAK disalin selama web/config.js berisi mode "dev" — itu keadaan
laptop yang sedang membuka layar lokal (CLAUDE.md bagian 17), dan menyalinnya
akan mengirim situs peserta ke server dev yang tidak ada.
"""
import hashlib
import re
import shutil
import sys
from pathlib import Path

AKAR = Path(__file__).resolve().parent.parent

BERSAMA = ["style.css", "config.js", "js/api.js", "js/util.js"]
HALAMAN = ["web/index.html", "live/index.html", "live/daftar.html"]
VERSI = re.compile(r'((?:href|src)="([^"?#]+)\?v=)([^"]*)(")')


def sidik(berkas: Path) -> str:
    teks = berkas.read_text(encoding="utf-8").replace("\r\n", "\n")
    return hashlib.sha256(teks.encode("utf-8")).hexdigest()[:12]


def salin(periksa: bool) -> list[str]:
    basi = []
    for nama in BERSAMA:
        asal, tujuan = AKAR / "web" / nama, AKAR / "live" / nama
        if asal.read_bytes() == tujuan.read_bytes():
            continue
        if nama == "config.js" and 'mode: "dev"' in asal.read_text(encoding="utf-8"):
            basi.append(f"web/config.js bermode dev — kembalikan dulu (git checkout web/config.js)")
            continue
        basi.append(f"live/{nama} tidak sama dengan web/{nama}")
        if not periksa:
            shutil.copyfile(asal, tujuan)
    return basi


def stempel(periksa: bool) -> list[str]:
    basi = []
    for nama in HALAMAN:
        halaman = AKAR / nama
        teks = halaman.read_text(encoding="utf-8")

        def ganti(m: re.Match) -> str:
            berkas = halaman.parent / m.group(2)
            if not berkas.exists():
                basi.append(f"{nama}: {m.group(2)} dialamati tetapi berkasnya tidak ada")
                return m.group(0)
            baru = sidik(berkas)
            if m.group(3) != baru:
                basi.append(f"{nama}: {m.group(2)}?v={m.group(3)} seharusnya ?v={baru}")
            return m.group(1) + baru + m.group(4)

        hasil = VERSI.sub(ganti, teks)
        if hasil != teks and not periksa:
            halaman.write_text(hasil, encoding="utf-8", newline="")
    return basi


if __name__ == "__main__":
    periksa = "--periksa" in sys.argv[1:]
    # Salin dulu, baru stempel: sidik jari live/style.css harus dihitung dari
    # salinan yang sudah baru.
    basi = salin(periksa) + stempel(periksa)
    if periksa:
        if basi:
            print("Salinan live/ atau ?v= basi:")
            for b in basi:
                print(f"  {b}")
            print("Jalankan: python tools/sync_live.py")
            sys.exit(1)
        print("Salinan live/ sama dan setiap ?v= cocok dengan isinya.")
    else:
        if basi:
            print("Diperbarui:")
            for b in basi:
                print(f"  {b}")
        print("Selesai." if basi else "Tidak ada yang berubah.")
