/**
 * Story source injector — reads a CSF story file, finds the JSX template,
 * and inserts a new component at the correct position relative to a target element.
 *
 * Supports 4 placement modes:
 * - before: insert before the target element
 * - after: insert after the target element
 * - into: insert as the last child of the target element
 * - replace: replace the target element with the new component
 *
 * In Phase 1, this uses targeted string injection for CSFv3 `args` templates.
 * Future versions should use ts-morph for AST-aware injection.
 */

export type PlacementMode = 'before' | 'after' | 'into' | 'replace';

export interface InjectParams {
  /** Path to the CSF story file (e.g., src/generated/Button.stories.tsx) */
  storyFile: string;
  /** CSS selector or tag name of the target element in the story template */
  targetSelector: string;
  /** Placement mode */
  placementMode: PlacementMode;
  /** JSX string to inject (e.g., '<Button>Click me</Button>') */
  componentJsx: string;
  /** Component import path (e.g., './Button') */
  componentImport: string;
  /** Component name (e.g., 'Button') */
  componentName: string;
}

export interface InjectionResult {
  success: boolean;
  file: string;
  line?: number;
  error?: string;
}

/**
 * Inject a component into a CSF story file at the target location.
 *
 * Currently handles CSFv3 `args` templates (the most common pattern):
 * ```tsx
 * export const Default: Story = {
 *   args: {
 *     children: <>...</>
 *   }
 * }
 * ```
 *
 * Falls back to inserting the import + adding the component at the end of the template.
 */
export function injectComponent(params: InjectParams): InjectionResult {
  const { storyFile, targetSelector, placementMode, componentJsx, componentImport, componentName } = params;
  const fs = require('fs');

  if (!fs.existsSync(storyFile)) {
    return { success: false, file: storyFile, error: `Story file not found: ${storyFile}` };
  }

  let content: string;
  try {
    content = fs.readFileSync(storyFile, 'utf-8');
  } catch (e) {
    return { success: false, file: storyFile, error: `Cannot read file: ${(e as Error).message}` };
  }

  // 1. Add import if not already present
  const importStatement = `import { ${componentName} } from '${componentImport}';`;
  if (!content.includes(importStatement) && !content.includes(`'${componentImport}'`)) {
    // Find the last import line and add after it
    const importMatch = content.match(/^import .+?;$/m);
    if (importMatch) {
      const lastImportIndex = content.lastIndexOf('import ');
      const afterLastImport = content.indexOf(';', lastImportIndex) + 1;
      content = content.slice(0, afterLastImport) + '\n' + importStatement + content.slice(afterLastImport);
    } else {
      // No imports — prepend
      content = importStatement + '\n' + content;
    }
  }

  // 2. Find the template area (look for args.children or render function)
  // For CSFv3 args pattern, look inside the children/JSX template
  const argsMatch = content.match(/children:\s*`([^`]*)`/);
  if (argsMatch) {
    const template = argsMatch[1];
    let newTemplate: string;

    switch (placementMode) {
      case 'before': {
        // Insert before the target element
        const targetRegex = new RegExp(`(<${targetSelector}[^>]*>)`);
        newTemplate = template.replace(targetRegex, `${componentJsx}\n      $1`);
        break;
      }
      case 'after': {
        // Insert after the target element (after the closing tag or self-closing)
        const targetRegex = new RegExp(`(<${targetSelector}[^>]*>(?:[^<]*(?:<[^>]*>[^<]*)*)?</${targetSelector}>|<${targetSelector}[^>]*/>)`);
        newTemplate = template.replace(targetRegex, `$1\n      ${componentJsx}`);
        break;
      }
      case 'into': {
        // Insert as last child of the target
        const targetRegex = new RegExp(`(<${targetSelector}[^>]*>)([^]*)</${targetSelector}>`);
        newTemplate = template.replace(targetRegex, `$1$2\n        ${componentJsx}\n      </${targetSelector}>`);
        break;
      }
      case 'replace': {
        // Replace the target entirely
        const targetRegex = new RegExp(`<${targetSelector}[^>]*>(?:[^<]*(?:<[^>]*>[^<]*)*)?</${targetSelector}>|<${targetSelector}[^>]*/>`);
        newTemplate = template.replace(targetRegex, componentJsx);
        break;
      }
      default:
        return { success: false, file: storyFile, error: `Unknown placement mode: ${placementMode}` };
    }

    if (newTemplate === template) {
      return { success: false, file: storyFile, error: `Target element <${targetSelector}> not found in template` };
    }

    content = content.replace(template, newTemplate);
  } else {
    // Fallback: no args template found — append to the file
    return { success: false, file: storyFile, error: 'CSFv3 args template not found. Manual injection required.' };
  }

  // 3. Write the modified content
  try {
    fs.writeFileSync(storyFile, content, 'utf-8');
    // Find the line where the injection happened
    const lines = content.split('\n');
    const injectionLine = lines.findIndex(l => l.includes(componentName)) + 1;
    return { success: true, file: storyFile, line: injectionLine };
  } catch (e) {
    return { success: false, file: storyFile, error: `Cannot write file: ${(e as Error).message}` };
  }
}
