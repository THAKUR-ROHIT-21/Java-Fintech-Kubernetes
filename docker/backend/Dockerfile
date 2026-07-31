# ---------- Stage 1: build the jar with Maven ----------
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app

COPY pom.xml .
RUN --mount=type=cache,target=/root/.m2 \
    mvn -q dependency:go-offline

COPY src ./src
RUN --mount=type=cache,target=/root/.m2 \
    mvn -q clean package -DskipTests

# ---------- Stage 2: minimal runtime image ----------
FROM eclipse-temurin:17-jre-jammy
WORKDIR /app

RUN groupadd -r ledgerline && useradd -r -g ledgerline ledgerline

COPY --from=build /app/target/banking-*.jar app.jar
RUN chown ledgerline:ledgerline app.jar
USER ledgerline

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
  CMD wget -qO- http://localhost:8080/actuator/health | grep -q '"status":"UP"' || exit 1

ENTRYPOINT ["java", "-XX:+UseContainerSupport", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]
