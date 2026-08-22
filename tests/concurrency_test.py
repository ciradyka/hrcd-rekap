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
import sys
import threading
import time
import uuid

import psycopg2
import psycopg2.extras

DSN = "host=127.0.0.1 port=55432 dbname=hrcd_dev user=postgres password=hrcd"
MEJA = ("00000000-0000-0000-0000-0000000000b1",
        "00000000-0000-0000-0000-0000000000b2",
        "00000000-0000-0000-0000-00000000000a")   # 2 meja + admin
JUMLAH_SEKOLAH = 30          # 30 sekolah berebut bersamaan
REGU_PER_SEKOLAH = 10        # 300 regu, 300 nomor dada


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
        delete from sekolah where nama like 'UJI KONKUREN%';
        update kloter set jam_berangkat = null;
    """, role="service_role", fetch=None)

    kode = []
    for i in range(JUMLAH_SEKOLAH):
        regu = [{"nama_regu": f"Regu {kode_huruf(i)} {kode_huruf(j)}",
                 "nama_ketua": f"Ketua {kode_huruf(i)} {kode_huruf(j)}",
                 "golongan": "penegak_pa"} for j in range(REGU_PER_SEKOLAH)]
        h = jalankan(
            "select submit_pendaftaran(%s,%s,%s,%s,%s::jsonb,%s::smallint,%s::uuid) as h",
            (f"UJI KONKUREN {i}", f"Jl. Uji {i}", False, "081200000000",
             json.dumps(regu), 0, str(uuid.uuid4())),
            role="service_role", fetch="one")["h"]
        k = h["kode_pembayaran"]
        biaya = jalankan("select biaya_per_regu from edisi where aktif",
                         role="service_role", fetch="one")["biaya_per_regu"]
        jalankan("select verifikasi_pembayaran(%s,%s,%s)",
                 (k, REGU_PER_SEKOLAH * biaya, "tunai"),
                 uid=MEJA[0], fetch="one")
        kode.append(k)
    return kode


def stok_tersedia(jumlah):
    """Nomor dada yang masih boleh dipakai, urut kecil ke besar."""
    baris = jalankan("""
        select s.nomor from nomor_dada_stok s
        where not exists (select 1 from regu r where r.nomor_dada = s.nomor)
          and not exists (select 1 from nomor_dada_pensiun p where p.nomor = s.nomor)
        order by s.nomor limit %s
    """, (jumlah,), role="service_role")
    return [r["nomor"] for r in baris]


def pasangan(kode, nomor):
    """Yang diketik petugas: regu ini nomornya ini (migrasi 0011)."""
    regu = jalankan("""
        select r.id::text as id from regu r
        join pendaftaran d on d.id = r.pendaftaran_id
        where d.kode_pembayaran = %s and not r.batal and r.nomor_dada is null
        order by r.nama_regu, r.id
    """, (kode,), role="service_role")
    return json.dumps([{"regu_id": r["id"], "nomor_dada": n}
                       for r, n in zip(regu, nomor)])


def serbu(kode):
    """Semua meja menekan tombol bersamaan lewat satu barrier.

    Sejak nomor dada diketik manual, tiap meja memegang TUMPUKAN KAIN
    SENDIRI — itu memang cara panitia membaginya sebelum antrean dibuka,
    jadi dua meja tidak pernah menawarkan nomor yang sama. Yang diadu di
    sini tetap sama seperti dulu: penempatan kloter dan penulisan serentak.
    """
    butuh = len(kode) * REGU_PER_SEKOLAH
    stok = stok_tersedia(butuh)
    if len(stok) < butuh:
        raise SystemExit(f"stok nomor dada kurang: butuh {butuh}, ada {len(stok)}")
    # Disiapkan SEBELUM barrier supaya yang diadu murni transaksinya, bukan
    # waktu menyusun JSON di Python.
    bawaan = {k: pasangan(k, stok[i * REGU_PER_SEKOLAH:(i + 1) * REGU_PER_SEKOLAH])
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
        having count(r.id) > (select maks_eksternal_per_kloter from edisi where aktif)
    """, uid=MEJA[2])
    cek("tidak ada kloter melebihi kuota Eksternal", not penuh, str(penuh[:3]))

    urutan = jalankan("""
        select kloter_nomor, urutan_kloter, count(*) as n
        from regu where kloter_nomor is not null
        group by 1,2 having count(*) > 1
    """, uid=MEJA[2])
    cek("tidak ada urutan kloter kembar", not urutan, str(urutan[:3]))

    # FIFO mengisi 60 kloter berurutan, masing-masing 5 Eksternal.
    fifo = jalankan("""
        select count(distinct kloter_nomor) as jumlah_kloter,
               min(kloter_nomor) as pertama, max(kloter_nomor) as terakhir
        from regu where nomor_dada is not null
    """, uid=MEJA[2], fetch="one")
    cek("FIFO memakai tepat kloter 1-60",
        fifo["jumlah_kloter"] == 60 and fifo["pertama"] == 1 and fifo["terakhir"] == 60,
        str(fifo))

    return lolos


def uji_nomor_kembar():
    """Risiko BARU yang dibawa nomor manual: dua meja mengetik nomor yang
    sama untuk dua regu berbeda, pada detik yang sama. Tepat satu boleh
    menang; yang kalah harus DITOLAK dengan pesan, bukan menimpa regu lain
    atau lolos jadi nomor ganda."""
    biaya = jalankan("select biaya_per_regu from edisi where aktif",
                     role="service_role", fetch="one")["biaya_per_regu"]
    kode = []
    for i in range(2):
        h = jalankan(
            "select submit_pendaftaran(%s,%s,%s,%s,%s::jsonb,%s::smallint,%s::uuid) as h",
            (f"UJI KONKUREN KEMBAR {i}", f"Jl. Kembar {i}", False, "081200000000",
             json.dumps([{"nama_regu": f"Kembar {kode_huruf(i)}", "nama_ketua": "Ketua",
                          "golongan": "penegak_pa"}]), 0, str(uuid.uuid4())),
            role="service_role", fetch="one")["h"]
        k = h["kode_pembayaran"]
        jalankan("select verifikasi_pembayaran(%s,%s,%s)", (k, biaya, "tunai"),
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
