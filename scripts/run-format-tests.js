function formatCurrency(value) {
  const rounded = Math.round(value);
  return `$${rounded.toLocaleString('es-AR')}`;
}

function formatCurrencyInput(value) {
  const raw = String(value ?? '').trim();
  if (raw === '') return '';

  const cleaned = raw.replace(/[^\d.,]/g, '');
  const lastDot = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');
  let decimalSep = '';
  if (lastComma > lastDot) decimalSep = ',';
  else if (lastDot > lastComma) decimalSep = '.';

  let integerPart = cleaned;
  let decimalPart = '';
  if (decimalSep) {
    const parts = cleaned.split(decimalSep);
    decimalPart = parts.pop() ?? '';
    integerPart = parts.join('');
  }

  integerPart = integerPart.replace(/\D/g, '');
  const intNumber = integerPart ? Number(integerPart) : 0;
  const formattedInteger = intNumber.toLocaleString('es-AR');

  if (decimalPart) {
    decimalPart = decimalPart.replace(/\D/g, '').slice(0, 2);
    return `${formattedInteger},${decimalPart}`;
  }

  const lastChar = raw[raw.length - 1];
  if (lastChar === '.' || lastChar === ',') {
    return `${formattedInteger},`;
  }

  return formattedInteger;
}

function parseCurrencyInput(value) {
  const raw = String(value ?? '').trim();
  if (raw === '') return 0;

  if (raw.includes(',')) {
    const normalized = raw.replace(/\./g, '').replace(/,/g, '.');
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  const dotCount = (raw.match(/\./g) || []).length;
  if (dotCount === 0) {
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  const lastDot = raw.lastIndexOf('.');
  if (dotCount === 1 && raw.length - lastDot - 1 <= 2) {
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  const numeric = Number(raw.replace(/\./g, ''));
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatDate(dateValue) {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  return Number.isNaN(date.getTime())
    ? '-'
    : date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function assertEqual(a, b, message) {
  if (a !== b) {
    console.error('FAIL:', message || `${a} !== ${b}`);
    process.exitCode = 1;
  } else {
    console.log('ok:', message || `${a} === ${b}`);
  }
}

(function run() {
  try {
    assertEqual(formatCurrency(1234.4), '$1.234', 'formatCurrency rounds down');
    assertEqual(formatCurrency(1234.6), '$1.235', 'formatCurrency rounds up');
    assertEqual(formatCurrency(0), '$0', 'formatCurrency zero');

    assertEqual(formatCurrencyInput(''), '', 'formatCurrencyInput empty');
    assertEqual(formatCurrencyInput('1234'), '1.234', 'formatCurrencyInput integer');
    assertEqual(formatCurrencyInput('1234,5'), '1.234,5', 'formatCurrencyInput comma decimal');
    assertEqual(formatCurrencyInput('1234,56'), '1.234,56', 'formatCurrencyInput two decimals');
    assertEqual(formatCurrencyInput('1234.56'), '1.234,56', 'formatCurrencyInput dot decimal');
    assertEqual(formatCurrencyInput('1234.'), '1.234,', 'formatCurrencyInput trailing dot');
    assertEqual(formatCurrencyInput('12a34b'), '1.234', 'formatCurrencyInput noisy chars');

    assertEqual(parseCurrencyInput(''), 0, 'parse empty');
    assertEqual(parseCurrencyInput('1.234'), 1234, 'parse thousand');
    assertEqual(parseCurrencyInput('1.234,56'), 1234.56, 'parse thousand+decimal');
    assertEqual(parseCurrencyInput('1234,56'), 1234.56, 'parse comma decimal');
    assertEqual(parseCurrencyInput('1234.56'), 1234.56, 'parse dot decimal');

    assertEqual(formatDate('invalid'), '-', 'formatDate invalid');
    const d = new Date('2023-03-05');
    assertEqual(formatDate(d), d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }), 'formatDate valid');

    if (process.exitCode === 1) {
      console.error('Tests failed');
      process.exit(1);
    } else {
      console.log('All tests passed');
    }
  } catch (err) {
    console.error('Error running tests', err);
    process.exit(1);
  }
})();
