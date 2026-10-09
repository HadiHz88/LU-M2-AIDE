# Study Guide 2 — Labs 4–5: PyTorch Tensors & Autograd

> **Method:** Read this guide → open the lab notebooks and run each cell → retype the key cells from memory → answer the Self-check out loud → only then move on.

---

# LAB 4 — Tensors (+ lab4-summary)

## What a tensor is
- A **specialized data structure** — like a NumPy `ndarray`, but it can also **run on GPUs** and other accelerators.
- PyTorch uses tensors for: **model inputs, outputs, and parameters** (weights/biases).
- If you know NumPy, the tensor API is nearly identical — the big differences are (1) GPU support, (2) **autograd tracking** (Lab 5), (3) copy-vs-share semantics.

## Creating tensors — the 4 ways (EXAM FAVORITE)
```python
import torch
import numpy as np

data = [[1, 2], [3, 4]]

x_data = torch.tensor(data)              # (1) from Python data; dtype inferred
np_array = np.array(data)
x_np    = torch.from_numpy(np_array)     # (2) from NumPy — SHARES memory!
x_ones  = torch.ones_like(x_data)        # (3) like another tensor: keeps shape & dtype
x_rand  = torch.rand_like(x_data, dtype=torch.float)  # can override dtype
rand_t  = torch.rand((2, 3))             # (4) from a shape tuple: random floats in [0,1)
ones_t  = torch.ones((2, 3))
zeros_t = torch.zeros((2, 3))
```
⚠️ **EXAM Q17 (you scored 0):** the exam asked which conversion **shares** memory.
- `torch.tensor(data)` = **deep copy** — change one, the other is unaffected (lab4-summary says this explicitly).
- `torch.from_numpy(np_array)` = **NOT a copy — shares memory** — change one, both change.

## Attributes
```python
t = torch.rand(3, 4)
t.shape    # torch.Size([3, 4])   — note: attribute, no parentheses
t.dtype    # torch.float32
t.device   # cpu  (or cuda on a GPU machine)
```

## Indexing & slicing — exactly like NumPy
```python
tensorA = torch.ones(4, 4)
tensorA[1, 1] = 6     # row 1, col 1
tensorA[:, 2] = 3     # whole column 2
tensorA[:, 3] = 5     # whole column 3
tensorA[:, :] = 2     # everything = 2
tensorA[3, :] = 0     # last row = 0
```
Remember: `tensor[row, col]`, `tensor[a:b, c:d]`, `:` = "all of this axis".

## Joining tensors — `torch.cat` (EXAM Q16 ✓)
```python
# x has shape (2, 3)
cat_dim0 = torch.cat([x, x], dim=0)   # rows stacked -> shape (4, 3)
cat_dim1 = torch.cat([x, x], dim=1)   # columns side by side -> shape (2, 6)
```
- `dim` = **which axis you concatenate along** (default `dim=0`).
- Memory hook: **dim=0 → more rows; dim=1 → more columns.**
- Lab's own demo: three (4,4) tensors → `dim=0` gives `(12,4)`, `dim=1` gives `(4,12)`.
- `torch.stack` is similar but creates a **new** axis (mentioned as "subtly different").

## Multiplication: element-wise vs matrix (EXAM FAVORITE)
```python
tensorA.mul(tensorA)      # element-wise product — same as:  tensorA * tensorA
tensorA.matmul(tensorA.T) # matrix multiplication — same as: tensorA @ tensorA.T
```
| | `*` / `.mul()` | `@` / `.matmul()` |
|---|---|---|
| Meaning | position-by-position product | dot-product rows × columns |
| Shape rule | same shape (or broadcastable) | inner dims must match → (m,**k**)·(**k**,n)=(m,n) |
- `.T` = transpose (swap rows/columns).

## In-place operations — the `_` suffix
```python
tensorA.add_(5)     # +5 to every element, IN PLACE
tensorA.sub_(3)     # -3 in place
tensorA.t_()        # transpose in place
tensorA.copy_(5)    # overwrite all values in place
```
- **Rule: trailing underscore `_` = in-place** (modifies the tensor itself, returns it).
- Lab's warning: in-place ops save memory but **can break derivative computation** (immediate loss of history) → discouraged when autograd is tracking.

