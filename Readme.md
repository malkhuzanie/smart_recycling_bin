# Smart Recycling Bin System

[![Status](https://img.shields.io/badge/status-active-success.svg)](https://#)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](/LICENSE)

This project is a comprehensive smart waste sorting system that uses computer vision, physical sensors, and an expert system to classify and sort recyclable materials.

-   **Backend:** C# / .NET 8 with SignalR for real-time communication.
-   **Frontend:** React / TypeScript with Material-UI for a modern dashboard.
-   **AI/Expert System:** Python services using TensorFlow/Keras for CV and the Experta library for rule-based logic.

---

## 🏛️ System Architecture

The system is composed of three main, independently running services that communicate with each other.

```
   [ User ] ----> [ React Frontend (Port 3000) ]
       ^                     |
       | (Real-time updates) | (REST API Calls)
       |                     v
   [ C# Backend (Port 5099) ] <-----> [ Python Services (Ports 8001/8002) ]
       ^ (SignalR WebSocket)                            ^
       |                                              |
   [ Arduino/Camera ] --------------------------------+ (Hardware Input)
```

---

## 🚀 Getting Started

Follow these steps to get your local development environment set up and running.

### 1. Prerequisites

Ensure you have the following software installed on your machine:

-   **Git:** For cloning the repository.
-   **[.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0):** For the C# backend.
-   **[Node.js](https://nodejs.org/) (v18+):** For the React frontend.
-   **[Python](https://www.python.org/downloads/) (v3.9+):** For the AI/ML services.
-   **(Optional but Recommended) [Docker](https://www.docker.com/products/docker-desktop/):** For a containerized setup.

### 2. Hardware Setup

For the system to function fully, connect the required hardware:

-   Connect your **USB Camera** to the computer. It should be available at `/dev/video0`.
-   Connect your **Arduino** to the computer. It should be available at `/dev/ttyUSB0`.
-   Ensure your user has permissions to access these devices:
    ```bash
    sudo usermod -a -G dialout,video $USER
    ```
    *(You may need to log out and log back in for this change to take effect.)*

### 3. Install All Dependencies

We've created a simple script to install all necessary packages for every service. Run it from the root of the project:

```bash
# Make the script executable first
chmod +x scripts/setup_dev_environment.sh

# Run the setup script
./scripts/setup_dev_environment.sh
```
This script will:
- Restore .NET packages for the backend.
- Install npm packages for the frontend.
- Create a Python virtual environment (`venv`) and install all required pip packages.

### 4. Running the System

You have two options to run the entire system.

#### Option A: Using the MVP Scripts (Recommended for Development)

We've created scripts to start and stop all services at once.

**To Start All Services:**
```bash
# Make the scripts executable
chmod +x scripts/start-mvp.sh scripts/stop-mvp.sh

# Run the start script
./scripts/start-mvp.sh
```

**To Stop All Services:**
```bash
./scripts/stop-mvp.sh
```

#### Option B: Using Docker Compose

If you have Docker installed, this is the most consistent way to run the application.

```bash
docker-compose up --build
```
To stop, press `Ctrl+C` in the terminal where Docker is running.

### 5. Accessing the System

Once the services are running, you can access them at the following URLs:

-   **📱 Frontend Dashboard:** [http://localhost:3000](http://localhost:3000)
-   **🏢 Backend API:** [http://localhost:5099](http://localhost:5099)
-   **📊 API Documentation (Swagger):** [http://localhost:5099/swagger](http://localhost:5099/swagger)
-   **🐍 Python CNN Health Check:** [http://localhost:8001/health](http://localhost:8001/health)
-   **🐍 Python Arduino Health Check:** [http://localhost:8002/health](http://localhost:8002/health)

---

## 📁 Project Structure

A brief overview of the main directories:

-   `backend/`: Contains the C# .NET API and SignalR hubs.
-   `frontend/`: Contains the React/TypeScript dashboard application.
-   `python-services/`: Contains the orchestrated Python services for the CNN model, Arduino communication, and the expert system.
-   `scripts/`: Helper scripts for development (`start-mvp.sh`, `stop-mvp.sh`, etc.).
-   `models/`: Location for storing the trained machine learning models (`.keras` files).
-   `logs/`: Where log files from the services will be generated.
-   `docker/`: Contains Dockerfiles for containerizing each service.
