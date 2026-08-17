# AGENTS.md

Guidance for coding agents working in this repository. **Isinya sengaja identik dengan CLAUDE.md** — kalau salah satu diubah, yang lain WAJIB ikut diubah di commit yang sama.

Pernah menyimpang, dan itulah kenapa aturan sinkron di atas ditulis: AGENTS.md sempat tertinggal 21 baris — seluruh butir bahasa 9-12 hilang, termasuk aturan penamaan berkas — dan tiga string di dalamnya rusak oleh find-and-replace buta atas nama agen, salah satunya jadi URL yang mengarah ke situs pihak ketiga yang tak berhubungan.

## 1. Branching

1. Never commit directly to `main`. All work lands through a pull request.
2. Branch off the latest `main`:
   ```bash
   git checkout main && git pull
   git checkout -b <type>/<short-description>
   ```
3. Name branches `<type>/<short-description>` in kebab-case — for example
   `feat/rekap-export`, `fix/duplicate-rows`, `docs/claude-md`.
4. Use the same `<type>` vocabulary as commits: `feat`, `fix`, `chore`, `docs`,
   `refactor`, `test`.

## 2. Commits

1. Write the subject as `<type>: <what changed>`, imperative mood, no trailing
   period, ideally under 72 characters.
2. Add a body when the change needs a *why*. Wrap it at 72 columns and separate
   it from the subject with a blank line.
3. End every commit message with the co-author trailer:
   ```
   Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
   ```
4. Keep a commit to one logical change. Do not bundle unrelated edits.

## 3. Creating the pull request

1. Push the branch and set upstream:
   ```bash
   git push -u origin HEAD
   ```
2. Open the PR against `main` with `gh`:
   ```bash
   gh pr create --base main --head <branch> --title "<type>: <what changed>" --body "..."
   ```
3. The PR title is what ends up in `main`'s history — see section 4.2 — so make
   it read well on its own.
4. Structure the body with a **What** section and a **Why** section. Add
   **Notes** only when there is a caveat worth flagging.
5. End the PR body with:
   ```
   🤖 Generated with [Claude Code](https://claude.com/claude-code)
   ```
6. Only create or push a PR when the user has asked for it.

## 4. Merging to `main`

1. Always merge with a **merge commit** (`--merge`, i.e. `--no-ff`). Never
   `--squash`, never `--rebase` — every PR must stay a distinct merge point with
   two parents in `main`'s history.
2. The merge commit subject must be the PR title followed by the PR number:
   `<PR title> (#<number>)`.
3. The one command that satisfies both rules:
   ```bash
   gh pr merge <number> --merge --subject "<PR title> (#<number>)" --delete-branch
   ```
4. Never omit `--subject`. Without it GitHub writes
   `Merge pull request #N from <branch>`, which buries the title.
5. `--delete-branch` removes the remote branch and switches back to `main`. Run
   `git remote prune origin` afterwards to clear the stale local ref.
6. Verify the result — the merge commit must report two parents:
   ```bash
   git log --graph --oneline -5
   git rev-list --parents -n1 HEAD   # expect: <merge> <parent1> <parent2>
   ```
7. Merging is a user decision. Do not merge unless the user asked for it.

## 5. Language

1. Split language by **audience**, not by file.
2. **Indonesian** — UI text, everything under `docs/`, and all domain vocabulary
   wherever it appears, including code identifiers, database tables, and column
   names.
3. **Never translate domain terms.** `regu`, `nomor dada`, `kloter`,
   `kontrak waktu`, `pos`, `wahana`, `daftar ulang`, `barak`, `golongan`. The
   panitia say these words, so the code says them too. Writing `chestNumber`
   for `nomor_dada` creates a lookup tax on every conversation and eventually
   becomes a bug.
4. **English** — technical vocabulary (`repository`, `service`, `migration`,
   `controller`, `cache`), commit messages, PR titles and bodies, and this file.
5. **Do not translate technical terms into Indonesian.** `pengendali` for
   controller or `penyimpanan` for repository sounds friendlier but cuts
   maintainers off from every tutorial, library doc, and error message they will
   need to search.
6. Mixing both inside one identifier is expected and correct:
   `KloterRepository`, `hitungPenalti()`, `nomor_dada`.
7. **Prefer the word people actually say, even when it is an English loanword.**
   Write `online`, `offline`, `link`, `upload`, `download`, `preview`,
   `password`, `timestamp`, `edit`. Do not use the formal coinages `daring`,
   `luring`, `tautan`, `unggah`, `unduh`, `pratinjau`, `kata sandi`,
   `cap waktu`, `sunting` — they are correct Indonesian but the panitia stumble
   over them, and a document that has to be decoded on first read does not get
   read.
