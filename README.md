# SignalGarden 🌱

**A tiny, explainable AI that learns to sort your thoughts.** Give it labeled notes, type a new idea, and see which category fits best and which words influenced the prediction.

**Founded by [Haseeb Abidi](https://github.com/Haseebabidi).**

SignalGarden is a complete, local-first browser app. There is no account, API key, build step, or model download. The classifier trains instantly in your browser, and your notes stay there unless you export them.

## Try it

1. Install Python 3 (or use any local static web server).
2. From this folder, run:

   ```sh
   python -m http.server 8000
   ```

3. Open [http://localhost:8000](http://localhost:8000).
4. Type a thought in the playground. Save it as an example to teach the model, or add your own categories and examples below.

The app includes 20 starter notes across **Build**, **Explore**, **Reflect**, and **Share**. You can replace those with your own garden.

## What makes it AI?

SignalGarden trains a **multinomial Naive Bayes text classifier** on your labeled examples. It tokenizes each note, counts words by category, and uses add-one smoothing to estimate a category for new text. The colored bars show normalized model scores. The highlighted words show which familiar tokens favored the top category over the next best one.

It is intentionally small and transparent. The percentages are model estimates, **not calibrated certainty**. It only understands patterns in the examples you provide; unfamiliar words need new training examples.

## Features

- Train with your own categories and notes, with instant retraining.
- See ranked predictions and influential words.
- Filter, add, and remove training examples.
- Keep data in browser storage; export and import portable JSON backups.
- Responsive layout and keyboard-accessible controls.
- No runtime dependencies or remote requests.

## Test

With Node.js 18 or newer:

```sh
node --test tests/model.test.mjs
```

## Project layout

```text
index.html          App structure
styles.css          Visual design and responsive layout
js/app.js           Interface, local storage, import/export
js/model.js         Dependency-free classifier
tests/model.test.mjs Classifier checks
```

## Privacy

Your garden is saved to `localStorage` in the browser where you use it. Export a JSON backup before clearing browser data or switching devices. Imported files are read locally and are never uploaded.

## License

MIT. See [LICENSE](LICENSE).
