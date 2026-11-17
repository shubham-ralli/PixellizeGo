import { describe, expect, it } from "vitest";
import { slugify } from "./slug.js";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });
  it("strips accents and punctuation", () => {
    expect(slugify("Café & Crème!!")).toBe("cafe-creme");
  });
  it("trims leading/trailing separators", () => {
    expect(slugify("  --Draft Post--  ")).toBe("draft-post");
  });
  it("falls back to empty string for symbol-only input", () => {
    expect(slugify("@#$%")).toBe("");
  });
});