8. Rule 7 does not loosen rule 3. Domain terms stay Indonesian however technical
   they sound, because no familiar English equivalent exists: `regu` is not
   "squad", and `nomor dada` is not "bib number" to anyone at this event.
9. **File names, directory names, and branch names are English** whenever the
   thing they name is technical rather than domain. This is rule 4 applied to
   the filesystem, and it was violated repeatedly before being written down:
   `terapkan-migrasi.yml` should have been `apply-migration.yml`, `tes-sql.yml`
   should have been `sql-tests.yml`, `ganti_password.py` should have been
   `change_password.py`. A workflow, a script, a test harness, and a migration
   are all technical concepts — the panitia never speak their names.
10. **Use the term the industry already uses, not a literal translation.**
    Migrations are *applied*, not "implemented"; tests *run*; servers *start*.
    Translating word-for-word from Indonesian produces names that are English
    but still unsearchable, which defeats the entire point of rule 5.
11. Rule 9 stops where the domain begins. `0011_nomor_dada_manual.sql`,
    `0008_cetak_kloter.sql` and `05_pindah_kloter.sql` keep their Indonesian
    parts, because `nomor dada`, `kloter`, `cetak kloter` and `pindah kloter`
    are all things the panitia say — only the surrounding words that already
    have an industry name turn English (`seed`, `test`, `rename`,
    `migration`), as in `supabase/seed.sql` and
    `0012_rename_audit_columns.sql`.
12. **A workflow's `name:` field is UI text, so rule 1 decides it — by
    audience, not by file.** A workflow a panitia runs from the Actions tab on
    their phone keeps an Indonesian name ("Ganti password akun panitia",
    "Provision akun panitia"). A workflow only a developer ever reads gets an
    English one ("SQL Tests", "Apply migration to Supabase"). The file name is
    English either way — that is rule 9 and has no exceptions.

## 6. Who maintains this

1. Maintainers are the next ambalan members — SMA students learning as they go —
   with the current owner assisting.
2. Therefore: prefer obvious code over clever code. A pattern that needs
   explaining before it can be used is the wrong pattern here.
3. Document generously. Assume the reader has no prior context and did not
   attend any of the discussions.
4. Keep the number of concepts small. Fewer layers a student must hold in their
   head at once beats a more elegant structure they cannot navigate.

## 7. Repository facts

1. Remote: `https://github.com/ciradyka/hrcd-rekap` (private).
2. Default branch: `main`. It has **no** branch protection, and squash and
   rebase merges are still enabled on the repo — section 4 is a convention, not
   something GitHub enforces. Follow it deliberately.
3. Git identity is configured **repo-locally**, not globally:
   `Furqon Aji Yudhistira <furqonajiy@gmail.com>`.
4. **Two commits on `main` have no merge point**, and the root
   `Initial commit` besides. PR #1 predates this convention and was
   squash-merged; `5502a5a` (15 August) was pushed straight to `main` by
   mistake and could not be undone without force-pushing the default branch,
   which is worse than untidy history. Leave all three as they are. Verify the
   count with `git log --first-parent` and check each commit's parent count —
   a commit reached as a merge's *second* parent is normal and must not be
   counted.
5. **`tests/run.sh` lists every migration by hand.** A new migration is NOT
   tested until it is added there, and CI stays green while ignoring it
   completely. Seven migrations and three test files once sat unrun for a day
   that way; what found it was a production apply failing on a column rename
   that CI should have caught first. Add the migration to `tests/run.sh` in the
   same commit that creates it.
6. **Three deploy paths, and only one of them is automatic in the obvious
   way.** The panitia site is connected to Git and ships on every merge. The
   peserta site must **never** be connected to Git — Cloudflare would serve the
   `pra`-phase `live.json` committed in `live/` and blank the rekap — so it
   ships through `publish-live.yml`, which regenerates that file from the
   database first; since #235 a push touching `live/**` triggers it
   automatically. Migrations never ship on merge: run
   `apply-migration.yml` with the file path, deliberately, after the PR lands.
7. `CLAUDE.md` and `AGENTS.md` are the same document twice — byte-identical
   apart from the first heading and the intro paragraph. Every edit to one
   lands in the other in the same commit. No workflow checks this
   (`shared-files.yml` only compares `web/` against `live/`), and the pair has
   already drifted 21 lines once, losing all of section 5's rules 9-12.

## 8. Printed forms

1. **Every printed form is photocopied, not printed once per copy.** One master
   goes to a field copier and comes back multiplied — often a copy of a copy.
   Every rule below follows from that, and none of them are cosmetic.
