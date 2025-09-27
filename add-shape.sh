#!/bin/bash

if [ -f .env ]; then
  export $(cat .env | xargs)
fi

if [ -z "$STRIPE_API_KEY" ]; then
  echo "Please set STRIPE_API_KEY environment variable"
  exit 1
fi

PROFILE=${1:-default}
export AWS_PROFILE=$PROFILE

DYNAMODB_TABLE=$(aws cloudformation describe-stacks \
  --stack-name DataStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ShapesTableName`].OutputValue' \
  --output text \
  --profile ${PROFILE})

if [ -z "$DYNAMODB_TABLE" ]; then
  echo "DataStack not found"
  exit 1
fi

read -p "Enter product name: " name
read -p "Enter product price (in cents): " price
read -p "Enter product order: " order

stripe_response=$(curl https://api.stripe.com/v1/prices \
  -H "Authorization: Bearer ${STRIPE_API_KEY}" \
  -s \
  -d currency=usd \
  -d unit_amount=${price} \
  -d "product_data[name]"="${name}")

if [ $? -ne 0 ]; then
  echo "Failed to add shape to Stripe"
  exit 1
fi

price_id=$(echo $stripe_response | jq -r '.id')

aws dynamodb put-item \
  --table-name ${DYNAMODB_TABLE} \
  --item "{\"shapeName\": {\"S\": \"${name}\"}, \"price\": {\"S\": \"${price}\"}, \"priceId\": {\"S\": \"${price_id}\"}, \"order\": {\"N\": \"${order}\"}}" \
  --profile ${PROFILE}

if [ $? -ne 0 ]; then
  echo "Failed to add shape to DynamoDB"
  exit 1
fi

echo "Shape added successfully"