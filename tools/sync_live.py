r"""Salin berkas bersama web/ -> live/, lalu isi setiap `?v=` dari isi berkasnya.

KENAPA BERKAS INI ADA

Situs peserta (live/) memakai empat berkas dari situs panitia: style.css,
config.js, js/api.js, dan js/util.js. Setiap kali isinya berubah, alamatnya di
HTML (`style.css?v=...`) juga harus berubah — tab yang sudah terbuka sejak
pagi, halaman yang dipulihkan dari bfcache, dan perantara yang memegang salinan
sendiri hanya mengambil berkas baru kalau alamatnya berganti.

Dulu keduanya dikerjakan tangan: cp, lalu menaikkan nomor di tiga berkas HTML.
Nomornya pernah tertinggal empat kali berturut-turut (#874-#877), dan dua dari
tiga penghitung tidak dijaga apa pun — web/index.html berhenti di v=63 melewati
enam perubahan style.css, daftar.js melewati 27 perubahan dengan v=4.

Di sini `?v=` bukan nomor urut melainkan SIDIK JARI ISI berkasnya (12 huruf
pertama sha256, akhiran baris dinormalkan ke LF). Berkas berubah = alamat
berubah, tanpa ada yang perlu ingat.

style.css TIDAK DISALIN UTUH. Sebagian besar isinya cuma untuk layar panitia
(Cek Nilai, Input Pos, Buku Sakti, penampil foto ...), dan dulu seluruhnya
ikut diunduh 1.500-3.000 HP peserta. live/style.css sekarang DIBUAT dari
web/style.css: aturan yang mewajibkan kelas atau id yang tidak pernah muncul di
kode situs peserta dibuang, komentar dibuang, dan sisanya tetap dalam URUTAN
ASLINYA — jadi cascade di halaman peserta sama persis dengan sebelumnya.
Layar panitia tidak berubah sama sekali: ia tetap memuat web/style.css utuh.

Penyaringnya sengaja berhati-hati, karena aturan yang salah dibuang membuat
halaman publik kehilangan gayanya:
  - sebuah kelas dianggap DIPAKAI peserta kalau namanya muncul di mana pun
    dalam kode peserta (HTML, JS, live.css), ATAU diawali sesuatu yang di
    kode peserta langsung diikuti `${` atau `" +` — kelas yang dirakit dari
    data seperti `j${peringkat}` atau `i-${warna}`;
  - argumen pseudo-class (`:not(.x)`, `:is(...)`, `:has(...)`) diabaikan:
    `:not(.x)` justru cocok dengan elemen TANPA .x;
  - selektor tanpa kelas atau id (`body`, `h1`, `[data-x]`) selalu dipakai;
  - satu blok dibuang hanya kalau SETIAP selektor dalam daftarnya mati;
  - @keyframes, @font-face, @page dan sejenisnya selalu disimpan.

Kelas yang dipakai halaman peserta TANPA pernah tertulis di kodenya — nama yang
datang utuh dari data — tidak terlindungi oleh aturan di atas. Kalau suatu hari
live.js menulis `class="${b.sesuatu}"`, kelas-kelas itu harus disebut di
kodenya (misalnya di komentar) supaya aturannya tidak terbuang.

PAKAI

    python tools/sync_live.py             # salin + isi ?v=
    python tools/sync_live.py --periksa   # hanya periksa; exit 1 kalau basi

tests/live_asset_version.test.mjs menjalankan --periksa setiap kali
`node --test` dijalankan, jadi lupa menjalankan skrip ini membuat tes merah.

config.js TIDAK disalin selama web/config.js berisi mode "dev" — itu keadaan
laptop yang sedang membuka layar lokal (CLAUDE.md bagian 17), dan menyalinnya
akan mengirim situs peserta ke server dev yang tidak ada.
"""
import hashlib
import re
import shutil
import sys
from pathlib import Path

AKAR = Path(__file__).resolve().parent.parent

