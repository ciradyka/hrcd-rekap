# ============================================================================
# hrcd-rekap : tests/concurrency_test.py
# Membuktikan bahwa dua-tiga meja daftar ulang yang menekan tombol PADA DETIK
# YANG SAMA tidak pernah menghasilkan nomor dada ganda atau kloter kelebihan.
#
# Ini bukan simulasi berurutan: tiap "meja" adalah koneksi Postgres sendiri di
# thread sendiri, dan semuanya dilepas bersamaan lewat satu barrier — sedekat
# mungkin dengan tiga jari menekan Enter serentak.
#
# Jalankan:
#   python tests/concurrency_test.py
# (butuh database hrcd_dev — siapkan dengan: bash tests/dev_database.sh)
# ============================================================================

import json
import os
import sys
import threading
import time
import uuid

import psycopg2
import psycopg2.extras

DSN = " ".join([
    f"host={os.environ.get('PGHOST', '127.0.0.1')}",
    f"port={os.environ.get('PGPORT', '55432')}",
    f"dbname={os.environ.get('PGDATABASE', 'hrcd_dev')}",
    f"user={os.environ.get('PGUSER', 'postgres')}",
    f"password={os.environ.get('PGPASSWORD', 'hrcd')}",
])
MEJA = ("00000000-0000-0000-0000-0000000000b1",
        "00000000-0000-0000-0000-0000000000b2",
        "00000000-0000-0000-0000-00000000000a")   # 2 meja + admin
JUMLAH_SEKOLAH = 30          # 30 sekolah berebut bersamaan
EKSTERNAL_PER_SEKOLAH = 9
INTERN_PER_SEKOLAH = 1
REGU_PER_SEKOLAH = EKSTERNAL_PER_SEKOLAH + INTERN_PER_SEKOLAH


