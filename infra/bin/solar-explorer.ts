#!/usr/bin/env node
import 'dotenv/config';
import * as cdk from 'aws-cdk-lib';
import { SolarExplorerStack } from '../lib/solar-explorer-stack';

/**
 * Environment variable keys consumed by the infrastructure stack.
 * No environment-specific value is hardcoded anywhere — every value is
 * read from the process environment (optionally provided via an .env file).
 */
const EnvKey = {
  DOMAIN_NAME: 'DOMAIN_NAME',
  HOSTED_ZONE_ID: 'HOSTED_ZONE_ID',
  HOSTED_ZONE_NAME: 'HOSTED_ZONE_NAME',
  AWS_REGION: 'AWS_REGION',
  AWS_ACCOUNT_ID: 'AWS_ACCOUNT_ID',
} as const;

/**
 * CloudFront requires its ACM certificate to live in us-east-1, so the whole
 * stack is deployed there. This is the default and recommended region.
 */
const DEFAULT_REGION = 'us-east-1';
const STACK_ID = 'SolarExplorerStack';

/**
 * Reads a required environment variable, throwing a clear error when missing
 * so that a misconfigured deployment fails fast instead of synthesizing an
 * invalid template.
 */
function requireEnv(key: string): string {
  const value = process.env[key];
  if (value === undefined || value.trim() === '') {
    throw new Error(
      `Missing required environment variable "${key}". ` +
        `Copy infra/.env.example to infra/.env and fill in all values.`,
    );
  }
  return value.trim();
}

const app = new cdk.App();

new SolarExplorerStack(app, STACK_ID, {
  domainName: requireEnv(EnvKey.DOMAIN_NAME),
  hostedZoneId: requireEnv(EnvKey.HOSTED_ZONE_ID),
  hostedZoneName: requireEnv(EnvKey.HOSTED_ZONE_NAME),
  env: {
    // Account is taken from the environment when provided, otherwise resolved
    // by the CDK CLI from the active AWS profile at deploy time.
    account: process.env[EnvKey.AWS_ACCOUNT_ID],
    region: process.env[EnvKey.AWS_REGION] ?? DEFAULT_REGION,
  },
});
