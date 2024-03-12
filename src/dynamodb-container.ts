import {
  CreateTableCommand,
  CreateTableCommandInput,
  DeleteTableCommand,
  DynamoDBClient,
} from '@aws-sdk/client-dynamodb';
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  TranslateConfig,
} from '@aws-sdk/lib-dynamodb';
import {
  GenericContainer,
  RestartOptions,
  StartedTestContainer,
  StopOptions,
  StoppedTestContainer,
} from 'testcontainers';
import { ExecResult } from 'testcontainers/build/index';
import {
  ContentToCopy,
  DirectoryToCopy,
  FileToCopy,
  Labels,
} from 'testcontainers/build/types';

export class StartedDynamoDBContainer implements StartedTestContainer {
  constructor(
    private readonly startedContainer: StartedTestContainer,
    private readonly initData: Array<TableInitStructure>
  ) {}

  restart(options?: Partial<RestartOptions>): Promise<void> {
    return this.startedContainer.restart(options);
  }

  getHost(): string {
    return this.startedContainer.getHost();
  }

  getFirstMappedPort(): number {
    return this.startedContainer.getFirstMappedPort();
  }

  getLabels(): Labels {
    return this.startedContainer.getLabels();
  }

  getNetworkNames(): string[] {
    return this.startedContainer.getNetworkNames();
  }

  getNetworkId(networkName: string): string {
    return this.startedContainer.getNetworkId(networkName);
  }

  getIpAddress(networkName: string): string {
    return this.startedContainer.getIpAddress(networkName);
  }

  copyArchiveFromContainer(path: string): Promise<NodeJS.ReadableStream> {
    return this.startedContainer.copyArchiveFromContainer(path);
  }

  copyDirectoriesToContainer(
    directoriesToCopy: DirectoryToCopy[]
  ): Promise<void> {
    return this.startedContainer.copyDirectoriesToContainer(directoriesToCopy);
  }

  copyFilesToContainer(filesToCopy: FileToCopy[]): Promise<void> {
    return this.startedContainer.copyFilesToContainer(filesToCopy);
  }

  copyContentToContainer(contentsToCopy: ContentToCopy[]): Promise<void> {
    return this.startedContainer.copyContentToContainer(contentsToCopy);
  }

  exec(command: string[]): Promise<ExecResult> {
    return this.startedContainer.exec(command);
  }

  getContainerIpAddress(): string {
    const networkName = this.startedContainer.getNetworkNames()[0];
    return this.startedContainer.getIpAddress(networkName);
  }

  getId(): string {
    return this.startedContainer.getId();
  }

  getMappedPort(port: number): number {
    return this.startedContainer.getMappedPort(port);
  }

  getName(): string {
    return this.startedContainer.getName();
  }

  logs(): ReturnType<typeof this.startedContainer.logs> {
    return this.startedContainer.logs();
  }

  stop(options?: Partial<StopOptions>): Promise<StoppedTestContainer> {
    return this.startedContainer.stop(options);
  }

  endpointUrl(): string {
    return `http://localhost:${this.getMappedPort(
      DynamoDBContainer.MAPPED_PORT
    )}`;
  }

  private get clientConfig() {
    return {
      endpoint: this.endpointUrl(),
      region: 'local',
      credentials: {
        accessKeyId: 'dummy',
        secretAccessKey: 'dummy',
      },
    };
  }

  createDocumentClient(
    translateConfig?: TranslateConfig
  ): DynamoDBDocumentClient {
    return DynamoDBDocumentClient.from(
      new DynamoDBClient(this.clientConfig),
      translateConfig
    );
  }

  async resetData(overrideData?: Array<TableInitStructure>): Promise<void> {
    const documentClient = this.createDocumentClient();
    for (const tableStructure of overrideData || this.initData) {
      // delete table if exist
      try {
        console.log('deleting table', tableStructure);
        await documentClient
          .send(
            new DeleteTableCommand({
              TableName: tableStructure.table.TableName,
            })
          )
          .catch((err) => {
            if (err.code !== 'ResourceNotFoundException') {
              throw err;
            }
          });
        console.log('deleting table success', tableStructure);
      } catch (error) {
        console.log('failed to delete table');
      }

      // create table
      await documentClient.send(new CreateTableCommand(tableStructure.table));

      // init data
      if (tableStructure.items && tableStructure.items.length > 0) {
        const tableName = tableStructure.table.TableName as string;
        const putRequests = tableStructure.items.map((x) => ({
          PutRequest: { Item: x },
        }));

        for (const requests of this.chunkArray(putRequests, 25)) {
          await documentClient.send(
            new BatchWriteCommand({
              RequestItems: {
                [tableName]: requests,
              },
            })
          );
        }
      }
    }
  }

  private chunkArray<A>(array: Array<A>, size: number): Array<Array<A>> {
    let result: any[] = [];
    for (let i = 0; i < array.length; i += size) {
      let chunk = array.slice(i, i + size);
      result.push(chunk);
    }
    return result;
  }
}

export interface TableInitStructure {
  table: CreateTableCommandInput;
  items?: Array<object>;
}

export class DynamoDBContainer extends GenericContainer {
  private static readonly IMAGE_NAME = 'amazon/dynamodb-local';
  public static readonly MAPPED_PORT = 8000;

  constructor(private readonly initStructure: Array<TableInitStructure> = []) {
    super(DynamoDBContainer.IMAGE_NAME);
    this.withExposedPorts(DynamoDBContainer.MAPPED_PORT);
  }

  async start(): Promise<StartedDynamoDBContainer> {
    const startedContainer = new StartedDynamoDBContainer(
      await super.start(),
      this.initStructure
    );
    await startedContainer.resetData();

    return startedContainer;
  }
}
