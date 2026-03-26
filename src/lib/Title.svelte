<script lang="ts">
	import type { Snippet } from 'svelte'

	import logo from '$lib/assets/allmaps-logo.svg'
	import logoInverted from '$lib/assets/allmaps-logo-inverted.svg'
	import { Slide } from '@animotion/core'

	interface Props {
		dark?: boolean
		children?: Snippet
	}

	let { dark = true, children }: Props = $props()

	type Background = {
		image: string
		size: string
		position: string
	}

	let backgrounds: Background[] = [
		{
			image: 'url(/svg/masks.svg)',
			size: '120%',
			position: 'center'
		}
	]

	if (dark) {
		backgrounds.push({
			image: 'radial-gradient(circle at 50% 50%, #25318f, #101656)',
			size: 'cover',
			position: 'center'
		})
	}

	const bgImage = backgrounds.map(({ image }) => image).join(', ')
	const bgSize = backgrounds.map(({ size }) => size).join(', ')
	const bgPosition = backgrounds.map(({ position }) => position).join(', ')
</script>

<Slide>
	<div
		class="flex h-screen w-screen flex-col items-center justify-center gap-5"
		style:background-image={bgImage}
		style:background-size={bgSize}
		style:background-position={bgPosition}
	>
		<img class="w-44" alt="Allmaps logo" src={dark ? logoInverted : logo} />
		<div class="max-w-lg">
			{@render children?.()}
		</div>
	</div>
</Slide>
