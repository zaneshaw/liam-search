import ytdlpWrap from "yt-dlp-wrap";

interface VideoInfo {
	id?: string;
	title?: string;
	thumbnailUrl?: string;
	channnelTitle?: string;
	channnelId?: string;
}

const ytdlp = new ytdlpWrap("./bin/yt-dlp.exe");
const playlistUrl = "PLeMf46ndvGffIJt5KKDa_5SbXZ6F3azhP";

async function loadVideoMetadata(file: Bun.BunFile) {
	const currentDate = new Date().toISOString().split("T")[0] as string;

	if (await file.exists()) {
		const videos = await file.json();

		if (videos.fetch_date == currentDate) {
			console.log("already loaded video metadata today. loading from cache...");

			return videos;
		}
	}

	console.log("loading video metadata...");

	const playlistRaw = await ytdlp.execPromise(["--flat-playlist", "--print", "%(id)s\t%(title)s\t%(uploader)s", playlistUrl]);

	const videos: { fetch_date: string; videos: any[] } = {
		fetch_date: currentDate,
		videos: [],
	};

	for (const video of playlistRaw.trim().split("\n")) {
		const videoArr = video.split("\t");
		videos.videos.push({
			id: videoArr[0],
			title: videoArr[1],
			thumbnail: `https://i.ytimg.com/vi/${videoArr[0]}/mqdefault.jpg`,
			uploader: videoArr[2],
		});
	}

	console.log(`writing to ${file.name}...`);
	await file.write(JSON.stringify(videos, null, "\t"));

	return videos;
}

const videos = await loadVideoMetadata(Bun.file("videos.json"));

console.log(videos.videos.length);
