// A small, local text classifier. Nothing is sent to a server.
const WORDS = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;
// These frequent words say little about a note's topic. Keep tokenize() useful
// to callers by removing them only when the model learns or scores a note.
const STOPWORDS = new Set([
  "a", "about", "after", "again", "all", "am", "an", "and", "any", "are", "as", "at",
  "be", "been", "before", "being", "but", "by", "can", "could", "did", "do", "does",
  "for", "from", "had", "has", "have", "he", "her", "here", "hers", "him", "his",
  "how", "i", "if", "in", "into", "is", "it", "its", "me", "my", "of", "on", "or",
  "our", "ours", "she", "so", "some", "than", "that", "the", "their", "them", "there",
  "these", "they", "this", "those", "to", "too", "us", "was", "we", "were", "what",
  "when", "where", "which", "who", "why", "will", "with", "would", "you", "your",
  "yours",
]);

export function tokenize(text) {
  return String(text ?? "").normalize("NFKC").toLowerCase().match(WORDS) ?? [];
}

const alphabetical = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Train a multinomial Naive Bayes classifier from labeled notes.
 * Identical normalized notes with the same label count only once, even if
 * they have different IDs. A note assigned to two labels is kept in both.
 */
export function train(examples) {
  const documents = new Map();
  const words = new Set();
  const seen = new Set();

  for (const example of Array.isArray(examples) ? examples : []) {
    const label = typeof example?.label === "string" ? example.label.trim() : "";
    const rawTokens = tokenize(example?.text);
    if (!label || !rawTokens.length) continue;

    const key = JSON.stringify([label, rawTokens]);
    if (seen.has(key)) continue;
    seen.add(key);
    const tokens = rawTokens.filter((token) => !STOPWORDS.has(token));

    if (!documents.has(label)) {
      documents.set(label, { documentCount: 0, tokenCount: 0, counts: new Map() });
    }
    const stats = documents.get(label);
    stats.documentCount += 1;
    for (const token of tokens) {
      stats.tokenCount += 1;
      stats.counts.set(token, (stats.counts.get(token) ?? 0) + 1);
      words.add(token);
    }
  }

  const labels = [...documents.keys()].sort(alphabetical);
  const vocabulary = [...words].sort(alphabetical);
  const vocabularySet = new Set(vocabulary);
  const totalDocuments = [...documents.values()].reduce(
    (sum, stats) => sum + stats.documentCount,
    0,
  );

  function logLikelihood(token, label) {
    const stats = documents.get(label);
    return Math.log((stats.counts.get(token) ?? 0) + 1) -
      Math.log(stats.tokenCount + vocabulary.length);
  }

  function countTokens(text) {
    const counts = new Map();
    for (const token of tokenize(text)) {
      if (STOPWORDS.has(token)) continue;
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
    return counts;
  }

  function scores(counts) {
    return labels.map((label) => {
      const stats = documents.get(label);
      // Add-one smoothing keeps a category usable with only one example.
      let logScore = Math.log((stats.documentCount + 1) / (totalDocuments + labels.length));
      for (const [token, count] of counts) {
        if (vocabularySet.has(token)) logScore += count * logLikelihood(token, label);
      }
      return { label, logScore };
    });
  }

  function predict(text) {
    if (!labels.length) return [];
    const raw = scores(countTokens(text));
    const maximum = Math.max(...raw.map(({ logScore }) => logScore));
    const weights = raw.map(({ logScore }) => Math.exp(logScore - maximum));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    return raw.map(({ label }, index) => ({
      label,
      probability: weights[index] / totalWeight,
    })).sort((a, b) => b.probability - a.probability || alphabetical(a.label, b.label));
  }

  function explain(text, label) {
    if (!documents.has(label)) return [];
    const counts = countTokens(text);
    const rival = scores(counts)
      .filter((item) => item.label !== label)
      .sort((a, b) => b.logScore - a.logScore || alphabetical(a.label, b.label))[0];

    return [...counts].map(([token, count]) => {
      const score = !rival || !vocabularySet.has(token)
        ? 0
        : count * (logLikelihood(token, label) - logLikelihood(token, rival.label));
      return { token, score };
    }).sort((a, b) => b.score - a.score || alphabetical(a.token, b.token));
  }

  return { labels, vocabulary, predict, explain };
}
