import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { test } from "node:test";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const src = html.match(/src="(assets\/geriatrics[^"?]*\.js)"/)?.[1];
const source = await readFile(new URL(`../${src}`, import.meta.url), "utf8");
const appSrc = html.match(/src="(assets\/app-[^"?]+\.js)"/)?.[1];
const appSource = await readFile(new URL(`../${appSrc}`, import.meta.url), "utf8");
const elements = new Map();
const el = id => {
  if (!elements.has(id)) elements.set(id, { value: "", textContent: "", dataset: {}, disabled: false,
    closest: () => el("result-box") });
  return elements.get(id);
};
const document = { getElementById: el, querySelector: selector => el(selector), querySelectorAll: () => [] };
const context = vm.createContext({ document, Intl, console });
vm.runInContext(source + "\n;globalThis.g = Geriatrics;", context);
vm.runInContext(appSource.slice(0, appSource.indexOf("    const calculators = {")) + "\n;globalThis.helpers = {parseNumber, setResult, setError, clearResult, state};", context);
const { g, helpers } = context;
const validMna = (extra = {}) => ({ age: "75", A: "2", B: "3", C: "2", D: "2", E: "2", mode: "bmi", bmi: "23", calf: "", ...extra });
const scoreMna = data => g.scoreMna(data, helpers.parseNumber);
const barthelMax = [10, 5, 5, 10, 10, 10, 10, 15, 15, 10].map(String);

test("Бартел: 10 независимых пунктов, диапазон 0–100, максимумы по оригиналу", () => {
  assert.equal(g.barthelItems.length, 10);
  assert.equal(g.scoreBarthel(Array(10).fill("0")).score, 0);
  assert.equal(g.scoreBarthel(barthelMax).score, 100);
  for (let i = 0; i < 10; i++) {
    const allowed = i === 1 || i === 2 ? [0, 5] : i === 7 || i === 8 ? [0, 5, 10, 15] : [0, 5, 10];
    assert.deepEqual(Array.from(g.barthelItems[i][1], o => o[0]), allowed);
    for (const value of allowed) {
      const values = Array(10).fill("0"); values[i] = String(value);
      assert.equal(g.scoreBarthel(values).score, value);
    }
  }
});

test("Бартел: пропуск, постороннее значение и неверное число пунктов блокируются", () => {
  for (let i = 0; i < 10; i++) for (const value of ["", " ", "-1", "1", "3", "20", "5x", "NaN"]) {
    const values = [...barthelMax]; values[i] = value;
    assert.ok(g.scoreBarthel(values).error);
  }
  for (const values of [null, [], barthelMax.slice(1), [...barthelMax, "0"]]) assert.ok(g.scoreBarthel(values).error);
});

test("Бартел: все достижимые категории и граничные суммы", () => {
  for (const [score, expected] of [[0, "Полная"], [20, "Полная"], [25, "Выраженная"], [60, "Выраженная"], [65, "Умеренная"], [90, "Умеренная"], [95, "Небольшая"], [100, "Независимость"]]) {
    assert.ok(g.barthelCategory(score)[0].startsWith(expected));
  }
});

test("MNA-SF: точные пороги ИМТ без предварительного округления", () => {
  for (const [bmi, expected] of [[18.9999, 0], [19, 1], [20.9999, 1], [21, 2], [22.9999, 2], [23, 3]]) {
    const result = scoreMna(validMna({ bmi: String(bmi) }));
    assert.equal(result.f, expected, String(bmi));
    assert.equal(result.score, 11 + expected);
  }
  assert.equal(scoreMna(validMna({ bmi: "22,5" })).score, 13);
});

test("MNA-SF: голень 31 см и исключение неактивного F, без двойного счёта", () => {
  for (const [calf, expected] of [["30,9999", 0], ["31", 3], ["34", 3]]) {
    const result = scoreMna(validMna({ mode: "calf", calf, bmi: "INVALID" }));
    assert.equal(result.f, expected);
    assert.equal(result.score, 11 + expected);
    assert.match(result.breakdown, /F2/);
    assert.doesNotMatch(result.breakdown, /F1/);
  }
  const bmi = scoreMna(validMna({ calf: "INVALID" }));
  assert.equal(bmi.score, 14);
  assert.match(bmi.breakdown, /F1/);
  assert.doesNotMatch(bmi.breakdown, /F2/);
});

