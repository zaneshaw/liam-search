import { google } from "googleapis";

interface VideoInfo {
	id?: string;
	title?: string;
	thumbnailUrl?: string;
	channnelTitle?: string;
	channnelId?: string;
}

const playlistUrl = "PLeMf46ndvGffIJt5KKDa_5SbXZ6F3azhP";

const youtube = google.youtube({
	version: "v3",
	auth: Bun.env.API_KEY,
});

async function getPlaylistVideos(videos: VideoInfo[] = [], nextPageToken: string | undefined = undefined): Promise<VideoInfo[]> {
	const res = await youtube.playlistItems.list({
		part: ["snippet"],
		playlistId: playlistUrl,
		maxResults: 50,
		pageToken: nextPageToken,
	});

	if (res.data.items && res.data.items.length > 0) {
		for (const item of res.data.items) {
			const snippet = item.snippet;
			const video: VideoInfo = {
				id: snippet?.resourceId?.videoId ?? undefined,
				title: snippet?.title ?? undefined,
				thumbnailUrl: snippet?.thumbnails?.medium?.url ?? undefined,
				channnelTitle: snippet?.videoOwnerChannelTitle ?? undefined,
				channnelId: snippet?.videoOwnerChannelId ?? undefined,
			};

			videos.push(video);
		}

		if (res.data.nextPageToken) {
			await getPlaylistVideos(videos, res.data.nextPageToken);
		}
	}

	return videos;
}

async function loadVideos(file: Bun.BunFile) {
	const currentDate = new Date().toISOString().split("T")[0];

	if (await file.exists()) {
		const videos = await file.json();

		if (videos.fetch_date == currentDate) {
			console.log("already fetched videos today. using local file...");

			return videos;
		}
	}

	console.log("fetching videos...");

	const videos = {
		fetch_date: currentDate,
		videos: await getPlaylistVideos()
	};

	console.log("writing videos to file...");
	await file.write(JSON.stringify(videos, null, "\t"));

	return videos;
}

const videos = await loadVideos(Bun.file("videos.json"));

console.log(videos.videos.length);
