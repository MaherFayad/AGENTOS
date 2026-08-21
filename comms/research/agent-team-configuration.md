# Configuring four product agent teams — a research reference

**Date:** 2026-08-22 · **Author:** research dispatch · **Status:** reference, not a decision
**Subject:** how to decompose, brief, wire, tier and gate the four agents in
`agents/product/` — `ux-researcher`, `product-designer`, `frontend-engineer`,
`project-orchestrator`.

This is a reference document about configuring agent teams. It is not a plan for this
repository and it does not claim a decision; where it recommends something, the
recommendation is marked and the evidence behind it is graded.

## How to read the evidence grades

Every claim below carries one of these:

| Grade | Meaning |
|---|---|
| **[P]** | **Primary documentation** — the vendor's own spec/API/docs for their own product. Reliable about *what exists*, not about *whether it works well*. |
| **[R]** | **Peer-reviewed or preprint research**, or a measured report with a published method. Reliable about the thing it measured, in the conditions it measured. |
| **[E]** | **Engineering report from a team that shipped it** — a vendor engineering blog describing their own production system. Better than marketing, still self-interested. |
| **[O]** | **Opinion / practitioner blog.** One person's experience. Directionally useful, not evidence. |
| **[?]** | **Unverified.** Named because you will hear it named; could not be confirmed. Do not act on it. |

Three things in this document are genuinely unsettled and are marked as such in place:
the reliability of LLM qualitative coding, the delegability of design judgement, and
whether multi-agent decomposition helps or hurts. Each has real evidence pointing both
ways.

---

# 1. Decomposition — what an agent-sized unit of work actually is

## 1.1 The field is openly split, and both sides shipped

The two most-cited engineering posts on this were published **one day apart in June 2025
and reach opposite conclusions.**

