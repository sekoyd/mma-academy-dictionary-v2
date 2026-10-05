const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const state = {
  records: [],
  query: "",
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
  toolbar: $("#dict-toolbar"),
  termOfWeek: $("#term-of-week"),
};

// "Featured Week" holds "2026-W39 | why this week"; the newest week is featured on the home page.
const parseWeek = (value) => {
  const [week, ...hook] = String(value || "").split(" | ");
  return week ? { week, hook: hook.join(" | ") } : null;
};

const slugify = (value) => value
  .replace(/[İı]/g, "i")
  .toLowerCase()
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
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
  const seen = new Map();

  return rows.slice(1).map((row, index) => {
    const record = Object.fromEntries(headers.map((header, column) => [header, row[column] ?? ""]));
    const occurrence = (seen.get(record.Term) ?? 0) + 1;
    seen.set(record.Term, occurrence);
    record.id = `${slugify(record.Term)}${occurrence > 1 ? `-${occurrence}` : ""}`;
    record.sourceIndex = index + 1;
    record.definition = record["Short Definition"] || record["Source Definition / Long Explanation"];
    record.isMissing = !record.definition;
    record.category = record["Tags / Taxonomy"] || DEFAULT_CATEGORY;
    record.featured = parseWeek(record["Featured Week"]);
    record.searchText = Object.values(record).join(" ").toLowerCase();
    return record;
  }).sort((a, b) => a.Letter.localeCompare(b.Letter) || a.Term.localeCompare(b.Term, "en", { sensitivity: "base" }));
};

const matchesQuery = (record) => {
  const query = state.query.trim().toLowerCase();
  return !query || record.searchText.includes(query);
};

const getFilteredRecords = () => state.records.filter((record) => matchesQuery(record)
  && (state.category === "all" || record.category === state.category));

function renderCategories() {
  const counts = new Map(CATEGORY_ORDER.map((name) => [name, 0]));
  let total = 0;
  state.records.filter(matchesQuery).forEach((record) => {
    counts.set(record.category, (counts.get(record.category) ?? 0) + 1);
    total += 1;
  });
  elements.categories.replaceChildren();
  [["all", "All", total], ...[...counts].map(([name, count]) => [name, name, count])]
    .forEach(([value, label, count]) => {
      const button = addText(elements.categories, "button", label, "category-tab");
      addText(button, "small", String(count));
      button.type = "button";
      button.dataset.category = value;
      button.setAttribute("aria-pressed", String(state.category === value));
      button.classList.toggle("is-active", state.category === value);
      button.addEventListener("click", () => {
        state.category = value;
        render();
        document.querySelector("#dictionary").scrollIntoView({ block: "start" });
      });
    });
  elements.categoryKicker.textContent = state.category === "all" ? "All categories" : state.category;
}