BERSAMA = ["config.js", "js/api.js", "js/util.js"]
HALAMAN = ["web/index.html", "live/index.html", "live/daftar.html"]
VERSI = re.compile(r'((?:href|src)="([^"?#]+)\?v=)([^"]*)(")')

# Kode yang dijalankan atau dibaca halaman peserta. Kelas yang tidak pernah
# muncul di sini tidak mungkin ada di DOM peserta.
KODE_PESERTA = ["live/index.html", "live/daftar.html", "live/live.js", "live/live.css",
                "live/js/daftar.js", "live/js/util.js", "live/js/api.js",
                "live/js/school-search.mjs", "live/config.js"]

KEPALA_CSS = (
    "/* DIBUAT tools/sync_live.py dari web/style.css — JANGAN DISUNTING.\n"
    "   Sunting web/style.css lalu jalankan: python tools/sync_live.py\n"
    "   Aturan yang hanya dipakai layar panitia dan semua komentar dibuang;\n"
    "   alasannya di kepala tools/sync_live.py. */\n"
)


def sidik(berkas: Path) -> str:
    teks = berkas.read_text(encoding="utf-8").replace("\r\n", "\n")
    return hashlib.sha256(teks.encode("utf-8")).hexdigest()[:12]


# ---------------------------------------------------------------- style.css

def nama_peserta() -> tuple[set[str], set[str]]:
    """Semua kata di kode peserta, dan awalan kelas yang dirakit dari data."""
    teks = "\n".join((AKAR / n).read_text(encoding="utf-8") for n in KODE_PESERTA)
    kata = set(re.findall(r"[A-Za-z_][A-Za-z0-9_-]*", teks))
    awalan = set(re.findall(r"([A-Za-z_][A-Za-z0-9_-]*)\$\{", teks))
    awalan |= set(re.findall(r"[\"'`]([A-Za-z_][A-Za-z0-9_-]*)[\"'`]\s*\+", teks))
    return kata, awalan


def _lewati_string(css: str, i: int) -> int:
    q = css[i]
    i += 1
    while css[i] != q:
        i += 2 if css[i] == "\\" else 1
    return i + 1


def blok_css(css: str):
    """(jenis, awal, akhir, prelude, awal_badan, akhir_badan) untuk tiap unsur
    tingkat atas. Komentar dan string dilewati dengan benar."""
    i, n = 0, len(css)
    while i < n:
        if css.startswith("/*", i):
            i = css.index("*/", i) + 2
            continue
        if css[i].isspace():
            i += 1
            continue
        j = i
        while j < n and css[j] not in "{;":
            if css.startswith("/*", j):
                j = css.index("*/", j) + 2
            elif css[j] in "\"'":
                j = _lewati_string(css, j)
            else:
                j += 1
        if j >= n:
            break
        if css[j] == ";":
            yield ("pernyataan", i, j + 1, css[i:j].strip(), None, None)
            i = j + 1
            continue
        kedalaman, k = 0, j
        while k < n:
            if css.startswith("/*", k):
                k = css.index("*/", k) + 2
                continue
            c = css[k]
            if c in "\"'":
                k = _lewati_string(css, k)
                continue
            if c == "{":
                kedalaman += 1
            elif c == "}":
                kedalaman -= 1
                if kedalaman == 0:
                    break
            k += 1
        yield ("blok", i, k + 1, css[i:j].strip(), j + 1, k)
        i = k + 1


def _wajib(selektor: str) -> list[str]:
    """Kelas dan id yang DIWAJIBKAN satu selektor."""
    s = selektor
    while True:
        t = re.sub(r":[A-Za-z-]+\([^()]*\)", "", s)
        if t == s:
            break
        s = t
    s = re.sub(r"\[[^\]]*\]", "", s)
    return re.findall(r"[.#]([A-Za-z_][A-Za-z0-9_-]*)", s)


def _rapat(teks: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"/\*.*?\*/", "", teks, flags=re.S)).strip()


