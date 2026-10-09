# Study Guide 3 — Labs 6–7: Neural Network Background & Building Networks with nn.Module

> **Method:** Read → run the notebook cells → retype `class Net` from memory → Self-check out loud.

---

# LAB 6 — Neural Networks Background (ResNet, freezing, transfer learning)

## The core definition (memorize)
- An NN is **a collection of nested functions executed on input data**. Their behavior is defined by **parameters (weights and biases)**, stored in PyTorch as **tensors**.
- Training = **two steps**:
  1. **Forward propagation** — the network runs input data through each function to make its **best guess**.
  2. **Backward propagation** — the network **adjusts parameters** proportionate to the error, by traversing backwards from the output, collecting derivatives of the error w.r.t. the parameters (*gradients*), and optimizing with **gradient descent**.
- Update rule (Lab 7 states it): `weight = weight - learningRate * gradient`

## torchvision's 3 key components
| Component | What it gives you |
|---|---|
| **Datasets** | standard loaders: ImageNet, CIFAR-10, MNIST |
| **Models** | architectures with pre-trained weights: ResNet, VGG, MobileNet |
| **Transforms** | preprocessing & augmentation operations for images |

## Pretrained vs from-scratch (EXAM Q37 territory)
```python
model = resnet18(weights=ResNet18_Weights.DEFAULT)  # pretrained on ImageNet-1K (1000 classes)
model = resnet18(weights=None)                      # random weights — train from scratch
```
- `ResNet18_Weights.DEFAULT` downloads the best available weights trained on **ImageNet-1K = 1000 classes** → that's why the last layer shows **`out_features=1000`**.
- `weights=None` = architecture only, **random** weights (you'll see garbage predictions like `0.04, 0.02, ...`).

## Saving / loading a model — `state_dict`
```python
torch.save(model.state_dict(), PATH)        # save: a DICTIONARY {layer_name: weight_tensor}
state_dict = torch.load(PATH, map_location="cpu")
for key, value in state_dict.items():
    print(f"{key}: {value.shape}")          # e.g. conv1.weight: torch.Size([64, 3, 7, 7])
model = resnet18(weights=None)
model.load_state_dict(torch.load(PATH))     # load weights into a fresh architecture
```
- `state_dict` = Python dict mapping **each layer → its parameter tensor** (weights & biases).
- You can read shapes from it — e.g. `conv1.weight` is `(64, 3, 7, 7)` = 64 filters, **3 input channels** (RGB), **7×7 kernel**.

## Changing the classifier head (EXAM Q37 answer pattern)
```python
model.fc = nn.Linear(model.fc.in_features, 10)   # 512 -> 10 (new dataset with 10 labels)
```
- `model.fc` is ResNet's final fully-connected layer; `in_features = 512` stays, `out_features` becomes your number of classes.

## One full training step (the lab's walkthrough — worth re-typing)
```python
inputData = torch.rand(1, 3, 64, 64)   # (batch, channels, H, W): 1 RGB image 64×64
labels    = torch.rand(1, n_features)   # must be compatible with n_features (10)

prediction = model(inputData)           # 1. FORWARD PASS -> shape (1, 10)
loss = (prediction - labels).sum()      # 2. LOSS (dummy error here)
loss.backward()                         # 3. BACKWARD: grads -> .grad of each parameter
optim = torch.optim.SGD(model.parameters(), lr=1e-2, momentum=0.9)
optim.step()                            # 4. UPDATE the weights
```
- Optimizer creation registers **all** model parameters; tensors passed as parameters get `requires_grad=True` automatically.

## Visualizing images (re-used in Lab 9's `imshow`)
```python
image = torchvision.utils.make_grid(inputData)  # 4D batch -> single 3D image
npimg = image.numpy()
plt.imshow(np.transpose(npimg, (1, 2, 0)))      # (C,H,W) -> (H,W,C) for matplotlib
```
- Matplotlib wants **NumPy** arrays and wants channels **last**; PyTorch images are **(C, H, W)** → transpose `(1,2,0)`.

## Differentiation demo (understand, don't memorize numbers)
```python
a = torch.tensor([2., 3.], requires_grad=True)
b = torch.tensor([6., 4.], requires_grad=True)
Q = 3*a**3 - b**2                 # "error" function
Q.backward(gradient=torch.tensor([1., 1.]))   # gradient arg needed because Q is a VECTOR
a.grad   # = 9*a²  = [36, 81] ✓ (checked in the lab)
b.grad   # = -2*b  = [-12, -8] ✓
```
- Why `gradient=[1.,1.]`: for a vector output you must seed it; mathematically `dQ/dQ = 1`.

## The computational graph (DAG)
- autograd records tensors + operations in a **directed acyclic graph** of `Function` objects. **Leaves = input tensors, roots = output tensors.**
- Forward pass does 2 things simultaneously: (1) runs the operation, (2) stores the operation's **gradient function** in the DAG.
- `.backward()` on the root: computes gradients from each `grad_fn`, **accumulates them into `.grad`**, and propagates via the **chain rule** all the way to the leaves.
- **Graphs are dynamic**: recreated from scratch after every `backward()` → you can use normal Python control flow (if/loops) and change shapes every iteration.
- **Exclusion rule:** `requires_grad=False` removes a tensor from the DAG. But if **any** input has `requires_grad=True`, the **output** requires gradients:
```python
a = x + y   # x, y normal        -> a.requires_grad = False
b = x + z   # z requires grad    -> b.requires_grad = True   (EXAM-tested logic)
```

## Freezing & transfer learning (EXAM Q37 — the recipe)
```python
for param in model.parameters():     # freeze EVERYTHING
    param.requires_grad = False

model.fc = nn.Linear(512, 10)        # replace head — new layer is UNFROZEN by default

# Now ONLY model.fc's weights/bias get gradients & get updated during training
```
- Why freeze: performance (fewer autograd computations) + keep learned features; typical **transfer learning** = keep feature extractor, retrain the classifier.
- `torch.no_grad()` is the context-manager version of this exclusion (used at inference).

---

# LAB 7 — Neural Networks with nn.Module

## The training procedure (5 lines to memorize)
1. Define the network (learnable parameters)
2. Iterate over the dataset
3. Process input through the network (forward)
4. Compute the loss (how far output is from correct)
5. Propagate gradients back (`backward`) and **update weights**: `weight = weight − lr × gradient`

## Device selection
```python
device = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
```

## Building blocks (know each signature + shape behavior)
| Component | Signature | Shape effect |
|---|---|---|
| **nn.Module** | base class of **all** NN components in PyTorch | — |
| **nn.Linear** | `nn.Linear(in_features, out_features, bias=True)` | last dim: `in → out`; computes `y = xAᵀ + b` |
| **nn.Conv2d** | `nn.Conv2d(in_ch, out_ch, kernel_size, stride, bias)` | spatial shrinks per formula below |
| **F.max_pool2d** | `F.max_pool2d(x, kernel_size=2, stride=1, ...)` | **down-sampling**: max value in each window |
| **F.relu** | `F.relu(x)` | **max(0, x)** — zeroes negatives (EXAM Q20 ✓) |
| **nn.Softmax** | `nn.Softmax(dim=1)` | logits → probabilities, each in (0,1), **sum to 1** |
| **tensor.view** | `x.view(shape)` | reshape **without copying** (shared memory!), element count must match, `-1` = infer |

- **`nn.Parameter`** = a Tensor **auto-registered as a parameter** when assigned to a Module; **`requires_grad=True` by default**.
- **`torch.empty`** = uninitialized RAM (same garbage idea as `np.empty`).
- Linear demo: input `(3,2,4)` with `in=4, out=3` → output `(3,2,3)`: only the **last** dim changes.
- Conv demo: input `(1,4,4)`, `kernel=2, stride=1` → `(1,3,3)` (because 4−2+1 = 3).
- **Softmax caution (EXAM Q5/Q24):** Softmax is what *converts logits into probabilities* — Lab 9's network **never applies it**, so its outputs are raw logits. `F.relu` ≠ softmax; ReLU is just max(0,x).

## The output-size formula (EXAM Q21 — you got this ✓)
$$H_{out} = \left(\frac{H_{in} + 2P - D(K-1) - 1}{S}\right) + 1$$
- `P`=padding, `D`=dilation (usually 1), `K`=kernel, `S`=stride. Simplified (P=0, D=1): **`H_out = H_in − K + 1`** (for S=1).
- Pooling with `k=2, s=2` (no padding): **halves** the size (floor division).

## Building `class Net` — the single most important code block in the course
```python
class Net(nn.Module):
    def __init__(self):
        super(Net, self).__init__()
        self.conv1 = nn.Conv2d(1, 6, 3)        # 1 -> 6 channels, 3x3 kernel
        self.conv2 = nn.Conv2d(6, 16, 3)       # 6 -> 16 channels, 3x3 kernel
        self.fc1   = nn.Linear(16 * 6 * 6, 120)  # flatten 16x6x6 = 576 features
        self.fc2   = nn.Linear(120, 84)
        self.fc3   = nn.Linear(84, 10)         # 10 classes

    def forward(self, x):
        x = F.max_pool2d(F.relu(self.conv1(x)), (2, 2))   # conv -> relu -> pool
        x = F.max_pool2d(F.relu(self.conv2(x)), 2)         # conv -> relu -> pool  (2 = square window)
        x = x.view(-1, self.num_flat_features(x))          # flatten to 1-D per sample
        x = F.relu(self.fc1(x))
        x = F.relu(self.fc2(x))
        x = self.fc3(x)                                    # raw output (logits)
        return x

    def num_flat_features(self, x):
        size = x.size()[1:]            # ALL dims except the batch dimension
        num_features = 1
        for s in size: num_features *= s
        return num_features
```
Key facts:
- **You write only `forward()`. `backward()` is automatically defined by autograd.** ⚠️ **EXAM Q9 (you answered True — wrong!)**. The lab states it verbatim: *"You just have to define the forward function, and the backward function is automatically defined for you using autograd."*
- `net.parameters()` returns **all learnable tensors** — this net has **10**: (conv1.w, conv1.b, conv2.w, conv2.b, fc1.w, fc1.b, fc2.w, fc2.b, fc3.w, fc3.b).
- `params[0]` = conv1 weight, shape `(6, 1, 3, 3)`; `params[6]` = fc2 weight, shape `(84, 120)`.
- Weights are initialized with **random uninitialized values** (via `torch.empty`-style init) *before* training.
- Input must be **4D**: `torch.randn(1, 1, 32, 32)` → output `(1, 10)`.
- **Shape trace of the lab's Net on 32×32 input** (run it to believe it): `32 → conv(3) → 30 → pool(2) → 15 → conv(3) → 13 → pool(2) → 6 → view → 16·6·6 = 576 → fc → 10`. The forward prints `torch.Size([1, 576])`.
- The computation graph: `input → conv2d → relu → maxpool2d → conv2d → relu → maxpool2d → view → linear → relu → linear → relu → linear` (then → MSELoss → loss).

## Mini-batch rule (NOTE box)
- **`torch.nn` only supports mini-batches** — inputs are `nSamples × nChannels × H × W`.
- Single sample? Add a fake batch dimension: `input.unsqueeze(0)`.

## Loss functions
```python
criterion = nn.MSELoss()
target = target.view(1, -1)        # make target the SAME shape as output
loss = criterion(output, target)   # scalar tensor with grad_fn=<MseLossBackward0>
```
- Loss = how far output is from target. (Lab 9 will switch to `nn.CrossEntropyLoss`.)

## The gradient-zeroing lesson (⚠ EXAM Q28, Q47 — your weakest spot)
```python
print(net.conv1.bias.grad)   # some tensor (gradients from a previous backward!)
net.zero_grad()              # ZERO all parameter gradients -> grad becomes None/0
print(net.conv1.bias.grad)   # None / cleared
loss.backward()              # now grads are populated FRESH
```
- **Why zero?** Gradients **accumulate** — if you don't clear them, each iteration *adds* to the old values and your update is wrong.
- The lab's phrase: *"You need to clear the existing gradients though, else gradients will be accumulated to existing gradients."*

## Updating weights — from raw math to torch.optim
Manual SGD:
```python
learning_rate = 0.01
for f in net.parameters():
    f.data.sub_(f.grad.data * learning_rate)     # weight = weight - lr * gradient
```
The proper way (torch.optim — knows SGD, Nesterov-SGD, Adam, RMSProp, ...):
```python
optimizer = optim.SGD(net.parameters(), lr=0.01)   # or optim.Adam(...)

# THE TRAINING LOOP — learn by heart (order matters!)
optimizer.zero_grad()        # 1. clear old gradients
output = net(input)          # 2. forward
loss = criterion(output, target)
loss.backward()              # 3. compute new gradients
optimizer.step()             # 4. update weights
```
⚠️ **EXAM Q28** (explain-code) asks what's missing in a loop that starts with `output = net(input)` → the answer is **`optimizer.zero_grad()`** at the top. **EXAM Q47** blanks = **zero_grad / backward / step** — you only filled `step`.

## Recap box (verbatim meanings)
| Class | Role |
|---|---|
| `torch.Tensor` | multi-dim array; holds `.grad` w.r.t. tensors; supports `backward()` |
| `nn.Module` | network module — **convenient encapsulation of parameters** (+ GPU move, export, load helpers) |
| `nn.Parameter` | Tensor **auto-registered as a parameter** when assigned as a Module attribute |
| `autograd.Function` | implements forward **and** backward of an autograd operation; every tensor op creates ≥1 Function node encoding its history |

## Displaying images (again)
```python
def imshow(img):
    img = img / 2 + 0.5                       # un-normalize (reverse Normalize(0.5,0.5))
    npimg = img.numpy()
    plt.imshow(np.transpose(npimg, (1, 2, 0)))  # (C,H,W) -> (H,W,C)
```

---

# Self-check — Labs 6–7

1. In your own words: what are the two steps of NN training, and what does backward propagation actually collect?
2. `resnet18(weights=ResNet18_Weights.DEFAULT)` vs `resnet18(weights=None)` — difference?
3. What is `state_dict`? What shape is `conv1.weight` in ResNet-18 and what do the 4 numbers mean?
4. You have a pretrained model with `fc` = `Linear(512, 1000)` but your dataset has 20 classes. Write the two-line fix.
5. Freeze all params of `model` except the new head — code?
6. Why must `labels` have `n_features` columns? What shape did the demo use?
7. Write `nn.Conv2d` and `nn.Linear` signatures. For input `(1,4,4)` with `Conv2d(1,1,kernel=2,stride=1)`, what's the output size?
8. `H_in=32, K=3, P=0, D=1, S=1` → H_out? Then pool k=2,s=2 → ?
9. What is the FULL size trace of the lab's Net for input (1,1,32,32) up to the flatten? (Answer: `1,576` — derive it: 32→30→15→13→6, 16×6×6.)
10. True/False: (a) you must define `backward()` yourself in your class. (b) gradients accumulate if you don't zero them. (c) `view()` copies data. (d) `nn.Parameter` requires grad by default.
11. Fill in the training loop: `___()` → `output = net(input)` → `loss = ...` → `___()` → `___()`.
12. What does `F.relu` compute? What does `nn.Softmax` compute, and does Lab 9's network apply it?
13. Why `unsqueeze(0)` for a single image?
14. In the freezing demo, after `param.requires_grad = False` + `model.fc = nn.Linear(512,10)`, which tensors get gradients during `loss.backward()`?

**Answers:** 1) forward = best guess; backward = collect derivatives (gradients) of loss w.r.t. each parameter, traversing output→inputs. 2) pretrained-ImageNet vs random-init. 3) dict {layer: tensor}; (64,3,7,7) = out-channels, in-channels(RGB), 7×7 kernel. 4) `model.fc = nn.Linear(model.fc.in_features, 20)`. 5) loop `model.parameters()` → `requires_grad=False`, then replace `model.fc`. 6) output/label dims must match; demo `(1,10)`. 7) see table; output `(1,3,3)`. 8) 30 → 15. 9) 32→30→15→13→6; 16·6·6=576. 10) (a) False (auto!), (b) True, (c) False (shares), (d) True. 11) `optimizer.zero_grad` → forward → `loss.backward` → `optimizer.step`. 12) max(0,x); softmax = exp/Σexp → probabilities sum 1; **Lab 9 does NOT apply it** (outputs are logits). 13) nn needs batch dim. 14) Only `model.fc`'s weight & bias.

**Exam questions this prepares you for:** Q5, Q9, Q20, Q21, Q24, Q28, Q29, Q34, Q37, Q47, plus Section 4's Q33/Q34.

---
*Next: Study Guide 4 — Lab 8 (Transforms & DataLoaders) & Lab 9 (Training a classifier).*
