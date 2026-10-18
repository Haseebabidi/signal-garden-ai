import { tokenize, train } from "./model.js";

const STORAGE_KEY = "signalgarden:v1";
const ALL_FILTER = Symbol("all categories");
const palette = ["#a8c76d", "#90bad0", "#e9a885", "#b8a4d0", "#e5c978", "#92c7b6", "#d8a9bd", "#a5b2da"];
const starters = {
  labels: ["Build", "Explore", "Reflect", "Share"],
  examples: [
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
  ].map(([label, text], index) => ({ id: `sample-${index + 1}`, label, text })),
};

const $ = (selector) => document.querySelector(selector);
const refs = {
  thought: $("#thought-input"), characterCount: $("#character-count"),
  teachLabel: $("#teach-label"), teachButton: $("#teach-button"),
  result: $("#result-content"), exampleCount: $("#example-count"),
  gardenCount: $("#garden-count"), filters: $("#category-filters"),
  examples: $("#example-list"), exampleInput: $("#example-input"),
  exampleLabel: $("#example-label"), exampleButton: $("#example-button"),
  categories: $("#category-list"), categoryForm: $("#category-form"),
  categoryInput: $("#category-input"), exportButton: $("#export-button"),
  importButton: $("#import-button"), importFile: $("#import-file"),
  resetButton: $("#reset-button"), toast: $("#toast"),
};

function copyStarters() {
  return { labels: [...starters.labels], examples: starters.examples.map((item) => ({ ...item })) };
}

function validateGarden(value) {
  if (!value || !Array.isArray(value.labels) || !Array.isArray(value.examples)) throw new Error("That file is not a SignalGarden export.");
  const labels = value.labels.filter((label) => typeof label === "string" && label.trim() && label.trim().length <= 24).map((label) => label.trim());
  if (!labels.length || labels.length > 12 || new Set(labels.map((label) => label.toLowerCase())).size !== labels.length) throw new Error("The garden needs 1 to 12 unique category names.");
  if (value.examples.length > 1000) throw new Error("This garden has too many examples (1,000 maximum).");
  const examples = value.examples.map((item, index) => {
    if (!item || typeof item.text !== "string" || typeof item.label !== "string") throw new Error(`Example ${index + 1} is invalid.`);
    const text = item.text.trim();
    if (!text || text.length > 600 || !tokenize(text).length || !labels.includes(item.label)) throw new Error(`Example ${index + 1} has an invalid note or category.`);
    return { id: `import-${index}-${Math.random().toString(36).slice(2)}`, text, label: item.label };
  });
  const seen = new Set();
  return { labels, examples: examples.filter((item) => {
    const key = JSON.stringify([item.label, tokenize(item.text)]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }) };
}

function loadGarden() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? validateGarden(JSON.parse(saved)) : copyStarters();
  } catch {
    return copyStarters();
  }
}

let garden = loadGarden();
let filter = ALL_FILTER;
let model = train(garden.examples);
let toastTimer;

function saveGarden() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(garden)); }
  catch { toast("Browser storage is unavailable. Export your garden to keep it."); }
}

function notifyChange(message) {
  model = train(garden.examples);
  saveGarden();
  renderAll();
  toast(message);
}

function toast(message) {
  refs.toast.textContent = message;
  refs.toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => refs.toast.classList.remove("visible"), 3300);
}

function make(tag, className, content) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (content !== undefined) element.textContent = content;
  return element;
}

function colorFor(label) {
  return palette[Math.max(0, garden.labels.indexOf(label)) % palette.length];
}

function fillSelect(select) {
  const current = select.value;
  select.replaceChildren(...garden.labels.map((label) => {
    const option = make("option", "", label);
    option.value = label;
    return option;
  }));
  if (garden.labels.includes(current)) select.value = current;
}

