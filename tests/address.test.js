import assert from "node:assert/strict";
import { test } from "node:test";

import { readAddress, selectionParameters, viewParameters } from "../site/js/session/address.js";

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
  const params = new URLSearchParams("week=2026-08-09&id=abc&view=context&step=3&weeks=all&scope=All&q=ab");
  assert.equal(selectionParameters(params).toString(), "weeks=all&scope=All&q=ab");
});

test("a view's parameters keep the session and the selection, set the view and drop the step", () => {
  const params = new URLSearchParams("week=2026-08-09&id=abc&step=3&scope=All");
  assert.equal(viewParameters(params, "timeline").toString(), "week=2026-08-09&id=abc&scope=All&view=timeline");
  assert.equal(params.get("step"), "3");
});
