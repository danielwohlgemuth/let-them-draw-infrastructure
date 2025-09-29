# Let Them Draw App Overview and Infrastructure

Let Them Draw is an app that lets clients specify a desired picture which gets produced by artists.

## Architecture

![let-them-draw architecture](/assets/let-them-draw.drawio.png)

[Let Them Draw Architecture diagram file](https://app.diagrams.net/?title=let-them-draw#Uhttps%3A%2F%2Fraw.githubusercontent.com%2Fdanielwohlgemuth%2Flet-them-draw-infrastructure%2Frefs%2Fheads%2Fmain%2Fassets%2Flet-them-draw.drawio)

The system behind the Let Them Draw app has 4 main components: the website, the receptionist, the artist, and the database.

### Website

The website lets the clients sign-in, see their orders, and request a new picture.

It's built as a static website stored in an S3 bucket and distributed through CloudFront, using Cognito for authentication.

### Receptionist

The receptionist handles providing a list of existing orders and accepts new requests.

This is accomplished with an API Gateway that forwards requests to a Lambda function which retrieves orders from a database and places new requests into a SQS queue.

### Artist

The artists take new requests and produce a picture for the client.

A Lambda function takes care of producing the pictures using the SQS queue to retrieve new requests, keeping the related information in the database up-to-date, storing the finished picture in an S3 bucket, and triggers an EventBridge event that in turn uses SNS to notify the client that the picture is ready.

### Databases

The art database stores information about orders, for example the requirements and the status.

The shape database stores information about the available shapes and their price.

DynamoDB is used for this.

### Art Database Schema

- Request Id (primary key)
- User Id (secondary key)
- Request Date (date)
- Requirements (object (shape, color))
- Status (string (new, in progress, done))
- Picture URL (string)

Users are limited to only seeing their own pictures by filtering on User Id in addition to the Request Id.

### Shape Database Schema

- Shape (primary key)
- Price Id (string)
- Price (string)

## Let Them Draw CI/CD Pipeline

![let-them-draw CI/CD Pipeline](/assets/let-them-draw-cicd-pipeline.drawio.png)

[Let Them Draw CI/CD Pipeline diagram file](https://app.diagrams.net/?title=let-them-draw-cicd-pipeline#Uhttps%3A%2F%2Fraw.githubusercontent.com%2Fdanielwohlgemuth%2Flet-them-draw-infrastructure%2Frefs%2Fheads%2Fmain%2Fassets%2Flet-them-draw-cicd-pipeline.drawio)

The code that sets up and maintains the infrastructure of the app is configured through 4 pipelines: the main pipeline that sets up the whole AWS infrastructure, two additional pipelines that handle updates to the receptionist and artist components, and one that handles updates to the website. This separation allows independent updates to the infrastructure and its functionality as needed.

## Let Them Draw Monitoring

![let-them-draw monitoring](/assets/let-them-draw-monitoring.drawio.png)

[Let Them Draw Monitoring diagram file](https://app.diagrams.net/?title=let-them-draw-monitoring#Uhttps%3A%2F%2Fraw.githubusercontent.com%2Fdanielwohlgemuth%2Flet-them-draw-infrastructure%2Frefs%2Fheads%2Fmain%2Fassets%2Flet-them-draw-monitoring.drawio)

A monitoring stack is used to notify about failed pipeline runs or if the artist failed to produce a picture.

## Setup

### Prerequisites

- AWS CLI
- CDK CLI

Initialize CDK

```bash
cdk bootstrap
```


Setup the GitHub connection:

1. Go to the AWS Console
2. Navigate to CodeBuild
3. Go to Settings and then Connections
4. Click on "Create connection"
5. Select "GitHub" as the provider
6. Set the connection name to "let-them-draw"
7. Click "Connect to GitHub"
8. Click "Install a new app"
9. On GitHub, select the repository and click "Install & Authorize"
10. On AWS, click "Connect"
11. Copy the connection ARN
12. Navigate to Parameter Store
13. Click on "Create parameter"
14. Set Name to "/let-them-draw/github-connection-arn"
15. Paste the copied connection ARN from step 11 into the Value field
16. Click on "Create parameter"

Setup the Environment parameter

1. Navigate to Parameter Store
2. Click on "Create parameter"
3. Set Name to "/let-them-draw/environment"
4. Set Value to either "dev" or "prod"
5. Click on "Create parameter"

Setup the infrastructure-branch parameter

1. Navigate to Parameter Store
2. Click on "Create parameter"
3. Set Name to "/let-them-draw/infrastructure-branch"
4. Set Value to either "dev" or "main"
5. Click on "Create parameter"

Setup the from-email parameter

1. Navigate to Parameter Store
2. Click on "Create parameter"
3. Set Name to "/let-them-draw/from-email"
4. Set Value to an email address that can be verified and will be used as the source address for outgoing emails
5. Click on "Create parameter"

Setup the stripe-api-key parameter

1. Navigate to Parameter Store
2. Click on "Create parameter"
3. Set Name to "/let-them-draw/stripe-api-key"
4. Set Value to a Stripe API key
5. Click on "Create parameter"

Setup the website-url parameter

1. Navigate to Parameter Store
2. Click on "Create parameter"
3. Set Name to "/let-them-draw/website-url"
4. Set Value to the "http://localhost:3000" and update it to the CloudFront URL when the website is deployed
5. Click on "Create parameter"


Note that when SES is in sandbox mode, every email address needs to be verified.
To verify an email address:

1. Navigate to Amazon Simple Email Service
2. Switch to Identities
3. Click on "Create identity"
4. Set Identity type to Email address
5. Enter the email address
6. Click on "Create identity"
7. Click on the verification link in the email that was sent

```bash
cdk deploy --all
```