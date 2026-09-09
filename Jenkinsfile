pipeline {
    agent { label 'docker' }

    options {
        skipDefaultCheckout(true)
        disableConcurrentBuilds(abortPrevious: true)
        buildDiscarder(logRotator(numToKeepStr: '20'))
        timeout(time: 30, unit: 'MINUTES')
    }

    environment {
        CI = 'true'
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
                    test -f infra/jenkins/pipeline/frontend.Dockerfile
                    test -f infra/jenkins/pipeline/collector.Dockerfile
                    test -f infra/jenkins/pipeline/backend.Dockerfile
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

                stage('Frontend lint and build') {
                    steps {
                        sh '''
                            docker build \
                              --file infra/jenkins/pipeline/frontend.Dockerfile \
                              --tag "tashu/ci-frontend:${CI_IMAGE_TAG}" \
                              frontend
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
    }

    post {
        always {
            sh '''
                if [ -n "${CI_IMAGE_TAG:-}" ]; then
                    docker image rm --force \
                      "tashu/ci-collector:${CI_IMAGE_TAG}" \
                      "tashu/ci-frontend:${CI_IMAGE_TAG}" \
                      "tashu/ci-backend:${CI_IMAGE_TAG}" \
                      >/dev/null 2>&1 || true
                fi
            '''
            cleanWs(deleteDirs: true, notFailBuild: true)
        }
    }
}