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
4. PR #1 predates this convention and was squash-merged. It is the one commit on
   `main` without a merge point; leave it as is.
