import test from "node:test";
import assert from "node:assert/strict";
import { TEMPLATES, templateProject } from "../dist/src/templates.js";
import { validate, totalTicks, parseProject } from "../dist/src/model.js";
for (const item of TEMPLATES)
  test(
    "starter arrangement is valid/editable and never runs past its last bar: " +
      item.id,
    () => {
      const p = templateProject(item.id);
      assert.equal(validate(p), p);
      assert.deepEqual(parseProject(JSON.stringify(p)), p);
      assert(
        p.tracks.every((t) =>
          t.notes.every((n) => n.start + n.duration <= totalTicks(p)),
        ),
      );
    },
  );
