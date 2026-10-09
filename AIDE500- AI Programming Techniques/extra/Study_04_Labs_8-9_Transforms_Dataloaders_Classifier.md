# Study Guide 4 — Labs 8–9: Transforms, DataLoaders & Training a CIFAR-10 Classifier

> **Method:** Read → run the notebooks → retype the training loop from memory → Self-check out loud.

---

# LAB 8 — Transforms & DataLoaders

## Why transforms exist
- Data rarely arrives in the form a model needs. **Transforms manipulate/augment data to make it suitable for training.**
- Vision data packages: **Pillow, OpenCV** (images); scipy/librosa (audio); NLTK/SpaCy (text). For vision, PyTorch bundles everything in **`torchvision`**: dataset loaders (ImageNet, CIFAR-10, MNIST) + transformers.
- **TorchVision datasets take two parameters:** `transform` = modifies the **features**, `target_transform` = modifies the **labels** (both accept callables).

## The three transforms you must know (EXAM Q6, Q22, Q23, Q30, Q43)
| Transform | What it does |
|---|---|
| **`transforms.ToTensor()`** | PIL image or NumPy ndarray → **FloatTensor**, scales pixel intensities to **[0., 1.]** (i.e. ÷255) |
| **`transforms.Normalize(mean, std)`** | per-channel: `output[channel] = (input[channel] − mean[channel]) / std[channel]` |
| **`transforms.Compose([...])`** | runs a **list of transforms in sequence** |

Full pipeline from the labs:
```python
transform = transforms.Compose([
    transforms.ToTensor(),                                   # [0,255] -> [0,1]
    transforms.Normalize((0.5,0.5,0.5), (0.5,0.5,0.5))       # [0,1] -> [-1,1]
])
```
⚠️ Two facts that cost you exam points:
- **Q23:** after `Normalize(0.5, 0.5)`, range is **[−1, 1]** — NOT [0,1] (that's ToTensor's job). `(0−0.5)/0.5 = −1`, `(1−0.5)/0.5 = +1`.
- **Q43 (fill-in):** the formula blanks are `(x − `**`mean`**`) / `**`std`**.
- **Q30c:** `Normalize` **does not support PIL Images** — that's why ToTensor must come first.

## Dataset vs DataLoader (the division of labor)
| | `Dataset` | `DataLoader` |
|---|---|---|
| Role | **stores** samples + labels | **wraps an iterable** around the dataset |
| Access | one sample at a time: `training_data[i]` | **minibatches**, shuffling, multiprocessing |
| Why | decouples data code from training code | training wants minibatches |

Why train with minibatches + shuffle (from the lab):
- **minibatches** → efficient gradient estimates;
- **reshuffle at every epoch** → reduces **overfitting** and class **bias** (lab comment: shuffling removes bias when one class appears more);
- **multiprocessing** (`num_workers`) → faster data retrieval.

## Loading FashionMNIST (the lab's dataset)
```python
training_data = datasets.FashionMNIST(root="data", train=True,  download=False, transform=ToTensor())
test_data     = datasets.FashionMNIST(root="data", train=False, download=False, transform=ToTensor())
```
- Parameters: **`root`** = storage path; **`train`** = True(train)/False(test); **`download`** = fetch if missing; **`transform`**/``target_transform`**.
- **Fashion-MNIST facts:** Zalando article images, **60,000 training + 10,000 test**, each = **28×28 grayscale** image + label from **10 classes** (0 T-shirt/top … 9 Ankle boot).

## Indexing & visualizing
```python
sample_idx = torch.randint(len(training_data), size=(1,)).item()  # random index as int
img, label = training_data[sample_idx]                            # tuple (image, label)
plt.imshow(img.squeeze(), cmap="gray")                            # drop channel dim for display
```
- ⚠️ **EXAM Q46 (you answered `slice[1:]` — wrong):** **`.squeeze()` removes ALL dimensions of size 1.** A grayscale image loads as `(1, 28, 28)`; `.squeeze()` → `(28, 28)` so `imshow` works. Slicing `[1:]` *keeps* a dimension (it would give (1,28,28) minus first row... it doesn't remove the channel axis the way you need).

## DataLoaders + iterating batches
```python
train_dataloader = DataLoader(training_data, batch_size=64, shuffle=True)
test_dataloader  = DataLoader(test_data,     batch_size=8,  shuffle=False)

