// EAS (Ethereum Attestation Service) tests

import { createMockAttestation } from '../setup/test-utils';

describe('EAS Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Attestation Creation', () => {
    it('should create valid attestation data', () => {
      const attestation = createMockAttestation();

      expect(attestation).toHaveProperty('uid');
      expect(attestation).toHaveProperty('schema');
      expect(attestation).toHaveProperty('attester');
      expect(attestation).toHaveProperty('data');
      expect(attestation).toHaveProperty('time');
      expect(attestation).toHaveProperty('revocable');
      expect(attestation).toHaveProperty('revoked');

      // Validate data types
      expect(typeof attestation.uid).toBe('string');
      expect(typeof attestation.schema).toBe('string');
      expect(typeof attestation.attester).toBe('string');
      expect(typeof attestation.data).toBe('string');
      expect(typeof attestation.time).toBe('number');
      expect(typeof attestation.revocable).toBe('boolean');
      expect(typeof attestation.revoked).toBe('boolean');
    });

    it('should allow custom attestation properties', () => {
      const customAttestation = createMockAttestation({
        uid: 'custom-uid-123',
        schema: 'custom-schema-456',
        revoked: true,
      });

      expect(customAttestation.uid).toBe('custom-uid-123');
      expect(customAttestation.schema).toBe('custom-schema-456');
      expect(customAttestation.revoked).toBe(true);
      // Default values should still be present
      expect(customAttestation.revocable).toBe(true);
    });
  });

  describe('Attestation Validation', () => {
    it('should validate attestation structure', () => {
      const attestation = createMockAttestation();

      // Check required fields
      const requiredFields = ['uid', 'schema', 'attester', 'data', 'time', 'revocable', 'revoked'];
      requiredFields.forEach(field => {
        expect(attestation).toHaveProperty(field);
      });
    });

    it('should validate hex string format for uid and schema', () => {
      const attestation = createMockAttestation();

      // UID should be a hex string (starts with 0x)
      expect(attestation.uid).toMatch(/^0x[a-fA-F0-9]+$/);
      expect(attestation.schema).toMatch(/^0x[a-fA-F0-9]+$/);
      expect(attestation.attester).toMatch(/^0x[a-fA-F0-9]+$/);
      expect(attestation.data).toMatch(/^0x[a-fA-F0-9]+$/);
    });

    it('should validate timestamp is reasonable', () => {
      const attestation = createMockAttestation();
      const now = Date.now();
      const fiveMinutesAgo = now - 5 * 60 * 1000;

      // Time should be recent (within 5 minutes)
      expect(attestation.time).toBeGreaterThan(fiveMinutesAgo);
      expect(attestation.time).toBeLessThanOrEqual(now);
    });
  });

  describe('Attestation Processing', () => {
    it('should handle attestation revocation', () => {
      const attestation = createMockAttestation({ revoked: true });
      
      expect(attestation.revoked).toBe(true);
      expect(attestation.revocable).toBe(true); // Should still be revocable
    });

    it('should handle non-revocable attestations', () => {
      const attestation = createMockAttestation({ 
        revocable: false,
        revoked: false,
      });
      
      expect(attestation.revocable).toBe(false);
      expect(attestation.revoked).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid attestation data gracefully', () => {
      // Test with empty/invalid overrides
      const attestation = createMockAttestation({
        uid: '', // Empty UID
      });

      expect(attestation.uid).toBe('');
      // Other fields should have default values
      expect(attestation.schema).toBeDefined();
      expect(attestation.attester).toBeDefined();
    });
  });
});
