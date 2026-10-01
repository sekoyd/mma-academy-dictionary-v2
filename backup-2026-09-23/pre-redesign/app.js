const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const state = {
  records: [],
  query: "",
  letter: null,
  status: "all",
  category: "all",
};

const DEFAULT_CATEGORY = "Retail Media";
const CATEGORY_ORDER = ["AI & Marketing Concepts", "Consumer & Culture Trends", "Leadership & Organization", "Technology Trends", "MMA Programs & Frameworks", "Digital Marketing Acronyms", DEFAULT_CATEGORY];

const $ = (selector) => document.querySelector(selector);
const elements = {
  alphabet: $("#alphabet"),
  search: $("#search-input"),
  groups: $("#term-groups"),
  categories: $("#category-filters"),
  categoryKicker: $("#category-kicker"),
  resultStatus: $("#result-status"),
  empty: $("#empty-state"),
  dialog: $("#term-dialog"),
};

const slugify = (value) => value
  .toLowerCase()
  .normalize("NFKD")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");

const addText = (parent, tag, text, className) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = text;
  parent.append(node);
  return node;
};

const normalizeRecords = (rows) => {
  const headers = rows[0];
  const termCounts = new Map();
  rows.slice(1).forEach((row) => {
    const term = row[0] ?? "";
    termCounts.set(term, (termCounts.get(term) ?? 0) + 1);
  });
  const seen = new Map();

  return rows.slice(1).map((row, index) => {
    const record = Object.fromEntries(headers.map((header, column) => [header, row[column] ?? ""]));
    const occurrence = (seen.get(record.Term) ?? 0) + 1;
    seen.set(record.Term, occurrence);
    record.id = `${slugify(record.Term)}${occurrence > 1 ? `-${occurrence}` : ""}`;
    record.sourceIndex = index + 1;
    record.definition = record["Short Definition"] || record["Source Definition / Long Explanation"];
    record.isMissing = !record.definition;
    record.isDuplicate = termCounts.get(record.Term) > 1;
    record.category = record["Tags / Taxonomy"] || DEFAULT_CATEGORY;
    record.searchText = Object.values(record).join(" ").toLowerCase();
    return record;
  }).sort((a, b) => a.Letter.localeCompare(b.Letter) || a.Term.localeCompare(b.Term, "en", { sensitivity: "base" }));
};

function renderAlphabet() {
  const active = new Set(state.records.map((record) => record.Letter));
  elements.alphabet.replaceChildren();
  alphabet.forEach((letter) => {
    const button = addText(elements.alphabet, "button", letter, "letter-button");
    button.type = "button";
    button.disabled = !active.has(letter);
    button.dataset.letter = letter;
    button.setAttribute("aria-label", `Show terms beginning with ${letter}`);
    if (state.letter === letter) button.classList.add("is-active");
    button.addEventListener("click", () => {
      state.letter = state.letter === letter ? null : letter;
      renderAlphabet();
      renderTerms();
    });
  });
}

function renderCategories() {
  const counts = new Map();
  state.records.forEach((record) => counts.set(record.category, (counts.get(record.category) ?? 0) + 1));
  elements.categories.replaceChildren();
  [["all", "All", state.records.length], ...[...counts].sort(([a], [b]) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b)).map(([name, count]) => [name, name, count])]
    .forEach(([value, label, count]) => {
      const button = addText(elements.categories, "button", `${label} · ${count}`, "filter-pill");
      button.type = "button";
      button.dataset.category = value;
      button.classList.toggle("is-active", state.category === value);
      button.addEventListener("click", () => {
        state.category = value;
        renderCategories();
        renderTerms();
      });
    });
  elements.categoryKicker.textContent = state.category === "all" ? "All categories" : state.category;
}

function getFilteredRecords() {
  const query = state.query.trim().toLowerCase();
  return state.records.filter((record) => {
    const matchesQuery = !query || record.searchText.includes(query);
    const matchesLetter = !state.letter || record.Letter === state.letter;
    const matchesCategory = state.category === "all" || record.category === state.category;
    const matchesStatus = state.status === "all"
      || (state.status === "defined" && !record.isMissing)
      || (state.status === "review" && (record.isMissing || record.Notes));
    return matchesQuery && matchesLetter && matchesStatus && matchesCategory;
  });
}

function previewText(record) {
  if (record.isMissing) return "Definition not provided in the master glossary.";
  const clean = record.definition.replace(/\s+/g, " ").trim();
  return clean.length > 180 ? `${clean.slice(0, 177)}…` : clean;
}