## The NumPy ↔ Tensor bridge (⚠ YOUR WEAK POINT — EXAM Q31, part of Q27)
```python
# Direction 1: tensor -> NumPy (SHARED memory)
t = torch.ones(5)
n = t.numpy()          # NO copy — n and t point to the same buffer
t.add_(2)              # in-place change
# t -> tensor([3., 3., 3., 3., 3.])
# n -> [3. 3. 3. 3. 3.]   ← BOTH changed

# Direction 2: NumPy -> tensor (SHARED memory)
n = np.ones(5)                     # dtype float64 (NumPy default!)
t = torch.from_numpy(n)            # NO copy — shared
np.add(n, 1, out=n)                # in-place: n becomes all 2s
# t -> tensor([2., 2., 2., 2., 2.], dtype=torch.float64)
# n -> [2. 2. 2. 2. 2.]   ← BOTH changed, and dtype stays float64
```
**The complete memory cheat-sheet:**
| Conversion | Copies? |
|---|---|
| `torch.tensor(list)` | **deep copy** |
| `torch.from_numpy(np_arr)` | **shares** |
| `t.numpy()` | **shares** |
| `t.clone()` | copy |
| `t + 1` (non-underscore op) | new tensor (original untouched) |
| `t.add_(1)` (underscore) | in-place on original |

⚠️ **EXAM Q31 (you scored 1.5/6):**
- (b) you wrote "*`t.numpy()` takes the **deep copy***" — contradiction: a deep copy would NOT share. Correct: it's a **view/share**, which is *why* both print 3s after `add_`.
- (c) you said `(1,1,1,1,1)` — the code is `np.add(n, 1, out=n)`: `n` becomes **2s**, and `t` (shared) prints **`([2., 2., 2., 2., 2.], dtype=torch.float64)`**. Note `from_numpy` preserves NumPy's float64.

---

# LAB 5 — A Gentle Introduction to torch.autograd

## The big idea (memorize this paragraph in your own words)
- Training neural nets uses **backpropagation**: parameters are adjusted by the **gradient of the loss** with respect to each parameter.
- **Gradient** = the partial derivative of loss w.r.t. one parameter — it points in the **direction of steepest ascent** of the loss.
- We step **opposite** to the gradient (steepest **descent**) → loss goes down → predictions improve.
- Derivative sign: **descending → negative**, **ascending → positive**.
- PyTorch's engine that computes all this automatically = **`torch.autograd`** — ⚠️ **EXAM Q41 fill-in** ("the engine that computes `loss.grad_fn`") = **autograd**.

## The toy network (learn this code by heart)
```python
x = torch.ones(5)                               # input  (leaf, no grad needed)
y = torch.zeros(3)                              # expected output
w = torch.randn(5, 3, requires_grad=True)       # weight  ← trainee
b = torch.randn(3, requires_grad=True)          # bias    ← trainee
z = torch.matmul(x, w) + b                      # layer output
loss = torch.nn.functional.binary_cross_entropy_with_logits(z, y)
```
- `requires_grad=True` marks a tensor as something we need derivatives for. Set at creation, or later: `x.requires_grad_(True)`.
- Default is `requires_grad=False`.

## `grad_fn` — what it is and who has one (⚠ EXAM Q27a)
- Every operation you apply to a grad-tracking tensor creates an object of class **`Function`** — it knows how to run forward **and** how to compute its derivative backward.
- A **reference to that backward function is stored in the tensor's `grad_fn`**.
```python
x.grad_fn     # None  ← x was CREATED directly (a "leaf"), no op applied
y.grad_fn     # None
w.grad_fn     # None
b.grad_fn     # None
z.grad_fn     # <AddBackward0>       ← z = matmul(...) + b  → built by operations
loss.grad_fn  # <BinaryCrossEntropyWithLogitsBackward0>
```
**The rule (say it out loud):** *A tensor gets a `grad_fn` only if it was produced by an operation on tensors with `requires_grad=True`. Tensors you create directly with `torch.ones/randn` are **leaves** → `grad_fn is None`.*
- ⚠️ EXAM Q27a: `x` has no `requires_grad` → built directly → no grad chain. `z` was computed **from `w`** which has `requires_grad=True` → `z` carries a `grad_fn`.

## `loss.backward()` — computing gradients (⚠ EXAM Q27b, Q18 ✓)
```python
loss.backward()
w.grad       # tensor([[0.0557, 0.2433, 0.0220], ...])   shape (5, 3)
b.grad       # tensor([0.0557, 0.2433, 0.0220])          shape (3,)
w            # UNCHANGED — values identical to before
```
What happened, precisely:
1. autograd **traversed the computational graph backward** (from loss → z → w/b).
2. It computed `dloss/dw` and `dloss/db` — partial derivatives for **every tensor with `requires_grad=True`**.
3. Results were **stored in the `.grad` attribute** of `w` and `b`.
4. **Nothing was updated.** The lab says it explicitly: *"Computing gradients only tells PyTorch the direction and rate of change. It does not update the actual weight and bias value."*
- In exam answers, describe (b) as: *"backward() runs backpropagation, traverses the graph in reverse, computes dL/dw and dL/db, stores them in `w.grad`/`b.grad`."* In the exam printout, `w.grad` has shape **(5, 3)** (same as `w`).

