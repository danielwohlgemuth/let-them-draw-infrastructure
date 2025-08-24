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

### Database

The database stores information about orders, for example the requirements and the status.

DynamoDB is used for this.

### Database Schema

- User Id (primary key)
- Picture Id (secondary key)
- Requirements (object (shape, color))
- Status (string (new, in progress, done))
- URL (string)

Users are limited to only seeing their own pictures.