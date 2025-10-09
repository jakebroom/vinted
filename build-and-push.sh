#!/bin/bash

# Vinted Inventory System - Build and Push Script
# This script builds the Docker image and pushes it to Docker Hub

set -e

# Configuration
IMAGE_NAME="vinted-inventory"
DOCKER_USER="jakebroom"  # Replace with your Docker Hub username
VERSION="1.0.8"

echo "🚀 Building Vinted Inventory System Docker Image..."

# Build the Docker image
docker build -t ${DOCKER_USER}/${IMAGE_NAME}:${VERSION} .
docker build -t ${DOCKER_USER}/${IMAGE_NAME}:latest .

echo "✅ Build completed successfully!"

# Ask if user wants to push to Docker Hub
read -p "Do you want to push to Docker Hub? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "📤 Pushing to Docker Hub..."
    
    # Login to Docker Hub (if not already logged in)
    docker login
    
    # Push both tags
    docker push ${DOCKER_USER}/${IMAGE_NAME}:${VERSION}
    docker push ${DOCKER_USER}/${IMAGE_NAME}:latest
    
    echo "✅ Successfully pushed to Docker Hub!"
    echo "📋 Users can now run: docker run -d -p 3000:3000 -v ./data:/app/data ${DOCKER_USER}/${IMAGE_NAME}:latest"
else
    echo "⏭️ Skipping push to Docker Hub"
    echo "📋 To run locally: docker run -d -p 3000:3000 -v ./data:/app/data ${DOCKER_USER}/${IMAGE_NAME}:latest"
fi

echo "🎉 Done!"