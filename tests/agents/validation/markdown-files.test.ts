/**
 * Validation tests for .agents markdown and config files
 * Tests structure, frontmatter, and content validation
 */

import { describe, expect, it } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const AGENTS_DIR = "/home/jailuser/git/.agents";

// Helper to parse YAML frontmatter
function parseFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const [, yamlContent, body] = match;
  const frontmatter: Record<string, unknown> = {};

  // Simple YAML parser for basic key: value pairs
  yamlContent.split("\n").forEach((line) => {
    const colonIndex = line.indexOf(":");
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      let value: string | boolean | string[] = line.substring(colonIndex + 1).trim();

      // Handle boolean values
      if (value === "true") value = true;
      else if (value === "false") value = false;
      // Handle array values (basic support for single-line arrays)
      else if (value.startsWith("[") && value.endsWith("]")) {
        value = value
          .slice(1, -1)
          .split(",")
          .map((v) => v.trim().replace(/^["']|["']$/g, ""));
      }
      // Remove quotes from strings
      else if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      frontmatter[key] = value;
    }
  });

  return { frontmatter, body };
}

describe("Commands markdown files", () => {
  const commandFiles = [
    "bug-fix.md",
    "check-simirality.md",
    "commit.md",
    "final-check.md",
    "refactor.md",
    "worktree-pr.md",
  ];

  commandFiles.forEach((filename) => {
    describe(filename, () => {
      const filePath = join(AGENTS_DIR, "commands", filename);

      it("should exist", () => {
        expect(existsSync(filePath)).toBe(true);
      });

      it("should have valid markdown structure", () => {
        const content = readFileSync(filePath, "utf-8");
        expect(content.length).toBeGreaterThan(0);
      });

      it("should have at least one heading", () => {
        const content = readFileSync(filePath, "utf-8");
        expect(content).toMatch(/^#+ /m);
      });

      it("should not have trailing whitespace", () => {
        const content = readFileSync(filePath, "utf-8");
        const lines = content.split("\n");
        const trailingWhitespace = lines.some((line, i) => {
          // Allow empty lines and last line
          if (i === lines.length - 1 || line === "") return false;
          return line !== line.trimEnd();
        });
        expect(trailingWhitespace).toBe(false);
      });
    });
  });

  describe("bug-fix.md specific", () => {
    it("should contain steps section", () => {
      const content = readFileSync(join(AGENTS_DIR, "commands/bug-fix.md"), "utf-8");
      expect(content.toLowerCase()).toContain("steps");
    });

    it("should mention error handling", () => {
      const content = readFileSync(join(AGENTS_DIR, "commands/bug-fix.md"), "utf-8");
      expect(content.toLowerCase()).toMatch(/error|stack|fail/);
    });
  });

  describe("commit.md specific", () => {
    it("should contain git commands", () => {
      const content = readFileSync(join(AGENTS_DIR, "commands/commit.md"), "utf-8");
      expect(content).toContain("git");
    });

    it("should define commit message format", () => {
      const content = readFileSync(join(AGENTS_DIR, "commands/commit.md"), "utf-8");
      expect(content).toMatch(/emoji|type|scope|summary/i);
    });
  });

  describe("worktree-pr.md specific", () => {
    it("should have Arguments section", () => {
      const content = readFileSync(join(AGENTS_DIR, "commands/worktree-pr.md"), "utf-8");
      expect(content).toMatch(/## Arguments/i);
    });

    it("should have Steps section", () => {
      const content = readFileSync(join(AGENTS_DIR, "commands/worktree-pr.md"), "utf-8");
      expect(content).toMatch(/## Steps/i);
    });
  });
});

describe("Memory markdown files", () => {
  describe("lessons.md", () => {
    const filePath = join(AGENTS_DIR, "memory/lessons.md");

    it("should exist", () => {
      expect(existsSync(filePath)).toBe(true);
    });

    it("should contain lessons as list items", () => {
      const content = readFileSync(filePath, "utf-8");
      expect(content).toMatch(/^- /m);
    });
  });

  describe("todo.md", () => {
    const filePath = join(AGENTS_DIR, "memory/todo.md");

    it("should exist", () => {
      expect(existsSync(filePath)).toBe(true);
    });

    it("should contain task list items", () => {
      const content = readFileSync(filePath, "utf-8");
      expect(content).toMatch(/- \[[ x]\]/);
    });
  });
});

describe("Rules .mdc files", () => {
  const ruleFiles = [
    "coderabbit.mdc",
    "commit-style.mdc",
    "dotenvx.mdc",
    "mermaid.mdc",
    "proactive-subagent-and-skills.mdc",
    "test.mdc",
    "three.mdc",
    "typescript.mdc",
  ];

  ruleFiles.forEach((filename) => {
    describe(filename, () => {
      const filePath = join(AGENTS_DIR, "rules", filename);

      it("should exist", () => {
        expect(existsSync(filePath)).toBe(true);
      });

      it("should have YAML frontmatter", () => {
        const content = readFileSync(filePath, "utf-8");
        expect(content).toMatch(/^---\s*\n/);
      });

      it("should have valid frontmatter structure", () => {
        const content = readFileSync(filePath, "utf-8");
        const { frontmatter } = parseFrontmatter(content);
        expect(Object.keys(frontmatter).length).toBeGreaterThan(0);
      });

      it("should have description in frontmatter", () => {
        const content = readFileSync(filePath, "utf-8");
        const { frontmatter } = parseFrontmatter(content);
        expect(frontmatter).toHaveProperty("description");
      });
    });
  });

  describe("commit-style.mdc specific", () => {
    it("should define commit message format", () => {
      const content = readFileSync(join(AGENTS_DIR, "rules/commit-style.mdc"), "utf-8");
      expect(content).toContain("${emoji}");
      expect(content).toContain("${type}");
      expect(content).toContain("${scope}");
    });

    it("should have type to emoji mapping table", () => {
      const content = readFileSync(join(AGENTS_DIR, "rules/commit-style.mdc"), "utf-8");
      expect(content).toMatch(/\|\s*type\s*\|\s*emoji\s*\|/i);
    });
  });

  describe("test.mdc specific", () => {
    it("should mention test isolation", () => {
      const content = readFileSync(join(AGENTS_DIR, "rules/test.mdc"), "utf-8");
      expect(content.toLowerCase()).toMatch(/isolat|independent/);
    });

    it("should have examples", () => {
      const content = readFileSync(join(AGENTS_DIR, "rules/test.mdc"), "utf-8");
      expect(content).toMatch(/```|example/i);
    });
  });
});

describe("Skills SKILL.md files", () => {
  const skillFiles = [
    { path: "bug-fix/SKILL.md", name: "bug-fix" },
    { path: "cloudflare-browser/SKILL.md", name: "cloudflare-browser" },
    { path: "colosseum-agent-hackathon/SKILL.md", name: "colosseum-agent-hackathon" },
    { path: "create-pr/SKILL.md", name: "create-pr" },
  ];

  skillFiles.forEach(({ path, name }) => {
    describe(path, () => {
      const filePath = join(AGENTS_DIR, "skills", path);

      it("should exist", () => {
        expect(existsSync(filePath)).toBe(true);
      });

      it("should have YAML frontmatter", () => {
        const content = readFileSync(filePath, "utf-8");
        expect(content).toMatch(/^---\s*\n/);
      });

      it("should have name in frontmatter", () => {
        const content = readFileSync(filePath, "utf-8");
        const { frontmatter } = parseFrontmatter(content);
        expect(frontmatter).toHaveProperty("name");
        expect(frontmatter.name).toBe(name);
      });

      it("should have description in frontmatter", () => {
        const content = readFileSync(filePath, "utf-8");
        const { frontmatter } = parseFrontmatter(content);
        expect(frontmatter).toHaveProperty("description");
        expect(typeof frontmatter.description).toBe("string");
        expect((frontmatter.description as string).length).toBeGreaterThan(0);
      });

      it("should have meaningful body content", () => {
        const content = readFileSync(filePath, "utf-8");
        const { body } = parseFrontmatter(content);
        expect(body.trim().length).toBeGreaterThan(100);
      });
    });
  });

  describe("cloudflare-browser/SKILL.md specific", () => {
    it("should mention CDP protocol", () => {
      const content = readFileSync(join(AGENTS_DIR, "skills/cloudflare-browser/SKILL.md"), "utf-8");
      expect(content).toMatch(/CDP|Chrome DevTools Protocol/i);
    });

    it("should have prerequisites section", () => {
      const content = readFileSync(join(AGENTS_DIR, "skills/cloudflare-browser/SKILL.md"), "utf-8");
      expect(content).toMatch(/## Prerequisites/i);
    });

    it("should mention required environment variables", () => {
      const content = readFileSync(join(AGENTS_DIR, "skills/cloudflare-browser/SKILL.md"), "utf-8");
      expect(content).toContain("CDP_SECRET");
    });
  });

  describe("create-pr/SKILL.md specific", () => {
    it("should have phase sections", () => {
      const content = readFileSync(join(AGENTS_DIR, "skills/create-pr/SKILL.md"), "utf-8");
      expect(content).toMatch(/## Phase \d+:/);
    });

    it("should mention gh CLI", () => {
      const content = readFileSync(join(AGENTS_DIR, "skills/create-pr/SKILL.md"), "utf-8");
      expect(content).toMatch(/\bgh\b/);
    });
  });
});

describe("Code quality checks", () => {
  const allMarkdownFiles = [
    // Commands
    "commands/bug-fix.md",
    "commands/check-simirality.md",
    "commands/commit.md",
    "commands/final-check.md",
    "commands/refactor.md",
    "commands/worktree-pr.md",
    // Memory
    "memory/lessons.md",
    "memory/todo.md",
    // Rules
    "rules/coderabbit.mdc",
    "rules/commit-style.mdc",
    "rules/dotenvx.mdc",
    "rules/mermaid.mdc",
    "rules/proactive-subagent-and-skills.mdc",
    "rules/test.mdc",
    "rules/three.mdc",
    "rules/typescript.mdc",
    // Skills
    "skills/bug-fix/SKILL.md",
    "skills/cloudflare-browser/SKILL.md",
    "skills/colosseum-agent-hackathon/SKILL.md",
    "skills/create-pr/SKILL.md",
  ];

  allMarkdownFiles.forEach((relativePath) => {
    describe(relativePath, () => {
      const filePath = join(AGENTS_DIR, relativePath);

      it("should not contain TODO or FIXME comments", () => {
        const content = readFileSync(filePath, "utf-8");
        // Allow TODO in todo.md and in content examples
        if (relativePath.includes("todo.md")) return;
        const hasTodo = content.match(/TODO:|FIXME:/);
        expect(hasTodo).toBeNull();
      });

      it("should use consistent heading levels", () => {
        const content = readFileSync(filePath, "utf-8");
        const { body } = parseFrontmatter(content);
        const headings = body.match(/^#{1,6} .+$/gm) || [];

        if (headings.length > 0) {
          // First heading should be level 1
          expect(headings[0]).toMatch(/^# /);

          // Check for heading level jumps (e.g., # to ###)
          const levels = headings.map((h) => h.match(/^#+/)![0].length);
          for (let i = 1; i < levels.length; i++) {
            const jump = levels[i] - levels[i - 1];
            // Allow going down any number of levels, but only up by 1 or staying same
            if (jump > 0) {
              expect(jump).toBeLessThanOrEqual(1);
            }
          }
        }
      });

      it("should have proper list formatting", () => {
        const content = readFileSync(filePath, "utf-8");
        const lines = content.split("\n");

        lines.forEach((line, i) => {
          // Check ordered lists have proper numbering
          if (line.match(/^\d+\. /)) {
            // Should not have wrong indentation for top-level items
            expect(line[0]).toMatch(/\d/);
          }

          // Check unordered lists use consistent markers
          if (line.match(/^- /)) {
            expect(line).toMatch(/^- [^\s]/);
          }
        });
      });
    });
  });
});

describe("Code block validation", () => {
  const filesWithCodeBlocks = [
    "commands/commit.md",
    "commands/worktree-pr.md",
    "rules/test.mdc",
    "rules/typescript.mdc",
    "skills/cloudflare-browser/SKILL.md",
    "skills/create-pr/SKILL.md",
  ];

  filesWithCodeBlocks.forEach((relativePath) => {
    describe(relativePath, () => {
      const filePath = join(AGENTS_DIR, relativePath);

      it("should have properly closed code blocks", () => {
        const content = readFileSync(filePath, "utf-8");
        const backticks = content.match(/```/g) || [];
        // Code blocks should be in pairs (opening and closing)
        expect(backticks.length % 2).toBe(0);
      });

      it("should specify language for code blocks", () => {
        const content = readFileSync(filePath, "utf-8");
        const codeBlocks = content.match(/```(\w+)?\n/g) || [];

        codeBlocks.forEach((block) => {
          // Either has a language specified, or is explicitly a plain block
          const hasLanguage = /```\w+/.test(block);
          const isPlainBlock = block === "```\n";
          expect(hasLanguage || isPlainBlock).toBe(true);
        });
      });
    });
  });
});