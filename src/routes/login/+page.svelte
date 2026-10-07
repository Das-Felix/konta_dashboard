<script>
	import { enhance } from '$app/forms';
	import wordmark from '#lib/assets/konta-wordmark.svg';
	import Button from '#lib/components/ui/Button.svelte';
	import Notice from '#lib/components/ui/Notice.svelte';

	/** @type {import('./$types').PageProps} */
	let { form } = $props();

	let submitting = $state(false);

	const pending = $derived(form && 'pending' in form ? form.pending : null);

	/** @type {import('$app/forms').SubmitFunction} */
	function onSubmit() {
		submitting = true;
		return async ({ update }) => {
			await update({ reset: false });
			submitting = false;
		};
	}

	const inputClass =
		'h-control w-full rounded-md border border-ink-200 bg-white px-3.5 text-base text-ink outline-none transition-shadow placeholder:text-ink-400 focus:border-ink-400 focus:shadow-[var(--focus-ring)]';
</script>

<svelte:head>
	<title>Anmelden | Konta Admin</title>
</svelte:head>

<main class="flex min-h-dvh items-center justify-center px-4 py-10 bg-mesh-soft">
	<div class="w-full max-w-[400px] rounded-xl border border-ink/7 bg-white px-7 py-8 shadow-raised">
		<div class="mb-7 flex items-center gap-2">
			<img src={wordmark} alt="Konta" class="h-6 w-auto" />
			<span class="text-label rounded-full bg-ink-100 px-2 py-1 text-ink-700">Admin</span>
		</div>

		<h1 class="text-[26px]">{pending ? 'Bestätigungscode eingeben.' : 'Anmelden.'}</h1>
		<p class="m-0 mt-2 mb-6 text-[14.5px] text-ink-500">
			{pending
				? 'Für dein Konto ist 2FA aktiv. Gib den Code aus deiner Authenticator-App ein.'
				: 'Mit deinem Konta-Konto. Zugang haben nur freigeschaltete Adressen.'}
		</p>

		{#if form?.error}
			<Notice tone="error" class="mb-5">{form.error}</Notice>
		{/if}

		{#if pending}
			<form method="POST" action="?/code" use:enhance={onSubmit} class="flex flex-col gap-4">
				<input type="hidden" name="pending" value={pending} />
				<input type="hidden" name="email" value={form?.email ?? ''} />
				<label class="flex flex-col gap-1.5">
					<span class="text-sm font-semibold text-ink">Code</span>
					<!-- svelte-ignore a11y_autofocus -->
					<input
						name="code"
						inputmode="numeric"
						autocomplete="one-time-code"
						pattern="[0-9 ]*"
						maxlength="7"
						required
						autofocus
						class="{inputClass} tnum tracking-[0.2em]"
					/>
				</label>
				<Button type="submit" variant="inverse" disabled={submitting}>Bestätigen</Button>
			</form>
		{:else}
			<form method="POST" action="?/login" use:enhance={onSubmit} class="flex flex-col gap-4">
				<label class="flex flex-col gap-1.5">
					<span class="text-sm font-semibold text-ink">E-Mail</span>
					<input
						name="email"
						type="email"
						autocomplete="username"
						required
						value={form?.email ?? ''}
						class={inputClass}
					/>
				</label>
				<label class="flex flex-col gap-1.5">
					<span class="text-sm font-semibold text-ink">Passwort</span>
					<input
						name="password"
						type="password"
						autocomplete="current-password"
						required
						class={inputClass}
					/>
				</label>
				<Button type="submit" variant="inverse" disabled={submitting}>Anmelden</Button>
			</form>
		{/if}
	</div>
</main>
