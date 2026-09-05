#!/usr/bin/env python3
# ============================================================================
# hrcd-rekap : tools/arsip_edisi.py — mengeluarkan SELURUH hasil satu edisi
# dari Supabase menjadi berkas yang bisa disimpan selamanya.
#
# KENAPA BERKAS INI ADA
#
# Hasil lomba cuma hidup di dua tempat, dan dua-duanya tidak abadi. Yang
# pertama database Supabase: project gratis di-pause kalau menganggur, dan
# "Bersihkan data" memang dirancang menghapus regu, nilai, dan kloter supaya
# edisi berikutnya mulai dari nol. Yang kedua berkas statis di Cloudflare, dan
# itu ditimpa tiap kali rekap diterbitkan ulang — sekali fase turun ke `pra`,
# klasemen yang tersaji jadi kosong.
#
# Yang TIDAK menyimpan hasil sama sekali: git. `live/rekap.json` yang ikut
# repo adalah berkas fase `pra` berisi nol baris; penerbitan membangun yang
# sungguhan saat deploy dan tidak pernah commit balik.
#
# Jadi tanpa alat ini, satu-satunya salinan HRCD yang tersisa sesudah data
# dibersihkan adalah kertas.
#
# APA YANG DIKELUARKAN
#
#   <keluar>/data/                 tabel dan view, JSON + CSV
#   <keluar>/lembar-jawaban/       foto slip penilaian, satu folder per lomba
#   <keluar>/BACA-DULU.txt         keterangan isi folder
#
# Folder `lembar-jawaban` sengaja disusun supaya bisa langsung di-drag ke
# Google Drive: nama folder terbaca manusia ("Pos 3 - Kim Lihat"), nama
# berkas nomor dada, dan tiap folder membawa `_daftar.csv` yang memetakan
# nomor dada ke nama regu dan sekolahnya.
#
# NOMOR WA PEMBINA TIDAK IKUT, kecuali diminta dengan --dengan-kontak. Arsip
# hasil lomba tidak membutuhkannya, dan folder yang diunggah ke Drive lebih
# mudah dibagikan daripada database.
#
# DUA KUNCI, DUA GUNA. `SUPABASE_DB_URL` membaca datanya sebagai pemilik
# database, dan itu yang dipakai kalau ada — enam tabel dan view tidak diberi
# SELECT ke `service_role`, dan menambal itu berarti melonggarkan hak produksi
# selamanya demi arsip sekali jalan. `SUPABASE_SERVICE_KEY` dipakai mengambil
# foto dari Storage, dan untuk itu tidak ada penggantinya.
#
# PAKAI (di terminal SENDIRI — kunci ini tidak boleh masuk ke mana pun lain):
#
#   PowerShell
#     $env:SUPABASE_URL = "https://xxxx.supabase.co"
#     $env:SUPABASE_SERVICE_KEY = "sb_secret_..."
#     python tools/arsip_edisi.py --keluar C:\G\arsip-hrcd37
#
#   bash
#     SUPABASE_URL=https://xxxx.supabase.co \
#     SUPABASE_SERVICE_KEY=sb_secret_... \
#     python tools/arsip_edisi.py --keluar ~/arsip-hrcd37
#
# AMAN DIULANG. Foto yang sudah terunduh dengan ukuran yang benar dilewati,
# jadi koneksi yang putus di tengah cukup dijalankan ulang. Skrip ini hanya
# MEMBACA; tidak ada satu pun tulisan ke database.
# ============================================================================
import argparse
import csv
import io
import json
import os
import re
import subprocess
import sys
from pathlib import Path

import requests

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
# Kalau ada, INI yang dipakai membaca data — lihat ambil_semua().
DB_URL = os.environ.get("SUPABASE_DB_URL", "")
# Sama seperti tests/run.sh dan tests/dev_database.sh: jalur psql boleh
# disebutkan sendiri, karena di Windows ia hampir tidak pernah di PATH.
PSQL = os.environ.get("PSQL", "psql")
BUCKET = "lembar"

# PostgREST memulangkan paling banyak 1000 baris sekali minta. Tabel nilai
# mentah satu edisi jauh lebih panjang daripada itu, jadi setiap pengambilan
# harus berputar — bukan sekali tembak lalu percaya hasilnya utuh.
HALAMAN = 1000

