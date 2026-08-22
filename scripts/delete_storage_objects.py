#!/usr/bin/env python3
# ============================================================================
# hrcd-rekap : delete_storage_objects.py — hapus objek Supabase Storage lewat
# API resminya.
#
# Jangan mengganti ini dengan DELETE langsung ke storage.objects. Baris di
# Postgres hanyalah metadata; file aslinya ada di object storage dan hanya
# Storage API yang menghapus keduanya dengan benar.
#
# PAKAI:
#   SUPABASE_URL=https://xxxx.supabase.co \
#   SUPABASE_SERVICE_KEY=sb_secret_... \
#   python scripts/delete_storage_objects.py lembar daftar-path.json
#
# daftar-path.json berisi array JSON nama objek, misalnya:
#   ["pos-1/foto-a.jpg", "pos-2/foto-b.jpg"]
# ============================================================================
import json
import os
import sys
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen


SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
MAKS_PER_PERMINTAAN = 1000


def potong(daftar, ukuran):
    for awal in range(0, len(daftar), ukuran):
        yield daftar[awal:awal + ukuran]


def hapus_objek(bucket, paths):
    terhapus = 0
    url = f"{SUPABASE_URL}/storage/v1/object/{quote(bucket, safe='')}"
    headers = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
    }

    for kelompok in potong(paths, MAKS_PER_PERMINTAAN):
        request = Request(
            url,
            data=json.dumps({"prefixes": kelompok}).encode("utf-8"),
            headers=headers,
            method="DELETE",
        )
        try:
            with urlopen(request, timeout=30) as response:
                hasil = json.load(response)
        except HTTPError as error:
            pesan = error.read().decode("utf-8", errors="replace")[:500]
            raise RuntimeError(
                f"Storage API menolak penghapusan (HTTP {error.code}): {pesan}"
            ) from error

        if not isinstance(hasil, list):
            raise RuntimeError("Respons Storage API bukan daftar objek.")
        terhapus += len(hasil)

    return terhapus


def main():
    if not SUPABASE_URL or not SERVICE_KEY:
        print("SUPABASE_URL dan SUPABASE_SERVICE_KEY wajib diisi.")
        sys.exit(1)
    if len(sys.argv) != 3:
        print("Pakai: python delete_storage_objects.py <bucket> <daftar-path.json>")
        sys.exit(1)

    bucket = sys.argv[1]
    with open(sys.argv[2], encoding="utf-8") as daftar_file:
        paths = json.load(daftar_file)

    if not isinstance(paths, list) or not all(isinstance(path, str) for path in paths):
        print("Daftar path harus berupa array JSON berisi string.")
        sys.exit(1)

    # DISTINCT di query workflow seharusnya sudah menjamin ini. Menjaganya di
    # sini juga membuat skrip aman dipakai sendiri dengan berkas buatan tangan.
    paths = list(dict.fromkeys(paths))
    terhapus = hapus_objek(bucket, paths) if paths else 0
    print(f"Storage `{bucket}`: {terhapus} objek dihapus dari {len(paths)} path.")


if __name__ == "__main__":
    main()
