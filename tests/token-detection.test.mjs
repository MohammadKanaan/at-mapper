import test from "node:test";
import assert from "node:assert/strict";

// We test getTokenBeforeCaret and replaceToken from dist/text.js.
// These need DOM-like mocks for textarea/input (simple) and contenteditable (complex).

// ── Helpers ─────────────────────────────────────────────────────

function makeTextarea(value, selectionStart) {
  return {
    value,
    selectionStart,
    selectionEnd: selectionStart,
    tagName: "TEXTAREA",
    focus() {},
    setSelectionRange(start, end) {
      this.selectionStart = start;
      this.selectionEnd = end;
    },
  };
}

function makeInput(value, selectionStart) {
  return {
    value,
    selectionStart,
    selectionEnd: selectionStart,
    tagName: "INPUT",
    type: "text",
    focus() {},
    setSelectionRange(start, end) {
      this.selectionStart = start;
      this.selectionEnd = end;
    },
  };
}

// ── Tests ───────────────────────────────────────────────────────

const { getTokenBeforeCaret } = await import("../dist/text.js");

test("getTokenBeforeCaret finds @token in textarea at end of value", () => {
  const el = makeTextarea("hello @world", 12);
  const token = getTokenBeforeCaret(el, "textarea", "@");
  assert.notEqual(token, null);
  assert.equal(token.word, "world");
  assert.equal(token.trigger, "@");
  assert.equal(token.start, 6);
  assert.equal(token.end, 12);
});

test("getTokenBeforeCaret finds @token in textarea mid-value", () => {
  const el = makeTextarea("hello @world rest", 12);
  const token = getTokenBeforeCaret(el, "textarea", "@");
  assert.notEqual(token, null);
  assert.equal(token.word, "world");
  assert.equal(token.start, 6);
  assert.equal(token.end, 12);
});

test("getTokenBeforeCaret returns null when no trigger in textarea", () => {
  const el = makeTextarea("hello world", 11);
  assert.equal(getTokenBeforeCaret(el, "textarea", "@"), null);
});

test("getTokenBeforeCaret returns null when token is empty", () => {
  // Just typed @ with nothing after
  const el = makeTextarea("hello @", 7);
  assert.equal(getTokenBeforeCaret(el, "textarea", "@"), null);
});

test("getTokenBeforeCaret returns null at position 0", () => {
  const el = makeTextarea("", 0);
  assert.equal(getTokenBeforeCaret(el, "textarea", "@"), null);
});

test("getTokenBeforeCaret finds token in input", () => {
  const el = makeInput("search @term", 12);
  const token = getTokenBeforeCaret(el, "input", "@");
  assert.notEqual(token, null);
  assert.equal(token.word, "term");
  assert.equal(token.start, 7);
  assert.equal(token.end, 12);
});

test("getTokenBeforeCaret stops at whitespace boundary", () => {
  const el = makeTextarea("first @word second @other", 25);
  const token = getTokenBeforeCaret(el, "textarea", "@");
  assert.notEqual(token, null);
  assert.equal(token.word, "other");
  assert.equal(token.start, 19);
  assert.equal(token.end, 25);
});

test("getTokenBeforeCaret stops at trigger character boundary", () => {
  // User types @first then @second — the @ before second ends the first token
  const el = makeTextarea("@first@second", 13);
  const token = getTokenBeforeCaret(el, "textarea", "@");
  assert.notEqual(token, null);
  assert.equal(token.word, "second");
  assert.equal(token.start, 6);
  assert.equal(token.end, 13);
});

test("getTokenBeforeCaret works with custom trigger character", () => {
  const el = makeTextarea("hello #tag", 10);
  const token = getTokenBeforeCaret(el, "textarea", "#");
  assert.notEqual(token, null);
  assert.equal(token.word, "tag");
  assert.equal(token.trigger, "#");
  assert.equal(token.start, 6);
  assert.equal(token.end, 10);
});

test("getTokenBeforeCaret handles trigger that is regex special char", () => {
  // + is a regex special character
  const el = makeTextarea("hello +word", 11);
  const token = getTokenBeforeCaret(el, "textarea", "+");
  assert.notEqual(token, null);
  assert.equal(token.word, "word");
  assert.equal(token.start, 6);
  assert.equal(token.end, 11);
});

test("getTokenBeforeCaret handles dot trigger", () => {
  const el = makeTextarea("hello .word", 11);
  const token = getTokenBeforeCaret(el, "textarea", ".");
  assert.notEqual(token, null);
  assert.equal(token.word, "word");
});

test("getTokenBeforeCaret handles paren trigger", () => {
  const el = makeTextarea("hello (word", 11);
  const token = getTokenBeforeCaret(el, "textarea", "(");
  assert.notEqual(token, null);
  assert.equal(token.word, "word");
});

test("getTokenBeforeCaret returns null when caret is right after space", () => {
  const el = makeTextarea("@word ", 6);
  assert.equal(getTokenBeforeCaret(el, "textarea", "@"), null);
});

test("getTokenBeforeCaret handles empty input", () => {
  const el = makeInput("", 0);
  assert.equal(getTokenBeforeCaret(el, "input", "@"), null);
});
