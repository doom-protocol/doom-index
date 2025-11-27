#!/usr/bin/env tsx

import { readdirSync, statSync, readFileSync, writeFileSync } from "fs";
import { join, extname } from "path";

const REACT_IMPORT_REGEX = /^import React, \{([^}]+)\} from "react";$/gm;
const REACT_ONLY_IMPORT_REGEX = /^import React from "react";$/gm;

// Type mappings for React types that need to be imported
const REACT_TYPE_MAPPING: Record<string, string[]> = {
  "React.FC": ["FC"],
  "React.ReactNode": ["ReactNode"],
  "React.ComponentProps": ["ComponentProps"],
  "React.SyntheticEvent": ["SyntheticEvent"],
  "React.MouseEvent": ["MouseEvent"],
  "React.ChangeEvent": ["ChangeEvent"],
  "React.FormEvent": ["FormEvent"],
  "React.KeyboardEvent": ["KeyboardEvent"],
  "React.TouchEvent": ["TouchEvent"],
  "React.ClipboardEvent": ["ClipboardEvent"],
  "React.FocusEvent": ["FocusEvent"],
  "React.PointerEvent": ["PointerEvent"],
  "React.WheelEvent": ["WheelEvent"],
  "React.AnimationEvent": ["AnimationEvent"],
  "React.TransitionEvent": ["TransitionEvent"],
  "React.DragEvent": ["DragEvent"],
  "React.RefObject": ["RefObject"],
  "React.MutableRefObject": ["MutableRefObject"],
  "React.LegacyRef": ["LegacyRef"],
  "React.ComponentType": ["ComponentType"],
  "React.ComponentClass": ["ComponentClass"],
  "React.FunctionComponent": ["FunctionComponent"],
  "React.ClassType": ["ClassType"],
  "React.PropsWithChildren": ["PropsWithChildren"],
  "React.PropsWithRef": ["PropsWithRef"],
  "React.PropsWithoutRef": ["PropsWithoutRef"],
};

function findFiles(dir: string, extensions: string[]): string[] {
  const files: string[] = [];

  function traverse(currentDir: string) {
    const items = readdirSync(currentDir);

    for (const item of items) {
      const fullPath = join(currentDir, item);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        traverse(fullPath);
      } else if (extensions.includes(extname(fullPath))) {
        files.push(fullPath);
      }
    }
  }

  traverse(dir);
  return files;
}

function updateReactImports(filePath: string): boolean {
  const content = readFileSync(filePath, "utf-8");
  let updatedContent = content;
  let hasChanges = false;

  // Find React types used in the file
  const usedReactTypes = new Set<string>();
  for (const [reactType, imports] of Object.entries(REACT_TYPE_MAPPING)) {
    if (content.includes(reactType)) {
      imports.forEach(imp => usedReactTypes.add(imp));
    }
  }

  // Update import React, { ... } from "react" to import { ..., ReactTypes } from "react"
  updatedContent = updatedContent.replace(REACT_IMPORT_REGEX, (match, imports) => {
    const existingImports = imports
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean);
    const allImports = [...existingImports, ...Array.from(usedReactTypes)].filter((v, i, a) => a.indexOf(v) === i);
    hasChanges = true;
    return `import { ${allImports.join(", ")} } from "react";`;
  });

  // Update import React from "react" (standalone React import)
  updatedContent = updatedContent.replace(REACT_ONLY_IMPORT_REGEX, _match => {
    if (Array.from(usedReactTypes).length > 0) {
      hasChanges = true;
      return `import { ${Array.from(usedReactTypes).join(", ")} } from "react";`;
    } else {
      hasChanges = true;
      return ""; // Remove the import if no React types are used
    }
  });

  // Replace React.type references with just type
  for (const [reactType, imports] of Object.entries(REACT_TYPE_MAPPING)) {
    if (content.includes(reactType)) {
      const replacement = imports[0]; // Use the first import name
      updatedContent = updatedContent.replace(
        new RegExp(reactType.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
        replacement,
      );
      hasChanges = true;
    }
  }

  if (hasChanges) {
    writeFileSync(filePath, updatedContent);
    console.log(`Updated: ${filePath}`);
    return true;
  }

  return false;
}

function main() {
  const srcDir = "src";
  const extensions = [".ts", ".tsx"];

  console.log("Finding TypeScript/React files...");
  const files = findFiles(srcDir, extensions);

  console.log(`Found ${files.length} files. Processing...`);

  let updatedCount = 0;
  for (const file of files) {
    if (updateReactImports(file)) {
      updatedCount++;
    }
  }

  console.log(`\nDone! Updated ${updatedCount} files.`);
}

if (require.main === module) {
  main();
}
