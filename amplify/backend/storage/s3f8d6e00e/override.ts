import { AmplifyS3ResourceTemplate } from '@aws-amplify/cli-extensibility-helper';

export function override(resources: AmplifyS3ResourceTemplate, amplifyProjectInfo: { envName: string, appId: string }) {

    const env = amplifyProjectInfo.envName;
    const amplifyAppId = amplifyProjectInfo.appId;

    if (!resources.s3Bucket) {
        throw new Error('s3Bucket is not defined');
    }

    // ============================================================
    // Helper for building resource ARNs
    // ============================================================
    const bucketArn = { "Fn::GetAtt": ["S3Bucket", "Arn"] };

    // Function to build an ARN with a path
    const makeResourceArn = (path: string) => ({
        "Fn::Join": ["", [bucketArn, path]]
    });

    // Role ARNs (built from authRoleName/unauthRoleName parameters)
    // Amplify-managed roles: "amplify-{app}-{env}-{hash}-authRole" — path "/"
    // Imported service roles: "CognitoAuthRole" etc.       — path "/service-role/"
    //
    // Detection via CloudFormation Condition (evaluated at deploy time):
    //   Condition 1: element[0] after split by "-" == "amplify"  (prefix check)
    //   Condition 2: element[4] after split by "-" != ""         (≥5 components check)
    //
    // Fn::Select returns "" for out-of-bounds on Fn::Split — safe to use as length probe.
    //
    // Examples:
    //   "amplify-testawstest-devu-d0772-authRole" → [0]="amplify" ✓, [4]="authRole" ✓ → managed
    //   "CognitoAuthRole"                         → [0]="CognitoAuthRole" ✗            → service-role
    //   "amplify"                                 → [0]="amplify" ✓, [4]="" ✗          → service-role
    //   "amplify-foo-bar"                         → [0]="amplify" ✓, [4]="" ✗          → service-role

    const splitAuthRole = { "Fn::Split": ["-", { "Ref": "authRoleName" }] };
    const splitUnauthRole = { "Fn::Split": ["-", { "Ref": "unauthRoleName" }] };

    resources.addCfnCondition(
        {
            expression: {
                "Fn::And": [
                    // Condition 1: prefix "amplify"
                    {
                        "Fn::Equals": [
                            { "Fn::Select": [0, splitAuthRole] },
                            "amplify"
                        ]
                    },
                    // Condition 2: at least 5 components (element[4] is not empty)
                    {
                        "Fn::Not": [{
                            "Fn::Equals": [
                                { "Fn::Select": [4, splitAuthRole] },
                                ""
                            ]
                        }]
                    }
                ]
            } as any
        },
        "IsAmplifyManagedRole"
    );

    const authRoleArn = {
        "Fn::If": [
            "IsAmplifyManagedRole",
            { "Fn::Sub": "arn:aws:iam::${AWS::AccountId}:role/${authRoleName}" },
            { "Fn::Sub": "arn:aws:iam::${AWS::AccountId}:role/service-role/${authRoleName}" }
        ]
    };
    const unauthRoleArn = {
        "Fn::If": [
            "IsAmplifyManagedRole",
            { "Fn::Sub": "arn:aws:iam::${AWS::AccountId}:role/${unauthRoleName}" },
            { "Fn::Sub": "arn:aws:iam::${AWS::AccountId}:role/service-role/${unauthRoleName}" }
        ]
    };

    // ============================================================
    // Bucket access policy (Bucket Policy)
    // ============================================================

    const bucketPolicy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "PublicRead",
                "Effect": "Allow",
                "Principal": "*",
                "Action": "s3:GetObject",
                "Resource": makeResourceArn("/public/*")
            },
            {
                "Sid": "ProtectedRead",
                "Effect": "Allow",
                "Principal": "*",
                "Action": "s3:GetObject",
                "Resource": makeResourceArn("/protected/*")
            },
            {
                "Sid": "FullAccessForAuthRole",
                "Effect": "Allow",
                "Principal": {
                    "AWS": authRoleArn
                },
                "Action": [
                    "s3:PutObject",
                    "s3:GetObject",
                    "s3:DeleteObject"
                ],
                "Resource": makeResourceArn("/*")
            },
            {
                "Sid": "ListBucketForAuthRole",
                "Effect": "Allow",
                "Principal": {
                    "AWS": authRoleArn
                },
                "Action": "s3:ListBucket",
                "Resource": bucketArn
            }
        ]
    };

    resources.addCfnResource(
        {
            type: 'AWS::S3::BucketPolicy',
            properties: {
                Bucket: { 'Ref': 'S3Bucket' },
                PolicyDocument: bucketPolicy
            }
        },
        'CustomS3BucketPolicy'
    );

    // ============================================================
    // CORS configuration
    // ============================================================
    const corsConfiguration = {
        CorsRules: [
            {
                "Id": "S3CORSRuleId1",
                "AllowedHeaders": ["*"],
                "AllowedMethods": ["GET", "HEAD", "PUT", "POST", "DELETE"],
                "AllowedOrigins": [
                    `https://${env}.${amplifyAppId}.amplifyapp.com`,
                    "http://localhost:5173"
                ],
                "ExposedHeaders": [
                    "x-amz-server-side-encryption",
                    "x-amz-request-id",
                    "x-amz-id-2",
                    "ETag"
                ],
                "MaxAge": 3000
            }
        ]
    };

    resources.s3Bucket.addPropertyOverride('CorsConfiguration', corsConfiguration);

    // ============================================================
    // Disable Block Public Access to allow public reads
    // ============================================================
    resources.s3Bucket.addPropertyOverride('PublicAccessBlockConfiguration', {
        BlockPublicAcls: true,
        IgnorePublicAcls: true,
        BlockPublicPolicy: false,  // Allow public bucket policies
        RestrictPublicBuckets: false  // Allow public access
    });

    // ============================================================
    // IAM Policies (dynamic Resource ARNs)
    // ============================================================

    const publicPolicy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "PublicFull",
                "Effect": "Allow",
                "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
                "Resource": makeResourceArn("/public/*")
            }
        ]
    };

    const privatePolicy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "PrivateFull",
                "Effect": "Allow",
                "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
                "Resource": makeResourceArn("/private/${cognito-identity.amazonaws.com:sub}/*")
            }
        ]
    };

    const protectedPolicy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "ProtectedFull",
                "Effect": "Allow",
                "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
                "Resource": makeResourceArn("/protected/${cognito-identity.amazonaws.com:sub}/*")
            }
        ]
    };

    const readPolicy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "ReadProtected",
                "Effect": "Allow",
                "Action": "s3:GetObject",
                "Resource": makeResourceArn("/protected/*")
            }
        ]
    };

    const listBucketPolicy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "AllListBucket",
                "Effect": "Allow",
                "Action": "s3:ListBucket",
                "Resource": bucketArn,
                "Condition": {
                    "StringLike": {
                        "s3:prefix": [
                            "public/",
                            "public/*",
                            "protected/",
                            "protected/*",
                            "private/${cognito-identity.amazonaws.com:sub}/",
                            "private/${cognito-identity.amazonaws.com:sub}/*"
                        ]
                    }
                }
            }
        ]
    };

    // ============================================================
    // Policies for unauthenticated users (UnauthRole / Guest)
    // ============================================================

    const guestPublicPolicy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "PublicRead",
                "Effect": "Allow",
                "Action": "s3:GetObject",
                "Resource": makeResourceArn("/public/*")
            }
        ]
    };

    const guestProtectedReadPolicy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "ProtectedRead",
                "Effect": "Allow",
                "Action": "s3:GetObject",
                "Resource": makeResourceArn("/protected/*")
            }
        ]
    };

    const guestListBucketPolicy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "ListBucket",
                "Effect": "Allow",
                "Action": "s3:ListBucket",
                "Resource": bucketArn,
                "Condition": {
                    "StringLike": {
                        "s3:prefix": [
                            "public/",
                            "public/*",
                            "protected/",
                            "protected/*"
                        ]
                    }
                }
            }
        ]
    };

    // ============================================================
    // Apply policies for authenticated users (AuthRole)
    // ============================================================
    if (resources.s3AuthPublicPolicy) {
        resources.s3AuthPublicPolicy.policyDocument = publicPolicy;
    }
    if (resources.s3AuthPrivatePolicy) {
        resources.s3AuthPrivatePolicy.policyDocument = privatePolicy;
    }
    if (resources.s3AuthProtectedPolicy) {
        resources.s3AuthProtectedPolicy.policyDocument = protectedPolicy;
    }
    if (resources.s3AuthReadPolicy) {
        resources.s3AuthReadPolicy.policyDocument = readPolicy;
    }
    if (resources.s3AuthUploadPolicy) {
        resources.s3AuthUploadPolicy.policyDocument = listBucketPolicy;
    }

    // ============================================================
    // Apply policies for unauthenticated users (UnauthRole)
    // ============================================================
    if (resources.s3GuestPublicPolicy) {
        resources.s3GuestPublicPolicy.policyDocument = guestPublicPolicy;
    }
    if (resources.s3GuestReadPolicy) {
        resources.s3GuestReadPolicy.policyDocument = guestProtectedReadPolicy;
    }
    if (resources.s3GuestUploadPolicy) {
        resources.s3GuestUploadPolicy.policyDocument = guestListBucketPolicy;
    }
}
