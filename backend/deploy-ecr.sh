#!/bin/bash
set -e

# ==============================================================================
# Multi-Agent Platform - AWS ECR Build & Push Script for ap-south-1
# ==============================================================================

# 1. Configuration (Set your AWS Account ID or pass it as an environment variable)
AWS_REGION="ap-south-1"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "")}"

if [ -z "$AWS_ACCOUNT_ID" ]; then
  echo "Error: AWS_ACCOUNT_ID is not set and could not be determined from AWS CLI."
  echo "Usage: AWS_ACCOUNT_ID=123456789012 ./deploy-ecr.sh"
  exit 1
fi

ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
IMAGE_TAG="${IMAGE_TAG:-latest}"

echo "=========================================="
echo "Target AWS Region: ${AWS_REGION}"
echo "AWS Account ID   : ${AWS_ACCOUNT_ID}"
echo "ECR Registry     : ${ECR_REGISTRY}"
echo "Image Tag        : ${IMAGE_TAG}"
echo "=========================================="

# 2. Authenticate Docker with ECR in ap-south-1
echo "==> Authenticating Docker to AWS ECR in ${AWS_REGION}..."
aws ecr get-login-password --region "${AWS_REGION}" | docker login --username AWS --password-stdin "${ECR_REGISTRY}"

# 3. List of microservices to build and push
# Format: "service_name:dockerfile_path"
SERVICES=(
  "gateway:gateway/Dockerfile"
  "auth:services/auth/Dockerfile"
  "chat:services/chat/Dockerfile"
  "agent:services/agent/Dockerfile"
  "billing:services/billing/Dockerfile"
)

# 4. Ensure ECR repositories exist in ap-south-1 and push images
for entry in "${SERVICES[@]}"; do
  SERVICE_NAME="${entry%%:*}"
  DOCKERFILE_PATH="${entry##*:}"
  REPO_NAME="multiagent-${SERVICE_NAME}"
  FULL_IMAGE_URI="${ECR_REGISTRY}/${REPO_NAME}:${IMAGE_TAG}"

  echo "----------------------------------------------------"
  echo "Processing service: ${SERVICE_NAME}"
  echo "Repository Name   : ${REPO_NAME}"
  echo "----------------------------------------------------"

  # Create ECR repository if it doesn't exist in ap-south-1
  echo "--> Checking/creating ECR repository '${REPO_NAME}' in ${AWS_REGION}..."
  aws ecr describe-repositories --repository-names "${REPO_NAME}" --region "${AWS_REGION}" >/dev/null 2>&1 || \
  aws ecr create-repository \
    --repository-name "${REPO_NAME}" \
    --region "${AWS_REGION}" \
    --image-scanning-configuration scanOnPush=true \
    --encryption-configuration encryptionType=AES256

  # Build image with linux/amd64 platform (avoids exec format error if developing on Mac M1/M2/M3)
  echo "--> Building Docker image for ${SERVICE_NAME} (linux/amd64)..."
  docker build \
    --platform linux/amd64 \
    -f "${DOCKERFILE_PATH}" \
    -t "${REPO_NAME}:${IMAGE_TAG}" \
    -t "${FULL_IMAGE_URI}" \
    .

  # Push image to ECR ap-south-1
  echo "--> Pushing ${FULL_IMAGE_URI}..."
  docker push "${FULL_IMAGE_URI}"

  echo "Successfully pushed ${FULL_IMAGE_URI}"
done

echo "===================================================="
echo "All microservices successfully pushed to ${AWS_REGION}!"
echo "===================================================="
