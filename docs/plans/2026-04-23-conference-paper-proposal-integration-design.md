# Conference Paper Proposal Integration Design

**Context:** The conference paper already contains a compact IEEE-style manuscript, a draft template with placeholders, and a BibTeX file. A proposal PDF in `conference-paper/1301223150_MUHAMMAD RAIHAN RAFLIANSYAH (1).pdf` provides additional academic framing, research gap articulation, system architecture rationale, testing rationale, and reference candidates.

**User Intent:** Strengthen `conference-paper/draft paper app template.md` and `conference-paper/main.tex` using material from the proposal, add the supporting references to `conference-paper/references.bib`, and fix why `table 2` appears near the conclusion even though it is declared before `\section{Conclusion}`.

## Scope

- Transfer medium-depth proposal content into the conference paper:
  - stronger introduction and motivation,
  - clearer research gap and novelty,
  - stronger architecture and methodology framing,
  - slightly richer conclusion.
- Add selected proposal references that improve the literature base without bloating the paper.
- Fix `table 2` float behavior in the IEEE two-column layout.

## Constraints

- Keep the paper conference-length and concise.
- Reuse proposal ideas in compressed form instead of mirroring the proposal structure.
- Preserve existing verified metrics and placeholders.
- Avoid introducing citation keys that are not backed by `references.bib`.

## Recommended Approach

1. Enrich each paper section with only the most paper-relevant proposal content:
   - `Introduction`: hotel PMS reactivity problem, real-time messaging need, lifecycle framing.
   - `Related Work`: explicit research gap between adoption/perception studies and deployable operational systems.
   - `System Overview`: cloud/API/webhook/realtime rationale.
   - `Methodology`: black-box/integration/performance-testing framing from the proposal.
   - `Conclusion`: practical implications and future work.
2. Add a small set of high-signal references from the proposal:
   - hotel IT strategy,
   - AI agents and customer loyalty,
   - real-time monitoring,
   - web API ecosystem,
   - web/performance testing.
3. Fix `table 2` by both reducing its float pressure and moving its declaration earlier in the source so IEEEtran has room to place it before the conclusion.

## Why Table 2 Drifts

In `IEEEtran` two-column layouts, tables are floats and are strongly biased toward top-of-column placement. A table declared late in a section may be deferred if the remaining column/page cannot accommodate it under the float rules. This can cause the table to appear at the top of a later column or page, visually near or after the conclusion even when the source declaration is above `\section{Conclusion}`.

## Success Criteria

- `conference-paper/draft paper app template.md` reflects the proposal's academic framing in a concise way.
- `conference-paper/main.tex` reads stronger academically and cites the new references correctly.
- `conference-paper/references.bib` includes the added sources in IEEE-compatible BibTeX.
- `table 2` is made materially less likely to drift to the conclusion area by improved float placement strategy and compaction.
