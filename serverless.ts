//import auth0Authorizer from '@functions/auth0Authorizer';
import type { AWS } from '@serverless/typescript';


import groups from '@functions/getGroups';
import creategroup from '@functions/createGroup';
import getImages from '@functions/getImages';
import getimage from '@functions/getImage';
import createimage from '@functions/createImage';
import sendNotifications from '@functions/sendNotifications';
import connect from '@functions/connect';
import disconnect from '@functions/disconnect';
import elasticSearchSync from '@functions/elasticSearchSync';
import resize from '@functions/resizeImage';

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
    runtime: 'nodejs12.x',
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
      IMAGES_S3_BUCKET: 'serverless-udagram-images-kelue-${self:provider.stage}',
      SIGNED_URL_EXPIRATION: '300',
      CONNECTIONS_TABLE: 'Connections-${self:provider.stage}',
      THUMBNAILS_S3_BUCKET: 'serverless-udagram-images-kelue-thumbnails-${self:provider.stage}',
      //AUTH_0_SECRET_ID: 'Auth0Secret-${self:provider.stage}',
      //AUTH_0_SECRET_FIELD: 'auth0Secret',
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
      {
        Effect: 'Allow',
        Action: [
          's3:PutObject',
          's3:GetObject'
        ],
        Resource: 'arn:aws:s3:::${self:provider.environment.IMAGES_S3_BUCKET}/*'
      },
      {
        Effect: 'Allow',
        Action: [
          'dynamodb:Scan',
          'dynamodb:PutItem',
          'dynamodb:DeleteItem'
        ],
        Resource: [
          {"Fn::GetAtt": [ 'ConnectionsDynamoDBTable', 'Arn' ]}
        ]
      },
      {
        Effect: 'Allow',
        Action: [
          's3:PutObject'
        ],
        Resource: 'arn:aws:s3:::${self:provider.environment.THUMBNAILS_S3_BUCKET}/*'
      },
      {
        Effect: 'Allow',
        Action: [
          'es:*',
          'es:ESHttpPost',
        ],
        Resource: { 'Fn::GetAtt': ['ImagesSearch', 'Arn'] }
      }
    ]
  },
  // import the function via paths
  functions: { groups, creategroup, getImages, getimage, createimage, sendNotifications, connect, disconnect,  elasticSearchSync, resize},
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
      ConnectionsDynamoDBTable: { // creates connections table and the schema for required values
        Type: 'AWS::DynamoDB::Table',
        Properties: {
            TableName: '${self:provider.environment.CONNECTIONS_TABLE}',
            AttributeDefinitions: [
                { AttributeName: 'id', AttributeType: 'S' }
            ],
            KeySchema: [
                { AttributeName: 'id', KeyType: 'HASH' }
            ],
            BillingMode: 'PAY_PER_REQUEST'
        }
      },
      AttachmentsBucket: {
        Type: 'AWS::S3::Bucket',
        Properties: {
          BucketName: '${self:provider.environment.IMAGES_S3_BUCKET}',
          NotificationConfiguration: {
            TopicConfigurations:[{
              Event: 's3:ObjectCreated:*',
              Topic: { Ref: 'ImagesTopic' }
            }]
          },  
          CorsConfiguration:{
            CorsRules: [
              {
                AllowedOrigins: ['*'],
                AllowedHeaders: ['*'],
                AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
                MaxAge: 3000,
              },
            ],
          }
        }
      },
      BucketPolicy: { // creates policy that allows anyone to view bucket objects even without authentication
        Type: 'AWS::S3::BucketPolicy',
        Properties: {
          PolicyDocument:{
            Id: 'MyPolicy',
            Version: '2012-10-17',
            Statement: [
              {
                Sid: 'PublicReadForGetBucketObjects',
                Effect: 'Allow',
                Principal: '*',
                Action: 's3:GetObject',
                Resource: 'arn:aws:s3:::${self:provider.environment.IMAGES_S3_BUCKET}/*'
              }
            ]
          },
          Bucket: '${self:provider.environment.IMAGES_S3_BUCKET}'
        }
      },
      ImagesTopic: {
        Type: 'AWS::SNS::Topic',
        Properties: {
          DisplayName: 'Images Bucket Topic',
          TopicName: '${self:custom.topicName}'
        }
      },
      SNSTopicPolicy: {
        Type: 'AWS::SNS::TopicPolicy',
        Properties: {
          PolicyDocument:{
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Principal: {
                  AWS: '*'
                },
                Action: 'sns:Publish',
                Resource: { Ref: 'ImagesTopic' },
                Condition:{
                  ArnLike:{
                    'AWS:SourceArn':'arn:aws:s3:::${self:provider.environment.IMAGES_S3_BUCKET}'
                  }
                }
              }
            ]
          },
          Topics: [{ Ref: 'ImagesTopic' }]
        }
      },
      ImagesSearch: {
        Type: 'AWS::Elasticsearch::Domain',
        Properties: {
          ElasticsearchVersion: '6.3',
          DomainName: 'images-search-${self:provider.stage}',
          ElasticsearchClusterConfig:{
            DedicatedMasterEnabled: false,
            InstanceCount: '1',
            ZoneAwarenessEnabled: false,
            InstanceType: 't2.small.elasticsearch'
          },
          EBSOptions: {
            EBSEnabled: true,
            Iops: 0,
            VolumeSize: 10,
            VolumeType: 'gp2'
          },
          AccessPolicies: {
            Version: '2012-10-17',
            Statement:[{
              Effect: 'Allow',
              Principal: {
                AWS: '*' 
              },
              Action: [
                'es:*'
              ], 
              Resource: { 'Fn::Sub': 'arn:aws:es:${self:provider.region}:${AWS::AccountId}:domain/images-search-${self:provider.stage}/*' },
              Condition:{
                IpAddress: { 'aws:SourceIp': ['197.210.79.163'] }
              }
            }]
          }
        }
      },
      ThumbnailsBucket: {
        Type: 'AWS::S3::Bucket',
        Properties: {
          BucketName: '${self:provider.environment.THUMBNAILS_S3_BUCKET}',
          CorsConfiguration:{
            CorsRules: [
              {
                  AllowedOrigins: ['*'],
                  AllowedHeaders: ['*'],
                  AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
                  MaxAge: 3000,
              },
            ],
          }
        }
      },
      ThumbnailsBucketPolicy: {
        Type: 'AWS::S3::BucketPolicy',
        Properties: {
          PolicyDocument:{
            Id: 'ThumbnailsPolicy',
            Version: '2012-10-17',
            Statement: [
              {
                Sid: 'PublicReadForGetBucketObjects',
                Effect: 'Allow',
                Principal: '*',
                Action: 's3:GetObject',
                Resource: 'arn:aws:s3:::${self:provider.environment.THUMBNAILS_S3_BUCKET}/*'
              }
            ]
          },
          Bucket: '${self:provider.environment.THUMBNAILS_S3_BUCKET}'
        }
      },
    }
  }
};

module.exports = serverlessConfiguration;
