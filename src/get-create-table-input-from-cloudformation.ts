import { join } from 'path';
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';

type GetCreateTableInputFromCloudformationOptions = {
  pathToDbInfra: string;
  tableResourceName: string;
};

type CFResource = {
  Resources: Record<
    string,
    {
      Properties: Record<string, any>;
    }
  >;
};

function isCloudformationResource(config: unknown): config is CFResource {
  if (
    config &&
    typeof config === 'object' &&
    'Resources' in config &&
    config.Resources &&
    typeof config.Resources === 'object' &&
    'Properties' in config.Resources &&
    typeof config.Resources.Properties === 'object'
  ) {
    return true;
  }
  return false;
}

export const getCreateTableInputFromCloudformation = (
  options: GetCreateTableInputFromCloudformationOptions
) => {
  const { pathToDbInfra, tableResourceName } = options;
  const PROJECT_PATH = process.cwd();
  const fullPath = join(PROJECT_PATH, pathToDbInfra);
  const payload = readFileSync(fullPath, 'utf8');
  const config = load(payload);

  if (!isCloudformationResource(config)) {
    throw new Error('Invalid schema');
  }
  const createTableInput = config.Resources?.[tableResourceName]?.Properties;

  return createTableInput;
};