function renderLabels() {
  fillSelect(refs.teachLabel);
  fillSelect(refs.exampleLabel);
  refs.categories.replaceChildren(...garden.labels.map((label) => {
    const pill = make("span", "category-pill");
    const dot = make("i"); dot.style.backgroundColor = colorFor(label);
    pill.append(dot, document.createTextNode(label));
    const remove = make("button", "remove-example", "×");
    remove.type = "button";
    remove.title = `Remove ${label} category`;
    remove.setAttribute("aria-label", `Remove ${label} category`);
    remove.addEventListener("click", () => removeCategory(label));
    pill.append(remove);
    return pill;
  }));
}

function renderFilters() {
  if (filter !== ALL_FILTER && !garden.labels.includes(filter)) filter = ALL_FILTER;
  refs.filters.replaceChildren(...[ALL_FILTER, ...garden.labels].map((label) => {
    const button = make("button", `filter-button${filter === label ? " active" : ""}`, label === ALL_FILTER ? "All notes" : label);
    button.type = "button";
    button.setAttribute("aria-pressed", String(filter === label));
    button.addEventListener("click", () => { filter = label; renderFilters(); renderExamples(); });
    return button;
  }));
}

function renderExamples() {
  refs.exampleCount.textContent = String(garden.examples.length);
  refs.gardenCount.textContent = `${garden.examples.length} ${garden.examples.length === 1 ? "note" : "notes"}`;
  const visible = garden.examples.filter((item) => filter === ALL_FILTER || item.label === filter).slice().reverse();
  if (!visible.length) {
    refs.examples.replaceChildren(make("li", "list-empty", "No examples here yet. Plant one below."));
    return;
  }
  refs.examples.replaceChildren(...visible.map((item) => {
    const row = make("li", "example-item");
    const dot = make("span", "example-marker"); dot.style.backgroundColor = colorFor(item.label);
    const note = make("span", "example-text", item.text); note.title = item.text;
    const tag = make("span", "example-tag", item.label);
    const remove = make("button", "remove-example", "×"); remove.type = "button";
    remove.title = "Remove example"; remove.setAttribute("aria-label", `Remove example: ${item.text}`);
    remove.addEventListener("click", () => { garden.examples = garden.examples.filter((example) => example.id !== item.id); notifyChange("Example removed."); });
    row.append(dot, note, tag, remove);
    return row;
  }));
}

function emptyResult(icon, title, detail) {
  const empty = make("div", "empty-result");
  empty.append(make("div", "empty-orb", icon), make("h4", "", title), make("p", "", detail));
  refs.result.replaceChildren(empty);
}

function renderPrediction() {
  const text = refs.thought.value.trim();
  refs.characterCount.textContent = `${refs.thought.value.length} / 600`;
  refs.teachButton.disabled = !text || garden.examples.length >= 1000;
  if (!text) return emptyResult("✳", "Your thoughts go here", "Type something on the left and watch your little AI get to work.");
  if (!model.labels.length) return emptyResult("✳", "Your garden is just beginning", "Add a labeled example below to teach your AI its first category.");
  if (!tokenize(text).some((token) => model.vocabulary.includes(token))) {
    return emptyResult("?", "Still learning these words", "It hasn't seen any of these words yet. Add this thought as an example to teach it.");
  }

  const predictions = model.predict(text);
  const winner = predictions[0];
  const container = make("div");
  const top = make("div", "result-top");
  top.append(make("span", "", "Closest category"));
  const name = make("div", "prediction-name");
  const dot = make("span", "prediction-dot"); dot.style.backgroundColor = colorFor(winner.label);
  name.append(dot, document.createTextNode(winner.label));
  top.append(name);
  container.append(top, make("p", "result-desc", "How your categories compare for this thought:"));

  const list = make("div", "confidence-list");
  for (const prediction of predictions) {
    const item = make("div", "confidence-item");
    const bar = make("div", "confidence-bar");
    const fill = make("div", "confidence-fill");
    fill.style.backgroundColor = colorFor(prediction.label);
    fill.style.width = `${Math.max(1, Math.round(prediction.probability * 100))}%`;
    bar.append(fill);
    item.append(make("span", "confidence-label", prediction.label), bar, make("span", "confidence-value", `${Math.round(prediction.probability * 100)}%`));
    list.append(item);
  }
  container.append(list);
  const explanation = make("div", "explanation");
  explanation.append(make("div", "explanation-title", "Words that helped this prediction"));
  const influential = model.explain(text, winner.label).filter((item) => item.score > .05).slice(0, 6);
  if (influential.length) {
    const tokens = make("div", "token-list");
    tokens.append(...influential.map((item) => make("span", "token-pill", item.token)));
    explanation.append(tokens);
  } else explanation.append(make("span", "token-muted", "No single word strongly tipped this prediction."));
  container.append(explanation);
  refs.result.replaceChildren(container);
}

