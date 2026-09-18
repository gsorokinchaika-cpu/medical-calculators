import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const htmlPath = fileURLToPath(new URL("../index.html", import.meta.url));
const html = await readFile(htmlPath, "utf8");
const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
const appTag = scripts.at(-1);
const appSrc = appTag?.[1].match(/\bsrc="([^"]+)"/)?.[1];
const appScript = appSrc
  ? await readFile(new URL(`../${appSrc}`, import.meta.url), "utf8")
  : appTag?.[2] || "";
const definitions = appScript.slice(0, appScript.indexOf("    const calculators = {"));

assert.ok(definitions.length > 70_000, "Не удалось извлечь определения приложения");

class FakeElement {
  constructor(id = "") {
    this.id = id;
    this.value = "";
    this.checked = false;
    this.textContent = "";
    this.className = "";
    this.disabled = false;
    this.hidden = false;
    this.dataset = {};
  }
}

const elements = new Map();
const namedInputs = new Map();
const getElement = (id) => {
  if (!elements.has(id)) elements.set(id, new FakeElement(id));
  return elements.get(id);
};

const document = {
  getElementById: getElement,
  querySelector(selector) {
    const nameMatch = selector.match(/^input\[name="([^"]+)"\]:checked$/);
    if (nameMatch) return (namedInputs.get(nameMatch[1]) || []).find((item) => item.checked) || null;
    const copyMatch = selector.match(/^\[data-copy="([^"]+)"\]$/);
    if (copyMatch) return getElement(`copy-${copyMatch[1]}`);
    return null;
  },
  querySelectorAll(selector) {
    if (selector === "#mmseForm .mmse-point") {
      return Array.from({ length: 30 }, (_, index) => getElement(`mmsePoint-${index}`));
    }
    if (selector === "#qtcMetrics strong") {
      return [0, 1, 2, 3].map((index) => getElement(`qtcMetric-${index}`));
    }
    return [];
  }
};

const context = vm.createContext({ document, Intl, Math, Number, String, console });
vm.runInContext(`${definitions}\n;globalThis.__app = {
  state, parseNumber, calculatePrecisedapt, calculateDlcn, calculatePhq9,
  calculateGad7, calculateStopbang, egfrCategory, calculateFrax,
  calculateGrace, calculatePneumonia, calculateScore2, calculateElectrolytes,
  calculateAdapt, calculatePrevent, calculateBmi, calculateEgfr,
  calculateMentzer, calculateTsat, calculateMmse, calculateFib4,
  calculateMaf5, calculateLiverpro, calculateEpworth, calculateAfstroke,
  calculateVte, calculateSorethroat, calculateQtc, calculateHasbled,
  calculateCadptp, calculateEgfrcys, score2Category, SCORE2_COUNTRIES
};`, context, { filename: "medical-calculators-definitions.js" });

const app = context.__app;
const setValues = (values) => {
  for (const [id, value] of Object.entries(values)) getElement(id).value = String(value);
};
const setRadio = (name, value) => {
  const element = new FakeElement(`${name}-${value}`);
  element.value = String(value);
  element.checked = true;
  namedInputs.set(name, [element]);
};
const setChecked = (ids, checked = true) => {
  for (const id of ids) getElement(id).checked = checked;
};
const resultNumber = (key) => Number(getElement(`${key}Result`).textContent.replace(",", "."));

test("строгий разбор локализованных чисел", () => {
  assert.equal(app.parseNumber("−2,1"), -2.1);
  assert.equal(app.parseNumber(",5"), 0.5);
  assert.equal(app.parseNumber("1 234,5"), 1234.5);
  assert.ok(Number.isNaN(app.parseNumber("1e3")));
  assert.ok(Number.isNaN(app.parseNumber("0x10")));
  assert.ok(Number.isNaN(app.parseNumber("1 2")));
});