2. **No solid black fills.** A filled bar looks emphatic on screen and prints
   fine on a laser printer, but a copier renders it blotchy or streaked, and it
   drinks toner. Use a heavy rule instead: a line survives copying, a block
   does not.
3. **No reversed text.** White type on a dark ground is the first thing to
   disappear when a copy is copied — the fill closes over the letters. Black on
   white only.
4. **No grey, and no tints.** Grey is what copiers handle worst: they turn it
   into a dot screen that either drops out on a tired machine or darkens into
   dirt. Where something must recede, make it **small and solid black** rather
   than faint. Small and out of the way achieves the same thing as pale, and
   survives being copied a fourth time.
5. **Rules at least `0.75pt`.** Hairlines below that vanish entirely on a copy,
   and a form whose boxes have no edges is not a form.
6. **Type at least `7pt`.** Below that a copier fills in the counters — the
   holes in `a`, `e`, `o` — and toner speckle turns the word into a smudge.
7. **Nothing behind a writing area.** Boxes people write into stay white: no
   tint, no watermark, no example number printed inside. Speckle on white is
   still readable; speckle over a tint is not.
8. These rules live in `web/style.css` under `@media print`, and `live/` holds
   a byte-identical copy — section 7.5 applies to CSS the same way, and
   `shared-files.yml` enforces that pair.
9. **Form per lomba is A5 landscape — 210 × 148 mm, one form per page.**
   Half an A4 cut across, so any copier can duplicate it 2-up onto A4 and the
   stack is separated by a single straight cut. Landscape is not a preference:
   the two things that must be written large — nomor dada and the raw value —
   sit side by side with real room, and on A5 portrait they crowd downward
   until the value box is half its size.
10. **What the screen prints is the master, not the stack.** Blangko are
    multiplied on a copier, so a pos with three lomba prints three pages, not
    1.500. Printing the stack from a browser spends a whole office toner on
    work a copier finishes in minutes — and the count is decided at the copier
    anyway, since the forms are blank.

## 9. Screen text

1. **Do not over-educate. People are smart.** A small feature with a clear
   title needs no paragraph explaining itself. Panitia read these screens
   hundreds of times in a shift, and a sentence that teaches something learned
   once is re-read on every one of them.
2. **A title, a labelled field, and a button name are usually the whole
   interface.** "Buka gembok 001?" above a required field labelled "Alasan
   membuka" already says everything the paragraph "Alasannya dicatat di
   riwayat, dan itulah satu-satunya penjelasan yang tersisa…" said — in a
   quarter of the height, on a phone where the field it explained had been
   pushed down the screen to make room for it.
3. **Cut anything that repeats the title, the field label, or the button next
   to it.** Two labels for one fact do not reinforce each other.
4. **Keep text that carries a fact the reader cannot get from the screen
   itself**: the figure currently in force, the state of the data right now, a
   consequence that cannot be undone, a warning that something is already
   printed or has already departed.
5. **The test when unsure** — if this sentence disappeared, could the officer
   make a mistake that costs something? If not, cut it. "They might not know
   how it works" is not a cost; they will after the first time.
6. **Explain in code comments and migration headers, not on screen.** Those are
   read by whoever maintains the thing, which is exactly the audience an
   explanation is for. Section 6.3 asks for generous documentation — it means
   there, not in the interface.
7. **Weight explanation by how often a screen is used, not by a fixed budget
   per screen.** The registration form is the exception that proves the rule: a
   pembina fills it once, has had no training, and has nobody to ask.
8. **A name that already says what the thing is needs no gloss.** "Pendaftaran"
   does not need "buka form pendaftaran" beneath it, and "Keberangkatan" does
   not need a list of what happens there. If the term is clear, the interface
   is finished.
9. **This applies hardest to domain vocabulary.** Section 5.3 keeps `regu`,
   `kloter`, `nomor dada`, `Penggalang` and `Penegak` untranslated precisely
   because panitia and pembina say those words every day. Explaining them back
   to the people who use them is the same mistake as translating them —
   glossing "Penggalang PA" as "SMP / MTs — putra" on the registration form was
   caught and removed for exactly this reason. Explain a term only where the
   reader genuinely cannot have met it before.

## 10. Keberangkatan

1. **The window is 07:00 to 10:00.** No kloter leaves before seven, and the
   last one is away by ten. Everything below follows from that being three
   hours for however many kloter the edition has.
2. **The morning starts with an upacara, and an official sends off the first
   kloter for the photographs.** That is not a delay to be engineered away —
   it is the reason the event has a start line worth photographing. Plan the
   schedule around it rather than against it.
