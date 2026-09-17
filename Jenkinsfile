pipeline {
    agent { label 'docker' }

    options {
        skipDefaultCheckout(true)
        disableConcurrentBuilds(abortPrevious: true)
        buildDiscarder(logRotator(numToKeepStr: '20'))
        timeout(time: 30, unit: 'MINUTES')
    }

    parameters {
        booleanParam(
            name: 'DEPLOY_AI_SERVING',
            defaultValue: false,
            description: 'AI·Backend Redis 계약과 Server B 배포 준비가 끝난 뒤에만 활성화'
        )
    }

    environment {
        CI = 'true'
        AWS_DEFAULT_REGION = 'ap-northeast-2'
        AWS_EC2_METADATA_DISABLED = 'true'
        AWS_PAGER = ''
    }

    stages {
        stage('Checkout') {
            steps {
                deleteDir()
                checkout scm
                script {
                    env.GIT_SHORT_SHA = sh(
                        script: 'git rev-parse --short=12 HEAD',
                        returnStdout: true
                    ).trim()
                    env.CI_IMAGE_TAG = "${env.GIT_SHORT_SHA}-${env.BUILD_NUMBER}"
                }
            }
        }

        stage('Repository contract') {
            steps {
                sh '''
                    set -eu
                    test -f frontend/package-lock.json
                    test -f data-pipeline/collector/requirements.txt
                    test -f backend/good-tashu/build.gradle
                    test -f backend/good-tashu/Dockerfile
                    test -f infra/jenkins/pipeline/frontend.Dockerfile
                    test -f infra/jenkins/pipeline/collector.Dockerfile
                    test -f infra/jenkins/pipeline/backend.Dockerfile
                    test -f infra/jenkins/pipeline/ai-serving.Dockerfile
                    test -f tashu-ai/src/serve.py
                    test -f tashu-ai/requirements.txt
                    test -f infra/runtime/ai-serving/compose.yml
                    test -f infra/runtime/ai-serving/scripts/jenkins-deploy-staging.sh
                    test -f infra/runtime/frontend/compose.staging.yml
                    test -f infra/runtime/frontend/scripts/deploy-staging.sh
                    test -f infra/runtime/frontend/scripts/jenkins-deploy-staging.sh
                '''
            }
        }

        stage('Service CI') {
            options {
                lock(resource: 'server-b-heavy')
            }
            stages {
                stage('Collector tests') {
                    steps {
                        sh '''
                            docker build \
                              --file infra/jenkins/pipeline/collector.Dockerfile \
                              --tag "tashu/ci-collector:${CI_IMAGE_TAG}" \
                              data-pipeline/collector
                        '''
                    }
                }

                stage('Frontend test, lint and build') {
                    steps {
                        sh '''
                            docker build \
                              --file infra/jenkins/pipeline/frontend.Dockerfile \
                              --tag "tashu/ci-frontend:${CI_IMAGE_TAG}" \
                              frontend
                        '''
                    }
                }

                stage('AI serving tests and image') {
                    steps {
                        sh '''
                            docker build \
                              --file infra/jenkins/pipeline/ai-serving.Dockerfile \
                              --tag "tashu/ci-ai-serving:${CI_IMAGE_TAG}" \
                              tashu-ai
                        '''
                    }
                }

                stage('Backend test') {
                    steps {
                        script {
                            if (fileExists('backend/good-tashu/gradle/wrapper/gradle-wrapper.properties')) {
                                sh '''
                                    docker build \
                                      --file infra/jenkins/pipeline/backend.Dockerfile \
                                      --tag "tashu/ci-backend:${CI_IMAGE_TAG}" \
                                      backend/good-tashu
                                '''
                            } else {
                                echo 'DEFERRED: backend/good-tashu/gradle/wrapper/gradle-wrapper.properties가 없어 Backend Gradle Wrapper 검증을 실행하지 않습니다.'
                                echo 'Backend 팀이 Wrapper 설정을 추가하면 같은 Pipeline에서 자동으로 Backend test를 실행합니다.'
                            }
                        }
                    }
                }
            }
        }

        stage('Build and push staging images') {
            when {
                branch 'develop'
            }
            options {
                lock(resource: 'server-b-heavy')
            }
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'aws-ecr-push',
                        usernameVariable: 'AWS_ACCESS_KEY_ID',
                        passwordVariable: 'AWS_SECRET_ACCESS_KEY'
                    ),
                    string(
                        credentialsId: 'naver-map-client-id',
                        variable: 'FRONTEND_MAP_CLIENT_ID'
                    )
                ]) {
                    sh '''
                        set -eu
                        set +x

                        account_id="$(aws sts get-caller-identity --query Account --output text)"
                        registry="${account_id}.dkr.ecr.${AWS_DEFAULT_REGION}.amazonaws.com"
                        frontend_local="tashu/runtime-frontend:${GIT_SHORT_SHA}"
                        backend_local="tashu/runtime-backend:${GIT_SHORT_SHA}"
                        ai_local="tashu/ci-ai-serving:${CI_IMAGE_TAG}"
                        frontend_remote="${registry}/tashu/frontend:${GIT_SHORT_SHA}"
                        backend_remote="${registry}/tashu/backend:${GIT_SHORT_SHA}"
                        ai_remote="${registry}/tashu/ai:${GIT_SHORT_SHA}"

                        cleanup_ecr_session() {
                            docker logout "${registry}" >/dev/null 2>&1 || true
                            docker image rm --force \
                              "${frontend_remote}" \
                              "${backend_remote}" \
                              "${ai_remote}" \
                              >/dev/null 2>&1 || true
                        }
                        trap cleanup_ecr_session EXIT

                        aws ecr describe-repositories \
                          --repository-names tashu/frontend tashu/backend tashu/ai \
                          >/dev/null

                        docker build \
                          --file infra/runtime/frontend/Dockerfile \
                          --build-arg FRONTEND_API_PATH=/staging-api \
                          --build-arg FRONTEND_LOGIN_PATH=/staging-auth \
                          --build-arg FRONTEND_BASE_PATH=/staging/ \
                          --build-arg FRONTEND_ENABLE_MSW=false \
                          --build-arg FRONTEND_MAP_CLIENT_ID="${FRONTEND_MAP_CLIENT_ID}" \
                          --tag "${frontend_local}" \
                          .

                        docker build \
                          --file backend/good-tashu/Dockerfile \
                          --tag "${backend_local}" \
                          backend/good-tashu

                        docker tag "${frontend_local}" "${frontend_remote}"
                        docker tag "${backend_local}" "${backend_remote}"
                        docker tag "${ai_local}" "${ai_remote}"

                        aws ecr get-login-password \
                          | docker login \
                              --username AWS \
                              --password-stdin "${registry}"

                        if aws ecr describe-images \
                          --repository-name tashu/frontend \
                          --image-ids imageTag="${GIT_SHORT_SHA}" \
                          >/dev/null 2>&1; then
                            printf 'ECR image already exists: frontend tag=%s\n' "${GIT_SHORT_SHA}"
                        else
                            docker push "${frontend_remote}"
                        fi

                        if aws ecr describe-images \
                          --repository-name tashu/backend \
                          --image-ids imageTag="${GIT_SHORT_SHA}" \
                          >/dev/null 2>&1; then
                            printf 'ECR image already exists: backend tag=%s\n' "${GIT_SHORT_SHA}"
                        else
                            docker push "${backend_remote}"
                        fi

                        if aws ecr describe-images \
                          --repository-name tashu/ai \
                          --image-ids imageTag="${GIT_SHORT_SHA}" \
                          >/dev/null 2>&1; then
                            printf 'ECR image already exists: ai-serving tag=%s\n' "${GIT_SHORT_SHA}"
                        else
                            docker push "${ai_remote}"
                        fi

                        aws ecr describe-images \
                          --repository-name tashu/frontend \
                          --image-ids imageTag="${GIT_SHORT_SHA}" \
                          --query 'imageDetails[0].imageDigest' \
                          --output text \
                          >/dev/null
                        aws ecr describe-images \
                          --repository-name tashu/backend \
                          --image-ids imageTag="${GIT_SHORT_SHA}" \
                          --query 'imageDetails[0].imageDigest' \
                          --output text \
                          >/dev/null

                        aws ecr describe-images \
                          --repository-name tashu/ai \
                          --image-ids imageTag="${GIT_SHORT_SHA}" \
                          --query 'imageDetails[0].imageDigest' \
                          --output text \
                          >/dev/null

                        printf 'ECR push verified: frontend/backend/ai-serving tag=%s\n' "${GIT_SHORT_SHA}"
                    '''
                }
            }
        }

        stage('Deploy AI serving staging') {
            when {
                allOf {
                    branch 'develop'
                    expression { params.DEPLOY_AI_SERVING }
                }
            }
            options {
                lock(resource: 'server-b-ai-serving-deploy')
            }
            steps {
                withCredentials([
                    string(
                        credentialsId: 'server-b-deploy-host',
                        variable: 'SERVER_B_DEPLOY_HOST'
                    )
                ]) {
                    sshagent(credentials: ['server-b-ai-deploy']) {
                        sh '''
                            set -eu
                            set +x
                            ssh \
                              -o BatchMode=yes \
                              -o ConnectTimeout=10 \
                              -o StrictHostKeyChecking=yes \
                              -o UserKnownHostsFile=/etc/ssh/server-b-known-hosts \
                              "tashu-ai-deploy@${SERVER_B_DEPLOY_HOST}" \
                              "deploy-ai-serving ${GIT_SHORT_SHA}"
                        '''
                    }
                }
            }
        }

        stage('Deploy frontend staging') {
            when {
                branch 'develop'
            }
            options {
                lock(resource: 'server-a-staging-deploy')
            }
            steps {
                withCredentials([
                    string(
                        credentialsId: 'server-a-deploy-host',
                        variable: 'SERVER_A_DEPLOY_HOST'
                    )
                ]) {
                    sshagent(credentials: ['server-a-staging-deploy']) {
                        sh '''
                            set -eu
                            set +x
                            ssh \
                              -o BatchMode=yes \
                              -o ConnectTimeout=10 \
                              -o StrictHostKeyChecking=yes \
                              -o UserKnownHostsFile=/etc/ssh/ssh_known_hosts \
                              "tashu-deploy@${SERVER_A_DEPLOY_HOST}" \
                              "deploy-frontend ${GIT_SHORT_SHA}"
                        '''
                    }
                }
            }
        }

        stage('Deploy backend staging') {
            when {
                branch 'develop'
            }
            options {
                lock(resource: 'server-a-staging-deploy')
            }
            steps {
                withCredentials([
                    string(
                        credentialsId: 'server-a-deploy-host',
                        variable: 'SERVER_A_DEPLOY_HOST'
                    )
                ]) {
                    sshagent(credentials: ['server-a-staging-deploy']) {
                        sh '''
                            set -eu
                            set +x
                            ssh \
                              -o BatchMode=yes \
                              -o ConnectTimeout=10 \
                              -o StrictHostKeyChecking=yes \
                              -o UserKnownHostsFile=/etc/ssh/ssh_known_hosts \
                              "tashu-deploy@${SERVER_A_DEPLOY_HOST}" \
                              "deploy-backend ${GIT_SHORT_SHA}"
                        '''
                    }
                }
            }
        }
    }

    post {
        always {
            sh '''
                if [ -n "${CI_IMAGE_TAG:-}" ]; then
                    docker image rm --force \
                      "tashu/ci-collector:${CI_IMAGE_TAG}" \
                      "tashu/ci-frontend:${CI_IMAGE_TAG}" \
                      "tashu/ci-backend:${CI_IMAGE_TAG}" \
                      "tashu/ci-ai-serving:${CI_IMAGE_TAG}" \
                      >/dev/null 2>&1 || true
                fi
                if [ -n "${GIT_SHORT_SHA:-}" ]; then
                    docker image rm --force \
                      "tashu/runtime-frontend:${GIT_SHORT_SHA}" \
                      "tashu/runtime-backend:${GIT_SHORT_SHA}" \
                      >/dev/null 2>&1 || true
                fi
            '''
            cleanWs(deleteDirs: true, notFailBuild: true)
        }
    }
}
