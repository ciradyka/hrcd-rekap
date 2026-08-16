#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Isi database dev dengan regu dari edisi lalu, lewat ALUR YANG SEBENARNYA.

KENAPA TIDAK INSERT LANGSUNG

Layar hanya bisa dibandingkan kalau isinya berperilaku seperti isi
sungguhan. `INSERT` langsung ke tabel `regu` melewati setiap aturan yang
membuat data itu masuk akal: kode pembayaran tidak lahir, nomor dada tidak
diambil dari stok, kloter tidak terisi, dan status pendaftarannya menggantung
di keadaan yang tidak pernah terjadi di lapangan. Yang tergambar di layar
sesudah itu bukan tampilan yang akan dilihat panitia.

Jadi skrip ini memanggil RPC yang sama dengan yang dipanggil aplikasi:

    submit_pendaftaran   -> pendaftaran + regu, status menunggu_pembayaran
    verifikasi_pembayaran -> lunas, kwitansi terbit
    daftar_ulang_batch   -> nomor dada dari stok + kloter

SUMBER DATA

`Database HRCD XXXVI.xlsx`, sheet `Pendaftaran`. Nama regu, asal sekolah, dan
golongan diambil apa adanya — itu data betulan, dan bentuk namanya (panjang,
tanda baca, kapital) justru yang perlu diuji layarnya.

Yang TIDAK bisa diambil: **nama ketua**. Keempat edisi XXXIII-XXXVI tidak
pernah punya kolomnya — itu field baru edisi 37. Jadi ia diisi placeholder
yang jelas-jelas bukan nama orang, dan itu disebut di sini supaya tidak ada
yang mengira nama-nama itu asli.

Baris yang dibuang, dengan aturan yang sama seperti normalize_sekolah.py:
nama kelas, organisasi, dan lelucon (`SMA 7 MARS`, `SMKN 1 Hogwarts`).
Golongan `Intern PA/PI` juga dibuang — golongan itu tidak ada di edisi 37.

PAKAI (database dev, JANGAN produksi):

    PGPORT=5432 PGDATABASE=hrcd_dev PGPASSWORD=... \
    python tools/seed_regu_uji.py "C:/Users/.../Database HRCD XXXVI.xlsx"
