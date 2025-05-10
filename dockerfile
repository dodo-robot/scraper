# Use the official Node.js image from Docker Hub
FROM node:16

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if you have it) first to leverage Docker cache
COPY package.json ./

# Install the app dependencies
RUN npm install

# Install missing dependencies for Playwright
RUN apt-get update && apt-get install -y \
    libicu-dev \
    libjpeg-dev \
    libvpx-dev \
    libevent-dev \
    ttf-mscorefonts-installer \
    && rm -rf /var/lib/apt/lists/*

# Install Playwright and its browser dependencies
RUN npx playwright install
RUN npx playwright install-deps

# Copy the rest of the application code to the working directory
COPY . .

# Expose the application port (adjust if your app runs on a different port)
EXPOSE 4000

# Define the command to run your app
CMD ["npm", "start"]
