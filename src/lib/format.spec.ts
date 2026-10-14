import { describe, it, expect } from 'vitest';
import { formatCurrency, formatCurrencyInput, parseCurrencyInput, formatDate } from './format';

describe('format utilities', () => {
  it('formatCurrency rounds and formats', () => {
    expect(formatCurrency(1234.4)).toBe('$1.234');
    expect(formatCurrency(1234.6)).toBe('$1.235');
    expect(formatCurrency(0)).toBe('$0');
  });

  it('formatCurrencyInput formats while typing', () => {
    expect(formatCurrencyInput('')).toBe('');
    expect(formatCurrencyInput('1234')).toBe('1.234');
    expect(formatCurrencyInput('1234,5')).toBe('1.234,5');
    expect(formatCurrencyInput('1234,56')).toBe('1.234,56');
    expect(formatCurrencyInput('1234.56')).toBe('1.234,56');
    expect(formatCurrencyInput('1234.')).toBe('1.234,');
    expect(formatCurrencyInput('12a34b')).toBe('1.234');
  });

  it('parseCurrencyInput parses various formats', () => {
    expect(parseCurrencyInput('')).toBe(0);
    expect(parseCurrencyInput('1.234')).toBe(1234);
    expect(parseCurrencyInput('1.234,56')).toBe(1234.56);
    expect(parseCurrencyInput('1234,56')).toBe(1234.56);
    expect(parseCurrencyInput('1234.56')).toBe(1234.56);
  });

  it('formatDate returns - for invalid dates and formatted string for valid', () => {
    expect(formatDate('invalid')).toBe('-');
    const d = new Date('2023-03-05');
    // depending on locale, but our implementation uses es-AR dd/mm/yyyy
    expect(formatDate(d)).toBe(d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }));
  });
});
