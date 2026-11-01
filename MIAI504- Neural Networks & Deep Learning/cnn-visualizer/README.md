# CNN, live

A tiny CNN trained on MNIST in the browser, drawn on a canvas so you can watch every step: the kernel sliding over the digit, ReLU, max pooling, the dense layers firing, softmax, then the whole backward pass and the weight update.

```
28×28 → conv 3×3 ×6 → ReLU → max pool 2×2 → 13×13×6 → dense 16 (ReLU) → dense 10 → softmax
16,476 weights · ~90% test accuracy after one pass over 12k digits, ~94% after two
```

## Run it

```bash
npm install
npm run data   # downloads MNIST, writes public/mnist/{train,test}.bin (12k + 2k digits, ~11 MB)
npm run dev    # http://localhost:5174
```

`npm run check` runs a numerical gradient check on the network and one training epoch in Node.

## Two modes

**One sample, step by step.** One forward and backward pass, slowed down into 14 phases. Use Play, Next phase, or click any phase in the bar to jump there. The panel under the canvas shows the live arithmetic of the current phase: the patch ⊙ kernel sum, the 2×2 max, δ = p − t, ∂E/∂K accumulating, and the kernel before and after the update. Click a filter row or a hidden neuron to inspect that one.

**Train live.** Mini-batch SGD on 12k digits, with the loss and test-accuracy curves updating as it goes. Switch the view between activations and gradients. At 1 sample per frame you can follow individual digits; at 64+ you watch the kernels turn into stroke detectors. Try η = 1 to see training fall apart.

You can also draw your own digit, pick the target, and watch backprop push the network toward it.

## Where things are

| File | What it does |
|---|---|
| `src/nn/net.ts` | The network: `forward` and `backward` written out by hand, plain `Float32Array`s, no libraries |
| `src/engine.ts` | Animation clock, phase timeline, step-mode update, training loop, test-accuracy evaluation |
| `src/viz/render.ts` | Draws the scene for a given `stage` (phase index + progress). Everything is already computed; the stage decides how much to reveal |
| `src/viz/layout.ts` | Positions on the 1280×720 logical canvas, and hit-testing for clicks |
| `src/ui/Detail.tsx` | The live explanation panel |
| `src/ui/DrawPad.tsx` | Drawing → MNIST-style 28×28 (fit to 20×20, centre by mass) |
| `scripts/prepare_mnist.py` | Downloads MNIST from the PyTorch mirror and writes the subset |
| `scripts/check_net.ts` | Gradient check and a quick training run |

In dev mode the engine is on `window.engine`, so you can poke at it from the browser console: `engine.stage = 12.5`, `engine.trace.dConv`, `engine.params.k`.

## Colours

Blue is positive, rose is negative, amber is an activation (≥ 0). Gradient maps use a square-root scale, because most gradients are tiny and a few are large. Line width is the size of a contribution: forward, how much a map or neuron adds to the next layer; backward, how much error flows back along that connection.