# Yang diarsipkan, berikut alasannya masing-masing.
#
# Tabel mentah didahulukan karena ia yang bisa dimuat ulang kalau suatu hari
# datanya perlu dihidupkan lagi. View ikut karena ia yang terbaca manusia
# tanpa harus menyambungkan enam tabel sendiri.
SUMBER = [
    ("edisi",            "tabel",  "Angka-angka edisi: tanggal, jendela berangkat, biaya."),
    ("pos",              "tabel",  "Lima pos beserta namanya."),
    ("wahana",           "tabel",  "Tiap kolom penilaian: bentuk konversi, rentang, poin maksimal."),
    ("sekolah",          "tabel",  "Daftar sekolah kurasi."),
    ("regu",             "tabel",  "Regu beserta nomor dada, golongan, kloter, kontrak waktu."),
    ("kloter",           "tabel",  "Kloter beserta jam berangkat yang BENAR-BENAR dicatat."),
    ("nilai_mentah",     "tabel",  "Angka yang diketik juri, sebelum dikonversi jadi poin."),
    ("closing_regu",     "tabel",  "Kedatangan di finish dan jumlah anggota yang dihitung."),
    ("kejuaraan_manual", "tabel",  "Juara yang ditetapkan panitia, bukan dihitung sistem."),
    ("foto_lembar",      "tabel",  "Metadata tiap foto slip: regu, pos, lomba, path."),
    ("v_rekap_penuh",    "view",   "Rekap lengkap: nilai mentah, poin per komponen, poin per pos."),
    ("v_klasemen",       "view",   "Klasemen akhir per golongan."),
    ("v_total_skor",     "view",   "Total skor tiap regu beserta penaltinya."),
    ("v_penalti_waktu",  "view",   "Selisih menit tiap regu terhadap kontrak waktunya."),
    ("v_kejuaraan",      "view",   "Daftar juara sebagaimana dibacakan."),
    ("v_daftar_kloter",  "view",   "Isi tiap kloter, urut sebagaimana diberangkatkan."),
    ("v_foto_lembar",    "view",   "Foto slip beserta nomor dada dan nama lomba."),
]

# Kolom yang menyimpan cara menghubungi orang. Tidak ikut kecuali diminta.
KOLOM_KONTAK = {"kontak", "no_wa", "nomor_wa", "wa", "telepon", "hp", "email"}


class TidakBisaJalan(Exception):
    """Alatnya sendiri yang tidak bisa jalan, bukan satu sumber yang gagal.

    Bedanya penting. Satu tabel yang ditolak boleh dilewati — arsipnya tetap
    berguna, dan BACA-DULU.txt mencatat mana yang bolong. Tapi psql yang
    tidak ada berarti TIDAK SATU pun sumber bisa dibaca, dan meneruskan
    berarti menulis folder kosong lalu mencetak "Selesai". Arsip kosong yang
    terbaca seperti arsip berhasil adalah cara paling murah kehilangan satu
    edisi.
    """


def kepala():
    return {"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}"}


def ambil_psql(nama):
    """Seluruh baris lewat koneksi Postgres langsung.

    KENAPA JALUR INI ADA, dan kenapa ia yang didahulukan.

    Percobaan pertama memakai PostgREST dengan service key, dan enam sumber
    dijawab 403: `kejuaraan_manual`, `foto_lembar`, `v_rekap_penuh`,
    `v_kejuaraan`, `v_daftar_kloter`, `v_foto_lembar`. Sebabnya bukan RLS
    melainkan GRANT — `service_role` memang tidak diberi SELECT di sana.

    Yang salah adalah menambal itu dengan `grant select ... to service_role`:
    satu migrasi yang melonggarkan hak di produksi, permanen, hanya supaya
    arsip bisa dibuat sekali. Koneksi Postgres tersambung sebagai pemilik
    database, membaca apa adanya, dan tidak mengubah apa pun.
    """
    sql = (f"select coalesce(json_agg(t), '[]'::json) "
           f"from (select * from {nama}) t")
    try:
        r = subprocess.run(
            [PSQL, DB_URL, "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", sql],
            capture_output=True, text=True,
        )
    except FileNotFoundError:
        # Di runner Actions psql selalu ada; di laptop Windows hampir tidak
        # pernah ada di PATH. Pesannya menyebut jalan keluarnya, bukan
        # menumpahkan traceback — sama seperti PSQL di tests/run.sh.
        raise TidakBisaJalan(
            f"psql tidak ditemukan sebagai '{PSQL}'.\n"
            "Sebutkan jalurnya lewat PSQL, misalnya:\n"
            '  $env:PSQL = "C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe"')
    if r.returncode != 0:
        raise SystemExit(f"GAGAL membaca {nama}: {r.stderr.strip()[:200]}")
    return json.loads(r.stdout.strip() or "[]")


def ambil_semua(nama):
    """Seluruh baris satu tabel atau view.

    Lewat Postgres kalau SUPABASE_DB_URL ada, karena itu satu-satunya jalur
    yang melihat seluruh isi tanpa menuntut grant baru. Kalau tidak ada,
    jatuh ke PostgREST — cukup untuk sebagian besar sumber, dan akan
    melapor 403 dengan jelas untuk sisanya.
    """
    if DB_URL:
        return ambil_psql(nama)
    baris, offset = [], 0
    while True:
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/{nama}",
            headers=kepala(),
            params={"select": "*", "limit": HALAMAN, "offset": offset},
            timeout=60,
        )
        if r.status_code != 200:
            raise SystemExit(f"GAGAL membaca {nama}: {r.status_code} {r.text[:200]}")
        potong = r.json()
        baris.extend(potong)
        if len(potong) < HALAMAN:
            return baris
        offset += HALAMAN


