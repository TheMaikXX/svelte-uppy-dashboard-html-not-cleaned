<script>
	import {createEventDispatcher} from "svelte"
	import {DashboardModal} from "@uppy/svelte"
	import Uppy from "@uppy/core"
	import Dashboard from "@uppy/dashboard"
	import XHRUpload from "@uppy/xhr-upload"
	import "../../node_modules/@uppy/core/dist/style.css"
	import "../../node_modules/@uppy/dashboard/dist/style.css"

	const dispatch = createEventDispatcher()

	export let maxFileSize = "1000000000" // 1GB
	export let allowedFileTypes = null
	export let maxNumberOfFiles = 1
	export let simultaneousUploads = 2
	export let fieldName = "file"
	export let endpoint = null
	export let uploadData = {}

	endpoint || (() => {throw new Error("Endpoint prop of upload modal is required")})()

	let open = false

	const uppy = new Uppy({
		restrictions: {
			maxFileSize,
			allowedFileTypes
		}
	})
		// .use(Dashboard)
		.use(XHRUpload, {
			endpoint,
			fieldName,
			limit: simultaneousUploads
		})

	$: uppy.setMeta(uploadData)

	$: uppy.setOptions({
		restrictions: {
			maxNumberOfFiles,
			maxFileSize,
			allowedFileTypes
		}
	})

	$: uppy.getPlugin("XHRUpload").setOptions({
		endpoint,
		fieldName,
		limit: simultaneousUploads
	})

	uppy.on("complete", (result) => {
		console.log("Upload complete! Upload result: ", result)

		if (result.successful.length)
			dispatch("uploadCompleted", result)
	})

	uppy.on('upload-success', (file, response) => {
		dispatch("uploadSuccessful", response)
		// do something with file and response
	})
	uppy.on("upload-error", (file, error, response) => {
		if (response.status === 409) {
			console.error("Same filename already exists", file, error, response)
		}
	})

	export function openModal() {
		// debugger
		// uppy.getPlugin("Dashboard").openModal()
		open = true
	}

	export function closeModal() {
		// uppy.getPlugin("DashboardModal").closeModal()
		open = false
	}
</script>

<DashboardModal {uppy} {open} />