## Who gets gradients? (EXAM Q19 ✓ — the frozen-parameter trick)
- Gradients exist **only for leaf nodes** with `requires_grad=True`.
```python
w = torch.randn(5, 3, requires_grad=False)   # FROZEN
loss.backward()
w.grad      # None            ← no gradient computed for frozen params
b.grad      # tensor([...])   ← b still trains
optimizer.step()
# w unchanged, b changed      ← EXAM Q19 answer B, which you got ✓
```

## `optimizer.step()` — the actual update (⚠ EXAM Q27c/d, Q37)
```python
optimizer = torch.optim.SGD([w, b], lr=0.001)
optimizer.step()      # THIS changes the values of w and b
```
The update rule (from the lab):
$$\theta_{\text{new}} = \theta_{\text{old}} - \text{lr} \times \theta_{\text{grad}}$$
Three-part separation to memorize:
| Call | What it does | Changes weights? |
|---|---|---|
| `loss.backward()` | compute gradients → `.grad` | **No** |
| `optimizer.step()` | apply `θ − lr·grad` to weights | **Yes** |
| `optimizer.zero_grad()` | clear accumulated `.grad` (needed every iteration — Lab 7/9) | No |
- ⚠️ EXAM Q27c: "no — `backward()` alone doesn't update anything; you need `optimizer.step()`." (You got this ✓.)

## Caveats from the lab's NOTE box
- `backward()` can only be run **once** per graph (performance) — repeated calls need `retain_graph=True`.

## Disabling gradient tracking — `torch.no_grad()` (EXAM Q34 topic)
```python
z = torch.matmul(x, w) + b
z.requires_grad                      # True (default tracking)

with torch.no_grad():
    z = torch.matmul(x, w) + b
z.requires_grad                      # False — history NOT tracked
```
- **When to use:** after training, when you just want **forward pass / inference** — no graph memory overhead, no gradients.
- This is why the exam's open Q34 wants: `model.eval()` + `with torch.no_grad():` during evaluation.

## Freezing demo (end of lab) — summarize in one breath
With `w.requires_grad=False`, `b.requires_grad=True`:
- `loss.backward()` → `w.grad = None`, `b.grad = tensor([...])`
- `optimizer.step()` → `w` values **unchanged**, `b` values **changed**.

---

# Self-check — Labs 4–5

1. `torch.tensor(...)` vs `torch.from_numpy(...)` — which one shares memory? What's the evidence in the lab?
2. `x = torch.tensor([[1,2,3],[4,5,6]])` — shapes of `cat([x,x], dim=0)` and `cat([x,x], dim=1)`?
3. What does `t.add_(5)` mean? Why does the lab discourage in-place ops during training?
4. Why does `x = torch.ones(5)` have `grad_fn = None` while `z = matmul(x,w)+b` has `<AddBackward0>`?
5. After `loss.backward()`: (a) where are gradients stored? (b) did `w` change? (c) what's `w.grad`'s shape when `w` is (5,3)?
6. Frozen `w` (requires_grad=False): what is `w.grad` after backward, and what does `step()` do to it?
7. Give the exact update formula `optimizer.step()` implements.
8. What are the two "modes" of the training loop and what does each do?
9. In one sentence: when do you wrap code in `torch.no_grad()`?
10. Fill-in exam style: "PyTorch's automatic differentiation engine that powers training is called ______." Also: "loss.grad_fn is stored by the ______ engine."

**Answers:** 1) `from_numpy` shares (evidence: `add_` changed both); `torch.tensor` deep-copies. 2) (4,3) and (2,6). 3) in-place +5; breaks derivative history. 4) `x` is a leaf created directly; `z` was built by operations on a `requires_grad=True` tensor. 5) (a) `w.grad`/`b.grad` attributes, (b) no, (d) same as `w` → (5,3). 6) `w.grad is None`, step leaves `w` unchanged. 7) `θ_new = θ_old − lr × θ_grad`. 8) backward = compute grads (no update); step = apply update. 9) Inference/evaluation — no gradients or graph needed. 10) autograd; autograd.

**Exam questions this prepares you for:** Q3, Q4, Q16, Q17, Q18, Q19, Q27, Q31, Q33, Q34, Q41.

---
*Next: Study Guide 3 — Lab 6 (Neural Networks Background) & Lab 7 (nn.Module / building networks).*