def buang_kontak(baris):
    return [{k: v for k, v in b.items() if k.lower() not in KOLOM_KONTAK} for b in baris]


def tulis_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")


def tulis_csv(path, baris):
    """CSV supaya bisa dibuka di Excel tanpa alat apa pun.

    Kolomnya gabungan seluruh kunci yang pernah muncul, bukan kunci baris
    pertama saja: satu baris yang kebetulan tidak punya kolom `catatan` akan
    membuang kolom itu untuk seluruh berkas kalau diambil dari baris pertama.
    """
    if not baris:
        return
    kolom = []
    for b in baris:
        for k in b:
            if k not in kolom:
                kolom.append(k)
    with io.open(path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=kolom, extrasaction="ignore")
        w.writeheader()
        for b in baris:
            w.writerow({k: ("" if b.get(k) is None else b.get(k)) for k in kolom})


def aman(nama):
    """Nama folder dan berkas yang selamat di Windows, Drive, dan zip.

    `None` diperlakukan sebagai kosong, bukan diubah jadi tulisan "None" —
    folder bernama "Pos 3 - None" terbaca seperti nama lomba yang sungguhan
    dan menyembunyikan bahwa datanya yang bolong.
    """
    if nama is None:
        return "tanpa-nama"
    nama = re.sub(r'[<>:"/\\|?*]', "-", str(nama)).strip(" .")
    return re.sub(r"\s+", " ", nama) or "tanpa-nama"


def unduh_foto(keluar, foto, regu_per_dada, tenang):
    """Foto slip, satu folder per lomba, nama berkas nomor dada.

    Kalau satu regu punya lebih dari satu foto untuk lomba yang sama —
    lembar bolak-balik, atau ulangan karena yang pertama buram — yang kedua
    dan seterusnya diberi akhiran -2, -3. Urutannya jam unggah, jadi nomor
    kecil selalu foto yang lebih dulu.
    """
    akar = keluar / "lembar-jawaban"
    akar.mkdir(parents=True, exist_ok=True)

    per_folder = {}
    for f in sorted(foto, key=lambda x: (x.get("pos") or 0,
                                         x.get("kode_lomba") or "",
                                         str(x.get("nomor_dada") or ""),
                                         str(x.get("diunggah_pada") or ""))):
        folder = aman(f"Pos {f.get('pos')} - {f.get('nama_lomba') or f.get('kode_lomba')}")
        per_folder.setdefault(folder, []).append(f)

    total = sum(len(v) for v in per_folder.values())
    sudah = dilewati = gagal = 0

    for folder, isian in per_folder.items():
        tujuan = akar / folder
        tujuan.mkdir(exist_ok=True)
        dipakai = {}
        daftar = []

        for f in isian:
            dada = f.get("nomor_dada")
            label = f"{dada:04d}" if isinstance(dada, int) else aman(dada or "tanpa-dada")
            n = dipakai.get(label, 0) + 1
            dipakai[label] = n
            ekor = Path(f["path"]).suffix or ".jpg"
            berkas = tujuan / (f"{label}{ekor}" if n == 1 else f"{label}-{n}{ekor}")

            r = regu_per_dada.get(dada, {})
            daftar.append({
                "berkas": berkas.name,
                "nomor_dada": dada,
                "nama_regu": r.get("nama_regu", ""),
                "sekolah": r.get("sekolah", ""),
                "golongan": r.get("golongan", ""),
                "lomba": f.get("nama_lomba") or f.get("kode_lomba"),
                "diunggah_pada": f.get("diunggah_pada", ""),
            })

            # Ukuran yang sudah cocok berarti berkasnya utuh dari putaran
            # sebelumnya. Inilah yang membuat skrip ini aman diulang setelah
            # koneksi putus di tengah 214 MB.
            besar = f.get("ukuran_bytes")
            if berkas.exists() and (not besar or berkas.stat().st_size == besar):
                dilewati += 1
                continue

            resp = requests.get(
                f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{f['path']}",
                headers=kepala(), timeout=120,
            )
            if resp.status_code != 200:
                gagal += 1
                print(f"  ! gagal {f['path']}: {resp.status_code}", file=sys.stderr)
                continue
            berkas.write_bytes(resp.content)
            sudah += 1
            if not tenang and (sudah + dilewati) % 50 == 0:
                print(f"  foto {sudah + dilewati}/{total}")

        tulis_csv(tujuan / "_daftar.csv", daftar)

    print(f"  foto: {sudah} diunduh, {dilewati} sudah ada, {gagal} gagal, {total} total")
    return gagal


