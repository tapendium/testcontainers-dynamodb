# Testcontainers DynamoDB


```bash
npm i -D @tapendium/testcontainers-dynamodb
```

```ts
describe('receive PwaRouteConfigCreated message', () => {
  let startedContainer: StartedDynamoDBContainer;
  let dynamoDocumentClient: DynamoDBDocumentClient;

  beforeAll(async () => {
    const dashboardTableProperties =
      getDashboardTableProperties() as unknown as CreateTableCommandInput;
    startedContainer = await new DynamoDBContainer([
      {
        table: dashboardTableProperties,
      },
    ]).start();
    dynamoDocumentClient = startedContainer.createDocumentClient();
    vi.spyOn(getDbContainer, 'getDocumentClient').mockImplementation(
      () => dynamoDocumentClient
    );
  });

  afterAll(async () => {
    await startedContainer.stop();
  });
});
```

