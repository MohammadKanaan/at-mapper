import test from "node:test";
import assert from "node:assert/strict";

import * as mappings from "../dist/shared/mappings.js";
import * as popup from "../dist/autocomplete/popup.js";
import { activateAddForm } from "../dist/autocomplete/add-form.js";

class FakeElement {
  constructor() {
    this.classList = {
      add() {},
      remove() {},
    };
    this.dataset = {};
    this.listeners = new Map();
    this.parentNode = null;
    this.textContent = "";
  }

  setAttribute() {}
  removeAttribute() {}
  appendChild(child) {
    child.parentNode = this;
    this.child = child;
    return child;
  }
  focus() {}
  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }
}

test("mapping empty-state copy distinguishes an empty library from an empty search", () => {
  assert.equal(
    mappings.getMappingEmptyMessage(0, ""),
    "No mappings yet. Add your first shortcut above.",
  );
  assert.equal(
    mappings.getMappingEmptyMessage(3, "invoice"),
    'No matches for "invoice".',
  );
});

test("adding a mapping from autocomplete immediately replaces the active token", () => {
  const originalDocument = globalThis.document;
  globalThis.document = {
    createElement: () => new FakeElement(),
  };

  try {
    const editor = new FakeElement();
    const addRow = new FakeElement();
    const state = {
      popup: { contains: () => true },
      active: { target: { el: editor, kind: "input" }, token: { trigger: "@", word: "sig", start: 0, end: 4 } },
      selectedIdx: 0,
      composing: false,
      blurTimer: null,
      items: [],
      attached: new Map(),
    };
    const added = [];
    let replacement = null;
    const hidePopup = () => {
      state.active = null;
    };
    const applyMapping = (value) => {
      if (state.active) replacement = value;
      hidePopup();
    };

    activateAddForm(
      state,
      "sig",
      addRow,
      "@",
      (key, value) => added.push([key, value]),
      applyMapping,
      hidePopup,
      () => {},
    );

    addRow.child.value = "Best regards";
    addRow.child.listeners.get("keydown")({
      key: "Enter",
      preventDefault() {},
      stopPropagation() {},
    });

    assert.deepEqual(added, [["sig", "Best regards"]]);
    assert.equal(replacement, "Best regards");
  } finally {
    globalThis.document = originalDocument;
  }
});

test("autocomplete popup stays inside narrow viewports", () => {
  assert.equal(popup.clampPopupLeft(-12, 180, 220, 8), 8);
  assert.equal(popup.clampPopupLeft(170, 180, 220, 8), 8);
  assert.equal(popup.clampPopupLeft(280, 360, 220, 8), 132);
  assert.equal(popup.clampPopupLeft(48, 360, 220, 8), 48);
});

test("portable DOM helpers create accessible icon buttons", async () => {
  class FakeElement {
    constructor(tagName) {
      this.tagName = tagName;
      this.attributes = new Map();
      this.children = [];
      this.className = "";
      this.textContent = "";
      this.title = "";
      this.type = "";
    }

    setAttribute(name, value) {
      this.attributes.set(name, value);
    }

    append(...children) {
      this.children.push(...children);
    }

    appendChild(child) {
      this.children.push(child);
      return child;
    }
  }

  const originalDocument = globalThis.document;
  globalThis.document = {
    createElement: (tagName) => new FakeElement(tagName),
    createElementNS: (_namespace, tagName) => new FakeElement(tagName),
  };

  try {
    const { createUiButton } = await import("../dist/ui/index.js");
    const button = createUiButton({
      label: "Delete @invoice",
      variant: "icon",
      density: "compact",
      icon: "delete",
      title: "Delete mapping",
    });

    assert.equal(button.type, "button");
    assert.equal(button.className, "ui-button ui-button--icon ui-button--compact");
    assert.equal(button.attributes.get("aria-label"), "Delete @invoice");
    assert.equal(button.title, "Delete mapping");
    assert.equal(button.children[0].tagName, "svg");
    assert.equal(button.children[0].attributes.get("aria-hidden"), "true");
  } finally {
    globalThis.document = originalDocument;
  }
});
