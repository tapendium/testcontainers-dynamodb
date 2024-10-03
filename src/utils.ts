/** 32 byte random alpha numeric string */
const randomAlphaNum = () => crypto.randomUUID().replace(/[^a-z0-9]/g, '');

/** Maximum length of DynamoDB table name */
const MAX_TABLE_NAME = 255;

/**
 * Generate a random test table name based on original TableName if provided
 */
const tableName = (name?: string) => {
  const base = name ?? 'Table';
  const newName = `${base}-${randomAlphaNum()}`;
  return newName.slice(0, MAX_TABLE_NAME);
};

export { tableName };
