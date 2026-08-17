#!/usr/bin/env python3
# ============================================================================
# hrcd-rekap : scripts/set_shared_password.py — setel SATU password yang sama
# untuk semua akun panitia sekaligus.
#
# KENAPA ADA, PADAHAL change_password.py SENGAJA MENGACAK
#
# `change_password.py` tidak pernah menerima password sebagai argumen, dan
# alasannya benar: password yang diketik ke kotak "Run workflow" tersimpan
# PERMANEN di riwayat GitHub, beda dari log biasa yang bisa dihapus.
#
# Skrip ini melanggar aturan itu dengan sengaja, dan hanya untuk satu keadaan:
# password bootstrap yang memang akan dibagikan ke satu grup — misalnya pagi
# simulasi, supaya sepuluh orang bisa login tanpa sepuluh serah-terima
# password acak satu per satu. Password seperti itu tidak punya kerahasiaan
# untuk dilindungi; ia akan ada di grup WA lima menit setelah dibuat. Aturan di
# change_password.py melindungi password RAHASIA, dan ini bukan salah satunya.
#
# YANG HILANG SELAMA PASSWORD INI BERLAKU, DAN INI BUKAN HAL KECIL
#
# `riwayat`, `diinput_oleh`, dan catatan siapa membuka gembok nilai semuanya
# mengandaikan satu akun = satu orang. Dengan password bersama, "siapa yang
# membuka gembok 001" tidak terjawab — dan catatan itu satu-satunya keterangan
# yang tersisa tentang kejadiannya. Setelah simulasi, kembalikan tiap akun ke
# password acaknya sendiri lewat "Ganti password akun panitia".
#
# ADMIN DIKECUALIKAN SECARA BAWAAN
#
# Akun admin memegang layar Akun, dan dari sana siapa pun bisa memberi dirinya
# hak apa pun. Password admin yang sama dengan password grup berarti seluruh
# matriks hak akses tidak menahan apa-apa. Ikutkan hanya kalau memang itu yang
# dimaksud (--termasuk-admin).
#
# PAKAI (di terminal SENDIRI):
#   $env:SUPABASE_URL = "https://xxxx.supabase.co"
#   $env:SUPABASE_SERVICE_KEY = "sb_secret_..."
#   python scripts/set_shared_password.py "<password bersama>"
# ============================================================================
import os
import sys

import requests

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

# Supabase menolak password di bawah 6 karakter; 8 dipakai di sini supaya
# password bersama tidak lebih lemah daripada yang acak sepanjang 10.
PANJANG_MIN = 8


def headers():
    return {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
    }


def daftar_akun():
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/akun_panitia",
        params={"select": "user_id,username,peran,pos,is_active", "order": "username"},
        headers=headers(), timeout=20,
    )
    r.raise_for_status()
    return r.json()


def main():
    if not SUPABASE_URL or not SERVICE_KEY:
        print("Set dulu SUPABASE_URL dan SUPABASE_SERVICE_KEY di environment kamu.")
        sys.exit(1)

    argv = [a for a in sys.argv[1:]]
    termasuk_admin = "--termasuk-admin" in argv
    argv = [a for a in argv if not a.startswith("--")]
    if not argv:
        print("Pakai: python set_shared_password.py <password> [--termasuk-admin]")
        sys.exit(1)

    password = argv[0]
    if len(password) < PANJANG_MIN:
        print(f"x Password minimal {PANJANG_MIN} karakter.")
        sys.exit(1)

    # Sembunyikan dari SEMUA baris log berikutnya di run ini, sekalipun ada
    # langkah lain yang tanpa sengaja ikut mencetaknya. Ini tidak menutupi
    # riwayat "Run workflow" — lihat catatan di kepala berkas.
    print(f"::add-mask::{password}")

    akun = daftar_akun()
    aktif = [a for a in akun if a["is_active"]]
    if not termasuk_admin:
        sasaran = [a for a in aktif if a["peran"] != "admin"]
        dilewati = [a for a in aktif if a["peran"] == "admin"]
    else:
        sasaran, dilewati = aktif, []

    if not sasaran:
        print("x Tidak ada akun yang jadi sasaran.")
        sys.exit(1)

    print(f"{len(akun)} akun panitia, {len(aktif)} aktif, {len(sasaran)} akan diganti.")
    for a in dilewati:
        print(f"  - dilewati (admin): {a['username']}")
    # Akun tidak aktif sengaja tidak disentuh: ia milik edisi lama dan tidak
    # bisa login apa pun passwordnya. Menggantinya cuma menambah akun yang
    # tahu password bersama tanpa satu pun manfaat.
    for a in akun:
        if not a["is_active"]:
            print(f"  - dilewati (tidak aktif): {a['username']}")

    gagal = 0
    for a in sasaran:
        r = requests.put(
            f"{SUPABASE_URL}/auth/v1/admin/users/{a['user_id']}",
            headers=headers(), json={"password": password}, timeout=20,
        )
        if r.status_code in (200, 201):
            pos = f" pos {a['pos']}" if a["pos"] is not None else ""
            print(f"  v {a['username']} ({a['peran']}{pos})")
        else:
            gagal += 1
            print(f"  x {a['username']}: HTTP {r.status_code}: {r.text[:200]}")

    print()
    if gagal:
        print(f"x {gagal} dari {len(sasaran)} akun GAGAL diganti.")
        sys.exit(1)
    print(f"v {len(sasaran)} akun sekarang memakai password bersama.")
    print("  Setelah simulasi, kembalikan tiap akun ke password acaknya sendiri")
    print("  lewat workflow 'Ganti password akun panitia'.")


if __name__ == "__main__":
    main()