function renderAll() {
  renderLabels();
  renderFilters();
  renderExamples();
  renderPrediction();
  refs.exampleButton.disabled = garden.examples.length >= 1000;
}

function addExample(text, label) {
  text = text.trim();
  if (!text) return toast("Write a thought first.");
  if (!tokenize(text).length) return toast("Add a few words so your AI can learn from this thought.");
  if (!garden.labels.includes(label)) return toast("Choose a category first.");
  if (garden.examples.length >= 1000) return toast("This garden has reached its 1,000 example limit.");
  const key = JSON.stringify([label, tokenize(text)]);
  if (garden.examples.some((item) => JSON.stringify([item.label, tokenize(item.text)]) === key)) return toast("That example is already in your garden.");
  garden.examples.push({ id: `note-${Date.now()}-${Math.random().toString(36).slice(2)}`, text, label });
  notifyChange(`Added to ${label}. Your AI has learned something new.`);
}

function removeCategory(label) {
  if (garden.labels.length === 1) return toast("Keep at least one category in your garden.");
  const count = garden.examples.filter((item) => item.label === label).length;
  if (count && !confirm(`Remove ${label} and its ${count} training ${count === 1 ? "example" : "examples"}?`)) return;
  garden.labels = garden.labels.filter((item) => item !== label);
  garden.examples = garden.examples.filter((item) => item.label !== label);
  notifyChange(`${label} category removed.`);
}

refs.thought.addEventListener("input", renderPrediction);
refs.teachButton.addEventListener("click", () => { addExample(refs.thought.value, refs.teachLabel.value); });
refs.exampleButton.addEventListener("click", () => {
  const previousCount = garden.examples.length;
  addExample(refs.exampleInput.value, refs.exampleLabel.value);
  if (garden.examples.length > previousCount) refs.exampleInput.value = "";
});
refs.categoryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = refs.categoryInput.value.trim();
  if (!name) return toast("Give your category a name.");
  if (garden.labels.some((label) => label.toLowerCase() === name.toLowerCase())) return toast("That category already exists.");
  if (garden.labels.length >= 12) return toast("You can have up to 12 categories.");
  garden.labels.push(name);
  refs.categoryInput.value = "";
  notifyChange(`${name} category added.`);
  refs.exampleLabel.value = name;
  refs.teachLabel.value = name;
});
refs.exportButton.addEventListener("click", () => {
  const file = new Blob([JSON.stringify({ version: 1, ...garden }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(file);
  const link = make("a"); link.href = url; link.download = "signalgarden-export.json";
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Your garden was exported as JSON.");
});
refs.importButton.addEventListener("click", () => refs.importFile.click());
refs.importFile.addEventListener("change", async () => {
  const file = refs.importFile.files?.[0];
  refs.importFile.value = "";
  if (!file) return;
  if (file.size > 1_000_000) return toast("That file is too large (1 MB maximum).");
  try {
    const incoming = validateGarden(JSON.parse(await file.text()));
    if (!confirm(`Replace this garden with ${incoming.examples.length} imported examples?`)) return;
    garden = incoming; filter = ALL_FILTER;
    notifyChange("Garden imported. Your model has been retrained.");
  } catch (error) { toast(error.message || "Could not import that file."); }
});
refs.resetButton.addEventListener("click", () => {
  if (!confirm("Reset your garden to the sample categories and examples? Export your current garden first if you want to keep it.")) return;
  garden = copyStarters(); filter = ALL_FILTER;
  notifyChange("The sample garden is back.");
});

renderAll();
