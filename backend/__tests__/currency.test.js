const { parseRupiah, formatRupiah, validatePriceInput } = require('../../utils/currencyParser');

describe('Currency Parser', () => {
  describe('parseRupiah', () => {
    test('should parse standard format "150.000"', () => {
      expect(parseRupiah('150.000')).toBe(150000);
    });
    
    test('should parse "k" suffix', () => {
      expect(parseRupiah('150k')).toBe(150000);
      expect(parseRupiah('75k')).toBe(75000);
    });
    
    test('should parse "rb" suffix', () => {
      expect(parseRupiah('150rb')).toBe(150000);
      expect(parseRupiah('200 rb')).toBe(200000);
    });
    
    test('should parse "ribu" suffix', () => {
      expect(parseRupiah('150 ribu')).toBe(150000);
      expect(parseRupiah('200ribu')).toBe(200000);
    });
    
    test('should parse "Rp" prefix', () => {
      expect(parseRupiah('Rp150000')).toBe(150000);
      expect(parseRupiah('Rp 175000')).toBe(175000);
    });
    
    test('should handle mixed formats', () => {
      expect(parseRupiah('Rp 150.000')).toBe(150000);
      expect(parseRupiah('200 ribu')).toBe(200000);
      expect(parseRupiah('120k')).toBe(120000);
    });
    
    test('should return 0 for invalid input', () => {
      expect(parseRupiah('')).toBe(0);
      expect(parseRupiah(null)).toBe(0);
      expect(parseRupiah(undefined)).toBe(0);
      expect(parseRupiah('invalid')).toBe(0);
      expect(parseRupiah('abc123')).toBe(0);
    });
    
    test('should handle decimal values (though not typical for Rupiah)', () => {
      expect(parseRupiah('150.500')).toBe(150500); // 150.500 -> 150500
    });
  });
  
  describe('formatRupiah', () => {
    test('should format integer correctly', () => {
      expect(formatRupiah(150000)).toBe('Rp150.000');
      expect(formatRupiah(2500000)).toBe('Rp2.500.000');
      expect(formatRupiah(10000)).toBe('Rp10.000');
    });
    
    test('should handle zero and negative numbers', () => {
      expect(formatRupiah(0)).toBe('Rp0');
      expect(formatRupiah(-50000)).toBe('Rp-50.000');
    });
    
    test('should return "Rp 0" for invalid input', () => {
      expect(formatRupiah(NaN)).toBe('Rp0');
      expect(formatRupiah('invalid')).toBe('Rp0');
      expect(formatRupiah(null)).toBe('Rp0');
    });
  });
  
  describe('validatePriceInput', () => {
    test('should validate correct input', () => {
      const result = validatePriceInput('150.000');
      expect(result.valid).toBe(true);
      expect(result.amount).toBe(150000);
      expect(result.message).toContain('✅');
    });
    
    test('should reject invalid input', () => {
      const result = validatePriceInput('invalid');
      expect(result.valid).toBe(false);
      expect(result.amount).toBe(0);
      expect(result.message).toContain('Format harga tidak valid');
    });
    
    test('should reject amount too large', () => {
      const result = validatePriceInput('15000000'); // 15 juta (above 10 million limit)
      expect(result.valid).toBe(false);
      expect(result.amount).toBe(15000000);
      expect(result.message).toContain('Jumlah terlalu besar');
    });
    
    test('should accept amount at boundary', () => {
      const result = validatePriceInput('10000000'); // Exactly 10 juta
      expect(result.valid).toBe(true);
      expect(result.amount).toBe(10000000);
    });
    
    test('should handle various formats in validation', () => {
      const testCases = [
        { input: '150k', valid: true },
        { input: '200 ribu', valid: true },
        { input: 'Rp175000', valid: true },
        { input: 'abc', valid: false },
        { input: '', valid: false }
      ];
      
      testCases.forEach(({ input, valid }) => {
        const result = validatePriceInput(input);
        expect(result.valid).toBe(valid);
      });
    });
  });
  
  describe('Integration: parse -> format roundtrip', () => {
    test('should produce consistent results', () => {
      const inputs = ['150.000', '200k', 'Rp175000', '300 ribu'];
      
      inputs.forEach(input => {
        const parsed = parseRupiah(input);
        const formatted = formatRupiah(parsed);
        const reParsed = parseRupiah(formatted);
        
        // Should parse formatted string back to same amount
        expect(reParsed).toBe(parsed);
        
        // Formatted string should start with 'Rp'
        expect(formatted).toMatch(/^Rp/);
      });
    });
  });
});