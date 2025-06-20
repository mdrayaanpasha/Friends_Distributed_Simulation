﻿# Friends_Distributed_Simulation

A distributed backend system where sitcom characters like Ross and Rachel never stop talking — powered by LLMs and RabbitMQ.

No frontend. Just relentless sarcasm, asynchronous messaging, and AI-fueled banter.

## 🧠 What It Is

SitcomGPT simulates real-time conversations between fictional characters using:

- 🤖 **Google Gemini**: for generating witty, character-styled one-liners  
- 📨 **RabbitMQ**: for message-passing between autonomous character services  
- 🛠️ **Node.js + Express**: for setting up character agents and initiating dialogues

Each character is its own service, listening and responding via queues, creating the illusion of an endless, distributed sitcom.

---

## 🛠️ Setup

### 1. Clone this repo

```bash
git clone https://github.com/yourusername/sitcom-gpt.git
cd sitcom-gpt
```

### 2. Install dependencies
```
npm install
```

### 3. Create a .env file

Add your Google Gemini API key like so:

GEMINI_API_KEY=your-api-key-here

### 4. Run RabbitMQ

Make sure RabbitMQ is running locally at amqp://localhost. You can spin it up with Docker:

docker run -d --hostname my-rabbit --name some-rabbit -p 5672:5672 rabbitmq:3

---

## 🚀 Start the Characters

Each character (e.g., Ross, Rachel) runs on its own port and listens to the shared message queue.

### Terminal 1 - Ross service
```
node index.js
```

### Terminal 2 - Rachel service
```
node index.js
```

### Terminal 3 - Joe service
```
node index.js
```

Start the conversation by triggering Ross:

```
curl http://localhost:3000/make-ross-talk
```

## 🧪 What Happens

You’ll witness something like this:

```
📩 Ross ➡️ Rachel: "You were *so* on a break."
💬 Rachel ➡️ Ross: "And you're still on pause, emotionally."
📩 Ross ➡️ Rachel: "I'm not emotionally unavailable, I'm just... historically cautious."
```

The conversation can loop indefinitely — or descend into pure AI-powered chaos. Up to you.
## 🧱 Tech Stack

- Node.js + Express
- RabbitMQ
- Google Gemini API (LLM)

## 🏁 Future Ideas

- Add more characters (Joey? Chandler?)
- Visual frontend for chat timeline
- Add memory or context history per agent
- Conversation limiter or sentiment analytics

## 📬 Contact

Feel free to open an issue or ping me if you want to collab on multi-agent AI chaos simulations.

