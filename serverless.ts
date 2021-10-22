import auth0Authorizer from '@functions/auth0Authorizer';
import type { AWS } from '@serverless/typescript';


import groups from '@functions/getGroups';
import creategroup from '@functions/createGroup';
import getImages from '@functions/getImages';
import getimage from '@functions/getImage';
import createimage from '@functions/createImage';

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
      IMAGE_ID_INDEX: 'ImageIdIndex',
    },
    lambdaHashingVersion: '20201221',
    iamRoleStatements: [
      { // iam permissions to enable action on groups table
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
      { //iam permissions to enable action on images table
        Effect: 'Allow',
        Action: [
          'dynamodb:Query',
          'dynamodb:PutItem'
        ],
        Resource: [
          {"Fn::GetAtt": [ 'ImagesDynamoDBTable', 'Arn' ]}
        ]
      },
      { //query images table table using index key
        Effect: 'Allow',
        Action: [
          'dynamodb:Query'
        ],
        Resource: 'arn:aws:dynamodb:${self:provider.region}:*:table/${self:provider.environment.IMAGES_TABLE}/index/${self:provider.environment.IMAGE_ID_INDEX}'
      },
    ]
  },
  // import the function via paths
  functions: { groups, creategroup, auth0Authorizer, getImages, getimage, createimage },
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
      GroupsDynamoDBTable: { // creates groups table and the schema for required values
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
      ImagesDynamoDBTable: { // creates images table and the schema for required values
        Type: 'AWS::DynamoDB::Table',
        Properties: {
          TableName: '${self:provider.environment.IMAGES_TABLE}',
          AttributeDefinitions: [
              { AttributeName: 'groupId', AttributeType: 'S' },
              { AttributeName: 'timestamp', AttributeType: 'S' },
              { AttributeName: 'imageId', AttributeType: 'S' }
          ],
          KeySchema: [
              { AttributeName: 'groupId', KeyType: 'HASH' },
              { AttributeName: 'timestamp', KeyType: 'RANGE' }
          ],
          GlobalSecondaryIndexes: [ // creates a global index key for faster query on images table
            {
              IndexName: '${self:provider.environment.IMAGE_ID_INDEX}',
              KeySchema: [
                  { AttributeName: 'imageId', KeyType: 'HASH' },
              ],
              Projection: {
                  ProjectionType: 'ALL' 
              }
            }
          ],
          BillingMode: 'PAY_PER_REQUEST',
          StreamSpecification: {
            StreamViewType: 'NEW_IMAGE'
          }
        }
      },
    }
  }
};

module.exports = serverlessConfiguration;
