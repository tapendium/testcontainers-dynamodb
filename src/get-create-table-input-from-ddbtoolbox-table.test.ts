import { describe, it, expect } from 'vitest';
import { getCreateTableInputFromDdbtoolboxTable } from './get-create-table-input-from-ddbtoolbox-table';
import { Table } from 'dynamodb-toolbox';

describe('get create table input from ddb toolbox table', () => {
  it('produces the correct properties for a basic setup', () => {
    const tableDef = {
      name: 'test',
      partitionKey: { type: 'string', name: 'pk' },
      sortKey: { type: 'string', name: 'sk' },
    } as unknown as Table;

    const createTableProperties =
      getCreateTableInputFromDdbtoolboxTable(tableDef);
    expect(createTableProperties).toEqual({
      TableName: 'test',
      BillingMode: 'PAY_PER_REQUEST',
      KeySchema: [
        {
          AttributeName: 'pk',
          KeyType: 'HASH',
        },
        {
          AttributeName: 'sk',
          KeyType: 'RANGE',
        },
      ],
      AttributeDefinitions: [
        { AttributeName: 'pk', AttributeType: 'S' },
        { AttributeName: 'sk', AttributeType: 'S' },
      ],
    });
  });

  it('produces the correct properties when includes indexes', () => {
    const tableDef = {
      name: () => 'test',
      partitionKey: { type: 'string', name: 'pk' },
      sortKey: { type: 'string', name: 'sk' },
      indexes: {
        idx1: {
          type: 'global',
          partitionKey: { type: 'binary', name: 'idx1pk' },
          sortKey: { type: 'number', name: 'idx1sk' },
        },
      },
    } as unknown as Table;
    const createTableProperties =
      getCreateTableInputFromDdbtoolboxTable(tableDef);
    expect(createTableProperties).toEqual({
      TableName: 'test',
      BillingMode: 'PAY_PER_REQUEST',
      KeySchema: [
        {
          AttributeName: 'pk',
          KeyType: 'HASH',
        },
        {
          AttributeName: 'sk',
          KeyType: 'RANGE',
        },
      ],
      AttributeDefinitions: [
        { AttributeName: 'pk', AttributeType: 'S' },
        { AttributeName: 'sk', AttributeType: 'S' },
        { AttributeName: 'idx1pk', AttributeType: 'B' },
        { AttributeName: 'idx1sk', AttributeType: 'N' },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'idx1',
          KeySchema: [
            { AttributeName: 'idx1pk', KeyType: 'HASH' },
            { AttributeName: 'idx1sk', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
    });
  });
});
