document.getElementById('unobfuscateBtn').addEventListener('click', unobfuscateLua);

function unobfuscateLua() {
    const inputCode = document.getElementById('inputCode').value;
    const lines = inputCode.split('\n');
    const outputLines = [];

    // Track known variable aliases
    const variables = {
        d: null, // Likely string.char
        g: null, // Likely string table
        k: null, // Likely string.char
        j: null, // Likely string.byte
        h: null, // Likely string.gmatch
        e: null, // Value from gsub
        f: null  // Value from gsub
    };

    // Store parts of the 'b' table definition
    const bTableParts = [];
    let inBTableDefinition = false;
    let bTableName = 'b'; // Assume it's named 'b'

    // Helper to evaluate string.char calls from numbers
    function evaluateCharCodePattern(numberString) {
        try {
            const numbers = numberString.split(',').map(num => parseInt(num.trim(), 10));
            return String.fromCharCode(...numbers);
        } catch (e) {
            console.error("Error evaluating char codes:", numberString, e);
            return `---ERROR_EVAL_CHAR_CODE---(${numberString})`;
        }
    }

    // Helper to evaluate complex key patterns like g[d](...) or '\95'..k(...)
    function evaluateKeyPattern(keyPattern, variables) {
        // Pattern: g[d](...)
        const keyMatch = keyPattern.match(/g\[d]\((\d+(?:,\s*\d+)*)\)/);
        if (keyMatch && variables.d && variables.g) { // Check if d and g are known
             if (variables.d.name === 'string.char' && variables.g.name === 'string') {
                 const charString = evaluateCharCodePattern(keyMatch[1]);
                 return `"${charString.replace(/"/g, '\\"')}"`; // Quote the resulting string
             }
        }

        // Pattern: ['\95'..k(...)]
        const underscoreKeyMatch = keyPattern.match(/'\\95'\.\.(\w+)\((\d+(?:,\s*\d+)*)\)/);
        if (underscoreKeyMatch) {
             const charFuncVar = underscoreKeyMatch[1];
             const numbers = underscoreKeyMatch[2];
             if (variables[charFuncVar] && variables[charFuncVar].name === 'string.char') {
                 const charString = evaluateCharCodePattern(numbers);
                 return `"_${charString.replace(/"/g, '\\"')}"`; // Quote the resulting string
             }
        }

        // Pattern: [f] - Assuming f is a variable holding a string key
        if (keyPattern.trim() === '[f]') {
            if (variables.f !== null) {
                 // Assuming f holds the original string literal like [[ameicaa]]
                 // Need to output it correctly for Lua literal or quoted string
                 if (variables.f.startsWith('[[')) { // Check for long string literal
                     return variables.f; // Keep as [[...]]
                 } else {
                     return `"${variables.f.replace(/"/g, '\\"')}"`; // Quote regular string
                 }
            } else {
                 return "[f] -- Unknown f";
            }
        }


        // If key doesn't match known complex patterns, just return the original pattern string
        // Handle simple variable keys like [var]
         const simpleKeyMatch = keyPattern.match(/^\[(\w+)]$/);
         if (simpleKeyMatch) {
             const varName = simpleKeyMatch[1];
             if (variables[varName] !== undefined && variables[varName] !== null) {
                 if (typeof variables[varName] === 'string') {
                     // Assume it's a string key like [[ameicaa]]
                     if (variables[varName].startsWith('[[')) {
                         return variables[varName];
                     } else {
                         return `"${variables[varName].replace(/"/g, '\\"')}"`;
                     }
                 }
                 // If it's not a string, maybe it's a number or boolean - Lua handles that
                 return variables[varName].toString();
             }
              return keyPattern.trim(); // Keep original if variable value unknown
         }


        return keyPattern.trim();
    }

     // Helper to get readable value for assignments (functions, strings, etc.)
    function getReadableValue(valuePattern, variables) {
         // Check if value is one of our known function variables
         if (variables[valuePattern.trim()] && variables[valuePattern.trim()].type === 'function') {
             return variables[valuePattern.trim()].name; // e.g., "string.char"
         }
         // Check if value is one of our known string variables (e, f)
         if (variables[valuePattern.trim()] && typeof variables[valuePattern.trim()] === 'string') {
              // Assuming e/f hold original string literal like [[ameicaa]]
             if (variables[valuePattern.trim()].startsWith('[[')) {
                 return variables[valuePattern.trim()]; // Keep as [[...]]
             } else {
                 return `"${variables[valuePattern.trim()].replace(/"/g, '\\"')}"`; // Quote regular string
             }
         }
         // Otherwise, keep the original value pattern (could be number, literal string, etc.)
         return valuePattern.trim();
    }


    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '') {
            outputLines.push('');
            continue;
        }

        // --- Pattern 1: Initial gsub call & assumed e/f ---
        // This is the trickiest to parse robustly without a Lua parser.
        // We assume based on the pattern that e and f get the original string literal.
        const initialGsubMatch = line.match(/^local\s+\w+,\w+,\w+=\s*nil,nil,nil\(\[\[(.*?)\]\]\):gsub\('.*',function\(d\)/);
        if (initialGsubMatch) {
            const originalStringLiteral = '[[' + initialGsubMatch[1] + ']]';
            variables.e = originalStringLiteral;
            variables.f = originalStringLiteral;
            outputLines.push(line); // Keep the original complex line for context if desired
            outputLines.push(`-- Note: Assuming variables 'e' and 'f' are set to the input string literal: ${originalStringLiteral}`);
            outputLines.push(`-- local e = ${originalStringLiteral}`); // Simplified representation
            outputLines.push(`-- local f = ${originalStringLiteral}`); // Simplified representation
            continue;
        }


        // --- Pattern 2: string.char alias (variable 'd') ---
        const charAliasMatch = line.match(/^local\s+(\w+)\s*=\s*\w+\["string"]\["\\99\\104\\97\\114"]\((\d+(?:,\s*\d+)*)\)/);
        if (charAliasMatch) {
            const varName = charAliasMatch[1];
            const charString = evaluateCharCodePattern(charAliasMatch[2]); // Should be "char"
            if (charString === "char") {
                 variables[varName] = { type: 'function', name: 'string.char' };
                 outputLines.push(`-- local ${varName} = string.char`);
                 continue;
            } else {
                outputLines.push(line + ` -- Potential string.char alias, but unexpected string: ${charString}`);
                 continue;
            }
        }

        // --- Pattern 3: string table alias (variable 'g') ---
        const stringAliasMatch = line.match(/^local\s+(\w+)\s*=\s*\w+\[string\[\w+]\((\d+(?:,\s*\d+)*)\)]/);
        if (stringAliasMatch && variables.d && variables.d.name === 'string.char') { // Needs 'd' to be identified first
             const varName = stringAliasMatch[1];
             const charString = evaluateCharCodePattern(stringAliasMatch[2]); // Should be "string"
             if (charString === "string") {
                 variables[varName] = { type: 'table', name: 'string' };
                 outputLines.push(`-- local ${varName} = string`);
                 continue;
             } else {
                 outputLines.push(line + ` -- Potential string table alias, but unexpected string: ${charString}`);
                  continue;
             }
        }

        // --- Pattern 4: Function aliases (k, j, h) within a large junk block ---
        // This is based on the specific structure shown.
        const funcAliasBlockStart = line.match(/^local\s+h=".*";\s*local\s+j=".*";\s*local\s+k=".*";\s*local\s+l=\d+;\s*local\s+m=\d+;\s*while\(l<m\)do/);
        if (funcAliasBlockStart) {
            outputLines.push(`-- The following block contains junk loops and assigns string functions.`);
            outputLines.push(`-- k becomes string.char`);
            outputLines.push(`-- j becomes string.byte`);
            outputLines.push(`-- h becomes string.gmatch`);
            variables.k = { type: 'function', name: 'string.char' };
            variables.j = { type: 'function', name: 'string.byte' };
            variables.h = { type: 'function', name: 'string.gmatch' };

            // Skip lines until the likely end of this block (based on structure)
            let blockDepth = 1; // Start after the first 'do'
            let blockEndFound = false;
            for (let j = i + 1; j < lines.length; j++) {
                 const blockLine = lines[j].trim();
                 outputLines.push('-- ' + blockLine); // Comment out block lines
                 if (blockLine.endsWith('do')) {
                     blockDepth++;
                 } else if (blockLine === 'end') {
                     blockDepth--;
                     if (blockDepth === 0) {
                         i = j; // Continue main loop after this block
                         blockEndFound = true;
                         break;
                     }
                 }
            }
             if (!blockEndFound) {
                 console.warn("Could not find end of function alias block starting at line", i);
                 // If end not found, just continue from the next line after the start (i+1)
                 // The remaining lines will be added normally or matched by other patterns
             }
            continue;
        }

        // --- Pattern 5: Initial 'b' table definition ---
        const bTableStartMatch = line.match(/^(\w+)\s*=\s*\{(.*)\}/);
        if (bTableStartMatch) {
            bTableName = bTableStartMatch[1]; // Capture the table name
            const initialPairs = bTableStartMatch[2].split(','); // Simple split, might fail on complex values
            outputLines.push(`-- Reconstructing table '${bTableName}' definition:`);

            initialPairs.forEach(pair => {
                const parts = pair.trim().match(/^\[?(.*?)\]?\s*=\s*(.*)$/); // Match key = value
                if (parts) {
                     const rawKey = parts[1].trim();
                     const rawValue = parts[2].trim();

                     const evaluatedKey = evaluateKeyPattern(`[${rawKey}]`, variables); // Add brackets for evaluation helper
                     const readableValue = getReadableValue(rawValue, variables);

                     bTableParts.push({ key: evaluatedKey, value: readableValue });
                } else {
                     outputLines.push(`-- Could not parse initial table pair: ${pair.trim()}`);
                }
            });
             // Don't add the original complex line, we'll reconstruct it later
            continue;
        }

        // --- Pattern 6: Subsequent 'b' table assignments ---
        const bAssignmentMatch = line.match(/^(\w+)\[(.*?)\]\s*=\s*(.*)$/);
        if (bAssignmentMatch && bAssignmentMatch[1] === bTableName) { // Check if it's an assignment to the 'b' table
            const rawKey = bAssignmentMatch[2].trim();
            const rawValue = bAssignmentMatch[3].trim();

            const evaluatedKey = evaluateKeyPattern(`[${rawKey}]`, variables); // Add brackets for evaluation helper
            const readableValue = getReadableValue(rawValue, variables);

            bTableParts.push({ key: evaluatedKey, value: readableValue });
            outputLines.push(`-- ${bTableName}[${rawKey}] = ${rawValue} -- Evaluated to: ${bTableName}[${evaluatedKey}] = ${readableValue}`); // Comment out original, show evaluation
            continue;
        }

         // --- Pattern 7: Other junk loops (like the second large block) ---
         const otherJunkLoopMatch = line.match(/^local\s+\w+=\d+;\s*local\s+\w+=\d+;\s*while\(.*\)do/);
         if (otherJunkLoopMatch) {
             outputLines.push(`-- Following block identified as junk loops:`);
             // Skip lines until a likely 'end' that closes this loop
             let blockDepth = 1; // Start after the first 'do'
             let blockEndFound = false;
            for (let j = i + 1; j < lines.length; j++) {
                 const blockLine = lines[j].trim();
                 outputLines.push('-- ' + blockLine); // Comment out block lines
                 if (blockLine.endsWith('do')) {
                     blockDepth++;
                 } else if (blockLine === 'end') {
                     blockDepth--;
                     if (blockDepth === 0) {
                         i = j; // Continue main loop after this block
                         blockEndFound = true;
                         break;
                     }
                 }
             }
             if (!blockEndFound) {
                 console.warn("Could not find end of junk loop block starting at line", i);
             }
             continue;
         }


        // If the line didn't match any specific pattern, add it as is
        outputLines.push(line);
    }

    // --- Construct the final output ---
    let finalOutput = `-- Deobfuscated using a pattern-specific tool\n\n`;

    // Add simplified variable assignments
    if (variables.e !== null && variables.f !== null) {
        finalOutput += `-- Assumption: e and f were set to the original string literal like ${variables.e}\n`;
        finalOutput += `local e = ${variables.e}\n`;
        finalOutput += `local f = ${variables.f}\n`;
    }
     if (variables.d) finalOutput += `local d = ${variables.d.name}\n`;
     if (variables.g) finalOutput += `local g = ${variables.g.name}\n`;
     if (variables.k) finalOutput += `local k = ${variables.k.name}\n`;
     if (variables.j) finalOutput += `local j = ${variables.j.name}\n`;
     if (variables.h) finalOutput += `local h = ${variables.h.name}\n`;

     finalOutput += `\n`;

     // Reconstruct the 'b' table
     if (bTableParts.length > 0) {
         finalOutput += `-- Reconstructed table '${bTableName}':\n`;
         finalOutput += `local ${bTableName} = {\n`;
         bTableParts.forEach((item, index) => {
             finalOutput += `    [${item.key}] = ${item.value}${index < bTableParts.length - 1 ? ',' : ''}\n`;
         });
         finalOutput += `}\n\n`;
     }


    // Add the remaining lines
    finalOutput += outputLines.join('\n');


    document.getElementById('outputCode').value = finalOutput;
}