test("PRECISE-DAPT воспроизводит пример ESC: 31", () => {
  setValues({ pdAge: 78, pdCrcl: 58, pdHb: 11.1, pdHbUnit: "gdl", pdWbc: 5.6 });
  setRadio("pdBleed", 0);
  assert.equal(app.calculatePrecisedapt(), true);
  assert.equal(resultNumber("precisedapt"), 31);
});

test("DLCN использует точные пороги mg/dL", () => {
  setValues({ dlcnFamily: 0, dlcnClinical: 0, dlcnPhysical: 0, dlcnLdlUnit: "mgdl" });
  setRadio("dlcnGenetic", 0);
  for (const [ldl, expected] of [[154, 0], [155, 1], [190, 1], [191, 3], [250, 3], [251, 5], [324, 5], [325, 8]]) {
    setValues({ dlcnLdl: ldl });
    assert.equal(app.calculateDlcn(), true);
    assert.equal(resultNumber("dlcn"), expected, `${ldl} mg/dL`);
  }
});

test("DLCN использует точные пороги mmol/L", () => {
  setValues({ dlcnLdlUnit: "mmol" });
  for (const [ldl, expected] of [[3.9, 0], [4, 1], [4.9, 1], [5, 3], [6.4, 3], [6.5, 5], [8.4, 5], [8.5, 8]]) {
    setValues({ dlcnLdl: ldl });
    assert.equal(app.calculateDlcn(), true);
    assert.equal(resultNumber("dlcn"), expected, `${ldl} mmol/L`);
  }
});

test("PHQ-9, GAD-7 и STOP-Bang нельзя отправить пустыми", () => {
  for (let index = 1; index <= 9; index += 1) setValues({ [`phq9q${index}`]: "" });
  for (let index = 1; index <= 7; index += 1) setValues({ [`gad7q${index}`]: "" });
  for (let index = 1; index <= 8; index += 1) setValues({ [`stopbang${index}`]: "" });
  assert.equal(app.calculatePhq9(), false);
  assert.equal(app.calculateGad7(), false);
  assert.equal(app.calculateStopbang(), false);
  assert.equal(getElement("phq9Result").textContent, "—");
  assert.equal(getElement("gad7Result").textContent, "—");
  assert.equal(getElement("stopbangResult").textContent, "—");
});

test("STOP-Bang распознаёт комбинированный высокий риск", () => {
  [1, 1, 0, 0, 0, 0, 0, 1].forEach((value, index) => setValues({ [`stopbang${index + 1}`]: value }));
  assert.equal(app.calculateStopbang(), true);
  assert.equal(resultNumber("stopbang"), 3);
  assert.match(getElement("stopbangInterpretation").textContent, /Высокий/);

  [1, 1, 1, 0, 0, 0, 0, 0].forEach((value, index) => setValues({ [`stopbang${index + 1}`]: value }));
  assert.equal(app.calculateStopbang(), true);
  assert.match(getElement("stopbangInterpretation").textContent, /Промежуточный/);
});

test("категории СКФ определяются до округления", () => {
  assert.equal(app.egfrCategory(59.999).category, "G3a");
  assert.equal(app.egfrCategory(60).category, "G2");
  assert.equal(app.egfrCategory(44.999).category, "G3b");
  assert.equal(app.egfrCategory(45).category, "G3a");
  assert.equal(app.egfrCategory(14.999).category, "G5");
  assert.equal(app.egfrCategory(15).category, "G4");
});

test("SCORE2 требует регион и различает калибровки", () => {
  setValues({ score2Country: "manual", score2Eligibility: "eligible", score2Guideline: "prevention2021", score2Age: 60, score2Sbp: 140, score2Tc: 6, score2Hdl: 1.3, score2TcUnit: "mmol", score2HdlUnit: "mmol", score2Region: "" });
  setRadio("score2Sex", "male");
  setRadio("score2Smoking", 0);
  assert.equal(app.calculateScore2(), false);
  setValues({ score2Region: "low" });
  assert.equal(app.calculateScore2(), true);
  const low = resultNumber("score2");
  setValues({ score2Region: "veryHigh" });
  assert.equal(app.calculateScore2(), true);
  const veryHigh = resultNumber("score2");
  assert.ok(veryHigh > low, `${veryHigh} должно быть больше ${low}`);
});

