import { describe, it, expect } from 'vitest';
import { tableName } from './utils';

describe('random table name util', () => {
  it('generates a random name when no base name is passed in', () => {
    const name = tableName();
    expect(name).toBeTypeOf('string');
    expect(name.length).toBeLessThan(255);
  });

  it('uses the provided name when it is passed in', () => {
    const name = tableName('test');
    expect(name).toEqual(expect.stringMatching(/^test/));
    expect(name.length).toBeLessThan(255);
  });

  it('trims the generated name to the ddb limit', () => {
    const name = tableName('a'.repeat(250));
    expect(name.length).toBeLessThanOrEqual(255);
  });
});
