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
import concurrent.futures as cf
import csv
import io
import json
import os
import re
import subprocess
import sys
import threading
import time
from pathlib import Path

import requests

# Session per utas — lihat sesi_utas().
_LOKAL = threading.local()

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
#
# LIMA TABEL SENGAJA DI LUAR, dan alasannya bukan kelupaan:
#   akun_panitia, akun_hak, fitur  siapa boleh apa. Tidak menerangkan satu pun
#                                  hasil lomba, dan akun edisi lalu tidak
#                                  dipakai lagi (Sprint 1).
#   cache_live_score               turunan; bisa dihitung ulang dari nilai.
#   centang_sprint                 centang papan Buku Sakti, bukan acara.
#
# `konfig_penalti` dan `kontrak_opsi` justru WAJIB ikut walau terasa seperti
# konfigurasi: tanpa keduanya angka penalti di arsip tidak bisa ditafsirkan
# lagi sepuluh tahun lagi.
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
    ("pendaftaran",      "tabel",  "Kode pembayaran, status lunas, jumlah regu, kebutuhan barak."),
    ("pembayaran",       "tabel",  "Uang masuk per pendaftaran; bahan LPJ."),
    ("keberangkatan_regu", "tabel", "Centang berangkat tiap regu di garis start."),
    ("nomor_dada_stok",  "tabel",  "Deret nomor dada yang disediakan edisi ini."),
    ("nomor_dada_pensiun", "tabel", "Nomor yang kainnya rusak lalu dipensiunkan."),
    ("nilai_terkunci",   "tabel",  "Gembok nilai per pos dan lomba."),
    ("kontrak_opsi",     "tabel",  "Pilihan kontrak waktu yang berlaku."),
    ("konfig_penalti",   "tabel",  "Angka penalti. Tanpa ini nilainya tidak bisa ditafsirkan lagi."),
    ("status_acara",     "tabel",  "Fase live saat arsip dibuat."),
    ("ruangan",          "tabel",  "Ruang yang dipakai barak."),
    ("penempatan_barak", "tabel",  "Regu mana menempati ruang mana."),
    ("riwayat",          "tabel",  "Jejak perubahan: siapa mengubah apa, kapan."),
    ("foto_lembar",      "tabel",  "Metadata tiap foto slip: regu, pos, lomba, path."),
    ("v_rekap_penuh",    "view",   "Rekap lengkap: nilai mentah, poin per komponen, poin per pos."),
    ("v_klasemen",       "view",   "Klasemen akhir per golongan."),
    ("v_total_skor",     "view",   "Total skor tiap regu beserta penaltinya."),
    ("v_penalti_waktu",  "view",   "Selisih menit tiap regu terhadap kontrak waktunya."),
    ("v_kejuaraan",      "view",   "Daftar juara sebagaimana dibacakan."),
    ("v_daftar_kloter",  "view",   "Isi tiap kloter, urut sebagaimana diberangkatkan."),
    ("v_foto_lembar",    "view",   "Foto slip beserta nomor dada dan nama lomba."),
]

# Kata yang menandai kolom berisi cara menghubungi orang.
#
# DICOCOKKAN PER POTONGAN NAMA, bukan sebagai daftar nama kolom yang utuh.
# Versi pertama berisi {"kontak", "no_wa", "wa", ...} dan tidak mengenai
# apa pun: kolom yang sungguhan bernama `kontak_wa` dan `nama_kontak`. Ia
# melapor "kontak dibuang" sambil membuang nol kolom — pemeriksaan yang
# lebih sempit daripada masalahnya, persis CLAUDE.md 13.3.
#
# Dipotong pada garis bawah, bukan dicari sebagai substring: `wa` sebagai
# substring juga mengenai `wahana` dan `jawaban_benar`, dan arsip yang
# membuang kolom nilai jauh lebih buruk daripada arsip yang membawa nomor.
KATA_KONTAK = {"wa", "whatsapp", "kontak", "telepon", "hp", "email", "phone"}


# Diisi buang_kontak(); dicetak di BACA-DULU.txt supaya klaim "kontak tidak
# ikut" bisa DIPERIKSA, bukan sekadar dipercaya.
DIBUANG = set()


def kolom_kontak(nama):
    return any(bagian in KATA_KONTAK for bagian in nama.lower().split("_"))


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
    dibuang = sorted({k for b in baris for k in b if kolom_kontak(k)})
    if dibuang:
        DIBUANG.update(dibuang)
    return [{k: v for k, v in b.items() if not kolom_kontak(k)} for b in baris]


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


def sesi_utas():
    """Satu requests.Session per utas.

    Session dipakai ulang supaya koneksinya tidak dibuka 2.489 kali, tapi satu
    Session yang dibagi ke banyak utas tidak dijamin aman. Menyimpannya di
    threading.local() memberi keduanya: koneksi yang dipakai ulang, dan tidak
    ada utas yang menyentuh Session utas lain.
    """
    if not hasattr(_LOKAL, "sesi"):
        _LOKAL.sesi = requests.Session()
    return _LOKAL.sesi