"""
import os
import re
import sys
import unicodedata

import pandas as pd
import psycopg2
import psycopg2.extras

DSN = " ".join([
    f"host={os.environ.get('PGHOST', '127.0.0.1')}",
    f"port={os.environ.get('PGPORT', '5432')}",
    f"dbname={os.environ.get('PGDATABASE', 'hrcd_dev')}",
    f"user={os.environ.get('PGUSER', 'postgres')}",
    f"password={os.environ.get('PGPASSWORD', '')}",
])

GOLONGAN = {
    "Penegak PA": "penegak_pa", "Penegak PI": "penegak_pi",
    "Penggalang PA": "penggalang_pa", "Penggalang PI": "penggalang_pi",
}
# Sama dengan bukan_sekolah() di normalize_sekolah.py — dijaga tetap sama
# supaya "sekolah" di sini berarti hal yang sama dengan di daftar sekolah.
KELAS = re.compile(r'^(x{1,3}i{0,3}|[0-9]{1,2})\s*(mipa|ipa|ips|iis)\s*[0-9]+$', re.I)
ORG = {"osis", "mpk", "kir", "forsa", "nuansa", "paskibra", "pramuka",
       "saka wanabakti", "saka wanabakti kawali", "contoh"}
LUCU = re.compile(r'hogwarts|oxford|\bmars\b|oplas|sman 1 oke', re.I)


def bukan_sekolah(n):
    k = str(n).strip().lower()
    return bool(KELAS.match(k) or k in ORG or LUCU.search(str(n))
                or re.match(r'^(jl|jln|jalan)\b', k))


def bersih(teks):
    """Rapikan spasi dan buang karakter yang bikin constraint menolak."""
    t = unicodedata.normalize("NFKC", str(teks)).strip()
    return re.sub(r'\s+', ' ', t)


def muat(berkas, jumlah):
    d = pd.read_excel(berkas, sheet_name="Pendaftaran")
    kolom_sekolah = ("Asal Sekolah / Organisasi" if "Asal Sekolah / Organisasi" in d.columns
                     else "Asal Sekolah")
    keluar, terpakai = [], set()
    for _, r in d.iterrows():
        gol = GOLONGAN.get(bersih(r.get("Golongan")))
        nama = bersih(r.get("Nama Regu"))
        sek = bersih(r.get(kolom_sekolah))
        if not gol or not nama or nama.lower() in ("nan", "contoh"):
            continue
        if not sek or sek.lower() == "nan" or bukan_sekolah(sek):
            continue
        # Aturan nama regu edisi 37 (migrasi 0051 + 0052): unik, <= 20 huruf,
        # tanpa angka. Yang tidak lolos dilewati, BUKAN dipotong — nama yang
        # dipotong bukan lagi nama regu itu.
        if len(nama) > 20 or re.search(r'[0-9]', nama):
            continue
        kunci = re.sub(r'[^a-z]', '', nama.lower())
        if kunci in terpakai:
            continue
        terpakai.add(kunci)
        keluar.append({
            "nama_regu": nama, "sekolah": sek, "golongan": gol,
            "alamat": bersih(r.get("Alamat Sekolah")) or "-",
        })
        if len(keluar) >= jumlah:
            break
    return keluar


def main():
    if len(sys.argv) < 2:
        sys.exit("pakai: python tools/seed_regu_uji.py <Database HRCD XXXVI.xlsx> [jumlah]")
    berkas = sys.argv[1]
    jumlah = int(sys.argv[2]) if len(sys.argv) > 2 else 50
    regu = muat(berkas, jumlah)
    print(f"{len(regu)} regu terpilih dari {berkas}")
    if not regu:
        sys.exit("tidak ada baris yang lolos saringan")

    # ADMIN, bukan service_role. Dua alasan, dan dua-duanya menggagalkan skrip
    # ini waktu dilanggar: RPC-nya di-grant ke `authenticated` saja
    # (service_role dijawab "permission denied"), dan `verified_by` diisi
    # auth.uid() yang null kalau tidak ada yang login — kolomnya NOT NULL.
    admin = os.environ.get("HRCD_ADMIN_UID", "00000000-0000-0000-0000-00000000000a")

    def jalan(sql, args=(), peran="authenticated"):
        """Satu transaksi per panggilan.

        `set local` hanya hidup di dalam transaksi, jadi tidak bisa dipasang
        sekali di awal. Dan satu transaksi untuk semuanya berarti satu baris
        yang ditolak membatalkan seluruh sisanya — batch yang namanya kembar
        harus bisa dilewati tanpa menjatuhkan 35 batch lain.

        Perannya BEDA per langkah, dan itu bukan kerapian melainkan tiruan
        produksi: `submit_pendaftaran` di-grant ke service_role karena yang
        memanggilnya gateway Worker (form peserta, tanpa login), sedangkan
        verifikasi dan daftar ulang di-grant ke authenticated karena yang
        memanggilnya panitia di meja.
        """
        with psycopg2.connect(DSN) as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("set local app.uid = %s", (admin,))
                cur.execute(f"set local role {peran}")
                cur.execute(sql, args)
                try:
                    return cur.fetchall()
                except psycopg2.ProgrammingError:
                    return None

    # Satu pendaftaran per sekolah — itu bentuk yang sebenarnya: pembina
    # mendaftarkan seluruh regu sekolahnya sekaligus, dan satu kode pembayaran
    # menaungi semuanya.
    per_sekolah = {}
    for r in regu:
        per_sekolah.setdefault((r["sekolah"], r["alamat"]), []).append(r)

    kode_semua, gagal = [], 0
    for (sekolah, alamat), daftar in per_sekolah.items():
        baris = [{"nama_regu": r["nama_regu"],
                  # Nama ketua TIDAK ADA di data edisi lalu — lihat kepala
                  # berkas. Placeholder, dan sengaja tidak menyerupai nama.
                  "nama_ketua": "Ketua Regu",
                  "golongan": r["golongan"]} for r in daftar]
        try:
            h = jalan("select submit_pendaftaran(%s, %s, %s, %s, %s::jsonb,"
                      " %s::smallint, %s::uuid, %s) as h",
                      (sekolah, alamat, False, "0800000000",
                       psycopg2.extras.Json(baris), 0, None, "Pembina"),
                      peran="service_role")
            kode_semua.append(h[0]["h"]["kode_pembayaran"])
        except Exception as e:
            gagal += 1
            print(f"  lewat {sekolah}: {str(e).strip().splitlines()[0]}")
    print(f"pendaftaran: {len(kode_semua)} batch, {gagal} gagal")

    # Nominalnya harus PAS seluruh batch — verifikasi_pembayaran menolak
    # pembayaran sebagian (alur 3.5), jadi tagihannya dihitung dari database.
    lunas = 0
    for kode in kode_semua:
        try:
            t = jalan("select p.jumlah_regu * e.biaya_per_regu tagihan"
                      " from pendaftaran p, edisi e"
                      " where p.kode_pembayaran = %s and e.is_active", (kode,))
            jalan("select verifikasi_pembayaran(%s, %s, %s)",
                  (kode, t[0]["tagihan"], "tunai"))
            lunas += 1
        except Exception as e:
            print(f"  bayar {kode}: {str(e).strip().splitlines()[0]}")
    print(f"pembayaran: {lunas} batch lunas")

    # daftar_ulang_batch menuntut nomor dada EKSPLISIT untuk tiap regu batch
    # itu — ia tidak mengambil sendiri dari stok. Itu bentuk yang benar: di
    # meja, nomor dada dibacakan dari kain yang sudah dipegang panitia.
    berdada, berikut = 0, 1
    for kode in kode_semua:
        try:
            baris_regu = jalan(
                "select r.id from regu r join pendaftaran p on p.id = r.pendaftaran_id"
                " where p.kode_pembayaran = %s and r.nomor_dada is null"
                " order by r.nama_regu", (kode,))
            pasangan = []
            for br in baris_regu:
                pasangan.append({"regu_id": str(br["id"]), "nomor_dada": berikut})
                berikut += 1
            if not pasangan:
                continue
            jalan("select * from daftar_ulang_batch(%s, %s::jsonb)",
                  (kode, psycopg2.extras.Json(pasangan)))
            berdada += len(pasangan)
        except Exception as e:
            print(f"  daftar ulang {kode}: {str(e).strip().splitlines()[0]}")
    print(f"daftar ulang: {berdada} regu dapat nomor dada")

    n = jalan("select count(*) total, count(nomor_dada) berdada,"
              " count(kloter_nomor) berkloter from regu")[0]
    print(f"regu di database: {dict(n)}")


if __name__ == "__main__":
    main()
