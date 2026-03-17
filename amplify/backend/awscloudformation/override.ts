import { AmplifyRootStackTemplate } from '@aws-amplify/cli-extensibility-helper';
// import { Fn } from 'aws-cdk-lib';

export function override(resources: AmplifyRootStackTemplate) {
  // Removed: jaznu-cognito-uni-auth-uni-env policy attachment (policy doesn't exist)
  // const policyArn = Fn.sub('arn:aws:iam::${AWS::AccountId}:policy/jaznu-cognito-uni-auth-uni-env');
  // resources.authRole.managedPolicyArns = [policyArn];
  // resources.unauthRole.managedPolicyArns = [policyArn];
}
