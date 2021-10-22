import 'source-map-support/register';

import { middyfy } from '@libs/lambda';
import * as AWS from 'aws-sdk';
import * as uuid from 'uuid';

const docClient = new AWS.DynamoDB.DocumentClient()

const groupsTable = process.env.GROUPS_TABLE
const imagesTable = process.env.IMAGES_TABLE

const createImage = async (event) => {
    console.log('caller event ', event)
    const groupId = event.pathParameters.groupId
    const validGroupId = await groupExists(groupId)

    if(!validGroupId) {
        return {
            statusCode : 404,
            headers: {
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                error: 'Group does not exist'
            })    
        }
    }

    
    // TODO create an image
    const imageId = uuid.v4()
    const newItem = await Imagecreate(groupId, imageId, event)

    return {
        statusCode: 201,
        headers: {
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ 
            newItem: newItem
         })
    }

}

async function groupExists(groupId: string){
    const result = await docClient.get({
      TableName: groupsTable,
      Key: {
        id: groupId
      }
    }).promise()
  
    return !!result.Item
}

async function Imagecreate(groupId: string, imageId: string, event: any) {
    const timestamp = new Date().toISOString()
    const newImage = JSON.parse(event.body)

    const newItem = {
        groupId,
        timestamp,
        imageId,
        ...newImage,
    }
    console.log('storing new item :', newItem)

    await docClient.put({
        TableName: imagesTable,
        Item: newItem,
    })
    return newItem

}

export const main = middyfy(createImage);