train_features, train_labels = next(iter(train_dataloader))
# train_features: torch.Size([64, 1, 28, 28])   (batch, channel, H, W)
# train_labels:   torch.Size([64])

img = train_features[0].squeeze()   # first image of the batch: (1,28,28) -> (28,28)
label = train_labels[0]
```
- `next(iter(loader))` = pull **one batch**.
- ⚠️ **EXAM Q10 (you answered True — wrong):** for **visualization/comparison** loaders use **`shuffle=False`** — the lab says it explicitly: *"Because we specified shuffle=False, the data is not shuffled"* — you must always see the same images in the same order to compare them fairly. Train loader = `shuffle=True`.

---

# LAB 9 — Train a Classifier on CIFAR-10 (the capstone)

## The 5 steps (the exam's skeleton for Sections 3–4)
a. Load & normalize CIFAR-10 with `torchvision`
b. Define a CNN
c. Define a loss function
d. Train the network
e. Test the network

## CIFAR-10 facts
- 10 classes: `('plane','car','bird','cat','deer','dog','frog','horse','ship','truck')`
- Images: **3×32×32** (3-channel color, 32×32 px). 50,000 train / 10,000 test.

## (a) Loading + normalizing — read this twice, it's 5 exam points
```python
transform = transforms.Compose([
    transforms.ToTensor(),                                 # PIL [0,255] -> tensor [0,1]
    transforms.Normalize((0.5,0.5,0.5), (0.5,0.5,0.5))     # [0,1] -> [-1,1]
])
trainset    = torchvision.datasets.CIFAR10(root='./data', train=True,  download=True, transform=transform)
trainloader = torch.utils.data.DataLoader(trainset, batch_size=16, shuffle=True,  num_workers=2)
testset     = torchvision.datasets.CIFAR10(root='./data', train=False, download=True, transform=transform)
testloader  = torch.utils.data.DataLoader(testset,  batch_size=4,  shuffle=True,  num_workers=2)
```
- **Value ranges (memorize the chain):** CIFAR-10 gives PIL **[0, 255]** → `ToTensor` → **[0, 1]** → `Normalize(0.5,0.5)` → **[−1, 1]**.
- **Why normalize? (exam open-question answer):** ① faster & more stable training (inputs centered at 0 → gradients flow better); ② keeps all features on the **same scale**; ③ activations (ReLU, Tanh, Sigmoid) behave better with zero-centered inputs.
- **Two ways to pick mean/std:**
  - **Method 1 — math mapping:** `mean=std=0.5` → `normalized = (x − 0.5)/0.5 = 2x − 1`; so 0→−1, 0.5→0, 1→1.
  - **Method 2 — dataset statistics (z-score):** compute real per-channel stats over all 50,000 images; for CIFAR-10: `mean = [0.4914, 0.4822, 0.4465]`, `std = [0.2470, 0.2435, 0.2616]` → resulting dataset has mean 0, std 1 per channel.
- **`num_workers`**: number of **parallel subprocesses** loading data. `0` = main process; higher = GPU works on current batch while workers load the next (tune for your machine).
- Un-normalizing for display: `img = img/2 + 0.5` (reverses `2x−1`), then `np.transpose(npimg, (1,2,0))`.

## (b) The CIFAR Net — architecture + full shape trace (EXAM Q21, Q29)
```python
class Net(nn.Module):
    def __init__(self):
        super(Net, self).__init__()
        self.conv1 = nn.Conv2d(3, 6, 5)          # 3 -> 6 channels, 5x5 kernel
        self.pool  = nn.MaxPool2d(2, 2)          # halves H and W
        self.conv2 = nn.Conv2d(6, 16, 5)         # 6 -> 16 channels, 5x5 kernel
        self.fc1   = nn.Linear(16 * 5 * 5, 120)  # in_features = 400
        self.fc2   = nn.Linear(120, 84)
        self.fc3   = nn.Linear(84, 10)           # 10 classes

    def forward(self, x):
        x = self.pool(F.relu(self.conv1(x)))     # conv -> relu -> pool
        x = self.pool(F.relu(self.conv2(x)))     # conv -> relu -> pool
        x = x.view(-1, 16 * 5 * 5)               # flatten -> 400
        x = F.relu(self.fc1(x))
        x = F.relu(self.fc2(x))
        x = self.fc3(x)                          # raw outputs (logits!)
        return x
