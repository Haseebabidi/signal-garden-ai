import test from "node:test";
import assert from "node:assert/strict";
import { tokenize, train } from "../js/model.js";

test("tokenizes Unicode text consistently", () => {
  assert.deepEqual(tokenize("  CAFÉ, don't — garden42!  "), ["café", "don't", "garden42"]);
  assert.deepEqual(tokenize("I wrote an app for my friends"), ["i", "wrote", "an", "app", "for", "my", "friends"]);
  assert.deepEqual(tokenize(null), []);
});

test("an empty or unusable training set returns a safe empty model", () => {
  for (const examples of [[], null, [{ id: 1, text: "   ", label: "Ideas" }]]) {
    const model = train(examples);
    assert.deepEqual(model.labels, []);
    assert.deepEqual(model.vocabulary, []);
    assert.deepEqual(model.predict("anything"), []);
    assert.deepEqual(model.explain("anything", "Ideas"), []);
  }
});

test("learns categories and returns sorted probabilities that sum to one", () => {
  const model = train([
    { id: 1, label: "Garden", text: "Grow basil and mint" },
    { id: 2, label: "Garden", text: "Water tomato plants" },
    { id: 3, label: "Code", text: "Fix compiler bug" },
    { id: 4, label: "Code", text: "Review JavaScript tests" },
  ]);
  const result = model.predict("basil and tomato plants");
  assert.deepEqual(model.labels, ["Code", "Garden"]);
  assert.equal(result[0].label, "Garden");
  assert.ok(result[0].probability > result[1].probability);
  assert.ok(Math.abs(result.reduce((sum, row) => sum + row.probability, 0) - 1) < 1e-12);
  assert.ok(model.vocabulary.includes("basil"));
});

test("empty and unknown text fall back to category priors", () => {
  const model = train([
    { id: 1, label: "A", text: "apple" },
    { id: 2, label: "A", text: "apricot" },
    { id: 3, label: "B", text: "banana" },
  ]);
  assert.deepEqual(model.predict(""), model.predict("never-seen-words"));
  assert.equal(model.predict("")[0].label, "A");
  assert.equal(train([{ id: 1, label: "Only", text: "apple" }]).predict("")[0].probability, 1);
});

test("duplicate notes do not distort the model, even with different IDs or punctuation", () => {
  const unique = [
    { id: 1, label: "Space", text: "Bright comet!" },
    { id: 2, label: "Garden", text: "green leaf" },
  ];
  const repeated = [...unique,
    { id: 3, label: "Space", text: "BRIGHT COMET" },
    { id: 4, label: "Space", text: "Bright comet!" },
  ];
  assert.deepEqual(train(repeated).predict("comet"), train(unique).predict("comet"));
  assert.deepEqual(train(repeated).explain("comet", "Space"), train(unique).explain("comet", "Space"));
});

test("explanations show supporting, opposing, and unseen words", () => {
  const model = train([
    { id: 1, label: "Red", text: "red red rose" },
    { id: 2, label: "Blue", text: "blue blue sky" },
  ]);
  const explanation = model.explain("red red blue mystery", "Red");
  assert.ok(explanation.find(({ token }) => token === "red").score > 0);
  assert.ok(explanation.find(({ token }) => token === "blue").score < 0);
  assert.equal(explanation.find(({ token }) => token === "mystery").score, 0);
  assert.deepEqual(explanation.map(({ score }) => score),
    [...explanation.map(({ score }) => score)].sort((a, b) => b - a));
  assert.deepEqual(model.explain("red", "Missing"), []);
});

test("common English filler words are ignored by training, prediction, and explanation", () => {
  const model = train([
    { id: 1, label: "Flowers", text: "The red rose and the red tulip" },
    { id: 2, label: "Weather", text: "The blue sky and the blue rain" },
  ]);
  assert.ok(!model.vocabulary.includes("the"));
  assert.ok(!model.vocabulary.includes("and"));
  assert.deepEqual(model.predict("the red rose and my"), model.predict("red rose"));
  assert.deepEqual(model.explain("the red rose and my", "Flowers"), model.explain("red rose", "Flowers"));
});

test("a prototyping thought goes to Build with the app's starter examples", () => {
  const starterNotes = [
    ["Build", "Prototype a small app that helps people find new music."],
    ["Build", "Fix the broken search feature before launching the product."],
    ["Build", "Sketch a dashboard and write the first lines of code."],
    ["Build", "Turn this idea into a working tool this weekend."],
    ["Build", "Design a simple website for the neighborhood bookstore."],
    ["Explore", "Read about coral reefs and the animals that live there."],
    ["Explore", "Visit a new city and discover its hidden cafes."],
    ["Explore", "Research how satellites map the ocean."],
    ["Explore", "Learn a language and travel somewhere unfamiliar."],
    ["Explore", "Follow a question down a rabbit hole and see what I find."],
    ["Reflect", "Write about what made today feel meaningful."],
    ["Reflect", "Journal about a hard conversation and what I learned."],
    ["Reflect", "Pause and notice how my mood changed this week."],
    ["Reflect", "Think about the memories I want to keep."],
    ["Reflect", "Make time to rest and understand what matters to me."],
    ["Share", "Send the finished story to my friends for feedback."],
    ["Share", "Publish a short guide so other people can learn too."],
    ["Share", "Show my photos to the group and tell the story behind them."],
    ["Share", "Teach a friend what I learned from this experiment."],
    ["Share", "Post the project online and invite people to try it."],
  ];
  const examples = starterNotes.map(([label, text], id) => ({ id, label, text }));
  const predictions = train(examples).predict("I want to prototype an app and write code for my friends.");
  assert.equal(predictions[0].label, "Build");
  assert.ok(predictions[0].probability > 0.5);
});