3. **Nobody dispatches everyone at once.** Three kloter are held ready and the
   rest are in the ceremony:
   - Kloter 1 at Pemberangkatan
   - Kloter 2 at Staging 1
   - Kloter 3 at Staging 2
4. **In the ceremony formation the order is reversed.** The last kloter stands
   at the front, and the early ones — 4, 5, 6 — stand at the back. They are
   the next to be called, and standing at the back puts them nearest the way
   out, so they peel off without walking through the whole formation. A
   formation ordered 4, 5, 6 at the front looks tidier and costs several
   minutes per kloter for the rest of the morning.
5. **The system estimates a departure time for every kloter, spread across the
   window.** Panitia and pembina both plan their morning from it, and "kloter
   9, kira-kira 08:45" is the answer to the question they actually ask.
6. **An estimate is never a record.** `kloter.jam_berangkat` is typed by the
   recorder from a real clock at a real moment (alur 12.4) and it is what
   penalties are computed from. The estimate exists to plan the morning; the
   two must never be stored in the same column, and a screen showing both must
   say which is which.
7. **07:00 and 10:00 are configuration, not constants.** They belong beside
   the other per-edition numbers, for the same reason as section 6.4 of
   rancangan-b: next year's panitia change the window without touching code.

## 11. Pos, lomba, penilaian

1. **Three levels, not two.** A pos holds several lomba; a lomba holds one or
   more penilaian. Most of the system only ever modelled two — `pos` and
   `wahana` — and every place that treats a wahana as a lomba is wrong in the
   same way.
2. **Pos 3 has two lomba, not seven.**
   - **Pembidaian** — Diagnosis dan Penanganan Awal `0–20`, Posisi Bidai
     `0–20`, Teknik Bidai `0–20`, Kerapihan dan Kebersihan `0–20`, Kecepatan
     dan Kerja Sama `0–20`
   - **KIM** — KIM Lihat `0–10`, KIM Cium `0–10`
3. **Pos 4 is one lomba, PBB** — Sikap Sempurna `0–20`, Gerakan Dasar `0–30`,
   Kekompakan `0–30`, Kerapihan `0–20`.
4. **Pos 5 is one lomba, Yel-Yel** — Kreativitas `0–35`, Kekompakan `0–25`,
   Semangat `0–20`, Penampilan `0–20`.
5. **One lomba is one form per lomba.** Pos 3 prints two blangko masters, not
   seven; Pos 4 prints one, not four. A regu is judged once at a lomba and the
   judge writes every criterion on the sheet in front of them — a sheet per
   criterion would have the same regu handed five pieces of paper at one
   station.
6. **The screen is the other way round: one column per penilaian.** Bidai is
   five columns on the pos sheet and one sheet on paper, and both are correct.
   Do not "fix" one to match the other.
7. **The lomba level is `wahana.lomba`** (migration `0054`). `NULL` means the
   component is its own lomba, which is right for most rows — Semaphore,
   Menaksir, Bakiak — so only grouped components carry a value. Read it as
   `coalesce(lomba, name)`; `kelompokLomba()` in `app.js` does exactly that.
   Do **not** go back to splitting the `kode` prefix: `bidai_`, `kim_`, `pbb_`,
   `yel_` are a naming habit that nothing enforces, and it works right up until
   an edition names two unrelated components with the same first word.
8. **`wahana.golongan` is a different axis and must not be confused with
   this.** Several wahana rows can be one penilaian offered to different
   golongan — that is what `kolomPos()` merges by name. Grouping by lomba is a
   third thing on top, and doing both with one mechanism is how Tebak Simpul
   ends up as four columns again.

## 12. Kloter

1. **Kloter tidak pernah tertutup untuk penambahan regu.** Bukan tanda
   cetaknya, bukan juga jam berangkatnya — tidak ada keadaan yang membuat
   sebuah kloter menolak regu baru. Yang membatasi cuma kapasitas. Mencetak
   ulang selembar daftar itu murah; memberangkatkan kloter dengan empat tempat
   kosong tidak bisa diulang, dan jendela 07:00-10:00 di bagian 10 tidak punya
   kelonggaran untuk itu.
2. **Selalu isi kloter paling awal dulu sampai penuh**, bukan menyebar rata.
   Kloter 1 penuh sebelum kloter 2 dipakai. Yang berangkat pagi harus berangkat
   penuh; tempat kosong yang tertinggal di kloter awal berarti kloter terakhir
   berangkat lebih siang dari yang perlu, dan jendela 07:00–10:00 di bagian 10
   tidak punya kelonggaran untuk itu.
