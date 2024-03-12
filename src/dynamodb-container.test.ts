import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  DynamoDBContainer,
  StartedDynamoDBContainer,
} from './dynamodb-container';
import { ListTablesCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

const initDataTest = [
  {
    table: {
      TableName: 'newTable',
      AttributeDefinitions: [
        {
          AttributeName: 'id',
          AttributeType: 'S',
        },
      ],
      KeySchema: [
        {
          AttributeName: 'id',
          KeyType: 'HASH',
        },
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 1,
        WriteCapacityUnits: 1,
      },
    },
    items: [
      {
        id: '1',
        data: '222',
      },
      {
        id: '2',
        data: 'abc',
      },
    ],
  },
  {
    table: {
      TableName: 'emptyTable',
      AttributeDefinitions: [
        {
          AttributeName: 'id',
          AttributeType: 'S',
        },
      ],
      KeySchema: [
        {
          KeyType: 'HASH',
          AttributeName: 'id',
        },
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 1,
        WriteCapacityUnits: 1,
      },
    },
    items: [],
  },
];

describe('DynamoDB container', () => {
  let startedContainer: StartedDynamoDBContainer;
  beforeAll(async () => {
    startedContainer = await new DynamoDBContainer().start();
  });

  afterEach(async () => {
    await startedContainer.resetData();
  });

  afterAll(async () => {
    await startedContainer.stop();
  });

  it('should start dynamodb container', async () => {
    const dynamoClient = startedContainer.createDocumentClient();
    const response = await dynamoClient.send(new ListTablesCommand({}));
    expect(response.TableNames).toEqual([]);
  });

  it('should override data and reset it in dynamodb', async () => {
    const documentClient = startedContainer.createDocumentClient();
    await startedContainer.resetData(initDataTest as any);
    const response = await documentClient.send(
      new ScanCommand({
        TableName: 'newTable',
      })
    );
    const listTablesResponse = await documentClient.send(
      new ListTablesCommand({})
    );

    const items = response.Items || [];

    expect(listTablesResponse.TableNames).toEqual(['emptyTable', 'newTable']);
    expect(unmarshall(items[0])).toEqual(initDataTest[0].items[0]);
  });
});
