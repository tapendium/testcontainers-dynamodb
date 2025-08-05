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
  CommitOptions,
  ContentToCopy,
  DirectoryToCopy,
  FileToCopy,
  Labels,
} from 'testcontainers/build/types';
import { tableName } from './utils';
import { Table } from 'dynamodb-toolbox';
import {
  getCreateTableInputFromDdbtoolboxTable,
  isDdbToolboxTable,
} from './get-create-table-input-from-ddbtoolbox-table';
import { Readable } from 'stream';

export class StartedDynamoDBContainer implements StartedTestContainer {
  private tables: string[] = [];

  constructor(
    private readonly startedContainer: StartedTestContainer,
    private readonly initData: Array<TableInitStructure>
  ) {}

  copyArchiveToContainer(tar: Readable, target?: string): Promise<void> {
    return this.startedContainer.copyArchiveToContainer(tar, target);
  }

  commit(options: CommitOptions): Promise<string> {
    return this.startedContainer.commit(options);
  }

  getHostname(): string {
    return this.getHostname();
  }

  /** Test table names created */
  get tableNames() {
    return this.tables;
  }

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

  getMappedPort(port: number, protocol?: string): number;
  getMappedPort(portWithProtocol: `${number}/${'tcp' | 'udp'}`): number;
  getMappedPort(
    port: number | `${number}/${'tcp' | 'udp'}`,
    protocol?: string
  ): number {
    if (typeof port === 'number') {
      return this.startedContainer.getMappedPort(port, protocol);
    }

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

  // Required for compatibility with StartedTestContainer...
  [Symbol.asyncDispose] = async () => {
    await this.stop();
  };

  endpointUrl(): string {
    return `http://localhost:${this.getMappedPort(
      DynamoDBContainer.MAPPED_PORT
    )}`;
  }

  private get clientConfig() {
    return {
      endpoint: this.endpointUrl(),
      region: 'local',
      credentials: { accessKeyId: 'dummy', secretAccessKey: 'dummy' },
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
            new BatchWriteCommand({ RequestItems: { [tableName]: requests } })
          );
        }
      }
    }
  }

  /**
   * Create a new test dynamodb table with specified table properties and
   * optionally seed with provided data
   */
  async createTable(
    tableProperties:
      | (Pick<CreateTableCommandInput, 'AttributeDefinitions' | 'KeySchema'> &
          Partial<
            Pick<
              CreateTableCommandInput,
              'TableName' | 'GlobalSecondaryIndexes'
            >
          >)
      | Table,
    seedData?: Record<string, unknown> | Record<string, unknown>[]
  ) {
    const client = this.createDocumentClient();

    const { TableName, ...restTableProperties } = isDdbToolboxTable(
      tableProperties
    )
      ? getCreateTableInputFromDdbtoolboxTable(tableProperties)
      : (tableProperties ?? {});

    const name = tableName(TableName);
    await client.send(
      new CreateTableCommand({
        TableName: name,
        BillingMode: 'PAY_PER_REQUEST',
        ...restTableProperties,
      })
    );
    this.tables.push(name);

    if (seedData) {
      await this.seedTable(name, seedData);
    }

    return name;
  }

  /**
   * Seed table with specified data
   * @param tableName Table to be seeded
   * @param item(s) Single or more items to be inserted into table
   */
  async seedTable(
    tableName: string,
    items: Record<string, unknown>[] | Record<string, unknown>
  ) {
    const documentClient = this.createDocumentClient();
    const data = Array.isArray(items) ? items : [items];

    const putBatches = this.chunkArray(
      data.map((item) => ({ PutRequest: { Item: item } })),
      25
    ).map((chunk) =>
      documentClient.send(
        new BatchWriteCommand({ RequestItems: { [tableName]: chunk } })
      )
    );
    await Promise.allSettled(putBatches);
  }

  async deleteTable(name: string, documentClient?: DynamoDBDocumentClient) {
    const client = documentClient ?? this.createDocumentClient();
    await client.send(new DeleteTableCommand({ TableName: name }));
    this.tables = this.tables.filter((tableName) => tableName !== name);
  }

  async deleteAllTables() {
    const client = this.createDocumentClient();
    return Promise.allSettled(
      this.tables.map((table) => this.deleteTable(table, client))
    );
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

export interface DynamoDBContainerOptions {
  /** Should container be used */
  reuse?: boolean;

  /** Reset data */
  reset?: boolean;
}

export class DynamoDBContainer extends GenericContainer {
  private static readonly IMAGE_NAME = 'amazon/dynamodb-local';
  public static readonly MAPPED_PORT = 8000;
  private shouldResetData: boolean;

  constructor(
    private readonly initStructure: Array<TableInitStructure> = [],
    { reuse, reset = true }: DynamoDBContainerOptions = {}
  ) {
    super(DynamoDBContainer.IMAGE_NAME);
    this.shouldResetData = reset;
    this.withExposedPorts(DynamoDBContainer.MAPPED_PORT);
    if (reuse) {
      this.withReuse();
    }
  }

  async start(): Promise<StartedDynamoDBContainer> {
    const startedContainer = new StartedDynamoDBContainer(
      await super.start(),
      this.initStructure
    );

    if (this.shouldResetData) {
      await startedContainer.resetData();
    }

    return startedContainer;
  }
}
