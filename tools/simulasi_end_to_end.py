#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Jalankan satu edisi HRCD dari awal sampai juara, lewat RPC yang sebenarnya.

KENAPA ADA

Menjelang simulasi, panitia perlu melihat TAMPILAN AKHIR — Live Score dengan
juara terbit — bukan layar kosong yang harus dibayangkan. Dan tampilan itu
hanya muncul kalau seluruh rantainya lengkap: klasemen menuntut regu yang
berangkat DAN datang, poin pos menuntut nilai yang tersimpan, penalti menuntut
kontrak waktu yang dikonfirmasi.

Setiap langkah memanggil RPC yang sama dengan yang dipanggil layar panitia.
Tidak ada satu pun INSERT langsung ke tabel operasional — kalau ada, yang
tergambar bukan tampilan yang akan dilihat besok, melainkan tampilan yang
kebetulan mirip.

Yang DIPANGGIL BERKAS INI, dan cuma ini:

    konfirmasi_kontrak     meja keberangkatan  (kontrak waktu per regu)
    ceklis_berangkat       meja keberangkatan
    berangkatkan_kloter    meja keberangkatan  (jam berangkat sungguhan)
    simpan_nilai_massal    operator pos        (per pos, semua komponennya)
    catat_closing          meja kedatangan     (jam datang -> penalti)

Tiga langkah SEBELUMNYA bukan pekerjaan berkas ini, dan daftar ini sempat
menyebut ketiganya seolah-olah ia yang mengerjakan:

    submit_pendaftaran     form peserta        ) dikerjakan
    verifikasi_pembayaran  meja pembayaran     ) tools/seed_regu_uji.py
    daftar_ulang_batch     meja daftar ulang   ) lebih dulu

Jalankan seed_regu_uji.py dulu. Kalau belum, skrip ini berhenti dan
mengatakannya — lihat periksa_prasyarat() di bawah.

YANG DIACAK, DAN ITU HARUS DISEBUT

Nilai tiap komponen diacak dalam rentang sahnya, dan jam datang diacak di
sekitar kontrak waktu. Jadi JUARANYA TIDAK BERARTI APA-APA — ia ada supaya
bentuk layarnya terlihat, bukan supaya ada yang menang. Siapa pun yang
melihat papan ini sebelum lomba harus tahu itu.

Nama ketua juga bukan nama siapa-siapa: keempat edisi XXXIII-XXXVI tidak
pernah punya kolomnya.

FASE LIVE TIDAK DISENTUH. `v_live_peserta` baru terbit kalau
`status_acara.fase_live = 'penuh'`, sedangkan `v_live_admin` cukup peran
admin. Skrip ini sengaja tidak mengubah fase, jadi papan yang berisi hanya
yang dilihat panitia — situs peserta tetap seperti sebelumnya sampai ada yang
menerbitkannya dengan sadar.

PAKAI

    PGHOST=... PGPORT=... PGDATABASE=... PGUSER=... PGPASSWORD=... \
    python tools/simulasi_end_to_end.py
