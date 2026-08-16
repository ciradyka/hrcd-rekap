# -*- coding: utf-8 -*-
"""Kumpulkan dan bakukan nama sekolah dari empat berkas HRCD (XXXIII-XXXVI).

Keluaran: sekolah.json — satu baris per sekolah, dengan seluruh ejaan yang
pernah dipakai dan potongan alamat dari spreadsheet sebagai PETUNJUK pencarian
(bukan sebagai alamat final; peserta mengetiknya terburu-buru di form).
"""
import pandas as pd, re, collections, json, io, unicodedata

SRC = [("XXXIII", "30c41775-Database_HRCD_XXXIII.xlsx", "Data Utama",  "Asal Sekolah", "Alamat Sekolah"),
       ("XXXIV",  "049d473a-Database_HRCD_XXXIV.xlsx",  "Pendaftaran", "Asal Sekolah", "Alamat Sekolah"),
       ("XXXV",   "4f956ef9-Database_HRCD_XXXV.xlsx",   "Pendaftaran", "Asal Sekolah / Organisasi", "Alamat Sekolah"),
       ("XXXVI",  "965e12a2-Database_HRCD_XXXVI.xlsx",  "Pendaftaran", "Asal Sekolah / Organisasi", "Alamat Sekolah")]

# --------------------------------------------------------------------------
# 1. Baris yang bukan sekolah.
# --------------------------------------------------------------------------
KELAS = re.compile(r'^(x{1,3}i{0,3}|[0-9]{1,2})\s*(mipa|ipa|ips|iis)\s*[0-9]+$', re.I)
ORG   = {"osis", "mpk", "kir", "forsa", "nuansa", "paskibra", "pramuka",
         "saka wanabakti", "saka wanabakti kawali", "contoh"}
LUCU  = re.compile(r'hogwarts|oxford|\bmars\b|oplas|sman 1 oke', re.I)

def bukan_sekolah(n):
    k = n.strip().lower()
    return bool(KELAS.match(k) or k in ORG or LUCU.search(n)
                or re.match(r'^(jl|jln|jalan)\b', k))

# --------------------------------------------------------------------------
# 2. Pembakuan jenjang. "SMP NEGERI" jadi "SMPN" — bentuk yang diucapkan
#    orang (CLAUDE.md 5.7), dan yang diminta pemilik.
# --------------------------------------------------------------------------
def baku(n):
    n = re.sub(r'\s+', ' ', str(n).strip())
    n = re.sub(r'\s*-\s*', '-', n)                       # "Ar - Rahman"
    n = re.sub(r'^\s*Ambalan\b.*?(?=\b(MAN|MA|MTsN|MTs|SMAN|SMA|SMKN|SMK|SMPN|SMP)\b)',
               '', n, flags=re.I)
    n = re.sub(r'\bMadrasah Aliyah\b', 'MA', n, flags=re.I)
    n = re.sub(r'\bMadrasah Tsanawiyah\b', 'MTs', n, flags=re.I)
    n = re.sub(r'\b(SMP|SMA|SMK)\s*NEGERI\b', lambda m: m.group(1).upper() + 'N', n, flags=re.I)
    n = re.sub(r'\b(SMP|SMA|SMK)\s+N\b(?![a-z])', lambda m: m.group(1).upper() + 'N', n, flags=re.I)
    n = re.sub(r'\bMA\s*NEGERI\b', 'MAN', n, flags=re.I)
    n = re.sub(r'\bMTS?\s*NEGERI\b', 'MTsN', n, flags=re.I)
    n = re.sub(r'\bMTSN\b', 'MTsN', n, flags=re.I)
    # Spasi ikut dimakan lalu DIKEMBALIKAN oleh penggantinya. Kalau titiknya
    # cuma dibuang ("\.?" dengan pengganti "MTs"), "Mts.AR-rahman" jadi
    # "MTsAR-rahman" — satu kata, dan satu klaster yang berdiri sendiri.
    n = re.sub(r'\bMTS[S]?\b\.?\s*', 'MTs ', n, flags=re.I)
    n = re.sub(r'\b(SMA|SMK|SMP)S\b', lambda m: m.group(1).upper(), n, flags=re.I)
    n = re.sub(r'\bMAS\b', 'MA', n, flags=re.I)
    n = re.sub(r'\bSMAI\b', 'SMA Islam', n, flags=re.I)
    # Terpadu: "SMPT", "SMP T", "SMA (terpadu)".
    #
    # `\b` di ujung TIDAK cukup, dan percobaan pertama gagal justru karena itu:
    # pada "SMA TERPADU CIKANYERE" gugus `\s*` sebelum `\)?` ikut memakan
    # spasinya, lalu `\b` tetap cocok di depan "C" — hasilnya
    # "SMA TerpaduCIKANYERE". Pada "MA(terpadu) Ar-Rahman" tanda kurung
    # tutupnya malah tertinggal, jadi "MA Terpadu) Ar-Rahman".
    #
    # Jadi spasinya dikembalikan lewat PENGGANTI, dan spasi ganda dirapatkan
    # di baris terakhir fungsi ini. Bentuk yang tidak bisa salah.
    n = re.sub(r'\b(SMP|SMA|SMK|MA)\s*\(\s*terpadu\s*\)', r'\1 Terpadu ', n, flags=re.I)
    n = re.sub(r'\b(SMP|SMA|SMK|MA)\s*terpadu\b',         r'\1 Terpadu ', n, flags=re.I)
    n = re.sub(r'\b(SMP|SMA|SMK|MA)\s*T\b(?![a-zA-Z])',   r'\1 Terpadu ', n, flags=re.I)
    return re.sub(r'\s+', ' ', n).strip()

