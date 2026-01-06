import {
  AttributeDefinition,
  CreateTableInput,
  GlobalSecondaryIndex,
  KeySchemaElement,
} from '@aws-sdk/client-dynamodb';
import { Table } from 'dynamodb-toolbox';
import { KeyType } from 'dynamodb-toolbox/dist/esm/table';
import { Key } from 'dynamodb-toolbox/dist/esm/table/types';

/**
 * Get table name from ddb toolbox Table definition
 *
 */
const getTableName = (tableDef: Table) => {
  // @ts-expect-error v1/v2 expose table name as different properties
  const { tableName, name } = tableDef;
  const namev2 = typeof tableName === 'function' ? tableName() : tableName;
  const namev1 = typeof name === 'function' ? name() : name;
  return namev2 ?? namev1;
};

/**
 * Convert DynamoDB Toolbox table definition into equivalent input to CreateTableInput
 *
 * @param tableDef - DynamoDB toolbox table definition
 */
const getCreateTableInputFromDdbtoolboxTable = <T extends Table>(
  tableDef: T
): CreateTableInput => {
  const { partitionKey, sortKey, indexes } = tableDef;
  const tableName = getTableName(tableDef);
  if (!partitionKey) {
    throw new Error('partitionKey must be defined');
  }

  let { keySchema, attributeDefinitions } = getPartitionAndSortKeys({
    partitionKey,
    sortKey,
  });

  let gsis: GlobalSecondaryIndex[] = [];
  if (indexes) {
    Object.entries(indexes).forEach(([name, idxDef]) => {
      const { keySchema, attributeDefinitions: idxAttrDefs } =
        getPartitionAndSortKeys({
          partitionKey: idxDef.partitionKey,
          sortKey: idxDef.sortKey,
        });
      gsis.push({
        IndexName: name,
        KeySchema: keySchema,
        Projection: {
          ProjectionType: 'ALL',
        },
      });
      attributeDefinitions.push(...idxAttrDefs);
    });
  }

  const dedupedAttrs = attributeDefinitions.filter(
    (firstAttr, index, arr) =>
      arr.findIndex(
        (secondAttr) =>
          firstAttr.AttributeName === secondAttr.AttributeName &&
          firstAttr.AttributeType === secondAttr.AttributeType
      ) == index
  );

  return {
    TableName: tableName,
    KeySchema: keySchema,
    AttributeDefinitions: dedupedAttrs,
    ...(gsis.length ? { GlobalSecondaryIndexes: gsis } : {}),
  };
};

/** Convert ddbtoolbox key types to ddb native types */
const toAttributeType = (type: 'string' | 'binary' | 'number') => {
  switch (type) {
    case 'string':
      return 'S';
    case 'binary':
      return 'B';
    case 'number':
      return 'N';
  }
};

/** Get partition and sort key CF schema from ddb toolbox pk and sk */
const getPartitionAndSortKeys = ({
  partitionKey,
  sortKey,
}: {
  partitionKey?: Key<string, KeyType>;
  sortKey?: Key<string, KeyType>;
}) => {
  if (!partitionKey) {
    throw new Error('partitionKey must be defined');
  }
  const hashName = partitionKey.name;
  const hashType = toAttributeType(partitionKey.type);
  const attributeDefs: AttributeDefinition[] = [
    { AttributeName: hashName, AttributeType: hashType },
  ];
  const keySchema: KeySchemaElement[] = [
    { AttributeName: hashName, KeyType: 'HASH' },
  ];

  if (sortKey) {
    const rangeName = sortKey.name;
    const rangeType = toAttributeType(sortKey.type);
    attributeDefs.push({
      AttributeName: rangeName,
      AttributeType: rangeType,
    });
    keySchema.push({
      AttributeName: rangeName,
      KeyType: 'RANGE',
    });
  }

  return {
    keySchema,
    attributeDefinitions: attributeDefs,
  };
};

/** DynamodbToolbox Table type guard */
const isDdbToolboxTable = (data: unknown): data is Table => {
  return (data as any)?.entityAttributeSavedAs && (data as any)?.partitionKey;
};

export { getCreateTableInputFromDdbtoolboxTable, isDdbToolboxTable };
