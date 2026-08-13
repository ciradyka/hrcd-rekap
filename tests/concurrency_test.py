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
JUMLAH_SEKOLAH = 30          # 12 sekolah berebut bersamaan
REGU_PER_SEKOLAH = 10         # 48 regu, 48 nomor dada


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
        regu = [{"nama_regu": f"Regu {i}-{j}", "nama_ketua": f"Ketua {i}-{j}",
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


def serbu(kode):
    """Semua meja menekan tombol bersamaan lewat satu barrier."""
    hasil, galat = [], []
    kunci = threading.Lock()
    barrier = threading.Barrier(len(kode))

    def satu_meja(i, k):
        uid = MEJA[i % len(MEJA)]
        barrier.wait()                      # <- serentak di sini
        try:
            baris = jalankan(
                "select nomor_dada, kloter from daftar_ulang_batch(%s)",
                (k,), uid=uid)
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
        group by k.nomor having count(r.id) > (select maks_regu_per_kloter from edisi where aktif)
    """, uid=MEJA[2])
    cek("tidak ada kloter melebihi kapasitas", not penuh, str(penuh[:3]))

    urutan = jalankan("""
        select kloter_nomor, urutan_kloter, count(*) as n
        from regu where kloter_nomor is not null
        group by 1,2 having count(*) > 1
    """, uid=MEJA[2])
    cek("tidak ada urutan kloter kembar", not urutan, str(urutan[:3]))

    # Inti aturannya: satu sekolah tersebar, tidak menumpuk di satu kloter.
    tumpuk = jalankan("""
        select s.nama, r.kloter_nomor, count(*) as n
        from regu r
        join pendaftaran d on d.id = r.pendaftaran_id
        join sekolah s on s.id = d.sekolah_id
        where r.kloter_nomor is not null
        group by 1,2 having count(*) > 1
    """, uid=MEJA[2])
    cek("tidak ada sekolah menumpuk di satu kloter", not tumpuk, str(tumpuk[:3]))

    return lolos


if __name__ == "__main__":
    print(f"UJI KONKURENSI — {JUMLAH_SEKOLAH} meja menekan tombol serentak, "
          f"{JUMLAH_SEKOLAH * REGU_PER_SEKOLAH} nomor dada diperebutkan\n")
    kode = siapkan()
    hasil, galat, detik = serbu(kode)
    print(f"  ({len(hasil)} baris kembali, {len(galat)} error, "
          f"{detik:.2f} detik untuk SEMUA meja selesai — "
          f"rata-rata {detik / len(kode) * 1000:.0f} ms per meja)\n")
    lolos = periksa(hasil, galat)
    print("\n" + ("SEMUA PEMERIKSAAN LULUS" if lolos else "ADA PEMERIKSAAN GAGAL"))
    sys.exit(0 if lolos else 1)