def main():
    p = argparse.ArgumentParser(description="Arsipkan satu edisi HRCD.")
    p.add_argument("--keluar", required=True, help="folder tujuan arsip")
    p.add_argument("--tanpa-foto", action="store_true",
                   help="hanya data; foto slip tidak diunduh")
    p.add_argument("--dengan-kontak", action="store_true",
                   help="ikutkan nomor WA pembina (jangan untuk salinan yang dibagikan)")
    p.add_argument("--tenang", action="store_true", help="kurangi keluaran")
    a = p.parse_args()

    # Data bisa lewat SUPABASE_DB_URL atau lewat REST; foto SELALU lewat
    # storage API, jadi service key tetap wajib kecuali fotonya dilewati.
    if not DB_URL and not (SUPABASE_URL and SERVICE_KEY):
        raise SystemExit(
            "Isi SUPABASE_DB_URL, atau SUPABASE_URL beserta SUPABASE_SERVICE_KEY.\n"
            "Lihat keterangan PAKAI di kepala berkas ini.")
    if not a.tanpa_foto and not (SUPABASE_URL and SERVICE_KEY):
        raise SystemExit(
            "Foto slip menuntut SUPABASE_URL dan SUPABASE_SERVICE_KEY.\n"
            "Tambahkan keduanya, atau jalankan dengan --tanpa-foto.")

    keluar = Path(a.keluar)
    data = keluar / "data"
    data.mkdir(parents=True, exist_ok=True)

    ringkas = []
    isi = {}
    for nama, jenis, ket in SUMBER:
        try:
            baris = ambil_semua(nama)
        except TidakBisaJalan as e:
            raise SystemExit(str(e))
        except SystemExit as e:
            print(f"  ! {e}", file=sys.stderr)
            ringkas.append((nama, jenis, "GAGAL", ket))
            continue
        if not a.dengan_kontak:
            baris = buang_kontak(baris)
        isi[nama] = baris
        tulis_json(data / f"{nama}.json", baris)
        tulis_csv(data / f"{nama}.csv", baris)
        ringkas.append((nama, jenis, f"{len(baris)} baris", ket))
        if not a.tenang:
            print(f"  {nama}: {len(baris)} baris")

    # Nol sumber terbaca berarti arsipnya kosong, dan folder kosong yang
    # dilaporkan "Selesai" lebih berbahaya daripada galat.
    if not isi:
        raise SystemExit(
            "TIDAK SATU sumber pun terbaca — arsip tidak dibuat.\n"
            "Periksa kuncinya dan pesan galat di atas.")

    # Peta nomor dada -> identitas regu, dipakai _daftar.csv tiap folder foto.
    regu_per_dada = {}
    for r in isi.get("v_rekap_penuh", []) or isi.get("regu", []):
        dada = r.get("nomor_dada")
        if dada is not None and dada not in regu_per_dada:
            regu_per_dada[dada] = {
                "nama_regu": r.get("nama_regu") or r.get("nama") or "",
                "sekolah": r.get("sekolah") or r.get("nama_sekolah") or "",
                "golongan": r.get("golongan") or "",
            }

    gagal_foto = 0
    if not a.tanpa_foto:
        foto = isi.get("v_foto_lembar") or isi.get("foto_lembar") or []
        if foto:
            gagal_foto = unduh_foto(keluar, foto, regu_per_dada, a.tenang)

    baris_ringkas = "\n".join(
        f"  {n:<18} {j:<6} {s:<12} {k}" for n, j, s, k in ringkas)
    (keluar / "BACA-DULU.txt").write_text(
        "ARSIP HRCD\n"
        "==========\n\n"
        "Dibuat oleh tools/arsip_edisi.py dari database Supabase.\n\n"
        "data/            tiap tabel dan view, dua rupa: .json untuk dimuat\n"
        "                 ulang, .csv untuk dibuka di Excel.\n"
        "lembar-jawaban/  foto slip penilaian, satu folder per lomba. Tiap\n"
        "                 folder punya _daftar.csv yang memetakan nomor dada\n"
        "                 ke nama regu dan sekolahnya.\n\n"
        "Nomor WA pembina TIDAK ikut kecuali arsip ini dibuat dengan\n"
        "--dengan-kontak.\n\n"
        "Isi:\n" + baris_ringkas + "\n",
        encoding="utf-8")

    print(f"\nSelesai. Arsip ada di {keluar.resolve()}")
    if gagal_foto:
        print(f"{gagal_foto} foto gagal diunduh — jalankan ulang perintah yang sama, "
              f"yang sudah ada akan dilewati.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
