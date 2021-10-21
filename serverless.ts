import auth0Authorizer from '@functions/auth0Authorizer';
import type { AWS } from '@serverless/typescript';


import groups from '@functions/getGroups';
import creategroup from '@functions/createGroup';
import getImages from '@functions/getImages';

const serverlessConfiguration: AWS = {
  service: 'serverless-app',
  frameworkVersion: '2',
  custom: {
    webpack: {
      webpackConfig: './webpack.config.js',
      includeModules: true,
    },
    topicName: 'imagesTopic-${self:provider.stage}'
  },
  
  plugins: ['serverless-webpack'],
  package:{
    individually: false,
    include: ['src/**']
  },
  provider: {
    name: 'aws',
    runtime: 'nodejs14.x',
    stage: 'dev',
    region: 'us-east-2',
    apiGateway: {
      minimumCompressionSize: 1024,
      shouldStartNameWithService: true,
    },
    environment: {
      AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      GROUPS_TABLE: 'Groups-${self:provider.stage}',
      IMAGES_TABLE: 'Image-${self:provider.stage}',
    },
    lambdaHashingVersion: '20201221',
    iamRoleStatements: [
      {
        Effect: 'Allow',
        Action: [
          'dynamodb:Scan',
          'dynamodb:PutItem',
          'dynamodb:GetItem',
        ],
        Resource: [
          {"Fn::GetAtt": [ 'GroupsDynamoDBTable', 'Arn' ]}
        ]
      },
      {
        Effect: 'Allow',
        Action: [
          'dynamodb:Query',
        ],
        Resource: [
          {"Fn::GetAtt": [ 'ImagesDynamoDBTable', 'Arn' ]}
        ]
      },
    ]
  },
  // import the function via paths
  functions: { groups, creategroup, auth0Authorizer, getImages },
  resources:{
    Resources: {
      GatewayResponseDefault4xx: {
        Type: 'AWS::ApiGateway::GatewayResponse',
        Properties: {
            ResponseParameters: {
              "gatewayresponse.header.Access-Control-Allow-Origin":"'*'",
              "gatewayresponse.header.Access-Control-Allow-Headers":"'*'",
              "gatewayresponse.header.Access-Control-Allow-Methods":"'GET,OPTIONS,POST'"
            },
            ResponseType: "DEFAULT_4XX",
            RestApiId: {
              Ref: 'ApiGatewayRestApi'
            }
        }
      },
      GroupsDynamoDBTable: {
        Type: 'AWS::DynamoDB::Table',
        Properties: {
          TableName: '${self:provider.environment.GROUPS_TABLE}',
          AttributeDefinitions: [
              { AttributeName: 'id', AttributeType: 'S' }
          ],
          KeySchema: [
              { AttributeName: 'id', KeyType: 'HASH' }
          ],
          BillingMode: 'PAY_PER_REQUEST'
        }
      },
      ImagesDynamoDBTable: {
        Type: 'AWS::DynamoDB::Table',
        Properties: {
          TableName: '${self:provider.environment.IMAGES_TABLE}',
          AttributeDefinitions: [
              { AttributeName: 'groupId', AttributeType: 'S' },
              { AttributeName: 'timestamp', AttributeType: 'S' },
              // { AttributeName: 'imageId', AttributeType: 'S' }
          ],
          KeySchema: [
              { AttributeName: 'groupId', KeyType: 'HASH' },
              { AttributeName: 'timestamp', KeyType: 'RANGE' }
          ],
          BillingMode: 'PAY_PER_REQUEST'
        }
      },
    }
  }
};

module.exports = serverlessConfiguration;
