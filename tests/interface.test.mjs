import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const cssPath = html.match(/<link href="([^"]+\.css)"/)?.[1];
const css = await readFile(new URL("../" + cssPath, import.meta.url), "utf8");

test("компактный верх: служебная информация свёрнута, обновление доступно снаружи", () => {
  const hero = html.match(/<section class="hero">([\s\S]*?)<\/section>/)?.[1];
  assert.ok(hero);
  assert.match(hero, /<h1 class="sr-only">Медкалькуляторы<\/h1>/);
  assert.doesNotMatch(hero, /Нужный расчёт|Найдите калькулятор|Отметьте нужные|Необязательно ·/);
  assert.match(hero, /id="patientPanel"><summary>Данные пациента<\/summary>/);
  const about = hero.match(/<details class="app-info" id="appInfo">([\s\S]*?)<\/details>/)?.[1];
  assert.ok(about);
  assert.match(about, /id="offlineStatus"/);
  assert.match(about, /<time datetime="2026-09-20">/);
  assert.doesNotMatch(about, /id="appUpdate"/);
  assert.match(hero, /<button id="appUpdate"[^>]*\bhidden>/);
});

test("все 30 пустых результатов скрывают числа и копирование, но не клинические заметки", () => {
  const boxes = [...html.matchAll(/<div aria-live="polite" class="result-box">([\s\S]*?)<button class="copy-button" data-copy="([^"]+)"([^>]*)>/g)];
  assert.equal(boxes.length, 30);
  for (const [, content, key, attributes] of boxes) {
    assert.ok(content.includes('class="result-note" id="' + key + 'Note"'), key);
    assert.match(attributes, /\bdisabled\b/);
  }
  assert.match(css, /\.result-box:not\(\[data-ready="true"\]\) > :not\(\.result-note\)\s*\{\s*display:\s*none;/);
  assert.doesNotMatch(css, /\.result-box:not\(\[data-ready="true"\]\)\s*\{[^}]*display:\s*none/);
});

test("пояснение о креатинине находится у СКФ, а не у возраста диагноза", () => {
  const fields = html.slice(html.indexOf('<label for="score2diabetesDiagnosisAge"'), html.indexOf('<label for="score2diabetesUacrCategory"'));
  const split = fields.indexOf('<label for="score2diabetesEgfr"');
  assert.ok(split > 0);
  assert.doesNotMatch(fields.slice(0, split), /По креатинину/);
  assert.match(fields.slice(split), /По креатинину, как в авторской модели/);
});
