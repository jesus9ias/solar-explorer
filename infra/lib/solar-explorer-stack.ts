import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';

/**
 * Configuration for the Solar Explorer hosting stack. All values originate
 * from environment variables resolved in the CDK app entry point.
 */
export interface SolarExplorerStackProps extends cdk.StackProps {
  /** Fully qualified domain the site is served from, e.g. solar.example.com */
  readonly domainName: string;
  /** Route 53 Hosted Zone ID that owns the domain. */
  readonly hostedZoneId: string;
  /** Route 53 Hosted Zone apex name, e.g. example.com */
  readonly hostedZoneName: string;
}

/** Default document served for the site root. */
const DEFAULT_ROOT_OBJECT = 'index.html';
/** HTTP status codes remapped to the SPA entry document. */
const SPA_FALLBACK_STATUS_CODES = [403, 404] as const;

/**
 * Provisions the full static-hosting infrastructure for the Solar Explorer
 * frontend:
 *   - a private S3 bucket (no public access, served only via CloudFront),
 *   - an ACM certificate validated through DNS (must be in us-east-1),
 *   - a CloudFront distribution served over HTTPS from the S3 origin,
 *   - a Route 53 A-record aliasing the domain to the distribution.
 */
export class SolarExplorerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: SolarExplorerStackProps) {
    super(scope, id, props);

    // Existing hosted zone — referenced by attributes so no account lookup
    // (and therefore no AWS credentials) is required at synth time.
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(
      this,
      'HostedZone',
      {
        hostedZoneId: props.hostedZoneId,
        zoneName: props.hostedZoneName,
      },
    );

    // Private bucket: all public access blocked, encrypted, HTTPS enforced.
    // Content is reachable exclusively through the CloudFront distribution.
    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      publicReadAccess: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
    });

    // DNS-validated certificate. CloudFront only accepts certificates issued
    // in us-east-1, which is why this stack is deployed there.
    const certificate = new acm.Certificate(this, 'SiteCertificate', {
      domainName: props.domainName,
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    // CloudFront distribution using an Origin Access Control so the S3 bucket
    // can stay completely private.
    const distribution = new cloudfront.Distribution(this, 'SiteDistribution', {
      defaultRootObject: DEFAULT_ROOT_OBJECT,
      domainNames: [props.domainName],
      certificate,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy:
          cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
      },
      errorResponses: SPA_FALLBACK_STATUS_CODES.map((httpStatus) => ({
        httpStatus,
        responseHttpStatus: 200,
        responsePagePath: `/${DEFAULT_ROOT_OBJECT}`,
      })),
    });

    // Route the custom domain to the distribution.
    new route53.ARecord(this, 'SiteAliasRecord', {
      zone: hostedZone,
      recordName: props.domainName,
      target: route53.RecordTarget.fromAlias(
        new targets.CloudFrontTarget(distribution),
      ),
    });

    // Outputs consumed by the frontend deploy workflow (Stage 4).
    new cdk.CfnOutput(this, 'BucketName', {
      value: siteBucket.bucketName,
      description: 'S3 bucket that holds the built frontend assets.',
    });
    new cdk.CfnOutput(this, 'DistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront distribution ID used for cache invalidation.',
    });
    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: distribution.distributionDomainName,
      description: 'CloudFront domain name for the distribution.',
    });
    new cdk.CfnOutput(this, 'SiteUrl', {
      value: `https://${props.domainName}`,
      description: 'Public URL of the deployed site.',
    });
  }
}
