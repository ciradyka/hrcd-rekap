#!/usr/bin/env python3
# ============================================================================
# hrcd-rekap : scripts/provision_akun.py — bikin akun panitia massal.
#
# Dua langkah per baris CSV masukan:
#   1. Buat user di Supabase Auth (auto-confirm, lewat Admin API).
#   2. Tautkan ke akun_panitia (username, peran, pos) lewat REST — service_role
#      melompati RLS, jadi tidak perlu login sebagai admin dulu.
#
# Password: kalau kolom "password" di CSV masukan kosong, digenerate acak
# (huruf/angka, tanpa 0/O/1/l/I supaya tidak salah baca saat diketik ulang
# di meja pendaftaran). Password yang dipakai — apa pun asalnya — SELALU
# ditulis ke CSV hasil, supaya bisa dibagikan ke pemiliknya.
#
# Aman diulang: baris yang emailnya sudah terdaftar dilewati (dilaporkan,
# bukan error fatal) — sisa baris tetap lanjut.
#
# PAKAI (di terminal SENDIRI — kunci ini tidak boleh masuk ke mana pun lain,
# lihat README di .github/workflows/provision-akun.yml untuk versi HP):
#   $env:SUPABASE_URL = "https://xxxx.supabase.co"
#   $env:SUPABASE_SERVICE_KEY = "sb_secret_..."
#   python scripts/provision_akun.py akun_masuk.csv hasil_provisioning.csv
#
# Format CSV masukan (header wajib persis ini; kolom password boleh kosong):
#   username,email,peran,pos,password
#   admin.ciradyka,admin.ciradyka@ciradyka.com,admin,,
#   pos1hrcd37,pos1hrcd37@ciradyka.com,operator_pos,1,
# ============================================================================
import csv
import os
import secrets
import sys

import requests

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

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


def buat_user_auth(email, password):
    r = requests.post(
        f"{SUPABASE_URL}/auth/v1/admin/users",
        headers=headers(),
        json={"email": email, "password": password, "email_confirm": True},
        timeout=20,
    )
    if r.status_code in (200, 201):
        data = r.json()
        return data.get("id") or data.get("user", {}).get("id"), None
    if r.status_code == 422 and "already been registered" in r.text.lower():
        return None, "sudah_ada"
    return None, f"HTTP {r.status_code}: {r.text[:200]}"


def tautkan_akun_panitia(user_id, username, peran, pos):
    body = {
        "user_id": user_id,
        "username": username,
        "peran": peran,
        "pos": int(pos) if pos else None,
        "aktif": True,
    }
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/akun_panitia",
        headers={**headers(), "Prefer": "return=minimal"},
        json=body,
        timeout=20,
    )
    if r.status_code in (200, 201, 204):
        return None
    return f"HTTP {r.status_code}: {r.text[:200]}"


def main():
    if not SUPABASE_URL or not SERVICE_KEY:
        print("Set dulu SUPABASE_URL dan SUPABASE_SERVICE_KEY di environment "
              "kamu sebelum menjalankan skrip ini.")
        sys.exit(1)
    if len(sys.argv) < 2:
        print("Pakai: python provision_akun.py <masukan.csv> [hasil.csv]")
        sys.exit(1)

    berkas_hasil = sys.argv[2] if len(sys.argv) > 2 else None
    baris_hasil = []
    dibuat = dilewati = gagal = 0

    with open(sys.argv[1], newline="", encoding="utf-8") as f:
        for baris in csv.DictReader(f):
            username = baris["username"].strip()
            email = baris["email"].strip()
            peran = baris["peran"].strip()
            pos = baris["pos"].strip()
            password = (baris.get("password") or "").strip() or buat_password()

            user_id, err = buat_user_auth(email, password)
            if err == "sudah_ada":
                print(f"~ {username:20s} sudah ada di Auth, dilewati (tautkan manual bila belum di akun_panitia)")
                baris_hasil.append([username, email, peran, pos, "", "sudah_ada"])
                dilewati += 1
                continue
            if err:
                print(f"x {username:20s} GAGAL buat user: {err}")
                baris_hasil.append([username, email, peran, pos, "", f"gagal: {err}"])
                gagal += 1
                continue

            err = tautkan_akun_panitia(user_id, username, peran, pos)
            if err:
                print(f"x {username:20s} user Auth dibuat TAPI gagal tautkan akun_panitia: {err}")
                baris_hasil.append([username, email, peran, pos, password, f"auth ok, tautkan gagal: {err}"])
                gagal += 1
                continue

            print(f"v {username:20s} dibuat + tertaut ({peran}"
                  + (f" pos {pos}" if pos else "") + ")")
            baris_hasil.append([username, email, peran, pos, password, "dibuat"])
            dibuat += 1

    if berkas_hasil:
        with open(berkas_hasil, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["username", "email", "peran", "pos", "password", "status"])
            w.writerows(baris_hasil)
        print(f"\nhasil (termasuk password) ditulis ke {berkas_hasil}")

    print(f"selesai: {dibuat} dibuat, {dilewati} dilewati (sudah ada), {gagal} gagal")


if __name__ == "__main__":
    main()
