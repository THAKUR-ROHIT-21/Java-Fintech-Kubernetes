# Ledgerline: production-readiness update — actuator health check,
# env-var-configurable DB/JWT/CORS settings, Dockerfile, .dockerignore
# Run this from inside the backend\ folder
Write-Host 'Applying production-readiness changes...' -ForegroundColor Cyan

New-Item -ItemType Directory -Force -Path (Split-Path 'pom.xml') | Out-Null
@'
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>

  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.3.4</version>
    <relativePath/>
  </parent>

  <groupId>com.bank</groupId>
  <artifactId>banking</artifactId>
  <version>0.1.0</version>
  <name>banking</name>
  <description>Ledgerline core banking backend</description>

  <properties>
    <java.version>17</java.version>
    <jjwt.version>0.12.6</jjwt.version>
  </properties>

  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-actuator</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-data-jpa</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-security</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-validation</artifactId>
    </dependency>

    <dependency>
      <groupId>org.postgresql</groupId>
      <artifactId>postgresql</artifactId>
      <scope>runtime</scope>
    </dependency>

    <!-- JWT -->
    <dependency>
      <groupId>io.jsonwebtoken</groupId>
      <artifactId>jjwt-api</artifactId>
      <version>${jjwt.version}</version>
    </dependency>
    <dependency>
      <groupId>io.jsonwebtoken</groupId>
      <artifactId>jjwt-impl</artifactId>
      <version>${jjwt.version}</version>
      <scope>runtime</scope>
    </dependency>
    <dependency>
      <groupId>io.jsonwebtoken</groupId>
      <artifactId>jjwt-jackson</artifactId>
      <version>${jjwt.version}</version>
      <scope>runtime</scope>
    </dependency>

    <dependency>
      <groupId>org.projectlombok</groupId>
      <artifactId>lombok</artifactId>
      <optional>true</optional>
    </dependency>

    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-devtools</artifactId>
      <scope>runtime</scope>
      <optional>true</optional>
    </dependency>

    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-test</artifactId>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>org.springframework.security</groupId>
      <artifactId>spring-security-test</artifactId>
      <scope>test</scope>
    </dependency>
  </dependencies>

  <build>
    <plugins>
      <plugin>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-maven-plugin</artifactId>
        <configuration>
          <excludes>
            <exclude>
              <groupId>org.projectlombok</groupId>
              <artifactId>lombok</artifactId>
            </exclude>
          </excludes>
        </configuration>
      </plugin>
    </plugins>
  </build>

</project>

'@ | Out-File -Encoding utf8 'pom.xml'
Write-Host '  wrote pom.xml'

New-Item -ItemType Directory -Force -Path (Split-Path 'src\main\resources\application.yml') | Out-Null
@'
server:
  port: 8080

spring:
  application:
    name: ledgerline-banking

  datasource:
    url: ${DB_URL:jdbc:postgresql://localhost:5432/bankingdb}
    username: ${DB_USERNAME:banking_user}
    password: ${DB_PASSWORD:banking_pass123}
    driver-class-name: org.postgresql.Driver

  jpa:
    hibernate:
      ddl-auto: update
    show-sql: false
    properties:
      hibernate:
        format_sql: true
        jdbc:
          time_zone: UTC
    open-in-view: false

  sql:
    init:
      mode: always

app:
  jwt:
    secret: ${JWT_SECRET:3f8b9c1a7d2e4f6091b8c3a5d7e9f1023f8b9c1a7d2e4f6091b8c3a5d7e9f102}
    expiration-ms: ${JWT_EXPIRATION_MS:86400000}   # 24 hours
  cors:
    allowed-origin: ${CORS_ALLOWED_ORIGIN:http://localhost:5173}

management:
  endpoints:
    web:
      exposure:
        include: health
  endpoint:
    health:
      show-details: never

logging:
  level:
    org.hibernate.SQL: WARN
    com.bank.banking: INFO

'@ | Out-File -Encoding utf8 'src\main\resources\application.yml'
Write-Host '  wrote src\main\resources\application.yml'

New-Item -ItemType Directory -Force -Path (Split-Path 'src\main\java\com\bank\banking\config\SecurityConfig.java') | Out-Null
@'
package com.bank.banking.config;

import com.bank.banking.security.JwtAuthFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final UserDetailsServiceImpl userDetailsService;
    private final JwtAuthFilter jwtAuthFilter;

    @Value("${app.cors.allowed-origin}")
    private String allowedOrigin;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public DaoAuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers("/actuator/health").permitAll()
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .anyRequest().authenticated()
                )
                .authenticationProvider(authenticationProvider())
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(allowedOrigin));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}

'@ | Out-File -Encoding utf8 'src\main\java\com\bank\banking\config\SecurityConfig.java'
Write-Host '  wrote src\main\java\com\bank\banking\config\SecurityConfig.java'

New-Item -ItemType Directory -Force -Path (Split-Path 'Dockerfile') | Out-Null
@'
# ---------- Stage 1: build the jar with Maven ----------
FROM eclipse-temurin:17-jdk-jammy AS build
WORKDIR /app

# Copy pom first so dependency downloads are cached across builds
# whenever only source code changes, not pom.xml
COPY pom.xml .
COPY .mvn .mvn 2>/dev/null || true
COPY mvnw . 2>/dev/null || true
RUN --mount=type=cache,target=/root/.m2 \
    mvn -q dependency:go-offline || true

COPY src ./src
RUN --mount=type=cache,target=/root/.m2 \
    mvn -q clean package -DskipTests

# ---------- Stage 2: minimal runtime image ----------
FROM eclipse-temurin:17-jre-jammy
WORKDIR /app

# Run as a non-root user — never run a production JVM as root
RUN groupadd -r ledgerline && useradd -r -g ledgerline ledgerline

COPY --from=build /app/target/banking-*.jar app.jar
RUN chown ledgerline:ledgerline app.jar
USER ledgerline

EXPOSE 8080

# Basic container-level health check hitting Spring Boot Actuator
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
  CMD wget -qO- http://localhost:8080/actuator/health | grep -q '"status":"UP"' || exit 1

ENTRYPOINT ["java", "-XX:+UseContainerSupport", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]

'@ | Out-File -Encoding utf8 'Dockerfile'
Write-Host '  wrote Dockerfile'

New-Item -ItemType Directory -Force -Path (Split-Path '.dockerignore') | Out-Null
@'
target/
*.log
.idea/
.vscode/
*.iml
.git/
.gitignore
*.md

'@ | Out-File -Encoding utf8 '.dockerignore'
Write-Host '  wrote .dockerignore'

Write-Host 'Stripping BOM...' -ForegroundColor Cyan
$filesToFix = @(
    'pom.xml',
    'src\main\resources\application.yml',
    'src\main\java\com\bank\banking\config\SecurityConfig.java',
    'Dockerfile',
    '.dockerignore'
)
foreach ($f in $filesToFix) {
    $content = Get-Content $f -Raw
    [System.IO.File]::WriteAllText((Resolve-Path $f), $content, (New-Object System.Text.UTF8Encoding($false)))
}

Write-Host 'Done. Now run:  mvn clean package -DskipTests' -ForegroundColor Green