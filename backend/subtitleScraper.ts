import ytdlpWrap from "yt-dlp-wrap";
import readline from "readline";
import { Glob } from "bun";
import path from "path";
import { logBuffer } from "./log";

interface VideoInfo {
	id?: string;
	title?: string;
	thumbnailUrl?: string;
	channnelTitle?: string;
	channnelId?: string;
}

const ytdlp = new ytdlpWrap("./bin/yt-dlp");
const playlistUrl = "PLeMf46ndvGffIJt5KKDa_5SbXZ6F3azhP";
const cookiesPath = "cookies.txt";

// scuffed. needs rewrite
async function loadVideoMetadata(file: Bun.BunFile) {
	const currentDate = new Date().toISOString().split("T")[0] as string;

	let videos: { fetch_date: string; videos: any[] } = {
		fetch_date: currentDate,
		videos: [],
	};

	if (await file.exists()) {
		const _videos = await file.json();

		if (_videos.fetch_date == currentDate) {
			console.log("already loaded video metadata today. loading from cache...");
			logBuffer.push({
				time: Date.now(),
				text: "(SYSTEM) already loaded video metadata today. loading from cache...",
			});

			return _videos;
		}

		videos = _videos;
		videos.fetch_date = currentDate;
	}

	console.log("loading video metadata...");
	logBuffer.push({
		time: Date.now(),
		text: "(SYSTEM) loading video metadata...",
	});

	const playlistRaw = await ytdlp.execPromise([
		"--flat-playlist",
		"--print",
		"%(id)s\t%(title)s\t%(uploader)s",
		"--encoding",
		"utf-8",
		"--cookies",
		cookiesPath,
		"--extractor-args",
		"youtubetab:skip=authcheck",
		playlistUrl,
	]);

	for (const video of playlistRaw.trim().split("\n")) {
		const videoArr = video.split("\t");
		const videoIndex = videos.videos.findIndex((x) => x.id == videoArr[0]);
		const videoObj = {
			id: videoArr[0],
			title: videoArr[1],
			thumbnail: `https://i.ytimg.com/vi/${videoArr[0]}/mqdefault.jpg`,
			uploader: videoArr[2],
		};

		if (videoIndex > -1) {
			Object.assign(videos.videos[videoIndex], videoObj);
		} else {
			videos.videos.push(videoObj);
		}
	}

	console.log(`writing to ${file.name}...`);
	logBuffer.push({
		time: Date.now(),
		text: `(SYSTEM) writing to ${file.name}...`,
	});

	await file.write(JSON.stringify(videos, null, "\t"));

	return videos;
}

// scuffed. needs rewrite
export async function downloadSubtitles(file: Bun.BunFile) {
	const currentDate = new Date().toISOString().split("T")[0] as string;

	const videos = await loadVideoMetadata(file);

	if (await file.exists()) {
		const _videos = await file.json();

		if (_videos.subtitle_fetch_date == currentDate) {
			console.log("already downloaded subtitles today. skipping...");
			logBuffer.push({
				time: Date.now(),
				text: "(SYSTEM) already downloaded subtitles today. skipping...",
			});

			return;
		}
	}

	if (!process.stdout.isTTY) {
		console.log(`downloading ${videos.videos.length} subtitles...`)
		logBuffer.push({
			time: Date.now(),
			text: `(SYSTEM) downloading ${videos.videos.length} subtitles...`,
		});
	}

	for (let i = 0; i < videos.videos.length; i++) {
		const video = videos.videos[i];

		if (process.stdout.isTTY) {
			readline.cursorTo(process.stdout, 0);
			process.stdout.write(`downloading subtitles ${i + 1} of ${videos.videos.length}...`);
		}

		if (!video.subtitles_path) {
			const stdout = await ytdlp.execPromise([
				"--skip-download",
				"--write-sub",
				"--write-auto-sub",
				"--sub-lang",
				"en",
				"--sub-format",
				"srt",
				"--cookies",
				cookiesPath,
				"-o",
				"subtitles/%(id)s.%(ext)s",
				`https://www.youtube.com/watch?v=${video.id}`,
			]);

			if (stdout.includes("There are no subtitles for the requested languages")) {
				continue;
			}

			const destinationStdout = "[download] Destination: ";
			const destination = stdout
				.split("\n")
				.find((line) => line.startsWith(destinationStdout))
				?.slice(destinationStdout.length);

			video.subtitles_path = destination;

			await file.write(JSON.stringify(videos, null, "\t"));
		}
	}

	if (process.stdout.isTTY) {
		process.stdout.write("\n");
	} else {
		console.log("finished downloading subtitles")
	}

	logBuffer.push({
		time: Date.now(),
		text: "(SYSTEM) finished downloading subtitles",
	});

	videos.subtitle_fetch_date = currentDate;

	await file.write(JSON.stringify(videos, null, "\t"));
}

export async function checkMissingSubtitles(file: Bun.BunFile) {
	if (!(await file.exists())) {
		console.error(`${file.name} doesn't exist. can't check for missing subtitles.`);
		return;
	}

	const videos = await file.json();
	const missingSubtitlesIds: any[] = [];

	for (const video of videos.videos) {
		if (!video.subtitles_path) {
			missingSubtitlesIds.push({ uploader: video.uploader, id: video.id });
		}
	}

	if (missingSubtitlesIds.length > 0) {
		console.warn(`${missingSubtitlesIds.length} videos have missing subtitles`);
		logBuffer.push({
			time: Date.now(),
			text: `(SYSTEM WARNING) ${missingSubtitlesIds.length} videos have missing subtitles`,
		});
	} else {
		console.log("no videos have missing subtitles");
		logBuffer.push({
			time: Date.now(),
			text: "(SYSTEM) no videos have missing subtitles",
		});
	}

	return missingSubtitlesIds;
}

export async function convertSubtitles() {
	const outArr: any[] = [];

	let id = 0;
	for (const fileName of new Glob("subtitles/*").scanSync()) {
		const file = Bun.file(fileName);
		const raw = (await file.text()).trim();
		const arr = raw.split("\n\n").map((chunk) => {
			const lines = chunk.split("\n");
			const times = lines[1]!.split(" --> ");
			id++;

			return {
				id: id,
				video_id: path.parse(file.name as string).name.split(".")[0], // lol
				time_start: times[0],
				time_end: times[1],
				text: lines[2],
			};
		});

		outArr.push(...arr);
	}

	return outArr;
}
