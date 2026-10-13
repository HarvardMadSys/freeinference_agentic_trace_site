import assert from "node:assert/strict";
import { test } from "node:test";

import {
  backLinkHref, readAddress, requestParameters, selectionParameters, viewParameters,
} from "../site/js/session/address.js";

test("the address names the week, the session, the view and the step", () => {
  const params = new URLSearchParams("week=2026-08-09&id=abc&view=timeline&step=12");
  assert.deepEqual(readAddress(params), { week: "2026-08-09", id: "abc", view: "timeline", step: 12 });
});

test("with no view, or an unknown one, the Requests view opens", () => {
  assert.equal(readAddress(new URLSearchParams("week=2026-08-09&id=abc")).view, "requests");
  assert.equal(readAddress(new URLSearchParams("view=chart")).view, "requests");
});

test("a missing week or id is null", () => {
  assert.deepEqual(readAddress(new URLSearchParams("")), { week: null, id: null, view: "requests", step: null });
});

test("a step that is not a whole number is no step", () => {
  for (const step of ["", "-1", "1.5", "twelve", "3a"]) {
    assert.equal(readAddress(new URLSearchParams({ step })).step, null, step);
  }
  assert.equal(readAddress(new URLSearchParams("step=0")).step, 0);
});

test("the selection is every key but the Session page's own", () => {
  const params = new URLSearchParams("week=2026-08-09&id=abc&view=context&step=3&month=2026-08&harnesses=codex&q=ab");
  assert.equal(selectionParameters(params).toString(), "month=2026-08&harnesses=codex&q=ab");
});

test("a view's parameters keep the session and the selection, set the view and drop the step", () => {
  const params = new URLSearchParams("week=2026-08-09&id=abc&step=3&harnesses=codex");
  assert.equal(viewParameters(params, "timeline").toString(), "week=2026-08-09&id=abc&harnesses=codex&view=timeline");
  assert.equal(params.get("step"), "3");
});

test("a request's parameters open the Requests view at that session's step, keeping the week and the selection", () => {
  const params = new URLSearchParams("week=2026-08-09&id=root&view=timeline&harnesses=codex");
  const opened = requestParameters(params, "child", 4);
  assert.equal(opened.toString(), "week=2026-08-09&id=child&view=requests&harnesses=codex&step=4");
  assert.deepEqual(readAddress(opened), { week: "2026-08-09", id: "child", view: "requests", step: 4 });
});

test("the link back opens the Session Explorer with the table's keys as given, and the Session page's dropped", () => {
  const params = new URLSearchParams("week=2026-08-09&id=abc&view=context&step=3&harnesses=hermes,codex&sort=requests");
  assert.equal(backLinkHref(params), "index.html?harnesses=hermes,codex&sort=requests#sessions");
});

test("with no table keys the link back opens the Session Explorer alone", () => {
  assert.equal(backLinkHref(new URLSearchParams("week=2026-08-09&id=abc")), "index.html#sessions");
  assert.equal(backLinkHref(new URLSearchParams()), "index.html#sessions");
});