test("невалидный необязательный T-критерий FRAX отклоняется", () => {
  setValues({ fraxAge: 65, fraxWeight: 70, fraxHeight: 170, fraxWeightUnit: "kg", fraxHeightUnit: "cm", fraxTscore: "abc" });
  setRadio("fraxSex", "female");
  assert.equal(app.calculateFrax(), false);
});

test("GRACE отклоняет ошибочно выбранные единицы креатинина", () => {
  setValues({ graceAge: 68, graceHr: 88, graceSbp: 125, graceCr: 95, graceCrUnit: "mgdl", graceKillip: 1 });
  assert.equal(app.calculateGrace(), false);
});

test("CRB/CURB отклоняет диастолическое АД не ниже систолического", () => {
  setValues({ pneuAge: 65, pneuRr: 20, pneuSbp: 80, pneuDbp: 120 });
  setRadio("pneumoniaMode", "crb");
  assert.equal(app.calculatePneumonia(), false);
});

test("необязательные поля электролитов валидируются строго", () => {
  setRadio("electroMode", "anion");
  setValues({ elAgNa: 140, elAgCl: 104, elAgHco3: 24, elAgAlb: "abc", elAgAlbUnit: "gl" });
  assert.equal(app.calculateElectrolytes(), false);

  setRadio("electroMode", "osm");
  setValues({ elOsmNa: 140, elOsmGlu: 5.5, elOsmUrea: 6, elOsmGluUnit: "mmol", elOsmUreaUnit: "urea", elOsmMeasured: "abc" });
  assert.equal(app.calculateElectrolytes(), false);

  setRadio("electroMode", "water");
  setValues({ elWaterWeight: 70, elWaterWeightUnit: "kg", elWaterNa: 135, elWaterCoeff: 0.6 });
  assert.equal(app.calculateElectrolytes(), false);
});

test("ADAPT совпадает с контрольными векторами Roche", () => {
  setValues({ adaptAge: 55, adaptProc3: 33.1, adaptPlatelets: 227 });
  setRadio("adaptDiabetes", 0);
  assert.equal(app.calculateAdapt(), true);
  assert.equal(resultNumber("adapt"), 8.022);

  setValues({ adaptAge: 45, adaptProc3: 94.1, adaptPlatelets: 599.43 });
  setRadio("adaptDiabetes", 1);
  assert.equal(app.calculateAdapt(), true);
  assert.equal(resultNumber("adapt"), 10.374);
});

test("PREVENT отклоняет ИМТ 40 за пределами валидированного диапазона", () => {
  setValues({ preventAge: 50, preventSbp: 120, preventBmi: 40, preventEgfr: 90, preventTc: 5, preventHdl: 1.2, preventTcUnit: "mmol", preventHdlUnit: "mmol" });
  setRadio("preventSex", "male");
  for (const name of ["preventSmoking", "preventDiabetes", "preventBpTx", "preventStatin"]) setRadio(name, 0);
  assert.equal(app.calculatePrevent(), false);
});

