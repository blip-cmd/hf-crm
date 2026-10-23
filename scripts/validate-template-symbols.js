#!/usr/bin/env node

/**
 * Validates that static class methods and classes referenced in PHP templates
 * actually exist in the codebase.
 *
 * This prevents deployment regressions where templates call methods that are
 * undefined or missing from the target environment classmap, which would
 * otherwise pass `php -l` syntax checking but trigger fatal HTTP 500 errors
 * at runtime.
 */

const fs = require('fs');
const path = require('path');

const SRC_ROOT = path.join(__dirname, '..', 'src');
const TEMPLATE_DIRS = [
    path.join(SRC_ROOT, 'session', 'templates'),
    path.join(SRC_ROOT, 'external', 'templates'),
    path.join(SRC_ROOT, 'v2', 'templates'),
];

console.log('Validating Template PHP Symbols and Method Invocations...');

function walk(dir, out = []) {
    if (!fs.existsSync(dir)) {
        return out;
    }
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(fullPath, out);
        } else if (entry.isFile() && entry.name.endsWith('.php')) {
            out.push(fullPath);
        }
    }
    return out;
}

// Index all PHP files under src/ChurchCRM/ by class name
const classToFile = new Map();
function indexClasses(dir) {
    if (!fs.existsSync(dir)) {
        return;
    }
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            indexClasses(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.php')) {
            const className = path.basename(entry.name, '.php');
            if (!classToFile.has(className)) {
                classToFile.set(className, fullPath);
            }
        }
    }
}

indexClasses(path.join(SRC_ROOT, 'ChurchCRM'));

let totalChecked = 0;
let errors = 0;

for (const templateDir of TEMPLATE_DIRS) {
    const files = walk(templateDir);
    for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        const relPath = path.relative(path.join(__dirname, '..'), file).replace(/\\/g, '/');

        // Extract `use ChurchCRM\...` statements to resolve aliases
        const useRegex = /use\s+([A-Za-z0-9_\\]+)(?:\s+as\s+([A-Za-z0-9_]+))?;/g;
        const aliases = new Map();
        let match;
        while ((match = useRegex.exec(content)) !== null) {
            const fqcn = match[1];
            const alias = match[2] || fqcn.split('\\').pop();
            aliases.set(alias, fqcn);
        }

        // Match static invocations: ClassName::methodName(
        const staticCallRegex = /\b([A-Za-z0-9_]+)::([A-Za-z0-9_]+)\s*\(/g;
        while ((match = staticCallRegex.exec(content)) !== null) {
            const className = match[1];
            const methodName = match[2];

            // Ignore keywords and built-in PHP pseudo-classes
            if (['self', 'parent', 'static'].includes(className)) {
                continue;
            }

            // Propel ORM Query classes inherently provide static `create()`
            if (className.endsWith('Query') && methodName === 'create') {
                totalChecked++;
                continue;
            }

            // Check if class belongs to ChurchCRM
            const isImportedChurchCRM = aliases.has(className) && aliases.get(className).startsWith('ChurchCRM\\');
            const isIndexedChurchCRM = classToFile.has(className);

            if (isImportedChurchCRM || isIndexedChurchCRM) {
                totalChecked++;
                const classPath = classToFile.get(className);

                if (!classPath || !fs.existsSync(classPath)) {
                    console.error(`ERROR: ${relPath} references class ${className}, but no corresponding file exists in src/ChurchCRM/`);
                    errors++;
                    continue;
                }

                const classSource = fs.readFileSync(classPath, 'utf8');
                // Regex checks for function definition or magic call
                const methodRegex = new RegExp(`function\\s+${methodName}\\s*\\(`, 'i');
                const hasMethod = methodRegex.test(classSource) || classSource.includes('__callStatic');

                if (!hasMethod) {
                    // Check if class extends a parent class that may have the method
                    const extendsMatch = classSource.match(/class\s+\w+\s+extends\s+([A-Za-z0-9_\\]+)/);
                    let parentHasMethod = false;
                    if (extendsMatch) {
                        const parentName = extendsMatch[1].split('\\').pop();
                        if (classToFile.has(parentName)) {
                            const parentSource = fs.readFileSync(classToFile.get(parentName), 'utf8');
                            parentHasMethod = new RegExp(`function\\s+${methodName}\\s*\\(`, 'i').test(parentSource);
                        }
                    }

                    if (!parentHasMethod) {
                        console.error(`ERROR: ${relPath} calls ${className}::${methodName}(), but method is not defined in ${path.relative(path.join(__dirname, '..'), classPath).replace(/\\/g, '/')}`);
                        errors++;
                    }
                }
            }
        }
    }
}

if (errors > 0) {
    console.error(`\nValidation failed: ${errors} missing class/method references found in templates.`);
    process.exit(1);
}

console.log(`PASS: Verified ${totalChecked} template static method invocations across templates.\n`);