3. **Di lapangan semua dinamis, dan itu yang membuat butir 1 sekeras itu.**
   Peserta yang terlambat bisa memaksa berangkat, dan panitia menambahkannya di
   depan — "mereka seakan-akan berangkat di jam tersebut". Sistem yang menolak
   tidak menghentikan penambahan itu; ia cuma memindahkannya ke jalan yang
   tidak tercatat.

   Konsekuensi yang perlu diketahui panitia yang menyisipkan: penalti waktu
   dihitung dari `kloter.jam_berangkat`, jadi regu yang masuk ke kloter yang
   sudah berangkat dihitung berangkat pada jam kloter itu — bukan jam ia
   benar-benar jalan. Kalau maksudnya regu itu berangkat sekarang, tempatnya di
   kloter yang belum jalan.

   Riwayatnya, karena mudah dipasang kembali: migrasi 0008 menambahkan
   `dicetak_pada is null` ke pemilihan kloter beserta trigger
   `jaga_kloter_tercetak`; 0040 mengembalikannya setelah sempat hilang;
   **0066 membuang keduanya beserta `jam_berangkat is null`**. Ketiganya
   ditulis dengan niat melindungi kertas yang sudah dibagikan — niat yang
   masuk akal di meja, dan salah di lapangan. Jangan dipasang lagi.
4. **"Bersihkan data" termasuk mengembalikan penomoran kloter ke 1**, bukan
   hanya menghapus regu dan nilai. Kloter yang masih menyandang tanda cetak atau
   jam berangkat dari percobaan sebelumnya membuat pembagian berikutnya mulai
   dari tengah — produksi sempat mulai dari kloter 17 karena 24 kloter pertama
   masih bertanda tercetak, dan papan seperti itu membuat panitia mencari
   keenam belas kloter yang tidak pernah ada.
5. **Satu sekolah tidak boleh berangkat bareng di kloter yang sama.** Regu
   dari sekolah yang sama disebar — `daftar_ulang_batch` sudah menjaganya, dan
   jarak antar kloternya ditentukan `lompatan_kloter` (2 di edisi 37, jadi tiga
   regu satu sekolah mendarat di kloter 1, 3, 5). Aturan ini melunak, bukan
   putus, kalau kloter benar-benar habis — "sesedikit mungkin", bukan "tidak
   boleh".
6. **Jangan menomori kloter sendiri.** Penomoran menyimpan aturan yang tidak
   kelihatan dari nomornya: butir 5 di atas dijaga di dalam
   `daftar_ulang_batch`, bukan oleh urutan nomor dada. Skrip contoh sempat
   menomori ulang dengan `ceil(row_number/10)` dan mendaratkan MTs Rancah
   bertiga di kloter 1. Kalau kloter perlu disusun ulang, bersihkan lalu
   jalankan ulang alurnya — jangan tulis nomornya langsung.
7. **Satu sekolah, satu baris `sekolah`, dan kuncinya NAMA.** Sampai migrasi
   0061 `submit_pendaftaran` mencari sekolahnya dengan pasangan
   **(nama, alamat) persis**, jadi beda satu koma, beda `Jl.` dan `Jln.`, beda
   spasi melahirkan baris baru dengan id baru — `SMPN 1 CIAMIS` sempat muncul
   tiga kali di kotak pilihan pendaftaran, `SMPN 2 CIPAKU` empat kali. Sekarang
   kuncinya `unique (kunci_sekolah(name))` dan pencariannya lewat nama.
   **Alamat yang diketik pembina tidak lagi melahirkan baris baru, dan juga
   tidak menimpa alamat kurasi** — ia sedang mendaftarkan regu, bukan sedang
   memperbaiki data kita.
8. **Yang membedakan dua sekolah senama adalah NPSN, dan pembedanya ditulis
   di dalam nama.** `unique (nama, alamat)` di 0001 memakai alamat sebagai
   pembeda supaya dua sekolah senama di tempat berbeda bisa berdampingan
   (alur 3.2.2) — niatnya benar, mekanismenya terlalu harfiah: ia tidak bisa
   membedakan "sekolah yang sama, alamatnya diketik lebih sembarangan" dari
   "sekolah lain di tempat lain". Gantinya nama itu sendiri yang dibuat
   membedakan: `MAN 3 Ciamis` dan `MAN 3 Tasikmalaya`, karena NPSN-nya berbeda.
   Berlaku dua arah — kalau tidak ada tabrakan, JANGAN tambahkan ekor;
   `MAN Darussalam` cuma ada satu dan tetap polos.
