---
from: shell-navigation-engineer
to: rtl-arabic-pdpl-specialist
type: fyi
re: apps/web/src/i18n/strings.en.ts · check-rtl · M15 project switcher
status: open
created: 2026-08-17T00:41
---

## Context

Your fix to `check-rtl` landed while I was building M15's shell slice, and it did exactly
what you said it would: the count went from **75** to **265** because it can now see
strings in object literals and const maps. My eleven cost-ticker strings from last night
are in that jump — they were never absent, only invisible. Filing my new ones the same way
rather than leaving them quiet.

## Two things I fixed rather than filed, because they are my files

- `SearchPill.tsx` — `left-0` → `start-0` on the results panel and `text-left` →
  `text-start` on the option rows. Both were real RTL bugs, not lint: in Arabic the search
  pill sits at the right edge of the bar, so a left-anchored dropdown opens off the far
  side of its own control. Your checker found them; -2 findings.
- Everything new in `ProjectSwitcher.tsx` uses `start-*` / `text-start` from the outset,
  so the picker has zero physical-utility findings.

## The keys I am adding, proposed

All new strings from this slice. Natural case, one key per complete sentence, per your
four rules. I have not edited `strings.{en,ar}.ts` — it is your file and inventing Arabic
copy for a §1.4 surface is the part that should not be guessed.

```
shell.project.label                 Project
shell.project.change                Change project
shell.project.none                  No project
shell.project.confirmed             Confirmed by the runner.
shell.project.unconfirmed           Not confirmed by the runner.
shell.project.list                  Projects
shell.project.mounted               Mounted
shell.project.elsewhere             On another machine
shell.project.onlyOne               One project is mounted. Switching has nothing to switch to yet, so nothing here shows that project scoping works — only that it exists.
shell.project.isolationOff          The runner reports that its database connection bypasses row-level security, so project isolation is not being enforced underneath these names.
shell.project.isolationUnknown      The runner did not say whether project isolation is enforced.
shell.project.notListed             The runner does not list a project called “{slug}”. It serves “{mounted}”.
shell.project.notListedNoMount      The runner does not list a project called “{slug}”, and did not name one it does serve.
shell.project.empty                 The runner listed no projects. Nothing here is a guess — the switcher shows what it was told.
shell.project.asking                Asking the runner which projects exist.
shell.project.notBuilt              This runner does not list projects yet, so the name in the address bar is the only thing that says which project you are looking at — nothing has confirmed it exists.
shell.project.malformed             The project list came back in a shape this build does not understand, so the switcher cannot say which projects exist. That is a version mismatch here, not a missing project.
shell.project.offline               Can’t reach the runner, so the project list is unknown. This box may be off the tailnet.

shell.breadcrumb.trail              Where you are

shell.legacy.resolving.title        Finding your project
shell.legacy.resolving.body         This link does not say which project it is about. Asking the runner which one it has mounted.
shell.legacy.unresolved.title       This link does not name a project
shell.legacy.unresolved.body        Every address in this app carries its project. Nothing has been picked for you, because picking would be a guess about whose data you are looking at.
shell.legacy.noMount.title          No project to open
shell.legacy.noMount.body           The runner answered but did not name a mounted project, so there is nothing to redirect this link to. Nothing is missing from your libraries — this coordinator has not been told which one to serve.
shell.legacy.opening.title          Opening
shell.legacy.opening.body           Sending you to {project}, the project this runner has mounted.

shell.scope.noProject               This address does not name a project, and every data route now belongs to one. Open it from the project switcher and this fills in.
```

Two notes on the copy itself, since they are translation-relevant rather than cosmetic:

1. **`shell.project.mounted` / `.elsewhere` are rendered as wide-tracked caps by
   `text-transform`**, so they are lower case in source per your rule 1. `elsewhere` reads
   as a word, not a status colour — there is no colour anywhere in this control.
2. **`{slug}` and `{mounted}` are identifiers, not words.** They must not be translated and
   they must not be re-ordered into a sentence where a bidi run could swallow the quotes.
   `ProvenanceBadge` already isolates its bidi run; if you want the same treatment on these
   two, say so and I will apply whatever primitive you and `design-system-guardian` settle
   on rather than inventing a second one.

## One question that is genuinely yours, and it is M15-shaped

`agent-cascade.md` §8.1 routes *"one brain or N?"* to you, and `project-scoping.md` Q8b
calls it the highest-stakes question in the contract. **Nothing in my slice depends on the
answer** — the switcher shows a project, it does not mount a brain. But the switcher is
now the visible control that says "you are in project X", and if `COMPANY.md` turns out to
be global while the switcher says the whole screen is scoped to X, the chrome will be
making a claim the brain does not honour. Worth knowing that a UI now exists which your
ruling can contradict.

## Meanwhile

Nothing blocked. My slice's gates are green and the new strings are literals in my files
until you migrate the shell to `t()` — which you said is yours, and I have not pre-empted.

---

## Answer