"""
import os
import random
import sys

import psycopg2
import psycopg2.extras

DSN = " ".join([
    f"host={os.environ.get('PGHOST', '127.0.0.1')}",
    f"port={os.environ.get('PGPORT', '5432')}",
    f"dbname={os.environ.get('PGDATABASE', 'hrcd_dev')}",
    f"user={os.environ.get('PGUSER', 'postgres')}",
    f"password={os.environ.get('PGPASSWORD', '')}",
])
ADMIN = os.environ.get("HRCD_ADMIN_UID", "00000000-0000-0000-0000-00000000000a")
# Diacak, tapi TIDAK berubah tiap kali dijalankan — papan yang angkanya
# berubah tiap refresh terlihat seperti sistem yang tidak bisa dipercaya.
random.seed(37)


def jalan(sql, args=(), peran="authenticated"):
    """Satu transaksi per panggilan.

    `set local` hanya hidup di dalam transaksi, dan satu transaksi untuk
    semuanya berarti satu langkah yang ditolak menjatuhkan seluruh sisanya.
    """
    with psycopg2.connect(DSN) as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("set local app.uid = %s", (ADMIN,))
            cur.execute(f"set local role {peran}")
            cur.execute(sql, args)
            try:
                return cur.fetchall()
            except psycopg2.ProgrammingError:
                return None


def langkah(judul):
    print(f"\n== {judul}")


def kontrak_waktu():
    """Konfirmasi kontrak untuk tiap regu yang belum punya.

    Wajib: berangkatkan_kloter menolak kloter yang masih memuat regu tanpa
    kontrak ("regu nomor dada % belum konfirmasi kontrak waktu").
    """
    opsi = [r["menit"] for r in jalan("select menit from kontrak_opsi"
                                      " where edisi = edisi_aktif() order by menit")]
    if not opsi:
        sys.exit("tidak ada kontrak_opsi untuk edisi aktif")
    regu = jalan("select r.id from regu r left join keberangkatan_regu k on k.regu_id = r.id"
                 " where r.nomor_dada is not null and not r.is_cancelled"
                 "   and r.kontrak_menit is null")
    n = 0
    for x in regu:
        try:
            jalan("select konfirmasi_kontrak(%s::uuid, %s::smallint)",
                  (str(x["id"]), random.choice(opsi)))
            n += 1
        except Exception as e:
            print(f"  kontrak {x['id']}: {str(e).strip().splitlines()[0]}")
    print(f"  {n} regu punya kontrak waktu")


def berangkat():
    """Ceklis lalu berangkatkan tiap kloter, BERURUT.

    Urutannya wajib: RPC-nya menolak kloter yang mendahului kloter sebelumnya
    ("urutan keberangkatan wajib berurut"). Jamnya mengikuti jendela 07:00
    dan interval antar kloter dari konfigurasi edisi.
    """
    kloter = [r["kloter_nomor"] for r in jalan(
        "select distinct r.kloter_nomor from regu r"
        " where r.kloter_nomor is not null and not r.is_cancelled"
        " order by r.kloter_nomor")]
    e = jalan("select tanggal_lomba, jam_mulai_berangkat, interval_berangkat_menit"
              " from edisi where is_active")[0]
    n = 0
    for i, k in enumerate(kloter):
        dada = [r["nomor_dada"] for r in jalan(
            "select nomor_dada from regu where kloter_nomor = %s"
            " and nomor_dada is not null and not is_cancelled", (k,))]
        for d in dada:
            try:
                jalan("select ceklis_berangkat(%s)", (d,))
            except Exception as ex:
                print(f"  ceklis {d}: {str(ex).strip().splitlines()[0]}")
        try:
            jalan("select berangkatkan_kloter(%s::smallint,"
                  " (%s::date + %s::time + make_interval(mins => %s))::timestamptz)",
                  (k, e["tanggal_lomba"], e["jam_mulai_berangkat"],
                   i * e["interval_berangkat_menit"]))
            n += 1
        except Exception as ex:
            print(f"  kloter {k}: {str(ex).strip().splitlines()[0]}")
    print(f"  {n} kloter berangkat")


def nilai():
    """Isi nilai tiap komponen tiap pos untuk semua regu yang berangkat.

    Rentangnya diambil dari `wahana` — rentang_mentah_min/maks adalah batas
    yang sama dengan yang divalidasi layar pos, jadi angka acak di dalamnya
    pasti diterima. Komponen `biner` diisi 0 atau poin_benar-nya.
    """
    pos_daftar = [r["pos"] for r in jalan(
        "select distinct pos from wahana where edisi = edisi_aktif() order by pos")]
    dada = [r["nomor_dada"] for r in jalan(
        "select r.nomor_dada from regu r join keberangkatan_regu k on k.regu_id = r.id"
        " where r.nomor_dada is not null order by r.nomor_dada")]
    total = 0
    for pos in pos_daftar:
        komponen = jalan("select kode, form, rentang_mentah_min mn, rentang_mentah_maks mx"
                         " from wahana where edisi = edisi_aktif() and pos = %s", (pos,))
        baris = []
        for d in dada:
            for k in komponen:
                mn, mx = float(k["mn"]), float(k["mx"])
                if k["form"] == "biner":
                    v = random.choice([0, 1])
                else:
                    v = round(random.uniform(mn, mx), 2)
                baris.append({"nomor_dada": d, "kode": k["kode"],
                              "nilai_1": v, "nilai_2": None})
        if not baris:
            continue
        try:
            # sumber hanya boleh 'manual' atau 'upload' (0004) — "simulasi"
            # ditolak. Dipakai 'manual' karena itulah yang terjadi besok:
            # juri mengetiknya di layar pos.
            jalan("select simpan_nilai_massal(%s::jsonb, %s, %s::smallint)",
                  (psycopg2.extras.Json(baris), "manual", pos))
            total += len(baris)
        except Exception as e:
            print(f"  pos {pos}: {str(e).strip().splitlines()[0]}")
    print(f"  {total} nilai tersimpan di {len(pos_daftar)} pos")


def datang():
    """Catat kedatangan. Jamnya diacak di sekitar kontrak waktunya sendiri,
    supaya sebagian regu kena penalti dan sebagian tidak — papan yang semua
    regunya tepat waktu tidak memperlihatkan kolom penalti bekerja."""
    # Jam berangkat ada di `kloter`, BUKAN di keberangkatan_regu — satu kloter
    # berangkat sebagai satu rombongan dan jamnya diketik sekali (CLAUDE.md
    # bagian 10.6). keberangkatan_regu hanya mencatat siapa yang ikut.
    regu = jalan("select r.nomor_dada, r.kontrak_menit, kl.jam_berangkat"
                 " from regu r"
                 " join keberangkatan_regu k on k.regu_id = r.id"
                 " join kloter kl on kl.nomor = r.kloter_nomor"
                 " left join closing_regu c on c.regu_id = r.id"
                 " where c.regu_id is null and r.nomor_dada is not null"
                 "   and kl.jam_berangkat is not null")
    n = 0
    for x in regu:
        selisih = random.randint(-12, 25)   # menit, sebagian telat
        try:
            jalan("select catat_closing(%s, %s::timestamptz, %s::smallint, %s)",
                  (x["nomor_dada"],
                   x["jam_berangkat"] + __import__("datetime").timedelta(
                       minutes=(x["kontrak_menit"] or 240) + selisih),
                   5, None))
            n += 1
        except Exception as e:
            print(f"  closing {x['nomor_dada']}: {str(e).strip().splitlines()[0]}")
    print(f"  {n} regu tercatat datang")


def periksa_prasyarat():
    """Berhenti berisik kalau belum ada regu yang bisa disimulasikan.

    KENAPA ADA. Keempat tahap di bawah masing-masing mengerjakan apa yang
    ketemu dan diam kalau tidak ketemu apa-apa. Jadi pada database yang
    regunya belum daftar ulang, skrip ini mencetak nol di kelima bagiannya,
    keluar dengan status 0, dan terbaca seperti simulasi yang berhasil atas
    edisi yang memang kosong. Itu bentuk kegagalan yang CLAUDE.md bagian 13.3
    sebut sendiri: melapor bersih atas sesuatu yang tidak pernah diperiksa.

    Prasyaratnya nomor dada, bukan regu. Regu yang sudah terdaftar tetapi
    belum daftar ulang tidak punya kloter, dan tanpa kloter tidak ada yang
    bisa diberangkatkan — jadi menghitung regu saja tetap meloloskan keadaan
    yang bikin skrip ini diam.
    """
    baris = jalan(
        "select count(*) filter (where nomor_dada is not null) as bernomor,"
        "       count(*) as regu from regu")[0]
    if baris["bernomor"]:
        return
    sys.exit(
        "Belum ada satu regu pun yang bernomor dada, jadi tidak ada yang bisa\n"
        f"disimulasikan ({baris['regu']} regu terdaftar, 0 sudah daftar ulang).\n"
        "\n"
        "Skrip ini melanjutkan dari daftar ulang, ia tidak mengerjakannya.\n"
        "Yang mengerjakan pendaftaran, verifikasi pembayaran, dan daftar ulang\n"
        "adalah tools/seed_regu_uji.py. Jalankan itu lebih dulu:\n"
        "\n"
        "    python tools/seed_regu_uji.py <Database HRCD XXXVI.xlsx> 50\n")


def main():
    periksa_prasyarat()
    langkah("kontrak waktu")
    kontrak_waktu()
    langkah("keberangkatan")
    berangkat()
    langkah("nilai pos")
    nilai()
    langkah("kedatangan")
    datang()

    langkah("hasil")
    # v_klasemen_live_score = papan yang dilihat admin (0050 mengganti
    # namanya dari v_live_admin). v_klasemen_publik yang menunggu fase_live.
    r = jalan("select count(*) n from v_klasemen_live_score")[0]
    print(f"  v_klasemen_live_score: {r['n']} baris")
    juara = jalan("select * from v_klasemen_live_score limit 3")
    for i, j in enumerate(juara or [], 1):
        print(f"  juara {i}: " + ", ".join(f"{k}={v}" for k, v in list(j.items())[:5]))
    print("\nfase_live TIDAK diubah — situs peserta tetap seperti sebelumnya.")


if __name__ == "__main__":
    main()
