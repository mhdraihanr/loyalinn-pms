# Main TeX and Related Work Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a clean `main.tex` as the primary IEEE conference manuscript file and strengthen the literature grounding by adding focused hospitality/chatbot/GenAI references plus a stronger `Related Work` section.

**Architecture:** Keep `references.bib` as the single bibliography source, create `main.tex` as the final paper entrypoint, and preserve `paper-ieee-skeleton.tex` as a draft artifact. Expand the bibliography with a small number of high-relevance hospitality/tourism AI studies, then structure `Related Work` into concise subthemes so the paper stays short-paper friendly.

**Tech Stack:** LaTeX (`IEEEtran`), BibTeX (`IEEEtran` style), Markdown plan/docs, Exa-derived reference metadata.

---

### Task 1: Expand Bibliography

**Files:**
- Modify: `references.bib`
- Check: `draft paper app template.md`

**Step 1: Add 5 focused references**

Add entries that directly support:
- generative AI in hospitality/tourism,
- chatbot adoption in hospitality/tourism,
- conversational AI review/systematic review,
- hospitality AI assessment/adoption frameworks.

**Step 2: Keep citation keys readable**

Use stable keys such as:
- `pillai2020adoption_chatbots`
- `han2025chatgpt_use`
- `huang2022ai_assessment`
- `thu2026chatbot_landscape`
- `mich2023chatgpt_etourism`

**Step 3: Verify metadata shape**

Ensure each entry has:
- author
- title
- journal or booktitle
- year
- volume/number/pages when known
- DOI when known

### Task 2: Create Main IEEE Manuscript

**Files:**
- Create: `main.tex`
- Reference: `paper-ieee-skeleton.tex`

**Step 1: Use `paper-ieee-skeleton.tex` as source**

Keep:
- title
- abstract placeholders
- methodology placeholders
- results placeholders
- bibliography wiring

Improve:
- section order
- author block comments
- placeholder notes
- readability of table and section structure

**Step 2: Add `Related Work` section**

Organize into 3 concise blocks:
- generative AI in hospitality and tourism,
- chatbot/conversational AI adoption in hospitality,
- research gap for reliable event-driven lifecycle AI systems.

**Step 3: Keep paper concise**

Do not expand into full thesis-style literature review.
Use 2-4 paragraphs total plus citations.

### Task 3: Strengthen Citations in Body

**Files:**
- Create: `main.tex`

**Step 1: Cite literature where it matters**

Use citations in:
- Introduction
- Related Work
- System Overview

**Step 2: Align claims with citations**

Examples:
- general GenAI hospitality context -> `dwivedi2024chatgpt_hospitality`, `wang2025personalizing_guest_experience`, `saleh2025genai_hospitality`
- chatbot adoption/service encounter literature -> `sam2025chatbots_hospitality_review`, `pillai2020adoption_chatbots`, `romerocharneco2025whatsapp_chatbots`
- tourism conversational AI trend/gap -> `han2025chatgpt_use`, `thu2026chatbot_landscape`, `mich2023chatgpt_etourism`

### Task 4: Final Consistency Check

**Files:**
- Read: `main.tex`
- Read: `references.bib`

**Step 1: Verify citation keys match**

Check that all `\cite{...}` keys in `main.tex` exist in `references.bib`.

**Step 2: Verify placeholders remain intact**

Do not replace numeric placeholders yet; they must stay aligned with `result-sheet.md`.

**Step 3: Leave compile for later**

Do not claim PDF compilation success unless a LaTeX build is actually run.