```
**The shape trace — this exact trace was EXAM Q29:**
```
input [B, 3, 32, 32]
  → conv1 k=5: (32−5)/1+1 = 28        → [B, 6, 28, 28]   (EXAM Q21: 28 ✓)
  → pool  k=2: 28/2 = 14              → [B, 6, 14, 14]
  → conv2 k=5: (14−5)/1+1 = 10        → [B, 16, 10, 10]
  → pool  k=2: 10/2 = 5               → [B, 16, 5, 5]
  → view(-1, 16*5*5)                  → [B, 400]
  → fc1 → fc2 → fc3                   → [B, 10]
```
- The printed model shows **`fc1: Linear(in_features=400, ...)`** — 400 = 16·5·5.
- For a **batch of 16**: view → `[16, 400]`, final → `[16, 10]`. For exam Q29's batch of 16: (a) `[16,6,28,28]`, (b) `[16,6,14,14]`, (c) `[16,16,10,10]`, (d) `[16,16,5,5]`, (e) `[16,400]`, (f) `[16,10]`.
- Exam NOTE: *"pay attention to in/out features at the transition between Conv and Linear"* — the Linear's `in_features` must equal **channels × H × W** after the last pool.

## (c) Loss + optimizer
```python
criterion = nn.CrossEntropyLoss()                        # classification loss (mean over batch)
optimizer = optim.SGD(net.parameters(), lr=0.01, momentum=0.9)
```
- ⚠️ **EXAM Q44 blanks:** `nn.____Loss()` = **CrossEntropyLoss**, `lr = ____` = **0.01**.
- `CrossEntropyLoss` **combines log-softmax + NLL internally** — you do NOT apply Softmax yourself, and the network's `forward` returns **raw logits**. (Fixes your Q5/Q24 thinking.)

## (d) The training loop — the single most re-typed code in the course (EXAM Q42, Q47)
```python
n_epochs = 10                       # an EPOCH = one full pass of the model over ALL the data

for epoch in range(n_epochs):
    running_loss = 0.0
    for i, data in enumerate(trainloader, 0):   # 0 = starting index
        inputs, labels = data                   # data = [images, labels]

        optimizer.zero_grad()                   # 1. CLEAR old gradients

        outputs = net(inputs)                   # 2. forward pass
        loss = criterion(outputs, labels)       # 3. compute loss
        loss.backward()                         # 4. compute new gradients
        optimizer.step()                        # 5. update weights

        running_loss += loss.item()             # .item() -> Python float
        if i % 2000 == 1999:                    # print every 2000 mini-batches
            print('[%d, %5d] loss: %.3f' % (epoch+1, i+1, running_loss/2000))
            running_loss = 0.0
```
- ⚠️ **EXAM Q42 blank:** "one full pass over the training dataset" = **one `epoch`** (lab comment: *"an epoch = the number of times all the data has passed through the model"*).
- ⚠️ **EXAM Q47 blanks:** **zero_grad → backward → step** (you filled only `step`).
- Observed loss curve: `1.765 → 1.371 → ... → 1.117` over 10 epochs = the network is learning.
- Save/load: `torch.save(net.state_dict(), PATH)` / `trainednet = Net(); trainednet.load_state_dict(torch.load(PATH))` → `<All keys matched successfully>`.

## (e) Testing — EXAM Q24 and Q34 live here
```python
outputs = trainednet(images)     # shape [4, 10]
# "The outputs are ENERGIES for the 10 classes" (lab's words) = raw logits, NOT probabilities

t, predicted = torch.max(outputs, 1)
# t         = the maximum SCORE per image     (shape [B])
# predicted = the INDEX of that maximum        (shape [B]) -> predicted CLASS
```
⚠️ **EXAM Q24 (you answered "probabilities summing to 1" — wrong):** with **no Softmax anywhere**, `torch.max(outputs, 1)` returns **class indices** (argmax), not probabilities. And the outputs are "**energies**" = logits — can be negative, don't sum to 1 (look at the lab printout: `-0.60, -2.49, 1.48, ...`).

Whole-dataset accuracy:
```python
correct, total = 0, 0
with torch.no_grad():                              # NO gradient tracking for testing (EXAM Q34)
    for data in testloader:
        images, labels = data
        outputs = trainednet(images)
        _, predicted = torch.max(outputs.data, 1)
        total   += labels.size(0)
        correct += (predicted == labels).sum().item()

