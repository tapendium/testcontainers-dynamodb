import {
  AttributeDefinition,
  CreateTableInput,
  GlobalSecondaryIndex,
  KeySchemaElement,
} from '@aws-sdk/client-dynamodb';
import { Table, attr } from 'dynamodb-toolbox';
import { IndexableKeyType } from 'dynamodb-toolbox/dist/esm/table';
import { Key } from 'dynamodb-toolbox/dist/esm/table/types';

/**
 * Convert DynamoDB Toolbox table definition into equivalent input to CreateTableInput
 *
 * @param tableDef - DynamoDB toolbox table definition
 */
const getCreateTableInputFromDdbtoolboxTable = <T extends Table>(
  tableDef: T
): CreateTableInput => {
  const { partitionKey, sortKey, indexes, name: tableName } = tableDef;
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
    TableName: tableName
      ? typeof tableName === 'function'
        ? tableName()
        : tableName
      : undefined,
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
  partitionKey?: Key<string, IndexableKeyType>;
  sortKey?: Key<string, IndexableKeyType>;
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
