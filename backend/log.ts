import { appendFile, exists, mkdir } from "node:fs/promises";

interface LogEntry {
	time: number;
	text: string;
}

export let logBuffer: LogEntry[] = [];

setInterval(async () => {
	if (logBuffer.length == 0) return;

	const logLines = logBuffer
		.map((entry) => {
			return `[${new Date(entry.time).toLocaleTimeString()}] ${entry.text}`;
		})
		.join("\n");

	if (!(await exists("./logs"))) await mkdir("./logs");

	// might have logs from previous day come over within 5 seconds
	const dateArr = new Date().toLocaleDateString("en-AU").split("/");
	await appendFile(`./logs/${dateArr[2]}-${dateArr[1]}-${dateArr[0]}.txt`, `${logLines}\n`);

	logBuffer = [];
}, 5000);
