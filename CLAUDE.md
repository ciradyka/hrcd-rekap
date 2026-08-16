# CLAUDE.md

Guidance for Claude Code when working in this repository.

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

1. **Kloter tercetak masih boleh diisi selama belum berangkat.** Mencetak
   daftar bukan penutupan; yang menutup sebuah kloter adalah `jam_berangkat`-nya
   terisi. Sekolah yang daftar ulang setelah kertas dicetak tetap masuk ke
   kloter paling awal yang masih longgar, dan kertasnya dicetak ulang — itu
   murah, dan jauh lebih murah daripada kloter setengah kosong berangkat.
2. **Selalu isi kloter paling awal dulu sampai penuh**, bukan menyebar rata.
   Kloter 1 penuh sebelum kloter 2 dipakai. Yang berangkat pagi harus berangkat
   penuh; tempat kosong yang tertinggal di kloter awal berarti kloter terakhir
   berangkat lebih siang dari yang perlu, dan jendela 07:00–10:00 di bagian 10
   tidak punya kelonggaran untuk itu.
3. **Kode hari ini melanggar butir 1, dan itu belum diperbaiki.** Migrasi 0008
   menambahkan syarat `dicetak_pada is null` ke pemilihan kloter beserta trigger
   yang menolak penambahan ke kloter tercetak; 0040 mengembalikannya setelah
   sempat hilang. Keduanya ditulis dengan niat melindungi kertas yang sudah
   dibagikan — tapi niat itu bukan aturan lapangan. Perbaikannya: ganti
   syaratnya jadi `jam_berangkat is null`.
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
7. **Satu sekolah, satu baris `sekolah` — dan database belum menjaminnya.**
   `submit_pendaftaran` mencari sekolahnya dengan pasangan **(nama, alamat)
   persis**:

   ```sql
   insert into sekolah (nama, alamat) values (trim(p_nama_sekolah), trim(p_alamat_sekolah))
   on conflict (nama, alamat) do nothing;
   select id into v_sekolah from sekolah where nama = ... and alamat = ...;
   ```

   Beda satu koma, beda `Jl.` dan `Jln.`, beda spasi — lahir baris baru dengan
   id baru. `unique (nama, alamat)` di 0001 memang disengaja, supaya dua
   sekolah senama di tempat berbeda bisa hidup berdampingan (SMPN 1 Purwadadi
   ada di Ciamis DAN di Subang). Niatnya benar; mekanismenya terlalu harfiah —
   ia tidak bisa membedakan "sekolah yang sama, alamatnya diketik lebih
   sembarangan" dari "sekolah lain di tempat lain".
8. **Akibatnya menembus ke kloter, dan itu yang paling mahal.** Butir 5
   berhenti berlaku di antara baris-baris kembar itu: mereka terbaca sebagai
   sekolah berlainan, jadi regunya BERANGKAT BARENG tanpa satu pun pesan
   galat. Lembar edisi lama menulis alamat SMPN 2 CIPAKU dengan empat ejaan
   berbeda; di data contoh itu melahirkan empat baris sekolah sekaligus.
   `docs/runbook-sekolah.md` bagian 11 sudah meminta pagar kembar dipasang
   sebelum tabel `sekolah` diisi — obatnya sama dengan `nama_regu` di migrasi
   0051: unique index atas nama yang dinormalisasi. Yang belum tercatat di
   sana adalah akibat ini.