print('Accuracy: %d %%' % (100 * correct / total))     # lab result: 55%
```
- Random chance = **10%** (10 classes) → 55% means it learned something.
- Per-class accuracy: `class_correct`/`class_total` lists, `c = (predicted == labels).squeeze()`. Lab results: frog/car/truck ~67–69%, cat worst ~38%.
- **`torch.no_grad()`** = the testing mode (Lab 5's "disable tracking"): no graph built, no gradients — faster + correct for inference. ⚠️ EXAM Q34 wants: `model.eval()` + `with torch.no_grad():` + argmax.
- **Continue training:** load `state_dict`, run the same loop → loss continues around 1.14 (demonstrates resuming).

## GPU training
```python
device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
net.to(device)                                   # moves ALL parameters to GPU
inputs, labels = data[0].to(device), data[1].to(device)   # move EVERY batch too
```
- Remember: both model **and** inputs/labels must be sent to the device each step.

---

# Self-check — Labs 8–9

1. `ToTensor` vs `Normalize` — what does each do, with input/output ranges?
2. Write the Normalize formula and compute it for x=0.75 with mean=std=0.5.
3. Why must `ToTensor` come before `Normalize`? (name the constraint)
4. What are the two dataset parameters for modifying features vs labels?
5. FashionMNIST: how many train/test images, what size, what type?
6. `.squeeze()` on a (1,28,28) tensor → ? Why needed for `imshow`? (This is EXAM Q46.)
7. Train vs test loader settings in the labs — batch sizes and shuffle values, and WHY test uses shuffle=False for visualization (EXAM Q10)?
8. CIFAR-10: classes list, image shape, normalize ranges end-to-end.
9. Full shape trace of Lab 9's Net for input `[16,3,32,32]` → list all 6 intermediate shapes (EXAM Q29).
10. What is `in_features` of `fc1` and how is it computed?
11. What does an **epoch** mean? How many epoch-loops does the lab run (EXAM Q42)?
12. Fill the 4 training-loop lines in order (EXAM Q47).
13. Are `outputs` probabilities or logits? What are the two values returned by `torch.max(outputs, 1)` and their shapes (EXAM Q5/Q24)?
14. Why wrap testing in `torch.no_grad()`? What else should accompany it for correct evaluation (EXAM Q34)?
15. Lab numbers: loss at epoch 1 vs 10; final accuracy; chance accuracy; worst class.

**Answers:** 1) ToTensor: PIL/NumPy → FloatTensor [0,1]; Normalize: per-channel (x−mean)/std, here [0,1]→[−1,1]. 2) `(x−mean)/std`; (0.75−0.5)/0.5 = 0.5. 3) Normalize doesn't support PIL. 4) `transform`, `target_transform`. 5) 60,000/10,000, 28×28 grayscale, 10 classes. 6) → (28,28); removes size-1 channel dim. 7) train: 64/True; test: 8/False (visualization must be stable); shuffle=True in the lab's testloader for training-eval batches. 8) plane…truck; 3×32×32; [0,255]→[0,1]→[−1,1]. 9) `[16,6,28,28] → [16,6,14,14] → [16,16,10,10] → [16,16,5,5] → [16,400] → [16,10]`. 10) 400 = 16·5·5. 11) one full pass over all data; 10 epochs. 12) zero_grad → forward → backward → step. 13) logits/energies; t = max scores [B], predicted = class indices [B]. 14) no graph/gradients needed (faster, correct for inference); + `model.eval()`. 15) 1.765 → 1.117; 55%; 10%; cat (~38%).

**Exam questions this prepares you for:** Q5, Q6, Q10, Q21, Q22, Q23, Q24, Q29, Q30, Q34, Q42, Q43, Q44, Q46, Q47, and all of Section 4 (Q32–Q37).

---
*Next: Study Guide 5 — Lab 10 (Data Augmentation) + full exam-review checklist.*
