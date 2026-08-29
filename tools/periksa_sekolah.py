#!/usr/bin/env python3
"""Periksa dua berkas daftar sekolah terhadap aturan runbook-sekolah.md.

KENAPA PERLU DIPERIKSA MESIN

`sekolah_nama.json` dan `sekolah_alamat.json` dirawat terpisah: yang pertama
dihasilkan `normalize_sekolah.py` dari berkas Excel, yang kedua diisi dari hasil
pencarian alamat, sering oleh belasan agen sekaligus. Tidak ada satu pun langkah
yang memaksa keduanya cocok.

Yang sudah pernah terjadi, dan semuanya lolos tanpa suara:

- **Dua baris untuk satu sekolah.** Dua agen mencari sekolah yang sama dengan
  ejaan nama sedikit berbeda; 209 baris ternyata cuma 190 sekolah, dan yang
  membuktikannya NPSN yang sama (runbook bagian 7).
- **Satu baris untuk sekolah yang tidak pernah ada.** `SMAN 10 Bandung` terisi
  lengkap padahal tidak satu peserta pun pernah menuliskannya.
- **Kolom `jalan` diisi dusun dan RT/RW**, yang bukan nama jalan (bagian 8).

NPSN ADALAH IDENTITASNYA, NAMA HARUS MEMBEDAKANNYA SENDIRI

Dua pemeriksaan di bawah ini kelihatan seperti kerapian, padahal keduanya
adalah satu aturan (runbook bagian 5):

- **NPSN tidak boleh kembar** — dua baris ber-NPSN sama adalah satu sekolah
  yang tertulis dua kali, apa pun bedanya alamatnya.
- **Nama tampil tidak boleh kembar** — karena nama itulah yang dibaca panitia
  di layar keberangkatan dan dicetak di blangko. Kalau dua NPSN berbeda akan
  memakai nama yang sama, namanya diberi ekor kabupaten: `MAN 3 Ciamis` dan
  `MAN 3 Tasikmalaya`, bukan dua-duanya `MAN 3`.

Yang kedua juga yang membuat pagar kembar di database bisa sesederhana satu
unique index atas nama — `alamat` tidak perlu ikut jadi kunci. Selama
pemeriksaan ini hidup, nama sudah cukup membedakan sekolah sendirian.

Skrip ini tidak bisa tahu alamat sebuah sekolah benar atau salah. Yang bisa ia
tahu: kedua berkas masih saling cocok, dan bentuk isiannya masih menuruti
aturan yang sudah ditulis. Itu yang gagal diam-diam.

Jalankan dari mana saja: `python tools/periksa_sekolah.py`
"""

import collections
import json
import pathlib
import re
import sys

AKAR = pathlib.Path(__file__).resolve().parent.parent
KEYAKINAN = {"tinggi", "sedang", "rendah"}

# Sekolah yang memang belum punya alamat, dan alasannya sudah ditulis di
# runbook bagian 11. Keduanya menunggu jawaban pembina, bukan menunggu
# pencarian yang lebih keras.
BELUM_KETEMU = {"SMK Nusantara 1 Bekasi", "SMPN 1 Kalijaya"}

# `SMK Bhakti Kencana` satu klaster berisi DUA sekolah (Kota Banjar dan
# Kab. Ciamis). Memisahkannya di sekolah_nama.json butuh berkas .xlsx yang
# tidak ada di repo — runbook bagian 11 nomor 1. Sampai itu dikerjakan, dua
# baris alamatnya memang tidak punya klaster senama.
BELUM_DIPISAH = {"SMK Bhakti Kencana Banjar", "SMK Bhakti Kencana Ciamis"}

# Madrasah di bawah Kemenag/EMIS tidak selalu ada di Dapodik, jadi tidak selalu
# punya NPSN. Alamatnya ketemu lewat sekolah saudara di kompleks yang sama.
TANPA_NPSN = {"MA Agrowisata Shaleha", "MTs Serba Bakti Suryalaya",
              "MA Adzkia", "SMA IT Nurul Huda"}

