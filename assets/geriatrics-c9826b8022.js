"use strict";

// Self-contained feature: scoring facts and UI. No patient data is persisted.
const Geriatrics = (() => {
  const barthelItems = [
    ["Приём пищи", [[0, "Не может есть сам"], [5, "Помощь с пищей / модифицированная диета"], [10, "Самостоятельно"]]],
    ["Купание", [[0, "Нужна помощь"], [5, "Самостоятельно"]]],
    ["Личная гигиена", [[0, "Нужна помощь"], [5, "Самостоятельно: лицо, волосы, зубы, бритьё"]]],
    ["Одевание", [[0, "Зависим"], [5, "Около половины действий выполняет сам"], [10, "Самостоятельно, включая застёжки"]]],
    ["Контроль стула", [[0, "Недержание / необходимы клизмы"], [5, "Отдельные эпизоды недержания"], [10, "Полный контроль"]]],
    ["Контроль мочеиспускания", [[0, "Недержание / не обслуживает катетер сам"], [5, "Отдельные эпизоды недержания"], [10, "Полный контроль"]]],
    ["Посещение туалета", [[0, "Зависим"], [5, "Частично нужна помощь"], [10, "Самостоятельно, включая одежду и гигиену"]]],
    ["Пересаживание: кровать ↔ кресло", [[0, "Не удерживает равновесие сидя"], [5, "Сидит; значительная помощь 1–2 человек"], [10, "Небольшая физическая / словесная помощь"], [15, "Самостоятельно"]]],
    ["Передвижение по ровной поверхности", [[0, "Не передвигается / дистанция недостаточна"], [5, "Самостоятельно в коляске, включая повороты"], [10, "Ходьба с помощью одного человека"], [15, "Самостоятельная ходьба; опора допустима"]], "Для 5–15 баллов: более 50 ярдов (45,72 м)."],
    ["Лестница", [[0, "Не может"], [5, "Нужна физическая / словесная помощь"], [10, "Самостоятельно"]]]
  ];
  const mnaPoints = { A: [0, 1, 2], B: [0, 1, 2, 3], C: [0, 1, 2], D: [0, 2], E: [0, 1, 2] };
  const notes = {
    barthel: "Оценивайте фактическое выполнение, а не потенциальные возможности. Наблюдение и словесная помощь тоже считаются помощью.",
    mna: "Скрининг для людей 65 лет и старше. Результат требует клинической оценки и не является самостоятельным диагнозом."
  };
  const validPoint = (raw, allowed) => typeof raw === "string" && allowed.some(n => String(n) === raw);

  function barthelCategory(score) {
    if (score <= 20) return ["Полная зависимость", "danger"];
    if (score <= 60) return ["Выраженная зависимость", "danger"];
    if (score <= 90) return ["Умеренная зависимость", "warning"];
    if (score < 100) return ["Небольшая зависимость", "warning"];
    return ["Независимость в оцениваемых действиях", "good"];
  }

  function scoreBarthel(values) {
    if (!Array.isArray(values) || values.length !== 10 || values.some((value, i) => !validPoint(value, barthelItems[i][1].map(option => option[0])))) {
      return { error: "Выберите ответ в каждом из 10 пунктов индекса Бартел." };
    }
    const score = values.reduce((sum, value) => sum + Number(value), 0);
    const [interpretation, tone] = barthelCategory(score);
    return { score, interpretation, tone, breakdown: values.map((v, i) => `${i + 1}: ${v}`).join("; ") };
  }

  function mnaCategory(score) {
    if (score < 8) return ["Недостаточность питания по MNA-SF", "danger"];
    if (score < 12) return ["Риск недостаточности питания", "warning"];
    return ["Нормальный нутритивный статус по MNA-SF", "good"];
  }

  function scoreMna(data, parse) {
    const age = parse(data.age);
    if (!Number.isInteger(age) || age < 65 || age > 120) return { error: "Укажите возраст в полных годах: 65–120. Эта версия предназначена для людей от 65 лет." };
    if (!Object.entries(mnaPoints).every(([key, allowed]) => validPoint(data[key], allowed))) return { error: "Перенесите баллы всех пунктов A–E из официального бланка MNA-SF." };
    let f, measurement;
    if (data.mode === "bmi") {
      const bmi = parse(data.bmi);
      if (!Number.isFinite(bmi) || bmi < 5 || bmi > 100) return { error: "Укажите ИМТ от 5 до 100 кг/м²; не округляйте его перед расчётом." };
      f = bmi < 19 ? 0 : bmi < 21 ? 1 : bmi < 23 ? 2 : 3;
      measurement = `F1 (ИМТ ${bmi} кг/м²): ${f}`;
    } else if (data.mode === "calf") {
      const calf = parse(data.calf);
      if (!Number.isFinite(calf) || calf < 5 || calf > 100) return { error: "Укажите окружность голени от 5 до 100 см." };
      f = calf < 31 ? 0 : 3;
      measurement = `F2 (окружность голени ${calf} см): ${f}`;
    } else return { error: "Для пункта F выберите ИМТ либо окружность голени, если ИМТ недоступен." };
    const score = Object.keys(mnaPoints).reduce((sum, key) => sum + Number(data[key]), f);
    const [interpretation, tone] = mnaCategory(score);
    return { score, interpretation, tone, f, measurement, age,
      breakdown: Object.keys(mnaPoints).map(key => `${key}: ${data[key]}`).concat(measurement).join("; ") };
  }

  function calculateBarthel({ setError, setResult }) {
    setError("barthel", "");
    const result = scoreBarthel(barthelItems.map((_, i) => document.getElementById(`barthel${i + 1}`).value));
    if (result.error) { setError("barthel", result.error); return false; }
    const note = "Категория зависимости ориентировочная; это не процент утраты функций. 100 баллов не исключают потребности в помощи в других сферах жизни.";
    setResult("barthel", String(result.score), result.interpretation, result.tone, note,
      `Индекс Бартел (10 пунктов, 0–100): ${result.score}/100. ${result.interpretation}.\nПункты: ${result.breakdown}.\n${note}`);
    return true;
  }

  function calculateMna({ setError, setResult, parseNumber }) {
    setError("mna", "");
    const data = Object.fromEntries(Object.keys(mnaPoints).map(key => [key, document.getElementById("mna" + key).value]));
    for (const key of ["age", "mode", "bmi", "calf"]) data[key] = document.getElementById("mna" + key[0].toUpperCase() + key.slice(1)).value;
    const result = scoreMna(data, parseNumber);
    if (result.error) { setError("mna", result.error); return false; }
    const note = result.score < 12 ? "Нужна углублённая оценка питания специалистом. Скрининг не заменяет диагноз и индивидуальный план помощи." : "При клинических признаках недостаточности питания обследование необходимо независимо от суммы баллов.";
    setResult("mna", String(result.score), result.interpretation, result.tone, note,
      `MNA-SF: ${result.score}/14. ${result.interpretation}. Возраст: ${result.age} лет.\n${result.breakdown}.\n${note}`);
    return true;
  }

  function question(id, label, options, hint = "") {
    return `<div class="question-item"><div><label for="${id}"><strong>${label}</strong></label>${hint ? `<small>${hint}</small>` : ""}</div><div><select id="${id}" required aria-describedby="${id}Answer"><option value="" selected disabled>Выберите балл</option>${options.map(([n, text]) => `<option value="${n}">${text ? text + " — " : ""}${n}</option>`).join("")}</select><small id="${id}Answer" hidden></small></div></div>`;
  }
  function card(key, title, subtitle, form, max, details) {
    const search = key === "barthel" ? "бартел бартель barthel adl самообслуживание повседневная активность гериатрия зависимость" : "mna sf mini nutritional assessment питание нутритивный статус мальнутриция гериатрия";
    return `<section class="calculator" id="${key}" data-tone="sage" data-search="${search}"><div class="calc-card"><div class="calc-main"><div class="calc-heading"><h2>${title}</h2><p>${subtitle}</p></div><form id="${key}Form" novalidate autocomplete="off">${form}<div class="error" id="${key}Error" role="alert"></div><div class="actions"><button class="primary" type="submit">Рассчитать</button><button class="secondary reset-card" data-form="${key}Form" type="button">Очистить</button></div></form><div aria-live="polite" class="result-box"><div class="result-main"><div><div class="result-label">Общий балл</div><div class="result-number" id="${key}Result">—</div><div class="result-unit">из ${max}</div></div><div class="result-interpretation" id="${key}Interpretation">Заполните все пункты.</div></div><p class="result-note" id="${key}Note">${notes[key]}</p><button class="copy-button" data-copy="${key}" disabled type="button">Копировать результат</button></div></div></div><details><summary>Методика и источники</summary>${details}</details></section>`;
  }

  function markup() {
    const barthel = card("barthel", "Индекс Бартел", "Самостоятельность в повседневной жизни · 0–100 баллов",
      `<p class="help">Оцените обычное выполнение за последние 24–48 часов. Выберите один ответ в каждом пункте.</p><div class="question-list">${barthelItems.map(([label, options, hint], i) => question(`barthel${i + 1}`, `${i + 1}. ${label}`, options, hint)).join("")}</div>`, 100,
      `<p>Стандартная 10-пунктовая версия 0–100; не смешивайте с вариантом 0–20 или модификацией Shah. Вспомогательные средства допустимы, если человек пользуется ими без чужой помощи. Краткие русские подписи служат подсказками для подсчёта, а не валидированным переводом бланка.</p><p>Ориентировочные диапазоны: 0–20 — полная, 21–60 — выраженная, 61–90 — умеренная, 91–99 — небольшая зависимость; 100 — независимость в оцениваемых действиях. Достижимые суммы кратны 5. Оценка не охватывает все бытовые и когнитивные функции.</p><p><a href="https://www.sralab.org/sites/default/files/2017-07/barthel.pdf" rel="noopener noreferrer">Бланк и правила подсчёта (PDF, EN)</a>. Mahoney FI, Barthel D. Functional evaluation: the Barthel Index. Maryland State Med J. 1965;14:56–61. © Maryland State Medical Society; условия некоммерческого использования — в источнике.</p><p><a href="https://docs.bvsalud.org/biblioref/2020/12/1141022/normatecnicadeatencionintegralensaludalapersonaadultamayor.pdf" rel="noopener noreferrer">Диапазоны зависимости: нормативный документ Минздрава Сальвадора, приложение 11 (2020)</a>. Категории ориентировочные и различаются между рекомендациями.</p>`);
    const mna = card("mna", "MNA-SF", "Нутритивный скрининг · подсчёт по официальному бланку",
      `<p class="help">Перенесите баллы A–E из заполненного <a href="https://www.mna-elderly.com/sites/default/files/2024-10/MNA_AU2.0_eng-USori.pdf" rel="noopener noreferrer">бланка MNA-SF (PDF, EN)</a>. Это помощник подсчёта, не самостоятельная анкета. Внешний бланк требует интернета.</p><div class="field-grid"><div class="field"><label for="mnaAge">Возраст</label><div class="control-row"><input id="mnaAge" inputmode="numeric" placeholder="65 лет и старше" required/><span class="unit-static">лет</span></div></div></div><div class="question-list">${Object.entries(mnaPoints).map(([key, values]) => question("mna" + key, "Пункт " + key, values.map(n => [n, ""]))).join("")}</div><div class="field-grid"><div class="field full"><label for="mnaMode">Пункт F: способ оценки</label><div class="control-row"><select id="mnaMode"><option value="bmi">F1 — ИМТ известен</option><option value="calf">F2 — ИМТ недоступен: окружность голени</option></select></div></div><div class="field full" id="mnaBmiPanel"><label for="mnaBmi">Индекс массы тела</label><div class="control-row"><input id="mnaBmi" inputmode="decimal" placeholder="Например, 22,4" required/><span class="unit-static">кг/м²</span></div><p class="help">Введите ИМТ без предварительного округления. <a href="#bmi">Рассчитать ИМТ</a></p></div><div class="field full" id="mnaCalfPanel" hidden><label for="mnaCalf">Окружность голени</label><div class="control-row"><input id="mnaCalf" inputmode="decimal" placeholder="Например, 31" disabled/><span class="unit-static">см</span></div><p class="help">Только если ИМТ недоступен. Измерение — в наиболее широкой части голени; соблюдайте методику официального руководства.</p></div></div>`, 14,
      `<p>Сумма A–E и одного варианта F: максимум 14. ИМТ: &lt;19 → 0; 19–&lt;21 → 1; 21–&lt;23 → 2; ≥23 → 3. Если ИМТ недоступен: окружность голени &lt;31 см → 0, ≥31 см → 3. F1 и F2 никогда не складываются.</p><p>12–14 — нормальный нутритивный статус; 8–11 — риск недостаточности питания; 0–7 — недостаточность питания по шкале. Не применяйте пороги полной 30-балльной MNA.</p><p><a href="https://www.mna-elderly.com/sites/default/files/2021-10/mna-guide-english-sf.pdf" rel="noopener noreferrer">Официальное руководство</a> · <a href="https://www.mna-elderly.com/mna-forms" rel="noopener noreferrer">Бланки и условия использования</a>. MNA® — зарегистрированный товарный знак Société des Produits Nestlé S.A. Сам бланк и его перевод в приложении не воспроизводятся. Для использования электронной анкеты требуется согласовать права с правообладателем.</p>`);
    return `<section class="calculator-group" data-category="geriatrics" id="group-geriatrics"><header class="calculator-group-header"><span class="calculator-group-icon">◎</span><div class="calculator-group-copy"><h2>Гериатрия</h2><p>Повседневная активность и питание.</p></div></header><div class="calculator-group-grid">${barthel}${mna}</div></section>`;
  }

  function mount() {
    document.getElementById("calculatorContent").insertAdjacentHTML("beforeend", markup());
    const group = document.querySelector('[data-nav-group="mental"]');
    group.insertAdjacentHTML("afterend", `<section class="nav-group" data-nav-group="geriatrics"><div class="nav-group-heading"><span class="nav-group-icon">◎</span><span class="nav-group-copy"><strong>Гериатрия</strong></span></div><div class="nav-group-items">${[["barthel", "Индекс Бартел", "Самообслуживание", "БИ"], ["mna", "MNA-SF", "Нутритивный скрининг", "MN"]].map(([id, title, subtitle, icon]) => `<button class="nav-button" data-target="${id}" data-search="${document.getElementById(id).dataset.search}" type="button"><span class="mini-icon sage"><span class="mini-glyph">${icon}</span></span><span class="nav-copy"><strong>${title}</strong><small>${subtitle}</small></span></button>`).join("")}</div></section>`);
    document.querySelector(".mobile-category-nav").insertAdjacentHTML("beforeend", '<a class="mobile-category-link" href="#group-geriatrics"><span>◎</span><strong>Гериатрия</strong></a>');
    function updateMode() {
      const bmi = document.getElementById("mnaMode").value === "bmi";
      for (const [key, enabled] of [["Bmi", bmi], ["Calf", !bmi]]) {
        document.getElementById("mna" + key + "Panel").hidden = !enabled;
        document.getElementById("mna" + key).disabled = !enabled;
        document.getElementById("mna" + key).required = enabled;
      }
    }
    document.getElementById("mnaMode").addEventListener("change", updateMode);
    document.getElementById("mnaForm").addEventListener("reset", () => requestAnimationFrame(updateMode));
    updateMode();
    // Native selects may clip long answers. Show the selected clinical text below.
    document.querySelectorAll("#barthelForm select").forEach(select => {
      const answer = document.getElementById(select.id + "Answer");
      const update = () => {
        answer.hidden = select.value === "" || select.selectedOptions[0].textContent.length < 32;
        answer.textContent = select.value === "" ? "" : select.selectedOptions[0].textContent;
      };
      select.addEventListener("change", update);
      select.closest("form").addEventListener("reset", () => requestAnimationFrame(update));
      update();
    });
    // Keep partially completed forms when opening a source in a web browser.
    // Android routes these same links to the external browser itself.
    if (!window.MedCalcAndroid) document.querySelectorAll('#group-geriatrics a[href^="https:"]').forEach(link => { link.target = "_blank"; });
  }
  return { barthelItems, mnaPoints, notes, scoreBarthel, scoreMna, barthelCategory, mnaCategory, calculateBarthel, calculateMna, markup, mount };
})();
