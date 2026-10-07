<script>
	/**
	 * Kompakte Liste von Einträgen aus dem Änderungsprotokoll, mit Link zum
	 * Nutzer und Unternehmen.
	 */
	import { resolve } from '$app/paths';
	import { actionLabel, entityTypeLabel } from '#lib/labels.js';
	import { formatRelative, formatDateTime } from '#lib/format.js';

	/**
	 * @type {{ rows: any[], showCompany?: boolean }}
	 */
	let { rows, showCompany = true } = $props();
</script>

{#if rows.length === 0}
	<p class="m-0 py-6 text-center text-[14px] text-ink-500">Noch keine Einträge.</p>
{:else}
	<ul class="m-0 list-none divide-y divide-ink-100 p-0">
		{#each rows as row (row.id)}
			{@const personId = row.userId ?? row.ownerId}
			{@const person = row.userId
				? [row.firstName, row.lastName].filter(Boolean).join(' ')
				: row.actorType === 'SYSTEM'
					? 'System'
					: 'Unbekannt'}
			<li class="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
				<span
					class="mt-1.5 size-2 shrink-0 rounded-full {String(row.action).includes('failed')
						? 'bg-error'
						: row.actorType === 'SYSTEM'
							? 'bg-ink-300'
							: 'bg-violet-700'}"
					aria-hidden="true"
				></span>
				<div class="min-w-0 flex-1">
					<p class="m-0 truncate text-[14px] text-ink">
						{row.summary ??
							`${entityTypeLabel(row.entityType)} ${actionLabel(row.action).toLowerCase()}`}
					</p>
					<p class="m-0 mt-0.5 truncate text-[12.5px] text-ink-500">
						{#if personId}
							<a
								href={resolve('/(admin)/nutzer/[id]', { id: personId })}
								class="text-ink-700 hover:text-violet-700">{person}</a
							>
						{:else}
							{person}
						{/if}
						{#if showCompany && row.companyName}· {row.companyName}{/if}
						· {entityTypeLabel(row.entityType)}
					</p>
				</div>
				<time
					class="tnum shrink-0 text-[12.5px] text-ink-500"
					datetime={new Date(row.createdAt).toISOString()}
					title={formatDateTime(row.createdAt)}>{formatRelative(row.createdAt)}</time
				>
			</li>
		{/each}
	</ul>
{/if}
