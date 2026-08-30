import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../web/js/app.js", import.meta.url), "utf8");

test("Live Score menyediakan refresh manual", () => {
  assert.match(app, /id="refresh-live-score"/);
  assert.match(app, /aria-label="Refresh Live Score"/);
  assert.match(app,
    /getElementById\("refresh-live-score"\)[\s\S]*?addEventListener\("click",[\s\S]*?layarLiveScore\(\)/);
});