function renderAlphabet(records) {
  const active = new Set(records.map((record) => record.Letter));
  elements.alphabet.replaceChildren();
  alphabet.forEach((letter) => {
    const button = addText(elements.alphabet, "button", letter, "letter-button");
    button.type = "button";
    button.disabled = !active.has(letter);
    button.dataset.letter = letter;
    button.setAttribute("aria-label", `Jump to terms starting with ${letter}`);
    button.addEventListener("click", () => {
      document.getElementById(`letter-${letter}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function previewText(record) {
  if (record.isMissing) return "Definition coming soon.";
  const clean = record.definition.replace(/\s+/g, " ").trim();
  return clean.length > 180 ? `${clean.slice(0, 177)}…` : clean;
}

function renderTerms(records) {
  elements.groups.replaceChildren();
  elements.empty.hidden = records.length > 0;
  elements.resultStatus.replaceChildren();
  addText(elements.resultStatus, "strong", String(records.length));
  elements.resultStatus.append(records.length === 1 ? " term" : " terms");

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
    section.dataset.letter = letter;
    section.setAttribute("aria-labelledby", `letter-heading-${letter}`);
    addText(section, "h3", letter, "group-letter").id = `letter-heading-${letter}`;

    const list = document.createElement("div");
    list.className = "group-terms";
    items.forEach((record) => {
      const button = document.createElement("a");
      button.href = `term/${record.id}/`;
      button.className = "term-row";
      button.dataset.entry = record.id;
      button.setAttribute("aria-label", `Open ${record.Term}`);
      addText(button, "span", record.Term, "term-name");
      addText(button, "p", previewText(record), `term-preview${record.isMissing ? " is-missing" : ""}`);
      const tail = document.createElement("span");
      tail.className = "term-tail";
      addText(tail, "span", "↗", "term-arrow").setAttribute("aria-hidden", "true");
      button.append(tail);
      button.addEventListener("click", (event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey) return;
        event.preventDefault();
        openEntry(record);
      });
      list.append(button);
    });
    section.append(list);
    elements.groups.append(section);
  }
  observeLetters();
}

function render() {
  const records = getFilteredRecords();
  renderCategories();
  renderAlphabet(records);
  renderTerms(records);
}

// Highlight the letter whose group is currently under the sticky toolbar.
let letterObserver;
function observeLetters() {
  letterObserver?.disconnect();
  const offset = elements.toolbar.getBoundingClientRect().height + 90;
  letterObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const letter = entry.target.dataset.letter;
      elements.alphabet.querySelectorAll(".letter-button").forEach((button) => {
        const isCurrent = button.dataset.letter === letter;
        button.classList.toggle("is-current", isCurrent);
        if (isCurrent && elements.alphabet.scrollWidth > elements.alphabet.clientWidth) {
          const strip = elements.alphabet;
          strip.scrollLeft = button.offsetLeft - strip.clientWidth / 2 + button.clientWidth / 2;
        }
      });
    });
  }, { rootMargin: `-${offset}px 0px -70% 0px` });
  elements.groups.querySelectorAll(".letter-group").forEach((section) => letterObserver.observe(section));
}

function syncToolbarHeight() {
  document.documentElement.style.setProperty("--toolbar-height", `${elements.toolbar.getBoundingClientRect().height}px`);
}

function renderTermOfWeek() {
  const picks = state.records.filter((record) => record.featured)
    .sort((a, b) => b.featured.week.localeCompare(a.featured.week));
  const section = elements.termOfWeek;
  if (!picks.length) { section.hidden = true; return; }
  const [current, ...previous] = picks;
  section.replaceChildren();
  const inner = document.createElement("div");
  inner.className = "tow-inner";
  addText(inner, "p", `Term of the week · ${current.featured.week}`, "eyebrow");
  const title = document.createElement("h2");
  title.id = "tow-title";
  const link = addText(title, "a", current.Term);
  link.href = `term/${current.id}/`;
  link.addEventListener("click", (event) => { event.preventDefault(); openEntry(current); });
  inner.append(title);
  addText(inner, "p", current.definition, "tow-definition");
  if (current.featured.hook) addText(inner, "p", current.featured.hook, "tow-hook");
  if (previous.length) {
    const past = document.createElement("p");
    past.className = "tow-past";
    past.append("Previous: ");
    previous.slice(0, 4).forEach((record, index) => {
      if (index) past.append(" · ");
      const a = addText(past, "a", record.Term);
      a.href = `term/${record.id}/`;
    });
    inner.append(past);
  }
  section.append(inner);
  section.hidden = false;
}

function detailBlock(label, value) {
  if (!value) return null;
  const block = document.createElement("div");
  block.className = "detail-block";
  addText(block, "h3", label);
  addText(block, "p", value);
  return block;
}

function relatedBlock(record) {
  const value = record["Synonyms / Related Terms"];
  if (!value) return null;
  const block = document.createElement("div");
  block.className = "detail-block";
  addText(block, "h3", "Related terms");
  const paragraph = addText(block, "p", "");
  String(value).split(",").map((name) => name.trim()).filter(Boolean).forEach((name, index) => {
    if (index) paragraph.append(", ");
    const target = state.termIndex.get(slugify(name));
    if (!target || target === record) {
      paragraph.append(name);
      return;
    }
    const link = addText(paragraph, "a", name);
    link.href = `#${target.id}`;
    link.addEventListener("click", (event) => {
      event.preventDefault();
      openEntry(target);
    });
  });
  return block;
}

function openEntry(record, updateHash = true) {
  $("#dialog-index").textContent = `Entry ${String(record.sourceIndex).padStart(3, "0")} / ${state.records.length}`;
  $("#dialog-letter").textContent = record.Letter;
  $("#dialog-term").textContent = record.Term;
  const definition = $("#dialog-definition");
  definition.textContent = record.definition || "Definition coming soon.";
  definition.classList.toggle("is-missing", record.isMissing);

  const flags = $("#dialog-flags");
  flags.replaceChildren();
  addText(flags, "span", record.category, "term-chip");
  if (record.featured) addText(flags, "span", `Term of the week · ${record.featured.week}`, "term-chip review");

  const details = $("#dialog-details");
  details.replaceChildren();
  [
    ["Why this week", record.featured?.hook],
    ["Current status", record["Current Status"]],
    ["Explanation", record["Short Definition"] && record["Source Definition / Long Explanation"]],
    ["Usage context / examples", record["Usage Context / Examples"]],
    ["MMA connection", record["MMA Connection"]],
    ["Related terms", record],
    ["Turkish equivalent", record["TR Equivalent"]],
    ["Turkish definition", record["TR Definition"]],
  ].forEach(([label, value]) => {
    const block = label === "Related terms" ? relatedBlock(value) : detailBlock(label, value);
    if (block) details.append(block);
  });
  details.hidden = details.childElementCount === 0;
  $("#dialog-source").textContent = `Source: ${record["Source Document"] || "Master glossary"}`;
  if (!elements.dialog.open) elements.dialog.showModal();
  elements.dialog.scrollTop = 0;
  if (updateHash) history.replaceState(null, "", `#${record.id}`);
}

function closeDialog() {
  elements.dialog.close();
  if (location.hash) history.replaceState(null, "", `${location.pathname}${location.search}`);
}

function resetFilters() {
  state.query = "";
  state.category = "all";
  elements.search.value = "";
  render();
}

async function init() {
  const response = await fetch("data/glossary-source.json?v=15");
  if (!response.ok) throw new Error(`Glossary source failed: ${response.status}`);
  state.records = normalizeRecords(await response.json());
  state.termIndex = new Map();
  state.records.forEach((record) => {
    [record.Term, record.Term.split(" (")[0]].forEach((name) => {
      if (!state.termIndex.has(slugify(name))) state.termIndex.set(slugify(name), record);
    });
  });

  const sources = new Set(state.records.flatMap((record) => String(record["Source Link"] || "").split(/\s+/).filter(Boolean)));
  $("#stat-terms").textContent = state.records.length;
  $("#stat-categories").textContent = new Set(state.records.map((record) => record.category)).size;
  $("#stat-sources").textContent = sources.size;

  renderTermOfWeek();
  syncToolbarHeight();
  new ResizeObserver(syncToolbarHeight).observe(elements.toolbar);
  render();

  const hashRecord = state.records.find((record) => `#${record.id}` === location.hash);
  if (hashRecord) openEntry(hashRecord, false);
}

elements.search.addEventListener("input", (event) => {
  state.query = event.target.value;
  render();
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
  const record = state.records.find((item) => `#${item.id}` === location.hash);
  await navigator.clipboard.writeText(record ? new URL(`term/${record.id}/`, location.href).href : location.href);
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
  elements.resultStatus.textContent = "The glossary could not be loaded.";
});