test("MNA-SF: диапазон 0–14 и категории 7/8/11/12", () => {
  assert.equal(scoreMna(validMna({ A: "0", B: "0", C: "0", D: "0", E: "0", bmi: "18" })).score, 0);
  for (const [data, score, category] of [
    [{ A: "0", B: "1", bmi: "18" }, 7, "Недостаточность"],
    [{ A: "0", B: "2", bmi: "18" }, 8, "Риск"],
    [{ bmi: "18" }, 11, "Риск"],
    [{ bmi: "19" }, 12, "Нормальный"],
    [{}, 14, "Нормальный"]
  ]) {
    const result = scoreMna(validMna(data));
    assert.equal(result.score, score);
    assert.ok(result.interpretation.startsWith(category));
  }
});

test("MNA-SF: все допустимые баллы A–E; в D нет значения 1", () => {
  const allowed = { A: [0, 1, 2], B: [0, 1, 2, 3], C: [0, 1, 2], D: [0, 2], E: [0, 1, 2] };
  for (const [key, values] of Object.entries(allowed)) {
    assert.deepEqual(Array.from(g.mnaPoints[key]), values);
    for (const v of values) assert.equal(scoreMna(validMna({ [key]: String(v) })).score, 14 - Number(validMna()[key]) + v);
    for (const value of ["", " ", "-1", "4", "0.5", "1x"]) assert.ok(scoreMna(validMna({ [key]: value })).error);
  }
  assert.ok(scoreMna(validMna({ D: "1" })).error);
});

test("MNA-SF: возраст, метод и числа валидируются до расчёта", () => {
  for (const age of ["", "64", "75.5", "121", "abc"]) assert.ok(scoreMna(validMna({ age })).error);
  for (const age of ["65", "120"]) assert.equal(scoreMna(validMna({ age })).score, 14);
  for (const bad of ["", "0", "-1", "101", "NaN", "1e2", "Infinity"]) {
    assert.ok(scoreMna(validMna({ bmi: bad })).error);
    assert.ok(scoreMna(validMna({ mode: "calf", calf: bad })).error);
  }
  for (const mode of ["", "both", "other"]) assert.ok(scoreMna(validMna({ mode })).error);
});

test("обе шкалы интегрированы с результатом, копированием и отказом при ошибке", () => {
  barthelMax.forEach((v, i) => { el(`barthel${i + 1}`).value = v; });
  assert.equal(g.calculateBarthel(helpers), true);
  assert.equal(el("barthelResult").textContent, "100");
  assert.match(helpers.state.results.barthel, /100\/100/);
  el("barthel1").value = "";
  assert.equal(g.calculateBarthel(helpers), false);
  assert.equal(helpers.state.results.barthel, null);
  for (const [key, value] of Object.entries(validMna())) el("mna" + key[0].toUpperCase() + key.slice(1)).value = value;
  assert.equal(g.calculateMna(helpers), true);
  assert.equal(el("mnaResult").textContent, "14");
  assert.match(helpers.state.results.mna, /14\/14/);
  assert.match(helpers.state.results.mna, /F1/);
  el("mnaD").value = "1";
  assert.equal(g.calculateMna(helpers), false);
  assert.equal(helpers.state.results.mna, null);
  assert.equal(el('[data-copy="mna"]').disabled, true);
});

test("карточки: уникальные ID, подписи полей, пустые ответы и клинические заметки", () => {
  const cards = g.markup();
  const ids = [...(html + cards).matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal((cards.match(/class="calculator"/g) || []).length, 2);
  for (const [, id] of cards.matchAll(/<(?:select|input)\b[^>]*id="([^"]+)"/g)) assert.ok(cards.includes(`for="${id}"`), id);
  assert.equal((cards.match(/selected disabled>Выберите балл/g) || []).length, 15);
  for (const key of ["barthel", "mna"]) {
    assert.match(cards, new RegExp(`id="${key}Note"`));
    assert.match(cards, new RegExp(`data-copy="${key}" disabled`));
    assert.ok(appSource.includes(`clearResult("${key}",`));
  }
  assert.match(cards, /id="mnaCalfPanel" hidden/);
  assert.match(cards, /id="mnaCalf"[^>]+disabled/);
  assert.ok(html.indexOf(src) < html.indexOf(appSrc));
  assert.match(source, /addEventListener\("reset",/);
  assert.match(source, /data-nav-group="geriatrics"/);
  assert.match(source, /href="#group-geriatrics"/);
});
