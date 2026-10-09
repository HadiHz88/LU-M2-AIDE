# Study Guide 5 — Lab 10: Data Augmentation + Full Exam Review

> **Method:** Read → run the notebook (try 2–3 transforms yourself) → Self-check out loud → then redo the exam.

---

# LAB 10 — Data Augmentation (on CIFAR-10)

## What is Data Augmentation?
- **Definition (EXAM Q35):** the process of **creating new training examples by modifying existing ones**.
- **Key idea:** introduce variety **in a way that doesn't change the meaning of the data** — **the label stays the same** (flipping a dog photo left/right is still a dog).
- **Why it helps:** models are **sensitive to small details** (a slight shift in color/shape can throw them off). Augmentation exposes the model to different versions of the same concept → it learns patterns that **stay consistent** → builds **robustness** for unseen data.
- **The danger / balance (Q35 second half):** rotate digit **"6" too far → looks like "9"**; crop too much → **object cut out entirely**. Good augmentations **increase diversity without breaking the input–label connection**. ⚠️ This exact "6→9" example is your model-answer hook for Q35.
- **Where it happens:** DA is done **when defining the Dataset class**, via the `transforms` argument (usually a **`Compose`** of several functions) — i.e. exactly where Lab 8 put transforms.
- ⚠️ **EXAM Q8 (T/F):** "augmentation is valid only if the label changes" → **False** (meaning must NOT change).

## The 4 families (EXAM Q25 — you said Cutout-style methods were geometric; here's the fix)
| Family | What it changes | Examples |
|---|---|---|
| **1. Geometric** | **spatial layout** — position, scale, orientation | `HorizontalFlip`, `VerticalFlip`, `RandomRotation`, `RandomCrop`, `CenterCrop`, `Affine`, `Perspective` |
| **2. Color & Appearance** | lighting / sensor / pixel-level look | `ColorJitter` (brightness, contrast, saturation, hue), **`Grayscale`**, `GaussianBlur`, Noise, `Posterize`, `Solarize` |
| **3. Occlusion & Region-based** | **hides/removes parts** → model must reason about incomplete data | `Cutout`, `RandomErasing`, `Hide-and-Seek` |
| **4. Sample Mixing** | **blends multiple images + labels** (strong regularizers) | `Mixup` (linear mix), `CutMix` (patch pasting), `FMix` (frequency masks) |

⚠️ **Q25 correction:** `RandomCrop` = **geometric** (spatial layout). `Cutout`/`RandomErasing` = **occlusion** — they *hide* regions, they don't move the object. ColorJitter/Grayscale = color family. Mixup/CutMix = mixing family.

## The code patterns used in the notebook
```python
# 1. Geometric — RandomCrop (crops at random location, pads borders)
transforms.Compose([
    transforms.RandomCrop((28,28), padding=(5,10), padding_mode='constant'),
    transforms.ToTensor(),
])

# 2. Geometric — CenterCrop
transforms.Compose([transforms.CenterCrop((32,32)), transforms.ToTensor()])

# 3. Geometric — flips, with probability p
transforms.Compose([transforms.RandomHorizontalFlip(p=0.5), transforms.ToTensor()])
transforms.Compose([transforms.RandomVerticalFlip(0.5),     transforms.ToTensor()])

# 4. Color — Grayscale  ⚠️ EXAM Q45's answer
transforms.Compose([transforms.Grayscale(num_output_channels=1), transforms.ToTensor()])
# after this the batch shape is (4, 1, 32, 32)  -> channel dim is 1

# 5. Mixing (note: transforms.v2 module)
import torchvision.transforms.v2 as transforms2
transforms.Compose([transforms2.MixUp(), transforms.ToTensor()])

# 6. Combined
transforms.Compose([
    transforms.RandomCrop(25, padding=3),
    transforms.RandomHorizontalFlip(),
    transforms.RandomVerticalFlip(),
    transforms.ToTensor(),
])
```
- **Every loader carries:** `shuffle=False  ### Shuffle to False so that we always see the same images` → **third confirmation of EXAM Q10** (visualization needs reproducible order).
- **Rule from the notebook's Note:** *"you should not change the image size as a result of transformation"* — a transform that alters H×W would **break `fc1.in_features = 400`** (ties to Q37!). (RandomCrop uses padding to control this.)
- **Display trick:** `data[0].swapaxes(0,2).swapaxes(0,1)` converts CHW → HWC for `imshow` (same as `np.transpose(x,(1,2,0))` from Lab 9).
- Popular external package: **`albumentations`**.
- Caution (Note 2): don't blindly Mixup unrelated classes (dog + airplane) — mix same/related classes for sensible samples.

## Self-check — Lab 10
1. Define data augmentation in one sentence; why do labels stay valid? (Q35)
2. The 4 families + 2 examples each. Which family is RandomCrop? Cutout? ColorJitter? Mixup? (Q25)
3. Why is a "6" rotated too far a *bad* augmentation? (Q35 model answer)
4. Write the Grayscale transform line. What batch shape results? (Q45)
5. Why `shuffle=False` in every visualization loader? (Q10)
6. Why must augmentation keep the image size (or pad back)? Link to `in_features`. (Q37)

