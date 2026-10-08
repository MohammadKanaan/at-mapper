import { b } from "./browser.js";

b.runtime.onInstalled.addListener((details) => {
  console.log("[@mapper] installed", details.reason);
});