9. **Kenapa ini butir kloter, bukan butir data.** Butir 5 berhenti berlaku di
   antara baris-baris kembar: mereka terbaca sebagai sekolah berlainan, jadi
   regunya BERANGKAT BARENG tanpa satu pun pesan galat. Itu yang benar-benar
   terjadi di data contoh — empat baris SMPN 2 Cipaku, empat "sekolah". Kalau
   suatu hari kunci sekolah dilonggarkan lagi, inilah yang rusak duluan dan
   paling terakhir ketahuan.
10. **Jangan tertukar antara dua kunci penyamaan nama sekolah.**
    `kunci_sekolah()` di database sengaja JINAK — ia menolak baris tanpa ada
    yang memeriksa, jadi ia hanya menyamakan yang pasti sama (besar-kecil
    huruf, tanda baca, `SMP Negeri`~`SMPN`, huruf status Dapodik). `kunci()`
    di `tools/normalize_sekolah.py` jauh lebih agresif karena tugasnya
    menggabungkan tulisan tangan dan hasilnya dibaca manusia. Memakai yang
    jinak untuk mencocokkan ke daftar kurasi meloloskan enam sekolah tanpa
    dibakukan; memakai yang agresif sebagai kunci database akan melebur dua
    sekolah yang berbeda. Rinciannya di `docs/runbook-sekolah.md` bagian 12.

## 13. Hak akses

1. **Yang menjaga pintu adalah `boleh(fitur)`, bukan `peran()`.** Matriks
   centang di layar Akun (`akun_hak`) adalah satu-satunya sumbernya; `peran`
   cuma mengisi centang awal lewat `paket_peran()`. Sejak migrasi 0064 seluruh
   policy dan RPC memakai `boleh()`, dan menambahkan perbandingan `peran() =
   '...'` yang baru berarti mengembalikan dua mekanisme untuk satu pertanyaan
   — yang satu bisa diubah panitia, yang satu tidak.
2. **Empat peran: `admin`, `registrasi`, `gerbang`, `juri_pos`.** Nama lama
   `meja` dan `operator_pos` sudah tidak ada sejak 0058. Kalau menemukan
   keduanya di kode, itu bukan gaya lama — itu **kode mati yang tidak cocok
   dengan siapa pun**, dan setiap satu di antaranya adalah satu layar yang
   lumpuh.
3. **Pemeriksaan yang cakupannya lebih sempit daripada masalahnya lebih
   berbahaya daripada tidak ada pemeriksaan.** 0064 memindai `pg_policies` dan
   `pg_proc` lalu melapor bersih — dan enam VIEW lolos karena view bukan
   keduanya. 0065 menambahkan `pg_views`, lalu melapor bersih — dan
   `v_klasemen_live_score` lolos lagi karena ia menyaring `peran() = 'admin'`,
   yang tidak mengandung nama peran lama yang dicari. Dua laporan hijau, dua
   layar kosong di lapangan.
4. **Yang dulu hanya admin dipetakan ke `pengaturan`, bukan ke fitur ubin yang
   namanya mirip.** Membatalkan keberangkatan bukan pekerjaan yang tiba-tiba
   boleh dilakukan petugas gerbang karena kolomnya kebetulan bernama
   "Keberangkatan".
5. **Membaca data operasional = jadi panitia; melakukan sesuatu = per fitur.**
   Dua puluh policy `sel_*` sengaja tetap berbunyi `peran() is not null`:
   `regu`, `kloter`, dan `edisi` dibaca hampir setiap layar, dan mengikatnya ke
   satu fitur akan mematikan layar lain yang kebetulan juga membacanya.
6. **Isolasi pos berlaku pada MENULIS, tidak lagi pada membaca.** `v_lembar_pos`
   dan `simpan_nilai_massal` tetap mengunci juri pos ke posnya sendiri. Sejak
   0069 rincian Live Score dibuka untuk semua pemegang `live_score` — keputusan
   pemilik acara, dan konsekuensinya juri Pos 3 bisa melihat angka Pos 1
   sebelum diumumkan.
7. **Rantai view Live Score `security_invoker`, dan itu yang membuat papan
   panitia perlu fungsi `security definer` sebagai alasnya.** Membukanya lewat
   RLS akan menuntut juri pos boleh membaca `nilai_mentah` seluruh pos dan
   `pendaftaran` beserta nomor WA pembina. `klasemen_live_score()` mengeluarkan
   AGREGAT saja dan menjaga haknya sendiri. Membuang `security_invoker` dari
   view terluar TIDAK cukup — yang di dalamnya tetap berlaku.
