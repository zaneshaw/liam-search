import ytdlpWrap from "yt-dlp-wrap";
import readline from "readline";
import { Glob } from "bun";
import { Hono } from "hono";
import { cors } from "hono/cors";
import FlexSearch, { Document } from "flexsearch";

interface VideoInfo {
	id?: string;
	title?: string;
	thumbnailUrl?: string;
	channnelTitle?: string;
	channnelId?: string;
}

const ytdlp = new ytdlpWrap("./bin/yt-dlp.exe");
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

			return _videos;
		}

		videos = _videos;
		videos.fetch_date = currentDate;
	}

	console.log("loading video metadata...");

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
	await file.write(JSON.stringify(videos, null, "\t"));

	return videos;
}

// scuffed. needs rewrite
async function downloadSubtitles(file: Bun.BunFile) {
	const currentDate = new Date().toISOString().split("T")[0] as string;

	const videos = await loadVideoMetadata(file);

	if (await file.exists()) {
		const _videos = await file.json();

		if (_videos.subtitle_fetch_date == currentDate) {
			console.log("already downloaded subtitles today. skipping...");

			return;
		}
	}

	for (let i = 0; i < videos.videos.length; i++) {
		const video = videos.videos[i];

		readline.cursorTo(process.stdout, 0);
		process.stdout.write(`downloading subtitles ${i + 1} of ${videos.videos.length}...`);

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

	process.stdout.write("\n");

	videos.subtitle_fetch_date = currentDate;

	await file.write(JSON.stringify(videos, null, "\t"));
}

async function checkMissingSubtitles(file: Bun.BunFile) {
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
		console.error(`${missingSubtitlesIds.length} videos have missing subtitles`);
	} else {
		console.log("no videos have missing subtitles");
	}

	return missingSubtitlesIds;
}

async function convertSubtitles() {
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
				video_id: file.name?.split("\\")[1]?.split(".")[0], // lol
				time_start: times[0],
				time_end: times[1],
				text: lines[2],
			};
		});

		outArr.push(...arr);
	}

	return outArr;
}

async function setup() {
	await downloadSubtitles(Bun.file("videos.json"));
	const missingSubtitlesIds = await checkMissingSubtitles(Bun.file("videos.json"));

	console.log("converting subtitles...");
	const convertedSubtitles = await convertSubtitles();

	console.log(`caching ${convertedSubtitles.length} converted subtitles...`);
	await Bun.file("subtitles_converted_flat.json").write(JSON.stringify(convertedSubtitles));

	console.log("building index...");

	const index = new FlexSearch.Document({
		tokenize: "forward",
		context: {
			resolution: 9,
			depth: 2,
			bidirectional: true,
		},
		encoder: FlexSearch.Charset.Normalize,
		document: {
			store: true,
			index: "text",
		},
	});

	for (const subtitle of convertedSubtitles) {
		index.add(subtitle);
	}

	console.log("ready!");

	return index;
}

function search(query: string, videos: any, index: Document, maxResults: number = 9) {
	const fsResults = new FlexSearch.Resolver({
		index: index,
		query: query,
		pluck: "text",
	})
		.resolve({
			enrich: true,
		})
		.slice(0, maxResults);

	const results = fsResults.map((result) => {
		if (!result.doc) return;

		const metadata = videos.videos.find((video: any) => video.id == result.doc!.video_id);

		return {
			score: result.doc!.score,
			text: result.doc!.text,
			video_id: result.doc!.video_id,
			time_start: result.doc!.time_start,
			time_end: result.doc!.time_end,
			title: metadata.title,
			thumbnail: metadata.thumbnail,
			uploader: metadata.uploader,
		};
	});

	return {
		message: "search successful!",
		results: results,
	};
}

const index = await setup();
const videos = await Bun.file("videos.json").json();

const app = new Hono();
app.use(cors());

// needs validation and sanitisation
app.get("/search", (c) => {
	const { query, maxResults } = c.req.query();

	if (query) {
		const res = search(query, videos, index, maxResults ? parseInt(maxResults as string) : undefined);
		return c.json(res);
	} else {
		c.status(400);
		return c.json({});
	}
});

export default app;
