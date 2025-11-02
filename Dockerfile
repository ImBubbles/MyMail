# -----------------------
# Base image
# -----------------------
FROM ubuntu:22.04

# Prevent interactive prompts
ENV DEBIAN_FRONTEND=noninteractive
ENV JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
ENV PATH="$JAVA_HOME/bin:$PATH:/usr/local/go/bin"

# -----------------------
# Install system dependencies
# -----------------------
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    unzip \
    build-essential \
    software-properties-common \
    && rm -rf /var/lib/apt/lists/*

# -----------------------
# Install Node.js
# -----------------------
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# -----------------------
# Install Java 21
# -----------------------
RUN add-apt-repository ppa:openjdk-r/ppa -y \
    && apt-get update \
    && apt-get install -y openjdk-21-jdk

# -----------------------
# Install Golang
# -----------------------
RUN curl -fsSL https://go.dev/dl/go1.22.10.linux-amd64.tar.gz -o /tmp/go.tar.gz \
    && tar -C /usr/local -xzf /tmp/go.tar.gz \
    && rm /tmp/go.tar.gz

# -----------------------
# Verify installations
# -----------------------
RUN node -v && npm -v && java -version && go version

# -----------------------
# Set working directory
# -----------------------
WORKDIR /app

# Copy the repo into the container
COPY . .

# -----------------------
# Install npm dependencies
# -----------------------
RUN npm install

# -----------------------
# Make Go binary executable
# -----------------------
RUN chmod +x scripts/postsmtp

# -----------------------
# Expose ports: backend 3000, frontend 3001
# -----------------------
EXPOSE 3000 3001

# -----------------------
# Default command: run npm dev for frontend
# -----------------------
CMD ["npm", "run", "dev"]