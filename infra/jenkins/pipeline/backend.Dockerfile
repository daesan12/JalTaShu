FROM eclipse-temurin:21.0.12_8-jdk-noble

WORKDIR /workspace

COPY gradlew settings.gradle build.gradle ./
COPY gradle ./gradle
RUN test -f gradle/wrapper/gradle-wrapper.properties \
    && sed -i 's/\r$//' gradlew \
    && chmod 0755 gradlew

COPY src ./src
RUN ./gradlew test --no-daemon