# ML Labs Exam — Study Plan (ML_LABS_EXAM_001 → retake)

## Where you stand
**Attempt 1: 54/120 (45%)** — T/F 7/10 · MCQ 20/30 · Code 19/36 · Open 0/30 · Fill 8/14.
Strengths: transforms, NumPy, CNN shape math, ReLU/loss recall, matplotlib basics. The 66 missing points come from just a handful of gaps (below) + **30 points of unanswered open questions**.

## The materials
| File | What it covers |
|---|---|
| `Study_01_Labs_1-3_Jupyter_Plot_Numpy.md` | Jupyter modes, matplotlib, NumPy (dtype, axis, broadcasting, random) |
| `Study_02_Labs_4-5_Tensors_Autograd.md` | tensor creation/copy-vs-share, cat/mul, in-place `_`, autograd, backward/step/zero_grad, freeze |
| `Study_03_Labs_6-7_NN_and_nnModule.md` | resnet, Linear/Conv/ReLU/Softmax, output-size formula, `class Net`, training loop basics |
| `Study_04_Labs_8-9_Transforms_Dataloaders_Classifier.md` | ToTensor/Normalize, DataLoader, CIFAR-10 full pipeline, logits/argmax, no_grad |
| `Study_05_Lab10_Augmentation_and_Exam_Review.md` | 4 augmentation families + **all 47 questions mapped, model answers for Q32–Q37** |

## The method (per guide, ~45–60 min)
1. **Read** the guide once without stopping.
2. **Run** the actual notebook cells it refers to (Labs 1→10 in order).
3. **Retype** the key code block from memory (training loop, Net class, shape trace).
4. **Self-check:** answer every numbered question **out loud**, then compare with the answer lines.
5. Tick the exam-question IDs you now own (each guide flags them with ⚠).

## Your 7 targeted weak areas → where they're fixed
| # | Gap (attempt 1) | Guide section |
|---|---|---|
| R1 | logits vs probabilities (q5, q24) | G4 §loss + §testing |
| R2 | copy vs share (q17, q31) | G2 §cheat-sheet + §bridge |
| R3 | axis semantics (q14) | G1 §axis |
| R4 | Normalize ranges (q23, q43) | G4 §transforms |
| R5 | eval protocol & loop (q28, q34, q41, q42, q47) | G4 §loop + G5 Q34 |
| R6 | Jupyter + squeeze (q38, q46) | G1 §Jupyter + G4 §viz |
| R7 | **Open questions (q32–q37 = 30 pts)** | G5 §model answers — **highest ROI** |

## Suggested schedule
- **Day 1:** G1 + G2 (Labs 1–5) — fixes R2, R3, R6.
- **Day 2:** G3 + G4 (Labs 6–9) — fixes R1, R4, R5.
- **Day 3:** G5 + rerun Lab 10 — fixes R7, then re-attempt every self-check you previously missed.
- **Day 4:** Redo exam cold (see below).

## Resubmitting
1. Open `ML_LABS_EXAM_001.html` in your browser (works from the Lab Notebooks folder).
2. Answer **every** question — especially Section 4 (6 × 5 pts). Partial answers earn rubric points; blank earns 0.
3. Click **"Export answers"** → saves `ML_LABS_EXAM_001_answers.json` (to Downloads; copy it into this folder to overwrite the old one).
4. Tell me: **"Grade my exam"** → I grade against `ML_LABS_EXAM_001_answer_key.json` with partial credit and give you a new report.
5. **Alternative:** ask me for **`ML_LABS_EXAM_002`** — a fresh exam (same blueprint: 47 Qs / 120 pts, new items) if you want a clean retake after studying. Your current answer file is unchanged, so nothing is lost either way.

> Tip: the exam never shows your score in the browser — grading only happens when you ask. Export any time; you can export, study more, and export again.
