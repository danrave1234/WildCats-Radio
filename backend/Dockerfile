# Use a slim Java 17 image
FROM eclipse-temurin:17-jdk-alpine

# Set the working directory
WORKDIR /app

# Copy the executable JAR file to the container
# The JAR name is determined by the pom.xml configuration
ARG JAR_FILE=target/wildcats-radio-backend-0.0.1-SNAPSHOT-exec.jar
COPY ${JAR_FILE} app.jar

# Expose the port the app runs on, as defined in application.properties
EXPOSE 8080

# Run the application
ENTRYPOINT ["java","-jar","/app/app.jar"] 