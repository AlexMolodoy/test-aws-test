import { AmplifyAuthCognitoStackTemplate } from '@aws-amplify/cli-extensibility-helper';

export function override(
    resources: AmplifyAuthCognitoStackTemplate,
    amplifyProjectInfo: { envName: string }
): void {
    if (!resources.userPool || !resources.identityPool) {
        throw new Error('userPool or identityPool is not defined');
    }

    const env = amplifyProjectInfo.envName;

    // Use Fn::Sub to dynamically build the ARN
    const lambdaFunctionArn = {
        'Fn::Sub': `arn:aws:lambda:\${AWS::Region}:\${AWS::AccountId}:function:jaznuCognitoSignupTriggerLambda-${env}`
    };

    // Main Lambda trigger configuration
    resources.userPool.addPropertyOverride('LambdaConfig.PostConfirmation', lambdaFunctionArn);

    // Lambda invoke permission
    resources.addCfnResource(
        {
            type: 'AWS::Lambda::Permission',
            properties: {
                FunctionName: lambdaFunctionArn,
                Action: 'lambda:InvokeFunction',
                Principal: 'cognito-idp.amazonaws.com',
                SourceArn: {
                    'Fn::GetAtt': ['UserPool', 'Arn']
                }
            }
        },
        'PostConfirmationLambdaInvokePermission'
    );
}
