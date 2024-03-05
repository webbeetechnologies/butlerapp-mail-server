import { Request, Response } from "express";

let clients = [];

export const sendEventsToAll = (data) => {
    clients.forEach((client) => client.res.write(`data: ${JSON.stringify(data)}\n\n`));
};

export const eventsHandler = (req: Request, res: Response) => {
    if (req.headers.accept !== "text/event-stream") {
        res.status(400).send("Request must accept text/event-stream");
        return;
    }

    const headers = {
        "Content-Type": "text/event-stream",
        Connection: "keep-alive",
        "Cache-Control": "no-cache",
    };

    res.writeHead(200, headers);

    const clientId = Date.now();

    res.write(`data: ${JSON.stringify({ clientId })}\n\n`);

    const newClient = {
        id: clientId,
        res,
    };

    clients.push(newClient);

    req.on("close", () => {
        console.log(`${clientId} Connection closed`);
        clients = clients.filter((client) => client.id !== clientId);
    });
};
