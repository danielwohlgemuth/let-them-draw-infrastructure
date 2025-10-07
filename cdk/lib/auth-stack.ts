import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as fs from 'fs';
import * as path from 'path';

interface AuthStackProps extends cdk.StackProps {
}

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    const environment = ssm.StringParameter.fromStringParameterName(this, 'EnvironmentParam', '/let-them-draw/environment');
    const websiteUrl = ssm.StringParameter.fromStringParameterName(this, 'WebsiteUrlParam', '/let-them-draw/website-url');
    cdk.Tags.of(this).add('Environment', environment.stringValue);

    const userPool = new cognito.UserPool(this, 'UserPool', {
      selfSignUpEnabled: true,
      signInCaseSensitive: false,
      signInAliases: {
        email: true
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true
        }
      },
      passwordPolicy: {
        minLength: 10,
        requireDigits: false,
        requireLowercase: false,
        requireSymbols: false,
        requireUppercase: false
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });
    this.userPool = userPool;

    const devEnvironment = new cdk.CfnCondition(this, 'CfnCondition', {
      expression: cdk.Fn.conditionEquals(environment.stringValue, 'dev'),
    });

    const logoutUrls: any[] = [
      websiteUrl.stringValue + (websiteUrl.stringValue.endsWith('/') ? '' : '/'),
      cdk.Fn.conditionIf(devEnvironment.logicalId, 'http://localhost:3000/', cdk.Aws.NO_VALUE),
    ];

    const userPoolClient = userPool.addClient('UserPoolClient', {
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: true
        },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE
        ],
        callbackUrls: logoutUrls,
        logoutUrls: logoutUrls,
      },
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
      preventUserExistenceErrors: true,
    });
    this.userPoolClient = userPoolClient;

    userPool.addDomain('UserPoolDomain', {
      cognitoDomain: {
        domainPrefix: `let-them-draw-${environment.stringValue}`
      },
      managedLoginVersion: cognito.ManagedLoginVersion.NEWER_MANAGED_LOGIN
    })

    const cognitoBackgroundSvg = fs.readFileSync(path.join(__dirname, '../../assets/cognito-background.svg')).toString('base64');

    new cognito.CfnManagedLoginBranding(this, 'CfnManagedLoginBranding', {
      userPoolId: userPool.userPoolId,
      clientId: userPoolClient.userPoolClientId,
      returnMergedResources: false,
      useCognitoProvidedValues: false,
      settings: {
        categories: {
          global: {
            colorSchemeMode: 'DYNAMIC'
          }
        }
      },
      assets: [
        {
          category: 'PAGE_BACKGROUND',
          colorMode: 'DARK',
          extension: 'SVG',
          bytes: cognitoBackgroundSvg
        },
        {
          category: 'PAGE_BACKGROUND',
          colorMode: 'LIGHT',
          extension: 'SVG',
          bytes: cognitoBackgroundSvg
        }
      ]
    });
  }
}
