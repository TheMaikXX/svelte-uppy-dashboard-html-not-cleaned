<script>
	import UploadModal from "./UploadModal.svelte"

	let openUploadAttachmentsModal

	let firstValue = ""

	function onUploadCompleted(ev) {
		console.log("Upload completed", ev)
	}
</script>

<form>
	<input
		bind:value={firstValue}
		type="text"
		placeholder="dummy input"
	>

	<span>
		{firstValue}
	</span>

	<button on:click|preventDefault={openUploadAttachmentsModal}>Open upload modal</button>
</form>

<UploadModal
	bind:openModal={openUploadAttachmentsModal}
	endpoint="/upload"
	on:uploadCompleted={onUploadCompleted}
/>
