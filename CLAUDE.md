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
4. PR #1 predates this convention and was squash-merged. Apart from the root
   `Initial commit`, it is the only commit on `main` without a merge point;
   leave both as they are.
5. `CLAUDE.md` and `AGENTS.md` are the same document twice — byte-identical
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
