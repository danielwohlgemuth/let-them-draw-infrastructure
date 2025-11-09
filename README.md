# Let Them Draw App Overview and Infrastructure

Let Them Draw is a fictional app that lets clients specify a desired picture which then gets produced by artists.

Some pictures are easy to produce and are free. Other pictures are more complex and require payment through a Stripe integration.

![request detail done](/assets/request-detail-done.png)

See [this YouTube video](https://youtu.be/gJP6-isvmPY) for an overview of how it works.

Related Repositories:

- [let-them-draw-website](https://github.com/danielwohlgemuth/let-them-draw-website)
- [let-them-draw-receptionist](https://github.com/danielwohlgemuth/let-them-draw-receptionist)
- [let-them-draw-artist](https://github.com/danielwohlgemuth/let-them-draw-artist)

## Architecture

![let-them-draw architecture](/assets/let-them-draw.drawio.png)

[Let Them Draw Architecture diagram file](https://app.diagrams.net/?title=let-them-draw#Uhttps%3A%2F%2Fraw.githubusercontent.com%2Fdanielwohlgemuth%2Flet-them-draw-infrastructure%2Frefs%2Fheads%2Fmain%2Fassets%2Flet-them-draw.drawio)

The system behind the Let Them Draw app has 5 main components: the website, the receptionist, the artist, the databases, and the authentication stack.

### Website ([repository](https://github.com/danielwohlgemuth/let-them-draw-website))

The website lets the clients see their orders and request a new picture.

It's built as a static website stored in an S3 bucket and distributed through CloudFront.

### Authentication

The clients sign-in using Cognito.

### Receptionist ([repository](https://github.com/danielwohlgemuth/let-them-draw-receptionist))

The receptionist handles providing a list of existing orders and accepts new requests.

This is accomplished with an API Gateway that forwards requests to a Lambda function which retrieves orders from a database and places new requests into a SQS queue. For requests that require payment, Stripe Checkout is used to handle the payment.

### Artist ([repository](https://github.com/danielwohlgemuth/let-them-draw-artist))

The artists take new requests and produce a picture for the client.

A Lambda function takes care of producing the pictures using the SQS queue to retrieve new requests, keeping the related information in the database up-to-date, storing the finished picture in an S3 bucket, and triggers an EventBridge event that in turn uses SNS to notify the client that the picture is ready.

### Databases

The art database stores information about orders, for example the requirements and the status.

The shape database stores information about the available shapes and their price.

DynamoDB is used for this.

#### Art Database Schema

- requestId (primary key)
- userId (secondary key)
- requestDate (date)
- requirements (object (shape, color))
- status (string (new, paid, in progress, done, failed))
- pictureUrl (string)
- checkoutSessionId (string)

Users are limited to only seeing their own pictures by filtering on User Id in addition to the Request Id.

#### Shape Database Schema

- shape (primary key)
- priceId (string)
- price (string)

## Let Them Draw CI/CD Pipeline

![let-them-draw CI/CD Pipeline](/assets/let-them-draw-cicd-pipeline.drawio.png)

[Let Them Draw CI/CD Pipeline diagram file](https://app.diagrams.net/?title=let-them-draw-cicd-pipeline#Uhttps%3A%2F%2Fraw.githubusercontent.com%2Fdanielwohlgemuth%2Flet-them-draw-infrastructure%2Frefs%2Fheads%2Fmain%2Fassets%2Flet-them-draw-cicd-pipeline.drawio)

The code that sets up and maintains the infrastructure of the app is configured through 4 pipelines: the main pipeline that sets up the whole AWS infrastructure, two additional pipelines that handle updates to the receptionist and artist components, and one that handles updates to the website. This separation allows independent updates to the infrastructure as needed.

## Let Them Draw Monitoring

![let-them-draw monitoring](/assets/let-them-draw-monitoring.drawio.png)

[Let Them Draw Monitoring diagram file](https://app.diagrams.net/?title=let-them-draw-monitoring#Uhttps%3A%2F%2Fraw.githubusercontent.com%2Fdanielwohlgemuth%2Flet-them-draw-infrastructure%2Frefs%2Fheads%2Fmain%2Fassets%2Flet-them-draw-monitoring.drawio)

A monitoring stack is used to notify about failed pipeline runs or if the artist failed to produce a picture.


## Lessons Learned

- If a queue triggers a lambda function, it's best to attach a dead letter queue to the queue so that the lambda function doesn't keep failing repeatedly and consume resources without producing a result.
- A dead letter queue can be attached to an SNS topic to notify about failed deliveries.
- The keyword "status" is a reserved word in DynamoDB, so it can't be used directly when updating an item. The workaround is to use expression attribute names to map the reserved word to a different name, for example "#status".
See also [Reserved words in DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ReservedWords.html).
- Parameter store are helpful to decouple stacks and break cyclic dependencies.


## Pricing

Based on the AWS Cost Calculator and using a low estimate for everyting, the monthly cost is about 13.51 USD.

[AWS Cost Calculator](https://calculator.aws/#/estimate?id=4f165607be5f02ffe120e0ace144651fc3f117b5)

[Cost Estimate JSON](/assets/let-them-draw-cost-estimate.json)


## Screenshots

### Artwork Request Flow

![requests](/assets/requests.png)

![request paid](/assets/request-paid.png)

![stripe checkout](/assets/stripe-checkout.png)

![art ready email](/assets/art-ready-email.png)

![request detail done](/assets/request-detail-done.png)

### Architecture Evolution

The architecture of the app went through a few iterations to add additional features. Here is an animation of how it evolved.

![let them draw architecture evolution](/assets/let-them-draw-evolution.gif)

### Artist Test Code Coverage

The code of the artist function has tests to verify the funcionality. The code coverage of each succesful build is visualized in a CodeBuild report.

![artist test code coverage](/assets/test-coverage.png)

### Dead Letter Queue Alert

Sent when the artist lambda function fails to produce an image while processing a request.

![dead letter queue alert](/assets/dead-letter-queue-alert.png)

### Pipeline Failure Alert

When any of the build pipelines fail, an alert is sent.

![pipeline failure alert](/assets/pipeline-failure-alert.png)


## Setup

### Prerequisites

- AWS CLI
- CDK CLI

### Steps


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

Setup the stripe-webhook-secret parameter

1. Go to https://docs.stripe.com/
2. In the bottom left, click on "Developers", then "Webhooks"
3. Click on "Add endpoint"
4. In the events filter, type "checkout"
5. Select "checkout.session.completed", "checkout.session.expired", "checkout.session.async_payment_succeeded", and "checkout.session.async_payment_failed"
6. Click "Continue"
7. In the Endpoint URL field, enter the URL of the CloudFront URL and append "/api/stripe-webhook" to it
8. Under the Signing secret section, click "Reveal secret"
9. Copy the secret
10. Navigate to Parameter Store in the AWS Console
11. Click on "Create parameter"
12. Set Name to "/let-them-draw/stripe-webhook-secret"
13. Set Value to the copied secret
14. Click on "Create parameter"

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


Initialize CDK

```bash
cdk bootstrap
```

Deploy all stacks

```bash
cdk deploy --all
```