test("успешный расчёт проходит во всех остальных 23 калькуляторах", () => {
  setValues({ bmiWeight: 70, bmiWeightUnit: "kg", bmiHeight: 175, bmiHeightUnit: "cm" });
  assert.equal(app.calculateBmi(), true);
  assert.equal(resultNumber("bmi"), 22.9);

  setValues({ egfrAge: 60, egfrCreatinine: 90, egfrCreatinineUnit: "umol" });
  setRadio("egfrSex", "male");
  assert.equal(app.calculateEgfr(), true);
  assert.equal(resultNumber("egfr"), 84);

  setValues({ mentzerMcv: 72, mentzerRbc: 5, mentzerRbcUnit: "trillion" });
  assert.equal(app.calculateMentzer(), true);
  assert.equal(resultNumber("mentzer"), 14.4);

  setRadio("tsatMode", "tibc");
  setValues({ tsatIronTibc: 18, tsatTibc: 60, tsatIronTibcUnit: "umol", tsatTibcUnit: "umol" });
  assert.equal(app.calculateTsat(), true);
  assert.equal(resultNumber("tsat"), 30);

  setValues({ preventAge: 55, preventSbp: 130, preventBmi: 27, preventEgfr: 90, preventTc: 5.2, preventHdl: 1.3, preventTcUnit: "mmol", preventHdlUnit: "mmol" });
  setRadio("preventSex", "male");
  for (const name of ["preventSmoking", "preventDiabetes", "preventBpTx", "preventStatin"]) setRadio(name, 0);
  assert.equal(app.calculatePrevent(), true);
  assert.equal(resultNumber("prevent"), 4.7);

  for (let index = 1; index <= 9; index += 1) setValues({ [`phq9q${index}`]: 1 });
  assert.equal(app.calculatePhq9(), true);
  assert.equal(resultNumber("phq9"), 9);

  for (let index = 1; index <= 7; index += 1) setValues({ [`gad7q${index}`]: 1 });
  assert.equal(app.calculateGad7(), true);
  assert.equal(resultNumber("gad7"), 7);

  document.querySelectorAll("#mmseForm .mmse-point").forEach((element) => { element.checked = true; });
  assert.equal(app.calculateMmse(), true);
  assert.equal(resultNumber("mmse"), 30);

  setValues({ fib4Age: 50, fib4Ast: 30, fib4Alt: 30, fib4Platelets: 250, fib4PlateletsUnit: "giga" });
  assert.equal(app.calculateFib4(), true);
  assert.equal(resultNumber("fib4"), 1.1);

  setValues({ maf5Waist: 100, maf5WaistUnit: "cm", maf5Bmi: 30, maf5Ast: 35, maf5Platelets: 250, maf5PlateletsUnit: "giga" });
  setRadio("maf5Diabetes", 0);
  assert.equal(app.calculateMaf5(), true);
  assert.equal(resultNumber("maf5"), 0.78);

  setValues({ liverproValue: 50 });
  assert.equal(app.calculateLiverpro(), true);
  assert.equal(resultNumber("liverpro"), 50);

  for (let index = 1; index <= 8; index += 1) setValues({ [`epworth${index}`]: 1 });
  assert.equal(app.calculateEpworth(), true);
  assert.equal(resultNumber("epworth"), 8);

  setValues({ afAge: 70 });
  setRadio("afSex", "male");
  setChecked(["afHtn"]);
  assert.equal(app.calculateAfstroke(), true);
  assert.equal(resultNumber("afstroke"), 2);

  setRadio("vteMode", "perc");
  setValues({ vtePercAge: 40, vtePercPulse: 80, vtePercSpo2: 98 });
  assert.equal(app.calculateVte(), true);
  assert.equal(resultNumber("vte"), 0);

  setRadio("pneumoniaMode", "curb");
  setValues({ pneuAge: 70, pneuRr: 32, pneuSbp: 100, pneuDbp: 70, pneuUrea: 8, pneuUreaUnit: "mmol" });
  getElement("pneuConfusion").checked = false;
  assert.equal(app.calculatePneumonia(), true);
  assert.equal(resultNumber("pneumonia"), 3);

  setRadio("soreMode", "mcisaac");
  setValues({ soreAge: 30 });
  setChecked(["stExudate", "stNodes"]);
  assert.equal(app.calculateSorethroat(), true);
  assert.equal(resultNumber("sorethroat"), 2);

  setRadio("qtcInputMode", "hr");
  setRadio("qtcSex", "male");
  setValues({ qtcQt: 400, qtcQtUnit: "ms", qtcHr: 75 });
  assert.equal(app.calculateQtc(), true);
  assert.equal(resultNumber("qtc"), 431);

  setRadio("electroMode", "calcium");
  setValues({ elCa: 2.2, elCaUnit: "mmol", elCaAlb: 35, elCaAlbUnit: "gl" });
  assert.equal(app.calculateElectrolytes(), true);
  assert.equal(resultNumber("electrolytes"), 2.3);

  setValues({ graceAge: 68, graceHr: 88, graceSbp: 125, graceCr: 95, graceCrUnit: "umol", graceKillip: 1 });
  setChecked(["graceSt"]);
  assert.equal(app.calculateGrace(), true);
  assert.equal(resultNumber("grace"), 136);

  setValues({ hasbledAge: 70 });
  setChecked(["hbHtn"]);
  assert.equal(app.calculateHasbled(), true);
  assert.equal(resultNumber("hasbled"), 2);

  setValues({ cadAge: 55, cadSymptoms: "atypical" });
  setRadio("cadSex", "male");
  assert.equal(app.calculateCadptp(), true);
  assert.equal(resultNumber("cadptp"), 17);

  setValues({ fraxAge: 65, fraxWeight: 70, fraxHeight: 170, fraxWeightUnit: "kg", fraxHeightUnit: "cm", fraxTscore: -1.5 });
  setRadio("fraxSex", "female");
  setChecked(["fraxPrev"]);
  assert.equal(app.calculateFrax(), true);
  assert.equal(resultNumber("frax"), 24.2);

  setValues({ egfrcysAge: 60, egfrcysCystatin: 1.2, egfrcysCreatinine: 90, egfrcysCreatinineUnit: "umol" });
  setRadio("egfrcysSex", "male");
  assert.equal(app.calculateEgfrcys(), true);
  assert.equal(resultNumber("egfrcys"), 73);
});

