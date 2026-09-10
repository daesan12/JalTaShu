FROM jenkins/ssh-agent:latest-jdk21@sha256:4609eba9f086fc7321de8e40e217601158280d5bd21160b9ed6e6e5218936c1c

USER root

ARG AWS_CLI_VERSION=2.36.10

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl git unzip \
    && install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc \
    && chmod a+r /etc/apt/keyrings/docker.asc \
    && . /etc/os-release \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian ${VERSION_CODENAME} stable" > /etc/apt/sources.list.d/docker.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends docker-ce-cli docker-buildx-plugin docker-compose-plugin \
    && curl -fsSLo /tmp/awscliv2.zip "https://awscli.amazonaws.com/awscli-exe-linux-x86_64-${AWS_CLI_VERSION}.zip" \
    && unzip -q /tmp/awscliv2.zip -d /tmp \
    && /tmp/aws/install --bin-dir /usr/local/bin --install-dir /usr/local/aws-cli \
    && aws --version \
    && rm -rf /tmp/aws /tmp/awscliv2.zip \
    && rm -rf /var/lib/apt/lists/*

COPY --chmod=0755 entrypoint.sh /usr/local/bin/tashu-agent-entrypoint

ENTRYPOINT ["/usr/local/bin/tashu-agent-entrypoint"]