**Answers:** 1) new examples from existing ones; modification mustn't change meaning. 2) table above. 3) changes the label ("6"→"9") — breaks input–label link. 4) `transforms.Grayscale(num_output_channels=1)`; `(4,1,32,32)`. 5) so we always see the same images (stable comparison). 6) `fc1 = Linear(16*5*5,120)` assumes 32→…→5; a size change makes view/fc mismatch → runtime error.

---
---

# FULL EXAM REVIEW — all 47 questions mapped to your guides

**Legend:** ✅ = you got it right in attempt 1 · ❌ = you missed it (study now) · ➖ = unanswered (model answer below)

## Section 1 — True/False (1 pt each)
| Q | Fact | Your status | Where to study |
|---|---|---|---|
| 1 | `np.empty` does NOT guarantee zeros (garbage memory) | ✅ | G1 |
| 2 | subplot index moves left→right, top→bottom | ✅ | G1 |
| 3 | `backward()` computes grads; `step()` updates values → statement "backward changes params" = **False** | ✅ | G2 |
| 4 | `torch.from_numpy` shares memory → **True** | ✅ | G2 |
| 5 | Net outputs are **logits ("energies")**, no Softmax in forward → **False** | ❌ | G4 §loss/testing |
| 6 | `ToTensor` scales [0,255]→[0,1] → **True** | ✅ | G4 |
| 7 | `linspace` includes endpoint, `arange` excludes → **True** | ✅ | G1 |
| 8 | Good augmentation must NOT change meaning → **True** | ✅ | G5 above |
| 9 | You only define `forward()`; backward is automatic → **False** | ❌ | G3 §nn.Module |
| 10 | Visualization loaders use **shuffle=False** → **False** (statement says True) | ❌ | G4/G5 |

## Section 2 — Multiple Choice (2 pts each)
| Q | Answer | Key fact | Status | Guide |
|---|---|---|---|---|
| 11 | B | 4th panel of 2×2 = bottom-right | ✅ | G1 |
| 12 | A | jagged plot → sample more points (step 0.01) | ✅ | G1 |
| 13 | C | linspace's 3rd arg = **number of values**, includes endpoint | ✅ | G1 |
| 14 | **D** | `axis=1` reduces across **rows**: min(7,2)=2, min(3,4)=3, min(5,6)=5 → `[2 3 5]`; axis=0 → `[3 2]` | ❌ (you said axis=0) | G1 §axis |
| 15 | A | broadcasting: (2,)→(3,2), element-wise → `[[8,3],[18,30],[24,39]]` | ✅ | G1 |
| 16 | B | `cat(dim=1)`: (2,3)+(2,3)→(2,6) | ✅ | G2 |
| 17 | **B** | `torch.tensor()` = **deep copy**; `from_numpy()` = shared | ❌ (you said tensor shares) | G2 §cheat-sheet |
| 18 | A | `backward()` stores grads in `.grad` of leaves, values unchanged | ✅ | G2 |
| 19 | B | `requires_grad=False` → no grad → `w` frozen, `b` updates | ✅ | G2 §freeze |
| 20 | C | ReLU = max(0,x) | ✅ | G3 |
| 21 | C | (32+0−5)/1+1 = **28** | ✅ | G4 §trace |
| 22 | A | batch = (64, 1, 28, 28), labels (64,) | ✅ | G4 |
| 23 | **C** | (x−0.5)/0.5 → **[−1,1]** | ❌ (you said [0,1]) | G4 §normalize |
| 24 | **B** | `torch.max(outputs,1)` returns **argmax class indices** (no probs — no Softmax anywhere) | ❌ (you said probabilities) | G4 §testing |
| 25 | **D** | **RandomCrop = geometric**; Cutout = occlusion family | ❌ (you said occlusion is geometric) | G5 table above |

## Section 3 — Explain the Code (6 pts each) — rubrics from the key
- **Q26 Broadcasting:** (1) shape = `(3,2)`; (2) result `[[8,3],[18,30],[24,39]]`; (3) broadcasting expands `[2,3]` to 3 rows; (4) **element-wise, not matmul**. → You got (a)+(b): **practice in G1 until you can write the 4 bullets cold.**
- **Q27 Autograd:** (a) `z` has `grad_fn` (records ops), leaves have `None`; (b) `backward()` computes dL/dw → `w.grad` shape **(5,3)**; (c) **No** — values unchanged; (d) `step()` applies `w ← w − lr·w.grad`. → You had (b)/(d): memorize the (a)–(d) structure (G2).
- **Q28 Training loop:** missing **`optimizer.zero_grad()`**; without it gradients **accumulate across batches** → wrong oversized updates; correct order: `zero_grad → forward → loss → backward → step`. ❌ blank → G4 §loop.
- **Q29 CNN trace (batch 16):** `[16,6,28,28] → [16,6,14,14] → [16,16,10,10] → [16,16,5,5] → [16,400] → [16,10]`; **400 = 16·5·5 = fc1.in_features**. → You had (a)/(c): drill the trace in G4 until automatic.
- **Q30 Transforms:** (a) ToTensor: [0,255]→[0,1]; (b) Normalize: (x−0.5)/0.5 → [−1,1]; (c) **Normalize doesn't accept PIL** → ToTensor first; (d) `train=True` = training split. → You missed (c)/(d): G4 §transforms.
- **Q31 NumPy bridge:** (a) `t=[3,3,3,3,3]`, `n=[3,3,3,3,3]`; (b) `.numpy()` is a **view** (shares memory); (c) `t2 = tensor([2,2,2,2,2], dtype=torch.float64)` (from_numpy keeps **float64**, shares memory); (d) trailing `_` = **in-place** op. → Your "deep copy" contradiction: G2 §bridge.