test("критические UI-регрессии закрыты статически", () => {
  const electroBlock = appScript.slice(appScript.indexOf("function updateElectroMode"), appScript.indexOf("document.querySelectorAll('input[name=\"electroMode\"]'"));
  for (const unrelated of ["grace", "hasbled", "cadptp", "dlcn", "precisedapt", "frax", "egfrcys"]) {
    assert.ok(!electroBlock.includes(`clearResult("${unrelated}"`), unrelated);
  }
  const resetBlock = appScript.slice(appScript.indexOf("function resetAll"), appScript.indexOf('document.getElementById("resetAll")'));
  for (const updater of ["updateVteMode", "updatePneumoniaMode", "updateSoreMode", "updateQtcMode", "updateElectroMode"]) {
    assert.ok(resetBlock.includes(`${updater}();`), updater);
  }
  assert.ok(!appScript.includes('document.querySelectorAll("input").forEach'));
  assert.ok(appScript.includes('form.addEventListener("input", () => invalidateResult(key))'));
  const searchIndexBlock = appScript.slice(appScript.indexOf("function ensureDesktopSearchIndex"), appScript.indexOf("function applyDesktopSearchFilter"));
  assert.ok(!searchIndexBlock.includes("section.textContent"));
  const openSearchBlock = appScript.slice(appScript.indexOf("function openMobileSearch"), appScript.indexOf("function closeMobileSearch"));
  assert.ok(openSearchBlock.includes("!mobileSearchSuggestions.hidden"));
  const mandatoryQuestionSelects = [...html.matchAll(/<select[^>]*id="(?:stopbang|phq9q|gad7q)\d+"[^>]*>([^<]*<option[^>]*>Выберите ответ<\/option>)/g)];
  assert.equal(mandatoryQuestionSelects.length, 24);
});

const score2Example = () => {
  setValues({ score2Eligibility: "eligible", score2Country: "manual", score2Region: "low",
    score2Guideline: "prevention2021", score2Age: 50, score2Sbp: 140,
    score2Tc: 5.5, score2Hdl: 1.3, score2TcUnit: "mmol", score2HdlUnit: "mmol" });
  setRadio("score2Sex", "male");
  setRadio("score2Smoking", 1);
};

