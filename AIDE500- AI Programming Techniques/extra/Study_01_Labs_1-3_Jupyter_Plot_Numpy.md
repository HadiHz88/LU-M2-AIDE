# Study Guide 1 — Labs 1–3: Jupyter Notebook, Matplotlib, NumPy

> **How to use this guide** (do this for every guide):
> 1. **Read** the section below (10–15 min).
> 2. **Open the original notebook** and re-run every code cell yourself.
> 3. **Retype** one key cell from memory with the guide closed.
> 4. Answer the **Self-check** at the end *out loud*, then check.
> 5. Mark anything you missed → re-read just that part before sleeping.
>
> This order matters: **Read → Run → Retype → Recall.** Passive re-reading is what failed you on the exam.

---

# LAB 1 — Introduction to Jupyter Notebook

## What a notebook is
- `.ipynb` = **iPython Notebook** — a file of *cells*, used for rapid prototyping/demo of scientific Python.
- **Cell types:** Python **code**, rich **text** (Markdown formatting), and **raw** cells.
- Evaluating a **code** cell runs it; output appears **directly below the cell**.
- Evaluating a **text** cell *formats* it (renders headers, bold, math).

## The two modes (very exam-relevant)
| Mode | What it does | How to enter |
|---|---|---|
| **Edit mode** | Edit the *content* of a cell | Enter key or double-click a cell |
| **Command mode** | Change cell *types*, select cells | Escape key |

- In Command mode you select cells; press Enter (or double-click) to edit one.

## Running cells
- **`Shift+Enter`** = evaluate the current cell **and select the cell below it**.
  - ⚠️ **EXAM Q38** — your answer "run all" was wrong: "run all" runs *every* cell in the notebook and does **not** advance to the next cell. The combination "**runs this cell + selects the cell below**" = **Shift+Enter**.
- `Shift+Enter` is the shortcut you will use 99% of the time.

## Built-in help
- Put **`?`** after a function/variable name → its **help/docstring** pops up (e.g. `os.listdir?`).
- Put **`??`** → shows the **source code** of the function.
- Close popups with **Escape**.

