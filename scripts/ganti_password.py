#!/usr/bin/env python3
# ============================================================================
# hrcd-rekap : scripts/ganti_password.py — ganti password SATU akun panitia
# yang SUDAH ada.
#
# Beda dari provision_akun.py: skrip itu MEMBUAT akun baru dan melewati akun
# yang emailnya sudah terdaftar. Skrip ini untuk kebalikannya — akun yang
# sudah ada, cari user_id-nya dari akun_panitia lewat username, lalu timpa
# passwordnya lewat Supabase Admin API (service_role — melompati RLS).
#
# Password SELALU digenerate acak di sini (huruf/angka aman, sama seperti
# provision_akun.py) — tidak pernah diterima sebagai argumen mentah, supaya
# tidak pernah tertulis ke log Actions atau riwayat "Run workflow" GitHub.
# Hasilnya ditulis ke berkas terpisah dan diunggah sebagai artifact berumur
# pendek oleh ganti-password.yml — bukan dicetak ke log biasa.
#
# PAKAI (di terminal SENDIRI — kunci ini tidak boleh masuk ke mana pun lain,
# lihat README di .github/workflows/ganti-password.yml untuk versi HP):
#   $env:SUPABASE_URL = "https://xxxx.supabase.co"
#   $env:SUPABASE_SERVICE_KEY = "sb_secret_..."
#   python scripts/ganti_password.py admin.ciradyka
# ============================================================================
import os
import secrets
import sys

import requests

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
BERKAS_HASIL = os.environ.get("BERKAS_HASIL", "hasil_ganti_password.txt")

# Tanpa karakter yang gampang tertukar saat diketik ulang di lapangan.
ABJAD_AMAN = "abcdefghjkmnpqrstuvwxyzACDEFGHJKLMNPQRSTUVWXYZ23456789"


def buat_password():
    return "".join(secrets.choice(ABJAD_AMAN) for _ in range(10))


def headers():
    return {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
    }


def cari_user_id(username):
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/akun_panitia",
        params={"username": f"eq.{username}", "select": "user_id,peran,aktif"},
        headers=headers(), timeout=20,
    )
    r.raise_for_status()
    baris = r.json()
    return baris[0] if baris else None


def main():
    if not SUPABASE_URL or not SERVICE_KEY:
        print("Set dulu SUPABASE_URL dan SUPABASE_SERVICE_KEY di environment kamu.")
        sys.exit(1)
    if len(sys.argv) < 2:
        print("Pakai: python ganti_password.py <username>")
        sys.exit(1)

    # Terima juga kalau yang diketik email lengkap (kebiasaan dari layar
    # login) — bagian sebelum @ saja yang dicari di akun_panitia.
    username = sys.argv[1].strip().split("@")[0]

    akun = cari_user_id(username)
    if not akun:
        print(f"x Username '{username}' tidak ditemukan di akun_panitia.")
        sys.exit(1)
    if not akun["aktif"]:
        print(f"! '{username}' berstatus TIDAK AKTIF (edisi lama) — password tetap diganti, "
              "tapi akun ini tidak akan bisa dipakai login sampai diaktifkan lagi.")

    password = buat_password()
    # Directive GitHub Actions: sembunyikan nilai ini dari SEMUA baris log
    # berikutnya di run ini, sekalipun ada langkah lain yang tanpa sengaja
    # ikut mencetaknya.
    print(f"::add-mask::{password}")

    r = requests.put(
        f"{SUPABASE_URL}/auth/v1/admin/users/{akun['user_id']}",
        headers=headers(), json={"password": password}, timeout=20,
    )
    if r.status_code not in (200, 201):
        print(f"x GAGAL ganti password: HTTP {r.status_code}: {r.text[:300]}")
        sys.exit(1)

    with open(BERKAS_HASIL, "w", encoding="utf-8") as f:
        f.write(f"username: {username}\n")
        f.write(f"peran: {akun['peran']}\n")
        f.write(f"password baru: {password}\n")

    print(f"v Password '{username}' berhasil diganti. Lihat artifact untuk isinya.")


if __name__ == "__main__":
    main()