AKRONIM = {"SMPN","SMAN","SMKN","MAN","MTSN","SMP","SMA","SMK","MA","MTS","PUI","PGRI",
           "NU","IT","BKMU","YPI","YRM","AMS","KH","BP","YAPIIM","PERSIS","SPP","IPA","IPS"}
# "al"/"el" TIDAK di sini: pada "Al-Hasan" dan "Al-Iqna" ia bagian nama
# diri, bukan kata sambung, dan menuliskannya kecil salah.
KECIL   = {"bin","dan","bs","di","ke"}

def satu_kata(w, awal):
    besar = w.upper().strip(".")
    if besar == "MTSN": return "MTsN"
    if besar == "MTS":  return "MTs"
    if besar in AKRONIM: return besar
    if not awal and w.lower() in KECIL: return w.lower()
    if "-" in w:  return "-".join(satu_kata(p, i == 0) for i, p in enumerate(w.split("-")))
    if "'" in w:  return "'".join(p.capitalize() if i == 0 else p.lower()
                                  for i, p in enumerate(w.split("'")))
    if re.fullmatch(r'[0-9]+', w): return w
    return w.capitalize()

def rapikan(n):
    n = baku(n)
    return " ".join(satu_kata(w, i == 0) for i, w in enumerate(n.split(" ")))

# --------------------------------------------------------------------------
# 3. Kunci penggabungan. Seagresif mungkin TANPA menyatukan jenjang berbeda —
#    MA PUI Cijantung dan MTs PUI Cijantung adalah dua sekolah.
# --------------------------------------------------------------------------
EJAAN_SAMA = [(r'fadl?i?l?l?i?yah', 'fadliliyah'), (r'ar\s*rahman', 'arrahman'),
              (r'al\s*iqna', 'aliqna'), (r'el\s*bas', 'elbas'),
              (r'wadda?w?ah', 'waddawah'), (r'riyadlul\s*ulum', 'riyadlululum'),
              (r'ma\s*arif|maarif', 'maarif'), (r'darus+alam', 'darussalam'),
              (r'assalimiyah|asalimiah|assalamiyah', 'assalimiyah'),
              (r'agrowisata\s*shaleha', 'agrowisata'), (r'ghofur|ghafur', 'ghafur'),
              (r'sanggoro|sagoro', 'sanggoro'), (r'darul\s*huda', 'darulhuda')]
# Kata daerah yang kadang ditempel kadang tidak: "SMPN 1 Lelea" = "SMPN 1 Lelea
# Indramayu". Dibuang dari kunci saja, tidak dari nama tampil.
EKOR = r'\b(indramayu|tasikmalaya|ciamis|banjar|kuningan|majalengka|cilacap|garut|cirebon)\b'

def kunci(n):
    k = unicodedata.normalize("NFKD", baku(n)).lower().replace("'", "").replace("`", "")
    k = re.sub(r'[^a-z0-9]+', ' ', k)
    k = re.sub(r'\b(kabupaten|kab|kota|jawa barat|jabar)\b', ' ', k)
    for a, b in EJAAN_SAMA: k = re.sub(a, b, k)
    k = re.sub(r'\s+', ' ', k).strip()
    # Ekor daerah dibuang HANYA kalau kata terakhir, dan hanya bila yang tersisa
    # masih menyebut tempat/nama diri (>= 3 kata) — supaya "SMKN 1 Ciamis" tidak
    # runtuh jadi "SMKN 1".
    potong = re.sub(EKOR + r'$', '', k).strip()
    if potong and len(potong.split()) >= 3: k = potong
    return re.sub(r'\s+', ' ', k).strip()

# --------------------------------------------------------------------------
baris = []
for e, f, sh, ks, ka in SRC:
    d = pd.read_excel(f, sheet_name=sh)
    for _, r in d.iterrows():
        s = r.get(ks)
        if pd.isna(s) or not str(s).strip(): continue
        s = str(s).strip()
        if bukan_sekolah(s): continue
        baris.append({"edisi": e, "mentah": s,
                      "alamat": "" if pd.isna(r.get(ka)) else str(r.get(ka)).strip()})

GABUNG_TANGAN = {
    "mts aliqna": "mts aliqna cisaga",
}

klaster = collections.defaultdict(list)
for b in baris:
    k = kunci(b["mentah"])
    klaster[GABUNG_TANGAN.get(k, k)].append(b)

hasil = []
for k, v in klaster.items():
    ejaan = collections.Counter(x["mentah"] for x in v)
    top = max(ejaan.values())
    # Dari ejaan yang paling sering, ambil yang paling panjang: paling informatif.
    pilih = sorted([n for n, c in ejaan.items() if c == top], key=lambda s: (-len(s), s))[0]
    hasil.append({
        "kunci": k, "nama": rapikan(pilih), "peserta": len(v),
        "edisi": sorted({x["edisi"] for x in v}),
        "ejaan": sorted(ejaan),
        "petunjuk_alamat": sorted({x["alamat"] for x in v if x["alamat"]}, key=lambda s: -len(s))[:3],
    })

hasil.sort(key=lambda x: (-x["peserta"], x["nama"]))
# "MTsN" memang ber-huruf kecil di tengah; itu bentuk bakunya, bukan cacat.
menempel = [h["nama"] for h in hasil
            if re.search(r'[a-z][A-Z]', h["nama"].replace("MTsN", "MTSN"))]
assert not menempel, f"nama menempel: {menempel}"
with io.open("sekolah.json", "w", encoding="utf-8") as fh:
    json.dump(hasil, fh, ensure_ascii=False, indent=1)
print(f"{len(baris)} baris peserta -> {len(hasil)} sekolah")
print(f"tanpa petunjuk alamat: {sum(1 for h in hasil if not h['petunjuk_alamat'])}")