## Section 4 — Open Questions (5 pts each) — YOU ANSWERED NONE. Model answers (study these — they're 30 of your 66 missing points):
- **Q32 (Lab 2, plot smoothness):** matplotlib connects points with **straight-line segments** → few points = coarse polygon. **Fix:** sample many closely spaced x-values, e.g. `X = [0.01*i for i in range(0,201)]` over [0,2], `Y = [x**2 for x in X]` → segments visually approximate a smooth curve.
- **Q33 (backward vs step):** `backward()` = reverse traversal of the graph, **computes** gradients into `.grad` of `requires_grad=True` leaves, **values unchanged**; `step()` = applies `θ ← θ − lr·grad` (**actual learning**). Only backward → gradients computed but never applied, no learning; only step → grads `None`/stale → no correct update.
- **Q34 (train/eval + no_grad):** `model.train()` while training (Dropout/BatchNorm training behaviour); `model.eval()` before testing (Dropout off, BatchNorm uses running stats); `torch.no_grad()` during inference → **disables graph building → saves memory & compute**. Forgetting it → wasted memory/slower eval **and** wrong layer behaviour (Dropout still dropping, BatchNorm updating stats) → unreliable metrics.
- **Q35 (augmentation):** definition = creating new examples by modifying existing ones (Compose in the Dataset's `transform`); why = variety without changing meaning, models are detail-sensitive, teaches focus on consistent patterns → robustness; good = diversity **while preserving input–label link**; harmful = **rotating "6" too far → "9"**, or cropping the object out entirely. (Everything in G5's top section.)
- **Q36 (full pipeline, Lab 9):** ① Data: `Compose([ToTensor(), Normalize((0.5,0.5,0.5),(0.5,0.5,0.5))])` on CIFAR10; loaders batch 16 train / 4 test, `num_workers=2`. ② Net: `Conv2d(3,6,5)→ReLU→pool→Conv2d(6,16,5)→ReLU→pool→view(-1,16*5*5)→Linear 400→120→84→10`, ReLU on hidden only, **no final activation**. ③ Loss/opt: `CrossEntropyLoss` + `SGD(lr=0.01, momentum=0.9)`; loop: `zero_grad→forward→loss→backward→step`, accumulate `loss.item()`, print every 2000 batches. ④ Save/load: `torch.save(net.state_dict(), PATH)`; re-instantiate `Net()` then `load_state_dict`. ⑤ Eval: `with torch.no_grad()`, `torch.max(outputs,1)` argmax, `correct += (predicted==labels).sum().item()`, accuracy = **55% vs 10% chance**.
- **Q37 (conv size + in_features):** formula `h_out = (h_in + 2p − D(k−1) − 1)/s + 1` (D=1 → `(h_in + 2p − k)/s + 1`); pooling with k=2,s=2 halves. Trace: 32 →conv k=5→ **28** →pool→ **14** →conv k=5→ **10** →pool→ **5**, channels 16. Flattened = **16·5·5 = 400 = fc1.in_features**; **a transform that changes image size breaks this fixed number.**

## Section 5 — Fill in the Blank (1 pt each) — your misses bolded
| Q | Blank(s) | Your status |
|---|---|---|
| 38 | **`Shift+Enter`** (run a cell) | ❌ you wrote "run all" |
| 39 | `plt.legend()` | ✅ |
| 40 | `.shape` attribute | ✅ |
| 41 | **`autograd`** (`torch.autograd` = PyTorch's automatic differentiation engine) | ❌ blank |
| 42 | **`epoch`** (one full pass of whole data through the model) | ❌ blank |
| 43 | (x − **`mean`**) / **`std`** | ✅? partial |
| 44 | `nn.**CrossEntropyLoss**()`, `lr=**0.01**` | ✅? |
| 45 | `transforms.**Grayscale**(num_output_channels=1)` | ✅? |
| 46 | **`squeeze`** (removes (1,28,28)→(28,28)) | ❌ you wrote slice[1:] |
| 47 | `zero_grad` → `backward` → **`step`** (3 blanks) | ❌ only got step |

---
*Go to `00_STUDY_PLAN.md` for the study schedule and how to resubmit.*