8. **Tes yang benar menempati kursi, bukan memindai nama.** Jalankan panggilan
   yang sama dua kali dan ubah satu baris `akun_hak` di antaranya; kalau pesan
   galatnya tidak berubah, pagarnya tidak ada. Tes 30-36 semuanya berbentuk
   begitu.

---

## 14. Fase live

1. **Tiga fase, dan artinya di layar peserta:**
   - `pra` — peserta tidak melihat apa pun selain ajakan mendaftar
   - `progres` — peserta melihat CENTANG per komponen, bukan nilainya
   - `penuh` — peserta melihat yang sama dengan panitia
2. **Saklarnya di layar Live Score panitia**, hanya untuk pemegang
   `pengaturan`, lewat RPC `atur_fase_live`.
3. **Mematikan seketika, menyalakan tetap lewat penerbitan.** Halaman peserta
   membaca fase langsung dari database tiap 15 detik (dan seketika begitu HP
   dibuka lagi), tapi ia hanya boleh MEMPERKETAT — tidak pernah menampilkan
   lebih dari isi berkas yang sudah terbit.
4. **Sebabnya bukan kemalasan.** `rekap.json` duduk di CDN dan bisa diminta
   siapa pun yang tahu alamatnya. Satu-satunya jaminan bahwa nilai belum bocor
   adalah nilainya MEMANG TIDAK ADA di berkas itu — bukan ada tapi tidak
   digambar. `publish-live.yml` punya empat pagar "BOCOR" yang menegakkan itu,
   dan tidak satu pun boleh dilonggarkan demi kenyamanan tampilan.
5. **`komponen_terisi` boleh terbit sejak `progres`; `nilai` hanya di
   `penuh`** (migrasi 0072). Centang tidak menyebut satu angka pun, jadi ia
   aman terbit lebih awal — dan itulah yang membuat "masking" di halaman
   peserta bukan sekadar tirai.
6. **`UPDATE` tanpa `WHERE` ditolak Supabase.** Ekstensi `safeupdate` aktif di
   produksi tapi TIDAK ada di database uji, jadi tes lokal bisa hijau
   sementara RPC-nya gagal di layar. Tulis `WHERE` yang memang berarti.

---

## 15. CSS tabel: dari layar lebar sampai HP

1. **Setiap tabel data melewati TIGA rentang, bukan dua.** Meja Pembayaran dan
   Meja Daftar Ulang dua-duanya begitu, dan aturan yang benar di satu rentang
   bisa merusak yang lain:
   - **≤ 900px** — barisnya bukan tabel lagi melainkan **kartu**
     (`.data-table:not(.table-tetap) … { display: block }`). Patokan lebar
     kolom tidak berarti apa pun di sini.
   - **901–940px** — tabel `auto`. Lebar diserahkan ke isinya; blok
     `@media (min-width: 901px) and (max-width: 940px)` yang mengaturnya.
   - **≥ 941px** — tabel `fixed`, dipasangkan dengan tabel rinciannya.
2. **Contoh yang benar adalah Meja Pembayaran, tiru bentuknya.** Induk enam
   kolom `18/24/6/12/15/25`, rincian lima kolom `18/24/18/15/25`. Dua-duanya
   berjumlah **100**, kolom pertamanya bertemu di 18% dan kolom terakhirnya di
   25% — itulah yang membuat angka rupiah tiap regu jatuh tepat di bawah
   tombol "Tandai Lunas". Kolom di antaranya boleh berbeda; yang harus
   bertemu cuma yang berpasangan.
3. **Di bawah `table-layout: fixed`, kolom yang tidak dipatok dapat NOL —
   bukan sisanya.** Ini kebalikan dari `auto`, dan itulah jebakan yang paling
   sering kena: menambah satu kolom tanpa menambah persentasenya membuat
   kolom itu selebar nol dan isinya meluap keluar tabel. Kolom "Tukar nomor
   rusak" di Meja Daftar Ulang persis begitu — terukur `170/550/280/0` px,
   dan penggulir mendatar muncul bahkan di layar 1920px.
4. **Dua tabel hanya sejajar kalau jumlah kolomnya SAMA.** Kalau induknya
   punya kolom yang tidak ada di rincian, beri rincian satu **sel kosong**
   (`<td class="kol-imbang">`) dan sembunyikan di bawah 941px. Menyiasatinya
   dengan `width` yang tidak berjumlah 100% tidak bekerja: sisa lebarnya
   dibagi rata ke semua kolom, dan pasangannya bergeser.