test("SCORE2: четыре опубликованных примера EHJ 2021 ehab309", () => {
  score2Example();
  for (const [sex, region, expected] of [
    ["male", "low", 5.9], ["male", "veryHigh", 14.0],
    ["female", "low", 4.2], ["female", "veryHigh", 13.7]
  ]) {
    setRadio("score2Sex", sex);
    setValues({ score2Region: region });
    assert.equal(app.calculateScore2(), true);
    assert.equal(resultNumber("score2"), expected, `${sex}, ${region}`);
  }
});

test("SCORE2: страна определяет калибровку, а не устаревший ручной выбор", () => {
  score2Example();
  setValues({ score2Country: "RU", score2Region: "low" });
  assert.equal(app.calculateScore2(), true);
  assert.equal(resultNumber("score2"), 14);
  assert.match(getElement("score2Note").textContent, /Россия/);
  assert.equal(app.SCORE2_COUNTRIES.KZ[1], "high");
  assert.equal(app.SCORE2_COUNTRIES.GB[1], "low");
});

test("SCORE2: без подтверждения применимости и ответа о курении нет результата", () => {
  score2Example();
  for (const value of ["", "cvd", "diabetes", "ckd", "fh", "pregnancy"]) {
    setValues({ score2Eligibility: value });
    assert.equal(app.calculateScore2(), false, value);
    assert.equal(app.state.results.score2, null);
  }
  setValues({ score2Eligibility: "eligible" });
  namedInputs.set("score2Smoking", []);
  assert.equal(app.calculateScore2(), false);
});

test("SCORE2: возраст в полных годах 40–69", () => {
  score2Example();
  for (const age of [39, 40.5, 70]) {
    setValues({ score2Age: age });
    assert.equal(app.calculateScore2(), false);
  }
  for (const age of [40, 69]) {
    setValues({ score2Age: age });
    assert.equal(app.calculateScore2(), true);
  }
});

test("SCORE2: ESC 2021 и ESC/EAS 2025 меняют категорию, но не процент", () => {
  score2Example();
  assert.equal(app.calculateScore2(), true);
  const risk = resultNumber("score2");
  assert.match(getElement("score2Interpretation").textContent, /Высокий риск/);
  setValues({ score2Guideline: "lipids2025" });
  assert.equal(app.calculateScore2(), true);
  assert.equal(resultNumber("score2"), risk);
  assert.match(getElement("score2Interpretation").textContent, /Умеренный риск/);
  for (const [p, age, guideline, category] of [
    [2.4999, 49, "prevention2021", "Низкий–умеренный"],
    [2.5, 49, "prevention2021", "Высокий"],
    [7.5, 49, "prevention2021", "Очень высокий"],
    [4.9999, 50, "prevention2021", "Низкий–умеренный"],
    [5, 50, "prevention2021", "Высокий"],
    [10, 50, "prevention2021", "Очень высокий"],
    [1.9999, 50, "lipids2025", "Низкий"],
    [2, 50, "lipids2025", "Умеренный"],
    [10, 50, "lipids2025", "Высокий"],
    [20, 50, "lipids2025", "Очень высокий"]
  ]) assert.ok(app.score2Category(p, age, guideline)[0].startsWith(category));
});

test("SCORE2: независимые единицы для ОХС и ЛПВП эквивалентны", () => {
  score2Example();
  for (const tcUnit of ["mmol", "mgdl"]) for (const hdlUnit of ["mmol", "mgdl"]) {
    setValues({ score2TcUnit: tcUnit, score2HdlUnit: hdlUnit,
      score2Tc: tcUnit === "mmol" ? 5.5 : 5.5 / 0.02586,
      score2Hdl: hdlUnit === "mmol" ? 1.3 : 1.3 / 0.02586 });
    assert.equal(app.calculateScore2(), true);
    assert.equal(resultNumber("score2"), 5.9);
  }
});

test("SCORE2: выраженный одиночный фактор риска отмечен и в копируемом тексте", () => {
  score2Example();
  setValues({ score2Sbp: 180 });
  assert.equal(app.calculateScore2(), true);
  assert.match(getElement("score2Interpretation").textContent, /независимо значимый/);
  assert.match(app.state.results.score2, /не определяет клинический риск/);
});

