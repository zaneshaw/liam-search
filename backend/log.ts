import { appendFile, exists, mkdir } from "node:fs/promises";

interface LogEntry {
	time: number;
	type: LogType;
	data: any;
	message: string;
}

export enum LogType {
	System = "system",
	API = "api",
}

const logBuffer: LogEntry[] = [];

export function log(type: LogType, message: string, data?: any): void {
	logBuffer.push({ time: Date.now(), type, data, message });
	console.log(message);
}

setInterval(async () => {
	if (logBuffer.length == 0) return;

	const logLines = logBuffer
		.map((entry) => {
			const message = { ts: entry.time, type: entry.type, ...entry.data, message: entry.message };

			return JSON.stringify(message);
		})
		.join("\n");

	if (!(await exists("./logs"))) await mkdir("./logs");

	// might have logs from previous day come over within 5 seconds
	const dateArr = new Date().toLocaleDateString("en-AU").split("/");
	await appendFile(`./logs/${dateArr[2]}-${dateArr[1]}-${dateArr[0]}.txt`, `${logLines}\n`);

	logBuffer.splice(0, logBuffer.length);
}, 5000);
