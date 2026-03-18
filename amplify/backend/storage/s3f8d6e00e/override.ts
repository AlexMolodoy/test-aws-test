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
    // For imported Cognito roles (e.g. devu), the role lives under /service-role/ path.
    // Fn::Sub cannot embed a path, so we include it explicitly for those envs.
    const cognitoServiceRoleEnvs = ['devu'];
    const rolePath = cognitoServiceRoleEnvs.includes(env) ? 'service-role/' : '';
    const authRoleArn = {
        "Fn::Sub": `arn:aws:iam::$\{AWS::AccountId}:role/${rolePath}$\{authRoleName}`
    };
    const unauthRoleArn = {
        "Fn::Sub": `arn:aws:iam::$\{AWS::AccountId}:role/${rolePath}$\{unauthRoleName}`
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
