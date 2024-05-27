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

function isCloudformationResource(
  config: any,
  tableResourceName: string
): config is CFResource {
  if (
    config &&
    typeof config === 'object' &&
    'Resources' in config &&
    config.Resources &&
    typeof config.Resources === 'object' &&
    tableResourceName in config.Resources &&
    typeof config.Resources[tableResourceName] === 'object' &&
    'Properties' in config.Resources[tableResourceName] &&
    typeof config.Resources[tableResourceName].Properties === 'object'
  ) {
    return true;
  }
  return false;
}

export const getCreateTableInputFromCloudformation = (
  options: GetCreateTableInputFromCloudformationOptions
) => {
  const { pathToDbInfra, tableResourceName } = options;
  const payload = readFileSync(pathToDbInfra, 'utf8');
  const config = load(payload);

  if (!isCloudformationResource(config, tableResourceName)) {
    throw new Error('Invalid schema');
  }
  const createTableInput = config.Resources?.[tableResourceName]?.Properties;

  return createTableInput;
};
