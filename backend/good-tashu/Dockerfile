FROM eclipse-temurin:21.0.12_8-jdk-noble AS builder

WORKDIR /workspace

COPY gradlew settings.gradle build.gradle ./
COPY gradle ./gradle
RUN sed -i 's/\r$//' gradlew \
    && chmod 0755 gradlew

COPY src ./src
RUN ./gradlew bootJar --no-daemon

FROM eclipse-temurin:21.0.12_8-jre-noble

RUN groupadd --system --gid 10001 tashu \
    && useradd --system --uid 10001 --gid tashu --home-dir /app --shell /usr/sbin/nologin tashu

WORKDIR /app

COPY --from=builder --chown=tashu:tashu /workspace/build/libs/*.jar /app/app.jar

USER tashu
EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
