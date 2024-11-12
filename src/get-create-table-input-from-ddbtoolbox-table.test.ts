import { describe, it, expect } from 'vitest';
import { getCreateTableInputFromDdbtoolboxTable } from './get-create-table-input-from-ddbtoolbox-table';
import { Table } from 'dynamodb-toolbox';
import { getCreateTableInputFromCloudformation } from './get-create-table-input-from-cloudformation';

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

  it('deduplicates attribute definitions when necessary', () => {
    const tableDef = new Table({
      name: 'testtable',
      partitionKey: { type: 'string', name: 'pk' },
      sortKey: { type: 'string', name: 'usedtwice' },
      indexes: {
        gsi1: {
          type: 'global',
          partitionKey: { type: 'string', name: 'email' },
          sortKey: { type: 'string', name: 'usedtwice' },
        },
      },
    });
    const createTableProperties =
      getCreateTableInputFromDdbtoolboxTable(tableDef);
    expect(createTableProperties).toEqual({
      AttributeDefinitions: [
        { AttributeName: 'pk', AttributeType: 'S' },
        { AttributeName: 'usedtwice', AttributeType: 'S' },
        { AttributeName: 'email', AttributeType: 'S' },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'gsi1',
          KeySchema: [
            { AttributeName: 'email', KeyType: 'HASH' },
            { AttributeName: 'usedtwice', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
      KeySchema: [
        { AttributeName: 'pk', KeyType: 'HASH' },
        { AttributeName: 'usedtwice', KeyType: 'RANGE' },
      ],
      TableName: 'testtable',
    });
  });
});