# Kolom `jalan` tidak boleh mengulang apa yang sudah punya kolom sendiri
# (runbook bagian 8). Yang diperiksa hanya yang tidak bisa diperdebatkan:
# kecamatan tidak pernah bagian dari nama jalan, dan nama desa/kelurahan di
# AWAL kolom berarti kolomnya salah isi.
#
# Dusun dan RT/RW SENGAJA tidak dilarang: banyak sekolah memang tidak punya
# nama jalan sama sekali — Dapodik menulis "Dusun Cileueur RT 002 RW 001" — dan
# itulah satu-satunya penunjuk lokasi di bawah level desa. Membuangnya membuat
# alamat suratnya tinggal nama desa.
BUKAN_JALAN = re.compile(r'\b(Kecamatan|Kec)\b\.?', re.I)
AWALAN_SALAH = re.compile(r'^(Desa|Kelurahan|Kel)\b\.?', re.I)


# Judul bagian E di docs/sekolah-belum-tuntas.md. Pemeriksaan 7 berhenti di
# sini: yang di bawahnya sekolah yang alamatnya belum dicari sama sekali,
# bukan daftar kerja atas sekolah_alamat.json. Ditulis sebagai konstanta
# supaya judul yang berganti gagal keras, bukan diam-diam melebarkan cakupan
# pemeriksaan sampai melaporkan tiga belas sekolah sebagai pelanggar.
BAGIAN_XXXVII = "## E. Sekolah baru dari pendaftaran XXXVII"


def muat(nama):
    berkas = AKAR / "tools" / "data" / nama
    if not berkas.exists():
        print(f"GAGAL: {berkas} tidak ada.")
        sys.exit(1)
    return json.loads(berkas.read_text(encoding="utf-8"))


