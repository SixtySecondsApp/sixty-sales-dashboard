import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { glob } from 'glob';
import {
  Project,
  Node,
  SyntaxKind,
  CallExpression,
  PropertyAccessExpression,
  ElementAccessExpression,
  ExpressionStatement
} from 'ts-morph';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const TARGET_DIRECTORIES = [
  'src',
  'scripts',
  'tests',
  'supabase/functions',
  'supabase/edge-functions',
  'mcp-servers',
  'components',
  'public',
  'server'
];

const EXTENSIONS = ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'mts', 'cts'];

const IGNORE_GLOBS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/.turbo/**',
  '**/coverage/**',
  '**/.output/**',
  '**/.vercel/**',
  '**/archive/**',
  '**/tmp/**',
  '**/.tmp/**',
  '**/generated/**'
];

const METHODS_TO_STRIP = new Set([
  'log',
  'info',
  'debug',
  'trace',
  'table',
  'time',
  'timeEnd',
  'timeLog',
  'timeStamp',
  'group',
  'groupCollapsed',
  'groupEnd',
  'groupStart',
  'count',
  'countReset',
  'dir',
  'dirxml',
  'profile',
  'profileEnd',
  'clear',
  'markTimeline',
  'timeline',
  'timelineEnd',
  'assert',
  'warn',
  'error'
]);

const CONSOLE_ALIASES = new Set(['console']);
const CONSOLE_PARENT_ALIASES = new Set(['window', 'globalThis']);

async function collectTargetFiles(): Promise<string[]> {
  const files = new Set<string>();
  const extensionGroup = EXTENSIONS.join(',');

  for (const dir of TARGET_DIRECTORIES) {
    const absoluteDir = path.join(repoRoot, dir);
    if (!existsSync(absoluteDir)) {
      continue;
    }

    const pattern = path.join(dir, `**/*.{${extensionGroup}}`);
    const matches = await glob(pattern, {
      cwd: repoRoot,
      absolute: true,
      nodir: true,
      ignore: IGNORE_GLOBS
    });

    for (const match of matches) {
      files.add(path.normalize(match));
    }
  }

  return Array.from(files);
}

function isConsoleIdentifier(node: Node | undefined): boolean {
  if (!node) return false;

  if (Node.isIdentifier(node)) {
    return CONSOLE_ALIASES.has(node.getText());
  }

  if (Node.isPropertyAccessExpression(node)) {
    const name = node.getName();
    if (!CONSOLE_ALIASES.has(name)) {
      return false;
    }

    const parentExpr = node.getExpression();
    return (
      Node.isIdentifier(parentExpr) &&
      CONSOLE_PARENT_ALIASES.has(parentExpr.getText())
    );
  }

  return false;
}

function isConsolePropertyAccess(expression: Node): expression is PropertyAccessExpression {
  if (Node.isPropertyAccessExpression(expression)) {
    return isConsoleIdentifier(expression.getExpression());
  }
  return false;
}

function isConsoleElementAccess(expression: Node): expression is ElementAccessExpression {
  if (!Node.isElementAccessExpression(expression)) return false;

  const argumentExpression = expression.getArgumentExpression();
  if (!argumentExpression || !Node.isStringLiteral(argumentExpression)) {
    return false;
  }

  return (
    METHODS_TO_STRIP.has(argumentExpression.getLiteralText()) &&
    isConsoleIdentifier(expression.getExpression())
  );
}

function replaceOrRemoveExpressionStatement(statement: ExpressionStatement) {
  const container = statement.getParent();

  if (
    container &&
    (Node.isIfStatement(container) ||
      Node.isForStatement(container) ||
      Node.isForInStatement(container) ||
      Node.isForOfStatement(container) ||
      Node.isWhileStatement(container) ||
      Node.isDoStatement(container))
  ) {
    statement.replaceWithText('{}');
    return;
  }

  statement.remove();
}

function stripConsoleCall(call: CallExpression): boolean {
  const expression = call.getExpression();

  if (isConsolePropertyAccess(expression)) {
    const methodName = expression.getName();
    if (!METHODS_TO_STRIP.has(methodName)) {
      return false;
    }
  } else if (isConsoleElementAccess(expression)) {
    // Already validated inside helper
  } else {
    return false;
  }

  const parent = call.getParent();

  if (parent && Node.isExpressionStatement(parent)) {
    replaceOrRemoveExpressionStatement(parent);
  } else if (parent && Node.isAwaitExpression(parent)) {
    call.replaceWithText('undefined');
  } else if (parent && Node.isReturnStatement(parent)) {
    call.replaceWithText('undefined');
  } else if (parent && Node.isVariableDeclaration(parent) && parent.getInitializer() === call) {
    call.replaceWithText('undefined');
  } else if (parent && Node.isBinaryExpression(parent)) {
    call.replaceWithText('undefined');
  } else if (parent && Node.isConditionalExpression(parent)) {
    call.replaceWithText('undefined');
  } else if (parent && Node.isPropertyAssignment(parent) && parent.getInitializer() === call) {
    call.replaceWithText('undefined');
  } else if (parent && Node.isArrayLiteralExpression(parent)) {
    call.replaceWithText('undefined');
  } else if (parent && Node.isTemplateSpan(parent)) {
    call.replaceWithText('undefined');
  } else if (parent && Node.isCallExpression(parent)) {
    call.replaceWithText('undefined');
  } else {
    call.replaceWithText('undefined');
  }

  return true;
}

async function removeConsoleLogs() {
  const files = await collectTargetFiles();
  if (files.length === 0) {
    return;
  }

  const project = new Project({
    tsConfigFilePath: path.join(repoRoot, 'tsconfig.json'),
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      allowJs: true
    },
    manipulationSettings: {
      useTrailingCommas: true
    }
  });

  files.forEach((filePath) => {
    project.addSourceFileAtPathIfExists(filePath) ??
      project.addSourceFileAtPath(filePath);
  });

  let filesUpdated = 0;
  let statementsRemoved = 0;

  for (const sourceFile of project.getSourceFiles()) {
    let removedInFile = 0;

    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

    for (const call of callExpressions) {
      if (call.wasForgotten()) continue;
      if (stripConsoleCall(call)) {
        removedInFile += 1;
      }
    }

    if (removedInFile > 0) {
      filesUpdated += 1;
      statementsRemoved += removedInFile;
      await sourceFile.save();
    }
  }

  // Use process.stdout.write instead of console.log to avoid the script removing its own output
  process.stdout.write(`Removed ${statementsRemoved} console statements from ${filesUpdated} files\n`);
}

removeConsoleLogs().catch((error) => {
  // Use process.stderr.write instead of console.error to avoid the script removing its own error
  process.stderr.write(`Failed to remove console logs: ${error}\n`);
  process.exitCode = 1;
});