## Notebook practice from the lab
```python
a = 32
b = 2*a
print("%d + %d" % (a, b))   # -> "32 + 64"
```
- String formatting: `"%d + %d" % (a, b)` substitutes the two integers into the template.
- `os.listdir` → browse directory contents (used in the lab's "cell to be completed").

**Lab 1 self-check targets:** name the 3 cell types, both modes, what Shift+Enter does, `?` vs `??`.

---

# LAB 2 — Plotting with Matplotlib (+ Lab2-summary)

## The minimum recipe
To plot anything you need: **two lists** `X` (x-coordinates) and `Y` (y-coordinates), plus one import:
```python
import matplotlib.pyplot as plt
X = [i for i in range(0, 10)]
Y = [x**2 for x in X]
plt.plot(X, Y)
```

## List-comprehension refresher (the lab leans on this)
```python
range(0, 10)      -> 0,1,...,9      (STOP IS EXCLUDED)
[0.01*i for i in range(0, 201)]  -> 0.00, 0.01, ..., 2.00   (201 values)
```
- `range(start, stop, step)` — only `stop` is required; `step` defaults to 1, `start` to 0; last value = `stop - step`.

## Decorations
```python
plt.title("quadratic function")
plt.xlabel("x")
plt.ylabel("f(x)")
plt.plot(X, Y, color='g')       # color aliases: 'r' 'g' 'b' 'k' (black), or 'red'
```

## Smoothness of curves
- Only 3 points (0, 1, 4) joined by straight lines → the curve looks "angular", **not smooth**.
- Fix: sample **many** points, e.g. step `0.01` → `X = [0.01*i for i in range(0, 201)]` → smooth parabola.
- ⚠️ **EXAM Q11** — "why is a plot smooth?" → large number of closely spaced points connected by straight lines.

## Multiple lines on one figure
```python
plt.plot(X, Y, color='r', label='quadratic')
plt.plot(X, Z, color='g', label='linear')
plt.legend()                     # without this, labels never appear
```
- Rule from the lab: **each curve gets a `label=` inside `plt.plot()`, then you must call `plt.legend()`** to display them.
- ⚠️ **EXAM Q39** (fill-in, you got it ✓) — the function that *draws* the label box = `legend`.

## Subplots — the #1 tested concept in Lab 2
```python
plt.figure(1)            # which figure we are splitting (avoids overwriting)
plt.subplot(a, b, c)
```
- `a` = **number of rows**, `b` = **number of columns**, `c` = **which sub-figure** (1-based).
- **`c` moves left → right, top → bottom.**
- Examples from the lab:
  - `plt.subplot(1, 2, 1)` = left half; `plt.subplot(1, 2, 2)` = right half (a 1×2 split).
  - In a **2×2**: `1` = top-left, `2` = top-right, `3` = bottom-left, `4` = **bottom-right**.
- ⚠️ **EXAM Q2** ✓ (you got it) and **Q11**: `plt.subplot(2,2,4)` → **bottom-right**.
- `plt.tight_layout()` = auto-fix overlapping titles/labels (from Lab2-summary).
- `plt.figure(x)` first so two figures don't overwrite each other.

## Chart types (know the signature of each)
| Type | Call | Key points |
|---|---|---|
| Histogram | `plt.hist(data, bins=len(data), facecolor='r', edgecolor='c')` | shows **frequency** of values; `bins` = number of boxes |
| Bar chart | `plt.bar(left_edges, heights, width=5)` | `left_edges` = x positions, `heights` = bar lengths; **default width = 0.8** |
| Pie chart | `plt.pie(sizes, labels=list_of_labels, shadow=True, startangle=120)` | each slice = `size / sum(sizes)`; sum of [200,140,250,210] = 800, so Python slice = 200/800 |
- `plt.show()` displays all figures at once (needed in standalone scripts).

---

# LAB 3 — NumPy (+ Lab3-summary)

## Why NumPy
`numpy` = **numerical Python**: math/logic on arrays, linear algebra, random generation. Always `import numpy as np`.

## The `ndarray`
- N-dimensional array; all items **same type**; zero-based indexing.
```python
L = [1, 2, 3];  a = np.array(L)           # print -> [1 2 3]   (no commas!)
L = [[1,2,3],[4,5,6]]; a = np.array(L)    # 2 rows × 3 cols
print(a.shape)                             # (2, 3)  -> (rows, cols)
```
- **`shape` is an attribute** (no parentheses): 1-D vector of 50 numbers → `(50,)`.
- **dtype casting:** `np.array([1,2,3], dtype=float)` → `[1. 2. 3.]` (harmless). But
  `np.array([1.5, 2.7, 3.1], dtype=int)` → `[1 2 3]` — **truncates, information lost**.
- Mixed types all get cast to **one** type: `np.array([1, 'CSC243'])` → `['1' 'CSC243']` (everything becomes strings).

## Creating arrays
```python
np.empty((3,4), dtype=float)   # allocates RAM WITHOUT clearing it
np.zeros((2,4))                # all 0.0  (float by default)
np.ones((3,2))                 # all 1.0
np.ones((3,), dtype=int)       # [1 1 1]  — "(3,)" is a 1-D size tuple
```
- ⚠️ **EXAM Q1** ✓ (you got it) — `np.empty` contains **garbage** left in RAM (values like `1.22e-311` or `7.9e+165`); **you must overwrite every element before reading it**. There are no guarantees it's zeros.

## Ranges — `arange` vs `linspace` (EXAM FAVORITE)
| | `np.arange(start, stop, step)` | `np.linspace(start, stop, num)` |
|---|---|---|
| What you specify | **step size** | **number of points** |
| `stop` included? | ❌ **excluded** | ✅ **included** |
| Default step | 1 | (always generates `num` points) |
| Step can be float? | ✅ yes (unlike Python `range`) | n/a |
```python
np.arange(1.5, 2, 0.1)   # [1.5 1.6 1.7 1.8 1.9]   (2.0 excluded)
np.arange(5)             # [0 1 2 3 4]             (stop excluded)
np.linspace(10, 50, 5)   # [10. 20. 30. 40. 50.]   (50 INCLUDED)
```
- ⚠️ **EXAM Q7** ✓ (you got it) and **Q13** — `linspace` includes the endpoint and gives you a *count* of points; that's how you fix the "not smooth" plot problem too.

## Math functions take WHOLE ARRAYS
```python
X = np.arange(0, 10, 0.1)
Y = np.exp(-X) * np.cos(2*np.pi*X)   # applied to all 100 elements at once
```
- Contrast: the `math` module takes a **single number** per call. NumPy's advantage = **vectorization** (no Python loop needed).

## Statistics and `axis` (⚠ YOUR WEAK POINT — EXAM Q14)
```python
a = np.array([[7,2],
              [3,4],
              [5,6]])      # shape (3,2)
```
| Call | Result | Meaning |
|---|---|---|
| `np.amin(a)` | `2` | min over the **whole** array (axis=None default) |
| `np.amin(a, axis=0)` | `[3 2]` | collapse **down the columns**: min(7,3,5)=3, min(2,4,6)=2 |
| `np.amin(a, axis=1)` | `[2 3 5]` | collapse **across each row**: min(7,2)=2, min(3,4)=3, min(5,6)=5 |
| `np.mean(a)` | `4.5` | (7+2+3+4+5+6)/6 |
| `np.mean(a, axis=0)` | `[5.0 4.0]` | column averages: (7+3+5)/3, (2+4+6)/3 |
| `np.mean(a, axis=1)` | `[4.5 3.5 5.5]` | row averages: (7+2)/2, (3+4)/2, (5+6)/2 |
- **Memory hook:** `axis=0` → you travel **along** axis 0 (vertically, down) → one result **per column**. `axis=1` → travel horizontally → one result **per row**.
- Same `axis` keyword works for `np.amin/amax/mean/median/std/var`.
- ⚠️ **EXAM Q14 (you scored 0)** — question asked `axis=1`; you answered `[3, 2]` (the `axis=0` answer). Correct: **`axis=1` → `[2, 3, 5]`**. Say it out loud: *"axis 1 runs along the rows, so each row collapses to one number — 3 results for a 3-row matrix."*

## Random numbers
```python
import numpy.random as rand
rand.uniform(1, 10)        # one float in [1, 10] (default 0..1)
rand.randint(1, 10)        # one int — NumPy's HIGH IS EXCLUSIVE: values 1..9
rand.randint(1, 10, 4)     # array of 4 ints
rand.randint(1, 10, (10,20)) # 10×20 matrix of ints
np.random.randn(50)        # 50 samples from STANDARD NORMAL (mean 0, std 1)
np.random.randn(3,10,4)    # 3-D tensor of standard-normal values
```
- ⚠️ Careful: the lab's markdown loosely says randint is "inclusive", but the lab's own code writes `rand.randint(a, b+1)` — proof that **`b` is exclusive** in NumPy (unlike the `random.randint(a, b)` of Python's `random` module).
- `randn` = bell-curve samples centered at 0, spread 1 — this is how weights and data are often initialized later in the course.

## Iterating and reshaping
```python
for dim in arrayC:              # a (3,10,4) array iterates over its FIRST axis
    print(dim.shape)            # prints (10,4) three times
for k, curdim in enumerate(arrayC):  # k = 0,1,2
    ...
A.reshape((4,5,10))             # 10×20 = 4×5×10 (element count MUST match)
```

## Broadcasting (⚠ YOUR WEAK POINT — EXAM Q26)
**Broadcasting = NumPy automatically expands the smaller array so shapes match, then does element-wise math.**
```python
x = np.array([2, 3])                      # shape (2,)
y = np.array([[4,1],[9,10],[12,13]])      # shape (3, 2)
result = x * y                            # shape (3, 2)
# result = [[ 8,  3],
#           [18, 30],
#           [24, 39]]
```
**What happens step by step:** `x` (2,) is virtually **duplicated into a (3,2) array** by repeating the row:
```
x  becomes  [[2, 3],
             [2, 3],
             [2, 3]]
```
then each position multiplies:
```
row0: [2·4, 3·1]   = [ 8,  3]
row1: [2·9, 3·10]  = [18, 30]
row2: [2·12,3·13]  = [24, 39]
```
Key facts for the exam:
- `*` is **element-wise multiplication**, NOT matrix multiplication.
- Result shape = the **larger** operand's shape → `(3, 2)`.
- Real matrix multiplication (`@` / `np.matmul`) requires **inner dimensions to match** — `(2,)·(3,2)` isn't even a legal matmul (you'd need (3,)·... ), and even a legal one gives a different answer.
- ⚠️ **EXAM Q26 (your weakest code question):** you wrote "`.mul()` iterates through the arrays" — wrong tool and no broadcasting. The answer must contain the words: **broadcasting = automatic expansion of the (2,) array to (3,2) by duplicating the row, then element-wise `*`.**

## Indexing & boolean filtering
```python
first_row = y[0]                       # [4, 1]
mask = first_row > 1                   # [True, False]
first_row[mask]                        # [4]  — only True entries survive
rows = [0, 2]
y[rows]                                # rows 0 and 2  (fancy indexing)
y[rows][y[rows] > 1]                   # [4, 12, 13] — filter selected rows
```

## Save / load arrays
```python
np.savez("y.npz", data=y)              # save under the key 'data'
loaded = np.load("y.npz")["data"]      # load and fetch by key
```
- Used to generate expensive data **once** and reuse it (matters in later courses).

---

# Self-check — Labs 1–3

*Answer out loud first, then check.*

1. What is the difference between Edit mode and Command mode? What does Shift+Enter do?
2. `np.empty((3,4))` prints strange values like `7.9e+165` — is it zero-filled? What must you do?
3. What does `np.linspace(10, 50, 5)` return? What does `np.arange(10, 50, 10)` return?
4. `a = [[7,2],[3,4],[5,6]]` — give `np.amin(a, axis=0)` and `np.amin(a, axis=1)`.
5. To make `y = x²` look smooth on a plot over [0, 2], what's the trick?
6. What two things do you need before `plt.legend()` actually shows anything?
7. In a 2×2 grid, which position is `plt.subplot(2,2,4)`?
8. Why do `x = np.array([2,3])` and `y = np.array([[4,1],[9,10],[12,13]])` allow `x*y`? What's the result's shape and third row?
9. `y = y2 = torch...` no — NumPy version: `t = np.ones(5); m = t + 1` — does `m` share memory with `t`? (Trick: `+` creates a new array; `+=`/`t[...] =` modifies in place.)
10. `rand.randint(1, 10)` — can it return 10? Why does the lab write `rand.randint(a, b+1)`?

**Answers:** 1) Edit = content, Command = cell type/selection; Shift+Enter = run cell + select cell below. 2) No — garbage RAM values; overwrite before reading. 3) `[10 20 30 40 50]` (50 included); `[10 20 30 40]` (50 excluded). 4) `[3 2]` and `[2 3 5]`. 5) Sample many closely spaced points (step 0.01). 6) `label=` in each `plt.plot()` + call `plt.legend()`. 7) bottom-right. 8) broadcasting duplicates the (2,) row to (3,2); shape (3,2); row 3 = `[24, 39]`. 9) No — `+` makes a new array. 10) No — NumPy's high is exclusive; `b+1` compensates.

**Exam questions this prepares you for:** Q1, Q2, Q7, Q11, Q12, Q13, Q14, Q15, Q26, Q32, Q38, Q39, Q40.

---
*Next: Study Guide 2 — Lab 4 (PyTorch Tensors) & Lab 5 (autograd).*
