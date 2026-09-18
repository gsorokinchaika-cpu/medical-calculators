import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../sw.js", import.meta.url), "utf8");
const scope = "https://example.test/medical-calculators/";

function worker({ failInstall = false } = {}) {
  const handlers = {}, stores = new Map(), requested = [], removed = [];
  let claimed=0, skipped=0, networkCalls=0;
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const data=stores.get(name);
      return {
        async addAll(requests) {
          requested.push(...requests);
          if (failInstall) throw new Error("offline");
          for (const r of requests) data.set(r.url, "cached:"+r.url);
        },
        async match(key) { return data.get(key); }
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(key) { removed.push(key); return stores.delete(key); }
  };
  const self = { registration: { scope }, clients: { async claim() { claimed++; } },
    async skipWaiting() { skipped++; }, addEventListener(type, fn) { handlers[type]=fn; } };
  vm.runInNewContext(source, {self,caches,URL,Request,fetch:async()=>{networkCalls++;throw new Error("network off");}});
  async function dispatch(type, props={}) {
    let promise;
    handlers[type]({...props, waitUntil(p) {promise=p;}, respondWith(p) {promise=p;}});
    return promise ? await promise : undefined;
  }
  return { dispatch,stores,requested,removed,stats:()=>({claimed,skipped,networkCalls}) };
}

test("офлайн: в кэше только четыре локальных файла текущей сборки", async () => {
  const w=worker(); await w.dispatch("install");
  assert.equal(w.requested.length,4);
  for (const request of w.requested) {
    assert.equal(request.cache,"reload");
    const path=new URL(request.url).pathname.replace("/medical-calculators/","");
    await readFile(new URL("../"+path,import.meta.url));
    assert.equal(new URL(request.url).search, "");
  }
  assert.equal(w.stats().skipped,0);
});

test("офлайн: ошибка загрузки не активирует неполную сборку", async () => {
  const w=worker({failInstall:true});
  await assert.rejects(w.dispatch("install"), /offline/);
  assert.equal(w.stats().skipped,0);
  assert.equal(w.stats().claimed,0);
});

test("офлайн: навигация с query и якорем возвращает общую оболочку без сети", async () => {
  const w=worker(); await w.dispatch("install");
  for (const url of [scope,scope+"?v=3.7#score2",scope+"index.html?v=3.7"]) {
    assert.equal(await w.dispatch("fetch", { request:{method:"GET",mode:"navigate",url} }),"cached:"+scope+"index.html");
  }
  assert.equal(w.stats().networkCalls,0);
  assert.equal([...w.stores.values()][0].size,4);
});

test("офлайн: внешние запросы, API, POST и чужие страницы не перехватываются", async () => {
  const w=worker(); await w.dispatch("install");
  for (const request of [
    {method:"POST",mode:"navigate",url:scope},
    {method:"GET",mode:"cors",url:scope+"api/results"},
    {method:"GET",mode:"navigate",url:"https://external.test/"},
    {method:"GET",mode:"navigate",url:scope+"unknown.html"},
    {method:"GET",mode:"navigate",url:"https://example.test/another-app/"}
  ]) assert.equal(await w.dispatch("fetch",{request}),undefined);
  assert.equal(w.stats().networkCalls,0);
});

test("офлайн: активация чистит только прежние кэши этого приложения и scope", async () => {
  const w=worker(); await w.dispatch("install");
  const previous="medical-calculators::"+scope+"::3.6.0";
  w.stores.set(previous,new Map()); w.stores.set("another-app",new Map());
  w.stores.set("medical-calculators::https://example.test/other/::3.6.0",new Map());
  await w.dispatch("activate");
  assert.deepEqual(w.removed,[previous]);
  assert.equal(w.stores.size,3);
  assert.equal(w.stats().claimed,1);
});

test("офлайн: обновление только по явному сообщению из собственного scope", async () => {
  const w=worker();
  for (const message of [
    {data:{type:"OTHER"},source:{url:scope}},
    {data:{type:"ACTIVATE_UPDATE"},source:{url:"https://evil.test/"}},
    {data:{type:"ACTIVATE_UPDATE"},source:{url:"https://example.test/other/"}},
    {data:{type:"ACTIVATE_UPDATE"}}
  ]) await w.dispatch("message",message);
  assert.equal(w.stats().skipped,0);
  await w.dispatch("message",{data:{type:"ACTIVATE_UPDATE"},source:{url:scope+"?v=3.7"}});
  assert.equal(w.stats().skipped,1);
});

test("офлайн: утерянный кэш не подменяется чужой страницей и не сохраняет runtime-данные", async () => {
  const w=worker(); await w.dispatch("install");
  [...w.stores.values()][0].clear();
  await assert.rejects(w.dispatch("fetch", {request:{method:"GET",mode:"navigate",url:scope}}), /network off/);
  assert.equal([...w.stores.values()][0].size,0);
});