def unduh_satu(sesi, path, percobaan=3):
    """Satu foto, dengan pengulangan. `None` kalau tetap gagal.

    KENAPA MENGULANG, dan kenapa tidak boleh melempar.

    Putaran pertama di Actions mati di tengah pada `IncompleteRead` — satu
    koneksi putus di antara 2.489 permintaan, dan seluruh run ikut mati.
    Tiga puluh menit unduhan terbuang, karena berkasnya belum sempat
    diunggah ke mana pun.

    Di jumlah sebanyak ini kegagalan sesekali bukan kemungkinan, melainkan
    kepastian. Jadi yang gagal DIHITUNG, bukan dilempar: sisanya tetap
    terunduh, dan menjalankan ulang perintah yang sama akan melewati yang
    sudah ada lalu memungut yang bolong.
    """
    for ke in range(percobaan):
        try:
            r = sesi.get(f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}",
                         headers=kepala(), timeout=120)
            if r.status_code != 200:
                print(f"  ! {path}: HTTP {r.status_code}", file=sys.stderr)
                return None
            return r.content
        except requests.RequestException as e:
            if ke == percobaan - 1:
                print(f"  ! {path}: {type(e).__name__}", file=sys.stderr)
                return None
            time.sleep(1 + 2 * ke)
    return None


def unduh_foto(keluar, foto, regu_per_dada, tenang, utas=8):
    """Foto slip, satu folder per lomba, nama berkas nomor dada.

    Kalau satu regu punya lebih dari satu foto untuk lomba yang sama —
    lembar bolak-balik, atau ulangan karena yang pertama buram — yang kedua
    dan seterusnya diberi akhiran -2, -3. Urutannya jam unggah, jadi nomor
    kecil selalu foto yang lebih dulu.

    DUA TAHAP, dan pemisahan itu yang membuatnya selesai tepat waktu.

    Tahap pertama memutuskan nama tiap berkas dan menulis _daftar.csv. Ia
    HARUS berurutan: akhiran -2 lahir dari urutan, dan dua utas yang menomori
    bersamaan akan memberi nama yang sama pada dua foto berbeda.

    Tahap kedua mengunduh, dan itu yang dikerjakan beramai-ramai. Putaran
    sebelumnya berurutan: 2.489 permintaan kali ~1,4 detik menembus batas
    60 menit satu job, dan GitHub membatalkan run-nya — seluruh unduhan
    hilang tanpa satu berkas pun terunggah. Menunggu jaringan adalah
    pekerjaan yang memang untuk dibagi.
    """
    akar = keluar / "lembar-jawaban"
    akar.mkdir(parents=True, exist_ok=True)

    rencana = []          # (path, berkas) yang benar-benar perlu diunduh
    dilewati = 0

    per_folder = {}
    for f in sorted(foto, key=lambda x: (x.get("pos") or 0,
                                         x.get("kode_lomba") or "",
                                         str(x.get("nomor_dada") or ""),
                                         str(x.get("diunggah_pada") or ""))):
        folder = aman(f"Pos {f.get('pos')} - {f.get('nama_lomba') or f.get('kode_lomba')}")
        per_folder.setdefault(folder, []).append(f)

    total = sum(len(v) for v in per_folder.values())

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
            rencana.append((f["path"], berkas))

        tulis_csv(tujuan / "_daftar.csv", daftar)

    sudah = gagal = 0

    def kerjakan(tugas):
        path, berkas = tugas
        isi_foto = unduh_satu(sesi_utas(), path)
        if isi_foto is None:
            return False
        berkas.write_bytes(isi_foto)
        return True

    if rencana:
        with cf.ThreadPoolExecutor(max_workers=utas) as kolam:
            for berhasil in kolam.map(kerjakan, rencana):
                if berhasil:
                    sudah += 1
                else:
                    gagal += 1
                if not tenang and (sudah + gagal) % 100 == 0:
                    print(f"  foto {sudah + gagal + dilewati}/{total}")

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
        "--dengan-kontak. Kolom yang benar-benar dibuang disebut di bawah,\n"
        "supaya klaim itu bisa diperiksa dan bukan cuma dipercaya.\n\n"
        + ("Kolom kontak yang dibuang: " + ", ".join(sorted(DIBUANG)) + "\n\n"
           if DIBUANG else
           "Kolom kontak yang dibuang: tidak ada di sumber ini.\n\n")
        + "Isi:\n" + baris_ringkas + "\n",
        encoding="utf-8")

    print(f"\nSelesai. Arsip ada di {keluar.resolve()}")
    if gagal_foto:
        print(f"{gagal_foto} foto gagal diunduh — jalankan ulang perintah yang sama, "
              f"yang sudah ada akan dilewati.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