def main():
    nama = muat("sekolah_nama.json")
    alamat = muat("sekolah_alamat.json")
    salah = []

    nama_sekolah = {n["nama"] for n in nama}
    nama_alamat = [a["nama"] for a in alamat]

    # 1. Satu baris alamat per sekolah, tidak lebih.
    for n, jumlah in collections.Counter(nama_alamat).items():
        if jumlah > 1:
            salah.append(f"{n}: {jumlah} baris alamat, seharusnya satu")

    # 2. NPSN sama berarti sekolah sama — dua baris ber-NPSN sama itu kembar
    #    yang belum digabung (runbook bagian 7).
    npsn = collections.defaultdict(list)
    for a in alamat:
        if a.get("npsn"):
            npsn[a["npsn"]].append(a["nama"])
    for kode, siapa in npsn.items():
        if len(siapa) > 1:
            salah.append(f"NPSN {kode} dipakai {len(siapa)} baris: {siapa} — gabungkan")

    # 3. Tidak ada baris alamat untuk sekolah yang tidak ada di daftar.
    for a in alamat:
        if a["nama"] not in nama_sekolah and a["nama"] not in BELUM_DIPISAH:
            salah.append(f"{a['nama']}: ada di sekolah_alamat.json tapi bukan sekolah mana pun")

    # 4. Tidak ada sekolah yang terlewat sama sekali.
    punya = set(nama_alamat)
    for n in sorted(nama_sekolah - punya):
        if n != "SMK Bhakti Kencana":       # dua barisnya bernama lain, lihat di atas
            salah.append(f"{n}: tidak punya baris di sekolah_alamat.json")

    # 5. Bentuk isian tiap baris.
    for a in alamat:
        n = a["nama"]
        if a.get("keyakinan") not in KEYAKINAN:
            salah.append(f"{n}: keyakinan {a.get('keyakinan')!r} bukan tinggi/sedang/rendah")
        belum = n in BELUM_KETEMU
        if not a.get("npsn") and not belum and n not in TANPA_NPSN:
            salah.append(f"{n}: tidak punya NPSN — daftarkan di TANPA_NPSN kalau memang di EMIS")
        if a.get("npsn") and not re.fullmatch(r'[0-9]{8}', a["npsn"]):
            salah.append(f"{n}: NPSN {a['npsn']!r} bukan 8 angka")
        if a.get("kode_pos") and not re.fullmatch(r'[0-9]{5}', a["kode_pos"]):
            salah.append(f"{n}: kode pos {a['kode_pos']!r} bukan 5 angka")
        if a.get("jalan"):
            if BUKAN_JALAN.search(a["jalan"]) or AWALAN_SALAH.match(a["jalan"]):
                salah.append(f"{n}: kolom jalan memuat desa/kecamatan — {a['jalan']!r}")
            if re.match(r'^(Jalan|JL|Jln)\b', a["jalan"]):
                salah.append(f"{n}: tulis 'Jl.', bukan {a['jalan'].split()[0]!r}")
        if not belum and not a.get("keyakinan") == "rendah" and not a.get("sumber"):
            salah.append(f"{n}: tidak punya sumber")

    # 6. Nama tampil tidak boleh punya kata yang menempel (runbook bagian 9).
    #    "MTsN" memang ber-huruf kecil di tengah; itu bentuk bakunya.
    for n in sorted(nama_sekolah):
        if re.search(r'[a-z][A-Z]', n.replace("MTsN", "MTSN")) or ")" in n:
            salah.append(f"{n}: kata menempel atau kurung tertinggal")

    # 7. docs/sekolah-belum-tuntas.md harus memuat PERSIS sekolah yang
    #    keyakinannya belum `tinggi` — tidak lebih, tidak kurang. Daftar kerja
    #    yang tidak ikut menyusut waktu pekerjaannya beres akan berhenti
    #    dipercaya, lalu berhenti dibaca, dan sekolah yang tersisa di dalamnya
    #    ikut terlupakan.
    doc = AKAR / "docs" / "sekolah-belum-tuntas.md"
    if not doc.exists():
        salah.append("docs/sekolah-belum-tuntas.md tidak ada")
    else:
        isi = doc.read_text(encoding="utf-8")
        # Yang dibandingkan HANYA bagian A-D. Bagian E daftar yang lain sama
        # sekali: sekolah yang masuk lewat pendaftaran XXXVII dan alamatnya
        # BELUM DICARI, jadi ia memang tidak punya baris di sekolah_alamat.json
        # dan tidak boleh dituntut punya. Tanpa potongan ini pemeriksaan
        # melaporkan ketiga belasnya sebagai "sudah tinggi tapi masih
        # terdaftar" — lapor palsu, dan pemeriksa yang lapor palsu berhenti
        # dipercaya.
        batas = isi.find(BAGIAN_XXXVII)
        if batas == -1:
            salah.append(
                f"docs/sekolah-belum-tuntas.md: judul {BAGIAN_XXXVII!r} hilang — "
                "periksa apakah bagiannya diganti nama atau dihapus")
        else:
            isi = isi[:batas]
        # Tiap baris tabel berbentuk: | **Nama Sekolah** | ...
        didaftar = set(re.findall(r'^\| \*\*(.+?)\*\* \|', isi, re.M))
        belum = {a["nama"] for a in alamat if a.get("keyakinan") != "tinggi"}
        for n in sorted(belum - didaftar):
            salah.append(f"{n}: keyakinan belum 'tinggi' tapi tidak ada di docs/sekolah-belum-tuntas.md")
        for n in sorted(didaftar - belum):
            salah.append(f"{n}: sudah 'tinggi' tapi masih terdaftar di docs/sekolah-belum-tuntas.md — hapus barisnya")

    if salah:
        print(f"GAGAL: {len(salah)} masalah.\n")
        for s in salah:
            print(f"  {s}")
        print("\nLihat docs/runbook-sekolah.md bagian 7 dan 8.")
        sys.exit(1)

    lengkap = sum(1 for a in alamat if a.get("kode_pos"))
    tinggi = sum(1 for a in alamat if a["keyakinan"] == "tinggi")
    print(f"{len(nama)} sekolah, {len(alamat)} baris alamat "
          f"({tinggi} keyakinan tinggi, {lengkap} lengkap dengan kode pos). "
          f"Belum ketemu: {len(BELUM_KETEMU)}.")


if __name__ == "__main__":
    main()