function renderTerms() {
  const records = getFilteredRecords();
  elements.groups.replaceChildren();
  elements.empty.hidden = records.length > 0;
  elements.resultStatus.textContent = `${records.length} of ${state.records.length} source records shown`;

  const grouped = new Map();
  records.forEach((record) => {
    const letter = record.Letter || "#";
    if (!grouped.has(letter)) grouped.set(letter, []);
    grouped.get(letter).push(record);
  });
  for (const [letter, items] of grouped) {
    const section = document.createElement("section");
    section.className = "letter-group";
    section.id = `letter-${letter}`;
    section.setAttribute("aria-labelledby", `letter-heading-${letter}`);
    addText(section, "h3", letter, "group-letter").id = `letter-heading-${letter}`;

    const list = document.createElement("div");
    list.className = "group-terms";
    items.forEach((record) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "term-row";
      button.dataset.entry = record.id;
      button.setAttribute("aria-label", `Open ${record.Term}`);
      addText(button, "span", record.Term, "term-name");
      addText(button, "p", previewText(record), `term-preview${record.isMissing ? " is-missing" : ""}`);

      const tail = document.createElement("span");
      tail.className = "term-tail";
      if (record.isMissing || record.Notes) {
        addText(tail, "span", "Review", "term-chip review");
      } else if (record.isDuplicate) {
        addText(tail, "span", "Duplicate", "term-chip");
      }
      addText(tail, "span", "↗", "term-arrow").setAttribute("aria-hidden", "true");
      button.append(tail);
      button.addEventListener("click", () => openEntry(record));
      list.append(button);
    });
    section.append(list);
    elements.groups.append(section);
  }
}

function detailBlock(label, value) {
  if (!value) return null;
  const block = document.createElement("div");
  block.className = "detail-block";
  addText(block, "h3", label);
  addText(block, "p", value);
  return block;
}

function openEntry(record, updateHash = true) {
  $("#dialog-index").textContent = `Entry ${String(record.sourceIndex).padStart(3, "0")} / ${state.records.length}`;
  $("#dialog-letter").textContent = record.Letter;
  $("#dialog-term").textContent = record.Term;
  const definition = $("#dialog-definition");
  definition.textContent = record.definition || "Definition not provided in the master glossary.";
  definition.classList.toggle("is-missing", record.isMissing);

  const flags = $("#dialog-flags");
  flags.replaceChildren();
  addText(flags, "span", record.category, "term-chip");
  if (record.isDuplicate) addText(flags, "span", "Duplicate source term", "term-chip");
  if (record.isMissing || record.Notes) addText(flags, "span", "Editorial review", "term-chip review");

  const details = $("#dialog-details");
  details.replaceChildren();
  [
    ["Explanation", record["Short Definition"] && record["Source Definition / Long Explanation"]],
    ["Usage context / examples", record["Usage Context / Examples"]],
    ["Related terms", record["Synonyms / Related Terms"]],
    ["Turkish equivalent", record["TR Equivalent"]],
    ["Turkish definition", record["TR Definition"]],
    ["Editorial note", record.Notes],
  ].forEach(([label, value]) => {
    const block = detailBlock(label, value);
    if (block) details.append(block);
  });
  details.hidden = details.childElementCount === 0;
  $("#dialog-source").textContent = `Source: ${record["Source Document"] || "Master glossary"}`;
  elements.dialog.showModal();
  if (updateHash) history.replaceState(null, "", `#${record.id}`);
}

function closeDialog() {
  elements.dialog.close();
  if (location.hash) history.replaceState(null, "", `${location.pathname}${location.search}`);
}

function resetFilters() {
  state.query = "";
  state.letter = null;
  state.status = "all";
  state.category = "all";
  elements.search.value = "";
  document.querySelectorAll(".filter-pill[data-status]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.status === "all");
  });
  renderCategories();
  renderAlphabet();
  renderTerms();
}

async function init() {
  const response = await fetch("data/glossary-source.json?v=9");
  if (!response.ok) throw new Error(`Glossary source failed: ${response.status}`);
  state.records = normalizeRecords(await response.json());

  const activeLetters = new Set(state.records.map((record) => record.Letter));
  $("#stat-terms").textContent = state.records.length;
  $("#stat-letters").textContent = activeLetters.size;
  $("#stat-categories").textContent = new Set(state.records.map((record) => record.category)).size;

  renderCategories();
  renderAlphabet();
  renderTerms();

  const hashRecord = state.records.find((record) => `#${record.id}` === location.hash);
  if (hashRecord) openEntry(hashRecord, false);
}

elements.search.addEventListener("input", (event) => {
  state.query = event.target.value;
  renderTerms();
});

document.querySelectorAll(".filter-pill[data-status]").forEach((button) => {
  button.addEventListener("click", () => {
    state.status = button.dataset.status;
    document.querySelectorAll(".filter-pill[data-status]").forEach((item) => item.classList.toggle("is-active", item === button));
    renderTerms();
  });
});

$("#reset-search").addEventListener("click", resetFilters);
$("#dialog-close").addEventListener("click", closeDialog);
elements.dialog.addEventListener("click", (event) => {
  if (event.target === elements.dialog) closeDialog();
});
elements.dialog.addEventListener("close", () => {
  if (location.hash) history.replaceState(null, "", `${location.pathname}${location.search}`);
});

$("#copy-link").addEventListener("click", async () => {
  await navigator.clipboard.writeText(location.href);
  $("#copy-link").textContent = "Link copied";
  setTimeout(() => { $("#copy-link").textContent = "Copy entry link"; }, 1400);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && document.activeElement !== elements.search) {
    event.preventDefault();
    elements.search.focus();
  }
});

init().catch((error) => {
  console.error(error);
  elements.resultStatus.textContent = "The source glossary could not be loaded.";
});