test("QTc: категория определяется до округления у 450, 460 и 500 мс", () => {
  setRadio("qtcInputMode", "hr");
  setValues({ qtcHr: 60, qtcQtUnit: "ms" });
  for (const [sex, qt, tone] of [
    ["male", 449.8, "good"], ["male", 450, "warning"],
    ["female", 459.8, "good"], ["female", 460, "warning"],
    ["male", 499.8, "warning"], ["male", 500, "danger"]
  ]) {
    setRadio("qtcSex", sex);
    setValues({ qtcQt: qt });
    assert.equal(app.calculateQtc(), true);
    assert.equal(getElement("qtcInterpretation").className, `result-interpretation ${tone}`);
  }
});

test("ошибка QTc очищает все четыре дополнительных результата", () => {
  setValues({ qtcQt: "" });
  assert.equal(app.calculateQtc(), false);
  assert.equal(app.state.results.qtc, null);
  for (const metric of document.querySelectorAll("#qtcMetrics strong")) assert.equal(metric.textContent, "—");
});

test("FIB-4: до 35 лет нет ложной зелёной категории", () => {
  setValues({ fib4Age: 30, fib4Ast: 20, fib4Alt: 20, fib4Platelets: 300 });
  assert.equal(app.calculateFib4(), true);
  assert.equal(getElement("fib4Interpretation").className, "result-interpretation warning");
  assert.match(getElement("fib4Interpretation").textContent, /Надёжно определить/);
  setValues({ fib4Age: 35 });
  assert.equal(app.calculateFib4(), true);
  assert.equal(getElement("fib4Interpretation").className, "result-interpretation good");
});

test("HTML: уникальные id, существующие якоря и локальные ресурсы", async () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  const knownIds = new Set(ids);
  assert.equal(knownIds.size, ids.length);
  for (const match of html.matchAll(/\b(?:for|data-target)="([^"]+)"/g)) assert.ok(knownIds.has(match[1]), match[1]);
  for (const match of html.matchAll(/href="#([^"]+)"/g)) assert.ok(knownIds.has(match[1]), match[1]);
  for (const match of html.matchAll(/(?:src|href)="(assets\/[^"#]+)"/g)) {
    await readFile(new URL(`../${match[1]}`, import.meta.url));
  }
  for (const match of appScript.matchAll(/getElementById\("([^"]+)"\)/g)) assert.ok(knownIds.has(match[1]), match[1]);
  assert.equal((html.match(/<form\b/g) || []).length, 28);
  assert.ok(!html.includes("data:image"));
});

test("навигация соответствует верхнему калькулятору, прокрутке и фильтру", () => {
  const selected = new Set();
  const positions = [289, 2000, 4000];
  const sectionIds = ["score2", "prevent", "fib4"];
  const navContext = vm.createContext({
    Math,
    window: { innerHeight: 720, matchMedia: () => ({ matches: false }) },
    sections: sectionIds.map((id, i) => ({ id, hidden: false, getBoundingClientRect: () => ({ top: positions[i] }) })),
    navButtons: sectionIds.map(id => ({ dataset: { target: id }, classList: {
      toggle: (_, active) => active ? selected.add(id) : selected.delete(id)
    } }))
  });
  const start = appScript.indexOf("    function updateActiveNavigation()");
  const end = appScript.indexOf("    let navigationFrame", start);
  assert.ok(start > 0 && end > start);
  vm.runInContext(appScript.slice(start, end), navContext);
  const expectActive = (id) => {
    vm.runInContext("updateActiveNavigation()", navContext);
    assert.deepEqual([...selected], [id]);
  };
  expectActive("score2");
  positions[0] = -1800; positions[1] = 20;
  expectActive("prevent");
  positions[0] = 289; positions[1] = 2000;
  expectActive("score2");
  navContext.sections[0].hidden = true;
  navContext.sections[1].hidden = true;
  expectActive("fib4");
});
