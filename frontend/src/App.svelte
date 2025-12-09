<script lang="ts">
	import { Search } from "lucide-svelte";

	let data: any = $state(null);
	let searchQueryInput: HTMLInputElement;

	$inspect(data);

	async function doSearch(query: string, maxResults?: number) {
		const res = await fetch(`https://liamsearch-backend.squidee.dev/search?query=${query}&max_results=${maxResults || ""}`);
		data = await res.json();
	}
</script>

<main class="mx-auto flex w-[512px] flex-col gap-5">
	<form
		onsubmit={(e) => {
			e.preventDefault();
			doSearch(searchQueryInput.value);
		}}
		class="light-outline flex grow overflow-clip rounded-full outline-1 has-[input:focus]:outline-blue-500!"
	>
		<input type="text" bind:this={searchQueryInput} class="bg-background! grow px-5 py-1" />
		<button class="btn px-4!"><Search class="w-5" /></button>
	</form>
	{#if data}
		{#if data.results}
			<p class="text-liam-skin italic">found {data.results.length} results</p>
			<div class="mx-auto flex flex-col gap-10">
				{#each data.results as video}
					<div class="flex flex-col">
						<iframe
							width="512"
							height="288"
							src="https://www.youtube-nocookie.com/embed/{video.video_id}?start={new Date(`1970-01-01T${video.time_start.split(',')[0]}.000Z`).getTime() / 1000}"
							title=""
							frameborder="0"
							allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
							allowfullscreen
							class="bg-black"
						></iframe>
						<p>
							<a href="https://www.youtube.com/watch?v={video.video_id}" target="_blank" class="font-bold">
								{video.title}
							</a>
							<span>at</span>
							<a href="https://www.youtube.com/watch?v={video.video_id}&t={new Date(`1970-01-01T${video.time_start.split(',')[0]}.000Z`).getTime() / 1000}" target="_blank" class="link">
								{video.time_start.split(",")[0]}
							</a>
						</p>
						<p>"...{video.text_before} <span class="text-yellow-400">{video.text}</span> {video.text_after}..."</p>
					</div>
				{/each}
			</div>
		{:else}
			<p class="text-liam-skin italic text-center">no results</p>
		{/if}
	{:else}
		<p class="text-center">try searching something</p>
	{/if}
</main>
