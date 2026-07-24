import { b } from "./browser.js";

b.runtime.onInstalled.addListener((details) => {
  console.log("[@-Mapper] installed", details.reason);
});