5. **Tabel rincian bersarang DI DALAM tabel induk, jadi selektor keturunan
   bocor.** `.table-daftar-ulang th:nth-child(3)` juga mengenai kolom ketiga
   tabel rincian, dan yang menang cuma ditentukan urutan baris di berkas.
   Tulis rantai anak — `.table-induk > thead > tr > th:nth-child(3)` — untuk
   setiap patokan lebar dan perataan. Di bawah `fixed` cukup baris kepalanya:
   hanya baris pertama yang menentukan lebar kolom.
6. **Selektor yang sama persis, di media query yang sama, dua kali = yang
   belakangan menang tanpa suara.** Kartu HP Meja Daftar Ulang sempat punya
   blok `display: flex` yang tidak pernah berlaku sedetik pun, karena 160
   baris di bawahnya ada blok `display: grid` dengan selektor yang sama.
   Dua-duanya terbaca benar sendiri-sendiri, dan tidak ada galat apa pun.
   Sekarang tinggal satu blok. Sebelum menambah blok baru, **cari dulu
   selektor itu di seluruh berkas.**
7. **Kartu HP juga meniru Meja Pembayaran: grid dua kolom
   `max-content 1fr`** — kode pembayaran di kiri, nama sekolah di kanan.
   Kolom kiri selebar kode, yang panjangnya selalu sama, jadi nama sekolah
   berbaris lurus dari kartu ke kartu dan yang panjang membungkus DI DALAM
   kolomnya. Dengan flex ia mengalir tepat di sebelah kodenya dan tepi
   kirinya berpindah-pindah. **Syaratnya tiap sel diberi `grid-area`
   sendiri** — sel yang lupa ditempatkan ikut penempatan otomatis dan
   menumpuk sel lain, dan itulah tombol Tukar yang dulu tercetak di atas pil
   nomor dada. Grid tidak pernah jadi masalahnya; sel yang tidak ditempatkan
   yang jadi masalah.
8. **Aturan lebar di luar media query berlaku di rentang yang mungkin tidak
   dimaksud.** `width: 1%` untuk kolom Sekolah dulu tidak terpakai di rentang
   kartu, berarti harfiah 1% di rentang `fixed`, dan di rentang 901–940 justru
   **mengalahkan** `width: auto` milik blok itu sendiri karena kekhususannya
   lebih tinggi — nama sekolah menyusut jadi 94px dan patah empat baris. Satu
   aturan, tiga rentang, tidak satu pun terbantu.
9. **Aturan CSS baru WAJIB diukur, bukan dibaca.** Menambah satu baris CSS
   terasa seperti perubahan yang pasti jadi, dan justru itu yang membuatnya
   jarang dicek. Lima kali dalam satu hari aturannya ada, terbaca benar, dan
   tidak mengenai apa pun. Yang menyelesaikan semuanya adalah mengukur di
   browser.
10. **Cara mengukurnya, dan ini murah.** Buat satu halaman contoh berisi markup
   tabelnya (baris terpanjang, rincian terbuka, nama sekolah terpanjang di
   data sungguhan), sajikan dengan `python -m http.server`, lalu muat di dalam
   **iframe** dan ubah-ubah lebar iframe-nya. Media query membaca lebar
   iframe, jadi seluruh rentang bisa disapu tanpa mengubah ukuran jendela —
   termasuk lebar HP yang tidak bisa dicapai jendela browser. Yang diperiksa:
   - `wrapper.scrollWidth > wrapper.clientWidth` — ada penggulir mendatar
   - `td.scrollWidth > td.clientWidth` — isi sel meluap
   - jarak kiri kotak isian vs tombol pasangannya — harus 0
   - kotak yang saling tembus, dibandingkan dari `getBoundingClientRect()`
11. **Persentase kolom diambil dari isi terpanjang di data sungguhan, bukan
    dari perasaan.** Ukur `max-content` tiap sel di browser lebih dulu, lalu
    periksa angkanya di tabel TERSEMPIT yang mungkin di rentang itu — untuk
    blok `≥ 941px` itu ~869px, saat ambangnya baru saja terlewat. Kode bayar
    140px dan tombol Tukar 151px yang menentukan 18% dan 20%, bukan
    sebaliknya.
12. **Kalau sebuah aturan tidak berlaku, jangan menambah aturan untuk
    membatalkannya.** Empat kali berturut-turut hal itu dicoba di tabel yang
    sama dan tidak satu pun mengubah apa-apa, karena yang salah bukan nilainya
    melainkan kekhususan, urutan, atau rentangnya. Cari aturan yang menang
    lebih dulu — di browser, lewat `el.matches(r.selectorText)` atas seluruh
    `document.styleSheets`.
