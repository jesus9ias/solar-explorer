# Solar Explorer — Infrastructure (AWS CDK)

This package provisions the static-hosting infrastructure for the Solar
Explorer frontend using the AWS CDK (TypeScript).

## What it provisions

The single stack (`SolarExplorerStack`) creates:

- **S3 bucket** — private (all public access blocked), encrypted, HTTPS
  enforced. Website hosting is disabled; content is served only through
  CloudFront via an Origin Access Control.
- **ACM certificate** — issued in `us-east-1` (required by CloudFront) and
  validated through DNS using the configured Route 53 hosted zone.
- **CloudFront distribution** — HTTPS-only (redirects HTTP), S3 origin, custom
  domain, with `403`/`404` remapped to `index.html`.
- **Route 53 A record** — aliases the configured domain to the distribution.

Outputs include the bucket name and distribution ID consumed by the frontend
deploy workflow.

## Prerequisites

- Node.js 24+
- An AWS account and credentials (configured profile or environment variables)
- A Route 53 **public hosted zone** already created for your domain
- AWS CDK CLI (installed locally as a dev dependency; run via `npm run` or
  `npx cdk`)

## Region requirement

CloudFront only accepts ACM certificates issued in `us-east-1`, so this stack
is deployed to `us-east-1` (the default). Keep `AWS_REGION=us-east-1`.

## Configuration

All environment-specific values are read from environment variables. Copy the
example file and fill in your values:

```bash
cp .env.example .env
```

| Variable           | Description                                        |
| ------------------ | -------------------------------------------------- |
| `DOMAIN_NAME`      | Fully qualified domain, e.g. `solar.example.com`   |
| `HOSTED_ZONE_ID`   | Route 53 Hosted Zone ID                            |
| `HOSTED_ZONE_NAME` | Hosted Zone apex name, e.g. `example.com`          |
| `AWS_REGION`       | Deployment region (must be `us-east-1`)            |
| `AWS_ACCOUNT_ID`   | Target AWS account ID                              |
| `AWS_PROFILE`      | AWS credentials profile used by the CDK CLI        |

> `.env` is git-ignored and must never be committed.

## Usage

Install dependencies:

```bash
npm install
```

Synthesize the CloudFormation template (no AWS credentials required):

```bash
npm run synth
```

Bootstrap the account/region once (required before the first deploy):

```bash
npm run bootstrap
```

Review a diff and deploy:

```bash
npm run diff
npm run deploy
```

Tear everything down (the S3 bucket is retained by design):

```bash
npm run destroy
```

## CI/CD secrets

The frontend GitHub Actions workflow (`.github/workflows/deploy.yml`) deploys
the built site to the infrastructure created here. Wire the stack outputs to
repository secrets:

| Stack output | GitHub secret | Used for |
|---|---|---|
| `BucketName` | `S3_BUCKET` | `aws s3 sync` target |
| `DistributionId` | `CF_DISTRIBUTION_ID` | CloudFront cache invalidation |
| — | `AWS_DEPLOY_ROLE_ARN` | IAM role assumed via GitHub OIDC |
| — | `AWS_REGION` | deployment region (`us-east-1`) |

After `npm run deploy`, read the outputs from the CDK CLI (or the CloudFormation
console) and set them as secrets. The deploy role must allow `s3:PutObject`/
`s3:DeleteObject`/`s3:ListBucket` on the bucket and
`cloudfront:CreateInvalidation` on the distribution.

## Notes

- The S3 bucket uses a `RETAIN` removal policy so site content is not deleted
  if the stack is destroyed. Remove the bucket manually if you truly intend to
  delete it.
- DNS validation of the certificate requires the hosted zone to be the
  authoritative resolver for the domain. The first deploy waits for the
  validation records to propagate.
