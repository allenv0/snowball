#!/bin/bash
# Build script for Vercel deployment

echo "Generating image dimensions..."
python3 lister.py

echo "Build complete!"