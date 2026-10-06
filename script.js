/**
 * Modern Minimalist Calculator
 * Vanilla JavaScript Implementation
 * 
 * Features:
 * - Safe expression evaluation using Dijkstra's Shunting-Yard algorithm (No eval)
 * - Correct mathematical operator precedence (× and ÷ over + and −)
 * - Separate display lines for expression history and main result
 * - Dynamic font auto-scaling for long numbers
 * - High-precision floating point rounding (fixes 0.1 + 0.2 precision issues)
 * - Comprehensive keyboard support synchronized with UI animations
 * - macOS/iOS active operator indicator
 * - Resilient edge-case handling (division by zero, duplicate operators, etc.)
 */

document.addEventListener('DOMContentLoaded', () => {
  // =========================================================================
  // DOM Elements
  // =========================================================================
  const expressionDisplay = document.getElementById('expressionDisplay');
  const resultDisplay = document.getElementById('resultDisplay');
  const keypad = document.getElementById('keypad');

  // =========================================================================
  // Calculator State
  // =========================================================================
  let expression = '';            // Full ongoing mathematical expression
  let currentInput = '0';         // Currently typed operand or active result
  let previousInput = '0';        // Last entered operand before operator
  let isResultEvaluated = false;  // True immediately after pressing '='
  let hasError = false;           // True when an error occurred (e.g., divide by 0)
  let activeOperatorButton = null;// Currently highlighted operator button element

  // =========================================================================
  // Math Parser & Evaluator (Safe Shunting-Yard Algorithm - Zero eval())
  // =========================================================================

  /**
   * Cleans floating point inaccuracies (e.g. 0.1 + 0.2 = 0.30000000000000004).
   * @param {number} num 
   * @returns {number}
   */
  function cleanFloat(num) {
    return parseFloat(num.toPrecision(12));
  }

  /**
   * Tokenizes an arithmetic expression into numbers and operators.
   * Accurately distinguishes between binary subtraction and unary negative numbers.
   * @param {string} rawExpr 
   * @returns {Array<number|string>}
   */
  function tokenize(rawExpr) {
    // Normalize operator glyphs to standard math symbols
    const normalized = rawExpr
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/−/g, '-');

    const tokens = [];
    let i = 0;

    while (i < normalized.length) {
      const ch = normalized[i];

      // Skip whitespaces
      if (/\s/.test(ch)) {
        i++;
        continue;
      }

      // Check for unary minus (e.g. leading "-5" or operator followed by negative "3 * -2")
      if (ch === '-' && (tokens.length === 0 || ['+', '-', '*', '/'].includes(tokens[tokens.length - 1]))) {
        let nextIdx = i + 1;
        while (nextIdx < normalized.length && /\s/.test(normalized[nextIdx])) {
          nextIdx++;
        }
        if (nextIdx < normalized.length && /[\d.]/.test(normalized[nextIdx])) {
          let numStr = '-';
          i = nextIdx;
          while (i < normalized.length && /[\d.]/.test(normalized[i])) {
            numStr += normalized[i];
            i++;
          }
          const parsed = parseFloat(numStr);
          if (isNaN(parsed)) throw new Error('Invalid Expression');
          tokens.push(parsed);
          continue;
        }
      }

      // Check for numeric literals and decimals
      if (/[\d.]/.test(ch)) {
        let numStr = '';
        while (i < normalized.length && /[\d.]/.test(normalized[i])) {
          numStr += normalized[i];
          i++;
        }
        const parsed = parseFloat(numStr);
        if (isNaN(parsed)) throw new Error('Invalid Expression');
        tokens.push(parsed);
        continue;
      }

      // Check for valid binary operators
      if (['+', '-', '*', '/'].includes(ch)) {
        tokens.push(ch);
        i++;
        continue;
      }

      throw new Error('Invalid Expression');
    }

    return tokens;
  }

  /**
   * Evaluates an arithmetic expression string with proper operator precedence.
   * @param {string} expr 
   * @returns {number}
   */
  function evaluateExpression(expr) {
    const tokens = tokenize(expr);
    if (tokens.length === 0) return 0;

    // Operator precedence hierarchy
    const precedence = {
      '+': 1,
      '-': 1,
      '*': 2,
      '/': 2
    };

    // Shunting-Yard Algorithm to generate Reverse Polish Notation (RPN)
    const outputQueue = [];
    const operatorStack = [];

    for (const token of tokens) {
      if (typeof token === 'number') {
        outputQueue.push(token);
      } else if (token in precedence) {
        while (
          operatorStack.length > 0 &&
          precedence[operatorStack[operatorStack.length - 1]] >= precedence[token]
        ) {
          outputQueue.push(operatorStack.pop());
        }
        operatorStack.push(token);
      } else {
        throw new Error('Invalid Expression');
      }
    }

    while (operatorStack.length > 0) {
      outputQueue.push(operatorStack.pop());
    }

    // Evaluate RPN
    const evalStack = [];
    for (const token of outputQueue) {
      if (typeof token === 'number') {
        evalStack.push(token);
      } else {
        if (evalStack.length < 2) {
          throw new Error('Invalid Expression');
        }
        const b = evalStack.pop();
        const a = evalStack.pop();
        let res;

        switch (token) {
          case '+':
            res = a + b;
            break;
          case '-':
            res = a - b;
            break;
          case '*':
            res = a * b;
            break;
          case '/':
            if (Math.abs(b) < 1e-15) {
              throw new Error('Cannot divide by zero');
            }
            res = a / b;
            break;
          default:
            throw new Error('Invalid Expression');
        }
        evalStack.push(res);
      }
    }

    if (evalStack.length !== 1) {
      throw new Error('Invalid Expression');
    }

    const finalResult = evalStack[0];
    if (isNaN(finalResult) || !isFinite(finalResult)) {
      throw new Error('Invalid Expression');
    }

    return cleanFloat(finalResult);
  }

  // =========================================================================
  // Formatting & Display Helpers
  // =========================================================================

  /**
   * Formats a raw number string for clean human-readable presentation.
   * Inserts thousand commas without destroying decimal portions or partial inputs.
   * @param {string} str 
   * @returns {string}
   */
  function formatDisplayNumber(str) {
    if (!str) return '0';
    if (str === 'Cannot divide by zero' || str === 'Invalid Expression' || str === 'Error') {
      return str;
    }
    if (str === '-') return '-';
    if (str === '-0') return '-0';

    // Handle scientific notation directly
    if (str.includes('e') || str.includes('E')) {
      return str;
    }

    const parts = str.split('.');
    const integerPart = parts[0];
    const decimalPart = parts.length > 1 ? parts[1] : null;

    const isNegative = integerPart.startsWith('-');
    const cleanInteger = isNegative ? integerPart.slice(1) : integerPart;

    // Add thousands separators
    const formattedInteger = cleanInteger.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const sign = isNegative ? '-' : '';

    if (decimalPart !== null) {
      return `${sign}${formattedInteger}.${decimalPart}`;
    }
    return `${sign}${formattedInteger}`;
  }

  /**
   * Dynamically adjusts the font size of the main display based on text length.
   * Prevents long numbers from overflowing the calculator card.
   * @param {string} text 
   */
  function adjustDisplayFontSize(text) {
    if (hasError) {
      resultDisplay.style.fontSize = '';
      return;
    }

    const length = text.length;
    if (length <= 7) {
      resultDisplay.style.fontSize = '3.3rem';
    } else if (length <= 9) {
      resultDisplay.style.fontSize = '2.7rem';
    } else if (length <= 12) {
      resultDisplay.style.fontSize = '2.15rem';
    } else if (length <= 15) {
      resultDisplay.style.fontSize = '1.75rem';
    } else {
      resultDisplay.style.fontSize = '1.4rem';
    }
  }

  /**
   * Synchronizes internal calculator state with DOM display elements.
   */
  function updateDisplay() {
    // 1. Update Expression Line
    expressionDisplay.textContent = expression;
    expressionDisplay.scrollLeft = expressionDisplay.scrollWidth;

    // 2. Update Result Line
    if (hasError) {
      resultDisplay.textContent = currentInput;
      resultDisplay.classList.add('error-text');
      adjustDisplayFontSize(currentInput);
    } else {
      resultDisplay.classList.remove('error-text');
      const displayVal = currentInput !== '' ? currentInput : previousInput;
      const formatted = formatDisplayNumber(displayVal || '0');
      resultDisplay.textContent = formatted;
      adjustDisplayFontSize(formatted);
    }
  }

  // =========================================================================
  // Operator Highlighting (macOS / iOS Signature Style)
  // =========================================================================

  function clearActiveOperatorHighlight() {
    if (activeOperatorButton) {
      activeOperatorButton.classList.remove('operator-active');
      activeOperatorButton = null;
    }
  }

  function setActiveOperatorHighlight(opValue) {
    clearActiveOperatorHighlight();
    const btn = keypad.querySelector(`.btn-operator[data-value="${opValue}"]`);
    if (btn) {
      btn.classList.add('operator-active');
      activeOperatorButton = btn;
    }
  }

  // =========================================================================
  // Calculator Actions
  // =========================================================================

  /**
   * Handles digit input (0 - 9).
   * @param {string} digit 
   */
  function inputDigit(digit) {
    if (hasError) {
      clearAll();
    }

    clearActiveOperatorHighlight();

    // If typing right after evaluation, start a new calculation
    if (isResultEvaluated) {
      expression = '';
      currentInput = digit;
      isResultEvaluated = false;
    } else {
      if (currentInput === '0') {
        currentInput = digit;
      } else if (currentInput === '-0') {
        currentInput = '-' + digit;
      } else {
        // Enforce max digits limit to prevent overflow
        const rawDigits = currentInput.replace(/[^0-9]/g, '');
        if (rawDigits.length >= 15) return;
        currentInput += digit;
      }
    }

    updateDisplay();
  }

  /**
   * Handles decimal point input.
   */
  function inputDecimal() {
    if (hasError) {
      clearAll();
    }

    clearActiveOperatorHighlight();

    if (isResultEvaluated) {
      expression = '';
      currentInput = '0.';
      isResultEvaluated = false;
    } else {
      if (currentInput.includes('.')) {
        return; // Prevent duplicate decimal points
      }
      if (currentInput === '' || currentInput === '-') {
        currentInput += '0.';
      } else {
        currentInput += '.';
      }
    }

    updateDisplay();
  }

  /**
   * Handles binary operators (+, −, ×, ÷).
   * @param {string} opSymbol 
   */
  function handleOperator(opSymbol) {
    if (hasError) return;

    if (isResultEvaluated) {
      // Use previous result as the starting operand of the next calculation
      previousInput = currentInput;
      expression = `${currentInput} ${opSymbol} `;
      currentInput = '';
      isResultEvaluated = false;
    } else {
      if (currentInput !== '') {
        // User finished typing an operand: append to expression
        previousInput = currentInput;
        expression += `${currentInput} ${opSymbol} `;
        currentInput = '';
      } else if (expression !== '') {
        // User typed consecutive operators: replace the previous operator
        expression = expression.trimEnd().replace(/[\+\−\×\÷]$/, opSymbol) + ' ';
      } else {
        // Empty start: treat as 0 [operator]
        previousInput = '0';
        expression = `0 ${opSymbol} `;
        currentInput = '';
      }
    }

    setActiveOperatorHighlight(opSymbol);
    updateDisplay();
  }

  /**
   * Handles evaluation (= button).
   */
  function handleEquals() {
    if (hasError) return;
    clearActiveOperatorHighlight();

    if (isResultEvaluated) {
      // Already evaluated; do nothing on repeated equals
      return;
    }

    let fullExpression = '';
    if (currentInput !== '') {
      fullExpression = expression + currentInput;
    } else if (expression !== '') {
      // Remove trailing hanging operator if user hits equals immediately
      fullExpression = expression.trimEnd().replace(/[\+\−\×\÷]$/, '').trim();
    } else {
      fullExpression = currentInput || '0';
    }

    if (!fullExpression) {
      fullExpression = '0';
    }

    try {
      const calcResult = evaluateExpression(fullExpression);

      // Handle very large numbers with scientific notation
      if (Math.abs(calcResult) >= 1e12 || (Math.abs(calcResult) < 1e-7 && calcResult !== 0)) {
        currentInput = calcResult.toExponential(6).replace(/\+/, '');
      } else {
        currentInput = calcResult.toString();
      }

      expression = `${fullExpression} =`;
      isResultEvaluated = true;
      hasError = false;
    } catch (err) {
      hasError = true;
      currentInput = err.message === 'Cannot divide by zero' ? 'Cannot divide by zero' : 'Invalid Expression';
      expression = `${fullExpression} =`;
    }

    updateDisplay();
  }

  /**
   * Handles sign toggle (± button).
   */
  function toggleSign() {
    if (hasError) return;

    if (isResultEvaluated) {
      isResultEvaluated = false;
      expression = '';
    }

    if (currentInput === '' && expression !== '') {
      currentInput = '-';
      clearActiveOperatorHighlight();
      updateDisplay();
      return;
    }

    if (currentInput === '0') return;

    if (currentInput.startsWith('-')) {
      currentInput = currentInput.slice(1);
    } else {
      currentInput = '-' + currentInput;
    }

    updateDisplay();
  }

  /**
   * Handles percentage calculation.
   * If part of an addition/subtraction, calculates percentage of previous base number.
   * Otherwise calculates standard unary percentage (value / 100).
   */
  function handlePercentage() {
    if (hasError) return;

    if (currentInput === '' && expression !== '') {
      return;
    }

    const value = parseFloat(currentInput || '0');
    if (isNaN(value)) return;

    // Check if the preceding expression is an additive operation (e.g., "100 + ")
    const additiveMatch = expression.match(/^(.*?)([\+\−])\s*$/);
    if (additiveMatch) {
      try {
        const baseExpr = additiveMatch[1].trim();
        const baseValue = evaluateExpression(baseExpr);
        const percentPortion = cleanFloat(baseValue * (value / 100));
        currentInput = percentPortion.toString();
      } catch {
        currentInput = cleanFloat(value / 100).toString();
      }
    } else {
      currentInput = cleanFloat(value / 100).toString();
    }

    if (isResultEvaluated) {
      isResultEvaluated = false;
      expression = '';
    }

    updateDisplay();
  }

  /**
   * Handles backspace (⌫ button).
   */
  function handleBackspace() {
    if (hasError) {
      clearAll();
      return;
    }

    if (isResultEvaluated) {
      expression = '';
      isResultEvaluated = false;
      updateDisplay();
      return;
    }

    if (currentInput.length > 0) {
      if (currentInput.length === 1 || (currentInput.length === 2 && currentInput.startsWith('-'))) {
        currentInput = '0';
      } else {
        currentInput = currentInput.slice(0, -1);
      }
    } else if (expression !== '') {
      // Remove trailing operator and bring back the previous operand into editing
      const trimmed = expression.trimEnd();
      const operatorMatch = trimmed.match(/^(.*?)([\+\−\×\÷])$/);
      if (operatorMatch) {
        let remaining = operatorMatch[1].trim();
        const lastNumMatch = remaining.match(/(\S+)$/);
        if (lastNumMatch) {
          currentInput = lastNumMatch[1];
          expression = remaining.slice(0, -lastNumMatch[1].length).trim();
          if (expression) expression += ' ';
        } else {
          expression = '';
          currentInput = '0';
        }
      }
      clearActiveOperatorHighlight();
    }

    updateDisplay();
  }

  /**
   * Resets the entire calculator state (AC button).
   */
  function clearAll() {
    expression = '';
    currentInput = '0';
    previousInput = '0';
    isResultEvaluated = false;
    hasError = false;
    clearActiveOperatorHighlight();
    updateDisplay();
  }

  // =========================================================================
  // Tactile Button Press Animation
  // =========================================================================

  function animateButton(button) {
    if (!button) return;
    button.classList.add('btn-pressed');
    setTimeout(() => {
      button.classList.remove('btn-pressed');
    }, 120);
  }

  // =========================================================================
  // Event Delegation: Mouse & Touch Clicks
  // =========================================================================

  keypad.addEventListener('click', (event) => {
    const btn = event.target.closest('button');
    if (!btn) return;

    animateButton(btn);

    const action = btn.dataset.action;
    const value = btn.dataset.value;

    switch (action) {
      case 'number':
        inputDigit(value);
        break;
      case 'decimal':
        inputDecimal();
        break;
      case 'operator':
        handleOperator(value);
        break;
      case 'equals':
        handleEquals();
        break;
      case 'clear':
        clearAll();
        break;
      case 'backspace':
        handleBackspace();
        break;
      case 'negate':
        toggleSign();
        break;
      case 'percent':
        handlePercentage();
        break;
      default:
        break;
    }
  });

  // =========================================================================
  // Physical Keyboard Support
  // =========================================================================

  window.addEventListener('keydown', (event) => {
    const key = event.key;

    // Prevent default browser shortcuts for calculator keys
    if (['Enter', 'Backspace', '/', 'Escape', ' '].includes(key)) {
      event.preventDefault();
    }

    let targetBtn = null;

    if (/^[0-9]$/.test(key)) {
      inputDigit(key);
      targetBtn = keypad.querySelector(`.btn-number[data-value="${key}"]`);
    } else if (key === '.' || key === ',') {
      inputDecimal();
      targetBtn = keypad.querySelector('.btn[data-action="decimal"]');
    } else if (key === '+') {
      handleOperator('+');
      targetBtn = keypad.querySelector('.btn-operator[data-value="+"]');
    } else if (key === '-') {
      handleOperator('−');
      targetBtn = keypad.querySelector('.btn-operator[data-value="−"]');
    } else if (key === '*' || key.toLowerCase() === 'x') {
      handleOperator('×');
      targetBtn = keypad.querySelector('.btn-operator[data-value="×"]');
    } else if (key === '/') {
      handleOperator('÷');
      targetBtn = keypad.querySelector('.btn-operator[data-value="÷"]');
    } else if (key === 'Enter' || key === '=') {
      handleEquals();
      targetBtn = keypad.querySelector('.btn-equals');
    } else if (key === 'Backspace') {
      handleBackspace();
      targetBtn = keypad.querySelector('.btn[data-action="backspace"]');
    } else if (key === 'Escape' || key.toLowerCase() === 'c') {
      clearAll();
      targetBtn = keypad.querySelector('.btn[data-action="clear"]');
    } else if (key === '%') {
      handlePercentage();
      targetBtn = keypad.querySelector('.btn[data-action="percent"]');
    } else if (key === 'F9' || key.toLowerCase() === 'n' || key === '_') {
      toggleSign();
      targetBtn = keypad.querySelector('.btn[data-action="negate"]');
    }

    if (targetBtn) {
      animateButton(targetBtn);
    }
  });

  // Initial display setup
  updateDisplay();
});
