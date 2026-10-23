# syntax=docker/dockerfile:1

# --------------------------------------------------------------------------- build
# Maven + JDK 25 (matches <java.version>25</java.version> in pom.xml).
FROM maven:3.9-eclipse-temurin-25-alpine AS build
WORKDIR /build

COPY pom.xml ./
COPY src ./src

# The BuildKit cache mount keeps ~/.m2 warm across builds without baking it in.
RUN --mount=type=cache,target=/root/.m2 \
    mvn -B -q clean package -DskipTests

# ----------------------------------------------------------------------- runtime
# JRE-only image; the Spring Boot fat jar is self contained.
FROM eclipse-temurin:25-jre-alpine AS runtime
WORKDIR /app

RUN addgroup -S swiftkite && adduser -S swiftkite -G swiftkite
COPY --from=build /build/target/*.jar app.jar
USER swiftkite

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
