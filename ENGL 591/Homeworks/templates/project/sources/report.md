<!--
  REPORT SOURCE. Edit the text; the build handles numbering, contents, captions, citations and layout.

  Syntax
    # Heading {#id}              numbered section, starts a new page       # Abstract {.unnumbered}
    ## Subheading {#id}          numbered subsection (2.1, 2.2 …)
    **bold**  *italic*  - bullet lists  <!- - comments - ->
    [@key]  → (Author et al., 2020)      @key → Author et al. (2020)      [@key, Table 1] → (…, 2020, Table 1)
    [[table:id]] [[figure:id]] [[section:id]]  → Table 1 / Figure 2 / Section 3.1   (auto-numbered)
    ::: contents :::   ::: references :::   ::: table id … :::   ::: figure id … :::

  Rules the build enforces (RULES.md): every decimal number must be in facts.md; every citation must exist in
  references.bib; no informal wording ("pretty", "a lot of", contractions, "I think").
  Structure follows Ch. 3 (mini template: Abstract, Introduction, Methodology, (Expected) Results, Discussion,
  Conclusion). For a full report, add: Acknowledgements, Background, Appendices.
-->

# Abstract {.unnumbered}

<!-- 3–4 sentences for a mini report, 100–250 words for a full one. Background → Aim → Method → Results → Conclusion,
     with numbers (Ch. 2). -->
This report reviews a method for an important task in natural language processing. The reviewed study applies a transformer model [@vaswani2017] to three datasets and compares it with a baseline. The proposed model achieved higher accuracy on all three datasets, with gains of 1.3 to 7.7 percentage points. These findings indicate that the approach is effective, although the smallest gain was observed on Dataset C.

**Keywords:** keyword one, keyword two, keyword three

::: contents :::

# Introduction {#introduction}

<!-- Problem, context, objective, why it matters, and an outline of the report (Ch. 3, slide 11). -->
State the problem and its context here. Explain why it matters, and cite the work that motivates it [@devlin2019].

The objective of this report is to review the study, summarize its results, and discuss its strengths and limitations. The remainder of this report is organized as follows: [[section:methodology]] describes the method, [[section:results]] presents the results, [[section:discussion]] discusses them, and [[section:conclusion]] concludes.

# Methodology {#methodology}

<!-- Tools, datasets, methods, preprocessing, training, evaluation metrics, hardware/software (Ch. 3, slide 13). -->
Describe the approach of the reviewed study. The pipeline is illustrated in [[figure:pipeline]], and the datasets are listed in [[table:datasets]].

::: figure pipeline
type: flow
width: 560
caption: Pipeline of the reviewed method
note: Based on the description in @devlin2019.
steps:
  - { title: Data,       lines: [collect, and clean] }
  - { title: Model,      lines: [pre-train, the encoder] }
  - { title: Fine-tune,  lines: [on labeled, data] }
  - { title: Evaluate,   lines: [accuracy on, 3 datasets] }
:::

::: table datasets
caption: Datasets used in the evaluation
data: results
columns:
  - { key: dataset, label: Dataset }
  - { key: domain,  label: Domain }
  - { key: size,    label: Size }
widths: [2, 2, 1]
note: EXAMPLE VALUES. Replace with the datasets of the reviewed study.
:::

# Results {#results}

<!-- For a review: the authors' reported results, always attributed. For a proposal: "Expected Results". -->
As shown in [[table:results]], the proposed model outperformed the baseline on all three datasets. The largest gain was observed on Dataset A, where accuracy increased from 80.5% to 88.2%.

::: table results
caption: Accuracy (%) of the baseline and the proposed model
data: results
columns:
  - { key: dataset,  label: Dataset }
  - { key: baseline, label: Baseline, decimals: 1 }
  - { key: proposed, label: Proposed, decimals: 1 }
bold: row-max
note: EXAMPLE VALUES. Bold marks the best score per dataset.
:::

[[figure:results-chart]] shows the same comparison graphically.

::: figure results-chart
type: grouped-columns
data: results
category: dataset
series:
  - { key: baseline, label: Baseline, role: baseline }
  - { key: proposed, label: Proposed, role: subject }
y: { min: 0, max: 100, ticks: [0, 25, 50, 75, 100], label: Accuracy (%) }
caption: Accuracy of the baseline and the proposed model
note: EXAMPLE VALUES.
:::

# Discussion {#discussion}

<!-- Real-world meaning, limitations, recommendations (Ch. 3, slide 15). Mark your own assessments as such. -->
Interpret the results. Then list the limitations:

- **First limitation.** Explain it, with a number where possible.
- **Second limitation.** Explain it.

# Conclusion {#conclusion}

<!-- Restate the objective and the outcomes. No new information (Ch. 3, slide 16). -->
Summarize what was reviewed, what it achieved, and the main direction for future work.

# References {.unnumbered}

::: references :::
