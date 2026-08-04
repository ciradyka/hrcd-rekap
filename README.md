# HRCD Rekap

> Status: scaffolding. The project's scope and stack are not yet decided.

## Getting started

Not applicable yet — no application code has been added.

## Repository layout

```
.
├── .gitignore
└── README.md
```

## Contributing

Work happens on branches off `main` and lands via pull request.

```bash
git checkout -b <type>/<short-description>
# ...make changes...
git commit -m "<type>: <what changed>"
git push -u origin HEAD
gh pr create --fill
```

### Merging

PRs are merged with a **merge commit** (`--no-ff`), never squashed or rebased, so
every PR stays a distinct merge point in `main`'s history. The merge commit
subject is the PR title followed by the PR number:

```bash
gh pr merge <number> --merge --subject "<PR title> (#<number>)" --delete-branch
```

Omitting `--subject` lets GitHub write `Merge pull request #N from <branch>`
instead, which buries the title — so always pass it.
