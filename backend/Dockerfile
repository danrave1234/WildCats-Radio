# ---------- 1st stage: build ----------
    FROM eclipse-temurin:17-jdk-alpine AS builder
    WORKDIR /workspace
    
    # Copy only what Maven needs first – this lets Docker cache dependencies
    COPY pom.xml .
    COPY .mvn .mvn
    COPY mvnw mvnw
    RUN chmod +x mvnw && ./mvnw -B dependency:go-offline
    
    # Now copy the source and build the JAR
    COPY src src
    RUN ./mvnw -B clean package -DskipTests
    
    # ---------- 2nd stage: runtime ----------
    FROM eclipse-temurin:17-jre-alpine
    WORKDIR /app
    COPY --from=builder /workspace/target/*.jar app.jar
    
    EXPOSE 8080
    ENTRYPOINT ["java","-jar","/app/app.jar"]