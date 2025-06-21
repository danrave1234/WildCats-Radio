    # ---------- 1st stage: build ----------
    # Use Maven baked into the image – no wrapper files required
    FROM maven:3.9-eclipse-temurin-17 AS builder
    WORKDIR /workspace
    
    # copy the build definition first (helps Docker cache dependencies)
    COPY pom.xml .
    RUN mvn -B dependency:go-offline
    
    # now copy the actual source and build
    COPY src src
    RUN mvn -B clean package -DskipTests
    
    # ---------- 2nd stage: runtime ----------
    FROM eclipse-temurin:17-jre-alpine
    WORKDIR /app
    
    # Install FFmpeg (required for audio streaming functionality)
    RUN apk add --no-cache ffmpeg
    
    COPY --from=builder /workspace/target/*.jar /app/
    
    EXPOSE 8080
    ENTRYPOINT ["java","-jar","/app/wildcats-radio-backend-0.0.1-SNAPSHOT-exec.jar"]