def kode_huruf(n):
    """Kode dua huruf tanpa angka; nama regu memang menolak digit."""
    return chr(65 + n // 26) + chr(65 + n % 26)


def jalankan(sql, args=(), uid=None, role="authenticated", fetch="all"):
    with psycopg2.connect(DSN) as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("set local app.uid = %s", (uid or "",))
            cur.execute(f"set local role {role}")
            cur.execute(sql, args or None)
            if fetch == "all":
                return cur.fetchall()
            if fetch == "one":
                return cur.fetchone()
            return None


def siapkan():
    """Bersihkan sisa uji sebelumnya, lalu daftarkan + lunasi N sekolah."""
    jalankan("""
        delete from penempatan_barak;
        delete from keberangkatan_regu;
        delete from nilai_mentah;
        delete from closing_regu;
        delete from pembayaran;
        delete from regu;
        delete from pendaftaran;
        delete from sekolah where name like 'UJI KONKUREN%';
        update kloter set jam_berangkat = null;
    """, role="service_role", fetch=None)

    kode = []
    for i in range(JUMLAH_SEKOLAH):
        regu = [{"nama_regu": f"Regu {kode_huruf(i)} {kode_huruf(j)}",
                 "nama_ketua": f"Ketua {kode_huruf(i)} {kode_huruf(j)}",
                 "golongan": "penegak_pa" if j < EKSTERNAL_PER_SEKOLAH
                              else "intern_pa"}
                for j in range(REGU_PER_SEKOLAH)]
        h = jalankan(
            "select submit_pendaftaran(%s,%s,%s,%s,%s::jsonb,%s::smallint,%s::uuid) as h",
            (f"UJI KONKUREN {i}", f"Jl. Uji {i}", False, "081200000000",
             json.dumps(regu), 0, str(uuid.uuid4())),
            role="service_role", fetch="one")["h"]
        k = h["kode_pembayaran"]
        # Nominalnya diambil dari yang sudah dihitung submit_pendaftaran, bukan
        # dari REGU_PER_SEKOLAH * biaya_per_regu. Batch ini CAMPURAN Eksternal
        # dan Intern, dan sejak migrasi 0110 keduanya berharga lain — perkalian
        # itu meleset dan verifikasi_pembayaran menolak seluruh fixture.
        jalankan("select verifikasi_pembayaran(%s,%s,%s)",
                 (k, h["total_tagihan"], "tunai"),
                 uid=MEJA[0], fetch="one")
        kode.append(k)
    return kode


def stok_tersedia(jumlah, intern=False):
    """Nomor dada yang masih boleh dipakai, urut kecil ke besar.

    DUA DERET sejak migrasi 0116: kain Intern dicetak set sendiri yang juga
    mulai dari 001, jadi Intern diketik 1001-1250 dan nomor Eksternal untuk
    regu Intern ditolak database. Batasnya dibaca dari `edisi`, tidak ditulis
    di sini — tes yang mematok 1001 akan gugur diam-diam begitu panitia tahun
    depan menggesernya.
    """
    baris = jalankan("""
        select s.nomor from nomor_dada_stok s
        where (s.nomor >= (select nomor_dada_intern_mulai from edisi where is_active)) = %s
          and not exists (select 1 from regu r where r.nomor_dada = s.nomor)
          and not exists (select 1 from nomor_dada_pensiun p where p.nomor = s.nomor)
        order by s.nomor limit %s
    """, (intern, jumlah), role="service_role")
    return [r["nomor"] for r in baris]


def pasangan(kode, nomor_eksternal, nomor_intern=()):
    """Yang diketik petugas: regu ini nomornya ini (migrasi 0011).

    Tiap regu mendapat nomor dari DERETNYA SENDIRI — persis yang dilakukan
    petugas meja, yang memegang dua tumpukan kain terpisah.
    """
    regu = jalankan("""
        select r.id::text as id, r.golongan from regu r
        join pendaftaran d on d.id = r.pendaftaran_id
        where d.kode_pembayaran = %s and not r.is_cancelled and r.nomor_dada is null
        order by r.nama_regu, r.id
    """, (kode,), role="service_role")
    sisa = {False: iter(nomor_eksternal), True: iter(nomor_intern)}
    return json.dumps([
        {"regu_id": r["id"],
         "nomor_dada": next(sisa[r["golongan"].startswith("intern_")])}
        for r in regu])


def serbu(kode):
    """Semua meja menekan tombol bersamaan lewat satu barrier.

    Sejak nomor dada diketik manual, tiap meja memegang TUMPUKAN KAIN
    SENDIRI — itu memang cara panitia membaginya sebelum antrean dibuka,
    jadi dua meja tidak pernah menawarkan nomor yang sama. Yang diadu di
    sini tetap sama seperti dulu: penempatan kloter dan penulisan serentak.
    """
    # Dua tumpukan kain, dua deret (0116) — dan tiap meja memegang potongan
    # sendiri dari keduanya, sama seperti panitia membaginya sebelum antrean
    # dibuka.
    butuh_ext = len(kode) * EKSTERNAL_PER_SEKOLAH
    butuh_int = len(kode) * INTERN_PER_SEKOLAH
    stok_ext = stok_tersedia(butuh_ext)
    stok_int = stok_tersedia(butuh_int, intern=True)
    if len(stok_ext) < butuh_ext or len(stok_int) < butuh_int:
        raise SystemExit(
            f"stok nomor dada kurang: butuh {butuh_ext} Eksternal / {butuh_int} "
            f"Intern, ada {len(stok_ext)} / {len(stok_int)}")
    # Disiapkan SEBELUM barrier supaya yang diadu murni transaksinya, bukan
    # waktu menyusun JSON di Python.
    bawaan = {k: pasangan(k,
                          stok_ext[i * EKSTERNAL_PER_SEKOLAH:(i + 1) * EKSTERNAL_PER_SEKOLAH],
                          stok_int[i * INTERN_PER_SEKOLAH:(i + 1) * INTERN_PER_SEKOLAH])
              for i, k in enumerate(kode)}

    hasil, galat = [], []
    kunci = threading.Lock()
    barrier = threading.Barrier(len(kode))

    def satu_meja(i, k):
        uid = MEJA[i % len(MEJA)]
        barrier.wait()                      # <- serentak di sini
        try:
            baris = jalankan(
                "select nomor_dada, kloter from daftar_ulang_batch(%s, %s::jsonb)",
                (k, bawaan[k]), uid=uid)
            with kunci:
                hasil.extend(baris)
        except Exception as e:               # noqa: BLE001 — semua galat dicatat
            with kunci:
                galat.append(f"{k}: {type(e).__name__}: {e}")

    utas = [threading.Thread(target=satu_meja, args=(i, k))
            for i, k in enumerate(kode)]
    mulai = time.perf_counter()
    for t in utas:
        t.start()
    for t in utas:
        t.join()
    return hasil, galat, time.perf_counter() - mulai


def periksa(hasil, galat):
    lolos = True

    def cek(nama, ok, catatan=""):
        nonlocal lolos
        print(f"  {'OK  ' if ok else 'GAGAL'}  {nama}{'  ' + catatan if catatan else ''}")
        if not ok:
            lolos = False

    total = JUMLAH_SEKOLAH * REGU_PER_SEKOLAH
    cek("tidak ada meja yang error", not galat, "; ".join(galat[:3]))
    cek(f"semua {total} regu menerima nomor", len(hasil) == total,
        f"dapat {len(hasil)}")

    nomor = [r["nomor_dada"] for r in hasil]
    cek("tidak ada nomor dada ganda", len(nomor) == len(set(nomor)),
        f"{len(nomor) - len(set(nomor))} duplikat")

    db = jalankan("""
        select count(*) as regu_bernomor,
               count(distinct nomor_dada) as nomor_unik
        from regu where nomor_dada is not null
    """, uid=MEJA[2], fetch="one")
    cek("database sepakat: nomor unik",
        db["regu_bernomor"] == db["nomor_unik"] == total,
        f"{db['regu_bernomor']} baris / {db['nomor_unik']} unik")

    penuh = jalankan("""
        select k.nomor, count(r.id) as isi
        from kloter k join regu r on r.kloter_nomor = k.nomor
        where r.golongan not like 'intern_%'
        group by k.nomor
        having count(r.id) > (select maks_eksternal_per_kloter from edisi where is_active)
    """, uid=MEJA[2])
    cek("tidak ada kloter melebihi kuota Eksternal", not penuh, str(penuh[:3]))

    penuh_intern = jalankan("""
        select k.nomor, count(r.id) as isi
        from kloter k join regu r on r.kloter_nomor = k.nomor
        where r.golongan like 'intern_%'
        group by k.nomor
        having count(r.id) > (select maks_intern_per_kloter from edisi where is_active)
    """, uid=MEJA[2])
    cek("tidak ada kloter melebihi kuota Intern", not penuh_intern,
        str(penuh_intern[:3]))

    urutan = jalankan("""
        select kloter_nomor, urutan_kloter, count(*) as n
        from regu where kloter_nomor is not null
        group by 1,2 having count(*) > 1
    """, uid=MEJA[2])
    cek("tidak ada urutan kloter kembar", not urutan, str(urutan[:3]))

    # Kedua jenis mulai dari kloter 1. Jumlah kloter yang dipakai ditentukan
    # jenis yang membutuhkan kloter paling banyak menurut kuotanya sendiri.
    cfg = jalankan("""
        select maks_eksternal_per_kloter, maks_intern_per_kloter
        from edisi where is_active
    """, uid=MEJA[2], fetch="one")
    jumlah_eksternal = JUMLAH_SEKOLAH * EKSTERNAL_PER_SEKOLAH
    jumlah_intern = JUMLAH_SEKOLAH * INTERN_PER_SEKOLAH
    kloter_diharapkan = max(
        -(-jumlah_eksternal // cfg["maks_eksternal_per_kloter"]),
        -(-jumlah_intern // cfg["maks_intern_per_kloter"]),
    )
    fifo = jalankan("""
        select count(distinct kloter_nomor) as jumlah_kloter,
               min(kloter_nomor) as pertama, max(kloter_nomor) as terakhir
        from regu where nomor_dada is not null
    """, uid=MEJA[2], fetch="one")
    cek(f"FIFO memakai tepat kloter 1-{kloter_diharapkan}",
        fifo["jumlah_kloter"] == kloter_diharapkan
        and fifo["pertama"] == 1 and fifo["terakhir"] == kloter_diharapkan,
        str(fifo))

    return lolos


def uji_nomor_kembar():
    """Risiko BARU yang dibawa nomor manual: dua meja mengetik nomor yang
    sama untuk dua regu berbeda, pada detik yang sama. Tepat satu boleh
    menang; yang kalah harus DITOLAK dengan pesan, bukan menimpa regu lain
    atau lolos jadi nomor ganda."""
    kode = []
    for i in range(2):
        h = jalankan(
            "select submit_pendaftaran(%s,%s,%s,%s,%s::jsonb,%s::smallint,%s::uuid) as h",
            (f"UJI KONKUREN KEMBAR {i}", f"Jl. Kembar {i}", False, "081200000000",
             json.dumps([{"nama_regu": f"Kembar {kode_huruf(i)}", "nama_ketua": "Ketua",
                          "golongan": "penegak_pa"}]), 0, str(uuid.uuid4())),
            role="service_role", fetch="one")["h"]
        k = h["kode_pembayaran"]
        jalankan("select verifikasi_pembayaran(%s,%s,%s)",
                 (k, h["total_tagihan"], "tunai"),
                 uid=MEJA[0], fetch="one")
        kode.append(k)

    rebutan = stok_tersedia(1)[0]        # satu nomor, dua meja
    bawaan = {k: pasangan(k, [rebutan]) for k in kode}

    sukses, ditolak = [], []
    kunci = threading.Lock()
    barrier = threading.Barrier(2)

    def satu_meja(i, k):
        barrier.wait()
        try:
            jalankan("select nomor_dada from daftar_ulang_batch(%s, %s::jsonb)",
                     (k, bawaan[k]), uid=MEJA[i])
            with kunci:
                sukses.append(k)
        except Exception as e:           # noqa: BLE001 — yang kalah memang error
            with kunci:
                ditolak.append(f"{type(e).__name__}: {e}")

    utas = [threading.Thread(target=satu_meja, args=(i, k))
            for i, k in enumerate(kode)]
    for t in utas:
        t.start()
    for t in utas:
        t.join()

    ok = len(sukses) == 1 and len(ditolak) == 1
    print(f"  {'OK  ' if ok else 'GAGAL'}  nomor {rebutan} diketik dua meja "
          f"serentak: {len(sukses)} menang, {len(ditolak)} ditolak")
    if not ok and ditolak:
        print(f"         {ditolak[0][:140]}")
    return ok


if __name__ == "__main__":
    print(f"UJI KONKURENSI — {JUMLAH_SEKOLAH} meja menekan tombol serentak, "
          f"{JUMLAH_SEKOLAH * REGU_PER_SEKOLAH} nomor dada diperebutkan\n")
    kode = siapkan()
    hasil, galat, detik = serbu(kode)
    print(f"  ({len(hasil)} baris kembali, {len(galat)} error, "
          f"{detik:.2f} detik untuk SEMUA meja selesai — "
          f"rata-rata {detik / len(kode) * 1000:.0f} ms per meja)\n")
    lolos = periksa(hasil, galat)
    print("\nNOMOR KEMBAR — dua meja mengetik nomor yang sama:")
    lolos = uji_nomor_kembar() and lolos
    print("\n" + ("SEMUA PEMERIKSAAN LULUS" if lolos else "ADA PEMERIKSAAN GAGAL"))
    sys.exit(0 if lolos else 1)
