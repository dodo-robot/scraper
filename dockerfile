# Use the official Node.js image from Docker Hub
FROM mcr.microsoft.com/playwright:v1.52.0-noble

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if you have it) first to leverage Docker cache
COPY package.json ./

# Install the app dependencies
RUN npm install

# Copy the rest of the application code to the working directory
COPY . .

# Expose the application port (adjust if your app runs on a different port)
EXPOSE 4000

# Define the command to run your app
CMD ["npm", "start"]
