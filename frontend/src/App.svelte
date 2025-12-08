<script lang="ts">
	import { Search } from "lucide-svelte";

	let data: any = $state(null);
	let searchQueryInput: HTMLInputElement;

	$inspect(data);

	async function doSearch(query: string, maxResults?: number) {
		const res = await fetch(`http://localhost:3000/search?query=${query}&max_results=${maxResults}`);
		data = await res.json();
	}
</script>

<main class="flex flex-col gap-10">
	<form
		onsubmit={(e) => {
			e.preventDefault();
			doSearch(searchQueryInput.value);
		}}
		class="light-outline flex grow overflow-clip rounded-full outline-1 has-[input:focus]:outline-blue-500!"
	>
		<input type="text" bind:this={searchQueryInput} class="bg-background! grow px-5 py-1" />
		<button onclick={() => doSearch(searchQueryInput.value)} class="btn px-4!"><Search class="w-5" /></button>
	</form>
	{#if data}
		<div class="mx-auto flex w-[426px] flex-col gap-5">
			{#each data.results as video}
				<div class="flex flex-col">
					<div class="relative h-60 w-[426px]">
						<iframe
							width="426"
							height="240"
							src="https://www.youtube-nocookie.com/embed/{video.video_id}?start={new Date(`1970-01-01T${video.time_start.split(',')[0]}.000Z`).getTime() / 1000}"
							title=""
							frameborder="0"
							allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
							allowfullscreen
						></iframe>
						<!-- probably won't load fast to enough to see -->
						<img src={video.thumbnail} alt="" class="absolute top-0 left-0 -z-10 h-full w-full" />
					</div>
					<p>
						<a href="https://www.youtube.com/watch?v={video.video_id}" target="_blank" class="font-bold">
							{video.title}
						</a>
						<span>at</span>
						<a href="https://www.youtube.com/watch?v={video.video_id}&t={new Date(`1970-01-01T${video.time_start.split(',')[0]}.000Z`).getTime() / 1000}" target="_blank" class="link">
							{video.time_start.split(",")[0]}
						</a>
					</p>
					<p>"{video.text}"</p>
				</div>
			{/each}
		</div>
	{:else}
		<p>...</p>
	{/if}
</main>
