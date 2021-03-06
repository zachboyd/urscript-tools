#! /usr/bin/env node

import { readFileSync } from 'fs';
import { isArray, merge, mergeWith } from 'lodash';
import minimist from 'minimist';
import { extname } from 'path';

import { IBundlerConfig } from '../bundler/types';
import { IScriptRunnerConfig } from '../runner/types';
import { URScriptRunner } from '../runner/URScriptRunner';
import { TestExecutionService } from '../urtester/TestExecutionService';
import { TestResultWriter } from '../urtester/TestResultWriter';
import { TestRunner } from '../urtester/TestRunner';
import { ITestExecutionConfig, ITestExecutionService, ITestRunnerConfig } from '../urtester/types';
import { logger } from '../util/logger';
import { IURTesterCliConfig } from './types';

const printHelp = () => {
  console.log(
    'Usage: npx urscript-tester [--config <config.json>] [--bundle <config.json>] [path]'
  );
  console.log('Tool used to generate unique script bundles');
  console.log('Options:');
  console.log('--config Test configuration file');
  console.log('--bundle Optional bundle configuration file');
  console.log('Expression (glob format) used to determine tests to execute');
};

const defaultConfig: IURTesterCliConfig = {
  controller: {
    host: 'localhost',
    ports: {
      primary: 30001,
    },
    autoLaunch: {
      disabled: false,
      version: '5.3.1',
      stop: false,
    },
  },
  testServer: {
    host: 'autodiscover',
    port: 24493,
    defaultExecutionTimeout: 10000,
  },
  mocks: {
    include: ['__mocks__/**/*.mock.script'],
    exclude: [],
  },
  sources: {
    global: {
      scripts: {
        include: [],
        exclude: [],
      },
    },
  },
};

const getTestPattern = pattern => {
  if (pattern) {
    const ext = extname(pattern);
    if (ext) {
      return `${pattern}*`;
    } else {
      const suffixPattern = '**/*.test.script';
      if (pattern.lastIndexOf('/') === pattern.length - 1) {
        return `${pattern}${suffixPattern}`;
      } else {
        return `${pattern}/${suffixPattern}`;
      }
    }
  }

  return '**/*.test.script';
};

const main = async () => {
  const args = minimist(process.argv.slice(2));

  // get args from cli
  const { _: path, config: configFilename, bundle: bundleFilename } = args;

  if (!configFilename) {
    printHelp();
    process.exit(0);
  }

  const contents: string = readFileSync(configFilename).toString();

  let bundleContents: string | undefined;

  if (bundleFilename) {
    bundleContents = readFileSync(bundleFilename).toString();
  }

  try {
    const userConfig: IURTesterCliConfig = JSON.parse(contents);
    const config: IURTesterCliConfig = { ...defaultConfig };

    const bundlerConfig: IBundlerConfig = bundleContents
      ? JSON.parse(bundleContents)
      : {
          sources: config.sources,
          options: {
            bundleKey: 'test-harness',
            bundleOutputFile: 'default',
            outputDir: '.urscript-test',
            scriptSuffix: 'script',
            writeToDisk: true,
          },
        };

    if (!bundlerConfig.sources) {
      bundlerConfig.sources = {};
    }

    merge(config, userConfig);

    logger.debug('urtest-cli launched with config', {
      config,
    });

    const globalSources = {};

    // merge any sources from test config if provided
    mergeWith(
      globalSources,
      bundlerConfig.sources.global,
      config.sources.global,
      (objValue, srcValue) => {
        if (isArray(objValue)) {
          return objValue.concat(srcValue);
        }
      }
    );

    bundlerConfig.sources.global = globalSources;

    const scriptRunnerConfig: IScriptRunnerConfig = {
      host: config.controller.host,
      port: config.controller.ports.primary,
      controller: {
        autoLaunch: !config.controller.autoLaunch.disabled,
        controllerVersion: config.controller.autoLaunch.version,
        autoStop: config.controller.autoLaunch.stop,
      },
    };

    const testRunnerConfig: ITestRunnerConfig = {
      runner: new URScriptRunner(scriptRunnerConfig),
      port: config.testServer.port,
      executionTimeout: config.testServer.defaultExecutionTimeout,
      restartThreshold: config.testServer.restartThreshold
    };

    const executionConfig: ITestExecutionConfig = {
      runner: new TestRunner(testRunnerConfig),
      environment: {
        server: {
          host: config.testServer.host,
          port: config.testServer.port,
        },
      },
      test: {
        pattern: getTestPattern(path[0]),
      },
      mocks: config.mocks,
      bundlerConfig,
      results: {
        writer: new TestResultWriter(),
      },
    };

    const executor: ITestExecutionService = new TestExecutionService(
      executionConfig
    );

    await executor.execute();
  } catch (err) {
    console.log(err);
    process.exit(1);
  }
};

main();
