# Conference Paper Proposal Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Strengthen the conference paper and template with proposal-derived academic framing, add missing references to the BibTeX file, and reduce IEEE float drift so `table 2` stays near the token-efficiency discussion instead of the conclusion area.

**Architecture:** The work is document-first: enrich the paper narrative in place, keep placeholders and verified metrics intact, and update the bibliography so every new citation resolves cleanly. Treat the float issue as a LaTeX layout problem by reducing float pressure and moving the ablation table declaration earlier in the document flow.

**Tech Stack:** Markdown, LaTeX (`IEEEtran`), BibTeX

---

### Task 1: Add proposal-backed references

**Files:**
- Modify: `conference-paper/references.bib`
- Reference: `conference-paper/1301223150_MUHAMMAD RAIHAN RAFLIANSYAH (1).pdf`

**Step 1: Review the existing bibliography and identify missing proposal references**

Check whether these proposal-backed sources already exist:
- hotel IT strategy,
- AI agents and customer loyalty,
- real-time monitoring,
- web API digital ecosystems,
- web application testing,
- performance testing as a service.

**Step 2: Add only the missing BibTeX entries**

Use IEEE-compatible fields and stable citation keys.

**Step 3: Verify consistency**

Make sure each new key is plausible for later `\cite{...}` usage and that there are no duplicate keys.

### Task 2: Strengthen the paper template

**Files:**
- Modify: `conference-paper/draft paper app template.md`
- Reference: `conference-paper/1301223150_MUHAMMAD RAIHAN RAFLIANSYAH (1).pdf`

**Step 1: Update the introduction and methodology framing**

Add concise proposal-derived statements about:
- reactive PMS limitations,
- need for real-time guest communication,
- lifecycle automation framing,
- integration and testing rationale.

**Step 2: Strengthen related gap and novelty language in the results/discussion framing**

Compress proposal research-gap ideas into conference-paper style language.

**Step 3: Preserve placeholders**

Do not replace existing metric placeholders unless already verified elsewhere.

### Task 3: Strengthen `main.tex`

**Files:**
- Modify: `conference-paper/main.tex`
- Modify: `conference-paper/references.bib`
- Reference: `conference-paper/1301223150_MUHAMMAD RAIHAN RAFLIANSYAH (1).pdf`

**Step 1: Enrich core sections**

Update:
- `Introduction`
- `Related Work`
- `System Overview`
- `Methodology`
- `Conclusion`

Use concise proposal-backed additions only.

**Step 2: Add citations**

Insert citations for the new references where they naturally support claims about:
- hotel IT strategy and digital integration,
- AI agents and loyalty,
- real-time monitoring,
- API ecosystems,
- testing and cloud performance testing.

**Step 3: Keep metrics stable**

Retain the already verified metric values/placeholders in the current manuscript.

### Task 4: Fix `table 2` float behavior

**Files:**
- Modify: `conference-paper/main.tex`

**Step 1: Reduce float pressure**

Keep the ablation table compact:
- `\footnotesize`,
- smaller `\tabcolsep`,
- short headers,
- fixed-width columns.

**Step 2: Move declaration earlier**

Move the ablation table block upward so it is declared before the very end of the token-efficiency subsection, giving `IEEEtran` more room to place it before the conclusion.

**Step 3: Add supporting nearby text if needed**

Ensure the discussion introduces the table before the conclusion section begins.

### Task 5: Verify edited files

**Files:**
- Check: `conference-paper/main.tex`
- Check: `conference-paper/draft paper app template.md`
- Check: `conference-paper/references.bib`

**Step 1: Read the updated file regions**

Confirm the final text is coherent and citations align with bibliography keys.

**Step 2: Run available verification**

Run `ReadLints` on changed files. If LaTeX tooling is unavailable, report that limitation explicitly.

**Step 3: Summarize what changed**

Report the strengthened sections, the added references, and the table-placement strategy.