def saring_css(css: str, kata: set[str], awalan: set[str]) -> list[str]:
    dipakai = lambda nama: nama in kata or any(nama.startswith(a) for a in awalan)
    hasil = []
    for jenis, a, b, prelude, ba, bb in blok_css(css):
        if jenis == "pernyataan":
            hasil.append(_rapat(css[a:b]))
            continue
        kepala = prelude.split(None, 1)[0] if prelude.startswith("@") else ""
        if kepala in ("@media", "@supports", "@layer", "@container"):
            isi = saring_css(css[ba:bb], kata, awalan)
            if isi:
                hasil.append(_rapat(prelude) + "{\n" + "\n".join(isi) + "\n}")
            continue
        if kepala:
            hasil.append(_rapat(css[a:b]))
            continue
        selektor = [x.strip() for x in _rapat(prelude).split(",")]
        if all(any(not dipakai(c) for c in _wajib(x)) for x in selektor):
            continue
        hasil.append(_rapat(prelude) + "{" + _rapat(css[ba:bb]) + "}")
    return hasil


def css_peserta() -> str:
    css = (AKAR / "web" / "style.css").read_text(encoding="utf-8")
    kata, awalan = nama_peserta()
    return KEPALA_CSS + "\n".join(saring_css(css, kata, awalan)) + "\n"


# ---------------------------------------------------------------- langkah

def salin(periksa: bool) -> list[str]:
    basi = []
    for nama in BERSAMA:
        asal, tujuan = AKAR / "web" / nama, AKAR / "live" / nama
        if asal.read_bytes() == tujuan.read_bytes():
            continue
        if nama == "config.js" and 'mode: "dev"' in asal.read_text(encoding="utf-8"):
            basi.append("web/config.js bermode dev — kembalikan dulu (git checkout web/config.js)")
            continue
        basi.append(f"live/{nama} tidak sama dengan web/{nama}")
        if not periksa:
            shutil.copyfile(asal, tujuan)

    tujuan = AKAR / "live" / "style.css"
    baru = css_peserta()
    if tujuan.read_text(encoding="utf-8").replace("\r\n", "\n") != baru:
        basi.append("live/style.css tidak sama dengan saringan web/style.css")
        if not periksa:
            tujuan.write_text(baru, encoding="utf-8", newline="\n")
    return basi


def stempel(periksa: bool) -> list[str]:
    basi = []
    for nama in HALAMAN:
        halaman = AKAR / nama
        teks = halaman.read_text(encoding="utf-8")

        def ganti(m: re.Match) -> str:
            berkas = halaman.parent / m.group(2)
            if not berkas.exists():
                basi.append(f"{nama}: {m.group(2)} dialamati tetapi berkasnya tidak ada")
                return m.group(0)
            baru = sidik(berkas)
            if m.group(3) != baru:
                basi.append(f"{nama}: {m.group(2)}?v={m.group(3)} seharusnya ?v={baru}")
            return m.group(1) + baru + m.group(4)

        hasil = VERSI.sub(ganti, teks)
        if hasil != teks and not periksa:
            halaman.write_text(hasil, encoding="utf-8", newline="")
    return basi


if __name__ == "__main__":
    periksa = "--periksa" in sys.argv[1:]
    # Salin dulu, baru stempel: sidik jari live/style.css harus dihitung dari
    # salinan yang sudah baru.
    basi = salin(periksa) + stempel(periksa)
    if periksa:
        if basi:
            print("Salinan live/ atau ?v= basi:")
            for b in basi:
                print(f"  {b}")
            print("Jalankan: python tools/sync_live.py")
            sys.exit(1)
        print("Salinan live/ sama dan setiap ?v= cocok dengan isinya.")
    else:
        if basi:
            print("Diperbarui:")
            for b in basi:
                print(f"  {b}")
        print("Selesai." if basi else "Tidak ada yang berubah.")
