import amqplib from "amqplib";
import 'dotenv/config';
import express from "express";
import { talkToCharacter } from "./characterAI.js";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";





const prisma = new PrismaClient();
const app = express(); 

const PORT = 3002;
const EXCHANGE_NAME = 'friends-exchange';
const CHARACTER_NAME = "Joey";
const characters = ["Rachel", "Ross"];
let channel;    

async function connect() {

    try {
        const conn = await amqplib.connect(process.env.RABITMQ_URL);

        channel = await conn.createChannel();

        const exchange = await channel.assertExchange(EXCHANGE_NAME, 'direct', { durable: true });

        const Q = await channel.assertQueue(`q-${CHARACTER_NAME}`, { durable: true });


        // Queue bind with exchange with label char name
        await channel.bindQueue(Q.queue, EXCHANGE_NAME, CHARACTER_NAME);

        console.log(`[*] ${CHARACTER_NAME} is ready to receive messages...`);

        await channel.purgeQueue(`q-${CHARACTER_NAME}`);


        channel.consume(Q.queue, async(msg)=>{
            if(!msg) return;

         
            const {
                conversationId,
                from,
                to,
                message,
            } = JSON.parse(msg.content.toString());


            if (!conversationId || to !== CHARACTER_NAME || from === CHARACTER_NAME) {
                channel.ack(msg);
                return;
            }

            await prisma.logs.create({
                data: {
                conversationId,
                characterFrom: from,
                characterTo: to,
                message,
                },
            });

            

            console.log(`[*] ${CHARACTER_NAME} received message from ${from}: ${message}`);

            // respond to them using AI..
 // only send last 5 messages to avoid token limit issues.
 
            let context = await prisma.logs.findMany({
                where: {
                conversationId,
                OR: [
                    { characterFrom: CHARACTER_NAME },
                    { characterTo: CHARACTER_NAME },
                ],
                },
                orderBy: { createdAt: "asc" },
                take: 5,
            });


            // 🔥 CHANGE: hard stop to prevent infinite loops
            if (context.length >= 10) {
                console.log(
                `[*] ${CHARACTER_NAME} stopping conversation ${conversationId}`
                );
                channel.ack(msg);
                return;
            }

            // respond to them using AI..
            const contextText = context
            .map((m) => `${m.characterFrom}: ${m.message}`)
            .join("\n");

            const AiMessage = await talkToCharacter(
                CHARACTER_NAME,
                from,
                `${message}\n\nRecent conversation:\n${contextText}`
            );

            const reply = {
                conversationId, 
                from: CHARACTER_NAME,
                to: from,
                message: AiMessage,
            };

            channel.publish(
                EXCHANGE_NAME,
                from,
                Buffer.from(JSON.stringify(reply)),
                { persistent: true }
            );

            //create a 30% chance that they might also talk to other character meanwhile.
            const randomNum = Math.random();

            if (Math.random() < 0.1 && context.length < 4) {
                const otherChar = characters.find((c) => c !== from);

                if (otherChar) {

                    const sideMessage = await talkToCharacter(
                        CHARACTER_NAME,
                        otherChar,
                        `I was just talking to ${from}. Thought I'd say hi.`
                    );

                    channel.publish(
                        EXCHANGE_NAME,
                        otherChar,
                        Buffer.from(
                        JSON.stringify({
                            conversationId,
                            from: CHARACTER_NAME,
                            to: otherChar,
                            message: sideMessage,
                        })
                        ),
                        { persistent: true }
                    );

                console.log(
                    `[*] ${CHARACTER_NAME} side-talked to ${otherChar}`
                );
                }
            }


            channel.ack(msg);

        });

    } catch (error) {
        console.log("Error connecting to RabbitMQ:", error);
        return;
    }
}


app.get("/start-convo-bro", async (req, res) => {
    try {
        
        // pick a random character...
        const char = characters[Math.floor(Math.random() * characters.length)];
        const conversationId = crypto.randomUUID();

        const message = {
            conversationId,
            from: CHARACTER_NAME,
            to: char,
            message: "Hey! How you doin'?",
        };

        channel.publish(
            EXCHANGE_NAME,
            char,
            Buffer.from(JSON.stringify(message)),
            { persistent: true }
        );

        console.log(
            `[*] ${CHARACTER_NAME} started convo ${conversationId} with ${char}`
        );

        res.send({
            status: "success",
            conversationId,
            with: char,
        });
    } catch (error) {
        console.log("Error starting conversation:", error);
        res.status(500).send("Failed to start conversation.");
    }
});

app.listen(PORT, () => {
    console.log(`[*] ${CHARACTER_NAME} service is running on port ${PORT}`);
    connect();
});

