#!/usr/bin/env python3
"""Pastikan URUT_GOLONGAN sama persis di layar panitia dan halaman peserta.

KENAPA PERLU DIPERIKSA MESIN

Konstanta ini ada DUA KALI dengan sengaja: `web/js/app.js` melayani situs
panitia, `live/live.js` melayani situs peserta, dan keduanya di-deploy sebagai
Worker terpisah tanpa satu pun berkas bersama. Tidak ada cara satu konstanta
hidup di dua akar tanpa disalin (lihat kepala shared-files.yml) — dan
`live.js` bukan salah satu berkas yang disalin utuh, karena isinya memang
berbeda; hanya baris inilah yang harus sama.

Layar Live Score menjanjikan satu hal: "ini persis yang akan dilihat peserta".
Kalau urutan golongannya berbeda, janji itu bohong dengan cara yang tidak
menggagalkan apa pun — tidak ada galat, tidak ada tes merah, cuma admin yang
menghafal urutan salah lalu membacakan juara dengan urutan itu di depan
lapangan.

Repo ini sudah pernah kehilangan 21 baris karena sepasang berkas yang
"seharusnya sama" tidak ada yang memeriksanya (CLAUDE.md 7.5). Komentar yang
menyuruh dua tempat tetap sama bukan penjaga; skrip ini yang jadi penjaganya.
"""

import pathlib
import re
import sys

POLA = re.compile(r"const URUT_GOLONGAN\s*=\s*\[(.*?)\]", re.S)
BERKAS = ["web/js/app.js", "live/live.js"]

akar = pathlib.Path(__file__).resolve().parent.parent
temuan = {}
gagal = False

for nama in BERKAS:
    berkas = akar / nama
    if not berkas.exists():
        print(f"GAGAL: {nama} tidak ada.")
        gagal = True
        continue
    cocok = POLA.search(berkas.read_text(encoding="utf-8"))
    if not cocok:
        print(f"GAGAL: {nama} tidak memuat `const URUT_GOLONGAN = [...]`.")
        gagal = True
        continue
    temuan[nama] = re.findall(r'"([^"]+)"', cocok.group(1))

if gagal:
    sys.exit(1)

urutan = list(temuan.values())
if urutan[0] != urutan[1]:
    print("GAGAL: urutan golongan berbeda antara kedua berkas.")
    for nama, isi in temuan.items():
        print(f"  {nama:<16} {isi}")
    print("\nSamakan keduanya — layar Live Score menjanjikan tampilan yang")
    print("identik dengan halaman peserta.")
    sys.exit(1)

# Keempatnya harus ada. Daftar yang kebetulan sama tapi kehilangan satu
# golongan lolos perbandingan di atas, dan golongan yang hilang tidak pernah
# digambar sama sekali.
WAJIB = {"penegak_pa", "penegak_pi", "penggalang_pa", "penggalang_pi"}
kurang = WAJIB - set(urutan[0])
if kurang:
    print(f"GAGAL: golongan hilang dari URUT_GOLONGAN: {sorted(kurang)}")
    sys.exit(1)

print(f"Urutan golongan sama di kedua berkas: {urutan[0]}")
