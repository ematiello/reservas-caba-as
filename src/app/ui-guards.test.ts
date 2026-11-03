import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Guards for UI mistakes that broke the app before and that no page test would catch.

const css = readFileSync(join(__dirname, "globals.css"), "utf8");

/** Opening JSX tags named `name`, up to the `>` outside any `{...}` expression. */
function openingTags(source: string, name: string): string[] {
  const tags: string[] = [];
  for (const match of source.matchAll(new RegExp(`<${name}\\b`, "g"))) {
    let depth = 0;
    for (let i = match.index; i < source.length; i++) {
      const c = source[i];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0) {
        tags.push(source.slice(match.index, i + 1));
        break;
      }
    }
  }
  return tags;
}

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? tsxFiles(join(dir, e.name)) : e.name.endsWith(".tsx") ? [join(dir, e.name)] : [],
  );
}

describe("theme (globals.css)", () => {
  it("has no custom property that points to itself (it falls back to the browser default)", () => {
    // `--font-sans: var(--font-sans)` once turned every private page into Times New Roman.
    const selfRefs = [...css.matchAll(/(--[\w-]+)\s*:\s*var\(\s*(--[\w-]+)\s*[,)]/g)].filter(([, name, ref]) => name === ref);
    expect(selfRefs.map(([decl]) => decl)).toEqual([]);
  });

  it("uses the brand fonts loaded in the root layout for text and headings", () => {
    expect(css).toMatch(/--font-sans:\s*var\(--font-lato\)/);
    expect(css).toMatch(/--font-heading:\s*var\(--font-montserrat\)/);
    const layout = readFileSync(join(__dirname, "layout.tsx"), "utf8");
    expect(layout).toContain('variable: "--font-lato"');
    expect(layout).toContain('variable: "--font-montserrat"');
  });
});

describe("colors", () => {
  it("come from theme tokens, never hex, rgb or hsl values written in a component", () => {
    // A literal color in a class (`bg-[#d9913a]`, a shadow with `rgba(...)`) does not follow a brand
    // change. The brand drawings in src/components/brand are the exception: they are the artwork.
    const src = join(__dirname, "..");
    const offenders = tsxFiles(src)
      .filter((file) => !file.includes(join("components", "brand")))
      .flatMap((file) =>
        [...readFileSync(file, "utf8").matchAll(/[\w:-]+-\[[^\]]*(?:#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\()[^\]]*\]/g)].map(([cls]) => `${file}: ${cls}`),
      );
    expect(offenders).toEqual([]);
  });
});

describe("native form controls", () => {
  it("style every <select> and <textarea> with the shared brand classes", () => {
    // Hand-copied class strings drift from the brand; use selectClass / textareaClass.
    const offenders = tsxFiles(__dirname).flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return [
        ...openingTags(source, "select").filter((tag) => !tag.includes("selectClass")),
        ...openingTags(source, "textarea").filter((tag) => !tag.includes("textareaClass")),
      ].map((tag) => `${file}: ${tag.slice(0, 80)}`);
    });
    expect(offenders).toEqual([]);
  });
});
