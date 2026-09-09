#!/bin/bash

# Quick deployment script for AgriCola to Netlify
# Usage: ./deploy.sh

echo "🚀 Building AgriCola for production..."

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

# Build the project
echo "🔨 Building project..."
npm run build

# Check if build was successful
if [ $? -eq 0 ]; then
  echo "✅ Build successful!"
  echo "📁 Built files are in the 'dist' folder"
  echo ""
  echo "🌐 Next steps:"
  echo "1. Go to netlify.com and login"
  echo "2. Drag the 'dist' folder to deploy"
  echo "   OR"
  echo "3. Connect your Git repository for automatic deploys"
  echo ""
  echo "📋 Your routes will be:"
  echo "  / → Landing page"
  echo "  /products → Products page" 
  echo "  /contact → Contact page"
  echo "  /blog → Blog page"
  echo "  /admin → Admin dashboard"
else
  echo "❌ Build failed. Please check the errors above."
  exit 1
fi