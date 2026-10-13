# Multi-Agent Platform - AWS EC2 Deployment Guide

This guide walks you through deploying the complete **Multi-Agent Platform** (Vite React Frontend + API Gateway + Auth + Chat + Agent + Billing microservices + Redis) onto an **AWS EC2** instance using Docker Compose and Nginx.

---

## Architecture Overview

```mermaid
flowchart TD
    Client["User Browser"] -->|Port 80 / 443| Nginx["Nginx Reverse Proxy & Static Host (Port 80)"]

    subgraph EC2 ["AWS EC2 Instance (t3.medium / t3.large)"]
        subgraph DockerNet ["Docker Network (multiagent-net)"]
            Nginx -->|/ (Static React SPA)| Dist["Frontend Build"]
            Nginx -->|/api/*| Gateway["API Gateway (Port 8000)"]

            Gateway -->|/api/auth/*| Auth["Auth Service (Port 8001)"]
            Gateway -->|/api/chat/*| Chat["Chat Service (Port 8002)"]
            Gateway -->|/api/agent/*| Agent["Agent Service (Port 8003)"]
            Gateway -->|/api/billing/*| Billing["Billing Service (Port 8004)"]

            Auth --> Redis[("Redis (Port 6379)")]
            Chat --> Redis
            Agent --> Redis
            Billing --> Redis
        end
    end

    Auth --> Mongo[("MongoDB Atlas")]
    Chat --> Mongo
    Agent --> Mongo
    Billing --> Mongo

    Agent --> S3["AWS S3 Bucket"]
    Agent --> LLMs["LLMs (Groq / Gemini / Tavily / Qdrant)"]
    Billing --> Razorpay["Razorpay API"]
```

---

## Step 1: Launch an AWS EC2 Instance

1. Open the [AWS EC2 Console](https://console.aws.amazon.com/ec2/) in your region (e.g. `ap-south-1` Mumbai).
2. Click **Launch instance**:
   - **Name**: `multiagent-platform-server`
   - **OS (AMI)**: `Ubuntu Server 22.04 LTS` (or `24.04 LTS`) - 64-bit (x86_64)
   - **Instance type**: `t3.medium` (2 vCPU, 4 GiB RAM) or `t3.large` (2 vCPU, 8 GiB RAM) — recommended because 5 Node.js microservices + Redis + build require at least 3-4 GB RAM.
   - **Key pair**: Select your existing key pair associated with `deploy-key.pem`.
   - **Storage**: At least **25 GiB gp3** root volume.

---

## Step 2: Configure Security Group Inbound Rules

In the EC2 Security Group, open the following inbound ports:

| Type | Protocol | Port Range | Source | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **SSH** | TCP | `22` | `My IP` (or `0.0.0.0/0`) | Remote SSH access |
| **HTTP** | TCP | `80` | `0.0.0.0/0` | Web traffic (Nginx) |
| **HTTPS** | TCP | `443` | `0.0.0.0/0` | SSL traffic (Certbot) |

*Note: All internal microservices (8000-8004, 6379) run inside Docker's private bridge network and should NOT be opened to the public.*

---

## Step 3: Run the Automated Deployment Script

Once your EC2 instance is in `Running` state and has a **Public IPv4 address**, run the deployment script from your project root:

```bash
chmod 400 deploy-key.pem
./deploy-to-ec2.sh <YOUR_EC2_PUBLIC_IP>
```

### What this script automatically does:
1. Validates SSH connectivity using `deploy-key.pem`.
2. Installs Docker and the Docker Compose plugin on Ubuntu.
3. Rsyncs the clean project codebase to `~/app` on the EC2 instance.
4. Generates `~/app/.env` from `.env.production.example` if it doesn't already exist.
5. Runs `sudo docker compose -f docker-compose.prod.yml up -d --build`.

---

## Step 4: Configure Remote Environment Variables

Log in to your EC2 instance:
```bash
ssh -i deploy-key.pem ubuntu@<YOUR_EC2_PUBLIC_IP>
```

Navigate to the app directory and edit the production `.env` file:
```bash
cd ~/app
nano .env
```

Ensure all database, AI keys, and AWS credentials are set:
```env
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/multiagent?retryWrites=true&w=majority
GROQ_API_KEY=gsk_...
GOOGLE_API_KEY=AIzaSy...
GEMINI_API_KEY=AIzaSy...
TAVILY_API_KEY=tvly-...
QDRANT_URL=https://...
QDRANT_API_KEY=...
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_KEY=...
AWS_BUCKET_NAME=your-s3-bucket
RAZORPAY_KEY_SECRET=...
FRONTEND_URL=http://<YOUR_EC2_PUBLIC_IP>
```

Restart the containers:
```bash
sudo docker compose -f docker-compose.prod.yml up -d
```

---

## Step 5: Verification & Useful Commands

### Check running containers:
```bash
sudo docker compose -f docker-compose.prod.yml ps
```

### View logs:
```bash
# View all logs in real-time
sudo docker compose -f docker-compose.prod.yml logs -f

# View logs for a specific service
sudo docker compose -f docker-compose.prod.yml logs -f gateway
sudo docker compose -f docker-compose.prod.yml logs -f agent
```
