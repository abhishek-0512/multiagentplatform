#!/usr/bin/env bash
set -e

# ==============================================================================
# Multi-Agent Platform - EC2 Deployment Script
# ==============================================================================

KEY_PATH="./deploy-key.pem"
EC2_USER="ubuntu"

if [ -z "$1" ]; then
    echo "======================================================================"
    echo "Error: Missing EC2 Public IP or DNS hostname."
    echo ""
    echo "Usage: ./deploy-to-ec2.sh <EC2_PUBLIC_IP_OR_DNS>"
    echo "Example: ./deploy-to-ec2.sh 13.233.54.120"
    echo "======================================================================"
    exit 1
fi

EC2_HOST="$1"

if [ ! -f "$KEY_PATH" ]; then
    echo "Error: Key file '$KEY_PATH' not found in current directory."
    exit 1
fi

# Ensure correct permissions on the private key
chmod 400 "$KEY_PATH"

echo "==> Testing SSH connection to ${EC2_USER}@${EC2_HOST}..."
ssh -o StrictHostKeyChecking=no -i "$KEY_PATH" "${EC2_USER}@${EC2_HOST}" "echo '--> Connected successfully!'"

echo "==> Setting up Docker & Docker Compose on EC2 (if not already installed)..."
ssh -o StrictHostKeyChecking=no -i "$KEY_PATH" "${EC2_USER}@${EC2_HOST}" 'bash -s' << 'EOF'
set -e
# Add 4GB swap space to prevent Out Of Memory errors on t3.micro
if [ $(swapon --show | wc -l) -le 1 ]; then
    echo "Creating 4GB swap space for t3.micro..."
    sudo fallocate -l 4G /swapfile 2>/dev/null || sudo dd if=/dev/zero of=/swapfile bs=1M count=4096
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab || true
    echo "Swap created successfully."
fi

if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    sudo apt-get update -y
    sudo apt-get install -y ca-certificates curl gnupg
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg --yes
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update -y
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    sudo usermod -aG docker $USER
    echo "Docker installed successfully."
else
    echo "Docker is already installed."
fi
EOF

echo "==> Syncing project files to EC2..."
ssh -o StrictHostKeyChecking=no -i "$KEY_PATH" "${EC2_USER}@${EC2_HOST}" "mkdir -p ~/app"

rsync -avz --exclude=.env --exclude=.env.* --exclude=deploy-key.pem --exclude=*.backup --exclude=audit-report.json --exclude 'node_modules' --exclude '.git' --exclude 'dist' --exclude '.DS_Store' \
    -e "ssh -o StrictHostKeyChecking=no -i $KEY_PATH" \
    ./ "${EC2_USER}@${EC2_HOST}:~/app/"

echo "==> Checking remote .env file..."
if ! ssh -o StrictHostKeyChecking=no -i "$KEY_PATH" "${EC2_USER}@${EC2_HOST}" 'bash -s' << 'EOF'
set -e
cd ~/app
if [ ! -f .env ]; then
    echo "ERROR: Production .env is missing on EC2."
    echo "Configure ~/app/.env on the server before deploying."
    exit 1
fi
EOF
then
    echo "ERROR: Remote .env validation failed. Deployment aborted."
    exit 1
fi

echo "==> Building and launching containers via Docker Compose..."
ssh -o StrictHostKeyChecking=no -i "$KEY_PATH" "${EC2_USER}@${EC2_HOST}" 'bash -se' << 'EOF'
set -euo pipefail
cd ~/app

test -f .env
sudo docker compose -f docker-compose.prod.yml config --quiet
sudo docker compose -f docker-compose.prod.yml up -d --build
sudo docker compose -f docker-compose.prod.yml ps
EOF

echo "======================================================================"
echo "Deployment completed successfully!"
echo "Your app should now be live at: http://${EC2_HOST}"
echo "Check container status anytime with: ssh -i ${KEY_PATH} ${EC2_USER}@${EC2_HOST} 'sudo docker compose -f ~/app/docker-compose.prod.yml ps'"
echo "Check container logs anytime with  : ssh -i ${KEY_PATH} ${EC2_USER}@${EC2_HOST} 'sudo docker compose -f ~/app/docker-compose.prod.yml logs -f'"
echo "======================================================================"
