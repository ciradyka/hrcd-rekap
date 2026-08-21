#!/usr/bin/env python3
"""Pastikan golongan tidak dituliskan ulang di luar berkas bersama.

KENAPA SKRIP INI BERUBAH ARAH

Dulu konstanta ini ada DUA KALI dengan sengaja — `web/js/app.js` untuk situs
panitia, `live/live.js` untuk situs peserta — dan skrip ini membandingkan
keduanya. Ternyata salinannya ADA TIGA: `app.js` menulisnya dua kali, sekali
sebagai `URUT_GOLONGAN` dan sekali lagi sebagai `URUTAN_GOLONGAN` di dekat
layar Live Score. Skrip lama mencari pola `const URUT_GOLONGAN`, jadi salinan
ketiga itu tidak pernah ia lihat — dan justru salinan ketiga itulah yang
dipakai Live Score menggambar tab golongan.

Sekarang definisinya tinggal di `web/js/util.js`, yang disalin byte-identik ke
`live/js/util.js` dan sudah dijaga `shared-files.yml`. Perbandingan tidak
diperlukan lagi: satu berkas, dijaga CI.

Yang tersisa dan tetap perlu mesin adalah mencegah salinan BARU lahir. Menulis
ulang daftar golongan itu murah dan terasa wajar — empat baris, terbaca benar,
tidak menggagalkan apa pun — dan itu persis bagaimana salinan ketiga dulu
muncul tanpa ada yang menyadarinya. Komentar yang menyuruh orang mengimpor
bukan penjaga; skrip ini yang jadi penjaganya.
"""

import pathlib
import re
import sys

# Dicari BENTUK PERSISNYA, bukan sekadar kata "golongan", dan itu penting.
# Pola yang lebih longgar ikut menangkap dua daftar yang memang BOLEH berdiri
# sendiri karena isinya fakta lain: label pendek untuk kolom cetak sempit
# ("Pgl Pa"), dan pilihan golongan di formulir pendaftaran yang memakai kata
# lain beserta keterangannya ("Penegak Putra — SMA / SMK / MA"). Penjaga yang
# menuduh keduanya akan dimatikan orang, bukan dipatuhi.
POLA_LABEL = re.compile(r"""["'](?:Penggalang PA|Penegak PA)["']""")
POLA_URUT = re.compile(
    r"""\[\s*["']penegak_pa["']\s*,\s*["']penegak_pi["']\s*,"""
    r"""\s*["']penggalang_pa["']\s*,\s*["']penggalang_pi["']\s*,"""
    r"""\s*["']intern_pa["']\s*,\s*["']intern_pi["']\s*\]""")

# Komentar dibuang lebih dulu. Tanpa ini penjaga menuduh kalimat yang justru
# MENJELASKAN kenapa label pendek ada — "Penggalang PA 13 huruf jadi Pgl Pa" —
# dan penjaga yang menuduh komentarnya sendiri akan dimatikan orang.
TANPA_KOMENTAR = re.compile(r"/\*.*?\*/|//[^\n]*", re.S)

# util.js memang tempatnya; berkas lain harus mengimpor dari sana.
SUMBER = "web/js/util.js"
DIPERIKSA = ["web/js/app.js", "live/live.js", "live/js/daftar.js"]


def kode_saja(teks):
    return TANPA_KOMENTAR.sub("", teks)


akar = pathlib.Path(__file__).resolve().parent.parent
gagal = False

sumber = akar / SUMBER
if not sumber.exists():
    print(f"GAGAL: {SUMBER} tidak ada.")
    sys.exit(1)

teks_sumber = kode_saja(sumber.read_text(encoding="utf-8"))
if not POLA_URUT.search(teks_sumber) or not POLA_LABEL.search(teks_sumber):
    print(f"GAGAL: {SUMBER} tidak lagi memuat definisi golongan.")
    print("       Kalau ia sengaja dipindah, perbarui skrip ini bersamanya.")
    sys.exit(1)

for nama in DIPERIKSA:
    berkas = akar / nama
    if not berkas.exists():
        continue
    teks = kode_saja(berkas.read_text(encoding="utf-8"))
    for pola, apa in ((POLA_LABEL, "label golongan"), (POLA_URUT, "urutan golongan")):
        if pola.search(teks):
            print(f"GAGAL: {nama} menuliskan {apa} sendiri.")
            print(f"       Impor dari {SUMBER} — di sana ia dijaga")
            print("       shared-files.yml, dan salinan yang menyimpang tidak")
            print("       menggagalkan apa pun sampai ada yang membandingkannya.")
            gagal = True

if gagal:
    sys.exit(1)

print(f"OK — golongan hanya didefinisikan di {SUMBER}.")
