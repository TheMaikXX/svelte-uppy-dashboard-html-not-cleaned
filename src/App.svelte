<script>
	import DummyForm from "./components/DummyForm.svelte"

	let formVisible = false
</script>

<main>
	<button on:click={() => formVisible = !formVisible}>
		Toggle form with upload
	</button>

	{#if formVisible}
		<DummyForm />
	{/if}
</main>
