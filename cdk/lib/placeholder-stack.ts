import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

interface PlaceholderStackProps extends cdk.StackProps {
}

// Used to resolve deploy dependency issues
export class PlaceholderStack extends cdk.Stack {

  constructor(scope: Construct, id: string, props: PlaceholderStackProps) {
    super(scope, id, props);
  }
}
