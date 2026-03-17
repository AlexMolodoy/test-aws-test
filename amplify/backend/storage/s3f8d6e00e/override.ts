import { AmplifyS3ResourceTemplate } from '@aws-amplify/cli-extensibility-helper';

export function override(resources: AmplifyS3ResourceTemplate, amplifyProjectInfo: { envName: string }) {

    const env = amplifyProjectInfo.envName;

    if (!resources.s3Bucket) {
        throw new Error('s3Bucket is not defined');
    }

    // ============================================================
    // Хелпер для создания ARN ресурсов
    // ============================================================
    const bucketArn = { "Fn::GetAtt": ["S3Bucket", "Arn"] };

    // Функция для создания ARN с путём
    const makeResourceArn = (path: string) => ({
        "Fn::Join": ["", [bucketArn, path]]
    });

    // ARN ролей (собираем из параметров authRoleName/unauthRoleName)
    const authRoleArn = {
        "Fn::Sub": "arn:aws:iam::${AWS::AccountId}:role/${authRoleName}"
    };
    const unauthRoleArn = {
        "Fn::Sub": "arn:aws:iam::${AWS::AccountId}:role/${unauthRoleName}"
    };

    // ============================================================
    // Политика доступа к бакету (Bucket Policy)
    // ============================================================

    // const bucketPolicy = {
    //     "Version": "2012-10-17",
    //     "Statement": [
    //         {
    //             "Sid": "PublicRead",
    //             "Effect": "Allow",
    //             "Principal": "*",
    //             "Action": "s3:GetObject",
    //             "Resource": "arn:aws:s3:::jaznu-qa/public/*"
    //         },
    //         {
    //             "Sid": "ProtectedRead",
    //             "Effect": "Allow",
    //             "Principal": "*",
    //             "Action": "s3:GetObject",
    //             "Resource": "arn:aws:s3:::jaznu-qa/protected/*"
    //         },
    //         {
    //             "Sid": "FullAccessForAuthRole",
    //             "Effect": "Allow",
    //             "Principal": {
    //                 "AWS": "arn:aws:iam::675795832684:role/service-role/jaznu-qa-authRole"
    //             },
    //             "Action": [
    //                 "s3:PutObject",
    //                 "s3:GetObject",
    //                 "s3:DeleteObject"
    //             ],
    //             "Resource": "arn:aws:s3:::jaznu-qa/*"
    //         },
    //         {
    //             "Sid": "ListBucketForAuthRole",
    //             "Effect": "Allow",
    //             "Principal": {
    //                 "AWS": "arn:aws:iam::675795832684:role/service-role/jaznu-qa-authRole"
    //             },
    //             "Action": "s3:ListBucket",
    //             "Resource": "arn:aws:s3:::jaznu-qa"
    //         }
    //     ]
    // }

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
    // CORS конфигурация
    // ============================================================
    const corsConfiguration = {
        CorsRules: [
            {
                "Id": "S3CORSRuleId1",
                "AllowedHeaders": ["*"],
                "AllowedMethods": ["GET", "HEAD", "PUT", "POST", "DELETE"],
                "AllowedOrigins": [
                    `https://${env}.d1clyi8yzstog0.amplifyapp.com`,
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
    // Отключаем Block Public Access для публичного чтения
    // ============================================================
    resources.s3Bucket.addPropertyOverride('PublicAccessBlockConfiguration', {
        BlockPublicAcls: true,
        IgnorePublicAcls: true,
        BlockPublicPolicy: false,  // Разрешаем публичные политики
        RestrictPublicBuckets: false  // Разрешаем публичный доступ
    });

    // ============================================================
    // IAM Policies (динамические Resource)
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
    // Политики для неавторизованных пользователей (UnauthRole / Guest)
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
    // Применяем политики для авторизованных пользователей (AuthRole)
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
    // Применяем политики для неавторизованных пользователей (UnauthRole)
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
