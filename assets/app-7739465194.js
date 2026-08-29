"use strict";

    const state = {
      results: {
        bmi: null, egfr: null, egfrcys: null, mentzer: null, tsat: null,
        score2: null, prevent: null, cadptp: null, dlcn: null, afstroke: null,
        hasbled: null, grace: null, precisedapt: null, qtc: null, vte: null,
        pneumonia: null, sorethroat: null, electrolytes: null, fib4: null,
        maf5: null, liverpro: null, adapt: null, stopbang: null, epworth: null,
        frax: null, phq9: null, gad7: null, mmse: null
      }
    };

    function parseNumber(value) {
      if (typeof value !== "string") return NaN;
      const normalized = value
        .trim()
        .replace(/[−–—]/g, "-")
        .replace(/[\u00a0\u202f]/g, " ");
      const localizedDecimal = /^[+-]?(?:(?:\d{1,3}(?: \d{3})+|\d+)(?:[.,]\d+)?|[.,]\d+)$/;
      if (!localizedDecimal.test(normalized)) return NaN;
      return Number(normalized.replace(/ /g, "").replace(",", "."));
    }

    const numberFormatters = new Map();

    function formatNumber(value, digits = 1) {
      if (!numberFormatters.has(digits)) {
        numberFormatters.set(digits, new Intl.NumberFormat("ru-RU", {
          minimumFractionDigits: digits,
          maximumFractionDigits: digits
        }));
      }
      return numberFormatters.get(digits).format(value);
    }

    function setResult(key, valueText, interpretation, tone, note, copyText) {
      const result = document.getElementById(key + "Result");
      const interpretationEl = document.getElementById(key + "Interpretation");
      const noteEl = document.getElementById(key + "Note");
      const copyButton = document.querySelector('[data-copy="' + key + '"]');

      result.textContent = valueText;
      interpretationEl.textContent = interpretation;
      interpretationEl.className = "result-interpretation" + (tone ? " " + tone : "");
      noteEl.textContent = note || "";

      state.results[key] = copyText || null;
      copyButton.disabled = !copyText;
    }

    function setError(key, message) {
      const error = document.getElementById(key + "Error");
      if (message) {
        clearResult(key, "Исправьте исходные данные.");
        error.textContent = message;
      } else {
        error.textContent = "";
      }
    }

    function clearResult(key, message) {
      const defaultNotes = {
        bmi: "Категории предназначены для скрининговой оценки взрослых и не отражают состав тела.",
        egfr: "Одно значение СКФ не устанавливает диагноз ХБП. Важны повторные измерения, длительность изменений и альбуминурия.",
        mentzer: "Это ориентир при микроцитозе, а не самостоятельный диагностический тест.",
        tsat: "Интерпретируйте вместе с ферритином, воспалительными маркерами и клиническим контекстом; референсы лабораторий различаются.",
        score2: "Для людей 40–69 лет без установленного ССЗ и сахарного диабета. Для ≥70 лет требуется SCORE2-OP.",
        prevent: "Total CVD включает ASCVD и сердечную недостаточность. Используется базовая модель без дополнительных предикторов.",
        phq9: "Скрининговая шкала не устанавливает диагноз. Положительный ответ на пункт 9 требует отдельной оценки безопасности.",
        gad7: "Скрининговая шкала отражает выраженность симптомов, но не заменяет клиническую диагностику.",
        mmse: "Результат зависит от возраста, образования, языка, слуха, зрения, моторных ограничений и условий проведения.",
        fib4: "Точность ниже в возрасте до 35 лет; после 65 лет используется более высокий нижний порог.",
        maf5: "Возраст не входит в формулу. Шкала разрабатывалась для популяции с метаболической дисфункцией.",
        liverpro: "Алгоритм не рассчитывается локально: доступна интерпретация готовой сертифицированной вероятности.",
        adapt: "Используйте только значение Elecsys PRO-C3: результаты других методов нельзя подставлять в эту версию.",
        stopbang: "Шкала оценивает вероятность СОАС, но не подтверждает диагноз.",
        epworth: "Шкала оценивает субъективную дневную сонливость, но не определяет её причину.",
        afstroke: "Балльная шкала не заменяет оценку показаний, противопоказаний и предпочтений пациента.",
        vte: "Алгоритмы применяются только в соответствующем клиническом контексте.",
        pneumonia: "Шкала дополняет клиническую оценку тяжести пневмонии.",
        sorethroat: "Решение об антибиотике зависит от клинической ситуации и локальных рекомендаций.",
        qtc: "Bazett может искажать результат при выраженной тахикардии или брадикардии.",
        electrolytes: "Расчётные показатели необходимо сопоставлять с методом лаборатории и клинической ситуацией.",
        grace: "Балльная модель поддерживает стратификацию риска, но не должна задерживать неотложное лечение.",
        hasbled: "Высокий балл не является самостоятельной причиной отказа от антикоагуляции.",
        cadptp: "Базовая модель не учитывает факторы риска и коронарный кальций.",
        dlcn: "Используйте нелеченое значение LDL-C.",
        precisedapt: "Порог ≥25 указывает на высокий риск кровотечения.",
        frax: "10-летняя вероятность зависит от страны и рассчитывается в официальной модели.",
        egfrcys: "Одно значение СКФ не устанавливает диагноз ХБП. Учитывайте альбуминурию, хронический характер изменений и факторы, влияющие на оба маркера."
      };
      setResult(key, "—", message, "", defaultNotes[key], null);
      setError(key, "");
    }

    function calculateBmi() {
      setError("bmi", "");
      const weightRaw = parseNumber(document.getElementById("bmiWeight").value);
      const heightRaw = parseNumber(document.getElementById("bmiHeight").value);
      const weightUnit = document.getElementById("bmiWeightUnit").value;
      const heightUnit = document.getElementById("bmiHeightUnit").value;

      if (!Number.isFinite(weightRaw) || !Number.isFinite(heightRaw)) {
        setError("bmi", "Заполните массу тела и рост числовыми значениями.");
        return false;
      }
      if (weightRaw <= 0 || heightRaw <= 0) {
        setError("bmi", "Масса тела и рост должны быть больше нуля.");
        return false;
      }

      const weightKg = weightUnit === "lb" ? weightRaw * 0.45359237 : weightRaw;
      let heightM = heightRaw;
      if (heightUnit === "cm") heightM = heightRaw / 100;
      if (heightUnit === "in") heightM = heightRaw * 0.0254;

      if (weightKg < 10 || weightKg > 500 || heightM < 0.5 || heightM > 2.7) {
        setError("bmi", "Проверьте введённые значения и выбранные единицы.");
        return false;
      }

      const bmi = weightKg / (heightM * heightM);
      let interpretation = "";
      let tone = "";

      if (bmi < 18.5) {
        interpretation = "Дефицит массы тела.";
        tone = "warning";
      } else if (bmi < 25) {
        interpretation = "Нормальный диапазон массы тела.";
        tone = "good";
      } else if (bmi < 30) {
        interpretation = "Избыточная масса тела.";
        tone = "warning";
      } else if (bmi < 35) {
        interpretation = "Ожирение I степени.";
        tone = "danger";
      } else if (bmi < 40) {
        interpretation = "Ожирение II степени.";
        tone = "danger";
      } else {
        interpretation = "Ожирение III степени.";
        tone = "danger";
      }

      const valueText = formatNumber(bmi, 1);
      setResult(
        "bmi",
        valueText,
        interpretation,
        tone,
        "ИМТ — скрининговый показатель. У спортсменов, пожилых людей и при изменённом составе тела его точность ограничена.",
        "ИМТ: " + valueText + " кг/м² — " + interpretation
      );
      return true;
    }

    function calculateEgfr() {
      setError("egfr", "");
      const age = parseNumber(document.getElementById("egfrAge").value);
      const creatinineRaw = parseNumber(document.getElementById("egfrCreatinine").value);
      const unit = document.getElementById("egfrCreatinineUnit").value;
      const sexInput = document.querySelector('input[name="egfrSex"]:checked');

      if (!Number.isFinite(age) || !Number.isFinite(creatinineRaw) || !sexInput) {
        setError("egfr", "Укажите возраст, пол и креатинин.");
        return false;
      }
      if (age < 18 || age > 120) {
        setError("egfr", "Формула предназначена для взрослых 18 лет и старше.");
        return false;
      }
      if (creatinineRaw <= 0) {
        setError("egfr", "Креатинин должен быть больше нуля.");
        return false;
      }

      const scr = unit === "umol" ? creatinineRaw / 88.4 : creatinineRaw;
      if (scr < 0.1 || scr > 20) {
        setError("egfr", "Проверьте значение креатинина и выбранные единицы.");
        return false;
      }

      const female = sexInput.value === "female";
      const kappa = female ? 0.7 : 0.9;
      const alpha = female ? -0.241 : -0.302;
      const ratio = scr / kappa;

      let egfr = 142
        * Math.pow(Math.min(ratio, 1), alpha)
        * Math.pow(Math.max(ratio, 1), -1.2)
        * Math.pow(0.9938, age);

      if (female) egfr *= 1.012;

      let category = "";
      let description = "";
      let tone = "";

      if (egfr >= 90) {
        category = "G1";
        description = "нормальная или высокая СКФ";
        tone = "good";
      } else if (egfr >= 60) {
        category = "G2";
        description = "незначительно сниженная СКФ";
        tone = "good";
      } else if (egfr >= 45) {
        category = "G3a";
        description = "умеренно сниженная СКФ";
        tone = "warning";
      } else if (egfr >= 30) {
        category = "G3b";
        description = "умеренно–значительно сниженная СКФ";
        tone = "warning";
      } else if (egfr >= 15) {
        category = "G4";
        description = "значительно сниженная СКФ";
        tone = "danger";
      } else {
        category = "G5";
        description = "категория почечной недостаточности";
        tone = "danger";
      }

      const rounded = Math.round(egfr);
      const interpretation = category + " — " + description + ".";
      setResult(
        "egfr",
        String(rounded),
        interpretation,
        tone,
        "Диагноз ХБП требует оценки хронического характера изменений и маркеров повреждения почек, включая альбуминурию.",
        "рСКФ по CKD-EPI 2021: " + rounded + " мл/мин/1,73 м²; категория " + category + " — " + description + "."
      );
      return true;
    }

    function calculateMentzer() {
      setError("mentzer", "");
      const mcv = parseNumber(document.getElementById("mentzerMcv").value);
      const rbc = parseNumber(document.getElementById("mentzerRbc").value);

      if (!Number.isFinite(mcv) || !Number.isFinite(rbc)) {
        setError("mentzer", "Заполните MCV и число эритроцитов.");
        return false;
      }
      if (mcv <= 0 || rbc <= 0) {
        setError("mentzer", "Оба показателя должны быть больше нуля.");
        return false;
      }
      if (mcv < 30 || mcv > 150 || rbc < 1 || rbc > 10) {
        setError("mentzer", "Проверьте значения и единицы измерения.");
        return false;
      }

      const index = mcv / rbc;
      let interpretation = "";
      let tone = "";

      if (index < 13) {
        interpretation = "Результат больше соответствует носительству β-талассемии.";
        tone = "warning";
      } else if (index > 13) {
        interpretation = "Результат больше соответствует железодефицитной анемии.";
        tone = "warning";
      } else {
        interpretation = "Пограничный результат около диагностического порога 13.";
        tone = "warning";
      }

      const valueText = formatNumber(index, 1);
      setResult(
        "mentzer",
        valueText,
        interpretation,
        tone,
        "Индекс применим как ориентир при микроцитозе и не заменяет лабораторное подтверждение.",
        "Индекс Ментцера: " + valueText + ". " + interpretation
      );
      return true;
    }

    function ironToUmol(value, unit) {
      return unit === "ugdl" ? value * 0.17906 : value;
    }

    function calculateTsat() {
      setError("tsat", "");
      const mode = document.querySelector('input[name="tsatMode"]:checked').value;
      let tsat;

      if (mode === "tibc") {
        const ironRaw = parseNumber(document.getElementById("tsatIronTibc").value);
        const tibcRaw = parseNumber(document.getElementById("tsatTibc").value);
        const ironUnit = document.getElementById("tsatIronTibcUnit").value;
        const tibcUnit = document.getElementById("tsatTibcUnit").value;

        if (!Number.isFinite(ironRaw) || !Number.isFinite(tibcRaw)) {
          setError("tsat", "Заполните сывороточное железо и ОЖСС.");
          return false;
        }
        if (ironRaw <= 0 || tibcRaw <= 0) {
          setError("tsat", "Оба показателя должны быть больше нуля.");
          return false;
        }

        const ironUmol = ironToUmol(ironRaw, ironUnit);
        const tibcUmol = ironToUmol(tibcRaw, tibcUnit);
        tsat = (ironUmol / tibcUmol) * 100;
      } else {
        const ironRaw = parseNumber(document.getElementById("tsatIronTf").value);
        const transferrinRaw = parseNumber(document.getElementById("tsatTransferrin").value);
        const ironUnit = document.getElementById("tsatIronTfUnit").value;
        const transferrinUnit = document.getElementById("tsatTransferrinUnit").value;

        if (!Number.isFinite(ironRaw) || !Number.isFinite(transferrinRaw)) {
          setError("tsat", "Заполните сывороточное железо и трансферрин.");
          return false;
        }
        if (ironRaw <= 0 || transferrinRaw <= 0) {
          setError("tsat", "Оба показателя должны быть больше нуля.");
          return false;
        }

        const ironUmol = ironToUmol(ironRaw, ironUnit);
        const transferrinGl = transferrinUnit === "mgdl" ? transferrinRaw * 0.01 : transferrinRaw;
        tsat = (ironUmol * 3.98) / transferrinGl;
      }

      if (!Number.isFinite(tsat) || tsat <= 0 || tsat > 100) {
        setError("tsat", "Получено неправдоподобное значение. Проверьте показатели и единицы.");
        return false;
      }

      let interpretation = "";
      let tone = "";

      if (tsat < 20) {
        interpretation = "Сниженное насыщение трансферрина; возможно ограничение доступности железа.";
        tone = "warning";
      } else if (tsat <= 45) {
        interpretation = "Ориентировочно в распространённом референсном диапазоне.";
        tone = "good";
      } else {
        interpretation = "Повышенное насыщение трансферрина; оцените клинический контекст и повторяемость результата.";
        tone = "warning";
      }

      const valueText = formatNumber(tsat, 1);
      setResult(
        "tsat",
        valueText,
        interpretation,
        tone,
        "Пороговые значения зависят от клинической задачи и лаборатории.",
        "Насыщение трансферрина: " + valueText + "%. " + interpretation
      );
      return true;
    }


    function cholesterolToMmol(value, unit) {
      return unit === "mgdl" ? value * 0.02586 : value;
    }

    function cholesterolToMgdl(value, unit) {
      return unit === "mmol" ? value / 0.02586 : value;
    }

    function calculateScore2() {
      setError("score2", "");

      const age = parseNumber(document.getElementById("score2Age").value);
      const sbp = parseNumber(document.getElementById("score2Sbp").value);
      const tcRaw = parseNumber(document.getElementById("score2Tc").value);
      const hdlRaw = parseNumber(document.getElementById("score2Hdl").value);
      const sexInput = document.querySelector('input[name="score2Sex"]:checked');
      const smoking = Number(document.querySelector('input[name="score2Smoking"]:checked').value);
      const region = document.getElementById("score2Region").value;
      const tcUnit = document.getElementById("score2TcUnit").value;
      const hdlUnit = document.getElementById("score2HdlUnit").value;

      if (![age, sbp, tcRaw, hdlRaw].every(Number.isFinite) || !sexInput || !region) {
        setError("score2", "Укажите возраст, пол, регион риска, АД, общий холестерин и ЛПВП.");
        return false;
      }
      if (age < 40 || age > 69) {
        setError("score2", "SCORE2 предназначен для возраста 40–69 лет.");
        return false;
      }
      if (sbp < 80 || sbp > 240) {
        setError("score2", "Проверьте систолическое АД.");
        return false;
      }

      const tc = cholesterolToMmol(tcRaw, tcUnit);
      const hdl = cholesterolToMmol(hdlRaw, hdlUnit);

      if (tc < 2 || tc > 12 || hdl < 0.3 || hdl > 4 || hdl >= tc) {
        setError("score2", "Проверьте показатели холестерина и выбранные единицы.");
        return false;
      }

      const ageT = (age - 60) / 5;
      const sbpT = (sbp - 120) / 20;
      const tcT = tc - 6;
      const hdlT = (hdl - 1.3) / 0.5;
      const female = sexInput.value === "female";

      let z;
      let baseRisk;

      if (female) {
        z =
          0.4648 * ageT +
          0.7744 * smoking +
          0.3131 * sbpT +
          0.1002 * tcT -
          0.2606 * hdlT -
          0.1088 * ageT * smoking -
          0.0277 * ageT * sbpT -
          0.0226 * ageT * tcT +
          0.0613 * ageT * hdlT;
        baseRisk = 1 - Math.pow(0.9776, Math.exp(z));
      } else {
        z =
          0.3742 * ageT +
          0.6012 * smoking +
          0.2777 * sbpT +
          0.1458 * tcT -
          0.2698 * hdlT -
          0.0755 * ageT * smoking -
          0.0255 * ageT * sbpT -
          0.0281 * ageT * tcT +
          0.0426 * ageT * hdlT;
        baseRisk = 1 - Math.pow(0.9605, Math.exp(z));
      }

      const calibration = {
        low: {
          male: [-0.5699, 0.7476],
          female: [-0.7380, 0.7019]
        },
        moderate: {
          male: [-0.1565, 0.8009],
          female: [-0.3143, 0.7701]
        },
        high: {
          male: [0.3207, 0.9360],
          female: [0.5710, 0.9369]
        },
        veryHigh: {
          male: [0.5836, 0.8294],
          female: [0.9412, 0.8329]
        }
      };

      const [scale1, scale2] = calibration[region][female ? "female" : "male"];
      const calibratedRisk =
        1 - Math.exp(-Math.exp(scale1 + scale2 * Math.log(-Math.log(1 - baseRisk))));
      const percent = calibratedRisk * 100;

      let category;
      let tone;
      if (age < 50) {
        if (percent < 2.5) {
          category = "Низкий–умеренный риск.";
          tone = "good";
        } else if (percent < 7.5) {
          category = "Высокий риск.";
          tone = "warning";
        } else {
          category = "Очень высокий риск.";
          tone = "danger";
        }
      } else {
        if (percent < 5) {
          category = "Низкий–умеренный риск.";
          tone = "good";
        } else if (percent < 10) {
          category = "Высокий риск.";
          tone = "warning";
        } else {
          category = "Очень высокий риск.";
          tone = "danger";
        }
      }

      const valueText = formatNumber(percent, 1);
      const regionNames = {
        low: "низкий",
        moderate: "умеренный",
        high: "высокий",
        veryHigh: "очень высокий"
      };

      setResult(
        "score2",
        valueText,
        category,
        tone,
        "Региональная калибровка: " + regionNames[region] + " риск. Результат нужно использовать вместе с клиническими модификаторами риска.",
        "SCORE2: " + valueText + "% за 10 лет — " + category + " Регион риска: " + regionNames[region] + "."
      );
      return true;
    }

    const PREVENT_COEFFICIENTS = {
      female: {
        cvd: [
          0.7939329, 0, 0.0305239, -0.1606857, -0.2394003, 0.3600781,
          0.8667604, 0.5360739, 0, 0, 0.6045917, 0.0433769,
          0.3151672, -0.1477655, -0.0663612, 0.1197879,
          -0.0819715, 0.0306769, -0.0946348, -0.27057,
          -0.078715, 0, -0.1637806, -3.307728
        ],
        ascvd: [
          0.719883, 0, 0.1176967, -0.151185, -0.0835358, 0.3592852,
          0.8348585, 0.4831078, 0, 0, 0.4864619, 0.0397779,
          0.2265309, -0.0592374, -0.0395762, 0.0844423,
          -0.0567839, 0.0325692, -0.1035985, -0.2417542,
          -0.0791142, 0, -0.1671492, -3.819975
        ]
      },
      male: {
        cvd: [
          0.7688528, 0, 0.0736174, -0.0954431, -0.4347345, 0.3362658,
          0.7692857, 0.4386871, 0, 0, 0.5378979, 0.0164827,
          0.288879, -0.1337349, -0.0475924, 0.150273,
          -0.0517874, 0.0191169, -0.1049477, -0.2251948,
          -0.0895067, 0, -0.1543702, -3.031168
        ],
        ascvd: [
          0.7099847, 0, 0.1658663, -0.1144285, -0.2837212, 0.3239977,
          0.7189597, 0.3956973, 0, 0, 0.3690075, 0.0203619,
          0.2036522, -0.0865581, -0.0322916, 0.114563,
          -0.0300005, 0.0232747, -0.0927024, -0.2018525,
          -0.0970527, 0, -0.1217081, -3.500655
        ]
      }
    };

    function preventRisk(coefficients, predictors) {
      let linearPredictor = coefficients[coefficients.length - 1];
      for (let i = 0; i < predictors.length; i += 1) {
        linearPredictor += coefficients[i] * predictors[i];
      }
      return 1 / (1 + Math.exp(-linearPredictor));
    }

    function calculatePrevent() {
      setError("prevent", "");

      const age = parseNumber(document.getElementById("preventAge").value);
      const sbp = parseNumber(document.getElementById("preventSbp").value);
      const bmi = parseNumber(document.getElementById("preventBmi").value);
      const egfr = parseNumber(document.getElementById("preventEgfr").value);
      const tcRaw = parseNumber(document.getElementById("preventTc").value);
      const hdlRaw = parseNumber(document.getElementById("preventHdl").value);
      const sexInput = document.querySelector('input[name="preventSex"]:checked');
      const tcUnit = document.getElementById("preventTcUnit").value;
      const hdlUnit = document.getElementById("preventHdlUnit").value;
      const smoking = Number(document.querySelector('input[name="preventSmoking"]:checked').value);
      const diabetes = Number(document.querySelector('input[name="preventDiabetes"]:checked').value);
      const bpTx = Number(document.querySelector('input[name="preventBpTx"]:checked').value);
      const statin = Number(document.querySelector('input[name="preventStatin"]:checked').value);

      if (![age, sbp, bmi, egfr, tcRaw, hdlRaw].every(Number.isFinite) || !sexInput) {
        setError("prevent", "Заполните все числовые поля и укажите пол.");
        return false;
      }
      if (age < 30 || age > 79) {
        setError("prevent", "PREVENT предназначен для возраста 30–79 лет.");
        return false;
      }
      if (sbp < 90 || sbp > 200) {
        setError("prevent", "Систолическое АД должно быть в диапазоне 90–200 мм рт. ст.");
        return false;
      }
      if (bmi < 18.5 || bmi >= 40) {
        setError("prevent", "ИМТ должен быть в диапазоне 18,5–39,9 кг/м².");
        return false;
      }
      if (egfr < 15 || egfr > 140) {
        setError("prevent", "СКФ должна быть в диапазоне 15–140 мл/мин/1,73 м².");
        return false;
      }

      const tcMgdl = cholesterolToMgdl(tcRaw, tcUnit);
      const hdlMgdl = cholesterolToMgdl(hdlRaw, hdlUnit);

      if (tcMgdl < 130 || tcMgdl > 320 || hdlMgdl < 20 || hdlMgdl > 100 || hdlMgdl >= tcMgdl) {
        setError("prevent", "Проверьте показатели холестерина и выбранные единицы.");
        return false;
      }

      const ageT = (age - 55) / 10;
      const nonHdl = (tcMgdl - hdlMgdl) * 0.02586 - 3.5;
      const hdlT = (hdlMgdl * 0.02586 - 1.3) / 0.3;
      const sbpLt = (Math.min(sbp, 110) - 110) / 20;
      const sbpGe = (Math.max(sbp, 110) - 130) / 20;
      const bmiLt = (Math.min(bmi, 30) - 25) / 5;
      const bmiGt = (Math.max(bmi, 30) - 30) / 5;
      const egfrLt = (Math.min(egfr, 60) - 60) / -15;
      const egfrGe = (Math.max(egfr, 60) - 90) / -15;

      const predictors = [
        ageT,
        ageT * ageT,
        nonHdl,
        hdlT,
        sbpLt,
        sbpGe,
        diabetes,
        smoking,
        bmiLt,
        bmiGt,
        egfrLt,
        egfrGe,
        bpTx,
        statin,
        sbpGe * bpTx,
        nonHdl * statin,
        ageT * nonHdl,
        ageT * hdlT,
        ageT * sbpGe,
        ageT * diabetes,
        ageT * smoking,
        ageT * bmiGt,
        ageT * egfrLt
      ];

      const sex = sexInput.value;
      const totalCvd = preventRisk(PREVENT_COEFFICIENTS[sex].cvd, predictors) * 100;
      const ascvd = preventRisk(PREVENT_COEFFICIENTS[sex].ascvd, predictors) * 100;
      const totalText = formatNumber(totalCvd, 1);
      const ascvdText = formatNumber(ascvd, 1);

      setResult(
        "prevent",
        totalText,
        "ASCVD за 10 лет: " + ascvdText + "%.",
        "",
        "Total CVD включает ASCVD и сердечную недостаточность. Риск сердечной недостаточности отдельно в этой версии не выводится.",
        "PREVENT, 10 лет: Total CVD " + totalText + "%; ASCVD " + ascvdText + "%."
      );
      return true;
    }


    function readSelectValues(prefix, count) {
      const values = [];
      for (let i = 1; i <= count; i += 1) {
        const element = document.getElementById(prefix + i);
        if (!element || element.value === "") return null;
        const value = Number(element.value);
        if (!Number.isFinite(value)) return null;
        values.push(value);
      }
      return values;
    }

    function sumSelectValues(prefix, count) {
      const values = readSelectValues(prefix, count);
      return values ? values.reduce((total, value) => total + value, 0) : null;
    }

    function calculatePhq9() {
      setError("phq9", "");
      const score = sumSelectValues("phq9q", 9);
      if (score === null) {
        setError("phq9", "Ответьте на все девять вопросов.");
        return false;
      }
      const selfHarm = Number(document.getElementById("phq9q9").value);
      let severity, tone;
      if (score <= 4) { severity = "Минимальные депрессивные симптомы."; tone = "good"; }
      else if (score <= 9) { severity = "Лёгкие депрессивные симптомы."; tone = "warning"; }
      else if (score <= 14) { severity = "Умеренные депрессивные симптомы."; tone = "warning"; }
      else if (score <= 19) { severity = "Умеренно тяжёлые депрессивные симптомы."; tone = "danger"; }
      else { severity = "Тяжёлые депрессивные симптомы."; tone = "danger"; }

      let note = "PHQ-9 — скрининг и оценка тяжести симптомов, а не самостоятельный диагноз.";
      if (selfHarm > 0) {
        severity += " Пункт 9 положительный — требуется отдельная клиническая оценка риска и безопасности.";
        tone = "danger";
        note = "Не откладывайте оценку суицидального риска, намерений, плана, доступности средств и защитных факторов.";
      }

      setResult("phq9", String(score), severity, tone, note, "PHQ-9: " + score + "/27. " + severity);
      return true;
    }

    function calculateGad7() {
      setError("gad7", "");
      const score = sumSelectValues("gad7q", 7);
      if (score === null) {
        setError("gad7", "Ответьте на все семь вопросов.");
        return false;
      }
      let severity, tone;
      if (score <= 4) { severity = "Минимальная тревога."; tone = "good"; }
      else if (score <= 9) { severity = "Лёгкая тревога."; tone = "warning"; }
      else if (score <= 14) { severity = "Умеренная тревога."; tone = "warning"; }
      else { severity = "Тяжёлая тревога."; tone = "danger"; }
      setResult("gad7", String(score), severity, tone, "Оцените функциональное влияние симптомов и клинический контекст.", "GAD-7: " + score + "/21. " + severity);
      return true;
    }

    function calculateMmse() {
      setError("mmse", "");

      const points = Array.from(document.querySelectorAll("#mmseForm .mmse-point"));
      if (points.length !== 30) {
        setError("mmse", "Не удалось проверить структуру формы MMSE.");
        return false;
      }

      const total = points.reduce((sum, input) => sum + (input.checked ? 1 : 0), 0);
      let interpretation, tone;

      if (total >= 24) {
        interpretation = "Выраженное когнитивное снижение по суммарному баллу менее вероятно.";
        tone = "good";
      } else if (total >= 20) {
        interpretation = "Возможное лёгкое когнитивное снижение.";
        tone = "warning";
      } else if (total >= 10) {
        interpretation = "Возможное умеренное когнитивное снижение.";
        tone = "warning";
      } else {
        interpretation = "Выраженное снижение по суммарному результату.";
        tone = "danger";
      }

      setResult(
        "mmse",
        String(total),
        interpretation,
        tone,
        "Интерпретируйте результат с учётом образования, языка, слуха, зрения, моторных ограничений, делирия и депрессии.",
        "MMSE: " + total + "/30. " + interpretation
      );
      return true;
    }

    function calculateFib4() {
      setError("fib4", "");
      const age = parseNumber(document.getElementById("fib4Age").value);
      const ast = parseNumber(document.getElementById("fib4Ast").value);
      const alt = parseNumber(document.getElementById("fib4Alt").value);
      const platelets = parseNumber(document.getElementById("fib4Platelets").value);
      if (![age,ast,alt,platelets].every(Number.isFinite)) {
        setError("fib4", "Заполните возраст, АСТ, АЛТ и тромбоциты.");
        return false;
      }
      if (age < 18 || age > 100 || ast <= 0 || alt <= 0 || platelets <= 0) {
        setError("fib4", "Проверьте исходные значения.");
        return false;
      }
      const score = age * ast / (platelets * Math.sqrt(alt));
      let interpretation, tone, note;
      if (age < 35) {
        note = "В возрасте до 35 лет FIB-4 имеет низкую точность; рассмотрите альтернативную оценку.";
      } else if (age > 65) {
        note = "Для возраста >65 лет использован нижний порог 2,0.";
      } else {
        note = "Для возраста 35–65 лет использован нижний порог 1,3.";
      }
      const lower = age > 65 ? 2.0 : 1.3;
      if (score < lower) { interpretation = "Низкий риск продвинутого фиброза."; tone = "good"; }
      else if (score <= 2.67) { interpretation = "Промежуточный результат — требуется вторичная оценка."; tone = "warning"; }
      else { interpretation = "Высокий риск продвинутого фиброза."; tone = "danger"; }
      const valueText = formatNumber(score, 2);
      setResult("fib4", valueText, interpretation, tone, note, "FIB-4: " + valueText + ". " + interpretation);
      return true;
    }

    function calculateMaf5() {
      setError("maf5", "");
      const waistRaw = parseNumber(document.getElementById("maf5Waist").value);
      const waistUnit = document.getElementById("maf5WaistUnit").value;
      const waist = waistUnit === "in" ? waistRaw * 2.54 : waistRaw;
      const bmi = parseNumber(document.getElementById("maf5Bmi").value);
      const ast = parseNumber(document.getElementById("maf5Ast").value);
      const platelets = parseNumber(document.getElementById("maf5Platelets").value);
      const diabetes = Number(document.querySelector('input[name="maf5Diabetes"]:checked').value);
      if (![waist,bmi,ast,platelets].every(Number.isFinite)) {
        setError("maf5", "Заполните окружность талии, ИМТ, АСТ и тромбоциты.");
        return false;
      }
      if (waist < 40 || waist > 220 || bmi < 10 || bmi > 80 || ast <= 0 || platelets <= 0) {
        setError("maf5", "Проверьте исходные значения.");
        return false;
      }
      const score = -11.3674 + waist*0.0282 - bmi*0.1761 + waist*bmi*0.0019 + diabetes*2.0762 + Math.log(ast)*2.9207 - platelets*0.0059;
      let interpretation, tone;
      if (score < 0) { interpretation = "Низкий риск фиброза."; tone = "good"; }
      else if (score < 1) { interpretation = "Промежуточный риск фиброза."; tone = "warning"; }
      else { interpretation = "Высокий риск фиброза."; tone = "danger"; }
      const valueText = formatNumber(score, 2);
      setResult("maf5", valueText, interpretation, tone, "Результат следует сопоставлять с клинической вероятностью и методами второй линии.", "MAF-5: " + valueText + ". " + interpretation);
      return true;
    }

    function calculateLiverpro() {
      setError("liverpro", "");
      const value = parseNumber(document.getElementById("liverproValue").value);
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        setError("liverpro", "Введите вероятность от 0 до 100%.");
        return false;
      }
      let interpretation, tone;
      if (value < 25) { interpretation = "Rule-out: низкая вероятность клинически значимого фиброза."; tone = "good"; }
      else if (value <= 65) { interpretation = "Промежуточная зона — требуется дальнейшая оценка."; tone = "warning"; }
      else { interpretation = "Rule-in: высокая вероятность клинически значимого фиброза."; tone = "danger"; }
      const valueText = formatNumber(value, 1);
      setResult("liverpro", valueText, interpretation, tone, "Это интерпретация готового результата, а не независимый расчёт LiverPRO.", "LiverPRO: " + valueText + "%. " + interpretation);
      return true;
    }

    function calculateAdapt() {
      setError("adapt", "");
      const age = parseNumber(document.getElementById("adaptAge").value);
      const proc3 = parseNumber(document.getElementById("adaptProc3").value);
      const platelets = parseNumber(document.getElementById("adaptPlatelets").value);
      const diabetes = Number(document.querySelector('input[name="adaptDiabetes"]:checked').value);
      if (![age,proc3,platelets].every(Number.isFinite)) {
        setError("adapt", "Заполните возраст, PRO-C3 и тромбоциты.");
        return false;
      }
      if (age < 18 || age > 100 || proc3 <= 0 || proc3 > 500 || platelets < 5 || platelets > 3500) {
        setError("adapt", "Проверьте диапазоны исходных данных.");
        return false;
      }
      const effectiveProc3 = Math.max(proc3, 20);
      const score = Math.exp(Math.log10((age * effectiveProc3) / Math.sqrt(platelets))) + diabetes;
      let interpretation, tone;
      if (score < 9) { interpretation = "Нет или лёгкий фиброз (F0–F1)."; tone = "good"; }
      else if (score < 10) { interpretation = "Риск как минимум значимого фиброза (F2–F4)."; tone = "warning"; }
      else if (score < 11) { interpretation = "Риск продвинутого фиброза (F3–F4)."; tone = "danger"; }
      else { interpretation = "Высокий риск цирроза (F4)."; tone = "danger"; }
      const valueText = formatNumber(score, 3);
      setResult("adapt", valueText, interpretation, tone, proc3 < 20 ? "Значение PRO-C3 ниже LoQ автоматически установлено равным 20 нг/мл." : "Интерпретируйте вместе с другими методами согласно клиническим рекомендациям.", "ADAPT: " + valueText + ". " + interpretation);
      return true;
    }

    function calculateStopbang() {
      setError("stopbang", "");
      const answers = readSelectValues("stopbang", 8);
      if (!answers) {
        setError("stopbang", "Ответьте на все восемь вопросов.");
        return false;
      }
      const score = answers.reduce((total, value) => total + value, 0);
      const stopSubtotal = answers.slice(0, 4).reduce((total, value) => total + value, 0);
      const highRiskCombination = stopSubtotal >= 2 && Boolean(answers[4] || answers[6] || answers[7]);
      let interpretation, tone;
      if (score <= 2) { interpretation = "Низкий риск обструктивного апноэ сна."; tone = "good"; }
      else if (score >= 5 || highRiskCombination) { interpretation = "Высокий риск обструктивного апноэ сна."; tone = "danger"; }
      else { interpretation = "Промежуточный риск обструктивного апноэ сна."; tone = "warning"; }
      setResult("stopbang", String(score), interpretation, tone, "Результат определяет необходимость дальнейшей клинической оценки, но не заменяет исследование сна.", "STOP-Bang: " + score + "/8. " + interpretation);
      return true;
    }

    function calculateEpworth() {
      setError("epworth", "");

      const answers = [];
      for (let i = 1; i <= 8; i += 1) {
        const value = document.getElementById("epworth" + i).value;
        if (value === "") {
          setError("epworth", "Ответь на все восемь вопросов.");
          return false;
        }
        answers.push(Number(value));
      }

      const score = answers.reduce((sum, value) => sum + value, 0);
      let interpretation, tone;

      if (score <= 10) {
        interpretation = "Обычный диапазон дневной сонливости.";
        tone = "good";
      } else if (score <= 12) {
        interpretation = "Лёгкая чрезмерная дневная сонливость.";
        tone = "warning";
      } else if (score <= 15) {
        interpretation = "Умеренная чрезмерная дневная сонливость.";
        tone = "warning";
      } else {
        interpretation = "Выраженная чрезмерная дневная сонливость.";
        tone = "danger";
      }

      setResult(
        "epworth",
        String(score),
        interpretation,
        tone,
        "Оцените длительность сна, лекарства, циркадные факторы, симптомы апноэ и другие возможные причины сонливости.",
        "Шкала сонливости Эпворта: " + score + "/24. " + interpretation
      );
      return true;
    }


    function countChecked(ids, values) {
      return ids.reduce((sum, id, index) => sum + (document.getElementById(id).checked ? values[index] : 0), 0);
    }

    function calculateAfstroke() {
      setError("afstroke", "");
      const age = parseNumber(document.getElementById("afAge").value);
      const sex = document.querySelector('input[name="afSex"]:checked');
      if (!Number.isFinite(age) || age < 18 || age > 120 || !sex) {
        setError("afstroke", "Укажите корректный возраст и пол.");
        return false;
      }
      let va = 0;
      if (document.getElementById("afChf").checked) va += 1;
      if (document.getElementById("afHtn").checked) va += 1;
      if (document.getElementById("afDiabetes").checked) va += 1;
      if (document.getElementById("afStroke").checked) va += 2;
      if (document.getElementById("afVascular").checked) va += 1;
      if (age >= 75) va += 2;
      else if (age >= 65) va += 1;
      const vasc = va + (sex.value === "female" ? 1 : 0);
      let text, tone;
      if (va === 0) { text = "Факторы риска по шкале отсутствуют."; tone = "good"; }
      else if (va === 1) { text = "Один фактор риска: требуется индивидуальная оценка профилактики инсульта."; tone = "warning"; }
      else { text = "Несколько факторов риска: обсудите стратегию профилактики инсульта."; tone = "warning"; }
      setResult("afstroke", String(va), text + " CHA₂DS₂-VASc: " + vasc + ".", tone,
        "Баллы отражают только клинические факторы риска и не оценивают риск кровотечения.",
        "CHA₂DS₂-VA: " + va + "; CHA₂DS₂-VASc: " + vasc + ".");
      return true;
    }

    function setModePanels(selector, map, value) {
      Object.entries(map).forEach(([mode, id]) => {
        const panel = document.getElementById(id);
        if (panel) panel.hidden = mode !== value;
      });
    }

    function calculateVte() {
      setError("vte", "");
      const mode = document.querySelector('input[name="vteMode"]:checked').value;
      const unitEl = document.getElementById("vteResultUnit");
      let valueText = "", interpretation = "", tone = "", note = "", copy = "";

      if (mode === "pe") {
        const score =
          countChecked(["vtePeDvtSigns","vtePeAltLess","vtePeHr","vtePeImmobil","vtePePrevious","vtePeHemoptysis","vtePeCancer"],
                       [3,3,1.5,1.5,1.5,1,1]);
        valueText = formatNumber(score, score % 1 ? 1 : 0);
        unitEl.textContent = "баллов";
        if (score > 4) {
          interpretation = "ТЭЛА вероятна по двухуровневой модели Wells.";
          tone = "danger";
          note = "Обычно требуется немедленная визуализация по принятому диагностическому алгоритму.";
        } else {
          interpretation = "ТЭЛА маловероятна по двухуровневой модели Wells.";
          tone = "warning";
          note = "Обычно следующим этапом является чувствительный D-димер с учётом возраста.";
        }
        copy = "Wells ТЭЛА: " + valueText + ". " + interpretation;
      } else if (mode === "dvt") {
        const score = countChecked(
          ["vteDvtCancer","vteDvtParalysis","vteDvtBed","vteDvtTender","vteDvtWholeLeg","vteDvtCalf","vteDvtPitting","vteDvtCollateral","vteDvtPrevious","vteDvtAlternative"],
          [1,1,1,1,1,1,1,1,1,-2]
        );
        valueText = String(score);
        unitEl.textContent = "баллов";
        if (score >= 2) {
          interpretation = "ТГВ вероятен по двухуровневой модели Wells.";
          tone = "danger";
          note = "Требуется дальнейшее обследование в соответствии с диагностическим алгоритмом.";
        } else {
          interpretation = "ТГВ маловероятен по двухуровневой модели Wells.";
          tone = "warning";
          note = "Обычно следующим этапом является D-димер.";
        }
        copy = "Wells ТГВ: " + score + ". " + interpretation;
      } else if (mode === "perc") {
        const age = parseNumber(document.getElementById("vtePercAge").value);
        const pulse = parseNumber(document.getElementById("vtePercPulse").value);
        const spo2 = parseNumber(document.getElementById("vtePercSpo2").value);
        if (![age,pulse,spo2].every(Number.isFinite) || age < 18 || age > 120 || pulse < 20 || pulse > 250 || spo2 < 40 || spo2 > 100) {
          setError("vte", "Укажите возраст, пульс и SpO₂.");
          return false;
        }
        let positive = 0;
        if (age >= 50) positive++;
        if (pulse >= 100) positive++;
        if (spo2 < 95) positive++;
        positive += countChecked(["vtePercLeg","vtePercHemoptysis","vtePercPrevious","vtePercTrauma","vtePercHormone"], [1,1,1,1,1]);
        valueText = String(positive);
        unitEl.textContent = "положительных критериев";
        if (positive === 0) {
          interpretation = "PERC отрицателен — только при низкой предварительной вероятности ТЭЛА.";
          tone = "good";
        } else {
          interpretation = "PERC положителен: правило не позволяет исключить ТЭЛА без дальнейшего обследования.";
          tone = "warning";
        }
        note = "PERC не предназначен для пациентов со средней или высокой предварительной вероятностью ТЭЛА.";
        copy = "PERC: " + positive + " положительных критериев. " + interpretation;
      } else {
        const age = parseNumber(document.getElementById("vteDdimAge").value);
        const value = parseNumber(document.getElementById("vteDdimValue").value);
        const unit = document.getElementById("vteDdimUnit").value;
        if (!Number.isFinite(age) || !Number.isFinite(value) || age < 18 || age > 120 || value < 0) {
          setError("vte", "Укажите корректный возраст и результат D-димера.");
          return false;
        }
        const threshold = unit === "feu" ? (age > 50 ? age * 10 : 500) : (age > 50 ? age * 5 : 250);
        valueText = formatNumber(threshold, 0);
        unitEl.textContent = unit === "feu" ? "нг/мл FEU — порог" : "нг/мл DDU — порог";
        if (value < threshold) {
          interpretation = "Результат ниже возраст-скорректированного порога.";
          tone = "good";
        } else {
          interpretation = "Результат равен или выше возраст-скорректированного порога.";
          tone = "warning";
        }
        note = "D-димер интерпретируется только вместе с предварительной клинической вероятностью и характеристиками теста.";
        copy = "Возраст-скорректированный порог D-димера: " + valueText + " " + (unit === "feu" ? "нг/мл FEU" : "нг/мл DDU") + ". Результат: " + value + ".";
      }

      setResult("vte", valueText, interpretation, tone, note, copy);
      return true;
    }

    function calculatePneumonia() {
      setError("pneumonia", "");
      const mode = document.querySelector('input[name="pneumoniaMode"]:checked').value;
      const age = parseNumber(document.getElementById("pneuAge").value);
      const rr = parseNumber(document.getElementById("pneuRr").value);
      const sbp = parseNumber(document.getElementById("pneuSbp").value);
      const dbp = parseNumber(document.getElementById("pneuDbp").value);
      if (![age,rr,sbp,dbp].every(Number.isFinite) || age < 16 || age > 120 || rr < 5 || rr > 80 || sbp < 40 || sbp > 260 || dbp < 20 || dbp > 180 || dbp >= sbp) {
        setError("pneumonia", "Заполните возраст, частоту дыхания и артериальное давление.");
        return false;
      }
      let score = 0;
      if (document.getElementById("pneuConfusion").checked) score++;
      if (rr >= 30) score++;
      if (sbp < 90 || dbp <= 60) score++;
      if (age >= 65) score++;
      if (mode === "curb") {
        const ureaRaw = parseNumber(document.getElementById("pneuUrea").value);
        const ureaUnit = document.getElementById("pneuUreaUnit").value;
        if (!Number.isFinite(ureaRaw) || ureaRaw < 0) {
          setError("pneumonia", "Для CURB-65 укажите мочевину или BUN.");
          return false;
        }
        const ureaMmol = ureaUnit === "bun" ? ureaRaw / 2.801 : ureaRaw;
        if (ureaMmol > 80) {
          setError("pneumonia", "Проверьте значение мочевины / BUN и выбранные единицы.");
          return false;
        }
        if (ureaMmol > 7) score++;
      }
      document.getElementById("pneumoniaUnit").textContent = mode === "curb" ? "из 5" : "из 4";
      let interpretation, tone, note;
      if (mode === "crb") {
        if (score === 0) { interpretation = "Низкий риск."; tone = "good"; note = "Обычно возможно амбулаторное ведение при отсутствии других показаний к госпитализации."; }
        else if (score <= 2) { interpretation = "Промежуточный риск."; tone = "warning"; note = score >= 2 ? "Следует рассмотреть направление в стационар." : "Нужна индивидуальная оценка места лечения и наблюдения."; }
        else { interpretation = "Высокий риск."; tone = "danger"; note = "Требуется срочная оценка в стационаре."; }
      } else {
        if (score <= 1) { interpretation = "Низкий риск."; tone = "good"; note = "При клинической стабильности возможно лечение вне стационара."; }
        else if (score === 2) { interpretation = "Промежуточный риск."; tone = "warning"; note = "Рассмотрите наблюдение или стационарное лечение."; }
        else { interpretation = "Высокий риск."; tone = "danger"; note = "Обычно требуется стационарное лечение; оцените необходимость интенсивной терапии."; }
      }
      setResult("pneumonia", String(score), interpretation, tone, note, (mode === "curb" ? "CURB-65" : "CRB-65") + ": " + score + ". " + interpretation);
      return true;
    }

    function calculateSorethroat() {
      setError("sorethroat", "");
      const mode = document.querySelector('input[name="soreMode"]:checked').value;
      let score = 0, max = 5, interpretation = "", tone = "warning", note = "";
      if (mode === "feverpain") {
        score = countChecked(["stFever","stPurulence","stRapid","stInflamed","stNoCoughCoryza"], [1,1,1,1,1]);
        if (score <= 1) { interpretation = "Вероятность пользы от антибиотика низкая."; tone = "good"; note = "Обычно антибиотик не предлагается; важны симптоматическое лечение и safety-netting."; }
        else if (score <= 3) { interpretation = "Промежуточный результат."; note = "Можно рассмотреть отказ от антибиотика или отсроченный рецепт с учётом клинической картины."; }
        else { interpretation = "Вероятность стрептококковой инфекции выше."; tone = "warning"; note = "Можно рассмотреть немедленный или отсроченный рецепт согласно локальным рекомендациям."; }
      } else {
        score = countChecked(["stExudate","stNodes","stTemp","stNoCough"], [1,1,1,1]);
        max = mode === "mcisaac" ? 5 : 4;
        if (mode === "mcisaac") {
          const age = parseNumber(document.getElementById("soreAge").value);
          if (!Number.isFinite(age) || age < 3 || age > 120) {
            setError("sorethroat", "Для McIsaac укажите возраст от 3 лет.");
            return false;
          }
          if (age <= 14) score += 1;
          else if (age >= 45) score -= 1;
        }
        if (mode === "centor") {
          if (score <= 2) { interpretation = "Вероятность пользы от антибиотика низкая."; tone = "good"; note = "Обычно антибиотик не предлагается."; }
          else { interpretation = "Вероятность стрептококковой инфекции выше."; tone = "warning"; note = "Рассмотрите тестирование или стратегию антибиотикотерапии по локальным рекомендациям."; }
        } else {
          if (score <= 0) { interpretation = "Низкая вероятность БГСА."; tone = "good"; }
          else if (score <= 2) { interpretation = "Низкая или промежуточная вероятность БГСА."; tone = "good"; }
          else { interpretation = "Повышенная вероятность БГСА."; tone = "warning"; }
          note = "McIsaac помогает определить необходимость тестирования; пороги тактики зависят от рекомендаций и доступности тестов.";
        }
      }
      document.getElementById("sorethroatUnit").textContent = "из " + max;
      setResult("sorethroat", String(score), interpretation, tone, note, (mode === "feverpain" ? "FeverPAIN" : mode === "centor" ? "Centor" : "McIsaac") + ": " + score + ". " + interpretation);
      return true;
    }

    function qtcTone(value, sex) {
      if (value >= 500) return ["Выраженное удлинение QTc (≥500 мс).", "danger"];
      const threshold = sex === "male" ? 450 : 460;
      if (value >= threshold) return ["QTc удлинён относительно распространённого полового порога.", "warning"];
      return ["QTc ниже распространённого порога удлинения.", "good"];
    }

    function calculateQtc() {
      setError("qtc", "");
      const qtRaw = parseNumber(document.getElementById("qtcQt").value);
      const qtUnit = document.getElementById("qtcQtUnit").value;
      const mode = document.querySelector('input[name="qtcInputMode"]:checked').value;
      const sex = document.querySelector('input[name="qtcSex"]:checked');
      const qt = qtUnit === "s" ? qtRaw * 1000 : qtRaw;
      let hr, rr;
      if (!Number.isFinite(qt) || qt < 200 || qt > 800 || !sex) {
        setError("qtc", "Укажите корректный QT и пол.");
        return false;
      }
      if (mode === "hr") {
        hr = parseNumber(document.getElementById("qtcHr").value);
        if (!Number.isFinite(hr) || hr < 20 || hr > 250) {
          setError("qtc", "Укажите корректную ЧСС.");
          return false;
        }
        rr = 60 / hr;
      } else {
        const rrRaw = parseNumber(document.getElementById("qtcRr").value);
        const rrUnit = document.getElementById("qtcRrUnit").value;
        const rrMs = rrUnit === "s" ? rrRaw * 1000 : rrRaw;
        if (!Number.isFinite(rrMs) || rrMs < 240 || rrMs > 3000) {
          setError("qtc", "Укажите корректный RR и выбранные единицы.");
          return false;
        }
        rr = rrMs / 1000;
        hr = 60 / rr;
      }
      const bazett = qt / Math.sqrt(rr);
      const fridericia = qt / Math.cbrt(rr);
      const framingham = qt + 154 * (1 - rr);
      const hodges = qt + 1.75 * (hr - 60);
      const values = [bazett, fridericia, framingham, hodges].map(Math.round);
      const metrics = document.querySelectorAll("#qtcMetrics strong");
      values.forEach((v, i) => metrics[i].textContent = v + " мс");
      const [interpretation, tone] = qtcTone(values[1], sex.value);
      let note = "ЧСС: " + formatNumber(hr, 0) + "/мин. ";
      if (hr > 100) note += "При тахикардии Bazett часто завышает QTc.";
      else if (hr < 60) note += "При брадикардии Bazett часто занижает QTc.";
      else note += "Сопоставьте результат с морфологией T, лекарствами, электролитами и клиническим контекстом.";
      setResult("qtc", String(values[1]), interpretation, tone, note,
        "QTc: Bazett " + values[0] + " мс; Fridericia " + values[1] + " мс; Framingham " + values[2] + " мс; Hodges " + values[3] + " мс.");
      return true;
    }

    function calculateElectrolytes() {
      setError("electrolytes", "");
      const mode = document.querySelector('input[name="electroMode"]:checked').value;
      const label = document.getElementById("electrolytesLabel");
      const unitEl = document.getElementById("electrolytesUnit");
      let valueText, interpretation, tone = "", note, copy;

      if (mode === "calcium") {
        const caRaw = parseNumber(document.getElementById("elCa").value);
        const albRaw = parseNumber(document.getElementById("elCaAlb").value);
        const caUnit = document.getElementById("elCaUnit").value;
        const albUnit = document.getElementById("elCaAlbUnit").value;
        const albGl = albUnit === "gdl" ? albRaw * 10 : albRaw;
        const caMmol = caUnit === "mgdl" ? caRaw * 0.2495 : caRaw;
        if (!Number.isFinite(caMmol) || !Number.isFinite(albGl) || caMmol < 0.5 || caMmol > 5 || albGl < 5 || albGl > 70) { setError("electrolytes", "Проверьте общий кальций, альбумин и выбранные единицы."); return false; }
        let corrected;
        if (caUnit === "mmol") {
          corrected = caRaw + 0.02 * (40 - albGl);
          valueText = formatNumber(corrected, 2); unitEl.textContent = "ммоль/л";
        } else {
          const albGdl = albGl / 10;
          corrected = caRaw + 0.8 * (4 - albGdl);
          valueText = formatNumber(corrected, 2); unitEl.textContent = "мг/дл";
        }
        label.textContent = "Скорректированный кальций";
        interpretation = "Приближённая поправка по альбумину.";
        note = "Не используйте формулу вместо ионизированного кальция, когда требуется точная оценка.";
        copy = "Скорректированный кальций: " + valueText + " " + unitEl.textContent + ".";
      } else if (mode === "anion") {
        const na = parseNumber(document.getElementById("elAgNa").value);
        const cl = parseNumber(document.getElementById("elAgCl").value);
        const hco3 = parseNumber(document.getElementById("elAgHco3").value);
        const albText = document.getElementById("elAgAlb").value.trim();
        const albRaw = albText ? parseNumber(albText) : null;
        const albUnit = document.getElementById("elAgAlbUnit").value;
        const alb = albRaw === null ? null : (albUnit === "gdl" ? albRaw * 10 : albRaw);
        if (![na,cl,hco3].every(Number.isFinite) || na < 80 || na > 190 || cl < 40 || cl > 160 || hco3 < 2 || hco3 > 50) { setError("electrolytes", "Введите натрий, хлор и бикарбонат."); return false; }
        if (albText && (!Number.isFinite(alb) || alb < 5 || alb > 70)) { setError("electrolytes", "Проверьте альбумин и выбранные единицы."); return false; }
        const ag = na - cl - hco3;
        const corrected = alb === null ? ag : ag + 0.25 * (40 - alb);
        const delta = (corrected > 12 && hco3 < 24) ? (corrected - 12) / (24 - hco3) : NaN;
        valueText = formatNumber(corrected, 1); unitEl.textContent = "ммоль/л";
        label.textContent = alb === null ? "Анионная разница" : "АГ с поправкой на альбумин";
        interpretation = "Исходная АГ: " + formatNumber(ag,1) + (Number.isFinite(delta) ? "; delta ratio: " + formatNumber(delta,2) + "." : ".");
        note = "Референс анионной разницы зависит от анализатора и от включения калия; здесь используется Na − Cl − HCO₃.";
        copy = label.textContent + ": " + valueText + " ммоль/л. " + interpretation;
      } else if (mode === "sodium") {
        const na = parseNumber(document.getElementById("elNaMeasured").value);
        let glucose = parseNumber(document.getElementById("elNaGlucose").value);
        const unit = document.getElementById("elNaGluUnit").value;
        const factor = Number(document.querySelector('input[name="elNaFactor"]:checked').value);
        if (!Number.isFinite(na) || !Number.isFinite(glucose) || na < 80 || na > 190 || glucose < 0) { setError("electrolytes", "Введите натрий и глюкозу."); return false; }
        if (unit === "mmol") glucose *= 18;
        if (glucose > 5000) { setError("electrolytes", "Проверьте глюкозу и выбранные единицы."); return false; }
        const corrected = na + factor * Math.max(0, glucose - 100) / 100;
        valueText = formatNumber(corrected,1); unitEl.textContent = "ммоль/л";
        label.textContent = "Натрий с поправкой на гипергликемию";
        interpretation = "Поправка: " + factor.toFixed(1).replace(".",",") + " ммоль/л на каждые 100 мг/дл глюкозы выше 100.";
        note = "Расчёт не заменяет оценку эффективной осмоляльности и скорости коррекции натрия.";
        copy = "Скорректированный натрий: " + valueText + " ммоль/л.";
      } else if (mode === "osm") {
        const na = parseNumber(document.getElementById("elOsmNa").value);
        let glucose = parseNumber(document.getElementById("elOsmGlu").value);
        let urea = parseNumber(document.getElementById("elOsmUrea").value);
        const measuredText = document.getElementById("elOsmMeasured").value.trim();
        const measured = measuredText ? parseNumber(measuredText) : null;
        if (![na,glucose,urea].every(Number.isFinite) || na < 80 || na > 190 || glucose < 0 || urea < 0) { setError("electrolytes", "Введите натрий, глюкозу и мочевину/BUN."); return false; }
        const glucoseMmol = document.getElementById("elOsmGluUnit").value === "mgdl" ? glucose / 18 : glucose;
        const ureaMmol = document.getElementById("elOsmUreaUnit").value === "bun" ? urea / 2.8 : urea;
        if (glucoseMmol > 200 || ureaMmol > 200 || (measuredText && (!Number.isFinite(measured) || measured < 100 || measured > 500))) { setError("electrolytes", "Проверьте значения и выбранные единицы."); return false; }
        const calc = 2 * na + glucoseMmol + ureaMmol;
        valueText = formatNumber(calc,1); unitEl.textContent = "мОсм/кг";
        label.textContent = "Расчётная осмоляльность";
        if (measured !== null) {
          const gap = measured - calc;
          interpretation = "Осмолярный разрыв: " + formatNumber(gap,1) + " мОсм/кг.";
        } else interpretation = "Измеренная осмоляльность не указана — осмолярный разрыв не рассчитан.";
        note = "Формула: 2×Na + глюкоза (ммоль/л) + мочевина (ммоль/л).";
        copy = "Расчётная осмоляльность: " + valueText + " мОсм/кг. " + interpretation;
      } else {
        const weightRaw = parseNumber(document.getElementById("elWaterWeight").value);
        const weightUnit = document.getElementById("elWaterWeightUnit").value;
        const weight = weightUnit === "lb" ? weightRaw * 0.45359237 : weightRaw;
        const na = parseNumber(document.getElementById("elWaterNa").value);
        const coeff = Number(document.getElementById("elWaterCoeff").value);
        if (!Number.isFinite(weight) || !Number.isFinite(na) || weight <= 0 || weight > 400 || na <= 140 || na > 200) { setError("electrolytes", "Для расчёта дефицита укажите массу тела и натрий выше 140 ммоль/л."); return false; }
        const deficit = coeff * weight * (na / 140 - 1);
        valueText = formatNumber(deficit,1); unitEl.textContent = "л";
        label.textContent = "Расчётный дефицит свободной воды";
        interpretation = "Оценочный дефицит относительно целевого Na 140 ммоль/л.";
        tone = "warning";
        note = "Формула не учитывает текущие потери, поступление, диурез и безопасную скорость изменения натрия.";
        copy = "Дефицит свободной воды: " + valueText + " л.";
      }
      setResult("electrolytes", valueText, interpretation, tone, note, copy);
      return true;
    }


    function graceAgePoints(age) {
      if (age < 30) return 0;
      if (age < 40) return 8;
      if (age < 50) return 25;
      if (age < 60) return 41;
      if (age < 70) return 58;
      if (age < 80) return 75;
      if (age < 90) return 91;
      return 100;
    }

    function graceHrPoints(hr) {
      if (hr < 50) return 0;
      if (hr < 70) return 3;
      if (hr < 90) return 9;
      if (hr < 110) return 15;
      if (hr < 150) return 24;
      if (hr < 200) return 38;
      return 46;
    }

    function graceSbpPoints(sbp) {
      if (sbp >= 200) return 0;
      if (sbp >= 180) return 3;
      if (sbp >= 160) return 10;
      if (sbp >= 140) return 24;
      if (sbp >= 120) return 34;
      if (sbp >= 100) return 43;
      if (sbp >= 80) return 53;
      return 58;
    }

    function graceCrPoints(mgdl) {
      if (mgdl < 0.4) return 1;
      if (mgdl < 0.8) return 4;
      if (mgdl < 1.2) return 7;
      if (mgdl < 1.6) return 10;
      if (mgdl < 2.0) return 13;
      if (mgdl < 4.0) return 21;
      return 28;
    }

    function calculateGrace() {
      setError("grace", "");
      const age = parseNumber(document.getElementById("graceAge").value);
      const hr = parseNumber(document.getElementById("graceHr").value);
      const sbp = parseNumber(document.getElementById("graceSbp").value);
      const crRaw = parseNumber(document.getElementById("graceCr").value);
      const crUnit = document.getElementById("graceCrUnit").value;
      const killip = Number(document.getElementById("graceKillip").value);

      if (![age, hr, sbp, crRaw].every(Number.isFinite)) {
        setError("grace", "Заполните возраст, пульс, АД и креатинин.");
        return false;
      }
      if (age < 18 || age > 110 || hr < 20 || hr > 300 || sbp < 40 || sbp > 300 || crRaw <= 0) {
        setError("grace", "Проверьте диапазоны введённых значений.");
        return false;
      }

      const crMgdl = crUnit === "umol" ? crRaw / 88.4 : crRaw;
      if (crMgdl < 0.1 || crMgdl > 20) {
        setError("grace", "Проверьте креатинин и выбранные единицы.");
        return false;
      }
      const killipPoints = {1: 0, 2: 20, 3: 39, 4: 59}[killip];

      let score =
        graceAgePoints(age) +
        graceHrPoints(hr) +
        graceSbpPoints(sbp) +
        graceCrPoints(crMgdl) +
        killipPoints;

      if (document.getElementById("graceArrest").checked) score += 39;
      if (document.getElementById("graceSt").checked) score += 28;
      if (document.getElementById("graceBio").checked) score += 14;

      let interpretation, tone;
      if (score > 140) {
        interpretation = "Высокий риск; порог >140 связан с приоритетом ранней инвазивной стратегии при NSTE-ACS.";
        tone = "danger";
      } else if (score >= 109) {
        interpretation = "Промежуточный риск.";
        tone = "warning";
      } else {
        interpretation = "Низкий риск по балльной категории.";
        tone = "good";
      }

      setResult("grace", String(score), interpretation, tone,
        "Используйте вместе с клинической стабильностью, ЭКГ, тропонином и действующими протоколами ОКС.",
        "GRACE ACS: " + score + " баллов. " + interpretation);
      return true;
    }

    function calculateHasbled() {
      setError("hasbled", "");
      const age = parseNumber(document.getElementById("hasbledAge").value);
      if (!Number.isFinite(age) || age < 18 || age > 120) {
        setError("hasbled", "Укажите корректный возраст.");
        return false;
      }

      const ids = ["hbHtn", "hbRenal", "hbLiver", "hbStroke", "hbBleed", "hbInr", "hbDrugs", "hbAlcohol"];
      let score = age > 65 ? 1 : 0;
      ids.forEach((id) => { if (document.getElementById(id).checked) score += 1; });

      let interpretation, tone;
      if (score >= 3) {
        interpretation = "Высокий риск кровотечения: требуется коррекция модифицируемых факторов и более частое наблюдение.";
        tone = "danger";
      } else if (score === 2) {
        interpretation = "Умеренное количество факторов риска кровотечения.";
        tone = "warning";
      } else {
        interpretation = "Низкое количество факторов риска по HAS-BLED.";
        tone = "good";
      }

      setResult("hasbled", String(score), interpretation, tone,
        "Не используйте балл как автоматическое основание для отказа от антикоагуляции.",
        "HAS-BLED: " + score + "/9. " + interpretation);
      return true;
    }

    const CAD_PTP_TABLE = {
      male: {
        typical: [3, 22, 32, 44, 52],
        atypical: [4, 10, 17, 26, 34],
        nonanginal: [1, 3, 11, 22, 24],
        dyspnea: [0, 12, 20, 27, 32]
      },
      female: {
        typical: [5, 10, 13, 16, 27],
        atypical: [3, 6, 6, 11, 19],
        nonanginal: [1, 2, 3, 6, 10],
        dyspnea: [3, 3, 9, 14, 12]
      }
    };

    function calculateCadptp() {
      setError("cadptp", "");
      const age = parseNumber(document.getElementById("cadAge").value);
      const sexInput = document.querySelector('input[name="cadSex"]:checked');
      const symptoms = document.getElementById("cadSymptoms").value;

      if (!Number.isFinite(age) || !sexInput) {
        setError("cadptp", "Укажите возраст и пол.");
        return false;
      }
      if (age < 30 || age > 90) {
        setError("cadptp", "Базовая таблица применяется в возрасте от 30 лет; для старших возрастов используется категория 70+.");
        return false;
      }

      const ageIndex = age < 40 ? 0 : age < 50 ? 1 : age < 60 ? 2 : age < 70 ? 3 : 4;
      const value = CAD_PTP_TABLE[sexInput.value][symptoms][ageIndex];

      let interpretation, tone;
      if (value <= 5) {
        interpretation = "Очень низкая базовая вероятность.";
        tone = "good";
      } else if (value <= 15) {
        interpretation = "Низкая базовая вероятность; решение о тестировании зависит от модификаторов.";
        tone = "good";
      } else if (value <= 50) {
        interpretation = "Промежуточная базовая вероятность.";
        tone = "warning";
      } else {
        interpretation = "Высокая базовая вероятность.";
        tone = "danger";
      }

      setResult("cadptp", String(value), interpretation, tone,
        "ESC 2024 рекомендует уточнять вероятность с помощью факторов риска и других модификаторов.",
        "Базовая PTP обструктивной ИБС: " + value + "%. " + interpretation);
      return true;
    }

    function calculateDlcn() {
      setError("dlcn", "");
      const family = Number(document.getElementById("dlcnFamily").value);
      const clinical = Number(document.getElementById("dlcnClinical").value);
      const physical = Number(document.getElementById("dlcnPhysical").value);
      const ldlRaw = parseNumber(document.getElementById("dlcnLdl").value);
      const ldlUnit = document.getElementById("dlcnLdlUnit").value;
      const genetic = Number(document.querySelector('input[name="dlcnGenetic"]:checked').value);

      if (!Number.isFinite(ldlRaw) || ldlRaw <= 0 || (ldlUnit === "mmol" && ldlRaw > 30) || (ldlUnit === "mgdl" && ldlRaw > 1200)) {
        setError("dlcn", "Укажите нелеченое значение LDL-C.");
        return false;
      }

      let ldlPoints = 0;
      if (ldlUnit === "mgdl") {
        if (ldlRaw >= 325) ldlPoints = 8;
        else if (ldlRaw >= 251) ldlPoints = 5;
        else if (ldlRaw >= 191) ldlPoints = 3;
        else if (ldlRaw >= 155) ldlPoints = 1;
      } else {
        if (ldlRaw >= 8.5) ldlPoints = 8;
        else if (ldlRaw >= 6.5) ldlPoints = 5;
        else if (ldlRaw >= 5.0) ldlPoints = 3;
        else if (ldlRaw >= 4.0) ldlPoints = 1;
      }

      const score = family + clinical + physical + ldlPoints + genetic;
      let interpretation, tone;
      if (score > 8) {
        interpretation = "Определённая семейная гиперхолестеринемия.";
        tone = "danger";
      } else if (score >= 6) {
        interpretation = "Вероятная семейная гиперхолестеринемия.";
        tone = "warning";
      } else if (score >= 3) {
        interpretation = "Возможная семейная гиперхолестеринемия.";
        tone = "warning";
      } else {
        interpretation = "Семейная гиперхолестеринемия маловероятна по DLCN.";
        tone = "good";
      }

      setResult("dlcn", String(score), interpretation, tone,
        "При подозрении важны каскадный скрининг родственников и исключение вторичных причин гиперхолестеринемии.",
        "DLCN: " + score + " баллов. " + interpretation);
      return true;
    }

    function clamp(value, minimum, maximum) {
      return Math.min(maximum, Math.max(minimum, value));
    }

    function calculatePrecisedapt() {
      setError("precisedapt", "");
      const age = parseNumber(document.getElementById("pdAge").value);
      const crcl = parseNumber(document.getElementById("pdCrcl").value);
      const hbRaw = parseNumber(document.getElementById("pdHb").value);
      const hbUnit = document.getElementById("pdHbUnit").value;
      const wbc = parseNumber(document.getElementById("pdWbc").value);
      const priorBleed = Number(document.querySelector('input[name="pdBleed"]:checked').value);

      if (![age, crcl, hbRaw, wbc].every(Number.isFinite)) {
        setError("precisedapt", "Заполните возраст, клиренс креатинина, гемоглобин и лейкоциты.");
        return false;
      }

      const hb = hbUnit === "gl" ? hbRaw / 10 : hbRaw;
      if (age < 18 || age > 100 || crcl < 0 || crcl > 200 || hb < 5 || hb > 20 || wbc < 0.5 || wbc > 50) {
        setError("precisedapt", "Проверьте введённые значения и единицы.");
        return false;
      }

      const linearPredictor =
        clamp(age, 50, 90) * 0.02595618 -
        clamp(hb, 10, 12) * 0.40551264 +
        clamp(wbc, 5, 20) * 0.05697497 -
        clamp(crcl, 0, 100) * 0.0140439 +
        priorBleed * 1.41955653 +
        4.68785783;
      const score = clamp(Math.round(100 * linearPredictor / 5.52784356), 0, 100);

      let interpretation, tone;
      if (score >= 25) {
        interpretation = "Высокий риск кровотечения.";
        tone = "danger";
      } else if (score >= 18) {
        interpretation = "Умеренный риск кровотечения.";
        tone = "warning";
      } else if (score >= 11) {
        interpretation = "Низкий риск кровотечения.";
        tone = "good";
      } else {
        interpretation = "Очень низкий риск кровотечения.";
        tone = "good";
      }

      setResult("precisedapt", String(score), interpretation, tone,
        "Порог ≥25 соответствует высокому риску кровотечения и требует клинической оценки длительности ДАТТ.",
        "PRECISE-DAPT: " + score + " баллов. " + interpretation);
      return true;
    }

    function calculateFrax() {
      setError("frax", "");
      const age = parseNumber(document.getElementById("fraxAge").value);
      const sex = document.querySelector('input[name="fraxSex"]:checked');
      const weightRaw = parseNumber(document.getElementById("fraxWeight").value);
      const heightRaw = parseNumber(document.getElementById("fraxHeight").value);
      const weightUnit = document.getElementById("fraxWeightUnit").value;
      const heightUnit = document.getElementById("fraxHeightUnit").value;
      const tscoreRaw = document.getElementById("fraxTscore").value.trim();
      const tscore = tscoreRaw ? parseNumber(tscoreRaw) : null;

      if (![age, weightRaw, heightRaw].every(Number.isFinite) || !sex) {
        setError("frax", "Укажите возраст, пол, массу тела и рост.");
        return false;
      }
      if (tscoreRaw && !Number.isFinite(tscore)) {
        setError("frax", "Проверьте T-критерий шейки бедра.");
        return false;
      }
      if (age < 40 || age > 90) {
        setError("frax", "Официальная модель принимает возраст 40–90 лет.");
        return false;
      }

      const weightKg = weightUnit === "lb" ? weightRaw * 0.45359237 : weightRaw;
      const heightM = heightUnit === "in" ? heightRaw * 0.0254 : heightRaw / 100;
      if (weightKg < 20 || weightKg > 300 || heightM < 1.0 || heightM > 2.4 || (tscore !== null && (tscore < -8 || tscore > 5))) {
        setError("frax", "Проверьте антропометрию и T-критерий.");
        return false;
      }

      const bmi = weightKg / (heightM * heightM);
      const factors = [
        ["предыдущий перелом", "fraxPrev"],
        ["перелом бедра у родителя", "fraxParent"],
        ["курение", "fraxSmoke"],
        ["глюкокортикоиды", "fraxGc"],
        ["ревматоидный артрит", "fraxRa"],
        ["вторичный остеопороз", "fraxSecondary"],
        ["алкоголь ≥3 единиц/сут", "fraxAlcohol"]
      ].filter(([, id]) => document.getElementById(id).checked).map(([label]) => label);

      const summary =
        "FRAX: возраст " + age + "; пол " + (sex.value === "female" ? "женский" : "мужской") +
        "; масса " + formatNumber(weightKg, 1) + " кг; рост " + formatNumber(heightM * 100, 0) +
        " см; ИМТ " + formatNumber(bmi, 1) +
        (factors.length ? "; факторы: " + factors.join(", ") : "; дополнительные факторы не отмечены") +
        (tscore !== null ? "; T-критерий шейки бедра " + formatNumber(tscore, 1) : "; BMD/T-критерий не указан") + ".";

      setResult("frax", formatNumber(bmi, 1),
        "Данные готовы. Откройте официальный FRAX и выберите страну пациента.",
        "",
        "Локально рассчитан только ИМТ; 10-летняя вероятность перелома рассчитывается официальной country-specific моделью.",
        summary);
      return true;
    }


    function egfrCategory(value) {
      if (value >= 90) return { category: "G1", description: "нормальная или высокая СКФ", tone: "good" };
      if (value >= 60) return { category: "G2", description: "незначительно сниженная СКФ", tone: "good" };
      if (value >= 45) return { category: "G3a", description: "умеренно сниженная СКФ", tone: "warning" };
      if (value >= 30) return { category: "G3b", description: "умеренно–значительно сниженная СКФ", tone: "warning" };
      if (value >= 15) return { category: "G4", description: "значительно сниженная СКФ", tone: "danger" };
      return { category: "G5", description: "категория почечной недостаточности", tone: "danger" };
    }

    function calculateEgfrcys() {
      setError("egfrcys", "");

      const age = parseNumber(document.getElementById("egfrcysAge").value);
      const cystatin = parseNumber(document.getElementById("egfrcysCystatin").value);
      const sexInput = document.querySelector('input[name="egfrcysSex"]:checked');
      const creatinineText = document.getElementById("egfrcysCreatinine").value.trim();
      const creatinineRaw = creatinineText ? parseNumber(creatinineText) : null;
      const creatinineUnit = document.getElementById("egfrcysCreatinineUnit").value;

      if (!Number.isFinite(age) || !Number.isFinite(cystatin) || !sexInput) {
        setError("egfrcys", "Укажите возраст, пол и цистатин C.");
        return false;
      }

      if (age < 18 || age > 120) {
        setError("egfrcys", "Формулы предназначены для взрослых 18 лет и старше.");
        return false;
      }

      if (cystatin < 0.2 || cystatin > 10) {
        setError("egfrcys", "Проверьте значение цистатина C.");
        return false;
      }

      if (creatinineText && (!Number.isFinite(creatinineRaw) || creatinineRaw <= 0)) {
        setError("egfrcys", "Проверьте значение креатинина.");
        return false;
      }

      const female = sexInput.value === "female";
      const cysRatio = cystatin / 0.8;

      let egfrCys =
        133 *
        Math.pow(Math.min(cysRatio, 1), -0.499) *
        Math.pow(Math.max(cysRatio, 1), -1.328) *
        Math.pow(0.996, age);

      if (female) egfrCys *= 0.932;

      let egfrCombined = null;

      if (creatinineText) {
        const scr = creatinineUnit === "umol" ? creatinineRaw / 88.4 : creatinineRaw;

        if (scr < 0.1 || scr > 20) {
          setError("egfrcys", "Проверьте креатинин и выбранные единицы.");
          return false;
        }

        const kappa = female ? 0.7 : 0.9;
        const alpha = female ? -0.219 : -0.144;
        const crRatio = scr / kappa;

        egfrCombined =
          135 *
          Math.pow(Math.min(crRatio, 1), alpha) *
          Math.pow(Math.max(crRatio, 1), -0.544) *
          Math.pow(Math.min(cysRatio, 1), -0.323) *
          Math.pow(Math.max(cysRatio, 1), -0.778) *
          Math.pow(0.9961, age);

        if (female) egfrCombined *= 0.963;
      }

      const cysRounded = Math.round(egfrCys);
      const combinedRounded = egfrCombined === null ? null : Math.round(egfrCombined);
      const primaryRaw = egfrCombined ?? egfrCys;
      const primary = Math.round(primaryRaw);
      const primaryName = combinedRounded === null
        ? "CKD-EPI cystatin C 2012"
        : "CKD-EPI creatinine–cystatin C 2021";

      const classification = egfrCategory(primaryRaw);

      document.getElementById("egfrcysOnlyMetric").textContent =
        cysRounded + " мл/мин/1,73 м²";
      document.getElementById("egfrcysCombinedMetric").textContent =
        combinedRounded === null
          ? "нужен креатинин"
          : combinedRounded + " мл/мин/1,73 м²";
      document.getElementById("egfrcysResultLabel").textContent = primaryName;

      const interpretation =
        classification.category + " — " + classification.description + ".";

      let note =
        "Основной результат: " + primaryName + ". " +
        "Категории G1–G2 сами по себе не подтверждают ХБП без других признаков поражения почек.";

      if (combinedRounded !== null) {
        const difference = Math.abs(combinedRounded - cysRounded);
        const denominator = Math.max(combinedRounded, cysRounded);
        const percentDifference = denominator > 0 ? difference / denominator * 100 : 0;

        if (percentDifference >= 20) {
          note += " Между оценками есть расхождение ≥20%; оцените возможные не-GFR факторы для креатинина и цистатина C.";
        }
      }

      const copyText =
        "СКФ с цистатином C: " +
        "eGFRcys 2012 — " + cysRounded + " мл/мин/1,73 м²" +
        (combinedRounded === null
          ? ""
          : "; eGFRcr-cys 2021 — " + combinedRounded + " мл/мин/1,73 м²") +
        ". " + interpretation;

      setResult(
        "egfrcys",
        String(primary),
        interpretation,
        classification.tone,
        note,
        copyText
      );

      return true;
    }

    const calculators = {
      bmi: calculateBmi,
      egfr: calculateEgfr,
      mentzer: calculateMentzer,
      tsat: calculateTsat,
      score2: calculateScore2,
      prevent: calculatePrevent,
      phq9: calculatePhq9,
      gad7: calculateGad7,
      mmse: calculateMmse,
      fib4: calculateFib4,
      maf5: calculateMaf5,
      liverpro: calculateLiverpro,
      adapt: calculateAdapt,
      stopbang: calculateStopbang,
      epworth: calculateEpworth,
      afstroke: calculateAfstroke,
      vte: calculateVte,
      pneumonia: calculatePneumonia,
      sorethroat: calculateSorethroat,
      qtc: calculateQtc,
      electrolytes: calculateElectrolytes,
      grace: calculateGrace,
      hasbled: calculateHasbled,
      cadptp: calculateCadptp,
      dlcn: calculateDlcn,
      precisedapt: calculatePrecisedapt,
      frax: calculateFrax,
      egfrcys: calculateEgfrcys
    };

    function resetAuxiliaryMetrics(key) {
      if (key === "qtc") {
        document.querySelectorAll("#qtcMetrics strong").forEach((element) => {
          element.textContent = "—";
        });
      }
      if (key === "egfrcys") {
        document.getElementById("egfrcysResultLabel").textContent = "Расчётная СКФ";
        document.getElementById("egfrcysOnlyMetric").textContent = "—";
        document.getElementById("egfrcysCombinedMetric").textContent = "нужен креатинин";
      }
    }

    function invalidateResult(key) {
      if (state.results[key] === null) return;
      clearResult(key, "Данные изменены — рассчитайте заново.");
      resetAuxiliaryMetrics(key);
    }

    Object.entries(calculators).forEach(([key, fn]) => {
      const form = document.getElementById(key + "Form");
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        fn();
      });
      form.addEventListener("input", () => invalidateResult(key));
      form.addEventListener("change", () => invalidateResult(key));
    });

    document.querySelectorAll(".reset-card").forEach((button) => {
      button.addEventListener("click", () => {
        const formId = button.dataset.form;
        const form = document.getElementById(formId);
        const key = formId.replace("Form", "");
        form.reset();
        resetAuxiliaryMetrics(key);

        if (key === "tsat") {
          document.getElementById("tsatTibcPanel").hidden = false;
          document.getElementById("tsatTransferrinPanel").hidden = true;
        }
        if (key === "vte") updateVteMode();
        if (key === "pneumonia") updatePneumoniaMode();
        if (key === "sorethroat") updateSoreMode();
        if (key === "qtc") {
          updateQtcMode();
          document.querySelectorAll("#qtcMetrics strong").forEach(el => el.textContent = "—");
        }
        if (key === "electrolytes") {
          updateElectroMode();
          document.getElementById("electrolytesLabel").textContent = "Скорректированный кальций";
          document.getElementById("electrolytesUnit").textContent = "ммоль/л";
        }

        const prompts = {
          bmi: "Введите массу тела и рост.",
          egfr: "Введите возраст, пол и креатинин.",
          mentzer: "Введите MCV и число эритроцитов.",
          tsat: "Введите показатели обмена железа.",
          score2: "Введите данные пациента.",
          prevent: "Введите данные пациента.",
          phq9: "Ответьте на 9 вопросов.",
          gad7: "Ответьте на 7 вопросов.",
          mmse: "Отметьте правильно выполненные задания.",
          fib4: "Введите возраст, АСТ, АЛТ и тромбоциты.",
          maf5: "Введите антропометрию и лабораторные данные.",
          liverpro: "Введите результат из сертифицированной системы.",
          adapt: "Введите возраст, PRO-C3 и тромбоциты.",
          stopbang: "Отметьте критерии.",
          epworth: "Ответь на все восемь вопросов.",
          afstroke: "Введите возраст, пол и отметьте факторы риска.",
          vte: "Выберите инструмент и заполните данные.",
          pneumonia: "Введите показатели пациента.",
          sorethroat: "Выберите шкалу и отметьте критерии.",
          qtc: "Введите QT, ЧСС или RR и пол.",
          electrolytes: "Выберите расчёт и заполните данные.",
          grace: "Введите данные пациента.",
          hasbled: "Введите возраст и отметьте факторы.",
          cadptp: "Введите возраст, пол и тип симптомов.",
          dlcn: "Заполните критерии.",
          precisedapt: "Введите пять параметров.",
          frax: "Заполните антропометрию и факторы риска.",
          egfrcys: "Введите возраст, пол и цистатин C."
        };

        clearResult(key, prompts[key]);
      });
    });

    document.querySelectorAll('input[name="tsatMode"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        const mode = document.querySelector('input[name="tsatMode"]:checked').value;
        document.getElementById("tsatTibcPanel").hidden = mode !== "tibc";
        document.getElementById("tsatTransferrinPanel").hidden = mode !== "transferrin";
        clearResult("tsat", "Введите показатели обмена железа.");
      });
    });


    function updateVteMode() {
      const mode = document.querySelector('input[name="vteMode"]:checked').value;
      setModePanels('vteMode', {pe:"vtePePanel", perc:"vtePercPanel", dvt:"vteDvtPanel", ddimer:"vteDdimerPanel"}, mode);
      clearResult("vte", "Выберите инструмент и заполните данные.");
      document.getElementById("vteResultUnit").textContent = mode === "ddimer" ? "порог" : "баллов";
    }
    document.querySelectorAll('input[name="vteMode"]').forEach(el => el.addEventListener("change", updateVteMode));

    function updatePneumoniaMode() {
      const mode = document.querySelector('input[name="pneumoniaMode"]:checked').value;
      document.getElementById("pneuUreaPanel").hidden = mode !== "curb";
      clearResult("pneumonia", "Введите показатели пациента.");
      document.getElementById("pneumoniaUnit").textContent = mode === "curb" ? "из 5" : "из 4";
    }
    document.querySelectorAll('input[name="pneumoniaMode"]').forEach(el => el.addEventListener("change", updatePneumoniaMode));

    function updateSoreMode() {
      const mode = document.querySelector('input[name="soreMode"]:checked').value;
      document.getElementById("soreFeverPanel").hidden = mode !== "feverpain";
      document.getElementById("soreCentorPanel").hidden = mode === "feverpain";
      document.getElementById("soreAgePanel").hidden = mode !== "mcisaac";
      clearResult("sorethroat", "Выберите шкалу и отметьте критерии.");
      document.getElementById("sorethroatUnit").textContent = mode === "centor" ? "из 4" : "из 5";
    }
    document.querySelectorAll('input[name="soreMode"]').forEach(el => el.addEventListener("change", updateSoreMode));

    function updateQtcMode() {
      const mode = document.querySelector('input[name="qtcInputMode"]:checked').value;
      document.getElementById("qtcHrPanel").hidden = mode !== "hr";
      document.getElementById("qtcRrPanel").hidden = mode !== "rr";
      clearResult("qtc", "Введите QT, ЧСС или RR и пол.");
      resetAuxiliaryMetrics("qtc");
    }
    document.querySelectorAll('input[name="qtcInputMode"]').forEach(el => el.addEventListener("change", updateQtcMode));

    function updateElectroMode() {
      const mode = document.querySelector('input[name="electroMode"]:checked').value;
      setModePanels('electroMode', {
        calcium:"electroCalciumPanel", anion:"electroAnionPanel", sodium:"electroSodiumPanel",
        osm:"electroOsmPanel", water:"electroWaterPanel"
      }, mode);
      clearResult("electrolytes", "Выберите расчёт и заполните данные.");
      const labels = {
        calcium:["Скорректированный кальций","ммоль/л"],
        anion:["Анионная разница","ммоль/л"],
        sodium:["Натрий с поправкой","ммоль/л"],
        osm:["Расчётная осмоляльность","мОсм/кг"],
        water:["Дефицит свободной воды","л"]
      };
      document.getElementById("electrolytesLabel").textContent = labels[mode][0];
      document.getElementById("electrolytesUnit").textContent = labels[mode][1];
    }
    document.querySelectorAll('input[name="electroMode"]').forEach(el => el.addEventListener("change", updateElectroMode));

    const copyTimers = new WeakMap();

    document.querySelectorAll(".copy-button").forEach((button) => {
      button.addEventListener("click", async () => {
        const key = button.dataset.copy;
        const text = state.results[key];
        if (!text) return;

        let copied = false;
        try {
          await navigator.clipboard.writeText(text);
          copied = true;
        } catch {
          const textarea = document.createElement("textarea");
          textarea.value = text;
          textarea.style.position = "fixed";
          textarea.style.opacity = "0";
          document.body.appendChild(textarea);
          textarea.select();
          try { copied = document.execCommand("copy"); }
          catch { copied = false; }
          finally { textarea.remove(); }
        }

        const original = button.dataset.originalText || button.textContent;
        button.dataset.originalText = original;
        button.textContent = copied ? "Скопировано" : "Не удалось";
        clearTimeout(copyTimers.get(button));
        copyTimers.set(button, setTimeout(() => {
          button.textContent = original;
          copyTimers.delete(button);
        }, 1300));
      });
    });

    function resetAll() {
      document.querySelectorAll("form").forEach(form => form.reset());
      document.getElementById("tsatTibcPanel").hidden = false;
      document.getElementById("tsatTransferrinPanel").hidden = true;
      updateVteMode();
      updatePneumoniaMode();
      updateSoreMode();
      updateQtcMode();
      updateElectroMode();
      clearResult("bmi", "Введите массу тела и рост.");
      clearResult("egfr", "Введите возраст, пол и креатинин.");
      clearResult("mentzer", "Введите MCV и число эритроцитов.");
      clearResult("tsat", "Введите показатели обмена железа.");
      clearResult("score2", "Введите данные пациента.");
      clearResult("prevent", "Введите данные пациента.");
      clearResult("phq9", "Ответьте на 9 вопросов.");
      clearResult("gad7", "Ответьте на 7 вопросов.");
      clearResult("mmse", "Отметьте правильно выполненные задания.");
      clearResult("fib4", "Введите возраст, АСТ, АЛТ и тромбоциты.");
      clearResult("maf5", "Введите антропометрию и лабораторные данные.");
      clearResult("liverpro", "Введите результат из сертифицированной системы.");
      clearResult("adapt", "Введите возраст, PRO-C3 и тромбоциты.");
      clearResult("stopbang", "Отметьте критерии.");
      clearResult("epworth", "Ответь на все восемь вопросов.");
      clearResult("afstroke", "Введите возраст, пол и отметьте факторы риска.");
      clearResult("vte", "Выберите инструмент и заполните данные.");
      clearResult("pneumonia", "Введите показатели пациента.");
      clearResult("sorethroat", "Выберите шкалу и отметьте критерии.");
      clearResult("qtc", "Введите QT, ЧСС или RR и пол.");
      clearResult("electrolytes", "Выберите расчёт и заполните данные.");
      clearResult("grace", "Введите данные пациента.");
      clearResult("hasbled", "Введите возраст и отметьте факторы.");
      clearResult("cadptp", "Введите возраст, пол и тип симптомов.");
      clearResult("dlcn", "Заполните критерии.");
      clearResult("precisedapt", "Введите пять параметров.");
      clearResult("frax", "Заполните антропометрию и факторы риска.");
      clearResult("egfrcys", "Введите возраст, пол и цистатин C.");
      resetAuxiliaryMetrics("egfrcys");
      document.getElementById("vteResultUnit").textContent = "баллов";
      document.getElementById("pneumoniaUnit").textContent = "из 4";
      document.getElementById("sorethroatUnit").textContent = "из 5";
      resetAuxiliaryMetrics("qtc");
      document.getElementById("electrolytesLabel").textContent = "Скорректированный кальций";
      document.getElementById("electrolytesUnit").textContent = "ммоль/л";
      resetSearchFiltering();
      if (mobileSearch) {
        mobileSearch.value = "";
        renderMobileSuggestions("");
      }
      closeMobileSearch(false);
      window.scrollTo({
        top: 0,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
      });
    }

    document.getElementById("resetAll")?.addEventListener("click", resetAll);

    function safeStorageGet(key) {
      try { return window.localStorage.getItem(key); }
      catch { return null; }
    }

    function safeStorageSet(key, value) {
      try { window.localStorage.setItem(key, value); }
      catch { /* Приложение продолжает работать без сохранения темы. */ }
    }

    const themeButtons = document.querySelectorAll(".theme-toggle");
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    const savedTheme = safeStorageGet("medical-calculators-clay-theme");
    if (savedTheme === "night") document.documentElement.dataset.theme = "night";

    function updateThemeColor() {
      themeColorMeta?.setAttribute(
        "content",
        document.documentElement.dataset.theme === "night" ? "#2d2932" : "#f6ead9"
      );
    }

    updateThemeColor();

    themeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const night = document.documentElement.dataset.theme === "night";
        if (night) {
          delete document.documentElement.dataset.theme;
          safeStorageSet("medical-calculators-clay-theme", "light");
        } else {
          document.documentElement.dataset.theme = "night";
          safeStorageSet("medical-calculators-clay-theme", "night");
        }
        updateThemeColor();
      });
    });

    function preferredScrollBehavior() {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    }

    const navButtons = document.querySelectorAll(".nav-button");
    navButtons.forEach((button) => {
      button.addEventListener("click", () => {
        navButtons.forEach(item => item.classList.remove("active"));
        button.classList.add("active");
        document.getElementById(button.dataset.target).scrollIntoView({ behavior: preferredScrollBehavior(), block: "start" });
      });
    });

    const sections = Array.from(document.querySelectorAll(".calculator"));
    const search = document.getElementById("calculatorSearch");
    const mobileSearch = document.getElementById("mobileCalculatorSearch");
    const mobileSearchPanel = document.getElementById("mobileSearchPanel");
    const mobileSearchToggle = document.getElementById("mobileSearchToggle");
    const mobileSearchClose = document.getElementById("mobileSearchClose");
    const mobileSearchSuggestions = document.getElementById("mobileSearchSuggestions");
    const mobileSearchHint = document.querySelector(".mobile-search-hint");
    const emptySearch = document.getElementById("emptySearch");
    const calculatorGroups = Array.from(document.querySelectorAll(".calculator-group"));
    const navGroups = Array.from(document.querySelectorAll(".nav-group"));

    let mobileSuggestionMatches = [];
    let activeSuggestionIndex = -1;

    function normalizeSearchText(value) {
      return String(value || "")
        .toLowerCase()
        .replace(/ё/g, "е")
        .replace(/[₂²]/g, "2")
        .replace(/[₃³]/g, "3")
        .replace(/[₄⁴]/g, "4")
        .replace(/[₅⁵]/g, "5")
        .replace(/[₆⁶]/g, "6")
        .replace(/[₇⁷]/g, "7")
        .replace(/[₈⁸]/g, "8")
        .replace(/[₉⁹]/g, "9")
        .replace(/[^a-zа-я0-9%]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");
    }

    const searchCatalog = Array.from(navButtons).map((button) => {
      const target = button.dataset.target;
      const section = document.getElementById(target);
      const title = button.querySelector(".nav-copy strong")?.textContent.trim() || target;
      const subtitle = button.querySelector(".nav-copy small")?.textContent.trim() || "";
      const navGroup = button.closest(".nav-group");
      const category = navGroup?.querySelector(".nav-group-copy strong")?.textContent.trim() || "";
      const iconText = button.querySelector(".mini-icon")?.textContent.trim() || title.slice(0, 2);
      const keywords = [
        button.dataset.search || "",
        section?.dataset.search || "",
        title,
        subtitle,
        category
      ].join(" ");

      return {
        target,
        title,
        subtitle,
        category,
        iconText: iconText.slice(0, 4),
        normalizedTitle: normalizeSearchText(title),
        normalizedTitleWords: normalizeSearchText(title).split(" "),
        normalizedSubtitle: normalizeSearchText(subtitle),
        normalizedKeywords: normalizeSearchText(keywords)
      };
    });

    function scoreSearchItem(item, query) {
      if (!query) return 0;

      const compactQuery = query.replace(/\s+/g, "");
      const compactTitle = item.normalizedTitle.replace(/\s+/g, "");
      const tokens = query.split(" ").filter(Boolean);

      let score = 0;

      if (item.normalizedTitle === query) score += 500;
      if (item.normalizedTitle.startsWith(query)) score += 260;
      if (compactTitle.startsWith(compactQuery)) score += 220;
      if (item.normalizedTitle.includes(query)) score += 170;
      if (item.normalizedSubtitle.includes(query)) score += 100;
      if (item.normalizedKeywords.includes(query)) score += 80;

      let matchedTokens = 0;
      tokens.forEach((token) => {
        if (item.normalizedTitleWords.some((word) => word.startsWith(token))) {
          score += 70;
          matchedTokens += 1;
        } else if (item.normalizedKeywords.includes(token)) {
          score += 35;
          matchedTokens += 1;
        }
      });

      if (matchedTokens !== tokens.length) return 0;
      score += matchedTokens * 10;
      return score;
    }

    function getMobileSuggestions(query) {
      return searchCatalog
        .map((item) => ({ ...item, score: scoreSearchItem(item, query) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "ru"))
        .slice(0, 8);
    }

    let sectionSearchIndex = null;
    let navSearchIndex = null;

    function ensureDesktopSearchIndex() {
      if (!sectionSearchIndex) {
        sectionSearchIndex = sections.map((section) => {
          const staticText = Array.from(section.querySelectorAll(
            ".calc-heading, details, label, .info-callout, .license-note"
          )).map((element) => element.textContent).join(" ");
          return {
            element: section,
            haystack: normalizeSearchText((section.dataset.search || "") + " " + staticText)
          };
        });
      }
      if (!navSearchIndex) {
        navSearchIndex = Array.from(navButtons, (button) => ({
          element: button,
          haystack: normalizeSearchText((button.dataset.search || "") + " " + button.textContent)
        }));
      }
    }

    function applyDesktopSearchFilter(rawValue) {
      const query = normalizeSearchText(rawValue);
      if (!query) {
        resetSearchFiltering();
        return;
      }
      ensureDesktopSearchIndex();
      const tokens = query.split(" ");
      let visibleCount = 0;

      sectionSearchIndex.forEach(({ element, haystack }) => {
        const visible = tokens.every((token) => haystack.includes(token));
        element.hidden = !visible;
        if (visible) visibleCount += 1;
      });

      navSearchIndex.forEach(({ element, haystack }) => {
        element.hidden = !tokens.every((token) => haystack.includes(token));
      });

      calculatorGroups.forEach((group) => {
        group.hidden = !Array.from(group.querySelectorAll(".calculator"))
          .some((section) => !section.hidden);
      });

      navGroups.forEach((group) => {
        group.hidden = !Array.from(group.querySelectorAll(".nav-button"))
          .some((button) => !button.hidden);
      });

      if (emptySearch) emptySearch.hidden = visibleCount !== 0;
    }

    function resetSearchFiltering() {
      if (search) search.value = "";
      sections.forEach((section) => { section.hidden = false; });
      navButtons.forEach((button) => { button.hidden = false; });
      [...calculatorGroups, ...navGroups].forEach((group) => {
        group.hidden = false;
      });
      if (emptySearch) emptySearch.hidden = true;
    }

    function setActiveSuggestion(index) {
      const buttons = Array.from(mobileSearchSuggestions?.querySelectorAll(".mobile-search-suggestion") || []);
      if (!buttons.length) {
        activeSuggestionIndex = -1;
        mobileSearch?.removeAttribute("aria-activedescendant");
        return;
      }

      activeSuggestionIndex = Math.max(0, Math.min(index, buttons.length - 1));
      buttons.forEach((button, buttonIndex) => {
        const active = buttonIndex === activeSuggestionIndex;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-selected", active ? "true" : "false");
        if (active) {
          mobileSearch?.setAttribute("aria-activedescendant", button.id);
          button.scrollIntoView({ block: "nearest" });
        }
      });
    }

    function selectSearchSuggestion(item) {
      if (!item) return;

      resetSearchFiltering();
      if (mobileSearch) mobileSearch.value = "";
      if (mobileSearchSuggestions) {
        mobileSearchSuggestions.hidden = true;
        mobileSearchSuggestions.innerHTML = "";
      }
      if (mobileSearchHint) mobileSearchHint.hidden = false;

      closeMobileSearch(false);

      navButtons.forEach((button) => {
        button.classList.toggle("active", button.dataset.target === item.target);
      });

      const target = document.getElementById(item.target);
      if (target) {
        requestAnimationFrame(() => {
          target.setAttribute("tabindex", "-1");
          target.scrollIntoView({ behavior: preferredScrollBehavior(), block: "start" });
          target.focus({ preventScroll: true });
        });
      }
    }

    function renderMobileSuggestions(rawValue) {
      if (!mobileSearchSuggestions) return;

      const query = normalizeSearchText(rawValue);
      activeSuggestionIndex = -1;
      mobileSearch?.removeAttribute("aria-activedescendant");
      mobileSearchSuggestions.innerHTML = "";

      if (!query) {
        mobileSuggestionMatches = [];
        mobileSearchSuggestions.hidden = true;
        mobileSearch?.setAttribute("aria-expanded", "false");
        if (mobileSearchHint) mobileSearchHint.hidden = false;
        return;
      }

      mobileSuggestionMatches = getMobileSuggestions(query);
      mobileSearchSuggestions.hidden = false;
      mobileSearch?.setAttribute("aria-expanded", "true");
      if (mobileSearchHint) mobileSearchHint.hidden = true;

      if (!mobileSuggestionMatches.length) {
        const empty = document.createElement("div");
        empty.className = "mobile-search-empty";
        empty.textContent = "Подходящих калькуляторов или опросников не найдено.";
        mobileSearchSuggestions.appendChild(empty);
        return;
      }

      mobileSuggestionMatches.forEach((item, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "mobile-search-suggestion";
        button.id = "mobileSearchOption-" + item.target;
        button.setAttribute("role", "option");
        button.setAttribute("aria-selected", "false");

        const icon = document.createElement("span");
        icon.className = "mobile-search-suggestion-icon";
        icon.textContent = item.iconText || "＋";

        const copy = document.createElement("span");
        copy.className = "mobile-search-suggestion-copy";

        const title = document.createElement("strong");
        title.className = "mobile-search-suggestion-title";
        title.textContent = item.title;

        const subtitle = document.createElement("span");
        subtitle.className = "mobile-search-suggestion-subtitle";
        subtitle.textContent = item.subtitle;

        const category = document.createElement("span");
        category.className = "mobile-search-suggestion-category";
        category.textContent = item.category;

        const arrow = document.createElement("span");
        arrow.className = "mobile-search-suggestion-arrow";
        arrow.textContent = "›";

        copy.append(title, subtitle, category);
        button.append(icon, copy, arrow);

        button.addEventListener("click", () => selectSearchSuggestion(item));
        button.addEventListener("pointerenter", () => setActiveSuggestion(index));
        mobileSearchSuggestions.appendChild(button);
      });
    }

    function openMobileSearch() {
      if (!mobileSearchPanel) return;
      mobileSearchPanel.hidden = false;
      mobileSearchToggle?.setAttribute("aria-expanded", "true");
      mobileSearch?.setAttribute(
        "aria-expanded",
        mobileSearchSuggestions && !mobileSearchSuggestions.hidden ? "true" : "false"
      );
      requestAnimationFrame(() => mobileSearch?.focus());
    }

    function closeMobileSearch(restoreFocus = true) {
      if (!mobileSearchPanel) return;
      mobileSearchPanel.hidden = true;
      mobileSearchToggle?.setAttribute("aria-expanded", "false");
      mobileSearch?.setAttribute("aria-expanded", "false");
      mobileSearch?.removeAttribute("aria-activedescendant");
      activeSuggestionIndex = -1;
      if (restoreFocus) mobileSearchToggle?.focus();
    }

    mobileSearchToggle?.addEventListener("click", () => {
      if (mobileSearchPanel?.hidden) openMobileSearch();
      else closeMobileSearch();
    });

    mobileSearchClose?.addEventListener("click", closeMobileSearch);

    let desktopSearchFrame = 0;
    search?.addEventListener("input", () => {
      cancelAnimationFrame(desktopSearchFrame);
      desktopSearchFrame = requestAnimationFrame(() => applyDesktopSearchFilter(search.value));
    });

    mobileSearch?.addEventListener("input", () => {
      renderMobileSuggestions(mobileSearch.value);
    });

    mobileSearch?.addEventListener("search", () => {
      renderMobileSuggestions(mobileSearch.value);
    });

    mobileSearch?.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (mobileSuggestionMatches.length) {
          setActiveSuggestion(activeSuggestionIndex < 0 ? 0 : activeSuggestionIndex + 1);
        }
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        if (mobileSuggestionMatches.length) {
          setActiveSuggestion(activeSuggestionIndex <= 0 ? mobileSuggestionMatches.length - 1 : activeSuggestionIndex - 1);
        }
      } else if (event.key === "Enter") {
        if (mobileSuggestionMatches.length) {
          event.preventDefault();
          const index = activeSuggestionIndex >= 0 ? activeSuggestionIndex : 0;
          selectSearchSuggestion(mobileSuggestionMatches[index]);
        }
      } else if (event.key === "Escape") {
        closeMobileSearch();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && mobileSearchPanel && !mobileSearchPanel.hidden) {
        closeMobileSearch();
      }
    });

    applyDesktopSearchFilter(search ? search.value : "");


    function bindLinkedUnits(firstId, secondId, firstInputId, secondInputId) {
      const first = document.getElementById(firstId);
      const second = document.getElementById(secondId);
      if (!first || !second) return;

      const applyPlaceholders = () => {
        const mgdl = first.value === "mgdl";
        const firstInput = document.getElementById(firstInputId);
        const secondInput = document.getElementById(secondInputId);
        if (firstInput) firstInput.placeholder = mgdl ? "Например, 212" : "Например, 5,5";
        if (secondInput) secondInput.placeholder = mgdl ? "Например, 50" : "Например, 1,3";
      };

      first.addEventListener("change", () => {
        second.value = first.value;
        applyPlaceholders();
      });
      second.addEventListener("change", () => {
        first.value = second.value;
        applyPlaceholders();
      });
      first.closest("form")?.addEventListener("reset", () => {
        requestAnimationFrame(applyPlaceholders);
      });
      applyPlaceholders();
    }

    bindLinkedUnits("score2TcUnit", "score2HdlUnit", "score2Tc", "score2Hdl");
    bindLinkedUnits("preventTcUnit", "preventHdlUnit", "preventTc", "preventHdl");

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver((entries) => {
        const visible = entries
          .filter(entry => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (!visible) return;
        navButtons.forEach(button => {
          button.classList.toggle("active", button.dataset.target === visible.target.id);
        });
      }, { rootMargin: "-25% 0px -60% 0px", threshold: [0.05, 0.2, 0.5] });

      sections.forEach(section => observer.observe(section));
    }
