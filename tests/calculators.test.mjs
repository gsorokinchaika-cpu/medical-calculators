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
  closest(selector) {
    if (selector === ".result-box" && this.id.startsWith("copy-")) return getElement("box-" + this.id.slice(5));
    return null;
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
  calculateCadptp, calculateEgfrcys, score2Category, SCORE2_COUNTRIES,
  score2OpRisk, score2DiabetesRisk, score2DiabetesCategory,
  hba1cToIfcc, calculateExtendedScore2, validateSharedPatient, sharedValueInUnit
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
  assert.equal((html.match(/<form\b/g) || []).length, 31);
  assert.equal((html.match(/class="calculator"/g) || []).length, 30);
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

test("SCORE2-Diabetes: восемь результатов в авторском Excel, оба пола и все регионы", () => {
  // ehad260, supplementary Excel, calculator B4:B11 and values D14:D17/H14:H17.
  // Cached source workbook values, not generated from the implementation.
  const input = { age: 53, diagnosisAge: 30, smoking: 1, sbp: 110, tc: 4.5, hdl: 1.4, hba1c: 55, egfr: 95 };
  const expected = {
    male: [9.955391638953781, 13.116444885691047, 15.388566936926818, 24.147741949388656],
    female: [8.080021034297335, 10.302441868725165, 16.007637019557475, 27.86944753840701]
  };
  for (const sex of ["male", "female"]) for (const [i, region] of ["low", "moderate", "high", "veryHigh"].entries()) {
    assert.ok(Math.abs(app.score2DiabetesRisk({ ...input, sex, region }) - expected[sex][i]) < 1e-10);
  }
});

test("SCORE2-Diabetes: семь согласованных примеров в тексте статьи", () => {
  const input = { age: 60, smoking: 0, sbp: 140, tc: 5.5, hdl: 1.3 };
  for (const [sex, region, diagnosisAge, hba1c, egfr, expected] of [
    ["male", "moderate", 60, 50, 90, 11.0],
    ["male", "moderate", 50, 70, 60, 17.2], ["female", "moderate", 50, 70, 60, 12.7],
    ["male", "low", 50, 70, 60, 12.9], ["female", "low", 50, 70, 60, 9.8],
    ["male", "veryHigh", 50, 70, 60, 31.2], ["female", "veryHigh", 50, 70, 60, 34.0]
  ]) {
    const actual = app.score2DiabetesRisk({ ...input, sex, region, diagnosisAge, hba1c, egfr });
    assert.ok(Math.abs(actual - expected) < 0.1, `${sex}/${region}: ${actual}, published ${expected}`);
  }
  // The paper's first female example says 7.9%, inconsistent with its
  // exact Supplementary Table 1 / author Excel equations (7.588...%).
  // Do not change coefficients or relax tolerance to force that example.
  assert.ok(Math.abs(app.score2DiabetesRisk({ ...input, sex: "female", region: "moderate", diagnosisAge:60, hba1c:50, egfr:90 })-7.5881859285786)<1e-10);
});

test("SCORE2-OP: независимый двухэтапный пересчёт таблиц приложения, 640 профилей", () => {
  // ehab312 Supplementary Methods Tables 1–3. Deliberately use separate
  // vectors, ordinary powers/logs and Table 1 calibrations, not production helpers.
  const coeff = {
    male: [.0634, .3524, .0094, .0850, -.3564, -.0247, -.0005, .0073, .0091],
    female: [.0789, .4921, .0102, .0605, -.3040, -.0255, -.0004, -.0009, .0154]
  };
  const cal = { male: [[-.34,1.19],[.01,1.25],[.08,1.15],[.05,.7]], female: [[-.52,1.01],[-.1,1.1],[.38,1.09],[.38,.69]] };
  for (const sex of ["male", "female"]) for (const age of [70, 73, 75, 80, 89]) for (const smoking of [0, 1]) for (const sbp of [110, 170]) for (const tc of [4, 7]) for (const hdl of [1, 2]) for (const [i, region] of ["low", "moderate", "high", "veryHigh"].entries()) {
    const a=age-73,s=sbp-150,t=tc-6,h=hdl-1.4;
    const vector=[a,smoking,s,t,h,a*smoking,a*s,a*t,a*h];
    const lp=vector.reduce((sum, value, index)=>sum+value*coeff[sex][index],0);
    const base=1-Math.pow(sex==="male"?.7576:.8082,Math.exp(lp-(sex==="male"?.0929:.229)));
    const [c1,c2]=cal[sex][i];
    const reference=100*(1-Math.exp(-Math.exp(c1+c2*Math.log(-Math.log(1-base)))));
    assert.ok(Math.abs(app.score2OpRisk({age,sex,smoking,sbp,tc,hdl,region})-reference)<1e-10);
  }
});

function extendedExample(key = "score2diabetes") {
  setValues(Object.fromEntries(Object.entries({ Eligibility: "eligible", Age: key === "score2op" ? 75 : 60,
    Sbp: 140, Tc: 5.5, Hdl: 1.3, TcUnit: "mmol", HdlUnit: "mmol", Country: "DE", Region: "", Guideline: "prevention2021",
    DiagnosisAge: 60, Hba1c: 50, Hba1cUnit: "ifcc", Egfr: 90, UacrCategory: "a1"
  }).map(([suffix, value]) => [key + suffix, value])));
  setRadio(key + "Sex", "male"); setRadio(key + "Smoking", "0");
}

test("SCORE2-OP и Diabetes: формы, пустые ответы, ограничения возраста и применимости", () => {
  for (const key of ["score2op", "score2diabetes"]) {
    extendedExample(key);
    assert.equal(app.calculateExtendedScore2(key), true);
    assert.ok(app.state.results[key]);
    for (const age of (key === "score2op" ? [69, 90, 75.5] : [39, 70, 60.5])) {
      setValues({ [key + "Age"]: age });
      assert.equal(app.calculateExtendedScore2(key), false);
      assert.equal(app.state.results[key], null);
    }
    for (const eligibility of ["", "ineligible", "other"]) {
      extendedExample(key); setValues({ [key + "Eligibility"]: eligibility });
      assert.equal(app.calculateExtendedScore2(key), false);
    }
    extendedExample(key); namedInputs.delete(key + "Smoking");
    assert.equal(app.calculateExtendedScore2(key), false);
    extendedExample(key); setValues({ [key + "Country"]: "" });
    assert.equal(app.calculateExtendedScore2(key), false);
  }
});

test("SCORE2-Diabetes: тяжёлое поражение почек исключает расчёт", () => {
  for (const [egfr, uacr, allowed] of [[44.9,"a1",false],[45,"a1",true],[59.9,"a2",false],[60,"a2",true],[90,"a3",false],[90,"",false]]) {
    extendedExample(); setValues({ score2diabetesEgfr: egfr, score2diabetesUacrCategory: uacr });
    assert.equal(app.calculateExtendedScore2("score2diabetes"), allowed, `${egfr}/${uacr}`);
    if (!allowed) assert.equal(getElement("copy-score2diabetes").disabled, true);
  }
});

test("SCORE2-Diabetes: HbA1c, возраст диагноза, все сочетания единиц липидов", () => {
  for (const unit of ["ifcc", "percent"]) for (const tcUnit of ["mmol", "mgdl"]) for (const hdlUnit of ["mmol", "mgdl"]) {
    extendedExample();
    setValues({ score2diabetesHba1cUnit: unit, score2diabetesHba1c: unit === "ifcc" ? 50 : 50*.09148+2.152,
      score2diabetesTcUnit: tcUnit, score2diabetesTc: tcUnit === "mmol" ? 5.5 : 5.5/.02586,
      score2diabetesHdlUnit: hdlUnit, score2diabetesHdl: hdlUnit === "mmol" ? 1.3 : 1.3/.02586 });
    assert.equal(app.calculateExtendedScore2("score2diabetes"), true);
    assert.equal(resultNumber("score2diabetes"), 11);
  }
  for (const value of ["", 0, 61, 50.5]) {
    extendedExample(); setValues({ score2diabetesDiagnosisAge: value });
    assert.equal(app.calculateExtendedScore2("score2diabetes"), false);
  }
  for (const value of ["", -1, 200]) {
    extendedExample(); setValues({ score2diabetesHba1c: value });
    assert.equal(app.calculateExtendedScore2("score2diabetes"), false);
  }
  assert.ok(Math.abs(app.hba1cToIfcc(6.726, "percent") - 50) < 1e-10);
});

test("новые SCORE2: точные границы категорий до округления", () => {
  for (const [n, expected] of [[7.499,"good"],[7.5,"warning"],[14.999,"warning"],[15,"danger"]]) assert.equal(app.score2Category(n,75,"prevention2021")[1],expected);
  for (const [n, expected] of [[4.999,"Низкий"],[5,"Умеренный"],[9.999,"Умеренный"],[10,"Высокий"],[19.999,"Высокий"],[20,"Очень высокий"]]) assert.ok(app.score2DiabetesCategory(n)[0].startsWith(expected));
});

test("общие данные: пустое не становится нулём, строгая валидация и единицы", () => {
  assert.equal(Object.keys(app.validateSharedPatient({ Age: "", Sbp: " " }).data).length, 0);
  assert.equal(app.validateSharedPatient({ Age: "60", Tc: "5,5", Hdl: "1,3", Smoking: "0" }).data.Smoking,"0");
  for (const raw of [{Age:"60.5"},{Age:"0"},{Sbp:"abc"},{Tc:"5",Hdl:"5"},{Creatinine:"-1"}]) assert.ok(app.validateSharedPatient(raw).error);
  for (const [value,kind,unit,expected] of [[5.5,"Tc","mgdl",5.5/.02586],[88.4,"Creatinine","mgdl",1],[70,"Weight","lb",70/.45359237],[170,"Height","m",1.7],[170,"Height","in",170/2.54]]) assert.ok(Math.abs(app.sharedValueInUnit(value,kind,unit)-expected)<1e-10);
});

test("PREVENT не подставляет отрицательные ответы при отсутствии данных", () => {
  namedInputs.delete("preventSmoking");
  assert.equal(app.calculatePrevent(), false);
  assert.equal(app.state.results.prevent, null);
  const answers = [...html.matchAll(/<input\b[^>]*\bname="prevent(?:Smoking|Diabetes|BpTx|Statin)"[^>]*>/g)];
  assert.equal(answers.length, 8);
  for (const [input] of answers) assert.doesNotMatch(input, /\schecked(?:\s|=|\/?>)/);
});

test("разные модели СКФ не смешиваются при переносе общих показателей", () => {
  assert.match(appScript, /Egfr: \["preventEgfr"\]/);
  assert.match(html, /for="score2diabetesEgfr">СКФ CKD-EPI 2009/);
  assert.match(html, /for="sharedEgfr">СКФ CKD-EPI 2021/);
});

test("клиент офлайн: первая активация не выглядит как обновление и не стирает поля", async () => {
  const handlers = {}, regHandlers = {}, winHandlers = {};
  const status = { textContent: "" }, update = { hidden: true, disabled:false, addEventListener(){} };
  let reloads=0;
  const sw = { controller:null, ready:Promise.resolve({}),
    async register() { return { waiting:null, addEventListener(type,fn){regHandlers[type]=fn;} }; },
    addEventListener(type,fn) { handlers[type]=fn; } };
  const c=vm.createContext({URL,Boolean,Promise,navigator:{serviceWorker:sw,onLine:true},
    document:{getElementById:id=>id==="offlineStatus"?status:update},
    window:{isSecureContext:true,location:{href:"https://example.test/medical-calculators/",reload:()=>reloads++},addEventListener(type,fn){winHandlers[type]=fn;}} });
  const start=appScript.indexOf("    async function prepareOffline()");
  const end=appScript.indexOf('    window.addEventListener("load", prepareOffline',start);
  vm.runInContext(appScript.slice(start,end),c);
  await vm.runInContext("prepareOffline()",c);
  sw.controller={}; handlers.controllerchange();
  assert.equal(update.hidden,true);
  assert.equal(status.textContent,"Доступно офлайн");
  assert.equal(reloads,0);
  handlers.controllerchange();
  assert.equal(update.hidden,false);
  assert.match(status.textContent,/перезагрузке/);
  assert.equal(reloads,0);
});

test("клиент офлайн: отмена обновления ничего не активирует; согласие ждёт controllerchange", async () => {
  const handlers = {}, buttonHandlers={};
  let consent=false, activations=0, reloads=0;
  const status={textContent:""}, button={hidden:true,disabled:false,addEventListener(type,fn){buttonHandlers[type]=fn;}};
  const registration={waiting:{postMessage(message){assert.equal(message.type,"ACTIVATE_UPDATE");activations++;}},addEventListener(){}};
  const c=vm.createContext({URL,Boolean,Promise,
    navigator:{onLine:true,serviceWorker:{controller:{},ready:Promise.resolve(registration),async register(){return registration;},addEventListener(type,fn){handlers[type]=fn;}}},
    document:{getElementById:id=>id==="offlineStatus"?status:button},
    window:{isSecureContext:true,confirm:()=>consent,location:{href:"https://example.test/app/",reload:()=>reloads++},addEventListener(){}}});
  const start=appScript.indexOf("    async function prepareOffline()");
  const end=appScript.indexOf('    window.addEventListener("load", prepareOffline',start);
  vm.runInContext(appScript.slice(start,end),c);
  await vm.runInContext("prepareOffline()",c);
  assert.equal(button.hidden,false);
  buttonHandlers.click();
  assert.equal(activations,0); assert.equal(reloads,0); assert.equal(button.disabled,false);
  consent=true; buttonHandlers.click();
  assert.equal(activations,1); assert.equal(reloads,0); assert.equal(button.disabled,true);
  handlers.controllerchange(); assert.equal(reloads,1);
});

test("новый пациент: отмена сохраняет данные; согласие вызывает полную очистку", () => {
  let consent=false, resets=0, announced="";
  const status={textContent:""};
  const c=vm.createContext({window:{confirm:()=>consent},document:{getElementById:()=>status},resetAll:()=>resets++,announce:message=>announced=message});
  const start=appScript.indexOf("    function startNewPatient()");
  const end=appScript.indexOf('    document.getElementById("resetAll")?.addEventListener',start);
  vm.runInContext(appScript.slice(start,end),c);
  vm.runInContext("startNewPatient()",c); assert.equal(resets,0);
  consent=true; vm.runInContext("startNewPatient()",c); assert.equal(resets,1);
  assert.match(announced,/очищены/);
});

test("результат виден только после успешного расчёта; ошибка сохраняет предупреждение", () => {
  setValues({ bmiWeight: 70, bmiHeight: 170, bmiWeightUnit: "kg", bmiHeightUnit: "cm" });
  assert.equal(app.calculateBmi(), true);
  assert.equal(getElement("box-bmi").dataset.ready, "true");
  assert.equal(getElement("copy-bmi").disabled, false);
  setValues({ bmiWeight: "" });
  assert.equal(app.calculateBmi(), false);
  assert.equal(getElement("box-bmi").dataset.ready, "false");
  assert.equal(getElement("copy-bmi").disabled, true);
  assert.equal(getElement("bmiResult").textContent, "—");
  assert.match(getElement("bmiNote").textContent, /скрининговой/);
  assert.ok(getElement("bmiError").textContent);
});
