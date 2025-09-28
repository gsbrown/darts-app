# **Darts Scorer Application 🎯**

A self-hosted, web-based darts scoring application designed for real-time, multi-screen gameplay. It features a main display board and a separate controller interface, making it perfect for casting to a TV while managing the game from a phone or tablet.

## **Features**

* **Real-Time Scoreboard:** Game state is synchronized instantly between the display and controller using WebSockets.  
* **Dual-Screen Interface:** A dedicated display for viewing and a feature-rich controller for game management.  
* **Multiple Game Modes:** Comes with a variety of classic darts games:  
  * 501  
  * Cricket  
  * Around The World  
  * Baseball  
  * B.E.E.R.S.  
  * Golf  
  * Killer  
  * 3 Friendly Flights  
* **Persistent Data:** Saves players and all-time win statistics to a persistent volume, so your data survives container restarts.  
* **Easy Setup:** Fully containerized with Docker and Docker Compose for a simple, one-command startup.

## **Tech Stack**

* **Backend:** Node.js, Express, Socket.IO  
* **Frontend:** Nginx, React (via CDN), Tailwind CSS (via CDN)  
* **DevOps:** Docker & Docker Compose

## **Getting Started**

These instructions will get a copy of the project up and running on your local machine.

### **Prerequisites**

You need to have **Docker** and **Docker Compose** installed on your system.

### **Installation**

1. **Clone the repository:**  
   git clone \[https://github.com/gsbrown/darts-app.git\](https://github.com/gsbrown/darts-app.git)  
   cd darts-app

2. Configure File Permissions:  
   The backend container runs as a non-root user to avoid permission errors when writing to the data volume. You need to create a .env file so Docker can match the container user's ID with your own.  
   Run this command in the project's root directory:  
   echo "UID=$(id \-u)" \> .env  
   echo "GID=$(id \-g)" \>\> .env

3. Build and Run the Containers:  
   This command will build the frontend and backend images and start the services in the background.  
   docker-compose up \--build \-d

## **Usage**

Once the containers are running, you can access the two interfaces from your web browser.

* **🎯 Display Interface:** http://\<your-server-ip\>:8441  
* **📱 Controller Interface:** http://\<your-server-ip\>:8442

All game setup, player management, and scoring is done through the **controller interface**. The display will update automatically.

## **How It Works**

This project uses a simple, robust architecture orchestrated by Docker Compose:

* **backend Service:** A lightweight Node.js server built on an Alpine Linux image. It runs the Express and Socket.IO application, which manages all game logic and state. It reads from and writes to the darts\_data volume for persistent storage.  
* **frontends Service:** An Nginx container that serves the static HTML, JS, and game files for both the display and controller interfaces. It also acts as a reverse proxy, directing WebSocket (/socket.io/) traffic to the backend service.  
* **darts\_data Volume:** A named volume that Docker manages. It is mounted into the backend container at /usr/src/app/data to ensure that player lists and stats files are saved on the host machine and persist even if the container is removed or recreated.

## **License**

This project is licensed under the MIT License.