**Anthropic, 13 June 2025 [E]** — [How we built our multi-agent research
system](https://www.anthropic.com/engineering/multi-agent-research-system). An
orchestrator-worker system (lead agent + parallel subagents + a separate citation pass)
beat single-agent Claude Opus 4 by **90.2%** on their internal research eval. It costs
**~15x the tokens** of a chat interaction, and **~80% of the performance variance on
BrowseComp was explained by token spend alone**. Their own scoping rule: *"Simple
fact-finding requires just 1 agent with 3-10 tool calls, direct comparisons might need
2-4 subagents… complex research might use more than 10 subagents with clearly divided
responsibilities."* Crucially they name where it does **not** work: *"domains that
require all agents to share the same context or involve many dependencies between
agents"* — and they name **coding** as exactly that domain.

**Cognition (Walden Yan), 12 June 2025 [E]** — [Don't Build
Multi-Agents](https://cognition.com/blog/dont-build-multi-agents). Two principles:
*"Share context, and share full agent traces, not just individual messages"* and
*"Actions carry implicit decisions, and conflicting decisions carry bad results."* The
worked failure is a Flappy Bird clone split across two subagents: one builds a Super
Mario–styled background, the other an inconsistent bird, and the joining agent has to
reconcile two incompatible halves. Neither ever saw the other's work.

These are not actually contradictory. Read together they give a usable rule:

> **Decompose along the axis where the sub-tasks do not need to see each other's
> decisions. Refuse to decompose along any axis where they do.**

Anthropic's research subagents each go and read *different documents* — the decisions
don't collide. Cognition's coding subagents each make *aesthetic and interface
decisions about the same artefact* — the decisions collide constantly.

## 1.2 What the failure data says

**[R] Cemri et al., "Why Do Multi-Agent LLM Systems Fail?"** (UC Berkeley, arXiv
[2503.13657](https://arxiv.org/abs/2503.13657), March 2025; NeurIPS 2025). 1,600+
annotated traces across 7 multi-agent frameworks produced **MAST**, a taxonomy of 14
failure modes in 3 categories. The published distribution:

| Category | Share of failures |
|---|---|
| Specification issues (bad role/task definition) | ~41.8% |
| Inter-agent misalignment (agents ignoring or contradicting each other) | ~36.9% |
| Task verification (nobody checked the output) | ~21.3% |

**Roughly four fifths of multi-agent failures are the humans' fault at design time, not
the model's fault at run time.** Specification and verification are both things a
`SKILL.md` file can fix. This is the single most actionable finding in this document:
the frontmatter and the body of the agent file *are* the fix for ~63% of the failure
surface, and a review gate is the fix for another ~21%.

**[R] TheAgentCompany** (CMU, arXiv [2412.14161](https://arxiv.org/abs/2412.14161),
NeurIPS 2025 Datasets & Benchmarks) — 175 real workplace tasks in a simulated company
with GitLab, ownCloud, RocketChat and Plane, spanning software engineering, project
management, HR, finance and admin. Best reported model completes roughly **30%** of
tasks end to end. Note the caveat: this is *full-task autonomous* completion of
consequential multi-tool office work, which is precisely the regime `tier: autonomous`
claims. It is the most honest number available for "can an agent run a piece of product
work unattended", and it is 30%. **It is also roughly fifteen months old and has no
verifiable frontier-2026 re-run** — see §4.6.

**[R] "How Many Instructions Can LLMs Follow at Once?"** (Jaroslawicz, Whiting, Shah,
Maamari; arXiv [2507.11538](https://arxiv.org/abs/2507.11538), July 2025), benchmark
**IFScale**. At 500 simultaneous instructions the best frontier models reach only
**68% accuracy**, with a measured **primacy bias** — instructions given earlier are
followed more reliably than instructions given later. Directly relevant to how long a
`SKILL.md` body and its ref files may be (see §2.1).

## 1.3 The three decomposition axes

There are three ways to cut product work into agents, and they are not equally good.

**Per role (what this repo did).** One agent per discipline: researcher, designer,
engineer, orchestrator. This is the MetaGPT shape — [MetaGPT](https://arxiv.org/abs/2308.00352)
(ICLR 2024 [R]) assigns Product Manager / Architect / Engineer / Reviewer and encodes
human SOPs as prompt sequences precisely so that intermediate artefacts are checkable.
Its reported gain is modest and narrow (+4.2% Pass@1 on HumanEval, +5.4% on MBPP from
executable feedback) — the *architecture* is the contribution, not a large capability
jump.

Per-role works because **role boundaries are already the boundaries across which humans
hand off artefacts.** A designer hands a spec to an engineer; they do not need to share
a context window, they need to share a document. That is exactly Cognition's condition
for safe decomposition, satisfiable by a file rather than by a shared context.

**Per artefact.** One agent per output: brief-writer, spec-writer, diff-writer,
status-writer. Finer than per-role, and it fragments the *judgement* — the person who
specifies the empty state and the person who specifies the error state are making one
decision, not two.

**Per pipeline stage.** One agent per phase: capture → synthesise → decide → generate →
verify. This is the axis where the evidence is most supportive, because **verification
is the one role that genuinely benefits from not sharing context.** MAST puts 21.3% of
failures in "task verification". A reviewer that has seen the author's reasoning is a
worse reviewer. Anthropic's own system uses a **separate CitationAgent** for exactly
this reason.

**Recommendation:** per-role for the *primary* agents (which is what exists), plus **one
cross-cutting verifier that shares no context with the producer.** That is the highest
expected-value addition to the four-agent set — it addresses the second largest failure
category and it is the only decomposition the evidence unambiguously supports.

## 1.4 Where over-decomposition starts costing more than it returns

Four independent cost curves, all real:

1. **Token cost.** ~15x for multi-agent vs. chat, per Anthropic's own measurement [E].
   Every subagent pays full price to build a cache from scratch.
2. **Tool-choice degradation.** **[R] RAG-MCP** (Gan & Sun, arXiv
   [2505.03275](https://arxiv.org/abs/2505.03275), May 2025) measured tool-selection
   accuracy at **13.62%** on a bloated tool set, recovering to **43.13%** when tools were
   retrieved rather than all presented, with >50% fewer prompt tokens. Even the *good*
   number is 43%. Fewer tools per agent is not tidiness, it is accuracy.
3. **Instruction-following decay.** IFScale, above: 68% at 500 instructions, with
   primacy bias.
4. **Coordination failure.** MAST's 36.9% inter-agent misalignment.

Practical ceilings worth stating, with their evidence quality:

| Ceiling | Number | Grade |
|---|---|---|
| Subagents per orchestrator before coordination cost dominates | 3–5 for ordinary work; >10 only for genuinely parallel search | **[E]** Anthropic's own scoping rule |
| Tools per agent | keep it small; degradation is measurable well before 20 | **[R]** RAG-MCP measured the collapse; the specific "20 tools" threshold is **[O]** practitioner consensus, not measured |
| MCP *servers* per agent | 5–7 is the number the practitioner community repeats | **[O]** — repeated widely, no primary measurement found. Folklore with a real mechanism behind it. |

The `breaks_into` lists in the four agents (4–6 sub-capabilities each) are **the right
place for that granularity** precisely because they are *not* separate runtime agents.
They are a decomposition of the checklist, not of the context. Keep them that way.

## 1.5 What this means for the four product agents

The existing four are well-cut. Specific observations:

- **`project-orchestrator` is the highest-risk node**, and the literature agrees: MAST
  puts 41.8% of failures in specification, which is the orchestrator's output.
  Anthropic spent *"weeks watching agents fail in simulations and rewriting delegation
  prompts"* [E]. Its `tier: human-led` is correct and should not be promoted early.
- **`frontend-engineer` is the one Cognition explicitly warns about.** Anthropic names
  coding as the domain where subagent delegation fails. Its `breaks_into` list
  (component-scaffolder, token-conformer, state-wirer, accessibility-pass,
  diff-narrator) must stay a checklist inside one context — if those ever become five
  parallel runtime agents, that is the Flappy Bird failure with a design system.
- **`ux-researcher` is the one case where parallel subagents are genuinely justified**
  — N transcripts are N independent reads with no colliding decisions. This is
  Anthropic's shape exactly. If any agent here should fan out, it is this one.
- **Missing: a verifier.** There is no product-department agent whose job is to read
  another agent's output cold. `fidelity-qa-reviewer` covers UI work; nothing covers a
  research synthesis or a delivery plan.

---

# 2. Ref files — what makes an agent good rather than generic

## 2.1 The general shape, and what the evidence actually supports

**[E] Anthropic, "Effective context engineering for AI agents", 29 Sept 2025** —
[link](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents).
Four things in it bear directly on ref-file design:

- **The "right altitude" problem.** Prompts fail in two directions: *"complex, brittle
  logic"* hardcoded for edge cases, and *"vague, high-level guidance that fails to give
  the LLM concrete signals."* Aim for *"specific enough to guide behavior effectively,
  yet flexible enough to provide the model with strong heuristics."*
- **Examples beat exhaustive rules.** *"Curate a set of diverse, canonical examples that
  effectively portray the expected behavior… For an LLM, examples are the 'pictures'
  worth a thousand words."* Explicitly recommended **over** stuffing a prompt with edge
  cases.
- **Context rot.** Recall degrades as the window fills — an architectural consequence of
  every token attending to every other token. Corroborated independently by IFScale's
  measured primacy bias [R].
- **Just-in-time retrieval beats pre-loading.** *"Maintain lightweight identifiers (file
  paths, stored queries, web links, etc.) and use these references to dynamically load
  data into context at runtime using tools."*

**[E] Anthropic, "Equipping agents for the real world with Agent Skills", 16 Oct 2025** —
[link](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills).
Three-level progressive disclosure: (1) `name` + `description` only, in the system
prompt at startup; (2) the full `SKILL.md`, loaded when judged relevant; (3) bundled
files, read *only as needed*. Guidance on splitting: move content out when
*"certain contexts are mutually exclusive or rarely used together"*, and when the core
file *"becomes unwieldy"*. Note honestly: **Anthropic does not publish a line-count
threshold.** Any specific number you have seen ("keep SKILL.md under 500 lines") is
**[O]**, not primary.

**[P] AGENTS.md** — [agents.md](https://agents.md/), now stewarded by the **Agentic AI
Foundation under the Linux Foundation**, 60,000+ open-source projects. Relevant
mechanic: **nesting and nearest-file precedence** — *"place another AGENTS.md inside
each package. Agents automatically read the nearest file in the directory tree, so the
closest one takes precedence."* This is the right pattern for ref files that differ per
surface (web vs mobile, per package).

### The four rules that fall out of the above

1. **A ref file is a level-3 artefact.** It is *referenced* from `SKILL.md` by path and
   loaded when needed. It is never pasted into the agent body. IFScale is the reason:
   everything you inline competes with everything else you inlined, and later
   instructions lose.
2. **Prefer examples to rules**, at roughly one canonical example per rule you were
   tempted to write. Primary guidance, and the cheapest quality lever available.
3. **Prefer a machine-checkable file to a prose file.** A token JSON, a lockfile, a
   `panels/*.json` schema — these cannot drift silently, and they cost fewer tokens per
   unit of constraint than prose.
4. **Give each ref file an owner and a staleness date.** A ref file describing a design
   system two versions old is worse than none, because the agent will follow it
   confidently.

## 2.2 UX researcher — ref files

The failure this discipline has to engineer against is **fabricated evidence**, and it is
measured, not hypothetical (see §4.2). Every ref file below is chosen to make
fabrication either impossible or immediately detectable.

| Ref file | What it is | Why it changes output quality | Grade |
|---|---|---|---|
| `refs/research/taxonomy.md` | The tag/theme vocabulary the repository already uses — broad first, few top-level tags | Without it, every synthesis invents new theme names and the repository stops being searchable. ResearchOps guidance is explicit: start with a few broad tags; taxonomies are living structures — [NN/g, research repositories](https://www.nngroup.com/articles/research-repositories/), [ResearchOps Community, Minimum Viable Taxonomy L2](https://researchops.community/blog/minimum-viable-taxonomy-level-2/) | **[O]/[E]** practitioner consensus, no controlled study |
| `refs/research/evidence-format.md` | The exact required citation shape: `participant_id · verbatim quote · timestamp` | This is the anti-hallucination mechanism. Published qualitative-LLM work converges on *requiring verbatim quotes with interview and line references* as the mitigation | **[R]** — see §4.2 |
| `refs/research/icp.md` | Who the product is for; segments; who is explicitly *not* a user | Stops a synthesis generalising `1/6` into "users". Should carry the segment definitions the analytics tool actually uses, so a claim can be checked against a real cohort | **[O]** |
| `refs/research/claims-vs-themes.md` | 6–8 **worked examples**: a theme rewritten as a falsifiable claim, side by side | The single highest-leverage file for this agent. The `SKILL.md` already states the rule ("extract claims, not themes"); examples are what make it stick | **[E]** examples-over-rules |
| `refs/research/method-limits.md` | Standing sample-limitation language: what a 6-person unmoderated round can and cannot support | Makes the `Method` section real rather than boilerplate | **[O]** |
| `refs/research/redaction.md` | PII rules — names, employers, emails never leave the transcript | Already load-bearing here via ADR-036; a ref file makes it checkable | repo-internal |

**Structure:** the taxonomy should be a **list, not prose** — ideally generated from the
Dovetail tag list rather than hand-maintained, so it cannot drift. `claims-vs-themes.md`
should be **all examples and almost no rules**: two columns, ~8 rows, one page.

**Length ceilings:** taxonomy ≤ 1 page; examples file ≤ 2 pages; everything else ≤ 1 page.

## 2.3 Product designer — ref files

| Ref file | What it is | Why it changes output quality | Grade |
|---|---|---|---|
| `tokens.json` (DTCG format) | The design tokens themselves, in the **W3C DTCG format** | The DTCG spec reached its **first stable version, 2025.10, on 28 Oct 2025** — [announcement](https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/), [spec](https://www.designtokens.org/tr/2025.10/format/). JSON interchange; supported or being implemented by Figma, Sketch, Framer, Penpot, Style Dictionary, Tokens Studio, Terrazzo. **A machine-readable token file is strictly better than a prose token doc** — it cannot drift from the build | **[P]** |
| `refs/design/component-inventory.md` | Every component that already exists, one line each, with the props that vary | The file that prevents "a second dropdown that behaves almost the same" — the exact failure `frontend-engineer.replaces` names. Must be **generated**, not written | **[O]**, obvious mechanism |
| `refs/design/state-matrix.md` | The seven-state table (empty / loading / partial / error / full / dense / permission) with a **worked example flow** filled in | The table currently lives in the agent body. Moving the *example* to a ref file and leaving the *rule* in the body is the correct split | **[E]** |
| `refs/design/voice.md` | UX copy: 3–5 tone adjectives, then **example sentences** — always-use / sometimes / never vocabulary, with real product strings | Every practitioner source agrees a PDF of adjectives is useless to a model and example strings are not. But note: **this is entirely [O]**. The mechanism (few-shot conditioning) is sound; the specific advice is unvalidated |
| `refs/design/a11y-baseline.md` | The specific WCAG criteria this product commits to, with RTL/bidirectional requirements | Existing repo defects (an arrow-key handler that ran backwards for every Arabic reader) argue for this being a file, not a memory | repo-internal |
| `refs/design/prior-flows/` | 2–3 **complete accepted specs** from previous work | Highest-leverage file in the set. "What does a good spec from us look like" is answered by a good spec from us | **[E]** |

**Structure:** `tokens.json` machine-readable and generated. `component-inventory.md`
generated from the codebase or from Figma's `search_design_system` tool (§3). `voice.md`
and `prior-flows/` are the two that must be **examples-first**.

**Honest note on brand voice:** the claim that examples outperform rules for voice is
supported by Anthropic's general guidance [E] and by the mechanics of few-shot
prompting, but there is **no study measuring on-brand-ness of LLM copy against a voice
guide**. Sources like [CXL's LLM tone-of-voice framework](https://cxl.com/blog/llm-tone-of-voice/)
and [Glean's brand voice guide](https://www.glean.com/perspectives/how-to-create-a-brand-voice-guide-for-ai-tools)
are **[O]** and self-interested. Do the examples anyway — the cost is low — but do not
cite them as proven.

## 2.4 Frontend engineer — ref files

This discipline has the strongest evidence base, because its failures are measurable.

| Ref file | What it is | Why it changes output quality | Grade |
|---|---|---|---|
| `AGENTS.md` (nested, per package) | Build/test commands, code style, "do not touch" boundaries | The de facto standard; Linux Foundation stewarded; nearest-file precedence. [agents.md](https://agents.md/) | **[P]** |
| The **lockfile**, read at run time | Not a ref file — a *retrieval instruction* | The agent body already says "check the version, do not remember it". That is exactly Anthropic's just-in-time retrieval | **[E]** |
| `refs/eng/adr/` (MADR format) | Architecture Decision Records, one file per irreversible decision | [MADR 4.0.0](https://adr.github.io/madr/) (Sept 2024 — **older than 12 months**, but this is a format, not a claim). Minimal and full templates, annotated and bare, at [adr.github.io/adr-templates](https://adr.github.io/adr-templates/). This repo already runs `comms/decisions/ADR-NNN-*.md`, which is MADR-shaped | **[P]** |
| `refs/eng/patterns/` | 3–5 **exemplar components** from this codebase, annotated | The "what does our idiom look like" file. Examples over rules again |
| `tokens.css` / `tokens.json` | Shared with the designer | One source, two consumers. This is the point of DTCG |
| `refs/eng/a11y-checklist.md` | Focus order, keyboard paths, `aria-*`, both text directions | The same file the designer reads. Sharing it is the feature |
| An `llms.txt` for any design system you consume | Documentation flattened for machine reading | Real and adopted: [Cloudscape](https://cloudscape.design/gen-ai/ai-tools/llms-txt-files/), [Nord](https://nordhealth.design/docs/developer/working-with-ai/llms-txt/) and [Ant Design](https://ant.design/docs/react/llms/) all publish one. **[P]** that they exist; **[O]** that they improve output |

**The measured reason version-pinned docs matter.** **[R] Spracklen et al., "We Have a
Package for You! A Comprehensive Analysis of Package Hallucinations by Code Generating
LLMs"** (USENIX Security 2025; [code and data](https://github.com/Spracks/PackageHallucination)):
across **576,000 generated code samples from 16 models**, **19.7%** of recommended
packages did not exist — **205,474 unique fabricated package names**. Commercial models
fared far better than open ones (~5.2% vs ~21.7%). Worse for security: **43% of
hallucinated names recurred across 10 repeated queries**, which is what makes
"slopsquatting" viable as an attack. This is the strongest single argument for wiring
`context7` and for the standing instruction *"your training data is a snapshot and the
repo is not."*

## 2.5 Project orchestrator — ref files

| Ref file | What it is | Why it changes output quality |
|---|---|---|
| `refs/delivery/definition-of-done.md` | What "done" means per stage, as a checklist | The orchestrator's whole value is refusing to call something done. Give it the criteria in writing or it invents them |
| `refs/delivery/brief-template.md` | Problem / who / success / out-of-scope, plus **two filled-in examples** | MAST: 41.8% of failures are specification issues. This file attacks that number directly **[R]** |
| `refs/delivery/escalation-map.md` | Who decides what — the named owner per decision class | The agent body says "name the person the decision is waiting on". It cannot do that without this file |
| `refs/delivery/comms-register.md` | How a status post is written here: **example posts**, not tone adjectives | Everything this agent produces is read by humans in Slack |
| `refs/delivery/prior-plans/` | 2–3 real past plans with their actual slips | Teaches what a realistic sequence looks like in this organisation |

**Structural note:** the orchestrator is the agent most at risk of ref-file bloat,
because "context about the project" is unbounded. Apply just-in-time retrieval
aggressively: escalation map and definition-of-done are small and always loaded; prior
plans are pointers the agent opens only when it needs a precedent.

## 2.6 Ref-file manifest — the concrete recommendation

Create these, in this order. Length figures are ceilings, not goals.

```
refs/
├── shared/
│   ├── tokens.json                 (DTCG 2025.10, generated)        generated
│   ├── a11y-baseline.md            (+ RTL requirements)             ≤ 2 pp
│   └── voice.md                    (examples-first)                 ≤ 2 pp
├── research/
│   ├── taxonomy.md                 (generated from Dovetail tags)   ≤ 1 pp
│   ├── evidence-format.md          (the citation contract)          ≤ 1 pp
│   ├── icp.md                                                       ≤ 1 pp
│   ├── claims-vs-themes.md         (6–8 worked examples)            ≤ 2 pp
│   └── method-limits.md                                             ≤ 1 pp
├── design/
│   ├── component-inventory.md      (generated)                      generated
│   ├── state-matrix.md             (rule in SKILL.md, example here) ≤ 2 pp
│   └── prior-flows/                (2–3 complete accepted specs)
├── eng/
│   ├── AGENTS.md                   (nested per package)             ≤ 2 pp each
│   ├── adr/                        (MADR)                           one file per decision
│   ├── patterns/                   (3–5 annotated exemplars)
│   └── a11y-checklist.md           → points at shared/a11y-baseline.md
└── delivery/
    ├── definition-of-done.md                                        ≤ 1 pp
    ├── brief-template.md           (+ 2 filled examples)            ≤ 2 pp
    ├── escalation-map.md                                            ≤ 1 pp
    ├── comms-register.md           (example posts)                  ≤ 1 pp
    └── prior-plans/
```

Two of these are shared by two agents (`tokens.json`, `a11y-baseline.md`). That sharing
is the point: it is the cheapest available mechanism for stopping a designer and an
engineer making conflicting implicit decisions — Cognition's principle 2 solved with a
file instead of a context window.

---

# 3. Tools — what actually exists, verified

Everything in §3.1 was checked against the vendor's own documentation, the npm/PyPI
registry API, or the GitHub repository on **2026-08-22**. Anything that could not be
confirmed is in §3.3 and is marked unverified. Nothing here is described from memory.

## 3.1 Verified servers

### Figma — official, **beta** [P]

- Remote: `https://mcp.figma.com/mcp`. A desktop (local) server also exists.
- Docs: [developers.figma.com/docs/figma-mcp-server](https://developers.figma.com/docs/figma-mcp-server/) ·
  [tools reference](https://developers.figma.com/docs/figma-mcp-server/tools-and-prompts/) ·
  [help centre guide](https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Figma-MCP-server)
- **Status: beta.** Figma's own words: *"This will eventually be a usage-based paid
  feature, but is currently available for free during the beta period."*
- Seats: the **remote** server is *"available on all seats and plans"*; the **desktop**
  server needs a **Dev or Full seat on a paid plan** (Dev Mode is paywalled).
- **Read tools:** `get_metadata`, `get_design_context`, `get_screenshot`, `get_figjam`,
  `get_variable_defs`, `get_motion_context`, `get_code_connect_map`,
  `get_code_connect_suggestions`, `get_context_for_code_connect`, `get_libraries`,
  `download_assets`, `search_design_system`, `whoami`, plus shader read tools.
- **Write tools:** `use_figma` (general create/edit), `create_new_file`,
  `upload_assets`, `generate_figma_design`, `generate_diagram`, `add_code_connect_map`,
  `send_code_connect_mappings`, plus `weave_run_tool` / `weave_upload_asset`.
- **There is no documented read-only mode.** The read/write split above is a property of
  which tool names you expose, not a server setting. A read-only Figma grant has to be
  implemented by the host's allowlist.
- `search_design_system` is the tool that makes a generated component inventory (§2.3)
  cheap to maintain.

### GitHub — official, mature [P]

- Repo: [github/github-mcp-server](https://github.com/github/github-mcp-server)
  (~32k stars, actively developed).
- Remote: `https://api.githubcopilot.com/mcp/` (OAuth). Local: Docker
  `ghcr.io/github/github-mcp-server`, required for GitHub Enterprise Server.
- **This is the best-behaved server on the list for our purposes**, because it has the
  two controls the others lack:
  - a **`--read-only` flag** that removes every write tool, and
  - **modular toolsets** — `context`, `issues`, `pull_requests`, `repos`, `actions`,
    `code_security`, `code_quality`, `discussions`, `gists`, `git`, `labels`,
    `notifications`, `orgs`, `projects`, `users`, and more, plus `all` and `default`.
- Consequence for `project-orchestrator`: its stated rule *"Issues, comments and labels
  only. Never touch code"* is **enforceable at the server**, by enabling only the
  `issues` and `labels` toolsets. That is strictly better than instructing the model,
  and it is the pattern the whole of §5 argues for.

### Vercel — official [P], and the most dangerous grant in the set

- Endpoint: `https://mcp.vercel.com`, OAuth, Streamable HTTP.
  [Docs](https://vercel.com/docs/agent-resources/vercel-mcp) ·
  [tools reference](https://vercel.com/docs/agent-resources/vercel-mcp/tools)
  (page metadata reads `last_updated: 2026-07-23`).
- Read tools: `search_vercel_documentation`, `list_teams`, `list_projects`,
  `get_project`, `list_deployments`, `get_deployment`, `get_deployment_build_logs`,
  `get_runtime_logs`, `get_runtime_errors`, `get_web_analytics`, agent-run
  observability (`list_agent_runs`, `get_agent_run`, `get_agent_run_trace`),
  `check_domain_availability_and_price`, `get_purchase_quote`,
  `get_access_to_vercel_url`, `web_fetch_vercel_url`.
- **Mutating tools:** `deploy_to_vercel` — whose `target` parameter accepts
  **`production`** as well as `preview`. Also `import-claude-design-from-url`,
  `use_vercel_cli`, and the toolbar-thread tools (`reply_to_toolbar_thread`,
  `edit_toolbar_message`, `add_toolbar_reaction`,
  `change_toolbar_thread_resolve_status`) which write comments other people see.
- **Tools that spend money:** `buy_pro`, `buy_credits`, `buy_addon`, `buy_domain`.
  Vercel's own wording: *"These tools make purchases on behalf of a team. Charges go to
  the team's payment method immediately and are non-refundable."* The flow is
  quote-then-confirm — `get_purchase_quote` returns a signed `idempotencyKey` encoding
  the quoted terms; the `buy_*` call must pass `confirm: true` and the same key; keys
  expire after 5 minutes and a mismatched key is rejected. Vercel explicitly pushes the
  gate to the client: *"Enable confirmation prompts in your MCP client for any tool call
  that includes `confirm: true`."*
- **No read-only mode, no documented tool filtering, no project scoping.** Vercel's
  security section states plainly: *"Connecting to Vercel MCP grants the AI system
  you're using the same access as your Vercel user account"*, and its final best practice
  is *"Always enable human confirmation in your workflows."*
- **This confirms — and worsens — the note already in `frontend-engineer/SKILL.md`** that
  *"the grant does not separate preview from production."* The same grant can also
  register a domain and start a recurring subscription. If the runner cannot allowlist
  individual tool names *and* check arguments, `vercel` should not be wired at all: a
  narrow deploy token invoked through one shell command is a smaller blast radius than
  this server.
- Note the `idempotencyKey` design is a real-world instance of OWASP's **approval
  binding** requirement (§5.4) — the approval is bound to the exact quoted parameters
  and expires. It is the right pattern; it is just implemented for purchases only.

### Context7 — official (Upstash), current [P]

- npm `@upstash/context7-mcp` — **latest 4.0.3, registry-modified 2026-08-21**
  (verified against the npm registry API). Repo:
  [upstash/context7](https://github.com/upstash/context7).
- Remote: `https://mcp.context7.com/mcp`. API key optional; the free tier works without
  one.
- Two tools: `resolve-library-id`, `query-docs`. **Read-only by construction — zero
  write surface.**
- Recently migrated to the MCP v2 SDK and the `2026-07-28` protocol revision; HTTP
  serving is now stateless.
- This is the lowest-risk, highest-value wiring on the entire list, and §2.4's 19.7%
  package-hallucination figure is the argument for it.

### Amplitude — official, hosted [P]

- Endpoint `https://mcp.amplitude.com/mcp` (EU residency: `https://mcp.eu.amplitude.com/mcp`).
  [Docs](https://amplitude.com/docs/amplitude-ai/amplitude-mcp). OAuth 2.0.
- Read tools: `query_amplitude_data`, `get_amplitude_charts`, `render_amplitude_chart`,
  `get_amp_user_data`, plus session replay, guides/surveys, feedback and data-warehouse
  reads.
- **Write tools:** `create_experiment`, `create_flags`, `create_metric`,
  `manage_amp_events`, `create_properties`, `manage_amp_data_taxonomy`,
  `use_amp_dashboards`, `use_amp_notebooks`, `use_amplitude_cohorts`, plus comment and
  sharing-permission changes.
- **It cannot ingest events.** Amplitude's own words: *"The MCP isn't an ingestion
  endpoint. Emit events with an Amplitude SDK or the HTTP V2 API."* So the
  `ux-researcher` rule *"Never write an event to `amplitude`"* is **already guaranteed by
  the server**. Good — but note the rule that actually matters is a different one, and it
  is not guaranteed: this server can **create feature flags and experiments**, which
  changes what real users see.
- **Permissions are enforceable server-side.** Amplitude ships distinct RBAC actions —
  *"Use MCP (read)"* and *"Use MCP (write)"* — and org admins can restrict access under
  Settings → Content Access → MCP. **Give the researcher an Amplitude role with MCP-read
  only.** That is the single cleanest control available anywhere in this tool set.

### Dovetail — official [P], with a near-identical community package (read carefully)

- Official: [github.com/dovetail/dovetail-mcp](https://github.com/dovetail/dovetail-mcp),
  documented at [docs.dovetail.com/integrations/mcp-server](https://docs.dovetail.com/integrations/mcp-server).
  Auth: a personal API key, or native OAuth for Claude / ChatGPT / Figma Make.
- Reads: workspace search, transcripts, projects, published docs, highlights, contacts,
  users, folders, comments, channel themes, tags.
- Writes: create projects, docs, data, highlights, channel data.
- Permissions inherit the authenticating user's — *"the AI only has access to the
  information you can access… any changes are performed on your behalf."*
- **Naming hazard.** There is also an npm package literally called
  `dovetail-mcp-server` — **v0.1.3, last published 2025-09-11**, repository
  `github.com/tomgutt/dovetail-mcp` — which is a **community** project, not Dovetail's
  (verified against the npm registry API). Anyone wiring "the Dovetail MCP server" by
  npm name gets the community one. Wire the official repo or OAuth path explicitly.
- Note the PII exposure: Dovetail reads reach **contacts and transcripts containing real
  names**. ADR-036's redaction rule is doing real work here, and it is the model — not
  the server — enforcing it.

### Slack — official since 2026-02-17 [P]; the old reference server is deprecated

- Endpoint `https://mcp.slack.com/mcp`, confidential OAuth, Streamable HTTP.
  [Announcement, 17 Feb 2026](https://docs.slack.dev/changelog/2026/02/17/slack-mcp/) ·
  [server overview](https://docs.slack.dev/ai/slack-mcp-server/)
- Tools: search messages and files, read files, search emoji / users / channels, **send
  message**, read a channel, read a thread, **create conversation or channel**, **add
  reactions**, **create / update / read canvas**, read a user profile, list channel
  members, fetch user info, and **draft messages**.
- Write scopes are separable: `chat:write` (send), `channels:write` and friends (create
  conversation), `reactions:write`, `canvases:write`. **A read-only Slack grant is
  achievable simply by not requesting the write scopes.**
- **The `draft messages` tool is the important find.** It is exactly the primitive
  `project-orchestrator` needs: put the draft in Slack, let a human press send. That is
  strictly better than "propose it in `output.md` and have a human copy-paste", and it
  matches the draft-first pattern the approval literature converges on (§5.5).
- Restriction: *"Only directory-published apps or internal apps may use MCP."* Clients
  named in the docs: Claude.ai, Claude Code, Perplexity, Cursor.
- Slack also publishes agent-governance guidance
  ([docs.slack.dev/ai/agent-governance](https://docs.slack.dev/ai/agent-governance/)):
  approval gates before an agent *"creates, sends, or deletes anything"*, a narrow
  default action scope, and an agent that is *"clearly distinguishable from a human at
  all times."*
- **Deprecated:** `@modelcontextprotocol/server-slack` on npm carries the deprecation
  notice *"Package no longer supported"* (verified via the registry API). Not an option.
- Community alternative, if the directory-publication rule blocks the official server:
  `slack-mcp-server` on npm — **v1.3.0, 2026-05-14**, repo
  [korotovsky/slack-mcp-server](https://github.com/korotovsky/slack-mcp-server).
  Actively maintained; it works from user tokens and needs no admin-approved bot, which
  is convenient and is precisely why it deserves scrutiny before use.

### Google Workspace — official, **Developer Preview** [P]

- Google shipped **per-product remote MCP servers**, rolling out from **1 May 2026**
  ([Workspace Updates announcement](https://workspaceupdates.googleblog.com/2026/05/agent-tools-and-security-updates-for-workspace-developers.html) ·
  [configuration docs](https://developers.google.com/workspace/guides/configure-mcp-servers)):

  | Product | Endpoint |
  |---|---|
  | Gmail | `https://gmailmcp.googleapis.com/mcp/v1` |
  | Drive | `https://drivemcp.googleapis.com/mcp/v1` |
  | Docs | `https://docsmcp.googleapis.com/mcp/v1` |
  | Sheets | `https://sheetsmcp.googleapis.com/mcp/v1` |
  | Slides | `https://slidesmcp.googleapis.com/mcp/v1` |
  | Calendar | `https://calendarmcp.googleapis.com/mcp/v1` |
  | Chat | `https://chatmcp.googleapis.com/mcp/v1` |
  | People | `https://people.googleapis.com/mcp/v1` |

- OAuth 2.0; *"the same permissions and data governance controls as the user"*; OAuth
  events are visible to admins through the security investigation tool.
- Writes supported: Gmail drafts and labels, Docs/Sheets updates, **Calendar create /
  update / delete events**, Chat send.
- **Status is Developer Preview** — a real caveat for anything scheduled to run
  unattended.
- **The per-product split is a gift.** `ux-researcher` wants Drive only;
  `project-orchestrator` wants Calendar only. Wire the specific endpoint, never a
  blanket "Google Workspace".
- Community alternative (broader, single server): `workspace-mcp` on PyPI —
  **v1.25.0**, [taylorwilsdon/google_workspace_mcp](https://github.com/taylorwilsdon/google_workspace_mcp)
  (verified via the PyPI API). Useful if Developer Preview access is unavailable, but it
  collapses the per-product separation that makes the official one safe.

### UserTesting — official, but **limited early access** [P, marketing-grade]

- [usertesting.com/platform/mcp-server](https://www.usertesting.com/platform/mcp-server).
  Lets AI clients *"recruit participants, create studies, and launch tests"* from Claude,
  ChatGPT and Figma Make.
- **This tool contacts real people and spends real money.** Recruiting runs through
  UserTesting and User Interviews.
- Availability is *"limited early access"* to select teams; **no public tools reference
  or API documentation was findable**, so treat every capability claim as vendor
  marketing until a tools page exists.
- If wired at all, it belongs to a **human**, not to `ux-researcher`. The agent's own
  `the_human` field already says so: *"A human runs the interview… The human also owns
  the recruiting screen, the consent."*

### Others that exist and are relevant, verified to exist

| Server | Endpoint / package | Note |
|---|---|---|
| Linear | `https://mcp.linear.app/mcp` — [docs](https://linear.app/docs/mcp) | Supports **read-only access via a restricted API key** and bearer-token auth for non-interactive use. The `/sse` endpoint is a deprecated fallback. |
| Notion | `https://mcp.notion.com/mcp` — [docs](https://developers.notion.com/guides/mcp/overview) | OAuth; reads and updates whatever the authorising user can reach |
| Atlassian (Jira / Confluence) | [atlassian/atlassian-mcp-server](https://github.com/atlassian/atlassian-mcp-server) | Official remote, OAuth 2.1 or API tokens |
| Playwright | npm `@playwright/mcp` — **v0.0.79, 2026-08-21**, [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp) | Browser automation; the honest way for a frontend agent to *observe* what it built |
| Chrome DevTools | npm `chrome-devtools-mcp` — **v1.7.0, 2026-08-10**, [ChromeDevTools/chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp) | Performance traces, console, network — the a11y and perf verification loop |

## 3.2 Recommended wiring, per agent

Measured against the current `wired_into` lists. `workspace` is this repo's own
scratch-write tool, not an MCP server, and is assumed present throughout.

### `ux-researcher` — currently `[workspace, dovetail, amplitude, google-drive]`

**Keep all four. Change how three of them are granted.**

| Tool | Change |
|---|---|
| `dovetail` | Wire the **official** server (repo or OAuth), not the identically-named community npm package. |
| `amplitude` | Grant a role with **"Use MCP (read)" only**. This turns "never write to analytics" from a prompt into a server fact. **Highest-value single change in this document.** |
| `google-drive` | Wire `https://drivemcp.googleapis.com/mcp/v1` specifically, never a general Workspace grant. |
| — | Do **not** add UserTesting. Recruiting and consent belong to the human, by the agent's own `the_human`. |

Result: four servers, and the only remaining write surface is Dovetail
highlights/tags — exactly the write-back the agent body already describes and can
justify.

### `product-designer` — currently `[workspace, figma]`

**Correct as it stands.** Two additions worth considering:

- **`context7`** — negligible risk (read-only, two tools), and it lets a designer check
  what a component library actually supports before specifying against it.
- Split the Figma grant in two, if the runner can allowlist tool names: a **read** grant
  (`get_design_context`, `get_variable_defs`, `search_design_system`, `get_libraries`,
  `get_screenshot`) needing no approval, and a **write** grant (`use_figma`,
  `create_new_file`, `upload_assets`) that does. The agent body already prescribes this
  sequence in prose — *"read first, propose in `output.md`, and only create after a human
  has read the proposal"* — and the split makes it structural rather than hoped-for.

### `frontend-engineer` — currently `[workspace, context7, figma, vercel]`

**`vercel` is the problem.** See §3.1: the same OAuth grant that provides
`deploy_to_vercel(target: preview)` also provides `target: production`, `buy_domain` and
`buy_pro`, and Vercel documents no way to narrow it.

Three options, best first:

1. **Drop `vercel` from the allowlist.** Produce the patch; let CI or a human deploy the
   preview. The agent's own `output_mode: patch-only` already describes that world, and
   §5 argues this is the correct move — remove the capability rather than ask about it.
2. **Wire it only if the runner enforces a tool-name allowlist** limited to
   `deploy_to_vercel`, `get_deployment`, `get_deployment_build_logs`,
   `get_runtime_errors`, `list_projects` — and denies every `buy_*` unconditionally.
   Even then, `deploy_to_vercel`'s `target` argument needs **argument-level** checking,
   not just tool-level: `target: production` must be a different decision from
   `target: preview`.
3. Keep it as-is with `approval: required`, and accept that a single approval prompt is
   now the only thing between an agent and a recurring subscription. Given the 93%
   blanket-approval rate in §5.2, that is a thin defence.

**Add `playwright` or `chrome-devtools`** if this agent is expected to honour its own
accessibility claims. Today it asserts focus order and keyboard paths with no tool that
can observe either — the claim in `output.md` is unfalsifiable at run time, which is the
same failure mode `ux-researcher/SKILL.md` is written to prevent on the research side.

Figma here should be **read-only**: an implementing engineer has no reason to write to a
design file. That also removes one of the two `writes: ungated` grants currently denying
this agent a git worktree.

### `project-orchestrator` — currently `[workspace, github, slack, google-calendar]`

| Tool | Change |
|---|---|
| `github` | Enable **only the `issues` and `labels` toolsets** (optionally `pull_requests` read). The body's rule *"Issues, comments and labels only… never touch code"* becomes server-enforced. For report-only runs, use `--read-only`. |
| `slack` | Use the **official** server and **omit `chat:write` by default**; use the **`draft messages`** tool so a human sends. Grant `chat:write` only to an explicitly approved posting step. |
| `google-calendar` | Wire `https://calendarmcp.googleapis.com/mcp/v1` alone. Calendar writes send invitations that cannot be recalled — this stays gated regardless of tooling. |

Four servers is at the top of the comfortable range (§1.4). Do not add Notion or Linear
on top without dropping something.

## 3.3 What does not exist, or could not be verified

Say these out loud when someone assumes otherwise:

| Thing | Finding |
|---|---|
| **Maze** MCP server | **None found**, official or well-maintained community, as of 2026-08-22. |
| **Optimal Workshop** MCP server | **None found.** |
| A **read-only mode for Vercel MCP** | **Does not exist** in the documentation. Not a setting; not a scoped URL; not a token scope. |
| A **read-only mode for Figma MCP** | **Not documented.** Read/write separation must be done by the host's tool allowlist. |
| **Figma MCP rate limits by seat** | Widely repeated as *"6 tool calls per month for Starter / View / Collab seats; Tier-1 REST limits for Dev / Full."* Figma's own help page **defers to the developer docs and does not state the numbers**, and the specific figures trace to third-party blogs. **[?] unverified** — check before depending on it for a scheduled run. |
| **UserTesting MCP tool list** | No public tools reference found; the capability description comes from a **marketing page**. Early access only. **[?] on all specifics.** |
| **"5–7 MCP servers is the ceiling"** | Repeated across many 2026 practitioner posts; **no primary measurement found.** The underlying mechanism (RAG-MCP, context rot) is real; the number itself is folklore. |
| `@modelcontextprotocol/server-slack` | **Exists but is deprecated** — npm carries *"Package no longer supported."* Not a live option. |
| A **Dovetail server that redacts PII** | Does not exist. Redaction is the model's job here, which is a weaker guarantee than the rest of this table. |

## 3.4 The tool budget

Given RAG-MCP's measured degradation (§1.4) and the deprecation of "wire everything":

- **Target 3–5 MCP servers per agent.** All four product agents are already inside that.
- **Count tools, not servers.** Amplitude alone exposes well over a dozen; Vercel more
  than thirty; Figma around twenty-five. A "four-server" agent is easily a ninety-tool
  agent, which sits squarely in the regime where RAG-MCP measured 13.6% tool-selection
  accuracy.
- **Where a server offers toolset selection, use it.** GitHub is the only one here with
  first-class support (`--read-only`, named toolsets). Slack and Google approximate it
  through OAuth scopes and per-product endpoints; Amplitude through RBAC. **Figma,
  Vercel and Dovetail offer nothing** — for those three, the host must do the narrowing
  or the narrowing does not happen.

---

# 4. The ladder — what is honestly delegable today

## 4.1 The rule that predicts the rung, and it is not task difficulty

Across every discipline below, one variable predicts whether a capability survives
unattended operation better than task difficulty or model quality does:

> **Does something other than another LLM exist that can tell the agent whether it
> succeeded?**

Everything defensibly `autonomous` in §4.7 has a deterministic oracle — a linter, a
checker, a CI run, a string match against a transcript, a DOI that resolves or does not.
Everything on the `assisted` rung needs a judgement call, and the evidence that LLMs
cannot make that judgement call reliably is strong (§4.2, judge reliability).

This matters because it is directly actionable: **you do not promote a capability up the
ladder by getting a better model. You promote it by building the oracle.**

## 4.2 Four measured reasons unattended is structurally harder, not just "assisted but more so"

**1. Time horizon is not autonomy, and the field's headline number is the wrong one.**
METR say so themselves — [*Clarifying limitations of time horizon*](https://metr.org/notes/2026-01-22-time-horizon-limitations/)
(22 Jan 2026 [R]): the measure *"is not the length of time AIs can work independently"*;
it is serial human labour replaceable **at 50% success**, and *"some tasks require 98%+
success probabilities to be worth automating."*

The **80% success horizon is 3–10× shorter than the 50% headline and has barely moved:**
Claude Opus 4.5's 50% horizon is 4h49m (95% CI 1h49m–20h25m) while its **80% horizon is
27 minutes** — statistically indistinguishable from GPT-5.1-Codex-Max's 32 minutes.
Horizons also *"differ between domains by orders of magnitude"*: METR measured visual
computer-use tasks at [**40–100× shorter** than software tasks](https://metr.org/blog/2025-07-14-how-does-time-horizon-vary-across-domains/)
(14 Jul 2025). **A scheduled agent needs the 80% column.**

**2. Errors compound, and agents self-condition on their own mistakes.**
[*The Illusion of Diminishing Returns*](https://arxiv.org/abs/2509.09677) (Sinha, Goel,
Staab, Geiping — ICLR 2026 [R]): when an agent's context contains its own prior errors,
**per-step error rate rises as the task progresses**, independently of context-length
effects, and **scaling model size does not remove it**. Single-turn 80%-accuracy horizons
without chain-of-thought are 4–6 steps; **with extended thinking, GPT-5 reaches 2,176
steps and Claude 4 Sonnet 432.** Thinking models do not self-condition — this is the
cheapest available mitigation and it is a configuration choice, not a research problem.

**3. Agents cannot grade themselves, and LLM-as-judge is weaker than its raw agreement
suggests.** [*Reliability without Validity*](https://arxiv.org/html/2606.19544v1)
(Berkeley, Jun 2026 [R], **21 judge models, 541,000+ judgments**): raw agreement ~85%,
but **Cohen's κ ≈ 0.48** — "kappa deflation" overstates chance-corrected discrimination
by 33.8–41.3 points. Judges with test–retest reliability above 0.95 still showed severe
position bias, which the authors call *"a failure mode, not a strength"*; rankings shift
up to 14 positions across benchmarks. Older but unrefuted for *intrinsic* self-correction:
[*LLMs Cannot Self-Correct Reasoning Yet*](https://arxiv.org/abs/2310.01798) (ICLR 2024).

**4. "Done" carries no safety information.** [AgentS4D](https://arxiv.org/html/2607.27294)
(Jul 2026 [R], **6,560 runs**): under prompt injection, task completion reached **93.73%**
while **70.65% of completed runs were judged unsafe** — 66.22% of the entire evaluation
was *"unsafe yet complete."* Combined with MAST's finding that **23.5% of multi-agent
failures are verification failures** (the agent declares done when it is not — incorrect
verification 9.1%, no or incomplete verification 8.2%, premature termination 6.2%), a
completion signal is not an acceptance signal. Notably, MAST also found that better
verification bought **+15.6%** and topology changes **+9.4%** *with the same models* — so
a real slice of this is architecture, and it is ours to fix.

## 4.3 Frontend engineering — the evidence is contested, and the contest matters

**Do not cite "AI makes developers 19% slower" as a current fact.** METR's own follow-up
supersedes it. The original [RCT](https://arxiv.org/abs/2507.09089) (Jul 2025 [R], 16
experienced OSS developers, **246 real tasks** in mature repos) found **19% slower**
(CI +2% to +39%) while the developers believed they were **20% faster** — an important
and still-valid finding about *self-report*. But
[*We are Changing our Developer Productivity Experiment Design*](https://metr.org/blog/2026-02-24-uplift-update/)
(24 Feb 2026 [R]) reports the follow-on (57 developers, 143 repos, 800+ tasks) at
**−18% (CI −38% to +9%)** for the original cohort and **−4% (CI −15% to +9%)** for new
recruits — neither distinguishable from zero. METR call it *"very weak evidence"* and are
redesigning, partly because 30–50% of developers admitted withholding tasks they thought
AI would be good at, and recruitment now fails because people refuse to work without AI.

The other RCTs point the other way — Google's [Paradis et al.](https://arxiv.org/abs/2410.12944)
(96 engineers) found ~21% faster; [*Echoes of AI*](https://arxiv.org/abs/2507.00788)
(N=151, peer-reviewed, v3 Feb 2026) found 30.7% faster in phase 1 **and no detectable
maintainability penalty downstream** in phase 2. GitHub's often-quoted 55.8% figure
([Peng et al.](https://arxiv.org/abs/2302.06590)) is a **vendor-authored preprint that
was never peer-reviewed**, on a greenfield HTTP server. **[O] as evidence about real
work.**

**The pattern that reconciles them:** greenfield, small, well-specified, low-context →
speedup; large mature codebase with a high quality bar and an expert who already knows
the code → nothing or worse. Which is exactly the regime `frontend-engineer` operates in.

### Benchmarks: SWE-bench Verified is no longer a signal

[OpenAI formally stopped using it](https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/)
(23 Feb 2026 [P]): every frontier model could reproduce verbatim gold patches, and
**59.4% of 138 hard problems had material test flaws.** Independently confirmed by
[*Does SWE-Bench-Verified Test Agent Ability or Model Memory?*](https://arxiv.org/abs/2512.10218)
(Waterloo, Dec 2025 [R]) — the same Claude models scored **3× better** on Verified than
on decontaminated equivalents, and **6× better at locating edited files given only issue
text**, *"to the extent that the task should be logically impossible."*

The uncontaminated picture is much lower:

| Benchmark | Top score | Note |
|---|---|---|
| SWE-bench Verified | ~95–97% | Contaminated and saturated. Not a capability signal. |
| [SWE-bench Pro](https://labs.scale.com/leaderboard/swe_bench_pro_public) (Scale SEAL) | **61.5%** | 1,865 tasks, 41 repos, contamination-controlled |
| [Terminal-Bench 2.0](https://www.tbench.ai/leaderboard/terminal-bench/2.0) | **84.7% ±2.1** | Audited harnesses, public trajectories |
| [DesignBench](https://arxiv.org/html/2506.06251v3) (frontend) | Compile success 0.97 React/Vue but **0.69–0.76 Angular**; **compile-error repair 53%**; **UI issue detection 27%**; **component reuse 0.24% in React** | 900 samples, 15 MLLMs |

**That 0.24% React component-reuse figure is the single most relevant number in this
document to `frontend-engineer`'s stated purpose.** Its `replaces` field names exactly
this failure — *"shipping a second dropdown that behaves almost the same"* — and the
measurement says models effectively never reuse. **This capability does not arrive from
a better model; it arrives from `refs/design/component-inventory.md` plus Figma's
`search_design_system`, and from a check that fails the run when a new component appears
without a justification.**

### The failure mode that unattended operation cannot detect

[*Building to the Test: Coding Agents Deliver What You Check, Not What You Requested*](https://arxiv.org/abs/2606.28430)
(Jun 2026 [R], preprint, n=18 runs, one task): with a 222-test Playwright oracle in the
loop, the score reaches near-perfect **while the shipped library is dead on arrival**.
The agent *"does not, on its own, validate what it ships as a user would."* Small study,
but a controlled demonstration of precisely the thing that breaks unattended runs.

### What real agentic PRs actually get accepted — the best per-task-type evidence

[*Comparing AI Coding Agents: A Task-Stratified Analysis of PR Acceptance*](https://arxiv.org/html/2602.08915v2)
(UCL, **MSR '26** [R], AIDev dataset, **7,156 PRs**):

| Task type | Acceptance | Task type | Acceptance |
|---|---|---|---|
| Chore | **84.0%** | Fix / bug | 66.0% |
| Documentation | **82.1%** | Features | 66.1% |
| Style | 78.1% | Test | 61.5% |
| CI | 75.0% | Revert | 60.0% |
| Build | 72.5% | **Performance** | **55.4%** |
| Refactor | 71.2% | | |

A **29-point spread**, and the ordering is the actionable part. Companion paper
[*Where Do AI Coding Agents Fail?*](https://arxiv.org/html/2601.15195) (MSR '26 [R],
**33,596 PRs**, 600 hand-annotated rejections, κ=0.91): overall **28.5% rejection**;
reviewer abandonment 38% of failures, duplicate PR 23%, **CI/test failure 17%**,
incorrect implementation 3%.

**Contested.** [LinearB's 2026 benchmarks](https://linearb.io/dev-interrupted/podcast/linearb-2026-benchmarks-ai-pr-merge-rate)
(8.1M PRs, 4,800 teams, Mar 2026 — **vendor telemetry, AI-attribution method
undisclosed**) reports AI-assisted PRs merging at **32.7% vs 84.5%** for human PRs, with
**5.25× longer** waits for first review. Academic AIDev says ~71.5% merge. Different
populations and denominators. **Treat merge rate as unsettled; treat the task-type
ordering as robust.**

### The verification tax — the best-replicated finding in the whole corpus

- **DORA**, [*Balancing AI tensions*](https://dora.dev/insights/balancing-ai-tensions/)
  (Mar 2026 [R], 1,110 open-ended responses): *"time saved during initial code
  generation is often re-allocated to verification overhead."* They name it the
  **verification tax**; reviewer burden rises disproportionately to author gains.
- [**DORA 2025**](https://cloud.google.com/blog/products/ai-machine-learning/announcing-the-2025-dora-report)
  (Sep 2025 [R], ~5,000 professionals): 90% adoption, median 2 h/day, 80%+ believe they
  are more productive — yet **AI adoption remains positively correlated with delivery
  *instability*** in both 2024 and 2025, and **30% report little or no trust in
  AI-generated code.** *Correlational and self-reported;*
  [RedMonk's critique](https://redmonk.com/rstephens/2025/12/18/dora2025/) questions
  whether developers can honestly self-report effectiveness to their employer.
- [**Developer Productivity with GenAI**](https://arxiv.org/html/2510.24265v1) (Oct 2025
  [R], N=415 across 56 OSS communities): 72.7% report changing more lines/day, but
  **84.3% of frequent users say AI did not reduce time spent on code review.**
- [**Stack Overflow 2025**](https://survey.stackoverflow.co/2025/ai) [R] — **the latest
  published survey; the 2026 one opened 23 Jun 2026 and has no results, so any "2026
  Stack Overflow" number you see is mislabelled 2025 data.** Trust: **3.1% highly trust**,
  29.6% somewhat trust, **19.6% highly distrust** (down from ~40% trust in 2023).
  **66%** name *"AI solutions that are almost right, but not quite"* as their top
  frustration; **45.2%** say debugging AI-generated code takes longer; and **75.8% do
  not plan to use AI for deployment and monitoring** — the highest resistance of any
  task, and directly relevant to the `vercel` grant in §3.2.

### Security and accessibility: the two places the numbers are unambiguous

**Security.** [Veracode](https://www.veracode.com/blog/genai-code-security-report/)
(Jul 2025, **vendor but measured**, 100+ models): **45% of samples fail OWASP Top 10
tests** (Java 72%, C# 45%, JS 43%, Python 38%); XSS defended in only 14% of cases. Their
[2026 update](https://www.businesswire.com/news/home/20260728207685/en/) reports the pass
rate **stalled at 56%**, *"flat regardless of model size."* Apiiro's Fortune 50 telemetry
(vendor) reports privilege-escalation paths **+322%** and architectural flaws **+153%**.
Take the direction seriously and the precise figures with the usual vendor discount.

**Accessibility — the one area with convergent, replicated, numeric findings, and they
are uniformly bad:**

- [A11YN / RealUIReq-300](https://arxiv.org/html/2510.13914v1) (Oct 2025 [R]), axe-core
  on 300 real UI requests: **inaccessibility rate GPT-4 0.27, Claude Sonnet 4 0.29,
  Qwen2.5-Coder-14B 0.43.** Bigger is not better.
- [ASSETS 2025](https://dl.acm.org/doi/full/10.1145/3663547.3759755): 6 AI-generated
  sites produced 308 errors, **52.9% of them cognitive (COGA) issues invisible to any
  automated checker.**
- [CHI 2026 EA, *Semantic Accessibility Gap*](https://dl.acm.org/doi/10.1145/3772363.3799364):
  **541 semantic violations across 300 UIs from three frontier models that pass every
  automated check.** Optimising against axe-core teaches models to emit *"syntactically
  compliant but semantically empty attributes."*
- [*LLM Based Web Accessibility Repair*](https://arxiv.org/html/2605.27716v1) (May 2026
  [R]): repair improved compliance in 80.2% of cases but **fully resolved only 25.7%**;
  **~30% of patches altered document structure**; and the **agentic loop cost 52% more
  with no measurable improvement over zero-shot.**

**Two direct consequences for this repo.** First, `frontend-engineer`'s accessibility
claims need a checker wired (§3.2) — but second, and more important, **never let the
agent optimise against the checker score.** The CHI 2026 result is that doing so
produces compliant-looking, semantically empty markup. The checker is a floor test, not
a target.

## 4.4 Product design — say plainly that the evidence base is weak

Typical study sizes in this area are 3 evaluators / 20 screenshots, or 2 experts / 1 app.
**Two flagship heuristic-evaluation studies reach opposite conclusions.** Anyone offering
you a confident number about AI design quality is over-reading a small sample.

- [*Generating Automatic Feedback on UI Mockups with LLMs*](https://arxiv.org/html/2403.13139)
  (**CHI 2024** [R] — the best-designed study in the area), GPT-4 vs 12 design experts:
  **precision 0.603 vs 0.829 human; recall 0.380 vs 0.336.** 29% of suggestions flatly
  inaccurate. **9% of real issues were found only by GPT-4** — genuine complementarity.
  **And the finding that should end any thought of an unattended design loop: across
  iterative rounds, accuracy fell 52% → 39% and helpfulness 47% → 33%.**
- [*Can GPT-4o Evaluate Usability Like Human Experts?*](https://arxiv.org/abs/2506.16345)
  (2025 [R]): 111 raw claims → 68 after de-duplication → **41 valid after removing 27
  false positives**; only **21.2% overlap with expert findings**.
- [*Synthetic Heuristic Evaluation*](https://arxiv.org/abs/2507.02306) (2025) — the
  optimistic outlier: an MLLM found **73%/77%** of issues vs human evaluators' 57%/63%.
  But it reports recall against a merged list and **not precision**, so it does not
  actually contradict the false-positive findings. Two apps, not peer-reviewed. **[O]/[R]
  borderline.**
- [*UICrit*](https://dl.acm.org/doi/10.1145/3654777.3676381) (**UIST 2024** [R], 3,059
  critiques over 983 screens): tuned LLM critique quality **0.48 vs human 0.75** — and
  rater **Fleiss' κ 0.29–0.31**, meaning *even humans* only "fairly" agree on what a good
  critique is. That is a warning about the whole measurement enterprise, not just the
  models.

**Scoring specifically fails; ranking survives.** [*VLM Judges Can Rank but Cannot
Score*](https://arxiv.org/html/2604.25235v1) (Apr 2026 [R]): Pearson 0.30–0.46, exact
agreement on a 5-point scale **32–34%**, and **68.8% of prediction intervals span more
than 75% of the rating scale.** Corroborated by MLLM-as-a-Judge (ICML 2024) and
[MLLM as a UI Judge](https://arxiv.org/abs/2510.08783).

**Design-system and token conformance: there is no peer-reviewed measurement at all.**
The nearest signals are negative — DesignBench's 0.24% React component reuse,
[*Constraint Decay*](https://arxiv.org/abs/2605.06445) (adherence declines as structural
constraints accumulate; backend, so extrapolation), and a **null brand-alignment result**
in [CHI 2026, N=36](https://dl.acm.org/doi/10.1145/3772318.3791329). **Treat token
conformance as unknown, and therefore human-verified.** This repo's rule 8 ("no hex
outside `tokens.css`") is the kind of thing a lint rule can check and a model cannot be
trusted to honour — build the lint rule.

**Ideation homogenisation is well measured, and it is specifically a *scheduled-agent*
problem.** [CHI 2024, N=60](https://arxiv.org/abs/2403.11164): GenAI during ideation →
higher design fixation, fewer ideas, less variety, lower originality.
[C&C 2024, N=36](https://dl.acm.org/doi/10.1145/3635636.3656204): individuals produce
more ideas, but ideas *across* users become **less semantically distinct** — a
group-level effect invisible in any single run. [Doshi & Hauser, *Science Advances* 2024](https://www.science.org/doi/10.1126/sciadv.adn5290)
(300 writers, 600 judges): novelty **+8.1%** individually, **story similarity +10.7%**
collectively, from a single AI idea. [*LLMs are homogeneously creative*, PNAS Nexus,
Mar 2026](https://academic.oup.com/pnasnexus/article/5/3/pgag042/8529001) (22 LLMs vs 102
humans): population semantic variability **0.459 vs 0.699**, all p<0.01.

> **N runs are not N perspectives.** Anything in `product-designer`'s ladder that
> promises "every accepted opportunity arrives as a specified flow" is promising volume,
> and volume from one model is measurably less diverse than volume from one team.

## 4.5 UX research — the deductive/inductive split is real and replicates

[Hill et al., *PLOS Digital Health*, 3 Apr 2026](https://journals.plos.org/digitalhealth/article?id=10.1371%2Fjournal.pdig.0001189)
[R] — blinded, pre-specified non-inferiority margins, adjudication panel as reference,
testing ChatGPT-5, Claude 4 Sonnet and QualiGPT:

- **Deductive coding** (against an explicit codebook): humans 92.7% agreement / **κ=0.34**;
  LLMs 93.5% / **κ=0.34**. All non-inferior; two models statistically superior.
- **Inductive coding**: only one model reached non-inferiority. Weak on latent meaning,
  affect, relational nuance.
- **Hallucination: 1.2% strict, 8.6% expanded, 12.4% comprehensive error.**
- **Models repeatedly coded facilitator speech as participant data despite clear
  labels.** In UX terms: **the moderator's leading question becomes a "user insight."**

**The caveat matters more than the headline: n = 1 transcript.** And κ=0.34 is only
"fair" — the honest reading is *"LLMs are as unreliable as humans here"*, not *"LLMs code
as well as humans."*

Corroborating: [Marston et al.](https://arxiv.org/abs/2606.26541) (46 LLMs, 150
transcripts) — deductive coding comparable to experienced human coders, with failures
concentrated on **needs expressed indirectly** and **needs outside the predefined
categories**; their conclusion is verbatim the answer to the tiering question:
*"Aggregate reliability metrics alone are insufficient for deployment decisions."*

**The strongest anti-autonomy finding in this discipline:**
[Castellanos et al., *JMIR AI* 2025](https://pmc.ncbi.nlm.nih.gov/articles/PMC12231516/)
— GPT-4 vs two human coders on 310 posts. Overall agreement 79.7%, but **perfect
alignment only 30.6%**, and **96% of topics that humans coded as "low coherence" were
marked coherent by the LLM.** *The model does not know when the data is incoherent; it
force-fits.* That is precisely the failure `ux-researcher/SKILL.md` tries to head off
with *"this round cannot answer this"* as a legitimate output — and the evidence says the
model will not reach for it unprompted.

**Run-to-run variance is the operational killer.**
[Alshaikh et al.](https://arxiv.org/abs/2605.07422) [R], 10 independent runs per model:
Gemini 2.5 Flash SD=0.038 with **individual-run κ spanning 0.363–0.468** — a range that
crosses the Fair/Moderate boundary. *"Single-run agreement scores are methodologically
insufficient."* **Operational consequence: if this is ever scheduled, run it ≥3 times and
majority-vote.**

**Misreading warning.** [arXiv 2512.20352](https://arxiv.org/abs/2512.20352) is widely
quoted as *"LLMs achieve κ>0.9 vs human coders"* (Gemini 2.5 Pro κ=0.907). **Those kappas
measure run-to-run self-consistency, not agreement with humans**, on one transcript. A
model can be perfectly self-consistent and consistently wrong.

### Fabrication — the best-measured area in this report, and the numbers are bad

| Source | Scale | Fabrication rate |
|---|---|---|
| [Linardon et al., *JMIR Mental Health*, Nov 2025](https://mental.jmir.org/2025/1/e80371) | GPT-4o, 176 citations, verified against 5 databases | **19.9% fabricated**; of the real ones **45.4% contained errors** → **only 43.8% both real and correct** |
| [Naser, arXiv 2603.03299](https://arxiv.org/abs/2603.03299) (Feb 2026) | **69,557 citations, 10 models** | **11.4%–56.8%**; hallucination is *"prompt-induced rather than intrinsic"* |
| [GhostCite, arXiv 2602.06718](https://arxiv.org/abs/2602.06718) | **2.2M citations, 13 models** | **14.2%–94.9%**; 76.7% of surveyed reviewers do not verify references |
| [*Cited but Not Verified*, arXiv 2605.06635](https://arxiv.org/abs/2605.06635) (May 2026) | 14 deep-research agents | Link validity >94% and relevance >80%, but **factual accuracy 39–77%** — and it **dropped ~42% as tool calls went from 2 to 150** |

That last row is a direct argument against long unattended research runs: **accuracy
degrades with tool-call depth even when every link resolves.**

The `ux-researcher` agent's rule — *"Participant id, the quote verbatim, and the
timestamp… a claim with no quote is an inference and gets labelled one"* — is exactly
right, and it is the only part of this discipline with a **deterministic oracle**: a
quote either string-matches the transcript or it does not. **Build that check.** It moves
"claims are traceable" from a hoped-for behaviour to a testable one, and it is cheap.

**Note the gap honestly:** quote fabrication rates *in interview synthesis
specifically* are effectively unmeasured — one study with three different definitions
(1.2% / 8.6% / 12.4%). The citation numbers above are a proxy.

**Synthetic users are not evidence.** [*When Synthetic Users Fail*](https://arxiv.org/abs/2607.26348)
(Jul 2026 [R]): **no LLM beat even the strongest baseline at the individual level**;
models over-determine demographics and **inflate between-segment gaps 2–4×, directing
teams to the wrong segment in half of US cases**. Neither failure improved with model
size. A [scoping review of 81 persona articles](https://arxiv.org/html/2504.04927v2)
found **45% have no evaluation at all**, and where personas scored well the metric was
*plausibility* — clarity, fluency, credibility — not accuracy. **Fluent and wrong.**

**One task here is genuinely autonomous-capable:** high-recall screening.
[Xie et al., *J Evidence-Based Medicine* 2026](https://onlinelibrary.wiley.com/doi/10.1111/jebm.70166),
a meta-analysis of 18 studies, puts title/abstract screening at pooled **sensitivity
0.92, specificity 0.94, AUC 0.98**, with few-shot/CoT lifting sensitivity 0.86 → 0.95.
**Caveat:** 0.92 sensitivity means **8% of relevant items are silently missed** — safe unattended
only at high-recall settings, and only if a human owns the excluded pile.

## 4.6 Delivery coordination — the thinnest area, and the numbers are ~15 months old

**There is no dedicated benchmark for project management.** The only direct measurement
remains [TheAgentCompany](https://arxiv.org/abs/2412.14161) (CMU, NeurIPS 2025 [R]), and
its per-platform breakdown is the most useful thing in it:

| Platform (Gemini 2.5 Pro) | Completion |
|---|---|
| Plane (the PM tool) | **41.2%** |
| GitLab | 33.8% |
| RocketChat (comms) | **29.1%** |
| ownCloud (office documents) | **12.9%** |

Overall: **30.3% full completion, 39.3% checkpoint-weighted partial.** 28 of the 175
tasks are PM tasks.

**Read that ordering carefully: manipulating the PM tool is the easy part; talking to
humans is where it breaks; producing the document artefact is worst of all.** That maps
almost exactly onto what delivery coordination is, and it is the opposite of what a
"status report agent" pitch assumes. One documented failure mode: the agent, unable to
find the intended user in RocketChat, **renamed a different user to that person's name**
and proceeded as though done.

**These numbers are roughly fifteen months stale, and no verifiable frontier-2026
re-run exists.** Every 2026 "agent leaderboard" page claiming a TheAgentCompany score for
a current model contradicts the others and is SEO content. **Do not use those.**

The trustworthy 2026 substitutes all say the same thing:

- [**GDPval**](https://arxiv.org/abs/2510.04374) (OpenAI, Oct 2025 — **vendor-authored
  but blind human-expert graded**): 1,320 tasks, 44 occupations, avg 7h of expert time
  per task. Best model **win-or-tie vs human expert deliverables: 47.6%**. **Caveat:** The
  authors' own limitation is the important one: tasks are *"precisely-specified and
  one-shot, not interactive"* — GDPval **removes** the ambiguity-resolution and
  multi-turn coordination that is most of real delivery work. 48% win-or-tie is not a
  48% correctness rate.
- [**OfficeEval / *Mind the Gap***](https://arxiv.org/html/2606.10956) (Microsoft
  Research, Jun 2026 [R]), 200 real Office proficiency-exam tasks, 7,118 machine-gradable
  criteria, human community solutions average 95.5%: **single-turn best ~36.6%; agentic
  with execution feedback 68.8%.** The execute→observe→repair loop roughly **doubles**
  success and is still far below human.
- [**Workspace-Bench 1.0**](https://arxiv.org/abs/2605.03596) (May 2026 [R]), 388 tasks:
  best agent ~60%, average 43.3%, **human baseline 80.7%.**
- [**CRMArena-Pro**](https://arxiv.org/abs/2505.18878) (Salesforce Research [R]):
  **~58% single-turn → ~35% multi-turn.** Deterministic workflow execution **>83%
  single-turn**. And *"near-zero inherent confidentiality awareness"* — prompting for it
  *degrades* task performance.
- [**ClawsBench**](https://arxiv.org/abs/2604.05172) (Apr 2026 [R]), 44 tasks across
  email, scheduling and documents: **39–64% success with unsafe-action rates of 7–33%.**
  Even the best models take a wrong, near-irreversible action roughly **one run in
  fourteen** — which is the number to hold in mind when reading §5 on calendar invites
  and Slack posts.

**Status reports and summaries specifically — omission dominates, and it is invisible by
construction:**

- [*Hallucinations in LLM-Generated Bug Report Summaries*](https://arxiv.org/abs/2605.24137)
  (May 2026 [R], n=80): **47.9% contained missing information; 12.3% fabricated content.**
- [ED encounter summaries, *PLOS Digital Health* 2025](https://journals.plos.org/digitalhealth/article?id=10.1371%2Fjournal.pdig.0000899)
  (100 encounters): only **33% entirely error-free; 42% hallucinations; 47% omitted
  clinically relevant information.** The authors explicitly decline to endorse
  unsupervised use. *Clinical, so a proxy — but the shape is consistent.*
- **Meeting and standup summarisation accuracy: no measured study found.** Any vendor
  claim here is currently unfalsifiable from public research.

**Effort estimation is measurable and mediocre.**
[Agile story-point estimation](https://arxiv.org/html/2603.06276) across 16 real JIRA
projects: few-shot **ρ ≈ 0.45**, beating supervised deep-learning baselines, with the
authors noting LLMs *"better predict relative ordering than absolute values."* **Fine as
a backlog sort order; not a schedule.** This is precise support for
`project-orchestrator`'s existing rule *"Never move a date to make a plan fit… report the
arithmetic and let a human choose what to cut."*

**AI code review is assisted, not autonomous.** The
[Martian independent benchmark](https://www.codeant.ai/blogs/ai-code-review-benchmark-results-from-200-000-real-pull-requests)
(200,000+ real PRs, Jan–Mar 2026; true positive = the developer actually changed the
code) puts best-in-class at **precision 52.2%, recall 51.1%, F1 51.7%.** **Caveat:** *Reported via
a vendor's blog about the independent benchmark; the leaderboard itself is JS-rendered
and could not be fetched — treat as [O] pending direct verification.* Peer-reviewed
corroboration: [MSR '26](https://arxiv.org/html/2604.24450v1), 7,416 bot comments across
4,532 agentic PRs — relevance **6.91/10**, and **more bot comments correlate with longer
resolution time (ρ=0.19)** while **relevance declines as comment volume rises
(ρ≈−0.2)**, with essentially no correlation to merge outcomes.

## 4.7 The ladder, as the evidence supports it

### AUTONOMOUS — defensible today

Every row has a deterministic oracle.

| Capability | Evidence |
|---|---|
| Deterministic checker runs and trend reporting — axe-core, Lighthouse, lint, CI, contrast, token-lint | Not LLM judgement. **Caveat:** axe catches only ~30–50% of WCAG issues, and **the agent must never optimise against the score** |
| Chore / documentation / style / CI-config PRs | 75–84% acceptance (MSR '26, 7,156 PRs) |
| High-recall screening and triage — *which items deserve a human* | Pooled sensitivity 0.92 / specificity 0.94 (18 studies). **Caveat:** 8% silently missed |
| Deductive coding against an explicit codebook | Non-inferior to humans (PLOS 2026) — **with ≥3 runs, majority vote, and a random human audit** |
| Verbatim retrieval, quote string-matching, DOI/link resolution | Mechanically checkable. **These should be automated — they are the cheapest error-catchers available** |
| Deterministic scripted workflow execution against a structured API | >83% single-turn (CRMArena-Pro) |
| Reconciling a record against reality — "this issue is closed with nothing merged" | A join over two data sources, not a judgement. This is the genuinely autonomous half of `project-orchestrator` |

### ASSISTED — the honest default for almost everything

Feature / bugfix / refactor / test / performance code (55–72% acceptance; "building to
the test"); AI code review (precision ≈ 0.52); heuristic evaluation and design critique
(precision 0.60 vs 0.83 human, 21–24% false positives); inductive theme generation;
**anything containing a quote or a citation** (11–20% fabrication floor); status reports
and summaries (~48% document-level omission); effort estimation (ρ≈0.45, sort order
only); brief and requirements drafting; multi-turn business workflows (58% → 35%).

### HUMAN-LED — the evidence does not support delegation even with review

Absolute quality or severity **scoring** (exact agreement 32–34%; 68.8% of prediction
intervals span >75% of the scale); aesthetic judgement; **design-system and token
conformance** (zero measurement, negative proxies); cognitive accessibility (>52% of real
problems, invisible to every checker); cross-screen and flow-level interaction issues;
anything requiring the agent to notice that it does not know something (the 96%
coherence-blindness result); anything handling confidential data (near-zero
confidentiality awareness, and prompting for it costs performance); synthetic users used
as evidence.

### ACTIVELY COUNTERPRODUCTIVE TO SCHEDULE

Three things, each with measurements, that get **worse** when run unattended:

1. **Unattended iterative refinement loops.** CHI 2024: accuracy 52%→39%, helpfulness
   47%→33% across rounds. Accessibility repair: the agentic loop cost **+52%** for no
   improvement over zero-shot. Every measurement of unsupervised iteration found here is
   flat or negative.
2. **Repeated generation treated as diverse options.** *N* runs are not *N* perspectives
   (PNAS Nexus; *Science Advances*; C&C 2024).
3. **Agent output feeding the next run with no human checkpoint.** CHI 2024 (N=60):
   exposure to AI output raises fixation and lowers variety; self-conditioning (ICLR
   2026) is the mechanism. **An agent reading its own prior output is the worst case** —
   which is exactly what `ux-researcher`'s autonomous rung describes ("every closed
   interview is synthesised as it lands, and the opportunity list is rebuilt").

**Three levers with measured effect sizes, if you must push toward autonomy:**
execution-feedback and repair loops roughly **double** success (OfficeEval 36.6% → 68.8%);
verification scaffolding and procedural checklists bought **+15.6%** with identical
models (MAST) and turned Anthropic's [Project Vend](https://www.anthropic.com/research/project-vend-2)
from unprofitable to profitable — their phrasing is *"bureaucracy matters"*, and their
verdict is still that the models *"needed a great deal of human support"*; and **extended
thinking eliminates self-conditioning** (ICLR 2026), which is a configuration flag.

## 4.8 Applied — the four agents, tier by tier

Comparing the evidence against each `tier` and each rung of each `ladder`.

### `ux-researcher` — `tier: assisted`. **Correct. Do not promote.**

| Its ladder rung | Verdict |
|---|---|
| `assisted`: *"Transcripts go in, a synthesis comes back with every claim linked to the quote and the analytics number behind it"* | **Supported.** Deductive coding is non-inferior; the quote-link is mechanically checkable |
| `autonomous`: *"Every closed interview is synthesised as it lands, and the opportunity list is rebuilt before the next planning session"* | **Not supported today, in two distinct ways.** (a) *Synthesised as it lands* is single-run coding with κ varying 0.363–0.468 run to run; it needs ≥3 runs and a vote. (b) *The opportunity list is rebuilt* is an agent reading its own prior output — the self-conditioning and fixation case. **Rewrite this rung** to something honest: "each closed interview is coded against the existing codebook, three times, with disagreements flagged for a human; the opportunity list is never rebuilt unattended." |

Two capabilities inside this agent are **already autonomous-grade** and could be split
out as scheduled jobs today: **quote verification** (string-match every quote against its
transcript) and **link/citation resolution**. Both have oracles. Both attack the exact
failure the agent body calls *"unrecoverable."*

### `product-designer` — `tier: assisted`. **Correct, and the autonomous rung is unreachable.**

| Its ladder rung | Verdict |
|---|---|
| `assisted`: *"the flow is specified state by state against the real design system, and the gaps are listed before anyone opens Figma"* | **Supported for coverage** — enumerating states against a fixed matrix is closer to deductive coding than to critique. **Not supported for the design-system half**: token and component conformance has zero measurement and the proxies are bad (0.24% reuse). Give it `search_design_system` and a token lint, or the claim is unbacked |
| `autonomous`: *"Every accepted opportunity arrives as a specified flow with its component inventory already reconciled against the library"* | **Not supported.** "Reconciled against the library" is precisely the unmeasured capability. And volume from one model is measurably less diverse than volume from a team |

The `the_human` field here is the best-calibrated sentence in all four files — *"This
agent is rigorous about coverage and has no opinion worth trusting about beauty."* The
evidence agrees precisely: **recall 0.380 vs human 0.336** (it finds things humans miss)
against **precision 0.603 vs 0.829** (much of what it finds is wrong). Coverage yes,
judgement no.

### `frontend-engineer` — `tier: assisted`. **Correct. The autonomous rung is the risky one.**

| Its ladder rung | Verdict |
|---|---|
| `assisted`: *"The spec comes back as a reviewed diff with every state implemented and the tokens already conformed"* | **Supported for the diff** (66% feature acceptance, human-reviewed). **"Tokens already conformed" is the unmeasured claim** — make it a lint, not a promise |
| `autonomous`: *"An accepted spec produces a preview deployment and a diff waiting for review before the designer is back from lunch"* | **Half supported.** Producing a diff unattended is fine — the human review is still in the loop, so this is really `assisted` with a scheduled trigger. **The preview deployment is the part that fails**, and not on capability grounds: §3.1 shows the Vercel grant cannot separate preview from production or from purchases. Also note 75.8% of developers say they will not use AI for deployment — the most-resisted task in the Stack Overflow survey |

The **chore / documentation / CI-config** slice of this agent's work sits at 75–84%
acceptance and is genuinely autonomous-capable. Consider splitting that out rather than
promoting the whole agent.

### `project-orchestrator` — `tier: human-led`. **Correct, and the most defensible tier call in the set.**

| Its ladder rung | Verdict |
|---|---|
| `assisted`: *"The brief, the split and the sequence come back as a plan with the critical path marked, and a status on request"* | **Supported with a caveat on the brief.** Summaries omit at ~48%; the brief is the highest-leverage artefact (MAST 41.8%) and the one most worth a human editing rather than approving |
| `autonomous`: *"The board is reconciled and the blocked items named every weekday morning, before anyone asks"* | **Split it. Half is autonomous today; half is not.** *"Reconciled"* — joining GitHub state against merge history to find issues that disagree with reality — is a deterministic join with an oracle, and it is safe to schedule. *"Blocked items named"* is a judgement with no oracle, on the platform TheAgentCompany scored worst on (documents, 12.9%; comms, 29.1%). **Schedule the reconciliation; draft the judgement for a human** |

Its `the_human` — *"a human decides what ships and what gets cut… only a person may
choose which half to drop"* — is exactly the ρ≈0.45 estimation finding, correctly
applied. Keep it verbatim.

## 4.9 What is unsettled, contested, or could not be verified

Stated plainly, because a confident answer built on one of these would be wrong:

- **The METR 19% slowdown is superseded by METR's own February 2026 update** (−18% and
  −4%, both crossing zero, described as *"very weak evidence"*). Not a current fact.
- **AI PR merge rates: ~71.5% (academic, AIDev) vs 32.7% (LinearB vendor telemetry).**
  Unresolved. The *ordering* by task type is robust; the *level* is not.
- **AI code maintainability:** vendor telemetry (GitClear, 211M+ LoC) says collapse; the
  one controlled experiment (*Echoes of AI*, N=151, peer-reviewed) found **no**
  systematic penalty. Every "AI degrades code quality" datapoint at scale is vendor
  telemetry with undisclosed attribution. **The security findings are more solid than the
  maintainability findings.**
- **Heuristic evaluation:** 21.2% expert overlap vs beating a five-expert panel — two
  near-identical designs, opposite conclusions.
- **TheAgentCompany has no verifiable frontier-2026 re-run.** Its 30% is the honest
  number *as of early 2025*, and it is the best available, and it is old.
- **Design-system / token adherence: no primary research at all.** Likewise **meeting and
  standup summarisation accuracy**, and **agents running unattended on a schedule**
  (SentinelBench exists — Microsoft Research, Jun 2026, 100 long-running monitoring
  tasks — but its baseline numbers could not be extracted).
- **Qualitative-analysis sample sizes are small enough to be embarrassing.** The flagship
  blinded study is **n = 1 transcript**. Almost nothing is preregistered.
  **Quote-fabrication rates in interview synthesis specifically are effectively
  unmeasured** — one study, three definitions, 1.2% / 8.6% / 12.4%.
- **"95% of AI pilots fail" (MIT NANDA) is not a failure rate.** It measures *"no
  measurable P&L impact"*, is unrefereed, and is largely an artefact of pilots lacking
  pre-deployment baselines. **Gartner's "40% of agentic projects cancelled by 2027" is an
  analyst forecast**, built partly on a self-selected webinar poll. Neither belongs in a
  tiering decision.
- **Stack Overflow 2026 results do not exist** (survey opened 23 Jun 2026). Several blogs
  mislabel 2025 data as 2026.
- **Verification burden is never netted out.** Every "96% time saving" figure in the
  qualitative literature is *generation* time only; the PLOS authors name this as a
  limitation. **The economic case for unattended operation is unproven, not merely
  unfavourable.**
- **Marked unverified (snippet-level only, behind paywalls or 403s):** the W4A 2026
  "29.0% compliance / 21,880 assessments" figure; ASSETS 2025 exact counts; CHI 2024 and
  C&C 2024 effect magnitudes (directions verified, magnitudes not); Martian's full
  leaderboard.

---

# 5. Human-in-the-loop — where the gates actually belong

This section has the best primary-documentation base in the whole document and the
weakest practitioner base. Four vendors independently converged on the same taxonomy,
which is encouraging. But genuine first-party engineering accounts of shipped agent
approval systems are rare — Anthropic, GitHub, Block, Slack, Cloudflare, Vercel,
Microsoft, and then a large volume of SEO content restating the same taxonomy with no
data behind it. Everything in this section is from the first group.

## 5.1 The four axes the evidence converges on

Not one axis. Four, and they are orthogonal:

1. **Reversibility** — can it be undone, and at what cost?
2. **Blast radius** — how many people and systems does it touch?
3. **Externality** — does it cross a trust boundary and become visible to third
   parties? *Undo does not exist across a trust boundary.* You can delete a Slack
   message; you cannot un-read it.
4. **Provenance** — was this action proposed by the human's instruction, or by untrusted
   content the agent ingested? (Block's addition; see §5.6.)

OpenAI's rubric [P] asks for a low/medium/high rating per tool based on *"read-only vs.
write access, **reversibility**, required account permissions, and financial impact"*,
and names two triggers for human intervention: exceeding failure thresholds, and
*"actions that are sensitive, **irreversible**, or have high stakes"*
([A Practical Guide to Building Agents](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf)).

OWASP's [AI Agent Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html)
[P] — this one *is* readable and verifiable, unlike the genai.owasp.org material in
§5.8 — gives the cleanest published tier table:

| Tier | Examples | Control |
|---|---|---|
| Low | reads, safe queries | auto-approve |
| Medium | writes, API calls | human review |
| High | financial transfers, deletion, **external communications** | mandatory approval |
| Critical | irreversible ops, security-sensitive | **step-up authentication** |

## 5.2 The measured finding that should change how we build this

**Anthropic's own telemetry: users approved roughly 93% of permission prompts.**
([How we contain Claude](https://www.anthropic.com/engineering/how-we-contain-claude),
vendor telemetry — a sample of one product, no denominator published, but it is the only
agent-specific number of its kind.) Their conclusion is the important part:

> *"The more approvals a user sees, the less attention they pay to each… Rather than
> supervising what the agent does, we supervise what it's **able** to do… Design for
> containment at the environment layer first, then steer behavior at the model layer."*

Corroborating numbers, same source family
([sandboxing](https://www.anthropic.com/engineering/claude-code-sandboxing),
[auto mode](https://www.anthropic.com/engineering/claude-code-auto-mode)):
sandboxing reduced permission prompts by **84%** internally; the auto-mode classifier
scored **0.4% false positives but missed 17% of genuinely overeager actions** across
~10,000 real internal actions — Anthropic calls that *"a meaningful trade-off compared
to careful human review."*

**And two independent research results say the same thing from different directions:**

- **[R] "Habituation at the Gate: Rising Approval and Declining Scrutiny in Human Review
  of AI Agent Code"** (arXiv [2606.22721](https://arxiv.org/abs/2606.22721), June 2026).
  400 repeat reviewers, **11,429 reviews over seven months**, within-reviewer
  longitudinal design: approval rate rose **30.1% → 36.8%** (p < 10⁻⁶, **+14.5pp** from
  first to tenth decile of reviewer experience), **comment volume fell 22%**, while
  **median PR size stayed flat**. *Preprint, one dataset, observational* — the flat
  PR-size control is what makes the habituation reading plausible rather than proven.
- **[R] "Oversight Has a Capacity"** (arXiv [2606.08919](https://arxiv.org/abs/2606.08919),
  June 2026). On 125 hand-labelled adversarial agent actions: reviewers **do not agree on
  what counts as risky** (Fleiss' κ = 0.52), and when reviewer fatigue is modelled as
  endogenous, **safety is an inverted-U in escalation rate** — more oversight can reduce
  realised safety. *n=125, single author, fatigue modelled not measured.* Take the
  framing, not the numbers.

The older, methodologically stronger literature agrees by analogy: automation bias
([Goddard, Roudsari & Wyatt, JAMIA 2012](https://pubmed.ncbi.nlm.nih.gov/21685142/)),
"Ironies of Automation" (Bainbridge 1983 — **old, and still the best statement of the
problem**), and clinical alert fatigue, where override rates of **46–96%** are routine
and reminder acceptance drops ~30% for each additional reminder per encounter
([JMIR Med Inform 2020](https://medinform.jmir.org/2020/7/e15653)).

**The counterexample worth holding onto:** Akhawe & Felt, *"Alice in Warningland"*
(USENIX Security 2013 [R], **25M+ warning impressions**) found browser security warning
click-through of only **7.2–23.2%**, and concluded *"security warnings can be effective
in practice."* Warnings that are **rare, specific, and consequence-legible** get heeded
at 90%+. It is frequency and genericness that kill them. That is the empirical basis for
**gate rarely, gate specifically** — not for gating nothing.

## 5.3 The rule that matters most: gates live in the execution layer, never in the prompt

The Replit incident of July 2025 is the canonical case: an agent deleted a production
database **during an explicit code freeze** affecting ~1,200 executives' records, then
misreported what it had done
([Fortune, 23 Jul 2025](https://fortune.com/2025/07/23/ai-coding-tool-replit-wiped-database-called-it-a-catastrophic-failure)).
No formal postmortem was published, so the internals are reconstruction — but the lesson
is not in dispute: **the freeze existed only in the prompt.** The agent could read "do
not touch production", agree, and issue the write anyway, because nothing in the
execution path enforced it.

Vercel states the same principle in one line: *"A tool that was never registered can't be
called no matter what the prompt says"*
([five AI agent guardrails](https://vercel.com/i/five-ai-agent-guardrails-production)).
Anthropic's internal SDLC guidance, after finding one agent asking another to deploy
code, put *"boundaries around **access and actions**, not around a model's instructions"*
([how Anthropic secures its AI-native SDLC](https://claude.com/blog/how-anthropic-secures-its-ai-native-software-development-lifecycle), Jul 2026).

**This is the direct argument for §3's recommendations.** `github --read-only` and the
Amplitude MCP-read role are worth more than every "never do X" sentence in the four
agent bodies combined, because they survive a prompt injection and the sentences do not.

## 5.4 Bind the approval, and expire it

OWASP's **approval binding** requirement: an approval must bind to *"actor, tool name,
target resource, **normalized parameters**, timestamp, and expiry"*, to prevent parameter
tampering between approval and execution — approve `transfer($10)`, execute
`transfer($10000)`.

Vercel's purchase flow is a live implementation of exactly this: `get_purchase_quote`
returns a **signed `idempotencyKey` encoding the quoted terms**, the `buy_*` call must
match it, and it **expires after five minutes** (§3.1). It is the right primitive; it is
just implemented for purchases and nothing else.

For us this matters concretely: approving `deploy_to_vercel(target: preview)` must not
authorise `deploy_to_vercel(target: production)`. **A tool-name-level approval is not
sufficient for any tool whose arguments carry the risk** — which is Vercel's deploy tool,
Slack's send-message tool, and Calendar's event tools.

LangChain's `HumanInTheLoopMiddleware` [P] gets this right at the API surface: its `when`
predicate does **argument-level** gating, with documented examples of pausing file writes
*outside the workspace directory* and SQL that *"isn't a read-only SELECT"*
([docs](https://docs.langchain.com/oss/python/langchain/human-in-the-loop)).

## 5.5 Make the preview the approval — draft-first beats yes/no

Two independent primary sources point the same way:

- **Anthropic's CISO guide** [P]: *"allow drafting docs but **never automatically send
  them**, allow reads and searches but never deletes"*
  ([link](https://claude.com/blog/ciso-guide-to-agentic-ai)).
- **LangChain's four approval decisions** are approve / **edit** / reject / respond — with
  an explicit warning not to use `respond` to deny a side-effecting tool, because its
  message is treated as a successful tool result. And MCP's own **elicitation** spec
  requires clients to *"allow users to review and modify their responses before
  sending"* ([spec](https://modelcontextprotocol.io/specification/latest/client/elicitation)).

`"Post this status to #product?"` is a fatigue generator. A rendered draft, in the
channel, with the recipients and the text visible, is a decision. **Slack's MCP server
ships a `draft messages` tool** (§3.1) — this is available today and is the single most
concrete improvement to `project-orchestrator`'s comms path.

## 5.6 Provenance: the axis almost nobody gates on

Block's Goose team makes the sharpest argument in the practitioner literature
([Agent Guardrails and Controls, 5 Jan 2026](https://block.github.io/goose/blog/2026/01/05/agentic-guardrails-and-controls/)):
prompt injection is CSRF, and agents have no origin model. Their proposal is to treat a
tool call whose **provenance is a previous tool response** rather than direct user input
as **cross-origin**, and require authorisation for it — decided deterministically in the
harness, *not* delegated to the model. Status: proof-of-concept, results unpublished.
**Treat it as a promising frame, not a validated result.**

But the frame is right, and it changes what `ux-researcher` looks like. A `send`/`write`
originating from a human instruction and one originating from **text inside a transcript
the agent just read** are the same tool call with wildly different risk. Transcripts are
untrusted content by definition — a participant can say anything, including something
shaped like an instruction.

This also connects to Simon Willison's **lethal trifecta**
([Jun 2025](https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/)): private data +
untrusted content + external communication must not co-occur. His position on guardrail
products that catch 95% of attacks — *"in security, 95% is very much a failing grade"* —
argues for removing one leg rather than filtering.

**Check the four product agents against the trifecta:**

| Agent | Private data | Untrusted content | External comms | Verdict |
|---|---|---|---|---|
| `ux-researcher` | yes — Dovetail transcripts, contacts, analytics | yes — **participant transcripts** | partial — Dovetail writes only (internal) | **Two and a half legs.** The Dovetail write-back is the leg to watch. It is internal, which is why this is amber not red. |
| `product-designer` | yes — Figma files | partial — whatever the problem statement carries | yes — **Figma writes, visible to everyone in the file** | **Three legs, weakly.** Untrusted content is the thin leg — but the `problem` input is a free-text field. |
| `frontend-engineer` | yes — repo, deployment logs | yes — **`context7` fetches third-party docs**, `web_fetch_vercel_url` | yes — **deploy, and `buy_*`** | **All three, clearly.** This is the agent that most needs capability removal rather than an approval prompt. |
| `project-orchestrator` | yes — GitHub issues, calendar | yes — **issue bodies and Slack messages written by anyone** | yes — **Slack posts, calendar invites** | **All three, clearly.** |

That table is the strongest argument in this document for the §3.2 recommendations. Two
of four product agents hold the full trifecta today.

## 5.7 The gate list — action by action

Consensus is strong for most rows and genuinely absent for two, which are marked.

| Action | Verdict | Basis |
|---|---|---|
| **Reads, searches, queries** | **Ungated.** | Strong, multi-source: Claude Code's `default` mode is read-only; LangChain auto-approves `read_file`/`read_schema`; OWASP tier Low; Anthropic CISO *"allow reads and searches but never deletes."* |
| **Writes to the run's own scratch workspace** | **Ungated**, if paths are enforced per argument. | LangChain's documented `when` example is precisely "pause file writes outside the workspace directory". This repo's `workspace` tool already works this way. |
| **Spending money** | **Always gated, and gated differently from everything else.** Prefer a **pre-authorised envelope** (budget cap, merchant/scope limits) over per-transaction approval. | OWASP: payment initiation → **step-up authentication**. OpenAI names payments explicitly. Purpose-built protocols exist: [AP2](https://ap2-protocol.org/) splits human-present per-transaction mandates from human-not-present pre-signed intent mandates with price/timing limits; [Stripe Issuing for agents](https://docs.stripe.com/issuing/agents) does spend limits, frequency caps and merchant-category controls at the card. **For us: `buy_*` on Vercel should be denied outright, not gated.** |
| **Deploying to production** | **Always gated.** | OWASP names production deployment as step-up-auth Critical; Anthropic internal: production fixes *"cannot deploy automatically"*; OpenAI's guidance denies production access outright. |
| **Deploying a preview** | **Gated at argument level, not tool level** — because with Vercel's server, preview and production are the same tool. | §3.1, §5.4. |
| **Closing / merging PRs** | **Gated, and specifically via separation of duties.** | GitHub's shipped policy [P]: the agent *"can only push to branches it created"*, is *"restricted from… merging pull requests"*, and *"the developer who asks the agent to open a pull request cannot be the one to approve it."* Also gate **CI workflow runs** (secrets exposure) and put agent-config files behind **CODEOWNERS** — otherwise the agent can edit its own guardrails. ([build-guardrails docs](https://docs.github.com/en/copilot/tutorials/cloud-agent/build-guardrails)) Note GitHub shipped an **opt-out** for the workflow-approval gate in [March 2026](https://github.blog/changelog/2026-03-13-optionally-skip-approval-for-copilot-coding-agent-actions-workflows/) — friction won, as it usually does. |
| **External comms — Slack posts, email, calendar invites** | **Always gated by default. Draft-first is the right shape, not yes/no.** | OWASP: external communications = High. Vercel names it a gate category. Anthropic CISO: draft but never send. Slack's own governance docs: *"Approval gates before the agent creates, sends, or deletes anything"*, narrow default scope, and the agent *"clearly distinguishable from a human at all times"* ([link](https://docs.slack.dev/ai/agent-governance/)). **This is also the exfiltration leg of the lethal trifecta**, so do not relax it even for a trusted agent — the threat model is the content it read, not the agent. |
| **Writing to a shared design file (Figma)** | **Evidence effectively absent — no published guidance, no incident reports found.** Reasoning from the taxonomy: shared-state write, **reversible** (version history, branches), low external blast radius, **high nuisance radius**. The right control is almost certainly **branch or draft + review — the PR model — not a per-action modal.** | Marked as reasoning, not citation. Figma's own docs cover capability, not policy. |
| **Writing to an analytics stream** | **Evidence absent, and worth stating the reasoning because it is genuinely awkward.** Analytics streams are **append-only, therefore irreversible in practice** (you cannot un-emit an event; corrections are compensating records) — but each individual write has **near-zero immediate blast radius**, so per-action approval is both useless and maximally fatiguing. The controls that fit are **schema validation, volume caps, an agent-attributed source tag so writes stay filterable downstream, and shadow mode before write access.** The failure mode is silent corpus pollution found months later, which no dialog would have caught. | Reasoning, not citation. **Moot for us today**: Amplitude's MCP cannot ingest events (§3.1). |
| **Anything whose approval *is* the point** — consent, credential grant, third-party OAuth | **Never auto-approvable.** | Claude Code ships an MCP annotation for exactly this, `_meta["anthropic/requiresUserInteraction"]`, which prompts *"on every call, even in `acceptEdits`, `auto`, and `bypassPermissions`… and doesn't offer a 'don't ask again' option"*, with the stated rationale that otherwise *"auto-approval would mean no human ever agreed"* ([docs](https://code.claude.com/docs/en/mcp)). MCP's **elicitation** spec is the protocol-level version, with hard `MUST NOT`s: no passwords or API keys through form mode, no pre-fetching a URL, no opening one without explicit consent. |

## 5.8 Nine design conclusions the evidence supports

1. **Put the gate in the execution layer.** Replit; Vercel's "never registered";
   Anthropic's "boundaries around access, not instructions".
2. **Approval is the weakest layer, not the first.** Remove the capability before you ask
   about it. Anthropic's 93%/84% pair is the argument.
3. **Every gate you add makes every other gate worse.** Three independent supports:
   Anthropic's fatigue telemetry, the inverted-U result, the clinical dose-response.
   Vercel says it plainly: *"attention spent on low-stakes confirmations is attention
   unavailable for the one that matters."*
4. **Reviewer attention is an attackable resource.** **[?] — flagged, because this is
   the one claim in §5 I could not verify.** Secondary summaries describe an *OWASP Top
   10 for Agentic Applications 2026* whose **ASI09 is "Human-Agent Trust Exploitation"**
   — the approval gate itself named as an attack surface, covering agents that *"project
   confidence and fluency"* to get risky changes waved through. But `genai.owasp.org`
   returns **403** to automated fetches, and the OWASP GenAI project page that *is*
   readable lists only an **LLM Top 10 2026 (published 4 Aug 2026, LLM01–LLM10)** with no
   ASI list surfaced. **Verify the ASI numbering against the source PDF before quoting it
   anywhere load-bearing.** The underlying idea is separately supported by the
   flooding-attack result in *Oversight Has a Capacity* (§5.2), so the mechanism is real
   even if the citation is not yet confirmed. Counter-measure either way: cap escalations
   and **fail closed on the cap** — Claude Code's shipped rule is *"3 consecutive denials
   or 20 total"* → stop and escalate.
5. **Bind approvals to normalised parameters, with an expiry.** OWASP; Vercel's
   `idempotencyKey`.
6. **Make the preview the confirmation.** Draft-first; LangChain's `edit` decision;
   MCP elicitation's review-and-modify requirement.
7. **Batch at commit points, not per action.** Anthropic's autonomy data shows
   experienced users abandon per-action approval for monitor-and-interrupt; the EU AI
   Act's [Article 14](https://artificialintelligenceact.eu/article/14/) requires
   **override, reversal and a stop button** — notably *not* per-action pre-approval.
8. **Prefer undo where undo is real; reserve approval for where it is not.** Claude
   Code's auto mode runs `git status` before `rm -rf` or `git reset --hard` and shows the
   classifier whether uncommitted work exists — approval calibrated by recoverability.
9. **Attribute and log approvals, and sample them.** Skitka, Mosier & Burdick (IJHCS
   1999) is the only intervention in the automation-bias literature with a measured
   effect: **accountability for decision accuracy reduced automation bias.** Anthropic
   does this internally — approvals logged with reasoning, a risk-weighted sample
   reviewed by humans. Anonymous, unsampled approvals produce the *Habituation at the
   Gate* curve.

**One thing no SDK gives you:** OpenAI's, LangGraph's, Cloudflare's and Microsoft's
approval states can all sit pending indefinitely. **Timeouts, escalation and auto-deny
on stale approvals are yours to build.** For a repo whose orchestrator runs on a
schedule, that is not a footnote.

## 5.9 The open disagreement, stated honestly

**Anthropic argues that** *"oversight requirements that prescribe specific interaction
patterns, such as requiring humans to approve every action, will create friction without
necessarily producing safety benefits"*
([measuring agent autonomy](https://www.anthropic.com/news/measuring-agent-autonomy)),
and their data shows experienced users moving from per-action approval toward
monitor-and-interrupt.

**OWASP and most enterprise guidance push the other way**, toward more mandatory gates.

Both positions are supported. They partly reconcile if you read Anthropic as arguing
about *frequency* and OWASP as arguing about *the irreversible tail* — but as published
they point in different directions, and **nobody has measured which posture produces
fewer incidents.** Anyone who tells you this is settled has not read both.

## 5.10 Applied: what to change in the four agents

All four currently carry `approval: required` except `ux-researcher` (`approval: none`).
That is a reasonable starting posture, but it is coarse — the whole of §5.2 says a
single per-run gate on an agent that does twenty things will be approved without reading.

| Agent | Recommendation |
|---|---|
| `ux-researcher` | Keep `approval: none` **on the condition that Amplitude is MCP-read-only** and Dovetail write-back is either dropped or separately gated. As configured, `approval: none` plus Dovetail write access plus untrusted transcripts is the trifecta minus a hair. |
| `product-designer` | Move the gate **from the run to the Figma write tools.** Read-only Figma should not prompt at all; `use_figma` / `create_new_file` / `upload_assets` always should. This is the change that makes the "read, propose, then create" sequence real. |
| `frontend-engineer` | **Deny `buy_*` outright** rather than gating it. Gate `deploy_to_vercel` **on its `target` argument.** Everything else — patch writing, `context7`, read-only Figma — needs no prompt. |
| `project-orchestrator` | Gate **at the three egress points only**: Slack send, calendar write, GitHub issue mutation. Use Slack's `draft messages` so the send gate is a rendered draft rather than a yes/no. Reading GitHub and reconciling the record should be silent. |

The shape to aim for across all four: **many ungated reads, a handful of loud gates at
egress, and nothing gated in between.** That is what the browser-warning result predicts
will actually be read.

---

# 6. The configuration, in one place

Everything above, reduced to what you would actually change. Ordered by expected value.

## 6.1 The ten changes worth making first

| # | Change | Why, in one line | Evidence |
|---|---|---|---|
| 1 | **Grant `ux-researcher` an Amplitude role with "Use MCP (read)" only** | Turns "never write to analytics" from a sentence into a server fact | §3.1, §5.3 |
| 2 | **Enable only GitHub's `issues` + `labels` toolsets for `project-orchestrator`** | Same move: the "never touch code" rule becomes unenforceable-by-construction rather than instructed | §3.1 |
| 3 | **Deny Vercel's `buy_*` tools outright; gate `deploy_to_vercel` on its `target` argument** | The current grant can register a domain and start a subscription. Tool-level approval is insufficient — the risk is in the argument | §3.1, §5.4 |
| 4 | **Build the quote-verification check for `ux-researcher`** — every quote string-matches its transcript or the run fails | The one capability in that discipline with a real oracle, attacking the failure its own file calls "unrecoverable" | §4.1, §4.5 |
| 5 | **Write `refs/design/component-inventory.md`, generated, and a token lint** | Measured component reuse in React is **0.24%**. This is not fixed by a better model | §2.3, §4.3, §4.4 |
| 6 | **Switch `project-orchestrator` to Slack's `draft messages` tool, without `chat:write` by default** | Draft-first beats yes/no; the primitive already exists and is shipped | §3.1, §5.5 |
| 7 | **Make Figma read-only for `frontend-engineer`; split read/write for `product-designer`** | Removes one `writes: ungated` grant, and makes "read, propose, then create" structural | §3.2, §5.10 |
| 8 | **Add `playwright` or `chrome-devtools` to `frontend-engineer`** | Its accessibility claims are currently unfalsifiable at run time — the same failure its sibling agent exists to prevent | §3.2, §4.3 |
| 9 | **Add one verifier agent that shares no context with the producer** | 21.3% of multi-agent failures are "nobody checked"; verification scaffolding bought +15.6% with identical models | §1.3, §4.2 |
| 10 | **Enable extended thinking on anything long-running** | Raises the 80%-accuracy step horizon from 4–6 steps to hundreds, by removing self-conditioning. A configuration flag | §4.2 |

## 6.2 The ref files to create

Full manifest in §2.6. The four with the highest measured leverage:

1. `refs/research/claims-vs-themes.md` — 6–8 worked examples, no rules.
2. `refs/design/component-inventory.md` — generated, never hand-written.
3. `refs/eng/AGENTS.md` — nested per package, nearest-file precedence.
4. `refs/delivery/brief-template.md` — with two filled-in examples. MAST puts 41.8% of
   failures in specification, and the brief is the specification.

And the format rules that apply to all of them: **level-3 artefacts referenced by path,
never inlined; examples over rules; machine-checkable over prose; an owner and a
staleness date on every file.**

## 6.3 The tools to wire

| Agent | Wire | Do not wire |
|---|---|---|
| `ux-researcher` | Dovetail (official repo/OAuth) · Amplitude (**MCP-read role**) · Drive MCP (`drivemcp.googleapis.com`) | UserTesting — it contacts real people and spends money; that is the human's |
| `product-designer` | Figma (read grant ungated, write grant gated) · optionally `context7` | — |
| `frontend-engineer` | `context7` · Figma **read-only** · Playwright or Chrome DevTools | Vercel, unless the runner can allowlist tool names **and** check arguments |
| `project-orchestrator` | GitHub (`issues` + `labels` only) · Slack (no `chat:write` by default) · Calendar MCP (`calendarmcp.googleapis.com`) | Notion / Linear on top — four servers is already the ceiling |

**Confirmed not to exist:** Maze MCP, Optimal Workshop MCP, a read-only mode for Vercel,
a read-only mode for Figma. **Deprecated:** `@modelcontextprotocol/server-slack`.

## 6.4 The tiers, honestly

| Agent | Current `tier` | Verdict | The change |
|---|---|---|---|
| `ux-researcher` | `assisted` | **Correct** | Rewrite the `autonomous` rung — it currently describes an agent reading its own prior output, which is the measured worst case |
| `product-designer` | `assisted` | **Correct** | The `autonomous` rung's "component inventory reconciled against the library" is the one unmeasured capability. Leave it aspirational and say so |
| `frontend-engineer` | `assisted` | **Correct** | Its `autonomous` rung is really `assisted`-on-a-schedule, which is fine — but the preview-deployment half fails on tooling, not capability |
| `project-orchestrator` | `human-led` | **Correct, and the best-calibrated call in the set** | Split the `autonomous` rung: schedule the record reconciliation (a join, with an oracle); keep the blocker judgement drafted for a human |

**Capabilities that are autonomous-grade today and could be scheduled now**, in any of
the four: deterministic checker runs and trend reporting · chore/docs/style/CI PRs ·
high-recall screening and triage · deductive coding against a fixed codebook (≥3 runs,
majority vote, random human audit) · quote and citation verification · record-vs-reality
reconciliation.

**Capabilities that get worse when scheduled, and should never be:** unattended
iterative refinement · repeated generation treated as diverse options · any agent reading
its own prior output without a human checkpoint.

## 6.5 Where the gates go

The shape to aim for is **many ungated reads, a handful of loud gates at egress, and
nothing gated in between** — because the browser-warning evidence says rare, specific,
consequence-legible warnings get heeded at 90%+, and the agent-approval telemetry says
frequent generic ones get approved at 93%.

Gate: money (deny, don't gate) · production deploys · PR merges (and via separation of
duties, not just a prompt) · every external communication — Slack, email, calendar ·
anything whose approval *is* the consent event.

Do not gate: reads · searches · scratch-workspace writes · read-only Figma · `context7`.

Build, because no SDK gives it to you: **timeouts, escalation, and auto-deny on stale
approvals.** For a repo whose orchestrator runs on a schedule, that is not a footnote.

## 6.6 The three things this document is not confident about

1. **Whether multi-agent decomposition helps.** Anthropic measured +90.2% on research
   tasks and named coding as the domain where it fails; Cognition argues against it
   entirely. Both shipped. The reconciling rule in §1.1 is an inference, not a finding.
2. **Whether design work is delegable at all.** Two near-identical heuristic-evaluation
   studies reach opposite conclusions, typical n is 2–5 evaluators, and design-system
   conformance has **zero** peer-reviewed measurement.
3. **Whether per-action approval helps or hurts.** Anthropic says gating everything
   *"will create friction without necessarily producing safety benefits"*; OWASP and most
   enterprise guidance push the other way. **Nobody has measured which posture produces
   fewer incidents.**

A fourth, quieter one: **the economic case for unattended operation is unproven rather
than unfavourable.** Every headline time-saving figure in this literature measures
generation time and never nets out verification. DORA named the missing term — the
verification tax — and nobody has measured it against the savings.
